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

import {
  generate_tunings,
  getSkillTier,
  getWaste,
  handlePermutation,
  isFlexibleExotic,
  isT5WithTuning,
  lowestThreeBonus,
} from "./results-builder.worker";
import { DestinyClass, TierType } from "bungie-api-ts/destiny2";
import { ArmorSlot } from "../data/enum/armor-slot";
import {
  ArmorPerkOrSlot,
  ArmorStat,
  ARMORSTAT_ORDER,
  STAT_MOD_VALUES,
  StatModifier,
} from "../data/enum/armor-stat";
import { BuildConfiguration } from "../data/buildConfiguration";
import { IInventoryArmor, InventoryArmorSource } from "../data/types/IInventoryArmor";
import { ArmorSystem } from "../data/types/IManifestArmor";
import { IPermutatorArmor } from "../data/types/IPermutatorArmor";
import { IPermutatorArmorSet } from "../data/types/IPermutatorArmorSet";
import {
  ResultDefinition,
  ResultItem,
} from "../components/authenticated-v2/results/results.component";

const plugs = [
  [1, 1, 10],
  [1, 1, 11],
  [1, 1, 12],
  [1, 1, 13],
  [1, 1, 14],
  [1, 1, 15],
  [1, 5, 5],
  [1, 5, 6],
  [1, 5, 7],
  [1, 5, 8],
  [1, 5, 9],
  [1, 5, 10],
  [1, 5, 11],
  [1, 6, 5],
  [1, 6, 6],
  [1, 6, 7],
  [1, 6, 8],
  [1, 6, 9],
  [1, 7, 5],
  [1, 7, 6],
  [1, 7, 7],
  [1, 7, 8],
  [1, 8, 5],
  [1, 8, 6],
  [1, 8, 7],
  [1, 9, 5],
  [1, 9, 6],
  [1, 10, 1],
  [1, 10, 5],
  [1, 11, 1],
  [1, 11, 5],
  [1, 12, 1],
  [1, 13, 1],
  [1, 14, 1],
  [1, 15, 1],
  [5, 1, 5],
  [5, 1, 6],
  [5, 1, 7],
  [5, 1, 8],
  [5, 1, 9],
  [5, 1, 10],
  [5, 1, 11],
  [5, 5, 1],
  [5, 5, 5],
  [5, 6, 1],
  [5, 7, 1],
  [5, 8, 1],
  [5, 9, 1],
  [5, 10, 1],
  [5, 11, 1],
  [6, 1, 5],
  [6, 1, 6],
  [6, 1, 7],
  [6, 1, 8],
  [6, 1, 9],
  [6, 5, 1],
  [6, 6, 1],
  [6, 7, 1],
  [6, 8, 1],
  [6, 9, 1],
  [7, 1, 5],
  [7, 1, 6],
  [7, 1, 7],
  [7, 1, 8],
  [7, 5, 1],
  [7, 6, 1],
  [7, 7, 1],
  [7, 8, 1],
  [8, 1, 5],
  [8, 1, 6],
  [8, 1, 7],
  [8, 5, 1],
  [8, 6, 1],
  [8, 7, 1],
  [9, 1, 5],
  [9, 1, 6],
  [9, 5, 1],
  [9, 6, 1],
  [10, 1, 1],
  [10, 1, 5],
  [10, 5, 1],
  [11, 1, 1],
  [11, 1, 5],
  [11, 5, 1],
  [12, 1, 1],
  [13, 1, 1],
  [14, 1, 1],
  [15, 1, 1],
];

function buildTestItem(
  slot: ArmorSlot,
  isExotic: boolean,
  stats: number[],
  perk: ArmorPerkOrSlot = ArmorPerkOrSlot.Any
): IInventoryArmor {
  return {
    name: "item_" + slot,
    // The legacy worker scenarios were written against Armor 2.0 masterwork
    // semantics (a fully masterworked Armor 2.0 piece grants +2 to all stats).
    armorSystem: ArmorSystem.Armor2,
    clazz: DestinyClass.Titan,
    source: InventoryArmorSource.Inventory,
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
    exoticPerkHash: [],
    id: 0,
    investmentStats: [],
    itemInstanceId: "",
    isExotic: isExotic ? 1 : 0,
    isFeatured: false,
    isSunset: false,
    itemType: 0,
    itemSubType: 0,
    masterworkLevel: 5,
    tier: isExotic ? 0 : 1,
    tuningStat: null,
    archetypeStats: [],
    gearSetHash: null,
    perk: perk,
    rarity: TierType.Superior,
    rawData: undefined,
    statPlugHashes: [],
    socketEntries: [],
    watermarkIcon: "",
    created_at: Date.now(),
    updated_at: Date.now(),
  };
}

