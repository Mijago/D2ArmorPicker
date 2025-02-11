/*
 * Copyright (c) 2023 D2ArmorPicker by Mijago.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import { EnumDictionary } from "../types/EnumDictionary";
import { DestinyClass } from "bungie-api-ts/destiny2";
import { ModifierType, Subclass } from "./modifierType";

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

export const ArmorStatHashes: EnumDictionary<ArmorStat, number> = {
  [ArmorStat.Mobility]: 2996146975,
  [ArmorStat.Resilience]: 392767087,
  [ArmorStat.Recovery]: 1943323491,
  [ArmorStat.Discipline]: 1735777505,
  [ArmorStat.Intellect]: 144602215,
  [ArmorStat.Strength]: 4244567218,
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

export enum SpecialArmorStat {
  ClassAbilityRegenerationStat = 10,
}

export enum ArmorPerkOrSlot {
  None = -1,
  Any,
  SlotCrotasEnd = 2,
  SlotRootOfNightmares,
  SlotKingsFall,
  SlotVowOfTheDisciple,
  SlotVaultOfGlass,
  SlotDeepStoneCrypt,
  SlotGardenOfSalvation,
  SlotLastWish,
  SlotArtifice,
  PerkIronBanner,
  SlotNightmare,
  // A special case just for guardian games class items.
  GuardianGamesClassItem = 18,

  PerkEchoesOfGlory = 20,
  SlotSalvationsEdge,
  SlotEidosApprentice,
  SlotOverflowingCorruption,
}

// In the case that a perk has multiple possible hashes, we can use this to determine a mapping
export const MapAlternativeToArmorPerkOrSlot: EnumDictionary<number, ArmorPerkOrSlot> = {
  [1760565003]: ArmorPerkOrSlot.PerkEchoesOfGlory,
};

export const ArmorPerkOrSlotNames: EnumDictionary<ArmorPerkOrSlot, string> = {
  [ArmorPerkOrSlot.None]: "None",
  [ArmorPerkOrSlot.Any]: "Any",
  [ArmorPerkOrSlot.SlotCrotasEnd]: "Crota's End Modslot",
  [ArmorPerkOrSlot.SlotRootOfNightmares]: "Root of Nightmares Modslot",
  [ArmorPerkOrSlot.SlotKingsFall]: "King's Fall Modslot",
  [ArmorPerkOrSlot.SlotVowOfTheDisciple]: "Vow of the Disciple Modslot",
  [ArmorPerkOrSlot.SlotVaultOfGlass]: "Vault of Glass Modslot",
  [ArmorPerkOrSlot.SlotDeepStoneCrypt]: "Deep Stone Crypt Modslot",
  [ArmorPerkOrSlot.SlotGardenOfSalvation]: "Garden of Salvation Modslot",
  [ArmorPerkOrSlot.SlotLastWish]: "Last Wish Modslot",
  [ArmorPerkOrSlot.SlotArtifice]: "Artifice Modslot",
  [ArmorPerkOrSlot.PerkIronBanner]: "Iron Banner Perk",
  [ArmorPerkOrSlot.SlotNightmare]: "Nightmare Hunt Modslot",
  [ArmorPerkOrSlot.GuardianGamesClassItem]: "Guardian Games",
  [ArmorPerkOrSlot.PerkEchoesOfGlory]: "Echoes of Glory Perk",
  [ArmorPerkOrSlot.SlotSalvationsEdge]: "Salvation's Edge Modslot",
  [ArmorPerkOrSlot.SlotEidosApprentice]: "Eido's Apprentice Perk",
  [ArmorPerkOrSlot.SlotOverflowingCorruption]: "Overflowing Corruption Perk",
};

export const ArmorPerkOrSlotIcons: EnumDictionary<ArmorPerkOrSlot, string> = {
  [ArmorPerkOrSlot.Any]: "https://www.bungie.net/img/misc/missing_icon_d2.png",
  [ArmorPerkOrSlot.None]:
    "https://www.bungie.net//common/destiny2_content/icons/56761c8361e33a367c6fa94f397d8692.png",
  //[ArmorPerkOrSlot.None]: "https://www.bungie.net/common/destiny2_content/icons/58afd7d17e7b58883b94fd5ba2e66b76.png",
  [ArmorPerkOrSlot.SlotCrotasEnd]:
    "https://www.bungie.net/common/destiny2_content/icons/7ddce334fe8391848f408227439c1d7a.png",
  [ArmorPerkOrSlot.SlotRootOfNightmares]:
    "https://www.bungie.net/common/destiny2_content/icons/f2b6ec58e14244e4972705897667c246.png",
  [ArmorPerkOrSlot.SlotKingsFall]:
    "https://www.bungie.net/common/destiny2_content/icons/0e515c7cf25a2f2350b788e6f5b7f8eb.png",
  [ArmorPerkOrSlot.SlotVowOfTheDisciple]:
    "https://www.bungie.net/common/destiny2_content/icons/b84b6ea72dd05de7123aa2ae87ba0d6a.png",
  [ArmorPerkOrSlot.SlotVaultOfGlass]:
    "https://www.bungie.net/common/destiny2_content/icons/7c9a2d95113de19c5acdbed57775abf4.png",
  [ArmorPerkOrSlot.SlotDeepStoneCrypt]:
    "https://www.bungie.net/common/destiny2_content/icons/d6452d010cfe72a51a9089ec68ab223c.png",
  [ArmorPerkOrSlot.SlotGardenOfSalvation]:
    "https://www.bungie.net/common/destiny2_content/icons/53d6e3505cd03d4026b3dbbd9ccc19b6.jpg",
  [ArmorPerkOrSlot.SlotLastWish]:
    "https://www.bungie.net/common/destiny2_content/icons/76f0c1520fa384ceb27bd2469225dd8a.png",
  [ArmorPerkOrSlot.SlotArtifice]:
    "https://www.bungie.net/common/destiny2_content/icons/46eec78bb7864641bbd7ba1fd4f9f248.png",
  [ArmorPerkOrSlot.PerkIronBanner]:
    "https://bungie.net/common/destiny2_content/icons/DestinyActivityModeDefinition_fe57052d7cf971f7502daa75a2ca2437.png",
  [ArmorPerkOrSlot.SlotNightmare]:
    "https://www.bungie.net/common/destiny2_content/icons/53d6e3505cd03d4026b3dbbd9ccc19b6.jpg",
  [ArmorPerkOrSlot.GuardianGamesClassItem]:
    "https://www.bungie.net/common/destiny2_content/icons/DestinyEventCardDefinition_ce6c2cf855dce694bcc89803b6bc44b7.png",
  [ArmorPerkOrSlot.SlotSalvationsEdge]:
    "https://www.bungie.net/common/destiny2_content/icons/f4a1f99b49ecf412726d71ea9ee15540.png",
  [ArmorPerkOrSlot.PerkEchoesOfGlory]:
    "https://www.bungie.net/common/destiny2_content/icons/c67322c917e16f3b8a4cb962e3f11166.png",
  [ArmorPerkOrSlot.SlotEidosApprentice]:
    "https://www.bungie.net/common/destiny2_content/icons/e083d8a85c2c60825204d14b9e9263b7.png",
  [ArmorPerkOrSlot.SlotOverflowingCorruption]:
    "https://www.bungie.net/common/destiny2_content/icons/7a714dc1f8b669d8d5901c1543eb244b.png",
};

// List of armorInventoryItem.sockets.socketEntries[n].singleInitialItemHash values for each type
// GuardianGamesClassItem is excluded as these are checked by item hash
export const ArmorPerkSocketHashes: EnumDictionary<
  Exclude<
    ArmorPerkOrSlot,
    ArmorPerkOrSlot.GuardianGamesClassItem | ArmorPerkOrSlot.Any | ArmorPerkOrSlot.None
  >,
  number
> = {
  [ArmorPerkOrSlot.SlotCrotasEnd]: 717667840,
  [ArmorPerkOrSlot.SlotRootOfNightmares]: 4144354978,
  [ArmorPerkOrSlot.SlotKingsFall]: 1728096240,
  [ArmorPerkOrSlot.SlotVowOfTheDisciple]: 2447143568,
  [ArmorPerkOrSlot.SlotVaultOfGlass]: 3738398030,
  [ArmorPerkOrSlot.SlotDeepStoneCrypt]: 4055462131,
  [ArmorPerkOrSlot.SlotGardenOfSalvation]: 706611068,
  [ArmorPerkOrSlot.SlotLastWish]: 1679876242,
  [ArmorPerkOrSlot.SlotArtifice]: 3727270518,
  [ArmorPerkOrSlot.PerkIronBanner]: 2472875850,
  [ArmorPerkOrSlot.SlotNightmare]: 1180997867,
  [ArmorPerkOrSlot.SlotSalvationsEdge]: 4059283783,
  [ArmorPerkOrSlot.PerkEchoesOfGlory]: 2352831367,
  [ArmorPerkOrSlot.SlotEidosApprentice]: 273417606,
  [ArmorPerkOrSlot.SlotOverflowingCorruption]: 1128948126,
};

export const ArmorPerkOrSlotDIMText: EnumDictionary<ArmorPerkOrSlot, string> = {
  [ArmorPerkOrSlot.Any]: "",
  [ArmorPerkOrSlot.None]: "",
  [ArmorPerkOrSlot.SlotCrotasEnd]: "modslot:crotasend",
  [ArmorPerkOrSlot.SlotRootOfNightmares]: "modslot:rootofnightmares",
  [ArmorPerkOrSlot.SlotKingsFall]: "modslot:kingsfall",
  [ArmorPerkOrSlot.SlotVowOfTheDisciple]: "modslot:vowofthedisciple",
  [ArmorPerkOrSlot.SlotVaultOfGlass]: "modslot:vaultofglass",
  [ArmorPerkOrSlot.SlotDeepStoneCrypt]: "modslot:deepstonecrypt",
  [ArmorPerkOrSlot.SlotGardenOfSalvation]: "modslot:gardenofsalvation",
  [ArmorPerkOrSlot.SlotLastWish]: "modslot:lastwish",
  [ArmorPerkOrSlot.SlotArtifice]: 'perkname:"artifice armor"',
  [ArmorPerkOrSlot.PerkIronBanner]: 'perkname:"iron lord\'s pride"',
  [ArmorPerkOrSlot.SlotNightmare]: "modslot:nightmare",
  [ArmorPerkOrSlot.GuardianGamesClassItem]: "(hash:537041732 or hash:366019830 or hash:1013401891)",
  [ArmorPerkOrSlot.PerkEchoesOfGlory]: 'exactperk:"echoes of glory"',
  [ArmorPerkOrSlot.SlotSalvationsEdge]: "(source:salvationsedge is:armor)",
  [ArmorPerkOrSlot.SlotEidosApprentice]: 'perkname:"eido\'s apprentice"',
  [ArmorPerkOrSlot.SlotOverflowingCorruption]: 'perkname:"overflowing corruption"',
};

export const SubclassHashes: EnumDictionary<
  Exclude<DestinyClass, DestinyClass.Unknown>,
  EnumDictionary<Subclass, number>
> = {
  [DestinyClass.Hunter]: {
    [ModifierType.Stasis]: 873720784,
    [ModifierType.Void]: 2453351420,
    [ModifierType.Solar]: 2240888816,
    [ModifierType.Arc]: 2328211300,
    [ModifierType.Strand]: 3785442599,
    [ModifierType.Prismatic]: 4282591831,
  },
  [DestinyClass.Titan]: {
    [ModifierType.Stasis]: 613647804,
    [ModifierType.Void]: 2842471112,
    [ModifierType.Solar]: 2550323932,
    [ModifierType.Arc]: 2932390016,
    [ModifierType.Strand]: 242419885,
    [ModifierType.Prismatic]: 1616346845,
  },
  [DestinyClass.Warlock]: {
    [ModifierType.Stasis]: 3291545503,
    [ModifierType.Void]: 2849050827,
    [ModifierType.Solar]: 3941205951,
    [ModifierType.Arc]: 3168997075,
    [ModifierType.Strand]: 4204413574,
    [ModifierType.Prismatic]: 3893112950,
  },
};
