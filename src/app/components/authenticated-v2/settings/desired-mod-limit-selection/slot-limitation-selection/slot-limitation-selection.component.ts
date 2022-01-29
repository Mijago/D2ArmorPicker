import {Component, Input, OnInit} from '@angular/core';
import {MAXIMUM_STAT_MOD_AMOUNT} from "../../../../../data/constants";
import {ArmorSlot} from "../../../../../data/enum/armor-slot";
import {ConfigurationService} from "../../../../../services/configuration.service";
import {DestinyEnergyType} from "bungie-api-ts/destiny2";
import {ArmorPerkOrSlot} from "../../../../../data/enum/armor-stat";
import {InventoryService} from "../../../../../services/inventory.service";

@Component({
  selector: 'app-slot-limitation-selection',
  templateUrl: './slot-limitation-selection.component.html',
  styleUrls: ['./slot-limitation-selection.component.scss']
})
export class SlotLimitationSelectionComponent implements OnInit {
  readonly ArmorSlot = ArmorSlot;
  readonly ArmorPerkOrSlot = ArmorPerkOrSlot;
  readonly ModRange = new Array(MAXIMUM_STAT_MOD_AMOUNT + 1);
  selection: number = MAXIMUM_STAT_MOD_AMOUNT;

  @Input()
  slot: ArmorSlot = ArmorSlot.ArmorSlotHelmet;
  element: DestinyEnergyType = DestinyEnergyType.Any;
  elementLock: boolean = false;
  armorPerk: ArmorPerkOrSlot = ArmorPerkOrSlot.None;
  armorPerkLock: boolean = false;
  maximumModSlots: number = 5;

  hoveredSlot: number = -1;

  disabled: boolean = false;

  constructor(public config: ConfigurationService, public inventory: InventoryService) {
  }


  get slotName(): string {
    switch (this.slot) {
      case ArmorSlot.ArmorSlotHelmet:
        return "Helmet";
      case ArmorSlot.ArmorSlotGauntlet:
        return "Gauntlet";
      case ArmorSlot.ArmorSlotChest:
        return "Chest";
      case ArmorSlot.ArmorSlotLegs:
        return "Leg";
      case ArmorSlot.ArmorSlotClass:
        return "Class Item";
      default:
        return "";
    }
  }

  ngOnInit(): void {
    this.config.configuration.subscribe(async c => {
      this.selection = c.maximumModSlots[this.slot].value;
      this.element = c.armorAffinities[this.slot].value;
      this.elementLock = c.armorAffinities[this.slot].fixed;
      this.armorPerk = c.armorPerks[this.slot].value;
      this.armorPerkLock = c.armorPerks[this.slot].fixed;
      this.maximumModSlots = c.maximumModSlots[this.slot].value;

      this.disabled = (await this.inventory.getExoticsForClass(c.characterClass))
        .filter(x => c.selectedExotics.indexOf(x.hash) > -1)
        .map(e => e.slot)
        .indexOf(this.slot) > -1;
    })
  }

  toggleElementLock() {
    this.config.modifyConfiguration(c => {
      c.armorAffinities[this.slot].fixed = !c.armorAffinities[this.slot].fixed;
    })
  }

  setArmorElement(element: DestinyEnergyType | number) {
    if (this.element != element)
      this.config.modifyConfiguration(c => {
        c.armorAffinities[this.slot].value = element;
      })
    else
      this.config.modifyConfiguration(c => {
        c.armorAffinities[this.slot].value = DestinyEnergyType.Any;
      })
  }

  toggleArmorPerkLock() {
    this.config.modifyConfiguration(c => {
      c.armorPerks[this.slot].fixed = !c.armorPerks[this.slot].fixed;
    })
  }

  setArmorPerk(perk: ArmorPerkOrSlot) {
    if (this.armorPerk != perk)
      this.config.modifyConfiguration(c => {
        c.armorPerks[this.slot].value = perk;
      })
    else
      this.config.modifyConfiguration(c => {
        c.armorPerks[this.slot].value = ArmorPerkOrSlot.None;
      })
  }

  setValue(i: number) {
    this.maximumModSlots = i;
    this.config.modifyConfiguration(c => c.maximumModSlots[this.slot].value = i);
  }
}
