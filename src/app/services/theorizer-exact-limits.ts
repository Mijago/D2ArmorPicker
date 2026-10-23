import { T5_ARCHETYPES, t5BaseStats, t5Tertiaries } from "../data/theorizer";

/**
 * Exact stat limits for the hypothetical T5 model: five masterworked pieces (optionally balanced),
 * directional tuning (+5/-5, one per unbalanced piece) and up to `maxMods` stat mods.
 * Pieces are enumerated as multisets; mods and tuning are resolved by a small exact allocation.
 */
export interface T5ExactInput {
  /** Per-stat minimum of the raw stat sum (target minus subclass bonus). */
  minimums: number[];
  /** Fixed stats must be met exactly. */
  fixed: boolean[];
  maxMods: number;
  maxMajorMods: number;
  /** Defaults to true; false removes directional +5/-5 tuning but keeps balanced pieces. */
  tuning?: boolean;
}

interface PieceType {
  raw: number[];
  low: number[];
}

let pieceTypes: PieceType[] | undefined;
const UNKNOWN = 100;
const IMPOSSIBLE = -100;

function getPieceTypes(): PieceType[] {
  return (pieceTypes ??= T5_ARCHETYPES.flatMap((archetype) =>
    t5Tertiaries(archetype).map((tertiary) => {
      const raw = t5BaseStats(archetype, tertiary).map((value) => value || 5);
      const low = [0, 1, 2, 3, 4, 5].filter((stat) => t5BaseStats(archetype, tertiary)[stat] === 0);
      return { raw, low };
    })
  ));
}

// Best net units (of 5 points) the stat `s` can gain, or -Infinity when the others cannot be met.
function allocate(
  needs: readonly number[],
  fixed: readonly boolean[],
  tunings: number,
  mods: number,
  majors: number
): number {
  let forced = 0;
  let donors = 0;
  const deficits: { need: number; fixed: boolean }[] = [];
  for (let index = 0; index < needs.length; index++) {
    const need = needs[index];
    if (need > 0) deficits.push({ need, fixed: fixed[index] });
    else if (need < 0) {
      if (fixed[index]) forced -= need;
      else donors += Math.min(tunings, -need);
    }
  }
  if (forced > tunings) return -Infinity;
  let required = 0;
  for (const { need } of deficits) required += need;
  // The maximized stat can also donate tunings, so only mods and tunings bound the deficit.
  if (required > mods + majors + tunings) return -Infinity;
  const jSize = majors + 1;
  const uSize = tunings + 1;
  let current = new Uint8Array((mods + 1) * jSize * uSize);
  current[0] = 1;
  for (const { need, fixed: exact } of deficits) {
    const options: number[][] = [];
    for (let up = 0; up <= Math.min(need, tunings); up++) {
      const rest = need - up;
      const maxMajor = exact ? Math.floor(rest / 2) : Math.ceil(rest / 2);
      for (let major = 0; major <= maxMajor; major++) {
        options.push([major + Math.max(0, rest - 2 * major), major, up]);
      }
    }
    const next = new Uint8Array(current.length);
    for (let a = 0; a <= mods; a++)
      for (let j = 0; j <= majors; j++)
        for (let u = 0; u <= tunings; u++) {
          if (!current[(a * jSize + j) * uSize + u]) continue;
          for (const [slots, major, up] of options) {
            if (a + slots <= mods && j + major <= majors && u + up <= tunings)
              next[((a + slots) * jSize + j + major) * uSize + u + up] = 1;
          }
        }
    current = next;
  }
  let best = -Infinity;
  for (let a = 0; a <= mods; a++)
    for (let j = 0; j <= majors; j++)
      for (let u = 0; u <= tunings; u++) {
        if (!current[(a * jSize + j) * uSize + u]) continue;
        const remaining = mods - a;
        const modUnits = remaining + Math.min(remaining, majors - j);
        let tuningUnits: number;
        if (u <= forced + donors) tuningUnits = Math.min(tunings, forced + donors) - u;
        else tuningUnits = -(u - forced - donors);
        best = Math.max(best, modUnits + tuningUnits);
      }
  return best;
}

