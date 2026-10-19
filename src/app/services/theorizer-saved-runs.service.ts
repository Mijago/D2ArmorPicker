import { Injectable } from "@angular/core";
import Dexie from "dexie";
import { createT5SavedRun, restoreT5Arrangements, T5SavedRun } from "../data/theorizer";

@Injectable({ providedIn: "root" })
export class T5SavedRunsService extends Dexie {
  private runs!: Dexie.Table<T5SavedRun, number>;

  constructor() {
    super("d2ap-t5-saved-runs");
    this.version(1).stores({ runs: "++id, name, createdAt" });
  }

  async list(): Promise<Pick<T5SavedRun, "id" | "name" | "createdAt" | "complete">[]> {
    return (await this.runs.orderBy("createdAt").reverse().toArray()).map(
      ({ id, name, createdAt, complete }) => ({ id, name, createdAt, complete })
    );
  }

  async save(run: T5SavedRun): Promise<number> {
    if (!run.name.trim()) throw new Error("Enter a name for the saved run.");
    const sanitized = createT5SavedRun(
      run.name,
      run.configuration,
      run.options,
      restoreT5Arrangements(run.arrangements),
      run.complete
    );
    return this.runs.add(sanitized);
  }

  async get(id: number): Promise<T5SavedRun> {
    const run = await this.runs.get(id);
    if (!run) throw new Error("The saved run could not be found.");
    if (run.schemaVersion !== 1) throw new Error("This saved run uses an unsupported format.");
    return run;
  }

  async remove(id: number): Promise<void> {
    await this.runs.delete(id);
  }
}
