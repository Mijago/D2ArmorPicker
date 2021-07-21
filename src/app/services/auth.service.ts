import {Injectable} from '@angular/core';
import {HttpClient} from "@angular/common/http";
import {environment} from "../../environments/environment";

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  constructor(private http: HttpClient) {
  }


  async generateTokens() {
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
    if (!newCode)
      localStorage.removeItem("code");
    else
      localStorage.setItem("code", "" + newCode)
  }

  get accessToken() {
    return localStorage.getItem("accessToken");
  }

  set accessToken(newCode: string | null) {
    if (!newCode)
      localStorage.removeItem("accessToken");
    else
      localStorage.setItem("accessToken", "" + newCode)
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

  logout() {
    this.accessToken = null;
    this.authCode = null;
    this.lastRefresh = null;
  }
}
