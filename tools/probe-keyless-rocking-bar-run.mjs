#!/usr/bin/env node
// THE CROWN STANDS STILL WHILE THE WATCH RUNS (§334 landing 5b, TODO 318's acceptance) — one native boot.
//
//   node --import ./tools/native/loader.mjs tools/probe-keyless-rocking-bar-run.mjs
//
// Before the rocking bar the winding train was one rigid chain from the fusee to the crown, so every turn the fusee
// paid out the crown paid out too: 4.2 stem turns backward over the reserve. With the bar out (its return spring, the
// running watch) the crown side does not follow the run-down, and winding swings the bar in and drops the carried
// wheel into the follower at the next whole tooth. The run-down is driven through `__clock.runDown`, which calls the
// live loop's own run-down law (drainBarrelBy) without stepping the balance; the winding through setCrownRotation and
// step(), the live loop's own input path.
//   R1  over a full run-down (full wind to empty) the stem's world angle moves under 1° and the crown wheel and the
//       bar's driver not at all, while the spur side (the transfer wheel) turns the run-down's full angle.
//       CONTROL: the same run-down with the bar held IN reads the old chain's backward turns (TODO 318's 4.2)
//   R2  winding from empty: the first crown input turns the crown side alone, at most one follower tooth's worth
//       (KB_PITCH_TURNS of bank), and then the bank follows the crown turn for turn with the lead a whole tooth
//   R3  winding banks up to the arrest and the crown stalls there (windArrestStalled)
//   R4  every winding tick leaves both of the bar's meshes in phase: under 2% of a pitch off anti-phase (the chain
//       solve's own tripwire) and at their pitch-circle sum. CONTROL: a lead half a tooth off reads the carried wheel ⇄
//       follower mesh over the bar
//   R5  letting go after winding: the run-down carries the bar out through the mesh (the crown side falling by the
//       swing's in-mesh part), the blade takes it to its banking, and then the crown side stands
//   R6  wind, let go for a minute, wind again: the teeth stay in phase through the second swing in
//   R7  the Wind button draws the engagement over several frames at 60 fps (its POSED pacing, KB_ENGAGE_SHOW_S)
import { bootNative } from './native/host.mjs';

