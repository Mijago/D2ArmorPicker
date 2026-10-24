// Integer helpers; Math.min/max are f64-only in AssemblyScript.
export function imin(a: i32, b: i32): i32 {
  return a < b ? a : b;
}

export function imax(a: i32, b: i32): i32 {
  return a > b ? a : b;
}
