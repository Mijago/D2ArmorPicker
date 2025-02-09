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

import { Component, OnInit } from "@angular/core";
//import GLPKConstructor, { GLPK, LP, Result } from "glpk.js";
import { GLPK, LP, Result } from "glpk.js";
declare const GLPKConstructor: () => GLPK;
import { ModifierType } from "src/app/data/enum/modifierType";
import { IInventoryArmor } from "../../../../data/types/IInventoryArmor";
import { ArmorSlot } from "../../../../data/enum/armor-slot";
import { DestinyClass } from "bungie-api-ts/destiny2";
import { Database } from "../../../../data/database";
import {
  ArmorPerkOrSlot,
  ArmorPerkOrSlotIcons,
  ArmorPerkOrSlotNames,
} from "../../../../data/enum/armor-stat";

const statNames = ["mobility", "resilience", "recovery", "discipline", "intellect", "strength"];

const intrinsicExoticArmorByClassAndSlot = {
  [DestinyClass.Titan]: {
    [ArmorSlot.ArmorSlotHelmet]: [
      { stats: [0, 1, 1], armor: [3216110440, 106575079, 2578771006] },
      { stats: [0, 2, 0], armor: [2808156426, 3883866764] },
    ],
    [ArmorSlot.ArmorSlotGauntlet]: [
      { stats: [0, 1, 1], armor: [1734844651, 241462141, 241462142] },
      { stats: [0, 2, 0], armor: [1734844650, 1848640623, 2240152949, 2563444729] },
    ],
    [ArmorSlot.ArmorSlotChest]: [
      { stats: [2, 1, 0], armor: [1192890598, 1341951177, 3874247549] },
      { stats: [1, 1, 1], armor: [1591207518, 1591207519] },
      { stats: [1, 2, 0], armor: [1654461647] },
    ],
    [ArmorSlot.ArmorSlotLegs]: [
      { stats: [1, 1, 0], armor: [3539357319, 2255796155, 136355432, 1160559849] },
      { stats: [1, 0, 1], armor: [2423243921] },
      { stats: [0, 2, 0], armor: [3539357318] },
    ],
  },
  [DestinyClass.Hunter]: {
    [ArmorSlot.ArmorSlotHelmet]: [
      { stats: [2, 0, 0], armor: [896224899] },
      { stats: [1, 1, 0], armor: [2757274117, 1053737370, 1321354572, 1321354573] },
      { stats: [1, 0, 1], armor: [3562696927, 2773056939] },
    ],
    [ArmorSlot.ArmorSlotGauntlet]: [
      { stats: [1, 1, 1], armor: [3942036043] },
      { stats: [0, 1, 1], armor: [475652357] },
      { stats: [1, 0, 1], armor: [691578978] },
      { stats: [1, 1, 0], armor: [691578979, 1688602431] },
      { stats: [2, 0, 0], armor: [193869523, 1734144409, 4165919945] },
    ],
    [ArmorSlot.ArmorSlotChest]: [
      { stats: [2, 0, 1], armor: [978537162] },
      { stats: [2, 1, 0], armor: [903984858, 1474735276, 2766109872] },
      { stats: [1, 1, 1], armor: [1474735277] },
      { stats: [1, 2, 0], armor: [2766109874, 3070555693] },
    ],
    [ArmorSlot.ArmorSlotLegs]: [
      { stats: [2, 0, 0], armor: [193869520, 609852545] },
      { stats: [1, 1, 0], armor: [193869522] },
    ],
  },
  [DestinyClass.Warlock]: {
    [ArmorSlot.ArmorSlotHelmet]: [
      { stats: [0, 1, 1], armor: [3381022971, 1030017949, 1096253259, 2384488862] },
      { stats: [0, 0, 2], armor: [3381022970, 2177524718, 2428181146] },
      { stats: [1, 0, 1], armor: [3381022969, 3948284065] },
    ],
    [ArmorSlot.ArmorSlotGauntlet]: [
      { stats: [0, 0, 2], armor: [1906093346, 3288917178, 3844826443] },
      { stats: [0, 2, 1], armor: [2950045886] },
      { stats: [0, 1, 1], armor: [3084282676, 3844826440] },
      { stats: [1, 0, 1], armor: [3627185503, 3787517196] },
    ],
    [ArmorSlot.ArmorSlotChest]: [
      { stats: [2, 0, 1], armor: [370930766, 4057299719] },
      { stats: [0, 2, 1], armor: [1725917554, 4057299718] },
      { stats: [0, 1, 2], armor: [2082483156] },
    ],
    [ArmorSlot.ArmorSlotLegs]: [
      { stats: [0, 1, 2], armor: [121305948] },
      { stats: [1, 0, 1], armor: [138282166] },
      { stats: [0, 1, 1], armor: [4136768282] },
    ],
  },
};

