import {Component, OnInit} from '@angular/core';
import {ConfigurationService} from "../../../services/v2/configuration.service";
import {StatusProviderService} from "../../../services/v2/status-provider.service";

@Component({
  selector: 'app-app-v2-core',
  templateUrl: './app-v2-core.component.html',
  styleUrls: ['./app-v2-core.component.css']
})
export class AppV2CoreComponent implements OnInit {


  constructor(private config: ConfigurationService, public status: StatusProviderService) {
  }


  ngOnInit(): void {
  }

}
