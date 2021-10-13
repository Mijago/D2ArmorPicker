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
import {EnumDictionary} from "../../data/types/EnumDictionary";
import {ArmorSlot} from "../../data/permutation";
import {DestinyEnergyType} from "bungie-api-ts/destiny2";

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
  private currentIgnoredItems: string[] = []
  private checkFixedArmorAffinities: null | EnumDictionary<ArmorSlot, DestinyEnergyType> = null;
  private ignoreArmorAffinitiesOnMasterworkedItems: boolean = false;


  private _armorPermutations: BehaviorSubject<Uint32Array>;
  public readonly armorPermutations: Observable<Uint32Array>;

  private _armorResults: BehaviorSubject<info>;
  public readonly armorResults: Observable<info>;

  private _config: Configuration = Configuration.buildEmptyConfiguration();
  private eventHalloweenOnlyUseMask: boolean = false;

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
        let forceUpdatePermutations = c.characterClass != this.currentClass
          || this.currentIgnoredItems.length != c.disabledItems.length
          || this.ignoreArmorAffinitiesOnMasterworkedItems != c.ignoreArmorAffinitiesOnMasterworkedItems
          || this.eventHalloweenOnlyUseMask != c.eventHalloweenOnlyUseMask // HALLOWEEN SPECIAL

        if (forceUpdatePermutations) {
          this.currentClass = c.characterClass;
          this.currentIgnoredItems = ([] as string[]).concat(c.disabledItems)
        }

        if (this.checkFixedArmorAffinities != null)
          for (let n = 0; !forceUpdatePermutations && (n < 5); n++) {
            if (this.checkFixedArmorAffinities[n as ArmorSlot] != c.fixedArmorAffinities[n as ArmorSlot])
              forceUpdatePermutations = true;
          }

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
        await this.refreshAll(!dataAlreadyFetched, forceUpdatePermutations);
        dataAlreadyFetched = true;

        isUpdating = false;
      })
  }

  async updatePermutations() {
    this.status.modifyStatus(s => s.calculatingPermutations = true)
    const worker = new Worker(new URL('./permutation-webworker.worker', import.meta.url));
    worker.onmessage = ({data}) => {
      this.allArmorPermutations = new Uint32Array(data)
      this.status.modifyStatus(s => s.calculatingPermutations = false)
      this._armorPermutations.next(this.allArmorPermutations)
    };
    worker.postMessage({
      clazz: this.currentClass,
      config: this._config
    });
  }

  async refreshAll(force: boolean = false, forceUpdatePermutations = false) {
    let manifestUpdated = await this.updateManifest();
    let armorUpdated = await this.updateInventoryItems(manifestUpdated || force);
    if (armorUpdated || forceUpdatePermutations)
      await this.updatePermutations();
    else
      this.updateResults()
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
