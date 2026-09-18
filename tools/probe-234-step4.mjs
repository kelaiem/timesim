// §234 Landing 2 step 4 — CAN THE ALARM CROWN'S STEM BE CUT FROM STEM STOCK?
// A REPORT (INDEX.md's `kind` column says acceptance because the classifier
// keys on `process.exit`, and this exits only when the tree will not boot —
// `probe-234-group-c.mjs` carries the same label for the same reason).
//
// TODO 145 group B says the eight stem rows are "a section change plus a P3
// re-clear". Two of its three claims have already failed measurement (§234
// step 3: the setting traverse is SITE-limited, the winding stem is a TRAIN
// change), and this asks the same question of the two rows that must close
// together — `Alarm crown::alarmStem+(unnamed)` at L/D 56.2 and
// `Alarm crown::alarmStemTubeLiner+alarmStemCollar×3` at 30.9 — because the
// collars are pressed on the stem and the liner is bored over it.
//
// A REPORT, not a gate: it prints and the judgement is the reader's. It exits
// non-zero only when the tree it was pointed at does not boot, since a tree
// that fails rule 6 has no numbers to report.
//
// WHAT IT IS NOT. `probe-138-bevel-roll.mjs` asks whether two bevel teeth ROLL
// (pure Node, the real generator, no movement around them); this asks whether
// a bevel big enough to be BORED over a stem-stock stem still fits the corner
// it sits in, which is a packaging question its numbers cannot answer.
// `probe-164-return.mjs` and `probe-182-guide-station.mjs` measure the alarm
// PUSHER's stem, in the case band — a different member. `probe-234-group-c.mjs`
// is this instrument's twin for group C: measure the couplings before cutting,
// because group C's lesson was that a member's radius is a station in someone
// else's derivation.
//
// THE FOUR COUPLINGS IT MEASURES:
//
//  1. THE BAR. What `turning` actually clusters as one workpiece, measured off
//     the metal, and the radius the ceiling and the target ask of it. The
//     cluster carries the CROWN KNOB, which is a separate part in any real
//     caliber (a crown is threaded onto a stem), so both readings are printed:
//     which one is right moves the required radius by 8%.
//  2. THE BEVEL. The stem carries the alarm setting corner at its inner end,
//     and a bevel bored over a fatter stem must grow or it has no blank left
//     between its hole and its teeth. Asked of the REAL generator
//     (`bevelToothSpec`), not a copy of its arithmetic: per candidate radius,
//     the smallest tooth count leaving any web, and the smallest keeping
//     today's face width.
//  3. THE ROOM for that growth. The candidate blank is BUILT with
//     `makeConicalGear` and placed at the real member's world transform, then
//     measured against every neighbouring mesh with `inspect.js`'s own
//     `meshClearance` — at BOTH crown extremes, because the stem slides 5 u
//     between them and the pair only meshes at one.
//  4. THE FAT STEM itself: a cylinder of each candidate radius over the stem's
//     own span, measured the same way.
//
// EXCLUSIONS, and why (the instruments skill's "the ground is not an
// obstacle"): a member is not measured against its own unit — the stem, its
// collars, its bush and the case liner are what it is MEANT to touch — nor
// against its MATE, which is meant to mesh with it. Everything else is fair
// game and is ranked, winners and losers both.
//
// CONTROLS, both directions:
//  · MUST-HIT — the blank rebuilt at TODAY's spec and placed at the shipped
//    bevel's transform must measure ~0 against the shipped bevel mesh. If it
//    does not, the placement is wrong and every gap below is from the wrong
//    place.
//  · MUST-MISS — the same blank must stand clear of a part nowhere near the
//    corner (the balance) by more than a unit.
//  · REPRODUCTION — the two `Alarm crown` rows must read the L/D the battery
//    reports for the shipped tree (56.2 and 30.9), or the census being read
//    is not the one the gate reads.
//
// Usage: cd tools && node probe-234-step4.mjs           (shipped tree)
//        ROOT=/path/to/scratch node probe-234-step4.mjs (a candidate tree)

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { bevelToothSpec } from '../src/geometry.js';

