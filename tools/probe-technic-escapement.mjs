// DOES THE LEGO ANCHOR ESCAPE ONE TOOTH A PERIOD ON ITS 8T WHEEL, IS ITS LOCK
// DEEPER THAN A PLASTIC BEARING'S PLAY, AND DOES THE KNIFE-EDGE BALANCE'S SOLVED
// PERIOD LAND THE BEAT THE FOURTH→ESCAPE ROW IS CUT FOR?
// Acceptance, pure Node, no browser, no network; exits non-zero on any failure.
// BUILT §287 (src/technic-escapement.js), §219 tier three (b) landing J.
//
// MODELLED, NOT SIMULATED: the escapement is read off the parts' outlines as
// the anchor is turned — quasi-static, the wheel settled at every step — and
// the period is T = 2π √(I/(m g d)) with I and d read off the parts' solids.
// Nothing is integrated; the swing is POSED inside the window the parts admit,
// the material's density is a POSED band (it cancels from the period), and the
// bearing play the lock is set against is the feasibility note's F2 figure.
//
//   · PARTS — every figure in ESC_DIM_MM and ARM_PARTS re-read off the parts:
//     the cross axle's reach, the knife's height, span, length and flank, the
//     thin liftarms' thickness, width, axle and round holes, the friction pin's
//     two halves, the gears' width;
//   · SOLIDS — every balance part closed (no ray crosses it an odd number of
//     times), the 40T's volume converged at the solid grid, a box's volume and
//     inertia exact; the fast overlap the escapement reads equal to landing H's
//     `penetration` over sampled states;
//   · ESCAPEMENT — solveEscapement over the lattice answers the declared anchor
//     and the 8T, and no 16T geometry escapes at any setting; the setting is
//     the middle of the run that escapes; the posed swing is inside the window
//     the continuous trace measures;
//   · BEAT — two full swings at the posed amplitude advance the wheel exactly
//     one tooth a period; each beat has a drop; the drops (mm at the tip) and
//     the shallowest LOCK against F2's play; RECOIL against the drive after a
//     catch on the outward swing, IMPULSE with it on the return;
//   · RATE — RATE_TABLE's law forked to LEGO: the fourth→escape chain's
//     product × the escape teeth × 120 is TECHNIC_VPH, the row is solveRatio's,
//     the note's (40:8)(12:8) and (24:8)(20:8) multiply right and are refused
//     off the 4 mm lattice; the beat period is 2·3600/vph;
//   · BALANCE — solveBalance answers the declared arms and gears, inside the
//     0.5% band; T plugs back into T = 2π √(I/(m g d)) at float noise; d > 0;
//     the period against amplitude (the exact pendulum law) against its series;
//     the axle-polymer variant reported; the trip torque reported;
//   · BUILD — the columns contiguous, the arbor's holes at its height, the
//     knife's apex at the pivot, the crossbar on both knives, every keyed part
//     on its axle's line in its slab, the pallets' pins in the pallet arms'
//     round holes, the wheel in the pallets' slab, the moving bodies' in-plane
//     clearances, and the .ldr.
//
// WHAT THIS DOES NOT CLAIM: an amplitude the drive would sustain (the swing is
// posed); a force at the knife or the pallets (the trip torque is the
// frictionless bound); that a builder's pallet setting lands in the 3.5° that
// escapes (it is reported); the rate with LEGO's tolerances (the period's
// sensitivity to d is reported, not gated).
//
// CONTROLS, each seen to fail: a 16T wheel on the declared anchor; the −
// pallet NOT mirrored (cut at the + pallet's angle); the bob removed and the
// centre of mass lifted to the knife (no restoring); a fourth→escape chain one
// tooth off; the recoil read with the drive reversed; an open box (odd rays);
// the overlap read 0.05 mm off; a declared setting outside the run.
//
//   node tools/probe-technic-escapement.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseLibrary, bounds, placements, walk, LDU_MM } from '../src/ldraw.js';
import { loadPack } from './technic-pack.mjs';
import { CATALOGUES, TECHNIC_FORK, TECHNIC_VPH, TECHNIC_ESCAPE_TEETH, technicForkTargets, solveRatio, catalogueMesh, ratQ, ratMul, ratEq, ratStr } from '../src/layout.js';
import { LEGO_DIM_MM as D, GEAR_TIP_MM, AXLE_PARTS } from '../src/technic-frame.js';
import { toLdr } from '../src/technic-ldraw.js';
import { starProfile, penetration, centreRatio } from '../src/technic-fusee.js';
import * as X from '../src/technic-escapement.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const lib = loadPack();   // vendor/ldraw/technic-parts.mpd (BUILT §309: or with TECHNIC_SUBSTITUTE's one swap)
const L = (mm) => mm / LDU_MM;
const B = (p) => bounds(lib, `${p}.dat`);
const deg = (r) => (r * 180 / Math.PI);
const f3 = (v) => v.toFixed(3);
let fails = 0;
const fail = (msg) => { fails++; console.log(`  ✗ ${msg}`); };
const ctl = [];
const control = (name, caught) => { ctl.push([name, caught]); };
const near = (a, b, tol = 1e-4) => Math.abs(a - b) <= tol;
const E = X.ESC_DIM_MM, P = X.ESCAPEMENT_PARTS, S = X.TECHNIC_ESCAPEMENT, BAL = X.TECHNIC_BALANCE;

