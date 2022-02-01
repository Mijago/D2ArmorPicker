import {AfterViewInit, Component, Input, OnInit} from '@angular/core';
import {DatabaseService} from "../../../../services/database.service";
import {liveQuery} from "dexie";
import {IManifestArmor} from "../../../../data/types/IManifestArmor";
import {ItemIconServiceService} from "../../../../services/item-icon-service.service";
function timeout(ms:number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

@Component({
  selector: 'item-icon',
  templateUrl: './item-icon.component.html',
  styleUrls: ['./item-icon.component.scss']
})
export class ItemIconComponent implements AfterViewInit {

  @Input()
  itemHash: number = 0;

  @Input()
  masterworked: boolean = false;
  item: IManifestArmor | undefined = undefined;

  constructor(private iconService : ItemIconServiceService) {
  }

  async ngAfterViewInit() {
    //this.item = await this.db.manifestArmor.where('hash').equals(this.itemHash).first();
    this.item = await this.iconService.getItemCached(this.itemHash)
  }

}
