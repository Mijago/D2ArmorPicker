import {Component, OnInit, ViewChild} from '@angular/core';
import {BungieApiService} from "../../../services/bungie-api.service";
import {AuthService} from "../../../services/auth.service";
import {Subject} from "rxjs";
import {debounceTime} from "rxjs/operators";
import {DestinyArmorPermutationService} from "../../../services/destiny-armor-permutation.service";
import {DatabaseService} from "../../../services/database.service";
import {GearPermutation, Stats} from "../../../data/permutation";
import {animate, state, style, transition, trigger} from "@angular/animations";
import {Router} from "@angular/router";
import {MatSort} from "@angular/material/sort";
import {MatTableDataSource} from "@angular/material/table";
import {MatPaginator} from "@angular/material/paginator";
import {DestinyClass} from "bungie-api-ts/destiny2/interfaces";

export type MaxStatData = [boolean, boolean, boolean, boolean, boolean, boolean, number]

export interface ISelectedExotic {
  icon: string;
  slot: string;
  name: string;
  hash: number;
  count: number;
}

export interface IMappedGearPermutation {
  permutation: GearPermutation;
  stats: Stats,
  totalStatsWithMods: Stats,
  tiers: number,
  // Use an array instead of a dict, because otherwise too much memory is used
  mods: number[]
}

export enum MOD_INDICES {
  MOBILITY_MINOR,
  MOBILITY_MAJOR,
  RESILIENCE_MINOR,
  RESILIENCE_MAJOR,
  RECOVERY_MINOR,
  RECOVERY_MAJOR,
  DISCIPLINE_MINOR,
  DISCIPLINE_MAJOR,
  INTELLECT_MINOR,
  INTELLECT_MAJOR,
  STRENGTH_MINOR,
  STRENGTH_MAJOR,
  MOD_COUNT,
  MOD_COST
}

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.css'],
  animations: [
    trigger('detailExpand', [
      state('collapsed, void', style({height: '0px'})),
      state('expanded', style({height: '*'})),
      transition('expanded <=> collapsed', animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)')),
      transition('expanded <=> void', animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)'))
    ]),],
})
export class MainComponent implements OnInit {

  updateTableSubject: Subject<any> = new Subject();
  updatePermutationsSubject: Subject<any> = new Subject();
  updateExoticPermutationsSubject: Subject<any> = new Subject();
  shownColumns = ["exotic", "mobility", "resilience", "recovery", "discipline", "intellect", "strength", "tiers", "mods", "dropdown",]
  characters: { characterId: any; clazz: DestinyClass; lastPlayed: number }[] = [];
  maximumPossibleAmountPerTier: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  maximumPossibleAmountSets: MaxStatData[] = [];

  constructor(private bungieApi: BungieApiService, private router: Router,
              private auth: AuthService, private permBuilder: DestinyArmorPermutationService,
              private db: DatabaseService) {
  }

  selectedClass: number = -1;

  minMobility: number = 10;
  minResilience: number = 10;
  minRecovery: number = 10;
  minDiscipline: number = 10;
  minIntellect: number = 10;
  minStrength: number = 10;

  maxMods: number = 5;
  filterAssumeMasterworked: boolean = true;
  filterOnlyUseMasterworkedItems: boolean = false;

  enablePowerfulFriends: boolean = true;
  enableRadiantLight: boolean = true;
  enableStasisWhisperOfDurance: boolean = false;
  enableStasisWhisperOfChains: boolean = false;
  enableStasisWhisperOfConduction: boolean = false;
  enableStasisWhisperOfShards: boolean = false;


  lockedExotic: number = 0;
  lockedExoticHelmet: ISelectedExotic[] = [];
  lockedExoticGauntlet: ISelectedExotic[] = [];
  lockedExoticChest: ISelectedExotic[] = [];
  lockedExoticLegs: ISelectedExotic[] = [];

  private permutations: GearPermutation[] = [];
  private permutationsFilteredByExotic: GearPermutation[] = [];
  tableDataSource = new MatTableDataSource<IMappedGearPermutation>();

