/*
 * Copyright (c) 2023 D2ArmorPicker by Mijago.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

// region Imports
import { BuildConfiguration, FixableSelection } from "../data/buildConfiguration";
import { IDestinyArmor } from "../data/types/IInventoryArmor";
import { ArmorSlot } from "../data/enum/armor-slot";
import { FORCE_USE_ANY_EXOTIC, MAXIMUM_MASTERWORK_LEVEL } from "../data/constants";
import { ModInformation } from "../data/ModInformation";
import {
  ArmorPerkOrSlot,
  ArmorPerkSocketHashes,
  ArmorStat,
  SpecialArmorStat,
  STAT_MOD_VALUES,
  StatModifier,
} from "../data/enum/armor-stat";

import { environment } from "../../environments/environment";

import { ModOptimizationStrategy } from "../data/enum/mod-optimization-strategy";
import { IPermutatorArmor } from "../data/types/IPermutatorArmor";
import {
  IPermutatorArmorSet,
  Tuning,
  createArmorSet,
  isIPermutatorArmorSet,
} from "../data/types/IPermutatorArmorSet";
import { ArmorSystem } from "../data/types/IManifestArmor";

import { precalculatedTuningModCombinations } from "../data/generated/precalculatedModCombinationsWithTunings";

// endregion Imports

type t5Improvement = {
  tuningStat: ArmorStat | null; // null = flexible (exotic): +5 can target any stat
  archetypeStats: ArmorStat[];
  flexible: boolean;
  balancedBonus: number[]; // +1 to the 3 lowest base stats (Balanced Tuning)
};

// IPermutatorArmor carries optional worker-scratch fields (_mw/_tune/_art/_tuneTot/_sum) filled in
// by the Phase-1 branch-and-bound `annotate` step. AnnotatedArmor narrows them to required so the
// gate/suffix code reads them without `as any`; only cast a pool to it AFTER annotate has run.
type AnnotatedArmor = IPermutatorArmor & {
  _mw: number[];
  _tune: number[];
  _art: number;
  _tuneTot: number;
  _sum: number;
};

// Monument of Triumph: exotics are Tier 5 with access to ALL tuning mods, so their +5 can
// target any stat (no fixed tuningStat). Exotic tier is forced to 5 during ingestion.
export function isFlexibleExotic(i: IPermutatorArmor): boolean {
  return i.isExotic === 1 && i.armorSystem == ArmorSystem.Armor3;
}

// Balanced Tuning grants +1 to the three lowest stats on the piece (sandbox perk 1577360915).
export function lowestThreeBonus(i: IPermutatorArmor): number[] {
  const s = [i.mobility, i.resilience, i.recovery, i.discipline, i.intellect, i.strength];
  const order = s.map((v, n) => [v, n]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const bonus = [0, 0, 0, 0, 0, 0];
  for (let k = 0; k < 3; k++) bonus[order[k][1]] = 1;
  return bonus;
}

export function isT5WithTuning(i: IPermutatorArmor): boolean {
  if (i.armorSystem != ArmorSystem.Armor3) return false;
  if (isFlexibleExotic(i)) return true; // exotic: flexible tuning, no fixed tuningStat required
  return i.tier >= 5 && !!i.archetypeStats && i.tuningStat !== undefined && i.tuningStat !== null;
}

function mapItemToTuning(i: IPermutatorArmor): t5Improvement {
  return {
    tuningStat: isFlexibleExotic(i) ? null : i.tuningStat!,
    archetypeStats: i.archetypeStats ?? [],
    flexible: isFlexibleExotic(i),
    balancedBonus: lowestThreeBonus(i),
  };
}

// region Validation and Preparation Functions
function checkSlots(
  config: BuildConfiguration,
  constantModslotRequirement: Map<number, number>,
  availableClassItemTypes: Set<ArmorPerkOrSlot>,
  helmet: IPermutatorArmor,
  gauntlet: IPermutatorArmor,
  chest: IPermutatorArmor,
  leg: IPermutatorArmor
) {
  let requirements = new Map(constantModslotRequirement);
  const slots = [
    { slot: ArmorSlot.ArmorSlotHelmet, item: helmet },
    { slot: ArmorSlot.ArmorSlotGauntlet, item: gauntlet },
    { slot: ArmorSlot.ArmorSlotChest, item: chest },
    { slot: ArmorSlot.ArmorSlotLegs, item: leg },
  ];

  for (let { item } of slots) {
    if (item.armorSystem === ArmorSystem.Armor2) {
      if (
        (item.isExotic && config.assumeEveryLegendaryIsArtifice) ||
        (!item.isExotic && config.assumeEveryLegendaryIsArtifice) ||
        (!item.isExotic &&
          item.slot == ArmorSlot.ArmorSlotClass &&
          config.assumeClassItemIsArtifice)
      ) {
        requirements.set(
          ArmorPerkOrSlot.SlotArtifice,
          (requirements.get(ArmorPerkOrSlot.SlotArtifice) ?? 0) - 1
        );
        continue;
      }
    }

    requirements.set(item.perk, (requirements.get(item.perk) ?? 0) - 1);
    if (item.gearSetHash != null)
      requirements.set(item.gearSetHash, (requirements.get(item.gearSetHash) ?? 0) - 1);
  }

  let SlotRequirements = 0;
  for (let [key] of requirements) {
    if (key == ArmorPerkOrSlot.Any || key == ArmorPerkOrSlot.None) continue;
    SlotRequirements += Math.max(0, requirements.get(key) ?? 0);
  }

  if (SlotRequirements > 1) return { valid: false };
  if (SlotRequirements == 0) return { valid: true, requiredClassItemType: ArmorPerkOrSlot.Any };

  const requiredClassItemPerk = [...requirements.entries()].find((c) => c[1] > 0)?.[0];
  if (!requiredClassItemPerk) return { valid: false, requiredClassItemType: ArmorPerkOrSlot.Any };
  return {
    valid: availableClassItemTypes.has(requiredClassItemPerk),
    requiredClassItemType: requiredClassItemPerk,
  };
}

function prepareConstantStatBonus(config: BuildConfiguration) {
  const constantBonus = [0, 0, 0, 0, 0, 0];
  // Apply configurated mods to the stat value
  // Apply mods
  for (const mod of config.enabledMods) {
    for (const bonus of ModInformation[mod].bonus) {
      var statId =
        bonus.stat == SpecialArmorStat.ClassAbilityRegenerationStat
          ? [1, 0, 2][config.characterClass]
          : bonus.stat;
      constantBonus[statId] += bonus.value;
    }
  }
  return constantBonus;
}

function prepareConstantModslotRequirement(config: BuildConfiguration) {
  let constantPerkRequirement = new Map<ArmorPerkOrSlot, number>();

  for (const req of config.armorRequirements) {
    if ("perk" in req) {
      let perk = req.perk;

      const e = Object.entries(ArmorPerkSocketHashes).find(([, value]) => value == perk);
      if (e) perk = Number.parseInt(e[0]) as any as ArmorPerkOrSlot;

      if (perk != ArmorPerkOrSlot.Any && perk != ArmorPerkOrSlot.None) {
        constantPerkRequirement.set(perk, (constantPerkRequirement.get(perk) ?? 0) + 1);
      }
    } else if ("gearSetHash" in req) {
      // Gear set requirement
      constantPerkRequirement.set(
        req.gearSetHash,
        (constantPerkRequirement.get(req.gearSetHash) ?? 0) + 1
      );
    }
  }
  return constantPerkRequirement;
}

function* generateArmorCombinations(
  helmets: IPermutatorArmor[],
  gauntlets: IPermutatorArmor[],
  chests: IPermutatorArmor[],
  legs: IPermutatorArmor[],
  requiresAtLeastOneExotic: boolean
) {
  for (let helmet of helmets) {
    for (let gauntlet of gauntlets) {
      if (helmet.isExotic && gauntlet.isExotic) continue;
      for (let chest of chests) {
        if ((helmet.isExotic || gauntlet.isExotic) && chest.isExotic) continue;
        for (let leg of legs) {
          if ((helmet.isExotic || gauntlet.isExotic || chest.isExotic) && leg.isExotic) continue;
          if (
            requiresAtLeastOneExotic &&
            !(helmet.isExotic || gauntlet.isExotic || chest.isExotic || leg.isExotic)
          )
            continue;

          yield [helmet, gauntlet, chest, leg];
        }
      }
    }
  }
}

function estimateCombinationsToBeChecked(
  helmets: IPermutatorArmor[],
  gauntlets: IPermutatorArmor[],
  chests: IPermutatorArmor[],
  legs: IPermutatorArmor[]
) {
  let totalCalculations = 0;
  const exoticHelmets = helmets.filter((d) => d.isExotic).length;
  const legendaryHelmets = helmets.length - exoticHelmets;
  const exoticGauntlets = gauntlets.filter((d) => d.isExotic).length;
  const legendaryGauntlets = gauntlets.length - exoticGauntlets;
  const exoticChests = chests.filter((d) => d.isExotic).length;
  const legendaryChests = chests.length - exoticChests;
  const exoticLegs = legs.filter((d) => d.isExotic).length;
  const legendaryLegs = legs.length - exoticLegs;
  totalCalculations += exoticHelmets * legendaryGauntlets * legendaryChests * legendaryLegs;
  totalCalculations += legendaryHelmets * exoticGauntlets * legendaryChests * legendaryLegs;
  totalCalculations += legendaryHelmets * legendaryGauntlets * exoticChests * legendaryLegs;
  totalCalculations += legendaryHelmets * legendaryGauntlets * legendaryChests * exoticLegs;
  totalCalculations += legendaryHelmets * legendaryGauntlets * legendaryChests * legendaryLegs;
  return totalCalculations;
}
// endregion Validation and Preparation Functions

// region Main Worker Event Handler
addEventListener("message", async ({ data }) => {
  if (data.type != "builderRequest") return;

  const threadSplit = data.threadSplit as { count: number; current: number };
  const config = data.config as BuildConfiguration;
  const anyStatFixed = Object.values(config.minimumStatTiers).some(
    (v: FixableSelection<number>) => v.fixed
  );
  let items = data.items as IPermutatorArmor[];

  if (threadSplit == undefined || config == undefined || items == undefined) {
    return;
  }

  const startTime = Date.now();
  console.log(`Thread ${threadSplit.current} started with ${items.length} items to process.`);
  console.time(`Total run thread#${threadSplit.current}`);
  // toggle feature flags
  config.onlyShowResultsWithNoWastedStats =
    environment.featureFlags.enableZeroWaste && config.onlyShowResultsWithNoWastedStats;
  if (!environment.featureFlags.enableModslotLimitation) {
    config.statModLimits = {
      maxMods: 5, // M: total mods allowed (0–5)
      maxMajorMods: 5, // N: major mods allowed (0–maxMods)
    };
  }

  let helmets = items
    .filter((i) => i.slot == ArmorSlot.ArmorSlotHelmet)
    .filter((k) => {
      return (
        !config.useFotlArmor ||
        [
          199733460, // titan masq
          2545426109, // warlock
          3224066584, // hunter
          2390807586, // titan new fotl
          2462335932, // hunter new fotl
          4095816113, // warlock new fotl
        ].indexOf(k.hash) > -1
      );
    });
  let gauntlets = items.filter((i) => i.slot == ArmorSlot.ArmorSlotGauntlet);
  let chests = items.filter((i) => i.slot == ArmorSlot.ArmorSlotChest);
  let legs = items.filter((i) => i.slot == ArmorSlot.ArmorSlotLegs);
  let classItems = items.filter((i) => i.slot == ArmorSlot.ArmorSlotClass);

  // Sort by Masterwork, descending
  classItems = classItems.sort(
    (a, b) => (b.tier ?? 0) - (a.tier ?? 0) || (b.masterworkLevel ?? 0) - (a.masterworkLevel ?? 0)
  );

  // Filter exotic class items based on selected exotic perks if they are not "Any"
  if (config.selectedExoticPerks && config.selectedExoticPerks.length >= 2) {
    const firstPerkFilter = config.selectedExoticPerks[0];
    const secondPerkFilter = config.selectedExoticPerks[1];

    if (firstPerkFilter !== ArmorPerkOrSlot.Any || secondPerkFilter !== ArmorPerkOrSlot.Any) {
      classItems = classItems.filter((item) => {
        if (!item.isExotic || !item.exoticPerkHash || item.exoticPerkHash.length < 2) {
          return true; // Keep non-exotic items or items without proper perk data
        }

        const hasFirstPerk =
          firstPerkFilter === ArmorPerkOrSlot.Any || item.exoticPerkHash.includes(firstPerkFilter);
        const hasSecondPerk =
          secondPerkFilter === ArmorPerkOrSlot.Any ||
          item.exoticPerkHash.includes(secondPerkFilter);

        return hasFirstPerk && hasSecondPerk;
      });
    }
  }

  if (
    config.assumeEveryLegendaryIsArtifice ||
    config.assumeEveryExoticIsArtifice ||
    config.assumeClassItemIsArtifice
  ) {
    classItems = classItems.map((item) => {
      if (
        item.armorSystem == ArmorSystem.Armor2 &&
        ((config.assumeEveryLegendaryIsArtifice && !item.isExotic) ||
          (config.assumeEveryExoticIsArtifice && item.isExotic) ||
          (config.assumeClassItemIsArtifice && !item.isExotic))
      ) {
        return { ...item, perk: ArmorPerkOrSlot.SlotArtifice };
      }
      return item;
    });
  }

  // true if any armorPerks is not "any"
  const doesNotRequireArmorPerks = config.armorRequirements.length == 0;

  classItems = classItems.filter(
    (item, index, self) =>
      index ===
      self.findIndex(
        (i) =>
          i.mobility === item.mobility &&
          i.resilience === item.resilience &&
          i.recovery === item.recovery &&
          i.discipline === item.discipline &&
          i.intellect === item.intellect &&
          i.strength === item.strength &&
          i.isExotic === item.isExotic &&
          ((i.tier < 5 && item.tier < 5) || i.tuningStat == item.tuningStat) &&
          ((i.isExotic && config.assumeExoticsMasterworked) ||
            (!i.isExotic && config.assumeLegendariesMasterworked) ||
            // If there is any stat fixed, we check if the masterwork level is the same as the first item
            (anyStatFixed && i.masterworkLevel === item.masterworkLevel) ||
            // If there is no stat fixed, then we just use the masterwork level of the first item.
            // As it is already sorted descending, we can just check if the masterwork level is the same
            !anyStatFixed) &&
          (doesNotRequireArmorPerks || (i.perk === item.perk && i.gearSetHash === item.gearSetHash))
      )
  );

  // Per-slot Pareto pruning (Phase 3): drop pieces that can never beat a kept same-profile piece,
  // shrinking the H×G×C×L×classItem cartesian multiplicatively. Lossless for the per-(exotic+set)
  // best output (a dominated piece's builds are dominated by the kept piece's) — gated by
  // npm run diff:pruning-best. Runs before the thread split so every thread prunes identically.
  if (data.enablePerSlotPruning !== false) {
    helmets = pruneDominatedPerSlot(helmets, config);
    gauntlets = pruneDominatedPerSlot(gauntlets, config);
    chests = pruneDominatedPerSlot(chests, config);
    legs = pruneDominatedPerSlot(legs, config);
    classItems = pruneDominatedPerSlot(classItems, config);
  }

  // Support multithreading. Find the largest set and split it by N, ensuring even exotic distribution.
  if (threadSplit.count > 1) {
    // Find the largest slot array
    const slotArrays: [IPermutatorArmor[], number, string][] = [
      [helmets, helmets.length, "helmets"],
      [gauntlets, gauntlets.length, "gauntlets"],
      [chests, chests.length, "chests"],
      [legs, legs.length, "legs"],
      [classItems, classItems.length, "class"],
    ];
    slotArrays.sort((a, b) => b[1] - a[1]);
    const splitEntry = slotArrays[0][0];
    const splitEntryName = slotArrays[0][2];

    // Separate exotics and non-exotics
    const exotics = splitEntry.filter((i) => i.isExotic);
    const nonExotics = splitEntry.filter((i) => !i.isExotic);

    // Deterministically sort both groups (by hash, then by masterworkLevel, then by name if available)
    const stableSort = (arr: IPermutatorArmor[]) =>
      arr.slice().sort((a, b) => {
        if (a.hash !== b.hash) return a.hash - b.hash;
        if ((a.masterworkLevel ?? 0) !== (b.masterworkLevel ?? 0))
          return (a.masterworkLevel ?? 0) - (b.masterworkLevel ?? 0);
        return 0;
      });
    const sortedExotics = stableSort(exotics);
    const sortedNonExotics = stableSort(nonExotics);

    // Helper to split an array into N nearly equal, deterministic batches
    function splitIntoBatches<T>(arr: T[], batchCount: number): T[][] {
      const batches: T[][] = Array.from({ length: batchCount }, () => []);
      for (let i = 0; i < arr.length; ++i) {
        // Distribute round-robin for determinism
        batches[i % batchCount].push(arr[i]);
      }
      return batches;
    }

    const exoticBatches = splitIntoBatches(sortedExotics, threadSplit.count);
    const nonExoticBatches = splitIntoBatches(sortedNonExotics, threadSplit.count);

    // For this thread, combine the corresponding exotic and non-exotic batch
    const batch = [...exoticBatches[threadSplit.current], ...nonExoticBatches[threadSplit.current]];

    // Replace the original slot array with the batch for this thread
    switch (splitEntryName) {
      case "helmets":
        helmets = batch;
        break;
      case "gauntlets":
        gauntlets = batch;
        break;
      case "chests":
        chests = batch;
        break;
      case "legs":
        legs = batch;
        break;
      case "class":
        classItems = batch;
        break;
    }
  }

  const exoticClassItems = classItems.filter((d) => d.isExotic);
  const legendaryClassItems = classItems.filter((d) => !d.isExotic);
  const exoticClassItemIsEnforced = exoticClassItems.some(
    (item) => config.selectedExotics.indexOf(item.hash) > -1
  );
  let availableClassItemPerkTypes = new Set(classItems.map((d) => d.gearSetHash || d.perk));

  // runtime variables
  const runtime = {
    maximumPossibleTiers: [0, 0, 0, 0, 0, 0],
  };

  if (classItems.length == 0) {
    console.warn(
      `Thread#${threadSplit.current} - No class items found with the current configuration.`
    );
    postMessage({
      runtime: runtime,
      results: [],
      done: true,
      checkedCalculations: 0,
      estimatedCalculations: 0,
      stats: {
        permutationCount: 0,
        itemCount: items.length - classItems.length,
        totalTime: Date.now() - startTime,
      },
    });
    return;
  } else if (exoticClassItems.length > 0 && legendaryClassItems.length == 0) {
    // If we do not have legendary class items, we can not use any exotic armor in other slots
    helmets = helmets.filter((d) => !d.isExotic);
    gauntlets = gauntlets.filter((d) => !d.isExotic);
    chests = chests.filter((d) => !d.isExotic);
    legs = legs.filter((d) => !d.isExotic);
  }

  const constantBonus = prepareConstantStatBonus(config);
  const constantModslotRequirement = prepareConstantModslotRequirement(config);

  // Per-slot stat maxima (base+MW), computed once and reused for: (a) handlePermutation's per-core
  // abort (maxClassContribution), (b) the global feasibility pre-check below, (c) the global
  // per-stat ceiling used by the fast-mode early walk-termination.
  const slotMaxHelmet = slotMaxima(helmets, config);
  const slotMaxGauntlet = slotMaxima(gauntlets, config);
  const slotMaxChest = slotMaxima(chests, config);
  const slotMaxLeg = slotMaxima(legs, config);
  const slotMaxClass = slotMaxima(classItems, config);
  const maxClassContribution = slotMaxClass.perStat;
  const globalMaxMajor = config.statModLimits?.maxMajorMods || 0;
  const globalMaxModsN = config.statModLimits?.maxMods || 0;
  const globalModTotal = 10 * globalMaxMajor + 5 * Math.max(0, globalMaxModsN - globalMaxMajor);
  const globalArtificeTotal = 3 * 5; // up to one artifice mod per slot
  const globalTuningPerStat = 5 * 5; // up to 5 T5 pieces each +5 to one stat
  // Upper bound on the value ANY build can reach on each stat (every term maximised independently,
  // capped at 200). maximumPossibleTiers[s] can never exceed this; if it REACHES it, stat s is
  // provably maxed out. Used only as a safe stop condition (never to set a reported value).
  const globalStatCeil: number[] = [0, 0, 0, 0, 0, 0];
  for (let s = 0; s < 6; s++) {
    globalStatCeil[s] = Math.min(
      200,
      (constantBonus[s] || 0) +
        slotMaxHelmet.perStat[s] +
        slotMaxGauntlet.perStat[s] +
        slotMaxChest.perStat[s] +
        slotMaxLeg.perStat[s] +
        slotMaxClass.perStat[s] +
        globalTuningPerStat +
        globalModTotal +
        globalArtificeTotal
    );
  }

  // GLOBAL feasibility pre-check: if the target can't be met even by the best piece in EACH slot
  // (+ max tuning/mods/artifice), then no combination can — return immediately WITHOUT iterating
  // the (potentially 100M+) cartesian. This makes impossible / very tight targets instant.
  {
    const tv: number[] = [0, 0, 0, 0, 0, 0];
    let anyTarget = false;
    for (let n: ArmorStat = 0; n < 6; n++) {
      tv[n] = (config.minimumStatTiers[n].value || 0) * 10;
      if (tv[n] > 0) anyTarget = true;
    }
    if (anyTarget) {
      const H = slotMaxHelmet;
      const G = slotMaxGauntlet;
      const C = slotMaxChest;
      const L = slotMaxLeg;
      const Cl = slotMaxClass;
      const modTotal = globalModTotal;
      const artificeTotal = globalArtificeTotal;
      const tuningPerStat = globalTuningPerStat;
      let infeasible = false;
      // (a) per-stat: some target individually unreachable by the best-of-each-slot
      for (let n = 0; n < 6; n++) {
        if (tv[n] <= 0) continue;
        const reach =
          (constantBonus[n] || 0) +
          H.perStat[n] +
          G.perStat[n] +
          C.perStat[n] +
          L.perStat[n] +
          Cl.perStat[n] +
          tuningPerStat +
          modTotal +
          artificeTotal;
        if (reach < tv[n]) {
          infeasible = true;
          break;
        }
      }
      // (b) targeted-subset budget: the SUM over the targeted stats exceeds the best achievable
      // sum on exactly those stats. This catches "2 stats at 200" etc. — the build can't pour its
      // whole stat budget into just the requested stats. Bound = best single piece per slot ON the
      // targeted stats + the SHARED mod/artifice budget + a generous +5/T5-piece tuning allowance.
      if (!infeasible) {
        const targeted = tv.map((v) => v > 0);
        let targetSum = 0;
        let cbTargeted = 0;
        for (let n = 0; n < 6; n++)
          if (targeted[n]) {
            targetSum += tv[n];
            cbTargeted += constantBonus[n] || 0;
          }
        const maxOnTargeted =
          cbTargeted +
          maxSlotContributionOnStats(helmets, config, targeted) +
          maxSlotContributionOnStats(gauntlets, config, targeted) +
          maxSlotContributionOnStats(chests, config, targeted) +
          maxSlotContributionOnStats(legs, config, targeted) +
          maxSlotContributionOnStats(classItems, config, targeted) +
          modTotal +
          artificeTotal +
          5 * 5; // up to +5 per T5 piece (5 slots) onto a targeted stat
        if (targetSum > maxOnTargeted) infeasible = true;
      }
      if (infeasible) {
        const est = estimateCombinationsToBeChecked(helmets, gauntlets, chests, legs);
        // @ts-ignore
        postMessage({
          runtime,
          results: [],
          done: true,
          checkedCalculations: est, // mark fully done so the progress bar completes
          estimatedCalculations: est,
          stats: {
            permutationCount: 0,
            itemCount: items.length - classItems.length,
            totalTime: Date.now() - startTime,
          },
        });
        return;
      }
    }
  }

  const requiresAtLeastOneExotic = config.selectedExotics.indexOf(FORCE_USE_ANY_EXOTIC) > -1;

  // Global Pareto frontier of builds, grouped by profile (which exotic + which set bonuses). We
  // keep only the non-dominated builds instead of every build: far fewer rows, no arbitrary 30k
  // cap (which silently dropped builds), and a build the user would actually pick is never lost.
  // The frontier structure is also what a branch-and-bound prune hooks into.
  const frontier = new Map<string, IPermutatorArmorSet[]>();
  const idToPiece = new Map<number, IPermutatorArmor>(items.map((i) => [i.id, i]));
  // raw-stat dominance is only valid when higher is strictly better; under fixed-stat / waste
  // limiting we keep all distinct builds (exact-dup collapse only).
  const frontierMoreIsBetter =
    !Object.values(config.minimumStatTiers).some((v: FixableSelection<number>) => v.fixed) &&
    !config.tryLimitWastedStats &&
    !config.onlyShowResultsWithNoWastedStats;

  // No-target fast path: when there are no stat targets (and more-is-better), the exact per-stat
  // reachable max is computable up front (computeExactNoTargetMax == the value the full walk
  // converges to). With it the fast-mode walk can stop AT the result cap (doNotOutput) instead of
  // walking on purely to saturate maximumPossibleTiers — the post-cap cores create no output, so
  // output stays byte-identical while maxTiers stays EXACT. null when targets exist / not
  // more-is-better (then the saturation-based stop below applies as before).
  let noTargetAnalyticMax: number[] | null = null;
  if (frontierMoreIsBetter && constantModslotRequirement.size === 0) {
    // size===0 guarantees checkSlots imposes no required class-item perk/set, so every ≤1-exotic
    // core is valid and ANY class item may pair with it — the precondition for the analytic to be
    // exact (it can't model a per-core class-item restriction). With requirements set we fall back
    // to the saturation stop below (correct, just slower) rather than risk over-reporting.
    let anyTarget = false;
    for (let n: ArmorStat = 0; n < 6; n++)
      if ((config.minimumStatTiers[n].value || 0) > 0) anyTarget = true;
    if (!anyTarget)
      noTargetAnalyticMax = computeExactNoTargetMax(
        [helmets, gauntlets, chests, legs, classItems],
        config,
        constantBonus,
        globalModTotal,
        requiresAtLeastOneExotic
      );
  }

  // TARGETED analogue: with 1-2 stat targets (and more-is-better, no required perk/set), the exact
  // per-stat max can be computed by computeLeanTargetedMax (subspace projection + fold + exact
  // budget allocation) — EXACTLY the value the post-cap tier-pass walk converges to, but without
  // walking those cores. Same break-at-cap mechanism as no-target. Restricted to ≤2 targets because
  // the K-frontier grows with target count (3+ -> fall back to the saturation walk). The same
  // size===0 precondition applies (no per-core class-item restriction the projection can't model).
  // Built LAZILY at the break (only when the cap actually fires) since it costs ~real work.
  const leanTargets: number[] = [];
  for (let n: ArmorStat = 0; n < 6; n++)
    leanTargets[n] = (config.minimumStatTiers[n].value || 0) * 10;
  const nLeanTargets = leanTargets.filter((v) => v > 0).length;
  const targetedLeanApplicable =
    frontierMoreIsBetter &&
    constantModslotRequirement.size === 0 &&
    nLeanTargets >= 1 &&
    nLeanTargets <= 2;
  let targetedLeanMax: number[] | null = null;

  let totalResults = 0;

  // Fast mode (config.limitParsedResults, default on): once enough builds have been OUTPUT, stop
  // CREATING more (doNotOutput) — but keep walking every core and keep running
  // performTierAvailabilityTesting, so maximumPossibleTiers stays EXACT (the tier pass is upstream
  // of the output-gated createArmorSet). Cores are walked strongest-first at no-target, so the cap
  // keeps the best builds; "the user only looks at ~50 anyway". The 1e6 hard cap always applies
  // (memory guard) even with the soft cap disabled. Both divided across threads.
  // __SOFTCAP__ is a TEST-ONLY override (set by the repro harness) to force the cap early so the
  // streaming/walk-break paths can be exercised on small pools; production never sets it.
  const resultSoftCap = (globalThis as any).__SOFTCAP__ || 3e4 / threadSplit.count;
  const resultHardCap = 1e6 / threadSplit.count;
  let doNotOutput = false;

  // Branch-and-bound incumbent: best TOTAL stats seen so far per (exotic+set) profile. Lets
  // handlePermutation skip the expensive build creation for any class-item build whose optimistic
  // capped-total ceiling is STRICTLY below its profile's incumbent — it can neither beat nor tie
  // the best, so the per-profile output is unchanged. Disabled under non-more-is-better (the output
  // is the full frontier there) and via data.enableBranchBound===false. The skip sits AFTER the
  // tier gate in handlePermutation, so it NEVER affects maximumPossibleTiers.
  const bestTotalByProfile: Map<string, number> | undefined =
    frontierMoreIsBetter && data.enableBranchBound !== false
      ? new Map<string, number>()
      : undefined;

  // === Branch-and-bound Phase 1: cheap, OPTIMISTIC per-core gate ===
  // Two-phase pruning (only when more-is-better). Phase 1 = this cheap per-core check; Phase 2 =
  // the existing exact handlePermutation, run on survivors only. A core is skipped ONLY when it
  // provably (a) cannot raise ANY stat's reachable max AND (b) cannot beat ANY reachable profile's
  // best total. Every ceiling here is rounded UP (optimistic) so the gate has NO false negatives:
  // the core achieving a true stat-max has an optimistic tier-ceiling >= the running max, so it is
  // never skipped -> maximumPossibleTiers stays EXACT, computed by the unchanged Phase-2 calc.
  const bbActive = !!bestTotalByProfile;
  // No-target detection: when there is NO stat target (and not waste-limiting, implied by bbActive),
  // get_mods adds NOTHING — output builds are pure base stats (no mods/tuning/artifice). The total
  // bound then drops the mod/tuning/artifice budget (only the class item adds to the total), which
  // makes it tight enough to prune. We ALSO only reorder the slots in this case: the descending
  // sort is what makes the prune effective, and reordering can shift the (order-dependent ±1)
  // reachable-tier binary search, so for targeted searches we keep the baseline order untouched.
  const bbNoTarget =
    bbActive && !Object.values(config.minimumStatTiers).some((v) => ((v as any).value || 0) > 0);
  if (bbActive) {
    const assumeLegArt = !!config.assumeEveryLegendaryIsArtifice;
    const assumeExoArt = !!config.assumeEveryExoticIsArtifice;
    const annotate = (pool: IPermutatorArmor[]) => {
      for (const p of pool) {
        const mw = [p.mobility, p.resilience, p.recovery, p.discipline, p.intellect, p.strength];
        applyMasterworkStats(p, config, mw);
        const tune = [0, 0, 0, 0, 0, 0];
        const isT5 = config.calculateTierFiveTuning && isT5WithTuning(p);
        if (isT5) {
          const flex = isFlexibleExotic(p);
          const ts = p.tuningStat;
          const bal = lowestThreeBonus(p);
          // per-stat max tuning ON that stat: +5 (flexible or the piece's tuned stat) or balanced.
          for (let s = 0; s < 6; s++) tune[s] = Math.max(flex || ts === s ? 5 : 0, bal[s]);
        }
        const art =
          p.perk == ArmorPerkOrSlot.SlotArtifice ||
          (p.armorSystem === ArmorSystem.Armor2 &&
            ((assumeLegArt && !p.isExotic) || (assumeExoArt && p.isExotic)))
            ? 1
            : 0;
        let sum = 0;
        for (let s = 0; s < 6; s++) sum += mw[s];
        p._mw = mw;
        p._tune = tune;
        p._art = art;
        // tuning's contribution to the TOTAL is at most +3/piece (Balanced = +1 to 3 stats; the
        // +5/-5 options are net-zero), unlike the +5/piece a single stat can gain.
        p._tuneTot = isT5 ? 3 : 0;
        p._sum = sum;
      }
    };
    annotate(helmets);
    annotate(gauntlets);
    annotate(chests);
    annotate(legs);
    annotate(classItems);
    // Sort each main slot by masterworked stat-sum DESCENDING so the strongest cores are generated
    // first, driving each profile's incumbent near its max early — which is what lets the Phase-1
    // total bound skip the long tail of weaker cores. Only for the no-target case: there the output
    // is order-independent (best-total per profile is unaffected), while targeted searches keep the
    // baseline order so the order-sensitive reachable-tier search is byte-identical to before.
    if (bbNoTarget) {
      const bySumDesc = (a: IPermutatorArmor, b: IPermutatorArmor) =>
        (b as AnnotatedArmor)._sum - (a as AnnotatedArmor)._sum;
      helmets.sort(bySumDesc);
      gauntlets.sort(bySumDesc);
      chests.sort(bySumDesc);
      legs.sort(bySumDesc);
    }
  }
  // shared (config-level) mod budget — total stat points all stat mods can add.
  const bbMaxMajor = config.statModLimits?.maxMajorMods || 0;
  const bbMaxModsN = config.statModLimits?.maxMods || 0;
  const bbModBudget = 10 * bbMaxMajor + 5 * Math.max(0, bbMaxModsN - bbMaxMajor);
  // per-stat best a class item can add (tier ceiling) and its artifice/tuning maxima.
  const bbClassTuneMax = [0, 0, 0, 0, 0, 0];
  let bbClassArtMax = 0;
  // Distinct profile suffixes a class item contributes, each carrying ITS OWN shared budget
  // (best class stat-sum + 3*artifice + tuning total among items with that suffix). The total
  // bound is then computed PER reachable profile against that profile's best class item — not one
  // global optimum vs the weakest profile (which every core trivially clears). Using the full pool
  // (a superset of any core's filtered pool) stays safe.
  const bbClassSuffixes: {
    exo: number;
    set: number | null;
    classSum: number;
    sufBudget: number;
  }[] = [];
  if (bbActive) {
    const byKey = new Map<
      string,
      { exo: number; set: number | null; maxTot: number; art: number; tuneTot: number }
    >();
    for (const ci of classItems as AnnotatedArmor[]) {
      const t = ci._tune;
      for (let s = 0; s < 6; s++) if (t[s] > bbClassTuneMax[s]) bbClassTuneMax[s] = t[s];
      if (ci._art) bbClassArtMax = 1;
      const exo = ci.isExotic ? ci.hash : 0;
      const set = ci.gearSetHash != null ? ci.gearSetHash : null;
      const k = exo + "/" + set;
      let e = byKey.get(k);
      if (!e) {
        e = { exo, set, maxTot: 0, art: 0, tuneTot: 0 };
        byKey.set(k, e);
      }
      if (ci._sum > e.maxTot) e.maxTot = ci._sum;
      if (ci._art) e.art = 1;
      if (ci._tuneTot > e.tuneTot) e.tuneTot = ci._tuneTot;
    }
    for (const e of byKey.values())
      bbClassSuffixes.push({
        exo: e.exo,
        set: e.set,
        classSum: e.maxTot,
        sufBudget: e.maxTot + 3 * e.art + e.tuneTot,
      });
  }
  // reachable-profile incumbent cache, keyed by the 4-piece prefix; invalidated by bbVersion
  // (bumped whenever an incumbent rises). Stores the per-suffix incumbent and whether any reachable
  // profile is still unseen (then the core must be explored). Most cores share the empty prefix.
  const bbPrefixCache = new Map<
    string,
    { ver: number; incs: (number | undefined)[]; anyUnseen: boolean }
  >();
  let bbVersion = 0;

  // contains the value of the total amount of combinations to be checked
  let estimatedCalculations = estimateCombinationsToBeChecked(helmets, gauntlets, chests, legs);
  let checkedCalculations = 0;
  let lastProgressReportTime = 0;
  // define the delay; it can be 75ms if the estimated calculations are low
  // if the estimated calculations >= 1e6, then we will use 125ms
  let progressBarDelay = estimatedCalculations >= 1e6 ? 125 : 75;

  for (let [helmet, gauntlet, chest, leg] of generateArmorCombinations(
    helmets,
    gauntlets,
    chests,
    legs,
    // if exotic class items are enforced, we can not use any other exotic armor piece
    requiresAtLeastOneExotic && !exoticClassItemIsEnforced
  )) {
    checkedCalculations++;
    /**
     *  At this point we already have:
     *  - Masterworked Exotic/Legendaries, if they must be masterworked (config.onlyUseMasterworkedExotics/config.onlyUseMasterworkedLegendaries)
     *  - disabled items were already removed (config.disabledItems)
     */
    const slotCheckResult = checkSlots(
      config,
      constantModslotRequirement,
      availableClassItemPerkTypes,
      helmet,
      gauntlet,
      chest,
      leg
    );
    if (!slotCheckResult.valid) continue;

    const hasOneExotic = helmet.isExotic || gauntlet.isExotic || chest.isExotic || leg.isExotic;
    // TODO This check should be in the generator
    if (hasOneExotic && exoticClassItemIsEnforced) continue;

    let classItemsToUse: IPermutatorArmor[] = classItems;
    if (hasOneExotic) {
      // if we have an exotic armor piece, we can not use the exotic class item
      classItemsToUse = legendaryClassItems;
    } else if (config.selectedExotics[0] == FORCE_USE_ANY_EXOTIC || exoticClassItemIsEnforced) {
      // if we have no exotic armor piece, we can use the exotic class item
      classItemsToUse = exoticClassItems;
    }
    if (slotCheckResult.requiredClassItemType != ArmorPerkOrSlot.Any) {
      classItemsToUse = classItems.filter(
        (item) =>
          item.perk == slotCheckResult.requiredClassItemType ||
          item.gearSetHash == slotCheckResult.requiredClassItemType
      );
    }
    if (classItemsToUse.length == 0) {
      // If we have no class items, we do not need to calculate the permutation
      continue;
    }

    // === Phase 1 gate === skip this whole core (without Phase 2) iff it can neither raise any
    // stat's reachable max NOR beat any reachable profile's best total. Both checks are optimistic
    // (upper bounds), so a skip is always provably safe; survivors fall through to the exact calc.
    if (bbActive) {
      const h = helmet as AnnotatedArmor;
      const g = gauntlet as AnnotatedArmor;
      const c = chest as AnnotatedArmor;
      const l = leg as AnnotatedArmor;
      const mainArt = h._art + g._art + c._art + l._art;
      const mainTuneTot = h._tuneTot + g._tuneTot + c._tuneTot + l._tuneTot;
      const artBudget = 3 * (mainArt + bbClassArtMax);
      let canImproveTiers = false;
      let baseTotal = 0;
      let headroom = 0;
      for (let s = 0; s < 6; s++) {
        const mainBase = h._mw[s] + g._mw[s] + c._mw[s] + l._mw[s] + (constantBonus[s] || 0);
        // optimistic single-stat reach: this core + best class item + all tuning/mods/artifice on s
        const tierCeil = Math.min(
          200,
          mainBase +
            maxClassContribution[s] +
            h._tune[s] +
            g._tune[s] +
            c._tune[s] +
            l._tune[s] +
            bbClassTuneMax[s] +
            bbModBudget +
            artBudget
        );
        if (tierCeil > runtime.maximumPossibleTiers[s]) canImproveTiers = true;
        // total bound: base = the 4 mains only; the class item enters as shared budget below.
        const capMain = Math.min(200, mainBase);
        baseTotal += capMain;
        headroom += 200 - capMain;
      }
      let canBeatIncumbent = true;
      if (!canImproveTiers) {
        // mains-only shared budget; each reachable profile adds its OWN class-item budget on top.
        // At no-target the optimizer adds no mods/tuning/artifice, so that budget is zero.
        const budgetMains = bbNoTarget ? 0 : bbModBudget + 3 * mainArt + mainTuneTot;
        let mainExotic = 0;
        const mainSets: number[] = [];
        if (h.isExotic) mainExotic = h.hash;
        if (g.isExotic) mainExotic = g.hash;
        if (c.isExotic) mainExotic = c.hash;
        if (l.isExotic) mainExotic = l.hash;
        if (h.gearSetHash != null) mainSets.push(h.gearSetHash);
        if (g.gearSetHash != null) mainSets.push(g.gearSetHash);
        if (c.gearSetHash != null) mainSets.push(c.gearSetHash);
        if (l.gearSetHash != null) mainSets.push(l.gearSetHash);
        mainSets.sort((a, b) => a - b);
        const mainSetsJoined = mainSets.join(".");
        const prefixKey = mainExotic + "|" + mainSetsJoined;
        let cache = bbPrefixCache.get(prefixKey);
        if (!cache || cache.ver !== bbVersion) {
          const incs: (number | undefined)[] = [];
          let anyUnseen = false;
          for (const suf of bbClassSuffixes) {
            const exoticHash = mainExotic || suf.exo;
            let key: string;
            if (suf.set == null) {
              key = exoticHash + "|" + mainSetsJoined;
            } else {
              const ss = mainSets.slice();
              let lo = 0;
              while (lo < ss.length && ss[lo] < suf.set) lo++;
              ss.splice(lo, 0, suf.set);
              key = exoticHash + "|" + ss.join(".");
            }
            const v = bestTotalByProfile!.get(key);
            incs.push(v);
            if (v === undefined) anyUnseen = true;
          }
          cache = { ver: bbVersion, incs, anyUnseen };
          bbPrefixCache.set(prefixKey, cache);
        }
        if (cache.anyUnseen) {
          canBeatIncumbent = true; // a reachable profile is still unseen — must explore this core
        } else {
          // skippable only if THIS core cannot beat EVERY reachable profile's incumbent, each
          // bounded with that profile's best class item. coreUB is an upper bound on any build of
          // that profile from this core, so coreUB < incumbent => no build here can win it.
          canBeatIncumbent = false;
          for (let i = 0; i < bbClassSuffixes.length; i++) {
            const sb = bbNoTarget ? bbClassSuffixes[i].classSum : bbClassSuffixes[i].sufBudget;
            const coreUB = baseTotal + Math.min(headroom, budgetMains + sb);
            // strict '>': a core that can only TIE the incumbent is skipped — the max TOTAL per
            // profile is preserved (still "an optimal result"); only which equally-maximal build is
            // shown may differ. This is what lets clustered-at-max cores be pruned.
            if (coreUB > (cache.incs[i] as number)) {
              canBeatIncumbent = true;
              break;
            }
          }
        }
      }
      // Skip the whole core (no Phase 2) when it provably can neither raise a reachable tier nor
      // beat any reachable profile's best total. Both checks are optimistic upper bounds, so this
      // is always safe.
      if (!canImproveTiers && !canBeatIncumbent) continue;
    }

    // handlePermutation now returns the per-core skyline of class-item builds (0..N), not one.
    // We still compute every permutation (for accurate reachable-tier values) and only stop
    // ADDING to the output once the parsed-results cap is hit.
    const permResults = handlePermutation(
      runtime,
      config,
      helmet,
      gauntlet,
      chest,
      leg,
      classItemsToUse,
      constantBonus,
      doNotOutput,
      maxClassContribution,
      bestTotalByProfile
    );
    for (const result of permResults) {
      totalResults++;
      insertIntoFrontier(frontier, result, idToPiece, frontierMoreIsBetter);
      if (bestTotalByProfile) {
        const k = buildProfileKey(result.armor, idToPiece);
        const t = sumStats(result.statsWithMods);
        const cur = bestTotalByProfile.get(k);
        if (cur === undefined || t > cur) {
          bestTotalByProfile.set(k, t);
          bbVersion++; // invalidate the reachable-profile-min cache
        }
      }
    }
    // Stop creating builds once the cap is hit (the walk + tier pass continue → max-tiers exact).
    if (
      !doNotOutput &&
      ((config.limitParsedResults && totalResults >= resultSoftCap) ||
        totalResults >= resultHardCap)
    ) {
      doNotOutput = true;
      // STREAMING: the output frontier is now FROZEN (post-cap cores create nothing). The fast paths
      // (no-target analytic / 1-2 target lean) break out of the walk in the `if (doNotOutput)` block
      // just below, so their final `done` follows instantly — no preview needed there. The SLOW path
      // (3+ targets / fixed / waste / armor-perk requirement) keeps walking many more cores ONLY to
      // settle max-tiers; post the FINAL build list NOW so the service can render results immediately
      // while max-tiers keep streaming via the periodic progress message (and the final `done`).
      if (noTargetAnalyticMax === null && !targetedLeanApplicable) {
        // @ts-ignore
        postMessage({
          previewResults: selectOutputBuilds(frontier, frontierMoreIsBetter),
          reachableTiers: runtime.maximumPossibleTiers,
          checkedCalculations,
          estimatedCalculations,
          itemCount: items.length - classItems.length,
        });
      }
    }
    // Fast-mode early walk-termination: once output is frozen (doNotOutput) AND every stat's
    // reachable max has hit its global ceiling, no remaining core can add output OR raise a tier —
    // so stop walking. Output- and max-tiers-IDENTICAL to finishing the walk, just faster (the
    // post-cap cores create nothing, and we only stop once max-tiers provably can't rise).
    if (doNotOutput) {
      // No-target: maxTiers is the exact analytic max (== the full walk's converged value). The
      // cores after the cap create no output, so report it and stop now — output- AND
      // maxTiers-identical to finishing the walk, but without the walk-to-saturation tail.
      if (noTargetAnalyticMax !== null) {
        for (let s = 0; s < 6; s++) runtime.maximumPossibleTiers[s] = noTargetAnalyticMax[s];
        break;
      }
      // Targeted (1-2 targets): compute the exact per-stat max once (lazily), report it, and stop —
      // the post-cap cores create no output, so this is output-identical to the full walk while the
      // maxTiers stay EXACT. Replaces the per-core tier-pass walk over all remaining feasible cores.
      if (targetedLeanApplicable) {
        if (targetedLeanMax === null)
          targetedLeanMax = computeLeanTargetedMax(
            [helmets, gauntlets, chests, legs, classItems],
            config,
            leanTargets,
            constantBonus,
            requiresAtLeastOneExotic
          );
        for (let s = 0; s < 6; s++) runtime.maximumPossibleTiers[s] = targetedLeanMax[s];
        break;
      }
      let saturated = true;
      for (let s = 0; s < 6; s++) {
        if (runtime.maximumPossibleTiers[s] < globalStatCeil[s]) {
          saturated = false;
          break;
        }
      }
      if (saturated) break;
    }

    if (totalResults % 5000 == 0 && lastProgressReportTime + progressBarDelay < Date.now()) {
      lastProgressReportTime = Date.now();
      postMessage({
        checkedCalculations,
        estimatedCalculations,
        reachableTiers: runtime.maximumPossibleTiers,
      });
    }
  }
  console.timeEnd(`Total run thread#${threadSplit.current}`);

  // @ts-ignore
  postMessage({
    runtime,
    results: selectOutputBuilds(frontier, frontierMoreIsBetter),
    done: true,
    checkedCalculations,
    estimatedCalculations,
    stats: {
      permutationCount: totalResults,
      itemCount: items.length - classItems.length,
      totalTime: Date.now() - startTime,
    },
  });
});
// endregion Main Worker Event Handler

