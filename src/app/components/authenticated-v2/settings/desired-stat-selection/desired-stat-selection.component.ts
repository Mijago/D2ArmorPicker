import {Component, OnInit} from '@angular/core';
import {ArmorStat} from "../../../../data/enum/armor-stat";
import {ConfigurationService} from "../../../../services/v2/configuration.service";
import {EnumDictionary} from "../../../../data/types/EnumDictionary";
import {getDefaultStatDict} from "../../../../data/configuration";
import {InventoryService} from "../../../../services/v2/inventory.service";

@Component({
  selector: 'app-desired-stat-selection',
  templateUrl: './desired-stat-selection.component.html',
  styleUrls: ['./desired-stat-selection.component.css']
})
export class DesiredStatSelectionComponent implements OnInit {
  readonly ArmorStats = ArmorStat;
  readonly stats: { name: string; value: ArmorStat }[];
  minimumStatTiers: EnumDictionary<ArmorStat, number> = getDefaultStatDict(1);
  maximumPossibleTiers: number[] = [10, 10, 10, 10, 10, 10];


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
      this.maximumPossibleTiers = d.maximumPossibleTiers || [10, 10, 10, 10, 10, 10]
    })
  }

  setSelectedTier(stat: ArmorStat, value: number) {
    this.config.modifyConfiguration(c => {
      c.minimumStatTier[stat] = value;
    })
  }
}
