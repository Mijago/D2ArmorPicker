import { DestinyClass, TierType } from "bungie-api-ts/destiny2";
import { BuildConfiguration } from "../data/buildConfiguration";
import { FORCE_USE_ANY_EXOTIC, FORCE_USE_NO_EXOTIC } from "../data/constants";
import { ArmorSlot } from "../data/enum/armor-slot";
import { ArmorPerkOrSlot, ArmorStat } from "../data/enum/armor-stat";
import { EventArmorType } from "../data/enum/event-armor-type";
import { InventoryArmorSource, IInventoryArmor } from "../data/types/IInventoryArmor";
import { ArmorSystem, IManifestArmor } from "../data/types/IManifestArmor";
import {
  T5_ARCHETYPES,
  T5Arrangement,
  T5Candidate,
  T5SearchRequest,
  T5SearchUpdate,
  T5Solution,
  t5ArchetypeIndex,
  t5ArrangementFromPieces,
  t5BaseStats,
  t5Tertiaries,
} from "../data/theorizer";
import {
  constrainT5Arrangement,
  constrainT5ArchetypeCounts,
  constrainT5TertiaryCounts,
  createT5OptimizationModel,
  excludeT5Arrangement,
  excludeT5Pattern,
  partitionT5Builds,
  solveT5Optimization,
  t5BoundsCanReach,
  t5MaximumStatUpdates,
  t5OptimizationSolution,
  t5RollStats,
  t5StatBounds,
  t5TuningStat,
} from "./theorizer-model";

export const T5_SLOTS = [
  ArmorSlot.ArmorSlotHelmet,
  ArmorSlot.ArmorSlotGauntlet,
  ArmorSlot.ArmorSlotChest,
  ArmorSlot.ArmorSlotLegs,
  ArmorSlot.ArmorSlotClass,
];

export function t5ItemStats(item: {
  resilience: number;
  strength: number;
  discipline: number;
  intellect: number;
  recovery: number;
  mobility: number;
}): number[] {
  return [
    item.resilience,
    item.strength,
    item.discipline,
    item.intellect,
    item.recovery,
    item.mobility,
  ];
}

export function t5SourceAllowed(item: IInventoryArmor, config: BuildConfiguration): boolean {
  return (
    item.clazz === config.characterClass &&
    item.armorSystem === ArmorSystem.Armor3 &&
    (item.isExotic === 1 || item.tier === 5) &&
    (item.source !== InventoryArmorSource.Collections || config.includeCollectionRolls) &&
    (item.source !== InventoryArmorSource.Vendor || config.includeVendorRolls) &&
    (!config.ignoreSunsetArmor || !item.isSunset) &&
    (!(item.isExotic ? config.enforceFeaturedExoticArmor : config.enforceFeaturedLegendaryArmor) ||
      item.isFeatured) &&
    (!(item.isExotic ? config.onlyUseMasterworkedExotics : config.onlyUseMasterworkedLegendaries) ||
      item.masterworkLevel === 5)
  );
}

export function t5ArrangementConfiguration(config: BuildConfiguration): BuildConfiguration {
  const arrangementConfig = BuildConfiguration.buildEmptyConfiguration();
  arrangementConfig.characterClass = config.characterClass;
  arrangementConfig.selectedModElement = config.selectedModElement;
  arrangementConfig.minimumStatTiers = structuredClone(config.minimumStatTiers);
  arrangementConfig.statModLimits = { ...config.statModLimits };
  arrangementConfig.enabledMods = [...config.enabledMods];
  arrangementConfig.assumeLegendariesMasterworked = true;
  arrangementConfig.assumeExoticsMasterworked = true;
  arrangementConfig.calculateTierFiveTuning = true;
  arrangementConfig.includeCollectionRolls = true;
  arrangementConfig.includeVendorRolls = true;
  arrangementConfig.ignoreSunsetArmor = false;
  return arrangementConfig;
}

export function t5ArrangementRequest(request: T5SearchRequest): T5SearchRequest {
  const config = request.arrangementConfig ?? t5ArrangementConfiguration(request.config);
  return {
    ...request,
    config,
    arrangementConfig: config,
    achievableOnly: false,
    inventory: request.inventory.filter(
      (item) =>
        item.clazz === config.characterClass &&
        item.slot === ArmorSlot.ArmorSlotClass &&
        item.isExotic === 1 &&
        item.armorSystem === ArmorSystem.Armor3
    ),
    manifest: request.manifest.filter(
      (item) =>
        item.clazz === config.characterClass &&
        item.slot === ArmorSlot.ArmorSlotClass &&
        item.isExotic === 1 &&
        item.armorSystem === ArmorSystem.Armor3
    ),
  };
}

