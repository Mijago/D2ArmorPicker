import {Component, Input, OnDestroy, OnInit} from '@angular/core';
import {Subject} from 'rxjs';
import {CharacterClass} from "../../../../data/enum/character-Class";
import {ConfigurationService} from "../../../../services/configuration.service";
import {takeUntil} from "rxjs/operators";
import {UserdataService} from "../../../../services/userdata.service";
import {InventoryService} from "../../../../services/inventory.service";

@Component({
  selector: 'app-desired-class-selection',
  templateUrl: './desired-class-selection.component.html',
  styleUrls: ['./desired-class-selection.component.scss']
})
export class DesiredClassSelectionComponent implements OnInit, OnDestroy {

  @Input() availableClasses: CharacterClass[] = [0, 1, 2]
  itemCounts: (null | number)[] = [null, null, null]
  selectedClass = -1;

  constructor(public config: ConfigurationService, public userdata: UserdataService, public inv: InventoryService) {
  }

  ngOnInit(): void {
    this.config.configuration
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe(
        c => {
          this.selectedClass = c.characterClass
          if (this.availableClasses.length > 0 && this.availableClasses.indexOf(c.characterClass) == -1) {
            this.config.modifyConfiguration(d => {
              d.characterClass = this.availableClasses[0];
              d.selectedExotics = [];
            });
          }
        }
      )
    this.inv.inventory
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe(k => this.updateItemCount())
  }

  selectClass(clazz: number) {
    if (this.config.readonlyConfigurationSnapshot.characterClass == clazz)
      return;

    this.config.modifyConfiguration(d => {
      d.characterClass = clazz;
      d.selectedExotics = [];
    });
  }

  private ngUnsubscribe = new Subject();

  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }

  private async updateItemCount() {
    for (let n = 0; n < 3; n++)
      this.itemCounts[n] = (await this.inv.getItemCountForClass(n));
  }
}
