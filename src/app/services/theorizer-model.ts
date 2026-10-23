import { BuildConfiguration } from "../data/buildConfiguration";
import { FORCE_USE_NO_EXOTIC } from "../data/constants";
import { ModInformation } from "../data/ModInformation";
import {
  ArmorPerkOrSlot,
  ArmorStat,
  SpecialArmorStat,
  STAT_MOD_VALUES,
  StatModifier,
} from "../data/enum/armor-stat";
import {
  T5Arrangement,
  T5Candidate,
  T5Solution,
  T5_TUNING_HASHES,
  t5TuningFamily,
  T5_ARCHETYPES,
  t5BaseStats,
  t5Tertiaries,
} from "../data/theorizer";
import { InventoryArmorSource } from "../data/types/IInventoryArmor";
import { Tuning } from "../data/types/IPermutatorArmorSet";
import { t5ExactLimits } from "./theorizer-exact-limits";

interface ModelDefinition {
  optimize: string;
  opType: "max" | "min";
  constraints: Record<string, { min?: number; max?: number; equal?: number }>;
  variables: Record<string, Record<string, number>>;
  binaries?: Record<string, number>;
  ints?: Record<string, number>;
  options?: { timeout?: number; exitOnCycles?: boolean };
}

interface SolveResult {
  feasible: boolean;
  result: number;
  [name: string]: number | boolean | undefined;
}

let highs: Awaited<ReturnType<(typeof import("highs"))["default"]>> | undefined;
let highsLoading: Promise<void> | undefined;

export interface T5SolveProfile {
  status: string;
  serializeMs: number;
  solveMs: number;
  validateMs: number;
  timeoutMs: number;
  variables: number;
  constraints: number;
  lpBytes: number;
  hasPrimal: boolean;
  integral: boolean;
  feasible: boolean;
}

export function initializeT5Optimizer(
  wasmUrl = new URL("assets/highs.wasm", globalThis.location.href).href
): Promise<void> {
  return (highsLoading ??= (async () => {
    const moduleUrl = new URL("highs.mjs", new URL(wasmUrl, globalThis.location.href)).href;
    const { default: load } = await import(/* webpackIgnore: true */ moduleUrl);
    highs = await load({ locateFile: () => wasmUrl });
  })());
}

function solveModel(
  model: ModelDefinition,
  profile?: (sample: T5SolveProfile) => void
): SolveResult {
  if (!highs) throw new Error("The T5 optimizer has not initialized.");
  const started = profile ? performance.now() : 0;
  const variables = Object.keys(model.variables);
  const expression = (attribute: string) =>
    variables
      .flatMap((name) => {
        const value = model.variables[name][attribute] ?? 0;
        return value ? [`${value < 0 ? "-" : "+"} ${Math.abs(value)} ${name}`] : [];
      })
      .join(" ") || `0 ${variables[0]}`;
  const objective =
    typeof model.optimize === "string" ? model.optimize : Object.keys(model.optimize)[0];
  const lines = [
    model.opType === "min" ? "Minimize" : "Maximize",
    ` objective: ${expression(objective)}`,
    "Subject To",
  ];
  for (const [name, bound] of Object.entries(model.constraints)) {
    if (typeof bound === "string") continue;
    if (bound.equal !== undefined) lines.push(` ${name}: ${expression(name)} = ${bound.equal}`);
    else {
      if (bound.min !== undefined) lines.push(` ${name}_min: ${expression(name)} >= ${bound.min}`);
      if (bound.max !== undefined) lines.push(` ${name}_max: ${expression(name)} <= ${bound.max}`);
    }
  }
  lines.push(
    "Bounds",
    ...variables.map((name) => ` 0 <= ${name}${model.binaries?.[name] ? " <= 1" : ""}`)
  );
  const integers = Object.keys(model.ints ?? {});
  const binaries = Object.keys(model.binaries ?? {});
  if (integers.length) lines.push("General", ` ${integers.join(" ")}`);
  if (binaries.length) lines.push("Binary", ` ${binaries.join(" ")}`);
  lines.push("End");
  const lp = lines.join("\n");
  const serialized = profile ? performance.now() : 0;
  const solution = highs.solve(lp, {
    time_limit: (model.options?.timeout ?? 150) / 1000,
    output_flag: false,
  });
  const solvedAt = profile ? performance.now() : 0;
  const values: Record<string, number> = {};
  if ("Columns" in solution) {
    for (const [name, column] of Object.entries(solution.Columns)) {
      if ("Primal" in column) values[name] = column.Primal;
    }
  }
  const integral = [...Object.keys(model.ints ?? {}), ...Object.keys(model.binaries ?? {})].every(
    (name) => Math.abs((values[name] ?? 0) - Math.round(values[name] ?? 0)) < 0.00001
  );
  const feasible =
    integral &&
    Object.entries(model.constraints).every(([name, bound]) => {
      if (typeof bound === "string") return true;
      const value = variables.reduce(
        (sum, variable) => sum + (model.variables[variable][name] ?? 0) * (values[variable] ?? 0),
        0
      );
      return (
        (bound.equal === undefined || Math.abs(value - bound.equal) < 0.00001) &&
        (bound.min === undefined || value >= bound.min - 0.00001) &&
        (bound.max === undefined || value <= bound.max + 0.00001)
      );
    });
  const result: SolveResult = {
    ...values,
    feasible,
    result: solution.ObjectiveValue ?? 0,
    bounded: true,
    isIntegral: integral,
    optimal: solution.Status === "Optimal" || solution.Status === "Infeasible",
  };
  profile?.({
    status: solution.Status,
    serializeMs: serialized - started,
    solveMs: solvedAt - serialized,
    validateMs: performance.now() - solvedAt,
    timeoutMs: model.options?.timeout ?? 150,
    variables: variables.length,
    constraints: Object.keys(model.constraints).length,
    lpBytes: lp.length,
    hasPrimal: Object.keys(values).length > 0,
    integral,
    feasible,
  });
  return result;
}

