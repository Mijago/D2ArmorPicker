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

import { NgModule } from "@angular/core";
import { BrowserModule } from "@angular/platform-browser";

import { AppComponent } from "./app.component";
import { LoginComponent } from "./components/login/login.component";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { MatButtonModule } from "@angular/material/button";
import { HttpClientModule } from "@angular/common/http";
import { RouterModule, Routes } from "@angular/router";
import { HandleBungieLoginComponent } from "./components/handle-bungie-login/handle-bungie-login.component";
import { AuthenticatedGuard } from "./guards/authenticated.guard";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatSelectModule } from "@angular/material/select";
import { MatOptionModule } from "@angular/material/core";
import { MatSliderModule } from "@angular/material/slider";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { MatInputModule } from "@angular/material/input";
import { MatSlideToggleModule } from "@angular/material/slide-toggle";
import { MatTableModule } from "@angular/material/table";
import { MatCardModule } from "@angular/material/card";
import { MatTooltipModule } from "@angular/material/tooltip";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { MatIconModule } from "@angular/material/icon";
import { MatSortModule } from "@angular/material/sort";
import { MatPaginatorModule } from "@angular/material/paginator";
import { MatToolbarModule } from "@angular/material/toolbar";
import { NotAuthenticatedGuard } from "./guards/not-authenticated.guard";
import { MatMenuModule } from "@angular/material/menu";
import { AppV2CoreComponent } from "./components/authenticated-v2/app-v2-core/app-v2-core.component";
import { SettingsComponent } from "./components/authenticated-v2/settings/settings.component";
import { ResultsComponent } from "./components/authenticated-v2/results/results.component";
import { DesiredStatSelectionComponent } from "./components/authenticated-v2/settings/desired-stat-selection/desired-stat-selection.component";
import { MatButtonToggleModule } from "@angular/material/button-toggle";
import { StatTierSelectionComponent } from "./components/authenticated-v2/settings/desired-stat-selection/stat-tier-selection/stat-tier-selection.component";
import { DesiredExoticSelectionComponent } from "./components/authenticated-v2/settings/desired-exotic-selection/desired-exotic-selection.component";
import { DesiredClassSelectionComponent } from "./components/authenticated-v2/settings/desired-class-selection/desired-class-selection.component";
import { StatIconComponent } from "./components/authenticated-v2/components/stat-icon/stat-icon.component";
import { DesiredModLimitSelectionComponent } from "./components/authenticated-v2/settings/desired-mod-limit-selection/desired-mod-limit-selection.component";
import { DesiredModsSelectionComponent } from "./components/authenticated-v2/settings/desired-mods-selection/desired-mods-selection.component";
import { VarDirectiveDirective } from "./components/authenticated-v2/components/var-directive.directive";
import { AdvancedSettingsComponent } from "./components/authenticated-v2/settings/advanced-settings/advanced-settings.component";
import { LoadAndSaveSettingsComponent } from "./components/authenticated-v2/settings/load-and-save-settings/load-and-save-settings.component";
import { MatListModule } from "@angular/material/list";
import { MatExpansionModule } from "@angular/material/expansion";
import { ConfirmDialogComponent } from "./components/authenticated-v2/components/confirm-dialog/confirm-dialog.component";
import { MatDialogModule } from "@angular/material/dialog";
import { ExpandedResultContentComponent } from "./components/authenticated-v2/results/expanded-result-content/expanded-result-content.component";
import { CountElementInListPipe } from "./components/authenticated-v2/results/expanded-result-content/count-element-in-list.pipe";
import { ClipboardModule } from "@angular/cdk/clipboard";
import { MatSnackBarModule } from "@angular/material/snack-bar";
import { IgnoredItemsListComponent } from "./components/authenticated-v2/settings/ignored-items-list/ignored-items-list.component";
import { HelpPageComponent } from "./components/authenticated-v2/subpages/help-page/help-page.component";
import { ArmorPickerPageComponent } from "./components/authenticated-v2/subpages/armor-picker-page/armor-picker-page.component";
import { FlexLayoutModule } from "@angular/flex-layout";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { ArmorClusterPageComponent } from "./components/authenticated-v2/subpages/armor-cluster-page/armor-cluster-page.component";
import { TableModDisplayComponent } from "./components/authenticated-v2/results/table-mod-display/table-mod-display.component";
import { MatTabsModule } from "@angular/material/tabs";
import { MatChipsModule } from "@angular/material/chips";
import { SlotLimitationSelectionComponent } from "./components/authenticated-v2/settings/desired-mod-limit-selection/slot-limitation-selection/slot-limitation-selection.component";
import { ArmorTooltipComponent } from "./components/authenticated-v2/overlays/armor-tooltip-component/armor-tooltip.component";
import { ItemTooltipRendererDirective } from "./components/authenticated-v2/overlays/armor-tooltip-component/item-tooltip-renderer.directive";
import { ItemIconComponent } from "./components/authenticated-v2/components/item-icon/item-icon.component";
import { ArmorInvestigationPageComponent } from "./components/authenticated-v2/subpages/armor-investigation-page/armor-investigation-page.component";
import { ChangelogDialogComponent } from "./components/authenticated-v2/components/changelog-dialog/changelog-dialog.component";
import { ChangelogDialogControllerComponent } from "./components/authenticated-v2/components/changelog-dialog-controller/changelog-dialog-controller.component";
import { ChangelogListComponent } from "./components/authenticated-v2/components/changelog-list/changelog-list.component";
import { LayoutModule } from "@angular/cdk/layout";
import { MatSidenavModule } from "@angular/material/sidenav";
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
import {
  VendorIdFromItemIdPipe,
  VendorNamePipe,
} from "./components/authenticated-v2/pipes/vendor-name-pipe";

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
        path: "theory",
        // load TheorizerPageModule
        loadChildren: () =>
          import(
            "./components/authenticated-v2/subpages/theorizer-page/theorizer-page.module"
          ).then((m) => m.TheorizerPageModule),
      },
      {
        path: "account",
        component: AccountConfigPageComponent,
      },
    ],
  },
  //{path: '', component: MainComponent, canActivate: [AuthenticatedGuard]},
  { path: "login", component: LoginComponent, canActivate: [NotAuthenticatedGuard] },
  { path: "login-bungie", component: HandleBungieLoginComponent },
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
    AdvancedSettingsComponent,
    LoadAndSaveSettingsComponent,
    ConfirmDialogComponent,
    ExpandedResultContentComponent,
    CountElementInListPipe,
    VendorIdFromItemIdPipe,
    VendorNamePipe,
    IgnoredItemsListComponent,
    HelpPageComponent,
    ArmorPickerPageComponent,
    ArmorClusterPageComponent,
    TableModDisplayComponent,
    SlotLimitationSelectionComponent,
    ArmorTooltipComponent,
    ItemTooltipRendererDirective,
    ItemIconComponent,
    ArmorInvestigationPageComponent,
    ChangelogDialogComponent,
    ChangelogDialogControllerComponent,
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
  ],
  imports: [
    CommonModule,
    CommonMaterialModule,

    BrowserModule,
    BrowserAnimationsModule,
    HttpClientModule,
    RouterModule.forRoot(routes, { useHash: true }),
    ClipboardModule,
    LayoutModule,
  ],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
