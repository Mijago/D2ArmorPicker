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

import { APP_INITIALIZER, ErrorHandler, NgModule } from "@angular/core";
import { BrowserModule } from "@angular/platform-browser";
import * as Sentry from "@sentry/angular";
import { AppComponent } from "./app.component";
import { LoginComponent } from "./components/login/login.component";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { HttpClientModule } from "@angular/common/http";
import { Router, RouterModule, Routes } from "@angular/router";
import { HandleBungieLoginComponent } from "./components/handle-bungie-login/handle-bungie-login.component";
import { AuthenticatedGuard } from "./guards/authenticated.guard";
import { NotAuthenticatedGuard } from "./guards/not-authenticated.guard";
import { AppV2CoreComponent } from "./components/authenticated-v2/app-v2-core/app-v2-core.component";
import { SettingsComponent } from "./components/authenticated-v2/settings/settings.component";
import { ResultsComponent } from "./components/authenticated-v2/results/results.component";
import { DesiredStatSelectionComponent } from "./components/authenticated-v2/settings/desired-stat-selection/desired-stat-selection.component";
import { StatTierSelectionComponent } from "./components/authenticated-v2/settings/desired-stat-selection/stat-tier-selection/stat-tier-selection.component";
import { DesiredExoticSelectionComponent } from "./components/authenticated-v2/settings/desired-exotic-selection/desired-exotic-selection.component";
import { DesiredClassSelectionComponent } from "./components/authenticated-v2/settings/desired-class-selection/desired-class-selection.component";
import { StatIconComponent } from "./components/authenticated-v2/components/stat-icon/stat-icon.component";
import { DesiredModLimitSelectionComponent } from "./components/authenticated-v2/settings/desired-mod-limit-selection/desired-mod-limit-selection.component";
import { DesiredModsSelectionComponent } from "./components/authenticated-v2/settings/desired-mods-selection/desired-mods-selection.component";
import { VarDirectiveDirective } from "./components/authenticated-v2/components/var-directive.directive";
import { AdvancedSettingsComponent } from "./components/authenticated-v2/settings/advanced-settings/advanced-settings.component";
import { LoadAndSaveSettingsComponent } from "./components/authenticated-v2/settings/load-and-save-settings/load-and-save-settings.component";
import { ConfirmDialogComponent } from "./components/authenticated-v2/components/confirm-dialog/confirm-dialog.component";
import { ExpandedResultContentComponent } from "./components/authenticated-v2/results/expanded-result-content/expanded-result-content.component";
import { CountElementInListPipe } from "./components/authenticated-v2/results/expanded-result-content/count-element-in-list.pipe";
import { ClipboardModule } from "@angular/cdk/clipboard";
import { IgnoredItemsListComponent } from "./components/authenticated-v2/settings/ignored-items-list/ignored-items-list.component";
import { HelpPageComponent } from "./components/authenticated-v2/subpages/help-page/help-page.component";
import { ArmorPickerPageComponent } from "./components/authenticated-v2/subpages/armor-picker-page/armor-picker-page.component";
import { ArmorClusterPageComponent } from "./components/authenticated-v2/subpages/armor-cluster-page/armor-cluster-page.component";
import { TableModDisplayComponent } from "./components/authenticated-v2/results/table-mod-display/table-mod-display.component";
import { ArmorTooltipComponent } from "./components/authenticated-v2/overlays/armor-tooltip-component/armor-tooltip.component";
import { ItemTooltipRendererDirective } from "./components/authenticated-v2/overlays/armor-tooltip-component/item-tooltip-renderer.directive";
import { ItemIconComponent } from "./components/authenticated-v2/components/item-icon/item-icon.component";
import { ArmorInvestigationPageComponent } from "./components/authenticated-v2/subpages/armor-investigation-page/armor-investigation-page.component";
import { ChangelogDialogComponent } from "./components/authenticated-v2/components/changelog-dialog/changelog-dialog.component";
import { ChangelogListComponent } from "./components/authenticated-v2/components/changelog-list/changelog-list.component";
import { LayoutModule } from "@angular/cdk/layout";
import { ArmorPerkIconComponent } from "./components/authenticated-v2/components/armor-perk-icon/armor-perk-icon.component";
import { ExoticPerkTooltipComponent } from "./components/authenticated-v2/overlays/exotic-perk-tooltip/exotic-perk-tooltip.component";
import { ExoticTooltipDirective } from "./components/authenticated-v2/overlays/exotic-perk-tooltip/exotic-tooltip.directive";
import { AccountConfigPageComponent } from "./components/authenticated-v2/subpages/account-config-page/account-config-page.component";
import { ModDescriptionTooltipComponent } from "./components/authenticated-v2/overlays/mod-description-tooltip/mod-description-tooltip.component";
import { ModTooltipDirective } from "./components/authenticated-v2/overlays/mod-description-tooltip/mod-tooltip.directive";
import { StatCooldownTooltipComponent } from "./components/authenticated-v2/overlays/stat-cooldown-tooltip/stat-cooldown-tooltip.component";
import { StatCooldownTooltipDirective } from "./components/authenticated-v2/overlays/stat-cooldown-tooltip/stat-cooldown-tooltip.directive";
import { SlotLimitationTitleComponent } from "./components/authenticated-v2/settings/desired-mod-limit-selection/slot-limitation-title/slot-limitation-title.component";
import { CommonMaterialModule } from "./modules/common-material/common-material.module";
import { CommonModule } from "@angular/common";
import { LoggerModule, NgxLoggerLevel } from "ngx-logger";
import {
  VendorIdFromItemIdPipe,
  VendorNamePipe,
} from "./components/authenticated-v2/pipes/vendor-name-pipe";
import { LogLevelPipe } from "./components/authenticated-v2/pipes/log-level.pipe";

