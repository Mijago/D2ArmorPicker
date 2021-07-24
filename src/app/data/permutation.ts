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

  getStats(assumeMasterworked: boolean = true) {
    // NOTE: It assumes you ALWAYS have a masterworked class item!!
    let additionalClassItemStats = 2;
    let additionalHelmetStats = (this.helmet.masterworked || assumeMasterworked) ? 2 : 0;
    let additionalGauntletStats = (this.gauntlet.masterworked || assumeMasterworked) ? 2 : 0;
    let additionalChestStats = (this.chest.masterworked || assumeMasterworked) ? 2 : 0;
    let additionalLegStats = (this.legs.masterworked || assumeMasterworked) ? 2 : 0;
    let mobility = additionalClassItemStats + this.helmet.mobility + additionalHelmetStats
      + this.gauntlet.mobility + additionalGauntletStats
      + this.chest.mobility + additionalChestStats
      + this.legs.mobility + additionalLegStats;
    let resilience = additionalClassItemStats + this.helmet.resilience + additionalHelmetStats
      + this.gauntlet.resilience + additionalGauntletStats
      + this.chest.resilience + additionalChestStats
      + this.legs.resilience + additionalLegStats;
    let recovery = additionalClassItemStats + this.helmet.recovery + additionalHelmetStats
      + this.gauntlet.recovery + additionalGauntletStats
      + this.chest.recovery + additionalChestStats
      + this.legs.recovery + additionalLegStats;
    let discipline = additionalClassItemStats + this.helmet.discipline + additionalHelmetStats
      + this.gauntlet.discipline + additionalGauntletStats
      + this.chest.discipline + additionalChestStats
      + this.legs.discipline + additionalLegStats;
    let intellect = additionalClassItemStats + this.helmet.intellect + additionalHelmetStats
      + this.gauntlet.intellect + additionalGauntletStats
      + this.chest.intellect + additionalChestStats
      + this.legs.intellect + additionalLegStats;
    let strength = additionalClassItemStats + this.helmet.strength + additionalHelmetStats
      + this.gauntlet.strength + additionalGauntletStats
      + this.chest.strength + additionalChestStats
      + this.legs.strength + additionalLegStats;

    return {mobility, resilience, recovery, discipline, intellect, strength}
  }

  get allMasterworked() {
    return !this.items.some(i => !i.masterworked)
  }

  get stats1(): Stats {
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
