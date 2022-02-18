import {Component, OnDestroy, OnInit} from '@angular/core';
import {ArmorStat} from "../../../../data/enum/armor-stat";
import {ConfigurationService} from "../../../../services/configuration.service";
import {EnumDictionary} from "../../../../data/types/EnumDictionary";
import {FixableSelection, getDefaultStatDict} from "../../../../data/buildConfiguration";
import {InventoryService} from "../../../../services/inventory.service";
import {ModInformation} from "../../../../data/ModInformation";
import {GetArmorStatTierBonus, LoadingArmorStatTierBonus} from "../../../../data/cooldowns/cooldowns";
import {Subject} from "rxjs";
import {takeUntil} from "rxjs/operators";

function calcScore(d: number[]) {
  let score = 0;
  for (let n of d) {
    score += Math.pow(10, 6 - n)
  }
  return score;
}

@Component({
  selector: 'app-desired-stat-selection',
  templateUrl: './desired-stat-selection.component.html',
  styleUrls: ['./desired-stat-selection.component.css']
})
export class DesiredStatSelectionComponent implements OnInit, OnDestroy {
  readonly stats: { name: string; value: ArmorStat }[];
  minimumStatTiers: EnumDictionary<ArmorStat, FixableSelection<number>> = getDefaultStatDict(1);
  ArmorStatTierBonus: EnumDictionary<ArmorStat, string[]> = LoadingArmorStatTierBonus;
  maximumPossibleTiers: number[] = [10, 10, 10, 10, 10, 10];
  statsByMods: number[] = [0, 0, 0, 0, 0, 0];
  _statCombo4x100: ArmorStat[][] = [];
  _statCombo3x100: ArmorStat[][] = [];


  constructor(public config: ConfigurationService, private inventory: InventoryService) {
    this.stats = Object.keys(ArmorStat)
      .filter(value => !isNaN(Number(value)))
      .map(value => {
        return {name: (ArmorStat as any)[value], value: +value}
      });
  }

  ngOnInit(): void {
    this.config.configuration
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe(
        c => {
          const tmpStatsByMods = [0, 0, 0, 0, 0, 0];
          for (let enabledMod of c.enabledMods) {
            for (let bonus of ModInformation[enabledMod].bonus) {
              tmpStatsByMods[bonus.stat] += bonus.value / 10;
            }
          }
          this.statsByMods = tmpStatsByMods;
          this.minimumStatTiers = c.minimumStatTiers;

          this.ArmorStatTierBonus = GetArmorStatTierBonus(c.characterClass);
        }
      )

    this.inventory.armorResults
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe(d => {
        // Do not update if we get 0 results
        const tiers = d.maximumPossibleTiers || [10, 10, 10, 10, 10, 10];
        console.log("d.maximumPossibleTiers", tiers)
        if (tiers.filter(d => d == 0).length < 6) {
          this.maximumPossibleTiers = tiers;
        }

        this._statCombo3x100 = (d.statCombo3x100 || []).sort((a, b) => calcScore(b) - calcScore(a))
        this._statCombo4x100 = d.statCombo4x100 || []
      })
  }

  setSelectedTier(stat: ArmorStat, value: number) {
    //if (this.config.readonlyConfigurationSnapshot.minimumStatTiers[stat].value == value)
    //return;

    this.config.modifyConfiguration(c => {
      c.minimumStatTiers[stat].value = value;
    })
  }

  clearStatSelection() {
    this.config.modifyConfiguration(c => {
      for (let n = 0; n < 6; n++)
        c.minimumStatTiers[n as ArmorStat] = {fixed: false, value: 0};
    })
  }

  useStatPreset(d: ArmorStat[]) {
    if (d.filter(k => this.config.readonlyConfigurationSnapshot.minimumStatTiers[k].value != 10).length == 0)
      return;

    this.config.modifyConfiguration(c => {
      for (let armorStat of d) {
        c.minimumStatTiers[armorStat].value = 10;
      }
    })
  }

  setLockState(stat: ArmorStat, value: boolean) {
    this.config.modifyConfiguration(c => {
      c.minimumStatTiers[stat].fixed = value;
    })
  }

  private ngUnsubscribe = new Subject();

  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }
}
