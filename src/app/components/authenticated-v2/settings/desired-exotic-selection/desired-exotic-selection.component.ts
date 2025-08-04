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

import { Component, OnDestroy, OnInit } from "@angular/core";
import { NGXLogger } from "ngx-logger";
import { ClassExoticInfo, InventoryService } from "../../../../services/inventory.service";
import { ConfigurationService } from "../../../../services/configuration.service";
import { BungieApiService } from "../../../../services/bungie-api.service";
import { animate, query, stagger, style, transition, trigger } from "@angular/animations";
import { ArmorSlot } from "../../../../data/enum/armor-slot";
import { FORCE_USE_NO_EXOTIC } from "../../../../data/constants";
import { debounceTime, takeUntil } from "rxjs/operators";
import { Subject } from "rxjs";
import { DestinyClass } from "bungie-api-ts/destiny2";
import { ArmorPerkOrSlot } from "../../../../data/enum/armor-stat";
import {
  ExoticClassItemPerkNames,
  ExoticClassItemSpirits,
} from "../../../../data/exotic-class-item-spirits";

export const listAnimation = trigger("listAnimation", [
  transition("* <=> *", [
    query(
      ":enter",
      [style({ opacity: 0 }), stagger("30ms", animate("350ms ease-out", style({ opacity: 1 })))],
      { optional: true }
    ),
  ]),
]);

@Component({
  selector: "app-desired-exotic-selection",
  templateUrl: "./desired-exotic-selection.component.html",
  styleUrls: ["./desired-exotic-selection.component.scss"],
  animations: [listAnimation],
})
export class DesiredExoticSelectionComponent implements OnInit, OnDestroy {
  selectedExotics: number[] = [];
  selectedExoticPerks: ArmorPerkOrSlot[] = [ArmorPerkOrSlot.Any, ArmorPerkOrSlot.Any];
  includeCollectionRolls = false;
  includeVendorRolls = false;
  ignoreSunsetArmor = false;
  allowBlueArmorPieces = false;
  allowLegacyLegendaryArmor = false;
  allowLegacyExoticArmor: boolean = false;
  enforceFeaturedLegendaryArmor = false;
  enforceFeaturedExoticArmor: boolean = false;
  currentClass: DestinyClass = DestinyClass.Unknown;
  exotics: ClassExoticInfo[][] = [];
  importEquippedExoticInProgress = false;

  anyPerkValue = ArmorPerkOrSlot.Any;
  availableFirstPerks: { name: string; value: ArmorPerkOrSlot }[] = [];
  availableSecondPerks: { name: string; value: ArmorPerkOrSlot }[] = [];

  constructor(
    public inventory: InventoryService,
    public config: ConfigurationService,
    private bungieApi: BungieApiService,
    private logger: NGXLogger
  ) {}

  ngOnInit(): void {
    this.config.configuration.pipe(takeUntil(this.ngUnsubscribe)).subscribe(async (c) => {
      if (c.characterClass != this.currentClass || this.exotics.length == 0) {
        this.currentClass = c.characterClass;
        await this.updateExoticsForClass();
      }
      this.includeCollectionRolls = c.includeCollectionRolls;
      this.includeVendorRolls = c.includeVendorRolls;
      this.selectedExotics = c.selectedExotics;
      this.selectedExoticPerks = c.selectedExoticPerks;
      this.ignoreSunsetArmor = c.ignoreSunsetArmor;
      this.allowBlueArmorPieces = c.allowBlueArmorPieces;
      this.allowLegacyLegendaryArmor = c.allowLegacyLegendaryArmor;
      this.allowLegacyExoticArmor = c.allowLegacyExoticArmor;
      this.enforceFeaturedLegendaryArmor = c.enforceFeaturedLegendaryArmor;
      this.enforceFeaturedExoticArmor = c.enforceFeaturedExoticArmor;
    });

    this.inventory.manifest
      .pipe(debounceTime(10), takeUntil(this.ngUnsubscribe))
      .subscribe(async () => {
        await this.updateExoticsForClass();
      });
    this.inventory.inventory
      .pipe(debounceTime(10), takeUntil(this.ngUnsubscribe))
      .subscribe(async () => {
        await this.updateExoticsForClass();
      });
  }

  private async updateExoticsForClass() {
    const armors = await this.inventory.getExoticsForClass(this.currentClass);

    this.exotics = [
      armors.filter((a) => a.items[0].slot == ArmorSlot.ArmorSlotHelmet),
      armors.filter((a) => a.items[0].slot == ArmorSlot.ArmorSlotGauntlet),
      armors.filter((a) => a.items[0].slot == ArmorSlot.ArmorSlotChest),
      armors.filter((a) => a.items[0].slot == ArmorSlot.ArmorSlotLegs),
      armors.filter((a) => a.items[0].slot == ArmorSlot.ArmorSlotClass),
    ];

    // Update available exotic class item perks
    this.updateAvailableExoticClassItemPerks();
  }

