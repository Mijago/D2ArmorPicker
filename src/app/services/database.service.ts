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

import { Injectable } from "@angular/core";
import Dexie from "dexie";
import { AuthService } from "./auth.service";
import { buildDb } from "../data/database";
import { IManifestArmor } from "../data/types/IManifestArmor";
import { IInventoryArmor } from "../data/types/IInventoryArmor";

@Injectable({
  providedIn: "root",
})
export class DatabaseService {
  private db: Dexie;

  public manifestArmor: Dexie.Table<IManifestArmor, number>;
  public inventoryArmor: Dexie.Table<IInventoryArmor, number>;

  constructor(private auth: AuthService) {
    this.db = buildDb(async () => {
      await this.auth.clearManifestInfo();
    });
    this.manifestArmor = this.db.table("manifestArmor");
    this.inventoryArmor = this.db.table("inventoryArmor");

    this.auth.logoutEvent.subscribe(async (k) => {
      await this.clearDatabase();
    });
  }

  private initialize() {
    this.db = buildDb(async () => {
      await this.auth.clearManifestInfo();
    });
    this.manifestArmor = this.db.table("manifestArmor");
    this.inventoryArmor = this.db.table("inventoryArmor");
  }

  private async clearDatabase() {
    localStorage.removeItem("LastManifestUpdate");
    localStorage.removeItem("LastArmorUpdate");
    await this.inventoryArmor.clear();
  }

  async resetDatabase(initialize = true) {
    localStorage.removeItem("LastManifestUpdate");
    localStorage.removeItem("last-manifest-revision");
    localStorage.removeItem("last-manifest-db-name");

    localStorage.removeItem("LastArmorUpdate");
    localStorage.removeItem("last-armor-db-name");

    await this.db.delete();
    if (initialize) this.initialize();
  }
}
