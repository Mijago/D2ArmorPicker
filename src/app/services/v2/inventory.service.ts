import {Injectable} from '@angular/core';
import {CharacterClass} from "../../data/enum/character-Class";
import {DatabaseService} from "../database.service";
import {IManifestArmor} from "../IManifestArmor";
import {ConfigurationService} from "./configuration.service";
import {debounceTime} from "rxjs/operators";
import {BehaviorSubject, interval, Observable} from "rxjs";
import {Configuration} from "../../data/configuration";
import {ArmorStat} from "../../data/enum/armor-stat";
import {StatusProviderService} from "./status-provider.service";
import {BungieApiService} from "../bungie-api.service";
import {environment} from "../../../environments/environment";
import {AuthService} from "../auth.service";

type info = {
  results: Uint16Array, permutations: Uint32Array, maximumPossibleTiers: number[],
  statCombo3x100: [ArmorStat, ArmorStat, ArmorStat][],
  statCombo4x100: [ArmorStat, ArmorStat, ArmorStat, ArmorStat][]
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
  private allArmorPermutations: Uint32Array = new Uint32Array(0);
  private allArmorResults: Uint16Array = new Uint16Array(0);
  private currentClass: CharacterClass = CharacterClass.None;


  private _armorPermutations: BehaviorSubject<Uint32Array>;
  public readonly armorPermutations: Observable<Uint32Array>;

  private _armorResults: BehaviorSubject<info>;
  public readonly armorResults: Observable<info>;

  private _config: Configuration = Configuration.buildEmptyConfiguration();

  constructor(private db: DatabaseService, private config: ConfigurationService, private status: StatusProviderService,
              private api: BungieApiService, private auth: AuthService) {
    this._armorPermutations = new BehaviorSubject(new Uint32Array(0))
    this.armorPermutations = this._armorPermutations.asObservable();

    this._armorResults = new BehaviorSubject({
      results: this.allArmorResults,
      permutations: this.allArmorPermutations
    } as info)
    this.armorResults = this._armorResults.asObservable();

    this.armorPermutations.subscribe(p => {
      if (this.allArmorPermutations.length > 0)
        this.updateResults();
    })

    let dataAlreadyFetched = false;
    let isUpdating = false;

    if (!environment.production)
      dataAlreadyFetched = true;

    config.configuration
      .pipe(
        debounceTime(500)
        )
      .subscribe(async c => {

        if (this.auth.refreshTokenExpired || !await this.auth.autoRegenerateTokens()) {
          await this.auth.logout();
          return;
        }


        isUpdating = true;
        await this.refreshAll(!dataAlreadyFetched, false);
        dataAlreadyFetched = true;

        this._config = c;
        // If character has been changed, first update all permutations for the character
        // The results will automatically be updated
        if (c.characterClass != this.currentClass) {
          this.currentClass = c.characterClass;
          this.status.modifyStatus(s => s.calculatingPermutations = true)
          const worker = new Worker(new URL('./permutation-webworker.worker', import.meta.url));
          worker.onmessage = ({data}) => {
            this.allArmorPermutations = new Uint32Array(data)
            this.status.modifyStatus(s => s.calculatingPermutations = false)
            this._armorPermutations.next(this.allArmorPermutations)
          };
          worker.postMessage(this.currentClass);
        } else {
          if (this.allArmorPermutations.length > 0)
            this.updateResults();
        }
        isUpdating = false;
      })
  }

  async refreshAll(force: boolean = false, doUpdateResults = true) {
    await this.updateManifest();
    await this.updateInventoryItems(force);
    if (doUpdateResults)
      await this.updateResults();
  }

  updateResults() {
    console.debug("call updateResults")
    this.status.modifyStatus(s => s.calculatingResults = true)
    const worker = new Worker(new URL('./results-builder.worker', import.meta.url));
    worker.onmessage = ({data}) => {
      this.allArmorResults = new Uint16Array(data.view)
      this.allArmorPermutations = new Uint32Array(data.allArmorPermutations)

      this.status.modifyStatus(s => s.calculatingResults = false)

      this._armorResults.next({
        results: this.allArmorResults,
        permutations: this.allArmorPermutations,
        maximumPossibleTiers: data.maximumPossibleTiers,
        statCombo3x100: data.statCombo3x100.map((d: number) => {
          let r = []
          for (let n = 0; n < 6; n++)
            if ((d & (1 << n)) > 0)
              r.push(n)
          return r;
        }) || [],
        statCombo4x100: data.statCombo4x100.map((d: number) => {
          let r = [];
          for (let n = 0; n < 6; n++)
            if ((d & (1 << n)) > 0)
              r.push(n)
          return r;
        }, []) || []
      })
    };
    worker.postMessage({
      currentClass: this.currentClass,
      config: this._config,
      permutations: this.allArmorPermutations.buffer
    }, [this.allArmorPermutations.buffer]);

  }

  async getExoticsForClass(clazz: CharacterClass, slot?: string): Promise<Array<IManifestArmor>> {
    const armors = await this.db.manifestArmor
      .where("isExotic").equals(1)
      .toArray();
    return armors.filter(d => (d.clazz == clazz as any) && d.armor2 && (!slot || d.slot == slot));
  }

  async updateManifest(force: boolean = false) {
    this.status.modifyStatus(s => s.updatingManifest = true);
    await this.api.updateManifest(force);
    this.status.modifyStatus(s => s.updatingManifest = false);
  }
  async updateInventoryItems(force: boolean = false) {
    this.status.modifyStatus(s => s.updatingInventory = true);
    await this.api.updateArmorItems(force);
    this.status.modifyStatus(s => s.updatingInventory = false);
  }

}
