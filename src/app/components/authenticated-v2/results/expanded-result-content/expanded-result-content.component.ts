import {Component, Input, OnInit} from '@angular/core';
import {ArmorStat, SpecialArmorStat, StatModifier} from 'src/app/data/enum/armor-stat';
import {ResultDefinition} from "../results.component";
import {ConfigurationService} from "../../../../services/v2/configuration.service";
import {ModInformation} from "../../../../data/ModInformation";
import {ModifierValue} from "../../../../data/modifier";
import {MatSnackBar} from "@angular/material/snack-bar";

@Component({
  selector: 'app-expanded-result-content',
  templateUrl: './expanded-result-content.component.html',
  styleUrls: ['./expanded-result-content.component.scss']
})
export class ExpandedResultContentComponent implements OnInit {
  public ArmorStat = ArmorStat;
  public StatModifier = StatModifier;
  public config_assumeMasterworked = false;
  configValues: [number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0];

  @Input()
  element: ResultDefinition | null = null;


  constructor(private config: ConfigurationService, private _snackBar: MatSnackBar) {
  }

  public buildItemIdString(element: ResultDefinition | null) {
    return element?.items.map(d => `id:'${d.itemInstanceId}'`).join(" or ")
  }

  openSnackBar(message: string) {
    this._snackBar.open(message,
      "", {
        duration: 2500,
        politeness: "polite"
      });
  }

  ngOnInit(): void {
    this.config.configuration.subscribe(c => {
      this.config_assumeMasterworked = c.assumeMasterworked;
      this.configValues = c.enabledMods
        .reduce((p, v) => {
          p = p.concat(ModInformation[v].bonus)
          return p;
        }, [] as ModifierValue[])
        .reduce((p, v) => {
          if (v.stat == SpecialArmorStat.ClassAbilityRegenerationStat)
            p[[1, 0, 2][c.characterClass]] += v.value;
          else
            p[v.stat as number] += v.value;
          return p;
        }, [0, 0, 0, 0, 0, 0])
    })
  }

  disableItem(itemInstanceId: string) {
    this.config.modifyConfiguration(cb => {
        cb.disabledItems.push(itemInstanceId)
    })
  }

  get mayAnyItemBeBugged() {
    return (this.element?.items.filter(d => d.mayBeBugged).length || 0) > 0
  }

}
