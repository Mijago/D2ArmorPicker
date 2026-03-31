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
  selectedEntry: string = "";
  storedConfigs: StoredConfiguration[] = [];
  displayedColumns = [
    "name",
    "class",
    "mobility",
    "resilience",
    "recovery",
    "discipline",
    "intellect",
    "strength",
    "delete",
  ];

  settingsNameForm: UntypedFormGroup;
  importTextForm: UntypedFormGroup;

  constructor(
    public config: ConfigurationService,
    private formBuilder: UntypedFormBuilder,
    public dialog: MatDialog,
    private _snackBar: MatSnackBar,
    private clipboard: Clipboard,
    private logger: LoggingProxyService
  ) {
    this.settingsNameForm = this.formBuilder.group({ name: [null] });
    this.importTextForm = this.formBuilder.group({ content: [null] });
  }

  ngOnInit(): void {
    this.config.storedConfigurations
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe((d) => (this.storedConfigs = d));
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
          this.settingsNameForm.reset();
          this.selectedEntry = name;
        }
      });
    } else {
      this.config.saveCurrentConfigurationToName(name);
      this.settingsNameForm.reset();
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
      const jsonText = lzutf8.decompress(content, { inputEncoding: "Base64" });
      const isArray = jsonText.substr(0, 1) == "[";
      let jsonData = JSON.parse(jsonText);
      if (!isArray) jsonData = [jsonData];

      this.logger.debug(
        "LoadAndSaveSettingsComponent",
        "runImport",
        "Incoming json: " + JSON.stringify(jsonData)
      );
      for (let jsonDatum of jsonData) {
        this.config.checkAndFixOldSavedConfigurations(jsonDatum);
        if (jsonDatum.hasOwnProperty("name")) {
          if (isArray) this.config.saveConfiguration(jsonDatum.name, jsonDatum.configuration);
          else this.config.saveCurrentConfiguration(jsonDatum.configuration);
        } else {
          this.config.saveCurrentConfiguration(jsonDatum);
        }
      }
      this.openSnackBar("Successfully loaded this configuration");
      this.importTextForm.get("content")?.reset();
    } catch (e) {
      this.openSnackBar("Invalid input.");
      this.logger.error("LoadAndSaveSettingsComponent", "runImport", "Error: " + e);
    }
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
