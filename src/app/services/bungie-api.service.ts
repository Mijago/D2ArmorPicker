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
import {
  DestinyComponentType,
  DestinyInventoryItemDefinition,
  DestinyItemType,
  DestinyCollectibleState,
  equipItem,
  getDestinyManifest,
  getDestinyManifestSlice,
  getItem,
  getProfile,
  transferItem,
  DestinyManifestSlice,
  DestinyCollectiblesComponent,
  DestinyItemInvestmentStatDefinition,
  DestinyClass,
  DestinyItemComponent,
  DestinyManifestComponentName,
  AllDestinyManifestComponents,
  DestinyManifest,
  ServerResponse,
  DestinyProfileResponse,
  DestinyItemInstanceComponent,
  DestinySandboxPerkDefinition,
  DestinySocketTypeDefinition,
  DestinyPresentationNodeDefinition,
  DestinyCollectibleDefinition,
} from "bungie-api-ts/destiny2";
import { DatabaseService } from "./database.service";
import { environment } from "../../environments/environment";
import { ArmorSystem, IManifestArmor } from "../data/types/IManifestArmor";
import {
  IInventoryArmor,
  InventoryArmorSource,
  createArmorItem,
  applyInvestmentStats,
  getInvestmentStats,
} from "../data/types/IInventoryArmor";
import { ArmorSlot } from "../data/enum/armor-slot";
import {
  ArmorPerkOrSlot,
  ArmorPerkSocketHashes,
  ArmorStat,
  ArmorStatFromHash,
  ArmorStatHashes,
  MapAlternativeSocketTypeToArmorPerkOrSlot,
  MapAlternativeToArmorPerkOrSlot,
} from "../data/enum/armor-stat";
import { ConfigurationService } from "./configuration.service";
import { IManifestCollectible } from "../data/types/IManifestCollectible";
import { MembershipService } from "./membership.service";
import { HttpClientService } from "./http-client.service";
import { IVendorInfo } from "../data/types/IVendorInfo";
import { StatusProviderService } from "./status-provider.service";
import { IVendorItemSubscreen } from "../data/types/IVendorItemSubscreen";
import {
  ResultDefinition,
  ResultItemMoveState,
} from "../components/authenticated-v2/results/results.component";
import { ExoticClassItemPerkNames } from "../data/exotic-class-item-spirits";
import { SubclassHashes } from "../data/enum/armor-stat";
import { ModInformation } from "../data/ModInformation";
import { Subject, Observable } from "rxjs";

// Database type for SQLite operations
type Database = any;

// TODO :Remove once DIM API is updated

export interface DestinyEquipableItemSetDefinition {
  displayProperties: {
    name: string;
    description: string;
    hasIcon: boolean;
  };
  setItems: number[];
  setPerks: Array<{
    requiredSetCount: number;
    sandboxPerkHash: number;
  }>;
  hash: number;
  index: number;
  redacted: boolean;
  blacklisted: boolean;
}

function collectInvestmentStats(
  r: IInventoryArmor,
  itemInvestmentStats: DestinyItemInvestmentStatDefinition[],
  plugHashes: (number | undefined)[],
  mods: Record<string, IManifestArmor>
) {
  const investmentStats: { [id: number]: number } = {
    2996146975: 0,
    392767087: 0,
    1943323491: 0,
    1735777505: 0,
    144602215: 0,
    4244567218: 0,
  };

  // Intrinsics
  for (let newStats of itemInvestmentStats) {
    if (newStats.statTypeHash in investmentStats)
      investmentStats[newStats.statTypeHash] += newStats.value;
  }

  const plugs = [plugHashes[6], plugHashes[7], plugHashes[8], plugHashes[9]];
  if (r.isExotic && r.slot === ArmorSlot.ArmorSlotClass) {
    plugs.push(plugHashes[10]); // Exotic class item perk
    plugs.push(plugHashes[11]); // Exotic class item perk
  }
  r.statPlugHashes = plugs;
  var plm = plugs.map((k) => mods[k || ""]).filter((k) => k != null);
  for (let entry of plm) {
    for (let newStats of entry.investmentStats) {
      if (newStats.statTypeHash in investmentStats)
        investmentStats[newStats.statTypeHash] += newStats.value;
    }
  }

  applyInvestmentStats(r, investmentStats);

  // TODO: THIS IS A QUICK HACK: FIX THIS
  const investmentStatsOverZero = Object.entries(investmentStats).filter(([_, value]) => value > 0);
  if (investmentStatsOverZero.length > 3) return;
  r.archetypeStats = [];
  const stats = [
    ArmorStat.StatWeapon,
    ArmorStat.StatHealth,
    ArmorStat.StatClass,
    ArmorStat.StatGrenade,
    ArmorStat.StatSuper,
    ArmorStat.StatMelee,
  ];
  for (let i = 0; i < stats.length; i++) {
    const stat = stats[i];
    const statHash = ArmorStatHashes[stat];
    if (investmentStatsOverZero.find(([hash, _]) => parseInt(hash) == statHash)) {
      r.archetypeStats.push(i);
    }
  }
}

@Injectable({
  providedIn: "root",
})
export class BungieApiService implements OnDestroy {
  /**
   * Emits after a manifest update.
   */
  private manifestUpdatedSubject = new Subject<void>();
  private manifestAlreadyUpdated = false;

  /**
   * Observable that emits when the manifest is updated.
   */
  public get manifestUpdated$(): Observable<void> {
    return this.manifestUpdatedSubject.asObservable();
  }

  constructor(
    private status: StatusProviderService,
    private http: HttpClientService,
    private db: DatabaseService,
    private config: ConfigurationService,
    private membership: MembershipService,
    private logger: LoggingProxyService
  ) {
    this.logger.debug("BungieApiService", "constructor", "Initializing BungieApiService");
  }

  ngOnDestroy(): void {
    this.logger.debug("BungieApiService", "ngOnDestroy", "Destroying BungieApiService");
  }

  async transferItem(
    itemInstanceId: string,
    targetCharacter: string,
    equip = false
  ): Promise<boolean> {
    let destinyMembership = await this.membership.getMembershipDataForCurrentUser();
    if (!destinyMembership) {
      if (!this.status.getStatus().apiError) this.status.setAuthError();
      return false;
    }
    this.status.clearAuthError();
    this.status.clearApiError();

    let r1 = await getItem((d) => this.http.$http(d, false), {
      membershipType: destinyMembership.membershipType,
      destinyMembershipId: destinyMembership.membershipId,
      itemInstanceId: itemInstanceId,
      components: [DestinyComponentType.ItemCommonData],
    });

    let transferResult = false;

    if (!r1) return false;
    if (r1.Response.characterId != targetCharacter) {
      if (r1.Response.item.data?.location != 2) {
        await this.moveItemToVault(r1.Response.item.data?.itemInstanceId || "");
        r1 = await getItem((d) => this.http.$http(d, false), {
          membershipType: destinyMembership.membershipType,
          destinyMembershipId: destinyMembership.membershipId,
          itemInstanceId: itemInstanceId,
          components: [DestinyComponentType.ItemCommonData],
        });
      }

      const payload = {
        characterId: targetCharacter,
        membershipType: destinyMembership.membershipType,
        itemId: r1?.Response.item.data?.itemInstanceId || "",
        itemReferenceHash: r1?.Response.item.data?.itemHash || 0,
        stackSize: 1,
        transferToVault: false,
      };

      transferResult = !!(await transferItem((d) => this.http.$httpPost(d), payload));
    }
    if (equip) {
      let equipPayload = {
        characterId: targetCharacter,
        membershipType: destinyMembership.membershipType,
        stackSize: 1,
        itemId: r1?.Response.item.data?.itemInstanceId || "",
        itemReferenceHash: r1?.Response.item.data?.itemHash || 0,
      };
      transferResult = !!(await equipItem((d) => this.http.$httpPost(d), equipPayload));
    }

    return transferResult;
  }

  async moveItemToVault(itemInstanceId: string) {
    this.logger.info("BungieApiService", "moveItemToVault", `itemInstanceId: ${itemInstanceId}`);
    let destinyMembership = await this.membership.getMembershipDataForCurrentUser();
    if (!destinyMembership) {
      if (!this.status.getStatus().apiError) this.status.setAuthError();
      return;
    }
    this.status.clearAuthError();
    this.status.clearApiError();

    const r1 = await getItem((d) => this.http.$http(d, false), {
      membershipType: destinyMembership.membershipType,
      destinyMembershipId: destinyMembership.membershipId,
      itemInstanceId: itemInstanceId,
      components: [DestinyComponentType.ItemCommonData],
    });

    const payload = {
      characterId: r1?.Response.characterId || "",
      membershipType: destinyMembership.membershipType,
      itemId: r1?.Response.item.data?.itemInstanceId || "",
      itemReferenceHash: r1?.Response.item.data?.itemHash || 0,
      stackSize: 1,
      transferToVault: true,
    };

    await transferItem((d) => this.http.$httpPost(d), payload);
  }

  // Collect the list of unlocked exotic armor pieces
  private async getUnlockedExoticArmor(
    characterCollectibles: Record<string, DestinyCollectiblesComponent>
  ): Promise<Set<number>> {
    const manifestExoticArmorItemHashes = (await this.db.manifestCollectibles.toArray()).reduce(
      (acc, cur) => {
        acc[cur.hash] = cur.itemHash;
        return acc;
      },
      {} as Record<number, number>
    );

    const itemHashes = Object.values(characterCollectibles)
      .flatMap((char) => Object.entries(char.collectibles ?? {}))
      .filter(([hash, { state }]) => {
        return (
          (state & DestinyCollectibleState.NotAcquired) === 0 &&
          manifestExoticArmorItemHashes[parseInt(hash)]
        );
      })
      .map(([hash, _]) => manifestExoticArmorItemHashes[parseInt(hash)]);

    return new Set(itemHashes);
  }

