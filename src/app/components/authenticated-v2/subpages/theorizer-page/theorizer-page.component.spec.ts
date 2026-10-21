import { ChangeDetectorRef, NgZone } from "@angular/core";
import Tracker from "@openreplay/tracker";
import { BehaviorSubject, of, Subject } from "rxjs";
import { BuildConfiguration } from "../../../../data/buildConfiguration";
import { ArmorStat } from "../../../../data/enum/armor-stat";
import { ModifierType } from "../../../../data/enum/modifierType";
import { createT5SavedRun, DEFAULT_T5_SEARCH_BUDGET_MS } from "../../../../data/theorizer";
import { ConfigurationService } from "../../../../services/configuration.service";
import type { DatabaseService } from "../../../../services/database.service";
import type { LoggingProxyService } from "../../../../services/logging-proxy.service";
import type { T5TheorizerService } from "../../../../services/theorizer.service";
import type { T5SavedRunsService } from "../../../../services/theorizer-saved-runs.service";
import type { UserInformationService } from "../../../../services/user-information.service";
import type { TheorizerPageComponent } from "./theorizer-page.component";

describe("theorizer page settings persistence", () => {
  let Page: typeof TheorizerPageComponent;
  const prefix = "test-theorizer-page-";
  const keys = [
    `${prefix}user-currentConfig`,
    `${prefix}storedConfigurations`,
    "t5-theorizer-budget",
    "t5-theorizer-workers",
    "t5-theorizer-prioritize-matches",
  ];
  let stored = new Map<string, string | null>();
  const logger = {
    debug: () => undefined,
    error: () => undefined,
  } as unknown as LoggingProxyService;

  beforeAll(async () => {
    spyOn(Tracker.prototype, "start").and.stub();
    Page = (await import("./theorizer-page.component")).TheorizerPageComponent;
  });

  beforeEach(() => {
    stored = new Map(keys.map((key) => [key, localStorage.getItem(key)]));
    keys.forEach((key) => localStorage.removeItem(key));
  });

  afterEach(() => {
    stored.forEach((value, key) =>
      value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value)
    );
  });

  function create(main: BehaviorSubject<BuildConfiguration>) {
    const config = new ConfigurationService(logger, {
      prefix,
      initial: structuredClone(main.value),
    });
    const setSearchOptions = jasmine.createSpy("setSearchOptions");
    const restoreRun = jasmine.createSpy("restoreRun").and.resolveTo();
    const getRun = jasmine.createSpy("getRun");
    const page = new Page(
      {
        setSearchOptions,
        restoreRun,
        state: of({ results: [], arrangements: [], running: false, done: false }),
      } as unknown as T5TheorizerService,
      config,
      {
        configuration: main,
        currentConfiguration: main.value,
      } as unknown as ConfigurationService,
      {
        inventoryArmor: { where: () => ({ equals: () => ({ toArray: async () => [] }) }) },
        manifestArmor: { toArray: async () => [] },
        equipableItemSetDefinition: { toArray: async () => [] },
      } as unknown as DatabaseService,
      {
        run: (callback: () => void) => callback(),
      } as unknown as NgZone,
      { markForCheck: () => undefined } as ChangeDetectorRef,
      {
        list: async () => [],
        get: getRun,
      } as unknown as T5SavedRunsService,
      {
        inventory: new Subject<null>(),
        manifest: new Subject<null>(),
      } as unknown as UserInformationService
    );
    return { page, config, setSearchOptions, restoreRun, getRun };
  }

  it("preserves independent settings, budget and workers when the page is recreated", async () => {
    const initial = BuildConfiguration.buildEmptyConfiguration();
    initial.armorRequirements = [{ gearSetHash: 100 }];
    const main = new BehaviorSubject(initial);
    const first = create(main);
    first.page.ngOnInit();
    expect(first.page.prioritizeMatches).toBeTrue();
    first.config.modifyConfiguration((configuration) => {
      configuration.armorRequirements = [{ gearSetHash: 200 }, { gearSetHash: 200 }];
      configuration.statModLimits = { maxMods: 3, maxMajorMods: 1 };
      configuration.selectedModElement = ModifierType.Solar;
      configuration.selectedExotics = [1234];
      configuration.minimumStatTiers[ArmorStat.StatHealth] = { fixed: true, value: 15 };
    });
    first.page.timeLimitMs = 1200000;
    first.page.workerLimit = 3;
    first.page.prioritizeMatches = false;
    first.page.searchOptionsChanged();
    first.page.ngOnDestroy();
    await Promise.resolve();

    const reloaded = create(main);
    reloaded.page.ngOnInit();
    expect(reloaded.config.currentConfiguration.armorRequirements).toEqual([
      { gearSetHash: 200 },
      { gearSetHash: 200 },
    ]);
    expect(reloaded.config.currentConfiguration.statModLimits).toEqual({
      maxMods: 3,
      maxMajorMods: 1,
    });
    expect(reloaded.config.currentConfiguration.selectedModElement).toBe(ModifierType.Solar);
    expect(reloaded.config.currentConfiguration.selectedExotics).toEqual([1234]);
    expect(reloaded.config.currentConfiguration.minimumStatTiers[ArmorStat.StatHealth]).toEqual({
      fixed: true,
      value: 15,
    });
    expect(reloaded.page.timeLimitMs).toBe(1200000);
    expect(reloaded.page.workerLimit).toBe(3);
    expect(reloaded.page.prioritizeMatches).toBeFalse();
    expect(reloaded.setSearchOptions).toHaveBeenCalledWith(false, 1200000, 3, false);
    expect(main.value.armorRequirements).toEqual([{ gearSetHash: 100 }]);
    main.next({ ...main.value, armorRequirements: [{ gearSetHash: 300 }] });
    expect(reloaded.config.currentConfiguration.armorRequirements).toEqual([{ gearSetHash: 300 }]);
    expect(reloaded.config.currentConfiguration.minimumStatTiers[ArmorStat.StatHealth].value).toBe(
      15
    );
    reloaded.page.ngOnDestroy();
    await Promise.resolve();
  });

  it("restores an unlimited budget and rejects invalid saved budget values", async () => {
    const main = new BehaviorSubject(BuildConfiguration.buildEmptyConfiguration());
    for (const [storedBudget, expected] of [
      ["0", 0],
      ["invalid", DEFAULT_T5_SEARCH_BUDGET_MS],
      ["-1", DEFAULT_T5_SEARCH_BUDGET_MS],
    ] as const) {
      localStorage.setItem("t5-theorizer-budget", storedBudget);
      const { page } = create(main);
      page.ngOnInit();
      expect(page.timeLimitMs).toBe(expected);
      page.ngOnDestroy();
      await Promise.resolve();
    }
  });

  it("persists the search controls restored from a saved run", async () => {
    const main = new BehaviorSubject(BuildConfiguration.buildEmptyConfiguration());
    const first = create(main);
    first.page.ngOnInit();
    const run = createT5SavedRun(
      "Restored settings",
      main.value,
      { achievableOnly: false, timeLimitMs: 300000, workerLimit: 2, prioritizeMatches: false },
      [],
      true
    );
    first.getRun.and.resolveTo(run);
    first.page.selectedSavedRun = 1;
    await first.page.restoreSavedRun();
    expect(first.restoreRun).toHaveBeenCalledWith(run);
    first.page.ngOnDestroy();
    const reloaded = create(main);
    reloaded.page.ngOnInit();
    expect(reloaded.page.timeLimitMs).toBe(300000);
    expect(reloaded.page.workerLimit).toBe(2);
    expect(reloaded.page.prioritizeMatches).toBeFalse();
    expect(reloaded.setSearchOptions).toHaveBeenCalledWith(false, 300000, 2, false);
    reloaded.page.ngOnDestroy();
    await Promise.resolve();
  });
});
