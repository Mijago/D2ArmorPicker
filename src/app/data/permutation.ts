import {IInventoryArmor} from "../services/database.service";

export enum ArmorClass {
  Titan,
  Warlock,
  Hunter
}

export enum ArmorSlot {
  ArmorSlotHelmet,
  ArmorSlotGauntlet,
  ArmorSlotChest,
  ArmorSlotLegs,
  ArmorSlotClass,
}

export interface Stats {
  mobility: number;
  resilience: number;
  recovery: number;
  discipline: number;
  intellect: number;
  strength: number;
}


export class GearPermutation {
  hasExotic: boolean;
  helmet: IInventoryArmor;
  gauntlet: IInventoryArmor;
  chest: IInventoryArmor;
  legs: IInventoryArmor;


  constructor(hasExotic: boolean, helmet: IInventoryArmor, gauntlet: IInventoryArmor, chest: IInventoryArmor, legs: IInventoryArmor) {
    this.hasExotic = hasExotic;
    this.helmet = helmet;
    this.gauntlet = gauntlet;
    this.chest = chest;
    this.legs = legs;
  }

  get items() {
    return [this.helmet, this.gauntlet, this.chest, this.legs];
  }

  get stats(): Stats {
    return {
      mobility: 10 + this.helmet.mobility + this.gauntlet.mobility + this.chest.mobility + this.legs.mobility,
      resilience: 10 + this.helmet.resilience + this.gauntlet.resilience + this.chest.resilience + this.legs.resilience,
      recovery: 10 + this.helmet.recovery + this.gauntlet.recovery + this.chest.recovery + this.legs.recovery,
      discipline: 10 + this.helmet.discipline + this.gauntlet.discipline + this.chest.discipline + this.legs.discipline,
      intellect: 10 + this.helmet.intellect + this.gauntlet.intellect + this.chest.intellect + this.legs.intellect,
      strength: 10 + this.helmet.strength + this.gauntlet.strength + this.chest.strength + this.legs.strength,
    }
  }
}
