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


  private async Calculate() {
    let exoticItemInfo = this._config.selectedExoticHash <= DID_NOT_SELECT_EXOTIC
      ? null
      : await this.db.inventoryArmor.where("hash").equals(this._config.selectedExoticHash).first() as IInventoryArmor


    let items = (await this.db.inventoryArmor.where("clazz").equals(this._config.characterClass)
      .toArray() as IInventoryArmor[])
    items = items.concat(items)
    console.log("items.len", items.length)

    items = items
      // filter disabled items
      .filter(item => this._config.disabledItems.indexOf(item.itemInstanceId) == -1)
      // filter the selected exotic right here (config.selectedExoticHash)
      .filter(item => this._config.selectedExoticHash != FORCE_USE_NO_EXOTIC || !item.isExotic)
      // .filter(item => !item.isExotic || config.selectedExoticHash <= DID_NOT_SELECT_EXOTIC || config.selectedExoticHash == item.hash)
      .filter(item => exoticItemInfo == null || exoticItemInfo.slot != item.slot || exoticItemInfo.hash == item.hash)
      // config.onlyUseMasterworkedItems - only keep masterworked items
      .filter(item => !this._config.onlyUseMasterworkedItems || item.masterworked)
      .filter(item =>
        this._config.ignoreArmorAffinitiesOnMasterworkedItems
        || !item.masterworked
        || this._config.fixedArmorAffinities[slotToEnum[item.slot]] == 0
        || this._config.fixedArmorAffinities[slotToEnum[item.slot]] == item.energyAffinity
      )
    //.toArray() as IInventoryArmor[];
    console.log("items.len", items.length)

    console.log("ITEMS", items.length, items)


    const helmets = items.filter(i => i.slot == "Helmets")
    const gauntlets = items.filter(i => i.slot == "Arms")
    const chests = items.filter(i => i.slot == "Chest")
    const legs = items.filter(i => i.slot == "Legs")

    console.log({helmets, gauntlets, chests, legs})


    // runtime variables
    const runtime = {
      maximumPossibleTiers: [0, 0, 0, 0, 0, 0],
      statCombo3x100: new Set(),
      statCombo4x100: new Set(),
    }

    const results = []
    let n = 0;

    console.time("total")
    console.time("tm")
    for (let helmet of helmets) {
      // HALLOWEEN SPECIAL
      if (this._config.eventHalloweenOnlyUseMask) {
        if (
          helmet.hash != 2545426109 // warlock
          && helmet.hash != 199733460 // Titan
          && helmet.hash != 3224066584 // Hunter
        ) continue;
      }
      // /HALLOWEEN SPECIAL
      for (let gauntlet of gauntlets) {
        if (helmet.isExotic && gauntlet.isExotic) continue;
        for (let chest of chests) {
          if ((helmet.isExotic || gauntlet.isExotic) && chest.isExotic) continue;
          for (let leg of legs) {
            if ((helmet.isExotic || gauntlet.isExotic || chest.isExotic) && leg.isExotic) continue;
            /**
             *  At this point we already have:
             *  - Masterworked items, if they must be masterworked (config.onlyUseMasterworkedItems)
             *  - disabled items were already removed (config.disabledItems)
             */
            const result = handlePermutation(runtime, this._config, helmet, gauntlet, chest, leg,
              !(this._config.limitParsedResults && n < 5e4));
            // Only add 50k to the list if the setting is activated.
            // We will still calculate the rest so that we get accurate results for the runtime values
            if (result != null)
              results.push(result)
            //}
          }
        }
      }
    }
    console.timeEnd("total")

    for (let n = 0; n < 6; n++)
      runtime.maximumPossibleTiers[n] = Math.floor(Math.min(100, runtime.maximumPossibleTiers[n]) / 10)

    return {runtime, results}
  }

}

/**
 * Returns null, if the permutation is invalid.
 * This code does not utilize fancy filters and other stuff.
 * This results in ugly code BUT it is way way WAY faster!
 */
