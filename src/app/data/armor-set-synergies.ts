import { ArmorStat, ArmorStatIconUrls } from "./enum/armor-stat";

export type ArmorSetSynergy =
  | "prismatic"
  | "arc"
  | "solar"
  | "void"
  | "stasis"
  | "strand"
  | "light"
  | "darkness"
  | "kinetic"
  | "weapons"
  | "autoRifles"
  | "bows"
  | "fusionRifles"
  | "glaives"
  | "grenadeLaunchers"
  | "handCannons"
  | "heatWeapons"
  | "linearFusionRifles"
  | "microMissiles"
  | "rocketLaunchers"
  | "scoutRifles"
  | "sidearms"
  | "shotguns"
  | "smgs"
  | "swords"
  | "ammoBrick"
  | "primaryAmmo"
  | "specialAmmo"
  | "heavyAmmo"
  | "grenade"
  | "melee"
  | "classAbility"
  | "allAbilities"
  | "super"
  | "finishers"
  | "orbsOfPower"
  | "elementalPickups"
  | "armorCharge"
  | "healing"
  | "damageDebuff"
  | "enemyDamageOutput"
  | "disorient"
  | "exhaust"
  | "healthStat"
  | "mobility"
  | "meleeStat"
  | "grenadeStat"
  | "superStat"
  | "weaponStat";

// | "classStat"
export interface ArmorSetSynergyInfo {
  label: string;
  description: string;
  icon?: string;
  color: string;
  gradient?: string;
  svg?: string;
  imageUrl?: string;
}

export interface ArmorSetSynergyTiers {
  twoPiece: readonly ArmorSetSynergy[];
  fourPiece: readonly ArmorSetSynergy[];
}

