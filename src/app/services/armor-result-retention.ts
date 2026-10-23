import { ArmorRequirementMatcher } from "../data/armor-requirements";
import type { BuildConfiguration } from "../data/buildConfiguration";
import { FORCE_USE_ANY_EXOTIC, FORCE_USE_NO_EXOTIC } from "../data/constants";
import { ArmorStat, STAT_MOD_VALUES } from "../data/enum/armor-stat";
import type { IPermutatorArmor } from "../data/types/IPermutatorArmor";
import { environment } from "../../environments/environment";
import type { ResultItem } from "../components/authenticated-v2/results/results.component";
import type { ResultEntry } from "./armor-result-entries";

// Settings that only restrict which armor sets are listed or which armor is available; a computed
// armor set stays valid when they change as long as it still satisfies them (checked below).
// Every other setting changes the stats a given armor set produces and invalidates all results.
const RESTRICTION_KEYS = new Set([
  "version",
  "minimumStatTiers",
  "statModLimits",
  "selectedExotics",
  "selectedExoticPerks",
  "armorRequirements",
  "disabledItems",
  "parsedResultLimit",
  "earlyAbortClassItems",
  "stopAtTheoreticalMaximum",
  "maxWorkers",
  "tryLimitWastedStats",
  "onlyShowResultsWithNoWastedStats",
  "useEventArmor",
  "allowBlueArmorPieces",
  "allowLegacyLegendaryArmor",
  "allowLegacyExoticArmor",
  "enforceFeaturedLegendaryArmor",
  "enforceFeaturedExoticArmor",
  "ignoreSunsetArmor",
  "includeVendorRolls",
  "includeCollectionRolls",
  "onlyUseMasterworkedExotics",
  "onlyUseMasterworkedLegendaries",
  "foldSameStatDifferentGearSets",
]);

function withoutRestrictions(config: BuildConfiguration): string {
  return JSON.stringify(config, (key, value) => (RESTRICTION_KEYS.has(key) ? undefined : value));
}

export function resultsRemainComparable(
  previous: BuildConfiguration,
  next: BuildConfiguration
): boolean {
  return withoutRestrictions(previous) === withoutRestrictions(next);
}

function sameItem(item: IPermutatorArmor, listed: ResultItem): boolean {
  return (
    item.perk === listed.perk &&
    item.masterworkLevel === listed.masterworkLevel &&
    (item.tuningStat ?? null) === (listed.tuningStat ?? null) &&
    (item.gearSetHash ?? null) === (listed.gearSetHash ?? null) &&
    item.resilience === listed.stats[0] &&
    item.strength === listed.stats[1] &&
    item.discipline === listed.stats[2] &&
    item.intellect === listed.stats[3] &&
    item.recovery === listed.stats[4] &&
    item.mobility === listed.stats[5]
  );
}

function meetsRestrictions(
  entry: ResultEntry,
  items: readonly IPermutatorArmor[],
  config: BuildConfiguration,
  matcher: ArmorRequirementMatcher
): boolean {
  const { stats, mods, waste } = entry.definition;

  for (let stat = 0; stat < 6; stat++) {
    const selection = config.minimumStatTiers[stat as ArmorStat];
    const tier = selection.value || 0;
    if (stats[stat] < tier * 10) return false;
    if (selection.fixed && Math.floor(Math.min(200, stats[stat]) / 10) !== tier) return false;
  }

  const exoticCount = items.filter((item) => item.isExotic).length;
  const firstExotic = config.selectedExotics[0];
  if (firstExotic === FORCE_USE_NO_EXOTIC) {
    if (exoticCount !== 0) return false;
  } else if (config.selectedExotics.length > 0 || firstExotic === FORCE_USE_ANY_EXOTIC) {
    if (exoticCount !== 1) return false;
  }

  if (environment.featureFlags.enableZeroWaste && config.onlyShowResultsWithNoWastedStats) {
    if (waste > 0 || stats.some((value) => value < 200 && value % 10 !== 0)) return false;
  }

  const limits = environment.featureFlags.enableModslotLimitation
    ? config.statModLimits
    : { maxMods: 5, maxMajorMods: 5 };
  const majorMods = mods.filter(
    (mod) => STAT_MOD_VALUES[mod as keyof typeof STAT_MOD_VALUES][1] === 10
  );
  if (mods.length > limits.maxMods || majorMods.length > limits.maxMajorMods) return false;

  return matcher.matchesItems(items);
}

/**
 * Returns the entries of an earlier run that are still valid results for `config`.
 * `pool` holds the armor the new run can use; `previous` is the configuration the entries came from.
 */
export function retainMatchingResults(
  entries: readonly ResultEntry[],
  previous: BuildConfiguration,
  config: BuildConfiguration,
  pool: ReadonlyMap<number, IPermutatorArmor>
): ResultEntry[] {
  if (entries.length === 0 || !resultsRemainComparable(previous, config)) return [];

  const matcher = new ArmorRequirementMatcher(config);
  const retained: ResultEntry[] = [];
  for (const entry of entries) {
    const items: IPermutatorArmor[] = [];
    let usable = true;
    for (let index = 0; index < entry.set.armor.length; index++) {
      const item = pool.get(entry.set.armor[index]);
      if (!item || !sameItem(item, entry.definition.items[index])) {
        usable = false;
        break;
      }
      items.push(item);
    }
    if (usable && meetsRestrictions(entry, items, config, matcher)) retained.push(entry);
  }

  return config.parsedResultLimit > 0 ? retained.slice(0, config.parsedResultLimit) : retained;
}
