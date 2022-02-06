import {Component, OnDestroy, OnInit} from '@angular/core';
import {Subject} from "rxjs";
import {debounceTime, takeUntil} from "rxjs/operators";
import {InventoryService} from "../../../../services/inventory.service";
import {IInventoryArmor} from "../../../../data/types/IInventoryArmor";
import {DatabaseService} from "../../../../services/database.service";
import {IManifestArmor} from "../../../../data/types/IManifestArmor";
import {ArmorSlot} from "../../../../data/enum/armor-slot";

type LocalArmorInfo = { isSunset: boolean, slot: ArmorSlot, totalSum: number, totalStats: number[]; itemInstanceId: string; mobility: number[]; intellect: number[]; strength: number[]; statPlugHashes: (number)[]; name: string; recovery: number[]; discipline: number[]; resilience: number[]; hash: number };

@Component({
  selector: 'app-armor-investigation-page',
  templateUrl: './armor-investigation-page.component.html',
  styleUrls: ['./armor-investigation-page.component.css']
})
export class ArmorInvestigationPageComponent implements OnInit, OnDestroy {
  armorItemsPerSlot: Map<ArmorSlot, LocalArmorInfo[]> = new Map();

  plugData: { [p: string]: IManifestArmor } = {};

  constructor(public inventory: InventoryService, private db: DatabaseService) {
  }

  ngOnInit(): void {
    this.inventory.inventory
      .pipe(
        debounceTime(10),
        takeUntil(this.ngUnsubscribe)
      )
      .subscribe(async () => {
        this.updateItems();
      })
  }

  getPlugString(plugId: number) {
    var plugInfo = this.plugData[plugId]
    let info = [0, 0, 0, 0, 0, 0]
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
    return "[" + info.join(" ") + "]"
  }

  private async updateItems() {
    let manifestArmor = await this.db.manifestArmor.toArray();
    const modsData = manifestArmor.filter(d => d.itemType == 19)
    let plugData = Object.fromEntries(modsData.map((_) => [_.hash, _]))
    this.plugData = plugData;

    const armorItems = (await this.db.inventoryArmor.toArray() as IInventoryArmor[])
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
          slot: i.slot
        } as LocalArmorInfo
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

        for (let s of result.totalStats)
          result.totalSum += s

        return result;
      })

    this.armorItemsPerSlot = armorItems.reduce((p, v) => {
      const slot = !v.slot ? 10 : v.slot;
      if (!p.has(slot)) p.set(slot, [])
      p.get(slot)?.push(v)

      return p;
    }, new Map<ArmorSlot, LocalArmorInfo[]>())
  }

  private ngUnsubscribe = new Subject();

  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }

  getCategoryName(id: number): string {
    switch (id) {
      case 1: return "Helmets";
      case 2: return "Gauntlets";
      case 3: return "Chest Pieces";
      case 4: return "Legs";
      case 5: return "Class Items";
    }
    return "Unknown Category"
  }
}
