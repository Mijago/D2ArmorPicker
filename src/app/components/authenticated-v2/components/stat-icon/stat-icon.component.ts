import {Component, Input, OnInit} from '@angular/core';
import {ArmorStat} from "../../../../data/enum/armor-stat";

@Component({
  selector: 'app-stat-icon',
  templateUrl: './stat-icon.component.html',
  styleUrls: ['./stat-icon.component.css']
})
export class StatIconComponent {

  @Input()
  stat: ArmorStat = ArmorStat.Mobility;

  constructor() { }

}
