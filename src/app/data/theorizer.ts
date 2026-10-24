import { ArmorSlot } from "./enum/armor-slot";
import { ArmorStat } from "./enum/armor-stat";
import { BuildConfiguration } from "./buildConfiguration";
import { ModInformation } from "./ModInformation";
import { SubclassNames } from "./enum/modifierType";
import { IInventoryArmor } from "./types/IInventoryArmor";
import { IManifestArmor } from "./types/IManifestArmor";
import { IPermutatorArmor } from "./types/IPermutatorArmor";
import { IPermutatorArmorSet } from "./types/IPermutatorArmorSet";

export interface T5Archetype {
  readonly name: string;
  readonly primary: ArmorStat;
  readonly secondary: ArmorStat;
}

export const T5_ARCHETYPES: readonly T5Archetype[] = [
  { name: "Siegebreaker", primary: ArmorStat.StatHealth, secondary: ArmorStat.StatGrenade },
  { name: "Bulwark", primary: ArmorStat.StatHealth, secondary: ArmorStat.StatClass },
  { name: "Brawler", primary: ArmorStat.StatMelee, secondary: ArmorStat.StatHealth },
  { name: "Skrimisher", primary: ArmorStat.StatMelee, secondary: ArmorStat.StatWeapon },
  { name: "Grenedier", primary: ArmorStat.StatGrenade, secondary: ArmorStat.StatSuper },
  { name: "Demolitionist", primary: ArmorStat.StatGrenade, secondary: ArmorStat.StatClass },
  { name: "Colossus", primary: ArmorStat.StatSuper, secondary: ArmorStat.StatHealth },
  { name: "Paragon", primary: ArmorStat.StatSuper, secondary: ArmorStat.StatMelee },
  { name: "Reaver", primary: ArmorStat.StatClass, secondary: ArmorStat.StatMelee },
  { name: "Specialist", primary: ArmorStat.StatClass, secondary: ArmorStat.StatWeapon },
  { name: "Gunner", primary: ArmorStat.StatWeapon, secondary: ArmorStat.StatGrenade },
  { name: "Powerhouse", primary: ArmorStat.StatWeapon, secondary: ArmorStat.StatSuper },
];

export function suggestedT5RunName(config: BuildConfiguration): string {
  const statTargets = (
    Object.values(ArmorStat).filter((value) => typeof value === "number") as ArmorStat[]
  ).map((stat) => {
    const target = config.minimumStatTiers[stat];
    return `${target.value * 10}${target.fixed ? "*" : ""}`;
  });
  const modifiers = [...new Set(config.enabledMods)]
    .map((id) => ModInformation[id])
    .filter((modifier) => modifier?.type === config.selectedModElement)
    .map((modifier) => modifier.name);
  const subclass =
    (SubclassNames as Record<number, string>)[config.selectedModElement] ?? "Subclass";
  const maximumMajor = Math.min(config.statModLimits.maxMods, config.statModLimits.maxMajorMods);
  return [
    statTargets.join("/"),
    `Mods max ${config.statModLimits.maxMods} (${maximumMajor} major)`,
    `${subclass}: ${modifiers.length ? modifiers.join(", ") : "No modifiers"}`,
  ]
    .join(" | ")
    .slice(0, 120);
}

export function t5Tertiaries(archetype: T5Archetype): ArmorStat[] {
  return [0, 1, 2, 3, 4, 5].filter(
    (stat) => stat !== archetype.primary && stat !== archetype.secondary
  );
}

export function t5BaseStats(archetype: T5Archetype, tertiary: ArmorStat): number[] {
  if (!t5Tertiaries(archetype).includes(tertiary)) {
    throw new Error("The tertiary stat must be outside the archetype pair.");
  }
  const stats = [0, 0, 0, 0, 0, 0];
  stats[archetype.primary] = 30;
  stats[archetype.secondary] = 25;
  stats[tertiary] = 20;
  return stats;
}

