import { Buffer } from "buffer";

if (typeof window.Buffer === "undefined") {
  window.Buffer = Buffer;
}
if (typeof window.global === "undefined") {
  window.global = window;
}
