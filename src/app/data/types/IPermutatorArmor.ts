import { DestinyClass, TierType } from "bungie-api-ts/destiny2";
import { ArmorPerkOrSlot, ArmorStat } from "../enum/armor-stat";
import { IDestinyArmor } from "./IInventoryArmor";

export interface IPermutatorArmor extends IDestinyArmor {
  clazz: DestinyClass;
  perk: ArmorPerkOrSlot;
  isExotic: 0 | 1;
  rarity: TierType;
  isSunset: boolean;
  exoticPerkHash: number[];
  tuningStat: ArmorStat | null; // for armor 3.0, this is the tuning stat hash

  // Transient scratch set by the results-builder worker's Phase-1 branch-and-bound `annotate`
  // step: masterworked stats (_mw), per-stat tuning max (_tune), artifice-capable flag (_art),
  // tuning's max contribution to the total (_tuneTot), and the masterworked stat sum (_sum).
  // Never serialized or set outside the optimizer worker — see AnnotatedArmor in
  // results-builder.worker.ts, which narrows these to required after annotate has run.
  _mw?: number[];
  _tune?: number[];
  _art?: number;
  _tuneTot?: number;
  _sum?: number;
}
