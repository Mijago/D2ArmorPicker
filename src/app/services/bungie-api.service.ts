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
} from "bungie-api-ts/destiny2";
import { DatabaseService } from "./database.service";
import { environment } from "../../environments/environment";
import { IManifestArmor } from "../data/types/IManifestArmor";
import {
  IInventoryArmor,
  InventoryArmorSource,
  createArmorItem,
  applyInvestmentStats,
} from "../data/types/IInventoryArmor";
import { ArmorSlot } from "../data/enum/armor-slot";
import {
  ArmorPerkOrSlot,
  ArmorPerkSocketHashes,
  MapAlternativeToArmorPerkOrSlot,
} from "../data/enum/armor-stat";
import { ConfigurationService } from "./configuration.service";
import { IManifestCollectible } from "../data/types/IManifestCollectible";
import { MembershipService } from "./membership.service";
import { HttpClientService } from "./http-client.service";
import { IVendorInfo } from "../data/types/IVendorInfo";
import { StatusProviderService } from "./status-provider.service";

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

  if (r.slot != ArmorSlot.ArmorSlotClass) {
    const plugs = [plugHashes[6], plugHashes[7], plugHashes[8], plugHashes[9]];
    r.statPlugHashes = plugs;
    var plm = plugs.map((k) => mods[k || ""]).filter((k) => k != null);
    for (let entry of plm) {
      for (let newStats of entry.investmentStats) {
        if (newStats.statTypeHash in investmentStats)
          investmentStats[newStats.statTypeHash] += newStats.value;
      }
    }
  }

  applyInvestmentStats(r, investmentStats);
}

@Injectable({
  providedIn: "root",
})
export class BungieApiService {
  config_assumeEveryLegendaryIsArtifice = false;

