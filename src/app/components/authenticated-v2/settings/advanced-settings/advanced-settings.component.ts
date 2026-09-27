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
// import { environment } from "../../../../../environments/environment";
import { EventArmorType } from "../../../../data/enum/event-armor-type";

interface AdvancedSettingFieldBase {
  name: string;
  description: string;
  help: string | undefined;
  disabled: boolean;
  impactsResultCount: boolean;
}

interface BooleanSettingField extends AdvancedSettingFieldBase {
  type: "boolean";
  value: boolean;
  onToggle: (v: boolean) => void;
}

interface DropdownSettingField extends AdvancedSettingFieldBase {
  type: "dropdown";
  value: any;
  onSelect: (v: any) => void;
  options: { value: any; label: string }[];
  isEnabled?: boolean;
}

interface SliderSettingField extends AdvancedSettingFieldBase {
  type: "slider";
  value: number;
  min: number;
  max: number;
  step: number;
  displayWith: (value: number) => string;
  onChange: (value: number) => void;
}

type AdvancedSettingField = BooleanSettingField | DropdownSettingField | SliderSettingField;

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
            name: "Use Event armor",
            description: "Select event",
            type: "dropdown",
            value: c.useEventArmor,
            onSelect: (v: EventArmorType) =>
              this.config.modifyConfiguration((config) => (config.useEventArmor = v)),
            options: [
              { value: EventArmorType.None, label: "None" },
              { value: EventArmorType.FestivalOfTheLost, label: "Festival of the Lost" },
              { value: EventArmorType.GuardianGames, label: "Guardian Games" },
            ],
            disabled: false,
            impactsResultCount: true,
            help: "Restrict builds to specific event armor where supported.",
          },
        ],
        Masterwork: [
          {
            name: "Assume all legendary items are masterworked",
            type: "boolean",
            description: "Assume all legendary items are masterworked.",
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
            description: "Assume all exotic items are masterworked.",
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
            description: "Only use already masterworked exotic items.",
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
            description: "Only use already masterworked legendary items.",
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
            description: "Assume every legacy legendary class item is an artifice armor.",
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
            description: "Assume every legacy legendary is an artifice armor.",
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
            description: "Assume every legacy exotic has an artifice slot.",
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
            description: "Use Tier 5 tuning for armor pieces.",
          },
          {
            name: "Fold same-stat armor with different gear sets",
            type: "boolean",
            onToggle: (v: boolean) =>
              this.config.modifyConfiguration((c) => (c.foldSameStatDifferentGearSets = v)),
            value: c.foldSameStatDifferentGearSets,
            disabled: false,
            impactsResultCount: true,
            help: "When enabled, items with the exact same stat profile are folded together even if they belong to different gear sets. Explicitly selected gear sets still remain distinct.",
            description: "Fold same-stat armor pieces across different gear sets.",
          },
          {
            name: "Maximum results (Unlimited resets to default on reload)",
            type: "slider",
            value: c.parsedResultLimit === 0 ? 11 : c.parsedResultLimit / 10_000,
            min: 1,
            max: 11,
            step: 1,
            displayWith: (value: number) => (value === 11 ? "Unlimited" : `${value * 10}K`),
            onChange: (value: number) =>
              this.config.modifyConfiguration(
                (config) => (config.parsedResultLimit = value === 11 ? 0 : value * 10_000)
              ),
            disabled: false,
            impactsResultCount: true,
            help: "Limits how many results are retained to reduce calculation time and prevent Out-Of-Memory crashes. Unlimited may crash your browser. You will not miss the most significant results with a set limit.",
            description: "Maximum number of results retained.",
          },
          //   {
          //     name: "High-Speed mode: Only check one class item for each permutation",
          //     type: "boolean",
          //     onToggle: (v: boolean) =>
          //       this.config.modifyConfiguration((c) => (c.earlyAbortClassItems = v)),
          //     value: c.earlyAbortClassItems,
          //     disabled: false,
          //     impactsResultCount: true,
          //     help: "This will speed up the calculation by compressing the number of class items checked for each permutation.",
          //     description: "High-Speed mode: Only check one class item for each permutation",
          //   },
        ],
        // "Wasted Stats": [
        //   {
        //     name: "Try to optimize wasted stats (slower)",
        //     type: "boolean",
        //     onToggle: (v: boolean) =>
        //       this.config.modifyConfiguration((c) => (c.tryLimitWastedStats = v)),
        //     value: c.tryLimitWastedStats,
        //     disabled: false,
        //     impactsResultCount: false,
        //     help: "The tool will try to add minor stat mods to minimize wasted stats. This only works for combinations that fulfill your desired stat combination with enough mods so at least one mod slot is still open.",
        //     description: "Try to optimize wasted stats (slower)",
        //   },
        //   {
        //     name: "Only show builds with no wasted stats",
        //     type: "boolean",
        //     onToggle: (v: boolean) =>
        //       this.config.modifyConfiguration((c) => (c.onlyShowResultsWithNoWastedStats = v)),
        //     value: environment.featureFlags.enableZeroWaste && c.onlyShowResultsWithNoWastedStats,
        //     disabled: !environment.featureFlags.enableZeroWaste,
        //     impactsResultCount: true,
        //     help: "Only show builds with zero wasted stats - this means, its highly likely that you won't get any results.",
        //     description: "Only show builds with no wasted stats",
        //   },
        // ],
        "Data-Science": [
          {
            name: "Add a constant +1 resilience to the results with non-exotic chests (resets on reload).",
            type: "boolean",
            onToggle: (v: boolean) =>
              this.config.modifyConfiguration((c) => (c.addConstent1Health = v)),
            value: c.addConstent1Health,
            disabled: false,
            impactsResultCount: false,
            description:
              "Add a constant +1 resilience to the results with non-exotic chests (resets on reload).",
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
