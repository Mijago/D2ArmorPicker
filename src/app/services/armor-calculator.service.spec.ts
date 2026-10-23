import { DestinyClass, TierType } from "bungie-api-ts/destiny2";
import Tracker from "@openreplay/tracker";
import { BuildConfiguration } from "../data/buildConfiguration";
import { ArmorSlot } from "../data/enum/armor-slot";
import { ArmorPerkOrSlot, ArmorStat } from "../data/enum/armor-stat";
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

  it("reuses released builder workers and ignores duplicate or missing releases", () => {
    const worker = { terminate: jasmine.createSpy("terminate") } as unknown as Worker;
    calculator["releaseWorker"](worker);
    calculator["releaseWorker"](worker);
    calculator["releaseWorker"](undefined);

    expect(calculator["isActiveWorker"](worker)).toBeFalse();
    expect(calculator["acquireWorker"]("0")).toBe(worker);
    expect(calculator["isActiveWorker"](worker)).toBeTrue();
    calculator["terminateIdleWorkers"]();
    expect(worker.terminate).not.toHaveBeenCalled();
  });

  it("shows retained results until the same armor sets are recomputed", () => {
    const entry = (key: string, total: number) =>
      ({
        key,
        total,
        gearSetRank: 0,
        sharedHash: key,
        modCount: 0,
        modCost: 0,
        masterworkedCount: 0,
        power: 0,
      }) as any;
    const retained = [entry("a", 9), entry("b", 7)];
    calculator["retainedEntries"] = retained;
    calculator["freshKeys"].clear();
    calculator["freshEntries"] = [];

    expect(calculator["currentEntries"]()).toEqual(retained);

    const recomputed = entry("a", 8);
    calculator["freshEntries"] = [recomputed];
    calculator["freshKeys"].add("a");

    expect(calculator["currentEntries"]().map((e: any) => e.key)).toEqual(["a", "b"]);
    expect(calculator["currentEntries"]()[0]).toBe(recomputed);

    calculator["retainedEntries"] = [];
    calculator["freshKeys"].clear();
    calculator["freshEntries"] = [];
  });

  it("keeps the published results array while the entries are unchanged", () => {
    const entry = (key: string) =>
      ({
        key,
        total: 9,
        gearSetRank: 0,
        sharedHash: key,
        modCount: 0,
        modCost: 0,
        masterworkedCount: 0,
        power: 0,
        definition: { sharedArmorHash: key, sharedBuildCount: 1 },
      }) as any;
    const emitted: any[] = [];
    const subject = { next: (value: any) => emitted.push(value) } as any;
    const summary = { totalTime: null, maximumPossibleTiers: [0, 0, 0, 0, 0, 0] };
    const reset = () => {
      calculator["retainedEntries"] = [];
      calculator["freshEntries"] = [];
      calculator["pendingResultSets"] = [];
      calculator["lastPublishedEntries"] = null;
      calculator["freshKeys"].clear();
    };

    reset();
    calculator["freshEntries"] = [entry("a"), entry("b")];
    calculator["publishResults"](subject, 0, summary);
    calculator["publishResults"](subject, 0, summary);
    expect(emitted[1].results).toBe(emitted[0].results);

    calculator["freshEntries"] = [...calculator["freshEntries"], entry("c")];
    calculator["publishResults"](subject, 0, summary);
    expect(emitted[2].results).not.toBe(emitted[0].results);
    expect(emitted[2].results.length).toBe(3);

    reset();
  });

  it("only trusts the theoretical T5 verdict for plain T5 pools without locks or extra health", () => {
    const t5 = (overrides: Record<string, unknown> = {}) =>
      ({
        armorSystem: ArmorSystem.Armor3,
        tier: 5,
        perk: ArmorPerkOrSlot.Any,
        ...overrides,
      }) as any;
    const trusted = (config: BuildConfiguration, items: any[]) =>
      calculator["theoreticalInfeasibilityIsFinal"](config, items);
    const config = new BuildConfiguration();

    expect(trusted(config, [t5(), t5()])).toBeTrue();
    expect(trusted(config, [])).toBeFalse();
    expect(trusted(config, [t5(), t5({ tier: 4 })])).toBeFalse();
    expect(trusted(config, [t5(), t5({ armorSystem: ArmorSystem.Armor2 })])).toBeFalse();
    expect(trusted(config, [t5({ perk: ArmorPerkOrSlot.SlotArtifice })])).toBeFalse();

    const withHealth = new BuildConfiguration();
    withHealth.addConstent1Health = true;
    expect(trusted(withHealth, [t5()])).toBeFalse();

    const locked = new BuildConfiguration();
    locked.minimumStatTiers[0].fixed = true;
    expect(trusted(locked, [t5()])).toBeFalse();
  });

  it("gets an exact infeasible verdict from the T5 limits worker for unreachable targets", async () => {
    const worker = new Worker(new URL("./theorizer-stat-limits.worker", import.meta.url), {
      type: "module",
    });
    const reply = (config: BuildConfiguration) =>
      new Promise<{ status: string }>((resolve, reject) => {
        worker.onmessage = ({ data }) => resolve(data);
        worker.onerror = (error) => reject(new Error(error.message));
        worker.postMessage({
          id: 1,
          config,
          validateOnly: false,
          exactOnly: true,
          tuning: true,
          wasmUrl: "",
        });
      });
    try {
      const unreachable = new BuildConfiguration();
      for (let stat = 0; stat < 6; stat++)
        unreachable.minimumStatTiers[stat as ArmorStat].value = 20;
      const reachable = new BuildConfiguration();
      reachable.minimumStatTiers[0].value = 10;

      expect((await reply(unreachable)).status).toBe("infeasible");
      expect((await reply(reachable)).status).toBe("feasible");
    } finally {
      worker.terminate();
    }
  });

  it("terminates idle workers on teardown", () => {
    const worker = { terminate: jasmine.createSpy("terminate") } as unknown as Worker;
    calculator["releaseWorker"](worker);
    calculator["terminateIdleWorkers"]();

    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });
});
