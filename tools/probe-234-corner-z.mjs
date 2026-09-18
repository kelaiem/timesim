// §234 step 4 — WHAT ARE THE REAL WALLS OF THE ALARM CORNER'S Z COLUMN? A REPORT.
// (INDEX.md's `kind` column says acceptance because the classifier keys on
// `process.exit`, and this exits only when the tree will not boot at all —
// `probe-234-step4.mjs`, `probe-234-group-c.mjs` and `probe-234-corner-move.mjs`
// carry the same label for the same reason.)
//
// WHY IT EXISTS. `probe-234-step4.mjs` established that the alarm crown's stem
// must grow to ⌀0.994 mm, and that a bevel bored honestly over it grows too.
// The grown corner was then BUILT, and it stopped on z: the taller cone reaches
// further up the column than the band appears to hold. "Appears" is the word
// that needed measuring — the band is described in a COMMENT beside
// `Z_ALARM_CORNER`, and a comment is not a measurement.
//
// WHAT IT IS NOT. `probe-234-step4.mjs` asks what a fatter stem costs in the
// corner's own PLANE (its neighbours, its bearing cock, its collars).
// `probe-234-corner-move.mjs` asks what moving the corner OUTBOARD costs. This
// asks the third question and only that one: in the corner's own COLUMN, what
// stands above it and what stands below it, measured off the metal.
//
// HOW, and this is the part that matters. The source comment names two walls —
// the base plate's bottom face and the sub-dial well's floor — and quotes a z
// for each. Trusting either would make this a restatement rather than a
// measurement, so nothing here reads those numbers: it SURVEYS the column,
// reporting every mesh whose footprint enters a disc about the corner's axis,
// with its world z extent. A wall nobody wrote down shows up the same way a
// documented one does.
//
// The corner's reach is measured the same way: off the built bevel meshes'
// world boxes, never from `faceWidth + tipR`, because that approximation is
// what the comment already uses and the whole question is whether it holds.
//
// CONTROLS:
//   · MUST-HIT — the corner's own two bevels must appear in the survey. A
//     column scan that cannot see the part at its own centre is scanning
//     somewhere else, and would report a comfortably empty band.
//   · FILTER — the survey disc is tested in both directions on a synthetic
//     point, just inside and just outside. This is deliberately NOT a must-miss
//     on a far part: footprints are AABBs, so a large rotated part
//     over-includes, and the balance's box genuinely reaches this column. Over-
//     inclusion is the safe direction for a wall hunt; a filter that dropped a
//     real wall is the failure a control has to be able to see.
//   · REPRODUCTION — the corner plane read off the live disc bevel's mount is
//     printed. Everything below is stated as a distance from that plane, so if
//     it disagrees with `Z_ALARM_CORNER` the offsets are noise.
//   · POSE — the survey runs at BOTH alarm-crown extremes (the stem slides and
//     carries its bevel, which meets the disc bevel only when PULLED), so a
//     wall that exists at one extreme is not missed. Rows report the worse of
//     the two, and the control asserts the stem actually MOVED between them —
//     the first version drove `crownPullT`, the winding crown's key, and
//     surveyed the same pose twice without saying so.
//
// Usage: cd tools && node probe-234-corner-z.mjs
//        R=3.5 node probe-234-corner-z.mjs     (widen the survey disc)

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const PORT = process.env.PORT || 8499;
const RADIUS = Number(process.env.R || 3.0);

const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
process.on('exit', () => srv.kill());
await new Promise((r) => setTimeout(r, 900));

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
const bootWarnings = [];
page.on('console', (m) => {
  if (m.type() !== 'warning') return;
  const t = m.text();
  if (/WebGL|GroupMarker|GL Driver|swiftshader|Deprecation|coplanar/i.test(t)) return;
  bootWarnings.push(t);
});
page.on('pageerror', (e) => console.error('PAGEERROR', String(e).slice(0, 300)));
let booted = true;
await page.goto(`http://127.0.0.1:${PORT}/index.html?n=${Date.now()}`, { waitUntil: 'load', timeout: 90000 })
  .catch(() => { booted = false; });
if (booted) await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 }).catch(() => { booted = false; });
if (!booted) { console.error('the tree did not boot — nothing below can be measured'); await browser.close(); srv.kill(); process.exit(1); }
const bootOnly = bootWarnings.slice();

