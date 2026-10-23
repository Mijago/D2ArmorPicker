import { StatModifier } from "../data/enum/armor-stat";
import type { IPermutatorArmorSet, Tuning } from "../data/types/IPermutatorArmorSet";

// Per set: 5 item ids, 6 stats with mods, 6 stats without mods, 6 tuning values and 3 list lengths.
const FIXED_WIDTH = 26;

/** Typed-array form of worker results; the buffers are transferred instead of structured-cloned. */
export interface PackedArmorSets {
  count: number;
  fixed: Int32Array;
  /** Per set: used mods, used artifice mods, then tuning mod hashes (which exceed Int32). */
  variable: Uint32Array;
}

export function packArmorSets(sets: readonly IPermutatorArmorSet[]): PackedArmorSets {
  let variableLength = 0;
  for (const set of sets) {
    variableLength += set.usedMods.length + set.usedArtifice.length + set.usedTuningMods.length;
  }
  const fixed = new Int32Array(sets.length * FIXED_WIDTH);
  const variable = new Uint32Array(variableLength);
  let variableOffset = 0;

  sets.forEach((set, index) => {
    const base = index * FIXED_WIDTH;
    for (let n = 0; n < 5; n++) fixed[base + n] = set.armor[n];
    for (let n = 0; n < 6; n++) {
      fixed[base + 5 + n] = set.statsWithMods[n];
      fixed[base + 11 + n] = set.statsWithoutMods[n];
      fixed[base + 17 + n] = set.tuning[n];
    }
    fixed[base + 23] = set.usedMods.length;
    fixed[base + 24] = set.usedArtifice.length;
    fixed[base + 25] = set.usedTuningMods.length;
    for (const mod of set.usedMods) variable[variableOffset++] = mod;
    for (const mod of set.usedArtifice) variable[variableOffset++] = mod;
    for (const hash of set.usedTuningMods) variable[variableOffset++] = hash;
  });

  return { count: sets.length, fixed, variable };
}

export function unpackArmorSets(packed: PackedArmorSets): IPermutatorArmorSet[] {
  const { count, fixed, variable } = packed;
  const sets = new Array<IPermutatorArmorSet>(count);
  let variableOffset = 0;

  for (let index = 0; index < count; index++) {
    const base = index * FIXED_WIDTH;
    const modCount = fixed[base + 23];
    const artificeCount = fixed[base + 24];
    const tuningModCount = fixed[base + 25];
    const usedMods = Array.from(
      variable.subarray(variableOffset, variableOffset + modCount)
    ) as StatModifier[];
    variableOffset += modCount;
    const usedArtifice = Array.from(
      variable.subarray(variableOffset, variableOffset + artificeCount)
    ) as StatModifier[];
    variableOffset += artificeCount;
    const usedTuningMods = Array.from(
      variable.subarray(variableOffset, variableOffset + tuningModCount)
    );
    variableOffset += tuningModCount;

    sets[index] = {
      armor: Array.from(fixed.subarray(base, base + 5)),
      useExoticClassItem: false,
      usedArtifice,
      usedMods,
      usedTuningMods,
      statsWithMods: Array.from(fixed.subarray(base + 5, base + 11)),
      statsWithoutMods: Array.from(fixed.subarray(base + 11, base + 17)),
      tuning: Array.from(fixed.subarray(base + 17, base + 23)) as Tuning,
    };
  }
  return sets;
}
