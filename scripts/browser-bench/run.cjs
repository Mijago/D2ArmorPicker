// Serves the real results-builder worker to a browser and reports checked combinations per second.
//   node scripts/profile-calculator.cjs --input <armor.json> --class 1 --scenarios w100g100c100 --seconds 1 --request-out req.json
//   node scripts/browser-bench/run.cjs req.json "<browser exe>" [seconds] [headless]
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const esbuild = require("esbuild");

const [requestFile, browser, seconds = "8", headless = "1"] = process.argv.slice(2);
const root = path.join(__dirname, "..", "..");
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "d2ap-bench-"));

const stub = {
  name: "stub",
  setup(build) {
    build.onResolve({ filter: /^@openreplay\/|^@sentry\// }, (a) => ({
      path: a.path,
      namespace: "stub",
    }));
    build.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
      contents:
        "const noop = new Proxy(function () {}, { get: (t, k) => (k === '__esModule' ? false : noop), apply: () => noop, construct: () => noop }); module.exports = noop;",
      loader: "js",
    }));
  },
};

const page = `<!doctype html><meta charset=utf-8><title>bench</title><body>running
<script>
const seconds = ${Number(seconds)};
async function runParallel(request, useWasm) {
  const count = request.batches.length;
  const started = performance.now();
  const firstMessage = [];
  const finished = [];
  let results = 0;
  const workers = request.batches.map((items, current) => {
    const worker = new Worker("/worker.js");
    worker.onmessage = ({ data }) => {
      const t = Math.round(performance.now() - started);
      if (firstMessage[current] === undefined) firstMessage[current] = t;
      if (data.packed) results += data.packed.count;
      if (data.done) {
        finished[current] = t;
        worker.terminate();
        check();
      }
    };
    return { worker, items, current };
  });
  let finish;
  const check = () => {
    if (finished.filter((t) => t !== undefined).length === count) finish({ wall: Math.round(performance.now() - started), firstMin: Math.min(...firstMessage), firstMax: Math.max(...firstMessage), doneMin: Math.min(...finished), doneMax: Math.max(...finished), results, backend: useWasm ? "wasm" : "js" });
  };
  return new Promise((resolve) => {
    finish = resolve;
    for (const { worker, items, current } of workers)
      worker.postMessage({ type: "builderRequest", currentClass: request.config.characterClass, config: request.config, threadSplit: { count, current }, items, selectedExotics: [], kernelsUrl: useWasm ? new URL("kernels.wasm", location.href).href : undefined });
  });
}
async function run(useWasm) {
  const request = await (await fetch("/request.json")).json();
  if (request.batches) return runParallel(request, useWasm);
  const worker = new Worker("/worker.js");
  return new Promise((resolve) => {
    let results = 0;
    const started = performance.now();
    const timer = setTimeout(() => worker.postMessage({ type: "cancel" }), seconds * 1000);
    worker.onerror = (e) => resolve({ error: e.message || "worker error" });
    worker.onmessage = ({ data }) => {
      if (data.type === "workerError") resolve({ error: String(data.error) });
      if (data.packed) results += data.packed.count;
      if (data.done) {
        clearTimeout(timer);
        const ms = performance.now() - started;
        worker.terminate();
        resolve({ backend: data.kernelBackend, ms, checked: data.checkedCalculations, perSecond: Math.round(data.checkedCalculations / (ms / 1000)), results });
      }
    };
    worker.postMessage({ type: "builderRequest", currentClass: request.config.characterClass, config: request.config, threadSplit: { count: 1, current: 0 }, items: request.items, selectedExotics: [], kernelsUrl: useWasm ? new URL("kernels.wasm", location.href).href : undefined });
  });
}
(async () => {
  const out = { ua: navigator.userAgent, runs: [] };
  for (const useWasm of [false, true, false, true]) out.runs.push(await run(useWasm));
  await fetch("/result", { method: "POST", body: JSON.stringify(out) });
})();
</script>`;

esbuild
  .build({
    entryPoints: [path.join(root, "src/app/services/results-builder.worker.ts")],
    outfile: path.join(outDir, "worker.js"),
    bundle: true,
    format: "iife",
    target: "es2022",
    tsconfig: path.join(root, "tsconfig.json"),
    logLevel: "error",
    plugins: [stub],
  })
  .then(() => {
    const server = http.createServer((req, res) => {
      if (req.url === "/")
        return void res.writeHead(200, { "content-type": "text/html" }).end(page);
      if (req.url === "/worker.js")
        return void res
          .writeHead(200, { "content-type": "text/javascript" })
          .end(fs.readFileSync(path.join(outDir, "worker.js")));
      if (req.url === "/request.json")
        return void res
          .writeHead(200, { "content-type": "application/json" })
          .end(fs.readFileSync(requestFile));
      if (req.url === "/kernels.wasm")
        return void res
          .writeHead(200, { "content-type": "application/wasm" })
          .end(fs.readFileSync(path.join(root, "src/assets/wasm/kernels.wasm")));
      if (req.url === "/result") {
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => {
          res.end("ok");
          console.log(JSON.stringify(JSON.parse(body), null, 1));
          child.kill();
          server.close();
          process.exit(0);
        });
        return;
      }
      res.writeHead(404).end();
    });
    server.listen(0, "127.0.0.1", () => {
      const url = `http://127.0.0.1:${server.address().port}/`;
      const profile = fs.mkdtempSync(path.join(os.tmpdir(), "d2ap-profile-"));
      const isFirefox = /firefox/i.test(browser);
      const args = isFirefox
        ? [...(headless === "1" ? ["-headless"] : []), "-no-remote", "-profile", profile, url]
        : [
            ...(headless === "1" ? ["--headless=new"] : []),
            `--user-data-dir=${profile}`,
            "--no-first-run",
            url,
          ];
      globalThis.child = spawn(browser, args, { stdio: "ignore" });
      setTimeout(
        () => {
          console.error("timeout");
          child.kill();
          process.exit(1);
        },
        (Number(seconds) * 4 + 60) * 1000
      );
    });
  });
