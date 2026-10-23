import { StatModifier } from "../data/enum/armor-stat";
import type { IPermutatorArmorSet } from "../data/types/IPermutatorArmorSet";
import { packArmorSets, unpackArmorSets } from "./packed-armor-sets";

describe("packed armor sets", () => {
  const sets: IPermutatorArmorSet[] = [
    {
      armor: [11, 12, 13, 14, 15],
      useExoticClassItem: false,
      usedArtifice: [StatModifier.ARTIFICE_WEAPON],
      usedMods: [StatModifier.MAJOR_HEALTH, StatModifier.MINOR_MELEE],
      usedTuningMods: [3122197216, 388618952],
      statsWithMods: [100, 80, 70, 60, 50, 200],
      statsWithoutMods: [90, 75, 65, 55, 45, 190],
      tuning: [5, -5, 0, 0, 0, 1],
    },
    {
      armor: [1, 2, 3, 4, 5],
      useExoticClassItem: false,
      usedArtifice: [],
      usedMods: [],
      usedTuningMods: [],
      statsWithMods: [10, 20, 30, 40, 50, 60],
      statsWithoutMods: [10, 20, 30, 40, 50, 60],
      tuning: [0, 0, 0, 0, 0, 0],
    },
  ];

  it("round-trips sets including tuning mod hashes above the Int32 range", () => {
    expect(unpackArmorSets(packArmorSets(sets))).toEqual(sets);
  });

  it("handles an empty batch", () => {
    expect(unpackArmorSets(packArmorSets([]))).toEqual([]);
  });
});
