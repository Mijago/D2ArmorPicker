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

function runWorker(config, items, seconds, recorded, unpack) {
  const log = console.log;
  const time = console.time;
  const timeEnd = console.timeEnd;
  console.log = console.time = console.timeEnd = () => {};
  return new Promise((resolve) => {
    let results = 0;
    let unpackMs = 0;
    let last = null;
    let progress = null;
    const started = performance.now();
    const timer = setTimeout(() => globalThis.__workerListeners.message({ data: { type: "cancel" } }), seconds * 1000);
    const memoryTimer = process.env.TRACE_MEMORY
      ? setInterval(() => {
          process.stderr.write(
            `heap ${(process.memoryUsage().heapUsed / 1048576).toFixed(0)}MB checked ${progress?.checkedCalculations} computed ${progress?.computedPermutations} results ${results}\n`
          );
        }, 2000)
      : null;
    globalThis.__onWorkerMessage = (message) => {
      if (message.packed) {
        results += message.packed.count;
        if (recorded) {
          const unpackStart = performance.now();
          const sets = unpack(message.packed);
          unpackMs += performance.now() - unpackStart;
          recorded.push({ t: unpackStart - started, sets });
        }
      }
      if (message.checkedCalculations !== undefined) progress = message;
      if (message.done) {
        last = message;
        clearTimeout(timer);
        clearInterval(memoryTimer);
        console.log = log;
        console.time = time;
        console.timeEnd = timeEnd;
        resolve({
          unpackMs,
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

function regroup(messages) {
  const grouped = [];
  let pending = null;
  for (const message of messages) {
    pending ??= { t: message.t, sets: [] };
    pending.sets.push(...message.sets);
    pending.t = message.t;
    if (pending.sets.length >= 5000) {
      grouped.push(pending);
      pending = null;
    }
  }
  if (pending) grouped.push(pending);
  return grouped;
}

// Replays the recorded worker messages through the service's ingest and throttled publish.
function simulateMain(calculator, recorded, label, transform) {
  calculator["freshEntries"] = [];
  calculator["pendingResultSets"] = [];
  calculator["freshKeys"].clear();
  calculator["retainedEntries"] = [];
  const messages = transform(recorded);
  const subject = { next() {} };
  let publishMs = 0;
  let maxPublish = 0;
  let publishes = 0;
  let lastPublish = -Infinity;
  const publish = () => {
    const start = performance.now();
    calculator["publishResults"](subject, 0, { totalTime: null, maximumPossibleTiers: [0, 0, 0, 0, 0, 0] });
    const took = performance.now() - start;
    publishMs += took;
    maxPublish = Math.max(maxPublish, took);
    publishes++;
  };
  for (const message of messages) {
    for (const armorSet of message.sets) calculator["pendingResultSets"].push(armorSet);
    if (message.t - lastPublish >= 200) {
      lastPublish = message.t;
      publish();
    }
  }
  publish();
  const total = calculator["freshEntries"].length;
  console.log(
    `    ${label.padEnd(24)} messages ${String(messages.length).padStart(4)}  ` +
      `publishes ${publishes}  ingest+publish ${publishMs.toFixed(0)}ms (max ${maxPublish.toFixed(0)}ms, ${total} results)`
  );
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
      config: { type: "string" },
      "main-sim": { type: "boolean", default: false },
    },
  });
  if (values.summarize) return summarize(values.summarize);
  if (!values.input) throw new Error("Provide --input <armor.json> or --summarize <file.cpuprofile>.");

  const bundlePath = await bundle();
  const { ArmorCalculatorService, BuildConfiguration, unpackArmorSets } = require(bundlePath);
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
      if (values.config) {
        const encoded = fs.existsSync(values.config)
          ? fs.readFileSync(values.config, "utf8").trim()
          : values.config;
        const shared = JSON.parse(require("lzutf8").decompress(encoded, { inputEncoding: "Base64" }));
        Object.assign(config, shared);
        const statNames = ["Health", "Melee", "Grenade", "Super", "Class", "Weapon"];
        config.minimumStatTiers = Object.fromEntries(
          statNames.map((name, stat) => [stat, shared.minimumStatTiers[name]])
        );
      }
      config.characterClass = values.config ? config.characterClass : characterClass;
      if (!values.config) {
        config.calculateTierFiveTuning = true;
        config.includeCollectionRolls = values.collections;
        config.includeVendorRolls = values.vendor;
        for (const [stat, tier] of Object.entries(targets)) config.minimumStatTiers[stat].value = tier;
      }

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
      process.stdout.write(`  ${name}: pool ${pool.items.length} [${perSlot.join("/")}], running worker\n`);
      const recorded = values["main-sim"] ? [] : null;
      const outcome = await runWorker(config, pool.items, Number(values.seconds), recorded, unpackArmorSets);
      console.log(
        `  ${name.padEnd(18)} pool ${pool.items.length} [${perSlot.join("/")}] (distinct ${pool.deduped}, pruned ${pool.poolBefore - pool.items.length}) ` +
          `combos ${outcome.estimated.toLocaleString()} checked ${outcome.checked.toLocaleString()} computed ${outcome.computed.toLocaleString()} ` +
          `results ${outcome.results} ${(outcome.ms / 1000).toFixed(2)}s` +
          `${outcome.cancelled ? " CANCELLED" : ""}${outcome.stoppedEarly ? " stopped-early" : ""}${outcome.limit ? " limit" : ""}`
      );
      if (recorded) {
        ArmorCalculatorService["inventoryById"] = new Map(prepared.items.map((armor) => [armor.id, armor]));
        console.log(`  main thread (unpack of ${recorded.length} messages: ${outcome.unpackMs.toFixed(0)}ms)`);
        simulateMain(ArmorCalculatorService, recorded, "as posted by the worker", (r) => r);
        simulateMain(ArmorCalculatorService, recorded, "regrouped into 5000", regroup);
        const copies = (n) => (messages) =>
          Array.from({ length: n }, () => messages)
            .flat()
            .sort((a, b) => a.t - b.t);
        simulateMain(ArmorCalculatorService, recorded, "x8 workers as posted", copies(8));
        simulateMain(ArmorCalculatorService, recorded, "x8 workers regrouped", (m) => regroup(copies(8)(m)));
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
