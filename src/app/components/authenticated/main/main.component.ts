import {Component, OnInit, Output} from '@angular/core';
import {BungieApiService} from "../../../services/bungie-api.service";
import {AuthService} from "../../../services/auth.service";
import {Subject} from "rxjs";
import {debounceTime} from "rxjs/operators";
import {DestinyArmorPermutationService} from "../../../services/destiny-armor-permutation.service";
import {DatabaseService, IInventoryArmor} from "../../../services/database.service";
import {GearPermutation} from "../../../data/permutation";
import {animate, state, style, transition, trigger} from "@angular/animations";

export interface ISelectedExotic {
  icon: string;
  slot: string,
  hash: number
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
  shownColumns = ["exotic", "mobility", "resilience", "recovery", "discipline", "intellect", "strength"]

  constructor(private bungieApi: BungieApiService, private auth: AuthService, private permBuilder: DestinyArmorPermutationService,
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


  expandedElement: IMappedGearPermutation | null = null;
  tablePermutations: IMappedGearPermutation[] = [];

  async ngOnInit(): Promise<void> {
    let a = await this.bungieApi.updateManifest()
    console.log({updateManifest: a})
    let c = await this.bungieApi.updateArmorItems()
    console.log({c})

    this.updateTableSubject
      .pipe(debounceTime(500))
      .subscribe(() => {
          this.updateTable()
        }
      );

    this.updateTableSubject.next()
  }

  async updateTable() {
    console.log("Update Table")
    let allArmor = await this.db.inventoryArmor.where('clazz').equals(this.selectedClass).toArray()
    console.log("All Armor", allArmor)

    let allExotics = allArmor.filter(d => d.isExotic).map(d => {
      return {
        slot: d.slot,
        icon: d.icon,
        hash: d.hash
      } as ISelectedExotic
    })
    let lookupArray: number[] = []
    allExotics = allExotics.filter(d => {
      if (lookupArray.indexOf(d.hash) > -1)
        return false;
      lookupArray.push(d.hash);
      return true;
    })

    this.lockedExoticHelmet = allExotics.filter(d => d.slot == "Helmets");
    this.lockedExoticGauntlet = allExotics.filter(d => d.slot == "Arms");
    this.lockedExoticChest = allExotics.filter(d => d.slot == "Chest");
    this.lockedExoticLegs = allExotics.filter(d => d.slot == "Legs");


    let permutations = this.permBuilder.buildPermutations(allArmor, this.lockedExotic)
    console.log({perms: permutations})

    let mappedPermutations = permutations.map(perm => {
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
      .sort((a,b) => a.mods.total-b.mods.total)
      .splice( 0, 100)

    this.tablePermutations = mappedPermutations;
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


  triggerTableUpdate() {
    this.updateTableSubject.next();
  }

  onClassChange() {
    this.triggerTableUpdate()
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

    this.triggerTableUpdate();
  }
}
