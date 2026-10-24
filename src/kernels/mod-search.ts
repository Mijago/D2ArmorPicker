// Stat-mod allocation search and per-stat reachable tier testing.
// IO layout shared by modsPrecalc and tierTesting:
//   in:  stats[0..5], distances[6..11], optionalDistances[12..17], artifice[18], tiers[20..25] (in/out)
//   out: picks[32..49] as (artifice, minor, major) per stat, tuning[50..55]
import { alloc, finish, IO, mark, pool, release, STRIDE } from "./pool";
import { imax, imin } from "./util";
import { pareto, sortByStat } from "./tuning-sets";

const NO_LIMIT: i32 = 1000000000;

const target = new Int32Array(6);
const locked = new Int32Array(6);
const minimumTier = new Int32Array(6);
let maxMajorMods: i32 = 0;
let maxMods: i32 = 0;

// Rows are (artifice, minor, major, tuning value, tuning count, total); row 0 is all zeros.
let tableRows = new Int32Array(6);
// Per distance: first row and row count.
let tableIndex = new Int32Array(0);

const current = new Int32Array(6);
const distance = new Int32Array(6);
const baseDistance = new Int32Array(6);
const tiers = new Int32Array(6);
// Per recursion level, the per-stat maximum of the tunings still in play.
const levelMax = new Int32Array(42);
const pickedRow = new Int32Array(6);
const pickedTuning = new Int32Array(6);
const modBonus = new Int32Array(6);

/** IO: targets[0..5], locked[6..11], minimum tiers[12..17], max major mods[18], max mods[19]. */
export function setContext(): void {
  for (let stat = 0; stat < 6; stat++) {
    target[stat] = IO[stat];
    locked[stat] = IO[6 + stat];
    minimumTier[stat] = IO[12 + stat];
  }
  maxMajorMods = IO[18];
  maxMods = IO[19];
}

export function tableInit(rowInts: i32, indexInts: i32): void {
  tableRows = new Int32Array(rowInts);
  tableIndex = new Int32Array(indexInts);
}

/** Copies IO[0..n) to offset of the rows (kind 0) or the per-distance index (kind 1). */
export function tableChunk(kind: i32, offset: i32, n: i32): void {
  if (kind == 0) for (let i = 0; i < n; i++) tableRows[offset + i] = IO[i];
  else for (let i = 0; i < n; i++) tableIndex[offset + i] = IO[i];
}

export function canCoverRemainingDistance(
  statIndex: i32,
  levelOffset: i32,
  artifice: i32,
  majors: i32,
  mods: i32
): i32 {
  let remaining: i32 = 0;
  let optimisticTuning: i32 = 0;
  for (let stat = statIndex; stat < 6; stat++) {
    remaining += distance[stat];
    optimisticTuning += imax(0, levelMax[levelOffset + stat]);
  }
  const majorMods = imin(majors, mods);
  const regularPoints = 10 * majorMods + 5 * (mods - majorMods);
  return remaining <= regularPoints + 3 * artifice + optimisticTuning ? 1 : 0;
}

