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

import { Component, Input } from "@angular/core";
import {
  ArmorPerkOrSlot,
  ArmorPerkOrSlotIcons,
  ArmorStat,
  ArmorStatNames,
  StatModifier,
} from "src/app/data/enum/armor-stat";

export const ModUrl: { [k: number]: string } = {
  [StatModifier.MINOR_WEAPON]:
    "https://www.bungie.net/common/destiny2_content/icons/e82d4e305e0023d2db21339f10bba477.png",
  [StatModifier.MAJOR_WEAPON]:
    "https://www.bungie.net/common/destiny2_content/icons/4f970366cc18cab100e849926a927b6f.png",
  [StatModifier.ARTIFICE_WEAPON]:
    "https://www.bungie.net/common/destiny2_content/icons/e82d4e305e0023d2db21339f10bba477.png",
  [StatModifier.MINOR_HEALTH]:
    "https://www.bungie.net/common/destiny2_content/icons/85f956602980f8fd2480a9908029256c.png",
  [StatModifier.MAJOR_HEALTH]:
    "https://www.bungie.net/common/destiny2_content/icons/c1328c7351bc775eb277454c393ac858.png",
  [StatModifier.ARTIFICE_HEALTH]:
    "https://www.bungie.net/common/destiny2_content/icons/85f956602980f8fd2480a9908029256c.png",
  [StatModifier.MINOR_CLASS]:
    "https://www.bungie.net/common/destiny2_content/icons/234a96c207a03c8f3bf213e7447f78d4.png",
  [StatModifier.MAJOR_CLASS]:
    "https://www.bungie.net/common/destiny2_content/icons/033f50a1d44a2cef3727b8aa98d9cd83.png",
  [StatModifier.ARTIFICE_CLASS]:
    "https://www.bungie.net/common/destiny2_content/icons/234a96c207a03c8f3bf213e7447f78d4.png",
  [StatModifier.MINOR_GRENADE]:
    "https://www.bungie.net/common/destiny2_content/icons/e8b5cabcee36d609239a508097ac5773.png",
  [StatModifier.MAJOR_GRENADE]:
    "https://www.bungie.net/common/destiny2_content/icons/774854aa449ce8053f708b88d10d35c5.png",
  [StatModifier.ARTIFICE_GRENADE]:
    "https://www.bungie.net/common/destiny2_content/icons/e8b5cabcee36d609239a508097ac5773.png",
  [StatModifier.MINOR_SUPER]:
    "https://www.bungie.net/common/destiny2_content/icons/77a99f4c2306652ec53324600f2d7f62.png",
  [StatModifier.MAJOR_SUPER]:
    "https://www.bungie.net/common/destiny2_content/icons/acccc4fe0cd51007278f1559065e0b12.png",
  [StatModifier.ARTIFICE_SUPER]:
    "https://www.bungie.net/common/destiny2_content/icons/77a99f4c2306652ec53324600f2d7f62.png",
  [StatModifier.MINOR_MELEE]:
    "https://www.bungie.net/common/destiny2_content/icons/6b45221fccade87ee39f3a03efc6e9b9.png",
  [StatModifier.MAJOR_MELEE]:
    "https://www.bungie.net/common/destiny2_content/icons/66714f030b79a1517c657f1378216cca.png",
  [StatModifier.ARTIFICE_MELEE]:
    "https://www.bungie.net/common/destiny2_content/icons/6b45221fccade87ee39f3a03efc6e9b9.png",
};

@Component({
  selector: "app-table-mod-display",
  templateUrl: "./table-mod-display.component.html",
  styleUrls: ["./table-mod-display.component.css"],
})
export class TableModDisplayComponent {
  artificeUrl = ArmorPerkOrSlotIcons[ArmorPerkOrSlot.SlotArtifice];
  modIndex = [0, 1, 2, 3, 4, 5];
  modTypeIndex = [1, 2];
  ModUrl = ModUrl;
  @Input()
  mods: number[] = [];

  @Input()
  artifice: number[] = [];

  constructor() {}

  getStatName(stat: number) {
    return ArmorStatNames[stat as ArmorStat];
  }
}
