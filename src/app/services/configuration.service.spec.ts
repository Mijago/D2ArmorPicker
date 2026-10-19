import { BuildConfiguration } from "../data/buildConfiguration";
import { ArmorStat } from "../data/enum/armor-stat";
import { ConfigurationService } from "./configuration.service";
import { LoggingProxyService } from "./logging-proxy.service";

describe("scoped theorizer configuration", () => {
  const prefix = "test-theorizer-";
  const logger = {
    debug: () => undefined,
    error: () => undefined,
  } as unknown as LoggingProxyService;
  afterEach(() => {
    localStorage.removeItem(`${prefix}user-currentConfig`);
    localStorage.removeItem(`${prefix}storedConfigurations`);
  });

  it("copies targets and nested settings without changing the original", () => {
    const initial = BuildConfiguration.buildEmptyConfiguration();
    initial.minimumStatTiers[ArmorStat.StatHealth].value = 12;
    initial.statModLimits.maxMajorMods = 2;
    const service = new ConfigurationService(logger, { prefix, initial });
    expect(service.currentConfiguration.minimumStatTiers[ArmorStat.StatHealth].value).toBe(12);
    service.modifyConfiguration((config) => {
      config.minimumStatTiers[ArmorStat.StatHealth].value = 18;
      config.statModLimits.maxMajorMods = 0;
    });
    expect(initial.minimumStatTiers[ArmorStat.StatHealth].value).toBe(12);
    expect(initial.statModLimits.maxMajorMods).toBe(2);
    const reloaded = new ConfigurationService(logger, { prefix, initial });
    expect(reloaded.currentConfiguration.minimumStatTiers[ArmorStat.StatHealth].value).toBe(18);
    expect(reloaded.currentConfiguration.statModLimits.maxMajorMods).toBe(0);
  });

  it("does not write the main configuration storage key", () => {
    const before = localStorage.getItem("user-currentConfig");
    const service = new ConfigurationService(logger, {
      prefix,
      initial: BuildConfiguration.buildEmptyConfiguration(),
    });
    service.modifyConfiguration((config) => {
      config.statModLimits.maxMods = 0;
    });
    expect(localStorage.getItem("user-currentConfig")).toBe(before);
    expect(localStorage.getItem(`${prefix}user-currentConfig`)).not.toBeNull();
  });
});
