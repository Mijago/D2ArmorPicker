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
import { TheorizerStatLimits } from "./theorizer-stat-limits";
import type { StatLimitsState } from "./stat-reachability";

describe("automatic theorizer calculation", () => {
  let TheorizerService: typeof T5TheorizerService;
  beforeAll(async () => {
    spyOn(Tracker.prototype, "start").and.stub();
    TheorizerService = (await import("./theorizer.service")).T5TheorizerService;
  });

  beforeEach(() => {
    spyOnProperty(navigator, "hardwareConcurrency", "get").and.returnValue(2);
  });

  it("runs exact live limits in a real worker without inventory or arrangement discovery", async () => {
    const worker = new Worker(new URL("./theorizer-stat-limits.worker", import.meta.url), {
      type: "module",
    });
    const config = BuildConfiguration.buildEmptyConfiguration();
    config.minimumStatTiers[ArmorStat.StatGrenade].value = 20;
    config.minimumStatTiers[ArmorStat.StatClass].value = 10;
    try {
      const reply = await new Promise<{ id: number; status: string; maximum: number[] }>(
        (resolve, reject) => {
          worker.onmessage = ({ data }) => resolve(data);
          worker.onerror = (error) => reject(new Error(error.message));
          worker.postMessage({
            id: 7,
            config,
            validateOnly: false,
            wasmUrl: new URL("assets/highs.wasm", document.baseURI).href,
          });
        }
      );
      expect(reply.id).toBe(7);
      expect(reply.status).toBe("feasible");
      expect(reply.maximum[ArmorStat.StatGrenade]).toBe(200);
      expect(reply.maximum[ArmorStat.StatHealth]).toBeLessThan(200);
    } finally {
      worker.terminate();
    }
  });

  it("validates the reported target combinations in a real worker", async () => {
    const worker = new Worker(new URL("./theorizer-stat-limits.worker", import.meta.url), {
      type: "module",
    });
    try {
      for (const [id, targets] of [
        [1, [7, 6, 6, 6, 6, 7]],
        [2, [6, 6, 6, 6, 6, 7]],
        [3, [9, 9, 9, 9, 9, 0]],
      ] as const) {
        const config = BuildConfiguration.buildEmptyConfiguration();
        targets.forEach((value, stat) => {
          config.minimumStatTiers[stat as ArmorStat] = { value, fixed: false };
        });
        const reply = await new Promise<{ id: number; status: string }>((resolve, reject) => {
          worker.onmessage = ({ data }) => resolve(data);
          worker.onerror = (error) => reject(new Error(error.message));
          worker.postMessage({
            id,
            config,
            validateOnly: true,
            wasmUrl: new URL("assets/highs.wasm", document.baseURI).href,
          });
        });
        expect(reply.id).toBe(id);
        expect(reply.status).withContext(targets.join("/")).toBe("feasible");
      }
    } finally {
      worker.terminate();
    }
  });

  it("calculates full limits for 90/90/90/90/0/90 with five major mods in a real worker", async () => {
    const worker = new Worker(new URL("./theorizer-stat-limits.worker", import.meta.url), {
      type: "module",
    });
    const config = BuildConfiguration.buildEmptyConfiguration();
    config.statModLimits = { maxMods: 5, maxMajorMods: 5 };
    [9, 9, 9, 9, 0, 9].forEach((value, stat) => {
      config.minimumStatTiers[stat as ArmorStat].value = value;
    });
    try {
      const reply = await new Promise<{
        id: number;
        status: string;
        maximum: number[];
        maximumComplete: boolean;
      }>((resolve, reject) => {
        worker.onmessage = ({ data }) => resolve(data);
        worker.onerror = (error) => reject(new Error(error.message));
        worker.postMessage({
          id: 4,
          config,
          validateOnly: false,
          wasmUrl: new URL("assets/highs.wasm", document.baseURI).href,
        });
      });
      console.info("T5 five-major worker maxima", reply);
      expect(reply.status).toBe("feasible");
    } finally {
      worker.terminate();
    }
  }, 45000);

  it("enables potential-match task priority by default and allows opting out", fakeAsync(() => {
    const workers = Array.from({ length: 2 }, () => ({
      postMessage: jasmine.createSpy("postMessage"),
      terminate: () => undefined,
      onmessage: undefined as ((event: MessageEvent) => void) | undefined,
    }));
    spyOn(window, "Worker").and.returnValues(
      ...workers.map((worker) => worker as unknown as Worker)
    );
    for (const [index, enabled] of [false, true].entries()) {
      const config = BuildConfiguration.buildEmptyConfiguration();
      config.characterClass = 0;
      const inventory = [1, 2, 3, 4, 5].map((slot) => ({
        slot,
        clazz: 0,
        armorSystem: 3,
        tier: 5,
        isExotic: 0,
        source: 0,
        itemInstanceId: `owned-${slot}`,
        resilience: 0,
        strength: 0,
        discipline: 30,
        intellect: 25,
        recovery: 20,
        mobility: 0,
        archetypeStats: [2, 3, 4],
        gearSetHash: null,
        gearSetPerkSelectable: false,
        tuningStat: 0,
        masterworkLevel: 5,
        perk: 0,
        isSunset: false,
        isFeatured: false,
        name: "Owned",
        icon: "",
        hash: slot,
      }));
      const service = new TheorizerService(
        {
          configuration: new BehaviorSubject(config),
          currentConfiguration: config,
        } as unknown as ConfigurationService,
        {
          inventoryArmor: { where: () => ({ equals: () => ({ toArray: async () => inventory }) }) },
          manifestArmor: { toArray: async () => [{}] },
        } as unknown as DatabaseService,
        {
          inventory: new Subject<null>(),
          manifest: new Subject<null>(),
        } as unknown as UserInformationService
      );
      if (enabled) service.setSearchOptions(false, 30000, 1);
      else service.setSearchOptions(false, 30000, 1, false);
      void service.search(false, 30000);
      tick(0);
      workers[index].onmessage!({
        data: {
          results: [],
          arrangements: [],
          checked: 0,
          total: 1,
          feasible: 0,
          evaluations: 0,
          complete: true,
          done: true,
          warnings: [],
          maximaChecked: 6,
          maximaComplete: true,
        },
      } as MessageEvent);
      const task = workers[index].postMessage.calls.mostRecent().args[0].task;
      expect(task.archetypeCounts).toBeTrue();
      expect(task.archetypes.every((name: string) => name === "Grenedier")).toBe(enabled);
      service.ngOnDestroy();
    }
  }));

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
            match: { covered: 3, owned: 3, proven: true, feasible: true, pieces: [] },
          },
        ],
      },
    } as MessageEvent);
    expect(state.matchingComplete).toBeTrue();
    expect(state.arrangements?.[0].inventoryMatch?.covered).toBe(3);
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

  it("refreshes slider limits independently of search and ignores stale replies", fakeAsync(() => {
    const config = BuildConfiguration.buildEmptyConfiguration();
    const configuration = new BehaviorSubject(config);
    const worker = {
      postMessage: jasmine.createSpy("postMessage"),
      terminate: jasmine.createSpy("terminate"),
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
    const search = spyOn(service, "search");
    tick(20);
    const initialId = worker.postMessage.calls.mostRecent().args[0].id;
    worker.onmessage!({
      data: {
        id: initialId,
        status: "feasible",
        maximum: [80, 100, 200, 125, 25, 25],
      },
    } as MessageEvent);
    expect(maxima[0]).toBe(8);
    const changedTarget = BuildConfiguration.buildEmptyConfiguration();
    changedTarget.minimumStatTiers[ArmorStat.StatHealth].value = 10;
    configuration.next(changedTarget);
    tick(20);
    const nextId = worker.postMessage.calls.mostRecent().args[0].id;
    worker.onmessage!({
      data: { id: initialId, status: "feasible", maximum: [200, 200, 200, 200, 200, 200] },
    } as MessageEvent);
    expect(maxima[0]).toBe(8);
    service.cancel();
    expect(worker.terminate).not.toHaveBeenCalled();
    worker.onmessage!({
      data: { id: nextId, status: "feasible", maximum: [150, 100, 200, 100, 25, 25] },
    } as MessageEvent);
    expect(maxima[0]).toBe(15);
    expect(search).not.toHaveBeenCalled();
    service.ngOnDestroy();
    expect(worker.terminate).toHaveBeenCalled();
    tick(200);
  }));

  it("shows preview maxima while the exact limits are still pending", fakeAsync(() => {
    const worker = {
      postMessage: jasmine.createSpy("postMessage"),
      terminate: () => undefined,
      onmessage: undefined as ((event: MessageEvent) => void) | undefined,
    };
    spyOn(window, "Worker").and.returnValue(worker as unknown as Worker);
    const limits = new TheorizerStatLimits();
    limits.configure(BuildConfiguration.buildEmptyConfiguration());
    let state!: StatLimitsState;
    limits.state.subscribe((value) => {
      state = value;
    });
    tick(20);
    const id = worker.postMessage.calls.mostRecent().args[0].id;
    worker.onmessage!({
      data: { id, status: "feasible", maximum: [150, 150, 150, 150, 150, 150], preview: true },
    } as MessageEvent);
    expect(state.pending).toBeTrue();
    expect(state.feasible).toBeFalse();
    expect(state.maximum).toEqual([150, 150, 150, 150, 150, 150]);
    worker.onmessage!({
      data: {
        id,
        status: "feasible",
        maximum: [152, 152, 152, 152, 152, 152],
        maximumComplete: true,
      },
    } as MessageEvent);
    expect(state.pending).toBeFalse();
    expect(state.feasible).toBeTrue();
    expect(state.maximum[0]).toBe(152);
    limits.destroy();
  }));

  it("drops the exact run when a new request supersedes it", fakeAsync(() => {
    const workers = Array.from({ length: 2 }, () => ({
      postMessage: jasmine.createSpy("postMessage"),
      terminate: jasmine.createSpy("terminate"),
      onmessage: undefined as ((event: MessageEvent) => void) | undefined,
    }));
    spyOn(window, "Worker").and.returnValues(...workers.map((w) => w as unknown as Worker));
    const limits = new TheorizerStatLimits();
    const config = BuildConfiguration.buildEmptyConfiguration();
    limits.configure(config);
    let state!: StatLimitsState;
    limits.state.subscribe((value) => {
      state = value;
    });
    tick(20);
    workers[0].onmessage!({
      data: {
        id: workers[0].postMessage.calls.mostRecent().args[0].id,
        status: "feasible",
        maximum: [150, 150, 150, 150, 150, 150],
        preview: true,
      },
    } as MessageEvent);
    expect(state.preview).toBeTrue();
    config.minimumStatTiers[ArmorStat.StatHealth].value = 10;
    limits.configure(config);
    expect(workers[0].terminate).toHaveBeenCalled();
    expect(state.preview).toBeFalse();
    tick(20);
    expect(workers[1].postMessage).toHaveBeenCalled();
    limits.destroy();
  }));

  it("keeps feasible targets verified when only some maxima are available", fakeAsync(() => {
    const worker = {
      postMessage: jasmine.createSpy("postMessage"),
      terminate: () => undefined,
      onmessage: undefined as ((event: MessageEvent) => void) | undefined,
    };
    spyOn(window, "Worker").and.returnValue(worker as unknown as Worker);
    const limits = new TheorizerStatLimits();
    limits.configure(BuildConfiguration.buildEmptyConfiguration());
    let state!: StatLimitsState;
    limits.state.subscribe((value) => {
      state = value;
    });
    tick(20);
    worker.onmessage!({
      data: {
        id: worker.postMessage.calls.mostRecent().args[0].id,
        status: "feasible",
        maximum: [191, 181, 0, 0, 0, 0],
        maximumComplete: false,
      },
    } as MessageEvent);
    expect(state.feasible).toBeTrue();
    expect(state.maximumComplete).toBeFalse();
    expect(state.maximum).toEqual([191, 181, 200, 200, 200, 200]);
    expect(state.error).toContain("Target checks remain available");
    limits.destroy();
  }));

  it("keeps unknown limits unverified and recovers on retry without discarding prior maxima", fakeAsync(() => {
    const worker = {
      postMessage: jasmine.createSpy("postMessage"),
      terminate: () => undefined,
      onmessage: undefined as ((event: MessageEvent) => void) | undefined,
    };
    spyOn(window, "Worker").and.returnValue(worker as unknown as Worker);
    const limits = new TheorizerStatLimits();
    const config = BuildConfiguration.buildEmptyConfiguration();
    limits.configure(config);
    let state!: StatLimitsState;
    limits.state.subscribe((value) => {
      state = value;
    });
    const reply = (status: string, maximum: number[]) =>
      worker.onmessage!({
        data: {
          id: worker.postMessage.calls.mostRecent().args[0].id,
          status,
          maximum,
          maximumComplete: status === "feasible",
        },
      } as MessageEvent);
    tick(20);
    reply("feasible", [150, 150, 200, 150, 150, 150]);
    config.minimumStatTiers[ArmorStat.StatGrenade].value = 20;
    limits.configure(config);
    expect(state.pending).toBeTrue();
    expect(state.feasible).toBeFalse();
    tick(20);
    reply("unknown", Array(6).fill(0));
    expect(state.feasible).toBeFalse();
    expect(state.pending).toBeFalse();
    expect(state.maximum[0]).toBe(150);
    expect(state.error).toBeDefined();
    limits.refresh();
    tick(20);
    reply("feasible", [100, 100, 200, 140, 140, 100]);
    expect(state.feasible).toBeTrue();
    expect(state.maximum[0]).toBe(100);
    expect(state.error).toBeUndefined();
    limits.destroy();
  }));

  it("resumes current limits after rejecting a proposal during a pending refresh", fakeAsync(() => {
    const worker = {
      postMessage: jasmine.createSpy("postMessage"),
      terminate: () => undefined,
      onmessage: undefined as ((event: MessageEvent) => void) | undefined,
    };
    spyOn(window, "Worker").and.returnValue(worker as unknown as Worker);
    const limits = new TheorizerStatLimits();
    const config = BuildConfiguration.buildEmptyConfiguration();
    limits.configure(config);
    let state!: StatLimitsState;
    limits.state.subscribe((value) => {
      state = value;
    });
    tick(20);
    const proposed = structuredClone(config);
    proposed.minimumStatTiers[ArmorStat.StatHealth] = { value: 0.1, fixed: true };
    let accepted: boolean | undefined;
    void limits.validate(proposed).then((valid) => {
      accepted = valid;
    });
    worker.onmessage!({
      data: {
        id: worker.postMessage.calls.mostRecent().args[0].id,
        status: "infeasible",
        maximum: [],
      },
    } as MessageEvent);
    tick(20);
    expect(accepted).toBeFalse();
    expect(state.pending).toBeTrue();
    expect(worker.postMessage.calls.mostRecent().args[0].validateOnly).toBeFalse();
    worker.onmessage!({
      data: {
        id: worker.postMessage.calls.mostRecent().args[0].id,
        status: "feasible",
        maximum: Array(6).fill(200),
      },
    } as MessageEvent);
    expect(state.pending).toBeFalse();
    expect(state.feasible).toBeTrue();
    limits.destroy();
  }));

  it("only cancels discovery for target or subclass stat-modifier changes", () => {
    const config = BuildConfiguration.buildEmptyConfiguration();
    const configuration = new BehaviorSubject(config);
    const inventory = new Subject<null>();
    const manifest = new Subject<null>();
    const service = new TheorizerService(
      { configuration, currentConfiguration: config } as unknown as ConfigurationService,
      {} as DatabaseService,
      { inventory, manifest } as unknown as UserInformationService
    );
    const cancel = spyOn(service, "cancel").and.stub();
    const refreshFit = spyOn(service as any, "refreshFit").and.stub();

    const fitOnly = { ...config, armorRequirements: [{ gearSetHash: 123 }] };
    configuration.next(fitOnly);
    expect(cancel).not.toHaveBeenCalled();
    expect(refreshFit).toHaveBeenCalledTimes(1);

    const exoticFitOnly = {
      ...fitOnly,
      selectedExotics: [456],
      selectedExoticPerks: [11, 22],
    };
    configuration.next(exoticFitOnly);
    expect(cancel).not.toHaveBeenCalled();
    expect(refreshFit).toHaveBeenCalledTimes(2);

    const sourceFitOnly = { ...exoticFitOnly, includeVendorRolls: true };
    configuration.next(sourceFitOnly);
    expect(cancel).not.toHaveBeenCalled();
    expect(refreshFit).toHaveBeenCalledTimes(3);

    inventory.next(null);
    manifest.next(null);
    expect(cancel).not.toHaveBeenCalled();
    expect(refreshFit).toHaveBeenCalledTimes(5);

    const changedTarget = {
      ...sourceFitOnly,
      minimumStatTiers: structuredClone(config.minimumStatTiers),
    };
    changedTarget.minimumStatTiers[ArmorStat.StatHealth].value = 10;
    configuration.next(changedTarget);
    expect(cancel).toHaveBeenCalledTimes(1);

    const changedSubclass = { ...changedTarget, enabledMods: [1 as never] };
    configuration.next(changedSubclass);
    expect(cancel).toHaveBeenCalledTimes(2);

    service.ngOnDestroy();
  });

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
    const workers = Array.from({ length: 6 }, () => ({
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
    service.setSearchOptions(false, 600000, 3);
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
    arrangement.inventoryMatch = {
      covered: 4,
      owned: 4,
      proven: true,
      feasible: true,
      pieces: [],
    };
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
    expect(create.calls.count()).toBe(6);
    workers.slice(3).forEach((worker, index) => {
      expect(worker.postMessage.calls.mostRecent().args[0].buildPartition).toEqual({
        index,
        count: 3,
      });
    });
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
    expect(create.calls.count()).toBe(6);
    const secondArrangement = t5ArrangementFromPieces(
      pieces.map((piece) => ({ ...piece, tertiary: ArmorStat.StatHealth }))
    );
    secondArrangement.inventoryMatch = {
      covered: 4,
      owned: 4,
      proven: true,
      feasible: true,
      pieces: [],
    };
    const build = { key: "first-build", pieces: [], covered: 4, owned: 4 } as unknown as T5Solution;
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
    expect(create.calls.count()).toBe(6);
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
    expect(create.calls.count()).toBe(6);
    expect(state.arrangementsPaused).toBeTrue();
    expect(state.workersActive).toBe(0);
    workers[4].onmessage!({
      data: { ...finished, delta: true, results: [{ ...build, covered: 4 }] },
    } as MessageEvent);
    expect(state.results.length).toBe(1);
    expect(state.results[0].covered).toBe(4);
    workers[5].onmessage!({ data: { ...finished, delta: true } } as MessageEvent);
    workers.slice(3).forEach((worker) => {
      const next = worker.postMessage.calls.mostRecent().args[0];
      expect(next.type).toBe("build");
      expect(next.arrangement.key).toBe(secondArrangement.key);
      expect(next.inventory).toBeUndefined();
      expect(next.manifest).toBeUndefined();
    });
    workers[3].onmessage!({ data: { ...finished, delta: true } } as MessageEvent);
    expect(state.arrangementsPaused).toBeTrue();
    workers[4].onmessage!({ data: { ...finished, delta: true } } as MessageEvent);
    expect(state.arrangementsPaused).toBeTrue();
    workers[5].onmessage!({ data: { ...finished, delta: true } } as MessageEvent);
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
    expect(state.tasksQueued).toBe(4364);
    const initial = workers[0].postMessage.calls.mostRecent().args[0];
    workers[0].onmessage!({ data: finished } as MessageEvent);
    const reassigned = workers[0].postMessage.calls.mostRecent().args[0];
    expect(reassigned.type).toBe("task");
    expect(reassigned.task).not.toEqual(initial.task);
    expect(state.tasksFinished).toBe(1);
    expect(state.tasksQueued).toBe(4363);
    expect(state.workersActive).toBe(4);
    expect(state.running).toBeTrue();
    expect(workers[0].terminate).not.toHaveBeenCalled();
    expect(create.calls.count()).toBe(4);
    expect(reassigned.timeLimitMs).toBe(4000);
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
    expect(state.tasksTotal).toBe(4424);
    expect(state.tasksQueued).toBe(4418);
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

  it("time-slices full-prefix discovery and retains its discoveries when resuming", fakeAsync(() => {
    const config = BuildConfiguration.buildEmptyConfiguration();
    const worker = {
      postMessage: jasmine.createSpy("postMessage"),
      terminate: () => undefined,
      onmessage: undefined as ((event: MessageEvent) => void) | undefined,
    };
    const create = spyOn(window, "Worker").and.returnValue(worker as unknown as Worker);
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
    service.setSearchOptions(false, 30000, 1);
    void service.search(false, 30000, { pieces } as T5Solution);
    tick(0);
    const finished = {
      results: [],
      arrangements: [],
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
    worker.onmessage!({ data: finished } as MessageEvent);
    expect(worker.postMessage.calls.mostRecent().args[0].task.archetypeCounts).toBeTrue();
    worker.onmessage!({
      data: { ...finished, complete: false, stopReason: "budget" },
    } as MessageEvent);
    const request = worker.postMessage.calls.mostRecent().args[0];
    expect(request.task.archetypes.length).toBe(5);
    expect(request.timeLimitMs).toBe(4000);
    const arrangement = t5ArrangementFromPieces(pieces);
    worker.onmessage!({
      data: {
        ...finished,
        delta: true,
        arrangements: [arrangement],
        feasible: 1,
        complete: false,
        done: false,
      },
    } as MessageEvent);
    worker.onmessage!({
      data: { ...finished, delta: true, feasible: 1, complete: false, stopReason: "slice" },
    } as MessageEvent);
    let completedOther = 0;
    while (
      JSON.stringify(worker.postMessage.calls.mostRecent().args[0].task) !==
        JSON.stringify(request.task) &&
      completedOther < 60
    ) {
      worker.onmessage!({ data: finished } as MessageEvent);
      completedOther++;
    }
    expect(worker.postMessage.calls.mostRecent().args[0].task).toEqual(request.task);
    expect(worker.postMessage.calls.mostRecent().args[0].timeLimitMs).toBe(4000);
    expect(state.tasksFinished).toBe(1 + completedOther);
    expect(state.running).toBeTrue();
    expect(state.arrangements?.map((entry) => entry.key)).toEqual([arrangement.key]);
    worker.onmessage!({
      data: {
        ...finished,
        delta: true,
        feasible: 1,
        complete: false,
        stopReason: "slice",
        taskDeferred: true,
      },
    } as MessageEvent);
    expect(create.calls.count()).toBe(1);
    expect(state.tasksFinished).toBe(1 + completedOther);
    expect(state.arrangements?.length).toBe(1);
    service.ngOnDestroy();
  }));

  it("queues other runnable leaf tasks ahead of a deferred retry-heavy task", fakeAsync(() => {
    const config = BuildConfiguration.buildEmptyConfiguration();
    config.characterClass = 0;
    const inventory = [1, 2, 3, 4, 5].map((slot) => ({
      slot,
      clazz: 0,
      armorSystem: 3,
      tier: 5,
      isExotic: 0,
      source: 0,
      itemInstanceId: `owned-${slot}`,
      resilience: 0,
      strength: 0,
      discipline: 30,
      intellect: 25,
      recovery: 20,
      mobility: 0,
      archetypeStats: [2, 3, 4],
      gearSetHash: null,
      gearSetPerkSelectable: false,
      tuningStat: 0,
      masterworkLevel: 5,
      perk: 0,
      isSunset: false,
      isFeatured: false,
      name: "Owned armor",
      icon: "",
      hash: slot,
    }));
    inventory.push({
      ...inventory[0],
      itemInstanceId: "owned-other",
      resilience: 25,
      strength: 30,
      discipline: 0,
      intellect: 0,
      archetypeStats: [1, 0, 4],
    });
    const worker = {
      postMessage: jasmine.createSpy("postMessage"),
      terminate: () => undefined,
      onmessage: undefined as ((event: MessageEvent) => void) | undefined,
    };
    spyOn(window, "Worker").and.returnValue(worker as unknown as Worker);
    const service = new TheorizerService(
      {
        configuration: new BehaviorSubject(config),
        currentConfiguration: config,
      } as unknown as ConfigurationService,
      {
        inventoryArmor: { where: () => ({ equals: () => ({ toArray: async () => inventory }) }) },
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
    service.setSearchOptions(true, 30000, 1);
    void service.search(true, 30000);
    tick(0);
    const finished = {
      results: [],
      arrangements: [],
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
    worker.onmessage!({ data: finished } as MessageEvent);
    for (
      let iteration = 0;
      !worker.postMessage.calls.mostRecent().args[0].task?.tertiaries && iteration < 8;
      iteration++
    ) {
      worker.onmessage!({
        data: { ...finished, complete: false, stopReason: "budget" },
      } as MessageEvent);
    }
    const first = worker.postMessage.calls.mostRecent().args[0].task;
    expect(first.archetypes.length).toBe(5);
    const completed = state.tasksFinished;
    worker.onmessage!({
      data: { ...finished, delta: true, complete: false, stopReason: "slice", taskDeferred: true },
    } as MessageEvent);
    const second = worker.postMessage.calls.mostRecent().args[0].task;
    expect(second).not.toEqual(first);
    expect(state.tasksDeferred).toBe(1);
    expect(state.tasksFinished).toBe(completed);
    worker.onmessage!({
      data: { ...finished, delta: true, complete: false, stopReason: "slice", taskDeferred: true },
    } as MessageEvent);
    const third = worker.postMessage.calls.mostRecent().args[0].task;
    expect(third).not.toEqual(first);
    expect(third).not.toEqual(second);
    expect(state.tasksDeferred).toBe(2);
    expect(state.tasksFinished).toBe(completed);
    expect(state.running).toBeTrue();
    service.ngOnDestroy();
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
    service.setSearchOptions(false, 300000, 1);
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
            match: { covered: 3, owned: 3, proven: true, feasible: true, pieces: [] },
          },
        ],
      },
    } as MessageEvent);
    expect(state.matching).toBeFalse();
    expect(state.matchingComplete).toBeTrue();
    expect(state.arrangements?.[0].inventoryMatch?.covered).toBe(3);
    expect(state.results).toEqual([]);
    void service.loadBuilds(arrangement);
    tick(0);
    expect(create.calls.count()).toBe(2);
    expect(workers[1].postMessage.calls.mostRecent().args[0].type).toBe("build");
    service.ngOnDestroy();
    tick(200);
  }));

  it("keeps restored low matches out of builds, budgets parallel builds and cancels every worker", fakeAsync(() => {
    const config = BuildConfiguration.buildEmptyConfiguration();
    const workers = Array.from({ length: 3 }, () => ({
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
        modifyConfiguration: (modify: (configuration: BuildConfiguration) => void) =>
          modify(config),
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
    const arrangement = (tertiary: ArmorStat) =>
      t5ArrangementFromPieces(
        Array.from({ length: 5 }, () => ({ archetype: "Grenedier", tertiary }) as T5Candidate)
      );
    const useful = arrangement(ArmorStat.StatClass);
    const low = arrangement(ArmorStat.StatHealth);
    let state!: TheorizerViewState;
    service.state.subscribe((value) => {
      state = value;
    });
    void service.restoreRun(
      createT5SavedRun(
        "Old run",
        config,
        { achievableOnly: false, timeLimitMs: 1000, workerLimit: 3 },
        [useful, low],
        true
      )
    );
    tick(0);
    service.loadBuildGroup([useful, low]);
    const finished = {
      results: [],
      checked: 1,
      total: 1,
      feasible: 1,
      evaluations: 1,
      done: true,
      complete: true,
      warnings: [],
    };
    workers[0].onmessage!({
      data: {
        ...finished,
        inventoryMatches: [
          {
            key: useful.key,
            match: { covered: 4, owned: 4, feasible: true, proven: true, pieces: [] },
          },
          {
            key: low.key,
            match: { covered: 3, owned: 3, feasible: true, proven: true, pieces: [] },
          },
        ],
      },
    } as MessageEvent);
    expect(state.arrangements?.map((entry) => entry.key)).toEqual([useful.key, low.key]);
    expect(state.arrangements?.[1].inventoryMatch?.covered).toBe(3);
    expect(create.calls.count()).toBe(3);
    expect(state.buildWorkersActive).toBe(3);
    expect(state.buildTasksQueued).toBe(0);
    expect(state.arrangements?.find((entry) => entry.key === low.key)?.buildState).toBe("queued");
    const build = {
      key: "covered-build",
      pieces: [],
      covered: 4,
      owned: 4,
    } as unknown as T5Solution;
    workers[0].onmessage!({ data: { ...finished, delta: true, results: [build] } } as MessageEvent);
    expect(state.buildWorkersActive).toBe(2);
    expect(state.arrangementsPaused).toBeFalse();
    tick(1000);
    expect(state.buildWorkersActive).toBe(0);
    expect(state.arrangements?.[0].buildState).toBe("partial");
    expect(state.results.map((entry) => entry.key)).toEqual([build.key]);
    expect(service.snapshot("Filtered").arrangements.map((entry) => entry.key)).toEqual([
      useful.key,
      low.key,
    ]);
    expect(state.arrangements?.find((entry) => entry.key === low.key)?.buildState).toBe("queued");
    expect(state.buildWorkersActive).toBe(0);
    expect(state.buildTasksQueued).toBe(0);
    service.cancel();
    workers.forEach((worker) => expect(worker.terminate).toHaveBeenCalled());
    workers[1].onmessage!({
      data: { ...finished, results: [{ ...build, key: "late-build" }] },
    } as MessageEvent);
    expect(state.results.map((entry) => entry.key)).toEqual([build.key]);
    service.ngOnDestroy();
  }));
});
