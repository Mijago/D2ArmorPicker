import {BuildConfiguration} from "../data/buildConfiguration";
import {IInventoryArmor} from "../data/types/IInventoryArmor";
import {buildDb} from "../data/database";
import {ArmorSlot} from "../data/enum/armor-slot";
import {FORCE_USE_ANY_EXOTIC, FORCE_USE_NO_EXOTIC} from "../data/constants";
import {ModInformation} from "../data/ModInformation";
import {ArmorPerkOrSlot, ArmorStat, SpecialArmorStat, STAT_MOD_VALUES, StatModifier} from "../data/enum/armor-stat";
import {IManifestArmor} from "../data/types/IManifestArmor";
import {DestinyEnergyType, TierType} from "bungie-api-ts/destiny2";

declare global {
  interface Array<T> {
    where(o: (val: T) => boolean): T[];

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
    if (predicate(item)) {
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

  readonly elements: DestinyEnergyType[] = [];
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

    this.elements = items.map(d => d.energyAffinity)
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


function checkElements(config: BuildConfiguration, constantElementRequirements: number[], availableClassElements: Set<DestinyEnergyType>,
                       helmet: ItemCombination, gauntlet: ItemCombination, chest: ItemCombination, leg: ItemCombination) {
  let requirements = constantElementRequirements.slice()
  let wildcard = requirements[0]

  if ((helmet.allMasterworked && config.ignoreArmorAffinitiesOnMasterworkedItems)
    || (!helmet.allMasterworked && config.ignoreArmorAffinitiesOnNonMasterworkedItems)) wildcard++;
  else requirements[helmet.elements[0]]--;

  if ((gauntlet.allMasterworked && config.ignoreArmorAffinitiesOnMasterworkedItems)
    || (!gauntlet.allMasterworked && config.ignoreArmorAffinitiesOnNonMasterworkedItems)) wildcard++;
  else requirements[gauntlet.elements[0]]--;

  if ((chest.allMasterworked && config.ignoreArmorAffinitiesOnMasterworkedItems)
    || (!chest.allMasterworked && config.ignoreArmorAffinitiesOnNonMasterworkedItems)) wildcard++;
  else requirements[chest.elements[0]]--;

  if ((leg.allMasterworked && config.ignoreArmorAffinitiesOnMasterworkedItems)
    || (!leg.allMasterworked && config.ignoreArmorAffinitiesOnNonMasterworkedItems)) wildcard++;
  else requirements[leg.elements[0]]--;

//  if (config.armorAffinities[ArmorSlot.ArmorSlotClass].value == DestinyEnergyType.Any)
//    wildcard++;

  let bad = (
    Math.max(0, requirements[DestinyEnergyType.Arc])
    + Math.max(0, requirements[DestinyEnergyType.Thermal])
    + Math.max(0, requirements[DestinyEnergyType.Void])
    + Math.max(0, requirements[DestinyEnergyType.Stasis])
  ) - wildcard

  var requiredClassItemElement = DestinyEnergyType.Any;

  if (config.armorAffinities[ArmorSlot.ArmorSlotClass].fixed)
    requiredClassItemElement = config.armorAffinities[ArmorSlot.ArmorSlotClass].value;

  if (bad == 1
    &&
    !(config.armorAffinities[ArmorSlot.ArmorSlotClass].fixed && config.armorAffinities[ArmorSlot.ArmorSlotClass].value != DestinyEnergyType.Any)) {
    var fixed = false;
    for (let k of [DestinyEnergyType.Void, DestinyEnergyType.Stasis, DestinyEnergyType.Thermal, DestinyEnergyType.Arc]) {
      if (requirements[k] <= 0) continue;
      if (availableClassElements.has(k)) {
        fixed = true;
        requiredClassItemElement = k;
      }
    }
    if (fixed) bad--;
  }

  return {valid: bad <= 0, requiredClassItemElement};
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

function prepareConstantElementRequirement(config: BuildConfiguration) {
  let constantElementRequirement = [0, 0, 0, 0, 0, 0, 0]
  //             [0, 2, 1, 1, 0, 0, 1] // 2 arc,  1 solar, 1 void; class item not fixed and stasis

  constantElementRequirement[config.armorAffinities[ArmorSlot.ArmorSlotHelmet].value]++;
  constantElementRequirement[config.armorAffinities[ArmorSlot.ArmorSlotChest].value]++;
  constantElementRequirement[config.armorAffinities[ArmorSlot.ArmorSlotGauntlet].value]++;
  constantElementRequirement[config.armorAffinities[ArmorSlot.ArmorSlotLegs].value]++;

  if (!config.armorAffinities[ArmorSlot.ArmorSlotClass].fixed)
    constantElementRequirement[config.armorAffinities[ArmorSlot.ArmorSlotClass].value]++;

  constantElementRequirement[0] = 0
  return constantElementRequirement;
}

function prepareConstantModslotRequirement(config: BuildConfiguration) {
  let constantElementRequirement = []
  for (let n = 0; n < ArmorPerkOrSlot.COUNT; n++) constantElementRequirement.push(0)

  constantElementRequirement[config.armorPerks[ArmorSlot.ArmorSlotHelmet].value]++;
  constantElementRequirement[config.armorPerks[ArmorSlot.ArmorSlotChest].value]++;
  constantElementRequirement[config.armorPerks[ArmorSlot.ArmorSlotGauntlet].value]++;
  constantElementRequirement[config.armorPerks[ArmorSlot.ArmorSlotLegs].value]++;
  constantElementRequirement[config.armorPerks[ArmorSlot.ArmorSlotClass].value]++;
  return constantElementRequirement;
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
    // filter fixed elements
    .filter(item => {
      return !config.armorAffinities[item.slot].fixed
        || config.armorAffinities[item.slot].value == DestinyEnergyType.Any
        || (item.masterworked && config.ignoreArmorAffinitiesOnMasterworkedItems)
        || (!item.masterworked && config.ignoreArmorAffinitiesOnNonMasterworkedItems)
        || config.armorAffinities[item.slot].value == item.energyAffinity
    })
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
  let availableClassItemEnergyPerkDict = Array.from(availableClassItemPerkTypes)
    .reduce((p, v) => {
      if (!p.has(v)) p.set(v, new Set<DestinyEnergyType>());
      if (!p.has(ArmorPerkOrSlot.None)) p.set(ArmorPerkOrSlot.None, new Set<DestinyEnergyType>());
      for (let cls of classItems.filter(i => i.perk == v)) {
        p.get(ArmorPerkOrSlot.None)?.add(cls.energyAffinity)
        p.get(v)?.add(cls.energyAffinity)
      }
      return p;
    }, new Map<ArmorPerkOrSlot, Set<DestinyEnergyType>>())

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
  console.debug("items", {
    helmets,
    gauntlets,
    chests,
    legs,
    availableClassItemTypes: availableClassItemPerkTypes,
    availableClassItemEnergyPerkDict
  })


  // runtime variables
  const runtime = {
    maximumPossibleTiers: [0, 0, 0, 0, 0, 0],
    statCombo3x100: new Set(),
    statCombo4x100: new Set(),
  }
  const constantBonus = prepareConstantStatBonus(config);
  const constantElementRequirement = prepareConstantElementRequirement(config);
  const constantModslotRequirement = prepareConstantModslotRequirement(config);
  const constantAvailableModslots = prepareConstantAvailableModslots(config);
  const constantMustCheckElementRequirement = constantElementRequirement[0] < 5
  const constHasOneExoticLength = selectedExotics.length <= 1


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

          var requiredClassElement = DestinyEnergyType.Any;
          if (constantMustCheckElementRequirement) {
            const energyCheckResult = checkElements(config, constantElementRequirement,
              availableClassItemEnergyPerkDict.get(slotCheckResult.requiredClassItemType ?? ArmorPerkOrSlot.None) ?? new Set(),
              helmet, gauntlet, chest, leg);
            if (!energyCheckResult.valid) continue;
            requiredClassElement = energyCheckResult.requiredClassItemElement;
          }


          const result = handlePermutation(runtime, config, helmet, gauntlet, chest, leg,
            constantBonus, constantAvailableModslots.slice(), doNotOutput);
          // Only add 50k to the list if the setting is activated.
          // We will still calculate the rest so that we get accurate results for the runtime values
          if (result != null) {
            totalResults++;
            if (result !== "DONOTSEND") {
              result["classItem"] = {
                perk: slotCheckResult.requiredClassItemType ?? ArmorPerkOrSlot.None,
                affinity: requiredClassElement,
              }

              results.push(result)
              resultsLength++;
              listedResults++;
              doNotOutput = doNotOutput || (config.limitParsedResults && listedResults >= 5e4 / threadSplit.count) || listedResults >= 1e6 / threadSplit.count
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
  doNotOutput = false
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
  const usedMods: OrderedList<StatModifier> = new OrderedList<StatModifier>(d => STAT_MOD_VALUES[d][2])
  // only calculate mods if necessary. If we are already above the limit there's no reason to do the rest
  if (requiredModsTotal > 5) return null;

  let availableModCostLen = availableModCost.length;
  if (requiredModsTotal > availableModCostLen) return null;

  if (requiredModsTotal > 0) {
    // first, add mods that are necessary
    for (let statId = 0; statId < 6; statId++) {
      if (requiredMods[statId] == 0) continue;

      // Add a minor mod in favor of a major mod, if the stat number ends at 5, 6, 7, 8, or 9.
      // This saves slots AND reduces wasted stats.
      const statDifference = stats[statId] % 10;
      if (statDifference > 0 && statDifference % 10 >= 5) {
        usedMods.insert((1 + (statId * 2)) as StatModifier)

        requiredMods[statId]--;
        stats[statId] += 5
      }
      // Now fill the rest with major mods.
      for (let n = 0; n < requiredMods[statId]; n++) {
        usedMods.insert((2 + (statId * 2)) as StatModifier)
        stats[statId] += 10
      }
    }
    /**
     *  Now we know how many major mods we need.
     *  If the modslot limitation forces us to only use N major mods, we can simply replace
     *  a major mod with two minor mods.
     *  We'll do this until we either reach the usedMods length of 5 (the limit), or until all
     *  modslot limitations are satisfied.
     */
    for (let i = 0; i < usedMods.length && usedMods.length <= 5; i++) {
      const mod = usedMods.list[i];

      const cost = STAT_MOD_VALUES[mod][2];
      const availableSlots = availableModCost.where(d => d >= cost);
      if (availableSlots.length == 0) {
        if (mod % 2 == 0) {
          // replace a major mod with two minor mods OR abort
          usedMods.remove(mod)
          let minorMod = mod - 1 as StatModifier;
          usedMods.insert(minorMod)
          usedMods.insert(minorMod)
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
  if (usedMods.length > 5) return null;

  // Check if we should add our results at all
  if (config.onlyShowResultsWithNoWastedStats) {
    // Definitely return when we encounter stats above 100
    if (stats.where(d => d > 100).length > 0)
      return null;
    // definitely return when we encounter stats that can not be fixed
    if (stats.where(d => d % 5 != 0).length > 0)
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
        .where(t => availableModCost.filter(d => d >= STAT_MOD_VALUES[(1 + (t[1] * 2)) as StatModifier][2]).length > 0)
        .where(t => t[0] >= 5 && t[2] < 100)
        .sort((a, b) => a[0] - b[0])[0]
      if (!result) break;

      const modCost = availableModCost.where(d => d >= STAT_MOD_VALUES[(1 + (result[1] * 2)) as StatModifier][2])[0]
      availableModCost.splice(availableModCost.indexOf(modCost), 1);
      availableModCostLen--;
      stats[result[1]] += 5
      result[0] -= 5;
      usedMods.insert(1 + 2 * result[1])
    }
    const waste1 = getWaste(stats);
    if (waste1 > 0)
      return null;
  }
  if (usedMods.length > 5)
    return null;


  // get maximum possible stat and write them into the runtime
  // Get maximal possible stats and write them in the runtime variable
  const maxBonus = 10 * availableModCostLen
  const maxBonus1 = 100 - 10 * availableModCostLen
  const possible100 = []
  for (let n = 0; n < 6; n++) {
    let maximum = stats[n]
    // can reach 100, so we want an effective way to find out how
    if (maximum >= maxBonus1) {
      possible100.push([n, 100 - maximum])
    }

    // TODO there is a bug here somewhere
    if (maximum + maxBonus >= runtime.maximumPossibleTiers[n]) {
      let minor = STAT_MOD_VALUES[(1 + (n * 2)) as StatModifier][2]
      let major = STAT_MOD_VALUES[(2 + (n * 2)) as StatModifier][2]
      for (let i = 0; i < availableModCostLen && maximum < 100; i++) {
        if (availableModCost[i] >= major) maximum += 10;
        if (availableModCost[i] >= minor && availableModCost[i] < major) maximum += 5;
      }
      if (maximum > runtime.maximumPossibleTiers[n])
        runtime.maximumPossibleTiers[n] = maximum
    }
  }

  if (availableModCostLen > 0 && possible100.length >= 3) {
    // validate if it is possible
    possible100.sort((a, b) => a[1] - b[1])

    // combinations...
    const comb3 = []
    for (let i1 = 0; i1 < possible100.length - 2; i1++) {
      let cost1 = ~~((Math.max(0, possible100[i1][1], 0) + 9) / 10);
      if (cost1 > availableModCostLen) break;

      for (let i2 = i1 + 1; i2 < possible100.length - 1; i2++) {
        let cost2 = ~~((Math.max(0, possible100[i2][1], 0) + 9) / 10);
        if (cost1 + cost2 > availableModCostLen) break;

        for (let i3 = i2 + 1; i3 < possible100.length; i3++) {
          let cost3 = ~~((Math.max(0, possible100[i3][1], 0) + 9) / 10);
          if (cost1 + cost2 + cost3 > availableModCostLen) break;


          var addedAs4x100 = false
          for (let i4 = i3 + 1; i4 < possible100.length; i4++) {
            let cost4 = ~~((Math.max(0, possible100[i4][1], 0) + 9) / 10);
            if (cost1 + cost2 + cost3 + cost4 > availableModCostLen) break;
            comb3.push([possible100[i1], possible100[i2], possible100[i3], possible100[i4]])
            addedAs4x100 = true;
          }
          if (!addedAs4x100)
            comb3.push([possible100[i1], possible100[i2], possible100[i3]])
        }
      }
    }


    for (let combination of comb3) {
      var requiredModCosts = [0, 0, 0, 0, 0, 0]
      let requiredModCostsCount = 0

      for (let i = 0; i < combination.length; i++) {
        if (combination[i][1] <= 0)
          continue
        const data = combination[i]
        const id = data[0]
        let minor = STAT_MOD_VALUES[(1 + (id * 2)) as StatModifier][2]
        let major = STAT_MOD_VALUES[(2 + (id * 2)) as StatModifier][2]

        const valueToOvercome = Math.max(0, data[1]);
        let amountMajor = ~~(valueToOvercome / 10);
        let amountMinor = valueToOvercome % 10;
        if (amountMinor > 5) {
          amountMajor++;
        } else if (amountMinor > 0) {
          requiredModCosts[minor]++;
          requiredModCostsCount++;
        }

        for (let k = 0; k < amountMajor; k++) {
          requiredModCosts[major]++;
          requiredModCostsCount++;
        }
      }
      const majorMapping = [0, 0, 0, 1, 2, 2]
      const usedCostIdx = [false, false, false, false, false]
      //if (combination.where(d => d[0] == 4).length > 0) console.log("01", {usedCostIdx, possible100, combination, availableModCostLen, requiredModCosts, requiredModCostsCount})

      if (requiredModCostsCount > availableModCostLen)
        continue;

      for (let costIdx = 5; costIdx >= 3; costIdx--) {
        let costAmount = requiredModCosts[costIdx];
        if (costAmount == 0) continue
        let dat = availableModCost
          .map((d, i) => [d, i])
          .filter(([d, index]) => (!usedCostIdx[index]) && d >= costIdx)

        //if (combination.where(d => d[0] == 4).length > 0)  console.log("01 >>","log",  costAmount, dat.length, dat, costAmount)
        let origCostAmount = costAmount
        for (let n = 0; (n < origCostAmount) && (n < dat.length); n++) {
          usedCostIdx[dat[n][1]] = true;
          costAmount--;
        }
        for (let n = 0; n < costAmount; n++) {
          requiredModCosts[costIdx]--;
          requiredModCosts[majorMapping[costIdx]] += 2;
          requiredModCostsCount++;
        }
        if (requiredModCostsCount > availableModCostLen)
          break;
      }
      // 3x100 possible
      if (requiredModCostsCount <= availableModCostLen) {
        runtime.statCombo3x100.add((1 << combination[0][0]) + (1 << combination[1][0]) + (1 << combination[2][0]));
        if (combination.length > 3)
          runtime.statCombo4x100.add((1 << combination[0][0]) + (1 << combination[1][0]) + (1 << combination[2][0]) + (1 << combination[3][0]));
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
        .where(t => availableModCost.where(d => d >= STAT_MOD_VALUES[(1 + (t[1] * 2)) as StatModifier][2]).length > 0)
        .filter(t => t[0] >= 5 && t[2] < 100)
        .sort((a, b) => a[0] - b[0])[0]
      if (!result) break;

      // Ignore this if it would bring us over the fixed stat tier
      if (config.minimumStatTiers[result[1] as ArmorStat].fixed && (stats[result[1]] + 5) / 10 >= config.minimumStatTiers[result[1] as ArmorStat].value + 1) {
        result[0] -= 5;
        continue;
      }

      const modCost = availableModCost.where(d => d >= STAT_MOD_VALUES[(1 + (result[1] * 2)) as StatModifier][2])[0]
      availableModCost.splice(availableModCost.indexOf(modCost), 1);
      availableModCostLen--;
      stats[result[1]] += 5
      result[0] -= 5;
      usedMods.insert(1 + 2 * result[1])
    }
  }


  const waste1 = getWaste(stats);
  if (config.onlyShowResultsWithNoWastedStats && waste1 > 0)
    return null;

  const exotic = helmet.containsExotics ? helmet : gauntlet.containsExotics ? gauntlet : chest.containsExotics ? chest : leg.containsExotics ? leg : null
  if (!exotic && config.selectedExotics.indexOf(FORCE_USE_ANY_EXOTIC) != -1) {
    return null;
  }
  
  return { 
    exotic: exotic == null ? [] : [{
      icon: exotic?.items[0].icon,
      watermark: exotic?.items[0].watermarkIcon,
      name: exotic?.items[0].name,
      hash: exotic?.items[0].hash
    }],
    modCount: usedMods.length,
    modCost: usedMods.list.reduce((p, d: StatModifier) => p + STAT_MOD_VALUES[d][2], 0),
    mods: usedMods.list,
    stats: stats,
    statsNoMods: statsWithoutMods,
    tiers: getSkillTier(stats),
    waste: waste1,
    items: items.map(i => i.items).flat().reduce((p: any, instance) => {
      p[instance.slot - 1].push({
        energy: instance.energyAffinity,
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
