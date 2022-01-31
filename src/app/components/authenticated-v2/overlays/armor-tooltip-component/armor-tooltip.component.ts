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

  getArmorStatName(i: number) {
    return ArmorStatNames[i as ArmorStat]
  }

  getWidth(stat: number) {
    return Math.min(100, stat/32*100)+'%'
  }

  constructor() {
  }

  ngOnInit(): void {
  }

}
