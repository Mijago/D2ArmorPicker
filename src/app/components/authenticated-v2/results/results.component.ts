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

import { Component, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { InventoryService } from "../../../services/inventory.service";
import { DatabaseService } from "../../../services/database.service";
import { MatTableDataSource } from "@angular/material/table";
import { BungieApiService } from "../../../services/bungie-api.service";
import { CharacterClass } from "../../../data/enum/character-Class";
import { ConfigurationService } from "../../../services/configuration.service";
import { ArmorPerkOrSlot, ArmorStat, StatModifier } from "../../../data/enum/armor-stat";
import { ModOrAbility } from "../../../data/enum/modOrAbility";
import { MatPaginator } from "@angular/material/paginator";
import { MatSort } from "@angular/material/sort";
import { StatusProviderService } from "../../../services/status-provider.service";
import { animate, state, style, transition, trigger } from "@angular/animations";
import { ModInformation } from "../../../data/ModInformation";
import { ModifierType } from "../../../data/enum/modifierType";
import { DestinyEnergyType } from "bungie-api-ts/destiny2";
import { ArmorSlot } from "../../../data/enum/armor-slot";
import { FixableSelection } from "../../../data/buildConfiguration";
import { Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";
import { InventoryArmorSource } from "src/app/data/types/IInventoryArmor";

export interface ResultDefinition {
  exotic:
    | undefined
    | [
        {
          icon: string;
          name: string;
          hash: string;
        }
      ];
  artifice: number[];
  classItem: {
    perk: ArmorPerkOrSlot;
  };
  mods: number[];
  stats: number[];
  statsNoMods: number[];
  items: ResultItem[][];
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
  ERROR_DURING_TRANSFER,
}

export interface ResultItem {
  energy: number;
  energyLevel: number;
  hash: number;
  itemInstanceId: string;
  name: string;
  exotic: boolean;
  masterworked: boolean;
  mayBeBugged: boolean;
  stats: number[];
  slot: ArmorSlot;
  perk: ArmorPerkOrSlot;
  transferState: ResultItemMoveState;
  statsNoMods: number[];
  source: InventoryArmorSource;
}

@Component({
  selector: "app-results",
  templateUrl: "./results.component.html",
  styleUrls: ["./results.component.scss"],
  animations: [
    trigger("detailExpand", [
      state("collapsed, void", style({ height: "0px" })),
      state("expanded", style({ height: "*" })),
      transition("expanded <=> collapsed", animate("225ms cubic-bezier(0.4, 0.0, 0.2, 1)")),
      transition("expanded <=> void", animate("225ms cubic-bezier(0.4, 0.0, 0.2, 1)")),
    ]),
  ],
})
export class ResultsComponent implements OnInit, OnDestroy {
  ArmorStat = ArmorStat;
  public StatModifier = StatModifier;

  private _results: ResultDefinition[] = [];
  _config_assumeLegendariesMasterworked: Boolean = false;
  _config_assumeExoticsMasterworked: Boolean = false;
  _config_assumeClassItemMasterworked: Boolean = false;
  private _config_enabledMods: ModOrAbility[] = [];
  private _config_limitParsedResults: Boolean = false;

  _config_maximumStatMods: number = 5;
  _config_selectedExotics: number[] = [];
  _config_tryLimitWastedStats: boolean = false;
  _config_onlyUseMasterworkedItems: Boolean = false;
  _config_includeCollectionRolls: Boolean = false;
  _config_includeVendorRolls: Boolean = false;
  _config_onlyShowResultsWithNoWastedStats: Boolean = false;
  _config_assumeEveryLegendaryIsArtifice: Boolean = false;
  _config_modslotLimitation: FixableSelection<number>[] = [];
  _config_armorPerkLimitation: FixableSelection<ArmorPerkOrSlot>[] = [];

  tableDataSource = new MatTableDataSource<ResultDefinition>();
  @ViewChild(MatPaginator) paginator: MatPaginator | null = null;
  @ViewChild(MatSort) sort: MatSort | null = null;
  expandedElement: ResultDefinition | null = null;
  shownColumns = [
    "exotic",
    "mobility",
    "resilience",
    "recovery",
    "discipline",
    "intellect",
    "strength",
    "tiers",
    "mods",
    "dropdown",
  ];

  // info values
  selectedClass: CharacterClass = CharacterClass.None;
  totalTime: number = 0;
  itemCount: number = 0;
  totalResults: number = 0;
  parsedResults: number = 0;

  constructor(
    private inventory: InventoryService,
    private db: DatabaseService,
    private bungieApi: BungieApiService,
    private config: ConfigurationService,
    private status: StatusProviderService
  ) {}

  ngOnInit(): void {
    this.config.configuration.pipe(takeUntil(this.ngUnsubscribe)).subscribe((c) => {
      this.selectedClass = c.characterClass;
      this._config_assumeLegendariesMasterworked = c.assumeLegendariesMasterworked;
      this._config_assumeExoticsMasterworked = c.assumeExoticsMasterworked;
      this._config_assumeClassItemMasterworked = c.assumeClassItemMasterworked;
      this._config_tryLimitWastedStats = c.tryLimitWastedStats;
      this._config_enabledMods = c.enabledMods || [];
      this._config_limitParsedResults = c.limitParsedResults;

      this._config_maximumStatMods = c.maximumStatMods;
      this._config_onlyUseMasterworkedItems = c.onlyUseMasterworkedItems;
      this._config_includeCollectionRolls = c.includeCollectionRolls;
      this._config_includeVendorRolls = c.includeVendorRolls;
      this._config_onlyShowResultsWithNoWastedStats = c.onlyShowResultsWithNoWastedStats;
      this._config_assumeEveryLegendaryIsArtifice = c.assumeEveryLegendaryIsArtifice;
      this._config_selectedExotics = c.selectedExotics;
      this._config_armorPerkLimitation = Object.entries(c.armorPerks)
        .filter((v) => v[1].value != ArmorPerkOrSlot.None)
        .map((k) => k[1]);
      this._config_modslotLimitation = Object.entries(c.maximumModSlots)
        .filter((v) => v[1].value < 5)
        .map((k) => k[1]);

      let columns = [
        "exotic",
        "mobility",
        "resilience",
        "recovery",
        "discipline",
        "intellect",
        "strength",
        c.showPotentialTierColumn ? "potential_tiers" : "tiers",
        "mods",
      ];
      if (c.showWastedStatsColumn) columns.push("waste");
      columns.push("dropdown");
      this.shownColumns = columns;
    });

    this.inventory.armorResults.pipe(takeUntil(this.ngUnsubscribe)).subscribe(async (value) => {
      this._results = value.results;
      this.itemCount = value.itemCount;
      this.totalTime = value.totalTime;
      this.totalResults = value.totalResults;
      this.parsedResults = this._results.length;

      this.status.modifyStatus((s) => (s.updatingResultsTable = true));
      await this.updateData();
      this.status.modifyStatus((s) => (s.updatingResultsTable = false));
    });

    this.tableDataSource.paginator = this.paginator;
    this.tableDataSource.sort = this.sort;
    this.tableDataSource.sortingDataAccessor = (data, sortHeaderId) => {
      switch (sortHeaderId) {
        case "Mobility":
          return data.stats[ArmorStat.Mobility];
        case "Resilience":
          return data.stats[ArmorStat.Resilience];
        case "Recovery":
          return data.stats[ArmorStat.Recovery];
        case "Discipline":
          return data.stats[ArmorStat.Discipline];
        case "Intellect":
          return data.stats[ArmorStat.Intellect];
        case "Strength":
          return data.stats[ArmorStat.Strength];
        case "Tiers":
          return data.tiers;
        case "Max Tiers":
          return 10 * (data.tiers + (5 - data.modCount));
        case "Waste":
          return data.waste;
        case "Mods":
          return (
            +100 * data.modCount +
            //+ 40 * data.artifice.length
            data.modCost
          );
      }
      return 0;
    };
  }

  async updateData() {
    console.time("Update Table Data");
    this.tableDataSource.paginator = this.paginator;
    this.tableDataSource.sort = this.sort;
    this.tableDataSource.data = this._results;
    console.timeEnd("Update Table Data");
  }

  checkIfAnyItemsMayBeInvalid(element: ResultDefinition) {
    return (
      (element?.items.filter((d) => d.filter((x) => x.mayBeBugged).length > 0).length || 0) > 0
    );
  }

  private ngUnsubscribe = new Subject();

  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }

  saveBuilds() {
    let jsonData = {
      configCompressed: this.config.getCurrentConfigBase64Compressed(),
      config: this.config.readonlyConfigurationSnapshot,
      results: this._results.map((r) => {
        let p = Object.assign({}, r);
        p.items = p.items.map((i) => {
          return { hash: i[0].hash, instance: i[0].itemInstanceId } as any;
        });
        delete p.exotic;
        return p;
      }),
    };

    // download the file
    let a = document.createElement("a");
    a.download = "builds.json";
    const url = window.URL.createObjectURL(new Blob([JSON.stringify(jsonData, null, 2)]));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "d2ap_results.json");
    document.body.appendChild(link);
    link.click();
  }
}
