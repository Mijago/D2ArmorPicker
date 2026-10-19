import { fakeAsync, tick } from "@angular/core/testing";
import Tracker from "@openreplay/tracker";
import { BehaviorSubject, Subject } from "rxjs";
import { BuildConfiguration } from "../data/buildConfiguration";
import { calculateCPUConcurrency } from "../data/commonFunctions";
import { ArmorStat } from "../data/enum/armor-stat";
import {
  createT5SavedRun,
  T5Candidate,
  T5Solution,
  t5ArrangementFromPieces,
} from "../data/theorizer";
import { ConfigurationService } from "./configuration.service";
import { DatabaseService } from "./database.service";
import type { T5TheorizerService, TheorizerViewState } from "./theorizer.service";
import { UserInformationService } from "./user-information.service";

describe("automatic theorizer calculation", () => {
  let TheorizerService: typeof T5TheorizerService;
  beforeAll(async () => {
    spyOn(Tracker.prototype, "start").and.stub();
    TheorizerService = (await import("./theorizer.service")).T5TheorizerService;
  });

  beforeEach(() => {
    spyOnProperty(navigator, "hardwareConcurrency", "get").and.returnValue(2);
  });

  it("does not start calculations automatically on initialization or settings/inventory changes", fakeAsync(() => {
    const configuration = new BehaviorSubject(BuildConfiguration.buildEmptyConfiguration());
    const inventory = new Subject<null>();
    const manifest = new Subject<null>();
    const service = new TheorizerService(
      { configuration } as unknown as ConfigurationService,
      {} as DatabaseService,
      { inventory, manifest } as unknown as UserInformationService
    );
    const search = spyOn(service, "search").and.returnValue(Promise.resolve());
    tick(200);
    expect(search).not.toHaveBeenCalled();
    configuration.next(BuildConfiguration.buildEmptyConfiguration());
    tick(100);
    configuration.next(BuildConfiguration.buildEmptyConfiguration());
    tick(199);
    expect(search).not.toHaveBeenCalled();
    tick(1);
    expect(search).not.toHaveBeenCalled();
    inventory.next(null);
    manifest.next(null);
    tick(200);
    expect(search).not.toHaveBeenCalled();
    service.setSearchOptions(true, 600000);
    tick(200);
    expect(search).not.toHaveBeenCalled();
    service.ngOnDestroy();
    configuration.next(BuildConfiguration.buildEmptyConfiguration());
    tick(200);
    expect(search).not.toHaveBeenCalled();
  }));

  it("restores configuration and arrangements, then recalculates matches without rediscovery", fakeAsync(() => {
    const current = BuildConfiguration.buildEmptyConfiguration();
    const configuration = new BehaviorSubject(current);
    const savedConfig = BuildConfiguration.buildEmptyConfiguration();
    savedConfig.characterClass = 0;
    savedConfig.minimumStatTiers[ArmorStat.StatHealth].value = 12;
    const arrangement = t5ArrangementFromPieces(
      Array.from(
        { length: 5 },
        () => ({ archetype: "Grenedier", tertiary: ArmorStat.StatClass }) as T5Candidate
      )
    );
    arrangement.inventoryMatch = { covered: 5, owned: 5, proven: true, feasible: true, pieces: [] };
    const saved = createT5SavedRun(
      "Restored run",
      savedConfig,
      { achievableOnly: false, timeLimitMs: 600000, workerLimit: 4 },
      [arrangement],
      false
    );
    const worker = {
      postMessage: jasmine.createSpy("postMessage"),
      terminate: () => undefined,
      onmessage: undefined as ((event: MessageEvent) => void) | undefined,
    };
    const create = spyOn(window, "Worker").and.returnValue(worker as unknown as Worker);
    const equals = jasmine
      .createSpy("inventory class")
      .and.returnValue({ toArray: async () => [{ itemInstanceId: "current-inventory" }] });
    const service = new TheorizerService(
      {
        configuration,
        currentConfiguration: current,
        modifyConfiguration: (change: (config: BuildConfiguration) => void) => {
          change(current);
          configuration.next({ ...current });
        },
      } as unknown as ConfigurationService,
      {
        inventoryArmor: { where: () => ({ equals }) },
        manifestArmor: { toArray: async () => [{}] },
      } as unknown as DatabaseService,
      {
        inventory: new Subject<null>(),
        manifest: new Subject<null>(),
      } as unknown as UserInformationService
    );
    const discover = spyOn(service, "search").and.returnValue(Promise.resolve());
    let state!: TheorizerViewState;
    service.state.subscribe((value) => {
      state = value;
    });
    void service.restoreRun(saved);
    tick(0);
    expect(current.minimumStatTiers[ArmorStat.StatHealth].value).toBe(12);
    expect(equals).toHaveBeenCalledWith(0);
    expect(create.calls.count()).toBe(1);
    expect(state.restoredRunName).toBe("Restored run");
    expect(state.complete).toBeFalse();
    expect(state.arrangements?.[0].inventoryMatch).toBeUndefined();
    const request = worker.postMessage.calls.mostRecent().args[0];
    expect(request.stage).toBe("matches");
    expect(request.inventory[0].itemInstanceId).toBe("current-inventory");
    expect(request.matchArrangements[0].inventoryMatch).toBeUndefined();
    worker.onmessage!({
      data: {
        results: [],
        checked: 1,
        total: 1,
        feasible: 1,
        evaluations: 1,
        done: true,
        complete: true,
        warnings: [],
        inventoryMatches: [
          {
            key: arrangement.key,
            match: { covered: 2, owned: 2, proven: true, feasible: true, pieces: [] },
          },
        ],
      },
    } as MessageEvent);
    expect(state.matchingComplete).toBeTrue();
    expect(state.arrangements?.[0].inventoryMatch?.covered).toBe(2);
    tick(200);
    expect(discover).not.toHaveBeenCalled();
    expect(state.results).toEqual([]);
    const resaved = JSON.stringify(service.snapshot("Again"));
    expect(resaved).not.toContain("inventoryMatch");
    expect(resaved).not.toContain("current-inventory");
    service.ngOnDestroy();
  }));

  it("starts an explicitly queued calculation once inventory refresh finishes, including completion events", fakeAsync(() => {
    const config = BuildConfiguration.buildEmptyConfiguration();
    const configuration = new BehaviorSubject(config);
    const inventory = {
      inventory: new Subject<null>(),
      manifest: new Subject<null>(),
      isRefreshing: true,
      isFetchingManifest: false,
    };
    const worker = { postMessage: jasmine.createSpy("postMessage"), terminate: () => undefined };
    spyOn(window, "Worker").and.returnValue(worker as unknown as Worker);
    const service = new TheorizerService(
      { configuration, currentConfiguration: config } as unknown as ConfigurationService,
      {
        inventoryArmor: { where: () => ({ equals: () => ({ toArray: async () => [] }) }) },
        manifestArmor: { toArray: async () => [{}] },
      } as unknown as DatabaseService,
      inventory as unknown as UserInformationService
    );
    let waiting = false;
    let error: string | undefined;
    service.state.subscribe((state) => {
      waiting = !!state.waitingForInventory;
      error = state.error;
    });
    void service.search(false, 600000);
    tick(200);
    expect(waiting).toBeTrue();
    expect(error).toBeUndefined();
    expect(worker.postMessage).not.toHaveBeenCalled();
    inventory.isRefreshing = false;
    inventory.inventory.next(null);
    inventory.manifest.next(null);
    tick(100);
    expect(waiting).toBeFalse();
    expect(worker.postMessage).toHaveBeenCalled();
    expect(error).toBeUndefined();
    service.ngOnDestroy();
  }));

  it("stops calculating and reports an error if the browser worker never responds", fakeAsync(() => {
    const config = BuildConfiguration.buildEmptyConfiguration();
    const configuration = new BehaviorSubject(config);
    const worker = { postMessage: () => undefined, terminate: jasmine.createSpy("terminate") };
    spyOn(window, "Worker").and.returnValue(worker as unknown as Worker);
    const service = new TheorizerService(
      { configuration, currentConfiguration: config } as unknown as ConfigurationService,
      {
        inventoryArmor: { where: () => ({ equals: () => ({ toArray: async () => [] }) }) },
        manifestArmor: { toArray: async () => [{}] },
      } as unknown as DatabaseService,
      {
        inventory: new Subject<null>(),
        manifest: new Subject<null>(),
      } as unknown as UserInformationService
    );
    let running = false;
    let error: string | undefined;
    service.state.subscribe((state) => {
      running = state.running;
      error = state.error;
    });
    void service.search(false, 600000);
    tick(200);
    expect(running).toBeTrue();
    tick(15000);
    expect(running).toBeFalse();
    expect(error).toContain("stopped responding");
    expect(worker.terminate).toHaveBeenCalled();
    service.ngOnDestroy();
  }));

  it("keeps full theorizer slider maxima until new reachability results arrive", fakeAsync(() => {
    const config = BuildConfiguration.buildEmptyConfiguration();
    const configuration = new BehaviorSubject(config);
    const worker = {
      postMessage: () => undefined,
      terminate: () => undefined,
      onmessage: undefined as ((event: MessageEvent) => void) | undefined,
    };
    spyOn(window, "Worker").and.returnValue(worker as unknown as Worker);
    const service = new TheorizerService(
      { configuration, currentConfiguration: config } as unknown as ConfigurationService,
      {
        inventoryArmor: { where: () => ({ equals: () => ({ toArray: async () => [] }) }) },
        manifestArmor: { toArray: async () => [{}] },
      } as unknown as DatabaseService,
      {
        inventory: new Subject<null>(),
        manifest: new Subject<null>(),
      } as unknown as UserInformationService
    );
    let maxima: number[] = [];
    service.reachableTiers.subscribe((values) => {
      maxima = values;
    });
    expect(maxima).toEqual([20, 20, 20, 20, 20, 20]);
    service.setSearchOptions(false, 600000, 1);
    void service.search(false, 600000);
    tick(200);
    worker.onmessage!({
      data: {
        results: [],
        checked: 0,
        total: 1,
        feasible: 0,
        evaluations: 0,
        complete: false,
        done: false,
        warnings: [],
        maximumPossibleStats: [80, 100, 200, 125, 25, 25],
        maximaComplete: true,
      },
    } as MessageEvent);
    expect(maxima[0]).toBe(8);
    configuration.next(BuildConfiguration.buildEmptyConfiguration());
    expect(maxima).toEqual([20, 20, 20, 20, 20, 20]);
    service.ngOnDestroy();
    tick(200);
  }));

  it("merges disjoint workers, streams partial results and stops at the wall-clock budget", fakeAsync(() => {
    (
      Object.getOwnPropertyDescriptor(navigator, "hardwareConcurrency")?.get as jasmine.Spy
    ).and.returnValue(10);
    const config = BuildConfiguration.buildEmptyConfiguration();
    const workers = Array.from({ length: 4 }, () => ({
      postMessage: jasmine.createSpy("postMessage"),
      terminate: jasmine.createSpy("terminate"),
      onmessage: undefined as ((event: MessageEvent) => void) | undefined,
    }));
    spyOn(window, "Worker").and.returnValues(
      ...workers.map((worker) => worker as unknown as Worker)
    );
    const service = new TheorizerService(
      {
        configuration: new BehaviorSubject(config),
        currentConfiguration: config,
      } as unknown as ConfigurationService,
      {
        inventoryArmor: { where: () => ({ equals: () => ({ toArray: async () => [] }) }) },
        manifestArmor: { toArray: async () => [{}] },
      } as unknown as DatabaseService,
      {
        inventory: new Subject<null>(),
        manifest: new Subject<null>(),
      } as unknown as UserInformationService
    );
    let state!: TheorizerViewState;
    service.state.subscribe((value) => {
      state = value;
    });
    service.setSearchOptions(false, 1000, 4);
    tick(200);
    void service.search(false, 1000);
    tick(0);
    expect(state.workersTotal).toBe(4);
    workers.forEach((worker, index) =>
      expect(worker.postMessage.calls.mostRecent().args[0].partition).toEqual({ index, count: 4 })
    );
    workers.forEach((worker) =>
      worker.onmessage!({
        data: {
          results: [],
          checked: 0,
          total: 10,
          feasible: 0,
          evaluations: 0,
          complete: true,
          done: true,
          warnings: [],
          maximaChecked: 6,
          maximaComplete: true,
        },
      } as MessageEvent)
    );
    workers[0].onmessage!({
      data: {
        results: [{ key: "partial", covered: 2, owned: 2 }],
        checked: 1,
        total: 3,
        feasible: 1,
        evaluations: 4,
        complete: false,
        done: false,
        warnings: [],
        maximumPossibleStats: [30, 0, 0, 0, 0, 0],
      },
    } as MessageEvent);
    expect(state.results.length).toBe(1);
    expect(state.running).toBeTrue();
    tick(500);
    expect(state.elapsedMs).toBe(500);
    expect(state.budgetProgress).toBe(50);
    expect(state.evaluations).toBe(4);
    tick(500);
    expect(state.running).toBeFalse();
    expect(state.complete).toBeFalse();
    expect(state.results.length).toBe(1);
    expect(state.budgetProgress).toBe(100);
    expect(state.stopReason).toBe("budget");
    workers.forEach((worker) => expect(worker.terminate).toHaveBeenCalled());
    service.ngOnDestroy();
  }));

  it("queues explicit build requests behind arrangement slices, deduplicates them and resumes discovery", fakeAsync(() => {
    const config = BuildConfiguration.buildEmptyConfiguration();
    const workers = Array.from({ length: 4 }, () => ({
      postMessage: jasmine.createSpy("postMessage"),
      terminate: () => undefined,
      onmessage: undefined as ((event: MessageEvent) => void) | undefined,
    }));
    const create = spyOn(window, "Worker").and.returnValues(
      ...workers.map((worker) => worker as unknown as Worker)
    );
    const service = new TheorizerService(
      {
        configuration: new BehaviorSubject(config),
        currentConfiguration: config,
      } as unknown as ConfigurationService,
      {
        inventoryArmor: { where: () => ({ equals: () => ({ toArray: async () => [] }) }) },
        manifestArmor: { toArray: async () => [{}] },
      } as unknown as DatabaseService,
      {
        inventory: new Subject<null>(),
        manifest: new Subject<null>(),
      } as unknown as UserInformationService
    );
    let state!: TheorizerViewState;
    service.state.subscribe((value) => {
      state = value;
    });
    void service.search(false, 600000);
    tick(200);
    expect(workers[0].postMessage.calls.mostRecent().args[0].stage).toBe("maxima");
    workers[0].onmessage!({
      data: {
        results: [],
        checked: 0,
        total: 10,
        feasible: 0,
        evaluations: 0,
        complete: true,
        done: true,
        warnings: [],
        maximaChecked: 6,
        maximaComplete: true,
      },
    } as MessageEvent);
    expect(workers[0].postMessage.calls.mostRecent().args[0].type).toBe("task");
    const pieces = [
      ArmorStat.StatHealth,
      ArmorStat.StatClass,
      ArmorStat.StatClass,
      ArmorStat.StatClass,
      ArmorStat.StatMelee,
    ].map((tertiary) => ({ archetype: "Grenedier", tertiary }) as T5Candidate);
    const arrangement = t5ArrangementFromPieces(pieces);
    workers[0].onmessage!({
      data: {
        arrangements: [arrangement],
        results: [],
        checked: 1,
        total: 10,
        feasible: 1,
        evaluations: 1,
        complete: false,
        done: false,
        warnings: [],
      },
    } as MessageEvent);
    expect(state.arrangements?.length).toBe(1);
    expect(state.results).toEqual([]);
    expect(create.calls.count()).toBe(3);
    void service.loadBuilds(arrangement);
    tick(0);
    expect(create.calls.count()).toBe(3);
    expect(state.arrangements?.[0].buildState).toBe("queued");
    expect(state.arrangementsPaused).toBeTrue();
    void service.loadBuilds(arrangement);
    tick(0);
    expect(create.calls.count()).toBe(3);
    const finished = {
      results: [],
      arrangements: [],
      checked: 0,
      total: 10,
      feasible: 0,
      evaluations: 0,
      complete: true,
      done: true,
      warnings: [],
      maximaChecked: 6,
      maximaComplete: true,
    };
    workers[1].onmessage!({ data: finished } as MessageEvent);
    workers[2].onmessage!({ data: finished } as MessageEvent);
    expect(create.calls.count()).toBe(3);
    workers[0].onmessage!({ data: { ...finished, delta: true } } as MessageEvent);
    tick(0);
    expect(create.calls.count()).toBe(4);
    const request = workers[3].postMessage.calls.mostRecent().args[0];
    expect(request.stage).toBe("builds");
    expect(request.skipMaxima).toBeTrue();
    expect(request.arrangement.tertiaries).toEqual([
      { stat: ArmorStat.StatHealth, count: 1 },
      { stat: ArmorStat.StatMelee, count: 1 },
      { stat: ArmorStat.StatClass, count: 3 },
    ]);
    expect(request.group).toBeUndefined();
    expect(state.arrangements?.[0].buildState).toBe("loading");
    const discoveryElapsed = state.elapsedMs;
    tick(1000);
    expect(state.elapsedMs).toBe(discoveryElapsed);
    void service.loadBuilds(arrangement);
    tick(0);
    expect(create.calls.count()).toBe(4);
    const secondArrangement = t5ArrangementFromPieces(
      pieces.map((piece) => ({ ...piece, tertiary: ArmorStat.StatHealth }))
    );
    const build = { key: "first-build", pieces: [], covered: 0, owned: 0 } as unknown as T5Solution;
    workers[3].onmessage!({
      data: {
        delta: true,
        results: [build],
        checked: 1,
        total: 1,
        feasible: 1,
        evaluations: 1,
        complete: false,
        done: false,
        warnings: [],
      },
    } as MessageEvent);
    expect(state.results.map((result) => result.key)).toEqual(["first-build"]);
    service.loadBuildGroup([arrangement, secondArrangement, secondArrangement]);
    tick(0);
    expect(create.calls.count()).toBe(4);
    expect(workers[3].postMessage.calls.count()).toBe(1);
    workers[3].onmessage!({
      data: {
        delta: true,
        results: [],
        checked: 1,
        total: 1,
        feasible: 1,
        evaluations: 1,
        complete: true,
        done: true,
        warnings: [],
      },
    } as MessageEvent);
    expect(state.results.map((result) => result.key)).toEqual(["first-build"]);
    const reused = workers[3].postMessage.calls.mostRecent().args[0];
    expect(reused.type).toBe("build");
    expect(reused.arrangement.key).toBe(secondArrangement.key);
    expect(reused.inventory).toBeUndefined();
    expect(reused.manifest).toBeUndefined();
    expect(create.calls.count()).toBe(4);
    workers[3].onmessage!({ data: { ...finished, delta: true } } as MessageEvent);
    expect(state.arrangementsPaused).toBeFalse();
    expect(state.workersActive).toBe(3);
    expect(
      workers
        .slice(0, 3)
        .every((worker) => worker.postMessage.calls.mostRecent().args[0].type === "task")
    ).toBeTrue();
    expect(workers[3].postMessage.calls.count()).toBe(2);
    service.ngOnDestroy();
  }));

  it("keeps a fast worker busy by dispatching the next queued task on the same worker", fakeAsync(() => {
    (
      Object.getOwnPropertyDescriptor(navigator, "hardwareConcurrency")?.get as jasmine.Spy
    ).and.returnValue(10);
    const config = BuildConfiguration.buildEmptyConfiguration();
    const workers = Array.from({ length: 4 }, () => ({
      postMessage: jasmine.createSpy("postMessage"),
      terminate: jasmine.createSpy("terminate"),
      onmessage: undefined as ((event: MessageEvent) => void) | undefined,
    }));
    const create = spyOn(window, "Worker").and.returnValues(
      ...workers.map((worker) => worker as unknown as Worker)
    );
    const service = new TheorizerService(
      {
        configuration: new BehaviorSubject(config),
        currentConfiguration: config,
      } as unknown as ConfigurationService,
      {
        inventoryArmor: { where: () => ({ equals: () => ({ toArray: async () => [] }) }) },
        manifestArmor: { toArray: async () => [{}] },
      } as unknown as DatabaseService,
      {
        inventory: new Subject<null>(),
        manifest: new Subject<null>(),
      } as unknown as UserInformationService
    );
    let state!: TheorizerViewState;
    service.state.subscribe((value) => {
      state = value;
    });
    service.setSearchOptions(false, 300000, 4);
    tick(200);
    void service.search(false, 300000);
    tick(0);
    const finished = {
      results: [],
      arrangements: [],
      checked: 0,
      total: 10,
      feasible: 0,
      evaluations: 0,
      complete: true,
      done: true,
      warnings: [],
      maximaChecked: 6,
      maximaComplete: true,
    };
    workers.forEach((worker) => worker.onmessage!({ data: finished } as MessageEvent));
    expect(state.tasksQueued).toBe(1724);
    const initial = workers[0].postMessage.calls.mostRecent().args[0];
    workers[0].onmessage!({ data: finished } as MessageEvent);
    const reassigned = workers[0].postMessage.calls.mostRecent().args[0];
    expect(reassigned.type).toBe("task");
    expect(reassigned.task).not.toEqual(initial.task);
    expect(state.tasksFinished).toBe(1);
    expect(state.tasksQueued).toBe(1723);
    expect(state.workersActive).toBe(4);
    expect(state.running).toBeTrue();
    expect(workers[0].terminate).not.toHaveBeenCalled();
    expect(create.calls.count()).toBe(4);
    expect(reassigned.timeLimitMs).toBe(2000);
    const base = t5ArrangementFromPieces(
      Array.from(
        { length: 5 },
        () => ({ archetype: "Grenedier", tertiary: ArmorStat.StatClass }) as T5Candidate
      )
    );
    workers[0].onmessage!({
      data: {
        ...finished,
        delta: true,
        arrangements: [base],
        complete: false,
        done: false,
        feasible: 1,
        checked: 1,
      },
    } as MessageEvent);
    expect(state.arrangements?.length).toBe(1);
    expect(state.feasible).toBe(1);
    workers[0].onmessage!({
      data: { ...finished, delta: true, arrangements: [], complete: false, stopReason: "budget" },
    } as MessageEvent);
    expect(state.tasksTotal).toBe(1740);
    expect(state.tasksQueued).toBe(1734);
    expect(state.workersActive).toBe(4);
    expect(state.arrangements?.length).toBe(1);
    expect(state.arrangements?.[0].key).toBe(base.key);
    expect(state.feasible).toBe(1);
    expect(state.running).toBeTrue();
    expect(workers[0].terminate).not.toHaveBeenCalled();
    service.ngOnDestroy();
  }));

  it("scales workers with the main calculator CPU policy instead of capping them at four", fakeAsync(() => {
    const hardware = Object.getOwnPropertyDescriptor(navigator, "hardwareConcurrency")
      ?.get as jasmine.Spy;
    const create = spyOn(window, "Worker").and.returnValue({
      postMessage: () => undefined,
      terminate: () => undefined,
    } as unknown as Worker);
    for (const cores of [8, 16, 32]) {
      hardware.and.returnValue(cores);
      const expected = calculateCPUConcurrency();
      const config = BuildConfiguration.buildEmptyConfiguration();
      const before = create.calls.count();
      const service = new TheorizerService(
        {
          configuration: new BehaviorSubject(config),
          currentConfiguration: config,
        } as unknown as ConfigurationService,
        {
          inventoryArmor: { where: () => ({ equals: () => ({ toArray: async () => [] }) }) },
          manifestArmor: { toArray: async () => [{}] },
        } as unknown as DatabaseService,
        {
          inventory: new Subject<null>(),
          manifest: new Subject<null>(),
        } as unknown as UserInformationService
      );
      let state!: TheorizerViewState;
      service.state.subscribe((value) => {
        state = value;
      });
      void service.search(false, 600000);
      tick(200);
      expect(state.workersTotal).withContext(`${cores} logical cores`).toBe(expected);
      expect(create.calls.count() - before).toBe(expected);
      service.ngOnDestroy();
    }
  }));

  it("automatically fits inventory after discovery without calculating retained builds", fakeAsync(() => {
    const config = BuildConfiguration.buildEmptyConfiguration();
    const workers = Array.from({ length: 2 }, () => ({
      postMessage: jasmine.createSpy("postMessage"),
      terminate: () => undefined,
      onmessage: undefined as ((event: MessageEvent) => void) | undefined,
    }));
    const create = spyOn(window, "Worker").and.returnValues(
      ...workers.map((worker) => worker as unknown as Worker)
    );
    const service = new TheorizerService(
      {
        configuration: new BehaviorSubject(config),
        currentConfiguration: config,
      } as unknown as ConfigurationService,
      {
        inventoryArmor: { where: () => ({ equals: () => ({ toArray: async () => [] }) }) },
        manifestArmor: { toArray: async () => [{}] },
      } as unknown as DatabaseService,
      {
        inventory: new Subject<null>(),
        manifest: new Subject<null>(),
      } as unknown as UserInformationService
    );
    let state!: TheorizerViewState;
    service.state.subscribe((value) => {
      state = value;
    });
    const pieces = Array.from(
      { length: 5 },
      () => ({ archetype: "Grenedier", tertiary: ArmorStat.StatClass }) as T5Candidate
    );
    const arrangement = t5ArrangementFromPieces(pieces);
    void service.search(false, 300000, { pieces } as T5Solution);
    tick(0);
    const finished = {
      results: [],
      checked: 0,
      total: 1,
      feasible: 0,
      evaluations: 0,
      complete: true,
      done: true,
      warnings: [],
      maximaChecked: 6,
      maximaComplete: true,
    };
    workers[0].onmessage!({ data: finished } as MessageEvent);
    workers[0].onmessage!({
      data: { ...finished, arrangements: [arrangement], feasible: 1 },
    } as MessageEvent);
    expect(create.calls.count()).toBe(2);
    expect(state.matching).toBeTrue();
    expect(state.results).toEqual([]);
    const request = workers[1].postMessage.calls.mostRecent().args[0];
    expect(request.stage).toBe("matches");
    expect(request.matchArrangements[0].key).toBe(arrangement.key);
    workers[1].onmessage!({
      data: {
        ...finished,
        inventoryMatches: [
          {
            key: arrangement.key,
            match: { covered: 2, owned: 2, proven: true, feasible: true, pieces: [] },
          },
        ],
      },
    } as MessageEvent);
    expect(state.matching).toBeFalse();
    expect(state.matchingComplete).toBeTrue();
    expect(state.arrangements?.[0].inventoryMatch?.covered).toBe(2);
    expect(state.results).toEqual([]);
    void service.loadBuilds(arrangement);
    tick(0);
    expect(create.calls.count()).toBe(2);
    expect(workers[1].postMessage.calls.mostRecent().args[0].type).toBe("build");
    service.ngOnDestroy();
    tick(200);
  }));
});
