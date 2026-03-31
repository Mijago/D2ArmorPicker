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

import { Injectable, OnDestroy } from "@angular/core";
import { LoggingProxyService } from "./logging-proxy.service";
import { BuildConfiguration } from "../data/buildConfiguration";
import { BehaviorSubject, Observable } from "rxjs";
import { ModOrAbility } from "../data/enum/modOrAbility";
import * as lzutf8 from "lzutf8";
import { CompressionOptions, DecompressionOptions } from "lzutf8";
import { environment } from "../../environments/environment";
import { EnumDictionary } from "../data/types/EnumDictionary";
import { ArmorStat } from "../data/enum/armor-stat";
// import { ArmorSlot } from "../data/enum/armor-slot";
import { ModInformation } from "../data/ModInformation";
import { isEqual as _isEqual } from "lodash";

export interface StoredConfiguration {
  version: string;
  name: string;
  configuration: BuildConfiguration;
}

const lzCompOptions = {
  outputEncoding: "Base64",
} as CompressionOptions;

const lzDecompOptions = {
  inputEncoding: "Base64",
  outputEncoding: "String",
} as DecompressionOptions;

@Injectable({
  providedIn: "root",
})
export class ConfigurationService implements OnDestroy {
  get currentConfiguration() {
    return this.__configuration;
  }
  private __configuration: BuildConfiguration;
  private __LastConfiguration: BuildConfiguration;

  get readonlyConfigurationSnapshot() {
    return Object.assign(this.__configuration, {});
  }

  private _configuration: BehaviorSubject<BuildConfiguration>;
  public readonly configuration: Observable<BuildConfiguration>;

  private _storedConfigurations: BehaviorSubject<StoredConfiguration[]>;
  public readonly storedConfigurations: Observable<StoredConfiguration[]>;

  constructor(private logger: LoggingProxyService) {
    this.logger.debug("ConfigurationService", "constructor", "Initializing ConfigurationService");
    this.__configuration = this.loadCurrentConfiguration();
    this.__LastConfiguration = this.loadCurrentConfiguration();

    this._configuration = new BehaviorSubject(this.__configuration);
    this.configuration = this._configuration.asObservable();

    this._storedConfigurations = new BehaviorSubject(this.listSavedConfigurations());
    this.storedConfigurations = this._storedConfigurations.asObservable();
  }

  ngOnDestroy(): void {
    this.logger.debug("ConfigurationService", "ngOnDestroy", "Destroying ConfigurationService");
  }

  modifyConfiguration(cb: (configuration: BuildConfiguration) => void) {
    cb(this.__configuration);
    if (_isEqual(this.__configuration, this.__LastConfiguration)) return;
    this.__LastConfiguration = structuredClone(this.__configuration);
    this.saveCurrentConfiguration(this.__configuration);
  }

  saveConfiguration(name: string, config: BuildConfiguration) {
    let list = this.listSavedConfigurations();
    let c = this.listSavedConfigurations()
      .map((value, index): [StoredConfiguration, number] => [value, index])
      .filter((c) => c[0].name == name)[0];
    if (!!c) {
      list.splice(c[1], 1);
    }
    list.push({
      configuration: config,
      name: name,
      version: environment.version,
    });
    list = list.sort((a, b) => {
      if (a.name < b.name) return -1;
      else if (a.name > b.name) return 1;
      return 0;
    });

    const compressed = lzutf8.compress(JSON.stringify(list), lzCompOptions);
    localStorage.setItem("storedConfigurations", compressed);
    this._storedConfigurations.next(list);
  }

  doesSavedConfigurationExist(name: string) {
    return this.listSavedConfigurations().filter((c) => c.name == name).length > 0;
  }

  loadSavedConfiguration(name: string): boolean {
    let c = this.listSavedConfigurations().filter((c) => c.name == name)[0];
    if (!c) return false;
    this.saveCurrentConfiguration(c.configuration);
    return true;
  }

