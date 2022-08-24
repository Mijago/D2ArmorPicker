import {Injectable} from '@angular/core';
import {
  DestinyClass,
  DestinyComponentType,
  DestinyInventoryItemDefinition,
  equipItem,
  getDestinyManifest,
  getDestinyManifestSlice,
  getItem,
  getProfile,
  HttpClientConfig,
  transferItem
} from 'bungie-api-ts/destiny2';
import {getMembershipDataForCurrentUser} from 'bungie-api-ts/user';
import {AuthService} from "./auth.service";
import {HttpClient} from "@angular/common/http";
import {DatabaseService} from "./database.service";
import {environment} from "../../environments/environment";
import {BungieMembershipType} from "bungie-api-ts/common";
import {IManifestArmor} from "../data/types/IManifestArmor";
import {IInventoryArmor} from "../data/types/IInventoryArmor";
import {ArmorSlot} from "../data/enum/armor-slot";
import {ArmorPerkOrSlot} from "../data/enum/armor-stat";

@Injectable({
  providedIn: 'root'
})
export class BungieApiService {

  constructor(private authService: AuthService, private http: HttpClient, private db: DatabaseService) {
  }

  async $httpWithoutKey(config: HttpClientConfig) {
    return this.http.get<any>(config.url, {
        params: config.params,
      }
    ).toPromise();
  }

  async $httpPost(config: HttpClientConfig) {
    return this.http.post<any>(config.url, config.body, {
        params: config.params,
        headers: {
          "X-API-Key": environment.apiKey,
          "Authorization": "Bearer " + this.authService.accessToken
        }
      }
    ).toPromise()
      .catch(async err => {
        console.error(err);
      })
  }

  async $http(config: HttpClientConfig) {
    return this.http.get<any>(config.url, {
        params: config.params,
        headers: {
          "X-API-Key": environment.apiKey,
          "Authorization": "Bearer " + this.authService.accessToken
        }
      }
    ).toPromise()
      .catch(async err => {
        console.error(err);
        if (err.error?.ErrorStatus == "SystemDisabled") {
          console.info("System is disabled. Revoking auth, must re-login")
          await this.authService.logout();
        }
        if (err.ErrorStatus != "Internal Server Error") {
          console.info("API-Error")
          //await this.authService.logout();
        }
        // TODO: go to login page
      })
  }

  async getCharacters() {
    let destinyMembership = await this.getMembershipDataForCurrentUser();
    if (!destinyMembership) {
      await this.authService.logout();
      return [];
    }

    const profile = await getProfile(d => this.$http(d), {
      components: [
        DestinyComponentType.Characters,
      ],
      membershipType: destinyMembership.membershipType,
      destinyMembershipId: destinyMembership.membershipId
    });

    return Object.values(profile?.Response.characters.data || {}).map(d => {
      return {
        characterId: d.characterId,
        clazz: d.classType as DestinyClass,
        emblemUrl: d.emblemBackgroundPath,
        lastPlayed: Date.parse(d.dateLastPlayed)
      }
    }) || [];
  }

  async transferItem(itemInstanceId: string, targetCharacter: string, equip = false): Promise<boolean> {
    let destinyMembership = await this.getMembershipDataForCurrentUser();
    if (!destinyMembership) {
      await this.authService.logout();
      return false;
    }

    let r1 = await getItem(d => this.$http(d), {
      membershipType: destinyMembership.membershipType,
      destinyMembershipId: destinyMembership.membershipId,
      itemInstanceId: itemInstanceId,
      components: [
        DestinyComponentType.ItemCommonData
      ]
    })

    let transferResult = false;

    if (!r1) return false;
    if (r1.Response.characterId != targetCharacter) {
      if (r1.Response.item.data?.location != 2) {
        await this.moveItemToVault(r1.Response.item.data?.itemInstanceId || "");
        r1 = await getItem(d => this.$http(d), {
          membershipType: destinyMembership.membershipType,
          destinyMembershipId: destinyMembership.membershipId,
          itemInstanceId: itemInstanceId,
          components: [
            DestinyComponentType.ItemCommonData
          ]
        })
      }

      const payload = {
        "characterId": targetCharacter,
        "membershipType": 3,
        "itemId": r1?.Response.item.data?.itemInstanceId || "",
        "itemReferenceHash": r1?.Response.item.data?.itemHash || 0,
        "stackSize": 1,
        "transferToVault": false
      }

      transferResult = !!await transferItem(d => this.$httpPost(d), payload);
    }
    if (equip) {
      let equipPayload = {
        "characterId": targetCharacter,
        "membershipType": 3,
        "stackSize": 1,
        "itemId": r1?.Response.item.data?.itemInstanceId || "",
        "itemReferenceHash": r1?.Response.item.data?.itemHash || 0,
      }
      transferResult = !!await equipItem(d => this.$httpPost(d), equipPayload)
    }

    return transferResult;
  }


