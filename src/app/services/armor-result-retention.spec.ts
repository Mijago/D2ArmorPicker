import { BuildConfiguration } from "../data/buildConfiguration";
import { ArmorPerkOrSlot, ArmorStat, StatModifier } from "../data/enum/armor-stat";
import { FORCE_USE_NO_EXOTIC } from "../data/constants";
import type { IPermutatorArmor } from "../data/types/IPermutatorArmor";
import type { ResultEntry } from "./armor-result-entries";
import { resultsRemainComparable, retainMatchingResults } from "./armor-result-retention";

function piece(id: number, isExotic = 0): IPermutatorArmor {
  return {
    id,
    isExotic,
    perk: ArmorPerkOrSlot.Any,
    masterworkLevel: 5,
    tuningStat: null,
    gearSetHash: null,
    resilience: 10,
    strength: 10,
    discipline: 10,
    intellect: 10,
    recovery: 10,
    mobility: 10,
  } as unknown as IPermutatorArmor;
}

function entry(ids: number[], stats: number[], mods: StatModifier[] = []): ResultEntry {
  return {
    set: { armor: ids },
    key: ids.join(","),
    definition: {
      stats,
      mods,
      waste: 0,
      items: ids.map((id) => ({
        perk: ArmorPerkOrSlot.Any,
        masterworkLevel: 5,
        tuningStat: null,
        gearSetHash: null,
        stats: [10, 10, 10, 10, 10, 10],
      })),
    },
  } as unknown as ResultEntry;
}

describe("armor result retention", () => {
  const pool = new Map([1, 2, 3, 4, 5].map((id) => [id, piece(id, id === 5 ? 1 : 0)]));
  const stats = [100, 80, 60, 60, 60, 60];
  const previous = new BuildConfiguration();

  function retained(entries: ResultEntry[], change: (config: BuildConfiguration) => void) {
    const config = JSON.parse(JSON.stringify(previous)) as BuildConfiguration;
    change(config);
    return retainMatchingResults(entries, previous, config, pool);
  }

  it("keeps results that still satisfy raised stat targets and drops the rest", () => {
    const low = entry([1, 2, 3, 4, 5], [100, 80, 60, 60, 60, 60]);
    const high = entry([1, 2, 3, 4, 5], [120, 80, 60, 60, 60, 60]);

    expect(
      retained([high, low], (c) => (c.minimumStatTiers[ArmorStat.StatHealth].value = 11))
    ).toEqual([high]);
  });

  it("applies locked stats as an exact tier", () => {
    const result = entry([1, 2, 3, 4, 5], stats);

    expect(
      retained(
        [result],
        (c) => (c.minimumStatTiers[ArmorStat.StatHealth] = { value: 10, fixed: true })
      )
    ).toEqual([result]);
    expect(
      retained(
        [result],
        (c) => (c.minimumStatTiers[ArmorStat.StatHealth] = { value: 9, fixed: true })
      )
    ).toEqual([]);
  });

  it("drops everything when a setting that changes stats differs", () => {
    const result = entry([1, 2, 3, 4, 5], stats);

    expect(retained([result], (c) => (c.addConstent1Health = true))).toEqual([]);
    expect(retained([result], (c) => (c.assumeExoticsMasterworked = false))).toEqual([]);
    expect(resultsRemainComparable(previous, previous)).toBeTrue();
  });

  it("enforces the exotic selection", () => {
    const result = entry([1, 2, 3, 4, 5], stats);

    expect(retained([result], (c) => (c.selectedExotics = [FORCE_USE_NO_EXOTIC]))).toEqual([]);
  });

  it("enforces mod limits", () => {
    const result = entry([1, 2, 3, 4, 5], stats, [
      StatModifier.MAJOR_HEALTH,
      StatModifier.MINOR_MELEE,
    ]);

    expect(retained([result], (c) => (c.statModLimits = { maxMods: 1, maxMajorMods: 1 }))).toEqual(
      []
    );
    expect(retained([result], (c) => (c.statModLimits = { maxMods: 2, maxMajorMods: 1 }))).toEqual([
      result,
    ]);
  });

  it("drops results whose armor left the pool or changed", () => {
    const missing = entry([1, 2, 3, 4, 99], stats);
    const changed = entry([1, 2, 3, 4, 5], stats);
    changed.definition.items[0].stats = [11, 10, 10, 10, 10, 10];

    expect(retained([missing, changed], () => {})).toEqual([]);
  });

  it("applies the result limit", () => {
    const first = entry([1, 2, 3, 4, 5], stats);
    const second = entry([1, 2, 3, 4, 5], stats);

    expect(retained([first, second], (c) => (c.parsedResultLimit = 1))).toEqual([first]);
  });
});
