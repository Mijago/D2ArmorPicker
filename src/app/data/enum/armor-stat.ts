import {EnumDictionary} from "../types/EnumDictionary";
import {CharacterClass} from "./character-Class";
import {calculateTierValueAbility} from "../cooldowns/cooldown_definitions";
import {buildMeleeCooldown} from "../cooldowns/cooldowns_melee";
import {DestinyEnergyType} from "bungie-api-ts/destiny2";


export enum StatModifier {
  NONE,
  MINOR_MOBILITY,
  MAJOR_MOBILITY,
  MINOR_RESILIENCE,
  MAJOR_RESILIENCE,
  MINOR_RECOVERY,
  MAJOR_RECOVERY,
  MINOR_DISCIPLINE,
  MAJOR_DISCIPLINE,
  MINOR_INTELLECT,
  MAJOR_INTELLECT,
  MINOR_STRENGTH,
  MAJOR_STRENGTH,
}


export enum ArmorStat {
  Mobility,
  Resilience,
  Recovery,
  Discipline,
  Intellect,
  Strength
}

// Stat Enum, bonus, cost, mod hash
export const STAT_MOD_VALUES: EnumDictionary<StatModifier, [ArmorStat, number, number, number]> = {
  [StatModifier.NONE]: [ArmorStat.Strength, 0, 0, 0],
  [StatModifier.MINOR_MOBILITY]: [ArmorStat.Mobility, 5, 1, 204137529],
  [StatModifier.MAJOR_MOBILITY]: [ArmorStat.Mobility, 10, 3, 3961599962],
  [StatModifier.MINOR_RESILIENCE]: [ArmorStat.Resilience, 5, 1, 3682186345],
  [StatModifier.MAJOR_RESILIENCE]: [ArmorStat.Resilience, 10, 3, 2850583378],
  [StatModifier.MINOR_RECOVERY]: [ArmorStat.Recovery, 5, 2, 555005975],
  [StatModifier.MAJOR_RECOVERY]: [ArmorStat.Recovery, 10, 4, 2645858828],
  [StatModifier.MINOR_DISCIPLINE]: [ArmorStat.Discipline, 5, 1, 2623485440],
  [StatModifier.MAJOR_DISCIPLINE]: [ArmorStat.Discipline, 10, 3, 4048838440],
  [StatModifier.MINOR_INTELLECT]: [ArmorStat.Intellect, 5, 2, 1227870362],
  [StatModifier.MAJOR_INTELLECT]: [ArmorStat.Intellect, 10, 5, 3355995799],
  [StatModifier.MINOR_STRENGTH]: [ArmorStat.Strength, 5, 1, 3699676109],
  [StatModifier.MAJOR_STRENGTH]: [ArmorStat.Strength, 10, 3, 3253038666]
}

export const ArmorStatNames: EnumDictionary<ArmorStat, string> = {
  [ArmorStat.Mobility]: "Mobility",
  [ArmorStat.Resilience]: "Resilience",
  [ArmorStat.Recovery]: "Recovery",
  [ArmorStat.Discipline]: "Discipline",
  [ArmorStat.Intellect]: "Intellect",
  [ArmorStat.Strength]: "Strength"
}

type Literal<T extends ArmorStat> = `${T}`;
export type ArmorStatLiteral = Literal<ArmorStat>;

export enum SpecialArmorStat {
  ClassAbilityRegenerationStat = 10
}

export enum ArmorPerkOrSlot {
  None,
  SlotNightmare,
  SlotArtificer,
  SlotLastWish,
  SlotGardenOfSalvation,
  SlotDeepStoneCrypt,
  SlotVaultOfGlass,
  PerkIronBanner,
  COUNT
}

export const ArmorAffinityNames: EnumDictionary<DestinyEnergyType, string> = {
  [DestinyEnergyType.Any]: "Any",
  [DestinyEnergyType.Arc]: "Arc",
  [DestinyEnergyType.Thermal]: "Solar",
  [DestinyEnergyType.Void]: "Void",
  [DestinyEnergyType.Stasis]: "Stasis",
  [DestinyEnergyType.Ghost]: "Ghost",
  [DestinyEnergyType.Subclass]: "Subclass"
}
export const ArmorAffinityIcons: EnumDictionary<DestinyEnergyType, string> = {
  [DestinyEnergyType.Any]: "",
  [DestinyEnergyType.Arc]: "https://www.bungie.net/common/destiny2_content/icons/DestinyEnergyTypeDefinition_092d066688b879c807c3b460afdd61e6.png",
  [DestinyEnergyType.Thermal]: "https://www.bungie.net/common/destiny2_content/icons/DestinyEnergyTypeDefinition_2a1773e10968f2d088b97c22b22bba9e.png",
  [DestinyEnergyType.Void]: "https://www.bungie.net/common/destiny2_content/icons/DestinyEnergyTypeDefinition_ceb2f6197dccf3958bb31cc783eb97a0.png",
  [DestinyEnergyType.Stasis]: "https://www.bungie.net/common/destiny2_content/icons/DestinyEnergyTypeDefinition_530c4c3e7981dc2aefd24fd3293482bf.png",
  [DestinyEnergyType.Ghost]: "",
  [DestinyEnergyType.Subclass]: ""
}

