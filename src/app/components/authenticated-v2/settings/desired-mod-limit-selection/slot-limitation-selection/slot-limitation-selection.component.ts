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

import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { MAXIMUM_STAT_MOD_AMOUNT } from "../../../../../data/constants";
import { ArmorSlot } from "../../../../../data/enum/armor-slot";
import { ConfigurationService } from "../../../../../services/configuration.service";
import {
  ArmorPerkOrSlot,
  ArmorPerkOrSlotNames,
  StatModifier,
} from "../../../../../data/enum/armor-stat";
import { DestinyClass } from "bungie-api-ts/destiny2";
import { InventoryService } from "../../../../../services/inventory.service";
import { Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";
import { environment } from "../../../../../../environments/environment";
import { ItemIconServiceService } from "src/app/services/item-icon-service.service";
import { ModUrl } from "../../../results/table-mod-display/table-mod-display.component";
import { AvailableItemsService } from "../../../../../services/available-items.service";

@Component({
  selector: "app-slot-limitation-selection",
  templateUrl: "./slot-limitation-selection.component.html",
  styleUrls: ["./slot-limitation-selection.component.scss"],
})
export class SlotLimitationSelectionComponent implements OnInit, OnDestroy {
  readonly featureDisabled = !environment.featureFlags.enableModslotLimitation;
  readonly ModUrls = ModUrl;
  readonly StatModifier = StatModifier;
  readonly ArmorSlot = ArmorSlot;
  readonly ArmorPerkOrSlotNames = ArmorPerkOrSlotNames;
  readonly ArmorPerkOrSlot = ArmorPerkOrSlot;
  readonly ModRange = new Array(MAXIMUM_STAT_MOD_AMOUNT + 1);
  selection: number = MAXIMUM_STAT_MOD_AMOUNT;

  @Input()
  slot: ArmorSlot = ArmorSlot.ArmorSlotHelmet;
  @Output()
  possible: EventEmitter<boolean> = new EventEmitter<boolean>();

  isPossible: boolean = true;
  configSelectedClass: DestinyClass = DestinyClass.Unknown;
  configAssumeLegendaryIsArtifice: boolean = false;
  configSelectedExoticSum: number = 0;
  configSelectedExotic: number[] = [];
  configAssumeClassItemIsArtifice: boolean = false;
  configAssumeExoticIsArtifice: boolean = false;
  armorPerk: ArmorPerkOrSlot = ArmorPerkOrSlot.Any;
  armorPerkLock: boolean = false;
  maximumModSlots: number = 5;

  hoveredSlot: number = -1;

  disabled: boolean = false;

  readonly availableArmorPerks = [
    ArmorPerkOrSlot.Any,
    ArmorPerkOrSlot.None,
    ArmorPerkOrSlot.SlotArtifice,
    ArmorPerkOrSlot.GearsetTechsec,
    ArmorPerkOrSlot.GearsetBushido,
    ArmorPerkOrSlot.GearsetAionRenewal,
    ArmorPerkOrSlot.GearsetLastDiscipline,
    ArmorPerkOrSlot.GearsetAionAdapter,
    ArmorPerkOrSlot.GearsetTwoFoldCrown,
    ArmorPerkOrSlot.GearsetCollectivePsyche,
    ArmorPerkOrSlot.GuardianGamesClassItem,
    ArmorPerkOrSlot.PerkOverflowingCorruption,
    ArmorPerkOrSlot.SlotEidosApprentice,
    ArmorPerkOrSlot.SlotSalvationsEdge,
    ArmorPerkOrSlot.SlotCrotasEnd,
    ArmorPerkOrSlot.SlotRootOfNightmares,
    ArmorPerkOrSlot.SlotKingsFall,
    ArmorPerkOrSlot.SlotVowOfTheDisciple,
    ArmorPerkOrSlot.SlotVaultOfGlass,
    ArmorPerkOrSlot.SlotDeepStoneCrypt,
    ArmorPerkOrSlot.SlotGardenOfSalvation,
    ArmorPerkOrSlot.SlotLastWish,
    ArmorPerkOrSlot.PerkEchoesOfGlory,
    ArmorPerkOrSlot.PerkIronBanner,
    ArmorPerkOrSlot.SlotNightmare,
  ];

  constructor(
    public config: ConfigurationService,
    public inventory: InventoryService,
    private iconService: ItemIconServiceService,
    private availableItems: AvailableItemsService
  ) {}

  get slotName(): string {
    switch (this.slot) {
      case ArmorSlot.ArmorSlotHelmet:
        return "Helmet";
      case ArmorSlot.ArmorSlotGauntlet:
        return "Gauntlet";
      case ArmorSlot.ArmorSlotChest:
        return "Chest";
      case ArmorSlot.ArmorSlotLegs:
        return "Leg";
      case ArmorSlot.ArmorSlotClass:
        return "Class Item";
      default:
        return "";
    }
  }

  ngOnInit(): void {
    this.availableItems
      .getItemsForSlot$(this.slot)
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe((items) => {
        this.isPossible = items.length > 0;
        this.possible.next(this.isPossible);
      });

    this.config.configuration.pipe(takeUntil(this.ngUnsubscribe)).subscribe(async (c) => {
      const newExoticSum = c.selectedExotics.reduce((acc, x) => acc + x, 0);

      this.configAssumeLegendaryIsArtifice = c.assumeEveryLegendaryIsArtifice;
      this.configAssumeExoticIsArtifice = c.assumeEveryExoticIsArtifice;
      this.configAssumeClassItemIsArtifice = c.assumeClassItemIsArtifice;
      this.configSelectedClass = c.characterClass;
      this.selection = c.maximumModSlots[this.slot].value;
      this.armorPerk = c.armorPerks[this.slot].value;
      this.armorPerkLock = c.armorPerks[this.slot].fixed;
      this.maximumModSlots = c.maximumModSlots[this.slot].value;
      this.configSelectedExoticSum = newExoticSum;
      this.configSelectedExotic = c.selectedExotics;
    });
  }

  toggleArmorPerkLock() {
    this.config.modifyConfiguration((c) => {
      c.armorPerks[this.slot].fixed = !c.armorPerks[this.slot].fixed;
    });
  }

  setArmorPerk(perk: ArmorPerkOrSlot) {
    if (this.armorPerk != perk)
      this.config.modifyConfiguration((c) => {
        c.armorPerks[this.slot].value = perk;
      });
  }

  setValue(i: number) {
    if (this.featureDisabled) return;
    if (this.maximumModSlots == i) return;

    this.maximumModSlots = i;
    this.config.modifyConfiguration((c) => (c.maximumModSlots[this.slot].value = i));
  }

  async getStatIconUrl(statHash: number) {
    const item = await this.iconService.getItemCached(statHash);
    return item?.icon;
  }

  private ngUnsubscribe = new Subject();

  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }

  // Helper method to check if items are available for a specific slot
  hasItemsForSlot(slot: ArmorSlot): boolean {
    return this.availableItems.hasItemsForSlot(slot);
  }

  // Helper method to get item count for a specific slot
  getItemCountForSlot(slot: ArmorSlot): number {
    return this.availableItems.getItemsForSlot(slot).length;
  }
}
