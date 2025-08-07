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
import { NGXLogger } from "ngx-logger";
import { DatabaseService } from "./database.service";
import { ArmorSystem, IManifestArmor } from "../data/types/IManifestArmor";
import { ConfigurationService } from "./configuration.service";
import { debounceTime } from "rxjs/operators";
import { BehaviorSubject, Observable, ReplaySubject, Subject } from "rxjs";
import { BuildConfiguration } from "../data/buildConfiguration";
import { STAT_MOD_VALUES, StatModifier } from "../data/enum/armor-stat";
import { StatusProviderService } from "./status-provider.service";
import { BungieApiService } from "./bungie-api.service";
import { AuthService } from "./auth.service";
import { ArmorSlot } from "../data/enum/armor-slot";
import { NavigationEnd, Router } from "@angular/router";
import {
  ResultDefinition,
  ResultItem,
} from "../components/authenticated-v2/results/results.component";
import {
  IInventoryArmor,
  InventoryArmorSource,
  isEqualItem,
  totalStats,
} from "../data/types/IInventoryArmor";
import { DestinyClass, TierType } from "bungie-api-ts/destiny2";
import { IPermutatorArmorSet } from "../data/types/IPermutatorArmorSet";
import { getSkillTier, getWaste } from "./results-builder.worker";
import { IPermutatorArmor } from "../data/types/IPermutatorArmor";
import { FORCE_USE_NO_EXOTIC, MAXIMUM_MASTERWORK_LEVEL } from "../data/constants";
import { VendorsService } from "./vendors.service";
import { ModOptimizationStrategy } from "../data/enum/mod-optimization-strategy";
import { isEqual as _isEqual } from "lodash";
import { getDifferences } from "../data/commonFunctions";

type info = {
  results: ResultDefinition[];
  totalResults: number;
  maximumPossibleTiers: number[];
  itemCount: number;
  totalTime: number;
};

export type ClassExoticInfo = {
  inInventory: boolean;
  inCollection: boolean;
  inVendor: boolean;
  items: IManifestArmor[];
  instances: IInventoryArmor[];
};

@Injectable({
  providedIn: "root",
})
export class InventoryService {
  /**
   * An Int32Array that holds all permutations for the currently selected class, before filters are applied.
   * It consists of N items of length 11:
   * helmetHash, gauntletHash, chestHash, legHash, mobility, resilience, recovery, discipline, intellect, strength, exoticHash
   * @private
   */
  private allArmorResults: ResultDefinition[] = [];
  private currentClass: DestinyClass = DestinyClass.Unknown;
  private initialized: boolean = false;

  private _manifest: ReplaySubject<null>;
  public readonly manifest: Observable<null>;
  private _inventory: ReplaySubject<null>;
  public readonly inventory: Observable<null>;

  private _armorResults: BehaviorSubject<info>;
  public readonly armorResults: Observable<info>;

  private _reachableTiers: BehaviorSubject<number[]>;
  public readonly reachableTiers: Observable<number[]>;

  private _calculationProgress: Subject<number> = new Subject<number>();
  public readonly calculationProgress: Observable<number> =
    this._calculationProgress.asObservable();

  private _config: BuildConfiguration = BuildConfiguration.buildEmptyConfiguration();
  private workers: Worker[];

  private results: IPermutatorArmorSet[] = [];
  private totalPermutationCount = 0;
  private resultMaximumTiers: number[][] = [];
  private selectedExotics: IManifestArmor[] = [];
  private inventoryArmorItems: IInventoryArmor[] = [];
  private permutatorArmorItems: IPermutatorArmor[] = [];
  private endResults: ResultDefinition[] = [];