export function t5ArchetypeIndex(stats: readonly number[]): number {
  return T5_ARCHETYPES.findIndex(
    (archetype) => stats[archetype.primary] === 30 && stats[archetype.secondary] === 25
  );
}

// Legendary and non-class exotic T5 armor is always 30/25/20 on three stats. Exotic class items
// take their stats from spirit perks, so only the 30/25 archetype pair is required.
export function hasLegalT5Shape(item: {
  resilience: number;
  strength: number;
  discipline: number;
  intellect: number;
  recovery: number;
  mobility: number;
  isExotic: number;
  slot: ArmorSlot;
}): boolean {
  const stats = [
    item.resilience,
    item.strength,
    item.discipline,
    item.intellect,
    item.recovery,
    item.mobility,
  ];
  if (t5ArchetypeIndex(stats) < 0) return false;
  if (item.isExotic && item.slot === ArmorSlot.ArmorSlotClass) return true;
  return (
    stats.filter((value) => value === 20).length === 1 &&
    stats.filter((value) => value === 0).length === 3
  );
}

export interface T5Candidate extends IPermutatorArmor {
  hypotheticalTuning?: boolean;
  /** Discovery-only roll whose tertiary is unknown, so it carries the worst-case stats of every tertiary. */
  anyTertiary?: boolean;
  name: string;
  icon: string;
  archetype: string;
  tertiary: ArmorStat | null;
  instanceId: string | null;
}

export const T5_TUNING_HASHES = [
  [0, 388618952, 3681082702, 4088823605, 3310526732, 2125798995],
  [4164883102, 0, 534630542, 311164277, 4210715468, 4020349587],
  [455024236, 309000506, 0, 1672416975, 1922571986, 4116389173],
  [4026414261, 673231129, 3946669007, 0, 3554800389, 2244422610],
  [4030660414, 1510949672, 1879022254, 957763733, 0, 323635379],
  [3121760799, 691392383, 3284443097, 891771298, 1918710127, 0],
];

export function t5TuningFamily(hash: number | null | undefined): ArmorStat | null {
  if (!hash || hash === 3122197216) return null;
  const stat = T5_TUNING_HASHES.findIndex((row) => row.includes(hash));
  return stat < 0 ? null : (stat as ArmorStat);
}

export interface T5Solution {
  key: string;
  pieces: T5Candidate[];
  result: IPermutatorArmorSet;
  tuningMods: (number | null)[];
  covered: number;
  owned: number;
  patternKey?: string;
  /** The arrangement whose build calculation produced this solution. */
  arrangementKey?: string;
  missingRolls?: {
    archetype: string;
    tertiary: ArmorStat | null;
    tuning: ArmorStat | null;
    count: number;
  }[];
  missingRequirements?: Pick<T5Arrangement, "archetypes" | "tertiaries" | "tunings"> & {
    gearsets?: { hash: number; count: number }[];
  };
}

export interface T5Arrangement {
  key: string;
  archetypes: {
    name: string;
    count: number;
    primary: ArmorStat | null;
    secondary: ArmorStat | null;
  }[];
  tertiaries: { stat: ArmorStat | null; count: number }[];
  tunings: { stat: ArmorStat | null; count: number }[];
  modAllocation?: Pick<IPermutatorArmorSet, "usedMods" | "usedArtifice">;
  builds: T5Solution[];
  covered: number;
  owned: number;
  buildState?: "idle" | "queued" | "loading" | "partial" | "complete" | "error";
  buildError?: string;
  inventoryMatch?: {
    covered: number;
    owned: number;
    proven: boolean;
    pieces: T5Candidate[];
    feasible: boolean;
  };
}

