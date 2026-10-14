// HOW FAR CAN THE DIAL SIDE COME DOWN, AND WHAT STOPS IT? — §278 landing 6's
// step study for the dial-side reclaim. Since landing 5 the detector stands on
// its satellite, so the centre column's dial-side band no longer has to carry
// it; `DIAL_RECLAIM` (layout.js) brings the dial plane plate-ward by that much
// and the chain below the sleeve rises in the dial frame by the same amount
// (main.js's ALARM_FEELER_TOP), so the satellite stack, i1b, the hour wheel and
// the motion works keep their world planes. This measures, on the tree under
// test, how much further it could go and which pair stops it.
//
// REPORT with fatal controls (exit 2 when a control fails; exit 0 with the
// tables otherwise). Three stages, every mesh owned by its NEAREST labelled
// ancestor (§40's dedupe — the Dial label holds the whole dial frame, and a
// mesh counted under both would pair with itself):
//
//   1. WHO MOVES. The tree is booted twice — as it stands, and as a copy with
//      DIAL_RECLAIM raised by EPS — and every mesh's world box is compared at
//      the net's first pose (a declared one: `setPose({})` leaves tau where the
//      live loop left it, and two boots would disagree). A mesh that moved plate-ward by exactly EPS is DIAL-HUNG,
//      one that did not move is HELD, and anything else is RE-SOLVED (its
//      derivation reads the reclaim some other way: a post that spans the two,
//      an arm solved against both ends); listed by unit. Classified off the
//      build, not off a list.
//   2. THE STEP (hung against held). In the as-built boot every dial-hung mesh
//      is carried plate-ward by Δ (a ghost, its world matrix translated — the
//      landing-5 method) and measured with `meshClearance` against every HELD
//      mesh of another unit, the base plate among them, over §152's pose net
//      (`digestPoses`, 52 poses). Per unit pair, the first Δ on a STEP grid at which
//      it comes under CLEAR_MARGIN, bisected to RES; sorted, so the first row
//      is the binder. RE-SOLVED meshes are on neither side: where they go is
//      their law's answer, which only a built tree can give (stage 3). A pair
//      already under the margin at Δ 0 is listed, not stepped — a running fit
//      keeps its radial gap however far it slides.
//   3. BUILT (DELTAS=…, optional). For each listed reclaim, a copy of the tree
//      is BUILT at it and booted: its boot warnings, and every moving mesh
//      (hung or re-solved at stage 1) measured against every mesh of another
//      unit over the pose net, each pair's least clearance under CLEAR_MARGIN
//      compared with the same pair in the as-built boot (keyed by owner, mesh
//      name and index, so a member the copy re-cuts reads as NEW). NEW is a pair under
//      the margin that was not; DEEPER one already under it that lost more
//      than 1e-4. This is the verdict on a reclaim this file can give; the
//      battery on the built tree is the one that lands it.
//
// CONTROLS (exit 2):
//   K1 the classifier sees the dial: the 'Dial' unit's sheet (`dialPlate`) is
//      dial-hung, and the 'Motion works' unit is wholly held.
//   K2 a translation is a translation: a ghost at Δ = 0 reproduces every
//      vertex of its mesh exactly, and at Δ = 0.5 every vertex moved by
//      exactly 0.5 in z and nothing in x or y.
//   K3 must-hit: the dial sheet carried to the base plate's dial face reads
//      under the margin against the plate — the scan can see a collision.
//
// What it is NOT: it moves no metal. Stage 2 is a translation and stage 3 a
// copy; neither re-solves anything the build does not.
//
// Run: cd tools && node probe-278-dial-step.mjs   (ROOT= for another tree;
//      DMAX=, STEP=, RES= the step scan; DELTAS=0.5,1.0 the built copies;
//      NOSTEP=1 skips stage 2)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdtempSync, cpSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const EPS = 0.05;                                   // the classifier's shift: far above float noise, far below any clearance this reads
const DMAX = Number(process.env.DMAX || 2.0);       // past the study's 1.778
const STEP = Number(process.env.STEP || 0.05);
const RES = Number(process.env.RES || 0.005);
const DELTAS = (process.env.DELTAS || '').split(',').filter(Boolean).map(Number);
const NOSTEP = !!process.env.NOSTEP;
let port = Number(process.env.PORT || 8671);
const servers = [];
process.on('exit', () => { for (const s of servers) try { s.kill(); } catch {} });

