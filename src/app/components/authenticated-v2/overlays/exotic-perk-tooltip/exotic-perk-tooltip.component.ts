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
import { ResultItem } from "../../results/results.component";
import { IInventoryArmor } from "../../../../data/types/IInventoryArmor";
import { IManifestArmor } from "../../../../data/types/IManifestArmor";
import { InventoryService } from "../../../../services/inventory.service";
import { ItemIconServiceService } from "../../../../services/item-icon-service.service";

@Component({
  selector: "app-exotic-perk-tooltip",
  templateUrl: "./exotic-perk-tooltip.component.html",
  styleUrls: ["./exotic-perk-tooltip.component.css"],
})
export class ExoticPerkTooltipComponent implements OnInit {
  @Input() armor: IManifestArmor | undefined;
  @Input() vendor: boolean = false;
  @Input() collection: boolean = false;

  exoticPerk: IManifestArmor | undefined;
  exoticPerkNotThere: boolean = false;

  constructor(public inv: InventoryService, public iconService: ItemIconServiceService) {}

  async ngOnInit() {
    this.exoticPerk = await this.iconService.getItemCached(this.armor?.exoticPerkHash ?? 0);
    this.exoticPerkNotThere = this.exoticPerk == null;
  }
}
