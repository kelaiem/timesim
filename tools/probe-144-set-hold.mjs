#!/usr/bin/env node
// ACCEPTANCE — WHAT HOLDS THE ALARM RELEASE DISC WHERE THE CROWN LEFT IT?
//
// TODO 117 took the hour out of the release disc: it carries the SET alone and
// stands still while the hour carries the reader round to meet it. TODO 144
// removed the term that had gone on turning the setting train off that
// deleted hour. What is left is the residue both items filed and neither
// measured: the disc's hub is a running fit on the HOUR TUBE, which turns, and
// §25 C's "friction-set" (no detent, holds wherever the crown leaves it) names
// a mechanism it never sized. So — what drags the disc, and what holds it?
//
// THE LOAD IS NOT THE HUB. Everyone's first guess (both items', too) was the
// seat that used to be the drive. Measured, its viscous film on the turning
// tube is some six orders under the real load, which is the READER'S OWN
// PIN: hour-carried, it slides on the disc's track under the bias blade's
// riding seat, a friction drag of μ·F·r about the disc's axis, continuous.
// The seat force is read off the movement's own §137 row for the blade (this
// item's, at the feeler) and the hold budget off the ALARM_SET_HOLD record the
// movement publishes — never copied literals, which is the failure TODO 117
// recorded once ("a probe that answered it from literals would be the
// fabricated-constant failure").
//
// THE HOLD is whatever grounds the setting train against that drag, cleared
// by ALARM_SPRING_HEADROOM (§169's precedent for a drag against a detent).
// The movement declares none today, so the record's `holder` is null and this
// probe is RED BY DESIGN until one is cut — TODO 117's own pattern: the
// instrument stays red until the metal exists. What it prints meanwhile is the
// DESIGN TABLE: the F·r a friction hold needs, and the normal force that means
// at every smooth radius the train actually offers (read off the built
// meshes), against the inherited 5–50 mN detent envelope. That table is the
// decision, priced, and it is why this is not a report.
//
// CONTROLS, and they are why a number here means anything:
//   · must-hit — the reader's pin MOVES RELATIVE TO THE DISC under the hour
//     (world matrices, probe-144-branch-still's method). No relative motion,
//     no sliding, no drag: every torque below would be a torque on nothing.
//   · the row's own arithmetic — the pin force re-derived here from the
//     row's k, drop and arms reproduces the row's load; and riding − dropped
//     at the bear point is k·ALARM_PIN_DROP·(BEAR_R/ARM_LEN) exactly (TODO
//     117's own control on the same blade).
//   · the record's drag reproduces μ·F·r from its own three factors.
//   · the film bound is computed with a viscosity TEN TIMES the thickest
//     watch oil and still lands orders under the pin — a bound, not a fit.
//
// cd tools && node probe-144-set-hold.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8566);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });

