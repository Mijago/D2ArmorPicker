import {Injectable} from '@angular/core';
import {
  getDestinyManifest,
  getDestinyManifestSlice,
  getProfile, getItem,
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
import {IManifestArmor} from "./IManifestArmor";
import {IInventoryArmor} from "./IInventoryArmor";

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

  async transferItem(itemInstanceId: string, targetCharacter: string) {
    let destinyMembership = await this.getMembershipDataForCurrentUser();
    if (!destinyMembership) {
      await this.authService.logout();
      return;
    }

    let r1 = await getItem(d => this.$http(d), {
      membershipType: destinyMembership.membershipType,
      destinyMembershipId: destinyMembership.membershipId,
      itemInstanceId: itemInstanceId,
      components: [
        DestinyComponentType.ItemCommonData
      ]
    })

    if (!r1) return;
    if (r1.Response.characterId == targetCharacter) return;
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

    await transferItem(d => this.$httpPost(d), payload);
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
    let cx = await this.db.manifestArmor.where('hash').anyOf(ids).toArray();
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
        return !!instance.energy
          // the following lines are necessary because these specific exotics do not have an element (yet) in the api
          || d.itemHash == 3267996858 // no backup plans;
          || d.itemHash == 1702288800 // radiant dance machines;
          || d.itemHash == 300502917 // nothing manacles;
      })
      .map(
        d => {

          let statData = profile.Response.itemComponents.stats.data || {};
          let stats = statData[d.itemInstanceId || ""]?.stats || {}

          let instanceData = profile.Response.itemComponents.instances.data || {};
          let instance = instanceData[d.itemInstanceId || ""] || {}

          let r = Object.assign({
            itemInstanceId: d.itemInstanceId || "",
            masterworked: !!instance.energy && instance.energy.energyCapacity == 10,
            mobility: stats[2996146975].value,
            resilience: stats[392767087].value,
            recovery: stats[1943323491].value,
            discipline: stats[1735777505].value,
            intellect: stats[144602215].value,
            strength: stats[4244567218].value,
            energyAffinity: instance.energy?.energyType || 0,
          }, res[d.itemHash]) as IInventoryArmor
          (r.id as any) = undefined;


          // TODO: Negative values are capped at 0, thus i get always ~8 strength
          if (r.masterworked) {
            r.mobility -= 2
            r.resilience -= 2
            r.recovery -= 2
            r.discipline -= 2
            r.intellect -= 2
            r.strength -= 2;
          }
          //(r as any).__stats = stats;

          // TODO: Use manifest for this.
          let perks = ((profile.Response.itemComponents.perks.data || {})[d.itemInstanceId || ""] || {perks: []}).perks;
          (r as any).__perks1 = perks;

          let fields: any = {
            3242738765: ["mobility", -5], 2378399451: ["mobility", -10], 2395177038: ["mobility", -20],
            1675445975: ["mobility", 5], 139886105: ["mobility", 10], 89553216: ["89553216", 20],

            964593855: ["recovery", -5], 1026637393: ["recovery", -10], 976304536: ["recovery", -20],
            3716860505: ["recovery", 5], 511479895: ["recovery", 10], 528257482: ["recovery", 20],

            1740967518: ["intellect", -5], 3040188318: ["intellect", -10], 3023410731: ["intellect", -20],
            3656751878: ["intellect", 5], 530777110: ["intellect", 10], 513999523: ["intellect", 20],

            4101235313: ["strength", -5], 1198358047: ["strength", -10], 1215135730: ["strength", -20],
            892183419: ["strength", 5], 903373021: ["strength", 10], 853040132: ["strength", 20],

            3337820677: ["resilience", -5], 833744803: ["resilience", -10], 850522390: ["resilience", -20],
            3298086143: ["resilience", 5], 1899933457: ["resilience", 10], 1849600600: ["resilience", 20],

            4175356498: ["discipline", -5], 484330834: ["discipline", -10], 467553279: ["discipline", -20],
            2728273034: ["discipline", 5], 2364771258: ["discipline", 10], 2347993543: ["discipline", 20],

          }

          for (let perk of perks) {
            let f = fields[perk.perkHash ?? 0];
            if (!!f) {
              (r as any)[f[0]] += f[1]
            }
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

  async updateManifest(force = false) {
    if (!force && localStorage.getItem("LastManifestUpdate")) {
      if (localStorage.getItem("last-manifest-db-name") == this.db.manifestArmor.db.name)
        if (Date.now() - Number.parseInt(localStorage.getItem("LastManifestUpdate") || "0") < 1000 * 3600 * 2)
          return;
    }

    const destinyManifest = await getDestinyManifest(d => this.$httpWithoutKey(d));
    const manifestTables = await getDestinyManifestSlice(d => this.$httpWithoutKey(d), {
      destinyManifest: destinyManifest.Response,
      tableNames: ['DestinyInventoryItemDefinition', "DestinySocketTypeDefinition"],
      language: 'en'
    });

    console.log("manifestTables.DestinyInventoryItemDefinition", manifestTables.DestinyInventoryItemDefinition)

    let entries = Object.entries(manifestTables.DestinyInventoryItemDefinition)
      .filter(([k, v]) => {
        if (!v.displayProperties.name)
          return false;
        if (!v.displayProperties.icon)
          return false;
        return true;
        return (
          (v.itemCategoryHashes?.indexOf(45) || -1) > -1
          || (v.itemCategoryHashes?.indexOf(46) || -1) > -1
          || (v.itemCategoryHashes?.indexOf(47) || -1) > -1
          || (v.itemCategoryHashes?.indexOf(48) || -1) > -1
          || (v.itemCategoryHashes?.indexOf(49) || -1) > -1
        )
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
          isExotic: (v.inventory?.tierTypeName == 'Exotic') ? 1 : 0
        } as IManifestArmor
      });

    // TODO: clazz
    // TODO: fix slot

    await this.db.manifestArmor.clear();
    await this.db.manifestArmor.bulkPut(entries);
    localStorage.setItem("LastManifestUpdate", Date.now().toString())
    localStorage.setItem("last-manifest-db-name", this.db.manifestArmor.db.name)

    return manifestTables;
  }


}
