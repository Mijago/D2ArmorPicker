import {Component, OnInit} from '@angular/core';
import {ConfigurationService} from "../../../../services/v2/configuration.service";

@Component({
  selector: 'app-advanced-settings',
  templateUrl: './advanced-settings.component.html',
  styleUrls: ['./advanced-settings.component.css']
})
export class AdvancedSettingsComponent implements OnInit {
  fields: { name: string; value: boolean; disabled: boolean; cp: (v: boolean) => void }[] = [];

  constructor(private config: ConfigurationService) {
  }

  ngOnInit(): void {
    this.config.configuration.subscribe(
      c => {
        this.fields = [
          {
            name: "Assume all items are masterworked",
            cp: (v: boolean) => this.config.modifyConfiguration(c => c.assumeMasterworked = v),
            value: c.assumeMasterworked,
            disabled: false
          },
          {
            name: "Only use already masterworked items",
            cp: (v: boolean) => this.config.modifyConfiguration(c => c.onlyUseMasterworkedItems = v),
            value: c.onlyUseMasterworkedItems,
            disabled: true
          }
        ];
      }
    )
  }

}
