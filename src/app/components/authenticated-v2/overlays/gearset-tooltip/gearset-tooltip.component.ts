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

import { Component, Input, ChangeDetectionStrategy } from "@angular/core";
import { UserInformationService } from "src/app/services/user-information.service";
import { ItemIconServiceService } from "../../../../services/item-icon-service.service";
import { DestinySandboxPerkDefinition } from "bungie-api-ts/destiny2";
import { DatabaseService } from "src/app/services/database.service";
import {
  formatGearSetAcquisitionSourceName,
  GearSetAcquisitionSource,
} from "src/app/data/gear-set-acquisition";

@Component({
  selector: "app-gearset-tooltip",
  templateUrl: "./gearset-tooltip.component.html",
  styleUrls: ["./gearset-tooltip.component.css"],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class GearsetTooltipComponent {
  private gearsetValue: DestinySandboxPerkDefinition | undefined;
  private sourceLookupId = 0;
  acquisitionSources: GearSetAcquisitionSource[] = [];

  @Input()
  set gearset(value: DestinySandboxPerkDefinition | undefined) {
    this.gearsetValue = value;
    void this.loadAcquisitionSources(value?.hash);
  }

  get gearset(): DestinySandboxPerkDefinition | undefined {
    return this.gearsetValue;
  }

  getAcquisitionSourceName(source: GearSetAcquisitionSource): string {
    return formatGearSetAcquisitionSourceName(source);
  }

  constructor(
    public inv: UserInformationService,
    public iconService: ItemIconServiceService,
    private db: DatabaseService
  ) {}

  private async loadAcquisitionSources(perkHash?: number): Promise<void> {
    const lookupId = ++this.sourceLookupId;
    this.acquisitionSources = [];
    if (perkHash === undefined) return;

    const gearSets = await this.db.equipableItemSetDefinition.toArray();
    if (lookupId !== this.sourceLookupId) return;

    this.acquisitionSources =
      gearSets.find((gearSet) => gearSet.setPerks.some((perk) => perk.sandboxPerkHash === perkHash))
        ?.acquisitionSources ?? [];
  }
}
