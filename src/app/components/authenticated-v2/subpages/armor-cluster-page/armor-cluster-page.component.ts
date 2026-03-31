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

import { AfterViewInit, Component } from "@angular/core";
import { IInventoryArmor, InventoryArmorSource } from "../../../../data/types/IInventoryArmor";
import { DatabaseService } from "../../../../services/database.service";
import { MatSnackBar } from "@angular/material/snack-bar";
import { UserInformationService } from "src/app/services/user-information.service";
import { debounceTime } from "rxjs/operators";
import { ArmorSlot } from "../../../../data/enum/armor-slot";
import { ArmorSystem } from "src/app/data/types/IManifestArmor";
import { ARMORSTAT_ORDER, ArmorStatNames } from "src/app/data/enum/armor-stat";

@Component({
  selector: "app-armor-cluster-page",
  templateUrl: "./armor-cluster-page.component.html",
  styleUrls: ["./armor-cluster-page.component.css"],
})
export class ArmorClusterPageComponent implements AfterViewInit {
  clusterInformation: any[] = [];
  items: Array<IInventoryArmor> = [];
  clusters: IInventoryArmor[][] = [];

  exoticFilter: number | undefined = undefined;
  classFilter: number | undefined = undefined;
  armorSystemFilter: ArmorSystem | undefined = undefined;
  clusterCount: number = 10;

  public ARMORSTAT_ORDER = ARMORSTAT_ORDER;
  public ArmorStatNames = ArmorStatNames;

  constructor(
    private db: DatabaseService,
    private _snackBar: MatSnackBar,
    private inventory: UserInformationService
  ) {}

  // No longer needed: clusterCount is updated via ngModel on the slider thumb

  async ngAfterViewInit(): Promise<void> {
    this.inventory.inventory.pipe(debounceTime(200)).subscribe(async () => {
      await this.Update();
      this.openSnackBar("Clusters were updated.");
    });
  }

  public async Update() {
    // Filter items by inventory and user options
    console.log("classFilter", this.exoticFilter !== -1);
    const items = (await this.db.inventoryArmor.toArray()).filter(
      (item) =>
        item.source === InventoryArmorSource.Inventory &&
        item.slot !== ArmorSlot.ArmorSlotClass &&
        item.slot !== ArmorSlot.ArmorSlotNone &&
        (this.classFilter === undefined || item.clazz === this.classFilter) &&
        (this.exoticFilter !== -1 || !item.isExotic) &&
        (this.exoticFilter !== 1 || item.isExotic) &&
        (this.armorSystemFilter === undefined || item.armorSystem === this.armorSystemFilter)
    );
    this.items = items;

    // Prepare stat vectors for clustering
    const statVectors = items.map((item) => [
      item.mobility,
      item.resilience,
      item.recovery,
      item.discipline,
      item.intellect,
      item.strength,
      //item.mobility +        item.resilience +        item.recovery +        item.discipline +        item.intellect +        item.strength,
    ]);

    // Run k-means clustering with deterministic seed
    const k = Math.min(this.clusterCount, items.length);
    const seed = 42;
    const { assignments, centroids } = this.kmeans(statVectors, k, 20, seed);

    // Group items by cluster
    const clusters: IInventoryArmor[][] = Array.from({ length: k }, () => []);
    items.forEach((item, idx) => {
      const clusterId = assignments[idx];
      if (clusterId !== undefined && clusterId >= 0) clusters[clusterId].push(item);
    });
    // Calculate clusterInformation (mean for each cluster)
    let clusterInformation = centroids.map((centroid, i) => {
      // Calculate mean for each stat in the cluster
      const clusterItems = clusters[i];
      if (clusterItems.length === 0) return { mean: centroid, size: 0 };
      const mean = Array(6).fill(0);
      clusterItems.forEach((item) => {
        mean[0] += item.mobility;
        mean[1] += item.resilience;
        mean[2] += item.recovery;
        mean[3] += item.discipline;
        mean[4] += item.intellect;
        mean[5] += item.strength;
        //mean[6] +=item.mobility +          item.resilience +          item.recovery +          item.discipline +          item.intellect +          item.strength;
      });
      for (let j = 0; j < 7; j++) mean[j] /= clusterItems.length;
      return { mean, size: clusterItems.length };
    });

    // Pair clusters and info, sort descending by size, then unpack
    const paired = clusters.map((c, i) => ({ cluster: c, info: clusterInformation[i] }));
    paired.sort((a, b) => b.cluster.length - a.cluster.length);
    this.clusters = paired.map((p) => p.cluster);
    this.clusterInformation = paired.map((p) => p.info);
  }