function perksAllowed(
  item: { isExotic: number; slot: ArmorSlot; exoticPerkHash?: number[] },
  config: BuildConfiguration
): boolean {
  return (
    !item.isExotic ||
    item.slot !== ArmorSlot.ArmorSlotClass ||
    config.selectedExoticPerks.every(
      (perk) => perk === ArmorPerkOrSlot.Any || item.exoticPerkHash?.includes(perk)
    )
  );
}

function exoticAllowed(hash: number, config: BuildConfiguration): boolean {
  const selected = config.selectedExotics;
  return (
    !selected.includes(FORCE_USE_NO_EXOTIC) &&
    (!selected.length || selected.includes(FORCE_USE_ANY_EXOTIC) || selected.includes(hash))
  );
}

function isOwned(candidate: T5Candidate): boolean {
  return (
    !!candidate.instanceId &&
    (candidate.source === InventoryArmorSource.Inventory ||
      candidate.source === InventoryArmorSource.Postmaster)
  );
}

export function compareT5Solutions(first: T5Solution, second: T5Solution): number {
  return (
    second.covered - first.covered ||
    second.owned - first.owned ||
    first.key.localeCompare(second.key)
  );
}

export function t5CompatibilityErrors(config: BuildConfiguration): string[] {
  const errors: string[] = [];
  if (config.characterClass === DestinyClass.Unknown) errors.push("Select a character class.");
  if (config.useEventArmor !== EventArmorType.None)
    errors.push(
      "Event armor requirements are not available on hypothetical T5 gear. Disable the event armor filter to search."
    );
  if (
    config.armorRequirements.some(
      (requirement) =>
        "perk" in requirement &&
        requirement.perk !== ArmorPerkOrSlot.Any &&
        requirement.perk !== ArmorPerkOrSlot.None &&
        requirement.perk !== ArmorPerkOrSlot.SlotArtifice
    )
  ) {
    errors.push(
      "T5 armor has gearsets, not legacy perk slots. Remove legacy perk requirements to search."
    );
  }
  return errors;
}

function candidateFromItem(item: IInventoryArmor, id: number): T5Candidate | null {
  if (item.armorSystem !== ArmorSystem.Armor3 || (!item.isExotic && item.tier !== 5)) return null;
  const stats = t5ItemStats(item);
  const archetypeIndex = t5ArchetypeIndex(stats);
  const classExotic = item.isExotic && item.slot === ArmorSlot.ArmorSlotClass;
  if (
    !classExotic &&
    (archetypeIndex < 0 ||
      stats.filter((value) => value === 20).length !== 1 ||
      stats.filter((value) => value === 0).length !== 3)
  )
    return null;
  return {
    ...item,
    id,
    tier: 5,
    archetype:
      archetypeIndex >= 0 ? T5_ARCHETYPES[archetypeIndex].name : `Spirit roll ${stats.join("/")}`,
    tertiary: stats.indexOf(20) >= 0 ? (stats.indexOf(20) as ArmorStat) : null,
    instanceId: item.itemInstanceId || `source-${item.source}-${item.hash}-${id}`,
  };
}

export function eligibleT5Inventory(
  inventory: readonly IInventoryArmor[],
  config: BuildConfiguration,
  manifest: readonly IManifestArmor[] = []
): IInventoryArmor[] {
  const gearsetRequirements = new Map<number, number>();
  for (const requirement of config.armorRequirements) {
    if ("gearSetHash" in requirement) {
      gearsetRequirements.set(
        requirement.gearSetHash,
        (gearsetRequirements.get(requirement.gearSetHash) ?? 0) + 1
      );
    }
  }
  const fourPieceSet = [...gearsetRequirements].find(([, count]) => count >= 4)?.[0];
  const twoPieceSets =
    gearsetRequirements.size === 2 &&
    [...gearsetRequirements.values()].every((count) => count === 2)
      ? new Set(gearsetRequirements.keys())
      : undefined;
  const exoticSelected =
    config.selectedExotics.length > 0 && !config.selectedExotics.includes(FORCE_USE_NO_EXOTIC);
  const requiredGearsets = fourPieceSet !== undefined ? new Set([fourPieceSet]) : twoPieceSets;
  const selectedHashes = config.selectedExotics.filter((hash) => hash >= 0);
  const selectedExoticSlots = new Set([
    ...manifest.filter((item) => selectedHashes.includes(item.hash)).map((item) => item.slot),
    ...inventory
      .filter((item) => item.isExotic && selectedHashes.includes(item.hash))
      .map((item) => item.slot),
  ]);
  const exoticSelectionSpansSlots = selectedExoticSlots.size > 1;
  return inventory.filter(
    (item) =>
      t5SourceAllowed(item, config) &&
      perksAllowed(item, config) &&
      (!item.isExotic || exoticAllowed(item.hash, config)) &&
      candidateFromItem(item, 0) !== null &&
      (!selectedHashes.length ||
        item.isExotic ||
        exoticSelectionSpansSlots ||
        !selectedExoticSlots.has(item.slot)) &&
      (!exoticSelected ||
        !requiredGearsets ||
        item.isExotic ||
        item.gearSetPerkSelectable ||
        (item.gearSetHash !== null && requiredGearsets.has(item.gearSetHash)))
  );
}