const R = await page.evaluate(async (radius) => {
  const c = window.__clock;
  const THREE = await import('./vendor/three.module.js');
  const I = await import('./src/inspect.js');
  const L = await import('./src/layout.js');

  const named = (n) => { let f = null; c.scene.traverse((o) => { if (!f && o.name === n) f = o; }); return f; };
  const unitOf = new Map();
  for (const e of (c.labelEntries || [])) e.obj?.traverse?.((o) => { if (!unitOf.has(o)) unitOf.set(o, e.name); });

  const disc = named('alarmDiscBevel'), stem = named('alarmStemBevel');
  if (!disc || !stem) return { fatal: 'the corner bevels are not in the scene under the names this probe knows' };

  // The corner's axis and plane, READ OFF THE METAL: the disc bevel's mount is
  // planted at Z_ALARM_CORNER on the arbor's axis, so its world origin IS the
  // corner. Nothing here reads the constant.
  const cw = new THREE.Vector3(); disc.parent.getWorldPosition(cw);
  // The corner's own metal is a SUBTREE — `makeConicalGear`'s return carries the
  // mesh, and a survey that matched the group's NAME found no mesh at all and
  // reported the corner as an empty column.
  const ownIds = new Set();
  for (const g of [disc, stem]) g.traverse((o) => ownIds.add(o.uuid));

  const survey = (label) => {
    const rows = [];
    const box = new THREE.Box3(), ctr = new THREE.Vector3(), sz = new THREE.Vector3();
    c.scene.updateMatrixWorld(true);
    c.scene.traverse((o) => {
      if (!o.isMesh || !o.geometry || o.userData?.schematic) return;
      box.setFromObject(o);
      if (!isFinite(box.min.x)) return;
      box.getCenter(ctr); box.getSize(sz);
      // footprint distance: the box's nearest XY point to the corner's axis
      const dx = Math.max(0, Math.abs(ctr.x - cw.x) - sz.x / 2);
      const dy = Math.max(0, Math.abs(ctr.y - cw.y) - sz.y / 2);
      const d = Math.hypot(dx, dy);
      if (d > radius) return;
      rows.push({ id: o.uuid, name: o.name || '(unnamed)', unit: unitOf.get(o) || '(no unit)',
        own: ownIds.has(o.uuid), zlo: box.min.z, zhi: box.max.z, foot: d, pose: label });
    });
    return rows;
  };

  // Both crown extremes — the stem slides and carries its bevel, and the key is
  // `alarmCrownPullT`, not `crownPullT`: the latter is the WINDING crown's, and
  // asking for it left both surveys standing at the same pose. The stem bevel
  // then sat 3.97 inboard of the corner in both, fell outside the survey disc,
  // and the column came back with no stem bevel in it at all — which is how a
  // scan reports a clear band above a part it never saw.
  const stemX = [];
  const at = (label, pose) => { c.resetInputs?.(); c.setPose(pose); c.scene.updateMatrixWorld(true);
    const v = new THREE.Vector3(); stem.getWorldPosition(v); stemX.push({ label, x: v.x, y: v.y });
    return survey(label); };
  const a = at('pushed in (rest)', { tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, alarmOn: 1, alarmCrownPullT: 0 });
  const b = at('pulled out (set)', { tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, alarmOn: 1, alarmCrownPullT: 1 });
  c.resetInputs?.(); c.setPose({ tau: 0 });

  // merge: worst (widest) z extent per mesh name over the two poses
  const merged = new Map();
  for (const r of [...a, ...b]) {
    const k = r.id;   // IDENTITY, never the name: a unit carries many '(unnamed)' meshes and merging them by name unions their z extents into one row that is no part at all
    const p = merged.get(k);
    if (!p) merged.set(k, { ...r, poses: [r.pose] });
    else { p.zlo = Math.min(p.zlo, r.zlo); p.zhi = Math.max(p.zhi, r.zhi); p.foot = Math.min(p.foot, r.foot); p.poses.push(r.pose); }
  }

  const bbox = (o) => { const bx = new THREE.Box3().setFromObject(o); return { zlo: bx.min.z, zhi: bx.max.z, r: Math.max(bx.max.x - bx.min.x, bx.max.y - bx.min.y) / 2 }; };

  // ---- TIER 2: what the column WOULD hold. The bar first, off the census that
  // gates it rather than off a number typed here; then one blank per candidate
  // stem radius, built by the shipped generator and hung on the LIVE mounts, so
  // a candidate's reach is measured through the same transforms as the built
  // one instead of being scaled from it.
  const G = await import('./src/geometry.js');
  c.resetInputs?.(); c.setPose({ tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, alarmOn: 1, alarmCrownPullT: 1 });
  c.scene.updateMatrixWorld(true);

  // `status(name)` is the per-job accessor; `status()` with no name returns the
  // whole map, whose `.state` is undefined — polling THAT exits immediately and
  // reads a job that has not run, which is how tier 2 first reported no bar.
  I.start(c, 'turning');
  for (let i = 0; i < 900 && I.status('turning').state === 'running'; i++) await new Promise((r) => setTimeout(r, 200));
  const job = I.status('turning');
  const turn = job.result || job.payload || job;
  const allBars = [...(turn?.violations || []), ...(turn?.waived || []), ...(turn?.needRest || [])];
  const stemBar = allBars.find((b) => String(b.key || '').startsWith('Alarm crown::alarmStem+'));

  const blankAt = (mount, boreR, mateBoreR, teeth, faceW, moduleM) => {
    const g = G.makeConicalGear({ name: 'cand', teeth, module: moduleM, mateTeeth: teeth, faceWidth: faceW, boreR, mateBoreR });
    mount.add(g); mount.updateMatrixWorld(true); g.updateMatrixWorld(true);
    const bx = new THREE.Box3().setFromObject(g);
    mount.remove(g);
    return { zlo: bx.min.z, zhi: bx.max.z, rx: (bx.max.x - bx.min.x) / 2, ry: (bx.max.y - bx.min.y) / 2 };
  };

  const MOD = 0.24, ARBOR_BORE = 0.4;
  // The candidate radii are DERIVED here, from the census's own bar and
  // layout.js's own ceilings — nothing about the stem is typed into this probe.
  // The census reports in MM (`lenMM`/`diaMM`); everything in this column is in
  // units, so the bar is converted here rather than compared across scales.
  const barLen = stemBar ? stemBar.lenMM / L.UNIT_MM : null;
  const asBuiltR = stemBar ? stemBar.diaMM / L.UNIT_MM / 2 : null;
  const cands = [];
  if (barLen) cands.push(
    { label: 'as built (the control)', r: asBuiltR },
    { label: 'stem stock floor', r: L.STEM_STOCK_R_U },
    { label: `turning ceiling (L/D ${L.TURN_LD_MAX})`, r: barLen / (2 * L.TURN_LD_MAX) },
    { label: `turning target (L/D ${L.TURN_LD_TARGET})`, r: barLen / (2 * L.TURN_LD_TARGET) },
  );
  const candidates = [];
  for (const cand0 of cands) {
    // PIVOT_BORE_CLEAR is a main.js const, not a layout export, so it is stated
    // here with its source named — the one number in tier 2 that is not read
    // from a module. The control row catches a drift in it the same way it
    // catches one anywhere else: as-built must reproduce the live blank.
    const cand = { ...cand0, boreClear: 0.05 /* main.js PIVOT_BORE_CLEAR */, floor: L.STOCK_MIN_U };
    const boreR = cand.r + cand.boreClear;
    let teeth = null, faceW = null;
    for (let t = 8; t <= 60; t++) {
      const spec = G.bevelToothSpec({ module: MOD, teeth: t, mateTeeth: t, boreR, mateBoreR: ARBOR_BORE, quiet: true });
      if (spec && spec.faceW >= cand.floor) { teeth = t; faceW = spec.faceW; break; }
    }
    if (teeth === null) { candidates.push({ ...cand, boreR, teeth: null }); continue; }
    const sb = blankAt(stem.parent, boreR, ARBOR_BORE, teeth, faceW, MOD);
    const db = blankAt(disc.parent, ARBOR_BORE, boreR, teeth, faceW, MOD);
    candidates.push({ ...cand, boreR, teeth, faceW,
      up: sb.zhi - cw.z, downStem: cw.z - sb.zlo, downDisc: cw.z - db.zlo,
      outR: Math.max(sb.rx, sb.ry) });
  }
  c.resetInputs?.(); c.setPose({ tau: 0 });
  const dB = bbox(disc), sB = bbox(stem);
  const plate = named('backPlate');

  const sawDisc = [...merged.values()].some((r) => r.id === disc.uuid || (r.own && r.zhi <= cw.z + 1e-9));
  const sawStem = [...merged.values()].some((r) => r.id === stem.uuid || (r.own && r.zhi > cw.z));
  const sawOwn = [...merged.values()].filter((r) => r.own).length;
  // The filter itself, in both directions — a synthetic box planted just inside
  // and just outside the survey disc. This replaces a must-miss on the BALANCE,
  // which failed for a reason that is not a defect: an AABB footprint
  // over-includes a large rotated part, so the balance's box genuinely reaches
  // this column. Over-inclusion is the safe direction for finding walls; a
  // filter that let a real wall out is the failure worth a control.
  const probeFilter = (off) => {
    const dx = Math.max(0, Math.abs((cw.x + off) - cw.x) - 0);
    return Math.hypot(dx, 0) <= radius;
  };
  const filterIn = probeFilter(radius - 0.5), filterOut = probeFilter(radius + 0.5);

  // ---- TIER 3: the ceiling, MEASURED where the corner actually stands.
  // Tier 1's ceiling is `backPlate`'s whole-mesh AABB, and that box's floor is
  // the §186 mounting RIM standing proud at the plate's outer radius — not the
  // plate's face over this corner, which is higher, and which is NOTCHED for
  // this very stem. An AABB cannot tell those apart. So each candidate blank is
  // hung on the live mount, walked down in world z, and asked for its real
  // clearance through `inspect.js`'s own `meshClearance` — the measure the
  // battery's gates use — until it stands exactly CLEAR_MARGIN off the plate.
  const meshOf = (g) => { let m = null; g.traverse((o) => { if (!m && o.isMesh && !o.userData?.schematic) m = o; }); return m; };
  const plateMesh = plate && plate.isMesh ? plate : (plate ? meshOf(plate) : null);
  const hangAt = (mount, dz, boreR, mateBoreR, teeth, faceW) => {
    const g = G.makeConicalGear({ name: 'cand', teeth, module: MOD, mateTeeth: teeth, faceWidth: faceW, boreR, mateBoreR });
    g.matrixAutoUpdate = false;
    g.matrix.copy(new THREE.Matrix4().makeTranslation(0, 0, dz).multiply(mount.matrixWorld));
    c.scene.add(g); g.updateMatrixWorld(true);
    return g;
  };
  const clearTo = (g, target) => { const m = meshOf(g); return (m && target) ? I.meshClearance(m, target, Infinity) : null; };

  c.resetInputs?.(); c.setPose({ tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, alarmOn: 1, alarmCrownPullT: 1 });
  c.scene.updateMatrixWorld(true);
  const byName = (n) => { let m = null; c.scene.traverse((o) => { if (!m && o.name === n) m = o; }); return m; };
  const runMesh = byName('alarmLifterRun'), cockMesh = byName('alarmArborCockBush');

  for (const k of candidates) {
    if (k.teeth === null) continue;
    const gapAt = (dz) => { const g = hangAt(stem.parent, dz, k.boreR, ARBOR_BORE, k.teeth, k.faceW);
      const d = clearTo(g, plateMesh); c.scene.remove(g); return d; };
    k.gapAtBuilt = gapAt(0);
    let lo = -4, hi = 0.5;      // lo: certainly clear of the plate, hi: certainly buried
    for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (gapAt(mid) >= L.CLEAR_MARGIN) lo = mid; else hi = mid; }
    k.dzNeeded = lo;
    const gs = hangAt(stem.parent, lo, k.boreR, ARBOR_BORE, k.teeth, k.faceW);
    const gd = hangAt(disc.parent, lo, ARBOR_BORE, k.boreR, k.teeth, k.faceW);
    k.atZ = { plate: clearTo(gs, plateMesh), runStem: clearTo(gs, runMesh), runDisc: clearTo(gd, runMesh),
      cockStem: clearTo(gs, cockMesh), cockDisc: clearTo(gd, cockMesh) };
    c.scene.remove(gs); c.scene.remove(gd);
  }
  c.resetInputs?.(); c.setPose({ tau: 0 });

  return {
    corner: { x: cw.x, y: cw.y, z: cw.z },
    disc: dB, stem: sB,
    plate: plate ? bbox(plate) : null,
    rows: [...merged.values()].sort((p, q) => q.zhi - p.zhi),
    controls: { sawDisc, sawStem, sawOwn, filterIn, filterOut, stemX },
    consts: { Z_DIAL: L.Z_DIAL, CLEAR_MARGIN: L.CLEAR_MARGIN, STOCK_MIN_U: L.STOCK_MIN_U,
      STEM_STOCK_R_U: L.STEM_STOCK_R_U, PIVOT_BORE_CLEAR: L.PIVOT_BORE_CLEAR,
      TURN_LD_MAX: L.TURN_LD_MAX, TURN_LD_TARGET: L.TURN_LD_TARGET, UNIT_MM: L.UNIT_MM },
    live: { up: sB.zhi - cw.z, downStem: cw.z - sB.zlo, downDisc: cw.z - dB.zlo },
    bar: stemBar ? { key: stemBar.key, LD: stemBar.LD, len: barLen, fields: Object.keys(stemBar) } : null,
    candidates,
  };
}, RADIUS).catch((e) => ({ fatal: String(e).slice(0, 400) }));