const PORT = process.env.PORT || 8488;
const ROOT = process.env.ROOT || '..';
const FIT = 0.05;            // main.js's PIVOT_BORE_CLEAR — a running fit
const MODULE = 0.24;         // ALARM_BEVEL_MODULE
const TEETH_NOW = 10;        // ALARM_BEVEL_TEETH
const BORE_DEFAULT = 0.4;    // bevelToothSpec's own default — what the corner takes today
const UNIT_MM = 0.379;
const CEIL = 20, TARGET = 18;        // layout.js TURN_LD_MAX / TURN_LD_TARGET
const STEM_STOCK_R_U = 0.9236;       // layout.js STEM_STOCK_R_U (tap 7, ⌀0.70 mm)

// ---------------------------------------------------------------- the bevel, in Node
// The generator is pure, so this needs no browser. If no tooth count leaves
// metal at a candidate radius, the room tier has nothing to measure for it.
const quietSpec = (args) => {
  const real = console.warn; const warns = [];
  console.warn = (...a) => warns.push(a.join(' '));
  try { return { spec: bevelToothSpec(args), warns }; } finally { console.warn = real; }
};
const bevelAt = (teeth, boreR) => {
  const { spec, warns } = quietSpec({ module: MODULE, teeth, mateTeeth: teeth, boreR });
  const rootSmall = spec.coneRi * Math.sin(spec.thetaRoot);
  return {
    teeth, boreR, faceW: spec.faceW, tipR: spec.tipR, rootSmall,
    pitchR: spec.pitchR, coneR: spec.coneR, warns: warns.length,
    // "has metal": the bore stays inside the small end's root cone AND some
    // face width survives the web bound. Either failing means no blank.
    ok: boreR < rootSmall && spec.faceW > 1e-6,
  };
};
const TODAY_BEVEL = bevelAt(TEETH_NOW, BORE_DEFAULT);
function bevelLadder(stemR) {
  const boreR = stemR + FIT;
  let min = null, full = null;
  for (let t = 8; t <= 60; t++) {
    const s = bevelAt(t, boreR);
    if (!s.ok) continue;
    if (!min) min = s;
    if (s.faceW >= TODAY_BEVEL.faceW - 1e-9) { full = s; break; }
  }
  return { stemR, boreR, min, full };
}

// ---------------------------------------------------------------- the browser half
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
process.on('exit', () => srv.kill());   // reap on a throw as well as on the last line
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
const bootWarnings = [];
page.on('console', (m) => {
  if (m.type() !== 'warning') return;
  const t = m.text();
  if (/WebGL|GroupMarker|GL Driver|swiftshader|Deprecation/i.test(t)) return;
  bootWarnings.push(t);
});
page.on('pageerror', (e) => bootWarnings.push('PAGEERROR ' + String(e)));
let booted = true;
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 }).catch(() => { booted = false; });
if (!booted) {
  console.error('the tree at ROOT did not boot — no numbers to report');
  for (const w of bootWarnings) console.error('  ', w);
  await browser.close(); srv.kill();
  process.exit(1);
}

// Snapshot the boot warnings HERE, before anything below runs: the clearance
// calls in pass 2 make three-mesh-bvh narrate coplanar triangles, and a BOOT
// line that counted those would report a rule-6 failure this tree does not
// have.
const bootOnly = bootWarnings.slice();

