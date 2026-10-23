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
import { ArmorPerkOrSlot, ArmorStat } from "../data/enum/armor-stat";
import { StatusProviderService } from "./status-provider.service";
import { ConfigurationService } from "./configuration.service";
import { UserInformationService } from "./user-information.service";
import { ArmorSlot } from "../data/enum/armor-slot";
import { ResultDefinition } from "../components/authenticated-v2/results/results.component";
import {
  IInventoryArmor,
  InventoryArmorSource,
  isEqualItem,
  totalStats,
} from "../data/types/IInventoryArmor";
import { DestinyClass, TierType } from "bungie-api-ts/destiny2";
import { IPermutatorArmorSet } from "../data/types/IPermutatorArmorSet";
import {
  ResultEntry,
  buildResultEntry,
  compareResultEntries,
  mergeResultEntries,
  updateSharedBuildCounts,
} from "./armor-result-entries";
import { PackedArmorSets, unpackArmorSets } from "./packed-armor-sets";
import { retainMatchingResults } from "./armor-result-retention";
import { IPermutatorArmor } from "../data/types/IPermutatorArmor";
import { FORCE_USE_NO_EXOTIC, MAXIMUM_MASTERWORK_LEVEL } from "../data/constants";
import { calculateCPUConcurrency } from "../data/commonFunctions";
import { ModOptimizationStrategy } from "../data/enum/mod-optimization-strategy";
import { EventArmorType } from "../data/enum/event-armor-type";
import { ArmorSystem } from "../data/types/IManifestArmor";
import { hasLegalT5Shape } from "../data/theorizer";
import { environment } from "../../environments/environment";
import type { T5LimitsReply, T5LimitsRequest } from "./theorizer-model";
import { combineLatest, Subscription } from "rxjs";
import { debounceTime, catchError, startWith } from "rxjs/operators";
import { of } from "rxjs";

export interface PrunedArmorItemView {
  item: IInventoryArmor;
  pruned: boolean;
  prunedBy?: IInventoryArmor | null;
}

export type ArmorPoolItemView = PrunedArmorItemView;

type info = {
  results: ResultDefinition[];
  savedResults: number;
  totalPermutations: number;
  resultLimitReached: boolean;
  stoppedEarlyAtMaxTier: boolean;
  maximumPossibleTiers: number[];
  itemCount: number;
  totalTime: number | null;
  prePruneArmorItems: PrunedArmorItemView[];
};

interface PreparedInventoryArmorItems {
  items: IInventoryArmor[];
  duplicates: IInventoryArmor[];
  duplicatePruners: Map<number, IInventoryArmor>;
}

interface WorkerMessageData {
  error?: { name: string; message: string; stack?: string };
  // Progress update properties
  checkedCalculations: number;
  estimatedCalculations: number;
  computedPermutations: number;
  reachableTiers?: number[]; // Available in progress messages
  resultLimitReached?: boolean; // Indicates this worker hit its local result cap
  stoppedEarlyAtMaxTier?: boolean;

  // Runtime data (available when results are sent)
  runtime?: {
    maximumPossibleTiers: number[];
  };

  // Results data (available when results are sent)
  packed?: PackedArmorSets;
  done?: boolean;

  // Statistics (available in final completion message)
  stats?: {
    savedResults: number;
    computedPermutations: number;
    itemCount: number;
    totalTime: number;
  };
}

