import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {CharacterClass} from "../../../../data/enum/character-Class";

@Component({
  selector: 'app-desired-class-selection',
  templateUrl: './desired-class-selection.component.html',
  styleUrls: ['./desired-class-selection.component.css']
})
export class DesiredClassSelectionComponent implements OnInit {

  @Input() availableClasses: CharacterClass[] = []
  @Input() selection: number = 0;
  @Output() selectionChange = new EventEmitter<CharacterClass>();

  constructor() {
  }

  ngOnInit(): void {
  }

}
