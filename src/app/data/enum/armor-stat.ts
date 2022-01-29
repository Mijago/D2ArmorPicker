import {EnumDictionary} from "../types/EnumDictionary";
import {CharacterClass} from "./character-Class";
import {calculateTierValueAbility} from "../cooldown_definitions";
import {buildMeleeCooldown} from "../cooldowns_melee";


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

export const STAT_MOD_VALUES: EnumDictionary<StatModifier, [ArmorStat, number, number]> = {
  [StatModifier.NONE]: [ArmorStat.Strength, 0, 0],
  [StatModifier.MINOR_MOBILITY]: [ArmorStat.Mobility, 5, 1],
  [StatModifier.MAJOR_MOBILITY]: [ArmorStat.Mobility, 10, 3],
  [StatModifier.MINOR_RESILIENCE]: [ArmorStat.Resilience, 5, 1],
  [StatModifier.MAJOR_RESILIENCE]: [ArmorStat.Resilience, 10, 3],
  [StatModifier.MINOR_RECOVERY]: [ArmorStat.Recovery, 5, 2],
  [StatModifier.MAJOR_RECOVERY]: [ArmorStat.Recovery, 10, 4],
  [StatModifier.MINOR_DISCIPLINE]: [ArmorStat.Discipline, 5, 1],
  [StatModifier.MAJOR_DISCIPLINE]: [ArmorStat.Discipline, 10, 3],
  [StatModifier.MINOR_INTELLECT]: [ArmorStat.Intellect, 5, 2],
  [StatModifier.MAJOR_INTELLECT]: [ArmorStat.Intellect, 10, 5],
  [StatModifier.MINOR_STRENGTH]: [ArmorStat.Strength, 5, 1],
  [StatModifier.MAJOR_STRENGTH]: [ArmorStat.Strength, 10, 3]
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
