import {Component, Input, OnInit, TemplateRef} from '@angular/core';
import {ResultItem} from "../../results/results.component";
import {ArmorStat, ArmorStatNames} from "../../../../data/enum/armor-stat";

@Component({
  selector: 'app-armor-tooltip-component',
  templateUrl: './armor-tooltip.component.html',
  styleUrls: ['./armor-tooltip.component.css']
})
export class ArmorTooltipComponent implements OnInit {
  @Input(`itemTooltip`) armor: ResultItem | undefined;

  getArmorStatName(i: number): string {
    return ArmorStatNames[i as ArmorStat]
  }

  getArmorTotalStats(): number | undefined {
    return this.armor?.stats.reduce((sum, stat) => sum + (this.armor?.masterworked ? stat + 2 : stat), 0)
  }

  getWidth(stat: number): string {
    return Math.min(100, stat/32*100)+'%'
  }

  constructor() {
  }

  ngOnInit(): void {
  }

}