export function t5StatBonuses(config: BuildConfiguration): number[] {
  const bonuses = Array<number>(6).fill(0);
  for (const mod of config.enabledMods) {
    for (const bonus of ModInformation[mod].bonus) {
      const stat =
        bonus.stat === SpecialArmorStat.ClassAbilityRegenerationStat
          ? [ArmorStat.StatHealth, ArmorStat.StatWeapon, ArmorStat.StatClass][config.characterClass]
          : bonus.stat;
      bonuses[stat] += bonus.value;
    }
  }
  return bonuses;
}

export interface T5TargetLimits {
  status: "feasible" | "infeasible" | "unknown";
  maximum: number[];
  maximumComplete: boolean;
}

export interface T5LimitsRequest {
  id: number;
  config: BuildConfiguration;
  validateOnly: boolean;
  wasmUrl: string;
  /** Skip the HiGHS preview and optimizer load; only the exact limits are computed. */
  exactOnly?: boolean;
  /** Defaults to true; false models builds without T5 tuning. */
  tuning?: boolean;
}

export interface T5LimitsReply extends T5TargetLimits {
  id: number;
  error?: string;
  /** Fast lower bounds from a model without balanced rolls; the exact reply follows. */
  preview?: boolean;
}

export function createT5TargetModel(
  config: BuildConfiguration,
  includeBalanced = true
): ModelDefinition {
  const bonuses = t5StatBonuses(config);
  const model: ModelDefinition = {
    optimize: "score",
    opType: "max",
    constraints: {
      pieces: { equal: 5 },
      tuningSlots: { max: 5 },
      directions: { equal: 0 },
      mods: { max: config.statModLimits.maxMods },
      major: { max: Math.min(config.statModLimits.maxMods, config.statModLimits.maxMajorMods) },
    },
    variables: {},
    ints: {},
    options: { timeout: 1000 },
  };
  const maxMods = Math.max(0, config.statModLimits.maxMods);
  const maxMajorMods = Math.max(0, Math.min(maxMods, config.statModLimits.maxMajorMods));
  // Five balanced, masterworked pieces contribute 465 points; mods add 5 per slot plus 5 per major.
  const totalStatBudget = 465 + 5 * maxMods + 5 * maxMajorMods;
  const targetMinimums = Array.from({ length: 6 }, (_, stat) =>
    Math.max(0, Math.round(config.minimumStatTiers[stat as ArmorStat].value * 10) - bonuses[stat])
  );
  const targetMaximums = targetMinimums.map(
    (_, stat) =>
      totalStatBudget -
      targetMinimums.reduce((sum, minimum, other) => sum + (other === stat ? 0 : minimum), 0)
  );
  const add = (name: string, values: Record<string, number>) => {
    model.variables[name] = values;
    model.ints![name] = 1;
  };
  for (const [index, archetype] of T5_ARCHETYPES.entries()) {
    for (const tertiary of t5Tertiaries(archetype)) {
      const base = t5BaseStats(archetype, tertiary);
      for (const balanced of includeBalanced ? [false, true] : [false]) {
        const values: Record<string, number> = { pieces: 1, tuningSlots: Number(balanced) };
        base.forEach((value, stat) => {
          values[`stat_${stat}`] = value || 5 + Number(balanced);
        });
        add(`roll_${index}_${tertiary}_${Number(balanced)}`, values);
      }
    }
  }
  for (let stat = 0; stat < 6; stat++) {
    const target = config.minimumStatTiers[stat as ArmorStat];
    model.constraints[`stat_${stat}`] = target.fixed
      ? {
          equal: Math.round(target.value * 10) - bonuses[stat],
          max: targetMaximums[stat],
        }
      : {
          min: Math.round(target.value * 10) - bonuses[stat],
          max: targetMaximums[stat],
        };
    model.constraints[`distinct_${stat}`] = { max: 0 };
    const up: Record<string, number> = { [`stat_${stat}`]: 5, tuningSlots: 1, directions: 1 };
    for (let other = 0; other < 6; other++) up[`distinct_${other}`] = other === stat ? 0 : -1;
    add(`up_${stat}`, up);
    add(`down_${stat}`, { [`stat_${stat}`]: -5, directions: -1, [`distinct_${stat}`]: 1 });
    add(`minor_${stat}`, { [`stat_${stat}`]: 5, mods: 1 });
    add(`major_${stat}`, { [`stat_${stat}`]: 10, mods: 1, major: 1 });
  }
  for (const variable of Object.values(model.variables)) {
    variable["totalStatPoints"] = Array.from(
      { length: 6 },
      (_, stat) => variable[`stat_${stat}`] ?? 0
    ).reduce((sum, value) => sum + value, 0);
  }
  model.constraints["totalStatPoints"] = { max: totalStatBudget };
  return model;
}