  async moveItemToVault(itemInstanceId: string) {
    console.info("moveItemToVault", itemInstanceId)
    let destinyMembership = await this.getMembershipDataForCurrentUser();
    if (!destinyMembership) {
      await this.authService.logout();
      return;
    }


    const r1 = await getItem(d => this.$http(d), {
      membershipType: destinyMembership.membershipType,
      destinyMembershipId: destinyMembership.membershipId,
      itemInstanceId: itemInstanceId,
      components: [
        DestinyComponentType.ItemCommonData
      ]
    })

    const payload = {
      "characterId": r1?.Response.characterId || "",
      "membershipType": 3,
      "itemId": r1?.Response.item.data?.itemInstanceId || "",
      "itemReferenceHash": r1?.Response.item.data?.itemHash || 0,
      "stackSize": 1,
      "transferToVault": true
    }

    await transferItem(d => this.$httpPost(d), payload);
  }

  async getMembershipDataForCurrentUser() {
    console.info("BungieApiService", "getMembershipDataForCurrentUser")
    let response = await getMembershipDataForCurrentUser(d => this.$http(d));
    let memberships = response?.Response.destinyMemberships;
    console.info("Memberships:", memberships)
    memberships = memberships.filter(m => m.crossSaveOverride == 0 || m.crossSaveOverride == m.membershipType);
    console.info("Filtered Memberships:", memberships)

    let result = null;
    if (memberships?.length == 1) {
      // This guardian only has one account linked, so we can proceed as normal
      result = memberships?.[0];
    } else {
      // This guardian has multiple accounts linked.
      // Fetch the last login time for each account, and use the one that was most recently used.
      let lastLoggedInProfileIndex: any = 0;
      let lastPlayed = 0;
      for (let id in memberships) {
        const membership = memberships?.[id];
        const profile = await getProfile(d => this.$http(d), {
          components: [
            DestinyComponentType.Profiles,
          ],
          membershipType: membership.membershipType,
          destinyMembershipId: membership.membershipId
        });
        if (!!profile && profile.Response?.profile.data?.dateLastPlayed) {
          let date = Date.parse(profile.Response?.profile.data?.dateLastPlayed)
          if (date > lastPlayed) {
            lastPlayed = date;
            lastLoggedInProfileIndex = id;
          }
        }
      }
      console.info("getMembershipDataForCurrentUser", "Selected membership data for the last logged in membership.");
      result = memberships?.[lastLoggedInProfileIndex];
    }

    // If you write abusive chat messages, i do not allow you to use my tool.
    if (result.membershipType == BungieMembershipType.TigerSteam && result.membershipId == "4611686018482586660") {
      alert("Yeah, no. You write abusive chat messages, and thus you won't be able to use this tool. Have a good day!")
      return null; // automatically log out
    }
    return result;
  }

