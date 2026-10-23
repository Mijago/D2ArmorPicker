// Runs the real armor calculator pipeline and results-builder worker in Node on an exported inventory.
//   node scripts/profile-calculator.cjs --input <armor.json> [--class 0|1|2] [--seconds 60]
//        [--scenarios none,w100g100c100,...] [--collections] [--vendor]
//   node --cpu-prof scripts/profile-calculator.cjs ...   (then: --summarize <file.cpuprofile>)
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { parseArgs } = require("node:util");
const esbuild = require("esbuild");

const SCENARIOS = {
  none: {},
  w100g100c100: { 5: 10, 2: 10, 4: 10 },
  w100g100s100c100: { 5: 10, 2: 10, 3: 10, 4: 10 },
  balanced80: { 0: 8, 1: 8, 2: 8, 3: 8, 4: 8, 5: 8 },
  w150g100: { 5: 15, 2: 10 },
  unreachable: { 0: 15, 1: 15, 2: 15, 3: 15, 4: 15, 5: 15 },
};

function summarize(file) {
  const profile = JSON.parse(fs.readFileSync(file, "utf8"));
  const self = new Map();
  const byId = new Map(profile.nodes.map((node) => [node.id, node]));
  const deltas = profile.timeDeltas;
  profile.samples.forEach((id, index) => {
    const frame = byId.get(id).callFrame;
    const key = `${frame.functionName || "(anonymous)"} ${path.basename(frame.url)}:${frame.lineNumber + 1}`;
    self.set(key, (self.get(key) ?? 0) + (deltas[index] ?? 0));
  });
  const total = [...self.values()].reduce((sum, value) => sum + value, 0);
  [...self.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .forEach(([key, value]) =>
      console.log(`${((value / total) * 100).toFixed(1).padStart(5)}%  ${(value / 1000).toFixed(0).padStart(7)} ms  ${key}`)
    );
}

async function bundle() {
  const outfile = path.join(os.tmpdir(), "d2ap-profile-calculator.cjs");
  const stub = {
    name: "stub-browser-only",
    setup(build) {
      build.onResolve({ filter: /^@openreplay\/|^@sentry\// }, (args) => ({
        path: args.path,
        namespace: "stub",
      }));
      build.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
        contents:
          "const noop = new Proxy(function () {}, { get: (t, k) => (k === '__esModule' ? false : noop), apply: () => noop, construct: () => noop }); module.exports = noop;",
        loader: "js",
      }));
    },
  };
  await esbuild.build({
    entryPoints: [path.join(__dirname, "profile-calculator.entry.ts")],
    outfile,
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node20",
    tsconfig: path.join(__dirname, "..", "tsconfig.json"),
    logLevel: "error",
    plugins: [stub],
    define: { "import.meta.url": "__importMetaUrl" },
    banner: {
      js: [
        "const __importMetaUrl = require('node:url').pathToFileURL(__filename).href;",
        // The worker module talks to its host through these globals.
        "globalThis.__workerListeners = {};",
        "globalThis.addEventListener = (type, listener) => { globalThis.__workerListeners[type] = listener; };",
        "globalThis.postMessage = (message) => globalThis.__onWorkerMessage && globalThis.__onWorkerMessage(message);",
      ].join("\n"),
    },
  });
  return outfile;
}

function prepareWorkerItems(service, calculator, prepared, config) {
  const inventoryById = new Map(prepared.items.map((armor) => [armor.id, armor]));
  let permutator = prepared.items.map((armor) =>
    calculator.convertInventoryArmorToPermutatorArmor(armor)
  );
  const prunedBy = new Map(prepared.duplicatePruners);
  const poolBefore = permutator.length;
  permutator = calculator["pruneDominatedArmorItems"](permutator, config, inventoryById, prunedBy);
  const items = permutator.map(calculator.convertPermutatorArmorToWorkerArmor);
  const stats = (item) => [
    item.resilience,
    item.strength,
    item.discipline,
    item.intellect,
    item.recovery,
    item.mobility,
  ];
  const sum = (values) => values.reduce((a, b) => a + b, 0);
  const selected = [0, 1, 2, 3, 4, 5].filter((stat) => config.minimumStatTiers[stat].value > 0);
  items.sort((a, b) => {
    const total = sum(stats(b)) - sum(stats(a));
    if (total !== 0) return total;
    const masterwork = (b.masterworkLevel ?? 0) - (a.masterworkLevel ?? 0);
    if (masterwork !== 0) return masterwork;
    const selectedDiff = selected.reduce((s, stat) => s + stats(b)[stat] - stats(a)[stat], 0);
    if (selectedDiff !== 0) return selectedDiff;
    return Number(b.gearSetHash != null || b.gearSetPerkSelectable) - Number(a.gearSetHash != null || a.gearSetPerkSelectable);
  });
  return { items, poolBefore, deduped: prepared.items.length, duplicates: prepared.duplicates.length };
}