// region Core Calculation Functions
function getStatSum(items: IDestinyArmor[]): [number, number, number, number, number, number] {
  return [
    items[0].mobility + items[1].mobility + items[2].mobility + items[3].mobility,
    items[0].resilience + items[1].resilience + items[2].resilience + items[3].resilience,
    items[0].recovery + items[1].recovery + items[2].recovery + items[3].recovery,
    items[0].discipline + items[1].discipline + items[2].discipline + items[3].discipline,
    items[0].intellect + items[1].intellect + items[2].intellect + items[3].intellect,
    items[0].strength + items[1].strength + items[2].strength + items[3].strength,
  ];
}

function applyMasterworkStats(
  item: IPermutatorArmor,
  config: BuildConfiguration,
  stats: number[] = [0, 0, 0, 0, 0, 0]
): void {
  if (item.armorSystem == ArmorSystem.Armor2) {
    if (
      item.masterworkLevel == MAXIMUM_MASTERWORK_LEVEL ||
      (item.isExotic && config.assumeExoticsMasterworked) ||
      (!item.isExotic && config.assumeLegendariesMasterworked)
    ) {
      // Armor 2.0 Masterworked items give +10 to all stats
      for (let i = 0; i < 6; i++) {
        stats[i] += 2;
      }
    }
  } else if (item.armorSystem == ArmorSystem.Armor3) {
    let multiplier = item.masterworkLevel;
    if (
      (item.isExotic && config.assumeExoticsMasterworked) ||
      (!item.isExotic && config.assumeLegendariesMasterworked)
    )
      multiplier = MAXIMUM_MASTERWORK_LEVEL;
    if (multiplier == 0) return;

    // item.archetypeStats contains three stat indices. The OTHER THREE get +1 per multiplier
    for (let i = 0; i < 6; i++) {
      if (item.archetypeStats.includes(i)) continue;
      stats[i] += multiplier;
    }
  }
}

