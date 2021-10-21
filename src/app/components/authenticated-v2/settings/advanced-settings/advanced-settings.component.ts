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
          "Events": [
            {
              name: "Only use the (current) Halloween Festival Mask as helmet.",
              cp: (v: boolean) => this.config.modifyConfiguration(c => c.eventHalloweenOnlyUseMask = v),
              value: c.eventHalloweenOnlyUseMask,
              disabled: false,
              impactsResultCount: true,
              help: undefined
            },
          ],
          "Masterwork": [
            {
              name: "Assume all legendary items are masterworked",
              cp: (v: boolean) => this.config.modifyConfiguration(c => c.assumeLegendariesMasterworked = v),
              value: c.assumeLegendariesMasterworked,
              disabled: false,
              impactsResultCount: false,
              help: undefined
            },
            {
              name: "Assume all exotic items are masterworked",
              cp: (v: boolean) => this.config.modifyConfiguration(c => c.assumeExoticsMasterworked = v),
              value: c.assumeExoticsMasterworked,
              disabled: false,
              impactsResultCount: false,
              help: "If this setting is enabled, the tool will treat non-masterworked exotic armor as if it were masterworked-."
            },
            {
              name: "Assume that class items are masterworked",
              cp: (v: boolean) => this.config.modifyConfiguration(c => c.assumeClassItemMasterworked = v),
              value: c.assumeClassItemMasterworked,
              disabled: false,
              impactsResultCount: false,
              help: "If this setting is enabled, a plain +2 is added to every stat. This means that your Class Item must be masterworked."
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
              name: "Limit the results table to the first 50,000 results",
              cp: (v: boolean) => this.config.modifyConfiguration(c => c.limitParsedResults = v),
              value: c.limitParsedResults,
              disabled: false,
              impactsResultCount: true,
              help: "Only parse the first 50,000 results. Deactivate this for more accurate results if you need it, but be aware that it may crash your browser."
            },
          ],
          "Wasted Stats": [
            {
              name: "Show the wasted stats in an extra column.",
              cp: (v: boolean) => this.config.modifyConfiguration(c => c.showWastedStatsColumn = v),
              value: c.showWastedStatsColumn,
              disabled: false,
              impactsResultCount: false,
              help: "Shows an additional column in the table that shows how many stats are wasted in a build."
            },
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
            },
          ]
        }
        this.fieldKeys = Object.keys(this.fields2)
      }
    )
  }

}
