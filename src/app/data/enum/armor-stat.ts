import { EnumDictionary } from "../types/EnumDictionary";
import { DestinyEnergyType } from "bungie-api-ts/destiny2";

export enum StatModifier {
  NONE,
  MINOR_MOBILITY,
  MAJOR_MOBILITY,
  ARTIFICE_MOBILITY,
  MINOR_RESILIENCE,
  MAJOR_RESILIENCE,
  ARTIFICE_RESILIENCE,
  MINOR_RECOVERY,
  MAJOR_RECOVERY,
  ARTIFICE_RECOVERY,
  MINOR_DISCIPLINE,
  MAJOR_DISCIPLINE,
  ARTIFICE_DISCIPLINE,
  MINOR_INTELLECT,
  MAJOR_INTELLECT,
  ARTIFICE_INTELLECT,
  MINOR_STRENGTH,
  MAJOR_STRENGTH,
  ARTIFICE_STRENGTH,
}

export enum ArmorStat {
  Mobility,
  Resilience,
  Recovery,
  Discipline,
  Intellect,
  Strength,
}

// Stat Enum, bonus, cost, mod hash
export const STAT_MOD_VALUES: EnumDictionary<StatModifier, [ArmorStat, number, number, number]> = {
  [StatModifier.NONE]: [ArmorStat.Strength, 0, 0, 0],
  [StatModifier.MINOR_MOBILITY]: [ArmorStat.Mobility, 5, 1, 1703647492],
  [StatModifier.MAJOR_MOBILITY]: [ArmorStat.Mobility, 10, 3, 4183296050],
  [StatModifier.ARTIFICE_MOBILITY]: [ArmorStat.Mobility, 3, 0, 2322202118],
  [StatModifier.MINOR_RESILIENCE]: [ArmorStat.Resilience, 5, 2, 2532323436],
  [StatModifier.MAJOR_RESILIENCE]: [ArmorStat.Resilience, 10, 4, 1180408010],
  [StatModifier.ARTIFICE_RESILIENCE]: [ArmorStat.Resilience, 3, 0, 199176566],
  [StatModifier.MINOR_RECOVERY]: [ArmorStat.Recovery, 5, 2, 1237786518],
  [StatModifier.MAJOR_RECOVERY]: [ArmorStat.Recovery, 10, 4, 4204488676],
  [StatModifier.ARTIFICE_RECOVERY]: [ArmorStat.Recovery, 3, 0, 539459624],
  [StatModifier.MINOR_DISCIPLINE]: [ArmorStat.Discipline, 5, 1, 4021790309],
  [StatModifier.MAJOR_DISCIPLINE]: [ArmorStat.Discipline, 10, 3, 1435557120],
  [StatModifier.ARTIFICE_DISCIPLINE]: [ArmorStat.Discipline, 3, 0, 617569843],
  [StatModifier.MINOR_INTELLECT]: [ArmorStat.Intellect, 5, 2, 350061697],
  [StatModifier.MAJOR_INTELLECT]: [ArmorStat.Intellect, 10, 4, 2724608735],
  [StatModifier.ARTIFICE_INTELLECT]: [ArmorStat.Intellect, 3, 0, 3160845295],
  [StatModifier.MINOR_STRENGTH]: [ArmorStat.Strength, 5, 1, 2639422088],
  [StatModifier.MAJOR_STRENGTH]: [ArmorStat.Strength, 10, 3, 4287799666],
  [StatModifier.ARTIFICE_STRENGTH]: [ArmorStat.Strength, 3, 0, 2507624050],
};

export const ArmorStatNames: EnumDictionary<ArmorStat, string> = {
  [ArmorStat.Mobility]: "Mobility",
  [ArmorStat.Resilience]: "Resilience",
  [ArmorStat.Recovery]: "Recovery",
  [ArmorStat.Discipline]: "Discipline",
  [ArmorStat.Intellect]: "Intellect",
  [ArmorStat.Strength]: "Strength",
};
export const ArmorStatIconUrls: EnumDictionary<ArmorStat, string> = {
  [ArmorStat.Mobility]:
    "https://www.bungie.net/common/destiny2_content/icons/e26e0e93a9daf4fdd21bf64eb9246340.png",
  [ArmorStat.Resilience]:
    "https://www.bungie.net/common/destiny2_content/icons/202ecc1c6febeb6b97dafc856e863140.png",
  [ArmorStat.Recovery]:
    "https://www.bungie.net/common/destiny2_content/icons/128eee4ee7fc127851ab32eac6ca91cf.png",
  [ArmorStat.Discipline]:
    "https://www.bungie.net/common/destiny2_content/icons/79be2d4adef6a19203f7385e5c63b45b.png",
  [ArmorStat.Intellect]:
    "https://www.bungie.net/common/destiny2_content/icons/d1c154469670e9a592c9d4cbdcae5764.png",
  [ArmorStat.Strength]:
    "https://www.bungie.net/common/destiny2_content/icons/ea5af04ccd6a3470a44fd7bb0f66e2f7.png",
};

