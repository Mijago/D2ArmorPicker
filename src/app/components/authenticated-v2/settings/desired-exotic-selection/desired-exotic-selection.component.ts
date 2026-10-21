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

import {
  Component,
  OnDestroy,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Optional,
} from "@angular/core";
import { LoggingProxyService } from "../../../../services/logging-proxy.service";
import { ClassExoticInfo, UserInformationService } from "src/app/services/user-information.service";
import { ConfigurationService } from "../../../../services/configuration.service";
import { BungieApiService } from "../../../../services/bungie-api.service";
import { animate, query, stagger, style, transition, trigger } from "@angular/animations";
import { ArmorSlot } from "../../../../data/enum/armor-slot";
import { FORCE_USE_ANY_EXOTIC, FORCE_USE_NO_EXOTIC } from "../../../../data/constants";
import { debounceTime, takeUntil } from "rxjs/operators";
import { Subject } from "rxjs";
import { DestinyClass } from "bungie-api-ts/destiny2";
import { ArmorPerkOrSlot } from "../../../../data/enum/armor-stat";
import { EventArmorType } from "../../../../data/enum/event-armor-type";
import {
  ExoticClassItemPerkNames,
  ExoticClassItemSpirits,
} from "../../../../data/exotic-class-item-spirits";

export const listAnimation = trigger("listAnimation", [
  transition("* <=> *", [
    query(
      ":enter",
      [style({ opacity: 0 }), stagger("30ms", animate("350ms ease-out", style({ opacity: 1 })))],
      { optional: true }
    ),
  ]),
]);

