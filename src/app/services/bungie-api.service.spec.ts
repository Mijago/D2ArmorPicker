import { collectInvestmentStats } from "./bungie-api.service";
import { ArmorSlot } from "../data/enum/armor-slot";
import { ArmorStat } from "../data/enum/armor-stat";
import { ArmorSystem } from "../data/types/IManifestArmor";

// Socket types (same on Solipsism, Relativism and Stoicism); array index is the socket position.
const SPIRIT_1 = 4039767041;
const SPIRIT_2 = 2771980068;
const TUNING_SOCKET = 2581339086;
const THIRD_STAT_SOCKET = 3303600813;
const CLASS_ITEM_SOCKET_TYPES: number[] = [];
CLASS_ITEM_SOCKET_TYPES[6] = TUNING_SOCKET;
CLASS_ITEM_SOCKET_TYPES[10] = SPIRIT_1;
CLASS_ITEM_SOCKET_TYPES[11] = SPIRIT_2;
CLASS_ITEM_SOCKET_TYPES[15] = THIRD_STAT_SOCKET;

/**
 * Real-data verification that removing the legacy "+13 to the 3rd-highest stat" hack for
 * exotic class items is correct. Values below are pulled verbatim from the LIVE Bungie
 * manifest (Stoicism 266021826):
 *   - The class item carries NO armor stats on the item itself.
 * All armor stats come from the two "Spirit of..." perks (identified by socket type).
 *     Spirit of Severance (3573490509): Melee 30, Health 25
 *     Spirit of the Bear  (3573490505): Grenade 30, Super 25
 * collectInvestmentStats special-cases exotic class items and sums only the stat sockets,
 * so the stats are derived purely from the perks — no +13 anywhere.
 *
 * Field mapping (applyInvestmentStats): mobility=Weapons, resilience=Health, recovery=Class,
 * discipline=Grenade, intellect=Super, strength=Melee.
 */
