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
