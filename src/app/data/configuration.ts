import {ArmorPerkOrSlot, ArmorStat} from "./enum/armor-stat";
import {ModOrAbility} from "./enum/modOrAbility";
import {EnumDictionary} from "./types/EnumDictionary";
import {CharacterClass} from "./enum/character-Class";
import {MAXIMUM_STAT_MOD_AMOUNT} from "./constants";
import {DestinyEnergyType} from "bungie-api-ts/destiny2";
import {ArmorSlot} from "./enum/armor-slot";

export function getDefaultStatDict(value: number): EnumDictionary<ArmorStat, FixableSelection<number>> {
  return {
    [ArmorStat.Mobility]: {fixed: false, value: value},
    [ArmorStat.Resilience]: {fixed: false, value: value},
    [ArmorStat.Recovery]: {fixed: false, value: value},
    [ArmorStat.Discipline]: {fixed: false, value: value},
    [ArmorStat.Intellect]: {fixed: false, value: value},
    [ArmorStat.Strength]: {fixed: false, value: value}
  }
}

export interface FixableSelection<T> {
  value: T;
  fixed: boolean;
}

export class Configuration {
  characterClass: CharacterClass = CharacterClass.Titan;

  // contains a list of item instances IDs that shall not be used in builds
  disabledItems: string[] = [];

  // TODO: convert minimumStatTier -> minimumStatTiers for old configs
  minimumStatTiers: EnumDictionary<ArmorStat, FixableSelection<number>> = {
    [ArmorStat.Mobility]: {fixed: false, value: 0},
    [ArmorStat.Resilience]: {fixed: false, value: 0},
    [ArmorStat.Recovery]: {fixed: false, value: 0},
    [ArmorStat.Discipline]: {fixed: false, value: 0},
    [ArmorStat.Intellect]: {fixed: false, value: 0},
    [ArmorStat.Strength]: {fixed: false, value: 0}
  }
  maximumStatMods: number = 5; // TODO: remove

  // Fixable, BUT the bool is not yet used. Maybe in a future update.
  maximumModSlots: EnumDictionary<ArmorSlot, FixableSelection<number>> = {
    [ArmorSlot.ArmorSlotHelmet]: {fixed: false, value: 5},
    [ArmorSlot.ArmorSlotGauntlet]: {fixed: false, value: 5},
    [ArmorSlot.ArmorSlotChest]: {fixed: false, value: 5},
    [ArmorSlot.ArmorSlotLegs]: {fixed: false, value: 5},
    [ArmorSlot.ArmorSlotClass]: {fixed: false, value: 5},
    [ArmorSlot.ArmorSlotNone]: {fixed: false, value: 5}
  }

  allowBlueArmorPieces = true;
  assumeLegendariesMasterworked = true;
  assumeExoticsMasterworked = true;
  assumeClassItemMasterworked = true;
  onlyUseMasterworkedItems = false;
  limitParsedResults = true;  // Limits the amount of results that are parsed. This looses some results, but solves memory issues
  tryLimitWastedStats = false;
  onlyShowResultsWithNoWastedStats = false;
  showWastedStatsColumn = false;

  enabledMods: ModOrAbility[] = [];
  selectedExotics: number[] = []

  armorAffinities: EnumDictionary<ArmorSlot, FixableSelection<DestinyEnergyType>> = {
    [ArmorSlot.ArmorSlotHelmet]: {fixed: true, value: DestinyEnergyType.Any},
    [ArmorSlot.ArmorSlotGauntlet]: {fixed: true, value: DestinyEnergyType.Any},
    [ArmorSlot.ArmorSlotChest]: {fixed: true, value: DestinyEnergyType.Any},
    [ArmorSlot.ArmorSlotLegs]: {fixed: true, value: DestinyEnergyType.Any},
    [ArmorSlot.ArmorSlotClass]: {fixed: true, value: DestinyEnergyType.Any},
    [ArmorSlot.ArmorSlotNone]: {fixed: true, value: DestinyEnergyType.Any},
  };

