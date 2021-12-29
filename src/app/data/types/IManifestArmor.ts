import {DestinyClass, DestinyItemInvestmentStatDefinition} from "bungie-api-ts/destiny2/interfaces";

export interface IManifestArmor {
  hash: number;
  name: string;
  icon: string;
  slot: string;
  clazz: DestinyClass;
  isExotic: 1 | 0;
  armor2: boolean;
  rawData?: string;
  itemType: number;
  itemSubType: number;
  investmentStats: DestinyItemInvestmentStatDefinition[];
}
