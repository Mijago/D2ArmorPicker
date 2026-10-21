import { DestinyClass, TierType } from "bungie-api-ts/destiny2";
import Tracker from "@openreplay/tracker";
import { BuildConfiguration } from "../data/buildConfiguration";
import { ArmorSlot } from "../data/enum/armor-slot";
import { ArmorPerkOrSlot } from "../data/enum/armor-stat";
import { IInventoryArmor, InventoryArmorSource } from "../data/types/IInventoryArmor";
import { ArmorSystem } from "../data/types/IManifestArmor";
import type { ArmorCalculatorService } from "./armor-calculator.service";

describe("armor pruning power preference", () => {
  let calculator: typeof ArmorCalculatorService;
  let formatWorkerErrorEvent: (workerIndex: number, event: ErrorEvent) => string;

  beforeAll(async () => {
    spyOn(Tracker.prototype, "start").and.stub();
    const serviceModule = await import("./armor-calculator.service");
    calculator = serviceModule.ArmorCalculatorService;
    formatWorkerErrorEvent = serviceModule.formatWorkerErrorEvent;
  });

  it("logs worker error details when ErrorEvent location fields are blank", () => {
    const event = new ErrorEvent("error", {
      error: new TypeError("invalid worker request"),
    });

    expect(formatWorkerErrorEvent(0, event)).toContain(
      "Worker 0 error: TypeError: invalid worker request"
    );
  });

  function armor(id: number, powerLevel?: number): IInventoryArmor {
    return {
      id,
      hash: 1,
      itemInstanceId: String(id),
      energyLevel: 10,
      name: "Test armor",
      icon: "",
      description: "",
      watermarkIcon: "",
      isFeatured: false,
      exoticPerkHash: [],
      itemType: 2,
      itemSubType: 0,
      investmentStats: [],
      socketEntries: [],
      created_at: 0,
      updated_at: 0,
      powerLevel,
      slot: ArmorSlot.ArmorSlotHelmet,
      clazz: DestinyClass.Titan,
      isExotic: 0,
      rarity: TierType.Superior,
      armorSystem: ArmorSystem.Armor3,
      tier: 1,
      tuningStat: null,
      archetypeStats: [],
      masterworkLevel: 0,
      mobility: 10,
      resilience: 10,
      recovery: 10,
      discipline: 10,
      intellect: 10,
      strength: 10,
      perk: ArmorPerkOrSlot.Any,
      gearSetHash: null,
      gearSetPerkSelectable: false,
      source: InventoryArmorSource.Inventory,
      isSunset: false,
    };
  }

  function prune(items: IInventoryArmor[]) {
    const prunedBy = new Map<number, IInventoryArmor>();
    const remaining = calculator["pruneDominatedPerSlot"](
      items.map(calculator.convertInventoryArmorToPermutatorArmor),
      new BuildConfiguration(),
      new Map(items.map((item) => [item.id, item])),
      prunedBy
    );
    return { remaining, prunedBy };
  }

  async function fold(items: IInventoryArmor[]) {
    const service = Object.create(calculator.prototype) as ArmorCalculatorService;
    Object.defineProperty(service, "db", {
      value: {
        inventoryArmor: {
          where: () => ({
            equals: () => ({ distinct: () => ({ toArray: async () => items }) }),
          }),
        },
      },
    });
    return service["filterAndPrepareInventoryItems"](new BuildConfiguration());
  }

  for (const higherPowerFirst of [false, true]) {
    const order = higherPowerFirst ? "higher power first" : "lower power first";

    it(`keeps the higher-power equivalent during dominance pruning (${order})`, () => {
      const lower = armor(1, 200);
      const higher = armor(2, 300);
      const result = prune(higherPowerFirst ? [higher, lower] : [lower, higher]);

      expect(result.remaining.map((item) => item.id)).toEqual([higher.id]);
      expect(result.prunedBy.get(lower.id)).toBe(higher);
    });

    it(`keeps the higher-power duplicate (${order})`, async () => {
      const lower = armor(1, 200);
      const higher = armor(2, 300);
      const result = await fold(higherPowerFirst ? [higher, lower] : [lower, higher]);

      expect(result.items).toEqual([higher]);
      expect(result.duplicatePruners.get(lower.id)).toBe(higher);
    });
  }

  it("preserves the first equivalent when power is equal or missing", async () => {
    for (const power of [undefined, 300]) {
      const first = armor(1, power);
      const second = armor(2, power);

      expect(prune([first, second]).remaining.map((item) => item.id)).toEqual([first.id]);
      expect((await fold([first, second])).items).toEqual([first]);
    }
  });

  it("does not prefer power over strictly better stats", () => {
    const stronger = armor(1, 200);
    stronger.resilience = 11;
    const higherPower = armor(2, 300);

    expect(prune([higherPower, stronger]).remaining.map((item) => item.id)).toEqual([stronger.id]);
  });

  it("does not prefer power over artifice capability when folding", async () => {
    const artifice = armor(1, 200);
    artifice.perk = ArmorPerkOrSlot.SlotArtifice;
    const higherPower = armor(2, 300);
    const result = await fold([artifice, higherPower]);

    expect(result.items).toEqual([artifice]);
  });
});