  private updateAvailableExoticClassItemPerks() {
    const classItemExotics = this.exotics[4]; // Class items are at index 4
    const firstPerks = new Set<number>();
    const secondPerks = new Set<number>();

    // Collect first and second perks separately from exotic class items
    classItemExotics.forEach((exotic) => {
      exotic.instances.forEach((item) => {
        // Exotic class items have exactly two perks in exoticPerkHash array
        if (item.exoticPerkHash && item.exoticPerkHash.length >= 2) {
          // Add first perk (left dropdown)
          firstPerks.add(item.exoticPerkHash[0]);
          // Add second perk (right dropdown)
          secondPerks.add(item.exoticPerkHash[1]);
        }
      });
    });

    // Convert first perk hashes to display format
    this.availableFirstPerks = Array.from(firstPerks)
      .map((perkHash) => ({
        name:
          ExoticClassItemPerkNames[perkHash as ExoticClassItemSpirits] ||
          `Unknown Perk ${perkHash}`,
        value: perkHash as ArmorPerkOrSlot,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    // Convert second perk hashes to display format
    this.availableSecondPerks = Array.from(secondPerks)
      .map((perkHash) => ({
        name:
          ExoticClassItemPerkNames[perkHash as ExoticClassItemSpirits] ||
          `Unknown Perk ${perkHash}`,
        value: perkHash as ArmorPerkOrSlot,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    this.logger.debug(
      "DesiredExoticSelectionComponent",
      "updateAvailableExoticClassItemPerks",
      "Available first perks: " + JSON.stringify(this.availableFirstPerks)
    );
    this.logger.debug(
      "DesiredExoticSelectionComponent",
      "updateAvailableExoticClassItemPerks",
      "Available second perks: " + JSON.stringify(this.availableSecondPerks)
    );
  }

  hasSelectedExoticClassItem(): boolean {
    const classItemExotics = this.exotics[4] || [];
    return classItemExotics.some((exotic) =>
      exotic.items.some((item) => this.selectedExotics.includes(item.hash))
    );
  }

  setExoticPerk(index: number, perk: ArmorPerkOrSlot) {
    this.config.modifyConfiguration((c) => {
      c.selectedExoticPerks[index] = perk;
    });
  }

  setAllowCollectionRolls(allow: boolean) {
    this.config.modifyConfiguration((c) => {
      c.includeCollectionRolls = allow;
    });
  }

  setAllowVendorItems(allow: boolean) {
    this.config.modifyConfiguration((c) => {
      c.includeVendorRolls = allow;
    });
  }

  setAllowBlueArmorPieces(allow: boolean) {
    this.config.modifyConfiguration((c) => {
      c.allowBlueArmorPieces = allow;
    });
  }

  setAllowLegacyLegendaryArmor(allow: boolean) {
    this.config.modifyConfiguration((c) => {
      c.allowLegacyLegendaryArmor = allow;
    });
  }

  setAllowLegacyExoticArmor(allow: boolean) {
    this.config.modifyConfiguration((c) => {
      c.allowLegacyExoticArmor = allow;
    });
  }

  setIgnoreSunsetArmor(ignore: boolean) {
    this.config.modifyConfiguration((c) => {
      c.ignoreSunsetArmor = ignore;
    });
  }

  setEnforceFeaturedLegendaryArmor(enforce: boolean) {
    this.config.modifyConfiguration((c) => {
      c.enforceFeaturedLegendaryArmor = enforce;
    });
  }

  setEnforceFeaturedExoticArmor(enforce: boolean) {
    this.config.modifyConfiguration((c) => {
      c.enforceFeaturedExoticArmor = enforce;
    });
  }

  getHashesForExotic(exotic: ClassExoticInfo): number[] {
    if (exotic.items.length == 0) return [];
    if (exotic.items[0].hash == FORCE_USE_NO_EXOTIC) return [FORCE_USE_NO_EXOTIC];
    return exotic.items.map((x) => x.hash);
  }

  selectExotic(hashes: number[], $event: any) {
    const anyHashSelected = hashes.some((hash) => this.selectedExotics.indexOf(hash) > -1);
    if (anyHashSelected) {
      // remove all of them
      this.selectedExotics = this.selectedExotics.filter((x) => hashes.indexOf(x) == -1);
    } else if (hashes.length > 0 && hashes[0] == FORCE_USE_NO_EXOTIC) {
      // Otherwise, add the hashes to the selection
      this.selectedExotics = hashes;
    } else {
      this.selectedExotics = hashes;
    }
    this.config.modifyConfiguration((c) => {
      c.selectedExotics = this.selectedExotics;

      // Reset exotic perks to Any when no exotic class item is selected
      if (!this.hasSelectedExoticClassItem()) {
        c.selectedExoticPerks = [ArmorPerkOrSlot.Any, ArmorPerkOrSlot.Any];
        this.selectedExoticPerks = [ArmorPerkOrSlot.Any, ArmorPerkOrSlot.Any];
      }
    });
  }

  async refreshAll() {
    await this.inventory.refreshAll(true, true);
  }

  async importEquippedExotic() {
    this.importEquippedExoticInProgress = true;
    try {
      await this.bungieApi.importCurrentlyEquippedExotic();
    } catch (error) {
      this.logger.error(
        "DesiredExoticSelectionComponent",
        "importEquippedExotic",
        "Error importing equipped exotic: " + error
      );
    } finally {
      this.importEquippedExoticInProgress = false;
    }
  }

  private ngUnsubscribe = new Subject();

  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }
}
