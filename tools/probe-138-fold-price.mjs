// TODO 138 Landing 2 — WHAT DOES THE FOLD COST, IN POSITION SPACE?
// Report, browser, on the shipped tree. Prices the conversion of every bevel
// gear in the movement from the shear-cone form to the apex-ruled one BEFORE
// any of it is cut, which is CLAUDE.md's order of work: prove the group at P0
// in free space (Landing 1, done), then hunt the packaging at P3 with the
// mechanism's dimensions held fixed. Answers three questions the fold turns on:
// where each gear's APEX actually is and whether a pair's two apexes coincide
// (the new form meshes only if they do, and the old form never touched at any
// station so nothing has ever tested it); how each blank's ENVELOPE changes,
// old local extent against new, in the gear's own frame and in world; and what
// stands inside any region the new blank reaches that the old one did not.
//
// The shear form's blank is not the cone it looks like: the extrude runs
// z ∈ [0, faceWidth] and every vertex then moves z += hypot(x,y)·taper, so the
// body spans z from 0 to faceWidth + tipR·taper — for the motion-works mitre
// that is 0 → 2.855, against the conical blank's 1.0 → 1.5. A shrink is the
// expected direction and is nearly free; a GROWTH anywhere is a P3 conflict to
// solve by moving a station, never by trimming the tooth.
//
// cd tools && node probe-138-fold-price.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8519);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
process.on('exit', () => srv.kill());
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });

const out = await page.evaluate(async () => {
  const THREE = await import('three');
  const G = await import('./src/geometry.js');
  const C = window.__clock;
  const rows = [];

  // EVERY bevel in the metal, found by the shear declaration rather than by a
  // name list — a list would go stale the moment a corner is added, and this
  // question is exactly "did we find them all".
  const found = [];
  C.scene.traverse((o) => {
    if (o.isMesh && o.userData.solid && o.userData.solid.shearZ) found.push(o);
  });

  for (const mesh of found) {
    const grp = mesh.parent;                      // makeBevelGear's Group
    const teeth = grp.userData.teeth, module = grp.userData.module;
    mesh.updateMatrixWorld(true);
    const g = mesh.geometry;
    g.computeBoundingBox();
    const lb = g.boundingBox;
    // the apex: the gear group's own origin, in world
    const apex = new THREE.Vector3().setFromMatrixPosition(grp.matrixWorld);
    const axis = new THREE.Vector3(0, 0, 1).transformDirection(grp.matrixWorld).normalize();
    const wb = new THREE.Box3().setFromObject(mesh);
    rows.push({
      name: mesh.name || grp.name || '(unnamed)', group: grp.name || '',
      teeth, module,
      taper: o0(mesh.userData.solid.shearZ), faceW: o0(mesh.userData.solid.zHi - mesh.userData.solid.zLo),
      localZ: [o(lb.min.z), o(lb.max.z)], localR: o(Math.max(Math.abs(lb.min.x), lb.max.x, Math.abs(lb.min.y), lb.max.y)),
      apex: [o(apex.x), o(apex.y), o(apex.z)],
      axis: [o(axis.x), o(axis.y), o(axis.z)],
      worldMin: [o(wb.min.x), o(wb.min.y), o(wb.min.z)],
      worldMax: [o(wb.max.x), o(wb.max.y), o(wb.max.z)],
    });
  }
  function o(v) { return +v.toFixed(4); }
  function o0(v) { return +v.toFixed(4); }

  // The new form's local extent, from the SAME inputs, via the real spec.
  for (const r of rows) {
    try {
      // The face width is DERIVED, not inherited: coneR/3 is the classical
      // blank proportion and the shipped numbers exceed it on 7 of 11 gears.
      // Pricing the fold against the number the fold would actually use.
      const sp = G.bevelToothSpec({ module: r.module, teeth: r.teeth, mateTeeth: r.teeth, boreR: 0.4 });
      // Read the extent off the BUILT mesh rather than restating the blank's
      // shape here — a second copy of that law is exactly the defect this item
      // keeps finding (the shear law lives in subtractorSpec's prose too).
      const g2 = G.makeConicalGear({ teeth: r.teeth, module: r.module, mateTeeth: r.teeth, boreR: 0.4 });
      const bb2 = new THREE.Box3().setFromObject(g2);
      r.newZ = [o(bb2.min.z), o(bb2.max.z)];
      r.newR = o(Math.max(Math.abs(bb2.min.x), bb2.max.x, Math.abs(bb2.min.y), bb2.max.y));
      r.newFace = o(sp.faceW);
      r.gammaDeg = o((sp.gamma * 180) / Math.PI);
      r.coneR = o(sp.coneR);
      r.faceCap = o(sp.coneR / 3);
    } catch (e) { r.err = String(e); }
  }
  // APEX SEPARATION ACROSS THE POSE NET, which is the question the static
  // reading above cannot answer. The alarm SETTING corner engages only when the
  // crown is pulled (runAlarm in probe-crossed-axis-mesh poses
  // alarmCrownPullT: 1), so at rest its two gears stand apart and a rest-pose
  // apex reading says nothing about whether the corner is a corner. The new
  // form meshes only where the two apexes are ONE POINT, so this is P0: measure
  // the separation through the engagement, not at one end of it.
  const pairs = [
    ['alarmDiscBevel', 'alarmStemBevel', 'the declared setting corner'],
    ['alarmStemBevel', 'alarmWindContrate', 'the two that already share an apex at rest'],
    ['mwCornerDropIn', 'mwCornerDropOut', 'control — a corner built by addBevelCorner'],
  ];
  // Found the SAME way the table above labels them, which is the point: a
  // bevel's name may sit on the mesh (alarmDiscBevel) or on the Group that
  // makeBevelGear returned (addBevelCorner writes `${tag}In` there). Matching
  // only meshes found nothing and every row including the CONTROL came back
  // NaN — which is the control earning its place, because the two real rows
  // would have read as a finding.
  const apexOf = (name) => {
    let grp = null;
    C.scene.traverse((o) => {
      if (!o.isMesh || !o.userData.solid || !o.userData.solid.shearZ) return;
      if (o.name === name || (o.parent && o.parent.name === name)) grp = o.parent;
    });
    if (!grp) return null;
    grp.updateMatrixWorld(true);
    return new THREE.Vector3().setFromMatrixPosition(grp.matrixWorld);
  };
  const sweepApex = [];
  for (const [a, b, note] of pairs) {
    const samples = [];
    for (let i = 0; i <= 20; i++) {
      const f = i / 20;
      C.setPose({ tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1,
        alarmCrownRotation: 0, alarmOn: 1, alarmCrownPullT: f });
      C.scene.updateMatrixWorld(true);
      const pa = apexOf(a), pb = apexOf(b);
      if (pa && pb) samples.push({ f: +f.toFixed(2), d: +pa.distanceTo(pb).toFixed(4) });
    }
    C.resetInputs(); C.scene.updateMatrixWorld(true);
    const min = samples.reduce((m, s) => (s.d < m.d ? s : m), samples[0] || { f: 0, d: NaN });
    sweepApex.push({ a, b, note, min, samples });
  }
  return { rows, sweepApex };
});
await browser.close(); srv.kill();

