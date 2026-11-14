// §345 landing 0 — write the calibration prints as binary STL (src/technic-printed.js builds them; this only writes).
//   node tools/printed-stl.mjs --out DIR
// coupon-fit.stl (the cross-hole strip), coupon-ring.stl (the lock-radius ring), coupon-ramp.stl (the friction ramp,
// already standing on its long edge). Units mm. Print in the white PLA the parts will be printed from, 100% infill.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadPack } from './technic-pack.mjs';
import * as P from '../src/technic-printed.js';

const i = process.argv.indexOf('--out');
if (i < 0 || !process.argv[i + 1]) { console.error('usage: node tools/printed-stl.mjs --out DIR'); process.exit(2); }
const out = process.argv[i + 1];
mkdirSync(out, { recursive: true });
const c = P.coupons(loadPack());
for (const m of [c.fit, c.ring, c.ramp]) {
  const f = join(out, `${m.name}.stl`);
  writeFileSync(f, P.stlBinary(m.tris, m.name));
  console.log(`${f}: ${m.tris.length} triangles, ${P.meshVolume(m.tris).toFixed(0)} mm³`);
}
