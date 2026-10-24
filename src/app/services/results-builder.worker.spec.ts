import { ArmorStat } from "../data/enum/armor-stat";
import { StatModifier } from "../data/enum/armor-stat";
import { Tuning } from "../data/types/IPermutatorArmorSet";
import { initKernels, kernels, useJavaScriptKernels } from "../wasm/kernels";
import {
  buildTuningSet,
  findTuningModHashes,
  serializeWorkerError,
  t5Improvement,
  tuningOptions,
} from "./results-builder.worker";
import {
  extendTuningSet,
  filterTuningSetBySharedBudget,
  filterTuningSetForLockedStats,
  findStatMods,
  loadTuningSet,
  prioritizeTuningSet,
  raiseReachableTiers,
  setModSearchContext,
  tuningSetAt,
  tuningSetSize,
  tuningSetToArrays,
} from "./tuning-kernel";

const KERNEL_URL = new URL("assets/wasm/kernels.wasm", document.baseURI).href;

describe("results builder worker errors", () => {
  it("serializes Error details for the main thread", () => {
    const error = new TypeError("invalid armor input");
    expect(serializeWorkerError(error)).toEqual({
      name: "TypeError",
      message: "invalid armor input",
      stack: error.stack,
    });
  });

  it("provides a fallback message for non-Error rejections", () => {
    expect(serializeWorkerError(undefined)).toEqual({
      name: "Error",
      message: "Unknown worker error",
    });
  });
});

const legendary = (tuningStat: ArmorStat, balancedBonus: number[]): t5Improvement => ({
  tuningStat,
  archetypeStats: [],
  flexible: false,
  balancedBonus,
});

const flexibleExotic = (balancedBonus: number[]): t5Improvement => ({
  tuningStat: null,
  archetypeStats: [],
  flexible: true,
  balancedBonus,
});

describe("tuning mod hashes", () => {
  it("returns the exact directional and balanced mod hashes for a selected tuning", () => {
    const improvements = [
      legendary(ArmorStat.StatWeapon, [1, 0, 1, 0, 1, 0]),
      legendary(ArmorStat.StatHealth, [0, 0, 0, 1, 1, 1]),
    ];

    expect(findTuningModHashes(improvements, [-5, 0, 0, 0, 0, 5])).toEqual([3121760799]);
    expect(findTuningModHashes(improvements, [1, 0, 1, 1, 2, 1])).toEqual([3122197216, 3122197216]);
  });

  it("ignores untunable armor slots in the DIM mod list", () => {
    expect(
      findTuningModHashes(
        [null, legendary(ArmorStat.StatHealth, [0, 0, 0, 1, 1, 1])],
        [5, -5, 0, 0, 0, 0]
      )
    ).toEqual([388618952]);
  });
});

