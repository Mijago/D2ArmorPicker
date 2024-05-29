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
import { FORCE_USE_ANY_EXOTIC, FORCE_USE_NO_EXOTIC } from "../../../../data/constants";
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
  currentClass: DestinyClass = DestinyClass.Titan;
  exotics: ClassExoticInfo[][] = [];

  constructor(public inventory: InventoryService, public config: ConfigurationService) {}

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

    function uniq(a: ClassExoticInfo[]) {
      var seen: any = {};
      return a.filter(function (item) {
        var k = item.item.hash;
        return seen.hasOwnProperty(k) ? false : (seen[k] = true);
      });
    }

    this.exotics = [
      uniq(armors.filter((a) => a.item.slot == ArmorSlot.ArmorSlotHelmet)),
      uniq(armors.filter((a) => a.item.slot == ArmorSlot.ArmorSlotGauntlet)),
      uniq(armors.filter((a) => a.item.slot == ArmorSlot.ArmorSlotChest)),
      uniq(armors.filter((a) => a.item.slot == ArmorSlot.ArmorSlotLegs)),
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

  selectExotic(hash: number, $event: any) {
    const index = this.selectedExotics.indexOf(hash);
    if (index > -1) {
      // Always delete an item if it is already in the list
      this.selectedExotics.splice(index, 1);
    } else if (
      hash == FORCE_USE_NO_EXOTIC ||
      (this.selectedExotics.indexOf(FORCE_USE_NO_EXOTIC) != -1 && $event.shiftKey)
    ) {
      this.selectedExotics = [FORCE_USE_NO_EXOTIC];
    } else if (
      hash == FORCE_USE_ANY_EXOTIC ||
      (this.selectedExotics.indexOf(FORCE_USE_ANY_EXOTIC) != -1 && $event.shiftKey)
    ) {
      this.selectedExotics = [FORCE_USE_ANY_EXOTIC];
    } else if (this.selectedExotics.length == 0 || !$event.shiftKey) {
      // if length is 0 or shift is NOT pressed, replace the selected exotic
      this.selectedExotics = [hash];
    } else {
      this.selectedExotics.push(hash);
    }
    this.config.modifyConfiguration((c) => {
      c.selectedExotics = this.selectedExotics;
    });
  }

  private ngUnsubscribe = new Subject();

  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }
}