  constructor(
    private db: DatabaseService,
    private config: ConfigurationService,
    private status: StatusProviderService,
    private api: BungieApiService,
    private auth: AuthService,
    private router: Router,
    private vendors: VendorsService,
    private logger: NGXLogger
  ) {
    this._inventory = new ReplaySubject(1);
    this.inventory = this._inventory.asObservable();
    this._manifest = new ReplaySubject(1);
    this.manifest = this._manifest.asObservable();

    this._armorResults = new BehaviorSubject({
      results: this.allArmorResults,
    } as info);
    this.armorResults = this._armorResults.asObservable();

    this._reachableTiers = new BehaviorSubject([0, 0, 0, 0, 0, 0]);
    this.reachableTiers = this._reachableTiers.asObservable();

    this.workers = [];
    let dataAlreadyFetched = false;

    // TODO: This gives a race condition on some parts.
    router.events.pipe(debounceTime(5)).subscribe(async (val) => {
      if (this.auth.refreshTokenExpired || !(await this.auth.autoRegenerateTokens())) {
        this.logger.warn(
          "InventoryService",
          "router.events",
          "Refresh token expired, we should probably log the user out"
        );
        this.status.setAuthError();
      }
      if (!auth.isAuthenticated()) {
        this.logger.warn(
          "InventoryService",
          "router.events",
          "User is not authenticated, skipping router event handling"
        );
        return;
      }

      if (val instanceof NavigationEnd) {
        if (this._config == null) {
          this._config = structuredClone(this.config.readonlyConfigurationSnapshot);
        }

        this.killWorkers();
        this.clearResults();
        this.logger.debug(
          "InventoryService",
          "router.events",
          "Trigger refreshAll due to router.events"
        );
        this.initialized = true;
        await this.refreshAll(!dataAlreadyFetched);
        dataAlreadyFetched = true;
      }
    });

    this.config.configuration.pipe(debounceTime(500)).subscribe(async (c) => {
      if (this.auth.refreshTokenExpired || !(await this.auth.autoRegenerateTokens())) {
        this.logger.warn(
          "InventoryService",
          "config.configuration",
          "Refresh token expired, we should probably log the user out"
        );
        this.status.setAuthError();
        //await this.auth.logout();
        //return;
      }
      if (!auth.isAuthenticated()) {
        this.logger.warn(
          "InventoryService",
          "config.configuration",
          "User is not authenticated, skipping config change handling"
        );
        return;
      }

      if (_isEqual(c, this._config)) return;
      this.logger.debug(
        "InventoryService",
        "config.configuration",
        "Build configuration changed: " + JSON.stringify(getDifferences(this._config, c))
      );

      this._config = structuredClone(c);
      this.initialized = true;
      await this.refreshAll(!dataAlreadyFetched);
      dataAlreadyFetched = true;
    });
  }

  private clearResults() {
    this.allArmorResults = [];
    this._armorResults.next({
      results: this.allArmorResults,
      totalResults: 0,
      totalTime: 0,
      itemCount: 0,
      maximumPossibleTiers: [0, 0, 0, 0, 0, 0],
    });
  }

  shouldCalculateResults(): boolean {
    return this.router.url == "/";
  }

  private refreshing: boolean = false;

  async refreshAll(forceArmor: boolean = false, forceManifest = false) {
    if (this.refreshing) {
      this.logger.warn(
        "InventoryService",
        "refreshAll",
        "Refresh already in progress, skipping new refresh request"
      );
      return;
    }
    this.logger.debug("InventoryService", "refreshAll", "Refreshing inventory and manifest");
    try {
      this.refreshing = true;
      if (this.auth.refreshTokenExpired && !(await this.auth.autoRegenerateTokens())) {
        this.refreshing = false;
        this.status.setAuthError(); // Better way to logout the user?
        if (!this.status.getStatus().apiError) await this.auth.logout();
        return;
      }
      let armorUpdated = false;
      try {
        let manifestUpdated = await this.updateManifest(forceManifest);
        armorUpdated = await this.updateInventoryItems(manifestUpdated || forceArmor);
        this.updateVendorsAsync();
      } catch (e) {
        this.logger.error("InventoryService", "refreshAll", "Error: " + e);
      }

      await this.triggerArmorUpdateAndUpdateResults(armorUpdated);
    } finally {
      this.refreshing = false;
    }
  }