@Component({
  selector: "app-theorizer-page",
  templateUrl: "./theorizer-page.component.html",
  styleUrls: ["./theorizer-page.component.scss"],
})
export class TheorizerPageComponent implements OnInit {
  ModifierType = ModifierType;

  glpk: GLPK | null = null;

  calculating = false;

  // options
  options = {
    solver: {
      timeout: 5,
      presolve: true,
    },
    armor: {
      // armorType, 1 = own, 2 = generated, 3 = both
      armorType: 3,
      requiresExotic: true,
    },
    stats: {
      desired: {
        mobility: 0,
        resilience: 0,
        recovery: 0,
        discipline: 0,
        intellect: 0,
        strength: 0,
      },
      constantBoost: {
        mobility: 0,
        resilience: 0,
        recovery: 0,
        discipline: 0,
        intellect: 0,
        strength: 0,
      },
      // if we must reach the EXACT stats and can not go over them
      statsAreFixed: false,
      maxValue: 250,
      minTiers: 0,
      minPoints: 100,
      maxWaste: 54,
    },
    fragments: {
      enableFragmentPicker: false,
      subclass: -1,
      class: DestinyClass.Unknown,
    },
    mods: {
      maxMods: 5,
      maxArtifice: 5,
    },
    generator: {
      generateExoticsWithIntrinsicStats: false,
    },
    availablePlugs: [
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
    ],
  };
  result: Result | null = null;
  result_items: any | null = null;
  time_progress = 0;
  private timerId: number = 0;
  lp: LP | null = null;

  private db: Database;

  constructor() {
    this.db = new Database();
  }

  sum(l: number[]): number {
    return l.reduce((a, b) => a + b, 0);
  }

  getPerkName(perk: number) {
    return ArmorPerkOrSlotNames[perk as ArmorPerkOrSlot];
  }

  getPerkIconUrl(perk: number) {
    return ArmorPerkOrSlotIcons[perk as ArmorPerkOrSlot];
  }

  slotNameByIndex(index: number): string {
    switch (index) {
      case 0:
        return "Helmet";
      case 1:
        return "Gauntlets";
      case 2:
        return "Chest Armor";
      case 3:
        return "Leg Armor";
      case 4:
        return "Class Item";
      default:
        return "Unknown";
    }
  }

  resultValueToText(value: number): string {
    // this.GLP_UNDEF=1,this.GLP_FEAS=2,this.GLP_INFEAS=3,this.GLP_NOFEAS=4,this.GLP_OPT=5,this.GLP_UNBND=6,
    switch (value) {
      case 1:
        return "Undefined. Might be unsolvable. Give it more time.";
      case 2:
        return "Feasible, but not optimal. Give it more time.";
      case 3:
        return "Infeasible. Your configuration is not possible.";
      case 4:
        return "No feasible solution found. Your configuration may not be possible.";
      case 5:
        return "Optimal solution found.";
      case 6:
        return "Unbounded. Your configuration is not possible (actually a Mijago skill issue).";
      default:
        return "Unknown result";
    }
  }

  async ngOnInit() {
    this.glpk = await GLPKConstructor();

    console.log(this.glpk);
  }

  startTimer() {
    this.time_progress = 0;
    const interval = (this.options.solver.timeout / 100) * 1000;

    this.timerId = setInterval(() => {
      this.time_progress += 1;
      if (this.time_progress >= 100) {
        this.stopTimer();
      }
    }, interval) as unknown as number;
  }

  stopTimer() {
    if (this.timerId) {
      this.time_progress = 100;
      clearInterval(this.timerId);
      this.timerId = 0;
    }
  }

