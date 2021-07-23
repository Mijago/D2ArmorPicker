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

export interface ISelectedExotic {
  icon: string;
  slot: string;
  name: string;
  hash: number;
  count: number;
}

export interface IMappedGearPermutation {
  permutation: GearPermutation;
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
      state('collapsed', style({height: '0px', minHeight: '0'})),
      state('expanded', style({height: '*'})),
      transition('expanded <=> collapsed', animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)')),
    ]),],
})
export class MainComponent implements OnInit {

  updateTableSubject: Subject<any> = new Subject();
  updatePermutationsSubject: Subject<any> = new Subject();
  updateExoticPermutationsSubject: Subject<any> = new Subject();
  shownColumns = ["exotic", "mobility", "resilience", "recovery", "discipline", "intellect", "strength"]

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

  maximumPossibleStats: Stats = {mobility: 0, resilience: 0, recovery: 0, discipline: 0, intellect: 0, strength: 0};
  expandedElement: IMappedGearPermutation | null = null;
  tablePermutations: IMappedGearPermutation[] = [];


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

    console.log("updateItemList")
    let allArmor = await this.db.inventoryArmor.where('clazz').equals(this.selectedClass).toArray()
    console.log("All Armor", allArmor)

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
    console.log({permutations: this.permutations})

    this.updatingPermutations = false;
    //this.triggerExoticPermutationUpdate()
    await this.updateFilteredExoticPermutations();
  }

  async updateFilteredExoticPermutations() {
    console.log("updateFilteredExoticPermutations")
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

    //await this.triggerTableUpdate();
    await this.updateTable();
  }

  async updateTable() {
    console.log("updateTable")
    let mappedPermutations = this.permutationsFilteredByExotic.map(perm => {
      let stats = Object.assign({}, perm.stats);
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

      return {
        permutation: perm,
        mods: mods
      } as IMappedGearPermutation
    }).filter(d => d.mods.total <= this.maxMods)
      .sort((a, b) => a.mods.total - b.mods.total)

    // get maximum possible stats for the current selection
    this.maximumPossibleStats = mappedPermutations.reduce((pre, curr) => {
      let mobility = 10 * (Math.floor(curr.permutation.stats.mobility / 10) + curr.mods.mobility
        + (this.enablePowerfulFriends ? 2 : 0));
      if (mobility > pre.mobility) pre.mobility = mobility;

      let resilience = 10 * (Math.floor(curr.permutation.stats.resilience / 10) + curr.mods.resilience
        + (this.enableStasisWhisperOfShards ? 1 : 0) + (this.enableStasisWhisperOfConduction ? 1 : 0));
      if (resilience > pre.resilience) pre.resilience = resilience;

      let recovery = 10 * (Math.floor(curr.permutation.stats.recovery / 10) + curr.mods.recovery
        + (this.enableStasisWhisperOfChains ? 1 : 0));
      if (recovery > pre.recovery) pre.recovery = recovery;

      let discipline = 10 * (Math.floor(curr.permutation.stats.discipline / 10) + curr.mods.discipline);
      if (discipline > pre.discipline) pre.discipline = discipline;

      let intellect = 10 * (Math.floor(curr.permutation.stats.intellect / 10) + curr.mods.intellect
        + (this.enableStasisWhisperOfConduction ? 1 : 0));
      if (intellect > pre.intellect) pre.intellect = intellect;


      let strength = 10 * (Math.floor(curr.permutation.stats.strength / 10) + curr.mods.strength
        + (this.enableRadiantLight ? 2 : 0) + (this.enableStasisWhisperOfDurance ? 1 : 0));
      if (strength > pre.strength) pre.strength = strength;

      return pre;
    }, {mobility: 0, resilience: 0, recovery: 0, discipline: 0, intellect: 0, strength: 0} as Stats)


    this.tablePermutations = mappedPermutations.splice(0, 100);
  }


  getExoticForPermutation(permutation: GearPermutation) {
    if (permutation.helmet.isExotic) return permutation.helmet;
    else if (permutation.gauntlet.isExotic) return permutation.gauntlet;
    else if (permutation.chest.isExotic) return permutation.chest;
    else if (permutation.legs.isExotic) return permutation.legs;
    return null;
  }

  getSkillTierFromPermutation(permutation: GearPermutation) {
    return Math.floor(permutation.stats.mobility / 10)
      + Math.floor(permutation.stats.resilience / 10)
      + Math.floor(permutation.stats.recovery / 10)
      + Math.floor(permutation.stats.discipline / 10)
      + Math.floor(permutation.stats.intellect / 10)
      + Math.floor(permutation.stats.strength / 10)
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
    this.tablePermutations = [];
    this.expandedElement = null;

    this.updatingManifest = true;
    let a = await this.bungieApi.updateManifest() // manifest NOT forced
    this.updatingManifest = false;

    this.updatingArmor = true;
    let c = await this.bungieApi.updateArmorItems(b)
    this.updatingArmor = false;
    console.log({updateManifest: a, armor: c})

    await this.updatePermutationsSubject.next();
  }

  async logout() {
    await this.auth.logout();
    await this.router.navigate(["login"])
  }
}
