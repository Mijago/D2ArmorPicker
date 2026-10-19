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
import { DestinySandboxPerkDefinition } from "bungie-api-ts/destiny2";
import { BehaviorSubject } from "rxjs";
import { LoggingProxyService } from "./logging-proxy.service";
export interface ItemIconData {
  icon: string | undefined;
  watermark: string | undefined;
}
type AsyncLookupResult<T> = BehaviorSubject<T | undefined> | undefined;

@Injectable({
  providedIn: "root",
})
export class ItemIconServiceService {
  private itemLookup = new Map<number, AsyncLookupResult<IManifestArmor>>();

  private sandboxperkIconLookup = new Map<number, DestinySandboxPerkDefinition | undefined>();
  private gearsetIconLookup = new Map<string, DestinySandboxPerkDefinition | undefined>();

  constructor(
    private db: DatabaseService,
    private logger: LoggingProxyService
  ) {}

  async getItemCached(hash: number): Promise<IManifestArmor | undefined> {
    if (this.itemLookup.has(hash))
      return new Promise<IManifestArmor | undefined>((resolve, reject) => {
        this.itemLookup
          .get(hash)!
          .asObservable()
          .subscribe({
            next: (item) => {
              if (item) {
                resolve(item);
                return;
              }
            },
            error: (error) => {
              this.logger.error(
                "ItemIconServiceService",
                "getItemCached",
                "Error fetching item from cache: " + error
              );
              reject(error);
            },
          });
      });

    const newSubject = new BehaviorSubject<IManifestArmor | undefined>(undefined);
    this.itemLookup.set(hash, newSubject);

    const item = await this.db.manifestArmor.where("hash").equals(hash).first();
    newSubject.next(item);

    return item;
  }

  async getExoticPerkDescription(exotic: IManifestArmor): Promise<IManifestArmor | null> {
    if (!exotic.exoticPerkHash) return null;
    let perk = await this.getItemCached(exotic.exoticPerkHash[0]);
    return perk ?? null;
  }
  /**
   * Returns the icon for a gearset (equipable set) by its gearSetHash, using a cache for performance.
   * Finds the first armor item with the given gearSetHash and returns its icon.
   */
  async getSandboxPerkIconCached(hash: number): Promise<DestinySandboxPerkDefinition | undefined> {
    if (this.sandboxperkIconLookup.has(hash)) {
      return this.sandboxperkIconLookup.get(hash);
    }
    // Find the first armor item with this gearSetHash
    const perk = await this.db.sandboxPerkDefinition.where("hash").equals(hash).first();
    this.sandboxperkIconLookup.set(hash, perk);
    return perk;
  }

  /**
   * Returns the icon for a gearset (equipable set) by its gearSetHash, using a cache for performance.
   * Finds the first armor item with the given gearSetHash and returns its icon.
   */
  async getGearsetPerkCached(
    hash: number,
    amount: number
  ): Promise<DestinySandboxPerkDefinition | undefined> {
    if (amount <= 2) amount = 2;
    else if (amount < 4) amount = 4;

    const key = `${hash}-${amount}`;
    if (this.gearsetIconLookup.has(key)) {
      return this.gearsetIconLookup.get(key);
    }

    const equipableSet = await this.db.equipableItemSetDefinition
      .where("hash")
      .equals(hash)
      .first();
    const perk = equipableSet?.setPerks.find((p) => p.requiredSetCount === amount);
    if (perk) {
      const perkIcon = await this.getSandboxPerkIconCached(perk.sandboxPerkHash);
      this.gearsetIconLookup.set(key, perkIcon);
      return perkIcon;
    }
    return undefined;
  }
}
