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
import { ClassExoticInfo, InventoryService } from "../../../../services/inventory.service";
import { ConfigurationService } from "../../../../services/configuration.service";
import { animate, query, stagger, style, transition, trigger } from "@angular/animations";
import { ArmorSlot } from "../../../../data/enum/armor-slot";
import { FORCE_USE_NO_EXOTIC } from "../../../../data/constants";
import { debounceTime, takeUntil } from "rxjs/operators";
import { Subject } from "rxjs";
import { DestinyClass } from "bungie-api-ts/destiny2";

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
  includeCollectionRolls = false;
  includeVendorRolls = false;
  ignoreSunsetArmor = false;
  allowBlueArmorPieces = false;
  currentClass: DestinyClass = DestinyClass.Unknown;
  exotics: ClassExoticInfo[][] = [];

  constructor(
    public inventory: InventoryService,
    public config: ConfigurationService
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
      this.ignoreSunsetArmor = c.ignoreSunsetArmor;
      this.allowBlueArmorPieces = c.allowBlueArmorPieces;
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

  setIgnoreSunsetArmor(ignore: boolean) {
    this.config.modifyConfiguration((c) => {
      c.ignoreSunsetArmor = ignore;
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
    });
  }

  async refreshAll() {
    await this.inventory.refreshAll(true, true);
  }

  private ngUnsubscribe = new Subject();

  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }
}
