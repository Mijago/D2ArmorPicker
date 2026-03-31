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
import { BuildConfiguration, FixableSelection } from "../data/buildConfiguration";
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

type t5Improvement = {
  tuningStat: ArmorStat;
  archetypeStats: ArmorStat[];
};

function isT5WithTuning(i: IPermutatorArmor): boolean {
  return (
    i.armorSystem == ArmorSystem.Armor3 &&
    i.tier >= 5 &&
    i.archetypeStats &&
    i.tuningStat !== undefined
  );
}

function mapItemToTuning(i: IPermutatorArmor): t5Improvement {
  return {
    tuningStat: i.tuningStat!,
    archetypeStats: i.archetypeStats,
  };
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
    if (item.gearSetHash != null)
      requirements.set(item.gearSetHash, (requirements.get(item.gearSetHash) ?? 0) - 1);
  }

  let SlotRequirements = 0;
  for (let [key] of requirements) {
    if (key == ArmorPerkOrSlot.Any || key == ArmorPerkOrSlot.None) continue;
    SlotRequirements += Math.max(0, requirements.get(key) ?? 0);
  }

  return SlotRequirements === 0;
}

function computeEnabledModBonuses(config: BuildConfiguration) {
  const enabledModBonuses = [0, 0, 0, 0, 0, 0];
  // Apply configurated mods to the stat value
  // Apply mods
  for (const mod of config.enabledMods) {
    for (const bonus of ModInformation[mod].bonus) {
      var statId =
        bonus.stat == SpecialArmorStat.ClassAbilityRegenerationStat
          ? [1, 0, 2][config.characterClass]
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
) {
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

    for (const helmet of exoticHelmets)
      for (const gauntlet of legendaryGauntlets)
        for (const chest of legendaryChests)
          for (const leg of legendaryLegs)
            for (const classItem of legendaryClassItems)
              yield [helmet, gauntlet, chest, leg, classItem] as const;

    for (const helmet of legendaryHelmets)
      for (const gauntlet of exoticGauntlets)
        for (const chest of legendaryChests)
          for (const leg of legendaryLegs)
            for (const classItem of legendaryClassItems)
              yield [helmet, gauntlet, chest, leg, classItem] as const;

    for (const helmet of legendaryHelmets)
      for (const gauntlet of legendaryGauntlets)
        for (const chest of exoticChests)
          for (const leg of legendaryLegs)
            for (const classItem of legendaryClassItems)
              yield [helmet, gauntlet, chest, leg, classItem] as const;

    for (const helmet of legendaryHelmets)
      for (const gauntlet of legendaryGauntlets)
        for (const chest of legendaryChests)
          for (const leg of exoticLegs)
            for (const classItem of legendaryClassItems)
              yield [helmet, gauntlet, chest, leg, classItem] as const;

    for (const helmet of legendaryHelmets)
      for (const gauntlet of legendaryGauntlets)
        for (const chest of legendaryChests)
          for (const leg of legendaryLegs)
            for (const classItem of exoticClassItems)
              yield [helmet, gauntlet, chest, leg, classItem] as const;
  }

  // Yield all-legendary combinations
  if (yieldAllLegendary) {
    for (const helmet of legendaryHelmets)
      for (const gauntlet of legendaryGauntlets)
        for (const chest of legendaryChests)
          for (const leg of legendaryLegs)
            for (const classItem of legendaryClassItems)
              yield [helmet, gauntlet, chest, leg, classItem] as const;
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
// endregion Validation and Preparation Functions

// region Main Worker Event Handler
async function handleArmorBuilderRequest(data: any): Promise<void> {
  // Reset cancellation flag at the beginning of each run
  cancelRequested = false;

  const threadSplit = data.threadSplit as { count: number; current: number };
  const config = data.config as BuildConfiguration;
  const anyStatFixed = Object.values(config.minimumStatTiers).some(
    (v: FixableSelection<number>) => v.fixed
  );
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

  let helmets = items
    .filter((i) => i.slot == ArmorSlot.ArmorSlotHelmet)
    .filter((k) => {
      return (
        !config.useFotlArmor ||
        [
          199733460, // titan masq
          2545426109, // warlock
          3224066584, // hunter
          2390807586, // titan new fotl
          2462335932, // hunter new fotl
          4095816113, // warlock new fotl
        ].indexOf(k.hash) > -1
      );
    });
  let gauntlets = items.filter((i) => i.slot == ArmorSlot.ArmorSlotGauntlet);
  let chests = items.filter((i) => i.slot == ArmorSlot.ArmorSlotChest);
  let legs = items.filter((i) => i.slot == ArmorSlot.ArmorSlotLegs);
  let classItems = items.filter((i) => i.slot == ArmorSlot.ArmorSlotClass);

  // Sort by Masterwork, descending
  classItems = classItems.sort(
    (a, b) => (b.tier ?? 0) - (a.tier ?? 0) || (b.masterworkLevel ?? 0) - (a.masterworkLevel ?? 0)
  );

  // Filter exotic class items based on selected exotic perks if they are not "Any"
  if (config.selectedExoticPerks && config.selectedExoticPerks.length >= 2) {
    const firstPerkFilter = config.selectedExoticPerks[0];
    const secondPerkFilter = config.selectedExoticPerks[1];

    if (firstPerkFilter !== ArmorPerkOrSlot.Any || secondPerkFilter !== ArmorPerkOrSlot.Any) {
      classItems = classItems.filter((item) => {
        if (!item.isExotic || !item.exoticPerkHash || item.exoticPerkHash.length < 2) {
          return true; // Keep non-exotic items or items without proper perk data
        }

        const hasFirstPerk =
          firstPerkFilter === ArmorPerkOrSlot.Any || item.exoticPerkHash.includes(firstPerkFilter);
        const hasSecondPerk =
          secondPerkFilter === ArmorPerkOrSlot.Any ||
          item.exoticPerkHash.includes(secondPerkFilter);

        return hasFirstPerk && hasSecondPerk;
      });
    }
  }

  if (
    config.assumeEveryLegendaryIsArtifice ||
    config.assumeEveryExoticIsArtifice ||
    config.assumeClassItemIsArtifice
  ) {
    classItems = classItems.map((item) => {
      if (
        item.armorSystem == ArmorSystem.Armor2 &&
        ((config.assumeEveryLegendaryIsArtifice && !item.isExotic) ||
          (config.assumeEveryExoticIsArtifice && item.isExotic) ||
          (config.assumeClassItemIsArtifice && !item.isExotic))
      ) {
        return { ...item, perk: ArmorPerkOrSlot.SlotArtifice };
      }
      return item;
    });
  }

  // true if any armorPerks is not "any"
  const doesNotRequireArmorPerks = config.armorRequirements.length == 0;

  classItems = classItems.filter(
    (item, index, self) =>
      index ===
      self.findIndex(
        (i) =>
          i.mobility === item.mobility &&
          i.resilience === item.resilience &&
          i.recovery === item.recovery &&
          i.discipline === item.discipline &&
          i.intellect === item.intellect &&
          i.strength === item.strength &&
          i.isExotic === item.isExotic &&
          //i.tier >= (item.tier ?? 0) &&
          ((i.tier < 5 && item.tier < 5) || i.tuningStat == item.tuningStat) &&
          ((i.isExotic && config.assumeExoticsMasterworked) ||
            (!i.isExotic && config.assumeLegendariesMasterworked) ||
            // If there is any stat fixed, we check if the masterwork level is the same as the first item
            (anyStatFixed && i.masterworkLevel === item.masterworkLevel) ||
            // If there is no stat fixed, then we just use the masterwork level of the first item.
            // As it is already sorted descending, we can just check if the masterwork level is the same
            !anyStatFixed) &&
          (doesNotRequireArmorPerks || (i.perk === item.perk && i.gearSetHash === item.gearSetHash))
      )
  );
  //*/

  // Support multithreading. Find the largest set and split it by N, ensuring even exotic distribution.
  if (threadSplit.count > 1) {
    // Find the largest slot array
    const slotArrays: [IPermutatorArmor[], number, string][] = [
      [helmets, helmets.length, "helmets"],
      [gauntlets, gauntlets.length, "gauntlets"],
      [chests, chests.length, "chests"],
      [legs, legs.length, "legs"],
      [classItems, classItems.length, "class"],
    ];
    slotArrays.sort((a, b) => b[1] - a[1]);
    const splitEntry = slotArrays[0][0];
    const splitEntryName = slotArrays[0][2];

    // Separate exotics and non-exotics
    const exotics = splitEntry.filter((i) => i.isExotic);
    const nonExotics = splitEntry.filter((i) => !i.isExotic);

    // Deterministically sort both groups (by hash, then by masterworkLevel, then by name if available)
    const stableSort = (arr: IPermutatorArmor[]) =>
      arr.slice().sort((a, b) => {
        if (a.hash !== b.hash) return a.hash - b.hash;
        if ((a.masterworkLevel ?? 0) !== (b.masterworkLevel ?? 0))
          return (a.masterworkLevel ?? 0) - (b.masterworkLevel ?? 0);
        return 0;
      });
    const sortedExotics = stableSort(exotics);
    const sortedNonExotics = stableSort(nonExotics);

    // Helper to split an array into N nearly equal, deterministic batches
    function splitIntoBatches<T>(arr: T[], batchCount: number): T[][] {
      const batches: T[][] = Array.from({ length: batchCount }, () => []);
      for (let i = 0; i < arr.length; ++i) {
        // Distribute round-robin for determinism
        batches[i % batchCount].push(arr[i]);
      }
      return batches;
    }

    const exoticBatches = splitIntoBatches(sortedExotics, threadSplit.count);
    const nonExoticBatches = splitIntoBatches(sortedNonExotics, threadSplit.count);

    // For this thread, combine the corresponding exotic and non-exotic batch
    const batch = [...exoticBatches[threadSplit.current], ...nonExoticBatches[threadSplit.current]];

    // Replace the original slot array with the batch for this thread
    switch (splitEntryName) {
      case "helmets":
        helmets = batch;
        break;
      case "gauntlets":
        gauntlets = batch;
        break;
      case "chests":
        chests = batch;
        break;
      case "legs":
        legs = batch;
        break;
      case "class":
        classItems = batch;
        break;
    }
  }

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

  let estimatedCalculations = estimateCombinationsToBeChecked(
    helmets,
    gauntlets,
    chests,
    legs,
    classItems,
    yieldExoticCombinations,
    yieldAllLegendary
  );

  let checkedCalculations = 0;
  let lastProgressReportTime = 0;

  // define the delay; it can be 75ms if the estimated calculations are low
  // if the estimated calculations >= 1e6, then we will use 125ms
  let progressBarDelay = estimatedCalculations >= 1e6 ? 125 : 75;

  resultLimitReached = false;

  for (let [helmet, gauntlet, chest, leg, classItem] of generateArmorCombinations(
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

    if (resultLimitReached && runtime.maximumPossibleTiers.every((tier) => tier >= 200)) {
      console.log(
        `Thread #${threadSplit.current} reached result limit and maximum possible tiers are all 200, stopping calculation early.`
      );
      break;
    }

    checkedCalculations++;
    if (!checkSlots(helmet, gauntlet, chest, leg, classItem)) continue;

    // Only calculate more permutations if the results limit has not been reached yet and
    const result = handlePermutation(helmet, gauntlet, chest, leg, classItem);
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

        resultLimitReached = config.limitParsedResults && listedResults >= 3e4 / threadSplit.count;
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
    resultLimitReached,
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

function generate_tunings(possibleImprovements: t5Improvement[]): Tuning[] {
  const impValues = possibleImprovements.map((imp) => {
    let l = [[0, 0, 0, 0, 0, 0]];

    let balancedTuning = [0, 0, 0, 0, 0, 0];
    for (let n = 0; n < 6; n++) {
      if (!imp.archetypeStats.includes(n)) balancedTuning[n] = 1;

      if (n == imp.tuningStat) continue;
      let p = [0, 0, 0, 0, 0, 0];
      p[imp.tuningStat] = 5;
      p[n] = -5;
      l.push(p);
    }
    l.push(balancedTuning);

    return l;
  });
  const tunings: Tuning[] = [];

  const seen = new Set<string>();

  function addUniqueTuning(tuning: Tuning) {
    const key = tuning.join(",");
    if (!seen.has(key)) {
      tunings.push(tuning as Tuning);
      seen.add(key);
    }
  }

  if (impValues.length === 0) {
    addUniqueTuning([0, 0, 0, 0, 0, 0]);
  } else {
    function recurse(idx: number, acc: number[]) {
      if (idx === impValues.length) {
        addUniqueTuning(acc as Tuning);
        return;
      }
      for (const v of impValues[idx]) {
        const next = [
          acc[0] + v[0],
          acc[1] + v[1],
          acc[2] + v[2],
          acc[3] + v[3],
          acc[4] + v[4],
          acc[5] + v[5],
        ];
        recurse(idx + 1, next);
      }
    }
    recurse(0, [0, 0, 0, 0, 0, 0]);
  }

  return tunings;
}

export function handlePermutation(
  helmet: IPermutatorArmor,
  gauntlet: IPermutatorArmor,
  chest: IPermutatorArmor,
  leg: IPermutatorArmor,
  classItem: IPermutatorArmor
): IPermutatorArmorSet | null {
  // Inline stat summation (without mod bonuses)
  const b0 = enabledModBonuses[0],
    b1 = enabledModBonuses[1],
    b2 = enabledModBonuses[2],
    b3 = enabledModBonuses[3],
    b4 = enabledModBonuses[4],
    b5 = enabledModBonuses[5];

  const statsWithoutMods: number[] = [
    helmet.mobility + gauntlet.mobility + chest.mobility + leg.mobility + classItem.mobility,
    helmet.resilience +
      gauntlet.resilience +
      chest.resilience +
      leg.resilience +
      classItem.resilience +
      (!chest.isExotic && addConstent1Health ? 1 : 0),
    helmet.recovery + gauntlet.recovery + chest.recovery + leg.recovery + classItem.recovery,
    helmet.discipline +
      gauntlet.discipline +
      chest.discipline +
      leg.discipline +
      classItem.discipline,
    helmet.intellect + gauntlet.intellect + chest.intellect + leg.intellect + classItem.intellect,
    helmet.strength + gauntlet.strength + chest.strength + leg.strength + classItem.strength,
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

  // Early abort: fixed tiers exceeded
  for (let n = 0; n < 6; n++) {
    if (targetFixed[n] && stats[n] > targetVals[n]) return null;
  }

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
    // Even with max T5 tuning (5 per item * 5 items = 25), still too far?
    // This is a conservative pre-check; the full check follows after T5 computation.
    if (!calculateTierFiveTuning || distanceSum > 50 + 3 * artificeCount + 25) {
      return null;
    }
  }

  // T5 tuning improvements (without items array, with direct index comparisons)
  let t5Count = 0;
  const t5Improvements: t5Improvement[] = [];
  const tuningMax: number[] = [0, 0, 0, 0, 0, 0];

  if (calculateTierFiveTuning) {
    if (isT5WithTuning(helmet)) t5Improvements.push(mapItemToTuning(helmet));
    if (isT5WithTuning(gauntlet)) t5Improvements.push(mapItemToTuning(gauntlet));
    if (isT5WithTuning(chest)) t5Improvements.push(mapItemToTuning(chest));
    if (isT5WithTuning(leg)) t5Improvements.push(mapItemToTuning(leg));
    if (isT5WithTuning(classItem)) t5Improvements.push(mapItemToTuning(classItem));
    t5Count = t5Improvements.length;

    for (const t5 of t5Improvements) {
      const arch = t5.archetypeStats;
      const a0 = arch[0],
        a1 = arch[1],
        a2 = arch[2];
      // Compute balanced values inline (1 if stat NOT in archetypeStats)
      const bal0 = a0 !== 0 && a1 !== 0 && a2 !== 0 ? 1 : 0;
      const bal1 = a0 !== 1 && a1 !== 1 && a2 !== 1 ? 1 : 0;
      const bal2 = a0 !== 2 && a1 !== 2 && a2 !== 2 ? 1 : 0;
      const bal3 = a0 !== 3 && a1 !== 3 && a2 !== 3 ? 1 : 0;
      const bal4 = a0 !== 4 && a1 !== 4 && a2 !== 4 ? 1 : 0;
      const bal5 = a0 !== 5 && a1 !== 5 && a2 !== 5 ? 1 : 0;
      const bal = [bal0, bal1, bal2, bal3, bal4, bal5];

      for (let n = 0; n < 6; n++) {
        if (n === t5.tuningStat) continue;
        // p[tuningStat]=5, p[n]=-5, rest=0 → accumulate max(balanced[i], p[i])
        for (let i = 0; i < 6; i++) {
          const pVal = i === t5.tuningStat ? 5 : i === n ? -5 : 0;
          tuningMax[i] += Math.max(bal[i], pVal);
        }
      }
    }
  }

  // Full global bound check with T5
  if (distanceSum > 50 + 3 * artificeCount + 5 * t5Count) {
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
  if (calculateTierFiveTuning) {
    availableTunings = generate_tunings(t5Improvements);
  }

  // heavy work: mod precalc
  let result: StatModifierPrecalc | null;
  if (distanceSum === 0 && totalOptionalDistances === 0) {
    result = { mods: [], tuning: [0, 0, 0, 0, 0, 0], modBonus: [0, 0, 0, 0, 0, 0] };
  } else {
    result = get_mods_precalc(stats, distances, optionalDistances, artificeCount, availableTunings);
  }

  if (result === null) return null;

  performTierAvailabilityTesting(stats, distances, artificeCount, availableTunings);

  const usedArtifice = result.mods.filter((d: StatModifier) => 0 == d % 3);
  const usedMods = result.mods.filter((d: StatModifier) => 0 != d % 3);

  // Apply mods to stats for final calculation
  const finalStats = [...stats];
  for (let statModifier of result.mods) {
    const stat = Math.floor((statModifier - 1) / 3);
    finalStats[stat] += STAT_MOD_VALUES[statModifier][1];
  }

  for (let n = 0; n < 6; n++) finalStats[n] += result.tuning[n];

  const waste1 = getWaste(finalStats);
  if (onlyShowResultsWithNoWastedStats && waste1 > 0) return null;

  return createArmorSet(
    helmet,
    gauntlet,
    chest,
    leg,
    classItem,
    usedArtifice,
    usedMods,
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
  availableTunings: Tuning[]
): void {
  for (let stat = 0; stat < 6; stat++) {
    const minimumTuning = availableTunings.map((t) => t[stat]).reduce((a, b) => Math.min(a, b), 0);
    const minStat = stats[stat];

    const tmpTunings = availableTunings.slice().sort((a, b) => {
      const aVal = a[stat];
      const bVal = b[stat];
      const aNeg = aVal < 0;
      const bNeg = bVal < 0;
      if (aNeg && bNeg) {
        // Both negative: sort descending
        return bVal - aVal;
      } else if (!aNeg && !bNeg) {
        // Both zero or positive: sort ascending
        return aVal - bVal;
      } else {
        // Zero/positive first, then negative
        return aNeg ? 1 : -1;
      }
    });

    if (runtime.maximumPossibleTiers[stat] < stats[stat] + minimumTuning) {
      runtime.maximumPossibleTiers[stat] = stats[stat] + minimumTuning;
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
        tmpTunings
      );

      if (mods != null) {
        let val = getStatVal(stat, mods, minStat);
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
        tmpTunings
      );
      if (mods != null) {
        runtime.maximumPossibleTiers[stat] = low;
        // also set the other stats
        // This may reduce the amount of required calculations for the stats that will be checked later on
        for (let otherStat = stat + 1; otherStat < 6; otherStat++) {
          runtime.maximumPossibleTiers[otherStat] = Math.max(
            getStatVal(otherStat, mods, stats[otherStat]),
            runtime.maximumPossibleTiers[otherStat]
          );
        }
      }
    }
  }
}

// region Mod Calculation Functions
function get_mods_recursive(
  currentStats: number[],
  targetStats: number[],

  distances_to_check: number[],
  availableTunings: Tuning[],
  statIdx: number,
  availableArtificeCount: number,
  availableMajorMods: number,
  availableMods: number
): number[][] | null {
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
          availableMods
        );
        if (otherMods !== null) {
          return [...otherMods, tuning];
        }
      }
    }

    return null;
  }

  const maxValueOfAvailableTunings = availableTunings.reduce(
    (max, tuning) => Math.max(max, tuning[statIdx]),
    0
  );

  const distance = distances_to_check[statIdx];

  //let precalculatedMods = precalculatedModCombinations[distance] || [[0, 0, 0, 0, 0, 0]];
  let precalculatedMods = precalculatedTuningModCombinations[distance] || [[0, 0, 0, 0, 0, 0]];
  precalculatedMods = precalculatedMods.filter(
    (mod) =>
      mod[0] <= availableArtificeCount &&
      mod[2] <= availableMajorMods &&
      mod[2] + mod[1] <= availableMods &&
      mod[3] <= maxValueOfAvailableTunings
  );

  if (precalculatedMods.length == 0) {
    return null;
  }

  for (const pickedMod of precalculatedMods) {
    const totalMods = Math.max(0, availableMods - pickedMod[1] - pickedMod[2]);
    const majorMods = Math.min(totalMods, Math.max(0, availableMajorMods - pickedMod[2]));
    const artifice = Math.max(0, availableArtificeCount - pickedMod[0]);

    let selectedTuningsInner = availableTunings;
    const requiredTuningCount = pickedMod[4];
    const requiredTuningValue = pickedMod[3];
    if (requiredTuningCount > 0) {
      selectedTuningsInner = availableTunings.filter(
        (tuning) => tuning[statIdx] >= requiredTuningValue
      );
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
      totalMods
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
  if (totalDistance > 50 + 25) return null;

  if (totalDistance == 0 && optionalDistances.every((d) => d == 0)) {
    // no mods needed, return empty array
    return { mods: [], tuning: [0, 0, 0, 0, 0, 0], modBonus: [0, 0, 0, 0, 0, 0] };
  }

  let pickedMods = get_mods_recursive(
    currentStats,
    targetVals,
    distances,
    availableTunings,
    0,
    availableArtificeCount,
    maxMajorMods,
    maxMods
  );

  if (pickedMods === null) return null;

  const usedMods = [];
  const modBonus = [0, 0, 0, 0, 0, 0];
  // The last entry is always the tuning
  for (let i = 0; i < pickedMods.length - 1; i++) {
    for (let n = 0; n < pickedMods[i][1]; n++) {
      usedMods.push(1 + 3 * i);
      modBonus[i] += 5;
    }
    for (let n = 0; n < pickedMods[i][2]; n++) {
      usedMods.push(2 + 3 * i);
      modBonus[i] += 10;
    }
    for (let n = 0; n < pickedMods[i][0]; n++) {
      usedMods.push(3 + 3 * i);
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
