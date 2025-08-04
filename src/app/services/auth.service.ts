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
import { NGXLogger } from "ngx-logger";
import { HttpClient } from "@angular/common/http";
import { environment } from "../../environments/environment";
import { Router } from "@angular/router";
import { Observable, ReplaySubject } from "rxjs";
import { StatusProviderService } from "./status-provider.service";

@Injectable({
  providedIn: "root",
})
export class AuthService {
  private _logoutEvent: ReplaySubject<null>;
  public readonly logoutEvent: Observable<null>;

  constructor(
    private http: HttpClient,
    private router: Router,
    private status: StatusProviderService,
    private logger: NGXLogger
  ) {
    this._logoutEvent = new ReplaySubject(1);
    this.logoutEvent = this._logoutEvent.asObservable();
  }

  get refreshTokenExpired() {
    return this.refreshTokenExpiringAt < Date.now();
  }

  async autoRegenerateTokens() {
    const timing = 1000 * 3600 * 0.5; // Refresh every half hour
    this.logger.debug(
      "AuthService",
      "autoRegenerateTokens",
      JSON.stringify({
        tokenInfo: {
          /*refreshToken: this.refreshToken,*/
          refreshTokenExpiringAt: this.refreshTokenExpiringAt,
          lastRefresh: this.lastRefresh,
          dateNow: Date.now(),
        },
      })
    );

    if (
      this.refreshToken &&
      Date.now() < this.refreshTokenExpiringAt &&
      Date.now() > this.lastRefresh + timing
    ) {
      return await this.generateTokens(true);
    }
    return true;
  }

  async getCurrentMembershipData(): Promise<any> {
    const item = JSON.parse(localStorage.getItem("auth-membershipInfo") || "null");
    if (item == null) {
      const currentMembershipData = this.getCurrentMembershipData();
      localStorage.setItem("auth-membershipInfo", JSON.stringify(currentMembershipData));
      return currentMembershipData;
    } else return item;
  }

  async generateTokens(refresh = false): Promise<boolean> {
    this.logger.info(
      "AuthService",
      "generateTokens",
      `Generate auth tokens, refresh based on refresh_token: ${refresh}`
    );
    const CLIENT_ID = environment.clientId;
    const CLIENT_SECRET = environment.client_secret;
    const grant_type = "authorization_code";
    const TOKEN = this.authCode;

    let body = `grant_type=${grant_type}&code=${TOKEN}&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}`;
    if (refresh) {
      body = `grant_type=refresh_token&refresh_token=${this.refreshToken}&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}`;
    }

    return await this.http
      .post<any>(`https://www.bungie.net/Platform/App/OAuth/Token/`, body, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-API-Key": environment.apiKey,
        },
      })
      .toPromise()
      .then((value) => {
        this.logger.info(
          "AuthService",
          "generateTokens",
          `generateTokens: ${JSON.stringify(value)}`
        );
        this.accessToken = value.access_token;
        this.refreshToken = value.refresh_token;
        this.refreshTokenExpiringAt = Date.now() + value.refresh_expires_in * 1000 - 10 * 1000;
        this.lastRefresh = Date.now();
        this.status.modifyStatus((s) => (s.authError = false));
        return true;
      })
      .catch(async (err) => {
        this.logger.error("AuthService", "generateTokens", JSON.stringify({ err }));
        this.status.modifyStatus((s) => (s.authError = true));
        return false;
      });
  }

  isAuthenticated() {
    return !!this.accessToken;
  }

  get authCode() {
    return localStorage.getItem("code");
  }

  set authCode(newCode: string | null) {
    if (!newCode) {
      this.logger.info("AuthService", "authCode", "Clearing auth code");
      localStorage.removeItem("code");
    } else {
      this.logger.info("AuthService", "authCode", "Setting new auth code");
      localStorage.setItem("code", "" + newCode);
    }
  }

  get accessToken() {
    return localStorage.getItem("accessToken");
  }

  set accessToken(newCode: string | null) {
    if (!newCode) {
      this.logger.info("AuthService", "accessToken", "Clearing access token");
      localStorage.removeItem("accessToken");
    } else {
      this.logger.info("AuthService", "accessToken", "Setting new access token");
      localStorage.setItem("accessToken", "" + newCode);
    }
  }

  get refreshToken() {
    return localStorage.getItem("refreshToken");
  }

  set refreshToken(newCode: string | null) {
    if (!newCode) {
      this.logger.info("AuthService", "refreshToken", "Clearing refresh token");
      localStorage.removeItem("refreshToken");
    } else {
      this.logger.info("AuthService", "refreshToken", "Setting new refresh token");
      localStorage.setItem("refreshToken", "" + newCode);
    }
  }

  get refreshTokenExpiringAt(): number {
    let l = localStorage.getItem("refreshTokenExpiringAt") || "0";
    return l ? Number.parseInt(l) : 0;
  }

  set refreshTokenExpiringAt(newCode: number | null) {
    if (!newCode) {
      this.logger.info("AuthService", "refreshTokenExpiringAt", "Clearing refresh token");
      localStorage.removeItem("refreshTokenExpiringAt");
    } else {
      this.logger.info("AuthService", "refreshTokenExpiringAt", "Setting new refresh token");
      localStorage.setItem("refreshTokenExpiringAt", "" + newCode);
    }
  }

  get lastRefresh(): number {
    let l = localStorage.getItem("lastRefresh") || "0";
    return l ? Number.parseInt(l) : 0;
  }

  set lastRefresh(newCode: number | null) {
    if (!newCode) localStorage.removeItem("lastRefresh");
    else localStorage.setItem("lastRefresh", newCode.toString());
  }

  clearManifestInfo() {
    localStorage.removeItem("LastArmorUpdate");
    localStorage.removeItem("LastManifestUpdate");
  }

  private clearLoginInfo() {
    this.lastRefresh = null;
    this.refreshTokenExpiringAt = null;
    this.authCode = null;
    this.accessToken = null;
    this.refreshToken = null;
  }

  async logout() {
    if (environment.offlineMode) {
      this.logger.debug("AuthService", "logout", "Offline mode, skipping logout");
      return;
    }
    try {
      this._logoutEvent.next(null);
      this.clearManifestInfo();
      this.clearLoginInfo();
    } finally {
      await this.router.navigate(["login"]);
    }
  }
}
