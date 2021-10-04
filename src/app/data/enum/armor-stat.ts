import {EnumDictionary} from "../types/EnumDictionary";



export enum StatModifier {
  NONE,
  MINOR_MOBILITY,
  MAJOR_MOBILITY,
  MINOR_RESILIENCE,
  MAJOR_RESILIENCE,
  MINOR_RECOVERY,
  MAJOR_RECOVERY,
  MINOR_DISCIPLINE,
  MAJOR_DISCIPLINE,
  MINOR_INTELLECT,
  MAJOR_INTELLECT,
  MINOR_STRENGTH,
  MAJOR_STRENGTH,
}


export enum ArmorStat {
  Mobility,
  Resilience,
  Recovery,
  Discipline,
  Intellect,
  Strength
}

export const STAT_MOD_VALUES: EnumDictionary<StatModifier, [ArmorStat, number, number]> = {
  [StatModifier.NONE]: [ArmorStat.Strength, 0, 0],
  [StatModifier.MINOR_MOBILITY]: [ArmorStat.Mobility, 5, 1],
  [StatModifier.MAJOR_MOBILITY]: [ArmorStat.Mobility, 10, 3],
  [StatModifier.MINOR_RESILIENCE]: [ArmorStat.Resilience, 5, 1],
  [StatModifier.MAJOR_RESILIENCE]: [ArmorStat.Resilience, 10, 3],
  [StatModifier.MINOR_RECOVERY]: [ArmorStat.Recovery, 5, 2],
  [StatModifier.MAJOR_RECOVERY]: [ArmorStat.Recovery, 10, 4],
  [StatModifier.MINOR_DISCIPLINE]: [ArmorStat.Discipline, 5, 1],
  [StatModifier.MAJOR_DISCIPLINE]: [ArmorStat.Discipline, 10, 3],
  [StatModifier.MINOR_INTELLECT]: [ArmorStat.Intellect, 5, 2],
  [StatModifier.MAJOR_INTELLECT]: [ArmorStat.Intellect, 10, 5],
  [StatModifier.MINOR_STRENGTH]: [ArmorStat.Strength, 5, 1],
  [StatModifier.MAJOR_STRENGTH]: [ArmorStat.Strength, 10, 3]
}

export const ArmorStatNames: EnumDictionary<ArmorStat, string> = {
  [ArmorStat.Mobility]: "Mobility",
  [ArmorStat.Resilience]: "Resilience",
  [ArmorStat.Recovery]: "Recovery",
  [ArmorStat.Discipline]: "Discipline",
  [ArmorStat.Intellect]: "Intellect",
  [ArmorStat.Strength]: "Strength"
}

