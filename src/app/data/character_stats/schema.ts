/*
 * Copyright (c) 2023 D2ArmorPicker by Mijago.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * Contains a locale ID that you can use to grab the description for the item in your selected language. The ID is provided in a [key].[value] format where there can be an arbitrary number of keys (though it'll be 2-3 at most). Then you can use these keys and values to query the './locale/[language code].json' files for the desired description.
 */
export type Description = string;

export interface Override {
  /**
   * D2 Manifest inventoryItem hash
   */
  Hash: number;
  /**
   * For organization purposes only. Does not necessarily match the inventoryItem entry name from the D2 Manifest.
   */
  Name: string;
  /**
   * The inventoryItem hash of each ability that is required to trigger the effects of this 'Override'. Only overrides 'Abilities' under the same Character Stat as the 'Override'. Any one of these will trigger its effect defined in the other 'Override' properties. Wildcards: if the requirements array only contains 1 item and it's a 0, any ability tied to this Character Stat will have its cooldown overwritten. Negative numbers in the array indicate filters, these will be the inventoryItem hashes of subclasses multiplied by -1. Any abilities tied to the given subclass will have their cooldowns overwritten.
   *
   * @minItems 1
   */
  Requirements: [number, ...number[]];
  /**
   * Array index represents the Character Stat tier. Cooldowns are in seconds. Rounded to 2 decimal points. Overrides the cooldowns of the items listed in the 'Requirements' array before the scalar is applied. Identical to the 'Cooldowns' array of the 'Ability' object. Contains 11 0s if not in use.
   *
   * @minItems 11
   * @maxItems 11
   */
  CooldownOverride?: [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number
  ];
  /**
   * Length of the array is equal to the length of the 'Requirements' array. Each item represents a multiplier to the cooldown time of the abilities listed in the 'Requirements' array at the same array index. Multiple scalars can stack with each other if their requirements are met (eg. Bastion Aspect and Citan's Ramparts Exotic Gauntlets). If 'CooldownOverride' property is specified: 'Scalar's are factored in after 'CooldownOverride's.
   *
   * @minItems 1
   */
  Scalar?: [number, ...number[]];
  /**
   * Length of the array is equal to the length of the 'Requirements' array. Each item represents a flat increase to the cooldown time of the abilities listed in the 'Requirements' array at the same array index. If 'CooldownOverride' or 'Scalar' property is specified: Time is added to the cooldown times at every tier after 'CooldownOverride's and 'Scalar's have been applied.
   *
   * @minItems 1
   */
  FlatIncrease?: [number, ...number[]];
}

export interface CharacterStats {
  Mobility: Mobility;
  Resilience: Resilience;
  Recovery: Recovery;
  Discipline: CharacterStatData;
  Intellect: Intellect;
  Strength: CharacterStatData;
}

interface CharacterStatData {
  Description: Description;
  Abilities: Ability[];
  Overrides: Override[];
}

export interface Mobility extends CharacterStatData {
  Description: Description;
  WalkSpeed: {
    Description: Description;
    /**
     * Represents how fast you can walk (not sprint) forward in meters per second. Array index represents the Mobility tier. Rounding beyond 2 decimal places is not recommended.
     */
    Array: number[];
  };
  StrafeSpeed: {
    Description: Description;
    /**
     * Represents how fast you can walk side-to-side and backwards in meters per second (85% of Walking Speed). Array index represents the Mobility tier. Rounding beyond 2 decimal places is not recommended.
     */
    Array: number[];
  };
  CrouchSpeed: {
    Description: Description;
    /**
     * Represents how fast you can move while crouching in meters per second (55% of Walking Speed). Array index represents the Mobility tier. The speeds are represented in meters per second. Rounding beyond 2 decimal places is not recommended.
     */
    Array: number[];
  };
}

