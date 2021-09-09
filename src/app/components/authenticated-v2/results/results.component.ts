import {Component, OnInit, ViewChild} from '@angular/core';
import {InventoryService} from "../../../services/v2/inventory.service";
import {DatabaseService} from "../../../services/database.service";
import {MatTableDataSource} from "@angular/material/table";
import {IMappedGearPermutation, MOD_INDICES} from "../../authenticated/main/main.component";
import {BungieApiService} from "../../../services/bungie-api.service";
import {CharacterClass} from "../../../data/enum/character-Class";
import {ConfigurationService} from "../../../services/v2/configuration.service";
import {ArmorStat, STAT_MOD_VALUES, StatModifier} from "../../../data/enum/armor-stat";
import {ModInformation} from "../../../data/ModInformation";
import {ModOrAbility} from "../../../data/enum/modOrAbility";
import {EnumDictionary} from "../../../data/types/EnumDictionary";
import {Modifier} from "../../../data/modifier";
import {IInventoryArmor} from "../../../services/IInventoryArmor";
import {Stats} from "../../../data/permutation";
import {MatPaginator} from "@angular/material/paginator";
import {MatSort} from "@angular/material/sort";
import {PERMUTATION_PACKAGE, RESULTS_PACKAGE} from "../../../data/constants";
import {StatusProviderService} from "../../../services/v2/status-provider.service";
import {animate, state, style, transition, trigger} from "@angular/animations";

export function getSkillTier(stats: number[]) {
  return Math.floor(Math.min(100, stats[ArmorStat.Mobility]) / 10)
    + Math.floor(Math.min(100, stats[ArmorStat.Resilience]) / 10)
    + Math.floor(Math.min(100, stats[ArmorStat.Recovery]) / 10)
    + Math.floor(Math.min(100, stats[ArmorStat.Discipline]) / 10)
    + Math.floor(Math.min(100, stats[ArmorStat.Intellect]) / 10)
    + Math.floor(Math.min(100, stats[ArmorStat.Strength]) / 10)
}


export interface ResultDefinition {
  exotic: undefined | {
    icon: string,
    name: string
  },
  mods: number[];
  stats: number[];
  statsNoMods: number[];
  items: ResultItem[];
  tiers: number;
  waste: number;
  modCost: number;
  modCount: number;
  loaded: boolean;
}

export interface ResultItem {
  energy: number,
  icon: string,
  itemInstanceId: string,
  name: string,
  masterworked: boolean,
  stats: number[],
  statsNoMods: number[]
}

@Component({
  selector: 'app-results',
  templateUrl: './results.component.html',
  styleUrls: ['./results.component.css'],
  animations: [
    trigger('detailExpand', [
      state('collapsed, void', style({height: '0px'})),
      state('expanded', style({height: '*'})),
      transition('expanded <=> collapsed', animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)')),
      transition('expanded <=> void', animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)'))
    ]),],
})
export class ResultsComponent implements OnInit {
  ArmorStat = ArmorStat;
  public StatModifier = StatModifier;

  private _results: Uint16Array = new Uint16Array();
  private _permutations: Uint32Array = new Uint32Array();
  private _config_assumeMasterworked: Boolean = false;
  private _config_enabledMods: ModOrAbility[] = [];
  private _config_limitParsedResults: Boolean = false;
  private _items: Map<number, IInventoryArmor> = new Map<number, IInventoryArmor>();

  tableDataSource = new MatTableDataSource<ResultDefinition>()
  @ViewChild(MatPaginator) paginator: MatPaginator | null = null;
  @ViewChild(MatSort) sort: MatSort | null = null;
  expandedElement: ResultDefinition | null = null;
  shownColumns = ["exotic", "mobility", "resilience", "recovery", "discipline", "intellect", "strength", "tiers", "mods", "dropdown",]

  // info values
  selectedClass: CharacterClass = CharacterClass.None;
  totalResults: number = 0;
  parsedResults: number = 0;

