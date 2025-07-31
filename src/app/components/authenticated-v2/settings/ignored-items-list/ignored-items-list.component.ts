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
import { ConfigurationService } from "../../../../services/configuration.service";
import { DatabaseService } from "../../../../services/database.service";
import {
  IDisplayInventoryArmor,
  InventoryArmorSource,
} from "../../../../data/types/IInventoryArmor";
import { Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";
import { DestinyClass, TierType } from "bungie-api-ts/destiny2";
import { ArmorSlot } from "src/app/data/enum/armor-slot";

@Component({
  selector: "app-ignored-items-list",
  templateUrl: "./ignored-items-list.component.html",
  styleUrls: ["./ignored-items-list.component.scss"],
})
export class IgnoredItemsListComponent implements OnInit, OnDestroy {
  disabledItems: IDisplayInventoryArmor[][] = [];
  characterClass: DestinyClass | null = null;

  constructor(
    private config: ConfigurationService,
    private db: DatabaseService
  ) {}

  enableItem(instanceId: string) {
    this.config.modifyConfiguration((cb) => {
      cb.disabledItems.splice(cb.disabledItems.indexOf(instanceId), 1);
    });
  }

  generateTooltip(armor: IDisplayInventoryArmor) {
    return (
      "Click this icon to activate this item again.\r\n" +
      "" +
      armor.name +
      "  " +
      "Base: " +
      armor.mobility +
      "/" +
      "" +
      armor.resilience +
      "/" +
      "" +
      armor.recovery +
      "/" +
      "" +
      armor.discipline +
      "/" +
      "" +
      armor.intellect +
      "/" +
      "" +
      armor.strength
    );
  }

  ngOnInit(): void {
    this.config.configuration.pipe(takeUntil(this.ngUnsubscribe)).subscribe(async (cb) => {
      this.characterClass = null;
      const newDisabledItems: IDisplayInventoryArmor[][] = [[], [], [], [], [], []];

      let items = [];
      for (let hash of cb.disabledItems) {
        let itemInstance = (await this.db.inventoryArmor
          .where("itemInstanceId")
          .equals(hash)
          .first()) as IDisplayInventoryArmor;
        if (!itemInstance)
          itemInstance = {
            id: 0,
            hash: 0,
            tier: 1,
            itemInstanceId: hash,
            energyLevel: 0,
            armorSystem: 3, // Default to Armor 3.0
            name: "Missing Armor",
            icon: "/common/destiny2_content/icons/763634b78eb22168ac707500588b7333.jpg",
            description: "This armor has been deleted",
            masterworkLevel: 0,
            archetypeStats: [],
            clazz: DestinyClass.Unknown,
            slot: ArmorSlot.ArmorSlotNone,
            isExotic: 0,
            isFeatured: false,
            rarity: TierType.Unknown,
            source: InventoryArmorSource.Inventory,
            gearSetHash: null,
            mobility: 0,
            resilience: 0,
            recovery: 0,
            discipline: 0,
            intellect: 0,
            strength: 0,
          };
        items.push(itemInstance);
      }

      for (let item of items) {
        //if (item.clazz != this.characterClass) continue;
        newDisabledItems[item.slot].push(item);
      }

      this.characterClass = cb.characterClass;

      for (let row of newDisabledItems) {
        row.sort((a, b) => a.hash - b.hash);
      }
      this.disabledItems = newDisabledItems;
    });
  }

  private ngUnsubscribe = new Subject();

  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }
}
