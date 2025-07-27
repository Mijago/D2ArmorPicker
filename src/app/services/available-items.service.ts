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
import { BehaviorSubject, Observable } from "rxjs";
import { map, distinctUntilChanged, take, tap } from "rxjs/operators";
import { DatabaseService } from "./database.service";
import { ConfigurationService } from "./configuration.service";
import { AuthService } from "./auth.service";
import { ArmorSlot } from "../data/enum/armor-slot";
import { ArmorPerkOrSlot } from "../data/enum/armor-stat";
import { ArmorSystem } from "../data/types/IManifestArmor";
import { IInventoryArmor, InventoryArmorSource, isEqualItem } from "../data/types/IInventoryArmor";
import { IPermutatorArmor } from "../data/types/IPermutatorArmor";
import { BuildConfiguration } from "../data/buildConfiguration";
import { TierType } from "bungie-api-ts/destiny2";
import { FORCE_USE_NO_EXOTIC, MAXIMUM_MASTERWORK_LEVEL } from "../data/constants";
import { isEqual as _isEqual } from "lodash";

export interface AvailableItemsBySlot {
  [ArmorSlot.ArmorSlotHelmet]: IPermutatorArmor[];
  [ArmorSlot.ArmorSlotGauntlet]: IPermutatorArmor[];
  [ArmorSlot.ArmorSlotChest]: IPermutatorArmor[];
  [ArmorSlot.ArmorSlotLegs]: IPermutatorArmor[];
  [ArmorSlot.ArmorSlotClass]: IPermutatorArmor[];
}

type ValidArmorSlot =
  | ArmorSlot.ArmorSlotHelmet
  | ArmorSlot.ArmorSlotGauntlet
  | ArmorSlot.ArmorSlotChest
  | ArmorSlot.ArmorSlotLegs
  | ArmorSlot.ArmorSlotClass;

export interface AvailableItemsInfo {
  itemsBySlot: AvailableItemsBySlot;
  totalItems: number;
  classItems: IPermutatorArmor[];
  availableClassItemPerkTypes: Set<ArmorPerkOrSlot>;
  exoticClassItems: IPermutatorArmor[];
  legendaryClassItems: IPermutatorArmor[];
  exoticClassItemIsEnforced: boolean;
}

@Injectable({
  providedIn: "root",
})
export class AvailableItemsService {
  private _availableItems = new BehaviorSubject<AvailableItemsInfo>({
    itemsBySlot: {
      [ArmorSlot.ArmorSlotHelmet]: [],
      [ArmorSlot.ArmorSlotGauntlet]: [],
      [ArmorSlot.ArmorSlotChest]: [],
      [ArmorSlot.ArmorSlotLegs]: [],
      [ArmorSlot.ArmorSlotClass]: [],
    },
    totalItems: 0,
    classItems: [],
    availableClassItemPerkTypes: new Set(),
    exoticClassItems: [],
    legendaryClassItems: [],
    exoticClassItemIsEnforced: false,
  });

  public readonly availableItems$: Observable<AvailableItemsInfo> = this._availableItems
    .asObservable()
    .pipe(
      tap((items: AvailableItemsInfo) =>
        console.debug("AvailableItemsService: availableItems$ emitted", items)
      )
    );

  // Memoized slot observables to ensure consistency
  private _slotObservables = new Map<ArmorSlot, Observable<IPermutatorArmor[]>>();

  constructor(
    private db: DatabaseService,
    private config: ConfigurationService,
    private auth: AuthService
  ) {
    // Update available items when config changes
    this.config.configuration
      .pipe(
        distinctUntilChanged((prev, curr) => {
          for (let key of Object.keys(prev) as (keyof BuildConfiguration)[]) {
            if (!curr.hasOwnProperty(key) || !_isEqual(prev[key], curr[key])) {
              return false;
            }
          }
          return true;
        })
        //debounceTime(1) // Debounce to avoid rapid updates
      )
      .subscribe(async (config) => {
        if (this.auth.isAuthenticated()) {
          await this.updateAvailableItems(config);
        }
      });
  }