// Per-slot maxima over a pool (base + assumed masterwork): perStat[n] = best any single piece can
// give to stat n; maxTotal = best single-piece stat SUM. perStat bounds the per-stat reach; the
// single-piece maxTotal (NOT sum of per-stat maxes, which one piece can't achieve) bounds the
// joint/total reach. Used by the global + per-core feasibility aborts.
export function slotMaxima(
  items: IPermutatorArmor[],
  config: BuildConfiguration
): { perStat: number[]; maxTotal: number } {
  const perStat = [0, 0, 0, 0, 0, 0];
  let maxTotal = 0;
  for (const it of items) {
    const s = [it.mobility, it.resilience, it.recovery, it.discipline, it.intellect, it.strength];
    applyMasterworkStats(it, config, s);
    let tot = 0;
    for (let i = 0; i < 6; i++) {
      if (s[i] > perStat[i]) perStat[i] = s[i];
      tot += s[i];
    }
    if (tot > maxTotal) maxTotal = tot;
  }
  return { perStat, maxTotal };
}

// EXACT reachable max per stat when there are NO targets (more-is-better). With no joint
// constraint each stat is maximised independently, so per slot we take the single best piece's
// contribution to stat s (base+MW + that piece's exact tuning max for s + artifice if capable),
// then combine across the 5 slots under the "at most 1 exotic" rule (and the chest-not-exotic +1
// Health). This EQUALS the value the full walk converges to — verified against the walk — so the
// fast-mode driver can report it and stop at the result cap instead of walking on just to let
// maximumPossibleTiers saturate. `requireExotic` drops the all-legendary option (force-any-exotic).
const NO_TARGET_NEG = -1e9;
export function computeExactNoTargetMax(
  slots: IPermutatorArmor[][], // [helmets, gauntlets, chests, legs, classItems]
  config: BuildConfiguration,
  constantBonus: number[],
  possibleIncreaseByMod: number,
  requireExotic: boolean
): number[] {
  const useTuning = config.calculateTierFiveTuning;
  const health1 = config.addConstent1Health ? 1 : 0;
  const CHEST = 2; // index of the chest slot in `slots`
  // per-slot best LEGENDARY / best EXOTIC contribution to each stat (NEG = no such piece in slot)
  const legMax: number[][] = [];
  const exoMax: number[][] = [];
  for (let si = 0; si < slots.length; si++) {
    const lm = [NO_TARGET_NEG, NO_TARGET_NEG, NO_TARGET_NEG, NO_TARGET_NEG, NO_TARGET_NEG, NO_TARGET_NEG]; // prettier-ignore
    const em = [NO_TARGET_NEG, NO_TARGET_NEG, NO_TARGET_NEG, NO_TARGET_NEG, NO_TARGET_NEG, NO_TARGET_NEG]; // prettier-ignore
    for (const p of slots[si]) {
      const base = [p.mobility, p.resilience, p.recovery, p.discipline, p.intellect, p.strength];
      applyMasterworkStats(p, config, base);
      const art = pieceArtificeCapable(p, config) ? 3 : 0;
      const isT5 = useTuning && isT5WithTuning(p);
      const flexible = isT5 && isFlexibleExotic(p);
      const balanced = isT5 && !flexible ? lowestThreeBonus(p) : null;
      const dst = p.isExotic ? em : lm;
      for (let s = 0; s < 6; s++) {
        // exact tuning a single piece can add to stat s: flexible exotic = +5 on any stat; fixed
        // legendary = +5 on its tuned stat else the Balanced +1 (if s is one of its lowest-3).
        const tune = isT5 ? (flexible ? 5 : s === p.tuningStat ? 5 : balanced![s]) : 0;
        const c = base[s] + tune + art;
        if (c > dst[s]) dst[s] = c;
      }
    }
    legMax.push(lm);
    exoMax.push(em);
  }
  const result = [0, 0, 0, 0, 0, 0];
  for (let s = 0; s < 6; s++) {
    let best = NO_TARGET_NEG;
    // option: no exotic at all (legendary in every slot) — unless an exotic is forced
    if (!requireExotic) {
      let sum = 0;
      let ok = true;
      for (let si = 0; si < slots.length; si++) {
        if (legMax[si][s] <= NO_TARGET_NEG / 2) { ok = false; break; } // prettier-ignore
        sum += legMax[si][s];
      }
      if (ok) best = Math.max(best, sum + (s === 1 ? health1 : 0));
    }
    // option: exactly one exotic, placed in slot e (legendaries everywhere else)
    for (let e = 0; e < slots.length; e++) {
      if (exoMax[e][s] <= NO_TARGET_NEG / 2) continue; // no exotic available in slot e
      let sum = exoMax[e][s];
      let ok = true;
      for (let si = 0; si < slots.length; si++) {
        if (si === e) continue;
        if (legMax[si][s] <= NO_TARGET_NEG / 2) { ok = false; break; } // prettier-ignore
        sum += legMax[si][s];
      }
      if (!ok) continue;
      // +1 Health applies only when the chest piece is NOT the exotic
      best = Math.max(best, sum + (s === 1 && e !== CHEST ? health1 : 0));
    }
    result[s] =
      best <= NO_TARGET_NEG / 2
        ? 0
        : Math.min(200, (constantBonus[s] || 0) + best + possibleIncreaseByMod);
  }
  return result;
}

