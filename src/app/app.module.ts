import {NgModule} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';

import {AppComponent} from './app.component';
import {LoginComponent} from './components/login/login.component';
import {AuthConfig, OAuthModule} from "angular-oauth2-oidc";
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {MatButtonModule} from "@angular/material/button";
import {HttpClientModule} from "@angular/common/http";
import {RouterModule, Routes} from "@angular/router";
import {HandleBungieLoginComponent} from './components/handle-bungie-login/handle-bungie-login.component';
import {AuthenticatedGuard} from "./guards/authenticated.guard";
import { MainComponent } from './components/authenticated/main/main.component';
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatSelectModule} from "@angular/material/select";
import {MatOptionModule} from "@angular/material/core";
import {MatSliderModule} from "@angular/material/slider";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {MatInputModule} from "@angular/material/input";
import { StatMinimumSelectionComponent } from './components/authenticated/stat-minimum-selection/stat-minimum-selection.component';
import {MatSlideToggleModule} from "@angular/material/slide-toggle";
import { StatModAmountComponent } from './components/authenticated/stat-mod-amount/stat-mod-amount.component';
import {MatTableModule} from "@angular/material/table";
import {MatCardModule} from "@angular/material/card";
import {MatTooltipModule} from "@angular/material/tooltip";
import { ExoticItemDisplayComponent } from './components/authenticated/exotic-item-display/exotic-item-display.component';
import {MatProgressBarModule} from "@angular/material/progress-bar";
import {MatIconModule} from "@angular/material/icon";
import {MatSortModule} from "@angular/material/sort";
import { TableModDisplayComponent } from './components/authenticated/table-mod-display/table-mod-display.component';
import {MatPaginatorModule} from "@angular/material/paginator";
import {MatToolbarModule} from "@angular/material/toolbar";
import {NotAuthenticatedGuard} from "./guards/not-authenticated.guard";
import {MatMenuModule} from "@angular/material/menu";
import { FilterPossibleAmountSetPipe } from './components/authenticated/main/filter-possible-amount-set.pipe';
import { AppV2CoreComponent } from './components/authenticated-v2/app-v2-core/app-v2-core.component';
import { SettingsComponent } from './components/authenticated-v2/settings/settings.component';
import { ResultsComponent } from './components/authenticated-v2/results/results.component';
import { DesiredStatSelectionComponent } from './components/authenticated-v2/settings/desired-stat-selection/desired-stat-selection.component';
import {MatButtonToggleModule} from "@angular/material/button-toggle";
import {StatTierSelectionComponent} from "./components/authenticated-v2/settings/desired-stat-selection/stat-tier-selection/stat-tier-selection.component";
import { DesiredExoticSelectionComponent } from './components/authenticated-v2/settings/desired-exotic-selection/desired-exotic-selection.component';
import { DesiredClassSelectionComponent } from './components/authenticated-v2/settings/desired-class-selection/desired-class-selection.component';
import { HeaderBarComponent } from './components/authenticated-v2/header-bar/header-bar.component';
import { StatIconComponent } from './components/authenticated-v2/components/stat-icon/stat-icon.component';
import {DesiredModLimitSelectionComponent} from "./components/authenticated-v2/settings/desired-mod-limit-selection/desired-mod-limit-selection.component";
import { DesiredModsSelectionComponent } from './components/authenticated-v2/settings/desired-mods-selection/desired-mods-selection.component';
import { VarDirectiveDirective } from './components/authenticated-v2/components/var-directive.directive';
import { AdvancedSettingsComponent } from './components/authenticated-v2/settings/advanced-settings/advanced-settings.component';
import { LoadAndSaveSettingsComponent } from './components/authenticated-v2/settings/load-and-save-settings/load-and-save-settings.component';
import {MatListModule} from "@angular/material/list";
import {MatExpansionModule} from "@angular/material/expansion";


const routes: Routes = [
  {path: 'v2', component: AppV2CoreComponent, canActivate: [AuthenticatedGuard]},
  {path: '', component: MainComponent, canActivate: [AuthenticatedGuard]},
  {path: 'login', component: LoginComponent, canActivate: [NotAuthenticatedGuard]},
  {path: 'login-bungie', component: HandleBungieLoginComponent},
];

@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    HandleBungieLoginComponent,
    MainComponent,
    StatMinimumSelectionComponent,
    StatModAmountComponent,
    ExoticItemDisplayComponent,
    TableModDisplayComponent,
    FilterPossibleAmountSetPipe,
    AppV2CoreComponent,
    SettingsComponent,
    ResultsComponent,
    DesiredStatSelectionComponent,
    StatTierSelectionComponent,
    DesiredModLimitSelectionComponent,
    DesiredExoticSelectionComponent,
    DesiredClassSelectionComponent,
    HeaderBarComponent,
    StatIconComponent,
    DesiredModsSelectionComponent,
    VarDirectiveDirective,
    AdvancedSettingsComponent,
    LoadAndSaveSettingsComponent
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    BrowserAnimationsModule,
    MatButtonModule,
    RouterModule.forRoot(routes, {useHash: true}),
    MatFormFieldModule,
    MatSelectModule,
    MatOptionModule,
    MatSliderModule,
    ReactiveFormsModule,
    MatInputModule,
    MatSlideToggleModule,
    FormsModule,
    MatTableModule,
    MatCardModule,
    MatTooltipModule,
    MatProgressBarModule,
    MatIconModule,
    MatSortModule,
    MatPaginatorModule,
    MatToolbarModule,
    MatMenuModule,
    MatButtonToggleModule,
    MatListModule,
    MatExpansionModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {
}