  async updateInventory(force = false): Promise<IInventoryArmor[] | null> {
    // Check if the user is authenticated before getting the membership data, if not, return null to avoid unnecessary API calls and errors
    if (!this.http.isAuthenticated()) {
      this.logger.warn("BungieApiService", "updateInventory", "User is not authenticated");
      return null;
    }
    if (environment.offlineMode) {
      this.logger.info("BungieApiService", "updateInventory", "offline mode, skipping");
      return null;
    }

    if (!force && localStorage.getItem("d2ap-inventory-lastDate"))
      if (localStorage.getItem("d2ap-db-lastName") == this.db.inventoryArmor.db.name)
        if (
          Date.now() - Number.parseInt(localStorage.getItem("d2ap-inventory-lastDate") || "0") <
          1000 * 3600 * 0.5
        ) {
          // Do not update if inventory was updated less than 30 minutes ago, unless forced to update. This is to avoid hitting rate limits and unnecessary processing
          this.logger.info(
            "BungieApiService",
            "updateInventory",
            "Inventory recently updated, skipping"
          );
          return null;
        }

    let destinyMembership = await this.membership.getMembershipDataForCurrentUser();
    if (!destinyMembership) {
      if (!this.status.getStatus().apiError) this.status.setAuthError();
      return null;
    }
    this.status.clearAuthError();
    this.status.clearApiError();

    this.logger.info("BungieApiService", "updateInventory", "Requesting Profile");
    let profile = await getProfile((d) => this.http.$http(d, true), {
      components: [
        DestinyComponentType.CharacterEquipment,
        DestinyComponentType.CharacterInventories,
        DestinyComponentType.ProfileCurrencies,
        DestinyComponentType.ProfileInventories,
        DestinyComponentType.ItemStats,
        DestinyComponentType.ItemInstances,
        DestinyComponentType.ItemPerks,
        DestinyComponentType.ItemSockets,
        DestinyComponentType.ItemPlugStates,
        DestinyComponentType.ItemReusablePlugs,
        DestinyComponentType.Collectibles,
      ],
      membershipType: destinyMembership.membershipType,
      destinyMembershipId: destinyMembership.membershipId,
    });

    const unlockedExoticArmorItemHashes = await this.getUnlockedExoticArmor(
      profile.Response.characterCollectibles.data ?? {}
    );

    let allItems = profile.Response.profileInventory.data?.items || [];
    for (let charI in profile.Response.characterEquipment.data) {
      let i = profile.Response.characterEquipment.data[charI].items;
      allItems = allItems.concat(i);
    }
    for (let charI in profile.Response.characterInventories.data) {
      let i = profile.Response.characterInventories.data[charI].items;
      allItems = allItems.concat(i);
    }

    // Update materials
    this.updateMaterials(allItems, profile);

    // Collect a list of all armor item hashes that we need to look up in the manifest
    const idSet = new Set(allItems.map((d) => d.itemHash));
    // Add all exotics owned by the player, as they can always be found from collections
    unlockedExoticArmorItemHashes.forEach((id) => idSet.add(id));

    // Check if inventory has changed by comparing item hashes
    const currentItemHashesKey = Array.from(idSet).sort().join(",");
    const cachedItemHashesKey = localStorage.getItem("user-armorItems") || "";

    if (!force && currentItemHashesKey == cachedItemHashesKey && currentItemHashesKey.length > 0) {
      this.logger.info(
        "BungieApiService",
        "updateInventory",
        "Item hashes unchanged, and items are present, skipping armor processing"
      );
      // Still update the timestamp since we checked
      localStorage.setItem("d2ap-inventory-lastDate", Date.now().toString());
      this.status.clearApiError();

      // No changes in inventory
      this.logger.info(
        "BungieApiService",
        "updateInventory",
        "No changes in inventory detected, skipping processing"
      );
      return null;
    } else {
      this.logger.info(
        "BungieApiService",
        "updateInventory",
        "Changes detected in inventory, processing armor items"
      );
    }

    // Do not search directly in the DB, as it is VERY slow.
    let manifestArmor = await this.db.manifestArmor.toArray();
    const validManifestArmor = manifestArmor.filter((d) => idSet.has(d.hash));
    const modsData = manifestArmor.filter((d) => d.itemType == 19);
    const validManifestArmorMap = Object.fromEntries(validManifestArmor.map((_) => [_.hash, _]));
    const modsMap = Object.fromEntries(modsData.map((_) => [_.hash, _]));

    // Process armor items
    let filteredItems = this.updateArmor(allItems, profile, validManifestArmorMap, modsMap);

    // Add collection rolls for exotics
    const collectionRollItems = this.updateCollectionRolls(
      unlockedExoticArmorItemHashes,
      validManifestArmorMap,
      modsMap
    );
    filteredItems = filteredItems.concat(collectionRollItems);
    //    filteredItems = filteredItems.filter(
    //      (k) => !k["statPlugHashes"] || k["statPlugHashes"][0] != null
    //    );

    await this.updateDatabaseItems(filteredItems);

    // Cache the current item hashes for future comparisons
    localStorage.setItem("user-armorItems", currentItemHashesKey);
    localStorage.setItem("d2ap-inventory-lastDate", Date.now().toString());

    this.status.clearApiError();
    return filteredItems;
  }

  private updateMaterials(
    allItems: DestinyItemComponent[],
    profile: ServerResponse<DestinyProfileResponse>
  ): void {
    // get amount of materials
    // 3853748946 enhancement core
    // 4257549984 enhancement prism
    // 4257549985 Ascendant Shard
    // 3467984096 Exotic Cipher
    var materials = allItems
      .filter((k) => [3853748946, 4257549984, 4257549985, 3467984096].indexOf(k.itemHash!) > -1)
      .reduce((previousValue, currentValue) => {
        if (!(currentValue.itemHash.toString() in previousValue)) {
          previousValue[currentValue.itemHash] = 0;
        }
        previousValue[currentValue.itemHash] += currentValue.quantity;
        return previousValue;
      }, {} as any);
    let glimmerEntry =
      profile.Response.profileCurrencies.data?.items.filter((k) => k.itemHash == 3159615086) || [];
    if (glimmerEntry.length > 0) materials["3159615086"] = glimmerEntry[0].quantity;
    else materials["3159615086"] = 0;
    localStorage.setItem("user-materials", JSON.stringify(materials));
  }

  private updateArmor(
    allItems: DestinyItemComponent[],
    profile: ServerResponse<DestinyProfileResponse>,
    validManifestArmorMap: Record<string, IManifestArmor>,
    modsMap: Record<string, IManifestArmor>
  ): IInventoryArmor[] {
    return allItems
      .filter((d) => !!d.itemInstanceId)
      .filter((d) => d.bucketHash !== 3284755031) // Filter out subclasses
      .filter((d) => {
        let statData = profile.Response.itemComponents.stats.data || {};
        let stats = statData[d.itemInstanceId || ""]?.stats || {};
        return !!stats[392767087];
      })
      .filter((d: DestinyItemComponent) => {
        // remove sunset items
        let instanceData = profile.Response.itemComponents.instances.data || {};
        let instance = instanceData[d.itemInstanceId || ""] || {};
        return !!instance.energy;
      })
      .map((d) => {
        let instanceData = profile.Response.itemComponents.instances.data || {};
        let instance = instanceData[d.itemInstanceId || ""] || {};

        if (!validManifestArmorMap[d.itemHash]) {
          this.logger.warn(
            "BungieApiService",
            "updateInventory",
            `Missing manifest item for item hash: ${d.itemHash}`
          );
          return null;
        }
        let armorItem = createArmorItem(
          validManifestArmorMap[d.itemHash],
          d.itemInstanceId || "",
          InventoryArmorSource.Inventory
        );

        // Process armor system and tuning stats
        this.processArmorSystemAndTuning(armorItem, instance, profile, d, modsMap);

        // Process exotic class items
        if (armorItem.isExotic && armorItem.slot === ArmorSlot.ArmorSlotClass) {
          armorItem.exoticPerkHash = [];
          const sockets =
            profile.Response.itemComponents.sockets.data?.[d.itemInstanceId!]?.sockets || [];
          for (const socket of sockets) {
            if (
              socket.plugHash &&
              Object.keys(ExoticClassItemPerkNames).map(Number).includes(socket.plugHash)
            ) {
              armorItem.exoticPerkHash.push(socket.plugHash);
            }
          }
        }

        // Set energy level
        armorItem.energyLevel = !!instance.energy ? instance.energy.energyCapacity : 0;

        // Process investment stats, masterwork, and perks
        this.processStatsAndPerks(armorItem, d, profile, validManifestArmorMap, modsMap);

        return armorItem as IInventoryArmor;
      })
      .filter(Boolean) as IInventoryArmor[];
  }

  private processArmorSystemAndTuning(
    armorItem: IInventoryArmor,
    instance: DestinyItemInstanceComponent,
    profile: ServerResponse<DestinyProfileResponse>,
    d: DestinyItemComponent,
    modsMap: Record<string, IManifestArmor>
  ): void {
    // 3.0 armor system detection and tuning stat processing
    if (!!(instance as any).gearTier) {
      armorItem.armorSystem = ArmorSystem.Armor3;
      armorItem.tier = (instance as any).gearTier;

      // Grab the tuning stat from the reusable plugs
      try {
        const plugs =
          profile.Response.itemComponents.reusablePlugs.data?.[d.itemInstanceId!]?.plugs;
        if (plugs) {
          const availablePlugs = Object.values(plugs).find((value: any) => {
            return value.length > 1 && value.some((p: any) => p.plugItemHash == 3122197216); // 3122197216 is the balanced tuning stat
          }) as any[];

          if (availablePlugs && availablePlugs.length > 1) {
            const pickedPlug = availablePlugs.find((p: any) => p.plugItemHash != 3122197216);
            if (pickedPlug) {
              const statCheckHash = pickedPlug.plugItemHash;
              const mod = modsMap[statCheckHash];
              const tuningStatHash = mod?.investmentStats.find((p) => p.value > 0)?.statTypeHash;
              if (tuningStatHash) armorItem.tuningStat = ArmorStatFromHash[tuningStatHash];
            }
          }
        }
      } catch (e) {
        this.logger.error(
          "BungieApiService",
          "updateInventory",
          `Error while getting tuning stat for item ${d.itemInstanceId}: ${e}`
        );
      }
    } else if (armorItem.isExotic && armorItem.slot === ArmorSlot.ArmorSlotClass) {
      armorItem.armorSystem = ArmorSystem.Armor3;
    } else {
      armorItem.armorSystem = ArmorSystem.Armor2;
    }
  }