function handlePermutation(
  runtime: any,
  config: Configuration,
  helmet: IInventoryArmor,
  gauntlet: IInventoryArmor,
  chest: IInventoryArmor,
  leg: IInventoryArmor,
  doNotOutput = false
): any {
  const items = [helmet, gauntlet, chest, leg]
  // yes. this is ugly, but it is fast
  const exotic = helmet.isExotic ? helmet : gauntlet.isExotic ? gauntlet : chest.isExotic ? chest : leg.isExotic ? leg : null
  const stats: [number, number, number, number, number, number] = [
    helmet.mobility + gauntlet.mobility + chest.mobility + leg.mobility,
    helmet.resilience + gauntlet.resilience + chest.resilience + leg.resilience,
    helmet.recovery + gauntlet.recovery + chest.recovery + leg.recovery,
    helmet.discipline + gauntlet.discipline + chest.discipline + leg.discipline,
    helmet.intellect + gauntlet.intellect + chest.intellect + leg.intellect,
    helmet.strength + gauntlet.strength + chest.strength + leg.strength,
  ]

  var totalStatBonus = config.assumeClassItemMasterworked ? 2 : 0;

  for (let item of items) {  // add masterworked value, if necessary
    if (item.masterworked
      || (!item.isExotic && config.assumeLegendariesMasterworked)
      || (item.isExotic && config.assumeExoticsMasterworked))
      totalStatBonus += 2;
  }
  stats[0] += totalStatBonus;
  stats[1] += totalStatBonus;
  stats[2] += totalStatBonus;
  stats[3] += totalStatBonus;
  stats[4] += totalStatBonus;
  stats[5] += totalStatBonus;

  // Apply configurated mods to the stat value
  // Apply mods
  for (const mod of config.enabledMods) {
    for (const bonus of ModInformation[mod].bonus) {
      var statId = bonus.stat == SpecialArmorStat.ClassAbilityRegenerationStat
        ? [1, 0, 3][config.characterClass]
        : bonus.stat
      stats[statId] += bonus.value;
    }
  }

  // required mods for each stat
  const requiredMods = [
    Math.ceil(Math.max(0, config.minimumStatTier[0] - stats[0] / 10)),
    Math.ceil(Math.max(0, config.minimumStatTier[1] - stats[1] / 10)),
    Math.ceil(Math.max(0, config.minimumStatTier[2] - stats[2] / 10)),
    Math.ceil(Math.max(0, config.minimumStatTier[3] - stats[3] / 10)),
    Math.ceil(Math.max(0, config.minimumStatTier[4] - stats[4] / 10)),
    Math.ceil(Math.max(0, config.minimumStatTier[5] - stats[5] / 10)),
  ]
  const requiredModsTotal = requiredMods[0] + requiredMods[1] + requiredMods[2] + requiredMods[3] + requiredMods[4] + requiredMods[5]
  const usedMods: number[] = []
  // only calculate mods if necessary. If we are already above the limit there's no reason to do the rest
  if (requiredModsTotal > config.maximumStatMods) {
    return null;
  } else if (requiredModsTotal > 0) {
    //console.log({requiredModsTotal, usedMods})
    for (let statId = 0; statId < 6; statId++) {
      if (requiredMods[statId] == 0) continue;
      const statDifference = stats[statId] % 10;
      if (statDifference > 0 && statDifference % 10 >= 5) {
        usedMods.push((1 + (statId * 2)) as StatModifier)
        requiredMods[statId]--;
        stats[statId] += 5
      }
      for (let n = 0; n < requiredMods[statId]; n++) {
        usedMods.push((1 + (statId * 2 + 1)) as StatModifier)
        stats[statId] += 10
      }
    }
  }
  // get maximum possible stat and write them into the runtime
  // Get maximal possible stats and write them in the runtime variable

  const freeMods = 10 * (config.maximumStatMods - usedMods.length)
  for (let n = 0; n < 6; n++) {
    const maximum = stats[n] + freeMods;
    if (maximum > runtime.maximumPossibleTiers[n])
      runtime.maximumPossibleTiers[n] = maximum
  }

  // Get maximal possible stats and write them in the runtime variable
  // Calculate how many 100 stats we can achieve
  let openModSlots = config.maximumStatMods - usedMods.length
  if (openModSlots > 0) {
    var requiredStepsTo100 = [
      Math.max(0, Math.ceil((100 - stats[0]) / 10)),
      Math.max(0, Math.ceil((100 - stats[1]) / 10)),
      Math.max(0, Math.ceil((100 - stats[2]) / 10)),
      Math.max(0, Math.ceil((100 - stats[3]) / 10)),
      Math.max(0, Math.ceil((100 - stats[4]) / 10)),
      Math.max(0, Math.ceil((100 - stats[5]) / 10)),
    ]
    var bestIdx = [0, 1, 2, 3, 4, 5, 6].sort((a, b) => requiredStepsTo100[a] - requiredStepsTo100[b]);

    // if we can't even make 3x100, just stop right here
    const requiredSteps3x100 = requiredStepsTo100[bestIdx[0]] + requiredStepsTo100[bestIdx[1]] + requiredStepsTo100[bestIdx[2]];
    if (requiredSteps3x100 <= openModSlots) {
      // in here we can find 3x100 and 4x100 stats
      runtime.statCombo3x100.add((1 << bestIdx[0]) + (1 << bestIdx[1]) + (1 << bestIdx[2]));
      // if 4x is also in range, add a 4x100 mod
      if ((requiredSteps3x100 + requiredStepsTo100[bestIdx[3]]) <= openModSlots) {
        runtime.statCombo4x100.add((1 << bestIdx[0]) + (1 << bestIdx[1]) + (1 << bestIdx[2]) + (1 << bestIdx[3]));
      }
    }
  }
  if (doNotOutput) return null;

  // Add mods to reduce stat waste
  // TODO: here's still potential to speed up code
  if (config.tryLimitWastedStats && freeMods > 0) {
    let waste = [
      (stats[ArmorStat.Mobility] + ((usedMods.indexOf(StatModifier.MINOR_MOBILITY) > -1) ? 5 : 0)),
      (stats[ArmorStat.Resilience] + ((usedMods.indexOf(StatModifier.MINOR_RESILIENCE) > -1) ? 5 : 0)),
      (stats[ArmorStat.Recovery] + ((usedMods.indexOf(StatModifier.MINOR_RECOVERY) > -1) ? 5 : 0)),
      (stats[ArmorStat.Discipline] + ((usedMods.indexOf(StatModifier.MINOR_DISCIPLINE) > -1) ? 5 : 0)),
      (stats[ArmorStat.Intellect] + ((usedMods.indexOf(StatModifier.MINOR_INTELLECT) > -1) ? 5 : 0)),
      (stats[ArmorStat.Strength] + ((usedMods.indexOf(StatModifier.MINOR_STRENGTH) > -1) ? 5 : 0))
    ].map((v, i) => [v % 10, i, v]).sort((a, b) => b[0] - a[0])

    for (let id = usedMods.length; id < config.maximumStatMods; id++) {
      let result = waste.filter(k => k[2] < 100).filter(a => a[0] > 5).sort((a, b) => a[0] - b[0])[0]
      if (!result) break;
      result[0] -= 5;
      usedMods.push(1 + 2 * result[1])
    }
  }

  return {
    helmetId: helmet.id,
    gauntletId: gauntlet.id,
    chestId: chest.id,
    legsId: leg.id,
    exoticHash: exotic,
    usedMods: usedMods,
    stats: stats
  }
}