  constructor(
    private status: StatusProviderService,
    private http: HttpClientService,
    private db: DatabaseService,
    private config: ConfigurationService,
    private membership: MembershipService
  ) {
    this.config.configuration.subscribe(async (config) => {
      this.config_assumeEveryLegendaryIsArtifice = config.assumeEveryLegendaryIsArtifice;
    });
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
        membershipType: 3,
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
        membershipType: 3,
        stackSize: 1,
        itemId: r1?.Response.item.data?.itemInstanceId || "",
        itemReferenceHash: r1?.Response.item.data?.itemHash || 0,
      };
      transferResult = !!(await equipItem((d) => this.http.$httpPost(d), equipPayload));
    }

    return transferResult;
  }

  async moveItemToVault(itemInstanceId: string) {
    console.info("moveItemToVault", itemInstanceId);
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
      membershipType: 3,
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

  async updateArmorItems(force = false) {
    if (environment.offlineMode) {
      console.info("BungieApiService", "updateArmorItems", "offline mode, skipping");
      return;
    }

    if (!force && localStorage.getItem("LastArmorUpdate"))
      if (localStorage.getItem("last-armor-db-name") == this.db.inventoryArmor.db.name)
        if (
          Date.now() - Number.parseInt(localStorage.getItem("LastArmorUpdate") || "0") <
          (1000 * 3600) / 2
        )
          return;
    let destinyMembership = await this.membership.getMembershipDataForCurrentUser();
    if (!destinyMembership) {
      if (!this.status.getStatus().apiError) this.status.setAuthError();
      return [];
    }
    this.status.clearAuthError();
    this.status.clearApiError();

    console.info("BungieApiService", "Requesting Profile");
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
    localStorage.setItem("stored-materials", JSON.stringify(materials));

    // Collect a list of all armor item hashes that we need to look up in the manifest
    const idSet = new Set(allItems.map((d) => d.itemHash));
    // Add all exotics owned by the player, as they can always be found from collections
    unlockedExoticArmorItemHashes.forEach((id) => idSet.add(id));

    // Do not search directly in the DB, as it is VERY slow.
    let manifestArmor = await this.db.manifestArmor.toArray();
    const validManifestArmor = manifestArmor.filter((d) => idSet.has(d.hash));
    const modsData = manifestArmor.filter((d) => d.itemType == 19);
    const validManifestArmorMap = Object.fromEntries(validManifestArmor.map((_) => [_.hash, _]));
    const modsMap = Object.fromEntries(modsData.map((_) => [_.hash, _]));

    let filteredItems = allItems
      //.filter(d => ids.indexOf(d.itemHash) > -1)
      .filter((d) => !!d.itemInstanceId)
      .filter((d) => d.bucketHash !== 3284755031) // Filter out subclasses
      .filter((d) => {
        let statData = profile.Response.itemComponents.stats.data || {};
        let stats = statData[d.itemInstanceId || ""]?.stats || {};
        return !!stats[392767087];
      })
      .filter((d) => {
        // remove sunset items
        let instanceData = profile.Response.itemComponents.instances.data || {};
        let instance = instanceData[d.itemInstanceId || ""] || {};
        return !!instance.energy;
      })
      .map((d) => {
        let instanceData = profile.Response.itemComponents.instances.data || {};
        let instance = instanceData[d.itemInstanceId || ""] || {};

        if (!validManifestArmorMap[d.itemHash]) {
          console.warn("Missing manifest item for item hash", d.itemHash);
          return null;
        }

        let armorItem = createArmorItem(
          validManifestArmorMap[d.itemHash],
          d.itemInstanceId || "",
          InventoryArmorSource.Inventory
        );
        armorItem.masterworked = !!instance.energy && instance.energy.energyCapacity == 10;
        armorItem.energyLevel = !!instance.energy ? instance.energy.energyCapacity : 0;
        const sockets = profile.Response.itemComponents.sockets.data || {};
        const socketsList =
          sockets[d.itemInstanceId!]?.sockets.map((socket) => socket.plugHash) ?? [];
        collectInvestmentStats(
          armorItem,
          validManifestArmorMap[d.itemHash]?.investmentStats ?? [],
          socketsList,
          modsMap
        );

        // Take a look if it really has the artifice perk
        if (armorItem.perk == ArmorPerkOrSlot.SlotArtifice) {
          let statData = profile.Response.itemComponents.perks.data || {};
          let perks = (statData[d.itemInstanceId || ""] || {})["perks"] || [];
          const hasPerk = perks.filter((p) => p.perkHash == 229248542).length > 0;
          if (!hasPerk) armorItem.perk = ArmorPerkOrSlot.None;
        } else if (armorItem.isExotic) {
          // 720825311 is "UNLOCKED exotic artifice slot"
          // 1656746282 is "LOCKED exotic artifice slot"
          const hasPerk = socketsList.filter((d) => d == 720825311).length > 0;
          if (hasPerk) {
            armorItem.perk = ArmorPerkOrSlot.SlotArtifice;
          }
        }

        return armorItem as IInventoryArmor;
      })
      .filter(Boolean) as IInventoryArmor[];

    // Now add the collection rolls for exotics
    const collectionRollItems = Array.from(unlockedExoticArmorItemHashes)
      .map((exoticItemHash) => {
        const manifestArmorItem = validManifestArmorMap[exoticItemHash];
        if (!manifestArmorItem) {
          console.error("Couldn't find manifest item for exotic", exoticItemHash);
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

    filteredItems = filteredItems.concat(collectionRollItems);
    filteredItems = filteredItems.filter(
      (k) => !k["statPlugHashes"] || k["statPlugHashes"][0] != null
    );

    await this.updateDatabaseItems(filteredItems);

    localStorage.setItem("LastArmorUpdate", Date.now().toString());
    localStorage.setItem("last-armor-db-name", this.db.inventoryArmor.db.name);

    this.status.clearApiError();
    return filteredItems;
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
        return parseInt(slotType[0]) as unknown as ArmorPerkOrSlot;
      }
    }

    return ArmorPerkOrSlot.None;
  }

  private async updateVendorNames(
    manifestTables: DestinyManifestSlice<"DestinyVendorDefinition"[]>
  ) {
    const vendors = manifestTables.DestinyVendorDefinition;

    // get values
    const vendorInfo: IVendorInfo[] = Object.values(vendors).map((v) => {
      return { vendorId: v.hash, vendorName: v.displayProperties.name } as IVendorInfo;
    });

    await this.db.vendorNames.clear();
    await this.db.vendorNames.bulkAdd(vendorInfo);
  }

  private async updateAbilities(
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

    localStorage.setItem("allAbilities", JSON.stringify(allAbilities));
  }

  // Collect the data for exotic armor collectibles
  // this allows us to map a collection entry hash to the associated armor inventory item hash
  private async updateExoticCollectibles(
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

    console.log("Storing", exoticArmorCollectibles.length, "exotic armor hashes");
    await this.db.manifestCollectibles.clear();
    await this.db.manifestCollectibles.bulkPut(exoticArmorCollectibles);
  }

  async updateManifest(force = false) {
    if (environment.offlineMode) {
      console.info("BungieApiService", "updateManifest", "offline mode, skipping");
      return;
    }

    const manifestCache = this.db.lastManifestUpdate();

    let destinyManifest = null;
    if (manifestCache && !force) {
      if (Date.now() - manifestCache.updatedAt > 1000 * 3600 * 0.25) {
        destinyManifest = await getDestinyManifest((d) => this.http.$httpWithoutBearerToken(d));
        const version = destinyManifest.Response.version;
        if (manifestCache.version == version) {
          console.info("bungieApiService - updateManifest", "Manifest is last version");
          return;
        }
      }

      if (Date.now() - manifestCache.updatedAt < 1000 * 3600 * 24) {
        console.info("bungieApiService - updateManifest", "Manifest is less than a day old");
        return;
      }
    }

    if (destinyManifest == null) {
      destinyManifest = await getDestinyManifest((d) => this.http.$httpWithoutBearerToken(d));
    }

    const manifestVersion = destinyManifest.Response.version;

    const manifestTables = await getDestinyManifestSlice((d) => this.http.$httpWithoutApiKey(d), {
      destinyManifest: destinyManifest.Response,
      tableNames: [
        "DestinyInventoryItemDefinition",
        "DestinyCollectibleDefinition",
        "DestinyVendorDefinition",
        "DestinySocketTypeDefinition",
      ],
      language: "en",
    });

    const enManifestTables = await getDestinyManifestSlice((d) => this.http.$httpWithoutApiKey(d), {
      destinyManifest: destinyManifest.Response,
      tableNames: ["DestinyCollectibleDefinition", "DestinyPresentationNodeDefinition"],
      language: "en",
    });

    await this.updateExoticCollectibles(manifestTables);
    await this.updateVendorNames(manifestTables);
    await this.updateAbilities(manifestTables);

    // NOTE: This is also storing emotes, as these have itemType 19 (mods)
    let entries = Object.entries(manifestTables.DestinyInventoryItemDefinition)
      .filter(([k, v]) => {
        if (v.itemType == 19) return true; // mods
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

        const isExotic = v.inventory?.tierType == 6 ? 1 : 0;
        let exoticPerkHash = null;
        if (isExotic) {
          const perks =
            v.sockets?.socketEntries
              .filter((s) => s.socketTypeHash == 965959289)
              .map((d) => d.singleInitialItemHash) || [];
          exoticPerkHash = perks[0];
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
              enManifestTables.DestinyCollectibleDefinition[v.collectibleHash].parentNodeHashes;
            if (presentationParentNode !== undefined) {
              if (
                presentationParentNode.findIndex(
                  (x) =>
                    enManifestTables.DestinyPresentationNodeDefinition[x].displayProperties.name ==
                    "Warlock"
                ) != -1
              )
                clasz = DestinyClass.Warlock;
              if (
                presentationParentNode.findIndex(
                  (x) =>
                    enManifestTables.DestinyPresentationNodeDefinition[x].displayProperties.name ==
                    "Titan"
                ) != -1
              )
                clasz = DestinyClass.Titan;
              if (
                presentationParentNode.findIndex(
                  (x) =>
                    enManifestTables.DestinyPresentationNodeDefinition[x].displayProperties.name ==
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

        return {
          hash: v.hash,
          icon: v.displayProperties.icon,
          watermarkIcon: (v.quality?.displayVersionWatermarkIcons || [null])[0],
          name: v.displayProperties.name,
          description: v.displayProperties.description,
          clazz: clasz,
          armor2: isArmor2,
          slot: slot,
          isExotic: isExotic,
          isSunset: isSunset,
          rarity: v.inventory?.tierType,
          exoticPerkHash: exoticPerkHash,
          itemType: v.itemType,
          itemSubType: v.itemSubType,
          investmentStats: v.investmentStats,
          perk: this.getArmorPerk(v),
          socketEntries: v.sockets?.socketEntries ?? [],
        } as IManifestArmor;
      });

    await this.db.writeManifestArmor(entries, manifestVersion);

    return manifestTables;
  }
}
