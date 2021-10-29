import {Component, OnInit} from '@angular/core';
import {DestinyEnergyType} from "bungie-api-ts/destiny2";
import {ConfigurationService} from "../../../../services/configuration.service";
import {ModInformation} from "../../../../data/ModInformation";
import {EnumDictionary} from "../../../../data/types/EnumDictionary";
import {ArmorSlot} from "../../../../data/enum/armor-slot";

@Component({
  selector: 'app-desired-elemental-affinity-selection',
  templateUrl: './desired-elemental-affinity-selection.component.html',
  styleUrls: ['./desired-elemental-affinity-selection.component.scss']
})
export class DesiredElementalAffinitySelectionComponent implements OnInit {
  configSelectedArmorAffinities: DestinyEnergyType[] = [];

  configFixedArmorAffinities: EnumDictionary<ArmorSlot, DestinyEnergyType> = {
    [ArmorSlot.ArmorSlotHelmet]: DestinyEnergyType.Any,
    [ArmorSlot.ArmorSlotGauntlet]: DestinyEnergyType.Any,
    [ArmorSlot.ArmorSlotChest]: DestinyEnergyType.Any,
    [ArmorSlot.ArmorSlotLegs]: DestinyEnergyType.Any,
    [ArmorSlot.ArmorSlotClass]: DestinyEnergyType.Any,
  };

  constructor(private config: ConfigurationService) {
  }

  setArmorElement(slot: ArmorSlot | any, element: DestinyEnergyType | number) {
    if (this.configFixedArmorAffinities[slot as ArmorSlot] != element)
      this.config.modifyConfiguration(c => {
        c.fixedArmorAffinities[slot as ArmorSlot] = element;
      })
  }

  ngOnInit(): void {
    this.config.configuration.subscribe(c => {
      this.configFixedArmorAffinities = c.fixedArmorAffinities

      // TODO: add note that you need those
      this.configSelectedArmorAffinities = c.enabledMods
        .map(d => ModInformation[d].requiredArmorAffinity)
        .filter(d => d != DestinyEnergyType.Any);
    })
  }

}