  private async triggerArmorUpdateAndUpdateResults(
    triggerInventoryUpdate: boolean = false,
    triggerResultsUpdate: boolean = true
  ) {
    // trigger armor update behaviour
    if (triggerInventoryUpdate) this._inventory.next(null);

    // Do not update results in Help and Cluster pages
    if (this.shouldCalculateResults()) {
      await this.updateResults();
    }
  }

  private updateVendorsAsync() {
    if (this.status.getStatus().updatingVendors) return;

    if (!this.vendors.isVendorCacheValid()) {
      this.status.modifyStatus((s) => (s.updatingVendors = true));
      this.vendors
        .updateVendorArmorItemsCache()
        .then((success) => {
          if (!success) return;
          this.triggerArmorUpdateAndUpdateResults(success, this._config.includeVendorRolls);
        })
        .finally(() => {
          this.status.modifyStatus((s) => (s.updatingVendors = false));
        });
    }
  }

  private killWorkers() {
    this.logger.debug("InventoryService", "killWorkers", "Terminating all workers");
    this.workers.forEach((w) => {
      w.terminate();
    });
    this.workers = [];
  }

  private estimateCombinationsToBeChecked(
    helmets: IPermutatorArmor[],
    gauntlets: IPermutatorArmor[],
    chests: IPermutatorArmor[],
    legs: IPermutatorArmor[]
  ) {
    let totalCalculations = 0;
    const exoticHelmets = helmets.filter((d) => d.isExotic).length;
    const legendaryHelmets = helmets.length - exoticHelmets;
    const exoticGauntlets = gauntlets.filter((d) => d.isExotic).length;
    const legendaryGauntlets = gauntlets.length - exoticGauntlets;
    const exoticChests = chests.filter((d) => d.isExotic).length;
    const legendaryChests = chests.length - exoticChests;
    const exoticLegs = legs.filter((d) => d.isExotic).length;
    const legendaryLegs = legs.length - exoticLegs;

    totalCalculations += exoticHelmets * legendaryGauntlets * legendaryChests * legendaryLegs;
    totalCalculations += legendaryHelmets * exoticGauntlets * legendaryChests * legendaryLegs;
    totalCalculations += legendaryHelmets * legendaryGauntlets * exoticChests * legendaryLegs;
    totalCalculations += legendaryHelmets * legendaryGauntlets * legendaryChests * exoticLegs;
    totalCalculations += legendaryHelmets * legendaryGauntlets * legendaryChests * legendaryLegs;
    return totalCalculations;
  }

  cancelCalculation() {
    this.logger.info("InventoryService", "cancelCalculation", "Cancelling calculation");
    this.killWorkers();
    this.status.modifyStatus((s) => (s.calculatingResults = false));
    this.status.modifyStatus((s) => (s.cancelledCalculation = true));

    this._calculationProgress.next(0);
    this.clearResults();
  }

