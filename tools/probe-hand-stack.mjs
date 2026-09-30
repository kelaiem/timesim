// THE HAND STACK, MEASURED — every indicator's blade/boss z, the crystal
// chain from live constants, the alarm lane over poses, and the section
// table a thinning would be judged by.
//
// ACCEPTANCE (originally a report). Written for the case-redesign scope (roadmap): the owner wants
// hands THINNER in z and same-or-wider in plan. The law AS SCOPED (then
// geometry.js 6886/6960-6962): width = √3·rBase, thickness = 1.5·rBase,
// boss height = 2.6·rBase — one knob, three consequences — and §158's
// `halfWidth` decoupled width alone. §188 LANDED the flip this measured
// for: central rBase now comes from HAND_STOCK_MM, plan width from
// planBase (the old width law), boss from the rod-swallow term floored by
// the pipe land — so this probe is now the acceptance that the thinning
// held: sections at stock, widths unchanged, the crystal chain shut on the
// new boss, the lanes open over the whole net.
//
// What this is NOT: probe-153-shot renders the reserve recess; the §125/§153
// boot asserts hold two specific lanes. Neither prints the whole stack with
// its slacks, which is this file's one question.
//
// Controls: the minute hand's pipe (or the nose flush with it) must BE the front-most metal (the crystal
// chain's own premise — if a blade or another part beats it, the chain's
// derivation target is wrong and the scope must know); the alarm lane's
// boot-asserted floor (CLEAR_MARGIN) must measure as slack >= 0 at every
// pose (the assert says it holds; a negative here means this probe measures
// a different quantity than the assert — investigate before trusting either).
// Since TODO 119 the lane is measured over RADIALLY-REAL mesh pairs (see the
// eval's comment) and is also an ACCEPTANCE: handsGroupZOffset derives from
// this lane's blade↔blade pair, so the lane must BIND at CLEAR_MARGIN in
// both directions, the same two-sided hold the hour→minute stack gets.
//
// TODO 118 — the HOUR→MINUTE product, the gap this probe was blind to: the
// minute hand floated 0.67 mm above the hour hand for three landings and the
// front-most-metal control was satisfied BY the float (a higher minute hand
// is MORE front-most). ACCEPTANCE now, not a report, in both directions:
// the measured lift must equal the lift main.js derives — re-derived here
// from the same userData terms, asserting the EXPRESSION rather than a copy
// of its result (the transfers-check rule) — and the tightest of the four
// measured face-pair airs must BIND at CLEAR_MARGIN: below it is a
// clearance defect, above it is exactly the maximum-air defect the owner
// saw from across the room and no clearance gate can ever see.
//
// TODO 120/177 — the central hands ride real bored PIPES now (the minute
// pipe pressed on the cannon pinion's nose, the hour pipe on the hour tube),
// and every lane is I.meshClearance on the SURFACE over the pose net, never
// vertex extents (a bur rod has vertices only at its ends — TODO 177 hid
// behind that). Three acceptances join the two above: each arbor reaches its
// pipe's top (the whole land), and the hour tube RIDES the nose at the
// running fit, PIVOT_BORE_CLEAR at the flats — the support edge's metal,
// which the floors row excuses by name and nothing else measures.
//
// Run: node tools/probe-hand-stack.mjs   (ROOT= for another worktree)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const srv = spawn('python3', ['-m', 'http.server', '8513', '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto('http://127.0.0.1:8513/index.html', { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 120000 });