// ---- Dedicated lean TARGETED max-tiers (exact, fast — replaces the post-cap tier-pass walk) ----
// For each stat s with active targets, the EXACT max reachable s WHILE meeting the targets is found
// in the low-dim projection K = {s} ∪ {targeted stats}: per slot keep only the K-skyline of each
// piece's tuning-mix vectors (+artifice flag), fold the 5 slots (Minkowski sum in K, skyline-pruned
// -> small frontier), and per frontier build do an EXACT shared-budget allocation (cover the target
// gaps with mods +10/+5 ×maxMods and artifice +3, dump the rest on s, clamp 200). <=1 exotic via 6
// cases (no-exotic + exotic-in-slot-k). This equals the value the full tier-pass walk converges to
// (verified byte-equal vs the walk), but without walking the post-cap cores. Gated to 1-2 targets
// (3+ keeps the K-frontier large -> the caller falls back to the walk).
type LeanNode = { v: number[]; art: number };

// Skyline over (K-vector, artifice): a dominates b iff a.art >= b.art AND a.v >= b.v on all K coords
// (more artifice = more budget = weakly better). Sort by sum desc so the O(n*kept) filter is cheap.
function leanSkyline(nodes: LeanNode[], dim: number): LeanNode[] {
  nodes.sort((a, b) => {
    let sa = a.art;
    let sb = b.art;
    for (let i = 0; i < dim; i++) {
      sa += a.v[i];
      sb += b.v[i];
    }
    return sb - sa;
  });
  const kept: LeanNode[] = [];
  outer: for (const n of nodes) {
    for (const k of kept) {
      if (k.art < n.art) continue;
      let dom = true;
      for (let i = 0; i < dim; i++)
        if (k.v[i] < n.v[i]) {
          dom = false;
          break;
        }
      if (dom) continue outer;
    }
    kept.push(n);
  }
  return kept;
}

// Per-slot K-projected mix nodes, restricted to legendary (wantExotic=false) or exotic pieces.
function leanSlotNodes(
  slot: IPermutatorArmor[],
  K: number[],
  wantExotic: boolean,
  config: BuildConfiguration
): LeanNode[] {
  const nodes: LeanNode[] = [];
  for (const it of slot) {
    if (wantExotic !== !!it.isExotic) continue;
    const art = pieceArtificeCapable(it, config) ? 1 : 0;
    for (const mix of pieceMixSet(it, config)) {
      const v = new Array(K.length);
      for (let i = 0; i < K.length; i++) v[i] = mix[K[i]];
      nodes.push({ v, art });
    }
  }
  return leanSkyline(nodes, K.length);
}

// Fold per-slot node lists into the build frontier (Minkowski sum in K + artifice, skyline-pruned).
function leanFold(perSlot: LeanNode[][], dim: number): LeanNode[] {
  let frontier: LeanNode[] = [{ v: new Array(dim).fill(0), art: 0 }];
  for (const slot of perSlot) {
    const next: LeanNode[] = [];
    for (const a of frontier)
      for (const b of slot) {
        const v = new Array(dim);
        for (let i = 0; i < dim; i++) v[i] = a.v[i] + b.v[i];
        next.push({ v, art: a.art + b.art });
      }
    frontier = leanSkyline(next, dim);
  }
  return frontier;
}

// Max reachable s for ONE build (K-vector v incl. constant offsets, artifice count art), meeting the
// target gaps. Budget: maxMods mod-slots (+10 major / +5 minor, <=maxMajor major) + art artifice
// (+3). Recurse covering each gap, then dump the leftover on s. Returns -1 if targets infeasible.
function leanMaxSForBuild(
  v: number[],
  sPosInK: number,
  gaps: { pos: number; gap: number }[],
  art: number,
  maxMods: number,
  maxMajor: number
): number {
  let best = -1;
  const rec = (gi: number, modsLeft: number, majorLeft: number, artLeft: number) => {
    if (gi === gaps.length) {
      const majUse = Math.min(modsLeft, majorLeft);
      const addS = 10 * majUse + 5 * (modsLeft - majUse) + 3 * artLeft;
      const val = Math.min(200, v[sPosInK] + addS);
      if (val > best) best = val;
      return;
    }
    const g = gaps[gi].gap;
    if (g <= 0) {
      rec(gi + 1, modsLeft, majorLeft, artLeft);
      return;
    }
    for (let M = 0; M <= Math.min(majorLeft, modsLeft); M++)
      for (let m = 0; m <= modsLeft - M; m++)
        for (let R = 0; R <= artLeft; R++)
          if (10 * M + 5 * m + 3 * R >= g) {
            rec(gi + 1, modsLeft - M - m, majorLeft - M, artLeft - R);
            break; // minimal artifice for this (M,m) — more only wastes budget that could go to s
          }
  };
  rec(0, maxMods, maxMajor, art);
  return best;
}

// EXACT per-stat targeted max-tiers. slots = [helmets, gauntlets, chests, legs, classItems].
function computeLeanTargetedMax(
  slots: IPermutatorArmor[][],
  config: BuildConfiguration,
  targetVals: number[],
  constantBonus: number[],
  requireExotic: boolean
): number[] {
  const targetIdx: number[] = [];
  for (let i = 0; i < 6; i++) if (targetVals[i] > 0) targetIdx.push(i);
  const maxMajor = config.statModLimits?.maxMajorMods || 0;
  const maxMods = config.statModLimits?.maxMods || 0;
  const health1 = config.addConstent1Health ? 1 : 0;
  const CHEST = 2; // slot index of the chest in `slots`
  const result = [0, 0, 0, 0, 0, 0];
  for (let s = 0; s < 6; s++) {
    const kset = new Set<number>([s]);
    for (const j of targetIdx) kset.add(j);
    const K = Array.from(kset).sort((a, b) => a - b);
    const dim = K.length;
    const sPosInK = K.indexOf(s);
    let best = -1;
    // <=1 exotic: no-exotic (exoSlot=-1) + exotic-in-slot-k (k=0..4)
    for (let exoSlot = -1; exoSlot < 5; exoSlot++) {
      if (requireExotic && exoSlot === -1) continue;
      const perSlot: LeanNode[][] = [];
      let impossible = false;
      for (let si = 0; si < 5; si++) {
        const ns = leanSlotNodes(slots[si], K, si === exoSlot, config);
        if (ns.length === 0) {
          impossible = true; // this case needs a piece this slot can't supply (e.g. no exotic here)
          break;
        }
        perSlot.push(ns);
      }
      if (impossible) continue;
      // constant offset for this case: enabled-mod bonus + chest-not-exotic +1 Health (chest slot 2)
      const offset = K.map(
        (k) => (constantBonus[k] || 0) + (k === 1 && exoSlot !== CHEST ? health1 : 0)
      );
      const frontier = leanFold(perSlot, dim);
      for (const node of frontier) {
        const adj = new Array(dim);
        for (let i = 0; i < dim; i++) adj[i] = node.v[i] + offset[i];
        const gaps: { pos: number; gap: number }[] = [];
        for (let ki = 0; ki < K.length; ki++) {
          const j = K[ki];
          if (j !== s && targetVals[j] > 0) gaps.push({ pos: ki, gap: targetVals[j] - adj[ki] });
        }
        const r = leanMaxSForBuild(adj, sPosInK, gaps, node.art, maxMods, maxMajor);
        if (r > best) best = r;
      }
    }
    result[s] = best < 0 ? 0 : best;
  }
  return result;
}

// Max (base+MW) a single piece in this pool can contribute to the SUM over the targeted stats.
// Bounds the joint reach on the requested stats specifically (tighter than the all-stats total:
// the build can't pour its whole budget into just the 2-3 stats you asked for).
export function maxSlotContributionOnStats(
  items: IPermutatorArmor[],
  config: BuildConfiguration,
  targeted: boolean[]
): number {
  let max = 0;
  for (const it of items) {
    const s = [it.mobility, it.resilience, it.recovery, it.discipline, it.intellect, it.strength];
    applyMasterworkStats(it, config, s);
    let sum = 0;
    for (let i = 0; i < 6; i++) if (targeted[i]) sum += s[i];
    if (sum > max) max = sum;
  }
  return max;
}

// Offset added to each (signed) stat component so it is non-negative before packing.
// Components are in [-25, +25]; 64 keeps every byte in [39, 89] ⊂ [0, 255] with headroom.
const TUNING_KEY_OFFSET = 64;

// Pack 6 small signed stat components into a single exact integer (base-256 via
// multiplication, so it survives past 32 bits unlike `<<`). Used as the dedup Map key.
function packTuningKey(
  s0: number,
  s1: number,
  s2: number,
  s3: number,
  s4: number,
  s5: number
): number {
  return (
    (((((s0 + TUNING_KEY_OFFSET) * 256 + (s1 + TUNING_KEY_OFFSET)) * 256 +
      (s2 + TUNING_KEY_OFFSET)) *
      256 +
      (s3 + TUNING_KEY_OFFSET)) *
      256 +
      (s4 + TUNING_KEY_OFFSET)) *
      256 +
    (s5 + TUNING_KEY_OFFSET)
  );
}

// The per-item tuning option vectors a single improvement contributes to the build's Minkowski
// tuning sum: the no-op, the +5/-5 pairs (flexible exotic = all 30 ordered pairs; legendary T5 =
// 5 fixed to its tuned stat), then Balanced (+1 to the 3 lowest base stats).
function tuningOptionList(imp: t5Improvement): number[][] {
  const l: number[][] = [[0, 0, 0, 0, 0, 0]];
  if (imp.flexible) {
    // Exotic: +5 to any stat, -5 to any other stat (all 30 ordered pairs).
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 6; j++) {
        if (i == j) continue;
        const p = [0, 0, 0, 0, 0, 0];
        p[i] = 5;
        p[j] = -5;
        l.push(p);
      }
    }
  } else if (imp.tuningStat !== null) {
    // Legendary: +5 fixed to the item's tuned stat, -5 to any other stat.
    for (let n = 0; n < 6; n++) {
      if (n == imp.tuningStat) continue;
      const p = [0, 0, 0, 0, 0, 0];
      p[imp.tuningStat] = 5;
      p[n] = -5;
      l.push(p);
    }
  }
  // Balanced Tuning: +1 to the three lowest stats.
  l.push(imp.balancedBonus.slice());
  return l;
}

