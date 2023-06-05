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

import { Component, Input, OnInit, TemplateRef } from "@angular/core";
import { ResultItem } from "../../results/results.component";
import { ArmorStat, ArmorStatNames } from "../../../../data/enum/armor-stat";
import { InventoryArmorSource } from "src/app/data/types/IInventoryArmor";

@Component({
  selector: "app-armor-tooltip-component",
  templateUrl: "./armor-tooltip.component.html",
  styleUrls: ["./armor-tooltip.component.css"],
})
export class ArmorTooltipComponent {
  @Input() itemTooltip: ResultItem | undefined;

  getSourceText() {
    switch (this.itemTooltip?.source) {
      case InventoryArmorSource.Collections:
        return "Collections";

      default:
        return "Inventory";
    }
  }

  getArmorStatName(i: number) {
    return ArmorStatNames[i as ArmorStat];
  }

  getWidth(stat: number) {
    return Math.min(100, (stat / 32) * 100) + "%";
  }

  constructor() {}
}
