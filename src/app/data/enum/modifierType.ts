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

export enum ModifierType {
  CombatStyleMod,
  Stasis,
  Void,
  Solar,
  Arc,
  Strand,
  Prismatic,
}

export type Subclass = Exclude<ModifierType, ModifierType.CombatStyleMod>;

export const SubclassNames: EnumDictionary<Subclass, string> = {
  [ModifierType.Arc]: "Arc",
  [ModifierType.Solar]: "Solar",
  [ModifierType.Void]: "Void",
  [ModifierType.Stasis]: "Stasis",
  [ModifierType.Strand]: "Strand",
  [ModifierType.Prismatic]: "Prismatic",
};
