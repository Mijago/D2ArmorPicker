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

import { Injectable, OnDestroy } from "@angular/core";
import { LoggingProxyService } from "./logging-proxy.service";
import { DatabaseService } from "./database.service";
import { ArmorSystem, IManifestArmor } from "../data/types/IManifestArmor";
import { ConfigurationService } from "./configuration.service";
import { debounceTime } from "rxjs/operators";
import { Observable, ReplaySubject } from "rxjs";
import { StatusProviderService } from "./status-provider.service";
import { BungieApiService } from "./bungie-api.service";
import { AuthService } from "./auth.service";
import { HttpClientService } from "./http-client.service";
import { ArmorSlot } from "../data/enum/armor-slot";
import { IInventoryArmor, InventoryArmorSource } from "../data/types/IInventoryArmor";
import { DestinyClass } from "bungie-api-ts/destiny2";
import { VendorsService } from "./vendors.service";
import { isEqual as _isEqual } from "lodash";
import { MembershipService } from "./membership.service";

export type ClassExoticInfo = {
  inInventory: boolean;
  inCollection: boolean;
  inVendor: boolean;
  items: IManifestArmor[];
  instances: IInventoryArmor[];
};

@Injectable({
  providedIn: "root",
})
export class UserInformationService implements OnDestroy {
  private initialized: boolean = false;
  private fetchingManifest: boolean = false;

  private _characters: ReplaySubject<
    { emblemUrl: string; characterId: string; clazz: DestinyClass; lastPlayed: number }[]
  >;
  public readonly characters: Observable<
    { emblemUrl: string; characterId: string; clazz: DestinyClass; lastPlayed: number }[]
  >;
  private _manifest: ReplaySubject<null>;
  public readonly manifest: Observable<null>;
  private _inventory: ReplaySubject<null>;
  public readonly inventory: Observable<null>;

  private refreshing: boolean = false;

  constructor(
    private db: DatabaseService,
    private config: ConfigurationService,
    private status: StatusProviderService,
    private api: BungieApiService,
    private auth: AuthService,
    private httpClient: HttpClientService,
    private vendors: VendorsService,
    private membership: MembershipService,
    private logger: LoggingProxyService
  ) {
    logger.debug("UserInformationService", "constructor", "Initializing UserInformationService");
    this._characters = new ReplaySubject(1);
    this.characters = this._characters.asObservable();
    this._inventory = new ReplaySubject(1);
    this.inventory = this._inventory.asObservable();
    this._manifest = new ReplaySubject(1);
    this.manifest = this._manifest.asObservable();

    // Clear character data on logout
    this.auth.logoutEvent.subscribe((k) => this.clearCachedCharacterData());

    this.loadCachedCharacterData();
    // Only initialize if user is already authenticated
    if (this.httpClient.isAuthenticated()) {
      this.updateCharacterData();
    }

    this.config.configuration.pipe(debounceTime(1000)).subscribe(async (c) => {
      this.logger.debug(
        "UserInformationService",
        "Config Observable",
        "Configuration changed, requesting manifest/inventory refresh if needed"
      );
      this.requestRefreshManifestAndInventoryOnUserInteraction();
    });

    logger.debug(
      "UserInformationService",
      "constructor",
      "Finished initializing UserInformationService"
    );
  }

  /**
   * Initialize data loading for authenticated users
   * This should only be called after successful authentication
   */
  public initializeForAuthenticatedUser(): void {
    this.logger.debug(
      "UserInformationService",
      "initializeForAuthenticatedUser",
      "Starting initialization for authenticated user"
    );
    this.updateCharacterData();
  }

