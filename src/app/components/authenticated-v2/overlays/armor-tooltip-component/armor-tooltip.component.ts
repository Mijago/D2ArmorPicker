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

import { Component, Input, OnInit, ChangeDetectionStrategy } from "@angular/core";
import { ResultItem } from "../../results/results.component";
import { ArmorStat, ArmorStatNames } from "../../../../data/enum/armor-stat";
import { InventoryArmorSourceNames } from "src/app/data/enum/armor-source";
import { InventoryArmorSource } from "src/app/data/types/IInventoryArmor";
import { MAXIMUM_MASTERWORK_LEVEL } from "src/app/data/constants";
import { ArmorSystem } from "src/app/data/types/IManifestArmor";
import { DatabaseService } from "src/app/services/database.service";
import {
  ExoticClassItemPerkNames,
  ExoticClassItemSpirits,
} from "src/app/data/exotic-class-item-spirits";

@Component({
  selector: "app-armor-tooltip-component",
  templateUrl: "./armor-tooltip.component.html",
  styleUrls: ["./armor-tooltip.component.css"],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class ArmorTooltipComponent implements OnInit {
  @Input() itemTooltip: ResultItem | undefined;
  @Input() comparisonTooltip: ResultItem | undefined;
  @Input() comparisonLabel: string | undefined;

  armorStatIds = Object.values(ArmorStat).filter(
    (value) => typeof value === "number"
  ) as ArmorStat[];

  private gearSetNameLookup = new Map<number, string>();

  constructor(private db: DatabaseService) {}

  ngOnInit(): void {
    void this.loadGearSetNames();
  }

  private async loadGearSetNames(): Promise<void> {
    const gearSets = await this.db.equipableItemSetDefinition.toArray();
    for (const gearSet of gearSets) {
      this.gearSetNameLookup.set(gearSet.hash, gearSet.displayProperties?.name ?? "");
    }
  }

  getSourceText(item: ResultItem | undefined = this.itemTooltip) {
    if (!item) {
      return "";
    }

    return InventoryArmorSourceNames[item.source];
  }

  getGearsetName(item: ResultItem | undefined): string {
    if (!item || item.gearSetHash == null) {
      return "";
    }

    return this.gearSetNameLookup.get(item.gearSetHash) ?? "";
  }

  getTuningStatName(item: ResultItem | undefined): string {
    if (!item || item.tuningStat == null) {
      return "";
    }

    return ArmorStatNames[item.tuningStat];
  }

  getExoticClassItemPerks(item: ResultItem | undefined): string[] | undefined {
    if (!item?.exotic || (item.exoticPerkHash?.length ?? 0) < 2) return undefined;
    return item
      .exoticPerkHash!.slice(0, 2)
      .map(
        (hash) =>
          ExoticClassItemPerkNames[hash as ExoticClassItemSpirits] || `Unknown perk (${hash})`
      );
  }

  getUsedByCount(item: ResultItem | undefined): number {
    return item?.usedByCount ?? 0;
  }

  hasUsedByCount(item: ResultItem | undefined): boolean {
    return item?.usedByCount !== undefined;
  }

  getArmorStatName(statId: ArmorStat) {
    return ArmorStatNames[statId];
  }

  getWidth(stat: number) {
    return Math.min(100, (stat / 32) * 100) + "%";
  }

  getTotalStats(item: ResultItem | undefined = this.itemTooltip) {
    return item?.stats.reduce((a, b) => a + b, 0) || 0;
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

  getStatWithMasterwork(item: ResultItem | undefined, statId: ArmorStat): number {
    if (!item) return 0;

    const baseValue = item.stats[statId];
    const masterworkBonus = this.getMasterworkBonus(item);
    return baseValue + masterworkBonus[statId];
  }

  isVendorItem(item: ResultItem | undefined = this.itemTooltip) {
    return item?.source === InventoryArmorSource.Vendor;
  }
}
