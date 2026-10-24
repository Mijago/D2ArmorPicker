// Operations on tuning sets (see pool.ts). Tuning values are small (|v| <= 25), which the hash
// and sort keys rely on: every stat must stay within [-32, 31].
import { IO, alloc, finish, mark, pool, release, STRIDE } from "./pool";
import { key1, key2, sortReserve, sortRun } from "./sort";

let hashTable = new Int32Array(1024);
let packedLow = new Int32Array(1024);
let packedHigh = new Int32Array(1024);
const GUARDS: i32 = (1 << 6) | (1 << 13) | (1 << 20);
const statOrder = new Int32Array(6);

/** Set of the `n` tunings stored in IO[0..n*6). */
export function load(n: i32): i32 {
  const handle = alloc(n);
  for (let i = 0; i < n * STRIDE; i++) pool[handle + 1 + i] = IO[i];
  return finish(handle, n);
}

/** Set of one tuning taken from IO[0..5]. */
export function single(): i32 {
  const handle = alloc(1);
  for (let stat = 0; stat < 6; stat++) pool[handle + 1 + stat] = IO[stat];
  return finish(handle, 1);
}

/**
 * Minkowski sum of `source` with the `optionCount` options in IO[0..optionCount*6), keeping the
 * first occurrence of every distinct result in source-major, option-minor order.
 */
export function extend(source: i32, optionCount: i32): i32 {
  const sourceCount = pool[source];
  const maxOut = sourceCount * optionCount;
  let size: i32 = 16;
  while (size < maxOut * 2) size *= 2;
  if (hashTable.length < size) hashTable = new Int32Array(size);
  for (let i = 0; i < size; i++) hashTable[i] = 0;
  const mask = size - 1;

  const out = alloc(maxOut);
  let produced: i32 = 0;
  for (let index = 0; index < sourceCount; index++) {
    const from = source + 1 + index * STRIDE;
    for (let option = 0; option < optionCount; option++) {
      const o = option * STRIDE;
      const c0 = pool[from] + IO[o];
      const c1 = pool[from + 1] + IO[o + 1];
      const c2 = pool[from + 2] + IO[o + 2];
      const c3 = pool[from + 3] + IO[o + 3];
      const c4 = pool[from + 4] + IO[o + 4];
      const c5 = pool[from + 5] + IO[o + 5];
      const a = ((c0 + 32) * 64 + c1 + 32) * 64 + c2 + 32;
      const b = ((c3 + 32) * 64 + c4 + 32) * 64 + c5 + 32;
      let slot = (a * 1009 + b) & mask;
      while (true) {
        const found = hashTable[slot];
        if (found == 0) {
          const to = out + 1 + produced * STRIDE;
          pool[to] = c0;
          pool[to + 1] = c1;
          pool[to + 2] = c2;
          pool[to + 3] = c3;
          pool[to + 4] = c4;
          pool[to + 5] = c5;
          produced++;
          hashTable[slot] = produced;
          break;
        }
        const at = out + 1 + (found - 1) * STRIDE;
        if (
          pool[at] == c0 &&
          pool[at + 1] == c1 &&
          pool[at + 2] == c2 &&
          pool[at + 3] == c3 &&
          pool[at + 4] == c4 &&
          pool[at + 5] == c5
        )
          break;
        slot = (slot + 1) & mask;
      }
    }
  }
  return finish(out, produced);
}

function materialize(source: i32, order: Int32Array, n: i32): i32 {
  const out = alloc(n);
  for (let i = 0; i < n; i++) {
    const from = source + 1 + order[i] * STRIDE;
    const to = out + 1 + i * STRIDE;
    for (let stat = 0; stat < 6; stat++) pool[to + stat] = pool[from + stat];
  }
  return finish(out, n);
}

/**
 * Orders by total descending, then by the strongest reductions on the stats with the lowest
 * targets (IO[0..5]). Equal tunings keep their order.
 */
export function prioritize(source: i32): i32 {
  const n = pool[source];
  sortReserve(n);
  // Stat order by ascending target, ties by index.
  for (let i = 0; i < 6; i++) statOrder[i] = i;
  for (let i = 1; i < 6; i++) {
    const stat = statOrder[i];
    let j = i - 1;
    while (j >= 0 && IO[statOrder[j]] > IO[stat]) {
      statOrder[j + 1] = statOrder[j];
      j--;
    }
    statOrder[j + 1] = stat;
  }
  for (let index = 0; index < n; index++) {
    const base = source + 1 + index * STRIDE;
    let total: i32 = 0;
    for (let stat = 0; stat < 6; stat++) total += pool[base + stat];
    let r0: i32 = 0;
    let r1: i32 = 0;
    let rest: i32 = 0;
    for (let rank = 0; rank < 6; rank++) {
      const value = pool[base + statOrder[rank]];
      const reduction = (value < 0 ? value : 0) + 32;
      if (rank == 0) r0 = reduction;
      else if (rank == 1) r1 = reduction;
      else rest = rest * 64 + reduction;
    }
    key1[index] = ((100 - total) * 64 + r0) * 64 + r1;
    key2[index] = rest;
  }
  return materialize(source, sortRun(n, 1), n);
}

