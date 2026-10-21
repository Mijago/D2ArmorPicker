import { Injectable, OnDestroy } from "@angular/core";
import { BehaviorSubject, merge, Subject, Subscription, timer } from "rxjs";
import { filter, take, takeUntil } from "rxjs/operators";
import {
  applyT5Update,
  createT5SavedRun,
  createT5ArchetypeCountTasks,
  createT5TertiaryTasks,
  prioritizeT5SearchTasks,
  DEFAULT_T5_SEARCH_BUDGET_MS,
  mergeT5SearchUpdates,
  restoreT5Arrangements,
  T5Arrangement,
  T5SavedRun,
  T5SearchRequest,
  T5SearchUpdate,
  T5Solution,
} from "../data/theorizer";
import { BuildConfiguration } from "../data/buildConfiguration";
import { ConfigurationService } from "./configuration.service";
import { DatabaseService } from "./database.service";
import { UserInformationService } from "./user-information.service";
import {
  buildT5Domains,
  prioritizeT5InventoryMatches,
  t5ArrangementRequest,
} from "./theorizer-search";
import { calculateCPUConcurrency } from "../data/commonFunctions";
import { TheorizerStatLimits } from "./theorizer-stat-limits";

function arrangementSettingsKey(config: BuildConfiguration): string {
  return JSON.stringify({
    characterClass: config.characterClass,
    minimumStatTiers: config.minimumStatTiers,
    statModLimits: config.statModLimits,
    selectedModElement: config.selectedModElement,
    enabledMods: [...config.enabledMods].sort((first, second) => first - second),
  });
}

function fitSettingsKey(config: BuildConfiguration): string {
  return JSON.stringify({
    characterClass: config.characterClass,
    selectedExotics: config.selectedExotics,
    selectedExoticPerks: config.selectedExoticPerks,
    armorRequirements: config.armorRequirements,
    includeCollectionRolls: config.includeCollectionRolls,
    includeVendorRolls: config.includeVendorRolls,
    ignoreSunsetArmor: config.ignoreSunsetArmor,
    enforceFeaturedLegendaryArmor: config.enforceFeaturedLegendaryArmor,
    enforceFeaturedExoticArmor: config.enforceFeaturedExoticArmor,
    assumeLegendariesMasterworked: config.assumeLegendariesMasterworked,
    assumeExoticsMasterworked: config.assumeExoticsMasterworked,
    onlyUseMasterworkedLegendaries: config.onlyUseMasterworkedLegendaries,
    onlyUseMasterworkedExotics: config.onlyUseMasterworkedExotics,
    calculateTierFiveTuning: config.calculateTierFiveTuning,
    addConstent1Health: config.addConstent1Health,
  });
}

export interface TheorizerViewState extends T5SearchUpdate {
  running: boolean;
  stale: boolean;
  cancelled: boolean;
  waitingForInventory?: boolean;
  arrangementsPaused?: boolean;
  restoredRunName?: string;
  buildWorkersActive?: number;
  buildWorkersTotal?: number;
  buildTasksQueued?: number;
}

function emptyState(): TheorizerViewState {
  return {
    results: [],
    checked: 0,
    total: 0,
    feasible: 0,
    evaluations: 0,
    complete: false,
    done: false,
    warnings: [],
    running: false,
    stale: false,
    cancelled: false,
  };
}

interface BuildTask {
  arrangement: T5Arrangement;
  partition: { index: number; count: number };
}

interface BuildWorkerSlot {
  worker?: Worker;
  initialized: boolean;
  task?: BuildTask;
  watchdog?: ReturnType<typeof setTimeout>;
  deadline?: ReturnType<typeof setTimeout>;
}

@Injectable()
export class T5TheorizerService implements OnDestroy {
  private readonly destroyed = new Subject<void>();
  private readonly view = new BehaviorSubject<TheorizerViewState>(emptyState());
  readonly state = this.view.asObservable();
  private readonly targetLimits = new TheorizerStatLimits();
  readonly reachableTiers = this.targetLimits.reachableTiers;
  readonly limitsState = this.targetLimits.state;
  private workers: Worker[] = [];
  private generation = 0;
  private responseTimeouts: ReturnType<typeof setTimeout>[] = [];
  private progressClock?: Subscription;
  private readonly options = new BehaviorSubject<{
    achievableOnly: boolean;
    timeLimitMs: number;
    workerLimit: number;
    prioritizeMatches: boolean;
  }>({
    achievableOnly: false,
    timeLimitMs: DEFAULT_T5_SEARCH_BUDGET_MS,
    workerLimit: 0,
    prioritizeMatches: true,
  });
  private refreshWait?: Subscription;
  private searchState = emptyState();
  private cachedRequest?: T5SearchRequest;
  private buildWorker?: Worker;
  private buildWorkers: BuildWorkerSlot[] = [];
  private buildQueue: BuildTask[] = [];
  private get activeBuild(): boolean {
    return this.buildWorkers.some((slot) => !!slot.task);
  }
  private discoveryPaused = false;
  private resumeDiscovery?: () => void;
  private pauseDiscoveryClock?: (pause: boolean) => void;
  private inventoryMatchingStarted = false;
  private inventoryMatches = new Map<string, NonNullable<T5Arrangement["inventoryMatch"]>>();
  private matchingQueue: T5Arrangement[] = [];
  private pendingBuilds = new Map<string, T5Arrangement>();
  private matchingTotal = 0;
  private matchingWatchdog?: ReturnType<typeof setTimeout>;
  private restoring = false;
  private arrangementSettingsSnapshot?: string;
  private fitSettingsSnapshot?: string;
  private fitGeneration = 0;
  private fitRefreshRequest = 0;
  private fitRefreshPending = false;
  private buildJobs = new Map<
    string,
    {
      state: T5Arrangement["buildState"];
      results: T5Solution[];
      partitions: Map<number, T5Solution[]>;
      remaining: number;
      partial: boolean;
      error?: string;
    }
  >();

