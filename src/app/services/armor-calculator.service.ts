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
import { LoggingProxyService } from "./logging-proxy.service";
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
import { getSkillTier, getWaste } from "./results-builder.worker";
import { IPermutatorArmor } from "../data/types/IPermutatorArmor";
import { FORCE_USE_NO_EXOTIC, MAXIMUM_MASTERWORK_LEVEL } from "../data/constants";
import { calculateCPUConcurrency } from "../data/commonFunctions";
import { ModOptimizationStrategy } from "../data/enum/mod-optimization-strategy";
import { ArmorSystem } from "../data/types/IManifestArmor";
import { combineLatest, Subscription } from "rxjs";
import { debounceTime, distinctUntilChanged, catchError, startWith } from "rxjs/operators";
import { of } from "rxjs";

type info = {
  results: ResultDefinition[];
  savedResults: number;
  totalPermutations: number;
  maximumPossibleTiers: number[];
  itemCount: number;
  totalTime: number | null;
};

interface WorkerMessageData {
  // Progress update properties
  checkedCalculations: number;
  estimatedCalculations: number;
  reachableTiers?: number[]; // Available in progress messages
  resultLimitReached?: boolean; // Indicates this worker hit its local result cap

  // Runtime data (available when results are sent)
  runtime?: {
    maximumPossibleTiers: number[];
  };

  // Results data (available when results are sent)
  results?: IPermutatorArmorSet[];
  done?: boolean;