// One incremental Minkowski step: combine every accumulated tuning with every option of one
// improvement, deduping by the integer key. Returns a NEW map; insertion order matches the
// original single-pass fold, so get_mods_recursive (which picks the FIRST valid tuning by array
// order) observes the same ordering — i.e. byte-identical results.
function extendTuningAcc(acc: Map<number, Tuning>, options: number[][]): Map<number, Tuning> {
  const next = new Map<number, Tuning>();
  for (const a of acc.values()) {
    for (const v of options) {
      const s0 = a[0] + v[0];
      const s1 = a[1] + v[1];
      const s2 = a[2] + v[2];
      const s3 = a[3] + v[3];
      const s4 = a[4] + v[4];
      const s5 = a[5] + v[5];
      const key = packTuningKey(s0, s1, s2, s3, s4, s5);
      if (!next.has(key)) next.set(key, [s0, s1, s2, s3, s4, s5] as Tuning);
    }
  }
  return next;
}

// Deduped Minkowski sum (accumulator) for a set of improvements. Splitting build-vs-extend lets
// handlePermutation compute the fixed 4-piece base ONCE per core and only fold in each class
// item's options — the loop's dominant cost at low/no targets — instead of redoing the whole
// sum per class item. The integer dedup key (see packTuningKey) keeps this allocation-light.
export function buildTuningAcc(possibleImprovements: t5Improvement[]): Map<number, Tuning> {
  let acc = new Map<number, Tuning>();
  acc.set(packTuningKey(0, 0, 0, 0, 0, 0), [0, 0, 0, 0, 0, 0] as Tuning);
  for (const imp of possibleImprovements) acc = extendTuningAcc(acc, tuningOptionList(imp));
  return acc;
}

// Incremental Minkowski sum with per-step dedup. Produces the IDENTICAL SET — and the identical
// ORDER — of distinct tuning vectors as the old "full cartesian product, dedup at the leaves"
// approach, but never materializes the prod(|optionsPerItem|) leaves (which exploded with a
// flexible exotic: ~77k leaves for a 5xT5 build, deduped down to ~1926). Verified set-equal vs
// the old algorithm across thousands of random cases.
export function generate_tunings(possibleImprovements: t5Improvement[]): Tuning[] {
  return Array.from(buildTuningAcc(possibleImprovements).values());
}

// ---- Projected tuning accumulator (the targeted-search speedup) ----
// Under more-is-better, build feasibility depends ONLY on the targeted stats (non-targeted stats
// float / floor freely). So instead of materializing the full ~2-5k-vector Minkowski set per build
// and scanning it, we build the set PROJECTED onto the targeted stats — keyed by the projection,
// keeping the MAX-TOTAL full witness per key (the witness is the actual tuning the output build
// uses; max-total = best build for that projection). The accumulator stays tiny (one entry per
// distinct targeted-projection, e.g. ~15 for a single target), so building it is cheap and there
// is no full-set materialization. buildProjectedTuningAcc for the 4 main pieces is computed once
// per core; each class item folds in its own options.
function projTuneKey(v: number[], projIdx: number[]): number {
  let key = 0;
  for (let k = 0; k < projIdx.length; k++) key = key * 256 + (v[projIdx[k]] + TUNING_KEY_OFFSET);
  return key;
}

function extendProjectedTuningAcc(
  acc: Map<number, Tuning>,
  options: number[][],
  projIdx: number[]
): Map<number, Tuning> {
  const next = new Map<number, Tuning>();
  const nextSum = new Map<number, number>();
  for (const a of acc.values()) {
    const aSum = a[0] + a[1] + a[2] + a[3] + a[4] + a[5];
    for (const o of options) {
      const nv = [
        a[0] + o[0],
        a[1] + o[1],
        a[2] + o[2],
        a[3] + o[3],
        a[4] + o[4],
        a[5] + o[5],
      ] as Tuning;
      const key = projTuneKey(nv, projIdx);
      const nsum = aSum + (o[0] + o[1] + o[2] + o[3] + o[4] + o[5]);
      const cur = nextSum.get(key);
      if (cur === undefined || nsum > cur) {
        nextSum.set(key, nsum);
        next.set(key, nv);
      }
    }
  }
  return next;
}

function buildProjectedTuningAcc(
  possibleImprovements: t5Improvement[],
  projIdx: number[]
): Map<number, Tuning> {
  let acc = new Map<number, Tuning>();
  acc.set(projTuneKey([0, 0, 0, 0, 0, 0], projIdx), [0, 0, 0, 0, 0, 0] as Tuning);
  for (const imp of possibleImprovements)
    acc = extendProjectedTuningAcc(acc, tuningOptionList(imp), projIdx);
  return acc;
}

// region Per-slot dominance pruning (Phase 3)

// All stat vectors a single piece can present on its own = (base stats + assumed masterwork)
// shifted by each of its tuning options (reusing tuningOptionList). Build-level resources
// (artifice mods, stat mods, the OTHER pieces' shared tuning budget) are identical no matter which
// same-profile piece is chosen, so they don't differentiate two candidates and are excluded here.
function pieceMixSet(piece: IPermutatorArmor, config: BuildConfiguration): number[][] {
  const base = [
    piece.mobility,
    piece.resilience,
    piece.recovery,
    piece.discipline,
    piece.intellect,
    piece.strength,
  ];
  applyMasterworkStats(piece, config, base);
  const opts =
    config.calculateTierFiveTuning && isT5WithTuning(piece)
      ? tuningOptionList(mapItemToTuning(piece))
      : [[0, 0, 0, 0, 0, 0]];
  return opts.map((o) => [
    base[0] + o[0],
    base[1] + o[1],
    base[2] + o[2],
    base[3] + o[3],
    base[4] + o[4],
    base[5] + o[5],
  ]);
}

// True if a piece can mount an artifice mod under this config (same rule handlePermutation uses).
function pieceArtificeCapable(piece: IPermutatorArmor, config: BuildConfiguration): boolean {
  if (piece.perk == ArmorPerkOrSlot.SlotArtifice) return true;
  if (piece.armorSystem === ArmorSystem.Armor2) {
    if (!piece.isExotic && config.assumeEveryLegendaryIsArtifice) return true;
    if (piece.isExotic && config.assumeEveryExoticIsArtifice) return true;
  }
  return false;
}

// Pieces are only compared within an IDENTICAL non-stat profile, so dominance reduces to a pure
// stat-mix question and we never drop a piece that offers a build option (exotic perk, set bonus,
// mod-slot, energy, artifice) another lacks. Exotics keyed by hash (different exotics never
// interchangeable). Used for PIECE grouping (distinct from the build-level buildProfileKey).
export function pieceProfileKey(piece: IPermutatorArmor, config: BuildConfiguration): string {
  const artifice = pieceArtificeCapable(piece, config) ? "A" : "_";
  const energy = piece.tier >= 5 ? "T5" : "low";
  if (piece.isExotic) return `E|${piece.hash}|${piece.armorSystem}|${energy}|${artifice}`;
  return `L|${piece.perk}|${piece.gearSetHash ?? "none"}|${piece.armorSystem}|${energy}|${artifice}`;
}

// Does mix-set J cover mix-set I? (every vector I can present is matched-or-beaten on all 6 stats
// by some vector J can present.) If so, a J-piece can stand in for an I-piece in ANY build and
// reach at least the same stats — so under more-is-better targets the I-piece is redundant.
function mixSetCovers(jMixes: number[][], iMixes: number[][]): boolean {
  for (const mi of iMixes) {
    let covered = false;
    for (const mj of jMixes) {
      if (
        mj[0] >= mi[0] &&
        mj[1] >= mi[1] &&
        mj[2] >= mi[2] &&
        mj[3] >= mi[3] &&
        mj[4] >= mi[4] &&
        mj[5] >= mi[5]
      ) {
        covered = true;
        break;
      }
    }
    if (!covered) return false;
  }
  return true;
}

// Per-slot Pareto pruning: within each non-stat profile group, drop a piece whose every reachable
// stat mix is matched-or-beaten by another KEPT piece of the same profile. LOSSLESS only when
// more-is-better (no fixed-stat / waste limiting); otherwise returns the list unchanged. With the
// per-(exotic+set) max-total output, removing a dominated piece can never change the selected
// build (the dominator reaches >= stats). Gated by npm run diff:pruning-best.
export function pruneDominatedPerSlot(
  pieces: IPermutatorArmor[],
  config: BuildConfiguration
): IPermutatorArmor[] {
  const anyStatFixed = Object.values(config.minimumStatTiers).some(
    (v: FixableSelection<number>) => v.fixed
  );
  const moreIsBetter =
    !anyStatFixed && !config.tryLimitWastedStats && !config.onlyShowResultsWithNoWastedStats;
  if (!moreIsBetter || pieces.length < 2) return pieces;

  const groups = new Map<string, number[]>();
  for (let i = 0; i < pieces.length; i++) {
    const k = pieceProfileKey(pieces[i], config);
    const g = groups.get(k);
    if (g) g.push(i);
    else groups.set(k, [i]);
  }

  const pruned = new Array<boolean>(pieces.length).fill(false);
  const mixCache = new Array<number[][] | null>(pieces.length).fill(null);
  const mixOf = (idx: number): number[][] =>
    mixCache[idx] ?? (mixCache[idx] = pieceMixSet(pieces[idx], config));

  for (const indices of groups.values()) {
    if (indices.length < 2) continue;
    for (const i of indices) {
      const iMix = mixOf(i);
      for (const j of indices) {
        if (j === i || pruned[j]) continue; // never be dominated by an already-pruned piece
        const jMix = mixOf(j);
        if (mixSetCovers(jMix, iMix)) {
          // tie-break for mutually-covering (equal) pieces: keep the lower index
          if (!mixSetCovers(iMix, jMix) || j < i) {
            pruned[i] = true;
            break;
          }
        }
      }
    }
  }

  const survivors: IPermutatorArmor[] = [];
  for (let i = 0; i < pieces.length; i++) if (!pruned[i]) survivors.push(pieces[i]);
  return survivors;
}
// endregion Per-slot dominance pruning

