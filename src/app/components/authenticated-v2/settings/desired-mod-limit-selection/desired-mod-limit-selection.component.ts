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

import { Component } from "@angular/core";
import { ArmorSlot } from "src/app/data/enum/armor-slot";
import { ConfigurationService } from "../../../../services/configuration.service";
import { ArmorPerkOrSlot } from "../../../../data/enum/armor-stat";
import { environment } from "../../../../../environments/environment";

@Component({
  selector: "app-desired-mod-selection",
  templateUrl: "./desired-mod-limit-selection.component.html",
  styleUrls: ["./desired-mod-limit-selection.component.scss"],
})
export class DesiredModLimitSelectionComponent {
  readonly ArmorSlot = ArmorSlot;
  readonly ArmorPerkOrSlot = ArmorPerkOrSlot;

  public possibilityList = [true, true, true, true, true];
  public allPossible = true;
  public disabledSlotLimitation = !environment.featureFlags.enableModslotLimitation;

  constructor(public config: ConfigurationService) {}

  updatePossibility(n: number, state: boolean) {
    this.possibilityList[n] = state;
    this.allPossible = this.possibilityList.filter((k) => !!k).length == 5;
  }

  clear() {
    this.config.modifyConfiguration((c) => {
      for (let n = 0; n < 5; n++) {
        c.armorPerks[(n + 1) as ArmorSlot] = { fixed: true, value: 0 };
        c.maximumModSlots[(n + 1) as ArmorSlot] = { fixed: true, value: 5 };
      }
    });
  }
}