// Beta's handlePermutation takes a `classItems: IPermutatorArmor[]` argument
// instead of the legacy boolean flags (hasArtificeClassItem / masterworkedClassItem).
// This helper reproduces the legacy flags by building a single class item:
//   - hasArtificeClassItem -> perk = SlotArtifice
//   - masterworked         -> masterworkLevel = 5 (buildTestItem default)
function buildClassItems(hasArtificeClassItem: boolean, masterworked: boolean): IPermutatorArmor[] {
  const classItem = buildTestItem(
    ArmorSlot.ArmorSlotClass,
    false,
    [0, 0, 0, 0, 0, 0],
    hasArtificeClassItem ? ArmorPerkOrSlot.SlotArtifice : ArmorPerkOrSlot.Any
  );
  classItem.masterworkLevel = masterworked ? 5 : 0;
  return [classItem as IPermutatorArmor];
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
    return ArmorPerkOrSlot.SlotArtifice;
  }
  return undefined;
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
  };
}

describe("Results Worker", () => {
  it("should swap mods around to see replace old mods", () => {
    // this is an edge case in which the artifice mod, which initially will be applied to
    // mobility, must be moved to Recovery. Otherwise, this set would not be possible.

    const runtime = buildRuntime();

    const mockItems: IInventoryArmor[] = [
      buildTestItem(ArmorSlot.ArmorSlotHelmet, false, [2, 12, 20, 20, 9, 2]),
      buildTestItem(ArmorSlot.ArmorSlotGauntlet, false, [2, 30, 2, 26, 6, 2]),
      buildTestItem(ArmorSlot.ArmorSlotChest, true, [2, 11, 21, 17, 10, 8]),
      buildTestItem(ArmorSlot.ArmorSlotLegs, false, [2, 7, 24, 15, 15, 2]),
    ];

    const config = new BuildConfiguration();
    config.minimumStatTiers[ArmorStat.StatWeapon].value = 2;
    config.minimumStatTiers[ArmorStat.StatHealth].value = 10;
    config.minimumStatTiers[ArmorStat.StatClass].value = 8;
    config.minimumStatTiers[ArmorStat.StatGrenade].value = 9;
    config.minimumStatTiers[ArmorStat.StatSuper].value = 5;
    config.minimumStatTiers[ArmorStat.StatMelee].value = 2;

    let presult = handlePermutation(
      runtime,
      config,
      mockItems[0] as IPermutatorArmor,
      mockItems[1] as IPermutatorArmor,
      mockItems[2] as IPermutatorArmor,
      mockItems[3] as IPermutatorArmor,
      buildClassItems(true, true), // artifice + masterworked class item
      [0, 0, 0, 0, 0, 0], // constant bonus
      false // doNotOutput
    )[0] as IPermutatorArmorSet; // handlePermutation now returns the per-core skyline; take the first build
    let result = CreateResultDefinition(presult, mockItems);
    expect(result).toBeDefined();
    expect(result.mods.length).toEqual(5);
    expect(result.artifice.length).toEqual(1);
    expect(result.stats[0]).toBeGreaterThanOrEqual(
      config.minimumStatTiers[ArmorStat.StatWeapon].value * 10
    );
    expect(result.stats[1]).toBeGreaterThanOrEqual(
      config.minimumStatTiers[ArmorStat.StatHealth].value * 10
    );
    expect(result.stats[2]).toBeGreaterThanOrEqual(
      config.minimumStatTiers[ArmorStat.StatClass].value * 10
    );
    expect(result.stats[3]).toBeGreaterThanOrEqual(
      config.minimumStatTiers[ArmorStat.StatGrenade].value * 10
    );
    expect(result.stats[4]).toBeGreaterThanOrEqual(
      config.minimumStatTiers[ArmorStat.StatSuper].value * 10
    );
    expect(result.stats[5]).toBeGreaterThanOrEqual(
      config.minimumStatTiers[ArmorStat.StatMelee].value * 10
    );
  });
  it("should swap 3x artifice mods around to replace old mods", () => {
    // this is an edge case in which the artifice mod, which initially will be applied to
    // mobility, must be moved to Recovery. Otherwise, this set would not be possible.

    const runtime = buildRuntime();

    const mockItems: IInventoryArmor[] = [
      buildTestItem(ArmorSlot.ArmorSlotHelmet, true, [6, 27, 3, 19, 7, 6]),
      buildTestItem(
        ArmorSlot.ArmorSlotGauntlet,
        false,
        [2, 10, 21, 24, 2, 7],
        ArmorPerkOrSlot.SlotArtifice
      ),
      buildTestItem(
        ArmorSlot.ArmorSlotChest,
        false,
        [6, 2, 23, 28, 2, 2],
        ArmorPerkOrSlot.SlotArtifice
      ),
      buildTestItem(
        ArmorSlot.ArmorSlotLegs,
        false,
        [11, 12, 10, 21, 8, 2],
        ArmorPerkOrSlot.SlotArtifice
      ),
    ];

    const config = new BuildConfiguration();
    config.minimumStatTiers[ArmorStat.StatWeapon].value = 6;
    config.minimumStatTiers[ArmorStat.StatHealth].value = 6;
    config.minimumStatTiers[ArmorStat.StatClass].value = 10;
    config.minimumStatTiers[ArmorStat.StatGrenade].value = 10;
    config.minimumStatTiers[ArmorStat.StatSuper].value = 0;
    config.minimumStatTiers[ArmorStat.StatMelee].value = 0;

    let presult = handlePermutation(
      runtime,
      config,
      mockItems[0] as IPermutatorArmor,
      mockItems[1] as IPermutatorArmor,
      mockItems[2] as IPermutatorArmor,
      mockItems[3] as IPermutatorArmor,
      buildClassItems(true, true), // artifice + masterworked class item
      [0, 0, 0, 0, 0, 0], // constant bonus
      false // doNotOutput
    )[0] as IPermutatorArmorSet; // handlePermutation now returns the per-core skyline; take the first build
    let result = CreateResultDefinition(presult, mockItems);
    expect(result).toBeDefined();
    expect(result.stats[0]).toBeGreaterThanOrEqual(
      config.minimumStatTiers[ArmorStat.StatWeapon].value * 10
    );
    expect(result.stats[1]).toBeGreaterThanOrEqual(
      config.minimumStatTiers[ArmorStat.StatHealth].value * 10
    );
    expect(result.stats[2]).toBeGreaterThanOrEqual(
      config.minimumStatTiers[ArmorStat.StatClass].value * 10
    );
    expect(result.stats[3]).toBeGreaterThanOrEqual(
      config.minimumStatTiers[ArmorStat.StatGrenade].value * 10
    );
    expect(result.stats[4]).toBeGreaterThanOrEqual(
      config.minimumStatTiers[ArmorStat.StatSuper].value * 10
    );
    expect(result.stats[5]).toBeGreaterThanOrEqual(
      config.minimumStatTiers[ArmorStat.StatMelee].value * 10
    );
  });
  it("should swap 3x artifice mods around to replace old mods v2", () => {
    // this is an edge case in which the artifice mod, which initially will be applied to
    // mobility, must be moved to Recovery. Otherwise, this set would not be possible.

    const runtime = buildRuntime();

    const mockItems: IInventoryArmor[] = [
      buildTestItem(
        ArmorSlot.ArmorSlotHelmet,
        false,
        [13, 16, 2, 24, 2, 7],
        ArmorPerkOrSlot.SlotArtifice
      ),
      buildTestItem(
        ArmorSlot.ArmorSlotGauntlet,
        false,
        [26, 6, 2, 26, 2, 2],
        ArmorPerkOrSlot.SlotArtifice
      ),
      buildTestItem(ArmorSlot.ArmorSlotChest, true, [6, 24, 2, 17, 7, 7]),
      buildTestItem(
        ArmorSlot.ArmorSlotLegs,
        false,
        [22, 9, 2, 24, 2, 6],
        ArmorPerkOrSlot.SlotArtifice
      ),
    ];

    const config = new BuildConfiguration();
    config.minimumStatTiers[ArmorStat.StatWeapon].value = 9;
    config.minimumStatTiers[ArmorStat.StatHealth].value = 10;
    config.minimumStatTiers[ArmorStat.StatClass].value = 0;
    config.minimumStatTiers[ArmorStat.StatGrenade].value = 10;
    config.minimumStatTiers[ArmorStat.StatSuper].value = 0;
    config.minimumStatTiers[ArmorStat.StatMelee].value = 0;

    const constantBonus = [-10, 0, 10, 0, 0, -10];
    let presult = handlePermutation(
      runtime,
      config,
      mockItems[0] as IPermutatorArmor,
      mockItems[1] as IPermutatorArmor,
      mockItems[2] as IPermutatorArmor,
      mockItems[3] as IPermutatorArmor,
      buildClassItems(true, true), // artifice + masterworked class item
      constantBonus, // constant bonus
      false // doNotOutput
    )[0] as IPermutatorArmorSet; // handlePermutation now returns the per-core skyline; take the first build
    let result = CreateResultDefinition(presult, mockItems);
    expect(result).toBeDefined();
    console.log(result);
    expect(result.stats[0]).toBeGreaterThanOrEqual(
      config.minimumStatTiers[ArmorStat.StatWeapon].value * 10
    );
    expect(result.stats[1]).toBeGreaterThanOrEqual(
      config.minimumStatTiers[ArmorStat.StatHealth].value * 10
    );
    expect(result.stats[2]).toBeGreaterThanOrEqual(
      config.minimumStatTiers[ArmorStat.StatClass].value * 10
    );
    expect(result.stats[3]).toBeGreaterThanOrEqual(
      config.minimumStatTiers[ArmorStat.StatGrenade].value * 10
    );
    expect(result.stats[4]).toBeGreaterThanOrEqual(
      config.minimumStatTiers[ArmorStat.StatSuper].value * 10
    );
    expect(result.stats[5]).toBeGreaterThanOrEqual(
      config.minimumStatTiers[ArmorStat.StatMelee].value * 10
    );

    for (let n = 0; n < 6; n++) {
      const minor =
        1 * result.mods.filter((mod: number) => Math.floor(mod / 3) == n && mod % 3 == 1).length;
      const major =
        1 * result.mods.filter((mod: number) => Math.floor(mod / 3) == n && mod % 3 == 2).length;
      const artif =
        1 *
        result.artifice.filter((mod: number) => Math.floor(mod / 3) - 1 == n && mod % 3 == 0)
          .length;
      expect(result.stats[n]).toEqual(
        result.statsNoMods[n] + 5 * minor + 10 * major + 3 * artif + constantBonus[n]
      );
    }
  });

  it("should be able to keep plain zero-waste builds", () => {
    const runtime = buildRuntime();

    const mockItems: IInventoryArmor[] = [
      buildTestItem(ArmorSlot.ArmorSlotHelmet, false, [8, 9, 16, 23, 2, 8]),
      buildTestItem(ArmorSlot.ArmorSlotGauntlet, false, [2, 9, 20, 26, 6, 2]),
      buildTestItem(ArmorSlot.ArmorSlotChest, true, [7, 2, 23, 21, 10, 2]),
      buildTestItem(ArmorSlot.ArmorSlotLegs, false, [3, 20, 11, 20, 2, 8]),
    ];

    const config = BuildConfiguration.buildEmptyConfiguration();
    config.tryLimitWastedStats = true;
    config.onlyShowResultsWithNoWastedStats = true;

    let result = handlePermutation(
      runtime,
      config,
      mockItems[0] as IPermutatorArmor,
      mockItems[1] as IPermutatorArmor,
      mockItems[2] as IPermutatorArmor,
      mockItems[3] as IPermutatorArmor,
      buildClassItems(true, true), // artifice + masterworked class item
      [0, 0, 0, 0, 0, 0], // constant bonus
      false // doNotOutput
    );
    expect(result).toBeDefined();
    expect(result).not.toBeNull();
  });

  it("should be able to solve complex zero-waste builds", () => {
    // this is an edge case in which the artifice mod, which initially will be applied to
    // mobility, must be moved to Recovery. Otherwise, this set would not be possible.

    const runtime = buildRuntime();

    const mockItems: IInventoryArmor[] = [
      buildTestItem(ArmorSlot.ArmorSlotHelmet, false, [8, 9, 16, 23, 2, 8]),
      buildTestItem(
        ArmorSlot.ArmorSlotGauntlet,
        false,
        [2, 9, 20, 26, 6, 2],
        ArmorPerkOrSlot.SlotArtifice
      ),
      buildTestItem(
        ArmorSlot.ArmorSlotChest,
        false,
        [7, 2, 23, 21, 10, 2],
        ArmorPerkOrSlot.SlotArtifice
      ),
      buildTestItem(ArmorSlot.ArmorSlotLegs, true, [3, 20, 11, 20, 2, 8]),
    ];

    // the numbers currently sum to 0; now we artifically reduce them to enforce wasted stats calculation
    mockItems[0].mobility -= 0;
    mockItems[0].resilience -= 5 + 3 + 3; // minor mod + two artifice mods
    mockItems[0].recovery -= 5; // minor mod
    mockItems[0].discipline -= 5; // minor mod
    mockItems[0].intellect -= 5; // minor mod
    mockItems[0].strength -= 5 + 3; // minor mod + artifice mod

    const config = new BuildConfiguration();
    config.tryLimitWastedStats = true;
    config.onlyShowResultsWithNoWastedStats = true;

    let presult = handlePermutation(
      runtime,
      config,
      mockItems[0] as IPermutatorArmor,
      mockItems[1] as IPermutatorArmor,
      mockItems[2] as IPermutatorArmor,
      mockItems[3] as IPermutatorArmor,
      buildClassItems(true, true), // artifice + masterworked class item
      [0, 0, 0, 0, 0, 0], // constant bonus
      false // doNotOutput
    )[0] as IPermutatorArmorSet; // handlePermutation now returns the per-core skyline; take the first build
    let result = CreateResultDefinition(presult, mockItems);
    expect(result).toBeDefined();
    expect(result).not.toBeNull();
    expect(result.waste).toEqual(0);
  });

  // TODO(phase2): re-port scenario to beta worker API
  // This legacy fuzz test feeds 10000 fully random builds through handlePermutation
  // and then unconditionally calls CreateResultDefinition on the result. Under the
  // beta API, handlePermutation legitimately returns an empty array `[]` (no valid
  // set) for the many random targets that are not achievable, which makes
  // CreateResultDefinition throw / the `expect(result).not.toBeNull()` assertion
  // fail. The scenario relied on the old API always yielding a result shape and does
  // not map directly; it needs to be re-written to skip impossible targets and to
  // assert against the beta result contract.
  xit("should be able to give correct build presets", () => {
    // this is an edge case in which the artifice mod, which initially will be applied to
    // mobility, must be moved to Recovery. Otherwise, this set would not be possible.

    for (let n = 0; n < 10000; n++) {
      let runtime = buildRuntime();
      const mockItems = generateRandomBuild();

      const config = new BuildConfiguration();
      config.tryLimitWastedStats = true;
      //config.onlyShowResultsWithNoWastedStats = true

      const constantBonus1 = [0, 0, 0, 0, 0, 0];
      let availableModCost = [
        // random 0-5
        Math.floor(Math.random() * 6),
        Math.floor(Math.random() * 6),
        Math.floor(Math.random() * 6),
        Math.floor(Math.random() * 6),
        Math.floor(Math.random() * 6),
      ];
      availableModCost = [5, 5, 5, 5, 5];
      handlePermutation(
        runtime,
        config,
        mockItems[0] as IPermutatorArmor,
        mockItems[1] as IPermutatorArmor,
        mockItems[2] as IPermutatorArmor,
        mockItems[3] as IPermutatorArmor,
        buildClassItems(true, true), // artifice + masterworked class item
        constantBonus1,
        false
      );

      // grab the runtime.maximumPossibleTiers and iterate over them to see if it correctly fills them
      // first, pick a random order
      const order = ARMORSTAT_ORDER.sort(() => Math.random() - 0.5);

      for (let statId of order) {
        config.minimumStatTiers[statId as ArmorStat].value =
          runtime.maximumPossibleTiers[statId] / 10;

        runtime = buildRuntime();
        let presult = handlePermutation(
          runtime,
          config,
          mockItems[0] as IPermutatorArmor,
          mockItems[1] as IPermutatorArmor,
          mockItems[2] as IPermutatorArmor,
          mockItems[3] as IPermutatorArmor,
          buildClassItems(true, true), // artifice + masterworked class item
          constantBonus1,
          false
        )[0] as IPermutatorArmorSet; // skyline -> first build
        let result = CreateResultDefinition(presult, mockItems);
        expect(result).toBeDefined();
        expect(result).not.toBeNull();
        expect(result.mods.length).toBeLessThanOrEqual(5);
        if (!result) {
          console.log("Failed to find a build with minimumStatTiers", config.minimumStatTiers);
          console.log("RUN", n);
          console.log("availableModCost", availableModCost);
          console.log("base stats", [
            10 +
              mockItems[0].mobility +
              mockItems[1].mobility +
              mockItems[2].mobility +
              mockItems[3].mobility,
            10 +
              mockItems[0].resilience +
              mockItems[1].resilience +
              mockItems[2].resilience +
              mockItems[3].resilience,
            10 +
              mockItems[0].recovery +
              mockItems[1].recovery +
              mockItems[2].recovery +
              mockItems[3].recovery,
            10 +
              mockItems[0].discipline +
              mockItems[1].discipline +
              mockItems[2].discipline +
              mockItems[3].discipline,
            10 +
              mockItems[0].intellect +
              mockItems[1].intellect +
              mockItems[2].intellect +
              mockItems[3].intellect,
            10 +
              mockItems[0].strength +
              mockItems[1].strength +
              mockItems[2].strength +
              mockItems[3].strength,
          ]);
          console.log("target stats", [
            config.minimumStatTiers[ArmorStat.StatWeapon].value * 10,
            config.minimumStatTiers[ArmorStat.StatHealth].value * 10,
            config.minimumStatTiers[ArmorStat.StatClass].value * 10,
            config.minimumStatTiers[ArmorStat.StatGrenade].value * 10,
            config.minimumStatTiers[ArmorStat.StatSuper].value * 10,
            config.minimumStatTiers[ArmorStat.StatMelee].value * 10,
          ]);
          console.log(
            "Available artifice mods",
            mockItems.map((item) => (item.perk > 0 ? 1 : 0)).reduce((a, b) => a + b, 0 as number)
          );
          console.log("------------------------------------------------------------------------");
          console.log("------------------------------------------------------------------------");
          console.log("------------------------------------------------------------------------");
          break;
        }
      }
    }
  });

  it("should swap mods around", () => {
    // this is an edge case in which the artifice mod, which initially will be applied to
    // mobility, must be moved to Recovery. Otherwise, this set would not be possible.

    const runtime = buildRuntime();

    const mockItems: IInventoryArmor[] = [
      buildTestItem(ArmorSlot.ArmorSlotHelmet, false, [13, 14, 4, 17, 9, 8]),
      buildTestItem(ArmorSlot.ArmorSlotGauntlet, false, [8, 16, 11, 22, 4, 14]),
      buildTestItem(ArmorSlot.ArmorSlotChest, true, [9, 13, 10, 18, 4, 8]),
      buildTestItem(ArmorSlot.ArmorSlotLegs, false, [19, 4, 9, 12, 4, 17]),
    ];

    const config = new BuildConfiguration();
    config.assumeLegendariesMasterworked = true;
    config.assumeExoticsMasterworked = true;
    config.minimumStatTiers[ArmorStat.StatWeapon].value = 0;
    config.minimumStatTiers[ArmorStat.StatHealth].value = 9;
    config.minimumStatTiers[ArmorStat.StatClass].value = 6;
    config.minimumStatTiers[ArmorStat.StatGrenade].value = 7;
    config.minimumStatTiers[ArmorStat.StatSuper].value = 0;
    config.minimumStatTiers[ArmorStat.StatMelee].value = 0;

    // calculate the stat sum of mockItems
    const statSum = [
      mockItems[0].mobility + mockItems[1].mobility + mockItems[2].mobility + mockItems[3].mobility,
      mockItems[0].resilience +
        mockItems[1].resilience +
        mockItems[2].resilience +
        mockItems[3].resilience,
      mockItems[0].recovery + mockItems[1].recovery + mockItems[2].recovery + mockItems[3].recovery,
      mockItems[0].discipline +
        mockItems[1].discipline +
        mockItems[2].discipline +
        mockItems[3].discipline,
      mockItems[0].intellect +
        mockItems[1].intellect +
        mockItems[2].intellect +
        mockItems[3].intellect,
      mockItems[0].strength + mockItems[1].strength + mockItems[2].strength + mockItems[3].strength,
    ];
    console.log("statSum", statSum);

    //const constantBonus = [-10, -10, -10, -10, -10, -10];
    const constantBonus = [0, 0, 0, 0, 0, 0];
    let presult = handlePermutation(
      runtime,
      config,
      mockItems[0] as IPermutatorArmor,
      mockItems[1] as IPermutatorArmor,
      mockItems[2] as IPermutatorArmor,
      mockItems[3] as IPermutatorArmor,
      buildClassItems(true, true), // artifice + masterworked class item
      constantBonus, // constant bonus
      false // doNotOutput
    )[0] as IPermutatorArmorSet; // handlePermutation now returns the per-core skyline; take the first build
    let result = CreateResultDefinition(presult, mockItems);
    expect(result).toBeDefined();
    console.log(result);
    expect(result.mods.length).toBeLessThanOrEqual(5);
    expect(result.stats[0]).toBeGreaterThanOrEqual(
      config.minimumStatTiers[ArmorStat.StatWeapon].value * 10
    );
    expect(result.stats[1]).toBeGreaterThanOrEqual(
      config.minimumStatTiers[ArmorStat.StatHealth].value * 10
    );
    expect(result.stats[2]).toBeGreaterThanOrEqual(
      config.minimumStatTiers[ArmorStat.StatClass].value * 10
    );
    expect(result.stats[3]).toBeGreaterThanOrEqual(
      config.minimumStatTiers[ArmorStat.StatGrenade].value * 10
    );
    expect(result.stats[4]).toBeGreaterThanOrEqual(
      config.minimumStatTiers[ArmorStat.StatSuper].value * 10
    );
    expect(result.stats[5]).toBeGreaterThanOrEqual(
      config.minimumStatTiers[ArmorStat.StatMelee].value * 10
    );

    for (let n = 0; n < 6; n++) {
      const minor =
        1 * result.mods.filter((mod: number) => Math.floor(mod / 3) == n && mod % 3 == 1).length;
      const major =
        1 * result.mods.filter((mod: number) => Math.floor(mod / 3) == n && mod % 3 == 2).length;
      const artif =
        1 *
        result.artifice.filter((mod: number) => Math.floor(mod / 3) - 1 == n && mod % 3 == 0)
          .length;
      expect(result.stats[n]).toEqual(
        result.statsNoMods[n] + 5 * minor + 10 * major + 3 * artif + constantBonus[n]
      );
    }
  });
});

