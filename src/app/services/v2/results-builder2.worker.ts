import {Configuration} from "../../data/configuration";
import {IInventoryArmor} from "../IInventoryArmor";
import {buildDb} from "../../data/database";
import {ArmorSlot} from "../../data/permutation";
import {DID_NOT_SELECT_EXOTIC, FORCE_USE_NO_EXOTIC, PERMUTATION_PACKAGE, RESULTS_PACKAGE} from "../../data/constants";
import {ModInformation} from "../../data/ModInformation";
import {ArmorStat, SpecialArmorStat, STAT_MOD_VALUES, StatModifier} from "../../data/enum/armor-stat";

const slotToEnum: { [id: string]: ArmorSlot; } = {
  "Helmets": ArmorSlot.ArmorSlotHelmet,
  "Arms": ArmorSlot.ArmorSlotGauntlet,
  "Chest": ArmorSlot.ArmorSlotChest,
  "Legs": ArmorSlot.ArmorSlotLegs,
}

const db = buildDb(async () => {
})
const inventoryArmor = db.table("inventoryArmor");

addEventListener('message', async ({data}) => {
  console.debug("START RESULTS BUILDER 2")
  console.time("total")
  const config = data.config as Configuration;

  let exoticItemInfo = config.selectedExoticHash <= DID_NOT_SELECT_EXOTIC
    ? null
    : await inventoryArmor.where("hash").equals(config.selectedExoticHash).first() as IInventoryArmor


  let items = (await inventoryArmor.where("clazz").equals(config.characterClass)
    .toArray() as IInventoryArmor[])

  items = items
    // filter disabled items
    .filter(item => config.disabledItems.indexOf(item.itemInstanceId) == -1)
    // filter the selected exotic right here (config.selectedExoticHash)
    .filter(item => config.selectedExoticHash != FORCE_USE_NO_EXOTIC || !item.isExotic)
    // .filter(item => !item.isExotic || config.selectedExoticHash <= DID_NOT_SELECT_EXOTIC || config.selectedExoticHash == item.hash)
    .filter(item => exoticItemInfo == null || exoticItemInfo.slot != item.slot || exoticItemInfo.hash == item.hash)
    // config.onlyUseMasterworkedItems - only keep masterworked items
    .filter(item => !config.onlyUseMasterworkedItems || item.masterworked)
    .filter(item =>
      config.ignoreArmorAffinitiesOnMasterworkedItems
      || !item.masterworked
      || config.fixedArmorAffinities[slotToEnum[item.slot]] == 0
      || config.fixedArmorAffinities[slotToEnum[item.slot]] == item.energyAffinity
    )
  //.toArray() as IInventoryArmor[];
  console.log("items.len", items.length)
  console.log("ITEMS", items.length, items)


  const helmets = items.filter(i => i.slot == "Helmets")
  const gauntlets = items.filter(i => i.slot == "Arms")
  const chests = items.filter(i => i.slot == "Chest")
  const legs = items.filter(i => i.slot == "Legs")

  console.log({helmets, gauntlets, chests, legs})


  // runtime variables
  const runtime = {
    maximumPossibleTiers: [0, 0, 0, 0, 0, 0],
    statCombo3x100: new Set(),
    statCombo4x100: new Set(),
  }

  let results: any[] = []
  let listedResults = 0;
  let totalResults = 0;

  console.time("tm")
  for (let helmet of helmets) {
    // HALLOWEEN SPECIAL
    if (config.eventHalloweenOnlyUseMask) {
      if (
        helmet.hash != 2545426109 // warlock
        && helmet.hash != 199733460 // Titan
        && helmet.hash != 3224066584 // Hunter
      ) continue;
    }
    // /HALLOWEEN SPECIAL
    for (let gauntlet of gauntlets) {
      if (helmet.isExotic && gauntlet.isExotic) continue;
      for (let chest of chests) {
        if ((helmet.isExotic || gauntlet.isExotic) && chest.isExotic) continue;
        for (let leg of legs) {
          if ((helmet.isExotic || gauntlet.isExotic || chest.isExotic) && leg.isExotic) continue;
          /**
           *  At this point we already have:
           *  - Masterworked items, if they must be masterworked (config.onlyUseMasterworkedItems)
           *  - disabled items were already removed (config.disabledItems)
           */
          const result = handlePermutation(runtime, config, helmet, gauntlet, chest, leg,
            config.limitParsedResults && listedResults >= 5e4);
          // Only add 50k to the list if the setting is activated.
          // We will still calculate the rest so that we get accurate results for the runtime values
          if (result != null) {
            totalResults++;
            if (result !== "DONOTSEND") {
              results.push(result)
              listedResults++;
            }
          }
          //}
          if (results.length >= 1000) {
            postMessage({runtime, results, done: false, total: 0});
            results = []
          }
        }
      }
    }
  }
  console.timeEnd("tm")
  console.timeEnd("total")

  //for (let n = 0; n < 6; n++)
  //  runtime.maximumPossibleTiers[n] = Math.floor(Math.min(100, runtime.maximumPossibleTiers[n]) / 10)

  postMessage({runtime, results, done: true, total: totalResults});
})

