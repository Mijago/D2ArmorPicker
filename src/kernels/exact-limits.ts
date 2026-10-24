// Exact stat limits for the hypothetical T5 model (see theorizer-exact-limits.ts): the highest raw
// value of one stat reachable by five masterworked pieces, balanced/directional tuning and mods.
//
// IO in:  minimums[0..5], locked[6..11], max mods[12], max major mods[13], directional tuning[14],
//         stat[15], stop at[16], piece type count[17], then per piece type (sorted by the raw value
//         of `stat`, descending) raw[6] and low-stat flags[6] from offset 32.
// IO out: best[0]; the return value is 1 when a maximum exists and 0 when it is unreachable.
import { IO } from "./pool";
import { imax, imin } from "./util";

const NONE: i32 = -1000000000;
const UNKNOWN: i32 = 100;
const IMPOSSIBLE: i32 = -100;
const EMPTY: i32 = -1;

const minimums = new Int32Array(6);
const lockedStat = new Int32Array(6);
const others = new Int32Array(5);
const otherLocked = new Int32Array(5);
const unlocked = new Int32Array(5);
const picked = new Int32Array(5);
const needs = new Int32Array(5);
const bonus = new Int32Array(6);
const levelSums = new Int32Array(36);
const levelLows = new Int32Array(36);
let rawFlat = new Int32Array(0);
let lowFlat = new Int32Array(0);

const deficitNeed = new Int32Array(5);
const deficitLocked = new Int32Array(5);
// Allocation DP tables: (mods + 1) x (majors + 1) x (tunings + 1) <= 6 x 6 x 6.
let reachCurrent = new Uint8Array(216);
let reachNext = new Uint8Array(216);

let optimistic = new Int8Array(1);
let cacheKeys = new Int32Array(4096);
let cacheValues = new Int32Array(4096);
let cacheUsed: i32 = 0;

let stat: i32 = 0;
let stopAt: i32 = 0;
let typeCount: i32 = 0;
let mods: i32 = 0;
let majors: i32 = 0;
let span: i32 = 0;
let directionalSlots: i32 = 0;
let best: i32 = NONE;

function ceilDiv5(value: i32): i32 {
  return value >= 0 ? ((value + 4) / 5) | 0 : -((-value / 5) | 0);
}

// Best net units (of 5 points) the maximized stat can gain, or NONE when the others cannot be met.
function allocate(lockedFlags: Int32Array, tunings: i32): i32 {
  let forced: i32 = 0;
  let donors: i32 = 0;
  let deficits: i32 = 0;
  let required: i32 = 0;
  for (let index = 0; index < 5; index++) {
    const need = needs[index];
    if (need > 0) {
      deficitNeed[deficits] = need;
      deficitLocked[deficits] = lockedFlags[index];
      deficits++;
      required += need;
    } else if (need < 0) {
      if (lockedFlags[index] != 0) forced -= need;
      else donors += imin(tunings, -need);
    }
  }
  if (forced > tunings) return NONE;
  // The maximized stat can also donate tunings, so only mods and tunings bound the deficit.
  if (required > mods + majors + tunings) return NONE;

  const jSize = majors + 1;
  const uSize = tunings + 1;
  const size = (mods + 1) * jSize * uSize;
  for (let i = 0; i < size; i++) reachCurrent[i] = 0;
  reachCurrent[0] = 1;
  for (let deficit = 0; deficit < deficits; deficit++) {
    const need = deficitNeed[deficit];
    const exact = deficitLocked[deficit] != 0;
    for (let i = 0; i < size; i++) reachNext[i] = 0;
    for (let a = 0; a <= mods; a++)
      for (let j = 0; j <= majors; j++)
        for (let u = 0; u <= tunings; u++) {
          if (reachCurrent[(a * jSize + j) * uSize + u] == 0) continue;
          for (let up = 0; up <= imin(need, tunings); up++) {
            const rest = need - up;
            const maxMajor = exact ? (rest / 2) | 0 : ((rest + 1) / 2) | 0;
            for (let major = 0; major <= maxMajor; major++) {
              const slots = major + imax(0, rest - 2 * major);
              if (a + slots <= mods && j + major <= majors && u + up <= tunings) {
                reachNext[((a + slots) * jSize + j + major) * uSize + u + up] = 1;
              }
            }
          }
        }
    const swap = reachCurrent;
    reachCurrent = reachNext;
    reachNext = swap;
  }

  let result: i32 = NONE;
  for (let a = 0; a <= mods; a++)
    for (let j = 0; j <= majors; j++)
      for (let u = 0; u <= tunings; u++) {
        if (reachCurrent[(a * jSize + j) * uSize + u] == 0) continue;
        const remaining = mods - a;
        const modUnits = remaining + imin(remaining, majors - j);
        let tuningUnits: i32;
        if (u <= forced + donors) tuningUnits = imin(tunings, forced + donors) - u;
        else tuningUnits = -(u - forced - donors);
        result = imax(result, modUnits + tuningUnits);
      }
  return result;
}

