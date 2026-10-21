import { ArmorStat } from "../data/enum/armor-stat";
import { Tuning } from "../data/types/IPermutatorArmorSet";
import {
  buildTuningAcc,
  canCoverRemainingDistance,
  extendTuningAcc,
  filterTuningsBySharedBudget,
  filterTuningsForLockedStats,
  findTuningModHashes,
  generate_tunings,
  get_mods_recursive,
  prioritizeTuningsByTotalStats,
  serializeWorkerError,
  t5Improvement,
} from "./results-builder.worker";

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

describe("results builder tuning cache", () => {
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

  it("extends a cached legendary base with the same ordered tunings as a full build", () => {
    const base = [
      legendary(ArmorStat.StatHealth, [0, 0, 0, 1, 1, 1]),
      legendary(ArmorStat.StatSuper, [1, 1, 1, 0, 0, 0]),
    ];
    const exotic = flexibleExotic([1, 1, 1, 0, 0, 0]);
    const baseAccumulator = buildTuningAcc(base);
    const baseBeforeExtension = Array.from(baseAccumulator.values());

    const extended = Array.from(extendTuningAcc(baseAccumulator, exotic).values());

    expect(extended).toEqual(generate_tunings([...base, exotic]));
    expect(Array.from(baseAccumulator.values())).toEqual(baseBeforeExtension);
  });

  it("preserves the no-op tuning for an empty cached base", () => {
    expect(Array.from(buildTuningAcc([]).values())).toEqual([[0, 0, 0, 0, 0, 0]]);
  });

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

  it("removes only tunings that overshoot a locked stat", () => {
    const tunings = [
      [0, 0, 0, 0, 0, 0],
      [5, -5, 0, 0, 0, 0],
      [-5, 5, 0, 0, 0, 0],
      [0, 0, 5, -5, 0, 0],
    ] as any;

    expect(
      filterTuningsForLockedStats(
        tunings,
        [100, 90, 50, 50, 50, 50],
        [true, false, false, false, false, false],
        [100, 0, 0, 0, 0, 0]
      )
    ).toEqual([tunings[0], tunings[2], tunings[3]]);
  });

  it("keeps a negative tuning that satisfies a stat locked to zero", () => {
    const tunings = [
      [0, 0, 0, 0, 0, 0],
      [-5, 5, 0, 0, 0, 0],
    ] as any;

    expect(
      filterTuningsForLockedStats(
        tunings,
        [5, 70, 50, 50, 50, 50],
        [true, false, false, false, false, false],
        [0, 0, 0, 0, 0, 0]
      )
    ).toEqual([tunings[1]]);
  });

  it("returns the original tuning array when no stats are locked", () => {
    const tunings = [[5, -5, 0, 0, 0, 0]] as any;
    expect(
      filterTuningsForLockedStats(
        tunings,
        [100, 100, 100, 100, 100, 100],
        [false, false, false, false, false, false],
        [0, 0, 0, 0, 0, 0]
      )
    ).toBe(tunings);
  });

  it("removes tunings whose total remaining target gap exceeds the shared budget", () => {
    const tunings = [
      [5, 5, 0, 0, 0, 0],
      [5, -5, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
    ] as any;

    expect(
      filterTuningsBySharedBudget(tunings, [90, 90, 100, 100, 100, 100], [100, 100, 0, 0, 0, 0], 10)
    ).toEqual([tunings[0]]);
  });

  it("keeps negative tunings when the shared budget can compensate for them", () => {
    const tunings = [[5, -5, 0, 0, 0, 0]] as any;
    expect(
      filterTuningsBySharedBudget(tunings, [95, 105, 100, 100, 100, 100], [100, 100, 0, 0, 0, 0], 5)
    ).toEqual(tunings);
  });

  it("returns the original tuning array when there are no targets", () => {
    const tunings = [[5, -5, 0, 0, 0, 0]] as any;
    expect(
      filterTuningsBySharedBudget(tunings, [50, 50, 50, 50, 50, 50], [0, 0, 0, 0, 0, 0], 0)
    ).toBe(tunings);
  });

  it("selects all five balanced mods when tuning is not needed", () => {
    const improvements = [
      legendary(ArmorStat.StatHealth, [1, 1, 1, 0, 0, 0]),
      legendary(ArmorStat.StatMelee, [0, 1, 1, 1, 0, 0]),
      legendary(ArmorStat.StatGrenade, [0, 0, 1, 1, 1, 0]),
      legendary(ArmorStat.StatSuper, [0, 0, 0, 1, 1, 1]),
      legendary(ArmorStat.StatClass, [1, 0, 0, 0, 1, 1]),
    ];

    const tuning = prioritizeTuningsByTotalStats(generate_tunings(improvements, false))[0];

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

    const tunings = generate_tunings(improvements, false, false);
    const tuning = tunings[0];

    expect(tunings.length).toBe(1);
    expect(tuning).toEqual([1, 1, 2, 2, 2, 1]);
    expect(findTuningModHashes(improvements, tuning)).toEqual([3122197216, 3122197216, 3122197216]);
  });

  it("only includes no-tuning choices for exact constraints", () => {
    const improvement = legendary(ArmorStat.StatHealth, [1, 1, 1, 0, 0, 0]);

    expect(generate_tunings([improvement], false)).not.toContain([0, 0, 0, 0, 0, 0]);
    expect(generate_tunings([improvement], true)).toContain([0, 0, 0, 0, 0, 0]);
  });

  it("prioritizes balanced mods on T5 slots not needed for directional tuning", () => {
    const noUnusedTunings: Tuning = [5, -5, 0, 0, 0, 0];
    const twoUnusedBalancedTunings: Tuning = [5, -5, 1, 2, 2, 1];
    const tunings = [noUnusedTunings, twoUnusedBalancedTunings];
    const improvements = [
      legendary(ArmorStat.StatHealth, [1, 1, 1, 0, 0, 0]),
      legendary(ArmorStat.StatMelee, [0, 0, 1, 1, 1, 0]),
      legendary(ArmorStat.StatGrenade, [0, 0, 0, 1, 1, 1]),
    ];

    expect(prioritizeTuningsByTotalStats(tunings)[0]).toBe(twoUnusedBalancedTunings);
    expect(findTuningModHashes(improvements, twoUnusedBalancedTunings)).toEqual([
      388618952, 3122197216, 3122197216,
    ]);
  });

  it("prefers reducing stats in ascending selected-target order with stable ties", () => {
    const tunings: Tuning[] = [0, 1, 2, 3, 4, 5].map((negativeStat) => {
      const tuning: Tuning = [0, 0, 0, 0, 0, 0];
      tuning[negativeStat === ArmorStat.StatGrenade ? ArmorStat.StatSuper : ArmorStat.StatGrenade] =
        5;
      tuning[negativeStat] = -5;
      return tuning;
    });

    const ordered = prioritizeTuningsByTotalStats(tunings, [70, 50, 150, 100, 70, 0]);

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
      prioritizeTuningsByTotalStats([directional, balanced], [70, 50, 150, 100, 70, 0])
    ).toEqual([balanced, directional]);
  });

  it("rejects recursion branches that cannot cover their remaining distance", () => {
    expect(
      canCoverRemainingDistance([0, 0, 20, 20, 20, 0], 2, [0, 0, 5, 5, 5, 0], 1, 2, 3)
    ).toBeFalse();
  });

  it("skips balanced bonuses that overshoot a locked stat after stat mods", () => {
    const balanced: Tuning = [2, 1, 1, 1, 1, 0];
    const noTuning: Tuning = [0, 0, 0, 0, 0, 0];
    const result = get_mods_recursive(
      [65, 70, 100, 100, 100, 50],
      [70, 70, 100, 100, 100, 50],
      [5, 0, 0, 0, 0, 0],
      [balanced, noTuning],
      0,
      0,
      0,
      1,
      balanced,
      [true, false, false, false, false, false]
    );

    expect(result).not.toBeNull();
    expect(result![result!.length - 1]).toEqual(noTuning);
  });

  it("keeps balanced bonuses that reach a locked stat exactly with stat mods", () => {
    const balanced: Tuning = [2, 1, 1, 1, 1, 0];
    const result = get_mods_recursive(
      [63, 70, 100, 100, 100, 50],
      [70, 70, 100, 100, 100, 50],
      [7, 0, 0, 0, 0, 0],
      [balanced],
      0,
      0,
      0,
      1,
      balanced,
      [true, false, false, false, false, false]
    );

    expect(result).not.toBeNull();
    expect(result![result!.length - 1]).toEqual(balanced);
  });

  it("keeps recursion branches within the optimistic resource bound", () => {
    expect(
      canCoverRemainingDistance([0, 0, 14, 14, 14, 0], 2, [0, 0, 5, 5, 5, 0], 1, 2, 3)
    ).toBeTrue();
  });
});
