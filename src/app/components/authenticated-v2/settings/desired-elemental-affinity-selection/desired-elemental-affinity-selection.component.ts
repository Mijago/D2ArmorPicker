import {Component, OnInit} from '@angular/core';
import {DestinyEnergyType} from "bungie-api-ts/destiny2";
import {ConfigurationService} from "../../../../services/v2/configuration.service";
import {ModInformation} from "../../../../data/ModInformation";

@Component({
  selector: 'app-desired-elemental-affinity-selection',
  templateUrl: './desired-elemental-affinity-selection.component.html',
  styleUrls: ['./desired-elemental-affinity-selection.component.scss']
})
export class DesiredElementalAffinitySelectionComponent implements OnInit {

  selectedArmorAffinities: DestinyEnergyType[] = [];
  configSelectedArmorAffinities: DestinyEnergyType[] = [];

  freeSlots: number = 5;

  constructor(private config: ConfigurationService) {
  }

  removeElement(index: number) {
    this.config.modifyConfiguration(c => {
      c.selectedArmorAffinities.splice(index, 1)
    })
  }

  addElement(e: DestinyEnergyType) {
    if (this.freeSlots > 0)
      this.config.modifyConfiguration(c => {
        c.selectedArmorAffinities.push(e)
      })
  }

  ngOnInit(): void {
    this.config.configuration.subscribe(c => {
      this.selectedArmorAffinities = c.selectedArmorAffinities;
      this.configSelectedArmorAffinities = c.enabledMods
        .map(d => ModInformation[d].requiredArmorAffinity)
        .filter(d => d != DestinyEnergyType.Any);

      this.freeSlots = Math.max(0, 5 - this.selectedArmorAffinities.length - this.configSelectedArmorAffinities.length)
    })
  }

}
