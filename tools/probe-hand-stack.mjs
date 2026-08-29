// THE HAND STACK, MEASURED — every indicator's blade/boss z, the crystal
// chain from live constants, the alarm lane over poses, and the section
// table a thinning would be judged by.
//
// REPORT. Written for the case-redesign scope (roadmap): the owner wants
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

  // The central hands carry NO namePrefix (their meshes are unnamed — that is
  // §94's own point about floors rows), so find them by makeHand's signature:
  // every hand group records userData.length/kind/rBase. Classify by (kind,
  // length): the alarm hand is kind 'hour' at HOUR_HAND_LEN − 1.2, the reserve
  // hand is kind 'minute' on the sub-dial floor — length disambiguates all.
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

  // Alarm lane over the pose net: min gap between the alarm hand's blade top
  // (its max z, dial-local toward the hour hub) and the hour hand subtree's
  // min z — the pair the §125 lane assert (main.js:13657) guards at boot.
  const hour = roots.hourHand, alarm = roots.alarmHand;
  let lane = { min: Infinity, pose: '' };
  const poses = [{ name: 'as booted', enter: () => {} }];
  for (const ax of I.AXES) for (const f of [0, 0.5, 1])
    poses.push({ name: `${ax.name} f=${f}`, enter: () => { I.enterAxis(clock); clock.setPose(ax.pose(f, clock)); } });
  for (const p of poses) {
    p.enter();
    clock.scene.updateMatrixWorld(true);
    const a = ext(alarm), h = ext(hour);
    // dial side is −z: the alarm hand sits nearer the dial (larger z) than the
    // hour hand; the lane is hourMax→? — measure the signed separation of the
    // two subtrees along z, whichever way they stack at this pose.
    const gap = (a.zMin >= h.zMax) ? a.zMin - h.zMax : h.zMin - a.zMax;
    if (gap < lane.min) lane = { min: gap, pose: p.name };
  }
  return { hands, front, cryst, lane, poses: poses.length };
});

const MM = 0.378947;
if (res.error) { console.log('ABORT: ' + res.error); await browser.close(); srv.kill(); process.exit(2); }
console.log('HAND SUBTREE z extents (world; dial side is −z, so FRONT = zMin):');
for (const [n, e] of Object.entries(res.hands))
  console.log(`  ${n.padEnd(12)} z ${e.zMin.toFixed(3)} .. ${e.zMax.toFixed(3)}   span ${((e.zMax - e.zMin) * MM).toFixed(3)} mm   len ${e.len.toFixed(2)}  rBase ${e.rBase.toFixed(3)} (thick ${(1.5 * e.rBase * MM).toFixed(3)} mm)  halfW ${e.halfW.toFixed(3)} (wide ${(2 * e.halfW * MM).toFixed(3)} mm)  bossH ${e.bossH.toFixed(3)}`);
console.log(`\nFRONT-MOST movement metal: ${res.front.unit} / ${res.front.name} at z ${res.front.z.toFixed(3)}`);
if (res.cryst) console.log(`caseCrystal z ${res.cryst.zMin.toFixed(3)} .. ${res.cryst.zMax.toFixed(3)} → clearance to front metal ${((res.front.z - res.cryst.zMax) * MM).toFixed(3)} mm`);
console.log(`\nALARM↔HOUR lane over ${res.poses} poses: min separation ${res.lane.min.toFixed(4)} u = ${(res.lane.min * MM).toFixed(3)} mm  @ ${res.lane.pose}  (CLEAR_MARGIN = 0.15 u)`);

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
await browser.close(); srv.kill();
process.exit(ok ? 0 : 2);
