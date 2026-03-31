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

import { Injectable, OnDestroy } from "@angular/core";
import { ConfigurationService } from "./configuration.service";
import {
  ArmorStat,
  ARMORSTAT_ORDER,
  ArmorStatHashes,
  STAT_MOD_VALUES,
  StatModifier,
  SubclassHashes,
} from "../data/enum/armor-stat";
import { ResultDefinition } from "../components/authenticated-v2/results/results.component";
import { ModInformation } from "../data/ModInformation";
import { ModifierType, Subclass, SubclassNames } from "../data/enum/modifierType";
import {
  AssumeArmorMasterwork,
  Loadout,
  LoadoutParameters,
} from "@destinyitemmanager/dim-api-types";
import { DestinyClass } from "bungie-api-ts/destiny2";
import { LoggingProxyService } from "./logging-proxy.service";

@Injectable({
  providedIn: "root",
})
export class DimService implements OnDestroy {
  private armorStatIds = ARMORSTAT_ORDER;

  constructor(
    private configService: ConfigurationService,
    private logger: LoggingProxyService
  ) {
    this.logger.debug("DimService", "constructor", "Initializing DimService");
  }

  ngOnDestroy(): void {
    this.logger.debug("DimService", "ngOnDestroy", "Destroying DimService");
  }

  /**
   * Generate a DIM search query for the given result
   */
  generateDIMQuery(result: ResultDefinition): string {
    let query = result.items.map((d) => `(id:'${d.itemInstanceId}')`).join(" OR ");

    return query;
  }

  /**
   * Copy DIM query to clipboard
   */
  async copyDIMQuery(result: ResultDefinition): Promise<boolean> {
    try {
      const query = this.generateDIMQuery(result);

      // Use ClipboardItem with explicit text/plain type for better iOS compatibility
      if (navigator.clipboard && navigator.clipboard.write) {
        const clipboardItem = new ClipboardItem({
          "text/plain": new Blob([query], { type: "text/plain" }),
        });
        await navigator.clipboard.write([clipboardItem]);
        return true;
      }

      // Fallback to writeText if ClipboardItem is not supported
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(query);
        return true;
      }

      return false;
    } catch (error) {
      // Fallback to writeText on error
      try {
        const query = this.generateDIMQuery(result);
        await navigator.clipboard.writeText(query);
        return true;
      } catch (fallbackError) {
        return false;
      }
    }
  }

  /**
   * Generate a DIM loadout link for the given result
   */
  generateDIMLink(result: ResultDefinition): string {
    const config = this.configService.readonlyConfigurationSnapshot;
    const mods: number[] = [];
    const fragments: number[] = [];

    // Add selected mods
    for (let mod of config.enabledMods) {
      const modInfo = ModInformation[mod];
      if (modInfo.type === ModifierType.CombatStyleMod) {
        mods.push(modInfo.hash);
      } else {
        fragments.push(modInfo.hash);
      }
    }

    // Add stat mods
    for (let mod of result.mods || []) {
      mods.push(STAT_MOD_VALUES[mod as StatModifier][3]);
    }

    // Add artifice mods
    for (let artificemod of result.artifice || []) {
      mods.push(STAT_MOD_VALUES[artificemod as StatModifier][3]);
    }

    const data: LoadoutParameters = {
      statConstraints: [],
      mods,
      assumeArmorMasterwork: config.assumeLegendariesMasterworked
        ? config.assumeExoticsMasterworked
          ? AssumeArmorMasterwork.All
          : AssumeArmorMasterwork.Legendary
        : AssumeArmorMasterwork.None,
    };

    // Iterate over ArmorStat enum
    for (let stat of this.armorStatIds) {
      data.statConstraints!.push({
        statHash: ArmorStatHashes[stat as ArmorStat],
        minStat: config.minimumStatTiers[stat as ArmorStat].value * 10,
        maxStat: config.minimumStatTiers[stat as ArmorStat].fixed
          ? config.minimumStatTiers[stat as ArmorStat].value * 10
          : 200,
      } as any); // TODO: Remove the `as any` cast when the type is fixed in DIM API types
    }

    const exoticItem = result.items.find((item) => item.exotic);
    if (exoticItem) {
      data.exoticArmorHash = exoticItem.hash;
    }

    const loadout: Loadout = {
      id: "d2ap",
      name: `${SubclassNames[config.selectedModElement as Subclass]}: (${result.exotic?.name}) D2ArmorPicker Loadout`,
      classType: config.characterClass as number,
      parameters: data,
      equipped: result.items.map((d) => ({
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
        config.characterClass != DestinyClass.Unknown &&
        config.selectedModElement != ModifierType.CombatStyleMod
      ) {
        const cl = SubclassHashes[config.characterClass];
        const subclassHash = cl[config.selectedModElement];
        if (subclassHash) {
          loadout.equipped.push({
            id: "12345",
            hash: subclassHash,
            socketOverrides,
          });
        }
      }
    }

    return (
      "https://app.destinyitemmanager.com/loadouts?loadout=" +
      encodeURIComponent(JSON.stringify(loadout))
    );
  }

  /**
   * Open DIM in a new window/tab with the given result
   */
  openInDIM(result: ResultDefinition): void {
    const url = this.generateDIMLink(result);
    window.open(url, "blank");
  }
}
