import {Injectable} from '@angular/core';
import Dexie from 'dexie';
import {AuthService} from "./auth.service";
import {buildDb} from "../data/database";
import {IManifestArmor} from "../data/types/IManifestArmor";
import {IInventoryArmor} from "../data/types/IInventoryArmor";

@Injectable({
  providedIn: 'root'
})
export class DatabaseService {
  private db: Dexie;

  public manifestArmor: Dexie.Table<IManifestArmor, number>;
  public inventoryArmor: Dexie.Table<IInventoryArmor, number>;

  constructor(private auth: AuthService) {
    this.db = buildDb(async () => {
      await this.auth.clearManifestInfo();
    })
    this.manifestArmor = this.db.table("manifestArmor");
    this.inventoryArmor = this.db.table("inventoryArmor");
  }

  private initialize() {
    this.db = buildDb(async () => {
      await this.auth.clearManifestInfo();
    })
    this.manifestArmor = this.db.table("manifestArmor");
    this.inventoryArmor = this.db.table("inventoryArmor");
  }

  async resetDatabase() {
    await this.db.delete()
    this.initialize()
  }
}
