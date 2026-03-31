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

import { Component, OnDestroy, OnInit } from "@angular/core";
import { ArmorStat, ArmorStatNames, ARMORSTAT_ORDER } from "../../../../data/enum/armor-stat";
import { ConfigurationService } from "../../../../services/configuration.service";
import { EnumDictionary } from "../../../../data/types/EnumDictionary";
import { FixableSelection, getDefaultStatDict } from "../../../../data/buildConfiguration";
import { ArmorCalculatorService } from "../../../../services/armor-calculator.service";
import { ModInformation } from "../../../../data/ModInformation";
import { Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";
import { ModOptimizationStrategy } from "../../../../data/enum/mod-optimization-strategy";

@Component({
  selector: "app-desired-stat-selection",
  templateUrl: "./desired-stat-selection.component.html",
  styleUrls: ["./desired-stat-selection.component.css"],
})
export class DesiredStatSelectionComponent implements OnInit, OnDestroy {
  readonly stats: { name: string; value: ArmorStat }[];
  minimumStatTiers: EnumDictionary<ArmorStat, FixableSelection<number>> = getDefaultStatDict(1);
  maximumPossibleTiers: number[] = [20, 20, 20, 20, 20, 20];
  statsByMods: number[] = [0, 0, 0, 0, 0, 0];
  config_zero_waste = false;
  config_mod_strategy = ModOptimizationStrategy.None;
  config_reduce_waste = false;

  constructor(
    public config: ConfigurationService,
    private armorCalculator: ArmorCalculatorService
  ) {
    this.stats = ARMORSTAT_ORDER.map((value) => {
      return { name: (ArmorStatNames as any)[+value], value: +value };
    });
  }

  ngOnInit(): void {
    this.config.configuration.pipe(takeUntil(this.ngUnsubscribe)).subscribe((c) => {
      const tmpStatsByMods = [0, 0, 0, 0, 0, 0];
      for (let enabledMod of c.enabledMods) {
        for (let bonus of ModInformation[enabledMod].bonus) {
          tmpStatsByMods[bonus.stat] += bonus.value / 10;
        }
      }
      this.statsByMods = tmpStatsByMods;
      this.minimumStatTiers = c.minimumStatTiers;
      this.config_zero_waste = c.onlyShowResultsWithNoWastedStats;
      this.config_mod_strategy = c.modOptimizationStrategy;
      this.config_reduce_waste = c.tryLimitWastedStats;
    });

    this.armorCalculator.reachableTiers.pipe(takeUntil(this.ngUnsubscribe)).subscribe((d) => {
      // Do not update if we get 0 results
      const tiers = d || [20, 20, 20, 20, 20, 20];
      if (tiers.filter((d) => d == 0).length < 6) {
        this.maximumPossibleTiers = tiers;
      }
    });

    this.armorCalculator.armorResults.pipe(takeUntil(this.ngUnsubscribe)).subscribe((d) => {
      // Do not update if we get 0 results
      const tiers = d.maximumPossibleTiers || [20, 20, 20, 20, 20, 20];
      if (tiers.filter((d) => d == 0).length < 6) {
        this.maximumPossibleTiers = tiers;
      }
    });
  }

  setSelectedTier(stat: ArmorStat, value: number) {
    //if (this.config.readonlyConfigurationSnapshot.minimumStatTiers[stat].value == value)
    //return;

    this.config.modifyConfiguration((c) => {
      c.minimumStatTiers[stat].value = value;
    });
  }

  clearStatSelection() {
    this.config.modifyConfiguration((c) => {
      for (let stat of ARMORSTAT_ORDER) {
        c.minimumStatTiers[stat] = { fixed: false, value: 0 };
      }
    });
  }

  useStatPreset(d: ArmorStat[]) {
    if (
      d.filter((k) => this.config.readonlyConfigurationSnapshot.minimumStatTiers[k].value != 10)
        .length == 0
    )
      return;

    this.config.modifyConfiguration((c) => {
      for (let armorStat of d) {
        c.minimumStatTiers[armorStat].value = 10;
      }
    });
  }

  setLockState(stat: ArmorStat, value: boolean) {
    this.config.modifyConfiguration((c) => {
      c.minimumStatTiers[stat].fixed = value;
    });
  }

  private ngUnsubscribe = new Subject();

  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }

  setModOptimizationStrategy() {
    this.config.modifyConfiguration((c) => {
      c.modOptimizationStrategy = this.config_mod_strategy;
    });
  }

  toggleReduceWaste() {
    this.config.modifyConfiguration((c) => {
      c.tryLimitWastedStats = !this.config_reduce_waste;
    });
  }
}
