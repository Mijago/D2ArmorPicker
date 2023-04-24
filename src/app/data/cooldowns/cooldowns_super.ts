import {EnumDictionary} from "../types/EnumDictionary";
import {CharacterClass} from "../enum/character-Class";

export const SuperAbilitiesPerClassAndTier: EnumDictionary<CharacterClass, string[]> = {
  [CharacterClass.Titan]: [
    "Hammer of Sol, Glacial Quake, Sentinel Shield, Fists of Havoc, Blade Fury", // 9:16
    "Burning Maul, Thundercrash",  // 8:20
    "", // 7:35
    "Ward of Dawn", // 6:57
  ],
  [CharacterClass.Hunter]: [
    "Spectral Blades, Golden Gun, Arc Staff, Silk Strike", // 9:16
    "Moebius Quiver, Gathering Storm", // 8:20
    "Deadfall, Blade Barrage, Silence & Squall", // 7:35
    "", // 6:57
  ],
  [CharacterClass.Warlock]: [
    "Daybreak, Stormtrance, Chaos Reach, Nova Warp, Shadebinder", // 9:16
    "Nova Bomb, Needle Storm",  // 8:20
    "", // 7:35
    "Well of Radiance", // 6:57
  ],
  [CharacterClass.None]: ["", "", "", "", "", "", "", "", "", "", ""]
}
