import { StatModifier } from "../enum/armor-stat";
import { IPermutatorArmor } from "./IPermutatorArmor";

export interface IPermutatorArmorSet {
  armor: number[];
  useExoticClassItem: boolean;
  usedArtifice: StatModifier[];
  usedMods: StatModifier[];
  statsWithMods: number[];
  statsWithoutMods: number[];
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
  statsWithoutMods: number[]
): IPermutatorArmorSet {
  return {
    armor: [helmet.id, gauntlet.id, chest.id, leg.id, classItem.id],
    useExoticClassItem: false,
    usedArtifice,
    usedMods,
    statsWithMods,
    statsWithoutMods,
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