  async updateArmorItems(force = false) {
    if (!force && localStorage.getItem("LastArmorUpdate"))
      if (localStorage.getItem("last-armor-db-name") == this.db.inventoryArmor.db.name)
        if (Date.now() - Number.parseInt(localStorage.getItem("LastArmorUpdate") || "0") < 1000 * 3600 / 2)
          return;
    let destinyMembership = await this.getMembershipDataForCurrentUser();
    if (!destinyMembership) {
      await this.authService.logout();
      return;
    }


    console.info("BungieApiService", "getProfile")
    let profile = await getProfile(d => this.$http(d), {
      components: [
        DestinyComponentType.CharacterEquipment,
        DestinyComponentType.CharacterInventories,
        DestinyComponentType.ProfileInventories,
        DestinyComponentType.ItemStats,
        DestinyComponentType.ItemInstances,
        DestinyComponentType.ItemPerks,
        DestinyComponentType.ItemSockets,
        DestinyComponentType.ItemPlugStates,
      ],
      membershipType: destinyMembership.membershipType,
      destinyMembershipId: destinyMembership.membershipId
    });

    let allItems = profile.Response.profileInventory.data?.items || []
    for (let charI in profile.Response.characterEquipment.data) {
      let i = profile.Response.characterEquipment.data[charI].items
      allItems = allItems.concat(i);
    }
    for (let charI in profile.Response.characterInventories.data) {
      let i = profile.Response.characterInventories.data[charI].items
      allItems = allItems.concat(i);
    }


    let ids = Array.from(new Set(allItems.map(d => d.itemHash)))
    // Do not search directly in the DB, as it is VERY slow.
    let manifestArmor = await this.db.manifestArmor.toArray();
    const cx = manifestArmor.filter(d => ids.indexOf(d.hash) > -1)
    const modsData = manifestArmor.filter(d => d.itemType == 19)
    let res = Object.fromEntries(cx.map((_) => [_.hash, _]))
    let mods = Object.fromEntries(modsData.map((_) => [_.hash, _]))

    let r = allItems
      //.filter(d => ids.indexOf(d.itemHash) > -1)
      .filter(d => !!d.itemInstanceId)
      .filter(d => {
        let statData = profile.Response.itemComponents.stats.data || {};
        let stats = statData[d.itemInstanceId || ""]?.stats || {}
        return !!stats[392767087];
      })
      .filter(d => {
        // remove sunset items
        let instanceData = profile.Response.itemComponents.instances.data || {};
        let instance = instanceData[d.itemInstanceId || ""] || {}
        return !!instance.energy;
      })
      .map(
        d => {
          let instanceData = profile.Response.itemComponents.instances.data || {};
          let instance = instanceData[d.itemInstanceId || ""] || {}

          let r = Object.assign({
            itemInstanceId: d.itemInstanceId || "",
            masterworked: !!instance.energy && instance.energy.energyCapacity == 10,
            energyLevel: !!instance.energy ? instance.energy.energyCapacity : 0,
            mobility: 0, resilience: 0, recovery: 0,
            discipline: 0, intellect: 0, strength: 0,
            energyAffinity: instance.energy?.energyType || 0,
          }, res[d.itemHash]) as IInventoryArmor
          (r.id as any) = undefined;

          // HALLOWEEN MASKS
          if (d.itemHash == 2545426109 || d.itemHash == 199733460 || d.itemHash == 3224066584)
            r.slot = ArmorSlot.ArmorSlotHelmet;
          // /HALLOWEEN MASKS

          var investmentStats: { [id: number]: number; } = {
            2996146975: 0, 392767087: 0, 1943323491: 0, 1735777505: 0, 144602215: 0, 4244567218: 0,
          }
          // Intrinsics
          if (res[d.itemHash] && res[d.itemHash].investmentStats) {
            for (let newStats of res[d.itemHash].investmentStats) {
              if (newStats.statTypeHash in investmentStats)
                investmentStats[newStats.statTypeHash] += newStats.value;
            }
          }
          if (r.slot != ArmorSlot.ArmorSlotClass) {
            const sockets = (profile.Response.itemComponents.sockets.data || {})[d.itemInstanceId || ""].sockets;
            var plugs = [sockets[6].plugHash, sockets[7].plugHash, sockets[8].plugHash, sockets[9].plugHash]
            r.statPlugHashes = plugs;
            var plm = plugs.map(k => mods[k || ""]).filter(k => k != null);
            for (let entry of plm) {
              for (let newStats of entry.investmentStats) {
                if (newStats.statTypeHash in investmentStats)
                  investmentStats[newStats.statTypeHash] += newStats.value;
              }
            }
          }
          r.mobility = investmentStats[2996146975]
          r.resilience = investmentStats[392767087]
          r.recovery = investmentStats[1943323491]
          r.discipline = investmentStats[1735777505]
          r.intellect = investmentStats[144602215]
          r.strength = investmentStats[4244567218]

          // Take a look if it really has the artificer perk
          if (r.perk == ArmorPerkOrSlot.SlotArtificer) {
            let statData = profile.Response.itemComponents.perks.data || {};
            let perks = (statData[d.itemInstanceId || ""] || {})["perks"] || []
            const hasPerk = perks.filter(p => p.perkHash == 229248542).length > 0;
            if (!hasPerk)
              r.perk = ArmorPerkOrSlot.None
          }
          return r as IInventoryArmor
        }
      ) || []

    // Now add the stuff to the db..
    await this.db.inventoryArmor.clear();
    await this.db.inventoryArmor.bulkAdd(r);
    localStorage.setItem("LastArmorUpdate", Date.now().toString())
    localStorage.setItem("last-armor-db-name", this.db.inventoryArmor.db.name)

    return r;
  }