  private processStatsAndPerks(
    armorItem: IInventoryArmor,
    d: DestinyItemComponent,
    profile: ServerResponse<DestinyProfileResponse>,
    validManifestArmorMap: Record<string, IManifestArmor>,
    modsMap: Record<string, IManifestArmor>
  ): void {
    const sockets = profile.Response.itemComponents.sockets.data || {};
    const socketsList =
      sockets[d.itemInstanceId!]?.sockets.map((socket: any) => socket.plugHash) ?? [];

    // Collect investment stats
    collectInvestmentStats(
      armorItem,
      validManifestArmorMap[d.itemHash]?.investmentStats ?? [],
      socketsList,
      modsMap
    );

    // Process exotic class item archetype stats
    if (armorItem.isExotic && armorItem.slot === ArmorSlot.ArmorSlotClass) {
      let statData = profile.Response.itemComponents.stats.data || {};
      let stats = statData[d.itemInstanceId || ""]?.stats || {};

      for (let n = 0; n < 7; n++) {
        const sock = sockets[d.itemInstanceId!]?.sockets[n];
        if (!sock || !sock.plugHash) continue;
        const mod = modsMap[sock.plugHash];
        if (!mod) continue;
        if (mod.investmentStats.length == 0) continue;
        for (const stat of mod.investmentStats) {
          if (stat.statTypeHash in stats) {
            (stats[stat.statTypeHash] as any).value -= stat.value;
          }
        }
      }
      // Sort the stats by value in descending order and get the third highest value
      const sortedStats = Object.entries(stats)
        .map(([hash, statObj]) => ({ hash: parseInt(hash), value: (statObj as any).value }))
        .sort((a, b) => b.value - a.value);

      if (sortedStats.length >= 3) {
        const thirdHighestStatHash = sortedStats[2].hash;
        armorItem.archetypeStats.push(Object.values(ArmorStatHashes).indexOf(thirdHighestStatHash));

        const investmentStat = getInvestmentStats(armorItem);
        investmentStat[thirdHighestStatHash] += 13;
        applyInvestmentStats(armorItem, investmentStat);
      }
    }

    // Process masterwork level
    for (let socket of socketsList) {
      if (!socket) continue;
      const mod = modsMap[socket];
      if (!mod || mod.name !== "Upgrade Armor") continue;
      const mmod = mod.investmentStats.find(
        (k: DestinyItemInvestmentStatDefinition) =>
          k.statTypeHash == ArmorStatHashes[ArmorStat.StatWeapon]
      );
      if (mmod) {
        if (armorItem.armorSystem == ArmorSystem.Armor3) armorItem.masterworkLevel = mmod.value;
        else if (armorItem.armorSystem == ArmorSystem.Armor2) {
          armorItem.masterworkLevel = mmod.value == 2 ? 5 : 0;
        }
      }
    }

    // Process artifice perk
    if (armorItem.perk == ArmorPerkOrSlot.SlotArtifice) {
      let statData = profile.Response.itemComponents.perks.data || {};
      let perks = (statData[d.itemInstanceId || ""] || {})["perks"] || [];
      const hasPerk = perks.filter((p: any) => p.perkHash == 229248542).length > 0;
      if (!hasPerk) armorItem.perk = ArmorPerkOrSlot.None;
      if (armorItem.isExotic && armorItem.slot !== ArmorSlot.ArmorSlotClass) {
        // 720825311 is "UNLOCKED exotic artifice slot"
        const hasPerk = socketsList.filter((d: any) => d == 720825311).length > 0;
        if (hasPerk) {
          armorItem.perk = ArmorPerkOrSlot.SlotArtifice;
        }
      }
    }
  }

  private updateCollectionRolls(
    unlockedExoticArmorItemHashes: Set<number>,
    validManifestArmorMap: Record<string, IManifestArmor>,
    modsMap: Record<string, IManifestArmor>
  ): IInventoryArmor[] {
    return Array.from(unlockedExoticArmorItemHashes)
      .map((exoticItemHash) => {
        const manifestArmorItem = validManifestArmorMap[exoticItemHash];
        if (!manifestArmorItem) {
          this.logger.error(
            "BungieApiService",
            "updateInventory",
            `Couldn't find manifest item for exotic: ${exoticItemHash}`
          );
          return null;
        }

        const collectionItem = createArmorItem(
          manifestArmorItem,
          `c${manifestArmorItem.hash}`,
          InventoryArmorSource.Collections
        );

        collectInvestmentStats(
          collectionItem,
          manifestArmorItem.investmentStats,
          manifestArmorItem.socketEntries.map((s) => s.singleInitialItemHash),
          modsMap
        );

        return collectionItem;
      })
      .filter(Boolean) as IInventoryArmor[];
  }

  private async updateDatabaseItems(newItems: IInventoryArmor[]) {
    await this.db.inventoryArmor.filter((d) => d.source == InventoryArmorSource.Inventory).delete();
    await this.db.inventoryArmor
      .filter((d) => d.source == InventoryArmorSource.Collections)
      .delete();
    const dbItems = await this.db.inventoryArmor.toArray();
    // get the IDs of all items with no source
    const ids_noSource = dbItems
      .filter((d) => d.source == null || d.source == undefined)
      .map((d) => d.id);
    await this.db.inventoryArmor.bulkDelete(ids_noSource);

    await this.db.inventoryArmor.bulkAdd(newItems);
    return;
  }
  /*
    // get all items from the database. This saves us from having to do a lot of slow (!) queries.
    const dbItems = await this.db.inventoryArmor.toArray();

    const newItemInstanceIds = new Set(newItems.map((d) => d.itemInstanceId));
    // get the IDs of all items with no source
    const ids_noSource = dbItems
      .filter((d) => d.source == null || d.source == undefined)
      .map((d) => d.id);
    // get the IDs of all items that are not in the new inventory (and thus should be deleted)
    const ids_deleted = dbItems
      .filter((d) => !newItemInstanceIds.has(d.itemInstanceId))
      .filter((d) => d.source != InventoryArmorSource.Vendor)
      .map((d) => d.id);

    // get the IDs that are in both, the db and the new inventory, and thus should be updated
    let entries_existing = dbItems.filter((d) => newItemInstanceIds.has(d.itemInstanceId));
    // now filter these that actually have changed
    entries_existing = entries_existing.filter((d) => {
      let c = newItems.find((k) => k.itemInstanceId == d.itemInstanceId);
      if (!c) return false;
      // if masterwork, energy, etc change, return true
      if (c.masterworked != d.masterworked) return true;
      if (c.energyLevel != d.energyLevel) return true;
      if (c.perk != d.perk) return true;
      return false;
    });

    // delete the entries
    const idsToDelete = ids_noSource.concat(ids_deleted);
    if (idsToDelete.length > 0) await this.db.inventoryArmor.bulkDelete(idsToDelete);

    // update the entries
    if (entries_existing.length > 0) {
      await this.db.inventoryArmor.bulkUpdate(
        entries_existing.map((d) => {
          return {
            key: d.id,
            changes: {
              masterworked: d.masterworked,
              energyLevel: d.energyLevel,
              perk: d.perk,
              updated_at: Date.now(),
            },
          };
        })
      );
    }

    // add the entries
    const entriesToAdd = newItems.filter(
      (d) => !dbItems.find((k) => k.itemInstanceId == d.itemInstanceId)
    );
    if (entriesToAdd.length > 0) await this.db.inventoryArmor.bulkAdd(entriesToAdd);
  }
    */

  private getArmorPerk(v: DestinyInventoryItemDefinition): ArmorPerkOrSlot {
    // Guardian Games
    if (
      environment.featureFlags.enableGuardianGamesFeatures &&
      (v.hash === 1013401891 || v.hash === 366019830 || v.hash == 537041732)
    )
      return ArmorPerkOrSlot.GuardianGamesClassItem;

    const scks = v.sockets?.socketEntries ?? [];

    // Is this necessary? the singleInitialItemHash is also being checked
    if (scks.find((d) => d.reusablePlugSetHash == 1402)) return ArmorPerkOrSlot.SlotArtifice;
    if (scks.find((d) => d.reusablePlugSetHash == 1403)) return ArmorPerkOrSlot.SlotArtifice;
    if (scks.find((d) => d.reusablePlugSetHash == 1460)) return ArmorPerkOrSlot.SlotArtifice;

    for (const socket of scks) {
      let socketHash = socket.singleInitialItemHash;
      if (!socketHash) continue;

      // Map the socket hash to another perk, if necessary (mostly if the perk exists multiple times)
      socketHash = MapAlternativeToArmorPerkOrSlot[socketHash] || socketHash;

      // find the key of ArmorPerkSocketHashes that matches the socketHash
      const slotType = Object.entries(ArmorPerkSocketHashes).find(
        (kvpair) => kvpair[1] == socketHash
      );
      if (slotType) {
        return parseInt(slotType[0]) as ArmorPerkOrSlot;
      }
    }

    for (const socket of scks) {
      let socketTypeHash = socket.socketTypeHash;
      if (!socketTypeHash) continue;
      let perk = MapAlternativeSocketTypeToArmorPerkOrSlot[socketTypeHash] || ArmorPerkOrSlot.None;
      // find the key of ArmorPerkSocketHashes that matches the socketHash
      if (perk != ArmorPerkOrSlot.None) {
        return perk;
      }
    }

    return ArmorPerkOrSlot.None;
  }

