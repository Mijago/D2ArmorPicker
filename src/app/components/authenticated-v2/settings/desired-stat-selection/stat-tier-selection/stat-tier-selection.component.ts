import {EventEmitter} from '@angular/core';
import {Component, Input, OnInit, Output} from '@angular/core';

@Component({
  selector: 'app-stat-tier-selection',
  templateUrl: './stat-tier-selection.component.html',
  styleUrls: ['./stat-tier-selection.component.scss']
})
export class StatTierSelectionComponent {
  readonly TierRange = new Array(11);
  @Input() maximumAvailableTier: number = 10;
  @Input() selectedTier: number = 0;
  @Output() selectedTierChange = new EventEmitter<number>();

  constructor() {
  }

  setValue(newValue: number) {
    this.selectedTier = newValue;
    this.selectedTierChange.emit(newValue)
  }


}
