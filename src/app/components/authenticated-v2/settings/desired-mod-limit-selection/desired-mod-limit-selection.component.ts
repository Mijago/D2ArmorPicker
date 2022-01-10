import {Component, OnInit} from '@angular/core';
import { ArmorSlot } from 'src/app/data/enum/armor-slot';

@Component({
  selector: 'app-desired-mod-selection',
  templateUrl: './desired-mod-limit-selection.component.html',
  styleUrls: ['./desired-mod-limit-selection.component.scss']
})
export class DesiredModLimitSelectionComponent implements OnInit {
  readonly ArmorSlot = ArmorSlot;
  constructor() {
  }

  ngOnInit(): void {
  }

}