  /**
   * Check if WASM is supported in this environment
   */
  private canUseWASM(): boolean {
    try {
      // Check for WebAssembly support
      if (typeof WebAssembly !== "object" || WebAssembly === null) {
        this.logger.warn("BungieApiService", "canUseWASM", "WebAssembly not supported");
        return false;
      }

      // Check for required APIs
      if (typeof WebAssembly.instantiate !== "function") {
        this.logger.warn("BungieApiService", "canUseWASM", "WebAssembly.instantiate not available");
        return false;
      }

      // Check if we're in a web worker or other restricted environment
      if (typeof window === "undefined" && typeof self === "undefined") {
        this.logger.warn("BungieApiService", "canUseWASM", "No global context available");
        return false;
      }

      return true;
    } catch (error) {
      this.logger.warn(
        "BungieApiService",
        "canUseWASM",
        `WASM compatibility check failed: ${error}`
      );
      return false;
    }
  }

  private async downloadAndProcessSQLiteManifest(
    manifest: DestinyManifest,
    language: string
  ): Promise<Database> {
    const sqlitePath = manifest.mobileWorldContentPaths[language];
    const fullUrl = `https://www.bungie.net${sqlitePath}`;

    this.logger.info(
      "BungieApiService",
      "downloadAndProcessSQLiteManifest",
      `Downloading SQLite manifest ZIP from: ${fullUrl}`
    );

    // Download the ZIP file containing the SQLite database
    const response = await fetch(fullUrl);
    const zipArrayBuffer = await response.arrayBuffer();

    // Extract SQLite database from ZIP
    const JSZipModule = await import("jszip");
    // Handle different export patterns (ESM default vs CJS)
    const JSZip =
      (JSZipModule as any).default ||
      (JSZipModule as any).JSZip ||
      (JSZipModule as any) ||
      JSZipModule;
    const zip = new JSZip();
    const loadedZip = await zip.loadAsync(zipArrayBuffer);

    // Find the SQLite database file in the ZIP (usually has .content extension)
    const dbFileName = Object.keys(loadedZip.files).find(
      (name) => name.endsWith(".content") || name.endsWith(".db") || name.endsWith(".sqlite")
    );

    if (!dbFileName) {
      throw new Error("Could not find SQLite database file in manifest ZIP");
    }

    this.logger.info(
      "BungieApiService",
      "downloadAndProcessSQLiteManifest",
      `Extracting SQLite database: ${dbFileName}`
    );

    // Extract the SQLite database
    const dbFile = loadedZip.files[dbFileName];
    const uint8Array = await dbFile.async("uint8array");

    // Initialize SQL.js with explicit WASM loading
    try {
      const initSqlJs = await import("sql.js");

      // Try loading WASM file explicitly
      const wasmResponse = await fetch("assets/sql-wasm.wasm");
      const wasmBuffer = await wasmResponse.arrayBuffer();

      const SQL = await initSqlJs.default({
        wasmBinary: wasmBuffer,
      });
      const db = new SQL.Database(uint8Array);

      this.logger.info(
        "BungieApiService",
        "downloadAndProcessSQLiteManifest",
        "SQLite database initialized successfully"
      );

      return db;
    } catch (error) {
      this.logger.error(
        "BungieApiService",
        "downloadAndProcessSQLiteManifest",
        `Failed to initialize SQL.js with WASM: ${error}`
      );
      throw error;
    }
  }

  private async updateVendorNamesFromSQLite(db: Database) {
    const result = db.exec("SELECT json FROM DestinyVendorDefinition");
    const vendorInfo: IVendorInfo[] = [];

    if (result.length > 0) {
      for (const row of result[0].values) {
        const vendor = JSON.parse(row[0] as string);
        vendorInfo.push({
          vendorId: vendor.hash,
          vendorName: vendor.displayProperties.name,
          vendorDescription: vendor.displayProperties.description,
          vendorIdentifier: vendor.vendorIdentifier,
        });
      }
    }

    this.logger.info(
      "BungieApiService",
      "updateVendorNamesFromSQLite",
      `Storing ${vendorInfo.length} vendor names in localStorage`
    );
    await this.db.vendorNames.clear();
    await this.db.vendorNames.bulkAdd(vendorInfo);
  }

  private async updateVendorItemSubScreensFromSQLite(db: Database) {
    const result = db.exec(`
      SELECT id, json FROM DestinyInventoryItemDefinition 
      WHERE json LIKE '%"preview":%' 
      AND json LIKE '%"previewVendorHash":%'
      AND JSON_EXTRACT(json, '$.preview.previewVendorHash') IS NOT NULL
      AND JSON_EXTRACT(json, '$.preview.previewVendorHash') != 0
    `);

    const vendorItemSubscreen: IVendorItemSubscreen[] = [];
    if (result.length > 0) {
      for (const row of result[0].values) {
        const item = JSON.parse(row[1] as string);
        vendorItemSubscreen.push({
          itemHash: item.hash,
          vendorHash: item.preview.previewVendorHash,
        });
      }
    }

    await this.db.vendorItemSubscreen.clear();
    this.logger.info(
      "BungieApiService",
      "updateVendorItemSubScreensFromSQLite",
      `Storing ${vendorItemSubscreen.length} vendor item subscreens in localStorage`
    );
    await this.db.vendorItemSubscreen.bulkPut(vendorItemSubscreen);
  }

  private async updateAbilitiesFromSQLite(db: Database) {
    const result = db.exec(`
      SELECT json FROM DestinyInventoryItemDefinition 
      WHERE json LIKE '%"plugCategoryIdentifier":%' 
      AND (
        json LIKE '%".supers"%' OR 
        json LIKE '%".grenades"%' OR 
        json LIKE '%".class_abilities"%' OR 
        json LIKE '%".melee"%' OR 
        json LIKE '%".aspects"%' OR 
        json LIKE '%".fragments"%'
      )
    `);

    const allAbilities: any[] = [];
    if (result.length > 0) {
      for (const row of result[0].values) {
        const item = JSON.parse(row[0] as string);
        allAbilities.push(item);
      }
    }

    this.logger.info(
      "BungieApiService",
      "updateAbilitiesFromSQLite",
      `Storing ${allAbilities.length} ability hashes in database`
    );
    await this.db.writeCharacterAbilities(allAbilities);
  }

  private async updateExoticCollectiblesFromSQLite(db: Database) {
    const result = db.exec(`
      SELECT c.id as collectible_hash, c.json as collectible_json, i.json as item_json
      FROM DestinyCollectibleDefinition c
      JOIN DestinyInventoryItemDefinition i ON JSON_EXTRACT(c.json, '$.itemHash') = i.id
      WHERE JSON_EXTRACT(i.json, '$.inventory.tierType') = 6 
      AND JSON_EXTRACT(i.json, '$.itemType') = 2
    `);

    const exoticArmorCollectibles: IManifestCollectible[] = [];
    if (result.length > 0) {
      for (const row of result[0].values) {
        const collectibleHash = row[0] as number;
        const collectibleData = JSON.parse(row[1] as string);
        exoticArmorCollectibles.push({
          hash: collectibleHash,
          itemHash: collectibleData.itemHash,
        });
      }
    }

    this.logger.info(
      "BungieApiService",
      "updateExoticCollectiblesFromSQLite",
      `Storing ${exoticArmorCollectibles.length} exotic armor hashes`
    );
    await this.db.manifestCollectibles.clear();
    await this.db.manifestCollectibles.bulkPut(exoticArmorCollectibles);
  }

  private updateSandboxPerksFromSQLite(db: Database) {
    const result = db.exec("SELECT json FROM DestinySandboxPerkDefinition");
    const mappedSandboxPerks: DestinySandboxPerkDefinition[] = [];

    if (result.length > 0) {
      for (const row of result[0].values) {
        mappedSandboxPerks.push(JSON.parse(row[0] as string));
      }
    }

    if (mappedSandboxPerks.length === 0) {
      this.logger.warn(
        "BungieApiService",
        "updateSandboxPerksFromSQLite",
        "No sandbox perks found in database"
      );
      return;
    }

    this.db.sandboxPerkDefinition.clear();
    this.logger.info(
      "BungieApiService",
      "updateSandboxPerksFromSQLite",
      `Storing ${mappedSandboxPerks.length} sandbox perks in localStorage`
    );
    this.db.sandboxPerkDefinition.bulkPut(mappedSandboxPerks);
  }

  private updateEquipableItemSetDefinitionsFromSQLite(db: Database) {
    const result = db.exec("SELECT json FROM DestinyEquipableItemSetDefinition");
    const mapped: DestinyEquipableItemSetDefinition[] = [];

    if (result.length > 0) {
      for (const row of result[0].values) {
        mapped.push(JSON.parse(row[0] as string));
      }
    }

    if (mapped.length === 0) {
      this.logger.warn(
        "BungieApiService",
        "updateEquipableItemSetDefinitionsFromSQLite",
        "No equipable item set definitions found in database"
      );
      return;
    }
    this.db.equipableItemSetDefinition.clear();
    this.logger.info(
      "BungieApiService",
      "updateEquipableItemSetDefinitionsFromSQLite",
      `Storing ${mapped.length} equipable item set definitions in localStorage`
    );
    this.db.equipableItemSetDefinition.bulkPut(mapped);
  }

