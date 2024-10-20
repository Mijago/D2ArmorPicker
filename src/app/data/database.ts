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

import Dexie from "dexie";
import { IManifestArmor } from "./types/IManifestArmor";
import { IInventoryArmor } from "./types/IInventoryArmor";
import { IManifestCollectible } from "./types/IManifestCollectible";
import { IVendorInfo } from "./types/IVendorInfo";

export class Database extends Dexie {
  manifestArmor!: Dexie.Table<IManifestArmor, number>;
  inventoryArmor!: Dexie.Table<IInventoryArmor, number>;

  // Maps the collectible hash to the inventory item hash
  manifestCollectibles!: Dexie.Table<IManifestCollectible>;
  // Maps the vendor id to the vendor name
  vendorNames!: Dexie.Table<IVendorInfo, number>;

  constructor() {
    super("d2armorpicker-v2");
    this.version(26).stores({
      manifestArmor: "id++, hash, isExotic",
      inventoryArmor:
        "id++, itemInstanceId, isExotic, hash, name, masterworked, clazz, slot, source",
      manifestCollectibles: "id++, hash",
      vendorNames: "id++, vendorId",
    });
  }
}
