import {Configuration} from "../data/configuration";
import {IInventoryArmor} from "../data/types/IInventoryArmor";
import {buildDb} from "../data/database";
import {ArmorSlot} from "../data/enum/armor-slot";
import {FORCE_USE_NO_EXOTIC} from "../data/constants";
import {ModInformation} from "../data/ModInformation";
import {ArmorPerkOrSlot, ArmorStat, SpecialArmorStat, STAT_MOD_VALUES, StatModifier} from "../data/enum/armor-stat";
import {IManifestArmor} from "../data/types/IManifestArmor";
import {DestinyEnergyType} from "bungie-api-ts/destiny2";

const slotToEnum: { [id: string]: ArmorSlot; } = {
  "Helmets": ArmorSlot.ArmorSlotHelmet,
  "Arms": ArmorSlot.ArmorSlotGauntlet,
  "Chest": ArmorSlot.ArmorSlotChest,
  "Legs": ArmorSlot.ArmorSlotLegs,
}

const db = buildDb(async () => {
})
const inventoryArmor = db.table("inventoryArmor");
const manifestArmor = db.table("manifestArmor");

interface MinMaxSum {
  min: number;
  max: number;
  sum: number;
}

// Represents one item, or the combined range of two items
class ItemCombination {
  items: IInventoryArmor[] = [];

  mobility: MinMaxSum = {min: 0, max: 0, sum: 0}
  resilience: MinMaxSum = {min: 0, max: 0, sum: 0}
  recovery: MinMaxSum = {min: 0, max: 0, sum: 0}
  discipline: MinMaxSum = {min: 0, max: 0, sum: 0}
  intellect: MinMaxSum = {min: 0, max: 0, sum: 0}
  strength: MinMaxSum = {min: 0, max: 0, sum: 0}

  readonly containsExotics: boolean = false;
  readonly containsLegendaries: boolean = false;
  readonly allMasterworked: boolean = false;

  readonly elements: DestinyEnergyType[] = [];
  readonly allSameElement: boolean = true;

  constructor(items: IInventoryArmor[]) {
    this.items = items;

    const mobility = this.items.map(d => d.mobility);
    const resilience = this.items.map(d => d.resilience);
    const recovery = this.items.map(d => d.recovery);
    const discipline = this.items.map(d => d.discipline);
    const intellect = this.items.map(d => d.intellect);
    const strength = this.items.map(d => d.strength);

    this.mobility.min = Math.min(...mobility)
    this.mobility.sum = mobility.reduce((p, v) => p + v, 0)

    this.resilience.min = Math.min(...resilience)
    this.resilience.sum = resilience.reduce((p, v) => p + v, 0)

    this.recovery.min = Math.min(...recovery)
    this.recovery.sum = recovery.reduce((p, v) => p + v, 0)

    this.discipline.min = Math.min(...discipline)
    this.discipline.sum = discipline.reduce((p, v) => p + v, 0)

    this.intellect.min = Math.min(...intellect)
    this.intellect.sum = intellect.reduce((p, v) => p + v, 0)

    this.strength.min = Math.min(...strength)
    this.strength.sum = strength.reduce((p, v) => p + v, 0)

    this.containsExotics = this._containsExotics;
    this.containsLegendaries = this._containsLegendaries;
    this.allMasterworked = this._allMasterworked;

    this.elements = items.map(d => d.energyAffinity)
    this.allSameElement = new Set(items).size == 1
  }

  private get _containsExotics() {
    return this.items.filter(i => i.isExotic).length > 0
  }

  private get _containsLegendaries() {
    return this.items.filter(i => !i.isExotic).length > 0
  }

  private get _allMasterworked() {
    return this.items.filter(i => i.masterworked).length == this.items.length
  }
}


