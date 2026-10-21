import { CommonModule } from "@angular/common";
import { NO_ERRORS_SCHEMA } from "@angular/core";
import { fakeAsync, TestBed, tick } from "@angular/core/testing";
import { LoggingProxyService } from "../../../../../services/logging-proxy.service";
import { StatTierSelectionComponent } from "./stat-tier-selection.component";

describe("theorizer stat tier selection", () => {
  it("renders maximum animation steps without mouse events or manual change detection", fakeAsync(() => {
    TestBed.configureTestingModule({
      declarations: [StatTierSelectionComponent],
      imports: [CommonModule],
      providers: [
        { provide: LoggingProxyService, useValue: jasmine.createSpyObj("logger", ["debug"]) },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
    const fixture = TestBed.createComponent(StatTierSelectionComponent);
    fixture.autoDetectChanges();
    fixture.componentRef.setInput("maximumAvailableTier", 19);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelectorAll(".stat-line.disabled").length).toBe(0);
    tick(51);
    expect(element.querySelectorAll(".stat-line.disabled").length).toBe(5);
    tick(60);
    expect(element.querySelectorAll(".stat-line.disabled").length).toBe(10);
    fixture.componentRef.setInput("maximumAvailableTier", 20);
    fixture.detectChanges();
    tick(111);
    expect(element.querySelectorAll(".stat-line.disabled").length).toBe(0);
    fixture.destroy();
  }));

  it("restores the range thumb until a proposed target is accepted", () => {
    TestBed.configureTestingModule({
      declarations: [StatTierSelectionComponent],
      imports: [CommonModule],
      providers: [
        { provide: LoggingProxyService, useValue: jasmine.createSpyObj("logger", ["debug"]) },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
    const fixture = TestBed.createComponent(StatTierSelectionComponent);
    fixture.componentRef.setInput("verifySelection", true);
    fixture.componentRef.setInput("selectedTier", 10);
    fixture.detectChanges();
    const input: HTMLInputElement = fixture.nativeElement.querySelector("input[type=range]");
    input.value = "149";
    input.dispatchEvent(new Event("input"));
    input.dispatchEvent(new Event("change"));
    fixture.detectChanges();
    expect(input.value).toBe("100");
    expect(fixture.componentInstance.selectedTier).toBe(10);
    fixture.destroy();
  });

  it("gates increases while pending and does not commit unverified exact edits", () => {
    const logger = jasmine.createSpyObj<LoggingProxyService>("LoggingProxyService", ["debug"]);
    const component = new StatTierSelectionComponent(logger);
    component.verifySelection = true;
    component.maximumAvailableTier = 15;
    component.selectedTier = 10;
    component.selectionPending = true;
    const selected = jasmine.createSpy("selectedTierChange");
    component.selectedTierChange.subscribe(selected);
    component.setValueMob(150);
    expect(selected).not.toHaveBeenCalled();
    component.setValueMob(90);
    expect(selected).toHaveBeenCalledWith(9);
    expect(component.selectedTier).toBe(10);
    component.locked = true;
    selected.calls.reset();
    component.setValueMob(90);
    expect(selected).not.toHaveBeenCalled();
    component.selectionPending = false;
    component.commitValueEdit(149);
    expect(selected).toHaveBeenCalledWith(14.9);
    expect(component.selectedTier).toBe(10);
    expect(component.selectedValue).toBe(100);
  });

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
    fixture.componentRef.setInput("allowUnreachableSelection", true);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector(".max-value-section")?.textContent?.trim()).toBe("200");

    fixture.componentRef.setInput("maximumAvailableTier", 16.5);
    fixture.detectChanges();
    expect(element.querySelector(".max-value-section")?.textContent?.trim()).toBe("165");
    element.querySelector<HTMLButtonElement>(".max-button")!.click();
    expect(component.selectedTier).toBe(16.5);

    fixture.componentRef.setInput("maximumAvailableTier", 14);
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
