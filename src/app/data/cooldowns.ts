import {CharacterClass} from "./enum/character-Class";
import {EnumDictionary} from "./types/EnumDictionary";
import {buildMeleeCooldown} from "./cooldowns_melee";
import {ArmorStat} from "./enum/armor-stat";
import {buildGrenadeCooldown} from "./cooldowns_grenade";
import {buildSuperCooldown} from "./cooldowns_super";
import {buildMobilityCooldown} from "./cooldowns_mobility";

export function GetArmorStatTierBonus(clazz: CharacterClass): EnumDictionary<ArmorStat, string[]> {
  return {
    [ArmorStat.Mobility]: [
      buildMobilityCooldown(0, clazz), buildMobilityCooldown(1, clazz), buildMobilityCooldown(2, clazz),
      buildMobilityCooldown(3, clazz), buildMobilityCooldown(4, clazz), buildMobilityCooldown(5, clazz),
      buildMobilityCooldown(6, clazz), buildMobilityCooldown(7, clazz), buildMobilityCooldown(8, clazz),
      buildMobilityCooldown(9, clazz), buildMobilityCooldown(10, clazz),
    ],
    [ArmorStat.Resilience]: [
      "Hitpoints: 185hp" + "\r\nBarricade TBD",
      "Hitpoints: 186hp" + "\r\nBarricade TBD",
      "Hitpoints: 187hp" + "\r\nBarricade TBD",
      "Hitpoints: 188hp" + "\r\nBarricade TBD",
      "Hitpoints: 189hp" + "\r\nBarricade TBD",
      "Hitpoints: 190hp" + "\r\nBarricade TBD",
      "Hitpoints: 192hp" + "\r\nBarricade TBD",
      "Hitpoints: 194hp" + "\r\nBarricade TBD",
      "Hitpoints: 196hp" + "\r\nBarricade TBD",
      "Hitpoints: 198hp" + "\r\nBarricade TBD",
      "Hitpoints: 200hp" + "\r\nBarricade TBD",
    ]
    ,
    [ArmorStat.Recovery]: [
      "Recovery Rate Increase:  0.0%\r\nTotal regeneration time: 9.00s" + "\r\nRift TBD",
      "Recovery Rate Increase:  2.9%\r\nTotal regeneration time: 8.80s" + "\r\nRift TBD",
      "Recovery Rate Increase:  5.7%\r\nTotal regeneration time: 8.60s" + "\r\nRift TBD",
      "Recovery Rate Increase:  8.6%\r\nTotal regeneration time: 8.40s" + "\r\nRift TBD",
      "Recovery Rate Increase: 11.4%\r\nTotal regeneration time: 8.20s" + "\r\nRift TBD",
      "Recovery Rate Increase: 14.3%\r\nTotal regeneration time: 8.00s" + "\r\nRift TBD",
      "Recovery Rate Increase: 17.1%\r\nTotal regeneration time: 7.80s" + "\r\nRift TBD",
      "Recovery Rate Increase: 22.9%\r\nTotal regeneration time: 7.40s" + "\r\nRift TBD",
      "Recovery Rate Increase: 28.6%\r\nTotal regeneration time: 7.00s" + "\r\nRift TBD",
      "Recovery Rate Increase: 34.3%\r\nTotal regeneration time: 6.60s" + "\r\nRift TBD",
      "Recovery Rate Increase: 42.9%\r\nTotal regeneration time: 6.00s" + "\r\nRift TBD",
    ],
    [ArmorStat.Discipline]: [
      buildGrenadeCooldown(0, clazz), buildGrenadeCooldown(1, clazz), buildGrenadeCooldown(2, clazz),
      buildGrenadeCooldown(3, clazz), buildGrenadeCooldown(4, clazz), buildGrenadeCooldown(5, clazz),
      buildGrenadeCooldown(6, clazz), buildGrenadeCooldown(7, clazz), buildGrenadeCooldown(8, clazz),
      buildGrenadeCooldown(9, clazz), buildGrenadeCooldown(10, clazz),
    ],
    [ArmorStat.Intellect]: [

      buildSuperCooldown(0, clazz), buildSuperCooldown(1, clazz), buildSuperCooldown(2, clazz),
      buildSuperCooldown(3, clazz), buildSuperCooldown(4, clazz), buildSuperCooldown(5, clazz),
      buildSuperCooldown(6, clazz), buildSuperCooldown(7, clazz), buildSuperCooldown(8, clazz),
      buildSuperCooldown(9, clazz), buildSuperCooldown(10, clazz),
    ],
    [ArmorStat.Strength]: [
      buildMeleeCooldown(0, clazz), buildMeleeCooldown(1, clazz), buildMeleeCooldown(2, clazz),
      buildMeleeCooldown(3, clazz), buildMeleeCooldown(4, clazz), buildMeleeCooldown(5, clazz),
      buildMeleeCooldown(6, clazz), buildMeleeCooldown(7, clazz), buildMeleeCooldown(8, clazz),
      buildMeleeCooldown(9, clazz), buildMeleeCooldown(10, clazz),
    ]

  }
}