type Literal<T extends ArmorStat> = `${T}`;
export type ArmorStatLiteral = Literal<ArmorStat>;

export enum SpecialArmorStat {
  ClassAbilityRegenerationStat = 10,
}

export enum ArmorPerkOrSlot {
  None,
  SlotNightmare,
  SlotArtifice,
  SlotLastWish,
  SlotGardenOfSalvation,
  SlotDeepStoneCrypt,
  SlotVaultOfGlass,
  PerkIronBanner,
  PerkUniformedOfficer,
  SlotVowOfTheDisciple,
  SlotKingsFall,
  PerkPlunderersTrappings,
  SeraphSensorArray,
  SlotRootOfNightmares,
  PerkQueensFavor,
  // A special case just for guardian games class items.
  GuardianGamesClassItem,
  COUNT,
}

export const ArmorPerkOrSlotNames: EnumDictionary<ArmorPerkOrSlot, string> = {
  [ArmorPerkOrSlot.None]: "None",
  [ArmorPerkOrSlot.GuardianGamesClassItem]: "Guardian Games",
  [ArmorPerkOrSlot.SlotNightmare]: "Nightmare Hunt Modslot",
  [ArmorPerkOrSlot.SlotArtifice]: "Artifice Modslot",
  [ArmorPerkOrSlot.SlotLastWish]: "Last Wish Modslot",
  [ArmorPerkOrSlot.SlotGardenOfSalvation]: "Garden of Salvation Modslot",
  [ArmorPerkOrSlot.SlotDeepStoneCrypt]: "Deep Stone Crypt Modslot",
  [ArmorPerkOrSlot.SlotVaultOfGlass]: "Vault of Glass Modslot",
  [ArmorPerkOrSlot.SlotVowOfTheDisciple]: "Vow of the Disciple Modslot",
  [ArmorPerkOrSlot.PerkIronBanner]: "Iron Banner Perk",
  [ArmorPerkOrSlot.PerkUniformedOfficer]: "Uniformed Officer",
  [ArmorPerkOrSlot.SlotKingsFall]: "King's Fall Modslot",
  [ArmorPerkOrSlot.PerkPlunderersTrappings]: "Plunderer's Trappings",
  [ArmorPerkOrSlot.SeraphSensorArray]: "Seraph Sensor Array",
  [ArmorPerkOrSlot.SlotRootOfNightmares]: "Root of Nightmares Modslot",
  [ArmorPerkOrSlot.PerkQueensFavor]: "Queen's Favor",
  [ArmorPerkOrSlot.COUNT]: "",
};
export const ArmorPerkOrSlotIcons: EnumDictionary<ArmorPerkOrSlot, string> = {
  [ArmorPerkOrSlot.None]: "https://www.bungie.net/img/misc/missing_icon_d2.png",
  //[ArmorPerkOrSlot.None]: "https://www.bungie.net/common/destiny2_content/icons/58afd7d17e7b58883b94fd5ba2e66b76.png",
  [ArmorPerkOrSlot.GuardianGamesClassItem]:
    "https://www.bungie.net/common/destiny2_content/icons/DestinyEventCardDefinition_ce6c2cf855dce694bcc89803b6bc44b7.png",
  [ArmorPerkOrSlot.SlotNightmare]:
    "https://www.bungie.net/common/destiny2_content/icons/94fe19fb98ae33e79921e3a8aa07800f.jpg",
  [ArmorPerkOrSlot.SlotArtifice]:
    "https://bungie.net/common/destiny2_content/icons/74aeb2f3d7bc16a31a6924822f850184.png",
  [ArmorPerkOrSlot.SlotLastWish]:
    "https://bungie.net/common/destiny2_content/icons/c70116144be386def9e675d76dacfe64.png",
  [ArmorPerkOrSlot.SlotGardenOfSalvation]:
    "https://www.bungie.net/common/destiny2_content/icons/94fe19fb98ae33e79921e3a8aa07800f.jpg",
  [ArmorPerkOrSlot.SlotDeepStoneCrypt]:
    "https://bungie.net/common/destiny2_content/icons/3c14e3c3a747a7487c76f38602b9e2fe.png",
  [ArmorPerkOrSlot.SlotVaultOfGlass]:
    "https://bungie.net/common/destiny2_content/icons/9603e0d01826d7ab97ce1b1bf3eb3c96.png",
  [ArmorPerkOrSlot.SlotVowOfTheDisciple]:
    "https://www.bungie.net//common/destiny2_content/icons/1f66fa02b19f40e6ce5d8336c7ed5a00.png",
  [ArmorPerkOrSlot.PerkIronBanner]:
    "https://bungie.net/common/destiny2_content/icons/DestinyActivityModeDefinition_fe57052d7cf971f7502daa75a2ca2437.png",
  [ArmorPerkOrSlot.PerkUniformedOfficer]:
    "https://bungie.net/common/destiny2_content/icons/b39b83dd5ea3d9144e4e63f103af8b46.png",
  [ArmorPerkOrSlot.SlotKingsFall]:
    "https://www.bungie.net/common/destiny2_content/icons/bc809878e0c2ed8fd32feb62aaae690c.png",
  [ArmorPerkOrSlot.PerkPlunderersTrappings]:
    "https://www.bungie.net/common/destiny2_content/icons/d7ad8979dab2f4544e2cfb66f262f7d1.png",
  [ArmorPerkOrSlot.SeraphSensorArray]:
    "https://www.bungie.net/common/destiny2_content/icons/d7ad8979dab2f4544e2cfb66f262f7d1.png",
  [ArmorPerkOrSlot.SlotRootOfNightmares]:
    "https://www.bungie.net/common/destiny2_content/icons/9694158ef08d416ab091062629b6b7ec.png",
  [ArmorPerkOrSlot.PerkQueensFavor]:
    "https://www.bungie.net/common/destiny2_content/icons/d64dc503b9a88c179635e777c30db86c.png",
  [ArmorPerkOrSlot.COUNT]: "",
};

