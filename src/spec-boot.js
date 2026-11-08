// §338 landing 1 — the page's half of src/spec-fields.js: publish the URL's
// spec before anything that reads it is evaluated. index.html's entry module
// imports this FIRST; a module's dependencies evaluate in import order, so
// layout.js (which reads __WATCH_SPEC at import time) always sees it. A host
// that is not a page calls publishSpec itself (tools/native/host.mjs).
import { publishSpec } from './spec-fields.js';
// The spec this page boots (also on globalThis.__WATCH_SPEC when non-empty).
export const BOOT_SPEC = Object.freeze(publishSpec(location.search));
