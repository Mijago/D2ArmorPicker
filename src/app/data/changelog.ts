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

export enum ChangelogEntryType {
  ADD,
  REMOVE,
  MODIFIED,
}

export interface ChangelogEntry {
  type: ChangelogEntryType;
  text: string;
  issues?: string[] | undefined;
}

export const CHANGELOG_DATA: {
  version: string;
  date: string;
  clearManifest?: boolean;
  entries: ChangelogEntry[];
}[] = [
  {
    version: "2.9.2",
    date: "July 18, 2025",
    clearManifest: true,
    entries: [
      {
        type: ChangelogEntryType.ADD,
        text: "Added the 'Gearset' armor to the Modslot selection. This allows you to buildcraft with them. I'll add a nicer UI later.",
        issues: [],
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added a button to import the currently equipped subclass and fragments.",
        issues: [],
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added a filter to disable legacy armor.",
        issues: [],
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added a button to import the currently equipped exotic.",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Updated the vendor API to support the new gearset armor perk.",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Improved visibility of the text input for the stats. It now has a border and is more visible.",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Minor bugfixes and performance improvements.",
        issues: [],
      },
    ],
  },
  {
    version: "2.9.1c",
    date: "July 16, 2025",
    clearManifest: true,
    entries: [
      {
        type: ChangelogEntryType.ADD,
        text: "Added a new Card-based view mode. You can switch between the Card view and the old Table view.",
        issues: [],
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Perk filter for exotic class items.",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Reworked the input to be a slider to allow for more precise input of the stats between tiers. Usability may be improved, feedback is welcome! You can click the text on the right to set the value manually.",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "The table now shows a 'Total' column instead of the 'Tiers' column.",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Renamed the stats.",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Reworked the Algorithm to select and utilize class items.",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Reworked the result table to correctly display the selected class item.",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Fixed the 'Move items to inventory' button. It still will only work when you have space in the inventory.",
        issues: [],
      },
      {
        type: ChangelogEntryType.REMOVE,
        text: "Removed 3x100 and 4x100 buttons. We do not need these anymore. Maybe I add another feature like this later when a use case arises.",
        issues: [],
      },
      {
        type: ChangelogEntryType.REMOVE,
        text: "Removed the setting to assume that all legendary class items are masterworked. This is included in the other masterwork assumption settings.",
        issues: [],
      },
      {
        type: ChangelogEntryType.REMOVE,
        text: "Removed the Wasted Stats column.",
        issues: [],
      },
      {
        type: ChangelogEntryType.REMOVE,
        text: "Removed now-invalid pages (Clustering, Theorizer, Investigator).",
        issues: [],
      },
      {
        type: ChangelogEntryType.REMOVE,
        text: "Removed old features that were not updated for a long time and are not used anymore.",
        issues: [],
      },
      {
        type: ChangelogEntryType.REMOVE,
        text: "Removed the feature 'Replace the tier selection with text fields for exact stat values', as this is now the default behavior.",
        issues: [],
      },
    ],
  },
  {
    version: "2.7.4",
    date: "March 15, 2025",
    clearManifest: false,
    entries: [
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Fixed parent vendor logic. (nznaza)",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Fixed order of exotics in armor selection to be alphabetical. (nznaza)",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Filter out vendor items that are reported by the API but can not be bought. (ciaran)",
        issues: [],
      },
    ],
  },
  {
    version: "2.7.3",
    date: "March 10, 2025",
    clearManifest: true,
    entries: [
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Added Overflowing Corruption as an armor perk option. (nznaza)",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Added None as an armor perk option. (nznaza)",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: 'Removed "Ignore artifice slot in exotics, as None armor perk filter" as None perk covers the same function. (nznaza)',
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Fixed exotic class item showing with incorrect armor perk. (nznaza)",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Changed query when opening DIM to be more precise. (nznaza)",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Fixed class item was not showing Armor Perk. (nznaza) Thanks Mojo",
        issues: [],
      },
    ],
  },
  {
    version: "2.7.2",
    date: "February 5, 2025",
    entries: [
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Hotfix for the invalid data the BungieAPI is returning after the most recent Update. Thanks nznaza for fixing it!",
        issues: [],
      },
    ],
  },
  {
    version: "2.7.1",
    date: "January 29, 2025",
    entries: [
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Some users could not log in properly due to crossplay issues. Thanks nznaza for fixing it!",
        issues: [],
      },
    ],
  },
  {
    version: "2.7.0",
    date: "December 09, 2024",
    entries: [
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Some UI reworks. Please give us feedback whether you like it or not, so we can improve it further! Thanks nznaza!",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Updated dependencies. Thanks nznaza!",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Added error tacking so that we can better identify and fix issues. Thanks nznaza!",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Fixes for the exotic class items and duplicate entries. Thanks nznaza!",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Many - AND I REALLY MEAN MANY - internal code optimizations, both structural and logically. Thanks nznaza (this guardian deserves a medal)!",
        issues: [],
      },
    ],
  },
  {
    version: "2.6.6",
    date: "November 9, 2024",
    entries: [
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Fixed an issue that lead to duplicated collection roll entries, thus drastically impacting the performance of the application.",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Fixed the artifice modslot for the new season. Again.",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "You will be logged when your auth token is invalid. We disabled this a while ago, but it is now re-enabled. Thanks to nznaza!",
        issues: [],
      },
    ],
  },
  {
    version: "2.6.5",
    date: "October 20, 2024",
    entries: [
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Added 'Eido's Apprentice Perk'.",
        issues: [],
      },
    ],
  },
  {
    version: "2.6.4",
    date: "July 30, 2024",
    entries: [
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Fixed an issue with the vendor api. Thanks to nznaza!",
        issues: [],
      },
    ],
  },
  {
    version: "2.6.3",
    date: "July 16, 2024",
    entries: [
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Minor bugfix for issues with the manifest retrieval. This should fix issues where the items or characters are not loading correctly.",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Updated the 'Download Results as JSON' button to reflect required changes for Final Shape.",
        issues: [],
      },
    ],
  },
  {
    version: "2.6.2",
    date: "July 7, 2024",
    entries: [
      {
        type: ChangelogEntryType.ADD,
        text: "Added option to ignore existing exotic artifice slots. This is useful for the exotic class item.",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Prismatic fragments are now correctly added to the DIM export.",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "The 'Ignored Items' section is now filtered by the selected class, grouped into armor slots and ordered by item type.",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Minor change for the vendor API handling. Thanks nznaza!",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Minor change for the manifest API handling.",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Mostly minor bugfixes and code improvements.",
        issues: [],
      },
    ],
  },
  {
    version: "2.6.1",
    date: "June 17, 2024",
    entries: [
      {
        type: ChangelogEntryType.ADD,
        text: "Add exotic class items.",
        issues: [],
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added Salvation's Edge Raid modslot and the Echoes of Glory perk.",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Changed the way minor mods are displayed. Minor mods are now 25% smaller.",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Corrected the description of Facet of Grace.",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Added Whisper of Torment, as it now has a -10 in Discipline.",
        issues: [],
      },
      {
        type: ChangelogEntryType.REMOVE,
        text: "Removed old armor modslots (and perks) that no longer exist or function.",
        issues: [],
      },
    ],
  },
  {
    version: "2.6.0",
    date: "June 4, 2024",
    entries: [
      {
        type: ChangelogEntryType.ADD,
        text: "Added prismatic fragments.",
        issues: [],
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added a progressbar that shows the progress of the calculation process.",
        issues: [],
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added an advanced setting to replace the stat selection boxes with text fields. While it does not look quite nice (as of now), it will allow you to select any value you want. Go get your 6x69 builds done (but don't forget, D2AP still does not add fragments by itself ....YET?!? BUT VERY SOON!)!",
        issues: [],
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added an 'Assume every exotic has an artifice slot' setting in preparation for the changes in the upcoming expansion. Real artifice exotics should work out-of-the-box at the first day of the expansion, BUT it may happen that I need to update some internal structures. Have fun exploring your options, though!",
        issues: [],
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added an 'Assume every legendary class item is an artifice armor' setting to allow finer control over the artifice armor assumption.",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "You will no longer be logged out when the API is offline. The app will use the last known data until the API is back online.",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Reworked how calculation workers are spawned, thus improving performance. Thanks to nznaza.",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Improved Mod optimisation, leading in drastically reduced runtime when paired with 'Add mods to reduce waste'.",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Improved 'Reduce Waste' optimisation. Smarter, better, faster, stronger.",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Changing the configuration during a running calculation now restarts the calculation process. Outdated results are a thing of the past!",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "The amount of workers is now variable and depends on the workload at hand. This should help the insane armor hoarders to reduce the calculation time.",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Prepared the vendor API for upcoming Bungie API changes. Thanks to nznaza.",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Added 'Exotic Cipher' to the resource overview and removed legendary shards.",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Modified the inventory update procedure to be more efficient. This may result in a few hiccups in the first stage - if you encounter any issues, please let me know!",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Vendor data is now updated asynchronously. This means that the page will load faster, but the vendor data may be outdated for a few seconds.",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "The progress notifications are now color-coded and on the right. If there are multiple notifications, then they are stacked.",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "The display of the used mods is now color-coded to make it easier to distinguish between the different mod types in a single glance.",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Locked locks are now red. Mainly because adisypher wouldn't stop asking.",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Minor bugfixes and performance optimisation.",
        issues: [],
      },
    ],
  },
  {
    version: "2.5.4",
    date: "April 10, 2024",
    entries: [
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Fixed a minor issue where the vendor api may be disabled and block the entire page.",
        issues: [],
      },
    ],
  },
  {
    version: "2.5.3",
    date: "April 5, 2024",
    entries: [
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Adapted the logic to parse the new Clarity data format. Thanks to ciarán!",
        issues: [],
      },
    ],
  },
  {
    version: "2.5.2",
    date: "November 29, 2023",
    entries: [
      {
        type: ChangelogEntryType.ADD,
        text: "Split the 'Assume all items are masterworked' switch into 'legendary' and 'exotic' switches. Thanks to Mojo!",
        issues: [],
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added the 'Ascendant Protector' Perk. Thanks to Mojo!",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Fixed artifice mods, again. Thanks to Mojo!",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Fixed 'Ghost Items' from the vendor import. Thanks to ciarán!",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Updated the values and descriptions for Subclass Fragments. Thanks to ciarán!",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Artifice Mods are now correctly added to the DIM export. Thanks to nznaza!",
        issues: [],
      },
    ],
  },
  {
    version: "2.5.1",
    date: "October 29, 2023",
    entries: [
      {
        type: ChangelogEntryType.ADD,
        text: "Added the 'Exhumed Excess' Perk. The modslot limitations are now ordered. Thanks to Mojo!",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Added a solution for the stat distances 63, 64 and 65. You probably won't ever see it, as this is 'five artifice and five major mods'.",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "'Fix wasted points' is now ignored for stats that are locked.",
        issues: [],
      },
    ],
  },
  {
    version: "2.5.0",
    date: "October 14, 2023",
    entries: [
      {
        type: ChangelogEntryType.ADD,
        text: "The stat cooldowns and values are now automatically updated from the Clarity database. Thanks to ciarán!",
        issues: [],
      },
      {
        type: ChangelogEntryType.ADD,
        text: "The new modslots/perks are now available in the dropdown.",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "The stat cooldowns now show icons. Thanks to ciarán!",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "The fragments now show their icons. Thanks to ciarán!",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Minor internal updates for DIM references. Thanks to bhollis!",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Improved the wasted stats selection, again!",
        issues: [],
      },
    ],
  },
  {
    version: "2.4.2",
    date: "July 11, 2023",
    entries: [
      {
        type: ChangelogEntryType.ADD,
        text: "Added the ability to use collection roll armor. This is disabled by default. Thanks to ciarán!",
        issues: [],
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added the ability to use vendor armor, including Xur. This is disabled by default. Thanks to ciarán!",
        issues: [],
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added the ability to select the optimisation strategy. You can now choose between 'Reduce waste', 'Reduce used mods' and 'Reduce used modslots'. The default is 'Reduce waste'.",
        issues: [],
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Re-added the reduce wasted stats feature. It is now disabled by default. It is a bit slower and not really necessary for most people.",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Zero Waste is no longer dependent on the 'Reduce wasted stats' setting. In fact, it practically overwrites it.",
        issues: [],
      },
      {
        type: ChangelogEntryType.REMOVE,
        text: "Removed the 'Extra optimisation steps' setting. It is now always enabled.",
        issues: [],
      },
    ],
  },
  {
    version: "2.4.0",
    date: "May 23, 2023",
    entries: [
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Rewrote the internal algorithm. It makes stuff faster and gives better results.",
        issues: [],
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added a 'Perform further optimisation' setting. This will give you better results, but it will take a bit longer.",
        issues: [],
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added Icons to the Stat Selection to make it easier to see which row is which perk.",
        issues: [],
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added button to download results as JSON.",
        issues: [],
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added Sonar Amplifier perk.",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Enabled Modslot limitation.",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Enabled the 3x100 and 4x100 buttons.",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Enabled Zero-Waste mode.",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Temporarily disabled 'Reduce Wasted Stats'. It will be back soon.",
        issues: [],
      },
    ],
  },
  {
    version: "2.3.2",
    date: "May 7, 2023",
    entries: [
      {
        type: ChangelogEntryType.ADD,
        text: "Feature: Added 'Guardian Games' class item type to the dropdown. ",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Reformatted every file in the codebase and improved the code workflow. You should not really see this on your end, but it will allow everyone to easily contribute to this open source project!",
        issues: [],
      },
    ],
  },
  {
    version: "2.3.1",
    date: "April 2, 2023",
    entries: [
      {
        type: ChangelogEntryType.ADD,
        text: "Feature: Added the possibility to only show builds that contain an exotic.",
        issues: [],
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added 'Root of Nightmares' modslot filter.",
        issues: [],
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added 'Queen's Favor' seasonal perk filter.",
        issues: [],
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added text indicating that only fragments that affect stats are shown.",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Fixed deprecated mods being sent when opening the loadout in DIM. Also adds artifice mods now.",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Fixed an issue where the tool did not put artifice mods on the class item if you forced the class item to be artifice.....",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Fixed an issue where the default selection was the titan class, even if you had no titan characters.",
        issues: [],
      },
    ],
  },
  {
    version: "2.3.0",
    date: "March 14, 2023",
    entries: [
      {
        type: ChangelogEntryType.ADD,
        text: "Automatically adds artifice mods to your armor. This replaces minor and major mods where possible.",
        issues: [],
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added the amount of used artifice mods to the result table overview (next to the mods). They are not calculated into the 'mod cost' column.",
        issues: [],
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added new fragments, including Strand.",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Adapted modslot cost of Resilience and Recovery mods.",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Introduced more modules for asynchronous loading. This is more a speed improvement than a feature.",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Reduced the maximum limit of reported results from 50,000 to 30,000. Note that D2AP still calculates every result, it just does not report them. This is a major speedup, and you usually should not even realize the change.",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Increased the visual contrast of major mods in the results table. This means it is now easier to distinguish major from minor mods.",
        issues: [],
      },
      {
        type: ChangelogEntryType.REMOVE,
        text: "Removed the elemental affinity completely.",
        issues: [],
      },
      {
        type: ChangelogEntryType.REMOVE,
        text: "DISABLED the 'Zero Waste' feature. It will be re-enabled in the future.",
        issues: [],
      },
      {
        type: ChangelogEntryType.REMOVE,
        text: "DISABLED the 'Modslot Limitation' feature. It will be re-enabled in the future.",
        issues: [],
      },
    ],
  },
  {
    version: "2.2.16",
    date: "December 7, 2022",
    entries: [
      {
        type: ChangelogEntryType.ADD,
        text: "Added Ember of Torches (with -10 Discipline).",
        issues: [],
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added Retrofit mods (mobility and resilience).",
        issues: [],
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added armor perk 'Seraph Sensor Array' to the dropdown.",
        issues: [],
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added a Game2Give message. Let's support the little lights together!",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Fixed artifice modslot.",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Membership data is cached longer to make things faster and to ease the Bungie API.",
        issues: [],
      },
    ],
  },
  {
    version: "2.2.15",
    date: "October 18, 2022",
    entries: [
      {
        type: ChangelogEntryType.ADD,
        text: "Added FOTL masks.",
        issues: [],
      },
    ],
  },
  {
    version: "2.2.13",
    date: "September 23, 2022",
    entries: [
      {
        type: ChangelogEntryType.ADD,
        text: "Added an advanced setting to replace the 'Tiers' column with a 'Max Tiers' column. This is adds the amount of open modslots to the column, but ignores mod limitations at the moment. A T32 build without mods will now show T37.",
        issues: [],
      },
    ],
  },
  {
    version: "2.2.12",
    date: "September 11, 2022",
    entries: [
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Changed the layout to force the settings (left) and results (right) to be next to each other. This means that the page is more mobile approachable. This is also the first step to a more flexible layout.",
        issues: [],
      },
    ],
  },
  {
    version: "2.2.11",
    date: "September 10, 2022",
    entries: [
      {
        type: ChangelogEntryType.ADD,
        text: "Added a display for your owned upgrade materials in the character overview.",
        issues: [],
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added a notification to warn you when you create a modslot limitation that yields no results. Note that this will not (yet) show invalid combinations over all armor, just for the given slot you selected it in.",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Reduced size of exotic icons so that the left side will not grow on Titan class.",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "The 'Performance Optimisation' settings will now always re-enable after a reload to prevent your browser being stuck in a crash-loop. (This is for you, iOS Safari users)",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Changed wording of the 'Performance Optimisation' setting to prevent people from using it incorrectly.",
        issues: [],
      },
    ],
  },
  {
    version: "2.2.10",
    date: "September 2, 2022",
    entries: [
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Updated Artifice Modslot Hash after the most recent hotfix.",
        issues: [],
      },
    ],
  },
  {
    version: "2.2.9",
    date: "September 1, 2022",
    entries: [
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Tooltips do now not obstruct the clicks of stats. This fixes the iOS stat selection issue.",
        issues: [],
      },
    ],
  },
  {
    version: "2.2.8c",
    date: "August 24, 2022",
    entries: [
      {
        type: ChangelogEntryType.MODIFIED,
        text: "The manifest is now (again) automatically updated on version changes. This fixes your artifice problems at the beginning of a new season.",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Added subclass hashes for Arc. This means that it now transfers to DIM.",
        issues: [],
      },
    ],
  },
  {
    version: "2.2.8b",
    date: "August 24, 2022",
    entries: [
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Fixed Artifice modslots. You might need to wait a bit, alternatively delete the database (Account section) or re-log.",
        issues: [],
      },
    ],
  },
  {
    version: "2.2.8a",
    date: "August 23, 2022",
    entries: [
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Updated grenade and melee cooldowns for arc.",
        issues: [],
      },
    ],
  },
  {
    version: "2.2.8",
    date: "August 23, 2022",
    entries: [
      {
        type: ChangelogEntryType.ADD,
        text: "Added Arc 3.0 fragments.",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Fixed tooltip issues on iOS devices.",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Fixed an infinite loading issue.",
        issues: [],
      },
    ],
  },
  {
    version: "2.2.7",
    date: "June 25, 2022",
    entries: [
      {
        type: ChangelogEntryType.ADD,
        text: "Added a link to my Discord bot Crayon.",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Fixed an issue where a large number of stored configurations would drastically slow down the app.",
        issues: [],
      },
    ],
  },
  {
    version: "2.2.6",
    date: "June 8, 2022",
    entries: [
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Fixed an issue where the elemental selection would not give the correct results under very specific conditions.",
        issues: [],
      },
    ],
  },
  {
    version: "2.2.5",
    date: "June 7, 2022",
    entries: [
      {
        type: ChangelogEntryType.ADD,
        text: "Added all of the new ability cooldowns.",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Completely reworked the ability cooldown tooltips. They now show the difference to the currently selected tier.",
        issues: [],
      },
    ],
  },
  {
    version: "2.2.4",
    date: "June 3, 2022",
    entries: [
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Fixed the export to DIM. Thanks to bhollis for the fix!",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "The manifest now automatically updates when Bungie updated it too, except just after a fixed timespan.",
        issues: [],
      },
    ],
  },
  {
    version: "2.2.3",
    date: "May 24, 2022",
    entries: [
      {
        type: ChangelogEntryType.ADD,
        text: "Added Solar 3.0",
        issues: [],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Adapted artifice armor to the new Season.",
        issues: [],
      },
    ],
  },
  {
    version: "2.2.2",
    date: "Mar 9, 2022",
    entries: [
      {
        type: ChangelogEntryType.ADD,
        text: "See what mods do by hovering over their name.",
        issues: ["D2AP-41"],
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added Vow of the Disciple armor.",
        issues: ["D2AP-35"],
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added 'Uniformed Officer' armor.",
        issues: ["D2AP-35"],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Fixed Scatter grenades being Tier 3 (were T4 before).",
        issues: ["D2AP-39"],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Changed the color of the login button.",
        issues: ["D2AP-37"],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "When a selected character class does not exist, the tool will now select the first available class as default.",
      },
    ],
  },
  {
    version: "2.2.1",
    date: "Feb 22, 2022",
    entries: [
      {
        type: ChangelogEntryType.ADD,
        text: "Added a switch to select between Stasis and Void 3.0 fragments. Stasis is enabled per default to ensure backwards compatibility of saved configurations.",
        issues: ["D2AP-10"],
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added a debug section to the (new) account settings page. The account settings page does not do much yet, I just wanted to deploy the debug functions.",
        issues: ["D2AP-23"],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Modified super cooldowns for Witch Queen.",
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Added a minor text to the exotic overview that explains that exotics not in the inventory are shown in grayscale. You can also no longer select those.",
        issues: ["D2AP-17"],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Minor changes in how the database behaves on logout. It now deletes the inventory when you log out, but still keeps the manifest.",
        issues: ["D2AP-27"],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Users are now logged out when the Bungie.Net API is down.",
        issues: ["D2AP-34"],
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Fixed Charge Harvester and Echo of Persistence incorrectly reducing Discipline instead of recovery when used on a Warlock.",
      },
    ],
  },
  {
    version: "2.2.0",
    date: "Feb 09, 2022",
    entries: [
      {
        type: ChangelogEntryType.ADD,
        text: "Added the ability to select armor perks and 5th slots. Just like the elements you can optionally enforce it to be on a certain slot. Useful if you want to build Iron Banner armor or utilize artifice modslots.",
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added the ability to limit the available points on each armor item for stat mods. This allows you to limit the kind of stat mods that are usable. You can now say 'do not use major intellect mods'.",
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added the ability to lock stat tiers. Previously you could only set 'Use Tier 3 or higher', now you can optionally set 'Enforce Tier 3'. This is useful for example if you want to enforce T3 mobility on a Titan.",
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added a summary of important configuration choices to the result header to improve readability.",
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added a button to open the DIM Loadout Builder with the current settings.",
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added an option that forces the correct element on non-masterworked armor pieces. This is per default enabled.",
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added cooldowns for class abilities (Dodge, Barricade, Rift).",
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added visual indicators for minor and major mods in the overview table. The whole visualization is also more compact now.",
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added visual cursor indicator to every clickable input, e.g. in the exotic, element and perk/mod selection.",
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added a (very basic) item tooltip.",
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Show the required material cost for each item. Note that this ignores your class item.",
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added a stat summary table to the stat detail view. This allows you to easily share a stat distribution with others.",
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added 'Clear this section' button to each configuration section.",
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added support for your class items. You won't see a lot of this, except when you use the slot and element limitation in specific ways.",
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Detailed information is now in expandable containers to improve readability.",
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Show the seasonal icon for every item too.",
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added info text to the table headers.",
      },
      {
        type: ChangelogEntryType.ADD,
        text: "The character selection now shows the existing characters - and their emblems too!",
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added Discord and another Ko-Fi link. You can find them in the character selection.",
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added a changelog popup right at the start of the page. It only appears when a new update occured. You can always trigger it by clicking the current version number.",
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Now utilizes three webworkers instead of one. The process is simple, but generally speeds up the results by a huge margin.",
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added an Armor Investigation tab for data scientists.",
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added a sidenav for smaller devices and reworked the top menubar.",
      },
      {
        type: ChangelogEntryType.ADD,
        text: "The detailed result table now shows the perk of an selected item, if it has one. This also applies to class items, if necessary.",
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Hovering over exotics in the exotic selection now displays their perk description.",
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added an advanced setting to disable white, green and blue armor.",
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added an advanced setting to ignore sunset armor.",
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Changed the word 'Permutation' to 'Combination' wherever it has been used.",
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Clicking on a setting that is already set does not re-trigger the calculation now. For example, selecting T3 recovery when it is already at T3 now does nothing.",
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "The default for all stats is now tier 0 instead of tier 1, to make it consistent with the clear buttons.",
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "The default setting for 'ignore non masterworked elements' is now 'off'.",
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "The 'time required' number now measures the time from before the webworkers are spawned until all webworkers are done. Previously it only monitored the time required INSIDE the webworker, so it may show slower times.",
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Fixed the width of the 'Exotic' header in the results table. This means that it is now farther away from the 'Mobility' column.",
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Completely reworked the elemental affinity selection. Per default it is now not fixed to a certain armor slot, but using a toggle button you can simply do so again.",
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "The results header now screams at you in bright red letters when no results are found.",
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "The alternating rows of the results details table have now a lighter color to make it easier to read.",
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Fixed ability cooldowns for melee and grenade at tier 7 and tier 8.",
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Cooldowns now are shown in MM:SS instead of plain seconds.",
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Completely rewrote the core logic of D2ArmorPicker for the changes mentioned above.",
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Exotics you do not have in your vault or inventory are now greyed out.",
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Fixed an issue where exotics were not shown at your first login.",
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Changed the color of important buttons so that they are easier to read.",
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "The icons of items in the results are now loaded asynchronous from their hashes. This saves a lot of memory, as I do not have to send two icon URLs for each item - for each result. I will further improve this in a later version.",
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Maximum table output is now limited to 50 results (instead of 200). It still defaults to 20.}",
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Completely reworked the visuals of the changelog. It is now more pleasing to the eye.",
      },
    ] as ChangelogEntry[],
  },
  {
    version: "2.1.4",
    date: "Dec 29, 2021",
    entries: [
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Item stats are now built from their plugs and InvestmentStats (in case of some exotics). This fixes potentially invalid item stats when you use mods like Powerful Friends or Protective Light. A big thanks to u/deangaudet for reminding me that the API also reports the plugs of an item.",
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Only save necessary item types of the manifest (namely mods and armor). Also, save twhe investmentStats now.",
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Sped up the item update step.",
      },
    ],
  },
  {
    version: "2.1.3",
    date: "Dec 16, 2021",
    entries: [
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Added new stat cooldowns",
      },
    ],
  },
  {
    version: "2.1.2",
    date: "Dec 1, 2021",
    entries: [
      {
        type: ChangelogEntryType.MODIFIED,
        text: "The changelog is now in a scrollable box.",
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Changed buymeacoffee to a ko-fi link. This way we can keep the PayPal support!",
      },
    ],
  },
  {
    version: "2.1.1",
    date: "Nov 3, 2021",
    entries: [
      {
        type: ChangelogEntryType.REMOVE,
        text: "Removed the HALLOWEEN SPECIAL feature. Maybe something like this will return some day?",
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added tooltip to the item icons in the detailed overview to show the name of the item.",
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Fixed an issue where the list of exotics did not load at the first login.",
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Saved configurations now contain the current software version for future reference.",
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Minor code quality improvements",
      },
    ],
  },
  {
    version: "2.1.0 (major)",
    date: "Oct 29, 2021",
    entries: [
      {
        type: ChangelogEntryType.REMOVE,
        text: "Completely removed V1 of the tool. If you had any problems with V2, you had over three months to report them.",
      },
      {
        type: ChangelogEntryType.ADD,
        text: "The stat selection now displays which stat tiers are added by stat mods (PF/RL) or stasis fragments in the configuration.",
      },
      {
        type: ChangelogEntryType.ADD,
        text: "You can now export (and import) individual configurations as well as all stored configurations at once.",
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added a navigation bar to the title bar. On smaller screens it is replaced by two buttons in the character selection.",
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added more details to the last step of the 'What to do now?' section. It now lists the fragments and mods you selected.",
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Optimized code and reduced overall page size.",
      },
    ],
  },
  {
    version: "2.0.16",
    date: "Oct 26, 2021",
    entries: [
      {
        type: ChangelogEntryType.MODIFIED,
        text:
          "Completely rewrote the core logic in order to fix the memory issues. " +
          "The tool will now no longer crash when you have many armor items, but it's slightly slower than the previous approach. " +
          "I tested it with 600 items - it works and does not crash, but takes up to a minute. " +
          "Make sure to never get that much armor and to lock an exotic right away.",
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "The rewrite also fixed the issue where the tool did not work in Safari, or more generally, on Mac and iPhone.",
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "The rewrite also fixed an issue where items could not be found when an result update was triggered while the inventory was updated.",
      },
    ],
  },
  {
    version: "2.0.15",
    date: "Oct 24, 2021",
    entries: [
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Updated the visual display of the cluster page. It displays the stats in a better way now.",
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Fixed an issue with login, where you were automatically logged in again and could not switch accounts.",
      },
    ],
  },
  {
    version: "2.0.14",
    date: "Oct 21, 2021",
    entries: [
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Updated URLs to the mobility, resilience and recovery images, as Bungie decided to change their URLs in today's hotfix.",
      },
    ],
  },
  {
    version: "2.0.13",
    date: "Oct 20, 2021",
    entries: [
      {
        type: ChangelogEntryType.ADD,
        text: "Added a chart to the armor clustering page, showing each clusters average stats.",
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Stats over 100 are now seen as wasted.",
      },
    ],
  },
  {
    version: "2.0.12",
    date: "Oct 18, 2021",
    entries: [
      {
        type: ChangelogEntryType.ADD,
        text: "Added an experimental armor clustering feature.",
      },
    ],
  },
  {
    version: "2.0.11",
    date: "Oct 13, 2021",
    entries: [
      {
        type: ChangelogEntryType.ADD,
        text: "HALLOWEEN SPECIAL! Added (temporary) filter for halloween masks! This will be removed after the event.",
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Fix: Clear the results if you switch character and no possible permutations can be found.",
      },
    ],
  },
  {
    version: "2.0.10",
    date: "Oct 10, 2021",
    entries: [
      {
        type: ChangelogEntryType.ADD,
        text: "Added 'Equip Items' button to the detailed item overview.",
      },
    ],
  },
  {
    version: "2.0.9",
    date: "Oct 6, 2021",
    entries: [
      {
        type: ChangelogEntryType.ADD,
        text: "Added a detailed description of the steps required to build a selected result.",
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added a button to disable all four armor pieces at once.",
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Fixed an issue where the permutations were not updated after 'Ignore armor elemental affinities on masterworked armor' was changed.",
      },
    ],
  },
  {
    version: "2.0.8",
    date: "Oct 5, 2021",
    entries: [
      {
        type: ChangelogEntryType.ADD,
        text: "Added this changelog to the help page.",
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added 'Move to Inventory' button (beta).",
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Split up 'Assume items are masterworked' into three settings: Class Items, Legendaries, Exotics",
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "'Try to optimize wasted stats' is now active per default.",
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Introduced an item buffer in the results component to further reduce memory usage.",
      },
    ],
  },
];