export function t5ArrangementFromPieces(
  pieces: readonly T5Candidate[],
  tuningMods?: readonly (number | null)[],
  modAllocation?: Pick<IPermutatorArmorSet, "usedMods" | "usedArtifice">
): T5Arrangement {
  const archetypes = new Map<string, number>();
  const tertiaries = new Map<ArmorStat | null, number>();
  const tunings = new Map<ArmorStat | null, number>();
  for (const [index, piece] of pieces.entries()) {
    archetypes.set(piece.archetype, (archetypes.get(piece.archetype) ?? 0) + 1);
    const stat = piece.tertiary ?? null;
    if (!piece.anyTertiary) tertiaries.set(stat, (tertiaries.get(stat) ?? 0) + 1);
    const tuning = tuningMods ? t5TuningFamily(tuningMods[index]) : (piece.tuningStat ?? null);
    tunings.set(tuning, (tunings.get(tuning) ?? 0) + 1);
  }
  const counts = [...archetypes].sort(([first], [second]) => first.localeCompare(second));
  const tertiaryCounts = [...tertiaries].sort(([first], [second]) => (first ?? 6) - (second ?? 6));
  const tuningCounts = [...tunings].sort(([first], [second]) => (first ?? 6) - (second ?? 6));
  return {
    key: JSON.stringify([counts, tertiaryCounts, tuningCounts]),
    archetypes: counts.map(([name, count]) => {
      const archetype = T5_ARCHETYPES.find((entry) => entry.name === name);
      return {
        name,
        count,
        primary: archetype?.primary ?? null,
        secondary: archetype?.secondary ?? null,
      };
    }),
    tertiaries: tertiaryCounts.map(([stat, count]) => ({ stat, count })),
    tunings: tuningCounts.map(([stat, count]) => ({ stat, count })),
    modAllocation: modAllocation
      ? { usedMods: [...modAllocation.usedMods], usedArtifice: [...modAllocation.usedArtifice] }
      : undefined,
    builds: [],
    covered: 0,
    owned: 0,
  };
}

export function canAssignT5Tertiaries(
  arrangement: Pick<T5Arrangement, "archetypes" | "tertiaries">
): boolean {
  const pieces = arrangement.archetypes.flatMap((entry) =>
    Array.from({ length: entry.count }, () => entry)
  );
  const remaining = arrangement.tertiaries.map((entry) => entry.count);
  let unconstrained = pieces.length - remaining.reduce((sum, count) => sum + count, 0);
  if (unconstrained < 0) return false;
  const assign = (index: number): boolean => {
    if (index === pieces.length) return true;
    const piece = pieces[index];
    if (unconstrained > 0) {
      unconstrained--;
      if (assign(index + 1)) return true;
      unconstrained++;
    }
    for (let tertiary = 0; tertiary < remaining.length; tertiary++) {
      const stat = arrangement.tertiaries[tertiary].stat;
      if (
        !remaining[tertiary] ||
        (stat !== null && (stat === piece.primary || stat === piece.secondary))
      )
        continue;
      remaining[tertiary]--;
      if (assign(index + 1)) return true;
      remaining[tertiary]++;
    }
    return false;
  };
  return assign(0);
}

