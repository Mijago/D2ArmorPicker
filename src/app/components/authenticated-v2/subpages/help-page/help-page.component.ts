import {Component, OnInit} from '@angular/core';

@Component({
  selector: 'app-help-page',
  templateUrl: './help-page.component.html',
  styleUrls: ['./help-page.component.css']
})
export class HelpPageComponent implements OnInit {
  knownIssues: string[] = [
    "If an armor has less than 10 total in one stat and has a negative modifier (goes below 0), the API caps the item stat at 0, leading to the tool thinking it's at 10 (or 8, if masterworked).",
    "The point above is also true for values above 42.",
  ]

  changelog = [
    {
      version: "2.0.8",
      date: "Oct 5, 2021",
      entries: [
        "Added this changelog to the help page",
        "Added 'Move to Inventory' button (beta)",
        "Introduced an item buffer in the results component to further reduce memory usage",
        "Split up 'Assume items are masterworked' into three settings: Class Items, Legendaries, Exotics",
      ]
    },
  ]

  constructor() {
  }

  ngOnInit(): void {
  }

}