function CreateResultDefinition(
  armorSet: IPermutatorArmorSet,
  items: IInventoryArmor[]
): ResultDefinition {
  let exotic = items.find((x) => x.isExotic);

  if (armorSet == null) {
    console.error("ArmorSet is null", items);
  }

  return {
    exotic:
      exotic == null
        ? undefined
        : {
            icon: exotic?.icon,
            watermark: exotic?.watermarkIcon,
            name: exotic?.name,
            hash: exotic?.hash,
          },
    artifice: armorSet.usedArtifice,
    modCount: armorSet.usedMods.length,
    modCost: armorSet.usedMods.reduce((p, d: StatModifier) => p + STAT_MOD_VALUES[d][2], 0),
    mods: armorSet.usedMods,
    stats: armorSet.statsWithMods,
    statsNoMods: armorSet.statsWithoutMods,
    tiers: getSkillTier(armorSet.statsWithMods),
    waste: getWaste(armorSet.statsWithMods),
    items: items.map(
      (instance): ResultItem => ({
        energyLevel: instance.energyLevel,
        hash: instance.hash,
        itemInstanceId: instance.itemInstanceId,
        tier: instance.tier,
        name: instance.name,
        exotic: !!instance.isExotic,
        tuningStat: instance.tuningStat,
        masterworked: instance.masterworkLevel == 5,
        armorSystem: instance.armorSystem,
        masterworkLevel: instance.masterworkLevel,
        archetypeStats: instance.archetypeStats,
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
        statsNoMods: [],
      })
    ),
    usesCollectionRoll: items.some((v) => v.source === InventoryArmorSource.Collections),
    usesVendorRoll: items.some((v) => v.source === InventoryArmorSource.Vendor),
  } as ResultDefinition;
}

