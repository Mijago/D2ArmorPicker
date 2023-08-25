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
import { HttpClient } from "@angular/common/http";
import { Observable, BehaviorSubject, of } from "rxjs";

import type { CharacterStats } from "./data/character_stats/schema";

const CHARACTER_STATS_URL =
  "https://raw.githubusercontent.com/Database-Clarity/Character-Stats/wip/versions/1.8/CharacterStatInfo-NI.json";
const LOCAL_STORAGE_KEY = "clarity-character-stats";

/**
 * TODO:
 * Currently this fetches and cached a single hardcoded data URL.
 * After the current clarity PR is merged this must implement periodic version fetching and updating.
 */
@Injectable({
  providedIn: "root",
})
export class ClarityService {
  private _characterStats: BehaviorSubject<CharacterStats | null> =
    new BehaviorSubject<CharacterStats | null>(null);
  public readonly characterStats: Observable<CharacterStats | null> =
    this._characterStats.asObservable();

  constructor(private http: HttpClient) {}

  // Load data from cache or fetch live data if necessary
  loadCharacterStats() {
    const storedData = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (storedData) {
      console.log("Using cached character stats data");
      this._characterStats.next(JSON.parse(storedData));
    } else {
      console.log("Fetching character stats data");
      this.fetchLiveCharacterStats();
    }
  }

  private fetchLiveCharacterStats() {
    this.http
      .get<CharacterStats>(CHARACTER_STATS_URL)
      .toPromise()
      .then((data) => {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
        this._characterStats.next(data);
      })
      .catch((err) => {
        console.log("Clarity fetch err", err);
      });
  }
}
