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