  private async requestRefreshManifestAndInventoryOnUserInteraction() {
    if (!this.httpClient.isAuthenticated()) {
      this.logger.info(
        "UserInformationService",
        "requestRefreshManifestAndInventoryOnUserInteraction",
        "User is not authenticated, skipping router event handling"
      );
      return;
    }

    if (this.fetchingManifest) {
      this.logger.warn(
        "UserInformationService",
        "requestRefreshManifestAndInventoryOnUserInteraction",
        "Manifest fetch request in progress, skipping"
      );
      return;
    }
    this.fetchingManifest = true;
    await this.refreshManifestAndInventory();
    this.fetchingManifest = false;
    this.initialized = true;
  }

  async refreshManifestAndInventory(
    forceUpdateManifest: boolean = false,
    forceUpdateInventoryArmor: boolean = false
  ) {
    if (this.refreshing) {
      this.logger.warn(
        "UserInformationService",
        "refreshManifestAndInventory",
        "Refresh already in progress, skipping new refresh request"
      );
      return;
    }
    this.refreshing = true;
    this.logger.debug(
      "UserInformationService",
      "refreshManifestAndInventory",
      "Refreshing inventory and manifest"
    );
    try {
      let manifestUpdated = false;
      //let armorUpdated = false;
      try {
        manifestUpdated = await this.updateManifestItems(forceUpdateManifest);
        await this.updateInventoryItems(manifestUpdated || forceUpdateInventoryArmor);
        this.updateVendorsAsync();
      } catch (e) {
        this.logger.error("UserInformationService", "refreshManifestAndInventory", "Error: " + e);
      }
    } finally {
      this.refreshing = false;
    }
  }

  private async triggerInventoryUpdate(
    triggerInventoryUpdate: boolean = false,
    triggerResultsUpdate: boolean = true
  ) {
    // trigger armor update behaviour
    try {
      if (triggerInventoryUpdate) {
        this.logger.debug(
          "UserInformationService",
          "triggerInventoryUpdate",
          "Inventory update triggered, refreshing inventory observable"
        );
        this._inventory.next(null);
      }
    } catch (e) {
      this.logger.error("UserInformationService", "triggerInventoryUpdate", "Error: " + e);
    }
  }

  private updateVendorsAsync() {
    if (this.status.getStatus().updatingVendors) return;

    if (!this.vendors.isVendorCacheValid()) {
      // Check if the user is authenticated before attempting to update vendor cache, if not, skip the update to avoid unnecessary API calls and errors
      if (!this.httpClient.isAuthenticated()) {
        this.logger.debug(
          "UserInformationService",
          "updateVendorsAsync",
          "User is not authenticated, skipping vendor cache update"
        );
        return;
      }

      this.status.modifyStatus((s) => (s.updatingVendors = true));
      this.vendors
        .updateVendorArmorItemsCache()
        .then((success) => {
          const config = this.config.currentConfiguration;
          if (success && config.includeVendorRolls) {
            this.triggerInventoryUpdate(success);
          }
        })
        .catch((e) => {
          this.logger.error(
            "UserInformationService",
            "updateVendorsAsync",
            "Error updating vendor cache: " + e
          );
        })
        .finally(() => {
          this.status.modifyStatus((s) => (s.updatingVendors = false));
        });
    }
  }

  async getItemCountForClass(clazz: DestinyClass, slot?: ArmorSlot) {
    let pieces = await this.db.inventoryArmor.where("clazz").equals(clazz).toArray();
    if (!!slot) pieces = pieces.filter((i) => i.slot == slot);
    //if (!this._config.includeVendorRolls) pieces = pieces.filter((i) => i.source != InventoryArmorSource.Vendor);
    //if (!this._config.includeCollectionRolls) pieces = pieces.filter((i) => i.source != InventoryArmorSource.Collections);
    pieces = pieces.filter((i) => i.source == InventoryArmorSource.Inventory);
    return pieces.length;
  }

