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

import { Component, OnInit } from "@angular/core";
import { ChangelogService } from "../../../../services/changelog.service";

@Component({
  selector: "app-changelog-dialog",
  templateUrl: "./changelog-dialog.component.html",
  styleUrls: ["./changelog-dialog.component.css"],
})
export class ChangelogDialogComponent implements OnInit {
  showChangelogList = false;
  changelogItemsToShow = 5; // Initially show only the first five items

  constructor(public changelog: ChangelogService) {}

  ngOnInit() {
    if (this.isIOS()) {
      // Show first items immediately, then all items after delay
      this.showChangelogList = true;
      // Delay loading all changelog items by 10 seconds on iOS because WebKit is stinky and it crashes for no good reason
      // (The reason appears to add too much junk from the manifest and the large DOM from the changelog list, but it's hard to be sure)
      // I could diagnose it better if WebKit had any sort of decent debugging tools, but it doesn't, so this is the best workaround I can come up with
      // Yes, I'm a bit angry :madcat:, I refactored too much shit, which was good, but unnecessary
      setTimeout(() => {
        this.changelogItemsToShow = -1; // Show all items
      }, 10000);
      // turns out for some devices was the large manifest, still, only show a few items to avoid issues because changelog is getting chonkier
    } else {
      // Show all items immediately on non-iOS devices
      this.showChangelogList = true;
      this.changelogItemsToShow = -1;
    }
  }

  private isIOS(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  }
}
