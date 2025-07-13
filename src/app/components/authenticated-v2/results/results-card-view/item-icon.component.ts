import { Component, Input } from "@angular/core";
import { InventoryArmorSource } from "src/app/data/types/IInventoryArmor";

@Component({
  selector: "app-item-icon",
  template: `<div
    class="item-icon-placeholder"
    [style.background-color]="getColorForSource()"></div>`,
  styles: [
    `
      .item-icon-placeholder {
        width: 100%;
        height: 100%;
        border-radius: 4px;
        border: 1px solid #444;
      }
    `,
  ],
})
export class ItemIconComponent {
  @Input() itemHash!: number;
  @Input() masterworked: boolean = false;
  @Input() source!: InventoryArmorSource;

  getColorForSource(): string {
    if (this.masterworked) return "#ffeb3b";
    return "#9e9e9e"; // Default gray color
  }
}