  async getExoticsForClass(clazz: DestinyClass, slot?: ArmorSlot): Promise<ClassExoticInfo[]> {
    let inventory = await this.db.inventoryArmor.where("isExotic").equals(1).toArray();
    inventory = inventory.filter(
      (d) =>
        d.clazz == clazz &&
        (d.armorSystem == ArmorSystem.Armor2 || d.armorSystem == ArmorSystem.Armor3) &&
        (!slot || d.slot == slot)
    );

    let exotics = await this.db.manifestArmor.where("isExotic").equals(1).toArray();
    exotics = exotics.filter(
      (d) =>
        d.clazz == clazz &&
        (d.armorSystem == ArmorSystem.Armor2 || d.armorSystem == ArmorSystem.Armor3) &&
        (!slot || d.slot == slot)
    );

    return exotics
      .map((ex) => {
        const instances = inventory.filter((i) => i.hash == ex.hash);
        return {
          items: [ex],
          instances: instances,
          inCollection:
            instances.find((i) => i.source === InventoryArmorSource.Collections) !== undefined,
          inInventory:
            instances.find((i) => i.source === InventoryArmorSource.Inventory) !== undefined,
          inVendor: instances.find((i) => i.source === InventoryArmorSource.Vendor) !== undefined,
        };
      })
      .reduce((acc: ClassExoticInfo[], curr: ClassExoticInfo) => {
        const existing = acc.find((e) => e.items[0].name === curr.items[0].name);
        if (existing) {
          existing.items.push(curr.items[0]);
          existing.instances.push(...curr.instances);
          existing.inCollection = existing.inCollection || curr.inCollection;
          existing.inInventory = existing.inInventory || curr.inInventory;
          existing.inVendor = existing.inVendor || curr.inVendor;
        } else {
          acc.push({ ...curr, items: [curr.items[0]] });
        }
        return acc;
      }, [] as ClassExoticInfo[])
      .sort((x, y) => x.items[0].name.localeCompare(y.items[0].name));
  }

  async updateManifestItems(force: boolean = false): Promise<boolean> {
    if (this.status.getStatus().updatingManifest) {
      this.logger.error(
        "UserInformationService",
        "executeUpdateManifest",
        "Already updating the manifest - abort"
      );
      return false;
    }
    this.status.modifyStatus((s) => (s.updatingManifest = true));

    try {
      // Update manifest only
      const manifestResult = await this.api.updateManifest(force);

      if (!!manifestResult) {
        this._manifest.next(null);
      }

      return !!manifestResult;
    } finally {
      this.status.modifyStatus((s) => (s.updatingManifest = false));
    }
  }

  public clearCachedCharacterData() {
    this.logger.debug(
      "UserInformationService",
      "clearCachedCharacterData",
      "Clearing cached character data"
    );
    localStorage.removeItem("user-characters");
    localStorage.removeItem("user-characters-lastDate");
    localStorage.removeItem("user-materials");
    this._characters.next([]);
  }

  public isCharacterCacheValid(): boolean {
    const characterCache = this.getCharacterCache();
    return characterCache ? this.api.isCharacterCacheValid(characterCache) : false;
  }

  private loadCachedCharacterData() {
    const characterCache = this.getCharacterCache();
    if (characterCache && this.api.isCharacterCacheValid(characterCache)) {
      this._characters.next(characterCache.characters);
    } else {
      this._characters.next([]);
      this.logger.info(
        "UserInformationService",
        "loadCachedCharacterData",
        "No valid cached character data found"
      );
    }
  }

  private getCharacterCache(): { updatedAt: number; characters: any[] } | null {
    const charactersData = localStorage.getItem("user-characters");
    const timestamp = localStorage.getItem("user-characters-lastDate");

    if (!charactersData || !timestamp) {
      return null;
    }

    try {
      return {
        updatedAt: parseInt(timestamp),
        characters: JSON.parse(charactersData),
      };
    } catch (e) {
      this.logger.warn(
        "UserInformationService",
        "getCharacterCache",
        "Failed to parse cached character data: " + e
      );
      return null;
    }
  }

