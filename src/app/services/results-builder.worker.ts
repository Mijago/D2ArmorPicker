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
  ArmorPerkSocketHashes,
  ArmorStat,
  SpecialArmorStat,
  STAT_MOD_VALUES,
  StatModifier,
} from "../data/enum/armor-stat";

import { environment } from "../../environments/environment";

import { IPermutatorArmor } from "../data/types/IPermutatorArmor";
import { IPermutatorArmorSet, Tuning, createArmorSet } from "../data/types/IPermutatorArmorSet";
import { ArmorSystem } from "../data/types/IManifestArmor";

import { precalculatedTuningModCombinations } from "../data/generated/precalculatedModCombinationsWithTunings";

// endregion Imports
let runtime: {
  maximumPossibleTiers: number[];
} = {
  maximumPossibleTiers: [0, 0, 0, 0, 0, 0],
};

// Cancellation flag, controlled via messages from the main thread
let cancelRequested = false;

// Module-level configuration to avoid passing around
let assumeEveryLegendaryIsArtifice: boolean;
let assumeEveryExoticIsArtifice: boolean;
let assumeClassItemIsArtifice: boolean;
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
let requiredPerkSlotCounts: Map<number, number>;
let targetVals: number[];
let targetFixed: boolean[];
let possibleIncreaseByMod: number;
let resultLimitReached: boolean = false;

// Precompute the numeric ArmorPerkOrSlot values so we can distinguish
// between regular perk requirements and numeric gearSetHash requirements
// inside the shared requirements map.
const armorPerkValues = new Set<number>(
  Object.values(ArmorPerkOrSlot).filter((v) => typeof v === "number") as number[]
);

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
  accumulator: Map<number, Tuning> | null;
};

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
  return {
    tuningStat: isFlexibleExotic(i) ? null : i.tuningStat!,
    archetypeStats: i.archetypeStats ?? [],
    flexible: isFlexibleExotic(i),
    balancedBonus: lowestThreeBonus(i),
  };
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
    piece._art = pieceArtificeCapable(piece, config) ? 1 : 0;
    piece._tuneTot = hasTuning ? 3 : 0;
    piece._sum = masterworkedStats.reduce((sum, value) => sum + value, 0);
  }
}

