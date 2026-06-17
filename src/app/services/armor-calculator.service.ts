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

import { Injectable, OnDestroy } from "@angular/core";
import { NGXLogger } from "ngx-logger";
import { Router } from "@angular/router";
import { DatabaseService } from "./database.service";
import { IManifestArmor } from "../data/types/IManifestArmor";
import { BehaviorSubject, Observable, Subject } from "rxjs";
import { BuildConfiguration } from "../data/buildConfiguration";
import { STAT_MOD_VALUES, StatModifier } from "../data/enum/armor-stat";
import { StatusProviderService } from "./status-provider.service";
import { ConfigurationService } from "./configuration.service";
import { UserInformationService } from "./user-information.service";
import { ArmorSlot } from "../data/enum/armor-slot";
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
import {
  getSkillTier,
  getWaste,
  buildProfileKey,
  outputBuildBetter,
} from "./results-builder.worker";
import { IPermutatorArmor } from "../data/types/IPermutatorArmor";
import { FORCE_USE_NO_EXOTIC, MAXIMUM_MASTERWORK_LEVEL } from "../data/constants";
import { ModOptimizationStrategy } from "../data/enum/mod-optimization-strategy";
import { ArmorSystem } from "../data/types/IManifestArmor";
import { combineLatest, Subscription } from "rxjs";
import { debounceTime, distinctUntilChanged, catchError, startWith } from "rxjs/operators";
import { of } from "rxjs";

type info = {
  results: ResultDefinition[];
  totalResults: number;
  maximumPossibleTiers: number[];
  itemCount: number;
  totalTime: number;
};

@Injectable({
  providedIn: "root",
})
export class ArmorCalculatorService implements OnDestroy {
  private _armorResults: BehaviorSubject<info>;
  public readonly armorResults: Observable<info>;
  private _reachableTiers: BehaviorSubject<number[]>;
  public readonly reachableTiers: Observable<number[]>;
  private _calculationProgress: Subject<number> = new Subject<number>();
  public readonly calculationProgress: Observable<number> =
    this._calculationProgress.asObservable();

  private workers: Worker[];
  private results: IPermutatorArmorSet[] = [];
  private totalPermutationCount = 0;
  private resultMaximumTiers: number[][] = [];
  private selectedExotics: IManifestArmor[] = [];
  private inventoryArmorItems: IInventoryArmor[] = [];
  private permutatorArmorItems: IPermutatorArmor[] = [];
  private allArmorResults: ResultDefinition[] = [];

  private calculationSubscription?: Subscription;

  constructor(
    private db: DatabaseService,
    private status: StatusProviderService,
    private userInfo: UserInformationService,
    private config: ConfigurationService,
    private logger: NGXLogger,
    private router: Router
  ) {
    this.logger.debug(
      "ArmorCalculatorService",
      "constructor",
      "Initializing ArmorCalculatorService"
    );

    this._armorResults = new BehaviorSubject({
      results: this.allArmorResults,
    } as info);
    this.armorResults = this._armorResults.asObservable();

    this._reachableTiers = new BehaviorSubject([0, 0, 0, 0, 0, 0]);
    this.reachableTiers = this._reachableTiers.asObservable();

    this.workers = [];

    // Setup calculation triggers - use longer delay to ensure services are ready
    setTimeout(() => this.setupCalculationTriggers(), 100);

    this.logger.debug(
      "ArmorCalculatorService",
      "constructor",
      "Finished initializing ArmorCalculatorService"
    );
  }

  ngOnDestroy() {
    this.logger.debug("ArmorCalculatorService", "ngOnDestroy", "Destroying ArmorCalculatorService");
    this.calculationSubscription?.unsubscribe();
    this.killWorkers();
    this.logger.debug(
      "ArmorCalculatorService",
      "ngOnDestroy",
      "Finished destroying ArmorCalculatorService"
    );
  }