function deduplicateT5Domains(domains: Map<string, T5Candidate[]>[]): void {
  for (const domain of domains) {
    for (const [key, choices] of domain) {
      const unique = new Map<string, T5Candidate>();
      for (const item of choices.sort(
        (first, second) => Number(isOwned(second)) - Number(isOwned(first))
      )) {
        const signature = `${t5ItemStats(item)}:${!!item.instanceId}:${isOwned(item)}:${item.isExotic}:${item.hash}:${item.tuningStat}:${item.hypotheticalTuning}:${item.masterworkLevel}:${item.perk}:${item.gearSetHash}:${item.gearSetPerkSelectable}:${item.exoticPerkHash}`;
        if (!unique.has(signature)) unique.set(signature, item);
      }
      domain.set(key, [...unique.values()]);
    }
  }
}

export function buildT5Domains(request: T5SearchRequest): Map<string, T5Candidate[]>[] {
  const { config } = request;
  let nextId = 1;
  const domains = T5_SLOTS.map(() => new Map<string, T5Candidate[]>());
  const add = (candidate: T5Candidate) => {
    const slot = T5_SLOTS.indexOf(candidate.slot);
    if (slot < 0) return;
    const choices = domains[slot].get(candidate.archetype) ?? [];
    choices.push(candidate);
    domains[slot].set(candidate.archetype, choices);
  };
  for (const item of eligibleT5Inventory(request.inventory, config, request.manifest)) {
    const candidate = candidateFromItem(item, nextId++);
    if (candidate) add(candidate);
  }
  if (request.achievableOnly) {
    deduplicateT5Domains(domains);
    return domains;
  }

  const legendarySets = new Set(
    config.armorRequirements.flatMap((requirement) =>
      "gearSetHash" in requirement ? [requirement.gearSetHash] : []
    )
  );
  const manifests = request.manifest.filter(
    (item) =>
      item.clazz === config.characterClass &&
      item.armorSystem === ArmorSystem.Armor3 &&
      (!config.ignoreSunsetArmor || !item.isSunset)
  );
  for (const slot of T5_SLOTS) {
    const legendaryAvailable =
      !config.enforceFeaturedLegendaryArmor ||
      manifests.some(
        (item) =>
          item.slot === slot &&
          !item.isExotic &&
          item.isFeatured &&
          (!legendarySets.size ||
            (item.gearSetHash !== null && legendarySets.has(item.gearSetHash)))
      );
    const exotics = manifests.filter(
      (item) =>
        item.slot === slot &&
        item.isExotic &&
        item.armorSystem === ArmorSystem.Armor3 &&
        exoticAllowed(item.hash, config) &&
        (!config.enforceFeaturedExoticArmor || item.isFeatured)
    );
    const identities: (IManifestArmor | null)[] = legendaryAvailable ? [null, ...exotics] : exotics;
    for (const identity of identities) {
      if (identity && slot === ArmorSlot.ArmorSlotClass) {
        const known = request.inventory.filter(
          (item) =>
            item.hash === identity.hash &&
            item.armorSystem === ArmorSystem.Armor3 &&
            perksAllowed(item, config)
        );
        const seen = new Set<string>();
        for (const item of known) {
          const signature = `${t5ItemStats(item)}:${item.exoticPerkHash}`;
          if (seen.has(signature)) continue;
          seen.add(signature);
          const candidate = candidateFromItem(item, nextId++);
          if (candidate)
            add({
              ...candidate,
              instanceId: null,
              masterworkLevel:
                config.assumeExoticsMasterworked || config.onlyUseMasterworkedExotics ? 5 : 0,
              perk: ArmorPerkOrSlot.None,
            });
        }
        continue;
      }
      for (const archetype of T5_ARCHETYPES) {
        for (const tertiary of t5Tertiaries(archetype)) {
          const stats = t5BaseStats(archetype, tertiary);
          add({
            id: nextId++,
            hash: identity?.hash ?? 0,
            name: identity?.name ?? "T5 legendary",
            icon: identity?.icon ?? "",
            slot,
            clazz: config.characterClass,
            isExotic: identity ? 1 : 0,
            rarity: identity ? TierType.Exotic : TierType.Superior,
            isSunset: false,
            armorSystem: ArmorSystem.Armor3,
            tier: 5,
            archetype: archetype.name,
            tertiary,
            archetypeStats: [archetype.primary, archetype.secondary, tertiary],
            resilience: stats[0],
            strength: stats[1],
            discipline: stats[2],
            intellect: stats[3],
            recovery: stats[4],
            mobility: stats[5],
            masterworkLevel: (
              identity
                ? config.assumeExoticsMasterworked || config.onlyUseMasterworkedExotics
                : config.assumeLegendariesMasterworked || config.onlyUseMasterworkedLegendaries
            )
              ? 5
              : 0,
            perk: ArmorPerkOrSlot.None,
            tuningStat: ArmorStat.StatHealth,
            hypotheticalTuning: !identity,
            gearSetHash: identity?.gearSetHash ?? null,
            gearSetPerkSelectable: identity?.gearSetPerkSelectable ?? false,
            source: InventoryArmorSource.Inventory,
            instanceId: null,
          });
        }
      }
    }
  }
  deduplicateT5Domains(domains);
  return domains;
}

