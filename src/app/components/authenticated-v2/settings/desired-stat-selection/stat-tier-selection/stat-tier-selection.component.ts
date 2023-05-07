import { Component, EventEmitter, Input, Output } from "@angular/core";
import { ArmorStat } from "../../../../../data/enum/armor-stat";

@Component({
  selector: "app-stat-tier-selection",
  templateUrl: "./stat-tier-selection.component.html",
  styleUrls: ["./stat-tier-selection.component.scss"],
})
export class StatTierSelectionComponent {
  readonly TierRange = new Array(11);
  @Input() stat: ArmorStat = ArmorStat.Mobility;
  @Input() statsByMods: number = 0;
  @Input() maximumAvailableTier: number = 10;
  @Input() selectedTier: number = 0;
  @Input() locked: boolean = false;
  @Output() selectedTierChange = new EventEmitter<number>();
  @Output() lockedChange = new EventEmitter<boolean>();

  constructor() {}

  setValue(newValue: number) {
    if (newValue <= this.maximumAvailableTier) {
      this.selectedTier = newValue;
      this.selectedTierChange.emit(newValue);
    }
  }

  isAddedByConfigMods(index: number) {
    return (
      index > 0 &&
      ((this.selectedTier - index >= 0 && this.selectedTier - index < this.statsByMods) || // on the right
        // ( index <= this.statsByMods) // on the left
        (this.selectedTier < this.statsByMods && index <= this.statsByMods))
    );
  }

  toggleLockState() {
    this.locked = !this.locked;
    this.lockedChange.emit(this.locked);
  }
}
