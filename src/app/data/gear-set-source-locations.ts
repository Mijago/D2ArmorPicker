import { GearSetAcquisitionLocation } from "./gear-set-acquisition";

function location(
  sourceType: GearSetAcquisitionLocation["sourceType"],
  locationHash: number
): GearSetAcquisitionLocation {
  return { sourceType, locationHash };
}

const activity = "activity";
const raid = "raid";
const dungeon = "dungeon";
const world = "world";

export const GEAR_SET_ACQUISITION_LOCATION_FALLBACK_NAMES: Readonly<Record<number, string>> = {
  2439131218: "Renegades",
  4076196532: "Kepler",
  2454169558: "Pit of Heresy",
  677774031: "The Moon",
  1246572235: "Crucible Ops",
  2112123535: "Pantheon",
  1449984089: "Eternity",
  2612414021: "The Desert Perpetual (Epic)",
  2042336100: "Pinnacle Ops",
  2699534027: "Arena Ops",
  1204273545: "Solo Ops",
  2244580325: "Savathun's Throne World",
  697502628: "European Dead Zone",
  2815807669: "Root of Nightmares",
  1127062680: "Crota's End",
  2482532469: "Salvation's Edge",
  4038998327: "Fireteam Ops",
  1729879943: "Europa",
  3607432451: "Nessus",
  1055175152: "Trials of Osiris",
  2481646875: "Neomuna",
  4095868423: "Vesper's Host",
  2691873398: "Sundered Doctrine",
  760002588: "Solstice",
  770776989: "Equilibrium",
  3049172190: "Iron Banner",
  3990611421: "Cosmodrome",
  3034241322: "Gambit Ops",
  3279273788: "King's Fall",
  413325010: "Vow of the Disciple",
  1416096592: "The Dreaming City",
  2201294386: "Prophecy",
  2284860977: "Garden of Salvation",
  3429024154: "Last Wish",
  399931109: "Vault of Glass",
  3837378125: "Deep Stone Crypt",
  464400663: "The Desert Perpetual",
  2551877857: "The Shattered Throne",
  2856036579: "Grasp of Avarice",
  3213104642: "Spire of the Watcher",
  539367506: "Duality",
  3713296423: "Ghosts of the Deep",
  3998251206: "The Pale Heart",
  2611937027: "Warlord's Ruin",
};

export const GEAR_SET_ACQUISITION_LOCATIONS: Readonly<
  Record<number, readonly GearSetAcquisitionLocation[]>
