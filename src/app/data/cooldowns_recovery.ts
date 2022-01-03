import {CharacterClass} from "./enum/character-Class";
import {calculateTierValueClassAbility} from "./cooldown_definitions";


export function buildRiftCooldown(tier: number, clazz: CharacterClass) {
  if (clazz != CharacterClass.Warlock)
    return "";

  return "Rift Cooldown: " + calculateTierValueClassAbility(tier, 82);
}
