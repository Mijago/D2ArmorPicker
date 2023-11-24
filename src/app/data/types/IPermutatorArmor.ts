import {
  DestinyClass,
  TierType,
  DestinyItemInvestmentStatDefinition,
  DestinyItemSocketEntryDefinition,
} from "bungie-api-ts/destiny2";
import { ArmorSlot } from "../enum/armor-slot";
import { ArmorPerkOrSlot } from "../enum/armor-stat";
import { IDestinyArmor, InventoryArmorSource } from "./IInventoryArmor";

export interface IPermutatorArmor extends IDestinyArmor {
  clazz: DestinyClass;
  perk: ArmorPerkOrSlot;
  isExotic: boolean;
  rarity: TierType;
  isSunset: boolean;
}