// PASS 1 — measure the bar and find the corner, so the candidates are derived
// from the metal rather than typed in.
const M1 = await page.evaluate(async () => {
  const c = window.__clock;
  const THREE = await import('./vendor/three.module.js');
  const I = await import('./src/inspect.js');
  const out = { bars: [], corner: {} };
  const unitOf = new Map();
  for (const e of c.labelEntries) e.obj.traverse((o) => { if (o.isMesh && !unitOf.has(o)) unitOf.set(o, e.name); });
  const census = await I.turnedBars(c);
  for (const b of census.bars) {
    if (!/Alarm crown/.test(b.part)) continue;
    out.bars.push({ part: b.part, meshes: b.meshes.map((m) => m.name || '(unnamed)'), lenMM: b.lenMM, diaMM: b.diaMM, LD: b.LD });
  }
  const named = (n) => { let f = null; c.scene.traverse((o) => { if (!f && o.name === n) f = o; }); return f; };
  const stem = named('alarmStem');
  out.stemSpan = stem ? stem.geometry.parameters.height : null;
  out.stemR = stem ? stem.geometry.parameters.radiusTop : null;
  out.plateR = c.plateR;
  // the corner's rest radius (main.js's ALARM_CD), read off the spinner the
  // stem hangs from rather than restated — the stem's length is measured FROM
  // it, so shortening the stem means moving it
  {
    const p0 = new THREE.Vector3();
    if (stem) { stem.updateWorldMatrix(true, false); stem.parent.getWorldPosition(p0); }
    out.cornerR = stem ? Math.hypot(p0.x, p0.y) : null;
  }
  for (const nm of ['alarmStemBevel', 'alarmDiscBevel']) {
    const g = named(nm); if (!g) { out.corner[nm] = null; continue; }
    let mesh = null; g.traverse((o) => { if (!mesh && o.isMesh) mesh = o; });
    if (!mesh) { out.corner[nm] = null; continue; }
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), s2 = new THREE.Vector3();
    mesh.updateWorldMatrix(true, false); mesh.matrixWorld.decompose(p, q, s2);
    out.corner[nm] = { unit: unitOf.get(mesh), world: [p.x, p.y, p.z], quat: [q.x, q.y, q.z, q.w] };
  }
  return out;
});

const barWithKnob = M1.bars.length ? M1.bars[0].lenMM / UNIT_MM : null;
const stemSpan = M1.stemSpan;
const LADDERS = [
  ['as built', M1.stemR],
  ['stem stock', STEM_STOCK_R_U],
  ['target, bar with knob', barWithKnob / (2 * TARGET)],
  ['target, bar without knob', stemSpan / (2 * TARGET)],
].map(([label, r]) => { const L = bevelLadder(r); L.label = label; return L; });

// The candidates the room tier measures: today's blank, and for each radius
// that has a blank at all, BOTH the minimum tooth count and the one that keeps
// today's face width — the cheap answer and the honest one.
const CANDIDATES = [{
  label: `as built (${TEETH_NOW}t, bore ${BORE_DEFAULT})`, stemR: M1.stemR, boreR: BORE_DEFAULT,
  teeth: TEETH_NOW, faceW: TODAY_BEVEL.faceW, tipR: TODAY_BEVEL.tipR,
}];
for (const L of LADDERS.slice(1)) {
  if (L.min) CANDIDATES.push({ label: `${L.label} — min teeth`, stemR: L.stemR, boreR: L.boreR, teeth: L.min.teeth, faceW: L.min.faceW, tipR: L.min.tipR });
  if (L.full && (!L.min || L.full.teeth !== L.min.teeth))
    CANDIDATES.push({ label: `${L.label} — today's face`, stemR: L.stemR, boreR: L.boreR, teeth: L.full.teeth, faceW: L.full.faceW, tipR: L.full.tipR });
}