export function t5PreviewLimits(config: BuildConfiguration): number[] | null {
  const model = createT5TargetModel(config, false);
  const bonuses = t5StatBonuses(config);
  const maximum = Array<number>(6).fill(0);
  const deadline = performance.now() + 600;
  model.options = { ...model.options, timeout: 300 };
  for (let stat = 0; stat < 6; stat++) {
    const selectedTarget = config.minimumStatTiers[stat as ArmorStat];
    if (selectedTarget.fixed) {
      maximum[stat] = Math.round(selectedTarget.value * 10);
      continue;
    }
    const constraint = model.constraints[`stat_${stat}`];
    model.constraints[`stat_${stat}`] = { min: -bonuses[stat], max: constraint.max };
    model.optimize = `stat_${stat}`;
    const solved = solveModel(model);
    model.constraints[`stat_${stat}`] = constraint;
    if (!solved.feasible || !solved["optimal"] || performance.now() > deadline) return null;
    maximum[stat] = Math.max(0, Math.min(200, Math.round(solved.result + bonuses[stat])));
  }
  return maximum;
}

export function t5TargetLimits(
  config: BuildConfiguration,
  validateOnly = false,
  tuning = true
): T5TargetLimits {
  const bonuses = t5StatBonuses(config);
  const stats = [0, 1, 2, 3, 4, 5] as ArmorStat[];
  const exact = t5ExactLimits(
    {
      minimums: stats.map(
        (stat) => Math.round(config.minimumStatTiers[stat].value * 10) - bonuses[stat]
      ),
      fixed: stats.map((stat) => config.minimumStatTiers[stat].fixed),
      maxMods: config.statModLimits.maxMods,
      maxMajorMods: config.statModLimits.maxMajorMods,
      tuning,
    },
    bonuses,
    stats.map((stat) => Math.round(config.minimumStatTiers[stat].value * 10)),
    validateOnly
  );
  if (exact)
    return {
      status: exact.feasible ? "feasible" : "infeasible",
      maximum: exact.maximum,
      maximumComplete: exact.feasible && !validateOnly,
    };
  const model = createT5TargetModel(config);
  if (validateOnly) model.options = { ...model.options, timeout: 5000 };
  const maximum = Array<number>(6).fill(0);
  const feasible = solveModel(model);
  if (!feasible.feasible)
    return {
      status: feasible["optimal"] ? "infeasible" : "unknown",
      maximum,
      maximumComplete: false,
    };
  if (validateOnly) return { status: "feasible", maximum, maximumComplete: false };
  for (let stat = 0; stat < 6; stat++) {
    const constraint = model.constraints[`stat_${stat}`];
    const selectedTarget = config.minimumStatTiers[stat as ArmorStat];
    if (selectedTarget.fixed) {
      maximum[stat] = Math.round(selectedTarget.value * 10);
      continue;
    }
    model.constraints[`stat_${stat}`] = { min: -bonuses[stat], max: constraint.max };
    model.optimize = `stat_${stat}`;
    model.options = {
      ...model.options,
      timeout: config.statModLimits.maxMods > 0 && selectedTarget.value === 0 ? 30000 : 1000,
    };
    const solved = solveModel(model);
    model.options = { ...model.options, timeout: 1000 };
    model.constraints[`stat_${stat}`] = constraint;
    if (!solved.feasible || !solved["optimal"])
      return { status: "feasible", maximum, maximumComplete: false };
    maximum[stat] = Math.max(0, Math.min(200, Math.round(solved.result + bonuses[stat])));
  }
  return { status: "feasible", maximum, maximumComplete: true };
}

