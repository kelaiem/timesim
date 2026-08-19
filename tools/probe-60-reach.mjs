// TODO 60 — DOES EVERY ROTOR HAVE AN ARBOR IN ITS BORE?
//
// §129 shipped a defect twice in one session: a wheel whose arbor stopped
// below it. The first instance (the finger's output pinion at z 7.27 on
// nothing) was caught by RENDERING the unit and looking. The second — leg B's
// pinion — survived, because no gate asks this question and the eye had moved
// on.
//
// It survives on purpose, three ways over, and none of them is a bug in the
// gate that misses it:
//   · a wheel with an empty bore collides with NOTHING, so no clearance
//     sweep, hull overlap or penetration budget has anything to report;
//   · `assembly` asks whether a rigid group is one connected body, and a
//     ZERO-HEIGHT sleeve is the perfect connector — it satisfies connectivity
//     while occupying no space;
//   · `checkSupportGeometry` is UNIT-granular: one touching mesh discharges
//     the whole edge, so `Alarm winding arrest → plate` passes the moment any
//     ONE of four columns reaches the plate. Every wheel in that unit could be
//     floating and the row would still read `gap 0.000, ok`.
//
// So this probe asks the per-MEMBER question instead: for each rotor, is there
// metal spanning its own axis at its own height? That is what "an arbor in the
// bore" means, and it is cheap — world boxes, no BVH, no sweep.
//
// THE TEST, and why a bounding box is enough here. A rotor is coaxial with its
// arbor, so "is there an arbor in this bore" reduces to "does some other mesh
// of this unit contain the rotor's axis point at the rotor's mid-height". A
// cylinder's world box contains its own axis, so the test is exact for the
// case it exists for and merely conservative elsewhere — it can report a NEAR
// miss as a hit, never a real hit as a miss. It is the false-negative direction
// that would matter, and this cannot produce one.
//
// Run: node tools/probe-60-reach.mjs
//      UNIT='Alarm winding arrest' node tools/probe-60-reach.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const port = process.env.PORT || '8531';
const UNIT = process.env.UNIT || 'Alarm winding arrest';
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'],
  { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));

const browser = await chromium.launch();
const page = await browser.newPage();
const warns = [];
page.on('console', (m) => { if (m.type() === 'warning') warns.push(m.text()); });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__clock, null, { timeout: 60000 });

