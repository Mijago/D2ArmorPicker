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
    "https://www.bungie.net/common/destiny2_content/icons/a5d9a778feddb2a9036588490a4818b0.png",
  [StatModifier.MAJOR_WEAPON]:
    "https://www.bungie.net/common/destiny2_content/icons/db4b34c79c834d3cf36b592c688ed22d.png",
  [StatModifier.ARTIFICE_WEAPON]:
    "https://www.bungie.net/common/destiny2_content/icons/a5d9a778feddb2a9036588490a4818b0.png",
  [StatModifier.MINOR_HEALTH]:
    "https://www.bungie.net/common/destiny2_content/icons/1b4eec255df03ae088db1eb251654316.png",
  [StatModifier.MAJOR_HEALTH]:
    "https://www.bungie.net/common/destiny2_content/icons/db6c438e9ff1a21b03a1f0488560e6a3.png",
  [StatModifier.ARTIFICE_HEALTH]:
    "https://www.bungie.net/common/destiny2_content/icons/1b4eec255df03ae088db1eb251654316.png",
  [StatModifier.MINOR_CLASS]:
    "https://www.bungie.net/common/destiny2_content/icons/51d46295defdf93d77a62e3e895df5cd.png",
  [StatModifier.MAJOR_CLASS]:
    "https://www.bungie.net/common/destiny2_content/icons/f42cc43389f147d25f0ee2946f1ff1bd.png",
  [StatModifier.ARTIFICE_CLASS]:
    "https://www.bungie.net/common/destiny2_content/icons/51d46295defdf93d77a62e3e895df5cd.png",
  [StatModifier.MINOR_GRENADE]:
    "https://www.bungie.net/common/destiny2_content/icons/9ba335d570610d1ae9cffa071d5bcb8e.png",
  [StatModifier.MAJOR_GRENADE]:
    "https://www.bungie.net/common/destiny2_content/icons/e54f6af6a4577e4d66396e5285bb73c0.png",
  [StatModifier.ARTIFICE_GRENADE]:
    "https://www.bungie.net/common/destiny2_content/icons/9ba335d570610d1ae9cffa071d5bcb8e.png",
  [StatModifier.MINOR_SUPER]:
    "https://www.bungie.net/common/destiny2_content/icons/a8808e7528b16474f8c9c65b4e53b52b.png",
  [StatModifier.MAJOR_SUPER]:
    "https://www.bungie.net/common/destiny2_content/icons/2399dff2dc6952ea65c2b8c594d00658.png",
  [StatModifier.ARTIFICE_SUPER]:
    "https://www.bungie.net/common/destiny2_content/icons/a8808e7528b16474f8c9c65b4e53b52b.png",
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
