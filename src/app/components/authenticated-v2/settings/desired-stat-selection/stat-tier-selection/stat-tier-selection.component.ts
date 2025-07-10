/*
 * Copyright (c) 2023 D2ArmorPicker by Mijago.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  OnDestroy,
  Output,
  ViewChild,
  ElementRef,
  AfterViewChecked,
} from "@angular/core";
import { ArmorStat } from "../../../../../data/enum/armor-stat";

@Component({
  selector: "app-stat-tier-selection",
  templateUrl: "./stat-tier-selection.component.html",
  styleUrls: ["./stat-tier-selection.component.scss"],
})
export class StatTierSelectionComponent implements OnInit, OnChanges, OnDestroy, AfterViewChecked {
  readonly TierRange = new Array(11);
  @Input() stat: ArmorStat = ArmorStat.StatWeapon;
  @Input() statsByMods: number = 0;
  @Input() maximumAvailableTier: number = 20;
  @Input() selectedTier: number = 0;
  @Input() locked: boolean = false;
  @Output() selectedTierChange = new EventEmitter<number>();
  @Output() lockedChange = new EventEmitter<boolean>();

  @ViewChild("valueInput") valueInput!: ElementRef<HTMLInputElement>;

  selectedValue: number = 0;
  public hoveredValue: number | null = null;
  public statValues: number[] = [];
  public editingValue: boolean = false;

  public currentAnimatedMaxTier: number = 0;
  private animationTimeouts: Set<number> = new Set();

  constructor() {}

  ngOnInit(): void {
    // Generate values from 0 to 200
    this.statValues = Array.from({ length: 201 }, (_, i) => i);
    this.currentAnimatedMaxTier = this.maximumAvailableTier;
  }

  ngOnChanges() {
    this.selectedValue = this.selectedTier * 10;
    this.animateMaxTierChange();
  }

  ngOnDestroy(): void {
    this.clearAnimationTimeouts();
  }

  ngAfterViewChecked() {
    if (this.editingValue && this.valueInput) {
      this.valueInput.nativeElement.focus();
      this.valueInput.nativeElement.select();
    }
  }

  setValue(newValue: number) {
    if (newValue <= this.maximumAvailableTier) {
      console.log("Setting value to: " + newValue);
      this.selectedTier = newValue;
      this.selectedTierChange.emit(newValue);
    }
  }

  setValueMob(inputEvent: any) {
    let newValue = parseInt(inputEvent);
    newValue = Math.min(Math.max(newValue, 0), 200);
    this.setValue(newValue / 10);
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

  /**
   * Optimized hover handling for immediate response
   */
  handleHover(value: number): void {
    if (value <= this.maximumAvailableTier * 10) {
      // Use requestAnimationFrame for smoother UI updates
      requestAnimationFrame(() => {
        this.hoveredValue = value;
      });
    }
  }

  /**
   * Clear hover state immediately
   */
  clearHover(): void {
    this.hoveredValue = null;
  }

  commitValueEdit(value: string | number) {
    let num = Number(value);
    if (isNaN(num)) {
      num = this.selectedValue;
    }
    num = Math.round(num);
    num = Math.max(0, Math.min(num, this.maximumAvailableTier * 10));
    this.selectedValue = num;
    this.selectedTier = num / 10;
    this.selectedTierChange.emit(this.selectedTier);
    this.editingValue = false;
  }

  cancelValueEdit() {
    this.editingValue = false;
  }

  /**
   * Animate the maximum tier change with cascading effect
   */
  private animateMaxTierChange(): void {
    // Clear any existing animation timeouts
    this.clearAnimationTimeouts();

    const targetMaxTier = this.maximumAvailableTier;
    const startTier = this.currentAnimatedMaxTier;

    if (startTier === targetMaxTier) {
      return; // No change needed
    }

    // Skip animation if going from 0 to initial value (e.g., 0->20)
    if (startTier === 0) {
      this.currentAnimatedMaxTier = targetMaxTier;
      return;
    }

    const direction = targetMaxTier > startTier ? 1 : -1;
    const steps = Math.abs(targetMaxTier - startTier);

    // Animation delay between each step (in milliseconds)
    const stepDelay = 15; // Fast animation

    for (let i = 1; i <= steps; i++) {
      const timeout = window.setTimeout(() => {
        this.currentAnimatedMaxTier = startTier + direction * i;

        // Force change detection to update the UI
        // This will trigger the CSS class updates through the template bindings
      }, stepDelay * i);

      this.animationTimeouts.add(timeout);
    }
  }

  /**
   * Clear all pending animation timeouts
   */
  private clearAnimationTimeouts(): void {
    this.animationTimeouts.forEach((timeout) => window.clearTimeout(timeout));
    this.animationTimeouts.clear();
  }

  /**
   * Check if a stat value is currently animating (for smooth transitions)
   */
  isStatValueAnimating(value: number): boolean {
    const tierValue = value / 10;
    const currentMax = this.currentAnimatedMaxTier;
    const targetMax = this.maximumAvailableTier;

    if (currentMax === targetMax) {
      return false;
    }

    // Value is in the range being animated
    const minRange = Math.min(currentMax, targetMax);
    const maxRange = Math.max(currentMax, targetMax);

    return tierValue > minRange && tierValue <= maxRange;
  }
}
