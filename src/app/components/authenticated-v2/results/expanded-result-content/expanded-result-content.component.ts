import {Component, Input, OnDestroy, OnInit} from '@angular/core';
import {
  ArmorAffinityIcons,
  ArmorAffinityNames,
  ArmorPerkOrSlot, ArmorPerkOrSlotDIMText,
  ArmorStat, ArmorStatIconUrls,
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
import {ModOrAbility} from "../../../../data/enum/modOrAbility";
import {DestinyEnergyType,DestinyClass} from "bungie-api-ts/destiny2";
import {ArmorSlot} from "../../../../data/enum/armor-slot";
import {EnumDictionary} from "../../../../data/types/EnumDictionary";
import {ModifierType} from "../../../../data/enum/modifierType";
import {BuildConfiguration, FixableSelection} from "../../../../data/buildConfiguration";
import {takeUntil} from "rxjs/operators";
import {Subject} from "rxjs";
import {MASTERWORK_COST_EXOTIC, MASTERWORK_COST_LEGENDARY} from "../../../../data/masterworkCost";
import {AssumeArmorMasterwork, Loadout, LoadoutParameters, LockArmorEnergyType, UpgradeSpendTier} from '@destinyitemmanager/dim-api-types';
import { CharacterClass } from 'src/app/data/enum/character-Class';

@Component({
  selector: 'app-expanded-result-content',
  templateUrl: './expanded-result-content.component.html',
  styleUrls: ['./expanded-result-content.component.scss']
})
export class ExpandedResultContentComponent implements OnInit, OnDestroy {
  public armorStatIds: ArmorStat[] = [0, 1, 2, 3, 4, 5]
  public ModifierType = ModifierType;
  public ModInformation = ModInformation;
  public ArmorStatNames = ArmorStatNames;
  public ArmorStatIconUrls = ArmorStatIconUrls;
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


    let classItemFilters = ["is:classitem"]
    if (element?.classItem.affinity != DestinyEnergyType.Any) {
      classItemFilters.push(`is:${ArmorAffinityNames[element?.classItem.affinity || 0]}`)
    }
    if (element?.classItem.perk != ArmorPerkOrSlot.None && element?.classItem.perk != ArmorPerkOrSlot.COUNT) {
      classItemFilters.push(ArmorPerkOrSlotDIMText[element?.classItem.perk || 0])
    }

    if (classItemFilters.length > 1)
      result += ` or (${classItemFilters.join(" ")})`;

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
    this.config.configuration
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe(c => {
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

  calculateRequiredMasterworkCost() {
    let cost: { [id: string]: number } = {"shards": 0, "glimmer": 0, "core": 0, "prism": 0, "ascshard": 0, "total": 0};
    let items = this.element?.items.flat() || [];
    items = items.filter(i =>
      i.energyLevel < 10
      && ((i.exotic && this.config_assumeExoticsMasterworked)
        || (!i.exotic && this.config_assumeLegendariesMasterworked))
    )
    for (let item of items) {
      let costList = item.exotic ? MASTERWORK_COST_EXOTIC : MASTERWORK_COST_LEGENDARY;
      for (let n = item.energyLevel; n < 10; n++)
        for (let entryName in costList[n + 1]) {
          cost[entryName] += costList[n + 1][entryName]
          cost["total"] ++;
        }
    }
    return cost;
  }


  generateDIMLink(c: BuildConfiguration): string {
    const mods: number[] = [];
    const fragments: number[] = [];

    // add selected mods
    for (let mod of this.config_enabledMods) {
      const modInfo = ModInformation[mod]
      if (modInfo.type === ModifierType.CombatStyleMod) {
          mods.push(modInfo.hash)
      } else {
        fragments.push(modInfo.hash)
      }
    }

    // add stat mods
    for (let mod of (this.element?.mods || [])) {
      mods.push(STAT_MOD_VALUES[mod as StatModifier][3])
    }

    var data: LoadoutParameters = {
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
      mods,
      assumeArmorMasterwork: c.assumeLegendariesMasterworked ? c.assumeExoticsMasterworked ? AssumeArmorMasterwork.All : AssumeArmorMasterwork.Legendary : AssumeArmorMasterwork.None,
      lockArmorEnergyType: c.ignoreArmorAffinitiesOnMasterworkedItems ? c.ignoreArmorAffinitiesOnNonMasterworkedItems ? LockArmorEnergyType.None : LockArmorEnergyType.Masterworked : LockArmorEnergyType.All,
    }

    if (c.selectedExotics.length == 1) {
      data.exoticArmorHash = c.selectedExotics[0];
    } else {
      var exos = this.element?.exotic;
      if (exos && exos.length == 1) {
        var exoticHash = exos[0].hash;
        if (!!exoticHash)
          data.exoticArmorHash = parseInt(exoticHash, 10);
      }
    }

    const loadout: Loadout = {
      id: "d2ap", // this doesn't matter and will be replaced
      name: "D2ArmorPicker Loadout",
      classType: c.characterClass as number,
      parameters: data,
      equipped: (this.element?.items || []).map(([i]) => ({ id: i.itemInstanceId, hash: i.hash })),
      unequipped: [],
      clearSpace: false,
    }

    // Configure subclass
    if (fragments.length) {
      const socketOverrides = fragments.reduce<{
        [socketIndex: number]: number;
      }>((m, hash, i) => {
        m[i+7] = hash
        return m
      }, {})

      const subclassHashes: { [characterClass: number]: { [modifierType: number]: number | undefined } | undefined} = {
        [CharacterClass.Hunter]: {
          [ModifierType.Stasis]: 873720784,
          [ModifierType.Void]: 2453351420,
          [ModifierType.Solar]: 2240888816,
          [ModifierType.Arc]: 2328211300,
        },
        [CharacterClass.Titan]: {
          [ModifierType.Stasis]: 613647804,
          [ModifierType.Void]: 2842471112,
          [ModifierType.Solar]: 2550323932,
          [ModifierType.Arc]: 2932390016,
        },
        [CharacterClass.Warlock]: {
          [ModifierType.Stasis]: 3291545503,
          [ModifierType.Void]: 2849050827,
          [ModifierType.Solar]: 3941205951,
          [ModifierType.Arc]: 3168997075,
        },
      };

      const subclassHash = subclassHashes[c.characterClass]?.[c.selectedModElement]

      if (subclassHash) {
        loadout.equipped.push({
          id: '12345', // This shouldn't need to be specified but right now it does. The value doesn't matter
          hash: subclassHash,
          socketOverrides
        })
      }
    }


    var url = "https://app.destinyitemmanager.com/loadouts?loadout=" + encodeURIComponent(JSON.stringify(loadout))

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

    while (total++ < 10)
      d.push("");
    return d;
  }

  getRequiredMasterworkBonus() {
    return (this.element?.items.filter(i =>
      !i[0].masterworked && (!i[0].exotic && this.config_assumeLegendariesMasterworked) || (i[0].exotic && this.config_assumeExoticsMasterworked)
    ) || []).length * 2;
  }

  getAffinityName(id: DestinyEnergyType) {
    return ArmorAffinityNames[id];
  }

  getAffinityUrl(id: DestinyEnergyType) {
    return ArmorAffinityIcons[id];
  }

  private ngUnsubscribe = new Subject();

  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }
}
