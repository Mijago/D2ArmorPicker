import { UntypedFormBuilder } from "@angular/forms";
import * as lzutf8 from "lzutf8";
import { LoadAndSaveSettingsComponent } from "./load-and-save-settings.component";
import { ConfigurationService } from "../../../../services/configuration.service";
import { ItemIconServiceService } from "../../../../services/item-icon-service.service";
import { ArmorStat } from "../../../../data/enum/armor-stat";
import {
  BuildConfiguration,
  serializeBuildConfiguration,
} from "../../../../data/buildConfiguration";

describe("LoadAndSaveSettingsComponent imports", () => {
  let component: LoadAndSaveSettingsComponent;
  let config: jasmine.SpyObj<ConfigurationService>;
  let snackBar: jasmine.SpyObj<any>;

  beforeEach(() => {
    config = jasmine.createSpyObj("ConfigurationService", [
      "checkAndFixOldSavedConfigurations",
      "saveCurrentConfiguration",
      "saveConfiguration",
    ]);
    config.checkAndFixOldSavedConfigurations.and.callFake((stored) => {
      ConfigurationService.prototype.checkAndFixOldSavedConfigurations.call(config, stored);
    });
    snackBar = jasmine.createSpyObj("MatSnackBar", ["open"]);
    component = new LoadAndSaveSettingsComponent(
      config,
      new UntypedFormBuilder(),
      {} as any,
      snackBar,
      {} as any,
      jasmine.createSpyObj<ItemIconServiceService>("ItemIconServiceService", ["getItemCached"]),
      {} as any,
      jasmine.createSpyObj("LoggingProxyService", ["debug", "error"])
    );
  });

  function importPayload(payload: any) {
    component.importTextForm
      .get("content")
      ?.setValue(lzutf8.compress(JSON.stringify(payload), { outputEncoding: "Base64" }));
    component.runImport();
  }

  function importPayloadAsSaved(payload: any) {
    component.importTextForm
      .get("content")
      ?.setValue(lzutf8.compress(JSON.stringify(payload), { outputEncoding: "Base64" }));
    component.runImportAsSaved();
  }

  it("wraps and migrates a bare legacy configuration before loading it", () => {
    importPayload({
      characterClass: 2,
      minimumStatTiers: {
        0: { fixed: false, value: 0.6 },
        1: { fixed: false, value: 0.1 },
        2: { fixed: false, value: 0.5 },
        3: { fixed: false, value: 0.3 },
        4: { fixed: false, value: 0.4 },
        5: { fixed: false, value: 0.2 },
      },
    });

    expect(config.saveCurrentConfiguration).toHaveBeenCalledTimes(1);
    const imported = config.saveCurrentConfiguration.calls.mostRecent().args[0];
    expect(imported.characterClass).toBe(2);
    expect(imported.configurationVersion).toBe(2);
    expect(imported.armorStatOrderVersion).toBe(2);
    expect(imported.minimumStatTiers[ArmorStat.StatHealth].value).toBe(0.1);
    expect(imported.minimumStatTiers[ArmorStat.StatWeapon].value).toBe(0.6);
    expect(config.saveConfiguration).not.toHaveBeenCalled();
    expect(component.importTextForm.get("content")?.value).toBeNull();
  });

  it("loads a single named export as the current configuration", () => {
    importPayload({ name: "Preset", version: "1", configuration: { characterClass: 2 } });

    expect(config.saveCurrentConfiguration).toHaveBeenCalledTimes(1);
    expect(config.saveConfiguration).not.toHaveBeenCalled();
  });

  it("round-trips readable named stats with every value and lock intact", () => {
    const original = BuildConfiguration.buildEmptyConfiguration();
    for (const [stat, selection] of Object.entries(original.minimumStatTiers)) {
      selection.value = (Number(stat) + 1) / 10;
      selection.fixed = Number(stat) % 2 === 0;
    }
    const serialized = serializeBuildConfiguration(original);

    expect(serialized.armorStatOrderVersion).toBe(2);
    expect(serialized.configurationVersion).toBe(2);
    expect(Object.keys(serialized.minimumStatTiers).sort()).toEqual([
      "Class",
      "Grenade",
      "Health",
      "Melee",
      "Super",
      "Weapon",
    ]);
    expect(serialized.minimumStatTiers["Health"]).toEqual({ value: 0.1, fixed: true });
    importPayload(serialized);

    const imported = config.saveCurrentConfiguration.calls.mostRecent().args[0];
    expect(imported.minimumStatTiers).toEqual(original.minimumStatTiers);
    const stored = { name: "Preset", version: "1", configuration: imported };
    config.checkAndFixOldSavedConfigurations(stored);
    expect(stored.configuration.minimumStatTiers).toEqual(original.minimumStatTiers);
  });

  it("maps named stats regardless of the stat-order version marker", () => {
    for (const armorStatOrderVersion of [undefined, 1, 2, 3, 99]) {
      importPayload({
        armorStatOrderVersion,
        minimumStatTiers: {
          Health: { value: 0.7, fixed: true },
          Weapon: { value: 0.2, fixed: false },
        },
      });

      const imported = config.saveCurrentConfiguration.calls.mostRecent().args[0];
      expect(imported.minimumStatTiers[ArmorStat.StatHealth]).toEqual({ value: 0.7, fixed: true });
      expect(imported.minimumStatTiers[ArmorStat.StatWeapon]).toEqual({ value: 0.2, fixed: false });
      expect(imported.minimumStatTiers[ArmorStat.StatMelee]).toEqual({ value: 0, fixed: false });
    }
  });

  it("imports version 2 numeric stats without applying the version 1 ordering", () => {
    const original = BuildConfiguration.buildEmptyConfiguration();
    original.configurationVersion = 1;
    original.minimumStatTiers[ArmorStat.StatHealth] = { value: 0.7, fixed: true };
    original.minimumStatTiers[ArmorStat.StatWeapon] = { value: 0.2, fixed: false };
    importPayload(original);

    expect(config.saveCurrentConfiguration.calls.mostRecent().args[0].minimumStatTiers).toEqual(
      original.minimumStatTiers
    );
    expect(config.saveCurrentConfiguration.calls.mostRecent().args[0].configurationVersion).toBe(2);
  });

  it("imports the reported compressed export", () => {
    component.importTextForm
      .get("content")
      ?.setValue(
        "eyJhcm1vclJlcXVpcmVtZW50cyI6W10sImVuYWJsZWRNb2THEWRpc8USSXRlbccTYWRkQ29uc3RlbnQxSGVhbHRoIjpmYWxzZSwiY2FsY3VsYXRlVGllckZpdmVUdW5pbmfJIGFzc3VtZUV2ZXJ5TGVnZW5kYXJ5SXNBcnRpZmljZdQnRXhvdGlj2SRDbGFzc+QAnNMicHV0yBTmANB0cnVlLCJ1c8RabnRB5AECIjoiTm9uZSIsIm9ubHlVc2VNYXN0ZXJ3b3JrZWTGfHPJUdMj6ADGaWXKJ2lnbm9yZVN1bnNlyGXIGm5jbHVkZUNvbGxlY3Rpb25Sb2xsyznGH1ZlbmRvcs4bZW5mb3JjZUZlYXR1csp3ec5gzybmAMDOI2FsbG93Qmx1ZcUXUGllY+QAuuYBGsUcTGVnYWPqAZ7HPtEhzVzHHuUBksg6aWVz7AEpziXGPtUhbGltaXRQYXJzZWRSZXN1bOQCmsYaZWFybHlBYm9ydOkB9skcbW9kT3B0aW1pemHkAVhTdHJhdGVneSI6MCwidHJ5TMRVV8RuZFN0YcRT6wHTU2hvd8drV2l0aE5v1CljaGFyYWN0ZXLFfCI6Miwic2XkAcblAy1FbOUDRSI6NsoX6QI+5AM0zhVQZXJrxBkwLDDEHHRhdE1vZOUApHMiOnsibWF45gKxNSzFDGFqb3LHEX0sIm1pbmltdW3kAJ/kA2bFMjDEBWZpeOQBR+cAsXZhbHVlIjowLjZ9LCIx2yAxfSwiMtsgxHQz2yAzfSwiNNsgNH0sIjXbIDJ9feUDlUZvdGzsAqx9"
      );
    component.runImport();

    expect(config.saveCurrentConfiguration).toHaveBeenCalledTimes(1);
    expect(snackBar.open).toHaveBeenCalledWith(
      "Successfully loaded this configuration",
      "",
      jasmine.any(Object)
    );
  });

  it("saves named presets from a bulk export", () => {
    importPayload([{ name: "Preset", version: "1", configuration: { characterClass: 2 } }]);

    expect(config.saveConfiguration).toHaveBeenCalledWith("Preset", jasmine.any(Object));
    expect(config.saveCurrentConfiguration).not.toHaveBeenCalled();
  });

  it("adds an unnamed configuration to saved presets without changing current settings", () => {
    importPayloadAsSaved({ characterClass: 2 });

    expect(config.saveConfiguration).toHaveBeenCalledWith(
      "Imported configuration",
      jasmine.any(Object)
    );
    expect(config.saveCurrentConfiguration).not.toHaveBeenCalled();
    expect(component.importTextForm.get("content")?.value).toBeNull();
  });

  it("preserves imported names and avoids overwriting saved presets", () => {
    component.storedConfigs = [{ name: "Preset" } as any];
    importPayloadAsSaved([{ name: "Preset", version: "1", configuration: { characterClass: 2 } }]);

    expect(config.saveConfiguration).toHaveBeenCalledWith("Preset (2)", jasmine.any(Object));
    expect(config.saveCurrentConfiguration).not.toHaveBeenCalled();
  });
});
