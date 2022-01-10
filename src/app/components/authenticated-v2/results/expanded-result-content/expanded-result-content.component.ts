import {Component, Input, OnInit} from '@angular/core';
import {ArmorStat, SpecialArmorStat, StatModifier} from 'src/app/data/enum/armor-stat';
import {ResultDefinition, ResultItem, ResultItemMoveState} from "../results.component";
import {ConfigurationService} from "../../../../services/configuration.service";
import {ModInformation} from "../../../../data/ModInformation";
import {ModifierValue} from "../../../../data/modifier";
import {MatSnackBar} from "@angular/material/snack-bar";
import {BungieApiService} from "../../../../services/bungie-api.service";
import {DestinyClass} from "bungie-api-ts/destiny2/interfaces";
import {ModOrAbility} from "../../../../data/enum/modOrAbility";
import {DestinyEnergyType} from "bungie-api-ts/destiny2";
import {ArmorSlot} from "../../../../data/enum/armor-slot";
import {EnumDictionary} from "../../../../data/types/EnumDictionary";
import {ModifierType} from "../../../../data/enum/modifierType";
import {FixableSelection} from "../../../../data/configuration";

@Component({
  selector: 'app-expanded-result-content',
  templateUrl: './expanded-result-content.component.html',
  styleUrls: ['./expanded-result-content.component.scss']
})
export class ExpandedResultContentComponent implements OnInit {
  public ModifierType = ModifierType;
  public ModInformation = ModInformation;
  public ArmorStat = ArmorStat;
  public StatModifier = StatModifier;
  public config_characterClass = DestinyClass.Titan;
  public config_assumeLegendariesMasterworked = false;
  public config_assumeExoticsMasterworked = false;
  public config_assumeClassItemMasterworked = false;
  public config_ignoreArmorAffinitiesOnMasterworkedItems = false;
  public config_enabledMods: ModOrAbility[] = [];
  configValues: [number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0];

  @Input()
  element: ResultDefinition | null = null;
  config_armorAffinities: EnumDictionary<ArmorSlot, FixableSelection<DestinyEnergyType>> = {
    [ArmorSlot.ArmorSlotHelmet]: {fixed: false, value: DestinyEnergyType.Any},
    [ArmorSlot.ArmorSlotGauntlet]: {fixed: false, value: DestinyEnergyType.Any},
    [ArmorSlot.ArmorSlotChest]: {fixed: false, value: DestinyEnergyType.Any},
    [ArmorSlot.ArmorSlotLegs]: {fixed: false, value: DestinyEnergyType.Any},
    [ArmorSlot.ArmorSlotClass]: {fixed: false, value: DestinyEnergyType.Any},
    [ArmorSlot.ArmorSlotNone]: {fixed: false, value: DestinyEnergyType.Any},
  };


  constructor(private config: ConfigurationService, private _snackBar: MatSnackBar, private bungieApi: BungieApiService) {
  }

  public buildItemIdString(element: ResultDefinition | null) {
    return element?.items.flat().map(d => `id:'${d.itemInstanceId}'`).join(" or ")
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
      this.config_characterClass = c.characterClass as unknown as DestinyClass;
      this.config_assumeLegendariesMasterworked = c.assumeLegendariesMasterworked;
      this.config_assumeExoticsMasterworked = c.assumeExoticsMasterworked;
      this.config_assumeClassItemMasterworked = c.assumeClassItemMasterworked;
      this.config_ignoreArmorAffinitiesOnMasterworkedItems = c.ignoreArmorAffinitiesOnMasterworkedItems;
      this.config_armorAffinities = c.armorAffinities;
      this.config_enabledMods = c.enabledMods;
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

  disableAllItems() {
    this.config.modifyConfiguration(cb => {
      for (let item of this.element?.items.flat() as ResultItem[])
        cb.disabledItems.push(item.itemInstanceId)
    })
  }

  disableItem(itemInstanceId: string) {
    this.config.modifyConfiguration(cb => {
      cb.disabledItems.push(itemInstanceId)
    })
  }

  get mayAnyItemBeBugged() {
    return (this.element?.items.flat().filter((d: ResultItem) => d.mayBeBugged).length || 0) > 0
  }


  async getCharacterId() {
    // get character Id
    let characters = await this.bungieApi.getCharacters();
    characters = characters.filter(c => c.clazz == this.config_characterClass)
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

    let characterId = await this.getCharacterId()
    if (!characterId) return;

    let allSuccessful = true;
    let items = (this.element?.items || []).flat().sort(i => i.exotic ? 1 : -1)
    for (let item of items) {
      item.transferState = ResultItemMoveState.TRANSFERRING
      let success = await this.bungieApi.transferItem(item.itemInstanceId, characterId, equip);
      item.transferState = success ? ResultItemMoveState.TRANSFERRED : ResultItemMoveState.ERROR_DURING_TRANSFER
      if (!success) allSuccessful = false;
    }
    if (allSuccessful) {
      this.openSnackBar("Success! Moved all the items.");
    } else {
      this.openSnackBar("Some of the items could not be moved. Make sure that there is enough space in the specific slot. This tool will not move items out of your inventory.")
    }
  }

  getCountOfItemsWithWrongElement() {
    if (!this.element) return 0;

    return this.element.items.flat().filter(item => {
      if (!this.config_armorAffinities[item.slot].fixed) return false;
      if (this.config_armorAffinities[item.slot].value == DestinyEnergyType.Any) return false;

      return this.config_armorAffinities[item.slot].value != item.energy;
    }).length
  }

  getItemsThatMustBeMasterworked(): ResultItem[] | undefined {
    return this.element?.items.flat().filter(item => {
      if (item.masterworked) return false;
      if (item.exotic && !this.config_assumeExoticsMasterworked) return false;
      if (!item.exotic && !this.config_assumeLegendariesMasterworked) return false;

      return true;
    })
  }
}
