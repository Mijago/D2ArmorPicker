import {Injectable} from '@angular/core';
import {HttpClient} from "@angular/common/http";
import {environment} from "../../environments/environment";
import {Router} from "@angular/router";
import {BehaviorSubject, Observable, ReplaySubject} from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private _logoutEvent: ReplaySubject<null>;
  public readonly logoutEvent: Observable<null>;

  constructor(private http: HttpClient, private router: Router) {
    this._logoutEvent = new ReplaySubject(1)
    this.logoutEvent = this._logoutEvent.asObservable();
  }

  get refreshTokenExpired() {
    return this.refreshTokenExpiringAt < Date.now();
  }

  async autoRegenerateTokens() {
    const timing = 1000 * 3600 * 0.5; // every half hour
    console.log("autoRegenerateTokens", {
      token: this.refreshToken,
      datenow: Date.now(),
      refreshTokenExpiringAt: this.refreshTokenExpiringAt,
      lastRefresh: this.lastRefresh,
      "Date.now() > (this.lastRefresh + timing)": Date.now() > (this.lastRefresh + timing),

    })

    if (this.refreshToken
      && Date.now() < this.refreshTokenExpiringAt
      && Date.now() > (this.lastRefresh + timing)) {
      return await this.generateTokens(true)
    }
    return true;
  }

  async getCurrentMembershipData(): Promise<any> {
    const item = JSON.parse(localStorage.getItem("auth-membershipInfo") || "null");
    if (item == null) {
      const currentMembershipData = this.getCurrentMembershipData();
      localStorage.setItem("auth-membershipInfo", JSON.stringify(currentMembershipData))
      return currentMembershipData;
    } else return item;
  }

  async generateTokens(refresh = false): Promise<boolean> {
    console.info("Generate auth tokens", "refresh based on refresh_token:", refresh)
    const CLIENT_ID = environment.clientId;
    const CLIENT_SECRET = environment.client_secret;
    const grant_type = "authorization_code";
    const TOKEN = this.authCode;

    let body = `grant_type=${grant_type}&code=${TOKEN}&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}`;
    if (refresh) {
      body = `grant_type=refresh_token&refresh_token=${this.refreshToken}&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}`;
    }

    return await this.http.post<any>(`https://www.bungie.net/Platform/App/OAuth/Token/`,
      body, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-API-Key": environment.apiKey,
        }
      }).toPromise()
      .then(value => {
        console.log("generateTokens", value)
        this.accessToken = value.access_token;
        this.refreshToken = value.refresh_token;
        this.refreshTokenExpiringAt = Date.now() + value.refresh_expires_in * 1000 - 10 * 1000;
        this.lastRefresh = Date.now()
        return true;
      })
      .catch(async err => {
        console.log({err})
        await this.logout();
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
      console.info("Clearing auth code")
      localStorage.removeItem("code");
    } else {
      console.info("Setting new auth code")
      localStorage.setItem("code", "" + newCode)
    }
  }

  get accessToken() {
    return localStorage.getItem("accessToken");
  }

  set accessToken(newCode: string | null) {
    if (!newCode) {
      console.info("Clearing access token")
      localStorage.removeItem("accessToken");
    } else {
      console.info("Setting new access token")
      localStorage.setItem("accessToken", "" + newCode)
    }
  }

  get refreshToken() {
    return localStorage.getItem("refreshToken");
  }

  set refreshToken(newCode: string | null) {
    if (!newCode) {
      console.info("Clearing refresh token")
      localStorage.removeItem("refreshToken");
    } else {
      console.info("Setting new refresh token")
      localStorage.setItem("refreshToken", "" + newCode)
    }
  }

  get refreshTokenExpiringAt(): number {
    let l = localStorage.getItem("refreshTokenExpiringAt") || "0";
    return l ? Number.parseInt(l) : 0;
  }

  set refreshTokenExpiringAt(newCode: number | null) {
    if (!newCode) {
      console.info("Clearing refresh token")
      localStorage.removeItem("refreshTokenExpiringAt");
    } else {
      console.info("Setting new refresh token")
      localStorage.setItem("refreshTokenExpiringAt", "" + newCode)
    }
  }

  get lastRefresh(): number {
    let l = localStorage.getItem("lastRefresh") || "0";
    return l ? Number.parseInt(l) : 0;
  }

  set lastRefresh(newCode: number | null) {
    if (!newCode)
      localStorage.removeItem("lastRefresh");
    else
      localStorage.setItem("lastRefresh", newCode.toString())
  }

  clearManifestInfo() {
    localStorage.removeItem("LastArmorUpdate")
    localStorage.removeItem("LastManifestUpdate")
  }

  private clearLoginInfo() {
    this.lastRefresh = null;
    this.refreshTokenExpiringAt = null;
    this.authCode = null;
    this.accessToken = null;
    this.refreshToken = null;

    localStorage.removeItem("auth-membershipInfo")
  }

  async logout() {
    if (environment.offlineMode) {
      console.debug("Offline mode, skipping logout")
      return;
    }
    try {
      this._logoutEvent.next(null)
      this.clearManifestInfo();
      this.clearLoginInfo()
    } finally {
      await this.router.navigate(["login"]);
    }
  }
}
