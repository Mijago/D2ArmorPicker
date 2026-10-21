import { CommonModule } from "@angular/common";
import { NO_ERRORS_SCHEMA } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { LoggingProxyService } from "../../../../../services/logging-proxy.service";
import { StatTierSelectionComponent } from "./stat-tier-selection.component";

describe("theorizer stat tier selection", () => {
  it("updates the displayed maximum and MAX action from calculated reachability", () => {
    const logger = jasmine.createSpyObj<LoggingProxyService>("LoggingProxyService", ["debug"]);
    TestBed.configureTestingModule({
      declarations: [StatTierSelectionComponent],
      imports: [CommonModule],
      providers: [{ provide: LoggingProxyService, useValue: logger }],
      schemas: [NO_ERRORS_SCHEMA],
    });
    const fixture = TestBed.createComponent(StatTierSelectionComponent);
    const component = fixture.componentInstance;
    component.allowUnreachableSelection = true;
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector(".max-value-section")?.textContent?.trim()).toBe("200");

    component.maximumAvailableTier = 16.5;
    fixture.detectChanges();
    expect(element.querySelector(".max-value-section")?.textContent?.trim()).toBe("165");
    element.querySelector<HTMLButtonElement>(".max-button")!.click();
    expect(component.selectedTier).toBe(16.5);

    component.maximumAvailableTier = 14;
    fixture.detectChanges();
    expect(element.querySelector(".max-value-section")?.textContent?.trim()).toBe("140");
    element.querySelector<HTMLButtonElement>(".max-button")!.click();
    expect(component.selectedTier).toBe(14);
    expect(component.effectiveMaximumTier).toBe(20);
    fixture.destroy();
  });

  it("allows 200-point targets and numeric edits before reachability is known", () => {
    const logger = jasmine.createSpyObj<LoggingProxyService>("LoggingProxyService", ["debug"]);
    const component = new StatTierSelectionComponent(logger);
    component.allowUnreachableSelection = true;
    component.maximumAvailableTier = 0;
    const selected = jasmine.createSpy("selectedTierChange");
    component.selectedTierChange.subscribe(selected);

    expect(component.effectiveMaximumTier).toBe(20);
    component.setValueMob(200);
    expect(component.selectedTier).toBe(20);
    component.commitValueEdit(200);
    expect(component.selectedTier).toBe(20);
    expect(selected).toHaveBeenCalledWith(20);
  });
});