export interface Ability {
  /**
   * D2 Manifest inventoryItem hash
   */
  Hash: number;
  /**
   * For organization purposes only. Does not necessarily match the inventoryItem entry name from the D2 Manifest.
   */
  Name: string;
  /**
   * Array index represents the Character Stat tier. Cooldowns are in seconds. Rounded to 2 decimal points. Note: Rounding to 2 decimal places is solely for improving math precision when combined with Override objects. When displaying these cooldown times, it is STRONGLY recommended to round them to an integer.
   *
   * @minItems 11
   * @maxItems 11
   */
  Cooldowns: [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number
  ];
  /**
   * Represents the behavior of certain abilities possessing additional scaling on their cooldown depending on the number of stored ability charges. The array's length represents the number of charges an ability has intrinsically. Numbers at every array index represent the Charge Rate scalar for the ability with [index] number of stored ability charges. As this is a Charge Rate scalar, cooldown times can be calculated by dividing the times in the Cooldowns member of abilities by the scalars in this array. Do note that this is not a required member of Ability objects and will only be present if an ability has multiple charges. (Therefore, if this property is absent, it is to be assumed that the ability only has a single charge by default)
   *
   * @minItems 1
   */
  ChargeBasedScaling?: [number, ...number[]];
}

export interface Resilience extends CharacterStatData {
  Description: Description;
  ShieldHP: {
    Description: Description;
    /**
     * Array index represents the Resilience tier. The numbers represent your total HP at each tier. 'Health' is a static 70 HP, the rest are what Bungie calls 'Shields' in-game. If you wish to display them separately, just subtract 70 from the numbers to get your shield HP.
     */
    Array: number[];
  };
  PvEDamageResistance: {
    Description: Description;
    /**
     * Array index represents the Resilience tier. The numbers represent the percentage damage resistance granted IN PVE at each tier.
     */
    Array: number[];
  };
  FlinchResistance: {
    Description: Description;
    /**
     * Array index represents the Resilience tier. The numbers represent the percentage flinch resistance granted at each tier.
     */
    Array: number[];
  };
}

export interface Recovery extends CharacterStatData {
  Description: Description;
  TotalRegenTime: {
    Description: Description;
    /**
     * Array index represents the Recovery tier. The numbers represent how many seconds it takes to heal from 0 to full HP. Rounding is not recommended.
     */
    Array: number[];
  };
  HealthRegenDelay: {
    Description: Description;
    /**
     * Array index represents the Recovery tier. The numbers representhow many seconds after taking damage Health Regeneration starts. Rounding is not recommended. Good to know: 'Health' is a fixed 70 HP portion of your Total HP alongside 'Shields' which are a 115-130 HP portion of Total HP determined by Resilience.
     */
    Array: number[];
  };
  HealthRegenSpeed: {
    Description: Description;
    /**
     * Array index represents the Recovery tier. The numbers represent how fast your 'Health' regens after the delay. The numbers are provided in % of total 'Health' per second (total 'Health' is a fixed 70HP). Rounding beyond 1-2 decimal places is not recommended. For all intents and purposes, you can divide the numbers by 100, multiply by 70, and display it as HP/second.
     */
    Array: number[];
  };
  ShieldRegenDelay: {
    Description: Description;
    /**
     * Array index represents the Recovery tier. The numbers represent how many seconds after taking damage Shield Regeneration starts. Rounding is not recommended. Good to know: Shield health is a 115-130 HP portion of Total HP and is determined by Resilience.
     */
    Array: number[];
  };
  ShieldRegenSpeed: {
    Description: Description;
    /**
     * Array index represents the Recovery tier. The numbers represent how fast your shields regen after the delay. The numbers are provided in % of total shield health per second (shield health is a 115-130 HP portion of Total HP and is determined by Resilience). Rounding beyond 1-2 decimal places is not recommended. For all intents and purposes, you can take the TotalHP value at a specified Resilience tier and subtract 70 to get the shield health. After that, you can divide the ShieldRegenSpeed numbers by 100, multiply it by the selected shield health, and display it as HP/second. (Though it's probably better to leave it in % to avoid potentially causing confusion for users)
     */
    Array: number[];
  };
}

export interface Intellect {
  Description: Description;
  SuperAbilities: SuperAbility[];
  Overrides: Override[];
}

export interface SuperAbility {
  /**
   * D2 Manifest inventoryItem hash
   */
  Hash: number;
  /**
   * For organization purposes only. Does not necessarily match the inventoryItem entry name from the D2 Manifest.
   */
  Name: string;
  /**
   * Array index represents the Intellect tier. Cooldowns are in seconds. Rounded to 2 decimal places. Note: Rounding to 2 decimal places is solely for improving math precision when combined with Override objects. When displaying these cooldown times, it is STRONGLY recommended to round them to an integer.
   *
   * @minItems 11
   * @maxItems 11
   */
  Cooldowns: [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number
  ];
}
