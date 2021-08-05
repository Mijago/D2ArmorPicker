import { Injectable } from '@angular/core';
import {Configuration} from "../../data/configuration";
import {Subject} from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class ConfigurationService {

  private _configuration: Configuration;

  constructor() {
    this._configuration = Configuration.buildEmptyConfiguration();
  }

  resetConfiguration() {
    this._configuration = Configuration.buildEmptyConfiguration();
  }

  get configuration() {
    return this._configuration;
  }
}