@Component({
  selector: "app-desired-exotic-selection",
  templateUrl: "./desired-exotic-selection.component.html",
  styleUrls: ["./desired-exotic-selection.component.scss"],
  animations: [listAnimation],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class DesiredExoticSelectionComponent implements OnInit, OnDestroy {
  readonly eventArmorOptions = [
    { value: EventArmorType.None, label: "None" },
    { value: EventArmorType.FestivalOfTheLost, label: "Festival of the Lost" },
    { value: EventArmorType.GuardianGames, label: "Guardian Games" },
  ];
  readonly exoticSlotNames = ["", "Helmet", "Gauntlets", "Chest", "Legs", "Class Items"];

  get useEventArmor(): EventArmorType {
    return this.config.currentConfiguration.useEventArmor;
  }

  setUseEventArmor(event: EventArmorType): void {
    this.config.modifyConfiguration((configuration) => {
      configuration.useEventArmor = event;
      const selected = this.filterEventRestrictedExotics(configuration.selectedExotics, event);
      configuration.selectedExotics = selected;
      this.selectedExotics = selected;
      if (!this.hasSelectedExoticClassItem()) {
        configuration.selectedExoticPerks = [ArmorPerkOrSlot.Any, ArmorPerkOrSlot.Any];
        this.selectedExoticPerks = [ArmorPerkOrSlot.Any, ArmorPerkOrSlot.Any];
      }
    });
  }

  isEventRestrictedExotic(exotic: ClassExoticInfo): boolean {
    const slot = this.eventRestrictedExoticSlot(this.useEventArmor);
    return slot !== undefined && exotic.items.some((item) => item.slot === slot);
  }

  selectedExotics: number[] = [];
  selectedExoticPerks: ArmorPerkOrSlot[] = [ArmorPerkOrSlot.Any, ArmorPerkOrSlot.Any];
  includeCollectionRolls = false;
  includeVendorRolls = false;
  ignoreSunsetArmor = false;
  allowBlueArmorPieces = false;
  allowLegacyLegendaryArmor = false;
  allowLegacyExoticArmor: boolean = false;
  enforceFeaturedLegendaryArmor = false;
  enforceFeaturedExoticArmor: boolean = false;
  armors: ClassExoticInfo[] = [];
  currentClass: DestinyClass = DestinyClass.Unknown;
  exotics: ClassExoticInfo[][] = [];
  importEquippedExoticInProgress = false;
  refreshInventoryInProgress = false;

  anyPerkValue = ArmorPerkOrSlot.Any;
  availableFirstPerks: { name: string; value: ArmorPerkOrSlot }[] = [];
  availableSecondPerks: { name: string; value: ArmorPerkOrSlot }[] = [];

  constructor(
    public inventory: UserInformationService,
    public config: ConfigurationService,
    private bungieApi: BungieApiService,
    private logger: LoggingProxyService,
    @Optional() private changeDetector: ChangeDetectorRef | null = null
  ) {}

  ngOnInit(): void {
    this.config.configuration.pipe(takeUntil(this.ngUnsubscribe)).subscribe(async (c) => {
      if (c.characterClass != this.currentClass || this.exotics.length == 0) {
        this.currentClass = c.characterClass;
        await this.updateExoticsForClass();
      }
      this.includeCollectionRolls = c.includeCollectionRolls;
      this.includeVendorRolls = c.includeVendorRolls;
      this.selectedExotics = c.selectedExotics;
      this.selectedExoticPerks = c.selectedExoticPerks;
      this.ignoreSunsetArmor = c.ignoreSunsetArmor;
      this.allowBlueArmorPieces = c.allowBlueArmorPieces;
      this.allowLegacyLegendaryArmor = c.allowLegacyLegendaryArmor;
      this.allowLegacyExoticArmor = c.allowLegacyExoticArmor;
      this.enforceFeaturedLegendaryArmor = c.enforceFeaturedLegendaryArmor;
      this.enforceFeaturedExoticArmor = c.enforceFeaturedExoticArmor;
      this.syncSelectedExoticVariants();
      this.changeDetector?.markForCheck();
    });

    this.inventory.manifest
      .pipe(debounceTime(10), takeUntil(this.ngUnsubscribe))
      .subscribe(async () => {
        await this.updateExoticsForClass();
        this.syncSelectedExoticVariants();
        this.changeDetector?.markForCheck();
      });
    this.inventory.inventory
      .pipe(debounceTime(10), takeUntil(this.ngUnsubscribe))
      .subscribe(async () => {
        await this.updateExoticsForClass();
        this.syncSelectedExoticVariants();
        this.changeDetector?.markForCheck();
      });
  }

  private async updateExoticsForClass() {
    this.logger.debug(
      "DesiredExoticSelectionComponent",
      "updateExoticsForClass",
      "Updating exotics for class: " + this.currentClass
    );
    this.armors = await this.inventory.getExoticsForClass(this.currentClass);

    this.exotics = [
      [], // Generic, will be filled in html loop, "item" for all exotics, or where exotic doesn't matter
      this.armors.filter((a) => a.items[0].slot == ArmorSlot.ArmorSlotHelmet),
      this.armors.filter((a) => a.items[0].slot == ArmorSlot.ArmorSlotGauntlet),
      this.armors.filter((a) => a.items[0].slot == ArmorSlot.ArmorSlotChest),
      this.armors.filter((a) => a.items[0].slot == ArmorSlot.ArmorSlotLegs),
      this.armors.filter((a) => a.items[0].slot == ArmorSlot.ArmorSlotClass),
    ];

    // Update available exotic class item perks
    this.updateAvailableExoticClassItemPerks();
  }

  private updateAvailableExoticClassItemPerks() {
    const firstPerks = new Set<number>();
    const secondPerks = new Set<number>();

    // Collect first and second perks separately from exotic class items
    this.armors
      .filter((a) => a.items[0].slot == ArmorSlot.ArmorSlotClass)
      .forEach((exotic) => {
        exotic.instances.forEach((item) => {
          // Exotic class items have exactly two perks in exoticPerkHash array
          if (item.exoticPerkHash && item.exoticPerkHash.length >= 2) {
            // Add first perk (left dropdown)
            firstPerks.add(item.exoticPerkHash[0]);
            // Add second perk (right dropdown)
            secondPerks.add(item.exoticPerkHash[1]);
          }
        });
      });

    // Convert first perk hashes to display format
    this.availableFirstPerks = Array.from(firstPerks)
      .map((perkHash) => ({
        name:
          ExoticClassItemPerkNames[perkHash as ExoticClassItemSpirits] ||
          `Unknown Perk ${perkHash}`,
        value: perkHash as ArmorPerkOrSlot,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    // Convert second perk hashes to display format
    this.availableSecondPerks = Array.from(secondPerks)
      .map((perkHash) => ({
        name:
          ExoticClassItemPerkNames[perkHash as ExoticClassItemSpirits] ||
          `Unknown Perk ${perkHash}`,
        value: perkHash as ArmorPerkOrSlot,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  hasSelectedExoticClassItem(): boolean {
    return this.armors
      .filter((a) => a.items[0].slot == ArmorSlot.ArmorSlotClass)
      .some((exotic) => exotic.items.some((item) => this.selectedExotics.includes(item.hash)));
  }

  setExoticPerk(index: number, perk: ArmorPerkOrSlot) {
    this.config.modifyConfiguration((c) => {
      c.selectedExoticPerks[index] = perk;
    });
  }

  setAllowCollectionRolls(allow: boolean) {
    this.config.modifyConfiguration((c) => {
      c.includeCollectionRolls = allow;
    });
  }

  setAllowVendorItems(allow: boolean) {
    this.config.modifyConfiguration((c) => {
      c.includeVendorRolls = allow;
    });
  }

  setAllowBlueArmorPieces(allow: boolean) {
    this.config.modifyConfiguration((c) => {
      c.allowBlueArmorPieces = allow;
    });
  }

  setAllowLegacyLegendaryArmor(allow: boolean) {
    this.config.modifyConfiguration((c) => {
      c.allowLegacyLegendaryArmor = allow;
    });
  }

  setAllowLegacyExoticArmor(allow: boolean) {
    this.config.modifyConfiguration((c) => {
      c.allowLegacyExoticArmor = allow;
    });
  }

  setIgnoreSunsetArmor(ignore: boolean) {
    this.config.modifyConfiguration((c) => {
      c.ignoreSunsetArmor = ignore;
    });
  }

  setEnforceFeaturedLegendaryArmor(enforce: boolean) {
    this.config.modifyConfiguration((c) => {
      c.enforceFeaturedLegendaryArmor = enforce;
    });
  }

  setEnforceFeaturedExoticArmor(enforce: boolean) {
    this.config.modifyConfiguration((c) => {
      c.enforceFeaturedExoticArmor = enforce;
    });
  }

  getHashesForExotic(exotic: ClassExoticInfo): number[] {
    if (exotic.items.length == 0) return [];
    if (exotic.items[0].hash == FORCE_USE_NO_EXOTIC) return [FORCE_USE_NO_EXOTIC];
    return exotic.items.map((x) => x.hash);
  }

  private syncSelectedExoticVariants(): void {
    const configured = this.config.readonlyConfigurationSnapshot.selectedExotics;
    const selected = this.filterEventRestrictedExotics(configured, this.useEventArmor);
    const normalized = this.expandSelectedExoticVariants(selected);
    this.selectedExotics = normalized;
    if (
      normalized.length !== configured.length ||
      normalized.some((hash, index) => hash !== configured[index])
    ) {
      this.config.modifyConfiguration((configuration) => {
        configuration.selectedExotics = normalized;
        if (!this.hasSelectedExoticClassItem()) {
          configuration.selectedExoticPerks = [ArmorPerkOrSlot.Any, ArmorPerkOrSlot.Any];
          this.selectedExoticPerks = [ArmorPerkOrSlot.Any, ArmorPerkOrSlot.Any];
        }
      });
    }
  }

  private filterEventRestrictedExotics(selected: number[], event: EventArmorType): number[] {
    const slot = this.eventRestrictedExoticSlot(event);
    if (slot === undefined) return selected;

    const restrictedHashes = new Set(
      this.armors
        .filter((exotic) => exotic.items.some((item) => item.slot === slot))
        .flatMap((exotic) => this.getHashesForExotic(exotic))
    );
    return selected.filter((hash) => !restrictedHashes.has(hash));
  }

  private eventRestrictedExoticSlot(event: EventArmorType): ArmorSlot | undefined {
    if (event === EventArmorType.FestivalOfTheLost) return ArmorSlot.ArmorSlotHelmet;
    if (event === EventArmorType.GuardianGames) return ArmorSlot.ArmorSlotClass;
    return undefined;
  }

  private expandSelectedExoticVariants(selected: number[]): number[] {
    if (selected.includes(FORCE_USE_ANY_EXOTIC) || selected.includes(FORCE_USE_NO_EXOTIC)) {
      return selected;
    }

    const normalized = new Set<number>();
    for (const hash of selected) {
      const exotic = this.armors.find((entry) => entry.items.some((item) => item.hash === hash));
      const hashes = exotic ? this.getHashesForExotic(exotic) : [hash];
      hashes.forEach((exoticHash) => normalized.add(exoticHash));
    }
    return [...normalized];
  }

  selectExotic(hashes: number[], $event: any) {
    const anyHashSelected = hashes.some((hash) => this.selectedExotics.indexOf(hash) > -1);
    const addToSelection = $event.ctrlKey || $event.shiftKey || $event.metaKey;
    if (anyHashSelected) {
      const remainingExotics = this.selectedExotics.filter((hash) => !hashes.includes(hash));
      this.selectedExotics = addToSelection
        ? remainingExotics
        : remainingExotics.length > 0
          ? hashes
          : [];
    } else if (
      hashes.some((hash) => hash === FORCE_USE_ANY_EXOTIC || hash === FORCE_USE_NO_EXOTIC)
    ) {
      this.selectedExotics = hashes;
    } else {
      const selectedExotics = this.selectedExotics.filter((hash) => hash >= 0);
      this.selectedExotics = addToSelection
        ? [...new Set([...selectedExotics, ...hashes])]
        : hashes;
    }
    this.config.modifyConfiguration((c) => {
      c.selectedExotics = this.selectedExotics;

      // Reset exotic perks to Any when no exotic class item is selected
      if (!this.hasSelectedExoticClassItem()) {
        c.selectedExoticPerks = [ArmorPerkOrSlot.Any, ArmorPerkOrSlot.Any];
        this.selectedExoticPerks = [ArmorPerkOrSlot.Any, ArmorPerkOrSlot.Any];
      }
    });
  }

  async refreshInventory() {
    this.refreshInventoryInProgress = true;
    try {
      await this.inventory.refreshInventory();
    } finally {
      this.refreshInventoryInProgress = false;
      this.changeDetector?.markForCheck();
    }
  }

  async importEquippedExotic() {
    this.importEquippedExoticInProgress = true;
    try {
      await this.bungieApi.importCurrentlyEquippedExotic();
    } catch (error) {
      this.logger.error(
        "DesiredExoticSelectionComponent",
        "importEquippedExotic",
        "Error importing equipped exotic: " + error
      );
    } finally {
      this.importEquippedExoticInProgress = false;
      this.changeDetector?.markForCheck();
    }
  }

  private ngUnsubscribe = new Subject();

  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }
}