  @ViewChild(MatPaginator)
  paginator: MatPaginator | null = null;
  @ViewChild(MatSort)
  sort: MatSort | null = null;

  possiblePermutationCount: number = 0;
  maximumPossibleStats: Stats = {mobility: 0, resilience: 0, recovery: 0, discipline: 0, intellect: 0, strength: 0};
  expandedElement: IMappedGearPermutation | null = null;


  updatingManifest = false;
  updatingArmor = false;
  updatingPermutations = false;
  updatingTable = false;

  async ngOnInit(): Promise<void> {

    this.updateTableSubject
      .pipe(debounceTime(350))
      .subscribe(async () => {
        this.updatingTable = true;
        await this.updateTable()
        this.updatingTable = false;
      });
    this.updatePermutationsSubject
      .pipe(debounceTime(350))
      .subscribe(async () => {
        this.updatingPermutations = true;
        await this.updateItemList();
        this.updatingPermutations = false;
      });
    this.updateExoticPermutationsSubject
      .pipe(debounceTime(350))
      .subscribe(async () => {
        await this.updateFilteredExoticPermutations();
        this.updatingPermutations = false;
      });

    await this.refreshAll(false);
  }

  async updateItemList() {
    this.updatingPermutations = true;

    // free memory
    this.permutations.length = 0;
    this.lockedExoticHelmet.length = 0;
    this.lockedExoticGauntlet.length = 0;
    this.lockedExoticChest.length = 0;
    this.lockedExoticLegs.length = 0;

    console.info("updateItemList")
    let allArmor = await this.db.inventoryArmor.where('clazz').equals(this.selectedClass).toArray()

    let allExotics = allArmor.filter(d => d.isExotic).map(d => {
      return {
        slot: d.slot,
        icon: d.icon,
        hash: d.hash,
        name: d.name,
        count: 1
      } as ISelectedExotic
    })
    let lookup: any = {}
    allExotics = allExotics.filter((d, i) => {
      if (lookup[d.hash]) {
        lookup[d.hash]++;
        return false;
      }
      lookup[d.hash] = 1;
      return true;
    })
    allExotics.forEach((d) => {
      d.count = lookup[d.hash]
    })


    this.lockedExoticHelmet = allExotics.filter(d => d.slot == "Helmets");
    this.lockedExoticGauntlet = allExotics.filter(d => d.slot == "Arms");
    this.lockedExoticChest = allExotics.filter(d => d.slot == "Chest");
    this.lockedExoticLegs = allExotics.filter(d => d.slot == "Legs");

    this.permutations = this.permBuilder.buildPermutations(allArmor)

    this.updatingPermutations = false;
    //this.triggerExoticPermutationUpdate()
    await this.updateFilteredExoticPermutations();
  }

  async updateFilteredExoticPermutations() {
    console.log("updateFilteredExoticPermutations")
    this.permutationsFilteredByExotic = [];
    if (this.lockedExotic == 0) {
      this.permutationsFilteredByExotic = this.permutations;
    } else if (this.lockedExotic == -1) {
      this.permutationsFilteredByExotic = this.permutations.filter(d => !d.hasExotic);
    } else {
      this.permutationsFilteredByExotic = this.permutations.filter(d => {
        if (!d.hasExotic)
          return false;
        return (d.helmet.hash == this.lockedExotic || d.gauntlet.hash == this.lockedExotic
          || d.chest.hash == this.lockedExotic || d.legs.hash == this.lockedExotic)
      });
    }
    // update masterwork
    if (this.filterOnlyUseMasterworkedItems) {
      this.permutationsFilteredByExotic = this.permutationsFilteredByExotic.filter(p => p.allMasterworked);
    }
    //await this.triggerTableUpdate();
    await this.updateTable();
  }

  getModBonusFromSet(minor: number, major: number) {
    return 5 * minor + 10 * major
  }

  getTotalModsFromSet(minor: number, major: number) {
    return minor + major
  }