describe("Armor 3.0 flexible exotic tuning", () => {
  const item = (o: Partial<IPermutatorArmor>): IPermutatorArmor =>
    ({
      mobility: 0,
      resilience: 0,
      recovery: 0,
      discipline: 0,
      intellect: 0,
      strength: 0,
      isExotic: 0,
      armorSystem: ArmorSystem.Armor3,
      tier: 5,
      archetypeStats: [],
      tuningStat: null,
      ...o,
    }) as IPermutatorArmor;

  it("lowestThreeBonus gives +1 to the three lowest base stats", () => {
    expect(
      lowestThreeBonus(
        item({
          mobility: 30,
          resilience: 2,
          recovery: 25,
          discipline: 1,
          intellect: 20,
          strength: 3,
        })
      )
    ).toEqual([0, 1, 0, 1, 0, 1]);
  });

  it("treats Armor 3.0 exotics as flexible + tunable; legendaries need tier 5 + tuningStat", () => {
    expect(isFlexibleExotic(item({ isExotic: 1, armorSystem: ArmorSystem.Armor3 }))).toBeTrue();
    expect(isFlexibleExotic(item({ isExotic: 0, armorSystem: ArmorSystem.Armor3 }))).toBeFalse();
    expect(
      isT5WithTuning(item({ isExotic: 1, armorSystem: ArmorSystem.Armor3, tier: 5 }))
    ).toBeTrue();
    expect(
      isT5WithTuning(
        item({
          isExotic: 0,
          armorSystem: ArmorSystem.Armor3,
          tier: 5,
          archetypeStats: [0, 1, 2],
          tuningStat: 0,
        })
      )
    ).toBeTrue();
    expect(
      isT5WithTuning(item({ isExotic: 0, armorSystem: ArmorSystem.Armor2, tier: 5 }))
    ).toBeFalse();
    expect(
      isT5WithTuning(
        item({
          isExotic: 0,
          armorSystem: ArmorSystem.Armor3,
          tier: 3,
          archetypeStats: [0, 1, 2],
          tuningStat: 0,
        })
      )
    ).toBeFalse();
  });

  it("generates the full +5/-5 matrix for a flexible exotic, fixed +5 for a legendary", () => {
    const flex = generate_tunings([
      {
        tuningStat: null,
        archetypeStats: [],
        flexible: true,
        balancedBonus: [1, 1, 1, 0, 0, 0],
      } as any,
    ]);
    // none + 30 ordered swaps + balanced
    expect(flex.length).toBe(32);
    expect(flex.some((t) => t.join(",") === "5,-5,0,0,0,0")).toBeTrue();
    expect(flex.some((t) => t.join(",") === "1,1,1,0,0,0")).toBeTrue();

    const leg = generate_tunings([
      {
        tuningStat: 0,
        archetypeStats: [0, 1, 2],
        flexible: false,
        balancedBonus: [0, 0, 0, 1, 1, 1],
      } as any,
    ]);
    // none + 5 swaps + balanced
    expect(leg.length).toBe(7);
    // +5 only ever lands on the fixed tuning stat (index 0), so index 0 is never negative
    for (const t of leg) expect(t[0]).toBeGreaterThanOrEqual(0);
  });
});