export function t5RollStats(item: T5Candidate, config: BuildConfiguration): number[] {
  const base = [
    item.resilience,
    item.strength,
    item.discipline,
    item.intellect,
    item.recovery,
    item.mobility,
  ];
  const masterwork = (
    item.isExotic ? config.assumeExoticsMasterworked : config.assumeLegendariesMasterworked
  )
    ? 5
    : item.masterworkLevel;
  return base.map((value, stat) => value + (item.archetypeStats.includes(stat) ? 0 : masterwork));
}

function balancedStats(item: T5Candidate): number[] {
  const stats = [
    item.resilience,
    item.strength,
    item.discipline,
    item.intellect,
    item.recovery,
    item.mobility,
  ];
  const order = [0, 1, 2, 3, 4, 5].sort(
    (first, second) => stats[first] - stats[second] || first - second
  );
  return stats.map((_, stat) => (order.slice(0, 3).includes(stat) ? 1 : 0));
}

interface RollVariable {
  name: string;
  slot: number;
  item: T5Candidate;
  balanced: boolean;
  stats: number[];
}

export interface T5OptimizationModel {
  model: ModelDefinition;
  rolls: RollVariable[];
  bonuses: number[];
  config: BuildConfiguration;
}

export function createT5OptimizationModel(
  domains: readonly (readonly T5Candidate[])[],
  config: BuildConfiguration
): T5OptimizationModel {
  const bonuses = t5StatBonuses(config);
  const model: ModelDefinition = {
    optimize: "score",
    opType: "max",
    constraints: {},
    variables: {},
    binaries: {},
    ints: {},
    options: { timeout: 150, exitOnCycles: true },
  };
  const rolls: RollVariable[] = [];
  const add = (name: string, coefficients: Record<string, number>, binary = false) => {
    model.variables[name] = coefficients;
    if (binary) model.binaries![name] = 1;
    else model.ints![name] = 1;
  };
  model.constraints["exotic"] =
    config.selectedExotics.length && !config.selectedExotics.includes(FORCE_USE_NO_EXOTIC)
      ? { equal: 1 }
      : { max: 1 };
  model.constraints["mods"] = { max: config.statModLimits.maxMods };
  model.constraints["major"] = {
    max: Math.min(config.statModLimits.maxMods, config.statModLimits.maxMajorMods),
  };
  model.constraints["artifice"] = { max: 0 };
  for (let stat = 0; stat < 6; stat++) {
    const target = config.minimumStatTiers[stat as ArmorStat];
    model.constraints[`stat_${stat}`] = target.fixed
      ? { equal: target.value * 10 - bonuses[stat] }
      : { min: target.value * 10 - bonuses[stat] };
    add(`minor_${stat}`, { [`stat_${stat}`]: 5, mods: 1, score: -1 });
    add(`major_${stat}`, { [`stat_${stat}`]: 10, mods: 1, major: 1, score: -1.1 });
    add(`artifice_${stat}`, { [`stat_${stat}`]: 3, artifice: 1, score: -0.01 });
    if (config.onlyShowResultsWithNoWastedStats)
      model.constraints[`cap_${stat}`] = { max: 200 - bonuses[stat] };
  }
  const gearsets = new Map<number, number>();
  for (const requirement of config.armorRequirements) {
    if ("gearSetHash" in requirement)
      gearsets.set(requirement.gearSetHash, (gearsets.get(requirement.gearSetHash) ?? 0) + 1);
  }
  for (const [hash, count] of gearsets) model.constraints[`gear_${hash}`] = { min: count };
  const artificeRequired = config.armorRequirements.filter(
    (requirement) => "perk" in requirement && requirement.perk === ArmorPerkOrSlot.SlotArtifice
  ).length;
  model.constraints["artificeRequired"] = { min: artificeRequired };
  for (let slot = 0; slot < domains.length; slot++) {
    model.constraints[`slot_${slot}`] = { equal: 1 };
    model.constraints[`direction_${slot}`] = { equal: 0 };
    model.constraints[`tuning_${slot}`] = { max: 1 };
    model.constraints[`wild_${slot}`] = { max: 0 };
    for (let stat = 0; stat < 6; stat++) {
      model.constraints[`positive_${slot}_${stat}`] = { max: 0 };
      model.constraints[`distinct_${slot}_${stat}`] = { max: 1 };
      add(
        `up_${slot}_${stat}`,
        {
          [`stat_${stat}`]: 5,
          [`positive_${slot}_${stat}`]: 1,
          [`direction_${slot}`]: 1,
          [`tuning_${slot}`]: 1,
          [`distinct_${slot}_${stat}`]: 1,
          score: -0.001,
        },
        true
      );
      add(
        `down_${slot}_${stat}`,
        { [`stat_${stat}`]: -5, [`direction_${slot}`]: -1, [`distinct_${slot}_${stat}`]: 1 },
        true
      );
    }
    for (const hash of gearsets.keys())
      add(`gear_${slot}_${hash}`, { [`gear_${hash}`]: 1, [`wild_${slot}`]: 1 }, true);
    const equivalentRolls = new Map<string, T5Candidate>();
    for (const item of domains[slot]) {
      const owned =
        !!item.instanceId &&
        (item.source === InventoryArmorSource.Inventory ||
          item.source === InventoryArmorSource.Postmaster);
      const key = JSON.stringify([
        t5RollStats(item, config),
        balancedStats(item),
        item.isExotic,
        item.perk,
        item.gearSetHash,
        item.gearSetPerkSelectable,
        !!item.instanceId,
        owned,
        item.isExotic || item.hypotheticalTuning ? "flexible" : item.tuningStat,
      ]);
      if (!equivalentRolls.has(key)) equivalentRolls.set(key, item);
    }
    const choices = [...equivalentRolls.values()];
    for (let index = 0; index < choices.length; index++) {
      const item = choices[index];
      for (const balanced of [false, true]) {
        const name = `roll_${slot}_${index}_${Number(balanced)}`;
        const base = t5RollStats(item, config);
        if (slot === 2 && !item.isExotic && config.addConstent1Health) base[0]++;
        const stats = base.map((value, stat) => value + (balanced ? balancedStats(item)[stat] : 0));
        const owned =
          !!item.instanceId &&
          (item.source === InventoryArmorSource.Inventory ||
            item.source === InventoryArmorSource.Postmaster);
        const coefficients: Record<string, number> = {
          [`slot_${slot}`]: 1,
          covered: item.instanceId ? 1 : 0,
          exotic: item.isExotic,
          artifice: item.perk === ArmorPerkOrSlot.SlotArtifice ? -1 : 0,
          artificeRequired: item.perk === ArmorPerkOrSlot.SlotArtifice ? 1 : 0,
          [`tuning_${slot}`]: balanced ? 1 : 0,
          [`wild_${slot}`]:
            (!item.instanceId && !item.isExotic) || item.gearSetPerkSelectable ? -1 : 0,
          score: (item.instanceId ? 100000 : 0) + (owned ? 1000 : 0) + (balanced ? 0.001 : 0),
        };
        for (let stat = 0; stat < 6; stat++) {
          coefficients[`stat_${stat}`] = stats[stat];
          if (config.onlyShowResultsWithNoWastedStats) coefficients[`cap_${stat}`] = stats[stat];
          if (
            !balanced &&
            config.calculateTierFiveTuning &&
            (item.isExotic || item.hypotheticalTuning || item.tuningStat === stat)
          ) {
            coefficients[`positive_${slot}_${stat}`] = -1;
          }
        }
        if (item.gearSetHash !== null && !item.gearSetPerkSelectable)
          coefficients[`gear_${item.gearSetHash}`] = 1;
        add(name, coefficients, true);
        rolls.push({ name, slot, item, balanced, stats });
      }
    }
  }
  if (config.onlyShowResultsWithNoWastedStats) {
    for (const coefficients of Object.values(model.variables)) {
      for (let stat = 0; stat < 6; stat++)
        coefficients[`cap_${stat}`] = coefficients[`stat_${stat}`] ?? 0;
    }
  }
  return { model, rolls, bonuses, config };
}