  // Statistics (available in final completion message)
  stats?: {
    savedResults: number;
    computedPermutations: number;
    itemCount: number;
    totalTime: number;
  };
}

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
  private _totalPossibleCombinations: BehaviorSubject<number> = new BehaviorSubject<number>(0);
  public readonly totalPossibleCombinations: Observable<number> =
    this._totalPossibleCombinations.asObservable();

  private calculationSubscription?: Subscription;

  // Static properties for calculation state
  private static workers: Worker[] = [];
  private static results: IPermutatorArmorSet[] = [];
  private static savedResultsCount = 0;
  private static totalPermutationsCount = 0;
  private static resultMaximumTiers: number[][] = [];
  private static selectedExotics: IManifestArmor[] = [];
  private static endResults: ResultDefinition[] = [];

  // Static thread tracking arrays
  private static threadCalculationAmountArr: number[] = [];
  private static threadCalculationDoneArr: number[] = [];
  private static threadCalculationReachableTiers: number[][] = [];
  private static threadResultLimitReachedArr: boolean[] = [];
  private static globalMaximumPossibleTiers: number[] = [0, 0, 0, 0, 0, 0];
  private static updateResultsStart: number = 0;

  // Static progress and worker state
  private static doneWorkerCount = 0;
  private static lastProgressUpdateTime = 0;
  private static emittedPossibleCombinations = false;
  private static allThreadsResultLimitReached = false;

  // Cancellation handling
  private static cancellationRequested = false;
  private static cancellationTimeoutId: any = null;

  constructor(
    private db: DatabaseService,
    private status: StatusProviderService,
    private userInfo: UserInformationService,
    private config: ConfigurationService,
    private logger: LoggingProxyService,
    private router: Router
  ) {
    this.logger.debug(
      "ArmorCalculatorService",
      "constructor",
      "Initializing ArmorCalculatorService"
    );

    this._armorResults = new BehaviorSubject({
      results: ArmorCalculatorService.endResults,
    } as info);
    this.armorResults = this._armorResults.asObservable();

    this._reachableTiers = new BehaviorSubject([0, 0, 0, 0, 0, 0]);
    this.reachableTiers = this._reachableTiers.asObservable();

    // Static workers array is already initialized

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

            if (this.userInfo.isFetchingManifest || this.userInfo.isRefreshing) {
              this.logger.debug(
                "ArmorCalculatorService",
                "setupCalculationTriggers",
                "UserInformationService is still fetching manifest or refreshing, skipping calculation"
              );
              return;
            }

            const buildConfig = config as BuildConfiguration;
            if (buildConfig.characterClass !== DestinyClass.Unknown) {
              this.logger.info(
                "ArmorCalculatorService",
                "setupCalculationTriggers",
                "Triggering calculation for class: " + buildConfig.characterClass
              );
              this.calculateArmorSetResults(buildConfig, buildConfig.characterClass);
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
    // Main page is either empty path or just '/', check for parametrized (?) routes and (#) fragments
    return (
      currentUrl === "/" ||
      currentUrl === "" ||
      currentUrl.split("?")[0] === "/" ||
      currentUrl.split("#")[0] === "/"
    );
  }

  private clearResults() {
    if (ArmorCalculatorService.endResults.length > 0) {
      ArmorCalculatorService.endResults = [];
      this._armorResults.next({
        results: ArmorCalculatorService.endResults,
        savedResults: 0,
        totalPermutations: 0,
        totalTime: 0,
        itemCount: 0,
        maximumPossibleTiers: [0, 0, 0, 0, 0, 0],
      });
    }
  }

  private killWorkers() {
    if (ArmorCalculatorService.workers.length > 0) {
      this.logger.debug("ArmorCalculatorService", "killWorkers", "Terminating all workers");
      ArmorCalculatorService.workers.forEach((w) => {
        w.terminate();
      });
      ArmorCalculatorService.workers = [];
    }
  }

  private static estimateCombinationsToBeChecked(
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

  public cancelCalculation() {
    this.logger.info("ArmorCalculatorService", "cancelCalculation", "Cancelling calculation");
    ArmorCalculatorService.cancellationRequested = true;

    // Mark calculation as cancelled immediately for the UI
    this.status.modifyStatus((s) => (s.calculatingResults = false));
    this.status.modifyStatus((s) => (s.cancelledCalculation = true));

    this._calculationProgress.next(0);
    this._totalPossibleCombinations.next(0);
    // Do NOT clear existing results here; keep the last
    // successfully computed table visible even after cancel.

    // Ask all active workers to cancel gracefully
    ArmorCalculatorService.workers.forEach((w, index) => {
      try {
        w.postMessage({ type: "cancel" });
      } catch (error) {
        this.logger.error(
          "ArmorCalculatorService",
          "cancelCalculation",
          `Failed to send cancel message to worker ${index}: ${error}`
        );
      }
    });

    // Clear any existing cancellation timeout
    if (ArmorCalculatorService.cancellationTimeoutId != null) {
      clearTimeout(ArmorCalculatorService.cancellationTimeoutId);
      ArmorCalculatorService.cancellationTimeoutId = null;
    }

    // Give workers up to 10 seconds to finish gracefully
    ArmorCalculatorService.cancellationTimeoutId = setTimeout(() => {
      if (ArmorCalculatorService.cancellationRequested) {
        this.logger.info(
          "ArmorCalculatorService",
          "cancelCalculation",
          "Force terminating workers after 10s cancellation grace period"
        );
        this.killWorkers();
        ArmorCalculatorService.cancellationRequested = false;
      }
    }, 10000);
  }

  private static estimateRequiredThreads(
    config: BuildConfiguration,
    permutatorArmorItems: IPermutatorArmor[]
  ): number {
    const helmets = permutatorArmorItems.filter((d) => d.slot == ArmorSlot.ArmorSlotHelmet);
    const gauntlets = permutatorArmorItems.filter((d) => d.slot == ArmorSlot.ArmorSlotGauntlet);
    const chests = permutatorArmorItems.filter((d) => d.slot == ArmorSlot.ArmorSlotChest);
    const legs = permutatorArmorItems.filter((d) => d.slot == ArmorSlot.ArmorSlotLegs);
    const estimatedCalculations = ArmorCalculatorService.estimateCombinationsToBeChecked(
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

    const nthreads = Math.min(
      Math.max(1, Math.ceil(estimatedCalculations / minimumCalculationPerThread)),
      Math.ceil(estimatedCalculations / maximumCalculationPerThread),
      calculateCPUConcurrency(), // estimated physical cores minus 1, minimum of 3 for desktop
      largestArmorBucket // limit it to the largest armor bucket, as we will split the work by this value
    );

    return nthreads;
  }

  private processWorkerMessage(
    data: WorkerMessageData,
    workerIndex: number,
    totalThreads: number,
    inventoryArmorItems: IInventoryArmor[]
  ): void {
    // Update calculation progress tracking (available in all message types)
    ArmorCalculatorService.threadCalculationDoneArr[workerIndex] = data.checkedCalculations;
    ArmorCalculatorService.threadCalculationAmountArr[workerIndex] = data.estimatedCalculations;
    ArmorCalculatorService.threadCalculationReachableTiers[workerIndex] = data.reachableTiers ||
      data.runtime?.maximumPossibleTiers || [0, 0, 0, 0, 0, 0];

    if (data.resultLimitReached) {
      ArmorCalculatorService.threadResultLimitReachedArr[workerIndex] = true;
    }

    // Aggregate per-stat maximum tiers across all workers (each worker can max different stats)
    const globalMaxTiers = ArmorCalculatorService.threadCalculationReachableTiers
      .slice(0, totalThreads)
      .reduce(
        (maxArr, currArr) => maxArr.map((val, idx) => Math.max(val, currArr?.[idx] ?? 0)),
        [0, 0, 0, 0, 0, 0]
      );

    const foundHigher = globalMaxTiers.some(
      (val, idx) => val > ArmorCalculatorService.globalMaximumPossibleTiers[idx]
    );

    if (foundHigher) {
      ArmorCalculatorService.globalMaximumPossibleTiers = [...globalMaxTiers];
      for (let i = 0; i < ArmorCalculatorService.workers.length; i++) {
        if (i !== workerIndex && ArmorCalculatorService.workers[i]) {
          ArmorCalculatorService.workers[i].postMessage({
            type: "siblingUpdate",
            threadId: workerIndex,
            maximumPossibleTiers: [...ArmorCalculatorService.globalMaximumPossibleTiers],
          });
        }
      }
    }

    const sumDone = ArmorCalculatorService.threadCalculationDoneArr.reduce((a, b) => a + b, 0);
    const sumTotal = ArmorCalculatorService.threadCalculationAmountArr.reduce((a, b) => a + b, 0);

    // Emit total possible combinations once all workers have reported their estimates
    if (
      !ArmorCalculatorService.emittedPossibleCombinations &&
      ArmorCalculatorService.threadCalculationAmountArr
        .slice(0, totalThreads)
        .every((val) => val > 0)
    ) {
      ArmorCalculatorService.emittedPossibleCombinations = true;
      this._totalPossibleCombinations.next(sumTotal);
    }
    const reachableTiers = globalMaxTiers.map((k) => Math.min(200, k) / 10);
    this._reachableTiers.next(reachableTiers);

    // Check if all threads have started working (all elements > 0)
    if (
      ArmorCalculatorService.threadCalculationDoneArr.slice(0, totalThreads).every((val) => val > 0)
    ) {
      const newProgress = (sumDone / sumTotal) * 100;
      const now = performance.now();
      if (now - ArmorCalculatorService.lastProgressUpdateTime > 150) {
        // Update every 150ms
        ArmorCalculatorService.lastProgressUpdateTime = now;
        this._calculationProgress.next(newProgress);
      }
    }

    // Process results data (only available when runtime is present - partial/final results messages)
    if (data.runtime == null) return;

    // Add partial results to the collection
    ArmorCalculatorService.results.push(...(data.results as IPermutatorArmorSet[]));

    // When every worker has hit its local result limit,
    if (
      !ArmorCalculatorService.allThreadsResultLimitReached &&
      ArmorCalculatorService.threadResultLimitReachedArr.every((val) => val)
    ) {
      console.log("All threads have reached their local result limit");
      console.log(
        ArmorCalculatorService.results.length +
          " results found, " +
          sumDone +
          " calculations done out of estimated " +
          sumTotal
      );
      this.processIntermediateResults(inventoryArmorItems);

      ArmorCalculatorService.allThreadsResultLimitReached = true;
    }

    // Handle completion of individual worker threads
    if (data.done == true) {
      ArmorCalculatorService.doneWorkerCount++;
      ArmorCalculatorService.savedResultsCount += data.stats!.savedResults; // stats only available when done=true
      ArmorCalculatorService.totalPermutationsCount += data.stats!.computedPermutations;
      ArmorCalculatorService.resultMaximumTiers.push(data.runtime.maximumPossibleTiers);
    }

    if (data.done == true && ArmorCalculatorService.doneWorkerCount == totalThreads) {
      this.processCompleteResults(inventoryArmorItems);
      ArmorCalculatorService.workers[workerIndex].terminate();
    } else if (data.done == true && ArmorCalculatorService.doneWorkerCount != totalThreads) {
      ArmorCalculatorService.workers[workerIndex].terminate();
    }
  }

  private processCompleteResults(inventoryArmorItems: IInventoryArmor[]): void {
    this.status.modifyStatus((s) => (s.calculatingResults = false));
    this._calculationProgress.next(0);

    ArmorCalculatorService.endResults = [];

    for (let armorSet of ArmorCalculatorService.results) {
      let items = armorSet.armor.map((x) =>
        inventoryArmorItems.find((y) => y.id == x)
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
      ArmorCalculatorService.endResults.push(v);
    }

    this._armorResults.next({
      results: ArmorCalculatorService.endResults,
      savedResults: ArmorCalculatorService.savedResultsCount, // Total amount of results, differs from the real amount if the memory save setting is active
      totalPermutations: ArmorCalculatorService.totalPermutationsCount,
      itemCount: inventoryArmorItems.length,
      totalTime: performance.now() - ArmorCalculatorService.updateResultsStart,
      maximumPossibleTiers: ArmorCalculatorService.resultMaximumTiers
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
      "ArmorCalculatorService",
      "updateResults",
      `updateResults with WebWorker took ${updateResultsEnd - ArmorCalculatorService.updateResultsStart} ms`
    );
  }

  private processIntermediateResults(inventoryArmorItems: IInventoryArmor[]): void {
    // Do not toggle calculatingResults or reset progress; workers are still running.

    ArmorCalculatorService.endResults = [];

    for (let armorSet of ArmorCalculatorService.results) {
      const items = armorSet.armor.map((x) =>
        inventoryArmorItems.find((y) => y.id == x)
      ) as IInventoryArmor[];
      const exotic = items.find((x) => x.isExotic);
      const v: ResultDefinition = {
        loaded: false,
        tuningStats: armorSet.tuning,
        exotic:
          exotic == null
            ? undefined
            : {
                icon: exotic.icon,
                watermark: exotic.watermarkIcon,
                name: exotic.name,
                hash: exotic.hash,
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
            armorSystem: instance.armorSystem,
            masterworkLevel: instance.masterworkLevel,
            slot: instance.slot,
            perk: instance.perk,
            transferState: 0,
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
      ArmorCalculatorService.endResults.push(v);
    }

    this._armorResults.next({
      results: ArmorCalculatorService.endResults,
      savedResults: ArmorCalculatorService.results.length,
      totalPermutations: ArmorCalculatorService.totalPermutationsCount,
      itemCount: inventoryArmorItems.length,
      totalTime: null,
      maximumPossibleTiers: ArmorCalculatorService.globalMaximumPossibleTiers.map(
        (k) => Math.min(200, k) / 10
      ),
    });

    this.logger.info(
      "ArmorCalculatorService",
      "processIntermediateResults",
      "Published intermediate results after all workers reached result limit"
    );
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
      this.calculateArmorSetResults(config, config.characterClass);
    } else {
      this.logger.warn(
        "ArmorCalculatorService",
        "manualTriggerCalculation",
        "No valid config available for manual trigger"
      );
    }
  }

  private async filterAndPrepareInventoryItems(config: BuildConfiguration) {
    let inventoryArmorItems: IInventoryArmor[] = (await this.db.inventoryArmor
      .where("clazz")
      .equals(config.characterClass)
      .distinct()
      .toArray()) as IInventoryArmor[];

    inventoryArmorItems = inventoryArmorItems
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
          item.armorSystem === ArmorSystem.Armor3 || !item.isExotic || config.allowLegacyExoticArmor
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
      .filter((item) => config.selectedExotics.indexOf(FORCE_USE_NO_EXOTIC) == -1 || !item.isExotic)
      .filter(
        (item) =>
          ArmorCalculatorService.selectedExotics.length === 0 ||
          (item.isExotic &&
            ArmorCalculatorService.selectedExotics.some(
              (exotic: IManifestArmor) => exotic.hash === item.hash
            )) ||
          (!item.isExotic &&
            ArmorCalculatorService.selectedExotics.every(
              (exotic: IManifestArmor) => exotic.slot !== item.slot
            ))
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
    inventoryArmorItems = inventoryArmorItems.filter((item) => {
      if (item.source === InventoryArmorSource.Inventory) return true;

      const purchasedItemInstance = inventoryArmorItems.find(
        (rhs) => rhs.source === InventoryArmorSource.Inventory && isEqualItem(item, rhs)
      );

      // If this item is a collection/vendor item, ignore it if the player
      // already has a real copy of the same item.
      return purchasedItemInstance === undefined;
    });
    return inventoryArmorItems;
  }

  static convertInventoryArmorToPermutatorArmor(armor: IInventoryArmor): IPermutatorArmor {
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

      //icon: armor.icon,
      //watermarkIcon: armor.watermarkIcon,
      //name: armor.name,
      //energyLevel: armor.energyLevel,
      tier: armor.tier,
      armorSystem: armor.armorSystem,
    };
  }

  async calculateArmorSetResults(
    config: BuildConfiguration,
    currentClass: DestinyClass,
    nthreads: number = 3
  ) {
    if (config.characterClass == DestinyClass.Unknown) {
      this.logger.info(
        "ArmorCalculatorService",
        "calculateArmorSetResults",
        "Character class is unknown, probably not loaded yet, skipping calculation"
      );
      return;
    }
    this.clearResults();
    this._totalPossibleCombinations.next(0);
    this.killWorkers();

    // Reset cancellation state for the new calculation
    ArmorCalculatorService.cancellationRequested = false;
    if (ArmorCalculatorService.cancellationTimeoutId != null) {
      clearTimeout(ArmorCalculatorService.cancellationTimeoutId);
      ArmorCalculatorService.cancellationTimeoutId = null;
    }

    try {
      ArmorCalculatorService.updateResultsStart = performance.now();
      this.status.modifyStatus((s) => (s.calculatingResults = true));
      this.status.modifyStatus((s) => (s.cancelledCalculation = false));

      ArmorCalculatorService.results = [];
      ArmorCalculatorService.savedResultsCount = 0;
      ArmorCalculatorService.totalPermutationsCount = 0;
      ArmorCalculatorService.resultMaximumTiers = [];

      // Reset progress and worker state
      ArmorCalculatorService.doneWorkerCount = 0;
      ArmorCalculatorService.lastProgressUpdateTime = performance.now();

      const tempSelectedExotics = await Promise.all(
        config.selectedExotics
          .filter((hash) => hash != FORCE_USE_NO_EXOTIC)
          .map(
            async (hash) =>
              (await this.db.manifestArmor.where("hash").equals(hash).first()) as IManifestArmor
          )
      );
      ArmorCalculatorService.selectedExotics = tempSelectedExotics.filter(
        (i: IManifestArmor) => !!i
      );

      let inventoryArmorItems: IInventoryArmor[] =
        await this.filterAndPrepareInventoryItems(config);

      let permutatorArmorItems: IPermutatorArmor[] = inventoryArmorItems.map((armor) =>
        ArmorCalculatorService.convertInventoryArmorToPermutatorArmor(armor)
      );

      if (
        permutatorArmorItems.length == 0 ||
        permutatorArmorItems.filter((d) => d.slot == ArmorSlot.ArmorSlotHelmet).length == 0 ||
        permutatorArmorItems.filter((d) => d.slot == ArmorSlot.ArmorSlotGauntlet).length == 0 ||
        permutatorArmorItems.filter((d) => d.slot == ArmorSlot.ArmorSlotChest).length == 0 ||
        permutatorArmorItems.filter((d) => d.slot == ArmorSlot.ArmorSlotLegs).length == 0
      ) {
        this.logger.warn(
          "ArmorCalculatorService",
          "updateResults",
          "Incomplete armor items available for permutation, skipping calculation"
        );
        this.status.modifyStatus((s) => (s.calculatingResults = false));
        return;
      }
      nthreads = ArmorCalculatorService.estimateRequiredThreads(config, permutatorArmorItems);
      this.logger.info("ArmorCalculatorService", "updateResults", "Estimated threads: " + nthreads);

      // Initialize static thread tracking arrays
      ArmorCalculatorService.emittedPossibleCombinations = false;
      ArmorCalculatorService.threadCalculationAmountArr = [...Array(nthreads).keys()].map(() => 0);
      ArmorCalculatorService.threadCalculationDoneArr = [...Array(nthreads).keys()].map(() => 0);
      ArmorCalculatorService.threadCalculationReachableTiers = [...Array(nthreads).keys()].map(() =>
        Array(6).fill(0)
      );
      ArmorCalculatorService.globalMaximumPossibleTiers = [0, 0, 0, 0, 0, 0];
      ArmorCalculatorService.threadResultLimitReachedArr = [...Array(nthreads).keys()].map(
        () => false
      );
      ArmorCalculatorService.allThreadsResultLimitReached = false;

      // Improve per thread performance by shuffling the inventory
      // sorting is a naive aproach that can be optimized
      // in my test is better than the default order from the db
      permutatorArmorItems = permutatorArmorItems.sort((a, b) => totalStats(b) - totalStats(a));
      this._calculationProgress.next(0);

      for (let n = 0; n < nthreads; n++) {
        ArmorCalculatorService.workers[n] = new Worker(
          new URL("./results-builder.worker", import.meta.url),
          {
            name: n.toString(),
          }
        );
        ArmorCalculatorService.workers[n].onmessage = (ev: MessageEvent) => {
          this.processWorkerMessage(ev.data, n, nthreads, inventoryArmorItems);
        };
        ArmorCalculatorService.workers[n].onerror = (ev) => {
          this.logger.error(
            "ArmorCalculatorService",
            "updateResults",
            `Worker ${n} error: ${ev.message} at ${ev.filename}:${ev.lineno}:${ev.colno}`
          );
          ArmorCalculatorService.workers[n].terminate();
        };

        ArmorCalculatorService.workers[n].postMessage({
          type: "builderRequest",
          currentClass: currentClass,
          config: config,
          threadSplit: {
            count: nthreads,
            current: n,
          },
          items: permutatorArmorItems,
          selectedExotics: ArmorCalculatorService.selectedExotics,
        });
      }
    } catch (error) {
      this.logger.error(
        "ArmorCalculatorService",
        "calculateArmorSetResults",
        "Error during calculation: " + error
      );
      this.status.modifyStatus((s) => (s.calculatingResults = false));
      this._calculationProgress.next(0);
      this.clearResults();
    } finally {
    }
  }
}
