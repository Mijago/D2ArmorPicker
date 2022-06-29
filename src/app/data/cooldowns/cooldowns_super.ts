import {EnumDictionary} from "../types/EnumDictionary";
import {CharacterClass} from "../enum/character-Class";

export const SuperAbilitiesPerClassAndTier: EnumDictionary<CharacterClass, string[]> = {
  [CharacterClass.Titan]: [
    "Hammer of Sol", // 10:25
    "Glacial Quake, Sentinel Shield, Fist of Havoc", // 9:16
    "Burning Maul, Thundercrash",  // 8:20
    "", // 7:35
    "Ward of Dawn", // 6:57
  ],
  [CharacterClass.Hunter]: [
    "Spectral Blades",// 10:25
    "Arc Staff, Golden Gun", // 9:16
    "Morbius Quiver", // 8:20
    "Deadfall, Blade Barrage, Silence & Squall", // 7:35
    "", // 6:57
  ],
  [CharacterClass.Warlock]: [
    "Daybreak", // 10:25
    "Stormtrance, Chaos Reach, Nova Warp, Shadebinder", // 9:16
    "Nova Bomb",  // 8:20
    "", // 7:35
    "Well of Radiance", // 6:57
  ],
  [CharacterClass.None]: ["", "", "", "", "", "", "", "", "", "", ""]
}
