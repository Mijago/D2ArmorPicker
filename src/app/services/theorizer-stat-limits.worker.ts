import { initializeT5Optimizer, t5TargetLimits } from "./theorizer-model";
import type { T5LimitsReply, T5LimitsRequest } from "./theorizer-model";

let queue = Promise.resolve();
let latest = 0;

addEventListener("message", ({ data }: MessageEvent<T5LimitsRequest>) => {
  latest = data.id;
  queue = queue.then(async () => {
    if (data.id !== latest) return;
    try {
      await initializeT5Optimizer(data.wasmUrl);
      if (data.id !== latest) return;
      postMessage({
        id: data.id,
        ...t5TargetLimits(data.config, data.validateOnly),
      } satisfies T5LimitsReply);
    } catch (error) {
      postMessage({
        id: data.id,
        status: "unknown",
        maximum: [],
        error: error instanceof Error ? error.message : String(error),
      } satisfies T5LimitsReply);
    }
  });
});
