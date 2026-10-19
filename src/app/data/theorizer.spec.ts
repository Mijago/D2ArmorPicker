import { ArmorStat, StatModifier } from "./enum/armor-stat";
import { BuildConfiguration, suggestedConfigurationName } from "./buildConfiguration";
import { DestinyClass } from "bungie-api-ts/destiny2";
import { ModifierType } from "./enum/modifierType";
import { FORCE_USE_ANY_EXOTIC, FORCE_USE_NO_EXOTIC } from "./constants";
import { ModOrAbility } from "./enum/modOrAbility";
import { T5Candidate, t5ArrangementFromPieces } from "./theorizer";
import { groupT5Archetypes } from "./theorizer";
import { createT5SavedRun, restoreT5Arrangements } from "./theorizer";
import {
  applyT5Update,
  canAssignT5Tertiaries,
  createT5SearchTasks,
  createT5UpdateEncoder,
  DEFAULT_T5_SEARCH_BUDGET_MS,
  groupT5Arrangements,
  mergeT5SearchUpdates,
  reflectMainCalculationSettings,
  T5_ARCHETYPES,
  T5_SEARCH_BUDGETS,
  T5SearchUpdate,
  T5Solution,
  t5ArchetypeIndex,
  t5BaseStats,
  t5Tertiaries,
} from "./theorizer";

