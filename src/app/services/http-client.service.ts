import { Injectable, NgZone, OnDestroy } from "@angular/core";
import { LoggingProxyService } from "./logging-proxy.service";
import { HttpClientConfig } from "bungie-api-ts/destiny2";
import { AuthService } from "./auth.service";
import { HttpClient } from "@angular/common/http";
import { environment } from "../../environments/environment";
import { StatusProviderService } from "./status-provider.service";
import { retry } from "rxjs/operators";

interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  refresh_expires_in: number;
  membership_id: string;
}

@Injectable({
  providedIn: "root",
})
export class HttpClientService implements OnDestroy {
  constructor(
    private authService: AuthService,
    private http: HttpClient,
    private status: StatusProviderService,
    private logger: LoggingProxyService,
    private ngZone: NgZone
  ) {
    this.logger.debug("HttpClientService", "constructor", "Initializing HttpClientService");
  }

  ngOnDestroy(): void {
    this.logger.debug("HttpClientService", "ngOnDestroy", "Destroying HttpClientService");
  }

  get refreshTokenExpired() {
    return this.refreshTokenExpiringAt < Date.now();
  }

  get authCode() {
    return localStorage.getItem("code");
  }

  set authCode(newCode: string | null) {
    if (!newCode) {
      this.logger.info("HttpClientService", "authCode", "Clearing auth code from storage");
      localStorage.removeItem("code");
    } else {
      this.logger.info("HttpClientService", "authCode", "Setting new auth code");
      localStorage.setItem("code", "" + newCode);
    }
  }

  get accessToken() {
    return localStorage.getItem("auth-accessToken");
  }

  set accessToken(newCode: string | null) {
    if (!newCode) {
      this.logger.info("HttpClientService", "auth-accessToken", "Clearing access token");
      localStorage.removeItem("auth-accessToken");
    } else {
      this.logger.info(
        "HttpClientService",
        "auth-accessToken",
        "Setting new access token: [REDACTED]"
      );
      localStorage.setItem("auth-accessToken", "" + newCode);
    }
  }

  get refreshToken() {
    return localStorage.getItem("auth-refreshToken");
  }

  set refreshToken(newCode: string | null) {
    if (!newCode) {
      this.logger.info("HttpClientService", "auth-refreshToken", "Clearing refresh token");
      localStorage.removeItem("auth-refreshToken");
    } else {
      this.logger.info(
        "HttpClientService",
        "auth-refreshToken",
        "Setting new refresh token: [REDACTED]"
      );
      localStorage.setItem("auth-refreshToken", "" + newCode);
    }
  }

  get refreshTokenExpiringAt(): number {
    let l = localStorage.getItem("auth-refreshToken-expireDate") || "0";
    return l ? Number.parseInt(l) : 0;
  }

  set refreshTokenExpiringAt(newCode: number | null) {
    if (!newCode) {
      this.logger.info(
        "HttpClientService",
        "auth-refreshToken-expireDate",
        "Clearing refresh token"
      );
      localStorage.removeItem("auth-refreshToken-expireDate");
    } else {
      this.logger.info(
        "HttpClientService",
        "auth-refreshToken-expireDate",
        "Setting new refresh token"
      );
      localStorage.setItem("auth-refreshToken-expireDate", "" + newCode);
    }
  }

  get lastAuthRefresh(): number {
    let l = localStorage.getItem("auth-refreshToken-lastRefreshDate") || "0";
    return l ? Number.parseInt(l) : 0;
  }

  set lastAuthRefresh(newCode: number | null) {
    if (!newCode) localStorage.removeItem("auth-refreshToken-lastRefreshDate");
    else localStorage.setItem("auth-refreshToken-lastRefreshDate", newCode.toString());
  }

  isAuthenticated() {
    return !!this.accessToken;
  }

  async autoRegenerateTokens() {
    const timing = 1000 * 3600 * 0.5; // Refresh every half hour
    if (
      this.refreshToken &&
      Date.now() < this.refreshTokenExpiringAt &&
      Date.now() > this.lastAuthRefresh + timing
    ) {
      return await this.generateTokens(true);
    }
    return true;
  }

