import { BuildConfiguration } from "../src/app/data/buildConfiguration";
import { ArmorStat } from "../src/app/data/enum/armor-stat";
import {
  createT5ProfileInput,
  createT5SearchTasks,
  createT5ArchetypeCountTasks,
  createT5TertiaryTasks,
  prioritizeT5SearchTasks,
  T5ProfileInput,
  T5SearchRequest,
  T5SearchUpdate,
  T5Arrangement,
} from "../src/app/data/theorizer";
import {
  initializeT5Optimizer,
  solveT5Optimization,
  T5SolveProfile,
  excludeT5Arrangement,
  t5RollStats,
} from "../src/app/services/theorizer-model";
import {
  buildT5Domains,
  prepareT5Search,
  PreparedT5Search,
  searchT5,
} from "../src/app/services/theorizer-search";

interface Metrics {
  solves: number;
  retries: number;
  serializeMs: number;
  solveMs: number;
  validateMs: number;
  iteratorMs: number;
  maxVariables: number;
  maxConstraints: number;
  maxLpBytes: number;
  statuses: Record<string, number>;
  retryReasons: Record<string, number>;
  timeouts: Record<string, number>;
  trace: T5SolveProfile[];
}

const emptyMetrics = (): Metrics => ({
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
});
const increment = (counts: Record<string, number>, key: string) => {
  counts[key] = (counts[key] ?? 0) + 1;
};

interface Context {
  iterator: Generator<T5SearchUpdate>;
  request: T5SearchRequest;
  metrics: Metrics;
  delivered: Set<string>;
  keys: string[];
  retries: number;
  lastSample?: T5SolveProfile;
}

let base: T5SearchRequest;
let prepared: PreparedT5Search;
let variant = "current";
let trace = false;
let retryLimit = 3;
const contexts = new Map<number, Context>();
const sharedArrangements = new Map<string, T5Arrangement>();

function fixture(): T5ProfileInput {
  const config = BuildConfiguration.buildEmptyConfiguration();
  config.characterClass = 0;
  config.selectedExotics = [-1];
  config.calculateTierFiveTuning = true;
  config.minimumStatTiers[ArmorStat.StatGrenade].value = 20;
  config.minimumStatTiers[ArmorStat.StatClass].value = 10;
  const inventory = [1, 2, 3, 4, 5].map((slot) => ({
    id: slot,
    hash: slot,
    name: "",
    icon: "",
    description: "",
    slot,
    clazz: 0,
    isExotic: 0 as const,
    rarity: 5,
    armorSystem: 3,
    tier: 5,
    isFeatured: false,
    gearSetHash: null,
    gearSetPerkSelectable: false,
    watermarkIcon: "",
    perk: 0,
    exoticPerkHash: [],
    isSunset: false,
    itemType: 2,
    itemSubType: 0,
    investmentStats: [],
    socketEntries: [],
    itemInstanceId: `fixture-${slot}`,
    energyLevel: 10,
    masterworkLevel: 5,
    archetypeStats: [2, 3, 4],
    mobility: 0,
    resilience: 0,
    recovery: 20,
    discipline: 30,
    intellect: 25,
    strength: 0,
    source: 0,
    tuningStat: 2,
    created_at: 0,
    updated_at: 0,
  }));
  return createT5ProfileInput({ config, inventory, manifest: inventory, achievableOnly: false });
}

