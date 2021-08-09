/// <reference lib="webworker" />

import {Configuration} from "../../data/configuration";
import {DID_NOT_SELECT_EXOTIC, FORCE_USE_NO_EXOTIC} from "../../data/constants";
import {ModOrAbility} from "../../data/enum/modOrAbility";
import {ModInformation} from "../../data/ModInformation";
import {ArmorStat, SpecialArmorStat, StatModifier} from "../../data/enum/armor-stat";
import {toArray} from "rxjs/operators";

addEventListener('message', ({data}) => {
    let start = Date.now();
    console.debug("START results builder", start)

    let originalData = data;
    let currentClass = originalData.currentClass;
    let config = originalData.config as Configuration;

    console.log("V config", config)
    console.log("V mods", config.enabledMods)

    //const worker = new Worker(new URL('./permutation-webworker.worker', import.meta.url));
    //worker.onmessage = ({data}) => {
    data = data.permutations;
    console.log("RECEIVED DATA", data)
    let results = [];
    let allArmorPermutations = new Uint32Array(data);
    // How many tiers can we get? This is used to limit the stat tier selection
    let maximumPossibleTiers = [0, 0, 0, 0, 0, 0]


    let statCombo3x100 = new Set();
    let statCombo4x100 = new Set();

    // TODO: spawn multiple webworkers for this
    for (let i = 0; i < allArmorPermutations.length; i += 12) {
      // Skip if we want to filter out a specific exotic
      const permutation = allArmorPermutations.subarray(i, i + 12)
      if (config.selectedExoticHash > DID_NOT_SELECT_EXOTIC && permutation[10] != config.selectedExoticHash) {
        continue
      }
      if (config.selectedExoticHash == FORCE_USE_NO_EXOTIC && permutation[10] != 0) {
        continue
      }


      let stats = [
        permutation[4] + 2,
        permutation[5] + 2,
        permutation[6] + 2,
        permutation[7] + 2,
        permutation[8] + 2,
        permutation[9] + 2,
      ]

      if (config.assumeMasterworked) {
        for (let n = 0; n < 6; n++) stats[n] += 8;
      } else {
        // add each item individually
        for (let n = 0; n < 4; n++) {
          if ((permutation[11] & (1 << n)) > 0)
            for (let n = 0; n < 6; n++) stats[n] += 2;
        }
      }

      // Apply mods
      for (const mod of config.enabledMods) {
        for (const bonus of ModInformation[mod].bonus) {
          switch (bonus.stat) {
            case SpecialArmorStat.ClassAbilityRegenerationStat:
              stats[[1, 0, 3][currentClass]] += bonus.value;
              break;
            default:
              stats[bonus.stat] += bonus.value;
              break;
          }
        }
      }


      // find the difference
      let usedMods = stats
        .map((value, index: ArmorStat) => Math.max(0, config.minimumStatTier[index] * 10 - value))
        .reduce((previousValue, currentValue, currentIndex) => {
          if (currentValue == 0) return previousValue;

          let modMinor = (currentValue % 10 > 0 && currentValue % 10 <= 5) ? 1 : 0
          let modMajor = Math.ceil(Math.max(0, currentValue - modMinor * 5) / 10)
          if (modMinor) previousValue.push(1 + (2 * currentIndex) as StatModifier)
          for (let n = 0; n < modMajor; n++) {
            previousValue.push(1 + (2 * currentIndex + 1) as StatModifier)
          }
          return previousValue;
        }, [] as StatModifier[])

      // Skip if we use too many mods
      if (usedMods.length > config.maximumStatMods)
        continue;


      for (let n = 0; n < 6; n++) {
        let stat = Math.min(10,
          Math.floor(stats[n] / 10)
          + (config.maximumStatMods - usedMods.length)
          + usedMods.filter(d => Math.floor((d - 1) / 2) == n).length
        )

        if (maximumPossibleTiers[n] < stat)
          maximumPossibleTiers[n] = stat
      }

      let openModSlots = config.maximumStatMods - usedMods.length
      const adaptedStats = stats.map((value, index: ArmorStat) =>
        value + 10 * usedMods.filter(d => Math.floor((d - 1) / 2) == index).length
      );
      let todo = adaptedStats.map((value, index: ArmorStat) => [Math.max(0, Math.ceil((100 - value) / 10)), index])
        .sort((a, b) => a[0] - b[0]);

      for (let statId in todo) {
        while (openModSlots > 0 && todo[statId][0] > 0) {
          openModSlots--;
          todo[statId][0]--;
        }
      }
      let stats100amount = todo.filter(d => d[0] == 0).length
      let stats100values = todo.filter(d => d[0] == 0).map(d => d[1]).reduce((p, d) => {
        p += 1 << d;
        return p;
      }, 0);


      if (stats100amount == 3) statCombo3x100.add(stats100values);
      if (stats100amount == 4) statCombo4x100.add(stats100values);


      results.push([
        i / 12, // Index of the current set in the big permutation array
        ...usedMods // all used mods.
      ])
    }

    // build a buffer
    let len = ((2 + 5) * results.length) * 2
    const buffer = new ArrayBuffer(len)
    const view = new Uint16Array(buffer);
    for (let i = 0; i < results.length; i++) {
      // the ID of the permutation. Split loByte and hiByte, as the ID gets quite large..
      view[i * 7] = results[i][0] & 0xffff
      view[i * 7 + 1] = (results[i][0] & (0xffff << 16)) >> 16
      for (let n = 0; n < 6; n++)
        view[i * 7 + n + 2] = results[i][n + 1];
    }
    console.log(`Sending ${view.length / 7} results in ${len} bytes.`, view)
    let end = Date.now();
    console.debug("END results builder", end, end - start)

    postMessage({
      view: view.buffer,
      allArmorPermutations: allArmorPermutations.buffer,
      maximumPossibleTiers,
      statCombo3x100: Array.from(statCombo3x100).sort(),
      statCombo4x100: Array.from(statCombo4x100).sort()
    }, [view.buffer, allArmorPermutations.buffer]);

    //};
    //worker.postMessage(currentClass);


  }
)
;
