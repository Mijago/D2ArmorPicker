import {EnumDictionary} from "./types/EnumDictionary";
import {ModOrAbility} from "./enum/modOrAbility";
import {Modifier} from "./modifier";
import {ModifierType} from "./enum/modifierType";
import {ArmorStat, SpecialArmorStat} from "./enum/armor-stat";

export const ModInformation: EnumDictionary<ModOrAbility, Modifier> = {
  // MODS
  // POSITIVE Mods
  [ModOrAbility.PowerfulFriends]: {
    id: ModOrAbility.PowerfulFriends,
    name: "Powerful Friends",
    type: ModifierType.CombatStyleMod,
    bonus: [{stat: ArmorStat.Mobility, value: 20}]
  },
  [ModOrAbility.RadiantLight]: {
    id: ModOrAbility.RadiantLight,
    name: "Radiant Light",
    type: ModifierType.CombatStyleMod,
    bonus: [{stat: ArmorStat.Strength, value: 20}]
  },
  // NEGATIVE Mods
  [ModOrAbility.ProtectiveLight]: {
    id: ModOrAbility.ProtectiveLight,
    name: "Protective Light",
    type: ModifierType.CombatStyleMod,
    bonus: [{stat: ArmorStat.Strength, value: -10}]
  },
  [ModOrAbility.ExtraReserves]: {
    id: ModOrAbility.ExtraReserves,
    name: "Extra Reserves",
    type: ModifierType.CombatStyleMod,
    bonus: [{stat: ArmorStat.Intellect, value: -10}]
  },
  [ModOrAbility.PrecicelyCharged]: {
    id: ModOrAbility.PrecicelyCharged,
    name: "Precicely Charged",
    type: ModifierType.CombatStyleMod,
    bonus: [{stat: ArmorStat.Discipline, value: -10}]
  },
  [ModOrAbility.StacksOnStacks]: {
    id: ModOrAbility.StacksOnStacks,
    name: "Stacks on Stacks",
    type: ModifierType.CombatStyleMod,
    bonus: [{stat: ArmorStat.Discipline, value: -10}]
  },
  [ModOrAbility.PrecisionCharge]: {
    id: ModOrAbility.PrecisionCharge,
    name: "Precision Charge",
    type: ModifierType.CombatStyleMod,
    bonus: [{stat: ArmorStat.Strength, value: -10}]
  },
  [ModOrAbility.SurpriseAttack]: {
    id: ModOrAbility.SurpriseAttack,
    name: "Surprise Attack",
    type: ModifierType.CombatStyleMod,
    bonus: [{stat: ArmorStat.Intellect, value: -10}]
  },
  [ModOrAbility.EnergyConverter]: {
    id: ModOrAbility.EnergyConverter,
    name: "Energy Converter",
    type: ModifierType.CombatStyleMod,
    bonus: [{stat: ArmorStat.Discipline, value: -10}]
  },
  [ModOrAbility.ChargeHarvester]: {
    id: ModOrAbility.ChargeHarvester,
    name: "Charge Harvester",
    type: ModifierType.CombatStyleMod,
    bonus: [{stat: SpecialArmorStat.ClassAbilityRegenerationStat, value: -10}]
  },
  // Positive STASIS
  [ModOrAbility.WhisperOfDurance]: {
    id: ModOrAbility.WhisperOfDurance,
    name: "Whisper Of Durance",
    type: ModifierType.Stasis,
    bonus: [{stat: ArmorStat.Strength, value: 10}]
  },
  [ModOrAbility.WhisperOfChains]: {
    id: ModOrAbility.WhisperOfChains,
    name: "Whisper Of Chains",
    type: ModifierType.Stasis,
    bonus: [{stat: ArmorStat.Recovery, value: 10}]
  },
  [ModOrAbility.WhisperOfShards]: {
    id: ModOrAbility.WhisperOfShards,
    name: "Whisper Of Shards",
    type: ModifierType.Stasis,
    bonus: [{stat: ArmorStat.Resilience, value: 10}]
  },
  [ModOrAbility.WhisperOfConduction]: {
    id: ModOrAbility.WhisperOfConduction,
    name: "Whisper Of Conduction",
    type: ModifierType.Stasis,
    bonus: [{stat: ArmorStat.Resilience, value: 10}, {stat: ArmorStat.Intellect, value: 10}]
  },
  // NEGATIVE STASIS

  [ModOrAbility.WhisperOfBonds]: {
    id: ModOrAbility.WhisperOfBonds,
    name: "Whisper of Bonds",
    type: ModifierType.Stasis,
    bonus: [{stat: ArmorStat.Discipline, value: -10}, {stat: ArmorStat.Intellect, value: -10}]
  },
  [ModOrAbility.WhisperOfHedrons]: {
    id: ModOrAbility.WhisperOfHedrons,
    name: "Whisper of Hedrons",
    type: ModifierType.Stasis,
    bonus: [{stat: ArmorStat.Strength, value: -10}]
  },
  [ModOrAbility.WhisperOfFractures]: {
    id: ModOrAbility.WhisperOfFractures,
    name: "Whisper of Fractures",
    type: ModifierType.Stasis,
    bonus: [{stat: ArmorStat.Discipline, value: -10}]
  },
  [ModOrAbility.WhisperOfHunger]: {
    id: ModOrAbility.WhisperOfHunger,
    name: "Whisper of Hunger",
    type: ModifierType.Stasis,
    bonus: [{stat: ArmorStat.Mobility, value: -10}, {stat: ArmorStat.Recovery, value: -10}]
  },
}
