import {Component, OnDestroy, OnInit} from '@angular/core';
import {ConfigurationService} from "../../../../services/configuration.service";
import {Subject} from "rxjs";
import {takeUntil} from "rxjs/operators";
import {environment} from "../../../../../environments/environment";

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
export class AdvancedSettingsComponent implements OnInit, OnDestroy {
  fields2: { [id: string]: AdvancedSettingField[]; } = {};
  fieldKeys: string[] = []

  constructor(private config: ConfigurationService) {
  }

  ngOnInit(): void {
    this.config.configuration
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe(
      c => {
        this.fields2 = {
          "Events": [
            {
              name: "Enforce the usage of a Festival of the Lost Mask.",
              cp: (v: boolean) => this.config.modifyConfiguration(c => c.useFotlArmor = v),
              value: c.useFotlArmor,
              disabled: false,
              impactsResultCount: true,
              help: "Only use a FotL masks. You will not get results if you do not own the mask."
            },
          ],
          "Armor selection": [
            {
              name: "Allow the usage of armor that is not exotic or legendary.",
              cp: (v: boolean) => this.config.modifyConfiguration(c => c.allowBlueArmorPieces = v),
              value: c.allowBlueArmorPieces,
              disabled: false,
              impactsResultCount: false,
              help: "This setting allows the tool to use white, green and blue armor pieces."
            },
            {
              name: "Ignore sunset armor.",
              cp: (v: boolean) => this.config.modifyConfiguration(c => c.ignoreSunsetArmor = v),
              value: c.ignoreSunsetArmor,
              disabled: false,
              impactsResultCount: false,
              help: "Ignore sunset armor in the results."
            }
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
          "Performance Optimization": [
            {
              name: "Use security features to prevent app crashes (resets on reload).",
              cp: (v: boolean) => this.config.modifyConfiguration(c => c.limitParsedResults = v),
              value: c.limitParsedResults,
              disabled: false,
              impactsResultCount: true,
              help: "Only parse the first 30,000 results. Deactivating this may crash your browser. The results will still be limited to 1,000,000 entries. Note that you will not miss any significant results by leaving this enabled."
            },
          ],
          "Extra Columns": [
            {
              name: "Show maximum reachable tiers in the Tiers-Column instead of real Tiers.",
              cp: (v: boolean) => this.config.modifyConfiguration(c => c.showPotentialTierColumn = v),
              value: c.showPotentialTierColumn,
              disabled: false,
              impactsResultCount: false,
              help: "Shows an additional column in the table that shows how many tiers this build would have, if all stat mods were used. This is important when builds do not use all 5 stat mods."
            },
            {
              name: "Show the wasted stats in an extra column.",
              cp: (v: boolean) => this.config.modifyConfiguration(c => c.showWastedStatsColumn = v),
              value: c.showWastedStatsColumn,
              disabled: false,
              impactsResultCount: false,
              help: "Shows an additional column in the table that shows how many stats are wasted in a build."
            },
          ],
          "Wasted Stats": [
            {
              name: "Try to optimize wasted stats",
              cp: (v: boolean) => this.config.modifyConfiguration(c => c.tryLimitWastedStats = v),
              value: c.tryLimitWastedStats,
              disabled: false,
              impactsResultCount: false,
              help: "The tool will try to add minor stat mods to minimize wasted stats. This only works for combinations that fulfill your desired stat combination with enough mods so at least one mod slot is still open."
            },
            {
              name: "Only show builds with no wasted stats",
              cp: (v: boolean) => this.config.modifyConfiguration(c => c.onlyShowResultsWithNoWastedStats = v),
              value: environment.featureFlags.enableZeroWaste && c.tryLimitWastedStats && c.onlyShowResultsWithNoWastedStats,
              disabled: !c.tryLimitWastedStats || !environment.featureFlags.enableZeroWaste,
              impactsResultCount: true,
              help: "Only show builds with zero wasted stats - this means, its highly likely that you won't get any results."
            },
          ],
          "Data-Science": [
            {
              name: "Add a constant +1 resilience to the results with non-exotic chests. For.. reasons..",
              cp: (v: boolean) => this.config.modifyConfiguration(c => c.addConstent1Resilience = v),
              value: c.addConstent1Resilience,
              disabled: false,
              impactsResultCount: false,
              help: "You usually do not want to use this."
            },
            {
              name: "Assume every legendary is an artifice armor.",
              cp: (v: boolean) => this.config.modifyConfiguration(c => c.assumeEveryLegendaryIsArtifice = v),
              value: c.assumeEveryLegendaryIsArtifice,
              disabled: false,
              impactsResultCount: true,
              help: "This is for debugging purposes. Do not complain if you enable this. Reload after changing this setting."
            },

          ]
        }
        this.fieldKeys = Object.keys(this.fields2)
      }
    )
  }

  private ngUnsubscribe = new Subject();

  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }
}
