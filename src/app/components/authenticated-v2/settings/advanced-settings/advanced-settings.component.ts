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

import { Component, Input, OnDestroy, OnInit, ChangeDetectionStrategy } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { ConfigurationService } from "../../../../services/configuration.service";
import { Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";
import { BuildConfiguration } from "../../../../data/buildConfiguration";
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from "../../components/confirm-dialog/confirm-dialog.component";

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

interface InventorySetting {
  key: keyof Pick<
    BuildConfiguration,
    | "enforceFeaturedLegendaryArmor"
    | "enforceFeaturedExoticArmor"
    | "includeCollectionRolls"
    | "includeVendorRolls"
    | "allowLegacyLegendaryArmor"
    | "allowLegacyExoticArmor"
    | "allowBlueArmorPieces"
    | "ignoreSunsetArmor"
  >;
  name: string;
  legacy?: boolean;
  inverse?: boolean;
}

const inventorySettings: InventorySetting[] = [
  {
    key: "allowLegacyLegendaryArmor",
    name: "Include legacy (Armor 2.0) legendary armor",
    legacy: true,
  },
  { key: "allowLegacyExoticArmor", name: "Include legacy (Armor 2.0) exotic armor", legacy: true },
  { key: "allowBlueArmorPieces", name: "Include white, blue and green items", legacy: true },
  { key: "ignoreSunsetArmor", name: "Include sunset armor", inverse: true },
  { key: "includeCollectionRolls", name: "Include exotic collection rolls" },
  { key: "includeVendorRolls", name: "Include legendary and exotic vendor armor (slower)" },
  // { key: "enforceFeaturedLegendaryArmor", name: "Enforce featured legendary armor only" },
  // { key: "enforceFeaturedExoticArmor", name: "Enforce featured exotic armor only" },
];

@Component({
  selector: "app-advanced-settings",
  templateUrl: "./advanced-settings.component.html",
  styleUrls: ["./advanced-settings.component.scss"],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class AdvancedSettingsComponent implements OnInit, OnDestroy {
  @Input() section: "advanced" | "performance" = "advanced";
  fields2: { [id: string]: AdvancedSettingField[] } = {};
  fieldKeys: string[] = [];

  constructor(
    private config: ConfigurationService,
    private dialog: MatDialog
  ) {}

  resetAdvancedSettings(): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: "320px",
      data: {
        description:
          this.section === "performance"
            ? "Reset Calculation Performance & Results to its default values?"
            : "Reset Build Constraints & Assumptions to their default values?",
      } as ConfirmDialogData,
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;

      const defaults = BuildConfiguration.buildEmptyConfiguration();
      this.config.modifyConfiguration((configuration) => {
        if (this.section === "performance") {
          configuration.calculateTierFiveTuning = defaults.calculateTierFiveTuning;
          configuration.foldSameStatDifferentGearSets = defaults.foldSameStatDifferentGearSets;
          configuration.parsedResultLimit = defaults.parsedResultLimit;
          return;
        }
        for (const field of inventorySettings) {
          if (!field.legacy || !this.config.isTheorizer)
            configuration[field.key] = defaults[field.key];
        }
        configuration.assumeLegendariesMasterworked = defaults.assumeLegendariesMasterworked;
        configuration.assumeExoticsMasterworked = defaults.assumeExoticsMasterworked;
        configuration.onlyUseMasterworkedExotics = defaults.onlyUseMasterworkedExotics;
        configuration.onlyUseMasterworkedLegendaries = defaults.onlyUseMasterworkedLegendaries;
        configuration.assumeClassItemIsArtifice = defaults.assumeClassItemIsArtifice;
        configuration.assumeEveryLegendaryIsArtifice = defaults.assumeEveryLegendaryIsArtifice;
        configuration.assumeEveryExoticIsArtifice = defaults.assumeEveryExoticIsArtifice;
        configuration.addConstent1Health = defaults.addConstent1Health;
      });
    });
  }

  ngOnInit(): void {
    this.config.configuration.pipe(takeUntil(this.ngUnsubscribe)).subscribe((c) => {
      this.fields2 = {
        Inventory: inventorySettings
          .filter((field) => !field.legacy || !this.config.isTheorizer)
          .map(
            (field): BooleanSettingField => ({
              name: field.name,
              description: field.name,
              help: undefined,
              type: "boolean",
              disabled: false,
              impactsResultCount: true,
              value: field.inverse ? !c[field.key] : c[field.key],
              onToggle: (value: boolean) =>
                this.config.modifyConfiguration((configuration) => {
                  configuration[field.key] = field.inverse ? !value : value;
                }),
            })
          ),
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
        "Calculation Performance & Results": [
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
      };
      this.fieldKeys = Object.keys(this.fields2).filter(
        (key) =>
          (this.section === "performance"
            ? key === "Calculation Performance & Results" && !this.config.isTheorizer
            : key !== "Calculation Performance & Results") &&
          (!this.config.isTheorizer || key !== "Data-Science") &&
          (!this.config.isTheorizer || key !== "Artifice Slots (for legacy armor 2.0)")
      );
    });
  }

  private ngUnsubscribe = new Subject();

  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }
}
