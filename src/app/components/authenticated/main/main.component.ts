import {ChangeDetectorRef, Component, OnInit, Output} from '@angular/core';
import {BungieApiService} from "../../../services/bungie-api.service";
import {AuthService} from "../../../services/auth.service";
import {Subject} from "rxjs";
import {debounceTime} from "rxjs/operators";
import {DestinyArmorPermutationService} from "../../../services/destiny-armor-permutation.service";
import {DatabaseService, IInventoryArmor} from "../../../services/database.service";
import {GearPermutation, Stats} from "../../../data/permutation";
import {animate, state, style, transition, trigger} from "@angular/animations";
import {Router} from "@angular/router";
import {Sort} from "@angular/material/sort";

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
  mods: {
    mobility: number;
    resilience: number;
    recovery: number;
    discipline: number;
    intellect: number;
    strength: number;
    total: number;
  }
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

  constructor(private bungieApi: BungieApiService, private router: Router,
              private auth: AuthService, private permBuilder: DestinyArmorPermutationService,
              private db: DatabaseService) {
  }

  selectedClass: number = 0;

  minMobility: number = 0;
  minResilience: number = 0;
  minRecovery: number = 0;
  minDiscipline: number = 0;
  minIntellect: number = 0;
  minStrength: number = 0;

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
  private sortCriteria: Sort = {active: "", direction: ""};
  allTablePermutations: IMappedGearPermutation[] = [];

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

  async updateTable() {
    console.log("updateTable")
    //this.allTablePermutations = []
    // free memory
    this.allTablePermutations.length = 0;

    let mappedPermutations = this.permutationsFilteredByExotic.map(perm => {
      let stats = perm.getStats(this.filterAssumeMasterworked);
      if (this.enablePowerfulFriends) stats.mobility += 20;
      if (this.enableRadiantLight) stats.strength += 20;
      if (this.enableStasisWhisperOfChains) stats.recovery += 10;
      if (this.enableStasisWhisperOfConduction) stats.resilience += 10;
      if (this.enableStasisWhisperOfConduction) stats.intellect += 10;
      if (this.enableStasisWhisperOfDurance) stats.strength += 10;
      if (this.enableStasisWhisperOfShards) stats.resilience += 10;


      let mods = {
        mobility: Math.ceil(Math.max(0, this.minMobility - stats.mobility) / 10),
        resilience: Math.ceil(Math.max(0, this.minResilience - stats.resilience) / 10),
        recovery: Math.ceil(Math.max(0, this.minRecovery - stats.recovery) / 10),
        discipline: Math.ceil(Math.max(0, this.minDiscipline - stats.discipline) / 10),
        intellect: Math.ceil(Math.max(0, this.minIntellect - stats.intellect) / 10),
        strength: Math.ceil(Math.max(0, this.minStrength - stats.strength) / 10),
        total: 0
      }
      mods.total = mods.mobility + mods.resilience + mods.recovery + mods.discipline + mods.intellect + mods.strength

      let totalStats = {
        mobility: stats.mobility + mods.mobility * 10,
        resilience: stats.resilience + mods.resilience * 10,
        recovery: stats.recovery + mods.recovery * 10,
        discipline: stats.discipline + mods.discipline * 10,
        intellect: stats.intellect + mods.intellect * 10,
        strength: stats.strength + mods.strength * 10
      }

      return {
        permutation: perm,
        stats: stats,
        mods: mods,
        tiers: this.getSkillTierFromPermutation(totalStats),
        totalStatsWithMods: totalStats
      } as IMappedGearPermutation
    }).filter(d => d.mods.total <= this.maxMods)
      .sort((a, b) => a.mods.total - b.mods.total)

    // get maximum possible stats for the current selection
    this.maximumPossibleStats = mappedPermutations.reduce((pre, curr) => {
      // add empty mod slots
      let added = 10 * (this.maxMods - curr.mods.total);

      let mobility = curr.stats.mobility + curr.mods.mobility * 10 + added;
      if (mobility > pre.mobility) pre.mobility = mobility;

      let resilience = curr.stats.resilience + curr.mods.resilience * 10 + added;
      if (resilience > pre.resilience) pre.resilience = resilience;

      let recovery = curr.stats.recovery + curr.mods.recovery * 10 + added;
      if (recovery > pre.recovery) pre.recovery = recovery;

      let discipline = curr.stats.discipline + curr.mods.discipline * 10 + added;
      if (discipline > pre.discipline) pre.discipline = discipline;

      let intellect = curr.stats.intellect + curr.mods.intellect * 10 + added;
      if (intellect > pre.intellect) pre.intellect = intellect;

      let strength = curr.stats.strength + curr.mods.strength * 10 + added;
      if (strength > pre.strength) pre.strength = strength;

      return pre;
    }, {mobility: 0, resilience: 0, recovery: 0, discipline: 0, intellect: 0, strength: 0} as Stats)

    console.log("this.maximumPossibleStats", this.maximumPossibleStats)

    this.allTablePermutations.length = 0;
    this.allTablePermutations = mappedPermutations;
    this.possiblePermutationCount = mappedPermutations.length;
    this.sortData(this.sortCriteria)
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

  sortData(sort: Sort) {
    this.sortCriteria = sort;
    this.expandedElement = null;
    if (!sort.active || sort.direction === '') {
      sort.direction = "desc";
      sort.active = "Tiers";
    }

    this.allTablePermutations = this.allTablePermutations.sort((a, b) => {
      const isAsc = sort.direction === 'asc';
      switch (sort.active) {
        case 'Mobility':
          return compare(a.totalStatsWithMods.mobility, b.totalStatsWithMods.mobility, isAsc);
        case 'Resilience':
          return compare(a.totalStatsWithMods.resilience, b.totalStatsWithMods.resilience, isAsc);
        case 'Recovery':
          return compare(a.totalStatsWithMods.recovery, b.totalStatsWithMods.recovery, isAsc);
        case 'Discipline':
          return compare(a.totalStatsWithMods.discipline, b.totalStatsWithMods.discipline, isAsc);
        case 'Intellect':
          return compare(a.totalStatsWithMods.intellect, b.totalStatsWithMods.intellect, isAsc);
        case 'Strength':
          return compare(a.totalStatsWithMods.strength, b.totalStatsWithMods.strength, isAsc);
        case 'Tiers':
          return compare(a.tiers, b.tiers, isAsc);
        default:
          return 0;
      }
    });
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
}


function compare(a: number | string, b: number | string, isAsc: boolean) {
  return (a < b ? -1 : 1) * (isAsc ? 1 : -1);
}