console.log('THE LEGO ESCAPEMENT — an anchor on an 8T, a balance arm on a knife edge (MODELLED, an ANALOGUE of the steel lever and balance)\n');

// ── PARTS ───────────────────────────────────────────────────────────────────
{
  const ax = B(AXLE_PARTS[4]), kn = B(P.knife), arm = B('6632'), pin = B(P.palletPin), g8 = B(P.pallet), g40 = B(P.mass);
  // the knife's flank: its top surface at the span's edge, against the apex
  let edgeTop = Infinity;
  walk(lib, `${P.knife}.dat`, (k, ps) => { if (k === 'tri') for (const p of ps) if (Math.abs(Math.abs(p[2]) - 20) < 1e-6) edgeTop = Math.min(edgeTop, p[1]); });
  const flank = deg(Math.atan2(edgeTop - kn.lo[1], 20));
  const rows = [
    ['axleReach', E.axleReach, ax.hi[1] * LDU_MM], ['knifeH', E.knifeH, (kn.hi[1] - kn.lo[1]) * LDU_MM],
    ['knifeHalfSpan', E.knifeHalfSpan, kn.hi[2] * LDU_MM], ['knifeHalfLength', E.knifeHalfLength, kn.hi[0] * LDU_MM],
    ['knifeFlankDeg', E.knifeFlankDeg, flank], ['armHalfThick', E.armHalfThick, arm.hi[1] * LDU_MM], ['armHalfWidth', E.armHalfWidth, arm.hi[0] * LDU_MM],
    ['pinHalf', E.pinHalf, -pin.lo[0] * LDU_MM], ['pinAxle', E.pinAxle, pin.hi[0] * LDU_MM], ['gearHalf (8T)', E.gearHalf, g8.hi[2] * LDU_MM], ['gearHalf (40T)', E.gearHalf, g40.hi[2] * LDU_MM],
  ];
  for (const [k, want, got] of rows) if (!near(want, got, 1e-3)) fail(`ESC_DIM_MM.${k} is ${want}, the parts read ${f3(got)}`);
  if (kn.lo[1] !== 0) fail(`the knife's apex is not its origin (top at ${kn.lo[1]} LDU)`);
  // the arms: axle holes at the keyed end and at the reach, round holes between
  for (const [part, row] of Object.entries(X.ARM_PARTS)) {
    const hs = placements(lib, `${part}.dat`, /axlehol|peghole|beamhol|npeghol/);
    const at = (re) => [...new Set(hs.filter((h) => re.test(h.file)).map((h) => h.m[2] * LDU_MM))].sort((a, b) => a - b);
    const axl = at(/axlehol/), rnd = at(/peghole|beamhol/).filter((z) => !axl.some((a) => near(a, z, 1e-6)));
    const z0 = Math.min(...axl), rel = (zs) => zs.map((z) => +(z - z0).toFixed(4));
    if (!near(rel(axl).at(-1), row.reach, 1e-6) || rel(axl).length !== 2) fail(`${part}: its axle holes stand at ${rel(axl)} mm, ARM_PARTS says 0 and ${row.reach}`);
    if (JSON.stringify(rel(rnd)) !== JSON.stringify([...row.round])) fail(`${part}: its round holes stand at ${rel(rnd)} mm, ARM_PARTS says ${row.round}`);
  }
  console.log(`PARTS: ${rows.length} figures and ${Object.keys(X.ARM_PARTS).length} arms' holes re-read off the parts — the knife ${E.knifeH} mm, its flank ${flank.toFixed(1)}°, the axle's reach ${E.axleReach} mm`);
}

