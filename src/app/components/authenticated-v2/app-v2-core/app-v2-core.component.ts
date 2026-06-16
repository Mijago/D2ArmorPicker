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

import {
  Component,
  OnInit,
  AfterViewInit,
  ChangeDetectionStrategy,
  OnDestroy,
  ChangeDetectorRef,
  NgZone,
} from "@angular/core";
import { LoggingProxyService } from "../../../services/logging-proxy.service";
import { StatusProviderService } from "../../../services/status-provider.service";
import { Observable, Subject } from "rxjs";
import { BreakpointObserver, Breakpoints } from "@angular/cdk/layout";
import { map, shareReplay, takeUntil } from "rxjs/operators";
import { UserInformationService } from "src/app/services/user-information.service";
import { ArmorCalculatorService } from "../../../services/armor-calculator.service";
import { AuthService } from "../../../services/auth.service";
import { NavigationEnd, Router } from "@angular/router";
import { environment } from "../../../../environments/environment";
import { ChangelogService } from "../../../services/changelog.service";
import { CharacterStatsService } from "../../../services/character-stats.service";

@Component({
  selector: "app-app-v2-core",
  templateUrl: "./app-v2-core.component.html",
  styleUrls: ["./app-v2-core.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppV2CoreComponent implements OnInit, AfterViewInit, OnDestroy {
  version = environment.version;
  activeLinkIndex = 0;
  computationProgress = 0;
  private ngUnsubscribe = new Subject();
  navLinks = [
    {
      link: "/",
      name: "Home",
    },
    {
      link: "/cluster",
      name: "Clustering",
    },
    {
      link: "/help",
      name: "Help",
    },
    {
      link: "/account",
      name: "Account",
    },
    {
      link: "/privacy-policy",
      name: "Privacy Policy",
    },
  ];

  constructor(
    public status: StatusProviderService,
    private breakpointObserver: BreakpointObserver,
    private inv: UserInformationService,
    private armorCalculator: ArmorCalculatorService,
    private auth: AuthService,
    private router: Router,
    private characterStats: CharacterStatsService,
    public changelog: ChangelogService,
    private logger: LoggingProxyService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {
    this.logger.debug("AppV2CoreComponent", "constructor", "Component initialized");
  }

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
  }

  ngAfterViewInit(): void {
    this.logger.debug("AppV2CoreComponent", "ngAfterViewInit", "Component after view initialized");
    this.changelog.checkAndShowChangelog();
    this.characterStats.loadCharacterStats();
    this.armorCalculator.calculationProgress
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe((progress) => {
        this.ngZone.run(() => {
          this.computationProgress = progress;
          this.cdr.markForCheck();
        });
      });
  }

  async refreshAll(b: boolean) {
    this.logger.debug("AppV2CoreComponent", "refreshAll", "Trigger refreshAll due to button press");
    try {
      await this.inv.refreshManifestAndInventory(b);
    } catch (error) {
      this.logger.error(
        "AppV2CoreComponent",
        "refreshAll",
        "Failed to refresh manifest and inventory",
        error
      );
    }
  }

  async logout() {
    try {
      await this.auth.logout();
      this.logger.debug("AppV2CoreComponent", "logout", "Logout successful, navigating to login");
      await this.router.navigate(["login"]);
    } catch (error) {
      this.logger.error("AppV2CoreComponent", "logout", "Failed during logout process", error);
      // Still try to navigate even if logout fails
      try {
        await this.router.navigate(["login"]);
      } catch (navError) {
        this.logger.error("AppV2CoreComponent", "logout", "Failed to navigate to login", navError);
      }
    }
  }

  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }
}
