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

import { HttpClientTestingModule, HttpTestingController } from "@angular/common/http/testing";
import { HttpClient } from "@angular/common/http";
import { TestBed } from "@angular/core/testing";

import { ClarityService } from "./clarity.service";

fdescribe("ClarityService", () => {
  let service: ClarityService;
  let httpClient: HttpClient;
  let httpTestingController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });

    httpClient = TestBed.inject(HttpClient);
    httpTestingController = TestBed.inject(HttpTestingController);

    let store: Record<string, string> = {};
    const mockLocalStorage = {
      getItem: (key: string): string | null => (key in store ? store[key] : null),
      setItem: (key: string, value: string) => (store[key] = `${value}`),
      removeItem: (key: string) => delete store[key],
      clear: () => (store = {}),
    };

    spyOn(localStorage, "getItem").and.callFake(mockLocalStorage.getItem);
    spyOn(localStorage, "setItem").and.callFake(mockLocalStorage.setItem);
    spyOn(localStorage, "removeItem").and.callFake(mockLocalStorage.removeItem);
    spyOn(localStorage, "clear").and.callFake(mockLocalStorage.clear);

    service = TestBed.inject(ClarityService);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it("should fetch the liva data", () => {
    service.load();

    const req = httpTestingController.expectOne((req) => req.url.includes("CharacterStatInfo"));
    req.flush(JSON.stringify({}));
  });

  it("should not fetch if there is cached data", () => {
    localStorage.setItem("clarity-character-stats", "{}");

    service.load();

    httpTestingController.expectNone((req) => req.url.includes("CharacterStatInfo"));
  });
});