> = {
  894715166: [location(world, 4076196532)], // AION Adapter - Kepler
  1223381128: [location(world, 4076196532)], // AION Renewal - Kepler
  1439803506: [location(dungeon, 2454169558)], // Apostate's Blade - Pit of Heresy
  741162535: [location(raid, 399931109)], // Atheon's Memory - Vault of Glass
  1083114430: [location(activity, 2042336100)], // Bushido - Pinnacle Ops
  2032049849: [location(activity, 1246572235)], // Circuit - Crucible Ops
  1490136267: [location(dungeon, 2201294386)], // CODA - Prophecy
  1007956300: [location(raid, 464400663)], // Collective Psyche - The Desert Perpetual
  2620550053: [location(raid, 1127062680)], // Crota's Memory - Crota's End
  742845781: [location(activity, 1055175152)], // Cruel Electrum - Trials of Osiris
  3090557911: [location(world, 1729879943)], // Crystocrene - Europa
  1790308978: [location(activity, 3034241322)], // Cyberserpent Null - Gambit Ops
  1658353742: [location(dungeon, 2611937027)], // Dark Age - Warlord's Ruin
  1557540933: [location(dungeon, 539367506)], // Deep Explorer - Duality
  2947197258: [location(activity, 1246572235)], // Disaster Corps Set - Crucible Ops
  2250480800: [location(world, 677774031)], // Dreambane - The Moon
  2461275960: [
    location(activity, 2042336100),
    location(activity, 2699534027),
    location(activity, 1204273545),
  ], // Eutechnology - Pinnacle Ops, Arena Ops, Solo Ops
  3120219904: [location(world, 3607432451)], // Exodus Down - Nessus
  3734029045: [location(activity, 1204273545), location(activity, 4038998327)], // Ferropotent - Solo Ops, Fireteam Ops
  1625535837: [location(world, 3998251206)], // First Ascent - The Pale Heart
  3656317458: [location(dungeon, 2691873398)], // Flain - Sundered Doctrine
  673904900: [location(raid, 3429024154)], // Great Hunt - Last Wish
  1777208707: [location(activity, 1246572235)], // Iron Battalion Set - Crucible Ops
  305966751: [location(activity, 3049172190)], // Iron Panoply Set - Iron Banner
  640349758: [location(raid, 2284860977)], // Kentarch 3 - Garden of Salvation
  3252452908: [location(activity, 1246572235), location(activity, 1055175152)], // Last Discipline - Crucible Ops, Trials of Osiris
  774717709: [location(raid, 3837378125)], // Legacy's Oath - Deep Stone Crypt
  499993704: [
    location(activity, 4038998327),
    location(activity, 2699534027),
    location(activity, 1204273545),
  ], // Luminopotent - Fireteam Ops, Arena Ops, Solo Ops
  3737690559: [location(activity, 760002588)], // Lustrous - Solstice
  2132906400: [location(activity, 1055175152)], // New Demotic - Trials of Osiris
  2586994783: [location(raid, 2815807669)], // Nezarec's Nightmare - Root of Nightmares
  305091568: [location(raid, 3279273788)], // Oryx's Memory - King's Fall
  2386215115: [location(raid, 2112123535)], // Pantheos Resplendent - Pantheon
  2618364783: [location(activity, 1246572235)], // Per Audacia - Crucible Ops
  2687807560: [location(raid, 2482532469)], // Promised - Salvation's Edge
  338646742: [location(raid, 413325010)], // Resonant Fury - Vow of the Disciple
  428813981: [location(world, 1416096592)], // Reverie Dawn - The Dreaming City
  4222859846: [location(dungeon, 770776989)], // Sage Protector - Equilibrium
  222121557: [location(world, 3990611421)], // Seventh Seraph - Cosmodrome
  2839368623: [location(activity, 2439131218)], // Shrewd Survivor - Renegades
  2751989785: [location(activity, 4038998327), location(activity, 1204273545)], // Smoke Jumper Set - Fireteam Ops, Solo Ops
  3639539903: [location(dungeon, 4095868423)], // Spacewalk - Vesper's Host
  2391762223: [location(world, 1449984089)], // Swordmaster - Eternity
  1624798568: [location(dungeon, 3713296423)], // Taken King - Ghosts of the Deep
  1339137760: [location(dungeon, 2551877857)], // Techeun's Regalia - The Shattered Throne
  239346083: [
    location(activity, 2042336100),
    location(activity, 4038998327),
    location(activity, 1204273545),
  ], // Techsec - Pinnacle Ops, Fireteam Ops, Solo Ops
  2151917545: [location(activity, 2439131218)], // Thriving Survivor - Renegades
  3283637820: [location(world, 2481646875)], // Thunderhead - Neomuna
  1523985791: [location(dungeon, 3213104642)], // TM Custom - Spire of the Watcher
  50540439: [
    location(activity, 1246572235),
    location(activity, 3049172190),
    location(activity, 1055175152),
  ], // Triumphal Anthem - Crucible Ops, Iron Banner, Trials of Osiris
  3259216565: [location(activity, 1055175152)], // Twofold Crown - Trials of Osiris
  2481896422: [location(world, 2244580325)], // Veritas - Savathun's Throne World
  2450108908: [location(raid, 2612414021)], // Wayward Psyche Set - The Desert Perpetual (Epic)
  2258577662: [location(activity, 1246572235)], // Wild Anthem - Crucible Ops
  2554324129: [location(world, 697502628)], // Wildwood - European Dead Zone
  1507061013: [location(dungeon, 2856036579)], // Yearning Echo - Grasp of Avarice
};
