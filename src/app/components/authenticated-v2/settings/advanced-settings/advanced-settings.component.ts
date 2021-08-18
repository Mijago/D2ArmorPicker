import {Component, OnInit} from '@angular/core';
import {ConfigurationService} from "../../../../services/v2/configuration.service";

interface AdvancedSettingField {
  name: string;
  value: boolean;
  cp: (v: boolean) => void;
  help: string | undefined;
  disabled: boolean;
  endsCategory: boolean;
}

@Component({
  selector: 'app-advanced-settings',
  templateUrl: './advanced-settings.component.html',
  styleUrls: ['./advanced-settings.component.css']
})
export class AdvancedSettingsComponent implements OnInit {
  fields: AdvancedSettingField[] = [];

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
            endsCategory: false,
            help: undefined
          },
          {
            name: "Only use already masterworked items",
            cp: (v: boolean) => this.config.modifyConfiguration(c => c.onlyUseMasterworkedItems = v),
            value: c.onlyUseMasterworkedItems,
            disabled: false,
            endsCategory: true,
            help: undefined
          },
          {
            name: "Ignore armor elemental affinities on masterworked armor",
            cp: (v: boolean) => this.config.modifyConfiguration(c => c.ignoreArmorAffinitiesOnMasterworkedItems = v),
            value: c.ignoreArmorAffinitiesOnMasterworkedItems,
            disabled: false,
            endsCategory: true,
            help: "This tool already ignores the elemental affinity of non-masterworked items. Use this toggle to also ignore the affinity of masterworked items."
          },
          {
            name: "Limit the results table to the first 250.000 results",
            cp: (v: boolean) => this.config.modifyConfiguration(c => c.limitParsedResults = v),
            value: c.limitParsedResults,
            disabled: false,
            endsCategory: true,
            help: "Only parse the first 250.000 results. Deactivate this for more accurate results if you need it, but be aware that it may crash your browser."
          },
          {
            name: "Try to optimize wasted stats",
            cp: (v: boolean) => this.config.modifyConfiguration(c => c.tryLimitWastedStats = v),
            value: c.tryLimitWastedStats,
            disabled: false,
            endsCategory: false,
            help: undefined
          },
          {
            name: "Only show builds with no wasted stats",
            cp: (v: boolean) => this.config.modifyConfiguration(c => c.onlyShowResultsWithNoWastedStats = v),
            value: c.tryLimitWastedStats && c.onlyShowResultsWithNoWastedStats,
            disabled: !c.tryLimitWastedStats,
            endsCategory: true,
            help: undefined
          }
        ];
      }
    )
  }

}
