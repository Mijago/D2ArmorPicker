import {NgModule} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';

import {AppComponent} from './app.component';
import {LoginComponent} from './components/login/login.component';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {MatButtonModule} from "@angular/material/button";
import {HttpClientModule} from "@angular/common/http";
import {RouterModule, Routes} from "@angular/router";
import {HandleBungieLoginComponent} from './components/handle-bungie-login/handle-bungie-login.component';
import {AuthenticatedGuard} from "./guards/authenticated.guard";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatSelectModule} from "@angular/material/select";
import {MatOptionModule} from "@angular/material/core";
import {MatSliderModule} from "@angular/material/slider";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {MatInputModule} from "@angular/material/input";
import {MatSlideToggleModule} from "@angular/material/slide-toggle";
import {MatTableModule} from "@angular/material/table";
import {MatCardModule} from "@angular/material/card";
import {MatTooltipModule} from "@angular/material/tooltip";
import {MatProgressBarModule} from "@angular/material/progress-bar";
import {MatIconModule} from "@angular/material/icon";
import {MatSortModule} from "@angular/material/sort";
import {MatPaginatorModule} from "@angular/material/paginator";
import {MatToolbarModule} from "@angular/material/toolbar";
import {NotAuthenticatedGuard} from "./guards/not-authenticated.guard";
import {MatMenuModule} from "@angular/material/menu";
import {AppV2CoreComponent} from './components/authenticated-v2/app-v2-core/app-v2-core.component';
import {SettingsComponent} from './components/authenticated-v2/settings/settings.component';
import {ResultsComponent} from './components/authenticated-v2/results/results.component';
import {DesiredStatSelectionComponent} from './components/authenticated-v2/settings/desired-stat-selection/desired-stat-selection.component';
import {MatButtonToggleModule} from "@angular/material/button-toggle";
import {StatTierSelectionComponent} from "./components/authenticated-v2/settings/desired-stat-selection/stat-tier-selection/stat-tier-selection.component";
import {DesiredExoticSelectionComponent} from './components/authenticated-v2/settings/desired-exotic-selection/desired-exotic-selection.component';
import {DesiredClassSelectionComponent} from './components/authenticated-v2/settings/desired-class-selection/desired-class-selection.component';
import {HeaderBarComponent} from './components/authenticated-v2/header-bar/header-bar.component';
import {StatIconComponent} from './components/authenticated-v2/components/stat-icon/stat-icon.component';
import {DesiredModLimitSelectionComponent} from "./components/authenticated-v2/settings/desired-mod-limit-selection/desired-mod-limit-selection.component";
import {DesiredModsSelectionComponent} from './components/authenticated-v2/settings/desired-mods-selection/desired-mods-selection.component';
import {VarDirectiveDirective} from './components/authenticated-v2/components/var-directive.directive';
import {AdvancedSettingsComponent} from './components/authenticated-v2/settings/advanced-settings/advanced-settings.component';
import {LoadAndSaveSettingsComponent} from './components/authenticated-v2/settings/load-and-save-settings/load-and-save-settings.component';
import {MatListModule} from "@angular/material/list";
import {MatExpansionModule} from "@angular/material/expansion";
import {ConfirmDialogComponent} from './components/authenticated-v2/components/confirm-dialog/confirm-dialog.component';
import {MatDialogModule} from "@angular/material/dialog";
import {ExpandedResultContentComponent} from './components/authenticated-v2/results/expanded-result-content/expanded-result-content.component';
import {CountElementInListPipe} from './components/authenticated-v2/results/expanded-result-content/count-element-in-list.pipe';
import {ClipboardModule} from "@angular/cdk/clipboard";
import {MatSnackBarModule} from "@angular/material/snack-bar";
import {IgnoredItemsListComponent} from './components/authenticated-v2/settings/ignored-items-list/ignored-items-list.component';
import {HelpPageComponent} from './components/authenticated-v2/subpages/help-page/help-page.component';
import {ArmorPickerPageComponent} from './components/authenticated-v2/subpages/armor-picker-page/armor-picker-page.component';
import {FlexLayoutModule} from "@angular/flex-layout";
import {MatProgressSpinnerModule} from "@angular/material/progress-spinner";
import {ArmorClusterPageComponent} from './components/authenticated-v2/subpages/armor-cluster-page/armor-cluster-page.component';
import {TableModDisplayComponent} from "./components/authenticated-v2/results/table-mod-display/table-mod-display.component";
import {MatTabsModule} from "@angular/material/tabs";
import {MatChipsModule} from "@angular/material/chips";
import { SlotLimitationSelectionComponent } from './components/authenticated-v2/settings/desired-mod-limit-selection/slot-limitation-selection/slot-limitation-selection.component';
import { ArmorTooltipComponent } from './components/authenticated-v2/overlays/armor-tooltip-component/armor-tooltip.component';
import { TooltipRendererDirective } from './components/authenticated-v2/overlays/tooltip-renderer.directive';


const routes: Routes = [
  {
    path: '', component: AppV2CoreComponent, canActivate: [AuthenticatedGuard],
    children: [
      {
        path: '',
        component: ArmorPickerPageComponent
      },
      {
        path: 'help',
        component: HelpPageComponent
      },
      {
        path: 'cluster',
        component: ArmorClusterPageComponent
      }
    ]
  },
  //{path: '', component: MainComponent, canActivate: [AuthenticatedGuard]},
  {path: 'login', component: LoginComponent, canActivate: [NotAuthenticatedGuard]},
  {path: 'login-bungie', component: HandleBungieLoginComponent},
  {path: '**', redirectTo: '/'},
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
    HeaderBarComponent,
    StatIconComponent,
    DesiredModsSelectionComponent,
    VarDirectiveDirective,
    AdvancedSettingsComponent,
    LoadAndSaveSettingsComponent,
    ConfirmDialogComponent,
    ExpandedResultContentComponent,
    CountElementInListPipe,
    IgnoredItemsListComponent,
    HelpPageComponent,
    ArmorPickerPageComponent,
    ArmorClusterPageComponent,
    TableModDisplayComponent,
    SlotLimitationSelectionComponent,
    ArmorTooltipComponent,
    TooltipRendererDirective
  ],
  imports: [
    FlexLayoutModule,
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
    MatExpansionModule,
    MatDialogModule,
    ClipboardModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    MatChipsModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {
}