function makeContext(
  id: number,
  archetypes: string[],
  budgetMs: number,
  extra?: Pick<NonNullable<T5SearchRequest["task"]>, "tertiaries" | "excludedArrangements">
): Context {
  const request: T5SearchRequest = {
    ...base,
    task: {
      archetypes,
      archetypeCounts: variant !== "ordered-prefixes" && variant !== "shared-exclusions",
      ...extra,
    },
    timeLimitMs: budgetMs,
    stage: "arrangements",
    skipMaxima: true,
  };
  let context: Context;
  let priorityApplied = false;
  const appliedShared = new Set<string>();
  const prefixCounts = new Map<string, number>();
  for (const name of archetypes) prefixCounts.set(name, (prefixCounts.get(name) ?? 0) + 1);
  const solve: Parameters<typeof searchT5>[1] = (problem) => {
    if (variant === "shared-exclusions") {
      const available = new Set(problem.rolls.map((roll) => roll.item.archetype));
      for (const [key, arrangement] of sharedArrangements) {
        if (
          appliedShared.has(key) ||
          context.delivered.has(key) ||
          arrangement.archetypes.some((entry) => !available.has(entry.name)) ||
          [...prefixCounts].some(
            ([name, count]) =>
              (arrangement.archetypes.find((entry) => entry.name === name)?.count ?? 0) < count
          )
        )
          continue;
        excludeT5Arrangement(problem, arrangement, 1000000 + appliedShared.size);
        appliedShared.add(key);
      }
    }
    if (variant === "inventory-priority" && !priorityApplied) {
      const profile = (item: Parameters<typeof t5RollStats>[0]) =>
        JSON.stringify([
          item.archetype,
          item.tertiary,
          item.isExotic,
          t5RollStats(item, base.config),
        ]);
      const sources = prepared.domains.map(
        (domain) =>
          new Set(
            [...domain.values()]
              .flat()
              .filter((item) => !!item.instanceId)
              .map(profile)
          )
      );
      for (const roll of problem.rolls) {
        const coefficients = problem.model.variables[roll.name];
        if (sources[roll.slot].has(profile(roll.item))) coefficients["score"] += 1000;
      }
      priorityApplied = true;
    }
    return solveT5Optimization(problem, (sample) => {
      context.lastSample = sample;
      const metrics = context.metrics;
      metrics.solves++;
      metrics.serializeMs += sample.serializeMs;
      metrics.solveMs += sample.solveMs;
      metrics.validateMs += sample.validateMs;
      metrics.maxVariables = Math.max(metrics.maxVariables, sample.variables);
      metrics.maxConstraints = Math.max(metrics.maxConstraints, sample.constraints);
      metrics.maxLpBytes = Math.max(metrics.maxLpBytes, sample.lpBytes);
      increment(metrics.statuses, sample.status);
      increment(metrics.timeouts, String(Math.round(sample.timeoutMs)));
      if (trace) metrics.trace.push(sample);
    });
  };
  context = {
    request,
    metrics: emptyMetrics(),
    delivered: new Set<string>(),
    keys: [],
    retries: 0,
    iterator: searchT5(
      request,
      solve,
      prepared,
      archetypes.length === 5 &&
        variant !== "no-resume" &&
        (variant === "ordered-prefixes" || variant === "shared-exclusions" || !!extra?.tertiaries)
        ? { maxRetriesWithoutProgress: retryLimit }
        : undefined
    ),
  };
  contexts.set(id, context);
  return context;
}

function retryReason(sample?: T5SolveProfile): string {
  if (!sample) return "unknown";
  if (sample.hasPrimal && !sample.integral) return "nonintegral-primal-values";
  if (sample.hasPrimal && !sample.feasible) return "constraint-rejected-primal-values";
  if (/time|limit/i.test(sample.status))
    return sample.hasPrimal ? "limit-without-usable-witness" : "limit-without-primal-values";
  return sample.feasible ? "no-five-piece-witness" : "no-usable-witness";
}

