import {Injectable} from '@angular/core';
import {
  getDestinyManifest,
  getDestinyManifestSlice,
  getProfile, getItem, equipItem,
  HttpClientConfig,
  transferItem
} from 'bungie-api-ts/destiny2';
import {getMembershipDataForCurrentUser} from 'bungie-api-ts/user';
import {AuthService} from "./auth.service";
import {HttpClient} from "@angular/common/http";
import {DestinyClass, DestinyComponentType} from "bungie-api-ts/destiny2";
import {DatabaseService} from "./database.service";
import {environment} from "../../environments/environment";
import {BungieMembershipType} from "bungie-api-ts/common";
import {IManifestArmor} from "../data/types/IManifestArmor";
import {IInventoryArmor} from "../data/types/IInventoryArmor";

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
        if (err.ErrorStatus != "Internal Server Error") {
          console.info("Revoking auth, must re-login")
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
    const mods = manifestArmor.filter(d => d.itemType == 19)
    let res = Object.fromEntries(cx.map((_) => [_.hash, _]))

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
            mobility: 0, resilience: 0, recovery: 0,
            discipline: 0, intellect: 0, strength: 0,
            energyAffinity: instance.energy?.energyType || 0,
          }, res[d.itemHash]) as IInventoryArmor
          (r.id as any) = undefined;

          // HALLOWEEN MASKS
          if (d.itemHash == 2545426109 || d.itemHash == 199733460 || d.itemHash == 3224066584)
            r.slot = "Helmets";
          // /HALLOWEEN MASKS

          var investmentStats: { [id: number]: number; } = {
            2996146975: 0, 392767087: 0, 1943323491: 0, 1735777505: 0, 144602215: 0, 4244567218: 0,
          }

          if (res[d.itemHash] && res[d.itemHash].investmentStats) {
            for (let newStats of res[d.itemHash].investmentStats) {
              if (newStats.statTypeHash in investmentStats)
                investmentStats[newStats.statTypeHash] += newStats.value;
            }
          }

          if (r.slot != "Class Items") {
            const sockets = (profile.Response.itemComponents.sockets.data || {})[d.itemInstanceId || ""].sockets;
            var plugs = [sockets[6].plugHash, sockets[7].plugHash, sockets[8].plugHash, sockets[9].plugHash]
            var plm = plugs.map(k => mods.filter(m => m.hash == k)[0]);
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

  async updateManifest(force = false) {
    if (!force && localStorage.getItem("LastManifestUpdate")) {
      if (localStorage.getItem("last-manifest-db-name") == this.db.manifestArmor.db.name)
        if (Date.now() - Number.parseInt(localStorage.getItem("LastManifestUpdate") || "0") < 1000 * 3600 * 24)
          return;
    }

    const destinyManifest = await getDestinyManifest(d => this.$httpWithoutKey(d));
    const manifestTables = await getDestinyManifestSlice(d => this.$httpWithoutKey(d), {
      destinyManifest: destinyManifest.Response,
      tableNames: ['DestinyInventoryItemDefinition'],
      language: 'en'
    });

    console.log("manifestTables.DestinyInventoryItemDefinition", manifestTables.DestinyInventoryItemDefinition)

    let entries = Object.entries(manifestTables.DestinyInventoryItemDefinition)
      .filter(([k, v]) => {
        if (v.itemType == 19) return true;
        if (v.itemType == 2) return true;
        if (v.inventory?.bucketTypeHash == 3448274439) return true; // helmets, required for festival masks
        if (v.inventory?.bucketTypeHash == 3551918588) return true; // gauntlets
        if (v.inventory?.bucketTypeHash == 14239492) return true; // chest
        if (v.inventory?.bucketTypeHash == 20886954) return true; // leg
        return false;
      })
      .map(([k, v]) => {
        let slot = "none"
        if ((v.itemCategoryHashes?.indexOf(45) || -1) > -1) slot = "Helmets";
        if ((v.itemCategoryHashes?.indexOf(46) || -1) > -1) slot = "Arms";
        if ((v.itemCategoryHashes?.indexOf(47) || -1) > -1) slot = "Chest";
        if ((v.itemCategoryHashes?.indexOf(48) || -1) > -1) slot = "Legs";
        if ((v.itemCategoryHashes?.indexOf(49) || -1) > -1) slot = "Class Items";

        const isArmor2 = ((v.sockets?.socketEntries.filter(d => {
          return d.socketTypeHash == 2512726577 // general
            || d.socketTypeHash == 1108765570 // arms
            || d.socketTypeHash == 959256494 // chest
            || d.socketTypeHash == 2512726577 // class
            || d.socketTypeHash == 3219375296 // legs
            || d.socketTypeHash == 968742181 // head
        }).length || []) > 0)

        return {
          hash: v.hash,
          icon: v.displayProperties.icon,
          name: v.displayProperties.name,
          clazz: v.classType,
          armor2: isArmor2,
          slot: slot,
          isExotic: (v.inventory?.tierTypeName == 'Exotic') ? 1 : 0,
          itemType: v.itemType,
          itemSubType: v.itemSubType,
          investmentStats: v.investmentStats
        } as IManifestArmor
      });


    await this.db.manifestArmor.clear();
    await this.db.manifestArmor.bulkPut(entries);
    localStorage.setItem("LastManifestUpdate", Date.now().toString())
    localStorage.setItem("last-manifest-db-name", this.db.manifestArmor.db.name)

    return manifestTables;
  }


}