// The page's mesh census: every mesh keyed by its nearest labelled owner, its
// name and its index among that owner's meshes, in scene order.
const CENSUS = `(() => {
  const clock = window.__clock;
  const owner = new Map(clock.labelEntries.map((e) => [e.obj, e.name]));
  const plate = clock.scene.getObjectByName('backPlate');
  if (plate) owner.set(plate, '(base plate)');
  const n = {}, list = [];
  clock.scene.traverse((o) => {
    if (!o.isMesh || o.userData.schematic || !o.geometry?.attributes?.position) return;
    let u = null; for (let p = o; p && u === null; p = p.parent) if (owner.has(p)) u = owner.get(p);
    if (u === null) return;
    const k = u + '|' + (o.name || '(unnamed)') + '|' + (n[u] = (n[u] ?? -1) + 1);
    list.push({ o, unit: u, key: k });
  });
  return list;
})()`;
const MEASURE_BOXES = `(async () => {
  const THREE = await import('three');
  const I = await import('./src/inspect.js');
  const clock = window.__clock;
  // a declared pose, not the reset: setPose assigns only the keys it names, so
  // {} leaves tau wherever the live loop left it and two boots disagree
  clock.resetInputs(); clock.setPose(I.digestPoses(clock)[0]); clock.scene.updateMatrixWorld(true);
  const out = {}, b = new THREE.Box3();
  for (const m of ${CENSUS}) { b.setFromObject(m.o, true); out[m.key] = [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z]; }
  return out;
})()`;
// Every moving mesh against every mesh of another unit, over the net: each
// pair's least clearance, kept when under CLEAR_MARGIN.
const PAIR_SCAN = `(async (moving) => {
  const THREE = await import('three');
  const I = await import('./src/inspect.js');
  const L = await import('./src/layout.js');
  const CM = L.CLEAR_MARGIN, clock = window.__clock;
  const all = ${CENSUS};
  const mv = new Set(moving);
  const A = all.filter((m) => mv.has(m.key) || !(m.key in window.__stepCls));
  const sig = (o) => o.matrixWorld.elements.map((x) => x.toFixed(9)).join(',');
  const seen = new Set(), out = {};
  const poses = I.digestPoses(clock);
  const gap = (a, b) => Math.hypot(Math.max(0, b.min.x - a.max.x, a.min.x - b.max.x), Math.max(0, b.min.y - a.max.y, a.min.y - b.max.y), Math.max(0, b.min.z - a.max.z, a.min.z - b.max.z));
  for (const [pi, p] of poses.entries()) {
    clock.resetInputs(); clock.setPose(p); clock.scene.updateMatrixWorld(true);
    const bx = all.map((m) => ({ m, b: new THREE.Box3().setFromObject(m.o), s: sig(m.o) }));
    const byKey = new Map(bx.map((e) => [e.m.key, e]));
    for (const a of A) {
      const ea = byKey.get(a.key);
      for (const eb of bx) {
        if (eb.m.unit === a.unit || eb.m === a) continue;
        if (mv.has(eb.m.key) && eb.m.key < a.key) continue;   // a moving pair once
        if (gap(ea.b, eb.b) >= CM) continue;
        const memo = a.key + '#' + ea.s + '#' + eb.m.key + '#' + eb.s;
        if (seen.has(memo)) continue; seen.add(memo);
        const d = I.meshClearance(a.o, eb.m.o, CM);
        if (d < CM) {
          const k = [a.key, eb.m.key].sort().join(' ⇄ ');
          if (!(k in out) || d < out[k].d) out[k] = { d, pose: 'net#' + pi };
        }
      }
    }
    await new Promise((r) => setTimeout(r, 0));
  }
  clock.resetInputs(); clock.setPose({}); clock.scene.updateMatrixWorld(true);
  return out;
})`;