  /**
   * Manually trigger an update of available items
   * This should be called by InventoryService when inventory data changes
   */
  async refreshAvailableItems(): Promise<void> {
    if (this.auth.isAuthenticated()) {
      // Get the current configuration value
      const currentConfig = await new Promise<BuildConfiguration>((resolve) => {
        this.config.configuration
          .pipe(take(1))
          .subscribe((config: BuildConfiguration) => resolve(config));
      });
      await this.updateAvailableItems(currentConfig);
    }
  }

  /**
   * Get current available items synchronously
   */
  get availableItems(): AvailableItemsInfo {
    return this._availableItems.value;
  }

  /**
   * Get items for a specific slot
   */
  getItemsForSlot(slot: ArmorSlot): IPermutatorArmor[] {
    const validSlots = [
      ArmorSlot.ArmorSlotHelmet,
      ArmorSlot.ArmorSlotGauntlet,
      ArmorSlot.ArmorSlotChest,
      ArmorSlot.ArmorSlotLegs,
      ArmorSlot.ArmorSlotClass,
    ];

    if (!validSlots.includes(slot)) {
      return [];
    }

    return this._availableItems.value.itemsBySlot[slot as ValidArmorSlot] || [];
  }

  /**
   * Get items for a specific slot as observable
   */
  getItemsForSlot$(slot: ArmorSlot): Observable<IPermutatorArmor[]> {
    const validSlots = [
      ArmorSlot.ArmorSlotHelmet,
      ArmorSlot.ArmorSlotGauntlet,
      ArmorSlot.ArmorSlotChest,
      ArmorSlot.ArmorSlotLegs,
      ArmorSlot.ArmorSlotClass,
    ];

    if (!validSlots.includes(slot)) {
      return new BehaviorSubject<IPermutatorArmor[]>([]).asObservable();
    }

    // Return memoized observable for consistency
    if (!this._slotObservables.has(slot)) {
      const slotObservable = this.availableItems$.pipe(
        map((items) => {
          const slotItems = items.itemsBySlot[slot as ValidArmorSlot] || [];
          console.debug(
            `AvailableItemsService: getItemsForSlot$ for slot ${slot} returned ${slotItems.length} items`
          );
          return slotItems;
        }),
        distinctUntilChanged((prev, curr) => _isEqual(prev, curr))
      );
      this._slotObservables.set(slot, slotObservable);
    }

    return this._slotObservables.get(slot)!;
  }

  /**
   * Get all class items
   */
  get classItems(): IPermutatorArmor[] {
    return this._availableItems.value.classItems;
  }

  /**
   * Get all class items as observable
   */
  get classItems$(): Observable<IPermutatorArmor[]> {
    return this.availableItems$.pipe(
      map((items) => items.classItems),
      distinctUntilChanged((prev, curr) => _isEqual(prev, curr))
    );
  }

  /**
   * Get available class item perk types
   */
  get availableClassItemPerkTypes(): Set<ArmorPerkOrSlot> {
    return this._availableItems.value.availableClassItemPerkTypes;
  }

  /**
   * Get available class item perk types as observable
   */
  get availableClassItemPerkTypes$(): Observable<Set<ArmorPerkOrSlot>> {
    return this.availableItems$.pipe(
      map((items) => items.availableClassItemPerkTypes),
      distinctUntilChanged((prev, curr) => _isEqual(prev, curr))
    );
  }

  /**
   * Check if any items are available for the given configuration
   */
  hasAvailableItems(): boolean {
    const items = this._availableItems.value;
    return Object.values(items.itemsBySlot).some((slotItems) => slotItems.length > 0);
  }

  /**
   * Check if items are available for a specific slot
   */
  hasItemsForSlot(slot: ArmorSlot): boolean {
    return this.getItemsForSlot(slot).length > 0;
  }

