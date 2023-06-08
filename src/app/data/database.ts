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

export function buildDb(onUpgrade: () => void) {
  const db = new Dexie("d2armorpicker-v2");

  // Declare tables, IDs and indexes
  db.version(23)
    .stores({
      manifestArmor: "id++, hash, isExotic",
      inventoryArmor:
        "id++, itemInstanceId, isExotic, hash, name, masterworked, clazz, slot, source",
      manifestCollectibles: "id++, hash",
    })
    .upgrade(async (tx) => {
      await onUpgrade();
    });

  return db;
}
