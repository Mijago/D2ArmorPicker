import {Component, OnInit} from '@angular/core';
import {ModInformation} from "../../../../data/ModInformation";
import {ModifierType} from "../../../../data/enum/modifierType";
import {Modifier, ModifierValue} from "../../../../data/modifier";
import {ArmorStat, SpecialArmorStat} from "../../../../data/enum/armor-stat";
import {ConfigurationService} from "../../../../services/v2/configuration.service";
import {CharacterClass} from "../../../../data/enum/character-Class";
import {ModOrAbility} from "../../../../data/enum/modOrAbility";

@Component({
  selector: 'app-desired-mods-selection',
  templateUrl: './desired-mods-selection.component.html',
  styleUrls: ['./desired-mods-selection.component.css']
})
export class DesiredModsSelectionComponent implements OnInit {
  dataSource: Modifier[];
  displayedColumns = ["name", "mobility", "resilience", "recovery", "discipline", "intellect", "strength"];
  private selectedClass: CharacterClass = CharacterClass.None;
  data: { data: Modifier[]; name: string }[];
  selectedMods: ModOrAbility[] = [];

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
    let combatStyleMods = modifiers.filter(value => value.type == ModifierType.CombatStyleMod);
    let stasisFragments = modifiers.filter(value => value.type == ModifierType.Stasis);

    this.data = [
      {name: "Combat Style Mods", data: combatStyleMods},
      {name: "Stasis Fragments", data: stasisFragments},
    ]

    this.dataSource = modifiers;
  }

  ngOnInit(): void {
    this.config.configuration.subscribe(c => {
      this.selectedMods = c.enabledMods;
      this.selectedClass = c.characterClass;
    })
  }


  getModifierTextForValue(value: ModifierValue[], type: ArmorStat | SpecialArmorStat) {
    return value.filter(v => {
      if (v.stat == type)
        return true;
      if (v.stat == SpecialArmorStat.ClassAbilityRegenerationStat) {
        if (this.selectedClass == CharacterClass.Titan && type == ArmorStat.Resilience) return true;
        if (this.selectedClass == CharacterClass.Hunter && type == ArmorStat.Mobility) return true;
        if (this.selectedClass == CharacterClass.Warlock && type == ArmorStat.Recovery) return true;
      }
      return false;
    }).reduce((p, v) => p + v.value, 0);
  }

  handleRowClick(row: Modifier) {
    this.config.modifyConfiguration(c => {
      const pos = c.enabledMods.indexOf(row.id);
      if (pos > -1) {
        c.enabledMods.splice(pos, 1)
      } else {
        c.enabledMods.push(row.id)
      }
    })
  }
}