// ── SOLIDS ──────────────────────────────────────────────────────────────────
const frame = X.frameEscapement();
const body = X.framedBalance(frame, lib);
{
  const parts = [...new Set(body.map((p) => p.part))];
  for (const p of parts) { const s = X.partSolid(lib, p); if (s.odd) fail(`${p}: ${s.odd} of ${s.rays} rays cross it an odd number of times (not closed)`); }
  const a = X.partSolid(lib, P.mass, 0.25), b = X.partSolid(lib, P.mass, 0.125);
  if (Math.abs(a.V / b.V - 1) > 0.005) fail(`the 40T's volume moves ${((a.V / b.V - 1) * 100).toFixed(2)}% from the solid grid to half of it`);
  // a box: 20 × 20 × 20 LDU about its centre, its six faces
  const quad = (p) => `4 16 ${p.flat().join(' ')}`;
  const c = [[-10, -10, -10], [10, -10, -10], [10, 10, -10], [-10, 10, -10], [-10, -10, 10], [10, -10, 10], [10, 10, 10], [-10, 10, 10]];
  const faces = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [1, 2, 6, 5], [0, 3, 7, 4]];
  // (the open box drops a face the rays cross: the solid's rays run along Y)
  const boxLib = (name, fs) => parseLibrary(`0 FILE ${name}.dat\n0 box\n${fs.map((f) => quad(f.map((i) => c[i]))).join('\n')}\n`);
  const box = X.partSolid(boxLib('box', faces), 'box'), open = X.partSolid(boxLib('open', faces.filter((_, i) => i !== 2)), 'open');
  const side = 8, V = side ** 3, Iz = V * side * side / 6;
  if (!near(box.V, V, 1e-6 * V) || !near(box.S[0] + box.S[4], Iz, 1e-3 * Iz)) fail(`the box reads ${box.V} mm³ and I_z ${box.S[0] + box.S[4]}, exactly ${V} and ${Iz}`);
  control('an open box (one face gone) is counted, never guessed through (odd rays)', open.odd > 0);
  console.log(`SOLIDS: ${parts.length} balance parts closed; the 40T ${a.V.toFixed(1)} mm³ (${b.V.toFixed(1)} at half the grid); a box exact (${box.V.toFixed(3)} mm³, I_z ${(box.S[0] + box.S[4]).toFixed(2)})`);
  // the fast overlap against landing H's penetration
  const esc = X.escSpec(lib), m = X.escapementModel(lib, esc), W = starProfile(lib, S.wheelPart), Pp = starProfile(lib, P.pallet);
  let worst = 0, off = 0;
  for (let i = 0; i < 24; i++) {
    const th = i * 0.137, a2 = X.ESC_SWING_DEG * Math.PI / 180 * Math.sin(i), k = i % 2 ? 1 : -1;
    const c2 = m.pal(k, a2), ang = a2 + X.palletAngle(esc, k);
    const ref = penetration(W, [0, 0], th, Pp, c2, ang), fast = X.overlap(W, [0, 0], th, Pp, c2, ang);
    if (ref > -0.5) worst = Math.max(worst, Math.abs(ref - fast));
    const moved = penetration(W, [0, 0], th, Pp, [c2[0] + 0.05, c2[1]], ang);
    if (ref > -0.5 && Number.isFinite(moved)) off = Math.max(off, Math.abs(moved - fast));
  }
  if (worst > 0.01) fail(`the fast overlap parts from landing H's penetration by ${f3(worst)} mm`);
  control('the overlap read 0.05 mm off its place differs from it', off > 0.02);
  console.log(`  the escapement's fast overlap within ${worst.toFixed(4)} mm of landing H's penetration over 24 states`);
}