  async updateTable() {
    console.log("updateTable")
    // Clear memory
    this.maximumPossibleAmountSets.length = 0;
    this.maximumPossibleAmountSets = []
    this.maximumPossibleAmountPerTier = [0, 0, 0, 0, 0]
    this.tableDataSource.data.length = 0;
    this.tableDataSource.data = [];


    this.tableDataSource.paginator = this.paginator;
    this.tableDataSource.sort = this.sort;
    this.tableDataSource.sortingDataAccessor = (data, sortHeaderId) => {
      switch (sortHeaderId) {
        case 'Mobility':
          return data.totalStatsWithMods.mobility
        case 'Resilience':
          return data.totalStatsWithMods.resilience
        case 'Recovery':
          return data.totalStatsWithMods.recovery
        case 'Discipline':
          return data.totalStatsWithMods.discipline
        case 'Intellect':
          return data.totalStatsWithMods.intellect
        case 'Strength':
          return data.totalStatsWithMods.strength
        case 'Tiers':
          return data.tiers
        case 'Mods':
          return 100 * data.mods[MOD_INDICES.MOD_COUNT] + data.mods[MOD_INDICES.MOD_COST]
      }
      return 0;
    }


    let getMaximumPossibleAmount = (stats: Stats, mods: number[]) => {
      let todos = [
        Math.ceil(Math.max(0, (100 - stats.mobility)) / 10),
        Math.ceil(Math.max(0, (100 - stats.resilience)) / 10),
        Math.ceil(Math.max(0, (100 - stats.recovery)) / 10),
        Math.ceil(Math.max(0, (100 - stats.discipline)) / 10),
        Math.ceil(Math.max(0, (100 - stats.intellect)) / 10),
        Math.ceil(Math.max(0, (100 - stats.strength)) / 10)
      ]
      let current100s = todos.filter(d => d == 0).length
      let freeModSlots = this.maxMods - mods[MOD_INDICES.MOD_COUNT]

      if (freeModSlots > 0) {
        let idx = todos
          .map((d, i) => [d, i])
          .filter(d => d[0] > 0)
          .sort((a, b) => a[0] - b[0])

        for (let stat of idx) {
          if (stat[0] - freeModSlots > 0)
            break;
          freeModSlots -= stat[0]
          todos[stat[1]] = 0
          current100s++;
          if (freeModSlots < 0)
            throw new Error("freeModSlots < 0??")
          if (freeModSlots == 0)
            break;
        }
      }
      const result = todos.map(d => d == 0 ? 1 : 0);
      return (current100s << 6)
        + (result[0] << 5) + (result[1] << 4) + (result[2] << 3)
        + (result[3] << 2) + (result[4] << 1) + (result[5] << 0);
    }

    this.tableDataSource.data = this.permutationsFilteredByExotic.map(perm => {
      let stats = perm.getStats(this.filterAssumeMasterworked);
      if (this.enablePowerfulFriends) stats.mobility += 20;
      if (this.enableRadiantLight) stats.strength += 20;
      if (this.enableStasisWhisperOfChains) stats.recovery += 10;
      if (this.enableStasisWhisperOfConduction) stats.resilience += 10;
      if (this.enableStasisWhisperOfConduction) stats.intellect += 10;
      if (this.enableStasisWhisperOfDurance) stats.strength += 10;
      if (this.enableStasisWhisperOfShards) stats.resilience += 10;

      const mobilityDifference = Math.max(0, this.minMobility - stats.mobility);
      let modMobility05 = (mobilityDifference % 10 > 0 && mobilityDifference % 10 <= 5) ? 1 : 0
      let modMobility10 = Math.ceil(Math.max(0, mobilityDifference - modMobility05 * 5) / 10)

      const resilienceDifference = Math.max(0, this.minResilience - stats.resilience);
      let modResilience05 = (resilienceDifference % 10 > 0 && resilienceDifference % 10 <= 5) ? 1 : 0
      let modResilience10 = Math.ceil(Math.max(0, resilienceDifference - modResilience05 * 5) / 10)

      const recoveryDifference = Math.max(0, this.minRecovery - stats.recovery);
      let modRecovery05 = (recoveryDifference % 10 > 0 && recoveryDifference % 10 <= 5) ? 1 : 0
      let modRecovery10 = Math.ceil(Math.max(0, recoveryDifference - modRecovery05 * 5) / 10)

      const disciplineDifference = Math.max(0, this.minDiscipline - stats.discipline);
      let modDiscipline05 = (disciplineDifference % 10 > 0 && disciplineDifference % 10 <= 5) ? 1 : 0
      let modDiscipline10 = Math.ceil(Math.max(0, disciplineDifference - modDiscipline05 * 5) / 10)

      const intellectDifference = Math.max(0, this.minIntellect - stats.intellect);
      let modIntellect05 = (intellectDifference % 10 > 0 && intellectDifference % 10 <= 5) ? 1 : 0
      let modIntellect10 = Math.ceil(Math.max(0, intellectDifference - modIntellect05 * 5) / 10)


      const strengthDifference = Math.max(0, this.minStrength - stats.strength);
      let modStrength05 = (strengthDifference % 10 > 0 && strengthDifference % 10 <= 5) ? 1 : 0
      let modStrength10 = Math.ceil(Math.max(0, strengthDifference - modStrength05 * 5) / 10)

      let mods = [
        modMobility05, modMobility10,
        modResilience05, modResilience10,
        modRecovery05, modRecovery10,
        modDiscipline05, modDiscipline10,
        modIntellect05, modIntellect10,
        modStrength05, modStrength10,
        // TOTAL
        modMobility05 + modMobility10 + modResilience05 + modResilience10 + modRecovery05 + modRecovery10
        + modDiscipline05 + modDiscipline10 + modIntellect05 + modIntellect10 + modStrength05 + modStrength10,
        // COST
        modMobility05 + 3 * modMobility10 + modResilience05 + 3 * modResilience10 + 2 * modRecovery05 + 4 * modRecovery10
        + modDiscipline05 + 3 * modDiscipline10 + 2 * modIntellect05 + 5 * modIntellect10 + modStrength05 + 3 * modStrength10,
      ]


      let totalStats = {
        mobility: stats.mobility + this.getModBonusFromSet(mods[MOD_INDICES.MOBILITY_MINOR], mods[MOD_INDICES.MOBILITY_MAJOR]),
        resilience: stats.resilience + this.getModBonusFromSet(mods[MOD_INDICES.RESILIENCE_MINOR], mods[MOD_INDICES.RESILIENCE_MAJOR]),
        recovery: stats.recovery + this.getModBonusFromSet(mods[MOD_INDICES.RECOVERY_MINOR], mods[MOD_INDICES.RECOVERY_MAJOR]),
        discipline: stats.discipline + this.getModBonusFromSet(mods[MOD_INDICES.DISCIPLINE_MINOR], mods[MOD_INDICES.DISCIPLINE_MAJOR]),
        intellect: stats.intellect + this.getModBonusFromSet(mods[MOD_INDICES.INTELLECT_MINOR], mods[MOD_INDICES.INTELLECT_MAJOR]),
        strength: stats.strength + this.getModBonusFromSet(mods[MOD_INDICES.STRENGTH_MINOR], mods[MOD_INDICES.STRENGTH_MAJOR])
      }

      return {
        permutation: perm,
        stats: stats,
        mods: mods,
        tiers: this.getSkillTierFromPermutation(totalStats),
        totalStatsWithMods: totalStats
      } as IMappedGearPermutation
    }).filter(d => d.mods[MOD_INDICES.MOD_COUNT] <= this.maxMods)

    function calcScore(d: MaxStatData) {
      return (d[0] ? 1e6 : 0) + (d[1] ? 1e5 : 0) + (d[2] ? 1e4 : 0) + (d[3] ? 1e3 : 0) + (d[4] ? 1e2 : 0) + (d[5] ? 1e1 : 0)
    }

    this.maximumPossibleAmountSets = Array.from(new Set(this.tableDataSource.data.map(d => getMaximumPossibleAmount(d.totalStatsWithMods, d.mods))))
      .map((d: number) => [
        !!(d & 1 << 5), !!(d & 1 << 4), !!(d & 1 << 3),
        !!(d & 1 << 2), !!(d & 1 << 1), !!(d & 1 << 0),
        d >> 6
      ] as MaxStatData)
      .sort((a, b) => calcScore(b) - calcScore(a))
    this.maximumPossibleAmountPerTier = this.maximumPossibleAmountSets.reduce((p, c) => {
      p[c[6]]++;
      return p;
    }, [0, 0, 0, 0, 0])

    // get maximum possible stats for the current selection
    this.maximumPossibleStats = this.tableDataSource.data.reduce((pre, curr) => {
      // add empty mod slots
      let added = 10 * (this.maxMods - curr.mods[MOD_INDICES.MOD_COUNT]);

      let mobility = curr.stats.mobility + this.getModBonusFromSet(curr.mods[MOD_INDICES.MOBILITY_MINOR], curr.mods[MOD_INDICES.MOBILITY_MAJOR]) + added;
      if (mobility > pre.mobility) pre.mobility = mobility;

      let resilience = curr.stats.resilience + this.getModBonusFromSet(curr.mods[MOD_INDICES.RESILIENCE_MINOR], curr.mods[MOD_INDICES.RESILIENCE_MAJOR]) + added;
      if (resilience > pre.resilience) pre.resilience = resilience;

      let recovery = curr.stats.recovery + this.getModBonusFromSet(curr.mods[MOD_INDICES.RECOVERY_MINOR], curr.mods[MOD_INDICES.RECOVERY_MAJOR]) + added;
      if (recovery > pre.recovery) pre.recovery = recovery;

      let discipline = curr.stats.discipline + this.getModBonusFromSet(curr.mods[MOD_INDICES.DISCIPLINE_MINOR], curr.mods[MOD_INDICES.DISCIPLINE_MAJOR]) + added;
      if (discipline > pre.discipline) pre.discipline = discipline;

      let intellect = curr.stats.intellect + this.getModBonusFromSet(curr.mods[MOD_INDICES.INTELLECT_MINOR], curr.mods[MOD_INDICES.INTELLECT_MAJOR]) + added;
      if (intellect > pre.intellect) pre.intellect = intellect;

      let strength = curr.stats.strength + this.getModBonusFromSet(curr.mods[MOD_INDICES.STRENGTH_MINOR], curr.mods[MOD_INDICES.STRENGTH_MAJOR]) + added;
      if (strength > pre.strength) pre.strength = strength;

      return pre;
    }, {mobility: 0, resilience: 0, recovery: 0, discipline: 0, intellect: 0, strength: 0} as Stats)

    console.log("this.maximumPossibleStats", this.maximumPossibleStats)

    this.possiblePermutationCount = this.tableDataSource.data.length;
  }