function runWorker(config, items, seconds) {
  const log = console.log;
  const time = console.time;
  const timeEnd = console.timeEnd;
  console.log = console.time = console.timeEnd = () => {};
  return new Promise((resolve) => {
    let results = 0;
    let last = null;
    let progress = null;
    const started = performance.now();
    const timer = setTimeout(() => globalThis.__workerListeners.message({ data: { type: "cancel" } }), seconds * 1000);
    globalThis.__onWorkerMessage = (message) => {
      if (message.packed) results += message.packed.count;
      if (message.checkedCalculations !== undefined) progress = message;
      if (message.done) {
        last = message;
        clearTimeout(timer);
        console.log = log;
        console.time = time;
        console.timeEnd = timeEnd;
        resolve({
          ms: performance.now() - started,
          results,
          checked: last.checkedCalculations,
          estimated: last.estimatedCalculations,
          computed: last.computedPermutations,
          cancelled: last.checkedCalculations < last.estimatedCalculations && !last.stoppedEarlyAtMaxTier && !last.resultLimitReached,
          stoppedEarly: !!last.stoppedEarlyAtMaxTier,
          limit: !!last.resultLimitReached,
        });
      }
    };
    globalThis.__workerListeners.message({
      data: {
        type: "builderRequest",
        currentClass: config.characterClass,
        config: JSON.parse(JSON.stringify(config)),
        threadSplit: { count: 1, current: 0 },
        items,
        selectedExotics: [],
      },
    });
  });
}

async function main() {
  const { values } = parseArgs({
    options: {
      input: { type: "string" },
      class: { type: "string" },
      seconds: { type: "string", default: "60" },
      scenarios: { type: "string", default: Object.keys(SCENARIOS).join(",") },
      collections: { type: "boolean", default: false },
      vendor: { type: "boolean", default: false },
      summarize: { type: "string" },
    },
  });
  if (values.summarize) return summarize(values.summarize);
  if (!values.input) throw new Error("Provide --input <armor.json> or --summarize <file.cpuprofile>.");

  const bundlePath = await bundle();
  const { ArmorCalculatorService, BuildConfiguration } = require(bundlePath);
  const inventory = JSON.parse(fs.readFileSync(values.input, "utf8"));
  const classes = values.class !== undefined ? [Number(values.class)] : [0, 1, 2];

  for (const characterClass of classes) {
    const owned = inventory.filter((item) => item.clazz === characterClass);
    const tier5 = owned.filter((item) => item.armorSystem === 3 && item.tier >= 5).length;
    console.log(`\nclass ${characterClass}: ${owned.length} items (${tier5} T5)`);
    for (const name of values.scenarios.split(",")) {
      const targets = SCENARIOS[name];
      if (!targets) throw new Error(`Unknown scenario ${name}`);
      const config = new BuildConfiguration();
      config.characterClass = characterClass;
      config.calculateTierFiveTuning = true;
      config.includeCollectionRolls = values.collections;
      config.includeVendorRolls = values.vendor;
      for (const [stat, tier] of Object.entries(targets)) config.minimumStatTiers[stat].value = tier;

      const service = Object.create(ArmorCalculatorService.prototype);
      Object.defineProperty(service, "db", {
        value: {
          inventoryArmor: {
            where: () => ({ equals: (clazz) => ({ distinct: () => ({ toArray: async () => inventory.filter((item) => item.clazz === clazz) }) }) }),
          },
        },
      });
      const prepared = await service["filterAndPrepareInventoryItems"](config);
      const pool = prepareWorkerItems(service, ArmorCalculatorService, prepared, config);
      const perSlot = [1, 2, 3, 4, 5].map((slot) => pool.items.filter((item) => item.slot === slot).length);
      const outcome = await runWorker(config, pool.items, Number(values.seconds));
      console.log(
        `  ${name.padEnd(18)} pool ${pool.items.length} [${perSlot.join("/")}] (distinct ${pool.deduped}, pruned ${pool.poolBefore - pool.items.length}) ` +
          `combos ${outcome.estimated.toLocaleString()} checked ${outcome.checked.toLocaleString()} computed ${outcome.computed.toLocaleString()} ` +
          `results ${outcome.results} ${(outcome.ms / 1000).toFixed(2)}s` +
          `${outcome.cancelled ? " CANCELLED" : ""}${outcome.stoppedEarly ? " stopped-early" : ""}${outcome.limit ? " limit" : ""}`
      );
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
