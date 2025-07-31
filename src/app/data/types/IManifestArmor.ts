/*
 * Copyright (c) 2023 D2ArmorPicker by Mijago.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import {
  DestinyClass,
  DestinyItemInvestmentStatDefinition,
  DestinyItemSocketEntryDefinition,
  TierType,
} from "bungie-api-ts/destiny2/interfaces";
import { ArmorSlot } from "../enum/armor-slot";
import { ArmorPerkOrSlot } from "../enum/armor-stat";

export enum ArmorSystem {
  Armor1 = 1, // Armor 1.0
  Armor2 = 2, // Armor 2.0
  Armor3 = 3, // Armor 3.0
}

export interface IDisplayManifestArmor {
  hash: number;
  name: string;
  icon: string;
  description: string;
  slot: ArmorSlot;
  clazz: DestinyClass;
  isExotic: 0 | 1;
  rarity: TierType;
  armorSystem: ArmorSystem;
  isFeatured: boolean;
  gearSetHash: number | null;
}
export interface IManifestArmor extends IDisplayManifestArmor {
  watermarkIcon: string;
  perk: ArmorPerkOrSlot;
  exoticPerkHash: number[];
  isSunset: boolean;
  rawData?: string;
  itemType: number;
  itemSubType: number;
  investmentStats: DestinyItemInvestmentStatDefinition[];
  socketEntries: DestinyItemSocketEntryDefinition[];
}
