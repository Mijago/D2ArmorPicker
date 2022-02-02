import {AfterViewInit, Component, Input, OnInit} from '@angular/core';
import {IManifestArmor} from "../../../../data/types/IManifestArmor";
import {ItemIconServiceService} from "../../../../services/item-icon-service.service";

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
    this.item = await this.iconService.getItemCached(this.itemHash)
  }

}
