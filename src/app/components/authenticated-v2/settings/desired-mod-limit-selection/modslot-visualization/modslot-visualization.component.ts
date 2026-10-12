import { Component, OnInit, OnDestroy } from "@angular/core";
import {
  ArmorPerkOrSlot,
  ArmorPerkSocketHashes,
  ArmorPerkOrSlotNames,
} from "../../../../../data/enum/armor-stat";
import { ConfigurationService } from "../../../../../services/configuration.service";
import { Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";
import { FORCE_USE_ANY_EXOTIC, FORCE_USE_NO_EXOTIC } from "src/app/data/constants";
import { BuildConfiguration } from "src/app/data/buildConfiguration";
import { ItemIconServiceService } from "src/app/services/item-icon-service.service";

enum SlotType {
  SlotTypeEmpty,
  SlotTypeExotic,
  SlotTypeGearset,
  SlotTypePerk,
}

export interface SlotInformation {
  type: SlotType;
  hash: number;
  icon?: string; // Optional icon URL for the slot, if applicable
  name?: string; // Optional name for the slot, if applicable
  showGenericExotic?: boolean;
  count?: number;
}

@Component({
  selector: "app-modslot-visualization",
  templateUrl: "./modslot-visualization.component.html",
  styleUrls: ["./modslot-visualization.component.scss"],
})
export class ModslotVisualizationComponent implements OnInit, OnDestroy {
  hoveredPerkIndex: number | null = null;
  SlotType = SlotType;
  slots: SlotInformation[] = [];
  availablePerks: number[] = [];
  private slotUpdateRequest = 0;

  constructor(
    private configService: ConfigurationService,
    private itemIconService: ItemIconServiceService
  ) {}

  // Returns the index of the first empty slot, or -1 if none
  get firstEmptySlotIndex(): number {
    return this.slots.findIndex((slot) => slot.type === SlotType.SlotTypeEmpty);
  }

  ngOnInit() {
    for (const k in [
      ArmorPerkOrSlot.SlotArtifice,
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
    ]) {
      if (Object.prototype.hasOwnProperty.call(ArmorPerkSocketHashes, k)) {
        this.availablePerks.push((ArmorPerkSocketHashes as any)[k]);
      }
    }
    this.availablePerks.sort((a, b) => {
      const nameA = this.getPerkName(a);
      const nameB = this.getPerkName(b);
      return nameA.localeCompare(nameB);
    });

    this.configService.configuration.pipe(takeUntil(this.ngUnsubscribe)).subscribe((config) => {
      void this.updateSlots(config, ++this.slotUpdateRequest);
    });
  }

  private async updateSlots(config: BuildConfiguration, request: number): Promise<void> {
    const exoticDisplay = await this.getExoticDisplay(config.selectedExotics || []);
    if (request !== this.slotUpdateRequest) return;

    const isExoticSelectionEnabled =
      config.selectedExotics.length > 0 && config.selectedExotics[0] !== FORCE_USE_NO_EXOTIC;
    if (config.armorRequirements.length > 4 && isExoticSelectionEnabled) {
      this.configService.modifyConfiguration((cb) => {
        // If there are more than 4 armor requirements and an exotic is selected, trim the requirements to 4
        cb.armorRequirements = cb.armorRequirements.slice(0, 4);
      });
      return;
    }

    const newSlots: SlotInformation[] = [];
    if (exoticDisplay) {
      newSlots.push({
        type: SlotType.SlotTypeExotic,
        hash: exoticDisplay.hash,
        name: exoticDisplay.name,
        showGenericExotic: exoticDisplay.showGenericExotic,
        count: exoticDisplay.count,
      });
    }

    config.armorRequirements.forEach(async (req) => {
      if ("perk" in req) {
        newSlots.push({
          type: SlotType.SlotTypePerk,
          hash: req.perk,
        });
      } else if ("gearSetHash" in req) {
        const enabledAmount = config.armorRequirements.filter(
          (r) => "gearSetHash" in r && r.gearSetHash === req.gearSetHash
        ).length;
        const entry: SlotInformation = {
          type: SlotType.SlotTypeGearset,
          hash: req.gearSetHash,
        };
        newSlots.push(entry);

        const gsData = await this.itemIconService.getGearsetPerkCached(
          req.gearSetHash,
          enabledAmount
        );
        entry.icon = gsData?.displayProperties.icon;
        entry.name = gsData?.displayProperties.name;
      }
    });

    while (newSlots.length < 5) {
      newSlots.push({
        type: SlotType.SlotTypeEmpty,
        hash: 0, // Placeholder for empty slot
      });
    }

    if (request !== this.slotUpdateRequest) return;
    this.slots = newSlots;
  }

  private async getExoticDisplay(
    selectedExotics: number[]
  ): Promise<
    { hash: number; name: string; showGenericExotic: boolean; count?: number } | undefined
  > {
    if (selectedExotics.includes(FORCE_USE_NO_EXOTIC) || selectedExotics.length === 0) {
      return undefined;
    }
    if (selectedExotics.includes(FORCE_USE_ANY_EXOTIC)) {
      return { hash: 0, name: "Any exotic armor", showGenericExotic: true };
    }

    const uniqueExotics = new Map<string, { hash: number; name: string }>();
    await Promise.all(
      [...new Set(selectedExotics)].map(async (hash) => {
        const item = await this.itemIconService.getItemCached(hash).catch(() => undefined);
        const name = item?.name?.trim() || `Exotic ${hash}`;
        const key = name.toLocaleLowerCase();
        if (!uniqueExotics.has(key)) uniqueExotics.set(key, { hash, name });
      })
    );

    const exotics = [...uniqueExotics.values()];
    if (exotics.length === 0) return undefined;
    if (exotics.length === 1) {
      return { ...exotics[0], showGenericExotic: false };
    }
    return {
      hash: 0,
      name: exotics.map((exotic) => exotic.name).join(", "),
      showGenericExotic: true,
      count: exotics.length,
    };
  }

  onPerkSelect(slotIndex: number, selectedPerk: ArmorPerkOrSlot) {
    this.configService.modifyConfiguration((cb) => {
      if (cb.armorRequirements.length < 5) {
        cb.armorRequirements.push({ perk: selectedPerk });
      }
    });
  }

  removePerk(slot: SlotInformation) {
    this.hoveredPerkIndex = null;
    this.configService.modifyConfiguration((cb) => {
      const index = cb.armorRequirements.findIndex(
        (req) => "perk" in req && req.perk === slot.hash
      );
      cb.armorRequirements.splice(index, 1);
    });
  }

  getPerkName(hash: number): string {
    let idx: ArmorPerkOrSlot | undefined = undefined;
    // Find the key in ArmorPerkSocketHashes whose value matches the hash
    for (const key in ArmorPerkSocketHashes) {
      if ((ArmorPerkSocketHashes as any)[key] === hash) {
        idx = key as any as ArmorPerkOrSlot;
        break;
      }
    }
    if (idx === undefined) {
      return "Unknown";
    }
    if (ArmorPerkOrSlotNames[idx]) {
      return ArmorPerkOrSlotNames[idx];
    }

    return "Unknown";
  }
  private ngUnsubscribe = new Subject();

  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }
}
