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

import { ComponentFixture, TestBed } from "@angular/core/testing";

import { PrivacyPolicyPageComponent } from "./privacy-policy-page.component";

describe("PrivacyPolicyPageComponent", () => {
  let component: PrivacyPolicyPageComponent;
  let fixture: ComponentFixture<PrivacyPolicyPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PrivacyPolicyPageComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PrivacyPolicyPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("should display privacy policy content", () => {
    const compiled = fixture.nativeElement;
    expect(compiled.querySelector("h1")).toBeTruthy();
    expect(compiled.querySelector("h1").textContent).toContain("Privacy Policy");
  });

  it("should contain required sections", () => {
    const compiled = fixture.nativeElement;
    const sections = compiled.querySelectorAll("section h2");
    const sectionTitles = Array.from(sections).map((section: any) => section.textContent.trim());

    expect(sectionTitles).toContain("Information We Collect");
    expect(sectionTitles).toContain("How We Use Your Information");
    expect(sectionTitles).toContain("Data Storage and Security");
    expect(sectionTitles).toContain("Your Rights");
    expect(sectionTitles).toContain("Contact Us");
  });
});