  getExoticForPermutation(permutation: GearPermutation) {
    if (permutation.helmet.isExotic) return permutation.helmet;
    else if (permutation.gauntlet.isExotic) return permutation.gauntlet;
    else if (permutation.chest.isExotic) return permutation.chest;
    else if (permutation.legs.isExotic) return permutation.legs;
    return null;
  }

  getSkillTierFromPermutation(stats: Stats) {
    return Math.floor(Math.min(100, stats.mobility) / 10)
      + Math.floor(Math.min(100, stats.resilience) / 10)
      + Math.floor(Math.min(100, stats.recovery) / 10)
      + Math.floor(Math.min(100, stats.discipline) / 10)
      + Math.floor(Math.min(100, stats.intellect) / 10)
      + Math.floor(Math.min(100, stats.strength) / 10)
  }


  triggerExoticPermutationUpdate() {
    this.updatingPermutations = true;
    this.updateExoticPermutationsSubject.next();
  }

  triggerTableUpdate() {
    this.updatingTable = true;
    this.updateTableSubject.next();
  }

  triggerPermutationsUpdate() {
    this.updatingPermutations = true;
    this.updatePermutationsSubject.next()
  }

  async onClassChange() {
    this.lockedExotic = 0;
    this.triggerPermutationsUpdate()
  }

