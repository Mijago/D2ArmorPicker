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
export const ArmorStatIconUrls: EnumDictionary<ArmorStat, string> = {
  [ArmorStat.Mobility]: "https://www.bungie.net/common/destiny2_content/icons/e26e0e93a9daf4fdd21bf64eb9246340.png",
  [ArmorStat.Resilience]: "https://www.bungie.net/common/destiny2_content/icons/202ecc1c6febeb6b97dafc856e863140.png",
  [ArmorStat.Recovery]: "https://www.bungie.net/common/destiny2_content/icons/128eee4ee7fc127851ab32eac6ca91cf.png",
  [ArmorStat.Discipline]: "https://www.bungie.net/common/destiny2_content/icons/ca62128071dc254fe75891211b98b237.png",
  [ArmorStat.Intellect]: "https://www.bungie.net/common/destiny2_content/icons/59732534ce7060dba681d1ba84c055a6.png",
  [ArmorStat.Strength]: "https://www.bungie.net/common/destiny2_content/icons/c7eefc8abbaa586eeab79e962a79d6ad.png"
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
  PerkUniformedOfficer,
  SlotVowOfTheDisciple,
  COUNT
}

export const ArmorPerkOrSlotNames: EnumDictionary<ArmorPerkOrSlot, string> = {
  [ArmorPerkOrSlot.None]: "",
  [ArmorPerkOrSlot.SlotNightmare]: "Nightmare Hunt Modslot",
  [ArmorPerkOrSlot.SlotArtificer]: "Artificer Modslot",
  [ArmorPerkOrSlot.SlotLastWish]: "Last Wish Modslot",
  [ArmorPerkOrSlot.SlotGardenOfSalvation]: "Garden of Salvation Modslot",
  [ArmorPerkOrSlot.SlotDeepStoneCrypt]: "Deep Stone Crypt Modslot",
  [ArmorPerkOrSlot.SlotVaultOfGlass]: "Vault of Glass Modslot",
  [ArmorPerkOrSlot.SlotVowOfTheDisciple]: "Vow of the Disciple Modslot",
  [ArmorPerkOrSlot.PerkIronBanner]: "Iron Banner Perk",
  [ArmorPerkOrSlot.PerkUniformedOfficer]: "Uniformed Officer Perk",
  [ArmorPerkOrSlot.COUNT]: "",
}
export const ArmorPerkOrSlotIcons: EnumDictionary<ArmorPerkOrSlot, string> = {
  [ArmorPerkOrSlot.None]: "",
  [ArmorPerkOrSlot.SlotNightmare]: "https://bungie.net/common/destiny2_content/icons/6bf9ba37386b907ddb514ec422fc74c9.png",
  [ArmorPerkOrSlot.SlotArtificer]: "https://bungie.net/common/destiny2_content/icons/b4d05ef69d0c3227a7d4f7f35bbc2848.png",
  [ArmorPerkOrSlot.SlotLastWish]: "https://bungie.net/common/destiny2_content/icons/c70116144be386def9e675d76dacfe64.png",
  [ArmorPerkOrSlot.SlotGardenOfSalvation]: "https://bungie.net/common/destiny2_content/icons/6bf9ba37386b907ddb514ec422fc74c9.png",
  [ArmorPerkOrSlot.SlotDeepStoneCrypt]: "https://bungie.net/common/destiny2_content/icons/3c14e3c3a747a7487c76f38602b9e2fe.png",
  [ArmorPerkOrSlot.SlotVaultOfGlass]: "https://bungie.net/common/destiny2_content/icons/9603e0d01826d7ab97ce1b1bf3eb3c96.png",
  [ArmorPerkOrSlot.SlotVowOfTheDisciple]: "https://bungie.net/common/destiny2_content/icons/b4d05ef69d0c3227a7d4f7f35bbc2848.png",
  [ArmorPerkOrSlot.PerkIronBanner]: "https://bungie.net/common/destiny2_content/icons/DestinyActivityModeDefinition_fe57052d7cf971f7502daa75a2ca2437.png",
  [ArmorPerkOrSlot.PerkUniformedOfficer]: "https://bungie.net/common/destiny2_content/icons/b39b83dd5ea3d9144e4e63f103af8b46.png",
  [ArmorPerkOrSlot.COUNT]: "",
}

export const ArmorPerkOrSlotDIMText: EnumDictionary<ArmorPerkOrSlot, string> = {
  [ArmorPerkOrSlot.None]: "",
  [ArmorPerkOrSlot.SlotNightmare]: "modslot:nightmare",
  [ArmorPerkOrSlot.SlotArtificer]: "perkname:\"artifice armor\"",
  [ArmorPerkOrSlot.SlotLastWish]: "modslot:lastwish",
  [ArmorPerkOrSlot.SlotGardenOfSalvation]: "modslot:gardenofsalvation",
  [ArmorPerkOrSlot.SlotDeepStoneCrypt]: "modslot:deepstonecrypt",
  [ArmorPerkOrSlot.SlotVaultOfGlass]: "modslot:vaultofglass",
  [ArmorPerkOrSlot.SlotVowOfTheDisciple]: "source:vow",
  [ArmorPerkOrSlot.PerkIronBanner]: "perkname:\"iron lord's pride\"",
  [ArmorPerkOrSlot.PerkUniformedOfficer]: "perkname:\"Uniformed Officer\"",
  [ArmorPerkOrSlot.COUNT]: "",
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

