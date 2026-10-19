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
import { DestinyClass } from "bungie-api-ts/destiny2";
import {
  BuildConfiguration,
  suggestedConfigurationName,
} from "../../../../data/buildConfiguration";
import { FORCE_USE_ANY_EXOTIC, FORCE_USE_NO_EXOTIC } from "../../../../data/constants";
import { ModInformation } from "../../../../data/ModInformation";
import { ArmorPerkOrSlotNames, ArmorStat, ArmorStatNames } from "../../../../data/enum/armor-stat";
import { SubclassNames } from "../../../../data/enum/modifierType";
import { ItemIconServiceService } from "../../../../services/item-icon-service.service";
import { DatabaseService } from "../../../../services/database.service";
import { LoggingProxyService } from "../../../../services/logging-proxy.service";
import {
  ConfigurationService,
  StoredConfiguration,
} from "../../../../services/configuration.service";
import { UntypedFormBuilder, UntypedFormGroup } from "@angular/forms";
import { MatDialog } from "@angular/material/dialog";
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from "../../components/confirm-dialog/confirm-dialog.component";
import { MatSnackBar } from "@angular/material/snack-bar";
import * as lzutf8 from "lzutf8";
import { Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";
import { Clipboard } from "@angular/cdk/clipboard";

@Component({
  selector: "app-load-and-save-settings",
  templateUrl: "./load-and-save-settings.component.html",
  styleUrls: ["./load-and-save-settings.component.css"],
})
export class LoadAndSaveSettingsComponent implements OnInit, OnDestroy {
  ArmorStat = ArmorStat;
  ArmorStatNames = ArmorStatNames;
  savedConfigurationStats = [
    ArmorStat.StatWeapon,
    ArmorStat.StatHealth,
    ArmorStat.StatClass,
    ArmorStat.StatGrenade,
    ArmorStat.StatSuper,
    ArmorStat.StatMelee,
  ];
  selectedEntry: string = "";
  storedConfigs: StoredConfiguration[] = [];
  private suggestedConfigurationName = "";
  private nameSuggestionRequest = 0;
  private exoticNameLookup = new Map<number, string>();
  private exoticNameLookupRequest = 0;
  private gearsetNameLookup = new Map<number, string>();
  private gearsetLookupRequest = 0;

  settingsNameForm: UntypedFormGroup;
  importTextForm: UntypedFormGroup;

  constructor(
    public config: ConfigurationService,
    private formBuilder: UntypedFormBuilder,
    public dialog: MatDialog,
    private _snackBar: MatSnackBar,
    private clipboard: Clipboard,
    private itemIconService: ItemIconServiceService,
    private database: DatabaseService,
    private logger: LoggingProxyService
  ) {
    this.settingsNameForm = this.formBuilder.group({ name: [null] });
    this.importTextForm = this.formBuilder.group({ content: [null] });
  }

  ngOnInit(): void {
    this.config.storedConfigurations.pipe(takeUntil(this.ngUnsubscribe)).subscribe((d) => {
      this.storedConfigs = d;
      void this.loadExoticNames(d);
      void this.loadGearsetNames(d);
    });
    this.config.configuration
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe((configuration) => void this.updateSuggestedConfigurationName(configuration));
  }

  private async updateSuggestedConfigurationName(configuration: BuildConfiguration): Promise<void> {
    const request = ++this.nameSuggestionRequest;
    const exoticHashes = [...new Set(configuration.selectedExotics.filter((hash) => hash >= 0))];
    const exoticItems = await Promise.all(
      exoticHashes.map((hash) => this.itemIconService.getItemCached(hash).catch(() => undefined))
    );
    if (request !== this.nameSuggestionRequest) return;
    exoticItems.forEach((item, index) => {
      if (item?.name) this.exoticNameLookup.set(exoticHashes[index], item.name);
    });

    const exoticNames = [
      ...new Set(exoticItems.map((item) => item?.name).filter((name): name is string => !!name)),
    ];
    const suggestedName = suggestedConfigurationName(configuration, exoticNames);
    const nameControl = this.settingsNameForm.get("name");
    if (!nameControl?.value || nameControl.value === this.suggestedConfigurationName) {
      nameControl?.setValue(suggestedName);
    }
    this.suggestedConfigurationName = suggestedName;
  }

  private async loadExoticNames(configurations: StoredConfiguration[]): Promise<void> {
    const request = ++this.exoticNameLookupRequest;
    const hashes = [
      ...new Set(
        configurations.flatMap((saved) =>
          saved.configuration.selectedExotics.filter((hash) => hash >= 0)
        )
      ),
    ];
    const entries = await Promise.all(
      hashes.map(async (hash) => {
        const item = await this.itemIconService.getItemCached(hash).catch(() => undefined);
        return [hash, item?.name] as const;
      })
    );
    if (request !== this.exoticNameLookupRequest) return;
    for (const [hash, name] of entries) {
      if (name) this.exoticNameLookup.set(hash, name);
    }
  }

  private async loadGearsetNames(configurations: StoredConfiguration[]): Promise<void> {
    const request = ++this.gearsetLookupRequest;
    const gearsetHashes = [
      ...new Set(
        configurations.flatMap((saved) =>
          saved.configuration.armorRequirements
            .filter((requirement) => "gearSetHash" in requirement)
            .map((requirement) => (requirement as { gearSetHash: number }).gearSetHash)
        )
      ),
    ];
    const entries = await Promise.all(
      gearsetHashes.map(async (hash) => {
        try {
          const gearset = await this.database.equipableItemSetDefinition
            .where("hash")
            .equals(hash)
            .first();
          return [hash, gearset?.displayProperties.name || `Gearset ${hash}`] as const;
        } catch {
          return [hash, `Gearset ${hash}`] as const;
        }
      })
    );
    if (request !== this.gearsetLookupRequest) return;
    for (const [hash, name] of entries) this.gearsetNameLookup.set(hash, name);
  }

  getClassName(configuration: StoredConfiguration["configuration"]): string {
    switch (configuration.characterClass) {
      case DestinyClass.Titan:
        return "Titan";
      case DestinyClass.Hunter:
        return "Hunter";
      case DestinyClass.Warlock:
        return "Warlock";
      default:
        return "Any Class";
    }
  }

  getSubclassName(configuration: StoredConfiguration["configuration"]): string {
    return (
      (SubclassNames as Record<number, string>)[configuration.selectedModElement] || "No subclass"
    );
  }

  getExoticHashes(configuration: StoredConfiguration["configuration"]): number[] {
    const displayedNames = new Set<string>();
    return [...new Set(configuration.selectedExotics.filter((hash) => hash >= 0))].filter(
      (hash) => {
        const name = this.exoticNameLookup.get(hash)?.trim().toLocaleLowerCase();
        if (!name) return true;
        if (displayedNames.has(name)) return false;
        displayedNames.add(name);
        return true;
      }
    );
  }

  getExoticSelectionLabel(configuration: StoredConfiguration["configuration"]): string {
    if (configuration.selectedExotics.includes(FORCE_USE_NO_EXOTIC)) return "No exotic selected";
    if (configuration.selectedExotics.includes(FORCE_USE_ANY_EXOTIC)) return "Any exotic";
    if (configuration.selectedExotics.length === 0) return "No exotic restriction";
    return "Selected exotic(s)";
  }

  getSelectedModsSummary(configuration: StoredConfiguration["configuration"]): string {
    const names = configuration.enabledMods
      .map((mod) => ModInformation[mod]?.name)
      .filter((name): name is string => !!name);
    if (names.length === 0) return "None selected";
    return names.join(", ");
  }

  getArmorRequirementsSummary(configuration: StoredConfiguration["configuration"]): string {
    const gearsetCounts = new Map<number, number>();
    const perkNames: string[] = [];
    for (const requirement of configuration.armorRequirements) {
      if ("gearSetHash" in requirement) {
        gearsetCounts.set(
          requirement.gearSetHash,
          (gearsetCounts.get(requirement.gearSetHash) || 0) + 1
        );
      } else if ("perk" in requirement) {
        perkNames.push(ArmorPerkOrSlotNames[requirement.perk] || "Armor perk");
      }
    }

    const gearsetNames = [...gearsetCounts.entries()].map(([hash, count]) => {
      const pieceCount = count >= 4 ? "4-piece" : `${count}-piece`;
      return `${this.gearsetNameLookup.get(hash) || `Gearset ${hash}`} (${pieceCount})`;
    });
    return [...gearsetNames, ...perkNames].join(", ") || "None";
  }

  submit() {
    const name = this.settingsNameForm.get("name")?.value;
    if (!name) return; // TODO LOG ERROR

    if (this.config.doesSavedConfigurationExist(name)) {
      const dialogRef = this.dialog.open(ConfirmDialogComponent, {
        width: "300px",
        data: {
          description: "Do you want to overwrite this configuration?",
        } as ConfirmDialogData,
      });

      dialogRef.afterClosed().subscribe((result) => {
        if (result) {
          this.config.saveCurrentConfigurationToName(name);
          this.settingsNameForm.reset({ name: this.suggestedConfigurationName });
          this.selectedEntry = name;
        }
      });
    } else {
      this.config.saveCurrentConfigurationToName(name);
      this.settingsNameForm.reset({ name: this.suggestedConfigurationName });
      this.selectedEntry = name;
    }
  }

  delete(element: string) {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: "300px",
      data: { description: "Do you want to delete this configuration?" } as ConfirmDialogData,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) this.config.deleteStoredConfiguration(element);
    });
  }

  clearEverything() {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: "300px",
      data: { description: "Do you want to clear all settings?" } as ConfirmDialogData,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) this.config.resetCurrentConfiguration();
    });
  }

  load(element: string) {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: "300px",
      data: { description: "Do you want to load this preset?" } as ConfirmDialogData,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) this.config.loadSavedConfiguration(element);
    });
  }

  runImport() {
    const content = this.importTextForm.get("content")?.value;
    if (!content) return this.openSnackBar("Invalid input.");
    try {
      const imported = this.parseImportedConfigurations(content);
      this.logger.debug(
        "LoadAndSaveSettingsComponent",
        "runImport",
        "Incoming json: " + JSON.stringify(imported.jsonData)
      );
      for (const entry of imported.configurations) {
        if (entry.isNamedConfiguration && imported.isArray) {
          this.config.saveConfiguration(
            entry.storedConfiguration.name,
            entry.storedConfiguration.configuration
          );
        } else {
          this.config.saveCurrentConfiguration(entry.storedConfiguration.configuration);
        }
      }
      this.openSnackBar("Successfully loaded this configuration");
      this.importTextForm.get("content")?.reset();
    } catch (e) {
      this.openSnackBar("Invalid input.");
      this.logger.error("LoadAndSaveSettingsComponent", "runImport", "Error: " + e);
    }
  }

  runImportAsSaved() {
    const content = this.importTextForm.get("content")?.value;
    if (!content) return this.openSnackBar("Invalid input.");
    try {
      const imported = this.parseImportedConfigurations(content);
      this.logger.debug(
        "LoadAndSaveSettingsComponent",
        "runImportAsSaved",
        "Incoming json: " + JSON.stringify(imported.jsonData)
      );

      const usedNames = new Set(this.storedConfigs.map((configuration) => configuration.name));
      for (const entry of imported.configurations) {
        const preferredName = entry.isNamedConfiguration
          ? entry.storedConfiguration.name
          : "Imported configuration";
        const name = this.getUniqueImportedConfigurationName(preferredName, usedNames);
        this.config.saveConfiguration(name, entry.storedConfiguration.configuration);
      }

      this.openSnackBar(
        `Added ${imported.configurations.length} configuration(s) to saved configurations. Current settings were not changed.`
      );
      this.importTextForm.get("content")?.reset();
    } catch (e) {
      this.openSnackBar("Invalid input.");
      this.logger.error("LoadAndSaveSettingsComponent", "runImportAsSaved", "Error: " + e);
    }
  }

  private parseImportedConfigurations(content: string): {
    isArray: boolean;
    jsonData: any;
    configurations: { storedConfiguration: StoredConfiguration; isNamedConfiguration: boolean }[];
  } {
    const jsonText = lzutf8.decompress(content, { inputEncoding: "Base64" });
    const jsonData = JSON.parse(jsonText);
    const isArray = Array.isArray(jsonData);
    const configurations = (isArray ? jsonData : [jsonData]).map((jsonDatum: any) => {
      const isNamedConfiguration = Object.prototype.hasOwnProperty.call(jsonDatum, "name");
      const storedConfiguration = (
        isNamedConfiguration
          ? jsonDatum
          : { name: "import", version: "1", configuration: jsonDatum }
      ) as StoredConfiguration;
      this.config.checkAndFixOldSavedConfigurations(storedConfiguration);
      return { storedConfiguration, isNamedConfiguration };
    });

    return { isArray, jsonData, configurations };
  }

  private getUniqueImportedConfigurationName(name: string, usedNames: Set<string>): string {
    const baseName = name || "Imported configuration";
    let uniqueName = baseName;
    let suffix = 2;
    while (usedNames.has(uniqueName)) {
      uniqueName = `${baseName} (${suffix})`;
      suffix++;
    }
    usedNames.add(uniqueName);
    return uniqueName;
  }

  copySingleSettingToClipboard(element: any) {
    this.clipboard.copy(this.config.getStoredConfigurationBase64Compressed(element.name));
    this.openSnackBar(
      "Copied the configuration to your clipboard. You can share it with your friends."
    );
  }

  copyAllSettingsToClipboard() {
    this.clipboard.copy(this.config.getAllStoredConfigurationsBase64Compressed());
    this.openSnackBar(
      "Exported all configurations to the clipboard. You can then save and share them."
    );
  }

  openSnackBar(message: string) {
    this._snackBar.open(message, "", {
      duration: 2500,
      politeness: "polite",
    });
  }

  private ngUnsubscribe = new Subject();

  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }
}
