import {EnumDictionary} from "../types/EnumDictionary";
import {CharacterClass} from "../enum/character-Class";
import {calculateTierValueAbility} from "./cooldown_definitions";

export const GrenadeAbilitiesPerClassAndTier: EnumDictionary<CharacterClass, string[]> = {
  [CharacterClass.Titan]: [
    "Duskfield", // 64
    "Fusion", // 73
    "Flashbang", // 91
    "Voidwall, Thermite, Pulse", // 105
    "Magnetic, Suppressor, Incendiary, Lightning, Coldsnap", // 121
    "Glacier", // 152
    "" // 182
  ],
  [CharacterClass.Hunter]: [
    "Duskfield", // 64
    "", // 73
    "Swarm, Tripmine", // 91
    "Vortex, Spike, Voidwall, Skip", // 105
    "Incendiary,  Arcbolt, Coldsnap", // 121
    "Glacier", // 152
    "Flux" // 182
  ],
  [CharacterClass.Warlock]: [
    "Duskfield, Firebolt", // 64
    "Fusion", // 73
    "Axion Bolt, Storm", // 91
    "Solar, Vortex, Scatter, Pulse", // 105
    "Arcbolt, Coldsnap", // 121
    "Glacier", // 152
    "" // 182
  ],
  [CharacterClass.None]: ["", "", "", "", "", "", "", "", "", ""]
}


export function buildGrenadeCooldown(tier: number, clazz: CharacterClass) {
  const clazzEntry = GrenadeAbilitiesPerClassAndTier[clazz];
  var res = "Grenade Cooldown in MM:SS\r\n";
  if (clazzEntry[0] != "") res += "Tier 7:\t" + calculateTierValueAbility(tier, 64) + "\t" + clazzEntry[0] + "\r\n";
  if (clazzEntry[1] != "") res += "Tier 6:\t" + calculateTierValueAbility(tier, 73) + "\t" + clazzEntry[1] + "\r\n";
  if (clazzEntry[2] != "") res += "Tier 5:\t" + calculateTierValueAbility(tier, 91) + "\t" + clazzEntry[2] + "\r\n";
  if (clazzEntry[3] != "") res += "Tier 4:\t" + calculateTierValueAbility(tier, 105) + "\t" + clazzEntry[3] + "\r\n";
  if (clazzEntry[4] != "") res += "Tier 3:\t" + calculateTierValueAbility(tier, 121) + "\t" + clazzEntry[4] + "\r\n";
  if (clazzEntry[5] != "") res += "Tier 2:\t" + calculateTierValueAbility(tier, 152) + "\t" + clazzEntry[5] + "\r\n";
  if (clazzEntry[6] != "") res += "Tier 1:\t" + calculateTierValueAbility(tier, 182) + "\t" + clazzEntry[6] + "\r\n";
  return res;
}