const res = await page.evaluate(async () => {
  const I = await import('./src/inspect.js');
  const THREE = await import('three');
  const clock = window.__clock;
  const v = new THREE.Vector3();
  const find = (name) => { let m = null; clock.scene.traverse((o) => { if (o.name === name && !m) m = o; }); return m; };

  // z extents of a subtree in WORLD (dial side is −z; "front" = min z).
  const ext = (root) => {
    let zMin = Infinity, zMax = -Infinity;
    root.updateWorldMatrix(true, true);
    root.traverse((o) => {
      if (!o.isMesh || o.userData.schematic || !o.geometry?.attributes?.position) return;
      const p = o.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        o.localToWorld(v.fromBufferAttribute(p, i));
        zMin = Math.min(zMin, v.z); zMax = Math.max(zMax, v.z);
      }
    });
    return { zMin, zMax };
  };

  // Find the hands by makeHand's signature — every hand group records
  // userData.length/kind/rBase — and classify by (kind, length): the alarm
  // hand is kind 'hour' at HOUR_HAND_LEN − 1.2, the reserve hand is kind
  // 'minute' on the sub-dial floor, so length disambiguates all. (The
  // central hands ARE named since §188 — namePrefix 'hour'/'minute', which
  // the stock declarations couple by — but the signature find predates that,
  // still catches every hand including the unnamed subdial ones, and does
  // not couple this probe to the naming.)
  const handGroups = [];
  clock.scene.traverse((o) => {
    if (o.userData && o.userData.rBase !== undefined && o.userData.kind !== undefined && o.userData.length !== undefined)
      handGroups.push(o);
  });
  const hours = handGroups.filter((g) => g.userData.kind === 'hour').sort((a, b) => b.userData.length - a.userData.length);
  const minutes = handGroups.filter((g) => g.userData.kind === 'minute').sort((a, b) => b.userData.length - a.userData.length);
  const roots = { hourHand: hours[0], alarmHand: hours[1], minuteHand: minutes[0] };
  const missing = Object.entries(roots).filter(([, g]) => !g).map(([n]) => n);
  if (missing.length) return { error: `cannot find: ${missing.join(', ')} (found ${handGroups.length} hand groups: ${handGroups.map((g) => `${g.userData.kind}@${g.userData.length.toFixed(1)}`).join(', ')})` };
  const hands = {};
  for (const [n, h] of Object.entries(roots)) hands[n] = { ...ext(h), len: h.userData.length, rBase: h.userData.rBase, halfW: h.userData.halfW, bossH: h.userData.bossH };

  // TODO 120/177 — THE HOUR→MINUTE product and the ALARM↔HOUR lane, both
  // measured ON THE SURFACE. Until TODO 120 this block read per-mesh VERTEX z
  // extents and the lane read vertex RADII — and a bur rod has vertices only
  // at its two ends, so the hour blade's one extrusion, which ran through its
  // own pivot into the alarm collet (TODO 177), read as "no metal between
  // r 1.26 and 5.52". Each stack is its hand's meshes plus the arbor it is
  // pressed on (hour tube; cannon nose; alarm tube), and every cross-stack
  // pair is I.meshClearance at every pose of every axis at f ∈ {0,¼,½,¾,1}.
  // Skipped: the alarm tube on the hour tube — the §25 C running seat, the
  // alarm stack's BEARING, declared on its floors row — not a lane.
  const L = await import('./src/layout.js');
  const CM = L.CLEAR_MARGIN;
  const hu = roots.hourHand.userData, mu = roots.minuteHand.userData;
  if (!hu.pipe || !mu.pipe || !roots.alarmHand.userData.pipe)
    return { error: 'a central hand carries no TODO 120 pipe — this probe measures the piped stack' };
  // The derived lift, re-derived from the same SECTIONS main.js stacks with
  // coaxialLift — the rule as an expression, not its result copied.
  const TUBE_FLATS = Math.cos(Math.PI / 40);   // ringGeo's RING_GEO_SEG
  const below = [...hu.sections, { rIn: L.HOUR_TUBE_INNER * TUBE_FLATS, rOut: L.HOUR_TUBE_OUTER, zHi: hu.pipe.zHi }];
  let expectedLift = -Infinity;
  for (const b of below) for (const a of mu.sections)
    if (Math.max(a.rIn - b.rOut, b.rIn - a.rOut) < CM - 1e-9) expectedLift = Math.max(expectedLift, b.zHi + CM - a.zLo);
  // …and measured OFF THE METAL: a pipe's front face is its plane + pipe.zHi,
  // and world z runs against dial-local z.
  clock.scene.updateMatrixWorld(true);
  const frontZ = (o) => new THREE.Box3().setFromObject(o).min.z;
  const measuredLift = (frontZ(find('hourPipe')) - frontZ(find('minutePipe'))) + hu.pipe.zHi - mu.pipe.zHi;
  // The two lands: each arbor must reach its pipe's top face (0 = the whole land).
  const lands = {
    'hour tube / hour pipe': frontZ(find('hourTube')) - frontZ(find('hourPipe')),
    'cannon nose / minute pipe': frontZ(find('cannonNose')) - frontZ(find('minutePipe')),
  };
  // Which mesh is the true front (min z) of the MOVEMENT — walked through
  // labelEntries, not the scene: the scene carries a backdrop plane at z −90
  // that is neither schematic nor casePart, and the first cut of this scan
  // dutifully reported it as the front of the watch. The §39 envelope's own
  // box is built from movement children for the same reason.
  let front = { z: Infinity, name: '?' };
  for (const e of clock.labelEntries) e.obj.traverse((o) => {
    if (!o.isMesh || o.userData.schematic || o.userData.casePart || !o.geometry?.attributes?.position) return;
    const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      o.localToWorld(v.fromBufferAttribute(p, i));
      if (v.z < front.z) { let nm = o.name; for (let q = o; !nm && q; q = q.parent) nm = q.name; front = { z: v.z, name: nm || o.geometry.type, unit: e.name }; }
    }
  });
  // Crystal chain, from the case's built meshes (the constants' consequences):
  const cryst = find('caseCrystal') ? ext(find('caseCrystal')) : null;
  const meshesOf = (root, extra) => { const out = []; root.traverse((o) => { if (o.isMesh && !o.userData.schematic && o.geometry?.attributes?.position) out.push(o); }); const e = find(extra); if (e) out.push(e); return out; };
  const alarmStack = meshesOf(roots.alarmHand, 'alarmTubeBody');
  const hourStack = meshesOf(roots.hourHand, 'hourTube');
  const minuteStack = meshesOf(roots.minuteHand, 'cannonNose');
  const bearing = (a, h) => a.name === 'alarmTubeBody' && h.name === 'hourTube';
  let lane = { min: Infinity }, hm = { min: Infinity };
  // TODO 120 — THE RUNNING FIT, measured: the hour tube rides the cannon
  // nose (the support edge's metal, excused by name on the Hour wheel ⇄ Dial
  // floors row, so nothing else measures it). Every pose's gap must lie
  // between the flats reading (PIVOT_BORE_CLEAR — a nose vertex facing a bore
  // facet) and the vertex reading (+ the bore's vertex-to-flat sag): below it
  // the nose binds, above it the tube does not journal on the nose at all.
  const fit = { min: Infinity, max: -Infinity, P: L.PIVOT_BORE_CLEAR, sag: L.HOUR_TUBE_INNER * (1 - TUBE_FLATS) };
  const nose = find('cannonNose'), tube = find('hourTube');
  const poses = [{ name: 'as booted', enter: () => {} }];
  for (const ax of I.AXES) for (const f of [0, 0.25, 0.5, 0.75, 1])
    poses.push({ name: `${ax.name} f=${f}`, enter: () => { I.enterAxis(clock); clock.setPose(ax.pose(f, clock)); } });
  for (const p of poses) {
    p.enter();
    clock.scene.updateMatrixWorld(true);
    for (const a of alarmStack) for (const h of hourStack) {
      if (bearing(a, h)) continue;
      const d = I.meshClearance(a, h, 1.0);
      if (d < lane.min) lane = { min: d, pair: `${a.name} ⇄ ${h.name}`, pose: p.name };
    }
    { const d = I.meshClearance(tube, nose, 1.0); if (d < fit.min) fit.min = d; if (d > fit.max) fit.max = d; }
    for (const h of hourStack) for (const m of minuteStack) {
      if (h === tube && m === nose) continue;   // the running fit — the bearing, measured above, not a lane
      const d = I.meshClearance(h, m, 1.0);
      if (d < hm.min) hm = { min: d, pair: `${h.name} ⇄ ${m.name}`, pose: p.name };
    }
  }
  return { hands, front, cryst, lane, hm: { ...hm, expectedLift, measuredLift, CM }, lands, fit, poses: poses.length, minuteFrontZ: frontZ(roots.minuteHand) };
});

