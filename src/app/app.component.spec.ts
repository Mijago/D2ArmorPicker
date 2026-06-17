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

import { TestBed } from "@angular/core/testing";
import { AppComponent } from "./app.component";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { UserInformationService } from "src/app/services/user-information.service";
import { NGXLogger } from "ngx-logger";
import { AuthService } from "./services/auth.service";

describe("AppComponent", () => {
  beforeEach(async () => {
    // AppComponent only injects these three services and the tests construct it without change
    // detection, so stub them to avoid pulling the whole DI chain (DatabaseService -> AuthService
    // -> NGXLogger -> TOKEN_LOGGER_CONFIG) into the test module.
    await TestBed.configureTestingModule({
      declarations: [AppComponent],
      imports: [BrowserAnimationsModule],
      providers: [
        { provide: UserInformationService, useValue: { isInitialized: true } },
        {
          provide: NGXLogger,
          useValue: { debug() {}, info() {}, warn() {}, error() {} },
        },
        { provide: AuthService, useValue: {} },
      ],
    }).compileComponents();
  });

  it("should create the app", () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it(`should have as title 'D2ArmorPicker'`, () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.title).toEqual("D2ArmorPicker");
  });
});
