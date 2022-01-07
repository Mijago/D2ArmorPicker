import {Component, OnInit} from '@angular/core';
import {ConfigurationService} from "../../../../services/configuration.service";
import {MAXIMUM_STAT_MOD_AMOUNT} from "../../../../data/constants";

@Component({
  selector: 'app-desired-mod-selection',
  templateUrl: './desired-mod-limit-selection.component.html',
  styleUrls: ['./desired-mod-limit-selection.component.scss']
})
export class DesiredModLimitSelectionComponent implements OnInit {

  constructor() {
  }

  ngOnInit(): void {
  }

}
