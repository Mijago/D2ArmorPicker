import {BuildConfiguration} from "../data/buildConfiguration";
import {IInventoryArmor} from "../data/types/IInventoryArmor";
import {buildDb} from "../data/database";
import {ArmorSlot} from "../data/enum/armor-slot";
import {FORCE_USE_NO_EXOTIC} from "../data/constants";
import {ModInformation} from "../data/ModInformation";
import {ArmorPerkOrSlot, ArmorStat, SpecialArmorStat, STAT_MOD_VALUES, StatModifier} from "../data/enum/armor-stat";
import {IManifestArmor} from "../data/types/IManifestArmor";
import {TierType} from "bungie-api-ts/destiny2";

declare global {
  interface Array<T> {
    where(o: (val: T, index: number) => boolean): T[];

    addSorted(o: T): T[];
  }
}

Array.prototype.addSorted = function (element: any) {
  var i = 0;
  var j = this.length;
  var h;
  var c = false;
  if (element > this[j]) {
    this.push(element);
    return this;
  }
  if (element < this[i]) {
    this.splice(i, 0, element);
    return this;
  }
  while (c == false) {
    h = ~~((i + j) / 2); //a faster h=Math.floor((i+j)/2);
    if (element > this[h]) {
      i = h;
    } else {
      j = h;
    }
    if (j - i <= 1) {
      this.splice(j, 0, element);
      c = true;
    }
  }
  return this;
};


Array.prototype.where = Array.prototype.where || function (predicate: any) {
  var results = [],
    // @ts-ignore
    len = this.length,
    i = 0;

  for (; i < len; i++) {
    // @ts-ignore
    var item = this[i];
    if (predicate(item, i)) {
      results.push(item);
    }
  }

  return results;
};

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
  readonly perks: ArmorPerkOrSlot[] = [];
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

    this.perks = items.map(d => d.perk)
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

function checkSlots(config: BuildConfiguration, constantModslotRequirement: number[], availableClassItemTypes: Set<ArmorPerkOrSlot>,
                    helmet: ItemCombination, gauntlet: ItemCombination, chest: ItemCombination, leg: ItemCombination) {

  var exoticId = config.selectedExotics[0] || 0
  let requirements = constantModslotRequirement.slice()
  if ((exoticId <= 0 || (helmet.items[0].hash != exoticId))
    && config.armorPerks[ArmorSlot.ArmorSlotHelmet].fixed && config.armorPerks[ArmorSlot.ArmorSlotHelmet].value != ArmorPerkOrSlot.None
    && config.armorPerks[ArmorSlot.ArmorSlotHelmet].value != helmet.perks[0])
    return {valid: false};
  if ((exoticId <= 0 || (gauntlet.items[0].hash != exoticId))
    && config.armorPerks[ArmorSlot.ArmorSlotGauntlet].fixed && config.armorPerks[ArmorSlot.ArmorSlotGauntlet].value != ArmorPerkOrSlot.None
    && config.armorPerks[ArmorSlot.ArmorSlotGauntlet].value != gauntlet.perks[0])
    return {valid: false};
  if ((exoticId <= 0 || (chest.items[0].hash != exoticId))
    && config.armorPerks[ArmorSlot.ArmorSlotChest].fixed && config.armorPerks[ArmorSlot.ArmorSlotChest].value != ArmorPerkOrSlot.None
    && config.armorPerks[ArmorSlot.ArmorSlotChest].value != chest.perks[0])
    return {valid: false};
  if ((exoticId <= 0 || (leg.items[0].hash != exoticId))
    && config.armorPerks[ArmorSlot.ArmorSlotLegs].fixed && config.armorPerks[ArmorSlot.ArmorSlotLegs].value != ArmorPerkOrSlot.None
    && config.armorPerks[ArmorSlot.ArmorSlotLegs].value != leg.perks[0])
    return {valid: false};
  // also return if we can not find the correct class item. pepepoint.
  if (config.armorPerks[ArmorSlot.ArmorSlotClass].fixed && config.armorPerks[ArmorSlot.ArmorSlotClass].value != ArmorPerkOrSlot.None
    && !availableClassItemTypes.has(config.armorPerks[ArmorSlot.ArmorSlotClass].value))
    return {valid: false};

  requirements[helmet.perks[0]]--;
  requirements[gauntlet.perks[0]]--;
  requirements[chest.perks[0]]--;
  requirements[leg.perks[0]]--;

  // ignore exotic selection
  if (exoticId > 0) {
    if (helmet.items[0].hash == exoticId) requirements[config.armorPerks[helmet.items[0].slot].value]--;
    else if (gauntlet.items[0].hash == exoticId) requirements[config.armorPerks[gauntlet.items[0].slot].value]--;
    else if (chest.items[0].hash == exoticId) requirements[config.armorPerks[chest.items[0].slot].value]--;
    else if (leg.items[0].hash == exoticId) requirements[config.armorPerks[leg.items[0].slot].value]--;
  }

  let bad = 0;
  for (let n = 1; n < ArmorPerkOrSlot.COUNT; n++)
    bad += Math.max(0, requirements[n])

  var requiredClassItemType = ArmorPerkOrSlot.None
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
  } else if (requiredClassItemType == ArmorPerkOrSlot.None && config.armorPerks[ArmorSlot.ArmorSlotClass].fixed) {
    requiredClassItemType = config.armorPerks[ArmorSlot.ArmorSlotClass].value
  }

  // if (config.armorPerks[ArmorSlot.ArmorSlotClass].value != ArmorPerkOrSlot.None && !config.armorPerks[ArmorSlot.ArmorSlotClass].fixed) bad--;

  return {valid: bad <= 0, requiredClassItemType};
}

