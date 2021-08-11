import {Component, OnInit} from '@angular/core';
import {ConfigurationService} from "../../../../services/v2/configuration.service";

@Component({
  selector: 'app-advanced-settings',
  templateUrl: './advanced-settings.component.html',
  styleUrls: ['./advanced-settings.component.css']
})
export class AdvancedSettingsComponent implements OnInit {
  fields: { name: string; value: boolean; disabled: boolean; cp: (v: boolean) => void; help: string | undefined }[] = [];

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
            disabled: false,
            help: undefined
          },
          {
            name: "Only use already masterworked items",
            cp: (v: boolean) => this.config.modifyConfiguration(c => c.onlyUseMasterworkedItems = v),
            value: c.onlyUseMasterworkedItems,
            disabled: false,
            help: undefined
          },
          {
            name: "Limit the results table to the first 250.000 results",
            cp: (v: boolean) => this.config.modifyConfiguration(c => c.limitParsedResults = v),
            value: c.limitParsedResults,
            disabled: false,
            help: "Only parse the first 250.000 results. Deactivate this for more accurate results if you need it, but be aware that it may crash your browser."
          },
          {
            name: "Try to optimize wasted stats",
            cp: (v: boolean) => undefined,
            value: false,
            disabled: true,
            help: undefined
          },
          {
            name: "Only show builds with no wasted stats",
            cp: (v: boolean) => undefined,
            value: false,
            disabled: true,
            help: undefined
          }
        ];
      }
    )
  }

}