  constructor(private inventory: InventoryService, private db: DatabaseService,
              private bungieApi: BungieApiService, private config: ConfigurationService,
              private status: StatusProviderService) {

  }

  ngOnInit(): void {
    this.config.configuration.subscribe(c => {
      this.selectedClass = c.characterClass;
      this._config_assumeMasterworked = c.assumeMasterworked;
      this._config_enabledMods = c.enabledMods;
      this._config_limitParsedResults = c.limitParsedResults;

      if (c.showWastedStatsColumn) {
        this.shownColumns = ["exotic", "mobility", "resilience", "recovery", "discipline", "intellect", "strength", "tiers", "mods", "waste", "dropdown",]
      } else {
        this.shownColumns = ["exotic", "mobility", "resilience", "recovery", "discipline", "intellect", "strength", "tiers", "mods", "dropdown",]
      }
    })

    this.inventory.armorResults.subscribe(async value => {
      this._results = value.results;
      this._permutations = value.permutations;

      this.status.modifyStatus(s => s.updatingResultsTable = true)
      await this.updateData();
      this.status.modifyStatus(s => s.updatingResultsTable = false)
    })

    this.tableDataSource.paginator = this.paginator;
    this.tableDataSource.sort = this.sort;
    this.tableDataSource.sortingDataAccessor = (data, sortHeaderId) => {
      switch (sortHeaderId) {
        case 'Mobility':
          return data.stats[ArmorStat.Mobility]
        case 'Resilience':
          return data.stats[ArmorStat.Resilience]
        case 'Recovery':
          return data.stats[ArmorStat.Recovery]
        case 'Discipline':
          return data.stats[ArmorStat.Discipline]
        case 'Intellect':
          return data.stats[ArmorStat.Intellect]
        case 'Strength':
          return data.stats[ArmorStat.Strength]
        case 'Tiers':
          return data.tiers
        case 'Waste':
          return data.waste
        case 'Mods':
          return 100 * data.modCount + data.modCost
      }
      return 0;
    }

  }

