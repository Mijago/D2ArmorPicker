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
import {AuthGuard} from "./guards/auth.guard";
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


const routes: Routes = [
  {path: '', component: MainComponent, canActivate: [AuthGuard]},
  {path: 'login', component: LoginComponent},
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
    ExoticItemDisplayComponent
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
        MatIconModule
    ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {
}
