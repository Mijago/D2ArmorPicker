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
    cost: 4,
    requiredArmorAffinity: DestinyEnergyType.Arc,
    hash: 1484685887
  },
  [ModOrAbility.RadiantLight]: {
    id: ModOrAbility.RadiantLight,
    name: "Radiant Light",
    type: ModifierType.CombatStyleMod,
    bonus: [{stat: ArmorStat.Strength, value: 20}],
    cost: 3,
    requiredArmorAffinity: DestinyEnergyType.Arc,
    hash: 2979815167
  },
  // NEGATIVE Mods
  [ModOrAbility.ProtectiveLight]: {
    id: ModOrAbility.ProtectiveLight,
    name: "Protective Light",
    type: ModifierType.CombatStyleMod,
    bonus: [{stat: ArmorStat.Strength, value: -10}],
    cost: 2,
    requiredArmorAffinity: DestinyEnergyType.Void,
    hash: 3523075120
  },
  [ModOrAbility.ExtraReserves]: {
    id: ModOrAbility.ExtraReserves,
    name: "Extra Reserves",
    type: ModifierType.CombatStyleMod,
    bonus: [{stat: ArmorStat.Intellect, value: -10}],
    cost: 3,
    requiredArmorAffinity: DestinyEnergyType.Void,
    hash: 3523075121
  },
  [ModOrAbility.PreciselyCharged]: {
    id: ModOrAbility.PreciselyCharged,
    name: "Precisely Charged",
    type: ModifierType.CombatStyleMod,
    bonus: [{stat: ArmorStat.Discipline, value: -10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Void,
    hash: 3523075122
  },
  [ModOrAbility.StacksOnStacks]: {
    id: ModOrAbility.StacksOnStacks,
    name: "Stacks on Stacks",
    type: ModifierType.CombatStyleMod,
    bonus: [{stat: ArmorStat.Recovery, value: -10}],
    cost: 4,
    requiredArmorAffinity: DestinyEnergyType.Void,
    hash: 3523075123
  },
  [ModOrAbility.PrecisionCharge]: {
    id: ModOrAbility.PrecisionCharge,
    name: "Precision Charge",
    type: ModifierType.CombatStyleMod,
    bonus: [{stat: ArmorStat.Strength, value: -10}],
    cost: 2,
    requiredArmorAffinity: DestinyEnergyType.Void,
    hash: 2263321584
  },
  [ModOrAbility.SurpriseAttack]: {
    id: ModOrAbility.SurpriseAttack,
    name: "Surprise Attack",
    type: ModifierType.CombatStyleMod,
    bonus: [{stat: ArmorStat.Intellect, value: -10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Void,
    hash: 2263321585
  },
  [ModOrAbility.EnergyConverter]: {
    id: ModOrAbility.EnergyConverter,
    name: "Energy Converter",
    type: ModifierType.CombatStyleMod,
    bonus: [{stat: ArmorStat.Discipline, value: -10}],
    cost: 4,
    requiredArmorAffinity: DestinyEnergyType.Void,
    hash: 2263321586
  },
  [ModOrAbility.ChargeHarvester]: {
    id: ModOrAbility.ChargeHarvester,
    name: "Charge Harvester",
    type: ModifierType.CombatStyleMod,
    bonus: [{stat: SpecialArmorStat.ClassAbilityRegenerationStat, value: -10}],
    cost: 3,
    requiredArmorAffinity: DestinyEnergyType.Void,
    hash: 2263321587
  },
  // Positive STASIS
  [ModOrAbility.WhisperOfDurance]: {
    id: ModOrAbility.WhisperOfDurance,
    name: "Whisper Of Durance",
    type: ModifierType.Stasis,
    bonus: [{stat: ArmorStat.Strength, value: 10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 3469412969
  },
  [ModOrAbility.WhisperOfChains]: {
    id: ModOrAbility.WhisperOfChains,
    name: "Whisper Of Chains",
    type: ModifierType.Stasis,
    bonus: [{stat: ArmorStat.Recovery, value: 10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 537774540
  },
  [ModOrAbility.WhisperOfShards]: {
    id: ModOrAbility.WhisperOfShards,
    name: "Whisper Of Shards",
    type: ModifierType.Stasis,
    bonus: [{stat: ArmorStat.Resilience, value: 10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 3469412975
  },
  [ModOrAbility.WhisperOfConduction]: {
    id: ModOrAbility.WhisperOfConduction,
    name: "Whisper Of Conduction",
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
    type: ModifierType.Stasis,
    bonus: [{stat: ArmorStat.Discipline, value: -10}, {stat: ArmorStat.Intellect, value: -10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 3469412974
  },
  [ModOrAbility.WhisperOfHedrons]: {
    id: ModOrAbility.WhisperOfHedrons,
    name: "Whisper of Hedrons",
    type: ModifierType.Stasis,
    bonus: [{stat: ArmorStat.Strength, value: -10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 3469412970
  },
  [ModOrAbility.WhisperOfFractures]: {
    id: ModOrAbility.WhisperOfFractures,
    name: "Whisper of Fractures",
    type: ModifierType.Stasis,
    bonus: [{stat: ArmorStat.Discipline, value: -10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 537774542
  },
  [ModOrAbility.WhisperOfHunger]: {
    id: ModOrAbility.WhisperOfHunger,
    name: "Whisper of Hunger",
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
    type: ModifierType.Void,
    bonus: [{stat: ArmorStat.Intellect, value: 10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 2272984665
  },
  [ModOrAbility.EchoOfProvision]: {
    id: ModOrAbility.EchoOfProvision,
    name: "Echo of Provision",
    type: ModifierType.Void,
    bonus: [{stat: ArmorStat.Strength, value: -10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 2272984664
  },
  [ModOrAbility.EchoOfPersistence]: {
    id: ModOrAbility.EchoOfPersistence,
    name: "Echo of Persistence",
    type: ModifierType.Void,
    bonus: [{stat: SpecialArmorStat.ClassAbilityRegenerationStat, value: -10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 2272984671
  },
  [ModOrAbility.EchoOfLeeching]: {
    id: ModOrAbility.EchoOfLeeching,
    name: "Echo of Leeching",
    type: ModifierType.Void,
    bonus: [{stat: ArmorStat.Resilience, value: 10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 2272984670
  },
  [ModOrAbility.EchoOfDomineering]: {
    id: ModOrAbility.EchoOfDomineering,
    name: "Echo of Domineering",
    type: ModifierType.Void,
    bonus: [{stat: ArmorStat.Discipline, value: 10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 2272984657
  },
  [ModOrAbility.EchoOfDilation]: {
    id: ModOrAbility.EchoOfDilation,
    name: "Echo of Dilation",
    type: ModifierType.Void,
    bonus: [{stat: ArmorStat.Mobility, value: 10}, {stat: ArmorStat.Intellect, value: 10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 2272984656
  },
  [ModOrAbility.EchoOfUndermining]: {
    id: ModOrAbility.EchoOfUndermining,
    name: "Echo of Undermining",
    type: ModifierType.Void,
    bonus: [{stat: ArmorStat.Discipline, value: -20}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 2272984668
  },
  [ModOrAbility.EchoOfInstability]: {
    id: ModOrAbility.EchoOfInstability,
    name: "Echo of Instability",
    type: ModifierType.Void,
    bonus: [{stat: ArmorStat.Strength, value: 10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 2661180600
  },
  [ModOrAbility.EchoOfObscurity]: {
    id: ModOrAbility.EchoOfObscurity,
    name: "Echo of Obscurity",
    type: ModifierType.Void,
    bonus: [{stat: ArmorStat.Recovery, value: 10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 2661180602
  },
  [ModOrAbility.EchoOfHarvest]: {
    id: ModOrAbility.EchoOfHarvest,
    name: "Echo of Harvest",
    type: ModifierType.Void,
    bonus: [{stat: ArmorStat.Intellect, value: -10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 2661180601
  },
  [ModOrAbility.EchoOfStarvation]: {
    id: ModOrAbility.EchoOfStarvation,
    name: "Echo of Starvation",
    type: ModifierType.Void,
    bonus: [{stat: ArmorStat.Recovery, value: -10}],
    cost: 1,
    requiredArmorAffinity: DestinyEnergyType.Any,
    hash: 2661180603
  },
}