export function solveT5Optimization(
  problem: T5OptimizationModel,
  profile?: (sample: T5SolveProfile) => void
): SolveResult {
  return solveModel(problem.model, profile);
}

export function partitionT5Builds(
  problem: T5OptimizationModel,
  partition: { index: number; count: number }
): void {
  const signature = (roll: RollVariable) =>
    `${roll.item.archetype}:${roll.item.tertiary}:${Number(roll.balanced)}`;
  let multiplier = 1;
  for (const slot of [0, 1, 2]) {
    const rolls = problem.rolls.filter((roll) => roll.slot === slot);
    const keys = [...new Set(rolls.map(signature))];
    for (const roll of rolls) {
      problem.model.variables[roll.name]["buildPartition"] =
        multiplier * keys.indexOf(signature(roll));
    }
    multiplier *= keys.length;
  }
  problem.model.constraints["buildPartition"] = { equal: partition.index };
  problem.model.variables["buildPartitionIndex"] = { buildPartition: -partition.count };
  problem.model.ints!["buildPartitionIndex"] = 1;
}

export function excludeT5Pattern(
  problem: T5OptimizationModel,
  solved: SolveResult,
  index: number
): void {
  const constraint = `pattern_${index}`;
  let selected = 0;
  for (const roll of problem.rolls) {
    if (Number(solved[roll.name] ?? 0) <= 0.5) continue;
    problem.model.variables[roll.name][constraint] = 1;
    selected++;
    if (roll.balanced) continue;
    for (let stat = 0; stat < 6; stat++) {
      const name = `up_${roll.slot}_${stat}`;
      const used = Number(solved[name] ?? 0) > 0.5;
      problem.model.variables[name][constraint] = used ? 1 : -1;
      if (used) selected++;
    }
  }
  problem.model.constraints[constraint] = { max: selected - 1 };
}