import { environment } from "../environments/environment";
// import { H } from "highlight.run";
import Tracker from "@openreplay/tracker";
import trackerAssist from "@openreplay/tracker-assist";

import { ResultsCardViewComponent } from "./components/authenticated-v2/results/results-card-view/results-card-view.component";
import { ResultsTableViewComponent } from "./components/authenticated-v2/results/results-table-view/results-table-view.component";
import { GearsetSelectionComponent } from "./components/authenticated-v2/settings/desired-mod-limit-selection/gearset-selection/gearset-selection.component";
import { GearsetcTooltipDirective as GearsetTooltipDirective } from "./components/authenticated-v2/overlays/gearset-tooltip/gearset-tooltip.directive";
import { GearsetTooltipComponent } from "./components/authenticated-v2/overlays/gearset-tooltip/gearset-tooltip.component";

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
    // H.identify(identifier, {
    //   highlightDisplayName: `${membershipData.displayName}(I${membershipData.membershipId}T${membershipData.membershipType})`,
    //   avatar: `https://bungie.net${membershipData.iconPath}`,
    //   bungieGlobalDisplayName: membershipData.bungieGlobalDisplayName,
    //   bungieGlobalDisplayNameCode: membershipData.bungieGlobalDisplayNameCode ?? -1,
    //   membershipType: membershipData.membershipType,
    //   applicableMembershipTypes: JSON.stringify(membershipData.applicableMembershipTypes),
    // });
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

// if (!!environment.highlight_project_id) {
//   H.init(environment.highlight_project_id, {
//     environment: environment.production
//       ? "production"
//       : environment.beta
//         ? "beta"
//         : environment.canary
//           ? "canary"
//           : "dev",
//     tracingOrigins: true,
//     inlineImages: false,
//     version: environment.version,
//     networkRecording: {
//       enabled: true,
//       recordHeadersAndBody: false,
//       urlBlocklist: [
//         "https://bungie.net/common/destiny2_content/icons/",
//         "https://www.bungie.net/img/",
//       ],
//     },
//   });
// }

