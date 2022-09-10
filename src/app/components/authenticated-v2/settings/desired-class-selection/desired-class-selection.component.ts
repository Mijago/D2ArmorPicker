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
  public storedMaterials: { "3853748946": number; "4257549985": number; "4257549984": number, "3159615086": number, "1022552290": number } | null = null;

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
      .subscribe(async k => {
        await this.loadStoredMaterials();
        await this.updateItemCount()
      })
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

  private async loadStoredMaterials() {
    var k: { "3853748946": number; "4257549985": number; "4257549984": number, "3159615086": number, "1022552290": number } = JSON.parse(localStorage.getItem("stored-materials") || "{}")
    if (!("3853748946" in k)) k["3853748946"] = 0;
    if (!("4257549984" in k)) k["4257549984"] = 0;
    if (!("4257549985" in k)) k["4257549985"] = 0;
    if (!("3159615086" in k)) k["3159615086"] = 0;
    if (!("1022552290" in k)) k["1022552290"] = 0;
    this.storedMaterials = k;
  }
}
