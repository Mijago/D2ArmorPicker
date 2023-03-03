import {Component, OnInit} from '@angular/core';
import GLPKConstructor, {GLPK, LP, Result} from "glpk.js";

const statNames = ["mobility", "resilience", "recovery", "discipline", "intellect", "strength"]

@Component({
  selector: 'app-theorizer-page',
  templateUrl: './theorizer-page.component.html',
  styleUrls: ['./theorizer-page.component.scss']
})
export class TheorizerPageComponent implements OnInit {
  glpk: GLPK | null = null;

  calculating = false;

  // options
  options = {
    solver: {
      timeout: 2,
      presolve: true,
    },
    armorType: "3",
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
      maxValue: 109,
      minTiers: 0,
      minPoints: 100,
      maxWaste: 54,
    },
    mods: {
      maxMods: 5,
      maxArtifice: 5
    },
    generator: {
      generateExoticsWithIntrinsicStats: true,
    },
    availablePlugs: [
      [1, 1, 10], [1, 1, 11], [1, 1, 12], [1, 1, 13], [1, 1, 14], [1, 1, 15],
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
      [12, 1, 1], [13, 1, 1], [14, 1, 1], [15, 1, 1]
    ],
    possibleBonusStats: [
      // Titan
      [[[0, 1, 1], [0, 2, 0]],
        [[0, 1, 1], [0, 2, 0], [0, 2, 1]],
        [[2, 1, 0], [1, 1, 1], [0, 2, 1]],
        [[1, 1, 0], [1, 0, 1], [0, 2, 0]]],
      // Hunter
      [[[2, 0, 0], [1, 1, 0], [1, 0, 1]],
        [[1, 1, 1], [0, 1, 1], [1, 0, 1], [1, 1, 0], [2, 0, 0]],
        [[2, 0, 1], [2, 1, 0], [1, 1, 1], [1, 2, 0]],
        [[2, 1, 0], [2, 0, 0], [1, 1, 0]]],
      // Warlock
      [[[0, 1, 1], [0, 0, 2], [1, 0, 1]],
        [[0, 0, 2], [0, 2, 1], [0, 1, 1], [1, 0, 1]],
        [[2, 0, 1], [0, 2, 1], [0, 1, 2]],
        [[0, 1, 2], [1, 0, 1], [0, 1, 1]]]
    ]
  }
  result: Result | null = null;
  result_items: any | null = null;
  time_progress = 0;
  private timerId: number = 0;
  lp: LP | null = null;

  constructor() {
  }


  sum(l: number[]): number {
    return l.reduce((a, b) => a + b, 0);
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
        return "Undefined. Give it more time.";
      case 2:
        return "Feasible, but not optimal. Give it more time.";
      case 3:
        return "Infeasible. Your configuration is not possible.";
      case 4:
        return "Infeasible. Your configuration is not possible.";
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

    console.log(this.glpk)
  }

  startTimer() {
    this.time_progress = 0;
    const interval = this.options.solver.timeout / 100 * 1000;

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

    const lp = this.buildFromConfiguration();
    this.lp = lp;
    this.startTimer();
    const result = await this.glpk.solve(lp);
    this.stopTimer();
    this.result_items = this.getItemsFromResult(result);
    this.result = result;
    this.calculating = false;
  }

  getItemsFromResult(result: Result) {
    const items = [
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
    ];

    const masterwork = [10, 10, 10, 10, 10, 10]
    const constants = [0, 0, 0, 0, 0, 0]

    const statMods = {
      major: [0, 0, 0, 0, 0, 0],
      minor: [0, 0, 0, 0, 0, 0]
    }
    const artificeMods = [0, 0, 0, 0, 0, 0]

    for (let kv in result!.result!.vars) {
      if (!kv.startsWith("constant_")) continue;
      if (result!.result!.vars[kv] == 0) continue;

      const [_, stat] = kv.split("_");
      constants[parseInt(stat)] += result!.result!.vars[kv];
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
    }

    /* STAT MODS */
    for (let kv in result!.result!.vars) {
      if (!kv.startsWith("mod_")) continue;
      if (result!.result!.vars[kv] == 0) continue;

      const [_, type, stat] = kv.split("_");
      statMods[type == "1" ? "minor" : "major"][parseInt(stat)] += result!.result!.vars[kv];
    }

    /* ARTIFICE */
    for (let kv in result!.result!.vars) {
      if (!kv.startsWith("artifice_")) continue;
      if (result!.result!.vars[kv] == 0) continue;

      const [_, stat] = kv.split("_");
      artificeMods[parseInt(stat)] += result!.result!.vars[kv];
    }


    // now sum every stat to get the final value
    const total = [0, 0, 0, 0, 0, 0]
    for (let stat = 0; stat < 6; stat++) {
      for (let slot = 0; slot < 5; slot++) {
        total[stat] += items[slot][stat];
      }
      total[stat] += constants[stat];
      total[stat] += masterwork[stat];
      console.log("artificeMods[stat]", stat, artificeMods[stat], "|", total[stat], 10 * statMods.major[stat], 5 * statMods.minor[stat], 3 * artificeMods[stat])
      total[stat] += 10 * statMods.major[stat] + 5 * statMods.minor[stat] + 3 * artificeMods[stat];
    }

    // get the tiers for each stat
    const tiers = total.map(k => Math.floor(k / 10))
    const waste = total.map(k => k % 10)
    const tierSum = tiers.reduce((a, b) => a + b, 0)

    return {
      items, artificeMods, statMods, constants,
      total, waste, tiers, tierSum, masterwork
    };
  }

  buildFromConfiguration(): LP {
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
          bnds: {type: this.glpk.GLP_DB, ub: this.options.stats.maxValue, lb: this.options.stats.desired.mobility-10},
          vars: [] as any[],
        },
        {
          name: "goal_resilience",
          bnds: {type: this.glpk.GLP_DB, ub: this.options.stats.maxValue, lb: this.options.stats.desired.resilience-10},
          vars: [] as any[],
        },
        {
          name: "goal_recovery",
          bnds: {type: this.glpk.GLP_DB, ub: this.options.stats.maxValue, lb: this.options.stats.desired.recovery-10},
          vars: [] as any[],
        },
        {
          name: "goal_discipline",
          bnds: {type: this.glpk.GLP_DB, ub: this.options.stats.maxValue, lb: this.options.stats.desired.discipline-10},
          vars: [] as any[],
        },
        {
          name: "goal_intellect",
          bnds: {type: this.glpk.GLP_DB, ub: this.options.stats.maxValue, lb: this.options.stats.desired.intellect-10},
          vars: [] as any[],
        },
        {
          name: "goal_strength",
          bnds: {type: this.glpk.GLP_DB, ub: this.options.stats.maxValue, lb: this.options.stats.desired.strength-10},
          vars: [] as any[],
        },
      ],
      bounds: [],
      binaries: [], // binary values
      generals: [] // integers
    } as LP;
    //lp.binaries!.push("constant1");
    for (let stat = 0; stat < 6; stat++) {
      const val = (this.options.stats as any).constantBoost[statNames[stat]];
      if (val == 0) continue;

      lp.bounds!.push({name: `constant_${stat}`, type: this.glpk.GLP_FX, ub: val, lb: val});
      lp.subjectTo![stat].vars.push({name: `constant_${stat}`, coef: 1});
    }


    // we have 4 slots
    // we pick four plugs for each slot; a plug has three values
    // the sum of first two plugs represents mob/res/rec
    // the sum of second two plugs represents dis/int/str
    // the sum of the first two plugs over all armor pieces represents the total base of mob/res/rec
    // the sum of the second two plugs over all armor pieces represents the total base of dis/int/str

    for (let slot = 0; slot < 4; slot++) {
      // introduce one binary variable for each plug in each slot
      for (let plugId = 0; plugId < 4; plugId++) {
        const subject = {
          name: `plug_${slot}_${plugId}`,
          vars: [] as any[],
          bnds: {type: this.glpk.GLP_FX, ub: 1, lb: 1}
        }
        for (let plug = 0; plug < this.options.availablePlugs.length; plug++) {
          const plugName = `plug_${slot}_${plugId}_${plug}`;
          lp.binaries!.push(plugName);
          subject.vars.push({name: plugName, coef: 1});

          // add the plug to the subject which manages the required stats
          for (let n = 0; n < 3; n++) {
            let cn = n;
            if (plugId > 1) cn += 3;

            lp.subjectTo![cn].vars.push({name: plugName, coef: this.options.availablePlugs[plug][n]});
          }
        }
        lp.subjectTo!.push(subject);
      }
    }


    const modSubject = {
      name: `limit_mods`, vars: [] as any[],
      bnds: {
        type: this.options.mods.maxMods > 0 ? this.glpk.GLP_DB : this.glpk.GLP_FX,
        ub: this.options.mods.maxMods, lb: 0
      }
    }
    const artifSubject = {
      name: `limit_artif`, vars: [] as any[],
      bnds: {
        type: this.options.mods.maxArtifice > 0 ? this.glpk.GLP_DB : this.glpk.GLP_FX,
        ub: this.options.mods.maxArtifice, lb: 0
      }
    }
    for (let stat = 0; stat < 6; stat++) {
      // 1 minor, 2 major; and then artifice
      lp.bounds!.push({name: `mod_${1}_${stat}`, type: this.glpk.GLP_DB, ub: 5, lb: 0});
      lp.bounds!.push({name: `mod_${2}_${stat}`, type: this.glpk.GLP_DB, ub: 5, lb: 0});
      lp.bounds!.push({name: `artifice_${stat}`, type: this.glpk.GLP_DB, ub: 5, lb: 0});

      lp.generals!.push(`mod_${1}_${stat}`);
      lp.generals!.push(`mod_${2}_${stat}`);
      lp.generals!.push(`artifice_${stat}`);

      lp.subjectTo![stat].vars.push({name: `mod_${1}_${stat}`, coef: 5});
      lp.subjectTo![stat].vars.push({name: `mod_${2}_${stat}`, coef: 10});
      lp.subjectTo![stat].vars.push({name: `artifice_${stat}`, coef: 3});

      // only allow a total of 5 mods and 3 artificer mods
      modSubject.vars.push({name: `mod_${1}_${stat}`, coef: 1});
      modSubject.vars.push({name: `mod_${2}_${stat}`, coef: 1});
      artifSubject.vars.push({name: `artifice_${stat}`, coef: 1});
    }
    lp.subjectTo!.push(modSubject);
    lp.subjectTo!.push(artifSubject);




    if (this.options.stats.minTiers > 0 || this.options.stats.maxWaste <54) {

    // I want to have the TIERS of the armor stats
    // for this, I introduce two variables per stat:
    // - The first is the "waste", which is bound between 0 and 9
    // - The second is the "tier", which is bound between -5 and 20
    // We will set these variables as "mobility - waste - 10 tier = 0"
    for (let stat = 0; stat < 6; stat++) {
      lp.bounds!.push({name: `waste_${stat}`, type: this.glpk.GLP_DB, ub: 9, lb: 0});
      lp.bounds!.push({name: `tier_${stat}`, type: this.glpk.GLP_DB, ub: 20, lb: -5});
      lp.generals!.push(`waste_${stat}`);
      lp.generals!.push(`tier_${stat}`);

      //lp.objective.vars.push({name: `tier_${stat}`, coef: 2})
      //lp.objective.vars.push({name: `waste_${stat}`, coef: -100})


      const setWasteAndTierSubject = {
        name: `set_waste_and_tier_${stat}`,
        vars: [
          {name: `waste_${stat}`, coef: -1},
          {name: `tier_${stat}`, coef: -10},
          ...lp.subjectTo![stat].vars
        ],
        bnds: {type: this.glpk.GLP_FX, ub: 0, lb: 0}
      };

      lp.subjectTo!.push(setWasteAndTierSubject)
    }

    // set minTiers <= the sum of the tiers
    if (this.options.stats.minTiers > 0) {
      const minTierSubject = {
        name: `require_tier_minimum`,
        vars: [] as any[],
        bnds: {type: this.glpk.GLP_LO, ub: 0, lb: this.options.stats.minTiers}
      }
      console.log("this.options.stats.minTiers", this.options.stats.minTiers)
      for (let stat = 0; stat < 6; stat++) {
        minTierSubject.vars.push({name: `tier_${stat}`, coef: 1});
      }
      lp.subjectTo!.push(minTierSubject);
    }


    // Specify maxWaste
    if (this.options.stats.maxWaste <54) {
      const maxWasteSubject = {
        name: `require_waste_maximum`,
        vars: [] as any[],
        bnds: {
          type: this.options.stats.maxWaste > 0 ? this.glpk.GLP_UP : this.glpk.GLP_FX,
          ub: this.options.stats.maxWaste,
          lb: 0
        }
      }
      for (let stat = 0; stat < 6; stat++) {
        maxWasteSubject.vars.push({name: `waste_${stat}`, coef: 1});
      }
      lp.subjectTo!.push(maxWasteSubject);
    }

    }


    /* Introduce stat values */
    /*
    for (let stat = 0; stat < 6; stat++) {
      lp.generals!.push(`val_stat_${stat}`);
      lp.bounds!.push({name: `val_stat_${stat}`, type: this.glpk.GLP_DB, ub: this.options.stats.maxValue, lb: -50});

      const statSubject = {
        name: `set_stat_${stat}`,
        vars: [
          {name: `val_stat_${stat}`, coef: -1},
          ...lp.subjectTo![stat].vars
        ],
        bnds: {type: this.glpk.GLP_FX, ub: 0, lb: 0}
      }

      lp.subjectTo!.push(statSubject);
    }
    //*/


    // minPoints
    /*
    const minPointsSubject = {
      name: `require_points_minimum`,
      vars: [] as any[],
      bnds: {type: this.glpk.GLP_LO, ub: 0, lb: this.options.stats.minPoints}
    }
    for (let stat = 0; stat < 6; stat++) {
      minPointsSubject.vars.push({name: `val_stat_${stat}`, coef: 1});
    }
    lp.subjectTo!.push(minPointsSubject);
    //*/


    for (let stat = 0; stat < 6; stat++) {
      //lp.objective.vars.push({name: `val_stat_${stat}`, coef: 1e4},)
      //lp.objective.vars.push({name: `waste_${stat}`, coef: -1},)
      //lp.objective.vars.push({name: `waste_${stat}`, coef: -1},)
    }
    //lp.objective.vars.push({name: `masterwork`, coef: 1},)


    return lp;
  }

}
