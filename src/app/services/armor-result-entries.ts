import type {
  ResultDefinition,
  ResultItem,
} from "../components/authenticated-v2/results/results.component";
import type { ArmorSlot } from "../data/enum/armor-slot";
import { STAT_MOD_VALUES, StatModifier } from "../data/enum/armor-stat";
import { MAXIMUM_MASTERWORK_LEVEL } from "../data/constants";
import { IInventoryArmor, InventoryArmorSource } from "../data/types/IInventoryArmor";
import type { IPermutatorArmorSet } from "../data/types/IPermutatorArmorSet";
import { getSkillTier, getWaste } from "./results-builder.worker";

/** A worker result plus everything the table needs, computed once when it arrives. */
export interface ResultEntry {
  set: IPermutatorArmorSet;
  /** Sorted item ids; identifies the same armor combination across runs. */
  key: string;
  total: number;
  gearSetRank: number;
  sharedHash: string;
  modCount: number;
  modCost: number;
  masterworkedCount: number;
  power: number;
  definition: ResultDefinition;
}

export function getSharedArmorHash(
  items: readonly IInventoryArmor[],
  excludedSlots: ReadonlySet<ArmorSlot>
): string {
  return items
    .filter((item) => !item.isExotic && !excludedSlots.has(item.slot))
    .map((item) => item.itemInstanceId)
    .sort()
    .join("|");
}

function gearSetRank(items: readonly IInventoryArmor[]): number {
  const gearSetCounts = new Map<number, number>();
  let selectableItems = 0;

  for (const item of items) {
    if (item.gearSetPerkSelectable) selectableItems++;
    if (item.gearSetHash != null) {
      gearSetCounts.set(item.gearSetHash, (gearSetCounts.get(item.gearSetHash) ?? 0) + 1);
    }
  }

  const counts = Array.from(gearSetCounts.values());
  if (Math.max(0, ...counts) + selectableItems >= 4) return 3;

  const pairDeficits = [...counts.map((count) => Math.max(0, 2 - count)), 2, 2].sort(
    (a, b) => a - b
  );
  if (pairDeficits[0] + pairDeficits[1] <= selectableItems) return 2;
  if (pairDeficits[0] <= selectableItems) return 1;
  return 0;
}

export function buildResultEntry(
  armorSet: IPermutatorArmorSet,
  inventoryById: ReadonlyMap<number, IInventoryArmor>,
  excludedSlots: ReadonlySet<ArmorSlot>
): ResultEntry {
  const items = armorSet.armor.map((id) => inventoryById.get(id)) as IInventoryArmor[];
  const exotic = items.find((item) => item.isExotic);
  const sharedHash = getSharedArmorHash(items, excludedSlots);
  const modCost = armorSet.usedMods.reduce(
    (sum, mod: StatModifier) => sum + STAT_MOD_VALUES[mod][2],
    0
  );
  let total = 0;
  for (const value of armorSet.statsWithMods) total += value;
  let masterworkedCount = 0;
  let power = 0;
  for (const item of items) {
    if (item.masterworkLevel === MAXIMUM_MASTERWORK_LEVEL) masterworkedCount++;
    power += item.powerLevel ?? 0;
  }

  const definition: ResultDefinition = {
    loaded: false,
    sharedArmorHash: sharedHash,
    sharedBuildCount: 1,
    tuningStats: armorSet.tuning,
    exotic:
      exotic == null
        ? undefined
        : {
            icon: exotic.icon,
            watermark: exotic.watermarkIcon,
            name: exotic.name,
            hash: exotic.hash,
          },
    artifice: armorSet.usedArtifice,
    tuningMods: armorSet.usedTuningMods,
    modCount: armorSet.usedMods.length,
    modCost,
    mods: armorSet.usedMods,
    stats: armorSet.statsWithMods,
    statsNoMods: armorSet.statsWithoutMods,
    tiers: getSkillTier(armorSet.statsWithMods),
    waste: getWaste(armorSet.statsWithMods),
    items: items.map(
      (instance): ResultItem => ({
        tuningStat: instance.tuningStat,
        energyLevel: instance.energyLevel,
        powerLevel: instance.powerLevel,
        hash: instance.hash,
        itemInstanceId: instance.itemInstanceId,
        gearSetHash: instance.gearSetHash,
        name: instance.name,
        exotic: !!instance.isExotic,
        exoticPerkHash: instance.exoticPerkHash,
        masterworked: instance.masterworkLevel == MAXIMUM_MASTERWORK_LEVEL,
        archetypeStats: instance.archetypeStats,
        armorSystem: instance.armorSystem,
        masterworkLevel: instance.masterworkLevel,
        slot: instance.slot,
        perk: instance.perk,
        transferState: 0,
        tier: instance.tier,
        stats: [
          instance.resilience,
          instance.strength,
          instance.discipline,
          instance.intellect,
          instance.recovery,
          instance.mobility,
        ],
        source: instance.source,
        statsNoMods: [],
      })
    ),
    usesCollectionRoll: items.some((item) => item.source === InventoryArmorSource.Collections),
    usesVendorRoll: items.some((item) => item.source === InventoryArmorSource.Vendor),
  };

  return {
    set: armorSet,
    key: [...armorSet.armor].sort((a, b) => a - b).join(","),
    total,
    gearSetRank: gearSetRank(items),
    sharedHash,
    modCount: armorSet.usedMods.length,
    modCost,
    masterworkedCount,
    power,
    definition,
  };
}

export function compareResultEntries(a: ResultEntry, b: ResultEntry): number {
  if (a.total !== b.total) return b.total - a.total;
  if (a.gearSetRank !== b.gearSetRank) return b.gearSetRank - a.gearSetRank;
  if (a.sharedHash !== b.sharedHash) return a.sharedHash < b.sharedHash ? -1 : 1;
  if (a.modCount !== b.modCount) return a.modCount - b.modCount;
  if (a.modCost !== b.modCost) return a.modCost - b.modCost;
  if (a.masterworkedCount !== b.masterworkedCount) return b.masterworkedCount - a.masterworkedCount;
  return b.power - a.power;
}

/** Merges two sorted lists; ties keep the entries of `a` first, like a stable sort of a + b. */
export function mergeResultEntries(a: ResultEntry[], b: ResultEntry[]): ResultEntry[] {
  if (b.length === 0) return a;
  if (a.length === 0) return b;
  const merged = new Array<ResultEntry>(a.length + b.length);
  let i = 0;
  let j = 0;
  let k = 0;
  while (i < a.length && j < b.length) {
    merged[k++] = compareResultEntries(a[i], b[j]) <= 0 ? a[i++] : b[j++];
  }
  while (i < a.length) merged[k++] = a[i++];
  while (j < b.length) merged[k++] = b[j++];
  return merged;
}

export function updateSharedBuildCounts(results: ResultDefinition[]): void {
  const counts = new Map<string, number>();
  for (const result of results) {
    const hash = result.sharedArmorHash ?? "";
    counts.set(hash, (counts.get(hash) ?? 0) + 1);
  }
  for (const result of results) {
    result.sharedBuildCount = counts.get(result.sharedArmorHash ?? "") ?? 1;
  }
}
