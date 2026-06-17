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

// NOTE: This module was extracted out of app.module.ts to break a circular import:
// membership.service.ts imported `identifyUserWithTracker` from app.module.ts, while
// app.module.ts imports AppComponent — causing a "Cannot access 'AppComponent' before
// initialization" TDZ crash when the (test) bundle is evaluated. This file has no
// dependency on app.module, so the cycle is gone.

import * as Sentry from "@sentry/angular";
import Tracker from "@openreplay/tracker";
import trackerAssist from "@openreplay/tracker-assist";
import { GroupUserInfoCard } from "bungie-api-ts/groupv2";
import { environment } from "../../environments/environment";

let openReplayTracker: Tracker;

export function identifyUserWithTracker(membershipData: GroupUserInfoCard | null) {
  try {
    openReplayTracker.setMetadata("version", `${environment.version}`);

    if (!membershipData) return;
    const identifier = `${membershipData.displayName}(I${membershipData.membershipId}T${membershipData.membershipType})`;

    openReplayTracker.identify(identifier);
    openReplayTracker.setMetadata(
      "bungieGlobalDisplayName",
      membershipData.bungieGlobalDisplayName
    );
    openReplayTracker.setMetadata(
      "bungieGlobalDisplayNameCode",
      (membershipData.bungieGlobalDisplayNameCode ?? -1).toString()
    );
    openReplayTracker.setMetadata("membershipType", membershipData.membershipType.toString());
    openReplayTracker.setMetadata(
      "applicableMembershipTypes",
      JSON.stringify(membershipData.applicableMembershipTypes)
    );

    // Identify user with Sentry
    Sentry.setUser({
      id: identifier,
      username: membershipData.displayName,
      email: membershipData.bungieGlobalDisplayName,
      extra: {
        membershipId: membershipData.membershipId,
        membershipType: membershipData.membershipType,
        bungieGlobalDisplayNameCode: membershipData.bungieGlobalDisplayNameCode ?? -1,
        applicableMembershipTypes: membershipData.applicableMembershipTypes,
        iconPath: membershipData.iconPath,
      },
    });
  } catch (err) {
    console.error("Error identifying user with tracker", err);
  }
}

try {
  openReplayTracker = new Tracker({
    projectKey: environment.open_replay_project_key,
  });

  openReplayTracker.start();
  const options = {};
  openReplayTracker.use(trackerAssist(options)); // check the list of available options below

  let membershipInfo: GroupUserInfoCard | null = JSON.parse(
    localStorage.getItem("user-membershipInfo") || "null"
  );
  if (membershipInfo) {
    console.log("Found cached membership info, using it to identify user in OpenReplay");
  }
  identifyUserWithTracker(membershipInfo);
} catch (e) {
  console.error("Failed to initialize OpenReplay tracker", e);
}
