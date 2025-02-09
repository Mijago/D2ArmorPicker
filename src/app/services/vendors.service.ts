import { Injectable } from "@angular/core";
import {
  getVendors,
  getVendor,
  DestinyComponentType,
  DestinyItemType,
  DestinyVendorItemState,
} from "bungie-api-ts/destiny2";
import { MembershipService } from "./membership.service";
import { GroupUserInfoCard } from "bungie-api-ts/groupv2";
import { IManifestArmor } from "../data/types/IManifestArmor";
import {
  IInventoryArmor,
  InventoryArmorSource,
  createArmorItem,
  applyInvestmentStats,
} from "../data/types/IInventoryArmor";
import { HttpClientService } from "./http-client.service";
import { DatabaseService } from "./database.service";
import { AuthService } from "./auth.service";
import { intersection as _intersection } from "lodash";

const VENDOR_NEXT_REFRESH_KEY = "vendor-next-refresh-time";

interface VendorWithParent {
  vendorHash: number;
  parentHash: number;
}

@Injectable({
  providedIn: "root",
})
export class VendorsService {
  constructor(
    private membership: MembershipService,
    private http: HttpClientService,
    private db: DatabaseService,
    private auth: AuthService
  ) {
    this.auth.logoutEvent.subscribe((k) => this.clearCachedData());
  }

  private clearCachedData() {
    localStorage.removeItem(VENDOR_NEXT_REFRESH_KEY);
    this.db.inventoryArmor.where({ source: InventoryArmorSource.Vendor }).delete();
  }

  private async getVendorArmorItemsForCharacter(
    manifestItems: Record<number, IManifestArmor>,
    destinyMembership: GroupUserInfoCard,
    characterId: string
  ): Promise<{
    items: IInventoryArmor[];
    nextRefreshDate: number;
  }> {
    const vendorsResponse = await getVendors((d) => this.http.$http(d, false), {
      components: [DestinyComponentType.Vendors, DestinyComponentType.VendorSales],
      characterId,
      membershipType: destinyMembership.membershipType,
      destinyMembershipId: destinyMembership.membershipId,
      filter: 0,
    });

    const allVendors = Object.entries(vendorsResponse.Response.vendors.data!);
    const allVendorsMap = new Map(allVendors);
    let vendorsWithParent: VendorWithParent[] = (
      await Promise.all(
        Object.entries(vendorsResponse.Response.sales.data!).map(async ([_vendorHash, sales]) => {
          let items = Object.values(sales.saleItems).map((x) => x.itemHash);
          let subscreenItem = (await this.db.vendorItemSubscreen.bulkGet(items)).filter(
            (x) => x != undefined
          );
          let vendors = subscreenItem.map((item) => {
            return { vendorHash: item!.vendorHash, parentHash: parseInt(_vendorHash) };
          });
          return vendors;
        })
      )
    ).flat();

    const enabledVendors = allVendors
      .filter(([_vendorHash, vendor]) => vendor.enabled)
      .filter(([vendorHash, vendor]) => {
        const parent = vendorsWithParent.find(
          (v) => v.vendorHash.toString() == vendorHash
        )?.parentHash;
        if (parent == undefined) return true;
        return allVendorsMap.get(parent.toString())?.enabled ?? false;
      });
    const vendors = enabledVendors
      .filter(
        ([vendorHash, vendor]) =>
          Object.entries(vendorsResponse.Response.sales.data?.[vendorHash]?.saleItems ?? {}).find(
            ([vendorItemIndex, saleItem]) => manifestItems[saleItem.itemHash]?.armor2 == true
          ) !== undefined
      )
      .map(([vendorHash, vendor]) => ({
        vendorHash: vendorHash,
        refreshDate: new Date(vendor.nextRefreshDate).getTime(),
      }));

    const vendorArmorItems: IInventoryArmor[] = [];
    const nextRefreshDate = Math.min(...vendors.map((v) => v.refreshDate));
    const VendorPromises = vendors.map((vendor) => {
      let vendorHash = vendor.vendorHash;
      return getVendor((d) => this.http.$http(d, false), {
        components: [DestinyComponentType.ItemStats],
        characterId,
        membershipType: destinyMembership.membershipType,
        destinyMembershipId: destinyMembership.membershipId,
        vendorHash: parseInt(vendorHash),
      }).then(
        (vendorResponse) => {
          const saleItems = vendorsResponse.Response.sales.data?.[vendorHash]?.saleItems ?? {};
          const vendorItemStats = vendorResponse.Response.itemComponents.stats.data ?? {};

          for (const [vendorItemIndex, saleItem] of Object.entries(saleItems)) {
            const manifestItem = manifestItems[saleItem.itemHash];
            const itemStats = vendorItemStats[parseInt(vendorItemIndex)];

            if (
              (saleItem.augments & DestinyVendorItemState.Owned) ===
              DestinyVendorItemState.Owned
            ) {
              continue;
            }

            if (!manifestItem || !itemStats) {
              continue;
            }

            const statsOverride = Object.values(itemStats.stats).reduce(
              (acc, { statHash, value }) => {
                acc[statHash] = value;
                return acc;
              },
              {} as Record<number, number>
            );

            let parentVendor = vendorsWithParent
              .find((v) => v.vendorHash.toString() == vendorHash)
              ?.parentHash?.toString();
            let lastVendor = parentVendor;
            if (parentVendor != undefined) {
              while (parentVendor != undefined) {
                lastVendor = parentVendor;
                parentVendor = vendorsWithParent
                  .find((v) => v.vendorHash.toString() == parentVendor)
                  ?.parentHash?.toString();
              }
              parentVendor = lastVendor;
            } else parentVendor = vendorHash;

            const r = createArmorItem(
              manifestItem,
              `v-${parentVendor}-${saleItem.itemHash}`,
              InventoryArmorSource.Vendor
            );
            console.log(r.itemInstanceId);
            console.log(parentVendor);
            console.log(vendorHash);
            applyInvestmentStats(r, statsOverride);
            vendorArmorItems.push(r);
          }
        },
        (reason) => {
          console.error(`Failed to get vendor: ${reason}`);
        }
      );
    });

    //const vendorArmorItems = vendorItems.flatMap(({ items }) => items);
    await Promise.all(VendorPromises);
    console.log(
      `Collected ${vendorArmorItems.length} vendor armor items for character ${characterId}`
    );

    return {
      items: vendorArmorItems,
      nextRefreshDate,
    };
  }