// ── ESCAPEMENT ──────────────────────────────────────────────────────────────
const esc = X.escSpec(lib), model = X.escapementModel(lib, esc);
{
  const sol = X.solveEscapement(lib);
  const b = sol.best;
  console.log(`\nESCAPEMENT: ${sol.tried.length} lattice geometries surveyed (8T and 16T wheels, every anchor axle, pallet radius and wheel height whose engagement is under 1.4 mm), each at 15 settings`);
  for (const t of sol.tried) console.log(`  ${t.teeth}T, anchor ${t.drop ?? 'on the crossbar'} (vA ${t.vA}), pallets ±${t.s}, wheel at ${t.vW} mm, engagement ${t.e.toFixed(2)} mm: ${t.escapes ? `${t.escapes} setting(s) escape` : 'never escapes'}`);
  if (!b) fail('no geometry escapes');
  else for (const k of ['teeth', 'drop', 'vA', 's', 'vW', 'palletArm', 'wheelPart']) if (b[k] !== S[k]) fail(`the survey answers ${k} ${b[k]}, TECHNIC_ESCAPEMENT declares ${S[k]}`);
  if (sol.found.some((f) => f.teeth === 16)) fail('a 16T geometry escapes: the measured choice of the 8T is not the survey\'s');
  if (S.teeth !== TECHNIC_ESCAPE_TEETH) fail(`the escape wheel has ${S.teeth} teeth, layout.js' TECHNIC_ESCAPE_TEETH ${TECHNIC_ESCAPE_TEETH}`);
  const ref = X.refineSetting(lib, b ?? { ...S, settings: [{ pd: S.phaseDeg }] });
  if (!near(ref.mid, S.phaseDeg, 1e-9)) fail(`the setting's run is ${ref.lo}°–${ref.hi}°, its middle ${ref.mid}°, TECHNIC_ESCAPEMENT declares ${S.phaseDeg}°`);
  control('a declared setting outside the run (3° past its end) does not escape at the posed swing', !X.traceCycle(X.escapementModel(lib, { ...esc, phase: (ref.hi + 3) * Math.PI / 180 }), X.ESC_SWING_DEG).ok);
  console.log(`  answer: the ${b?.teeth}T, the anchor axle 8 mm under the crossbar on a ${b?.drop}, pallets ±${b?.s} mm on ${b?.palletArm}s, the wheel ${b?.vW} mm under the knife; its setting escapes over ${ref.lo}°–${ref.hi}° (0.5° steps), the middle ${ref.mid}° — a builder may miss it by ${((ref.hi - ref.lo) / 2).toFixed(2)}°`);
  const win = X.swingWindow(model, { lo: 0.2, hi: 8, stepDeg: 0.2, n: 120 });
  console.log(`  the continuous trace escapes from a ${win.min}° swing to the ${win.max}° tried (${win.count} amplitudes, ${win.contiguous ? 'contiguous' : 'NOT contiguous'}); the posed swing is ±${X.ESC_SWING_DEG}°`);
  if (!(win.min !== null && X.ESC_SWING_DEG >= win.min && X.ESC_SWING_DEG <= win.max && win.contiguous)) fail('the posed swing is outside the window the trace escapes in');
  control('a 16T on the declared anchor and setting does not escape', !X.traceCycle(X.escapementModel(lib, { ...esc, teeth: 16, wheelPart: '4019' }), X.ESC_SWING_DEG).ok);
  // the − pallet cut at the + pallet's angle (not mirrored)
  const unm = X.escapementModel(lib, { ...esc, tau: (Math.PI - 2 * esc.phase) / 2 });
  control('the − pallet NOT mirrored (cut at the + pallet\'s angle) does not escape', !X.traceCycle(unm, X.ESC_SWING_DEG).ok);
}

