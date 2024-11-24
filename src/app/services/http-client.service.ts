import { Injectable } from "@angular/core";
import { HttpClientConfig } from "bungie-api-ts/destiny2";
import { AuthService } from "./auth.service";
import { HttpClient } from "@angular/common/http";
import { environment } from "../../environments/environment";
import { StatusProviderService } from "./status-provider.service";
import { retry } from "rxjs/operators";

@Injectable({
  providedIn: "root",
})
export class HttpClientService {
  constructor(
    private authService: AuthService,
    private http: HttpClient,
    private status: StatusProviderService
  ) {}

  async $httpWithoutBearerToken(config: HttpClientConfig) {
    return this.$http(config, true, false, 2);
  }
  async $httpWithoutApiKey(config: HttpClientConfig) {
    return this.$http(config, false, false, 2);
  }

  async $httpPost(config: HttpClientConfig) {
    return this.http
      .post<any>(config.url, config.body, {
        params: config.params,
        headers: {
          "X-API-Key": environment.apiKey,
          Authorization: "Bearer " + this.authService.accessToken,
        },
      })
      .pipe(retry(2))
      .toPromise()
      .catch(async (err) => {
        console.error(err);
      });
  }

  async $http(config: HttpClientConfig, apiKey = true, bearerToken = true, retryCount = 2) {
    let options = {
      params: config.params,
      headers: {} as any,
    };
    if (apiKey) options.headers["X-API-Key"] = environment.apiKey;

    if (bearerToken) options.headers["Authorization"] = "Bearer " + this.authService.accessToken;

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
        console.error(err);
        if (environment.offlineMode) {
          console.debug("Offline mode, ignoring API error");
          return;
        }
        if (err.error?.ErrorStatus == "SystemDisabled") {
          console.info("System is disabled. Revoking auth, must re-login");
          this.status.setApiError();
        }
        // if error 500, log out
        else if (err.status == 500) {
          console.info("Auth Error, probably expired token");
          this.status.setAuthError();
          this.authService.logout();
        }
        if (err.ErrorStatus != "Internal Server Error") {
          console.info("API-Error");
          //this.status.setApiError();
        }
      });
  }
}
