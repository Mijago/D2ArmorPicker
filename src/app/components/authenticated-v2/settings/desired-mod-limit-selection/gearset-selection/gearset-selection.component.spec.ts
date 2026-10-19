import Tracker from "@openreplay/tracker";
import { BuildConfiguration } from "../../../../../data/buildConfiguration";
import { ArmorSystem } from "../../../../../data/types/IManifestArmor";
import { InventoryArmorSource } from "../../../../../data/types/IInventoryArmor";
import { ConfigurationService } from "../../../../../services/configuration.service";
import type { DatabaseService } from "../../../../../services/database.service";
import type { UserInformationService } from "../../../../../services/user-information.service";
import type { LoggingProxyService } from "../../../../../services/logging-proxy.service";
import type { GearsetSelectionComponent } from "./gearset-selection.component";

describe("theorizer gearset ownership", () => {
  let Gearsets: typeof GearsetSelectionComponent;
  const prefix = "test-theorizer-gearsets-";
  const logger = {
    debug: () => undefined,
    error: () => undefined,
  } as unknown as LoggingProxyService;
  beforeAll(async () => {
    spyOn(Tracker.prototype, "start").and.stub();
    Gearsets = (await import("./gearset-selection.component")).GearsetSelectionComponent;
  });
  afterEach(() => {
    localStorage.removeItem(prefix + "user-currentConfig");
    localStorage.removeItem(prefix + "storedConfigurations");
  });

  it("sorts owned four/two-piece coverage first while keeping unowned sets selectable", async () => {
    const config = new ConfigurationService(logger, {
      prefix,
      initial: BuildConfiguration.buildEmptyConfiguration(),
    });
    const items = [1, 2, 3, 4].map((slot) => ({
      slot,
      gearSetHash: 30,
      source: InventoryArmorSource.Inventory,
      armorSystem: ArmorSystem.Armor3,
      tier: 5,
    }));
    items.push(
      ...[1, 2].map((slot) => ({
        slot,
        gearSetHash: 20,
        source: InventoryArmorSource.Inventory,
        armorSystem: ArmorSystem.Armor3,
        tier: 5,
      }))
    );
    const db = {
      inventoryArmor: { where: () => ({ toArray: async () => items }) },
    } as unknown as DatabaseService;
    const component = new Gearsets({} as UserInformationService, db, config, logger);
    component.gearSets = [
      [10, "A unowned"],
      [20, "B two pieces"],
      [30, "C four pieces"],
    ].map(([hash, name]) => ({
      hash: Number(hash),
      name: String(name),
      acquisitionSources: [],
      synergies: { twoPiece: [], fourPiece: [] },
      twoPieceBonus: { perk: undefined, enabled: false, available: false },
      fourPieceBonus: { perk: undefined, enabled: false, available: false },
    }));
    await component.refreshGearsetAvailability();
    expect(component.gearSets.map((set) => set.hash)).toEqual([30, 20, 10]);
    expect(component.gearSets.map((set) => set.ownedSlots)).toEqual([4, 2, 0]);
    expect(
      component.gearSets.every((set) => set.twoPieceBonus.available && set.fourPieceBonus.available)
    ).toBeTrue();
  });

  it("waits for an existing manifest load and preserves copied gearset requirements", async () => {
    const initial = BuildConfiguration.buildEmptyConfiguration();
    initial.armorRequirements = Array.from({ length: 4 }, () => ({ gearSetHash: 30 }));
    const config = new ConfigurationService(logger, { prefix, initial });
    let release!: (sets: unknown[]) => void;
    const definitions = new Promise<unknown[]>((resolve) => {
      release = resolve;
    });
    const load = jasmine.createSpy("load definitions").and.returnValue(definitions);
    const db = {
      equipableItemSetDefinition: { toArray: load },
      sandboxPerkDefinition: { where: () => ({ first: async () => undefined }) },
      inventoryArmor: { where: () => ({ toArray: async () => [] }) },
    } as unknown as DatabaseService;
    const component = new Gearsets({} as UserInformationService, db, config, logger);
    const first = component["refreshGearSets"]();
    const overlapping = component["refreshGearSets"]();
    expect(overlapping).toBe(first);
    expect(load).toHaveBeenCalledTimes(1);
    release([{ hash: 30, displayProperties: { name: "Selected set" }, setPerks: [] }]);
    await Promise.all([first, overlapping]);
    await component.refreshGearsetAvailability();
    expect(component.gearSets[0].fourPieceBonus.enabled).toBeTrue();
    expect(config.currentConfiguration.armorRequirements).toEqual(initial.armorRequirements);
  });
});