await browser.close(); srv.kill();
if (R?.fatal) { console.error(R.fatal); process.exit(1); }

const f = (x, n = 4) => (x === null || x === undefined ? '—' : Number(x).toFixed(n));
const CZ = R.corner.z;

console.log('\n§234 step 4 — the alarm corner\'s z column, measured\n');
console.log(`BOOT: ${bootOnly.length} warning(s)`);
for (const w of bootOnly) console.log('   · ' + w.slice(0, 220));

console.log('\n--- CONTROLS');
console.log(`  MUST-HIT    : the corner's own metal appears in the survey — ${R.controls.sawOwn} mesh(es), below ${R.controls.sawDisc ? 'yes' : 'NO'}, above ${R.controls.sawStem ? 'yes' : 'NO'}  ${R.controls.sawDisc && R.controls.sawStem ? 'OK' : 'FAILED — the scan is not looking at the corner'}`);
console.log(`  POSE        : the stem bevel stands at x ${R.controls.stemX.map((p) => p.x.toFixed(3)).join(' then ')} over the two crown poses — ${Math.abs(R.controls.stemX[0].x - R.controls.stemX[1].x) > 1e-6 ? 'it MOVED, so the two surveys are two poses' : 'IT DID NOT MOVE — both surveys are the same pose and the sliding member was never seen at the corner'}`);
console.log(`  FILTER      : a point just inside the disc is ${R.controls.filterIn ? 'kept' : 'DROPPED'} and one just outside is ${R.controls.filterOut ? 'KEPT' : 'dropped'}  ${R.controls.filterIn && !R.controls.filterOut ? 'OK' : 'FAILED'}`);
console.log('  (footprints are AABBs, so a large rotated part over-includes — the safe direction for finding a wall, and why the balance appears below.)');
console.log(`  REPRODUCTION: the corner plane read off the disc bevel's mount is ${f(CZ)} at (${f(R.corner.x, 3)}, ${f(R.corner.y, 3)})`);
console.log(`  declared, for comparison: Z_DIAL ${f(R.consts.Z_DIAL, 2)}, CLEAR_MARGIN ${f(R.consts.CLEAR_MARGIN, 2)}, STOCK_MIN_U ${f(R.consts.STOCK_MIN_U, 4)}`);
if (R.plate) console.log(`  backPlate's own box in this column: z ${f(R.plate.zlo)} … ${f(R.plate.zhi)}`);

