// §343 — PATCH A MODULE'S SOURCE TEXT for one native boot, so a probe can boot
// the build with one row changed (a radius one step past the shipped one, say)
// without editing src/. Register it before bootNative:
//
//   import { register } from 'node:module';
//   process.env.TIMESIM_PATCH = JSON.stringify([{ file: 'src/layout.js', from: 'a', to: 'b' }]);
//   register('./native/source-patch.mjs', import.meta.url);
//
// Each `from` must occur in its file EXACTLY ONCE, or the load throws: a patch
// that matched nothing would boot the unpatched build and read as a measurement
// of the patched one.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PATCHES = JSON.parse(process.env.TIMESIM_PATCH || '[]');

export async function load(url, context, next) {
  const mine = url.startsWith('file:') ? PATCHES.filter((p) => fileURLToPath(url).endsWith(p.file)) : [];
  if (!mine.length) return next(url, context);
  let src = readFileSync(fileURLToPath(url), 'utf8');
  for (const p of mine) {
    const n = src.split(p.from).length - 1;
    if (n !== 1) throw new Error(`source-patch: '${p.from}' occurs ${n} times in ${p.file}, not once`);
    src = src.replace(p.from, p.to);
  }
  return { format: 'module', source: src, shortCircuit: true };
}
