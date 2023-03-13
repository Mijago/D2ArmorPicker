import {handlePermutation, ItemCombination} from "./results-builder.worker";
import {DestinyClass, TierType} from "bungie-api-ts/destiny2";
import {ArmorSlot} from "../data/enum/armor-slot";
import {ArmorPerkOrSlot, ArmorStat} from "../data/enum/armor-stat";
import {BuildConfiguration} from "../data/buildConfiguration";

const plugs = [[1, 1, 10], [1, 1, 11], [1, 1, 12], [1, 1, 13], [1, 1, 14], [1, 1, 15],
  [1, 5, 5], [1, 5, 6], [1, 5, 7], [1, 5, 8], [1, 5, 9], [1, 5, 10],
  [1, 5, 11], [1, 6, 5], [1, 6, 6], [1, 6, 7], [1, 6, 8], [1, 6, 9],
  [1, 7, 5], [1, 7, 6], [1, 7, 7], [1, 7, 8], [1, 8, 5], [1, 8, 6],
  [1, 8, 7], [1, 9, 5], [1, 9, 6], [1, 10, 1], [1, 10, 5], [1, 11, 1],
  [1, 11, 5], [1, 12, 1], [1, 13, 1], [1, 14, 1], [1, 15, 1], [5, 1, 5],
  [5, 1, 6], [5, 1, 7], [5, 1, 8], [5, 1, 9], [5, 1, 10], [5, 1, 11],
  [5, 5, 1], [5, 5, 5], [5, 6, 1], [5, 7, 1], [5, 8, 1], [5, 9, 1],
  [5, 10, 1], [5, 11, 1], [6, 1, 5], [6, 1, 6], [6, 1, 7], [6, 1, 8],
  [6, 1, 9], [6, 5, 1], [6, 6, 1], [6, 7, 1], [6, 8, 1], [6, 9, 1],
  [7, 1, 5], [7, 1, 6], [7, 1, 7], [7, 1, 8], [7, 5, 1], [7, 6, 1],
  [7, 7, 1], [7, 8, 1], [8, 1, 5], [8, 1, 6], [8, 1, 7], [8, 5, 1],
  [8, 6, 1], [8, 7, 1], [9, 1, 5], [9, 1, 6], [9, 5, 1], [9, 6, 1],
  [10, 1, 1], [10, 1, 5], [10, 5, 1], [11, 1, 1], [11, 1, 5], [11, 5, 1],
  [12, 1, 1], [13, 1, 1], [14, 1, 1], [15, 1, 1]];


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


function generateRandomStats() {
  // pick 4 random plugs
  const randomPlugs = [];
  for (let i = 0; i < 4; i++) {
    randomPlugs.push(plugs[Math.floor(Math.random() * plugs.length)]);
  }

  // calculate the stats
  const stats = [
    randomPlugs[0][0] + randomPlugs[1][0],
    randomPlugs[0][1] + randomPlugs[1][1],
    randomPlugs[0][2] + randomPlugs[1][2],
    randomPlugs[2][0] + randomPlugs[3][0],
    randomPlugs[2][1] + randomPlugs[3][1],
    randomPlugs[2][2] + randomPlugs[3][2],
  ];
  return stats;
}

function randomPerk() {
  // pick random number
  const random = Math.floor(Math.random() * 100);
  if (random < 50) {
    return ArmorPerkOrSlot.SlotArtifice
  }
  return undefined
}

