import { ArmorPerkOrSlot, ArmorStat } from "./enum/armor-stat";
import { ModOrAbility } from "./enum/modOrAbility";
import { EnumDictionary } from "./types/EnumDictionary";
import { CharacterClass } from "./enum/character-Class";
import { MAXIMUM_STAT_MOD_AMOUNT } from "./constants";
import { DestinyEnergyType } from "bungie-api-ts/destiny2";
import { ArmorSlot } from "./enum/armor-slot";
import { ModifierType } from "./enum/modifierType";

export function getDefaultStatDict(
    value: number
): EnumDictionary<ArmorStat, FixableSelection<number>> {
    return {
        [ArmorStat.Mobility]: { fixed: false, value: value },
        [ArmorStat.Resilience]: { fixed: false, value: value },
        [ArmorStat.Recovery]: { fixed: false, value: value },
        [ArmorStat.Discipline]: { fixed: false, value: value },
        [ArmorStat.Intellect]: { fixed: false, value: value },
        [ArmorStat.Strength]: { fixed: false, value: value },
    };
}

export interface FixableSelection<T> {
    value: T;
    fixed: boolean;
}

export class BuildConfiguration {
    characterClass: CharacterClass = CharacterClass.Titan;

    // Add constant +1 strength
    addConstent1Resilience = false;

    // TODO REMOVE THIS
    assumeEveryLegendaryIsArtifice = false;

    // contains a list of item instances IDs that shall not be used in builds
    disabledItems: string[] = [];

    // TODO: convert minimumStatTier -> minimumStatTiers for old configs
    minimumStatTiers: EnumDictionary<ArmorStat, FixableSelection<number>> = {
        [ArmorStat.Mobility]: { fixed: false, value: 0 },
        [ArmorStat.Resilience]: { fixed: false, value: 0 },
        [ArmorStat.Recovery]: { fixed: false, value: 0 },
        [ArmorStat.Discipline]: { fixed: false, value: 0 },
        [ArmorStat.Intellect]: { fixed: false, value: 0 },
        [ArmorStat.Strength]: { fixed: false, value: 0 },
    };
    maximumStatMods: number = 5; // TODO: remove

    // Fixable, BUT the bool is not yet used. Maybe in a future update.
    maximumModSlots: EnumDictionary<ArmorSlot, FixableSelection<number>> = {
        [ArmorSlot.ArmorSlotHelmet]: { fixed: false, value: 5 },
        [ArmorSlot.ArmorSlotGauntlet]: { fixed: false, value: 5 },
        [ArmorSlot.ArmorSlotChest]: { fixed: false, value: 5 },
        [ArmorSlot.ArmorSlotLegs]: { fixed: false, value: 5 },
        [ArmorSlot.ArmorSlotClass]: { fixed: false, value: 5 },
        [ArmorSlot.ArmorSlotNone]: { fixed: false, value: 5 },
    };

    putArtificeMods = true;
    useFotlArmor = true;
    allowBlueArmorPieces = true;
    ignoreSunsetArmor = false;
    assumeLegendariesMasterworked = true;
    assumeExoticsMasterworked = true;
    assumeClassItemMasterworked = true;
    onlyUseMasterworkedItems = false;
    limitParsedResults = true; // Limits the amount of results that are parsed. This looses some results, but solves memory issues
    tryLimitWastedStats = false;
    onlyShowResultsWithNoWastedStats = false;
    showWastedStatsColumn = false;
    showPotentialTierColumn = false;

    selectedModElement: ModifierType = ModifierType.Stasis;
    enabledMods: ModOrAbility[] = [];
    selectedExotics: number[] = [];

    armorPerks: EnumDictionary<ArmorSlot, FixableSelection<ArmorPerkOrSlot>> = {
        [ArmorSlot.ArmorSlotHelmet]: { fixed: true, value: ArmorPerkOrSlot.None },
        [ArmorSlot.ArmorSlotGauntlet]: { fixed: true, value: ArmorPerkOrSlot.None },
        [ArmorSlot.ArmorSlotChest]: { fixed: true, value: ArmorPerkOrSlot.None },
        [ArmorSlot.ArmorSlotLegs]: { fixed: true, value: ArmorPerkOrSlot.None },
        [ArmorSlot.ArmorSlotClass]: { fixed: true, value: ArmorPerkOrSlot.None },
        [ArmorSlot.ArmorSlotNone]: { fixed: true, value: ArmorPerkOrSlot.None },
    };

    static buildEmptyConfiguration(): BuildConfiguration {
        return {
            enabledMods: [],
            disabledItems: [],
            addConstent1Resilience: false,
            assumeEveryLegendaryIsArtifice: false, // TODO :REMOVE
            putArtificeMods: true,
            useFotlArmor: false,
            maximumStatMods: MAXIMUM_STAT_MOD_AMOUNT,
            onlyUseMasterworkedItems: false,
            ignoreSunsetArmor: false,
            allowBlueArmorPieces: true,
            assumeLegendariesMasterworked: true,
            assumeExoticsMasterworked: true,
            assumeClassItemMasterworked: true,
            limitParsedResults: true,
            tryLimitWastedStats: true,
            onlyShowResultsWithNoWastedStats: false,
            showWastedStatsColumn: false,
            showPotentialTierColumn: false,
            characterClass: CharacterClass.Titan,
            selectedModElement: ModifierType.Stasis,
            selectedExotics: [],
            maximumModSlots: {
                [ArmorSlot.ArmorSlotHelmet]: { fixed: false, value: 5 },
                [ArmorSlot.ArmorSlotGauntlet]: { fixed: false, value: 5 },
                [ArmorSlot.ArmorSlotChest]: { fixed: false, value: 5 },
                [ArmorSlot.ArmorSlotLegs]: { fixed: false, value: 5 },
                [ArmorSlot.ArmorSlotClass]: { fixed: false, value: 5 },
                [ArmorSlot.ArmorSlotNone]: { fixed: false, value: 5 },
            },
            armorPerks: {
                [ArmorSlot.ArmorSlotHelmet]: { fixed: true, value: ArmorPerkOrSlot.None },
                [ArmorSlot.ArmorSlotGauntlet]: { fixed: true, value: ArmorPerkOrSlot.None },
                [ArmorSlot.ArmorSlotChest]: { fixed: true, value: ArmorPerkOrSlot.None },
                [ArmorSlot.ArmorSlotLegs]: { fixed: true, value: ArmorPerkOrSlot.None },
                [ArmorSlot.ArmorSlotClass]: { fixed: true, value: ArmorPerkOrSlot.None },
                [ArmorSlot.ArmorSlotNone]: { fixed: true, value: ArmorPerkOrSlot.None },
            },
            minimumStatTiers: getDefaultStatDict(0),
        };
    }
}
