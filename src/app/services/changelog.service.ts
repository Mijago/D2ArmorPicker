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

import { Injectable } from "@angular/core";
import { CHANGELOG_DATA } from "../data/changelog";
import { ChangelogDialogComponent } from "../components/authenticated-v2/components/changelog-dialog/changelog-dialog.component";
import { MatDialog } from "@angular/material/dialog";

@Injectable({
  providedIn: "root",
})
export class ChangelogService {
  constructor(public dialog: MatDialog) {}

  setChangelogSeenFlag() {
    return localStorage.setItem("last-changelog-version", this.changelogData[0].version);
  }

  get lastViewedChangelog() {
    return localStorage.getItem("last-changelog-version");
  }

  get mustShowChangelog() {
    return this.changelogData[0].version !== this.lastViewedChangelog;
  }

  get wipeManifest() {
    return (
      this.changelogData[0].version !== this.lastViewedChangelog &&
      (this.changelogData[0].clearManifest ?? false)
    );
  }

  get changelogData() {
    return CHANGELOG_DATA;
  }

  openChangelogDialog() {
    const dialogRef = this.dialog.open(ChangelogDialogComponent);
    dialogRef.afterClosed().subscribe((result) => {
      this.setChangelogSeenFlag();
    });
  }
}
