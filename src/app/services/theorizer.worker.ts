import { createT5UpdateEncoder, T5SearchRequest } from "../data/theorizer";
import { matchT5Inventory, PreparedT5Search, prepareT5Search, searchT5 } from "./theorizer-search";
import { initializeT5Optimizer } from "./theorizer-model";

let baseRequest: T5SearchRequest | undefined;
let prepared: PreparedT5Search | undefined;

addEventListener(
  "message",
  async ({
    data,
  }: MessageEvent<
    | T5SearchRequest
    | { type: "task"; task: NonNullable<T5SearchRequest["task"]>; timeLimitMs: number }
    | {
        type: "build";
        arrangement: NonNullable<T5SearchRequest["arrangement"]>;
        timeLimitMs: number;
      }
    | { type: "matches"; arrangements: NonNullable<T5SearchRequest["matchArrangements"]> }
  >) => {
    const encode = createT5UpdateEncoder();
    try {
      let request: T5SearchRequest;
      if ("type" in data && data.type === "task") {
        if (!baseRequest)
          throw new Error("The theorizer worker has no initialized search request.");
        request = {
          ...baseRequest,
          stage: "arrangements",
          skipMaxima: true,
          partition: undefined,
          task: data.task,
          timeLimitMs: data.timeLimitMs,
        };
      } else if ("type" in data && data.type === "build") {
        if (!baseRequest) throw new Error("The build worker has no initialized search request.");
        request = {
          ...baseRequest,
          stage: "builds",
          skipMaxima: true,
          partition: undefined,
          task: undefined,
          group: undefined,
          arrangement: data.arrangement,
          timeLimitMs: data.timeLimitMs,
        };
      } else if ("type" in data && data.type === "matches") {
        if (!baseRequest || !prepared)
          throw new Error("The match worker has no initialized search request.");
        request = { ...baseRequest, stage: "matches", matchArrangements: data.arrangements };
      } else {
        request = data as T5SearchRequest;
        baseRequest = { ...request, partition: undefined, task: undefined };
        prepared = prepareT5Search(baseRequest);
      }
      if (request.stage === "matches") {
        await initializeT5Optimizer(request.wasmUrl);
        for (const update of matchT5Inventory(request, prepared!)) postMessage(update);
        return;
      }
      postMessage({
        results: [],
        checked: 0,
        total: 0,
        feasible: 0,
        evaluations: 0,
        done: false,
        complete: false,
        warnings: [],
      });
      const search = searchT5(request, undefined, prepared);
      const first = search.next();
      if (!first.done) postMessage(encode(first.value));
      if (first.done || first.value.done) return;
      await initializeT5Optimizer(request.wasmUrl);
      for (const update of search) postMessage(encode(update));
    } catch (error) {
      postMessage({
        delta: true,
        results: [],
        checked: 0,
        total: 0,
        feasible: 0,
        evaluations: 0,
        done: true,
        complete: false,
        warnings: [],
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
);
