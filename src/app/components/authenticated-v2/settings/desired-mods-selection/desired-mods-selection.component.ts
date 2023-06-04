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
import { ModInformation } from "../../../../data/ModInformation";
import { ModifierType } from "../../../../data/enum/modifierType";
import { Modifier, ModifierValue } from "../../../../data/modifier";
import {
  ArmorAffinityIcons,
  ArmorAffinityNames,
  ArmorStat,
  SpecialArmorStat,
} from "../../../../data/enum/armor-stat";
import { ConfigurationService } from "../../../../services/configuration.service";
import { CharacterClass } from "../../../../data/enum/character-Class";
import { ModOrAbility } from "../../../../data/enum/modOrAbility";
import { MAT_SLIDE_TOGGLE_DEFAULT_OPTIONS } from "@angular/material/slide-toggle";
import { DestinyEnergyType } from "bungie-api-ts/destiny2";
import { takeUntil } from "rxjs/operators";
import { Subject } from "rxjs";

@Component({
  selector: "app-desired-mods-selection",
  templateUrl: "./desired-mods-selection.component.html",
  styleUrls: ["./desired-mods-selection.component.scss"],
  providers: [
    {
      provide: MAT_SLIDE_TOGGLE_DEFAULT_OPTIONS,
      useValue: { disableToggleValue: false, disableDragValue: true },
    },
  ],
})
export class DesiredModsSelectionComponent implements OnInit, OnDestroy {
  ModifierType = ModifierType;
  ModOrAbility = ModOrAbility;
  dataSource: Modifier[];
  displayedColumns = [
    "name",
    "mobility",
    "resilience",
    "recovery",
    "discipline",
    "intellect",
    "strength",
  ];
  private selectedClass: CharacterClass = CharacterClass.None;
  data: { data: Modifier[]; name: string; group: boolean; type: ModifierType }[];
  selectedMods: ModOrAbility[] = [];
  selectedElement: ModifierType = ModifierType.Solar;

  constructor(private config: ConfigurationService) {
    const modifiers = Object.values(ModInformation).sort((a, b) => {
      if (a.name.toLowerCase() < b.name.toLowerCase()) {
        return -1;
      }
      if (a.name.toLowerCase() > b.name.toLowerCase()) {
        return 1;
      }
      return 0;
    });
    let combatStyleMods = modifiers.filter((value) => value.type == ModifierType.CombatStyleMod);
    let stasisFragments = modifiers.filter((value) => value.type == ModifierType.Stasis);
    let voidFragments = modifiers.filter((value) => value.type == ModifierType.Void);
    let solarFragments = modifiers.filter((value) => value.type == ModifierType.Solar);
    let arcFragments = modifiers.filter((value) => value.type == ModifierType.Arc);
    let strandFragments = modifiers.filter((value) => value.type == ModifierType.Strand);

    this.data = [
      {
        name: "Stasis Fragments",
        data: stasisFragments,
        group: true,
        type: ModifierType.Stasis,
      },
      { name: "Void Fragments", data: voidFragments, group: true, type: ModifierType.Void },
      {
        name: "Solar Fragments",
        data: solarFragments,
        group: true,
        type: ModifierType.Solar,
      },
      { name: "Arc Fragments", data: arcFragments, group: true, type: ModifierType.Arc },
      {
        name: "Strand Fragments",
        data: strandFragments,
        group: true,
        type: ModifierType.Strand,
      },
    ];

    this.dataSource = modifiers;
  }

  ngOnInit(): void {
    this.config.configuration.pipe(takeUntil(this.ngUnsubscribe)).subscribe((c) => {
      this.selectedMods = c.enabledMods;
      this.selectedClass = c.characterClass;
      this.selectedElement = c.selectedModElement;
    });
  }

  getModifierTextForValue(value: ModifierValue[], type: ArmorStat | SpecialArmorStat) {
    return value
      .filter((v) => {
        if (v.stat == type) return true;
        if (v.stat == SpecialArmorStat.ClassAbilityRegenerationStat) {
          if (this.selectedClass == CharacterClass.Titan && type == ArmorStat.Resilience)
            return true;
          if (this.selectedClass == CharacterClass.Hunter && type == ArmorStat.Mobility)
            return true;
          if (this.selectedClass == CharacterClass.Warlock && type == ArmorStat.Recovery)
            return true;
        }
        return false;
      })
      .reduce((p, v) => p + v.value, 0);
  }

  handleRowClick(row: Modifier) {
    this.config.modifyConfiguration((c) => {
      const pos = c.enabledMods.indexOf(row.id);
      if (pos > -1) {
        c.enabledMods.splice(pos, 1);
      } else {
        c.enabledMods.push(row.id);
      }
    });
  }

  clear() {
    this.config.modifyConfiguration((c) => {
      c.enabledMods = [];
    });
  }

  getAffinityName(id: DestinyEnergyType) {
    return ArmorAffinityNames[id];
  }

  getAffinityUrl(id: DestinyEnergyType) {
    return ArmorAffinityIcons[id];
  }

  setElement(element: ModifierType) {
    if (this.selectedElement == element) return;
    this.config.modifyConfiguration((c) => {
      const pos = c.enabledMods.filter(
        (m) =>
          ModInformation[m].type != ModifierType.CombatStyleMod && ModInformation[m].type != element
      );

      c.selectedModElement = element;

      for (let toDisableMods of pos) {
        const position = c.enabledMods.indexOf(toDisableMods);
        c.enabledMods.splice(position, 1);
      }
    });
  }

  private ngUnsubscribe = new Subject();

  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }
}
