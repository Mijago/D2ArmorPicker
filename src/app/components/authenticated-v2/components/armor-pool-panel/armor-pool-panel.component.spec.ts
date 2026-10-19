import { MatSnackBar } from "@angular/material/snack-bar";
import Tracker from "@openreplay/tracker";
import type { ConfigurationService } from "../../../../services/configuration.service";
import type { DatabaseService } from "../../../../services/database.service";
import type { IInventoryArmor } from "../../../../data/types/IInventoryArmor";
import type { ArmorPoolPanelComponent } from "./armor-pool-panel.component";

describe("armor pool pagination", () => {
  let Component: typeof ArmorPoolPanelComponent;
  beforeAll(async () => {
    spyOn(Tracker.prototype, "start").and.stub();
    Component = (await import("./armor-pool-panel.component")).ArmorPoolPanelComponent;
  });

  it("shows all eligible entries across slot groups and filters without an item limit", () => {
    const component = new Component(
      {} as MatSnackBar,
      {} as ConfigurationService,
      {} as DatabaseService
    );
    component.armorPoolItems = Array.from({ length: 65 }, (_, index) => ({
      pruned: false,
      item: {
        name: `Piece ${index}`,
        itemInstanceId: String(index),
        gearSetHash: null,
        slot: component.armorSlotOrder[index % 5],
      } as IInventoryArmor,
    }));
    const visible = () =>
      component.armorSlotOrder.flatMap((slot) => component.getArmorSlotEntries(slot));
    expect(visible().length).toBe(65);
    component.searchTerm = "Piece 6";
    expect(component.filteredEntries.length).toBe(6);
    expect(visible().length).toBe(6);
  });
});
