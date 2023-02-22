import {EnumDictionary} from "./types/EnumDictionary";
import {ModOrAbility} from "./enum/modOrAbility";
import {Modifier} from "./modifier";
import {ModifierType} from "./enum/modifierType";
import {ArmorStat, SpecialArmorStat} from "./enum/armor-stat";
import {DestinyEnergyType} from "bungie-api-ts/destiny2/interfaces";

export const ModInformation: EnumDictionary<ModOrAbility, Modifier> = {
  // MODS
  // POSITIVE Mods
  [ModOrAbility.PowerfulFriends]: {
    id: ModOrAbility.PowerfulFriends,
    name: "Powerful Friends",
    description: "When you become Charged with Light, nearby allies also become Charged with Light, if they are not already.",
    type: ModifierType.CombatStyleMod,
    bonus: [{stat: ArmorStat.Mobility, value: 20}],
    cost: 4,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 1484685887
  },
  [ModOrAbility.RadiantLight]: {
    id: ModOrAbility.RadiantLight,
    name: "Radiant Light",
    description: "Casting your Super causes nearby allies to become Charged with Light.",
    type: ModifierType.CombatStyleMod,
    bonus: [{stat: ArmorStat.Strength, value: 20}],
    cost: 3,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 2979815167
  },
  // NEGATIVE Mods
  [ModOrAbility.ProtectiveLight]: {
    id: ModOrAbility.ProtectiveLight,
    name: "Protective Light",
    description: "While Charged with Light, you gain significant damage resistance against combatants when your shields are destroyed. This effect consumes all stacks of Charged with Light. The more stacks consumed, the longer the damage resistance lasts.",
    type: ModifierType.CombatStyleMod,
    bonus: [{stat: ArmorStat.Strength, value: -10}],
    cost: 2,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 3523075120
  },
  [ModOrAbility.ExtraReserves]: {
    id: ModOrAbility.ExtraReserves,
    name: "Extra Reserves",
    description: "While Charged with Light, defeating combatants with Void damage grants a chance to drop Special ammo. This effect consumes all stacks of Charged with Light. The more stacks you have, the higher your chance of gaining the ammo drop.",
    type: ModifierType.CombatStyleMod,
    bonus: [{stat: ArmorStat.Intellect, value: -10}],
    cost: 3,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 3523075121
  },
  [ModOrAbility.PreciselyCharged]: {
    id: ModOrAbility.PreciselyCharged,
    name: "Precisely Charged",
    description: "Become Charged with Light by getting multiple rapid precision final blows with Linear Fusion Rifles or Sniper Rifles.",
    type: ModifierType.CombatStyleMod,
    bonus: [{stat: ArmorStat.Discipline, value: -10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 3523075122
  },
  [ModOrAbility.StacksOnStacks]: {
    id: ModOrAbility.StacksOnStacks,
    name: "Stacks on Stacks",
    description: "Gain an extra stack of Charged with Light for every stack you gain.",
    type: ModifierType.CombatStyleMod,
    bonus: [{stat: ArmorStat.Recovery, value: -10}],
    cost: 4,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 3523075123
  },
  [ModOrAbility.PrecisionCharge]: {
    id: ModOrAbility.PrecisionCharge,
    name: "Precision Charge",
    description: "Become Charged with Light by rapidly defeating combatants with precision kills from Bows, Hand Cannons, and Scout Rifles.",
    type: ModifierType.CombatStyleMod,
    bonus: [{stat: ArmorStat.Strength, value: -10}],
    cost: 2,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 2263321584
  },
  [ModOrAbility.SurpriseAttack]: {
    id: ModOrAbility.SurpriseAttack,
    name: "Surprise Attack",
    description: "While Charged with Light, reloading or readying a Sidearm will consume all stacks of Charged with Light and convert them into stacks of a major damage buff, which are depleted as you damage combatants with that Sidearm.",
    type: ModifierType.CombatStyleMod,
    bonus: [{stat: ArmorStat.Intellect, value: -10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 2263321585
  },
  [ModOrAbility.EnergyConverter]: {
    id: ModOrAbility.EnergyConverter,
    name: "Energy Converter",
    description: "While Charged with Light, using your grenade attack grants you Super energy, consuming all stacks of Charged with Light. The more stacks you have, the more energy you gain, up to a maximum of 50% of your Super energy.",
    type: ModifierType.CombatStyleMod,
    bonus: [{stat: ArmorStat.Discipline, value: -10}],
    cost: 4,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 2263321586
  },
  [ModOrAbility.ChargeHarvester]: {
    id: ModOrAbility.ChargeHarvester,
    name: "Charge Harvester",
    description: "While you are not Charged with Light, any kill or assist has a small cumulative chance to cause you to become Charged with Light.",
    type: ModifierType.CombatStyleMod,
    bonus: [{stat: SpecialArmorStat.ClassAbilityRegenerationStat, value: -10}],
    cost: 3,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 2263321587
  },
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
  // Retrofit mods
  [ModOrAbility.MobileRetrofit]: {
    id: ModOrAbility.MobileRetrofit,
    name: "Mobile Retrofit",
    description: "Adds a constant boost of +5 to your mobility.",
    type: ModifierType.RetrofitMods,
    bonus: [{stat: ArmorStat.Mobility , value: 5}],
    cost: 3,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 4058375012
  },
  [ModOrAbility.ResilientRetrofit]: {
    id: ModOrAbility.ResilientRetrofit,
    name: "Resilient Retrofit",
    description: "Adds a constant boost of +5 to your resilience.",
    type: ModifierType.RetrofitMods,
    bonus: [{stat: ArmorStat.Resilience , value: 5}],
    cost: 4,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 2092805627
  },
}