export function groupT5Arrangements(
  solutions: readonly T5Solution[],
  bases: readonly T5Arrangement[] = []
): T5Arrangement[] {
  const groups = new Map<string, T5Arrangement>();
  const seen = new Map<string, Set<string>>();
  for (const base of bases) {
    groups.set(base.key, {
      ...base,
      builds: [],
      covered: base.inventoryMatch?.covered ?? 0,
      owned: base.inventoryMatch?.owned ?? 0,
    });
    seen.set(base.key, new Set());
  }
  for (const solution of solutions) {
    const base = t5ArrangementFromPieces(solution.pieces, solution.tuningMods, solution.result);
    const key =
      solution.arrangementKey && groups.has(solution.arrangementKey)
        ? solution.arrangementKey
        : base.key;
    let arrangement = groups.get(key);
    if (!arrangement) {
      arrangement = base;
      groups.set(key, arrangement);
      seen.set(key, new Set());
    }
    if (!arrangement.modAllocation && base.modAllocation)
      arrangement.modAllocation = base.modAllocation;
    const buildKey = solution.patternKey ?? solution.key;
    if (seen.get(key)!.has(buildKey)) continue;
    seen.get(key)!.add(buildKey);
    arrangement.builds.push(solution);
  }
  const rank = (
    first: { covered: number; owned: number; key: string },
    second: { covered: number; owned: number; key: string }
  ) =>
    second.covered - first.covered ||
    second.owned - first.owned ||
    first.key.localeCompare(second.key);
  for (const arrangement of groups.values()) {
    arrangement.builds.sort(rank);
    const build = arrangement.builds[0];
    const match = arrangement.inventoryMatch;
    const preferMatch =
      !!match &&
      (!build ||
        match.covered > build.covered ||
        (match.covered === build.covered && match.owned >= build.owned));
    arrangement.covered = preferMatch ? match!.covered : (build?.covered ?? 0);
    arrangement.owned = preferMatch ? match!.owned : (build?.owned ?? 0);
  }
  return [...groups.values()].sort(
    (first, second) =>
      Number(isLowCoverageT5Arrangement(first)) - Number(isLowCoverageT5Arrangement(second)) ||
      first.archetypes.length - second.archetypes.length ||
      rank(first, second)
  );
}

export function isLowCoverageT5Arrangement(arrangement: T5Arrangement): boolean {
  return !!arrangement.inventoryMatch && arrangement.inventoryMatch.covered < 3;
}

export interface T5ArchetypeGroup {
  key: string;
  archetypes: T5Arrangement["archetypes"];
  arrangements: T5Arrangement[];
  builds: number;
  uncalculated: number;
  covered: number;
  owned: number;
}

export function groupT5Archetypes(
  arrangements: readonly T5Arrangement[],
  order: "flexibility" | "matches" = "flexibility"
): T5ArchetypeGroup[] {
  const groups = new Map<string, T5ArchetypeGroup>();
  for (const arrangement of arrangements) {
    const key = JSON.stringify(
      arrangement.archetypes
        .map(({ name, count }) => [name, count])
        .sort(([first], [second]) => String(first).localeCompare(String(second)))
    );
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        archetypes: arrangement.archetypes,
        arrangements: [],
        builds: 0,
        uncalculated: 0,
        covered: 0,
        owned: 0,
      };
      groups.set(key, group);
    }
    group.arrangements.push(arrangement);
    group.builds += arrangement.builds.length;
    if (
      !isLowCoverageT5Arrangement(arrangement) &&
      (!arrangement.buildState || arrangement.buildState === "idle")
    )
      group.uncalculated++;
    if (
      arrangement.covered > group.covered ||
      (arrangement.covered === group.covered && arrangement.owned > group.owned)
    ) {
      group.covered = arrangement.covered;
      group.owned = arrangement.owned;
    }
  }
  for (const group of groups.values()) {
    group.arrangements.sort(
      (first, second) =>
        Number(isLowCoverageT5Arrangement(first)) - Number(isLowCoverageT5Arrangement(second)) ||
        second.covered - first.covered ||
        second.owned - first.owned
    );
  }
  return [...groups.values()].sort((first, second) => {
    const flexibility =
      second.arrangements.length - first.arrangements.length ||
      first.archetypes.length - second.archetypes.length;
    const matches = second.covered - first.covered || second.owned - first.owned;
    return (
      Number(first.arrangements.every(isLowCoverageT5Arrangement)) -
        Number(second.arrangements.every(isLowCoverageT5Arrangement)) ||
      (order === "matches" ? matches || flexibility : flexibility || matches) ||
      first.key.localeCompare(second.key)
    );
  });
}

export interface T5SearchTask {
  archetypes: string[];
  archetypeCounts?: boolean;
  tertiaries?: { stat: ArmorStat | null; count: number }[];
  excludedArrangements?: T5Arrangement[];
}

