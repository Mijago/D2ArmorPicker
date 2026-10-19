import Tracker from "@openreplay/tracker";
import { BehaviorSubject, of } from "rxjs";
import { MatDialog } from "@angular/material/dialog";
import { BuildConfiguration } from "../../../../data/buildConfiguration";
import type { ConfigurationService } from "../../../../services/configuration.service";
import type { AdvancedSettingsComponent } from "./advanced-settings.component";

describe("advanced and performance settings", () => {
  let Component: typeof AdvancedSettingsComponent;
  beforeAll(async () => {
    spyOn(Tracker.prototype, "start").and.stub();
    Component = (await import("./advanced-settings.component")).AdvancedSettingsComponent;
  });

  function create(section: "advanced" | "performance", isTheorizer = false) {
    const configuration = BuildConfiguration.buildEmptyConfiguration();
    const component = new Component(
      {
        isTheorizer,
        configuration: new BehaviorSubject(configuration),
        modifyConfiguration: (modify: (value: BuildConfiguration) => void) => modify(configuration),
      } as unknown as ConfigurationService,
      {
        open: () => ({ afterClosed: () => of(true) }),
      } as unknown as MatDialog
    );
    component.section = section;
    component.ngOnInit();
    return { component, configuration };
  }

  it("renders performance as a separate main-only section", () => {
    const advanced = create("advanced");
    const performance = create("performance");
    const theorizer = create("advanced", true);
    const hiddenPerformance = create("performance", true);
    expect(advanced.component.fieldKeys).not.toContain("Performance Optimization");
    expect(performance.component.fieldKeys).toEqual(["Performance Optimization"]);
    expect(theorizer.component.fieldKeys).not.toContain("Performance Optimization");
    expect(theorizer.component.fieldKeys).not.toContain("Artifice Slots (for legacy armor 2.0)");
    expect(hiddenPerformance.component.fieldKeys).toEqual([]);
    [advanced, performance, theorizer, hiddenPerformance].forEach(({ component }) =>
      component.ngOnDestroy()
    );
  });

  it("resets each section without resetting the other section", () => {
    const defaults = BuildConfiguration.buildEmptyConfiguration();
    for (const section of ["advanced", "performance"] as const) {
      const { component, configuration } = create(section);
      configuration.assumeLegendariesMasterworked = !defaults.assumeLegendariesMasterworked;
      configuration.calculateTierFiveTuning = !defaults.calculateTierFiveTuning;
      configuration.foldSameStatDifferentGearSets = !defaults.foldSameStatDifferentGearSets;
      configuration.parsedResultLimit = defaults.parsedResultLimit + 10000;
      component.resetAdvancedSettings();
      const performanceReset = section === "performance";
      expect(configuration.assumeLegendariesMasterworked).toBe(
        performanceReset
          ? !defaults.assumeLegendariesMasterworked
          : defaults.assumeLegendariesMasterworked
      );
      expect(configuration.calculateTierFiveTuning).toBe(
        performanceReset ? defaults.calculateTierFiveTuning : !defaults.calculateTierFiveTuning
      );
      expect(configuration.foldSameStatDifferentGearSets).toBe(
        performanceReset
          ? defaults.foldSameStatDifferentGearSets
          : !defaults.foldSameStatDifferentGearSets
      );
      expect(configuration.parsedResultLimit).toBe(
        defaults.parsedResultLimit + (performanceReset ? 0 : 10000)
      );
      component.ngOnDestroy();
    }
  });
});