const out = await page.evaluate(async () => {
  const C = window.__clock;
  const hold = C.alarmSetHold;
  const row = C.transfers.rows.find((r) => r.site.startsWith('alarm release: bias blade'));

  // --- the metal: named meshes, their max radius about their own axis ------
  const find = (name) => { let m = null; C.scene.traverse((o) => { if (!m && o.isMesh && o.name === name) m = o; }); return m; };
  const unit = (name) => { const e = C.labelEntries.find((x) => x.name === name); return e ? e.obj : null; };
  const maxR = (m) => {   // outermost radius of a mesh about its local z axis, off its vertices
    if (!m) return null;
    const p = m.geometry.attributes.position; let r = 0;
    for (let i = 0; i < p.count; i++) r = Math.max(r, Math.hypot(p.getX(i), p.getY(i)));
    return r;
  };
  const hub = find('alarmDiscHub');
  const hubDims = (() => {   // ringGeo is a lathe of [inner,-h/2],[outer,-h/2],[outer,h/2],[inner,h/2]
    if (!hub) return null;
    const p = hub.geometry.attributes.position; let rIn = Infinity, rOut = 0, zMin = Infinity, zMax = -Infinity;
    for (let i = 0; i < p.count; i++) { const r = Math.hypot(p.getX(i), p.getY(i)); rIn = Math.min(rIn, r); rOut = Math.max(rOut, r); zMin = Math.min(zMin, p.getZ(i)); zMax = Math.max(zMax, p.getZ(i)); }
    return { rIn, rOut, h: zMax - zMin };
  })();
  const candidates = [
    ['setting arbor rod (at the cock)', maxR(find('alarmArborCockBush')) ? 0.45 : null, 'the bush bore — the rod itself'],
    ['setting arbor cock bush', maxR(find('alarmArborCockBush')), 'a brake drum no wider than the bush (the post stands one bearing outboard)'],
    ['release disc rim', maxR(find('alarmDiscBody')), 'the rim, teeth and all'],
    ['setting wheel rim', (() => { const u = unit('Alarm setting wheel'); let r = 0; if (u) u.traverse((o) => { if (o.isMesh) r = Math.max(r, maxR(o)); }); return r || null; })(), '0.05 behind the dial sheet'],
  ];
  // The disc's dial-ward FACE between the raised track and the teeth is a smooth
  // annulus a pad could bear on axially; its outboard edge is the root circle,
  // read from the gear's own record (userData.r is the pitch radius, teeth the
  // count — the schematic tier reads the same fields) rather than from a
  // literal: root = r − 1.25·m, m = 2r/N.
  const discBody = find('alarmDiscBody');
  const gearRec = (m) => { let o = m; while (o && !(o.userData && o.userData.r)) o = o.parent; return o ? o.userData : null; };
  const rec = gearRec(discBody);
  const discRoot = rec && rec.teeth ? rec.r - 1.25 * (2 * rec.r / rec.teeth) : null;
  const trackOuter = hold.trackR_u + 0.20;   // ALARM_TRACK_HALFW is 0.20 — reported beside the root so the face's width is visible
  candidates.splice(2, 0, ['release disc face, at the root circle', discRoot, `the smooth annulus outboard of the track (${trackOuter.toFixed(2)} → root), axial pad from a dial-hung bracket`]);

  // --- CONTROL: the reader's pin moves relative to the disc under the hour --
  const pin = find('alarmReaderPin'), disc = unit('Alarm release disc');
  const relPin = () => { C.scene.updateMatrixWorld(true); const w = pin.getWorldPosition(new (pin.position.constructor)()); return disc.worldToLocal(w.clone()); };
  const base = { tau: 0, crownPullT: 0, leverEngage: 0, tension: 1, alarmCrownRotation: 0 };
  C.setPose({ ...base, tau: 0 });
  const p0 = relPin();
  C.setPose({ ...base, tau: 3 * 3600 });
  const p1 = relPin();
  const relMove = Math.hypot(p1.x - p0.x, p1.y - p0.y, p1.z - p0.z);
  const relAz = Math.atan2(p1.y, p1.x) - Math.atan2(p0.y, p0.x);
  C.setPose(base);

  return { hold, row: row && { load: row.load, q: row.quantities, envelope: row.envelope }, hubDims, candidates,
           discRec: rec, relMove, relAz, hasPin: !!pin, hasDisc: !!disc };
});
await browser.close(); srv.kill();

const rows = [];
const push = (what, ok, got, want) => rows.push({ what, ok, got, want });
const near = (a, b, tol) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

if (!out.hold || !out.row) { console.log('FATAL — the movement publishes no hold record or no bias-blade row (main.js TODO 144 block missing)'); process.exit(1); }
const H = out.hold, Q = out.row.q;
const UNIT_MM = H.dragTq_Nmm / (H.mu * (H.pinF_mN / 1000) * H.trackR_u); // the record's own conversion, recovered — asserted below against layout's

