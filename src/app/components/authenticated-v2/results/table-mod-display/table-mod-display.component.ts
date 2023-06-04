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

import { Component, Input, OnInit } from "@angular/core";
import {
  ArmorPerkOrSlot,
  ArmorPerkOrSlotIcons,
  ArmorStat,
  ArmorStatNames,
  StatModifier,
} from "src/app/data/enum/armor-stat";

const ModUrl: { [k: number]: string } = {
  [StatModifier.MINOR_MOBILITY]:
    "https://www.bungie.net/common/destiny2_content/icons/a6694a4ff65d371d19330fb10415b315.png",
  [StatModifier.MAJOR_MOBILITY]:
    "https://www.bungie.net/common/destiny2_content/icons/8861e73c6701b8347cef025d400cd3dc.png",
  [StatModifier.ARTIFICE_MOBILITY]:
    "https://www.bungie.net/common/destiny2_content/icons/a6694a4ff65d371d19330fb10415b315.png",
  [StatModifier.MINOR_RESILIENCE]:
    "https://www.bungie.net/common/destiny2_content/icons/ab1ffe5128806c3639e531f89a2d72d1.png",
  [StatModifier.MAJOR_RESILIENCE]:
    "https://www.bungie.net/common/destiny2_content/icons/b2228e67e72fad2eb37735a33e0d0116.png",
  [StatModifier.ARTIFICE_RESILIENCE]:
    "https://www.bungie.net/common/destiny2_content/icons/ab1ffe5128806c3639e531f89a2d72d1.png",
  [StatModifier.MINOR_RECOVERY]:
    "https://www.bungie.net/common/destiny2_content/icons/e0fc8c022c2ab49ef92caff5843db7da.png",
  [StatModifier.MAJOR_RECOVERY]:
    "https://www.bungie.net/common/destiny2_content/icons/4251f77e3b24900e262f16d5587980ef.png",
  [StatModifier.ARTIFICE_RECOVERY]:
    "https://www.bungie.net/common/destiny2_content/icons/e0fc8c022c2ab49ef92caff5843db7da.png",
  [StatModifier.MINOR_DISCIPLINE]:
    "https://www.bungie.net/common/destiny2_content/icons/f841f379751b7672fca0e5f231e92638.png",
  [StatModifier.MAJOR_DISCIPLINE]:
    "https://www.bungie.net/common/destiny2_content/icons/3a5a2d6ee50b2611ebc4d4806d29301a.png",
  [StatModifier.ARTIFICE_DISCIPLINE]:
    "https://www.bungie.net/common/destiny2_content/icons/f841f379751b7672fca0e5f231e92638.png",
  [StatModifier.MINOR_INTELLECT]:
    "https://www.bungie.net/common/destiny2_content/icons/f26479a3462676d613f135657ecad45a.png",
  [StatModifier.MAJOR_INTELLECT]:
    "https://www.bungie.net/common/destiny2_content/icons/98408051297c26cb033cb761ab955fac.png",
  [StatModifier.ARTIFICE_INTELLECT]:
    "https://www.bungie.net/common/destiny2_content/icons/f26479a3462676d613f135657ecad45a.png",
  [StatModifier.MINOR_STRENGTH]:
    "https://www.bungie.net/common/destiny2_content/icons/dbd1615501778b66bca2764b9a561044.png",
  [StatModifier.MAJOR_STRENGTH]:
    "https://www.bungie.net/common/destiny2_content/icons/7b64c0b8014a57c6c297babb18c2239e.png",
  [StatModifier.ARTIFICE_STRENGTH]:
    "https://www.bungie.net/common/destiny2_content/icons/dbd1615501778b66bca2764b9a561044.png",
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