const MM = 0.378947;
if (res.error) { console.log('ABORT: ' + res.error); await browser.close(); srv.kill(); process.exit(2); }
console.log('HAND SUBTREE z extents (world; dial side is −z, so FRONT = zMin):');
for (const [n, e] of Object.entries(res.hands))
  console.log(`  ${n.padEnd(12)} z ${e.zMin.toFixed(3)} .. ${e.zMax.toFixed(3)}   span ${((e.zMax - e.zMin) * MM).toFixed(3)} mm   len ${e.len.toFixed(2)}  rBase ${e.rBase.toFixed(3)} (thick ${(1.5 * e.rBase * MM).toFixed(3)} mm)  halfW ${e.halfW.toFixed(3)} (wide ${(2 * e.halfW * MM).toFixed(3)} mm)  bossH ${e.bossH.toFixed(3)}`);
console.log(`\nFRONT-MOST movement metal: ${res.front.unit} / ${res.front.name} at z ${res.front.z.toFixed(3)}`);
if (res.cryst) console.log(`caseCrystal z ${res.cryst.zMin.toFixed(3)} .. ${res.cryst.zMax.toFixed(3)} → clearance to front metal ${((res.front.z - res.cryst.zMax) * MM).toFixed(3)} mm`);
console.log(`\nALARM↔HOUR lane over ${res.poses} poses (I.meshClearance, every alarm-stack × hour-stack mesh pair; the running seat skipped — TODO 177): min ${res.lane.min.toFixed(4)} u = ${(res.lane.min * MM).toFixed(3)} mm — ${res.lane.pair} @ ${res.lane.pose}  (CLEAR_MARGIN = 0.15 u)`);
console.log(`\nHOUR→MINUTE stack (TODO 118/120): tightest air ${res.hm.min.toFixed(4)} u = ${(res.hm.min * MM).toFixed(3)} mm — ${res.hm.pair} @ ${res.hm.pose}`);
console.log(`  lift measured off the pipes' metal ${res.hm.measuredLift.toFixed(4)} u; derived from the sections ${res.hm.expectedLift.toFixed(4)} u  (CLEAR_MARGIN = ${res.hm.CM} u)`);
for (const [n, d] of Object.entries(res.lands)) console.log(`  land ${n}: the arbor's front face stands ${d.toFixed(4)} u from the pipe's (0 = the whole land)`);
console.log(`  running fit hour tube / cannon nose (TODO 120): gap ${res.fit.min.toFixed(4)} .. ${res.fit.max.toFixed(4)} u over the net  (PIVOT_BORE_CLEAR = ${res.fit.P} u, bore sag ${res.fit.sag.toFixed(4)} u)`);

