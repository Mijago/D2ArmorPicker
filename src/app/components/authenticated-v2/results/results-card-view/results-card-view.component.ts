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

import { Component, Input, OnChanges, OnDestroy, SimpleChanges } from "@angular/core";
import { MatSnackBar } from "@angular/material/snack-bar";
import { Subject } from "rxjs";
import { ResultDefinition, ResultItem } from "../results.component";
import { ConfigurationService } from "../../../../services/configuration.service";
import { ArmorStat, ArmorStatNames, ArmorStatIconUrls } from "../../../../data/enum/armor-stat";

@Component({
  selector: "app-results-card-view",
  templateUrl: "./results-card-view.component.html",
  styleUrls: ["./results-card-view.component.scss"],
})
export class ResultsCardViewComponent implements OnChanges, OnDestroy {
  @Input() results: ResultDefinition[] = [];
  @Input() config: any;

  filteredResults: ResultDefinition[] = [];
  displayedResults: ResultDefinition[] = [];

  // Sorting state
  activeSortField: string | null = null;
  sortDirection: "asc" | "desc" = "desc";

  expandedCard: number | null = null;
  isLoading = false;

  // Infinite scroll settings
  private readonly PAGE_SIZE = 25;
  private currentPage = 0;

  statOrder = [0, 1, 2, 3, 4, 5]; // Weapon, Health, Class, Grenade, Super, Melee
  Math = Math;

  private destroy$ = new Subject<void>();

