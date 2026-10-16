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
import { ClarityService } from "./clarity.service";
import { ModifierType } from "../data/enum/modifierType";
import type { CharacterStats, Override } from "../data/character_stats/schema";
import { DestinyClass, DestinyInventoryItemDefinition } from "bungie-api-ts/destiny2";
import { DatabaseService } from "./database.service";
import { LoggingProxyService } from "./logging-proxy.service";

export enum CharacterStatType {
  Speed = 1,
  Percentage = 2,
  Time = 3,
  TimeMMSS = 4,
  PercentagePerSecond = 5,
}

export interface CooldownEntry {
  hash?: number;
  name: string;
  icon?: string;
  values: number[];
  description?: string;
  valueType?: CharacterStatType;
  characterClass?: DestinyClass;
  element?: ModifierType;

  // If any items are affecting this entry’s cooldown their hash will be added to this list
  overrideIcons?: number[];
}

/**
 * This component takes the raw character stat data from Clarity’s database
 * and converts it to data for use in stat tooltips.
 */
@Injectable({
  providedIn: "root",
})
export class CharacterStatsService implements OnDestroy {
  private allStatEntries: Partial<Record<keyof CharacterStats, CooldownEntry[]>> = {};
  private overrides: Override[] = [];

  constructor(
    private clarity: ClarityService,
    private db: DatabaseService,
    private logger: LoggingProxyService
  ) {
    this.logger.debug("CharacterStatsService", "constructor", "Initializing CharacterStatsService");
    this.clarity.characterStats.subscribe(async (data) => {
      if (data) await this.updateCharacterStats(data);
    });
  }

  ngOnDestroy(): void {
    this.logger.debug("CharacterStatsService", "ngOnDestroy", "Destroying CharacterStatsService");
  }

  loadCharacterStats() {
    this.clarity.load();
  }

  private async updateCharacterStats(data: CharacterStats) {
    const abilities = await this.db.getCharacterAbilities();
    const allAbilities = abilities.reduce((acc, ability) => {
      acc.set(ability.hash, ability);
      return acc;
    }, new Map<number, DestinyInventoryItemDefinition>());

    this.overrides = Object.values(data)
      .map((stat) => stat.Overrides)
      .flat();

    this.allStatEntries = {
      Mobility: this.generateEntries(data.Mobility, allAbilities, [
        {
          key: "WalkSpeed",
          name: "Walk Speed",
          valueType: CharacterStatType.Speed,
        },
        {
          key: "StrafeSpeed",
          name: "Strafe Speed",
          valueType: CharacterStatType.Speed,
        },
        {
          key: "CrouchSpeed",
          name: "Crouch Speed",
          valueType: CharacterStatType.Speed,
        },
      ]),
      Resilience: this.generateEntries(data.Resilience, allAbilities, [
        {
          key: "ShieldHP",
          name: "Shield HP",
        },
        {
          key: "PvEDamageResistance",
          name: "PvE Damage Resistance",
          valueType: CharacterStatType.Percentage,
        },
        {
          key: "FlinchResistance",
          name: "Flinch Resistance",
          valueType: CharacterStatType.Percentage,
        },
      ]),
      Recovery: this.generateEntries(data.Recovery, allAbilities, [
        {
          key: "TotalRegenTime",
          name: "Total Regen Time",
          valueType: CharacterStatType.Time,
        },
        {
          key: "HealthRegenDelay",
          name: "Health Regen Delay",
          valueType: CharacterStatType.Time,
        },
        {
          key: "HealthRegenSpeed",
          name: "Health Regen Speed",
          valueType: CharacterStatType.PercentagePerSecond,
        },
        {
          key: "ShieldRegenDelay",
          name: "Shield Regen Delay",
          valueType: CharacterStatType.Time,
        },
        {
          key: "ShieldRegenSpeed",
          name: "Shield Regen Speed",
          valueType: CharacterStatType.PercentagePerSecond,
        },
      ]),
      Discipline: this.generateEntries(data.Discipline, allAbilities),
      Intellect: this.generateEntries(data.Intellect, allAbilities),
      Strength: this.generateEntries(data.Strength, allAbilities),
    };
  }

