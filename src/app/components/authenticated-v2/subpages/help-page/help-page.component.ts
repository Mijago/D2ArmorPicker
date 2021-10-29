import {Component, OnInit} from '@angular/core';

@Component({
  selector: 'app-help-page',
  templateUrl: './help-page.component.html',
  styleUrls: ['./help-page.component.css']
})
export class HelpPageComponent implements OnInit {
  knownIssues: string[] = [
    "If an armor has less than 10 total in one stat and has a negative modifier (goes below 0), the API caps the item stat at 0, leading to the tool thinking it's at 10 (or 8, if masterworked).",
    "The point above is also true for values above 42."
  ]

  changelog = [
    {
      version: "2.1.0 (major)",
      date: "Oct 29, 2021",
      entries: [
        "- Completely removed V1 of the tool. If you had any problems with V2, you had over three months to report them.",
        "+ The stat selection now displays which stat tiers are added by stat mods (PF/RL) or stasis fragments in the configuration.",
        "+ You can now export (and import) individual configurations as well as all stored configurations at once.",
        "+ Added a navigation bar to the title bar. On smaller screens it is replaced by two buttons in the character selection.",
        "+ Added more details to the last step of the 'What to do now?' section. It now lists the fragments and mods you selected.",
        "~ Optimized code and reduced overall page size."
      ]
    },
    {
      version: "2.0.16",
      date: "Oct 26, 2021",
      entries: [
        "~ Completely rewrote the core logic in order to fix the memory issues. " +
        "The tool will now no longer crash when you have many armor items, but it's slightly slower than the previous approach. " +
        "I tested it with 600 items - it works and does not crash, but takes up to a minute. " +
        "Make sure to never get that much armor and to lock an exotic right away.",
        "~ The rewrite also fixed the issue where the tool did not work in Safari, or more generally, on Mac and iPhone.",
        "~ The rewrite also fixed an issue where items could not be found when an result update was triggered while the inventory was updated."
      ]
    },
    {
      version: "2.0.15",
      date: "Oct 24, 2021",
      entries: [
        "~ Updated the visual display of the cluster page. It displays the stats in a better way now.",
        "~ Fixed an issue with login, where you were automatically logged in again and could not switch accounts."
      ]
    },
    {
      version: "2.0.14",
      date: "Oct 21, 2021",
      entries: [
        "~ Updated URLs to the mobility, resilience and recovery images, as Bungie decided to change their URLs in today's hotfix."
      ]
    },
    {
      version: "2.0.13",
      date: "Oct 20, 2021",
      entries: [
        "+ Added a chart to the armor clustering page, showing each clusters average stats.",
        "~ Stats over 100 are now seen as wasted."
      ]
    },
    {
      version: "2.0.12",
      date: "Oct 18, 2021",
      entries: [
        "+ Added a experimental armor clustering feature."
      ]
    },
    {
      version: "2.0.11",
      date: "Oct 13, 2021",
      entries: [
        "+ HALLOWEEN SPECIAL! Added (temporary) filter for halloween masks! This will be removed after the event.",
        "~ Fix: Clear the results if you switch character and no possible permutations can be found."
      ]
    },
    {
      version: "2.0.10",
      date: "Oct 10, 2021",
      entries: [
        "+ Added 'Equip Items' button to the detailed item overview."
      ]
    },
    {
      version: "2.0.9",
      date: "Oct 6, 2021",
      entries: [
        "+ Added a detailed description of the steps required to build a selected result.",
        "+ Added a button to disable all four armor pieces at once.",
        "~ Fixed an issue where the permutations were not updated after 'Ignore armor elemental affinities on masterworked armor' was changed."
      ]
    },
    {
      version: "2.0.8",
      date: "Oct 5, 2021",
      entries: [
        "+ Added this changelog to the help page.",
        "+ Added 'Move to Inventory' button (beta).",
        "+ Split up 'Assume items are masterworked' into three settings: Class Items, Legendaries, Exotics",
        "~'Try to optimize wasted stats' is now active per default.",
        "~ Introduced an item buffer in the results component to further reduce memory usage.",
      ]
    },
  ]

  constructor() {
  }

  ngOnInit(): void {
  }

}
