import { Injectable } from "@angular/core";
import { environment } from "../../environments/environment";
import {
  getVendors,
  HttpClientConfig,
  DestinyComponentType,
  DestinyItemType,
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
  ): Promise<IInventoryArmor[]> {
    const vendorsResponse = await getVendors((d) => this.http.$http(d), {
      components: [
        DestinyComponentType.Vendors,
        DestinyComponentType.VendorSales,
        DestinyComponentType.ItemStats,
      ],
      characterId,
      membershipType: destinyMembership.membershipType,
      destinyMembershipId: destinyMembership.membershipId,
      filter: 0,
    });

    const vendorArmorItems = Object.entries(vendorsResponse.Response.vendors.data ?? {})
      .filter(([_vendorHash, vendor]) => vendor.enabled && vendor.canPurchase)
      .flatMap(([vendorHash, vendor]) => {
        const saleItems = vendorsResponse.Response.sales.data?.[vendorHash]?.saleItems ?? {};
        const vendorItemStats =
          vendorsResponse.Response.itemComponents[parseInt(vendorHash)].stats.data ?? {};

        return Object.entries(saleItems)
          .map(([vendorItemIndex, saleItem]) => {
            const manifestItem = manifestItems[saleItem.itemHash];
            const itemStats = vendorItemStats[parseInt(vendorItemIndex)];

            if (!manifestItem || !itemStats) {
              return;
            }

            const statsOverride = Object.values(itemStats.stats).reduce(
              (acc, { statHash, value }) => {
                acc[statHash] = value;
                return acc;
              },
              {} as Record<number, number>
            );

            const r = createArmorItem(
              manifestItem,
              `v${vendorHash}-${saleItem.itemHash}`,
              InventoryArmorSource.Vendor
            );
            applyInvestmentStats(r, statsOverride);
            return r;
          })
          .filter(Boolean) as IInventoryArmor[];
      });

    console.log(
      `Collected ${vendorArmorItems.length} vendor armor items for character ${characterId}`
    );

    return vendorArmorItems;
  }

  async getVendorArmorItems(): Promise<IInventoryArmor[]> {
    const destinyMembership = await this.membership.getMembershipDataForCurrentUser();
    const characters = await this.membership.getCharacters();

    // This should contain a list of hashes for only the armor items which we are interested in
    const manifestItems = (await this.db.manifestArmor.toArray())
      .filter((a) => a.itemType == DestinyItemType.Armor)
      .reduce((acc, item) => {
        acc[item.hash] = item;
        return acc;
      }, {} as Record<number, IManifestArmor>);

    const vendorArmorItems = await Promise.all(
      characters.map(({ characterId }) =>
        this.getVendorArmorItemsForCharacter(manifestItems, destinyMembership, characterId)
      )
    );

    return vendorArmorItems.flat();
  }
}