const r = await bootNative({ query: '' });
const C = r.clock, THREE = await import('three');
const fails = [];
const row = (id, ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${id}  ${msg}`); if (!ok) fails.push(id); };
const find = (n) => { let h = null; C.scene.traverse((o) => { if (!h && o.name === n) h = o; }); return h; };
if (!find('kbBar')) { console.log('FAIL  the default build has no rocking bar (kbBar)'); process.exit(1); }
const worldZ = (o) => { const v = new THREE.Vector3(1, 0, 0).applyQuaternion(o.getWorldQuaternion(new THREE.Quaternion())); return Math.atan2(v.y, v.x); };
// the stem turns about its own axis, so its angle is read about that axis: a vector square to it, rotated
const stemAxisAngle = (o) => {
  const q = o.getWorldQuaternion(new THREE.Quaternion()), ax = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
  const ref = Math.abs(ax.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
  const u = ref.clone().sub(ax.clone().multiplyScalar(ref.dot(ax))).normalize(), w = ax.clone().cross(u);
  const v = new THREE.Vector3(1, 0, 0).applyQuaternion(q), vv = v.sub(ax.clone().multiplyScalar(v.dot(ax)));
  return Math.atan2(vv.dot(w), vv.dot(u));
};
const tracker = (o, read) => { let last = null, acc = 0; return () => { C.scene.updateMatrixWorld(true); const a = read(o); if (last !== null) { let d = a - last; d = Math.atan2(Math.sin(d), Math.cos(d)); acc += d; } last = a; return acc; }; };
const stem = find('windStem'), crownW = find('crownWheel'), driver = find('kbDriver'), transfer = find('transferWheel');
const DEG = 180 / Math.PI;
const SITES = ['keyless bar driver ⇄ bar carried wheel', 'keyless bar carried wheel ⇄ bar follower'];

function runDown(barIn) {
  C.resetInputs(); C.setCrownOut(false); C.setPose({ tension: 1, crownPullT: 0 });
  const tS = tracker(stem, stemAxisAngle), tC = tracker(crownW, worldZ), tD = tracker(driver, worldZ), tT = tracker(transfer, worldZ);
  tS(); tC(); tD(); tT();
  for (let h = 0; h < 40 * 60 && C.barrelWindTurns > 0; h++) {
    C.runDown(60, 60, barIn);
    tS(); tC(); tD(); tT();
  }
  return { stem: tS(), crown: tC(), driver: tD(), transfer: tT(), bank: C.barrelWindTurns };
}
const out = runDown(false), held = runDown(true);
row('R1', Math.abs(out.stem) * DEG < 1 && Math.abs(out.crown) < 1e-9 && Math.abs(out.driver) < 1e-9 && Math.abs(out.transfer) > 1
  && Math.abs(held.stem) / (2 * Math.PI) > 4,
  `bar out: stem ${(out.stem * DEG).toFixed(4)}°, crown wheel ${(out.crown * DEG).toExponential(1)}°, driver ${(out.driver * DEG).toExponential(1)}°, transfer ${(out.transfer * DEG).toFixed(1)}° (bank → ${out.bank.toFixed(4)}); `
  + `CONTROL bar held in: stem ${(held.stem / (2 * Math.PI)).toFixed(2)} turns`);

// winding from empty, after the run-down left the lead mid-tooth
C.resetInputs(); C.setCrownOut(false); C.setPose({ tension: 1, crownPullT: 0 }); C.runDown(40 * 3600);
// §334 5c: the crown side alone first turns to the tooth the carried wheel will meet, then swings the bar in freely to the
// tips (its clip on the driver); in mesh the bank follows as the bar swings on to depth
const p = C.kbPitchTurns, lead0 = C.kbLead, swingNeed = C.kbTipS * C.kbSwingTurns;
const r0 = (lead0 + swingNeed) - Math.floor((lead0 + swingNeed) / p) * p, need = swingNeed + (r0 > 1e-12 && p - r0 > 1e-12 ? p - r0 : 0);
let swingTicks = 0;
let worstAt = null, rot = C.crownRotation, firstBank = null, worstOff = 0, worstD = 0, stalled = false, steps = 0;
const sign = Math.sign(C.windSign ?? 1) || 1;
for (let i = 0; i < 20000 && !stalled; i++) {
  const b = C.barrelWindTurns, l = C.kbLead;
  rot += sign * 0.05; C.setCrownRotation(rot); C.step(0.02); steps++;
  if (firstBank === null && C.barrelWindTurns > b + 1e-12) firstBank = { leadAt: C.kbLead, pick: C.kbLead - lead0 };
  if (C.kbSwing > 0 && C.kbSwing < 1) swingTicks++;
  if (C.kbSwing === 1) for (const s of SITES) { const m = C.measureMeshNow(s); if (!m.ok) { worstOff = Infinity; continue; } if (m.off > worstOff) { worstOff = m.off; worstAt = { s, i, lead: C.kbLead, bank: C.barrelWindTurns }; } worstD = Math.max(worstD, Math.abs(m.d - m.want)); }
  stalled = C.windArrestStalled ?? false;
}
const leadR = (x) => { const q = x - Math.floor(x / p) * p; return Math.min(q, p - q); };
row('R2', firstBank !== null && firstBank.pick <= need + 1e-9 && firstBank.pick >= need - 0.003 * p && leadR(C.kbLead) < 1e-9 && swingTicks > 0,
  `the crown side alone took ${firstBank ? firstBank.pick.toFixed(5) : '—'} of the ${need.toFixed(5)} (to the tooth the carried wheel meets, then the free swing to the tips ${swingNeed.toFixed(5)}; ${swingTicks} ticks drawn with the bar part-way); lead ends ${(leadR(C.kbLead) / p).toExponential(1)} of a tooth off whole`);
row('R3', stalled && Math.abs(C.barrelWindTurns - (C.windArrest?.engageTurns ?? C.barrelWindTurns)) < 1e-6,
  `banked to ${C.barrelWindTurns.toFixed(4)} in ${steps} ticks, the crown ${stalled ? 'stalled at the arrest' : 'NOT stalled'}`);
let ctl = null;
{ C.setPose({ kbSwing: 1, kbLead: C.kbLead + p / 2 }); const m = C.measureMeshNow(SITES[1]); ctl = m.ok ? m.off : null; C.setPose({ kbLead: C.kbLead - p / 2 }); }
row('R4', worstOff < 0.02 && worstD < 1e-6 && ctl !== null && ctl > 0.02,
  `worst off anti-phase ${(worstOff * 100).toFixed(3)}% of a pitch ${JSON.stringify(worstAt)}, worst centre miss ${worstD.toExponential(1)} over the winding; CONTROL half a tooth of lead reads ${ctl === null ? '—' : (ctl * 100).toFixed(1) + '%'}`);
// R5: let go after winding — the run-down back-drives the bar out through the mesh (the crown side follows, the crown
// turns back), the teeth part at the tips, the blade takes the bar to its banking, and the crown side stands
{
  const side = () => C.barrelWindTurns + C.kbLead, s0 = side(), want = (1 - C.kbTipS) * C.kbSwingTurns;
  let outAt = null;
  for (let k = 0; k < 4000 && outAt === null; k++) { C.runDown(1); if (C.kbSwing === 0) outAt = s0 - side(); }
  const s1 = side(); C.runDown(3600); const still = Math.abs(side() - s1);
  row('R5', outAt !== null && Math.abs(outAt - want) < 1e-6 && still < 1e-12,
    `the crown side fell ${outAt === null ? '—' : outAt.toFixed(6)} carrying the bar out (the swing from the tips to depth, ${want.toFixed(6)}), then stood: ${still.toExponential(1)} over the next hour`);
}
// R6: wind, let go for a minute (the run-down carries the bar part-way out, still in mesh), wind again: the teeth stay
// in phase through the second swing in
{
  C.resetInputs(); C.setCrownOut(false); C.setPose({ tension: 0.5, crownPullT: 0 });
  let rr = C.crownRotation, worst = 0, sawPart = false;
  const wind = (n) => { for (let i = 0; i < n; i++) { rr += sign * 0.05; C.setCrownRotation(rr); C.step(0.02);
    if (C.kbSwing === 1) for (const st of SITES) { const m = C.measureMeshNow(st); if (m.ok) worst = Math.max(worst, m.off); } } };
  wind(40); C.runDown(60); sawPart = C.kbSwing > C.kbTipS && C.kbSwing < 1; wind(40);
  row('R6', sawPart && worst < 0.02 && C.kbSwing === 1, `a minute's run-down left the bar ${sawPart ? 'part-way out, in mesh' : 'NOT part-way'}; through the second wind the worst mesh reads ${(worst * 100).toFixed(3)}% of a pitch`);
}
// R7: the Wind button (pressWind, the button's own action) draws the engagement: at 60 frames a second the bar is seen
// part-way for several frames before it is at depth (POSED pacing, KB_ENGAGE_SHOW_S), where unpaced it fitted in one
{
  C.resetInputs(); C.setCrownOut(false); C.setPose({ tension: 0.3, crownPullT: 0 }); C.runDown(600);
  C.pressWind();
  let part = 0, depth = null;
  for (let i = 0; i < 600 && depth === null; i++) { C.step(1 / 60); if (C.kbSwing > 0 && C.kbSwing < 1) part++; if (C.kbSwing === 1) depth = i; }
  row('R7', depth !== null && part >= 15, `the Wind button: the bar drawn part-way for ${part} frames, at depth on frame ${depth}`);
}
console.log(fails.length ? `FAIL ${fails.join(', ')}` : 'PASS all rows');
process.exit(fails.length ? 1 : 0);
