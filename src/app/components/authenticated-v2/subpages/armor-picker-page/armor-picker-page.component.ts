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

import { Component, OnDestroy, OnInit, ChangeDetectionStrategy } from "@angular/core";
import { Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";
import {
  ArmorCalculatorService,
  ArmorPoolItemView,
} from "src/app/services/armor-calculator.service";
import { ResultDefinition } from "src/app/components/authenticated-v2/results/results.component";

@Component({
  selector: "app-armor-picker-page",
  templateUrl: "./armor-picker-page.component.html",
  styleUrls: ["./armor-picker-page.component.css"],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class ArmorPickerPageComponent implements OnInit, OnDestroy {
  hasResults = false;
  armorPoolItems: ArmorPoolItemView[] = [];
  itemUsageCounts = new Map<string, number>();

  private readonly destroy$ = new Subject<void>();

  constructor(private armorCalculator: ArmorCalculatorService) {}

  ngOnInit(): void {
    this.armorCalculator.armorResults
      .pipe(takeUntil(this.destroy$))
      .subscribe(
        (result: { results: ResultDefinition[]; prePruneArmorItems?: ArmorPoolItemView[] }) => {
          this.hasResults =
            (result.results?.length ?? 0) > 0 || (result.prePruneArmorItems?.length ?? 0) > 0;
          this.armorPoolItems = result.prePruneArmorItems ?? [];
          this.itemUsageCounts = this.buildItemUsageCounts(result.results ?? []);
        }
      );
  }

  private buildItemUsageCounts(results: ResultDefinition[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const result of results) {
      for (const item of result.items) {
        counts.set(item.itemInstanceId, (counts.get(item.itemInstanceId) ?? 0) + 1);
      }
    }
    return counts;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