const R = out.rows;
console.log(`${R.length} bevel gear(s) in the metal, found by their shear declaration\n`);
console.log('gear                      teeth  module  γ      coneR   face    face cap  verdict');
for (const r of R)
  console.log(`${r.name.padEnd(25)} ${String(r.teeth).padEnd(6)} ${String(r.module).padEnd(7)} `
    + `${String(r.gammaDeg).padEnd(6)} ${String(r.coneR).padEnd(7)} ${String(r.faceW).padEnd(7)} `
    + `${String(r.faceCap).padEnd(9)} ${r.faceW > r.faceCap ? '✗ face over coneR/3' : 'OK'}`);

console.log('\nENVELOPE, in the gear\'s own frame — the shear blank against the conical one\n');
console.log('gear                      old z            old r    new z            new r    Δz span   Δr');
for (const r of R) {
  r.inside = r.newZ[0] >= r.localZ[0] - 1e-9 && r.newZ[1] <= r.localZ[1] + 1e-9 && r.newR <= r.localR + 1e-9;
  const oldSpan = r.localZ[1] - r.localZ[0], newSpan = r.newZ[1] - r.newZ[0];
  console.log(`${r.name.padEnd(25)} ${`${r.localZ[0]}…${r.localZ[1]}`.padEnd(16)} ${String(r.localR).padEnd(8)} `
    + `${`${r.newZ[0]}…${r.newZ[1]}`.padEnd(16)} ${String(r.newR).padEnd(8)} `
    + `${(newSpan - oldSpan).toFixed(3).padStart(8)}  ${(r.newR - r.localR).toFixed(3).padStart(7)}`
    + `  ${r.inside ? 'inside the old blank' : '✗ REACHES OUTSIDE — site it, do not trim it'}`);
}

// APEX COINCIDENCE — the fold's one hard precondition, and the thing the old
// form could never have tested because it never touched at any station.
console.log('\nAPEXES — the new form meshes only if a pair\'s two apexes are one point\n');
const key = (a) => a.map((v) => v.toFixed(3)).join(',');
const byApex = new Map();
for (const r of R) {
  const k = key(r.apex);
  if (!byApex.has(k)) byApex.set(k, []);
  byApex.get(k).push(r);
}
console.log('apex (world)                   gears sharing it');
for (const [k, list] of byApex)
  console.log(`  ${k.padEnd(30)} ${list.length}: ${list.map((r) => r.name).join(', ')}`
    + (list.length >= 2 ? '' : '   ← ALONE, so its mate\'s apex is somewhere else'));

console.log('\nWORLD BOXES — where each blank actually stands, and whether a "pair" is even adjacent\n');
console.log('gear                      axis                    world x          world y          world z');
for (const r of R)
  console.log(`${r.name.padEnd(25)} ${r.axis.join(',').padEnd(23)} `
    + `${`${r.worldMin[0]}…${r.worldMax[0]}`.padEnd(16)} ${`${r.worldMin[1]}…${r.worldMax[1]}`.padEnd(16)} `
    + `${`${r.worldMin[2]}…${r.worldMax[2]}`}`);

console.log('\nAPEX SEPARATION THROUGH THE ALARM CROWN\'S PULL — the corner engages only when pulled\n');
for (const p of out.sweepApex) {
  console.log(`  ${p.a} \u21c4 ${p.b}   (${p.note})`);
  console.log(`      by pull:  ` + p.samples.map((s) => s.d.toFixed(2)).join(' '));
  console.log(`      CLOSEST the two apexes ever come: ${p.min.d} at pull ${p.min.f}`
    + (p.min.d < 1e-3 ? '   \u2014 one point, so this IS a corner' : '   \u2014 NOT ONE POINT: no tooth form meshes here'));
}

const lone = [...byApex.values()].filter((l) => l.length < 2);
const overFace = R.filter((r) => r.faceW > r.faceCap);
const grew = R.filter((r) => !r.inside);
console.log(`\n${R.length} gears · ${byApex.size} distinct apexes · ${lone.length} with no partner at the same point`);
console.log(`${overFace.length} over the coneR/3 face proportion · ${grew.length} whose blank reaches outside the old one (a P3 conflict to site, not to trim)`);