function checkElements(config: Configuration, helmet: ItemCombination, gauntlet: ItemCombination, chest: ItemCombination, leg: ItemCombination) {
  // here data is either fixed and correct, or unfixed and any
  let existingElements = [
    (helmet.allMasterworked && config.ignoreArmorAffinitiesOnMasterworkedItems) || (!helmet.allMasterworked && config.ignoreArmorAffinitiesOnNonMasterworkedItems) ? DestinyEnergyType.Any : helmet.elements[0],
    (gauntlet.allMasterworked && config.ignoreArmorAffinitiesOnMasterworkedItems) || (!gauntlet.allMasterworked && config.ignoreArmorAffinitiesOnNonMasterworkedItems) ? DestinyEnergyType.Any : gauntlet.elements[0],
    (chest.allMasterworked && config.ignoreArmorAffinitiesOnMasterworkedItems) || (!chest.allMasterworked && config.ignoreArmorAffinitiesOnNonMasterworkedItems) ? DestinyEnergyType.Any : chest.elements[0],
    (leg.allMasterworked && config.ignoreArmorAffinitiesOnMasterworkedItems) || (!leg.allMasterworked && config.ignoreArmorAffinitiesOnNonMasterworkedItems) ? DestinyEnergyType.Any : leg.elements[0]
  ]
  if (!config.armorAffinities[ArmorSlot.ArmorSlotClass].fixed) existingElements.push(DestinyEnergyType.Any)

  let requiredElements = [
    config.armorAffinities[ArmorSlot.ArmorSlotHelmet].value,
    config.armorAffinities[ArmorSlot.ArmorSlotChest].value,
    config.armorAffinities[ArmorSlot.ArmorSlotGauntlet].value,
    config.armorAffinities[ArmorSlot.ArmorSlotLegs].value,
    !config.armorAffinities[ArmorSlot.ArmorSlotClass].fixed ? config.armorAffinities[ArmorSlot.ArmorSlotClass].value : DestinyEnergyType.Any
  ]
  for (let requiredElement of requiredElements) {
    if (requiredElement == DestinyEnergyType.Any)
      continue;
    let idx = existingElements.indexOf(requiredElement)
    if (idx == -1) idx = existingElements.indexOf(DestinyEnergyType.Any)
    if (idx == -1) return false;
    existingElements.splice(idx, 1)
  }

  return true;
}

function checkSlots(config: Configuration, helmet: ItemCombination, gauntlet: ItemCombination, chest: ItemCombination, leg: ItemCombination) {
  return true;
}

