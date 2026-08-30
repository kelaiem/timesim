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
// Controls: the minute hand's boss must BE the front-most metal (the crystal
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

  // TODO 118 — the hour→minute product, measured AS BOOTED (before the lane
  // loop poses the scene: explode translates handsGroup in z, and this pair's
  // relative z is pose-independent — both ride the dial axis, and rotation
  // about z moves no z extent).
  const L = await import('./src/layout.js');
  const CM = L.CLEAR_MARGIN;
  const split = (root) => {
    // boss vs blade by the §188 names: the collet is `${prefix}Boss`, every
    // other mesh (shaft, tip, counterweight) is blade metal for this purpose —
    // exactly the partition the userData terms describe (floorDrop/topRise
    // are defined "boss excluded" and already fold the counterweight in).
    const boss = { zMin: Infinity, zMax: -Infinity }, blade = { zMin: Infinity, zMax: -Infinity };
    root.updateWorldMatrix(true, true);
    root.traverse((o) => {
      if (!o.isMesh || o.userData.schematic || !o.geometry?.attributes?.position) return;
      const tgt = /Boss$/.test(o.name) ? boss : blade;
      const p = o.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        o.localToWorld(v.fromBufferAttribute(p, i));
        tgt.zMin = Math.min(tgt.zMin, v.z); tgt.zMax = Math.max(tgt.zMax, v.z);
      }
    });
    return { boss, blade };
  };
  const hm = (() => {
    const h = split(roots.hourHand), m = split(roots.minuteHand);
    // dial side is −z and the minute hand is in front: each air is the hour
    // side's front face against the minute side's rear face.
    const airs = {
      'boss ↔ boss  ': h.boss.zMin - m.boss.zMax,
      'blade ↔ blade': h.blade.zMin - m.blade.zMax,
      'boss ↔ blade ': h.boss.zMin - m.blade.zMax,
      'blade ↔ boss ': h.blade.zMin - m.boss.zMax,
    };
    const hu = roots.hourHand.userData, mu = roots.minuteHand.userData;
    // The SAME four-term expression main.js derives the lift from (TODO 118,
    // main.js at minuteHand.position.z) — re-derived from the same userData,
    // not copied as a number, so a boss or blade change moves both sides.
    const expectedLift = Math.max(
      hu.bossH / 2 + CM + mu.bossH / 2,
      hu.topRise + CM + mu.floorDrop,
      hu.bossH / 2 + CM + mu.floorDrop,
      hu.topRise + CM + mu.bossH / 2,
    );
    // Both collets are CENTRED about their hand planes (ringExtrude translates
    // −thickness/2; CylinderGeometry centres), so the plane-to-plane lift IS
    // the boss z-centres' separation — measured off the metal, not read back
    // from the position the build assigned.
    const measuredLift = (h.boss.zMin + h.boss.zMax) / 2 - (m.boss.zMin + m.boss.zMax) / 2;
    return { airs, expectedLift, measuredLift, CM };
  })();
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

  // Alarm lane over the pose net — RADIALLY AWARE since TODO 119. The old
  // measure was the signed z-separation of the two whole subtrees, and the
  // respend made that measure wrong on purpose: the hour hub now legally
  // interleaves the alarm collet's z-band, because the collet is a ring at
  // r 2.67..3.30 and the hub ends at r 1.26 — they never radially meet, so
  // their z overlap is nesting, not contact. The lane is now the minimum
  // signed z-gap over MESH pairs that actually share radius (rOverlap > 0);
  // r is invariant under the hands' rotation about the common axis, so the
  // radial ranges are measured once and only z is re-read per pose.
  const hour = roots.hourHand, alarm = roots.alarmHand;
  const meshList = (root) => {
    const out = [];
    root.traverse((o) => {
      if (!o.isMesh || o.userData.schematic || !o.geometry?.attributes?.position) return;
      let rMin = Infinity, rMax = 0;
      const p = o.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        o.localToWorld(v.fromBufferAttribute(p, i));
        const r = Math.hypot(v.x, v.y);
        rMin = Math.min(rMin, r); rMax = Math.max(rMax, r);
      }
      out.push({ o, rMin, rMax });
    });
    return out;
  };
  clock.scene.updateMatrixWorld(true);
  const alarmMeshes = meshList(alarm), hourMeshes = meshList(hour);
  const zExt = (o) => {
    let zMin = Infinity, zMax = -Infinity;
    const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      o.localToWorld(v.fromBufferAttribute(p, i));
      zMin = Math.min(zMin, v.z); zMax = Math.max(zMax, v.z);
    }
    return { zMin, zMax };
  };
  let lane = { min: Infinity, pose: '' };
  const poses = [{ name: 'as booted', enter: () => {} }];
  for (const ax of I.AXES) for (const f of [0, 0.5, 1])
    poses.push({ name: `${ax.name} f=${f}`, enter: () => { I.enterAxis(clock); clock.setPose(ax.pose(f, clock)); } });
  for (const p of poses) {
    p.enter();
    clock.scene.updateMatrixWorld(true);
    const az = alarmMeshes.map((m) => ({ ...m, ...zExt(m.o) }));
    const hz = hourMeshes.map((m) => ({ ...m, ...zExt(m.o) }));
    for (const a of az) for (const h of hz) {
      if (Math.min(a.rMax, h.rMax) - Math.max(a.rMin, h.rMin) <= 0) continue;
      // dial side is −z: the alarm hand sits nearer the dial (larger z) than
      // the hour hand; measure the signed separation whichever way this pair
      // stacks at this pose.
      const gap = (a.zMin >= h.zMax) ? a.zMin - h.zMax : h.zMin - a.zMax;
      if (gap < lane.min) lane = { min: gap, pose: p.name };
    }
  }
  return { hands, front, cryst, lane, hm, poses: poses.length };
});

