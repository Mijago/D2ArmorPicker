import {EnumDictionary} from "../types/EnumDictionary";
import {CharacterClass} from "../enum/character-Class";

export const MeleeAbilitiesPerClassAndTier: EnumDictionary<CharacterClass, string[]> = {
  [CharacterClass.Titan]: [
    "", // 2:17
    "", // 2:05
    "Ballistic Slam, Shield Bash, Frenzied Blade", // 1:54
    "Shiver Strike", // 1:53
    "", // 1:52
    "", // 1:51
    "Hammer Strike, Seismic Strike", // 1:41
    "", // 1:40
    "Shield Throw, Throwing Hammer, Thunderclap", // 1:31
    "", // 1:23
    "", // 1:22
    "", // 0:40
  ],
  [CharacterClass.Hunter]: [
    "Weighted Throwing Knife", // 2:17
    "Threaded Spike", // 2:05
    "", // 1:54
    "", // 1:53
    "", // 1:52
    "Proximity Expl. Knife", // 1:51
    "", // 1:41
    "Lightweight Knife, Withering Blade, Disorienting Blow", // 1:40
    "Snare Bomb, Tempest Strike", // 1:31
    "", // 1:23
    "Knife Trick", // 1:22
    "Combination Blow", // 0:40
  ],
  [CharacterClass.Warlock]: [
    "", // 2:17
    "", // 2:05
    "Ball Lightning", // 1:54
    "", // 1:53
    "Celestial Fire", // 1:52
    "", // 1:51
    "Penumbral Blast", // 1:41
    "", // 1:40
    "Pocket Singularity, Chain Lightning, Arcane Needle", // 1:31
    "Incinerator Snap", // 1:23
    "", // 1:22
    "", // 0:40
  ],
  [CharacterClass.None]: ["", "", "", "", "", "", "", "", "", "", ""]
}