/** Pareto-maximal tunings, ordered by total descending; sets of one tuning are returned as is. */
export function pareto(source: i32): i32 {
  const n = pool[source];
  if (n <= 1) return source;
  sortReserve(n);
  for (let index = 0; index < n; index++) {
    const base = source + 1 + index * STRIDE;
    let total: i32 = 0;
    for (let stat = 0; stat < 6; stat++) total += pool[base + stat];
    key1[index] = 1000 - total;
  }
  const order = sortRun(n, 0);
  const out = alloc(n);
  if (packedLow.length < n) {
    let size = packedLow.length;
    while (size < n) size *= 2;
    packedLow = new Int32Array(size);
    packedHigh = new Int32Array(size);
  }
  let kept: i32 = 0;
  for (let rank = 0; rank < n; rank++) {
    const from = source + 1 + order[rank] * STRIDE;
    // Three 7-bit lanes per word (value + 32, guard bit on top): a lane of `a` is >= the lane of
    // `b` exactly when its guard bit survives (a | guard) - b.
    const low = ((pool[from] + 32) << 14) | ((pool[from + 1] + 32) << 7) | (pool[from + 2] + 32);
    const high =
      ((pool[from + 3] + 32) << 14) | ((pool[from + 4] + 32) << 7) | (pool[from + 5] + 32);
    let dominated = false;
    for (let k = 0; k < kept; k++) {
      if (
        (((packedLow[k] | GUARDS) - low) & ((packedHigh[k] | GUARDS) - high) & GUARDS) ==
        GUARDS
      ) {
        dominated = true;
        break;
      }
    }
    if (!dominated) {
      const to = out + 1 + kept * STRIDE;
      for (let stat = 0; stat < 6; stat++) pool[to + stat] = pool[from + stat];
      packedLow[kept] = low;
      packedHigh[kept] = high;
      kept++;
    }
  }
  return finish(out, kept);
}

/** Non-negative values ascending, then negatives from closest to zero; stable. */
export function sortByStat(source: i32, stat: i32): i32 {
  const n = pool[source];
  sortReserve(n);
  for (let index = 0; index < n; index++) {
    const value = pool[source + 1 + index * STRIDE + stat];
    key1[index] = value < 0 ? 100 - value : value;
  }
  return materialize(source, sortRun(n, 0), n);
}

/**
 * Drops tunings overshooting a locked stat. IO: stats[0..5], locked[6..11], targets[12..17].
 * Returns `source` when nothing is locked or removed.
 */
export function filterLocked(source: i32): i32 {
  let anyLocked = false;
  for (let stat = 0; stat < 6; stat++) if (IO[6 + stat] != 0) anyLocked = true;
  if (!anyLocked) return source;
  const n = pool[source];
  const start = mark();
  const out = alloc(n);
  let kept: i32 = 0;
  for (let index = 0; index < n; index++) {
    const from = source + 1 + index * STRIDE;
    let ok = true;
    for (let stat = 0; stat < 6; stat++) {
      if (IO[6 + stat] != 0 && pool[from + stat] > IO[12 + stat] - IO[stat]) ok = false;
    }
    if (!ok) continue;
    const to = out + 1 + kept * STRIDE;
    for (let stat = 0; stat < 6; stat++) pool[to + stat] = pool[from + stat];
    kept++;
  }
  if (kept == n) {
    release(start);
    return source;
  }
  return finish(out, kept);
}

/**
 * Drops tunings whose remaining target gap exceeds the shared budget.
 * IO: stats[0..5], targets[6..11], budget[12]. Returns `source` when nothing is removed.
 */
export function filterBudget(source: i32): i32 {
  let anyTarget = false;
  for (let stat = 0; stat < 6; stat++) if (IO[6 + stat] > 0) anyTarget = true;
  if (!anyTarget) return source;
  const budget = IO[12];
  const n = pool[source];
  const start = mark();
  const out = alloc(n);
  let kept: i32 = 0;
  for (let index = 0; index < n; index++) {
    const from = source + 1 + index * STRIDE;
    let totalGap: i32 = 0;
    let ok = true;
    for (let stat = 0; stat < 6; stat++) {
      const target = IO[6 + stat];
      if (target <= 0) continue;
      let gap = target - IO[stat] - pool[from + stat];
      if (gap < 0) gap = 0;
      if (gap > budget) {
        ok = false;
        break;
      }
      totalGap += gap;
    }
    if (!ok || totalGap > budget) continue;
    const to = out + 1 + kept * STRIDE;
    for (let stat = 0; stat < 6; stat++) pool[to + stat] = pool[from + stat];
    kept++;
  }
  if (kept == n) {
    release(start);
    return source;
  }
  return finish(out, kept);
}

/** Copies the tuning at `index` to IO[0..5]. */
export function read(source: i32, index: i32): void {
  const from = source + 1 + index * STRIDE;
  for (let stat = 0; stat < 6; stat++) IO[stat] = pool[from + stat];
}
