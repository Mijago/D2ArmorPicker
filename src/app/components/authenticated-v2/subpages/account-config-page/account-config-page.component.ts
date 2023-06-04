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

import { Component, OnInit } from "@angular/core";
import { DatabaseService } from "../../../../services/database.service";
import { InventoryService } from "../../../../services/inventory.service";
import { AuthService } from "../../../../services/auth.service";

@Component({
  selector: "app-account-config-page",
  templateUrl: "./account-config-page.component.html",
  styleUrls: ["./account-config-page.component.css"],
})
export class AccountConfigPageComponent {
  constructor(
    private db: DatabaseService,
    public inv: InventoryService,
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
    await this.inv.refreshAll(true, true);
  }

  async resetEverything() {
    localStorage.clear();
    await this.db.resetDatabase();
    await this.loginService.logout();
  }
}
