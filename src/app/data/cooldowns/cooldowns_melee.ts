import { EnumDictionary } from "../types/EnumDictionary";
import { CharacterClass } from "../enum/character-Class";

export const MeleeAbilitiesPerClassAndTier: EnumDictionary<CharacterClass, string[]> = {
  [CharacterClass.Titan]: [
    "Shiver Strike", // 1:53
    "", // 1:49
    "Frontal Assault", // 1:46
    "Shield Throw", // 1:40
    "Throwing Hammer, Hammer Strike, Shield Bash, Seismic Strike, Ballistic Slam, Thunderclap", // 1:30
    "", // 1:22
    "", // 0:15
  ],
  [CharacterClass.Hunter]: [
    "Withering Blade", // 1:53
    "Weighted Throwing Knife", // 1:49
    "", // 1:46
    "Proximity Expl. Knife, Tempest Strike, Disorienting Blow", // 1:40
    "Lightweight Knife, Snare Bomb", // 1:30
    "Knife Trick", // 1:22
    "Combination Blow", // 0:15
  ],
  [CharacterClass.Warlock]: [
    "Penumbral Blast, Ball Lightning", // 1:53
    "", // 1:49
    "", // 1:46
    "Celestial Fire", // 1:40
    "Incinerator Snap, Pocket Singularity, Chain Lightning, Rising Storm", // 1:30
    "", // 1:22
    "", // 0:15
  ],
  [CharacterClass.None]: ["", "", "", "", "", "", "", "", "", "", ""],
};