  async updateResults(nthreads: number = 3) {
    let config = this._config;
    this.logger.debug(
      "InventoryService",
      "updateResults",
      "Using config for Workers: " + JSON.stringify({ configuration: config })
    );
    this.clearResults();
    this.killWorkers();

    try {
      const updateResultsStart = performance.now();
      this.status.modifyStatus((s) => (s.calculatingResults = true));
      this.status.modifyStatus((s) => (s.cancelledCalculation = false));
      let doneWorkerCount = 0;

      this.results = [];
      this.totalPermutationCount = 0;
      this.resultMaximumTiers = [];
      const startTime = Date.now();

      this.selectedExotics = await Promise.all(
        config.selectedExotics
          .filter((hash) => hash != FORCE_USE_NO_EXOTIC)
          .map(
            async (hash) =>
              (await this.db.manifestArmor.where("hash").equals(hash).first()) as IManifestArmor
          )
      );
      this.selectedExotics = this.selectedExotics.filter((i) => !!i);

      this.inventoryArmorItems = (await this.db.inventoryArmor
        .where("clazz")
        .equals(config.characterClass)
        .distinct()
        .toArray()) as IInventoryArmor[];

      this.inventoryArmorItems = this.inventoryArmorItems
        // only armor :)
        .filter((item) => item.slot != ArmorSlot.ArmorSlotNone)
        // filter disabled items
        .filter((item) => config.disabledItems.indexOf(item.itemInstanceId) == -1)
        // filter armor 3.0
        .filter((item) => item.isExotic || !config.enforceFeaturedLegendaryArmor || item.isFeatured)
        .filter((item) => !item.isExotic || !config.enforceFeaturedExoticArmor || item.isFeatured)
        .filter(
          (item) =>
            item.armorSystem === ArmorSystem.Armor3 ||
            item.isExotic ||
            config.allowLegacyLegendaryArmor
        )
        .filter(
          (item) =>
            item.armorSystem === ArmorSystem.Armor3 ||
            !item.isExotic ||
            config.allowLegacyExoticArmor
        )
        // filter collection/vendor rolls if not allowed
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
        // filter the selected exotic right here
        .filter(
          (item) => config.selectedExotics.indexOf(FORCE_USE_NO_EXOTIC) == -1 || !item.isExotic
        )
        .filter(
          (item) =>
            this.selectedExotics.length === 0 ||
            (item.isExotic && this.selectedExotics.some((exotic) => exotic.hash === item.hash)) ||
            (!item.isExotic && this.selectedExotics.every((exotic) => exotic.slot !== item.slot))
        )

        // config.OnlyUseMasterworkedExotics - only keep exotics that are masterworked
        .filter(
          (item) =>
            !config.onlyUseMasterworkedExotics ||
            !(item.rarity == TierType.Exotic && item.masterworkLevel != MAXIMUM_MASTERWORK_LEVEL)
        )

        // config.OnlyUseMasterworkedLegendaries - only keep legendaries that are masterworked
        .filter(
          (item) =>
            !config.onlyUseMasterworkedLegendaries ||
            !(item.rarity == TierType.Superior && item.masterworkLevel != MAXIMUM_MASTERWORK_LEVEL)
        )

        // non-legendaries and non-exotics
        .filter(
          (item) =>
            config.allowBlueArmorPieces ||
            item.rarity == TierType.Exotic ||
            item.rarity == TierType.Superior
        )
        // sunset armor
        .filter((item) => !config.ignoreSunsetArmor || !item.isSunset);
      // this.logger.debug("InventoryService", "updateResults", items.map(d => "id:'"+d.itemInstanceId+"'").join(" or "))

      // Remove collection items if they are in inventory
      this.inventoryArmorItems = this.inventoryArmorItems.filter((item) => {
        if (item.source === InventoryArmorSource.Inventory) return true;

        const purchasedItemInstance = this.inventoryArmorItems.find(
          (rhs) => rhs.source === InventoryArmorSource.Inventory && isEqualItem(item, rhs)
        );

        // If this item is a collection/vendor item, ignore it if the player
        // already has a real copy of the same item.
        return purchasedItemInstance === undefined;
      });
      this.permutatorArmorItems = this.inventoryArmorItems.map((armor) => {
        return {
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

          gearSetHash: armor.gearSetHash ?? null,
          tuningStatHash: armor.tuningStatHash,

          icon: armor.icon,
          watermarkIcon: armor.watermarkIcon,
          name: armor.name,
          energyLevel: armor.energyLevel,
          tier: armor.tier,
          armorSystem: armor.armorSystem,
        };
      });

      nthreads = this.estimateRequiredThreads();
      this.logger.info("InventoryService", "updateResults", "Estimated threads: " + nthreads);

      // Values to calculate ETA
      const threadCalculationAmountArr = [...Array(nthreads).keys()].map(() => 0);
      const threadCalculationDoneArr = [...Array(nthreads).keys()].map(() => 0);
      const threadCalculationReachableTiers: number[][] = [...Array(nthreads).keys()].map(() =>
        Array(6).fill(0)
      );
      let oldProgressValue = 0;

      // Improve per thread performance by shuffling the inventory
      // sorting is a naive aproach that can be optimized
      // in my test is better than the default order from the db
      this.permutatorArmorItems = this.permutatorArmorItems.sort(
        (a, b) => totalStats(b) - totalStats(a)
      );
      this._calculationProgress.next(0);

      for (let n = 0; n < nthreads; n++) {
        this.workers[n] = new Worker(new URL("./results-builder.worker", import.meta.url), {
          name: n.toString(),
        });
        this.workers[n].onmessage = async (ev) => {
          let data = ev.data;
          threadCalculationDoneArr[n] = data.checkedCalculations;
          threadCalculationAmountArr[n] = data.estimatedCalculations;
          threadCalculationReachableTiers[n] =
            data.reachableTiers || data.runtime.maximumPossibleTiers;
          const sumTotal = threadCalculationAmountArr.reduce((a, b) => a + b, 0);
          const sumDone = threadCalculationDoneArr.reduce((a, b) => a + b, 0);
          const minReachableTiers = threadCalculationReachableTiers
            .reduce((minArr, currArr) => {
              // Using MAX would be more accurate, but using min is more visually appealing as it leads to larger jumps
              return minArr.map((val, idx) => Math.max(val, currArr[idx]));
            })
            .map((k) => Math.min(200, k) / 10);
          this._reachableTiers.next(minReachableTiers);

          if (
            threadCalculationDoneArr[0] > 0 &&
            threadCalculationDoneArr[1] > 0 &&
            threadCalculationDoneArr[2] > 0
          ) {
            const newProgress = (sumDone / sumTotal) * 100;
            if (newProgress > oldProgressValue + 0.25) {
              oldProgressValue = newProgress;
              this._calculationProgress.next(newProgress);
            }
          }
          if (data.runtime == null) return;

          this.results.push(...(data.results as IPermutatorArmorSet[]));
          if (data.done == true) {
            doneWorkerCount++;
            this.totalPermutationCount += data.stats.permutationCount;
            this.resultMaximumTiers.push(data.runtime.maximumPossibleTiers);
          }
          if (data.done == true && doneWorkerCount == nthreads) {
            this.status.modifyStatus((s) => (s.calculatingResults = false));
            this._calculationProgress.next(0);

            this.endResults = [];

            for (let armorSet of this.results) {
              let items = armorSet.armor.map((x) =>
                this.inventoryArmorItems.find((y) => y.id == x)
              ) as IInventoryArmor[];
              let exotic = items.find((x) => x.isExotic);
              let v: ResultDefinition = {
                exotic:
                  exotic == null
                    ? undefined
                    : {
                        icon: exotic?.icon,
                        watermark: exotic?.watermarkIcon,
                        name: exotic?.name,
                        hash: exotic?.hash,
                      },
                artifice: armorSet.usedArtifice,
                modCount: armorSet.usedMods.length,
                modCost: armorSet.usedMods.reduce(
                  (p, d: StatModifier) => p + STAT_MOD_VALUES[d][2],
                  0
                ),
                mods: armorSet.usedMods,
                stats: armorSet.statsWithMods,
                statsNoMods: armorSet.statsWithoutMods,
                tiers: getSkillTier(armorSet.statsWithMods),
                waste: getWaste(armorSet.statsWithMods),
                items: items.map(
                  (instance): ResultItem => ({
                    energyLevel: instance.energyLevel,
                    hash: instance.hash,
                    itemInstanceId: instance.itemInstanceId,
                    name: instance.name,
                    exotic: !!instance.isExotic,
                    masterworked: instance.masterworkLevel == MAXIMUM_MASTERWORK_LEVEL,
                    archetypeStats: instance.archetypeStats,
                    armorSystem: instance.armorSystem, // 2 = Armor 2.0, 3 = Armor 3.0
                    masterworkLevel: instance.masterworkLevel,
                    slot: instance.slot,
                    perk: instance.perk,
                    transferState: 0, // TRANSFER_NONE
                    tier: instance.tier,
                    stats: [
                      instance.mobility,
                      instance.resilience,
                      instance.recovery,
                      instance.discipline,
                      instance.intellect,
                      instance.strength,
                    ],
                    source: instance.source,
                    statsNoMods: [],
                  })
                ),
                usesCollectionRoll: items.some(
                  (y) => y.source === InventoryArmorSource.Collections
                ),
                usesVendorRoll: items.some((y) => y.source === InventoryArmorSource.Vendor),
              } as ResultDefinition;
              this.endResults.push(v);
            }

            this._armorResults.next({
              results: this.endResults,
              totalResults: this.totalPermutationCount, // Total amount of results, differs from the real amount if the memory save setting is active
              itemCount: data.stats.itemCount,
              totalTime: Date.now() - startTime,
              maximumPossibleTiers: this.resultMaximumTiers
                .reduce(
                  (p, v) => {
                    for (let k = 0; k < 6; k++) if (p[k] < v[k]) p[k] = v[k];
                    return p;
                  },
                  [0, 0, 0, 0, 0, 0]
                )
                .map((k) => Math.min(200, k) / 10),
            });
            const updateResultsEnd = performance.now();
            this.logger.info(
              "InventoryService",
              "updateResults",
              `updateResults with WebWorker took ${updateResultsEnd - updateResultsStart} ms`
            );
            this.workers[n].terminate();
          } else if (data.done == true && doneWorkerCount != nthreads) this.workers[n].terminate();
        };
        this.workers[n].onerror = (ev) => {
          this.workers[n].terminate();
        };

        this.workers[n].postMessage({
          type: "builderRequest",
          currentClass: this.currentClass,
          config: this._config,
          threadSplit: {
            count: nthreads,
            current: n,
          },
          items: this.permutatorArmorItems,
          selectedExotics: this.selectedExotics,
        });
      }
    } finally {
    }
  }

