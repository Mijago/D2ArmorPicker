import { Injectable } from "@angular/core";
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
import { NGXLogger } from "ngx-logger";
import { H } from "highlight.run";

@Injectable({
  providedIn: "root",
})
export class MembershipService {
  constructor(
    private http: HttpClientService,
    private status: StatusProviderService,
    private auth: AuthService,
    private logger: NGXLogger
  ) {
    this.auth.logoutEvent.subscribe((k) => this.clearCachedData());
  }

  private clearCachedData() {
    localStorage.removeItem("auth-membershipInfo");
    localStorage.removeItem("auth-membershipInfo-date");
  }

  async getMembershipDataForCurrentUser(): Promise<GroupUserInfoCard> {
    var membershipData: GroupUserInfoCard = JSON.parse(
      localStorage.getItem("auth-membershipInfo") || "null"
    );
    var membershipDataAge = JSON.parse(localStorage.getItem("auth-membershipInfo-date") || "0");
    if (membershipData && Date.now() - membershipDataAge < 1000 * 60 * 60 * 24) {
      H.identify(`I${membershipData.membershipId}T${membershipData.membershipType}`, {
        highlightDisplayName: `${membershipData.displayName}(I${membershipData.membershipId}T${membershipData.membershipType})`,
        avatar: `https://bungie.net${membershipData.iconPath}`,
        bungieGlobalDisplayName: membershipData.bungieGlobalDisplayName,
        bungieGlobalDisplayNameCode: membershipData.bungieGlobalDisplayNameCode ?? -1,
        membershipType: membershipData.membershipType,
        applicableMembershipTypes: JSON.stringify(membershipData.applicableMembershipTypes),
      });
      return membershipData;
    }

    this.logger.info(
      "MembershipService",
      "getMembershipDataForCurrentUser",
      "Fetching membership data for current user"
    );
    let response = await getMembershipDataForCurrentUser((d) => this.http.$http(d, true));
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

    localStorage.setItem("auth-membershipInfo", JSON.stringify(result));
    localStorage.setItem("auth-membershipInfo-date", JSON.stringify(Date.now()));
    H.identify(`I${result.membershipId}T${result.membershipType}`, {
      highlightDisplayName: `${result.displayName}(I${result.membershipId}T${result.membershipType})`,
      avatar: `https://bungie.net${result.iconPath}`,
      bungieGlobalDisplayName: result.bungieGlobalDisplayName,
      bungieGlobalDisplayNameCode: result.bungieGlobalDisplayNameCode ?? -1,
      membershipType: result.membershipType,
      applicableMembershipTypes: JSON.stringify(result.applicableMembershipTypes),
    });
    return result;
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
