import {IManifestArmor} from "./IManifestArmor";
import {DestinyEnergyType} from "bungie-api-ts/destiny2/interfaces";

export interface IInventoryArmor extends IManifestArmor {
  id: number;
  itemInstanceId: string;
  masterworked: boolean;
  mobility: number;
  resilience: number;
  recovery: number;
  discipline: number;
  intellect: number;
  strength: number;
  energyAffinity: DestinyEnergyType;
}
