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
import { Subject } from "rxjs";
import { debounceTime, takeUntil } from "rxjs/operators";
import { InventoryService } from "../../../../services/inventory.service";
import { IInventoryArmor, InventoryArmorSource } from "../../../../data/types/IInventoryArmor";
import { DatabaseService } from "../../../../services/database.service";
import { IManifestArmor } from "../../../../data/types/IManifestArmor";
import { ArmorSlot } from "../../../../data/enum/armor-slot";

type LocalArmorInfo = {
  isSunset: boolean;
  slot: ArmorSlot;
  totalSum: number;
  totalStats: number[];
  itemInstanceId: string;
  mobility: number[];
  intellect: number[];
  strength: number[];
  statPlugHashes: number[];
  name: string;
  recovery: number[];
  discipline: number[];
  resilience: number[];
  hash: number;
};

@Component({
  selector: "app-armor-investigation-page",
  templateUrl: "./armor-investigation-page.component.html",
  styleUrls: ["./armor-investigation-page.component.css"],
})
export class ArmorInvestigationPageComponent implements OnInit, OnDestroy {
  minWeapon: number | null = 0;
  minHealth: number | null = 0;
  minClass: number | null = 0;
  minGrenade: number | null = 0;
  minSuper: number | null = 0;
  minMelee: number | null = 0;
  anyPlugWithN: number | null = 0;
  anyPlugBelowN: number | null = 17;
  allPlugsWithN: number | null = 0;
  allPlugsBelowN: number | null = 17;

  armorName: string | null = "";
  armorHash: string | null = "";
  armorId: string | null = "";

  armorItemsPerSlot: Map<ArmorSlot, LocalArmorInfo[]> = new Map();

  plugData: { [p: string]: IManifestArmor } = {};

  constructor(
    public inventory: InventoryService,
    private db: DatabaseService
  ) {}

  ngOnInit(): void {
    this.inventory.inventory
      .pipe(debounceTime(10), takeUntil(this.ngUnsubscribe))
      .subscribe(async () => {
        this.updateItems();
      });
  }

  getPlugString(plugId: number) {
    var plugInfo = this.plugData[plugId];
    let info = [0, 0, 0, 0, 0, 0];
    for (let stat of plugInfo.investmentStats) {
      switch (stat.statTypeHash) {
        case 2996146975:
          info[0] += stat.value;
          break;
        case 392767087:
          info[1] += stat.value;
          break;
        case 1943323491:
          info[2] += stat.value;
          break;
        case 1735777505:
          info[3] += stat.value;
          break;
        case 144602215:
          info[4] += stat.value;
          break;
        case 4244567218:
          info[5] += stat.value;
          break;
      }
    }
    return "[" + info.join(" ") + "]";
  }

  async updateItems() {
    let manifestArmor = await this.db.manifestArmor.toArray();
    const modsData = manifestArmor.filter((d) => d.itemType == 19);
    let plugData = Object.fromEntries(modsData.map((_) => [_.hash, _]));
    this.plugData = plugData;

    let armorItems = ((await this.db.inventoryArmor.toArray()) as IInventoryArmor[])
      .filter((i) => i.source === InventoryArmorSource.Inventory)
      .sort((a, b) => ("" + a.name).localeCompare(b.name))
      .map((i: IInventoryArmor) => {
        var result = {
          name: i.name,
          hash: i.hash,
          isSunset: i.isSunset,
          itemInstanceId: i.itemInstanceId,
          statPlugHashes: i.statPlugHashes as number[],
          mobility: [] as number[],
          resilience: [] as number[],
          recovery: [] as number[],
          discipline: [] as number[],
          intellect: [] as number[],
          strength: [] as number[],
          totalStats: [0, 0, 0, 0, 0, 0],
          totalSum: 0,
          slot: i.slot,
        } as LocalArmorInfo;
        // add stat plugs
        if (i.statPlugHashes)
          for (let p of i.statPlugHashes) {
            var plugInfo = plugData[p as number];
            for (let stat of plugInfo.investmentStats) {
              switch (stat.statTypeHash) {
                case 2996146975:
                  result.mobility.push(stat.value);
                  result.totalStats[0] += stat.value;
                  break;
                case 392767087:
                  result.resilience.push(stat.value);
                  result.totalStats[1] += stat.value;
                  break;
                case 1943323491:
                  result.recovery.push(stat.value);
                  result.totalStats[2] += stat.value;
                  break;
                case 1735777505:
                  result.discipline.push(stat.value);
                  result.totalStats[3] += stat.value;
                  break;
                case 144602215:
                  result.intellect.push(stat.value);
                  result.totalStats[4] += stat.value;
                  break;
                case 4244567218:
                  result.strength.push(stat.value);
                  result.totalStats[5] += stat.value;
                  break;
              }
            }
          }

        // Intrinsics
        if (i.investmentStats) {
          for (let stat of i.investmentStats) {
            switch (stat.statTypeHash) {
              case 2996146975:
                result.mobility.push(stat.value);
                result.totalStats[0] += stat.value;
                break;
              case 392767087:
                result.resilience.push(stat.value);
                result.totalStats[1] += stat.value;
                break;
              case 1943323491:
                result.recovery.push(stat.value);
                result.totalStats[2] += stat.value;
                break;
              case 1735777505:
                result.discipline.push(stat.value);
                result.totalStats[3] += stat.value;
                break;
              case 144602215:
                result.intellect.push(stat.value);
                result.totalStats[4] += stat.value;
                break;
              case 4244567218:
                result.strength.push(stat.value);
                result.totalStats[5] += stat.value;
                break;
            }
          }
        }

        for (let s of result.totalStats) result.totalSum += s;

        return result;
      });

    armorItems = this.filterItems(armorItems);

    this.armorItemsPerSlot = armorItems.reduce((p, v) => {
      const slot = !v.slot ? 10 : v.slot;
      if (!p.has(slot)) p.set(slot, []);
      p.get(slot)?.push(v);

      return p;
    }, new Map<ArmorSlot, LocalArmorInfo[]>());
  }