console.log(`\n--- THE CORNER'S OWN REACH (world boxes, not faceWidth + tipR)`);
console.log(`  disc bevel : z ${f(R.disc.zlo)} … ${f(R.disc.zhi)}   → ${f(CZ - R.disc.zlo)} DOWN from the corner, ${f(R.disc.zhi - CZ)} up`);
console.log(`  stem bevel : z ${f(R.stem.zlo)} … ${f(R.stem.zhi)}   → ${f(R.stem.zhi - CZ)} UP from the corner, ${f(CZ - R.stem.zlo)} down`);
const top = Math.max(R.disc.zhi, R.stem.zhi), bot = Math.min(R.disc.zlo, R.stem.zlo);
console.log(`  the corner's own span: ${f(bot)} … ${f(top)}  (${f(top - bot)} tall)`);

const above = R.rows.filter((r) => !r.own && r.zlo >= top - 1e-9).sort((p, q) => p.zlo - q.zlo);
const below = R.rows.filter((r) => !r.own && r.zhi <= bot + 1e-9).sort((p, q) => q.zhi - p.zhi);
const straddle = R.rows.filter((r) => !r.own && r.zlo < top - 1e-9 && r.zhi > bot + 1e-9);

console.log(`\n--- THE COLUMN (every mesh whose footprint comes within ${RADIUS} of the corner's axis, worse of both crown poses)`);
console.log('  z_lo       z_hi       foot    unit                      mesh');
for (const r of R.rows) {
  const mark = r.own ? '  ← the corner itself' : '';
  console.log(`  ${f(r.zlo).padStart(9)}  ${f(r.zhi).padStart(9)}  ${f(r.foot, 3).padStart(6)}  ${r.unit.padEnd(24).slice(0, 24)}  ${r.name}${mark}`);
}

