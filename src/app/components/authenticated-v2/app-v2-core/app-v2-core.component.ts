import {Component} from '@angular/core';
import {StatusProviderService} from "../../../services/status-provider.service";

@Component({
  selector: 'app-app-v2-core',
  templateUrl: './app-v2-core.component.html',
  styleUrls: ['./app-v2-core.component.css']
})
export class AppV2CoreComponent {


  constructor(public status: StatusProviderService) {
  }

}
