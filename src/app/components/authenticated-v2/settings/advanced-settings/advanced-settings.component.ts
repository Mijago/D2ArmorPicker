/*
 * Copyright (c) 2023 D2ArmorPicker by Mijago.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import { Component, OnDestroy, OnInit } from "@angular/core";
import { ConfigurationService } from "../../../../services/configuration.service";
import { Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";
import { environment } from "../../../../../environments/environment";

interface AdvancedSettingFieldBase {
  name: string;
  help: string | undefined;
  disabled: boolean;
  impactsResultCount: boolean;
  onToggle: (v: boolean) => void;
}

interface BooleanSettingField extends AdvancedSettingFieldBase {
  type: "boolean";
  value: boolean;
}

interface DropdownSettingField extends AdvancedSettingFieldBase {
  type: "dropdown";
  value: any;
  onSelect: (v: any) => void;
  options: { value: any; label: string }[];
  isEnabled: boolean;
}

type AdvancedSettingField = BooleanSettingField | DropdownSettingField;

@Component({
  selector: "app-advanced-settings",
  templateUrl: "./advanced-settings.component.html",
  styleUrls: ["./advanced-settings.component.scss"],
})
export class AdvancedSettingsComponent implements OnInit, OnDestroy {
  fields2: { [id: string]: AdvancedSettingField[] } = {};
  fieldKeys: string[] = [];

  constructor(private config: ConfigurationService) {}

  ngOnInit(): void {
    this.config.configuration.pipe(takeUntil(this.ngUnsubscribe)).subscribe((c) => {
      this.fields2 = {
        Events: [
          {
            name: "Enforce the usage of a Festival of the Lost Mask.",
            type: "boolean",
            onToggle: (v: boolean) => this.config.modifyConfiguration((c) => (c.useFotlArmor = v)),
            value: c.useFotlArmor,
            disabled: false,
            impactsResultCount: true,
            help: "Only use a FotL masks. You will not get results if you do not own the mask.",
          },
        ],
        Masterwork: [
          {
            name: "Assume all legendary items are masterworked",
            type: "boolean",
            onToggle: (v: boolean) =>
              this.config.modifyConfiguration((c) => (c.assumeLegendariesMasterworked = v)),
            value: c.assumeLegendariesMasterworked,
            disabled: false,
            impactsResultCount: false,
            help: undefined,
          },
          {
            name: "Assume all exotic items are masterworked",
            type: "boolean",
            onToggle: (v: boolean) =>
              this.config.modifyConfiguration((c) => (c.assumeExoticsMasterworked = v)),
            value: c.assumeExoticsMasterworked,
            disabled: false,
            impactsResultCount: false,
            help: "If this setting is enabled, the tool will treat non-masterworked exotic armor as if it were masterworked-.",
          },
          {
            name: "Only use already masterworked exotic items",
            type: "boolean",
            onToggle: (v: boolean) =>
              this.config.modifyConfiguration((c) => (c.onlyUseMasterworkedExotics = v)),
            value: c.onlyUseMasterworkedExotics,
            disabled: false,
            impactsResultCount: true,
            help: undefined,
          },
          {
            name: "Only use already masterworked legendary items",
            type: "boolean",
            onToggle: (v: boolean) =>
              this.config.modifyConfiguration((c) => (c.onlyUseMasterworkedLegendaries = v)),
            value: c.onlyUseMasterworkedLegendaries,
            disabled: false,
            impactsResultCount: true,
            help: undefined,
          },
        ],
        "Artifice Slots (for legacy armor 2.0)": [
          {
            name: "Assume every legacy legendary class item is an artifice armor.",
            type: "boolean",
            onToggle: (v: boolean) =>
              this.config.modifyConfiguration((c) => (c.assumeClassItemIsArtifice = v)),
            value: c.assumeClassItemIsArtifice || c.assumeEveryLegendaryIsArtifice,
            disabled: c.assumeEveryLegendaryIsArtifice || !c.allowLegacyLegendaryArmor,
            impactsResultCount: true,
            help: "This is for debugging purposes. No support if you enable this.",
          },
          {
            name: "Assume every legacy legendary is an artifice armor.",
            type: "boolean",
            onToggle: (v: boolean) =>
              this.config.modifyConfiguration((c) => (c.assumeEveryLegendaryIsArtifice = v)),
            value: c.assumeEveryLegendaryIsArtifice,
            disabled: !c.allowLegacyLegendaryArmor,
            impactsResultCount: true,
            help: "This is for debugging purposes. No support if you enable this.",
          },
          {
            name: "Assume every legacy exotic has an artifice slot.",
            type: "boolean",
            onToggle: (v: boolean) =>
              this.config.modifyConfiguration((c) => (c.assumeEveryExoticIsArtifice = v)),
            value: c.assumeEveryExoticIsArtifice,
            disabled: !c.allowLegacyExoticArmor,
            impactsResultCount: true,
            help: "Preparation for the upcoming Artifice Mod Slot for exotics.",
          },
        ],
        "Performance Optimization": [
          {
            name: "Use Tier 5 tuning for armor pieces.",
            type: "boolean",
            onToggle: (v: boolean) =>
              this.config.modifyConfiguration((c) => (c.calculateTierFiveTuning = v)),
            value: c.calculateTierFiveTuning,
            disabled: false,
            impactsResultCount: true,
            help: "Calculate the Tier 5 tuning for armor pieces. This may lead to longer calculation times.",
          },
          {
            name: "Use security features to prevent app crashes (resets on reload).",
            type: "boolean",
            onToggle: (v: boolean) =>
              this.config.modifyConfiguration((c) => (c.limitParsedResults = v)),
            value: c.limitParsedResults,
            disabled: false,
            impactsResultCount: true,
            help: "Only parse the first 30,000 results. Deactivating this may crash your browser. The results will still be limited to 1,000,000 entries. Note that you will not miss any significant results by leaving this enabled.",
          },
          {
            name: "High-Speed mode: Only check one class item for each permutation",
            type: "boolean",
            onToggle: (v: boolean) =>
              this.config.modifyConfiguration((c) => (c.earlyAbortClassItems = v)),
            value: c.earlyAbortClassItems,
            disabled: false,
            impactsResultCount: true,
            help: "This will speed up the calculation by aborting early if no valid class item is found for a permutation.",
          },
        ],
        "Wasted Stats": [
          {
            name: "Try to optimize wasted stats (slower)",
            type: "boolean",
            onToggle: (v: boolean) =>
              this.config.modifyConfiguration((c) => (c.tryLimitWastedStats = v)),
            value: c.tryLimitWastedStats,
            disabled: false,
            impactsResultCount: false,
            help: "The tool will try to add minor stat mods to minimize wasted stats. This only works for combinations that fulfill your desired stat combination with enough mods so at least one mod slot is still open.",
          },
          {
            name: "Only show builds with no wasted stats",
            type: "boolean",
            onToggle: (v: boolean) =>
              this.config.modifyConfiguration((c) => (c.onlyShowResultsWithNoWastedStats = v)),
            value: environment.featureFlags.enableZeroWaste && c.onlyShowResultsWithNoWastedStats,
            disabled: !environment.featureFlags.enableZeroWaste,
            impactsResultCount: true,
            help: "Only show builds with zero wasted stats - this means, its highly likely that you won't get any results.",
          },
        ],
        "Data-Science": [
          {
            name: "Add a constant +1 resilience to the results with non-exotic chests (resets on reload).",
            type: "boolean",
            onToggle: (v: boolean) =>
              this.config.modifyConfiguration((c) => (c.addConstent1Health = v)),
            value: c.addConstent1Health,
            disabled: false,
            impactsResultCount: false,
            help: "You usually do not want to use this.",
          },
          /*
          {
            name: "Assume the player has all Tier X class items.",
            type: 'dropdown',
            onSelect: (v: number) => {
              this.config.modifyConfiguration((config) => (config.assumePlayerHasAllMaxClassItemsForTier = v));
            },
            value: 'option1',
            disabled: false,
            impactsResultCount: true,
            help: "The tool will assume that the player has all class items of a certain tier. This is useful for testing purposes.",
            isEnabled: c.assumePlayerHasAllMaxClassItemsForTierEnabled,
            onToggle: (v: boolean) => {
              this.config.modifyConfiguration((config) => (config.assumePlayerHasAllMaxClassItemsForTierEnabled = v));
            },
            options: [
              { value: 1, label: 'Tier 1' },
              { value: 2, label: 'Tier 2' },
              { value: 3, label: 'Tier 3' },
              { value: 4, label: 'Tier 4' },
              { value: 5, label: 'Tier 5' },
            ]
          },
          //*/
        ],
      };
      this.fieldKeys = Object.keys(this.fields2);
    });
  }

  private ngUnsubscribe = new Subject();

  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }
}
