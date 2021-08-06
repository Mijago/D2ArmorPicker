import {Component, OnInit} from '@angular/core';
import {ArmorStat} from "../../../../data/enum/armor-stat";
import {ConfigurationService} from "../../../../services/v2/configuration.service";

@Component({
  selector: 'app-desired-stat-selection',
  templateUrl: './desired-stat-selection.component.html',
  styleUrls: ['./desired-stat-selection.component.css']
})
export class DesiredStatSelectionComponent implements OnInit {
  readonly ArmorStats = ArmorStat;
  readonly stats: { name: string; value: ArmorStat }[];


  constructor(public config: ConfigurationService) {
    this.stats = Object.keys(ArmorStat)
      .filter(value => !isNaN(Number(value)))
      .map(value => {
        return {name: (ArmorStat as any)[value], value: +value}
      });
    console.log(this.stats)
  }

  ngOnInit(): void {
  }

}
