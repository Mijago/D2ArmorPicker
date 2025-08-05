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

import { Component, OnInit, OnDestroy } from "@angular/core";
import { NGXLogger } from "ngx-logger";
import { DestinySandboxPerkDefinition } from "bungie-api-ts/destiny2";
import { Subject } from "rxjs";
import { distinctUntilChanged, takeUntil } from "rxjs/operators";
import { FORCE_USE_NO_EXOTIC } from "src/app/data/constants";
import { ConfigurationService } from "src/app/services/configuration.service";
import { DatabaseService } from "src/app/services/database.service";
import { InventoryService } from "src/app/services/inventory.service";

interface GearSetBonus {
  perk: DestinySandboxPerkDefinition | undefined;
  enabled: boolean;
  available: boolean; // Indicates if the user has enough items to enable this bonus
}

interface GearSet {
  name: string;
  hash: number;
  twoPieceBonus: GearSetBonus;
  fourPieceBonus: GearSetBonus;
}

@Component({
  selector: "app-gearset-selection",
  templateUrl: "./gearset-selection.component.html",
  styleUrls: ["./gearset-selection.component.scss"],
})
export class GearsetSelectionComponent implements OnInit, OnDestroy {
  private refreshingGearsets = false;
  public gearSets: GearSet[] = [];
  constructor(
    private inventoryService: InventoryService,
    private db: DatabaseService,
    private config: ConfigurationService,
    private logger: NGXLogger
  ) {}
  ngOnInit(): void {
    this.inventoryService.inventory.pipe(takeUntil(this.ngUnsubscribe)).subscribe(async () => {
      await this.refreshGearSets();
      await this.refreshGearsetAvailability();
    });

    this.config.configuration
      .pipe(
        takeUntil(this.ngUnsubscribe),
        distinctUntilChanged((a, b) => {
          return a.characterClass === b.characterClass;
        })
      )
      .subscribe(async () => {
        await this.refreshGearSets();
        await this.refreshGearsetAvailability();
      });
  }

  async refreshGearsetAvailability(): Promise<void> {
    this.logger.debug(
      "GearsetSelectionComponent",
      "refreshGearsetAvailability",
      "Refreshing gear set availability"
    );
    if (this.gearSets.length === 0) {
      return;
    }

    // Check if the current character class has gear sets available
    const currentClass = this.config.readonlyConfigurationSnapshot.characterClass;

    for (const gearSet of this.gearSets) {
      // Get all inventory items for this class and gear set
      const items = await this.db.inventoryArmor
        .where({
          clazz: currentClass,
          gearSetHash: gearSet.hash,
        })
        .toArray();

      // Count how many unique slots are represented by these items
      const uniqueSlots = new Set(items.map((item) => item.slot));
      gearSet.twoPieceBonus.available = uniqueSlots.size >= 2;
      gearSet.fourPieceBonus.available = uniqueSlots.size >= 4;

      if (!gearSet.twoPieceBonus.available) gearSet.twoPieceBonus.enabled = false;
      if (!gearSet.fourPieceBonus.available) gearSet.fourPieceBonus.enabled = false;
    }
    this.updateConfiguration();
  }

  /**
   * Refreshes the gearSets array from the database and sorts them by name.
   */
  private async refreshGearSets(): Promise<void> {
    if (this.refreshingGearsets) return;
    this.refreshingGearsets = true;

    const gearsets = await this.db.equipableItemSetDefinition.toArray();
    gearsets.sort((a, b) => {
      // Sort by name, case-insensitive
      const nameA = a.displayProperties.name?.toLowerCase() || "";
      const nameB = b.displayProperties.name?.toLowerCase() || "";
      return nameA.localeCompare(nameB);
    });
    for (const gearset of gearsets) {
      if (this.gearSets.some((gs) => gs.hash === gearset.hash)) {
        // If the gearset is already in the list, skip it
        continue;
      }

      const twoPieceBonusInfo =
        gearset.setPerks.find((perk) => perk.requiredSetCount == 2)?.sandboxPerkHash || 0;
      const twoPieceBonusData = await this.db.sandboxPerkDefinition
        .where({ hash: twoPieceBonusInfo })
        .first();

      const fourPieceBonusInfo =
        gearset.setPerks.find((perk) => perk.requiredSetCount == 4)?.sandboxPerkHash || 0;
      const fourPieceBonusData = await this.db.sandboxPerkDefinition
        .where({ hash: fourPieceBonusInfo })
        .first();

      const configCount = this.config.readonlyConfigurationSnapshot.armorRequirements.filter(
        (req) => "gearSetHash" in req && req.gearSetHash === gearset.hash
      ).length;

      const newEntry = {
        name: gearset.displayProperties.name || "Unknown Gear Set",
        hash: gearset.hash,
        twoPieceBonus: {
          perk: twoPieceBonusData,
          enabled: configCount == 2,
          available: false,
        },
        fourPieceBonus: {
          perk: fourPieceBonusData,
          enabled: configCount == 4,
          available: false,
        },
      };

      let insertIndex = this.gearSets.findIndex((gs) => gs.name.localeCompare(newEntry.name) > 0);
      if (insertIndex === -1) {
        this.gearSets.push(newEntry);
      } else {
        this.gearSets.splice(insertIndex, 0, newEntry);
      }
    }
    this.refreshingGearsets = false;
  }

