/*
 * Copyright (c) 2023 D2ArmorPicker by Mijago.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import { AfterViewInit, Component, Input } from "@angular/core";
import { IManifestArmor } from "../../../../data/types/IManifestArmor";
import { ItemIconServiceService } from "../../../../services/item-icon-service.service";
import { InventoryArmorSource } from "src/app/data/types/IInventoryArmor";
import { SpecialItemIconUrls } from "src/app/data/enum/armor-stat";

@Component({
  selector: "app-item-icon",
  templateUrl: "./item-icon.component.html",
  styleUrls: ["./item-icon.component.scss"],
})
export class ItemIconComponent implements AfterViewInit {
  SpecialItemIconUrls = SpecialItemIconUrls;
  @Input()
  itemHash: number = 0;

  @Input()
  masterworked: boolean = false;

  @Input()
  source: InventoryArmorSource = InventoryArmorSource.Inventory;
  isFromVendor: boolean = false;
  isFromCollection: boolean = false;

  item: IManifestArmor | undefined = undefined;

  constructor(private iconService: ItemIconServiceService) {}

  async ngAfterViewInit() {
    this.item = await this.iconService.getItemCached(this.itemHash);
    this.isFromVendor = this.source === InventoryArmorSource.Vendor;
    this.isFromCollection = this.source === InventoryArmorSource.Collections;
  }
}
