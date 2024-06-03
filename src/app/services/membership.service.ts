import { Injectable } from "@angular/core";
import { DestinyComponentType, getProfile, DestinyClass } from "bungie-api-ts/destiny2";
import { AuthService } from "./auth.service";
import { GroupUserInfoCard } from "bungie-api-ts/groupv2";
import { getMembershipDataForCurrentUser } from "bungie-api-ts/user";
import { HttpClientService } from "./http-client.service";
import { StatusProviderService } from "./status-provider.service";

@Injectable({
  providedIn: "root",
})
export class MembershipService {
  constructor(private http: HttpClientService, private status: StatusProviderService) {}

  async getMembershipDataForCurrentUser(): Promise<GroupUserInfoCard> {
    var membershipData = JSON.parse(localStorage.getItem("auth-membershipInfo") || "null");
    var membershipDataAge = JSON.parse(localStorage.getItem("auth-membershipInfo-date") || "0");
    if (membershipData && Date.now() - membershipDataAge < 1000 * 60 * 60 * 24) {
      console.log("getMembershipDataForCurrentUser -> loading cached! ");
      return membershipData;
    }

    console.info("BungieApiService", "getMembershipDataForCurrentUser");
    let response = await getMembershipDataForCurrentUser((d) => this.http.$http(d));
    let memberships = response?.Response.destinyMemberships;
    console.info("Memberships:", memberships);
    memberships = memberships.filter(
      (m) => m.crossSaveOverride == 0 || m.crossSaveOverride == m.membershipType
    );
    console.info("Filtered Memberships:", memberships);

    let result = null;
    if (memberships?.length == 1) {
      // This guardian only has one account linked, so we can proceed as normal
      result = memberships?.[0];
    } else {
      // This guardian has multiple accounts linked.
      // Fetch the last login time for each account, and use the one that was most recently used.
      let lastLoggedInProfileIndex: any = 0;
      let lastPlayed = 0;
      for (let id in memberships) {
        const membership = memberships?.[id];
        const profile = await getProfile((d) => this.http.$http(d), {
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
      console.info(
        "getMembershipDataForCurrentUser",
        "Selected membership data for the last logged in membership."
      );
      result = memberships?.[lastLoggedInProfileIndex];
    }
    localStorage.setItem("auth-membershipInfo", JSON.stringify(result));
    localStorage.setItem("auth-membershipInfo-date", JSON.stringify(Date.now()));
    return result;
  }

  async getCharacters() {
    let destinyMembership = await this.getMembershipDataForCurrentUser();
    if (!destinyMembership) {
      this.status.setApiError();
      return [];
    } else {
      this.status.clearApiError();
    }

    const profile = await getProfile((d) => this.http.$http(d), {
      components: [DestinyComponentType.Characters],
      membershipType: destinyMembership.membershipType,
      destinyMembershipId: destinyMembership.membershipId,
    });

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
