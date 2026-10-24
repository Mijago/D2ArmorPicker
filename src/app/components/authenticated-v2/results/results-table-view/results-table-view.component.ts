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
import { environment } from "src/environments/environment";

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
  standalone: false,
})
export class ResultsTableViewComponent implements OnInit, AfterViewInit, OnChanges, OnDestroy {
  ArmorStat = ArmorStat;

  @Input() results: ResultDefinition[] = [];

  tableDataSource = new MatTableDataSource<ResultDefinition>();
  @ViewChild(MatPaginator) paginator: MatPaginator | null = null;
  @ViewChild(MatSort) sort: MatSort | null = null;
  expandedElement: ResultDefinition | null = null;
  expandedElementId: string | null = null; // Use ID instead of object reference
  hoveredSharedArmorHash: string | null = null;
  selectedSharedArmorHash: string | null = null;
  private readonly showEasySwapColumn =
    !environment.production && !environment.beta && !environment.canary;
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
  // Filled per row on demand: only the visible page ever reads it.
  private gearsetBonuses = new WeakMap<ResultDefinition, GearsetBonusDisplay[]>();
  private gearsetBonusesLoaded = false;
  private gearsetPerks = new Map<string, DestinySandboxPerkDefinition>();
  private missingGearsetPerks = new Set<string>();
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
      // A new array with the same rows would only reset the page, the expanded row and the icons.
      if (this.viewInitialized && this.hasSameRows(this.results, this.displayedResults)) return;

      // Reset expanded element when results change
      this.expandedElement = null;
      this.expandedElementId = null;
      this.selectedSharedArmorHash = null;
      this.hoveredSharedArmorHash = null;

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

