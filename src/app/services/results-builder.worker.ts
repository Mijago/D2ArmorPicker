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
import { IDestinyArmor, InventoryArmorSource } from "../data/types/IInventoryArmor";
import { ArmorSlot } from "../data/enum/armor-slot";
import { FORCE_USE_ANY_EXOTIC, MAXIMUM_MASTERWORK_LEVEL } from "../data/constants";
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

import { ModOptimizationStrategy } from "../data/enum/mod-optimization-strategy";
import { IPermutatorArmor } from "../data/types/IPermutatorArmor";
import {
  IPermutatorArmorSet,
  Tuning,
  createArmorSet,
  isIPermutatorArmorSet,
} from "../data/types/IPermutatorArmorSet";
import { ArmorSystem } from "../data/types/IManifestArmor";

import { precalculatedTuningModCombinations } from "../data/generated/precalculatedModCombinationsWithTunings";

// endregion Imports

type t5Improvement = {
  tuningStat: ArmorStat;
  archetypeStats: ArmorStat[];
};

function isT5WithTuning(i: IPermutatorArmor): boolean {
  return (
    i.armorSystem == ArmorSystem.Armor3 &&
    i.tier == 5 &&
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

function sortClassItemsForGaps(
  classItems: IPermutatorArmor[],
  config: BuildConfiguration,
  distances: number[],
  stats: number[]
): IPermutatorArmor[] {
  return [...classItems].sort((a, b) => {
    let scoreA = 0,
      scoreB = 0;

    // Base tier and system bonuses
    if (a.tier == 5) scoreA += 15;
    if (b.tier == 5) scoreB += 15;

    // Armor 3.0 bonus (higher for newer system)
    if (a.armorSystem == ArmorSystem.Armor3) scoreA += 12;
    if (b.armorSystem == ArmorSystem.Armor3) scoreB += 12;

    // Artifice slot bonus
    if (a.perk == ArmorPerkOrSlot.SlotArtifice) scoreA += 10;
    if (b.perk == ArmorPerkOrSlot.SlotArtifice) scoreB += 10;

    // Tuning potential bonus
    if (isT5WithTuning(a)) scoreA += 8;
    if (isT5WithTuning(b)) scoreB += 8;

    // Masterwork potential bonus
    const aMasterworkBonus =
      (a.masterworkLevel ?? 0) +
      (a.isExotic && config.assumeExoticsMasterworked ? 5 : 0) +
      (!a.isExotic && config.assumeLegendariesMasterworked ? 5 : 0);
    const bMasterworkBonus =
      (b.masterworkLevel ?? 0) +
      (b.isExotic && config.assumeExoticsMasterworked ? 5 : 0) +
      (!b.isExotic && config.assumeLegendariesMasterworked ? 5 : 0);
    scoreA += aMasterworkBonus;
    scoreB += bMasterworkBonus;

    // Source preference (inventory first, then vendor/collection)
    if (a.source === InventoryArmorSource.Inventory) scoreA += 5;
    if (b.source === InventoryArmorSource.Inventory) scoreB += 5;

    // Stat contribution scoring with waste consideration
    const aStats = [a.mobility, a.resilience, a.recovery, a.discipline, a.intellect, a.strength];
    const bStats = [b.mobility, b.resilience, b.recovery, b.discipline, b.intellect, b.strength];

    for (let i = 0; i < 6; i++) {
      if (distances[i] > 0) {
        // Direct contribution to gaps
        const aContribution = Math.min(distances[i], aStats[i]);
        const bContribution = Math.min(distances[i], bStats[i]);
        scoreA += aContribution;
        scoreB += bContribution;

        // Bonus for filling large gaps
        if (aContribution >= 5) scoreA += 2;
        if (bContribution >= 5) scoreB += 2;
      } else if (config.tryLimitWastedStats && stats[i] + aStats[i] > 200) {
        // Penalty for creating waste
        scoreA -= Math.max(0, stats[i] + aStats[i] - 200);
      } else if (config.tryLimitWastedStats && stats[i] + bStats[i] > 200) {
        scoreB -= Math.max(0, stats[i] + bStats[i] - 200);
      }
    }

    // Total stat sum bonus (prefer higher total stats)
    const aTotalStats = aStats.reduce((sum, stat) => sum + stat, 0);
    const bTotalStats = bStats.reduce((sum, stat) => sum + stat, 0);
    scoreA += aTotalStats * 0.1; // Small bonus for overall stat power
    scoreB += bTotalStats * 0.1;

    return scoreB - scoreA; // Higher contribution first
  });
}

// region Validation and Preparation Functions
function checkSlots(
  config: BuildConfiguration,
  constantModslotRequirement: Map<number, number>,
  availableClassItemTypes: Set<ArmorPerkOrSlot>,
  helmet: IPermutatorArmor,
  gauntlet: IPermutatorArmor,
  chest: IPermutatorArmor,
  leg: IPermutatorArmor
) {
  let requirements = new Map(constantModslotRequirement);
  const slots = [
    { slot: ArmorSlot.ArmorSlotHelmet, item: helmet },
    { slot: ArmorSlot.ArmorSlotGauntlet, item: gauntlet },
    { slot: ArmorSlot.ArmorSlotChest, item: chest },
    { slot: ArmorSlot.ArmorSlotLegs, item: leg },
  ];

  for (let { item } of slots) {
    if (item.armorSystem === ArmorSystem.Armor2) {
      if (
        (item.isExotic && config.assumeEveryLegendaryIsArtifice) ||
        (!item.isExotic && config.assumeEveryLegendaryIsArtifice) ||
        (!item.isExotic &&
          item.slot == ArmorSlot.ArmorSlotClass &&
          config.assumeClassItemIsArtifice)
      ) {
        requirements.set(
          ArmorPerkOrSlot.SlotArtifice,
          (requirements.get(ArmorPerkOrSlot.SlotArtifice) ?? 0) - 1
        );
        continue;
      }
    }

    requirements.set(item.perk, (requirements.get(item.perk) ?? 0) - 1);
    if (item.gearSetHash != null)
      requirements.set(item.gearSetHash, (requirements.get(item.gearSetHash) ?? 0) - 1);
  }

  let SlotRequirements = 0;
  for (let [key] of requirements) {
    if (key == ArmorPerkOrSlot.Any || key == ArmorPerkOrSlot.None) continue;
    SlotRequirements += Math.max(0, requirements.get(key) ?? 0);
  }

  if (SlotRequirements > 1) return { valid: false };
  if (SlotRequirements == 0) return { valid: true, requiredClassItemType: ArmorPerkOrSlot.Any };

  const requiredClassItemPerk = [...requirements.entries()].find((c) => c[1] > 0)?.[0];
  if (!requiredClassItemPerk) return { valid: false, requiredClassItemType: ArmorPerkOrSlot.Any };
  return {
    valid: availableClassItemTypes.has(requiredClassItemPerk),
    requiredClassItemType: requiredClassItemPerk,
  };
}

function prepareConstantStatBonus(config: BuildConfiguration) {
  const constantBonus = [0, 0, 0, 0, 0, 0];
  // Apply configurated mods to the stat value
  // Apply mods
  for (const mod of config.enabledMods) {
    for (const bonus of ModInformation[mod].bonus) {
      var statId =
        bonus.stat == SpecialArmorStat.ClassAbilityRegenerationStat
          ? [1, 0, 2][config.characterClass]
          : bonus.stat;
      constantBonus[statId] += bonus.value;
    }
  }
  return constantBonus;
}

function prepareConstantModslotRequirement(config: BuildConfiguration) {
  let constantPerkRequirement = new Map<ArmorPerkOrSlot, number>();

  for (let [key] of constantPerkRequirement) {
    constantPerkRequirement.set(key, 0);
  }

  for (const req of config.armorRequirements) {
    if ("perk" in req) {
      let perk = req.perk;

      const e = Object.entries(ArmorPerkSocketHashes).find(([, value]) => value == perk);
      if (e) perk = Number.parseInt(e[0]) as any as ArmorPerkOrSlot;

      if (perk != ArmorPerkOrSlot.Any && perk != ArmorPerkOrSlot.None) {
        constantPerkRequirement.set(perk, (constantPerkRequirement.get(perk) ?? 0) + 1);
      }
    } else if ("gearSetHash" in req) {
      // Gear set requirement
      constantPerkRequirement.set(
        req.gearSetHash,
        (constantPerkRequirement.get(req.gearSetHash) ?? 0) + 1
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
  requiresAtLeastOneExotic: boolean
) {
  for (let helmet of helmets) {
    for (let gauntlet of gauntlets) {
      if (helmet.isExotic && gauntlet.isExotic) continue;
      for (let chest of chests) {
        if ((helmet.isExotic || gauntlet.isExotic) && chest.isExotic) continue;
        for (let leg of legs) {
          if ((helmet.isExotic || gauntlet.isExotic || chest.isExotic) && leg.isExotic) continue;
          if (
            requiresAtLeastOneExotic &&
            !(helmet.isExotic || gauntlet.isExotic || chest.isExotic || leg.isExotic)
          )
            continue;

          yield [helmet, gauntlet, chest, leg];
        }
      }
    }
  }
}

function estimateCombinationsToBeChecked(
  helmets: IPermutatorArmor[],
  gauntlets: IPermutatorArmor[],
  chests: IPermutatorArmor[],
  legs: IPermutatorArmor[]
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
  totalCalculations += exoticHelmets * legendaryGauntlets * legendaryChests * legendaryLegs;
  totalCalculations += legendaryHelmets * exoticGauntlets * legendaryChests * legendaryLegs;
  totalCalculations += legendaryHelmets * legendaryGauntlets * exoticChests * legendaryLegs;
  totalCalculations += legendaryHelmets * legendaryGauntlets * legendaryChests * exoticLegs;
  totalCalculations += legendaryHelmets * legendaryGauntlets * legendaryChests * legendaryLegs;
  return totalCalculations;
}
// endregion Validation and Preparation Functions

// region Main Worker Event Handler
addEventListener("message", async ({ data }) => {
  if (data.type != "builderRequest") return;

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
  console.time(`Total run thread#${threadSplit.current}`);
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
        ].indexOf(k.hash) > -1
      );
    });
  let gauntlets = items.filter((i) => i.slot == ArmorSlot.ArmorSlotGauntlet);
  let chests = items.filter((i) => i.slot == ArmorSlot.ArmorSlotChest);
  let legs = items.filter((i) => i.slot == ArmorSlot.ArmorSlotLegs);
  let classItems = items.filter((i) => i.slot == ArmorSlot.ArmorSlotClass);

  // Sort armor pieces by tuningStat quantity for better deduplication performance
  // This groups armor with identical tuning stats together, improving pruning efficiency
  const sortByTuningStat = (a: IPermutatorArmor, b: IPermutatorArmor) => {
    // First sort by tuningStat (nulls last)
    if (a.tuningStat === null && b.tuningStat !== null) return 1;
    if (a.tuningStat !== null && b.tuningStat === null) return -1;
    if (a.tuningStat !== b.tuningStat) return (a.tuningStat ?? 0) - (b.tuningStat ?? 0);

    // Then by tier (T5 first for tuning optimization)
    if (a.tier !== b.tier) return (b.tier ?? 0) - (a.tier ?? 0);

    // Then by masterwork level
    return (b.masterworkLevel ?? 0) - (a.masterworkLevel ?? 0);
  };

  helmets.sort(sortByTuningStat);
  gauntlets.sort(sortByTuningStat);
  chests.sort(sortByTuningStat);
  legs.sort(sortByTuningStat);

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
          (doesNotRequireArmorPerks || i.perk === item.perk || i.gearSetHash === item.gearSetHash)
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

  const exoticClassItems = classItems.filter((d) => d.isExotic);
  const legendaryClassItems = classItems.filter((d) => !d.isExotic);
  const exoticClassItemIsEnforced = exoticClassItems.some(
    (item) => config.selectedExotics.indexOf(item.hash) > -1
  );
  let availableClassItemPerkTypes = new Set(classItems.map((d) => d.gearSetHash || d.perk));
  // let availableClassItemPerkTypes1 = new Set(classItems.map((d) => d.gearSetHash));

  // runtime variables
  const runtime = {
    maximumPossibleTiers: [0, 0, 0, 0, 0, 0],
  };

  if (classItems.length == 0) {
    console.warn(
      `Thread#${threadSplit.current} - No class items found with the current configuration.`
    );
    postMessage({
      runtime: runtime,
      results: [],
      done: true,
      checkedCalculations: 0,
      estimatedCalculations: 0,
      stats: {
        permutationCount: 0,
        itemCount: items.length - classItems.length,
        totalTime: Date.now() - startTime,
      },
    });
    return;
  } else if (exoticClassItems.length > 0 && legendaryClassItems.length == 0) {
    // If we do not have legendary class items, we can not use any exotic armor in other slots
    helmets = helmets.filter((d) => !d.isExotic);
    gauntlets = gauntlets.filter((d) => !d.isExotic);
    chests = chests.filter((d) => !d.isExotic);
    legs = legs.filter((d) => !d.isExotic);
  }

  const constantBonus = prepareConstantStatBonus(config);
  const constantModslotRequirement = prepareConstantModslotRequirement(config);

  const requiresAtLeastOneExotic = config.selectedExotics.indexOf(FORCE_USE_ANY_EXOTIC) > -1;

  let results: IPermutatorArmorSet[] = [];
  let resultsLength = 0;

  let listedResults = 0;
  let totalResults = 0;
  let doNotOutput = false;

  // contains the value of the total amount of combinations to be checked
  let estimatedCalculations = estimateCombinationsToBeChecked(helmets, gauntlets, chests, legs);
  let checkedCalculations = 0;
  let lastProgressReportTime = 0;
  // define the delay; it can be 75ms if the estimated calculations are low
  // if the estimated calculations >= 1e6, then we will use 125ms
  let progressBarDelay = estimatedCalculations >= 1e6 ? 125 : 75;

  for (let [helmet, gauntlet, chest, leg] of generateArmorCombinations(
    helmets,
    gauntlets,
    chests,
    legs,
    // if exotic class items are enforced, we can not use any other exotic armor piece
    requiresAtLeastOneExotic && !exoticClassItemIsEnforced
  )) {
    checkedCalculations++;
    /**
     *  At this point we already have:
     *  - Masterworked Exotic/Legendaries, if they must be masterworked (config.onlyUseMasterworkedExotics/config.onlyUseMasterworkedLegendaries)
     *  - disabled items were already removed (config.disabledItems)
     */
    const slotCheckResult = checkSlots(
      config,
      constantModslotRequirement,
      availableClassItemPerkTypes,
      helmet,
      gauntlet,
      chest,
      leg
    );
    if (!slotCheckResult.valid) continue;

    const hasOneExotic = helmet.isExotic || gauntlet.isExotic || chest.isExotic || leg.isExotic;
    // TODO This check should be in the generator
    if (hasOneExotic && exoticClassItemIsEnforced) continue;

    let classItemsToUse: IPermutatorArmor[] = classItems;
    if (hasOneExotic) {
      // if we have an exotic armor piece, we can not use the exotic class item
      classItemsToUse = legendaryClassItems;
    } else if (config.selectedExotics[0] == FORCE_USE_ANY_EXOTIC || exoticClassItemIsEnforced) {
      // if we have no exotic armor piece, we can use the exotic class item
      classItemsToUse = exoticClassItems;
    }
    if (slotCheckResult.requiredClassItemType != ArmorPerkOrSlot.Any) {
      classItemsToUse = classItems.filter(
        (item) =>
          item.perk == slotCheckResult.requiredClassItemType ||
          item.gearSetHash == slotCheckResult.requiredClassItemType
      );
    }
    if (classItemsToUse.length == 0) {
      // If we have no class items, we do not need to calculate the permutation
      continue;
    }

    const result = handlePermutation(
      runtime,
      config,
      helmet,
      gauntlet,
      chest,
      leg,
      classItemsToUse,
      constantBonus,
      doNotOutput
    );
    // Only add 50k to the list if the setting is activated.
    // We will still calculate the rest so that we get accurate results for the runtime values
    if (isIPermutatorArmorSet(result)) {
      totalResults++;

      results.push(result);
      resultsLength++;
      listedResults++;
      doNotOutput =
        doNotOutput ||
        (config.limitParsedResults && listedResults >= 3e4 / threadSplit.count) ||
        listedResults >= 1e6 / threadSplit.count;
    }

    if (totalResults % 5000 == 0 && lastProgressReportTime + progressBarDelay < Date.now()) {
      lastProgressReportTime = Date.now();
      postMessage({
        checkedCalculations,
        estimatedCalculations,
        reachableTiers: runtime.maximumPossibleTiers,
      });
    }

    if (resultsLength >= 5000) {
      // @ts-ignore
      postMessage({ runtime, results, done: false, checkedCalculations, estimatedCalculations });
      results = [];
      resultsLength = 0;
    }
  }
  console.timeEnd(`Total run thread#${threadSplit.current}`);

  // @ts-ignore
  postMessage({
    runtime,
    results,
    done: true,
    checkedCalculations,
    estimatedCalculations,
    stats: {
      permutationCount: totalResults,
      itemCount: items.length - classItems.length,
      totalTime: Date.now() - startTime,
    },
  });
});
// endregion Main Worker Event Handler

// region Core Calculation Functions
export function getStatSum(
  items: IDestinyArmor[]
): [number, number, number, number, number, number] {
  return [
    items[0].mobility + items[1].mobility + items[2].mobility + items[3].mobility,
    items[0].resilience + items[1].resilience + items[2].resilience + items[3].resilience,
    items[0].recovery + items[1].recovery + items[2].recovery + items[3].recovery,
    items[0].discipline + items[1].discipline + items[2].discipline + items[3].discipline,
    items[0].intellect + items[1].intellect + items[2].intellect + items[3].intellect,
    items[0].strength + items[1].strength + items[2].strength + items[3].strength,
  ];
}

function applyMasterworkStats(
  item: IPermutatorArmor,
  config: BuildConfiguration,
  stats: number[] = [0, 0, 0, 0, 0, 0]
): void {
  if (item.armorSystem == ArmorSystem.Armor2) {
    if (
      item.masterworkLevel == MAXIMUM_MASTERWORK_LEVEL ||
      (item.isExotic && config.assumeExoticsMasterworked) ||
      (!item.isExotic && config.assumeLegendariesMasterworked)
    ) {
      // Armor 2.0 Masterworked items give +10 to all stats
      for (let i = 0; i < 6; i++) {
        stats[i] += 2;
      }
    }
  } else if (item.armorSystem == ArmorSystem.Armor3) {
    let multiplier = item.masterworkLevel;
    if (
      (item.isExotic && config.assumeExoticsMasterworked) ||
      (!item.isExotic && config.assumeLegendariesMasterworked)
    )
      multiplier = MAXIMUM_MASTERWORK_LEVEL;
    if (multiplier == 0) return;

    // item.archetypeStats contains three stat indices. The OTHER THREE get +1 per multiplier
    for (let i = 0; i < 6; i++) {
      if (item.archetypeStats.includes(i)) continue;
      stats[i] += multiplier;
    }
  }
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
    function recurse(idx: number, acc: number[], currentSeen: Set<string>) {
      if (idx === impValues.length) {
        addUniqueTuning(acc as Tuning);
        return;
      }

      // Deduplicate at each layer to reduce recursive calls
      const layerSeen = new Set<string>();

      for (const v of impValues[idx]) {
        const next = [
          acc[0] + v[0],
          acc[1] + v[1],
          acc[2] + v[2],
          acc[3] + v[3],
          acc[4] + v[4],
          acc[5] + v[5],
        ];

        const nextKey = next.join(",");

        // Skip if we've already processed this combination at this layer
        if (layerSeen.has(nextKey)) {
          continue;
        }
        layerSeen.add(nextKey);

        // Also skip if we've seen this globally (early termination)
        if (seen.has(nextKey)) {
          continue;
        }

        recurse(idx + 1, next, currentSeen);
      }
    }
    recurse(0, [0, 0, 0, 0, 0, 0], seen);
  }

  return tunings;
}

