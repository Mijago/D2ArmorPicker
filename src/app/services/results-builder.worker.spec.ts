import {handlePermutation, ItemCombination} from "./results-builder.worker";
import {DestinyClass, TierType} from "bungie-api-ts/destiny2";
import {ArmorSlot} from "../data/enum/armor-slot";
import {ArmorPerkOrSlot, ArmorStat} from "../data/enum/armor-stat";
import {BuildConfiguration} from "../data/buildConfiguration";


function buildTestItem(slot: ArmorSlot, isExotic: boolean, stats: number[], perk: ArmorPerkOrSlot = ArmorPerkOrSlot.None): ItemCombination {
  return new ItemCombination([{
    name: "item_" + slot,
    armor2: true,
    clazz: DestinyClass.Titan,
    description: "",
    slot: slot,
    mobility: stats[0],
    resilience: stats[1],
    recovery: stats[2],
    discipline: stats[3],
    intellect: stats[4],
    strength: stats[5],
    energyLevel: 10,
    hash: 0,
    icon: "",
    exoticPerkHash: 0,
    id: 0,
    investmentStats: [],
    itemInstanceId: "",
    isExotic: isExotic ? 1 : 0,
    isSunset: false,
    itemType: 0,
    itemSubType: 0,
    masterworked: true,
    perk: perk,
    mayBeBugged: false,
    rarity: TierType.Superior,
    rawData: undefined,
    statPlugHashes: [],
    watermarkIcon: ""
  }])
}

function buildRuntime() {
  return {
    maximumPossibleTiers: [0, 0, 0, 0, 0, 0],
    statCombo3x100: new Set(),
    statCombo4x100: new Set(),
  };
}

