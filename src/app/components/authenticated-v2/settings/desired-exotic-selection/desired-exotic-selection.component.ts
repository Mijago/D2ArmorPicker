import {Component, OnDestroy, OnInit} from '@angular/core';
import {InventoryService} from "../../../../services/inventory.service";
import {ConfigurationService} from "../../../../services/configuration.service";
import {CharacterClass} from "../../../../data/enum/character-Class";
import {animate, query, stagger, style, transition, trigger} from "@angular/animations";
import {IManifestArmor} from "../../../../data/types/IManifestArmor";
import {ArmorSlot} from "../../../../data/enum/armor-slot";
import {FORCE_USE_NO_EXOTIC} from "../../../../data/constants";
import {debounceTime, takeUntil} from "rxjs/operators";
import {Subject} from "rxjs";


export const listAnimation = trigger('listAnimation', [
  transition('* <=> *', [
    query(':enter',
      [style({opacity: 0}), stagger('30ms', animate('350ms ease-out', style({opacity: 1})))],
      {optional: true}
    ),
  ])
]);

@Component({
  selector: 'app-desired-exotic-selection',
  templateUrl: './desired-exotic-selection.component.html',
  styleUrls: ['./desired-exotic-selection.component.scss'],
  animations: [listAnimation]
})
export class DesiredExoticSelectionComponent implements OnInit, OnDestroy {

  selectedExotics: number[] = [];
  currentClass: CharacterClass = CharacterClass.Titan;
  exotics: IManifestArmor[][] = [];

  constructor(public inventory: InventoryService, public config: ConfigurationService) {
  }

  ngOnInit(): void {
    this.config.configuration
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe(async c => {
      if (c.characterClass != this.currentClass || this.exotics.length == 0) {
        this.currentClass = c.characterClass;
        await this.updateExoticsForClass();
      }
      this.selectedExotics = c.selectedExotics;
    })

    this.inventory.manifest
      .pipe(
        debounceTime(10),
        takeUntil(this.ngUnsubscribe)
      )
      .subscribe(async () => {
        await this.updateExoticsForClass();
      })
    this.inventory.inventory
      .pipe(
        debounceTime(10),
        takeUntil(this.ngUnsubscribe)
      )
      .subscribe(async () => {
        await this.updateExoticsForClass();
      })
  }

  private async updateExoticsForClass() {
    const armors = await this.inventory.getExoticsForClass(this.currentClass);
    this.exotics = [
      armors.filter(a => a.slot == ArmorSlot.ArmorSlotHelmet),
      armors.filter(a => a.slot == ArmorSlot.ArmorSlotGauntlet),
      armors.filter(a => a.slot == ArmorSlot.ArmorSlotChest),
      armors.filter(a => a.slot == ArmorSlot.ArmorSlotLegs),
    ]
  }

  selectExotic(hash: number, $event: any) {
    const index = this.selectedExotics.indexOf(hash);
    if (index > -1) {
      // Always delete an item if it is already in the list
      this.selectedExotics.splice(index, 1)
    } else if (hash == FORCE_USE_NO_EXOTIC) {
      this.selectedExotics = [FORCE_USE_NO_EXOTIC]
    } else if (this.selectedExotics.length == 0 || !$event.shiftKey) {
      // if length is 0 or shift is NOT pressed, add the exotic
      this.selectedExotics = [hash]
    } else {
      if (false) { // TODO: finish this feature and enable this code
        // here length is 1 and shift is pressed.
        if (this.selectedExotics.indexOf(FORCE_USE_NO_EXOTIC) > -1) return // ignore
        if (this.selectedExotics.length == 1)
          this.selectedExotics.push(hash)
        else
          this.selectedExotics[1] = hash;
      }

    }
    this.config.modifyConfiguration(c => {
      c.selectedExotics = this.selectedExotics;
    })
  }

  private ngUnsubscribe = new Subject();

  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }
}