// The section table (pure arithmetic from the read law — printed so the entry
// quotes a table someone can re-derive, not loose numbers).
console.log('\nSECTION LAW: thickness = 1.5·rBase, and §188 flipped the coupling — central rBase = HAND_RBASE_STOCK');
console.log('(plan width rides planBase = length·widthFactor·0.35, so it no longer follows thickness; central pipes: HAND_PIPE_LAND 0.4 mm, pressed on the arbor (TODO 120))');
console.log('CANDIDATES, kept as the scoping record (thickness → rBase → the OLD one-knob consequences):');
for (const tmm of [0.20, 0.15, 0.10]) {
  const rb = tmm / MM / 1.5;
  console.log(`  ${tmm.toFixed(2)} mm thick → rBase ${rb.toFixed(3)} u → boss ${(2.6 * rb * MM).toFixed(3)} mm tall → default width ${(Math.sqrt(3) * rb * MM).toFixed(3)} mm (λ at hour length ${(25.11 * MM / tmm).toFixed(0)})`);
}

// CONTROLS.
let ok = true;
const flush = Math.abs(res.front.z - res.minuteFrontZ) < 1e-6;   // TODO 120: the nose ends flush with the minute pipe by design
const isMinute = flush && (/minute/i.test(res.front.name) || res.front.name === 'cannonNose');
if (!isMinute) { ok = false; console.log(`\nCONTROL FAIL: front-most metal is '${res.front.name}', not the minute hand — the crystal chain's premise does not hold; re-derive before scoping`); }
else console.log(`\nCONTROL PASS: front-most metal is the minute hand (${res.front.name}) — the crystal chain's premise holds`);
if (res.lane.min < 0) { ok = false; console.log(`CONTROL FAIL: alarm↔hour lane measured NEGATIVE (${res.lane.min.toFixed(4)}) while the boot assert passes — this probe measures a different quantity than the assert; distrust both until reconciled`); }
else console.log(`CONTROL PASS: alarm↔hour lane non-negative at every pose`);

