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

import { ArmorPerkOrSlot, ArmorStat } from "./enum/armor-stat";
import { ModOrAbility } from "./enum/modOrAbility";
import { EnumDictionary } from "./types/EnumDictionary";
import { MAXIMUM_STAT_MOD_AMOUNT } from "./constants";
import { ArmorSlot } from "./enum/armor-slot";
import { ModifierType } from "./enum/modifierType";
import { ModOptimizationStrategy } from "./enum/mod-optimization-strategy";
import { DestinyClass } from "bungie-api-ts/destiny2/interfaces";

export function getDefaultStatDict(
  value: number
): EnumDictionary<ArmorStat, FixableSelection<number>> {
  return {
    [ArmorStat.Mobility]: { fixed: false, value: value },
    [ArmorStat.Resilience]: { fixed: false, value: value },
    [ArmorStat.Recovery]: { fixed: false, value: value },
    [ArmorStat.Discipline]: { fixed: false, value: value },
    [ArmorStat.Intellect]: { fixed: false, value: value },
    [ArmorStat.Strength]: { fixed: false, value: value },
  };
}

export interface FixableSelection<T> {
  value: T;
  fixed: boolean;
}

export class BuildConfiguration {
  characterClass: DestinyClass = DestinyClass.Titan;

  // Add constant +1 strength
  addConstent1Resilience = false;

  assumeClassItemIsArtifice = false;
  assumeEveryLegendaryIsArtifice = false;
  assumeEveryExoticIsArtifice = false;

  // contains a list of item instances IDs that shall not be used in builds
  disabledItems: string[] = [];

  // TODO: convert minimumStatTier -> minimumStatTiers for old configs
  minimumStatTiers: EnumDictionary<ArmorStat, FixableSelection<number>> = {
    [ArmorStat.Mobility]: { fixed: false, value: 0 },
    [ArmorStat.Resilience]: { fixed: false, value: 0 },
    [ArmorStat.Recovery]: { fixed: false, value: 0 },
    [ArmorStat.Discipline]: { fixed: false, value: 0 },
    [ArmorStat.Intellect]: { fixed: false, value: 0 },
    [ArmorStat.Strength]: { fixed: false, value: 0 },
  };
  maximumStatMods: number = 5; // TODO: remove

  // if set, then we can use the exact stats like 6x69. It will be stored as "fixed 6.9" in minimumStatTiers
  allowExactStats = false;

  // Fixable, BUT the bool is not yet used. Maybe in a future update.
  maximumModSlots: EnumDictionary<ArmorSlot, FixableSelection<number>> = {
    [ArmorSlot.ArmorSlotHelmet]: { fixed: false, value: 5 },
    [ArmorSlot.ArmorSlotGauntlet]: { fixed: false, value: 5 },
    [ArmorSlot.ArmorSlotChest]: { fixed: false, value: 5 },
    [ArmorSlot.ArmorSlotLegs]: { fixed: false, value: 5 },
    [ArmorSlot.ArmorSlotClass]: { fixed: false, value: 5 },
    [ArmorSlot.ArmorSlotNone]: { fixed: false, value: 5 },
  };

  putArtificeMods = true;
  useFotlArmor = true;
  allowBlueArmorPieces = true;
  ignoreSunsetArmor = false;
  includeVendorRolls = false;
  includeCollectionRolls = false;
  assumeLegendariesMasterworked = true;
  assumeExoticsMasterworked = true;
  assumeClassItemMasterworked = true;
  onlyUseMasterworkedExotics = false;
  onlyUseMasterworkedLegendaries = false;
  modOptimizationStrategy: ModOptimizationStrategy = ModOptimizationStrategy.None;
  limitParsedResults = true; // Limits the amount of results that are parsed. This looses some results, but solves memory issues
  tryLimitWastedStats = false;
  onlyShowResultsWithNoWastedStats = false;
  showWastedStatsColumn = false;
  showPotentialTierColumn = false;

  selectedModElement: ModifierType = ModifierType.Stasis;
  enabledMods: ModOrAbility[] = [];
  selectedExotics: number[] = [];
  // mainly for the exotic class item
  ignoreExistingExoticArtificeSlots = false;

  armorPerks: EnumDictionary<ArmorSlot, FixableSelection<ArmorPerkOrSlot>> = {
    [ArmorSlot.ArmorSlotHelmet]: { fixed: true, value: ArmorPerkOrSlot.None },
    [ArmorSlot.ArmorSlotGauntlet]: { fixed: true, value: ArmorPerkOrSlot.None },
    [ArmorSlot.ArmorSlotChest]: { fixed: true, value: ArmorPerkOrSlot.None },
    [ArmorSlot.ArmorSlotLegs]: { fixed: true, value: ArmorPerkOrSlot.None },
    [ArmorSlot.ArmorSlotClass]: { fixed: true, value: ArmorPerkOrSlot.None },
    [ArmorSlot.ArmorSlotNone]: { fixed: true, value: ArmorPerkOrSlot.None },
  };

  static buildEmptyConfiguration(): BuildConfiguration {
    return {
      ignoreExistingExoticArtificeSlots: false,
      allowExactStats: false,
      enabledMods: [],
      disabledItems: [],
      addConstent1Resilience: false,
      assumeEveryLegendaryIsArtifice: false,
      assumeEveryExoticIsArtifice: false,
      assumeClassItemIsArtifice: false,
      putArtificeMods: true,
      useFotlArmor: false,
      maximumStatMods: MAXIMUM_STAT_MOD_AMOUNT,
      onlyUseMasterworkedExotics: false,
      onlyUseMasterworkedLegendaries: false,
      ignoreSunsetArmor: false,
      includeCollectionRolls: false,
      includeVendorRolls: false,
      allowBlueArmorPieces: true,
      assumeLegendariesMasterworked: true,
      assumeExoticsMasterworked: true,
      assumeClassItemMasterworked: true,
      limitParsedResults: true,
      modOptimizationStrategy: ModOptimizationStrategy.None,
      tryLimitWastedStats: false,
      onlyShowResultsWithNoWastedStats: false,
      showWastedStatsColumn: false,
      showPotentialTierColumn: false,
      characterClass: DestinyClass.Titan,
      selectedModElement: ModifierType.Stasis,
      selectedExotics: [],
      maximumModSlots: {
        [ArmorSlot.ArmorSlotHelmet]: { fixed: false, value: 5 },
        [ArmorSlot.ArmorSlotGauntlet]: { fixed: false, value: 5 },
        [ArmorSlot.ArmorSlotChest]: { fixed: false, value: 5 },
        [ArmorSlot.ArmorSlotLegs]: { fixed: false, value: 5 },
        [ArmorSlot.ArmorSlotClass]: { fixed: false, value: 5 },
        [ArmorSlot.ArmorSlotNone]: { fixed: false, value: 5 },
      },
      armorPerks: {
        [ArmorSlot.ArmorSlotHelmet]: { fixed: true, value: ArmorPerkOrSlot.None },
        [ArmorSlot.ArmorSlotGauntlet]: { fixed: true, value: ArmorPerkOrSlot.None },
        [ArmorSlot.ArmorSlotChest]: { fixed: true, value: ArmorPerkOrSlot.None },
        [ArmorSlot.ArmorSlotLegs]: { fixed: true, value: ArmorPerkOrSlot.None },
        [ArmorSlot.ArmorSlotClass]: { fixed: true, value: ArmorPerkOrSlot.None },
        [ArmorSlot.ArmorSlotNone]: { fixed: true, value: ArmorPerkOrSlot.None },
      },
      minimumStatTiers: getDefaultStatDict(0),
    };
  }
}
