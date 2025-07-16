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
import {
  ArmorStat,
  ArmorStatNames,
  ArmorStatIconUrls,
  StatModifier,
} from "../../../../data/enum/armor-stat";
import { ModInformation } from "src/app/data/ModInformation";
import { DimService } from "../../../../services/dim.service";
import { BungieApiService } from "../../../../services/bungie-api.service";

@Component({
  selector: "app-results-card-view",
  templateUrl: "./results-card-view.component.html",
  styleUrls: ["./results-card-view.component.scss"],
})
export class ResultsCardViewComponent implements OnChanges, OnDestroy {
  @Input() results: ResultDefinition[] = [];

  filteredResults: ResultDefinition[] = [];
  displayedResults: ResultDefinition[] = [];

  // Sorting state
  activeSortField: string | null = null;
  sortDirection: "asc" | "desc" = "desc";

  expandedCard: number | null = null;
  expandedBreakdown: number | null = null;
  isLoading = false;

  // Infinite scroll settings
  private readonly PAGE_SIZE = 25;
  private currentPage = 0;

  statOrder = [1, 5, 3, 4, 2, 0]; // Health, Melee, Grenade, Super, Class, Weapon
  Math = Math;

  private destroy$ = new Subject<void>();

  constructor(
    private snackBar: MatSnackBar,
    private configService: ConfigurationService,
    private dimService: DimService,
    private bungieApiService: BungieApiService
  ) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes["results"] && this.results) {
      this.expandedBreakdown = null; // Reset breakdown expansion on new results
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
            aValue = this.getModSortValue(a);
            bValue = this.getModSortValue(b);
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
    // Reset breakdown expansion when card is collapsed
    if (this.expandedCard !== index) {
      this.expandedBreakdown = null;
    }
  }

  toggleBreakdown(index: number) {
    this.expandedBreakdown = this.expandedBreakdown === index ? null : index;
  }

  isBreakdownExpanded(index: number): boolean {
    return this.expandedBreakdown === index;
  }

  hasBreakdownRows(result: ResultDefinition): boolean {
    return (
      this.hasConfigBonus() ||
      this.hasMinorMods(result) ||
      this.hasMajorMods(result) ||
      this.hasArtificeMods(result)
    );
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

  getModSortValue(result: ResultDefinition): number {
    // Use the same sorting logic as results.component.ts:
    // Primary sort by mod count (weighted by 100), then by mod cost
    return +100 * result.modCount + result.modCost;
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

  getMasterworkDisplay(item: ResultItem): string {
    // For armor system 3 (Armor 2.0), show masterwork level
    if (item.armorSystem === 3 && item.masterworkLevel !== undefined) {
      if (item.masterworkLevel < 5) {
        return `${item.masterworkLevel}/5`;
      } else if (item.masterworkLevel === 5) {
        return "MW"; // Fully masterworked
      }
    }
    // For other systems or when masterworked is true, show MW indicator
    if (item.masterworked) {
      return "MW";
    }
    return "";
  }

  getMasterworkTooltip(item: ResultItem): string {
    if (item.armorSystem === 3 && item.masterworkLevel !== undefined) {
      if (item.masterworkLevel < 5) {
        return `Armor 3.0 - Masterwork Level ${item.masterworkLevel}/5`;
      } else {
        return "Armor 3.0 - Fully Masterworked";
      }
    }
    if (item.masterworked) {
      return "Armor 2.0 - Masterworked";
    }
    return "";
  }

  shouldShowTooltip(text: string): boolean {
    // Show tooltip if text is longer than what we typically display
    return text != null && text.length > 20;
  }

  async copyDIMQuery(result: ResultDefinition) {
    const success = await this.dimService.copyDIMQuery(result);
    if (success) {
      this.snackBar.open("DIM query copied to clipboard", "", { duration: 2000 });
    } else {
      this.snackBar.open("Failed to copy to clipboard", "", { duration: 2000 });
    }
  }

  openInDIM(result: ResultDefinition) {
    this.dimService.openInDIM(result);
  }

  // Configuration values (fragments, subclass bonuses, etc.)
  hasConfigBonus(): boolean {
    // Check if any stat has a non-zero configuration value
    for (let i = 0; i < 6; i++) {
      if (this.getConfigValue(i) !== 0) return true;
    }
    return false;
  }

  getConfigValue(statIndex: number): number {
    let configValue = 0;
    const config = this.configService.readonlyConfigurationSnapshot;

    // Check for enabled mods and add their stat bonuses if present
    if (config.enabledMods && Array.isArray(config.enabledMods)) {
      for (const modifierId of config.enabledMods) {
        const modInfo = ModInformation[modifierId];
        if (!modInfo || !modInfo.bonus || !Array.isArray(modInfo.bonus)) continue;
        const bonus = modInfo.bonus.find((b) => b.stat === statIndex);
        if (bonus) {
          configValue += bonus.value;
        }
      }
    }

    // You can add other config-based bonuses here if needed

    return configValue;
  }

  // Minor mods methods
  hasMinorMods(result: ResultDefinition): boolean {
    if (!result.mods) return false;
    const minorMods = [
      StatModifier.MINOR_WEAPON,
      StatModifier.MINOR_HEALTH,
      StatModifier.MINOR_CLASS,
      StatModifier.MINOR_GRENADE,
      StatModifier.MINOR_SUPER,
      StatModifier.MINOR_MELEE,
    ];
    return result.mods.some((mod) => minorMods.includes(mod));
  }

  getMinorModCount(result: ResultDefinition, statIndex: number): number {
    if (!result.mods) return 0;
    const minorModForStat = [
      StatModifier.MINOR_WEAPON,
      StatModifier.MINOR_HEALTH,
      StatModifier.MINOR_CLASS,
      StatModifier.MINOR_GRENADE,
      StatModifier.MINOR_SUPER,
      StatModifier.MINOR_MELEE,
    ][statIndex];
    return result.mods.filter((mod) => mod === minorModForStat).length;
  }

  // Major mods methods
  hasMajorMods(result: ResultDefinition): boolean {
    if (!result.mods) return false;
    const majorMods = [
      StatModifier.MAJOR_WEAPON,
      StatModifier.MAJOR_HEALTH,
      StatModifier.MAJOR_CLASS,
      StatModifier.MAJOR_GRENADE,
      StatModifier.MAJOR_SUPER,
      StatModifier.MAJOR_MELEE,
    ];
    return result.mods.some((mod) => majorMods.includes(mod));
  }

  getMajorModCount(result: ResultDefinition, statIndex: number): number {
    if (!result.mods) return 0;
    const majorModForStat = [
      StatModifier.MAJOR_WEAPON,
      StatModifier.MAJOR_HEALTH,
      StatModifier.MAJOR_CLASS,
      StatModifier.MAJOR_GRENADE,
      StatModifier.MAJOR_SUPER,
      StatModifier.MAJOR_MELEE,
    ][statIndex];
    return result.mods.filter((mod) => mod === majorModForStat).length;
  }

  // Artifice mods methods
  hasArtificeMods(result: ResultDefinition): boolean {
    if (!result.artifice) return false;
    return result.artifice.length > 0;
  }

  getArtificeModCount(result: ResultDefinition, statIndex: number): number {
    if (!result.artifice) return 0;
    const artificeModForStat = [
      StatModifier.ARTIFICE_WEAPON,
      StatModifier.ARTIFICE_HEALTH,
      StatModifier.ARTIFICE_CLASS,
      StatModifier.ARTIFICE_GRENADE,
      StatModifier.ARTIFICE_SUPER,
      StatModifier.ARTIFICE_MELEE,
    ][statIndex];
    return result.artifice.filter((mod) => mod === artificeModForStat).length;
  }

  // Inventory management methods
  async moveItems(result: ResultDefinition, equip = false) {
    const moveResult = await this.bungieApiService.moveResultItems(result, equip);

    if (!moveResult.success) {
      this.snackBar.open("Error: Could not find a character to move the items to.", "", {
        duration: 3000,
      });
      return;
    }

    if (moveResult.allSuccessful) {
      this.snackBar.open("Success! Moved all the items.", "", { duration: 2000 });
    } else {
      this.snackBar.open(
        "Some of the items could not be moved. Make sure that there is enough space in the specific slot. This tool will not move items out of your inventory.",
        "",
        { duration: 4000 }
      );
    }
  }
}