  async run() {
    this.result = this.result_items = null;
    if (!this.glpk) throw new Error("GLPK not initialized yet");
    this.calculating = true;

    const lp = await this.buildFromConfiguration();
    console.log(lp);

    // check lp.binaries for duplicates
    const binaries = lp.binaries!;
    const duplicates = binaries.filter((item, index) => binaries.indexOf(item) != index);
    if (duplicates.length > 0) {
      alert("Duplicate items in binary list: " + duplicates.join(", "));
      this.calculating = false;
      return;
    }

    // also check lp.generals
    const generals = lp.generals!;
    const duplicates2 = generals.filter((item, index) => generals.indexOf(item) != index);
    if (duplicates2.length > 0) {
      alert("Duplicate items in generals list: " + duplicates2.join(", "));
      this.calculating = false;
      return;
    }

    this.lp = lp;
    this.startTimer();
    const result = await this.glpk.solve(lp);
    this.stopTimer();
    this.result_items = await this.getItemsFromResult(result);
    this.result = result;
    this.calculating = false;
  }

  async getItemsFromResult(result: Result) {
    const items = [
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
    ];
    // contains if items are generated or not, and if they are not, then the metadata
    const itemMeta: (IInventoryArmor | null)[] = [null, null, null, null, null];
    const itemIntrinsics: (any | null)[] = [null, null, null, null, null];
    const itemExotic: (boolean | null)[] = [null, null, null, null, null];
    const itemArtifice: boolean[] = [false, false, false, false, false];
    let artificeCount = 0;

    const masterwork = [10, 10, 10, 10, 10, 10];
    const constants = [0, 0, 0, 0, 0, 0];

    const statMods = {
      major: [0, 0, 0, 0, 0, 0],
      minor: [0, 0, 0, 0, 0, 0],
    };
    const artificeMods = [0, 0, 0, 0, 0, 0];

    for (let kv in result!.result!.vars) {
      if (!kv.startsWith("constant_")) continue;
      if (result!.result!.vars[kv] == 0) continue;

      const [_, stat] = kv.split("_");
      constants[parseInt(stat)] += result!.result!.vars[kv] - 10;
    }
    for (let kv in result!.result!.vars) {
      if (!kv.startsWith("plug_")) continue;
      if (result!.result!.vars[kv] == 0) continue;

      const [_, slot, tier, plug] = kv.split("_");
      const plugValues = this.options.availablePlugs[parseInt(plug)];
      const is2ndHalf = parseInt(tier) >= 2 ? 1 : 0;
      for (let stat = 0; stat < 3; stat++) {
        items[parseInt(slot)][stat + 3 * is2ndHalf] += plugValues[stat];
      }

      // check if exotic_${slot} is 1
      if (result!.result!.vars[`exotic_${slot}`] == 1) {
        itemExotic[parseInt(slot)] = true;
      }
    }
    const itemsToGrab = [];
    for (let kv in result!.result!.vars) {
      if (!kv.startsWith("item_")) continue;
      if (result!.result!.vars[kv] == 0) continue;

      const [_, slot, itemId] = kv.split("_");
      itemsToGrab.push({ slot: parseInt(slot), itemId: itemId });
    }
    if (itemsToGrab.length > 0) {
      for (let e of itemsToGrab) {
        let dbitems = await this.db.inventoryArmor
          .where("itemInstanceId")
          .equals(e.itemId)
          .toArray();
        if (dbitems.length == 0) continue;
        const item = dbitems[0];
        itemMeta[e.slot] = item;
        items[e.slot][0] += item.mobility;
        items[e.slot][1] += item.resilience;
        items[e.slot][2] += item.recovery;
        items[e.slot][3] += item.discipline;
        items[e.slot][4] += item.intellect;
        items[e.slot][5] += item.strength;

        itemExotic[e.slot] = item.isExotic;
        itemArtifice[e.slot] = item.perk == ArmorPerkOrSlot.SlotArtifice;
        artificeCount += itemArtifice[e.slot] ? 1 : 0;
      }
    }

    // grab item bonus stats, if set
    for (let kv in result!.result!.vars) {
      // intrinsic_${slot}_${clazz}_${i}
      if (!kv.startsWith("intrinsic_")) continue;
      if (result!.result!.vars[kv] == 0) continue;

      let [_, slot, clazz, entryId] = kv.split("_");
      const entry = (intrinsicExoticArmorByClassAndSlot as any)[parseInt(clazz)][
        parseInt(slot) + 1
      ][parseInt(entryId)];

      const entryArmor = await Promise.all(
        entry.armor.map(async (k: number) => {
          return await this.db.manifestArmor.where("hash").equals(k).first();
        })
      );

      itemIntrinsics[parseInt(slot)] = {
        entry: entry,
        items: entryArmor,
      };
    }

    /* STAT MODS */
    for (let kv in result!.result!.vars) {
      if (!kv.startsWith("mod_")) continue;
      if (result!.result!.vars[kv] == 0) continue;

      const [_, type, stat] = kv.split("_");
      statMods[type == "1" ? "minor" : "major"][parseInt(stat)] += result!.result!.vars[kv];
    }

    /* ARTIFICE */
    let requiredArtificeArmor = 0;
    for (let kv in result!.result!.vars) {
      if (!kv.startsWith("artifice_")) continue;
      if (result!.result!.vars[kv] == 0) continue;

      const [_, stat] = kv.split("_");
      artificeMods[parseInt(stat)] += result!.result!.vars[kv];
      requiredArtificeArmor += result!.result!.vars[kv];
    }

    // class item is artifice too
    if (artificeCount < requiredArtificeArmor) {
      // set class item to be artifice
      itemArtifice[4] = true;
      artificeCount++;
    }

    for (let slot = 0; slot < 4 && artificeCount < requiredArtificeArmor; slot++) {
      if (itemArtifice[slot]) continue;
      if (itemExotic[slot] == false) continue;
      if (itemMeta[slot] != null) continue;
      itemArtifice[slot] = true;
      artificeCount++;
    }

    // now sum every stat to get the final value
    const total = [0, 0, 0, 0, 0, 0];
    for (let stat = 0; stat < 6; stat++) {
      for (let slot = 0; slot < 5; slot++) {
        total[stat] += items[slot][stat];

        if (stat < 3 && itemIntrinsics[slot] != null) {
          total[stat] += itemIntrinsics[slot]["entry"]["stats"][stat];
        }
      }
      total[stat] += constants[stat];
      total[stat] += masterwork[stat];
      console.log(
        "artificeMods[stat]",
        stat,
        artificeMods[stat],
        "|",
        total[stat],
        10 * statMods.major[stat],
        5 * statMods.minor[stat],
        3 * artificeMods[stat]
      );
      total[stat] += 10 * statMods.major[stat] + 5 * statMods.minor[stat] + 3 * artificeMods[stat];
    }

    // get the tiers for each stat
    const tiers = total.map((k) => Math.floor(k / 10));
    const waste = total.map((k) => k % 10);
    const tierSum = tiers.reduce((a, b) => a + b, 0);

    return {
      items,
      artificeMods,
      statMods,
      constants,
      total,
      waste,
      tiers,
      tierSum,
      masterwork,
      itemMeta,
      itemIntrinsics,
      itemExotic,
      itemArtifice,
    };
  }

