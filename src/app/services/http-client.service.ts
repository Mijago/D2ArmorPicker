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

  async $httpWithoutKey(config: HttpClientConfig) {
    return this.http
      .get<any>(config.url, {
        params: config.params,
      })
      .pipe(retry(2))
      .toPromise();
  }

  /**
   * This function is used to make a http request without an api key.
   * If the request fails, it will retry *with* the api key.
   */
  async $httpWithoutAndWithKey(config: HttpClientConfig) {
    return this.http
      .get<any>(config.url, {
        params: config.params,
      })
      .pipe(retry(2))
      .toPromise()
      .catch(async (err) => {
        console.error(err);
        return this.$http(config);
      });
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

  async $http(config: HttpClientConfig, logoutOnError = true) {
    return this.http
      .get<any>(config.url, {
        params: config.params,
        headers: {
          "X-API-Key": environment.apiKey,
          Authorization: "Bearer " + this.authService.accessToken,
        },
      })
      .pipe(retry(2))
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
        if (err.error?.ErrorStatus == "SystemDisabled" && logoutOnError) {
          console.info("System is disabled. Revoking auth, must re-login");
          this.status.setApiError();
        }
        if (err.ErrorStatus != "Internal Server Error") {
          console.info("API-Error");
          //this.status.setApiError();
        }
      });
  }
}
