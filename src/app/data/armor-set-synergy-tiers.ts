import { ArmorSetSynergy, ArmorSetSynergyTiers } from "./armor-set-synergies";

function tiers(
  twoPiece: ArmorSetSynergy[] = [],
  fourPiece: ArmorSetSynergy[] = []
): ArmorSetSynergyTiers {
  return { twoPiece, fourPiece };
}

export const ARMOR_SET_SYNERGIES_BY_TIER: Readonly<Record<number, ArmorSetSynergyTiers>> = {
  894715166: tiers(
    ["rocketLaunchers", "grenadeLaunchers", "microMissiles", "weapons", "enemyDamageOutput"],
    ["disorient", "damageDebuff", "melee"]
  ), // AION Adapter
  1223381128: tiers(
    ["arc", "mobility", "rocketLaunchers", "grenadeLaunchers", "microMissiles", "weapons"],
    ["arc", "mobility", "damageDebuff"]
  ), // AION Renewal
  1439803506: tiers(["finishers", "healing", "damageDebuff"], ["solar", "melee"]), // Apostate's Blade
  741162535: tiers(
    ["orbsOfPower", "damageDebuff", "healthStat"],
    ["orbsOfPower", "arc", "solar", "void", "stasis", "strand", "prismatic"]
  ), // Atheon's Memory
  1083114430: tiers(
    ["healing"],
    ["healing", "swords", "bows", "shotguns", "weapons", "enemyDamageOutput"]
  ), // Bushido
  2032049849: tiers(["arc", "healing", "mobility"], ["arc"]), // Circuit
  1490136267: tiers(
    ["weapons", "light", "grenadeStat", "darkness", "kinetic", "meleeStat"],
    ["weapons", "light", "grenadeStat", "darkness", "kinetic", "meleeStat", "enemyDamageOutput"]
  ), // CODA
  1007956300: tiers(["weapons", "ammoBrick"], ["solar", "strand"]), // Collective Psyche
  2620550053: tiers(["melee"], ["weapons", "enemyDamageOutput"]), // Crota's Memory
  742845781: tiers(["weapons", "primaryAmmo"], ["weapons", "primaryAmmo"]), // Cruel Electrum
  3090557911: tiers(["orbsOfPower", "specialAmmo", "heavyAmmo"], ["stasis"]), // Crystocrene
  1790308978: tiers(["weapons", "mobility"], ["specialAmmo"]), // Cyberserpent Null
  1658353742: tiers(["melee", "swords", "weapons"], ["healing", "classAbility"]), // Dark Age
  1557540933: tiers(["weapons", "damageDebuff"], ["weapons", "healing"]), // Deep Explorer
  2947197258: tiers(
    ["autoRifles", "scoutRifles", "sidearms", "healing"],
    ["autoRifles", "scoutRifles", "sidearms", "damageDebuff"]
  ), // Disaster Corps Set
  2250480800: tiers(["grenadeStat", "meleeStat"], ["weapons", "healing"]), // Dreambane
  2461275960: tiers(["void", "elementalPickups"], ["void", "elementalPickups", "weapons"]), // Eutechnology
  3120219904: tiers(["orbsOfPower", "ammoBrick", "damageDebuff"], ["healing", "armorCharge"]), // Exodus Down
  3734029045: tiers(["enemyDamageOutput"], ["primaryAmmo", "specialAmmo", "heavyAmmo"]), // Ferropotent
  1625535837: tiers(
    ["prismatic", "arc", "solar", "void", "stasis", "strand"],
    ["prismatic", "arc", "solar", "void", "stasis", "strand", "grenade"]
  ), // First Ascent
  3656317458: tiers(["strand", "damageDebuff"], ["strand", "damageDebuff", "healing"]), // Flain
  673904900: tiers(["grenade", "enemyDamageOutput"], ["grenade", "heavyAmmo"]), // Great Hunt
  1777208707: tiers(["weapons", "primaryAmmo", "weaponStat"], ["super"]), // Iron Battalion Set
  305966751: tiers(
    ["damageDebuff", "weapons", "healing"],
    ["damageDebuff", "specialAmmo", "heavyAmmo", "enemyDamageOutput"]
  ), // Iron Panoply Set
  640349758: tiers(["healthStat", "weapons"], ["melee"]), // Kentarch 3
  3252452908: tiers(["weapons", "primaryAmmo"], ["orbsOfPower", "specialAmmo"]), // Last Discipline
  774717709: tiers(["melee", "disorient"], ["super", "damageDebuff", "microMissiles"]), // Legacy's Oath
  499993704: tiers(
    ["arc", "fusionRifles", "linearFusionRifles", "heatWeapons", "weapons"],
    ["arc", "elementalPickups"]
  ), // Luminopotent
  3737690559: tiers(["solar", "healing", "weapons"], ["solar", "healing"]), // Lustrous
  2132906400: tiers(["weapons", "primaryAmmo"], ["weapons"]), // New Demotic
  2586994783: tiers(
    ["orbsOfPower", "arc", "solar", "void", "stasis", "strand"],
    ["finishers", "void", "enemyDamageOutput"]
  ), // Nezarec's Nightmare
  305091568: tiers(["specialAmmo", "heavyAmmo"], ["void", "damageDebuff"]), // Oryx's Memory
  2386215115: tiers(["ammoBrick", "armorCharge", "healthStat"], ["weapons"]), // Pantheos Resplendent
  2618364783: tiers(["mobility", "weapons", "primaryAmmo"], ["mobility"]), // Per Audacia
  2687807560: tiers(["weapons", "enemyDamageOutput"], ["exhaust"]), // Promised
  338646742: tiers(["healing", "melee", "damageDebuff"], ["healing", "weapons", "glaives"]), // Resonant Fury
  428813981: tiers(["weapons", "damageDebuff", "enemyDamageOutput"], ["solar", "healing"]), // Reverie Dawn
  4222859846: tiers(["swords", "grenade", "classAbility"], ["swords", "weapons"]), // Sage Protector
  222121557: tiers(
    [
      "elementalPickups",
      "solar",
      "grenade",
      "rocketLaunchers",
      "grenadeLaunchers",
      "microMissiles",
      "weaponStat",
      "grenadeStat",
    ],
    ["elementalPickups", "healing"]
  ), // Seventh Seraph
  2839368623: tiers(
    ["heatWeapons", "smgs", "handCannons", "weapons"],
    ["heatWeapons", "smgs", "handCannons", "weapons", "weaponStat"]
  ), // Shrewd Survivor
  2751989785: tiers(["orbsOfPower", "enemyDamageOutput"], ["finishers", "specialAmmo", "healing"]), // Smoke Jumper Set
  3639539903: tiers(["disorient", "weapons", "primaryAmmo"], ["disorient", "grenade"]), // Spacewalk
  2391762223: tiers(
    ["swords", "glaives", "enemyDamageOutput", "melee", "exhaust"],
    ["swords", "glaives", "enemyDamageOutput"]
  ), // Swordmaster
  1624798568: tiers(["finishers", "superStat"], ["orbsOfPower", "allAbilities", "arc"]), // Taken King
  1339137760: tiers(["finishers", "stasis"], ["finishers", "allAbilities", "enemyDamageOutput"]), // Techeun's Regalia
  239346083: tiers(["kinetic"], ["disorient"]), // Techsec
  2151917545: tiers(
    ["primaryAmmo", "weapons", "heatWeapons", "grenade"],
    [
      "primaryAmmo",
      "weapons",
      "heatWeapons",
      "weaponStat",
      "grenadeStat",
      "specialAmmo",
      "heavyAmmo",
    ]
  ), // Thriving Survivor
  3283637820: tiers(["grenade", "enemyDamageOutput"], ["strand", "grenade", "specialAmmo"]), // Thunderhead
  1523985791: tiers(["weapons", "healing"], ["weapons"]), // TM Custom
  50540439: tiers(["weapons", "ammoBrick"], ["weapons", "mobility"]), // Triumphal Anthem
  3259216565: tiers(["healing", "ammoBrick"], ["weapons", "primaryAmmo"]), // Twofold Crown
  2481896422: tiers(
    ["finishers", "void", "melee", "elementalPickups", "light", "arc", "solar"],
    ["finishers", "void", "healing"]
  ), // Veritas
  2450108908: tiers(["weapons", "specialAmmo"], ["healing", "super"]), // Wayward Psyche Set
  2258577662: tiers(["weapons"], ["weapons"]), // Wild Anthem
  2554324129: tiers(["weapons"], ["weapons"]), // Wildwood
  1507061013: tiers(
    ["orbsOfPower", "ammoBrick", "elementalPickups", "weapons"],
    ["orbsOfPower", "damageDebuff"]
  ), // Yearning Echo
};
