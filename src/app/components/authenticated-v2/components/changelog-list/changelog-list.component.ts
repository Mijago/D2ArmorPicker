import {Component, OnInit} from '@angular/core';
import {ChangelogService} from "../../../../services/changelog.service";

@Component({
  selector: 'app-changelog-list',
  templateUrl: './changelog-list.component.html',
  styleUrls: ['./changelog-list.component.scss']
})
export class ChangelogListComponent {

  constructor(public changelog: ChangelogService) {
  }


}