function groupCanReachTargets(
  baseItems: readonly IPermutatorArmor[],
  variableCandidates: readonly IPermutatorArmor[]
): boolean {
  if (variableCandidates.length === 0) return false;

  const baseStats = [0, 0, 0, 0, 0, 0];
  const baseTuning = [0, 0, 0, 0, 0, 0];
  let baseArtifice = 0;
  for (const item of baseItems as readonly AnnotatedArmor[]) {
    baseArtifice += item._art;
    for (let stat = 0; stat < 6; stat++) {
      baseStats[stat] += item._mw[stat];
      baseTuning[stat] += item._tune[stat];
    }
  }

  const candidateReach = [0, 0, 0, 0, 0, 0];
  let candidateArtifice = 0;
  for (const item of variableCandidates as readonly AnnotatedArmor[]) {
    candidateArtifice = Math.max(candidateArtifice, item._art);
    for (let stat = 0; stat < 6; stat++) {
      candidateReach[stat] = Math.max(candidateReach[stat], item._mw[stat] + item._tune[stat]);
    }
  }

  const sharedBudget = possibleIncreaseByMod + 3 * (baseArtifice + candidateArtifice);
  const baseChest = baseItems.find((item) => item.slot === ArmorSlot.ArmorSlotChest);
  const minimumHealthBonus = addConstent1Health
    ? baseChest
      ? baseChest.isExotic
        ? 0
        : 1
      : variableCandidates.some((item) => item.isExotic)
        ? 0
        : 1
    : 0;
  let residualGap = 0;
  for (let stat = 0; stat < 6; stat++) {
    const constantHealth = stat === ArmorStat.StatHealth ? minimumHealthBonus : 0;
    if (targetVals[stat] <= 0) continue;
    const reachWithoutSharedBudget =
      enabledModBonuses[stat] +
      baseStats[stat] +
      baseTuning[stat] +
      candidateReach[stat] +
      constantHealth;
    if (reachWithoutSharedBudget + sharedBudget < targetVals[stat]) return false;
    residualGap += Math.max(0, targetVals[stat] - reachWithoutSharedBudget);
  }

  return residualGap <= sharedBudget;
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
    return (
      item.perk === ArmorPerkOrSlot.SlotArtifice ||
      (item.isExotic ? assumeEveryExoticIsArtifice : assumeEveryLegendaryIsArtifice)
    );
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
function checkSlots(
  helmet: IPermutatorArmor,
  gauntlet: IPermutatorArmor,
  chest: IPermutatorArmor,
  leg: IPermutatorArmor,
  classItem: IPermutatorArmor
): boolean {
  let requirements = new Map(requiredPerkSlotCounts);
  const items = [helmet, gauntlet, chest, leg, classItem];

  // Items with gearSetPerkSelectable can fulfill any single gear set
  // requirement (their gearSetHash will be null), so we track how many
  // such wildcard items we have and apply them after normal counting.
  let selectableGearSetItems = 0;

  for (let item of items) {
    let effectivePerk = item.perk;

    if (item.armorSystem === ArmorSystem.Armor2) {
      if (
        (item.isExotic && assumeEveryExoticIsArtifice) ||
        (!item.isExotic &&
          (assumeEveryLegendaryIsArtifice ||
            (item.slot == ArmorSlot.ArmorSlotClass && assumeClassItemIsArtifice)))
      ) {
        effectivePerk = ArmorPerkOrSlot.SlotArtifice;
      }
    }

    requirements.set(effectivePerk, (requirements.get(effectivePerk) ?? 0) - 1);

    if (item.gearSetPerkSelectable) {
      selectableGearSetItems++;
    }

    if (item.gearSetHash != null)
      requirements.set(item.gearSetHash, (requirements.get(item.gearSetHash) ?? 0) - 1);
  }

  let remainingPerkRequirements = 0;
  let remainingGearSetRequirements = 0;

  for (let [key, value] of requirements) {
    if (key == ArmorPerkOrSlot.Any || key == ArmorPerkOrSlot.None) continue;
    const remaining = Math.max(0, value ?? 0);
    if (remaining === 0) continue;

    if (armorPerkValues.has(key)) {
      remainingPerkRequirements += remaining;
    } else {
      // Treat non-perk numeric keys as gear set requirements
      remainingGearSetRequirements += remaining;
    }
  }

  // Each selectable gear set item can satisfy one remaining gear set
  // requirement, regardless of which specific gear set hash it is.
  remainingGearSetRequirements = Math.max(0, remainingGearSetRequirements - selectableGearSetItems);

  return remainingPerkRequirements + remainingGearSetRequirements === 0;
}

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

function calculateRequiredPerkCounts(config: BuildConfiguration) {
  let constantPerkRequirement = new Map<ArmorPerkOrSlot, number>();

  for (let [key] of constantPerkRequirement) {
    constantPerkRequirement.set(key, 0);
  }

  for (const requirement of config.armorRequirements) {
    if ("perk" in requirement) {
      let perk = requirement.perk;

      const e = Object.entries(ArmorPerkSocketHashes).find(([, value]) => value == perk);
      if (e) perk = Number.parseInt(e[0]) as any as ArmorPerkOrSlot;

      if (perk != ArmorPerkOrSlot.Any && perk != ArmorPerkOrSlot.None) {
        constantPerkRequirement.set(perk, (constantPerkRequirement.get(perk) ?? 0) + 1);
      }
    } else if ("gearSetHash" in requirement) {
      // Gear set requirement
      constantPerkRequirement.set(
        requirement.gearSetHash,
        (constantPerkRequirement.get(requirement.gearSetHash) ?? 0) + 1
      );
    }
  }
  return constantPerkRequirement;
}

function* generateArmorCombinations(
  helmets: IPermutatorArmor[],
  gauntlets: IPermutatorArmor[],
  chests: IPermutatorArmor[],
  legs: IPermutatorArmor[],
  classItems: IPermutatorArmor[],
  yieldExoticCombinations: boolean,
  yieldAllLegendary: boolean
): Generator<ArmorCombination> {
  const legendaryHelmets = helmets.filter((h) => !h.isExotic);
  const legendaryGauntlets = gauntlets.filter((g) => !g.isExotic);
  const legendaryChests = chests.filter((c) => !c.isExotic);
  const legendaryLegs = legs.filter((l) => !l.isExotic);
  const legendaryClassItems = classItems.filter((d) => !d.isExotic);

  // Yield combinations with exactly one exotic item and legendaries in all other slots
  if (yieldExoticCombinations) {
    const exoticHelmets = helmets.filter((h) => h.isExotic);
    const exoticGauntlets = gauntlets.filter((g) => g.isExotic);
    const exoticChests = chests.filter((c) => c.isExotic);
    const exoticLegs = legs.filter((l) => l.isExotic);
    const exoticClassItems = classItems.filter((d) => d.isExotic);

    for (const gauntlet of legendaryGauntlets)
      for (const chest of legendaryChests)
        for (const leg of legendaryLegs)
          for (const classItem of legendaryClassItems) {
            const base = [gauntlet, chest, leg, classItem] as const;
            for (const helmet of exoticHelmets)
              yield [helmet, gauntlet, chest, leg, classItem, base, helmet, exoticHelmets] as const;
          }

    for (const helmet of legendaryHelmets)
      for (const chest of legendaryChests)
        for (const leg of legendaryLegs)
          for (const classItem of legendaryClassItems) {
            const base = [helmet, chest, leg, classItem] as const;
            for (const gauntlet of exoticGauntlets)
              yield [
                helmet,
                gauntlet,
                chest,
                leg,
                classItem,
                base,
                gauntlet,
                exoticGauntlets,
              ] as const;
          }

    for (const helmet of legendaryHelmets)
      for (const gauntlet of legendaryGauntlets)
        for (const leg of legendaryLegs)
          for (const classItem of legendaryClassItems) {
            const base = [helmet, gauntlet, leg, classItem] as const;
            for (const chest of exoticChests)
              yield [helmet, gauntlet, chest, leg, classItem, base, chest, exoticChests] as const;
          }

    for (const helmet of legendaryHelmets)
      for (const gauntlet of legendaryGauntlets)
        for (const chest of legendaryChests)
          for (const classItem of legendaryClassItems) {
            const base = [helmet, gauntlet, chest, classItem] as const;
            for (const leg of exoticLegs)
              yield [helmet, gauntlet, chest, leg, classItem, base, leg, exoticLegs] as const;
          }

    for (const helmet of legendaryHelmets)
      for (const gauntlet of legendaryGauntlets)
        for (const chest of legendaryChests)
          for (const leg of legendaryLegs) {
            const base = [helmet, gauntlet, chest, leg] as const;
            for (const classItem of exoticClassItems)
              yield [
                helmet,
                gauntlet,
                chest,
                leg,
                classItem,
                base,
                classItem,
                exoticClassItems,
              ] as const;
          }
  }

  // Yield all-legendary combinations
  if (yieldAllLegendary) {
    for (const helmet of legendaryHelmets)
      for (const gauntlet of legendaryGauntlets)
        for (const chest of legendaryChests)
          for (const leg of legendaryLegs) {
            const base = [helmet, gauntlet, chest, leg] as const;
            for (const classItem of legendaryClassItems)
              yield [
                helmet,
                gauntlet,
                chest,
                leg,
                classItem,
                base,
                classItem,
                legendaryClassItems,
              ] as const;
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
    requiredPerkSlotCounts.size > 0
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
async function handleArmorBuilderRequest(data: any): Promise<void> {
  // Reset cancellation flag at the beginning of each run
  cancelRequested = false;

  const threadSplit = data.threadSplit as { count: number; current: number };
  const config = data.config as BuildConfiguration;
  let items = data.items as IPermutatorArmor[];

  if (threadSplit == undefined || config == undefined || items == undefined) {
    return;
  }

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

  // Initialize module-level constants directly from config
  enabledModBonuses = computeEnabledModBonuses(config);
  requiredPerkSlotCounts = calculateRequiredPerkCounts(config);

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
  assumeEveryLegendaryIsArtifice = !!config.assumeEveryLegendaryIsArtifice;
  assumeEveryExoticIsArtifice = !!config.assumeEveryExoticIsArtifice;
  assumeClassItemIsArtifice = !!config.assumeClassItemIsArtifice;
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
    postMessage({
      runtime,
      results: [],
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
    });
    return;
  }

  let checkedCalculations = 0;
  let stoppedEarlyAtMaxTier = false;
  let lastProgressReportTime = 0;
  let cachedTuningBase: TuningBaseCache = { items: [], accumulator: null };
  let cachedGroupBaseItems: readonly IPermutatorArmor[] | null = null;
  let cachedGroupCanReachTargets = true;

  // define the delay; it can be 75ms if the estimated calculations are low
  // if the estimated calculations >= 1e6, then we will use 250ms
  let progressBarDelay = estimatedCalculations >= 1e6 ? 250 : 75;

  resultLimitReached = false;

  for (let [
    helmet,
    gauntlet,
    chest,
    leg,
    classItem,
    tuningBaseItems,
    tuningVariableItem,
    tuningVariableCandidates,
  ] of generateArmorCombinations(
    helmets,
    gauntlets,
    chests,
    legs,
    classItems,
    yieldExoticCombinations,
    yieldAllLegendary
  )) {
    if (cancelRequested) {
      console.log(
        `Thread #${threadSplit.current} received cancel request, stopping calculation early.`
      );
      break;
    }

    if (
      resultLimitReached &&
      (noTargetMaximumTiers || runtime.maximumPossibleTiers.every((tier) => tier >= 200))
    ) {
      stoppedEarlyAtMaxTier = runtime.maximumPossibleTiers.every((tier) => tier >= 200);
      console.log(
        `Thread #${threadSplit.current} reached result limit and maximum possible tiers are all 200, stopping calculation early.`
      );
      break;
    }

    checkedCalculations++;
    if (cachedGroupBaseItems !== tuningBaseItems) {
      cachedGroupCanReachTargets = groupCanReachTargets(tuningBaseItems, tuningVariableCandidates);
      cachedGroupBaseItems = tuningBaseItems;
    }
    if (!cachedGroupCanReachTargets) continue;
    if (!checkSlots(helmet, gauntlet, chest, leg, classItem)) continue;

    if (cachedTuningBase.items !== tuningBaseItems) {
      cachedTuningBase = { items: tuningBaseItems, accumulator: null };
    }

    // Only calculate more permutations if the results limit has not been reached yet and
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
    // Only add 50k to the list if the setting is activated.
    // We will still calculate the rest so that we get accurate results for the runtime values
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

    if (resultsLength >= 5000 || (resultLimitReached && resultsLength > 0)) {
      // Check if the best result is in this batch
      if (bestResult && results.includes(bestResult)) {
        bestResultSent = true;
      }

      // @ts-ignore
      postMessage({
        runtime,
        results,
        done: false,
        checkedCalculations,
        estimatedCalculations,
        computedPermutations: computedResults,
        resultLimitReached,
      });
      results = [];
      resultsLength = 0;
      await new Promise((resolve) => setTimeout(resolve, 0));
    } else if (lastProgressReportTime + progressBarDelay < performance.now()) {
      lastProgressReportTime = performance.now();
      postMessage({
        checkedCalculations,
        estimatedCalculations,
        computedPermutations: computedResults,
        reachableTiers: runtime.maximumPossibleTiers,
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
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

  // @ts-ignore
  postMessage({
    runtime,
    results,
    done: true,
    checkedCalculations,
    estimatedCalculations,
    computedPermutations: computedResults,
    resultLimitReached,
    stoppedEarlyAtMaxTier,
    stats: {
      savedResults: resultsSent,
      computedPermutations: computedResults,
      itemCount: items.length - classItems.length,
      totalTime: Date.now() - startTime,
    },
  });
}

addEventListener("message", async ({ data }) => {
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
    default:
      console.warn(`Unknown message type: ${data.type}`);
      break;
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
const STAT_MODIFIERS: [StatModifier, StatModifier, StatModifier][] = [
  [StatModifier.MINOR_HEALTH, StatModifier.MAJOR_HEALTH, StatModifier.ARTIFICE_HEALTH],
  [StatModifier.MINOR_MELEE, StatModifier.MAJOR_MELEE, StatModifier.ARTIFICE_MELEE],
  [StatModifier.MINOR_GRENADE, StatModifier.MAJOR_GRENADE, StatModifier.ARTIFICE_GRENADE],
  [StatModifier.MINOR_SUPER, StatModifier.MAJOR_SUPER, StatModifier.ARTIFICE_SUPER],
  [StatModifier.MINOR_CLASS, StatModifier.MAJOR_CLASS, StatModifier.ARTIFICE_CLASS],
  [StatModifier.MINOR_WEAPON, StatModifier.MAJOR_WEAPON, StatModifier.ARTIFICE_WEAPON],
];
function packTuningKey(values: number[]): number {
  let key = 0;
  for (let index = 0; index < 6; index++) key = key * 256 + values[index] + TUNING_KEY_OFFSET;
  return key;
}

function tuningOptions(
  improvement: t5Improvement,
  includeNoTuning = true,
  includeDirectionalTunings = true
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
  const failedStates = new Set<string>();

  function find(index: number, remaining: Tuning): (number | null)[] | null {
    if (index === improvements.length) {
      return remaining.every((value) => value === 0) ? [] : null;
    }

    const stateKey = `${index}:${remaining.join(",")}`;
    if (failedStates.has(stateKey)) return null;
    const options = improvements[index]
      ? tuningOptions(improvements[index]!)
      : [[0, 0, 0, 0, 0, 0]];
    for (const option of options) {
      const next = remaining.map((value, stat) => value - option[stat]) as Tuning;
      const rest = find(index + 1, next);
      if (rest !== null) {
        const hash = tuningOptionHash(option);
        return [hash, ...rest];
      }
    }
    failedStates.add(stateKey);
    return null;
  }

  const assignment = find(0, [...target] as Tuning);
  return assignment?.filter((hash): hash is number => hash !== null) ?? null;
}

export function extendTuningAcc(
  accumulated: Map<number, Tuning>,
  improvement: t5Improvement,
  includeNoTuning = true,
  includeDirectionalTunings = true
): Map<number, Tuning> {
  const next = new Map<number, Tuning>();
  for (const current of accumulated.values()) {
    for (const option of tuningOptions(improvement, includeNoTuning, includeDirectionalTunings)) {
      const combined = [
        current[0] + option[0],
        current[1] + option[1],
        current[2] + option[2],
        current[3] + option[3],
        current[4] + option[4],
        current[5] + option[5],
      ] as Tuning;
      const key = packTuningKey(combined);
      if (!next.has(key)) next.set(key, combined);
    }
  }
  return next;
}

export function buildTuningAcc(
  possibleImprovements: t5Improvement[],
  includeNoTuning = true,
  includeDirectionalTunings = true
): Map<number, Tuning> {
  let accumulated = new Map<number, Tuning>();
  const zero = [0, 0, 0, 0, 0, 0] as Tuning;
  accumulated.set(packTuningKey(zero), zero);

  for (const improvement of possibleImprovements) {
    accumulated = extendTuningAcc(
      accumulated,
      improvement,
      includeNoTuning,
      includeDirectionalTunings
    );
  }

  return accumulated;
}

export function generate_tunings(
  possibleImprovements: t5Improvement[],
  includeNoTuning = true,
  includeDirectionalTunings = true
): Tuning[] {
  // Incremental deduped Minkowski sum. Deduping after each piece preserves first-seen ordering but
  // avoids materializing the much larger full Cartesian product before deduplicating its leaves.
  const accumulated = buildTuningAcc(
    possibleImprovements,
    includeNoTuning,
    includeDirectionalTunings
  );

  return Array.from(accumulated.values());
}

export function filterTuningsForLockedStats(
  tunings: Tuning[],
  stats: number[],
  fixed: boolean[],
  targets: number[]
): Tuning[] {
  if (!fixed.some(Boolean)) return tunings;
  return tunings.filter((tuning) => {
    for (let stat = 0; stat < 6; stat++) {
      if (fixed[stat] && tuning[stat] > targets[stat] - stats[stat]) return false;
    }
    return true;
  });
}

export function filterTuningsBySharedBudget(
  tunings: Tuning[],
  stats: number[],
  targets: number[],
  sharedBudget: number
): Tuning[] {
  if (!targets.some((target) => target > 0)) return tunings;
  return tunings.filter((tuning) => {
    let totalGap = 0;
    for (let stat = 0; stat < 6; stat++) {
      if (targets[stat] <= 0) continue;
      const gap = Math.max(0, targets[stat] - stats[stat] - tuning[stat]);
      if (gap > sharedBudget) return false;
      totalGap += gap;
    }
    return totalGap <= sharedBudget;
  });
}

export function prioritizeTuningsByTotalStats(tunings: Tuning[]): Tuning[] {
  return tunings.sort(
    (left, right) =>
      right.reduce((sum, value) => sum + value, 0) - left.reduce((sum, value) => sum + value, 0)
  );
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

function pieceArtificeCapable(piece: IPermutatorArmor, config: BuildConfiguration): boolean {
  if (piece.perk === ArmorPerkOrSlot.SlotArtifice) return true;
  if (piece.armorSystem !== ArmorSystem.Armor2) return false;
  if (piece.slot === ArmorSlot.ArmorSlotClass && config.assumeClassItemIsArtifice) return true;
  return piece.isExotic
    ? config.assumeEveryExoticIsArtifice
    : config.assumeEveryLegendaryIsArtifice;
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
    const artificeBonus = pieceArtificeCapable(piece, config) ? 3 : 0;
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

  let availableTunings: Tuning[] = [[0, 0, 0, 0, 0, 0]];
  if (t5Count > 0) {
    const includeNoTuning = targetFixed.some(Boolean);
    if (exactNoTargetMaximum) {
      availableTunings = [combineBalancedTunings(t5Improvements)];
    } else if (calculateTierFiveTuning) {
      if (tuningBaseCache && tuningVariableItem) {
        if (tuningBaseCache.accumulator === null) {
          const baseImprovements = tuningBaseCache.items
            .filter(isT5WithTuning)
            .map(mapItemToTuning);
          tuningBaseCache.accumulator = buildTuningAcc(baseImprovements, includeNoTuning);
        }
        const tuningAccumulator = isT5WithTuning(tuningVariableItem)
          ? extendTuningAcc(
              tuningBaseCache.accumulator,
              mapItemToTuning(tuningVariableItem),
              includeNoTuning
            )
          : tuningBaseCache.accumulator;
        availableTunings = Array.from(tuningAccumulator.values());
      } else {
        availableTunings = generate_tunings(t5Improvements, includeNoTuning);
      }
    } else {
      availableTunings = generate_tunings(t5Improvements, includeNoTuning, false);
    }
  }
  availableTunings = filterTuningsForLockedStats(availableTunings, stats, targetFixed, targetVals);
  availableTunings = filterTuningsBySharedBudget(
    availableTunings,
    stats,
    targetVals,
    possibleIncreaseByMod + 3 * artificeCount
  );
  if (availableTunings.length === 0) return null;
  prioritizeTuningsByTotalStats(availableTunings);

  // heavy work: mod precalc
  let result: StatModifierPrecalc | null;
  if (distanceSum === 0 && totalOptionalDistances === 0) {
    result = {
      mods: [],
      tuning: availableTunings[0],
      modBonus: [0, 0, 0, 0, 0, 0],
    };
  } else {
    result = get_mods_precalc(stats, distances, optionalDistances, artificeCount, availableTunings);
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
    performTierAvailabilityTesting(
      stats,
      distances,
      artificeCount,
      availableTunings,
      !targetFixed.some((fixed) => fixed) &&
        !tryLimitWastedStats &&
        !onlyShowResultsWithNoWastedStats
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

function getStatVal(statId: ArmorStat, mods: StatModifierPrecalc, start: number) {
  return start + mods.tuning[statId] + mods.modBonus[statId];
}

// region Tier Availability Testing
function performTierAvailabilityTesting(
  stats: number[],
  distances: number[],
  availableArtificeCount: number,
  availableTunings: Tuning[],
  useParetoFront: boolean
): void {
  let feasibilityTuningsCache: Tuning[] | null = null;
  const feasibilityTunings = () => {
    if (feasibilityTuningsCache === null) {
      // For pure lower-bound queries, a componentwise-dominated tuning can never be more feasible
      // than its dominator. Fixed-stat and waste modes retain the complete tuning set.
      feasibilityTuningsCache = useParetoFront
        ? paretoFrontTunings(availableTunings)
        : availableTunings;
    }
    return feasibilityTuningsCache;
  };

  for (let stat = 0; stat < 6; stat++) {
    let minimumTuning = 0;
    for (const tuning of availableTunings) {
      if (tuning[stat] < minimumTuning) minimumTuning = tuning[stat];
    }
    const minStat = stats[stat];

    // Sorting is only consumed by get_mods_precalc. Build it lazily because a saturated stat often
    // exits without probing, avoiding six full tuning sorts for most later permutations.
    let sortedTuningsCache: Tuning[] | null = null;
    const sortedTunings = () => {
      if (sortedTuningsCache === null) {
        sortedTuningsCache = feasibilityTunings()
          .slice()
          .sort((a, b) => {
            const aVal = a[stat];
            const bVal = b[stat];
            const aNeg = aVal < 0;
            const bNeg = bVal < 0;
            if (aNeg && bNeg) return bVal - aVal;
            if (!aNeg && !bNeg) return aVal - bVal;
            return aNeg ? 1 : -1;
          });
      }
      return sortedTuningsCache;
    };

    const naturalFloor = Math.min(200, stats[stat] + minimumTuning);
    if (runtime.maximumPossibleTiers[stat] < naturalFloor) {
      runtime.maximumPossibleTiers[stat] = naturalFloor;
    }
    //const tuningsWithoutNegatives = tmpTunings.filter((t) => t[stat] >= 0);

    if (minStat >= 200) continue; // Already at max value, no need to test

    const minTier = minimumStatTierValues[stat] * 10;

    // Binary search to find maximum possible value
    let low = Math.max(runtime.maximumPossibleTiers[stat], minTier);
    let high = 200;

    while (low <= high) {
      // Try middle value, rounded to nearest 10 for tier optimization
      const mid = Math.min(200, Math.ceil((low + high) / 2));

      if (minStat >= mid && minimumTuning == 0) {
        // We can already reach this value naturally
        low = mid + 1;
        continue;
      }

      // Calculate distance needed to reach this value
      const testDistances = [...distances];
      testDistances[stat] = Math.max(0, mid - minStat);

      // Check if this value is achievable with mods
      const mods = get_mods_precalc(
        stats,
        testDistances,
        [0, 0, 0, 0, 0, 0],
        availableArtificeCount,
        sortedTunings()
      );

      if (mods != null) {
        let val = Math.min(200, getStatVal(stat, mods, minStat));
        runtime.maximumPossibleTiers[stat] = Math.max(val, runtime.maximumPossibleTiers[stat]);
        low = Math.max(runtime.maximumPossibleTiers[stat], mid) + 1;
      } else {
        // This value is not achievable, try lower
        high = mid - 1;
      }
    }

    // Verify the final value
    if (low > runtime.maximumPossibleTiers[stat] && low <= 200) {
      const testDistances = [...distances];
      testDistances[stat] = Math.max(low - minStat, 0);
      const mods = get_mods_precalc(
        stats,
        testDistances,
        [0, 0, 0, 0, 0, 0],
        availableArtificeCount,
        sortedTunings()
      );
      if (mods != null) {
        runtime.maximumPossibleTiers[stat] = low;
        // also set the other stats
        // This may reduce the amount of required calculations for the stats that will be checked later on
        for (let otherStat = stat + 1; otherStat < 6; otherStat++) {
          runtime.maximumPossibleTiers[otherStat] = Math.max(
            Math.min(200, getStatVal(otherStat, mods, stats[otherStat])),
            runtime.maximumPossibleTiers[otherStat]
          );
        }
      }
    }
  }
}

// region Mod Calculation Functions
const ZERO_MOD_LIST: number[][] = [[0, 0, 0, 0, 0, 0]];
const ZERO_TUNING_MAX = [0, 0, 0, 0, 0, 0];

// Pareto-maximal tuning vectors. Sorting by total descending means a vector can only be dominated
// by an already-kept vector, keeping the filter small while preserving lower-bound feasibility.
function paretoFrontTunings(tunings: Tuning[]): Tuning[] {
  if (tunings.length <= 1) return tunings;

  const sorted = tunings
    .map((tuning, index) => ({
      tuning,
      index,
      sum: tuning[0] + tuning[1] + tuning[2] + tuning[3] + tuning[4] + tuning[5],
    }))
    .sort((a, b) => b.sum - a.sum || a.index - b.index);
  const kept: Tuning[] = [];

  for (const candidate of sorted) {
    const dominated = kept.some(
      (existing) =>
        existing[0] >= candidate.tuning[0] &&
        existing[1] >= candidate.tuning[1] &&
        existing[2] >= candidate.tuning[2] &&
        existing[3] >= candidate.tuning[3] &&
        existing[4] >= candidate.tuning[4] &&
        existing[5] >= candidate.tuning[5]
    );
    if (!dominated) kept.push(candidate.tuning);
  }

  return kept;
}

export function canCoverRemainingDistance(
  distances: number[],
  statIndex: number,
  tuningMax: number[],
  availableArtificeCount: number,
  availableMajorMods: number,
  availableMods: number
): boolean {
  let remainingDistance = 0;
  let optimisticTuning = 0;
  for (let stat = statIndex; stat < 6; stat++) {
    remainingDistance += distances[stat];
    optimisticTuning += Math.max(0, tuningMax[stat]);
  }
  const majorMods = Math.min(availableMajorMods, availableMods);
  const regularModPoints = 10 * majorMods + 5 * (availableMods - majorMods);
  const maximumRemainingPoints = regularModPoints + 3 * availableArtificeCount + optimisticTuning;
  return remainingDistance <= maximumRemainingPoints;
}

function get_mods_recursive(
  currentStats: number[],
  targetStats: number[],

  distances_to_check: number[],
  availableTunings: Tuning[],
  statIdx: number,
  availableArtificeCount: number,
  availableMajorMods: number,
  availableMods: number,
  // Per-stat maxima for the current tuning subset. Carrying this through recursion avoids reducing
  // the entire tuning list at every node; it is recomputed only when the subset is filtered.
  tuningMax: number[]
): number[][] | null {
  if (
    !canCoverRemainingDistance(
      distances_to_check,
      statIdx,
      tuningMax,
      availableArtificeCount,
      availableMajorMods,
      availableMods
    )
  ) {
    return null;
  }

  if (statIdx > 5) {
    // Now we have a valid set of mods and tunings, but we still have to check -5 values. This will happen in innermost loop
    // statIdx is no longer useful here

    // 1. If there is any tuning with no negative in any value, then return []
    // if (availableTunings.some(tuning => tuning.every(v => v >= 0))) {
    // return [];
    // }

    // Now there are only tunings with negative values left.
    // 2.1 If there is any stat where (currentStat - tuningValue) >= target value, then return
    const validTuning = availableTunings.find((tuning) => {
      for (let i = 0; i < 6; i++) {
        if (tuning[i] >= 0) continue;
        if (currentStats[i] + tuning[i] < targetStats[i]) return false;
      }
      return true;
    });
    if (validTuning) {
      return [validTuning];
    }

    // 2.2 if we still have a few mods left, we can simply call the recursion again, but with the new "temp" stats
    if (availableMods > 0) {
      for (let tuning of availableTunings) {
        const newStats = currentStats.map((s, i) => s + tuning[i]);
        const newDists = distances_to_check.map((d, i) =>
          Math.max(0, targetStats[i] - newStats[i])
        );
        const otherMods = get_mods_recursive(
          newStats,
          targetStats,
          newDists,
          [],
          0,
          availableArtificeCount,
          availableMajorMods,
          availableMods,
          ZERO_TUNING_MAX
        );
        if (otherMods !== null) {
          return [...otherMods, tuning];
        }
      }
    }

    return null;
  }

  const maxValueOfAvailableTunings = tuningMax[statIdx];

  const distance = distances_to_check[statIdx];

  //let precalculatedMods = precalculatedModCombinations[distance] || [[0, 0, 0, 0, 0, 0]];
  const precalculatedMods = precalculatedTuningModCombinations[distance] || ZERO_MOD_LIST;

  for (const pickedMod of precalculatedMods) {
    if (
      pickedMod[0] > availableArtificeCount ||
      pickedMod[2] > availableMajorMods ||
      pickedMod[2] + pickedMod[1] > availableMods ||
      pickedMod[3] > maxValueOfAvailableTunings
    ) {
      continue;
    }

    const totalMods = Math.max(0, availableMods - pickedMod[1] - pickedMod[2]);
    const majorMods = Math.min(totalMods, Math.max(0, availableMajorMods - pickedMod[2]));
    const artifice = Math.max(0, availableArtificeCount - pickedMod[0]);

    let selectedTuningsInner = availableTunings;
    let nextTuningMax = tuningMax;
    const requiredTuningCount = pickedMod[4];
    const requiredTuningValue = pickedMod[3];
    if (requiredTuningCount > 0) {
      selectedTuningsInner = [];
      nextTuningMax = [0, 0, 0, 0, 0, 0];
      for (const tuning of availableTunings) {
        if (tuning[statIdx] < requiredTuningValue) continue;
        selectedTuningsInner.push(tuning);
        for (let stat = 0; stat < 6; stat++) {
          if (tuning[stat] > nextTuningMax[stat]) nextTuningMax[stat] = tuning[stat];
        }
      }
      if (selectedTuningsInner.length == 0) {
        continue;
        // return null; // we could also return, if the table is sorted ascending to tuningCount
      }
    }

    const otherMods = get_mods_recursive(
      currentStats,
      targetStats,
      distances_to_check, //.slice(1),
      selectedTuningsInner,
      statIdx + 1,
      artifice,
      majorMods,
      totalMods,
      nextTuningMax
    );
    if (otherMods !== null) {
      return [pickedMod, ...otherMods];
    }
  }
  return null;
}

type StatModifierPrecalc = {
  mods: StatModifier[];
  modBonus: number[];
  tuning: Tuning;
};

function get_mods_precalc(
  currentStats: number[],
  distances: number[],
  optionalDistances: number[],
  availableArtificeCount: number,
  availableTunings: Tuning[]
): StatModifierPrecalc | null {
  const totalDistance =
    distances[0] + distances[1] + distances[2] + distances[3] + distances[4] + distances[5];

  if (totalDistance == 0 && optionalDistances.every((d) => d == 0)) {
    // no mods needed, return empty array
    return { mods: [], tuning: [0, 0, 0, 0, 0, 0], modBonus: [0, 0, 0, 0, 0, 0] };
  }

  const tuningMax = [0, 0, 0, 0, 0, 0];
  for (const tuning of availableTunings) {
    for (let stat = 0; stat < 6; stat++) {
      if (tuning[stat] > tuningMax[stat]) tuningMax[stat] = tuning[stat];
    }
  }
  if (
    !canCoverRemainingDistance(
      distances,
      0,
      tuningMax,
      availableArtificeCount,
      maxMajorMods,
      maxMods
    )
  ) {
    return null;
  }

  let pickedMods = get_mods_recursive(
    currentStats,
    targetVals,
    distances,
    availableTunings,
    0,
    availableArtificeCount,
    maxMajorMods,
    maxMods,
    tuningMax
  );

  if (pickedMods === null) return null;

  const usedMods = [];
  const modBonus = [0, 0, 0, 0, 0, 0];
  // The last entry is always the tuning
  for (let i = 0; i < pickedMods.length - 1; i++) {
    for (let n = 0; n < pickedMods[i][1]; n++) {
      usedMods.push(STAT_MODIFIERS[i][0]);
      modBonus[i] += 5;
    }
    for (let n = 0; n < pickedMods[i][2]; n++) {
      usedMods.push(STAT_MODIFIERS[i][1]);
      modBonus[i] += 10;
    }
    for (let n = 0; n < pickedMods[i][0]; n++) {
      usedMods.push(STAT_MODIFIERS[i][2]);
      modBonus[i] += 3;
    }
  }

  return {
    mods: usedMods,
    modBonus: modBonus,
    tuning: pickedMods[pickedMods.length - 1] as Tuning,
  };
}

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