  private setupCalculationTriggers() {
    this.logger.debug(
      "ArmorCalculatorService",
      "setupCalculationTriggers",
      "Setting up calculation triggers"
    );

    try {
      // Verify services are available
      if (!this.userInfo) {
        this.logger.error(
          "ArmorCalculatorService",
          "setupCalculationTriggers",
          "UserInformationService not available"
        );
        return;
      }

      if (!this.config) {
        this.logger.error(
          "ArmorCalculatorService",
          "setupCalculationTriggers",
          "ConfigurationService not available"
        );
        return;
      }

      this.logger.debug(
        "ArmorCalculatorService",
        "setupCalculationTriggers",
        "Services available, setting up observables"
      );

      // this.router.events
      //   .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      //   .subscribe((event) => {
      //     this.logger.debug(
      //       "ArmorCalculatorService",
      //       "setupCalculationTriggers",
      //       "Route changed to: " + event.url
      //     );
      //   });

      // Set up single subscription that persists throughout the service lifecycle
      // Use startWith to ensure all observables have initial values for combineLatest
      this.calculationSubscription = combineLatest([
        this.userInfo.inventory.pipe(startWith(null)), // Start with null to ensure emission
        this.config.configuration,
      ])
        .pipe(
          debounceTime(100),
          distinctUntilChanged(),
          catchError((error) => {
            this.logger.error(
              "ArmorCalculatorService",
              "setupCalculationTriggers",
              "Error in observable stream: " + error
            );
            return of([null, null]); // Return empty values to continue the stream
          })
        )
        .subscribe({
          next: ([inventory, config]) => {
            // Only perform calculations if we're on the main page
            if (!this.isMainPage()) {
              this.logger.debug(
                "ArmorCalculatorService",
                "setupCalculationTriggers",
                "Not on main page, skipping calculation"
              );
              return;
            }

            if (!config) {
              return;
            }

            const buildConfig = config as BuildConfiguration;
            if (buildConfig.characterClass !== DestinyClass.Unknown) {
              this.logger.info(
                "ArmorCalculatorService",
                "setupCalculationTriggers",
                "Triggering calculation for class: " + buildConfig.characterClass
              );
              this.updateResults(buildConfig, buildConfig.characterClass);
            }
          },
          error: (error) => {
            this.logger.error(
              "ArmorCalculatorService",
              "setupCalculationTriggers",
              "Subscription error: " + error
            );
          },
        });

      this.logger.debug(
        "ArmorCalculatorService",
        "setupCalculationTriggers",
        "Calculation triggers set up successfully"
      );
    } catch (error) {
      this.logger.error(
        "ArmorCalculatorService",
        "setupCalculationTriggers",
        "Failed to setup triggers: " + error
      );
    }
  }

  private isMainPage(): boolean {
    const currentUrl = this.router.url;
    // Main page is either empty path or just '/'
    return currentUrl === "/" || currentUrl === "" || currentUrl.split("?")[0] === "/";
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

  private killWorkers() {
    this.logger.debug("ArmorCalculatorService", "killWorkers", "Terminating all workers");
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
    this.logger.info("ArmorCalculatorService", "cancelCalculation", "Cancelling calculation");
    this.killWorkers();
    this.status.modifyStatus((s) => (s.calculatingResults = false));
    this.status.modifyStatus((s) => (s.cancelledCalculation = true));

    this._calculationProgress.next(0);
    this.clearResults();
  }

  estimateRequiredThreads(config: BuildConfiguration): number {
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
      config.tryLimitWastedStats &&
      config.modOptimizationStrategy != ModOptimizationStrategy.None
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

  // Manual trigger method for testing
  manualTriggerCalculation() {
    this.logger.info(
      "ArmorCalculatorService",
      "manualTriggerCalculation",
      "Manually triggering calculation"
    );
    const config = this.config.readonlyConfigurationSnapshot;
    if (config && config.characterClass !== DestinyClass.Unknown) {
      this.updateResults(config, config.characterClass);
    } else {
      this.logger.warn(
        "ArmorCalculatorService",
        "manualTriggerCalculation",
        "No valid config available for manual trigger"
      );
    }
  }

  async updateResults(
    config: BuildConfiguration,
    currentClass: DestinyClass,
    nthreads: number = 3
  ) {
    if (config.characterClass == DestinyClass.Unknown) {
      this.logger.info(
        "ArmorCalculatorService",
        "updateResults",
        "Character class is unknown, probably not loaded yet, skipping updateResults"
      );
      return;
    }
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
      // this.logger.debug("ArmorCalculatorService", "updateResults", items.map(d => "id:'"+d.itemInstanceId+"'").join(" or "))

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
          tuningStat: armor.tuningStat,

          icon: armor.icon,
          watermarkIcon: armor.watermarkIcon,
          name: armor.name,
          energyLevel: armor.energyLevel,
          tier: armor.tier,
          armorSystem: armor.armorSystem,
        };
      });

