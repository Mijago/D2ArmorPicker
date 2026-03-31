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
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from "@angular/router";
import { Observable } from "rxjs";
import { AuthService } from "../services/auth.service";
import { HttpClientService } from "../services/http-client.service";

@Injectable({
  providedIn: "root",
})
export class AuthenticatedGuard {
  constructor(
    public auth: AuthService,
    public httpClient: HttpClientService,
    public router: Router
  ) {}
  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    if (!this.httpClient.isAuthenticated()) {
      // Check if there's a code parameter in the query string
      if (state.url.includes("?code=") || route.queryParams["code"]) {
        this.router.navigate(["authenticate"], { queryParams: route.queryParams });
      } else {
        this.router.navigate(["login"]);
      }
      return false;
    }
    return true;
  }
}
