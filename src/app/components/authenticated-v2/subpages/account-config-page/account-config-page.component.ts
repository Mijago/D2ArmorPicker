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

import { Component } from "@angular/core";
import { DatabaseService } from "../../../../services/database.service";
import { UserInformationService } from "src/app/services/user-information.service";
import { AuthService } from "../../../../services/auth.service";
import { Router } from "@angular/router";
import { environment } from "../../../../../environments/environment";

@Component({
  selector: "app-account-config-page",
  templateUrl: "./account-config-page.component.html",
  styleUrls: ["./account-config-page.component.css"],
})
export class AccountConfigPageComponent {
  isDevEnvironment = !environment.production && !environment.beta && !environment.canary;

  constructor(
    private router: Router,
    private db: DatabaseService,
    public inv: UserInformationService,
    private loginService: AuthService
  ) {}

  async downloadArmorInformation() {
    const armor = await this.db.inventoryArmor.toArray();

    const url = window.URL.createObjectURL(new Blob([JSON.stringify(armor, null, 2)]));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "d2ap_armor.json");
    document.body.appendChild(link);
    link.click();
  }

  async downloadManifestInformation() {
    const data = await this.db.manifestArmor.toArray();

    const url = window.URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)]));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "d2ap_manifest.json");
    document.body.appendChild(link);
    link.click();
  }

  async resetDatabase() {
    await this.db.resetDatabase();
    await this.inv.refreshManifestAndInventory(true, true);
  }

  async downloadSystemInformation() {
    // Get localStorage key names
    const localStorageKeys = Object.keys(localStorage);

    // Get database table counts
    const tableCounts = {
      manifestArmor: await this.db.manifestArmor.count(),
      inventoryArmor: await this.db.inventoryArmor.count(),
      equipableItemSetDefinition: await this.db.equipableItemSetDefinition.count(),
      sandboxPerkDefinition: await this.db.sandboxPerkDefinition.count(),
      sandboxAbilities: await this.db.sandboxAbilities.count(),
      manifestCollectibles: await this.db.manifestCollectibles.count(),
      vendorNames: await this.db.vendorNames.count(),
      vendorItemSubscreen: await this.db.vendorItemSubscreen.count(),
    };

    const systemInfo = {
      timestamp: new Date().toISOString(),
      localStorage: {
        keyCount: localStorageKeys.length,
        keys: localStorageKeys.sort(),
      },
      database: {
        name: this.db.name,
        tables: tableCounts,
      },
    };

    const url = window.URL.createObjectURL(new Blob([JSON.stringify(systemInfo, null, 2)]));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "d2ap_system_info.json");
    document.body.appendChild(link);
    link.click();
  }

  async importArmorData(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];
    if (!file.name.endsWith(".json")) {
      alert("Please select a JSON file.");
      return;
    }

    try {
      const text = await file.text();
      const armorData = JSON.parse(text);

      if (!Array.isArray(armorData)) {
        alert("Invalid file format. Expected an array of armor items.");
        return;
      }

      // Clear existing armor data and replace with imported data
      await this.db.inventoryArmor.clear();
      await this.db.inventoryArmor.bulkPut(armorData);

      alert(`Successfully imported ${armorData.length} armor items.`);

      // Clear the input so the same file can be selected again
      input.value = "";
    } catch (error) {
      console.error("Error importing armor data:", error);
      alert("Error importing file. Please check that it's a valid d2ap_armor.json file.");
    }
  }

  triggerFileInput() {
    const fileInput = document.getElementById("armorFileInput") as HTMLInputElement;
    fileInput?.click();
  }

  async resetEverything() {
    localStorage.clear();
    await this.db.resetDatabase();
    await this.loginService.logout();
    this.router.navigate(["/login"]);
  }
}
