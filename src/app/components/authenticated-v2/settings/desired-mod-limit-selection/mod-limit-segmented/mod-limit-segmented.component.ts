import { Component } from "@angular/core";
import { ConfigurationService } from "../../../../../services/configuration.service";

@Component({
  selector: "app-mod-limit-segmented",
  templateUrl: "./mod-limit-segmented.component.html",
  styleUrls: ["./mod-limit-segmented.component.scss"],
})
export class ModLimitSegmentedComponent {
  get total() {
    return this.config.readonlyConfigurationSnapshot.statModLimits.maxMods;
  }
  set total(value: number) {
    value = Math.max(0, Math.min(5, value));
    this.config.modifyConfiguration((c) => {
      c.statModLimits.maxMods = value;
      if (c.statModLimits.maxMajorMods > value) c.statModLimits.maxMajorMods = value;
    });
  }
  get major() {
    return this.config.readonlyConfigurationSnapshot.statModLimits.maxMajorMods;
  }
  set major(value: number) {
    value = Math.max(0, Math.min(this.total, value));
    this.config.modifyConfiguration((c) => {
      c.statModLimits.maxMajorMods = value;
    });
  }

  constructor(public config: ConfigurationService) {}

  onTotalChange(value: number) {
    this.total = value;
  }
  onMajorChange(value: number) {
    this.major = value;
  }
}
