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
