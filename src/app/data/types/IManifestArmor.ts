import {DestinyClass, DestinyItemInvestmentStatDefinition} from "bungie-api-ts/destiny2/interfaces";
import {ArmorSlot} from "../enum/armor-slot";
import {ArmorPerkOrSlot} from "../enum/armor-stat";

export interface IManifestArmor {
  hash: number;
  name: string;
  icon: string;
  slot: ArmorSlot;
  clazz: DestinyClass;
  perk: ArmorPerkOrSlot;
  isExotic: 1 | 0;
  armor2: boolean;
  rawData?: string;
  itemType: number;
  itemSubType: number;
  investmentStats: DestinyItemInvestmentStatDefinition[];
}
