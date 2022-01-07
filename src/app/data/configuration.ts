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
    [ArmorStat.Mobility]: {fixed: false, value: 1},
    [ArmorStat.Resilience]: {fixed: false, value: 1},
    [ArmorStat.Recovery]: {fixed: false, value: 1},
    [ArmorStat.Discipline]: {fixed: false, value: 1},
    [ArmorStat.Intellect]: {fixed: false, value: 1},
    [ArmorStat.Strength]: {fixed: false, value: 1}
  }
  maximumStatMods: number = 5; // TODO: remove

  // Fixable, BUT the bool is not yet used. Maybe in a future update.
  maximumModSlots: EnumDictionary<ArmorSlot, FixableSelection<number>> = {
    [ArmorSlot.ArmorSlotHelmet]: {fixed: false, value: 5},
    [ArmorSlot.ArmorSlotGauntlet]: {fixed: false, value: 5},
    [ArmorSlot.ArmorSlotChest]: {fixed: false, value: 5},
    [ArmorSlot.ArmorSlotLegs]: {fixed: false, value: 5},
    [ArmorSlot.ArmorSlotClass]: {fixed: false, value: 5}
  }


  assumeLegendariesMasterworked = true;
  assumeExoticsMasterworked = true;
  assumeClassItemMasterworked = true;
  onlyUseMasterworkedItems = false;
  limitParsedResults = true;  // Limits the amount of results that are parsed. This looses some results, but solves memory issues
  tryLimitWastedStats = false;
  onlyShowResultsWithNoWastedStats = false;
  showWastedStatsColumn = false;

  enabledMods: ModOrAbility[] = [];
  selectedExoticHash: number = 0;

  // Armor affinity for each slot // TODO: remove
  fixedArmorAffinities: EnumDictionary<ArmorSlot, DestinyEnergyType> = {
    [ArmorSlot.ArmorSlotHelmet]: DestinyEnergyType.Any,
    [ArmorSlot.ArmorSlotGauntlet]: DestinyEnergyType.Any,
    [ArmorSlot.ArmorSlotChest]: DestinyEnergyType.Any,
    [ArmorSlot.ArmorSlotLegs]: DestinyEnergyType.Any,
    [ArmorSlot.ArmorSlotClass]: DestinyEnergyType.Any,
  };

  armorAffinities: EnumDictionary<ArmorSlot, FixableSelection<DestinyEnergyType>> = {
    [ArmorSlot.ArmorSlotHelmet]: {fixed: false, value: DestinyEnergyType.Any},
    [ArmorSlot.ArmorSlotGauntlet]: {fixed: false, value: DestinyEnergyType.Any},
    [ArmorSlot.ArmorSlotChest]: {fixed: false, value: DestinyEnergyType.Any},
    [ArmorSlot.ArmorSlotLegs]: {fixed: false, value: DestinyEnergyType.Any},
    [ArmorSlot.ArmorSlotClass]: {fixed: false, value: DestinyEnergyType.Any},
  };

  armorPerks: EnumDictionary<ArmorSlot, FixableSelection<ArmorPerkOrSlot>> = {
    [ArmorSlot.ArmorSlotHelmet]: {fixed: false, value: ArmorPerkOrSlot.None},
    [ArmorSlot.ArmorSlotGauntlet]: {fixed: false, value: ArmorPerkOrSlot.None},
    [ArmorSlot.ArmorSlotChest]: {fixed: false, value: ArmorPerkOrSlot.None},
    [ArmorSlot.ArmorSlotLegs]: {fixed: false, value: ArmorPerkOrSlot.None},
    [ArmorSlot.ArmorSlotClass]: {fixed: false, value: ArmorPerkOrSlot.None},
  };

  // Ignore armor element affinities.
  // Note, the tool already ignores affinities of non-masterworked armor.
  ignoreArmorAffinitiesOnMasterworkedItems: boolean = false;
  ignoreArmorAffinitiesOnNonMasterworkedItems: boolean = true;


  static buildEmptyConfiguration(): Configuration {
    return {
      enabledMods: [],
      disabledItems: [],
      ignoreArmorAffinitiesOnMasterworkedItems: false,
      maximumStatMods: MAXIMUM_STAT_MOD_AMOUNT,
      onlyUseMasterworkedItems: false,
      assumeLegendariesMasterworked: true,
      assumeExoticsMasterworked: true,
      assumeClassItemMasterworked: true,
      limitParsedResults: true,
      tryLimitWastedStats: true,
      onlyShowResultsWithNoWastedStats: false,
      showWastedStatsColumn: false,
      characterClass: CharacterClass.Titan,
      selectedExoticHash: 0,
      maximumModSlots: {
        [ArmorSlot.ArmorSlotHelmet]: {fixed: false, value: 5},
        [ArmorSlot.ArmorSlotGauntlet]: {fixed: false, value: 5},
        [ArmorSlot.ArmorSlotChest]: {fixed: false, value: 5},
        [ArmorSlot.ArmorSlotLegs]: {fixed: false, value: 5},
        [ArmorSlot.ArmorSlotClass]: {fixed: false, value: 5}
      },
      fixedArmorAffinities: { // TODO: remove
        [ArmorSlot.ArmorSlotHelmet]: DestinyEnergyType.Any,
        [ArmorSlot.ArmorSlotGauntlet]: DestinyEnergyType.Any,
        [ArmorSlot.ArmorSlotChest]: DestinyEnergyType.Any,
        [ArmorSlot.ArmorSlotLegs]: DestinyEnergyType.Any,
        [ArmorSlot.ArmorSlotClass]: DestinyEnergyType.Any,
      },
      armorAffinities: {
        [ArmorSlot.ArmorSlotHelmet]: {fixed: false, value: DestinyEnergyType.Any},
        [ArmorSlot.ArmorSlotGauntlet]: {fixed: false, value: DestinyEnergyType.Any},
        [ArmorSlot.ArmorSlotChest]: {fixed: false, value: DestinyEnergyType.Any},
        [ArmorSlot.ArmorSlotLegs]: {fixed: false, value: DestinyEnergyType.Any},
        [ArmorSlot.ArmorSlotClass]: {fixed: false, value: DestinyEnergyType.Any},
      },
      ignoreArmorAffinitiesOnNonMasterworkedItems: true,
      armorPerks: {
        [ArmorSlot.ArmorSlotHelmet]: {fixed: false, value: ArmorPerkOrSlot.None},
        [ArmorSlot.ArmorSlotGauntlet]: {fixed: false, value: ArmorPerkOrSlot.None},
        [ArmorSlot.ArmorSlotChest]: {fixed: false, value: ArmorPerkOrSlot.None},
        [ArmorSlot.ArmorSlotLegs]: {fixed: false, value: ArmorPerkOrSlot.None},
        [ArmorSlot.ArmorSlotClass]: {fixed: false, value: ArmorPerkOrSlot.None},
      },
      minimumStatTiers: getDefaultStatDict(1)
    }
  }
}