export const ARMOR_SET_SYNERGY_INFO: Record<ArmorSetSynergy, ArmorSetSynergyInfo> = {
  prismatic: {
    label: "Prismatic",
    description: "Involves the Prismatic subclass or its Light and Darkness effects.",
    color: "#e17bb7",
    svg: "assets/destiny-symbols/subclasses/prismatic.svg",
  },
  arc: {
    label: "Arc",
    description: "Involves Arc damage or Arc subclass effects such as Jolt or Blind.",
    color: "#72c6fa",
    svg: "assets/destiny-symbols/subclasses/arc.svg",
  },
  solar: {
    label: "Solar",
    description: "Involves Solar damage or Solar subclass effects such as Scorch or Ignition.",
    color: "#f28b52",
    svg: "assets/destiny-symbols/subclasses/solar.svg",
  },
  void: {
    label: "Void",
    description: "Involves Void damage or Void subclass effects such as Weaken or Volatile.",
    color: "#b889ef",
    svg: "assets/destiny-symbols/subclasses/void.svg",
  },

  stasis: {
    label: "Stasis",
    description: "Involves Stasis damage or effects such as Slow, Freeze, or Shatter.",
    color: "#747eff",
    svg: "assets/destiny-symbols/subclasses/stasis.svg",
  },
  strand: {
    label: "Strand",
    description: "Involves Strand damage or effects such as Sever, Suspend, or Unravel.",
    color: "#55df91",
    svg: "assets/destiny-symbols/subclasses/strand.svg",
  },
  light: {
    label: "Light",
    description: "Involves Light subclasses or damage: Arc, Solar, and Void.",
    color: "#80cfff",
    svg: "assets/destiny-symbols/subclasses/light-ability.svg",
  },
  darkness: {
    label: "Darkness",
    description: "Involves Darkness subclasses or damage, primarily Stasis and Strand effects.",
    color: "#d6964b",
    svg: "assets/destiny-symbols/subclasses/dark-ability.svg",
  },
  kinetic: {
    label: "Kinetic",
    description: "Involves Kinetic damage or Kinetic weapons.",
    color: "#eeeeee",
    svg: "assets/armor-set-synergies/kinetic-damage.svg",
  },
  weapons: {
    label: "Weapons",
    description: "Affects weapons broadly rather than one specific weapon type.",
    color: "#eeeeee",
    svg: "assets/destiny-symbols/attacks/headshot.svg",
  },
  autoRifles: {
    label: "Auto rifles",
    description: "Applies specifically to Auto Rifles or their use in combat.",
    color: "#eeeeee",
    svg: "assets/destiny-symbols/weapons/auto-rifle.svg",
  },
  bows: {
    label: "Bows",
    description: "Applies specifically to Bows or their use in combat.",
    color: "#eeeeee",
    svg: "assets/destiny-symbols/weapons/bow.svg",
  },
  fusionRifles: {
    label: "Fusion rifles",
    description: "Applies specifically to Fusion Rifles or their use in combat.",
    color: "#eeeeee",
    svg: "assets/destiny-symbols/weapons/fusion-rifle.svg",
  },
  glaives: {
    label: "Glaives",
    description: "Applies specifically to Glaives or their use in combat.",
    color: "#eeeeee",
    svg: "assets/destiny-symbols/weapons/glaive.svg",
  },
  grenadeLaunchers: {
    label: "Grenade launchers",
    description: "Applies specifically to Grenade Launchers or their use in combat.",
    color: "#eeeeee",
    svg: "assets/destiny-symbols/weapons/heavy-grenade-launcher.svg",
  },
  handCannons: {
    label: "Hand cannons",
    description: "Applies specifically to Hand Cannons or their use in combat.",
    color: "#eeeeee",
    svg: "assets/destiny-symbols/weapons/hand-cannon.svg",
  },
  heatWeapons: {
    label: "Heat weapons",
    description: "Applies to Heat weapons, a specific weapon family.",
    color: "#eeeeee",
    imageUrl:
      "https://www.bungie.net/common/destiny2_content/icons/4e065ecc7e8166279873c55b563b5311.png",
  },
  linearFusionRifles: {
    label: "Linear fusion rifles",
    description: "Applies specifically to Linear Fusion Rifles or their use in combat.",
    color: "#eeeeee",
    svg: "assets/destiny-symbols/weapons/linear-fusion-rifle.svg",
  },
  microMissiles: {
    label: "Micro missiles",
    description: "Involves the Micro-Missile weapon effect or weapons that use it.",
    color: "#eeeeee",
    imageUrl:
      "https://www.bungie.net/common/destiny2_content/icons/644ef2e73edb4abef9b31fc2ac49a1c8.png",
  },
  rocketLaunchers: {
    label: "Rocket launchers",
    description: "Applies specifically to Rocket Launchers or their use in combat.",
    color: "#eeeeee",
    svg: "assets/destiny-symbols/weapons/rocket-launcher.svg",
  },
  scoutRifles: {
    label: "Scout rifles",
    description: "Applies specifically to Scout Rifles or their use in combat.",
    color: "#eeeeee",
    svg: "assets/destiny-symbols/weapons/scout-rifle.svg",
  },
  sidearms: {
    label: "Sidearms",
    description: "Applies specifically to Sidearms or their use in combat.",
    color: "#eeeeee",
    svg: "assets/destiny-symbols/weapons/sidearm.svg",
  },
  shotguns: {
    label: "Shotguns",
    description: "Applies specifically to Shotguns or their use in combat.",
    color: "#eeeeee",
    svg: "assets/destiny-symbols/weapons/shotgun.svg",
  },
  smgs: {
    label: "SMGs",
    description: "Applies specifically to Submachine Guns or their use in combat.",
    color: "#eeeeee",
    svg: "assets/destiny-symbols/weapons/submachine-gun.svg",
  },
  swords: {
    label: "Swords",
    description: "Applies specifically to Swords or their use in combat.",
    color: "#eeeeee",
    svg: "assets/destiny-symbols/weapons/sword.svg",
  },
  ammoBrick: {
    label: "Ammo brick",
    description: "Interacts with ammo bricks, such as their generation, pickup, or reserves.",
    color: "#eeeeee",
    gradient: "linear-gradient(90deg, #49dc65 0%, #ba68c8 100%)",
    svg: "assets/armor-set-synergies/heavy-ammo.svg",
  },
  primaryAmmo: {
    label: "Primary ammo",
    description: "Affects Primary-ammo weapons, their ammo, or their combat effectiveness.",
    color: "#eeeeee",
    svg: "assets/armor-set-synergies/primary-ammo.svg",
  },
  specialAmmo: {
    label: "Special ammo",
    description: "Affects Special ammo, including its generation, pickup, or reserves.",
    color: "#49dc65",
    svg: "assets/armor-set-synergies/special-ammo.svg",
  },
  heavyAmmo: {
    label: "Heavy ammo",
    description: "Affects Heavy ammo, including its generation, pickup, or reserves.",
    color: "#ba68c8",
    svg: "assets/armor-set-synergies/heavy-ammo.svg",
  },
  grenade: {
    label: "Grenade",
    description: "Affects grenade ability damage, recharge, or effects.",
    color: "#eeeeee",
    svg: "assets/destiny-symbols/attacks/grenade.svg",
  },
  melee: {
    label: "Melee",
    description: "Affects melee ability damage, recharge, or effects.",
    color: "#eeeeee",
    svg: "assets/destiny-symbols/attacks/melee.svg",
  },
  classAbility: {
    label: "Class ability",
    description: "Affects your class ability, its cooldown, or its effects.",
    color: "#eeeeee",
    svg: "assets/armor-set-synergies/class-ability.svg",
  },
  allAbilities: {
    label: "All abilities",
    description: "Affects multiple ability types or their cooldowns and effects.",
    color: "#eeeeee",
    svg: "assets/armor-set-synergies/all-abilities.svg",
  },
  super: {
    label: "Super",
    description: "Affects Super ability damage, recharge, or effects.",
    color: "#eeeeee",
    svg: "assets/armor-set-synergies/super.svg",
  },
  finishers: {
    label: "Finishers",
    description: "Triggers an effect when you perform a finisher or defeat a finisher target.",
    color: "#eeeeee",
    svg: "assets/armor-set-synergies/finishers.svg",
  },
  orbsOfPower: {
    label: "Orbs of Power",
    description: "Creates, collects, or gains benefits from Orbs of Power.",
    color: "#eeeeee",
    svg: "assets/armor-set-synergies/orbs-of-power.svg",
  },
  elementalPickups: {
    label: "Elemental pickups",
    description: "Creates or benefits from pickups generated by subclass effects.",
    icon: "north",
    color: "#80cfff",
  },
  armorCharge: {
    label: "Armor Charge",
    description: "Creates, consumes, or improves Armor Charge.",
    color: "#28c7bc",
    imageUrl:
      "https://www.bungie.net/common/destiny2_content/icons/0a2dc686c46b4d7d09c53274fadd49f9.png",
  },
  healing: {
    label: "Healing",
    description: "Restores health, starts health regeneration, or improves healing effects.",
    color: "#55df91",
    imageUrl:
      "https://www.bungie.net/common/destiny2_content/icons/db7f4f4f8c9ec48b5303cf5a2f8dc662.png",
  },
  /*
  classStat: {
    label: "Class stat",
    description: "Scales with or improves the Class stat.",
    color: "#aebac2",
    imageUrl: ArmorStatIconUrls[ArmorStat.StatClass],
  },
  */
  damageDebuff: {
    label: "Damage/Debuff",
    description: "Improves your damage against enemies or applies/benefits from target debuffs.",
    color: "#b6d9e8",
    imageUrl:
      "https://www.bungie.net/common/destiny2_content/icons/d436568b58806b6666fa250ec9a7b593.png",
  },
  enemyDamageOutput: {
    label: "Enemy damage output",
    description: "Reduces or otherwise changes the damage enemies deal.",
    color: "#b6d9e8",
    imageUrl:
      "https://www.bungie.net/common/destiny2_content/icons/d436568b58806b6666fa250ec9a7b593.png",
  },
  disorient: {
    label: "Disorient",
    description: "Disorients enemies, disrupting their ability to target or attack effectively.",
    icon: "blur_circular",
    color: "#d343a5",
  },
  exhaust: {
    label: "Exhaust",
    description:
      "Applies or interacts with the Exhaust effect on enemies; its exact impact varies by set.",
    icon: "keyboard_double_arrow_down",
    color: "#d343a5",
  },
  healthStat: {
    label: "Health stat",
    description: "Scales with or improves the Health stat.",
    color: "#aebac2",
    imageUrl: ArmorStatIconUrls[ArmorStat.StatHealth],
  },
  mobility: {
    label: "Mobility",
    description: "Scales with or improves Mobility, or affects movement speed.",
    color: "#eeeeee",
    svg: "assets/armor-set-synergies/mobility.svg",
  },
  meleeStat: {
    label: "Melee stat",
    description: "Scales with or improves the Melee stat.",
    color: "#aebac2",
    imageUrl: ArmorStatIconUrls[ArmorStat.StatMelee],
  },
  grenadeStat: {
    label: "Grenade stat",
    description: "Scales with or improves the Grenade stat.",
    color: "#aebac2",
    imageUrl: ArmorStatIconUrls[ArmorStat.StatGrenade],
  },
  superStat: {
    label: "Super stat",
    description: "Scales with or improves the Super stat.",
    color: "#aebac2",
    imageUrl: ArmorStatIconUrls[ArmorStat.StatSuper],
  },
  weaponStat: {
    label: "Weapon stat",
    description: "Scales with or improves the Weapon stat.",
    color: "#aebac2",
    imageUrl: ArmorStatIconUrls[ArmorStat.StatWeapon],
  },
};
