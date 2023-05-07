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
    "https://www.bungie.net/common/destiny2_content/icons/287901ef741855655856f6e8f5776f03.png",
  [StatModifier.MAJOR_MOBILITY]:
    "https://www.bungie.net/common/destiny2_content/icons/c664ddd10920daab49cc3808dbb6a1e6.png",
  [StatModifier.ARTIFICE_MOBILITY]:
    "https://www.bungie.net/common/destiny2_content/icons/287901ef741855655856f6e8f5776f03.png",
  [StatModifier.MINOR_RESILIENCE]:
    "https://bungie.net/common/destiny2_content/icons/53c28186a4b97285a01aace5748e4de7.png",
  [StatModifier.MAJOR_RESILIENCE]:
    "https://www.bungie.net/common/destiny2_content/icons/195f4f173adb52b336b4ecd67101004d.png",
  [StatModifier.ARTIFICE_RESILIENCE]:
    "https://bungie.net/common/destiny2_content/icons/53c28186a4b97285a01aace5748e4de7.png",
  [StatModifier.MINOR_RECOVERY]:
    "https://bungie.net/common/destiny2_content/icons/f39b0c97678148a864d6f6fbbe85524d.png",
  [StatModifier.MAJOR_RECOVERY]:
    "https://www.bungie.net/common/destiny2_content/icons/18054408a5fc068f2384c6c31a183423.png",
  [StatModifier.ARTIFICE_RECOVERY]:
    "https://bungie.net/common/destiny2_content/icons/f39b0c97678148a864d6f6fbbe85524d.png",
  [StatModifier.MINOR_DISCIPLINE]:
    "https://bungie.net/common/destiny2_content/icons/8fa2d4e4c82586668210e12c5115575a.png",
  [StatModifier.MAJOR_DISCIPLINE]:
    "https://www.bungie.net/common/destiny2_content/icons/9d54e2149f945b2c298020da443b70fa.png",
  [StatModifier.ARTIFICE_DISCIPLINE]:
    "https://bungie.net/common/destiny2_content/icons/8fa2d4e4c82586668210e12c5115575a.png",
  [StatModifier.MINOR_INTELLECT]:
    "https://bungie.net/common/destiny2_content/icons/d8da60458e3355ddf7123be5ffe3dc3c.png",
  [StatModifier.MAJOR_INTELLECT]:
    "https://www.bungie.net/common/destiny2_content/icons/9fd56c3b42923c9df23edf585b0107bf.png",
  [StatModifier.ARTIFICE_INTELLECT]:
    "https://bungie.net/common/destiny2_content/icons/d8da60458e3355ddf7123be5ffe3dc3c.png",
  [StatModifier.MINOR_STRENGTH]:
    "https://bungie.net/common/destiny2_content/icons/ec0b298ec4dac0023604e467a58c3868.png",
  [StatModifier.MAJOR_STRENGTH]:
    "https://www.bungie.net/common/destiny2_content/icons/07f2361532c79e773909220e5884ab07.png",
  [StatModifier.ARTIFICE_STRENGTH]:
    "https://bungie.net/common/destiny2_content/icons/ec0b298ec4dac0023604e467a58c3868.png",
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