export function assignT5Gearsets(
  pieces: readonly T5Candidate[],
  config: BuildConfiguration
): T5Candidate[] | null {
  const requirements = new Map<number, number>();
  for (const requirement of config.armorRequirements) {
    if ("gearSetHash" in requirement)
      requirements.set(
        requirement.gearSetHash,
        (requirements.get(requirement.gearSetHash) ?? 0) + 1
      );
  }
  const result = pieces.map((item) => ({ ...item }));
  const available: T5Candidate[] = [];
  for (const item of result) {
    if ((!item.instanceId && !item.isExotic) || item.gearSetPerkSelectable) available.push(item);
    else if (item.gearSetHash !== null)
      requirements.set(
        item.gearSetHash,
        Math.max(0, (requirements.get(item.gearSetHash) ?? 0) - 1)
      );
  }
  available.sort((first, second) => Number(!!second.instanceId) - Number(!!first.instanceId));
  for (const [hash, count] of requirements) {
    for (let required = 0; required < count; required++) {
      const item = available.shift();
      if (!item) return null;
      item.gearSetHash = hash;
      item.gearSetPerkSelectable = false;
    }
  }
  return result;
}

export function missingT5Gearsets(
  pieces: readonly T5Candidate[],
  config: BuildConfiguration
): { hash: number; count: number }[] {
  const required = new Map<number, number>();
  for (const requirement of config.armorRequirements) {
    if ("gearSetHash" in requirement)
      required.set(requirement.gearSetHash, (required.get(requirement.gearSetHash) ?? 0) + 1);
  }
  for (const piece of pieces) {
    if (piece.instanceId && piece.gearSetHash !== null && required.has(piece.gearSetHash)) {
      required.set(piece.gearSetHash, Math.max(0, required.get(piece.gearSetHash)! - 1));
    }
  }
  return [...required].filter(([, count]) => count > 0).map(([hash, count]) => ({ hash, count }));
}

