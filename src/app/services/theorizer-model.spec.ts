import { BuildConfiguration } from "../data/buildConfiguration";
import { ArmorStat } from "../data/enum/armor-stat";
import { T5Candidate } from "../data/theorizer";
import {
  createT5OptimizationModel,
  initializeT5Optimizer,
  solveT5Optimization,
  t5BoundsCanReach,
  t5MaximumStats,
  t5OptimizationSolution,
  t5StatBounds,
  t5StatCeilings,
} from "./theorizer-model";
import { T5_ARCHETYPES, t5BaseStats, t5Tertiaries } from "../data/theorizer";

describe("dedicated T5 maxima model", () => {
  beforeAll(() => initializeT5Optimizer("/assets/highs.wasm"));
  it("rejects irrelevant Weapon-primary choices from cheap stat bounds", () => {
    const config = BuildConfiguration.buildEmptyConfiguration();
    config.calculateTierFiveTuning = true;
    config.minimumStatTiers[ArmorStat.StatGrenade].value = 20;
    config.minimumStatTiers[ArmorStat.StatMelee].value = 10;
    config.minimumStatTiers[ArmorStat.StatSuper].value = 10;
    config.minimumStatTiers[ArmorStat.StatClass].value = 7;
    const choices = T5_ARCHETYPES.flatMap((archetype) =>
      t5Tertiaries(archetype).map((tertiary) => {
        const stats = t5BaseStats(archetype, tertiary);
        return {
          resilience: stats[0],
          strength: stats[1],
          discipline: stats[2],
          intellect: stats[3],
          recovery: stats[4],
          mobility: stats[5],
          archetypeStats: [archetype.primary, archetype.secondary, tertiary],
          masterworkLevel: 5,
          isExotic: 0,
          perk: 0,
          hypotheticalTuning: true,
          tuningStat: 0,
        } as T5Candidate;
      })
    );
    const domains = Array.from({ length: 5 }, () => choices);
    for (const weapon of [20, 25, 30]) {
      domains[0] = choices.filter((item) => item.mobility === weapon);
      expect(t5BoundsCanReach(t5StatBounds(domains, config), config)).toBeFalse();
    }
  });
  it("bounds individual solves and folds equivalent exotic identities before building the matrix", () => {
    const config = BuildConfiguration.buildEmptyConfiguration();
    const item = {
      resilience: 0,
      strength: 20,
      discipline: 30,
      intellect: 25,
      recovery: 0,
      mobility: 0,
      archetypeStats: [1, 2, 3],
      masterworkLevel: 5,
      isExotic: 1,
      tier: 5,
      perk: 0,
      gearSetHash: null,
      gearSetPerkSelectable: false,
      instanceId: null,
      tuningStat: 0,
    } as T5Candidate;
    const duplicates = Array.from({ length: 100 }, (_, index) => ({ ...item, hash: index }));
    const model = createT5OptimizationModel(
      Array.from({ length: 5 }, () => duplicates),
      config
    );
    expect(model.rolls.length).toBe(10);
    expect(model.model.options?.timeout).toBe(150);
  });

  it("maximizes fixed T5 stats without enumerating five-piece permutations", () => {
    const config = BuildConfiguration.buildEmptyConfiguration();
    config.calculateTierFiveTuning = false;
    const item = {
      resilience: 0,
      strength: 20,
      discipline: 30,
      intellect: 25,
      recovery: 0,
      mobility: 0,
      archetypeStats: [1, 2, 3],
      masterworkLevel: 5,
      isExotic: 0,
      tier: 5,
      perk: 0,
      gearSetHash: null,
      gearSetPerkSelectable: false,
      instanceId: "owned",
      tuningStat: 0,
    } as T5Candidate;
    const domains = Array.from({ length: 5 }, () => [item]);
    expect(t5MaximumStats(domains, config)[ArmorStat.StatHealth]).toBe(80);
    config.minimumStatTiers[ArmorStat.StatGrenade].value = 20;
    expect(t5MaximumStats(domains, config)[ArmorStat.StatHealth]).toBe(30);
  });

  it("calculates stat ceilings without initializing or calling the optimizer", () => {
    const config = BuildConfiguration.buildEmptyConfiguration();
    const item = {
      resilience: 0,
      strength: 20,
      discipline: 30,
      intellect: 25,
      recovery: 0,
      mobility: 0,
      archetypeStats: [1, 2, 3],
      masterworkLevel: 5,
      isExotic: 0,
      tier: 5,
      perk: 0,
      gearSetHash: null,
      gearSetPerkSelectable: false,
      instanceId: null,
      tuningStat: 0,
    } as T5Candidate;
    const started = performance.now();
    expect(
      t5StatCeilings(
        Array.from({ length: 5 }, () => [item]),
        config
      )[ArmorStat.StatGrenade]
    ).toBe(200);
    expect(performance.now() - started).toBeLessThan(100);
  });

  it("includes the tuning sacrifice in every subset bound", () => {
    const config = BuildConfiguration.buildEmptyConfiguration();
    config.calculateTierFiveTuning = true;
    config.statModLimits = { maxMods: 0, maxMajorMods: 0 };
    const item = {
      resilience: 0,
      strength: 20,
      discipline: 30,
      intellect: 25,
      recovery: 0,
      mobility: 0,
      archetypeStats: [1, 2, 3],
      masterworkLevel: 5,
      isExotic: 0,
      tier: 5,
      perk: 0,
      gearSetHash: null,
      gearSetPerkSelectable: false,
      instanceId: null,
      hypotheticalTuning: true,
      tuningStat: ArmorStat.StatHealth,
    } as T5Candidate;
    const base = [5, 20, 30, 25, 5, 5];
    const tunings = [
      [0, 0, 0, 0, 0, 0],
      [1, 0, 0, 0, 1, 1],
    ];
    for (let positive = 0; positive < 6; positive++) {
      for (let negative = 0; negative < 6; negative++) {
        if (positive === negative) continue;
        const tuning = Array<number>(6).fill(0);
        tuning[positive] = 5;
        tuning[negative] = -5;
        tunings.push(tuning);
      }
    }
    const bounds = t5StatBounds([[item]], config);
    for (let mask = 1; mask < 64; mask++) {
      const expected = Math.max(
        ...tunings.map((tuning) =>
          base.reduce(
            (sum, value, stat) => sum + (mask & (1 << stat) ? value + tuning[stat] : 0),
            0
          )
        )
      );
      expect(bounds[mask]).withContext(`stat subset ${mask}`).toBe(expected);
    }
    expect(bounds[63]).toBe(93);
    expect(
      tunings.slice(2).every((tuning) => tuning.reduce((sum, value) => sum + value, 0) === 0)
    ).toBeTrue();
  });

  it("does not treat the arithmetic ceiling as a reachable tuning assignment", () => {
    const config = BuildConfiguration.buildEmptyConfiguration();
    config.calculateTierFiveTuning = true;
    config.statModLimits = { maxMods: 0, maxMajorMods: 0 };
    const item = {
      resilience: 0,
      strength: 20,
      discipline: 30,
      intellect: 25,
      recovery: 0,
      mobility: 0,
      archetypeStats: [1, 2, 3],
      masterworkLevel: 5,
      isExotic: 0,
      tier: 5,
      perk: 0,
      gearSetHash: null,
      gearSetPerkSelectable: false,
      instanceId: null,
      hypotheticalTuning: true,
      tuningStat: ArmorStat.StatHealth,
    } as T5Candidate;
    const base = [25, 100, 150, 125, 25, 25];
    for (let stat = 1; stat < 6; stat++)
      config.minimumStatTiers[stat as ArmorStat].value = base[stat] / 10;
    const domains = Array.from({ length: 5 }, () => [item]);
    expect(t5MaximumStats(domains, config)[ArmorStat.StatHealth]).toBe(30);
    expect(t5StatCeilings(domains, config)[ArmorStat.StatHealth]).toBe(40);
    config.minimumStatTiers[ArmorStat.StatHealth].value = 4;
    expect(solveT5Optimization(createT5OptimizationModel(domains, config)).feasible).toBeFalse();
    config.minimumStatTiers[ArmorStat.StatHealth].value = 3;
    const problem = createT5OptimizationModel(domains, config);
    const solution = t5OptimizationSolution(problem, solveT5Optimization(problem))!;
    expect(solution.result.statsWithMods[ArmorStat.StatHealth]).toBe(30);
    expect(solution.tuningMods).toEqual(Array(5).fill(3122197216));
  });

  it("honors minor-only allowances and keeps exotic tuning independent of instance tuning", () => {
    const config = BuildConfiguration.buildEmptyConfiguration();
    config.calculateTierFiveTuning = true;
    config.statModLimits = { maxMods: 1, maxMajorMods: 0 };
    const roll = {
      resilience: 0,
      strength: 20,
      discipline: 30,
      intellect: 25,
      recovery: 0,
      mobility: 0,
      archetypeStats: [1, 2, 3],
      masterworkLevel: 5,
      isExotic: 0,
      tier: 5,
      perk: 0,
      gearSetHash: null,
      gearSetPerkSelectable: false,
      instanceId: "owned",
      tuningStat: ArmorStat.StatHealth,
    } as T5Candidate;
    const domains = Array.from({ length: 5 }, () => [roll]);
    domains[0] = [{ ...roll, isExotic: 1, tuningStat: ArmorStat.StatSuper }];
    expect(t5MaximumStats(domains, config)[ArmorStat.StatHealth]).toBe(55);
    config.minimumStatTiers[ArmorStat.StatHealth].value = 5.5;
    const problem = createT5OptimizationModel(domains, config);
    const solution = t5OptimizationSolution(problem, solveT5Optimization(problem))!;
    expect(solution.result.statsWithMods[ArmorStat.StatHealth]).toBe(55);
    expect(solution.result.usedMods.length).toBe(1);
    expect(solution.tuningMods.every((hash) => hash !== 3122197216)).toBeTrue();
    expect(solution.pieces.filter((piece) => piece.isExotic).length).toBe(1);
  });
});