  async generateTokens(refresh = false): Promise<boolean> {
    this.logger.info(
      "HttpClientService",
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
      .post<OAuthTokenResponse>(`https://www.bungie.net/Platform/App/OAuth/Token/`, body, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-API-Key": environment.apiKey,
        },
      })
      .toPromise()
      .then((value) => {
        this.logger.info(
          "HttpClientService",
          "generateTokens",
          `generateTokens: {"access_token":"[REDACTED]","token_type":"${value.token_type}","expires_in":${value.expires_in},"refresh_token":"[REDACTED]","refresh_expires_in":${value.refresh_expires_in},"membership_id":"${value.membership_id}"}`
        );
        this.accessToken = value.access_token;
        this.refreshToken = value.refresh_token;
        this.refreshTokenExpiringAt = Date.now() + value.refresh_expires_in * 1000 - 10 * 1000;
        this.lastAuthRefresh = Date.now();
        this.ngZone.run(() => {
          this.status.modifyStatus((s) => (s.authError = false));
        });
        return true;
      })
      .catch(async (err) => {
        this.logger.error("HttpClientService", "generateTokens", JSON.stringify({ err }));
        this.ngZone.run(() => {
          this.status.modifyStatus((s) => (s.authError = true));
        });
        return false;
      });
  }

  private clearLoginInfo() {
    this.lastAuthRefresh = null;
    this.refreshTokenExpiringAt = null;
    this.authCode = null;
    this.accessToken = null;
    this.refreshToken = null;
  }

  async $httpWithoutBearerToken(config: HttpClientConfig) {
    return this.$http(config, false, true, false, 2);
  }
  async $httpWithoutApiKey(config: HttpClientConfig) {
    return this.$http(config, false, false, false, 2);
  }

  async $httpPost(config: HttpClientConfig) {
    return this.http
      .post<any>(config.url, config.body, {
        params: config.params,
        headers: {
          "X-API-Key": environment.apiKey,
          Authorization: "Bearer " + this.accessToken,
        },
      })
      .pipe(retry(2))
      .toPromise()
      .catch(async (err) => {
        this.logger.error("HttpClientService", "$httpPost", err);
      });
  }

  async $http(
    config: HttpClientConfig,
    logoutOnFailure: boolean,
    apiKey = true,
    bearerToken = true,
    retryCount = 2
  ) {
    // Check and refresh tokens if needed when bearer token is required
    if (bearerToken) {
      if (this.refreshTokenExpired || !(await this.autoRegenerateTokens())) {
        // before logging out, check if the user is actually authenticated, if not, just clear the auth state without logging out, to avoid infinite loops of failed requests triggering logouts
        if (!this.isAuthenticated()) {
          this.logger.warn("HttpClientService", "$http", "User is not authenticated");
          return null;
        }
        this.logger.warn(
          "HttpClientService",
          "$http",
          "Refresh token expired or token generation failed, user should be logged out"
        );
        this.status.setAuthError();
        if (logoutOnFailure) {
          this.clearLoginInfo();
          this.authService.logout();
        }
        return null;
      }
    }

    let options = {
      params: config.params,
      headers: {} as any,
    };
    if (apiKey) options.headers["X-API-Key"] = environment.apiKey;

    if (bearerToken) {
      if (!this.accessToken) {
        this.logger.error(
          "HttpClientService",
          "$http",
          "No access token available for authenticated request"
        );
      } else {
        options.headers["Authorization"] = "Bearer " + this.accessToken;
      }
    }
    return this.http
      .get<any>(config.url, options)
      .pipe(retry(retryCount))
      .toPromise()
      .then((res) => {
        // Clear API error, if it was set
        this.status.clearApiError();
        return res;
      })
      .catch(async (err) => {
        console.error("HTTP Error: ", config.url, "Options: ", options);
        this.logger.error("HttpClientService", "$http", err);
        if (environment.offlineMode) {
          this.logger.debug("HttpClientService", "$http", "Offline mode, ignoring API error");
        } else if (err.error?.ErrorStatus == "SystemDisabled") {
          this.logger.info(
            "HttpClientService",
            "$http",
            "System is disabled. Not revoking auth, system is probably down for maintenance."
          );
          this.status.setApiError();
        }
        // if error 500, log out
        else if (err.status == 500) {
          this.logger.info("HttpClientService", "$http", "Auth Error, probably expired token");
          if (logoutOnFailure) {
            this.status.setAuthError();
            this.clearLoginInfo();
            this.authService.logout();
          }
        }
        // if error 401, log out
        else if (err.status == 401) {
          this.logger.info(
            "HttpClientService",
            "$http",
            "Invalid credentials error, probably expired token"
          );
          if (logoutOnFailure) {
            this.status.setAuthError();
            this.clearLoginInfo();
            this.authService.logout();
          }
        } else if (err.ErrorStatus != "Internal Server Error") {
          this.logger.info("HttpClientService", "$http", "API-Error");
          //this.status.setApiError();
        } else {
          this.logger.info("HttpClientService", "$http", "Generic API-Error");
          this.status.setApiError();
        }
        return null;
      });
  }
}
