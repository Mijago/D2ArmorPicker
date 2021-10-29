import {Injectable} from '@angular/core';
import {Configuration} from "../data/configuration";
import {BehaviorSubject, Observable} from "rxjs";
import {ModOrAbility} from "../data/enum/modOrAbility";
import * as lzutf8 from "lzutf8";
import {CompressionOptions, DecompressionOptions} from "lzutf8";

export interface StoredConfiguration {
  version: number; // TODO
  name: string;
  configuration: Configuration;
}

const lzCompOptions = {
  outputEncoding: "Base64"
} as CompressionOptions

const lzDecompOptions = {
  inputEncoding: "Base64",
  outputEncoding: "String"
} as DecompressionOptions

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

    const compressed = lzutf8.compress(JSON.stringify(list), lzCompOptions);
    localStorage.setItem("storedConfigurations", compressed)
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
    let item = localStorage.getItem("storedConfigurations") || "[]";
    if (item.substr(0, 1) != "[")
      item = lzutf8.decompress(item, lzDecompOptions);

    let result = (JSON.parse(item) || []) as StoredConfiguration[]
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
    localStorage.setItem("storedConfigurations", lzutf8.compress(JSON.stringify(list), lzCompOptions))
    this._storedConfigurations.next(list);
  }

  saveCurrentConfigurationToName(name: string) {
    this.saveConfiguration(name, this.__configuration);
  }

  saveCurrentConfiguration(configuration: Configuration) {
    console.debug("write configuration", configuration)
    // deep copy it
    this.__configuration = Object.assign(Configuration.buildEmptyConfiguration(), configuration);
    this.__configuration.enabledMods = ([] as ModOrAbility[]).concat(this.__configuration.enabledMods);
    this.__configuration.minimumStatTier = Object.assign({}, this.__configuration.minimumStatTier)

    const compressed = lzutf8.compress(JSON.stringify(this.__configuration), lzCompOptions)
    localStorage.setItem("currentConfig", compressed);
    this._configuration.next(Object.assign({}, this.__configuration));
  }

  loadCurrentConfiguration() {
    let config = localStorage.getItem("currentConfig") || "{}";
    if (config.substr(0, 1) != "{")
      config = lzutf8.decompress(config, lzDecompOptions);

    return Object.assign(Configuration.buildEmptyConfiguration(),
      JSON.parse(config)
    );
  }

  getCurrentConfigBase64Compressed(): string {
    let config = localStorage.getItem("currentConfig") || "{}";
    if (config.substr(0, 1) == "{")
      config = lzutf8.compress(config, {outputEncoding: "Base64"});
    return config;
  }

  getAllStoredConfigurationsBase64Compressed(): string {
    let item = localStorage.getItem("storedConfigurations") || "[]";
    if (item.substr(0, 1) == "[")
      item = lzutf8.compress(item, {outputEncoding: "Base64"});
    return item;
  }

  getStoredConfigurationBase64Compressed(name: string): string {
    let c = this.listSavedConfigurations().filter(c => c.name == name)[0];
    if (!c) return "";
    return lzutf8.compress(JSON.stringify(c), {outputEncoding: "Base64"});
  }

  resetCurrentConfiguration() {
    this.saveCurrentConfiguration(Configuration.buildEmptyConfiguration())
  }
}