  private async updateAvailableItems(config: BuildConfiguration): Promise<void> {
    try {
      // Get all inventory items for the current class
      let inventoryItems = (await this.db.inventoryArmor
        .where("clazz")
        .equals(config.characterClass)
        .distinct()
        .toArray()) as IInventoryArmor[];

      // Apply all filtering logic (extracted from inventory.service.ts and results-builder.worker.ts)
      const filteredItems = this.applyItemFilters(inventoryItems, config);

      // Convert to permutator armor items
      const permutatorItems = this.convertToPermutatorArmor(filteredItems);

      // Remove duplicates (collection/vendor items if inventory version exists)
      const deduplicatedItems = this.removeDuplicateItems(permutatorItems);

      // Process class items specially
      const processedClassItems = this.processClassItems(deduplicatedItems, config);

      // Group items by slot
      const itemsBySlot = this.groupItemsBySlot(deduplicatedItems);

      // Calculate additional info
      const availableClassItemPerkTypes = new Set(processedClassItems.map((item) => item.perk));
      const exoticClassItems = processedClassItems.filter((item) => item.isExotic);
      const legendaryClassItems = processedClassItems.filter((item) => !item.isExotic);
      const exoticClassItemIsEnforced = exoticClassItems.some(
        (item) => config.selectedExotics.indexOf(item.hash) > -1
      );

      // Update the behavior subject
      console.debug("AvailableItemsService: Updating available items", {
        totalItems: deduplicatedItems.length,
        helmets: itemsBySlot[ArmorSlot.ArmorSlotHelmet].length,
        gauntlets: itemsBySlot[ArmorSlot.ArmorSlotGauntlet].length,
        chests: itemsBySlot[ArmorSlot.ArmorSlotChest].length,
        legs: itemsBySlot[ArmorSlot.ArmorSlotLegs].length,
        classItems: itemsBySlot[ArmorSlot.ArmorSlotClass].length,
      });

      this._availableItems.next({
        itemsBySlot,
        totalItems: deduplicatedItems.length,
        classItems: processedClassItems,
        availableClassItemPerkTypes,
        exoticClassItems,
        legendaryClassItems,
        exoticClassItemIsEnforced,
      });
    } catch (error) {
      console.error("Error updating available items:", error);
    }
  }

  private applyItemFilters(
    items: IInventoryArmor[],
    config: BuildConfiguration
  ): IInventoryArmor[] {
    const exoticSlots = items
      .filter((item) => config.selectedExotics.indexOf(item.hash) > -1)
      .map((item) => item.slot);

    const exoticLimitedSlots = exoticSlots.length > 0 ? exoticSlots[0] : null;

    return (
      items
        // Only armor pieces
        .filter((item) => item.slot !== ArmorSlot.ArmorSlotNone)
        // Filter disabled items
        .filter((item) => config.disabledItems.indexOf(item.itemInstanceId) === -1)
        // Filter featured armor if enforced
        .filter((item) => !config.enforceFeaturedArmor || item.isFeatured)
        // Filter armor system
        .filter((item) => item.armorSystem === ArmorSystem.Armor3 || config.allowLegacyArmor)
        // Filter collection/vendor rolls based on settings
        .filter((item) => {
          switch (item.source) {
            case InventoryArmorSource.Collections:
              return config.includeCollectionRolls;
            case InventoryArmorSource.Vendor:
              return config.includeVendorRolls;
            default:
              return true;
          }
        })
        // Filter selected exotic enforcement
        .filter(
          (item) => config.selectedExotics.indexOf(FORCE_USE_NO_EXOTIC) === -1 || !item.isExotic
        )
        // Filter based on selected exotics
        .filter((item) => {
          if (config.selectedExotics.length === 0) return true;
          if (item.isExotic) {
            return config.selectedExotics.some((exoticHash) => item.hash === exoticHash);
          } else {
            // For non-exotic items, ensure no selected exotic conflicts with this slot
            return item.slot !== exoticLimitedSlots;
          }
        })
        // Filter masterworked exotics if required
        .filter(
          (item) =>
            !config.onlyUseMasterworkedExotics ||
            !(item.rarity === TierType.Exotic && item.masterworkLevel !== MAXIMUM_MASTERWORK_LEVEL)
        )
        // Filter masterworked legendaries if required
        .filter(
          (item) =>
            !config.onlyUseMasterworkedLegendaries ||
            !(
              item.rarity === TierType.Superior && item.masterworkLevel !== MAXIMUM_MASTERWORK_LEVEL
            )
        )
        // Filter blue armor pieces if not allowed
        .filter(
          (item) =>
            config.allowBlueArmorPieces ||
            item.rarity === TierType.Exotic ||
            item.rarity === TierType.Superior
        )
        // Filter sunset armor if ignored
        .filter((item) => !config.ignoreSunsetArmor || !item.isSunset)
        // Filter armor perks
        .filter((item) => {
          const slotConfig = config.armorPerks[item.slot];

          // If perk is set to "Any", allow all items
          if (slotConfig.value === ArmorPerkOrSlot.Any) return true;

          // If perk is not fixed, allow all items
          if (!slotConfig.fixed) return true;

          // For exotic items, they might have different perk requirements
          if (item.isExotic && item.perk === slotConfig.value) return true;

          // Check if the item's perk matches the required perk
          if (slotConfig.value === item.perk) return true;

          // Special case for artifice assumption
          if (
            slotConfig.value === ArmorPerkOrSlot.SlotArtifice &&
            item.armorSystem === ArmorSystem.Armor2 &&
            ((config.assumeEveryLegendaryIsArtifice && !item.isExotic) ||
              (config.assumeEveryExoticIsArtifice && item.isExotic))
          ) {
            return true;
          }

          return false;
        })
    );
  }