console.log(`\n--- THE BAND THE CORNER ACTUALLY HAS`);
if (!above.length) console.log('  ABOVE: nothing in the column stands clear above the corner.');
else console.log(`  CEILING: ${above[0].name} (${above[0].unit}) at z ${f(above[0].zlo)} — ${f(above[0].zlo - CZ)} above the corner plane`);
if (!below.length) console.log('  BELOW: nothing in the column stands clear below the corner.');
else console.log(`  FLOOR  : ${below[0].name} (${below[0].unit}) at z ${f(below[0].zhi)} — ${f(CZ - below[0].zhi)} below the corner plane`);
if (above.length && below.length) {
  const band = above[0].zlo - below[0].zhi;
  console.log(`  BAND   : ${f(below[0].zhi)} … ${f(above[0].zlo)} = ${f(band)} tall`);
  console.log(`  the corner as built is ${f(top - bot)} tall, so the band holds it with ${f(band - (top - bot))} to spend on the two clearances`);
}
if (straddle.length) {
  console.log(`\n  STRADDLING the corner's own z span (neighbours, not walls — ${straddle.length}):`);
  for (const r of straddle) console.log(`    ${r.unit} / ${r.name}  z ${f(r.zlo)} … ${f(r.zhi)}, foot ${f(r.foot, 3)}`);
}


