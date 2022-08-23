import {EnumDictionary} from "../types/EnumDictionary";
import {CharacterClass} from "../enum/character-Class";

export const GrenadeAbilitiesPerClassAndTier: EnumDictionary<CharacterClass, string[]> = {
  [CharacterClass.Titan]: [
    "Flux", // 182
    "Glacier, Axion Bolt", // 152 / 2:32
    "Coldsnap, Vortex, Scatter, Magnetic, Suppressor, Incendiary, Solar, Lightning, Pulse, Skip", // 121 / 2:01
    "Void Wall, Thermite, Arc Bolt, Storm", // 105 / 1:45
    "Void Spike, Tripmine, Swarm, Flashbang", // 91 / 1:31
    "Healing", // 82 / 1:22
    "Fusion", // 73 / 1:13
    "Duskfield, Firebolt" // 64 / 1:04
  ],
  [CharacterClass.Hunter]: [
    "Flux", // 182 / 3:02
    "Glacier, Axion Bolt", // 152 / 2:32
    "Coldsnap, Vortex, Scatter, Magnetic, Suppressor, Incendiary, Solar, Lightning, Pulse, Skip", // 121 / 2:01
    "Void Wall, Thermite, Arc Bolt, Storm", // 105 / 1:45
    "Void Spike, Tripmine, Swarm, Flashbang", // 91 / 1:31
    "Healing", // 82 / 1:22
    "Fusion", // 73 / 1:13
    "Duskfield, Firebolt" // 64 / 1:04
  ],
  [CharacterClass.Warlock]: [
    "Flux", // 182
    "Glacier, Axion Bolt", // 152 / 2:32
    "Coldsnap, Vortex, Scatter, Magnetic, Suppressor, Incendiary, Solar, Lightning, Pulse, Skip", // 121 / 2:01
    "Void Wall, Thermite, Arc Bolt, Storm", // 105 / 1:45
    "Void Spike, Tripmine, Swarm, Flashbang", // 91 / 1:31
    "Healing", // 82 / 1:22
    "Fusion", // 73 / 1:13
    "Duskfield, Firebolt" // 64 / 1:04
  ],
  [CharacterClass.None]: ["", "", "", "", "", "", "", "", "", ""]
}