  constructor(
    private config: ConfigurationService,
    private db: DatabaseService,
    private inventory: UserInformationService
  ) {
    const initialConfiguration = this.config.currentConfiguration;
    if (initialConfiguration) {
      this.arrangementSettingsSnapshot = arrangementSettingsKey(initialConfiguration);
      this.fitSettingsSnapshot = fitSettingsKey(initialConfiguration);
    }
    this.config.configuration.pipe(takeUntil(this.destroyed)).subscribe((configuration) => {
      this.targetLimits.configure(configuration);
      const arrangementKey = arrangementSettingsKey(configuration);
      const fitKey = fitSettingsKey(configuration);
      const arrangementChanged =
        this.arrangementSettingsSnapshot !== undefined &&
        this.arrangementSettingsSnapshot !== arrangementKey;
      const fitChanged =
        this.fitSettingsSnapshot !== undefined && this.fitSettingsSnapshot !== fitKey;
      this.arrangementSettingsSnapshot = arrangementKey;
      this.fitSettingsSnapshot = fitKey;
      if (this.restoring) return;
      if (arrangementChanged) this.invalidate();
      else if (fitChanged) void this.refreshFit();
    });
    merge(this.inventory.inventory, this.inventory.manifest)
      .pipe(
        filter(() => !this.restoring && !this.view.value.waitingForInventory),
        takeUntil(this.destroyed)
      )
      .subscribe(() => void this.refreshFit());
  }

  validateTargets(config: BuildConfiguration): Promise<boolean> {
    return this.targetLimits.validate(config);
  }

  retryLimits(): void {
    this.targetLimits.refresh();
  }

  setSearchOptions(
    achievableOnly: boolean,
    timeLimitMs: number,
    workerLimit = this.options.value.workerLimit,
    prioritizeMatches = this.options.value.prioritizeMatches
  ): void {
    workerLimit = Number.isFinite(workerLimit)
      ? Math.max(0, Math.min(64, Math.floor(workerLimit)))
      : 0;
    if (
      this.options.value.achievableOnly === achievableOnly &&
      this.options.value.timeLimitMs === timeLimitMs &&
      this.options.value.workerLimit === workerLimit &&
      this.options.value.prioritizeMatches === prioritizeMatches
    )
      return;
    this.options.next({ achievableOnly, timeLimitMs, workerLimit, prioritizeMatches });
  }

  private invalidate(): void {
    this.cancel();
    this.view.next({
      ...this.view.value,
      stale: !!(this.view.value.done || this.view.value.results.length),
      maximumPossibleStats: Array(6).fill(200),
      maximaChecked: 0,
      maximaComplete: false,
    });
  }

  cancel(): void {
    this.generation++;
    this.fitRefreshRequest++;
    this.fitRefreshPending = false;
    this.restoring = false;
    this.refreshWait?.unsubscribe();
    this.refreshWait = undefined;
    this.progressClock?.unsubscribe();
    this.progressClock = undefined;
    this.responseTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.responseTimeouts = [];
    this.workers.forEach((worker) => worker.terminate());
    this.workers = [];
    this.stopFitWork();
    this.cachedRequest = undefined;
    this.discoveryPaused = false;
    this.resumeDiscovery = undefined;
    this.pauseDiscoveryClock = undefined;
    if (this.view.value.running || this.view.value.buildWorkersActive || this.view.value.matching)
      this.view.next({
        ...this.view.value,
        running: false,
        cancelled: true,
        complete: false,
        done: true,
        waitingForInventory: false,
        workersActive: 0,
        buildWorkersActive: 0,
        buildTasksQueued: 0,
        matching: false,
        arrangementsPaused: false,
        arrangements: this.view.value.arrangements?.map((arrangement) => ({
          ...arrangement,
          buildState:
            arrangement.buildState === "loading" || arrangement.buildState === "queued"
              ? "partial"
              : arrangement.buildState,
        })),
      });
  }

  private stopFitWork(): void {
    this.fitGeneration++;
    if (this.discoveryPaused) this.pauseDiscoveryClock?.(false);
    const resumeDiscovery = this.discoveryPaused ? this.resumeDiscovery : undefined;
    this.discoveryPaused = false;
    resumeDiscovery?.();
    this.buildWorker?.terminate();
    this.buildWorker = undefined;
    for (const slot of this.buildWorkers) {
      slot.worker?.terminate();
      clearTimeout(slot.watchdog);
      clearTimeout(slot.deadline);
    }
    this.buildWorkers = [];
    this.buildQueue = [];
    this.inventoryMatchingStarted = false;
    this.inventoryMatches.clear();
    this.matchingQueue = [];
    this.pendingBuilds.clear();
    this.matchingTotal = 0;
    clearTimeout(this.matchingWatchdog);
    this.buildJobs.clear();
  }