function cacheSlot(key: i32): i32 {
  const mask = cacheKeys.length - 1;
  let slot = (key ^ (key >> 12) ^ (key >> 22)) & mask;
  while (cacheKeys[slot] != EMPTY && cacheKeys[slot] != key) slot = (slot + 1) & mask;
  return slot;
}

function cacheGrow(): void {
  const oldKeys = cacheKeys;
  const oldValues = cacheValues;
  cacheKeys = new Int32Array(oldKeys.length * 2);
  cacheValues = new Int32Array(oldKeys.length * 2);
  for (let i = 0; i < cacheKeys.length; i++) cacheKeys[i] = EMPTY;
  for (let i = 0; i < oldKeys.length; i++) {
    if (oldKeys[i] == EMPTY) continue;
    const slot = cacheSlot(oldKeys[i]);
    cacheKeys[slot] = oldKeys[i];
    cacheValues[slot] = oldValues[i];
  }
}

function clampNeed(need: i32): i32 {
  return imax(-6, imin(span - 7, need));
}

function evaluate(sums: i32): void {
  // Equal pieces are interchangeable, so only a leading run of each equal group is balanced.
  let repeated: i32 = 0;
  for (let piece = 1; piece < 5; piece++) {
    if (picked[piece] == picked[piece - 1]) repeated |= 1 << piece;
  }
  for (let mask = 0; mask < 32; mask++) {
    if ((mask & repeated & ((~mask << 1) & 31)) != 0) continue;
    for (let low = 0; low < 6; low++) bonus[low] = 0;
    let balanced: i32 = 0;
    for (let piece = 0; piece < 5; piece++) {
      if ((mask & (1 << piece)) == 0) continue;
      balanced++;
      const base = picked[piece] * 6;
      for (let low = 0; low < 6; low++) bonus[low] += lowFlat[base + low];
    }
    const tunings = directionalSlots > 0 ? directionalSlots - balanced : 0;
    let key: i32 = tunings;
    let valid = true;
    let deficit: i32 = 0;
    let donors: i32 = 0;
    for (let index = 0; index < 5; index++) {
      const other = others[index];
      const gap = minimums[other] - levelSums[sums + other] - bonus[other];
      let need: i32;
      if (otherLocked[index] != 0) {
        if (gap % 5 != 0) {
          valid = false;
          break;
        }
        need = (gap / 5) | 0;
      } else {
        need = ceilDiv5(gap);
      }
      need = clampNeed(need);
      needs[index] = need;
      key = key * span + need + 6;
      if (need > 0) deficit += need;
      else donors += imin(tunings, -need);
    }
    if (!valid) continue;
    if (deficit > mods + majors + tunings) continue;
    const supply = mods + majors + imin(tunings, donors);
    if (levelSums[sums + stat] + bonus[stat] + 5 * (supply - deficit) <= best) continue;

    let slot = cacheSlot(key);
    let units: i32;
    if (cacheKeys[slot] == EMPTY) {
      units = allocate(otherLocked, tunings);
      if ((cacheUsed + 1) * 2 > cacheKeys.length) {
        cacheGrow();
        slot = cacheSlot(key);
      }
      cacheKeys[slot] = key;
      cacheValues[slot] = units;
      cacheUsed++;
    } else {
      units = cacheValues[slot];
    }
    if (units > NONE) best = imax(best, levelSums[sums + stat] + bonus[stat] + 5 * units);
  }
}

