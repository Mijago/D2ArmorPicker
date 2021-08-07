import {ArmorStat} from "./enum/armor-stat";
import {ModOrAbility} from "./enum/modOrAbility";
import {EnumDictionary} from "./types/EnumDictionary";
import {CharacterClass} from "./enum/character-Class";
import {MAXIMUM_STAT_MOD_AMOUNT} from "./constants";

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

  minimumStatTier: EnumDictionary<ArmorStat, number> = {
    [ArmorStat.Mobility]: 1,
    [ArmorStat.Resilience]: 1,
    [ArmorStat.Recovery]: 1,
    [ArmorStat.Discipline]: 1,
    [ArmorStat.Intellect]: 1,
    [ArmorStat.Strength]: 1
  }
  maximumStatMods: number = 5;

  assumeMasterworked = true;
  onlyUseMasterworkedItems = false;

  enabledMods: ModOrAbility[] = [];
  selectedExoticHash: number = 0;

  static buildEmptyConfiguration(): Configuration {
    return {
      enabledMods: [ModOrAbility.PowerfulFriends, ModOrAbility.RadiantLight],
      maximumStatMods: MAXIMUM_STAT_MOD_AMOUNT,
      onlyUseMasterworkedItems: false,
      assumeMasterworked: true,
      characterClass: CharacterClass.Titan,
      selectedExoticHash: 0,
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
