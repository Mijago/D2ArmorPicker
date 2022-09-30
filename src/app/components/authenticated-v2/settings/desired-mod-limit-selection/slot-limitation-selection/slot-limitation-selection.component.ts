import {Component, EventEmitter, Input, OnDestroy, OnInit, Output} from '@angular/core';
import {MAXIMUM_STAT_MOD_AMOUNT} from "../../../../../data/constants";
import {ArmorSlot} from "../../../../../data/enum/armor-slot";
import {ConfigurationService} from "../../../../../services/configuration.service";
import {
  ArmorAffinityIcons,
  ArmorAffinityNames,
  ArmorPerkOrSlot,
  ArmorPerkOrSlotNames
} from "../../../../../data/enum/armor-stat";
import {DestinyClass, DestinyEnergyType} from "bungie-api-ts/destiny2";
import {InventoryService} from "../../../../../services/inventory.service";
import {DatabaseService} from "../../../../../services/database.service";
import {Subject} from "rxjs";
import {takeUntil} from "rxjs/operators";

@Component({
  selector: 'app-slot-limitation-selection',
  templateUrl: './slot-limitation-selection.component.html',
  styleUrls: ['./slot-limitation-selection.component.scss']
})
export class SlotLimitationSelectionComponent implements OnInit, OnDestroy {
  readonly ArmorSlot = ArmorSlot;
  readonly ArmorPerkOrSlotNames = ArmorPerkOrSlotNames;
  readonly ArmorPerkOrSlot = ArmorPerkOrSlot;
  readonly ModRange = new Array(MAXIMUM_STAT_MOD_AMOUNT + 1);
  selection: number = MAXIMUM_STAT_MOD_AMOUNT;

  @Input()
  slot: ArmorSlot = ArmorSlot.ArmorSlotHelmet;
  @Output()
  possible: EventEmitter<boolean> = new EventEmitter<boolean>();

  isPossible: boolean = true;
  configSelectedClass: DestinyClass = DestinyClass.Titan;
  element: DestinyEnergyType = DestinyEnergyType.Any;
  elementLock: boolean = false;
  armorPerk: ArmorPerkOrSlot = ArmorPerkOrSlot.None;
  armorPerkLock: boolean = false;
  maximumModSlots: number = 5;

  hoveredSlot: number = -1;

  disabled: boolean = false;
  private configIgnoreArmorAffinitiesOnMasterworkedItems: boolean = false;
  private configIgnoreArmorAffinitiesOnNonMasterworkedItems: boolean = false;

  constructor(public config: ConfigurationService, public inventory: InventoryService, private db: DatabaseService) {
  }

  public async runPossibilityCheck() {
    const mustCheckArmorPerk = this.armorPerkLock && this.armorPerk != ArmorPerkOrSlot.None;
    const mustCheckArmorElement = this.elementLock && this.element != DestinyEnergyType.Any;
    if (mustCheckArmorPerk && !mustCheckArmorElement) {
      var applicablePerk = await this.db.inventoryArmor
        .where("clazz").equals(this.configSelectedClass)
        .and(f => f.slot == this.slot)
        .and(f => f.perk == this.armorPerk)
        .count()
      this.isPossible = (applicablePerk > 0);
    } else if (mustCheckArmorElement && !mustCheckArmorPerk) {

      var applicableElement = await this.db.inventoryArmor
        .where("clazz").equals(this.configSelectedClass)
        .and(f => f.slot == this.slot)
        .and(f => (this.configIgnoreArmorAffinitiesOnMasterworkedItems && f.masterworked)
          || (this.configIgnoreArmorAffinitiesOnNonMasterworkedItems && !f.masterworked)
          || f.energyAffinity == this.element)
        .count()
      this.isPossible = (applicableElement > 0);
    } else if (mustCheckArmorElement && mustCheckArmorPerk) {
      var applicable = await this.db.inventoryArmor
        .where("clazz").equals(this.configSelectedClass)
        .and(f => f.slot == this.slot)
        .and(f => (this.configIgnoreArmorAffinitiesOnMasterworkedItems && f.masterworked)
          || (this.configIgnoreArmorAffinitiesOnNonMasterworkedItems && !f.masterworked)
          || f.energyAffinity == this.element)
        .and(f => f.perk == this.armorPerk)
        .count()
      this.isPossible = (applicable > 0);
    } else {
      this.isPossible = true;
    }
    this.possible.next(this.isPossible);
  }