describe("collectInvestmentStats — exotic class item (real manifest data)", () => {
  const SEVERANCE = 3573490509;
  const BEAR = 3573490505;
  const mods: any = {
    [SEVERANCE]: {
      investmentStats: [
        { statTypeHash: 4244567218, value: 30 }, // Melee
        { statTypeHash: 392767087, value: 25 }, // Health
      ],
    },
    [BEAR]: {
      investmentStats: [
        { statTypeHash: 1735777505, value: 30 }, // Grenade
        { statTypeHash: 144602215, value: 25 }, // Super
      ],
    },
  };

  function makeClassItem(): any {
    return {
      isExotic: 1,
      slot: ArmorSlot.ArmorSlotClass,
      mobility: 0,
      resilience: 0,
      recovery: 0,
      discipline: 0,
      intellect: 0,
      strength: 0,
      archetypeStats: [],
    };
  }

  it("derives class-item stats purely from the Spirit perks — no +13 inflation", () => {
    const item = makeClassItem();
    // the two Spirit perks live in the Spirit-type sockets
    const plugHashes: (number | undefined)[] = [];
    plugHashes[10] = SEVERANCE;
    plugHashes[11] = BEAR;

    collectInvestmentStats(item, [], plugHashes, mods, CLASS_ITEM_SOCKET_TYPES);

    expect(item.mobility).toBe(0); // Weapons
    expect(item.resilience).toBe(25); // Health  (Severance)
    expect(item.recovery).toBe(0); // Class
    expect(item.discipline).toBe(30); // Grenade (Bear)
    expect(item.intellect).toBe(25); // Super   (Bear)
    expect(item.strength).toBe(30); // Melee   (Severance)

    // The removed legacy hack added +13 to the 3rd-highest base stat (25 -> 38 here),
    // which would NOT match the real manifest stats. Confirm no such inflation occurs.
    const stats = [
      item.mobility,
      item.resilience,
      item.recovery,
      item.discipline,
      item.intellect,
      item.strength,
    ];
    expect(stats).not.toContain(38);
    expect(stats.reduce((a, b) => a + b, 0)).toBe(110); // 30+25+30+25, exactly the perk sum
  });

  it("ignores the +13 even with a single stat-bearing perk (no archetype overshoot)", () => {
    const item = makeClassItem();
    const plugHashes: (number | undefined)[] = [];
    plugHashes[10] = SEVERANCE; // only one perk contributes stats
    collectInvestmentStats(item, [], plugHashes, mods, CLASS_ITEM_SOCKET_TYPES);

    expect(item.strength).toBe(30); // Melee
    expect(item.resilience).toBe(25); // Health
    expect(item.mobility + item.recovery + item.discipline + item.intellect).toBe(0);
  });

  it("ignores an equipped tuning mod in the tuning socket", () => {
    const TUNING = 388618952; // Health +5, Melee -5
    const modsWithTuning = {
      ...mods,
      [TUNING]: {
        investmentStats: [
          { statTypeHash: 392767087, value: 5 },
          { statTypeHash: 4244567218, value: -5 },
        ],
      },
    };
    const item = makeClassItem();
    const plugHashes: (number | undefined)[] = [];
    plugHashes[6] = TUNING;
    plugHashes[10] = SEVERANCE;
    plugHashes[11] = BEAR;
    collectInvestmentStats(item, [], plugHashes, modsWithTuning, CLASS_ITEM_SOCKET_TYPES);

    expect(item.resilience).toBe(25);
    expect(item.strength).toBe(30);
  });

  it("reads the rolled third stat from the third-stat socket (Solipsism 6917530039089023174)", () => {
    const INMOST_LIGHT = 1476923953; // Super 30, Melee 25
    const HEALTH_20 = 465064626;
    const modsWithThird: any = {
      [INMOST_LIGHT]: {
        investmentStats: [
          { statTypeHash: 144602215, value: 30 },
          { statTypeHash: 4244567218, value: 25 },
        ],
      },
      [HEALTH_20]: { investmentStats: [{ statTypeHash: 392767087, value: 20 }] },
    };
    const item = makeClassItem();
    const plugHashes: (number | undefined)[] = [];
    plugHashes[6] = 3122197216; // balanced tuning, ignored
    plugHashes[10] = INMOST_LIGHT;
    plugHashes[11] = 183430247; // Spirit of the Claw, no stats
    plugHashes[15] = HEALTH_20;
    collectInvestmentStats(item, [], plugHashes, modsWithThird, CLASS_ITEM_SOCKET_TYPES);

    expect(item.resilience).toBe(20);
    expect(item.strength).toBe(25);
    expect(item.intellect).toBe(30);
    expect(item.mobility + item.recovery + item.discipline).toBe(0);
    expect(item.archetypeStats).toEqual([
      ArmorStat.StatHealth,
      ArmorStat.StatMelee,
      ArmorStat.StatSuper,
    ]);
  });
});

