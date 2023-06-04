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
import { AuthService } from "./auth.service";
import { BungieApiService } from "./bungie-api.service";
import { InventoryService } from "./inventory.service";
import { DestinyClass } from "bungie-api-ts/destiny2/interfaces";

@Injectable({
  providedIn: "root",
})
export class UserdataService {
  public characters:
    | any[]
    | { emblemUrl: string; characterId: string; clazz: DestinyClass; lastPlayed: number }[] = [];

  constructor(
    private auth: AuthService,
    private api: BungieApiService,
    private inventory: InventoryService
  ) {
    this.loadCachedData();

    auth.logoutEvent.subscribe((k) => this.clearCachedData());

    this.inventory.inventory.subscribe(async () => {
      await this.updateCharacterData();
    });
  }

  public clearCachedData() {
    this.characters = [];
    localStorage.removeItem("cachedCharacters");
  }

  private loadCachedData() {
    let item = localStorage.getItem("cachedCharacters") || "[]";
    this.characters = JSON.parse(item);
  }

  private async updateCharacterData() {
    this.characters = await this.api.getCharacters();
    localStorage.setItem("cachedCharacters", JSON.stringify(this.characters));
  }
}
