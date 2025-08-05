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

import { AfterViewInit, Component, OnDestroy, ViewChild } from "@angular/core";
import { NGXLogger } from "ngx-logger";
import { InventoryService } from "../../../services/inventory.service";
import { MatTableDataSource } from "@angular/material/table";
import { ConfigurationService } from "../../../services/configuration.service";
import { ArmorPerkOrSlot, ArmorStat, StatModifier } from "../../../data/enum/armor-stat";
import { MatPaginator } from "@angular/material/paginator";
import { MatSort } from "@angular/material/sort";
import { StatusProviderService } from "../../../services/status-provider.service";
import { animate, state, style, transition, trigger } from "@angular/animations";
import { DestinyClass } from "bungie-api-ts/destiny2";
import { ArmorSlot } from "../../../data/enum/armor-slot";
import { BuildConfiguration } from "../../../data/buildConfiguration";
import { Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";
import { InventoryArmorSource } from "src/app/data/types/IInventoryArmor";
import { MAXIMUM_STAT_MOD_AMOUNT } from "src/app/data/constants";

export interface ResultDefinition {
  exotic:
    | undefined
    | {
        icon: string;
        name: string;
        hash: string;
      };
  artifice: number[];
  mods: number[];
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
  hash: number;
  itemInstanceId: string;
  tier: number; // 0 = exotic, 1-5 = legendary
  name: string;
  exotic: boolean;
  masterworked: boolean;
  armorSystem: number; // 2 = Armor 2.0, 3 = Armor 3.0
  masterworkLevel: number; // 0-5, 5 = full masterwork
  archetypeStats: ArmorStat[]; // [Mobility, Resilience, Recovery, Discipline, Intellect, Strength]
  stats: number[];
  slot: ArmorSlot;
  perk: ArmorPerkOrSlot;
  transferState: ResultItemMoveState;
  statsNoMods: number[];
  source: InventoryArmorSource;
}

@Component({
  selector: "app-results",
  templateUrl: "./results.component.html",
  styleUrls: ["./results.component.scss"],
  animations: [
    trigger("detailExpand", [
      state("collapsed, void", style({ height: "0px" })),
      state("expanded", style({ height: "*" })),
      transition("expanded <=> collapsed", animate("225ms cubic-bezier(0.4, 0.0, 0.2, 1)")),
      transition("expanded <=> void", animate("225ms cubic-bezier(0.4, 0.0, 0.2, 1)")),
    ]),
  ],
})
export class ResultsComponent implements AfterViewInit, OnDestroy {
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
  _config_assumeEveryLegendaryIsArtifice: Boolean = false;
  _config_assumeEveryExoticIsArtifice: Boolean = false;
  _config_enforceFeaturedArmor: Boolean = false;
  _config_modslotLimitation: boolean = false;
  _config_armorPerkLimitation: boolean = false;

  tableDataSource = new MatTableDataSource<ResultDefinition>();
  @ViewChild(MatPaginator) paginator: MatPaginator | null = null;
  @ViewChild(MatSort) sort: MatSort | null = null;
  expandedElement: ResultDefinition | null = null;
  shownColumns = [
    "exotic",
    "health",
    "melee",
    "grenade",
    "super",
    "class",
    "weapon",
    "total",
    "mods",
    "dropdown",
  ];

  // info values
  selectedClass: DestinyClass = DestinyClass.Unknown;
  totalTime: number = 0;
  itemCount: number = 0;
  totalResults: number = 0;
  parsedResults: number = 0;
  viewMode: "table" | "cards" = "table";
  _config_legacyArmor: any;
  computationProgress: number = 0;
  isCalculatingPermutations: boolean = false;
  initializing: boolean = true; // Flag to indicate if the page is still initializing
  cancelledCalculation: boolean = false;

  constructor(
    private inventory: InventoryService,
    public configService: ConfigurationService,
    public status: StatusProviderService,
    private logger: NGXLogger
  ) {
    // Load saved view mode from localStorage
    const savedViewMode = localStorage.getItem("d2ap-view-mode") as "table" | "cards";
    if (savedViewMode) {
      this.viewMode = savedViewMode;
    }
  }

  ngAfterViewInit(): void {
    this.tableDataSource.paginator = this.paginator;
    this.tableDataSource.sort = this.sort;
    this.tableDataSource.sortingDataAccessor = (data, sortHeaderId) => {
      switch (sortHeaderId) {
        case "Weapon":
          return data.stats[ArmorStat.StatWeapon];
        case "Health":
          return data.stats[ArmorStat.StatHealth];
        case "Class":
          return data.stats[ArmorStat.StatClass];
        case "Grenade":
          return data.stats[ArmorStat.StatGrenade];
        case "Super":
          return data.stats[ArmorStat.StatSuper];
        case "Melee":
          return data.stats[ArmorStat.StatMelee];
        case "Tiers":
          return data.tiers;
        case "Total":
          return data.stats.reduce((sum, stat) => sum + stat, 0);
        case "Mods":
          return (
            +100 * data.modCount +
            //+ 40 * data.artifice.length
            data.modCost
          );
      }
      return 0;
    };

    this.status.status.pipe(takeUntil(this.ngUnsubscribe)).subscribe((s) => {
      this.isCalculatingPermutations = s.calculatingPermutations || s.calculatingResults;

      if (this.isCalculatingPermutations) {
        this.initializing = false;
      }
      this.cancelledCalculation = s.cancelledCalculation;
    });

    this.inventory.calculationProgress.subscribe((progress) => {
      this.computationProgress = progress;
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
        this._config_assumeEveryLegendaryIsArtifice = c.assumeEveryLegendaryIsArtifice;
        this._config_assumeEveryExoticIsArtifice = c.assumeEveryExoticIsArtifice;
        this._config_enforceFeaturedArmor =
          c.enforceFeaturedLegendaryArmor || c.enforceFeaturedExoticArmor;
        this._config_selectedExotics = c.selectedExotics;
        this._config_armorPerkLimitation = c.armorRequirements.length > 0;
        this._config_modslotLimitation = c.statModLimits.maxMajorMods < MAXIMUM_STAT_MOD_AMOUNT;

        let columns = [
          "exotic",
          "health",
          "melee",
          "grenade",
          "super",
          "class",
          "weapon",
          "total",
          "mods",
        ];
        if (c.includeVendorRolls || c.includeCollectionRolls) columns.push("source");
        columns.push("dropdown");
        this.shownColumns = columns;
      });

    this.inventory.armorResults.pipe(takeUntil(this.ngUnsubscribe)).subscribe(async (value) => {
      if (value.results.length > 0 && this.initializing) {
        this.initializing = false;
      }
      this._results = value.results;
      this.itemCount = value.itemCount;
      this.totalTime = value.totalTime;
      this.totalResults = value.totalResults;
      this.parsedResults = this._results.length;

      this.status.modifyStatus((s) => (s.updatingResultsTable = true));
      await this.updateData();
      this.status.modifyStatus((s) => (s.updatingResultsTable = false));
    });
  }

  cancelCalculation() {
    this.inventory.cancelCalculation();
  }

  async updateData() {
    this.logger.info(
      "ResultsComponent",
      "updateData",
      "Table total results: " + this._results.length
    );
    const start = performance.now();
    this.tableDataSource.paginator = this.paginator;
    this.tableDataSource.sort = this.sort;
    this.tableDataSource.data = this._results;

    // Ensure sorting is properly initialized after data update
    if (this.viewMode === "table") {
      setTimeout(() => {
        this.initializeTableSorting();
      }, 50);
    }

    const end = performance.now();
    this.logger.info("ResultsComponent", "updateData", `Update Table Data took ${end - start} ms`);
  }

  getTotalStats(element: ResultDefinition): number {
    return (
      element.stats[0] +
      element.stats[1] +
      element.stats[2] +
      element.stats[3] +
      element.stats[4] +
      element.stats[5]
    );
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

    // Reinitialize table sorting when switching to table view
    if (this.viewMode === "table") {
      // Use a longer timeout to ensure DOM is fully rendered
      setTimeout(() => {
        this.initializeTableSorting();
      }, 100);
    }
  }

  private initializeTableSorting() {
    if (this.sort && this.tableDataSource) {
      this.tableDataSource.sort = this.sort;
      // Force sort to re-evaluate the current sort state
      if (this.sort.active) {
        this.sort.sortChange.emit({
          active: this.sort.active,
          direction: this.sort.direction,
        });
      }
    }
  }
}
