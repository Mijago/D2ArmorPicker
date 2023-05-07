import { IManifestArmor } from "./IManifestArmor";
import { DestinyEnergyType } from "bungie-api-ts/destiny2/interfaces";

export interface IInventoryArmor extends IManifestArmor {
  id: number;
  itemInstanceId: string;
  masterworked: boolean;
  mayBeBugged: boolean; // if there was an error in the parsing
  mobility: number;
  resilience: number;
  recovery: number;
  discipline: number;
  intellect: number;
  strength: number;
  energyLevel: number;
  statPlugHashes: (number | undefined)[];
}