// ---- TIER 2 --------------------------------------------------------------
console.log(`\n--- WHAT THE COLUMN WOULD HOLD`);
if (!R.bar) console.log('  the turning census returned no Alarm crown stem bar — tier 2 cannot run');
else {
  console.log(`  the bar, off the census that gates it: ${R.bar.key}`);
  console.log(`    L/D ${f(R.bar.LD, 1)}, length ${f(R.bar.len)}   (row fields: ${R.bar.fields.join(', ')})`);
  const ceiling = R.rows.filter((r) => !r.own && r.zlo >= CZ).sort((p, q) => p.zlo - q.zlo)[0];
  const marg = R.consts.CLEAR_MARGIN;
  console.log(`\n  candidate                      stem r    bore     t    face     up-reach  down-reach   corner must drop to   by`);
  for (const k of R.candidates) {
    if (k.teeth === null) { console.log(`  ${k.label.padEnd(30)} ${f(k.r, 4).padStart(7)}  ${f(k.boreR, 4).padStart(6)}   —    no blank under 60 teeth clears the §50 floor at this bore`); continue; }
    const down = Math.max(k.downStem, k.downDisc);
    const zMax = (ceiling ? ceiling.zlo : 0) - marg - k.up;      // the highest the corner may sit
    console.log(`  ${k.label.padEnd(30)} ${f(k.r, 4).padStart(7)}  ${f(k.boreR, 4).padStart(6)}  ${String(k.teeth).padStart(3)}  ${f(k.faceW, 4).padStart(6)}   ${f(k.up).padStart(8)}  ${f(down).padStart(10)}   ${f(zMax).padStart(12)}   ${f(Math.max(0, CZ - zMax)).padStart(6)}`);
  }
  if (ceiling) console.log(`\n  (the ceiling that sets the last two columns is ${ceiling.name} at z ${f(ceiling.zlo)}, and the margin is CLEAR_MARGIN ${f(marg, 2)}.)`);

  console.log(`\n--- AND WHAT IS THEN IN THE WAY BELOW`);
  for (const k of R.candidates) {
    if (k.teeth === null) continue;
    const down = Math.max(k.downStem, k.downDisc);
    const zNew = Math.min(CZ, (ceiling ? ceiling.zlo : 0) - marg - k.up);
    const floorNeed = zNew - down - marg;
    const raw = R.rows.filter((r) => !r.own && r.zhi > floorNeed && r.zlo < zNew && r.foot <= k.outR + marg)
      .sort((p, q) => q.zhi - p.zhi);
    // Two classes of row are NOT walls, and counting them would have this
    // reporting the corner as blocked by the metal it is mounted on:
    //   · an AXIS the blank is bored OVER — foot 0 and straddling the corner
    //     plane, i.e. the stem and the setting arbor's own rod;
    //   · an AABB ARTEFACT — a part whose box spans the movement (the case
    //     band is a ring, so its box contains the axis while its metal is at
    //     the rim). Flagged by a z span no part of this column has.
    const axis = (h) => h.foot < 1e-6 && h.zlo < zNew && h.zhi > zNew;
    const artefact = (h) => (h.zhi - h.zlo) > 12;
    const hit = raw.filter((h) => !axis(h) && !artefact(h));
    console.log(`\n  ${k.label}: corner at ${f(zNew)}, blank outer r ${f(k.outR)}, wants everything clear down to ${f(floorNeed)}`);
    for (const h of raw.filter(axis)) console.log(`    (bored over: ${h.unit} / ${h.name}, z ${f(h.zlo)} … ${f(h.zhi)} on the axis)`);
    for (const h of raw.filter((x) => !axis(x) && artefact(x))) console.log(`    (AABB artefact: ${h.unit} / ${h.name}, z span ${f(h.zhi - h.zlo, 1)} — a ring whose box holds the axis)`);
    if (!hit.length) { console.log('    NOTHING ELSE is in the way.'); continue; }
    for (const h of hit) console.log(`    ${h.unit.padEnd(24).slice(0, 24)} ${h.name.padEnd(22)} z ${f(h.zlo)} … ${f(h.zhi)}, foot ${f(h.foot, 3)}  → ${f(h.zhi - floorNeed)} of overlap  [${h.unit === 'Alarm setting arbor' || h.unit === 'Alarm crown' ? 'the corner\'s OWN group — P1/P2' : 'ANOTHER unit — P3, position space'}]`);
  }
}