  // Simple k-means implementation for stat vectors, deterministic with seed
  private kmeans(
    data: number[][],
    k: number,
    maxIter = 20,
    seed = 42
  ): { assignments: number[]; centroids: number[][] } {
    if (data.length === 0 || k === 0) return { assignments: [], centroids: [] };

    // Deterministic PRNG (Mulberry32)
    function mulberry32(a: number) {
      return function () {
        var t = (a += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
    const rand = mulberry32(seed);

    // Randomly initialize centroids using deterministic PRNG
    let centroids = data.slice(0, k).map((vec) => vec.slice());
    if (data.length > k) {
      const used = new Set<number>();
      centroids = [];
      while (centroids.length < k) {
        const idx = Math.floor(rand() * data.length);
        if (!used.has(idx)) {
          centroids.push(data[idx].slice());
          used.add(idx);
        }
      }
    }
    let assignments = new Array(data.length).fill(0);
    for (let iter = 0; iter < maxIter; iter++) {
      // Assign
      assignments = data.map((vec) => {
        let minDist = Infinity,
          minIdx = 0;
        for (let i = 0; i < centroids.length; i++) {
          const dist = this.vectorDistance(vec, centroids[i]);
          if (dist < minDist) {
            minDist = dist;
            minIdx = i;
          }
        }
        return minIdx;
      });
      // Update centroids
      const newCentroids = Array.from({ length: k }, () => Array(data[0].length).fill(0));
      const counts = Array(k).fill(0);
      data.forEach((vec, idx) => {
        const cluster = assignments[idx];
        counts[cluster]++;
        for (let j = 0; j < vec.length; j++) {
          newCentroids[cluster][j] += vec[j];
        }
      });
      for (let i = 0; i < k; i++) {
        if (counts[i] > 0) {
          for (let j = 0; j < newCentroids[i].length; j++) {
            newCentroids[i][j] /= counts[i];
          }
        } else {
          // Reinitialize empty cluster deterministically
          newCentroids[i] = data[Math.floor(rand() * data.length)].slice();
        }
      }
      centroids = newCentroids;
    }
    return { assignments, centroids };
  }

  openSnackBar(message: string) {
    this._snackBar.open(message, "", {
      duration: 2500,
      politeness: "polite",
    });
  }

  public getDIMStringForCluster(cluster: IInventoryArmor[]) {
    return cluster.map((d) => `id:'${d.itemInstanceId}'`).join(" or ");
  }

  vectorDistance(x: number[], y: number[]) {
    return Math.sqrt(x.reduce((acc, val, i) => acc + Math.pow(val - y[i], 2), 0));
  }

  public getClusterid(item: IInventoryArmor): number {
    var currentDist = Number.MAX_VALUE;
    var currentId = -1;
    for (let i = 0; i < this.clusterInformation.length; i++) {
      const clusterDatum = this.clusterInformation[i];
      var dist = this.vectorDistance(clusterDatum.mean, [
        item.mobility +
          item.resilience +
          item.recovery +
          item.discipline +
          item.intellect +
          item.strength,
        item.mobility,
        item.resilience,
        item.recovery,
        item.discipline,
        item.intellect,
        item.strength,
      ]);
      if (dist < currentDist) {
        currentDist = dist;
        currentId = i;
      }
    }

    return currentId;
  }
}
