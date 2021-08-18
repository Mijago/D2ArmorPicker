/// <reference lib="webworker" />

import {buildDb} from "../../data/database";
import {Permutation} from "../../data/permutation";
import {IInventoryArmor} from "../IInventoryArmor";
import {PERMUTATION_PACKAGE} from "../../data/constants";

const db = buildDb(async () => {
})
const inventoryArmor = db.table("inventoryArmor");

addEventListener('message', async ({data}) => {
  console.group("WebWorker: Permuation Builder")
  console.time("WebWorker: Permuation Builder")
  let items = await inventoryArmor.where("clazz").equals(data).toArray() as IInventoryArmor[]
  const helmets = items.filter(i => i.slot == "Helmets")
  const gauntlets = items.filter(i => i.slot == "Arms")
  const chests = items.filter(i => i.slot == "Chest")
  const legs = items.filter(i => i.slot == "Legs")

  let permutations: Permutation[] = [];
  for (let helmet of helmets) {
    for (let gauntlet of gauntlets) {
      if (helmet.isExotic && gauntlet.isExotic) continue;
      for (let chest of chests) {
        if ((helmet.isExotic || gauntlet.isExotic) && chest.isExotic) continue;
        for (let leg of legs) {
          if ((helmet.isExotic || gauntlet.isExotic || chest.isExotic) && leg.isExotic) continue;

          let exoticId = 0;
          if (helmet.isExotic) exoticId = helmet.hash;
          else if (gauntlet.isExotic) exoticId = gauntlet.hash;
          else if (chest.isExotic) exoticId = chest.hash;
          else if (leg.isExotic) exoticId = leg.hash;

          const stats: [number, number, number, number, number, number] = [
            helmet.mobility + gauntlet.mobility + chest.mobility + leg.mobility,
            helmet.resilience + gauntlet.resilience + chest.resilience + leg.resilience,
            helmet.recovery + gauntlet.recovery + chest.recovery + leg.recovery,
            helmet.discipline + gauntlet.discipline + chest.discipline + leg.discipline,
            helmet.intellect + gauntlet.intellect + chest.intellect + leg.intellect,
            helmet.strength + gauntlet.strength + chest.strength + leg.strength,
          ]

          let masterworkNumber = ((helmet.masterworked ? 1 : 0) << 3)
            + ((gauntlet.masterworked ? 1 : 0) << 2)
            + ((chest.masterworked ? 1 : 0) << 1)
            + (leg.masterworked ? 1 : 0)

          // elemental affinity is at max 5. This means, we can simply shift by 3 bits to store them in one int.
          let elementalAffinity = (helmet.energyAffinity << 9)
            + (gauntlet.energyAffinity << 6)
            + (chest.energyAffinity << 3)
            + (leg.energyAffinity)

          // IDs are really really long..
          // So I store them in 4 parts
          permutations.push([
            [helmet.id, gauntlet.id, chest.id, leg.id],
            stats,
            exoticId,
            masterworkNumber,
            elementalAffinity
          ])
        }
      }
    }
  }


  // prepare to send it
  let len = (PERMUTATION_PACKAGE.WIDTH * permutations.length) * 4
  const buffer = new ArrayBuffer(len)
  const view = new Uint32Array(buffer);
  for (let i = 0; i < permutations.length; i++) {
    for (let n = 0; n < 4; n++)
      view[i * PERMUTATION_PACKAGE.WIDTH + PERMUTATION_PACKAGE.HELMET_ID + n] = permutations[i][0][n]
    for (let n = 0; n < 6; n++)
      view[i * PERMUTATION_PACKAGE.WIDTH + PERMUTATION_PACKAGE.MOBILITY + n] = permutations[i][1][n]
    view[i * PERMUTATION_PACKAGE.WIDTH + PERMUTATION_PACKAGE.EXOTIC_ID] = permutations[i][2] ?? 0;
    view[i * PERMUTATION_PACKAGE.WIDTH + PERMUTATION_PACKAGE.MASTERWORK_NUMBER] = permutations[i][3];
    view[i * PERMUTATION_PACKAGE.WIDTH + PERMUTATION_PACKAGE.ELEMENTAL_AFFINITIES] = permutations[i][4];
  }
  console.log(`Sending ${permutations.length} permutations in ${len} bytes.`)


  console.timeEnd("WebWorker: Permuation Builder")
  console.groupEnd()

  postMessage(view.buffer, [view.buffer]);
});