addEventListener('message', async ({data}) => {
  const startTime = Date.now();
  console.debug("START RESULTS BUILDER 2")
  console.time("total")
  const config = data.config as Configuration;

  let selectedExotics: IManifestArmor[] = await Promise.all(config.selectedExotics
    .filter(hash => hash != FORCE_USE_NO_EXOTIC)
    .map(async hash => manifestArmor.where("hash").equals(hash).first()))

  // let exoticItemInfo = config.selectedExotics.length == 0    ? null    : await inventoryArmor.where("hash").equals(config.selectedExotics[0]).first() as IInventoryArmor
  let items = (await inventoryArmor.where("clazz").equals(config.characterClass)
    .toArray() as IInventoryArmor[])

  items = items
    // only armor :)
    .filter(item => item.slot != ArmorSlot.ArmorSlotNone && item.slot != ArmorSlot.ArmorSlotClass)
    // filter disabled items
    .filter(item => config.disabledItems.indexOf(item.itemInstanceId) == -1)
    // filter the selected exotic right here
    .filter(item => config.selectedExotics.indexOf(FORCE_USE_NO_EXOTIC) == -1 || !item.isExotic)
    .filter(item => selectedExotics.length != 1 || selectedExotics[0].slot != item.slot || selectedExotics[0].hash == item.hash)
    // config.onlyUseMasterworkedItems - only keep masterworked items
    .filter(item => !config.onlyUseMasterworkedItems || item.masterworked)
    // filter fixed elements
    .filter(item => {
        return !config.armorAffinities[item.slot].fixed
          || config.armorAffinities[item.slot].value == DestinyEnergyType.Any
          || (item.masterworked && config.ignoreArmorAffinitiesOnMasterworkedItems)
          || (!item.masterworked && config.ignoreArmorAffinitiesOnNonMasterworkedItems)
          || config.armorAffinities[item.slot].value == item.energyAffinity
      }
    )
    // filter sockets
    .filter(item => {
      return !config.armorPerks[item.slot].fixed
        || config.armorPerks[item.slot].value == ArmorPerkOrSlot.None
        || item.isExotic // TODO: add field for the perk/slot into the db and use this here
    })
  //.toArray() as IInventoryArmor[];
  console.log("ITEMS", items.length, items)
  // console.log(items.map(d => "id:'"+d.itemInstanceId+"'").join(" or "))


  let helmets = items.filter(i => i.slot == ArmorSlot.ArmorSlotHelmet).map(d => new ItemCombination([d]))
  let gauntlets = items.filter(i => i.slot == ArmorSlot.ArmorSlotGauntlet).map(d => new ItemCombination([d]))
  let chests = items.filter(i => i.slot == ArmorSlot.ArmorSlotChest).map(d => new ItemCombination([d]))
  let legs = items.filter(i => i.slot == ArmorSlot.ArmorSlotLegs).map(d => new ItemCombination([d]))

  if (selectedExotics.length > 1) {
    let armorSlots = [...new Set(selectedExotics.map(i => i.slot))]

    let items1 = items.filter(i => i.hash == selectedExotics[0].hash)
    let items2 = items.filter(i => i.hash == selectedExotics[1].hash)
    // handle same socket
    if (armorSlots.length == 1) {
      let permutations = []
      for (let i1 of items1) {
        for (let i2 of items2) {
          permutations.push(new ItemCombination([i1, i2]))
        }
      }

      switch (armorSlots[0]) {
        case ArmorSlot.ArmorSlotHelmet:
          helmets = permutations;
          gauntlets = gauntlets.filter(d => !d.containsExotics)
          chests = chests.filter(d => !d.containsExotics)
          legs = legs.filter(d => !d.containsExotics)
          break;
        case ArmorSlot.ArmorSlotGauntlet:
          gauntlets = permutations;
          helmets = helmets.filter(d => !d.containsExotics)
          chests = chests.filter(d => !d.containsExotics)
          legs = legs.filter(d => !d.containsExotics)
          break;
        case ArmorSlot.ArmorSlotChest:
          chests = permutations;
          helmets = helmets.filter(d => !d.containsExotics)
          gauntlets = gauntlets.filter(d => !d.containsExotics)
          legs = legs.filter(d => !d.containsExotics)
          break;
        case ArmorSlot.ArmorSlotLegs:
          legs = permutations;
          helmets = helmets.filter(d => !d.containsExotics)
          gauntlets = gauntlets.filter(d => !d.containsExotics)
          chests = chests.filter(d => !d.containsExotics)
          break;
      }
    } else if (armorSlots.length == 2) {
      /**
       * TODO!!!!
       * While the current solution works, it is nowhere near perfect!
       * Currently I only investigate [all skullforts * all leg helmets] vs [all cuirass * all leg chest pieces] (for example).
       * But I have to use [all skullforts * all leg. chest pieces] vs [all leg helmets * all cuirass].
       * As those are not in the same slot this will be pain. PAIN. I tell you, future Mijago, this'll be pain.
       */
      let legendary1 = items.filter(i => i.slot == selectedExotics[0].slot && !i.isExotic)
      let legendary2 = items.filter(i => i.slot == selectedExotics[1].slot && !i.isExotic)
      let permutations1 = []
      let permutations2 = []
      for (let i1 of items1) {
        for (let i2 of legendary2) {
          permutations1.push(new ItemCombination([i1, i2]))
        }
      }
      for (let i1 of items2) {
        for (let i2 of legendary1) {
          permutations2.push(new ItemCombination([i1, i2]))
        }
      }


      helmets = helmets.filter(d => !d.containsExotics)
      gauntlets = gauntlets.filter(d => !d.containsExotics)
      chests = chests.filter(d => !d.containsExotics)
      legs = legs.filter(d => !d.containsExotics)

      if (armorSlots[0] === ArmorSlot.ArmorSlotHelmet) {
        helmets = permutations1;
      } else if (armorSlots[0] === ArmorSlot.ArmorSlotGauntlet) {
        gauntlets = permutations1;
      } else if (armorSlots[0] === ArmorSlot.ArmorSlotChest) {
        chests = permutations1;
      } else if (armorSlots[0] === ArmorSlot.ArmorSlotLegs) {
        legs = permutations1;
      }
      if (armorSlots[1] === ArmorSlot.ArmorSlotHelmet) {
        helmets = permutations2;
      } else if (armorSlots[1] === ArmorSlot.ArmorSlotGauntlet) {
        gauntlets = permutations2;
      } else if (armorSlots[1] === ArmorSlot.ArmorSlotChest) {
        chests = permutations2;
      } else if (armorSlots[1] === ArmorSlot.ArmorSlotLegs) {
        legs = permutations2;
      }
    }
  }
  console.log("items", {helmets, gauntlets, chests, legs})


  // runtime variables
  const runtime = {
    maximumPossibleTiers: [0, 0, 0, 0, 0, 0],
    statCombo3x100: new Set(),
    statCombo4x100: new Set(),
  }
  const constantBonus = [0, 0, 0, 0, 0, 0]
  // Apply configurated mods to the stat value
  // Apply mods
  for (const mod of config.enabledMods) {
    for (const bonus of ModInformation[mod].bonus) {
      var statId = bonus.stat == SpecialArmorStat.ClassAbilityRegenerationStat
        ? [1, 0, 3][config.characterClass]
        : bonus.stat
      constantBonus[statId] += bonus.value;
    }
  }

  let results: any[] = []
  let listedResults = 0;
  let totalResults = 0;

  let times = [];
  console.time("tm")
  for (let helmet of helmets) {
    for (let gauntlet of gauntlets) {
      if (selectedExotics.length <= 1 && helmet.containsExotics && gauntlet.containsExotics) continue;
      for (let chest of chests) {
        if (selectedExotics.length <= 1 && (helmet.containsExotics || gauntlet.containsExotics) && chest.containsExotics) continue;
        for (let leg of legs) {
          if (selectedExotics.length <= 1 && (helmet.containsExotics || gauntlet.containsExotics || chest.containsExotics) && leg.containsExotics) continue;
          /**
           *  At this point we already have:
           *  - Masterworked items, if they must be masterworked (config.onlyUseMasterworkedItems)
           *  - disabled items were already removed (config.disabledItems)
           */
          let start = Date.now()
          if (!checkElements(config, helmet, gauntlet, chest, leg))
            continue;
          if (!checkSlots(config, helmet, gauntlet, chest, leg))
            continue;

          const result = handlePermutation(runtime, config, helmet, gauntlet, chest, leg, constantBonus,
            (config.limitParsedResults && listedResults >= 5e4) || listedResults >= 1e6
          );
          let end = Date.now() - start;
          times.push(end)

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
          if (results.length >= 5000) {
            // @ts-ignore
            postMessage({runtime, results, done: false, total: 0});
            results = []
          }
        }
      }
    }
  }
  console.timeEnd("tm")
  console.timeEnd("total")
  console.log("avg time", times.reduce((a, b) => a + b, 0) / times.length)
  console.log("max time", times.reduce((a, b) => b > a ? b : a, 0))
  console.log("min time", times.reduce((a, b) => b < a ? b : a, 1e5))
  console.log("<0.0001", times.filter(t => t > 0 && t < 0.0001).length)
  console.log(">0.0001", times.filter(t => t > 0.0001).length)
  console.log(">0.001", times.filter(t => t > 0.001).length)
  console.log(">0.01", times.filter(t => t > 0.01).length)
  console.log(">0.1", times.filter(t => t > 0.1).length)
  console.log(">0.5", times.filter(t => t > 0.5).length)
  console.log(">0.75", times.filter(t => t > 0.75).length)
  console.log(">1", times.filter(t => t > 1).length)
  console.log(">10", times.filter(t => t > 10).length)

  //for (let n = 0; n < 6; n++)
  //  runtime.maximumPossibleTiers[n] = Math.floor(Math.min(100, runtime.maximumPossibleTiers[n]) / 10)

  // @ts-ignore
  postMessage({
    runtime,
    results,
    done: true,
    stats: {
      permutationCount: totalResults,
      itemCount: items.length,
      totalTime: Date.now() - startTime
    }
  });
})