  get slotName(): string {
    switch (this.slot) {
      case ArmorSlot.ArmorSlotHelmet:
        return "Helmet";
      case ArmorSlot.ArmorSlotGauntlet:
        return "Gauntlet";
      case ArmorSlot.ArmorSlotChest:
        return "Chest";
      case ArmorSlot.ArmorSlotLegs:
        return "Leg";
      case ArmorSlot.ArmorSlotClass:
        return "Class Item";
      default:
        return "";
    }
  }

  ngOnInit(): void {
    this.config.configuration
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe(async c => {
        var mustRunPossibilityCheck =
          this.configSelectedClass != c.characterClass as unknown as DestinyClass
          || this.selection != c.maximumModSlots[this.slot].value
          || this.element != c.armorAffinities[this.slot].value
          || this.elementLock != c.armorAffinities[this.slot].fixed
          || this.armorPerk != c.armorPerks[this.slot].value
          || this.armorPerkLock != c.armorPerks[this.slot].fixed
          || this.maximumModSlots != c.maximumModSlots[this.slot].value;

        this.configIgnoreArmorAffinitiesOnMasterworkedItems = c.ignoreArmorAffinitiesOnMasterworkedItems;
        this.configIgnoreArmorAffinitiesOnNonMasterworkedItems = c.ignoreArmorAffinitiesOnNonMasterworkedItems;
        this.configSelectedClass = c.characterClass as unknown as DestinyClass;
        this.selection = c.maximumModSlots[this.slot].value;
        this.element = c.armorAffinities[this.slot].value;
        this.elementLock = c.armorAffinities[this.slot].fixed;
        this.armorPerk = c.armorPerks[this.slot].value;
        this.armorPerkLock = c.armorPerks[this.slot].fixed;
        this.maximumModSlots = c.maximumModSlots[this.slot].value;

        this.disabled = (await this.inventory.getExoticsForClass(c.characterClass))
          .filter(x => c.selectedExotics.indexOf(x.item.hash) > -1)
          .map(e => e.item.slot)
          .indexOf(this.slot) > -1;

        if (mustRunPossibilityCheck)
          await this.runPossibilityCheck();
      })
  }

  toggleElementLock() {
    this.config.modifyConfiguration(c => {
      c.armorAffinities[this.slot].fixed = !c.armorAffinities[this.slot].fixed;
    })
  }

  setArmorElement(element: DestinyEnergyType | number) {
    if (this.element != element)
      this.config.modifyConfiguration(c => {
        c.armorAffinities[this.slot].value = element;
      })
    else
      this.config.modifyConfiguration(c => {
        c.armorAffinities[this.slot].value = DestinyEnergyType.Any;
      })
  }

  getAffinityName(id: DestinyEnergyType) {
    return ArmorAffinityNames[id];
  }

  getAffinityUrl(id: DestinyEnergyType) {
    return ArmorAffinityIcons[id];
  }


  toggleArmorPerkLock() {
    this.config.modifyConfiguration(c => {
      c.armorPerks[this.slot].fixed = !c.armorPerks[this.slot].fixed;
    })
  }

  setArmorPerk(perk: ArmorPerkOrSlot) {
    if (this.armorPerk != perk)
      this.config.modifyConfiguration(c => {
        c.armorPerks[this.slot].value = perk;
      })
  }

  setValue(i: number) {
    if (this.maximumModSlots == i)
      return;

    this.maximumModSlots = i;
    this.config.modifyConfiguration(c => c.maximumModSlots[this.slot].value = i);
  }

  private ngUnsubscribe = new Subject();

  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }
}