// ── BEAT ────────────────────────────────────────────────────────────────────
let bm;
{
  bm = X.beatMeasures(model, X.ESC_SWING_DEG);
  if (!bm.ok) fail(`the posed swing does not escape: ${bm.why}`);
  else {
    if (!near(bm.advance, 1, 1e-3)) fail(`a period advances the wheel ${bm.advance} teeth`);
    console.log(`\nBEAT at ±${X.ESC_SWING_DEG}°: a period advances the wheel ${bm.advance.toFixed(5)} teeth (two beats: ${bm.beats.map((b) => b.advance.toFixed(3)).join(' + ')})`);
    for (const b of bm.beats) {
      if (!b.drops.length) fail(`a beat (${b.dir > 0 ? 'out' : 'back'}) has no drop`);
      console.log(`  beat ${b.dir > 0 ? '−A → +A' : '+A → −A'}: drops ${b.drops.map((d) => deg(d).toFixed(2) + '°').join(', ')} (${b.dropMM.map((d) => d.toFixed(2)).join(', ')} mm at the tip), recoil ${deg(b.recoil).toFixed(2)}°, impulse ${deg(b.impulse).toFixed(2)}°, catches ${b.catches.map((c) => `${c.lockMM.toFixed(3)} mm inside the tip circle`).join(', ')}`);
    }
    const drops = bm.beats.flatMap((b) => b.dropMM);
    console.log(`  the drops ${Math.min(...drops).toFixed(2)}–${Math.max(...drops).toFixed(2)} mm and the shallowest lock ${bm.lockMM.toFixed(3)} mm (the deepest a pallet goes ${bm.deepestMM.toFixed(3)} mm), against F2's ${X.F2_PLAY_MM} mm play (POSED, the note's figure): the lock ${(bm.lockMM - X.F2_PLAY_MM).toFixed(3)} mm over it`);
    if (!(bm.lockMM > X.F2_PLAY_MM)) fail(`the shallowest lock (${bm.lockMM.toFixed(3)} mm) is inside the bearings' play`);
    if (!(Math.min(...drops) > X.F2_PLAY_MM)) fail('a drop is inside the bearings\' play');
    // recoil sense: after each catch, while the anchor swings on away from the
    // centre, the wheel goes BACK against its drive; on the return, forward
    const senseOf = (steps) => {
      let outward = 0, ret = 0;
      for (const s of steps) {
        if (s.kind === 'drop') continue;
        const away = Math.sign(s.alpha) === s.dir;                       // |α| growing
        if (away) outward += s.dth; else ret += s.dth;
      }
      return { outward, ret };
    };
    const after = (tr) => tr.steps.filter((s, i) => tr.steps.slice(0, i).some((q) => q.kind === 'drop' && q.dir === s.dir));
    const sg = senseOf(after(bm.trace));
    console.log(`  recoil sense: after a catch the wheel turns ${deg(sg.outward).toFixed(2)}° while the balance swings on (against the drive) and ${deg(sg.ret).toFixed(2)}° on the return (with it)`);
    if (!(sg.outward < 0 && sg.ret > 0)) fail('the recoil runs the wrong way');
    const rev = senseOf(after({ steps: bm.trace.steps.map((s) => ({ ...s, dth: -s.dth })) }));
    control('the recoil read with the drive reversed runs the wrong way', !(rev.outward < 0 && rev.ret > 0));
  }
}

// ── RATE ────────────────────────────────────────────────────────────────────
{
  const row = TECHNIC_FORK.rows.find((r) => r.key === 'fourth→escape'), target = technicForkTargets()['fourth→escape'];
  const prod = (ch) => ch.reduce((acc, [a, c]) => ratMul(acc, ratQ(a, c)), ratQ(1));
  const vphOf = (ratio, n) => ratMul(ratio, ratQ(120 * n));
  console.log('\nRATE (RATE_TABLE\'s law, forked to LEGO: vph = 120 · escape teeth · fourth→escape):');
  for (const [gen, ch] of Object.entries(row.chains)) {
    const v = vphOf(prod(ch), S.teeth);
    console.log(`  ${gen}: ${ch.map(([a, c]) => `${a}:${c}`).join(' × ')} = ${ratStr(prod(ch))}; × ${S.teeth} × 120 = ${ratStr(v)} vph`);
    if (!ratEq(v, ratQ(TECHNIC_VPH))) fail(`${gen}: the row lands ${ratStr(v)} vph, not ${TECHNIC_VPH}`);
    const sol = solveRatio(target, CATALOGUES[gen]);
    if (!sol || JSON.stringify(sol.chain.map((p) => [p.a.teeth, p.b.teeth])) !== JSON.stringify(ch)) fail(`${gen}: solveRatio answers ${sol ? sol.chain.map((p) => `${p.a.teeth}:${p.b.teeth}`).join(' × ') : 'nothing'}, the row declares ${ch.map(([a, c]) => `${a}:${c}`).join(' × ')}`);
  }
  const cat = CATALOGUES.technic_classic, find = (t) => cat.counts.find((c) => c.teeth === t);
  for (const ch of [[[40, 8], [12, 8]], [[24, 8], [20, 8]]]) {
    const refused = ch.filter(([a, b]) => !catalogueMesh(find(a), find(b), cat)).map(([a, b]) => `${a}:${b} at ${(a + b) / 2} mm`);
    console.log(`  the note's ${ch.map(([a, b]) => `(${a}:${b})`).join('')}: ${ratStr(prod(ch))}, but ${refused.join(', ')} ${refused.length ? 'is off the 4 mm lattice' : 'is admissible'}`);
    if (!ratEq(prod(ch), target) || !refused.length) fail('the note\'s chains read otherwise');
  }
  control('a fourth→escape chain one tooth off (24:8)(40:17) misses the beat', !ratEq(vphOf(prod([[24, 8], [40, 17]]), S.teeth), ratQ(TECHNIC_VPH)));
  if (!near(X.BEAT_PERIOD_S, 2 * 3600 / TECHNIC_VPH, 1e-12)) fail('the beat period is not 2·3600/vph');
  console.log(`  the period the balance must keep: 2 · 3600 / ${TECHNIC_VPH} = ${X.BEAT_PERIOD_S} s; one escape tooth a period is ${60 / (X.BEAT_PERIOD_S * S.teeth)} turns a minute, the fourth's ${ratStr(target)} × 1`);
}

