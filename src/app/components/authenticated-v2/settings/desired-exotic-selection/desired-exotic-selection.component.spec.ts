import Tracker from "@openreplay/tracker";
import type { ChangeDetectorRef } from "@angular/core";
import { fakeAsync, flushMicrotasks, tick } from "@angular/core/testing";
import { BehaviorSubject, Subject } from "rxjs";
import { ArmorSlot } from "../../../../data/enum/armor-slot";
import { ArmorPerkOrSlot } from "../../../../data/enum/armor-stat";
import { BuildConfiguration } from "../../../../data/buildConfiguration";
import { EventArmorType } from "../../../../data/enum/event-armor-type";
import type { ClassExoticInfo } from "../../../../services/user-information.service";
import type { ConfigurationService } from "../../../../services/configuration.service";
import type { DesiredExoticSelectionComponent } from "./desired-exotic-selection.component";

describe("desired exotic event restrictions", () => {
  let Component: typeof DesiredExoticSelectionComponent;

  beforeAll(async () => {
    spyOn(Tracker.prototype, "start").and.stub();
    Component = (await import("./desired-exotic-selection.component"))
      .DesiredExoticSelectionComponent;
  });

  function create() {
    const configuration = BuildConfiguration.buildEmptyConfiguration();
    const changes = new BehaviorSubject(configuration);
    const inventory = {
      manifest: new Subject<void>(),
      inventory: new Subject<void>(),
      getExoticsForClass: jasmine.createSpy("getExoticsForClass").and.resolveTo([]),
      refreshInventory: jasmine.createSpy("refreshInventory").and.resolveTo(),
    };
    const bungieApi = {
      importCurrentlyEquippedExotic: jasmine
        .createSpy("importCurrentlyEquippedExotic")
        .and.resolveTo(),
    };
    const changeDetector = jasmine.createSpyObj<ChangeDetectorRef>("changeDetector", [
      "markForCheck",
    ]);
    const component = new Component(
      inventory as any,
      {
        configuration: changes,
        currentConfiguration: configuration,
        readonlyConfigurationSnapshot: configuration,
        modifyConfiguration: (modify: (value: BuildConfiguration) => void) => modify(configuration),
      } as unknown as ConfigurationService,
      bungieApi as any,
      { debug: () => undefined, error: () => undefined } as any,
      changeDetector
    );
    const helmet = {
      items: [{ hash: 100, slot: ArmorSlot.ArmorSlotHelmet }],
      instances: [],
      inInventory: true,
      inCollection: false,
      inVendor: false,
    } as unknown as ClassExoticInfo;
    const classItem = {
      items: [{ hash: 200, slot: ArmorSlot.ArmorSlotClass }],
      instances: [],
      inInventory: true,
      inCollection: false,
      inVendor: false,
    } as unknown as ClassExoticInfo;
    component.armors = [helmet, classItem];
    component.selectedExotics = [100, 200, 300];
    configuration.selectedExotics = [100, 200, 300];
    return {
      component,
      configuration,
      helmet,
      classItem,
      inventory,
      bungieApi,
      changes,
      changeDetector,
    };
  }

  it("requests rendering after configuration, manifest and inventory refreshes", fakeAsync(() => {
    const { component, configuration, helmet, inventory, changes, changeDetector } = create();
    inventory.getExoticsForClass.and.resolveTo([helmet]);
    component.ngOnInit();
    flushMicrotasks();
    expect(component.exotics[ArmorSlot.ArmorSlotHelmet]).toEqual([helmet]);
    expect(changeDetector.markForCheck).toHaveBeenCalled();
    changeDetector.markForCheck.calls.reset();
    changes.next(configuration);
    flushMicrotasks();
    expect(changeDetector.markForCheck).toHaveBeenCalled();
    for (const source of [inventory.manifest, inventory.inventory]) {
      changeDetector.markForCheck.calls.reset();
      source.next();
      tick(10);
      flushMicrotasks();
      expect(changeDetector.markForCheck).toHaveBeenCalled();
    }
    component.ngOnDestroy();
  }));

  it("requests rendering when refresh and import actions finish, including failures", async () => {
    const { component, inventory, bungieApi, changeDetector } = create();
    await component.refreshInventory();
    expect(component.refreshInventoryInProgress).toBeFalse();
    expect(changeDetector.markForCheck).toHaveBeenCalled();
    changeDetector.markForCheck.calls.reset();
    bungieApi.importCurrentlyEquippedExotic.and.rejectWith(new Error("Import failed"));
    await component.importEquippedExotic();
    expect(component.importEquippedExoticInProgress).toBeFalse();
    expect(changeDetector.markForCheck).toHaveBeenCalled();
    changeDetector.markForCheck.calls.reset();
    inventory.refreshInventory.and.rejectWith(new Error("Refresh failed"));
    await expectAsync(component.refreshInventory()).toBeRejected();
    expect(component.refreshInventoryInProgress).toBeFalse();
    expect(changeDetector.markForCheck).toHaveBeenCalled();
  });

  it("restricts exotic helmets for Festival of the Lost and clears an incompatible selection", () => {
    const { component, configuration, helmet, classItem } = create();

    component.setUseEventArmor(EventArmorType.FestivalOfTheLost);

    expect(component.isEventRestrictedExotic(helmet)).toBeTrue();
    expect(component.isEventRestrictedExotic(classItem)).toBeFalse();
    expect(configuration.selectedExotics).toEqual([200, 300]);
  });

  it("restricts exotic class items for Guardian Games and clears their perk filters", () => {
    const { component, configuration, helmet, classItem } = create();
    const perks = [1, 2] as ArmorPerkOrSlot[];
    configuration.selectedExoticPerks = perks;
    component.selectedExoticPerks = perks;

    component.setUseEventArmor(EventArmorType.GuardianGames);

    expect(component.isEventRestrictedExotic(helmet)).toBeFalse();
    expect(component.isEventRestrictedExotic(classItem)).toBeTrue();
    expect(configuration.selectedExotics).toEqual([100, 300]);
    expect(configuration.selectedExoticPerks).toEqual([ArmorPerkOrSlot.Any, ArmorPerkOrSlot.Any]);
  });
});
