import {Component, OnInit} from '@angular/core';
import {InventoryService} from "../../../../services/v2/inventory.service";
import {ConfigurationService} from "../../../../services/v2/configuration.service";
import {CharacterClass} from "../../../../data/enum/character-Class";
import {IManifestArmor} from "../../../../services/database.service";

export const FORCE_USE_NO_EXOTIC = -1;
export const DID_NOT_SELECT_EXOTIC = 0;

@Component({
  selector: 'app-desired-exotic-selection',
  templateUrl: './desired-exotic-selection.component.html',
  styleUrls: ['./desired-exotic-selection.component.scss']
})
export class DesiredExoticSelectionComponent implements OnInit {

  selectedExoticHash: number = DID_NOT_SELECT_EXOTIC;
  currentClass: CharacterClass = CharacterClass.None;
  exotics: IManifestArmor[][] = [];

  constructor(public inventory: InventoryService, public config: ConfigurationService) {
  }

  ngOnInit(): void {
    this.config.configuration.subscribe(async c => {
      if (c.characterClass != this.currentClass) {
        this.currentClass = c.characterClass;
        const armors = await this.inventory.getExoticsForClass(this.currentClass);

        this.exotics = [
          armors.filter(a => a.slot == "Helmets"),
          armors.filter(a => a.slot == "Arms"),
          armors.filter(a => a.slot == "Chest"),
          armors.filter(a => a.slot == "Legs"),
        ]
      }
      this.selectedExoticHash = c.selectedExoticHash;
    })
  }

  selectExotic(hash: number) {
    this.config.modifyConfiguration(c => {
      c.selectedExoticHash = c.selectedExoticHash == hash ? DID_NOT_SELECT_EXOTIC : hash;
    })
  }

}