  estimateRequiredThreads(): number {
    const helmets = this.permutatorArmorItems.filter((d) => d.slot == ArmorSlot.ArmorSlotHelmet);
    const gauntlets = this.permutatorArmorItems.filter(
      (d) => d.slot == ArmorSlot.ArmorSlotGauntlet
    );
    const chests = this.permutatorArmorItems.filter((d) => d.slot == ArmorSlot.ArmorSlotChest);
    const legs = this.permutatorArmorItems.filter((d) => d.slot == ArmorSlot.ArmorSlotLegs);
    const estimatedCalculations = this.estimateCombinationsToBeChecked(
      helmets,
      gauntlets,
      chests,
      legs
    );

    const largestArmorBucket = Math.max(
      helmets.length,
      gauntlets.length,
      chests.length,
      legs.length
    );

    let calculationMultiplier = 1.0;
    // very expensive calculations reduce the amount per thread
    if (
      this._config.tryLimitWastedStats &&
      this._config.modOptimizationStrategy != ModOptimizationStrategy.None
    ) {
      calculationMultiplier = 0.7;
    }

    let minimumCalculationPerThread = calculationMultiplier * 5e4;
    let maximumCalculationPerThread = calculationMultiplier * 2.5e5;

    const nthreads = Math.max(
      3, // Enforce a minimum of 3 threads
      Math.min(
        Math.max(1, Math.ceil(estimatedCalculations / minimumCalculationPerThread)),
        Math.ceil(estimatedCalculations / maximumCalculationPerThread),
        Math.floor((navigator.hardwareConcurrency || 2) * 0.75), // limit it to the amount of cores, and only use 75%
        20, // limit it to a maximum of 20 threads
        largestArmorBucket // limit it to the largest armor bucket, as we will split the work by this value
      )
    );

    return nthreads;
  }

