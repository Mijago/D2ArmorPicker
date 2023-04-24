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
    "Shield Throw", // 1:31
    "Throwing Hammer, Ballistic Slam, Thunderclap", // 1:30
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
    "Lightweight Knife, Withering Blade, Tempest Strike, Disorienting Blow", // 1:40
    "", // 1:31
    "Snare Bomb", // 1:30
    "", // 1:23
    "Knife Trick", // 1:22
    "Combination Blow", // 0:40
  ],
  [CharacterClass.Warlock]: [
    "", // 2:17
    "", // 2:05
    "", // 1:54
    "", // 1:53
    "Celestial Fire", // 1:52
    "", // 1:51
    "Penumbral Blast", // 1:41
    "Ball Lightning", // 1:40
    "Arcane Needle", // 1:31
    "Pocket Singularity, Chain Lightning, Rising Storm", // 1:30
    "Incinerator Snap", // 1:23
    "", // 1:22
    "", // 0:40
  ],
  [CharacterClass.None]: ["", "", "", "", "", "", "", "", "", "", ""]
}
