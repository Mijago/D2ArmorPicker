/*
 * Copyright (c) 2023 D2ArmorPicker by Mijago.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

// region Imports
import { BuildConfiguration } from "../data/buildConfiguration";
import { IDestinyArmor } from "../data/types/IInventoryArmor";
import { ArmorSlot } from "../data/enum/armor-slot";
import {
  FORCE_USE_ANY_EXOTIC,
  FORCE_USE_NO_EXOTIC,
  MAXIMUM_MASTERWORK_LEVEL,
} from "../data/constants";
import { ModInformation } from "../data/ModInformation";
import {
  ArmorPerkOrSlot,
  ArmorStat,
  SpecialArmorStat,
  STAT_MOD_VALUES,
  StatModifier,
} from "../data/enum/armor-stat";
import { ArmorRequirementMatcher } from "../data/armor-requirements";
import { packArmorSets } from "./packed-armor-sets";

import { environment } from "../../environments/environment";

import { IPermutatorArmor } from "../data/types/IPermutatorArmor";
import { IPermutatorArmorSet, Tuning, createArmorSet } from "../data/types/IPermutatorArmorSet";
import { ArmorSystem } from "../data/types/IManifestArmor";

import { initKernels, kernels } from "../wasm/kernels";
import {
  TuningSet,
  extendTuningSet,
  filterTuningSetBySharedBudget,
  filterTuningSetForLockedStats,
  findStatMods,
  prioritizeTuningSet,
  raiseReachableTiers,
  setModSearchContext,
  singleTuningSet,
  tuningSetAt,
  tuningSetSize,
} from "./tuning-kernel";

// endregion Imports
let runtime: {
  maximumPossibleTiers: number[];
} = {
  maximumPossibleTiers: [0, 0, 0, 0, 0, 0],
};

// Cancellation flag, controlled via messages from the main thread
let cancelRequested = false;

// Per-stat ceiling from the theoretical T5 pieces; arrives asynchronously after the request starts.
let theoreticalMaximumTiers: number[] | null = null;
const currentTheoreticalMaximum = () => theoreticalMaximumTiers;

// Module-level configuration to avoid passing around
let calculateTierFiveTuning: boolean;
let onlyShowResultsWithNoWastedStats: boolean;
let tryLimitWastedStats: boolean;
let addConstent1Health: boolean;
let assumeExoticsMasterworked: boolean;
let assumeLegendariesMasterworked: boolean;
let maxMajorMods: number;
let maxMods: number;
let minimumStatTierValues: number[];

// Module-level constants for performance
let enabledModBonuses: number[];
let requirementMatcher: ArmorRequirementMatcher;
let targetVals: number[];
let targetFixed: boolean[];
let possibleIncreaseByMod: number;
let resultLimitReached: boolean = false;

export type t5Improvement = {
  tuningStat: ArmorStat | null;
  archetypeStats: ArmorStat[];
  flexible: boolean;
  balancedBonus: number[];
};

type AnnotatedArmor = IPermutatorArmor & {
  _mw: number[];
  _tune: number[];
  _art: number;
  _tuneTot: number;
  _sum: number;
};

type ArmorCombination = readonly [
  helmet: IPermutatorArmor,
  gauntlet: IPermutatorArmor,
  chest: IPermutatorArmor,
  leg: IPermutatorArmor,
  classItem: IPermutatorArmor,
  tuningBaseItems: readonly IPermutatorArmor[],
  tuningVariableItem: IPermutatorArmor,
  tuningVariableCandidates: readonly IPermutatorArmor[],
];

type TuningBaseCache = {
  items: readonly IPermutatorArmor[];
  accumulator: CachedAccumulator | null;
  key?: string;
};

export interface SerializedWorkerError {
  name: string;
  message: string;
  stack?: string;
}

export function serializeWorkerError(error: unknown): SerializedWorkerError {
  if (error instanceof Error) {
    return {
      name: error.name || "Error",
      message: error.message || error.name || "Unknown worker error",
      stack: error.stack,
    };
  }
  return { name: "Error", message: String(error ?? "Unknown worker error") };
}

export function isFlexibleExotic(i: IPermutatorArmor): boolean {
  return i.isExotic === 1 && i.armorSystem === ArmorSystem.Armor3;
}

export function lowestThreeBonus(i: IPermutatorArmor): number[] {
  const stats = [i.resilience, i.strength, i.discipline, i.intellect, i.recovery, i.mobility];
  const order = stats
    .map((value, index) => [value, index])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const bonus = [0, 0, 0, 0, 0, 0];
  for (let index = 0; index < 3; index++) bonus[order[index][1]] = 1;
  return bonus;
}

export function isT5WithTuning(i: IPermutatorArmor): boolean {
  if (i.armorSystem !== ArmorSystem.Armor3) return false;
  if (isFlexibleExotic(i)) return true;
  return i.tier >= 5 && !!i.archetypeStats && i.tuningStat !== undefined && i.tuningStat !== null;
}

function mapItemToTuning(i: IPermutatorArmor): t5Improvement {
  const cached = i._imp as t5Improvement | undefined;
  if (cached) return cached;
  const improvement: t5Improvement = {
    tuningStat: isFlexibleExotic(i) ? null : i.tuningStat!,
    archetypeStats: i.archetypeStats ?? [],
    flexible: isFlexibleExotic(i),
    balancedBonus: lowestThreeBonus(i),
  };
  i._imp = improvement;
  return improvement;
}

// Pieces with the same tuning options share an id; accumulators only depend on these ids in order.
const tuningSignatureIds = new Map<string, number>();
interface CachedAccumulator {
  set: TuningSet;
  generation: number;
  sorted?: { targets: string; set: TuningSet };
}
const tuningAccumulatorCache = new Map<string, CachedAccumulator>();
// Accumulators hold thousands of tunings each, so the cache is bounded by their total count.
const TUNING_ACCUMULATOR_CACHE_TUNING_LIMIT = 300000;
let tuningAccumulatorCacheTunings = 0;

function clearTuningAccumulatorCache(): void {
  tuningAccumulatorCache.clear();
  tuningAccumulatorCacheTunings = 0;
  kernels().clearPersistent();
}

function tuningSignatureId(i: IPermutatorArmor): number {
  if (i._sig !== undefined) return i._sig;
  const improvement = mapItemToTuning(i);
  const signature = `${improvement.flexible ? "F" : improvement.tuningStat}/${improvement.balancedBonus.join("")}`;
  let id = tuningSignatureIds.get(signature);
  if (id === undefined) {
    id = tuningSignatureIds.size;
    tuningSignatureIds.set(signature, id);
  }
  i._sig = id;
  return id;
}

function cachedTuningAccumulator(key: string, build: () => TuningSet): CachedAccumulator {
  const k = kernels();
  const cached = tuningAccumulatorCache.get(key);
  if (cached && cached.generation === k.persistentGeneration()) return cached;
  // keep() discards other scratch sets, so cached sets are always created before scratch work.
  const set = k.keep(build());
  const entry: CachedAccumulator = { set, generation: k.persistentGeneration() };
  tuningAccumulatorCacheTunings += tuningSetSize(set);
  tuningAccumulatorCache.set(key, entry);
  return entry;
}

// Cached accumulator in priority order. Filtering preserves this order, and the sort is stable, so
// this is identical to filtering first and sorting afterwards.
function prioritizedAccumulatorSet(entry: CachedAccumulator, targets: number[]): TuningSet {
  const targetsKey = targets.join(",");
  if (entry.sorted?.targets === targetsKey) return entry.sorted.set;
  const set = kernels().keep(prioritizeTuningSet(entry.set, targets));
  tuningAccumulatorCacheTunings += tuningSetSize(set);
  entry.sorted = { targets: targetsKey, set };
  return set;
}

/** Deduplicated sums of every piece's tuning options, in first-seen order. */
export function buildTuningSet(
  improvements: t5Improvement[],
  includeNoTuning = true,
  includeDirectionalTunings = true
): TuningSet {
  let set = singleTuningSet([0, 0, 0, 0, 0, 0]);
  for (const improvement of improvements) {
    set = extendTuningSet(
      set,
      tuningOptions(improvement, includeNoTuning, includeDirectionalTunings)
    );
  }
  return set;
}