  async updateData() {
    console.time("Update Table Data")
    this.tableDataSource.data = []
    let data: any[] = []
    let itemsToGrab = new Set<number>();

    const constantModifiersFromConfig = [2, 2, 2, 2, 2, 2]
    for (let configEnabledMod of this._config_enabledMods) {
      for (let bonus of ModInformation[configEnabledMod].bonus) {
        constantModifiersFromConfig[bonus.stat] += bonus.value;
      }
    }

    let limit = this._results.length;
    if (limit > (2.5e5 * RESULTS_PACKAGE.WIDTH) && this._config_limitParsedResults) {
      limit = 2.5e5 * RESULTS_PACKAGE.WIDTH;
    }
    this.totalResults = this._results.length / RESULTS_PACKAGE.WIDTH;
    this.parsedResults = limit / RESULTS_PACKAGE.WIDTH;

    for (let i = 0; i < limit; i += RESULTS_PACKAGE.WIDTH) {
      // console.time("l" + i + " total")
      const entryPermutationPosition = PERMUTATION_PACKAGE.WIDTH * (this._results[i] + (this._results[i + 1] << 16));
      let modList = [
        this._results[i + RESULTS_PACKAGE.USED_MOD1],
        this._results[i + RESULTS_PACKAGE.USED_MOD2],
        this._results[i + RESULTS_PACKAGE.USED_MOD3],
        this._results[i + RESULTS_PACKAGE.USED_MOD4],
        this._results[i + RESULTS_PACKAGE.USED_MOD5],
      ]

      let items = ({
        stats: Array.from(constantModifiersFromConfig),
        statsNoMods: [2, 2, 2, 2, 2, 2],
        modCount: modList.filter(d => d != StatModifier.NONE).length,
        modCost: modList.reduce((p, d: StatModifier) => {
          if (STAT_MOD_VALUES[d] == undefined)
            console.log(p, d, STAT_MOD_VALUES[d], modList, this._results.subarray(i - 10, i + 20))
          return p + STAT_MOD_VALUES[d][2]
        }, 0),
        tiers: 0,
        waste: 0,
        loaded: false,
        mods: modList,
        items: [
          this._permutations[entryPermutationPosition + PERMUTATION_PACKAGE.HELMET_ID],
          this._permutations[entryPermutationPosition + PERMUTATION_PACKAGE.GAUNTLET_ID],
          this._permutations[entryPermutationPosition + PERMUTATION_PACKAGE.CHEST_ID],
          this._permutations[entryPermutationPosition + PERMUTATION_PACKAGE.LEG_ID],
        ] as any
      }) as ResultDefinition

      for (let modId of modList) {
        let smd = STAT_MOD_VALUES[modId as StatModifier]
        if (!!smd && smd[1] != 0) {
          items.stats[smd[0]] += smd[1]
        }
      }

      for (let n = 0; n < 4; n++) {
        if (!this._items.has(items.items[n] as unknown as number))
          itemsToGrab.add(items.items[n] as unknown as number)
      }
      data.push(items)
      //console.timeEnd("l" + i + " total")
    }

    const keys = Array.from(itemsToGrab);
    let items = await this.db.inventoryArmor.bulkGet(keys)
    for (let keyid in keys) {
      if (items[keyid] != undefined)
        this._items.set(keys[keyid], items[keyid] as IInventoryArmor);
    }

    // now fetch the item names
    for (let i = 0; i < data.length; i++) {
      data[i].items = data[i].items.map((e: number) => {
          let instance = this._items.get(e);
          if (!instance) return e;
          if (instance?.isExotic) {
            data[i].exotic = {
              icon: instance.icon,
              name: instance.name
            };
          }

          if (instance?.masterworked || this._config_assumeMasterworked)
            for (let n = 0; n < 6; n++) {
              data[i].stats[n] += 2;
              data[i].statsNoMods[n] += 2;
            }


          data[i].stats[ArmorStat.Mobility] += instance.mobility;
          data[i].stats[ArmorStat.Resilience] += instance.resilience;
          data[i].stats[ArmorStat.Recovery] += instance.recovery;
          data[i].stats[ArmorStat.Discipline] += instance.discipline;
          data[i].stats[ArmorStat.Intellect] += instance.intellect;
          data[i].stats[ArmorStat.Strength] += instance.strength;

          data[i].statsNoMods[ArmorStat.Mobility] += instance.mobility;
          data[i].statsNoMods[ArmorStat.Resilience] += instance.resilience;
          data[i].statsNoMods[ArmorStat.Recovery] += instance.recovery;
          data[i].statsNoMods[ArmorStat.Discipline] += instance.discipline;
          data[i].statsNoMods[ArmorStat.Intellect] += instance.intellect;
          data[i].statsNoMods[ArmorStat.Strength] += instance.strength;

          data[i].waste= data[i].stats.reduce((p: number, v: number) => p + (v % 10), 0);

          return {
            energy: instance.energyAffinity,
            icon: instance.icon,
            itemInstanceId: instance.itemInstanceId,
            name: instance.name,
            masterworked: instance.masterworked,
            stats: [
              instance.mobility, instance.resilience, instance.recovery,
              instance.discipline, instance.intellect, instance.strength
            ]
          } as ResultItem
        }
      )
      data[i].tiers = getSkillTier(data[i].stats)
      data[i].loaded = true;
    }


    console.timeEnd("Update Table Data")

    this.tableDataSource.paginator = this.paginator;
    this.tableDataSource.sort = this.sort;
    this.tableDataSource.data = data;
  }


  async movePermutationItems(characterId: string, element: IMappedGearPermutation) {
    for (let item of element.permutation.items) {
      (item as any)["parseStatus"] = 1;
    }

    for (let item of element.permutation.items) {
      (item as any)["parseStatus"] = 1;
      await this.bungieApi.transferItem(item.itemInstanceId, characterId);
      (item as any)["parseStatus"] = 2;
    }
    for (let item of element.permutation.items) {
      delete (item as any)["parseStatus"];
    }
  }

}
