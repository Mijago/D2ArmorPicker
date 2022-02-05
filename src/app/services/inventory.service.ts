import {Injectable} from '@angular/core';
import {CharacterClass} from "../data/enum/character-Class";
import {DatabaseService} from "./database.service";
import {IManifestArmor} from "../data/types/IManifestArmor";
import {ConfigurationService} from "./configuration.service";
import {debounceTime} from "rxjs/operators";
import {BehaviorSubject, Observable} from "rxjs";
import {Configuration} from "../data/configuration";
import {ArmorStat, StatModifier} from "../data/enum/armor-stat";
import {StatusProviderService} from "./status-provider.service";
import {BungieApiService} from "./bungie-api.service";
import {AuthService} from "./auth.service";
import {EnumDictionary} from "../data/types/EnumDictionary";
import {ArmorSlot} from "../data/enum/armor-slot";
import {DestinyEnergyType} from "bungie-api-ts/destiny2";
import {NavigationEnd, Router} from "@angular/router";
import {ResultDefinition} from "../components/authenticated-v2/results/results.component";
import {IInventoryArmor} from "../data/types/IInventoryArmor";

type info = {
  results: ResultDefinition[],
  totalResults: number,
  maximumPossibleTiers: number[],
  statCombo3x100: ArmorStat[][],
  statCombo4x100: ArmorStat[][],
  itemCount: number,
  totalTime: number,
};

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
  private ignoreArmorAffinitiesOnMasterworkedItems: boolean = false;


  private _manifest: BehaviorSubject<null>;
  public readonly manifest: Observable<null>;
  private _inventory: BehaviorSubject<null>;
  public readonly inventory: Observable<null>;

  private _armorResults: BehaviorSubject<info>;
  public readonly armorResults: Observable<info>;

  private _config: Configuration = Configuration.buildEmptyConfiguration();
  private updatingResults: boolean = false;

  constructor(private db: DatabaseService, private config: ConfigurationService, private status: StatusProviderService,
              private api: BungieApiService, private auth: AuthService, private router: Router) {
    this._inventory = new BehaviorSubject(null)
    this.inventory = this._inventory.asObservable();
    this._manifest = new BehaviorSubject(null)
    this.manifest = this._manifest.asObservable();


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
        this.ignoreArmorAffinitiesOnMasterworkedItems = c.ignoreArmorAffinitiesOnMasterworkedItems;

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
      totalTime: 0,
      itemCount: 0,
      maximumPossibleTiers: [0, 0, 0, 0, 0, 0],
      statCombo3x100: [],
      statCombo4x100: []
    })
  }

  shouldCalculateResults(): boolean {
    console.log("this.router.url", this.router.url)
    return this.router.url == "/"
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


  updateResults(nthreads: number = 3) {
    this.clearResults();

    if (this.updatingResults) {
      console.warn("Called updateResults, but aborting, as it is already running.")
      return;
    }
    try {
      console.time("updateResults with WebWorker")
      this.updatingResults = true;
      this.status.modifyStatus(s => s.calculatingResults = true)
      let doneWorkerCount = 0;

      let results: any[] = []
      let totalPermutationCount = 0;
      let resultMaximumTiers: number[][] = []
      let resultStatCombo3x100 = new Set<number>()
      let resultStatCombo4x100 = new Set<number>()
      const startTime = Date.now();

      for (let n = 0; n < nthreads; n++) {
        const worker = new Worker(new URL('./results-builder.worker', import.meta.url));
        worker.onmessage = ({data}) => {
          results.push(data.results)
          if (data.done == true) {
            doneWorkerCount++;
            totalPermutationCount += data.stats.permutationCount;
            resultMaximumTiers.push(data.runtime.maximumPossibleTiers)
            for (let elem of data.runtime.statCombo3x100) resultStatCombo3x100.add(elem)
            for (let elem of data.runtime.statCombo4x100) resultStatCombo4x100.add(elem)
            console.debug("resultMaximumTiers", resultMaximumTiers)
          }
          if (data.done == true && doneWorkerCount == nthreads) {
            this.status.modifyStatus(s => s.calculatingResults = false)
            this.updatingResults = false;

            let endResults = []
            for (let result of results) {
              endResults.push(...result)
            }

            this._armorResults.next({
              results: endResults,
              totalResults: totalPermutationCount, // Total amount of results, differs from the real amount if the memory save setting is active
              itemCount: data.stats.itemCount,
              totalTime: Date.now() - startTime,
              maximumPossibleTiers: resultMaximumTiers.reduce((p, v) => {
                for (let k = 0; k < 6; k++)
                  if (p[k] < v[k]) p[k] = v[k];
                return p;
              }, [0, 0, 0, 0, 0, 0]).map(k => Math.floor(Math.min(100, k) / 10)),
              statCombo3x100: Array.from(resultStatCombo3x100 as Set<number>).map((d: number) => {
                let r: ArmorStat[] = []
                for (let n = 0; n < 6; n++)
                  if ((d & (1 << n)) > 0)
                    r.push(n)
                return r;
              }) || [],
              statCombo4x100: Array.from(resultStatCombo4x100 as Set<number>).map((d: number) => {
                let r = [];
                for (let n = 0; n < 6; n++)
                  if ((d & (1 << n)) > 0)
                    r.push(n)
                return r;
              }, []) || []
            })
            console.timeEnd("updateResults with WebWorker")
            worker.terminate();
          } else if (data.done == true && doneWorkerCount != nthreads)
            worker.terminate();
        };
        worker.onerror = ev => {
          console.error("ERROR IN WEBWORKER, TERMINATING WEBWORKER", ev);
          worker.terminate()
        }
        worker.postMessage({
          currentClass: this.currentClass,
          config: this._config,
          threadSplit: {
            count: nthreads,
            current: n
          }
        });
      }


    } finally {
    }
  }

  public exoticsForClass: Array<IManifestArmor> = [];

  async getExoticsForClass(clazz: CharacterClass, slot?: ArmorSlot): Promise<Array<IManifestArmor>> {
    let armors = await this.db.inventoryArmor
      .where("isExotic").equals(1)
      .toArray();
    armors = armors
      // filter relevant items
      .filter(d => (d.clazz == clazz as any) && d.armor2 && (!slot || d.slot == slot))
      // Remove duplicates, in case the manifest has been inserted twice
      .filter((thing, index, self) =>
        index === self.findIndex((t) => (t.hash === thing.hash))
      )
    this.exoticsForClass = armors;
    return armors;
  }

  async updateManifest(force: boolean = false): Promise<boolean> {
    this.status.modifyStatus(s => s.updatingManifest = true);
    let r = await this.api.updateManifest(force);
    if (!!r) this._manifest.next(null);
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
