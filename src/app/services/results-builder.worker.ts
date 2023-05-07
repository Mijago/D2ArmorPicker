import { BuildConfiguration } from "../data/buildConfiguration";
import { IInventoryArmor } from "../data/types/IInventoryArmor";
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
import { TierType } from "bungie-api-ts/destiny2";
import { environment } from "../../environments/environment";

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
  return availableModCost.filter((d) => d > 0).sort();
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

class OrderedList<T> {
  public list: T[] = [];
  // this list contains the comparator values for each entry
  private comparatorList: number[] = [];
  public length = 0;

  private comparator: (d: T) => number;

  constructor(comparator: (d: T) => number) {
    this.comparator = comparator;
  }

  public insert(value: T) {
    let compVal = this.comparator(value);
    let i;
    for (i = 0; i < this.list.length; i++) {
      if (this.comparatorList[i] > compVal) continue;
      break;
    }
    this.length++;
    this.list.splice(i, 0, value);
    this.comparatorList.splice(i, 0, compVal);
  }

  public remove(value: T) {
    let idx = -1;
    for (let i = 0; i < this.list.length; i++) {
      if (this.list[i] == value) {
        idx = i;
        break;
      }
    }
    if (idx != -1) {
      this.list.splice(idx, 1);
      this.comparatorList.splice(idx, 1);
      this.length--;
    }
    return idx != -1;
  }
}

