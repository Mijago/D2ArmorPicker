import {Component, OnInit} from '@angular/core';
import {ConfigurationService, StoredConfiguration} from "../../../../services/v2/configuration.service";
import {FormBuilder, FormGroup, Validators} from "@angular/forms";

@Component({
  selector: 'app-load-and-save-settings',
  templateUrl: './load-and-save-settings.component.html',
  styleUrls: ['./load-and-save-settings.component.css']
})
export class LoadAndSaveSettingsComponent implements OnInit {
  storedConfigs: StoredConfiguration[] = [];
  displayedColumns = ["name", "class", "mobility", "resilience", "recovery", "discipline", "intellect", "strength", "delete"];

  settingsNameForm: FormGroup;

  constructor(private config: ConfigurationService, private formBuilder: FormBuilder) {
    this.settingsNameForm = this.formBuilder.group({name: [null,]});
  }

  ngOnInit(): void {
    this.config.storedConfigurations.subscribe(d => this.storedConfigs = d)
  }

  submit() {
    const name = this.settingsNameForm.get("name")?.value;
    if (!name) return; // TODO LOG ERROR
    this.config.saveCurrentConfigurationToName(name);
    this.settingsNameForm.reset();
  }

  delete(element: StoredConfiguration) {
    this.config.deleteStoredConfiguration(element.name);
  }

  clearEverything() {
    this.config.resetCurrentConfiguration()
  }
}