function generateRandomBuild() {
  return [
    buildTestItem(ArmorSlot.ArmorSlotHelmet, false, generateRandomStats(), randomPerk()),
    buildTestItem(ArmorSlot.ArmorSlotGauntlet, false, generateRandomStats(), randomPerk()),
    buildTestItem(ArmorSlot.ArmorSlotChest, false, generateRandomStats(), randomPerk()),
    buildTestItem(ArmorSlot.ArmorSlotLegs, false, generateRandomStats(), randomPerk()),
  ];
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

  it('should be able to give correct build presets', () => {
    // this is an edge case in which the artifice mod, which initially will be applied to
    // mobility, must be moved to Recovery. Otherwise, this set would not be possible.


    for (let n = 0; n < 100; n++) {
      let runtime = buildRuntime()
      const mockItems = generateRandomBuild()

      const config = new BuildConfiguration()
      config.tryLimitWastedStats = true
      //config.onlyShowResultsWithNoWastedStats = true

      const constantBonus1 = [0, 0, 0, 0, 0, 0];
      let availableModCost = [
        // random 0-5
        Math.floor(Math.random() * 6),
        Math.floor(Math.random() * 6),
        Math.floor(Math.random() * 6),
        Math.floor(Math.random() * 6),
        Math.floor(Math.random() * 6)
      ]
      availableModCost = [5, 5, 5, 5, 5]
      let result = handlePermutation(runtime, config, mockItems[0], mockItems[1], mockItems[2], mockItems[3],
        constantBonus1, availableModCost, false, true)

      // grab the runtime.maximumPossibleTiers and iterate over them to see if it correctly fills them
      // first, pick a random order
      const order = [0, 1, 2, 3, 4, 5].sort(() => Math.random() - 0.5)
      console.log(n, "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~")
      console.log(n, "Order", order)
      console.log(n, "availableModCost", availableModCost)

      for (let statId of order) {
        console.log("~~~~~~ stat id", statId, "set to stats", runtime.maximumPossibleTiers.map(x => Math.floor(x / 10)))
        config.minimumStatTiers[statId as ArmorStat].value = Math.floor(runtime.maximumPossibleTiers[statId] / 10)

        runtime = buildRuntime()
        let result = handlePermutation(runtime, config, mockItems[0], mockItems[1], mockItems[2], mockItems[3],
          constantBonus1, availableModCost, false, true)
        expect(result).toBeDefined()
        expect(result).not.toBeNull()
        expect(result.mods.length).toBeLessThanOrEqual(5)
        if (!result) {
          console.log("Failed to find a build with minimumStatTiers", config.minimumStatTiers)
          console.log("RUN", n)
          console.log("availableModCost", availableModCost)
          console.log("base stats", [
            10 + mockItems[0].items[0].mobility + mockItems[1].items[0].mobility + mockItems[2].items[0].mobility + mockItems[3].items[0].mobility,
            10 + mockItems[0].items[0].resilience + mockItems[1].items[0].resilience + mockItems[2].items[0].resilience + mockItems[3].items[0].resilience,
            10 + mockItems[0].items[0].recovery + mockItems[1].items[0].recovery + mockItems[2].items[0].recovery + mockItems[3].items[0].recovery,
            10 + mockItems[0].items[0].discipline + mockItems[1].items[0].discipline + mockItems[2].items[0].discipline + mockItems[3].items[0].discipline,
            10 + mockItems[0].items[0].intellect + mockItems[1].items[0].intellect + mockItems[2].items[0].intellect + mockItems[3].items[0].intellect,
            10 + mockItems[0].items[0].strength + mockItems[1].items[0].strength + mockItems[2].items[0].strength + mockItems[3].items[0].strength
          ])
          console.log("target stats", [
            config.minimumStatTiers[ArmorStat.Mobility].value * 10,
            config.minimumStatTiers[ArmorStat.Resilience].value * 10,
            config.minimumStatTiers[ArmorStat.Recovery].value * 10,
            config.minimumStatTiers[ArmorStat.Discipline].value * 10,
            config.minimumStatTiers[ArmorStat.Intellect].value * 10,
            config.minimumStatTiers[ArmorStat.Strength].value * 10
          ])
          console.log("Available artifice mods",
            mockItems.map(item => item.perks.length > 0 ? 1 : 0).reduce((a, b) => a + b, 0 as number)
          )
          console.log("------------------------------------------------------------------------")
          console.log("------------------------------------------------------------------------")
          console.log("------------------------------------------------------------------------")
          break
        }
      }
    }
  })


  it('should swap mods around', () => {
    // this is an edge case in which the artifice mod, which initially will be applied to
    // mobility, must be moved to Recovery. Otherwise, this set would not be possible.

    const runtime = buildRuntime()

    const mockItems: ItemCombination[] = [
      buildTestItem(ArmorSlot.ArmorSlotHelmet, false, [13, 14, 4, 17, 9, 8]),
      buildTestItem(ArmorSlot.ArmorSlotGauntlet, false, [8, 16, 11, 22, 4, 14]),
      buildTestItem(ArmorSlot.ArmorSlotChest, true, [9, 13, 10, 18, 4, 8]),
      buildTestItem(ArmorSlot.ArmorSlotLegs, false, [19, 4, 9, 12, 4, 17]),
    ]

    const config = new BuildConfiguration()
    config.assumeLegendariesMasterworked = true;
    config.assumeExoticsMasterworked = true;
    config.assumeClassItemMasterworked = true;
    config.minimumStatTiers[ArmorStat.Mobility].value = 0
    config.minimumStatTiers[ArmorStat.Resilience].value = 9
    config.minimumStatTiers[ArmorStat.Recovery].value = 10
    config.minimumStatTiers[ArmorStat.Discipline].value = 7
    config.minimumStatTiers[ArmorStat.Intellect].value = 0
    config.minimumStatTiers[ArmorStat.Strength].value = 0

    // calculate the stat sum of mockItems
    const statSum = [
      mockItems[0].items[0].mobility + mockItems[1].items[0].mobility + mockItems[2].items[0].mobility + mockItems[3].items[0].mobility,
      mockItems[0].items[0].resilience + mockItems[1].items[0].resilience + mockItems[2].items[0].resilience + mockItems[3].items[0].resilience,
      mockItems[0].items[0].recovery + mockItems[1].items[0].recovery + mockItems[2].items[0].recovery + mockItems[3].items[0].recovery,
      mockItems[0].items[0].discipline + mockItems[1].items[0].discipline + mockItems[2].items[0].discipline + mockItems[3].items[0].discipline,
      mockItems[0].items[0].intellect + mockItems[1].items[0].intellect + mockItems[2].items[0].intellect + mockItems[3].items[0].intellect,
      mockItems[0].items[0].strength + mockItems[1].items[0].strength + mockItems[2].items[0].strength + mockItems[3].items[0].strength
    ]
    console.log("statSum", statSum)


    //const constantBonus = [-10, -10, -10, -10, -10, -10];
    const constantBonus = [-8, -8, -8, -8, -8, -8];
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
    expect(result.mods.length).toBeLessThanOrEqual(5)
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
});