async function open(dir) {
  const p0 = port++;
  const srv = spawn('python3', ['-m', 'http.server', String(p0), '--bind', '127.0.0.1'], { cwd: dir, stdio: 'ignore' });
  servers.push(srv);
  await new Promise((r) => setTimeout(r, 1200));
  const browser = await chromium.launch({ args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
  const page = await browser.newPage();
  const warns = [];
  page.on('console', (m) => {
    if (m.type() === 'warning' && !/WebGL|GPU stall|GroupMarker/.test(m.text())) warns.push(m.text());
    if (m.text().startsWith('step278')) console.log('  ' + m.text());
  });
  page.on('pageerror', (e) => warns.push('PAGEERROR ' + String(e)));
  await page.goto(`http://127.0.0.1:${p0}/index.html`, { waitUntil: 'load', timeout: 300000 });
  await page.waitForFunction(() => !!window.__clock || !!window.__bootError, null, { timeout: 300000 });
  const bootError = await page.evaluate(() => (window.__bootError ? String(window.__bootError) : null));
  if (bootError) throw new Error(`boot failed in ${dir}: ${bootError}`);
  return { page, browser, srv, warns, close: async () => { await browser.close(); srv.kill(); } };
}

let RECLAIM0 = null;
function mutant(delta) {
  const dir = mkdtempSync(join(tmpdir(), 'step278-'));
  cpSync(ROOT, dir, { recursive: true, dereference: true,
    filter: (s) => !/(^|[\\/])(\.git|node_modules|\.battery-out|\.claude|timelapse)([\\/]|$)/.test(s.slice(ROOT.length)) });
  const f = join(dir, 'src/layout.js'), src = readFileSync(f, 'utf8');
  const m = src.match(/export const DIAL_RECLAIM = (-?[0-9.]+);/);
  if (!m) throw new Error('layout.js declares DIAL_RECLAIM as no plain literal — this tree predates §278 landing 6');
  RECLAIM0 = Number(m[1]);
  writeFileSync(f, src.replace(m[0], `export const DIAL_RECLAIM = ${+(RECLAIM0 + delta).toFixed(6)};`));
  return dir;
}

const ctl = [];
console.log(`§278 dial-side step study — ${ROOT}`);
// ---------------------------------------------------------------------------
// Stage 1: who moves.
const dirE = mutant(EPS);
const mut = await open(dirE);
const boxesMut = await mut.page.evaluate(MEASURE_BOXES);
const mutWarns = mut.warns.slice();
await mut.close(); rmSync(dirE, { recursive: true, force: true });
const base = await open(ROOT);
const boxesBase = await base.page.evaluate(MEASURE_BOXES);
console.log(`DIAL_RECLAIM as built ${RECLAIM0}; boot warnings: as built ${base.warns.length}, +${EPS} copy ${mutWarns.length}`);
for (const w of base.warns.slice(0, 8)) console.log(`  as built: ${w}`);
for (const w of mutWarns.slice(0, 12)) console.log(`  +${EPS}: ${w}`);
const cls = {}, byUnit = {};
for (const [k, a] of Object.entries(boxesBase)) {
  const b = boxesMut[k], unit = k.split('|')[0];
  let c = 'resolved';
  if (b) {
    const dxy = Math.max(...[0, 1, 3, 4].map((i) => Math.abs(b[i] - a[i])));
    const dz0 = b[2] - a[2], dz1 = b[5] - a[5];
    if (dxy < 1e-6 && Math.abs(dz0 - EPS) < 1e-6 && Math.abs(dz1 - EPS) < 1e-6) c = 'hung';
    else if (dxy < 1e-6 && Math.abs(dz0) < 1e-6 && Math.abs(dz1) < 1e-6) c = 'held';
  }
  cls[k] = c;
  const e = (byUnit[unit] ??= { hung: 0, held: 0, resolved: 0, meshes: [] });
  e[c]++;
  if (c === 'resolved') e.meshes.push(k.split('|')[1]);
}
const extra = Object.keys(boxesMut).filter((k) => !(k in boxesBase));
if (extra.length) console.log(`  ${extra.length} mesh(es) exist only in the shifted copy: ${extra.slice(0, 5).join(', ')}`);
console.log('\nSTAGE 1 — WHO MOVES (meshes per unit: dial-hung / held / re-solved)');
for (const [u, e] of Object.entries(byUnit).sort((p, q) => p[0].localeCompare(q[0]))) {
  if (!e.hung && !e.resolved) continue;
  console.log(`  ${u.padEnd(34)} ${String(e.hung).padStart(3)} ${String(e.held).padStart(4)} ${String(e.resolved).padStart(4)}${e.resolved ? '   re-solved: ' + [...new Set(e.meshes)].join(', ') : ''}`);
}
console.log(`  (${Object.values(byUnit).filter((e) => !e.hung && !e.resolved).length} more units wholly held)`);
const sheetKey = Object.keys(cls).find((k) => k.split('|')[1] === 'dialPlate');
if (!sheetKey || cls[sheetKey] !== 'hung') ctl.push(`K1: the dial sheet (${sheetKey}) reads ${cls[sheetKey]}, not dial-hung`);
if (!(byUnit['Motion works']?.held > 0 && !byUnit['Motion works'].hung && !byUnit['Motion works'].resolved)) ctl.push('K1: the Motion works unit is not wholly held');
await base.page.evaluate((c) => { window.__stepCls = c; }, cls);

// ---------------------------------------------------------------------------
// Stage 2: the step, hung against held, in the as-built page.
if (!NOSTEP) {
  const res = await base.page.evaluate(`(async ({ DMAX, STEP, RES }) => {
    const THREE = await import('three');
    const I = await import('./src/inspect.js');
    const L = await import('./src/layout.js');
    const CM = L.CLEAR_MARGIN, clock = window.__clock, cls = window.__stepCls;
    const all = ${CENSUS};
    const hung = all.filter((m) => cls[m.key] === 'hung'), held = all.filter((m) => cls[m.key] === 'held');
    const plate = all.find((m) => m.unit === '(base plate)');
    const ghost = new THREE.Mesh(); ghost.matrixAutoUpdate = false; ghost.matrixWorldAutoUpdate = false;
    const T = new THREE.Matrix4();
    const at = (m, d) => { ghost.geometry = m.o.geometry; ghost.material = m.o.material; T.makeTranslation(0, 0, d); ghost.matrix.multiplyMatrices(T, m.o.matrixWorld); ghost.matrixWorld.copy(ghost.matrix); return ghost; };
    clock.resetInputs(); clock.setPose(I.digestPoses(clock)[0]); clock.scene.updateMatrixWorld(true);
    let k2 = 0; { const v = new THREE.Vector3(), w = new THREE.Vector3();
      for (const m of hung.slice(0, 20)) { const pos = m.o.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(m.o.matrixWorld);
          w.fromBufferAttribute(pos, i).applyMatrix4(at(m, 0).matrixWorld); k2 = Math.max(k2, v.distanceTo(w));
          w.fromBufferAttribute(pos, i).applyMatrix4(at(m, 0.5).matrixWorld); k2 = Math.max(k2, Math.abs(w.z - v.z - 0.5), Math.abs(w.x - v.x), Math.abs(w.y - v.y)); } } }
    const sheet = all.find((m) => m.o.name === 'dialPlate');
    const sb = new THREE.Box3().setFromObject(sheet.o);
    const k3 = plate && sheet ? I.meshClearance(at(sheet, -L.BACK_PLATE_T - sb.max.z), plate.o) : null;   // the sheet's plate-side face onto the plate's dial face
    const poses = I.digestPoses(clock);
    const pairs = {}, base0 = {};
    const bA = new THREE.Box3();
    const boxGap = (a, b, dz) => Math.hypot(Math.max(0, b.min.x - a.max.x, a.min.x - b.max.x), Math.max(0, b.min.y - a.max.y, a.min.y - b.max.y), Math.max(0, b.min.z - (a.max.z + dz), (a.min.z + dz) - b.max.z));
    const sig = (o) => o.matrixWorld.elements.map((x) => x.toFixed(9)).join(',');
    const seen = new Set();
    let calls = 0, skipped = 0;
    for (const [pi, p] of poses.entries()) {
      clock.resetInputs(); clock.setPose(p); clock.scene.updateMatrixWorld(true);
      const ob = held.map((m) => ({ m, b: new THREE.Box3().setFromObject(m.o), s: sig(m.o) }));
      for (const A of hung) {
        bA.setFromObject(A.o);
        const sA = sig(A.o), swept = bA.clone(); swept.max.z += DMAX;
        for (const { m: B, b, s: sB } of ob) {
          if (B.unit === A.unit) continue;
          if (boxGap(swept, b, 0) >= CM) continue;
          const memo = A.key + '#' + sA + '#' + B.key + '#' + sB;
          if (seen.has(memo)) { skipped++; continue; }
          seen.add(memo);
          const key = A.unit + ' ⇄ ' + B.unit;
          const d0 = I.meshClearance(at(A, 0), B.o, CM + 1); calls++;
          if (d0 < CM) {
            const e = (base0[key] ??= { d0: Infinity });
            if (d0 < e.d0) Object.assign(e, { d0, a: A.o.name || '(unnamed)', b: B.o.name || '(unnamed)', pose: 'net#' + pi });
            continue;
          }
          const rec = pairs[key], lim = Math.min(DMAX, rec ? rec.delta : DMAX);
          let lo = 0, hi = null;
          for (let d = STEP; d <= lim + 1e-9; d += STEP) {
            if (boxGap(bA, b, d) >= CM) { lo = d; continue; }
            const dd = I.meshClearance(at(A, d), B.o, CM + 0.01); calls++;
            if (dd < CM) { hi = d; break; }
            lo = d;
          }
          if (hi === null) continue;
          while (hi - lo > RES) { const mid = (lo + hi) / 2; const dd = I.meshClearance(at(A, mid), B.o, CM + 0.01); calls++; if (dd < CM) hi = mid; else lo = mid; }
          if (!rec || lo < rec.delta) pairs[key] = { delta: lo, a: A.o.name || '(unnamed)', b: B.o.name || '(unnamed)', pose: 'net#' + pi, d0 };
        }
      }
      if (pi % 10 === 0) console.log('step278 step: pose ' + (pi + 1) + '/' + poses.length + ', ' + calls + ' calls, ' + skipped + ' skipped');
      await new Promise((r) => setTimeout(r, 0));
    }
    clock.resetInputs(); clock.setPose({}); clock.scene.updateMatrixWorld(true);
    const rows = Object.entries(pairs).map(([k, v]) => ({ pair: k, ...v })).sort((a, b) => a.delta - b.delta);
    const listed = Object.entries(base0).map(([k, v]) => ({ pair: k, ...v }));
    return { rows, listed, k2, k3, poses: poses.length, hung: hung.length, held: held.length, calls, skipped };
  })(${JSON.stringify({ DMAX, STEP, RES })})`);
  if (!(res.k2 < 1e-9)) ctl.push(`K2: a ghost misplaces a vertex by ${res.k2}`);
  if (!(res.k3 !== null && res.k3 < 0.15)) ctl.push(`K3: the dial sheet carried onto the base plate reads ${res.k3} — the scan cannot see a collision`);
  console.log(`\nSTAGE 2 — THE STEP, hung against held (${res.hung} dial-hung meshes, ${res.held} held, ${res.poses} poses, Δ to ${DMAX} on a ${STEP} grid bisected to ${RES}; ${res.calls} meshClearance calls)`);
  console.log('  first Δ under CLEAR_MARGIN   pair (dial-hung ⇄ held)                                   meshes (pose; clearance at Δ 0)');
  for (const r of res.rows.slice(0, 40))
    console.log(`  ${r.delta.toFixed(3).padStart(8)}                   ${r.pair.slice(0, 58).padEnd(58)}  ${r.a} ⇄ ${r.b} (${r.pose}; ${r.d0 === Infinity ? '≥ 1.15' : r.d0.toFixed(4)})`);
  if (!res.rows.length) console.log(`  none under ${DMAX}`);
  console.log('\n  LISTED — hung ⇄ held pairs already under the margin at Δ 0 (not judged by a translation):');
  for (const r of res.listed.sort((a, b) => a.pair.localeCompare(b.pair))) console.log(`    ${r.pair.slice(0, 64).padEnd(64)} ${r.d0.toFixed(4)}  ${r.a} ⇄ ${r.b} (${r.pose})`);
  console.log(`\n  CONTROLS: K2 ${res.k2.toExponential(2)} · K3 the sheet on the plate reads ${res.k3?.toFixed(4)}`);
  if (res.rows.length) console.log(`  STEP BINDER (hung ⇄ held): ${res.rows[0].pair} at Δ ${res.rows[0].delta.toFixed(3)} (${(res.rows[0].delta * 0.379).toFixed(3)} mm)`);
}

// ---------------------------------------------------------------------------
// Stage 3: built copies.
if (DELTAS.length) {
  const moving = Object.entries(cls).filter(([, c]) => c !== 'held').map(([k]) => k);
  console.log(`\nSTAGE 3 — BUILT COPIES at ${DELTAS.join(', ')} (${moving.length} moving meshes against every mesh of another unit, over the net)`);
  const ref = await base.page.evaluate(`${PAIR_SCAN}(${JSON.stringify(moving)})`);
  await base.close();
  for (const D of DELTAS) {
    const dir = mutant(D);
    let o;
    try { o = await open(dir); }
    catch (e) { console.log(`  Δ ${D}: ${e.message}`); rmSync(dir, { recursive: true, force: true }); continue; }
    await o.page.evaluate((c) => { window.__stepCls = c; }, cls);
    const got = await o.page.evaluate(`${PAIR_SCAN}(${JSON.stringify(moving)})`);
    console.log(`\n  Δ ${D} (DIAL_RECLAIM ${+(RECLAIM0 + D).toFixed(6)}, ${(D * 0.379).toFixed(3)} mm): ${o.warns.length} boot warning(s)`);
    for (const w of o.warns) console.log(`    warn: ${w}`);
    const rows = [];
    for (const [k, v] of Object.entries(got)) {
      const r = ref[k];
      if (!r) rows.push({ k, kind: 'NEW', ...v });
      else if (v.d < r.d - 1e-4) rows.push({ k, kind: 'DEEPER', ...v, was: r.d });
    }
    rows.sort((a, b) => a.d - b.d);
    for (const r of rows) console.log(`    ${r.kind.padEnd(6)} ${r.d.toFixed(4)}${r.was !== undefined ? ` (was ${r.was.toFixed(4)})` : ''}  ${r.k} (${r.pose})`);
    if (!rows.length) console.log('    no pair new or deeper under the margin');
    await o.close(); rmSync(dir, { recursive: true, force: true });
  }
} else await base.close();

if (ctl.length) { for (const c of ctl) console.log('CONTROL FAIL: ' + c); process.exit(2); }
console.log('\nCONTROLS PASS');
