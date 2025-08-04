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
import { NGXLogger } from "ngx-logger";
import { StatusProviderService } from "../../../services/status-provider.service";
import { Observable } from "rxjs";
import { BreakpointObserver, Breakpoints } from "@angular/cdk/layout";
import { map, shareReplay } from "rxjs/operators";
import { InventoryService } from "../../../services/inventory.service";
import { AuthService } from "../../../services/auth.service";
import { NavigationEnd, Router } from "@angular/router";
import { environment } from "../../../../environments/environment";
import { ChangelogService } from "../../../services/changelog.service";
import { CharacterStatsService } from "../../../services/character-stats.service";

@Component({
  selector: "app-app-v2-core",
  templateUrl: "./app-v2-core.component.html",
  styleUrls: ["./app-v2-core.component.scss"],
})
export class AppV2CoreComponent implements OnInit {
  version = environment.version;
  activeLinkIndex = 0;
  computationProgress = 0;
  navLinks = [
    {
      link: "/",
      name: "Home",
    },
    {
      link: "/help",
      name: "Help",
    },
    {
      link: "/account",
      name: "Account",
    },
  ];

  constructor(
    public status: StatusProviderService,
    private breakpointObserver: BreakpointObserver,
    private inv: InventoryService,
    private auth: AuthService,
    private router: Router,
    private characterStats: CharacterStatsService,
    public changelog: ChangelogService,
    private logger: NGXLogger
  ) {}

  isHandset$: Observable<boolean> = this.breakpointObserver
    .observe([Breakpoints.Handset, Breakpoints.Small, Breakpoints.XSmall])
    .pipe(
      map((result) => result.matches),
      shareReplay()
    );

  ngOnInit(): void {
    this.activeLinkIndex = this.navLinks.indexOf(
      this.navLinks.find((tab) => tab.link === this.router.url) as any
    );

    this.router.events.subscribe((res) => {
      if (res instanceof NavigationEnd)
        this.activeLinkIndex = this.navLinks.indexOf(
          this.navLinks.find((tab) => tab.link === this.router.url) as any
        );
    });

    this.characterStats.loadCharacterStats();

    this.inv.calculationProgress.subscribe((progress) => {
      this.computationProgress = progress;
    });
  }

  async refreshAll(b: boolean) {
    this.logger.debug("AppV2CoreComponent", "refreshAll", "Trigger refreshAll due to button press");
    await this.inv.refreshAll(b);
  }

  logout() {
    this.auth.logout();
  }
}
