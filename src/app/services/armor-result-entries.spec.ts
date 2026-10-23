import { compareResultEntries, mergeResultEntries, ResultEntry } from "./armor-result-entries";

function entry(overrides: Partial<ResultEntry>): ResultEntry {
  return {
    set: {} as ResultEntry["set"],
    key: "",
    total: 0,
    gearSetRank: 0,
    sharedHash: "",
    modCount: 0,
    modCost: 0,
    masterworkedCount: 0,
    power: 0,
    definition: {} as ResultEntry["definition"],
    ...overrides,
  };
}

describe("armor result entries", () => {
  it("orders by total stats, gear set rank, then shared hash", () => {
    const sorted = [
      entry({ key: "c", total: 10, sharedHash: "b" }),
      entry({ key: "a", total: 12 }),
      entry({ key: "d", total: 10, sharedHash: "a" }),
      entry({ key: "b", total: 10, gearSetRank: 2, sharedHash: "z" }),
    ].sort(compareResultEntries);

    expect(sorted.map((e) => e.key)).toEqual(["a", "b", "d", "c"]);
  });

  it("merges two sorted lists like a stable sort of their concatenation", () => {
    const first = [entry({ key: "a1", total: 9 }), entry({ key: "a2", total: 5 })];
    const second = [entry({ key: "b1", total: 9 }), entry({ key: "b2", total: 7 })];

    expect(mergeResultEntries(first, second).map((e) => e.key)).toEqual(["a1", "b1", "b2", "a2"]);
    expect(mergeResultEntries(first, [])).toBe(first);
    expect(mergeResultEntries([], second)).toBe(second);
  });
});
