import type { BuildConfiguration } from "./buildConfiguration";
import { ArmorPerkOrSlot, ArmorPerkSocketHashes } from "./enum/armor-stat";
import type { IPermutatorArmor } from "./types/IPermutatorArmor";

// Perk requirements and gear set requirements share one numeric key space; only perks are enum values.
const armorPerkValues = new Set<number>(
  Object.values(ArmorPerkOrSlot).filter((v) => typeof v === "number") as number[]
);

export function calculateRequiredPerkCounts(config: BuildConfiguration) {
  const constantPerkRequirement = new Map<ArmorPerkOrSlot, number>();

  for (const requirement of config.armorRequirements) {
    if ("perk" in requirement) {
      let perk = requirement.perk;

      const e = Object.entries(ArmorPerkSocketHashes).find(([, value]) => value == perk);
      if (e) perk = Number.parseInt(e[0]) as any as ArmorPerkOrSlot;

      if (perk != ArmorPerkOrSlot.Any && perk != ArmorPerkOrSlot.None) {
        constantPerkRequirement.set(perk, (constantPerkRequirement.get(perk) ?? 0) + 1);
      }
    } else if ("gearSetHash" in requirement) {
      constantPerkRequirement.set(
        requirement.gearSetHash,
        (constantPerkRequirement.get(requirement.gearSetHash) ?? 0) + 1
      );
    }
  }
  return constantPerkRequirement;
}

/** Checks perk and gear set requirements without allocating per armor set. */
export class ArmorRequirementMatcher {
  readonly size: number;
  private readonly index = new Map<number, number>();
  private readonly isPerk: boolean[] = [];
  private readonly initial: Int32Array;
  private readonly remaining: Int32Array;
  private selectableGearSetItems = 0;

  constructor(config: BuildConfiguration) {
    const counts = calculateRequiredPerkCounts(config);
    this.size = counts.size;
    this.initial = new Int32Array(this.size);
    this.remaining = new Int32Array(this.size);
    let position = 0;
    for (const [key, count] of counts) {
      this.index.set(key, position);
      this.isPerk.push(armorPerkValues.has(key));
      this.initial[position++] = count;
    }
  }

  matches(
    helmet: IPermutatorArmor,
    gauntlet: IPermutatorArmor,
    chest: IPermutatorArmor,
    leg: IPermutatorArmor,
    classItem: IPermutatorArmor
  ): boolean {
    if (this.size === 0) return true;
    this.remaining.set(this.initial);
    this.selectableGearSetItems = 0;
    this.tally(helmet);
    this.tally(gauntlet);
    this.tally(chest);
    this.tally(leg);
    this.tally(classItem);
    return this.satisfied();
  }

  matchesItems(items: readonly IPermutatorArmor[]): boolean {
    if (this.size === 0) return true;
    this.remaining.set(this.initial);
    this.selectableGearSetItems = 0;
    for (const item of items) this.tally(item);
    return this.satisfied();
  }

  private tally(item: IPermutatorArmor): void {
    const perkPosition = this.index.get(item.perk);
    if (perkPosition !== undefined) this.remaining[perkPosition]--;

    // A selectable gear set piece can fulfil any single gear set requirement.
    if (item.gearSetPerkSelectable) this.selectableGearSetItems++;

    if (item.gearSetHash != null) {
      const gearSetPosition = this.index.get(item.gearSetHash);
      if (gearSetPosition !== undefined) this.remaining[gearSetPosition]--;
    }
  }

  private satisfied(): boolean {
    let perkRemaining = 0;
    let gearSetRemaining = 0;
    for (let position = 0; position < this.size; position++) {
      const remaining = this.remaining[position];
      if (remaining <= 0) continue;
      if (this.isPerk[position]) perkRemaining += remaining;
      else gearSetRemaining += remaining;
    }
    return perkRemaining + Math.max(0, gearSetRemaining - this.selectableGearSetItems) === 0;
  }
}
