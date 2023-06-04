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

import { EnumDictionary } from "../types/EnumDictionary";
import { CharacterClass } from "../enum/character-Class";

export const GrenadeAbilitiesPerClassAndTier: EnumDictionary<CharacterClass, string[]> = {
  [CharacterClass.Titan]: [
    "Flux", // 182
    "Glacier, Axion Bolt", // 152 / 2:32
    "Coldsnap, Vortex, Scatter, Magnetic, Suppressor, Incendiary, Solar, Lightning, Pulse, Skip", // 121 / 2:01
    "Void Wall, Thermite, Arc Bolt, Storm", // 105 / 1:45
    "Void Spike, Tripmine, Swarm, Flashbang", // 91 / 1:31
    "Healing", // 82 / 1:22
    "Fusion", // 73 / 1:13
    "Duskfield, Firebolt", // 64 / 1:04
  ],
  [CharacterClass.Hunter]: [
    "Flux", // 182 / 3:02
    "Glacier, Axion Bolt", // 152 / 2:32
    "Coldsnap, Vortex, Scatter, Magnetic, Suppressor, Incendiary, Solar, Lightning, Pulse, Skip", // 121 / 2:01
    "Void Wall, Thermite, Arc Bolt, Storm", // 105 / 1:45
    "Void Spike, Tripmine, Swarm, Flashbang", // 91 / 1:31
    "Healing", // 82 / 1:22
    "Fusion", // 73 / 1:13
    "Duskfield, Firebolt", // 64 / 1:04
  ],
  [CharacterClass.Warlock]: [
    "Flux", // 182
    "Glacier, Axion Bolt", // 152 / 2:32
    "Coldsnap, Vortex, Scatter, Magnetic, Suppressor, Incendiary, Solar, Lightning, Pulse, Skip", // 121 / 2:01
    "Void Wall, Thermite, Arc Bolt, Storm", // 105 / 1:45
    "Void Spike, Tripmine, Swarm, Flashbang", // 91 / 1:31
    "Healing", // 82 / 1:22
    "Fusion", // 73 / 1:13
    "Duskfield, Firebolt", // 64 / 1:04
  ],
  [CharacterClass.None]: ["", "", "", "", "", "", "", "", "", ""],
};