export function handlePermutation(
  runtime: any,
  config: BuildConfiguration,
  helmet: IPermutatorArmor,
  gauntlet: IPermutatorArmor,
  chest: IPermutatorArmor,
  leg: IPermutatorArmor,
  classItems: IPermutatorArmor[],
  constantBonus: number[],
  doNotOutput = false,
  // Per-stat max contribution any single class item can add (base + assumed masterwork),
  // precomputed once over the class-item pool. Enables a sound O(1) per-core feasibility abort:
  // if even the best-possible class item + max tuning/mods/artifice can't reach a target, no
  // class item can, so the whole core is skipped. Optional (direct callers may omit it).
  maxClassContribution?: number[],
  // Branch-and-bound incumbent (best total per exotic+set profile). When provided AND more-is-
  // better, skip BUILDING any class-item build whose optimistic capped-total ceiling is strictly
  // below its profile's incumbent — it can neither beat nor tie the kept best, so the per-profile
  // output is unchanged. Applied AFTER the tier gate so maximumPossibleTiers is never affected.
  bestTotalByProfile?: Map<string, number>
): IPermutatorArmorSet[] {
  const items = [helmet, gauntlet, chest, leg];

  // base stats and apply constant health tweak
  const baseStats = getStatSum(items);
  baseStats[1] += !items[2].isExotic && config.addConstent1Health ? 1 : 0;

  // apply masterwork effects to baseStats (assumed idempotent)
  for (const it of items) applyMasterworkStats(it, config, baseStats);

  // precompute targets and fixed flags
  const targetVals: number[] = new Array(6);
  const targetFixed: boolean[] = new Array(6);
  let anyFixed = false;
  for (let n: ArmorStat = 0; n < 6; n++) {
    targetVals[n] = (config.minimumStatTiers[n].value || 0) * 10;
    targetFixed[n] = !!config.minimumStatTiers[n].fixed;
    if (targetFixed[n]) anyFixed = true;
  }

  // stats without mods, and stats with constant bonuses
  const statsWithoutMods: number[] = [
    baseStats[0],
    baseStats[1],
    baseStats[2],
    baseStats[3],
    baseStats[4],
    baseStats[5],
  ];
  const stats: number[] = [
    statsWithoutMods[0] + (constantBonus[0] || 0),
    statsWithoutMods[1] + (constantBonus[1] || 0),
    statsWithoutMods[2] + (constantBonus[2] || 0),
    statsWithoutMods[3] + (constantBonus[3] || 0),
    statsWithoutMods[4] + (constantBonus[4] || 0),
    statsWithoutMods[5] + (constantBonus[5] || 0),
  ];

  // NOTE: the fixed-overshoot abort is intentionally NOT here — a locked stat that the 4 main
  // pieces overshoot can still be pulled back down to its lock by NEGATIVE tuning, so the abort
  // must be tuning-aware and therefore runs AFTER the per-stat tuning minima are computed below.

  // count available artifice slots
  const assumeEveryLegendaryIsArtifice = !!config.assumeEveryLegendaryIsArtifice;
  const assumeEveryExoticIsArtifice = !!config.assumeEveryExoticIsArtifice;
  let availableArtificeCount = 0;
  for (const d of items) {
    if (
      d.perk == ArmorPerkOrSlot.SlotArtifice ||
      (d.armorSystem === ArmorSystem.Armor2 &&
        ((assumeEveryLegendaryIsArtifice && !d.isExotic) ||
          (assumeEveryExoticIsArtifice && d.isExotic)))
    ) {
      availableArtificeCount++;
    }
  }

  // initial distances
  const distances: number[] = new Array(6);
  for (let n: ArmorStat = 0; n < 6; n++) distances[n] = Math.max(0, targetVals[n] - stats[n]);

  if (config.onlyShowResultsWithNoWastedStats) {
    for (let stat: ArmorStat = 0; stat < 6; stat++) {
      const v = 10 - (stats[stat] % 10);
      distances[stat] = Math.max(distances[stat], v < 10 ? v : 0);
    }
  }

  const baseT5Improvements: t5Improvement[] = [];
  const preTuningMax: number[] = [0, 0, 0, 0, 0, 0];
  // Deduped tuning accumulator for the 4 fixed main pieces — computed ONCE per core, then each
  // class item only folds in its own options (see the class-item loop). null until built.
  let baseTuningAcc: Map<number, Tuning> | null = null;
  // Targeted-stat indices + the 4-main PROJECTED tuning accumulator (onto those stats), for the
  // build-output get_mods. Under more-is-better, feasibility depends only on the targeted stats, so
  // we scan this tiny projected set instead of materializing the full Minkowski set per build.
  const targetIdx: number[] = [];
  for (let i: ArmorStat = 0; i < 6; i++) if (targetVals[i] > 0) targetIdx.push(i);
  let baseProjAcc: Map<number, Tuning> | null = null;

  if (config.calculateTierFiveTuning) {
    // precompute base T5 improvements and per-stat tuning maxima (cheap). The actual base tuning
    // Minkowski sum (buildTuningAcc) is built LAZILY in the class-item loop — only when a feasible
    // class item is reached — so the millions of infeasible cores never pay for it.
    for (const it of items) {
      if (isT5WithTuning(it)) baseT5Improvements.push(mapItemToTuning(it));
    }

    for (const t5 of baseT5Improvements) {
      if (t5.flexible) {
        // exotic: +5 reachable on any stat
        for (let i = 0; i < 6; i++) {
          preTuningMax[i] += 5;
        }
        continue;
      }
      // legendary: the EXACT max this piece can add to each stat = +5 on its tuned stat, else the
      // Balanced bonus (1 on a lowest-3 stat, 0 otherwise). The +5/-5 options only ever lower the
      // other stats, so they never beat Balanced for a per-stat MAX. (Previously this summed one
      // option per -5 target, ~5x over-counting and badly loosening the tier/feasibility gates.)
      const balanced = t5.balancedBonus;
      for (let i = 0; i < 6; i++) {
        preTuningMax[i] += i === t5.tuningStat ? 5 : balanced[i];
      }
    }
  }

  // Fixed-overshoot abort (STRICT): if the 4 main pieces already overshoot a locked stat, abort the
  // whole core. A class item only ADDS, so it can't bring an overshot stat back down. (Negative
  // tuning could in theory pull it back to the lock, but the strict path does not model that — an
  // accepted tradeoff: the tuning-down relaxation showed no measured benefit and was catastrophic on
  // all-locked configs, where ~every core reached get_mods + the per-core Minkowski materialization.)
  if (anyFixed) {
    for (let n: ArmorStat = 0; n < 6; n++) {
      if (targetFixed[n] && stats[n] > targetVals[n]) return [];
    }
  }

  // mod caps
  const maxMajorMods = config.statModLimits?.maxMajorMods || 0;
  const maxMods = config.statModLimits?.maxMods || 0;
  const possibleIncreaseByMod = 10 * maxMajorMods + 5 * Math.max(0, maxMods - maxMajorMods);

  // Sound per-core feasibility abort — runs BEFORE the expensive class-item sort/loop. If even the
  // best-possible class item (maxClassContribution) plus max tuning (+5 for the class item), all
  // mods, and one extra artifice slot can't reach a stat's minimum target, then NO class item can,
  // so skip the whole core in O(6). Restores instant rejection of impossible / very tight targets
  // WITHOUT the old earlyAbort heuristic that could drop achievable builds.
  if (maxClassContribution) {
    const maxArtificeBonus = 3 * (availableArtificeCount + 1);
    // Per-stat reach with the BEST class item + max per-stat tuning. residualGap = what still has
    // to come from the SHARED mod+artifice budget after that.
    let residualGap = 0;
    for (let n: ArmorStat = 0; n < 6; n++) {
      if (targetVals[n] <= 0) continue;
      const reachWithoutSharedMods = stats[n] + maxClassContribution[n] + (preTuningMax[n] + 5);
      // (a) a single target is individually unreachable even with all shared mods on it.
      if (reachWithoutSharedMods + possibleIncreaseByMod + maxArtificeBonus < targetVals[n])
        return [];
      residualGap += Math.max(0, targetVals[n] - reachWithoutSharedMods);
    }
    // (b) the residual gaps across all targeted stats can't be closed by the shared mod+artifice
    // budget (which is NOT per-stat). Catches e.g. weapon 120 + health 100 on a weak core.
    if (residualGap > possibleIncreaseByMod + maxArtificeBonus) return [];
  }

  // No per-core class-item sort: the per-(exotic+set) output is the stat-skyline, which is
  // order-independent, so sorting 141 class items per core (the old hot path, called ~hundreds of
  // millions of times with a heavy comparator) is pure waste. Iterate in natural order.
  const sortedClassItems = classItems;

  // reusable buffers
  const adjustedStats = [0, 0, 0, 0, 0, 0];
  const adjustedStatsWithoutMods = [0, 0, 0, 0, 0, 0];
  const newDistances = [0, 0, 0, 0, 0, 0];
  const newOptionalDistances = [0, 0, 0, 0, 0, 0];

  // helper to compute tuning maxima with optional extra T5
  function calcTuningMaxWithExtra(extra?: t5Improvement): number[] {
    if (!extra) return preTuningMax.slice();
    const result = preTuningMax.slice();
    if (extra.flexible) {
      for (let i = 0; i < 6; i++) result[i] += 5;
      return result;
    }
    const balanced = extra.balancedBonus;
    for (let i = 0; i < 6; i++) result[i] += i === extra.tuningStat ? 5 : balanced[i];
    return result;
  }

  // Class items are emitted as a per-core SKYLINE (the non-dominated builds), not a single
  // heuristic pick — so achievable builds across class items are not silently dropped (a real
  // issue now that class items carry 0–200 stats). collected gathers every valid class-item
  // build; skylineBuilds reduces it at the end.
  const collected: { set: IPermutatorArmorSet; prof: string; stats: number[] }[] = [];
  const moreIsBetter =
    !targetFixed.some((f) => f) &&
    !config.tryLimitWastedStats &&
    !config.onlyShowResultsWithNoWastedStats;

  // Pareto-front feasibility for the tier pass: SAFE only when more-is-better (pure lower-bound
  // query, no fixed/waste upper bounds), and only WORTH the O(N^2) front-build when there is a real
  // stat target making the tier-pass get_mods expensive (at no-target it's cheap -> net loss).
  const useFrontForTierPass = moreIsBetter && targetVals.some((v) => v > 0);

  // B&B setup: precompute the 4-piece profile (matches buildProfileKey: exotic hash + sorted set
  // hashes). The dominant class item (legendary, no set bonus) shares this exact profile, so its
  // incumbent lookup is a precomputed O(1) — no per-item string build.
  const bbActive = !!bestTotalByProfile && moreIsBetter;
  let bbMainExotic = 0;
  const bbMainSets: number[] = [];
  if (bbActive) {
    for (const it of items) {
      if (it.isExotic) bbMainExotic = it.hash;
      if (it.gearSetHash != null) bbMainSets.push(it.gearSetHash);
    }
    bbMainSets.sort((a, b) => a - b);
  }
  const bbMainSetsJoined = bbMainSets.join(".");
  const bbBestForMain = bbActive
    ? bestTotalByProfile!.get(bbMainExotic + "|" + bbMainSetsJoined)
    : undefined;

  classItemLoop: for (const classItem of sortedClassItems) {
    // compute adjustedStats
    adjustedStats[0] = stats[0] + (classItem.mobility || 0);
    adjustedStats[1] = stats[1] + (classItem.resilience || 0);
    adjustedStats[2] = stats[2] + (classItem.recovery || 0);
    adjustedStats[3] = stats[3] + (classItem.discipline || 0);
    adjustedStats[4] = stats[4] + (classItem.intellect || 0);
    adjustedStats[5] = stats[5] + (classItem.strength || 0);
    applyMasterworkStats(classItem, config, adjustedStats);

    // candidate T5 improvement from this class item — needed by the fixed-overshoot gate below and
    // (later) by the tuning maxima.
    const classItemT5: t5Improvement | undefined =
      config.calculateTierFiveTuning && isT5WithTuning(classItem)
        ? mapItemToTuning(classItem)
        : undefined;

    // Bug #1 fix: this class item overshoots a FIXED-stat target -> skip ONLY this class item (other
    // class items may still fit). STRICT check: a class item only ADDS, so once a locked stat is
    // above its lock it can't come back down here.
    if (anyFixed) {
      for (let n: ArmorStat = 0; n < 6; n++) {
        if (targetFixed[n] && adjustedStats[n] > targetVals[n]) continue classItemLoop;
      }
    }

    // adjustedStatsWithoutMods
    adjustedStatsWithoutMods[0] = statsWithoutMods[0] + (classItem.mobility || 0);
    adjustedStatsWithoutMods[1] = statsWithoutMods[1] + (classItem.resilience || 0);
    adjustedStatsWithoutMods[2] = statsWithoutMods[2] + (classItem.recovery || 0);
    adjustedStatsWithoutMods[3] = statsWithoutMods[3] + (classItem.discipline || 0);
    adjustedStatsWithoutMods[4] = statsWithoutMods[4] + (classItem.intellect || 0);
    adjustedStatsWithoutMods[5] = statsWithoutMods[5] + (classItem.strength || 0);
    applyMasterworkStats(classItem, config, adjustedStatsWithoutMods);

    // tmp artifice count
    const tmpArtificeCount =
      availableArtificeCount + (classItem.perk == ArmorPerkOrSlot.SlotArtifice ? 1 : 0);

    let tuningMax: number[] = preTuningMax.slice();
    if (config.calculateTierFiveTuning) {
      // tuning maxima without full generate (classItemT5 computed above)
      tuningMax = calcTuningMaxWithExtra(classItemT5);
    }

    // newDistances
    for (let n: ArmorStat = 0; n < 6; n++)
      newDistances[n] = Math.max(0, targetVals[n] - adjustedStats[n]);
    if (config.onlyShowResultsWithNoWastedStats) {
      for (let stat: ArmorStat = 0; stat < 6; stat++) {
        const v = 10 - (adjustedStats[stat] % 10);
        newDistances[stat] = Math.max(newDistances[stat], v < 10 ? v : 0);
      }
    }

    // newOptionalDistances
    for (let stat: ArmorStat = 0; stat < 6; stat++) newOptionalDistances[stat] = 0;
    if (config.tryLimitWastedStats) {
      for (let stat: ArmorStat = 0; stat < 6; stat++) {
        if (
          newDistances[stat] === 0 &&
          !targetFixed[stat] &&
          adjustedStats[stat] < 200 &&
          adjustedStats[stat] % 10 > 0
        ) {
          newOptionalDistances[stat] = 10 - (adjustedStats[stat] % 10);
        }
      }
    }

    // cheap global bound check
    const newDistanceSum =
      newDistances[0] +
      newDistances[1] +
      newDistances[2] +
      newDistances[3] +
      newDistances[4] +
      newDistances[5];
    const newTotalOptionalDistances =
      newOptionalDistances[0] +
      newOptionalDistances[1] +
      newOptionalDistances[2] +
      newOptionalDistances[3] +
      newOptionalDistances[4] +
      newOptionalDistances[5];

    if (
      newDistanceSum >
      10 * 5 + 3 * availableArtificeCount + 5 * (baseT5Improvements.length + (classItemT5 ? 1 : 0))
    ) {
      // This class item can't close the total gap — skip it (no early break, since class items
      // are now in natural order; infeasible CORES are already skipped by the per-core pre-check).
      continue classItemLoop;
    }

    // per-stat quick feasibility check
    let passesPerStat = true;
    for (let stat = 0; stat < 6; stat++) {
      const possibleIncreaseByTuning = tuningMax[stat];
      const possibleIncreaseByArtifice = 3 * tmpArtificeCount;
      const possibleIncrease =
        possibleIncreaseByMod + possibleIncreaseByTuning + possibleIncreaseByArtifice;
      if (possibleIncrease < newDistances[stat]) {
        passesPerStat = false;
        break;
      }
    }
    if (!passesPerStat) {
      continue classItemLoop;
    }

    // availableTunings is materialized LAZILY (inline, no per-iteration closure). At no/low targets
    // get_mods is trivial AND the tier search is gated, so this expensive per-class-item work
    // (build the 4-piece base sum once, extend by the class item's options, flatten) is skipped
    // entirely — which is the dominant remaining cost at low/no targets.
    let availableTunings: Tuning[] | null = null;

    // heavy work: mod precalc
    let result: StatModifierPrecalc | null;
    if (newDistanceSum === 0 && newTotalOptionalDistances === 0) {
      result = { mods: [], tuning: [0, 0, 0, 0, 0, 0], modBonus: [0, 0, 0, 0, 0, 0] };
    } else {
      // Tuning set for the OUTPUT get_mods. When more-is-better with targets, build only the
      // targeted-PROJECTION accumulator (one max-total witness per distinct targeted-projection) —
      // avoids materializing the full ~2-5k Minkowski set per build (the targeted-search wall).
      // Otherwise (fixed/waste, or no tuning) use the full set. availableTunings is left for the
      // tier pass, which materializes the full set lazily only when it actually needs it.
      let gmTunings: Tuning[];
      if (config.calculateTierFiveTuning && moreIsBetter && targetIdx.length > 0) {
        if (baseProjAcc === null)
          baseProjAcc = buildProjectedTuningAcc(baseT5Improvements, targetIdx);
        const acc = classItemT5
          ? extendProjectedTuningAcc(baseProjAcc, tuningOptionList(classItemT5), targetIdx)
          : baseProjAcc;
        gmTunings = Array.from(acc.values());
      } else if (config.calculateTierFiveTuning) {
        if (baseTuningAcc === null) baseTuningAcc = buildTuningAcc(baseT5Improvements);
        availableTunings = Array.from(
          (classItemT5
            ? extendTuningAcc(baseTuningAcc, tuningOptionList(classItemT5))
            : baseTuningAcc
          ).values()
        );
        // Locked-stat pre-filter (LOSSLESS): a tuning that pushes a locked stat above its lock
        // (t[n] > target[n]-adjusted[n]; the rest, target-adjusted-t, must come from mods which only
        // ADD) can't appear in ANY valid build, so drop it from the set used by BOTH the output
        // get_mods AND the tier pass below. This shrinks the per-leaf scan + recursion for every
        // fixed config — decisive for partial locks, where the tier pass maximises the FREE stats and
        // would otherwise re-scan the full ~thousands-large Minkowski set on every surviving core.
        if (anyFixed) {
          availableTunings = availableTunings.filter((t) => {
            for (let n: ArmorStat = 0; n < 6; n++)
              if (targetFixed[n] && t[n] > targetVals[n] - adjustedStats[n]) return false;
            return true;
          });
        }
        gmTunings = availableTunings;
      } else {
        availableTunings = [[0, 0, 0, 0, 0, 0]];
        gmTunings = availableTunings;
      }
      result = get_mods_precalc(
        adjustedStats,
        targetVals,
        config,
        newDistances,
        newOptionalDistances,
        tmpArtificeCount,
        config.modOptimizationStrategy,
        gmTunings,
        moreIsBetter
      );
    }

    if (result !== null) {
      // Cheap gate before the expensive reachable-tier search: maximumPossibleTiers only ever
      // grows, so skip the search entirely when this build's per-stat CEILING (adjusted stats +
      // max tuning + all mods + artifice, capped at 200) can't exceed the current max on ANY stat.
      // Once the global max is established (early), the vast majority of builds skip this — which
      // is the dominant per-build cost at low/no targets. Sound: only provable non-improvers skip.
      const artBonusForTiers = 3 * tmpArtificeCount;
      // The mod/tuning/artifice budget is SHARED across stats. Reaching V on s while ALSO meeting
      // the OTHER target stats leaves only (sharedBudget - other-target-gaps) for s — the old
      // "whole budget onto s" ceiling ignored that and fired ~99.9% wasted tier-tests under a
      // target. We take the MIN of two valid upper bounds: (A) the per-stat one (tight on this
      // stat's tuning, used at no-target), (B) the shared-budget one minus the other targets' gaps
      // (tight under a target). Both are upper bounds, so the min is too -> tiers stay EXACT.
      const nT5 = baseT5Improvements.length + (classItemT5 ? 1 : 0);
      const sharedTierBudget = possibleIncreaseByMod + artBonusForTiers + 5 * nT5;
      let totalTargetGaps = 0;
      for (let t: ArmorStat = 0; t < 6; t++)
        if (targetVals[t] > 0) totalTargetGaps += Math.max(0, targetVals[t] - adjustedStats[t]);
      // NO-TARGET fast path: with no targets there is no joint constraint, so a stat is maximised
      // independently — base + (exact) max tuning on it + all mods + all artifice, capped 200. That
      // is EXACTLY `ceiling` below, so we set max-tiers directly and skip the tuning search +
      // materialization entirely. (tuningMax is exact since the per-stat-tuning-max fix, so this is
      // not just an upper bound here — it's the true reachable max.) This is what keeps no-target
      // fast on the real vault, where the tier pass otherwise dominates per thread.
      const noTarget = targetIdx.length === 0;
      let canImproveTiers = false;
      for (let s = 0; s < 6; s++) {
        const sGap = targetVals[s] > 0 ? Math.max(0, targetVals[s] - adjustedStats[s]) : 0;
        const ceilA = adjustedStats[s] + tuningMax[s] + possibleIncreaseByMod + artBonusForTiers;
        const budgetForS = sharedTierBudget - (totalTargetGaps - sGap);
        const ceilB = adjustedStats[s] + (budgetForS > 0 ? budgetForS : 0);
        let ceiling = Math.min(200, ceilA < ceilB ? ceilA : ceilB);
        // A LOCKED stat can never exceed its lock, so its true max reachable IS the lock value. Cap
        // the ceiling there so the per-stat tier search never futilely probes above the lock — and
        // canImproveTiers stops firing once max-tiers reaches it. Without this, all-locked configs
        // re-run a full binary-search tier pass on ~every surviving core (the dominant cost).
        if (targetFixed[s] && ceiling > targetVals[s]) ceiling = targetVals[s];
        if (ceiling > runtime.maximumPossibleTiers[s]) {
          if (noTarget) {
            runtime.maximumPossibleTiers[s] = ceiling; // exact at no-target; no search needed
          } else {
            canImproveTiers = true;
            break;
          }
        }
      }
      if (canImproveTiers) {
        // materialize the tuning set now if get_mods didn't already (no/low-target path)
        if (availableTunings === null) {
          if (config.calculateTierFiveTuning) {
            if (baseTuningAcc === null) baseTuningAcc = buildTuningAcc(baseT5Improvements);
            availableTunings = Array.from(
              (classItemT5
                ? extendTuningAcc(baseTuningAcc, tuningOptionList(classItemT5))
                : baseTuningAcc
              ).values()
            );
          } else {
            availableTunings = [[0, 0, 0, 0, 0, 0]];
          }
        }
        performTierAvailabilityTesting(
          runtime,
          config,
          adjustedStats,
          targetVals,
          newDistances,
          tmpArtificeCount,
          availableTunings,
          useFrontForTierPass,
          moreIsBetter
        );
      }

      // B&B skip (Stage A): the tier gate above has already accounted for this build's reachable
      // tiers, so maximumPossibleTiers is correct no matter what we do here. Now skip the expensive
      // armor-set creation if this build's optimistic capped-total ceiling is STRICTLY below the
      // incumbent best for its profile — it can neither beat nor tie the kept best (strict '<'
      // leaves ties to be evaluated), so the single best-per-profile output is byte-identical.
      if (bbActive) {
        let ceilTotal = 0;
        const artBonus = 3 * tmpArtificeCount;
        for (let s = 0; s < 6; s++) {
          const c = adjustedStats[s] + tuningMax[s] + possibleIncreaseByMod + artBonus;
          ceilTotal += c < 200 ? c : 200;
        }
        let incumbent: number | undefined;
        if (!classItem.isExotic && classItem.gearSetHash == null) {
          incumbent = bbBestForMain; // dominant path: same profile as the 4 main pieces (O(1))
        } else {
          const exoticHash = bbMainExotic || (classItem.isExotic ? classItem.hash : 0);
          let key: string;
          if (classItem.gearSetHash == null) {
            key = exoticHash + "|" + bbMainSetsJoined;
          } else {
            const sets = bbMainSets.slice();
            let lo = 0;
            while (lo < sets.length && sets[lo] < classItem.gearSetHash) lo++;
            sets.splice(lo, 0, classItem.gearSetHash);
            key = exoticHash + "|" + sets.join(".");
          }
          incumbent = bestTotalByProfile!.get(key);
        }
        if (incumbent !== undefined && ceilTotal < incumbent) continue classItemLoop;
      }

      // Bug #3 fix: collect EVERY valid class-item build (not just the first), then emit the
      // per-core skyline. Previously only the first valid build per core was emitted, dropping
      // achievable builds from other class items.
      const built = tryCreateArmorSetWithClassItem(
        runtime,
        config,
        helmet,
        gauntlet,
        chest,
        leg,
        classItem,
        result,
        adjustedStats,
        adjustedStatsWithoutMods.slice(),
        newDistances,
        tmpArtificeCount,
        doNotOutput
      );
      if (isIPermutatorArmorSet(built)) {
        collected.push({
          set: built,
          prof: classItemProfileKey(classItem),
          stats: built.statsWithMods,
        });
      }
    }
  }

  return skylineBuilds(collected, moreIsBetter);
}