  private async updateCharacterData() {
    // Don't update character data if user is not authenticated
    if (!this.httpClient.isAuthenticated()) {
      this.logger.debug(
        "UserInformationService",
        "updateCharacterData",
        "User not authenticated, skipping character data update"
      );
      return;
    }

    // Check if character cache is still valid
    const characterCache = this.getCharacterCache();
    if (characterCache && this.api.isCharacterCacheValid(characterCache)) {
      this.logger.info(
        "UserInformationService",
        "updateCharacterData",
        "Character cache is still valid, skipping update"
      );
      this._characters.next(characterCache.characters);
      return;
    }

    this.logger.info(
      "UserInformationService",
      "updateCharacterData",
      "Fetching fresh character data"
    );

    const fetchedCharacters = await this.membership.getCharacters();
    this._characters.next(fetchedCharacters);
    this.config.modifyConfiguration((d) => {
      if (d.characterClass == DestinyClass.Unknown && fetchedCharacters.length > 0) {
        d.characterClass = fetchedCharacters[0].clazz;
      }
    });

    // Store both the data and timestamp
    localStorage.setItem("user-characters", JSON.stringify(fetchedCharacters));
    localStorage.setItem("user-characters-lastDate", Date.now().toString());
  }

  public async forceUpdateCharacterData(): Promise<void> {
    // Don't update character data if user is not authenticated
    if (!this.httpClient.isAuthenticated()) {
      this.logger.debug(
        "UserInformationService",
        "forceUpdateCharacterData",
        "User not authenticated, skipping forced character data update"
      );
      return;
    }

    this.logger.info(
      "UserInformationService",
      "forceUpdateCharacterData",
      "Forcing character data refresh"
    );

    const fetchedCharacters = await this.membership.getCharacters();
    this._characters.next(fetchedCharacters);
    this.config.modifyConfiguration((d) => {
      if (d.characterClass == DestinyClass.Unknown && fetchedCharacters.length > 0) {
        d.characterClass = fetchedCharacters[0].clazz;
      }
    });

    // Store both the data and timestamp
    localStorage.setItem("user-characters", JSON.stringify(fetchedCharacters));
    localStorage.setItem("user-characters-lastDate", Date.now().toString());
  }

  async updateInventoryItems(force: boolean = false, errorLoop = 0): Promise<boolean> {
    // Don't update inventory data if user is not authenticated
    if (!this.httpClient.isAuthenticated()) {
      this.logger.debug(
        "UserInformationService",
        "updateInventoryItems",
        "User not authenticated, skipping inventory update"
      );
      return false;
    }

    this.status.modifyStatus((s) => (s.updatingInventory = true));

    try {
      let inventory = await this.api.updateInventory(force).finally(() => {
        this.status.modifyStatus((s) => (s.updatingInventory = false));
      });
      if (!!inventory) {
        this.logger.info(
          "UserInformationService",
          "updateInventoryItems",
          "Inventory updated successfully"
        );
        this._inventory.next(null);
      }
      return !!inventory;
    } catch (e) {
      // After three tries, call it a day.
      if (errorLoop > 3) {
        alert(
          "You encountered a strange error with the inventory update. Please log out and log in again. If that does not fix it, please message Mijago."
        );
        return false;
      }

      this.status.modifyStatus((s) => (s.updatingInventory = false));
      this.logger.error("UserInformationService", "updateInventoryItems", "Error: " + e);

      await this.status.setApiError();

      //await this.updateManifest(true);
      //return await this.updateInventoryItems(true, errorLoop++);
      return false;
    }
  }

  get isInitialized(): boolean {
    return this.initialized;
  }

  get isRefreshing(): boolean {
    return this.refreshing;
  }

  get isFetchingManifest(): boolean {
    return this.fetchingManifest;
  }

  ngOnDestroy(): void {
    this.logger.debug("UserInformationService", "ngOnDestroy", "Destroying UserInformationService");
  }
}
