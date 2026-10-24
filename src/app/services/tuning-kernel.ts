import { StatModifier } from "../data/enum/armor-stat";
import { Tuning } from "../data/types/IPermutatorArmorSet";
import { precalculatedTuningModCombinations } from "../data/generated/precalculatedModCombinationsWithTunings";
import { Kernels, kernels } from "../wasm/kernels";

/** Handle of a tuning set living inside the kernels; scratch unless passed to keepTuningSet(). */
export type TuningSet = number;

const STAT_MODIFIERS: [StatModifier, StatModifier, StatModifier][] = [
  [StatModifier.MINOR_HEALTH, StatModifier.MAJOR_HEALTH, StatModifier.ARTIFICE_HEALTH],
  [StatModifier.MINOR_MELEE, StatModifier.MAJOR_MELEE, StatModifier.ARTIFICE_MELEE],
  [StatModifier.MINOR_GRENADE, StatModifier.MAJOR_GRENADE, StatModifier.ARTIFICE_GRENADE],
  [StatModifier.MINOR_SUPER, StatModifier.MAJOR_SUPER, StatModifier.ARTIFICE_SUPER],
  [StatModifier.MINOR_CLASS, StatModifier.MAJOR_CLASS, StatModifier.ARTIFICE_CLASS],
  [StatModifier.MINOR_WEAPON, StatModifier.MAJOR_WEAPON, StatModifier.ARTIFICE_WEAPON],
];

// region Tuning sets
export function loadTuningSet(tunings: readonly (readonly number[])[]): TuningSet {
  const k = kernels();
  const io = k.io();
  tunings.forEach((tuning, index) => {
    for (let stat = 0; stat < 6; stat++) io[index * 6 + stat] = tuning[stat];
  });
  return k.load(tunings.length);
}

export function singleTuningSet(tuning: readonly number[]): TuningSet {
  const k = kernels();
  k.io().set(tuning);
  return k.single();
}

export function extendTuningSet(
  set: TuningSet,
  options: readonly (readonly number[])[]
): TuningSet {
  const k = kernels();
  const io = k.io();
  options.forEach((option, index) => io.set(option, index * 6));
  return k.extend(set, options.length);
}

/** Highest total first, then the largest reductions on the stats with the lowest targets. */
export function prioritizeTuningSet(set: TuningSet, targets: readonly number[]): TuningSet {
  const k = kernels();
  k.io().set(targets);
  return k.prioritize(set);
}

export function filterTuningSetForLockedStats(
  set: TuningSet,
  stats: readonly number[],
  fixed: readonly boolean[],
  targets: readonly number[]
): TuningSet {
  const k = kernels();
  const io = k.io();
  for (let stat = 0; stat < 6; stat++) {
    io[stat] = stats[stat];
    io[6 + stat] = fixed[stat] ? 1 : 0;
    io[12 + stat] = targets[stat];
  }
  return k.filterLocked(set);
}

export function filterTuningSetBySharedBudget(
  set: TuningSet,
  stats: readonly number[],
  targets: readonly number[],
  sharedBudget: number
): TuningSet {
  const k = kernels();
  const io = k.io();
  for (let stat = 0; stat < 6; stat++) {
    io[stat] = stats[stat];
    io[6 + stat] = targets[stat];
  }
  io[12] = sharedBudget;
  return k.filterBudget(set);
}

export function tuningSetSize(set: TuningSet): number {
  return kernels().count(set);
}

export function tuningSetAt(set: TuningSet, index: number): Tuning {
  const k = kernels();
  k.read(set, index);
  return Array.from(k.io().subarray(0, 6)) as Tuning;
}

export function tuningSetToArrays(set: TuningSet): number[][] {
  return Array.from({ length: tuningSetSize(set) }, (_, index) => tuningSetAt(set, index));
}
// endregion Tuning sets

// region Stat mod search
const uploaded = new WeakSet<object>();

