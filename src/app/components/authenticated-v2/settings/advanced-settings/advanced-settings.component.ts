import {Component, OnInit} from '@angular/core';
import {ConfigurationService} from "../../../../services/v2/configuration.service";

interface AdvancedSettingField {
  name: string;
  value: boolean;
  cp: (v: boolean) => void;
  help: string | undefined;
  disabled: boolean;
  impactsResultCount: boolean;
}

@Component({
  selector: 'app-advanced-settings',
  templateUrl: './advanced-settings.component.html',
  styleUrls: ['./advanced-settings.component.scss']
})
export class AdvancedSettingsComponent implements OnInit {
  fields2: { [id: string]: AdvancedSettingField[]; } = {};
  fieldKeys: string[] = []

  constructor(private config: ConfigurationService) {
  }

  ngOnInit(): void {
    this.config.configuration.subscribe(
      c => {
        this.fields2 = {
          "Masterwork": [
            {
              name: "Assume all items are masterworked",
              cp: (v: boolean) => this.config.modifyConfiguration(c => c.assumeMasterworked = v),
              value: c.assumeMasterworked,
              disabled: false,
              impactsResultCount: false,
              help: undefined
            },
            {
              name: "Only use already masterworked items",
              cp: (v: boolean) => this.config.modifyConfiguration(c => c.onlyUseMasterworkedItems = v),
              value: c.onlyUseMasterworkedItems,
              disabled: false,
              impactsResultCount: true,
              help: undefined
            },
          ],
          "Elemental Armor Affinity": [
            {
              name: "Ignore armor elemental affinities on masterworked armor",
              cp: (v: boolean) => this.config.modifyConfiguration(c => c.ignoreArmorAffinitiesOnMasterworkedItems = v),
              value: c.ignoreArmorAffinitiesOnMasterworkedItems,
              disabled: false,
              impactsResultCount: true,
              help: "This tool already ignores the elemental affinity of non-masterworked items. Use this toggle to also ignore the affinity of masterworked items."
            },
          ],
          "Performance Optimization": [
            {
              name: "Limit the results table to the first 250,000 results",
              cp: (v: boolean) => this.config.modifyConfiguration(c => c.limitParsedResults = v),
              value: c.limitParsedResults,
              disabled: false,
              impactsResultCount: true,
              help: "Only parse the first 250,000 results. Deactivate this for more accurate results if you need it, but be aware that it may crash your browser."
            },
          ],
          "Wasted Stats": [
            {
              name: "Try to optimize wasted stats",
              cp: (v: boolean) => this.config.modifyConfiguration(c => c.tryLimitWastedStats = v),
              value: c.tryLimitWastedStats,
              disabled: false,
              impactsResultCount: false,
              help: "The tool will try to add minor stat mods to minimize wasted stats. This only works for permutations that fulfill your desired stat combination with enough mods so at least one mod slot is still open."
            },
            {
              name: "Only show builds with no wasted stats",
              cp: (v: boolean) => this.config.modifyConfiguration(c => c.onlyShowResultsWithNoWastedStats = v),
              value: c.tryLimitWastedStats && c.onlyShowResultsWithNoWastedStats,
              disabled: !c.tryLimitWastedStats,
              impactsResultCount: true,
              help: "Only show builds with zero wasted stats - this means, its highly likely that you won't get any results."
            }
          ]
        }
        this.fieldKeys = Object.keys(this.fields2)
      }
    )
  }

}