  get hasTwoPieceSelected(): boolean {
    return this.gearSets.some((gearSet) => gearSet.twoPieceBonus.enabled);
  }

  get selectedTwoPieceCount(): number {
    return this.gearSets.reduce(
      (count, gearSet) => count + (gearSet.twoPieceBonus.enabled ? 1 : 0),
      0
    );
  }

  onTwoPieceBonusChange(gearSetIndex: number, enabled?: boolean) {
    if (this.gearSets[gearSetIndex].twoPieceBonus.available === false) {
      this.gearSets[gearSetIndex].twoPieceBonus.enabled = false;
      return;
    }

    if (enabled === undefined) enabled = !this.gearSets[gearSetIndex].twoPieceBonus.enabled;
    if (this.selectedTwoPieceCount >= 2 && enabled) {
      return;
    }
    this.gearSets[gearSetIndex].twoPieceBonus.enabled = enabled;

    // If we now have 2 two-piece bonuses selected, disable all 4-piece bonuses
    if (this.selectedTwoPieceCount > 0) {
      this.gearSets.forEach((gearSet) => {
        gearSet.fourPieceBonus.enabled = false;
      });
    }
    this.updateConfiguration();
  }

  onFourPieceBonusChange(gearSetIndex: number, enabled?: boolean) {
    if (this.gearSets[gearSetIndex].fourPieceBonus.available === false) {
      this.gearSets[gearSetIndex].fourPieceBonus.enabled = false;
      return;
    }

    if (enabled === undefined) enabled = !this.gearSets[gearSetIndex].fourPieceBonus.enabled;

    this.gearSets[gearSetIndex].fourPieceBonus.enabled = enabled;

    // If enabling a 4-piece bonus, disable all other 4-piece bonuses and all 2-piece bonuses
    if (enabled) {
      this.gearSets.forEach((gearSet, gsIndex) => {
        gearSet.twoPieceBonus.enabled = false;
        if (gsIndex !== gearSetIndex) gearSet.fourPieceBonus.enabled = false;
      });
    }
    this.updateConfiguration();
  }

  private updateConfiguration() {
    this.config.modifyConfiguration((c) => {
      this.gearSets.forEach((gearSet) => {
        // remove existing requirements for this gear set
        c.armorRequirements = c.armorRequirements.filter(
          (req) => !("gearSetHash" in req && req.gearSetHash === gearSet.hash)
        );

        let amount = 0;
        if (gearSet.twoPieceBonus.enabled) {
          amount = 2;
        } else if (gearSet.fourPieceBonus.enabled) {
          amount = 4;
        }
        for (let i = 0; i < amount; i++) {
          c.armorRequirements.unshift({ gearSetHash: gearSet.hash });
        }
      });

      let maximumModSlots = 5;
      if (c.selectedExotics.length > 0 && c.selectedExotics[0] !== FORCE_USE_NO_EXOTIC)
        maximumModSlots = 4;

      c.armorRequirements = c.armorRequirements.slice(0, maximumModSlots);
    });
  }

  isFourPieceDisabled(): boolean {
    return this.hasTwoPieceSelected;
  }

  private ngUnsubscribe = new Subject();

  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }
}