// Profile key for a class item within one core: builds are only comparable for the skyline if
// they share exotic identity / set bonus / mod-slot character (these are gameplay "ends", not
// just stat means). Exotics keyed by hash (different exotics are never interchangeable).
function classItemProfileKey(ci: IPermutatorArmor): string {
  if (ci.isExotic) return `E|${ci.hash}`;
  return `L|${ci.perk}|${ci.gearSetHash ?? "none"}`;
}

// Reduce a core's per-class-item builds to the raw-stat Pareto skyline within each class-item
// profile: always collapse exact stat-duplicates (keep the lowest index); when more-is-better
// (no fixed-stat / waste-limit, where higher is strictly better) also drop builds whose stats are
// matched-or-beaten by another of the same profile. Under fixed/waste configs only exact
// duplicates are collapsed, so no distinct outcome is lost.
function skylineBuilds(
  collected: { set: IPermutatorArmorSet; prof: string; stats: number[] }[],
  moreIsBetter: boolean
): IPermutatorArmorSet[] {
  if (collected.length <= 1) return collected.map((c) => c.set);
  const byProf = new Map<string, { set: IPermutatorArmorSet; stats: number[] }[]>();
  for (const c of collected) {
    const g = byProf.get(c.prof);
    if (g) g.push(c);
    else byProf.set(c.prof, [c]);
  }
  const out: IPermutatorArmorSet[] = [];
  for (const group of byProf.values()) {
    const n = group.length;
    const keep = new Array<boolean>(n).fill(true);
    for (let i = 0; i < n; i++) {
      if (!keep[i]) continue;
      const a = group[i].stats;
      for (let j = 0; j < n; j++) {
        if (i === j || !keep[j]) continue;
        const b = group[j].stats;
        let ge = true;
        let gt = false;
        for (let s = 0; s < 6; s++) {
          if (b[s] < a[s]) {
            ge = false;
            break;
          }
          if (b[s] > a[s]) gt = true;
        }
        if (!ge) continue;
        if (gt) {
          // j strictly dominates i: drop i only when higher stats are strictly better
          if (moreIsBetter) {
            keep[i] = false;
            break;
          }
        } else if (j < i) {
          // exact stat-duplicate: keep the lower index, drop this one (always safe)
          keep[i] = false;
          break;
        }
      }
    }
    for (let i = 0; i < n; i++) if (keep[i]) out.push(group[i].set);
  }
  return out;
}

// region Global build frontier
// A build's profile = the gameplay "ends" that must never be dominated away: which exotic (by
// hash) it uses and the multiset of set-bonus (gearSet) hashes across its 5 pieces. Builds in
// DIFFERENT profiles are never compared, so no exotic or set-bonus option is ever lost.
export function buildProfileKey(armor: number[], idToPiece: Map<number, IPermutatorArmor>): string {
  let exoticHash = 0;
  const sets: number[] = [];
  for (const id of armor) {
    const p = idToPiece.get(id);
    if (!p) continue;
    if (p.isExotic) exoticHash = p.hash;
    if (p.gearSetHash != null) sets.push(p.gearSetHash);
  }
  sets.sort((a, b) => a - b);
  return exoticHash + "|" + sets.join(".");
}

// Insert a build into its profile's Pareto frontier (raw 0–200 stat dominance). When more-is-
// better: skip it if an existing same-profile build is >= on all 6 stats (incl. exact equal ->
// dedup), else drop the builds it dominates and keep it. Under fixed-stat / waste configs (higher
// is NOT strictly better) only collapse exact duplicates, so no distinct outcome is lost.
export function insertIntoFrontier(
  frontier: Map<string, IPermutatorArmorSet[]>,
  b: IPermutatorArmorSet,
  idToPiece: Map<number, IPermutatorArmor>,
  moreIsBetter: boolean
): void {
  const key = buildProfileKey(b.armor, idToPiece);
  const group = frontier.get(key);
  if (!group) {
    frontier.set(key, [b]);
    return;
  }
  const bs = b.statsWithMods;
  if (!moreIsBetter) {
    // exact-duplicate collapse only
    for (let i = 0; i < group.length; i++) {
      const es = group[i].statsWithMods;
      if (
        es[0] === bs[0] &&
        es[1] === bs[1] &&
        es[2] === bs[2] &&
        es[3] === bs[3] &&
        es[4] === bs[4] &&
        es[5] === bs[5]
      )
        return;
    }
    group.push(b);
    return;
  }
  // more-is-better: full raw-stat dominance
  for (let i = 0; i < group.length; i++) {
    const es = group[i].statsWithMods;
    if (
      es[0] >= bs[0] &&
      es[1] >= bs[1] &&
      es[2] >= bs[2] &&
      es[3] >= bs[3] &&
      es[4] >= bs[4] &&
      es[5] >= bs[5]
    )
      return; // b is dominated (or an exact dup) — skip
  }
  // b survives: keep only the existing builds it does NOT dominate, then add b
  const kept: IPermutatorArmorSet[] = [];
  for (let i = 0; i < group.length; i++) {
    const es = group[i].statsWithMods;
    const bDominates =
      bs[0] >= es[0] &&
      bs[1] >= es[1] &&
      bs[2] >= es[2] &&
      bs[3] >= es[3] &&
      bs[4] >= es[4] &&
      bs[5] >= es[5];
    if (!bDominates) kept.push(group[i]);
  }
  kept.push(b);
  frontier.set(key, kept);
}

function flattenFrontier(frontier: Map<string, IPermutatorArmorSet[]>): IPermutatorArmorSet[] {
  const out: IPermutatorArmorSet[] = [];
  for (const group of frontier.values()) for (const b of group) out.push(b);
  return out;
}

export function sumStats(s: number[]): number {
  return s[0] + s[1] + s[2] + s[3] + s[4] + s[5];
}

// Deterministic total order among builds so the single "best per profile" choice is reproducible
// regardless of iteration / thread order (the frontier and B&B both rely on a stable incumbent).
// Ranking: higher TOTAL wins; ties → lexicographically greater stat vector; final ties → smaller
// armor-id tuple (fully stable). Returns true if `cand` should replace the current `best`.
export function outputBuildBetter(cand: IPermutatorArmorSet, best: IPermutatorArmorSet): boolean {
  const ct = sumStats(cand.statsWithMods);
  const bt = sumStats(best.statsWithMods);
  if (ct !== bt) return ct > bt;
  const cs = cand.statsWithMods;
  const bs = best.statsWithMods;
  for (let s = 0; s < 6; s++) {
    if (cs[s] !== bs[s]) return cs[s] > bs[s];
  }
  const ca = cand.armor;
  const ba = best.armor;
  for (let i = 0; i < ca.length && i < ba.length; i++) {
    if (ca[i] !== ba[i]) return ca[i] < ba[i];
  }
  return false;
}

// Final output reduction. Under more-is-better: return ONE build per profile (exotic + set
// bonuses) — the highest TOTAL-stats build ("best overall power for this exotic+set"; the user
// shapes the distribution via the minimum-stat targets). That is the small, meaningful list.
// Under fixed-stat / waste configs (higher is NOT strictly better) "best" is ill-defined, so
// return the full per-profile frontier instead. Max-total is monotonic in base stats, so per-slot
// pruning preserves the selected build exactly.
export function selectOutputBuilds(
  frontier: Map<string, IPermutatorArmorSet[]>,
  moreIsBetter: boolean
): IPermutatorArmorSet[] {
  if (!moreIsBetter) return flattenFrontier(frontier);
  const out: IPermutatorArmorSet[] = [];
  for (const group of frontier.values()) {
    let best = group[0];
    for (let i = 1; i < group.length; i++) {
      if (outputBuildBetter(group[i], best)) best = group[i];
    }
    out.push(best);
  }
  return out;
}
// endregion Global build frontier

function getStatVal(statId: ArmorStat, mods: StatModifierPrecalc, start: number) {
  return start + mods.tuning[statId] + mods.modBonus[statId];
}

// region Tier Availability Testing
function performTierAvailabilityTesting(
  runtime: any,
  config: BuildConfiguration,
  stats: number[],
  targetStats: number[],
  distances: number[],
  availableArtificeCount: number,
  availableTunings: Tuning[],
  useFront: boolean,
  relaxNonTargeted: boolean
): void {
  // The binary-search get_mods calls below only need to know FEASIBILITY ("can this value be
  // reached while meeting the other targets") — a pure lower-bound query when more-is-better. There
  // the Pareto-maximal frontier gives identical feasibility, so we scan it instead of the full set.
  // minimumTuning (the floor below) still uses the FULL set so that line is unchanged. Front is
  // stat-independent and computed at most once per tier pass (lazy).
  //
  // useFront also folds in a PERF gate: building the front is O(N^2), only worth it when the
  // binary-search get_mods is itself expensive (real stat targets -> deeper recursion + bigger
  // scans). At no-target the per-stat search touches only one distance, get_mods is cheap, and the
  // front-build overhead would be a net loss — so the caller passes useFront=false there.
  let frontCache: Tuning[] | null = null;
  const feasTunings = (): Tuning[] => {
    if (!useFront) return availableTunings;
    if (frontCache === null) frontCache = paretoFrontTunings(availableTunings);
    return frontCache;
  };

  for (let stat = 0; stat < 6; stat++) {
    // min tuning value for this stat (allocation-free; was availableTunings.map().reduce())
    let minimumTuning = 0;
    for (let t = 0; t < availableTunings.length; t++) {
      const v = availableTunings[t][stat];
      if (v < minimumTuning) minimumTuning = v;
    }
    const minStat = stats[stat];

    // Sorting the full tuning set is the dominant cost here, but it is only consumed by
    // get_mods_precalc inside the binary search below. Compute it LAZILY on first use so we skip
    // it entirely when minStat>=200 or the search range is empty (common once max-tiers are high).
    // Same comparator -> same order -> byte-identical results.
    let tmpTuningsCache: Tuning[] | null = null;
    const sortedTunings = (): Tuning[] => {
      if (tmpTuningsCache === null) {
        tmpTuningsCache = feasTunings()
          .slice()
          .sort((a, b) => {
            const aVal = a[stat];
            const bVal = b[stat];
            const aNeg = aVal < 0;
            const bNeg = bVal < 0;
            if (aNeg && bNeg) {
              // Both negative: sort descending
              return bVal - aVal;
            } else if (!aNeg && !bNeg) {
              // Both zero or positive: sort ascending
              return aVal - bVal;
            } else {
              // Zero/positive first, then negative
              return aNeg ? 1 : -1;
            }
          });
      }
      return tmpTuningsCache;
    };

    // Stats are hard-capped at 200 in-game, so the reachable max must never exceed 200 (raw
    // base+masterwork alone can sum past 200). Cap here and at every assignment below.
    const naturalFloor = Math.min(200, stats[stat] + minimumTuning);
    if (runtime.maximumPossibleTiers[stat] < naturalFloor) {
      runtime.maximumPossibleTiers[stat] = naturalFloor;
    }

    if (minStat >= 200) continue; // Already at max value, no need to test

    const minTier = config.minimumStatTiers[stat as ArmorStat].value * 10;

    // Binary search to find maximum possible value
    let low = Math.max(runtime.maximumPossibleTiers[stat], minTier);
    let high = 200;

    while (low <= high) {
      // Try middle value, rounded to nearest 10 for tier optimization
      const mid = Math.min(200, Math.ceil((low + high) / 2));

      if (minStat >= mid && minimumTuning == 0) {
        // We can already reach this value naturally
        low = mid + 1;
        continue;
      }

      // Calculate distance needed to reach this value
      const testDistances = [...distances];
      testDistances[stat] = Math.max(0, mid - minStat);

      // Check if this value is achievable with mods
      const mods = get_mods_precalc(
        stats,
        targetStats,
        config,
        testDistances,
        [0, 0, 0, 0, 0, 0],
        availableArtificeCount,
        ModOptimizationStrategy.None,
        sortedTunings(),
        relaxNonTargeted
      );

      if (mods != null) {
        let val = Math.min(200, getStatVal(stat, mods, minStat));
        runtime.maximumPossibleTiers[stat] = Math.max(val, runtime.maximumPossibleTiers[stat]);
        low = Math.max(runtime.maximumPossibleTiers[stat], mid) + 1;
      } else {
        // This value is not achievable, try lower
        high = mid - 1;
      }
    }

    // Verify the final value
    if (low > runtime.maximumPossibleTiers[stat] && low <= 200) {
      const testDistances = [...distances];
      testDistances[stat] = Math.max(low - minStat, 0);
      const mods = get_mods_precalc(
        stats,
        targetStats,
        config,
        testDistances,
        [0, 0, 0, 0, 0, 0],
        availableArtificeCount,
        ModOptimizationStrategy.None,
        sortedTunings(),
        relaxNonTargeted
      );
      if (mods != null) {
        runtime.maximumPossibleTiers[stat] = low;
        // also set the other stats
        // This may reduce the amount of required calculations for the stats that will be checked later on
        for (let otherStat = stat + 1; otherStat < 6; otherStat++) {
          runtime.maximumPossibleTiers[otherStat] = Math.max(
            Math.min(200, getStatVal(otherStat, mods, stats[otherStat])),
            runtime.maximumPossibleTiers[otherStat]
          );
        }
      }
    }
  }
}

