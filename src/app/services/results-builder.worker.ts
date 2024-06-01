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

import { BuildConfiguration } from "../data/buildConfiguration";
import { IDestinyArmor } from "../data/types/IInventoryArmor";
import { Database } from "../data/database";
import { ArmorSlot } from "../data/enum/armor-slot";
import { FORCE_USE_ANY_EXOTIC, FORCE_USE_NO_EXOTIC } from "../data/constants";
import { ModInformation } from "../data/ModInformation";
import {
  ArmorPerkOrSlot,
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

function checkSlots(
  config: BuildConfiguration,
  constantModslotRequirement: number[],
  availableClassItemTypes: Set<ArmorPerkOrSlot>,
  helmet: IPermutatorArmor,
  gauntlet: IPermutatorArmor,
  chest: IPermutatorArmor,
  leg: IPermutatorArmor
) {
  let requirements = constantModslotRequirement.slice();
  if (
    !helmet.isExotic &&
    config.armorPerks[ArmorSlot.ArmorSlotHelmet].fixed &&
    config.armorPerks[ArmorSlot.ArmorSlotHelmet].value != ArmorPerkOrSlot.None &&
    config.armorPerks[ArmorSlot.ArmorSlotHelmet].value != helmet.perk
  )
    return { valid: false };
  if (
    !gauntlet.isExotic &&
    config.armorPerks[ArmorSlot.ArmorSlotGauntlet].fixed &&
    config.armorPerks[ArmorSlot.ArmorSlotGauntlet].value != ArmorPerkOrSlot.None &&
    config.armorPerks[ArmorSlot.ArmorSlotGauntlet].value != gauntlet.perk
  )
    return { valid: false };
  if (
    !chest.isExotic &&
    config.armorPerks[ArmorSlot.ArmorSlotChest].fixed &&
    config.armorPerks[ArmorSlot.ArmorSlotChest].value != ArmorPerkOrSlot.None &&
    config.armorPerks[ArmorSlot.ArmorSlotChest].value != chest.perk
  )
    return { valid: false };
  if (
    !leg.isExotic &&
    config.armorPerks[ArmorSlot.ArmorSlotLegs].fixed &&
    config.armorPerks[ArmorSlot.ArmorSlotLegs].value != ArmorPerkOrSlot.None &&
    config.armorPerks[ArmorSlot.ArmorSlotLegs].value != leg.perk
  )
    return { valid: false };
  // also return if we can not find the correct class item.
  if (
    config.armorPerks[ArmorSlot.ArmorSlotClass].fixed &&
    config.armorPerks[ArmorSlot.ArmorSlotClass].value != ArmorPerkOrSlot.None &&
    !availableClassItemTypes.has(config.armorPerks[ArmorSlot.ArmorSlotClass].value)
  )
    return { valid: false };

  requirements[helmet.perk]--;
  requirements[gauntlet.perk]--;
  requirements[chest.perk]--;
  requirements[leg.perk]--;

  // ignore perk requirement in exotic
  if (helmet.isExotic) requirements[config.armorPerks[helmet.slot].value]--;
  else if (gauntlet.isExotic) requirements[config.armorPerks[gauntlet.slot].value]--;
  else if (chest.isExotic) requirements[config.armorPerks[chest.slot].value]--;
  else if (leg.isExotic) requirements[config.armorPerks[leg.slot].value]--;

  let bad = 0;
  for (let n = 1; n < ArmorPerkOrSlot.COUNT; n++) bad += Math.max(0, requirements[n]);

  var requiredClassItemType = ArmorPerkOrSlot.None;
  if (bad == 1) {
    // search if we have a class item to fulfill the stats
    var fixed = false;
    for (let k = 1; k < ArmorPerkOrSlot.COUNT && !fixed; k++) {
      if (requirements[k] <= 0) continue;
      if (availableClassItemTypes.has(k)) {
        fixed = true;
        requiredClassItemType = k;
      }
    }
    if (fixed) bad--;
  } else if (
    requiredClassItemType == ArmorPerkOrSlot.None &&
    config.armorPerks[ArmorSlot.ArmorSlotClass].fixed
  ) {
    requiredClassItemType = config.armorPerks[ArmorSlot.ArmorSlotClass].value;
  }

  // if (config.armorPerks[ArmorSlot.ArmorSlotClass].value != ArmorPerkOrSlot.None && !config.armorPerks[ArmorSlot.ArmorSlotClass].fixed) bad--;

  return { valid: bad <= 0, requiredClassItemType };
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
  let constantPerkRequirement = [];
  for (let n = 0; n < ArmorPerkOrSlot.COUNT; n++) constantPerkRequirement.push(0);

  constantPerkRequirement[config.armorPerks[ArmorSlot.ArmorSlotHelmet].value]++;
  constantPerkRequirement[config.armorPerks[ArmorSlot.ArmorSlotChest].value]++;
  constantPerkRequirement[config.armorPerks[ArmorSlot.ArmorSlotGauntlet].value]++;
  constantPerkRequirement[config.armorPerks[ArmorSlot.ArmorSlotLegs].value]++;
  constantPerkRequirement[config.armorPerks[ArmorSlot.ArmorSlotClass].value]++;
  return constantPerkRequirement;
}

function prepareConstantAvailableModslots(config: BuildConfiguration) {
  var availableModCost: number[] = [];
  availableModCost.push(config.maximumModSlots[ArmorSlot.ArmorSlotHelmet].value);
  availableModCost.push(config.maximumModSlots[ArmorSlot.ArmorSlotGauntlet].value);
  availableModCost.push(config.maximumModSlots[ArmorSlot.ArmorSlotChest].value);
  availableModCost.push(config.maximumModSlots[ArmorSlot.ArmorSlotLegs].value);
  availableModCost.push(config.maximumModSlots[ArmorSlot.ArmorSlotClass].value);
  return availableModCost.filter((d) => d > 0).sort((a, b) => b - a);
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

addEventListener("message", async ({ data }) => {
  if (data.type != "builderRequest") return;

  const threadSplit = data.threadSplit as { count: number; current: number };
  const startTime = Date.now();
  console.debug("START RESULTS BUILDER 2");
  console.time(`total #${threadSplit.current}`);
  const config = data.config as BuildConfiguration;

  // toggle feature flags
  config.onlyShowResultsWithNoWastedStats =
    environment.featureFlags.enableZeroWaste && config.onlyShowResultsWithNoWastedStats;
  if (!environment.featureFlags.enableModslotLimitation) {
    config.maximumModSlots[ArmorSlot.ArmorSlotHelmet].value = 5;
    config.maximumModSlots[ArmorSlot.ArmorSlotGauntlet].value = 5;
    config.maximumModSlots[ArmorSlot.ArmorSlotChest].value = 5;
    config.maximumModSlots[ArmorSlot.ArmorSlotLegs].value = 5;
    config.maximumModSlots[ArmorSlot.ArmorSlotClass].value = 5;
  }
  console.log("Using config", data.config);

  let items = data.items as IPermutatorArmor[];

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
  let availableClassItemPerkTypes = new Set(classItems.map((d) => d.perk));
  if (config.assumeEveryLegendaryIsArtifice || config.assumeClassItemIsArtifice)
    availableClassItemPerkTypes.add(ArmorPerkOrSlot.SlotArtifice);

  console.debug(
    "items",
    JSON.stringify({
      helmets: helmets.length,
      gauntlets: gauntlets.length,
      chests: chests.length,
      legs: legs.length,
      availableClassItemTypes: availableClassItemPerkTypes,
    })
  );

  // runtime variables
  const runtime = {
    maximumExoticPossibleTiers: new Map<number, number[]>(),
    maximumPossibleTiers: [0, 0, 0, 0, 0, 0],
    statCombo3x100: new Set<number>(),
    statCombo4x100: new Set<number>(),
  };
  const constantBonus = prepareConstantStatBonus(config);
  const constantModslotRequirement = prepareConstantModslotRequirement(config);
  const constantAvailableModslots = prepareConstantAvailableModslots(config);
  const hasArtificeClassItem = availableClassItemPerkTypes.has(ArmorPerkOrSlot.SlotArtifice);
  const requiresAtLeastOneExotic =
    config.selectedExotics.indexOf(FORCE_USE_NO_EXOTIC) == -1 && config.selectedExotics.length > 0;

  console.log("hasArtificeClassItem", hasArtificeClassItem);

  let results: IPermutatorArmorSet[] = [];
  let resultsLength = 0;

  let listedResults = 0;
  let totalResults = 0;
  let doNotOutput = false;

  // contains the value of the total amount of combinations to be checked
  let estimatedCalculations = estimateCombinationsToBeChecked(helmets, gauntlets, chests, legs);
  let checkedCalculations = 0;
  let lastProgressReportTime = 0;
  console.log(`estimatedCalculations for thread #${threadSplit.current}`, estimatedCalculations);

  // define the delay; it can be 75ms if the estimated calculations are low
  // if the estimated calculations >= 1e6, then we will use 125ms
  let progressBarDelay = estimatedCalculations >= 1e6 ? 125 : 75;

  console.time(`tm #${threadSplit.current}`);

  for (let [helmet, gauntlet, chest, leg] of generateArmorCombinations(
    helmets,
    gauntlets,
    chests,
    legs,
    requiresAtLeastOneExotic
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

    const canUseArtificeClassItem =
      !slotCheckResult.requiredClassItemType ||
      slotCheckResult.requiredClassItemType == ArmorPerkOrSlot.SlotArtifice;
    const result = handlePermutation(
      runtime,
      config,
      helmet,
      gauntlet,
      chest,
      leg,
      constantBonus,
      constantAvailableModslots,
      doNotOutput,
      hasArtificeClassItem && canUseArtificeClassItem
    );
    // Only add 50k to the list if the setting is activated.
    // We will still calculate the rest so that we get accurate results for the runtime values
    if (result != null) {
      totalResults++;
      if (isIPermutatorArmorSet(result)) {
        result.classItemPerk =
          slotCheckResult.requiredClassItemType ||
          (hasArtificeClassItem ? ArmorPerkOrSlot.SlotArtifice : ArmorPerkOrSlot.None);
        results.push(result);
        resultsLength++;
        listedResults++;
        doNotOutput =
          doNotOutput ||
          (config.limitParsedResults && listedResults >= 3e4 / threadSplit.count) ||
          listedResults >= 1e6 / threadSplit.count;
      }
    }

    if (totalResults % 5000 == 0 && lastProgressReportTime + progressBarDelay < Date.now()) {
      lastProgressReportTime = Date.now();
      postMessage({ checkedCalculations, estimatedCalculations });
    }

    if (resultsLength >= 5000) {
      // @ts-ignore
      postMessage({ runtime, results, done: false, checkedCalculations, estimatedCalculations });
      results = [];
      resultsLength = 0;
    }
  }
  console.timeEnd(`tm #${threadSplit.current}`);
  console.timeEnd(`total #${threadSplit.current}`);

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

export function handlePermutation(
  runtime: {
    maximumExoticPossibleTiers: Map<number, number[]>;
    maximumPossibleTiers: number[];
    statCombo3x100: Set<number>;
    statCombo4x100: Set<number>;
  },
  config: BuildConfiguration,
  helmet: IPermutatorArmor,
  gauntlet: IPermutatorArmor,
  chest: IPermutatorArmor,
  leg: IPermutatorArmor,
  constantBonus: number[],
  availableModCost: number[],
  doNotOutput = false,
  hasArtificeClassItem = false
): never[] | IPermutatorArmorSet | null {
  const items = [helmet, gauntlet, chest, leg];
  var totalStatBonus = config.assumeClassItemMasterworked ? 2 : 0;
  for (let i = 0; i < items.length; i++) {
    let item = items[i]; // add masterworked value, if necessary
    if (
      item.masterworked ||
      (item.isExotic && config.assumeExoticsMasterworked) ||
      (!item.isExotic && config.assumeLegendariesMasterworked)
    )
      totalStatBonus += 2;
  }
  const stats = getStatSum(items);
  stats[0] += totalStatBonus;
  stats[1] += totalStatBonus + (!items[2].isExotic && config.addConstent1Resilience ? 1 : 0);
  stats[2] += totalStatBonus;
  stats[3] += totalStatBonus;
  stats[4] += totalStatBonus;
  stats[5] += totalStatBonus;

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
      if (config.allowExactStats && stats[n] / 10 - 0.001 > config.minimumStatTiers[n].value)
        return null;
      if (!config.allowExactStats && stats[n] / 10 >= config.minimumStatTiers[n].value + 1)
        return null;
    }
  }

  // get the amount of armor with artifice slot
  let availableArtificeCount = items.filter(
    (d) =>
      d.perk == ArmorPerkOrSlot.SlotArtifice ||
      (config.assumeEveryLegendaryIsArtifice && !d.isExotic) ||
      (config.assumeEveryExoticIsArtifice && d.isExotic)
  ).length;

  if (hasArtificeClassItem) availableArtificeCount += 1;

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

  let exoticHash = items.find((x) => x.isExotic)?.hash ?? 0;
  let exoticmaximumPossibleTiers = runtime.maximumExoticPossibleTiers.get(exoticHash) ?? [
    -1, -1, -1, -1, -1, -1,
  ];
  // distances required to reduce wasted stat points :)
  const optionalDistances = [0, 0, 0, 0, 0, 0];
  if (config.tryLimitWastedStats)
    for (let stat: ArmorStat = 0; stat < 6; stat++) {
      if (
        distances[stat] == 0 &&
        !config.minimumStatTiers[stat].fixed &&
        stats[stat] < 100 &&
        stats[stat] % 10 > 0
      ) {
        optionalDistances[stat] = 10 - (stats[stat] % 10);
      }
    }

  const totalOptionalDistances = optionalDistances.reduce((a, b) => a + b, 0);
  // if the sum of distances is > (10*5)+(3*artificeCount), we can abort here
  //const distanceSum = distances.reduce((a, b) => a + b, 0);
  let distanceSum =
    distances[0] + distances[1] + distances[2] + distances[3] + distances[4] + distances[5];
  if (distanceSum > 10 * 5 + 3 * availableArtificeCount) {
    for (let stat = 0; stat < 6; stat++) {
      if (
        exoticmaximumPossibleTiers[stat] < stats[stat] &&
        distanceSum > 10 * 5 + 3 * availableArtificeCount
      ) {
        exoticmaximumPossibleTiers[stat] = stats[stat];
      }
      const oldDistance = distances[stat];
      for (let tier = 10; tier >= 0; tier--) {
        if (stats[stat] < tier * 10) {
          const v = 10 - (stats[stat] % 10);
          distances[stat] = Math.max(v < 10 ? v : 0, tier * 10 - stats[stat]);
          distanceSum =
            distances[0] + distances[1] + distances[2] + distances[3] + distances[4] + distances[5];
          const mods = get_mods_precalc(
            config,
            distances,
            [0, 0, 0, 0, 0, 0],
            availableArtificeCount,
            availableModCost,
            ModOptimizationStrategy.None
          );
          distances[stat] = oldDistance;
          //const mods = null;
          if (mods != null) {
            if (
              exoticmaximumPossibleTiers[stat] < tier * 10 &&
              distanceSum > 10 * 5 + 3 * availableArtificeCount
            ) {
              exoticmaximumPossibleTiers[stat] = tier * 10;
              break;
            }
          }
        }
      }
    }
    if (exoticHash != 0)
      runtime.maximumExoticPossibleTiers.set(exoticHash, exoticmaximumPossibleTiers);
    return null;
  }

  let result: StatModifier[] | null;
  if (distanceSum == 0 && totalOptionalDistances == 0) result = [];
  else
    result = get_mods_precalc(
      config,
      distances,
      optionalDistances,
      availableArtificeCount,
      availableModCost,
      config.modOptimizationStrategy
    );

  if (result == null) return null;

  //#region 3x100 and 4x100 optimization
  //#################################################################################
  // 3x100 and 4x100 optimization
  // This code could be in its own function, but even calling an empty method
  // with the required parameters increases the runtime by A LOT (25% on my end)
  //################################################################################
  //*/
  const distancesTo100 = [
    Math.max(0, 100 - stats[0]),
    Math.max(0, 100 - stats[1]),
    Math.max(0, 100 - stats[2]),
    Math.max(0, 100 - stats[3]),
    Math.max(0, 100 - stats[4]),
    Math.max(0, 100 - stats[5]),
  ];

  // find every combo of three stats which sum is less than 65; no duplicates
  let combos3x100 = [];
  let combos4x100 = [];
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 5; j++) {
      for (let k = j + 1; k < 6; k++) {
        let dx = distances.slice();
        dx[i] = distancesTo100[i];
        dx[j] = distancesTo100[j];
        dx[k] = distancesTo100[k];
        let distanceSum = dx[0] + dx[1] + dx[2] + dx[3] + dx[4] + dx[5];
        if (distanceSum <= 65) {
          combos3x100.push([i, j, k]);

          for (let l = k + 1; l < 6; l++) {
            let dy = dx.slice();
            dy[l] = distancesTo100[l];
            let distanceSum = dy[0] + dy[1] + dy[2] + dy[3] + dy[4] + dy[5];
            if (distanceSum <= 65) {
              combos4x100.push([i, j, k, l]);
            }
          }
        }
      }
    }
  }
  if (combos3x100.length > 0) {
    // now validate the combos using get_mods_precalc with optimize=false
    for (let combo of combos3x100) {
      const newDistances = distances.slice();
      for (let i of combo) {
        newDistances[i] = distancesTo100[i];
      }
      const mods = get_mods_precalc(
        config,
        newDistances,
        [0, 0, 0, 0, 0, 0],
        availableArtificeCount,
        availableModCost,
        ModOptimizationStrategy.None
      );
      if (mods != null) {
        runtime.statCombo3x100.add((1 << combo[0]) + (1 << combo[1]) + (1 << combo[2]));
      }
    }
    // now validate the combos using get_mods_precalc with optimize=false
    for (let combo of combos4x100) {
      const newDistances = distances.slice();
      for (let i of combo) {
        newDistances[i] = distancesTo100[i];
      }
      const mods = get_mods_precalc(
        config,
        newDistances,
        [0, 0, 0, 0, 0, 0],
        availableArtificeCount,
        availableModCost,
        ModOptimizationStrategy.None
      );
      if (mods != null) {
        runtime.statCombo4x100.add(
          (1 << combo[0]) + (1 << combo[1]) + (1 << combo[2]) + (1 << combo[3])
        );
      }
    }
  }
  //*/
  //#################################################################################
  // END OF 3x100 and 4x100 optimization
  //#################################################################################
  //#endregion

  //#region Tier Availability Testing
  //#################################################################################
  // Tier Availability Testing
  //#################################################################################
  //*
  for (let stat = 0; stat < 6; stat++) {
    if (runtime.maximumPossibleTiers[stat] < stats[stat]) {
      runtime.maximumPossibleTiers[stat] = stats[stat];
    }

    if (exoticmaximumPossibleTiers[stat] < stats[stat]) {
      exoticmaximumPossibleTiers[stat] = stats[stat];
    }

    const oldDistance = distances[stat];
    for (
      let tier = 10;
      tier >= config.minimumStatTiers[stat as ArmorStat].value &&
      tier > runtime.maximumPossibleTiers[stat] / 10;
      tier--
    ) {
      if (stats[stat] >= tier * 10) break;
      const v = 10 - (stats[stat] % 10);
      distances[stat] = Math.max(v < 10 ? v : 0, tier * 10 - stats[stat]);
      const mods = get_mods_precalc(
        config,
        distances,
        [0, 0, 0, 0, 0, 0],
        availableArtificeCount,
        availableModCost,
        ModOptimizationStrategy.None
      );
      //const mods = null;
      if (mods != null) {
        runtime.maximumPossibleTiers[stat] = tier * 10;
        exoticmaximumPossibleTiers[stat] = tier * 10;
        break;
      }
    }
    distances[stat] = oldDistance;
  }
  if (exoticHash != 0)
    runtime.maximumExoticPossibleTiers.set(exoticHash, exoticmaximumPossibleTiers);
  //console.debug("b "+runtime.maximumPossibleTiers,n)
  //console.warn(n)
  //*/
  //#################################################################################
  // END OF Tier Availability Testing
  //#################################################################################

  //#endregion

  if (doNotOutput) return [];

  const usedArtifice = result.filter((d) => 0 == d % 3);
  const usedMods = result.filter((d) => 0 != d % 3);

  for (let statModifier of result) {
    const stat = Math.floor((statModifier - 1) / 3);
    stats[stat] += STAT_MOD_VALUES[statModifier][1];
  }
  const waste1 = getWaste(stats);
  if (config.onlyShowResultsWithNoWastedStats && waste1 > 0) return null;

  return createArmorSet(
    helmet,
    gauntlet,
    chest,
    leg,
    usedArtifice,
    usedMods,
    stats,
    statsWithoutMods
  );
}

function get_mods_precalc(
  config: BuildConfiguration,
  distances: number[],
  optionalDistances: number[],
  availableArtificeCount: number,
  availableModCost: number[],
  optimize: ModOptimizationStrategy = ModOptimizationStrategy.None
): StatModifier[] | null {
  // check distances <= 65
  if (distances[0] + distances[1] + distances[2] + distances[3] + distances[4] + distances[5] > 65)
    return null;

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
  if (config.allowExactStats) {
    for (let i = 0; i < 6; i++) {
      if (config.minimumStatTiers[i as ArmorStat].fixed && distances[i] > 0) {
        precalculatedMods[i] = precalculatedZeroWasteModCombinations[distances[i]] || [
          [0, 0, 0, 0],
        ];
        // and now also remove every solution with >= 10 points of "overshoot"
        precalculatedMods[i] = precalculatedMods[i].filter((d) => d[3] - distances[i] < 10);
      }
    }
  }

  // add optional distances to the precalculated mods
  const limit = 3;
  for (let i = 0; i < optionalDistances.length; i++) {
    if (optionalDistances[i] > 0) {
      const additionalCombosA = modCombinations[optionalDistances[i]];
      if (additionalCombosA != null) {
        precalculatedMods[i] = additionalCombosA.slice(0, limit).concat(precalculatedMods[i]);
      }
    }
  }
  let bestMods: any = null;
  let bestScore = 1000;

  const availableModCostLen = availableModCost.length;
  const minAvailableModCost = availableModCost[availableModCostLen - 1];

  // const maxAvailableModCost = availableModCost[0];

  function validateMods(usedModCost: number[]): boolean {
    let usedModCount = usedModCost.length;
    if (usedModCount == 0) return true;
    if (usedModCount > availableModCostLen) return false;
    // sort usedMods ascending
    usedModCost.sort((a, b) => b - a);
    // check if the usedMods are valid
    // substract the usedMods from the availableMods, start at the highest cost
    for (let i = 0; i < availableModCost.length && i < usedModCount; i++) {
      if (availableModCost[i] < usedModCost[i]) return false;
    }

    return true;
  }

  const costMinor = [1, 2, 2, 1, 2, 1];
  const costMajor = [3, 4, 4, 3, 4, 3];

  function score(entries: [number, number, number, number][]) {
    if (optimize == ModOptimizationStrategy.ReduceUsedModSockets) {
      const n1 = entries.reduce((a, b) => a + b[1] + b[2], 0);
      return n1;
    } else if (optimize == ModOptimizationStrategy.ReduceUsedModPoints) {
      return entries.reduce(
        (a, b, currentIndex) => a + costMinor[currentIndex] * b[1] + costMajor[currentIndex] * b[2],
        0
      );
    }
    return entries.reduce((a, b) => a + b[3], 0);
  }

  function validate(
    entries: [number, number, number, number][],
    alsoValidateMods = false
  ): boolean {
    // sum up the stats
    const sum = entries.reduce(
      (a, b, i) => [a[0] + b[0], a[1] + b[1], a[2] + b[2], a[3] + b[3] - distances[i]],
      [0, 0, 0, 0]
    );

    if (score(entries) > bestScore) return false;
    if (sum[0] > availableArtificeCount) return false;
    if (sum[1] + sum[2] > availableModCostLen) return false;
    if (sum[3] < 0) return false;

    // test availableModCosts
    // the used mods translate as follows:
    // entries[0], entries[3] and entries[5]: minor 1, major 3
    // entries[1], entries[2] and entries[4]: minor 2, major 4

    if (!alsoValidateMods || minAvailableModCost == 5) return true;

    let usedModCost: number[] = [];
    for (let statIdx = 0; statIdx < entries.length; statIdx++) {
      const entry = entries[statIdx];
      const isSmallMod = statIdx == 0 || statIdx == 3 || statIdx == 5;
      let minorModCost = isSmallMod ? 1 : 2;
      let majorModCost = isSmallMod ? 3 : 4;

      for (let minor = 0; minor < entry[1]; minor++) usedModCost.push(minorModCost);
      for (let major = 0; major < entry[2]; major++) usedModCost.push(majorModCost);
    }

    if (usedModCost.length == 0) return true;
    if (!validateMods(usedModCost)) return false;

    return true;
  }

  const mustExecuteOptimization = optimize != ModOptimizationStrategy.None;
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

              if (!validate(mods, true)) continue;

              const sum = mods.reduce(
                (a, b, i) => [a[0] + b[0], a[1] + b[1], a[2] + b[2], a[3] + b[3] - distances[i]],
                [0, 0, 0, 0]
              );

              if (sum[3] < 0) continue; // did not reach the target
              if (sum[0] > availableArtificeCount) continue;
              if (sum[0] == 0 && sum[1] == 0 && sum[2] == 0 && sum[3] == 0) continue;

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
    Math.floor(Math.min(100, stats[ArmorStat.Mobility]) / 10) +
    Math.floor(Math.min(100, stats[ArmorStat.Resilience]) / 10) +
    Math.floor(Math.min(100, stats[ArmorStat.Recovery]) / 10) +
    Math.floor(Math.min(100, stats[ArmorStat.Discipline]) / 10) +
    Math.floor(Math.min(100, stats[ArmorStat.Intellect]) / 10) +
    Math.floor(Math.min(100, stats[ArmorStat.Strength]) / 10)
  );
}

export function getWaste(stats: number[]) {
  return (
    (stats[ArmorStat.Mobility] > 100
      ? stats[ArmorStat.Mobility] - 100
      : stats[ArmorStat.Mobility] % 10) +
    (stats[ArmorStat.Resilience] > 100
      ? stats[ArmorStat.Resilience] - 100
      : stats[ArmorStat.Resilience] % 10) +
    (stats[ArmorStat.Recovery] > 100
      ? stats[ArmorStat.Recovery] - 100
      : stats[ArmorStat.Recovery] % 10) +
    (stats[ArmorStat.Discipline] > 100
      ? stats[ArmorStat.Discipline] - 100
      : stats[ArmorStat.Discipline] % 10) +
    (stats[ArmorStat.Intellect] > 100
      ? stats[ArmorStat.Intellect] - 100
      : stats[ArmorStat.Intellect] % 10) +
    (stats[ArmorStat.Strength] > 100
      ? stats[ArmorStat.Strength] - 100
      : stats[ArmorStat.Strength] % 10)
  );
}
