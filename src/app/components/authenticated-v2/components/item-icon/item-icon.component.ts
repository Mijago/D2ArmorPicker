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

import { AfterViewInit, Component, Input, OnChanges, SimpleChanges } from "@angular/core";
import { IManifestArmor } from "../../../../data/types/IManifestArmor";
import { ItemIconServiceService } from "../../../../services/item-icon-service.service";
import { InventoryArmorSource } from "src/app/data/types/IInventoryArmor";
import { SpecialItemIconUrls } from "src/app/data/enum/armor-stat";

/*
 * Tier pip SVGs adapted from Destiny Item Manager (DIM), specifically the
 * "Replace tier pips" change from Ben Hollis in PR #11947.
 *
 * Attribution: Original tier pip artwork from the Destiny Item Manager project.
 * License: This project is distributed under the GNU Affero General Public License v3.0,
 * and the tier pip SVGs are used here under the same project licensing terms while preserving
 * the original DIM attribution and source reference.
 */
const tierPips: Record<number, string> = {
  2: `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96" preserveAspectRatio="xMidYMid meet">
      <g fill="#c8c2cd">
        <path d="M18.938 35.784c.323-.323.323-.847 0-1.17L14.257 29.933c-.323-.323-.847-.323-1.17 0L8.401 34.619c-.323.323-.323.847 0 1.17l4.68 4.681c.323.323.848.323 1.171 0z"/>
        <path d="M18.938 48.779c.323-.323.323-.847 0-1.17L14.257 42.928c-.323-.323-.847-.323-1.17 0L8.401 47.614c-.323.323-.323.848 0 1.17l4.68 4.681c.323.323.848.323 1.171 0z"/>
      </g>
    </svg>
  `)}`,
  3: `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96" preserveAspectRatio="xMidYMid meet">
      <g fill="#edf3ed">
        <path d="M18.938 36.58c.323-.323.323-.847 0-1.17L14.257 30.729c-.323-.323-.847-.323-1.17 0L8.401 35.415c-.323.323-.323.847 0 1.17l4.68 4.681c.323.323.848.323 1.171 0z"/>
        <path d="M18.938 49.575c.323-.323.323-.847 0-1.17L14.257 43.724c-.323-.323-.847-.323-1.17 0L8.401 48.41c-.323.323-.323.847 0 1.17l4.68 4.681c.323.323.848.323 1.171 0z"/>
        <path d="M18.938 62.57c.323-.323.323-.847 0-1.17L14.257 56.719c-.323-.323-.847-.323-1.17 0L8.401 61.405c-.323.323-.323.848 0 1.17l4.68 4.681c.323.323.848.323 1.171 0z"/>
      </g>
    </svg>
  `)}`,
  4: `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96" preserveAspectRatio="xMidYMid meet">
      <g fill="#ffcbff">
        <path d="M18.938 35.763c.323-.323.323-.847 0-1.17L14.257 29.912c-.323-.323-.847-.323-1.17 0L8.401 34.598c-.323.323-.323.848 0 1.171l4.68 4.681c.323.322.848.322 1.171 0z"/>
        <path d="M18.938 48.758c.323-.323.323-.847 0-1.17L14.257 42.907c-.323-.323-.847-.323-1.17 0L8.401 47.593c-.323.322-.323.847 0 1.17l4.68 4.681c.323.323.848.323 1.171 0z"/>
        <path d="M18.938 61.753c.323-.323.323-.847 0-1.17L14.257 55.902c-.323-.323-.847-.323-1.17 0L8.401 60.588c-.323.322-.323.847 0 1.17l4.68 4.681c.323.323.848.323 1.171 0z"/>
        <path d="M18.938 74.748c.323-.323.323-.847 0-1.17L14.257 68.897c-.323-.323-.847-.323-1.17 0L8.401 73.583c-.323.323-.323.847 0 1.17l4.68 4.681c.323.323.848.323 1.171 0z"/>
      </g>
    </svg>
  `)}`,
  5: `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96" preserveAspectRatio="xMidYMid meet">
      <g fill="#fcff99">
        <path d="M18.938 35.69c.323-.323.323-.847 0-1.17L14.257 29.839c-.323-.323-.847-.323-1.17 0L8.401 34.525c-.323.323-.323.848 0 1.171l4.68 4.68c.323.323.848.323 1.171 0z"/>
        <path d="M18.938 48.685c.323-.323.323-.847 0-1.17L14.257 42.834c-.323-.323-.847-.323-1.17 0L8.401 47.52c-.323.323-.323.848 0 1.171l4.68 4.68c.323.323.848.323 1.171 0z"/>
        <path d="M18.938 61.68c.323-.323.323-.847 0-1.17L14.257 55.829c-.323-.323-.847-.323-1.17 0L8.401 60.515c-.323.323-.323.848 0 1.171l4.68 4.681c.323.322.848.322 1.171 0z"/>
        <path d="M18.938 74.675c.323-.323.323-.847 0-1.17L14.257 68.824c-.323-.323-.847-.323-1.17 0L8.401 73.51c-.323.323-.323.848 0 1.171l4.68 4.681c.323.322.848.322 1.171 0z"/>
        <path d="M18.938 87.67c.323-.323.323-.847 0-1.17L14.257 81.819c-.323-.323-.847-.323-1.17 0L8.401 86.505c-.323.322-.323.847 0 1.17l4.68 4.681c.323.323.848.323 1.171 0z"/>
      </g>
    </svg>
  `)}`,
};

@Component({
  selector: "app-item-icon",
  templateUrl: "./item-icon.component.html",
  styleUrls: ["./item-icon.component.scss"],
})
export class ItemIconComponent implements AfterViewInit, OnChanges {
  SpecialItemIconUrls = SpecialItemIconUrls;
  @Input()
  itemHash: number = 0;

  @Input()
  masterworked: boolean = false;

  @Input()
  tier: number = 0;

  @Input()
  source: InventoryArmorSource = InventoryArmorSource.Inventory;
  isFromVendor: boolean = false;
  isFromCollection: boolean = false;

  item: IManifestArmor | undefined = undefined;

  constructor(private iconService: ItemIconServiceService) {}

  get tierIcon(): string | null {
    if (this.tier < 2 || this.tier > 5) {
      return null;
    }

    return tierPips[this.tier] ?? null;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ("itemHash" in changes || "source" in changes) {
      void this.loadItem();
    }
  }

  async ngAfterViewInit() {
    await this.loadItem();
  }

  private async loadItem(): Promise<void> {
    if (!this.itemHash) {
      this.item = undefined;
      return;
    }

    this.item = await this.iconService.getItemCached(this.itemHash);
    this.isFromVendor = this.source === InventoryArmorSource.Vendor;
    this.isFromCollection = this.source === InventoryArmorSource.Collections;
  }
}