const MM = 0.378947;
if (res.error) { console.log('ABORT: ' + res.error); await browser.close(); srv.kill(); process.exit(2); }
console.log('HAND SUBTREE z extents (world; dial side is −z, so FRONT = zMin):');
for (const [n, e] of Object.entries(res.hands))
  console.log(`  ${n.padEnd(12)} z ${e.zMin.toFixed(3)} .. ${e.zMax.toFixed(3)}   span ${((e.zMax - e.zMin) * MM).toFixed(3)} mm   len ${e.len.toFixed(2)}  rBase ${e.rBase.toFixed(3)} (thick ${(1.5 * e.rBase * MM).toFixed(3)} mm)  halfW ${e.halfW.toFixed(3)} (wide ${(2 * e.halfW * MM).toFixed(3)} mm)  bossH ${e.bossH.toFixed(3)}`);
console.log(`\nFRONT-MOST movement metal: ${res.front.unit} / ${res.front.name} at z ${res.front.z.toFixed(3)}`);
if (res.cryst) console.log(`caseCrystal z ${res.cryst.zMin.toFixed(3)} .. ${res.cryst.zMax.toFixed(3)} → clearance to front metal ${((res.front.z - res.cryst.zMax) * MM).toFixed(3)} mm`);
console.log(`\nALARM↔HOUR lane over ${res.poses} poses (radially-real mesh pairs only — TODO 119): min separation ${res.lane.min.toFixed(4)} u = ${(res.lane.min * MM).toFixed(3)} mm  @ ${res.lane.pose}  (CLEAR_MARGIN = 0.15 u)`);

console.log(`\nHOUR→MINUTE stack (TODO 118; as booted — pose-independent for this pair):`);
for (const [n, a] of Object.entries(res.hm.airs))
  console.log(`  ${n}  air ${a.toFixed(4)} u = ${(a * MM).toFixed(3)} mm`);
console.log(`  lift measured off the boss metal ${res.hm.measuredLift.toFixed(4)} u; derived from userData ${res.hm.expectedLift.toFixed(4)} u  (CLEAR_MARGIN = ${res.hm.CM} u)`);

// The section table (pure arithmetic from the read law — printed so the entry
// quotes a table someone can re-derive, not loose numbers).
console.log('\nSECTION LAW: thickness = 1.5·rBase, and §188 flipped the coupling — central rBase = HAND_RBASE_STOCK');
console.log('(plan width rides planBase = length·widthFactor·0.35, so it no longer follows thickness; bossH = max(2.6·rBase, pipe floor 0.4 mm))');
console.log('CANDIDATES, kept as the scoping record (thickness → rBase → the OLD one-knob consequences):');
for (const tmm of [0.20, 0.15, 0.10]) {
  const rb = tmm / MM / 1.5;
  console.log(`  ${tmm.toFixed(2)} mm thick → rBase ${rb.toFixed(3)} u → boss ${(2.6 * rb * MM).toFixed(3)} mm tall → default width ${(Math.sqrt(3) * rb * MM).toFixed(3)} mm (λ at hour length ${(25.11 * MM / tmm).toFixed(0)})`);
}

// CONTROLS.
let ok = true;
const isMinuteBoss = /minute/i.test(res.front.name) || (res.front.unit === 'Dial' && Math.abs(res.front.z - res.hands.minuteHand.zMin) < 1e-6);
if (!isMinuteBoss) { ok = false; console.log(`\nCONTROL FAIL: front-most metal is '${res.front.name}', not the minute hand — the crystal chain's premise does not hold; re-derive before scoping`); }
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
else console.log(`ACCEPT PASS: hour→minute lift = the four-term userData derivation (Δ ${liftErr.toExponential(1)})`);
const minAir = Math.min(...Object.values(res.hm.airs));
if (minAir < res.hm.CM - 1e-3) { ok = false; console.log(`ACCEPT FAIL: tightest hour→minute air ${minAir.toFixed(4)} u < CLEAR_MARGIN — a clearance defect between the central hands`); }
else if (minAir > res.hm.CM + 5e-3) { ok = false; console.log(`ACCEPT FAIL: tightest hour→minute air ${minAir.toFixed(4)} u does not BIND at CLEAR_MARGIN — the minute hand is floating again (the 2.3-era literal measured 1.244 here); the governing pair must sit AT the margin, not above it`); }
else console.log(`ACCEPT PASS: tightest hour→minute air binds at CLEAR_MARGIN (${minAir.toFixed(4)} u)`);
await browser.close(); srv.kill();
process.exit(ok ? 0 : 2);