// The tuning set is narrowed per stat to what the picked mods still allow; the first remaining
// tuning that keeps every negative stat on target ends the search.
function search(set: i32, statIndex: i32, artifice: i32, majors: i32, mods: i32): i32 {
  const levelOffset = statIndex * 6;
  if (canCoverRemainingDistance(statIndex, levelOffset, artifice, majors, mods) == 0) return 0;

  if (statIndex > 5) {
    const n = pool[set];
    for (let index = 0; index < n; index++) {
      const base = set + 1 + index * STRIDE;
      let ok = true;
      for (let stat = 0; stat < 6; stat++) {
        const value = pool[base + stat];
        if (value >= 0) continue;
        if (current[stat] + value < target[stat]) {
          ok = false;
          break;
        }
      }
      if (ok) {
        for (let stat = 0; stat < 6; stat++) pickedTuning[stat] = pool[base + stat];
        return 1;
      }
    }
    return 0;
  }

  const wanted = distance[statIndex];
  let first: i32 = 0;
  let rowCount: i32 = 1;
  if (wanted * 2 + 1 < tableIndex.length) {
    first = tableIndex[wanted * 2];
    rowCount = tableIndex[wanted * 2 + 1];
  }
  const tuningCeiling = levelMax[levelOffset + statIndex];
  const nextOffset = levelOffset + 6;

  for (let row = first; row < first + rowCount; row++) {
    const at = row * 6;
    const rowArtifice = tableRows[at];
    const rowMinor = tableRows[at + 1];
    const rowMajor = tableRows[at + 2];
    if (
      rowArtifice > artifice ||
      rowMajor > majors ||
      rowMajor + rowMinor > mods ||
      tableRows[at + 3] > tuningCeiling
    )
      continue;

    const nextMods = imax(0, mods - rowMinor - rowMajor);
    const nextMajors = imin(nextMods, imax(0, majors - rowMajor));
    const nextArtifice = imax(0, artifice - rowArtifice);

    let selected = set;
    for (let stat = 0; stat < 6; stat++) levelMax[nextOffset + stat] = levelMax[levelOffset + stat];
    const requiredCount = tableRows[at + 4];
    const requiredValue = tableRows[at + 3];
    const start = mark();
    if (requiredCount > 0 || locked[statIndex] != 0) {
      const ceiling =
        locked[statIndex] != 0
          ? target[statIndex] -
            current[statIndex] -
            (3 * rowArtifice + 5 * rowMinor + 10 * rowMajor)
          : NO_LIMIT;
      for (let stat = 0; stat < 6; stat++) levelMax[nextOffset + stat] = 0;
      selected = filterForStat(
        set,
        statIndex,
        requiredCount > 0 ? requiredValue : -NO_LIMIT,
        ceiling,
        nextOffset
      );
      if (pool[selected] == 0) {
        release(start);
        continue;
      }
    }

    pickedRow[statIndex] = row;
    const found = search(selected, statIndex + 1, nextArtifice, nextMajors, nextMods);
    release(start);
    if (found != 0) return 1;
  }
  return 0;
}

// Scratch copy of the tunings with minimum <= value[stat] <= maximum; also records their maxima.
function filterForStat(set: i32, stat: i32, minimum: i32, maximum: i32, levelOffset: i32): i32 {
  const n = pool[set];
  const out = alloc(n);
  let kept: i32 = 0;
  for (let index = 0; index < n; index++) {
    const from = set + 1 + index * STRIDE;
    const value = pool[from + stat];
    if (value < minimum || value > maximum) continue;
    const to = out + 1 + kept * STRIDE;
    for (let k = 0; k < 6; k++) {
      const v = pool[from + k];
      pool[to + k] = v;
      if (v > levelMax[levelOffset + k]) levelMax[levelOffset + k] = v;
    }
    kept++;
  }
  return finish(out, kept);
}

function precalc(set: i32, artifice: i32, optionalPending: i32): i32 {
  let total: i32 = 0;
  for (let stat = 0; stat < 6; stat++) total += distance[stat];
  if (total == 0 && optionalPending == 0) {
    for (let stat = 0; stat < 6; stat++) {
      pickedRow[stat] = 0;
      pickedTuning[stat] = 0;
      modBonus[stat] = 0;
    }
    return 1;
  }

  for (let stat = 0; stat < 6; stat++) levelMax[stat] = 0;
  const n = pool[set];
  for (let index = 0; index < n; index++) {
    const base = set + 1 + index * STRIDE;
    for (let stat = 0; stat < 6; stat++) {
      if (pool[base + stat] > levelMax[stat]) levelMax[stat] = pool[base + stat];
    }
  }
  if (canCoverRemainingDistance(0, 0, artifice, maxMajorMods, maxMods) == 0) return 0;
  if (search(set, 0, artifice, maxMajorMods, maxMods) == 0) return 0;

  for (let stat = 0; stat < 6; stat++) {
    const at = pickedRow[stat] * 6;
    modBonus[stat] = 3 * tableRows[at] + 5 * tableRows[at + 1] + 10 * tableRows[at + 2];
  }
  return 1;
}

