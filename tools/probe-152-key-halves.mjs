// §152 Landing 0's acceptance — DOES THE KEY REALLY HAVE TWO HALVES?
//
// A key that only ever fires on both halves at once has not been shown to have
// two, and the reason the second half exists is a specific failure the first
// cannot see: a part that is MOVED but not re-cut — every §13-class layout
// re-solve — has identical vertices and different verdicts.
//
// So the two halves are exercised SEPARATELY, surgically, on a live page:
//
//   SHAPE  perturb one vertex of one mesh. Nothing moves; the metal changes.
//          SHAPE must move for that unit and PLACE must hold.
//   PLACE  translate one mesh by 0.01 without touching a vertex. The metal is
//          identical; it sits somewhere else. PLACE must move and SHAPE hold.
//
// In both cases EVERY OTHER UNIT must be untouched — a key that smears across
// units would restrict nothing and skip nothing.
//
// Done in-page rather than by editing source because the point is the
// SENSITIVITY of the measurement, not the plumbing of a build: a one-vertex
// perturbation is the smallest change that must be visible, and no source edit
// is that small.
//
//   node tools/probe-152-key-halves.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const port = process.env.PORT || '8554';
const root = process.env.ROOT || '..';
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const b = await chromium.launch();
const p = await b.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await p.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 90000 });
await p.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });
await p.evaluate(async () => { window.__I = await import('./src/inspect.js'); });

const out = await p.evaluate(() => {
  const c = window.__clock;
  const D = () => window.__I.unitDigests(c);
  // A unit that is neither a morphing pool nor the always-changed chain, so
  // the perturbation is the only thing the digest can be reacting to.
  const TARGET = 'Maintaining detent';
  const entry = c.labelEntries.find((e) => e.name === TARGET);
  let mesh = null;
  (function walk(o) {
    if (o.userData && o.userData.schematic) return;
    if (!mesh && o.isMesh && o.geometry?.attributes?.position) mesh = o;
    for (const ch of o.children) walk(ch);
  })(entry.obj);

  const base = D();
  const diff = (a, bb, half) => Object.keys(a.units)
    .filter((n) => a.units[n][half] !== bb.units[n][half]);

  // ---- SHAPE: one vertex, moved ------------------------------------------
  const pos = mesh.geometry.attributes.position;
  const v0 = pos.getX(0);
  pos.setX(0, v0 + 0.01);
  pos.needsUpdate = true;
  const shaped = D();
  pos.setX(0, v0); pos.needsUpdate = true;

  // ---- PLACE: one mesh, translated ---------------------------------------
  const z0 = mesh.position.z;
  mesh.position.z = z0 + 0.01;
  mesh.updateMatrix();
  const placed = D();
  mesh.position.z = z0; mesh.updateMatrix();

  const restored = D();
  return {
    target: TARGET,
    mesh: mesh.name || '(unnamed)',
    unitCount: base.unitCount,
    shapeEdit: { shapeMoved: diff(base, shaped, 'shape'), placeMoved: diff(base, shaped, 'place') },
    placeEdit: { shapeMoved: diff(base, placed, 'shape'), placeMoved: diff(base, placed, 'place') },
    restoredClean: diff(base, restored, 'shape').length === 0 && diff(base, restored, 'place').length === 0,
  };
});
await b.close(); srv.kill();

console.log(JSON.stringify(out, null, 1));
const fail = [];
const only = (arr, n) => arr.length === 1 && arr[0] === n;
if (!only(out.shapeEdit.shapeMoved, out.target)) fail.push('a one-vertex edit did not move exactly its unit\'s SHAPE');
if (out.shapeEdit.placeMoved.length) fail.push('a one-vertex edit moved a PLACE digest — the halves are not separate');
if (!only(out.placeEdit.placeMoved, out.target)) fail.push('a translated mesh did not move exactly its unit\'s PLACE');
if (out.placeEdit.shapeMoved.length) fail.push('a translated mesh moved a SHAPE digest — the halves are not separate');
if (!out.restoredClean) fail.push('undoing both edits did not restore the original digests');
if (fail.length) { console.error('FAILED:\n  ' + fail.join('\n  ')); process.exitCode = 1; }
else console.log(`PASS — both halves fire independently, on one unit of ${out.unitCount}, and reverse cleanly`);