  async getItemCountForClass(clazz: DestinyClass, slot?: ArmorSlot) {
    let pieces = await this.db.inventoryArmor.where("clazz").equals(clazz).toArray();
    if (!!slot) pieces = pieces.filter((i) => i.slot == slot);
    //if (!this._config.includeVendorRolls) pieces = pieces.filter((i) => i.source != InventoryArmorSource.Vendor);
    //if (!this._config.includeCollectionRolls) pieces = pieces.filter((i) => i.source != InventoryArmorSource.Collections);
    pieces = pieces.filter((i) => i.source == InventoryArmorSource.Inventory);
    return pieces.length;
  }

  async getExoticsForClass(clazz: DestinyClass, slot?: ArmorSlot): Promise<ClassExoticInfo[]> {
    let inventory = await this.db.inventoryArmor.where("isExotic").equals(1).toArray();
    inventory = inventory.filter(
      (d) =>
        d.clazz == clazz &&
        (d.armorSystem == ArmorSystem.Armor2 || d.armorSystem == ArmorSystem.Armor3) &&
        (!slot || d.slot == slot)
    );

    let exotics = await this.db.manifestArmor.where("isExotic").equals(1).toArray();
    exotics = exotics.filter(
      (d) =>
        d.clazz == clazz &&
        (d.armorSystem == ArmorSystem.Armor2 || d.armorSystem == ArmorSystem.Armor3) &&
        (!slot || d.slot == slot)
    );

    return exotics
      .map((ex) => {
        const instances = inventory.filter((i) => i.hash == ex.hash);
        return {
          items: [ex],
          instances: instances,
          inCollection:
            instances.find((i) => i.source === InventoryArmorSource.Collections) !== undefined,
          inInventory:
            instances.find((i) => i.source === InventoryArmorSource.Inventory) !== undefined,
          inVendor: instances.find((i) => i.source === InventoryArmorSource.Vendor) !== undefined,
        };
      })
      .reduce((acc: ClassExoticInfo[], curr: ClassExoticInfo) => {
        const existing = acc.find((e) => e.items[0].name === curr.items[0].name);
        if (existing) {
          existing.items.push(curr.items[0]);
          existing.instances.push(...curr.instances);
          existing.inCollection = existing.inCollection || curr.inCollection;
          existing.inInventory = existing.inInventory || curr.inInventory;
          existing.inVendor = existing.inVendor || curr.inVendor;
        } else {
          acc.push({ ...curr, items: [curr.items[0]] });
        }
        return acc;
      }, [] as ClassExoticInfo[])
      .sort((x, y) => x.items[0].name.localeCompare(y.items[0].name));
  }

