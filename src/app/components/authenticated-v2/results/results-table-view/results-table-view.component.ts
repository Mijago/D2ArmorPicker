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

import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  AfterViewInit,
  SimpleChanges,
  ViewChild,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from "@angular/core";
import { MatTableDataSource } from "@angular/material/table";
import { MatPaginator } from "@angular/material/paginator";
import { MatSort } from "@angular/material/sort";
import { animate, state, style, transition, trigger } from "@angular/animations";
import { Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";
import { LoggingProxyService } from "../../../../services/logging-proxy.service";
import { ConfigurationService } from "../../../../services/configuration.service";
import { ResultDefinition } from "../results.component";
import { ArmorStat } from "../../../../data/enum/armor-stat";
import { BuildConfiguration } from "../../../../data/buildConfiguration";
import { ItemIconServiceService } from "../../../../services/item-icon-service.service";
import { DestinySandboxPerkDefinition } from "bungie-api-ts/destiny2";

interface GearsetBonusDisplay {
  perk: DestinySandboxPerkDefinition;
  requiredSetCount: number;
}

@Component({
  selector: "app-results-table-view",
  templateUrl: "./results-table-view.component.html",
  styleUrls: ["./results-table-view.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger("detailExpand", [
      state("collapsed, void", style({ height: "0px" })),
      state("expanded", style({ height: "*" })),
      transition("expanded <=> collapsed", animate("225ms cubic-bezier(0.4, 0.0, 0.2, 1)")),
      transition("expanded <=> void", animate("225ms cubic-bezier(0.4, 0.0, 0.2, 1)")),
    ]),
  ],
})
export class ResultsTableViewComponent implements OnInit, AfterViewInit, OnChanges, OnDestroy {
  ArmorStat = ArmorStat;

  @Input() results: ResultDefinition[] = [];

