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

import { ArmorSlot } from "../enum/armor-slot";
import { ArmorStat } from "../enum/armor-stat";
import { ArmorSystem, IDisplayManifestArmor, IManifestArmor } from "./IManifestArmor";

export interface ITimestampedEntry {
  created_at: number;
  updated_at: number;
}

export enum InventoryArmorSource {
  Inventory = 0,
  Collections = 1,
  Vendor = 2,
}

export interface IDestinyArmor {
  id: number;
  hash: number;
  slot: ArmorSlot;

  masterworkLevel: number; // 0-5; 5 = full masterwork
  archetypeStats: Array<ArmorStat>;
  tier: number; // 1-5, 0 = exotic
  gearSetHash: number | null;

  mobility: number;
  resilience: number;
  recovery: number;
  discipline: number;
  intellect: number;
  strength: number;

  source: InventoryArmorSource;
  armorSystem: ArmorSystem;
}

export interface IDisplayInventoryArmor extends IDisplayManifestArmor, IDestinyArmor {
  itemInstanceId: string;
  energyLevel: number;
}

export interface IInventoryArmor
  extends IDisplayInventoryArmor,
    IManifestArmor,
    IDestinyArmor,
    ITimestampedEntry {
  // Note: this will be empty for vendor items
  statPlugHashes?: (number | undefined)[];
  // exoticPerkHash is now inherited as number[] from IManifestArmor
}

export function createArmorItem(
  manifestItem: IManifestArmor,
  itemInstanceId: string,
  source: InventoryArmorSource
): IInventoryArmor {
  if (!manifestItem) throw new Error("Missing manifest item");

  const item: IInventoryArmor = Object.assign(
    {
      id: -1,
      tier: 1,
      itemInstanceId,
      masterworked: false,
      masterworkLevel: 0,
      archetypeStats: [],
      energyLevel: 0,
      mobility: 0,
      resilience: 0,
      recovery: 0,
      discipline: 0,
      intellect: 0,
      strength: 0,
      source,
      created_at: Date.now(),
      updated_at: Date.now(),
    },
    manifestItem
  );
  (item as any).id = undefined;

  // HALLOWEEN MASKS
  if (
    manifestItem.hash == 2545426109 ||
    manifestItem.hash == 199733460 ||
    manifestItem.hash == 3224066584
  ) {
    item.slot = ArmorSlot.ArmorSlotHelmet;
  }

  // exoticPerkHash is now an array from manifestArmor
  // For most armor pieces (non-class items), only the first perk matters
  // For exotic class items, all perks in the array are relevant
  if (manifestItem.exoticPerkHash) {
    item.exoticPerkHash = Array.isArray(manifestItem.exoticPerkHash)
      ? manifestItem.exoticPerkHash
      : [manifestItem.exoticPerkHash];
  }

  return item;
}

// This will mutate the incoming armor item to add the relevant stats
// plugHashes is received as a simple array of hashes,
// as the data is in a different shape for instances vs manifest items
export function applyInvestmentStats(
  r: IInventoryArmor,
  investmentStats: { [id: number]: number }
) {
  r.mobility = investmentStats[2996146975];
  r.resilience = investmentStats[392767087];
  r.recovery = investmentStats[1943323491];
  r.discipline = investmentStats[1735777505];
  r.intellect = investmentStats[144602215];
  r.strength = investmentStats[4244567218];
}

export function getInvestmentStats(r: IInventoryArmor): { [id: number]: number } {
  return {
    2996146975: r.mobility,
    392767087: r.resilience,
    1943323491: r.recovery,
    1735777505: r.discipline,
    144602215: r.intellect,
    4244567218: r.strength,
  };
}

// Returns true if the items are effectively equal in stats
export function isEqualItem(a: IDestinyArmor, b: IDestinyArmor): boolean {
  return (
    a.slot === b.slot &&
    a.hash === b.hash &&
    a.mobility === b.mobility &&
    a.resilience === b.resilience &&
    a.recovery === b.recovery &&
    a.discipline === b.discipline &&
    a.intellect === b.intellect &&
    a.strength === b.strength
  );
}

export function totalStats(a: IDestinyArmor): number {
  return a.mobility + a.resilience + a.recovery + a.discipline + a.intellect + a.strength;
}

// For any code that displays exotic perks, use this pattern:
// For regular exotics (non-class items): item.exoticPerkHash[0]
// For exotic class items: item.exoticPerkHash (all perks)

// Example usage in tooltips or display components:
export function getExoticPerkForDisplay(item: IInventoryArmor): number | null {
  if (!item.isExotic || !item.exoticPerkHash || item.exoticPerkHash.length === 0) {
    return null;
  }

  // For class items, you might want to handle multiple perks differently
  if (item.slot === ArmorSlot.ArmorSlotClass) {
    // Handle multiple perks for class items
    return item.exoticPerkHash[0]; // or return the array
  }

  // For other exotic armor pieces, use the first (and typically only) perk
  return item.exoticPerkHash[0];
}