function prepareConstantStatBonus(config: BuildConfiguration) {
  const constantBonus = [0, 0, 0, 0, 0, 0]
  // Apply configurated mods to the stat value
  // Apply mods
  for (const mod of config.enabledMods) {
    for (const bonus of ModInformation[mod].bonus) {
      var statId = bonus.stat == SpecialArmorStat.ClassAbilityRegenerationStat
        ? [1, 0, 2][config.characterClass]
        : bonus.stat
      constantBonus[statId] += bonus.value;
    }
  }
  return constantBonus;
}

function prepareConstantModslotRequirement(config: BuildConfiguration) {
  let constantPerkRequirement = []
  for (let n = 0; n < ArmorPerkOrSlot.COUNT; n++) constantPerkRequirement.push(0)

  constantPerkRequirement[config.armorPerks[ArmorSlot.ArmorSlotHelmet].value]++;
  constantPerkRequirement[config.armorPerks[ArmorSlot.ArmorSlotChest].value]++;
  constantPerkRequirement[config.armorPerks[ArmorSlot.ArmorSlotGauntlet].value]++;
  constantPerkRequirement[config.armorPerks[ArmorSlot.ArmorSlotLegs].value]++;
  constantPerkRequirement[config.armorPerks[ArmorSlot.ArmorSlotClass].value]++;
  return constantPerkRequirement;
}

function prepareConstantAvailableModslots(config: BuildConfiguration) {
  var availableModCost: number[] = [];
  availableModCost.push(config.maximumModSlots[ArmorSlot.ArmorSlotHelmet].value)
  availableModCost.push(config.maximumModSlots[ArmorSlot.ArmorSlotGauntlet].value)
  availableModCost.push(config.maximumModSlots[ArmorSlot.ArmorSlotChest].value)
  availableModCost.push(config.maximumModSlots[ArmorSlot.ArmorSlotLegs].value)
  availableModCost.push(config.maximumModSlots[ArmorSlot.ArmorSlotClass].value)
  return availableModCost.where(d => d > 0).sort()
}

