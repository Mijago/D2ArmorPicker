import {AfterViewInit, Component} from '@angular/core';
import {StatusProviderService} from "../../../services/v2/status-provider.service";
import {InventoryService} from "../../../services/v2/inventory.service";

@Component({
  selector: 'app-app-v2-core',
  templateUrl: './app-v2-core.component.html',
  styleUrls: ['./app-v2-core.component.css']
})
export class AppV2CoreComponent {


  constructor(public status: StatusProviderService) {
  }

}