export function t5SearchTaskKey(task: T5SearchTask): string {
  return JSON.stringify([!!task.archetypeCounts, task.archetypes, task.tertiaries ?? null]);
}

export function createT5TertiaryTasks(
  task: T5SearchTask,
  choices: ReadonlyMap<string, readonly (ArmorStat | null)[]>
): T5SearchTask[] {
  const tasks = new Map<string, T5SearchTask>();
  const counts = new Map<ArmorStat | null, number>();
  const generate = (index: number) => {
    if (index === task.archetypes.length) {
      const tertiaries = [...counts]
        .filter(([, count]) => count > 0)
        .sort(([first], [second]) => (first ?? 6) - (second ?? 6))
        .map(([stat, count]) => ({ stat, count }));
      const key = JSON.stringify(tertiaries);
      if (!tasks.has(key))
        tasks.set(key, {
          ...task,
          tertiaries,
          excludedArrangements: task.excludedArrangements?.filter((arrangement) =>
            arrangement.tertiaries.every(
              (required) =>
                (tertiaries.find((entry) => entry.stat === required.stat)?.count ?? 0) >=
                required.count
            )
          ),
        });
      return;
    }
    for (const stat of choices.get(task.archetypes[index]) ?? []) {
      counts.set(stat, (counts.get(stat) ?? 0) + 1);
      generate(index + 1);
      counts.set(stat, counts.get(stat)! - 1);
    }
  };
  generate(0);
  return [...tasks.values()];
}

export interface T5SearchRequest {
  wasmUrl?: string;
  config: BuildConfiguration;
  arrangementConfig?: BuildConfiguration;
  inventory: IInventoryArmor[];
  manifest: IManifestArmor[];
  achievableOnly: boolean;
  timeLimitMs: number;
  group?: string[];
  partition?: { index: number; count: number };
  buildPartition?: { index: number; count: number };
  arrangement?: T5Arrangement;
  stage?: "arrangements" | "builds" | "maxima" | "matches";
  skipMaxima?: boolean;
  task?: T5SearchTask;
  matchArrangements?: T5Arrangement[];
}

export interface T5ProfileInput {
  schemaVersion: 1;
  request: Pick<T5SearchRequest, "config" | "inventory" | "manifest" | "achievableOnly"> & {
    prioritizeMatches?: boolean;
  };
}

export function createT5ProfileInput(request: T5ProfileInput["request"]): T5ProfileInput {
  const config = Object.assign(
    BuildConfiguration.buildEmptyConfiguration(),
    Object.fromEntries(
      Object.keys(BuildConfiguration.buildEmptyConfiguration()).map((key) => [
        key,
        structuredClone(request.config[key as keyof BuildConfiguration]),
      ])
    )
  );
  const ids = new Map(
    request.inventory
      .filter((item) => !!item.itemInstanceId)
      .map((item, index) => [item.itemInstanceId, `profile-${index + 1}`])
  );
  config.disabledItems = request.config.disabledItems.flatMap((id) =>
    id === "" ? [""] : ids.has(id) ? [ids.get(id)!] : []
  );
  const manifestItem = (item: IManifestArmor): IManifestArmor => ({
    id: 0,
    hash: item.hash,
    name: "",
    icon: "",
    description: "",
    slot: item.slot,
    clazz: item.clazz,
    isExotic: item.isExotic,
    rarity: item.rarity,
    armorSystem: item.armorSystem,
    isFeatured: item.isFeatured,
    gearSetHash: item.gearSetHash,
    gearSetPerkSelectable: item.gearSetPerkSelectable,
    watermarkIcon: "",
    perk: item.perk,
    exoticPerkHash: [...(item.exoticPerkHash ?? [])],
    isSunset: item.isSunset,
    itemType: item.itemType,
    itemSubType: item.itemSubType,
    investmentStats: [],
    socketEntries: [],
  });
  return {
    schemaVersion: 1,
    request: {
      config,
      achievableOnly: request.achievableOnly,
      prioritizeMatches: request.prioritizeMatches ?? true,
      inventory: request.inventory.map((item, index) => ({
        ...manifestItem(item),
        id: index + 1,
        itemInstanceId: ids.get(item.itemInstanceId) ?? "",
        energyLevel: item.energyLevel,
        masterworkLevel: item.masterworkLevel,
        archetypeStats: [...item.archetypeStats],
        tier: item.tier,
        mobility: item.mobility,
        resilience: item.resilience,
        recovery: item.recovery,
        discipline: item.discipline,
        intellect: item.intellect,
        strength: item.strength,
        source: item.source,
        tuningStat: item.tuningStat,
        created_at: 0,
        updated_at: 0,
      })),
      manifest: request.manifest
        .filter((item) => item.clazz === config.characterClass)
        .map(manifestItem),
    },
  };
}