// PASS 2 — build each candidate with the real generator, place it on the metal,
// and measure.
const R2 = await page.evaluate(async ({ MODULE, TEETH_NOW, cands, corner, stemSpan }) => {
  const c = window.__clock;
  const THREE = await import('./vendor/three.module.js');
  const I = await import('./src/inspect.js');
  const G = await import('./src/geometry.js');
  const out = { room: [], stem: [], controls: {} };

  const unitOf = new Map();
  for (const e of c.labelEntries) e.obj.traverse((o) => { if (o.isMesh && !unitOf.has(o)) unitOf.set(o, e.name); });
  const named = (n) => { let f = null; c.scene.traverse((o) => { if (!f && o.name === n) f = o; }); return f; };
  const meshUnder = (g) => { let m = null; g.traverse((o) => { if (!m && o.isMesh) m = o; }); return m; };
  const stem = named('alarmStem');
  const stemBevel = meshUnder(named('alarmStemBevel'));
  const discBevel = meshUnder(named('alarmDiscBevel'));

  const allMeshes = [];
  c.scene.traverse((o) => { if (o.isMesh && unitOf.has(o) && !(o.userData && o.userData.schematic)) allMeshes.push(o); });
  const neighboursFor = (ownUnit, mateUnit) =>
    allMeshes.filter((m) => unitOf.get(m) !== ownUnit && unitOf.get(m) !== mateUnit);

  const holder = new THREE.Group();
  c.scene.add(holder);
  const buildBlank = (teeth, boreR, faceWidth) => {
    const grp = G.makeConicalGear({ name: '_cand', teeth, module: MODULE, mateTeeth: teeth, boreR, faceWidth });
    holder.add(grp);
    return { grp, mesh: meshUnder(grp) };
  };
  const followLive = (grp, live) => {
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    live.updateWorldMatrix(true, false); live.matrixWorld.decompose(p, q, s);
    grp.position.copy(p); grp.quaternion.copy(q);
    c.scene.updateMatrixWorld(true);
  };

  const POSES = [
    ['pushed in (rest)', { tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, alarmOn: 1, alarmCrownPullT: 0 }],
    ['pulled out (set)', { tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, alarmOn: 1, alarmCrownPullT: 1 }],
  ];
  const rank = (mesh, nb, n = 5) => nb
    .map((x) => ({ d: I.meshClearance(mesh, x, 3), who: x.name || '(unnamed)', unit: unitOf.get(x) }))
    .filter((r) => r.d < 3).sort((a, b) => a.d - b.d).slice(0, n);

  // ---- controls, before any candidate is believed
  {
    const { grp, mesh } = buildBlank(TEETH_NOW, 0.4, undefined);
    c.setPose(POSES[0][1]); c.scene.updateMatrixWorld(true);
    followLive(grp, stemBevel);
    out.controls.mustHit = I.meshClearance(mesh, stemBevel);
    const bal = allMeshes.filter((m) => unitOf.get(m) === 'Balance');
    out.controls.mustMiss = bal.length
      ? Math.min(...bal.map((m) => I.meshClearance(mesh, m, Infinity))) : null;
    holder.remove(grp);
  }

  // ---- tier 3: the room, per candidate
  for (const cand of cands) {
    const row = { label: cand.label, teeth: cand.teeth, boreR: cand.boreR, faceW: cand.faceW, tipR: cand.tipR, sites: [] };
    for (const [siteName, live, ownUnit, mateUnit] of [
      ['stem bevel', stemBevel, 'Alarm crown', 'Alarm setting arbor'],
      ['disc bevel', discBevel, 'Alarm setting arbor', 'Alarm crown'],
    ]) {
      if (!live) { row.sites.push({ site: siteName, error: 'no such member' }); continue; }
      const { grp, mesh } = buildBlank(cand.teeth, cand.boreR, cand.faceW);
      const nb = neighboursFor(ownUnit, mateUnit);
      const per = [];
      for (const [poseName, pose] of POSES) {
        c.setPose(pose); c.scene.updateMatrixWorld(true);
        followLive(grp, live);
        per.push({ pose: poseName, ranked: rank(mesh, nb, 4) });
      }
      holder.remove(grp);
      row.sites.push({ site: siteName, poses: per });
    }
    out.room.push(row);
  }

  // ---- tier 5: the member's OWN unit, and its two mates. The pair sweep
  // cannot see inside a unit (TODO 5), and the disc bevel's bearing cock is
  // its own unit's — so a blank that grows into its own cock post is exactly
  // the defect no gate here would report. The MATES are printed rather than
  // excluded: a bevel that no longer reaches its mate has not gained room, it
  // has lost a mesh.
  out.intra = [];
  for (const cand of cands) {
    const row = { label: cand.label, teeth: cand.teeth, tipR: cand.tipR, sites: [] };
    for (const [siteName, live, ownUnit, mates] of [
      ['stem bevel', stemBevel, 'Alarm crown', ['Alarm setting arbor', 'Alarm winding train']],
      ['disc bevel', discBevel, 'Alarm setting arbor', ['Alarm crown']],
    ]) {
      if (!live) continue;
      const { grp, mesh } = buildBlank(cand.teeth, cand.boreR, cand.faceW);
      const own = allMeshes.filter((m) => unitOf.get(m) === ownUnit && m !== live);
      const mateMeshes = allMeshes.filter((m) => mates.includes(unitOf.get(m)));
      const per = [];
      for (const [poseName, pose] of POSES) {
        c.setPose(pose); c.scene.updateMatrixWorld(true);
        followLive(grp, live);
        per.push({ pose: poseName, own: rank(mesh, own, 3), mates: rank(mesh, mateMeshes, 3) });
      }
      holder.remove(grp);
      row.sites.push({ site: siteName, poses: per });
    }
    out.intra.push(row);
  }

  // ---- tier 4: the fat stem
  const seen = new Set();
  for (const cand of cands) {
    if (seen.has(cand.stemR)) continue; seen.add(cand.stemR);
    const row = { stemR: cand.stemR, poses: [] };
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(cand.stemR, cand.stemR, stemSpan, 24), stem.material);
    holder.add(mesh);
    const nb = neighboursFor('Alarm crown', null).filter((m) => unitOf.get(m) !== 'Case');
    for (const [poseName, pose] of POSES) {
      c.setPose(pose); c.scene.updateMatrixWorld(true);
      followLive(mesh, stem);
      row.poses.push({ pose: poseName, ranked: rank(mesh, nb, 5) });
    }
    holder.remove(mesh);
    out.stem.push(row);
  }

  c.scene.remove(holder);
  return out;
}, { MODULE, TEETH_NOW, cands: CANDIDATES, corner: M1.corner, stemSpan });