  onMinStatValueChange() {
    this.triggerTableUpdate()
  }

  onAllowedModChange() {
    this.triggerTableUpdate()
  }


  changeLockedExotic(hash: number) {
    if (this.lockedExotic == hash)
      this.lockedExotic = 0;
    else
      this.lockedExotic = hash;

    this.triggerExoticPermutationUpdate()
  }

  async refreshAll(b: boolean) {
    this.lockedExotic = 0;
    this.permutations = [];
    this.expandedElement = null;

    // log out if refresh token is expired
    if (this.auth.refreshTokenExpired) {
      await this.auth.logout();
      return;
    }

    if (!await this.auth.autoRegenerateTokens()) {
      await this.auth.logout();
      return;
    }

    this.characters = await this.bungieApi.getCharacters();
    if (this.selectedClass == -1 && this.characters.length > 0)
      this.selectedClass = this.characters.sort((a, b) => b.lastPlayed - a.lastPlayed)[0].clazz;


    this.updatingManifest = true;
    await this.bungieApi.updateManifest() // manifest NOT forced
    this.updatingManifest = false;

    this.updatingArmor = true;
    await this.bungieApi.updateArmorItems(b)
    this.updatingArmor = false;

    await this.updatePermutationsSubject.next();
  }

  async logout() {
    await this.auth.logout();
    await this.router.navigate(["login"])
  }

