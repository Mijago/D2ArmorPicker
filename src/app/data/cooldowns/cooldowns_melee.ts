import {EnumDictionary} from "../types/EnumDictionary";
import {CharacterClass} from "../enum/character-Class";
import {calculateTierValueAbility} from "./cooldown_definitions";

export const MeleeAbilitiesPerClassAndTier: EnumDictionary<CharacterClass, string[]> = {
  [CharacterClass.Titan]: [
    "", // 15
    "", // 75
    "Mortar Blast", // 82
    "Throwing Hammer, Hammer Strike, Seismic Strike, Ballistic Slam, Defensive Strike, Tactical Strike, Shield Bash", // 90
    "", // 100
    "Frontal Assault", // 106
    "", // 109
    "Shiver Strike" // 113
  ],
  [CharacterClass.Hunter]: [
    "Combination Blow", // 15
    "Vanish in Smoke", // 75
    "Knife Trick", // 82
    "Snare Bomb, Corrosive Smoke", // 90
    "Tempest Strike, Disorienting Blow, Expl. Knife", // 100
    "", // 106
    "Weightened Knife", // 109
    "Withering Blade" // 113
  ],
  [CharacterClass.Warlock]: [
    "", // 15
    "Devour", // 75
    "", // 82
    "Guiding Flame, Igniting Touch, Chain Lightning, Rising Storm, Entropic Pull, Atomic Breach", // 90
    "Celestial Fire", // 100
    "", // 106
    "", // 109
    "Ball Lightning, Penumbral Blast" // 113
  ],
  [CharacterClass.None]: ["", "", "", "", "", "", "", "", "", "", ""]
}


export function buildMeleeCooldown(tier: number, clazz: CharacterClass) {
  const clazzEntry = MeleeAbilitiesPerClassAndTier[clazz];
  var res = "Melee Cooldown in MM:SS\r\n";
  if (clazzEntry[0] != "") res += "Tier 8:\t" + calculateTierValueAbility(tier, 15) + "\t" + clazzEntry[0] + "\r\n";
  if (clazzEntry[1] != "") res += "Tier 7:\t" + calculateTierValueAbility(tier, 75) + "\t" + clazzEntry[1] + "\r\n";
  if (clazzEntry[2] != "") res += "Tier 6:\t" + calculateTierValueAbility(tier, 82) + "\t" + clazzEntry[2] + "\r\n";
  if (clazzEntry[3] != "") res += "Tier 5:\t" + calculateTierValueAbility(tier, 90) + "\t" + clazzEntry[3] + "\r\n";
  if (clazzEntry[4] != "") res += "Tier 4:\t" + calculateTierValueAbility(tier, 100) + "\t" + clazzEntry[4] + "\r\n";
  if (clazzEntry[5] != "") res += "Tier 3:\t" + calculateTierValueAbility(tier, 106) + "\t" + clazzEntry[5] + "\r\n";
  if (clazzEntry[6] != "") res += "Tier 2:\t" + calculateTierValueAbility(tier, 109) + "\t" + clazzEntry[6] + "\r\n";
  if (clazzEntry[7] != "") res += "Tier 1:\t" + calculateTierValueAbility(tier, 113) + "\t" + clazzEntry[7] + "\r\n";
  return res;
}
