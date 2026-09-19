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
// §218 TIER TWO adds the overcoil's rows: the centroid solve converged, the
// clamp ratio reads 1 to 1e-6 (Phillips's theorem, verified on the elastica:
// the stud does no work at small angle), the pivot force at the performed
// swing under a tenth of the flat spring's with the same section (the
// physical residual — second order in θ — is reported), and the mesh carries
// the raised plane (the tube's path climbs to `raise` at the stud).
//
// TODO 147 adds the two rows that say it is a BREGUET terminal and not just a
// Phillips one — the stud's post standing wholly inboard of the outer coil,
// and no bend in the terminal tighter than the collet the knee is already
// formed round — and changes the question the terminal-length SWEEP asks.
// With the stud a CONDITION rather than an output, the length's window has a
// physical wall at each end: shorter and the ribbon cannot be formed to the
// curve, longer and the terminal's arc leaves the balance's swept circle. The
// sweep holds the lower wall and the shipped point; the upper wall belongs to
// main.js's boot assert, which measures the built wheel — restating it here
// would be a second copy of a number this probe does not own.
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
  // 3. the mesh carries the raise: the tube's vertices at the stud end sit
  //    `raise` above the spiral's mid-plane (after the standing scale)
  let zMax = -Infinity; const pos = tube.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) zMax = Math.max(zMax, pos.getZ(i) * tube.scale.z);
  return {
    zMax, overcoilUD: U.overcoil || null, termEndZ: U.termEndZ, height: U.section && U.section.c * 2, spiral: U.spiral,
    frames: U.spiralFrames.length, devLen: U.devLen, maxRel, relAtEnds: [rel[0], rel[rel.length - 1]], distinct,
    coils: U.spiral && U.spiral.coils, h_mm: O && O.spring.h_mm, fHz: O && O.fImpliedHz, agrees: O && O.agrees,
    B: B && {
      overcoil: B.overcoil,
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
  const OC = B.overcoil;
  if (OC) {
    row('overcoil: centroid + stud solve converged', OC.converged, `centroid residual ${OC.centroidResidual_u.toExponential(1)} u, stud residual ${OC.studResidual_u.toExponential(1)} u, in ${out.overcoilUD.iters} iterations; κ(s) = ${OC.a0.toExponential(4)} ${OC.a1 >= 0 ? '+' : '−'} ${Math.abs(OC.a1).toExponential(4)}·s ${OC.a2 >= 0 ? '+' : '−'} ${Math.abs(OC.a2).toExponential(4)}·s²`);
    // TODO 147 — the two rows the old family could not have passed: the stud's
    // POST stands wholly inboard of the outer coil (what the raise is paid
    // for), and the curve the solve shaped is one a ribbon can be formed to.
    row('overcoil: the stud stands inboard of the outer coil (Breguet, not just Phillips)', OC.studInboard,
      `stud at r ${OC.endR_u.toFixed(4)} (declared ${OC.studR_u.toFixed(4)}), post reaches ${(OC.endR_u + OC.postHalf_u).toFixed(4)} against the outer coil's ${OC.outerR_u.toFixed(4)}; terminal's own max radius ${OC.termMaxR_u.toFixed(4)}`);
    row('overcoil: no terminal bend tighter than the collet the knee is formed round', OC.formable,
      `ρ ${OC.rhoStart_u.toFixed(2)} → ${OC.rhoEnd_u.toFixed(2)}, tightest ${OC.rhoMin_u.toFixed(2)} u against the collet's ${OC.kneeR_u.toFixed(2)}`);
    row('overcoil: concentric — clamp ratio 1 to 1e-6 (Phillips, verified)', OC.concentric, `×${B.clampRatio.toFixed(7)}`);
    row(`overcoil: pivot force at ${B.peaks.performed.ampDeg}° under a tenth of the flat spring's`, OC.forceRatio.performed < 0.1,
      `${B.peaks.performed.pivotForce_mN.toExponential(2)} vs flat ${OC.flat.pivotForce_mN.performed.toExponential(2)} mN (×${OC.forceRatio.performed.toFixed(3)}); at ${B.peaks.physical.ampDeg}° ×${OC.forceRatio.physical.toFixed(3)} — second order, reported`);
    row('overcoil: the mesh climbs to the raised plane', Math.abs(out.zMax - (out.termEndZ + out.height / 2)) < 0.05,
      `tube top ${out.zMax.toFixed(3)} u vs raise ${out.termEndZ} + half-height ${(out.height / 2).toFixed(3)}`);
  }
  const P = B.peaks;
  console.log(`report · performed ${P.performed.ampDeg}°: pivot ${P.performed.pivotForce_mN.toFixed(5)} mN, radial excursion ${P.performed.radialShift_mm.toFixed(3)} mm, min coil gap ${P.performed.minCoilGap_mm.toFixed(3)} mm, stress ${P.performed.stress_MPa.toFixed(1)} MPa`);
  console.log(`report · physical  ${P.physical.ampDeg}°: pivot ${P.physical.pivotForce_mN.toFixed(5)} mN, radial excursion ${P.physical.radialShift_mm.toFixed(3)} mm, min coil gap ${P.physical.minCoilGap_mm.toFixed(3)} mm, stress ${P.physical.stress_MPa.toFixed(1)} MPa (${B.nReport} continuation rows)`);
}
row('boot silent', warns.length === 0, warns.length ? warns.join(' | ') : '');
if (out.B && out.B.overcoil) {
  // THE SWEEP, through the real builder under the three-node loader. Since
  // TODO 147 the stud is a CONDITION, not an output, so the sweep asks a
  // different question: with the stud pinned, where is the terminal length's
  // window, and is the shipped proportion inside it? Both edges are physical
  // now. BELOW it the solve has to bend the ribbon tighter than the collet the
  // knee is already formed round (0.40 turns: ρ 0.25 against 1.5) or reaches no
  // root at all. ABOVE it the terminal's own arc swings outside the balance's
  // swept circle — the boot assert in main.js is that edge's gate, measured
  // against the built wheel; what this holds is that the reach GROWS with the
  // proportion, so the shipped one is inside a window and not on its wall.
  const { spawnSync } = await import('node:child_process');
  const script = `
    import * as G from '${new URL('../src/geometry.js', import.meta.url).href}';
    const base = { innerR: ${out.spiral.innerR}, outerR: ${out.spiral.outerR}, coils: ${out.spiral.coils} };
    const oc = { raise: ${out.overcoilUD.raise}, kneeR: ${out.overcoilUD.kneeR}, studR: ${out.overcoilUD.studR} };
    const rows = [];
    for (const turns of [0.40, ${out.B.overcoil.turns}, 1.0]) {
      const rest = G.hairspringRest({ ...base, overcoil: { ...oc, turns } });
      const o = rest.overcoil;
      rows.push({ turns, converged: o.converged, rhoMin: o.rhoMin, termMaxR: o.termMaxR, endR: rest.endR, kneeR: o.kneeR });
    }
    console.log(JSON.stringify(rows));`;
  const r = spawnSync(process.execPath, ['--import', new URL('./three-node-loader.mjs', import.meta.url).pathname, '--input-type=module', '-e', script], { cwd: join(ROOT, 'tools'), encoding: 'utf8' });
  let rows = null; try { rows = JSON.parse(r.stdout.trim().split('\n').pop()); } catch (e) { rows = null; }
  if (!rows) row('overcoil sweep ran', false, (r.stderr || '').slice(0, 300));
  else {
    const at = (t) => rows.find((x) => Math.abs(x.turns - t) < 1e-9);
    const shipped = at(out.B.overcoil.turns), under = at(0.40), over = at(1.0);
    const formable = (x) => x.converged && x.rhoMin >= x.kneeR;
    row(`overcoil sweep: solves formably at the shipped ${out.B.overcoil.turns} turns, stud where declared`,
      formable(shipped) && Math.abs(shipped.endR - out.overcoilUD.studR) < 1e-8,
      `ρ tightest ${shipped.rhoMin.toFixed(2)} against the collet's ${shipped.kneeR.toFixed(2)}, stud r ${shipped.endR.toFixed(4)}`);
    row('overcoil sweep: below the window the ribbon cannot be formed to the curve', !formable(under),
      under.converged ? `0.40 turns wants ρ ${under.rhoMin.toFixed(3)} against the collet's ${under.kneeR.toFixed(2)}` : '0.40 turns reaches no root');
    row("overcoil sweep: the terminal's reach grows with the proportion (the upper edge is the balance's swept circle, gated at boot)",
      over.converged && over.termMaxR > shipped.termMaxR,
      `${shipped.termMaxR.toFixed(4)} at ${shipped.turns} turns → ${over.termMaxR.toFixed(4)} at 1.0`);
  }
}
console.log(fails.length ? `\nFAIL — ${fails.length} row(s): ${fails.join('; ')}` : '\nPASS — the hairspring breathes as steel does');
process.exit(fails.length ? 1 : 0);
