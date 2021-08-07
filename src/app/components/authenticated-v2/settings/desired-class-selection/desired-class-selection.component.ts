import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {CharacterClass} from "../../../../data/enum/character-Class";
import {ConfigurationService} from "../../../../services/v2/configuration.service";
import {DID_NOT_SELECT_EXOTIC} from "../desired-exotic-selection/desired-exotic-selection.component";

@Component({
  selector: 'app-desired-class-selection',
  templateUrl: './desired-class-selection.component.html',
  styleUrls: ['./desired-class-selection.component.css']
})
export class DesiredClassSelectionComponent implements OnInit {

  @Input() availableClasses: CharacterClass[] = [0,1,2]
  selectedClass = -1;

  constructor(public config: ConfigurationService) {
  }

  ngOnInit(): void {
    this.config.configuration.subscribe(
      c => this.selectedClass = c.characterClass
    )
  }

  selectClass(clazz: number) {
    this.config.modifyConfiguration(d => {
      d.characterClass = clazz;
      d.selectedExoticHash = DID_NOT_SELECT_EXOTIC;
    });
  }
}
