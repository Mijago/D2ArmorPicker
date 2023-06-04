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

import { Component, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { AuthService } from "../../services/auth.service";

@Component({
  selector: "app-handle-bungie-login",
  templateUrl: "./handle-bungie-login.component.html",
  styleUrls: ["./handle-bungie-login.component.css"],
})
export class HandleBungieLoginComponent implements OnInit {
  constructor(
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private loginService: AuthService
  ) {}

  ngOnInit(): void {
    this.activatedRoute.queryParams.subscribe(async (params) => {
      let code = params["code"];
      if (window.location.search.indexOf("?code=") > -1) code = window.location.search.substr(6);

      console.info({ code });

      if (!code) return;

      this.loginService.authCode = code;

      console.info("Generate tokens with the new code");
      await this.loginService.generateTokens();

      console.info("Now navigate to /");
      await this.router.navigate(["/"]);
    });
  }
}
