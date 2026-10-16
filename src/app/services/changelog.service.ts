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

import { Injectable, OnDestroy } from "@angular/core";
import { CHANGELOG_DATA } from "../data/changelog";
import { ChangelogDialogComponent } from "../components/authenticated-v2/components/changelog-dialog/changelog-dialog.component";
import { MatDialog } from "@angular/material/dialog";
import { LoggingProxyService } from "./logging-proxy.service";

@Injectable({
  providedIn: "root",
})
export class ChangelogService implements OnDestroy {
  private hasCheckedForChangelog = false;

  constructor(
    public dialog: MatDialog,
    private logger: LoggingProxyService
  ) {
    this.logger.debug("ChangelogService", "constructor", "Initializing ChangelogService");
  }

  ngOnDestroy(): void {
    this.logger.debug("ChangelogService", "ngOnDestroy", "Destroying ChangelogService");
  }

  setChangelogSeenFlag() {
    return localStorage.setItem("d2ap-changelogVersion-lastRead", this.changelogData[0].version);
  }

  setlastWipeManifestVersion() {
    return localStorage.setItem(
      "d2ap-changelogVersion-lastWipeManifest",
      this.changelogData[0].version
    );
  }

  get lastWipeManifestVersion() {
    return localStorage.getItem("d2ap-changelogVersion-lastWipeManifest");
  }

  get lastViewedChangelog() {
    return localStorage.getItem("d2ap-changelogVersion-lastRead");
  }

  get mustShowChangelog() {
    return this.changelogData[0].version !== this.lastViewedChangelog;
  }

  get shouldWipeManifest() {
    return (
      (this.changelogData[0].clearManifest ?? false) &&
      this.changelogData[0].version !== this.lastWipeManifestVersion
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

  /**
   * Automatically shows the changelog dialog if needed.
   * Should be called once during app initialization.
   */
  checkAndShowChangelog() {
    if (!this.hasCheckedForChangelog && this.mustShowChangelog) {
      this.hasCheckedForChangelog = true;
      this.openChangelogDialog();
    }
  }
}