  private hasSameRows(left: ResultDefinition[], right: ResultDefinition[]): boolean {
    return left.length === right.length && left.every((row, index) => row === right[index]);
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
          return this.getSortTotal(data);
        case "Mods":
          return +100 * (data.modCount + data.tuningMods.length) + data.modCost;
        case "GearsetBonuses":
          return this.getCachedGearsetBonusRank(data);
        case "EasySwap":
          return data.sharedBuildCount ?? 1;
      }
      return 0;
    };
  }

  // Sorting reads every row about n log n times; Firefox pays heavily for recomputing these.
  private sortTotals = new WeakMap<ResultDefinition, number>();
  private gearsetRanks = new WeakMap<ResultDefinition, number>();

  private getSortTotal(result: ResultDefinition): number {
    let total = this.sortTotals.get(result);
    if (total === undefined) {
      total = result.stats.reduce((sum, stat) => sum + stat, 0);
      this.sortTotals.set(result, total);
    }
    return total;
  }

  private getCachedGearsetBonusRank(result: ResultDefinition): number {
    let rank = this.gearsetRanks.get(result);
    if (rank === undefined) {
      rank = this.getGearsetBonusRank(result);
      this.gearsetRanks.set(result, rank);
    }
    return rank;
  }

  // Parallel arrays: this runs for every result on each update, so it avoids allocating Maps.
  private getGearsetCounts(result: ResultDefinition): { hashes: number[]; counts: number[] } {
    const hashes: number[] = [];
    const counts: number[] = [];
    for (const item of result.items) {
      if (item.gearSetHash == null) continue;
      const index = hashes.indexOf(item.gearSetHash);
      if (index === -1) {
        hashes.push(item.gearSetHash);
        counts.push(1);
      } else counts[index]++;
    }
    this.gearsetRequirementCounts.forEach((count, hash) => {
      const index = hashes.indexOf(hash);
      if (index === -1) {
        hashes.push(hash);
        counts.push(count);
      } else counts[index] = Math.max(count, counts[index]);
    });
    return { hashes, counts };
  }

  private getGearsetBonusRank(result: ResultDefinition): number {
    const activeSetCounts = this.getGearsetCounts(result).counts.filter((count) => count >= 2);
    if (activeSetCounts.some((count) => count >= 4)) return 3;
    if (activeSetCounts.length >= 2) return 2;
    if (activeSetCounts.length === 1) return 1;
    return 0;
  }

  private updateShownColumns(config: BuildConfiguration): void {
    this.gearsetRequirementCounts.clear();
    this.gearsetRanks = new WeakMap();
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
    if (this.showEasySwapColumn) columns.push("easySwap");
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
    // Clear caches and reset expanded element
    this.totalStatsCache.clear();
    this.expandedElement = null;
    this.expandedElementId = null;

    // Limit initial results for performance
    this.displayedResults = this.results;

    // Started first so cached icons are in place when the new rows render.
    const loadingBonuses = this.loadGearsetBonuses();
    this.tableDataSource.data = this.displayedResults;
    await loadingBonuses;

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

    // Force change detection to update the UI immediately
    this.cdr.markForCheck();
  }

  getGearsetBonuses(element: ResultDefinition): GearsetBonusDisplay[] {
    let bonuses = this.gearsetBonuses.get(element);
    if (bonuses === undefined) {
      if (!this.gearsetBonusesLoaded) return [];
      bonuses = this.buildGearsetBonuses(element);
      this.gearsetBonuses.set(element, bonuses);
    }
    return bonuses;
  }

  private buildGearsetBonuses(result: ResultDefinition): GearsetBonusDisplay[] {
    const { hashes, counts } = this.getGearsetCounts(result);
    const bonuses: GearsetBonusDisplay[] = [];
    for (let index = 0; index < hashes.length; index++) {
      const amount = counts[index] >= 4 ? 4 : counts[index] >= 2 ? 2 : 0;
      const perk = amount ? this.gearsetPerks.get(`${hashes[index]}-${amount}`) : undefined;
      if (perk) bonuses.push({ perk, requiredSetCount: amount });
    }
    return bonuses;
  }

  // The bonus objects are rebuilt on every update; tracking them keeps the icons in the DOM.
  trackByBonus(index: number, bonus: GearsetBonusDisplay): string {
    return `${bonus.perk.hash}-${bonus.requiredSetCount}`;
  }

  // False while perks are still loading, so no placeholder flashes.
  hasLoadedGearsetBonuses(): boolean {
    return this.gearsetBonusesLoaded;
  }

  private loadGearsetBonuses(): Promise<void> {
    const loadId = ++this.gearsetBonusLoadId;
    // Perks are fetched for every gearset in the results; rows only combine them when rendered.
    const gearsetHashes = new Set<number>(this.gearsetRequirementCounts.keys());
    for (const result of this.results) {
      for (const item of result.items) {
        if (item.gearSetHash != null) gearsetHashes.add(item.gearSetHash);
      }
    }
    const missingRequests: { hash: number; amount: number }[] = [];
    for (const hash of gearsetHashes) {
      for (const amount of [2, 4]) {
        const key = `${hash}-${amount}`;
        if (!this.gearsetPerks.has(key) && !this.missingGearsetPerks.has(key))
          missingRequests.push({ hash, amount });
      }
    }

    const apply = () => {
      this.gearsetBonuses = new WeakMap();
      this.gearsetBonusesLoaded = true;
      this.cdr.markForCheck();
    };

    // Known perks are applied synchronously; only unseen gearsets wait for a lookup.
    if (missingRequests.length === 0) {
      apply();
      return Promise.resolve();
    }

    this.gearsetBonusesLoaded = false;
    return Promise.all(
      missingRequests.map(async ({ hash, amount }) => {
        const key = `${hash}-${amount}`;
        const perk = await this.itemIconService.getGearsetPerkCached(hash, amount);
        if (perk) this.gearsetPerks.set(key, perk);
        else this.missingGearsetPerks.add(key);
      })
    ).then(() => {
      if (loadId === this.gearsetBonusLoadId) apply();
    });
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

  isSharedArmorHighlighted(element: ResultDefinition): boolean {
    const activeHash = this.hoveredSharedArmorHash ?? this.selectedSharedArmorHash;
    return !!activeHash && element.sharedArmorHash === activeHash;
  }

  hoverSharedArmor(element: ResultDefinition): void {
    this.hoveredSharedArmorHash = element.sharedArmorHash ?? null;
  }

  clearHoveredSharedArmor(): void {
    this.hoveredSharedArmorHash = null;
  }

  // Helper method to toggle expansion
  toggleElement(element: ResultDefinition): void {
    const elementId = this.getResultId(element);

    if (this.expandedElementId === elementId) {
      // Collapse if already expanded
      this.expandedElement = null;
      this.expandedElementId = null;
      this.selectedSharedArmorHash = null;
    } else {
      // Expand the clicked element
      this.expandedElement = element;
      this.expandedElementId = elementId;
      this.selectedSharedArmorHash = element.sharedArmorHash ?? null;
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