/**
 * Returns null, if the permutation is invalid.
 * This code does not utilize fancy filters and other stuff.
 * This results in ugly code BUT it is way way WAY faster!
 */
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
  availableModCost = availableModCost.slice().sort((a, b) => a - b); // sort array

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

  //let log = {error: console.error, info: console.info, debug: console.debug}
  //log = {error: () => { }, info: () => { }, debug: () => { }}

  // get the amount of armor with artifice slot
  let availableArtificeCount = items.filter((d) => d.perk == ArmorPerkOrSlot.SlotArtifice).length;

  if (hasArtificeClassItem) availableArtificeCount += 1;

  const usedMods: OrderedList<StatModifier> = new OrderedList<StatModifier>(
    (d) => STAT_MOD_VALUES[d][2]
  );
  const usedArtifice: number[] = [];

  // log.debug("base stats", stats)
  // log.debug("target stats", Object.values(config.minimumStatTiers).map(d => d.value * 10))
  // log.debug("available artifice:", availableArtificeCount)

  const usedModslot = [-1, -1, -1, -1, -1];
  let fixLimit = 15;

  for (let stat = 0; stat < 6; stat++) {
    // log.debug("stat loop", stat, "usedmods", usedMods.list, "usedartifice", usedArtifice)
    let distance = config.minimumStatTiers[stat as ArmorStat].value * 10 - stats[stat];
    while (distance > 0) {
      // log.debug("distance loop", stat, distance, "usedmods", usedMods.list, "usedModslot", usedModslot, "usedartifice", usedArtifice)
      const modulo = distance % 10;
      if (modulo > 0 && modulo <= 3 && availableArtificeCount > 0) {
        // initial artifice artifice mod
        usedArtifice.push((stat * 3 + 3) as StatModifier);
        availableArtificeCount--;
        stats[stat] += 3;
        distance -= 3;

        // log.debug(stat, "+", "artifice", "(" + availableArtificeCount + " left)", "| stat:", stats[stat])
        continue;
      }
      if (modulo > 0 && modulo <= 5) {
        // initial minor
        const minorCost = STAT_MOD_VALUES[(stat * 3 + 1) as StatModifier][2];
        let minorIdx = availableModCost.findIndex((d, i) => d >= minorCost && usedModslot[i] == -1);
        if (minorIdx > -1) {
          usedMods.insert((stat * 3 + 1) as StatModifier);
          usedModslot[minorIdx] = (stat * 3 + 1) as StatModifier;
          stats[stat] += 5;
          distance -= 5;
          // log.debug(stat, "+", "minor1", "(" + (5 - usedMods.length) + " left)", "| stat:", stats[stat], usedModslot)
          continue;
        } else if (fixLimit > 0 && stat > 0) {
          // check if there is an used artifice mod that can be replaced by a minor mod
          let possibleIdx = usedArtifice.findIndex((d, i) => {
            // only look to the left
            if (d / 3 - 1 >= stat) return false;
            const minorCostAr = STAT_MOD_VALUES[(d - 2) as StatModifier][2];
            return (
              availableModCost.findIndex((d, i) => d >= minorCostAr && usedModslot[i] == -1) > -1
            );
          });
          if (possibleIdx > -1) {
            const otherStat = usedArtifice[possibleIdx] / 3 - 1;
            // set the artifice mod
            usedArtifice[possibleIdx] = (stat * 3 + 3) as StatModifier;
            stats[otherStat] -= 3;
            stats[stat] += 3;
            // introduce a fix limit to prevent infinite loops
            fixLimit -= 1;
            // log.debug(stat, "~", "artifice", "(" + availableArtificeCount + " left)", "| stat:", stats[stat], "| swapped with", otherStat)
            // restart the loop. this allows the algo to re-shift artifice
            // the break stops the internal loop
            // by setting the stat to -1, we force it to start at the changed stat in the next iteration
            stat = otherStat - 1;
            break;
          }
        }
      }

      // see if we can add TWO artifice mods
      if (availableArtificeCount > 1 && distance % 10 <= 6 && distance % 10 > 3) {
        // initial artifice artifice mod
        usedArtifice.push((stat * 3 + 3) as StatModifier);
        usedArtifice.push((stat * 3 + 3) as StatModifier);
        availableArtificeCount -= 2;
        stats[stat] += 6;
        distance -= 6;

        // log.debug(stat, "+", "artifice", "(" + (availableArtificeCount + 1) + " left)", "| stat:", stats[stat] - 3)
        // log.debug(stat, "+", "artifice", "(" + availableArtificeCount + " left)", "| stat:", stats[stat])
        continue;
      }

      // find valid slots for major mods
      const majorCost = STAT_MOD_VALUES[(stat * 3 + 2) as StatModifier][2];
      let majorIdx = availableModCost.findIndex(
        (d, idx) => d >= majorCost && usedModslot[idx] == -1
      );
      if (majorIdx > -1 && distance > 5) {
        usedMods.insert((stat * 3 + 2) as StatModifier);
        usedModslot[majorIdx] = (stat * 3 + 2) as StatModifier;
        stats[stat] += 10;
        distance -= 10;

        // log.debug(stat, "+", "major", "(" + (5 - usedMods.length) + " left)", "| stat:", stats[stat], usedModslot)

        continue;
      }
      const minorCost = STAT_MOD_VALUES[(stat * 3 + 1) as StatModifier][2];
      let minorIdx = availableModCost.findIndex((d, i) => d >= minorCost && usedModslot[i] == -1);
      if (minorIdx > -1) {
        usedMods.insert((stat * 3 + 1) as StatModifier);
        usedModslot[minorIdx] = (stat * 3 + 1) as StatModifier;
        stats[stat] += 5;
        distance -= 5;

        // log.debug(stat, "+", "minor2", "(" + (5 - usedMods.length) + " left)", "| stat:", stats[stat], usedModslot)
        continue;
      }

      // if we CAN NOT reach the target with artifice alone, we look for
      // a minor mod that we can replace with a major mod
      const artificeId = (stat * 3 + 3) as StatModifier;
      if (availableArtificeCount > 0 && distance > 3 * availableArtificeCount) {
        // find our minor mod in the usedModslot
        const minorIdx = usedModslot.findIndex((d, i) => d == ((stat * 3 + 1) as StatModifier));
        if (minorIdx > -1) {
          // we can replace this with a major mod
          usedModslot[minorIdx] = stat * 3 + 2;

          usedMods.remove((stat * 3 + 1) as StatModifier);
          usedMods.insert((stat * 3 + 2) as StatModifier);

          stats[stat] += 5;
          distance -= 5;
          // log.debug(stat, "~", "major3", "(" + (5 - usedMods.length) + " left)", "| stat:", stats[stat], "| swapped from minor", usedModslot, "minorIdx")
          continue;
        }
      }
      // also check if there is a minor mod in another stat that we can replace with two artifice mods
      const otherMinorIdx = usedModslot.findIndex((d, i) => {
        return (
          d % 3 == 1 && d != ((stat * 3 + 1) as StatModifier) && availableModCost[i] >= minorCost
        );
      });
      if (otherMinorIdx > -1 && availableArtificeCount > 1) {
        const otherStat = (usedModslot[otherMinorIdx] - 1) / 3;
        // set the artifice mod
        usedArtifice.push((otherStat * 3 + 3) as StatModifier);
        usedArtifice.push((otherStat * 3 + 3) as StatModifier);
        availableArtificeCount -= 2;
        stats[otherStat] += 1;

        // remove the minor mod
        usedMods.remove(usedModslot[otherMinorIdx]);
        usedModslot[otherMinorIdx] = -1;
        // log.debug(stat, "~", "rem", "(" + (5 - usedMods.length) + " left)", "| stat:", stats[stat], "| replaced a minor with two artifice in stat", otherStat, usedModslot)
        continue;
      }

      // check if we can replace a major mod with three artifice mods somewhere else so we have one more here
      if (fixLimit > 0) {
        // see if somewhere are two artifice mods that I can replace with a minor mod for myself
        let swapArtificeId = usedArtifice
          .reduce(
            (p, b) => {
              const stat = (b - 3) / 3;
              p[stat]++;
              return p;
            },
            [0, 0, 0, 0, 0, 0]
          )
          .findIndex((k, i) => {
            const otherStat = i;
            if (k < 2) return false;
            if (stats[otherStat] % 10 == 0) return false;
            const otherMinorCost = STAT_MOD_VALUES[(otherStat * 3 + 1) as StatModifier][2];
            return (
              k > 2 &&
              i != artificeId &&
              availableModCost.findIndex((d, i) => d >= otherMinorCost && usedModslot[i] == -1) > -1
            );
          });
        if (swapArtificeId > -1) {
          // replace two artifice mods from otherStat with one minor mod
          const otherStat = swapArtificeId;
          const otherMinorCost = STAT_MOD_VALUES[(otherStat * 3 + 1) as StatModifier][2];
          const minorIdx = availableModCost.findIndex(
            (d, i) => d >= otherMinorCost && usedModslot[i] == -1
          );

          usedArtifice.splice(
            usedArtifice.findIndex((k) => otherStat * 3 + 3),
            1
          );
          usedArtifice.splice(
            usedArtifice.findIndex((k) => otherStat * 3 + 3),
            1
          );
          stats[otherStat] -= 6;
          availableArtificeCount += 2;
          // log.debug(otherStat, "-", "artifice", "(" + (availableArtificeCount + 1) + " left)", "| stat:", stats[otherStat] + 3, "removed for major mod by", stat)
          // log.debug(otherStat, "-", "artifice", "(" + availableArtificeCount + " left)", "| stat:", stats[otherStat], "removed for major mod by", stat)

          // add the minor mod
          usedMods.insert((otherStat * 3 + 1) as StatModifier);
          usedModslot[minorIdx] = (otherStat * 3 + 1) as StatModifier;
          stats[otherStat] += 5;
          // log.debug(otherStat, "+", "minor4", "(" + (5 - usedMods.length) + " left)", "| stat:", stats[otherStat], usedModslot)
          fixLimit--;
          continue;
        }

        //*
        // check if somewhere else are three artifice mods that I can replace with a major mod
        swapArtificeId = usedArtifice
          .reduce(
            (p, b) => {
              const stat = (b - 3) / 3;
              p[stat]++;
              return p;
            },
            [0, 0, 0, 0, 0, 0]
          )
          .findIndex((k, i) => {
            if (k < 3) return false;
            const otherStat = i;
            // TODO: if fixed stats, make sure this is not 9 or we increase the tier
            //if (stats[otherStat] % 10 == 9) return false;
            const otherMajorCost = STAT_MOD_VALUES[(otherStat * 3 + 2) as StatModifier][2];
            return (
              i != artificeId &&
              availableModCost.findIndex((d, i) => d >= otherMajorCost && usedModslot[i] == -1) > -1
            );
          });
        if (swapArtificeId > -1) {
          // replace two artifice mods from otherStat with one minor mod
          const otherStat = swapArtificeId;
          const otherMajorCost = STAT_MOD_VALUES[(otherStat * 3 + 2) as StatModifier][2];
          const majorIdx = availableModCost.findIndex(
            (d, i) => d >= otherMajorCost && usedModslot[i] == -1
          );

          usedArtifice.splice(
            usedArtifice.findIndex((k) => k == otherStat * 3 + 3),
            1
          );
          usedArtifice.splice(
            usedArtifice.findIndex((k) => k == otherStat * 3 + 3),
            1
          );
          usedArtifice.splice(
            usedArtifice.findIndex((k) => k == otherStat * 3 + 3),
            1
          );
          stats[otherStat] -= 9;
          availableArtificeCount += 3;
          // log.debug(otherStat, "-", "artifice", "(" + (availableArtificeCount + 2) + " left)", "| stat:", stats[otherStat] + 6, "removed for major mod by", stat)
          // log.debug(otherStat, "-", "artifice", "(" + (availableArtificeCount + 1) + " left)", "| stat:", stats[otherStat] + 3, "removed for major mod by", stat)
          // log.debug(otherStat, "-", "artifice", "(" + availableArtificeCount + " left)", "| stat:", stats[otherStat], "removed for major mod by", stat)

          // add the major mod
          usedMods.insert((otherStat * 3 + 2) as StatModifier);
          usedModslot[majorIdx] = (otherStat * 3 + 2) as StatModifier;
          stats[otherStat] += 10;
          // log.debug(otherStat, "+", "major", "(" + (5 - usedMods.length) + " left)", "| stat:", stats[otherStat], usedModslot)

          fixLimit--;
          continue;
        }
      }
      //*/

      // check if I can replace a major mod with minor+artifice
      if (fixLimit > 0 && availableArtificeCount > 0) {
        // find major mod that can be replaced with minor+artifice (so %10>2)
        const majorIdx = usedModslot.findIndex((d, i) => {
          if (d % 3 != 2) return false;
          const otherStat = STAT_MOD_VALUES[d as StatModifier][0];
          if (stat == otherStat) return false;
          if (stats[otherStat] % 10 < 2) return false;
          return true;
        });
        if (majorIdx > -1) {
          // remove the major mod, add artifice
          // then set the stat and continue the loop
          const otherStat = STAT_MOD_VALUES[usedModslot[majorIdx] as StatModifier][0];

          usedMods.remove(usedModslot[majorIdx]);
          usedModslot[majorIdx] = -1;

          usedArtifice.push(otherStat * 3 + 3);
          availableArtificeCount--;
          stats[otherStat] -= 10;
          stats[otherStat] += 3;

          // log.debug(otherStat, "X", "major", "(" + (5 - usedMods.length) + " left)", "| stat:", stats[otherStat], "removed for artifice by", stat, "fixLimit:", fixLimit)
          fixLimit -= 1;

          stat = otherStat - 1;
          break;
        }
      }

      // artifice
      if (availableArtificeCount > 0) {
        usedArtifice.push(artificeId);
        availableArtificeCount--;
        stats[stat] += 3;
        distance -= 3;
        // log.debug(stat, "+", "artifice", "(" + availableArtificeCount + " left)", "| stat:", stats[stat])
        continue;
      }

      // validate if we can shove around some artifice for a major
      if (fixLimit > 0) {
        const hasAvailableSlotIdx = usedModslot.findIndex((d, i) => {
          if (d != -1) return false;
          return availableModCost[i] >= majorCost;
        });
        // find a minor mod in the usedModslot and replace it with a major
        const minorIdx = usedModslot.findIndex((d, i) => {
          if (d != stat * 3 + 1) return false;

          if (hasAvailableSlotIdx > -1) return true;
          return availableModCost[i] >= majorCost;
        });
        if (minorIdx > -1) {
          // log.debug(" NIJDAHBGIUOSGOU", "usedMods", usedMods.list, "hasAvailableSlotIdx", hasAvailableSlotIdx)
          // we can replace this with a major mod

          if (hasAvailableSlotIdx > -1) {
            usedModslot[hasAvailableSlotIdx] = (stat * 3 + 2) as StatModifier;
            usedModslot[minorIdx] = -1;
          } else {
            usedModslot[minorIdx] = (stat * 3 + 2) as StatModifier;
          }

          usedMods.remove((stat * 3 + 1) as StatModifier);
          usedMods.insert((stat * 3 + 2) as StatModifier);

          stats[stat] += 5;
          distance -= 5;
          // log.debug(stat, "~", "major", "(" + (5 - usedMods.length) + " left)", "| stat:", stats[stat], "| swapped from minor 2", usedModslot, "minorIdx")
          continue;
        }

        const x = usedArtifice.filter((k) => k == artificeId).length;
        if (x >= 3 && stats[stat] % 10 == 9) {
          // we can replace this with a major mod

          // find a slot on another mod that is %10>0
          // that means we can add +3/6/9 to it and still bring it to the next tier, while freeing a modslot
          const possibleIdx = availableModCost.findIndex((d, i) => {
            if (usedModslot[i] == -1) return false; // only used slots
            const otherStat = STAT_MOD_VALUES[usedModslot[i] as StatModifier][0];
            if (otherStat == stat) return false; // not the same stat ofc
            if (d < majorCost) return false;
            if (config.minimumStatTiers[otherStat].fixed)
              return (
                stats[otherStat] % 10 > 0 &&
                (stats[otherStat] % 10 == 1 ||
                  stats[otherStat] % 10 == 4 ||
                  stats[otherStat] % 10 == 7)
              );
            else return stats[otherStat] % 10 > 0;
          });
          if (possibleIdx > -1) {
            const cstat = STAT_MOD_VALUES[usedModslot[possibleIdx] as StatModifier][0];

            stats[cstat] -= 10;
            stats[stat] += 10;
            // remove the artifice mods
            for (let n = 0; n < 3; n++) {
              const idx = usedArtifice.findIndex((d) => d == artificeId);
              usedArtifice.splice(idx, 1);
              availableArtificeCount += 1;
              stats[stat] -= 3;

              if (n == 0 || stats[cstat] % 10 > 2) {
                stats[cstat] += 3;
                usedArtifice.push((3 * cstat + 3) as StatModifier);
                availableArtificeCount -= 1;
              }
            }

            // now we overwrite the modslot with a major mod for the current stat
            usedMods.remove(usedModslot[possibleIdx]);
            usedMods.insert((stat * 3 + 2) as StatModifier);
            usedModslot[possibleIdx] = (stat * 3 + 2) as StatModifier;

            distance -= 1;

            // introduce a fix limit to prevent infinite loops
            fixLimit -= 1;

            //stat = cstat-1;
            continue;
          }
        }
      }

      // log.info("ABORT", "stat: " + stat, "distance: " + distance, "fixLimit: " + fixLimit)
      // log.info("stats:\t" + stats)
      // log.info("mods:\t" + usedMods.list)
      // log.info("artifice: " + usedArtifice)
      return;
    }
  }

  // find out the max possible stats
  // by using minor, major and artifice mods
  const possible100stats = [];

  // log.debug("old stat tier limits", runtime.maximumPossibleTiers)
  for (let stat = 0; stat < 6; stat++) {
    let newStat = stats[stat];
    // Only execute the code if we are below 100. Minor edge case speedup.
    if (stats[stat] < 100) {
      const minorMod = (stat * 3 + 1) as StatModifier;
      const majorMod = (stat * 3 + 2) as StatModifier;
      const minorModCost = STAT_MOD_VALUES[minorMod][2];
      const majorModCost = STAT_MOD_VALUES[majorMod][2];

      let possibleMajor = availableModCost.filter(
        (d, i) => d >= majorModCost && usedModslot[i] == -1
      ).length;
      let possibleMinor =
        availableModCost.filter((d, i) => d >= minorModCost && usedModslot[i] == -1).length -
        possibleMajor;

      if (config.onlyShowResultsWithNoWastedStats) {
        let internalAvailableArtificeCount = availableArtificeCount;

        if (newStat % 10 != 0) {
          // add a minor mod if we are at %5 or %5+n*3
          if (possibleMajor + possibleMinor > 0 && (10 - (newStat + (5 % 10))) % 3 == 0) {
            if (possibleMinor > 0) possibleMinor--;
            else possibleMajor--;
            newStat += 5;
          }

          if (newStat % 10 == 5 && possibleMajor + possibleMinor) {
            // handle an offset of 5
            newStat += 5;
            if (possibleMinor > 0) possibleMinor--;
            else possibleMajor--;
          } else if ((10 - (newStat % 10)) % 3 == 0) {
            // handle "i can add artifice" to fix zero waste
            const artificeCount = (10 - (newStat % 10)) / 3;
            if (artificeCount <= internalAvailableArtificeCount) {
              newStat += artificeCount * 3;
              internalAvailableArtificeCount -= artificeCount;
            }
          }
        }
        newStat += possibleMajor * 10;
        if (possibleMinor % 2 == 0) newStat += 5 * possibleMinor;

        if (newStat % 10 != 0) continue;
      } else {
        const maxBonus = availableArtificeCount * 3 + possibleMinor * 5 + possibleMajor * 10;
        newStat = Math.min(100, stats[stat] + maxBonus);
      }

      //// log.debug("Calculate newstat A", stat, "possibleMajor", possibleMajor, "possibleMinor", possibleMinor, "availableArtificeCount", availableArtificeCount, "stats[stat]", stats[stat], "newStat", newStat, "maxBonus", availableArtificeCount * 3 + possibleMinor * 5 + possibleMajor * 10, "maxPossible", Math.min(100, stats[stat] + availableArtificeCount * 3 + possibleMinor * 5 + possibleMajor * 10))
      //// log.debug("Calculate newstat B", stat, "maxBonus", maxBonus, "newStat", newStat)
    }

    if (newStat > runtime.maximumPossibleTiers[stat]) runtime.maximumPossibleTiers[stat] = newStat;

    if (newStat >= 100) {
      possible100stats.push(stat);
    }
  }
  // log.debug("new stat tier limits", runtime.maximumPossibleTiers, "from", stats, usedModslot, usedArtifice)

  if (possible100stats.length >= 3) {
    // check if this build can reach 3x100 or 4x100
    // for this, we have to check if there are enough mods and artifice slots available
    // to reach three 100 stats or even four 100 stats
    const statxs = possible100stats.map((d) => [d, stats[d]]).sort((a, b) => b[1] - a[1]);
    // fill every stat to 100 with artifice mods and (available) major and minor mods
    const usedModslotsForCheck = [0, 0, 0, 0, 0];
    let availableArtificeForCheck = availableArtificeCount;
    for (let i = 0; i < statxs.length; i++) {
      let statId = statxs[i][0];
      const majorCost = STAT_MOD_VALUES[(statId * 3 + 2) as StatModifier][2];
      const minorCost = STAT_MOD_VALUES[(statId * 3 + 1) as StatModifier][2];
      while (statxs[i][1] < 100) {
        const majorIdx = availableModCost.findIndex(
          (d, idx) => d >= majorCost && usedModslot[idx] == -1 && usedModslotsForCheck[idx] == 0
        );
        if (majorIdx > -1) {
          usedModslotsForCheck[majorIdx] = 1;
          statxs[i][1] += 10;
          continue;
        }
        const minorIdx = availableModCost.findIndex(
          (d, idx) => d >= minorCost && usedModslot[idx] == -1 && usedModslotsForCheck[idx] == 0
        );
        if (minorIdx > -1) {
          usedModslotsForCheck[minorIdx] = 1;
          statxs[i][1] += 5;
          continue;
        }
        if (availableArtificeForCheck > 0) {
          availableArtificeForCheck--;
          statxs[i][1] += 3;
          continue;
        }
        break;
      }
    }

    // count 100s
    const count100s = statxs.filter((d) => d[1] >= 100).length;
    if (count100s >= 3) {
      runtime.statCombo3x100.add((1 << statxs[0][0]) + (1 << statxs[1][0]) + (1 << statxs[2][0]));
      if (count100s >= 4) {
        runtime.statCombo4x100.add(
          (1 << statxs[0][0]) + (1 << statxs[1][0]) + (1 << statxs[2][0]) + (1 << statxs[3][0])
        );
      }
    }
  }

  if (doNotOutput) return "DONOTSEND";

  // Add mods to reduce stat waste
  if (config.tryLimitWastedStats) {
    let waste = [
      stats[ArmorStat.Mobility],
      stats[ArmorStat.Resilience],
      stats[ArmorStat.Recovery],
      stats[ArmorStat.Discipline],
      stats[ArmorStat.Intellect],
      stats[ArmorStat.Strength],
    ]
      .map((v, i) => [10 - (v % 10), i, v])
      .sort((a, b) => b[0] - a[0]);

    for (let i = waste.length - 1; i >= 0; i--) {
      const wasteEntry = waste[i];
      if (wasteEntry[2] >= 100) continue;
      if (config.minimumStatTiers[wasteEntry[1] as ArmorStat].fixed) continue;
      if (wasteEntry[0] == 10) continue;

      // check if we can add a minor mod
      const minorMod = (1 + wasteEntry[1] * 3) as StatModifier;
      const minorCost = STAT_MOD_VALUES[minorMod][2];
      let minorIdx = availableModCost.findIndex((d, i) => d >= minorCost && usedModslot[i] == -1);

      if (wasteEntry[0] <= 3 && availableArtificeCount > 0) {
        // add artifice
        availableArtificeCount--;
        usedArtifice.push(3 + 3 * wasteEntry[1]);
        stats[wasteEntry[1]] += 3;
        wasteEntry[0] -= 3;
        continue;
      }
      if (wasteEntry[0] <= 5 && minorIdx > -1) {
        usedModslot[minorIdx] = minorMod;
        usedMods.insert(minorMod);
        stats[wasteEntry[1]] += 5;
        wasteEntry[0] -= 5;
        continue;
      }
      if (wasteEntry[0] <= 6 && availableArtificeCount > 1) {
        // add artifice
        availableArtificeCount -= 2;
        usedArtifice.push(3 + 3 * wasteEntry[1]);
        usedArtifice.push(3 + 3 * wasteEntry[1]);
        stats[wasteEntry[1]] += 6;
        wasteEntry[0] -= 6;
        continue;
      }
      if (wasteEntry[0] == 8 && availableArtificeCount > 0 && minorIdx > -1) {
        // add artifice
        availableArtificeCount -= 1;
        usedArtifice.push(3 + 3 * wasteEntry[1]);

        usedModslot[minorIdx] = minorMod;
        usedMods.insert(minorMod);

        stats[wasteEntry[1]] += 8;
        wasteEntry[0] -= 8;
        continue;
      }
      if (wasteEntry[0] <= 9 && availableArtificeCount > 2) {
        // add artifice
        availableArtificeCount -= 3;
        usedArtifice.push(3 + 3 * wasteEntry[1]);
        usedArtifice.push(3 + 3 * wasteEntry[1]);
        usedArtifice.push(3 + 3 * wasteEntry[1]);
        stats[wasteEntry[1]] += 9;
        wasteEntry[0] -= 9;
        continue;
      }
    }
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
    modCost: usedMods.list.reduce((p, d: StatModifier) => p + STAT_MOD_VALUES[d][2], 0),
    mods: usedMods.list,
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
        });
        return p;
      },
      [[], [], [], []]
    ),
  };
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