function writePicks(): void {
  for (let stat = 0; stat < 6; stat++) {
    const at = pickedRow[stat] * 6;
    IO[32 + stat * 3] = tableRows[at];
    IO[33 + stat * 3] = tableRows[at + 1];
    IO[34 + stat * 3] = tableRows[at + 2];
    IO[50 + stat] = pickedTuning[stat];
  }
}

/** Finds stat mods and a tuning from `set` meeting the targets; returns 1 and fills IO on success. */
export function modsPrecalc(set: i32): i32 {
  let optionalPending: i32 = 0;
  for (let stat = 0; stat < 6; stat++) {
    current[stat] = IO[stat];
    distance[stat] = IO[6 + stat];
    if (IO[12 + stat] != 0) optionalPending = 1;
  }
  if (precalc(set, IO[18], optionalPending) == 0) return 0;
  writePicks();
  return 1;
}

/**
 * Raises the per-stat reachable maxima in IO[20..25] by probing, per stat, the highest value the
 * mods and `set` can still reach.
 */
export function tierTesting(set: i32, useParetoFront: i32): void {
  const artifice = IO[18];
  for (let stat = 0; stat < 6; stat++) {
    current[stat] = IO[stat];
    baseDistance[stat] = IO[6 + stat];
    tiers[stat] = IO[20 + stat];
  }

  let feasible = -1;
  if (useParetoFront == 0) feasible = set;

  for (let stat = 0; stat < 6; stat++) {
    const n = pool[set];
    let minimumTuning: i32 = 0;
    for (let index = 0; index < n; index++) {
      const value = pool[set + 1 + index * STRIDE + stat];
      if (value < minimumTuning) minimumTuning = value;
    }
    const minStat = current[stat];

    let sorted = -1;
    const naturalFloor = imin(200, minStat + minimumTuning);
    if (tiers[stat] < naturalFloor) tiers[stat] = naturalFloor;
    if (minStat >= 200) continue;

    const minimumTierValue = minimumTier[stat] * 10;
    let low = imax(tiers[stat], minimumTierValue);
    let high: i32 = 200;

    while (low <= high) {
      const mid = imin(200, ((low + high + 1) / 2) | 0);
      if (minStat >= mid && minimumTuning == 0) {
        low = mid + 1;
        continue;
      }
      if (sorted < 0) {
        if (feasible < 0) feasible = pareto(set);
        sorted = sortByStat(feasible, stat);
      }
      for (let k = 0; k < 6; k++) distance[k] = baseDistance[k];
      distance[stat] = imax(0, mid - minStat);
      if (precalc(sorted, artifice, 0) != 0) {
        const value = imin(200, minStat + pickedTuning[stat] + modBonus[stat]);
        tiers[stat] = imax(value, tiers[stat]);
        low = imax(tiers[stat], mid) + 1;
      } else {
        high = mid - 1;
      }
    }

    if (low > tiers[stat] && low <= 200) {
      if (sorted < 0) {
        if (feasible < 0) feasible = pareto(set);
        sorted = sortByStat(feasible, stat);
      }
      for (let k = 0; k < 6; k++) distance[k] = baseDistance[k];
      distance[stat] = imax(low - minStat, 0);
      if (precalc(sorted, artifice, 0) != 0) {
        tiers[stat] = low;
        for (let other = stat + 1; other < 6; other++) {
          const value = imin(200, current[other] + pickedTuning[other] + modBonus[other]);
          tiers[other] = imax(value, tiers[other]);
        }
      }
    }
  }

  for (let stat = 0; stat < 6; stat++) IO[20 + stat] = tiers[stat];
}
