import {Component, OnInit, ViewChild} from '@angular/core';
import {IArmorResult, InventoryService} from "../../../services/v2/inventory.service";
import {DatabaseService} from "../../../services/database.service";
import {MatTableDataSource} from "@angular/material/table";
import {IMappedGearPermutation, MOD_INDICES} from "../../authenticated/main/main.component";
import {BungieApiService} from "../../../services/bungie-api.service";
import {CharacterClass} from "../../../data/enum/character-Class";
import {ConfigurationService} from "../../../services/v2/configuration.service";
import {ArmorStat, SpecialArmorStat, STAT_MOD_VALUES, StatModifier} from "../../../data/enum/armor-stat";
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

export enum ResultItemMoveState {
  TRANSFER_NONE,
  WAITING_FOR_TRANSFER,
  TRANSFERRING,
  TRANSFERRED,
  ERROR_DURING_TRANSFER
}

export interface ResultItem {
  energy: number,
  icon: string,
  itemInstanceId: string,
  name: string,
  exotic: boolean,
  masterworked: boolean,
  mayBeBugged: boolean,
  stats: number[],
  transferState: ResultItemMoveState,
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

  private _results: ResultDefinition[] = [];
  private _config_assumeLegendariesMasterworked: Boolean = false;
  private _config_assumeExoticsMasterworked: Boolean = false;
  private _config_assumeClassItemMasterworked: Boolean = false;
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
      this._config_assumeLegendariesMasterworked = c.assumeLegendariesMasterworked;
      this._config_assumeExoticsMasterworked = c.assumeExoticsMasterworked;
      this._config_assumeClassItemMasterworked = c.assumeClassItemMasterworked;
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
      this.totalResults = value.totalResults;
      this.parsedResults = this._results.length;

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
    this.tableDataSource.paginator = this.paginator;
    this.tableDataSource.sort = this.sort;
    this.tableDataSource.data = this._results;
    console.timeEnd("Update Table Data")
  }

  checkIfAnyItemsMayBeInvalid(element: ResultDefinition) {
    return (element?.items.filter(d => d.mayBeBugged).length || 0) > 0
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
