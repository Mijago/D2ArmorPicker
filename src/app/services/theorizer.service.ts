import { Injectable, OnDestroy } from "@angular/core";
import { BehaviorSubject, merge, Subject, Subscription, timer } from "rxjs";
import { filter, map, take, takeUntil } from "rxjs/operators";
import {
  applyT5Update,
  createT5SavedRun,
  createT5SearchTasks,
  DEFAULT_T5_SEARCH_BUDGET_MS,
  mergeT5SearchUpdates,
  restoreT5Arrangements,
  T5Arrangement,
  T5SavedRun,
  T5SearchRequest,
  T5SearchUpdate,
  T5Solution,
} from "../data/theorizer";
import { ConfigurationService } from "./configuration.service";
import { DatabaseService } from "./database.service";
import { UserInformationService } from "./user-information.service";
import { buildT5Domains } from "./theorizer-search";
import { calculateCPUConcurrency } from "../data/commonFunctions";

export interface TheorizerViewState extends T5SearchUpdate {
  running: boolean;
  stale: boolean;
  cancelled: boolean;
  waitingForInventory?: boolean;
  arrangementsPaused?: boolean;
  restoredRunName?: string;
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

@Injectable()
export class T5TheorizerService implements OnDestroy {
  private readonly destroyed = new Subject<void>();
  private readonly view = new BehaviorSubject<TheorizerViewState>(emptyState());
  readonly state = this.view.asObservable();
  readonly reachableTiers = this.state.pipe(
    map((state) =>
      state.maximaComplete && state.maximumPossibleStats
        ? state.maximumPossibleStats.map((value) => Math.max(0, Math.min(200, value)) / 10)
        : Array(6).fill(20)
    )
  );
  private workers: Worker[] = [];
  private generation = 0;
  private responseTimeouts: ReturnType<typeof setTimeout>[] = [];
  private progressClock?: Subscription;
  private readonly options = new BehaviorSubject<{
    achievableOnly: boolean;
    timeLimitMs: number;
    workerLimit: number;
  }>({
    achievableOnly: false,
    timeLimitMs: DEFAULT_T5_SEARCH_BUDGET_MS,
    workerLimit: 0,
  });
  private refreshWait?: Subscription;
  private searchState = emptyState();
  private cachedRequest?: T5SearchRequest;
  private buildWorker?: Worker;
  private activeBuild?: string;
  private buildQueue: T5Arrangement[] = [];
  private discoveryPaused = false;
  private resumeDiscovery?: () => void;
  private pauseDiscoveryClock?: (pause: boolean) => void;
  private inventoryMatchingStarted = false;
  private inventoryMatches = new Map<string, NonNullable<T5Arrangement["inventoryMatch"]>>();
  private matchingQueue: T5Arrangement[] = [];
  private matchingTotal = 0;
  private matchingWatchdog?: ReturnType<typeof setTimeout>;
  private restoring = false;
  private buildJobs = new Map<
    string,
    {
      worker?: Worker;
      watchdog?: ReturnType<typeof setTimeout>;
      deadline?: ReturnType<typeof setTimeout>;
      state: T5Arrangement["buildState"];
      results: T5Solution[];
      error?: string;
    }
  >();

  constructor(
    private config: ConfigurationService,
    private db: DatabaseService,
    private inventory: UserInformationService
  ) {
    merge(this.config.configuration, this.options)
      .pipe(
        filter(() => !this.restoring),
        takeUntil(this.destroyed)
      )
      .subscribe(() => this.invalidate());
    merge(this.inventory.inventory, this.inventory.manifest)
      .pipe(
        filter(() => !this.restoring && !this.view.value.waitingForInventory),
        takeUntil(this.destroyed)
      )
      .subscribe(() => this.invalidate());
  }