describe("T5 theorizer archetypes", () => {
  it("names saved configurations consistently using subclass, exotic and class", () => {
    const config = BuildConfiguration.buildEmptyConfiguration();
    config.characterClass = DestinyClass.Titan;
    config.selectedModElement = ModifierType.Solar;
    config.selectedExotics = [FORCE_USE_NO_EXOTIC];
    expect(suggestedConfigurationName(config, [])).toBe("Solar: (No Exotic Selected) Titan");
    config.selectedExotics = [FORCE_USE_ANY_EXOTIC];
    expect(suggestedConfigurationName(config, [])).toBe("Solar: (Any Exotic) Titan");
    config.selectedExotics = [123];
    expect(suggestedConfigurationName(config, ["Test Exotic", "Test Exotic"])).toBe(
      "Solar: (Test Exotic) Titan"
    );
    expect(suggestedConfigurationName(config, [])).toBe("Solar: (Selected Exotic) Titan");
    expect(suggestedConfigurationName(config, ["Long name ".repeat(20)]).length).toBe(80);
  });
  it("groups tertiary and tuning arrangements beneath their archetype combination", () => {
    const base = (name: string, tertiary: ArmorStat) =>
      t5ArrangementFromPieces(
        Array.from({ length: 5 }, () => ({ archetype: name, tertiary }) as T5Candidate)
      );
    const health = base("Grenedier", ArmorStat.StatHealth);
    const melee = base("Grenedier", ArmorStat.StatMelee);
    const other = base("Demolitionist", ArmorStat.StatSuper);
    melee.buildState = "queued";
    const groups = groupT5Archetypes([health, other, melee]);
    expect(groups.length).toBe(2);
    const grenadier = groups.find((group) => group.archetypes[0].name === "Grenedier")!;
    expect(grenadier.arrangements.map((arrangement) => arrangement.key)).toEqual([
      health.key,
      melee.key,
    ]);
    expect(grenadier.uncalculated).toBe(1);
    expect(grenadier.archetypes).toEqual(health.archetypes);
  });

  it("defaults to more arrangements before fewer archetypes, with a separate inventory-match order", () => {
    const create = (names: string[], tertiary: ArmorStat) =>
      t5ArrangementFromPieces(names.map((archetype) => ({ archetype, tertiary }) as T5Candidate));
    const simple = create(Array(5).fill("Grenedier"), ArmorStat.StatHealth);
    simple.covered = 5;
    simple.owned = 5;
    const names = ["Brawler", "Brawler", "Grenedier", "Grenedier", "Grenedier"];
    const flexible = [
      create(names, ArmorStat.StatHealth),
      create(names, ArmorStat.StatClass),
      create(names, ArmorStat.StatMelee),
    ];
    expect(groupT5Archetypes([simple, ...flexible])[0].arrangements.length).toBe(3);
    expect(groupT5Archetypes([simple, ...flexible], "matches")[0].covered).toBe(5);
    const tie = [create(names, ArmorStat.StatHealth), simple];
    expect(groupT5Archetypes(tie)[0].archetypes.length).toBe(1);
  });
  it("sends only newly found results and reconstructs the retained snapshot from deltas", () => {
    const first = { key: "first", covered: 0, owned: 0, pieces: [] } as unknown as T5Solution;
    const second = { key: "second", covered: 2, owned: 2, pieces: [] } as unknown as T5Solution;
    const snapshot = (results: T5Solution[]): T5SearchUpdate => ({
      results,
      checked: 1,
      total: 10,
      feasible: results.length,
      evaluations: 2,
      complete: false,
      done: false,
      warnings: [],
    });
    const encode = createT5UpdateEncoder();
    const initial = encode(snapshot([first]));
    const next = encode(snapshot([first, second]));
    expect(next.results).toEqual([second]);
    expect(encode(snapshot([first, second])).results).toEqual([]);
    const state = applyT5Update(applyT5Update(undefined, initial), next);
    expect(state.results).toEqual([first, second]);
    const limited = encode(snapshot([second]));
    expect(limited.results).toEqual([]);
    expect(limited.removedResultKeys).toEqual(["first"]);
    expect(applyT5Update(state, limited).results).toEqual([second]);
    expect(applyT5Update(applyT5Update(state, next), next).results).toEqual([first, second]);
  });

  it("does not retransmit arrangements already sent by the worker", () => {
    const base = t5ArrangementFromPieces(
      Array.from({ length: 5 }, () => ({
        archetype: "Grenedier",
        tertiary: ArmorStat.StatClass,
      })) as T5Candidate[]
    );
    const second = t5ArrangementFromPieces(
      Array.from({ length: 5 }, () => ({
        archetype: "Grenedier",
        tertiary: ArmorStat.StatMelee,
      })) as T5Candidate[]
    );
    const encode = createT5UpdateEncoder();
    const update: T5SearchUpdate = {
      arrangements: [base],
      results: [],
      checked: 1,
      total: 2,
      feasible: 1,
      evaluations: 1,
      complete: false,
      done: false,
      warnings: [],
    };
    const first = encode(update);
    const next = encode({ ...update, arrangements: [base, second], checked: 2 });
    expect(next.arrangements).toEqual([second]);
    const restored = applyT5Update(applyT5Update(undefined, first), next);
    expect(restored.arrangements?.map((entry) => entry.key)).toEqual([base.key, second.key]);
    expect(
      applyT5Update(restored, { ...update, delta: true, arrangements: [], done: true }).arrangements
        ?.length
    ).toBe(2);
  });

  it("preserves the feasible mod allocation while grouping and streaming an empty base", () => {
    const pieces = Array.from(
      { length: 5 },
      () => ({ archetype: "Grenedier", tertiary: ArmorStat.StatClass }) as T5Candidate
    );
    const allocation = {
      usedMods: [StatModifier.MAJOR_GRENADE, StatModifier.MINOR_CLASS],
      usedArtifice: [StatModifier.ARTIFICE_HEALTH],
    };
    const base = t5ArrangementFromPieces(pieces, undefined, allocation);
    allocation.usedMods.length = 0;
    expect(base.modAllocation?.usedMods).toEqual([
      StatModifier.MAJOR_GRENADE,
      StatModifier.MINOR_CLASS,
    ]);
    const encode = createT5UpdateEncoder();
    const update: T5SearchUpdate = {
      arrangements: [base],
      results: [],
      checked: 1,
      total: 1,
      feasible: 1,
      evaluations: 1,
      complete: false,
      done: false,
      warnings: [],
    };
    const restored = applyT5Update(undefined, encode(update));
    const [grouped] = groupT5Arrangements([], restored.arrangements);
    expect(grouped.modAllocation).toEqual(base.modAllocation);
    expect(grouped.builds).toEqual([]);
    expect(t5ArrangementFromPieces(pieces).key).toBe(base.key);
  });
  it("splits search into small disjoint archetype-prefix tasks", () => {
    const choices = T5_ARCHETYPES.map((archetype) => archetype.name);
    const tasks = createT5SearchTasks(Array.from({ length: 5 }, () => choices));
    expect(tasks.length).toBe(12 ** 3);
    expect(new Set(tasks.map((task) => task.archetypes.join("/"))).size).toBe(tasks.length);
    expect(tasks.every((task) => task.archetypes.length === 3)).toBeTrue();
    expect(tasks.slice(0, 12).every((task) => new Set(task.archetypes).size === 1)).toBeTrue();
    expect(new Set(tasks[tasks.length - 1].archetypes).size).toBe(3);
    expect(tasks.length * 12 ** 2).toBe(12 ** 5);
    expect(createT5SearchTasks([["Grenedier"], ["Brawler"], ["Demolitionist"]])).toEqual([
      { archetypes: ["Grenedier", "Brawler", "Demolitionist"] },
    ]);
    expect(createT5SearchTasks([[], choices, choices])).toEqual([]);
  });
  it("offers five, ten, fifteen minutes and unlimited, defaulting to ten minutes", () => {
    expect(DEFAULT_T5_SEARCH_BUDGET_MS).toBe(600000);
    expect(T5_SEARCH_BUDGETS.map((budget) => budget.value)).toEqual([300000, 600000, 900000, 0]);
    expect(T5_SEARCH_BUDGETS.map((budget) => budget.label)).toEqual([
      "5 minutes",
      "10 minutes",
      "15 minutes",
      "Unlimited",
    ]);
  });

  it("saves configs and arrangements without inventory matches or retained builds", () => {
    const config = BuildConfiguration.buildEmptyConfiguration();
    config.statModLimits = { maxMods: 3, maxMajorMods: 2 };
    const arrangement = t5ArrangementFromPieces(
      Array.from(
        { length: 5 },
        () => ({ archetype: "Grenedier", tertiary: ArmorStat.StatClass }) as T5Candidate
      )
    );
    arrangement.inventoryMatch = {
      covered: 5,
      owned: 5,
      proven: true,
      feasible: true,
      pieces: [{ name: "INVENTORY_ONLY", instanceId: "PRIVATE_INSTANCE" } as T5Candidate],
    };
    arrangement.builds = [{ key: "OWNED_BUILD" } as T5Solution];
    arrangement.covered = 5;
    arrangement.owned = 5;
    arrangement.buildState = "loading";
    const saved = createT5SavedRun(
      " Test run ",
      config,
      { achievableOnly: true, timeLimitMs: 600000, workerLimit: 4 },
      [arrangement],
      false
    );
    expect(saved.name).toBe("Test run");
    expect(saved.configuration.statModLimits).toEqual({ maxMods: 3, maxMajorMods: 2 });
    const serialized = JSON.stringify(saved);
    for (const excluded of [
      "inventoryMatch",
      "INVENTORY_ONLY",
      "PRIVATE_INSTANCE",
      "OWNED_BUILD",
      "buildState",
      '"owned"',
      '"covered"',
    ]) {
      expect(serialized).not.toContain(excluded);
    }
    const [restored] = restoreT5Arrangements(saved.arrangements);
    expect(restored.builds).toEqual([]);
    expect(restored.covered).toBe(0);
    expect(restored.owned).toBe(0);
    expect(restored.inventoryMatch).toBeUndefined();
    expect(restored.modAllocation).toEqual(arrangement.modAllocation);
    config.statModLimits.maxMods = 5;
    expect(saved.configuration.statModLimits.maxMods).toBe(3);
  });
  it("defines twelve distinct ordered archetypes with four tertiary choices each", () => {
    expect(T5_ARCHETYPES.length).toBe(12);
    expect(new Set(T5_ARCHETYPES.map((entry) => `${entry.primary}/${entry.secondary}`)).size).toBe(
      12
    );
    const signatures = new Set<string>();
    for (const archetype of T5_ARCHETYPES) {
      const tertiaries = t5Tertiaries(archetype);
      expect(tertiaries.length).toBe(4);
      for (const tertiary of tertiaries) {
        const stats = t5BaseStats(archetype, tertiary);
        expect(stats.reduce((sum, value) => sum + value, 0)).toBe(75);
        expect(stats[archetype.primary]).toBe(30);
        expect(stats[archetype.secondary]).toBe(25);
        expect(stats[tertiary]).toBe(20);
        expect(stats.filter((value) => value === 0).length).toBe(3);
        expect(t5ArchetypeIndex(stats)).toBe(T5_ARCHETYPES.indexOf(archetype));
        signatures.add(stats.join(","));
      }
    }
    expect(signatures.size).toBe(48);
  });

  it("rejects a tertiary inside the archetype pair", () => {
    expect(() => t5BaseStats(T5_ARCHETYPES[0], ArmorStat.StatHealth)).toThrowError();
    expect(() => t5BaseStats(T5_ARCHETYPES[0], ArmorStat.StatGrenade)).toThrowError();
  });

  it("reflects main gearsets, mod limits and stat boosts without replacing playground targets", () => {
    const main = BuildConfiguration.buildEmptyConfiguration();
    const theorizer = BuildConfiguration.buildEmptyConfiguration();
    main.armorRequirements = Array(4).fill({ gearSetHash: 123 });
    main.statModLimits = { maxMods: 3, maxMajorMods: 1 };
    main.enabledMods = [1 as ModOrAbility];
    theorizer.minimumStatTiers[ArmorStat.StatHealth].value = 18;
    reflectMainCalculationSettings(theorizer, main);
    expect(theorizer.armorRequirements).toEqual(main.armorRequirements);
    expect(theorizer.statModLimits).toEqual({ maxMods: 3, maxMajorMods: 1 });
    expect(theorizer.enabledMods).toEqual(main.enabledMods);
    expect(theorizer.selectedModElement).toBe(main.selectedModElement);
    expect(theorizer.minimumStatTiers[ArmorStat.StatHealth].value).toBe(18);
    expect(theorizer.allowLegacyLegendaryArmor).toBeFalse();
    expect(theorizer.allowLegacyExoticArmor).toBeFalse();
    expect(theorizer.allowBlueArmorPieces).toBeFalse();
    theorizer.armorRequirements.length = 0;
    theorizer.enabledMods.length = 0;
    theorizer.statModLimits.maxMods = 0;
    expect(main.armorRequirements.length).toBe(4);
    expect(main.enabledMods.length).toBe(1);
    expect(main.statModLimits.maxMods).toBe(3);
  });

  it("groups builds by archetype counts and floating tertiary counts", () => {
    const build = (
      key: string,
      archetypes: string[],
      covered: number,
      tertiary: ArmorStat
    ): T5Solution =>
      ({
        key,
        patternKey: key,
        covered,
        owned: covered,
        pieces: archetypes.map((archetype, index) => ({
          archetype,
          tertiary,
          tuningStat: index % 6,
        })),
      }) as T5Solution;
    const first = build(
      "first",
      ["Grenedier", "Reaver", "Grenedier", "Paragon", "Demolitionist"],
      1,
      ArmorStat.StatHealth
    );
    const second = build(
      "second",
      ["Reaver", "Grenedier", "Paragon", "Demolitionist", "Grenedier"],
      3,
      ArmorStat.StatClass
    );
    first.pieces.forEach((piece) => {
      piece.tertiary = ArmorStat.StatClass;
    });
    const third = build(
      "third",
      ["Colossus", "Reaver", "Grenedier", "Paragon", "Demolitionist"],
      2,
      ArmorStat.StatMelee
    );
    const groups = groupT5Arrangements([first, third, second]);
    expect(groups.length).toBe(2);
    expect(groups[0].builds.map((entry) => entry.key)).toEqual(["second", "first"]);
    expect(groups[0].covered).toBe(3);
    expect(groups[0].archetypes.find((entry) => entry.name === "Grenedier")?.count).toBe(2);
    expect(groups[0].archetypes.reduce((sum, entry) => sum + entry.count, 0)).toBe(5);
    expect(
      groups[0].archetypes.every((entry) => !("tertiary" in entry) && !("tuningStat" in entry))
    ).toBeTrue();
    expect(groups[0].builds[0].pieces[0].tertiary).toBe(ArmorStat.StatClass);
    expect(groups[0].tertiaries).toEqual([{ stat: ArmorStat.StatClass, count: 5 }]);
  });

  it("keeps equal archetype counts separate when their required tertiary counts differ", () => {
    const build = (key: string, tertiary: ArmorStat) =>
      ({
        key,
        covered: 0,
        owned: 0,
        pieces: Array.from({ length: 5 }, () => ({ archetype: "Grenedier", tertiary })),
      }) as T5Solution;
    expect(
      groupT5Arrangements([
        build("health", ArmorStat.StatHealth),
        build("class", ArmorStat.StatClass),
      ]).length
    ).toBe(2);
  });

  it("prefers fewer distinct archetypes before inventory coverage", () => {
    const build = (key: string, names: string[], covered: number) =>
      ({
        key,
        covered,
        owned: covered,
        pieces: names.map((archetype) => ({ archetype, tertiary: ArmorStat.StatClass })),
      }) as T5Solution;
    const groups = groupT5Arrangements([
      build("many", ["Grenedier", "Brawler", "Demolitionist", "Paragon", "Reaver"], 5),
      build("two", ["Grenedier", "Grenedier", "Grenedier", "Brawler", "Brawler"], 3),
      build("one", Array(5).fill("Grenedier"), 0),
    ]);
    expect(groups.map((group) => group.archetypes.length)).toEqual([1, 2, 5]);
  });

  it("groups tuning-family requirements by counts rather than binding them to archetypes or tertiaries", () => {
    const pieces = ["Brawler", "Demolitionist", "Grenedier", "Paragon"].map((archetype, index) => ({
      archetype,
      tertiary: [
        ArmorStat.StatGrenade,
        ArmorStat.StatSuper,
        ArmorStat.StatClass,
        ArmorStat.StatClass,
      ][index],
    }));
    const first = {
      key: "first",
      pieces,
      covered: 0,
      owned: 0,
      tuningMods: [388618952, 455024236, 455024236, 455024236],
    } as T5Solution;
    const swapped = {
      ...first,
      key: "swapped",
      tuningMods: [455024236, 388618952, 455024236, 455024236],
    };
    const [arrangement] = groupT5Arrangements([first, swapped]);
    expect(groupT5Arrangements([first, swapped]).length).toBe(1);
    expect(arrangement.tunings).toEqual([
      { stat: ArmorStat.StatHealth, count: 1 },
      { stat: ArmorStat.StatGrenade, count: 3 },
    ]);
    expect(arrangement.builds.length).toBe(2);
    expect(
      groupT5Arrangements([
        first,
        { ...swapped, key: "different", tuningMods: Array(4).fill(455024236) },
      ]).length
    ).toBe(2);
  });

  it("allows floating tertiaries only when a legal assignment to the archetypes exists", () => {
    const archetypes = [4, 4, 4, 2, 5].map((index) => ({ ...T5_ARCHETYPES[index], count: 1 }));
    expect(
      canAssignT5Tertiaries({
        archetypes,
        tertiaries: [
          { stat: ArmorStat.StatHealth, count: 1 },
          { stat: ArmorStat.StatClass, count: 3 },
          { stat: ArmorStat.StatMelee, count: 1 },
        ],
      })
    ).toBeTrue();
    expect(
      canAssignT5Tertiaries({
        archetypes: [{ ...T5_ARCHETYPES[2], count: 5 }],
        tertiaries: [
          { stat: ArmorStat.StatHealth, count: 1 },
          { stat: ArmorStat.StatClass, count: 4 },
        ],
      })
    ).toBeFalse();
    expect(
      canAssignT5Tertiaries({
        archetypes: [
          { ...T5_ARCHETYPES[2], count: 3 },
          { ...T5_ARCHETYPES[5], count: 2 },
        ],
        tertiaries: [
          { stat: ArmorStat.StatHealth, count: 3 },
          { stat: ArmorStat.StatClass, count: 2 },
        ],
      })
    ).toBeFalse();
  });

  it("does not duplicate child builds when incremental results repeat a generation", () => {
    const solution = {
      key: "same",
      covered: 0,
      owned: 0,
      pieces: Array.from({ length: 5 }, () => ({ archetype: "Grenedier" })),
    } as T5Solution;
    const [group] = groupT5Arrangements([solution, solution]);
    expect(group.archetypes[0].count).toBe(5);
    expect(group.builds.length).toBe(1);
  });

  it("merges partial worker results and uses only witnessed per-stat maxima", () => {
    const update = (
      key: string,
      covered: number,
      maximum: number[],
      done: boolean
    ): T5SearchUpdate => ({
      results: [{ key, covered, owned: covered } as T5Solution],
      checked: 2,
      total: 10,
      feasible: 1,
      evaluations: 3,
      complete: done,
      done,
      warnings: [],
      maximumPossibleStats: maximum,
      maximaChecked: 6,
      maximaComplete: true,
    });
    const first = update("first", 1, [30, 100, 150, 125, 30, 30], false);
    const second = update("second", 3, [25, 110, 150, 130, 25, 25], true);
    const merged = mergeT5SearchUpdates([first, second], 2, 150000, 300000);
    expect(merged.results.map((result) => result.key)).toEqual(["second", "first"]);
    expect(merged.maximumPossibleStats).toEqual([30, 110, 150, 130, 30, 30]);
    expect(merged.budgetProgress).toBe(50);
    expect(merged.workersActive).toBe(1);
    expect(merged.workersFinished).toBe(1);
    expect(merged.done).toBeFalse();
    expect(merged.evaluations).toBe(6);
    expect(
      mergeT5SearchUpdates([{ ...first, done: true, complete: true }, second], 2, 150000, 0)
        .complete
    ).toBeTrue();
    expect(mergeT5SearchUpdates([first], 2, 150000, 0).budgetProgress).toBeUndefined();
    const stoppedEarly = mergeT5SearchUpdates(
      [
        { ...first, done: true },
        { ...second, complete: false },
      ],
      2,
      12000,
      300000
    );
    expect(stoppedEarly.stopReason).not.toBe("budget");
    expect(stoppedEarly.budgetProgress).toBe(4);
  });
});
