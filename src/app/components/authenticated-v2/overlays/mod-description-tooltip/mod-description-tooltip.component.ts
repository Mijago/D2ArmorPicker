import {Component, Input, OnInit} from '@angular/core';
import {Modifier} from "../../../../data/modifier";

@Component({
  selector: 'app-mod-description-tooltip',
  templateUrl: './mod-description-tooltip.component.html',
  styleUrls: ['./mod-description-tooltip.component.css']
})
export class ModDescriptionTooltipComponent {
  @Input() mod: Modifier | undefined;

  constructor() { }

}
