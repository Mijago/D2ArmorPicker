// Stable sort over indices, ordered by (key1, key2) ascending: counting sort for narrow key1-only
// sorts, bottom-up merge sort otherwise.

export let key1 = new Int32Array(1024);
export let key2 = new Int32Array(1024);
let indexA = new Int32Array(1024);
let indexB = new Int32Array(1024);
const COUNT_LIMIT: i32 = 4096;
const counts = new Int32Array(COUNT_LIMIT + 2);

export function sortReserve(n: i32): void {
  if (key1.length >= n) return;
  let size = key1.length;
  while (size < n) size *= 2;
  key1 = new Int32Array(size);
  key2 = new Int32Array(size);
  indexA = new Int32Array(size);
  indexB = new Int32Array(size);
}

/** Sorts indices 0..n-1 by the keys already stored; returns the buffer holding the order. */
export function sortRun(n: i32, useKey2: i32): Int32Array {
  let source = indexA;
  let target = indexB;
  if (useKey2 == 0) {
    let min = key1[0];
    let max = min;
    for (let i = 1; i < n; i++) {
      const value = key1[i];
      if (value < min) min = value;
      if (value > max) max = value;
    }
    if (max - min < COUNT_LIMIT) {
      counts.fill(0, 0, max - min + 2);
      for (let i = 0; i < n; i++) counts[key1[i] - min + 1]++;
      for (let bucket = 1; bucket <= max - min + 1; bucket++) counts[bucket] += counts[bucket - 1];
      for (let i = 0; i < n; i++) source[counts[key1[i] - min]++] = i;
      return source;
    }
  }
  for (let i = 0; i < n; i++) source[i] = i;
  let width: i32 = 1;
  while (width < n) {
    let low: i32 = 0;
    while (low < n) {
      const middle: i32 = low + width < n ? low + width : n;
      const high: i32 = low + 2 * width < n ? low + 2 * width : n;
      let left = low;
      let right = middle;
      let out = low;
      while (left < middle && right < high) {
        const x = source[left];
        const y = source[right];
        let takeRight = false;
        if (key1[y] < key1[x]) takeRight = true;
        else if (useKey2 != 0 && key1[y] == key1[x] && key2[y] < key2[x]) takeRight = true;
        if (takeRight) {
          target[out] = y;
          right++;
        } else {
          target[out] = x;
          left++;
        }
        out++;
      }
      while (left < middle) {
        target[out] = source[left];
        left++;
        out++;
      }
      while (right < high) {
        target[out] = source[right];
        right++;
        out++;
      }
      low += 2 * width;
    }
    const swap = source;
    source = target;
    target = swap;
    width *= 2;
  }
  return source;
}
