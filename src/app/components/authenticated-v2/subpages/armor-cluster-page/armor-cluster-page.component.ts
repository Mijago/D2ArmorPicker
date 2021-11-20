import {AfterViewInit, Component} from '@angular/core';
import {IInventoryArmor} from "../../../../data/types/IInventoryArmor";
import {DatabaseService} from "../../../../services/database.service";
import {MatSnackBar} from "@angular/material/snack-bar";
import {InventoryService} from "../../../../services/inventory.service";
import {debounceTime} from "rxjs/operators";
import kmeans from "kmeans-ts";

interface Cluster {
  mean: number[],
  items: IInventoryArmor[],
}

@Component({
  selector: 'app-armor-cluster-page',
  templateUrl: './armor-cluster-page.component.html',
  styleUrls: ['./armor-cluster-page.component.css']
})
export class ArmorClusterPageComponent implements AfterViewInit {
  items: Array<IInventoryArmor> = [];

  clusters: Cluster[] = [];

  exoticFilter: number = 0;
  masterworkFilter: number = 0;
  classFilter: number = -1;
  numClusters: number = 25;


  constructor(private db: DatabaseService, private _snackBar: MatSnackBar, private inventory: InventoryService) {
  }

  async ngAfterViewInit(): Promise<void> {
    this.inventory.inventory
      .pipe(debounceTime(200))
      .subscribe(async () => {
        await this.Update();
        this.openSnackBar("Clusters were updated.")
      })
  }


  public async Update() {
    var items = await this.db.inventoryArmor.toArray();

    var data = [];
    var reduced_items: IInventoryArmor[] = [];

    for (let item of items) {
      if (item.slot == "Class Items") continue;
      if (item.slot == "none") continue; // ignores stasis and halloween masks.

      if (this.classFilter != -1 && item.clazz != this.classFilter) continue
      if (this.exoticFilter == -1 && item.isExotic) continue;
      if (this.exoticFilter == 1 && !item.isExotic) continue;
      if (this.masterworkFilter == -1 && item.masterworked) continue;
      if (this.masterworkFilter == 1 && !item.masterworked) continue;

      data.push([
        item.mobility + item.resilience + item.recovery + item.discipline + item.intellect + item.strength,
        item.mobility,
        item.resilience,
        item.recovery,
        item.discipline,
        item.intellect,
        item.strength
      ]);
      reduced_items.push(item);
    }

    let { indexes, centroids } = kmeans(data, this.numClusters);
    this.clusters = centroids.map(c => ({mean: c, items: []}));

    indexes.forEach((cluster: number, elem: number) => {
      this.clusters[cluster].items.push(reduced_items[elem]);
    });

    this.clusters.sort((a, b) => b.mean[3] - a.mean[3]);
  }

  openSnackBar(message: string) {
    this._snackBar.open(message,
      "", {
        duration: 2500,
        politeness: "polite"
      });
  }

  public getDIMStringForCluster(cluster: IInventoryArmor[]) {
    return cluster.map(d => `id:'${d.itemInstanceId}'`).join(" or ")
  }
}