// Flattens the precomputed mod combinations for the kernels: rows of six values (row 0 is the
// empty combination) and a (first row, row count) entry per distance.
function uploadModTable(k: Kernels): void {
  if (uploaded.has(k)) return;
  const distances = Object.keys(precalculatedTuningModCombinations).map(Number);
  const maxDistance = Math.max(...distances);
  const rows: number[] = [0, 0, 0, 0, 0, 0];
  const index = new Array<number>((maxDistance + 1) * 2).fill(0);
  for (let distance = 0; distance <= maxDistance; distance++) {
    const combinations = precalculatedTuningModCombinations[distance];
    if (!combinations) {
      index[distance * 2] = 0;
      index[distance * 2 + 1] = 1;
      continue;
    }
    index[distance * 2] = rows.length / 6;
    index[distance * 2 + 1] = combinations.length;
    for (const combination of combinations) rows.push(...combination);
  }

  k.tableInit(rows.length, index.length);
  const upload = (kind: number, values: number[]) => {
    const chunk = k.io().length;
    for (let offset = 0; offset < values.length; offset += chunk) {
      const part = values.slice(offset, offset + chunk);
      k.io().set(part);
      k.tableChunk(kind, offset, part.length);
    }
  };
  upload(0, rows);
  upload(1, index);
  uploaded.add(k);
}

export interface ModSearchContext {
  targets: readonly number[];
  fixed: readonly boolean[];
  minimumTiers: readonly number[];
  maxMajorMods: number;
  maxMods: number;
}

/** Applies the per-request limits; uploads the mod table on first use of a kernel instance. */
export function setModSearchContext(context: ModSearchContext): void {
  const k = kernels();
  uploadModTable(k);
  const io = k.io();
  for (let stat = 0; stat < 6; stat++) {
    io[stat] = context.targets[stat];
    io[6 + stat] = context.fixed[stat] ? 1 : 0;
    io[12 + stat] = context.minimumTiers[stat];
  }
  io[18] = context.maxMajorMods;
  io[19] = context.maxMods;
  k.setContext();
}

function writeSearchInput(
  k: Kernels,
  stats: readonly number[],
  distances: readonly number[],
  optionalDistances: readonly number[],
  artifice: number
): void {
  const io = k.io();
  for (let stat = 0; stat < 6; stat++) {
    io[stat] = stats[stat];
    io[6 + stat] = distances[stat];
    io[12 + stat] = optionalDistances[stat];
  }
  io[18] = artifice;
}

export interface ModSearchResult {
  mods: StatModifier[];
  tuning: Tuning;
}

/** Cheapest stat mods plus one tuning from `set` that reach the targets, or null. */
export function findStatMods(
  stats: readonly number[],
  distances: readonly number[],
  optionalDistances: readonly number[],
  artifice: number,
  set: TuningSet
): ModSearchResult | null {
  const k = kernels();
  writeSearchInput(k, stats, distances, optionalDistances, artifice);
  if (k.modsPrecalc(set) === 0) return null;

  const io = k.io();
  const mods: StatModifier[] = [];
  for (let stat = 0; stat < 6; stat++) {
    const at = 32 + stat * 3;
    for (let n = 0; n < io[at + 1]; n++) mods.push(STAT_MODIFIERS[stat][0]);
    for (let n = 0; n < io[at + 2]; n++) mods.push(STAT_MODIFIERS[stat][1]);
    for (let n = 0; n < io[at]; n++) mods.push(STAT_MODIFIERS[stat][2]);
  }
  return { mods, tuning: Array.from(io.subarray(50, 56)) as Tuning };
}

/** Raises `tiers` (the per-stat maximum known to be reachable) using the tunings in `set`. */
export function raiseReachableTiers(
  stats: readonly number[],
  distances: readonly number[],
  artifice: number,
  set: TuningSet,
  useParetoFront: boolean,
  tiers: number[]
): void {
  const k = kernels();
  writeSearchInput(k, stats, distances, [0, 0, 0, 0, 0, 0], artifice);
  const io = k.io();
  for (let stat = 0; stat < 6; stat++) io[20 + stat] = tiers[stat];
  k.tierTesting(set, useParetoFront ? 1 : 0);
  const out = k.io();
  for (let stat = 0; stat < 6; stat++) tiers[stat] = out[20 + stat];
}
// endregion Stat mod search
