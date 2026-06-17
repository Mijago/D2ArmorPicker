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

// Armor 3.0 is identified by the plug CATEGORY of the plugs in its archetype / tuning
// sockets, NOT by socketTypeHash. Bungie regenerates socketTypeHash between patches (cf.
// the recurring artifice-socket churn), so we key off the stable plugCategoryIdentifier
// string ("armor_archetypes" / the tuning identifier) and fall back to the plugCategory
// hash. Detection resolves each socket's default plug via a caller-provided resolver
// (the manifest item table); it works for inventory, collection and vendor items alike,
// with no per-instance gearTier needed.
export const ARMOR3_ARCHETYPE_PLUG_CATEGORY = "armor_archetypes";
export const ARMOR3_TUNING_PLUG_CATEGORY = "core.gear_systems.armor_tiering.plugs.tuning.mods";
export const ARMOR3_ARCHETYPE_PLUG_CATEGORY_HASH = 778194869;
export const ARMOR3_TUNING_PLUG_CATEGORY_HASH = 3481777685;

type PlugCategoryInfo = {
  plug?: { plugCategoryIdentifier?: string; plugCategoryHash?: number };
};

export function detectArmor3Sockets(
  socketEntries: { singleInitialItemHash?: number }[] | undefined,
  resolvePlug: (hash: number | undefined) => PlugCategoryInfo | undefined
): { hasArchetypeSocket: boolean; hasTuningSlot: boolean } {
  let hasArchetypeSocket = false;
  let hasTuningSlot = false;
  for (const entry of socketEntries ?? []) {
    const plug = resolvePlug(entry.singleInitialItemHash)?.plug;
    if (!plug) continue;
    const id = plug.plugCategoryIdentifier;
    const hash = plug.plugCategoryHash;
    if (id === ARMOR3_TUNING_PLUG_CATEGORY || hash === ARMOR3_TUNING_PLUG_CATEGORY_HASH)
      hasTuningSlot = true;
    if (id === ARMOR3_ARCHETYPE_PLUG_CATEGORY || hash === ARMOR3_ARCHETYPE_PLUG_CATEGORY_HASH)
      hasArchetypeSocket = true;
  }
  return { hasArchetypeSocket, hasTuningSlot };
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
  // Armor 3.0 socket presence (set during manifest ingestion via detectArmor3Sockets).
  hasTuningSlot?: boolean;
  hasArchetypeSocket?: boolean;
}
