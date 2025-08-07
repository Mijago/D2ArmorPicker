import { DestinyClass, TierType } from "bungie-api-ts/destiny2";
import { ArmorPerkOrSlot } from "../enum/armor-stat";
import { IDestinyArmor } from "./IInventoryArmor";

export interface IPermutatorArmor extends IDestinyArmor {
  clazz: DestinyClass;
  perk: ArmorPerkOrSlot;
  isExotic: 0 | 1;
  rarity: TierType;
  isSunset: boolean;
  exoticPerkHash: number[];
  tuningStatHash?: number; // for armor 3.0, this is the tuning stat hash
}