addEventListener('message', async ({data}) => {
  const startTime = Date.now();
  console.debug("START RESULTS BUILDER 2")
  console.time("total")
  const config = data.config as BuildConfiguration;
  console.log("Using config", data.config)

  let selectedExotics: IManifestArmor[] = await Promise.all(config.selectedExotics
    .filter(hash => hash != FORCE_USE_NO_EXOTIC)
    .map(async hash => await manifestArmor.where("hash").equals(hash).first()))
  selectedExotics = selectedExotics.filter(i => !!i)

  // let exoticItemInfo = config.selectedExotics.length == 0    ? null    : await inventoryArmor.where("hash").equals(config.selectedExotics[0]).first() as IInventoryArmor
  let items = (await inventoryArmor.where("clazz").equals(config.characterClass)
    .distinct()
    .toArray() as IInventoryArmor[])

  items = items
    // only armor :)
    .filter(item => item.slot != ArmorSlot.ArmorSlotNone)
    // filter disabled items
    .filter(item => config.disabledItems.indexOf(item.itemInstanceId) == -1)
    // filter the selected exotic right here
    .filter(item => config.selectedExotics.indexOf(FORCE_USE_NO_EXOTIC) == -1 || !item.isExotic)
    .filter(item => selectedExotics.length != 1 || selectedExotics[0].slot != item.slot || selectedExotics[0].hash == item.hash)
    // config.onlyUseMasterworkedItems - only keep masterworked items
    .filter(item => !config.onlyUseMasterworkedItems || item.masterworked)
    // non-legendaries and non-exotics
    .filter(item => config.allowBlueArmorPieces || item.rarity == TierType.Exotic || item.rarity == TierType.Superior)
    // sunset armor
    .filter(item => !config.ignoreSunsetArmor || !item.isSunset)
    // armor perks
    .filter(item => {
      return item.isExotic
        || !config.armorPerks[item.slot].fixed
        || config.armorPerks[item.slot].value == ArmorPerkOrSlot.None
        || config.armorPerks[item.slot].value == item.perk
    });
  // console.log(items.map(d => "id:'"+d.itemInstanceId+"'").join(" or "))


  let helmets = items.filter(i => i.slot == ArmorSlot.ArmorSlotHelmet)
    .filter(k => {
      return !config.useFotlArmor
        || ([
          199733460, // titan masq
          2545426109, // warlock
          3224066584, // hunter
        ]).indexOf(k.hash) > -1;
    })
    .map(d => new ItemCombination([d]))
  let gauntlets = items.filter(i => i.slot == ArmorSlot.ArmorSlotGauntlet).map(d => new ItemCombination([d]))
  let chests = items.filter(i => i.slot == ArmorSlot.ArmorSlotChest).map(d => new ItemCombination([d]))
  let legs = items.filter(i => i.slot == ArmorSlot.ArmorSlotLegs).map(d => new ItemCombination([d]))
  // new Set(items.filter(i => i.slot == ArmorSlot.ArmorSlotClass).map(i => [i.energyAffinity, i.perk]))


  // Support multithreading. find the largest set and split it by N.
  const threadSplit = data.threadSplit as { count: number, current: number };
  if (threadSplit.count > 1) {
    var splitEntry = ([
      [helmets, helmets.length],
      [gauntlets, gauntlets.length],
      [chests, chests.length],
      [legs, legs.length],
    ] as [ItemCombination[], number][])
      .sort((a, b) => a[1] - b[1])[0][0]
    var keepLength = Math.floor(splitEntry.length / threadSplit.count)
    var startIndex = keepLength * threadSplit.current // we can delete everything before this
    var endIndex = keepLength * (threadSplit.current + 1) // we can delete everything after this
    // if we have rounding issues, let the last thread do the rest
    if (keepLength * threadSplit.count != splitEntry.length && threadSplit.current == threadSplit.count - 1)
      endIndex += splitEntry.length - keepLength * threadSplit.count

    // remove data at the end
    splitEntry.splice(endIndex)
    splitEntry.splice(0, startIndex)
  }


  let classItems = items.filter(i => i.slot == ArmorSlot.ArmorSlotClass);
  let availableClassItemPerkTypes = new Set(classItems.map(d => d.perk));

  console.debug("items", JSON.stringify({
    helmets: helmets.length,
    gauntlets: gauntlets.length,
    chests: chests.length,
    legs: legs.length,
    availableClassItemTypes: availableClassItemPerkTypes
  }))


  // runtime variables
  const runtime = {
    maximumPossibleTiers: [0, 0, 0, 0, 0, 0],
    statCombo3x100: new Set(),
    statCombo4x100: new Set(),
  }
  const constantBonus = prepareConstantStatBonus(config);
  const constantModslotRequirement = prepareConstantModslotRequirement(config);
  const constantAvailableModslots = prepareConstantAvailableModslots(config);
  const constHasOneExoticLength = selectedExotics.length <= 1
  const hasArtificeClassItem = availableClassItemPerkTypes.has(ArmorPerkOrSlot.SlotArtifice)


  let results: any[] = []
  let resultsLength = 0;

  let listedResults = 0;
  let totalResults = 0;
  let doNotOutput = false;

  console.time("tm")
  for (let helmet of helmets) {
    for (let gauntlet of gauntlets) {
      if (constHasOneExoticLength && helmet.containsExotics && gauntlet.containsExotics) continue;
      for (let chest of chests) {
        if (constHasOneExoticLength && (helmet.containsExotics || gauntlet.containsExotics) && chest.containsExotics) continue;
        for (let leg of legs) {
          if (constHasOneExoticLength && (helmet.containsExotics || gauntlet.containsExotics || chest.containsExotics) && leg.containsExotics) continue;
          /**
           *  At this point we already have:
           *  - Masterworked items, if they must be masterworked (config.onlyUseMasterworkedItems)
           *  - disabled items were already removed (config.disabledItems)
           */

          const slotCheckResult = checkSlots(config, constantModslotRequirement, availableClassItemPerkTypes, helmet, gauntlet, chest, leg);
          if (!slotCheckResult.valid) continue;

          const result = handlePermutation(runtime, config, helmet, gauntlet, chest, leg,
            constantBonus, constantAvailableModslots, doNotOutput, hasArtificeClassItem);
          // Only add 50k to the list if the setting is activated.
          // We will still calculate the rest so that we get accurate results for the runtime values
          if (result != null) {
            totalResults++;
            if (result !== "DONOTSEND") {
              result["classItem"] = {
                // TODO really log the perk pls
                //perk: slotCheckResult.requiredClassItemType ?? ArmorPerkOrSlot.None
                perk: ArmorPerkOrSlot.SlotArtifice
              }

              results.push(result)
              resultsLength++;
              listedResults++;
              doNotOutput = doNotOutput || (config.limitParsedResults && listedResults >= 3e4 / threadSplit.count) || listedResults >= 1e6 / threadSplit.count
            }
          }
          //}
          if (resultsLength >= 5000) {
            // @ts-ignore
            postMessage({runtime, results, done: false, total: 0});
            results = []
            resultsLength = 0;
          }
        }
      }
    }
  }
  console.timeEnd("tm")
  console.timeEnd("total")

  //for (let n = 0; n < 6; n++)
  //  runtime.maximumPossibleTiers[n] = Math.floor(Math.min(100, runtime.maximumPossibleTiers[n]) / 10)

  // @ts-ignore
  postMessage({
    runtime,
    results,
    done: true,
    stats: {
      permutationCount: totalResults,
      itemCount: items.length - classItems.length,
      totalTime: Date.now() - startTime
    }
  });
})

