import { Component, Input, OnInit } from "@angular/core";
import { MatSnackBar } from "@angular/material/snack-bar";
import { ArmorSlot } from "src/app/data/enum/armor-slot";
import { ConfigurationService } from "src/app/services/configuration.service";
import { DatabaseService } from "src/app/services/database.service";
import { ArmorPoolItemView } from "src/app/services/armor-calculator.service";

@Component({
  selector: "app-armor-pool-panel",
  templateUrl: "./armor-pool-panel.component.html",
  styleUrls: ["./armor-pool-panel.component.scss"],
})
export class ArmorPoolPanelComponent implements OnInit {
  @Input() armorPoolItems: ArmorPoolItemView[] = [];
  @Input() itemUsageCounts: Map<string, number> = new Map();
  highlightedPrunerId: string | null = null;
  isCollapsed = true;
  searchTerm = "";
  private gearSetNameLookup = new Map<number, string>();

  armorSlotOrder: ArmorSlot[] = [
    ArmorSlot.ArmorSlotHelmet,
    ArmorSlot.ArmorSlotGauntlet,
    ArmorSlot.ArmorSlotChest,
    ArmorSlot.ArmorSlotLegs,
    ArmorSlot.ArmorSlotClass,
  ];

  constructor(
    private snackBar: MatSnackBar,
    private config: ConfigurationService,
    private db: DatabaseService
  ) {}

  ngOnInit(): void {
    void this.loadGearSetNames();
  }

  get filteredEntries(): ArmorPoolItemView[] {
    return this.armorPoolItems.filter((entry) => this.matchesSearch(entry));
  }

  private async loadGearSetNames(): Promise<void> {
    const gearSets = await this.db.equipableItemSetDefinition.toArray();
    this.gearSetNameLookup.clear();
    for (const gearSet of gearSets) {
      this.gearSetNameLookup.set(gearSet.hash, gearSet.displayProperties?.name ?? "");
    }
  }

  private getGearsetName(item: { gearSetHash: number | null }): string {
    if (item.gearSetHash == null) {
      return "";
    }

    return this.gearSetNameLookup.get(item.gearSetHash) ?? "";
  }

  async copyItemDIMQuery(item: { itemInstanceId: string }): Promise<void> {
    const query = `(id:'${item.itemInstanceId}')`;

    try {
      if (navigator.clipboard && navigator.clipboard.write) {
        const clipboardItem = new ClipboardItem({
          "text/plain": new Blob([query], { type: "text/plain" }),
        });
        await navigator.clipboard.write([clipboardItem]);
        this.snackBar.open("Copied DIM query to clipboard", "", { duration: 2000 });
        return;
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(query);
        this.snackBar.open("Copied DIM query to clipboard", "", { duration: 2000 });
        return;
      }

      this.snackBar.open("Clipboard is unavailable", "", { duration: 2000 });
    } catch {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(query);
          this.snackBar.open("Copied DIM query to clipboard", "", { duration: 2000 });
          return;
        }
      } catch {
        this.snackBar.open("Failed to copy DIM query", "", { duration: 2000 });
      }
    }
  }

  disableItemFromResults(item: { itemInstanceId: string }): void {
    this.config.modifyConfiguration((cb) => {
      if (!cb.disabledItems.includes(item.itemInstanceId)) {
        cb.disabledItems.push(item.itemInstanceId);
      }
    });
    this.snackBar.open("Disabled item from results", "", { duration: 2000 });
  }

  onHoverStateChange(entry: ArmorPoolItemView, prunedByItemId: string | null) {
    if (!entry.prunedBy || !prunedByItemId) {
      this.highlightedPrunerId = null;
      return;
    }

    this.highlightedPrunerId = prunedByItemId;
  }

  toggleCollapsed(): void {
    this.isCollapsed = !this.isCollapsed;
  }

  private matchesSearch(entry: ArmorPoolItemView): boolean {
    if (!this.searchTerm.trim()) {
      return true;
    }

    const term = this.searchTerm.trim().toLowerCase();
    const item = entry.item;
    const gearsetName = this.getGearsetName(item).toLowerCase();

    return (
      item.name.toLowerCase().includes(term) ||
      item.itemInstanceId.toLowerCase().includes(term) ||
      gearsetName.includes(term)
    );
  }

  getArmorSlotEntries(slot: ArmorSlot): ArmorPoolItemView[] {
    return this.filteredEntries.filter((entry) => entry.item.slot === slot);
  }

  getPrunedEntries(): ArmorPoolItemView[] {
    return this.armorPoolItems.filter((entry) => entry.pruned);
  }

  getAllItemsDIMQuery(): string {
    return this.armorPoolItems.map((entry) => `(id:'${entry.item.itemInstanceId}')`).join(" OR ");
  }

  getPrunedDIMQuery(): string {
    return this.getPrunedEntries()
      .map((entry) => `(id:'${entry.item.itemInstanceId}')`)
      .join(" OR ");
  }

  async copyAllItemsDIMQuery(): Promise<void> {
    const query = this.getAllItemsDIMQuery();
    if (!query) {
      return;
    }

    try {
      if (navigator.clipboard && navigator.clipboard.write) {
        const clipboardItem = new ClipboardItem({
          "text/plain": new Blob([query], { type: "text/plain" }),
        });
        await navigator.clipboard.write([clipboardItem]);
        this.snackBar.open("Copied all items DIM query", "", { duration: 2000 });
        return;
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(query);
        this.snackBar.open("Copied all items DIM query", "", { duration: 2000 });
        return;
      }

      this.snackBar.open("Clipboard is unavailable", "", { duration: 2000 });
    } catch {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(query);
          this.snackBar.open("Copied all items DIM query", "", { duration: 2000 });
          return;
        }
      } catch {
        this.snackBar.open("Failed to copy all items DIM query", "", { duration: 2000 });
      }
    }
  }

  async copyPrunedDIMQuery(): Promise<void> {
    const query = this.getPrunedDIMQuery();
    if (!query) {
      return;
    }

    try {
      if (navigator.clipboard && navigator.clipboard.write) {
        const clipboardItem = new ClipboardItem({
          "text/plain": new Blob([query], { type: "text/plain" }),
        });
        await navigator.clipboard.write([clipboardItem]);
        this.snackBar.open("Copied pruned DIM IDs to clipboard", "", { duration: 2000 });
        return;
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(query);
        this.snackBar.open("Copied pruned DIM IDs to clipboard", "", { duration: 2000 });
        return;
      }

      this.snackBar.open("Clipboard is unavailable", "", { duration: 2000 });
    } catch (error) {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(query);
          this.snackBar.open("Copied pruned DIM IDs to clipboard", "", { duration: 2000 });
          return;
        }
      } catch {
        this.snackBar.open("Failed to copy pruned DIM IDs", "", { duration: 2000 });
      }
    }
  }

  getArmorSlotLabel(slot: ArmorSlot): string {
    switch (slot) {
      case ArmorSlot.ArmorSlotHelmet:
        return "Helmet";
      case ArmorSlot.ArmorSlotGauntlet:
        return "Gauntlet";
      case ArmorSlot.ArmorSlotChest:
        return "Chest";
      case ArmorSlot.ArmorSlotLegs:
        return "Legs";
      case ArmorSlot.ArmorSlotClass:
        return "Class Item";
      default:
        return "Unknown";
    }
  }
}