  checkAndFixOldSavedConfigurations(c: StoredConfiguration) {
    c.configuration = Object.assign(BuildConfiguration.buildEmptyConfiguration(), c.configuration);
    if (c.configuration.hasOwnProperty("minimumStatTier")) {
      let tiers = (c.configuration as any).minimumStatTier as EnumDictionary<ArmorStat, number>;
      c.configuration.minimumStatTiers[ArmorStat.StatWeapon].value = tiers[ArmorStat.StatWeapon];
      c.configuration.minimumStatTiers[ArmorStat.StatHealth].value = tiers[ArmorStat.StatHealth];
      c.configuration.minimumStatTiers[ArmorStat.StatClass].value = tiers[ArmorStat.StatClass];
      c.configuration.minimumStatTiers[ArmorStat.StatGrenade].value = tiers[ArmorStat.StatGrenade];
      c.configuration.minimumStatTiers[ArmorStat.StatSuper].value = tiers[ArmorStat.StatSuper];
      c.configuration.minimumStatTiers[ArmorStat.StatMelee].value = tiers[ArmorStat.StatMelee];
      delete (c.configuration as any).minimumStatTier;
    }

    if (c.configuration.hasOwnProperty("selectedExoticHash")) {
      c.configuration.selectedExotics = [(c.configuration as any).selectedExoticHash];
      delete (c.configuration as any).selectedExoticHash;
    }

    // remove mods that no longer exist
    if (c.configuration.hasOwnProperty("enabledMods")) {
      c.configuration.enabledMods = (c.configuration as any).enabledMods.filter(
        (v: ModOrAbility) => !!ModInformation[v]
      );
    }

    // Always reset risky mods on reload
    c.configuration.limitParsedResults = true;
    c.configuration.addConstent1Health = false;
  }

  listSavedConfigurations(): StoredConfiguration[] {
    let item;
    try {
      item = localStorage.getItem("storedConfigurations") || "[]";
      if (item.substr(0, 1) != "[") item = lzutf8.decompress(item, lzDecompOptions);
    } catch (e) {
      item = [];
    }

    let result = (JSON.parse(item) || []) as StoredConfiguration[];
    result = result.sort((a, b) => {
      if (a.name < b.name) return -1;
      else if (a.name > b.name) return 1;
      return 0;
    });
    result.forEach((c) => this.checkAndFixOldSavedConfigurations(c));
    return result;
  }

  deleteStoredConfiguration(name: string) {
    let list = this.listSavedConfigurations();
    let c = this.listSavedConfigurations()
      .map((value, index): [StoredConfiguration, number] => [value, index])
      .filter((c) => c[0].name == name)[0];
    if (!!c) {
      list.splice(c[1], 1);
    }
    localStorage.setItem(
      "storedConfigurations",
      lzutf8.compress(JSON.stringify(list), lzCompOptions)
    );
    this._storedConfigurations.next(list);
  }

  saveCurrentConfigurationToName(name: string) {
    this.saveConfiguration(name, this.__configuration);
  }

  saveCurrentConfiguration(configuration: BuildConfiguration) {
    this.logger.debug("Writing configuration", JSON.stringify({ configuration: configuration }));
    // deep copy it
    this.__configuration = Object.assign(
      BuildConfiguration.buildEmptyConfiguration(),
      configuration
    );
    this.__configuration.enabledMods = ([] as ModOrAbility[]).concat(
      this.__configuration.enabledMods
    );
    this.__configuration.minimumStatTiers = Object.assign(
      {},
      this.__configuration.minimumStatTiers
    );

    const compressed = lzutf8.compress(JSON.stringify(this.__configuration), lzCompOptions);
    localStorage.setItem("user-currentConfig", compressed);
    this._configuration.next(Object.assign({}, this.__configuration));
  }

  loadCurrentConfiguration() {
    try {
      let config;
      try {
        config = localStorage.getItem("user-currentConfig") || "{}";
        if (config.substr(0, 1) != "{") config = lzutf8.decompress(config, lzDecompOptions);
      } catch (e) {
        config = {};
      }

      var storedConfiguration: StoredConfiguration = {
        name: "dummy",
        version: "1",
        configuration: JSON.parse(config),
      };
      this.checkAndFixOldSavedConfigurations(storedConfiguration);
      return storedConfiguration.configuration;
    } catch (e) {
      this.logger.error(
        "ConfigurationService",
        "loadCurrentConfiguration",
        "Error while checking and fixing old saved configurations",
        e
      );
      return BuildConfiguration.buildEmptyConfiguration();
    }
  }

  getCurrentConfigBase64Compressed(): string {
    let config = localStorage.getItem("user-currentConfig") || "{}";
    if (config.substr(0, 1) == "{") config = lzutf8.compress(config, { outputEncoding: "Base64" });
    return config;
  }

  getAllStoredConfigurationsBase64Compressed(): string {
    let item = localStorage.getItem("storedConfigurations") || "[]";
    if (item.substr(0, 1) == "[") item = lzutf8.compress(item, { outputEncoding: "Base64" });
    return item;
  }

  getStoredConfigurationBase64Compressed(name: string): string {
    let c = this.listSavedConfigurations().filter((c) => c.name == name)[0];
    if (!c) return "";
    return lzutf8.compress(JSON.stringify(c), { outputEncoding: "Base64" });
  }

  resetCurrentConfiguration() {
    this.saveCurrentConfiguration(BuildConfiguration.buildEmptyConfiguration());
  }
}
