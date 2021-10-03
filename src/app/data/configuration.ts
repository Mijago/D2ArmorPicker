import {ArmorStat} from "./enum/armor-stat";
import {ModOrAbility} from "./enum/modOrAbility";
import {EnumDictionary} from "./types/EnumDictionary";
import {CharacterClass} from "./enum/character-Class";
import {MAXIMUM_STAT_MOD_AMOUNT} from "./constants";
import {DestinyEnergyType} from "bungie-api-ts/destiny2";
import {ArmorSlot} from "./permutation";

export function getDefaultStatDict<T>(value: T): EnumDictionary<ArmorStat, T> {
  return {
    [ArmorStat.Mobility]: value,
    [ArmorStat.Resilience]: value,
    [ArmorStat.Recovery]: value,
    [ArmorStat.Discipline]: value,
    [ArmorStat.Intellect]: value,
    [ArmorStat.Strength]: value
  }
}

export class Configuration {
  characterClass: CharacterClass = CharacterClass.Titan;

  // contains a list of item instances IDs that shall not be used in builds
  disabledItems: string[] = [];

  minimumStatTier: EnumDictionary<ArmorStat, number> = {
    [ArmorStat.Mobility]: 1,
    [ArmorStat.Resilience]: 1,
    [ArmorStat.Recovery]: 1,
    [ArmorStat.Discipline]: 1,
    [ArmorStat.Intellect]: 1,
    [ArmorStat.Strength]: 1
  }
  maximumStatMods: number = 5;

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

  // Armor affinity for each slot
  fixedArmorAffinities: EnumDictionary<ArmorSlot, DestinyEnergyType> = {
    [ArmorSlot.ArmorSlotHelmet]: DestinyEnergyType.Any,
    [ArmorSlot.ArmorSlotGauntlet]: DestinyEnergyType.Any,
    [ArmorSlot.ArmorSlotChest]: DestinyEnergyType.Any,
    [ArmorSlot.ArmorSlotLegs]: DestinyEnergyType.Any,
    [ArmorSlot.ArmorSlotClass]: DestinyEnergyType.Any,
  };
  // Ignore armor element affinities.
  // Note, the tool already ignores affinities of non-masterworked armor.
  ignoreArmorAffinitiesOnMasterworkedItems: boolean = false;


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
      tryLimitWastedStats: false,
      onlyShowResultsWithNoWastedStats: false,
      showWastedStatsColumn: false,
      characterClass: CharacterClass.Titan,
      selectedExoticHash: 0,
      fixedArmorAffinities: {
        [ArmorSlot.ArmorSlotHelmet]: DestinyEnergyType.Any,
        [ArmorSlot.ArmorSlotGauntlet]: DestinyEnergyType.Any,
        [ArmorSlot.ArmorSlotChest]: DestinyEnergyType.Any,
        [ArmorSlot.ArmorSlotLegs]: DestinyEnergyType.Any,
        [ArmorSlot.ArmorSlotClass]: DestinyEnergyType.Any,
      },
      minimumStatTier: {
        [ArmorStat.Mobility]: 1,
        [ArmorStat.Resilience]: 1,
        [ArmorStat.Recovery]: 1,
        [ArmorStat.Discipline]: 1,
        [ArmorStat.Intellect]: 1,
        [ArmorStat.Strength]: 1
      }
    }
  }
}
