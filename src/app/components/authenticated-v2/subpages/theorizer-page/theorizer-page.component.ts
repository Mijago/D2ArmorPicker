import {
  ChangeDetectorRef,
  Component,
  NgZone,
  OnDestroy,
  OnInit,
  SkipSelf,
  ChangeDetectionStrategy,
} from "@angular/core";
import { PageEvent } from "@angular/material/paginator";
import { merge, Subject } from "rxjs";
import { skip, takeUntil } from "rxjs/operators";
import { ArmorStatNames, STAT_MOD_VALUES, StatModifier } from "../../../../data/enum/armor-stat";
import { InventoryArmorSourceNames } from "../../../../data/enum/armor-source";
import { ExoticClassItemPerkNames } from "../../../../data/exotic-class-item-spirits";
import {
  DEFAULT_T5_SEARCH_BUDGET_MS,
  createT5ProfileInput,
  groupT5Archetypes,
  groupT5Arrangements,
  reflectMainCalculationSettings,
  suggestedT5RunName,
  T5ArchetypeGroup,
  T5Arrangement,
  T5Candidate,
  T5SavedRun,
  T5_SEARCH_BUDGETS,
  T5Solution,
} from "../../../../data/theorizer";
import {
  CONFIGURATION_SCOPE,
  ConfigurationService,
} from "../../../../services/configuration.service";
import { DatabaseService } from "../../../../services/database.service";
import { T5TheorizerService, TheorizerViewState } from "../../../../services/theorizer.service";
import { STAT_REACHABILITY } from "../../../../services/stat-reachability";
import { calculateCPUConcurrency } from "../../../../data/commonFunctions";
import { T5SavedRunsService } from "../../../../services/theorizer-saved-runs.service";
import type { ArmorPoolItemView } from "../../../../services/armor-calculator.service";
import { eligibleT5Inventory, t5ItemStats } from "../../../../services/theorizer-search";
import { UserInformationService } from "../../../../services/user-information.service";