  toJson(d: any) {
    return JSON.stringify(d, null, 2)
  }

  tooltipMobilitySelector: string[] = [
    "Dodge Cooldown: 0:32s\r\nMovementspeed Increase: 4%\r\nSpeed:\r\n   Crouching:\t2.86m/s\r\n   Strafing:\t4.42m/s\r\n   Walking:\t5.20m/s",
    "Dodge Cooldown: 0:30s\r\nMovementspeed Increase: 8%\r\nSpeed:\r\n   Crouching:\t2.97m/s\r\n   Strafing:\t4.59m/s\r\n   Walking:\t5.40m/s",
    "Dodge Cooldown: 0:29s\r\nMovementspeed Increase: 12%\r\nSpeed:\r\n   Crouching:\t3.08m/s\r\n   Strafing:\t4.76m/s\r\n   Walking:\t5.60m/s",
    "Dodge Cooldown: 0:26s\r\nMovementspeed Increase: 16%\r\nSpeed:\r\n   Crouching:\t3.19m/s\r\n   Strafing:\t4.93m/s\r\n   Walking:\t5.80m/s",
    "Dodge Cooldown: 0:24s\r\nMovementspeed Increase: 20%\r\nSpeed:\r\n   Crouching:\t3.30m/s\r\n   Strafing:\t5.10m/s\r\n   Walking:\t6.0m/s",
    "Dodge Cooldown: 0:22s\r\nMovementspeed Increase: 24%\r\nSpeed:\r\n   Crouching:\t3.41m/s\r\n   Strafing:\t5.27m/s\r\n   Walking:\t6.20m/s",
    "Dodge Cooldown: 0:19s\r\nMovementspeed Increase: 28%\r\nSpeed:\r\n   Crouching:\t3.52m/s\r\n   Strafing:\t5.44m/s\r\n   Walking:\t6.40m/s",
    "Dodge Cooldown: 0:16s\r\nMovementspeed Increase: 32%\r\nSpeed:\r\n   Crouching:\t3.63m/s\r\n   Strafing:\t5.61m/s\r\n   Walking:\t6.60m/s",
    "Dodge Cooldown: 0:14s\r\nMovementspeed Increase: 36%\r\nSpeed:\r\n   Crouching:\t3.74m/s\r\n   Strafing:\t5.78m/s\r\n   Walking:\t6.80m/s",
    "Dodge Cooldown: 0:11s\r\nMovementspeed Increase: 40%\r\nSpeed:\r\n   Crouching:\t3.85m/s\r\n   Strafing:\t5.95m/s\r\n   Walking:\t7.00m/s",
  ]