export function matchT5Pattern(
  pattern: T5Solution,
  domains: readonly Map<string, T5Candidate[]>[],
  config: BuildConfiguration,
  achievableOnly: boolean
): T5Solution | null {
  const choices = pattern.pieces.map((required, slot) => {
    const positive = t5TuningStat(pattern.tuningMods[slot]);
    const stats = t5RollStats(required, config);
    return (domains[slot].get(required.archetype) ?? []).filter(
      (item) =>
        item.instanceId &&
        item.tertiary === required.tertiary &&
        item.isExotic === required.isExotic &&
        (!item.isExotic || slot !== 4 || item.hash === required.hash) &&
        item.perk === required.perk &&
        t5RollStats(item, config).every((value, stat) => value === stats[stat]) &&
        (positive === null || !!item.isExotic || item.tuningStat === positive)
    );
  });
  const picked: T5Candidate[] = [];
  let best: T5Solution | null = null;
  const visit = (slot: number, covered: number, owned: number) => {
    if (
      best &&
      (covered + 5 - slot < best.covered ||
        (covered + 5 - slot === best.covered && owned + 5 - slot <= best.owned))
    )
      return;
    if (slot === 5) {
      const assigned = assignT5Gearsets(picked, config);
      if (!assigned) return;
      const missingRolls: NonNullable<T5Solution["missingRolls"]> = [];
      const missingPieces: T5Candidate[] = [];
      const missingTunings: (number | null)[] = [];
      for (let index = 0; index < 5; index++) {
        if (assigned[index].instanceId) continue;
        const piece = assigned[index];
        missingPieces.push(piece);
        missingTunings.push(pattern.tuningMods[index]);
        const tuning = t5TuningStat(pattern.tuningMods[index]);
        const existing = missingRolls.find(
          (roll) =>
            roll.archetype === piece.archetype &&
            roll.tertiary === piece.tertiary &&
            roll.tuning === tuning
        );
        if (existing) existing.count++;
        else
          missingRolls.push({
            archetype: piece.archetype,
            tertiary: piece.tertiary,
            tuning,
            count: 1,
          });
        if (!piece.isExotic) piece.gearSetHash = null;
      }
      const missingRequirements = {
        ...t5ArrangementFromPieces(missingPieces, missingTunings),
        gearsets: missingT5Gearsets(assigned, config),
      };
      const matched = {
        ...pattern,
        pieces: assigned,
        covered,
        owned,
        missingRolls,
        missingRequirements,
      };
      if (!best || compareT5Solutions(matched, best) < 0) best = matched;
      return;
    }
    for (const item of choices[slot]) {
      picked.push(item);
      visit(slot + 1, covered + 1, owned + Number(isOwned(item)));
      picked.pop();
    }
    if (!achievableOnly) {
      const required = pattern.pieces[slot];
      picked.push({
        ...required,
        instanceId: null,
        gearSetHash: required.isExotic ? required.gearSetHash : null,
      });
      visit(slot + 1, covered, owned);
      picked.pop();
    }
  };
  visit(0, 0, 0);
  return best;
}

function generationRolls(choices: readonly T5Candidate[], achievableOnly: boolean): T5Candidate[] {
  const unique = new Map<string, T5Candidate>();
  for (const item of choices) {
    const hypotheticalTuning = !item.isExotic && !achievableOnly ? true : item.hypotheticalTuning;
    const key = JSON.stringify([
      t5ItemStats(item),
      item.archetype,
      item.masterworkLevel,
      item.isExotic,
      item.perk,
      item.isExotic ? item.gearSetHash : null,
      item.gearSetPerkSelectable,
      item.slot === ArmorSlot.ArmorSlotClass && item.isExotic
        ? [item.hash, item.exoticPerkHash]
        : null,
      item.isExotic || hypotheticalTuning ? "flexible" : item.tuningStat,
    ]);
    if (!unique.has(key))
      unique.set(key, {
        ...item,
        instanceId: null,
        hypotheticalTuning,
        gearSetHash: item.isExotic ? item.gearSetHash : null,
        gearSetPerkSelectable: !!item.isExotic && item.gearSetPerkSelectable,
        name: item.isExotic ? item.name : "T5 legendary",
        icon: item.isExotic ? item.icon : "",
      });
  }
  return [...unique.values()];
}

export interface PreparedT5Search {
  domains: Map<string, T5Candidate[]>[];
  arrangementDomains: Map<string, T5Candidate[]>[];
  theoryDomains: Map<string, T5Candidate[]>[];
  archetypeDomains: Map<string, T5Candidate[]>;
  warnings: string[];
}

export function prepareT5Search(request: T5SearchRequest): PreparedT5Search {
  const domains = buildT5Domains(request);
  const arrangementRequest = t5ArrangementRequest(request);
  const arrangementDomains = buildT5Domains(arrangementRequest);
  const warnings: string[] = [];
  const arrangementTheoryDomains = arrangementDomains.map(
    (domain) =>
      new Map(
        [...domain].map(([name, choices]) => [
          name,
          generationRolls(choices, arrangementRequest.achievableOnly),
        ])
      )
  );
  const pooled = new Map<string, T5Candidate[]>();
  for (const domain of arrangementTheoryDomains)
    for (const [name, choices] of domain)
      pooled.set(name, [...(pooled.get(name) ?? []), ...choices]);
  const archetypeDomains = new Map(
    [...pooled].map(([name, choices]) => [
      name,
      generationRolls(choices, request.achievableOnly).map((piece) => ({
        ...piece,
        slot:
          piece.isExotic && piece.slot === ArmorSlot.ArmorSlotClass
            ? ArmorSlot.ArmorSlotClass
            : ArmorSlot.ArmorSlotNone,
      })),
    ])
  );
  if (
    !arrangementRequest.achievableOnly &&
    request.manifest.some(
      (item) =>
        item.isExotic &&
        item.slot === ArmorSlot.ArmorSlotClass &&
        exoticAllowed(item.hash, request.config)
    )
  ) {
    warnings.push(
      "Exotic class-item theory uses known perk-defined rolls from your loaded inventory/source data; unobserved Spirit pairs are not enumerated."
    );
  }
  return {
    domains,
    arrangementDomains,
    theoryDomains: arrangementTheoryDomains,
    archetypeDomains,
    warnings,
  };
}

