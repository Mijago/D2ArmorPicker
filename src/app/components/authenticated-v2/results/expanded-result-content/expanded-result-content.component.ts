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
  ArmorPerkOrSlot,
  ArmorPerkOrSlotDIMText,
  ArmorStat,
  ArmorStatHashes,
  ArmorStatIconUrls,
  ArmorStatNames,
  SpecialArmorStat,
  STAT_MOD_VALUES,
  StatModifier,
  SubclassHashes,
} from "src/app/data/enum/armor-stat";
import { ResultDefinition, ResultItem, ResultItemMoveState } from "../results.component";
import { ConfigurationService } from "../../../../services/configuration.service";
import { ModInformation } from "../../../../data/ModInformation";
import { ModifierValue } from "../../../../data/modifier";
import { MatSnackBar } from "@angular/material/snack-bar";
import { BungieApiService } from "../../../../services/bungie-api.service";
import { ModOrAbility } from "../../../../data/enum/modOrAbility";
import { DestinyClass } from "bungie-api-ts/destiny2";
import { SubclassNames, ModifierType, Subclass } from "../../../../data/enum/modifierType";
import { BuildConfiguration } from "../../../../data/buildConfiguration";
import { takeUntil } from "rxjs/operators";
import { Subject } from "rxjs";
import { MASTERWORK_COST_EXOTIC, MASTERWORK_COST_LEGENDARY } from "../../../../data/masterworkCost";
import {
  AssumeArmorMasterwork,
  Loadout,
  LoadoutParameters,
} from "@destinyitemmanager/dim-api-types";
import { MembershipService } from "src/app/services/membership.service";
import { ArmorSlot } from "src/app/data/enum/armor-slot";
import { DestinyClassNames } from "src/app/data/enum/DestinyClassNames";

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
    private membership: MembershipService
  ) {}

  public async CopyDIMQuery() {
    if (!this.element) return;
    let result = this.element.items
      .filter((d) => d.slot != ArmorSlot.ArmorSlotClass)
      .map((d) => `id:'${d.itemInstanceId}'`)
      .join(" OR ");

    // Exotic class item
    let classItemFilters = this.element.classItem.canBeExotic
      ? this.element.classItem.isExotic
        ? [`${this.element.exotic?.name}`]
        : ["is:classitem", `is:${DestinyClassNames[this.config_characterClass]}`]
      : ["is:classitem", `is:${DestinyClassNames[this.config_characterClass]}`, `-is:exotic`];

    if (
      this.element.classItem.perk != ArmorPerkOrSlot.Any &&
      this.element.classItem.perk != ArmorPerkOrSlot.None &&
      this.element.classItem.perk != undefined
    ) {
      classItemFilters.push(ArmorPerkOrSlotDIMText[this.element.classItem.perk]);
    }
    if (classItemFilters.length > 0) result += ` OR (${classItemFilters.join(" AND ")})`;
    await navigator.clipboard.writeText(result);
    this.openSnackBar("Copied the DIM search query to your clipboard.");
  }

  openSnackBar(message: string) {
    this._snackBar.open(message, "", {
      duration: 2500,
      politeness: "polite",
    });
  }

  ngOnInit(): void {
    // set this.showGenericClassItemRow to true if the number of non-empty elements in this.element.items is <= 4
    this.ArmorItems = this.element?.items.filter((x) => x.slot != ArmorSlot.ArmorSlotClass) || null;
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

      this.DIMUrl = this.generateDIMLink(c);
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

  generateDIMLink(c: BuildConfiguration): string {
    const mods: number[] = [];
    const fragments: number[] = [];

    // add selected mods
    for (let mod of this.config_enabledMods) {
      const modInfo = ModInformation[mod];
      if (modInfo.type === ModifierType.CombatStyleMod) {
        mods.push(modInfo.hash);
      } else {
        fragments.push(modInfo.hash);
      }
    }

    // add stat mods
    if (this.element) {
      for (let mod of this.element?.mods || []) {
        mods.push(STAT_MOD_VALUES[mod as StatModifier][3]);
      }
      // add artifice mods
      for (let artificemod of this.element?.artifice || []) {
        mods.push(STAT_MOD_VALUES[artificemod as StatModifier][3]);
      }
    }

    var data: LoadoutParameters = {
      statConstraints: [],
      mods,
      assumeArmorMasterwork: c.assumeLegendariesMasterworked
        ? c.assumeExoticsMasterworked
          ? AssumeArmorMasterwork.All
          : AssumeArmorMasterwork.Legendary
        : AssumeArmorMasterwork.None,
    };

    // iterate over ArmorStat enum
    for (let stat of this.armorStatIds) {
      data.statConstraints!.push({
        statHash: ArmorStatHashes[stat],
        minTier: c.minimumStatTiers[stat].value,
        maxTier: c.minimumStatTiers[stat].fixed ? c.minimumStatTiers[stat].value : 10,
      });
    }

    if (c.selectedExotics.length == 1) {
      data.exoticArmorHash = c.selectedExotics[0];
    } else {
      var exos = this.element?.exotic;
      if (exos) {
        var exoticHash = exos.hash;
        if (!!exoticHash) data.exoticArmorHash = parseInt(exoticHash, 10);
      }
    }

    const loadout: Loadout = {
      id: "d2ap", // this doesn't matter and will be replaced
      name: `${SubclassNames[c.selectedModElement as Subclass]}: (${this.element?.exotic?.name}) D2ArmorPicker Loadout`,
      classType: c.characterClass as number,
      parameters: data,
      equipped: (this.element?.items || []).map((d) => ({
        id: d.itemInstanceId,
        hash: d.hash,
      })),
      unequipped: [],
      clearSpace: false,
    };

    // Configure subclass
    if (fragments.length) {
      const socketOverrides = fragments.reduce<{
        [socketIndex: number]: number;
      }>((m, hash, i) => {
        m[i + 7] = hash;
        return m;
      }, {});

      if (
        c.characterClass != DestinyClass.Unknown &&
        c.selectedModElement != ModifierType.CombatStyleMod
      ) {
        const cl = SubclassHashes[c.characterClass];
        const subclassHash = cl[c.selectedModElement];
        if (subclassHash) {
          loadout.equipped.push({
            id: "12345", // This shouldn't need to be specified but right now it does. The value doesn't matter
            hash: subclassHash,
            socketOverrides,
          });
        }
      }
    }

    var url =
      "https://app.destinyitemmanager.com/loadouts?loadout=" +
      encodeURIComponent(JSON.stringify(loadout));

    return url;
  }

  goToDIM() {
    window.open(this.DIMUrl, "blank");
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
