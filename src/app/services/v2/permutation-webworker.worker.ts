/// <reference lib="webworker" />

import {buildDb} from "../../data/database";
import {Permutation} from "../../data/permutation";
import {IInventoryArmor} from "../IInventoryArmor";

const db = buildDb(async () => {
})
const inventoryArmor = db.table("inventoryArmor");

addEventListener('message', async ({data}) => {
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


          // IDs are really really long..
          // So I store them in 4 parts
          permutations.push([
            [helmet.id, gauntlet.id, chest.id, leg.id],
            stats,
            exoticId,
            masterworkNumber
          ])
        }
      }
    }
  }


  // prepare to send it
  let len = ((4 + 6 + 1 + 1) * permutations.length) * 4
  const buffer = new ArrayBuffer(len)
  const view = new Uint32Array(buffer);
  for (let i = 0; i < permutations.length; i++) {
    for (let n = 0; n < 4; n++)
      view[i * (4 + 6 + 2) + n] = permutations[i][0][n]
    for (let n = 0; n < 6; n++)
      view[i * (4 + 6 + 2) + 4 + n] = permutations[i][1][n]
    view[i * (4 + 6 + 2) + 4 + 6] = permutations[i][2] ?? 0;
    view[i * (4 + 6 + 2) + 4 + 6 + 1] = permutations[i][3];
  }
  console.log(`Sending ${permutations.length} permutations in ${len} bytes.`)

  postMessage(view.buffer, [view.buffer]);
});