console.log('\n  WHAT HOLDS THE ALARM RELEASE DISC? (TODO 144)\n');
console.log(`  bias blade   k ${Q.k_N_per_m.toFixed(1)} N/m, bear ${Q.bearF_mN_riding.toFixed(2)} mN riding / ${Q.bearF_mN_dropped.toFixed(2)} dropped`);
console.log(`  at the pin   ${Q.pinF_mN_riding.toFixed(2)} mN riding / ${Q.pinF_mN_dropped.toFixed(2)} dropped   (× ${(Q.armIn_u / Q.armOut_u).toFixed(4)}, BEAR_R/ARM_LEN)`);
console.log(`  drag         μ ${H.mu} · ${H.pinF_mN.toFixed(2)} mN · r ${H.trackR_u} u  =  ${H.dragTq_Nmm.toExponential(3)} N·mm about the disc, continuous under the hour`);
console.log(`  hold         ${H.holder ? `${H.holder}: ${H.holdTq_Nmm.toExponential(3)} N·mm` : 'NONE DECLARED'}   (needs ≥ ${H.headroomRequired}× the drag = ${(H.headroomRequired * H.dragTq_Nmm).toExponential(3)} N·mm)\n`);

// --- the film bound: 2π η r³ L ω / c, at ten times the thickest watch oil ---
const ETA_BOUND = 1.0;                                  // Pa·s — Moebius 9010 is ~0.1 at 20 °C; a bound, not a fit
const OMEGA = 2 * Math.PI / (12 * 3600);                // the hour tube's rate, rad/s
const D = out.hubDims;
const film_Nmm = D ? 2 * Math.PI * ETA_BOUND * (D.rIn * UNIT_MM / 1000) ** 3 * (D.h * UNIT_MM / 1000) * OMEGA / ((D.rIn - 2.5) * UNIT_MM / 1000) * 1000 : NaN;
// (the hour tube's outer radius is the hub's bore less the 0.05 fit; HOUR_TUBE_OUTER is 2.5 in layout.js — the fit is recovered as rIn − 2.5)
const fit_u = D ? D.rIn - 2.5 : NaN;
console.log(`  hub film     bore ${D ? D.rIn.toFixed(4) : '?'}, wall to ${D ? D.rOut.toFixed(4) : '?'}, ${D ? D.h.toFixed(4) : '?'} long, fit ${fit_u.toFixed(4)}: ≤ ${film_Nmm.toExponential(2)} N·mm at η ${ETA_BOUND} Pa·s — ${(film_Nmm / H.dragTq_Nmm).toExponential(1)} of the pin\n`);

// --- the design table ------------------------------------------------------
const needFR = H.headroomRequired * H.dragTq_Nmm;      // N·mm the hold must present at the DISC
console.log(`  A FRICTION HOLD NEEDS  F · r ≥ ${needFR.toExponential(3)} N·mm at the disc (μ ${H.mu}, headroom ${H.headroomRequired}), i.e. F ≥ ${(needFR / H.mu).toExponential(3)} N·mm of normal force × radius`);
console.log('  read off the metal, reflected by the train ratio where the member is not the disc:');
console.log('    member                          r (u)    r (mm)   ratio ω/ω_disc   F needed   envelope 5–50 mN');
// ratios: the disc turns 1; i1 (carrying i1b, 28 T against the disc's 30) turns 30/28; the setting wheel (30) 1; the arbor pinion (10 T against i2's 37, i2 against i1's 28) — the whole chain nets ALARM_SET_RATIO⁻¹ = 30/10 = 3 at the arbor
const RATIO = { 'setting arbor rod (at the cock)': 3, 'setting arbor cock bush': 3, 'release disc face, at the root circle': 1, 'release disc rim': 1, 'setting wheel rim': 1 };
const table = [];
for (const [name, r_u, note] of out.candidates) {
  if (!r_u) { console.log(`    ${name.padEnd(30)} (not found)`); continue; }
  const ratio = RATIO[name];
  const tqAtMember = needFR / ratio;                   // a torque at the disc is ratio× SMALLER at a member turning ratio× faster
  const F_mN = 1000 * tqAtMember / (H.mu * r_u * UNIT_MM);
  const inEnv = F_mN >= 5 && F_mN <= 50;
  table.push({ name, r_u, F_mN, inEnv, note });
  console.log(`    ${name.padEnd(30)} ${r_u.toFixed(3).padStart(7)} ${(r_u * UNIT_MM).toFixed(3).padStart(8)} ${String(ratio).padStart(12)}      ${F_mN.toFixed(1).padStart(6)} mN   ${inEnv ? 'inside' : 'OUTSIDE'}   — ${note}`);
}
console.log(`  (disc gear record: ${JSON.stringify(out.discRec)})\n`);

