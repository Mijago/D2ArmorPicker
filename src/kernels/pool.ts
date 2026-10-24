// Tuning sets live in one growable Int32Array: [count, t0 x6, t1 x6, ...]. A set handle is the
// offset of its count. Persistent sets (cached accumulators) sit below `persistentTop`; every
// other set is scratch and is discarded by scratchReset().

export const IO_SIZE: i32 = 65536;
/** Scratch buffer for arguments and results; the host fills it before each call. */
export const IO = new Int32Array(IO_SIZE);

export const STRIDE: i32 = 6;

export let pool = new Int32Array(1048576);
let persistentTop: i32 = 0;
let top: i32 = 0;
let generation: i32 = 1;

function ensure(end: i32): void {
  if (end <= pool.length) return;
  let size = pool.length;
  while (size < end) size *= 2;
  const next = new Int32Array(size);
  for (let i = 0; i < top; i++) next[i] = pool[i];
  pool = next;
}

/** Reserves room for `count` tunings; call finish() with the number actually written. */
export function alloc(count: i32): i32 {
  const handle = top;
  ensure(handle + 1 + count * STRIDE);
  top = handle + 1 + count * STRIDE;
  return handle;
}

export function finish(handle: i32, count: i32): i32 {
  pool[handle] = count;
  top = handle + 1 + count * STRIDE;
  return handle;
}

export function mark(): i32 {
  return top;
}

export function release(to: i32): void {
  top = to;
}

export function scratchReset(): void {
  top = persistentTop;
}

/** Moves a set into the persistent region; invalidates every other scratch set. */
export function keep(handle: i32): i32 {
  const length = 1 + pool[handle] * STRIDE;
  const dest = persistentTop;
  for (let i = 0; i < length; i++) pool[dest + i] = pool[handle + i];
  persistentTop = dest + length;
  top = persistentTop;
  return dest;
}

/** Drops all persistent sets. A scratch set above them stays readable until keep() moves it. */
export function clearPersistent(): void {
  persistentTop = 0;
  generation++;
}

export function persistentGeneration(): i32 {
  return generation;
}

export function count(handle: i32): i32 {
  return pool[handle];
}
