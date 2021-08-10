/// <reference lib="webworker" />

import {Configuration} from "../../data/configuration";
import {DID_NOT_SELECT_EXOTIC, FORCE_USE_NO_EXOTIC} from "../../data/constants";
import {ModOrAbility} from "../../data/enum/modOrAbility";
import {ModInformation} from "../../data/ModInformation";
import {ArmorStat, SpecialArmorStat, StatModifier} from "../../data/enum/armor-stat";
import {toArray} from "rxjs/operators";

addEventListener('message', async ({data}) => {
    console.group("WebWorker: Results Builder")
    console.time("WebWorker: Results Builder")

    let originalData = data;
    let currentClass = originalData.currentClass;
    let config = originalData.config as Configuration;

    let allArmorPermutations = new Uint32Array(data.permutations);

    console.group("Input")
    console.debug("config", config)
    console.debug("mods", config.enabledMods)
    console.debug("permutation data", allArmorPermutations)
    console.debug("permutation amount", allArmorPermutations.length / 12)
    console.groupEnd()


    console.time("split permutations in packages of size 5e5")
    let subs = []
    for (let n = 0; n < allArmorPermutations.length / 12; n += 5e5) {
      subs.push({
        buffer: Uint32Array.from(allArmorPermutations.subarray(n * 12, (n + 5e5) * 12)).buffer,
        startPosition: n
      })
    }
    console.timeEnd("split permutations in packages of size 5e5")

    console.time("Get results from webworker helpers")
    let results = await Promise.all(subs.map(subArray => {
      return new Promise(resolve => {
        const worker = new Worker(new URL('./results-builder-helper.worker', import.meta.url));
        worker.onmessage = ({data}) => {
          resolve(data);
        };
        worker.postMessage({
          permutations: subArray.buffer,
          startPosition: subArray.startPosition,
          config: config
        }, [subArray.buffer]);
      })
    })) as { buffer: ArrayBuffer, maximumPossibleTiers: number[], statCombo4x100: Set<number>, statCombo3x100: Set<number> }[];
    console.timeEnd("Get results from webworker helpers")


    // How many tiers can we get? This is used to limit the stat tier selection
    let maximumPossibleTiers = [0, 0, 0, 0, 0, 0]
    let statCombo3x100 = new Set();
    let statCombo4x100 = new Set();

    // build result view
    let resultByteLen = results.reduce((p, b) => p + b.buffer.byteLength, 0)
    const buffer = new ArrayBuffer(resultByteLen)
    const view = new Uint16Array(buffer);
    let offset = 0;
    for (let result of results) {
      let v = new Uint16Array(result.buffer);
      view.set(v, offset)
      offset += v.length

      for (let n = 0; n < 6; n++) {
        if (result.maximumPossibleTiers[n] > maximumPossibleTiers[n])
          maximumPossibleTiers[n] = result.maximumPossibleTiers[n]
      }

      statCombo3x100 = new Set([...statCombo3x100, ...result.statCombo3x100])
      statCombo4x100 = new Set([...statCombo4x100, ...result.statCombo4x100])
    }


    console.log(`Sending ${view.length / 7} results in ${resultByteLen} bytes.`, view)
    console.timeEnd("WebWorker: Results Builder")
    console.groupEnd()

    postMessage({
      view: view.buffer,
      allArmorPermutations: allArmorPermutations.buffer,
      maximumPossibleTiers,
      statCombo3x100: Array.from(statCombo3x100).sort(),
      statCombo4x100: Array.from(statCombo4x100).sort()
    }, [view.buffer, allArmorPermutations.buffer]);

  }
)
;