export function inventoryFitT5(
  arrangement: T5Arrangement,
  request: T5SearchRequest,
  prepared: PreparedT5Search
): NonNullable<T5Arrangement["inventoryMatch"]> {
  const names = new Set(arrangement.archetypes.map((entry) => entry.name));
  const tertiaries = new Set(arrangement.tertiaries.map((entry) => entry.stat));
  const domains = prepared.domains.map((domain) =>
    [...domain.values()]
      .flat()
      .filter((item) => names.has(item.archetype) && tertiaries.has(item.tertiary))
  );
  if (domains.some((items) => !items.length))
    return { covered: 0, owned: 0, proven: true, pieces: [], feasible: false };
  const problem = createT5OptimizationModel(domains, request.config);
  constrainT5Arrangement(problem, arrangement);
  problem.model.options = { ...problem.model.options, timeout: 500 };
  const solved = solveT5Optimization(problem);
  const witness = t5OptimizationSolution(problem, solved);
  return {
    covered: witness?.covered ?? 0,
    owned: witness?.owned ?? 0,
    proven: solved["optimal"] === true,
    pieces: witness?.pieces.filter((piece) => piece.instanceId) ?? [],
    feasible: !!witness,
  };
}

export function* matchT5Inventory(
  request: T5SearchRequest,
  prepared: PreparedT5Search
): Generator<T5SearchUpdate> {
  const arrangements = request.matchArrangements ?? [];
  for (let index = 0; index < arrangements.length; index++) {
    const arrangement = arrangements[index];
    const match = inventoryFitT5(arrangement, request, prepared);
    yield {
      results: [],
      inventoryMatches: [{ key: arrangement.key, match }],
      checked: index + 1,
      total: arrangements.length,
      feasible: Number(match.feasible),
      evaluations: index + 1,
      done: index + 1 === arrangements.length,
      complete: index + 1 === arrangements.length,
      warnings: [],
    };
  }
  if (!arrangements.length)
    yield {
      results: [],
      checked: 0,
      total: 0,
      feasible: 0,
      evaluations: 0,
      done: true,
      complete: true,
      warnings: [],
    };
}

