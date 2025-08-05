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

import { precalculatedZeroWasteModCombinations } from "../data/generated/precalculatedZeroWasteModCombinations";
import { precalculatedModCombinations } from "../data/generated/precalculatedModCombinations";
import { ModOptimizationStrategy } from "../data/enum/mod-optimization-strategy";
import { IPermutatorArmor } from "../data/types/IPermutatorArmor";
import {
  IPermutatorArmorSet,
  createArmorSet,
  isIPermutatorArmorSet,
} from "../data/types/IPermutatorArmorSet";
import { ArmorSystem } from "../data/types/IManifestArmor";
// endregion Imports

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

  // Support multithreading. find the largest set and split it by N.
  if (threadSplit.count > 1) {
    var splitEntry = (
      [
        [helmets, helmets.length],
        [gauntlets, gauntlets.length],
        [chests, chests.length],
        [legs, legs.length],
      ] as [IPermutatorArmor[], number][]
    ).sort((a, b) => b[1] - a[1])[0][0];

    var keepLength = Math.round(splitEntry.length / threadSplit.count);
    var startIndex = keepLength * threadSplit.current; // we can delete everything before this
    var endIndex = startIndex + keepLength; // we can delete everything after this
    // if we have rounding issues, let the last thread do the rest
    if (threadSplit.current == threadSplit.count - 1) endIndex = splitEntry.length;

    // remove data at the end
    splitEntry.splice(endIndex);
    splitEntry.splice(0, startIndex);
  }

  let classItems = items.filter((i) => i.slot == ArmorSlot.ArmorSlotClass);
  // Sort by Masterwork, descending
  classItems = classItems.sort((a, b) => (b.masterworkLevel ?? 0) - (a.masterworkLevel ?? 0));

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
          ((i.isExotic && config.assumeExoticsMasterworked) ||
            (!i.isExotic && config.assumeLegendariesMasterworked) ||
            // If there is any stat fixed, we check if the masterwork level is the same as the first item
            (anyStatFixed && i.masterworkLevel === item.masterworkLevel) ||
            // If there is no stat fixed, then we just use the masterwork level of the first item.
            // As it is already sorted descending, we can just check if the masterwork level is the same
            !anyStatFixed) &&
          (doesNotRequireArmorPerks || i.perk === item.perk)
      )
  );
  //*/

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

  // distances required to reduce wasted stat points :)
  const optionalDistances = [0, 0, 0, 0, 0, 0];
  if (config.tryLimitWastedStats)
    for (let stat: ArmorStat = 0; stat < 6; stat++) {
      if (
        distances[stat] == 0 &&
        !config.minimumStatTiers[stat].fixed &&
        stats[stat] < 200 &&
        stats[stat] % 10 > 0
      ) {
        optionalDistances[stat] = 10 - (stats[stat] % 10);
      }
    }

  // Greedy class item selection with early termination
  // Sort class items by their stat contribution to current gaps
  const sortedClassItems = [...classItems].sort((a, b) => {
    let scoreA = 0,
      scoreB = 0;

    // add 10 if the class item is Armor 3.0
    if (a.armorSystem == ArmorSystem.Armor3) scoreA += 10;
    if (b.armorSystem == ArmorSystem.Armor3) scoreB += 10;

    // add 10 if the class item has an artifice slot
    if (a.perk == ArmorPerkOrSlot.SlotArtifice) scoreA += 10;
    if (b.perk == ArmorPerkOrSlot.SlotArtifice) scoreB += 10;

    // vendor and collection rolls last
    if (a.source === InventoryArmorSource.Inventory) scoreA += 5;
    if (b.source === InventoryArmorSource.Inventory) scoreB += 5;

    for (let i = 0; i < 6; i++) {
      if (distances[i] > 0) {
        scoreA += Math.min(
          distances[i],
          a.mobility * (i === 0 ? 1 : 0) +
            a.resilience * (i === 1 ? 1 : 0) +
            a.recovery * (i === 2 ? 1 : 0) +
            a.discipline * (i === 3 ? 1 : 0) +
            a.intellect * (i === 4 ? 1 : 0) +
            a.strength * (i === 5 ? 1 : 0)
        );
        scoreB += Math.min(
          distances[i],
          b.mobility * (i === 0 ? 1 : 0) +
            b.resilience * (i === 1 ? 1 : 0) +
            b.recovery * (i === 2 ? 1 : 0) +
            b.discipline * (i === 3 ? 1 : 0) +
            b.intellect * (i === 4 ? 1 : 0) +
            b.strength * (i === 5 ? 1 : 0)
        );
      }
    }
    return scoreB - scoreA; // Higher contribution first
  });

  // Try each class item with early termination
  let finalResult: IPermutatorArmorSet | never[] = [];
  for (const classItem of sortedClassItems) {
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
    const newOptionalDistances = [0, 0, 0, 0, 0, 0];
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

    if (newDistanceSum > 10 * 5 + 3 * tmpArtificeCount) continue;

    let result: StatModifier[] | null;
    if (newDistanceSum == 0 && newTotalOptionalDistances == 0) result = [];
    else
      result = get_mods_precalc(
        config,
        newDistances,
        newOptionalDistances,
        tmpArtificeCount,
        config.modOptimizationStrategy
      );

    if (result !== null) {
      // Perform Tier Availability Testing with this class item
      performTierAvailabilityTesting(
        runtime,
        config,
        adjustedStats,
        newDistances,
        tmpArtificeCount
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

// region Tier Availability Testing
function performTierAvailabilityTesting(
  runtime: any,
  config: BuildConfiguration,
  stats: number[],
  distances: number[],
  availableArtificeCount: number
): void {
  for (let stat = 0; stat < 6; stat++) {
    if (runtime.maximumPossibleTiers[stat] < stats[stat]) {
      runtime.maximumPossibleTiers[stat] = stats[stat];
    }

    if (stats[stat] >= 200) continue; // Already at max value, no need to test

    const minTier = config.minimumStatTiers[stat as ArmorStat].value * 10;

    // Binary search to find maximum possible value
    let low = Math.max(runtime.maximumPossibleTiers[stat], minTier);
    let high = 200;

    while (low < high) {
      // Try middle value, rounded to nearest 10 for tier optimization
      const mid = Math.min(200, Math.ceil((low + high) / 2));

      if (stats[stat] >= mid) {
        // We can already reach this value naturally
        low = mid + 1;
        continue;
      }

      // Calculate distance needed to reach this value
      const v = 10 - (stats[stat] % 10);
      const testDistances = [...distances];
      testDistances[stat] = Math.max(v < 10 ? v : 0, mid - stats[stat]);

      // Check if this value is achievable with mods
      const mods = get_mods_precalc(
        config,
        testDistances,
        [0, 0, 0, 0, 0, 0],
        availableArtificeCount,
        ModOptimizationStrategy.None
      );

      if (mods != null) {
        // This value is achievable, try higher
        low = mid + 1;
        runtime.maximumPossibleTiers[stat] = mid;
      } else {
        // This value is not achievable, try lower
        high = mid - 1;
      }
    }

    // Verify the final value
    if (low > runtime.maximumPossibleTiers[stat] && low <= 200) {
      const v = 10 - (stats[stat] % 10);
      const testDistances = [...distances];
      testDistances[stat] = Math.max(v < 10 ? v : 0, low - stats[stat]);
      const mods = get_mods_precalc(
        config,
        testDistances,
        [0, 0, 0, 0, 0, 0],
        availableArtificeCount,
        ModOptimizationStrategy.None
      );
      if (mods != null) {
        runtime.maximumPossibleTiers[stat] = low;
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
  result: StatModifier[],
  adjustedStats: number[],
  statsWithoutMods: number[],
  newDistances: number[],
  availableArtificeCount: number,
  doNotOutput: boolean
): IPermutatorArmorSet | never[] {
  if (doNotOutput) return [];

  const usedArtifice = result.filter((d: StatModifier) => 0 == d % 3);
  const usedMods = result.filter((d: StatModifier) => 0 != d % 3);

  // Apply mods to stats for final calculation
  const finalStats = [...adjustedStats];
  for (let statModifier of result) {
    const stat = Math.floor((statModifier - 1) / 3);
    finalStats[stat] += STAT_MOD_VALUES[statModifier][1];
  }

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
    statsWithoutMods
  );
}

// region Mod Calculation Functions
function get_mods_precalc(
  config: BuildConfiguration,
  distances: number[],
  optionalDistances: number[],
  availableArtificeCount: number,
  optimize: ModOptimizationStrategy = ModOptimizationStrategy.None
): StatModifier[] | null {
  // check distances <= 65
  const totalDistance =
    distances[0] + distances[1] + distances[2] + distances[3] + distances[4] + distances[5];
  if (totalDistance > 65) return null;

  if (totalDistance == 0 && optionalDistances.every((d) => d == 0)) {
    // no mods needed, return empty array
    return [];
  }

  const modCombinations = config.onlyShowResultsWithNoWastedStats
    ? precalculatedZeroWasteModCombinations
    : precalculatedModCombinations;

  // grab the precalculated mods for the distances
  const precalculatedMods = [
    modCombinations[distances[0]] || [[0, 0, 0, 0]], // mobility
    modCombinations[distances[1]] || [[0, 0, 0, 0]], // resilience
    modCombinations[distances[2]] || [[0, 0, 0, 0]], // recovery
    modCombinations[distances[3]] || [[0, 0, 0, 0]], // discipline
    modCombinations[distances[4]] || [[0, 0, 0, 0]], // intellect
    modCombinations[distances[5]] || [[0, 0, 0, 0]], // strength
  ];

  // we handle locked exact stats as zero-waste in terms  of the mod selection
  for (let i = 0; i < 6; i++) {
    if (config.minimumStatTiers[i as ArmorStat].fixed && distances[i] > 0) {
      precalculatedMods[i] = precalculatedZeroWasteModCombinations[distances[i]] || [[0, 0, 0, 0]];
      // and now also remove every solution with >= 10 points of "overshoot"
      precalculatedMods[i] = precalculatedMods[i].filter((d) => d[3] - distances[i] < 10);
    }
  }

  // add optional distances to the precalculated mods
  const limit = 3;
  for (let i = 0; i < optionalDistances.length; i++) {
    if (optionalDistances[i] > 0) {
      const additionalCombosA = modCombinations[optionalDistances[i]].filter(
        (d) =>
          d[2] == 0 && // disallow major mods
          d[3] % 10 > 0 && // we do not want to add exact stat tiers
          (optionalDistances[i] + d[3]) % 10 < optionalDistances[i] // and the changes must have less waste than before
      );
      //(d) => d[3] % 10 > 0);
      if (additionalCombosA != null) {
        precalculatedMods[i] = additionalCombosA.slice(0, limit).concat(precalculatedMods[i]);
      }
    }
  }

  for (let i = 0; i < 6; i++) {
    precalculatedMods[i] = precalculatedMods[i].filter(
      (d) =>
        d[2] <= config.statModLimits.maxMajorMods && d[1] + d[2] <= config.statModLimits.maxMods
    );

    if (precalculatedMods[i] == null || precalculatedMods[i].length == 0) {
      // if there are no mods for this distance, we can not calculate anything
      return null;
    }
  }

  let bestMods: any = null;
  let bestScore = 1000;

  function score(entries: [number, number, number, number][]) {
    if (optimize == ModOptimizationStrategy.ReduceUsedModSockets) {
      const n1 = entries.reduce((a, b) => a + b[1] + b[2], 0);
      return n1;
    } else if (optimize == ModOptimizationStrategy.ReduceUsedModPoints) {
      return entries.reduce((a, b, currentIndex) => a + 1 * b[1] + 3 * b[2], 0);
    }
    return entries.reduce((a, b) => a + b[3], 0);
  }

  function validate(entries: [number, number, number, number][]): boolean {
    // sum up the stats
    const sum = entries.reduce(
      (a, b, i) => [a[0] + b[0], a[1] + b[1], a[2] + b[2], a[3] + b[3] - distances[i]],
      [0, 0, 0, 0]
    );

    if (score(entries) > bestScore) return false;
    if (sum[0] > availableArtificeCount) return false;
    if (sum[1] + sum[2] > config.statModLimits.maxMods) return false;
    if (sum[2] > config.statModLimits.maxMajorMods) return false;
    if (sum[3] < 0) return false;

    return true;
  }

  const mustExecuteOptimization = totalDistance > 0 && optimize != ModOptimizationStrategy.None;
  root: for (let mobility of precalculatedMods[0]) {
    if (!validate([mobility])) continue;
    for (let resilience of precalculatedMods[1]) {
      if (!validate([mobility, resilience])) continue;
      for (let recovery of precalculatedMods[2]) {
        if (!validate([mobility, resilience, recovery])) continue;
        if (mustExecuteOptimization && score([mobility, resilience, recovery]) >= bestScore)
          continue;
        for (let discipline of precalculatedMods[3]) {
          if (!validate([mobility, resilience, recovery, discipline])) continue;
          if (
            mustExecuteOptimization &&
            score([mobility, resilience, recovery, discipline]) >= bestScore
          )
            continue;
          for (let intellect of precalculatedMods[4]) {
            if (!validate([mobility, resilience, recovery, discipline, intellect])) continue;
            if (
              mustExecuteOptimization &&
              score([mobility, resilience, recovery, discipline, intellect]) >= bestScore
            )
              continue;
            inner: for (let strength of precalculatedMods[5]) {
              let mods = [mobility, resilience, recovery, discipline, intellect, strength];

              if (!validate(mods)) continue;

              // Fill optional distances
              for (let m = 0; m < 6; m++)
                if (optionalDistances[m] > 0 && mods[m][3] == 0 && bestMods != null) continue inner;

              let scoreVal = score(mods);
              if (scoreVal < bestScore) {
                bestScore = scoreVal;
                bestMods = mods;
                if (!mustExecuteOptimization) {
                  break root;
                }
              }
            }
          }
        }
      }
    }
  }
  if (bestMods === null) return null;

  const usedMods = [];
  for (let i = 0; i < bestMods.length; i++) {
    for (let n = 0; n < bestMods[i][0]; n++) usedMods.push(3 + 3 * i);
    for (let n = 0; n < bestMods[i][1]; n++) usedMods.push(1 + 3 * i);
    for (let n = 0; n < bestMods[i][2]; n++) usedMods.push(2 + 3 * i);
  }

  return usedMods;
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
