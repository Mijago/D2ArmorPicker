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

import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable } from "rxjs";

export interface Status {
  calculatingPermutations: boolean;
  calculatingResults: boolean;
  updatingResultsTable: boolean;
  updatingManifest: boolean;
  updatingInventory: boolean;
  updatingVendors: boolean;

  apiError: boolean;
  authError: boolean;
}

@Injectable({
  providedIn: "root",
})
export class StatusProviderService {
  private __status: Status = {
    calculatingResults: false,
    calculatingPermutations: false,
    updatingResultsTable: false,
    updatingInventory: false,
    updatingManifest: false,
    updatingVendors: false,

    apiError: false, // in case the api is inaccesible or disabled
    authError: false, // in case the login tokens are invalid and can not be refreshed
  };

  private _status: BehaviorSubject<Status>;
  public readonly status: Observable<Status>;

  constructor() {
    this._status = new BehaviorSubject<Status>(this.__status);
    this.status = this._status.asObservable();
  }

  getStatus() {
    return this.__status;
  }

  modifyStatus(cb: (status: Status) => void) {
    cb(this.__status);
    console.log("modifyStatus", this.__status);
    this._status.next(this.__status);
  }

  setApiError() {
    if (this.__status.apiError) return;
    this.modifyStatus((status) => {
      status.apiError = true;
    });
  }

  clearApiError() {
    if (!this.__status.apiError) return;
    this.modifyStatus((status) => {
      status.apiError = false;
    });
  }

  setAuthError() {
    if (this.__status.authError) return;
    this.modifyStatus((status) => {
      status.authError = true;
    });
  }

  clearAuthError() {
    if (!this.__status.authError) return;
    this.modifyStatus((status) => {
      status.authError = false;
    });
  }
}
