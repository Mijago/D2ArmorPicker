export enum ChangelogEntryType {
  ADD,
  REMOVE,
  MODIFIED
}

export interface ChangelogEntry {
  type: ChangelogEntryType;
  text: string;
}

export const CHANGELOG_DATA = [
  {
    version: "2.2.0",
    date: "[some day in the future]",
    entries: [
      // "+ Hotswapping! Added the ability to select two exotics. The tool then gives you a build with both exotics that you can just hotswap, while still having the same base stat selection. It also adds legendaries if the exotics are not in the same slot. Note that the quality of the results HEAVILY varies the less similar your exotics are rolled.",
      // "+ Added a filter for the minimum amount of tiers on a build. You can now say 'Give me only builds with at least 35 tiers'.",  // todo
      // "+ Added an option to ignore sunset armor.", // todo
      // "~ Improved help texts of advanced settings.", // TODO; Feedback source https://www.reddit.com/r/DestinyTheGame/comments/rxikvo/how_to_minimize_wasted_stat_points_in_your_build/hrj7141/?utm_source=reddit&utm_medium=web2x&context=3
      {
        type: ChangelogEntryType.ADD,
        text: "Added the ability to select armor perks and 5th slots. Just like the elements you can optionally enforce it to be on a certain slot. Useful if you want to build Iron Banner armor or utilize artificer modslots."
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added the ability to limit the available points on each armor item for stat mods. This allows you to limit the kind of stat mods that are usable. You can now say 'do not use major intellect mods'."
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added the ability to lock stat tiers. Previously you could only set 'Use Tier 3 or higher', now you can optionally set 'Enforce Tier 3'. This is useful for example if you want to enforce T3 mobility on a Titan."
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added a summary of important configuration choices to the result header to improve readability."
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added a button to open the DIM Loadout Builder with the current settings."
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added an option that forces the correct element on non-masterworked armor pieces."
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added cooldowns for class abilities (Dodge, Barricade, Rift)."
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added visual indicators for minor and major mods in the overview table. They are simply shown as smaller icons."
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added visual cursor indicator to every clickable input, e.g. in the exotic, element and perk/mod selection."
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added a (very basic) item tooltip."
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added a stat summary table to the stat detail view. This allows you to easily share a stat distribution with others."
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added 'Clear this section' button to each configuration section."
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added support for your class items. You won't see a lot of this, except when you use the slot and element limitation in specific ways."
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Detailed information is now in expandable containers to improve readability."
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Show the seasonal icon for every item too."
      },
      {
        type: ChangelogEntryType.ADD,
        text: "The stat values of masterworked items in the result table are now shown in a light yellow."
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added info text to the table headers."
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added Discord and another Ko-Fi link. You can find them in the Character selection."
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added a changelog popup right at the start of the page. It only appears when a new update occured. You can always trigger it by clicking the current version number."
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Now utilizes three webworkers instead of one. The process is simple, but generally speeds up the results by a huge margin."
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Clicking on a setting that is already set does not re-trigger the calculation now. For example, selecting T3 recovery when it is already at T3 now does nothing."
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "The 'time required' number now measures the time from before the webworkers are spawned until all webworkers are done. Previously it only monitored the time required INSIDE the webworker, so it may show slower times."
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Fixed the width of the 'Exotic' header in the results table. This means that it is now farther away from the 'Mobility' column."
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Completely reworked the elemental affinity selection. Per default it is now not fixed to a certain armor slot, but using a toggle button you can simply do so again."
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "The results header now screams at you in bright red letters when no results are found."
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "The alternating rows of the results details table have now a lighter color to make it easier to read."
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Fixed ability cooldowns for melee and grenade at tier 7 and tier 8."
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Cooldowns now are shown in MM:SS instead of plain seconds."
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Completely rewrote the core logic of D2ArmorPicker for the changes mentioned above."
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Only show exotics that you have in the inventory or vault."
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Fixed an issue where exotics were not shown at your first login."
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Changed the color of important buttons so that they are easier to read."
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "The icons of items in the results are now loaded asynchronous from their hashes. This saves a lot of memory, as I do not have to send two icon URLs for each item - for each result. I will further improve this in a later version."
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Maximum table output is now limited to 50 results (instead of 200). It still defaults to 20.}"
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Completely reworked the visuals of the changelog. It is now more pleasing to the eye."
      },
    ] as ChangelogEntry[]
  },
  {
    version: "2.1.4",
    date: "Dec 29, 2021",
    entries: [
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Item stats are now built from their plugs and InvestmentStats (in case of some exotics). This fixes potentially invalid item stats when you use mods like Powerful Friends or Protective Light. A big thanks to u/deangaudet for reminding me that the API also reports the plugs of an item."
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Only save necessary item types of the manifest (namely mods and armor). Also, save twhe investmentStats now."
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Sped up the item update step."
      },
    ]
  },
  {
    version: "2.1.3",
    date: "Dec 16, 2021",
    entries: [
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Added new stat cooldowns"
      },
    ]
  },
  {
    version: "2.1.2",
    date: "Dec 1, 2021",
    entries: [
      {
        type: ChangelogEntryType.MODIFIED,
        text: "The changelog is now in a scrollable box."
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Changed buymeacoffee to a ko-fi link. This way we can keep the PayPal support!"
      },
    ]
  },
  {
    version: "2.1.1",
    date: "Nov 3, 2021",
    entries: [
      {
        type: ChangelogEntryType.REMOVE,
        text: "Removed the HALLOWEEN SPECIAL feature. Maybe something like this will return some day?"
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added tooltip to the item icons in the detailed overview to show the name of the item."
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Fixed an issue where the list of exotics did not load at the first login."
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Saved configurations now contain the current software version for future reference."
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Minor code quality improvements"
      },
    ]
  },
  {
    version: "2.1.0 (major)",
    date: "Oct 29, 2021",
    entries: [
      {
        type: ChangelogEntryType.REMOVE,
        text: "Completely removed V1 of the tool. If you had any problems with V2, you had over three months to report them."
      },
      {
        type: ChangelogEntryType.ADD,
        text: "The stat selection now displays which stat tiers are added by stat mods (PF/RL) or stasis fragments in the configuration."
      },
      {
        type: ChangelogEntryType.ADD,
        text: "You can now export (and import) individual configurations as well as all stored configurations at once."
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added a navigation bar to the title bar. On smaller screens it is replaced by two buttons in the character selection."
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added more details to the last step of the 'What to do now?' section. It now lists the fragments and mods you selected."
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Optimized code and reduced overall page size."
      }
    ]
  },
  {
    version: "2.0.16",
    date: "Oct 26, 2021",
    entries: [
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Completely rewrote the core logic in order to fix the memory issues. " +
          "The tool will now no longer crash when you have many armor items, but it's slightly slower than the previous approach. " +
          "I tested it with 600 items - it works and does not crash, but takes up to a minute. " +
          "Make sure to never get that much armor and to lock an exotic right away."
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "The rewrite also fixed the issue where the tool did not work in Safari, or more generally, on Mac and iPhone."
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "The rewrite also fixed an issue where items could not be found when an result update was triggered while the inventory was updated."
      }
    ]
  },
  {
    version: "2.0.15",
    date: "Oct 24, 2021",
    entries: [
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Updated the visual display of the cluster page. It displays the stats in a better way now."
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Fixed an issue with login, where you were automatically logged in again and could not switch accounts."
      }
    ]
  },
  {
    version: "2.0.14",
    date: "Oct 21, 2021",
    entries: [
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Updated URLs to the mobility, resilience and recovery images, as Bungie decided to change their URLs in today's hotfix."
      }
    ]
  },
  {
    version: "2.0.13",
    date: "Oct 20, 2021",
    entries: [
      {
        type: ChangelogEntryType.ADD,
        text: "Added a chart to the armor clustering page, showing each clusters average stats."
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Stats over 100 are now seen as wasted."
      }
    ]
  },
  {
    version: "2.0.12",
    date: "Oct 18, 2021",
    entries: [
      {
        type: ChangelogEntryType.ADD,
        text: "Added an experimental armor clustering feature."
      }
    ]
  },
  {
    version: "2.0.11",
    date: "Oct 13, 2021",
    entries: [
      {
        type: ChangelogEntryType.ADD,
        text: "HALLOWEEN SPECIAL! Added (temporary) filter for halloween masks! This will be removed after the event."
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Fix: Clear the results if you switch character and no possible permutations can be found."
      }
    ]
  },
  {
    version: "2.0.10",
    date: "Oct 10, 2021",
    entries: [
      {
        type: ChangelogEntryType.ADD,
        text: "Added 'Equip Items' button to the detailed item overview."
      }
    ]
  },
  {
    version: "2.0.9",
    date: "Oct 6, 2021",
    entries: [
      {
        type: ChangelogEntryType.ADD,
        text: "Added a detailed description of the steps required to build a selected result."
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added a button to disable all four armor pieces at once."
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Fixed an issue where the permutations were not updated after 'Ignore armor elemental affinities on masterworked armor' was changed."
      }
    ]
  },
  {
    version: "2.0.8",
    date: "Oct 5, 2021",
    entries: [
      {
        type: ChangelogEntryType.ADD,
        text: "Added this changelog to the help page."
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Added 'Move to Inventory' button (beta)."
      },
      {
        type: ChangelogEntryType.ADD,
        text: "Split up 'Assume items are masterworked' into three settings: Class Items, Legendaries, Exotics"
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "'Try to optimize wasted stats' is now active per default."
      },
      {
        type: ChangelogEntryType.MODIFIED,
        text: "Introduced an item buffer in the results component to further reduce memory usage."
      },
    ]
  },
]