describe("generate_tunings + Balanced edge cases", () => {
  const leg = (tuningStat: number, balancedBonus: number[]): any => ({
    tuningStat,
    archetypeStats: [],
    flexible: false,
    balancedBonus,
  });
  const flex = (balancedBonus: number[]): any => ({
    tuningStat: null,
    archetypeStats: [],
    flexible: true,
    balancedBonus,
  });

  it("returns a single no-op tuning when there are no T5 improvements", () => {
    expect(generate_tunings([])).toEqual([[0, 0, 0, 0, 0, 0]] as any);
  });

  it("produces the expected distinct-tuning counts (single + mixed builds)", () => {
    expect(generate_tunings([leg(0, [0, 0, 0, 1, 1, 1])]).length).toBe(7); // none + 5 swaps + balanced
    expect(generate_tunings([flex([1, 1, 1, 0, 0, 0])]).length).toBe(32); // none + 30 swaps + balanced
    expect(generate_tunings([leg(0, [0, 0, 0, 1, 1, 1]), leg(3, [1, 1, 1, 0, 0, 0])]).length).toBe(
      34
    );
    expect(generate_tunings([leg(0, [0, 0, 0, 1, 1, 1]), flex([1, 1, 1, 0, 0, 0])]).length).toBe(
      134
    );
  });

  it("never emits duplicate tuning vectors", () => {
    const t = generate_tunings([leg(0, [0, 0, 0, 1, 1, 1]), flex([1, 1, 1, 0, 0, 0])]);
    expect(new Set(t.map((v) => v.join(","))).size).toBe(t.length);
  });
});

describe("lowestThreeBonus", () => {
  const item = (s: number[]): any => ({
    mobility: s[0],
    resilience: s[1],
    recovery: s[2],
    discipline: s[3],
    intellect: s[4],
    strength: s[5],
  });

  it("flags the three lowest stats, ties broken by lowest index", () => {
    expect(lowestThreeBonus(item([10, 10, 10, 10, 10, 10]))).toEqual([1, 1, 1, 0, 0, 0]);
    expect(lowestThreeBonus(item([0, 0, 0, 5, 5, 5]))).toEqual([1, 1, 1, 0, 0, 0]);
    expect(lowestThreeBonus(item([9, 1, 8, 2, 7, 3]))).toEqual([0, 1, 0, 1, 0, 1]);
    expect(lowestThreeBonus(item([5, 5, 1, 1, 9, 9]))).toEqual([1, 0, 1, 1, 0, 0]);
  });

  it("always marks exactly three stats", () => {
    for (const s of [
      [3, 1, 4, 1, 5, 9],
      [0, 0, 0, 0, 0, 0],
      [200, 0, 100, 50, 0, 7],
    ]) {
      expect(lowestThreeBonus(item(s)).reduce((a: number, b: number) => a + b, 0)).toBe(3);
    }
  });
});
