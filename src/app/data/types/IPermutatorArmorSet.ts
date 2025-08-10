import { ArmorStat, StatModifier } from "../enum/armor-stat";
import { IPermutatorArmor } from "./IPermutatorArmor";

export interface PossibleTuningInformation {
  tuningStat: ArmorStat;
  archetypeStats: ArmorStat[];
}

export interface SelectedTuning extends PossibleTuningInformation {
  // describes the stat that is reduced by the tuning; If it is null, no stat is but the 1/1/1 tuning is applied
  reducedStat: ArmorStat | null;
}

export interface Tuning {
  stats: number[];
  improvements: SelectedTuning[];
}

export interface IPermutatorArmorSet {
  armor: number[];
  useExoticClassItem: boolean;
  usedArtifice: StatModifier[];
  usedMods: StatModifier[];
  statsWithMods: number[];
  statsWithoutMods: number[];
  tuning?: Tuning;
}

export function createArmorSet(
  helmet: IPermutatorArmor,
  gauntlet: IPermutatorArmor,
  chest: IPermutatorArmor,
  leg: IPermutatorArmor,
  classItem: IPermutatorArmor,
  usedArtifice: StatModifier[],
  usedMods: StatModifier[],
  statsWithMods: number[],
  statsWithoutMods: number[],
  tuning: Tuning | undefined = undefined
): IPermutatorArmorSet {
  return {
    armor: [helmet.id, gauntlet.id, chest.id, leg.id, classItem.id],
    useExoticClassItem: false,
    usedArtifice,
    usedMods,
    statsWithMods,
    statsWithoutMods,
    tuning,
  };
}

export function isIPermutatorArmorSet(obj: any): obj is IPermutatorArmorSet {
  return (
    obj != null &&
    Object.prototype.hasOwnProperty.call(obj, "armor") &&
    Object.prototype.hasOwnProperty.call(obj, "useExoticClassItem") &&
    Object.prototype.hasOwnProperty.call(obj, "usedArtifice") &&
    Object.prototype.hasOwnProperty.call(obj, "usedMods") &&
    Object.prototype.hasOwnProperty.call(obj, "statsWithMods")
  );
}
