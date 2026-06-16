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

import { AfterViewInit, Component, OnInit } from "@angular/core";
import { environment } from "../environments/environment";
import { UserInformationService } from "src/app/services/user-information.service";
import { LoggingProxyService, LogEntry } from "./services/logging-proxy.service";
import { AuthService } from "./services/auth.service";
import { Observable } from "rxjs";

@Component({
  selector: "app-root",
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"],
})
export class AppComponent implements AfterViewInit, OnInit {
  title = "D2ArmorPicker";
  is_beta = environment.beta;
  is_canary = environment.canary;
  showLogs = environment.showLogs;
  recentLogs$: Observable<LogEntry[]>;

  constructor(
    private userInformationService: UserInformationService,
    private logger: LoggingProxyService,
    public authService: AuthService
  ) {
    this.recentLogs$ = this.logger.getRecentLogs();
  }

  ngOnInit() {
    this.logger.debug("AppComponent", "ngOnInit", "Application initialized");
    window.addEventListener("unhandledrejection", (event) => {
      this.logger.error("AppV2CoreComponent", "Unhandled Promise Rejection", JSON.stringify(event));
    });
    window.onerror = (errorMsg, url, lineNumber) => {
      this.logger.error(
        "AppV2CoreComponent",
        "Unhandled Error",
        JSON.stringify({ errorMsg, url, lineNumber })
      );
      return false;
    };
  }

  ngAfterViewInit(): void {
    // Check if UserInformationService is initialized after 10 seconds
    // if not, forcefully trigger an initial refreshAll
    setTimeout(() => {
      if (
        !this.userInformationService.isInitialized &&
        !this.userInformationService.isFetchingManifest
      ) {
        this.logger.warn(
          "AppComponent",
          "ngAfterViewInit",
          "UserInformationService is not initialized after 10 seconds, triggering initial refreshManifestAndArmor."
        );
        this.userInformationService.refreshManifestAndInventory(true, true).catch((err) => {
          this.logger.error(
            "AppComponent",
            "ngAfterViewInit",
            "Error during initial refreshManifestAndArmor:",
            err
          );
        });
      }
    }, 10 * 1000);
  }

  /**
   * Get CSS class for log level
   */
  getLogLevelClass(level: number): string {
    switch (level) {
      case 0: // TRACE
        return "log-trace";
      case 1: // DEBUG
        return "log-debug";
      case 2: // INFO
        return "log-info";
      case 3: // WARN
        return "log-warn";
      case 4: // ERROR
        return "log-error";
      case 5: // FATAL
        return "log-fatal";
      default:
        return "log-info";
    }
  }

  /**
   * Clear recent logs
   */
  clearLogs(): void {
    this.logger.clearRecentLogs();
  }
}
