import {Component, OnInit} from '@angular/core';
import GLPKConstructor, {GLPK, LP, Result} from "glpk.js";

@Component({
  selector: 'app-theorizer-page',
  templateUrl: './theorizer-page.component.html',
  styleUrls: ['./theorizer-page.component.css']
})
export class TheorizerPageComponent implements OnInit {
  glpk: GLPK | null = null;

  calculating = false;

  // options
  options = {
    armorType: "3",
    stats: {
      desired: {
        mobility: 40,
        resilience: 40,
        recovery: 40,
        discipline: 40,
        intellect: 40,
        strength: 40,
      },
      maxValue: 109,
      min_tiers: 32
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

  constructor() {
  }

  async ngOnInit() {
    this.glpk = await GLPKConstructor();

    console.log(this.glpk)
  }

  async run() {
    this.result = null;
    if (!this.glpk) throw new Error("GLPK not initialized yet");
    this.calculating = true;

    const lp = this.buildFromConfiguration();
    const result = await this.glpk.solve(lp);
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

    const statMods = {
      major: [0, 0, 0, 0, 0, 0],
      minor: [0, 0, 0, 0, 0, 0]
    }
    const artificeMods = [0, 0, 0, 0, 0, 0]

    const allMasterworekd = result!.result!.vars["masterwork"] == 1;
    console.log({allMasterworekd})
    if (allMasterworekd) {
      for (let slot = 0; slot < 4; slot++) {
        for (let stat = 0; stat < 6; stat++) {
          items[slot][stat] += 2;
        }
      }
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
      statMods[type == "1" ? "major" : "minor"][parseInt(stat)] += 2 * parseInt(type);
    }

    /* ARTIFICE */
    for (let kv in result!.result!.vars) {
      if (!kv.startsWith("artifice_")) continue;
      if (result!.result!.vars[kv] == 0) continue;

      const [_, stat] = kv.split("_");
      artificeMods[parseInt(stat)] += 1;
    }
    return {items, artificeMods, statMods};
  }

  buildFromConfiguration(): LP {
    if (!this.glpk) throw new Error("GLPK not initialized yet");

    const lp = {
      name: "d2ap_theorizer",
      options: {
        msgLev: this.glpk.GLP_MSG_ERR,
        presolve: true,
        tmlim: 30,
      },
      objective: {
        direction: this.glpk.GLP_MAX,
        name: "objective",
        vars: [
          {name: "plug_1_1_1", coef: 1},
        ],
      },
      subjectTo: [
        {
          name: "goal_mobility",
          bnds: {type: this.glpk.GLP_DB, ub: this.options.stats.maxValue, lb: this.options.stats.desired.mobility},
          vars: [] as any[],
        },
        {
          name: "goal_resilience",
          bnds: {type: this.glpk.GLP_DB, ub: this.options.stats.maxValue, lb: this.options.stats.desired.resilience},
          vars: [] as any[],
        },
        {
          name: "goal_recovery",
          bnds: {type: this.glpk.GLP_DB, ub: this.options.stats.maxValue, lb: this.options.stats.desired.recovery},
          vars: [] as any[],
        },
        {
          name: "goal_discipline",
          bnds: {type: this.glpk.GLP_DB, ub: this.options.stats.maxValue, lb: this.options.stats.desired.discipline},
          vars: [] as any[],
        },
        {
          name: "goal_intellect",
          bnds: {type: this.glpk.GLP_DB, ub: this.options.stats.maxValue, lb: this.options.stats.desired.intellect},
          vars: [] as any[],
        },
        {
          name: "goal_strength",
          bnds: {type: this.glpk.GLP_DB, ub: this.options.stats.maxValue, lb: this.options.stats.desired.strength},
          vars: [] as any[],
        },
      ],
      bounds: [],
      binaries: [], // binary values
      generals: [] // integers
    } as LP;

    // add masterworks
    lp.bounds!.push({name: "masterwork", type: this.glpk.GLP_FX, ub: 1, lb: 1});
    lp.binaries!.push("masterwork");
    for (let stat = 0; stat < 6; stat++) {
      lp.subjectTo[stat].vars.push({name: `masterwork`, coef: 10});
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


    const modSubject = {name: `limit_mods`, vars: [] as any[], bnds: {type: this.glpk.GLP_DB, ub: 5, lb: 0}}
    const artifSubject = {name: `limit_artif`, vars: [] as any[], bnds: {type: this.glpk.GLP_DB, ub: 5, lb: 0}}
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

    return lp;
  }

}