  setSearchOptions(
    achievableOnly: boolean,
    timeLimitMs: number,
    workerLimit = this.options.value.workerLimit
  ): void {
    workerLimit = Number.isFinite(workerLimit)
      ? Math.max(0, Math.min(64, Math.floor(workerLimit)))
      : 0;
    if (
      this.options.value.achievableOnly === achievableOnly &&
      this.options.value.timeLimitMs === timeLimitMs &&
      this.options.value.workerLimit === workerLimit
    )
      return;
    this.options.next({ achievableOnly, timeLimitMs, workerLimit });
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
    this.restoring = false;
    this.refreshWait?.unsubscribe();
    this.refreshWait = undefined;
    this.progressClock?.unsubscribe();
    this.progressClock = undefined;
    this.responseTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.responseTimeouts = [];
    this.workers.forEach((worker) => worker.terminate());
    this.workers = [];
    this.buildWorker?.terminate();
    this.buildWorker = undefined;
    this.activeBuild = undefined;
    this.buildQueue = [];
    this.cachedRequest = undefined;
    this.discoveryPaused = false;
    this.resumeDiscovery = undefined;
    this.pauseDiscoveryClock = undefined;
    this.inventoryMatchingStarted = false;
    this.inventoryMatches.clear();
    this.matchingQueue = [];
    this.matchingTotal = 0;
    clearTimeout(this.matchingWatchdog);
    for (const job of this.buildJobs.values()) {
      job.worker?.terminate();
      clearTimeout(job.watchdog);
      clearTimeout(job.deadline);
    }
    this.buildJobs.clear();
    if (this.view.value.running)
      this.view.next({
        ...this.view.value,
        running: false,
        cancelled: true,
        complete: false,
        done: true,
        waitingForInventory: false,
        workersActive: 0,
      });
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
    this.options.next({ ...run.options });
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
      const request: T5SearchRequest = {
        config,
        inventory,
        manifest,
        achievableOnly,
        stage: "arrangements",
        timeLimitMs,
        group: group?.pieces.map((piece) => piece.archetype),
        wasmUrl: new URL("assets/highs.wasm", document.baseURI).href,
      };
      this.cachedRequest = request;
      const domains = buildT5Domains(request);
      const choices = domains.map((domain, slot) =>
        [...domain.keys()].filter((key) => !request.group || key === request.group[slot])
      );
      const tasks = createT5SearchTasks(choices);
      const requestedWorkers = this.options.value.workerLimit || calculateCPUConcurrency();
      const workerCount = group ? 1 : Math.min(requestedWorkers, Math.max(1, tasks.length));
      const maximaUpdates: (T5SearchUpdate | undefined)[] = Array(workerCount).fill(undefined);
      const taskUpdates: (T5SearchUpdate | undefined)[] = Array(tasks.length).fill(undefined);
      const assignments: (number | null)[] = Array(workerCount).fill(null);
      const active = Array<boolean>(workerCount).fill(true);
      const prepared = Array<boolean>(workerCount).fill(false);
      const failed = Array<boolean>(workerCount).fill(false);
      const dispatchers: (() => void)[] = [];
      let nextTask = 0;
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
          budgetExpired ||
          (workersActive === 0 && (nextTask === tasks.length || failed.every(Boolean)));
        data.done = done;
        data.complete =
          done &&
          !budgetExpired &&
          !failed.some(Boolean) &&
          nextTask === tasks.length &&
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
        data.tasksQueued = tasks.length - nextTask;
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
          publish();
        };
        const watchResponse = () => {
          clearTimeout(this.responseTimeouts[index]);
          this.responseTimeouts[index] = setTimeout(
            () => fail("A theorizer worker stopped responding. Partial results are retained."),
            15000
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
          if (nextTask >= tasks.length) {
            assignments[index] = null;
            active[index] = false;
            clearTimeout(this.responseTimeouts[index]);
            publish();
            return;
          }
          const task = nextTask++;
          assignments[index] = task;
          active[index] = true;
          const remaining = timeLimitMs > 0 ? Math.max(1, timeLimitMs - elapsed()) : 0;
          const canSplit = tasks[task].archetypes.length < choices.length;
          const slice = canSplit ? Math.min(2000, remaining || 2000) : remaining;
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
            if (
              task !== null &&
              data.stopReason === "budget" &&
              tasks[task].archetypes.length < choices.length &&
              (timeLimitMs === 0 || elapsed() < timeLimitMs)
            ) {
              const prefix = tasks[task].archetypes;
              const subtasks = choices[prefix.length].map((archetype) => ({
                archetypes: [...prefix, archetype],
              }));
              tasks.push(...subtasks);
              taskUpdates.push(...subtasks.map(() => undefined));
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
        buildState: job?.state ?? "idle",
        buildError: job?.error,
      } as T5Arrangement;
    });
    this.view.next({
      ...this.searchState,
      results,
      arrangements,
      arrangementsPaused: this.discoveryPaused,
    });
  }