  private async extractArmorDataFromSQLiteManifest(db: Database) {
    // Load supporting tables for lookups during processing
    const collectiblesMap: Record<number, DestinyCollectibleDefinition> = {};
    const presentationNodesMap: Record<number, DestinyPresentationNodeDefinition> = {};
    const socketTypesMap: Record<number, DestinySocketTypeDefinition> = {};
    const equipableItemSetsArray: DestinyEquipableItemSetDefinition[] = [];

    // Load supporting data efficiently
    const collectiblesResult = db.exec("SELECT json FROM DestinyCollectibleDefinition");
    if (collectiblesResult.length > 0) {
      for (const row of collectiblesResult[0].values) {
        const collectible = JSON.parse(row[0] as string);
        collectiblesMap[collectible.hash] = collectible;
      }
    }

    const presentationNodesResult = db.exec("SELECT json FROM DestinyPresentationNodeDefinition");
    if (presentationNodesResult.length > 0) {
      for (const row of presentationNodesResult[0].values) {
        const node = JSON.parse(row[0] as string);
        presentationNodesMap[node.hash] = node;
      }
    }

    const socketTypesResult = db.exec("SELECT json FROM DestinySocketTypeDefinition");
    if (socketTypesResult.length > 0) {
      for (const row of socketTypesResult[0].values) {
        const socketType = JSON.parse(row[0] as string);
        socketTypesMap[socketType.hash] = socketType;
      }
    }

    const equipableItemSetsResult = db.exec("SELECT json FROM DestinyEquipableItemSetDefinition");
    if (equipableItemSetsResult.length > 0) {
      for (const row of equipableItemSetsResult[0].values) {
        const equipableItemSet = JSON.parse(row[0] as string);
        equipableItemSetsArray.push(equipableItemSet);
      }
    }

    // Query for relevant items using SQL filtering
    const result = db.exec(`
      SELECT json FROM DestinyInventoryItemDefinition 
      WHERE 
        JSON_EXTRACT(json, '$.itemType') = 19 OR  -- mods
        (JSON_EXTRACT(json, '$.itemType') = 16 AND json LIKE '%"itemCategoryHashes"%' AND json LIKE '%50%') OR  -- subclasses
        JSON_EXTRACT(json, '$.itemType') = 2 OR  -- armor
        JSON_EXTRACT(json, '$.inventory.bucketTypeHash') = 3448274439 OR  -- helmets
        JSON_EXTRACT(json, '$.inventory.bucketTypeHash') = 3551918588 OR  -- gauntlets
        JSON_EXTRACT(json, '$.inventory.bucketTypeHash') = 14239492 OR   -- chest
        JSON_EXTRACT(json, '$.inventory.bucketTypeHash') = 20886954 OR   -- legs
        (JSON_EXTRACT(json, '$.inventory.bucketTypeHash') = 1585787867 AND JSON_EXTRACT(json, '$.inventory.tierType') = 6)  -- exotic class items
    `);

    // NOTE: This is also storing emotes, as these have itemType 19 (mods)
    const entries: IManifestArmor[] = [];

    if (result.length > 0) {
      for (const row of result[0].values) {
        const v: DestinyInventoryItemDefinition = JSON.parse(row[0] as string);

        if (
          v.itemType == 16 &&
          (!v.itemCategoryHashes || v.itemCategoryHashes.indexOf(50) === -1)
        ) {
          continue;
        }

        let slot = ArmorSlot.ArmorSlotNone;
        if (
          v.inventory?.bucketTypeHash == 3448274439 ||
          (v.itemCategoryHashes?.indexOf(45) || -1) > -1
        )
          slot = ArmorSlot.ArmorSlotHelmet;
        if (
          v.inventory?.bucketTypeHash == 3551918588 ||
          (v.itemCategoryHashes?.indexOf(46) || -1) > -1
        )
          slot = ArmorSlot.ArmorSlotGauntlet;
        if (
          v.inventory?.bucketTypeHash == 14239492 ||
          (v.itemCategoryHashes?.indexOf(47) || -1) > -1
        )
          slot = ArmorSlot.ArmorSlotChest;
        if (
          v.inventory?.bucketTypeHash == 20886954 ||
          (v.itemCategoryHashes?.indexOf(48) || -1) > -1
        )
          slot = ArmorSlot.ArmorSlotLegs;
        if (
          v.inventory?.bucketTypeHash == 1585787867 ||
          (v.itemCategoryHashes?.indexOf(49) || -1) > -1
        )
          slot = ArmorSlot.ArmorSlotClass;

        const isArmor2 =
          (
            v.sockets?.socketEntries.filter((d) => {
              return (
                d.socketTypeHash == 2512726577 || // general
                d.socketTypeHash == 1108765570 || // arms
                d.socketTypeHash == 959256494 || // chest
                d.socketTypeHash == 2512726577 || // class
                d.socketTypeHash == 3219375296 || // legs
                d.socketTypeHash == 968742181 // head
              );
            }) || []
          ).length > 0;

        const isExotic = v.inventory?.tierType == 6;
        let exoticPerkHash: number[] = [];
        if (isExotic) {
          const perks =
            v.sockets?.socketEntries
              .filter((s) => s.socketTypeHash == 965959289)
              .map((d) => d.singleInitialItemHash) || [];
          exoticPerkHash = perks.filter((p) => p !== undefined && p !== null);
        }

        var sunsetPowerCaps = [
          1862490585, // 1260
          1862490584, // 1060
          1862490584, // 1060
          1862490583, // 1060
          2471437758, // 1010
        ];
        // if every entry is sunset, so is this item.
        var isSunset =
          v.quality?.versions.filter((k) => sunsetPowerCaps.includes(k.powerCapHash)).length ==
          v.quality?.versions.length;

        var clasz = v.classType;
        if (clasz == DestinyClass.Unknown && isArmor2) {
          if (v.collectibleHash != undefined) {
            let presentationParentNode = collectiblesMap[v.collectibleHash]?.parentNodeHashes;
            if (presentationParentNode !== undefined) {
              if (
                presentationParentNode.findIndex(
                  (x) => presentationNodesMap[x]?.displayProperties.name == "Warlock"
                ) != -1
              )
                clasz = DestinyClass.Warlock;
              if (
                presentationParentNode.findIndex(
                  (x) => presentationNodesMap[x]?.displayProperties.name == "Titan"
                ) != -1
              )
                clasz = DestinyClass.Titan;
              if (
                presentationParentNode.findIndex(
                  (x) => presentationNodesMap[x]?.displayProperties.name == "Hunter"
                ) != -1
              )
                clasz = DestinyClass.Hunter;
            }
          }

          if (clasz == DestinyClass.Unknown && isArmor2) {
            v.sockets?.socketEntries.forEach((a) => {
              let socketDef = socketTypesMap[a.socketTypeHash];
              if (socketDef !== undefined) {
                if (
                  socketDef.plugWhitelist.findIndex((x) =>
                    x.categoryIdentifier.includes("warlock")
                  ) != -1
                ) {
                  clasz = DestinyClass.Warlock;
                  return;
                }
                if (
                  socketDef.plugWhitelist.findIndex((x) =>
                    x.categoryIdentifier.includes("titan")
                  ) != -1
                ) {
                  clasz = DestinyClass.Titan;
                  return;
                }
                if (
                  socketDef.plugWhitelist.findIndex((x) =>
                    x.categoryIdentifier.includes("hunter")
                  ) != -1
                ) {
                  clasz = DestinyClass.Hunter;
                  return;
                }
              }
            });
          }
        }

        const isFeatured = !!(v as any)?.isFeaturedItem;

        entries.push({
          hash: v.hash,
          icon: v.displayProperties.icon,
          watermarkIcon: isFeatured ? (v as any).iconWatermarkFeatured : v.iconWatermark,
          name: v.displayProperties.name,
          description: v.displayProperties.description,
          clazz: clasz,
          armorSystem: isArmor2 ? 2 : 1, // TODO: There may be a smarter way
          slot: slot,
          isExotic: isExotic ? 1 : 0,
          isSunset: isSunset,
          rarity: v.inventory?.tierType,
          exoticPerkHash: exoticPerkHash,
          itemType: v.itemType,
          itemSubType: v.itemSubType,
          investmentStats: v.investmentStats,
          // TODO: fix as soon as DIM Api is updated
          perk: this.getArmorPerk(v),
          gearSetHash: this.getGearSet(v, equipableItemSetsArray),
          socketEntries: v.sockets?.socketEntries ?? [],
          isFeatured: isFeatured,
        } as IManifestArmor);
      }
    }

    return entries;
  }

  private async updateVendorNamesFromJSON(
    manifestTables: DestinyManifestSlice<"DestinyVendorDefinition"[]>
  ) {
    const vendors = manifestTables.DestinyVendorDefinition;

    // get values
    const vendorInfo: IVendorInfo[] = Object.values(vendors).map((v) => {
      return {
        vendorId: v.hash,
        vendorName: v.displayProperties.name,
        vendorDescription: v.displayProperties.description,
        vendorIdentifier: v.vendorIdentifier,
      } as IVendorInfo;
    });
    this.logger.info(
      "BungieApiService",
      "updateVendorNames",
      `Storing ${vendorInfo.length} vendor names in localStorage`
    );
    await this.db.vendorNames.clear();
    await this.db.vendorNames.bulkAdd(vendorInfo);
  }

  private async updateVendorItemSubScreensFromJSON(
    manifestTables: DestinyManifestSlice<"DestinyInventoryItemDefinition"[]>
  ) {
    const items = Object.values(manifestTables.DestinyInventoryItemDefinition);

    let vendorItemSubscreen = items
      .filter((x) => x.preview?.previewVendorHash != undefined && x.preview?.previewVendorHash != 0)
      .map((x) => {
        return {
          itemHash: x.hash,
          vendorHash: x.preview!.previewVendorHash,
        } as IVendorItemSubscreen;
      });
    await this.db.vendorItemSubscreen.clear();
    this.logger.info(
      "BungieApiService",
      "updateVendorItemSubScreens",
      `Storing ${vendorItemSubscreen.length} vendor item subscreens in localStorage`
    );
    await this.db.vendorItemSubscreen.bulkPut(vendorItemSubscreen);
  }