  private async refreshFit(): Promise<void> {
    if (!this.cachedRequest) return;
    const request = ++this.fitRefreshRequest;
    this.fitRefreshPending = true;
    this.stopFitWork();
    this.searchState = {
      ...this.searchState,
      matching: false,
      matchingComplete: false,
      matchingFinished: 0,
      matchingTotal: 0,
      arrangements: this.searchState.arrangements?.map((arrangement) => ({
        ...arrangement,
        inventoryMatch: undefined,
        builds: [],
        buildState: "idle",
        buildError: undefined,
      })),
    };
    this.publishBuilds();
    try {
      const config = structuredClone(this.config.currentConfiguration);
      this.cachedRequest = { ...this.cachedRequest, config };
      const [inventory, manifest] = await Promise.all([
        this.db.inventoryArmor.where("clazz").equals(config.characterClass).toArray(),
        this.db.manifestArmor.toArray(),
      ]);
      if (request !== this.fitRefreshRequest || !this.cachedRequest) return;
      this.cachedRequest = { ...this.cachedRequest, config, inventory, manifest };
      this.fitRefreshPending = false;
      this.startInventoryMatching();
    } catch (error) {
      if (request !== this.fitRefreshRequest) return;
      this.fitRefreshPending = false;
      this.searchState = {
        ...this.searchState,
        matching: false,
        matchingComplete: false,
        warnings: [
          ...this.searchState.warnings,
          error instanceof Error ? error.message : String(error),
        ],
      };
      this.publishBuilds();
    }
  }

  snapshot(name: string): T5SavedRun {
    if (this.view.value.stale)
      throw new Error("Results are out of date. Recalculate before saving.");
    if (!this.searchState.arrangements?.length)
      throw new Error("There are no arrangements to save yet.");
    return createT5SavedRun(
      name,
      this.cachedRequest?.config ?? this.config.currentConfiguration,
      this.options.value,
      this.searchState.arrangements,
      this.searchState.complete
    );
  }

  async restoreRun(run: T5SavedRun): Promise<void> {
    if (run.schemaVersion !== 1) throw new Error("This saved run uses an unsupported format.");
    this.cancel();
    this.restoring = true;
    const generation = this.generation;
    this.config.modifyConfiguration((configuration) =>
      Object.assign(configuration, structuredClone(run.configuration))
    );
    this.options.next({ ...run.options, prioritizeMatches: run.options.prioritizeMatches ?? true });
    this.searchState = {
      ...emptyState(),
      arrangements: restoreT5Arrangements(run.arrangements),
      done: true,
      complete: run.complete,
      feasible: run.arrangements.length,
      restoredRunName: run.name,
      workersActive: 0,
      workersTotal: 0,
    };
    this.publishBuilds();
    const hydrate = async () => {
      try {
        const config = structuredClone(run.configuration);
        const inventory = await this.db.inventoryArmor
          .where("clazz")
          .equals(config.characterClass)
          .toArray();
        const manifest = await this.db.manifestArmor.toArray();
        if (generation !== this.generation) return;
        if (!manifest.length) throw new Error("The armor manifest is not loaded yet.");
        this.cachedRequest = {
          config,
          inventory,
          manifest,
          ...run.options,
          wasmUrl: new URL("assets/highs.wasm", document.baseURI).href,
          stage: "arrangements",
        };
        this.searchState = { ...this.searchState, waitingForInventory: false };
        this.publishBuilds();
        this.startInventoryMatching();
        this.restoring = false;
      } catch (error) {
        if (generation !== this.generation) return;
        this.restoring = false;
        this.searchState = {
          ...this.searchState,
          waitingForInventory: false,
          error: error instanceof Error ? error.message : String(error),
        };
        this.publishBuilds();
      }
    };
    if (this.inventory.isFetchingManifest || this.inventory.isRefreshing) {
      this.searchState = { ...this.searchState, waitingForInventory: true };
      this.publishBuilds();
      this.refreshWait = timer(100, 100)
        .pipe(
          filter(() => !this.inventory.isFetchingManifest && !this.inventory.isRefreshing),
          take(1),
          takeUntil(this.destroyed)
        )
        .subscribe(() => {
          if (generation === this.generation) void hydrate();
        });
      return;
    }
    await hydrate();
  }