function getStatSum(items: ItemCombination[]): [number, number, number, number, number, number] {
  let count = 0;
  for (let i of items) {
    count += i.items.length > 1 ? 1 : 0
  }

  if (count <= 1)
    return [
      items[0].mobility.min + items[1].mobility.min + items[2].mobility.min + items[3].mobility.min,
      items[0].resilience.min + items[1].resilience.min + items[2].resilience.min + items[3].resilience.min,
      items[0].recovery.min + items[1].recovery.min + items[2].recovery.min + items[3].recovery.min,
      items[0].discipline.min + items[1].discipline.min + items[2].discipline.min + items[3].discipline.min,
      items[0].intellect.min + items[1].intellect.min + items[2].intellect.min + items[3].intellect.min,
      items[0].strength.min + items[1].strength.min + items[2].strength.min + items[3].strength.min,
    ]
  else {
    let normal = items.filter(d => d.items.length == 1)
    let special: [number, number, number, number, number, number] = items.filter(d => d.items.length > 1).reduce((p, v) => {
      p[0] = v.mobility.sum < p[0] ? v.mobility.sum : p[0];
      p[1] = v.resilience.sum < p[1] ? v.resilience.sum : p[1];
      p[2] = v.recovery.sum < p[2] ? v.recovery.sum : p[2];
      p[3] = v.discipline.sum < p[3] ? v.discipline.sum : p[3];
      p[4] = v.intellect.sum < p[4] ? v.intellect.sum : p[4];
      p[5] = v.strength.sum < p[5] ? v.strength.sum : p[5];
      return p;
    }, [200, 200, 200, 200, 200, 200])
    for (let n of normal) {
      special[0] += n.mobility.min;
      special[1] += n.resilience.min;
      special[2] += n.recovery.min;
      special[3] += n.discipline.min;
      special[4] += n.intellect.min;
      special[5] += n.strength.min;
    }
    return special;
  }
}

