import { Component, Input, OnInit } from "@angular/core";
import {
    ArmorPerkOrSlot,
    ArmorPerkOrSlotIcons,
    ArmorPerkOrSlotNames,
} from "../../../../data/enum/armor-stat";

@Component({
    selector: "app-armor-perk-icon",
    templateUrl: "./armor-perk-icon.component.html",
    styleUrls: ["./armor-perk-icon.component.scss"],
})
export class ArmorPerkIconComponent {
    ArmorPerkOrSlot = ArmorPerkOrSlot;

    customIconMods = [
        ArmorPerkOrSlot.SlotKingsFall,
        ArmorPerkOrSlot.SlotArtifice,
        ArmorPerkOrSlot.SlotVowOfTheDisciple,
        ArmorPerkOrSlot.SlotRootOfNightmares,
    ];

    @Input()
    perk: ArmorPerkOrSlot = ArmorPerkOrSlot.None;

    constructor() {}

    get name() {
        return ArmorPerkOrSlotNames[this.perk];
    }

    get url() {
        return ArmorPerkOrSlotIcons[this.perk];
    }
}
