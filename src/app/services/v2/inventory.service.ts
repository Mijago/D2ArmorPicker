import {Injectable} from '@angular/core';
import {CharacterClass} from "../../data/enum/character-Class";
import {DatabaseService} from "../database.service";
import {IManifestArmor} from "../IManifestArmor";
import {ConfigurationService} from "./configuration.service";
import {debounceTime} from "rxjs/operators";
import {BehaviorSubject, interval, Observable} from "rxjs";
import {Configuration} from "../../data/configuration";
import {ArmorStat, SpecialArmorStat, STAT_MOD_VALUES, StatModifier} from "../../data/enum/armor-stat";
import {StatusProviderService} from "./status-provider.service";
import {BungieApiService} from "../bungie-api.service";
import {environment} from "../../../environments/environment";
import {AuthService} from "../auth.service";
import {EnumDictionary} from "../../data/types/EnumDictionary";
import {ArmorSlot} from "../../data/permutation";
import {DestinyEnergyType} from "bungie-api-ts/destiny2";
import {NavigationEnd, Router} from "@angular/router";
import {ResultDefinition} from "../../components/authenticated-v2/results/results.component";
import {IInventoryArmor} from "../IInventoryArmor";
import {ModInformation} from "../../data/ModInformation";
import {DID_NOT_SELECT_EXOTIC, FORCE_USE_NO_EXOTIC} from "../../data/constants";


export interface IArmorResult {
  helmetId: number;
  gauntletId: number;
  chestId: number;
  legsId: number
  exoticHash: number | null;
  stats: [number, number, number, number, number, number];
  usedMods: StatModifier[];
}

type info = {
  results: ResultDefinition[],
  totalResults: number,
  maximumPossibleTiers: number[],
  statCombo3x100: ArmorStat[][],
  statCombo4x100: ArmorStat[][]
};

const slotToEnum: { [id: string]: ArmorSlot; } = {
  "Helmets": ArmorSlot.ArmorSlotHelmet,
  "Arms": ArmorSlot.ArmorSlotGauntlet,
  "Chest": ArmorSlot.ArmorSlotChest,
  "Legs": ArmorSlot.ArmorSlotLegs,
}

@Injectable({
  providedIn: 'root'
})
export class InventoryService {

  /**
   * An Int32Array that holds all permutations for the currently selected class, before filters are applied.
   * It consists of N items of length 11:
   * helmetHash, gauntletHash, chestHash, legHash, mobility, resilience, recovery, discipline, intellect, strength, exoticHash
   * @private
   */
  private allArmorResults: ResultDefinition[] = [];
  private currentClass: CharacterClass = CharacterClass.None;
  private checkFixedArmorAffinities: null | EnumDictionary<ArmorSlot, DestinyEnergyType> = null;
  private ignoreArmorAffinitiesOnMasterworkedItems: boolean = false;


  private _inventory: BehaviorSubject<null>;
  public readonly inventory: Observable<null>;

  private _armorResults: BehaviorSubject<info>;
  public readonly armorResults: Observable<info>;

  private _config: Configuration = Configuration.buildEmptyConfiguration();
  private eventHalloweenOnlyUseMask: boolean = false;
  private updatingResults: boolean = false;

  constructor(private db: DatabaseService, private config: ConfigurationService, private status: StatusProviderService,
              private api: BungieApiService, private auth: AuthService, private router: Router) {
    this._inventory = new BehaviorSubject(null)
    this.inventory = this._inventory.asObservable();


    this._armorResults = new BehaviorSubject({
      results: this.allArmorResults
    } as info)
    this.armorResults = this._armorResults.asObservable();

    let dataAlreadyFetched = false;
    let isUpdating = false;

    router.events.subscribe(async val => {
      if (val instanceof NavigationEnd) {
        this.clearResults()
        await this.refreshAll(!dataAlreadyFetched);
        dataAlreadyFetched = true;
      }
    })

    config.configuration
      .pipe(
        debounceTime(500)
      )
      .subscribe(async c => {
        if (this.auth.refreshTokenExpired || !await this.auth.autoRegenerateTokens()) {
          await this.auth.logout();
          return;
        }

        this._config = c;

        // HALLOWEEN SPECIAL
        this.eventHalloweenOnlyUseMask = c.eventHalloweenOnlyUseMask
        // /HALLOWEEN SPECIAL
        this.ignoreArmorAffinitiesOnMasterworkedItems = c.ignoreArmorAffinitiesOnMasterworkedItems;
        this.checkFixedArmorAffinities = {
          [ArmorSlot.ArmorSlotHelmet]: c.fixedArmorAffinities[ArmorSlot.ArmorSlotHelmet],
          [ArmorSlot.ArmorSlotGauntlet]: c.fixedArmorAffinities[ArmorSlot.ArmorSlotGauntlet],
          [ArmorSlot.ArmorSlotChest]: c.fixedArmorAffinities[ArmorSlot.ArmorSlotChest],
          [ArmorSlot.ArmorSlotLegs]: c.fixedArmorAffinities[ArmorSlot.ArmorSlotLegs],
          [ArmorSlot.ArmorSlotClass]: c.fixedArmorAffinities[ArmorSlot.ArmorSlotClass],
        };

        isUpdating = true;
        await this.refreshAll(!dataAlreadyFetched);
        dataAlreadyFetched = true;

        isUpdating = false;
      })
  }

