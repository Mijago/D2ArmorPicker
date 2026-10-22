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
  Inject,
  OnDestroy,
  OnInit,
  Optional,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from "@angular/core";
import { ArmorStat, ArmorStatNames } from "../../../../data/enum/armor-stat";
import { ConfigurationService } from "../../../../services/configuration.service";
import { StatusProviderService } from "../../../../services/status-provider.service";
import { EnumDictionary } from "../../../../data/types/EnumDictionary";
import {
  BuildConfiguration,
  FixableSelection,
  getDefaultStatDict,
} from "../../../../data/buildConfiguration";
import { ArmorCalculatorService } from "../../../../services/armor-calculator.service";
import { ModInformation } from "../../../../data/ModInformation";
import { Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";
import { ModOptimizationStrategy } from "../../../../data/enum/mod-optimization-strategy";
import { STAT_REACHABILITY, StatReachability } from "../../../../services/stat-reachability";

@Component({
  selector: "app-desired-stat-selection",
  templateUrl: "./desired-stat-selection.component.html",
  styleUrls: ["./desired-stat-selection.component.css"],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class DesiredStatSelectionComponent implements OnInit, OnDestroy {
  readonly stats: { name: string; value: ArmorStat }[];
  minimumStatTiers: EnumDictionary<ArmorStat, FixableSelection<number>> = getDefaultStatDict(1);
  maximumPossibleTiers: number[] = [20, 20, 20, 20, 20, 20];
  statsByMods: number[] = [0, 0, 0, 0, 0, 0];
  config_zero_waste = false;
  config_mod_strategy = ModOptimizationStrategy.None;
  config_reduce_waste = false;
  limitsPending = true;
  limitsFeasible = false;
  limitsMaximumComplete = false;
  limitsPreview = false;
  limitsError?: string;
  selectionError?: string;
  validatingSelection = false;
  private selectionVersion = 0;

  constructor(
    public config: ConfigurationService,
    private armorCalculator: ArmorCalculatorService,
    private status: StatusProviderService,
    @Optional()
    @Inject(STAT_REACHABILITY)
    private theorizerReachability: StatReachability | null = null,
    @Optional() private changeDetector: ChangeDetectorRef | null = null
  ) {
    this.stats = (
      Object.values(ArmorStat).filter((value) => typeof value === "number") as ArmorStat[]
    ).map((value) => {
      return { name: ArmorStatNames[value], value };
    });
  }

  ngOnInit(): void {
    this.config.configuration.pipe(takeUntil(this.ngUnsubscribe)).subscribe((c) => {
      this.selectionVersion++;
      this.validatingSelection = false;
      this.selectionError = undefined;
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
      this.changeDetector?.markForCheck();
    });

    if (this.config.isTheorizer) {
      this.theorizerReachability?.limitsState
        ?.pipe(takeUntil(this.ngUnsubscribe))
        .subscribe((state) => {
          this.limitsPending = state.pending;
          this.limitsFeasible = state.feasible;
          this.limitsMaximumComplete = state.maximumComplete;
          this.limitsPreview = !!state.preview;
          this.limitsError = state.error;
          this.changeDetector?.markForCheck();
        });
      this.theorizerReachability?.reachableTiers
        .pipe(takeUntil(this.ngUnsubscribe))
        .subscribe((tiers) => {
          this.maximumPossibleTiers = tiers;
          this.changeDetector?.markForCheck();
        });
      return;
    }

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
    if (this.config.isTheorizer) {
      if (!Number.isFinite(value) || value < 0 || value > 20) return;
      const selected = this.minimumStatTiers[stat];
      if (this.validatingSelection) return;
      if (
        this.limitsPreview &&
        this.limitsPending &&
        !selected.fixed &&
        value <= this.maximumPossibleTiers[stat]
      ) {
        // The preview maximum is achievable, so the exact run can be dropped.
        this.config.modifyConfiguration((c) => {
          c.minimumStatTiers[stat].value = value;
        });
        return;
      }
      if ((this.limitsPending || !this.limitsFeasible) && value > selected.value) return;
      if (
        this.limitsFeasible &&
        !this.limitsPending &&
        this.limitsMaximumComplete &&
        !selected.fixed &&
        value <= this.maximumPossibleTiers[stat]
      ) {
        this.config.modifyConfiguration((c) => {
          c.minimumStatTiers[stat].value = value;
        });
      } else if (
        value <= this.maximumPossibleTiers[stat] ||
        value < selected.value ||
        !this.limitsMaximumComplete
      ) {
        void this.proposeTargets((c) => {
          c.minimumStatTiers[stat].value = value;
        });
      }
      return;
    }
    this.config.modifyConfiguration((c) => {
      c.minimumStatTiers[stat].value = value;
    });
  }

  cancelCalculationForSlider(): void {
    if (this.config.isTheorizer) {
      this.theorizerReachability?.cancel();
      return;
    }
    const status = this.status.getStatus();
    if (status.calculatingResults || status.calculatingPermutations) {
      this.armorCalculator.cancelCalculation();
    }
  }

  clearStatSelection() {
    if (this.config.isTheorizer) {
      void this.proposeTargets((c) => {
        for (const { value: stat } of this.stats)
          c.minimumStatTiers[stat] = { fixed: false, value: 0 };
      });
      return;
    }
    this.config.modifyConfiguration((c) => {
      for (let stat of this.stats.map(({ value }) => value)) {
        c.minimumStatTiers[stat] = { fixed: false, value: 0 };
      }
    });
  }

  useStatPreset(d: ArmorStat[]) {
    if (this.config.isTheorizer) {
      void this.proposeTargets((c) => {
        for (const stat of d) c.minimumStatTiers[stat].value = 10;
      });
      return;
    }
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
    if (this.config.isTheorizer) {
      if (this.limitsPending || this.validatingSelection) return;
      void this.proposeTargets((c) => {
        c.minimumStatTiers[stat].fixed = value;
      });
      return;
    }
    this.config.modifyConfiguration((c) => {
      c.minimumStatTiers[stat].fixed = value;
    });
  }

  private ngUnsubscribe = new Subject();

  private async proposeTargets(change: (config: BuildConfiguration) => void): Promise<void> {
    const validate = this.theorizerReachability?.validateTargets;
    if (!validate) return;
    const proposed = structuredClone(this.config.currentConfiguration);
    change(proposed);
    const version = ++this.selectionVersion;
    this.validatingSelection = true;
    this.selectionError = undefined;
    const valid = await validate.call(this.theorizerReachability, proposed);
    if (version !== this.selectionVersion) return;
    this.validatingSelection = false;
    if (valid) {
      this.config.modifyConfiguration((c) => {
        c.minimumStatTiers = structuredClone(proposed.minimumStatTiers);
      });
    } else {
      this.selectionError =
        "This target change could not be verified. The previous targets are unchanged.";
    }
    this.changeDetector?.markForCheck();
  }

  retryLimits(): void {
    this.theorizerReachability?.retryLimits?.();
  }

  ngOnDestroy() {
    this.selectionVersion++;
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