describe('Results Worker', () => {


  it('should swap mods around to see replace old mods', () => {
    // this is an edge case in which the artifice mod, which initially will be applied to
    // mobility, must be moved to Recovery. Otherwise, this set would not be possible.

    const runtime = buildRuntime()

    const mockItems: ItemCombination[] = [
      buildTestItem(ArmorSlot.ArmorSlotHelmet, false, [2, 12, 20, 20, 9, 2]),
      buildTestItem(ArmorSlot.ArmorSlotGauntlet, false, [2, 30, 2, 26, 6, 2]),
      buildTestItem(ArmorSlot.ArmorSlotChest, true, [2, 11, 21, 17, 10, 8]),
      buildTestItem(ArmorSlot.ArmorSlotLegs, false, [2, 7, 24, 15, 15, 2]),
    ]

    const config = new BuildConfiguration()
    config.minimumStatTiers[ArmorStat.Mobility].value = 2
    config.minimumStatTiers[ArmorStat.Resilience].value = 10
    config.minimumStatTiers[ArmorStat.Recovery].value = 8
    config.minimumStatTiers[ArmorStat.Discipline].value = 9
    config.minimumStatTiers[ArmorStat.Intellect].value = 5
    config.minimumStatTiers[ArmorStat.Strength].value = 2

    let result = handlePermutation(
      runtime,
      config, // todo config
      mockItems[0],
      mockItems[1],
      mockItems[2],
      mockItems[3],
      [0, 0, 0, 0, 0, 0], // constant bonus
      [5, 5, 5, 1, 1], // availableModCost
      false, // doNotOutput
      true // hasArtificeClassItem
    )
    expect(result).toBeDefined()
    expect(result.mods.length).toEqual(5)
    expect(result.artifice.length).toEqual(1)
    expect(result.stats[0]).toBeGreaterThanOrEqual(config.minimumStatTiers[ArmorStat.Mobility].value * 10)
    expect(result.stats[1]).toBeGreaterThanOrEqual(config.minimumStatTiers[ArmorStat.Resilience].value * 10)
    expect(result.stats[2]).toBeGreaterThanOrEqual(config.minimumStatTiers[ArmorStat.Recovery].value * 10)
    expect(result.stats[3]).toBeGreaterThanOrEqual(config.minimumStatTiers[ArmorStat.Discipline].value * 10)
    expect(result.stats[4]).toBeGreaterThanOrEqual(config.minimumStatTiers[ArmorStat.Intellect].value * 10)
    expect(result.stats[5]).toBeGreaterThanOrEqual(config.minimumStatTiers[ArmorStat.Strength].value * 10)
  });
  it('should swap 3x artifice mods around to replace old mods', () => {
    // this is an edge case in which the artifice mod, which initially will be applied to
    // mobility, must be moved to Recovery. Otherwise, this set would not be possible.

    const runtime = buildRuntime()

    const mockItems: ItemCombination[] = [
      buildTestItem(ArmorSlot.ArmorSlotHelmet, true, [6, 27, 3, 19, 7, 6]),
      buildTestItem(ArmorSlot.ArmorSlotGauntlet, false, [2, 10, 21, 24, 2, 7], ArmorPerkOrSlot.SlotArtifice),
      buildTestItem(ArmorSlot.ArmorSlotChest, false, [6, 2, 23, 28, 2, 2], ArmorPerkOrSlot.SlotArtifice),
      buildTestItem(ArmorSlot.ArmorSlotLegs, false, [11, 12, 10, 21, 8, 2], ArmorPerkOrSlot.SlotArtifice),
    ]

    const config = new BuildConfiguration()
    config.minimumStatTiers[ArmorStat.Mobility].value = 6
    config.minimumStatTiers[ArmorStat.Resilience].value = 6
    config.minimumStatTiers[ArmorStat.Recovery].value = 10
    config.minimumStatTiers[ArmorStat.Discipline].value = 10
    config.minimumStatTiers[ArmorStat.Intellect].value = 0
    config.minimumStatTiers[ArmorStat.Strength].value = 0

    let result = handlePermutation(
      runtime,
      config, // todo config
      mockItems[0],
      mockItems[1],
      mockItems[2],
      mockItems[3],
      [0, 0, 0, 0, 0, 0], // constant bonus
      [5, 5, 5, 5, 5], // availableModCost
      false, // doNotOutput
      true // hasArtificeClassItem
    )
    expect(result).toBeDefined()
    expect(result.stats[0]).toBeGreaterThanOrEqual(config.minimumStatTiers[ArmorStat.Mobility].value * 10)
    expect(result.stats[1]).toBeGreaterThanOrEqual(config.minimumStatTiers[ArmorStat.Resilience].value * 10)
    expect(result.stats[2]).toBeGreaterThanOrEqual(config.minimumStatTiers[ArmorStat.Recovery].value * 10)
    expect(result.stats[3]).toBeGreaterThanOrEqual(config.minimumStatTiers[ArmorStat.Discipline].value * 10)
    expect(result.stats[4]).toBeGreaterThanOrEqual(config.minimumStatTiers[ArmorStat.Intellect].value * 10)
    expect(result.stats[5]).toBeGreaterThanOrEqual(config.minimumStatTiers[ArmorStat.Strength].value * 10)
  });
  it('should swap 3x artifice mods around to replace old mods v2', () => {
    // this is an edge case in which the artifice mod, which initially will be applied to
    // mobility, must be moved to Recovery. Otherwise, this set would not be possible.

    const runtime = buildRuntime()

    const mockItems: ItemCombination[] = [
      buildTestItem(ArmorSlot.ArmorSlotHelmet, false, [13, 16, 2, 24, 2, 7], ArmorPerkOrSlot.SlotArtifice),
      buildTestItem(ArmorSlot.ArmorSlotGauntlet, false, [26, 6, 2, 26, 2, 2], ArmorPerkOrSlot.SlotArtifice),
      buildTestItem(ArmorSlot.ArmorSlotChest, true, [6, 24, 2, 17, 7, 7]),
      buildTestItem(ArmorSlot.ArmorSlotLegs, false, [22, 9, 2, 24, 2, 6], ArmorPerkOrSlot.SlotArtifice),
    ]

    const config = new BuildConfiguration()
    config.minimumStatTiers[ArmorStat.Mobility].value = 9
    config.minimumStatTiers[ArmorStat.Resilience].value = 10
    config.minimumStatTiers[ArmorStat.Recovery].value = 0
    config.minimumStatTiers[ArmorStat.Discipline].value = 10
    config.minimumStatTiers[ArmorStat.Intellect].value = 0
    config.minimumStatTiers[ArmorStat.Strength].value = 0

    const constantBonus = [-10, 0, 10, 0, 0, -10];
    let result = handlePermutation(
      runtime,
      config, // todo config
      mockItems[0],
      mockItems[1],
      mockItems[2],
      mockItems[3],
      constantBonus, // constant bonus
      [5, 5, 5, 5, 5], // availableModCost
      false, // doNotOutput
      true // hasArtificeClassItem
    )
    expect(result).toBeDefined()
    console.log(result)
    expect(result.stats[0]).toBeGreaterThanOrEqual(config.minimumStatTiers[ArmorStat.Mobility].value * 10)
    expect(result.stats[1]).toBeGreaterThanOrEqual(config.minimumStatTiers[ArmorStat.Resilience].value * 10)
    expect(result.stats[2]).toBeGreaterThanOrEqual(config.minimumStatTiers[ArmorStat.Recovery].value * 10)
    expect(result.stats[3]).toBeGreaterThanOrEqual(config.minimumStatTiers[ArmorStat.Discipline].value * 10)
    expect(result.stats[4]).toBeGreaterThanOrEqual(config.minimumStatTiers[ArmorStat.Intellect].value * 10)
    expect(result.stats[5]).toBeGreaterThanOrEqual(config.minimumStatTiers[ArmorStat.Strength].value * 10)


    for (let n = 0; n < 6; n++) {
      const minor = 1 * result.mods.filter((mod: number) => Math.floor(mod / 3) == n && mod % 3 == 1).length
      const major = 1 * result.mods.filter((mod: number) => Math.floor(mod / 3) == n && mod % 3 == 2).length
      const artif = 1 * result.artifice.filter((mod: number) => Math.floor(mod / 3) - 1 == n && mod % 3 == 0).length
      expect(result.stats[n]).toEqual(result.statsNoMods[n] + 5 * minor + 10 * major + 3 * artif + constantBonus[n])
    }
  });


  it('should be able to keep plain zero-waste builds', () => {
    // this is an edge case in which the artifice mod, which initially will be applied to
    // mobility, must be moved to Recovery. Otherwise, this set would not be possible.

    const runtime = buildRuntime()

    const mockItems: ItemCombination[] = [
      buildTestItem(ArmorSlot.ArmorSlotHelmet, false, [8, 9, 16, 23, 2, 8]),
      buildTestItem(ArmorSlot.ArmorSlotGauntlet, false, [2, 9, 20, 26, 6, 2]),
      buildTestItem(ArmorSlot.ArmorSlotChest, true, [7, 2, 23, 21, 10, 2]),
      buildTestItem(ArmorSlot.ArmorSlotLegs, true, [3, 20, 11, 20, 2, 8]),
    ]

    const config = new BuildConfiguration()
    config.tryLimitWastedStats = true
    config.onlyShowResultsWithNoWastedStats = true

    let result = handlePermutation(
      runtime,
      config, // todo config
      mockItems[0],
      mockItems[1],
      mockItems[2],
      mockItems[3],
      [0, 0, 0, 0, 0, 0], // constant bonus
      [5, 5, 5, 5, 5], // availableModCost
      false, // doNotOutput
      true // hasArtificeClassItem
    )
    expect(result).toBeDefined()
    expect(result).not.toBeNull()
  });

  it('should be able to solve complex zero-waste builds', () => {
    // this is an edge case in which the artifice mod, which initially will be applied to
    // mobility, must be moved to Recovery. Otherwise, this set would not be possible.

    const runtime = buildRuntime()

    const mockItems: ItemCombination[] = [
      buildTestItem(ArmorSlot.ArmorSlotHelmet, false, [8, 9, 16, 23, 2, 8]),
      buildTestItem(ArmorSlot.ArmorSlotGauntlet, false, [2, 9, 20, 26, 6, 2]),
      buildTestItem(ArmorSlot.ArmorSlotChest, true, [7, 2, 23, 21, 10, 2]),
      buildTestItem(ArmorSlot.ArmorSlotLegs, true, [3, 20, 11, 20, 2, 8]),
    ]

    // the numbers currently sum to 0; now we artifically reduce them to enforce wasted stats calculation
    mockItems[0].items[0].mobility -= 5 + 3 // a minor mod + artifice mod
    mockItems[0].items[0].resilience -= 9 // three artifice mods
    mockItems[0].items[0].recovery -= 5 // minor mod
    mockItems[0].items[0].discipline -= 5 // minor mod
    mockItems[0].items[0].intellect -= 5 // minor mod
    mockItems[0].items[0].strength -= 5 - 3 // minor mod + artifice mod


    const config = new BuildConfiguration()
    config.tryLimitWastedStats = true
    //config.onlyShowResultsWithNoWastedStats = true

    let result = handlePermutation(
      runtime,
      config, // todo config
      mockItems[0],
      mockItems[1],
      mockItems[2],
      mockItems[3],
      [0, 0, 0, 0, 0, 0], // constant bonus
      [5, 5, 5, 5, 5], // availableModCost
      false, // doNotOutput
      true // hasArtificeClassItem
    )
    expect(result).toBeDefined()
    expect(result).not.toBeNull()
    expect(result.waste).toEqual(0)
  });


});
