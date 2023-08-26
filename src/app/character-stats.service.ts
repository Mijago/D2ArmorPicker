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

import type { CharacterStats } from "./data/character_stats/schema";

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
  values: number[];
  increaseIsImprovement?: boolean;
  description?: string;
  valueType?: CharacterStatType;
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
    this.clarity.loadCharacterStats();
  }

  private updateCharacterStats(data: CharacterStats) {
    console.log("Got new character stats data:", data);

    this.allStatEntries = {
      Mobility: generateEntries(data.Mobility, [
        {
          key: "WalkSpeed",
          increaseIsImprovement: true,
          valueType: CharacterStatType.Speed,
        },
        {
          key: "StrafeSpeed",
          increaseIsImprovement: true,
          valueType: CharacterStatType.Speed,
        },
        {
          key: "CrouchSpeed",
          increaseIsImprovement: true,
          valueType: CharacterStatType.Speed,
        },
      ]),
      Resilience: generateEntries(data.Resilience, [
        {
          key: "TotalHP",
          increaseIsImprovement: true,
        },
        {
          key: "PvEDamageResistance",
          increaseIsImprovement: true,
          valueType: CharacterStatType.Percentage,
        },
        {
          key: "FlinchResistance",
          increaseIsImprovement: true,
          valueType: CharacterStatType.Percentage,
        },
      ]),
      Recovery: generateEntries(data.Recovery, [
        {
          key: "TotalRegenTime",
          valueType: CharacterStatType.Time,
        },
        {
          key: "HealthRegenDelay",
          valueType: CharacterStatType.Time,
        },
        {
          key: "HealthRegenSpeed",
          valueType: CharacterStatType.Time,
          increaseIsImprovement: true,
        },
        {
          key: "ShieldRegenDelay",
          valueType: CharacterStatType.Time,
        },
        {
          key: "ShieldRegenSpeed",
          valueType: CharacterStatType.Time,
          increaseIsImprovement: true,
        },
      ]),
      Discipline: [],
      Intellect: [],
      Strength: [],
    };
  }

  get(statName: keyof CharacterStats): CooldownEntry[] {
    return this.allStatEntries[statName] ?? [];
  }
}

function generateEntries<T extends CharacterStats[keyof CharacterStats]>(
  base: T,
  stats: Array<
    Partial<CooldownEntry> & {
      key: Exclude<keyof T, "Description" | "Abilities" | "Overrides">;
    }
  >
): CooldownEntry[] {
  return stats.map(({ key, ...rest }) => {
    const entry = base[key] as any as {
      Description: string;
      Array: number[];
    };

    return {
      name: key.toString(),
      description: entry.Description,
      values: entry.Array,
      ...rest,
    };
  });
}
