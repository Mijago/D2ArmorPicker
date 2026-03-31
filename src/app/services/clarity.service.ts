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

import { Injectable, OnDestroy } from "@angular/core";
import { LoggingProxyService } from "./logging-proxy.service";
import { HttpClient } from "@angular/common/http";
import { Observable, BehaviorSubject } from "rxjs";

import type { CharacterStats } from "../data/character_stats/schema";
import { UserInformationService } from "src/app/services/user-information.service";

const BASE_URL = "https://Database-Clarity.github.io/Character-Stats";
export const SUPPORTED_SCHEMA_VERSION = "1.9";
export const CHARACTER_STATS_URL = `${BASE_URL}/versions/${SUPPORTED_SCHEMA_VERSION}/CharacterStatInfo-NI.json`;
export const UPDATES_URL = `${BASE_URL}/update.json`;

const LOCAL_STORAGE_STATS_VERSION_KEY = "clarity-character-stats-version";
const LOCAL_STORAGE_STATS_KEY = "clarity-character-stats";

export type UpdateData = {
  lastUpdate: number;
  schemaVersion: string;
};

/**
 * TODO:
 * Currently this fetches and cached a single hardcoded data URL.
 * After the current clarity PR is merged this must implement periodic version fetching and updating.
 */
@Injectable({
  providedIn: "root",
})
export class ClarityService implements OnDestroy {
  private _characterStats: BehaviorSubject<CharacterStats | null> =
    new BehaviorSubject<CharacterStats | null>(null);
  public readonly characterStats: Observable<CharacterStats | null> =
    this._characterStats.asObservable();

  constructor(
    private http: HttpClient,
    private userInfo: UserInformationService,
    private logger: LoggingProxyService
  ) {
    this.logger.debug("ClarityService", "constructor", "Initializing ClarityService");
    // trigger a clarity reload on manifest change
    this.userInfo.manifest.subscribe((_) => this.load());
  }

  ngOnDestroy(): void {
    this.logger.debug("ClarityService", "ngOnDestroy", "Destroying ClarityService");
  }

  async load() {
    try {
      await this.loadCharacterStats();
    } catch (err) {
      this.logger.warn("Error loading Clarity data", err);
    }
  }

  private async fetchUpdateData() {
    try {
      return await this.http.get<UpdateData>(UPDATES_URL).toPromise();
    } catch (error) {
      this.logger.warn("ClarityService", "fetchUpdateData", "Failed to fetch update data", error);
      return null;
    }
  }

  // Load data from cache or fetch live data if necessary
  private async loadCharacterStats() {
    // If we have any stored data, we can just make it available right away
    const storedData = localStorage.getItem(LOCAL_STORAGE_STATS_KEY);
    if (storedData) {
      this._characterStats.next(JSON.parse(storedData));
    }

    const liveVersion = await this.fetchUpdateData();
    const storedVersion = parseInt(localStorage.getItem(LOCAL_STORAGE_STATS_VERSION_KEY) || "0");

    // There’s new data available
    if (liveVersion && liveVersion.lastUpdate > storedVersion) {
      if (liveVersion.schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
        this.logger.warn(
          "Unsupported live character stats schema version",
          liveVersion.schemaVersion
        );
      } else if (liveVersion && liveVersion.lastUpdate !== undefined) {
        try {
          const data = await this.fetchLiveCharacterStats();
          localStorage.setItem(LOCAL_STORAGE_STATS_KEY, JSON.stringify(data));
          localStorage.setItem(LOCAL_STORAGE_STATS_VERSION_KEY, liveVersion.lastUpdate.toString());
          this._characterStats.next(data);
        } catch (error) {
          this.logger.warn(
            "ClarityService",
            "loadCharacterStats",
            "Failed to load live character stats",
            error
          );
        }
      }
    }
  }

  private async fetchLiveCharacterStats() {
    try {
      return await this.http.get<CharacterStats>(CHARACTER_STATS_URL).toPromise();
    } catch (error) {
      this.logger.warn(
        "ClarityService",
        "fetchLiveCharacterStats",
        "Failed to fetch live character stats",
        error
      );
      throw error;
    }
  }
}