function annotateArmor(pieces: IPermutatorArmor[], config: BuildConfiguration): void {
  for (const piece of pieces) {
    const masterworkedStats = pieceStatsWithMasterwork(piece, config);
    const tuningReach = [0, 0, 0, 0, 0, 0];
    const hasTuning = isT5WithTuning(piece);
    if (hasTuning) {
      const balancedBonus = lowestThreeBonus(piece);
      for (let stat = 0; stat < 6; stat++) {
        tuningReach[stat] = Math.max(
          calculateTierFiveTuning && (isFlexibleExotic(piece) || piece.tuningStat === stat) ? 5 : 0,
          balancedBonus[stat]
        );
      }
    }

    piece._mw = masterworkedStats;
    piece._tune = tuningReach;
    piece._art = pieceArtificeCapable(piece) ? 1 : 0;
    piece._tuneTot = hasTuning ? 3 : 0;
    piece._sum = masterworkedStats.reduce((sum, value) => sum + value, 0);
  }
}

/**
 * Optimistic reach of a partially chosen armor set: chosen pieces plus the best remaining piece per
 * slot and stat. A failed check means no completion can meet the targets.
 */
class PartialReachBound {
  private readonly prefix: Int32Array;
  private readonly prefixArtifice: Int32Array;
  private readonly suffix: Int32Array;
  private readonly suffixArtifice: Int32Array;
  /** Number of leaf combinations below a node that has chosen `level` pieces. */
  readonly suffixCount: number[];

  constructor(
    pools: readonly IPermutatorArmor[][],
    private readonly healthConstant: number
  ) {
    const levels = pools.length;
    this.prefix = new Int32Array((levels + 1) * 6);
    this.prefixArtifice = new Int32Array(levels + 1);
    this.suffix = new Int32Array((levels + 1) * 6);
    this.suffixArtifice = new Int32Array(levels + 1);
    this.suffixCount = new Array<number>(levels + 1).fill(1);
    for (let level = levels - 1; level >= 0; level--) {
      let artifice = 0;
      for (let stat = 0; stat < 6; stat++) {
        let reach = 0;
        for (const item of pools[level] as AnnotatedArmor[]) {
          reach = Math.max(reach, item._mw[stat] + item._tune[stat]);
        }
        this.suffix[level * 6 + stat] = this.suffix[(level + 1) * 6 + stat] + reach;
      }
      for (const item of pools[level] as AnnotatedArmor[]) artifice = Math.max(artifice, item._art);
      this.suffixArtifice[level] = this.suffixArtifice[level + 1] + artifice;
      this.suffixCount[level] = this.suffixCount[level + 1] * pools[level].length;
    }
  }

  /** Chooses `item` as piece number `level` (0-based) and reports whether a completion can still work. */
  descend(level: number, item: IPermutatorArmor): boolean {
    const annotated = item as AnnotatedArmor;
    const next = level + 1;
    for (let stat = 0; stat < 6; stat++) {
      this.prefix[next * 6 + stat] =
        this.prefix[level * 6 + stat] + annotated._mw[stat] + annotated._tune[stat];
    }
    this.prefixArtifice[next] = this.prefixArtifice[level] + annotated._art;

    const sharedBudget =
      possibleIncreaseByMod + 3 * (this.prefixArtifice[next] + this.suffixArtifice[next]);
    let residualGap = 0;
    for (let stat = 0; stat < 6; stat++) {
      if (targetVals[stat] <= 0) continue;
      const reach =
        enabledModBonuses[stat] +
        this.prefix[next * 6 + stat] +
        this.suffix[next * 6 + stat] +
        (stat === ArmorStat.StatHealth ? this.healthConstant : 0);
      if (reach + sharedBudget < targetVals[stat]) return false;
      residualGap += Math.max(0, targetVals[stat] - reach);
    }
    return residualGap <= sharedBudget;
  }
}

/**
 * Applies masterwork stat bonuses to the stats array and returns whether the item
 * counts as an artifice slot. Combines two operations that were previously separate
 * loops over an items array. Uses direct index comparisons instead of .includes()
 * for archetypeStats (always exactly 3 elements).
 */
function applyMWAndCheckArtifice(item: IPermutatorArmor, stats: number[]): boolean {
  if (item.armorSystem === ArmorSystem.Armor2) {
    if (
      item.masterworkLevel === MAXIMUM_MASTERWORK_LEVEL ||
      (item.isExotic ? assumeExoticsMasterworked : assumeLegendariesMasterworked)
    ) {
      stats[0] += 2;
      stats[1] += 2;
      stats[2] += 2;
      stats[3] += 2;
      stats[4] += 2;
      stats[5] += 2;
    }
    return item.perk === ArmorPerkOrSlot.SlotArtifice;
  }
  if (item.armorSystem === ArmorSystem.Armor3) {
    let mult = item.masterworkLevel;
    if (item.isExotic ? assumeExoticsMasterworked : assumeLegendariesMasterworked)
      mult = MAXIMUM_MASTERWORK_LEVEL;
    if (mult > 0) {
      const a = item.archetypeStats;
      const a0 = a[0],
        a1 = a[1],
        a2 = a[2];
      if (a0 !== 0 && a1 !== 0 && a2 !== 0) stats[0] += mult;
      if (a0 !== 1 && a1 !== 1 && a2 !== 1) stats[1] += mult;
      if (a0 !== 2 && a1 !== 2 && a2 !== 2) stats[2] += mult;
      if (a0 !== 3 && a1 !== 3 && a2 !== 3) stats[3] += mult;
      if (a0 !== 4 && a1 !== 4 && a2 !== 4) stats[4] += mult;
      if (a0 !== 5 && a1 !== 5 && a2 !== 5) stats[5] += mult;
    }
    return item.perk === ArmorPerkOrSlot.SlotArtifice;
  }
  return item.perk === ArmorPerkOrSlot.SlotArtifice;
}

// region Validation and Preparation Functions
function computeEnabledModBonuses(config: BuildConfiguration) {
  const enabledModBonuses = [0, 0, 0, 0, 0, 0];
  // Apply configurated mods to the stat value
  // Apply mods
  for (const mod of config.enabledMods) {
    for (const bonus of ModInformation[mod].bonus) {
      var statId =
        bonus.stat == SpecialArmorStat.ClassAbilityRegenerationStat
          ? [ArmorStat.StatHealth, ArmorStat.StatWeapon, ArmorStat.StatClass][config.characterClass]
          : bonus.stat;
      enabledModBonuses[statId] += bonus.value;
    }
  }
  return enabledModBonuses;
}

/** Marks a point where the consumer may report progress; carries no armor combination. */
const COMBINATION_TICK = [] as unknown as ArmorCombination;
// Leaf combinations skipped by pruning that the consumer has not yet counted as checked.
let skippedCombinations = 0;
const TICK_INTERVAL = 2048;
const FIRST_RESULT_FLUSH_MS = 50;
const LATER_RESULT_FLUSH_MS = 250;

/**
 * Enumerates armor combinations in the same order as nested loops would: for each exotic slot (then
 * all-legendary) the remaining slots in canonical order, with the varying slot innermost. Subtrees
 * that cannot reach the targets are skipped. The yielded array is reused between iterations.
 */
