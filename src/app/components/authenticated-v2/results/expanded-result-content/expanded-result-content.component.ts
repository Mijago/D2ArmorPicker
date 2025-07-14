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
 *
 * Additional copyrighted lines in this file:
 *  bhollis (adaption of the DIM links)
 */

import { Component, Input, OnDestroy, OnInit } from "@angular/core";
import {
  ArmorStat,
  ArmorStatIconUrls,
  ArmorStatNames,
  SpecialArmorStat,
  StatModifier,
} from "src/app/data/enum/armor-stat";
import { ResultDefinition, ResultItem, ResultItemMoveState } from "../results.component";
import { ConfigurationService } from "../../../../services/configuration.service";
import { ModInformation } from "../../../../data/ModInformation";
import { ModifierValue } from "../../../../data/modifier";
import { MatSnackBar } from "@angular/material/snack-bar";
import { BungieApiService } from "../../../../services/bungie-api.service";
import { ModOrAbility } from "../../../../data/enum/modOrAbility";
import { DestinyClass } from "bungie-api-ts/destiny2";
import { ModifierType } from "../../../../data/enum/modifierType";
import { takeUntil } from "rxjs/operators";
import { Subject } from "rxjs";
import { MASTERWORK_COST_EXOTIC, MASTERWORK_COST_LEGENDARY } from "../../../../data/masterworkCost";
import { MembershipService } from "src/app/services/membership.service";
import { DimService } from "../../../../services/dim.service";

@Component({
  selector: "app-expanded-result-content",
  templateUrl: "./expanded-result-content.component.html",
  styleUrls: ["./expanded-result-content.component.scss"],
})
export class ExpandedResultContentComponent implements OnInit, OnDestroy {
  public exoticClassItemRow = false;
  public armorStatIds: ArmorStat[] = [0, 1, 2, 3, 4, 5];
  public ModifierType = ModifierType;
  public ModInformation = ModInformation;
  public ArmorStatNames = ArmorStatNames;
  public ArmorStatIconUrls = ArmorStatIconUrls;
  public ArmorStat = ArmorStat;
  public StatModifier = StatModifier;
  public config_characterClass = DestinyClass.Unknown;
  public config_assumeLegendariesMasterworked = false;
  public config_assumeExoticsMasterworked = false;
  public config_assumeClassItemMasterworked = false;
  public config_enabledMods: ModOrAbility[] = [];
  public DIMUrl: string = "";
  configValues: [number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0];

  @Input()
  element: ResultDefinition | null = null;
  ArmorItems: ResultItem[] | null = null;
  ExoticArmorItem: ResultItem | null = null;

  constructor(
    private config: ConfigurationService,
    private _snackBar: MatSnackBar,
    private bungieApi: BungieApiService,
    private membership: MembershipService,
    private dimService: DimService
  ) {}

  public async CopyDIMQuery() {
    if (!this.element) return;

    const success = await this.dimService.copyDIMQuery(this.element);
    if (success) {
      this.openSnackBar("Copied the DIM search query to your clipboard.");
    } else {
      this.openSnackBar("Failed to copy to clipboard.");
    }
  }

  openSnackBar(message: string) {
    this._snackBar.open(message, "", {
      duration: 2500,
      politeness: "polite",
    });
  }

  ngOnInit(): void {
    // set this.showGenericClassItemRow to true if the number of non-empty elements in this.element.items is <= 4
    this.ArmorItems = this.element?.items || null; //.filter((x) => x.slot != ArmorSlot.ArmorSlotClass) || null;
    this.ExoticArmorItem = this.element?.items.filter((x) => x.exotic)[0] || null;

    this.exoticClassItemRow = this.element?.classItem.isExotic ?? false;

    this.config.configuration.pipe(takeUntil(this.ngUnsubscribe)).subscribe((c) => {
      this.config_characterClass = c.characterClass;
      this.config_assumeLegendariesMasterworked = c.assumeLegendariesMasterworked;
      this.config_assumeExoticsMasterworked = c.assumeExoticsMasterworked;
      this.config_assumeClassItemMasterworked = c.assumeClassItemMasterworked;
      this.config_enabledMods = c.enabledMods;
      this.configValues = c.enabledMods
        .reduce((p, v) => {
          p = p.concat(ModInformation[v].bonus);
          return p;
        }, [] as ModifierValue[])
        .reduce(
          (p, v) => {
            if (v.stat == SpecialArmorStat.ClassAbilityRegenerationStat)
              p[[1, 0, 2][c.characterClass]] += v.value;
            else p[v.stat as number] += v.value;
            return p;
          },
          [0, 0, 0, 0, 0, 0]
        );

      this.DIMUrl = this.element ? this.dimService.generateDIMLink(this.element) : "";
    });
  }

