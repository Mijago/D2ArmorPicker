import {
  ARMOR3_ARCHETYPE_PLUG_CATEGORY,
  ARMOR3_ARCHETYPE_PLUG_CATEGORY_HASH,
  ARMOR3_TUNING_PLUG_CATEGORY,
  ARMOR3_TUNING_PLUG_CATEGORY_HASH,
  detectArmor3Sockets,
} from "./IManifestArmor";

// Build a plug resolver from a { hash: plugDef } map (mirrors the manifest item table).
function resolver(map: Record<number, any>) {
  return (h: number | undefined) => (h == null ? undefined : map[h]);
}

describe("detectArmor3Sockets", () => {
  it("flags the tuning slot via the stable plugCategoryIdentifier string", () => {
    const map = { 10: { plug: { plugCategoryIdentifier: ARMOR3_TUNING_PLUG_CATEGORY } } };
    expect(detectArmor3Sockets([{ singleInitialItemHash: 10 }], resolver(map))).toEqual({
      hasArchetypeSocket: false,
      hasTuningSlot: true,
    });
  });

  it("flags the archetype slot via the stable plugCategoryIdentifier string", () => {
    const map = { 20: { plug: { plugCategoryIdentifier: ARMOR3_ARCHETYPE_PLUG_CATEGORY } } };
    expect(detectArmor3Sockets([{ singleInitialItemHash: 20 }], resolver(map))).toEqual({
      hasArchetypeSocket: true,
      hasTuningSlot: false,
    });
  });

  it("falls back to plugCategoryHash when the identifier is absent", () => {
    const map = {
      10: { plug: { plugCategoryHash: ARMOR3_TUNING_PLUG_CATEGORY_HASH } },
      20: { plug: { plugCategoryHash: ARMOR3_ARCHETYPE_PLUG_CATEGORY_HASH } },
    };
    expect(
      detectArmor3Sockets(
        [{ singleInitialItemHash: 10 }, { singleInitialItemHash: 20 }],
        resolver(map)
      )
    ).toEqual({ hasArchetypeSocket: true, hasTuningSlot: true });
  });

  it("ignores unrelated plugs, unresolved hashes, and empty/undefined socket lists", () => {
    const map = { 30: { plug: { plugCategoryIdentifier: "shaders" } } };
    expect(detectArmor3Sockets([{ singleInitialItemHash: 30 }], resolver(map))).toEqual({
      hasArchetypeSocket: false,
      hasTuningSlot: false,
    });
    expect(detectArmor3Sockets([{ singleInitialItemHash: 999 }], resolver(map))).toEqual({
      hasArchetypeSocket: false,
      hasTuningSlot: false,
    });
    expect(detectArmor3Sockets([], resolver(map))).toEqual({
      hasArchetypeSocket: false,
      hasTuningSlot: false,
    });
    expect(detectArmor3Sockets(undefined, resolver(map))).toEqual({
      hasArchetypeSocket: false,
      hasTuningSlot: false,
    });
  });
});