/** Highest raw value of `stat` while all other stats meet their minimums, or null if impossible. */
export function t5ExactMaximum(
  input: T5ExactInput,
  stat: number,
  stopAt = Infinity
): number | null {
  const types = getPieceTypes()
    .slice()
    .sort((first, second) => second.raw[stat] - first.raw[stat]);
  const count = types.length;
  const rawFlat = new Int32Array(count * 6);
  types.forEach((type, index) => rawFlat.set(type.raw, index * 6));
  const mods = Math.min(5, Math.max(0, input.maxMods));
  const majors = Math.min(mods, Math.max(0, input.maxMajorMods));
  const others = [0, 1, 2, 3, 4, 5].filter((other) => other !== stat);
  const span = mods + majors + 14;
  const cache = new Map<number, number>();
  const levels = Array.from({ length: 6 }, () => new Int32Array(6));
  const picked = [0, 0, 0, 0, 0];
  const needs = [0, 0, 0, 0, 0];
  const otherFixed = others.map((other) => input.fixed[other]);
  const directionalSlots = input.tuning === false ? 0 : 5;
  let best = -Infinity;

  const bonus = new Int32Array(6);
  const lowFlat = new Int32Array(count * 6);
  types.forEach((type, index) => type.low.forEach((low) => (lowFlat[index * 6 + low] = 1)));
  const lowLevels = Array.from({ length: 6 }, () => new Int32Array(6));

  const evaluate = (sums: Int32Array) => {
    // Equal pieces are interchangeable, so only a leading run of each equal group is balanced.
    let repeated = 0;
    for (let piece = 1; piece < 5; piece++)
      if (picked[piece] === picked[piece - 1]) repeated |= 1 << piece;
    for (let mask = 0; mask < 32; mask++) {
      if (mask & repeated & ((~mask << 1) & 31)) continue;
      bonus.fill(0);
      let balanced = 0;
      for (let piece = 0; piece < 5; piece++) {
        if (!(mask & (1 << piece))) continue;
        balanced++;
        const base = picked[piece] * 6;
        for (let low = 0; low < 6; low++) bonus[low] += lowFlat[base + low];
      }
      const tunings = directionalSlots > 0 ? directionalSlots - balanced : 0;
      let key = tunings;
      let valid = true;
      let deficit = 0;
      let donors = 0;
      for (let index = 0; index < 5; index++) {
        const other = others[index];
        const gap = input.minimums[other] - sums[other] - bonus[other];
        let need: number;
        if (otherFixed[index]) {
          if (gap % 5 !== 0) {
            valid = false;
            break;
          }
          need = gap / 5;
        } else need = Math.ceil(gap / 5);
        need = Math.max(-6, Math.min(span - 7, need));
        needs[index] = need;
        key = key * span + need + 6;
        if (need > 0) deficit += need;
        else donors += Math.min(tunings, -need);
      }
      if (!valid) continue;
      if (deficit > mods + majors + tunings) continue;
      const supply = mods + majors + Math.min(tunings, donors);
      if (sums[stat] + bonus[stat] + 5 * (supply - deficit) <= best) continue;
      let units = cache.get(key);
      if (units === undefined) {
        units = allocate(needs, otherFixed, tunings, mods, majors);
        cache.set(key, units);
      }
      if (units > -Infinity) best = Math.max(best, sums[stat] + bonus[stat] + 5 * units);
    }
  };

  const optimistic = new Int8Array(span ** 5).fill(UNKNOWN);
  const unfixed = [false, false, false, false, false];
  const visit = (sums: Int32Array, lows: Int32Array) => {
    // Optimistic bound: every balanced bonus lands where it helps, all tunings stay available.
    let key = 0;
    for (let index = 0; index < 5; index++) {
      const other = others[index];
      const gap = input.minimums[other] - sums[other] - lows[other];
      const need = Math.max(-6, Math.min(span - 7, Math.ceil(gap / 5)));
      // Ascending insertion keeps the key independent of stat order.
      let position = index;
      while (position > 0 && needs[position - 1] > need) {
        needs[position] = needs[position - 1];
        position--;
      }
      needs[position] = need;
    }
    for (let index = 0; index < 5; index++) key = key * span + needs[index] + 6;
    let units = optimistic[key];
    if (units === UNKNOWN) {
      const solved = allocate(needs, unfixed, directionalSlots, mods, majors);
      units = solved === -Infinity ? IMPOSSIBLE : solved;
      optimistic[key] = units;
    }
    if (units === IMPOSSIBLE || sums[stat] + lows[stat] + 5 * units <= best) return;
    evaluate(sums);
  };

  const run = (depth: number, start: number): boolean => {
    if (depth === 5) {
      visit(levels[5], lowLevels[5]);
      return best >= stopAt;
    }
    const parent = levels[depth];
    const child = levels[depth + 1];
    const lowParent = lowLevels[depth];
    const lowChild = lowLevels[depth + 1];
    for (let type = start; type < count; type++) {
      for (let k = 0; k < 6; k++) {
        child[k] = parent[k] + rawFlat[type * 6 + k];
        lowChild[k] = lowParent[k] + lowFlat[type * 6 + k];
      }
      picked[depth] = type;
      if (run(depth + 1, type)) return true;
    }
    return false;
  };
  run(0, 0);
  return best === -Infinity ? null : best;
}

export interface T5ExactLimits {
  feasible: boolean;
  maximum: number[];
}

export function t5ExactLimits(
  input: T5ExactInput,
  bonuses: readonly number[],
  targets: readonly number[],
  validateOnly: boolean
): T5ExactLimits | null {
  const free = input.fixed.findIndex((fixed) => !fixed);
  if (free < 0) return null;
  const check = t5ExactMaximum(input, free, input.minimums[free]);
  const maximum = Array<number>(6).fill(0);
  if (check === null || check < input.minimums[free]) return { feasible: false, maximum };
  if (validateOnly) return { feasible: true, maximum };
  for (let stat = 0; stat < 6; stat++) {
    if (input.fixed[stat]) {
      maximum[stat] = targets[stat];
      continue;
    }
    const best = t5ExactMaximum(input, stat) ?? 0;
    maximum[stat] = Math.max(0, Math.min(200, Math.round(best + bonuses[stat])));
  }
  return { feasible: true, maximum };
}