/**
 * Returns null, if the permutation is invalid.
 * This code does not utilize fancy filters and other stuff.
 * This results in ugly code BUT it is way way WAY faster!
 */
function handlePermutation(
  runtime: any,
  config: Configuration,
  helmet: IInventoryArmor,
  gauntlet: IInventoryArmor,
  chest: IInventoryArmor,
  leg: IInventoryArmor,
  doNotOutput = false
): any {
  const items = [helmet, gauntlet, chest, leg]
  // yes. this is ugly, but it is fast
  const stats: [number, number, number, number, number, number] = [
    helmet.mobility + gauntlet.mobility + chest.mobility + leg.mobility,
    helmet.resilience + gauntlet.resilience + chest.resilience + leg.resilience,
    helmet.recovery + gauntlet.recovery + chest.recovery + leg.recovery,
    helmet.discipline + gauntlet.discipline + chest.discipline + leg.discipline,
    helmet.intellect + gauntlet.intellect + chest.intellect + leg.intellect,
    helmet.strength + gauntlet.strength + chest.strength + leg.strength,
  ]

  var totalStatBonus = config.assumeClassItemMasterworked ? 2 : 0;

  for (let item of items) {  // add masterworked value, if necessary
    if (item.masterworked
      || (!item.isExotic && config.assumeLegendariesMasterworked)
      || (item.isExotic && config.assumeExoticsMasterworked))
      totalStatBonus += 2;
  }
  stats[0] += totalStatBonus;
  stats[1] += totalStatBonus;
  stats[2] += totalStatBonus;
  stats[3] += totalStatBonus;
  stats[4] += totalStatBonus;
  stats[5] += totalStatBonus;

  const statsWithoutMods = [stats[0], stats[1], stats[2], stats[3], stats[4], stats[5]]

  // Apply configurated mods to the stat value
  // Apply mods
  for (const mod of config.enabledMods) {
    for (const bonus of ModInformation[mod].bonus) {
      var statId = bonus.stat == SpecialArmorStat.ClassAbilityRegenerationStat
        ? [1, 0, 3][config.characterClass]
        : bonus.stat
      stats[statId] += bonus.value;
    }
  }


  // required mods for each stat
  const requiredMods = [
    Math.ceil(Math.max(0, config.minimumStatTier[0] - stats[0] / 10)),
    Math.ceil(Math.max(0, config.minimumStatTier[1] - stats[1] / 10)),
    Math.ceil(Math.max(0, config.minimumStatTier[2] - stats[2] / 10)),
    Math.ceil(Math.max(0, config.minimumStatTier[3] - stats[3] / 10)),
    Math.ceil(Math.max(0, config.minimumStatTier[4] - stats[4] / 10)),
    Math.ceil(Math.max(0, config.minimumStatTier[5] - stats[5] / 10)),
  ]
  const requiredModsTotal = requiredMods[0] + requiredMods[1] + requiredMods[2] + requiredMods[3] + requiredMods[4] + requiredMods[5]
  const usedMods: number[] = []
  // only calculate mods if necessary. If we are already above the limit there's no reason to do the rest
  if (requiredModsTotal > config.maximumStatMods) {
    return null;
  } else if (requiredModsTotal > 0) {
    //console.log({requiredModsTotal, usedMods})
    for (let statId = 0; statId < 6; statId++) {
      if (requiredMods[statId] == 0) continue;
      const statDifference = stats[statId] % 10;
      if (statDifference > 0 && statDifference % 10 >= 5) {
        usedMods.push((1 + (statId * 2)) as StatModifier)
        requiredMods[statId]--;
        stats[statId] += 5
      }
      for (let n = 0; n < requiredMods[statId]; n++) {
        usedMods.push((1 + (statId * 2 + 1)) as StatModifier)
        stats[statId] += 10
      }
    }
  }
  // get maximum possible stat and write them into the runtime
  // Get maximal possible stats and write them in the runtime variable

  const freeMods = 10 * (config.maximumStatMods - usedMods.length)
  for (let n = 0; n < 6; n++) {
    const maximum = stats[n] + freeMods;
    if (maximum > runtime.maximumPossibleTiers[n])
      runtime.maximumPossibleTiers[n] = maximum
  }

  // Get maximal possible stats and write them in the runtime variable
  // Calculate how many 100 stats we can achieve
  let openModSlots = config.maximumStatMods - usedMods.length
  if (openModSlots > 0) {
    var requiredStepsTo100 = [
      Math.max(0, Math.ceil((100 - stats[0]) / 10)),
      Math.max(0, Math.ceil((100 - stats[1]) / 10)),
      Math.max(0, Math.ceil((100 - stats[2]) / 10)),
      Math.max(0, Math.ceil((100 - stats[3]) / 10)),
      Math.max(0, Math.ceil((100 - stats[4]) / 10)),
      Math.max(0, Math.ceil((100 - stats[5]) / 10)),
    ]
    var bestIdx = [0, 1, 2, 3, 4, 5, 6].sort((a, b) => requiredStepsTo100[a] - requiredStepsTo100[b]);

    // if we can't even make 3x100, just stop right here
    const requiredSteps3x100 = requiredStepsTo100[bestIdx[0]] + requiredStepsTo100[bestIdx[1]] + requiredStepsTo100[bestIdx[2]];
    if (requiredSteps3x100 <= openModSlots) {
      // in here we can find 3x100 and 4x100 stats
      runtime.statCombo3x100.add((1 << bestIdx[0]) + (1 << bestIdx[1]) + (1 << bestIdx[2]));
      // if 4x is also in range, add a 4x100 mod
      if ((requiredSteps3x100 + requiredStepsTo100[bestIdx[3]]) <= openModSlots) {
        runtime.statCombo4x100.add((1 << bestIdx[0]) + (1 << bestIdx[1]) + (1 << bestIdx[2]) + (1 << bestIdx[3]));
      }
    }
  }
  if (doNotOutput) return "DONOTSEND";

  // Add mods to reduce stat waste
  // TODO: here's still potential to speed up code
  if (config.tryLimitWastedStats && freeMods > 0) {

    let waste = [
      stats[ArmorStat.Mobility],
      stats[ArmorStat.Resilience],
      stats[ArmorStat.Recovery],
      stats[ArmorStat.Discipline],
      stats[ArmorStat.Intellect],
      stats[ArmorStat.Strength]
    ].map((v, i) => [v % 10, i, v]).sort((a, b) => b[0] - a[0])

    for (let id = usedMods.length; id < config.maximumStatMods; id++) {
      let result = waste.filter(a => a[0] >= 5).filter(k => k[2] < 100).sort((a, b) => a[0] - b[0])[0]
      if (!result) break;
      stats[result[1]] += 5
      result[0] -= 5;
      usedMods.push(1 + 2 * result[1])
      // console.log("FIXED", result, waste, usedMods.length, usedMods, getWaste(stats))
    }
  }


  const waste1 = getWaste(stats);
  if (config.onlyShowResultsWithNoWastedStats && waste1 > 0)
    return null;

  const exotic = helmet.isExotic ? helmet : gauntlet.isExotic ? gauntlet : chest.isExotic ? chest : leg.isExotic ? leg : null
  return {
    exotic: exotic == null ? null : {
      icon: exotic.icon,
      name: exotic.name
    },
    modCount: usedMods.length,
    modCost: usedMods.reduce((p, d: StatModifier) => p + STAT_MOD_VALUES[d][2], 0),
    mods: usedMods,
    stats: stats,
    statsNoMods: statsWithoutMods,
    tiers: getSkillTier(stats),
    waste: waste1,
    // tiersNoMods: getSkillTier(statsWithoutMods),
    items: items.map((instance: IInventoryArmor) => {
      return {
        energy: instance.energyAffinity,
        icon: instance.icon,
        itemInstanceId: instance.itemInstanceId,
        name: instance.name,
        exotic: !!instance.isExotic,
        masterworked: instance.masterworked,
        mayBeBugged: instance.mayBeBugged,
        transferState: 0, // TRANSFER_NONE
        stats: [
          instance.mobility, instance.resilience, instance.recovery,
          instance.discipline, instance.intellect, instance.strength
        ]
      }
    })
  }

}


