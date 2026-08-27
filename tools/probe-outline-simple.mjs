// TODO 100 — is every extruded outline a SIMPLE polygon?
//
// The pallet fork's crossed itself for as long as the part existed and every
// gate in the battery passed it (§175). This asks the question of the whole
// movement, and it asks it of the BUILT geometry rather than of the source, so
// no builder has to export anything for the measurement to happen.
//
// HOW IT READS THE OUTLINE. `ExtrudeGeometry` keeps what it was given —
// `geometry.parameters.shapes` — so the AUTHORED curve is still on every built
// mesh and no builder has to export anything for this to run. Each shape is
// sampled at its own `curveSegments` and every ring (the outline and each
// hole) is tested for self-intersection the same way §175 tests the fork's:
// every pair of non-adjacent segments.
//
// A SIGNATURE THAT DOES NOT WORK, recorded because it looked obvious and cost
// a round. The first cut of this probe read the cap's triangulation instead:
// earcut winds a simple polygon consistently, so |Σ signed| / Σ|signed| over
// the cap should be 1 for a sound outline and below 1 for a folded one. It is
// not. Measured, a bowtie extrudes to NO readable cap at all and a
// fork-shaped crossing reads exactly 1.000000 — earcut quietly reinterprets a
// self-crossing polygon rather than emitting mixed windings. That probe swept
// the movement and reported "372 geometries, 0 folded", which is a clean
// answer to a question it was not asking. Its controls caught it. Controls are
// why this file has them.
//
// A REPORT. It prints every cap it could read and ranks them; it does not
// decide what an acceptable ratio is, because nobody has looked at these
// bodies yet and a threshold invented here would be a guess dressed as a gate.
// What it DOES fail on is its own controls (below) — an instrument that cannot
// demonstrate it would catch the defect is not evidence that there is none.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const PORT = Number(process.env.PORT || 8521);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'],
  { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
page.setDefaultTimeout(180000);
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${PORT}/index.html?schematic=0`, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 60000 });
await new Promise((r) => setTimeout(r, 2500));

const out = await page.evaluate(async () => {
  const THREE = await import('three');

  // Every pair of non-adjacent segments of one closed ring.
  function ringCrossings(pts) {
    const n = pts.length, hits = [];
    if (n < 4) return hits;
    const X = (p1, p2, q1, q2) => {
      const d1x = p2.x - p1.x, d1y = p2.y - p1.y;
      const d2x = q2.x - q1.x, d2y = q2.y - q1.y;
      const den = d1x * d2y - d1y * d2x;
      if (Math.abs(den) < 1e-14) return null;
      const t = ((q1.x - p1.x) * d2y - (q1.y - p1.y) * d2x) / den;
      const u = ((q1.x - p1.x) * d1y - (q1.y - p1.y) * d1x) / den;
      return (t > 1e-9 && t < 1 - 1e-9 && u > 1e-9 && u < 1 - 1e-9)
        ? { x: p1.x + t * d1x, y: p1.y + t * d1y } : null;
    };
    for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const h = X(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n]);
      if (h) hits.push({ i, j, at: [+h.x.toFixed(4), +h.y.toFixed(4)] });
    }
    return hits;
  }

  // Sample a shape's rings the way the extrude did, drop a wrap-around
  // duplicate (the loop is closed by definition, so a repeated last point is
  // a zero-length edge and not a crossing).
  function ringsOf(shape, segs) {
    const rings = [];
    const take = (path, kind) => {
      const p = path.getPoints(segs);
      if (p.length > 1 && p[p.length - 1].equals(p[0])) p.pop();
      if (p.length >= 4) rings.push({ kind, pts: p });
    };
    take(shape, 'outline');
    for (const h of shape.holes || []) take(h, 'hole');
    return rings;
  }

  function shapeVerdict(geo) {
    const par = geo.parameters;
    if (!par || !par.shapes) return null;
    const shapes = Array.isArray(par.shapes) ? par.shapes : [par.shapes];
    const segs = par.options?.curveSegments ?? 12;
    let pts = 0, rings = 0;
    const hits = [];
    for (const sh of shapes) {
      if (!sh || typeof sh.getPoints !== 'function') continue;
      for (const r of ringsOf(sh, segs)) {
        rings++; pts += r.pts.length;
        for (const h of ringCrossings(r.pts)) hits.push({ ring: r.kind, ...h });
      }
    }
    return rings ? { rings, pts, hits } : null;
  }

  // --- CONTROLS, run before anything is believed --------------------------
  const mk = (shape, bevel) => new THREE.ExtrudeGeometry(shape, {
    depth: 1, bevelEnabled: !!bevel, bevelThickness: 0.1, bevelSize: 0.1,
    bevelSegments: 1, curveSegments: 4,
  });
  const poly = (pts) => { const s = new THREE.Shape();
    s.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts.slice(1)) s.lineTo(p[0], p[1]);
    return s; };
  const square = poly([[0, 0], [4, 0], [4, 4], [0, 4]]);
  const bowtie = poly([[0, 0], [4, 4], [4, 0], [0, 4]]);          // crosses itself
  const holed = poly([[0, 0], [6, 0], [6, 6], [0, 6]]);
  const hole = new THREE.Path();
  hole.moveTo(2, 2); hole.lineTo(4, 2); hole.lineTo(4, 4); hole.lineTo(2, 4);
  holed.holes.push(hole);
  // A fork-shaped control: a bar with a slot WIDER than the bar at that
  // station — the exact defect §175 fixed, reproduced from scratch.
  const forkLike = poly([
    [-0.6, 0], [-0.6, -8], [-1.4, -9.4], [-0.85, -9.6], [-0.7, -6.6],
    [0.7, -6.6], [0.85, -9.6], [1.4, -9.4], [0.6, -8], [0.6, 0],
  ]);
  const controls = {
    square: shapeVerdict(mk(square)),
    squareBevelled: shapeVerdict(mk(square, true)),
    holed: shapeVerdict(mk(holed)),
    bowtie: shapeVerdict(mk(bowtie)),
    forkLike: shapeVerdict(mk(forkLike)),
  };

  // --- the movement --------------------------------------------------------
  const clock = window.__clock;
  clock.resetInputs();
  const seen = new Set(), rows = [];
  for (const e of clock.labelEntries) {
    e.obj.traverse((o) => {
      if (!o.isMesh || !o.geometry || seen.has(o.geometry.uuid)) return;
      seen.add(o.geometry.uuid);
      if (o.userData?.schematic) return;          // display, not metal
      const r = shapeVerdict(o.geometry);
      if (!r) { rows.push({ unit: e.name, mesh: o.name || '(unnamed)',
        type: o.geometry.type, unreadable: true }); return; }
      rows.push({ unit: e.name, mesh: o.name || '(unnamed)',
        type: o.geometry.type, rings: r.rings, pts: r.pts, hits: r.hits });
    });
  }
  return { controls, rows };
});
await browser.close(); srv.kill();

console.log('CONTROLS — self-intersections in the authored rings:\n');
for (const [k, v] of Object.entries(out.controls))
  console.log(`  ${k.padEnd(15)} ${v ? `${v.hits.length} crossing(s) over ${v.rings} ring(s), ${v.pts} pts` : 'no readable shape'}`);

const sound = ['square', 'squareBevelled', 'holed'];
const folded = ['bowtie', 'forkLike'];
const bad = [];
for (const k of sound) if (!(out.controls[k] && out.controls[k].hits.length === 0))
  bad.push(`${k} is a simple polygon and must read 0 crossings, but reads `
    + `${out.controls[k] ? out.controls[k].hits.length : 'nothing'}`);
for (const k of folded) if (!(out.controls[k] && out.controls[k].hits.length > 0))
  bad.push(`${k} crosses itself and must be CAUGHT, but reads `
    + `${out.controls[k] ? out.controls[k].hits.length : 'nothing'}`);
if (bad.length) {
  console.log('\nCONTROLS FAILED — this instrument cannot be trusted to see the defect:');
  for (const b of bad) console.log('  · ' + b);
  process.exitCode = 1;
} else {
  console.log('\ncontrols PASS — a folded ring is caught, a sound one (bevelled, or with a hole) is not.');
}

const readable = out.rows.filter((r) => !r.unreadable);
const unreadable = out.rows.filter((r) => r.unreadable);
const suspect = readable.filter((r) => r.hits.length);
console.log(`\nTHE MOVEMENT\n`);
console.log(`  geometries whose authored shape could be read : ${readable.length}`);
console.log(`  rings tested                                  : ${readable.reduce((a, r) => a + r.rings, 0)}`);
console.log(`  geometries with a SELF-CROSSING ring          : ${suspect.length}`);
console.log(`  geometries with no readable shape             : ${unreadable.length}`);
// Coverage is the claim this report lives or dies on. A geometry with no
// authored shape is fine when it never had one — a cylinder, a box, a lathe —
// and is a HOLE in the sweep when it is an extrude whose shape went missing.
const byType = new Map();
for (const r of unreadable) byType.set(r.type, (byType.get(r.type) || 0) + 1);
const missedExtrudes = unreadable.filter((r) => /Extrude/i.test(r.type));
console.log(`\n  what the unreadable ones are:`);
for (const [t, c] of [...byType].sort((a, b) => b[1] - a[1]))
  console.log(`    ${String(c).padStart(4)}  ${t}`);
if (missedExtrudes.length) {
  console.log(`\n  ${missedExtrudes.length} EXTRUDE(S) WITH NO SHAPE — a hole in this sweep, not a clean result:`);
  for (const r of missedExtrudes.slice(0, 10)) console.log(`    ${r.unit} / ${r.mesh}`);
  process.exitCode = 1;
}
if (suspect.length) {
  console.log('\n  crossings  unit / mesh');
  for (const r of suspect.sort((a, b) => b.hits.length - a.hits.length)) {
    console.log(`  ${String(r.hits.length).padStart(9)}  ${r.unit} / ${r.mesh} (${r.type})`);
    for (const h of r.hits.slice(0, 4))
      console.log(`             ${h.ring} edge ${h.i} x edge ${h.j} at ${h.at.join(', ')}`);
    if (r.hits.length > 4) console.log(`             … ${r.hits.length - 4} more`);
  }
} else {
  console.log('\n  No authored ring in the movement crosses itself.');
}