export function t5TuningStat(hash: number | null): ArmorStat | null {
  return t5TuningFamily(hash);
}

export function t5StatCeilings(
  domains: readonly (readonly T5Candidate[])[],
  config: BuildConfiguration
): number[] {
  const bounds = t5StatBounds(domains, config);
  const feasible = t5BoundsCanReach(bounds, config);
  const maximum: number[] = Array<number>(6).fill(0);
  for (let stat = 0; stat < 6; stat++) {
    if (!feasible) continue;
    let ceiling = 200;
    for (let mask = 1; mask < 64; mask++) {
      if (!(mask & (1 << stat))) continue;
      let remaining = bounds[mask];
      for (let other = 0; other < 6; other++)
        if (other !== stat && mask & (1 << other)) {
          remaining -= config.minimumStatTiers[other as ArmorStat].value * 10;
        }
      ceiling = Math.min(ceiling, remaining);
    }
    const target = config.minimumStatTiers[stat as ArmorStat];
    maximum[stat] = Math.max(
      0,
      Math.floor(target.fixed ? Math.min(ceiling, target.value * 10) : ceiling)
    );
  }
  return maximum;
}

export function* t5MaximumStatUpdates(
  domains: readonly (readonly T5Candidate[])[],
  config: BuildConfiguration
): Generator<{ values: number[]; checked: number; complete: boolean }> {
  const ceilings = t5StatCeilings(domains, config);
  const problem = createT5OptimizationModel(domains, config);
  const maximum = Array<number>(6).fill(0);
  let complete = true;
  for (let stat = 0; stat < 6; stat++) {
    if (maximum[stat] >= ceilings[stat]) {
      yield { values: [...maximum], checked: stat + 1, complete };
      continue;
    }
    const model: ModelDefinition = structuredClone(problem.model);
    model.options = { ...model.options, timeout: 2000 };
    model.optimize = "verifiedMaximum";
    model.constraints["maximumValue"] = { max: problem.bonuses[stat] };
    model.constraints["maximumCap"] = { max: ceilings[stat] };
    for (const coefficients of Object.values(model.variables)) {
      delete coefficients["score"];
      coefficients["maximumValue"] = -(coefficients[`stat_${stat}`] ?? 0);
    }
    model.variables["reachable_stat_value"] = {
      maximumValue: 1,
      maximumCap: 1,
      verifiedMaximum: 1,
    };
    const solved = solveModel(model);
    const witness = t5OptimizationSolution({ ...problem, model }, solved);
    if (witness) {
      witness.result.statsWithMods.forEach((value, index) => {
        maximum[index] = Math.max(maximum[index], Math.max(0, Math.min(200, value)));
      });
    }
    complete = complete && (solved["optimal"] === true || maximum[stat] >= ceilings[stat]);
    yield { values: [...maximum], checked: stat + 1, complete };
  }
}

export function t5MaximumStats(
  domains: readonly (readonly T5Candidate[])[],
  config: BuildConfiguration
): number[] {
  let maximum: number[] = Array<number>(6).fill(0);
  for (const update of t5MaximumStatUpdates(domains, config)) maximum = update.values;
  return maximum;
}