// ── BALANCE ─────────────────────────────────────────────────────────────────
let mo;
{
  const sb = X.solveBalance(lib);
  const b = sb.best, same = (p, q) => JSON.stringify([...p]) === JSON.stringify([...q]);
  console.log(`\nBALANCE: ${sb.rows.length} framed arrangements, ${sb.inBand} inside ${X.RATE_BAND * 100}% of ${X.BEAT_PERIOD_S} s`);
  for (const r of sb.rows.slice(0, 4)) console.log(`  ${r.massArm} arms, ${r.masses.join('+') || 'no gears'} a side; bob ${r.bob.join('+') || 'none'} on ${r.bobArm}: T ${r.T.toFixed(4)} s (${(r.err * 100).toFixed(2)}%), d ${r.d.toFixed(2)} mm`);
  if (!(b.massArm === BAL.massArm && b.bobArm === BAL.bobArm && same(b.masses, BAL.masses) && same(b.bob, BAL.bob))) fail('solveBalance answers otherwise than TECHNIC_BALANCE');
  mo = X.balanceMoments(lib, body);
  const lhs = mo.T ** 2 * mo.V * X.G_MM_S2 * mo.d, rhs = 4 * Math.PI ** 2 * mo.I;
  console.log(`  declared: T ${mo.T.toFixed(6)} s, ${((mo.T / X.BEAT_PERIOD_S - 1) * 100).toFixed(3)}% (${((mo.T / X.BEAT_PERIOD_S - 1) * 86400).toFixed(0)} s/day untrimmed); d ${mo.d.toFixed(4)} mm below the knife, ${mo.offset.toExponential(2)} mm across; I/(V d) ${(mo.I / mo.V / mo.d).toFixed(2)} mm`);
  if (!(Math.abs(mo.T / X.BEAT_PERIOD_S - 1) <= X.RATE_BAND)) fail('the declared balance is outside the rate band');
  if (!(Math.abs(lhs / rhs - 1) < 1e-12)) fail(`T² m g d / 4π² I = ${lhs / rhs}`);
  if (!(mo.d > 0)) fail('the centre of mass is not below the knife: no restoring');
  console.log(`  T² · m g d / (4π² I) = 1 ${(lhs / rhs - 1).toExponential(1)}; a 0.1 mm error in d moves T by ${(50 * 0.1 / mo.d).toFixed(1)}% (−½ δd/d), which a LEGO knife's play reaches`);
  // the period against amplitude: the exact law against its series T₀(1 + A²/16 + 11A⁴/3072)
  for (const A of [1, 3, 8]) {
    const a = A * Math.PI / 180, ex = X.periodAt(mo.T, A), ser = mo.T * (1 + a * a / 16 + 11 * a ** 4 / 3072);
    if (!(Math.abs(ex / ser - 1) < 1e-8)) fail(`the period at ${A}° parts from its series by ${ex / ser - 1}`);
    console.log(`  at ±${A}°: T ${ex.toFixed(6)} s (+${((ex / mo.T - 1) * 1e6).toFixed(0)} ppm, ${((ex / mo.T - 1) * 86400).toFixed(1)} s/day)`);
  }
  const pom = X.balanceMoments(lib, body, { axleDensityRatio: X.ESC_DENSITY.axles / 1.05 });
  console.log(`  were the axles and pins POM (${X.ESC_DENSITY.axles} g/cm³) against ABS's 1.05: T ${pom.T.toFixed(5)} s (${((pom.T / mo.T - 1) * 100).toFixed(2)}%) — reported, not claimed`);
  // no restoring: the body lifted so its centre of mass is the knife
  const lifted = body.map((p) => ({ ...p, m: [p.m[0], p.m[1] - mo.d, ...p.m.slice(2)] }));
  control('the centre of mass lifted to the knife (d = 0) has no period', X.balanceMoments(lib, lifted).T === null || !Number.isFinite(X.balanceMoments(lib, lifted).T) || X.balanceMoments(lib, lifted).T > 100);
  // the trip torque: frictionless, at the posed density band
  const tr = X.tripTorque(model, mo), ratio = 7.5 * 60 * centreRatio();
  const tau = (rho) => tr.perMgd * mo.V * rho * 1e-6 * 9.80665 * mo.d;
  console.log(`  a hand on the train: the lock holds until ${tau(1.04).toFixed(4)}–${tau(1.06).toFixed(4)} N·mm at the escape arbor (the balance deflected ${deg(Math.abs(tr.alphaWorst)).toFixed(2)}°, the pallet lets go at ${deg(Math.abs(tr.released ?? NaN)).toFixed(2)}°), ${(tau(1.04) * ratio).toFixed(1)}–${(tau(1.06) * ratio).toFixed(1)} N·mm at the fusee's great wheel through ${ratio}:1 — the FRICTIONLESS bound; past it the escapement trips`);
  if (!(tr.released !== null && tr.perMgd > 0)) fail('a push on the wheel never releases the pallet (a jam), or never lifts the balance');
}

