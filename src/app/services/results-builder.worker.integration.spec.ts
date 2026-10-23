import { DestinyClass, TierType } from "bungie-api-ts/destiny2";
import { BuildConfiguration } from "../data/buildConfiguration";
import { ArmorSlot } from "../data/enum/armor-slot";
import { ArmorPerkOrSlot, ArmorStat } from "../data/enum/armor-stat";
import { ArmorSystem } from "../data/types/IManifestArmor";
import { IPermutatorArmor } from "../data/types/IPermutatorArmor";
import { FORCE_USE_ANY_EXOTIC, FORCE_USE_NO_EXOTIC } from "../data/constants";
import { unpackArmorSets } from "./packed-armor-sets";

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function makeItems(seed: number): IPermutatorArmor[] {
  const rand = rng(seed);
  const int = (n: number) => Math.floor(rand() * n);
  const items: IPermutatorArmor[] = [];
  let id = 1;
  const slots = [
    ArmorSlot.ArmorSlotHelmet,
    ArmorSlot.ArmorSlotGauntlet,
    ArmorSlot.ArmorSlotChest,
    ArmorSlot.ArmorSlotLegs,
    ArmorSlot.ArmorSlotClass,
  ];
  for (const slot of slots) {
    for (let n = 0; n < 6; n++) {
      const exotic = n < 2 ? 1 : 0;
      const armor3 = rand() < 0.7;
      const stats = [0, 0, 0, 0, 0, 0];
      let archetype: number[] = [];
      let tuningStat: ArmorStat | null = null;
      if (armor3) {
        const pool = [0, 1, 2, 3, 4, 5];
        archetype = [];
        for (let k = 0; k < 3; k++) archetype.push(pool.splice(int(pool.length), 1)[0]);
        stats[archetype[0]] = 30 + int(3);
        stats[archetype[1]] = 25;
        stats[archetype[2]] = 20;
        for (const stat of pool) stats[stat] = 5;
        tuningStat = rand() < 0.8 ? (int(6) as ArmorStat) : null;
      } else {
        for (let stat = 0; stat < 6; stat++) stats[stat] = 2 + int(22);
      }
      items.push({
        id: id++,
        hash: 1000 + id,
        slot,
        clazz: DestinyClass.Titan,
        isExotic: exotic as 0 | 1,
        rarity: exotic ? TierType.Exotic : TierType.Superior,
        isSunset: false,
        perk: rand() < 0.3 ? ArmorPerkOrSlot.SlotArtifice : ArmorPerkOrSlot.Any,
        masterworkLevel: rand() < 0.6 ? 5 : int(5),
        archetypeStats: archetype,
        resilience: stats[0],
        strength: stats[1],
        discipline: stats[2],
        intellect: stats[3],
        recovery: stats[4],
        mobility: stats[5],
        gearSetHash: rand() < 0.4 ? 7000 + int(2) : null,
        gearSetPerkSelectable: false,
        tuningStat,
        armorSystem: armor3 ? ArmorSystem.Armor3 : ArmorSystem.Armor2,
        tier: armor3 ? (rand() < 0.7 ? 5 : 3) : 1,
      } as unknown as IPermutatorArmor);
    }
  }
  return items;
}

function configure(patch: (config: BuildConfiguration) => void): BuildConfiguration {
  const config = new BuildConfiguration();
  config.characterClass = DestinyClass.Titan;
  config.parsedResultLimit = 0;
  config.calculateTierFiveTuning = true;
  patch(config);
  return config;
}

function tier(config: BuildConfiguration, stat: ArmorStat, value: number, fixed = false) {
  config.minimumStatTiers[stat] = { value, fixed };
}

const CONFIGS: [string, BuildConfiguration][] = [
  ["no targets", configure(() => {})],
  [
    "targets",
    configure((c) => {
      tier(c, ArmorStat.StatWeapon, 10);
      tier(c, ArmorStat.StatGrenade, 8);
    }),
  ],
  [
    "high targets",
    configure((c) => {
      tier(c, ArmorStat.StatWeapon, 13);
      tier(c, ArmorStat.StatGrenade, 11);
      tier(c, ArmorStat.StatSuper, 9);
    }),
  ],
  [
    "fixed",
    configure((c) => {
      tier(c, ArmorStat.StatWeapon, 10, true);
      tier(c, ArmorStat.StatHealth, 7);
    }),
  ],
  [
    "no tuning + const health",
    configure((c) => {
      c.calculateTierFiveTuning = false;
      c.addConstent1Health = true;
      tier(c, ArmorStat.StatClass, 9);
      tier(c, ArmorStat.StatMelee, 9);
    }),
  ],
  [
    "any exotic",
    configure((c) => {
      c.selectedExotics = [FORCE_USE_ANY_EXOTIC];
      tier(c, ArmorStat.StatWeapon, 9);
    }),
  ],
  [
    "no exotic + zero waste + limit",
    configure((c) => {
      c.selectedExotics = [FORCE_USE_NO_EXOTIC];
      c.tryLimitWastedStats = true;
      c.statModLimits = { maxMods: 3, maxMajorMods: 2 };
      tier(c, ArmorStat.StatHealth, 8);
    }),
  ],
  [
    "requirements",
    configure((c) => {
      c.armorRequirements = [{ perk: ArmorPerkOrSlot.SlotArtifice }, { gearSetHash: 7000 }];
      tier(c, ArmorStat.StatGrenade, 7);
    }),
  ],
];