export function t5OptimizationSolution(
  problem: T5OptimizationModel,
  solved: SolveResult
): T5Solution | null {
  if (!solved.feasible) return null;
  const chosen = problem.rolls
    .filter((roll) => Number(solved[roll.name] ?? 0) > 0.5)
    .sort((first, second) => first.slot - second.slot);
  if (chosen.length !== 5) return null;
  const pieces = chosen.map((roll) => ({ ...roll.item }));
  const tuning = Array<number>(6).fill(0) as Tuning;
  const stats = [...problem.bonuses];
  const statsWithoutMods = Array<number>(6).fill(0);
  const tuningMods: (number | null)[] = [];
  const usedMods: StatModifier[] = [];
  const usedArtifice: StatModifier[] = [];
  for (const roll of chosen) {
    const base = [
      roll.item.resilience,
      roll.item.strength,
      roll.item.discipline,
      roll.item.intellect,
      roll.item.recovery,
      roll.item.mobility,
    ];
    for (let stat = 0; stat < 6; stat++) {
      stats[stat] += roll.stats[stat];
      statsWithoutMods[stat] += base[stat];
    }
    if (roll.balanced) {
      balancedStats(roll.item).forEach((value, stat) => {
        tuning[stat] += value;
      });
      tuningMods.push(3122197216);
    } else {
      const positive = [0, 1, 2, 3, 4, 5].find(
        (stat) => Number(solved[`up_${roll.slot}_${stat}`] ?? 0) > 0.5
      );
      const negative = [0, 1, 2, 3, 4, 5].find(
        (stat) => Number(solved[`down_${roll.slot}_${stat}`] ?? 0) > 0.5
      );
      if (positive !== undefined && negative !== undefined) {
        stats[positive] += 5;
        stats[negative] -= 5;
        tuning[positive] += 5;
        tuning[negative] -= 5;
        tuningMods.push(T5_TUNING_HASHES[positive][negative]);
      } else tuningMods.push(null);
    }
    for (const requirement of problem.config.armorRequirements) {
      if (
        "gearSetHash" in requirement &&
        Number(solved[`gear_${roll.slot}_${requirement.gearSetHash}`] ?? 0) > 0.5
      ) {
        pieces[roll.slot].gearSetHash = requirement.gearSetHash;
        pieces[roll.slot].gearSetPerkSelectable = false;
      }
    }
  }
  for (let stat = 0; stat < 6; stat++) {
    for (const [kind, bonus] of [
      ["minor", 5],
      ["major", 10],
      ["artifice", 3],
    ] as const) {
      const count = Math.round(Number(solved[`${kind}_${stat}`] ?? 0));
      const modifier = Number(
        Object.keys(STAT_MOD_VALUES).find((key) => {
          const value = STAT_MOD_VALUES[Number(key) as StatModifier];
          return value[0] === stat && value[1] === bonus;
        })
      ) as StatModifier;
      for (let index = 0; index < count; index++)
        (bonus === 3 ? usedArtifice : usedMods).push(modifier);
      stats[stat] += count * bonus;
    }
  }
  return {
    key: pieces.map((piece) => piece.archetype).join("|"),
    pieces,
    tuningMods,
    covered: pieces.filter((piece) => piece.instanceId).length,
    owned: pieces.filter(
      (piece) =>
        piece.instanceId &&
        (piece.source === InventoryArmorSource.Inventory ||
          piece.source === InventoryArmorSource.Postmaster)
    ).length,
    result: {
      armor: pieces.map((piece) => piece.id),
      useExoticClassItem: !!pieces[4].isExotic,
      usedMods,
      usedArtifice,
      usedTuningMods: tuningMods.filter((hash): hash is number => hash !== null),
      statsWithMods: stats,
      statsWithoutMods,
      tuning,
    },
  };
}

export function t5StatBounds(
  domains: readonly (readonly T5Candidate[])[],
  config: BuildConfiguration
): number[] {
  const bonuses = t5StatBonuses(config);
  const major = Math.min(config.statModLimits.maxMods, config.statModLimits.maxMajorMods);
  const modBudget = major * 10 + (config.statModLimits.maxMods - major) * 5;
  const bounds = Array<number>(64).fill(0);
  const stats = domains.map((choices, slot) =>
    choices.map((item) => {
      const values = t5RollStats(item, config);
      if (slot === 2 && !item.isExotic && config.addConstent1Health) values[0]++;
      return { item, values, balanced: balancedStats(item) };
    })
  );
  for (let mask = 1; mask < 64; mask++) {
    let withoutExotic = 0;
    let withExotic = -Infinity;
    for (const choices of stats) {
      let legendary = -Infinity;
      let exotic = -Infinity;
      for (const choice of choices) {
        let value = 0;
        let balanced = 0;
        for (let stat = 0; stat < 6; stat++)
          if (mask & (1 << stat)) {
            value += choice.values[stat];
            balanced += choice.balanced[stat];
          }
        const directional =
          config.calculateTierFiveTuning &&
          mask !== 63 &&
          (choice.item.isExotic ||
            choice.item.hypotheticalTuning ||
            (choice.item.tuningStat !== null && mask & (1 << choice.item.tuningStat)))
            ? 5
            : 0;
        value += Math.max(balanced, directional);
        if (choice.item.perk === ArmorPerkOrSlot.SlotArtifice) value += 3;
        if (choice.item.isExotic) exotic = Math.max(exotic, value);
        else legendary = Math.max(legendary, value);
      }
      withExotic = Math.max(withExotic + legendary, withoutExotic + exotic);
      withoutExotic += legendary;
    }
    const requireExotic =
      config.selectedExotics.length && !config.selectedExotics.includes(FORCE_USE_NO_EXOTIC);
    bounds[mask] = (requireExotic ? withExotic : Math.max(withoutExotic, withExotic)) + modBudget;
    for (let stat = 0; stat < 6; stat++) if (mask & (1 << stat)) bounds[mask] += bonuses[stat];
  }
  return bounds;
}

