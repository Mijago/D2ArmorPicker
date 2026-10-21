import { BehaviorSubject, Observable } from "rxjs";
import { map } from "rxjs/operators";
import type { BuildConfiguration } from "../data/buildConfiguration";
import type { StatLimitsState } from "./stat-reachability";
import type { T5LimitsReply, T5LimitsRequest, T5TargetLimits } from "./theorizer-model";

function limitsKey(config: BuildConfiguration): string {
  return JSON.stringify([
    config.characterClass,
    config.minimumStatTiers,
    config.statModLimits,
    config.selectedModElement,
    [...config.enabledMods].sort((first, second) => first - second),
  ]);
}

export class TheorizerStatLimits {
  private readonly view = new BehaviorSubject<StatLimitsState>({
    pending: true,
    feasible: false,
    maximum: Array<number>(6).fill(200),
  });
  readonly state = new Observable<StatLimitsState>((subscriber) => {
    if (!this.started && !this.disposed) {
      this.started = true;
      this.refresh();
    }
    return this.view.subscribe(subscriber);
  });
  readonly reachableTiers = this.state.pipe(
    map((state) => state.maximum.map((value) => value / 10))
  );
  private worker?: Worker;
  private config?: BuildConfiguration;
  private key = "";
  private sequence = 0;
  private started = false;
  private disposed = false;
  private scheduled?: ReturnType<typeof setTimeout>;
  private watchdog?: ReturnType<typeof setTimeout>;
  private validation?: (valid: boolean) => void;
  private validationState?: StatLimitsState;
  private readonly cache = new Map<string, T5TargetLimits>();

  configure(config: BuildConfiguration): void {
    const key = limitsKey(config);
    if (key === this.key || this.disposed) return;
    this.key = key;
    this.config = structuredClone(config);
    if (this.started) this.refresh();
  }

  refresh(): void {
    if (!this.config || this.disposed) return;
    this.resetRequest();
    const cached = this.cache.get(this.key);
    if (cached) {
      this.publish(cached);
      return;
    }
    this.view.next({ ...this.view.value, pending: true, feasible: false, error: undefined });
    this.scheduled = setTimeout(() => this.send(this.config!, false), 20);
  }

  validate(config: BuildConfiguration): Promise<boolean> {
    if (this.disposed) return Promise.resolve(false);
    this.resetRequest();
    const previous = this.view.value;
    this.view.next({ ...previous, pending: true });
    return new Promise((resolve) => {
      this.validation = resolve;
      this.validationState = previous;
      this.send(config, true);
    });
  }

  private resetRequest(): void {
    this.sequence++;
    clearTimeout(this.scheduled);
    clearTimeout(this.watchdog);
    const validation = this.validation;
    this.validation = undefined;
    this.validationState = undefined;
    validation?.(false);
  }

  private send(config: BuildConfiguration, validateOnly: boolean): void {
    try {
      if (!this.worker) {
        this.worker = new Worker(new URL("./theorizer-stat-limits.worker", import.meta.url), {
          type: "module",
        });
        this.worker.onmessage = ({ data }: MessageEvent<T5LimitsReply>) => {
          if (data.id !== this.sequence || this.disposed) return;
          clearTimeout(this.watchdog);
          const validation = this.validation;
          const previous = this.validationState;
          this.validation = undefined;
          this.validationState = undefined;
          if (validation) {
            if (previous) this.view.next(previous);
            if (previous?.pending) this.refresh();
            validation(data.status === "feasible");
          } else {
            if (data.status !== "unknown") {
              if (this.cache.size >= 32) this.cache.delete(this.cache.keys().next().value!);
              this.cache.set(this.key, data);
            }
            this.publish(data);
          }
        };
        this.worker.onerror = () =>
          this.fail("Stat limits could not be calculated. Retry to continue.");
        this.worker.onmessageerror = () =>
          this.fail("Stat limits could not be read. Retry to continue.");
      }
      this.watchdog = setTimeout(
        () => this.fail("Stat limits timed out. Retry to continue."),
        15000
      );
      this.worker.postMessage({
        id: this.sequence,
        config,
        validateOnly,
        wasmUrl: new URL("assets/highs.wasm", document.baseURI).href,
      } satisfies T5LimitsRequest);
    } catch {
      this.fail("Stat limits could not be calculated. Retry to continue.");
    }
  }

  private publish(result: T5TargetLimits): void {
    this.view.next({
      pending: false,
      feasible: result.status === "feasible",
      maximum: result.status === "feasible" ? result.maximum : this.view.value.maximum,
      error:
        result.status === "infeasible"
          ? "These targets cannot be reached. Lower targets or clear the selection."
          : result.status === "unknown"
            ? "Stat limits are not verified. Retry to continue."
            : undefined,
    });
  }

  private fail(error: string): void {
    this.resetRequest();
    this.worker?.terminate();
    this.worker = undefined;
    this.view.next({ ...this.view.value, pending: false, feasible: false, error });
  }

  destroy(): void {
    this.disposed = true;
    this.resetRequest();
    this.worker?.terminate();
    this.view.complete();
  }
}
