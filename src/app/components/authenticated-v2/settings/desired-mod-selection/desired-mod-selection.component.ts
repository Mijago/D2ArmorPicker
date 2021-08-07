import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {ConfigurationService} from "../../../../services/v2/configuration.service";
import {MAXIMUM_STAT_MOD_AMOUNT} from "../../../../data/constants";

@Component({
  selector: 'app-desired-mod-selection',
  templateUrl: './desired-mod-selection.component.html',
  styleUrls: ['./desired-mod-selection.component.scss']
})
export class DesiredModSelectionComponent implements OnInit {
  readonly ModRange = new Array(MAXIMUM_STAT_MOD_AMOUNT + 1);
  selection: number = MAXIMUM_STAT_MOD_AMOUNT;

  constructor(public config: ConfigurationService) {
  }

  ngOnInit(): void {
    this.config.configuration.subscribe(c => this.selection = c.maximumStatMods)
  }

  setValue(i: number) {
    this.selection = i;
    this.config.modifyConfiguration(c => c.maximumStatMods = i);
  }
}