import { ModslotVisualizationComponent } from "./components/authenticated-v2/settings/desired-mod-limit-selection/modslot-visualization/modslot-visualization.component";
import { ModLimitSegmentedComponent } from "./components/authenticated-v2/settings/desired-mod-limit-selection/mod-limit-segmented/mod-limit-segmented.component";
import { PrivacyPolicyComponent } from "./components/privacy-policy/privacy-policy.component";
import { GroupUserInfoCard } from "bungie-api-ts/groupv2";

const routes: Routes = [
  {
    path: "",
    component: AppV2CoreComponent,
    canActivate: [AuthenticatedGuard],
    children: [
      {
        path: "",
        component: ArmorPickerPageComponent,
      },
      {
        path: "help",
        component: HelpPageComponent,
      },
      {
        path: "cluster",
        component: ArmorClusterPageComponent,
      },
      {
        path: "investigate",
        component: ArmorInvestigationPageComponent,
      },
      {
        path: "account",
        component: AccountConfigPageComponent,
      },
    ],
  },
  //{path: '', component: MainComponent, canActivate: [AuthenticatedGuard]},
  { path: "privacy-policy", component: PrivacyPolicyComponent },
  { path: "login", component: LoginComponent, canActivate: [NotAuthenticatedGuard] },
  { path: "authenticate", component: HandleBungieLoginComponent },
  { path: "**", redirectTo: "/" },
];

@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    HandleBungieLoginComponent,
    AppV2CoreComponent,
    SettingsComponent,
    ResultsComponent,
    DesiredStatSelectionComponent,
    StatTierSelectionComponent,
    DesiredModLimitSelectionComponent,
    DesiredExoticSelectionComponent,
    DesiredClassSelectionComponent,
    StatIconComponent,
    DesiredModsSelectionComponent,
    VarDirectiveDirective,
    GearsetTooltipDirective,
    GearsetTooltipComponent,
    AdvancedSettingsComponent,
    LoadAndSaveSettingsComponent,
    ConfirmDialogComponent,
    ExpandedResultContentComponent,
    CountElementInListPipe,
    VendorIdFromItemIdPipe,
    VendorNamePipe,
    LogLevelPipe,
    IgnoredItemsListComponent,
    HelpPageComponent,
    ArmorPickerPageComponent,
    ArmorClusterPageComponent,
    TableModDisplayComponent,
    ArmorTooltipComponent,
    ItemTooltipRendererDirective,
    ItemIconComponent,
    ArmorInvestigationPageComponent,
    ChangelogDialogComponent,
    ChangelogListComponent,
    ArmorPerkIconComponent,
    ExoticPerkTooltipComponent,
    ExoticTooltipDirective,
    ModTooltipDirective,
    StatCooldownTooltipDirective,
    ModDescriptionTooltipComponent,
    AccountConfigPageComponent,
    ModDescriptionTooltipComponent,
    StatCooldownTooltipComponent,
    SlotLimitationTitleComponent,
    ResultsCardViewComponent,
    ResultsTableViewComponent,
    GearsetSelectionComponent,
    ModslotVisualizationComponent,
    ModLimitSegmentedComponent,
    PrivacyPolicyComponent,
  ],
  imports: [
    CommonModule,
    CommonMaterialModule,

    BrowserModule,
    BrowserAnimationsModule,
    HttpClientModule,
    RouterModule.forRoot(routes, { useHash: false }),
    ClipboardModule,
    LayoutModule,
    LoggerModule.forRoot({
      // serverLoggingUrl: "/api/logs",
      level: environment.production ? NgxLoggerLevel.ERROR : NgxLoggerLevel.DEBUG,
      serverLogLevel: NgxLoggerLevel.ERROR,
    }),
  ],
  providers: [
    {
      provide: ErrorHandler,
      useValue: Sentry.createErrorHandler({
        showDialog: false,
      }),
    },

    {
      provide: ErrorHandler,
      useValue: Sentry.createErrorHandler(),
    },
    {
      provide: Sentry.TraceService,
      deps: [Router],
    },
    {
      provide: APP_INITIALIZER,
      useFactory: () => () => {},
      deps: [Sentry.TraceService],
      multi: true,
    },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
