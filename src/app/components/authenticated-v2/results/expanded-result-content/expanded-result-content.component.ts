import {Component, Input, OnInit} from '@angular/core';
import {
  ArmorAffinityIcons,
  ArmorAffinityNames,
  ArmorStat,
  ArmorStatNames,
  SpecialArmorStat,
  STAT_MOD_VALUES,
  StatModifier
} from 'src/app/data/enum/armor-stat';
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
import {Configuration, FixableSelection} from "../../../../data/configuration";

@Component({
  selector: 'app-expanded-result-content',
  templateUrl: './expanded-result-content.component.html',
  styleUrls: ['./expanded-result-content.component.scss']
})
export class ExpandedResultContentComponent implements OnInit {
  public armorStatIds: ArmorStat[] = [0, 1, 2, 3, 4, 5]
  public ModifierType = ModifierType;
  public ModInformation = ModInformation;
  public ArmorStatNames = ArmorStatNames;
  public ArmorStat = ArmorStat;
  public StatModifier = StatModifier;
  public config_characterClass = DestinyClass.Titan;
  public config_assumeLegendariesMasterworked = false;
  public config_assumeExoticsMasterworked = false;
  public config_assumeClassItemMasterworked = false;
  public config_ignoreArmorAffinitiesOnMasterworkedItems = false;
  public config_enabledMods: ModOrAbility[] = [];
  public DIMUrl: string = "";
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
    let result = element?.items.flat().map(d => `id:'${d.itemInstanceId}'`).join(" or ");


    if (element?.classItem.affinity != DestinyEnergyType.Any) {
      result += ` or (is:classitem is:${ArmorAffinityNames[element?.classItem.affinity || 0]})`;
    }

    return result
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

      this.DIMUrl = this.generateDIMLink(c)
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

  generateDIMLink(c: Configuration): string {
    var data = {
      "statConstraints": [
        {
          "statHash": 2996146975,
          "minTier": c.minimumStatTiers[ArmorStat.Mobility].value,
          "maxTier": c.minimumStatTiers[ArmorStat.Mobility].fixed ? c.minimumStatTiers[ArmorStat.Mobility].value : 10
        },
        {
          "statHash": 392767087,
          "minTier": c.minimumStatTiers[ArmorStat.Resilience].value,
          "maxTier": c.minimumStatTiers[ArmorStat.Resilience].fixed ? c.minimumStatTiers[ArmorStat.Resilience].value : 10
        },
        {
          "statHash": 1943323491,
          "minTier": c.minimumStatTiers[ArmorStat.Recovery].value,
          "maxTier": c.minimumStatTiers[ArmorStat.Recovery].fixed ? c.minimumStatTiers[ArmorStat.Recovery].value : 10
        },
        {
          "statHash": 1735777505,
          "minTier": c.minimumStatTiers[ArmorStat.Discipline].value,
          "maxTier": c.minimumStatTiers[ArmorStat.Recovery].fixed ? c.minimumStatTiers[ArmorStat.Recovery].value : 10
        },
        {
          "statHash": 144602215,
          "minTier": c.minimumStatTiers[ArmorStat.Intellect].value,
          "maxTier": c.minimumStatTiers[ArmorStat.Intellect].fixed ? c.minimumStatTiers[ArmorStat.Intellect].value : 10
        },
        {
          "statHash": 4244567218,
          "minTier": c.minimumStatTiers[ArmorStat.Strength].value,
          "maxTier": c.minimumStatTiers[ArmorStat.Strength].fixed ? c.minimumStatTiers[ArmorStat.Strength].value : 10
        }
      ],
      "mods": [] as number[],
      //"pinnedItems": {} as any,
      "items": [] as any,
      "upgradeSpendTier": 5,
      "autoStatMods": true,
      "lockItemEnergyType": false,
      "assumeMasterworked": false,
      "query": this.buildItemIdString(this.element)
    } as any

    if (c.selectedExotics.length == 1) {
      data["exoticArmorHash"] = c.selectedExotics[0];
    } else {
      var exos = this.element?.exotic;
      if (exos && exos.length == 1) {
        var exoticHash = exos[0].hash;
        if (!!exoticHash)
          data["exoticArmorHash"] = exoticHash;
      }
    }

    for (let itemx of (this.element?.items || [])) {
      data.items.push(itemx[0].itemInstanceId);
    }

    // add selected mods
    for (let mod of this.config_enabledMods) {
      data.mods.push(ModInformation[mod].hash)
    }

    // add stat mods
    for (let mod of (this.element?.mods || [])) {
      data.mods.push(STAT_MOD_VALUES[mod as StatModifier][3])
    }

    var url = "https://beta.destinyitemmanager.com/optimizer?class=" + c.characterClass +
      "&p=" + encodeURIComponent(JSON.stringify(data))

    return url;
  }

  goToDIM() {
    window.open(this.DIMUrl, "blank")
  }

  getTiersForStat(statId: number) {
    return Math.floor((this.element?.stats[statId] || 0) / 10);
  }

  getColumnForStat(statId: number) {
    var configValueTiers = Math.floor(this.configValues[statId] / 10)
    let d = []
    let total = 0;

    let moddedTiersMinor = Math.ceil(((
        this.element?.mods.filter(k => k == (1 + 2 * statId)) || []).length * 5
      + (this.element?.mods.filter(k => k == (2 + 2 * statId)) || []).length * 10
    ) / 10)

    var tiers = this.getTiersForStat(statId) - configValueTiers - moddedTiersMinor;
    for (let n = 0; n < tiers; n++) {
      d.push("normal" + (++total > 10 ? " over100" : ""))
    }

    for (let cvt = 0; cvt < moddedTiersMinor; cvt++)
      d.push('mod' + (++total > 10 ? " over100" : ""))
    for (let cvt = 0; cvt < configValueTiers; cvt++)
      d.push('config' + (++total > 10 ? " over100" : ""))
    return d;
  }

  getAffinityName(id:DestinyEnergyType) {
    return ArmorAffinityNames[id];
  }
  getAffinityUrl(id:DestinyEnergyType) {
    return ArmorAffinityIcons[id];
  }

}
