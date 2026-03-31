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
import { environment } from "../../environments/environment";
import { Observable, ReplaySubject } from "rxjs";

@Injectable({
  providedIn: "root",
})
export class AuthService implements OnDestroy {
  private _logoutEvent: ReplaySubject<null>;
  public readonly logoutEvent: Observable<null>;

  constructor(private logger: LoggingProxyService) {
    this.logger.debug("AuthService", "constructor", "Initializing AuthService");
    this._logoutEvent = new ReplaySubject(1);
    this.logoutEvent = this._logoutEvent.asObservable();
  }

  ngOnDestroy(): void {
    this.logger.debug("AuthService", "ngOnDestroy", "Destroying AuthService");
  }

  async getCurrentMembershipData(): Promise<any> {
    const item = JSON.parse(localStorage.getItem("user-membershipInfo") || "null");
    if (item == null) {
      const currentMembershipData = this.getCurrentMembershipData();
      localStorage.setItem("user-membershipInfo", JSON.stringify(currentMembershipData));
      return currentMembershipData;
    } else return item;
  }

  async logout() {
    if (environment.offlineMode) {
      this.logger.debug("AuthService", "logout", "Offline mode, skipping logout");
      return;
    }
    try {
      localStorage.removeItem("auth-accessToken");
      localStorage.removeItem("auth-refreshToken");
      localStorage.removeItem("auth-refreshToken-expireDate");
      localStorage.removeItem("auth-refreshToken-lastRefreshDate");
      localStorage.removeItem("user-currentConfig");
    } catch (e) {
      this.logger.error("AuthService", "logout", "Error during logout", e);
    } finally {
      this._logoutEvent.next(null);
    }
  }
}