  async search(achievableOnly: boolean, timeLimitMs: number, group?: T5Solution): Promise<void> {
    this.cancel();
    const generation = this.generation;
    this.view.next({
      ...this.view.value,
      running: true,
      done: false,
      cancelled: false,
      stale: this.view.value.results.length > 0,
      error: undefined,
      waitingForInventory: false,
    });
    try {
      if (this.inventory.isFetchingManifest || this.inventory.isRefreshing) {
        this.view.next({ ...this.view.value, waitingForInventory: true });
        this.refreshWait = timer(100, 100)
          .pipe(
            filter(() => !this.inventory.isFetchingManifest && !this.inventory.isRefreshing),
            take(1),
            takeUntil(this.destroyed)
          )
          .subscribe(() => {
            if (generation === this.generation)
              void this.search(achievableOnly, timeLimitMs, group);
          });
        return;
      }
      const config = structuredClone(this.config.currentConfiguration);
      const inventory = await this.db.inventoryArmor
        .where("clazz")
        .equals(config.characterClass)
        .toArray();
      const manifest = await this.db.manifestArmor.toArray();
      if (generation !== this.generation) return;
      if (this.inventory.isFetchingManifest || this.inventory.isRefreshing) {
        void this.search(achievableOnly, timeLimitMs, group);
        return;
      }
      if (!manifest.length) throw new Error("The armor manifest is not loaded yet.");
      const latestConfig = structuredClone(this.config.currentConfiguration);
      const request: T5SearchRequest = {
        config: latestConfig,
        inventory,
        manifest,
        achievableOnly,
        stage: "arrangements",
        timeLimitMs,
        group: group?.pieces.map((piece) => piece.archetype),
        wasmUrl: new URL("assets/highs.wasm", document.baseURI).href,
      };
      this.cachedRequest = request;
      const arrangementRequest = t5ArrangementRequest(request);
      const domains = buildT5Domains(arrangementRequest);
      const fitDomains = buildT5Domains(request);
      const choices = domains.map((domain, slot) =>
        [...domain.keys()].filter((key) => !request.group || key === request.group[slot])
      );
      const sourceArchetypes = fitDomains.map(
        (domain, slot) =>
          new Set(choices[slot].filter((key) => domain.get(key)?.some((item) => !!item.instanceId)))
      );
      const archetypes = [...new Set(choices.flat())];
      const tertiaryChoices = new Map(
        archetypes.map((name) => [
          name,
          [
            ...new Set(
              domains.flatMap((domain) => domain.get(name) ?? []).map((piece) => piece.tertiary)
            ),
          ],
        ])
      );
      const prioritizeMatches = this.options.value.prioritizeMatches;
      const countTasks = createT5ArchetypeCountTasks(archetypes);
      const tasks = prioritizeMatches
        ? prioritizeT5SearchTasks(countTasks, sourceArchetypes)
        : countTasks;
      const pendingTasks = tasks.map((_, index) => index);
      const taskOwners = new Map<number, number>();
      const deferredTasks = new Set<number>();
      const requestedWorkers = this.options.value.workerLimit || calculateCPUConcurrency();
      const workerCount = group ? 1 : Math.min(requestedWorkers, Math.max(1, tasks.length));
      const workerResponseTimeoutMs = Math.min(60_000, Math.max(15_000, workerCount * 2_000));
      const maximaUpdates: (T5SearchUpdate | undefined)[] = Array(workerCount).fill(undefined);
      const taskUpdates: (T5SearchUpdate | undefined)[] = Array(tasks.length).fill(undefined);
      const assignments: (number | null)[] = Array(workerCount).fill(null);
      const sliceStartedFeasible: number[] = Array(workerCount).fill(0);
      const active = Array<boolean>(workerCount).fill(true);
      const prepared = Array<boolean>(workerCount).fill(false);
      const failed = Array<boolean>(workerCount).fill(false);
      const dispatchers: (() => void)[] = [];
      let budgetExpired = false;
      const started = Date.now();
      let pausedAt: number | undefined;
      let pausedMs = 0;
      const elapsed = () =>
        Date.now() - started - pausedMs - (pausedAt === undefined ? 0 : Date.now() - pausedAt);
      this.pauseDiscoveryClock = (pause) => {
        if (pause && pausedAt === undefined) pausedAt = Date.now();
        else if (!pause && pausedAt !== undefined) {
          pausedMs += Date.now() - pausedAt;
          pausedAt = undefined;
        }
      };
      const publish = () => {
        if (generation !== this.generation) return;
        const contributions = [
          ...maximaUpdates
            .filter((update): update is T5SearchUpdate => !!update)
            .map((update) => ({
              ...update,
              checked: 0,
              total: 0,
              feasible: 0,
              evaluations: 0,
              results: [],
              arrangements: [],
              possibleRollCombinations: 0,
            })),
          ...taskUpdates.filter((update): update is T5SearchUpdate => !!update),
        ];
        const data = mergeT5SearchUpdates(
          contributions,
          contributions.length,
          elapsed(),
          timeLimitMs,
          config.parsedResultLimit
        );
        const workersActive = active.filter(Boolean).length;
        const done =
          budgetExpired || (workersActive === 0 && (!pendingTasks.length || failed.every(Boolean)));
        data.done = done;
        data.complete =
          done &&
          !budgetExpired &&
          !failed.some(Boolean) &&
          !pendingTasks.length &&
          taskUpdates.every((update) => !!update?.complete);
        data.stopReason = done
          ? budgetExpired
            ? "budget"
            : failed.some(Boolean)
              ? "error"
              : "exhausted"
          : undefined;
        data.total = choices.reduce((product, slot) => product * slot.length, 1);
        data.workersTotal = workerCount;
        data.workersActive = workersActive;
        data.workersFinished = workerCount - workersActive;
        data.tasksTotal = tasks.length;
        data.tasksFinished = taskUpdates.filter((update) => update?.done).length;
        data.tasksQueued = pendingTasks.length;
        data.tasksDeferred = deferredTasks.size;
        data.maximaChecked = Math.min(
          ...maximaUpdates.map((update) => update?.maximaChecked ?? (update?.done ? 6 : 0))
        );
        data.maximaComplete = maximaUpdates.every(
          (update) => !!update && (update.maximaComplete || (update.done && update.total === 0))
        );
        this.searchState = { ...data, running: !data.done, stale: false, cancelled: false };
        this.publishBuilds();
        if (data.done) {
          this.progressClock?.unsubscribe();
          this.startInventoryMatching();
        }
      };
      publish();
      this.progressClock = timer(250, 250)
        .pipe(takeUntil(this.destroyed))
        .subscribe(() => {
          if (generation !== this.generation || !this.view.value.running) return;
          const elapsedMs = elapsed();
          if (timeLimitMs > 0 && elapsedMs >= timeLimitMs) {
            for (let index = 0; index < workerCount; index++) {
              if (!active[index]) continue;
              this.workers[index]?.terminate();
              clearTimeout(this.responseTimeouts[index]);
              active[index] = false;
              const task = assignments[index];
              if (task !== null)
                taskUpdates[task] = {
                  ...emptyState(),
                  ...taskUpdates[task],
                  done: true,
                  complete: false,
                  stopReason: "budget",
                };
            }
            budgetExpired = true;
            publish();
            return;
          }
          this.searchState = {
            ...this.searchState,
            elapsedMs,
            budgetProgress:
              timeLimitMs > 0 ? Math.min(100, (elapsedMs / timeLimitMs) * 100) : undefined,
          };
          this.publishBuilds();
        });
      for (let index = 0; index < workerCount; index++) {
        const worker = new Worker(new URL("./theorizer.worker", import.meta.url), {
          name: `theorizer-${index + 1}`,
          type: "module",
        });
        this.workers.push(worker);
        const fail = (message: string) => {
          if (generation !== this.generation || failed[index]) return;
          clearTimeout(this.responseTimeouts[index]);
          worker.terminate();
          active[index] = false;
          failed[index] = true;
          const failure = {
            ...emptyState(),
            done: true,
            complete: false,
            error: message,
            stopReason: "error" as const,
          };
          const task = assignments[index];
          if (task === null) maximaUpdates[index] = { ...maximaUpdates[index], ...failure };
          else taskUpdates[task] = { ...taskUpdates[task], ...failure };
          for (const [ownedTask, owner] of taskOwners) {
            if (owner !== index) continue;
            taskUpdates[ownedTask] = { ...taskUpdates[ownedTask], ...failure };
            const pending = pendingTasks.indexOf(ownedTask);
            if (pending >= 0) pendingTasks.splice(pending, 1);
            taskOwners.delete(ownedTask);
            deferredTasks.delete(ownedTask);
          }
          publish();
        };
        const watchResponse = () => {
          clearTimeout(this.responseTimeouts[index]);
          this.responseTimeouts[index] = setTimeout(
            () =>
              fail(
                `A theorizer worker stopped responding after ${workerResponseTimeoutMs / 1000}s. Partial results are retained.`
              ),
            workerResponseTimeoutMs
          );
        };
        const dispatch = () => {
          if (generation !== this.generation || budgetExpired || failed[index]) return;
          if (this.discoveryPaused) {
            assignments[index] = null;
            active[index] = false;
            clearTimeout(this.responseTimeouts[index]);
            publish();
            this.startNextBuild();
            return;
          }
          const held = [...taskOwners.values()].filter((owner) => owner === index).length;
          const available = (task: number) =>
            taskOwners.has(task)
              ? taskOwners.get(task) === index
              : tasks[task].archetypes.length < choices.length || held < 4;
          let pending = pendingTasks.findIndex(
            (task) => !deferredTasks.has(task) && available(task)
          );
          if (pending < 0) pending = pendingTasks.findIndex(available);
          if (pending < 0) {
            assignments[index] = null;
            active[index] = false;
            clearTimeout(this.responseTimeouts[index]);
            publish();
            return;
          }
          const task = pendingTasks.splice(pending, 1)[0];
          deferredTasks.delete(task);
          assignments[index] = task;
          sliceStartedFeasible[index] = taskUpdates[task]?.feasible ?? 0;
          active[index] = true;
          const remaining = timeLimitMs > 0 ? Math.max(1, timeLimitMs - elapsed()) : 0;
          const canSplit = tasks[task].archetypeCounts
            ? !tasks[task].tertiaries
            : tasks[task].archetypes.length < choices.length;
          const quantum = tasks[task].archetypeCounts ? 4000 : canSplit ? 2000 : 4000;
          const slice = Math.min(quantum, remaining || quantum);
          if (!canSplit) taskOwners.set(task, index);
          worker.postMessage({ type: "task", task: tasks[task], timeLimitMs: slice });
          watchResponse();
          publish();
        };
        dispatchers[index] = dispatch;
        watchResponse();
        worker.onmessage = ({ data }: MessageEvent<T5SearchUpdate>) => {
          if (generation !== this.generation || failed[index] || budgetExpired) return;
          const task = assignments[index];
          if (!prepared[index]) maximaUpdates[index] = applyT5Update(maximaUpdates[index], data);
          else if (task !== null) taskUpdates[task] = applyT5Update(taskUpdates[task], data);
          if (data.done) {
            clearTimeout(this.responseTimeouts[index]);
            prepared[index] = true;
            if (data.error) {
              fail(data.error);
              return;
            }
            if (task !== null && data.stopReason === "slice") {
              taskUpdates[task] = { ...taskUpdates[task]!, done: false, complete: false };
              if (
                data.taskDeferred ||
                (taskUpdates[task]?.feasible ?? 0) <= sliceStartedFeasible[index]
              )
                deferredTasks.add(task);
              else deferredTasks.delete(task);
              pendingTasks.push(task);
              dispatch();
              return;
            }
            if (task !== null) {
              taskOwners.delete(task);
              deferredTasks.delete(task);
            }
            if (
              task !== null &&
              data.stopReason === "budget" &&
              (tasks[task].archetypeCounts
                ? !tasks[task].tertiaries
                : tasks[task].archetypes.length < choices.length) &&
              (timeLimitMs === 0 || elapsed() < timeLimitMs)
            ) {
              const prefix = tasks[task].archetypes;
              const subtasks = tasks[task].archetypeCounts
                ? createT5TertiaryTasks(
                    { ...tasks[task], excludedArrangements: taskUpdates[task]?.arrangements ?? [] },
                    tertiaryChoices
                  )
                : choices[prefix.length].map((archetype) => ({
                    archetypes: [...prefix, archetype],
                  }));
              for (const subtask of subtasks) {
                pendingTasks.push(tasks.length);
                tasks.push(subtask);
              }
              taskUpdates.push(...subtasks.map(() => undefined));
              if (prioritizeMatches) {
                const taskIds = new Map(pendingTasks.map((task) => [tasks[task], task]));
                const pending = prioritizeT5SearchTasks(
                  pendingTasks.map((task) => tasks[task]),
                  sourceArchetypes
                );
                pendingTasks.length = 0;
                for (const pendingTask of pending) pendingTasks.push(taskIds.get(pendingTask)!);
              }
              taskUpdates[task] = {
                ...taskUpdates[task]!,
                complete: true,
                stopReason: "exhausted",
              };
              for (let idle = 0; idle < workerCount; idle++) {
                if (idle !== index && prepared[idle] && !active[idle] && !failed[idle])
                  dispatchers[idle]?.();
              }
            }
            dispatch();
            return;
          }
          watchResponse();
          publish();
        };
        worker.onerror = (event) =>
          fail(event.message || "A theorizer worker could not load. Partial results are retained.");
        worker.onmessageerror = () =>
          fail("A theorizer worker sent an unreadable update. Partial results are retained.");
        worker.postMessage({
          ...request,
          stage: "maxima",
          partition: { index, count: workerCount },
        });
      }
      this.resumeDiscovery = () => {
        if (generation !== this.generation || budgetExpired) return;
        this.discoveryPaused = false;
        for (let index = 0; index < workerCount; index++) {
          if (prepared[index] && !active[index] && !failed[index]) dispatchers[index]?.();
        }
      };
    } catch (error) {
      if (generation !== this.generation) return;
      this.progressClock?.unsubscribe();
      this.responseTimeouts.forEach((timeout) => clearTimeout(timeout));
      this.workers.forEach((worker) => worker.terminate());
      this.workers = [];
      this.view.next({
        ...emptyState(),
        done: true,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private publishBuilds(): void {
    const results = [
      ...this.searchState.results,
      ...[...this.buildJobs.values()].flatMap((job) => job.results),
    ];
    const arrangements = this.searchState.arrangements?.map((arrangement) => {
      const job = this.buildJobs.get(arrangement.key);
      return {
        ...arrangement,
        inventoryMatch: this.inventoryMatches.get(arrangement.key) ?? arrangement.inventoryMatch,
        buildState: job?.state ?? (this.pendingBuilds.has(arrangement.key) ? "queued" : "idle"),
        buildError: job?.error,
      } as T5Arrangement;
    });
    this.view.next({
      ...this.searchState,
      results,
      arrangements,
      arrangementsPaused: this.discoveryPaused,
      buildWorkersActive: this.buildWorkers.filter((slot) => !!slot.task).length,
      buildWorkersTotal: this.buildWorkers.length,
      buildTasksQueued: this.buildQueue.length,
    });
  }

  private startInventoryMatching(): void {
    if (
      this.inventoryMatchingStarted ||
      this.fitRefreshPending ||
      !this.cachedRequest ||
      !this.searchState.done ||
      this.activeBuild ||
      this.discoveryPaused
    )
      return;
    const arrangements = this.searchState.arrangements ?? [];
    if (!arrangements.length) return;
    this.inventoryMatchingStarted = true;
    const fitDomains = buildT5Domains(this.cachedRequest);
    this.matchingQueue = prioritizeT5InventoryMatches(arrangements, fitDomains).map(
      (arrangement) => ({ ...arrangement, builds: [] })
    );
    this.matchingTotal = arrangements.length;
    this.searchState = {
      ...this.searchState,
      matching: true,
      matchingFinished: 0,
      matchingTotal: this.matchingTotal,
      matchingComplete: false,
    };
    this.publishBuilds();
    this.runInventoryMatchingBatch();
  }

  private runInventoryMatchingBatch(): void {
    if (!this.cachedRequest) return;
    const batch = this.matchingQueue.splice(0, 32);
    if (!batch.length) {
      this.searchState = { ...this.searchState, matching: false, matchingComplete: true };
      this.publishBuilds();
      this.startNextBuild();
      return;
    }
    const generation = this.generation;
    const fitGeneration = this.fitGeneration;
    try {
      const initialize = !this.buildWorker;
      const worker =
        this.buildWorker ??
        new Worker(new URL("./theorizer.worker", import.meta.url), {
          name: "theorizer-inventory-fit",
          type: "module",
        });
      this.buildWorker = worker;
      const fail = (message: string) => {
        clearTimeout(this.matchingWatchdog);
        worker.terminate();
        this.buildWorker = undefined;
        if (generation !== this.generation || fitGeneration !== this.fitGeneration) return;
        this.searchState = {
          ...this.searchState,
          matching: false,
          matchingComplete: false,
          warnings: [...this.searchState.warnings, message],
        };
        this.publishBuilds();
        this.startNextBuild();
      };
      const watch = () => {
        clearTimeout(this.matchingWatchdog);
        this.matchingWatchdog = setTimeout(
          () => fail("Inventory fitting stopped responding; verified matches are retained."),
          15000
        );
      };
      worker.onmessage = ({ data }: MessageEvent<T5SearchUpdate>) => {
        if (generation !== this.generation || fitGeneration !== this.fitGeneration) return;
        for (const entry of data.inventoryMatches ?? []) {
          this.inventoryMatches.set(entry.key, entry.match);
          const pending = this.pendingBuilds.get(entry.key);
          if (pending && entry.match.covered >= 4) {
            this.pendingBuilds.delete(entry.key);
            this.enqueueBuild(pending);
          } else if (pending && entry.match.covered < 3) {
            this.pendingBuilds.delete(entry.key);
          }
        }
        const rejected = new Set(
          (data.inventoryMatches ?? [])
            .filter((entry) => entry.match.covered < 3)
            .map((entry) => entry.key)
        );
        this.buildQueue = this.buildQueue.filter((task) => !rejected.has(task.arrangement.key));
        for (const key of rejected) this.buildJobs.delete(key);
        this.searchState = {
          ...this.searchState,
          matchingFinished: this.inventoryMatches.size,
          matchingTotal: this.matchingTotal,
        };
        this.publishBuilds();
        this.startNextBuild();
        if (data.error) fail(data.error);
        else if (data.done) {
          clearTimeout(this.matchingWatchdog);
          this.runInventoryMatchingBatch();
        } else watch();
      };
      worker.onerror = (event) => fail(event.message || "Inventory fitting could not start.");
      worker.onmessageerror = () => fail("Inventory fitting sent an unreadable update.");
      watch();
      worker.postMessage(
        initialize
          ? {
              ...this.cachedRequest,
              stage: "matches",
              matchArrangements: batch,
              partition: undefined,
              task: undefined,
              group: undefined,
            }
          : { type: "matches", arrangements: batch }
      );
    } catch (error) {
      clearTimeout(this.matchingWatchdog);
      this.buildWorker?.terminate();
      this.buildWorker = undefined;
      this.searchState = {
        ...this.searchState,
        matching: false,
        matchingComplete: false,
        warnings: [
          ...this.searchState.warnings,
          error instanceof Error ? error.message : String(error),
        ],
      };
      this.publishBuilds();
    }
  }

  async loadBuilds(arrangement: T5Arrangement): Promise<void> {
    this.loadBuildGroup([arrangement]);
  }

  loadBuildGroup(arrangements: readonly T5Arrangement[]): void {
    if (this.view.value.stale || !this.cachedRequest) return;
    let added = false;
    for (const arrangement of arrangements) {
      if (this.buildJobs.has(arrangement.key)) continue;
      const pending = this.pendingBuilds.get(arrangement.key);
      const candidate = pending ?? arrangement;
      const match = this.inventoryMatches.get(arrangement.key) ?? candidate.inventoryMatch;
      if (pending && (!this.searchState.matchingComplete || !match)) continue;
      if (match && match.covered < 3) {
        this.pendingBuilds.delete(arrangement.key);
        continue;
      }
      if (pending) this.pendingBuilds.delete(arrangement.key);
      if (this.searchState.running || this.searchState.matching) {
        if (!match || match.covered < 4) {
          this.pendingBuilds.set(arrangement.key, { ...candidate, builds: [] });
          added = true;
          continue;
        }
      }
      added = this.enqueueBuild(candidate) || added;
    }
    if (!added) return;
    this.publishBuilds();
    this.startNextBuild();
  }

  private enqueueBuild(arrangement: T5Arrangement): boolean {
    if (this.buildJobs.has(arrangement.key)) return false;
    const match = this.inventoryMatches.get(arrangement.key) ?? arrangement.inventoryMatch;
    if (match && match.covered < 3) return false;
    const count = this.options.value.workerLimit || calculateCPUConcurrency();
    this.buildJobs.set(arrangement.key, {
      state: "queued",
      results: [],
      partitions: new Map(),
      remaining: count,
      partial: false,
    });
    for (let index = 0; index < count; index++) {
      this.buildQueue.push({
        arrangement: { ...arrangement, builds: [] },
        partition: { index, count },
      });
    }
    if (this.searchState.running) this.discoveryPaused = true;
    return true;
  }

  private startNextBuild(): void {
    if (!this.cachedRequest || (this.searchState.workersActive ?? 0) > 0) return;
    const selectedWorkers = this.options.value.workerLimit || calculateCPUConcurrency();
    const fitWorkerReservation = this.searchState.matching ? 1 : 0;
    const limit = Math.max(0, selectedWorkers - fitWorkerReservation);
    while (
      this.buildQueue.length &&
      this.buildWorkers.filter((slot) => !!slot.task).length < limit
    ) {
      let slot = this.buildWorkers.find((entry) => !entry.task);
      if (!slot) {
        slot = { initialized: false };
        this.buildWorkers.push(slot);
      }
      this.runBuildTask(slot, this.buildQueue.shift()!);
    }
    if (!this.buildQueue.length && !this.activeBuild && this.discoveryPaused) {
      this.pauseDiscoveryClock?.(false);
      this.discoveryPaused = false;
      this.resumeDiscovery?.();
      this.publishBuilds();
      this.startInventoryMatching();
    }
  }

  private runBuildTask(slot: BuildWorkerSlot, task: BuildTask): void {
    if (!this.cachedRequest) return;
    const { arrangement, partition } = task;
    const generation = this.generation;
    const fitGeneration = this.fitGeneration;
    const job = this.buildJobs.get(arrangement.key)!;
    slot.task = task;
    job.state = "loading";
    this.pauseDiscoveryClock?.(true);
    this.publishBuilds();
    const finish = (state: T5Arrangement["buildState"], error?: string, discardWorker = false) => {
      clearTimeout(slot.watchdog);
      clearTimeout(slot.deadline);
      if (
        generation !== this.generation ||
        fitGeneration !== this.fitGeneration ||
        slot.task !== task
      )
        return;
      if (discardWorker) {
        slot.worker?.terminate();
        slot.worker = undefined;
        slot.initialized = false;
      }
      slot.task = undefined;
      job.remaining--;
      job.partial ||= state !== "complete";
      if (error) job.error = error;
      job.state = job.remaining
        ? "loading"
        : job.error && !job.results.length
          ? "error"
          : job.partial
            ? "partial"
            : "complete";
      this.publishBuilds();
      this.startNextBuild();
    };
    try {
      if (!slot.worker && this.buildWorker && !this.searchState.matching) {
        slot.worker = this.buildWorker;
        slot.initialized = true;
        this.buildWorker = undefined;
      }
      const initialize = !slot.initialized;
      const worker =
        slot.worker ??
        new Worker(new URL("./theorizer.worker", import.meta.url), {
          name: "theorizer-arrangement-builds",
          type: "module",
        });
      slot.worker = worker;
      const watch = () => {
        clearTimeout(slot.watchdog);
        slot.watchdog = setTimeout(
          () => finish("error", "Build calculation stopped responding.", true),
          15000
        );
      };
      watch();
      worker.onmessage = ({ data }: MessageEvent<T5SearchUpdate>) => {
        if (
          generation !== this.generation ||
          fitGeneration !== this.fitGeneration ||
          slot.task !== task
        )
          return;
        const previous = job.partitions.get(partition.index) ?? [];
        job.partitions.set(
          partition.index,
          applyT5Update({ ...emptyState(), results: previous }, data).results
        );
        const unique = new Map<string, T5Solution>();
        for (const result of [...job.partitions.values()].flat()) {
          const key = result.patternKey ?? result.key;
          const existing = unique.get(key);
          if (
            !existing ||
            result.covered > existing.covered ||
            (result.covered === existing.covered && result.owned > existing.owned)
          )
            unique.set(key, result);
        }
        job.results = [...unique.values()]
          .sort(
            (first, second) =>
              second.covered - first.covered ||
              second.owned - first.owned ||
              first.key.localeCompare(second.key)
          )
          .slice(0, this.cachedRequest!.config.parsedResultLimit || 30000);
        if (data.done)
          finish(
            data.error ? "error" : data.complete ? "complete" : "partial",
            data.error,
            !!data.error
          );
        else {
          watch();
          this.publishBuilds();
        }
      };
      worker.onerror = (event) =>
        finish("error", event.message || "Build calculation could not start.", true);
      worker.onmessageerror = () =>
        finish("error", "Build calculation sent an unreadable update.", true);
      const { timeLimitMs } = this.options.value;
      if (timeLimitMs > 0)
        slot.deadline = setTimeout(() => finish("partial", undefined, true), timeLimitMs);
      worker.postMessage(
        initialize
          ? {
              ...this.cachedRequest,
              arrangement,
              stage: "builds",
              skipMaxima: true,
              partition: undefined,
              task: undefined,
              group: undefined,
              timeLimitMs,
              buildPartition: partition,
            }
          : { type: "build", arrangement, timeLimitMs, buildPartition: partition }
      );
      slot.initialized = true;
    } catch (error) {
      finish("error", error instanceof Error ? error.message : String(error), true);
    }
  }

  ngOnDestroy(): void {
    this.cancel();
    this.targetLimits.destroy();
    this.destroyed.next();
    this.destroyed.complete();
    this.options.complete();
    this.view.complete();
  }
}