export function createT5SearchTasks(
  archetypesBySlot: readonly (readonly string[])[],
  depth = 3
): { archetypes: string[] }[] {
  if (archetypesBySlot.some((choices) => !choices.length)) return [];
  let tasks: { archetypes: string[] }[] = [{ archetypes: [] }];
  for (const choices of archetypesBySlot.slice(0, depth)) {
    tasks = tasks.flatMap((task) =>
      choices.map((archetype) => ({ archetypes: [...task.archetypes, archetype] }))
    );
  }
  return tasks.sort(
    (first, second) =>
      new Set(first.archetypes).size - new Set(second.archetypes).size ||
      first.archetypes.join("/").localeCompare(second.archetypes.join("/"))
  );
}

export function createT5ArchetypeCountTasks(
  archetypes: readonly string[],
  pieces = 5
): T5SearchTask[] {
  const names = [...new Set(archetypes)].sort();
  const tasks: T5SearchTask[] = [];
  const selected: string[] = [];
  const generate = (start: number) => {
    if (selected.length === pieces) {
      tasks.push({ archetypes: [...selected], archetypeCounts: true });
      return;
    }
    for (let index = start; index < names.length; index++) {
      selected.push(names[index]);
      generate(index);
      selected.pop();
    }
  };
  generate(0);
  return tasks.sort(
    (first, second) =>
      new Set(first.archetypes).size - new Set(second.archetypes).size ||
      first.archetypes.join("/").localeCompare(second.archetypes.join("/"))
  );
}

export function prioritizeT5SearchTasks(
  tasks: readonly T5SearchTask[],
  sourceArchetypesBySlot: readonly ReadonlySet<string>[]
): T5SearchTask[] {
  return tasks
    .map((task) => ({
      task,
      covered: sourceArchetypesBySlot.reduce(
        (count, choices, slot) =>
          count +
          Number(
            task.archetypeCounts
              ? task.archetypes.some((name) => choices.has(name))
              : task.archetypes[slot] === undefined
                ? choices.size > 0
                : choices.has(task.archetypes[slot])
          ),
        0
      ),
    }))
    .sort((first, second) => Number(second.covered >= 3) - Number(first.covered >= 3))
    .map(({ task }) => task);
}

export interface T5SearchUpdate {
  delta?: boolean;
  removedResultKeys?: string[];
  removedArrangementKeys?: string[];
  arrangements?: T5Arrangement[];
  results: T5Solution[];
  checked: number;
  total: number;
  feasible: number;
  evaluations: number;
  complete: boolean;
  done: boolean;
  warnings: string[];
  error?: string;
  maximumPossibleStats?: number[];
  possibleRollCombinations?: number;
  maximaChecked?: number;
  maximaComplete?: boolean;
  elapsedMs?: number;
  budgetProgress?: number;
  workersTotal?: number;
  workersFinished?: number;
  workersActive?: number;
  solverRetries?: number;
  stopReason?: "budget" | "exhausted" | "error" | "slice";
  taskDeferred?: boolean;
  tasksDeferred?: number;
  tasksTotal?: number;
  tasksFinished?: number;
  tasksQueued?: number;
  inventoryMatches?: { key: string; match: NonNullable<T5Arrangement["inventoryMatch"]> }[];
  matching?: boolean;
  matchingFinished?: number;
  matchingTotal?: number;
  matchingComplete?: boolean;
}

