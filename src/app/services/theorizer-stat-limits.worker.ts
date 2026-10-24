import { initializeT5Optimizer, t5PreviewLimits, t5TargetLimits } from "./theorizer-model";
import type { T5LimitsReply, T5LimitsRequest } from "./theorizer-model";
import { initKernels } from "../wasm/kernels";

let queue = Promise.resolve();
let latest = 0;

addEventListener("message", ({ data }: MessageEvent<T5LimitsRequest>) => {
  latest = data.id;
  queue = queue.then(async () => {
    if (data.id !== latest) return;
    try {
      await initKernels({ url: data.kernelsUrl });
      // The exact solver needs no optimizer; a failed load only costs the quick preview.
      const ready = data.exactOnly
        ? false
        : await initializeT5Optimizer(data.wasmUrl).then(
            () => true,
            () => false
          );
      if (data.id !== latest) return;
      if (ready && !data.validateOnly) {
        const preview = t5PreviewLimits(data.config);
        if (preview)
          postMessage({
            id: data.id,
            status: "feasible",
            maximum: preview,
            maximumComplete: false,
            preview: true,
          } satisfies T5LimitsReply);
      }
      postMessage({
        id: data.id,
        ...t5TargetLimits(data.config, data.validateOnly, data.tuning ?? true),
      } satisfies T5LimitsReply);
    } catch (error) {
      postMessage({
        id: data.id,
        status: "unknown",
        maximum: [],
        maximumComplete: false,
        error: error instanceof Error ? error.message : String(error),
      } satisfies T5LimitsReply);
    }
  });
});