// ── BUILD ───────────────────────────────────────────────────────────────────
{
  const fr = frame;
  if (!fr.framed) fail(`not framed: ${fr.reason}`);
  for (const c of fr.columns) {
    for (let i = 1; i < c.boxes.length; i++) if (!near(c.boxes[i].z0, c.boxes[i - 1].z1, 1e-9)) fail(`a ${c.shaft} column is not contiguous`);
    if (c.boxes[0].z0 !== 0) fail('a column does not stand on the baseplate');
    if (c.shaft === 'escape' && !near(c.holeZ, fr.zE, 1e-9)) fail(`an arbor column's hole is at ${c.holeZ}, the arbor at ${fr.zE}`);
    if (c.shaft === 'knife' && !near(c.apex, fr.zK, 1e-9)) fail(`a knife's apex is at ${c.apex}, the pivot at ${fr.zK}`);
  }
  const knives = fr.columns.filter((c) => c.shaft === 'knife');
  for (const k of knives) if (!(fr.crossbar.y0 <= k.y - E.knifeHalfLength + 1e-9 && fr.crossbar.y1 >= k.y + E.knifeHalfLength - 1e-9)) fail(`the crossbar does not lie the length of the knife at y ${k.y}`);
  if (!near(fr.zE, fr.zK - S.vW, 1e-9)) fail('the arbor is not where the escapement stands it');
  // the pallets' pins in the pallet arms' round holes, every keyed part on its axle's line
  const b = X.escapementBuild(fr, lib), parts = b.shafts[0].parts;
  const holes = (part, m) => placements(lib, `${part}.dat`, /peghole|beamhol/).map((h) => [m[0] + m[3] * h.m[0] + m[4] * h.m[1] + m[5] * h.m[2], m[1] + m[6] * h.m[0] + m[7] * h.m[1] + m[8] * h.m[2]]);
  const roundHoles = parts.filter((p) => p.role === 'arm' && p.part === S.palletArm && Math.abs(p.m[1] - L(S.vA)) < 1e-6).flatMap((p) => holes(p.part, p.m));
  for (const pin of parts.filter((p) => p.role === 'pin')) if (!roundHoles.some((h) => Math.hypot(h[0] - pin.m[0], h[1] - pin.m[1]) < 1e-6)) fail(`a pallet pin at (${pin.m[0]}, ${pin.m[1]}) LDU is in no pallet arm's round hole`);
  const axles = parts.filter((p) => p.role === 'axle');
  const onAxle = (p) => axles.some((a) => Math.hypot(a.m[0] - p.m[0], a.m[1] - p.m[1]) < 1e-6 && Math.abs(p.m[2] - a.m[2]) <= L(Math.max(...Object.keys(AXLE_PARTS).map(Number)) * 4));
  for (const p of parts.filter((q) => q.role === 'mass' || q.role === 'pallet')) {
    const host = p.role === 'pallet' ? parts.filter((q) => q.role === 'pin') : axles;
    if (!host.some((a) => Math.hypot(a.m[0] - p.m[0], a.m[1] - p.m[1]) < 1e-6)) fail(`a ${p.role} ${p.part} is on no axle's line`);
  }
  void onAxle;
  const sl = fr.slabs, ov = (a, c) => Math.min(a.y1, c.y1) - Math.max(a.y0, c.y0);
  if (!(ov(sl.wheel, sl.W) > 2 * E.gearHalf - 1)) fail('the escape wheel is not in the pallets\' slab');
  if (fr.anchorAxle.y1 > sl.wheel.y0 - 1e-9 || fr.escAxle.y0 < sl.P2.y1 + X.AX_CLEAR - 1e-9) fail('the anchor axle reaches the wheel\'s slab, or the arbor the anchor\'s');
  // in-plane clearances between the bodies and the frame
  const tip = (p) => GEAR_TIP_MM[p], mc = X.ARM_PARTS[BAL.massArm].reach;
  const cl = [
    ['the wheel under the crossbar (its arm on the apex, v = 0)', S.vW - tip(S.wheelPart)],
    ['a mass gear past the stacks', mc - Math.max(...BAL.masses.map(tip)) - D.stud],
    ['the bob over the baseplate studs at the swing\'s end', fr.zK - (-E.axleReach + X.ARM_PARTS[BAL.bobArm].reach + Math.max(...BAL.bob.map(tip))) - D.studH],
  ];
  for (const [k, v] of cl) if (!(v >= X.AX_CLEAR - 1e-9)) fail(`${k}: ${v.toFixed(3)} mm, under the one-LDU clearance`);
  const ldr = toLdr(b), n = ldr.split('\n').filter((l) => l.startsWith('1 ')).length, want = b.statics.length + b.shafts.reduce((s, sh) => s + sh.parts.length, 0);
  if (n !== want) fail(`the .ldr carries ${n} parts, the build ${want}`);
  // §305 (TODO 264): THE CROSSBAR THROUGH NO GEAR. Every gear the balance carries in a slab the crossbar spans
  // stands its own tip plus the axle's reach off the crossbar's axis (landing J's 40T bob, 16 mm under it with a
  // 20.94 mm tip, stood in the span and the crossbar ran through its web, 4.31 LDU deep)
  const crossbarErrs = (f) => X.framedBalance(f, lib).filter((p) => p.role === 'mass').flatMap((p) => {
    const ra = X.ESC_DIM_MM.axleReach, w0 = p.m[2] - X.ESC_DIM_MM.gearHalf, w1 = p.m[2] + X.ESC_DIM_MM.gearHalf;
    if (Math.min(w1, f.crossbar.y1) - Math.max(w0, f.crossbar.y0) <= 1e-9) return [];
    const d = Math.hypot(p.m[0], p.m[1] + ra), need = GEAR_TIP_MM[p.part] + ra;
    return d >= need - 1e-9 ? [] : [`a ${p.part} ${d.toFixed(2)} mm off the crossbar's axis, inside its span; it needs ${need.toFixed(2)}`];
  });
  for (const e of crossbarErrs(fr)) fail(`the crossbar runs through a gear: ${e}`);
  console.log(`  the crossbar spans y ${fr.crossbar.y0}…${fr.crossbar.y1}; the bob's gears hang in front of it (y ${fr.slabs.G.y0}…${fr.slabs.G.y1}), clear of it`);
  control('landing J\'s bob gears back inside the crossbar\'s span are found in it', crossbarErrs({ ...fr, crossbar: { ...fr.crossbar, y0: fr.slabs.G.y0 - 1 } }).length > 0);
  console.log(`\nBUILD: knives at y ${knives.map((k) => k.y).join(' and ')} (apex ${fr.zK} mm), the crossbar a ${fr.crossbar.lenStuds}L across both; the arbor at ${fr.zE} mm on jumper columns at y ${fr.columns.filter((c) => c.shaft === 'escape').map((c) => c.y).join(', ')}; ${cl.map(([k, v]) => `${k} ${v.toFixed(2)} mm`).join('; ')}; ${n} parts in the .ldr, base ${fr.base.studsX}×${fr.base.studsY} studs`);
}

// ── CONTROLS ────────────────────────────────────────────────────────────────
console.log('\ncontrols:');
for (const [name, caught] of ctl) { console.log(`  ${caught ? 'caught ' : 'MISSED '} ${name}`); if (!caught) fails++; }
console.log(fails ? `\n${fails} FAILED` : `\nthe anchor escapes one tooth a period on the 8T at ±${X.ESC_SWING_DEG}°, its lock ${bm.lockMM.toFixed(3)} mm against ${X.F2_PLAY_MM} mm of play; the balance's period ${mo.T.toFixed(4)} s against ${X.BEAT_PERIOD_S} s — controls ${ctl.length}/${ctl.length}`);
process.exit(fails ? 1 : 0);