export function createT5UpdateEncoder(): (update: T5SearchUpdate) => T5SearchUpdate {
  let results = new Set<string>();
  let arrangements = new Set<string>();
  return (update) => {
    const nextResults = new Set(update.results.map((result) => result.patternKey ?? result.key));
    const nextArrangements = new Set(
      (update.arrangements ?? []).map((arrangement) => arrangement.key)
    );
    const encoded: T5SearchUpdate = {
      ...update,
      delta: true,
      results: update.results.filter((result) => !results.has(result.patternKey ?? result.key)),
      arrangements: (update.arrangements ?? []).filter(
        (arrangement) => !arrangements.has(arrangement.key)
      ),
      removedResultKeys: [...results].filter((key) => !nextResults.has(key)),
      removedArrangementKeys: [...arrangements].filter((key) => !nextArrangements.has(key)),
    };
    results = nextResults;
    arrangements = nextArrangements;
    return encoded;
  };
}

export function applyT5Update(
  previous: T5SearchUpdate | undefined,
  update: T5SearchUpdate
): T5SearchUpdate {
  if (!update.delta) return update;
  const removedResults = new Set(update.removedResultKeys ?? []);
  const removedArrangements = new Set(update.removedArrangementKeys ?? []);
  const results = new Map(
    (previous?.results ?? [])
      .filter((result) => !removedResults.has(result.patternKey ?? result.key))
      .map((result) => [result.patternKey ?? result.key, result])
  );
  const arrangements = new Map(
    (previous?.arrangements ?? [])
      .filter((arrangement) => !removedArrangements.has(arrangement.key))
      .map((arrangement) => [arrangement.key, arrangement])
  );
  for (const result of update.results) results.set(result.patternKey ?? result.key, result);
  for (const arrangement of update.arrangements ?? [])
    arrangements.set(arrangement.key, arrangement);
  return {
    ...previous,
    ...update,
    delta: false,
    removedResultKeys: undefined,
    removedArrangementKeys: undefined,
    results: [...results.values()],
    arrangements: [...arrangements.values()],
  };
}

export function mergeT5SearchUpdates(
  updates: readonly T5SearchUpdate[],
  workersTotal: number,
  elapsedMs: number,
  timeLimitMs: number,
  resultLimit = 30000
): T5SearchUpdate {
  const unique = new Map<string, T5Solution>();
  for (const update of updates)
    for (const solution of update.results)
      unique.set(solution.patternKey ?? solution.key, solution);
  const results = [...unique.values()]
    .sort(
      (first, second) =>
        second.covered - first.covered ||
        second.owned - first.owned ||
        first.key.localeCompare(second.key)
    )
    .slice(0, resultLimit || 30000);
  const workersFinished = updates.filter((update) => update.done).length;
  const done = workersFinished === workersTotal;
  const maximumPossibleStats = Array.from({ length: 6 }, (_, stat) =>
    Math.max(0, ...updates.map((update) => update.maximumPossibleStats?.[stat] ?? 0))
  );
  const arrangements = new Map<string, T5Arrangement>();
  for (const update of updates)
    for (const arrangement of update.arrangements ?? [])
      arrangements.set(arrangement.key, arrangement);
  return {
    arrangements: [...arrangements.values()].sort((first, second) =>
      first.key.localeCompare(second.key)
    ),
    results,
    checked: updates.reduce((sum, update) => sum + update.checked, 0),
    total: updates.reduce((sum, update) => sum + update.total, 0),
    feasible: updates.some((update) => update.arrangements !== undefined)
      ? arrangements.size
      : updates.reduce((sum, update) => sum + update.feasible, 0),
    evaluations: updates.reduce((sum, update) => sum + update.evaluations, 0),
    complete: done && updates.every((update) => update.complete),
    done,
    warnings: [...new Set(updates.flatMap((update) => update.warnings))],
    error: updates.find((update) => update.error)?.error,
    maximumPossibleStats,
    possibleRollCombinations: updates.reduce(
      (sum, update) => sum + (update.possibleRollCombinations ?? 0),
      0
    ),
    maximaChecked:
      updates.length < workersTotal
        ? 0
        : Math.min(...updates.map((update) => update.maximaChecked ?? (update.done ? 6 : 0))),
    maximaComplete:
      updates.length === workersTotal &&
      updates.every((update) => update.maximaComplete || (update.done && update.total === 0)),
    elapsedMs,
    budgetProgress: timeLimitMs > 0 ? Math.min(100, (elapsedMs / timeLimitMs) * 100) : undefined,
    workersTotal,
    workersFinished,
    workersActive: workersTotal - workersFinished,
    solverRetries: updates.reduce((sum, update) => sum + (update.solverRetries ?? 0), 0),
    stopReason: done
      ? updates.some((update) => update.error || update.stopReason === "error")
        ? "error"
        : updates.some((update) => update.stopReason === "budget")
          ? "budget"
          : "exhausted"
      : undefined,
  };
}