export function t5BoundsCanReach(bounds: readonly number[], config: BuildConfiguration): boolean {
  for (let mask = 1; mask < 64; mask++) {
    let required = 0;
    for (let stat = 0; stat < 6; stat++)
      if (mask & (1 << stat)) required += config.minimumStatTiers[stat as ArmorStat].value * 10;
    if (required > bounds[mask] + 0.00001) return false;
  }
  return true;
}

export function constrainT5ArchetypeCounts(
  problem: T5OptimizationModel,
  archetypes: readonly { name: string; count: number }[]
): void {
  for (let index = 0; index < archetypes.length; index++) {
    const entry = archetypes[index];
    const name = `required_archetype_${index}`;
    problem.model.constraints[name] = { equal: entry.count };
    for (const roll of problem.rolls)
      if (roll.item.archetype === entry.name) problem.model.variables[roll.name][name] = 1;
  }
}

export function constrainT5Arrangement(
  problem: T5OptimizationModel,
  arrangement: T5Arrangement
): void {
  constrainT5ArchetypeCounts(problem, arrangement.archetypes);
  constrainT5TertiaryCounts(problem, arrangement.tertiaries);
  const directionalCount = arrangement.tunings.reduce(
    (sum, entry) => sum + (entry.stat === null ? 0 : entry.count),
    0
  );
  problem.model.constraints["required_tuning_total"] = { equal: directionalCount };
  for (const entry of arrangement.tunings) {
    if (entry.stat !== null)
      problem.model.constraints[`required_tuning_${entry.stat}`] = { equal: entry.count };
  }
  for (let slot = 0; slot < 5; slot++) {
    for (let stat = 0; stat < 6; stat++) {
      const coefficients = problem.model.variables[`up_${slot}_${stat}`];
      coefficients["required_tuning_total"] = 1;
      if (arrangement.tunings.some((entry) => entry.stat === stat))
        coefficients[`required_tuning_${stat}`] = 1;
    }
  }
}

export function constrainT5TertiaryCounts(
  problem: T5OptimizationModel,
  tertiaries: readonly { stat: ArmorStat | null; count: number }[]
): void {
  for (let index = 0; index < tertiaries.length; index++) {
    const entry = tertiaries[index];
    const name = `required_tertiary_${index}`;
    problem.model.constraints[name] = { equal: entry.count };
    for (const roll of problem.rolls)
      if ((roll.item.tertiary ?? null) === entry.stat) problem.model.variables[roll.name][name] = 1;
  }
}

export function excludeT5Arrangement(
  problem: T5OptimizationModel,
  arrangement: T5Arrangement,
  index: number
): void {
  const choice = `different_arrangement_${index}`;
  problem.model.constraints[choice] = { min: 1 };
  const categories: { count: number; terms: [string, number][] }[] = [
    ...arrangement.archetypes.map((entry) => ({
      count: entry.count,
      terms: problem.rolls
        .filter((roll) => roll.item.archetype === entry.name)
        .map((roll): [string, number] => [roll.name, 1]),
    })),
    ...arrangement.tertiaries.map((entry) => ({
      count: entry.count,
      terms: problem.rolls
        .filter((roll) => (roll.item.tertiary ?? null) === entry.stat)
        .map((roll): [string, number] => [roll.name, 1]),
    })),
    ...arrangement.tunings.map((entry) => ({
      count: entry.stat === null ? entry.count - 5 : entry.count,
      terms: Array.from({ length: 5 }, (_, slot) =>
        Array.from({ length: 6 }, (_, stat): [string, number] => [
          `up_${slot}_${stat}`,
          entry.stat === null ? -1 : entry.stat === stat ? 1 : 0,
        ])
      )
        .flat()
        .filter(([, coefficient]) => coefficient !== 0),
    })),
  ];
  categories.forEach((category, position) => {
    const name = `${choice}_${position}`;
    problem.model.constraints[name] = { max: category.count + 5 };
    problem.model.variables[name] = { [name]: 6, [choice]: 1 };
    problem.model.binaries![name] = 1;
    for (const [variable, coefficient] of category.terms)
      problem.model.variables[variable][name] = coefficient;
  });
}
