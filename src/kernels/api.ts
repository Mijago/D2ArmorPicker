// Public kernel surface shared by the JS fallback and the WASM build.
export const KERNEL_VERSION: i32 = 1;

export function version(): i32 {
  return KERNEL_VERSION;
}

export { IO } from "./pool";
export { clearPersistent, count, keep, persistentGeneration, scratchReset } from "./pool";
export {
  extend,
  filterBudget,
  filterLocked,
  load,
  pareto,
  prioritize,
  read,
  single,
  sortByStat,
} from "./tuning-sets";
export { exactMaximum } from "./exact-limits";
export { modsPrecalc, setContext, tableChunk, tableInit, tierTesting } from "./mod-search";
