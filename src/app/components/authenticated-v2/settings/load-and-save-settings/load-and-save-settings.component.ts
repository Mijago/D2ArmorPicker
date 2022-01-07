import {Component, OnInit} from '@angular/core';
import {ConfigurationService, StoredConfiguration} from "../../../../services/configuration.service";
import {FormBuilder, FormGroup} from "@angular/forms";
import {MatDialog} from "@angular/material/dialog";
import {ConfirmDialogComponent, ConfirmDialogData} from "../../components/confirm-dialog/confirm-dialog.component";
import {MatSnackBar} from "@angular/material/snack-bar";
import * as lzutf8 from "lzutf8";

@Component({
  selector: 'app-load-and-save-settings',
  templateUrl: './load-and-save-settings.component.html',
  styleUrls: ['./load-and-save-settings.component.css']
})
export class LoadAndSaveSettingsComponent implements OnInit {
  selectedEntry: string = "";
  storedConfigs: StoredConfiguration[] = [];
  displayedColumns = ["name", "class", "mobility", "resilience", "recovery", "discipline", "intellect", "strength", "delete"];

  settingsNameForm: FormGroup;
  importTextForm: FormGroup;

  constructor(public config: ConfigurationService, private formBuilder: FormBuilder,
              public dialog: MatDialog, private _snackBar: MatSnackBar) {
    this.settingsNameForm = this.formBuilder.group({name: [null,]});
    this.importTextForm = this.formBuilder.group({content: [null,]});
  }

  ngOnInit(): void {
    this.config.storedConfigurations.subscribe(d => this.storedConfigs = d)
  }

  submit() {
    const name = this.settingsNameForm.get("name")?.value;
    if (!name) return; // TODO LOG ERROR

    if (this.config.doesSavedConfigurationExist(name)) {
      const dialogRef = this.dialog.open(ConfirmDialogComponent, {
        width: '300px',
        data: {description: "Do you want to overwrite this configuration?"} as ConfirmDialogData
      });

      dialogRef.afterClosed().subscribe(result => {
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
      width: '300px',
      data: {description: "Do you want to delete this configuration?"} as ConfirmDialogData
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) this.config.deleteStoredConfiguration(element);
    });
  }

  clearEverything() {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '300px',
      data: {description: "Do you want to clear all settings?"} as ConfirmDialogData
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) this.config.resetCurrentConfiguration()
    });
  }

  load(element: string) {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '300px',
      data: {description: "Do you want to load this preset?"} as ConfirmDialogData
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) this.config.loadSavedConfiguration(element);
    });
  }

  runImport() {
    const content = this.importTextForm.get("content")?.value;
    if (!content) return this.openSnackBar("Invalid input.");
    try {
      const jsonText = lzutf8.decompress(content, {inputEncoding: "Base64"});
      const isArray = jsonText.substr(0, 1) == "["
      let jsonData = JSON.parse(jsonText)
      if (!isArray)
        jsonData = [jsonData]

      console.log("Incoming json:", jsonData)
      for (let jsonDatum of jsonData) {
        this.config.checkAndFixOldSavedConfigurations(jsonDatum);
        if (jsonDatum.hasOwnProperty("name")) {
          if (isArray)
            this.config.saveConfiguration(jsonDatum.name, jsonDatum.configuration);
          else
            this.config.saveCurrentConfiguration(jsonDatum.configuration);
        } else {
          this.config.saveCurrentConfiguration(jsonDatum);
        }
      }
      this.openSnackBar("Successfully loaded this configuration")
      this.importTextForm.get("content")?.reset()
    } catch (e) {
      this.openSnackBar("Invalid input.")
      console.error(e)
    }
  }

  openSnackBar(message: string) {
    this._snackBar.open(message,
      "", {
        duration: 2500,
        politeness: "polite"
      });
  }
}