  private async updateAbilitiesFromJSON(
    manifestTables: DestinyManifestSlice<"DestinyInventoryItemDefinition"[]>
  ) {
    const allAbilities = Object.values(manifestTables.DestinyInventoryItemDefinition).filter(
      (item) => {
        // e.g. "hunter.arc.supers", "shared.arc.grenades"
        return item.plug?.plugCategoryIdentifier?.match(
          /\.(supers|grenades|class_abilities|melee|aspects|fragments)$/
        );
      }
    );
    this.logger.info(
      "BungieApiService",
      "updateAbilities",
      `Storing ${allAbilities.length} ability hashes in database`
    );
    await this.db.writeCharacterAbilities(allAbilities);
  }

  // Collect the data for exotic armor collectibles
  // this allows us to map a collection entry hash to the associated armor inventory item hash
  private async updateExoticCollectiblesFromJSON(
    manifestTables: DestinyManifestSlice<
      ("DestinyCollectibleDefinition" | "DestinyInventoryItemDefinition")[]
    >
  ) {
    const exoticArmorCollectibles: IManifestCollectible[] = Object.entries(
      manifestTables.DestinyCollectibleDefinition
    )
      .filter(([k, v]) => {
        const item = manifestTables.DestinyInventoryItemDefinition[v.itemHash];
        return item?.inventory?.tierType == 6 && item?.itemType == DestinyItemType.Armor;
      })
      .map(([k, v]) => {
        return {
          hash: parseInt(k),
          itemHash: v.itemHash,
        };
      });

    this.logger.info(
      "BungieApiService",
      "updateExoticCollectibles",
      `Storing ${exoticArmorCollectibles.length} exotic armor hashes`
    );
    await this.db.manifestCollectibles.clear();
    await this.db.manifestCollectibles.bulkPut(exoticArmorCollectibles);
  }

  isManifestCacheValid(manifestCache: { updatedAt: number; version: string }) {
    if (environment.offlineMode) {
      this.logger.debug(
        "BungieApiService",
        "isManifestCacheValid",
        "marking manifest cache as valid due to offline mode"
      );
      return true;
    }
    if (Date.now() - manifestCache.updatedAt < 1000 * 3600 * 24) {
      this.logger.debug(
        "BungieApiService",
        "isManifestCacheValid",
        "marking manifest cache as valid, Manifest is less than a day old"
      );
      return true;
    }
    return false;
  }

  isCharacterCacheValid(characterCache: { updatedAt: number; characters: any[] }) {
    if (environment.offlineMode) {
      this.logger.debug(
        "BungieApiService",
        "isCharacterCacheValid",
        "marking character cache as valid due to offline mode"
      );
      return true;
    }

    // Check if we have cached characters data
    if (!characterCache || !characterCache.characters || characterCache.characters.length === 0) {
      this.logger.debug(
        "BungieApiService",
        "isCharacterCacheValid",
        "no character data in cache, marking as invalid"
      );
      return false;
    }

    // Character data is considered valid for 24 hours (same as manifest cache)
    if (Date.now() - characterCache.updatedAt < 1000 * 3600 * 24) {
      this.logger.debug(
        "BungieApiService",
        "isCharacterCacheValid",
        "marking character cache as valid, Character data is less than a day old"
      );
      return true;
    }
    return false;
  }

  async updateManifest(force = false): Promise<boolean> {
    const manifestCache = this.db.lastManifestUpdate();
    let destinyManifest = null;
    if (manifestCache && !force) {
      let isCacheValid = this.isManifestCacheValid(manifestCache);

      if (!isCacheValid) {
        this.logger.info(
          "BungieApiService",
          "updateManifest",
          "Manifest Cache is considered invalid, Checking manifest version"
        );
        destinyManifest = await getDestinyManifest((d) => this.http.$httpWithoutBearerToken(d));
        const version = destinyManifest.Response.version;
        if (manifestCache.version == version) {
          this.logger.info("BungieApiService", "updateManifest", "Manifest is last version");
          isCacheValid = true;
        } else {
          this.logger.info(
            "BungieApiService",
            "updateManifest",
            `Manifest version has changed. Cache version: ${manifestCache.version}, Current version: ${version}`
          );
        }
      }
      if (isCacheValid) {
        this.logger.info(
          "BungieApiService",
          "updateManifest",
          "Manifest cache is valid, skipping update"
        );
        if (!this.manifestAlreadyUpdated) {
          this.manifestAlreadyUpdated = true;
          this.manifestUpdatedSubject.next();
        }
        return false;
      }
    }

    this.logger.info("BungieApiService", "updateManifest", "Requesting manifest");

    if (destinyManifest == null) {
      destinyManifest = await getDestinyManifest((d) => this.http.$httpWithoutBearerToken(d));
    }
    this.logger.info(
      "BungieApiService",
      "updateManifest",
      `Manifest version: ${destinyManifest.Response.version}`
    );

    // Try SQLite first if WASM is supported, fallback to slice manifest
    const canUseSQLite = this.canUseWASM();
    let manifestTables: DestinyManifestSlice<(keyof AllDestinyManifestComponents)[]> | null = null;

    if (canUseSQLite) {
      try {
        this.logger.info(
          "BungieApiService",
          "updateManifest",
          "WASM supported, attempting SQLite manifest download"
        );

        // Download SQLite database
        const db = await this.downloadAndProcessSQLiteManifest(destinyManifest.Response, "en");

        this.logger.info(
          "BungieApiService",
          "updateManifest",
          "SQLite manifest database downloaded successfully, processing data"
        );

        try {
          // Process all data using SQLite methods
          await this.updateAbilitiesFromSQLite(db);
          await this.updateExoticCollectiblesFromSQLite(db);
          await this.updateVendorNamesFromSQLite(db);
          await this.updateVendorItemSubScreensFromSQLite(db);
          this.updateEquipableItemSetDefinitionsFromSQLite(db);
          this.updateSandboxPerksFromSQLite(db);

          const manifestVersion = destinyManifest.Response.version;
          let entries = await this.extractArmorDataFromSQLiteManifest(db);

          await this.db.writeManifestArmor(entries, manifestVersion);
        } finally {
          // Clean up database connection
          if (db && typeof db.close === "function") {
            db.close();
          }
        }

        this.manifestUpdatedSubject.next();
        return true;
      } catch (sqliteError) {
        this.logger.warn(
          "BungieApiService",
          "updateManifest",
          `SQLite manifest processing failed, falling back to slice manifest: ${sqliteError}`
        );
        // Continue to fallback method below
      }
    } else {
      this.logger.info(
        "BungieApiService",
        "updateManifest",
        "WASM not supported or disabled, using slice manifest"
      );
    }

    // Fallback to original slice manifest method
    this.logger.info("BungieApiService", "updateManifest", "Using slice manifest method");

    manifestTables = await getDestinyManifestSlice((d) => this.http.$httpWithoutApiKey(d), {
      destinyManifest: destinyManifest.Response,
      tableNames: [
        "DestinyInventoryItemDefinition",
        "DestinyCollectibleDefinition",
        "DestinyVendorDefinition",
        "DestinySocketTypeDefinition",
        "DestinyEquipableItemSetDefinition",
        "DestinySandboxPerkDefinition",
      ] as any as DestinyManifestComponentName[],
      language: "en",
    });
    this.logger.info(
      "BungieApiService",
      "updateManifest",
      `Fetched manifest tables: ${Object.keys(manifestTables).join(", ")}`
    );

    // Call updates on individual manifest tables
    await this.updateAbilitiesFromJSON(manifestTables);
    await this.updateExoticCollectiblesFromJSON(manifestTables);
    await this.updateVendorNamesFromJSON(manifestTables);
    await this.updateVendorItemSubScreensFromJSON(manifestTables);
    this.updateEquipableItemSetDefinitionsFromJSON(manifestTables);
    this.updateSandboxPerksFromJSON(manifestTables);

    const manifestVersion = destinyManifest.Response.version;

    let entries = await this.extractArmorDataFromJSONManifest(manifestTables);

    await this.db.writeManifestArmor(entries, manifestVersion);
    this.manifestUpdatedSubject.next();
    return true;
  }

