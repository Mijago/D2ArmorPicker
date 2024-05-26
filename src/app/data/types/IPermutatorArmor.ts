import { DestinyClass, TierType } from "bungie-api-ts/destiny2";
import { ArmorPerkOrSlot } from "../enum/armor-stat";
import { IDestinyArmor } from "./IInventoryArmor";

export interface IPermutatorArmor extends IDestinyArmor {
  clazz: DestinyClass;
  perk: ArmorPerkOrSlot;
  isExotic: boolean;
  rarity: TierType;
  isSunset: boolean;
}