      if (
        this.permutatorArmorItems.length == 0 ||
        this.permutatorArmorItems.filter((d) => d.slot == ArmorSlot.ArmorSlotHelmet).length == 0 ||
        this.permutatorArmorItems.filter((d) => d.slot == ArmorSlot.ArmorSlotGauntlet).length ==
          0 ||
        this.permutatorArmorItems.filter((d) => d.slot == ArmorSlot.ArmorSlotChest).length == 0 ||
        this.permutatorArmorItems.filter((d) => d.slot == ArmorSlot.ArmorSlotLegs).length == 0
      ) {
        this.logger.warn(
          "ArmorCalculatorService",
          "updateResults",
          "Incomplete armor items available for permutation, skipping calculation"
        );
        this.status.modifyStatus((s) => (s.calculatingResults = false));
        return;
      }
      nthreads = this.estimateRequiredThreads(config);
      this.logger.info("ArmorCalculatorService", "updateResults", "Estimated threads: " + nthreads);

      // Values to calculate ETA
      const threadCalculationAmountArr = [...Array(nthreads).keys()].map(() => 0);
      const threadCalculationDoneArr = [...Array(nthreads).keys()].map(() => 0);
      const threadCalculationReachableTiers: number[][] = [...Array(nthreads).keys()].map(() =>
        Array(6).fill(0)
      );
      let oldProgressValue = 0;

      // STREAMING state: each thread's FROZEN output frontier (from a cap preview or its final done),
      // so results can render as soon as every thread has frozen — while max-tiers keep settling.
      const threadFrontier: (IPermutatorArmorSet[] | null)[] = [...Array(nthreads).keys()].map(
        () => null
      );
      let emittedPreview = false;
      let streamItemCount = 0;
      // more-is-better == output is one best build per (exotic+set) profile; else union of frontiers.
      const moreIsBetter =
        !Object.values(config.minimumStatTiers).some((v) => v.fixed) &&
        !config.tryLimitWastedStats &&
        !config.onlyShowResultsWithNoWastedStats;

      // Improve per thread performance by shuffling the inventory
      // sorting is a naive aproach that can be optimized
      // in my test is better than the default order from the db
      this.permutatorArmorItems = this.permutatorArmorItems.sort(
        (a, b) => totalStats(b) - totalStats(a)
      );
      this._calculationProgress.next(0);

      // Slim per-worker payload: the worker is pure math and never reads the display-only fields
      // (icon/watermarkIcon/name URLs+strings, rarity, isSunset, source, energyLevel, clazz), which
      // are the bulk of the structured-clone cost when the full inventory is posted to EACH worker.
      // permutatorArmorItems stays full for main-thread display (icons mapped from result ids).
      // Built ONCE and reused for every worker. Keep in sync with the fields the worker accesses.
      const workerItems = this.permutatorArmorItems.map((a) => ({
        id: a.id,
        hash: a.hash,
        slot: a.slot,
        isExotic: a.isExotic,
        perk: a.perk,
        masterworkLevel: a.masterworkLevel,
        archetypeStats: a.archetypeStats,
        mobility: a.mobility,
        resilience: a.resilience,
        recovery: a.recovery,
        discipline: a.discipline,
        intellect: a.intellect,
        strength: a.strength,
        exoticPerkHash: a.exoticPerkHash,
        gearSetHash: a.gearSetHash ?? null,
        tuningStat: a.tuningStat,
        armorSystem: a.armorSystem,
        tier: a.tier,
      })) as unknown as IPermutatorArmor[];

