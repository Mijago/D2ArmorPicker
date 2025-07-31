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

import { Component, Input, OnInit } from "@angular/core";
import { InventoryService } from "../../../../services/inventory.service";
import { ItemIconServiceService } from "../../../../services/item-icon-service.service";
import { DestinySandboxPerkDefinition } from "bungie-api-ts/destiny2";

@Component({
  selector: "app-gearset-tooltip",
  templateUrl: "./gearset-tooltip.component.html",
  styleUrls: ["./gearset-tooltip.component.css"],
})
export class GearsetTooltipComponent implements OnInit {
  @Input() gearset: DestinySandboxPerkDefinition | undefined;

  iconUrl: string | undefined;

  constructor(
    public inv: InventoryService,
    public iconService: ItemIconServiceService
  ) {}

  async ngOnInit() {
    this.iconUrl = this.gearset?.displayProperties?.icon;
  }
}