  private clearResults() {
    this.allArmorResults = []
    this._armorResults.next({
      results: this.allArmorResults,
      totalResults: 0,
      maximumPossibleTiers: [0, 0, 0, 0, 0, 0],
      statCombo3x100: [],
      statCombo4x100: []
    })
  }

  shouldCalculateResults(): boolean {
    console.log("this.router.url", this.router.url)
    return this.router.url == "/v2"
  }

  async refreshAll(force: boolean = false) {

    let manifestUpdated = await this.updateManifest();
    let armorUpdated = await this.updateInventoryItems(manifestUpdated || force);

    // trigger armor update behaviour
    if (armorUpdated) this._inventory.next(null);

    // Do not update results in Help and Cluster pages
    if (this.shouldCalculateResults()) {
      this.updateResults()
    }
  }


  updateResults() {
    this.clearResults();

    if (this.updatingResults) {
      console.warn("Called updateResults, but aborting, as it is already running.")
      return;
    }
    try {
      console.time("updateResults with WebWorker")
      this.updatingResults = true;
      this.status.modifyStatus(s => s.calculatingResults = true)
      let results: any[] = []
      const worker = new Worker(new URL('./results-builder2.worker', import.meta.url));
      worker.onmessage = ({data}) => {
        results.push(data.results)
        if (data.done == true) {
          this.status.modifyStatus(s => s.calculatingResults = false)
          this.updatingResults = false;

          let endResults = []
          for (let result of results) {
            endResults.push(...result)
          }

          for (let n = 0; n < 6; n++)
            data.runtime.maximumPossibleTiers[n] = Math.floor(Math.min(100, data.runtime.maximumPossibleTiers[n]) / 10)

          this._armorResults.next({
            results: endResults,
            totalResults: data.total, // Total amount of results, differs from the real amount if the memory save setting is active
            maximumPossibleTiers: data.runtime.maximumPossibleTiers,
            statCombo3x100: Array.from(data.runtime.statCombo3x100 as Set<number>).map((d: number) => {
              let r: ArmorStat[] = []
              for (let n = 0; n < 6; n++)
                if ((d & (1 << n)) > 0)
                  r.push(n)
              return r;
            }) || [],
            statCombo4x100: Array.from(data.runtime.statCombo4x100 as Set<number>).map((d: number) => {
              let r = [];
              for (let n = 0; n < 6; n++)
                if ((d & (1 << n)) > 0)
                  r.push(n)
              return r;
            }, []) || []
          })
          console.timeEnd("updateResults with WebWorker")
        }
      };
      worker.postMessage({
        currentClass: this.currentClass,
        config: this._config
      });

    } finally {
    }


  }

  async getExoticsForClass(clazz: CharacterClass, slot?: string): Promise<Array<IManifestArmor>> {
    const armors = await this.db.manifestArmor
      .where("isExotic").equals(1)
      .toArray();
    return armors
      // filter relevant items
      .filter(d => (d.clazz == clazz as any) && d.armor2 && (!slot || d.slot == slot))
      // Remove duplicates, in case the manifest has been inserted twice
      .filter((thing, index, self) =>
        index === self.findIndex((t) => (t.hash === thing.hash))
      )
  }

  async updateManifest(force: boolean = false): Promise<boolean> {
    this.status.modifyStatus(s => s.updatingManifest = true);
    let r = await this.api.updateManifest(force);
    this.status.modifyStatus(s => s.updatingManifest = false);
    return !!r;
  }

  async updateInventoryItems(force: boolean = false): Promise<boolean> {
    this.status.modifyStatus(s => s.updatingInventory = true);
    let r = await this.api.updateArmorItems(force);
    this.status.modifyStatus(s => s.updatingInventory = false);
    return !!r;
  }
}