  async getItems(clazz?: DestinyClass): Promise<IInventoryArmor[]> {
    let items = (await this.db.inventoryArmor
      .where("slot")
      .notEqual(ArmorSlot.ArmorSlotNone)
      .distinct()
      .toArray()) as IInventoryArmor[];

    if (clazz != undefined) {
      items = items.filter((item) => item.clazz == clazz);
    }

    // drop duplicates
    items = items.filter((item, index) => {
      return (
        items.findIndex((i) => {
          return i.itemInstanceId == item.itemInstanceId;
        }) == index
      );
    });

    // items = items
    // config.OnlyUseMasterworkedExotics - only keep exotics that are masterworked
    //.filter((item) => !config.onlyUseMasterworkedExotics || !(item.rarity == TierType.Exotic && !item.masterworked))
    // config.OnlyUseMasterworkedLegendaries - only keep exotics that are masterworked
    //.filter((item) => !config.onlyUseMasterworkedLegendaries || !(item.rarity == TierType.Superior && !item.masterworked))
    // non-legendaries and non-exotics
    //.filter(item => config.allowBlueArmorPieces || item.rarity == TierType.Exotic || item.rarity == TierType.Superior)
    // sunset armor
    //.filter(item => !config.ignoreSunsetArmor || !item.isSunset)
    // armor perks

    return items;
  }