export function formatWorkerErrorEvent(workerIndex: number, event: ErrorEvent): string {
  const error = event.error as
    | { name?: unknown; message?: unknown; stack?: unknown }
    | null
    | undefined;
  const errorName = typeof error?.name === "string" ? error.name : "";
  const errorMessage = typeof error?.message === "string" ? error.message : "";
  const message =
    [errorName, errorMessage].filter(Boolean).join(": ") ||
    event.message ||
    String(event.error ?? "Unknown worker error");
  const location = event.filename ? ` at ${event.filename}:${event.lineno}:${event.colno}` : "";
  const stack = typeof error?.stack === "string" ? `\n${error.stack}` : "";

  return `Worker ${workerIndex} error: ${message}${location}${stack}`;
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
  private _computedPermutations: BehaviorSubject<number> = new BehaviorSubject<number>(0);
  public readonly computedPermutations: Observable<number> =
    this._computedPermutations.asObservable();
  private _calculationElapsedTime: BehaviorSubject<number> = new BehaviorSubject<number>(0);
  public readonly calculationElapsedTime: Observable<number> =
    this._calculationElapsedTime.asObservable();

  private calculationSubscription?: Subscription;

  // Static properties for calculation state
  private static workers: Worker[] = [];
  // Builders that finished their run; reused so later runs skip worker startup and JIT warm-up.
  private static idleWorkers: Worker[] = [];
  private static idleWorkerTimeoutId: any = null;
  private static readonly IDLE_WORKER_LIFETIME_MS = 60000;
  private static theoreticalWorker?: Worker;
  private static freshEntries: ResultEntry[] = [];
  // Worker batches wait here and are merged once per publish, not once per message.
  private static pendingResultSets: IPermutatorArmorSet[] = [];
  // Duration of the last intermediate publish; the next one waits proportionally longer.
  private static lastPublishCost = 0;
  // Results of the previous run that still match the current settings; shown until the new run
  // finishes and replaced entry by entry as the same armor sets are recomputed.
  private static retainedEntries: ResultEntry[] = [];
  private static freshKeys = new Set<string>();
  // Settings the entries above are valid for.
  private static entriesConfig: BuildConfiguration | null = null;
  private static runCounter = 0;
  private static readonly INTERMEDIATE_PUBLISH_INTERVAL_MS = 200;
  private static lastIntermediatePublish = 0;
  private static intermediatePublishTimer: any = null;
  private static inventoryById = new Map<number, IInventoryArmor>();
  private static savedResultsCount = 0;
  private static totalPermutationsCount = 0;
  private static resultMaximumTiers: number[][] = [];
  private static selectedExotics: IManifestArmor[] = [];
  private static sharedArmorExcludedSlots = new Set<ArmorSlot>();
  private static endResults: ResultDefinition[] = [];
  private static prePruneArmorItems: PrunedArmorItemView[] = [];

  // Static thread tracking arrays
  private static threadCalculationAmountArr: number[] = [];
  private static threadCalculationDoneArr: number[] = [];
  private static threadComputedPermutationsArr: number[] = [];
  private static threadCalculationReachableTiers: number[][] = [];
  private static threadResultLimitReachedArr: boolean[] = [];
  private static globalMaximumPossibleTiers: number[] = [0, 0, 0, 0, 0, 0];
  private static updateResultsStart: number = 0;

  // Static progress and worker state
  private static doneWorkerCount = 0;
  private static lastProgressUpdateTime = 0;
  private static emittedPossibleCombinations = false;
  private static allThreadsResultLimitReached = false;
  private static stoppedEarlyAtMaxTier = false;

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
      savedResults: 0,
      totalPermutations: 0,
      resultLimitReached: false,
      stoppedEarlyAtMaxTier: false,
      maximumPossibleTiers: [0, 0, 0, 0, 0, 0],
      itemCount: 0,
      totalTime: null,
      prePruneArmorItems: [],
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
    this.killWorkers(true);
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

  private keepMatchingResults(
    config: BuildConfiguration,
    pool: IPermutatorArmor[],
    inventoryById: Map<number, IInventoryArmor>
  ) {
    const previousConfig = ArmorCalculatorService.entriesConfig;
    const kept = previousConfig
      ? retainMatchingResults(
          ArmorCalculatorService.currentEntries(),
          previousConfig,
          config,
          new Map(pool.map((item) => [item.id, item]))
        )
      : [];

    ArmorCalculatorService.retainedEntries = kept
      .map((entry) =>
        buildResultEntry(entry.set, inventoryById, ArmorCalculatorService.sharedArmorExcludedSlots)
      )
      .sort(compareResultEntries);
    ArmorCalculatorService.freshEntries = [];
    ArmorCalculatorService.pendingResultSets = [];
    ArmorCalculatorService.freshKeys.clear();
    ArmorCalculatorService.allThreadsResultLimitReached = false;
    ArmorCalculatorService.stoppedEarlyAtMaxTier = false;
    // Snapshot: the live configuration object may be mutated in place.
    ArmorCalculatorService.entriesConfig = JSON.parse(JSON.stringify(config));
  }

  private clearResults(force: boolean = false) {
    ArmorCalculatorService.prePruneArmorItems = [];
    ArmorCalculatorService.freshEntries = [];
    ArmorCalculatorService.pendingResultSets = [];
    ArmorCalculatorService.retainedEntries = [];
    ArmorCalculatorService.freshKeys.clear();
    ArmorCalculatorService.entriesConfig = null;
    if (force || ArmorCalculatorService.endResults.length > 0) {
      ArmorCalculatorService.endResults = [];
      this._armorResults.next({
        results: ArmorCalculatorService.endResults,
        savedResults: 0,
        totalPermutations: 0,
        resultLimitReached: false,
        stoppedEarlyAtMaxTier: false,
        totalTime: 0,
        itemCount: 0,
        maximumPossibleTiers: [0, 0, 0, 0, 0, 0],
        prePruneArmorItems: ArmorCalculatorService.prePruneArmorItems,
      });
    }
  }

  private killWorkers(includeIdle = false) {
    ArmorCalculatorService.theoreticalWorker?.terminate();
    ArmorCalculatorService.theoreticalWorker = undefined;
    if (ArmorCalculatorService.workers.length > 0) {
      this.logger.debug("ArmorCalculatorService", "killWorkers", "Terminating all workers");
      ArmorCalculatorService.workers.forEach((w) => {
        if (!ArmorCalculatorService.idleWorkers.includes(w)) w.terminate();
      });
      ArmorCalculatorService.workers = [];
    }
    if (includeIdle) ArmorCalculatorService.terminateIdleWorkers();
  }

  private static terminateIdleWorkers() {
    clearTimeout(ArmorCalculatorService.idleWorkerTimeoutId);
    ArmorCalculatorService.idleWorkerTimeoutId = null;
    ArmorCalculatorService.idleWorkers.forEach((w) => w.terminate());
    ArmorCalculatorService.idleWorkers = [];
  }

  private static releaseWorker(worker: Worker | undefined) {
    if (!worker || ArmorCalculatorService.idleWorkers.includes(worker)) return;
    ArmorCalculatorService.idleWorkers.push(worker);
    clearTimeout(ArmorCalculatorService.idleWorkerTimeoutId);
    ArmorCalculatorService.idleWorkerTimeoutId = setTimeout(
      () => ArmorCalculatorService.terminateIdleWorkers(),
      ArmorCalculatorService.IDLE_WORKER_LIFETIME_MS
    );
  }

  private static acquireWorker(name: string): Worker {
    return (
      ArmorCalculatorService.idleWorkers.pop() ??
      new Worker(new URL("./results-builder.worker", import.meta.url), {
        name,
        type: "module",
      })
    );
  }

  private static isActiveWorker(worker: Worker | undefined): worker is Worker {
    return !!worker && !ArmorCalculatorService.idleWorkers.includes(worker);
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
      if (!ArmorCalculatorService.isActiveWorker(w)) return;
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

  // Armor that can add artifice mods may legitimately exceed the theoretical T5 maximum.
  private static theoreticalSlack(config: BuildConfiguration, items: IPermutatorArmor[]): number {
    const artificeSlots = new Set<ArmorSlot>();
    for (const item of items) {
      if (item.perk === ArmorPerkOrSlot.SlotArtifice) artificeSlots.add(item.slot);
    }
    return 3 * artificeSlots.size + (config.addConstent1Health ? 1 : 0);
  }

  // The theoretical T5 model is an upper bound for a pool of T5 pieces, which cannot be artifice.
  // It ignores the constant +1 health, and locked stats have a different meaning in its model.
  private static theoreticalInfeasibilityIsFinal(
    config: BuildConfiguration,
    items: IPermutatorArmor[]
  ): boolean {
    return (
      items.length > 0 &&
      !config.addConstent1Health &&
      !Object.values(config.minimumStatTiers).some((selection) => selection.fixed) &&
      items.every(
        (item) =>
          item.armorSystem === ArmorSystem.Armor3 &&
          item.tier >= 5 &&
          item.perk !== ArmorPerkOrSlot.SlotArtifice
      )
    );
  }

  private finishWithoutResults(itemCount: number) {
    this.logger.info(
      "ArmorCalculatorService",
      "finishWithoutResults",
      "Targets are unreachable even with ideal T5 armor, stopping"
    );
    this.killWorkers();
    clearTimeout(ArmorCalculatorService.intermediatePublishTimer);
    ArmorCalculatorService.intermediatePublishTimer = null;
    ArmorCalculatorService.retainedEntries = [];
    ArmorCalculatorService.freshEntries = [];
    ArmorCalculatorService.pendingResultSets = [];
    ArmorCalculatorService.freshKeys.clear();
    this.status.modifyStatus((s) => (s.calculatingResults = false));
    this._calculationProgress.next(0);
    ArmorCalculatorService.publishResults(this._armorResults, itemCount, {
      savedResults: 0,
      totalTime: performance.now() - ArmorCalculatorService.updateResultsStart,
      maximumPossibleTiers: [0, 0, 0, 0, 0, 0],
    });
  }

  private static startTheoreticalMaximum(
    config: BuildConfiguration,
    items: IPermutatorArmor[],
    builders: Worker[],
    limitBuilders: boolean,
    onInfeasible?: () => void
  ): void {
    ArmorCalculatorService.theoreticalWorker?.terminate();
    const limitsWorker = new Worker(new URL("./theorizer-stat-limits.worker", import.meta.url), {
      type: "module",
    });
    ArmorCalculatorService.theoreticalWorker = limitsWorker;
    const slack = ArmorCalculatorService.theoreticalSlack(config, items);
    const finish = () => {
      limitsWorker.terminate();
      if (ArmorCalculatorService.theoreticalWorker === limitsWorker)
        ArmorCalculatorService.theoreticalWorker = undefined;
    };
    limitsWorker.onmessage = ({ data }: MessageEvent<T5LimitsReply>) => {
      // A newer run terminates this worker; its late reply must not reach reused builders.
      if (ArmorCalculatorService.theoreticalWorker !== limitsWorker) return;
      if (data.status === "infeasible" && onInfeasible) {
        finish();
        onInfeasible();
        return;
      }
      if (limitBuilders && data.status === "feasible" && data.maximumComplete && !data.preview) {
        const tiers = data.maximum.map((value) => Math.min(200, value + slack));
        for (const builder of builders) {
          // Only the builders of this run; a newer run replaces the array.
          if (
            ArmorCalculatorService.workers.includes(builder) &&
            ArmorCalculatorService.isActiveWorker(builder)
          )
            builder.postMessage({ type: "theoreticalMaximum", tiers });
        }
      }
      finish();
    };
    limitsWorker.onerror = finish;
    limitsWorker.postMessage({
      id: 1,
      // The builders ignore the mod-slot limits while this feature flag is off.
      config: environment.featureFlags.enableModslotLimitation
        ? config
        : { ...config, statModLimits: { maxMods: 5, maxMajorMods: 5 } },
      validateOnly: false,
      exactOnly: true,
      tuning: config.calculateTierFiveTuning,
      wasmUrl: new URL("assets/highs.wasm", document.baseURI).href,
    } satisfies T5LimitsRequest);
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
      // A selected worker count replaces the estimate of physical cores minus one.
      Math.floor(config.maxWorkers) > 0
        ? Math.min(64, Math.floor(config.maxWorkers))
        : calculateCPUConcurrency(),
      largestArmorBucket // limit it to the largest armor bucket, as we will split the work by this value
    );

    return nthreads;
  }

  private static splitArmorItemsForWorkers(
    items: IPermutatorArmor[],
    workerCount: number
  ): IPermutatorArmor[][] {
    if (workerCount <= 1) return [items];

    const slotBuckets = [
      items.filter((item) => item.slot === ArmorSlot.ArmorSlotHelmet),
      items.filter((item) => item.slot === ArmorSlot.ArmorSlotGauntlet),
      items.filter((item) => item.slot === ArmorSlot.ArmorSlotChest),
      items.filter((item) => item.slot === ArmorSlot.ArmorSlotLegs),
      items.filter((item) => item.slot === ArmorSlot.ArmorSlotClass),
    ];
    let splitSlotIndex = 0;
    for (let slotIndex = 1; slotIndex < slotBuckets.length; slotIndex++) {
      if (slotBuckets[slotIndex].length > slotBuckets[splitSlotIndex].length) {
        splitSlotIndex = slotIndex;
      }
    }

    // Walk the already sorted bucket once so every worker keeps high-first item order. Separate
    // rarity cursors keep both groups balanced without assigning both strongest pieces to worker 0.
    const splitBucket = slotBuckets[splitSlotIndex];
    const splitBatches: IPermutatorArmor[][] = Array.from({ length: workerCount }, () => []);
    let nextExoticWorker = 0;
    let nextLegendaryWorker = 1 % workerCount;
    splitBucket.forEach((item) => {
      const workerIndex = item.isExotic ? nextExoticWorker : nextLegendaryWorker;
      splitBatches[workerIndex].push(item);
      if (item.isExotic) nextExoticWorker = (nextExoticWorker + 1) % workerCount;
      else nextLegendaryWorker = (nextLegendaryWorker + 1) % workerCount;
    });

    // Every worker receives all unsplit slots and one disjoint partition of the largest slot.
    return splitBatches.map((batch) =>
      slotBuckets.flatMap((slot, slotIndex) => (slotIndex === splitSlotIndex ? batch : slot))
    );
  }

  static markPrunedArmorItems(
    inventoryArmorItems: IInventoryArmor[],
    remainingArmorItems: IPermutatorArmor[],
    prunedByMap?: Map<number, IInventoryArmor>
  ): PrunedArmorItemView[] {
    const remainingArmorIds = new Set(remainingArmorItems.map((item) => item.id));
    return inventoryArmorItems.map((item) => ({
      item,
      pruned: !remainingArmorIds.has(item.id),
      prunedBy: prunedByMap?.get(item.id) ?? null,
    }));
  }

  private static pruneDominatedArmorItems(
    items: IPermutatorArmor[],
    config: BuildConfiguration,
    inventoryById: Map<number, IInventoryArmor> = new Map(),
    prunedByMap: Map<number, IInventoryArmor> = new Map()
  ): IPermutatorArmor[] {
    // Prune the complete slot pools before partitioning. Every worker therefore uses the same
    // Pareto-reduced inventory, and dominated pieces cannot inflate the largest split bucket.
    return [
      ArmorSlot.ArmorSlotHelmet,
      ArmorSlot.ArmorSlotGauntlet,
      ArmorSlot.ArmorSlotChest,
      ArmorSlot.ArmorSlotLegs,
      ArmorSlot.ArmorSlotClass,
    ].flatMap((slot) =>
      ArmorCalculatorService.pruneDominatedPerSlot(
        items.filter((item) => item.slot === slot),
        config,
        inventoryById,
        prunedByMap
      )
    );
  }

  private static pieceStatsWithMasterwork(
    piece: IPermutatorArmor,
    config: BuildConfiguration
  ): number[] {
    const stats = [
      piece.resilience,
      piece.strength,
      piece.discipline,
      piece.intellect,
      piece.recovery,
      piece.mobility,
    ];
    if (piece.armorSystem === ArmorSystem.Armor2) {
      if (
        piece.masterworkLevel === MAXIMUM_MASTERWORK_LEVEL ||
        (piece.isExotic ? config.assumeExoticsMasterworked : config.assumeLegendariesMasterworked)
      ) {
        for (let stat = 0; stat < 6; stat++) stats[stat] += 2;
      }
    } else if (piece.armorSystem === ArmorSystem.Armor3) {
      let multiplier = piece.masterworkLevel;
      if (
        piece.isExotic ? config.assumeExoticsMasterworked : config.assumeLegendariesMasterworked
      ) {
        multiplier = MAXIMUM_MASTERWORK_LEVEL;
      }
      for (let stat = 0; stat < 6; stat++) {
        if (!piece.archetypeStats.includes(stat)) stats[stat] += multiplier;
      }
    }
    return stats;
  }

  private static pieceArtificeCapable(piece: IPermutatorArmor): boolean {
    return piece.perk === ArmorPerkOrSlot.SlotArtifice;
  }

  private static pieceTuningOptions(piece: IPermutatorArmor): number[][] {
    const options = [[0, 0, 0, 0, 0, 0]];
    if (piece.isExotic && piece.armorSystem === ArmorSystem.Armor3) {
      for (let positive = 0; positive < 6; positive++) {
        for (let negative = 0; negative < 6; negative++) {
          if (positive === negative) continue;
          const option = [0, 0, 0, 0, 0, 0];
          option[positive] = 5;
          option[negative] = -5;
          options.push(option);
        }
      }
    } else if (piece.tuningStat !== null) {
      for (let negative = 0; negative < 6; negative++) {
        if (negative === piece.tuningStat) continue;
        const option = [0, 0, 0, 0, 0, 0];
        option[piece.tuningStat] = 5;
        option[negative] = -5;
        options.push(option);
      }
    }

    const stats = [
      piece.resilience,
      piece.strength,
      piece.discipline,
      piece.intellect,
      piece.recovery,
      piece.mobility,
    ];
    const lowest = stats
      .map((value, index) => ({ value, index }))
      .sort((a, b) => a.value - b.value || a.index - b.index)
      .slice(0, 3);
    const balanced = [0, 0, 0, 0, 0, 0];
    for (const stat of lowest) balanced[stat.index] = 1;
    options.push(balanced);
    return options;
  }

  private static pieceMixSet(piece: IPermutatorArmor, config: BuildConfiguration): number[][] {
    const base = ArmorCalculatorService.pieceStatsWithMasterwork(piece, config);
    const canTune =
      config.calculateTierFiveTuning &&
      piece.armorSystem === ArmorSystem.Armor3 &&
      (!!piece.isExotic ||
        (piece.tier >= 5 && piece.tuningStat !== undefined && piece.tuningStat !== null));
    const options = canTune
      ? ArmorCalculatorService.pieceTuningOptions(piece)
      : [[0, 0, 0, 0, 0, 0]];
    return options.map((option) => base.map((value, stat) => value + option[stat]));
  }

  private static pieceProfileKey(piece: IPermutatorArmor, config: BuildConfiguration): string {
    // Compare pieces only when all non-stat capabilities match. In particular, selectable gear-set
    // pieces cannot dominate fixed-set pieces even when their raw stats are higher.
    const identity = piece.isExotic ? `E|${piece.hash}` : "L";
    return [
      identity,
      piece.perk,
      piece.gearSetHash ?? "none",
      piece.gearSetPerkSelectable ? "selectable" : "fixed",
      piece.armorSystem,
      piece.tier >= 5 ? "T5" : "low",
      ArmorCalculatorService.pieceArtificeCapable(piece) ? "artifice" : "standard",
    ].join("|");
  }

  private static mixSetCovers(dominator: number[][], candidate: number[][]): boolean {
    // Every tuning mix of the candidate must be matched or beaten componentwise by the dominator.
    return candidate.every((candidateMix) =>
      dominator.some((dominatorMix) =>
        dominatorMix.every((value, stat) => value >= candidateMix[stat])
      )
    );
  }

  private static pruneDominatedPerSlot(
    pieces: IPermutatorArmor[],
    config: BuildConfiguration,
    inventoryById: Map<number, IInventoryArmor> = new Map(),
    prunedByMap: Map<number, IInventoryArmor> = new Map()
  ): IPermutatorArmor[] {
    // Raw-stat dominance is valid only when higher is strictly better. Exact locks and waste
    // constraints introduce upper bounds, so pruning is disabled for those configurations.
    const moreIsBetter =
      !Object.values(config.minimumStatTiers).some((selection) => selection.fixed) &&
      !config.tryLimitWastedStats &&
      !config.onlyShowResultsWithNoWastedStats;
    if (!moreIsBetter || pieces.length < 2) return pieces;

    const groups = new Map<string, number[]>();
    for (let index = 0; index < pieces.length; index++) {
      const key = ArmorCalculatorService.pieceProfileKey(pieces[index], config);
      const group = groups.get(key);
      if (group) group.push(index);
      else groups.set(key, [index]);
    }

    const pruned = new Array<boolean>(pieces.length).fill(false);
    const mixCache = new Array<number[][] | undefined>(pieces.length);
    const mixes = (index: number) =>
      mixCache[index] ??
      (mixCache[index] = ArmorCalculatorService.pieceMixSet(pieces[index], config));

    for (const group of groups.values()) {
      for (const candidate of group) {
        for (const dominator of group) {
          if (candidate === dominator || pruned[dominator]) continue;
          if (!ArmorCalculatorService.mixSetCovers(mixes(dominator), mixes(candidate))) continue;
          const dominatorPower = inventoryById.get(pieces[dominator].id)?.powerLevel ?? 0;
          const candidatePower = inventoryById.get(pieces[candidate].id)?.powerLevel ?? 0;
          if (
            !ArmorCalculatorService.mixSetCovers(mixes(candidate), mixes(dominator)) ||
            dominatorPower > candidatePower ||
            (dominatorPower === candidatePower && dominator < candidate)
          ) {
            pruned[candidate] = true;
            const prunedByItem = inventoryById.get(pieces[dominator].id);
            if (prunedByItem) {
              prunedByMap.set(pieces[candidate].id, prunedByItem);
            }
            break;
          }
        }
      }
    }

    return pieces.filter((_, index) => !pruned[index]);
  }

  private processWorkerMessage(
    data: WorkerMessageData,
    workerIndex: number,
    totalThreads: number,
    inventoryArmorItems: IInventoryArmor[]
  ): void {
    if (data.error) {
      const detail = `${data.error.name}: ${data.error.message}${data.error.stack ? `\n${data.error.stack}` : ""}`;
      this.logger.error(
        "ArmorCalculatorService",
        "updateResults",
        `Worker ${workerIndex} error: ${detail}`
      );
      this.killWorkers();
      this.status.modifyStatus((status) => (status.calculatingResults = false));
      this._calculationProgress.next(0);
      return;
    }

    // Update calculation progress tracking (available in all message types)
    ArmorCalculatorService.threadCalculationDoneArr[workerIndex] = data.checkedCalculations;
    ArmorCalculatorService.threadCalculationAmountArr[workerIndex] = data.estimatedCalculations;
    ArmorCalculatorService.threadComputedPermutationsArr[workerIndex] = data.computedPermutations;
    ArmorCalculatorService.totalPermutationsCount =
      ArmorCalculatorService.threadComputedPermutationsArr.reduce((sum, count) => sum + count, 0);
    this._computedPermutations.next(ArmorCalculatorService.totalPermutationsCount);
    this._calculationElapsedTime.next(
      performance.now() - ArmorCalculatorService.updateResultsStart
    );
    ArmorCalculatorService.threadCalculationReachableTiers[workerIndex] = data.reachableTiers ||
      data.runtime?.maximumPossibleTiers || [0, 0, 0, 0, 0, 0];

    if (data.resultLimitReached) {
      ArmorCalculatorService.threadResultLimitReachedArr[workerIndex] = true;
    }
    if (data.stoppedEarlyAtMaxTier) {
      ArmorCalculatorService.stoppedEarlyAtMaxTier = true;
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
        if (
          i !== workerIndex &&
          ArmorCalculatorService.isActiveWorker(ArmorCalculatorService.workers[i])
        ) {
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

    // When every worker has hit its local result limit,
    if (
      !ArmorCalculatorService.allThreadsResultLimitReached &&
      ArmorCalculatorService.threadResultLimitReachedArr.every((val) => val)
    ) {
      console.log("All threads have reached their local result limit");
      console.log(
        ArmorCalculatorService.freshEntries.length +
          " results found, " +
          sumDone +
          " calculations done out of estimated " +
          sumTotal
      );
      ArmorCalculatorService.allThreadsResultLimitReached = true;
    }

    // Add partial results to the collection
    const partialResults = data.packed ? unpackArmorSets(data.packed) : [];
    for (const armorSet of partialResults) ArmorCalculatorService.pendingResultSets.push(armorSet);
    if (partialResults.length > 0 && !data.done) {
      this.processIntermediateResults(inventoryArmorItems);
    }

    // Handle completion of individual worker threads
    if (data.done == true) {
      ArmorCalculatorService.doneWorkerCount++;
      ArmorCalculatorService.savedResultsCount += data.stats!.savedResults; // stats only available when done=true
      ArmorCalculatorService.resultMaximumTiers.push(data.runtime.maximumPossibleTiers);
    }

    if (data.done == true && ArmorCalculatorService.doneWorkerCount == totalThreads) {
      this.processCompleteResults(inventoryArmorItems);
    }
    if (data.done == true) {
      ArmorCalculatorService.releaseWorker(ArmorCalculatorService.workers[workerIndex]);
    }
  }

  private processCompleteResults(inventoryArmorItems: IInventoryArmor[]): void {
    this.status.modifyStatus((s) => (s.calculatingResults = false));
    this._calculationProgress.next(0);

    // The finished run replaces everything kept from the previous one.
    clearTimeout(ArmorCalculatorService.intermediatePublishTimer);
    ArmorCalculatorService.intermediatePublishTimer = null;
    ArmorCalculatorService.retainedEntries = [];
    ArmorCalculatorService.freshKeys.clear();

    ArmorCalculatorService.publishResults(this._armorResults, inventoryArmorItems.length, {
      savedResults: ArmorCalculatorService.savedResultsCount, // Total amount of results, differs from the real amount if the memory save setting is active
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
    // Workers deliver small batches early, so publish at most once per interval (first one at once).
    const itemCount = inventoryArmorItems.length;
    const wait =
      Math.max(
        ArmorCalculatorService.INTERMEDIATE_PUBLISH_INTERVAL_MS,
        ArmorCalculatorService.lastPublishCost * 4
      ) -
      (performance.now() - ArmorCalculatorService.lastIntermediatePublish);
    if (wait > 0) {
      if (ArmorCalculatorService.intermediatePublishTimer == null) {
        ArmorCalculatorService.intermediatePublishTimer = setTimeout(
          () => this.publishIntermediateResults(itemCount),
          wait
        );
      }
      return;
    }
    this.publishIntermediateResults(itemCount);
  }

  private publishIntermediateResults(itemCount: number): void {
    clearTimeout(ArmorCalculatorService.intermediatePublishTimer);
    ArmorCalculatorService.intermediatePublishTimer = null;
    const publishStart = performance.now();
    // Do not toggle calculatingResults or reset progress; workers are still running.
    ArmorCalculatorService.publishResults(this._armorResults, itemCount, {
      totalTime: null,
      maximumPossibleTiers: ArmorCalculatorService.globalMaximumPossibleTiers.map(
        (k) => Math.min(200, k) / 10
      ),
    });
    ArmorCalculatorService.lastIntermediatePublish = performance.now();
    ArmorCalculatorService.lastPublishCost =
      ArmorCalculatorService.lastIntermediatePublish - publishStart;
  }

  private static currentEntries(): ResultEntry[] {
    const retained =
      ArmorCalculatorService.freshKeys.size === 0
        ? ArmorCalculatorService.retainedEntries
        : ArmorCalculatorService.retainedEntries.filter(
            (entry) => !ArmorCalculatorService.freshKeys.has(entry.key)
          );
    return mergeResultEntries(retained, ArmorCalculatorService.freshEntries);
  }

  private static ingestResults(armorSets: IPermutatorArmorSet[]): void {
    if (armorSets.length === 0) return;
    const batch = armorSets.map((armorSet) =>
      buildResultEntry(
        armorSet,
        ArmorCalculatorService.inventoryById,
        ArmorCalculatorService.sharedArmorExcludedSlots
      )
    );
    batch.sort(compareResultEntries);
    for (const entry of batch) ArmorCalculatorService.freshKeys.add(entry.key);
    ArmorCalculatorService.freshEntries = mergeResultEntries(
      ArmorCalculatorService.freshEntries,
      batch
    );
  }

  private static publishResults(
    subject: BehaviorSubject<info>,
    itemCount: number,
    summary: Pick<info, "totalTime" | "maximumPossibleTiers"> & { savedResults?: number }
  ): void {
    ArmorCalculatorService.ingestResults(ArmorCalculatorService.pendingResultSets);
    ArmorCalculatorService.pendingResultSets = [];
    const entries = ArmorCalculatorService.currentEntries();
    ArmorCalculatorService.endResults = entries.map((entry) => entry.definition);
    updateSharedBuildCounts(ArmorCalculatorService.endResults);
    subject.next({
      results: ArmorCalculatorService.endResults,
      totalPermutations: ArmorCalculatorService.totalPermutationsCount,
      resultLimitReached: ArmorCalculatorService.allThreadsResultLimitReached,
      stoppedEarlyAtMaxTier: ArmorCalculatorService.stoppedEarlyAtMaxTier,
      itemCount,
      prePruneArmorItems: ArmorCalculatorService.prePruneArmorItems,
      ...summary,
      savedResults: summary.savedResults ?? entries.length,
    });
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

  private async filterAndPrepareInventoryItems(
    config: BuildConfiguration
  ): Promise<PreparedInventoryArmorItems> {
    let inventoryArmorItems: IInventoryArmor[] = (await this.db.inventoryArmor
      .where("clazz")
      .equals(config.characterClass)
      .distinct()
      .toArray()) as IInventoryArmor[];
    // Stored items may claim T5 without the 30/25/20 shape; they get no T5 tuning.
    inventoryArmorItems = inventoryArmorItems.map((item) =>
      item.armorSystem === ArmorSystem.Armor3 && item.tier >= 5 && !hasLegalT5Shape(item)
        ? { ...item, tier: 1, tuningStat: null }
        : item
    );
    const selectedExoticSlots = new Set(
      ArmorCalculatorService.selectedExotics.map((exotic) => exotic.slot)
    );
    const selectedExoticsSpanSlots = selectedExoticSlots.size > 1;
    const selectedGearSetHashes = new Set(
      config.armorRequirements
        .filter(
          (requirement): requirement is { gearSetHash: number } => "gearSetHash" in requirement
        )
        .map((requirement) => requirement.gearSetHash)
    );

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
          !item.isExotic ||
          ArmorCalculatorService.selectedExotics.length === 0 ||
          ArmorCalculatorService.selectedExotics.some(
            (exotic: IManifestArmor) => exotic.hash === item.hash
          )
      )
      .filter(
        (item) =>
          item.isExotic ||
          ArmorCalculatorService.selectedExotics.length === 0 ||
          selectedExoticsSpanSlots ||
          !selectedExoticSlots.has(item.slot)
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
    // this.logger.debug("ArmorCalculatorService", "updateResults", items.map(d => "id:'"+d.itemInstanceId+"'" ).join(" or "))
    // Remove collection items if they are in inventory
    inventoryArmorItems = inventoryArmorItems.filter((item) => {
      if (
        item.source === InventoryArmorSource.Inventory ||
        item.source === InventoryArmorSource.Postmaster
      ) {
        return true;
      }

      const purchasedItemInstance = inventoryArmorItems.find(
        (rhs) =>
          (rhs.source === InventoryArmorSource.Inventory ||
            rhs.source === InventoryArmorSource.Postmaster) &&
          isEqualItem(item, rhs)
      );

      // If this item is a collection/vendor item, ignore it if the player
      // already has a real copy of the same item.
      return purchasedItemInstance === undefined;
    });

    // Sort items by total stats, then exotics first, then if it has a tuning stat, then masterwork level (all descending)
    inventoryArmorItems = inventoryArmorItems.sort((a, b) => {
      const totalDiff = totalStats(b) - totalStats(a);
      if (totalDiff !== 0) return totalDiff;

      const exoticDiff = (b.isExotic ? 1 : 0) - (a.isExotic ? 1 : 0);
      if (exoticDiff !== 0) return exoticDiff;

      const tuningStatDiff = (b.tuningStat == null ? -1 : 1) - (a.tuningStat == null ? -1 : 1);
      if (tuningStatDiff !== 0) return tuningStatDiff;

      return (b.masterworkLevel ?? 0) - (a.masterworkLevel ?? 0);
    });

    // Slot-specific post-processing
    // Helmets: apply FotL helmet restriction when enabled, using a slot-based regrouping
    const helmets = inventoryArmorItems.filter((i) => i.slot === ArmorSlot.ArmorSlotHelmet);
    const gauntlets = inventoryArmorItems.filter((i) => i.slot === ArmorSlot.ArmorSlotGauntlet);
    const chests = inventoryArmorItems.filter((i) => i.slot === ArmorSlot.ArmorSlotChest);
    const legs = inventoryArmorItems.filter((i) => i.slot === ArmorSlot.ArmorSlotLegs);
    const classItems = inventoryArmorItems.filter((i) => i.slot === ArmorSlot.ArmorSlotClass);

    let filteredHelmets = helmets;
    if (config.useEventArmor === EventArmorType.FestivalOfTheLost) {
      const fotlHelmetHashes = [
        199733460, // titan masq
        3224066584, // hunter
        2545426109, // warlock
        2390807586, // titan new fotl
        2462335932, // hunter new fotl
        4095816113, // warlock new fotl
      ];
      filteredHelmets = helmets.filter((k) => fotlHelmetHashes.indexOf(k.hash) > -1);
    }

    // Apply exotic class item perk filtering and class item grouping logic
    let filteredClassItems = classItems;

    if (config.useEventArmor === EventArmorType.GuardianGames) {
      const ggClassItemHashes = [
        3299562545, // titan gg class item
        3111568261, // hunter gg class item
        1326541974, // warlock gg class item
      ];
      filteredClassItems = classItems.filter((k) => ggClassItemHashes.indexOf(k.hash) > -1);
    }

    if (filteredClassItems.length > 0) {
      // Filter exotic class items based on selected exotic perks if they are not "Any"
      if (config.selectedExoticPerks && config.selectedExoticPerks.length >= 2) {
        const firstPerkFilter = config.selectedExoticPerks[0];
        const secondPerkFilter = config.selectedExoticPerks[1];

        if (firstPerkFilter !== ArmorPerkOrSlot.Any || secondPerkFilter !== ArmorPerkOrSlot.Any) {
          filteredClassItems = filteredClassItems.filter((item) => {
            if (!item.isExotic || !item.exoticPerkHash || item.exoticPerkHash.length < 2) {
              // Keep non-exotic items or items without proper perk data
              return true;
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

      inventoryArmorItems = [
        ...filteredHelmets,
        ...gauntlets,
        ...chests,
        ...legs,
        ...filteredClassItems,
      ];
    }

    const gearSetRequirementCounts = new Map<number, number>();
    for (const requirement of config.armorRequirements) {
      if ("gearSetHash" in requirement) {
        gearSetRequirementCounts.set(
          requirement.gearSetHash,
          (gearSetRequirementCounts.get(requirement.gearSetHash) ?? 0) + 1
        );
      }
    }
    const gearSetRequirements = [...gearSetRequirementCounts.entries()];
    const selectedFourPieceGearSet = gearSetRequirements.find(([, count]) => count >= 4)?.[0];
    const selectedTwoPieceGearSets =
      gearSetRequirements.length === 2 && gearSetRequirements.every(([, count]) => count === 2)
        ? new Set(gearSetRequirements.map(([hash]) => hash))
        : undefined;
    const gearSetsForExoticBuild =
      selectedFourPieceGearSet !== undefined
        ? new Set([selectedFourPieceGearSet])
        : selectedTwoPieceGearSets;
    const exoticIsSelected =
      config.selectedExotics.length > 0 && !config.selectedExotics.includes(FORCE_USE_NO_EXOTIC);
    if (gearSetsForExoticBuild && exoticIsSelected) {
      inventoryArmorItems = inventoryArmorItems.filter(
        (item) =>
          item.isExotic ||
          item.gearSetPerkSelectable ||
          (item.gearSetHash != null && gearSetsForExoticBuild.has(item.gearSetHash))
      );
    }

    const distinctItems: IInventoryArmor[] = [];
    const duplicates: IInventoryArmor[] = [];
    const duplicatePruners = new Map<number, IInventoryArmor>();
    const selectedPerks = new Set(
      config.armorRequirements
        .filter((requirement): requirement is { perk: ArmorPerkOrSlot } => "perk" in requirement)
        .map((requirement) => requirement.perk)
    );
    const capabilityCache = new Map<IInventoryArmor, Set<string>>();
    const getSelectedCapabilities = (item: IInventoryArmor) => {
      let capabilities = capabilityCache.get(item);
      if (capabilities) return capabilities;
      capabilities = new Set<string>();
      if (item.gearSetHash != null && selectedGearSetHashes.has(item.gearSetHash)) {
        capabilities.add(`gearset:${item.gearSetHash}`);
      }
      if (selectedPerks.has(item.perk)) capabilities.add(`perk:${item.perk}`);
      capabilityCache.set(item, capabilities);
      return capabilities;
    };
    const coversCapabilities = (candidate: IInventoryArmor, item: IInventoryArmor) => {
      const candidateCapabilities = getSelectedCapabilities(candidate);
      for (const capability of getSelectedCapabilities(item)) {
        if (!candidateCapabilities.has(capability)) return false;
      }
      return true;
    };
    const isArtificeCapable = (item: IInventoryArmor) => item.perk === ArmorPerkOrSlot.SlotArtifice;
    // Only items with an identical stat profile can be duplicates, so compare within buckets.
    const profileBuckets = new Map<string, number[]>();
    const profileKey = (item: IInventoryArmor) =>
      [
        item.slot,
        item.isExotic,
        item.mobility,
        item.resilience,
        item.recovery,
        item.discipline,
        item.intellect,
        item.strength,
        item.armorSystem,
        item.tier,
        item.tuningStat,
        JSON.stringify(item.archetypeStats),
        item.source,
        item.gearSetPerkSelectable,
        (item.isExotic ? config.assumeExoticsMasterworked : config.assumeLegendariesMasterworked)
          ? "*"
          : item.masterworkLevel,
      ]
        .map(String)
        .join("|");
    for (const item of inventoryArmorItems) {
      const key = profileKey(item);
      let bucket = profileBuckets.get(key);
      const bucketPosition =
        bucket?.findIndex((index) => {
          const candidate = distinctItems[index];
          if (candidate.isExotic || item.isExotic) {
            return (
              candidate.hash === item.hash &&
              JSON.stringify(candidate.exoticPerkHash ?? []) ===
                JSON.stringify(item.exoticPerkHash ?? []) &&
              candidate.perk === item.perk &&
              candidate.gearSetHash === item.gearSetHash
            );
          }

          if (!config.foldSameStatDifferentGearSets) {
            return (
              candidate.hash === item.hash &&
              candidate.perk === item.perk &&
              candidate.gearSetHash === item.gearSetHash
            );
          }

          return coversCapabilities(candidate, item) || coversCapabilities(item, candidate);
        }) ?? -1;
      if (bucket && bucketPosition >= 0) {
        const duplicateIndex = bucket[bucketPosition];
        const duplicate = distinctItems[duplicateIndex];
        const itemCoversDuplicate = coversCapabilities(item, duplicate);
        const duplicateCoversItem = coversCapabilities(duplicate, item);
        const itemHasArtifice = isArtificeCapable(item);
        const duplicateHasArtifice = isArtificeCapable(duplicate);
        const itemShouldRepresent =
          (itemCoversDuplicate && !duplicateCoversItem) ||
          (itemCoversDuplicate === duplicateCoversItem &&
            ((itemHasArtifice && !duplicateHasArtifice) ||
              (itemHasArtifice === duplicateHasArtifice &&
                (item.powerLevel ?? 0) > (duplicate.powerLevel ?? 0))));
        if (itemShouldRepresent) {
          duplicates.push(duplicate);
          duplicatePruners.set(duplicate.id, item);
          for (const [duplicateId, pruner] of duplicatePruners) {
            if (pruner.id === duplicate.id) duplicatePruners.set(duplicateId, item);
          }
          distinctItems[duplicateIndex] = item;
          continue;
        }
        duplicates.push(item);
        duplicatePruners.set(item.id, duplicate);
      } else {
        distinctItems.push(item);
        if (bucket) bucket.push(distinctItems.length - 1);
        else {
          bucket = [distinctItems.length - 1];
          profileBuckets.set(key, bucket);
        }
      }
    }
    return { items: distinctItems, duplicates, duplicatePruners };
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

      gearSetHash: armor.gearSetHash ?? null,
      gearSetPerkSelectable: armor.gearSetPerkSelectable,

      tuningStat: armor.tuningStat,

      tier: armor.tier,
      armorSystem: armor.armorSystem,
    };
  }

  static convertPermutatorArmorToWorkerArmor(armor: IPermutatorArmor): IPermutatorArmor {
    return {
      id: armor.id,
      hash: armor.hash,
      slot: armor.slot,
      isExotic: armor.isExotic,
      perk: armor.perk,
      masterworkLevel: armor.masterworkLevel,
      archetypeStats: armor.archetypeStats,
      mobility: armor.mobility,
      resilience: armor.resilience,
      recovery: armor.recovery,
      discipline: armor.discipline,
      intellect: armor.intellect,
      strength: armor.strength,
      gearSetHash: armor.gearSetHash ?? null,
      gearSetPerkSelectable: armor.gearSetPerkSelectable,
      tuningStat: armor.tuningStat,
      armorSystem: armor.armorSystem,
      tier: armor.tier,
    } as IPermutatorArmor;
  }

  private static getArmorStats(armor: IPermutatorArmor): number[] {
    return [
      armor.resilience,
      armor.strength,
      armor.discipline,
      armor.intellect,
      armor.recovery,
      armor.mobility,
    ];
  }

  private static sumStats(stats: number[]): number {
    return stats.reduce((sum, stat) => sum + stat, 0);
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
    this._totalPossibleCombinations.next(0);
    this.killWorkers();
    const runId = ++ArmorCalculatorService.runCounter;
    clearTimeout(ArmorCalculatorService.intermediatePublishTimer);
    ArmorCalculatorService.intermediatePublishTimer = null;
    ArmorCalculatorService.lastIntermediatePublish = 0;
    ArmorCalculatorService.lastPublishCost = 0;

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

      ArmorCalculatorService.savedResultsCount = 0;
      ArmorCalculatorService.totalPermutationsCount = 0;
      this._computedPermutations.next(0);
      this._calculationElapsedTime.next(0);
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
      if (runId !== ArmorCalculatorService.runCounter) return;
      const selectedExoticSlots = new Set(
        ArmorCalculatorService.selectedExotics.map((exotic) => exotic.slot)
      );
      ArmorCalculatorService.sharedArmorExcludedSlots =
        selectedExoticSlots.size === 2 || selectedExoticSlots.size === 3
          ? selectedExoticSlots
          : new Set<ArmorSlot>();

      const preparedInventoryArmor = await this.filterAndPrepareInventoryItems(config);
      // A newer calculation started while this one was loading; it owns the shared state now.
      if (runId !== ArmorCalculatorService.runCounter) return;
      const inventoryArmorItems = preparedInventoryArmor.items;
      const armorPoolInventoryItems = [
        ...inventoryArmorItems,
        ...preparedInventoryArmor.duplicates,
      ];

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
        ArmorCalculatorService.prePruneArmorItems = ArmorCalculatorService.markPrunedArmorItems(
          armorPoolInventoryItems,
          permutatorArmorItems
        );
        ArmorCalculatorService.retainedEntries = [];
        ArmorCalculatorService.freshEntries = [];
        ArmorCalculatorService.pendingResultSets = [];
        ArmorCalculatorService.freshKeys.clear();
        ArmorCalculatorService.entriesConfig = null;
        this._armorResults.next({
          results: [],
          savedResults: 0,
          totalPermutations: 0,
          resultLimitReached: false,
          stoppedEarlyAtMaxTier: false,
          itemCount: inventoryArmorItems.length,
          totalTime: 0,
          maximumPossibleTiers: [0, 0, 0, 0, 0, 0],
          prePruneArmorItems: ArmorCalculatorService.prePruneArmorItems,
        });
        this.status.modifyStatus((s) => (s.calculatingResults = false));
        return;
      }
      const inventoryById = new Map<number, IInventoryArmor>();
      for (const armor of inventoryArmorItems) {
        inventoryById.set(armor.id, armor);
      }
      ArmorCalculatorService.inventoryById = inventoryById;

      const prunedByMap = new Map(preparedInventoryArmor.duplicatePruners);
      const prePruneArmorItems = ArmorCalculatorService.markPrunedArmorItems(
        armorPoolInventoryItems,
        permutatorArmorItems,
        prunedByMap
      );
      ArmorCalculatorService.prePruneArmorItems = prePruneArmorItems;
      permutatorArmorItems = ArmorCalculatorService.pruneDominatedArmorItems(
        permutatorArmorItems,
        config,
        inventoryById,
        prunedByMap
      );
      ArmorCalculatorService.prePruneArmorItems = ArmorCalculatorService.markPrunedArmorItems(
        armorPoolInventoryItems,
        permutatorArmorItems,
        prunedByMap
      );
      this.keepMatchingResults(config, permutatorArmorItems, inventoryById);
      ArmorCalculatorService.publishResults(this._armorResults, inventoryArmorItems.length, {
        totalTime: null,
        maximumPossibleTiers: [0, 0, 0, 0, 0, 0],
      });
      nthreads = ArmorCalculatorService.estimateRequiredThreads(config, permutatorArmorItems);
      this.logger.info("ArmorCalculatorService", "updateResults", "Estimated threads: " + nthreads);
      const workerItems = permutatorArmorItems.map(
        ArmorCalculatorService.convertPermutatorArmorToWorkerArmor
      );
      // Pre-sort higher values first: total stats, masterwork, selected stats, then gear set.
      const selectedStats = Object.values(ArmorStat).filter(
        (stat): stat is ArmorStat =>
          typeof stat === "number" && config.minimumStatTiers[stat].value > 0
      );
      workerItems.sort((a, b) => {
        const aStats = ArmorCalculatorService.getArmorStats(a);
        const bStats = ArmorCalculatorService.getArmorStats(b);
        const totalDiff =
          ArmorCalculatorService.sumStats(bStats) - ArmorCalculatorService.sumStats(aStats);
        if (totalDiff !== 0) return totalDiff;

        const masterworkDiff = (b.masterworkLevel ?? 0) - (a.masterworkLevel ?? 0);
        if (masterworkDiff !== 0) return masterworkDiff;

        const selectedStatsDiff = selectedStats.reduce(
          (sum, stat) => sum + bStats[stat] - aStats[stat],
          0
        );
        if (selectedStatsDiff !== 0) return selectedStatsDiff;

        const aHasGearSet = a.gearSetHash != null || a.gearSetPerkSelectable;
        const bHasGearSet = b.gearSetHash != null || b.gearSetPerkSelectable;
        return Number(bHasGearSet) - Number(aHasGearSet);
      });

      const workerItemBatches = ArmorCalculatorService.splitArmorItemsForWorkers(
        workerItems,
        nthreads
      );

      // Initialize static thread tracking arrays
      ArmorCalculatorService.emittedPossibleCombinations = false;
      ArmorCalculatorService.threadCalculationAmountArr = [...Array(nthreads).keys()].map(() => 0);
      ArmorCalculatorService.threadCalculationDoneArr = [...Array(nthreads).keys()].map(() => 0);
      ArmorCalculatorService.threadComputedPermutationsArr = [...Array(nthreads).keys()].map(
        () => 0
      );
      ArmorCalculatorService.threadCalculationReachableTiers = [...Array(nthreads).keys()].map(() =>
        Array(6).fill(0)
      );
      ArmorCalculatorService.globalMaximumPossibleTiers = [0, 0, 0, 0, 0, 0];
      ArmorCalculatorService.threadResultLimitReachedArr = [...Array(nthreads).keys()].map(
        () => false
      );
      ArmorCalculatorService.allThreadsResultLimitReached = false;
      ArmorCalculatorService.stoppedEarlyAtMaxTier = false;

      this._calculationProgress.next(0);

      for (let n = 0; n < nthreads; n++) {
        const worker = ArmorCalculatorService.acquireWorker(n.toString());
        ArmorCalculatorService.workers[n] = worker;
        worker.onmessage = (ev: MessageEvent) => {
          // Late messages of a superseded run must not touch the current one.
          if (ArmorCalculatorService.workers[n] !== worker) return;
          this.processWorkerMessage(ev.data, n, nthreads, inventoryArmorItems);
        };
        worker.onerror = (ev) => {
          this.logger.error(
            "ArmorCalculatorService",
            "updateResults",
            formatWorkerErrorEvent(n, ev)
          );
          worker.terminate();
        };

        worker.postMessage({
          type: "builderRequest",
          currentClass: currentClass,
          config: config,
          threadSplit: {
            count: nthreads,
            current: n,
          },
          items: workerItemBatches[n],
          selectedExotics: ArmorCalculatorService.selectedExotics,
        });
      }
      const limitBuilders = config.stopAtTheoreticalMaximum !== false;
      const stopOnInfeasible = ArmorCalculatorService.theoreticalInfeasibilityIsFinal(
        config,
        permutatorArmorItems
      );
      if (limitBuilders || stopOnInfeasible)
        ArmorCalculatorService.startTheoreticalMaximum(
          config,
          permutatorArmorItems,
          [...ArmorCalculatorService.workers],
          limitBuilders,
          stopOnInfeasible ? () => this.finishWithoutResults(inventoryArmorItems.length) : undefined
        );
    } catch (error) {
      this.logger.error(
        "ArmorCalculatorService",
        "calculateArmorSetResults",
        "Error during calculation: " + error
      );
      this.status.modifyStatus((s) => (s.calculatingResults = false));
      this._calculationProgress.next(0);
      this.clearResults(true);
    } finally {
    }
  }
}
