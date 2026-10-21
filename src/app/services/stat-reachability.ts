import { InjectionToken } from "@angular/core";
import { Observable } from "rxjs";
import type { BuildConfiguration } from "../data/buildConfiguration";

export interface StatLimitsState {
  pending: boolean;
  feasible: boolean;
  maximum: number[];
  error?: string;
}

export interface StatReachability {
  readonly reachableTiers: Observable<number[]>;
  readonly limitsState?: Observable<StatLimitsState>;
  validateTargets?(config: BuildConfiguration): Promise<boolean>;
  retryLimits?(): void;
  cancel(): void;
}

export const STAT_REACHABILITY = new InjectionToken<StatReachability>("stat reachability");
