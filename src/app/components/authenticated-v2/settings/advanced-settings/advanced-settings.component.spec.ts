import Tracker from "@openreplay/tracker";
import { BehaviorSubject, of } from "rxjs";
import { MatDialog } from "@angular/material/dialog";
import { BuildConfiguration } from "../../../../data/buildConfiguration";
import { EventArmorType } from "../../../../data/enum/event-armor-type";
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
    expect(advanced.component.fieldKeys).not.toContain("Calculation Performance & Results");
    expect(advanced.component.fieldKeys).not.toContain("Events");
    expect(performance.component.fieldKeys).toEqual(["Calculation Performance & Results"]);
    expect(theorizer.component.fieldKeys).not.toContain("Calculation Performance & Results");
    expect(theorizer.component.fieldKeys).not.toContain("Artifice Slots (for legacy armor 2.0)");
    expect(hiddenPerformance.component.fieldKeys).toEqual([]);
    [advanced, performance, theorizer, hiddenPerformance].forEach(({ component }) =>
      component.ngOnDestroy()
    );
  });

  it("shows inventory settings in advanced settings and hides legacy options in the theorizer", () => {
    const main = create("advanced");
    const theorizer = create("advanced", true);
    expect(main.component.fieldKeys).toContain("Inventory");
    expect(main.component.fields2["Inventory"].length).toBe(6);
    expect(main.component.fields2["Inventory"].map((field) => field.name)).toEqual([
      "Include legacy (Armor 2.0) legendary armor",
      "Include legacy (Armor 2.0) exotic armor",
      "Include white, blue and green items",
      "Include sunset armor",
      "Include exotic collection rolls",
      "Include legendary and exotic vendor armor (slower)",
    ]);
    expect(theorizer.component.fields2["Inventory"].length).toBe(3);
    expect(
      theorizer.component.fields2["Inventory"].every(
        (field) => !/legacy|white, blue/i.test(field.name)
      )
    ).toBeTrue();
    const vendor = main.component.fields2["Inventory"].find((field) =>
      field.name.includes("vendor")
    )!;
    if (vendor.type === "boolean") vendor.onToggle(true);
    expect(main.configuration.includeVendorRolls).toBeTrue();
    const sunset = main.component.fields2["Inventory"].find(
      (field) => field.name === "Include sunset armor"
    )!;
    if (sunset.type === "boolean") {
      expect(sunset.value).toBe(!main.configuration.ignoreSunsetArmor);
      sunset.onToggle(false);
      expect(main.configuration.ignoreSunsetArmor).toBeTrue();
      sunset.onToggle(true);
      expect(main.configuration.ignoreSunsetArmor).toBeFalse();
    }
    expect(main.component.fieldKeys).toContain("Data-Science");
    expect(theorizer.component.fieldKeys).not.toContain("Data-Science");
    expect(
      main.component.fields2["Calculation Performance & Results"].some((field) =>
        field.name.startsWith("Add a constant +1 resilience")
      )
    ).toBeFalse();
    expect(
      theorizer.component.fields2["Calculation Performance & Results"].some((field) =>
        field.name.startsWith("Add a constant +1 resilience")
      )
    ).toBeFalse();
    expect(
      main.component.fields2["Data-Science"].some((field) =>
        field.name.startsWith("Add a constant +1 resilience")
      )
    ).toBeTrue();
    main.component.ngOnDestroy();
    theorizer.component.ngOnDestroy();
  });

  it("resets inventory flags only with advanced settings and preserves hidden legacy flags", () => {
    const defaults = BuildConfiguration.buildEmptyConfiguration();
    for (const section of ["advanced", "performance"] as const) {
      const { component, configuration } = create(section);
      configuration.includeVendorRolls = !defaults.includeVendorRolls;
      configuration.ignoreSunsetArmor = !defaults.ignoreSunsetArmor;
      component.resetAdvancedSettings();
      expect(configuration.includeVendorRolls).toBe(
        section === "advanced" ? defaults.includeVendorRolls : !defaults.includeVendorRolls
      );
      expect(configuration.ignoreSunsetArmor).toBe(
        section === "advanced" ? defaults.ignoreSunsetArmor : !defaults.ignoreSunsetArmor
      );
      component.ngOnDestroy();
    }
    const { component, configuration } = create("advanced", true);
    configuration.allowLegacyLegendaryArmor = false;
    configuration.allowLegacyExoticArmor = false;
    configuration.allowBlueArmorPieces = false;
    component.resetAdvancedSettings();
    expect(configuration.allowLegacyLegendaryArmor).toBeFalse();
    expect(configuration.allowLegacyExoticArmor).toBeFalse();
    expect(configuration.allowBlueArmorPieces).toBeFalse();
    component.ngOnDestroy();
  });

  it("resets each section without resetting the other section", () => {
    const defaults = BuildConfiguration.buildEmptyConfiguration();
    for (const section of ["advanced", "performance"] as const) {
      const { component, configuration } = create(section);
      configuration.assumeLegendariesMasterworked = !defaults.assumeLegendariesMasterworked;
      configuration.useEventArmor = EventArmorType.GuardianGames;
      configuration.calculateTierFiveTuning = !defaults.calculateTierFiveTuning;
      configuration.foldSameStatDifferentGearSets = !defaults.foldSameStatDifferentGearSets;
      configuration.parsedResultLimit = defaults.parsedResultLimit + 10000;
      configuration.addConstent1Health = !defaults.addConstent1Health;
      component.resetAdvancedSettings();
      expect(configuration.useEventArmor).toBe(EventArmorType.GuardianGames);
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
      expect(configuration.addConstent1Health).toBe(
        performanceReset ? !defaults.addConstent1Health : defaults.addConstent1Health
      );
      component.ngOnDestroy();
    }
  });
});
