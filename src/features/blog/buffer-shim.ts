import { Buffer } from "buffer";

// gray-matter expects Node's Buffer, which doesn't exist in browsers.
const globalScope = globalThis as { Buffer?: typeof Buffer };
if (typeof globalScope.Buffer === "undefined") {
  globalScope.Buffer = Buffer;
}
