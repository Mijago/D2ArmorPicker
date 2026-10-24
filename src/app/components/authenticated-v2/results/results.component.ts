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

import { Component, OnDestroy, OnInit, NgZone, ChangeDetectionStrategy } from "@angular/core";
import { LoggingProxyService } from "../../../services/logging-proxy.service";
import { ArmorCalculatorService } from "../../../services/armor-calculator.service";
import { ConfigurationService } from "../../../services/configuration.service";
import { ArmorPerkOrSlot, ArmorStat, StatModifier } from "../../../data/enum/armor-stat";
import { StatusProviderService } from "../../../services/status-provider.service";
import { DestinyClass } from "bungie-api-ts/destiny2";
import { ArmorSlot } from "../../../data/enum/armor-slot";
import { BuildConfiguration } from "../../../data/buildConfiguration";
import { Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";
import { InventoryArmorSource } from "src/app/data/types/IInventoryArmor";
import { MAXIMUM_STAT_MOD_AMOUNT } from "src/app/data/constants";
import { Tuning } from "src/app/data/types/IPermutatorArmorSet";
import { calculateCPUConcurrency } from "../../../data/commonFunctions";

const FIREFOX_NOTICE_KEY = "d2ap-firefox-cores-notice-dismissed";

export interface ResultDefinition {
  exotic:
    | undefined
    | {
        icon: string;
        name: string;
        watermark: string;
        hash: number;
      };
  artifice: number[];
  mods: number[];
  tuningMods: number[];
  tuningStats: Tuning;
  stats: number[];
  statsNoMods: number[];
  items: ResultItem[];
  tiers: number;
  waste: number;
  modCost: number;
  modCount: number;
  loaded: boolean;
  usesCollectionRoll?: boolean;
  usesVendorRoll?: boolean;
  sharedArmorHash?: string;
  sharedBuildCount?: number;
}

export enum ResultItemMoveState {
  TRANSFER_NONE,
  WAITING_FOR_TRANSFER,
  TRANSFERRING,
  TRANSFERRED,
  ERROR_DURING_TRANSFER,
}

export interface ResultItem {
  energyLevel: number;
  powerLevel?: number;
  hash: number;
  itemInstanceId: string;
  gearSetHash: number | null;
  tier: number; // 0 = exotic, 1-5 = legendary
  name: string;
  exotic: boolean;
  exoticPerkHash?: number[];
  tuningStat: ArmorStat | null;
  masterworked: boolean;
  armorSystem: number; // 2 = Armor 2.0, 3 = Armor 3.0
  masterworkLevel: number; // 0-5, 5 = full masterwork
  archetypeStats: ArmorStat[]; // [Health, Melee, Grenade, Super, Class, Weapon]
  stats: number[];
  slot: ArmorSlot;
  perk: ArmorPerkOrSlot;
  transferState: ResultItemMoveState;
  statsNoMods: number[];
  source: InventoryArmorSource;
  usedByCount?: number;
}

@Component({
  selector: "app-results",
  templateUrl: "./results.component.html",
  styleUrls: ["./results.component.scss"],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class ResultsComponent implements OnInit, OnDestroy {
  ArmorStat = ArmorStat;
  public StatModifier = StatModifier;

  _results: ResultDefinition[] = [];
  _config_assumeLegendariesMasterworked: Boolean = false;
  _config_assumeExoticsMasterworked: Boolean = false;

  _config_selectedExotics: number[] = [];
  _config_tryLimitWastedStats: boolean = false;
  _config_onlyUseMasterworkedExotics: Boolean = false;
  _config_onlyUseMasterworkedLegendaries: Boolean = false;
  _config_includeCollectionRolls: Boolean = false;
  _config_includeVendorRolls: Boolean = false;
  _config_onlyShowResultsWithNoWastedStats: Boolean = false;
  _config_enforceFeaturedArmor: Boolean = false;
  _config_modslotLimitation: boolean = false;
  _config_armorPerkLimitation: boolean = false;

  // info values
  selectedClass: DestinyClass = DestinyClass.Unknown;
  totalTime: number | null = 0;
  itemCount: number = 0;
  savedResults: number = 0;
  totalPermutations: number = 0;
  resultLimitReached: boolean = false;
  stoppedEarlyAtMaxTier: boolean = false;
  totalPossibleCombinations: number = 0;
  parsedResults: number = 0;
  viewMode: "table" | "cards" = "table";
  _config_legacyArmor: any;
  computationProgress: number = 0;
  isCalculatingPermutations: boolean = false;
  initializing: boolean = true; // Flag to indicate if the page is still initializing
  cancelledCalculation: boolean = false;
  readonly detectedLogicalCores = navigator.hardwareConcurrency || 4;
  readonly automaticWorkers = calculateCPUConcurrency();
  showFirefoxCoresNotice =
    /firefox/i.test(navigator.userAgent) && localStorage.getItem(FIREFOX_NOTICE_KEY) !== "1";

  constructor(
    private armorCalculator: ArmorCalculatorService,
    public configService: ConfigurationService,
    public status: StatusProviderService,
    private logger: LoggingProxyService,
    private ngZone: NgZone
  ) {
    this.logger.debug("ResultsComponent", "constructor", "Component initialized");
    // Load saved view mode from localStorage
    const savedViewMode = localStorage.getItem("d2ap-view-mode") as "table" | "cards";
    if (savedViewMode) {
      this.viewMode = savedViewMode;
    }
  }

  ngOnInit(): void {
    this.status.status.pipe(takeUntil(this.ngUnsubscribe)).subscribe((s) => {
      this.isCalculatingPermutations = s.calculatingPermutations || s.calculatingResults;

      if (this.isCalculatingPermutations) {
        this.initializing = false;
      }
      this.cancelledCalculation = s.cancelledCalculation;
    });

    this.armorCalculator.calculationProgress
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe((progress) => {
        this.ngZone.run(() => {
          this.computationProgress = progress;
        });
      });

    this.armorCalculator.totalPossibleCombinations
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe((value) => {
        this.ngZone.run(() => {
          this.totalPossibleCombinations = value;
        });
      });

    this.armorCalculator.computedPermutations
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe((value) => {
        this.ngZone.run(() => {
          this.totalPermutations = value;
        });
      });

    this.armorCalculator.calculationElapsedTime
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe((value) => {
        this.ngZone.run(() => {
          this.totalTime = value;
        });
      });
    //
    this.configService.configuration
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe((c: BuildConfiguration) => {
        this.selectedClass = c.characterClass;
        this._config_assumeLegendariesMasterworked = c.assumeLegendariesMasterworked;
        this._config_assumeExoticsMasterworked = c.assumeExoticsMasterworked;
        this._config_tryLimitWastedStats = c.tryLimitWastedStats;

        this._config_legacyArmor = c.allowLegacyLegendaryArmor || c.allowLegacyExoticArmor;
        this._config_onlyUseMasterworkedExotics = c.onlyUseMasterworkedExotics;
        this._config_onlyUseMasterworkedLegendaries = c.onlyUseMasterworkedLegendaries;
        this._config_includeCollectionRolls = c.includeCollectionRolls;
        this._config_includeVendorRolls = c.includeVendorRolls;
        this._config_onlyShowResultsWithNoWastedStats = c.onlyShowResultsWithNoWastedStats;
        this._config_enforceFeaturedArmor =
          c.enforceFeaturedLegendaryArmor || c.enforceFeaturedExoticArmor;
        this._config_selectedExotics = c.selectedExotics;
        this._config_armorPerkLimitation = c.armorRequirements.length > 0;
        this._config_modslotLimitation = c.statModLimits.maxMajorMods < MAXIMUM_STAT_MOD_AMOUNT;
      });

    this.armorCalculator.armorResults
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe(async (value) => {
        // totalTime is only set once a calculation has completed
        if ((value.results.length > 0 || value.totalTime !== null) && this.initializing) {
          this.initializing = false;
        }
        this._results = value.results;
        this.itemCount = value.itemCount;
        // Intermediate results carry no total; keep the live elapsed time instead of blanking it.
        if (value.totalTime !== null) this.totalTime = value.totalTime;
        this.savedResults = value.savedResults;
        this.totalPermutations = value.totalPermutations;
        this.resultLimitReached = value.resultLimitReached;
        this.stoppedEarlyAtMaxTier = value.stoppedEarlyAtMaxTier;
        this.parsedResults = this._results.length;
      });
  }

  cancelCalculation() {
    this.armorCalculator.cancelCalculation();
  }

  dismissFirefoxCoresNotice() {
    localStorage.setItem(FIREFOX_NOTICE_KEY, "1");
    this.showFirefoxCoresNotice = false;
  }

  private ngUnsubscribe = new Subject();

  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }

  saveBuilds() {
    let jsonData = {
      configCompressed: this.configService.getCurrentConfigBase64Compressed(),
      config: this.configService.readonlyConfigurationSnapshot,
      results: this._results.map((r) => {
        let p = Object.assign({}, r);
        p.items = p.items.map((i) => {
          return { hash: i.hash, instance: i.itemInstanceId } as any;
        });
        delete p.exotic;
        return p;
      }),
    };

    // download the file
    let a = document.createElement("a");
    a.download = "builds.json";
    const url = window.URL.createObjectURL(new Blob([JSON.stringify(jsonData, null, 2)]));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "d2ap_results.json");
    document.body.appendChild(link);
    link.click();
  }

  onViewModeChange(event: any) {
    this.viewMode = event.value;
    localStorage.setItem("d2ap-view-mode", this.viewMode);
  }
}
