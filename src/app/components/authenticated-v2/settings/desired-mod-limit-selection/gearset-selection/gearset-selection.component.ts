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

import { Component, OnInit, OnDestroy } from "@angular/core";
import { DestinySandboxPerkDefinition } from "bungie-api-ts/destiny2";
import { Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";
import { BungieApiService } from "src/app/services/bungie-api.service";
import { DatabaseService } from "src/app/services/database.service";

interface GearSetBonus {
  perk: DestinySandboxPerkDefinition | undefined;
  enabled: boolean;
}

interface GearSet {
  name: string;
  twoPieceBonus: GearSetBonus;
  fourPieceBonus: GearSetBonus;
}

@Component({
  selector: "app-gearset-selection",
  templateUrl: "./gearset-selection.component.html",
  styleUrls: ["./gearset-selection.component.scss"],
})
export class GearsetSelectionComponent implements OnInit, OnDestroy {
  constructor(
    private bungieApiService: BungieApiService,
    private db: DatabaseService
  ) {}
  ngOnInit(): void {
    this.bungieApiService.manifestUpdated$
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe(async () => {
        console.log("Manifest updated, refreshing gear sets");

        this.gearSets = [];
        const gearsets = await this.db.equipableItemSetDefinition.toArray();
        for (const gearset of gearsets) {
          const twoPieceBonusInfo =
            gearset.setPerks.find((perk) => perk.requiredSetCount == 2)?.sandboxPerkHash || 0;
          const twoPieceBonusData = await this.db.sandboxPerkDefinition
            .where({ hash: twoPieceBonusInfo })
            .first();

          const fourPieceBonusInfo =
            gearset.setPerks.find((perk) => perk.requiredSetCount == 4)?.sandboxPerkHash || 0;
          const fourPieceBonusData = await this.db.sandboxPerkDefinition
            .where({ hash: fourPieceBonusInfo })
            .first();

          this.gearSets.push({
            name: gearset.displayProperties.name || "Unknown Gear Set",
            twoPieceBonus: {
              perk: twoPieceBonusData,
              enabled: false,
            },
            fourPieceBonus: {
              perk: fourPieceBonusData,
              enabled: false,
            },
          });
        }
      });
  }
  public gearSets: GearSet[] = [];

  get hasTwoPieceSelected(): boolean {
    return this.gearSets.some((gearSet) => gearSet.twoPieceBonus.enabled);
  }

  get selectedTwoPieceCount(): number {
    return this.gearSets.reduce(
      (count, gearSet) => count + (gearSet.twoPieceBonus.enabled ? 1 : 0),
      0
    );
  }

  onTwoPieceBonusChange(gearSetIndex: number, enabled?: boolean) {
    if (enabled === undefined) enabled = !this.gearSets[gearSetIndex].twoPieceBonus.enabled;

    this.gearSets[gearSetIndex].twoPieceBonus.enabled = enabled;

    // If we now have 2 two-piece bonuses selected, disable all 4-piece bonuses
    if (this.selectedTwoPieceCount >= 2) {
      this.gearSets.forEach((gearSet) => {
        gearSet.fourPieceBonus.enabled = false;
      });
    }
  }

  onFourPieceBonusChange(gearSetIndex: number, enabled?: boolean) {
    if (enabled === undefined) enabled = !this.gearSets[gearSetIndex].fourPieceBonus.enabled;

    // Only allow enabling if no two-piece bonuses are selected
    if (enabled && this.hasTwoPieceSelected) {
      return;
    }

    this.gearSets[gearSetIndex].fourPieceBonus.enabled = enabled;

    // If enabling a 4-piece bonus, disable all other 4-piece bonuses and all 2-piece bonuses
    if (enabled) {
      this.gearSets.forEach((gearSet, gsIndex) => {
        gearSet.twoPieceBonus.enabled = false;
        if (gsIndex !== gearSetIndex) gearSet.fourPieceBonus.enabled = false;
      });
    }
  }

  isFourPieceDisabled(): boolean {
    return this.hasTwoPieceSelected;
  }

  private ngUnsubscribe = new Subject();

  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }
}