function* generateArmorCombinations(
  slots: readonly IPermutatorArmor[][],
  yieldExoticCombinations: boolean,
  yieldAllLegendary: boolean
): Generator<ArmorCombination> {
  const legendary = slots.map((slot) => slot.filter((item) => !item.isExotic));
  const exotic = slots.map((slot) => slot.filter((item) => item.isExotic));
  const combination: unknown[] = new Array(8);
  const useBound = targetVals.some((target) => target > 0);
  let prunedNodes = 0;

  const blocks: { exoticSlot: number; variableSlot: number }[] = [];
  if (yieldExoticCombinations) {
    for (let slot = 0; slot < 5; slot++) blocks.push({ exoticSlot: slot, variableSlot: slot });
  }
  if (yieldAllLegendary) blocks.push({ exoticSlot: -1, variableSlot: 4 });

  for (const { exoticSlot, variableSlot } of blocks) {
    const order = [0, 1, 2, 3, 4].filter((slot) => slot !== variableSlot);
    order.push(variableSlot);
    const pools = order.map((slot) => (slot === exoticSlot ? exotic[slot] : legendary[slot]));
    if (pools.some((pool) => pool.length === 0)) continue;

    const bound = new PartialReachBound(pools, addConstent1Health && exoticSlot !== 2 ? 1 : 0);
    const [pool0, pool1, pool2, pool3, variablePool] = pools;

    // Skips the subtree below a node that has chosen `level + 1` pieces; returns whether to descend.
    const enter = (level: number, item: IPermutatorArmor): boolean => {
      combination[order[level]] = item;
      if (!useBound || bound.descend(level, item)) return true;
      skippedCombinations += bound.suffixCount[level + 1];
      prunedNodes++;
      return false;
    };

    for (const item0 of pool0) {
      if (prunedNodes >= TICK_INTERVAL) {
        prunedNodes = 0;
        yield COMBINATION_TICK;
      }
      if (!enter(0, item0)) continue;
      for (const item1 of pool1) {
        if (prunedNodes >= TICK_INTERVAL) {
          prunedNodes = 0;
          yield COMBINATION_TICK;
        }
        if (!enter(1, item1)) continue;
        for (const item2 of pool2) {
          if (!enter(2, item2)) continue;
          for (const item3 of pool3) {
            if (!enter(3, item3)) continue;
            combination[5] = [item0, item1, item2, item3];
            combination[7] = variablePool;
            for (const variableItem of variablePool) {
              combination[order[4]] = variableItem;
              combination[6] = variableItem;
              yield combination as unknown as ArmorCombination;
            }
          }
        }
      }
    }
  }
}

function estimateCombinationsToBeChecked(
  helmets: IPermutatorArmor[],
  gauntlets: IPermutatorArmor[],
  chests: IPermutatorArmor[],
  legs: IPermutatorArmor[],
  classItems: IPermutatorArmor[],
  yieldExoticCombinations: boolean,
  yieldAllLegendary: boolean
) {
  let totalCalculations = 0;
  const exoticHelmets = helmets.filter((d) => d.isExotic).length;
  const legendaryHelmets = helmets.length - exoticHelmets;
  const exoticGauntlets = gauntlets.filter((d) => d.isExotic).length;
  const legendaryGauntlets = gauntlets.length - exoticGauntlets;
  const exoticChests = chests.filter((d) => d.isExotic).length;
  const legendaryChests = chests.length - exoticChests;
  const exoticLegs = legs.filter((d) => d.isExotic).length;
  const legendaryLegs = legs.length - exoticLegs;
  const exoticClassItemCount = classItems.filter((d) => d.isExotic).length;
  const legendaryClassItemCount = classItems.length - exoticClassItemCount;

  if (yieldExoticCombinations) {
    totalCalculations +=
      exoticHelmets *
      legendaryGauntlets *
      legendaryChests *
      legendaryLegs *
      legendaryClassItemCount;
    totalCalculations +=
      legendaryHelmets *
      exoticGauntlets *
      legendaryChests *
      legendaryLegs *
      legendaryClassItemCount;
    totalCalculations +=
      legendaryHelmets *
      legendaryGauntlets *
      exoticChests *
      legendaryLegs *
      legendaryClassItemCount;
    totalCalculations +=
      legendaryHelmets *
      legendaryGauntlets *
      legendaryChests *
      exoticLegs *
      legendaryClassItemCount;
    totalCalculations +=
      legendaryHelmets *
      legendaryGauntlets *
      legendaryChests *
      legendaryLegs *
      exoticClassItemCount;
  }

  if (yieldAllLegendary) {
    totalCalculations +=
      legendaryHelmets *
      legendaryGauntlets *
      legendaryChests *
      legendaryLegs *
      legendaryClassItemCount;
  }

  return totalCalculations;
}

function computeNoTargetMaximumTiers(
  slots: readonly IPermutatorArmor[][],
  yieldExoticCombinations: boolean,
  yieldAllLegendary: boolean
): number[] | null {
  if (
    targetVals.some((target) => target > 0) ||
    targetFixed.some(Boolean) ||
    tryLimitWastedStats ||
    onlyShowResultsWithNoWastedStats ||
    requirementMatcher.size > 0
  ) {
    return null;
  }

  const maxima = [0, 0, 0, 0, 0, 0];
  let foundCombination = false;
  for (let stat = 0; stat < 6; stat++) {
    const legendaryReach = slots.map((slot) => {
      let maximum = -Infinity;
      for (const item of slot as AnnotatedArmor[]) {
        if (item.isExotic) continue;
        maximum = Math.max(maximum, item._mw[stat] + item._tune[stat] + 3 * item._art);
      }
      return maximum;
    });
    const exoticReach = slots.map((slot) => {
      let maximum = -Infinity;
      for (const item of slot as AnnotatedArmor[]) {
        if (!item.isExotic) continue;
        maximum = Math.max(maximum, item._mw[stat] + item._tune[stat] + 3 * item._art);
      }
      return maximum;
    });

    let best = -Infinity;
    if (yieldAllLegendary && legendaryReach.every(Number.isFinite)) {
      best = legendaryReach.reduce((sum, value) => sum + value, 0);
      if (stat === ArmorStat.StatHealth && addConstent1Health) best++;
      foundCombination = true;
    }
    if (yieldExoticCombinations) {
      for (let exoticSlot = 0; exoticSlot < slots.length; exoticSlot++) {
        if (!Number.isFinite(exoticReach[exoticSlot])) continue;
        let reach = exoticReach[exoticSlot];
        let valid = true;
        for (let slot = 0; slot < slots.length; slot++) {
          if (slot === exoticSlot) continue;
          if (!Number.isFinite(legendaryReach[slot])) {
            valid = false;
            break;
          }
          reach += legendaryReach[slot];
        }
        if (!valid) continue;
        if (stat === ArmorStat.StatHealth && addConstent1Health && exoticSlot !== 2) reach++;
        best = Math.max(best, reach);
        foundCombination = true;
      }
    }

    if (Number.isFinite(best)) {
      maxima[stat] = Math.min(200, best + enabledModBonuses[stat] + possibleIncreaseByMod);
    }
  }

  return foundCombination ? maxima : null;
}
// endregion Validation and Preparation Functions

// region Main Worker Event Handler
function postResultsMessage(message: object, sets: IPermutatorArmorSet[]): void {
  const packed = packArmorSets(sets);
  // @ts-ignore - worker globals are typed for the window overload
  postMessage({ ...message, packed }, [packed.fixed.buffer, packed.variable.buffer]);
}