  isVendorCacheValid() {
    const nextRefreshTimeStr = localStorage.getItem(VENDOR_NEXT_REFRESH_KEY);
    if (!nextRefreshTimeStr) {
      return false;
    }

    const nextVendorRefresh = new Date(nextRefreshTimeStr);
    if (!isFinite(nextVendorRefresh.getTime())) {
      return false;
    }

    console.debug("Vendor Cache", {
      information: {
        nextVendorRefresh,
        now: new Date(),
        shouldRefresh: nextVendorRefresh > new Date(),
      },
    });
    return nextVendorRefresh > new Date();
  }

  private async writeVendorCache(items: IInventoryArmor[], nextRefreshDate: Date) {
    console.log(
      `Writing new vendor cache (${
        items.length
      } items), valid until ${nextRefreshDate.toISOString()}`
    );
    await this.db.inventoryArmor.where({ source: InventoryArmorSource.Vendor }).delete();
    await this.db.inventoryArmor.bulkPut(items);
    localStorage.setItem(VENDOR_NEXT_REFRESH_KEY, nextRefreshDate.toISOString());
  }

  /**
   * Updates the vendor armor items cache if it is invalid
   * @returns true if the cache was updated, false if the cache is still valid
   */
  async updateVendorArmorItemsCache() {
    if (this.isVendorCacheValid()) {
      console.log("Using vendor items cache");
      return false;
    }

    const destinyMembership = await this.membership.getMembershipDataForCurrentUser();
    const characters = await this.membership.getCharacters();

    // This should contain a list of hashes for only the armor items which we are interested in
    const manifestItems = (await this.db.manifestArmor.toArray())
      .filter((a) => a.itemType == DestinyItemType.Armor)
      .reduce(
        (acc, item) => {
          acc[item.hash] = item;
          return acc;
        },
        {} as Record<number, IManifestArmor>
      );

    try {
      const vendorArmorItems = await Promise.all(
        characters.map(({ characterId }) =>
          this.getVendorArmorItemsForCharacter(manifestItems, destinyMembership, characterId)
        )
      );

      const allItems = vendorArmorItems.flatMap(({ items }) => items);
      const nextRefreshDate = Math.max(
        Math.min(...vendorArmorItems.map(({ nextRefreshDate }) => nextRefreshDate)),
        Date.now() + 1000 * 60 * 10
      );
      this.writeVendorCache(allItems, new Date(nextRefreshDate));
      return true;
    } catch (e) {
      console.error("Failed to update vendor armor items cache", e);
      // refresh sooner if we failed to update the cache
      const nextRefreshDate = new Date();
      nextRefreshDate.setMinutes(nextRefreshDate.getMinutes() + 5);
      this.writeVendorCache([], new Date(nextRefreshDate));
      return false;
    }
  }
}
