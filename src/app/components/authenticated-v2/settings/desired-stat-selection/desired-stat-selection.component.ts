import {Component, OnInit} from '@angular/core';
import {ArmorStat} from "../../../../data/enum/armor-stat";
import {ConfigurationService} from "../../../../services/v2/configuration.service";
import {EnumDictionary} from "../../../../data/types/EnumDictionary";
import {getDefaultStatDict} from "../../../../data/configuration";

@Component({
  selector: 'app-desired-stat-selection',
  templateUrl: './desired-stat-selection.component.html',
  styleUrls: ['./desired-stat-selection.component.css']
})
export class DesiredStatSelectionComponent implements OnInit {
  readonly ArmorStats = ArmorStat;
  readonly stats: { name: string; value: ArmorStat }[];
  minimumStatTiers: EnumDictionary<ArmorStat, number> = getDefaultStatDict(1);


  constructor(public config: ConfigurationService) {
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
  }

  setSelectedTier(stat: ArmorStat, value: number) {
    this.config.modifyConfiguration(c => {
      c.minimumStatTier[stat] = value;
    })
  }
}