function fnv(text: string): string {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(16);
}

async function run(config: BuildConfiguration, items: IPermutatorArmor[]) {
  const worker = new Worker(new URL("./results-builder.worker", import.meta.url), {
    type: "module",
  });
  const sets: any[] = [];
  let last: any = null;
  const finished = new Promise<void>((resolve, reject) => {
    worker.onmessage = ({ data }) => {
      if (data.packed) sets.push(...unpackArmorSets(data.packed));
      if (data.done) {
        last = data;
        resolve();
      }
    };
    worker.onerror = (event) => reject(new Error(event.message));
  });
  worker.postMessage({
    type: "builderRequest",
    currentClass: DestinyClass.Titan,
    config: JSON.parse(JSON.stringify(config)),
    threadSplit: { count: 1, current: 0 },
    items,
    selectedExotics: [],
  });
  await finished;
  worker.terminate();
  return { sets, last };
}

// Golden signatures recorded from the unoptimized worker; any optimization must reproduce them.
const EXPECTED: Record<string, string> = {
  "1 any exotic":
    "count=2560 hash=ba848aae checked=2560/2560 computed=2560 tiers=188,200,200,184,198,182",
  "1 fixed":
    "count=3526 hash=d39ae41 checked=3584/3584 computed=3526 tiers=178,199,200,175,189,103",
  "1 high targets":
    "count=675 hash=8b64fd56 checked=3584/3584 computed=675 tiers=130,145,147,126,140,155",
  "1 no exotic + zero waste + limit":
    "count=1024 hash=b24134ad checked=1024/1024 computed=1024 tiers=168,174,190,151,164,128",
  "1 no targets":
    "count=3584 hash=fa5ca24d checked=3584/3584 computed=3584 tiers=200,200,200,190,200,182",
  "1 no tuning + const health":
    "count=3584 hash=d526dd5b checked=3584/3584 computed=3584 tiers=200,199,200,170,189,174",
  "1 requirements":
    "count=970 hash=2c903dc0 checked=3584/3584 computed=970 tiers=187,200,200,190,183,179",
  "1 targets":
    "count=3584 hash=9f9932f1 checked=3584/3584 computed=3584 tiers=175,200,200,174,189,179",
  "2 any exotic":
    "count=2560 hash=ad3fa54e checked=2560/2560 computed=2560 tiers=171,170,193,188,194,200",
  "2 fixed":
    "count=2349 hash=5e313445 checked=3584/3584 computed=2349 tiers=167,160,185,183,186,109",
  "2 high targets":
    "count=1233 hash=659db251 checked=3584/3584 computed=1233 tiers=135,106,158,141,157,184",
  "2 no exotic + zero waste + limit":
    "count=1024 hash=d5b3feca checked=1024/1024 computed=1024 tiers=144,130,156,174,146,165",
  "2 no targets":
    "count=3584 hash=75a56ba2 checked=3584/3584 computed=3584 tiers=185,173,193,200,194,200",
  "2 no tuning + const health":
    "count=3149 hash=98db5c16 checked=3584/3584 computed=3149 tiers=166,163,167,173,187,172",
  "2 requirements":
    "count=1964 hash=cb18b916 checked=3584/3584 computed=1964 tiers=185,161,191,198,194,200",
  "2 targets":
    "count=3561 hash=fb65486f checked=3584/3584 computed=3561 tiers=172,162,192,183,191,200",
};

describe("results builder worker equivalence", () => {
  for (const seed of [1, 2]) {
    for (const [name, config] of CONFIGS) {
      it(`${name} seed ${seed}`, async () => {
        const { sets, last } = await run(config, makeItems(seed));
        const signature = sets
          .map((s) => `${s.armor.join(",")}|${s.statsWithMods.join(",")}|${s.usedMods.join(",")}`)
          .join(";");
        expect(
          `count=${sets.length} hash=${fnv(signature)} checked=${last.checkedCalculations}/${last.estimatedCalculations} computed=${last.computedPermutations} tiers=${last.runtime.maximumPossibleTiers.join(",")}`
        ).toBe(EXPECTED[`${seed} ${name}`]);
      }, 120000);
    }
  }
});
