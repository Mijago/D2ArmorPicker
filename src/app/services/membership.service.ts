import { Injectable, OnDestroy } from "@angular/core";
import {
  DestinyComponentType,
  getProfile,
  DestinyClass,
  BungieMembershipType,
} from "bungie-api-ts/destiny2";
import { AuthService } from "./auth.service";
import { GroupUserInfoCard } from "bungie-api-ts/groupv2";
import { getMembershipDataForCurrentUser } from "bungie-api-ts/user";
import { HttpClientService } from "./http-client.service";
import { StatusProviderService } from "./status-provider.service";
import { LoggingProxyService } from "./logging-proxy.service";
import { identifyUserWithTracker } from "../app.module";
// import { H } from "highlight.run";

@Injectable({
  providedIn: "root",
})
export class MembershipService implements OnDestroy {
  constructor(
    private http: HttpClientService,
    private status: StatusProviderService,
    private auth: AuthService,
    private logger: LoggingProxyService
  ) {
    this.logger.debug("MembershipService", "constructor", "Initializing MembershipService");
    this.auth.logoutEvent.subscribe((k) => this.clearCachedData());
  }

  ngOnDestroy(): void {
    this.logger.debug("MembershipService", "ngOnDestroy", "Destroying MembershipService");
  }

  private clearCachedData() {
    this.logger.debug("MembershipService", "clearCachedData", "Clearing cached membership data");
    localStorage.removeItem("user-membershipInfo");
    localStorage.removeItem("user-membershipInfo-lastDate");
  }

  async getMembershipDataForCurrentUser(): Promise<GroupUserInfoCard | undefined> {
    // check if user is authenticated before making the API call, if not, return undefined to avoid unnecessary API calls and errors
    if (!this.http.isAuthenticated()) {
      this.logger.warn(
        "MembershipService",
        "getMembershipDataForCurrentUser",
        "User is not authenticated"
      );
      return undefined;
    }
    var membershipData: GroupUserInfoCard = JSON.parse(
      localStorage.getItem("user-membershipInfo") || "null"
    );
    var membershipDataAge = JSON.parse(localStorage.getItem("user-membershipInfo-lastDate") || "0");
    if (membershipData && Date.now() - membershipDataAge < 1000 * 60 * 60 * 24) {
      identifyUserWithTracker(membershipData);

      return membershipData;
    }
    this.logger.info(
      "MembershipService",
      "getMembershipDataForCurrentUser",
      "Fetching membership data for current user"
    );
    let response = await getMembershipDataForCurrentUser((d) => this.http.$http(d, true));
    if (response) {
      let memberships = response?.Response.destinyMemberships;
      this.logger.info(
        "MembershipService",
        "getMembershipDataForCurrentUser",
        `Memberships: ${JSON.stringify(memberships)}`
      );
      memberships = memberships.filter(
        (m) =>
          (m.crossSaveOverride == 0 &&
            m.membershipType != BungieMembershipType.TigerStadia) /*stadia is dead, ignore it*/ ||
          m.crossSaveOverride == m.membershipType
      );
      this.logger.info(
        "MembershipService",
        "getMembershipDataForCurrentUser",
        `Filtered Memberships: ${JSON.stringify(memberships)}`
      );

      let result = null;
      if (memberships?.length == 1) {
        // This guardian only has one account linked, so we can proceed as normal
        result = memberships?.[0];
      } else {
        // This guardian has multiple accounts linked.
        // Fetch the last login time for each account, and use the one that was most recently used, default to primaryMembershipId
        let lastLoggedInProfileIndex: any = memberships.findIndex(
          (x) => x.membershipId == response?.Response.primaryMembershipId
        );
        let lastPlayed = 0;
        for (let id in memberships) {
          const membership = memberships?.[id];
          const profile = await getProfile((d) => this.http.$http(d, false), {
            components: [DestinyComponentType.Profiles],
            membershipType: membership.membershipType,
            destinyMembershipId: membership.membershipId,
          });
          if (!!profile && profile.Response?.profile.data?.dateLastPlayed) {
            let date = Date.parse(profile.Response?.profile.data?.dateLastPlayed);
            if (date > lastPlayed) {
              lastPlayed = date;
              lastLoggedInProfileIndex = id;
            }
          }
        }
        if (lastLoggedInProfileIndex < 0) {
          this.logger.error(
            "MembershipService",
            "getMembershipDataForCurrentUser",
            "PrimaryMembershipId was not found"
          );
          lastLoggedInProfileIndex = 0;
          this.status.setAuthError();
          //this.authService.logout();
        }
        result = memberships?.[lastLoggedInProfileIndex];
        this.logger.info(
          "MembershipService",
          "getMembershipDataForCurrentUser",
          "Selected membership data for the last logged in membership."
        );
      }

      localStorage.setItem("user-membershipInfo", JSON.stringify(result));
      localStorage.setItem("user-membershipInfo-lastDate", JSON.stringify(Date.now()));
      identifyUserWithTracker(result);
      return result;
    } else {
      this.logger.error(
        "MembershipService",
        "getMembershipDataForCurrentUser",
        "Failed to fetch membership data for current user"
      );
      if (!this.status.getStatus().apiError) this.status.setApiError();
      return undefined;
    }
  }

  async getCharacters() {
    let destinyMembership = await this.getMembershipDataForCurrentUser();
    if (!destinyMembership) {
      if (!this.status.getStatus().apiError) this.status.setApiError();
      return [];
    }
    this.status.clearAuthError();
    this.status.clearApiError();

    const profile = await getProfile((d) => this.http.$http(d, true), {
      components: [DestinyComponentType.Characters],
      membershipType: destinyMembership.membershipType,
      destinyMembershipId: destinyMembership.membershipId,
    });

    if (!!profile?.Response.characters.data) this.status.clearApiError();

    return (
      Object.values(profile?.Response.characters.data || {}).map((d) => {
        return {
          characterId: d.characterId,
          clazz: d.classType as DestinyClass,
          emblemUrl: d.emblemBackgroundPath,
          lastPlayed: Date.parse(d.dateLastPlayed),
        };
      }) || []
    );
  }
}
