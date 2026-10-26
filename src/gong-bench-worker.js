// BUILT §310 — the gong bench's solver, off the page's thread: src/gong-solve.js' solveGong, the build's own
// copy, on the map and options gong-bench.html posts. A module worker, so it imports rather than inlines.
import { solveGong } from './gong-solve.js';

self.onmessage = (e) => {
  const { map, opts } = e.data;
  map.free = new Uint8Array(map.free);
  try { self.postMessage({ done: solveGong(map, opts, (msg) => self.postMessage({ progress: msg })) }); }
  catch (err) { self.postMessage({ error: String(err && err.stack || err) }); }
};