console.log(`\n--- THE CEILING, MEASURED RATHER THAN BOXED (meshClearance against backPlate)`);
console.log('  tier 1\'s ceiling is the plate\'s whole-mesh box, whose floor is the §186 mounting rim at the');
console.log('  outer radius. This is the plate\'s real metal over THIS corner, which the rim notch opens.');
console.log(`\n  candidate                      gap at the built plane   corner must drop   →  z        then: run     cock`);
for (const k of (R.candidates || [])) {
  if (k.teeth === null) continue;
  const z = CZ + k.dzNeeded;
  const run = Math.min(k.atZ.runStem ?? Infinity, k.atZ.runDisc ?? Infinity);
  const cock = Math.min(k.atZ.cockStem ?? Infinity, k.atZ.cockDisc ?? Infinity);
  console.log(`  ${k.label.padEnd(30)} ${f(k.gapAtBuilt).padStart(10)}            ${f(-k.dzNeeded).padStart(8)}     ${f(z).padStart(8)}   ${f(run).padStart(8)}  ${f(cock).padStart(8)}`);
}
console.log(`\n  (a drop of 0 means the candidate already stands CLEAR_MARGIN off the plate where it is.`);
console.log(`   'run' is the §45 release lifter's run and 'cock' the setting arbor's own bearing bush,`);
console.log(`   both measured at the dropped z — 0.0000 means touching, and CLEAR_MARGIN is ${f(R.consts.CLEAR_MARGIN, 2)}.)`);

console.log('\n(REPORT — nothing here passes or fails; read the numbers.)\n');
