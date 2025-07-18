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
    [ArmorStat.StatWeapon]: { fixed: false, value: value },
    [ArmorStat.StatHealth]: { fixed: false, value: value },
    [ArmorStat.StatClass]: { fixed: false, value: value },
    [ArmorStat.StatGrenade]: { fixed: false, value: value },
    [ArmorStat.StatSuper]: { fixed: false, value: value },
    [ArmorStat.StatMelee]: { fixed: false, value: value },
  };
}

export interface FixableSelection<T> {
  value: T;
  fixed: boolean;
}

export class BuildConfiguration {
  characterClass: DestinyClass = DestinyClass.Unknown;

  // Add constant +1 strength
  addConstent1Health = false;

  assumeClassItemIsArtifice = false;
  assumeEveryLegendaryIsArtifice = false;
  assumeEveryExoticIsArtifice = false;

  // contains a list of item instances IDs that shall not be used in builds
  disabledItems: string[] = [];

  minimumStatTiers: EnumDictionary<ArmorStat, FixableSelection<number>> = {
    [ArmorStat.StatWeapon]: { fixed: false, value: 0 },
    [ArmorStat.StatHealth]: { fixed: false, value: 0 },
    [ArmorStat.StatClass]: { fixed: false, value: 0 },
    [ArmorStat.StatGrenade]: { fixed: false, value: 0 },
    [ArmorStat.StatSuper]: { fixed: false, value: 0 },
    [ArmorStat.StatMelee]: { fixed: false, value: 0 },
  };
  maximumStatMods: number = 5; // TODO: remove

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
  allowLegacyArmor = true; // Allow armor 2.0, which is the legacy armor system
  ignoreSunsetArmor = false;
  includeVendorRolls = false;
  includeCollectionRolls = false;
  assumeLegendariesMasterworked = true;
  assumeExoticsMasterworked = true;
  onlyUseMasterworkedExotics = false;
  onlyUseMasterworkedLegendaries = false;
  modOptimizationStrategy: ModOptimizationStrategy = ModOptimizationStrategy.None;
  limitParsedResults = true; // Limits the amount of results that are parsed. This looses some results, but solves memory issues
  tryLimitWastedStats = false;
  onlyShowResultsWithNoWastedStats = false;

  selectedModElement: ModifierType = ModifierType.Stasis;
  enabledMods: ModOrAbility[] = [];
  selectedExotics: number[] = [];
  selectedExoticPerks: ArmorPerkOrSlot[] = [ArmorPerkOrSlot.Any, ArmorPerkOrSlot.Any];
  // mainly for the exotic class item

  armorPerks: EnumDictionary<ArmorSlot, FixableSelection<ArmorPerkOrSlot>> = {
    [ArmorSlot.ArmorSlotHelmet]: { fixed: true, value: ArmorPerkOrSlot.Any },
    [ArmorSlot.ArmorSlotGauntlet]: { fixed: true, value: ArmorPerkOrSlot.Any },
    [ArmorSlot.ArmorSlotChest]: { fixed: true, value: ArmorPerkOrSlot.Any },
    [ArmorSlot.ArmorSlotLegs]: { fixed: true, value: ArmorPerkOrSlot.Any },
    [ArmorSlot.ArmorSlotClass]: { fixed: true, value: ArmorPerkOrSlot.Any },
    [ArmorSlot.ArmorSlotNone]: { fixed: true, value: ArmorPerkOrSlot.Any },
  };

  static buildEmptyConfiguration(): BuildConfiguration {
    return {
      enabledMods: [],
      disabledItems: [],
      addConstent1Health: false,
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
      allowLegacyArmor: true,
      assumeLegendariesMasterworked: true,
      assumeExoticsMasterworked: true,
      limitParsedResults: true,
      modOptimizationStrategy: ModOptimizationStrategy.None,
      tryLimitWastedStats: false,
      onlyShowResultsWithNoWastedStats: false,
      characterClass: DestinyClass.Unknown,
      selectedModElement: ModifierType.Prismatic,
      selectedExotics: [],
      selectedExoticPerks: [ArmorPerkOrSlot.Any, ArmorPerkOrSlot.Any],
      maximumModSlots: {
        [ArmorSlot.ArmorSlotHelmet]: { fixed: false, value: 5 },
        [ArmorSlot.ArmorSlotGauntlet]: { fixed: false, value: 5 },
        [ArmorSlot.ArmorSlotChest]: { fixed: false, value: 5 },
        [ArmorSlot.ArmorSlotLegs]: { fixed: false, value: 5 },
        [ArmorSlot.ArmorSlotClass]: { fixed: false, value: 5 },
        [ArmorSlot.ArmorSlotNone]: { fixed: false, value: 5 },
      },
      armorPerks: {
        [ArmorSlot.ArmorSlotHelmet]: { fixed: true, value: ArmorPerkOrSlot.Any },
        [ArmorSlot.ArmorSlotGauntlet]: { fixed: true, value: ArmorPerkOrSlot.Any },
        [ArmorSlot.ArmorSlotChest]: { fixed: true, value: ArmorPerkOrSlot.Any },
        [ArmorSlot.ArmorSlotLegs]: { fixed: true, value: ArmorPerkOrSlot.Any },
        [ArmorSlot.ArmorSlotClass]: { fixed: true, value: ArmorPerkOrSlot.Any },
        [ArmorSlot.ArmorSlotNone]: { fixed: true, value: ArmorPerkOrSlot.Any },
      },
      minimumStatTiers: getDefaultStatDict(0),
    };
  }
}