describe("collectInvestmentStats - Armor 2.0 stat sockets", () => {
  const TOP_STATS = 3135249387;
  const BOTTOM_STATS = 2819908046;
  const BONUS = 1;
  const mods: any = {
    [TOP_STATS]: {
      investmentStats: [
        { statTypeHash: 2996146975, value: 5 },
        { statTypeHash: 1943323491, value: 5 },
        { statTypeHash: 392767087, value: 1 },
      ],
    },
    [BOTTOM_STATS]: {
      investmentStats: [
        { statTypeHash: 1735777505, value: 1 },
        { statTypeHash: 144602215, value: 1 },
        { statTypeHash: 4244567218, value: 11 },
      ],
    },
    [BONUS]: { investmentStats: [{ statTypeHash: 392767087, value: 10 }] },
  };

  it("reads randomized rolls by type outside indices 6-9 and excludes bonus sockets", () => {
    const item: any = { archetypeStats: [] };
    collectInvestmentStats(
      item,
      [{ statTypeHash: 392767087, value: 3, isConditionallyActive: false }],
      [TOP_STATS, BONUS, BOTTOM_STATS, TOP_STATS, BOTTOM_STATS, BONUS, BONUS],
      mods,
      [1119034468, 1718047805, 3833399976, 1119034469, 3833399977, 210031694, 3982822385]
    );

    expect(item.statPlugHashes).toEqual([TOP_STATS, BOTTOM_STATS, TOP_STATS, BOTTOM_STATS]);
    expect([item.mobility, item.resilience, item.recovery]).toEqual([10, 5, 10]);
    expect([item.discipline, item.intellect, item.strength]).toEqual([2, 2, 22]);
  });

  it("includes every fixed-roll socket even when types and plugs repeat", () => {
    const item: any = { archetypeStats: [ArmorStat.StatHealth] };
    collectInvestmentStats(
      item,
      [],
      [TOP_STATS, TOP_STATS, BOTTOM_STATS, BOTTOM_STATS],
      mods,
      [1489351422, 1489351422, 1489351422, 1489351422]
    );

    expect(item.statPlugHashes.length).toBe(4);
    expect(item.archetypeStats).toEqual([]);
    expect([item.mobility, item.resilience, item.recovery]).toEqual([10, 2, 10]);
    expect([item.discipline, item.intellect, item.strength]).toEqual([2, 2, 22]);
  });

  it("does not use positional fallback for unknown or missing socket types", () => {
    for (const types of [[], [0, 0, 0, 0, 0, 0, 4165668032, 0, 0, 0]]) {
      for (const armorSystem of [ArmorSystem.Armor2, ArmorSystem.Armor3]) {
        const item: any = { armorSystem, archetypeStats: [] };
        collectInvestmentStats(
          item,
          [],
          [
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            BONUS,
            BONUS,
            BONUS,
            BONUS,
          ],
          mods,
          types
        );

        expect(item.statPlugHashes).toEqual([]);
        expect(item.resilience).toBe(0);
      }
    }
  });

  it("falls back to indices 6-9 for Armor 1.0 without recognized stat sockets", () => {
    const item: any = { armorSystem: ArmorSystem.Armor1, archetypeStats: [] };
    const plugs = [BONUS, BONUS, BONUS, BONUS, BONUS, BONUS, TOP_STATS, undefined, BOTTOM_STATS];

    collectInvestmentStats(item, [], plugs, mods, []);

    expect(item.statPlugHashes).toEqual([TOP_STATS, undefined, BOTTOM_STATS, undefined]);
    expect([item.mobility, item.resilience, item.recovery]).toEqual([5, 1, 5]);
    expect([item.discipline, item.intellect, item.strength]).toEqual([1, 1, 11]);
  });

  it("prefers recognized stat sockets over the Armor 1.0 positional fallback", () => {
    const item: any = { armorSystem: ArmorSystem.Armor1, archetypeStats: [] };

    collectInvestmentStats(
      item,
      [],
      [TOP_STATS, undefined, undefined, undefined, undefined, undefined, BONUS],
      mods,
      [1489351422]
    );

    expect(item.statPlugHashes).toEqual([TOP_STATS]);
    expect(item.resilience).toBe(1);
  });
});

describe("collectInvestmentStats — legendary Armor 3.0 stat sockets", () => {
  it("sums stat sockets by socket type and ignores the tuning socket at index 11", () => {
    const mods: any = {
      1: { investmentStats: [{ statTypeHash: 144602215, value: 30 }] }, // Super
      2: { investmentStats: [{ statTypeHash: 4244567218, value: 25 }] }, // Melee
      3: { investmentStats: [{ statTypeHash: 392767087, value: 20 }] }, // Health
      4: { investmentStats: [{ statTypeHash: 392767087, value: 5 }] }, // tuning
    };
    const item: any = { isExotic: 0, slot: ArmorSlot.ArmorSlotHelmet, archetypeStats: [] };
    const types: number[] = [];
    types[6] = 2104613635;
    types[7] = 1271523453;
    types[8] = 2212837421;
    types[9] = 3303600813;
    types[11] = TUNING_SOCKET;
    const plugs: (number | undefined)[] = [];
    plugs[7] = 1;
    plugs[8] = 2;
    plugs[9] = 3;
    plugs[11] = 4;
    collectInvestmentStats(item, [], plugs, mods, types);

    expect(item.resilience).toBe(20);
    expect(item.strength).toBe(25);
    expect(item.intellect).toBe(30);
  });
});
