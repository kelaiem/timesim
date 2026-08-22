// §152 probe two — THE IRREDUCIBLE PER-POSE FLOOR.
//
// A restriction removes PAIR work. It cannot remove the work every pose costs
// whatever pairs survive: setPose (which walks the whole solver and every
// dependent build) and the unit-AABB rebuild the broad phase consumes. If
// that floor is a large fraction of a sweep, restricting the pairs buys far
// less than the pair arithmetic suggests — so it is measured before anything
// is designed against it.
//
// Measured per axis against the harness's own measured per-axis wall.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { INSPECTION_SLICES } from './battery-split.mjs';

// §152's third landing moved the measured walls out of INSPECTION_SLICES and
// into ci-battery.mjs's COSTS, so that refreshing them cannot void the
// check-code digest. They are read from that source rather than copied here: a
// second copy of a measured column is a second column to keep in step. Reading
// NOTHING must not read as a clean answer either, so a literal that does not
// parse is a hard failure.
function costs() {
  const src = readFileSync(new URL('./ci-battery.mjs', import.meta.url), 'utf8');
  const m = src.match(/^const COSTS = \{$([\s\S]*?)^\};$/m);
  if (!m) throw new Error('ci-battery.mjs: COSTS did not parse — this probe has nothing to measure against');
  return new Function(`return {${m[1]}};`)();
}
const COSTS = costs();

const port = process.env.PORT || '8532';
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 90000 });
await p.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });

const out = await p.evaluate(async (axisNames) => {
  const I = await import('./src/inspect.js');
  const c = window.__clock;
  const EXCLUDED = ['Dial', 'Power reserve', 'Small seconds'];
  const unitsOf = () => {
    const out = [];
    for (const { name, obj } of c.labelEntries) {
      const meshes = [];
      (function walk(o) {
        if (o.userData && o.userData.schematic) return;
        if (o.isMesh && o.geometry && o.geometry.attributes.position) meshes.push(o);
        for (const ch of o.children) walk(ch);
      })(obj);
      if (meshes.length) out.push({ name, obj, meshes });
    }
    return out;
  };
  const U = unitsOf();
  const g0 = U[0].meshes[0].geometry;
  if (g0.boundingBox === null) g0.computeBoundingBox();
  const Box3C = g0.boundingBox.constructor;

  const rows = [];
  for (const name of axisNames) {
    const axis = I.AXES.find((a) => a.name === name);
    if (!axis) { rows.push({ axis: name, missing: true }); continue; }
    I.enterAxis(c);
    // sample 13 evenly spaced fractions of the axis
    const N = 12;
    let poseMs = 0, boxMs = 0, unitMeshAabb = 0;
    for (let i = 0; i <= N; i++) {
      const f = i / N;
      const t0 = performance.now();
      c.setPose(axis.pose(f, c));
      poseMs += performance.now() - t0;
      const t1 = performance.now();
      const boxes = U.map((u) => new Box3C().setFromObject(u.obj));
      boxMs += performance.now() - t1;
      let hits = 0;
      for (let a = 0; a < U.length; a++) for (let bq = a + 1; bq < U.length; bq++) if (boxes[a].intersectsBox(boxes[bq])) hits++;
      unitMeshAabb += hits;
    }
    rows.push({
      axis: name, n: axis.n,
      setPoseMs: +(poseMs / (N + 1)).toFixed(2),
      unitBoxesMs: +(boxMs / (N + 1)).toFixed(2),
      aabbPassPairs: +(unitMeshAabb / (N + 1)).toFixed(1),
    });
  }
  return { rows, axes: I.AXES.map((a) => ({ name: a.name, n: a.n })), units: U.length };
}, INSPECTION_SLICES.map((s) => s.axis));

await b.close(); srv.kill();

const bySlice = new Map(INSPECTION_SLICES.map((s) => [s.axis, s]));
let floor = 0, total = 0;
const table = out.rows.map((r) => {
  const poses = bySlice.get(r.axis).poses;
  const ms = COSTS[`inspection:${r.axis}`];
  const floorMs = (r.setPoseMs + r.unitBoxesMs) * poses;
  floor += floorMs; total += ms;
  return { ...r, poses, measuredMs: ms, floorMs: Math.round(floorMs), floorPct: +(100 * floorMs / ms).toFixed(2) };
});
console.log(JSON.stringify({ units: out.units, table }, null, 1));
console.log(`floor ${(floor / 1000).toFixed(1)}s of measured ${(total / 1000).toFixed(1)}s = ${(100 * floor / total).toFixed(2)}%`);