  private convertToPermutatorArmor(items: IInventoryArmor[]): IPermutatorArmor[] {
    return items.map((armor) => ({
      id: armor.id,
      hash: armor.hash,
      slot: armor.slot,
      clazz: armor.clazz,
      perk: armor.perk,
      isExotic: armor.isExotic,
      rarity: armor.rarity,
      isSunset: armor.isSunset,
      masterworkLevel: armor.masterworkLevel,
      archetypeStats: armor.archetypeStats,
      mobility: armor.mobility,
      resilience: armor.resilience,
      recovery: armor.recovery,
      discipline: armor.discipline,
      intellect: armor.intellect,
      strength: armor.strength,
      source: armor.source,
      exoticPerkHash: armor.exoticPerkHash,
      icon: armor.icon,
      watermarkIcon: armor.watermarkIcon,
      name: armor.name,
      energyLevel: armor.energyLevel,
      tier: armor.tier,
      armorSystem: armor.armorSystem,
    }));
  }

  private removeDuplicateItems(items: IPermutatorArmor[]): IPermutatorArmor[] {
    return items.filter((item) => {
      if (item.source === InventoryArmorSource.Inventory) return true;

      const purchasedItemInstance = items.find(
        (rhs) =>
          rhs.source === InventoryArmorSource.Inventory && this.isEqualPermutatorItem(item, rhs)
      );

      // If this item is a collection/vendor item, ignore it if the player
      // already has a real copy of the same item.
      return purchasedItemInstance === undefined;
    });
  }

  private isEqualPermutatorItem(item1: IPermutatorArmor, item2: IPermutatorArmor): boolean {
    // Convert to IInventoryArmor-like objects for comparison
    const armor1 = item1 as any;
    const armor2 = item2 as any;
    return isEqualItem(armor1, armor2);
  }

