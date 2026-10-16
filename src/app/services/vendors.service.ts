import { Injectable, OnDestroy } from "@angular/core";
import {
  getVendors,
  getVendor,
  DestinyComponentType,
  DestinyItemType,
  DestinyVendorItemState,
} from "bungie-api-ts/destiny2";
import { MembershipService } from "./membership.service";
import { GroupUserInfoCard } from "bungie-api-ts/groupv2";
import { ArmorSystem, IManifestArmor } from "../data/types/IManifestArmor";
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
import { LoggingProxyService } from "./logging-proxy.service";

const VENDOR_NEXT_REFRESH_KEY = "user-vendor-nextRefreshTime";

interface VendorWithParent {
  vendorHash: number;
  parentHash: number;
}

@Injectable({
  providedIn: "root",
})
export class VendorsService implements OnDestroy {
  constructor(
    private membership: MembershipService,
    private http: HttpClientService,
    private db: DatabaseService,
    private auth: AuthService,
    private logger: LoggingProxyService
  ) {
    this.logger.debug("VendorsService", "constructor", "Initializing VendorsService");
    this.auth.logoutEvent.subscribe((k) => this.clearCachedData());
  }

  ngOnDestroy(): void {
    this.logger.debug("VendorsService", "ngOnDestroy", "Destroying VendorsService");
  }

  private clearCachedData() {
    localStorage.removeItem(VENDOR_NEXT_REFRESH_KEY);
    //this.db.inventoryArmor.where({ source: InventoryArmorSource.Vendor }).delete();
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
      .filter(([_vendorHash, vendor]) => vendor.enabled && vendor.canPurchase)
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
            ([vendorItemIndex, saleItem]) =>
              manifestItems[saleItem.itemHash]?.armorSystem == ArmorSystem.Armor2 ||
              manifestItems[saleItem.itemHash]?.armorSystem == ArmorSystem.Armor3
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

            let lastVendor = vendorHash;
            let parentVendor = vendorsWithParent
              .find((v) => v.vendorHash.toString() == lastVendor)
              ?.parentHash?.toString();
            while (parentVendor != undefined && lastVendor != parentVendor) {
              lastVendor = parentVendor;
              parentVendor = vendorsWithParent
                .find((v) => v.vendorHash.toString() == lastVendor)
                ?.parentHash?.toString();
            }
            parentVendor = lastVendor;
            const r = createArmorItem(
              manifestItem,
              `v-${parentVendor}-${saleItem.itemHash}`,
              InventoryArmorSource.Vendor
            );
            applyInvestmentStats(r, statsOverride);
            vendorArmorItems.push(r);
          }
        },
        (reason) => {
          this.logger.error(
            "VendorsService",
            "getVendorArmorItemsForCharacter",
            `Failed to get vendor: ${reason}`
          );
        }
      );
    });

    //const vendorArmorItems = vendorItems.flatMap(({ items }) => items);
    await Promise.all(VendorPromises);
    this.logger.info(
      "VendorsService",
      "getVendorArmorItemsForCharacter",
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

    this.logger.debug(
      "VendorsService",
      "isVendorCacheValid",
      `Vendor Cache: nextVendorRefresh=${nextVendorRefresh}, now=${new Date()}, shouldRefresh=${nextVendorRefresh > new Date()}`
    );
    return nextVendorRefresh > new Date();
  }

  private async writeVendorCache(items: IInventoryArmor[], nextRefreshDate: Date) {
    this.logger.info(
      "VendorsService",
      "writeVendorCache",
      `Writing new vendor cache (${items.length} items), valid until ${nextRefreshDate.toISOString()}`
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
      this.logger.info("VendorsService", "updateVendorArmorItemsCache", "Using vendor items cache");
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
        characters.map(({ characterId }) => {
          if (destinyMembership) {
            return this.getVendorArmorItemsForCharacter(
              manifestItems,
              destinyMembership,
              characterId
            );
          } else {
            this.logger.error(
              "VendorsService",
              "updateVendorArmorItemsCache",
              "No destiny membership found, cannot fetch vendor items"
            );
            return { items: [], nextRefreshDate: Date.now() };
          }
        })
      );

      const allItems = vendorArmorItems.flatMap(({ items }) => items);
      const vendorItemsNextRefreshDate = Math.min(
        ...vendorArmorItems.map(({ nextRefreshDate }) => nextRefreshDate)
      );
      if (vendorItemsNextRefreshDate <= 0 || vendorItemsNextRefreshDate === Infinity) {
        this.logger.warn("VendorsService", "updateVendorArmorItemsCache", "No vendor items found");
        return false;
      }
      const nextRefreshDate = Math.max(vendorItemsNextRefreshDate, Date.now() + 1000 * 60 * 10);
      await this.writeVendorCache(allItems, new Date(nextRefreshDate)).catch((e) => {
        this.logger.error(
          "VendorsService",
          "updateVendorArmorItemsCache",
          `Failed to write vendor cache: ${e}`
        );
      });
      return true;
    } catch (e) {
      this.logger.error(
        "VendorsService",
        "updateVendorArmorItemsCache",
        `Failed to update vendor armor items cache: ${e}`
      );
      // refresh sooner if we failed to update the cache
      const nextRefreshDate = new Date();
      nextRefreshDate.setMinutes(nextRefreshDate.getMinutes() + 5);
      await this.writeVendorCache([], new Date(nextRefreshDate)).catch((e) => {
        this.logger.error(
          "VendorsService",
          "updateVendorArmorItemsCache",
          `Failed to write vendor cache after error: ${e}`
        );
      });
      return false;
    }
  }
}
