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
  DestinyClass,
  DestinyComponentType,
  DestinyInventoryItemDefinition,
  DestinyItemSocketState,
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
} from "bungie-api-ts/destiny2";
import { AuthService } from "./auth.service";
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
import { ArmorPerkOrSlot } from "../data/enum/armor-stat";
import { ConfigurationService } from "./configuration.service";
import { IManifestCollectible } from "../data/types/IManifestCollectible";
import { MembershipService } from "./membership.service";
import { HttpClientService } from "./http-client.service";

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
  r.statPlugHashes = plugs;
  var plm = plugs.map((k) => mods[k || ""]).filter((k) => k != null);
  for (let entry of plm) {
    for (let newStats of entry.investmentStats) {
      if (newStats.statTypeHash in investmentStats)
        investmentStats[newStats.statTypeHash] += newStats.value;
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
    private authService: AuthService,
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
      await this.authService.logout();
      return false;
    }

    let r1 = await getItem((d) => this.http.$http(d), {
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
        r1 = await getItem((d) => this.http.$http(d), {
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
      await this.authService.logout();
      return;
    }

    const r1 = await getItem((d) => this.http.$http(d), {
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
  ) {
    const manifestExoticArmorItemHashes = (await this.db.manifestCollectibles.toArray()).reduce(
      (acc, cur) => {
        acc[cur.hash] = cur.itemHash;
        return acc;
      },
      {} as Record<number, number>
    );

    return Object.values(characterCollectibles)
      .flatMap((char) => Object.entries(char.collectibles ?? {}))
      .filter(([hash, { state }]) => {
        return (
          (state & DestinyCollectibleState.NotAcquired) === 0 &&
          manifestExoticArmorItemHashes[parseInt(hash)]
        );
      })
      .map(([hash, _]) => manifestExoticArmorItemHashes[parseInt(hash)]);
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
      await this.authService.logout();
      return;
    }

    console.info("BungieApiService", "getProfile");
    let profile = await getProfile((d) => this.http.$http(d), {
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
    var materials = allItems
      .filter((k) => [3853748946, 4257549984, 4257549985].indexOf(k.itemHash!) > -1)
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
    let legShardEntry =
      profile.Response.profileCurrencies.data?.items.filter((k) => k.itemHash == 1022552290) || [];
    if (legShardEntry.length > 0) materials["1022552290"] = legShardEntry[0].quantity;
    else materials["1022552290"] = 0;
    localStorage.setItem("stored-materials", JSON.stringify(materials));

    // Collect a list of all armor item hashes that we need to look up in the manifest
    const idSet = new Set(allItems.map((d) => d.itemHash));
    // Add all exotics owned by the player, as they can always be found from collections
    unlockedExoticArmorItemHashes.forEach((id) => idSet.add(id));

    // Do not search directly in the DB, as it is VERY slow.
    let manifestArmor = await this.db.manifestArmor.toArray();
    const cx = manifestArmor.filter((d) => idSet.has(d.hash));
    const modsData = manifestArmor.filter((d) => d.itemType == 19);
    let res = Object.fromEntries(cx.map((_) => [_.hash, _]));
    let mods = Object.fromEntries(modsData.map((_) => [_.hash, _]));

    let r = allItems
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

        if (!res[d.itemHash]) {
          console.warn("Missing manifest item for item hash", d.itemHash);
          return null;
        }

        let r = createArmorItem(
          res[d.itemHash],
          d.itemInstanceId || "",
          InventoryArmorSource.Inventory
        );
        r.masterworked = !!instance.energy && instance.energy.energyCapacity == 10;
        r.energyLevel = !!instance.energy ? instance.energy.energyCapacity : 0;
        const sockets = profile.Response.itemComponents.sockets.data || {};
        const socketsList =
          sockets[d.itemInstanceId!]?.sockets.map((socket) => socket.plugHash) ?? [];
        collectInvestmentStats(r, res[d.itemHash]?.investmentStats ?? [], socketsList, mods);

        // Take a look if it really has the artifice perk
        if (r.perk == ArmorPerkOrSlot.SlotArtifice) {
          let statData = profile.Response.itemComponents.perks.data || {};
          let perks = (statData[d.itemInstanceId || ""] || {})["perks"] || [];
          const hasPerk = perks.filter((p) => p.perkHash == 229248542).length > 0;
          if (!hasPerk) r.perk = ArmorPerkOrSlot.None;
        }

        if (!r.isExotic && this.config_assumeEveryLegendaryIsArtifice)
          r.perk = ArmorPerkOrSlot.SlotArtifice;

        return r as IInventoryArmor;
      })
      .filter(Boolean) as IInventoryArmor[];

    // Now add the collection rolls for exotics
    const collectionRollItems = unlockedExoticArmorItemHashes
      .map((exoticItemHash) => {
        const manifestArmorItem = res[exoticItemHash];
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
          mods
        );

        return collectionItem;
      })
      .filter(Boolean) as IInventoryArmor[];

    r = r.concat(collectionRollItems);

    r = r.filter((k) => !k["statPlugHashes"] || k["statPlugHashes"][0] != null);

    // Now add the stuff to the db..
    await this.db.inventoryArmor.clear();
    await this.db.inventoryArmor.bulkAdd(r);
    localStorage.setItem("LastArmorUpdate", Date.now().toString());
    localStorage.setItem("last-armor-db-name", this.db.inventoryArmor.db.name);

    return r;
  }

  private getArmorPerk(v: DestinyInventoryItemDefinition): ArmorPerkOrSlot {
    // Guardian Games
    if (
      environment.featureFlags.enableGuardianGamesFeatures &&
      (v.hash === 1013401891 || v.hash === 366019830 || v.hash == 537041732)
    )
      return ArmorPerkOrSlot.GuardianGamesClassItem;

    const scks = v.sockets?.socketEntries;
    if ((scks?.filter((d) => d.reusablePlugSetHash == 1280) || []).length > 0)
      return ArmorPerkOrSlot.SlotArtifice;
    if ((scks?.filter((d) => d.singleInitialItemHash == 3727270518) || []).length > 0)
      return ArmorPerkOrSlot.SlotArtifice;

    if ((scks?.filter((d) => d.singleInitialItemHash == 2779380852) || []).length > 0)
      return ArmorPerkOrSlot.SonarAmplifier;
    if ((scks?.filter((d) => d.singleInitialItemHash == 4144354978) || []).length > 0)
      return ArmorPerkOrSlot.SlotRootOfNightmares;
    if ((scks?.filter((d) => d.singleInitialItemHash == 1728096240) || []).length > 0)
      return ArmorPerkOrSlot.SlotKingsFall;
    if ((scks?.filter((d) => d.singleInitialItemHash == 1679876242) || []).length > 0)
      return ArmorPerkOrSlot.SlotLastWish;
    if ((scks?.filter((d) => d.singleInitialItemHash == 3738398030) || []).length > 0)
      return ArmorPerkOrSlot.SlotVaultOfGlass;
    if ((scks?.filter((d) => d.singleInitialItemHash == 706611068) || []).length > 0)
      return ArmorPerkOrSlot.SlotGardenOfSalvation;
    if ((scks?.filter((d) => d.singleInitialItemHash == 4055462131) || []).length > 0)
      return ArmorPerkOrSlot.SlotDeepStoneCrypt;
    if ((scks?.filter((d) => d.singleInitialItemHash == 2447143568) || []).length > 0)
      return ArmorPerkOrSlot.SlotVowOfTheDisciple;

    if ((scks?.filter((d) => d.singleInitialItemHash == 1101259514) || []).length > 0)
      return ArmorPerkOrSlot.PerkQueensFavor;
    if ((scks?.filter((d) => d.singleInitialItemHash == 1180997867) || []).length > 0)
      return ArmorPerkOrSlot.SlotNightmare;
    if ((scks?.filter((d) => d.singleInitialItemHash == 2472875850) || []).length > 0)
      return ArmorPerkOrSlot.PerkIronBanner;
    if ((scks?.filter((d) => d.singleInitialItemHash == 2392155347) || []).length > 0)
      return ArmorPerkOrSlot.PerkUniformedOfficer;
    if ((scks?.filter((d) => d.singleInitialItemHash == 400659041) || []).length > 0)
      return ArmorPerkOrSlot.PerkPlunderersTrappings;
    if ((scks?.filter((d) => d.singleInitialItemHash == 3525583702) || []).length > 0)
      return ArmorPerkOrSlot.SeraphSensorArray;

    return ArmorPerkOrSlot.None;
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
        return item?.inventory?.tierTypeName == "Exotic" && item?.itemType == DestinyItemType.Armor;
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

    var destinyManifest = null;
    if (
      !force &&
      localStorage.getItem("LastManifestUpdate") &&
      localStorage.getItem("last-manifest-revision")
    ) {
      if (localStorage.getItem("last-manifest-revision") == environment.revision) {
        if (
          Date.now() - Number.parseInt(localStorage.getItem("LastManifestUpdate") || "0") >
          1000 * 3600 * 0.25
        ) {
          destinyManifest = await getDestinyManifest((d) => this.http.$http(d));
          const version = destinyManifest.Response.version;
          if (localStorage.getItem("last-manifest-version") == version) {
            console.debug(
              "bungieApiService - updateManifest",
              "Abort updateManifest due to fitting ManifestVersion"
            );
            return;
          }
        }
        if (localStorage.getItem("last-manifest-db-name") == this.db.manifestArmor.db.name)
          if (
            Date.now() - Number.parseInt(localStorage.getItem("LastManifestUpdate") || "0") <
            1000 * 3600 * 24
          ) {
            console.debug(
              "bungieApiService - updateManifest",
              "Abort updateManifest due to fitting Date"
            );
            return;
          }
      }
    }

    if (destinyManifest == null)
      destinyManifest = await getDestinyManifest((d) => this.http.$http(d));
    const version = destinyManifest.Response.version;

    const manifestTables = await getDestinyManifestSlice((d) => this.http.$httpWithoutKey(d), {
      destinyManifest: destinyManifest.Response,
      tableNames: ["DestinyInventoryItemDefinition", "DestinyCollectibleDefinition"],
      language: "en",
    });

    console.log(
      "manifestTables.DestinyInventoryItemDefinition",
      manifestTables.DestinyInventoryItemDefinition
    );

    await this.updateExoticCollectibles(manifestTables);

    // NOTE: This is also storing emotes, as these have itemType 19 (mods)
    let entries = Object.entries(manifestTables.DestinyInventoryItemDefinition)
      .filter(([k, v]) => {
        if (v.itemType == 19) return true; // mods
        if (v.itemType == 2) return true; // armor
        if (v.inventory?.bucketTypeHash == 3448274439) return true; // helmets, required for festival masks
        if (v.inventory?.bucketTypeHash == 3551918588) return true; // gauntlets
        if (v.inventory?.bucketTypeHash == 14239492) return true; // chest
        if (v.inventory?.bucketTypeHash == 20886954) return true; // leg
        return false;
      })
      .map(([k, v]) => {
        let slot = ArmorSlot.ArmorSlotNone;
        if ((v.itemCategoryHashes?.indexOf(45) || -1) > -1) slot = ArmorSlot.ArmorSlotHelmet;
        if ((v.itemCategoryHashes?.indexOf(46) || -1) > -1) slot = ArmorSlot.ArmorSlotGauntlet;
        if ((v.itemCategoryHashes?.indexOf(47) || -1) > -1) slot = ArmorSlot.ArmorSlotChest;
        if ((v.itemCategoryHashes?.indexOf(48) || -1) > -1) slot = ArmorSlot.ArmorSlotLegs;
        if ((v.itemCategoryHashes?.indexOf(49) || -1) > -1) slot = ArmorSlot.ArmorSlotClass;

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

        const isExotic = v.inventory?.tierTypeName == "Exotic" ? 1 : 0;
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

        return {
          hash: v.hash,
          icon: v.displayProperties.icon,
          watermarkIcon: (v.quality?.displayVersionWatermarkIcons || [null])[0],
          name: v.displayProperties.name,
          description: v.displayProperties.description,
          clazz: v.classType,
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

    await this.db.manifestArmor.clear();
    await this.db.manifestArmor.bulkPut(entries);
    localStorage.setItem("LastManifestUpdate", Date.now().toString());
    localStorage.setItem("last-manifest-db-name", this.db.manifestArmor.db.name);
    localStorage.setItem("last-manifest-revision", environment.revision);
    localStorage.setItem("last-manifest-version", version);

    return manifestTables;
  }
}