function tryCreateArmorSetWithClassItem(
  runtime: any,
  config: BuildConfiguration,
  helmet: IPermutatorArmor,
  gauntlet: IPermutatorArmor,
  chest: IPermutatorArmor,
  leg: IPermutatorArmor,
  classItem: IPermutatorArmor,
  result: StatModifierPrecalc,
  adjustedStats: number[],
  statsWithoutMods: number[],
  newDistances: number[],
  availableArtificeCount: number,
  doNotOutput: boolean
): IPermutatorArmorSet | never[] {
  if (doNotOutput) return [];

  const usedArtifice = result.mods.filter((d: StatModifier) => 0 == d % 3);
  const usedMods = result.mods.filter((d: StatModifier) => 0 != d % 3);

  // Apply mods to stats for final calculation
  const finalStats = [...adjustedStats];
  for (let statModifier of result.mods) {
    const stat = Math.floor((statModifier - 1) / 3);
    finalStats[stat] += STAT_MOD_VALUES[statModifier][1];
  }

  // Tuning's -5 can floor a (don't-care) stat below 0; the game clamps stats at 0, so clamp here
  // too — otherwise statsWithMods could show a negative value once the non-targeted check is relaxed.
  for (let n = 0; n < 6; n++) finalStats[n] = Math.max(0, finalStats[n] + result.tuning[n]);

  const waste1 = getWaste(finalStats);
  if (config.onlyShowResultsWithNoWastedStats && waste1 > 0) return [];

  return createArmorSet(
    helmet,
    gauntlet,
    chest,
    leg,
    classItem,
    usedArtifice,
    usedMods,
    finalStats,
    statsWithoutMods,
    result.tuning
  );
}

// region Mod Calculation Functions

// Shared, never-mutated fallbacks: the single no-op mod combination used when a distance has no
// precalc entry, and a zero per-stat tuning-max vector (used when the available tuning set is empty).
const ZERO_MOD_LIST: number[][] = [[0, 0, 0, 0, 0, 0]];
const ZERO_TUNING_MAX: number[] = [0, 0, 0, 0, 0, 0];
// Shared placeholder passed as modBonusAcc on the no-fixed-stat path (never read or written there —
// the leaf only consults it when fixedMask !== null, see get_mods_recursive).
const EMPTY_MOD_BONUS: number[] = [0, 0, 0, 0, 0, 0];

// Pareto-maximal frontier of a tuning set: vectors not dominated (componentwise <=) by another.
// For a pure lower-bound feasibility query (more-is-better, no fixed/waste upper bounds), a
// dominating tuning is always at least as feasible, so the front yields IDENTICAL feasibility and
// thus exact max-tiers. Sort-desc-by-sum + compare-against-kept (a vector can only be dominated by
// one of >= sum). Set is already deduped, so >= on all stats with sum-desc ordering == strict dom.
function paretoFrontTunings(vs: Tuning[]): Tuning[] {
  const n = vs.length;
  if (n <= 1) return vs;
  const idx = new Array<number>(n);
  const sums = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const v = vs[i];
    idx[i] = i;
    sums[i] = v[0] + v[1] + v[2] + v[3] + v[4] + v[5];
  }
  idx.sort((a, b) => sums[b] - sums[a]);
  const kept: Tuning[] = [];
  for (let k = 0; k < n; k++) {
    const v = vs[idx[k]];
    let dominated = false;
    for (let j = 0; j < kept.length; j++) {
      const u = kept[j];
      if (
        u[0] >= v[0] &&
        u[1] >= v[1] &&
        u[2] >= v[2] &&
        u[3] >= v[3] &&
        u[4] >= v[4] &&
        u[5] >= v[5]
      ) {
        dominated = true;
        break;
      }
    }
    if (!dominated) kept.push(v);
  }
  return kept;
}

function get_mods_recursive(
  currentStats: number[],
  targetStats: number[],

  distances_to_check: number[],
  availableTunings: Tuning[],
  statIdx: number,
  availableArtificeCount: number,
  availableMajorMods: number,
  availableMods: number,
  // Per-stat max of availableTunings[*][s] (floored at 0), carried so each node reads its bound in
  // O(1) instead of re-reducing the whole tuning set. Recomputed only when the set is actually
  // filtered (see below) — the dominant levels (no tuning requirement) reuse the parent's vector.
  tuningMaxVec: number[],
  // When true (more-is-better: no fixed stat, no waste limiting), a tuning's -5 on a NON-targeted
  // stat (target<=0) is allowed — the stat just floors at 0 in-game, and the user doesn't care.
  // Only the targeted stats must stay >= their minimum. This is what makes feasibility depend only
  // on the targeted stats (and fixes the old under-reporting of max-tiers). Off for fixed/waste.
  relaxNonTargeted: boolean,
  // When non-null, fixedMask[i]==1 marks stat i as LOCKED: its FINAL value (base + the mods chosen
  // for it + the tuning) must EQUAL targetStats[i] exactly — no over- and no under-shoot. mods and
  // tuning are picked per-stat / globally to cover the OTHER stats' deficits, and a Balanced (+1)
  // or +5/-5 tuning can incidentally push a locked stat off its value; the leaf rejects those.
  // modBonusAcc carries the per-stat mod bonus chosen so far (set at each level before recursing)
  // so the leaf can compute the true final value. Both are inert when fixedMask is null (the
  // common, perf-critical no-lock path runs byte-identically to before).
  fixedMask: number[] | null,
  modBonusAcc: number[]
): number[][] | null {
  if (statIdx > 5) {
    // Now we have a valid set of mods and tunings, but we still have to check -5 values. This will happen in innermost loop
    // statIdx is no longer useful here

    // Now there are only tunings with negative values left.
    // 2.1 If there is any stat where (currentStat - tuningValue) >= target value, then return
    outer: for (let tuning of availableTunings) {
      for (let i = 0; i < 6; i++) {
        // LOCKED stat: the final value (base + chosen mods + this tuning) must hit the lock EXACTLY.
        // This catches a Balanced (+1) or +5/-5 tuning that would push a locked stat off its value
        // (the reported "overshoots locked stats" bug), as well as mods that overshoot it.
        if (fixedMask !== null && fixedMask[i]) {
          if (currentStats[i] + modBonusAcc[i] + tuning[i] !== targetStats[i]) continue outer;
          continue;
        }
        if (tuning[i] >= 0) continue;
        // non-targeted stat may drop freely (clamps at 0) when relaxed — don't reject for it
        if (relaxNonTargeted && targetStats[i] <= 0) continue;
        if (currentStats[i] + tuning[i] < targetStats[i]) continue outer;
      }
      return [tuning];
    }

    // 2.2 if we still have a few mods left, we can simply call the recursion again, but with the new "temp" stats
    if (availableMods > 0) {
      for (let tuning of availableTunings) {
        const newStats = currentStats.map((s, i) => s + tuning[i]);
        // don't spend mods recovering a non-targeted stat the tuning floored — we don't care about it
        const newDists = distances_to_check.map((d, i) =>
          relaxNonTargeted && targetStats[i] <= 0 ? 0 : Math.max(0, targetStats[i] - newStats[i])
        );
        const otherMods = get_mods_recursive(
          newStats,
          targetStats,
          newDists,
          [],
          0,
          availableArtificeCount,
          availableMajorMods,
          availableMods,
          ZERO_TUNING_MAX,
          relaxNonTargeted,
          // Empty tuning set -> this inner call always returns null (the leaf needs >=1 tuning), so
          // this branch is inert. Pass null so it never mutates the outer modBonusAcc.
          null,
          modBonusAcc
        );
        if (otherMods !== null) {
          return [...otherMods, tuning];
        }
      }
    }

    return null;
  }

  const maxValueOfAvailableTunings = tuningMaxVec[statIdx];

  const distance = distances_to_check[statIdx];

  // Iterate the precalc combinations directly (was a per-node .filter() allocation): the resource
  // gates below — incl. mod[3] <= maxValueOfAvailableTunings — are exactly the old filter, and the
  // mod[3] gate is equivalent to the selectedTuningsInner.length==0 -> continue path that follows.
  const precalculatedMods = precalculatedTuningModCombinations[distance] || ZERO_MOD_LIST;

  for (const pickedMod of precalculatedMods) {
    if (
      pickedMod[0] > availableArtificeCount ||
      pickedMod[2] > availableMajorMods ||
      pickedMod[2] + pickedMod[1] > availableMods ||
      pickedMod[3] > maxValueOfAvailableTunings
    ) {
      continue;
    }

    const totalMods = Math.max(0, availableMods - pickedMod[1] - pickedMod[2]);
    const majorMods = Math.min(totalMods, Math.max(0, availableMajorMods - pickedMod[2]));
    const artifice = Math.max(0, availableArtificeCount - pickedMod[0]);

    let selectedTuningsInner = availableTunings;
    let nextTuningMaxVec = tuningMaxVec;
    const requiredTuningCount = pickedMod[4];
    const requiredTuningValue = pickedMod[3];
    if (requiredTuningCount > 0) {
      // Filter to tunings that supply the required value on this stat AND recompute the per-stat
      // max over the survivors in the SAME pass (insertion order preserved == old .filter() order,
      // so the leaf still returns the identical first-valid tuning).
      const filtered: Tuning[] = [];
      const m = [0, 0, 0, 0, 0, 0];
      for (let ti = 0; ti < availableTunings.length; ti++) {
        const t = availableTunings[ti];
        if (t[statIdx] >= requiredTuningValue) {
          filtered.push(t);
          if (t[0] > m[0]) m[0] = t[0];
          if (t[1] > m[1]) m[1] = t[1];
          if (t[2] > m[2]) m[2] = t[2];
          if (t[3] > m[3]) m[3] = t[3];
          if (t[4] > m[4]) m[4] = t[4];
          if (t[5] > m[5]) m[5] = t[5];
        }
      }
      if (filtered.length == 0) {
        continue;
      }
      selectedTuningsInner = filtered;
      nextTuningMaxVec = m;
    }

    // Record the mod-only bonus this pick puts on statIdx (artifice*3 + minor*5 + major*10 — the
    // same reconstruction get_mods_precalc uses) so the leaf can verify locked stats land exactly.
    // Each level owns its own statIdx and overwrites it per pick, so no restore is needed.
    if (fixedMask !== null)
      modBonusAcc[statIdx] = pickedMod[0] * 3 + pickedMod[1] * 5 + pickedMod[2] * 10;

    const otherMods = get_mods_recursive(
      currentStats,
      targetStats,
      distances_to_check,
      selectedTuningsInner,
      statIdx + 1,
      artifice,
      majorMods,
      totalMods,
      nextTuningMaxVec,
      relaxNonTargeted,
      fixedMask,
      modBonusAcc
    );
    if (otherMods !== null) {
      return [pickedMod, ...otherMods];
    }
  }
  return null;
}

type StatModifierPrecalc = {
  mods: StatModifier[];
  modBonus: number[];
  tuning: Tuning;
};

function get_mods_precalc(
  currentStats: number[],
  targetStats: number[],
  config: BuildConfiguration,
  distances: number[],
  optionalDistances: number[],
  availableArtificeCount: number,
  optimize: ModOptimizationStrategy = ModOptimizationStrategy.None,
  availableTunings: Tuning[],
  // more-is-better: allow tunings that floor a non-targeted stat (see get_mods_recursive). Default
  // false keeps the strict behaviour for fixed-stat / waste-limiting configs.
  relaxNonTargeted: boolean = false
): StatModifierPrecalc | null {
  const totalDistance =
    distances[0] + distances[1] + distances[2] + distances[3] + distances[4] + distances[5];
  if (totalDistance > 50 + 25) return null;

  // Locked-stat mask (build once per request, cached on the config): when any stat is fixed, the
  // recursion must land its FINAL value exactly on the lock — mods/tuning chosen for OTHER stats
  // must not over- or under-shoot it. null (no locks) keeps the hot no-lock path allocation-free.
  let fixedMask: number[] | null | undefined = (config as any).__fixedMask;
  if (fixedMask === undefined) {
    fixedMask = null;
    for (let i: ArmorStat = 0; i < 6; i++) {
      if (config.minimumStatTiers[i] && config.minimumStatTiers[i].fixed) {
        if (fixedMask === null) fixedMask = [0, 0, 0, 0, 0, 0];
        fixedMask[i] = 1;
      }
    }
    (config as any).__fixedMask = fixedMask;
  }

  if (totalDistance == 0 && optionalDistances.every((d) => d == 0)) {
    // No mods needed — every stat already meets its target. (Cores that overshoot a locked stat are
    // aborted strictly before get_mods, so totalDistance==0 here means each locked stat sits exactly
    // on its lock.)
    return { mods: [], tuning: [0, 0, 0, 0, 0, 0], modBonus: [0, 0, 0, 0, 0, 0] };
  }

  // Per-stat max of the available tuning set (floored at 0), computed once and carried into the
  // recursion so each node looks up its bound in O(1) (see get_mods_recursive).
  const tuningMaxVec = [0, 0, 0, 0, 0, 0];
  for (let ti = 0; ti < availableTunings.length; ti++) {
    const t = availableTunings[ti];
    if (t[0] > tuningMaxVec[0]) tuningMaxVec[0] = t[0];
    if (t[1] > tuningMaxVec[1]) tuningMaxVec[1] = t[1];
    if (t[2] > tuningMaxVec[2]) tuningMaxVec[2] = t[2];
    if (t[3] > tuningMaxVec[3]) tuningMaxVec[3] = t[3];
    if (t[4] > tuningMaxVec[4]) tuningMaxVec[4] = t[4];
    if (t[5] > tuningMaxVec[5]) tuningMaxVec[5] = t[5];
  }

  const modBonusAcc = fixedMask === null ? EMPTY_MOD_BONUS : [0, 0, 0, 0, 0, 0];

  let pickedMods = get_mods_recursive(
    currentStats,
    targetStats,
    distances,
    availableTunings,
    0,
    availableArtificeCount,
    config.statModLimits.maxMajorMods,
    config.statModLimits.maxMods,
    tuningMaxVec,
    relaxNonTargeted,
    fixedMask,
    modBonusAcc
  );

  if (pickedMods === null) return null;

  const usedMods = [];
  const modBonus = [0, 0, 0, 0, 0, 0];
  // The last entry is always the tuning
  for (let i = 0; i < pickedMods.length - 1; i++) {
    for (let n = 0; n < pickedMods[i][1]; n++) {
      usedMods.push(1 + 3 * i);
      modBonus[i] += 5;
    }
    for (let n = 0; n < pickedMods[i][2]; n++) {
      usedMods.push(2 + 3 * i);
      modBonus[i] += 10;
    }
    for (let n = 0; n < pickedMods[i][0]; n++) {
      usedMods.push(3 + 3 * i);
      modBonus[i] += 3;
    }
  }

  return {
    mods: usedMods,
    modBonus: modBonus,
    tuning: pickedMods[pickedMods.length - 1] as Tuning,
  };
}

export function getSkillTier(stats: number[]) {
  return (
    Math.floor(Math.min(200, stats[ArmorStat.StatWeapon]) / 10) +
    Math.floor(Math.min(200, stats[ArmorStat.StatHealth]) / 10) +
    Math.floor(Math.min(200, stats[ArmorStat.StatClass]) / 10) +
    Math.floor(Math.min(200, stats[ArmorStat.StatGrenade]) / 10) +
    Math.floor(Math.min(200, stats[ArmorStat.StatSuper]) / 10) +
    Math.floor(Math.min(200, stats[ArmorStat.StatMelee]) / 10)
  );
}

export function getWaste(stats: number[]) {
  return (
    Math.max(0, stats[ArmorStat.StatWeapon] - 200) +
    Math.max(0, stats[ArmorStat.StatHealth] - 200) +
    Math.max(0, stats[ArmorStat.StatClass] - 200) +
    Math.max(0, stats[ArmorStat.StatGrenade] - 200) +
    Math.max(0, stats[ArmorStat.StatSuper] - 200) +
    Math.max(0, stats[ArmorStat.StatMelee] - 200)
  );
}
// endregion Core Calculation Functions
