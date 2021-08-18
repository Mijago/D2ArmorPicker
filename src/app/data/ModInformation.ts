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
    type: ModifierType.CombatStyleMod,
    bonus: [{stat: ArmorStat.Mobility, value: 20}],
    requiredArmorAffinity: DestinyEnergyType.Arc
  },
  [ModOrAbility.RadiantLight]: {
    id: ModOrAbility.RadiantLight,
    name: "Radiant Light",
    type: ModifierType.CombatStyleMod,
    bonus: [{stat: ArmorStat.Strength, value: 20}],
    requiredArmorAffinity: DestinyEnergyType.Arc
  },
  // NEGATIVE Mods
  [ModOrAbility.ProtectiveLight]: {
    id: ModOrAbility.ProtectiveLight,
    name: "Protective Light",
    type: ModifierType.CombatStyleMod,
    bonus: [{stat: ArmorStat.Strength, value: -10}],
    requiredArmorAffinity: DestinyEnergyType.Void
  },
  [ModOrAbility.ExtraReserves]: {
    id: ModOrAbility.ExtraReserves,
    name: "Extra Reserves",
    type: ModifierType.CombatStyleMod,
    bonus: [{stat: ArmorStat.Intellect, value: -10}],
    requiredArmorAffinity: DestinyEnergyType.Void
  },
  [ModOrAbility.PrecicelyCharged]: {
    id: ModOrAbility.PrecicelyCharged,
    name: "Precicely Charged",
    type: ModifierType.CombatStyleMod,
    bonus: [{stat: ArmorStat.Discipline, value: -10}],
    requiredArmorAffinity: DestinyEnergyType.Void
  },
  [ModOrAbility.StacksOnStacks]: {
    id: ModOrAbility.StacksOnStacks,
    name: "Stacks on Stacks",
    type: ModifierType.CombatStyleMod,
    bonus: [{stat: ArmorStat.Discipline, value: -10}],
    requiredArmorAffinity: DestinyEnergyType.Void
  },
  [ModOrAbility.PrecisionCharge]: {
    id: ModOrAbility.PrecisionCharge,
    name: "Precision Charge",
    type: ModifierType.CombatStyleMod,
    bonus: [{stat: ArmorStat.Strength, value: -10}],
    requiredArmorAffinity: DestinyEnergyType.Void
  },
  [ModOrAbility.SurpriseAttack]: {
    id: ModOrAbility.SurpriseAttack,
    name: "Surprise Attack",
    type: ModifierType.CombatStyleMod,
    bonus: [{stat: ArmorStat.Intellect, value: -10}],
    requiredArmorAffinity: DestinyEnergyType.Void
  },
  [ModOrAbility.EnergyConverter]: {
    id: ModOrAbility.EnergyConverter,
    name: "Energy Converter",
    type: ModifierType.CombatStyleMod,
    bonus: [{stat: ArmorStat.Discipline, value: -10}],
    requiredArmorAffinity: DestinyEnergyType.Void
  },
  [ModOrAbility.ChargeHarvester]: {
    id: ModOrAbility.ChargeHarvester,
    name: "Charge Harvester",
    type: ModifierType.CombatStyleMod,
    bonus: [{stat: SpecialArmorStat.ClassAbilityRegenerationStat, value: -10}],
    requiredArmorAffinity: DestinyEnergyType.Void
  },
  // Positive STASIS
  [ModOrAbility.WhisperOfDurance]: {
    id: ModOrAbility.WhisperOfDurance,
    name: "Whisper Of Durance",
    type: ModifierType.Stasis,
    bonus: [{stat: ArmorStat.Strength, value: 10}],
    requiredArmorAffinity: DestinyEnergyType.Any
  },
  [ModOrAbility.WhisperOfChains]: {
    id: ModOrAbility.WhisperOfChains,
    name: "Whisper Of Chains",
    type: ModifierType.Stasis,
    bonus: [{stat: ArmorStat.Recovery, value: 10}],
    requiredArmorAffinity: DestinyEnergyType.Any
  },
  [ModOrAbility.WhisperOfShards]: {
    id: ModOrAbility.WhisperOfShards,
    name: "Whisper Of Shards",
    type: ModifierType.Stasis,
    bonus: [{stat: ArmorStat.Resilience, value: 10}],
    requiredArmorAffinity: DestinyEnergyType.Any
  },
  [ModOrAbility.WhisperOfConduction]: {
    id: ModOrAbility.WhisperOfConduction,
    name: "Whisper Of Conduction",
    type: ModifierType.Stasis,
    bonus: [{stat: ArmorStat.Resilience, value: 10}, {stat: ArmorStat.Intellect, value: 10}],
    requiredArmorAffinity: DestinyEnergyType.Any
  },
  // NEGATIVE STASIS

  [ModOrAbility.WhisperOfBonds]: {
    id: ModOrAbility.WhisperOfBonds,
    name: "Whisper of Bonds",
    type: ModifierType.Stasis,
    bonus: [{stat: ArmorStat.Discipline, value: -10}, {stat: ArmorStat.Intellect, value: -10}],
    requiredArmorAffinity: DestinyEnergyType.Any
  },
  [ModOrAbility.WhisperOfHedrons]: {
    id: ModOrAbility.WhisperOfHedrons,
    name: "Whisper of Hedrons",
    type: ModifierType.Stasis,
    bonus: [{stat: ArmorStat.Strength, value: -10}],
    requiredArmorAffinity: DestinyEnergyType.Any
  },
  [ModOrAbility.WhisperOfFractures]: {
    id: ModOrAbility.WhisperOfFractures,
    name: "Whisper of Fractures",
    type: ModifierType.Stasis,
    bonus: [{stat: ArmorStat.Discipline, value: -10}],
    requiredArmorAffinity: DestinyEnergyType.Any
  },
  [ModOrAbility.WhisperOfHunger]: {
    id: ModOrAbility.WhisperOfHunger,
    name: "Whisper of Hunger",
    type: ModifierType.Stasis,
    bonus: [{stat: ArmorStat.Mobility, value: -10}, {stat: ArmorStat.Recovery, value: -10}],
    requiredArmorAffinity: DestinyEnergyType.Any
  },
}
