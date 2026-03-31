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

import { Component, OnDestroy, OnInit } from "@angular/core";
import { Subject } from "rxjs";
import { ConfigurationService } from "../../../../services/configuration.service";
import { takeUntil } from "rxjs/operators";
import { UserInformationService } from "src/app/services/user-information.service";
import { DestinyClass } from "bungie-api-ts/destiny2";

@Component({
  selector: "app-desired-class-selection",
  templateUrl: "./desired-class-selection.component.html",
  styleUrls: ["./desired-class-selection.component.scss"],
})
export class DesiredClassSelectionComponent implements OnInit, OnDestroy {
  itemCounts: (null | number)[] = [null, null, null];
  selectedClass = -1;
  public characters: {
    emblemUrl: string;
    characterId: string;
    clazz: DestinyClass;
    lastPlayed: number;
  }[] = [];

  public storedMaterials: {
    "3853748946": number;
    "4257549985": number;
    "4257549984": number;
    "3159615086": number;
    "3467984096": number;
  } | null = null;

  constructor(
    public config: ConfigurationService,
    public inv: UserInformationService
  ) {}

  ngOnInit(): void {
    // Subscribe to characters Observable
    this.inv.characters.pipe(takeUntil(this.ngUnsubscribe)).subscribe((characters) => {
      this.characters = characters;
    });

    this.config.configuration.pipe(takeUntil(this.ngUnsubscribe)).subscribe((c) => {
      this.selectedClass = c.characterClass;

      // find valid
      const classAvailable =
        this.characters.findIndex((chr) => chr.clazz == c.characterClass) != -1;
      if (this.characters.length > 0 && !classAvailable) {
        this.config.modifyConfiguration((d) => {
          d.characterClass = this.characters[0].clazz;
          d.selectedExotics = [];
        });
      }
    });
    this.inv.inventory.pipe(takeUntil(this.ngUnsubscribe)).subscribe(async (k) => {
      await this.loadStoredMaterials();
      await this.updateItemCount();
    });
  }

  selectClass(clazz: number) {
    if (this.config.readonlyConfigurationSnapshot.characterClass == clazz) return;

    this.config.modifyConfiguration((d) => {
      d.characterClass = clazz;
      d.selectedExotics = [];
    });
  }

  private ngUnsubscribe = new Subject();

  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }

  private async updateItemCount() {
    for (let n = 0; n < 3; n++) this.itemCounts[n] = await this.inv.getItemCountForClass(n);
  }

  private async loadStoredMaterials() {
    var k: {
      "3853748946": number;
      "4257549985": number;
      "4257549984": number;
      "3159615086": number;
      "3467984096": number;
    } = JSON.parse(localStorage.getItem("user-materials") || "{}");

    this.storedMaterials = {
      "3853748946": k["3853748946"] ?? 0,
      "4257549985": k["4257549985"] ?? 0,
      "4257549984": k["4257549984"] ?? 0,
      "3159615086": k["3159615086"] ?? 0,
      "3467984096": k["3467984096"] ?? 0,
    };
  }
}
