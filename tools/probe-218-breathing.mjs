// §218 — THE ACCEPTANCE TEST for the hairspring's breathing, taken on the
// built tree. Answers, with numbers: does every wind frame the spring can
// wear contain the same length of steel; is the torque the frames deliver
// per radian the k the rate was computed from; does the free-landing control
// read no pivot force; did the elastica converge on every frame; and is the
// ribbon's outer-fibre stress at the physical swing under the cited
// endurance figure. Reports beside them the numbers tier two decides on —
// the lateral pivot force at the performed and physical amplitudes, the
// coils' radial excursion, the minimum coil gap, the clamp stiffening.
//
// The load-bearing row is the FIRST, and it is measured on the metal: the
// published `spiralFrames` polylines (what the tube was swept along and what
// the schematic draws), summed frame by frame against `devLen`. The law this
// section replaced kept every coil at its rest radius and moved the ribbon's
// LENGTH instead — run this against a tree before §218 and that row reads
// ±1.59% with everything else green, which is the "shown failing" the entry
// asked for. A tree with no breathing payload at all fails the payload rows
// and still measures that one.
//
// Exit 1 on any failure; the pass line carries the numbers.
//
// Run: cd tools && node probe-218-breathing.mjs            (this checkout)
//      ROOT=/path/to/other/checkout node probe-218-breathing.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8490 + Math.floor(Math.random() * 40);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const b = await chromium.launch(); const p = await b.newPage();
const boot = [];
p.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') boot.push(m.text()); });
p.on('pageerror', (e) => boot.push('PAGEERROR ' + String(e)));
await p.goto(`http://127.0.0.1:${PORT}/index.html?hud=0&sync=0`, { waitUntil: 'load', timeout: 120000 });
await p.waitForFunction(() => !!window.__clock, null, { timeout: 120000 });
const noise = /WebGL|GroupMarker|404|swiftshader|ReadPixels/i;
const warns = boot.filter((m) => !noise.test(m));

const out = await p.evaluate(() => {
  const C = window.__clock;
  const hs = C.labelEntries.find((e) => e.name === 'Hairspring');
  let grp = null, tube = null;
  hs.obj.traverse((o) => {
    if (!grp && o.userData && o.userData.spiralFrames) grp = o;
    if (!tube && o.isMesh && !o.userData.schematic) tube = o;
  });
  const U = grp.userData;
  // 1. the metal: every published frame's polyline against the rest length
  const lens = U.spiralFrames.map((poly) => {
    let len = 0;
    for (let i = 1; i < poly.length; i++) len += Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]);
    return len;
  });
  const rel = lens.map((l) => (l - U.devLen) / U.devLen);
  const maxRel = Math.max(...rel.map(Math.abs));
  // 2. the frames are distinct geometries (MODELING rule 6) — a control that
  //    the swap is still a swap
  //    (from the REST frame, not whatever frame the boot pose left on)
  U.setWind(0); const g0 = tube.geometry.id;
  U.setWind(0.9); const g1 = tube.geometry.id;
  U.setWind(0); const g2 = tube.geometry.id;
  const distinct = g0 !== g1 && g0 === g2;
  const O = C.oscillator, B = O && O.breathing;
  return {
    frames: U.spiralFrames.length, devLen: U.devLen, maxRel, relAtEnds: [rel[0], rel[rel.length - 1]], distinct,
    coils: U.spiral && U.spiral.coils, h_mm: O && O.spring.h_mm, fHz: O && O.fImpliedHz, agrees: O && O.agrees,
    B: B && {
      converged: B.converged, lengthHeld: B.lengthHeld, clampRatio: B.clampRatio, clampRatioAgrees: B.clampRatioAgrees,
      k: O.k_Nm_per_rad, kPure: O.kPure_Nm_per_rad, kFrames: B.kFrames_Nm_per_rad, kFramesAgrees: B.kFramesAgrees,
      control: B.control.pass, controlMax_mN: B.control.maxPivotForce_mN, stressInLimit: B.stressInLimit,
      fatigue_MPa: B.fatigue_MPa, peaks: B.peaks, nReport: B.report.length,
    },
  };
});
await b.close(); srv.kill();

const fails = [];
const row = (name, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); if (!ok) fails.push(name); };
console.log(`hairspring: ${out.coils} coils, ${out.frames} frames, devLen ${out.devLen.toFixed(4)} u, ribbon ${out.h_mm ? out.h_mm.toFixed(4) + ' mm' : '?'}, implied ${out.fHz ? out.fHz.toFixed(4) + ' Hz' : '?'}`);
row('every frame is one length of steel (metal, 1e-9)', out.maxRel < 1e-9,
  `max |Δlen|/len ${out.maxRel.toExponential(2)}; the two edge frames read ${(out.relAtEnds[0] * 100).toFixed(2)}% and ${(out.relAtEnds[1] * 100).toFixed(2)}%`);
row('frames are distinct geometries (rule 6 control)', out.distinct);
row('rate lands on the spec', !!out.agrees, out.fHz && `${out.fHz.toFixed(4)} Hz`);
if (!out.B) {
  row('breathing payload present', false, 'no oscillator.breathing — a tree before §218');
} else {
  const B = out.B;
  row('elastica converged on every frame and control', B.converged);
  row('payload length held', B.lengthHeld);
  row("builder's clamp ratio = fitted ratio", B.clampRatioAgrees, `×${B.clampRatio.toFixed(6)} (k/kPure ${(B.k / B.kPure).toFixed(6)})`);
  row("frames' torque per radian = k (0.5%)", B.kFramesAgrees, `${B.kFrames.toExponential(5)} vs ${B.k.toExponential(5)} N·m/rad`);
  row('free-landing control reads no pivot force', B.control, `max ${B.controlMax_mN.toExponential(2)} mN`);
  row(`stress at ${B.peaks.physical.ampDeg}° under the endurance figure`, B.stressInLimit, `${B.peaks.physical.stress_MPa.toFixed(1)} / ${B.fatigue_MPa} MPa`);
  const P = B.peaks;
  console.log(`report · performed ${P.performed.ampDeg}°: pivot ${P.performed.pivotForce_mN.toFixed(5)} mN, radial excursion ${P.performed.radialShift_mm.toFixed(3)} mm, min coil gap ${P.performed.minCoilGap_mm.toFixed(3)} mm, stress ${P.performed.stress_MPa.toFixed(1)} MPa`);
  console.log(`report · physical  ${P.physical.ampDeg}°: pivot ${P.physical.pivotForce_mN.toFixed(5)} mN, radial excursion ${P.physical.radialShift_mm.toFixed(3)} mm, min coil gap ${P.physical.minCoilGap_mm.toFixed(3)} mm, stress ${P.physical.stress_MPa.toFixed(1)} MPa (${B.nReport} continuation rows)`);
}
row('boot silent', warns.length === 0, warns.length ? warns.join(' | ') : '');
console.log(fails.length ? `\nFAIL — ${fails.length} row(s): ${fails.join('; ')}` : '\nPASS — the hairspring breathes as steel does');
process.exit(fails.length ? 1 : 0);