  private getArmorPerk(v: DestinyInventoryItemDefinition): ArmorPerkOrSlot {
    if ((v.sockets?.socketEntries.filter(d => d.reusablePlugSetHash == 1181) || []).length > 0)
      return ArmorPerkOrSlot.SlotArtificer;

    if ((v.sockets?.socketEntries.filter(d => d.singleInitialItemHash == 1679876242) || []).length > 0)
      return ArmorPerkOrSlot.SlotLastWish;
    if ((v.sockets?.socketEntries.filter(d => d.singleInitialItemHash == 3738398030) || []).length > 0)
      return ArmorPerkOrSlot.SlotVaultOfGlass;
    if ((v.sockets?.socketEntries.filter(d => d.singleInitialItemHash == 706611068) || []).length > 0)
      return ArmorPerkOrSlot.SlotGardenOfSalvation;
    if ((v.sockets?.socketEntries.filter(d => d.singleInitialItemHash == 4055462131) || []).length > 0)
      return ArmorPerkOrSlot.SlotDeepStoneCrypt;
    if ((v.sockets?.socketEntries.filter(d => d.singleInitialItemHash == 2447143568) || []).length > 0)
      return ArmorPerkOrSlot.SlotVowOfTheDisciple;

    if ((v.sockets?.socketEntries.filter(d => d.singleInitialItemHash == 1180997867) || []).length > 0)
      return ArmorPerkOrSlot.SlotNightmare;
    if ((v.sockets?.socketEntries.filter(d => d.singleInitialItemHash == 2472875850) || []).length > 0)
      return ArmorPerkOrSlot.PerkIronBanner;
    if ((v.sockets?.socketEntries.filter(d => d.singleInitialItemHash == 2392155347) || []).length > 0)
      return ArmorPerkOrSlot.PerkUniformedOfficer;

    return ArmorPerkOrSlot.None
  }

  async updateManifest(force = false) {
    var destinyManifest = null;
    if (!force && localStorage.getItem("LastManifestUpdate") && localStorage.getItem("last-manifest-revision")) {
      if (localStorage.getItem("last-manifest-revision") == environment.revision) {
        if (Date.now() - Number.parseInt(localStorage.getItem("LastManifestUpdate") || "0") > 1000 * 3600 * 0.25 ) {
          destinyManifest = await getDestinyManifest(d => this.$http(d));
          const version = destinyManifest.Response.version;
          if (localStorage.getItem("last-manifest-version") == version)
            return;
        }
        if (localStorage.getItem("last-manifest-db-name") == this.db.manifestArmor.db.name)
          if (Date.now() - Number.parseInt(localStorage.getItem("LastManifestUpdate") || "0") < 1000 * 3600 * 24)
            return;
      }
    }

    if (destinyManifest == null)
      destinyManifest = await getDestinyManifest(d => this.$http(d));
    const version = destinyManifest.Response.version;

    const manifestTables = await getDestinyManifestSlice(d => this.$httpWithoutKey(d), {
      destinyManifest: destinyManifest.Response,
      tableNames: ['DestinyInventoryItemDefinition'],
      language: 'en'
    });

    console.log("manifestTables.DestinyInventoryItemDefinition", manifestTables.DestinyInventoryItemDefinition)

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
        let slot = ArmorSlot.ArmorSlotNone
        if ((v.itemCategoryHashes?.indexOf(45) || -1) > -1) slot = ArmorSlot.ArmorSlotHelmet;
        if ((v.itemCategoryHashes?.indexOf(46) || -1) > -1) slot = ArmorSlot.ArmorSlotGauntlet;
        if ((v.itemCategoryHashes?.indexOf(47) || -1) > -1) slot = ArmorSlot.ArmorSlotChest;
        if ((v.itemCategoryHashes?.indexOf(48) || -1) > -1) slot = ArmorSlot.ArmorSlotLegs;
        if ((v.itemCategoryHashes?.indexOf(49) || -1) > -1) slot = ArmorSlot.ArmorSlotClass;

        const isArmor2 = ((v.sockets?.socketEntries.filter(d => {
          return d.socketTypeHash == 2512726577 // general
            || d.socketTypeHash == 1108765570 // arms
            || d.socketTypeHash == 959256494 // chest
            || d.socketTypeHash == 2512726577 // class
            || d.socketTypeHash == 3219375296 // legs
            || d.socketTypeHash == 968742181 // head
        }).length || []) > 0)

        const isExotic = (v.inventory?.tierTypeName == 'Exotic') ? 1 : 0;
        let exoticPerkHash = null;
        if (isExotic) {
          const perks = v.sockets?.socketEntries
            .filter(s => s.socketTypeHash == 965959289)
            .map(d => d.singleInitialItemHash) || [];
          exoticPerkHash = perks[0]
        }

        var sunsetPowerCaps = [
          1862490585, // 1260
          1862490584, // 1060
          1862490584, // 1060
          1862490583, // 1060
          2471437758, // 1010
        ]
        // if every entry is sunset, so is this item.
        var isSunset = v.quality?.versions.filter(k => sunsetPowerCaps.includes(k.powerCapHash)).length == v.quality?.versions.length;

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
          perk: this.getArmorPerk(v)
        } as IManifestArmor
      });


    await this.db.manifestArmor.clear();
    await this.db.manifestArmor.bulkPut(entries);
    localStorage.setItem("LastManifestUpdate", Date.now().toString())
    localStorage.setItem("last-manifest-db-name", this.db.manifestArmor.db.name)
    localStorage.setItem("last-manifest-revision", environment.revision)
    localStorage.setItem("last-manifest-version", version)

    return manifestTables;
  }


}