export function handlePermutation(
  runtime: any,
  config: BuildConfiguration,
  helmet: IPermutatorArmor,
  gauntlet: IPermutatorArmor,
  chest: IPermutatorArmor,
  leg: IPermutatorArmor,
  classItems: IPermutatorArmor[],
  constantBonus: number[],
  doNotOutput = false
): never[] | IPermutatorArmorSet | null {
  const items = [helmet, gauntlet, chest, leg];
  const stats = getStatSum(items);
  stats[1] += !items[2].isExotic && config.addConstent1Health ? 1 : 0;

  for (let item of items) applyMasterworkStats(item, config, stats);

  const targetStats = [0, 0, 0, 0, 0, 0];
  for (let n: ArmorStat = 0; n < 6; n++) {
    const targetVal = config.minimumStatTiers[n].value * 10;
    if (targetVal > 0) targetStats[n] = targetVal;
    // When we did not set a target stat, then we could potentially reach negative values too.
    else targetStats[n] = Math.min(0, stats[n]);
  }

  const statsWithoutMods = [stats[0], stats[1], stats[2], stats[3], stats[4], stats[5]];
  stats[0] += constantBonus[0];
  stats[1] += constantBonus[1];
  stats[2] += constantBonus[2];
  stats[3] += constantBonus[3];
  stats[4] += constantBonus[4];
  stats[5] += constantBonus[5];

  for (let n: ArmorStat = 0; n < 6; n++) {
    // Abort here if we are already above the limit, in case of fixed stat tiers
    if (config.minimumStatTiers[n].fixed) {
      if (stats[n] > config.minimumStatTiers[n].value * 10) return null;
    }
  }

  // get the amount of armor with artifice slot
  let availableArtificeCount = items.filter(
    (d) =>
      d.perk == ArmorPerkOrSlot.SlotArtifice ||
      (d.armorSystem === ArmorSystem.Armor2 &&
        ((config.assumeEveryLegendaryIsArtifice && !d.isExotic) ||
          (config.assumeEveryExoticIsArtifice && d.isExotic)))
  ).length;

  // get distance
  const distances = [
    Math.max(0, config.minimumStatTiers[0].value * 10 - stats[0]),
    Math.max(0, config.minimumStatTiers[1].value * 10 - stats[1]),
    Math.max(0, config.minimumStatTiers[2].value * 10 - stats[2]),
    Math.max(0, config.minimumStatTiers[3].value * 10 - stats[3]),
    Math.max(0, config.minimumStatTiers[4].value * 10 - stats[4]),
    Math.max(0, config.minimumStatTiers[5].value * 10 - stats[5]),
  ];

  if (config.onlyShowResultsWithNoWastedStats) {
    for (let stat: ArmorStat = 0; stat < 6; stat++) {
      const v = 10 - (stats[stat] % 10);
      distances[stat] = Math.max(distances[stat], v < 10 ? v : 0);
    }
  }
  const possibleT5Improvements: t5Improvement[] = [helmet, gauntlet, chest, leg]
    .filter(isT5WithTuning)
    .map(mapItemToTuning);

  // Greedy class item selection with early termination
  // Sort class items by their stat contribution to current gaps
  const sortedClassItems = sortClassItemsForGaps(classItems, config, distances, stats);

  // Try each class item with early termination
  let finalResult: IPermutatorArmorSet | never[] = [];
  let checkedClassItems = 0;
  classItemLoop: for (const classItem of sortedClassItems) {
    checkedClassItems++;
    const adjustedStats = [...stats];
    const tmpArtificeCount =
      availableArtificeCount + (classItem.perk == ArmorPerkOrSlot.SlotArtifice ? 1 : 0);

    adjustedStats[0] += classItem.mobility;
    adjustedStats[1] += classItem.resilience;
    adjustedStats[2] += classItem.recovery;
    adjustedStats[3] += classItem.discipline;
    adjustedStats[4] += classItem.intellect;
    adjustedStats[5] += classItem.strength;
    applyMasterworkStats(classItem, config, adjustedStats);

    for (let n: ArmorStat = 0; n < 6; n++) {
      // Abort here if we are already above the limit, in case of fixed stat tiers
      if (config.minimumStatTiers[n].fixed) {
        if (adjustedStats[n] > config.minimumStatTiers[n].value * 10) return null;
      }
    }

    const adjustedStatsWithoutMods = [
      statsWithoutMods[0] + classItem.mobility,
      statsWithoutMods[1] + classItem.resilience,
      statsWithoutMods[2] + classItem.recovery,
      statsWithoutMods[3] + classItem.discipline,
      statsWithoutMods[4] + classItem.intellect,
      statsWithoutMods[5] + classItem.strength,
    ];
    applyMasterworkStats(classItem, config, adjustedStatsWithoutMods);

    let tmpPossibleT5Improvements = possibleT5Improvements;
    if (isT5WithTuning(classItem)) {
      tmpPossibleT5Improvements = [...tmpPossibleT5Improvements, mapItemToTuning(classItem)];
    }

    const availableTuningCount = tmpPossibleT5Improvements.length;
    const availableTunings: Tuning[] = generate_tunings(tmpPossibleT5Improvements);

    // Recalculate distances with class item included
    const newDistances = [
      Math.max(0, config.minimumStatTiers[0].value * 10 - adjustedStats[0]),
      Math.max(0, config.minimumStatTiers[1].value * 10 - adjustedStats[1]),
      Math.max(0, config.minimumStatTiers[2].value * 10 - adjustedStats[2]),
      Math.max(0, config.minimumStatTiers[3].value * 10 - adjustedStats[3]),
      Math.max(0, config.minimumStatTiers[4].value * 10 - adjustedStats[4]),
      Math.max(0, config.minimumStatTiers[5].value * 10 - adjustedStats[5]),
    ];

    if (config.onlyShowResultsWithNoWastedStats) {
      for (let stat: ArmorStat = 0; stat < 6; stat++) {
        const v = 10 - (adjustedStats[stat] % 10);
        newDistances[stat] = Math.max(newDistances[stat], v < 10 ? v : 0);
      }
    }

    // Recalculate optional distances
    const newOptionalDistances: number[] = [0, 0, 0, 0, 0, 0];
    if (config.tryLimitWastedStats)
      for (let stat: ArmorStat = 0; stat < 6; stat++) {
        if (
          newDistances[stat] == 0 &&
          !config.minimumStatTiers[stat].fixed &&
          adjustedStats[stat] < 200 &&
          adjustedStats[stat] % 10 > 0
        ) {
          newOptionalDistances[stat] = 10 - (adjustedStats[stat] % 10);
        }
      }

    const newDistanceSum =
      newDistances[0] +
      newDistances[1] +
      newDistances[2] +
      newDistances[3] +
      newDistances[4] +
      newDistances[5];
    const newTotalOptionalDistances = newOptionalDistances.reduce((a, b) => a + b, 0);

    if (newDistanceSum > 50 * 5 + 3 * availableArtificeCount + 5 * availableTuningCount) {
      if (config.earlyAbortClassItems && checkedClassItems >= 3) break classItemLoop;
      else continue classItemLoop;
    }

    for (let stat = 0; stat < 6; stat++) {
      const possibleIncreaseByTuning = availableTunings.sort((a, b) => b[stat] - a[stat])[0][stat];
      const possibleIncreaseByMod =
        10 * config.statModLimits.maxMajorMods +
        5 * Math.max(0, config.statModLimits.maxMods - config.statModLimits.maxMajorMods);
      const possibleIncreaseByArtifice = 3 * availableArtificeCount;
      const possibleIncrease =
        possibleIncreaseByMod + possibleIncreaseByTuning + possibleIncreaseByArtifice;

      if (possibleIncrease < newDistances[stat]) {
        if (config.earlyAbortClassItems && checkedClassItems >= 3) break classItemLoop;
        else continue classItemLoop;
      }
    }

    let result: StatModifierPrecalc | null;
    if (newDistanceSum == 0 && newTotalOptionalDistances == 0)
      result = { mods: [], tuning: [0, 0, 0, 0, 0, 0], modBonus: [0, 0, 0, 0, 0, 0] };
    else
      result = get_mods_precalc(
        adjustedStats,
        targetStats,
        config,
        newDistances,
        newOptionalDistances,
        tmpArtificeCount,
        config.modOptimizationStrategy,
        availableTunings
      );

    if (result !== null) {
      // Perform Tier Availability Testing with this class item
      performTierAvailabilityTesting(
        runtime,
        config,
        adjustedStats,
        targetStats,
        newDistances,
        tmpArtificeCount,
        availableTunings
      );

      // This may lead to issues later.
      // The performTierAvailabilityTesting must be executed for each class item.
      // Found a working combination - return immediately with this class item
      if (finalResult instanceof Array && finalResult.length == 0) {
        finalResult = tryCreateArmorSetWithClassItem(
          runtime,
          config,
          helmet,
          gauntlet,
          chest,
          leg,
          classItem,
          result,
          adjustedStats,
          adjustedStatsWithoutMods,
          newDistances,
          tmpArtificeCount,
          doNotOutput
        );
      }
    }
  }

  return finalResult;
}

