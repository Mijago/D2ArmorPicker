import { Injectable } from '@angular/core';
import {CHANGELOG_DATA} from "../data/changelog";

@Injectable({
  providedIn: 'root'
})
export class ChangelogService {

  constructor() { }

  setChangelogSeenFlag() {
    return localStorage.setItem("last-changelog-version", this.changelogData[0].version)
  }

  get lastViewedChangelog() {
    return localStorage.getItem("last-changelog-version")
  }

  get mustShowChangelog() {
    return this.changelogData[0].version !== this.lastViewedChangelog
  }

  get changelogData() {
    return CHANGELOG_DATA;
  }
}