function getStatSum(items: ItemCombination[]): [number, number, number, number, number, number] {
  let count = 0;
  for (let idx = 0; idx < items.length; idx++) {
    count += items[idx].items.length > 1 ? 1 : 0
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
      if (this.comparatorList[i] > compVal)
        continue;
      break;
    }
    this.length++;
    this.list.splice(i, 0, value)
    this.comparatorList.splice(i, 0, compVal)
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
      this.list.splice(idx, 1)
      this.comparatorList.splice(idx, 1)
      this.length--;
    }
  }
}

const requiredZeroWasteChanges = [
  [0, 0],
  [0, 3],
  [1, 1],
  [1, 4],
  [0, 2],
  [1, 0],
  [1, 3],
  [0, 1],
  [0, 4],
  [1, 2],
]

/**
 * Returns null, if the permutation is invalid.
 * This code does not utilize fancy filters and other stuff.
 * This results in ugly code BUT it is way way WAY faster!
 */
function handlePermutation(
  runtime: any,
  config: BuildConfiguration,
  helmet: ItemCombination,
  gauntlet: ItemCombination,
  chest: ItemCombination,
  leg: ItemCombination,
  constantBonus: number[],
  availableModCost: number[],
  doNotOutput = false,
  hasArtificeClassItem = false
): any {
  const items = [helmet, gauntlet, chest, leg]

  var totalStatBonus = config.assumeClassItemMasterworked ? 2 : 0;

  for (let i = 0; i < items.length; i++) {
    let item = items[i];  // add masterworked value, if necessary
    if (item.allMasterworked
      || (item.containsExotics && !item.containsLegendaries && config.assumeExoticsMasterworked)
      || (!item.containsExotics && item.containsLegendaries && config.assumeLegendariesMasterworked)
      || (item.containsExotics && item.containsLegendaries && config.assumeLegendariesMasterworked && config.assumeExoticsMasterworked))
      totalStatBonus += 2;
  }

  const stats = getStatSum(items);
  stats[0] += totalStatBonus;
  stats[1] += totalStatBonus + (!items[2].containsExotics && config.addConstent1Resilience ? 1 : 0);
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

  // Abort here if we are already above the limit, in case of fixed stat tiers
  for (let n: ArmorStat = 0; n < 6; n++)
    if (config.minimumStatTiers[n].fixed && (stats[n] / 10) >= config.minimumStatTiers[n].value + 1)
      return null;

  // get the amount of armor with artifice slot
  let availableArtificeCount = items.filter(d => d.perks.indexOf(ArmorPerkOrSlot.SlotArtifice) > -1).length;


  if (hasArtificeClassItem)
    availableArtificeCount += 1;

  const usedMods: OrderedList<StatModifier> = new OrderedList<StatModifier>(d => STAT_MOD_VALUES[d][2])
  const usedArtifice: number[] = []


  const usedModslot = [-1, -1, -1, -1, -1]

  for (let stat = 0; stat < 6; stat++) {
    let distance = config.minimumStatTiers[stat as ArmorStat].value * 10 - stats[stat];
    while (distance > 0) {
      const modulo = distance % 10
      if (modulo > 0 && modulo <= 3 && availableArtificeCount > 0) {
        // initial artifice artifice mod
        usedArtifice.push(stat * 3 + 3 as StatModifier);
        availableArtificeCount--;
        stats[stat] += 3;
        distance -= 3;
        continue;
      }
      if (modulo > 0 && modulo <= 5) {
        // initial minor
        const minorCost = STAT_MOD_VALUES[stat * 3 + 1 as StatModifier][2];
        let minorIdx = availableModCost.findIndex((d, i) => d >= minorCost && usedModslot[i] == -1);
        if (minorIdx > -1) {
          usedMods.insert(stat * 3 + 1 as StatModifier);
          usedModslot[minorIdx] = stat * 3 + 1 as StatModifier;
          stats[stat] += 5;
          distance -= 5;
          continue;
        } else if (stat > 0) {
          // check if there is an used artifice mod that can be replaced by a minor mod
          let possibleIdx = usedArtifice.findIndex((d, i) => {
            const minorCostAr = STAT_MOD_VALUES[d - 2 as StatModifier][2]
            return availableModCost.findIndex((d, i) => d >= minorCostAr && usedModslot[i] == -1) > -1
          })
          if (possibleIdx > -1) {
            const otherStat = (usedArtifice[possibleIdx] / 3) - 1
            usedArtifice.splice(possibleIdx, 1)
            usedArtifice.push(stat * 3 + 3 as StatModifier)

            usedModslot[possibleIdx] = stat * 3 + 3 as StatModifier;

            stats[otherStat] -= 3;
            stats[stat] += 3;

            // restart the loop. this allows the algo to re-shift artifice
            // the break stops the internal loop
            // by setting the stat to -1, we force it to start at the changed stat in the next iteration
            //stat = otherStat - 1;
            continue;
          }
        }
      }


      // find valid slots for major mods
      const majorCost = STAT_MOD_VALUES[stat * 3 + 2 as StatModifier][2];
      let majorIdx = availableModCost.findIndex((d, idx) => d >= majorCost && usedModslot[idx] == -1);
      if (majorIdx > -1 && distance > 5) {
        usedMods.insert(stat * 3 + 2 as StatModifier);
        usedModslot[majorIdx] = stat * 3 + 2 as StatModifier;
        stats[stat] += 10;
        distance -= 10;
        continue;
      }
      const minorCost = STAT_MOD_VALUES[stat * 3 + 1 as StatModifier][2];
      let minorIdx = availableModCost.findIndex((d, i) => d >= minorCost && usedModslot[i] == -1);
      if (minorIdx > -1) {
        usedMods.insert(stat * 3 + 1 as StatModifier);
        usedModslot[minorIdx] = stat * 3 + 1 as StatModifier;
        stats[stat] += 5;
        distance -= 5;
        continue;
      }
      // artifice
      const artificeId = stat * 3 + 3 as StatModifier
      if (availableArtificeCount > 0) {
        usedArtifice.push(artificeId);
        availableArtificeCount--;
        stats[stat] += 3;
        distance -= 3;
        continue;
      }

      // validate if we can shove around some artifice for a major
      if (true) {

        const x = usedArtifice.where(k => k == artificeId).length
        if (x >= 3 && stats[stat] % 10 == 9) {
          // we can replace this with a major mod

          const possibleIdx = availableModCost.findIndex((d, i) => {
            if (usedModslot[i] == -1) return false; // only used slots
            if (usedModslot[i] == stat) return false; // not the same stat ofc
            if (d < majorCost) return false;
            const cstat = usedModslot[i]
            return stats[cstat] % 10 > 1;
          })
          if (possibleIdx > -1) {
            const cstat = STAT_MOD_VALUES[usedModslot[possibleIdx] as StatModifier][0]
            stats[cstat] -= 1
            stats[stat] += 1

            usedModslot[possibleIdx] = stat

            for (let n = 0; n < 3; n++) {
              const idx = usedArtifice.findIndex(d => d == artificeId)
              usedArtifice[idx] = (3+cstat*3)
            }

            //stat = cstat-1;
            continue;
          }
        }
      }

      return
    }
  }


  // find out the max possible stats
  // by using minor, major and artifice mods
  const possible100stats = []
  for (let stat = 0; stat < 6; stat++) {
    let newStat = stats[stat];
    // Only execute the code if we are below 100. Minor edge case speedup.
    if (stats[stat] < 100) {
      const minorMod = stat * 3 + 1 as StatModifier;
      const majorMod = stat * 3 + 2 as StatModifier;
      const minorModCost = STAT_MOD_VALUES[minorMod][2];
      const majorModCost = STAT_MOD_VALUES[majorMod][2];

      const possibleMajor = availableModCost.filter((d, i) => d >= majorModCost && usedModslot[i] == -1).length;
      const possibleMinor = availableModCost.filter((d, i) => d >= minorModCost && usedModslot[i] == -1).length - possibleMajor;

      const maxBonus = availableArtificeCount * 3 + possibleMinor * 5 + possibleMajor * 10;
      newStat = Math.min(100, stats[stat] + maxBonus);
    }

    if (newStat > runtime.maximumPossibleTiers[stat])
      runtime.maximumPossibleTiers[stat] = newStat;

    if (newStat >= 100) {
      possible100stats.push(stat);
    }
  }

  if (possible100stats.length >= 3) {
    // check if this build can reach 3x100 or 4x100
    // for this, we have to check if there are enough mods and artifice slots available
    // to reach three 100 stats or even four 100 stats
    const statxs = possible100stats.map(d => [d, stats[d]]).sort((a, b) => b[1] - a[1])
    // fill every stat to 100 with artifice mods and (available) major and minor mods
    const usedModslotsForCheck = [0, 0, 0, 0, 0]
    for (let i = 0; i < statxs.length; i++) {
      let statId = statxs[i][0];
      const majorCost = STAT_MOD_VALUES[statId * 3 + 2 as StatModifier][2];
      const minorCost = STAT_MOD_VALUES[statId * 3 + 1 as StatModifier][2];
      while (statxs[i][1] < 100) {
        const majorIdx = availableModCost.findIndex((d, idx) => d >= majorCost
          && usedModslot[idx] == -1 && usedModslotsForCheck[idx] == 0);
        if (majorIdx > -1) {
          usedModslotsForCheck[majorIdx] = 1;
          statxs[i][1] += 10;
          continue;
        }
        const minorIdx = availableModCost.findIndex((d, idx) => d >= minorCost
          && usedModslot[idx] == -1 && usedModslotsForCheck[idx] == 0);
        if (minorIdx > -1) {
          usedModslotsForCheck[minorIdx] = 1;
          statxs[i][1] += 5;
          continue;
        }
        if (availableArtificeCount > 0) {
          availableArtificeCount--;
          statxs[i][1] += 3;
          continue;
        }
        break;
      }
    }

    // count 100s
    const count100s = statxs.filter(d => d[1] >= 100).length;
    if (count100s >= 3) {
      runtime.statCombo3x100.add((1 << statxs[0][0]) + (1 << statxs[1][0]) + (1 << statxs[2][0]));
      if (count100s >= 4) {
        runtime.statCombo4x100.add((1 << statxs[0][0]) + (1 << statxs[1][0]) + (1 << statxs[2][0]) + (1 << statxs[3][0]));
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
      stats[ArmorStat.Strength]
    ].map((v, i) => [10 - (v % 10), i, v]).sort((a, b) => b[0] - a[0])

    for (let i = waste.length - 1; i >= 0 && (availableArtificeCount > 0); i--) {
      const wasteEntry = waste[i];
      if (wasteEntry[2] >= 100) continue;
      if (config.minimumStatTiers[wasteEntry[1] as ArmorStat].fixed) continue;
      if (wasteEntry[0] == 0) continue


      // check if we can add a minor mod
      const minorMod = (1 + (wasteEntry[1] * 3)) as StatModifier;
      const minorCost = STAT_MOD_VALUES[minorMod][2]
      let minorIdx = availableModCost.findIndex((d, i) => d >= minorCost && usedModslot[i] == -1);

      if (wasteEntry[0] <= 3 && availableArtificeCount > 0) {
        // add artifice
        availableArtificeCount--;
        usedArtifice.push(3 + (3 * wasteEntry[1]));
        stats[wasteEntry[1]] += 3;
        wasteEntry[0] -= 3;
        continue
      }
      if (wasteEntry[0] <= 5 && minorIdx > -1) {
        usedModslot[minorIdx] = minorMod;
        usedMods.insert(minorMod);
        stats[wasteEntry[1]] += 5;
        wasteEntry[0] -= 5;
        continue
      }
      if (wasteEntry[0] <= 6 && availableArtificeCount > 1) {
        // add artifice
        availableArtificeCount -= 2;
        usedArtifice.push(3 + (3 * wasteEntry[1]));
        usedArtifice.push(3 + (3 * wasteEntry[1]));
        stats[wasteEntry[1]] += 6;
        wasteEntry[0] -= 6;
        continue
      }
      if (wasteEntry[0] == 8 && availableArtificeCount > 0 && minorIdx > -1) {
        // add artifice
        availableArtificeCount -= 1;
        usedArtifice.push(3 + (3 * wasteEntry[1]));

        usedModslot[minorIdx] = minorMod;
        usedMods.insert(minorMod);

        stats[wasteEntry[1]] += 8;
        wasteEntry[0] -= 8;
        continue
      }
      if (wasteEntry[0] <= 9 && availableArtificeCount > 2) {
        // add artifice
        availableArtificeCount -= 3;
        usedArtifice.push(3 + (3 * wasteEntry[1]));
        usedArtifice.push(3 + (3 * wasteEntry[1]));
        usedArtifice.push(3 + (3 * wasteEntry[1]));
        stats[wasteEntry[1]] += 9;
        wasteEntry[0] -= 9;
        continue
      }
    }
  }


  const waste1 = getWaste(stats);
  if (config.onlyShowResultsWithNoWastedStats && waste1 > 0)
    return null;

  const exotic = helmet.containsExotics ? helmet : gauntlet.containsExotics ? gauntlet : chest.containsExotics ? chest : leg.containsExotics ? leg : null
  return {
    exotic: exotic == null ? [] : [{
      icon: exotic?.items[0].icon,
      watermark: exotic?.items[0].watermarkIcon,
      name: exotic?.items[0].name,
      hash: exotic?.items[0].hash
    }],
    artifice: usedArtifice,
    modCount: usedMods.length,
    modCost: usedMods.list.reduce((p, d: StatModifier) => p + STAT_MOD_VALUES[d][2], 0),
    mods: usedMods.list,
    stats: stats,
    statsNoMods: statsWithoutMods,
    tiers: getSkillTier(stats),
    waste: waste1,
    items: items.map(i => i.items).flat().reduce((p: any, instance) => {
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