  armorPerks: EnumDictionary<ArmorSlot, FixableSelection<ArmorPerkOrSlot>> = {
    [ArmorSlot.ArmorSlotHelmet]: {fixed: true, value: ArmorPerkOrSlot.None},
    [ArmorSlot.ArmorSlotGauntlet]: {fixed: true, value: ArmorPerkOrSlot.None},
    [ArmorSlot.ArmorSlotChest]: {fixed: true, value: ArmorPerkOrSlot.None},
    [ArmorSlot.ArmorSlotLegs]: {fixed: true, value: ArmorPerkOrSlot.None},
    [ArmorSlot.ArmorSlotClass]: {fixed: true, value: ArmorPerkOrSlot.None},
    [ArmorSlot.ArmorSlotNone]: {fixed: true, value: ArmorPerkOrSlot.None},
  };

  // Ignore armor element affinities.
  // Note, the tool already ignores affinities of non-masterworked armor.
  ignoreArmorAffinitiesOnMasterworkedItems: boolean = false;
  ignoreArmorAffinitiesOnNonMasterworkedItems: boolean = false;


  static buildEmptyConfiguration(): Configuration {
    return {
      enabledMods: [],
      disabledItems: [],
      ignoreArmorAffinitiesOnMasterworkedItems: false,
      maximumStatMods: MAXIMUM_STAT_MOD_AMOUNT,
      onlyUseMasterworkedItems: false,
      allowBlueArmorPieces: true,
      assumeLegendariesMasterworked: true,
      assumeExoticsMasterworked: true,
      assumeClassItemMasterworked: true,
      limitParsedResults: true,
      tryLimitWastedStats: true,
      onlyShowResultsWithNoWastedStats: false,
      showWastedStatsColumn: false,
      characterClass: CharacterClass.Titan,
      selectedExotics: [],
      maximumModSlots: {
        [ArmorSlot.ArmorSlotHelmet]: {fixed: false, value: 5},
        [ArmorSlot.ArmorSlotGauntlet]: {fixed: false, value: 5},
        [ArmorSlot.ArmorSlotChest]: {fixed: false, value: 5},
        [ArmorSlot.ArmorSlotLegs]: {fixed: false, value: 5},
        [ArmorSlot.ArmorSlotClass]: {fixed: false, value: 5},
        [ArmorSlot.ArmorSlotNone]: {fixed: false, value: 5}
      },
      armorAffinities: {
        [ArmorSlot.ArmorSlotHelmet]: {fixed: true, value: DestinyEnergyType.Any},
        [ArmorSlot.ArmorSlotGauntlet]: {fixed: true, value: DestinyEnergyType.Any},
        [ArmorSlot.ArmorSlotChest]: {fixed: true, value: DestinyEnergyType.Any},
        [ArmorSlot.ArmorSlotLegs]: {fixed: true, value: DestinyEnergyType.Any},
        [ArmorSlot.ArmorSlotClass]: {fixed: true, value: DestinyEnergyType.Any},
        [ArmorSlot.ArmorSlotNone]: {fixed: true, value: DestinyEnergyType.Any},
      },
      ignoreArmorAffinitiesOnNonMasterworkedItems: false,
      armorPerks: {
        [ArmorSlot.ArmorSlotHelmet]: {fixed: true, value: ArmorPerkOrSlot.None},
        [ArmorSlot.ArmorSlotGauntlet]: {fixed: true, value: ArmorPerkOrSlot.None},
        [ArmorSlot.ArmorSlotChest]: {fixed: true, value: ArmorPerkOrSlot.None},
        [ArmorSlot.ArmorSlotLegs]: {fixed: true, value: ArmorPerkOrSlot.None},
        [ArmorSlot.ArmorSlotClass]: {fixed: true, value: ArmorPerkOrSlot.None},
        [ArmorSlot.ArmorSlotNone]: {fixed: true, value: ArmorPerkOrSlot.None},
      },
      minimumStatTiers: getDefaultStatDict(0)
    }
  }
}
