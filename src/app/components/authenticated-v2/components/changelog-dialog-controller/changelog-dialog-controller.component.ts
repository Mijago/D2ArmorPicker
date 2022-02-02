import {AfterViewInit, Component, OnInit} from '@angular/core';
import {MatDialog} from "@angular/material/dialog";
import {ChangelogDialogComponent} from "../changelog-dialog/changelog-dialog.component";
import {ChangelogService} from "../../../../services/changelog.service";

@Component({
  selector: 'app-changelog-dialog-controller',
  templateUrl: './changelog-dialog-controller.component.html'
})
export class ChangelogDialogControllerComponent implements AfterViewInit {

  constructor(public dialog: MatDialog, public changelog: ChangelogService) {
  }

  openChangelogDialog() {
    const dialogRef = this.dialog.open(ChangelogDialogComponent);
    dialogRef.afterClosed().subscribe(result => {
      this.changelog.setChangelogSeenFlag()
    });
  }

  ngAfterViewInit(): void {
    if (this.changelog.mustShowChangelog)
      this.openChangelogDialog()
  }
}
