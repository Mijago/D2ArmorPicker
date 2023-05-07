import { Component, OnInit } from "@angular/core";
import { CHANGELOG_DATA } from "../../../../data/changelog";

@Component({
  selector: "app-help-page",
  templateUrl: "./help-page.component.html",
  styleUrls: ["./help-page.component.css"],
})
export class HelpPageComponent {
  knownIssues: string[] = [
    "When you click buttons on the page too fast are able to select an invalid state with no results. Just undo your changed settings. And be patient - the calculation is an expensive task.",
    "Sometimes duplicate results are given. This happens when the inventory got updated twice (Race Condition). Only reported once, and not really a problem.",
  ];

  changelog = CHANGELOG_DATA;

  constructor() {}
}
