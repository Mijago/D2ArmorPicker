import { LoggingProxyService } from "../../../../../services/logging-proxy.service";
import { StatTierSelectionComponent } from "./stat-tier-selection.component";

describe("theorizer stat tier selection", () => {
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