/**
 * Returns null, if the permutation is invalid.
 * This code does not utilize fancy filters and other stuff.
 * This results in ugly code BUT it is way way WAY faster!
 */
function handlePermutation(
  runtime: any,
  config: Configuration,
  helmet: ItemCombination,
  gauntlet: ItemCombination,
  chest: ItemCombination,
  leg: ItemCombination,
  constantBonus: number[],
  doNotOutput = false
): any {
  const items = [helmet, gauntlet, chest, leg]

  var totalStatBonus = config.assumeClassItemMasterworked ? 2 : 0;

  for (let item of items) {  // add masterworked value, if necessary
    if (item.allMasterworked
      || (item.containsExotics && !item.containsLegendaries && config.assumeExoticsMasterworked)
      || (!item.containsExotics && item.containsLegendaries && config.assumeLegendariesMasterworked)
      || (item.containsExotics && item.containsLegendaries && config.assumeLegendariesMasterworked && config.assumeExoticsMasterworked))
      totalStatBonus += 2;
  }

  const stats = getStatSum(items);
  stats[0] += totalStatBonus;
  stats[1] += totalStatBonus;
  stats[2] += totalStatBonus;
  stats[3] += totalStatBonus;
  stats[4] += totalStatBonus;
  stats[5] += totalStatBonus;

  const statsWithoutMods = [stats[0], stats[1], stats[2], stats[3], stats[4], stats[5]]
  stats[0] += constantBonus[0];
  stats[1] += constantBonus[1];
  stats[2] += constantBonus[2];
  stats[3] += constantBonus[3];
  stats[4] += constantBonus[4];
  stats[5] += constantBonus[5];

  // required mods for each stat
  const requiredMods = [
    Math.ceil(Math.max(0, config.minimumStatTiers[0].value - stats[0] / 10)),
    Math.ceil(Math.max(0, config.minimumStatTiers[1].value - stats[1] / 10)),
    Math.ceil(Math.max(0, config.minimumStatTiers[2].value - stats[2] / 10)),
    Math.ceil(Math.max(0, config.minimumStatTiers[3].value - stats[3] / 10)),
    Math.ceil(Math.max(0, config.minimumStatTiers[4].value - stats[4] / 10)),
    Math.ceil(Math.max(0, config.minimumStatTiers[5].value - stats[5] / 10)),
  ]
  const requiredModsTotal = requiredMods[0] + requiredMods[1] + requiredMods[2] + requiredMods[3] + requiredMods[4] + requiredMods[5]
  const usedMods: number[] = []
  // only calculate mods if necessary. If we are already above the limit there's no reason to do the rest
  if (requiredModsTotal > 5) return null;

  let availableModCost = [
    config.maximumModSlots[ArmorSlot.ArmorSlotHelmet].value,
    config.maximumModSlots[ArmorSlot.ArmorSlotGauntlet].value,
    config.maximumModSlots[ArmorSlot.ArmorSlotChest].value,
    config.maximumModSlots[ArmorSlot.ArmorSlotLegs].value,
    config.maximumModSlots[ArmorSlot.ArmorSlotClass].value,
  ].filter(c => c > 0).sort((a, b) => a - b)
  let availableModCostLen = availableModCost.length;
  if (requiredModsTotal > availableModCostLen) return null;

  if (requiredModsTotal > 0) {
    // first, add mods that are necessary
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
    // now replace major mods with minor mods if necessary, or abort
    let mods: StatModifier[] = usedMods.sort((a: StatModifier, b: StatModifier) => STAT_MOD_VALUES[a][2] - STAT_MOD_VALUES[b][2])
    for (let i = 0; i < mods.length; i++) {
      const mod = mods[i];

      const cost = STAT_MOD_VALUES[mod][2];
      const availableSlots = availableModCost.filter(d => d >= cost);
      if (availableSlots.length == 0) {
        // replace a major mod with two minor mods OR abort
        if (mod % 2 == 0) {
          usedMods.splice(usedMods.indexOf(mod), 1)
          usedMods.push(mod - 1)
          usedMods.push(mod - 1)
          mods = usedMods.sort((a: StatModifier, b: StatModifier) => STAT_MOD_VALUES[a][2] - STAT_MOD_VALUES[b][2])
          i--;
        } else {
          // cannot replace a minor mod, so this build is not possible
          return null;
        }
      } else {
        availableModCost.splice(availableModCost.indexOf(availableSlots[0]), 1)
        availableModCostLen--;
      }
    }
  }

  // Check if we should add our results at all
  if (config.onlyShowResultsWithNoWastedStats) {
    // Definitely return when we encounter stats above 100
    if (stats.filter(d => d > 100).length > 0)
      return null;
    // definitely return when we encounter stats that can not be fixed
    if (stats.filter(d => d % 5 != 0).length > 0)
      return null;

    // now find out how many mods we need to fix our stats to 0 waste
    // Yes, this is basically duplicated code. But necessary.
    let waste = [
      stats[ArmorStat.Mobility],
      stats[ArmorStat.Resilience],
      stats[ArmorStat.Recovery],
      stats[ArmorStat.Discipline],
      stats[ArmorStat.Intellect],
      stats[ArmorStat.Strength]
    ].map((v, index) => [v % 10, index, v]).sort((a, b) => b[0] - a[0])

    for (let i = availableModCostLen - 1; i >= 0; i--) {
      let result = waste
        .filter(t => availableModCost.filter(d => d >= STAT_MOD_VALUES[(1 + (t[1] * 2)) as StatModifier][2]).length > 0)
        .filter(t => t[0] >= 5)
        .filter(t => t[2] < 100)
        .sort((a, b) => a[0] - b[0])[0]
      if (!result) break;

      const modCost = availableModCost.filter(d => d >= STAT_MOD_VALUES[(1 + (result[1] * 2)) as StatModifier][2])[0]
      availableModCost.splice(availableModCost.indexOf(modCost), 1);
      availableModCostLen--;
      stats[result[1]] += 5
      result[0] -= 5;
      usedMods.push(1 + 2 * result[1])
    }
    const waste1 = getWaste(stats);
    if (waste1 > 0)
      return null;
  }
  if (usedMods.length > 5)
    return null;


  // get maximum possible stat and write them into the runtime
  // Get maximal possible stats and write them in the runtime variable
  for (let n = 0; n < 6; n++) {
    let minor = STAT_MOD_VALUES[(1 + (n * 2)) as StatModifier][2]
    let major = STAT_MOD_VALUES[(2 + (n * 2)) as StatModifier][2]
    let maximum = stats[n]
    for (let i = 0; i < availableModCostLen && maximum < 100; i++) {
      if (availableModCost[i] >= major) maximum+=10;
      if (availableModCost[i] >= minor && availableModCost[i] < major) maximum+= 5;
    }
    if (maximum > runtime.maximumPossibleTiers[n])
      runtime.maximumPossibleTiers[n] = maximum
  }

  if (availableModCostLen > 0) {
    var requiredPointsTo100: [number, number[], number][] = [
      Math.max(0, 100 - stats[0]),
      Math.max(0, 100 - stats[1]),
      Math.max(0, 100 - stats[2]),
      Math.max(0, 100 - stats[3]),
      Math.max(0, 100 - stats[4]),
      Math.max(0, 100 - stats[5])
    ].map((val, idx) => {
      let requiredModCosts = []
      let requiredModCostsLen = 0;
      let tmp = val
      while (tmp > 5) {
        requiredModCosts.push(STAT_MOD_VALUES[(2 + (idx * 2)) as StatModifier][2])
        requiredModCostsLen++;
        tmp -= 10
      }
      if (tmp > 0 && tmp <= 5) {
        requiredModCosts.push(STAT_MOD_VALUES[(1 + (idx * 2)) as StatModifier][2])
        requiredModCostsLen++;
      }
      return [val, requiredModCosts, requiredModCostsLen]
    })
    var bestIdx = [0, 1, 2, 3, 4, 5].sort((a, b) => requiredPointsTo100[a][0] - requiredPointsTo100[b][0]);

    // if we can't even make 3x100, just stop right here
    const requiredSteps3x100 = requiredPointsTo100[bestIdx[0]][2] + requiredPointsTo100[bestIdx[1]][2] + requiredPointsTo100[bestIdx[2]][2];
    if (requiredSteps3x100 <= availableModCostLen) {
      // in here we can find 3x100 and 4x100 stats
      // now validate the modslots
      var tmpAvailableModCost = availableModCost.slice()
      var aborted = false;
      for (let modCost of [requiredPointsTo100[bestIdx[0]][1], requiredPointsTo100[bestIdx[1]][1], requiredPointsTo100[bestIdx[2]][1]].flat()) {
        let availableSlots = tmpAvailableModCost.filter(d => d >= modCost)
        if (availableSlots.length == 0) {
          aborted = true;
          break;
        }
        tmpAvailableModCost.splice(tmpAvailableModCost.indexOf(availableSlots[0]), 1)
      }
      if (!aborted)
        runtime.statCombo3x100.add((1 << bestIdx[0]) + (1 << bestIdx[1]) + (1 << bestIdx[2]));

      // if 4x is also in range, add a 4x100 mod
      if (!aborted && requiredPointsTo100[bestIdx[3]][2] <= tmpAvailableModCost.length) {
        aborted = false;
        for (let modCost of requiredPointsTo100[bestIdx[3]][1]) {
          let availableSlots = tmpAvailableModCost.filter(d => d >= modCost)
          if (availableSlots.length == 0) {
            aborted = true;
            break;
          }
          tmpAvailableModCost.splice(tmpAvailableModCost.indexOf(availableSlots[0]), 1)
        }
        if (!aborted)
          runtime.statCombo4x100.add((1 << bestIdx[0]) + (1 << bestIdx[1]) + (1 << bestIdx[2]) + (1 << bestIdx[3]));
      }
    }
  }
  if (doNotOutput) return "DONOTSEND";

  // Add mods to reduce stat waste
  if (config.tryLimitWastedStats && availableModCostLen > 0) {

    let waste = [
      stats[ArmorStat.Mobility],
      stats[ArmorStat.Resilience],
      stats[ArmorStat.Recovery],
      stats[ArmorStat.Discipline],
      stats[ArmorStat.Intellect],
      stats[ArmorStat.Strength]
    ].map((v, i) => [v % 10, i, v]).sort((a, b) => b[0] - a[0])

    for (let id = 0; id < availableModCostLen; id++) {
      let result = waste
        .filter(t => availableModCost.filter(d => d >= STAT_MOD_VALUES[(1 + (t[1] * 2)) as StatModifier][2]).length > 0)
        .filter(t => t[0] >= 5)
        .filter(t => t[2] < 100)
        .sort((a, b) => a[0] - b[0])[0]
      if (!result) break;

      const modCost = availableModCost.filter(d => d >= STAT_MOD_VALUES[(1 + (result[1] * 2)) as StatModifier][2])[0]
      availableModCost.splice(availableModCost.indexOf(modCost), 1);
      availableModCostLen--;
      stats[result[1]] += 5
      result[0] -= 5;
      usedMods.push(1 + 2 * result[1])
    }
  }


  const waste1 = getWaste(stats);
  if (config.onlyShowResultsWithNoWastedStats && waste1 > 0)
    return null;

  return {
    exotic: items.map(d => d.items).flat().filter((d: IInventoryArmor) => d.isExotic).map((d: IInventoryArmor) => {
      return {
        icon: d.icon,
        name: d.name
      }
    }),
    modCount: usedMods.length,
    modCost: usedMods.reduce((p, d: StatModifier) => p + STAT_MOD_VALUES[d][2], 0),
    mods: usedMods,
    stats: stats,
    statsNoMods: statsWithoutMods,
    tiers: getSkillTier(stats),
    waste: waste1,
    items: items.map(i => i.items).flat().reduce((p: any, instance) => {
      p[instance.slot - 1].push({
        energy: instance.energyAffinity,
        icon: instance.icon,
        itemInstanceId: instance.itemInstanceId,
        name: instance.name,
        exotic: !!instance.isExotic,
        masterworked: instance.masterworked,
        mayBeBugged: instance.mayBeBugged,
        slot: instance.slot,
        transferState: 0, // TRANSFER_NONE
        stats: [
          instance.mobility, instance.resilience, instance.recovery,
          instance.discipline, instance.intellect, instance.strength
        ]
      })
      return p;
    }, [[], [], [], []])
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
