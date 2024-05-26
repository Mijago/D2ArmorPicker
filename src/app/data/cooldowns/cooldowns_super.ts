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

export const SuperAbilitiesPerClassAndTier: EnumDictionary<DestinyClass, string[]> = {
  [DestinyClass.Titan]: [
    "Hammer of Sol", // 10:25
    "Glacial Quake, Sentinel Shield, Fist of Havoc", // 9:16
    "Burning Maul, Thundercrash", // 8:20
    "", // 7:35
    "Ward of Dawn", // 6:57
  ],
  [DestinyClass.Hunter]: [
    "Spectral Blades", // 10:25
    "Arc Staff, Golden Gun", // 9:16
    "Morbius Quiver", // 8:20
    "Deadfall, Blade Barrage, Silence & Squall", // 7:35
    "", // 6:57
  ],
  [DestinyClass.Warlock]: [
    "Daybreak", // 10:25
    "Stormtrance, Chaos Reach, Nova Warp, Shadebinder", // 9:16
    "Nova Bomb", // 8:20
    "", // 7:35
    "Well of Radiance", // 6:57
  ],
  [DestinyClass.Unknown]: ["", "", "", "", "", "", "", "", "", "", ""],
};
