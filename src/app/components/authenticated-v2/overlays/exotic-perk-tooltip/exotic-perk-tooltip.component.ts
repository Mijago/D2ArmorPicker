import {Component, Input, OnInit} from '@angular/core';
import {ResultItem} from "../../results/results.component";
import {IInventoryArmor} from "../../../../data/types/IInventoryArmor";
import {IManifestArmor} from "../../../../data/types/IManifestArmor";
import {InventoryService} from "../../../../services/inventory.service";
import {ItemIconServiceService} from "../../../../services/item-icon-service.service";

@Component({
  selector: 'app-exotic-perk-tooltip',
  templateUrl: './exotic-perk-tooltip.component.html',
  styleUrls: ['./exotic-perk-tooltip.component.css']
})
export class ExoticPerkTooltipComponent implements OnInit {
  @Input(`itemTooltip`) armor: IManifestArmor | undefined;
  exoticPerk: IManifestArmor | undefined;
  exoticPerkNotThere : boolean = false;

  constructor(public inv: InventoryService, public iconService: ItemIconServiceService) { }

  async ngOnInit() {
    this.exoticPerk = await this.iconService.getItemCached(this.armor?.exoticPerkHash ?? 0)
    this.exoticPerkNotThere = this.exoticPerk == null
  }

}
