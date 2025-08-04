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
import { NGXLogger } from "ngx-logger";
import { AuthService } from "./auth.service";
import { Database } from "../data/database";
import { IManifestArmor } from "../data/types/IManifestArmor";
import { environment } from "../../environments/environment";
import { ChangelogService } from "./changelog.service";

@Injectable({
  providedIn: "root",
})
export class DatabaseService extends Database {
  constructor(
    private auth: AuthService,
    private changelog: ChangelogService,
    private logger: NGXLogger
  ) {
    super();

    if (this.changelog.wipeManifest) {
      this.logger.log("Wiping manifest due to changelog request");
      this.auth.clearManifestInfo();
    }

    this.version(this.verno).upgrade(async (tx) => {
      this.auth.clearManifestInfo();
    });

    this.auth.logoutEvent.subscribe(async (k) => {
      await this.clearDatabase();
    });
  }

  private initialize() {
    this.open();
    this.auth.clearManifestInfo();
  }

  async writeManifestArmor(items: IManifestArmor[], version: string) {
    await this.manifestArmor.clear();
    await this.manifestArmor.bulkPut(items);
    localStorage.setItem("LastManifestUpdate", Date.now().toString());
    localStorage.setItem("last-manifest-db-name", this.manifestArmor.db.name);
    localStorage.setItem("last-manifest-revision", environment.revision);
    localStorage.setItem("last-manifest-version", version);
  }

  private async clearDatabase() {
    localStorage.removeItem("LastManifestUpdate");
    localStorage.removeItem("LastArmorUpdate");
    localStorage.removeItem("last-manifest-revision");
    localStorage.removeItem("last-manifest-db-name");
    await this.inventoryArmor.clear();
  }

  async resetDatabase(initialize = true) {
    localStorage.removeItem("LastManifestUpdate");
    localStorage.removeItem("last-manifest-revision");
    localStorage.removeItem("last-manifest-db-name");
    localStorage.removeItem("vendor-next-refresh-time");

    localStorage.removeItem("LastArmorUpdate");
    localStorage.removeItem("last-armor-db-name");

    await this.delete();
    if (initialize) this.initialize();
  }

  /**
   * Returns the information about the current cached manifest version,
   * if it exists and is still valid.
   */
  lastManifestUpdate(): { updatedAt: number; version: string } | undefined {
    const lastManifestUpdate = localStorage.getItem("LastManifestUpdate");
    const lastManifestVersion = localStorage.getItem("last-manifest-version");

    const lastManifestRevision = localStorage.getItem("last-manifest-revision");
    const lastManifestDbName = localStorage.getItem("last-manifest-db-name");

    if (
      !lastManifestUpdate ||
      !lastManifestRevision ||
      !lastManifestDbName ||
      !lastManifestVersion
    ) {
      return;
    }

    if (localStorage.getItem("last-manifest-revision") !== environment.revision) {
      return;
    }

    if (lastManifestDbName !== this.inventoryArmor.db.name) {
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
}