  tooltipResilienceSelector: string[] = [
    "Barricade Cooldown: 0:46s\r\nHitpoints: 186hp",
    "Barricade Cooldown: 0:41s\r\nHitpoints: 187hp",
    "Barricade Cooldown: 0:37s\r\nHitpoints: 188hp",
    "Barricade Cooldown: 0:33s\r\nHitpoints: 189hp",
    "Barricade Cooldown: 0:30s\r\nHitpoints: 190hp",
    "Barricade Cooldown: 0:28s\r\nHitpoints: 192hp",
    "Barricade Cooldown: 0:25s\r\nHitpoints: 194hp",
    "Barricade Cooldown: 0:21s\r\nHitpoints: 196hp",
    "Barricade Cooldown: 0:17s\r\nHitpoints: 198hp",
    "Barricade Cooldown: 0:14s\r\nHitpoints: 200hp",
  ]

  tooltipRecoverySelector: string[] = [
    "Rift cooldown: 1:43s\r\nRecovery Rate Increase: 2.9%\r\nTotal regeneration time: 8.80s",
    "Rift cooldown: 1:31s\r\nRecovery Rate Increase: 5.7%\r\nTotal regeneration time: 8.60s",
    "Rift cooldown: 1:22s\r\nRecovery Rate Increase: 8.6%\r\nTotal regeneration time: 8.40s",
    "Rift cooldown: 1:15s\r\nRecovery Rate Increase: 11.4%\r\nTotal regeneration time: 8.20s",
    "Rift cooldown: 1:08s\r\nRecovery Rate Increase: 14.3%\r\nTotal regeneration time: 8.00s",
    "Rift cooldown: 1:03s\r\nRecovery Rate Increase: 17.1%\r\nTotal regeneration time: 7.80s",
    "Rift cooldown: 0:59s\r\nRecovery Rate Increase: 22.9%\r\nTotal regeneration time: 7.40s",
    "Rift cooldown: 0:51s\r\nRecovery Rate Increase: 28.6%\r\nTotal regeneration time: 7.00s",
    "Rift cooldown: 0:46s\r\nRecovery Rate Increase: 34.3%\r\nTotal regeneration time: 6.60s",
    "Rift cooldown: 0:41s\r\nRecovery Rate Increase: 42.9%\r\nTotal regeneration time: 6.00s",
  ];

  tooltipDisciplineSelector: string[] = [
    "Grenade Cooldown in M:SS\r\n Light:\t1:33\r\n Stasis:\t2:14",
    "Grenade Cooldown in M:SS\r\n Light:\t1:25\r\n Stasis:\t2:05",
    "Grenade Cooldown in M:SS\r\n Light:\t1:22\r\n Stasis:\t1:57",
    "Grenade Cooldown in M:SS\r\n Light:\t1:08\r\n Stasis:\t1:50",
    "Grenade Cooldown in M:SS\r\n Light:\t0:59\r\n Stasis:\t1:33",
    "Grenade Cooldown in M:SS\r\n Light:\t0:51\r\n Stasis:\t1:20",
    "Grenade Cooldown in M:SS\r\n Light:\t0:45\r\n Stasis:\t1:11",
    "Grenade Cooldown in M:SS\r\n Light:\t0:41\r\n Stasis:\t1:04",
    "Grenade Cooldown in M:SS\r\n Light:\t0:37\r\n Stasis:\t0:58",
    "Grenade Cooldown in M:SS\r\n Light:\t0:32\r\n Stasis:\t0:53",
  ]