async function handleArmorBuilderRequest(data: any): Promise<void> {
  // Reset cancellation flag at the beginning of each run
  cancelRequested = false;

  const threadSplit = data.threadSplit as { count: number; current: number };
  const config = data.config as BuildConfiguration;
  let items = data.items as IPermutatorArmor[];

  if (threadSplit == undefined || config == undefined || items == undefined) {
    return;
  }

  await initKernels({ url: data.kernelsUrl, bytes: data.kernelsBytes });
  const startTime = Date.now();
  console.log(`Thread ${threadSplit.current} started with ${items.length} items to process.`);
  console.time(`Total run thread #${threadSplit.current}`);
  // toggle feature flags
  config.onlyShowResultsWithNoWastedStats =
    environment.featureFlags.enableZeroWaste && config.onlyShowResultsWithNoWastedStats;
  if (!environment.featureFlags.enableModslotLimitation) {
    config.statModLimits = {
      maxMods: 5, // M: total mods allowed (0–5)
      maxMajorMods: 5, // N: major mods allowed (0–maxMods)
    };
  }

  let helmets = items.filter((i) => i.slot == ArmorSlot.ArmorSlotHelmet);
  let gauntlets = items.filter((i) => i.slot == ArmorSlot.ArmorSlotGauntlet);
  let chests = items.filter((i) => i.slot == ArmorSlot.ArmorSlotChest);
  let legs = items.filter((i) => i.slot == ArmorSlot.ArmorSlotLegs);
  let classItems = items.filter((i) => i.slot == ArmorSlot.ArmorSlotClass);

  // Reset runtime state for this calculation
  runtime.maximumPossibleTiers = [0, 0, 0, 0, 0, 0];
  theoreticalMaximumTiers = null;
  clearTuningAccumulatorCache();
  const stopAtTheoreticalMaximum = config.stopAtTheoreticalMaximum !== false;

  // Initialize module-level constants directly from config
  enabledModBonuses = computeEnabledModBonuses(config);
  requirementMatcher = new ArmorRequirementMatcher(config);

  // Initialize target values and configuration flags
  targetVals = [0, 0, 0, 0, 0, 0];
  targetFixed = [false, false, false, false, false, false];
  minimumStatTierValues = [0, 0, 0, 0, 0, 0];
  for (let n = 0; n < 6; n++) {
    targetVals[n] = (config.minimumStatTiers[n as ArmorStat].value || 0) * 10;
    targetFixed[n] = !!config.minimumStatTiers[n as ArmorStat].fixed;
    minimumStatTierValues[n] = config.minimumStatTiers[n as ArmorStat].value || 0;
  }
  maxMajorMods = config.statModLimits?.maxMajorMods || 0;
  maxMods = config.statModLimits?.maxMods || 0;
  possibleIncreaseByMod = 10 * maxMajorMods + 5 * Math.max(0, maxMods - maxMajorMods);
  setModSearchContext({
    targets: targetVals,
    fixed: targetFixed,
    minimumTiers: minimumStatTierValues,
    maxMajorMods,
    maxMods,
  });
  calculateTierFiveTuning = !!config.calculateTierFiveTuning;
  onlyShowResultsWithNoWastedStats = !!config.onlyShowResultsWithNoWastedStats;
  tryLimitWastedStats = !!config.tryLimitWastedStats;
  addConstent1Health = !!config.addConstent1Health;
  assumeExoticsMasterworked = !!config.assumeExoticsMasterworked;
  assumeLegendariesMasterworked = !!config.assumeLegendariesMasterworked;

  annotateArmor(helmets, config);
  annotateArmor(gauntlets, config);
  annotateArmor(chests, config);
  annotateArmor(legs, config);
  annotateArmor(classItems, config);

  let results: IPermutatorArmorSet[] = [];
  let resultsLength = 0;

  let listedResults = 0;
  let resultsSent = 0;
  let computedResults = 0;

  let bestResult: IPermutatorArmorSet | null = null;
  let bestResultSent = false;
  let bestSkillTier = -1;
  let bestWaste = Infinity;

  // Determine exotic combination mode from selectedExotics:
  // - FORCE_USE_ANY_EXOTIC or specific exotic hash(es): yield only 1-exotic combinations
  // - FORCE_USE_NO_EXOTIC: yield only all-legendary combinations
  // - Empty array (no selection): yield both
  const hasForceNoExotic = config.selectedExotics[0] === FORCE_USE_NO_EXOTIC;
  const hasForceAnyExotic = config.selectedExotics[0] === FORCE_USE_ANY_EXOTIC;
  const hasSpecificExotic =
    config.selectedExotics.length > 0 && !hasForceNoExotic && !hasForceAnyExotic;
  const noSelection = config.selectedExotics.length === 0;

  const yieldExoticCombinations = hasForceAnyExotic || hasSpecificExotic || noSelection;
  const yieldAllLegendary = hasForceNoExotic || noSelection;

  const noTargetMaximumTiers = computeNoTargetMaximumTiers(
    [helmets, gauntlets, chests, legs, classItems],
    yieldExoticCombinations,
    yieldAllLegendary
  );
  if (noTargetMaximumTiers) runtime.maximumPossibleTiers = noTargetMaximumTiers;

  let estimatedCalculations = estimateCombinationsToBeChecked(
    helmets,
    gauntlets,
    chests,
    legs,
    classItems,
    yieldExoticCombinations,
    yieldAllLegendary
  );

  const slotReachMaxima = [helmets, gauntlets, chests, legs, classItems].map((slot) =>
    maximumSlotReach(slot, config)
  );
  // Optimistic global feasibility bound: each slot, tuning, artifice, and mod contribution is
  // independently maximized. If even this overestimate misses a target, no real build can reach it.
  const globallyInfeasible = targetVals.some((target, stat) => {
    if (target <= 0) return false;
    let reach = enabledModBonuses[stat] + possibleIncreaseByMod;
    for (const slotMaximum of slotReachMaxima) reach += slotMaximum[stat];
    return reach < target;
  });
  if (globallyInfeasible) {
    postResultsMessage(
      {
        runtime,
        done: true,
        checkedCalculations: estimatedCalculations,
        estimatedCalculations,
        computedPermutations: 0,
        resultLimitReached: false,
        stats: {
          savedResults: 0,
          computedPermutations: 0,
          itemCount: items.length - classItems.length,
          totalTime: Date.now() - startTime,
        },
      },
      []
    );
    return;
  }

  let checkedCalculations = 0;
  let stoppedEarlyAtMaxTier = false;
  let lastProgressReportTime = 0;
  let cachedTuningBase: TuningBaseCache = { items: [], accumulator: null };
  let iterations = 0;
  // The first results go out quickly so the table fills early; later batches are less frequent.
  let resultFlushInterval = FIRST_RESULT_FLUSH_MS;
  let lastResultFlush = performance.now();

  // define the delay; it can be 75ms if the estimated calculations are low
  // if the estimated calculations >= 1e6, then we will use 250ms
  let progressBarDelay = estimatedCalculations >= 1e6 ? 250 : 75;

  resultLimitReached = false;
  skippedCombinations = 0;

  for (const combination of generateArmorCombinations(
    [helmets, gauntlets, chests, legs, classItems],
    yieldExoticCombinations,
    yieldAllLegendary
  )) {
    checkedCalculations += skippedCombinations;
    skippedCombinations = 0;

    if (cancelRequested) {
      console.log(
        `Thread #${threadSplit.current} received cancel request, stopping calculation early.`
      );
      break;
    }

    if (resultLimitReached) {
      const theoretical = currentTheoreticalMaximum();
      const atTheoreticalMaximum =
        stopAtTheoreticalMaximum &&
        theoretical !== null &&
        runtime.maximumPossibleTiers.every((tier, stat) => tier >= theoretical[stat]);
      const atMaximumTier = runtime.maximumPossibleTiers.every((tier) => tier >= 200);
      if (noTargetMaximumTiers || atMaximumTier || atTheoreticalMaximum) {
        stoppedEarlyAtMaxTier = atMaximumTier || atTheoreticalMaximum;
        console.log(
          `Thread #${threadSplit.current} reached result limit and every stat is at its maximum possible value, stopping calculation early.`
        );
        break;
      }
    }

    if (combination !== COMBINATION_TICK) {
      checkedCalculations++;
      const [helmet, gauntlet, chest, leg, classItem, tuningBaseItems, tuningVariableItem] =
        combination;

      if (requirementMatcher.matches(helmet, gauntlet, chest, leg, classItem)) {
        if (cachedTuningBase.items !== tuningBaseItems) {
          cachedTuningBase = { items: tuningBaseItems, accumulator: null };
        }

        const result = handlePermutation(
          helmet,
          gauntlet,
          chest,
          leg,
          classItem,
          cachedTuningBase,
          tuningVariableItem,
          noTargetMaximumTiers !== null
        );
        // The result list may be capped, but everything is still computed for accurate runtime values.
        if (!!result) {
          computedResults++;
          // Track the best result
          const resultSkillTier = getSkillTier(result.statsWithMods);
          const resultWaste = getWaste(result.statsWithMods);
          if (
            bestResult === null ||
            resultSkillTier > bestSkillTier ||
            (resultSkillTier === bestSkillTier && resultWaste < bestWaste)
          ) {
            bestResult = result;
            bestSkillTier = resultSkillTier;
            bestWaste = resultWaste;
            bestResultSent = false; // Reset since we have a new best
          }

          if (!resultLimitReached) {
            resultsSent++;
            results.push(result);
            resultsLength++;
            listedResults++;

            // Check if we just added the best result
            if (result === bestResult) {
              bestResultSent = true;
            }

            resultLimitReached =
              config.parsedResultLimit > 0 &&
              listedResults >= config.parsedResultLimit / threadSplit.count;
            if (resultLimitReached) {
              console.log(
                `Thread #${threadSplit.current} reached result limit of ${listedResults} results`
              );
            }
          }
        }
      }
    }

    const checkClock = (++iterations & 15) === 0;
    const now = checkClock ? performance.now() : 0;
    if (
      resultsLength >= 5000 ||
      (resultLimitReached && resultsLength > 0) ||
      (checkClock && resultsLength > 0 && now - lastResultFlush >= resultFlushInterval)
    ) {
      // Check if the best result is in this batch
      if (bestResult && results.includes(bestResult)) {
        bestResultSent = true;
      }

      postResultsMessage(
        {
          runtime,
          done: false,
          checkedCalculations,
          estimatedCalculations,
          computedPermutations: computedResults,
          resultLimitReached,
        },
        results
      );
      results = [];
      resultsLength = 0;
      lastResultFlush = performance.now();
      resultFlushInterval = LATER_RESULT_FLUSH_MS;
      await new Promise((resolve) => setTimeout(resolve, 0));
    } else if (
      // Pruned combinations skip the work above, so progress and queued messages are serviced here.
      checkClock &&
      lastProgressReportTime + progressBarDelay < now
    ) {
      lastProgressReportTime = now;
      postMessage({
        checkedCalculations,
        estimatedCalculations,
        computedPermutations: computedResults,
        reachableTiers: runtime.maximumPossibleTiers,
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  checkedCalculations += skippedCombinations;
  skippedCombinations = 0;
  console.timeEnd(`Total run thread #${threadSplit.current}`);

  // Check if the best result is in the final batch
  if (bestResult && results.includes(bestResult)) {
    bestResultSent = true;
  }

  // If we have a best result that wasn't sent yet, add it to the final batch
  if (bestResult && !bestResultSent) {
    resultsSent++;
    results.push(bestResult);
    console.log(
      `Thread #${threadSplit.current} adding best result (T${bestSkillTier}, W${bestWaste}) to final batch`
    );
  }

  postResultsMessage(
    {
      runtime,
      done: true,
      checkedCalculations,
      estimatedCalculations,
      computedPermutations: computedResults,
      resultLimitReached,
      stoppedEarlyAtMaxTier,
      kernelBackend: kernels().backend,
      stats: {
        savedResults: resultsSent,
        computedPermutations: computedResults,
        itemCount: items.length - classItems.length,
        totalTime: Date.now() - startTime,
      },
    },
    results
  );
  // The worker is reused, so release the accumulator cache instead of holding it while idle.
  clearTuningAccumulatorCache();
}

addEventListener("message", async ({ data }) => {
  try {
    switch (data.type) {
      case "builderRequest":
        await handleArmorBuilderRequest(data);
        break;
      case "siblingUpdate":
        // Update maximumPossibleTiers from other workers' discoveries
        if (data.maximumPossibleTiers && Array.isArray(data.maximumPossibleTiers)) {
          for (let i = 0; i < 6; i++) {
            runtime.maximumPossibleTiers[i] = Math.max(
              runtime.maximumPossibleTiers[i],
              data.maximumPossibleTiers[i] || 0
            );
          }
        }
        break;
      case "cancel":
        // Request graceful cancellation; the main loop checks this flag
        cancelRequested = true;
        break;
      case "theoreticalMaximum":
        if (Array.isArray(data.tiers) && data.tiers.length === 6)
          theoreticalMaximumTiers = data.tiers;
        break;
      default:
        console.warn(`Unknown message type: ${data.type}`);
        break;
    }
  } catch (error) {
    postMessage({ type: "workerError", error: serializeWorkerError(error) });
  }
});
// endregion Main Worker Event Handler

// region Core Calculation Functions
export function getStatSum(
  items: IDestinyArmor[]
): [number, number, number, number, number, number] {
  let mob = 0,
    res = 0,
    rec = 0,
    dis = 0,
    int_ = 0,
    str = 0;
  for (const item of items) {
    mob += item.mobility;
    res += item.resilience;
    rec += item.recovery;
    dis += item.discipline;
    int_ += item.intellect;
    str += item.strength;
  }
  return [mob, res, rec, dis, int_, str];
}

// Tuning components are small signed values. Offset and pack all six as base-256 digits so the
// dedup key stays exact (below Number.MAX_SAFE_INTEGER) without allocating strings.
const TUNING_KEY_OFFSET = 64;
const BALANCED_TUNING_MOD_HASH = 3122197216;
const TUNING_HEALTH_UP_MELEE_DOWN_HASH = 388618952;
const TUNING_HEALTH_UP_GRENADE_DOWN_HASH = 3681082702;
const TUNING_HEALTH_UP_SUPER_DOWN_HASH = 4088823605;
const TUNING_HEALTH_UP_CLASS_DOWN_HASH = 3310526732;
const TUNING_HEALTH_UP_WEAPON_DOWN_HASH = 2125798995;
const TUNING_MELEE_UP_HEALTH_DOWN_HASH = 4164883102;
const TUNING_MELEE_UP_GRENADE_DOWN_HASH = 534630542;
const TUNING_MELEE_UP_SUPER_DOWN_HASH = 311164277;
const TUNING_MELEE_UP_CLASS_DOWN_HASH = 4210715468;
const TUNING_MELEE_UP_WEAPON_DOWN_HASH = 4020349587;
const TUNING_GRENADE_UP_HEALTH_DOWN_HASH = 455024236;
const TUNING_GRENADE_UP_MELEE_DOWN_HASH = 309000506;
const TUNING_GRENADE_UP_SUPER_DOWN_HASH = 1672416975;
const TUNING_GRENADE_UP_CLASS_DOWN_HASH = 1922571986;
const TUNING_GRENADE_UP_WEAPON_DOWN_HASH = 4116389173;
const TUNING_SUPER_UP_HEALTH_DOWN_HASH = 4026414261;
const TUNING_SUPER_UP_MELEE_DOWN_HASH = 673231129;
const TUNING_SUPER_UP_GRENADE_DOWN_HASH = 3946669007;
const TUNING_SUPER_UP_CLASS_DOWN_HASH = 3554800389;
const TUNING_SUPER_UP_WEAPON_DOWN_HASH = 2244422610;
const TUNING_CLASS_UP_HEALTH_DOWN_HASH = 4030660414;
const TUNING_CLASS_UP_MELEE_DOWN_HASH = 1510949672;
const TUNING_CLASS_UP_GRENADE_DOWN_HASH = 1879022254;
const TUNING_CLASS_UP_SUPER_DOWN_HASH = 957763733;
const TUNING_CLASS_UP_WEAPON_DOWN_HASH = 323635379;
const TUNING_WEAPON_UP_HEALTH_DOWN_HASH = 3121760799;
const TUNING_WEAPON_UP_MELEE_DOWN_HASH = 691392383;
const TUNING_WEAPON_UP_GRENADE_DOWN_HASH = 3284443097;
const TUNING_WEAPON_UP_SUPER_DOWN_HASH = 891771298;
const TUNING_WEAPON_UP_CLASS_DOWN_HASH = 1918710127;
const TUNING_KEY_SPACE = 256 ** 6;

function packTuningKey(values: number[]): number {
  let key = 0;
  for (let index = 0; index < 6; index++) key = key * 256 + values[index] + TUNING_KEY_OFFSET;
  return key;
}

const tuningOptionCache = new WeakMap<t5Improvement, number[][][]>();

// The returned option lists are shared between calls and must not be modified.
export function tuningOptions(
  improvement: t5Improvement,
  includeNoTuning = true,
  includeDirectionalTunings = true
): number[][] {
  const variant = (includeNoTuning ? 1 : 0) + (includeDirectionalTunings ? 2 : 0);
  let variants = tuningOptionCache.get(improvement);
  if (!variants) {
    variants = [];
    tuningOptionCache.set(improvement, variants);
  }
  return (variants[variant] ??= buildTuningOptions(
    improvement,
    includeNoTuning,
    includeDirectionalTunings
  ));
}

function buildTuningOptions(
  improvement: t5Improvement,
  includeNoTuning: boolean,
  includeDirectionalTunings: boolean
): number[][] {
  const options: number[][] = [];
  if (includeDirectionalTunings && improvement.flexible) {
    // Armor 3 exotics can place +5 on any stat and -5 on any other stat.
    for (let positive = 0; positive < 6; positive++) {
      for (let negative = 0; negative < 6; negative++) {
        if (positive === negative) continue;
        const option = [0, 0, 0, 0, 0, 0];
        option[positive] = 5;
        option[negative] = -5;
        options.push(option);
      }
    }
  } else if (includeDirectionalTunings && improvement.tuningStat !== null) {
    // Legendary T5 pieces always place +5 on their fixed tuning stat.
    for (let negative = 0; negative < 6; negative++) {
      if (negative === improvement.tuningStat) continue;
      const option = [0, 0, 0, 0, 0, 0];
      option[improvement.tuningStat] = 5;
      option[negative] = -5;
      options.push(option);
    }
  }
  options.push(improvement.balancedBonus.slice());
  if (includeNoTuning) options.push([0, 0, 0, 0, 0, 0]);
  return options;
}

function tuningOptionHash(option: number[]): number | null {
  const positiveStat = option.indexOf(5) as ArmorStat;
  if (positiveStat < 0) {
    return option.some((value) => value !== 0) ? BALANCED_TUNING_MOD_HASH : null;
  }
  const negativeStat = option.indexOf(-5) as ArmorStat;

  switch (positiveStat) {
    case ArmorStat.StatHealth:
      switch (negativeStat) {
        case ArmorStat.StatMelee:
          return TUNING_HEALTH_UP_MELEE_DOWN_HASH;
        case ArmorStat.StatGrenade:
          return TUNING_HEALTH_UP_GRENADE_DOWN_HASH;
        case ArmorStat.StatSuper:
          return TUNING_HEALTH_UP_SUPER_DOWN_HASH;
        case ArmorStat.StatClass:
          return TUNING_HEALTH_UP_CLASS_DOWN_HASH;
        case ArmorStat.StatWeapon:
          return TUNING_HEALTH_UP_WEAPON_DOWN_HASH;
      }
      break;
    case ArmorStat.StatMelee:
      switch (negativeStat) {
        case ArmorStat.StatHealth:
          return TUNING_MELEE_UP_HEALTH_DOWN_HASH;
        case ArmorStat.StatGrenade:
          return TUNING_MELEE_UP_GRENADE_DOWN_HASH;
        case ArmorStat.StatSuper:
          return TUNING_MELEE_UP_SUPER_DOWN_HASH;
        case ArmorStat.StatClass:
          return TUNING_MELEE_UP_CLASS_DOWN_HASH;
        case ArmorStat.StatWeapon:
          return TUNING_MELEE_UP_WEAPON_DOWN_HASH;
      }
      break;
    case ArmorStat.StatGrenade:
      switch (negativeStat) {
        case ArmorStat.StatHealth:
          return TUNING_GRENADE_UP_HEALTH_DOWN_HASH;
        case ArmorStat.StatMelee:
          return TUNING_GRENADE_UP_MELEE_DOWN_HASH;
        case ArmorStat.StatSuper:
          return TUNING_GRENADE_UP_SUPER_DOWN_HASH;
        case ArmorStat.StatClass:
          return TUNING_GRENADE_UP_CLASS_DOWN_HASH;
        case ArmorStat.StatWeapon:
          return TUNING_GRENADE_UP_WEAPON_DOWN_HASH;
      }
      break;
    case ArmorStat.StatSuper:
      switch (negativeStat) {
        case ArmorStat.StatHealth:
          return TUNING_SUPER_UP_HEALTH_DOWN_HASH;
        case ArmorStat.StatMelee:
          return TUNING_SUPER_UP_MELEE_DOWN_HASH;
        case ArmorStat.StatGrenade:
          return TUNING_SUPER_UP_GRENADE_DOWN_HASH;
        case ArmorStat.StatClass:
          return TUNING_SUPER_UP_CLASS_DOWN_HASH;
        case ArmorStat.StatWeapon:
          return TUNING_SUPER_UP_WEAPON_DOWN_HASH;
      }
      break;
    case ArmorStat.StatClass:
      switch (negativeStat) {
        case ArmorStat.StatHealth:
          return TUNING_CLASS_UP_HEALTH_DOWN_HASH;
        case ArmorStat.StatMelee:
          return TUNING_CLASS_UP_MELEE_DOWN_HASH;
        case ArmorStat.StatGrenade:
          return TUNING_CLASS_UP_GRENADE_DOWN_HASH;
        case ArmorStat.StatSuper:
          return TUNING_CLASS_UP_SUPER_DOWN_HASH;
        case ArmorStat.StatWeapon:
          return TUNING_CLASS_UP_WEAPON_DOWN_HASH;
      }
      break;
    case ArmorStat.StatWeapon:
      switch (negativeStat) {
        case ArmorStat.StatHealth:
          return TUNING_WEAPON_UP_HEALTH_DOWN_HASH;
        case ArmorStat.StatMelee:
          return TUNING_WEAPON_UP_MELEE_DOWN_HASH;
        case ArmorStat.StatGrenade:
          return TUNING_WEAPON_UP_GRENADE_DOWN_HASH;
        case ArmorStat.StatSuper:
          return TUNING_WEAPON_UP_SUPER_DOWN_HASH;
        case ArmorStat.StatClass:
          return TUNING_WEAPON_UP_CLASS_DOWN_HASH;
      }
  }

  return null;
}

export function findTuningModHashes(
  improvements: (t5Improvement | null)[],
  target: Tuning
): number[] | null {
  // Depth-first search over each piece's options in a fixed order; the first full assignment wins.
  // Dead ends are memoised by (piece index, remaining tuning) using a numeric key.
  const failedStates = new Set<number>();
  const remaining = [...target];
  const chosen: number[] = [];
  const noTuning = [[0, 0, 0, 0, 0, 0]];
  const inKeyRange = () => remaining.every((value) => Math.abs(value) < TUNING_KEY_OFFSET);
  const memoisable = inKeyRange();

  // Per-stat range the pieces from `index` onwards can still contribute. A remaining tuning outside
  // it cannot be completed, so those branches are skipped without searching them.
  const suffixMin: number[][] = [];
  const suffixMax: number[][] = [];
  let runningMin = [0, 0, 0, 0, 0, 0];
  let runningMax = [0, 0, 0, 0, 0, 0];
  suffixMin[improvements.length] = runningMin;
  suffixMax[improvements.length] = runningMax;
  for (let index = improvements.length - 1; index >= 0; index--) {
    const improvement = improvements[index];
    const options = improvement ? tuningOptions(improvement) : noTuning;
    const nextMin = [...runningMin];
    const nextMax = [...runningMax];
    for (let stat = 0; stat < 6; stat++) {
      let low = Infinity;
      let high = -Infinity;
      for (const option of options) {
        if (option[stat] < low) low = option[stat];
        if (option[stat] > high) high = option[stat];
      }
      nextMin[stat] += low;
      nextMax[stat] += high;
    }
    suffixMin[index] = runningMin = nextMin;
    suffixMax[index] = runningMax = nextMax;
  }

  function withinReach(index: number): boolean {
    const low = suffixMin[index];
    const high = suffixMax[index];
    for (let stat = 0; stat < 6; stat++) {
      if (remaining[stat] < low[stat] || remaining[stat] > high[stat]) return false;
    }
    return true;
  }

  function find(index: number): boolean {
    if (!withinReach(index)) return false;
    if (index === improvements.length) {
      return remaining.every((value) => value === 0);
    }

    const stateKey = memoisable ? index * TUNING_KEY_SPACE + packTuningKey(remaining) : -1;
    if (memoisable && failedStates.has(stateKey)) return false;
    const improvement = improvements[index];
    const options = improvement ? tuningOptions(improvement) : noTuning;
    for (const option of options) {
      for (let stat = 0; stat < 6; stat++) remaining[stat] -= option[stat];
      if ((!memoisable || inKeyRange()) && find(index + 1)) {
        const hash = tuningOptionHash(option);
        if (hash !== null) chosen.push(hash);
        return true;
      }
      for (let stat = 0; stat < 6; stat++) remaining[stat] += option[stat];
    }
    if (memoisable) failedStates.add(stateKey);
    return false;
  }

  if (!find(0)) return null;
  return chosen.reverse();
}

function combineBalancedTunings(improvements: t5Improvement[]): Tuning {
  return improvements.reduce(
    (combined, improvement) =>
      combined.map((value, stat) => value + improvement.balancedBonus[stat]) as Tuning,
    [0, 0, 0, 0, 0, 0] as Tuning
  );
}

function pieceStatsWithMasterwork(piece: IPermutatorArmor, config: BuildConfiguration): number[] {
  const stats = [
    piece.resilience,
    piece.strength,
    piece.discipline,
    piece.intellect,
    piece.recovery,
    piece.mobility,
  ];
  if (piece.armorSystem === ArmorSystem.Armor2) {
    if (
      piece.masterworkLevel === MAXIMUM_MASTERWORK_LEVEL ||
      (piece.isExotic ? config.assumeExoticsMasterworked : config.assumeLegendariesMasterworked)
    ) {
      for (let stat = 0; stat < 6; stat++) stats[stat] += 2;
    }
  } else if (piece.armorSystem === ArmorSystem.Armor3) {
    let multiplier = piece.masterworkLevel;
    if (piece.isExotic ? config.assumeExoticsMasterworked : config.assumeLegendariesMasterworked) {
      multiplier = MAXIMUM_MASTERWORK_LEVEL;
    }
    for (let stat = 0; stat < 6; stat++) {
      if (!piece.archetypeStats.includes(stat)) stats[stat] += multiplier;
    }
  }
  return stats;
}

function pieceArtificeCapable(piece: IPermutatorArmor): boolean {
  return piece.perk === ArmorPerkOrSlot.SlotArtifice;
}

function pieceMixSet(piece: IPermutatorArmor, config: BuildConfiguration): number[][] {
  // Every stat vector this piece can contribute on its own: base + assumed masterwork + one tuning.
  // Shared build resources (regular mods and other pieces) do not distinguish same-profile pieces.
  const base = pieceStatsWithMasterwork(piece, config);
  const improvement = isT5WithTuning(piece) ? mapItemToTuning(piece) : null;
  const options = improvement
    ? tuningOptions(improvement, targetFixed.some(Boolean), config.calculateTierFiveTuning)
    : [[0, 0, 0, 0, 0, 0]];
  return options.map((option) => base.map((value, stat) => value + option[stat]));
}

function maximumSlotReach(pieces: IPermutatorArmor[], config: BuildConfiguration): number[] {
  const maximum = [0, 0, 0, 0, 0, 0];
  for (const piece of pieces) {
    const artificeBonus = pieceArtificeCapable(piece) ? 3 : 0;
    for (const mix of pieceMixSet(piece, config)) {
      for (let stat = 0; stat < 6; stat++) {
        const reach = mix[stat] + artificeBonus;
        if (reach > maximum[stat]) maximum[stat] = reach;
      }
    }
  }
  return maximum;
}

export function handlePermutation(
  helmet: IPermutatorArmor,
  gauntlet: IPermutatorArmor,
  chest: IPermutatorArmor,
  leg: IPermutatorArmor,
  classItem: IPermutatorArmor,
  tuningBaseCache?: TuningBaseCache,
  tuningVariableItem?: IPermutatorArmor,
  exactNoTargetMaximum = false
): IPermutatorArmorSet | null {
  // Inline stat summation (without mod bonuses)
  const b0 = enabledModBonuses[0],
    b1 = enabledModBonuses[1],
    b2 = enabledModBonuses[2],
    b3 = enabledModBonuses[3],
    b4 = enabledModBonuses[4],
    b5 = enabledModBonuses[5];

  const statsWithoutMods: number[] = [
    helmet.resilience +
      gauntlet.resilience +
      chest.resilience +
      leg.resilience +
      classItem.resilience +
      (!chest.isExotic && addConstent1Health ? 1 : 0),
    helmet.strength + gauntlet.strength + chest.strength + leg.strength + classItem.strength,
    helmet.discipline +
      gauntlet.discipline +
      chest.discipline +
      leg.discipline +
      classItem.discipline,
    helmet.intellect + gauntlet.intellect + chest.intellect + leg.intellect + classItem.intellect,
    helmet.recovery + gauntlet.recovery + chest.recovery + leg.recovery + classItem.recovery,
    helmet.mobility + gauntlet.mobility + chest.mobility + leg.mobility + classItem.mobility,
  ];

  // Add mod bonuses to get the working stats array
  const stats: number[] = [
    statsWithoutMods[0] + b0,
    statsWithoutMods[1] + b1,
    statsWithoutMods[2] + b2,
    statsWithoutMods[3] + b3,
    statsWithoutMods[4] + b4,
    statsWithoutMods[5] + b5,
  ];

  let artificeCount = 0;
  if (applyMWAndCheckArtifice(helmet, stats)) artificeCount++;
  if (applyMWAndCheckArtifice(gauntlet, stats)) artificeCount++;
  if (applyMWAndCheckArtifice(chest, stats)) artificeCount++;
  if (applyMWAndCheckArtifice(leg, stats)) artificeCount++;
  if (applyMWAndCheckArtifice(classItem, stats)) artificeCount++;

  // Distances to target (using array literal for V8 SMI optimization)
  const distances: number[] = [
    Math.max(0, targetVals[0] - stats[0]),
    Math.max(0, targetVals[1] - stats[1]),
    Math.max(0, targetVals[2] - stats[2]),
    Math.max(0, targetVals[3] - stats[3]),
    Math.max(0, targetVals[4] - stats[4]),
    Math.max(0, targetVals[5] - stats[5]),
  ];

  if (onlyShowResultsWithNoWastedStats) {
    for (let stat = 0; stat < 6; stat++) {
      const v = 10 - (stats[stat] % 10);
      if (v < 10 && v > distances[stat]) distances[stat] = v;
    }
  }

  // Quick distance sum check before T5 work
  // This early check avoids computing T5 improvements and tuningMax when the
  // total distance already exceeds the maximum possible from mods + artifice alone.
  const distanceSum =
    distances[0] + distances[1] + distances[2] + distances[3] + distances[4] + distances[5];

  if (distanceSum > 50 + 3 * artificeCount) {
    // Even with the maximum possible tuning contribution, still too far?
    // This is a conservative pre-check; the full check follows after T5 computation.
    const maximumTuningContribution = calculateTierFiveTuning ? 25 : 15;
    if (distanceSum > 50 + 3 * artificeCount + maximumTuningContribution) {
      return null;
    }
  }

  // T5 tuning improvements (without items array, with direct index comparisons)
  let t5Count = 0;
  const t5Improvements: t5Improvement[] = [];
  const tuningMax: number[] = [0, 0, 0, 0, 0, 0];

  if (isT5WithTuning(helmet)) t5Improvements.push(mapItemToTuning(helmet));
  if (isT5WithTuning(gauntlet)) t5Improvements.push(mapItemToTuning(gauntlet));
  if (isT5WithTuning(chest)) t5Improvements.push(mapItemToTuning(chest));
  if (isT5WithTuning(leg)) t5Improvements.push(mapItemToTuning(leg));
  if (isT5WithTuning(classItem)) t5Improvements.push(mapItemToTuning(classItem));
  t5Count = t5Improvements.length;

  for (const t5 of t5Improvements) {
    for (let stat = 0; stat < 6; stat++) {
      if (calculateTierFiveTuning) {
        tuningMax[stat] += t5.flexible || stat === t5.tuningStat ? 5 : t5.balancedBonus[stat];
      } else {
        tuningMax[stat] += t5.balancedBonus[stat];
      }
    }
  }

  // Full global bound check with T5
  const tuningPointBudget = (calculateTierFiveTuning ? 5 : 3) * t5Count;
  if (distanceSum > 50 + 3 * artificeCount + tuningPointBudget) {
    return null;
  }

  // Optional distances for waste limiting
  const optionalDistances = [0, 0, 0, 0, 0, 0];
  if (tryLimitWastedStats) {
    for (let stat = 0; stat < 6; stat++) {
      if (
        distances[stat] === 0 &&
        !targetFixed[stat] &&
        stats[stat] < 200 &&
        stats[stat] % 10 > 0
      ) {
        optionalDistances[stat] = 10 - (stats[stat] % 10);
      }
    }
  }

  const totalOptionalDistances =
    optionalDistances[0] +
    optionalDistances[1] +
    optionalDistances[2] +
    optionalDistances[3] +
    optionalDistances[4] +
    optionalDistances[5];

  // Per-stat quick feasibility check (uses precomputed possibleIncreaseByMod)
  for (let stat = 0; stat < 6; stat++) {
    if (possibleIncreaseByMod + tuningMax[stat] + 3 * artificeCount < distances[stat]) {
      return null;
    }
  }

  const k = kernels();
  k.scratchReset();
  let tunings: TuningSet;
  let tuningsPrioritized = false;
  if (t5Count > 0) {
    const includeNoTuning = targetFixed.some(Boolean);
    if (exactNoTargetMaximum) {
      tunings = singleTuningSet(combineBalancedTunings(t5Improvements));
    } else if (calculateTierFiveTuning) {
      if (tuningBaseCache && tuningVariableItem) {
        // Checked up front: clearing mid-build would invalidate the base accumulator being extended.
        if (tuningAccumulatorCacheTunings >= TUNING_ACCUMULATOR_CACHE_TUNING_LIMIT) {
          clearTuningAccumulatorCache();
        }
        if (tuningBaseCache.accumulator?.generation !== k.persistentGeneration()) {
          tuningBaseCache.accumulator = null;
        }
        if (tuningBaseCache.accumulator === null) {
          const baseTuned = tuningBaseCache.items.filter(isT5WithTuning);
          const baseImprovements = baseTuned.map(mapItemToTuning);
          tuningBaseCache.key = baseTuned.map(tuningSignatureId).join(",");
          tuningBaseCache.accumulator = cachedTuningAccumulator(tuningBaseCache.key, () =>
            buildTuningSet(baseImprovements, includeNoTuning)
          );
        }
        const baseAccumulator = tuningBaseCache.accumulator;
        const tuningAccumulator = isT5WithTuning(tuningVariableItem)
          ? cachedTuningAccumulator(
              `${tuningBaseCache.key}+${tuningSignatureId(tuningVariableItem)}`,
              () =>
                extendTuningSet(
                  baseAccumulator.set,
                  tuningOptions(mapItemToTuning(tuningVariableItem), includeNoTuning)
                )
            )
          : baseAccumulator;
        tunings = prioritizedAccumulatorSet(tuningAccumulator, targetVals);
        tuningsPrioritized = true;
      } else {
        tunings = buildTuningSet(t5Improvements, includeNoTuning);
      }
    } else {
      tunings = buildTuningSet(t5Improvements, includeNoTuning, false);
    }
  } else {
    tunings = singleTuningSet([0, 0, 0, 0, 0, 0]);
  }
  tunings = filterTuningSetForLockedStats(tunings, stats, targetFixed, targetVals);
  tunings = filterTuningSetBySharedBudget(
    tunings,
    stats,
    targetVals,
    possibleIncreaseByMod + 3 * artificeCount
  );
  if (tuningSetSize(tunings) === 0) return null;
  if (!tuningsPrioritized) tunings = prioritizeTuningSet(tunings, targetVals);

  // heavy work: mod precalc
  let result: { mods: StatModifier[]; tuning: Tuning } | null;
  if (distanceSum === 0 && totalOptionalDistances === 0) {
    result = { mods: [], tuning: tuningSetAt(tunings, 0) };
  } else {
    result = findStatMods(stats, distances, optionalDistances, artificeCount, tunings);
  }

  if (result === null) return null;

  const artificeTierBonus = 3 * artificeCount;
  const sharedTierBudget = possibleIncreaseByMod + artificeTierBonus + tuningPointBudget;
  let totalTargetGaps = 0;
  for (let stat = 0; stat < 6; stat++) {
    totalTargetGaps += Math.max(0, targetVals[stat] - stats[stat]);
  }
  // maximumPossibleTiers only grows. Skip the expensive binary searches when this build's
  // optimistic per-stat ceilings cannot improve any currently known maximum.
  const canImproveTiers = stats.some((value, stat) => {
    const statTargetGap = Math.max(0, targetVals[stat] - value);
    const perStatCeiling = value + tuningMax[stat] + possibleIncreaseByMod + artificeTierBonus;
    const sharedBudgetCeiling =
      value + Math.max(0, sharedTierBudget - (totalTargetGaps - statTargetGap));
    let ceiling = Math.min(200, perStatCeiling, sharedBudgetCeiling);
    if (targetFixed[stat]) ceiling = Math.min(ceiling, targetVals[stat]);
    return ceiling > runtime.maximumPossibleTiers[stat];
  });
  if (canImproveTiers && !exactNoTargetMaximum) {
    raiseReachableTiers(
      stats,
      distances,
      artificeCount,
      tunings,
      !targetFixed.some((fixed) => fixed) &&
        !tryLimitWastedStats &&
        !onlyShowResultsWithNoWastedStats,
      runtime.maximumPossibleTiers
    );
  }

  const usedArtifice = result.mods.filter((modifier) => STAT_MOD_VALUES[modifier][2] === 0);
  const usedMods = result.mods.filter((modifier) => STAT_MOD_VALUES[modifier][2] !== 0);

  // Apply mods to stats for final calculation
  const finalStats = [...stats];
  for (let statModifier of result.mods) {
    const stat = STAT_MOD_VALUES[statModifier][0];
    finalStats[stat] += STAT_MOD_VALUES[statModifier][1];
  }

  for (let n = 0; n < 6; n++) finalStats[n] += result.tuning[n];

  const waste1 = getWaste(finalStats);
  if (onlyShowResultsWithNoWastedStats && waste1 > 0) return null;

  const usedTuningMods = findTuningModHashes(
    [helmet, gauntlet, chest, leg, classItem].map((item) =>
      isT5WithTuning(item) ? mapItemToTuning(item) : null
    ),
    result.tuning
  );
  if (usedTuningMods === null) return null;

  return createArmorSet(
    helmet,
    gauntlet,
    chest,
    leg,
    classItem,
    usedArtifice,
    usedMods,
    usedTuningMods,
    finalStats,
    statsWithoutMods,
    result.tuning
  );
}

// region Mod Calculation Functions
export function getSkillTier(stats: number[]) {
  return (
    Math.floor(Math.min(200, stats[ArmorStat.StatWeapon]) / 10) +
    Math.floor(Math.min(200, stats[ArmorStat.StatHealth]) / 10) +
    Math.floor(Math.min(200, stats[ArmorStat.StatClass]) / 10) +
    Math.floor(Math.min(200, stats[ArmorStat.StatGrenade]) / 10) +
    Math.floor(Math.min(200, stats[ArmorStat.StatSuper]) / 10) +
    Math.floor(Math.min(200, stats[ArmorStat.StatMelee]) / 10)
  );
}

export function getWaste(stats: number[]) {
  return (
    Math.max(0, stats[ArmorStat.StatWeapon] - 200) +
    Math.max(0, stats[ArmorStat.StatHealth] - 200) +
    Math.max(0, stats[ArmorStat.StatClass] - 200) +
    Math.max(0, stats[ArmorStat.StatGrenade] - 200) +
    Math.max(0, stats[ArmorStat.StatSuper] - 200) +
    Math.max(0, stats[ArmorStat.StatMelee] - 200)
  );
}
// endregion Core Calculation Functions
