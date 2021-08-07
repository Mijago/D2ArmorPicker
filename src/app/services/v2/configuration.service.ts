import {Injectable} from '@angular/core';
import {Configuration} from "../../data/configuration";
import {BehaviorSubject, Observable, Subject} from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class ConfigurationService {

  private __configuration: Configuration;

  private _configuration: BehaviorSubject<Configuration>;
  public readonly configuration: Observable<Configuration>;

  constructor() {
    this.__configuration = Object.assign(Configuration.buildEmptyConfiguration(),
      JSON.parse(localStorage.getItem("currentConfig") || "{}")
    );

    this._configuration = new BehaviorSubject(this.__configuration)
    this.configuration = this._configuration.asObservable();
  }

  modifyConfiguration(cb: (configuration: Configuration) => void) {
    cb(this.__configuration);
    this.saveConfiguration(this.__configuration)
  }

  saveConfiguration(configuration: Configuration) {
    console.log("write configuration", configuration)
    localStorage.setItem("currentConfig", JSON.stringify(configuration));
    this._configuration.next(Object.assign({}, configuration));
  }

  resetConfiguration() {
    this.saveConfiguration(Configuration.buildEmptyConfiguration())
  }
}
