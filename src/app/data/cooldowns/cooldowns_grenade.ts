import {EnumDictionary} from "../types/EnumDictionary";
import {CharacterClass} from "../enum/character-Class";

export const GrenadeAbilitiesPerClassAndTier: EnumDictionary<CharacterClass, string[]> = {
  [CharacterClass.Titan]: [
    "Vortex, Void Wall, Solar, Glacier, Lightning, Flux, Axion Bolt, Threadling, Shackle", // 152 / 2:32
    "Coldsnap, Void Spike, Suppressor, Tripmine, Thermite, Storm, Pulse, Skip", // 121 / 2:01
    "Scatter, Incendiary, Magnetic, Arc Bolt, Grapple", // 105 / 1:45
    "Swarm, Healing, Flashbang, Duskfield", // 91 / 1:31
    "Fusion", // 73 / 1:13
    "Firebolt" // 64 / 1:04
  ],
  [CharacterClass.Hunter]: [
    "Vortex, Void Wall, Solar, Glacier, Lightning, Flux, Axion Bolt, Threadling, Shackle", // 152 / 2:32
    "Coldsnap, Void Spike, Suppressor, Tripmine, Thermite, Storm, Pulse, Skip", // 121 / 2:01
    "Scatter, Incendiary, Magnetic, Arc Bolt, Grapple", // 105 / 1:45
    "Swarm, Healing, Flashbang, Duskfield", // 91 / 1:31
    "Fusion", // 73 / 1:13
    "Firebolt" // 64 / 1:04
  ],
  [CharacterClass.Warlock]: [
    "Vortex, Void Wall, Solar, Glacier, Lightning, Flux, Axion Bolt, Threadling, Shackle", // 152 / 2:32
    "Coldsnap, Void Spike, Suppressor, Tripmine, Thermite, Storm, Pulse, Skip", // 121 / 2:01
    "Scatter, Incendiary, Magnetic, Arc Bolt, Grapple", // 105 / 1:45
    "Swarm, Healing, Flashbang, Duskfield", // 91 / 1:31
    "Fusion", // 73 / 1:13
    "Firebolt" // 64 / 1:04
  ],
  [CharacterClass.None]: ["", "", "", "", "", "", "", "", "", ""]
}
