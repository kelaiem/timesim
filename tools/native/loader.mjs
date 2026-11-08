// §338 landing 1 — module resolution for the native host. Register with
//
//   node --import ./tools/native/loader.mjs <tool>
//
// index.html's importmap maps `three` and its OrbitControls addon; Node has no
// importmap. tools/three-node-loader.mjs (§88) maps both to the vendored files
// for tools that call the builders. The HOST maps `three` to
// three-headless.mjs instead (the vendored module with a GPU-free renderer),
// because it runs main.js, which constructs a renderer before any part. The
// addon maps to the vendored file as §88's does. Anything else falls through
// to Node's own resolution, so this cannot satisfy an import a browser would
// fail.
import { register } from 'node:module';

const MAP = {
  three: new URL('./three-headless.mjs', import.meta.url).href,
  'three/addons/controls/OrbitControls.js': new URL('../../vendor/OrbitControls.js', import.meta.url).href,
};

if (!process.env.__TIMESIM_NATIVE_LOADER__) {
  process.env.__TIMESIM_NATIVE_LOADER__ = '1';
  register(import.meta.url);
}

export function resolve(specifier, context, next) {
  const hit = MAP[specifier];
  return hit ? { url: hit, shortCircuit: true } : next(specifier, context);
}