// TODO 119 ACCEPTANCE — the alarm↔hour lane BINDS at CLEAR_MARGIN, both
// directions, exactly as the hour→minute stack does below: handsGroupZOffset
// is a derivation now, so below the margin is a clearance regression and
// above it is the offset floating over its own derivation.
if (res.lane.min < 0.15 - 1e-3) { ok = false; console.log(`ACCEPT FAIL: alarm↔hour lane ${res.lane.min.toFixed(4)} u < CLEAR_MARGIN — the hour blade rides too close to the alarm blade`); }
else if (res.lane.min > 0.15 + 5e-3) { ok = false; console.log(`ACCEPT FAIL: alarm↔hour lane ${res.lane.min.toFixed(4)} u does not BIND at CLEAR_MARGIN — handsGroupZOffset has parted from its blade↔blade derivation (the 2.6-era value measured 0.9722 here)`); }
else console.log(`ACCEPT PASS: alarm↔hour lane binds at CLEAR_MARGIN (${res.lane.min.toFixed(4)} u)`);

// TODO 118 ACCEPTANCE — both directions.
const liftErr = Math.abs(res.hm.measuredLift - res.hm.expectedLift);
if (liftErr > 1e-3) { ok = false; console.log(`ACCEPT FAIL: hour→minute lift measured ${res.hm.measuredLift.toFixed(4)} vs derived ${res.hm.expectedLift.toFixed(4)} (Δ ${liftErr.toFixed(4)}) — the build's lift and this expression have parted; one of them is not reading the hands' userData`); }
else console.log(`ACCEPT PASS: hour→minute lift = the coaxialLift section derivation (Δ ${liftErr.toExponential(1)})`);
const minAir = res.hm.min;
if (minAir < res.hm.CM - 1e-3) { ok = false; console.log(`ACCEPT FAIL: tightest hour→minute air ${minAir.toFixed(4)} u < CLEAR_MARGIN — a clearance defect between the central hands`); }
else if (minAir > res.hm.CM + 5e-3) { ok = false; console.log(`ACCEPT FAIL: tightest hour→minute air ${minAir.toFixed(4)} u does not BIND at CLEAR_MARGIN — the minute hand is floating again (the 2.3-era literal measured 1.244 here); the governing pair must sit AT the margin, not above it`); }
else console.log(`ACCEPT PASS: tightest hour→minute air binds at CLEAR_MARGIN (${minAir.toFixed(4)} u)`);
// TODO 120 ACCEPTANCE — the lands: each arbor reaches its pipe's top face.
for (const [n, d] of Object.entries(res.lands)) {
  if (Math.abs(d) > 1e-4) { ok = false; console.log(`ACCEPT FAIL: land ${n} ${d.toFixed(4)} — the arbor does not reach its pipe's top, so the pipe grips less than HAND_PIPE_LAND`); }
  else console.log(`ACCEPT PASS: land ${n} — the arbor reaches the pipe's top (${d.toExponential(1)})`);
}
// TODO 120 ACCEPTANCE — the running fit journals: never tighter than
// PIVOT_BORE_CLEAR at the flats, never looser than that plus the bore's sag.
if (res.fit.min < res.fit.P - 1e-4 || res.fit.max > res.fit.P + res.fit.sag + 1e-4) { ok = false; console.log(`ACCEPT FAIL: the hour tube on the cannon nose reads ${res.fit.min.toFixed(4)} .. ${res.fit.max.toFixed(4)} — not the ${res.fit.P} running fit (+ sag ${res.fit.sag.toFixed(4)})`); }
else console.log(`ACCEPT PASS: the hour tube rides the cannon nose at the running fit (${res.fit.min.toFixed(4)} .. ${res.fit.max.toFixed(4)} u)`);
await browser.close(); srv.kill();
process.exit(ok ? 0 : 2);
