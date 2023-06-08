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
import { IManifestArmor } from "./IManifestArmor";
import { DestinyEnergyType } from "bungie-api-ts/destiny2/interfaces";

export enum InventoryArmorSource {
  Inventory = 0,
  Collections = 1,
  Vendor = 2,
}

export interface IInventoryArmor extends IManifestArmor {
  id: number;
  itemInstanceId: string;
  masterworked: boolean;
  mayBeBugged: boolean; // if there was an error in the parsing
  mobility: number;
  resilience: number;
  recovery: number;
  discipline: number;
  intellect: number;
  strength: number;
  energyLevel: number;

  // Note: this will be empty for vendor items
  statPlugHashes?: (number | undefined)[];

  source: InventoryArmorSource;
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
      itemInstanceId,
      mayBeBugged: false,
      masterworked: false,
      energyLevel: 0,
      mobility: 0,
      resilience: 0,
      recovery: 0,
      discipline: 0,
      intellect: 0,
      strength: 0,
      source,
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

// Returns true if the items are effectively equal in stats
export function isEqualItem(a: IInventoryArmor, b: IInventoryArmor): boolean {
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