// --- rows -----------------------------------------------------------------
push('CONTROL the reader’s pin moves RELATIVE TO THE DISC under the hour (so it slides, so it drags)',
  out.hasPin && out.hasDisc && out.relMove > 1e-3, `${out.relMove.toFixed(4)} u over 3 h (Δaz ${out.relAz.toFixed(4)} rad)`, '> 0.001');
push('CONTROL the row’s pin force is its bear force re-levered BEAR_R/ARM_LEN',
  near(Q.pinF_mN_riding, Q.bearF_mN_riding * Q.armIn_u / Q.armOut_u, 1e-9), Q.pinF_mN_riding.toFixed(4), (Q.bearF_mN_riding * Q.armIn_u / Q.armOut_u).toFixed(4));
push('CONTROL riding − dropped at the bear point is k·ALARM_PIN_DROP·(BEAR_R/ARM_LEN) (TODO 117’s control, same blade)',
  near(Q.bearF_mN_riding - Q.bearF_mN_dropped, 1000 * Q.k_N_per_m * Q.pinDrop_u * (Q.armIn_u / Q.armOut_u) * UNIT_MM / 1000, 1e-9),
  (Q.bearF_mN_riding - Q.bearF_mN_dropped).toFixed(4), (1000 * Q.k_N_per_m * Q.pinDrop_u * (Q.armIn_u / Q.armOut_u) * UNIT_MM / 1000).toFixed(4));
push('CONTROL the record’s unit conversion is layout’s UNIT_MM (0.72/1.9)', near(UNIT_MM, 0.72 / 1.9, 1e-9), UNIT_MM.toFixed(6), (0.72 / 1.9).toFixed(6));
push('CONTROL the record’s load is the row’s riding load', near(H.pinF_mN, Q.pinF_mN_riding, 1e-12), H.pinF_mN.toFixed(4), Q.pinF_mN_riding.toFixed(4));
push('the load is inside the inherited detent envelope at both ends (never forkable)',
  Q.pinF_mN_dropped >= 5 && Q.pinF_mN_riding <= 50, `${Q.pinF_mN_dropped.toFixed(2)} … ${Q.pinF_mN_riding.toFixed(2)} mN`, '5–50 mN');
push('the hub’s film is not the load — under a thousandth of the pin’s drag at ten times any watch oil’s viscosity',
  D && film_Nmm / H.dragTq_Nmm < 1e-3, `${(film_Nmm / H.dragTq_Nmm).toExponential(2)}`, '< 1e-3');
push('a holding element is DECLARED (the record names its holder)', !!H.holder, H.holder ? H.holder : 'holder: null', 'a named member');
push(`and it clears the drag by ALARM_SPRING_HEADROOM ${H.headroomRequired}×`,
  !!H.holder && typeof H.holdTq_Nmm === 'number' && H.holdTq_Nmm >= H.headroomRequired * H.dragTq_Nmm,
  H.holdTq_Nmm == null ? 'no hold torque published' : `${H.holdTq_Nmm.toExponential(3)} N·mm, ${(H.holdTq_Nmm / H.dragTq_Nmm).toFixed(2)}×`, `≥ ${(H.headroomRequired * H.dragTq_Nmm).toExponential(3)} N·mm`);

let bad = 0;
for (const r of rows) {
  if (!r.ok) bad++;
  console.log(`  ${r.ok ? 'ok  ' : 'FAIL'} ${r.what}`);
  console.log(`       got ${r.got}   want ${r.want}`);
}
console.log(`\n  ${rows.length} rows, ${bad} failing\n`);
process.exit(bad ? 1 : 0);
