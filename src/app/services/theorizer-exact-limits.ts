import { T5_ARCHETYPES, t5BaseStats, t5Tertiaries } from "../data/theorizer";
import { kernels } from "../wasm/kernels";

/**
 * Exact stat limits for the hypothetical T5 model: five masterworked pieces (optionally balanced),
 * directional tuning (+5/-5, one per unbalanced piece) and up to `maxMods` stat mods.
 * Pieces are enumerated as multisets; mods and tuning are resolved by a small exact allocation.
 * The search itself lives in src/kernels/exact-limits.ts.
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
const MAX_INT32 = 2147483647;

function getPieceTypes(): PieceType[] {
  return (pieceTypes ??= T5_ARCHETYPES.flatMap((archetype) =>
    t5Tertiaries(archetype).map((tertiary) => {
      const raw = t5BaseStats(archetype, tertiary).map((value) => value || 5);
      const low = [0, 1, 2, 3, 4, 5].filter((stat) => t5BaseStats(archetype, tertiary)[stat] === 0);
      return { raw, low };
    })
  ));
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
  const k = kernels();
  const io = k.io();
  input.minimums.forEach((minimum, index) => (io[index] = minimum));
  input.fixed.forEach((fixed, index) => (io[6 + index] = fixed ? 1 : 0));
  io[12] = input.maxMods;
  io[13] = input.maxMajorMods;
  io[14] = input.tuning === false ? 0 : 1;
  io[15] = stat;
  io[16] = Number.isFinite(stopAt) ? stopAt : MAX_INT32;
  io[17] = types.length;
  types.forEach((type, index) => {
    io.set(type.raw, 32 + index * 12);
    io.fill(0, 38 + index * 12, 44 + index * 12);
    for (const low of type.low) io[38 + index * 12 + low] = 1;
  });
  return k.exactMaximum() === 0 ? null : k.io()[0];
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
