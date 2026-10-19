import { InjectionToken } from "@angular/core";
import { Observable } from "rxjs";

export interface StatReachability {
  readonly reachableTiers: Observable<number[]>;
  cancel(): void;
}

export const STAT_REACHABILITY = new InjectionToken<StatReachability>("stat reachability");
