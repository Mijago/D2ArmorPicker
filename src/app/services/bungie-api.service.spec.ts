import { collectInvestmentStats } from "./bungie-api.service";
import { ArmorSlot } from "../data/enum/armor-slot";

/**
 * Real-data verification that removing the legacy "+13 to the 3rd-highest stat" hack for
 * exotic class items is correct. Values below are pulled verbatim from the LIVE Bungie
 * manifest (Stoicism 266021826):
 *   - The class item carries NO armor stats on the item itself.
 *   - All armor stats come from the two "Spirit of..." perks at socket indices 10 & 11.
 *     Spirit of Severance (3573490509): Melee 30, Health 25
 *     Spirit of the Bear  (3573490505): Grenade 30, Super 25
 * collectInvestmentStats already special-cases exotic class items and sums plug indices
 * 10 & 11, so the stats are derived purely from the perks — no +13 anywhere.
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
    // stat-mod sockets 6-9 empty; the two Spirit perks live at indices 10 & 11
    const plugHashes: (number | undefined)[] = [];
    plugHashes[10] = SEVERANCE;
    plugHashes[11] = BEAR;

    collectInvestmentStats(item, [], plugHashes, mods);

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
    collectInvestmentStats(item, [], plugHashes, mods);

    expect(item.strength).toBe(30); // Melee
    expect(item.resilience).toBe(25); // Health
    expect(item.mobility + item.recovery + item.discipline + item.intellect).toBe(0);
  });
});
