// AssemblyScript entry: the shared API plus the address of the IO buffer.
import { IO } from "./pool";

export * from "./api";

export function ioPtr(): usize {
  return IO.dataStart;
}
