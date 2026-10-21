import Tracker from "@openreplay/tracker";
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
    const component = new Component(
      {} as any,
      {
        currentConfiguration: configuration,
        readonlyConfigurationSnapshot: configuration,
        modifyConfiguration: (modify: (value: BuildConfiguration) => void) => modify(configuration),
      } as unknown as ConfigurationService,
      {} as any,
      {} as any
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
    return { component, configuration, helmet, classItem };
  }

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
