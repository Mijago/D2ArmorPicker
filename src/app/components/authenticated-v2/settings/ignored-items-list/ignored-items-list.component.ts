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
import { IInventoryArmor } from "../../../../data/types/IInventoryArmor";
import { Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";

@Component({
  selector: "app-ignored-items-list",
  templateUrl: "./ignored-items-list.component.html",
  styleUrls: ["./ignored-items-list.component.scss"],
})
export class IgnoredItemsListComponent implements OnInit, OnDestroy {
  disabledItems: IInventoryArmor[] = [];

  constructor(private config: ConfigurationService, private db: DatabaseService) {}

  enableItem(instanceId: string) {
    this.config.modifyConfiguration((cb) => {
      cb.disabledItems.splice(cb.disabledItems.indexOf(instanceId), 1);
    });
  }

  generateTooltip(armor: IInventoryArmor) {
    return (
      "Click this icon to activate this item again.\r\n" +
      "" +
      armor.name +
      "  " +
      "" +
      (armor.mobility + (armor.masterworked ? 2 : 0)) +
      "/" +
      "" +
      (armor.resilience + (armor.masterworked ? 2 : 0)) +
      "/" +
      "" +
      (armor.recovery + (armor.masterworked ? 2 : 0)) +
      "/" +
      "" +
      (armor.discipline + (armor.masterworked ? 2 : 0)) +
      "/" +
      "" +
      (armor.intellect + (armor.masterworked ? 2 : 0)) +
      "/" +
      "" +
      (armor.strength + (armor.masterworked ? 2 : 0))
    );
  }

  ngOnInit(): void {
    this.config.configuration.pipe(takeUntil(this.ngUnsubscribe)).subscribe(async (cb) => {
      let items = [];
      for (let hash of cb.disabledItems) {
        let itemInstance = await this.db.inventoryArmor
          .where("itemInstanceId")
          .equals(hash)
          .first();
        if (itemInstance) items.push(itemInstance);
      }
      this.disabledItems = items;
    });
  }

  private ngUnsubscribe = new Subject();

  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }
}