  private ngUnsubscribe = new Subject();

  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }

  getCategoryName(id: number): string {
    switch (id) {
      case 1:
        return "Helmets";
      case 2:
        return "Gauntlets";
      case 3:
        return "Chest Pieces";
      case 4:
        return "Legs";
      case 5:
        return "Class Items";
    }
    return "Unknown Category";
  }

  getPlugSum(plugId: number) {
    var plugInfo = this.plugData[plugId];
    var total = 0;
    for (let stat of plugInfo.investmentStats) {
      switch (stat.statTypeHash) {
        case 2996146975:
        case 392767087:
        case 1943323491:
        case 1735777505:
        case 144602215:
        case 4244567218:
          total += stat.value;
          break;
      }
    }
    return total;
  }

  clear() {
    this.armorName = "";
    this.armorHash = "";
    this.armorId = "";

    this.minWeapon = 0;
    this.minHealth = 0;
    this.minClass = 0;
    this.minGrenade = 0;
    this.minSuper = 0;
    this.minMelee = 0;

    this.anyPlugWithN = 0;
    this.anyPlugBelowN = 17;
  }

  private filterItems(armorItems: LocalArmorInfo[]) {
    if (!!this.armorName)
      armorItems = armorItems.filter((i) => i.name.toLowerCase().indexOf(this.armorName!) > -1);
    if (!!this.armorHash)
      armorItems = armorItems.filter((i) => (i.hash || 0).toString().indexOf(this.armorHash!) > -1);
    if (!!this.armorId)
      armorItems = armorItems.filter(
        (i) => (i.itemInstanceId || 0).toString().indexOf(this.armorId!) > -1
      );

    armorItems = armorItems.filter((i) => i.totalStats[0] >= (this.minWeapon || 0));
    armorItems = armorItems.filter((i) => i.totalStats[1] >= (this.minHealth || 0));
    armorItems = armorItems.filter((i) => i.totalStats[2] >= (this.minClass || 0));
    armorItems = armorItems.filter((i) => i.totalStats[3] >= (this.minGrenade || 0));
    armorItems = armorItems.filter((i) => i.totalStats[4] >= (this.minSuper || 0));
    armorItems = armorItems.filter((i) => i.totalStats[5] >= (this.minMelee || 0));
    if ((this.anyPlugWithN ?? 0) > 0)
      armorItems = armorItems.filter(
        (i) =>
          (i.statPlugHashes || []).filter((pl) => this.getPlugSum(pl) >= (this.anyPlugWithN || 0))
            .length > 0
      );

    if ((this.anyPlugBelowN ?? 0) < 17)
      armorItems = armorItems.filter(
        (i) =>
          (i.statPlugHashes || []).filter((pl) => this.getPlugSum(pl) <= (this.anyPlugBelowN || 0))
            .length > 0
      );

    if ((this.allPlugsWithN ?? 0) > 0)
      armorItems = armorItems.filter(
        (i) =>
          (i.statPlugHashes || []).filter((pl) => this.getPlugSum(pl) < (this.allPlugsWithN || 0))
            .length == 0
      );
    if ((this.allPlugsBelowN ?? 0) < 17)
      armorItems = armorItems.filter(
        (i) =>
          (i.statPlugHashes || []).filter((pl) => this.getPlugSum(pl) > (this.allPlugsBelowN || 0))
            .length == 0
      );

    return armorItems;
  }
}
