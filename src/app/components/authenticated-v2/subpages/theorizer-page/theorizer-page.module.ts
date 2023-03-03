import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import {TheorizerPageComponent} from "./theorizer-page.component";
import {RouterModule, Routes} from "@angular/router";
import {CommonMaterialModule} from "../../../../modules/common-material/common-material.module";


// router
const routes: Routes = [
  {
    path: '',
    component: TheorizerPageComponent
  }
];

@NgModule({
  declarations: [
    TheorizerPageComponent
  ],
  exports: [
    TheorizerPageComponent
  ],
  imports: [
    CommonModule,
    CommonMaterialModule,
    RouterModule.forChild(routes)
  ]
})
export class TheorizerPageModule { }
