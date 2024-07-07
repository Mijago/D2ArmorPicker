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

import { Component } from "@angular/core";
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