  private async extractArmorDataFromJSONManifest(
    manifestTables: DestinyManifestSlice<(keyof AllDestinyManifestComponents)[]>
  ) {
    // NOTE: This is also storing emotes, as these have itemType 19 (mods)
    let entries = Object.entries(manifestTables.DestinyInventoryItemDefinition)
      .filter(([k, v]) => {
        if (v.itemType == 19) return true; // mods
        if (v.itemType == 16 && v.itemCategoryHashes && v.itemCategoryHashes.indexOf(50) > -1)
          return true; // subclasses
        if (v.itemType == 2) return true; // armor
        if (v.inventory?.bucketTypeHash == 3448274439) return true; // helmets, required for festival masks
        if (v.inventory?.bucketTypeHash == 3551918588) return true; // gauntlets
        if (v.inventory?.bucketTypeHash == 14239492) return true; // chest
        if (v.inventory?.bucketTypeHash == 20886954) return true; // leg
        if (v.inventory?.bucketTypeHash == 1585787867 && v.inventory.tierType == 6) return true; // exotic class items
        return false;
      })
      .map(([k, v]) => {
        let slot = ArmorSlot.ArmorSlotNone;
        if (
          v.inventory?.bucketTypeHash == 3448274439 ||
          (v.itemCategoryHashes?.indexOf(45) || -1) > -1
        )
          slot = ArmorSlot.ArmorSlotHelmet;
        if (
          v.inventory?.bucketTypeHash == 3551918588 ||
          (v.itemCategoryHashes?.indexOf(46) || -1) > -1
        )
          slot = ArmorSlot.ArmorSlotGauntlet;
        if (
          v.inventory?.bucketTypeHash == 14239492 ||
          (v.itemCategoryHashes?.indexOf(47) || -1) > -1
        )
          slot = ArmorSlot.ArmorSlotChest;
        if (
          v.inventory?.bucketTypeHash == 20886954 ||
          (v.itemCategoryHashes?.indexOf(48) || -1) > -1
        )
          slot = ArmorSlot.ArmorSlotLegs;
        if (
          v.inventory?.bucketTypeHash == 1585787867 ||
          (v.itemCategoryHashes?.indexOf(49) || -1) > -1
        )
          slot = ArmorSlot.ArmorSlotClass;

        const isArmor2 =
          (
            v.sockets?.socketEntries.filter((d) => {
              return (
                d.socketTypeHash == 2512726577 || // general
                d.socketTypeHash == 1108765570 || // arms
                d.socketTypeHash == 959256494 || // chest
                d.socketTypeHash == 2512726577 || // class
                d.socketTypeHash == 3219375296 || // legs
                d.socketTypeHash == 968742181 // head
              );
            }) || []
          ).length > 0;

        const isExotic = v.inventory?.tierType == 6;
        let exoticPerkHash: number[] = [];
        if (isExotic) {
          const perks =
            v.sockets?.socketEntries
              .filter((s) => s.socketTypeHash == 965959289)
              .map((d) => d.singleInitialItemHash) || [];
          exoticPerkHash = perks.filter((p) => p !== undefined && p !== null);
        }

        var sunsetPowerCaps = [
          1862490585, // 1260
          1862490584, // 1060
          1862490584, // 1060
          1862490583, // 1060
          2471437758, // 1010
        ];
        // if every entry is sunset, so is this item.
        var isSunset =
          v.quality?.versions.filter((k) => sunsetPowerCaps.includes(k.powerCapHash)).length ==
          v.quality?.versions.length;

        var clasz = v.classType;
        if (clasz == DestinyClass.Unknown && isArmor2) {
          if (v.collectibleHash != undefined) {
            let presentationParentNode =
              manifestTables.DestinyCollectibleDefinition[v.collectibleHash].parentNodeHashes;
            if (presentationParentNode !== undefined) {
              if (
                presentationParentNode.findIndex(
                  (x) =>
                    manifestTables.DestinyPresentationNodeDefinition[x].displayProperties.name ==
                    "Warlock"
                ) != -1
              )
                clasz = DestinyClass.Warlock;
              if (
                presentationParentNode.findIndex(
                  (x) =>
                    manifestTables.DestinyPresentationNodeDefinition[x].displayProperties.name ==
                    "Titan"
                ) != -1
              )
                clasz = DestinyClass.Titan;
              if (
                presentationParentNode.findIndex(
                  (x) =>
                    manifestTables.DestinyPresentationNodeDefinition[x].displayProperties.name ==
                    "Hunter"
                ) != -1
              )
                clasz = DestinyClass.Hunter;
            }
          }

          if (clasz == DestinyClass.Unknown && isArmor2) {
            v.sockets?.socketEntries.forEach((a) => {
              let socketDef = manifestTables.DestinySocketTypeDefinition[a.socketTypeHash];
              if (socketDef !== undefined) {
                if (
                  socketDef.plugWhitelist.findIndex((x) =>
                    x.categoryIdentifier.includes("warlock")
                  ) != -1
                ) {
                  clasz = DestinyClass.Warlock;
                  return;
                }
                if (
                  socketDef.plugWhitelist.findIndex((x) =>
                    x.categoryIdentifier.includes("titan")
                  ) != -1
                ) {
                  clasz = DestinyClass.Titan;
                  return;
                }
                if (
                  socketDef.plugWhitelist.findIndex((x) =>
                    x.categoryIdentifier.includes("hunter")
                  ) != -1
                ) {
                  clasz = DestinyClass.Hunter;
                  return;
                }
              }
            });
          }
        }

        const isFeatured = !!(v as any)?.isFeaturedItem;
        return {
          hash: v.hash,
          icon: v.displayProperties.icon,
          watermarkIcon: isFeatured ? (v as any).iconWatermarkFeatured : v.iconWatermark,
          name: v.displayProperties.name,
          description: v.displayProperties.description,
          clazz: clasz,
          armorSystem: isArmor2 ? 2 : 1, // TODO: There may be a smarter way
          slot: slot,
          isExotic: isExotic ? 1 : 0,
          isSunset: isSunset,
          rarity: v.inventory?.tierType,
          exoticPerkHash: exoticPerkHash,
          itemType: v.itemType,
          itemSubType: v.itemSubType,
          investmentStats: v.investmentStats,
          // TODO: fix as soon as DIM Api is updated
          perk: this.getArmorPerk(v),
          gearSetHash: this.getGearSet(
            v,
            (manifestTables as any).DestinyEquipableItemSetDefinition
          ),
          socketEntries: v.sockets?.socketEntries ?? [],
          isFeatured: isFeatured,
        } as IManifestArmor;
      });
    return entries;
  }

  getGearSet(
    v: DestinyInventoryItemDefinition,
    itemSetDefinitions: DestinyEquipableItemSetDefinition[]
  ) {
    for (const itemSet of Object.values(itemSetDefinitions)) {
      if (itemSet.setItems.indexOf(v.hash) > -1) {
        return itemSet.hash;
      }
    }
    return null;
  }

  updateSandboxPerksFromJSON(
    manifestTables: DestinyManifestSlice<"DestinySandboxPerkDefinition"[]>
  ) {
    const sandboxPerks = manifestTables.DestinySandboxPerkDefinition;
    if (!sandboxPerks) {
      this.logger.warn(
        "BungieApiService",
        "updateSandboxPerksFromJSON",
        "No sandbox perks found in manifest"
      );
      return;
    }

    const mappedSandboxPerks = Object.entries(sandboxPerks).map(([key, value]) => {
      return value;
    });

    this.db.sandboxPerkDefinition.clear();
    this.logger.info(
      "BungieApiService",
      "updateSandboxPerks",
      `Storing ${mappedSandboxPerks.length} sandbox perks in localStorage`
    );
    this.db.sandboxPerkDefinition.bulkPut(mappedSandboxPerks);
  }

  updateEquipableItemSetDefinitionsFromJSON(
    manifestTables: DestinyManifestSlice<(keyof AllDestinyManifestComponents)[]>
  ) {
    const equipableItemSetDefinitions = (manifestTables as any)
      .DestinyEquipableItemSetDefinition as { [key: string]: DestinyEquipableItemSetDefinition };
    if (!equipableItemSetDefinitions) {
      this.logger.warn(
        "BungieApiService",
        "updateEquipableItemSetDefinitionsFromJSON",
        "No equipable item set definitions found in manifest"
      );
      return;
    }
    this.db.equipableItemSetDefinition.clear();

    const mapped = Object.entries(equipableItemSetDefinitions).map(([key, value]) => {
      return value as DestinyEquipableItemSetDefinition;
    });
    this.logger.info(
      "BungieApiService",
      "updateEquipableItemSetDefinitions",
      `Storing ${mapped.length} equipable item set definitions in localStorage`
    );
    this.db.equipableItemSetDefinition.bulkPut(mapped);
  }

  async moveItem(
    itemInstanceId: string,
    sourceCharacterId: string,
    targetCharacterId: string
  ): Promise<boolean> {
    let destinyMembership = await this.membership.getMembershipDataForCurrentUser();
    if (!destinyMembership) {
      if (!this.status.getStatus().apiError) this.status.setAuthError();
      return false;
    }
    this.status.clearAuthError();
    this.status.clearApiError();

    const item = await getItem((d) => this.http.$http(d, false), {
      membershipType: destinyMembership.membershipType,
      destinyMembershipId: destinyMembership.membershipId,
      itemInstanceId: itemInstanceId,
      components: [DestinyComponentType.ItemCommonData],
    });

    if (!item) return false;

    // If the item is already on the target character, do nothing
    if (item.Response.characterId === targetCharacterId) return true;

    // If the item is not in the vault, move it to the vault first
    if (item.Response.item.data?.location !== 2) {
      await this.moveItemToVault(itemInstanceId);
    }

    // Now transfer from vault to the target character
    return this.transferItem(itemInstanceId, targetCharacterId);
  }

  async swapItems(
    itemInstanceId1: string,
    itemInstanceId2: string,
    characterId: string
  ): Promise<boolean> {
    let destinyMembership = await this.membership.getMembershipDataForCurrentUser();
    if (!destinyMembership) {
      if (!this.status.getStatus().apiError) this.status.setAuthError();
      return false;
    }
    this.status.clearAuthError();
    this.status.clearApiError();

    // Get both items
    const item1 = await getItem((d) => this.http.$http(d, false), {
      membershipType: destinyMembership.membershipType,
      destinyMembershipId: destinyMembership.membershipId,
      itemInstanceId: itemInstanceId1,
      components: [DestinyComponentType.ItemCommonData],
    });
    const item2 = await getItem((d) => this.http.$http(d, false), {
      membershipType: destinyMembership.membershipType,
      destinyMembershipId: destinyMembership.membershipId,
      itemInstanceId: itemInstanceId2,
      components: [DestinyComponentType.ItemCommonData],
    });

    if (!item1 || !item2) return false;

    // If both items are on the same character, we can't really swap them in-place
    // So we'll move item1 to vault and then transfer item2 to the character
    if (item1.Response.characterId === item2.Response.characterId) {
      await this.moveItemToVault(itemInstanceId1);
      // Item2 is already on the target character, so we're done
      return true;
    }

    // Otherwise, move item 1 to vault (if not already there) and then transfer item 2 to item 1's previous location
    await this.moveItemToVault(itemInstanceId1);

    return this.transferItem(itemInstanceId2, item1.Response.characterId || "");
  }

