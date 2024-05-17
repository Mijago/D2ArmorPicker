import { Injectable } from "@angular/core";
import { environment } from "../../environments/environment";
import {
  getVendors,
  getVendor,
  HttpClientConfig,
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

const VENDOR_NEXT_REFRESH_KEY = "vendor-next-refresh-time";

@Injectable({
  providedIn: "root",
})
export class VendorsService {
  constructor(
    private membership: MembershipService,
    private http: HttpClientService,
    private db: DatabaseService
  ) {}

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

    const enabledVendors = Object.entries(vendorsResponse.Response.vendors.data!).filter(
      ([_vendorHash, vendor]) => vendor.enabled
    );
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
    for (const vendor of vendors) {
      const vendorHash = vendor.vendorHash;
      const vendorResponse = await getVendor((d) => this.http.$http(d, false), {
        components: [DestinyComponentType.ItemStats],
        characterId,
        membershipType: destinyMembership.membershipType,
        destinyMembershipId: destinyMembership.membershipId,
        vendorHash: parseInt(vendorHash),
      });

      const saleItems = vendorsResponse.Response.sales.data?.[vendorHash]?.saleItems ?? {};
      const vendorItemStats = vendorResponse.Response.itemComponents.stats.data ?? {};

      const armor = Object.entries(saleItems).map(([vendorItemIndex, saleItem]) => {
        const manifestItem = manifestItems[saleItem.itemHash];
        const itemStats = vendorItemStats[parseInt(vendorItemIndex)];

        if ((saleItem.augments & DestinyVendorItemState.Owned) === DestinyVendorItemState.Owned) {
          return;
        }

        if (!manifestItem || !itemStats) {
          return;
        }

        const statsOverride = Object.values(itemStats.stats).reduce((acc, { statHash, value }) => {
          acc[statHash] = value;
          return acc;
        }, {} as Record<number, number>);

        const r = createArmorItem(
          manifestItem,
          `v${vendorHash}-${saleItem.itemHash}`,
          InventoryArmorSource.Vendor
        );
        applyInvestmentStats(r, statsOverride);
        vendorArmorItems.push(r);
      });
    }

    //const vendorArmorItems = vendorItems.flatMap(({ items }) => items);

    console.log(
      `Collected ${vendorArmorItems.length} vendor armor items for character ${characterId}`
    );

    return {
      items: vendorArmorItems,
      nextRefreshDate,
    };
  }

  private isVendorCacheValid() {
    const nextRefreshTimeStr = localStorage.getItem(VENDOR_NEXT_REFRESH_KEY);
    if (!nextRefreshTimeStr) {
      return false;
    }

    const nextVendorRefresh = new Date(nextRefreshTimeStr);
    if (!isFinite(nextVendorRefresh.getTime())) {
      return false;
    }

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

  async updateVendorArmorItemsCache() {
    if (this.isVendorCacheValid()) {
      console.log("Using vendor items cache");
      return;
    }

    const destinyMembership = await this.membership.getMembershipDataForCurrentUser();
    const characters = await this.membership.getCharacters();

    // This should contain a list of hashes for only the armor items which we are interested in
    const manifestItems = (await this.db.manifestArmor.toArray())
      .filter((a) => a.itemType == DestinyItemType.Armor)
      .reduce((acc, item) => {
        acc[item.hash] = item;
        return acc;
      }, {} as Record<number, IManifestArmor>);

    try {
      const vendorArmorItems = await Promise.all(
        characters.map(({ characterId }) =>
          this.getVendorArmorItemsForCharacter(manifestItems, destinyMembership, characterId)
        )
      );

      const allItems = vendorArmorItems.flatMap(({ items }) => items);
      const nextRefreshDate = Math.min(
        ...vendorArmorItems.map(({ nextRefreshDate }) => nextRefreshDate)
      );
      return this.writeVendorCache(allItems, new Date(nextRefreshDate));
    } catch (e) {
      console.error("Failed to update vendor armor items cache", e);
      // refresh sooner if we failed to update the cache
      const nextRefreshDate = new Date();
      nextRefreshDate.setMinutes(nextRefreshDate.getMinutes() + 5);
      this.writeVendorCache([], new Date(nextRefreshDate));
    }
  }
}
