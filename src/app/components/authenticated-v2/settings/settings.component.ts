import {Component, Input, OnInit} from '@angular/core';
import {Configuration} from "../../../data/configuration";
import {ConfigurationService} from "../../../services/v2/configuration.service";

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css']
})
export class SettingsComponent implements OnInit {

  constructor(private config: ConfigurationService) {
  }

  ngOnInit(): void {

  }

}