export const ArmorStatTierBonus: EnumDictionary<ArmorStat, string[]> = {
  [ArmorStat.Mobility]: [
    "Dodge Cooldown: 0:34s\r\nMovementspeed Increase: 0%\r\nSpeed:\r\n   Crouching:\t2.75m/s\r\n   Strafing:\t4.25m/s\r\n   Walking:\t5.00m/s",
    "Dodge Cooldown: 0:32s\r\nMovementspeed Increase: 4%\r\nSpeed:\r\n   Crouching:\t2.86m/s\r\n   Strafing:\t4.42m/s\r\n   Walking:\t5.20m/s",
    "Dodge Cooldown: 0:30s\r\nMovementspeed Increase: 8%\r\nSpeed:\r\n   Crouching:\t2.97m/s\r\n   Strafing:\t4.59m/s\r\n   Walking:\t5.40m/s",
    "Dodge Cooldown: 0:29s\r\nMovementspeed Increase: 12%\r\nSpeed:\r\n   Crouching:\t3.08m/s\r\n   Strafing:\t4.76m/s\r\n   Walking:\t5.60m/s",
    "Dodge Cooldown: 0:26s\r\nMovementspeed Increase: 16%\r\nSpeed:\r\n   Crouching:\t3.19m/s\r\n   Strafing:\t4.93m/s\r\n   Walking:\t5.80m/s",
    "Dodge Cooldown: 0:24s\r\nMovementspeed Increase: 20%\r\nSpeed:\r\n   Crouching:\t3.30m/s\r\n   Strafing:\t5.10m/s\r\n   Walking:\t6.0m/s",
    "Dodge Cooldown: 0:22s\r\nMovementspeed Increase: 24%\r\nSpeed:\r\n   Crouching:\t3.41m/s\r\n   Strafing:\t5.27m/s\r\n   Walking:\t6.20m/s",
    "Dodge Cooldown: 0:19s\r\nMovementspeed Increase: 28%\r\nSpeed:\r\n   Crouching:\t3.52m/s\r\n   Strafing:\t5.44m/s\r\n   Walking:\t6.40m/s",
    "Dodge Cooldown: 0:16s\r\nMovementspeed Increase: 32%\r\nSpeed:\r\n   Crouching:\t3.63m/s\r\n   Strafing:\t5.61m/s\r\n   Walking:\t6.60m/s",
    "Dodge Cooldown: 0:14s\r\nMovementspeed Increase: 36%\r\nSpeed:\r\n   Crouching:\t3.74m/s\r\n   Strafing:\t5.78m/s\r\n   Walking:\t6.80m/s",
    "Dodge Cooldown: 0:11s\r\nMovementspeed Increase: 40%\r\nSpeed:\r\n   Crouching:\t3.85m/s\r\n   Strafing:\t5.95m/s\r\n   Walking:\t7.00m/s",
  ],
  [ArmorStat.Resilience]: [
    "Barricade Cooldown: 0:52s\r\nHitpoints: 185hp",
    "Barricade Cooldown: 0:46s\r\nHitpoints: 186hp",
    "Barricade Cooldown: 0:41s\r\nHitpoints: 187hp",
    "Barricade Cooldown: 0:37s\r\nHitpoints: 188hp",
    "Barricade Cooldown: 0:33s\r\nHitpoints: 189hp",
    "Barricade Cooldown: 0:30s\r\nHitpoints: 190hp",
    "Barricade Cooldown: 0:28s\r\nHitpoints: 192hp",
    "Barricade Cooldown: 0:25s\r\nHitpoints: 194hp",
    "Barricade Cooldown: 0:21s\r\nHitpoints: 196hp",
    "Barricade Cooldown: 0:17s\r\nHitpoints: 198hp",
    "Barricade Cooldown: 0:14s\r\nHitpoints: 200hp",
  ]
  ,
  [ArmorStat.Recovery]: [
    "Rift cooldown: 1:57s\r\nRecovery Rate Increase:  0.0%\r\nTotal regeneration time: 9.00s",
    "Rift cooldown: 1:43s\r\nRecovery Rate Increase:  2.9%\r\nTotal regeneration time: 8.80s",
    "Rift cooldown: 1:31s\r\nRecovery Rate Increase:  5.7%\r\nTotal regeneration time: 8.60s",
    "Rift cooldown: 1:22s\r\nRecovery Rate Increase:  8.6%\r\nTotal regeneration time: 8.40s",
    "Rift cooldown: 1:15s\r\nRecovery Rate Increase: 11.4%\r\nTotal regeneration time: 8.20s",
    "Rift cooldown: 1:08s\r\nRecovery Rate Increase: 14.3%\r\nTotal regeneration time: 8.00s",
    "Rift cooldown: 1:03s\r\nRecovery Rate Increase: 17.1%\r\nTotal regeneration time: 7.80s",
    "Rift cooldown: 0:59s\r\nRecovery Rate Increase: 22.9%\r\nTotal regeneration time: 7.40s",
    "Rift cooldown: 0:51s\r\nRecovery Rate Increase: 28.6%\r\nTotal regeneration time: 7.00s",
    "Rift cooldown: 0:46s\r\nRecovery Rate Increase: 34.3%\r\nTotal regeneration time: 6.60s",
    "Rift cooldown: 0:41s\r\nRecovery Rate Increase: 42.9%\r\nTotal regeneration time: 6.00s",
  ],
  [ArmorStat.Discipline]: [
    "Grenade Cooldown in M:SS\r\n Light:\t1:43\r\n Stasis:\t2:25",
    "Grenade Cooldown in M:SS\r\n Light:\t1:33\r\n Stasis:\t2:14",
    "Grenade Cooldown in M:SS\r\n Light:\t1:25\r\n Stasis:\t2:05",
    "Grenade Cooldown in M:SS\r\n Light:\t1:22\r\n Stasis:\t1:57",
    "Grenade Cooldown in M:SS\r\n Light:\t1:08\r\n Stasis:\t1:50",
    "Grenade Cooldown in M:SS\r\n Light:\t0:59\r\n Stasis:\t1:33",
    "Grenade Cooldown in M:SS\r\n Light:\t0:51\r\n Stasis:\t1:20",
    "Grenade Cooldown in M:SS\r\n Light:\t0:45\r\n Stasis:\t1:11",
    "Grenade Cooldown in M:SS\r\n Light:\t0:41\r\n Stasis:\t1:04",
    "Grenade Cooldown in M:SS\r\n Light:\t0:37\r\n Stasis:\t0:58",
    "Grenade Cooldown in M:SS\r\n Light:\t0:32\r\n Stasis:\t0:53",
  ]
  ,
  [ArmorStat.Intellect]: [
    "Super Ability cooldowns in M:SS\r\n Light:\t7:12\r\n Stasis:\t7:01",
    "Super Ability cooldowns in M:SS\r\n Light:\t6:22\r\n Stasis:\t6:23",
    "Super Ability cooldowns in M:SS\r\n Light:\t5:43\r\n Stasis:\t5:51",
    "Super Ability cooldowns in M:SS\r\n Light:\t5:00\r\n Stasis:\t5:23",
    "Super Ability cooldowns in M:SS\r\n Light:\t4:45\r\n Stasis:\t5:00",
    "Super Ability cooldowns in M:SS\r\n Light:\t4:31\r\n Stasis:\t4:47",
    "Super Ability cooldowns in M:SS\r\n Light:\t4:18\r\n Stasis:\t4:35",
    "Super Ability cooldowns in M:SS\r\n Light:\t4:07\r\n Stasis:\t4:24",
    "Super Ability cooldowns in M:SS\r\n Light:\t4:00\r\n Stasis:\t4:14",
    "Super Ability cooldowns in M:SS\r\n Light:\t3:52\r\n Stasis:\t4:05",
    "Super Ability cooldowns in M:SS\r\n Light:\t3:47\r\n Stasis:\t3:56",
  ]
  ,
  [ArmorStat.Strength]: [
    "Melee Cooldown (Normal / Stasis) in M:SS\r\n Titan:\t\t1:43 / 1:37\r\n Hunter:\t\t2:00 / 1:58\r\n Warlock:\t1:43 / 1:58",
    "Melee Cooldown (Normal / Stasis) in M:SS\r\n Titan:\t\t1:33 / 1:30\r\n Hunter:\t\t1:49 / 1:49\r\n Warlock:\t1:33 / 1:49",
    "Melee Cooldown (Normal / Stasis) in M:SS\r\n Titan:\t\t1:25 / 1:24\r\n Hunter:\t\t1:40 / 1:42\r\n Warlock:\t1:25 / 1:42",
    "Melee Cooldown (Normal / Stasis) in M:SS\r\n Titan:\t\t1:22 / 1:19\r\n Hunter:\t\t1:36 / 1:35\r\n Warlock:\t1:22 / 1:35",
    "Melee Cooldown (Normal / Stasis) in M:SS\r\n Titan:\t\t1:08 / 1:14\r\n Hunter:\t\t1:20 / 1:29\r\n Warlock:\t1:08 / 1:29",
    "Melee Cooldown (Normal / Stasis) in M:SS\r\n Titan:\t\t0:59 / 0:59\r\n Hunter:\t\t1:09 / 1:16\r\n Warlock:\t0:59 / 1:16",
    "Melee Cooldown (Normal / Stasis) in M:SS\r\n Titan:\t\t0:51 / 0:51\r\n Hunter:\t\t1:00 / 1:06\r\n Warlock:\t0:51 / 1:06",
    "Melee Cooldown (Normal / Stasis) in M:SS\r\n Titan:\t\t0:45 / 0:46\r\n Hunter:\t\t0:53 / 0:58\r\n Warlock:\t0:45 / 0:58",
    "Melee Cooldown (Normal / Stasis) in M:SS\r\n Titan:\t\t0:41 / 0:41\r\n Hunter:\t\t0:48 / 0:52\r\n Warlock:\t0:41 / 0:52",
    "Melee Cooldown (Normal / Stasis) in M:SS\r\n Titan:\t\t0:37 / 0:37\r\n Hunter:\t\t0:44 / 0:47\r\n Warlock:\t0:37 / 0:47",
    "Melee Cooldown (Normal / Stasis) in M:SS\r\n Titan:\t\t0:32 / 0:32\r\n Hunter:\t\t0:37 / 0:43\r\n Warlock:\t0:32 / 0:43",
  ]

}

type Literal<T extends ArmorStat> = `${T}`;
export type ArmorStatLiteral = Literal<ArmorStat>;

export enum SpecialArmorStat {
  ClassAbilityRegenerationStat = 10
}
