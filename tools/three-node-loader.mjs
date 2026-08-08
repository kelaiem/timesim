// §88 — resolve the app's bare `three` specifiers when a tool imports src/
// modules under Node.
//
// index.html supplies an importmap; Node has no such thing, so `import * as
// THREE from 'three'` inside src/geometry.js is unresolvable off the browser.
// This hook maps the two names that importmap defines, to the same vendored
// files, so a tool can drive the REAL builders rather than a copy of their
// arithmetic. Register it with:
//
//   node --import ./tools/three-node-loader.mjs <tool>
//
// Deliberately only those two names: anything else falls through to Node's own
// resolution, so this cannot quietly satisfy an import the browser would fail.
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

const here = new URL('.', import.meta.url);
const MAP = {
  three: new URL('../vendor/three.module.js', here).href,
  'three/addons/controls/OrbitControls.js': new URL('../vendor/OrbitControls.js', here).href,
};

if (!process.env.__THREE_NODE_LOADER__) {
  process.env.__THREE_NODE_LOADER__ = '1';
  register(pathToFileURL(new URL('three-node-loader.mjs', here).pathname).href, here.href);
}

export function resolve(specifier, context, next) {
  const hit = MAP[specifier];
  return hit ? { url: hit, shortCircuit: true } : next(specifier, context);
}
