import {EnumDictionary} from "./types/EnumDictionary";
import {ModOrAbility} from "./enum/modOrAbility";
import {Modifier} from "./modifier";
import {ModifierType} from "./enum/modifierType";
import {ArmorStat, SpecialArmorStat} from "./enum/armor-stat";
import {DestinyEnergyType} from "bungie-api-ts/destiny2/interfaces";

export const ModInformation: EnumDictionary<ModOrAbility, Modifier> = {
  // Positive STASIS
  [ModOrAbility.WhisperOfDurance]: {
    id: ModOrAbility.WhisperOfDurance,
    name: "Whisper Of Durance",
    description: "Slow from your abilities lasts longer. For those abilities that linger, their duration will also increase.",
    type: ModifierType.Stasis,
    bonus: [{stat: ArmorStat.Strength, value: 10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 3469412969
  },
  [ModOrAbility.WhisperOfChains]: {
    id: ModOrAbility.WhisperOfChains,
    name: "Whisper Of Chains",
    description: "While you are near frozen targets or a friendly Stasis crystal, you take reduced damage from targets.",
    type: ModifierType.Stasis,
    bonus: [{stat: ArmorStat.Recovery, value: 10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 537774540
  },
  [ModOrAbility.WhisperOfShards]: {
    id: ModOrAbility.WhisperOfShards,
    name: "Whisper Of Shards",
    description: "Shattering a Stasis crystal temporarily boosts your grenade recharge rate. Shattering additional Stasis crystals increases the duration of this benefit.",
    type: ModifierType.Stasis,
    bonus: [{stat: ArmorStat.Resilience, value: 10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 3469412975
  },
  [ModOrAbility.WhisperOfConduction]: {
    id: ModOrAbility.WhisperOfConduction,
    name: "Whisper Of Conduction",
    description: "Nearby Stasis shards track to your position.",
    type: ModifierType.Stasis,
    bonus: [{stat: ArmorStat.Resilience, value: 10}, {stat: ArmorStat.Intellect, value: 10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 2483898429
  },
  // NEGATIVE STASIS

  [ModOrAbility.WhisperOfBonds]: {
    id: ModOrAbility.WhisperOfBonds,
    name: "Whisper of Bonds",
    description: "Defeating frozen targets grants you Super energy.",
    type: ModifierType.Stasis,
    bonus: [{stat: ArmorStat.Discipline, value: -10}, {stat: ArmorStat.Intellect, value: -10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 3469412974
  },
  [ModOrAbility.WhisperOfHedrons]: {
    id: ModOrAbility.WhisperOfHedrons,
    name: "Whisper of Hedrons",
    description: "Dramatically increases weapon stability, weapon aim assist, Mobility, Resilience, and Recovery after freezing a target with Stasis.",
    type: ModifierType.Stasis,
    bonus: [{stat: ArmorStat.Strength, value: -10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 3469412970
  },
  [ModOrAbility.WhisperOfFractures]: {
    id: ModOrAbility.WhisperOfFractures,
    name: "Whisper of Fractures",
    description: "Your melee energy recharges faster when you are near two or more targets.",
    type: ModifierType.Stasis,
    bonus: [{stat: ArmorStat.Discipline, value: -10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 537774542
  },
  [ModOrAbility.WhisperOfHunger]: {
    id: ModOrAbility.WhisperOfHunger,
    name: "Whisper of Hunger",
    description: "Increases the melee energy gained from picking up Stasis shards.",
    type: ModifierType.Stasis,
    bonus: [{stat: ArmorStat.Mobility, value: -10}, {stat: ArmorStat.Recovery, value: -10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 2483898431
  },
  // VOID
  [ModOrAbility.EchoOfExpulsion]: {
    id: ModOrAbility.EchoOfExpulsion,
    name: "Echo of Expulsion",
    description: "Void ability final blows cause targets to explode.",
    type: ModifierType.Void,
    bonus: [{stat: ArmorStat.Intellect, value: 10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 2272984665
  },
  [ModOrAbility.EchoOfProvision]: {
    id: ModOrAbility.EchoOfProvision,
    name: "Echo of Provision",
    description: "Damaging targets with grenades grants melee energy.",
    type: ModifierType.Void,
    bonus: [{stat: ArmorStat.Strength, value: -10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 2272984664
  },
  [ModOrAbility.EchoOfPersistence]: {
    id: ModOrAbility.EchoOfPersistence,
    name: "Echo of Persistence",
    description: "Void buffs applied to you (Invisibility, Overshield, and Devour) have increased duration.",
    type: ModifierType.Void,
    bonus: [{stat: SpecialArmorStat.ClassAbilityRegenerationStat, value: -10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 2272984671
  },
  [ModOrAbility.EchoOfLeeching]: {
    id: ModOrAbility.EchoOfLeeching,
    name: "Echo of Leeching",
    description: "Melee final blows start health regeneration for you and nearby allies.",
    type: ModifierType.Void,
    bonus: [{stat: ArmorStat.Resilience, value: 10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 2272984670
  },
  [ModOrAbility.EchoOfDomineering]: {
    id: ModOrAbility.EchoOfDomineering,
    name: "Echo of Domineering",
    description: "After suppressing a target, you gain greatly increased Mobility for a short duration and your equipped weapon is reloaded from reserves.",
    type: ModifierType.Void,
    bonus: [{stat: ArmorStat.Discipline, value: 10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 2272984657
  },
  [ModOrAbility.EchoOfDilation]: {
    id: ModOrAbility.EchoOfDilation,
    name: "Echo of Dilation",
    description: "While crouched, you sneak faster and gain enhanced radar resolution.",
    type: ModifierType.Void,
    bonus: [{stat: ArmorStat.Mobility, value: 10}, {stat: ArmorStat.Intellect, value: 10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 2272984656
  },
  [ModOrAbility.EchoOfUndermining]: {
    id: ModOrAbility.EchoOfUndermining,
    name: "Echo of Undermining",
    description: "Your Void grenades weaken targets.",
    type: ModifierType.Void,
    bonus: [{stat: ArmorStat.Discipline, value: -20}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 2272984668
  },
  [ModOrAbility.EchoOfInstability]: {
    id: ModOrAbility.EchoOfInstability,
    name: "Echo of Instability",
    description: "Defeating targets with grenades grants Volatile Rounds to your Void weapons.",
    type: ModifierType.Void,
    bonus: [{stat: ArmorStat.Strength, value: 10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 2661180600
  },
  [ModOrAbility.EchoOfObscurity]: {
    id: ModOrAbility.EchoOfObscurity,
    name: "Echo of Obscurity",
    description: "Finisher final blows grant Invisibility.",
    type: ModifierType.Void,
    bonus: [{stat: ArmorStat.Recovery, value: 10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 2661180602
  },
  [ModOrAbility.EchoOfHarvest]: {
    id: ModOrAbility.EchoOfHarvest,
    name: "Echo of Harvest",
    description: "Defeating weakened targets with precision final blows will create an Orb of Power.",
    type: ModifierType.Void,
    bonus: [{stat: ArmorStat.Intellect, value: -10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 2661180601
  },
  [ModOrAbility.EchoOfStarvation]: {
    id: ModOrAbility.EchoOfStarvation,
    name: "Echo of Starvation",
    description: "Picking up an Orb of Power grants Devour.",
    type: ModifierType.Void,
    bonus: [{stat: ArmorStat.Recovery, value: -10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 2661180603
  },
  [ModOrAbility.EchoOfVigilance]: {
    id: ModOrAbility.EchoOfVigilance,
    name: "Echo of Vigilance",
    description: "Defeating a target while your shields are depleted grants you a temporary Void overshield.",
    type: ModifierType.Void,
    bonus: [{stat: ArmorStat.Recovery, value: -10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 3854948621
  },
  // SOLAR
  [ModOrAbility.EmberOfBenelovence]: {
    id: ModOrAbility.EmberOfBenelovence,
    name: "Ember of Benelovence",
    description: "Applying restoration, cure, or radiant to allies grants increased grenade, melee, and class ability regeneration for a short duration.",
    type: ModifierType.Solar,
    bonus: [{stat: ArmorStat.Discipline, value: -10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 362132292
  },
  [ModOrAbility.EmberOfBeams]: {
    id: ModOrAbility.EmberOfBeams,
    name: "Ember of Beams",
    description: "Your Solar Super projectiles have stronger target acquisition.",
    type: ModifierType.Solar,
    bonus: [{stat: ArmorStat.Intellect, value: 10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 362132295
  },
  [ModOrAbility.EmberOfEmpyrean]: {
    id: ModOrAbility.EmberOfEmpyrean,
    name: "Ember of Empyrean",
    description: "Solar weapon or ability final blows extend the duration of restoration and radiant effects applied to you.",
    type: ModifierType.Solar,
    bonus: [{stat: ArmorStat.Resilience, value: -10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 362132294
  },
  [ModOrAbility.EmberOfCombustion]: {
    id: ModOrAbility.EmberOfCombustion,
    name: "Ember of Combustion",
    description: "Final blows with your Solar Super cause targets to ignite.",
    type: ModifierType.Solar,
    bonus: [{stat: ArmorStat.Strength, value: 10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 362132289
  },
  [ModOrAbility.EmberOfChar]: {
    id: ModOrAbility.EmberOfChar,
    name: "Ember of Char",
    description: "Your Solar ignitions spread scorch to affected targets.",
    type: ModifierType.Solar,
    bonus: [{stat: ArmorStat.Discipline, value: 10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 362132291
  },
  [ModOrAbility.EmberOfTempering]: { // may be wrong
    id: ModOrAbility.EmberOfTempering,
    name: "Ember of Tempering",
    description: "Solar weapon final blows grant you and your allies increased recovery for a short duration. Stacks 3 times.\n" +
      "While Ember of Tempering is active, your weapons have increased airborne effectiveness.",
    type: ModifierType.Solar,
    bonus: [{stat: ArmorStat.Recovery, value: -10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 362132290
  },
  [ModOrAbility.EmberOfEruption]: {
    id: ModOrAbility.EmberOfEruption,
    name: "Ember of Eruption",
    description: "Your Solar ignitions have increased area of effect.",
    type: ModifierType.Solar,
    bonus: [{stat: ArmorStat.Strength, value: 10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 1051276348
  },
  [ModOrAbility.EmberOfWonder]: {
    id: ModOrAbility.EmberOfWonder,
    name: "Ember of Wonder",
    description: "Rapidly defeating multiple targets with Solar ignitions generates an Orb of Power.",
    type: ModifierType.Solar,
    bonus: [{stat: ArmorStat.Resilience , value: 10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 1051276350
  },
  [ModOrAbility.EmberOfSearing]: {
    id: ModOrAbility.EmberOfSearing,
    name: "Ember of Searing",
    description: "Defeating scorched targets grants melee energy.",
    type: ModifierType.Solar,
    bonus: [{stat: ArmorStat.Recovery , value: 10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 1051276351
  },
  [ModOrAbility.EmberOfTorches]: {
    id: ModOrAbility.EmberOfTorches,
    name: "Ember of Torches",
    description: "Powered melee attacks against combatants make you and nearby allies radiant.",
    type: ModifierType.Solar,
    bonus: [{stat: ArmorStat.Discipline , value: -10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 362132288
  },
  [ModOrAbility.EmberOfMercy]: {
    id: ModOrAbility.EmberOfMercy,
    name: "Ember of Mercy",
    description: "When you revive an ally, you and other nearby allies gain restoration. Picking up a Firesprite grants restoration.",
    type: ModifierType.Solar,
    bonus: [{stat: ArmorStat.Resilience , value: 10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 4180586737
  },
  /** ARC **/

  [ModOrAbility.SparkOfBrilliance]: {
    id: ModOrAbility.SparkOfBrilliance,
    name: "Spark of Brilliance",
    description: "Defeating a blinded target with precision damage creates a blinding explosion.",
    type: ModifierType.Arc,
    bonus: [{stat: ArmorStat.Intellect , value: 10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 3277705905
  },
  [ModOrAbility.SparkOfFeedback]: {
    id: ModOrAbility.SparkOfFeedback,
    name: "Spark of Feedback",
    description: "Taking melee damage briefly increases your outgoing melee damage.",
    type: ModifierType.Arc,
    bonus: [{stat: ArmorStat.Resilience , value: 10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 3277705907
  },
  [ModOrAbility.SparkOfDischarge]: {
    id: ModOrAbility.SparkOfDischarge,
    name: "Spark of Discharge",
    description: "Arc weapon final blows have a chance to create an Ionic Trace.",
    type: ModifierType.Arc,
    bonus: [{stat: ArmorStat.Strength , value: -10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 1727069362
  },
  [ModOrAbility.SparkOfFocus]: {
    id: ModOrAbility.SparkOfFocus,
    name: "Spark of Focus",
    description: "After sprinting for a short time, your class ability regeneration is increased.",
    type: ModifierType.Arc,
    bonus: [{stat: SpecialArmorStat.ClassAbilityRegenerationStat , value: -10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 1727069360
  },
  [ModOrAbility.SparkOfVolts]: {
    id: ModOrAbility.SparkOfVolts,
    name: "Spark of Volts",
    description: "Finishers make you amplified.",
    type: ModifierType.Arc,
    bonus: [{stat: ArmorStat.Recovery , value: 10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 3277705904
  },
  [ModOrAbility.SparkOfResistance]: {
    id: ModOrAbility.SparkOfResistance,
    name: "Spark of Resistance",
    description: "While surrounded by combatants, you are more resistant to incoming damage.",
    type: ModifierType.Arc,
    bonus: [{stat: ArmorStat.Strength , value: 10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 1727069366
  },
  [ModOrAbility.SparkOfShock]: {
    id: ModOrAbility.SparkOfShock,
    name: "Spark of Shock",
    description: "Your Arc grenades jolt targets.",
    type: ModifierType.Arc,
    bonus: [{stat: ArmorStat.Discipline , value: -10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 1727069364
  },
  /* Strand */
  [ModOrAbility.ThreadOfFury]: {
    id: ModOrAbility.ThreadOfFury,
    name: "Thread of Fury",
    description: "Damaging targets with a Tangle grants melee energy.",
    type: ModifierType.Strand,
    bonus: [{stat: ArmorStat.Strength , value: -10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 4208512219
  },
  [ModOrAbility.ThreadOfAscent]: {
    id: ModOrAbility.ThreadOfAscent,
    name: "Thread of Ascent",
    description: "Activating your grenade ability reloads your equipped weapon and grants bonus airborne effectiveness and handling for a short duration",
    type: ModifierType.Strand,
    bonus: [{stat: ArmorStat.Mobility, value: 10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 4208512216
  },
  [ModOrAbility.ThreadOfFinality]: {
    id: ModOrAbility.ThreadOfFinality,
    name: "Thread of Finality",
    description: "Finisher final blows create Threadlings.",
    type: ModifierType.Strand,
    bonus: [{stat: ArmorStat.Recovery, value: 10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 4208512217
  },
  [ModOrAbility.ThreadOfWarding]: {
    id: ModOrAbility.ThreadOfWarding,
    name: "Thread of Warding",
    description: "Picking up an Orb of Power grants Woven Mail.",
    type: ModifierType.Strand,
    bonus: [{stat: ArmorStat.Resilience, value: -10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 4208512222
  },
  [ModOrAbility.ThreadOfTransmutation]: {
    id: ModOrAbility.ThreadOfTransmutation,
    name: "Thread of Transmutation",
    description: "While you have Woven Mail, weapon final blows create a Tangle",
    type: ModifierType.Strand,
    bonus: [{stat: ArmorStat.Strength, value: 10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 4208512221
  },
  [ModOrAbility.ThreadOfEvolution]: {
    id: ModOrAbility.ThreadOfEvolution,
    name: "Thread of Evolution",
    description: "Threadlings travel farther and deal additional damage.",
    type: ModifierType.Strand,
    bonus: [{stat: ArmorStat.Intellect, value: 10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 4208512211
  },
  [ModOrAbility.ThreadOfBinding]: {
    id: ModOrAbility.ThreadOfBinding,
    name: "Thread of Binding",
    description: "Super final blows emit a suspending burst from the target.",
    type: ModifierType.Strand,
    bonus: [{stat: ArmorStat.Resilience, value: 10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 3192552688
  },
  [ModOrAbility.ThreadOfGeneration]: {
    id: ModOrAbility.ThreadOfGeneration,
    name: "Thread of Generation",
    description: "Dealing damage generates grenade energy.",
    type: ModifierType.Strand,
    bonus: [{stat: ArmorStat.Discipline, value: -10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 3192552691
  },
  [ModOrAbility.ThreadOfContinuity]: {
    id: ModOrAbility.ThreadOfContinuity,
    name: "Thread of Continuity",
    description: "Suspend, unravel, and sever effects applied to targets have increased duration.",
    type: ModifierType.Strand,
    bonus: [{stat: ArmorStat.Strength, value: 10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 3192552690
  },
}