function getStatVal(statId: ArmorStat, mods: StatModifierPrecalc, start: number) {
  return start + mods.tuning[statId] + mods.modBonus[statId];
}

// region Tier Availability Testing
function performTierAvailabilityTesting(
  runtime: any,
  config: BuildConfiguration,
  stats: number[],
  targetStats: number[],
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

    const minTier = config.minimumStatTiers[stat as ArmorStat].value * 10;

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
        targetStats,
        config,
        testDistances,
        [0, 0, 0, 0, 0, 0],
        availableArtificeCount,
        ModOptimizationStrategy.None,
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
        targetStats,
        config,
        testDistances,
        [0, 0, 0, 0, 0, 0],
        availableArtificeCount,
        ModOptimizationStrategy.None,
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

function tryCreateArmorSetWithClassItem(
  runtime: any,
  config: BuildConfiguration,
  helmet: IPermutatorArmor,
  gauntlet: IPermutatorArmor,
  chest: IPermutatorArmor,
  leg: IPermutatorArmor,
  classItem: IPermutatorArmor,
  result: StatModifierPrecalc,
  adjustedStats: number[],
  statsWithoutMods: number[],
  newDistances: number[],
  availableArtificeCount: number,
  doNotOutput: boolean
): IPermutatorArmorSet | never[] {
  if (doNotOutput) return [];

  const usedArtifice = result.mods.filter((d: StatModifier) => 0 == d % 3);
  const usedMods = result.mods.filter((d: StatModifier) => 0 != d % 3);

  // Apply mods to stats for final calculation
  const finalStats = [...adjustedStats];
  for (let statModifier of result.mods) {
    const stat = Math.floor((statModifier - 1) / 3);
    finalStats[stat] += STAT_MOD_VALUES[statModifier][1];
  }

  for (let n = 0; n < 6; n++) finalStats[n] += result.tuning[n];

  const waste1 = getWaste(finalStats);
  if (config.onlyShowResultsWithNoWastedStats && waste1 > 0) return [];

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
    //    if (availableTunings.some(tuning => tuning.every(v => v >= 0))) {
    //      return [];
    //    }

    // Now there are only tunings with negative values left.
    // 2.1 If there is any stat where (currentStat - tuningValue) >= target value, then return
    outer: for (let tuning of availableTunings) {
      for (let i = 0; i < 6; i++) {
        if (tuning[i] >= 0) continue;
        if (currentStats[i] + tuning[i] < targetStats[i]) continue outer;
      }
      return [tuning];
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
  targetStats: number[],
  config: BuildConfiguration,
  distances: number[],
  optionalDistances: number[],
  availableArtificeCount: number,
  optimize: ModOptimizationStrategy = ModOptimizationStrategy.None,
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
    targetStats,
    distances,
    availableTunings,
    0,
    availableArtificeCount,
    config.statModLimits.maxMajorMods,
    config.statModLimits.maxMods
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
