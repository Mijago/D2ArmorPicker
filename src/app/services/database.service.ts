import {Injectable} from '@angular/core';
import Dexie from 'dexie';
import {DestinyClass} from "bungie-api-ts/destiny2/interfaces";

export interface IManifestArmor {
  hash: number;
  name: string;
  icon: string;
  slot: string;
  clazz: DestinyClass;
  isExotic: boolean;
  rawData?: string;
}

export interface IInventoryArmor extends IManifestArmor {
  itemInstanceId: string;
  masterworked: boolean;
  mobility: number;
  resilience: number;
  recovery: number;
  discipline: number;
  intellect: number;
  strength: number;
}

@Injectable({
  providedIn: 'root'
})
export class DatabaseService {
  private readonly db: Dexie;

  public manifestArmor: Dexie.Table<IManifestArmor, number>;
  public inventoryArmor: Dexie.Table<IInventoryArmor, number>;

  constructor() {
    this.db = new Dexie('d2armorpicker');

    // Declare tables, IDs and indexes
    this.db.version(2).stores({
      manifestArmor: 'hash, name, icon, slot, isExotic, clazz',
      inventoryArmor: 'itemInstanceId, hash, name, masterworked, slot, isExotic, clazz, mobility, resilience, recovery, discipline, intellect, strength'
    }).upgrade(async tx => {
      // simply clear all the armor. It'll be updated either way.
      await tx.db.table("inventoryArmor").clear();
      localStorage.setItem("LastArmorUpdate", "0")
    });
    this.manifestArmor = this.db.table("manifestArmor");
    this.inventoryArmor = this.db.table("inventoryArmor");
  }
}
