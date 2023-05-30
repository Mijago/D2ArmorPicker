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
  statPlugHashes: (number | undefined)[];
  source: InventoryArmorSource;
}

export function createArmorItem(
  manifestItem: IManifestArmor,
  itemInstanceId: string,
  source: InventoryArmorSource
): IInventoryArmor {
  const item: IInventoryArmor = Object.assign(
    {
      id: -1,
      itemInstanceId,
      mayBeBugged: false,
      statPlugHashes: [],
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
  return item;
}