  async equipItemById(itemInstanceId: string, characterId: string): Promise<boolean> {
    let destinyMembership = await this.membership.getMembershipDataForCurrentUser();
    if (!destinyMembership) {
      if (!this.status.getStatus().apiError) this.status.setAuthError();
      return false;
    }
    this.status.clearAuthError();
    this.status.clearApiError();

    const item = await getItem((d) => this.http.$http(d, false), {
      membershipType: destinyMembership.membershipType,
      destinyMembershipId: destinyMembership.membershipId,
      itemInstanceId: itemInstanceId,
      components: [DestinyComponentType.ItemCommonData],
    });

    if (!item) return false;

    const payload = {
      characterId: characterId,
      membershipType: destinyMembership.membershipType,
      stackSize: 1,
      itemId: item.Response.item.data?.itemInstanceId || "",
      itemReferenceHash: item.Response.item.data?.itemHash || 0,
    };

    return !!(await equipItem((d) => this.http.$httpPost(d), payload));
  }

  /**
   * Gets the character ID for the configured character class
   */
  async getCharacterIdForCurrentClass(): Promise<string | null> {
    const config = this.config.readonlyConfigurationSnapshot;
    let characters = await this.membership.getCharacters();
    characters = characters.filter((c: any) => c.clazz == config.characterClass);

    if (characters.length == 0) {
      return null;
    }

    return characters[0].characterId;
  }

  /**
   * Moves all items from a result to the character's inventory
   * @param result The result definition containing items to move
   * @param equip Whether to equip the items after moving them
   * @returns Promise<{success: boolean, allSuccessful: boolean}>
   */
  async moveResultItems(
    result: ResultDefinition,
    equip = false
  ): Promise<{ success: boolean; allSuccessful: boolean }> {
    // Set all items to waiting state
    for (let item of (result?.items || []).flat()) {
      item.transferState = ResultItemMoveState.WAITING_FOR_TRANSFER;
    }

    const characterId = await this.getCharacterIdForCurrentClass();
    if (!characterId) {
      // Reset transfer states on error
      for (let item of (result?.items || []).flat()) {
        item.transferState = ResultItemMoveState.ERROR_DURING_TRANSFER;
      }
      return { success: false, allSuccessful: false };
    }

    let allSuccessful = true;
    // Sort items so exotics are moved last (they might need special handling)
    const items = (result?.items || []).flat().sort((i) => (i.exotic ? 1 : -1));

    for (let item of items) {
      item.transferState = ResultItemMoveState.TRANSFERRING;
      const success = await this.transferItem(item.itemInstanceId, characterId, equip);
      item.transferState = success
        ? ResultItemMoveState.TRANSFERRED
        : ResultItemMoveState.ERROR_DURING_TRANSFER;

      if (!success) {
        allSuccessful = false;
      }
    }

    return { success: true, allSuccessful };
  }

  /**
   * Imports currently equipped exotic armor and updates the configuration accordingly
   */
  async importCurrentlyEquippedExotic(): Promise<boolean> {
    if (environment.offlineMode) {
      this.logger.info(
        "BungieApiService",
        "importCurrentlyEquippedExotic",
        "offline mode, skipping"
      );
      return false;
    }

    let destinyMembership = await this.membership.getMembershipDataForCurrentUser();
    if (!destinyMembership) {
      if (!this.status.getStatus().apiError) this.status.setAuthError();
      return false;
    }
    this.status.clearAuthError();
    this.status.clearApiError();

    const characterId = await this.getCharacterIdForCurrentClass();
    if (!characterId) {
      this.logger.warn(
        "BungieApiService",
        "importCurrentlyEquippedExotic",
        "No character found for current class"
      );
      return false;
    }

    this.logger.info(
      "BungieApiService",
      "importCurrentlyEquippedExotic",
      `Importing equipped exotic for character ${characterId}`
    );

    let profile = await getProfile((d) => this.http.$http(d, true), {
      components: [
        DestinyComponentType.CharacterEquipment,
        DestinyComponentType.ItemSockets,
        DestinyComponentType.ItemInstances,
      ],
      membershipType: destinyMembership.membershipType,
      destinyMembershipId: destinyMembership.membershipId,
    });

    const characterEquipment = profile.Response.characterEquipment.data?.[characterId];
    if (!characterEquipment) {
      this.logger.warn(
        "BungieApiService",
        "importCurrentlyEquippedExotic",
        "No equipment data found for character"
      );
      return false;
    }

    const manifestArmor = await this.db.manifestArmor.toArray();
    const manifestArmorMap = Object.fromEntries(manifestArmor.map((_) => [_.hash, _]));

    let updatedConfig = false;

    // Import exotic armor
    const exoticArmor = characterEquipment.items.find((item) => {
      const manifest = manifestArmorMap[item.itemHash];
      return manifest && manifest.isExotic === 1 && manifest.itemType === 2; // Armor type
    });

    if (exoticArmor) {
      const manifestItem = manifestArmorMap[exoticArmor.itemHash];
      if (manifestItem) {
        // Find all variants of this exotic armor piece
        const exoticVariants = manifestArmor
          .filter(
            (armor) =>
              armor.isExotic === 1 &&
              armor.itemType === 2 &&
              armor.name === manifestItem.name &&
              armor.clazz === manifestItem.clazz &&
              armor.slot === manifestItem.slot
          )
          .map((armor) => armor.hash);

        this.config.modifyConfiguration((config) => {
          config.selectedExotics = exoticVariants;
        });
        updatedConfig = true;

        // Handle exotic class item perks if applicable
        if (manifestItem.slot === ArmorSlot.ArmorSlotClass) {
          const sockets =
            profile.Response.itemComponents.sockets.data?.[exoticArmor.itemInstanceId!];
          if (sockets) {
            const exoticPerks = this.extractExoticClassItemPerks(sockets.sockets);
            if (exoticPerks.length > 0) {
              this.config.modifyConfiguration((config) => {
                config.selectedExoticPerks = [
                  exoticPerks[0] || ArmorPerkOrSlot.Any,
                  exoticPerks[1] || ArmorPerkOrSlot.Any,
                ];
              });
            }
          }
        }
      }
    }

    return updatedConfig;
  }

  /**
   * Imports currently equipped subclass and fragments and updates the configuration accordingly
   */
  async importCurrentlyEquippedSubclass(): Promise<boolean> {
    if (environment.offlineMode) {
      this.logger.info(
        "BungieApiService",
        "importCurrentlyEquippedSubclass",
        "offline mode, skipping"
      );
      return false;
    }

    let destinyMembership = await this.membership.getMembershipDataForCurrentUser();
    if (!destinyMembership) {
      if (!this.status.getStatus().apiError) this.status.setAuthError();
      return false;
    }
    this.status.clearAuthError();
    this.status.clearApiError();

    const characterId = await this.getCharacterIdForCurrentClass();
    if (!characterId) {
      this.logger.warn(
        "BungieApiService",
        "importCurrentlyEquippedSubclass",
        "No character found for current class"
      );
      return false;
    }

    this.logger.info(
      "BungieApiService",
      "importCurrentlyEquippedSubclass",
      `Importing equipped subclass for character ${characterId}`
    );

    let profile = await getProfile((d) => this.http.$http(d, true), {
      components: [
        DestinyComponentType.CharacterEquipment,
        DestinyComponentType.ItemSockets,
        DestinyComponentType.ItemInstances,
      ],
      membershipType: destinyMembership.membershipType,
      destinyMembershipId: destinyMembership.membershipId,
    });

    const characterEquipment = profile.Response.characterEquipment.data?.[characterId];
    if (!characterEquipment) {
      this.logger.warn(
        "BungieApiService",
        "importCurrentlyEquippedSubclass",
        "No equipment data found for character"
      );
      return false;
    }

    let updatedConfig = false;

    // Import subclass and fragments
    const subclass = characterEquipment.items.find((item) => item.bucketHash === 3284755031); // Subclass bucket
    if (subclass) {
      const configClass = this.config.readonlyConfigurationSnapshot
        .characterClass as keyof typeof SubclassHashes;
      let subclassKey: string | null = null;
      if (SubclassHashes[configClass]) {
        for (const [key, hash] of Object.entries(SubclassHashes[configClass])) {
          if (hash === subclass.itemHash) {
            subclassKey = key;
            break;
          }
        }
      }
      if (subclassKey) {
        this.config.modifyConfiguration((config) => {
          config.selectedModElement = Number(subclassKey);
          config.enabledMods = [];
        });
        updatedConfig = true;
      }
    }

    // fragments
    if (subclass && subclass.itemInstanceId) {
      const sockets = profile.Response.itemComponents.sockets.data?.[subclass.itemInstanceId];
      if (sockets) {
        const fragmentHashes = sockets.sockets
          .filter((socket) => socket.plugHash && socket.plugHash !== 0)
          .map((socket) => socket.plugHash)
          .map((plugHash) => {
            const modKey = Object.entries(ModInformation).find(
              ([_, info]) => info.hash === plugHash
            )?.[0];
            return modKey ? Number(modKey) : undefined;
          })
          .filter(Boolean);
        if (fragmentHashes && fragmentHashes.length > 0) {
          this.config.modifyConfiguration((config) => {
            this.logger.debug(
              "BungieApiService",
              "importCurrentlyEquippedSubclass",
              `Importing fragments: ${JSON.stringify(fragmentHashes)}`
            );
            config.enabledMods = fragmentHashes as number[];
          });
          updatedConfig = true;
        }
      }
    }

    return updatedConfig;
  }

  private extractExoticClassItemPerks(sockets: any[]): ArmorPerkOrSlot[] {
    const perks: ArmorPerkOrSlot[] = [];

    for (const socket of sockets) {
      if (
        socket.plugHash &&
        Object.keys(ExoticClassItemPerkNames).map(Number).includes(socket.plugHash)
      ) {
        // Map the exotic perk hash to ArmorPerkOrSlot if needed
        // For now, we'll return the hash directly as it should match the enum
        perks.push(socket.plugHash as ArmorPerkOrSlot);
      }
    }

    return perks;
  }
}