      // Build the ResultDefinition list from the collected per-thread frontiers and emit it. Called
      // once per STREAMING preview (frozen builds, still-settling max-tiers) and once at FINAL done
      // (exact max-tiers). sourceBuilds order is preserved into the per-profile merge, so the FINAL
      // emit (sourceBuilds = this.results, the pre-streaming accumulation order) stays byte-identical
      // to the old behaviour; the preview is transient and replaced by the final.
      const emitResults = (sourceBuilds: IPermutatorArmorSet[], perThreadTiers: number[][]) => {
        let merged = sourceBuilds;
        if (moreIsBetter) {
          const idToPiece = new Map<number, any>(this.inventoryArmorItems.map((i) => [i.id, i]));
          const bestByProfile = new Map<string, IPermutatorArmorSet>();
          for (const armorSet of sourceBuilds) {
            const key = buildProfileKey(armorSet.armor, idToPiece);
            const cur = bestByProfile.get(key);
            if (!cur || outputBuildBetter(armorSet, cur)) bestByProfile.set(key, armorSet);
          }
          merged = Array.from(bestByProfile.values());
        }

        const endResults: ResultDefinition[] = [];
        for (let armorSet of merged) {
          let items = armorSet.armor.map((x) =>
            this.inventoryArmorItems.find((y) => y.id == x)
          ) as IInventoryArmor[];
          let exotic = items.find((x) => x.isExotic);
          let v: ResultDefinition = {
            loaded: false, // TODO check if loaded is even needed
            tuningStats: armorSet.tuning,
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
            modCost: armorSet.usedMods.reduce((p, d: StatModifier) => p + STAT_MOD_VALUES[d][2], 0),
            mods: armorSet.usedMods,
            stats: armorSet.statsWithMods,
            statsNoMods: armorSet.statsWithoutMods,
            tiers: getSkillTier(armorSet.statsWithMods),
            waste: getWaste(armorSet.statsWithMods),
            items: items.map(
              (instance): ResultItem => ({
                tuningStat: instance.tuningStat,
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
            usesCollectionRoll: items.some((y) => y.source === InventoryArmorSource.Collections),
            usesVendorRoll: items.some((y) => y.source === InventoryArmorSource.Vendor),
          };
          endResults.push(v);
        }

        this._armorResults.next({
          results: endResults,
          totalResults: this.totalPermutationCount, // differs from the real amount under the result cap
          itemCount: streamItemCount,
          totalTime: Date.now() - startTime,
          maximumPossibleTiers: perThreadTiers
            .reduce(
              (p, v) => {
                for (let k = 0; k < 6; k++) if (p[k] < v[k]) p[k] = v[k];
                return p;
              },
              [0, 0, 0, 0, 0, 0]
            )
            .map((k) => Math.min(200, k) / 10),
        });
      };

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
          // STREAMING preview: a thread froze its output at the result cap (the slow 3+/fixed/waste
          // path keeps walking only to settle max-tiers). Record its frozen frontier; once EVERY
          // thread has a frozen frontier (preview here, or its final done below), render results NOW
          // with the current still-settling max-tiers. Sliders keep streaming live, and the final
          // `done` re-emits with the exact max-tiers. Fired at most once.
          if (data.previewResults) {
            threadFrontier[n] = data.previewResults as IPermutatorArmorSet[];
            if (data.itemCount != null) streamItemCount = data.itemCount;
            if (!emittedPreview && threadFrontier.every((f) => f != null)) {
              emittedPreview = true;
              const previewBuilds = ([] as IPermutatorArmorSet[]).concat(
                ...threadFrontier.map((f) => f as IPermutatorArmorSet[])
              );
              emitResults(previewBuilds, threadCalculationReachableTiers);
            }
            return;
          }

          if (data.runtime == null) return;

          // FINAL accumulation. this.results stays the pre-streaming arrival-order accumulation so the
          // final emit is byte-identical; threadFrontier[n] also records the (now final) frontier.
          this.results.push(...(data.results as IPermutatorArmorSet[]));
          threadFrontier[n] = data.results as IPermutatorArmorSet[];
          if (data.done == true) {
            doneWorkerCount++;
            this.totalPermutationCount += data.stats.permutationCount;
            if (data.stats && data.stats.itemCount != null) streamItemCount = data.stats.itemCount;
            this.resultMaximumTiers.push(data.runtime.maximumPossibleTiers);
          }
          if (data.done == true && doneWorkerCount == nthreads) {
            this.status.modifyStatus((s) => (s.calculatingResults = false));
            this._calculationProgress.next(0);

            // Each worker sent its per-(exotic+set) best build (or, under fixed-stat/waste configs,
            // its per-profile frontier). emitResults merges across threads so the user sees ONE best
            // build per exotic+set profile globally (max total stats); else the union of frontiers.
            emitResults(this.results, this.resultMaximumTiers);

            const updateResultsEnd = performance.now();
            this.logger.info(
              "ArmorCalculatorService",
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
          currentClass: currentClass,
          config: config,
          threadSplit: {
            count: nthreads,
            current: n,
          },
          items: workerItems,
          selectedExotics: this.selectedExotics,
        });
      }
    } finally {
    }
  }
}