function getSkillTier(stats: number[]) {
  return Math.floor(Math.min(100, stats[ArmorStat.Mobility]) / 10)
    + Math.floor(Math.min(100, stats[ArmorStat.Resilience]) / 10)
    + Math.floor(Math.min(100, stats[ArmorStat.Recovery]) / 10)
    + Math.floor(Math.min(100, stats[ArmorStat.Discipline]) / 10)
    + Math.floor(Math.min(100, stats[ArmorStat.Intellect]) / 10)
    + Math.floor(Math.min(100, stats[ArmorStat.Strength]) / 10)
}

function getWaste(stats: number[]) {
  return (stats[ArmorStat.Mobility] > 100 ? stats[ArmorStat.Mobility] - 100 : stats[ArmorStat.Mobility] % 10)
    + (stats[ArmorStat.Resilience] > 100 ? stats[ArmorStat.Resilience] - 100 : stats[ArmorStat.Resilience] % 10)
    + (stats[ArmorStat.Recovery] > 100 ? stats[ArmorStat.Recovery] - 100 : stats[ArmorStat.Recovery] % 10)
    + (stats[ArmorStat.Discipline] > 100 ? stats[ArmorStat.Discipline] - 100 : stats[ArmorStat.Discipline] % 10)
    + (stats[ArmorStat.Intellect] > 100 ? stats[ArmorStat.Intellect] - 100 : stats[ArmorStat.Intellect] % 10)
    + (stats[ArmorStat.Strength] > 100 ? stats[ArmorStat.Strength] - 100 : stats[ArmorStat.Strength] % 10)
}
