import {Injectable} from '@angular/core';
import {DatabaseService} from "./database.service";
import {IManifestArmor} from "../data/types/IManifestArmor";

export interface ItemIconData {
  icon: string | undefined,
  watermark: string | undefined,
}


@Injectable({
  providedIn: 'root'
})
export class ItemIconServiceService {
  private lookup = new Map<number, IManifestArmor | undefined>()

  constructor(private db: DatabaseService) {
  }


  async getItemCached(hash: number): Promise<IManifestArmor | undefined> {
    if (this.lookup.has(hash))
      return this.lookup.get(hash) || undefined;
    const item = await this.db.manifestArmor.where('hash').equals(hash).first();
    this.lookup.set(hash, item);
    return item;
  }
}