  async buildFromConfiguration(): Promise<LP> {
    if (!this.glpk) throw new Error("GLPK not initialized yet");

    const lp = {
      name: "d2ap_theorizer",
      options: {
        msgLev: this.glpk.GLP_MSG_ERR,
        presolve: this.options.solver.presolve,
        tmlim: this.options.solver.timeout,
      },
      objective: {
        direction: this.glpk.GLP_MAX,
        name: "objective",
        vars: [],
      },
      subjectTo: [
        {
          name: "goal_mobility",
          bnds: {
            type: this.glpk.GLP_DB,
            ub: this.options.stats.maxValue,
            lb: this.options.stats.desired.mobility,
          },
          vars: [] as any[],
        },
        {
          name: "goal_resilience",
          bnds: {
            type: this.glpk.GLP_DB,
            ub: this.options.stats.maxValue,
            lb: this.options.stats.desired.resilience,
          },
          vars: [] as any[],
        },
        {
          name: "goal_recovery",
          bnds: {
            type: this.glpk.GLP_DB,
            ub: this.options.stats.maxValue,
            lb: this.options.stats.desired.recovery,
          },
          vars: [] as any[],
        },
        {
          name: "goal_discipline",
          bnds: {
            type: this.glpk.GLP_DB,
            ub: this.options.stats.maxValue,
            lb: this.options.stats.desired.discipline,
          },
          vars: [] as any[],
        },
        {
          name: "goal_intellect",
          bnds: {
            type: this.glpk.GLP_DB,
            ub: this.options.stats.maxValue,
            lb: this.options.stats.desired.intellect,
          },
          vars: [] as any[],
        },
        {
          name: "goal_strength",
          bnds: {
            type: this.glpk.GLP_DB,
            ub: this.options.stats.maxValue,
            lb: this.options.stats.desired.strength,
          },
          vars: [] as any[],
        },
      ],
      bounds: [],
      binaries: [], // binary values
      generals: [], // integers
    } as LP;

    // add MW and Const Values
    for (let stat = 0; stat < 6; stat++) {
      const val = (this.options.stats as any).constantBoost[statNames[stat]];
      let constVal = 10 + val;
      lp.bounds!.push({
        name: `constant_${stat}`,
        type: this.glpk.GLP_FX,
        ub: constVal,
        lb: constVal,
      });
      lp.subjectTo![stat].vars.push({ name: `constant_${stat}`, coef: 1 });
    }

    const withOwnArmor = (this.options.armor.armorType & 1) > 0;
    const withGeneratedArmor = (this.options.armor.armorType & 2) > 0;
    const withBothArmorSources = withOwnArmor && withGeneratedArmor;

    const items = await this.getItems();
    let helmets = items.filter((i) => i.slot == ArmorSlot.ArmorSlotHelmet);
    let gauntlets = items.filter((i) => i.slot == ArmorSlot.ArmorSlotGauntlet);
    let chests = items.filter((i) => i.slot == ArmorSlot.ArmorSlotChest);
    let legs = items.filter((i) => i.slot == ArmorSlot.ArmorSlotLegs);

    // check class setting
    if (this.options.fragments.class != DestinyClass.Unknown) {
      const clazz = this.options.fragments.class;
      helmets = helmets.filter((i) => i.clazz == clazz);
      gauntlets = gauntlets.filter((i) => i.clazz == clazz);
      chests = chests.filter((i) => i.clazz == clazz);
      legs = legs.filter((i) => i.clazz == clazz);
    }

    let itemsBySlot = [helmets, gauntlets, chests, legs];

    const classLimitSubject = {
      name: `classlim`,
      vars: [] as any[],
      bnds: { type: this.glpk.GLP_UP, ub: 1, lb: 1 },
    };
    const classLimitSubjects = [];
    // add a variable for each class. Only one of them may be > 0
    for (let clazz = 0; clazz < 3; clazz++) {
      const clazzVar = `class_${clazz}`;
      lp.binaries!.push(clazzVar);
      classLimitSubject.vars.push({ name: clazzVar, coef: 1 });

      classLimitSubjects.push({
        name: `classlim_${clazz}`,
        vars: [{ name: clazzVar, coef: -4 }], // TODO I may have to add 0.25 for theoretical armor piece plugs
        bnds: { type: this.glpk.GLP_UP, ub: 0, lb: 0 },
      });
    }

    // only allow ZERO or ONE exotic
    const exoticLimitSubject = {
      name: `exoticlim`,
      vars: [] as any[],
      bnds: { type: this.glpk.GLP_DB, ub: 1, lb: 0 },
    };

    if (this.options.armor.requiresExotic) {
      console.log("requiring exotic");
      exoticLimitSubject.bnds = { type: this.glpk.GLP_FX, ub: 1, lb: 1 };
    }

    lp.subjectTo!.push(classLimitSubject);
    lp.subjectTo!.push(...classLimitSubjects);
    lp.subjectTo!.push(exoticLimitSubject);

    const penalty = 20;
    const artificeArmorPieces = [];
    const artificeArmorPlugs = [];

    // we have 4 slots
    // we pick four plugs for each slot; a plug has three values
    // the sum of first two plugs represents mob/res/rec
    // the sum of second two plugs represents dis/int/str
    // the sum of the first two plugs over all armor pieces represents the total base of mob/res/rec
    // the sum of the second two plugs over all armor pieces represents the total base of dis/int/str
    for (let slot = 0; slot < 4; slot++) {
      const slotLimitSubject = {
        name: `slotlim_${slot}`,
        vars: [] as any[],
        bnds: { type: this.glpk.GLP_FX, ub: 4, lb: 4 },
      };
      lp.subjectTo!.push(slotLimitSubject);

      // introduce one binary variable for each plug in each slot
      if (withGeneratedArmor) {
        const intrinsicStatSelectionSubject = {
          name: `allow_intrinsic_${slot}`,
          vars: [] as any[],
          bnds: { type: this.glpk.GLP_UP, ub: 0, lb: 0 },
        };

        lp.binaries!.push(`exotic_${slot}`);
        exoticLimitSubject.vars.push({ name: `exotic_${slot}`, coef: 1 });

        // generateExoticsWithIntrinsicStats
        if (this.options.generator.generateExoticsWithIntrinsicStats) {
          // add variables to see if this slot is generated and exotic
          // only one slot is allowed to be exotic, so we can use this later

          // add the subject that limits the usage of intrinsic stat plugs to only work when we select 4 plugs
          lp.subjectTo!.push(intrinsicStatSelectionSubject);

          // add a variable for categories in possibleBonusStats
          for (let clazz = 0; clazz < 3; clazz++) {
            const entries = (intrinsicExoticArmorByClassAndSlot as any)[clazz][slot + 1];
            for (let i = 0; i < entries.length; i++) {
              let entry = entries[i];
              const name = `intrinsic_${slot}_${clazz}_${i}`;
              lp.binaries!.push(name);
              // add to intrinsicStatSelectionSubject
              intrinsicStatSelectionSubject.vars.push({ name: name, coef: 1 });

              // add a limit that it is <= selected class
              lp.subjectTo!.push({
                name: `intrinsic_${slot}_${clazz}_classlim`,
                vars: [
                  { name: name, coef: 1 },
                  { name: `class_${clazz}`, coef: -1 },
                ],
                bnds: { type: this.glpk.GLP_UP, ub: 0, lb: 0 },
              });

              // add a limit that it only added when no exotic is selected
              lp.subjectTo!.push({
                name: `intrinsic_${slot}_${clazz}_exoticlim`,
                vars: [
                  { name: name, coef: 1 },
                  { name: `exotic_${slot}`, coef: -1 },
                ],
                bnds: { type: this.glpk.GLP_UP, ub: 0, lb: 0 },
              });

              // add the stats
              for (let statmrr = 0; statmrr < 3; statmrr++) {
                if (entry.stats[statmrr] > 0)
                  lp.subjectTo![statmrr].vars.push({
                    name: name,
                    coef: entry.stats[statmrr],
                  });
              }

              // apply a penalty for using this
              lp.objective!.vars.push({ name: name, coef: -100 });
            }
          }
          // TODO make sure that we only add them if it is generated
        }

        // only allow this slot to be exotic if it is also generated and used
        let exoticGenlimSlot = {
          name: `exotic_${slot}_genlim`,
          vars: [{ name: `exotic_${slot}`, coef: 1 }],
          bnds: { type: this.glpk.GLP_UP, ub: 0, lb: 0 },
        };
        lp.subjectTo!.push(exoticGenlimSlot);

        for (let plugId = 0; plugId < 4; plugId++) {
          const subject = {
            name: `plug_${slot}_${plugId}`,
            vars: [] as any[],
            bnds: { type: this.glpk.GLP_FX, ub: 1, lb: 1 },
          };
          if (withBothArmorSources) subject.bnds = { type: this.glpk.GLP_DB, ub: 1, lb: 0 };

          for (let plug = 0; plug < this.options.availablePlugs.length; plug++) {
            const plugName = `plug_${slot}_${plugId}_${plug}`;
            lp.binaries!.push(plugName);
            subject.vars.push({ name: plugName, coef: 1 });

            // add to intrinsicStatSelectionSubject
            intrinsicStatSelectionSubject.vars.push({ name: plugName, coef: -0.25 });
            exoticGenlimSlot.vars.push({ name: plugName, coef: -0.25 });

            artificeArmorPlugs.push(plugName);

            // 4 plugs per item, so coeff 0.25 for each plug
            slotLimitSubject.vars.push({ name: plugName, coef: 1 });

            if (withBothArmorSources) {
              lp.objective!.vars.push({ name: plugName, coef: -100 });
            }

            // add the plug to the subject which manages the required stats
            for (let n = 0; n < 3; n++) {
              let cn = n;
              if (plugId > 1) cn += 3;

              lp.subjectTo![cn].vars.push({
                name: plugName,
                coef: this.options.availablePlugs[plug][n],
              });
              // add a penalty for every stat point. This means the solver will try to minimize the number of generated stat points
              if (penalty > 0)
                lp.objective!.vars.push({
                  name: plugName,
                  coef: -penalty * this.options.availablePlugs[plug][n],
                });
            }
          }
          lp.subjectTo!.push(subject);
        }
      }

      if (withOwnArmor) {
        // add a variable for each item in each slot
        for (let item of itemsBySlot[slot]) {
          const item_id = item.itemInstanceId;
          const identifier = `item_${slot}_${item_id}`;
          lp.binaries!.push(identifier);
          //lp.bounds!.push({name: identifier, type: this.glpk.GLP_DB, ub: 1, lb: 0});
          lp.subjectTo![0].vars.push({ name: identifier, coef: item.mobility });
          lp.subjectTo![1].vars.push({ name: identifier, coef: item.resilience });
          lp.subjectTo![2].vars.push({ name: identifier, coef: item.recovery });
          lp.subjectTo![3].vars.push({ name: identifier, coef: item.discipline });
          lp.subjectTo![4].vars.push({ name: identifier, coef: item.intellect });
          lp.subjectTo![5].vars.push({ name: identifier, coef: item.strength });
          // limit the number of items per slot to 1
          slotLimitSubject.vars.push({ name: identifier, coef: 4 });
          // Add an objective for each item, which means we want to have as many of our own items as possible
          if (withBothArmorSources) {
            lp.objective!.vars.push({ name: identifier, coef: 100 });
          }

          // class limit subject
          classLimitSubjects[item.clazz].vars.push({ name: identifier, coef: 1 });

          // exotic limit
          if (item.isExotic) {
            exoticLimitSubject.vars.push({ name: identifier, coef: 1 });
            // also rate this one higher, so that we have more exotics in the results
            lp.objective!.vars.push({ name: identifier, coef: 40 });
          }
          if (item.perk == ArmorPerkOrSlot.SlotArtifice) {
            artificeArmorPieces.push(identifier);
          }
        }
      }
    }

    if (this.options.mods.maxMods > 0) {
      const modSubject = {
        name: `limit_mods`,
        vars: [] as any[],
        bnds: {
          type: this.options.mods.maxMods > 0 ? this.glpk.GLP_DB : this.glpk.GLP_FX,
          ub: this.options.mods.maxMods,
          lb: 0,
        },
      };
      for (let stat = 0; stat < 6; stat++) {
        // 1 minor, 2 major; and then artifice
        lp.bounds!.push({ name: `mod_${1}_${stat}`, type: this.glpk.GLP_DB, ub: 5, lb: 0 });
        lp.bounds!.push({ name: `mod_${2}_${stat}`, type: this.glpk.GLP_DB, ub: 5, lb: 0 });
        lp.generals!.push(`mod_${1}_${stat}`);
        lp.generals!.push(`mod_${2}_${stat}`);

        lp.subjectTo![stat].vars.push({ name: `mod_${1}_${stat}`, coef: 5 });
        lp.subjectTo![stat].vars.push({ name: `mod_${2}_${stat}`, coef: 10 });

        // only allow a total of 5 mods and 3 artificer mods
        modSubject.vars.push({ name: `mod_${1}_${stat}`, coef: 1 });
        modSubject.vars.push({ name: `mod_${2}_${stat}`, coef: 1 });
      }
      lp.subjectTo!.push(modSubject);
    }

    if (this.options.mods.maxArtifice > 0) {
      const artifMaxSubject = {
        name: `limit_artif_max`,
        vars: [] as any[],
        bnds: {
          type: this.options.mods.maxArtifice > 0 ? this.glpk.GLP_DB : this.glpk.GLP_FX,
          ub: this.options.mods.maxArtifice,
          lb: 0,
        },
      };
      const artifSlotSubject = {
        name: `limit_artif_slot`,
        vars: [] as any[],
        bnds: { type: this.glpk.GLP_UP, ub: 1, lb: 0 }, // UB is 1 as we assume our class item is artifice !TODO make this a setting
      };
      // add all armor pieces which can be artificed
      for (let piece of artificeArmorPieces) {
        artifSlotSubject.vars.push({ name: piece, coef: -1 });
      }
      for (let piece of artificeArmorPlugs) {
        artifSlotSubject.vars.push({ name: piece, coef: -0.25 });
      }
      // add 1 in case we generated an exotic armor
      if (withGeneratedArmor) {
        for (let slot = 0; slot < 4; slot++) {
          artifSlotSubject.vars.push({ name: `exotic_${slot}`, coef: 1 });
        }
      }

      for (let stat = 0; stat < 6; stat++) {
        lp.subjectTo![stat].vars.push({ name: `artifice_${stat}`, coef: 3 });
        artifMaxSubject.vars.push({ name: `artifice_${stat}`, coef: 1 });
        artifSlotSubject.vars.push({ name: `artifice_${stat}`, coef: 1 });

        lp.bounds!.push({ name: `artifice_${stat}`, type: this.glpk.GLP_DB, ub: 5, lb: 0 });
        lp.generals!.push(`artifice_${stat}`);
      }
      lp.subjectTo!.push(artifMaxSubject);
      lp.subjectTo!.push(artifSlotSubject);
    }

    if (this.options.stats.minTiers > 0 || this.options.stats.maxWaste < 54) {
      // I want to have the TIERS of the armor stats
      // for this, I introduce two variables per stat:
      // - The first is the "waste", which is bound between 0 and 9
      // - The second is the "tier", which is bound between -5 and 20
      // We will set these variables as "mobility - waste - 10 tier = 0"
      for (let stat = 0; stat < 6; stat++) {
        lp.bounds!.push({ name: `waste_${stat}`, type: this.glpk.GLP_DB, ub: 9, lb: 0 });
        //lp.bounds!.push({name: `tier_${stat}`, type: this.glpk.GLP_DB, ub: 100, lb: -100});
        lp.generals!.push(`waste_${stat}`);
        lp.generals!.push(`tier_${stat}`);

        //lp.objective.vars.push({name: `tier_${stat}`, coef: 2})
        //lp.objective.vars.push({name: `waste_${stat}`, coef: -100})

        const setWasteAndTierSubject = {
          name: `set_waste_and_tier_${stat}`,
          vars: [
            { name: `waste_${stat}`, coef: -1 },
            { name: `tier_${stat}`, coef: -10 },
            ...lp.subjectTo![stat].vars,
          ],
          bnds: { type: this.glpk.GLP_FX, ub: 0, lb: 0 },
        };

        lp.subjectTo!.push(setWasteAndTierSubject);
      }

      // set minTiers <= the sum of the tiers
      if (this.options.stats.minTiers > 0) {
        const minTierSubject = {
          name: `require_tier_minimum`,
          vars: [] as any[],
          bnds: { type: this.glpk.GLP_LO, ub: 0, lb: this.options.stats.minTiers },
        };
        console.log("this.options.stats.minTiers", this.options.stats.minTiers);
        for (let stat = 0; stat < 6; stat++) {
          minTierSubject.vars.push({ name: `tier_${stat}`, coef: 1 });
        }
        lp.subjectTo!.push(minTierSubject);
      }

      // Specify maxWaste
      if (this.options.stats.maxWaste < 54) {
        const maxWasteSubject = {
          name: `require_waste_maximum`,
          vars: [] as any[],
          bnds: {
            type: this.options.stats.maxWaste > 0 ? this.glpk.GLP_UP : this.glpk.GLP_FX,
            ub: this.options.stats.maxWaste,
            lb: 0,
          },
        };
        for (let stat = 0; stat < 6; stat++) {
          maxWasteSubject.vars.push({ name: `waste_${stat}`, coef: 1 });
        }
        lp.subjectTo!.push(maxWasteSubject);
      }
    }

    // Fix the stats if we enforce them
    if (this.options.stats.statsAreFixed) {
      for (let n = 0; n < 6; n++) {
        lp.subjectTo[n].bnds.ub = lp.subjectTo[n].bnds.lb;
        lp.subjectTo[n].bnds.type = this.glpk.GLP_FX;
      }
    }

    return lp;
  }
}