addEventListener("message", async ({ data }) => {
  try {
    if (data.type === "init") {
      const input: T5ProfileInput = data.input ?? fixture();
      if (input.schemaVersion !== 1) throw new Error("Unsupported profiling-input version.");
      variant = data.variant;
      trace = data.trace;
      retryLimit = data.retryLimit;
      base = {
        ...input.request,
        timeLimitMs: 4000,
        stage: "arrangements",
        skipMaxima: true,
        wasmUrl: new URL("/assets/highs.wasm", location.href).href,
      };
      let started = performance.now();
      prepared = prepareT5Search(base);
      const prepareMs = performance.now() - started;
      started = performance.now();
      await initializeT5Optimizer(base.wasmUrl);
      const wasmInitMs = performance.now() - started;
      const domains = buildT5Domains(base);
      const choices = domains.map((domain) => [...domain.keys()]);
      const sources = domains.map((domain) =>
        [...domain]
          .filter(([, pieces]) => pieces.some((piece) => !!piece.instanceId))
          .map(([name]) => name)
      );
      const rawTasks =
        data.index === 0
          ? variant !== "ordered-prefixes" && variant !== "shared-exclusions"
            ? createT5ArchetypeCountTasks([...prepared.archetypeDomains.keys()])
            : createT5SearchTasks(choices)
          : [];
      const tasks =
        data.index === 0
          ? variant === "no-task-priority" || input.request.prioritizeMatches === false
            ? rawTasks
            : prioritizeT5SearchTasks(
                rawTasks,
                sources.map((names) => new Set(names))
              )
          : [];
      postMessage({
        type: "ready",
        prepareMs,
        wasmInitMs,
        tasks,
        choices,
        sources,
        archetypes: [...prepared.archetypeDomains.keys()],
        countTasks: variant !== "ordered-prefixes" && variant !== "shared-exclusions",
        prioritizeMatches:
          variant !== "no-task-priority" && (input.request.prioritizeMatches ?? true),
      });
      return;
    }
    if (variant === "shared-exclusions")
      for (const key of data.knownKeys ?? []) {
        if (sharedArrangements.has(key)) continue;
        const [archetypes, tertiaries, tunings] = JSON.parse(key) as [
          [string, number][],
          [ArmorStat | null, number][],
          [ArmorStat | null, number][],
        ];
        sharedArrangements.set(key, {
          key,
          archetypes: archetypes.map(([name, count]) => ({
            name,
            count,
            primary: null,
            secondary: null,
          })),
          tertiaries: tertiaries.map(([stat, count]) => ({ stat, count })),
          tunings: tunings.map(([stat, count]) => ({ stat, count })),
          builds: [],
          covered: 0,
          owned: 0,
        });
      }
    const context =
      contexts.get(data.id) ??
      makeContext(data.id, data.archetypes, data.budgetMs, {
        tertiaries: data.tertiaries,
        excludedArrangements: data.excludedArrangements,
      });
    context.request.timeLimitMs = data.budgetMs;
    let lastPublish = performance.now();
    const send = (type: string, update: T5SearchUpdate) => {
      const children =
        type === "done" &&
        update.stopReason === "budget" &&
        context.request.task?.archetypeCounts &&
        !context.request.task.tertiaries
          ? createT5TertiaryTasks(
              { ...context.request.task, excludedArrangements: update.arrangements },
              new Map(
                [...prepared.archetypeDomains].map(([name, pieces]) => [
                  name,
                  [...new Set(pieces.map((piece) => piece.tertiary))],
                ])
              )
            )
          : undefined;
      postMessage({
        type,
        id: data.id,
        metrics: context.metrics,
        keys: context.keys,
        feasible: update.feasible,
        stopReason: update.stopReason,
        complete: update.complete,
        deferred: update.taskDeferred,
        error: update.error,
        children,
      });
      context.metrics = emptyMetrics();
      context.keys = [];
      lastPublish = performance.now();
    };
    while (true) {
      const started = performance.now();
      const next = context.iterator.next();
      context.metrics.iteratorMs += performance.now() - started;
      if (next.done) throw new Error("Discovery ended without a final update.");
      const update = next.value;
      const retries = (update.solverRetries ?? 0) - context.retries;
      if (retries > 0) {
        context.metrics.retries += retries;
        increment(context.metrics.retryReasons, retryReason(context.lastSample));
      }
      context.retries = update.solverRetries ?? 0;
      for (const arrangement of update.arrangements ?? []) {
        if (!context.delivered.has(arrangement.key)) {
          context.delivered.add(arrangement.key);
          context.keys.push(arrangement.key);
        }
      }
      if (update.done) {
        send("done", update);
        if (update.stopReason !== "slice") {
          context.iterator.return(undefined);
          contexts.delete(data.id);
        }
        break;
      }
      if (performance.now() - lastPublish >= 250) send("progress", update);
    }
  } catch (error) {
    postMessage({
      type: "error",
      id: data.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