const out = await page.evaluate((unitName) => {
  const clock = window.__clock;
  clock.scene.updateMatrixWorld(true);
  const entry = clock.labelEntries.find((e) => e.name === unitName);
  if (!entry) return { error: `no unit named ${unitName}` };

  // §71: the schematic tier is display, never metal — prune it wherever it
  // roots, the same rule collectUnits obeys.
  const meshes = [];
  (function walk(o) {
    if (o.userData && o.userData.schematic) return;
    if (o.isMesh && o.geometry && o.geometry.attributes.position) meshes.push(o);
    for (const c of o.children) walk(c);
  })(entry.obj);

  const THREE = window.__clock.THREE || null;
  const boxOf = (m) => {
    m.geometry.computeBoundingBox();
    const bb = m.geometry.boundingBox.clone();
    bb.applyMatrix4(m.matrixWorld);
    return bb;
  };

  const rows = meshes.map((m) => {
    const b = boxOf(m);
    const w = new (b.min.constructor)();
    m.getWorldPosition(w);
    return {
      name: m.name || '(unnamed)',
      axis: [+w.x.toFixed(4), +w.y.toFixed(4)],
      z: [+b.min.z.toFixed(4), +b.max.z.toFixed(4)],
      zMid: +((b.min.z + b.max.z) / 2).toFixed(4),
      r: +Math.max(b.max.x - w.x, b.max.y - w.y).toFixed(4),
      box: { min: [b.min.x, b.min.y, b.min.z], max: [b.max.x, b.max.y, b.max.z] },
    };
  });

  // A ROTOR is a member whose builder gave it a pitch radius (makeGear /
  // makePinion record userData.r) — asking the builder rather than guessing
  // from the name, so a renamed part cannot fall out of the population.
  const rotorNames = new Set();
  (function walk(o) {
    if (o.userData && o.userData.schematic) return;
    if (o.userData && typeof o.userData.r === 'number') {
      o.traverse((c) => { if (c.isMesh && c.name) rotorNames.add(c.name); });
    }
    for (const c of o.children) walk(c);
  })(entry.obj);

  const spans = (row, x, y, z) =>
    x >= row.box.min[0] && x <= row.box.max[0] &&
    y >= row.box.min[1] && y <= row.box.max[1] &&
    z >= row.box.min[2] && z <= row.box.max[2];

  const verdicts = [];
  for (const row of rows) {
    if (!rotorNames.has(row.name)) continue;
    const holders = rows.filter((o) =>
      o.name !== row.name && spans(o, row.axis[0], row.axis[1], row.zMid));
    // The gap that matters when nothing holds it: how far the nearest
    // co-axial candidate stops SHORT, in z.
    let shortfall = null;
    if (!holders.length) {
      const coax = rows.filter((o) => o.name !== row.name
        && Math.hypot(o.axis[0] - row.axis[0], o.axis[1] - row.axis[1]) < 0.05);
      for (const c of coax) {
        const d = row.zMid > c.box.max[2] ? row.zMid - c.box.max[2]
          : row.zMid < c.box.min[2] ? c.box.min[2] - row.zMid : 0;
        if (shortfall === null || d < shortfall) shortfall = +d.toFixed(4);
      }
    }
    verdicts.push({
      rotor: row.name, zMid: row.zMid, z: row.z,
      held: holders.length > 0,
      by: holders.map((h) => h.name),
      shortfall,
    });
  }

  const degenerate = rows.filter((r) => r.z[1] - r.z[0] < 1e-9)
    .map((r) => ({ name: r.name, z: r.z }));

  return {
    unit: unitName,
    meshes: rows.length,
    stack: rows.slice().sort((a, b) => a.zMid - b.zMid)
      .map((r) => ({ name: r.name, z: r.z, axis: r.axis, r: r.r })),
    verdicts,
    degenerate,
  };
}, UNIT);

await browser.close();
srv.kill();

if (out.error) { console.error(out.error); process.exit(1); }

console.log(`\n=== ${out.unit} — ${out.meshes} meshes, low to high ===`);
for (const s of out.stack) {
  console.log(`  ${s.name.padEnd(24)} z ${String(s.z[0]).padStart(9)} … ${String(s.z[1]).padStart(9)}`
    + `   axis (${s.axis[0]}, ${s.axis[1]})  r ${s.r}`);
}

console.log(`\n=== degenerate solids (zero z-extent) ===`);
if (!out.degenerate.length) console.log('  none');
for (const d of out.degenerate) console.log(`  ${d.name}  z ${d.z[0]} … ${d.z[1]}  ← extrudes at depth 0`);

console.log(`\n=== reach: does every rotor have metal spanning its own axis? ===`);
let bad = 0;
for (const v of out.verdicts) {
  if (v.held) {
    console.log(`  OK       ${v.rotor.padEnd(22)} z ${v.zMid}  held by ${v.by.join(', ')}`);
  } else {
    bad++;
    console.log(`  FLOATING ${v.rotor.padEnd(22)} z ${v.zMid}  nothing spans its axis`
      + (v.shortfall !== null ? `; nearest co-axial metal stops ${v.shortfall} short` : ''));
  }
}

console.log(`\nboot warnings: ${warns.length}`);
for (const w of warns) console.log(`  · ${w}`);
console.log(`\n${bad} floating rotor(s), ${out.degenerate.length} degenerate solid(s)`);
process.exit(bad || out.degenerate.length ? 1 : 0);