  tooltipIntellectSelector: string[] = [
    "Super Ability cooldowns in M:SS\r\n Light:\t6:22\r\n Stasis:\t6:23",
    "Super Ability cooldowns in M:SS\r\n Light:\t5:43\r\n Stasis:\t5:51",
    "Super Ability cooldowns in M:SS\r\n Light:\t5:00\r\n Stasis:\t5:23",
    "Super Ability cooldowns in M:SS\r\n Light:\t4:45\r\n Stasis:\t5:00",
    "Super Ability cooldowns in M:SS\r\n Light:\t4:31\r\n Stasis:\t4:47",
    "Super Ability cooldowns in M:SS\r\n Light:\t4:18\r\n Stasis:\t4:35",
    "Super Ability cooldowns in M:SS\r\n Light:\t4:07\r\n Stasis:\t4:24",
    "Super Ability cooldowns in M:SS\r\n Light:\t4:00\r\n Stasis:\t4:14",
    "Super Ability cooldowns in M:SS\r\n Light:\t3:52\r\n Stasis:\t4:05",
    "Super Ability cooldowns in M:SS\r\n Light:\t3:47\r\n Stasis:\t3:56",
  ]
  tooltipStrengthSelector: string[] = [
    "Melee Cooldown (Normal / Stasis) in M:SS\r\n Titan:\t\t1:33 / 1:30\r\n Hunter:\t\t1:49 / 1:49\r\n Warlock:\t1:33 / 1:49",
    "Melee Cooldown (Normal / Stasis) in M:SS\r\n Titan:\t\t1:25 / 1:24\r\n Hunter:\t\t1:40 / 1:42\r\n Warlock:\t1:25 / 1:42",
    "Melee Cooldown (Normal / Stasis) in M:SS\r\n Titan:\t\t1:22 / 1:19\r\n Hunter:\t\t1:36 / 1:35\r\n Warlock:\t1:22 / 1:35",
    "Melee Cooldown (Normal / Stasis) in M:SS\r\n Titan:\t\t1:08 / 1:14\r\n Hunter:\t\t1:20 / 1:29\r\n Warlock:\t1:08 / 1:29",
    "Melee Cooldown (Normal / Stasis) in M:SS\r\n Titan:\t\t0:59 / 0:59\r\n Hunter:\t\t1:09 / 1:16\r\n Warlock:\t0:59 / 1:16",
    "Melee Cooldown (Normal / Stasis) in M:SS\r\n Titan:\t\t0:51 / 0:51\r\n Hunter:\t\t1:00 / 1:06\r\n Warlock:\t0:51 / 1:06",
    "Melee Cooldown (Normal / Stasis) in M:SS\r\n Titan:\t\t0:45 / 0:46\r\n Hunter:\t\t0:53 / 0:58\r\n Warlock:\t0:45 / 0:58",
    "Melee Cooldown (Normal / Stasis) in M:SS\r\n Titan:\t\t0:41 / 0:41\r\n Hunter:\t\t0:48 / 0:52\r\n Warlock:\t0:41 / 0:52",
    "Melee Cooldown (Normal / Stasis) in M:SS\r\n Titan:\t\t0:37 / 0:37\r\n Hunter:\t\t0:44 / 0:47\r\n Warlock:\t0:37 / 0:47",
    "Melee Cooldown (Normal / Stasis) in M:SS\r\n Titan:\t\t0:32 / 0:32\r\n Hunter:\t\t0:37 / 0:43\r\n Warlock:\t0:32 / 0:43",
  ]

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

  clearStatSelection() {
    this.minMobility = 10;
    this.minResilience = 10;
    this.minRecovery = 10;
    this.minDiscipline = 10;
    this.minIntellect = 10;
    this.minStrength = 10;
    this.onMinStatValueChange();
  }

  useStatPreset(d: MaxStatData) {
    if (d[0]) this.minMobility = 100;
    if (d[1]) this.minResilience = 100;
    if (d[2]) this.minRecovery = 100;
    if (d[3]) this.minDiscipline = 100;
    if (d[4]) this.minIntellect = 100;
    if (d[5]) this.minStrength = 100;
    this.onMinStatValueChange();
  }
}


function compare(a: number | string, b: number | string, isAsc: boolean) {
  return (a < b ? -1 : 1) * (isAsc ? 1 : -1);
}
