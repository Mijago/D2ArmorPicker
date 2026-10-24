import { DestinyClass, TierType } from "bungie-api-ts/destiny2";
import { BuildConfiguration } from "../data/buildConfiguration";
import { FORCE_USE_NO_EXOTIC } from "../data/constants";
import { ArmorPerkOrSlot, ArmorStat, STAT_MOD_VALUES } from "../data/enum/armor-stat";
import {
  canAssignT5Tertiaries,
  createT5ArchetypeCountTasks,
  createT5TertiaryTasks,
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
  prioritizeT5InventoryMatches,
  searchT5,
  T5_SLOTS,
  t5ArrangementConfiguration,
  t5FitCoverageUpperBound,
  t5SourceAllowed,
} from "./theorizer-search";
import { initializeT5Optimizer, solveT5Optimization, T5OptimizationModel } from "./theorizer-model";

describe("T5 theorizer search", () => {
  beforeAll(() => initializeT5Optimizer("/assets/highs.wasm"));
  it("partitions canonical archetype groups without losing floating slot assignments or duplicating arrangements", () => {
    const input = request();
    input.group = undefined;
    input.stage = "arrangements";
    input.skipMaxima = true;
    input.timeLimitMs = 10000;
    input.arrangementConfig = t5ArrangementConfiguration(input.config);
    input.arrangementConfig.calculateTierFiveTuning = false;
    const prepared = prepareT5Search(input);
    const narrow = (domains: typeof prepared.domains) =>
      domains.map(
        (domain) =>
          new Map(
            [...domain]
              .filter(([name]) => name === "Grenedier" || name === "Demolitionist")
              .map(([name, pieces]) => [
                name,
                pieces.filter((piece) => piece.tertiary === ArmorStat.StatHealth),
              ])
          )
      );
    prepared.arrangementDomains = narrow(prepared.arrangementDomains);
    prepared.theoryDomains = narrow(prepared.theoryDomains);
    prepared.archetypeDomains = narrow([prepared.archetypeDomains])[0];
    const full = [...searchT5(input, undefined, prepared)].pop()!;
    expect(full.complete).toBeTrue();
    const keys = new Set<string>();
    for (const task of createT5ArchetypeCountTasks([...prepared.archetypeDomains.keys()])) {
      const result = [...searchT5({ ...input, task }, undefined, prepared)].pop()!;
      expect(result.complete).toBeTrue();
      for (const arrangement of result.arrangements!) {
        expect(keys.has(arrangement.key)).toBeFalse();
        keys.add(arrangement.key);
        for (const entry of arrangement.archetypes)
          expect(entry.count).toBe(task.archetypes.filter((name) => name === entry.name).length);
      }
    }
    expect(keys.size).toBe(6);
    expect([...keys].sort()).toEqual(
      full.arrangements!.map((arrangement) => arrangement.key).sort()
    );
  });

  it("keeps discovery unchanged when ordinary armor slots are relabeled", () => {
    const input = request();
    input.stage = "arrangements";
    input.skipMaxima = true;
    input.timeLimitMs = 10000;
    input.task = { archetypes: Array(5).fill("Grenedier"), archetypeCounts: true };
    input.arrangementConfig = t5ArrangementConfiguration(input.config);
    input.arrangementConfig.calculateTierFiveTuning = false;
    input.inventory = [0, 1, 2, 3, 4].map((slot) => item(slot, ArmorStat.StatHealth));
    const run = (request: T5SearchRequest) => {
      const prepared = prepareT5Search(request);
      expect(
        [...prepared.archetypeDomains.values()].flat().every((piece) => piece.slot === 0)
      ).toBeTrue();
      prepared.archetypeDomains.set(
        "Grenedier",
        prepared.archetypeDomains
          .get("Grenedier")!
          .filter((piece) => piece.tertiary === ArmorStat.StatHealth)
      );
      const final = [...searchT5(request, undefined, prepared)].pop()!;
      expect(final.complete).toBeTrue();
      return final.arrangements!.map((arrangement) => arrangement.key).sort();
    };
    expect(
      run({
        ...input,
        inventory: input.inventory.map((piece) => ({
          ...piece,
          slot: T5_SLOTS[(T5_SLOTS.indexOf(piece.slot) + 2) % 5],
        })),
      })
    ).toEqual(run(input));
  });

  it("applies exotic class-item perk selections after arrangement discovery", () => {
    const input = request();
    const exotic = { ...item(4, ArmorStat.StatClass, true), exoticPerkHash: [11, 22] };
    input.config.selectedExotics = [exotic.hash];
    input.config.selectedExoticPerks = [11, 22];
    input.inventory = [exotic];
    input.manifest = [exotic];
    const prepared = prepareT5Search(input);
    const arrangementClassItems = [...prepared.archetypeDomains.values()]
      .flat()
      .filter((piece) => piece.isExotic && piece.slot === T5_SLOTS[4]);
    expect(arrangementClassItems.length).toBe(1);
    expect(arrangementClassItems[0].tertiary).toBe(ArmorStat.StatClass);
    expect(arrangementClassItems[0].exoticPerkHash).toEqual([11, 22]);
    const fitClassItems = [...prepared.domains[4].values()]
      .flat()
      .filter((piece) => piece.isExotic);
    const observedFitClassItem = fitClassItems.find((piece) => !!piece.instanceId);
    expect(observedFitClassItem).toBeDefined();
    expect(observedFitClassItem?.tertiary).toBe(ArmorStat.StatClass);
    expect(observedFitClassItem?.exoticPerkHash).toEqual([11, 22]);
    expect(observedFitClassItem?.slot).toBe(T5_SLOTS[4]);

    const otherPerks = {
      ...input,
      config: structuredClone(input.config),
    };
    otherPerks.config.selectedExoticPerks = [33, 44] as never;
    const filtered = prepareT5Search(otherPerks);
    expect(filtered.archetypeDomains).toEqual(prepared.archetypeDomains);
    expect([...filtered.domains[4].values()].flat().filter((piece) => piece.isExotic)).toEqual([]);
  });

  it("generates unique floating tertiary tasks and routes parent exclusions only to the matching child", () => {
    const task = { archetypes: Array(5).fill("Grenedier"), archetypeCounts: true };
    const parent = t5ArrangementFromPieces(
      Array.from(
        { length: 5 },
        (_, index) =>
          ({
            archetype: "Grenedier",
            tertiary: index === 0 ? ArmorStat.StatHealth : ArmorStat.StatClass,
          }) as T5Candidate
      )
    );
    const children = createT5TertiaryTasks(
      { ...task, excludedArrangements: [parent] },
      new Map([["Grenedier", [ArmorStat.StatClass, ArmorStat.StatHealth]]])
    );
    const keys = children.map((child) => JSON.stringify(child.tertiaries));
    expect(children.length).toBe(6);
    expect(new Set(keys).size).toBe(children.length);
    const matchingChild = children.find(
      (child) => JSON.stringify(child.tertiaries) === JSON.stringify(parent.tertiaries)
    );
    expect(matchingChild?.excludedArrangements).toEqual([parent]);
    expect(
      children
        .filter((child) => child !== matchingChild)
        .every((child) => !child.excludedArrangements?.length)
    ).toBeTrue();
    expect(
      children.every(
        (child) => child.tertiaries?.reduce((sum, tertiary) => sum + tertiary.count, 0) === 5
      )
    ).toBeTrue();
  });
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

  it("does not retain builds with fewer than three available armor pieces", () => {
    const input = request();
    input.skipMaxima = true;
    input.inventory = [item(0, ArmorStat.StatClass), item(1, ArmorStat.StatClass)];
    const updates = [...searchT5(input)];
    const final = updates[updates.length - 1];
    expect(final.feasible).toBe(0);
    expect(final.results).toEqual([]);
    expect(final.complete).toBeTrue();
  });

  it("keeps low-coverage arrangements discoverable and reports their actual fit", () => {
    for (const covered of [0, 1, 2, 3]) {
      const input = request();
      input.stage = "arrangements";
      input.skipMaxima = true;
      input.inventory = Array.from({ length: covered }, (_, slot) =>
        item(slot, ArmorStat.StatClass)
      );
      const updates = [...searchT5(input)];
      const final = updates[updates.length - 1];
      expect(final.arrangements!.length).toBeGreaterThan(0);
      const prepared = prepareT5Search(input);
      const first = inventoryFitT5(final.arrangements![0], input, prepared);
      expect(first.covered).toBeLessThanOrEqual(covered);
      const compatible = t5ArrangementFromPieces(
        Array.from(
          { length: 5 },
          () => ({ archetype: "Grenedier", tertiary: ArmorStat.StatClass }) as T5Candidate
        ),
        Array(5).fill(null)
      );
      expect(inventoryFitT5(compatible, input, prepared).covered).toBe(covered);
      expect(final.results).toEqual([]);
    }
  });

  it("keeps discovery compact regardless of duplicate inventory and gearset identities", () => {
    const counts: number[] = [];
    const priorities: number[][] = [];
    for (const copies of [1, 30]) {
      const input = request();
      input.stage = "arrangements";
      input.skipMaxima = true;
      input.inventory = [0, 1, 2].flatMap((slot) =>
        Array.from({ length: copies }, (_, copy) => ({
          ...item(slot, ArmorStat.StatClass),
          itemInstanceId: `owned-${slot}-${copy}`,
          gearSetHash: copy + 1,
        }))
      );
      const solve = (problem: T5OptimizationModel) => {
        counts.push(problem.rolls.length);
        priorities.push(problem.rolls.map((roll) => problem.model.variables[roll.name]["score"]));
        expect(problem.rolls.every((roll) => roll.item.instanceId === null)).toBeTrue();
        expect(problem.model.constraints["covered"]).toBeUndefined();
        return { feasible: false, result: 0, optimal: true };
      };
      [...searchT5(input, solve)];
    }
    expect(counts).toEqual([40, 40]);
    expect(priorities[1]).toEqual(priorities[0]);
    expect(priorities[0].every((score) => score < 1000)).toBeTrue();
  });

  it("keeps arrangement domains independent from armor, gearset, and class-item perk filters", () => {
    const input = request();
    input.stage = "arrangements";
    const exotic = { ...item(4, ArmorStat.StatClass, true), exoticPerkHash: [11, 22] };
    const legendary = { ...item(0, ArmorStat.StatClass), gearSetHash: 123 };
    input.inventory = [legendary, exotic];
    input.manifest = [exotic];
    const selected = {
      ...input,
      config: structuredClone(input.config),
    };
    selected.config.selectedExotics = [exotic.hash];
    selected.config.selectedExoticPerks = [11, 22];
    selected.config.armorRequirements = Array.from({ length: 4 }, () => ({ gearSetHash: 999 }));

    const basePrepared = prepareT5Search(input);
    const selectedPrepared = prepareT5Search(selected);
    const domainSnapshot = (domains: ReadonlyMap<string, readonly T5Candidate[]>) =>
      [...domains]
        .map(([name, pieces]) => [
          name,
          pieces.map((piece) => [piece.tertiary, piece.isExotic, piece.hash, piece.exoticPerkHash]),
        ])
        .sort(([first], [second]) => String(first).localeCompare(String(second)));

    expect(domainSnapshot(selectedPrepared.archetypeDomains)).toEqual(
      domainSnapshot(basePrepared.archetypeDomains)
    );
    const ownedDomainCandidates = (pieces: T5Candidate[]) =>
      pieces.filter((piece) => !!piece.instanceId);
    expect(
      ownedDomainCandidates(selectedPrepared.domains[0].get("Grenedier") ?? []).length
    ).toBeLessThan(ownedDomainCandidates(basePrepared.domains[0].get("Grenedier") ?? []).length);
  });

  it("retains only three-, four- and five-piece covered builds", () => {
    for (const covered of [3, 4, 5]) {
      const input = request();
      input.skipMaxima = true;
      input.inventory = Array.from({ length: covered }, (_, slot) =>
        item(slot, ArmorStat.StatClass)
      );
      const updates = [...searchT5(input)];
      const final = updates[updates.length - 1];
      expect(final.results.length).withContext(`${covered} available pieces`).toBeGreaterThan(0);
      expect(final.results[0].covered).toBe(covered);
      expect(
        final.results.every((result) => result.covered >= 3 && result.covered <= covered)
      ).toBeTrue();
    }
  });

  it("splits builds into disjoint, exhaustive worker partitions", () => {
    const input = request();
    input.skipMaxima = true;
    input.timeLimitMs = 10000;
    input.inventory = [
      item(2, ArmorStat.StatClass),
      item(3, ArmorStat.StatClass),
      item(4, ArmorStat.StatClass),
    ];
    input.arrangement = t5ArrangementFromPieces(
      [
        ArmorStat.StatClass,
        ArmorStat.StatClass,
        ArmorStat.StatClass,
        ArmorStat.StatHealth,
        ArmorStat.StatMelee,
      ].map((tertiary) => ({ archetype: "Grenedier", tertiary }) as T5Candidate)
    );
    const full = [...searchT5(input)].pop()!;
    expect(full.complete).toBeTrue();
    expect(full.results.length).toBeGreaterThan(0);
    const keys = new Set<string>();
    let busy = 0;
    for (let index = 0; index < 3; index++) {
      const partition = [...searchT5({ ...input, buildPartition: { index, count: 3 } })].pop()!;
      expect(partition.complete).toBeTrue();
      if (partition.results.length) busy++;
      for (const result of partition.results) {
        expect(keys.has(result.key)).toBeFalse();
        keys.add(result.key);
        expect(result.covered).toBeGreaterThanOrEqual(3);
      }
    }
    expect(busy).toBeGreaterThan(1);
    expect([...keys].sort()).toEqual(full.results.map((result) => result.key).sort());
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
    expect(eligibleT5Inventory(input.inventory, input.config)).toEqual([owned, disabled]);
    input.achievableOnly = true;
    const domainPieces = buildT5Domains(input).flatMap((domain) => [...domain.values()].flat());
    expect(domainPieces.map((piece) => piece.instanceId)).toEqual([owned.itemInstanceId]);
    input.config.includeVendorRolls = true;
    expect(eligibleT5Inventory(input.inventory, input.config)).toEqual([owned, vendor, disabled]);
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
    input.inventory = [
      item(0, ArmorStat.StatClass),
      item(1, ArmorStat.StatClass),
      item(2, ArmorStat.StatMelee),
    ];
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
    expect(match.covered).toBe(3);
    expect(match.owned).toBe(3);
    expect(match.pieces.map((piece) => piece.instanceId)).toEqual([
      "instance-0",
      "instance-1",
      "instance-2",
    ]);
    expect(arrangement.builds).toEqual([]);
  });

  it("prioritizes arrangements with 4/5+ possible armor fit coverage", () => {
    const candidate = (slot: number, tertiary: ArmorStat): T5Candidate => ({
      ...item(slot, tertiary),
      archetype: "Grenedier",
      tertiary,
      instanceId: `fit-${slot}`,
    });
    const highPotential = t5ArrangementFromPieces([
      ...Array.from(
        { length: 4 },
        () => ({ archetype: "Grenedier", tertiary: ArmorStat.StatClass }) as T5Candidate
      ),
      { archetype: "Grenedier", tertiary: ArmorStat.StatHealth } as T5Candidate,
    ]);
    const lowerPotential = t5ArrangementFromPieces([
      ...Array.from(
        { length: 2 },
        () => ({ archetype: "Grenedier", tertiary: ArmorStat.StatClass }) as T5Candidate
      ),
      ...Array.from(
        { length: 3 },
        () => ({ archetype: "Grenedier", tertiary: ArmorStat.StatHealth }) as T5Candidate
      ),
    ]);
    const domains = [
      new Map([
        [
          "Grenedier",
          [
            candidate(0, ArmorStat.StatClass),
            candidate(1, ArmorStat.StatClass),
            candidate(2, ArmorStat.StatClass),
            candidate(3, ArmorStat.StatClass),
            candidate(4, ArmorStat.StatHealth),
            candidate(0, ArmorStat.StatMelee),
            candidate(1, ArmorStat.StatMelee),
            candidate(2, ArmorStat.StatMelee),
          ],
        ],
      ]),
    ];

    expect(t5FitCoverageUpperBound(highPotential, domains)).toBe(5);
    expect(t5FitCoverageUpperBound(lowerPotential, domains)).toBe(3);
    expect(prioritizeT5InventoryMatches([lowerPotential, highPotential], domains)).toEqual([
      highPotential,
      lowerPotential,
    ]);
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
    input.inventory = [
      item(0, ArmorStat.StatClass),
      item(1, ArmorStat.StatClass),
      item(2, ArmorStat.StatClass),
    ];
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
    input.inventory = [
      item(0, ArmorStat.StatClass),
      item(1, ArmorStat.StatClass),
      item(2, ArmorStat.StatClass),
    ];
    input.stage = "arrangements";
    input.config.minimumStatTiers[ArmorStat.StatGrenade].value = 20;
    const iterator = searchT5(input);
    let update = iterator.next().value!;
    while (!update.arrangements?.length && !update.done) update = iterator.next().value!;
    const allocation = update.arrangements[0].modAllocation;
    expect(update.results).toEqual([]);
    expect(update.arrangements[0].builds).toEqual([]);
    expect(allocation.usedMods.length).toBeGreaterThan(0);
    expect(allocation.usedMods.length).toBeLessThanOrEqual(input.config.statModLimits.maxMods);
    expect(
      allocation.usedMods.every(
        (modifier: keyof typeof STAT_MOD_VALUES) =>
          STAT_MOD_VALUES[modifier][0] === ArmorStat.StatGrenade
      )
    ).toBeTrue();
    expect(allocation.usedArtifice).toEqual([]);
    iterator.return(undefined);
  });

  it("retained builds honor the arrangement tertiary multiset without fixing it to slots", () => {
    const input = request();
    input.inventory = [
      item(0, ArmorStat.StatHealth),
      item(1, ArmorStat.StatClass),
      item(2, ArmorStat.StatClass),
    ];
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
    input.inventory = [
      item(0, ArmorStat.StatClass),
      item(1, ArmorStat.StatClass),
      item(2, ArmorStat.StatClass),
    ];
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

  it("pauses retry-heavy discovery and resumes the same model with its backoff intact", () => {
    const input = request();
    input.stage = "arrangements";
    input.skipMaxima = true;
    input.timeLimitMs = 2000;
    const problems = new Set<T5OptimizationModel>();
    const timeouts: number[] = [];
    const solve = (problem: T5OptimizationModel) => {
      problems.add(problem);
      timeouts.push(problem.model.options!.timeout!);
      return { feasible: false, result: 0, optimal: false };
    };
    const iterator = searchT5(input, solve, undefined, { maxRetriesWithoutProgress: 2 });
    let update = iterator.next().value!;
    while (update.stopReason !== "slice") update = iterator.next().value!;
    expect(update.taskDeferred).toBeTrue();
    expect(update.complete).toBeFalse();
    expect(update.solverRetries).toBe(2);
    update = iterator.next().value!;
    expect(update.done).toBeFalse();
    expect(update.solverRetries).toBe(3);
    expect(problems.size).toBe(1);
    expect(timeouts).toEqual([150, 300, 600]);
    iterator.return(undefined);
  });

  it("preserves exclusion cuts and complete enumeration across discovery slices", () => {
    const input = request();
    input.stage = "arrangements";
    input.skipMaxima = true;
    input.timeLimitMs = 300;
    input.arrangementConfig = t5ArrangementConfiguration(input.config);
    input.arrangementConfig.calculateTierFiveTuning = false;
    const prepared = prepareT5Search(input);
    prepared.arrangementDomains = prepared.arrangementDomains.map(
      (domain) =>
        new Map(
          [...domain].map(([key, pieces]) => [
            key,
            pieces.filter(
              (piece) =>
                piece.tertiary === ArmorStat.StatClass || piece.tertiary === ArmorStat.StatHealth
            ),
          ])
        )
    );
    prepared.theoryDomains = prepared.theoryDomains.map(
      (domain) =>
        new Map(
          [...domain].map(([key, pieces]) => [
            key,
            pieces.filter(
              (piece) =>
                piece.tertiary === ArmorStat.StatClass || piece.tertiary === ArmorStat.StatHealth
            ),
          ])
        )
    );
    let now = 0;
    spyOn(Date, "now").and.callFake(() => now);
    const problems = new Set<T5OptimizationModel>();
    const solve = (problem: T5OptimizationModel) => {
      problems.add(problem);
      const result = solveT5Optimization(problem);
      now += 100;
      return result;
    };
    const iterator = searchT5(input, solve, prepared, { maxRetriesWithoutProgress: 3 });
    const snapshots = [];
    let pauses = 0;
    for (let next = iterator.next(); !next.done; next = iterator.next()) {
      snapshots.push(next.value);
      if (next.value.stopReason === "slice") {
        pauses++;
        now += 60000;
      }
    }
    const final = snapshots[snapshots.length - 1];
    expect(pauses).toBeGreaterThan(0);
    expect(problems.size).toBe(1);
    expect(final.complete).toBeTrue();
    expect(final.arrangements!.length).toBe(6);
    expect(new Set(final.arrangements!.map((arrangement) => arrangement.key)).size).toBe(6);
    expect(final.evaluations).toBe(7);
  });

  it("does not list extra directional tuning when the same pieces reach the targets without it", () => {
    const input = request();
    input.stage = "arrangements";
    input.skipMaxima = true;
    input.timeLimitMs = 10000;
    input.task = { archetypes: Array(5).fill("Grenedier"), archetypeCounts: true };
    input.arrangementConfig = t5ArrangementConfiguration(input.config);
    input.arrangementConfig.calculateTierFiveTuning = true;
    const prepared = prepareT5Search(input);
    prepared.archetypeDomains.set(
      "Grenedier",
      prepared.archetypeDomains
        .get("Grenedier")!
        .filter(
          (piece) =>
            piece.tertiary === ArmorStat.StatClass || piece.tertiary === ArmorStat.StatHealth
        )
    );
    const final = [...searchT5(input, undefined, prepared)].pop()!;
    expect(final.complete).toBeTrue();
    expect(final.arrangements!.length).toBe(6);
    for (const arrangement of final.arrangements!)
      expect(arrangement.tunings.every((entry) => entry.stat === null)).toBeTrue();
  });

  it("collapses tertiary and tuning variants into the smallest requirements that reach the targets", () => {
    const input = request();
    input.stage = "arrangements";
    input.skipMaxima = true;
    input.timeLimitMs = 20000;
    input.config.minimumStatTiers[ArmorStat.StatGrenade].value = 17;
    input.config.minimumStatTiers[ArmorStat.StatClass].value = 9;
    input.task = {
      archetypes: ["Grenedier", "Grenedier", "Demolitionist", "Demolitionist", "Demolitionist"],
      archetypeCounts: true,
    };
    input.arrangementConfig = t5ArrangementConfiguration(input.config);
    input.arrangementConfig.calculateTierFiveTuning = true;
    const prepared = prepareT5Search(input);
    const narrow = (pieces: T5Candidate[]) =>
      pieces.filter(
        (piece) =>
          piece.anyTertiary ||
          piece.tertiary === ArmorStat.StatClass ||
          piece.tertiary === ArmorStat.StatHealth ||
          piece.tertiary === ArmorStat.StatMelee
      );
    for (const name of [...prepared.archetypeDomains.keys()])
      if (name !== "Grenedier" && name !== "Demolitionist") prepared.archetypeDomains.delete(name);
    for (const [name, pieces] of prepared.archetypeDomains)
      prepared.archetypeDomains.set(name, narrow(pieces));
    const discover = (anyTertiary: boolean) => {
      const domains = new Map(
        [...prepared.archetypeDomains].map(([name, pieces]) => [
          name,
          anyTertiary ? pieces : pieces.filter((piece) => !piece.anyTertiary),
        ])
      );
      const final = [
        ...searchT5(input, undefined, { ...prepared, archetypeDomains: domains }),
      ].pop()!;
      expect(final.complete).toBeTrue();
      return final.arrangements!;
    };
    const collapsed = discover(true);
    const exact = discover(false);
    const count = (entries: { stat: ArmorStat | null; count: number }[], stat: ArmorStat | null) =>
      entries.find((entry) => entry.stat === stat)?.count ?? 0;
    const covers = (small: (typeof exact)[number], large: (typeof exact)[number]) =>
      [null, 0, 1, 2, 3, 4, 5].every(
        (stat) =>
          count(small.tertiaries, stat as ArmorStat | null) <=
            count(large.tertiaries, stat as ArmorStat | null) &&
          (stat === null || count(small.tunings, stat) <= count(large.tunings, stat))
      );
    expect(collapsed.some((arrangement) => canAssignT5Tertiaries(arrangement))).toBeTrue();
    expect(collapsed.some((arrangement) => arrangement.tertiaries.length < 3)).toBeTrue();
    expect(collapsed.length).toBeLessThan(exact.length);
    for (const arrangement of exact)
      expect(collapsed.some((candidate) => covers(candidate, arrangement)))
        .withContext(arrangement.key)
        .toBeTrue();
    for (const arrangement of collapsed)
      expect(collapsed.filter((candidate) => covers(candidate, arrangement)).length)
        .withContext(arrangement.key)
        .toBe(1);
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

  it("uses source flags but ignores hidden disabled-item settings", () => {
    const input = request();
    const vendor = { ...item(0, ArmorStat.StatClass), source: InventoryArmorSource.Vendor };
    expect(t5SourceAllowed(vendor, input.config)).toBeFalse();
    input.config.includeVendorRolls = true;
    expect(t5SourceAllowed(vendor, input.config)).toBeTrue();
    input.config.disabledItems = [vendor.itemInstanceId];
    expect(t5SourceAllowed(vendor, input.config)).toBeTrue();
  });

  it("normalizes arrangement discovery to target stats, mod limits, and subclass stat modifiers", () => {
    const config = BuildConfiguration.buildEmptyConfiguration();
    config.minimumStatTiers[ArmorStat.StatHealth] = { fixed: true, value: 12 };
    config.statModLimits = { maxMods: 3, maxMajorMods: 1 };
    config.enabledMods = [1 as never, 2 as never];
    config.selectedExotics = [123];
    config.selectedExoticPerks = [11, 22] as never;
    config.armorRequirements = [{ gearSetHash: 123 }];
    config.disabledItems = ["disabled-item"];
    config.includeVendorRolls = false;
    config.ignoreSunsetArmor = true;

    const arrangementConfig = t5ArrangementConfiguration(config);

    expect(arrangementConfig.minimumStatTiers).toEqual(config.minimumStatTiers);
    expect(arrangementConfig.statModLimits).toEqual(config.statModLimits);
    expect(arrangementConfig.enabledMods).toEqual(config.enabledMods);
    expect(arrangementConfig.selectedExotics).toEqual([]);
    expect(arrangementConfig.selectedExoticPerks).toEqual([
      ArmorPerkOrSlot.Any,
      ArmorPerkOrSlot.Any,
    ]);
    expect(arrangementConfig.armorRequirements).toEqual([]);
    expect(arrangementConfig.disabledItems).toEqual([]);
    expect(arrangementConfig.includeVendorRolls).toBeTrue();
    expect(arrangementConfig.ignoreSunsetArmor).toBeFalse();
    expect(arrangementConfig.calculateTierFiveTuning).toBeTrue();
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

  it("can freely select the required tertiary in the remaining hypothetical slots", () => {
    const input = request();
    input.inventory = [
      item(0, ArmorStat.StatClass),
      item(1, ArmorStat.StatClass),
      item(2, ArmorStat.StatClass),
    ];
    input.config.statModLimits = { maxMods: 0, maxMajorMods: 0 };
    input.config.minimumStatTiers[ArmorStat.StatClass].value = 10;
    const updates = [...searchT5(input)];
    const solution = updates[updates.length - 1].results[0];
    expect(solution.pieces.every((piece) => piece.tertiary === ArmorStat.StatClass)).toBeTrue();
    expect(solution.result.statsWithMods[ArmorStat.StatClass]).toBe(100);
    expect(solution.covered).toBe(3);
  });

  it("retains distinct tertiary generations instead of one winner per archetype tuple", () => {
    const input = request();
    input.inventory = [
      item(0, ArmorStat.StatClass),
      item(1, ArmorStat.StatClass),
      item(2, ArmorStat.StatClass),
    ];
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
    input.inventory = [
      item(0, ArmorStat.StatHealth),
      item(1, ArmorStat.StatClass),
      item(2, ArmorStat.StatClass),
    ].map((piece, index) => ({
      ...piece,
      tuningStat: index === 0 ? ArmorStat.StatHealth : ArmorStat.StatGrenade,
    }));
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
