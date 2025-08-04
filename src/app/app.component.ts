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

import { AfterViewInit, Component } from "@angular/core";
import { environment } from "../environments/environment";
import { InventoryService } from "./services/inventory.service";
import { NGXLogger } from "ngx-logger";

@Component({
  selector: "app-root",
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"],
})
export class AppComponent implements AfterViewInit {
  title = "D2ArmorPicker";
  is_beta = environment.beta;
  is_canary = environment.canary;

  constructor(
    private inventoryService: InventoryService,
    private logger: NGXLogger
  ) {}
  ngAfterViewInit(): void {
    // Check if InventoryService is initialized after 2 seconds
    // if not, forcefully trigger an initial refreshAll
    setTimeout(() => {
      if (!this.inventoryService.isInitialized) {
        this.logger.warn(
          "AppComponent",
          "ngAfterViewInit",
          "InventoryService is not initialized after 2 seconds, triggering initial refreshAll."
        );
        this.inventoryService.refreshAll(true, true).catch((err) => {
          this.logger.error(
            "AppComponent",
            "ngAfterViewInit",
            "Error during initial refreshAll:",
            err
          );
        });
      }
    }, 2000);
  }
}