export function reflectMainCalculationSettings(
  theorizer: BuildConfiguration,
  main: BuildConfiguration
): void {
  theorizer.armorRequirements = structuredClone(main.armorRequirements);
  theorizer.statModLimits = structuredClone(main.statModLimits);
  theorizer.enabledMods = [...main.enabledMods];
  theorizer.selectedModElement = main.selectedModElement;
  theorizer.allowLegacyLegendaryArmor = false;
  theorizer.allowLegacyExoticArmor = false;
  theorizer.allowBlueArmorPieces = false;
}

export const T5_SEARCH_BUDGETS = [
  { value: 300000, label: "5 minutes" },
  { value: 600000, label: "10 minutes" },
  { value: 900000, label: "15 minutes" },
  { value: 1200000, label: "20 minutes" },
  { value: 0, label: "Unlimited" },
] as const;

export const DEFAULT_T5_SEARCH_BUDGET_MS = T5_SEARCH_BUDGETS[2].value;

export interface T5SavedRun {
  id?: number;
  schemaVersion: 1;
  name: string;
  createdAt: number;
  configuration: BuildConfiguration;
  options: {
    achievableOnly: boolean;
    timeLimitMs: number;
    workerLimit: number;
    prioritizeMatches?: boolean;
  };
  complete: boolean;
  arrangements: Pick<
    T5Arrangement,
    "key" | "archetypes" | "tertiaries" | "tunings" | "modAllocation"
  >[];
}

export function createT5SavedRun(
  name: string,
  configuration: BuildConfiguration,
  options: T5SavedRun["options"],
  arrangements: readonly T5Arrangement[],
  complete: boolean
): T5SavedRun {
  return {
    schemaVersion: 1,
    name: name.trim(),
    createdAt: Date.now(),
    configuration: structuredClone(configuration),
    options: { ...options, prioritizeMatches: options.prioritizeMatches ?? true },
    complete,
    arrangements: arrangements.map((arrangement) =>
      structuredClone({
        key: arrangement.key,
        archetypes: arrangement.archetypes,
        tertiaries: arrangement.tertiaries,
        tunings: arrangement.tunings,
        modAllocation: arrangement.modAllocation,
      })
    ),
  };
}

export function restoreT5Arrangements(arrangements: T5SavedRun["arrangements"]): T5Arrangement[] {
  return arrangements.map((arrangement) => ({
    ...structuredClone(arrangement),
    builds: [],
    covered: 0,
    owned: 0,
    buildState: "idle",
  }));
}