export const ArmorPerkOrSlotDIMText: EnumDictionary<ArmorPerkOrSlot, string> = {
  [ArmorPerkOrSlot.None]: "",
  [ArmorPerkOrSlot.GuardianGamesClassItem]: "(hash:537041732 or hash:366019830 or hash:1013401891)",
  [ArmorPerkOrSlot.SlotNightmare]: "modslot:nightmare",
  [ArmorPerkOrSlot.SlotArtifice]: 'perkname:"artifice armor"',
  [ArmorPerkOrSlot.SlotLastWish]: "modslot:lastwish",
  [ArmorPerkOrSlot.SlotGardenOfSalvation]: "modslot:gardenofsalvation",
  [ArmorPerkOrSlot.SlotDeepStoneCrypt]: "modslot:deepstonecrypt",
  [ArmorPerkOrSlot.SlotVaultOfGlass]: "modslot:vaultofglass",
  [ArmorPerkOrSlot.SlotVowOfTheDisciple]: "source:vow",
  [ArmorPerkOrSlot.PerkIronBanner]: 'perkname:"iron lord\'s pride"',
  [ArmorPerkOrSlot.PerkUniformedOfficer]: 'perkname:"Uniformed Officer"',
  [ArmorPerkOrSlot.SlotKingsFall]: "modslot:kingsfall",
  [ArmorPerkOrSlot.PerkPlunderersTrappings]: 'perkname:"plunderer\'s trappings"',
  [ArmorPerkOrSlot.SeraphSensorArray]: 'perkname:"seraph sensor array"',
  [ArmorPerkOrSlot.SlotRootOfNightmares]: "modslot:rootofnightmares",
  [ArmorPerkOrSlot.PerkQueensFavor]: 'perkname:"queen\'s favor"',
  [ArmorPerkOrSlot.COUNT]: "",
};

export const ArmorAffinityNames: EnumDictionary<DestinyEnergyType, string> = {
  [DestinyEnergyType.Any]: "Any",
  [DestinyEnergyType.Arc]: "Arc",
  [DestinyEnergyType.Thermal]: "Solar",
  [DestinyEnergyType.Void]: "Void",
  [DestinyEnergyType.Stasis]: "Stasis",
  [DestinyEnergyType.Ghost]: "Ghost",
  [DestinyEnergyType.Subclass]: "Subclass",
};
export const ArmorAffinityIcons: EnumDictionary<DestinyEnergyType, string> = {
  [DestinyEnergyType.Any]: "",
  [DestinyEnergyType.Arc]:
    "https://www.bungie.net/common/destiny2_content/icons/DestinyEnergyTypeDefinition_092d066688b879c807c3b460afdd61e6.png",
  [DestinyEnergyType.Thermal]:
    "https://www.bungie.net/common/destiny2_content/icons/DestinyEnergyTypeDefinition_2a1773e10968f2d088b97c22b22bba9e.png",
  [DestinyEnergyType.Void]:
    "https://www.bungie.net/common/destiny2_content/icons/DestinyEnergyTypeDefinition_ceb2f6197dccf3958bb31cc783eb97a0.png",
  [DestinyEnergyType.Stasis]:
    "https://www.bungie.net/common/destiny2_content/icons/DestinyEnergyTypeDefinition_530c4c3e7981dc2aefd24fd3293482bf.png",
  [DestinyEnergyType.Ghost]: "",
  [DestinyEnergyType.Subclass]: "",
};