  constructor(
    private snackBar: MatSnackBar,
    private configService: ConfigurationService
  ) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes["results"] && this.results) {
      this.initializeData();
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeData() {
    this.filteredResults = [...this.results];
    this.applyFiltersAndSort();
    this.resetPagination();
    this.loadNextPage();
  }

  toggleSort(field: string) {
    if (this.activeSortField === field) {
      // Toggle through: desc -> asc -> none -> desc...
      if (this.sortDirection === "desc") {
        this.sortDirection = "asc";
      } else {
        // Reset sorting (no sort)
        this.activeSortField = null;
        this.sortDirection = "desc";
      }
    } else {
      // New field, start with desc
      this.activeSortField = field;
      this.sortDirection = "desc";
    }

    this.applyFiltersAndSort();
    this.resetPagination();
    this.loadNextPage();
  }

  getSortIcon(field: string): string {
    if (this.activeSortField !== field) {
      return "remove"; // dash for inactive
    }
    return this.sortDirection === "desc" ? "keyboard_arrow_down" : "keyboard_arrow_up";
  }

  private applyFiltersAndSort() {
    // No filters anymore, just copy results
    this.filteredResults = [...this.results];

    // Apply sorting only if a sort field is active
    if (this.activeSortField) {
      this.filteredResults.sort((a, b) => {
        let aValue: number;
        let bValue: number;

        switch (this.activeSortField) {
          case "total":
            aValue = this.getTotalStats(a);
            bValue = this.getTotalStats(b);
            break;
          case "mods":
            aValue = this.getModCost(a);
            bValue = this.getModCost(b);
            break;
          case "weapon":
            aValue = a.stats[ArmorStat.StatWeapon];
            bValue = b.stats[ArmorStat.StatWeapon];
            break;
          case "health":
            aValue = a.stats[ArmorStat.StatHealth];
            bValue = b.stats[ArmorStat.StatHealth];
            break;
          case "class":
            aValue = a.stats[ArmorStat.StatClass];
            bValue = b.stats[ArmorStat.StatClass];
            break;
          case "grenade":
            aValue = a.stats[ArmorStat.StatGrenade];
            bValue = b.stats[ArmorStat.StatGrenade];
            break;
          case "super":
            aValue = a.stats[ArmorStat.StatSuper];
            bValue = b.stats[ArmorStat.StatSuper];
            break;
          case "melee":
            aValue = a.stats[ArmorStat.StatMelee];
            bValue = b.stats[ArmorStat.StatMelee];
            break;
          default:
            aValue = this.getTotalStats(a);
            bValue = this.getTotalStats(b);
        }

        return this.sortDirection === "desc" ? bValue - aValue : aValue - bValue;
      });
    }
  }

  private resetPagination() {
    this.currentPage = 0;
    this.displayedResults = [];
    this.expandedCard = null;
  }

  private loadNextPage() {
    const startIndex = this.currentPage * this.PAGE_SIZE;
    const endIndex = startIndex + this.PAGE_SIZE;
    const newResults = this.filteredResults.slice(startIndex, endIndex);

    this.displayedResults.push(...newResults);
    this.currentPage++;
  }

  onScroll(event: any) {
    const element = event.target;
    if (element.scrollTop + element.clientHeight >= element.scrollHeight - 100) {
      if (!this.isLoading && this.displayedResults.length < this.filteredResults.length) {
        this.isLoading = true;
        // Simulate loading delay for better UX
        setTimeout(() => {
          this.loadNextPage();
          this.isLoading = false;
        }, 200);
      }
    }
  }

  toggleCard(index: number) {
    this.expandedCard = this.expandedCard === index ? null : index;
  }

  trackByFn(index: number, item: ResultDefinition): any {
    return item.stats.join("-") + item.mods.join("-") + (item.exotic?.hash || "none");
  }

  getTotalStats(result: ResultDefinition): number {
    return result.stats.reduce((sum, stat) => sum + stat, 0);
  }

  getModCost(result: ResultDefinition): number {
    // Calculate mod cost based on the number and types of mods needed
    const modCost = (result.mods || []).reduce((cost, mod) => {
      // Minor mods (5-point) cost 1 energy, major mods (10-point) cost 3 energy
      const isMinorMod = mod % 2 === 1; // odd numbers are minor mods in the enum
      return cost + (isMinorMod ? 1 : 3);
    }, 0);

    const artificeCost = (result.artifice || []).reduce((cost, mod) => {
      return cost + 1; // Artifice mods cost 1 energy each
    }, 0);

    return modCost + artificeCost;
  }

  getStatIcon(statIndex: number): string {
    return ArmorStatIconUrls[statIndex as ArmorStat];
  }

  getStatName(statIndex: number): string {
    return ArmorStatNames[statIndex as ArmorStat];
  }

  getItemStatWithMasterwork(item: ResultItem, statIndex: number): number {
    let baseStat = item.stats[statIndex];

    // Add masterwork bonus if applicable
    const isMasterworked =
      item.masterworked ||
      (item.exotic && this.configService.readonlyConfigurationSnapshot.assumeExoticsMasterworked) ||
      (!item.exotic &&
        this.configService.readonlyConfigurationSnapshot.assumeLegendariesMasterworked);

    if (isMasterworked) {
      baseStat += 2;
    }

    return baseStat;
  }

  getShortItemName(fullName: string): string {
    // Remove common prefixes and suffixes to make names shorter
    return fullName
      .replace(/^(Exotic|Legendary)\s+/, "")
      .replace(/\s+(Helmet|Gauntlets|Chest Armor|Leg Armor|Class Item)$/, "")
      .substring(0, 20);
  }

  getItemColor(item: ResultItem): string {
    if (item.masterworked) return "#ffeb3b";
    if (item.exotic) return "#ff9800";
    return "#9e9e9e";
  }

  shouldShowTooltip(text: string): boolean {
    // Show tooltip if text is longer than what we typically display
    return text != null && text.length > 20;
  }

  async copyDIMQuery(result: ResultDefinition) {
    try {
      // This would need to be implemented similar to the expanded result content
      const query = result.items.map((item) => `id:'${item.itemInstanceId}'`).join(" OR ");

      await navigator.clipboard.writeText(query);
      this.snackBar.open("DIM query copied to clipboard", "", { duration: 2000 });
    } catch (error) {
      this.snackBar.open("Failed to copy to clipboard", "", { duration: 2000 });
    }
  }

  openInDIM(result: ResultDefinition) {
    // This would need to be implemented similar to the expanded result content
    this.snackBar.open("DIM integration coming soon", "", { duration: 2000 });
  }
}
