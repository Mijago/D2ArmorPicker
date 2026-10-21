import Tracker from "@openreplay/tracker";
import { BehaviorSubject } from "rxjs";
import { ArmorStat } from "../../../../data/enum/armor-stat";
import { ModOrAbility } from "../../../../data/enum/modOrAbility";
import { BuildConfiguration } from "../../../../data/buildConfiguration";
import type { ConfigurationService } from "../../../../services/configuration.service";
import type { DesiredModsSelectionComponent } from "./desired-mods-selection.component";

describe("desired mods selection overview", () => {
  let Component: typeof DesiredModsSelectionComponent;

  beforeAll(async () => {
    spyOn(Tracker.prototype, "start").and.stub();
    Component = (await import("./desired-mods-selection.component")).DesiredModsSelectionComponent;
  });

  it("summarizes selected modifier names and combined stat effects", () => {
    const configuration = BuildConfiguration.buildEmptyConfiguration();
    configuration.enabledMods = [ModOrAbility.WhisperOfConduction, ModOrAbility.WhisperOfChains];
    const component = new Component(
      {
        configuration: new BehaviorSubject(configuration),
        modifyConfiguration: (modify: (value: BuildConfiguration) => void) => modify(configuration),
      } as unknown as ConfigurationService,
      {} as any,
      {} as any
    );
    component.ngOnInit();

    expect(component.selectedModifierOverview.map((entry) => entry.modifier.name)).toEqual([
      "Whisper of Conduction",
      "Whisper of Chains",
    ]);
    expect(component.selectedModifierStatTotals).toEqual([
      { stat: ArmorStat.StatHealth, value: 10 },
      { stat: ArmorStat.StatMelee, value: 0 },
      { stat: ArmorStat.StatGrenade, value: 0 },
      { stat: ArmorStat.StatSuper, value: 10 },
      { stat: ArmorStat.StatClass, value: 10 },
      { stat: ArmorStat.StatWeapon, value: 0 },
    ]);

    component.ngOnDestroy();
  });
});
