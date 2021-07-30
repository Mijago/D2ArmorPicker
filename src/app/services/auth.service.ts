import {Injectable} from '@angular/core';
import {HttpClient} from "@angular/common/http";
import {environment} from "../../environments/environment";
import {Router} from "@angular/router";
import {DatabaseService} from "./database.service";

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  constructor(private http: HttpClient, private router: Router, private db: DatabaseService) {
  }


  async generateTokens() {
    console.info("Generate auth tokens")
    const CLIENT_ID = environment.clientId;
    const TOKEN = this.authCode;

    return await this.http.post<any>(`https://www.bungie.net/Platform/App/OAuth/Token/`,
      `grant_type=authorization_code&code=${TOKEN}&client_id=${CLIENT_ID}`, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-API-Key": environment.apiKey,
        }
      }).toPromise()
      .then(value => {
        this.accessToken = value.access_token;
        this.lastRefresh = Date.now()
      })
      .catch(err => {
        this.authCode = null;
        console.log({err})
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
    }
    else {
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
    }
    else {
      console.info("Setting new access token")
      localStorage.setItem("accessToken", "" + newCode)
    }
  }

  get lastRefresh() {
    let l = localStorage.getItem("lastRefresh") || "0";
    return l ? Number.parseInt(l) : null;
  }

  set lastRefresh(newCode: number | null) {
    if (!newCode)
      localStorage.removeItem("lastRefresh");
    else
      localStorage.setItem("lastRefresh", newCode.toString())
  }

  async logout() {
    this.accessToken = null;
    this.authCode = null;
    this.lastRefresh = null;

    localStorage.removeItem("LastArmorUpdate")
    await this.router.navigate(["login"]);
  }
}
