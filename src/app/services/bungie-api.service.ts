import {Injectable} from '@angular/core';
import {getDestinyManifest, getDestinyManifestSlice, getProfile, HttpClientConfig} from 'bungie-api-ts/destiny2';
import {getMembershipDataForCurrentUser} from 'bungie-api-ts/user';
import {AuthService} from "./auth.service";
import {HttpClient} from "@angular/common/http";
import {DestinyComponentType} from "bungie-api-ts/destiny2/interfaces";
import {DatabaseService, IInventoryArmor, IManifestArmor} from "./database.service";
import {environment} from "../../environments/environment";

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
        console.info("Revoking auth, must re-login")
        await this.authService.logout();
        // TODO: go to login page
      })
  }


  async getMembershipDataForCurrentUser() {
    console.info("BungieApiService", "getMembershipDataForCurrentUser")
    let response = await getMembershipDataForCurrentUser(d => this.$http(d));
    if (response?.Response.destinyMemberships.length == 1) {
      // This guardian only has one account linked, so we can proceed as normal
      return response?.Response.destinyMemberships[0];
    } else {
      // This guardian has multiple accounts linked.
      // Fetch the last login time for each account, and use the one that was most recently used.
      let lastLoggedInProfileIndex: any = 0;
      let lastPlayed = 0;
      for (let id in response?.Response.destinyMemberships) {
        const membership = response?.Response.destinyMemberships[id];
        const profile = await getProfile(d => this.$http(d), {
          components: [
            DestinyComponentType.Profiles,
          ],
          membershipType: membership.membershipType,
          destinyMembershipId: membership.membershipId
        });
        if (profile.Response?.profile.data?.dateLastPlayed) {
          let date = Date.parse(profile.Response?.profile.data?.dateLastPlayed)
          if (date > lastPlayed) {
            lastPlayed = date;
            lastLoggedInProfileIndex = id;
          }
        }
      }
      console.info("getMembershipDataForCurrentUser", "Selected membership data for the last logged in membership.");
      return response?.Response.destinyMemberships[lastLoggedInProfileIndex];
    }
  }

  async updateArmorItems(force = false) {
    if (!force && localStorage.getItem("LastArmorUpdate"))
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
            instanceRawData: JSON.stringify(d),
          }, res[d.itemHash]) as IInventoryArmor


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
              if (r.name == "Stronghold")
                console.log(perk.perkHash, f);
              (r as any)[f[0]] += f[1]
            }
          }

          return r as IInventoryArmor
        }
      ) || []


    console.log("Armor", r)
    // Now add the stuff to the db..
    await this.db.inventoryArmor.clear();
    await this.db.inventoryArmor.bulkPut(r);
    localStorage.setItem("LastArmorUpdate", Date.now().toString())

    return r;
  }

  async updateManifest(force = false) {
    if (!force && localStorage.getItem("LastManifestUpdate"))
      if (Date.now() - Number.parseInt(localStorage.getItem("LastManifestUpdate") || "0") < 1000 * 3600 * 2)
        return;

    const destinyManifest = await getDestinyManifest(d => this.$httpWithoutKey(d));
    const manifestTables = await getDestinyManifestSlice(d => this.$httpWithoutKey(d), {
      destinyManifest: destinyManifest.Response,
      tableNames: ['DestinyInventoryItemDefinition', "DestinySocketTypeDefinition"],
      language: 'en'
    });
    console.log({manifestTables})

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

        return {
          hash: v.hash,
          icon: v.displayProperties.icon,
          name: v.displayProperties.name,
          clazz: v.classType,
          slot: slot,
          isExotic: v.inventory?.tierTypeName == 'Exotic',
          rawData: JSON.stringify(v)
        } as IManifestArmor
      });

    // TODO: clazz
    // TODO: fix slot

    console.log({entries})
    localStorage.setItem("LastManifestUpdate", Date.now().toString())
    await this.db.manifestArmor.clear();
    await this.db.manifestArmor.bulkPut(entries);

    return manifestTables;
  }


}
