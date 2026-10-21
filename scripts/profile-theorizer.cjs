const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const http = require("node:http");
const { parseArgs } = require("node:util");
const { execFileSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const esbuild = require("esbuild");
const { chromium } = require("playwright");

async function main() {
  const { values } = parseArgs({
    options: {
      input: { type: "string" },
      fixture: { type: "boolean", default: false },
      seconds: { type: "string", default: "30" },
      workers: { type: "string", default: "1,4" },
      variants: { type: "string", default: "current,ordered-prefixes" },
      repeat: { type: "string", default: "1" },
      output: { type: "string", default: "theorizer-profile-report.json" },
      trace: { type: "boolean", default: false },
      help: { type: "boolean", default: false },
      "slice-ms": { type: "string", default: "4000" },
      "retry-limit": { type: "string", default: "3" },
      browser: { type: "string", default: "msedge" },
      task: { type: "string" },
    },
  });
  if (values.help) {
    console.log(`npm run profile:theorizer -- --input <export.json> [options]
  --fixture                 Use synthetic inputs instead of --input
  --seconds 30              Discovery budget per comparison case
  --workers 1,4             Comma-separated worker counts (1-64)
  --variants current,no-task-priority,ordered-prefixes,inventory-priority,no-resume,shared-exclusions
  --repeat 2                Repeat cases, alternating variant order
  --slice-ms 4000            Leaf discovery slice duration
  --retry-limit 3            Consecutive retries before deferral
  --task Grenedier,Grenedier,Grenedier,Grenedier,Grenedier
  --trace                   Include per-solve samples
  --output report.json      JSON output path
  --browser msedge           Installed Edge, or chromium if installed via Playwright
  --help                    Show this message`);
    return;
  }
  if (!values.input && !values.fixture)
    throw new Error("Provide --input <export.json> or --fixture. Use --help for options.");
  if (values.input && values.fixture) throw new Error("Use either --input or --fixture, not both.");
  const integer = (text, name, minimum, maximum) => {
    const value = Number(text);
    if (!Number.isInteger(value) || value < minimum || value > maximum)
      throw new Error(`${name} must be an integer from ${minimum} to ${maximum}.`);
    return value;
  };
  const seconds = integer(values.seconds, "seconds", 1, 3600);
  const counts = [
    ...new Set(values.workers.split(",").map((value) => integer(value, "workers", 1, 64))),
  ];
  const variants = [...new Set(values.variants.split(","))];
  if (
    variants.some(
      (value) =>
        ![
          "current",
          "inventory-priority",
          "no-inventory-priority",
          "no-resume",
          "shared-exclusions",
          "archetype-counts",
          "ordered-prefixes",
          "no-task-priority",
        ].includes(value)
    )
  )
    throw new Error("Unknown variant.");
  const repeat = integer(values.repeat, "repeat", 1, 20);
  const sliceMs = integer(values["slice-ms"], "slice-ms", 150, 10000);
  const retryLimit = integer(values["retry-limit"], "retry-limit", 1, 20);
  const task = values.task?.split(",").map((value) => value.trim());
  if (task && (task.length < 3 || task.length > 5 || task.some((name) => !name)))
    throw new Error("task must contain three to five comma-separated archetype names.");
  const input = values.input
    ? JSON.parse(await fs.readFile(path.resolve(values.input), "utf8"))
    : null;
  if (
    input &&
    (input.schemaVersion !== 1 ||
      !input.request?.config ||
      !Array.isArray(input.request.inventory) ||
      !Array.isArray(input.request.manifest))
  )
    throw new Error("Not a theorizer profiling-input export.");
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "theorizer-profile-"));
  let server;
  let browser;
  try {
    await esbuild.build({
      entryPoints: [path.join(__dirname, "profile-theorizer.worker.ts")],
      outfile: path.join(directory, "worker.js"),
      bundle: true,
      platform: "browser",
      format: "esm",
      target: "es2022",
      logLevel: "warning",
      plugins: [
        {
          name: "profiling-environment",
          setup(build) {
            build.onResolve({ filter: /^bungie-api-ts\/destiny2\/interfaces$/ }, () => ({
              path: require.resolve("bungie-api-ts/destiny2"),
            }));
            build.onResolve({ filter: /^src\/environments\/environment$/ }, () => ({
              path: "environment",
              namespace: "profile",
            }));
            build.onLoad({ filter: /.*/, namespace: "profile" }, () => ({
              contents: 'export const environment = { version: "profile", production: false };',
              loader: "js",
            }));
          },
        },
      ],
    });
    const assets = new Map([
      ["/worker.js", [path.join(directory, "worker.js"), "text/javascript"]],
      [
        "/assets/highs.mjs",
        [path.join(path.dirname(require.resolve("highs")), "highs.mjs"), "text/javascript"],
      ],
      [
        "/assets/highs.wasm",
        [path.join(path.dirname(require.resolve("highs")), "highs.wasm"), "application/wasm"],
      ],
    ]);
    server = http.createServer(async (request, response) => {
      try {
        if (request.url === "/") {
          response.writeHead(200, { "Content-Type": "text/html" });
          response.end("<!doctype html><title>Theorizer profiler</title>");
          return;
        }
        const asset = assets.get(request.url);
        if (!asset) {
          response.writeHead(404);
          response.end();
          return;
        }
        response.writeHead(200, { "Content-Type": asset[1], "Cache-Control": "no-store" });
        response.end(await fs.readFile(asset[0]));
      } catch {
        response.writeHead(500);
        response.end();
      }
    });
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    browser = await chromium.launch({
      headless: true,
      ...(values.browser === "chromium" ? {} : { channel: values.browser }),
    });
    const report = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      revision: execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim(),
      bundleSha256: createHash("sha256")
        .update(await fs.readFile(path.join(directory, "worker.js")))
        .digest("hex"),
      inputSha256: input ? createHash("sha256").update(JSON.stringify(input)).digest("hex") : null,
      node: process.version,
      browser: browser.version(),
      reportedLogicalCpus: os.availableParallelism?.() ?? os.cpus().length,
      input: values.fixture ? "synthetic fixture" : "sanitized export",
      settings: {
        seconds,
        counts,
        variants,
        repeat,
        sliceMs,
        retryLimit,
        task,
        trace: values.trace,
      },
      scope:
        "Discovery only; excludes slider maxima, inventory fitting, retained builds and Angular UI. In-flight solve metrics at deadline may be incomplete.",
      runs: [],
    };
    for (let repetition = 0; repetition < repeat; repetition++) {
      const ordered = repetition % 2 ? [...variants].reverse() : variants;
      for (const workers of counts)
        for (const variant of ordered) {
          console.log(
            `Profiling ${variant}: ${workers} workers, ${seconds}s, repetition ${repetition + 1}...`
          );
          const context = await browser.newContext();
          const page = await context.newPage();
          await page.goto(`http://127.0.0.1:${server.address().port}/`);
          const result = await page.evaluate(
            async (options) => {
              const slots = Array.from({ length: options.workers }, (_, index) => ({
                worker: new Worker("/worker.js", { type: "module" }),
                index,
                active: null,
              }));
              const ready = await Promise.all(
                slots.map(
                  (slot) =>
                    new Promise((resolve, reject) => {
                      slot.worker.onerror = (event) => reject(new Error(event.message));
                      slot.worker.onmessage = ({ data }) =>
                        data.type === "ready"
                          ? resolve(data)
                          : data.type === "error"
                            ? reject(new Error(data.error))
                            : undefined;
                      slot.worker.postMessage({
                        type: "init",
                        index: slot.index,
                        input: options.input,
                        variant: options.variant,
                        trace: options.trace,
                        retryLimit: options.retryLimit,
                      });
                    })
                )
              );
              const source = ready[0];
              if (
                options.task &&
                ((source.countTasks && options.task.length !== 5) ||
                  options.task.some((name, slot) =>
                    source.countTasks
                      ? !source.archetypes.includes(name)
                      : !source.choices[slot].includes(name)
                  ))
              ) {
                slots.forEach((slot) => slot.worker.terminate());
                throw new Error(
                  "The requested task contains an archetype unavailable in its slot."
                );
              }
              const tasks = (
                options.task
                  ? [{ archetypes: options.task, archetypeCounts: source.countTasks }]
                  : source.tasks
              ).map((task, id) => ({
                id,
                archetypes: task.archetypes,
                archetypeCounts: task.archetypeCounts,
                tertiaries: task.tertiaries,
                excludedArrangements: task.excludedArrangements,
                owner: null,
                deferred: false,
                feasible: 0,
                slices: 0,
                deferrals: 0,
                completed: false,
                unique: 0,
                solves: 0,
                retries: 0,
                serializeMs: 0,
                solveMs: 0,
                validateMs: 0,
                iteratorMs: 0,
                maxVariables: 0,
                maxConstraints: 0,
                maxLpBytes: 0,
                statuses: {},
                retryReasons: {},
                timeouts: {},
                trace: [],
              }));
              const pending = [...tasks];
              const unique = new Set();
              let duplicateDiscoveries = 0;
              let discoveries = 0;
              let completedTasks = 0;
              let resumes = 0;
              const started = performance.now();
              return await new Promise((resolve, reject) => {
                let ended = false;
                const timer = setTimeout(() => finish("budget"), options.seconds * 1000);
                const finish = (reason) => {
                  if (ended) return;
                  ended = true;
                  clearTimeout(timer);
                  const elapsedMs = performance.now() - started;
                  const activeAtDeadline = slots.filter((slot) => slot.active !== null).length;
                  slots.forEach((slot) => slot.worker.terminate());
                  const totals = {
                    solves: 0,
                    retries: 0,
                    serializeMs: 0,
                    solveMs: 0,
                    validateMs: 0,
                    iteratorMs: 0,
                    statuses: {},
                    retryReasons: {},
                    timeouts: {},
                  };
                  for (const task of tasks) {
                    for (const key of [
                      "solves",
                      "retries",
                      "serializeMs",
                      "solveMs",
                      "validateMs",
                      "iteratorMs",
                    ])
                      totals[key] += task[key];
                    for (const key of ["statuses", "retryReasons", "timeouts"])
                      for (const [name, count] of Object.entries(task[key]))
                        totals[key][name] = (totals[key][name] || 0) + count;
                  }
                  const topTasks = [...tasks]
                    .sort((first, second) => second.iteratorMs - first.iteratorMs)
                    .slice(0, 50)
                    .map((task) => ({
                      ...task,
                      newArrangementsPerWorkerSecond: task.iteratorMs
                        ? (task.unique / task.iteratorMs) * 1000
                        : 0,
                      overheadMs: Math.max(
                        0,
                        task.iteratorMs - task.serializeMs - task.solveMs - task.validateMs
                      ),
                      trace: undefined,
                    }));
                  resolve({
                    variant: options.variant,
                    workers: options.workers,
                    elapsedMs,
                    stopReason: reason,
                    uniqueArrangements: unique.size,
                    arrangementsPerSecond: (unique.size / elapsedMs) * 1000,
                    discoveries,
                    duplicateDiscoveries,
                    tasksTotal: tasks.length,
                    completedTasks,
                    queuedTasks: pending.length,
                    deferredQueued: pending.filter((task) => task.deferred).length,
                    deferredTasks: pending
                      .filter((task) => task.deferred)
                      .map((task) => ({
                        id: task.id,
                        archetypes: task.archetypes,
                        owner: task.owner,
                        feasible: task.feasible,
                        slices: task.slices,
                        deferrals: task.deferrals,
                        retries: task.retries,
                        iteratorMs: task.iteratorMs,
                      })),
                    activeAtDeadline,
                    resumes,
                    totals,
                    overheadMs: Math.max(
                      0,
                      totals.iteratorMs - totals.serializeMs - totals.solveMs - totals.validateMs
                    ),
                    workerContexts: slots.map((slot) => ({
                      worker: slot.index,
                      activeTask: slot.active?.id ?? null,
                      retained: tasks.filter((task) => task.owner === slot.index && !task.completed)
                        .length,
                      deferredQueued: pending.filter(
                        (task) => task.owner === slot.index && task.deferred
                      ).length,
                    })),
                    initialization: ready.map(({ prepareMs, wasmInitMs }) => ({
                      prepareMs,
                      wasmInitMs,
                    })),
                    topTasks,
                    trace: options.trace
                      ? tasks.flatMap((task) =>
                          task.trace.map((sample) => ({
                            task: task.id,
                            archetypes: task.archetypes,
                            ...sample,
                          }))
                        )
                      : undefined,
                  });
                };
                const priority = (task) =>
                  source.sources.reduce(
                    (sum, names, slot) =>
                      sum +
                      Number(
                        task.archetypeCounts
                          ? task.archetypes.some((name) => names.includes(name))
                          : task.archetypes[slot] === undefined
                            ? names.length > 0
                            : names.includes(task.archetypes[slot])
                      ),
                    0
                  ) >= 3;
                const dispatch = (slot) => {
                  if (ended) return;
                  const held = tasks.filter(
                    (task) => task.owner === slot.index && !task.completed
                  ).length;
                  const available = (task) =>
                    task.owner === null
                      ? task.archetypes.length < 5 || held < 4
                      : task.owner === slot.index;
                  let index = pending.findIndex((task) => !task.deferred && available(task));
                  if (index < 0) index = pending.findIndex(available);
                  if (index < 0) {
                    slot.active = null;
                    if (!pending.length && slots.every((entry) => entry.active === null))
                      finish("exhausted");
                    return;
                  }
                  const task = pending.splice(index, 1)[0];
                  slot.active = task;
                  task.sliceStart = task.feasible;
                  task.deferred = false;
                  if (task.slices++) resumes++;
                  if (task.archetypes.length === 5) task.owner = slot.index;
                  const remaining = Math.max(
                    1,
                    options.seconds * 1000 - (performance.now() - started)
                  );
                  slot.worker.postMessage({
                    type: "task",
                    id: task.id,
                    archetypes: task.archetypes,
                    tertiaries: task.tertiaries,
                    excludedArrangements: task.excludedArrangements,
                    knownKeys: options.variant === "shared-exclusions" ? [...unique] : undefined,
                    budgetMs: Math.min(
                      task.archetypes.length < 5 ? 2000 : options.sliceMs,
                      remaining
                    ),
                  });
                };
                slots.forEach((slot) => {
                  slot.worker.onerror = (event) => {
                    if (!ended) {
                      ended = true;
                      clearTimeout(timer);
                      slots.forEach((entry) => entry.worker.terminate());
                      reject(new Error(event.message));
                    }
                  };
                  slot.worker.onmessage = ({ data }) => {
                    if (ended) return;
                    if (data.type === "error" || data.error) {
                      slot.worker.onerror({ message: data.error });
                      return;
                    }
                    const task = slot.active;
                    if (!task || task.id !== data.id) return;
                    const metrics = data.metrics;
                    for (const key of [
                      "solves",
                      "retries",
                      "serializeMs",
                      "solveMs",
                      "validateMs",
                      "iteratorMs",
                    ])
                      task[key] += metrics[key];
                    for (const key of ["maxVariables", "maxConstraints", "maxLpBytes"])
                      task[key] = Math.max(task[key], metrics[key]);
                    for (const key of ["statuses", "retryReasons", "timeouts"])
                      for (const [name, count] of Object.entries(metrics[key]))
                        task[key][name] = (task[key][name] || 0) + count;
                    if (options.trace) task.trace.push(...metrics.trace);
                    for (const key of data.keys) {
                      discoveries++;
                      if (unique.has(key)) duplicateDiscoveries++;
                      else {
                        unique.add(key);
                        task.unique++;
                      }
                    }
                    task.feasible = data.feasible;
                    if (data.type !== "done") return;
                    slot.active = null;
                    if (
                      !data.children &&
                      (data.stopReason === "slice" ||
                        (task.archetypes.length === 5 && data.stopReason === "budget"))
                    ) {
                      task.deferred = !!data.deferred || task.feasible <= task.sliceStart;
                      if (task.deferred) task.deferrals++;
                      pending.push(task);
                    } else {
                      task.completed = true;
                      completedTasks++;
                      if (
                        data.children ||
                        (data.stopReason === "budget" && task.archetypes.length < 5)
                      ) {
                        const childTasks =
                          data.children ??
                          source.choices[task.archetypes.length].map((archetype) => ({
                            archetypes: [...task.archetypes, archetype],
                          }));
                        for (const childTask of childTasks) {
                          const child = {
                            ...task,
                            id: tasks.length,
                            archetypes: childTask.archetypes,
                            archetypeCounts: childTask.archetypeCounts,
                            tertiaries: childTask.tertiaries,
                            excludedArrangements: childTask.excludedArrangements,
                            owner: null,
                            deferred: false,
                            feasible: 0,
                            slices: 0,
                            deferrals: 0,
                            completed: false,
                            unique: 0,
                            solves: 0,
                            retries: 0,
                            serializeMs: 0,
                            solveMs: 0,
                            validateMs: 0,
                            iteratorMs: 0,
                            maxVariables: 0,
                            maxConstraints: 0,
                            maxLpBytes: 0,
                            statuses: {},
                            retryReasons: {},
                            timeouts: {},
                            trace: [],
                          };
                          tasks.push(child);
                          pending.push(child);
                        }
                        if (source.prioritizeMatches)
                          pending.sort(
                            (first, second) => Number(priority(second)) - Number(priority(first))
                          );
                      }
                    }
                    dispatch(slot);
                    slots.filter((entry) => entry.active === null).forEach(dispatch);
                  };
                });
                slots.forEach(dispatch);
              });
            },
            { input, workers, variant, seconds, sliceMs, retryLimit, task, trace: values.trace }
          );
          await context.close();
          const signals = [];
          const totalMs = Math.max(1, result.totals.iteratorMs);
          if (result.totals.retries / Math.max(1, result.totals.solves) >= 0.2)
            signals.push(
              "High retry share: inspect retryReasons, statuses, timeout histogram and slow tasks before increasing limits."
            );
          if (result.duplicateDiscoveries / Math.max(1, result.discoveries) >= 0.2)
            signals.push(
              "High duplicate share: investigate shared arrangement exclusions or less-overlapping task partitions."
            );
          if (result.totals.serializeMs / totalMs >= 0.2)
            signals.push(
              "LP serialization is significant: investigate sparse/incremental LP construction."
            );
          if (result.overheadMs / totalMs >= 0.2)
            signals.push(
              "Search overhead is significant: inspect pruning, exclusion construction and snapshot copying outside HiGHS."
            );
          if (result.totals.solveMs / totalMs >= 0.7)
            signals.push(
              "HiGHS dominates worker time: compare model size/objective variants and concurrency before optimizing the UI."
            );
          if (!signals.length)
            signals.push(
              "No single threshold dominates; use longer repeated real-input runs and compare per-task throughput."
            );
          report.runs.push({ repetition: repetition + 1, ...result, signals });
          console.log(
            `${result.uniqueArrangements} unique, ${result.arrangementsPerSecond.toFixed(2)}/s, ${result.totals.retries}/${result.totals.solves} retries, ${result.deferredQueued} deferred queued`
          );
          signals.forEach((signal) => console.log(`  ${signal}`));
          await fs.writeFile(path.resolve(values.output), JSON.stringify(report, null, 2));
        }
    }
    console.table(
      report.runs.map((run) => ({
        variant: run.variant,
        workers: run.workers,
        repetition: run.repetition,
        unique: run.uniqueArrangements,
        perSecond: run.arrangementsPerSecond.toFixed(2),
        retries: run.totals.retries,
        solveMs: Math.round(run.totals.solveMs),
        serializeMs: Math.round(run.totals.serializeMs),
        overheadMs: Math.round(run.overheadMs),
        duplicates: run.duplicateDiscoveries,
      }))
    );
    console.log(`Report: ${path.resolve(values.output)}`);
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise((resolve) => server.close(resolve));
    await fs.rm(directory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
