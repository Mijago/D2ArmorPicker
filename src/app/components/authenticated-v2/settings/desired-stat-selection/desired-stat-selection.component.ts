import {Component, OnInit} from '@angular/core';
import {ArmorStat, ArmorStatTierBonus} from "../../../../data/enum/armor-stat";
import {ConfigurationService} from "../../../../services/v2/configuration.service";
import {EnumDictionary} from "../../../../data/types/EnumDictionary";
import {getDefaultStatDict} from "../../../../data/configuration";
import {InventoryService} from "../../../../services/v2/inventory.service";
import {MaxStatData} from "../../../authenticated/main/main.component";

function calcScore(d: number[]) {
  let score = 0;
  for (let n of d) {
    score += Math.pow(10, 6-n)
  }
  return score;
}

@Component({
  selector: 'app-desired-stat-selection',
  templateUrl: './desired-stat-selection.component.html',
  styleUrls: ['./desired-stat-selection.component.css']
})
export class DesiredStatSelectionComponent implements OnInit {
  readonly ArmorStats = ArmorStat;
  readonly stats: { name: string; value: ArmorStat }[];
  minimumStatTiers: EnumDictionary<ArmorStat, number> = getDefaultStatDict(1);
  ArmorStatTierBonus: EnumDictionary<ArmorStat, string[]> = ArmorStatTierBonus;
  maximumPossibleTiers: number[] = [10, 10, 10, 10, 10, 10];
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
    this.config.configuration.subscribe(
      c => {
        this.minimumStatTiers = c.minimumStatTier;
      }
    )

    this.inventory.armorResults.subscribe(d => {
      // Do not update if we get 0 results
      const tiers = d.maximumPossibleTiers || [10, 10, 10, 10, 10, 10];
      console.log("d.maximumPossibleTiers", tiers)
      if (tiers.filter(d => d == 0).length < 6) {
        this.maximumPossibleTiers = tiers;
      }

      this._statCombo3x100 = (d.statCombo3x100 || []).sort((a,b) => calcScore(b) - calcScore(a))
      this._statCombo4x100 = d.statCombo4x100 || []
    })
  }

  setSelectedTier(stat: ArmorStat, value: number) {
    this.config.modifyConfiguration(c => {
      c.minimumStatTier[stat] = value;
    })
  }

  clearStatSelection() {
    this.config.modifyConfiguration(c => {
      for (let n = 0; n < 6; n++)
        c.minimumStatTier[n as ArmorStat] = 0;
    })
  }

  useStatPreset(d: ArmorStat[]) {
    this.config.modifyConfiguration(c => {
      for (let armorStat of d) {
        c.minimumStatTier[armorStat] = 10;
      }
    })
  }
}
