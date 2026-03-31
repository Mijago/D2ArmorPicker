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

import { Injectable, OnDestroy } from "@angular/core";
import { LoggingProxyService } from "./logging-proxy.service";
import { AuthService } from "./auth.service";
import { D2APDatabase } from "../data/database";
import { IManifestArmor } from "../data/types/IManifestArmor";
import { ChangelogService } from "./changelog.service";
import { DestinyInventoryItemDefinition } from "bungie-api-ts/destiny2";

@Injectable({
  providedIn: "root",
})
export class DatabaseService extends D2APDatabase implements OnDestroy {
  constructor(
    private auth: AuthService,
    private changelog: ChangelogService,
    private logger: LoggingProxyService
  ) {
    super();
    this.logger.debug("DatabaseService", "constructor", "Initializing DatabaseService");

    if (this.changelog.shouldWipeManifest) {
      this.logger.info(
        "DatabaseService",
        "constructor",
        "Wiping manifest due to changelog request"
      );
      this.changelog.setlastWipeManifestVersion();
      this.clearManifestInfo();
    }

    this.version(this.verno).upgrade(async (tx) => {
      this.clearManifestInfo();
    });

    this.auth.logoutEvent.subscribe(async (k) => {
      await this.clearInventoryCache();
    });
  }

  ngOnDestroy(): void {
    this.logger.debug("DatabaseService", "ngOnDestroy", "Destroying DatabaseService");
  }

  async clearInventoryCache() {
    this.logger.debug("DatabaseService", "clearInventoryCache", "Clearing inventory cache");
    localStorage.removeItem("user-armorItems");
    localStorage.removeItem("d2ap-inventory-lastDate");
    await this.inventoryArmor.clear();
    await this.vendorItemSubscreen.clear();
  }

  private initialize() {
    this.open();
    this.clearManifestInfo();
  }

  async writeManifestArmor(items: IManifestArmor[], version: string) {
    await this.manifestArmor.clear();
    await this.manifestArmor.bulkPut(items).catch((e) => {
      this.logger.error(
        "DatabaseService",
        "writeManifestArmor",
        "Error writing manifest armor to database: " + e
      );
    });
    localStorage.setItem("d2ap-manifest-lastDate", Date.now().toString());
    localStorage.setItem("d2ap-db-lastName", this.manifestArmor.db.name);
    localStorage.setItem("d2ap-manifest-lastVersion", version);
  }

  public async clearManifestInfo() {
    localStorage.removeItem("d2ap-manifest-lastDate");
    localStorage.removeItem("d2ap-inventory-lastDate");
    localStorage.removeItem("d2ap-db-lastName");
  }

  async resetDatabase(initialize = true) {
    localStorage.removeItem("d2ap-manifest-lastDate");
    localStorage.removeItem("d2ap-db-lastName");
    localStorage.removeItem("user-vendor-nextRefreshTime");
    localStorage.removeItem("d2ap-inventory-lastDate");

    await this.delete();
    await window.indexedDB
      .databases()
      .then((dbs) => {
        dbs.forEach((idb) => {
          if (idb.name) {
            window.indexedDB.deleteDatabase(idb.name);
            this.logger.debug(
              "DatabaseService",
              "resetDatabase",
              `Deleted IndexedDB database: ${idb.name}`
            );
          }
        });
      })
      .catch((error) => {
        this.logger.error(
          "DatabaseService",
          "resetDatabase",
          "Failed to get database list or delete databases",
          error
        );
      });
    if (initialize) this.initialize();
  }

  /**
   * Returns the information about the current cached manifest version,
   * if it exists and is still valid.
   */
  lastManifestUpdate(): { updatedAt: number; version: string } | undefined {
    const lastManifestUpdate = localStorage.getItem("d2ap-manifest-lastDate");
    const lastManifestVersion = localStorage.getItem("d2ap-manifest-lastVersion");

    const lastManifestDbName = localStorage.getItem("d2ap-db-lastName");

    if (!lastManifestUpdate || !lastManifestDbName || !lastManifestVersion) {
      return;
    }

    if (lastManifestDbName !== this.name) {
      return;
    }

    const lastUpdate = parseInt(lastManifestUpdate);

    return {
      updatedAt: lastUpdate,
      version: lastManifestVersion,
    };
  }

  // Database migration helper for exoticPerkHash field
  // When loading existing data, convert single values to arrays
  migrateExoticPerkHash(item: any): void {
    if (item.exoticPerkHash !== undefined && item.exoticPerkHash !== null) {
      // If it's already an array, leave it as is
      if (Array.isArray(item.exoticPerkHash)) {
        return;
      }

      // If it's a single value, convert to array
      if (typeof item.exoticPerkHash === "number") {
        item.exoticPerkHash = [item.exoticPerkHash];
      } else {
        // If it's null or undefined, set to empty array
        item.exoticPerkHash = [];
      }
    } else {
      item.exoticPerkHash = [];
    }
  }

  async writeCharacterAbilities(abilities: DestinyInventoryItemDefinition[]) {
    await this.sandboxAbilities.clear();
    await this.sandboxAbilities.bulkPut(abilities);
  }

  async getCharacterAbilities(): Promise<DestinyInventoryItemDefinition[]> {
    return await this.sandboxAbilities.toArray();
  }

  async clearCharacterAbilities() {
    await this.sandboxAbilities.clear();
  }
}