@Component({
  selector: "app-theorizer-page",
  templateUrl: "./theorizer-page.component.html",
  styleUrls: ["./theorizer-page.component.scss"],
  providers: [
    ConfigurationService,
    T5TheorizerService,
    { provide: STAT_REACHABILITY, useExisting: T5TheorizerService },
    {
      provide: CONFIGURATION_SCOPE,
      useFactory: (main: ConfigurationService) => ({
        prefix: "t5-theorizer-",
        initial: structuredClone(main.currentConfiguration),
      }),
      deps: [[new SkipSelf(), ConfigurationService]],
    },
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class TheorizerPageComponent implements OnInit, OnDestroy {
  private readonly destroyed = new Subject<void>();
  private readonly modNames = new Map<number, string>();
  private readonly setNames = new Map<number, string>();
  readonly slots = ["Helmet", "Arms", "Chest", "Legs", "Class item"];
  readonly stats = [0, 1, 2, 3, 4, 5] as const;
  readonly statNames = ArmorStatNames;
  readonly sources = InventoryArmorSourceNames;
  readonly searchBudgets = T5_SEARCH_BUDGETS;
  timeLimitMs: number = DEFAULT_T5_SEARCH_BUDGET_MS;
  readonly detectedLogicalCores = navigator.hardwareConcurrency || 4;
  readonly automaticWorkers = calculateCPUConcurrency();
  readonly workerOptions = [
    ...new Set([1, 2, 3, 4, 6, 7, 8, 12, 15, 16, 24, 31, 32, this.automaticWorkers]),
  ].sort((first, second) => first - second);
  workerLimit = 0;
  prioritizeMatches = true;
  pageIndex = 0;
  pageSize = 50;
  armorPoolItems: ArmorPoolItemView[] = [];
  itemUsageCounts = new Map<string, number>();
  armorPoolError?: string;
  private armorPoolRequest = 0;
  state?: TheorizerViewState;
  arrangements: T5Arrangement[] = [];
  archetypeGroups: T5ArchetypeGroup[] = [];
  visible: T5ArchetypeGroup[] = [];
  readonly arrangementPageSize = 10;
  private readonly arrangementPages = new Map<string, number>();
  readonly buildPageSize = 5;
  private readonly buildPages = new Map<string, number>();
  resultOrder: "flexibility" | "matches" = "flexibility";
  savedRunName = "";
  private suggestedRunName = "";
  savedRuns: Pick<T5SavedRun, "id" | "name" | "createdAt" | "complete">[] = [];
  selectedSavedRun?: number;
  savingRun = false;
  savedRunError?: string;

  constructor(
    public theorizer: T5TheorizerService,
    private config: ConfigurationService,
    @SkipSelf() private main: ConfigurationService,
    private db: DatabaseService,
    private zone: NgZone,
    private changeDetector: ChangeDetectorRef,
    private savedRunStore: T5SavedRunsService,
    private inventory: UserInformationService
  ) {
    this.main.configuration.pipe(skip(1), takeUntil(this.destroyed)).subscribe((main) => {
      this.config.modifyConfiguration((theorizer) =>
        reflectMainCalculationSettings(theorizer, main)
      );
    });
  }

  ngOnInit(): void {
    const storedBudget = localStorage.getItem("t5-theorizer-budget");
    const budget = storedBudget === null ? NaN : Number(storedBudget);
    this.timeLimitMs = this.searchBudgets.some((option) => option.value === budget)
      ? budget
      : DEFAULT_T5_SEARCH_BUDGET_MS;
    const storedWorkers = Number(localStorage.getItem("t5-theorizer-workers") || 0);
    this.workerLimit = this.workerOptions.includes(storedWorkers) ? storedWorkers : 0;
    this.prioritizeMatches = localStorage.getItem("t5-theorizer-prioritize-matches") !== "false";
    this.theorizer.setSearchOptions(
      false,
      this.timeLimitMs,
      this.workerLimit,
      this.prioritizeMatches
    );
    merge(this.config.configuration, this.inventory.inventory, this.inventory.manifest)
      .pipe(takeUntil(this.destroyed))
      .subscribe(() => {
        this.updateSuggestedRunName();
        void this.refreshArmorPool();
      });
    this.theorizer.state.pipe(takeUntil(this.destroyed)).subscribe((state) =>
      this.zone.run(() => {
        if (state.matchingComplete && !this.state?.matchingComplete) this.resultOrder = "matches";
        if (!state.done && !state.arrangements?.length && this.state?.done)
          this.resultOrder = "flexibility";
        if (
          this.state?.results !== state.results ||
          this.state?.arrangements !== state.arrangements
        ) {
          this.arrangements = groupT5Arrangements(state.results, state.arrangements);
          this.archetypeGroups = groupT5Archetypes(this.arrangements, this.resultOrder);
          this.itemUsageCounts = new Map<string, number>();
          for (const pieces of [
            ...state.results.map((result) => result.pieces),
            ...this.arrangements.map((arrangement) => arrangement.inventoryMatch?.pieces ?? []),
          ]) {
            for (const piece of pieces) {
              if (piece.instanceId)
                this.itemUsageCounts.set(
                  piece.instanceId,
                  (this.itemUsageCounts.get(piece.instanceId) ?? 0) + 1
                );
            }
          }
        }
        this.state = state;
        if (!this.arrangements.length) {
          this.buildPages.clear();
          this.arrangementPages.clear();
        }
        this.updatePage();
        this.changeDetector.markForCheck();
      })
    );
    void this.loadNames();
    void this.refreshSavedRuns();
  }

  private updateSuggestedRunName(): void {
    const configuration = this.config.currentConfiguration;
    const suggestion = suggestedT5RunName(configuration);
    if (!this.savedRunName.trim() || this.savedRunName === this.suggestedRunName)
      this.savedRunName = suggestion;
    this.suggestedRunName = suggestion;
  }

  private async refreshArmorPool(): Promise<void> {
    const request = ++this.armorPoolRequest;
    const configuration = structuredClone(this.config.currentConfiguration);
    try {
      const [items, manifest] = await Promise.all([
        this.db.inventoryArmor.where("clazz").equals(configuration.characterClass).toArray(),
        this.db.manifestArmor.toArray(),
      ]);
      if (request !== this.armorPoolRequest) return;
      this.zone.run(() => {
        this.armorPoolItems = eligibleT5Inventory(items, configuration, manifest).map((item) => ({
          item,
          pruned: false,
        }));
        this.armorPoolError = undefined;
        this.changeDetector.markForCheck();
      });
    } catch (error) {
      if (request !== this.armorPoolRequest) return;
      this.armorPoolItems = [];
      this.armorPoolError = error instanceof Error ? error.message : String(error);
      this.changeDetector.markForCheck();
    }
  }

  private async refreshSavedRuns(): Promise<void> {
    try {
      this.savedRuns = await this.savedRunStore.list();
    } catch (error) {
      this.savedRunError = error instanceof Error ? error.message : String(error);
    }
  }

  async saveRun(): Promise<void> {
    this.savingRun = true;
    this.savedRunError = undefined;
    try {
      this.selectedSavedRun = await this.savedRunStore.save(
        this.theorizer.snapshot(this.savedRunName)
      );
      await this.refreshSavedRuns();
    } catch (error) {
      this.savedRunError = error instanceof Error ? error.message : String(error);
    } finally {
      this.savingRun = false;
    }
  }

  async restoreSavedRun(): Promise<void> {
    if (this.selectedSavedRun === undefined) return;
    this.savingRun = true;
    this.savedRunError = undefined;
    try {
      const run = await this.savedRunStore.get(this.selectedSavedRun);
      this.savedRunName = run.name;
      this.timeLimitMs = run.options.timeLimitMs;
      this.workerLimit = run.options.workerLimit;
      this.prioritizeMatches = run.options.prioritizeMatches ?? true;
      this.pageIndex = 0;
      await this.theorizer.restoreRun(run);
      this.persistSearchOptions();
    } catch (error) {
      this.savedRunError = error instanceof Error ? error.message : String(error);
    } finally {
      this.savingRun = false;
    }
  }

  async deleteSavedRun(): Promise<void> {
    if (this.selectedSavedRun === undefined) return;
    this.savedRunError = undefined;
    try {
      await this.savedRunStore.remove(this.selectedSavedRun);
      this.selectedSavedRun = undefined;
      await this.refreshSavedRuns();
    } catch (error) {
      this.savedRunError = error instanceof Error ? error.message : String(error);
    }
  }

  private async loadNames(): Promise<void> {
    for (const item of await this.db.manifestArmor.toArray())
      this.modNames.set(item.hash, item.name);
    this.updateSuggestedRunName();
    for (const set of await this.db.equipableItemSetDefinition.toArray()) {
      this.setNames.set(set.hash, set.displayProperties.name || String(set.hash));
    }
  }

  search(): void {
    this.pageIndex = 0;
    this.theorizer.setSearchOptions(
      false,
      this.timeLimitMs,
      this.workerLimit,
      this.prioritizeMatches
    );
    void this.theorizer.search(false, this.timeLimitMs);
  }

  async exportProfileInput(): Promise<void> {
    this.savedRunError = undefined;
    try {
      const config = structuredClone(this.config.currentConfiguration);
      const [inventory, manifest] = await Promise.all([
        this.db.inventoryArmor.where("clazz").equals(config.characterClass).toArray(),
        this.db.manifestArmor.toArray(),
      ]);
      const input = createT5ProfileInput({
        config,
        inventory,
        manifest,
        achievableOnly: false,
        prioritizeMatches: this.prioritizeMatches,
      });
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(input)], { type: "application/json" })
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "theorizer-profile-input.json";
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      this.savedRunError = error instanceof Error ? error.message : String(error);
    }
  }

  searchOptionsChanged(): void {
    this.pageIndex = 0;
    this.persistSearchOptions();
    this.theorizer.setSearchOptions(
      false,
      this.timeLimitMs,
      this.workerLimit,
      this.prioritizeMatches
    );
  }

  private persistSearchOptions(): void {
    localStorage.setItem("t5-theorizer-budget", String(this.timeLimitMs));
    localStorage.setItem("t5-theorizer-workers", String(this.workerLimit));
    localStorage.setItem("t5-theorizer-prioritize-matches", String(this.prioritizeMatches));
  }

  copyMain(): void {
    this.config.modifyConfiguration((config) => {
      Object.assign(config, structuredClone(this.main.currentConfiguration));
      reflectMainCalculationSettings(config, this.main.currentConfiguration);
    });
  }

  page(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.updatePage();
  }

  orderChanged(): void {
    this.pageIndex = 0;
    this.archetypeGroups = groupT5Archetypes(this.arrangements, this.resultOrder);
    this.updatePage();
  }

  private updatePage(): void {
    const results = this.archetypeGroups;
    if (this.pageIndex * this.pageSize >= results.length) this.pageIndex = 0;
    this.visible = results.slice(
      this.pageIndex * this.pageSize,
      (this.pageIndex + 1) * this.pageSize
    );
  }

  trackResult(_index: number, result: T5Solution): string {
    return result.key;
  }

  trackArrangement(_index: number, arrangement: T5Arrangement): string {
    return arrangement.key;
  }

  trackArchetypeGroup(_index: number, group: T5ArchetypeGroup): string {
    return group.key;
  }

  arrangementPageIndex(group: T5ArchetypeGroup): number {
    const index = this.arrangementPages.get(group.key) ?? 0;
    return index * this.arrangementPageSize < group.arrangements.length ? index : 0;
  }

  visibleArrangements(group: T5ArchetypeGroup): T5Arrangement[] {
    const start = this.arrangementPageIndex(group) * this.arrangementPageSize;
    return group.arrangements.slice(start, start + this.arrangementPageSize);
  }

  pageArrangements(group: T5ArchetypeGroup, event: PageEvent): void {
    this.arrangementPages.set(group.key, event.pageIndex);
  }

  duration(milliseconds = 0): string {
    const seconds = Math.max(0, Math.floor(milliseconds / 1000));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  }

  buildPageIndex(arrangement: T5Arrangement): number {
    const index = this.buildPages.get(arrangement.key) ?? 0;
    return index * this.buildPageSize < arrangement.builds.length ? index : 0;
  }

  visibleBuilds(arrangement: T5Arrangement): T5Solution[] {
    const start = this.buildPageIndex(arrangement) * this.buildPageSize;
    return arrangement.builds.slice(start, start + this.buildPageSize);
  }

  pageBuilds(arrangement: T5Arrangement, event: PageEvent): void {
    this.buildPages.set(arrangement.key, event.pageIndex);
  }

  gearset(piece: T5Candidate): string {
    return piece.gearSetHash === null ? "Any gearset" : this.gearsetName(piece.gearSetHash);
  }

  baseStatsSummary(piece: T5Candidate): string {
    const values = t5ItemStats(piece);
    return this.stats
      .filter((stat) => values[stat] !== 0)
      .map((stat) => `${values[stat]} ${ArmorStatNames[stat]}`)
      .join(" / ");
  }

  gearsetName(hash: number): string {
    return this.setNames.get(hash) || String(hash);
  }

  tuningName(hash: number | null): string {
    return hash === null
      ? "No tuning"
      : this.modNames.get(hash) || (hash === 3122197216 ? "Balanced tuning" : `Tuning ${hash}`);
  }

  spiritNames(piece: T5Candidate): string {
    return (piece.exoticPerkHash ?? [])
      .map(
        (hash) =>
          ExoticClassItemPerkNames[hash as keyof typeof ExoticClassItemPerkNames] ||
          this.modNames.get(hash) ||
          String(hash)
      )
      .join(" + ");
  }

  modSummary(solution: T5Solution): string {
    return this.modAllocationSummary(solution.result);
  }

  anyTertiaryCount(arrangement: T5Arrangement): number {
    return Math.max(0, 5 - arrangement.tertiaries.reduce((sum, entry) => sum + entry.count, 0));
  }

  modAllocationSummary(allocation: {
    usedMods: readonly StatModifier[];
    usedArtifice: readonly StatModifier[];
  }): string {
    const counts = new Map<string, number>();
    for (const modifier of [...allocation.usedMods, ...allocation.usedArtifice]) {
      const [stat, value] = STAT_MOD_VALUES[modifier];
      const label = `+${value} ${ArmorStatNames[stat]}${value === 3 ? " (Artifice)" : ""}`;
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return [...counts].map(([label, count]) => `${count} x ${label}`).join(", ") || "None";
  }

  ngOnDestroy(): void {
    this.armorPoolRequest++;
    this.destroyed.next();
    this.destroyed.complete();
  }
}
