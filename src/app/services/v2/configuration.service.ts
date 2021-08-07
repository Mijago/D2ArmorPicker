import {Injectable} from '@angular/core';
import {Configuration} from "../../data/configuration";
import {BehaviorSubject, Observable, Subject} from "rxjs";
import {ModOrAbility} from "../../data/enum/modOrAbility";

const CURRENT_CONFIGURATION = "CURRENT_CONFIGURATION"

export interface StoredConfiguration {
  version: number; // TODO
  name: string;
  configuration: Configuration;
}

@Injectable({
  providedIn: 'root'
})
export class ConfigurationService {

  private __configuration: Configuration;

  private _configuration: BehaviorSubject<Configuration>;
  public readonly configuration: Observable<Configuration>;

  private _storedConfigurations: BehaviorSubject<StoredConfiguration[]>;
  public readonly storedConfigurations: Observable<StoredConfiguration[]>;

  constructor() {
    this.__configuration = this.loadCurrentConfiguration();

    this._configuration = new BehaviorSubject(this.__configuration)
    this.configuration = this._configuration.asObservable();

    this._storedConfigurations = new BehaviorSubject(this.listSavedConfigurations())
    this.storedConfigurations = this._storedConfigurations.asObservable();
  }

  modifyConfiguration(cb: (configuration: Configuration) => void) {
    cb(this.__configuration);
    this.saveCurrentConfiguration(this.__configuration)
  }

  saveConfiguration(name: string, config: Configuration) {
    let list = this.listSavedConfigurations();
    let c = this.listSavedConfigurations()
      .map((value, index): [StoredConfiguration, number] => [value, index])
      .filter(c => c[0].name == name)[0];
    if (!!c) {
      list.splice(c[1], 1)
    }
    list.push({
      configuration: config,
      name: name,
      version: 1
    });
    list = list.sort((a, b) => {
      if (a.name < b.name) return -1;
      else if (a.name > b.name) return 1;
      return 0;
    })
    localStorage.setItem("storedConfigurations", JSON.stringify(list))
    this._storedConfigurations.next(list);
  }

  doesSavedConfigurationExist(name: string) {
    return this.listSavedConfigurations().filter(c => c.name == name).length > 0;
  }

  loadSavedConfiguration(name: string): boolean {
    let c = this.listSavedConfigurations().filter(c => c.name == name)[0];
    if (!c) return false;
    this.saveCurrentConfiguration(c.configuration);
    return true;
  }

  listSavedConfigurations(): StoredConfiguration[] {
    let result = (JSON.parse(localStorage.getItem("storedConfigurations") || "[]") || []) as StoredConfiguration[]
    result = result.sort((a, b) => {
      if (a.name < b.name) return -1;
      else if (a.name > b.name) return 1;
      return 0;
    })
    return result;
  }

  deleteStoredConfiguration(name: string) {
    let list = this.listSavedConfigurations();
    let c = this.listSavedConfigurations()
      .map((value, index): [StoredConfiguration, number] => [value, index])
      .filter(c => c[0].name == name)[0];
    if (!!c) {
      list.splice(c[1], 1)
    }
    localStorage.setItem("storedConfigurations", JSON.stringify(list))
    this._storedConfigurations.next(list);
  }

  saveCurrentConfigurationToName(name: string) {
    this.saveConfiguration(name, this.__configuration);
  }

  saveCurrentConfiguration(configuration: Configuration) {
    console.log("write configuration", configuration)
    // deep copy it
    this.__configuration = Object.assign({}, configuration);
    this.__configuration.enabledMods = ([] as ModOrAbility[]).concat(this.__configuration.enabledMods);
    this.__configuration.minimumStatTier = Object.assign({}, this.__configuration.minimumStatTier)

    localStorage.setItem("currentConfig", JSON.stringify(configuration));
    this._configuration.next(Object.assign({}, configuration));
  }

  loadCurrentConfiguration() {
    return Object.assign(Configuration.buildEmptyConfiguration(),
      JSON.parse(localStorage.getItem("currentConfig") || "{}")
    );
  }

  resetCurrentConfiguration() {
    this.saveCurrentConfiguration(Configuration.buildEmptyConfiguration())
  }
}
