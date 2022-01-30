import {CharacterClass} from "../enum/character-Class";
import {calculateTierValueClassAbility} from "./cooldown_definitions";


export function buildBarricadeCooldown(tier: number, clazz: CharacterClass) {
  if (clazz != CharacterClass.Titan)
    return "";

  var res = "Barricade Cooldown in MM:SS\r\n";
  res += "Towering B.:\t" + calculateTierValueClassAbility(tier, 40) + "\r\n";
  res += "Rally B.:   \t" + calculateTierValueClassAbility(tier, 32) + "\r\n";
  return res;
}