await browser.close(); srv.kill();

// ---------------------------------------------------------------- printing
const f = (x, n = 4) => (x === null || x === undefined ? '—' : Number(x).toFixed(n));
console.log(`\n§234 step 4 — the alarm crown's stem, measured on ${ROOT}\n`);
console.log(`BOOT: ${bootOnly.length} warning(s)`);
for (const w of bootOnly) console.log('   ', w);

console.log('\n--- TIER 1: THE BAR (turning\'s own census)');
for (const b of M1.bars) {
  console.log(`  ${b.part} :: ${b.meshes.join(' + ')}`);
  console.log(`     len ${f(b.lenMM)} mm   ⌀ ${f(b.diaMM)} mm   L/D ${b.LD}`);
}
console.log(`\n  the stem alone spans ${f(stemSpan)} u; the census's bar is ${f(barWithKnob)} u.`);
console.log('  The difference is the CROWN KNOB, which the census clusters with the stem as one');
console.log('  piece of stock. A crown is a separate part in any real caliber, so both are printed.');
console.log(`  radius the ceiling ${CEIL} asks:  ${f(barWithKnob / (2 * CEIL))} u with the knob, ${f(stemSpan / (2 * CEIL))} u without`);
console.log(`  radius the target  ${TARGET} asks: ${f(barWithKnob / (2 * TARGET))} u with the knob, ${f(stemSpan / (2 * TARGET))} u without`);
console.log(`  as built: r ${f(M1.stemR)} u  ·  stem stock floor: ${f(STEM_STOCK_R_U)} u`);
console.log(`  at stem stock the bar would read L/D ${f(barWithKnob / (2 * STEM_STOCK_R_U), 1)} (with knob) / ${f(stemSpan / (2 * STEM_STOCK_R_U), 1)} (without)`);
console.log('\n  THE OTHER DIRECTION — the bar is long because the CORNER is deep. The stem is cut');
console.log('  from the corner out to the case, so moving the corner outboard shortens it, and');
console.log('  that is position space rather than section space (the P-order\'s preferred currency):');
{
  const knob = barWithKnob - stemSpan;
  const rowsOut = [['ceiling ' + CEIL, CEIL], ['target ' + TARGET, TARGET]];
  for (const [label, ld] of rowsOut) {
    const barMax = 2 * ld * STEM_STOCK_R_U;
    const stemMax = barMax - knob;
    console.log(`    to reach L/D ${label} at stem stock: bar ≤ ${f(barMax)} u, stem ≤ ${f(stemMax)} u,`);
    console.log(`        so the corner moves out ${f(stemSpan - stemMax)} u, from r ${f(M1.cornerR)} to r ${f(M1.cornerR + stemSpan - stemMax)}`);
  }
  console.log(`    the plate's own rim is r ${f(M1.plateR)}, and the stem's bush stands at plateR − 2 = ${f(M1.plateR - 2)}`);
}