export function* searchT5(
  request: T5SearchRequest,
  solve = solveT5Optimization,
  prepared?: PreparedT5Search,
  slice?: { maxRetriesWithoutProgress: number }
): Generator<T5SearchUpdate> {
  const arrangeOnly = request.stage !== "builds";
  const config = arrangeOnly
    ? (request.arrangementConfig ?? t5ArrangementConfiguration(request.config))
    : request.config;
  const errors = t5CompatibilityErrors(config);
  if (errors.length) {
    yield {
      results: [],
      checked: 0,
      total: 0,
      feasible: 0,
      evaluations: 0,
      complete: false,
      done: true,
      warnings: [],
      error: errors.join(" "),
    };
    return;
  }
  const cache = prepared ?? prepareT5Search(request);
  const domains = arrangeOnly ? cache.arrangementDomains : cache.domains;
  const keys = domains.map((domain, slot) =>
    [...domain.keys()].filter((key) => !request.group || key === request.group[slot])
  );
  if (request.task?.archetypeCounts) {
    for (let slot = 0; slot < keys.length; slot++)
      keys[slot] = keys[slot].filter((key) => request.task!.archetypes.includes(key));
  } else if (request.task) {
    request.task.archetypes.forEach((archetype, slot) => {
      keys[slot] = keys[slot].filter((key) => key === archetype);
    });
  }
  if (request.partition) {
    const { index, count } = request.partition;
    keys[0] = keys[0].filter((_, position) => position % count === index);
  }
  const total = keys.reduce((product, slot) => product * slot.length, 1);
  const allRolls = domains.map((domain, slot) => keys[slot].flatMap((key) => domain.get(key)!));
  const possibleRollCombinations = allRolls.reduce(
    (product, choices) =>
      product * new Set(choices.map((item) => t5ItemStats(item).join(","))).size,
    1
  );
  const results: T5Solution[] = [];
  const arrangements: T5Arrangement[] = [];
  const warnings = [...cache.warnings];
  const limit = Math.max(1, config.parsedResultLimit || 30000);
  let started = Date.now();
  let checked = 0;
  let feasible = 0;
  let evaluations = 0;
  let timedOut = false;
  let lastUpdate = started;
  const timedOutNow = () => {
    if (request.timeLimitMs > 0 && Date.now() - started >= request.timeLimitMs) timedOut = true;
    return timedOut;
  };
  let maximumPossibleStats = Array<number>(6).fill(0);
  let maximaComplete = false;
  yield {
    results: [],
    checked: 0,
    total,
    feasible: 0,
    evaluations: 0,
    complete: false,
    done: false,
    warnings,
    maximumPossibleStats,
    possibleRollCombinations,
    maximaChecked: 0,
    maximaComplete,
  };
  if (total && !request.skipMaxima) {
    for (const update of t5MaximumStatUpdates(allRolls, config)) {
      maximumPossibleStats = update.values;
      maximaComplete = update.complete;
      if (update.checked === 6 && !update.complete)
        warnings.push(
          "Some maxima are conservative because optimization reached its limit. Displayed values remain reachable without lowering other targets."
        );
      yield {
        results: [],
        checked: 0,
        total,
        feasible: 0,
        evaluations: 0,
        complete: false,
        done: false,
        warnings,
        maximumPossibleStats,
        possibleRollCombinations,
        maximaChecked: update.checked,
        maximaComplete,
      };
    }
  }

  if (request.stage === "maxima") {
    yield {
      results: [],
      checked: 0,
      total,
      feasible: 0,
      evaluations: 0,
      complete: true,
      done: true,
      warnings,
      maximumPossibleStats,
      possibleRollCombinations,
      maximaChecked: 6,
      maximaComplete,
      stopReason: "exhausted",
    };
    return;
  }

  started = Date.now();
  lastUpdate = started;
  const generationRollsBySlot =
    arrangeOnly && request.task?.archetypeCounts
      ? request.task.archetypes.map((name) =>
          (cache.archetypeDomains.get(name) ?? []).filter(
            (item) =>
              !request.task!.tertiaries ||
              request.task!.tertiaries.some((entry) => entry.stat === item.tertiary)
          )
        )
      : arrangeOnly
        ? cache.theoryDomains.map((domain, slot) => keys[slot].flatMap((key) => domain.get(key)!))
        : allRolls;
  const generationDomains = generationRollsBySlot.map((choices) =>
    request.arrangement
      ? choices.filter(
          (item) =>
            request.arrangement!.archetypes.some((entry) => entry.name === item.archetype) &&
            request.arrangement!.tertiaries.some((entry) => entry.stat === item.tertiary)
        )
      : choices
  );
  const relevantRolls = generationDomains.map((choices, slot) =>
    choices.filter((candidate) => {
      const partial = generationDomains.map((other, index) =>
        index === slot ? [candidate] : other
      );
      return t5BoundsCanReach(t5StatBounds(partial, config), config);
    })
  );
  const problem = createT5OptimizationModel(relevantRolls, config);
  if (request.task?.archetypeCounts && !arrangeOnly) {
    const counts = new Map<string, number>();
    for (const name of request.task.archetypes) counts.set(name, (counts.get(name) ?? 0) + 1);
    constrainT5ArchetypeCounts(
      problem,
      [...counts].map(([name, count]) => ({ name, count }))
    );
  }
  if (!arrangeOnly) problem.model.constraints["covered"] = { min: 3 };
  if (request.arrangement) constrainT5Arrangement(problem, request.arrangement);
  if (request.task?.tertiaries) constrainT5TertiaryCounts(problem, request.task.tertiaries);
  if (!arrangeOnly && request.buildPartition) partitionT5Builds(problem, request.buildPartition);
  const visitedGroups = new Set<string>();
  const retainedPatterns = new Set<string>();
  let exhausted = false;
  let patternIndex = 0;
  for (const arrangement of request.task?.excludedArrangements ?? [])
    excludeT5Arrangement(problem, arrangement, patternIndex++);
  let solverRetries = 0;
  let retriesWithoutProgress = 0;
  let solveTimeoutMs = problem.model.options?.timeout ?? 150;
  while (!exhausted && relevantRolls.every((choices) => choices.length > 0)) {
    const deferred = !!slice && retriesWithoutProgress >= slice.maxRetriesWithoutProgress;
    if (timedOutNow() || deferred) {
      if (!slice) break;
      yield {
        results: results.slice(0, limit),
        arrangements: [...arrangements],
        checked,
        total,
        feasible,
        evaluations,
        complete: false,
        done: true,
        warnings,
        maximumPossibleStats,
        possibleRollCombinations,
        maximaChecked: 6,
        maximaComplete,
        solverRetries,
        stopReason: "slice",
        taskDeferred: deferred,
      };
      started = Date.now();
      lastUpdate = started;
      timedOut = false;
      retriesWithoutProgress = 0;
    }
    const remainingMs =
      request.timeLimitMs > 0
        ? Math.max(1, request.timeLimitMs - (Date.now() - started))
        : Infinity;
    problem.model.options = {
      ...problem.model.options,
      timeout: Math.min(solveTimeoutMs, remainingMs),
    };
    const solved = solve(problem);
    evaluations++;
    const pattern = t5OptimizationSolution(problem, solved);
    if (!pattern) {
      if (solved["optimal"] === true) {
        exhausted = true;
        break;
      }
      solverRetries++;
      retriesWithoutProgress++;
      solveTimeoutMs = Math.min(4000, solveTimeoutMs * 2);
      results.sort(compareT5Solutions);
      yield {
        results: results.slice(0, limit),
        checked,
        total,
        feasible,
        evaluations,
        complete: false,
        done: false,
        arrangements: [...arrangements],
        warnings,
        maximumPossibleStats,
        possibleRollCombinations,
        maximaChecked: 6,
        maximaComplete,
        solverRetries,
      };
      lastUpdate = Date.now();
      continue;
    }
    retriesWithoutProgress = 0;
    const patternKey = JSON.stringify(
      pattern.pieces.map((piece, slot) => [
        piece.archetype,
        piece.tertiary,
        piece.isExotic ? piece.hash : null,
        piece.exoticPerkHash ?? [],
        t5TuningStat(pattern.tuningMods[slot]) ??
          (pattern.tuningMods[slot] === 3122197216 ? "balanced" : "none"),
      ])
    );
    pattern.patternKey = patternKey;
    pattern.key = patternKey;
    if (arrangeOnly) {
      const arrangement = t5ArrangementFromPieces(
        pattern.pieces,
        pattern.tuningMods,
        pattern.result
      );
      if (!visitedGroups.has(arrangement.key)) {
        visitedGroups.add(arrangement.key);
        arrangements.push(arrangement);
        feasible++;
      }
      checked = visitedGroups.size;
      excludeT5Arrangement(problem, arrangement, patternIndex++);
      yield {
        results: [],
        arrangements: [...arrangements],
        checked,
        total,
        feasible,
        evaluations,
        complete: false,
        done: false,
        warnings,
        maximumPossibleStats,
        possibleRollCombinations,
        maximaChecked: 6,
        maximaComplete,
        solverRetries,
      };
      lastUpdate = Date.now();
      continue;
    }
    const arrangementKey = pattern.pieces
      .map((piece) => piece.archetype)
      .sort()
      .join("|");
    const newArrangement = !visitedGroups.has(arrangementKey);
    visitedGroups.add(arrangementKey);
    checked = visitedGroups.size;
    const solution = retainedPatterns.has(patternKey)
      ? null
      : matchT5Pattern(pattern, domains, config, request.achievableOnly);
    retainedPatterns.add(patternKey);
    if (solution && solution.covered >= 3) {
      feasible++;
      results.push(solution);
      if (results.length > limit + 100) {
        results.sort(compareT5Solutions);
        results.length = limit;
      }
    }
    excludeT5Pattern(problem, solved, patternIndex++);
    if (newArrangement || feasible === 1 || Date.now() - lastUpdate >= 250) {
      results.sort(compareT5Solutions);
      yield {
        results: results.slice(0, limit),
        checked,
        total,
        feasible,
        evaluations,
        complete: false,
        done: false,
        warnings,
        maximumPossibleStats,
        possibleRollCombinations,
        maximaChecked: 6,
        maximaComplete,
        solverRetries,
      };
      lastUpdate = Date.now();
    }
  }
  results.sort(compareT5Solutions);
  yield {
    results: results.slice(0, limit),
    checked,
    total,
    feasible,
    evaluations,
    complete: !timedOut && !warnings.some((warning) => warning.includes("partial")),
    done: true,
    arrangements: [...arrangements],
    warnings,
    maximumPossibleStats,
    possibleRollCombinations,
    maximaChecked: 6,
    maximaComplete,
    solverRetries,
    stopReason: timedOut ? "budget" : "exhausted",
  };
}