  private processClassItems(
    items: IPermutatorArmor[],
    config: BuildConfiguration
  ): IPermutatorArmor[] {
    let classItems = items.filter((item) => item.slot === ArmorSlot.ArmorSlotClass);

    // Apply artifice assumptions
    if (
      config.assumeEveryLegendaryIsArtifice ||
      config.assumeEveryExoticIsArtifice ||
      config.assumeClassItemIsArtifice
    ) {
      classItems = classItems.map((item) => {
        if (
          (item.armorSystem === ArmorSystem.Armor2 &&
            ((config.assumeEveryLegendaryIsArtifice && !item.isExotic) ||
              (config.assumeEveryExoticIsArtifice && item.isExotic))) ||
          (config.assumeClassItemIsArtifice && !item.isExotic)
        ) {
          return { ...item, perk: ArmorPerkOrSlot.SlotArtifice };
        }
        return item;
      });
    }

    // Filter class items based on fixed perk requirements
    if (
      config.armorPerks[ArmorSlot.ArmorSlotClass].fixed &&
      config.armorPerks[ArmorSlot.ArmorSlotClass].value !== ArmorPerkOrSlot.Any
    ) {
      classItems = classItems.filter(
        (item) => item.perk === config.armorPerks[ArmorSlot.ArmorSlotClass].value
      );
    }

    // Filter exotic class items based on selected exotic perks
    if (config.selectedExoticPerks && config.selectedExoticPerks.length >= 2) {
      const firstPerkFilter = config.selectedExoticPerks[0];
      const secondPerkFilter = config.selectedExoticPerks[1];

      if (firstPerkFilter !== ArmorPerkOrSlot.Any || secondPerkFilter !== ArmorPerkOrSlot.Any) {
        classItems = classItems.filter((item) => {
          if (!item.isExotic || !item.exoticPerkHash || item.exoticPerkHash.length < 2) {
            return true; // Keep non-exotic items or items without proper perk data
          }

          const hasFirstPerk =
            firstPerkFilter === ArmorPerkOrSlot.Any ||
            item.exoticPerkHash.includes(firstPerkFilter);
          const hasSecondPerk =
            secondPerkFilter === ArmorPerkOrSlot.Any ||
            item.exoticPerkHash.includes(secondPerkFilter);

          return hasFirstPerk && hasSecondPerk;
        });
      }
    }

    // Sort by masterwork level, descending
    classItems = classItems.sort((a, b) => (b.masterworkLevel ?? 0) - (a.masterworkLevel ?? 0));

    // Check if any armor perks is not "any" for deduplication purposes
    const doesNotRequireArmorPerks = ![
      config.armorPerks[ArmorSlot.ArmorSlotHelmet].value,
      config.armorPerks[ArmorSlot.ArmorSlotGauntlet].value,
      config.armorPerks[ArmorSlot.ArmorSlotChest].value,
      config.armorPerks[ArmorSlot.ArmorSlotLegs].value,
      config.armorPerks[ArmorSlot.ArmorSlotClass].value,
    ].every((v) => v === ArmorPerkOrSlot.Any);

    // Check if any stat is fixed for deduplication purposes
    const anyStatFixed = Object.values(config.minimumStatTiers).some((v) => v.fixed);

    // Deduplicate class items based on stats and other criteria
    return classItems.filter(
      (item, index, self) =>
        index ===
        self.findIndex(
          (i) =>
            i.mobility === item.mobility &&
            i.resilience === item.resilience &&
            i.recovery === item.recovery &&
            i.discipline === item.discipline &&
            i.intellect === item.intellect &&
            i.strength === item.strength &&
            i.isExotic === item.isExotic &&
            ((i.isExotic && config.assumeExoticsMasterworked) ||
              (!i.isExotic && config.assumeLegendariesMasterworked) ||
              (anyStatFixed && i.masterworkLevel === item.masterworkLevel) ||
              !anyStatFixed) &&
            (i.isExotic
              ? i.exoticPerkHash[0] === item.exoticPerkHash[0] &&
                i.exoticPerkHash[1] === item.exoticPerkHash[1]
              : true) &&
            (doesNotRequireArmorPerks || i.perk === item.perk)
        )
    );
  }

  private groupItemsBySlot(items: IPermutatorArmor[]): AvailableItemsBySlot {
    const itemsBySlot: AvailableItemsBySlot = {
      [ArmorSlot.ArmorSlotHelmet]: [],
      [ArmorSlot.ArmorSlotGauntlet]: [],
      [ArmorSlot.ArmorSlotChest]: [],
      [ArmorSlot.ArmorSlotLegs]: [],
      [ArmorSlot.ArmorSlotClass]: [],
    };

    for (const item of items) {
      if (item.slot in itemsBySlot) {
        (itemsBySlot as any)[item.slot].push(item);
      }
    }

    return itemsBySlot;
  }
}