export const LoadingArmorStatTierBonus: EnumDictionary<ArmorStat, string[]> = {
  [ArmorStat.Mobility]: [
    "Movementspeed Increase: 0%\r\nSpeed:\r\n   Crouching:\t2.75m/s\r\n   Strafing:\t4.25m/s\r\n   Walking:\t5.00m/s",
    "Movementspeed Increase: 4%\r\nSpeed:\r\n   Crouching:\t2.86m/s\r\n   Strafing:\t4.42m/s\r\n   Walking:\t5.20m/s",
    "Movementspeed Increase: 8%\r\nSpeed:\r\n   Crouching:\t2.97m/s\r\n   Strafing:\t4.59m/s\r\n   Walking:\t5.40m/s",
    "Movementspeed Increase: 12%\r\nSpeed:\r\n   Crouching:\t3.08m/s\r\n   Strafing:\t4.76m/s\r\n   Walking:\t5.60m/s",
    "Movementspeed Increase: 16%\r\nSpeed:\r\n   Crouching:\t3.19m/s\r\n   Strafing:\t4.93m/s\r\n   Walking:\t5.80m/s",
    "Movementspeed Increase: 20%\r\nSpeed:\r\n   Crouching:\t3.30m/s\r\n   Strafing:\t5.10m/s\r\n   Walking:\t6.0m/s",
    "Movementspeed Increase: 24%\r\nSpeed:\r\n   Crouching:\t3.41m/s\r\n   Strafing:\t5.27m/s\r\n   Walking:\t6.20m/s",
    "Movementspeed Increase: 28%\r\nSpeed:\r\n   Crouching:\t3.52m/s\r\n   Strafing:\t5.44m/s\r\n   Walking:\t6.40m/s",
    "Movementspeed Increase: 32%\r\nSpeed:\r\n   Crouching:\t3.63m/s\r\n   Strafing:\t5.61m/s\r\n   Walking:\t6.60m/s",
    "Movementspeed Increase: 36%\r\nSpeed:\r\n   Crouching:\t3.74m/s\r\n   Strafing:\t5.78m/s\r\n   Walking:\t6.80m/s",
    "Movementspeed Increase: 40%\r\nSpeed:\r\n   Crouching:\t3.85m/s\r\n   Strafing:\t5.95m/s\r\n   Walking:\t7.00m/s",
  ],
  [ArmorStat.Resilience]: [
    "Hitpoints: 185hp",
    "Hitpoints: 186hp",
    "Hitpoints: 187hp",
    "Hitpoints: 188hp",
    "Hitpoints: 189hp",
    "Hitpoints: 190hp",
    "Hitpoints: 192hp",
    "Hitpoints: 194hp",
    "Hitpoints: 196hp",
    "Hitpoints: 198hp",
    "Hitpoints: 200hp",
  ]
  ,
  [ArmorStat.Recovery]: [
    "Recovery Rate Increase:  0.0%\r\nTotal regeneration time: 9.00s",
    "Recovery Rate Increase:  2.9%\r\nTotal regeneration time: 8.80s",
    "Recovery Rate Increase:  5.7%\r\nTotal regeneration time: 8.60s",
    "Recovery Rate Increase:  8.6%\r\nTotal regeneration time: 8.40s",
    "Recovery Rate Increase: 11.4%\r\nTotal regeneration time: 8.20s",
    "Recovery Rate Increase: 14.3%\r\nTotal regeneration time: 8.00s",
    "Recovery Rate Increase: 17.1%\r\nTotal regeneration time: 7.80s",
    "Recovery Rate Increase: 22.9%\r\nTotal regeneration time: 7.40s",
    "Recovery Rate Increase: 28.6%\r\nTotal regeneration time: 7.00s",
    "Recovery Rate Increase: 34.3%\r\nTotal regeneration time: 6.60s",
    "Recovery Rate Increase: 42.9%\r\nTotal regeneration time: 6.00s",
  ],
  [ArmorStat.Discipline]: [
    "Loading", "Loading", "Loading", "Loading", "Loading",
    "Loading", "Loading", "Loading", "Loading", "Loading",
    "Loading"
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
    "Loading", "Loading", "Loading", "Loading", "Loading",
    "Loading", "Loading", "Loading", "Loading", "Loading",
    "Loading"
  ]

}
