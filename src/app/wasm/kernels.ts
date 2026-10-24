import * as js from "../../kernels/api";

type KernelFunctions = Omit<typeof js, "IO">;

export interface Kernels extends KernelFunctions {
  readonly backend: "wasm" | "js";
  /** Argument/result scratch buffer. Re-read after every call; WASM memory may grow. */
  io(): Int32Array;
}

export interface KernelSource {
  url?: string;
  bytes?: BufferSource;
}

interface WasmExports extends KernelFunctions {
  memory: WebAssembly.Memory;
  ioPtr(): number;
}

const jsKernels: Kernels = { ...js, backend: "js", io: () => js.IO };
let active: Kernels = jsKernels;
const loads = new Map<string, Promise<Kernels>>();

/** Kernels in use: the TypeScript build until initKernels() has loaded the WASM one. */
export function kernels(): Kernels {
  return active;
}

/** Switches back to the TypeScript build; loaded WASM instances stay cached. */
export function useJavaScriptKernels(): void {
  active = jsKernels;
}

function sourceKey(source: KernelSource): string | undefined {
  return source.bytes ? "bytes" : source.url;
}

/** Loads the WASM kernels; any failure keeps the TypeScript fallback. Safe to call repeatedly. */
export function initKernels(source: KernelSource = {}): Promise<Kernels> {
  const key = sourceKey(source);
  if (!key) return Promise.resolve(active);
  let load = loads.get(key);
  if (!load) {
    load = loadWasm(source).catch((error) => {
      console.warn("WASM kernels unavailable, using the JavaScript fallback.", error);
      return jsKernels;
    });
    loads.set(key, load);
  }
  return load.then((loaded) => (active = loaded));
}

async function loadWasm(source: KernelSource): Promise<Kernels> {
  let bytes = source.bytes;
  if (!bytes) {
    const response = await fetch(source.url!);
    if (!response.ok) throw new Error(`Kernel download failed: HTTP ${response.status}`);
    bytes = await response.arrayBuffer();
  }
  const { instance } = await WebAssembly.instantiate(bytes, {
    env: {
      abort: (_message: number, _file: number, line: number, column: number) => {
        throw new Error(`WASM kernel aborted at ${line}:${column}`);
      },
    },
  });
  const exports = instance.exports as unknown as WasmExports;
  if (exports.version() !== js.KERNEL_VERSION) {
    throw new Error(`Stale kernel build: ${exports.version()} != ${js.KERNEL_VERSION}`);
  }

  const memory = exports.memory;
  const ioPointer = exports.ioPtr();
  let view: Int32Array | undefined;
  const wasm: Kernels = {
    ...exports,
    backend: "wasm",
    io: () => {
      if (!view || view.buffer !== memory.buffer) {
        view = new Int32Array(memory.buffer, ioPointer, js.IO.length);
      }
      return view;
    },
  };
  selfTest(wasm);
  return wasm;
}

// Cheap end-to-end check that the module computes what the TypeScript build does.
function selfTest(k: Kernels): void {
  k.scratchReset();
  const io = k.io();
  io.fill(0, 0, 12);
  io[6] = 5;
  io[7] = -5;
  const zero = k.single();
  const extended = k.extend(zero, 2);
  k.io().fill(0, 0, 6);
  const sorted = k.prioritize(extended);
  k.read(sorted, 0);
  const first = Array.from(k.io().subarray(0, 6));
  const ok = k.count(sorted) === 2 && first.join() === "5,-5,0,0,0,0";
  k.scratchReset();
  if (!ok) throw new Error("WASM kernel self-test failed");
}
