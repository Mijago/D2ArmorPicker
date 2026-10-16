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

import { Component, Input } from "@angular/core";
import { ChangelogService } from "../../../../services/changelog.service";
import { ChangelogEntryType, ChangelogEntry } from "../../../../data/changelog";

@Component({
  selector: "app-changelog-list",
  templateUrl: "./changelog-list.component.html",
  styleUrls: ["./changelog-list.component.scss"],
})
export class ChangelogListComponent {
  @Input() itemsToShow: number = -1; // -1 means show all items

  constructor(public changelog: ChangelogService) {}

  get displayedChangelogData() {
    if (this.itemsToShow === -1) {
      return this.changelog.changelogData;
    }
    return this.changelog.changelogData.slice(0, this.itemsToShow);
  }

  trackByVersion(index: number, item: any): string {
    return item.version;
  }

  trackByEntry(index: number, item: ChangelogEntry): string {
    return `${index}-${item.type}-${item.text.substring(0, 50)}`;
  }

  getEntryIcon(type: ChangelogEntryType): string {
    switch (type) {
      case ChangelogEntryType.ADD:
        return "add_circle";
      case ChangelogEntryType.REMOVE:
        return "remove_circle";
      case ChangelogEntryType.MODIFIED:
        return "edit";
      default:
        return "info";
    }
  }

  getIconClass(type: ChangelogEntryType): string {
    switch (type) {
      case ChangelogEntryType.ADD:
        return "icon-add";
      case ChangelogEntryType.REMOVE:
        return "icon-remove";
      case ChangelogEntryType.MODIFIED:
        return "icon-modified";
      default:
        return "icon-default";
    }
  }

  getEntryClass(type: ChangelogEntryType): string {
    switch (type) {
      case ChangelogEntryType.ADD:
        return "entry-add";
      case ChangelogEntryType.REMOVE:
        return "entry-remove";
      case ChangelogEntryType.MODIFIED:
        return "entry-modified";
      default:
        return "entry-default";
    }
  }

  getTooltipText(type: ChangelogEntryType): string {
    switch (type) {
      case ChangelogEntryType.ADD:
        return "New feature or addition";
      case ChangelogEntryType.REMOVE:
        return "Removed feature or functionality";
      case ChangelogEntryType.MODIFIED:
        return "Modified or improved feature";
      default:
        return "Changelog entry";
    }
  }
}
