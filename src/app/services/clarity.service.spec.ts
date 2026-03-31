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
import { HttpErrorResponse } from "@angular/common/http";
import { TestBed } from "@angular/core/testing";

import {
  ClarityService,
  CHARACTER_STATS_URL,
  UPDATES_URL,
  SUPPORTED_SCHEMA_VERSION,
  UpdateData,
} from "./clarity.service";
import { LoggingProxyService } from "./logging-proxy.service";
import { MatDialogModule } from "@angular/material/dialog";

describe("ClarityService", () => {
  let service: ClarityService;
  let httpTestingController: HttpTestingController;
  let currentDataVersion: number = 0;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, MatDialogModule],
      providers: [LoggingProxyService],
    });

    httpTestingController = TestBed.inject(HttpTestingController);

    localStorage.removeItem("clarity-character-stats");
    localStorage.removeItem("clarity-character-stats-version");

    service = TestBed.inject(ClarityService);

    service.characterStats.subscribe((data) => {
      if (data) {
        currentDataVersion = (data as any)!.version;
      }
    });
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it("should fetch liva data if there is no cached data", (done) => {
    expectStatsFetch(1);

    service.load().then(() => {
      expect(currentDataVersion).toBe(1);
      expect(localStorage.getItem("clarity-character-stats-version")).toEqual(
        currentDataVersion.toString()
      );
      done();
    });

    expectVersionFetch();
  });

  it("should not fetch if there is cached data which matches the live version", (done) => {
    const liveVersion = 12345;

    setCachedDataWithVersion(liveVersion);

    service.load().then(() => {
      expect(currentDataVersion).toBe(liveVersion);
      done();
    });

    expectVersionFetch(liveVersion);
  });

  it("should fetch live data if it is newer than the cached data", (done) => {
    const liveVersion = 12345;

    setCachedDataWithVersion(liveVersion - 1);

    expectStatsFetch(liveVersion);

    service.load().then(() => {
      expect(currentDataVersion).toBe(liveVersion);
      expect(localStorage.getItem("clarity-character-stats-version")).toEqual(
        liveVersion.toString()
      );
      done();
    });

    expectVersionFetch(liveVersion);
  });

  it("should not fetch live data the schema does not match our supported version", (done) => {
    setCachedDataWithVersion(1);

    const logger = TestBed.inject(LoggingProxyService);
    spyOn(logger, "warn");
    service.load().then(() => {
      expect(logger.warn).toHaveBeenCalledWith(
        "Unsupported live character stats schema version",
        "300.5"
      );
      expect(currentDataVersion).toBe(1);
      done();
    });

    expectVersionFetch(2, "300.5");
  });

  it("should fail gracefully if version fetch fails", (done) => {
    const logger = TestBed.inject(LoggingProxyService);
    spyOn(logger, "warn");
    service
      .load()
      .then(() => {
        expect(logger.warn).toHaveBeenCalledWith(
          "Error loading Clarity data",
          jasmine.any(HttpErrorResponse)
        );
        done();
      })
      .catch((err) => logger.warn("Error loading Clarity data", err));

    // Network error from version fetch
    httpTestingController.expectOne(UPDATES_URL).error(new ProgressEvent("error"));
  });

  it("should fail gracefully if stats fetch fails", (done) => {
    const logger = TestBed.inject(LoggingProxyService);
    spyOn(logger, "warn");

    setTimeout(() => {
      // Network error from stats fetch
      httpTestingController.expectOne(CHARACTER_STATS_URL).error(new ProgressEvent("error"));
    });

    service
      .load()
      .then(() => {
        expect(logger.warn).toHaveBeenCalledWith(
          "Error loading Clarity data",
          jasmine.any(HttpErrorResponse)
        );
        done();
      })
      .catch((err) => logger.warn("Error loading Clarity data", err));

    // Network error from version fetch
    expectVersionFetch(2);
  });

  function expectStatsFetch(version: number) {
    setTimeout(() => {
      expect(() => {
        httpTestingController.expectOne(CHARACTER_STATS_URL).flush({ version });
      }).not.toThrow();
    });
  }

  function expectVersionFetch(
    lastUpdate: number = 1,
    schemaVersion: string = SUPPORTED_SCHEMA_VERSION
  ) {
    expect(() => {
      httpTestingController.expectOne(UPDATES_URL).flush({
        lastUpdate,
        schemaVersion,
      } as UpdateData);
    }).not.toThrow();
  }

  function setCachedDataWithVersion(version: number) {
    localStorage.setItem("clarity-character-stats", JSON.stringify({ version }));
    localStorage.setItem("clarity-character-stats-version", version.toString());
  }
});
