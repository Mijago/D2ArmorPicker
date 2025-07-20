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

import { Component, Input } from "@angular/core";
import { ResultItem } from "../../results/results.component";
import { ArmorStat, ArmorStatNames } from "../../../../data/enum/armor-stat";
import { InventoryArmorSourceNames } from "src/app/data/enum/armor-source";
import { InventoryArmorSource } from "src/app/data/types/IInventoryArmor";
import { MAXIMUM_MASTERWORK_LEVEL } from "src/app/data/constants";
import { ArmorSystem } from "src/app/data/types/IManifestArmor";

@Component({
  selector: "app-armor-tooltip-component",
  templateUrl: "./armor-tooltip.component.html",
  styleUrls: ["./armor-tooltip.component.css"],
})
export class ArmorTooltipComponent {
  @Input() itemTooltip: ResultItem | undefined;

  // Define the correct order of stats as used in the expanded-result-content component
  armorStatIds: ArmorStat[] = [
    ArmorStat.StatHealth,
    ArmorStat.StatMelee,
    ArmorStat.StatGrenade,
    ArmorStat.StatSuper,
    ArmorStat.StatClass,
    ArmorStat.StatWeapon,
  ];

  getSourceText() {
    if (!this.itemTooltip) {
      return "";
    }

    return InventoryArmorSourceNames[this.itemTooltip.source];
  }

  getArmorStatName(statId: ArmorStat) {
    return ArmorStatNames[statId];
  }

  getWidth(stat: number) {
    return Math.min(100, (stat / 32) * 100) + "%";
  }

  getTotalStats() {
    return this.itemTooltip?.stats.reduce((a, b) => a + b, 0) || 0;
  }

  getMasterworkBonus(item: ResultItem) {
    const bonus = [0, 0, 0, 0, 0, 0];

    if (item.armorSystem == ArmorSystem.Armor2) {
      // Armor 2.0
      if (item.masterworkLevel == MAXIMUM_MASTERWORK_LEVEL) {
        // Armor 2.0 Masterworked items give +2 to all stats
        for (let i = 0; i < 6; i++) {
          bonus[i] += 2;
        }
      }
      return bonus;
    } else if (item.armorSystem == ArmorSystem.Armor3) {
      // Armor 3.0
      let multiplier = item.masterworkLevel;

      if (multiplier == 0) return bonus;

      // For Armor 1.0, assume the first three stats are the archetype stats and don't get masterwork bonus
      // The OTHER THREE stats (3, 4, 5) get +1 per multiplier level
      for (let i = 0; i < 6; i++) {
        if (item.archetypeStats.indexOf(i) === -1) {
          bonus[i] += multiplier;
        }
      }

      return bonus;
    }

    return bonus;
  }

  getStatWithMasterwork(statId: ArmorStat): number {
    if (!this.itemTooltip) return 0;

    const baseValue = this.itemTooltip.stats[statId];
    const masterworkBonus = this.getMasterworkBonus(this.itemTooltip);
    return baseValue + masterworkBonus[statId];
  }

  get isVendorItem() {
    return this.itemTooltip?.source === InventoryArmorSource.Vendor;
  }
  constructor() {}
}
