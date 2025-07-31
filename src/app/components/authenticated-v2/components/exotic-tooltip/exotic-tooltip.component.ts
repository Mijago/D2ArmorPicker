// ExoticTooltipComponent.ts

import { IInventoryArmor } from "../../../../data/types/IInventoryArmor";
import { ArmorSlot } from "../../../../data/enum/armor-slot";

export class ExoticTooltipComponent {
  // ...existing code...

  // Helper method for handling exotic perks as arrays
  getExoticPerks(item: IInventoryArmor): number[] {
    if (!item.isExotic || !item.exoticPerkHash) {
      return [];
    }

    // Return all perks for class items, first perk only for others
    if (item.slot === ArmorSlot.ArmorSlotClass) {
      return item.exoticPerkHash;
    } else {
      return item.exoticPerkHash.length > 0 ? [item.exoticPerkHash[0]] : [];
    }
  }

  // ...existing code...
}
