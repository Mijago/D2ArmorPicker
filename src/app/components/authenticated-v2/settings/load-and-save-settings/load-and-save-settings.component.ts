import {Component, OnInit} from '@angular/core';
import {ConfigurationService, StoredConfiguration} from "../../../../services/v2/configuration.service";
import {FormBuilder, FormGroup, Validators} from "@angular/forms";
import {MatDialog} from "@angular/material/dialog";
import {ConfirmDialogComponent, ConfirmDialogData} from "../../components/confirm-dialog/confirm-dialog.component";

@Component({
  selector: 'app-load-and-save-settings',
  templateUrl: './load-and-save-settings.component.html',
  styleUrls: ['./load-and-save-settings.component.css']
})
export class LoadAndSaveSettingsComponent implements OnInit {
  selectedEntry: string = "";
  storedConfigs: StoredConfiguration[] = [];
  displayedColumns = ["name", "class", "mobility", "resilience", "recovery", "discipline", "intellect", "strength", "delete", "load"];

  settingsNameForm: FormGroup;

  constructor(private config: ConfigurationService, private formBuilder: FormBuilder,
              public dialog: MatDialog) {
    this.settingsNameForm = this.formBuilder.group({name: [null,]});
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
}