  disableAllItems() {
    this.config.modifyConfiguration((cb) => {
      for (let item of this.element?.items.flat() as ResultItem[])
        cb.disabledItems.push(item.itemInstanceId);
    });
  }

  disableItem(itemInstanceId: string) {
    this.config.modifyConfiguration((cb) => {
      cb.disabledItems.push(itemInstanceId);
    });
  }

  get mayAnyItemBeBugged() {
    return (this.element?.items.flat().filter((d: ResultItem) => d.mayBeBugged).length || 0) > 0;
  }

  async getCharacterId() {
    // get character Id
    let characters = await this.membership.getCharacters();
    characters = characters.filter((c) => c.clazz == this.config_characterClass);
    if (characters.length == 0) {
      this.openSnackBar("Error: Could not find a character to move the items to.");
      return null;
    }
    return characters[0].characterId;
  }

  async moveItems(equip = false) {
    for (let item of (this.element?.items || []).flat()) {
      item.transferState = ResultItemMoveState.WAITING_FOR_TRANSFER;
    }

    let characterId = await this.getCharacterId();
    if (!characterId) return;

    let allSuccessful = true;
    let items = (this.element?.items || []).flat().sort((i) => (i.exotic ? 1 : -1));
    for (let item of items) {
      item.transferState = ResultItemMoveState.TRANSFERRING;
      let success = await this.bungieApi.transferItem(item.itemInstanceId, characterId, equip);
      item.transferState = success
        ? ResultItemMoveState.TRANSFERRED
        : ResultItemMoveState.ERROR_DURING_TRANSFER;
      if (!success) allSuccessful = false;
    }
    if (allSuccessful) {
      this.openSnackBar("Success! Moved all the items.");
    } else {
      this.openSnackBar(
        "Some of the items could not be moved. Make sure that there is enough space in the specific slot. This tool will not move items out of your inventory."
      );
    }
  }

  getItemsThatMustBeMasterworked(): ResultItem[] | undefined {
    return this.element?.items.flat().filter((item) => {
      if (item.masterworked) return false;
      if (item.exotic && !this.config_assumeExoticsMasterworked) return false;
      if (!item.exotic && !this.config_assumeLegendariesMasterworked) return false;

      return true;
    });
  }

  calculateRequiredMasterworkCost() {
    let cost: { [id: string]: number } = {
      shards: 0,
      glimmer: 0,
      core: 0,
      prism: 0,
      ascshard: 0,
      total: 0,
    };
    let items = this.element?.items.flat() || [];
    items = items.filter(
      (i) =>
        i.energyLevel < 10 &&
        ((i.exotic && this.config_assumeExoticsMasterworked) ||
          (!i.exotic && this.config_assumeLegendariesMasterworked))
    );
    for (let item of items) {
      let costList = item.exotic ? MASTERWORK_COST_EXOTIC : MASTERWORK_COST_LEGENDARY;
      for (let n = item.energyLevel; n < 10; n++)
        for (let entryName in costList[n + 1]) {
          cost[entryName] += costList[n + 1][entryName];
          cost["total"]++;
        }
    }
    return cost;
  }

  goToDIM() {
    if (this.element) {
      this.dimService.openInDIM(this.element);
    }
  }

  getTiersForStat(statId: number) {
    return Math.floor((this.element?.stats[statId] || 0) / 10);
  }

  getColumnForStat(statId: number) {
    var configValueTiers = Math.floor(this.configValues[statId] / 10);
    let d = [];
    let total = 0;

    let moddedTiersMinor = Math.ceil(
      ((this.element?.mods.filter((k) => k == 1 + 2 * statId) || []).length * 5 +
        (this.element?.mods.filter((k) => k == 2 + 2 * statId) || []).length * 10) /
        10
    );

    var tiers = this.getTiersForStat(statId) - configValueTiers - moddedTiersMinor;
    for (let n = 0; n < tiers; n++) {
      d.push("normal" + (++total > 10 ? " over100" : ""));
    }

    for (let cvt = 0; cvt < moddedTiersMinor; cvt++)
      d.push("mod" + (++total > 10 ? " over100" : ""));
    for (let cvt = 0; cvt < configValueTiers; cvt++)
      d.push("config" + (++total > 10 ? " over100" : ""));

    while (total++ < 10) d.push("");
    return d;
  }

  getRequiredMasterworkBonus() {
    return (
      (
        this.element?.items.filter(
          (i) =>
            (!i.masterworked && !i.exotic && this.config_assumeLegendariesMasterworked) ||
            (i.exotic && this.config_assumeExoticsMasterworked)
        ) || []
      ).length * 2
    );
  }

  private ngUnsubscribe = new Subject();

  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }
}