  tableDataSource = new MatTableDataSource<ResultDefinition>();
  @ViewChild(MatPaginator) paginator: MatPaginator | null = null;
  @ViewChild(MatSort) sort: MatSort | null = null;
  expandedElement: ResultDefinition | null = null;
  expandedElementId: string | null = null; // Use ID instead of object reference
  shownColumns = [
    "exotic",
    "gearsetBonuses",
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

  // Performance optimizations
  private totalStatsCache = new Map<string, number>();
  private displayedResults: ResultDefinition[] = [];
  private gearsetBonuses = new Map<ResultDefinition, GearsetBonusDisplay[]>();
  private gearsetRequirementCounts = new Map<number, number>();
  private gearsetBonusLoadId = 0;
  showAllResults = false;

  // View / initialization state
  private viewInitialized = false;
  private pendingResultsUpdate = false;

  private ngUnsubscribe = new Subject<void>();

  constructor(
    public configService: ConfigurationService,
    private itemIconService: ItemIconServiceService,
    private logger: LoggingProxyService,
    private cdr: ChangeDetectorRef
  ) {
    this.logger.debug("ResultsTableViewComponent", "constructor", "Component constructed");
  }

  ngOnInit(): void {
    // Ensure expanded element is null on initialization
    this.expandedElement = null;
    this.expandedElementId = null;

    this.setupTableSorting();

    // Subscribe to configuration changes to update shown columns
    this.configService.configuration
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe((c: BuildConfiguration) => {
        this.updateShownColumns(c);
      });
  }

  ngAfterViewInit(): void {
    // Initialize paginator and sort after view is initialized
    if (this.paginator) {
      this.tableDataSource.paginator = this.paginator;
    }
    if (this.sort) {
      this.tableDataSource.sort = this.sort;
    }

    this.viewInitialized = true;

    // If results arrived before the view was initialized, update the table now
    if (this.pendingResultsUpdate && this.results) {
      this.pendingResultsUpdate = false;
      this.updateTableData();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["results"] && this.results) {
      // Reset expanded element when results change
      this.expandedElement = null;
      this.expandedElementId = null;

      // Defer table data initialization until the view (and paginator) are ready
      if (this.viewInitialized) {
        this.updateTableData();
        this.cdr.markForCheck();
      } else {
        this.pendingResultsUpdate = true;
      }
    }
  }

  ngOnDestroy(): void {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }

  private setupTableSorting(): void {
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
          return +100 * (data.modCount + data.tuningMods.length) + data.modCost;
        case "GearsetBonuses":
          return this.getGearsetBonusRank(data);
      }
      return 0;
    };
  }

  private getGearsetCounts(result: ResultDefinition): Map<number, number> {
    const gearsetCounts = new Map<number, number>();
    result.items.forEach((item) => {
      if (item.gearSetHash != null) {
        gearsetCounts.set(item.gearSetHash, (gearsetCounts.get(item.gearSetHash) ?? 0) + 1);
      }
    });
    this.gearsetRequirementCounts.forEach((count, hash) => {
      gearsetCounts.set(hash, Math.max(count, gearsetCounts.get(hash) ?? 0));
    });
    return gearsetCounts;
  }

  private getGearsetBonusRank(result: ResultDefinition): number {
    const activeSetCounts = Array.from(this.getGearsetCounts(result).values()).filter(
      (count) => count >= 2
    );
    if (activeSetCounts.some((count) => count >= 4)) return 3;
    if (activeSetCounts.length >= 2) return 2;
    if (activeSetCounts.length === 1) return 1;
    return 0;
  }

  private updateShownColumns(config: BuildConfiguration): void {
    this.gearsetRequirementCounts.clear();
    config.armorRequirements.forEach((requirement) => {
      if ("gearSetHash" in requirement) {
        this.gearsetRequirementCounts.set(
          requirement.gearSetHash,
          (this.gearsetRequirementCounts.get(requirement.gearSetHash) ?? 0) + 1
        );
      }
    });

    let columns = [
      "exotic",
      "gearsetBonuses",
      "health",
      "melee",
      "grenade",
      "super",
      "class",
      "weapon",
      "total",
      "mods",
    ];
    if (config.includeVendorRolls || config.includeCollectionRolls) {
      columns.push("source");
    }
    columns.push("dropdown");
    this.shownColumns = columns;

    if (this.results.length > 0) {
      void this.loadGearsetBonuses();
    }
  }

  private async updateTableData(): Promise<void> {
    this.logger.info(
      "ResultsTableViewComponent",
      "updateData",
      "Table total results: " + this.results.length
    );
    const start = performance.now();

    // Clear caches and reset expanded element
    this.totalStatsCache.clear();
    this.expandedElement = null;
    this.expandedElementId = null;

    // Limit initial results for performance
    this.displayedResults = this.results;

    this.tableDataSource.data = this.displayedResults;
    await this.loadGearsetBonuses();

    // Reconnect paginator and sort if they're available
    if (this.paginator) {
      this.tableDataSource.paginator = this.paginator;
      this.paginator.firstPage(); // Reset to first page when data changes
    }
    if (this.sort) {
      this.tableDataSource.sort = this.sort;
    }

    // Ensure sorting is properly initialized after data update
    setTimeout(() => {
      this.initializeTableSorting();
      this.cdr.markForCheck();
    }, 0);

    const end = performance.now();
    this.logger.info(
      "ResultsTableViewComponent",
      "updateData",
      `Update Table Data took ${end - start} ms`
    );

    // Force change detection to update the UI immediately
    this.cdr.markForCheck();
  }

  getGearsetBonuses(element: ResultDefinition): GearsetBonusDisplay[] {
    return this.gearsetBonuses.get(element) ?? [];
  }

  private async loadGearsetBonuses(): Promise<void> {
    const loadId = ++this.gearsetBonusLoadId;
    const results = this.results;
    const requestsByResult = new Map<ResultDefinition, { hash: number; amount: number }[]>();
    const uniqueRequests = new Map<string, { hash: number; amount: number }>();

    results.forEach((result) => {
      const gearsetCounts = this.getGearsetCounts(result);

      const requests: { hash: number; amount: number }[] = [];
      gearsetCounts.forEach((count, hash) => {
        if (count >= 4) requests.push({ hash, amount: 4 });
        else if (count >= 2) requests.push({ hash, amount: 2 });
      });
      requests.forEach((request) =>
        uniqueRequests.set(`${request.hash}-${request.amount}`, request)
      );
      requestsByResult.set(result, requests);
    });

    const perks = new Map<string, DestinySandboxPerkDefinition>();
    await Promise.all(
      Array.from(uniqueRequests.entries()).map(async ([key, request]) => {
        const perk = await this.itemIconService.getGearsetPerkCached(request.hash, request.amount);
        if (perk) perks.set(key, perk);
      })
    );

    if (loadId !== this.gearsetBonusLoadId) return;

    this.gearsetBonuses.clear();
    requestsByResult.forEach((requests, result) => {
      this.gearsetBonuses.set(
        result,
        requests.flatMap((request) => {
          const perk = perks.get(`${request.hash}-${request.amount}`);
          return perk ? [{ perk, requiredSetCount: request.amount }] : [];
        })
      );
    });
    this.cdr.markForCheck();
  }

  getTotalStats(element: ResultDefinition): number {
    const cacheKey = element.stats.join("-");

    if (!this.totalStatsCache.has(cacheKey)) {
      const total = element.stats.reduce((sum, stat) => sum + stat, 0);
      this.totalStatsCache.set(cacheKey, total);
    }

    return this.totalStatsCache.get(cacheKey)!;
  }

  showAllRows(): void {
    this.showAllResults = true;
    this.displayedResults = this.results;
    this.tableDataSource.data = this.displayedResults;

    // Reset expanded element when showing all rows
    this.expandedElement = null;
    this.expandedElementId = null;

    // Reconnect paginator after updating data
    if (this.paginator) {
      this.tableDataSource.paginator = this.paginator;
      this.paginator.firstPage(); // Reset to first page
    }

    this.cdr.markForCheck();
  }

  // TrackBy function to improve performance by helping Angular track changes
  trackByResult(index: number, item: ResultDefinition): any {
    return item.stats.join("-") + item.mods.join("-") + (item.exotic?.hash || "none");
  }

  trackByExpandedResult(index: number, item: ResultDefinition): any {
    return "expanded-" + item.stats.join("-") + item.mods.join("-") + (item.exotic?.hash || "none");
  }

  // Helper method to generate unique ID for each result
  private getResultId(element: ResultDefinition): string {
    return (
      element.stats.join("-") +
      "-" +
      element.mods.join("-") +
      "-" +
      (element.exotic?.hash || "none")
    );
  }

  // Helper method to check if element is expanded
  isElementExpanded(element: ResultDefinition): boolean {
    const elementId = this.getResultId(element);
    return this.expandedElementId === elementId;
  }

  // Helper method to toggle expansion
  toggleElement(element: ResultDefinition): void {
    const elementId = this.getResultId(element);

    if (this.expandedElementId === elementId) {
      // Collapse if already expanded
      this.expandedElement = null;
      this.expandedElementId = null;
    } else {
      // Expand the clicked element
      this.expandedElement = element;
      this.expandedElementId = elementId;
    }
  }

  private initializeTableSorting(): void {
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
