import { Injectable } from "@angular/core";
import { DatabaseService } from "./database.service";
import { IManifestArmor } from "../data/types/IManifestArmor";

export interface ItemIconData {
  icon: string | undefined;
  watermark: string | undefined;
}

@Injectable({
  providedIn: "root",
})
export class ItemIconServiceService {
  private itemLookup = new Map<number, IManifestArmor | undefined>();

  constructor(private db: DatabaseService) {}

  async getItemCached(hash: number): Promise<IManifestArmor | undefined> {
    if (this.itemLookup.has(hash)) return this.itemLookup.get(hash) || undefined;
    const item = await this.db.manifestArmor.where("hash").equals(hash).first();
    this.itemLookup.set(hash, item);
    return item;
  }

  async getExoticPerkDescription(exotic: IManifestArmor): Promise<IManifestArmor | null> {
    if (!exotic.exoticPerkHash) return null;
    let perk = await this.getItemCached(exotic.exoticPerkHash);
    return perk ?? null;
  }
}
