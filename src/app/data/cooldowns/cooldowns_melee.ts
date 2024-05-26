/*
 * Copyright (c) 2023 D2ArmorPicker by Mijago.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import { DestinyClass } from "bungie-api-ts/destiny2";
import { EnumDictionary } from "../types/EnumDictionary";

export const MeleeAbilitiesPerClassAndTier: EnumDictionary<DestinyClass, string[]> = {
  [DestinyClass.Titan]: [
    "Shiver Strike", // 1:53
    "", // 1:49
    "Frontal Assault", // 1:46
    "Shield Throw", // 1:40
    "Throwing Hammer, Hammer Strike, Shield Bash, Seismic Strike, Ballistic Slam, Thunderclap", // 1:30
    "", // 1:22
    "", // 0:15
  ],
  [DestinyClass.Hunter]: [
    "Withering Blade", // 1:53
    "Weighted Throwing Knife", // 1:49
    "", // 1:46
    "Proximity Expl. Knife, Tempest Strike, Disorienting Blow", // 1:40
    "Lightweight Knife, Snare Bomb", // 1:30
    "Knife Trick", // 1:22
    "Combination Blow", // 0:15
  ],
  [DestinyClass.Warlock]: [
    "Penumbral Blast, Ball Lightning", // 1:53
    "", // 1:49
    "", // 1:46
    "Celestial Fire", // 1:40
    "Incinerator Snap, Pocket Singularity, Chain Lightning, Rising Storm", // 1:30
    "", // 1:22
    "", // 0:15
  ],
  [DestinyClass.Unknown]: ["", "", "", "", "", "", "", "", "", "", ""],
};
