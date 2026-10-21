import Tracker from "@openreplay/tracker";
import type { ChangeDetectorRef } from "@angular/core";
import { BehaviorSubject } from "rxjs";
import { BuildConfiguration } from "../../../../data/buildConfiguration";
import { ArmorStat } from "../../../../data/enum/armor-stat";
import type { ConfigurationService } from "../../../../services/configuration.service";
import type { ArmorCalculatorService } from "../../../../services/armor-calculator.service";
import type { StatusProviderService } from "../../../../services/status-provider.service";
import type { StatLimitsState } from "../../../../services/stat-reachability";
import type { DesiredStatSelectionComponent } from "./desired-stat-selection.component";

describe("verified theorizer target selection", () => {
  let Component: typeof DesiredStatSelectionComponent;
  beforeAll(async () => {
    spyOn(Tracker.prototype, "start").and.stub();
    Component = (await import("./desired-stat-selection.component")).DesiredStatSelectionComponent;
  });

  function create() {
    const configuration = new BehaviorSubject(BuildConfiguration.buildEmptyConfiguration());
    const limits = new BehaviorSubject<StatLimitsState>({
      pending: false,
      feasible: true,
      maximum: [150, 150, 200, 150, 150, 150],
    });
    const validateTargets = jasmine.createSpy("validateTargets").and.resolveTo(false);
    const changeDetector = jasmine.createSpyObj<ChangeDetectorRef>("changeDetector", [
      "markForCheck",
    ]);
    const config = {
      isTheorizer: true,
      configuration,
      get currentConfiguration() {
        return configuration.value;
      },
      modifyConfiguration(change: (config: BuildConfiguration) => void) {
        const next = structuredClone(configuration.value);
        change(next);
        configuration.next(next);
      },
    };
    const component = new Component(
      config as unknown as ConfigurationService,
      {} as ArmorCalculatorService,
      {} as StatusProviderService,
      {
        limitsState: limits,
        reachableTiers: new BehaviorSubject([15, 15, 20, 15, 15, 15]),
        validateTargets,
        cancel: () => undefined,
      },
      changeDetector
    );
    component.ngOnInit();
    return { component, config, configuration, limits, validateTargets, changeDetector };
  }

  it("marks the controls for rendering when worker limits arrive", () => {
    const { component, limits, changeDetector } = create();
    changeDetector.markForCheck.calls.reset();
    limits.next({ ...limits.value, pending: true });
    expect(component.limitsPending).toBeTrue();
    expect(changeDetector.markForCheck).toHaveBeenCalled();
    changeDetector.markForCheck.calls.reset();
    limits.next({ ...limits.value, pending: false });
    expect(component.limitsPending).toBeFalse();
    expect(changeDetector.markForCheck).toHaveBeenCalled();
    component.ngOnDestroy();
  });

  it("commits reachable minima but blocks increases with stale limits", () => {
    const { component, configuration, limits, validateTargets } = create();
    component.setSelectedTier(ArmorStat.StatHealth, 15);
    expect(configuration.value.minimumStatTiers[ArmorStat.StatHealth].value).toBe(15);
    expect(validateTargets).not.toHaveBeenCalled();
    component.setSelectedTier(ArmorStat.StatHealth, 16);
    expect(configuration.value.minimumStatTiers[ArmorStat.StatHealth].value).toBe(15);
    limits.next({ ...limits.value, pending: true });
    component.setSelectedTier(ArmorStat.StatMelee, 10);
    expect(configuration.value.minimumStatTiers[ArmorStat.StatMelee].value).toBe(0);
    component.ngOnDestroy();
  });

  it("validates exact locks before changing configuration", async () => {
    const { component, configuration, validateTargets } = create();
    component.setLockState(ArmorStat.StatHealth, true);
    await Promise.resolve();
    expect(configuration.value.minimumStatTiers[ArmorStat.StatHealth].fixed).toBeFalse();
    expect(component.selectionError).toBeDefined();
    validateTargets.and.resolveTo(true);
    component.setLockState(ArmorStat.StatHealth, true);
    await Promise.resolve();
    expect(configuration.value.minimumStatTiers[ArmorStat.StatHealth].fixed).toBeTrue();
    validateTargets.and.resolveTo(false);
    component.setSelectedTier(ArmorStat.StatHealth, 0.1);
    await Promise.resolve();
    expect(configuration.value.minimumStatTiers[ArmorStat.StatHealth].value).toBe(0);
    component.ngOnDestroy();
  });

  it("discards proposal replies after configuration changes", async () => {
    const { component, config, configuration, validateTargets } = create();
    let finish!: (valid: boolean) => void;
    validateTargets.and.returnValue(
      new Promise<boolean>((resolve) => {
        finish = resolve;
      })
    );
    component.setLockState(ArmorStat.StatHealth, true);
    config.modifyConfiguration((current) => {
      current.minimumStatTiers[ArmorStat.StatGrenade].value = 20;
    });
    finish(true);
    await Promise.resolve();
    expect(configuration.value.minimumStatTiers[ArmorStat.StatHealth].fixed).toBeFalse();
    expect(configuration.value.minimumStatTiers[ArmorStat.StatGrenade].value).toBe(20);
    component.ngOnDestroy();
  });

  it("validates presets atomically and clears invalid imported targets", async () => {
    const { component, config, configuration, limits, validateTargets } = create();
    component.useStatPreset([ArmorStat.StatHealth, ArmorStat.StatMelee]);
    await Promise.resolve();
    expect(configuration.value.minimumStatTiers[ArmorStat.StatHealth].value).toBe(0);
    config.modifyConfiguration((current) => {
      for (const stat of [0, 1, 2, 3, 4, 5])
        current.minimumStatTiers[stat as ArmorStat] = { value: 20, fixed: true };
    });
    limits.next({ ...limits.value, feasible: false });
    validateTargets.and.resolveTo(true);
    component.clearStatSelection();
    await Promise.resolve();
    expect(
      Object.values(configuration.value.minimumStatTiers).every(
        (target) => target.value === 0 && !target.fixed
      )
    ).toBeTrue();
    component.ngOnDestroy();
  });
});
