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
import { IInventoryArmor, InventoryArmorSource, isEqualItem } from "../data/types/IInventoryArmor";
import { buildDb } from "../data/database";
import { ArmorSlot } from "../data/enum/armor-slot";
import { FORCE_USE_NO_EXOTIC, FORCE_USE_ANY_EXOTIC } from "../data/constants";
import { ModInformation } from "../data/ModInformation";
import {
  ArmorPerkOrSlot,
  ArmorStat,
  SpecialArmorStat,
  STAT_MOD_VALUES,
  StatModifier,
} from "../data/enum/armor-stat";
import { IManifestArmor } from "../data/types/IManifestArmor";
import {
  DestinyItemInvestmentStatDefinition,
  DestinyItemSocketState,
  TierType,
} from "bungie-api-ts/destiny2";
import { environment } from "../../environments/environment";

import { precalculatedZeroWasteModCombinations } from "../data/generated/precalculatedZeroWasteModCombinations";
import { precalculatedModCombinations } from "../data/generated/precalculatedModCombinations";

const db = buildDb(async () => {});
const inventoryArmor = db.table("inventoryArmor");
const manifestArmor = db.table("manifestArmor");

function checkSlots(
  config: BuildConfiguration,
  constantModslotRequirement: number[],
  availableClassItemTypes: Set<ArmorPerkOrSlot>,
  helmet: IInventoryArmor,
  gauntlet: IInventoryArmor,
  chest: IInventoryArmor,
  leg: IInventoryArmor
) {
  var exoticId = config.selectedExotics[0] || 0;
  let requirements = constantModslotRequirement.slice();
  if (
    (exoticId <= 0 || helmet.hash != exoticId) &&
    config.armorPerks[ArmorSlot.ArmorSlotHelmet].fixed &&
    config.armorPerks[ArmorSlot.ArmorSlotHelmet].value != ArmorPerkOrSlot.None &&
    config.armorPerks[ArmorSlot.ArmorSlotHelmet].value != helmet.perk
  )
    return { valid: false };
  if (
    (exoticId <= 0 || gauntlet.hash != exoticId) &&
    config.armorPerks[ArmorSlot.ArmorSlotGauntlet].fixed &&
    config.armorPerks[ArmorSlot.ArmorSlotGauntlet].value != ArmorPerkOrSlot.None &&
    config.armorPerks[ArmorSlot.ArmorSlotGauntlet].value != gauntlet.perk
  )
    return { valid: false };
  if (
    (exoticId <= 0 || chest.hash != exoticId) &&
    config.armorPerks[ArmorSlot.ArmorSlotChest].fixed &&
    config.armorPerks[ArmorSlot.ArmorSlotChest].value != ArmorPerkOrSlot.None &&
    config.armorPerks[ArmorSlot.ArmorSlotChest].value != chest.perk
  )
    return { valid: false };
  if (
    (exoticId <= 0 || leg.hash != exoticId) &&
    config.armorPerks[ArmorSlot.ArmorSlotLegs].fixed &&
    config.armorPerks[ArmorSlot.ArmorSlotLegs].value != ArmorPerkOrSlot.None &&
    config.armorPerks[ArmorSlot.ArmorSlotLegs].value != leg.perk
  )
    return { valid: false };
  // also return if we can not find the correct class item. pepepoint.
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

  // ignore exotic selection
  if (exoticId > 0) {
    if (helmet.hash == exoticId) requirements[config.armorPerks[helmet.slot].value]--;
    else if (gauntlet.hash == exoticId) requirements[config.armorPerks[gauntlet.slot].value]--;
    else if (chest.hash == exoticId) requirements[config.armorPerks[chest.slot].value]--;
    else if (leg.hash == exoticId) requirements[config.armorPerks[leg.slot].value]--;
  }

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

addEventListener("message", async ({ data }) => {
  const startTime = Date.now();
  console.debug("START RESULTS BUILDER 2");
  console.time("total");
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

  let selectedExotics: IManifestArmor[] = await Promise.all(
    config.selectedExotics
      .filter((hash) => hash != FORCE_USE_NO_EXOTIC)
      .map(async (hash) => await manifestArmor.where("hash").equals(hash).first())
  );
  selectedExotics = selectedExotics.filter((i) => !!i);

  let items = (await inventoryArmor
    .where("clazz")
    .equals(config.characterClass)
    .distinct()
    .toArray()) as IInventoryArmor[];

  items = items
    // only armor :)
    .filter((item) => item.slot != ArmorSlot.ArmorSlotNone)
    // filter disabled items
    .filter((item) => config.disabledItems.indexOf(item.itemInstanceId) == -1)
    // filter collection/vendor rolls if not allowed
    .filter((item) => {
      switch (item.source) {
        case InventoryArmorSource.Collections:
          return config.includeCollectionRolls;
        case InventoryArmorSource.Vendor:
          return config.includeVendorRolls;
        default:
          return true;
      }
    })
    // filter the selected exotic right here
    .filter((item) => config.selectedExotics.indexOf(FORCE_USE_NO_EXOTIC) == -1 || !item.isExotic)
    .filter(
      (item) =>
        selectedExotics.length != 1 ||
        selectedExotics[0].slot != item.slot ||
        selectedExotics[0].hash == item.hash
    )
    // config.onlyUseMasterworkedItems - only keep masterworked items
    .filter((item) => !config.onlyUseMasterworkedItems || item.masterworked)
    // non-legendaries and non-exotics
    .filter(
      (item) =>
        config.allowBlueArmorPieces ||
        item.rarity == TierType.Exotic ||
        item.rarity == TierType.Superior
    )
    // sunset armor
    .filter((item) => !config.ignoreSunsetArmor || !item.isSunset)
    // armor perks
    .filter((item) => {
      return (
        item.isExotic ||
        !config.armorPerks[item.slot].fixed ||
        config.armorPerks[item.slot].value == ArmorPerkOrSlot.None ||
        config.armorPerks[item.slot].value == item.perk
      );
    });
  // console.log(items.map(d => "id:'"+d.itemInstanceId+"'").join(" or "))

  // Remove collection items if they are in inventory
  items = items.filter((item) => {
    if (item.source === InventoryArmorSource.Inventory) return true;

    const purchasedItemInstance = items.find(
      (rhs) => rhs.source === InventoryArmorSource.Inventory && isEqualItem(item, rhs)
    );

    // If this item is a collection/vendor item, ignore it if the player
    // already has a real copy of the same item.
    return purchasedItemInstance === undefined;
  });

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
  const threadSplit = data.threadSplit as { count: number; current: number };
  if (threadSplit.count > 1) {
    var splitEntry = (
      [
        [helmets, helmets.length],
        [gauntlets, gauntlets.length],
        [chests, chests.length],
        [legs, legs.length],
      ] as [IInventoryArmor[], number][]
    ).sort((a, b) => a[1] - b[1])[0][0];
    var keepLength = Math.floor(splitEntry.length / threadSplit.count);
    var startIndex = keepLength * threadSplit.current; // we can delete everything before this
    var endIndex = keepLength * (threadSplit.current + 1); // we can delete everything after this
    // if we have rounding issues, let the last thread do the rest
    if (
      keepLength * threadSplit.count != splitEntry.length &&
      threadSplit.current == threadSplit.count - 1
    )
      endIndex += splitEntry.length - keepLength * threadSplit.count;

    // remove data at the end
    splitEntry.splice(endIndex);
    splitEntry.splice(0, startIndex);
  }

  let classItems = items.filter((i) => i.slot == ArmorSlot.ArmorSlotClass);
  let availableClassItemPerkTypes = new Set(classItems.map((d) => d.perk));

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
    maximumPossibleTiers: [0, 0, 0, 0, 0, 0],
    statCombo3x100: new Set(),
    statCombo4x100: new Set(),
  };
  const constantBonus = prepareConstantStatBonus(config);
  const constantModslotRequirement = prepareConstantModslotRequirement(config);
  const constantAvailableModslots = prepareConstantAvailableModslots(config);
  const constHasOneExoticLength = selectedExotics.length <= 1;
  const hasArtificeClassItem = availableClassItemPerkTypes.has(ArmorPerkOrSlot.SlotArtifice);
  const requiresAtLeastOneExotic = config.selectedExotics.indexOf(FORCE_USE_ANY_EXOTIC) > -1;

  let results: any[] = [];
  let resultsLength = 0;

  let listedResults = 0;
  let totalResults = 0;
  let doNotOutput = false;

  console.time("tm");
  for (let helmet of helmets) {
    for (let gauntlet of gauntlets) {
      if (constHasOneExoticLength && helmet.isExotic && gauntlet.isExotic) continue;
      for (let chest of chests) {
        if (constHasOneExoticLength && (helmet.isExotic || gauntlet.isExotic) && chest.isExotic)
          continue;
        for (let leg of legs) {
          if (
            constHasOneExoticLength &&
            (helmet.isExotic || gauntlet.isExotic || chest.isExotic) &&
            leg.isExotic
          )
            continue;
          if (
            requiresAtLeastOneExotic &&
            !(helmet.isExotic || gauntlet.isExotic || chest.isExotic || leg.isExotic)
          )
            continue;
          /**
           *  At this point we already have:
           *  - Masterworked items, if they must be masterworked (config.onlyUseMasterworkedItems)
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
            if (result !== "DONOTSEND") {
              result["classItem"] = {
                perk:
                  slotCheckResult.requiredClassItemType ||
                  (hasArtificeClassItem ? ArmorPerkOrSlot.SlotArtifice : ArmorPerkOrSlot.None),
              };

              results.push(result);
              resultsLength++;
              listedResults++;
              doNotOutput =
                doNotOutput ||
                (config.limitParsedResults && listedResults >= 3e4 / threadSplit.count) ||
                listedResults >= 1e6 / threadSplit.count;
            }
          }
          if (resultsLength >= 5000) {
            // @ts-ignore
            postMessage({ runtime, results, done: false, total: 0 });
            results = [];
            resultsLength = 0;
          }
        }
      }
    }
  }
  console.timeEnd("tm");
  console.timeEnd("total");

  // @ts-ignore
  postMessage({
    runtime,
    results,
    done: true,
    stats: {
      permutationCount: totalResults,
      itemCount: items.length - classItems.length,
      totalTime: Date.now() - startTime,
    },
  });
});

function getStatSum(items: IInventoryArmor[]): [number, number, number, number, number, number] {
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
  runtime: any,
  config: BuildConfiguration,
  helmet: IInventoryArmor,
  gauntlet: IInventoryArmor,
  chest: IInventoryArmor,
  leg: IInventoryArmor,
  constantBonus: number[],
  availableModCost: number[],
  doNotOutput = false,
  hasArtificeClassItem = false
): any {
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

  // Abort here if we are already above the limit, in case of fixed stat tiers
  for (let n: ArmorStat = 0; n < 6; n++)
    if (config.minimumStatTiers[n].fixed && stats[n] / 10 >= config.minimumStatTiers[n].value + 1)
      return null;

  // get the amount of armor with artifice slot
  let availableArtificeCount = items.filter((d) => d.perk == ArmorPerkOrSlot.SlotArtifice).length;

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

  // if the sum of distances is > (10*5)+(3*artificeCount), we can abort here
  //const distanceSum = distances.reduce((a, b) => a + b, 0);
  const distanceSum =
    distances[0] + distances[1] + distances[2] + distances[3] + distances[4] + distances[5];
  if (distanceSum > 10 * 5 + 3 * availableArtificeCount) return null;

  let result: StatModifier[] | null;
  if (distanceSum == 0) result = [];
  else
    result = get_mods_precalc(
      config,
      distances,
      availableArtificeCount,
      availableModCost,
      config.executeModOptimization
    );

  if (result == null) return null;

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

  // find every combo of three stats which sum is less than 62; no duplicates
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
        if (distanceSum <= 62) {
          combos3x100.push([i, j, k]);

          for (let l = k + 1; l < 6; l++) {
            let dy = dx.slice();
            dy[l] = distancesTo100[l];
            let distanceSum = dy[0] + dy[1] + dy[2] + dy[3] + dy[4] + dy[5];
            if (distanceSum <= 62) {
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
        availableArtificeCount,
        availableModCost,
        false
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
        availableArtificeCount,
        availableModCost,
        false
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

  //#################################################################################
  // Tier Availability Testing
  //#################################################################################
  //*
  let n = 0;
  for (let stat = 0; stat < 6; stat++) {
    if (runtime.maximumPossibleTiers[stat] < stats[stat]) {
      runtime.maximumPossibleTiers[stat] = stats[stat];
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
      n++;
      const mods = get_mods_precalc(
        config,
        distances,
        availableArtificeCount,
        availableModCost,
        false
      );
      //const mods = null;
      if (mods != null) {
        runtime.maximumPossibleTiers[stat] = tier * 10;
        break;
      }
    }
    distances[stat] = oldDistance;
  }
  //console.debug("b "+runtime.maximumPossibleTiers,n)
  //console.warn(n)
  //*/
  //#################################################################################
  // END OF Tier Availability Testing
  //#################################################################################

  if (doNotOutput) return "DONOTSEND";

  const usedArtifice = result.filter((d) => 0 == d % 3);
  const usedMods = result.filter((d) => 0 != d % 3);

  for (let statModifier of result) {
    const stat = Math.floor((statModifier - 1) / 3);
    stats[stat] += STAT_MOD_VALUES[statModifier][1];
  }
  const waste1 = getWaste(stats);
  if (config.onlyShowResultsWithNoWastedStats && waste1 > 0) return null;

  const exotic = helmet.isExotic
    ? helmet
    : gauntlet.isExotic
    ? gauntlet
    : chest.isExotic
    ? chest
    : leg.isExotic
    ? leg
    : null;
  return {
    exotic:
      exotic == null
        ? []
        : [
            {
              icon: exotic?.icon,
              watermark: exotic?.watermarkIcon,
              name: exotic?.name,
              hash: exotic?.hash,
            },
          ],
    artifice: usedArtifice,
    modCount: usedMods.length,
    modCost: usedMods.reduce((p, d: StatModifier) => p + STAT_MOD_VALUES[d][2], 0),
    mods: usedMods,
    stats: stats,
    statsNoMods: statsWithoutMods,
    tiers: getSkillTier(stats),
    waste: waste1,
    items: items.reduce(
      (p: any, instance) => {
        p[instance.slot - 1].push({
          energyLevel: instance.energyLevel,
          hash: instance.hash,
          itemInstanceId: instance.itemInstanceId,
          name: instance.name,
          exotic: !!instance.isExotic,
          masterworked: instance.masterworked,
          mayBeBugged: instance.mayBeBugged,
          slot: instance.slot,
          perk: instance.perk,
          transferState: 0, // TRANSFER_NONE
          stats: [
            instance.mobility,
            instance.resilience,
            instance.recovery,
            instance.discipline,
            instance.intellect,
            instance.strength,
          ],
          source: instance.source,
        });
        return p;
      },
      [[], [], [], []]
    ),
  };
}

function get_mods_precalc(
  config: BuildConfiguration,
  distances: number[],
  availableArtificeCount: number,
  availableModCost: number[],
  optimize: boolean = true
): StatModifier[] | null {
  // check distances <= 62
  if (distances[0] + distances[1] + distances[2] + distances[3] + distances[4] + distances[5] > 62)
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

  // we have six stats with possible mod usage
  // we have to build every possible combination of mods and check if it is possible and if it is better than the current best

  let bestUsedPoints = 1000;
  let bestMods: any = [];

  const availableModCostLen = availableModCost.length;
  const minAvailableModCost = availableModCost[availableModCostLen - 1];
  const maxAvailableModCost = availableModCost[0];

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

  function validate(
    entries: [number, number, number, number][],
    alsoValidateMods = false
  ): boolean {
    // sum up the stats
    const sum = entries.reduce(
      (a, b, i) => [a[0] + b[0], a[1] + b[1], a[2] + b[2], a[3] + b[3] - distances[i]],
      [0, 0, 0, 0]
    );

    if (sum[3] > bestUsedPoints) return false;
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

  root: for (let mobility of precalculatedMods[0]) {
    if (!validate([mobility])) continue;
    for (let resilience of precalculatedMods[1]) {
      if (!validate([mobility, resilience])) continue;
      for (let recovery of precalculatedMods[2]) {
        if (!validate([mobility, resilience, recovery])) continue;
        for (let discipline of precalculatedMods[3]) {
          if (!validate([mobility, resilience, recovery, discipline])) continue;
          for (let intellect of precalculatedMods[4]) {
            if (!validate([mobility, resilience, recovery, discipline, intellect])) continue;
            for (let strength of precalculatedMods[5]) {
              let mods = [mobility, resilience, recovery, discipline, intellect, strength];

              if (!validate(mods, true)) continue;

              const sum = mods.reduce(
                (a, b, i) => [a[0] + b[0], a[1] + b[1], a[2] + b[2], a[3] + b[3] - distances[i]],
                [0, 0, 0, 0]
              );

              if (sum[3] < 0) continue; // did not reach the target
              if (sum[0] > availableArtificeCount) continue;
              if (sum[0] == 0 && sum[1] == 0 && sum[2] == 0 && sum[3] == 0) continue;

              const waste = sum[3];
              if (waste < bestUsedPoints) {
                //console.log("New best waste: " + waste, "Mods: " + mods, "Sum: " + sum, "Distances: " + distances)
                bestUsedPoints = waste;
                bestMods = mods;

                if (!optimize) break root;
              }
            }
          }
        }
      }
    }
  }

  if (bestUsedPoints === 1000) return null;

  const usedMods = [];
  for (let i = 0; i < bestMods.length; i++) {
    for (let n = 0; n < bestMods[i][0]; n++) usedMods.push(3 + 3 * i);
    for (let n = 0; n < bestMods[i][1]; n++) usedMods.push(1 + 3 * i);
    for (let n = 0; n < bestMods[i][2]; n++) usedMods.push(2 + 3 * i);
  }

  return usedMods;
}

function getSkillTier(stats: number[]) {
  return (
    Math.floor(Math.min(100, stats[ArmorStat.Mobility]) / 10) +
    Math.floor(Math.min(100, stats[ArmorStat.Resilience]) / 10) +
    Math.floor(Math.min(100, stats[ArmorStat.Recovery]) / 10) +
    Math.floor(Math.min(100, stats[ArmorStat.Discipline]) / 10) +
    Math.floor(Math.min(100, stats[ArmorStat.Intellect]) / 10) +
    Math.floor(Math.min(100, stats[ArmorStat.Strength]) / 10)
  );
}

function getWaste(stats: number[]) {
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