  /**
   * Fetch all the cooldown entries for a given stat.
   * If a class and/or subclass are provided the results
   * will be filtered to only include matching abilities.
   */
  get(
    statName: keyof CharacterStats,
    characterClass?: DestinyClass,
    element?: ModifierType,
    exoticHashes: number[] = []
  ): CooldownEntry[] {
    const entries = this.allStatEntries[statName] ?? [];

    const exoticOverrides = this.overrides.filter((o) => exoticHashes.includes(o.Hash));

    return entries
      .filter((entry) => {
        if (
          characterClass !== undefined &&
          entry.characterClass !== undefined &&
          entry.characterClass !== characterClass
        ) {
          return false;
        }

        if (element !== undefined && entry.element !== undefined && entry.element !== element) {
          return false;
        }

        return true;
      })
      .map((entry) => {
        return exoticOverrides.reduce(
          (acc, override) => applyExoticArmorOverride(acc, override),
          entry
        );
      });
  }

  private generateEntries<T extends CharacterStats[keyof CharacterStats]>(
    base: T,
    allAbilities: Map<number, DestinyInventoryItemDefinition>,
    stats: Array<
      Partial<CooldownEntry> & {
        key: Exclude<keyof T, "Description" | "Abilities" | "Overrides">;
        name: string;
      }
    > = []
  ): CooldownEntry[] {
    const result = stats.map<CooldownEntry>(({ key, ...rest }) => {
      const entry = base[key] as any as {
        Description: string;
        Array: number[];
      };

      return {
        values: entry.Array,
        ...rest,
      };
    });

    const abilityList =
      "Abilities" in base ? base.Abilities : "SuperAbilities" in base ? base.SuperAbilities : [];

    abilityList.forEach((entry) => {
      const ability = allAbilities.get(entry.Hash);
      if (!ability) {
        return;
      }

      const { characterClass, element } = getClassAndElementForAbility(ability);

      const abilityData: CooldownEntry = {
        hash: ability.hash,
        name: ability.displayProperties.name,
        icon: ability.displayProperties.icon,
        values: entry.Cooldowns,
        valueType: CharacterStatType.TimeMMSS,
        characterClass,
        element,
      };
      result.push(abilityData);
    });

    return result;
  }
}

function getClassAndElementForAbility(ability: DestinyInventoryItemDefinition): {
  characterClass: DestinyClass | undefined;
  element: ModifierType | undefined;
} {
  let characterClass: DestinyClass | undefined;
  let element: ModifierType | undefined;

  // e.g. "hunter.arc.supers", "shared.arc.grenades"
  const parts = ability.plug?.plugCategoryIdentifier?.split(".");
  if (parts?.length !== 3) {
    return { characterClass, element };
  }

  const [className, elementName, _] = parts;

  if (className === "warlock") {
    characterClass = DestinyClass.Warlock;
  } else if (className === "hunter") {
    characterClass = DestinyClass.Hunter;
  } else if (className === "titan") {
    characterClass = DestinyClass.Titan;
  }

  if (elementName === "arc") {
    element = ModifierType.Arc;
  } else if (elementName === "solar") {
    element = ModifierType.Solar;
  } else if (elementName === "void") {
    element = ModifierType.Void;
  } else if (elementName === "stasis") {
    element = ModifierType.Stasis;
  } else if (elementName === "strand") {
    element = ModifierType.Strand;
  } else if (elementName === "prism") {
    element = ModifierType.Prismatic;
  }

  return { characterClass, element };
}

function applyExoticArmorOverride(originalEntry: CooldownEntry, override: Override): CooldownEntry {
  if (!originalEntry.hash || !override.Requirements.includes(originalEntry.hash)) {
    return originalEntry;
  }

  const entry: CooldownEntry = {
    ...originalEntry,
    overrideIcons: [...(originalEntry.overrideIcons ?? []), override.Hash],
  };

  if (override.CooldownOverride) {
    return {
      ...entry,
      values: override.CooldownOverride,
    };
  }

  if (override.Scalar) {
    const reqIndex = override.Requirements.indexOf(originalEntry.hash);
    const scalar = override.Scalar[reqIndex];

    return {
      ...entry,
      values: entry.values.map((value) => value * scalar),
    };
  }

  return originalEntry;
}