console.log('\n--- TIER 2: THE BEVEL (the real generator, pure)');
console.log(`  today: ${TEETH_NOW}t, bore ${BORE_DEFAULT} — the builder's DEFAULT, while the stem it rides is r ${f(M1.stemR, 2)},`);
console.log(`         so the blank is bored ${f(M1.stemR - BORE_DEFAULT, 3)} SMALLER than its own stem.`);
console.log(`         faceW ${f(TODAY_BEVEL.faceW)}  tipR ${f(TODAY_BEVEL.tipR)}  root at the small end ${f(TODAY_BEVEL.rootSmall)}`);
console.log('\n  stem r                    bore     min teeth with any web          teeth keeping today\'s face');
for (const L of LADDERS) {
  const a = L.min ? `${String(L.min.teeth).padStart(3)}t faceW ${f(L.min.faceW)} tipR ${f(L.min.tipR)}` : 'none ≤ 60t';
  const b = L.full ? `${String(L.full.teeth).padStart(3)}t faceW ${f(L.full.faceW)} tipR ${f(L.full.tipR)} (+${f(L.full.tipR - TODAY_BEVEL.tipR)})` : 'none ≤ 60t';
  console.log(`  ${(L.label + ' r ' + f(L.stemR)).padEnd(26)}${f(L.boreR)}  ${a.padEnd(32)}${b}`);
}

console.log('\n--- CONTROLS');
const mh = R2.controls.mustHit, mm = R2.controls.mustMiss;
console.log(`  must-hit  : rebuilt blank vs the shipped alarmStemBevel = ${f(mh)}  ${mh < 0.02 ? 'OK' : 'FAILED — the placement is wrong and every gap below is from the wrong place'}`);
console.log(`  must-miss : rebuilt blank vs Balance = ${f(mm)}  ${mm > 1 ? 'OK' : 'FAILED — everything reads as "near"'}`);
console.log('  reproduction: on the shipped tree the two rows above must read L/D 56.2 and 30.9');

console.log('\n--- TIER 3: THE ROOM (candidate blanks on the metal; own unit and mate excluded)');
for (const row of R2.room) {
  console.log(`\n  ${row.label}: ${row.teeth}t bore ${f(row.boreR)} faceW ${f(row.faceW)} tipR ${f(row.tipR)}`);
  for (const s of row.sites) {
    if (s.error) { console.log(`    ${s.site}: ${s.error}`); continue; }
    for (const p of s.poses) {
      const head = p.ranked[0];
      console.log(`    ${s.site} @ ${p.pose}: ${head ? `${f(head.d)} to ${head.unit} / ${head.who}` : 'nothing within 3'}`);
      for (const r of p.ranked.slice(1)) console.log(`        then ${f(r.d)} to ${r.unit} / ${r.who}`);
    }
  }
}

console.log('\n--- TIER 4: THE FAT STEM (own unit and Case excluded)');
for (const row of R2.stem) {
  console.log(`\n  r ${f(row.stemR)}:`);
  for (const p of row.poses) {
    console.log(`    @ ${p.pose}:`);
    if (!p.ranked.length) console.log('        nothing within 3');
    for (const r of p.ranked) console.log(`        ${f(r.d)} to ${r.unit} / ${r.who}`);
  }
}
console.log('\n--- TIER 5: INSIDE THE UNIT, AND THE MATES');
console.log('  (the pair sweep cannot see inside a unit — a blank growing into its own bearing');
console.log('   cock is exactly the defect nothing else here would report. The mates are printed,');
console.log('   not excluded: a bevel that no longer reaches its mate has lost a mesh, not gained room.)');
for (const row of R2.intra) {
  console.log(`\n  ${row.label}: ${row.teeth}t tipR ${f(row.tipR)}`);
  for (const s2 of row.sites) {
    for (const p of s2.poses) {
      const o = p.own[0], m = p.mates[0];
      console.log(`    ${s2.site} @ ${p.pose}:`);
      console.log(`        own unit : ${o ? `${f(o.d)} to ${o.who}` : 'nothing within 3'}${p.own[1] ? `, then ${f(p.own[1].d)} to ${p.own[1].who}` : ''}`);
      console.log(`        mate     : ${m ? `${f(m.d)} to ${m.unit} / ${m.who}` : 'nothing within 3 — THE MESH IS GONE'}`);
    }
  }
}
console.log('\n(REPORT — nothing here passes or fails; read the numbers.)\n');