function visit(sums: i32): void {
  // Optimistic bound: every balanced bonus lands where it helps, all tunings stay available.
  for (let index = 0; index < 5; index++) {
    const other = others[index];
    const gap = minimums[other] - levelSums[sums + other] - levelLows[sums + other];
    const need = clampNeed(ceilDiv5(gap));
    // Ascending insertion keeps the key independent of stat order.
    let position = index;
    while (position > 0 && needs[position - 1] > need) {
      needs[position] = needs[position - 1];
      position--;
    }
    needs[position] = need;
  }
  let key: i32 = 0;
  for (let index = 0; index < 5; index++) key = key * span + needs[index] + 6;
  let units: i32 = optimistic[key];
  if (units == UNKNOWN) {
    const solved = allocate(unlocked, directionalSlots);
    units = solved == NONE ? IMPOSSIBLE : solved;
    optimistic[key] = <i8>units;
  }
  if (units == IMPOSSIBLE || levelSums[sums + stat] + levelLows[sums + stat] + 5 * units <= best)
    return;
  evaluate(sums);
}

function run(depth: i32, start: i32): boolean {
  if (depth == 5) {
    visit(5 * 6);
    return best >= stopAt;
  }
  const parent = depth * 6;
  const child = parent + 6;
  for (let type = start; type < typeCount; type++) {
    for (let k = 0; k < 6; k++) {
      levelSums[child + k] = levelSums[parent + k] + rawFlat[type * 6 + k];
      levelLows[child + k] = levelLows[parent + k] + lowFlat[type * 6 + k];
    }
    picked[depth] = type;
    if (run(depth + 1, type)) return true;
  }
  return false;
}

export function exactMaximum(): i32 {
  for (let index = 0; index < 6; index++) {
    minimums[index] = IO[index];
    lockedStat[index] = IO[6 + index];
  }
  mods = imin(5, imax(0, IO[12]));
  majors = imin(mods, imax(0, IO[13]));
  directionalSlots = IO[14] != 0 ? 5 : 0;
  stat = IO[15];
  stopAt = IO[16];
  typeCount = IO[17];

  if (rawFlat.length < typeCount * 6) {
    rawFlat = new Int32Array(typeCount * 6);
    lowFlat = new Int32Array(typeCount * 6);
  }
  for (let type = 0; type < typeCount; type++) {
    for (let k = 0; k < 6; k++) {
      rawFlat[type * 6 + k] = IO[32 + type * 12 + k];
      lowFlat[type * 6 + k] = IO[32 + type * 12 + 6 + k];
    }
  }

  let position: i32 = 0;
  for (let other = 0; other < 6; other++) {
    if (other == stat) continue;
    others[position] = other;
    otherLocked[position] = lockedStat[other];
    unlocked[position] = 0;
    position++;
  }
  span = mods + majors + 14;
  let states: i32 = 1;
  for (let i = 0; i < 5; i++) states *= span;
  if (optimistic.length < states) optimistic = new Int8Array(states);
  optimistic.fill(<i8>UNKNOWN, 0, states);
  for (let i = 0; i < cacheKeys.length; i++) cacheKeys[i] = EMPTY;
  cacheUsed = 0;

  for (let k = 0; k < 36; k++) {
    levelSums[k] = 0;
    levelLows[k] = 0;
  }
  best = NONE;
  run(0, 0);
  if (best == NONE) return 0;
  IO[0] = best;
  return 1;
}