// Every behavior is checked on both backends: the WASM build and its TypeScript fallback.
for (const backend of ["js", "wasm"] as const) {
  describe(`tuning kernels (${backend})`, () => {
    beforeAll(async () => {
      if (backend === "wasm") {
        await initKernels({ url: KERNEL_URL });
        expect(kernels().backend).withContext("run `npm run wasm:build`").toBe("wasm");
      } else {
        useJavaScriptKernels();
      }
    });

    beforeEach(() => kernels().scratchReset());
    afterAll(() => useJavaScriptKernels());

    it("extends a base with the same ordered tunings as a full build", () => {
      const base = [
        legendary(ArmorStat.StatHealth, [0, 0, 0, 1, 1, 1]),
        legendary(ArmorStat.StatSuper, [1, 1, 1, 0, 0, 0]),
      ];
      const exotic = flexibleExotic([1, 1, 1, 0, 0, 0]);
      const baseSet = buildTuningSet(base);
      const baseBeforeExtension = tuningSetToArrays(baseSet);

      const extended = tuningSetToArrays(extendTuningSet(baseSet, tuningOptions(exotic)));

      expect(extended).toEqual(tuningSetToArrays(buildTuningSet([...base, exotic])));
      expect(tuningSetToArrays(baseSet)).toEqual(baseBeforeExtension);
    });

    it("preserves the no-op tuning for an empty base", () => {
      expect(tuningSetToArrays(buildTuningSet([]))).toEqual([[0, 0, 0, 0, 0, 0]]);
    });

    it("removes only tunings that overshoot a locked stat", () => {
      const tunings = [
        [0, 0, 0, 0, 0, 0],
        [5, -5, 0, 0, 0, 0],
        [-5, 5, 0, 0, 0, 0],
        [0, 0, 5, -5, 0, 0],
      ];

      const filtered = filterTuningSetForLockedStats(
        loadTuningSet(tunings),
        [100, 90, 50, 50, 50, 50],
        [true, false, false, false, false, false],
        [100, 0, 0, 0, 0, 0]
      );

      expect(tuningSetToArrays(filtered)).toEqual([tunings[0], tunings[2], tunings[3]]);
    });

    it("keeps a negative tuning that satisfies a stat locked to zero", () => {
      const tunings = [
        [0, 0, 0, 0, 0, 0],
        [-5, 5, 0, 0, 0, 0],
      ];

      const filtered = filterTuningSetForLockedStats(
        loadTuningSet(tunings),
        [5, 70, 50, 50, 50, 50],
        [true, false, false, false, false, false],
        [0, 0, 0, 0, 0, 0]
      );

      expect(tuningSetToArrays(filtered)).toEqual([tunings[1]]);
    });

    it("returns the original set when no stats are locked", () => {
      const set = loadTuningSet([[5, -5, 0, 0, 0, 0]]);
      expect(
        filterTuningSetForLockedStats(
          set,
          [100, 100, 100, 100, 100, 100],
          [false, false, false, false, false, false],
          [0, 0, 0, 0, 0, 0]
        )
      ).toBe(set);
    });

    it("removes tunings whose total remaining target gap exceeds the shared budget", () => {
      const tunings = [
        [5, 5, 0, 0, 0, 0],
        [5, -5, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
      ];

      const filtered = filterTuningSetBySharedBudget(
        loadTuningSet(tunings),
        [90, 90, 100, 100, 100, 100],
        [100, 100, 0, 0, 0, 0],
        10
      );

      expect(tuningSetToArrays(filtered)).toEqual([tunings[0]]);
    });

    it("keeps negative tunings when the shared budget can compensate for them", () => {
      const filtered = filterTuningSetBySharedBudget(
        loadTuningSet([[5, -5, 0, 0, 0, 0]]),
        [95, 105, 100, 100, 100, 100],
        [100, 100, 0, 0, 0, 0],
        5
      );

      expect(tuningSetToArrays(filtered)).toEqual([[5, -5, 0, 0, 0, 0]]);
    });

    it("returns the original set when there are no targets", () => {
      const set = loadTuningSet([[5, -5, 0, 0, 0, 0]]);
      expect(
        filterTuningSetBySharedBudget(set, [50, 50, 50, 50, 50, 50], [0, 0, 0, 0, 0, 0], 0)
      ).toBe(set);
    });

    it("selects all five balanced mods when tuning is not needed", () => {
      const improvements = [
        legendary(ArmorStat.StatHealth, [1, 1, 1, 0, 0, 0]),
        legendary(ArmorStat.StatMelee, [0, 1, 1, 1, 0, 0]),
        legendary(ArmorStat.StatGrenade, [0, 0, 1, 1, 1, 0]),
        legendary(ArmorStat.StatSuper, [0, 0, 0, 1, 1, 1]),
        legendary(ArmorStat.StatClass, [1, 0, 0, 0, 1, 1]),
      ];

      const tuning = tuningSetAt(
        prioritizeTuningSet(buildTuningSet(improvements, false), [0, 0, 0, 0, 0, 0]),
        0
      );

      expect(findTuningModHashes(improvements, tuning)).toEqual([
        3122197216, 3122197216, 3122197216, 3122197216, 3122197216,
      ]);
    });

    it("uses balanced mods as the default when directional tuning is disabled", () => {
      const improvements = [
        legendary(ArmorStat.StatHealth, [1, 1, 1, 0, 0, 0]),
        legendary(ArmorStat.StatMelee, [0, 0, 1, 1, 1, 0]),
        legendary(ArmorStat.StatGrenade, [0, 0, 0, 1, 1, 1]),
      ];

      const set = buildTuningSet(improvements, false, false);
      const tuning = tuningSetAt(set, 0);

      expect(tuningSetSize(set)).toBe(1);
      expect(tuning).toEqual([1, 1, 2, 2, 2, 1]);
      expect(findTuningModHashes(improvements, tuning)).toEqual([
        3122197216, 3122197216, 3122197216,
      ]);
    });

    it("only includes no-tuning choices for exact constraints", () => {
      const improvement = legendary(ArmorStat.StatHealth, [1, 1, 1, 0, 0, 0]);

      expect(tuningSetToArrays(buildTuningSet([improvement], false))).not.toContain([
        0, 0, 0, 0, 0, 0,
      ]);
      expect(tuningSetToArrays(buildTuningSet([improvement], true))).toContain([0, 0, 0, 0, 0, 0]);
    });

    it("prioritizes balanced mods on T5 slots not needed for directional tuning", () => {
      const noUnusedTunings: Tuning = [5, -5, 0, 0, 0, 0];
      const twoUnusedBalancedTunings: Tuning = [5, -5, 1, 2, 2, 1];
      const improvements = [
        legendary(ArmorStat.StatHealth, [1, 1, 1, 0, 0, 0]),
        legendary(ArmorStat.StatMelee, [0, 0, 1, 1, 1, 0]),
        legendary(ArmorStat.StatGrenade, [0, 0, 0, 1, 1, 1]),
      ];

      const ordered = prioritizeTuningSet(
        loadTuningSet([noUnusedTunings, twoUnusedBalancedTunings]),
        [0, 0, 0, 0, 0, 0]
      );

      expect(tuningSetAt(ordered, 0)).toEqual(twoUnusedBalancedTunings);
      expect(findTuningModHashes(improvements, twoUnusedBalancedTunings)).toEqual([
        388618952, 3122197216, 3122197216,
      ]);
    });

    it("prefers reducing stats in ascending selected-target order with stable ties", () => {
      const tunings: Tuning[] = [0, 1, 2, 3, 4, 5].map((negativeStat) => {
        const tuning: Tuning = [0, 0, 0, 0, 0, 0];
        tuning[
          negativeStat === ArmorStat.StatGrenade ? ArmorStat.StatSuper : ArmorStat.StatGrenade
        ] = 5;
        tuning[negativeStat] = -5;
        return tuning;
      });

      const ordered = tuningSetToArrays(
        prioritizeTuningSet(loadTuningSet(tunings), [70, 50, 150, 100, 70, 0])
      );

      expect(ordered.map((tuning) => tuning.indexOf(-5))).toEqual([
        ArmorStat.StatWeapon,
        ArmorStat.StatMelee,
        ArmorStat.StatHealth,
        ArmorStat.StatClass,
        ArmorStat.StatSuper,
        ArmorStat.StatGrenade,
      ]);
    });

    it("keeps balanced bonuses ahead of directional tuning with selected targets", () => {
      const directional: Tuning = [5, 0, 0, 0, 0, -5];
      const balanced: Tuning = [1, 1, 1, 0, 0, 0];

      expect(
        tuningSetToArrays(
          prioritizeTuningSet(loadTuningSet([directional, balanced]), [70, 50, 150, 100, 70, 0])
        )
      ).toEqual([balanced, directional]);
    });

    describe("stat mod search", () => {
      const search = (
        targets: number[],
        fixed: boolean[],
        limits: { maxMajorMods: number; maxMods: number },
        stats: number[],
        distances: number[],
        artifice: number,
        tunings: number[][]
      ) => {
        setModSearchContext({
          targets,
          fixed,
          minimumTiers: [0, 0, 0, 0, 0, 0],
          ...limits,
        });
        return findStatMods(stats, distances, [0, 0, 0, 0, 0, 0], artifice, loadTuningSet(tunings));
      };
      const none = [false, false, false, false, false, false];

      it("rejects searches that cannot cover the remaining distance", () => {
        expect(
          search(
            [0, 0, 100, 100, 100, 0],
            none,
            { maxMajorMods: 2, maxMods: 3 },
            [0, 0, 80, 80, 80, 0],
            [0, 0, 20, 20, 20, 0],
            1,
            [[0, 0, 5, 5, 5, 0]]
          )
        ).toBeNull();
      });

      it("picks the major mods that cover the distance", () => {
        const result = search(
          [100, 100, 100, 0, 0, 0],
          none,
          { maxMajorMods: 3, maxMods: 3 },
          [90, 90, 90, 50, 50, 50],
          [10, 10, 10, 0, 0, 0],
          0,
          [[0, 0, 0, 0, 0, 0]]
        );

        expect(result?.mods).toEqual([
          StatModifier.MAJOR_HEALTH,
          StatModifier.MAJOR_MELEE,
          StatModifier.MAJOR_GRENADE,
        ]);
        expect(result?.tuning).toEqual([0, 0, 0, 0, 0, 0]);
      });

      it("skips balanced bonuses that overshoot a locked stat after stat mods", () => {
        const balanced: Tuning = [2, 1, 1, 1, 1, 0];
        const noTuning: Tuning = [0, 0, 0, 0, 0, 0];
        const result = search(
          [70, 70, 100, 100, 100, 50],
          [true, false, false, false, false, false],
          { maxMajorMods: 0, maxMods: 1 },
          [65, 70, 100, 100, 100, 50],
          [5, 0, 0, 0, 0, 0],
          0,
          [balanced, noTuning]
        );

        expect(result).not.toBeNull();
        expect(result!.tuning).toEqual(noTuning);
      });

      it("keeps balanced bonuses that reach a locked stat exactly with stat mods", () => {
        const balanced: Tuning = [2, 1, 1, 1, 1, 0];
        const result = search(
          [70, 70, 100, 100, 100, 50],
          [true, false, false, false, false, false],
          { maxMajorMods: 0, maxMods: 1 },
          [63, 70, 100, 100, 100, 50],
          [7, 0, 0, 0, 0, 0],
          0,
          [balanced]
        );

        expect(result).not.toBeNull();
        expect(result!.tuning).toEqual(balanced);
      });
    });
  });
}

describe("tuning kernel backends", () => {
  afterAll(() => useJavaScriptKernels());

  it("falls back to the TypeScript kernels when the WASM file cannot be loaded", async () => {
    const loaded = await initKernels({
      url: new URL("assets/wasm/missing.wasm", document.baseURI).href,
    });
    expect(loaded.backend).toBe("js");
    expect(kernels().backend).toBe("js");
  });

  it("falls back when the WASM bytes are not a module", async () => {
    const loaded = await initKernels({ bytes: new Uint8Array([1, 2, 3, 4]) });
    expect(loaded.backend).toBe("js");
  });

  it("computes the same results on WASM and TypeScript for random searches", async () => {
    let seed = 20240607;
    const random = (limit: number) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
      return ((seed >>> 8) % limit) + 0;
    };

    interface Scenario {
      improvements: t5Improvement[];
      includeNoTuning: boolean;
      directional: boolean;
      targets: number[];
      fixed: boolean[];
      stats: number[];
      artifice: number;
      limits: { maxMajorMods: number; maxMods: number };
    }
    const scenarios: Scenario[] = Array.from({ length: 100 }, () => {
      const pieces = 1 + random(3);
      const improvements = Array.from({ length: pieces }, () => {
        const low = [0, 0, 0, 0, 0, 0];
        for (let n = 0; n < 3; n++) low[random(6)] = 1;
        return random(3) === 0 ? flexibleExotic(low) : legendary(random(6) as ArmorStat, low);
      });
      const stats = Array.from({ length: 6 }, () => 40 + random(70));
      const targets = stats.map((value) =>
        random(3) === 0 ? 0 : Math.floor((value + random(25) - 5) / 10) * 10
      );
      return {
        improvements,
        includeNoTuning: random(2) === 0,
        directional: random(4) !== 0,
        targets,
        fixed: targets.map((target) => target > 0 && random(5) === 0),
        stats,
        artifice: random(4),
        limits: [
          { maxMajorMods: 5, maxMods: 5 },
          { maxMajorMods: 3, maxMods: 5 },
          { maxMajorMods: 0, maxMods: 2 },
        ][random(3)],
      };
    });

    const run = (scenario: Scenario) => {
      const k = kernels();
      k.scratchReset();
      const { targets, fixed, stats, improvements, artifice } = scenario;
      setModSearchContext({
        targets,
        fixed,
        minimumTiers: targets.map((target) => target / 10),
        ...scenario.limits,
      });
      let set = buildTuningSet(improvements, scenario.includeNoTuning, scenario.directional);
      set = filterTuningSetForLockedStats(set, stats, fixed, targets);
      set = filterTuningSetBySharedBudget(
        set,
        stats,
        targets,
        10 * scenario.limits.maxMajorMods +
          5 * (scenario.limits.maxMods - scenario.limits.maxMajorMods) +
          3 * artifice
      );
      if (tuningSetSize(set) === 0) return "empty";
      set = prioritizeTuningSet(set, targets);
      const distances = stats.map((value, stat) => Math.max(0, targets[stat] - value));
      const found = findStatMods(stats, distances, [0, 0, 0, 0, 0, 0], artifice, set);
      const tiers = [0, 0, 0, 0, 0, 0];
      raiseReachableTiers(stats, distances, artifice, set, !fixed.some(Boolean), tiers);
      return JSON.stringify({ size: tuningSetSize(set), first: tuningSetAt(set, 0), found, tiers });
    };

    useJavaScriptKernels();
    const expected = scenarios.map(run);
    const loaded = await initKernels({ url: KERNEL_URL });
    expect(loaded.backend).withContext("run `npm run wasm:build`").toBe("wasm");
    expect(scenarios.map(run)).toEqual(expected);
    expect(expected.filter((result) => result !== "empty").length).toBeGreaterThan(30);
    expect(expected.filter((result) => result.includes('"found":{')).length).toBeGreaterThan(15);
  });
});
