import {EnumDictionary} from "./types/EnumDictionary";
import {CharacterClass} from "./enum/character-Class";
import {calculateTierValueAbility, calculateTierValueSuper} from "./cooldown_definitions";

export const SuperAbilitiesPerClassAndTier: EnumDictionary<CharacterClass, string[]> = {
  [CharacterClass.Titan]: [
    "", // 417
    "", // 455
    "Burning Maul, Thundercrash", // 500
    "Sentinel Shield ", // 556
    "Behemoth, Hammer of Sol, Fist of Havoc", // 625
  ],
  [CharacterClass.Hunter]: [
    "", // 417
    "Blade Barrage, Shadowshot", // 455
    "Arc Staff", // 500
    "Silence & Squall, Golden Gun", // 556  9:16
    "Spectral Blades", // 625
  ],
  [CharacterClass.Warlock]: [
    "Well of Radiance", // 417
    "", // 455
    "Nova Bomb", // 500
    "Daybreak, Nova Warp, Stormtrance, Chaos Reach", // 556
    "Shadebinder", // 625
  ],
  [CharacterClass.None]: ["", "", "", "", "", "", "", "", "", "", ""]
}


export function buildSuperCooldown(tier: number, clazz: CharacterClass) {
  const clazzEntry = SuperAbilitiesPerClassAndTier[clazz];
  var res = "Super Cooldown in seconds\r\n";
  if (clazzEntry[0] != "") res += "Tier 5:\t" + calculateTierValueSuper(tier, 417) + "\t" + clazzEntry[0] + "\r\n";
  if (clazzEntry[1] != "") res += "Tier 4:\t" + calculateTierValueSuper(tier, 455) + "\t" + clazzEntry[1] + "\r\n";
  if (clazzEntry[2] != "") res += "Tier 3:\t" + calculateTierValueSuper(tier, 500) + "\t" + clazzEntry[2] + "\r\n";
  if (clazzEntry[3] != "") res += "Tier 2:\t" + calculateTierValueSuper(tier, 556) + "\t" + clazzEntry[3] + "\r\n";
  if (clazzEntry[4] != "") res += "Tier 1:\t" + calculateTierValueSuper(tier, 625) + "\t" + clazzEntry[4] + "\r\n";
  return res;
}
