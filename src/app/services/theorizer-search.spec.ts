import { DestinyClass, TierType } from "bungie-api-ts/destiny2";
import { BuildConfiguration } from "../data/buildConfiguration";
import { FORCE_USE_NO_EXOTIC } from "../data/constants";
import { ArmorPerkOrSlot, ArmorStat, STAT_MOD_VALUES } from "../data/enum/armor-stat";
import {
  canAssignT5Tertiaries,
  T5_ARCHETYPES,
  T5Candidate,
  T5SearchRequest,
  T5Solution,
  t5ArrangementFromPieces,
  t5BaseStats,
} from "../data/theorizer";
import { InventoryArmorSource, IInventoryArmor } from "../data/types/IInventoryArmor";
import { ArmorSystem } from "../data/types/IManifestArmor";
import {
  assignT5Gearsets,
  buildT5Domains,
  eligibleT5Inventory,
  inventoryFitT5,
  matchT5Pattern,
  missingT5Gearsets,
  prepareT5Search,
  searchT5,
  T5_SLOTS,
  t5SourceAllowed,
} from "./theorizer-search";
import { initializeT5Optimizer } from "./theorizer-model";

describe("T5 theorizer search", () => {
  beforeAll(() => initializeT5Optimizer("/assets/highs.wasm"));
  function request(): T5SearchRequest {
    const config = BuildConfiguration.buildEmptyConfiguration();
    config.characterClass = DestinyClass.Titan;
    config.selectedExotics = [FORCE_USE_NO_EXOTIC];
    config.calculateTierFiveTuning = false;
    return {
      config,
      inventory: [],
      manifest: [],
      achievableOnly: false,
      timeLimitMs: 200,
      stage: "builds",
      group: Array(5).fill("Grenedier"),
    };
  }

  function item(slot: number, tertiary: ArmorStat, exotic = false): IInventoryArmor {
    const stats = t5BaseStats(T5_ARCHETYPES[4], tertiary);
    return {
      id: slot,
      hash: 123,
      name: "Test armor",
      icon: "",
      slot: T5_SLOTS[slot],
      clazz: DestinyClass.Titan,
      isExotic: exotic ? 1 : 0,
      armorSystem: ArmorSystem.Armor3,
      tier: 5,
      resilience: stats[0],
      strength: stats[1],
      discipline: stats[2],
      intellect: stats[3],
      recovery: stats[4],
      mobility: stats[5],
      archetypeStats: [ArmorStat.StatGrenade, ArmorStat.StatSuper, tertiary],
      masterworkLevel: 5,
      gearSetHash: null,
      gearSetPerkSelectable: false,
      perk: ArmorPerkOrSlot.None,
      tuningStat: ArmorStat.StatHealth,
      source: InventoryArmorSource.Inventory,
      itemInstanceId: `instance-${slot}`,
      exoticPerkHash: [],
      isSunset: false,
      isFeatured: false,
      energyLevel: 10,
      description: "",
      rarity: exotic ? TierType.Exotic : TierType.Superior,
      watermarkIcon: "",
      itemType: 2,
      itemSubType: 0,
      investmentStats: [],
      socketEntries: [],
      created_at: 0,
      updated_at: 0,
    };
  }

  it("retains hypothetical patterns without claiming any inventory coverage", () => {
    const updates = [...searchT5(request())];
    const final = updates[updates.length - 1];
    expect(final.feasible).toBeGreaterThan(0);
    expect(final.results[0].covered).toBe(0);
    expect(final.results[0].pieces.length).toBe(5);
    expect(final.results[0].result.statsWithMods[ArmorStat.StatGrenade]).toBe(150);
  });

  it("exposes the same eligible inventory to the armor pool and calculation domains", () => {
    const input = request();
    const owned = item(0, ArmorStat.StatClass);
    const vendor = { ...owned, itemInstanceId: "vendor", source: InventoryArmorSource.Vendor };
    const disabled = { ...owned, itemInstanceId: "disabled" };
    input.config.includeVendorRolls = false;
    input.config.disabledItems = [disabled.itemInstanceId];
    input.inventory = [
      owned,
      vendor,
      disabled,
      { ...owned, clazz: DestinyClass.Hunter },
      { ...owned, tier: 4 },
      item(1, ArmorStat.StatClass, true),
      { ...owned, resilience: 19 },
    ];
    expect(eligibleT5Inventory(input.inventory, input.config)).toEqual([owned]);
    input.achievableOnly = true;
    expect(
      buildT5Domains(input)
        .flatMap((domain) => [...domain.values()].flat())
        .map((piece) => piece.instanceId)
    ).toEqual([owned.itemInstanceId]);
    input.config.includeVendorRolls = true;
    expect(eligibleT5Inventory(input.inventory, input.config)).toEqual([owned, vendor]);
  });

  it("filters armor-pool gear to selected gearsets when all five slots are constrained", () => {
    const input = request();
    const first = { ...item(1, ArmorStat.StatClass), gearSetHash: 11 };
    const second = { ...item(2, ArmorStat.StatClass), gearSetHash: 22 };
    const other = { ...item(3, ArmorStat.StatClass), gearSetHash: 33 };
    const flexible = {
      ...item(4, ArmorStat.StatClass),
      gearSetHash: null,
      gearSetPerkSelectable: true,
    };
    input.config.armorRequirements = [11, 11, 22, 22].map((gearSetHash) => ({ gearSetHash }));
    input.config.selectedExotics = [777];
    const exotic = { ...item(0, ArmorStat.StatClass, true), hash: 777 };
    const sameSlotLegendary = { ...first, slot: T5_SLOTS[0] };
    const filtered = eligibleT5Inventory(
      [first, second, other, flexible, exotic, sameSlotLegendary],
      input.config,
      [{ hash: 777, slot: T5_SLOTS[0] } as never]
    );
    expect(filtered).toEqual([first, second, flexible, exotic]);
    input.config.selectedExotics = [FORCE_USE_NO_EXOTIC];
    expect(eligibleT5Inventory([first, second, other, flexible], input.config)).toEqual([
      first,
      second,
      other,
      flexible,
    ]);
  });

  it("reports only gearset requirements not supplied by matched armor", () => {
    const input = request();
    input.config.armorRequirements = [
      { gearSetHash: 11 },
      { gearSetHash: 11 },
      { gearSetHash: 22 },
      { gearSetHash: 22 },
    ];
    const pieces = [
      { ...item(0, ArmorStat.StatClass), instanceId: "owned", gearSetHash: 11 },
      { ...item(1, ArmorStat.StatClass), instanceId: null, gearSetHash: 11 },
      { ...item(2, ArmorStat.StatClass), instanceId: "owned-chest", gearSetHash: 22 },
      { ...item(3, ArmorStat.StatClass), instanceId: "owned-legs", gearSetHash: 22 },
    ] as unknown as T5Candidate[];
    expect(missingT5Gearsets(pieces, input.config)).toEqual([{ hash: 11, count: 1 }]);
    input.config.armorRequirements = [];
    expect(missingT5Gearsets(pieces, input.config)).toEqual([]);
  });

  it("uses an owned gearset wildcard before requiring a missing piece from that set", () => {
    const input = request();
    input.config.armorRequirements = [{ gearSetHash: 11 }];
    const pieces = [
      { ...item(0, ArmorStat.StatClass), instanceId: null },
      { ...item(1, ArmorStat.StatClass), instanceId: "owned", gearSetPerkSelectable: true },
    ] as unknown as T5Candidate[];
    const assigned = assignT5Gearsets(pieces, input.config)!;
    expect(assigned[1].gearSetHash).toBe(11);
    expect(missingT5Gearsets(assigned, input.config)).toEqual([]);
  });

  it("fits available armor directly into a floating arrangement without enumerating retained builds", () => {
    const input = request();
    input.inventory = [item(0, ArmorStat.StatClass), item(2, ArmorStat.StatMelee)];
    const arrangement = t5ArrangementFromPieces(
      [
        ArmorStat.StatClass,
        ArmorStat.StatClass,
        ArmorStat.StatClass,
        ArmorStat.StatMelee,
        ArmorStat.StatMelee,
      ].map((tertiary) => ({ archetype: "Grenedier", tertiary }) as T5Candidate),
      Array(5).fill(3122197216)
    );
    const match = inventoryFitT5(arrangement, input, prepareT5Search(input));
    expect(match.feasible).toBeTrue();
    expect(match.proven).toBeTrue();
    expect(match.covered).toBe(2);
    expect(match.owned).toBe(2);
    expect(match.pieces.map((piece) => piece.instanceId)).toEqual(["instance-0", "instance-2"]);
    expect(arrangement.builds).toEqual([]);
  });

  it("reuses prepared domains without reading raw inventory or manifest for each task", () => {
    const input = request();
    const prepared = prepareT5Search(input);
    const cached: T5SearchRequest = {
      ...input,
      get inventory(): never {
        throw new Error("Inventory was rebuilt");
      },
      get manifest(): never {
        throw new Error("Manifest was rebuilt");
      },
    };
    const first = searchT5(cached, undefined, prepared);
    expect(first.next().value!.total).toBe(1);
    first.return(undefined);
    const second = searchT5({ ...input, stage: "builds", skipMaxima: true }, undefined, prepared);
    expect(second.next().value!.total).toBe(1);
    second.return(undefined);
    expect(prepared.domains[0].get("Grenedier")?.length).toBe(4);
    expect(prepared.theoryDomains[0].get("Grenedier")?.length).toBe(4);
  });

  it("publishes archetype and floating tertiary arrangements before calculating retained builds", () => {
    const input = request();
    input.stage = "arrangements";
    const iterator = searchT5(input);
    let update = iterator.next().value!;
    while (!update.arrangements?.length && !update.done) update = iterator.next().value!;
    expect(update.arrangements.length).toBeGreaterThan(0);
    expect(update.results).toEqual([]);
    expect(update.arrangements[0].builds).toEqual([]);
    expect(
      update.arrangements[0].tertiaries.reduce(
        (sum: number, entry: { count: number }) => sum + entry.count,
        0
      )
    ).toBe(5);
    expect(canAssignT5Tertiaries(update.arrangements[0])).toBeTrue();
    expect(update.done).toBeFalse();
    iterator.return(undefined);
  });

  it("publishes the feasible stat mod allocation with an arrangement before builds are calculated", () => {
    const input = request();
    input.stage = "arrangements";
    input.config.minimumStatTiers[ArmorStat.StatGrenade].value = 20;
    const iterator = searchT5(input);
    let update = iterator.next().value!;
    while (!update.arrangements?.length && !update.done) update = iterator.next().value!;
    const allocation = update.arrangements[0].modAllocation;
    expect(update.results).toEqual([]);
    expect(update.arrangements[0].builds).toEqual([]);
    expect(allocation.usedMods.length).toBe(5);
    expect(
      allocation.usedMods.every(
        (modifier: keyof typeof STAT_MOD_VALUES) =>
          STAT_MOD_VALUES[modifier][0] === ArmorStat.StatGrenade &&
          STAT_MOD_VALUES[modifier][1] === 10
      )
    ).toBeTrue();
    expect(allocation.usedArtifice).toEqual([]);
    iterator.return(undefined);
  });

  it("retained builds honor the arrangement tertiary multiset without fixing it to slots", () => {
    const input = request();
    input.arrangement = t5ArrangementFromPieces(
      [
        ArmorStat.StatHealth,
        ArmorStat.StatClass,
        ArmorStat.StatClass,
        ArmorStat.StatClass,
        ArmorStat.StatMelee,
      ].map((tertiary) => ({ archetype: "Grenedier", tertiary }) as T5Candidate)
    );
    const updates = [...searchT5(input)];
    const results = updates[updates.length - 1].results;
    expect(results.length).toBeGreaterThan(1);
    for (const result of results) {
      expect(t5ArrangementFromPieces(result.pieces, result.tuningMods).key).toBe(
        input.arrangement.key
      );
      expect(
        result.pieces.every(
          (piece) =>
            piece.tertiary !== ArmorStat.StatGrenade && piece.tertiary !== ArmorStat.StatSuper
        )
      ).toBeTrue();
    }
    expect(
      new Set(results.map((result) => result.pieces.map((piece) => piece.tertiary).join(","))).size
    ).toBeGreaterThan(1);
  });

  it("publishes the first arrangement before completion, even before the throttle interval", () => {
    const input = request();
    const iterator = searchT5(input);
    let update = iterator.next().value!;
    while (!update.results.length && !update.done) update = iterator.next().value!;
    expect(update.results.length).toBeGreaterThan(0);
    expect(update.done).toBeFalse();
    iterator.return(undefined);
  });

  it("retries a solver timeout instead of treating it as partition exhaustion", () => {
    const input = request();
    const solve = jasmine
      .createSpy("solveT5Optimization")
      .and.returnValue({ feasible: false, result: 0, optimal: false });
    const iterator = searchT5(input, solve);
    let update = iterator.next().value!;
    while (!update.solverRetries && !update.done) update = iterator.next().value!;
    expect(update.done).toBeFalse();
    expect(update.solverRetries).toBe(1);
    expect(update.warnings.some((warning: string) => warning.includes("solver limit"))).toBeFalse();
    const next = iterator.next().value!;
    expect(next.solverRetries).toBe(2);
    expect(next.done).toBeFalse();
    expect(solve.calls.count()).toBe(2);
    iterator.return(undefined);
  });

  it("ranks the existing class-tertiary helmet and melee-tertiary exotic chest as two covered slots", () => {
    const input = request();
    input.config.selectedExotics = [];
    input.inventory = [item(0, ArmorStat.StatClass), item(2, ArmorStat.StatMelee, true)];
    const domains = buildT5Domains(input);
    const pieces = T5_SLOTS.map((_, slot) => {
      const candidates = domains[slot].get("Grenedier")!;
      return {
        ...candidates.find((candidate) =>
          slot === 2
            ? candidate.isExotic && candidate.tertiary === ArmorStat.StatMelee
            : !candidate.isExotic &&
              candidate.tertiary === (slot === 3 ? ArmorStat.StatMelee : ArmorStat.StatClass)
        )!,
        instanceId: null,
      };
    });
    const pattern: T5Solution = {
      key: "fixture",
      pieces,
      tuningMods: [null, null, null, null, null],
      covered: 0,
      owned: 0,
      result: {
        armor: [],
        useExoticClassItem: false,
        usedArtifice: [],
        usedMods: [],
        usedTuningMods: [],
        statsWithMods: [],
        statsWithoutMods: [],
        tuning: [0, 0, 0, 0, 0, 0],
      },
    };
    const solution = matchT5Pattern(pattern, domains, input.config, false)!;
    expect(solution.covered).toBe(2);
    expect(solution.owned).toBe(2);
    expect(solution.pieces[0].tertiary).toBe(ArmorStat.StatClass);
    expect(solution.pieces[2].tertiary).toBe(ArmorStat.StatMelee);
    expect(solution.pieces.filter((piece) => !piece.instanceId).length).toBe(3);
    expect(solution.missingRolls).toEqual([
      { archetype: "Grenedier", tertiary: ArmorStat.StatClass, tuning: null, count: 2 },
      { archetype: "Grenedier", tertiary: ArmorStat.StatMelee, tuning: null, count: 1 },
    ]);
    expect(
      solution.pieces
        .filter((piece) => !piece.instanceId)
        .every((piece) => piece.gearSetHash === null)
    ).toBeTrue();
  });

  it("uses source flags and disabled items for coverage", () => {
    const input = request();
    const vendor = { ...item(0, ArmorStat.StatClass), source: InventoryArmorSource.Vendor };
    expect(t5SourceAllowed(vendor, input.config)).toBeFalse();
    input.config.includeVendorRolls = true;
    expect(t5SourceAllowed(vendor, input.config)).toBeTrue();
    input.config.disabledItems = [vendor.itemInstanceId];
    expect(t5SourceAllowed(vendor, input.config)).toBeFalse();
  });

  it("excludes legacy armor and lower-tier Armor 3.0 from every calculation domain", () => {
    const input = request();
    input.achievableOnly = true;
    input.config.allowLegacyLegendaryArmor = true;
    input.config.allowLegacyExoticArmor = true;
    input.inventory = [
      { ...item(0, ArmorStat.StatClass), armorSystem: ArmorSystem.Armor2 },
      { ...item(1, ArmorStat.StatClass), tier: 4 },
      { ...item(2, ArmorStat.StatClass, true), armorSystem: ArmorSystem.Armor2 },
    ];
    expect(buildT5Domains(input).every((slot) => slot.size === 0)).toBeTrue();
  });

  it("requires all five source-supported slots in achievable-only mode", () => {
    const input = request();
    input.achievableOnly = true;
    input.inventory = [item(0, ArmorStat.StatClass)];
    const updates = [...searchT5(input)];
    expect(updates[updates.length - 1].results).toEqual([]);
  });

  it("does not let one gearset wildcard satisfy two required pieces", () => {
    const input = request();
    input.config.armorRequirements = [{ gearSetHash: 11 }, { gearSetHash: 11 }];
    const covered = {
      ...item(0, ArmorStat.StatClass),
      instanceId: "owned",
      gearSetPerkSelectable: true,
    } as unknown as T5Candidate;
    expect(assignT5Gearsets([covered], input.config)).toBeNull();
  });

  it("independently assigns legal stat mods for source-supported rolls", () => {
    const input = request();
    input.achievableOnly = true;
    input.inventory = T5_SLOTS.map((_, slot) => item(slot, ArmorStat.StatMelee));
    input.config.minimumStatTiers[ArmorStat.StatHealth].value = 5;
    const updates = [...searchT5(input)];
    const solution = updates[updates.length - 1].results[0];
    expect(solution.covered).toBe(5);
    expect(solution.result.statsWithMods[ArmorStat.StatHealth]).toBeGreaterThanOrEqual(50);
    expect(solution.result.usedMods.length).toBeLessThanOrEqual(input.config.statModLimits.maxMods);
  });

  it("keeps owned legendary tuning fixed and hypothetical legendary tuning flexible", () => {
    const input = request();
    input.inventory = [item(0, ArmorStat.StatClass)];
    const choices = buildT5Domains(input)[0].get("Grenedier")!;
    expect(choices.find((candidate) => candidate.instanceId)?.hypotheticalTuning).toBeUndefined();
    expect(
      choices
        .filter((candidate) => !candidate.instanceId)
        .every((candidate) => candidate.hypotheticalTuning)
    ).toBeTrue();
  });

  it("prunes unreachable targets without reporting false feasible groups", () => {
    const input = request();
    for (const target of Object.values(input.config.minimumStatTiers)) target.value = 20;
    const updates = [...searchT5(input)];
    const final = updates[updates.length - 1];
    expect(final.complete).toBeTrue();
    expect(final.results).toEqual([]);
    expect(final.maximumPossibleStats).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it("reports reachable maxima with unused mod capacity rather than just the displayed result", () => {
    const input = request();
    input.achievableOnly = true;
    input.inventory = T5_SLOTS.map((_, slot) => item(slot, ArmorStat.StatMelee));
    const updates = [...searchT5(input)];
    const final = updates[updates.length - 1];
    expect(final.maximumPossibleStats![ArmorStat.StatGrenade]).toBe(200);
    expect(final.maximumPossibleStats![ArmorStat.StatHealth]).toBe(80);
    expect(final.results[0].result.statsWithMods[ArmorStat.StatHealth]).toBe(30);
  });

  it("recalculates maxima when another stat consumes the mod budget", () => {
    const input = request();
    input.achievableOnly = true;
    input.inventory = T5_SLOTS.map((_, slot) => item(slot, ArmorStat.StatMelee));
    input.config.minimumStatTiers[ArmorStat.StatGrenade].value = 20;
    const updates = [...searchT5(input)];
    expect(updates[updates.length - 1].maximumPossibleStats![ArmorStat.StatHealth]).toBe(30);
  });

  it("shows no ghost maximum when tuning sacrifices would break another selected target", () => {
    const input = request();
    input.achievableOnly = true;
    input.config.calculateTierFiveTuning = true;
    input.config.statModLimits = { maxMods: 0, maxMajorMods: 0 };
    input.inventory = T5_SLOTS.map((_, slot) => item(slot, ArmorStat.StatMelee));
    const required = [0, 100, 150, 125, 25, 25];
    required.forEach((value, stat) => {
      input.config.minimumStatTiers[stat as ArmorStat].value = value / 10;
    });
    const updates = [...searchT5(input)];
    expect(updates[0].maximumPossibleStats).toEqual([0, 0, 0, 0, 0, 0]);
    expect(updates[updates.length - 1].maximumPossibleStats![ArmorStat.StatHealth]).toBe(30);
    expect(
      updates.some((update) => (update.maximumPossibleStats?.[ArmorStat.StatHealth] ?? 0) > 30)
    ).toBeFalse();
  });

  it("publishes all six maxima before checking any of the 254,803,968 possible rolls", () => {
    const input = request();
    input.group = undefined;
    const iterator = searchT5(input);
    let first = iterator.next().value!;
    while (first.maximaChecked !== 6) first = iterator.next().value!;
    expect(first.checked).toBe(0);
    expect(first.evaluations).toBe(0);
    expect(first.total).toBe(12 ** 5);
    expect(first.possibleRollCombinations).toBe(48 ** 5);
    expect(first.maximumPossibleStats).toEqual([200, 200, 200, 200, 200, 200]);
    iterator.return(undefined);
  });

  it("partitions the full theoretical domain without overlapping first-slot archetypes", () => {
    let groups = 0;
    let rolls = 0;
    for (let index = 0; index < 4; index++) {
      const input = request();
      input.group = undefined;
      input.partition = { index, count: 4 };
      const iterator = searchT5(input);
      const update = iterator.next().value!;
      expect(update.total).toBe(3 * 12 ** 4);
      groups += update.total;
      rolls += update.possibleRollCombinations ?? 0;
      iterator.return(undefined);
    }
    expect(groups).toBe(12 ** 5);
    expect(rolls).toBe(48 ** 5);
  });

  it("can freely select the required tertiary in every hypothetical slot", () => {
    const input = request();
    input.config.statModLimits = { maxMods: 0, maxMajorMods: 0 };
    input.config.minimumStatTiers[ArmorStat.StatClass].value = 10;
    const updates = [...searchT5(input)];
    const solution = updates[updates.length - 1].results[0];
    expect(solution.pieces.every((piece) => piece.tertiary === ArmorStat.StatClass)).toBeTrue();
    expect(solution.result.statsWithMods[ArmorStat.StatClass]).toBe(100);
    expect(solution.covered).toBe(0);
  });

  it("retains distinct tertiary generations instead of one winner per archetype tuple", () => {
    const input = request();
    const updates = [...searchT5(input)];
    const results = updates[updates.length - 1].results;
    expect(results.length).toBeGreaterThan(1);
    expect(new Set(results.map((solution) => solution.patternKey)).size).toBe(results.length);
    expect(
      new Set(results.map((solution) => solution.pieces.map((piece) => piece.tertiary).join(",")))
        .size
    ).toBeGreaterThan(1);
  });

  it("matches the screenshot pattern and reports only its three missing roll requirements", () => {
    const input = request();
    input.config.selectedExotics = [];
    input.config.calculateTierFiveTuning = true;
    const roll = (
      slot: number,
      archetype: number,
      tertiary: ArmorStat,
      exotic = false
    ): IInventoryArmor => {
      const stats = t5BaseStats(T5_ARCHETYPES[archetype], tertiary);
      return {
        ...item(slot, ArmorStat.StatClass, exotic),
        archetypeStats: [
          T5_ARCHETYPES[archetype].primary,
          T5_ARCHETYPES[archetype].secondary,
          tertiary,
        ],
        resilience: stats[0],
        strength: stats[1],
        discipline: stats[2],
        intellect: stats[3],
        recovery: stats[4],
        mobility: stats[5],
        tuningStat: exotic ? ArmorStat.StatHealth : ArmorStat.StatGrenade,
      };
    };
    input.inventory = [roll(1, 8, ArmorStat.StatSuper, true), roll(4, 4, ArmorStat.StatMelee)];
    const domains = buildT5Domains(input);
    const requirements = [
      [4, ArmorStat.StatClass],
      [8, ArmorStat.StatSuper],
      [5, ArmorStat.StatMelee],
      [4, ArmorStat.StatMelee],
      [4, ArmorStat.StatMelee],
    ] as const;
    const pieces = requirements.map(([archetype, tertiary], slot) => ({
      ...domains[slot]
        .get(T5_ARCHETYPES[archetype].name)!
        .find(
          (candidate) => candidate.tertiary === tertiary && !!candidate.isExotic === (slot === 1)
        )!,
      instanceId: null,
    }));
    const pattern: T5Solution = {
      key: "screenshot",
      pieces,
      tuningMods: Array(5).fill(4116389173),
      covered: 0,
      owned: 0,
      result: {
        armor: [],
        useExoticClassItem: false,
        usedArtifice: [],
        usedMods: [],
        usedTuningMods: [],
        statsWithMods: [],
        statsWithoutMods: [],
        tuning: [0, 0, 25, 0, 0, -25],
      },
    };
    const matched = matchT5Pattern(pattern, domains, input.config, false)!;
    expect(matched.covered).toBe(2);
    expect(matched.missingRolls).toEqual([
      {
        archetype: "Grenedier",
        tertiary: ArmorStat.StatClass,
        tuning: ArmorStat.StatGrenade,
        count: 1,
      },
      {
        archetype: "Demolitionist",
        tertiary: ArmorStat.StatMelee,
        tuning: ArmorStat.StatGrenade,
        count: 1,
      },
      {
        archetype: "Grenedier",
        tertiary: ArmorStat.StatMelee,
        tuning: ArmorStat.StatGrenade,
        count: 1,
      },
    ]);
    expect(
      matched.missingRequirements?.archetypes.map((entry) => ({
        name: entry.name,
        count: entry.count,
      }))
    ).toEqual([
      { name: "Demolitionist", count: 1 },
      { name: "Grenedier", count: 2 },
    ]);
    expect(matched.missingRequirements?.tertiaries).toEqual([
      { stat: ArmorStat.StatMelee, count: 2 },
      { stat: ArmorStat.StatClass, count: 1 },
    ]);
    expect(matched.missingRequirements?.tunings).toEqual([
      { stat: ArmorStat.StatGrenade, count: 3 },
    ]);
    expect(
      matched.missingRequirements?.archetypes.every(
        (entry) => !("tertiary" in entry) && !("tuning" in entry)
      )
    ).toBeTrue();
    const wrongFamily = domains[4]
      .get("Grenedier")!
      .map((candidate) => ({ ...candidate, tuningStat: ArmorStat.StatHealth }));
    domains[4].set("Grenedier", wrongFamily);
    expect(matchT5Pattern(pattern, domains, input.config, false)!.covered).toBe(1);
  });

  it("retains remaining gearset counts in the final missing requirements without binding them to a piece", () => {
    const input = request();
    input.config.armorRequirements = [{ gearSetHash: 11 }, { gearSetHash: 11 }];
    input.inventory = [{ ...item(0, ArmorStat.StatClass), gearSetHash: 11 }];
    const domains = buildT5Domains(input);
    const pieces = domains.map((domain) => ({
      ...domain.get("Grenedier")!.find((piece) => piece.tertiary === ArmorStat.StatClass)!,
      instanceId: null,
    }));
    const pattern: T5Solution = {
      key: "gearset",
      pieces,
      tuningMods: Array(5).fill(null),
      covered: 0,
      owned: 0,
      result: {
        armor: [],
        useExoticClassItem: false,
        usedArtifice: [],
        usedMods: [],
        usedTuningMods: [],
        statsWithMods: [],
        statsWithoutMods: [],
        tuning: [0, 0, 0, 0, 0, 0],
      },
    };
    const matched = matchT5Pattern(pattern, domains, input.config, false)!;
    expect(matched.covered).toBe(1);
    expect(matched.missingRequirements?.gearsets).toEqual([{ hash: 11, count: 1 }]);
    expect(
      matched.pieces
        .filter((piece) => !piece.instanceId)
        .every((piece) => piece.gearSetHash === null)
    ).toBeTrue();
  });

  it("retains tuning-family totals while their piece assignments float", () => {
    const input = request();
    input.config.calculateTierFiveTuning = true;
    const pieces = [
      ArmorStat.StatHealth,
      ArmorStat.StatClass,
      ArmorStat.StatClass,
      ArmorStat.StatClass,
      ArmorStat.StatMelee,
    ].map((tertiary) => ({ archetype: "Grenedier", tertiary }) as T5Candidate);
    input.arrangement = t5ArrangementFromPieces(
      pieces,
      [388618952, 455024236, 455024236, 455024236, 455024236]
    );
    const updates = [...searchT5(input)];
    const results = updates[updates.length - 1].results;
    expect(results.length).toBeGreaterThan(0);
    for (const result of results) {
      const arrangement = t5ArrangementFromPieces(result.pieces, result.tuningMods);
      expect(arrangement.key).toBe(input.arrangement.key);
      expect(arrangement.tunings).toEqual([
        { stat: ArmorStat.StatHealth, count: 1 },
        { stat: ArmorStat.StatGrenade, count: 4 },
      ]);
    }
  });

  it("publishes maxima for the live Grenade 200 / Class 100 case without enumerating groups", () => {
    const input = request();
    input.group = undefined;
    input.config.calculateTierFiveTuning = true;
    input.config.minimumStatTiers[ArmorStat.StatGrenade].value = 20;
    input.config.minimumStatTiers[ArmorStat.StatClass].value = 10;
    const started = Date.now();
    const iterator = searchT5(input);
    let first = iterator.next().value!;
    while (first.maximaChecked !== 6) first = iterator.next().value!;
    expect(first.maximumPossibleStats![ArmorStat.StatGrenade]).toBe(200);
    expect(first.maximumPossibleStats![ArmorStat.StatClass]).toBeGreaterThanOrEqual(100);
    expect(first.checked).toBe(0);
    expect(Date.now() - started).toBeLessThan(5000);
    iterator.return(undefined);
  });
});
