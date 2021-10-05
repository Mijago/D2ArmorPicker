import {Component, Input, OnInit} from '@angular/core';
import {ArmorStat, SpecialArmorStat, StatModifier} from 'src/app/data/enum/armor-stat';
import {ResultDefinition, ResultItem, ResultItemMoveState} from "../results.component";
import {ConfigurationService} from "../../../../services/v2/configuration.service";
import {ModInformation} from "../../../../data/ModInformation";
import {ModifierValue} from "../../../../data/modifier";
import {MatSnackBar} from "@angular/material/snack-bar";
import {BungieApiService} from "../../../../services/bungie-api.service";
import {DestinyClass} from "bungie-api-ts/destiny2/interfaces";

@Component({
  selector: 'app-expanded-result-content',
  templateUrl: './expanded-result-content.component.html',
  styleUrls: ['./expanded-result-content.component.scss']
})
export class ExpandedResultContentComponent implements OnInit {
  public ArmorStat = ArmorStat;
  public StatModifier = StatModifier;
  public config_characterClass = DestinyClass.Titan;
  public config_assumeLegendariesMasterworked = false;
  public config_assumeExoticsMasterworked = false;
  public config_assumeClassItemMasterworked = false;
  configValues: [number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0];

  @Input()
  element: ResultDefinition | null = null;


  constructor(private config: ConfigurationService, private _snackBar: MatSnackBar, private bungieApi: BungieApiService) {
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
      this.config_characterClass = c.characterClass as unknown as DestinyClass; // TODO: remove my own class enum and use DestinyClass in the config
      this.config_assumeLegendariesMasterworked = c.assumeLegendariesMasterworked;
      this.config_assumeExoticsMasterworked = c.assumeExoticsMasterworked;
      this.config_assumeClassItemMasterworked = c.assumeClassItemMasterworked;
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
    return (this.element?.items.filter((d: ResultItem) => d.mayBeBugged).length || 0) > 0
  }

  async moveItems() {
    for (let item of (this.element?.items || [])) {
      item.transferState = ResultItemMoveState.WAITING_FOR_TRANSFER;
    }

    // get character Id
    let characters = await this.bungieApi.getCharacters();
    characters = characters.filter(c => c.clazz == this.config_characterClass)
    if (characters.length == 0) {
      this.openSnackBar("Error: Could not find a character to move the items to.");
      return;
    }

    let allSuccessful = true;
    let characterId = characters[0].characterId
    for (let item of (this.element?.items || [])) {
      item.transferState = ResultItemMoveState.TRANSFERRING
      let success = await this.bungieApi.transferItem(item.itemInstanceId, characterId);
      item.transferState = success ? ResultItemMoveState.TRANSFERRED : ResultItemMoveState.ERROR_DURING_TRANSFER
      if (!success) allSuccessful = false;
    }
    if (allSuccessful) {
      this.openSnackBar("Success! Moved all the items.");
    } else {
      this.openSnackBar("Some of the items could not be moved. Make sure that there is enough space in the specific slot. This tool will not move items out of your inventory.")
    }
  }
}
