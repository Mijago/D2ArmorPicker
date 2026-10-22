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
  t5PreviewLimits,
  t5StatBounds,
  t5StatCeilings,
  createT5TargetModel,
  t5TargetLimits,
} from "./theorizer-model";
import { T5_ARCHETYPES, t5BaseStats, t5Tertiaries } from "../data/theorizer";

describe("dedicated T5 maxima model", () => {
  beforeAll(() => initializeT5Optimizer("/assets/highs.wasm"));
  it("keeps the live target model compact and its masterworked rolls at 90 or 93", () => {
    const model = createT5TargetModel(BuildConfiguration.buildEmptyConfiguration());
    expect(Object.keys(model.variables).length).toBe(120);
    const rolls = Object.entries(model.variables).filter(([name]) => name.startsWith("roll_"));
    expect(rolls.length).toBe(96);
    for (const [name, values] of rolls) {
      const stats = Array.from({ length: 6 }, (_, stat) => values[`stat_${stat}`]);
      expect(stats.slice().sort((first, second) => second - first)).toEqual(
        name.endsWith("_1") ? [30, 25, 20, 6, 6, 6] : [30, 25, 20, 5, 5, 5]
      );
    }
  });

  it("updates exact target limits without arrangement discovery", () => {
    const config = BuildConfiguration.buildEmptyConfiguration();
    const started = performance.now();
    const initial = t5TargetLimits(config);
    expect(initial.status).toBe("feasible");
    expect(initial.maximum).toEqual([200, 200, 200, 200, 200, 200]);
    config.minimumStatTiers[ArmorStat.StatGrenade].value = 20;
    config.minimumStatTiers[ArmorStat.StatClass].value = 10;
    const constrained = t5TargetLimits(config);
    expect(constrained.status).toBe("feasible");
    expect(constrained.maximum[ArmorStat.StatGrenade]).toBe(200);
    expect(constrained.maximum[ArmorStat.StatHealth]).toBeLessThan(200);
    console.info("T5 live limit benchmark (two requests)", performance.now() - started);
    for (const stat of [0, 1, 2, 3, 4, 5]) config.minimumStatTiers[stat as ArmorStat].value = 20;
    expect(t5TargetLimits(config).status).toBe("infeasible");
  });

  it("keeps limits verified when one 60-tier target is raised to 70", () => {
    const config = BuildConfiguration.buildEmptyConfiguration();
    for (let stat = 0; stat < 6; stat++) {
      config.minimumStatTiers[stat as ArmorStat] = { value: 6, fixed: false };
    }
    expect(t5TargetLimits(config).status).toBe("feasible");
    config.minimumStatTiers[ArmorStat.StatHealth].value = 7;
    const updated = t5TargetLimits(config);
    expect(updated.status).toBe("feasible");
  });

  it("previews maxima from the balanced-free model as lower bounds of the exact limits", () => {
    for (const [targets, mods] of [
      [[6, 6, 6, 6, 6, 6], { maxMods: 5, maxMajorMods: 3 }],
      [[7, 7, 7, 7, 7, 7], { maxMods: 5, maxMajorMods: 5 }],
    ] as const) {
      const config = BuildConfiguration.buildEmptyConfiguration();
      config.statModLimits = { ...mods };
      targets.forEach((value, stat) => {
        config.minimumStatTiers[stat as ArmorStat].value = value;
      });
      const preview = t5PreviewLimits(config)!;
      const exact = t5TargetLimits(config).maximum;
      expect(preview).withContext(targets.join("/")).not.toBeNull();
      preview.forEach((value, stat) => {
        expect(value).toBeLessThanOrEqual(exact[stat]);
        expect(value).toBeGreaterThan(exact[stat] - 5);
      });
    }
  });

  it("computes exact maxima for 90/90/90/90/0/90 with five major mods", () => {
    const config = BuildConfiguration.buildEmptyConfiguration();
    config.statModLimits = { maxMods: 5, maxMajorMods: 5 };
    [9, 9, 9, 9, 0, 9].forEach((value, stat) => {
      config.minimumStatTiers[stat as ArmorStat].value = value;
    });
    const limits = t5TargetLimits(config);
    expect(limits.status).toBe("feasible");
    expect(limits.maximumComplete).toBeTrue();
    expect(limits.maximum).toEqual([140, 140, 140, 140, 54, 140]);
  });

  it("computes exact maxima when every stat is balanced near the point budget", () => {
    const config = BuildConfiguration.buildEmptyConfiguration();
    [7, 7, 7, 7, 7, 7].forEach((value, stat) => {
      config.minimumStatTiers[stat as ArmorStat].value = value;
    });
    const limits = t5TargetLimits(config);
    expect(limits.maximumComplete).toBeTrue();
    expect(limits.maximum).toEqual([152, 152, 152, 152, 152, 152]);
    config.minimumStatTiers[ArmorStat.StatHealth].value = 20;
    expect(t5TargetLimits(config).status).toBe("infeasible");
  });

  it("keeps combined Health and Weapon 70-tier targets feasible with complete maxima", () => {
    for (const targets of [
      [7, 6, 6, 6, 6, 7],
      [6, 6, 6, 6, 6, 7],
    ]) {
      const config = BuildConfiguration.buildEmptyConfiguration();
      targets.forEach((value, stat) => {
        config.minimumStatTiers[stat as ArmorStat] = { value, fixed: false };
      });
      const limits = t5TargetLimits(config);
      expect(limits.status).withContext(targets.join("/")).toBe("feasible");
      expect(limits.maximumComplete).withContext(targets.join("/")).toBeTrue();
    }
  });

  it("rejects holes in locked exact values and honors minor-only mod budgets", () => {
    const config = BuildConfiguration.buildEmptyConfiguration();
    config.statModLimits = { maxMods: 0, maxMajorMods: 0 };
    config.minimumStatTiers[ArmorStat.StatHealth] = { value: 0.1, fixed: true };
    expect(t5TargetLimits(config, true).status).toBe("infeasible");
    config.minimumStatTiers[ArmorStat.StatHealth] = { value: 0, fixed: false };
    expect(t5TargetLimits(config).maximum).toEqual([175, 175, 175, 175, 175, 175]);
    config.statModLimits = { maxMods: 1, maxMajorMods: 0 };
    expect(t5TargetLimits(config).maximum).toEqual([180, 180, 180, 180, 180, 180]);
  });

  it("matches the per-piece model for mixed rolls and competing targets", () => {
    const config = BuildConfiguration.buildEmptyConfiguration();
    config.calculateTierFiveTuning = true;
    config.statModLimits = { maxMods: 2, maxMajorMods: 1 };
    const selected = [
      { index: 0, tertiary: ArmorStat.StatSuper },
      { index: 4, tertiary: ArmorStat.StatHealth },
    ];
    const choices = selected.map(({ index, tertiary }) => {
      const archetype = T5_ARCHETYPES[index];
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
        gearSetHash: null,
        gearSetPerkSelectable: false,
      } as T5Candidate;
    });
    for (const health of [0, 10, 15]) {
      config.minimumStatTiers[ArmorStat.StatHealth].value = health;
      const compact = createT5TargetModel(config);
      for (const name of Object.keys(compact.variables)) {
        if (
          name.startsWith("roll_") &&
          !selected.some(({ index, tertiary }) => name.startsWith(`roll_${index}_${tertiary}_`))
        ) {
          delete compact.variables[name];
          delete compact.ints![name];
        }
      }
      const reference = createT5OptimizationModel(
        Array.from({ length: 5 }, () => choices),
        config
      );
      reference.model.options = { timeout: 1000 };
      for (const stat of [ArmorStat.StatHealth, ArmorStat.StatGrenade, ArmorStat.StatClass]) {
        compact.optimize = `stat_${stat}`;
        reference.model.optimize = `stat_${stat}`;
        const expected = solveT5Optimization(reference);
        const actual = solveT5Optimization({ ...reference, model: compact });
        expect(actual.feasible).toBe(expected.feasible);
        expect(actual["optimal"]).toBeTrue();
        expect(expected["optimal"]).toBeTrue();
        expect(actual.result)
          .withContext(`health ${health}, stat ${stat}`)
          .toBeCloseTo(expected.result, 5);
      }
    }
  });

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
    const samples: Parameters<NonNullable<Parameters<typeof solveT5Optimization>[1]>>[0][] = [];
    solveT5Optimization(model, (sample) => samples.push(sample));
    expect(samples.length).toBe(1);
    expect(samples[0].status.length).toBeGreaterThan(0);
    expect(samples[0].variables).toBe(Object.keys(model.model.variables).length);
    expect(samples[0].constraints).toBe(Object.keys(model.model.constraints).length);
    expect(samples[0].lpBytes).toBeGreaterThan(0);
    expect(samples[0].serializeMs).toBeGreaterThanOrEqual(0);
    expect(samples[0].solveMs).toBeGreaterThanOrEqual(0);
    expect(samples[0].validateMs).toBeGreaterThanOrEqual(0);
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
