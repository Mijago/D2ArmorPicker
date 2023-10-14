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

import { Component, Input, OnInit } from "@angular/core";
import { ArmorStat, ArmorStatNames } from "../../../../data/enum/armor-stat";
import { formatTimeMMMSS } from "../../../../data/cooldowns/cooldown_definitions";
import { CharacterClass } from "../../../../data/enum/character-Class";
import { ConfigurationService } from "../../../../services/configuration.service";
import { CharacterStats } from "../../../../data/character_stats/schema";
import {
  CharacterStatType,
  CharacterStatsService,
  CooldownEntry,
} from "../../../../services/character-stats.service";

const speedTextFormatter = (t: number) => (Math.round(t * 100) / 100).toFixed(2) + "m/s";

function reformatTimeMMMSS(time: number) {
  var str = formatTimeMMMSS(time);
  if (time < 0) str = "-" + str;
  return str;
}
@Component({
  selector: "app-stat-cooldown-tooltip",
  templateUrl: "./stat-cooldown-tooltip.component.html",
  styleUrls: ["./stat-cooldown-tooltip.component.css"],
})
export class StatCooldownTooltipComponent implements OnInit {
  public ArmorStatNames = ArmorStatNames;

  @Input() tier: number = 0;
  @Input() differenceTier: number = 0; // the tier we use to show a difference for
  @Input() stat: ArmorStat = ArmorStat.Mobility;

  public entries: CooldownEntry[] = [];

  constructor(
    private config: ConfigurationService,
    private characterStats: CharacterStatsService
  ) {}

  get characterClass(): CharacterClass {
    return this.config.readonlyConfigurationSnapshot.characterClass;
  }

  ngOnInit(): void {
    const statName = ArmorStatNames[this.stat] as keyof CharacterStats;
    this.entries = this.characterStats.get(
      statName,
      this.config.readonlyConfigurationSnapshot.characterClass,
      this.config.readonlyConfigurationSnapshot.selectedModElement,
      this.config.readonlyConfigurationSnapshot.selectedExotics
    );
  }

  formatEntry(entry: CooldownEntry, value: number) {
    if (entry.valueType === CharacterStatType.Speed) {
      return speedTextFormatter(value);
    }

    if (entry.valueType === CharacterStatType.Percentage) {
      return `${value}%`;
    }

    if (entry.valueType === CharacterStatType.Time) {
      return reformatTimeMMMSS(value);
    }

    return value;
  }

  valueFunction(entry: CooldownEntry, tier: number) {
    return entry.values[tier];
  }

  getPercentageDifference(v1: number, v2: number) {
    return (v1 - v2) / Math.max(1, v2);
  }
}