  private startInventoryMatching(): void {
    if (
      this.inventoryMatchingStarted ||
      !this.cachedRequest ||
      !this.searchState.done ||
      this.activeBuild ||
      this.discoveryPaused
    )
      return;
    const arrangements = this.searchState.arrangements ?? [];
    if (!arrangements.length) return;
    this.inventoryMatchingStarted = true;
    this.matchingQueue = arrangements.map((arrangement) => ({ ...arrangement, builds: [] }));
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
    try {
      const initialize = !this.buildWorker;
      const worker =
        this.buildWorker ??
        new Worker(new URL("./theorizer.worker", import.meta.url), {
          name: "theorizer-inventory-fit",
        });
      this.buildWorker = worker;
      const fail = (message: string) => {
        clearTimeout(this.matchingWatchdog);
        worker.terminate();
        this.buildWorker = undefined;
        if (generation !== this.generation) return;
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
        if (generation !== this.generation) return;
        for (const entry of data.inventoryMatches ?? [])
          this.inventoryMatches.set(entry.key, entry.match);
        this.searchState = {
          ...this.searchState,
          matchingFinished: this.inventoryMatches.size,
          matchingTotal: this.matchingTotal,
        };
        this.publishBuilds();
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
      this.buildJobs.set(arrangement.key, { state: "queued", results: [] });
      this.buildQueue.push({ ...arrangement, builds: [] });
      added = true;
    }
    if (!added) return;
    this.discoveryPaused = true;
    this.publishBuilds();
    this.startNextBuild();
  }

  private startNextBuild(): void {
    if (
      this.activeBuild ||
      !this.cachedRequest ||
      this.searchState.matching ||
      (this.searchState.workersActive ?? 0) > 0
    )
      return;
    const arrangement = this.buildQueue.shift();
    if (!arrangement) return;
    const generation = this.generation;
    const job = this.buildJobs.get(arrangement.key)!;
    this.activeBuild = arrangement.key;
    job.state = "loading";
    this.pauseDiscoveryClock?.(true);
    this.publishBuilds();
    const finish = (state: T5Arrangement["buildState"], error?: string, discardWorker = false) => {
      clearTimeout(job.watchdog);
      clearTimeout(job.deadline);
      if (generation !== this.generation || this.activeBuild !== arrangement.key) return;
      if (discardWorker) {
        this.buildWorker?.terminate();
        this.buildWorker = undefined;
      }
      job.state = state;
      job.error = error;
      this.activeBuild = undefined;
      this.publishBuilds();
      if (this.buildQueue.length) this.startNextBuild();
      else {
        this.pauseDiscoveryClock?.(false);
        this.discoveryPaused = false;
        this.resumeDiscovery?.();
        this.publishBuilds();
        this.startInventoryMatching();
      }
    };
    try {
      const initialize = !this.buildWorker;
      const worker =
        this.buildWorker ??
        new Worker(new URL("./theorizer.worker", import.meta.url), {
          name: "theorizer-arrangement-builds",
        });
      this.buildWorker = worker;
      const watch = () => {
        clearTimeout(job.watchdog);
        job.watchdog = setTimeout(
          () => finish("error", "Build calculation stopped responding.", true),
          15000
        );
      };
      watch();
      worker.onmessage = ({ data }: MessageEvent<T5SearchUpdate>) => {
        if (generation !== this.generation || this.activeBuild !== arrangement.key) return;
        job.results = applyT5Update({ ...emptyState(), results: job.results }, data).results;
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
        job.deadline = setTimeout(() => finish("partial", undefined, true), timeLimitMs);
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
            }
          : { type: "build", arrangement, timeLimitMs }
      );
    } catch (error) {
      finish("error", error instanceof Error ? error.message : String(error), true);
    }
  }

  ngOnDestroy(): void {
    this.cancel();
    this.destroyed.next();
    this.destroyed.complete();
    this.options.complete();
    this.view.complete();
  }
}
