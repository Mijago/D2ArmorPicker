import {CharacterClass} from "./enum/character-Class";
import {calculateTierValueMobility} from "./cooldown_definitions";

var marksmanDodge = [
  34, 32, 30, 29, 26, 24, 22, 19, 16, 14, 11
]

function calculateDodgeCooldown(tier: number, base: number) {

}

export function buildMobilityCooldown(tier: number, clazz: CharacterClass) {
  var res = "Speed increase:\t" + 4 * tier + "%\r\n";
  res += "Crouching:\t" + calculateTierValueMobility(tier, 2.75) + "m/s\r\n";
  res += "Strafing:\t\t" + calculateTierValueMobility(tier, 4.25) + "m/s\r\n";
  res += "Walking:\t\t" + calculateTierValueMobility(tier, 5) + "m/s\r\n";

  if (clazz == CharacterClass.Hunter) {
    res += "\r\n"
    res += "Dodge cooldown (from UI): " + marksmanDodge[tier] + "s"

  }
  return res;
}
