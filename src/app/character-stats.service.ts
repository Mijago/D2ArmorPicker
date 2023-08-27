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
import { ClarityService } from "./clarity.service";
import { CharacterClass } from "./data/enum/character-Class";
import { ModifierType } from "./data/enum/modifierType";

import type { CharacterStats } from "./data/character_stats/schema";
import { DestinyInventoryItemDefinition } from "bungie-api-ts/destiny2";

export enum BenefitDirection {
  Positive = 1,
  Negative = -1,
}

export enum CharacterStatType {
  Speed = 1,
  Percentage = 2,
  Time = 3,
}

export interface CooldownEntry {
  name: string;
  icon?: string;
  values: number[];
  increaseIsImprovement?: boolean;
  description?: string;
  valueType?: CharacterStatType;
  characterClass?: CharacterClass;
  element?: ModifierType;
}

/**
 * This component takes the raw character stat data from Clarity’s database
 * and converts it to data for use in stat tooltips.
 */
@Injectable({
  providedIn: "root",
})
export class CharacterStatsService {
  private allStatEntries: Partial<Record<keyof CharacterStats, CooldownEntry[]>> = {};

  constructor(private clarity: ClarityService) {
    this.clarity.characterStats.subscribe((data) => data && this.updateCharacterStats(data));
  }

  loadCharacterStats() {
    this.clarity.load();
  }

  private updateCharacterStats(data: CharacterStats) {
    const allAbilities = (
      JSON.parse(window.localStorage.getItem("allAbilities")!) as DestinyInventoryItemDefinition[]
    ).reduce((acc, ability) => {
      acc.set(ability.hash, ability);
      return acc;
    }, new Map<number, DestinyInventoryItemDefinition>());

    this.allStatEntries = {
      Mobility: this.generateEntries(data.Mobility, allAbilities, [
        {
          key: "WalkSpeed",
          name: "Walk Speed",
          increaseIsImprovement: true,
          valueType: CharacterStatType.Speed,
        },
        {
          key: "StrafeSpeed",
          name: "Strafe Speed",
          increaseIsImprovement: true,
          valueType: CharacterStatType.Speed,
        },
        {
          key: "CrouchSpeed",
          name: "Crouch Speed",
          increaseIsImprovement: true,
          valueType: CharacterStatType.Speed,
        },
      ]),
      Resilience: this.generateEntries(data.Resilience, allAbilities, [
        {
          key: "TotalHP",
          name: "Total HP",
          increaseIsImprovement: true,
        },
        {
          key: "PvEDamageResistance",
          name: "PvE Damage Resistance",
          increaseIsImprovement: true,
          valueType: CharacterStatType.Percentage,
        },
        {
          key: "FlinchResistance",
          name: "Flinch Resistance",
          increaseIsImprovement: true,
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
          valueType: CharacterStatType.Time,
          increaseIsImprovement: true,
        },
        {
          key: "ShieldRegenDelay",
          name: "Shield Regen Delay",
          valueType: CharacterStatType.Time,
        },
        {
          key: "ShieldRegenSpeed",
          name: "Shield Regen Speed",
          valueType: CharacterStatType.Time,
          increaseIsImprovement: true,
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
    characterClass?: CharacterClass,
    element?: ModifierType
  ): CooldownEntry[] {
    const entries = this.allStatEntries[statName] ?? [];

    return entries.filter((entry) => {
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
        name: ability.displayProperties.name,
        icon: ability.displayProperties.icon,
        values: entry.Cooldowns,
        valueType: CharacterStatType.Time,
        characterClass,
        element,
      };
      result.push(abilityData);
    });

    return result;
  }
}

function getClassAndElementForAbility(ability: DestinyInventoryItemDefinition): {
  characterClass: CharacterClass | undefined;
  element: ModifierType | undefined;
} {
  let characterClass: CharacterClass | undefined;
  let element: ModifierType | undefined;

  // e.g. "hunter.arc.supers", "shared.arc.grenades"
  const parts = ability.plug?.plugCategoryIdentifier?.split(".");
  if (parts?.length !== 3) {
    return { characterClass, element };
  }

  const [className, elementName, _] = parts;

  if (className === "warlock") {
    characterClass = CharacterClass.Warlock;
  } else if (className === "hunter") {
    characterClass = CharacterClass.Hunter;
  } else if (className === "titan") {
    characterClass = CharacterClass.Titan;
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
  }

  return { characterClass, element };
}
