import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  Output,
  ChangeDetectionStrategy,
} from "@angular/core";
import { IInventoryArmor } from "src/app/data/types/IInventoryArmor";
import { ResultItem } from "src/app/components/authenticated-v2/results/results.component";

@Component({
  selector: "app-armor-item-tile",
  templateUrl: "./armor-item-tile.component.html",
  styleUrls: ["./armor-item-tile.component.scss"],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class ArmorItemTileComponent {
  @Input() item!: IInventoryArmor;
  @Input() pruned = false;
  @Input() prunedByItem: IInventoryArmor | null = null;
  @Input() disabled = false;
  @Input() showName = false;
  @Input() size: "compact" | "medium" = "compact";
  @Input() highlight = false;
  @Input() itemUsageCounts: Map<string, number> | undefined;
  @Output() hoverStateChange = new EventEmitter<string | null>();

  private mapItemToTooltip(item: IInventoryArmor): ResultItem {
    return {
      energyLevel: item.energyLevel,
      powerLevel: item.powerLevel,
      hash: item.hash,
      itemInstanceId: item.itemInstanceId,
      gearSetHash: item.gearSetHash,
      tier: item.tier,
      name: item.name,
      exotic: item.isExotic === 1,
      exoticPerkHash: item.exoticPerkHash,
      tuningStat: item.tuningStat,
      masterworked: item.masterworkLevel >= 5,
      armorSystem: item.armorSystem,
      masterworkLevel: item.masterworkLevel,
      archetypeStats: item.archetypeStats,
      stats: [
        item.resilience,
        item.strength,
        item.discipline,
        item.intellect,
        item.recovery,
        item.mobility,
      ],
      slot: item.slot,
      perk: item.perk,
      transferState: 0,
      statsNoMods: [
        item.resilience,
        item.strength,
        item.discipline,
        item.intellect,
        item.recovery,
        item.mobility,
      ],
      source: item.source,
      usedByCount: this.itemUsageCounts
        ? (this.itemUsageCounts.get(item.itemInstanceId) ?? 0)
        : undefined,
    };
  }

  @HostListener("mouseenter")
  onMouseEnter() {
    if (!this.prunedByItem) {
      return;
    }

    this.hoverStateChange.emit(this.prunedByItem.itemInstanceId);
  }

  @HostListener("mouseleave")
  onMouseLeave() {
    if (!this.prunedByItem) {
      return;
    }

    this.hoverStateChange.emit(null);
  }

  get tooltipItem(): ResultItem | undefined {
    if (!this.item) {
      return undefined;
    }

    return this.mapItemToTooltip(this.item);
  }

  get comparisonTooltipItem(): ResultItem | undefined {
    if (!this.prunedByItem) {
      return undefined;
    }

    return this.mapItemToTooltip(this.prunedByItem);
  }
}