  async updateManifest(force: boolean = false): Promise<boolean> {
    if (this.status.getStatus().updatingManifest) {
      this.logger.error(
        "InventoryService",
        "updateManifest",
        "Already updating the manifest - abort"
      );
      return false;
    }
    this.status.modifyStatus((s) => (s.updatingManifest = true));
    let r = await this.api.updateManifest(force).finally(() => {
      this.status.modifyStatus((s) => (s.updatingManifest = false));
    });
    if (!!r) this._manifest.next(null);
    return !!r;
  }

  async updateInventoryItems(force: boolean = false, errorLoop = 0): Promise<boolean> {
    this.status.modifyStatus((s) => (s.updatingInventory = true));

    try {
      let r = await this.api.updateArmorItems(force).finally(() => {
        this.status.modifyStatus((s) => (s.updatingInventory = false));
      });
      return !!r;
    } catch (e) {
      // After three tries, call it a day.
      if (errorLoop > 3) {
        alert(
          "You encountered a strange error with the inventory update. Please log out and log in again. If that does not fix it, please message Mijago."
        );
        return false;
      }

      this.status.modifyStatus((s) => (s.updatingInventory = false));
      this.logger.error("InventoryService", "updateInventoryItems", "Error: " + e);

      await this.status.setApiError();

      //await this.updateManifest(true);
      //return await this.updateInventoryItems(true, errorLoop++);
      return false;
    }
  }

  get isInitialized(): boolean {
    return this.initialized;
  }
}
