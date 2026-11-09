// Does the escape wheel's club tooth survive the escapement's own load at its tip? It is the second reader of EQUALISATION.going.energy.escapeTooth (TODO 296): it measures the club's wedge off the CUT MESH's own triangle normals where the record measures it off the authored outline, re-solves the escapement and recomputes every contact arm, re-prices the tip's Hertz contact and its arc-root bending from layout.js's bands, and asserts the record row for row. Five CONTROLS, each a sabotage the price must refuse: the wedge read as the flanks' SUM (the trap that reads every section 4.6x too fat), the unlock priced forward instead of as recoil, a tip a hundred times sharper, an arm taken square to the face instead of along it, and the escape torque doubled. It also REPORTS the one load this landing does not price — the drop's impact — so the record's own statement about it has a source. ACCEPTANCE: exits non-zero when the record and this computation disagree, or when a control fails to fire.
//
// Why it exists. The owner reported the teeth "look a little thin at the ends"
// by eye and they are: the club is a 10.83 degree wedge whose last 0.038 mm is
// 0.010 mm wide, thinner in the sheet than PIVOT_MIN_U. Four instruments passed
// it for four different reasons (TODO 296 lists them) and none was a strength
// claim: §50's floor reads a geometry-LOCAL bounding box, whose smallest side
// for this extrude is the 0.8 u depth, so the in-plane taper is invisible to it.
//
// The trap it was written around. BOTH flanks that meet at the tip -- the
// impulse face running back to the club heel and the undercut's locking face
// raked TOOTH_RAKE_DEG behind the tip -- lie on the SAME side of the tip's
// radius, so the club's width is their DIFFERENCE. A gear tooth's flanks
// straddle its radius, so the reflex is to add them, and adding them here reads
// the wedge as 58.83 degrees instead of 10.83 and every section 4.57x too fat
// (the first draft of this measurement did exactly that). Control C1 is that
// mistake, kept.
//
// What it does NOT price, and says so in its own report: the DROP's impact. At
// the landing the wheel and the reflected train arrive with kinetic energy some
// seven orders of magnitude over the elastic energy this contact stores at the
// working load, and that -- not the quasi-static lock -- is the load a thin tip
// really fears. Its path runs through the stone into the fork and out at the
// banking pin, none of which is modelled, so the number here is an ENERGY
// bound and a ratio, never a stress.
//
// Run from the repository root:
//   node --import ./tools/native/loader.mjs tools/probe-296-escape-tooth.mjs [--json FILE]
import { writeFileSync } from 'node:fs';
import { bootNative } from './native/host.mjs';
import * as L from '../src/layout.js';
import * as E from '../src/escapement.js';

const f = (x, d = 4) => Number(x).toFixed(d);
const g3 = (x) => Number(x).toExponential(3);
const argJson = (() => { const i = process.argv.indexOf('--json'); return i > 0 ? process.argv[i + 1] : null; })();
const fails = [];
const ok = (cond, what, detail) => { if (!cond) fails.push({ what, detail }); return !!cond; };
const rel = (a, b) => (Math.abs(a - b) / Math.max(1e-300, Math.abs(a), Math.abs(b)));
const near = (a, b, tol, what) => ok(rel(a, b) <= tol, what, { a, b, rel: rel(a, b), tol });

const U = L.UNIT_MM / 1000;              // m per movement unit
const DEG = Math.PI / 180;

// ---------------------------------------------------------------------------
console.log('TODO 296 — the club tooth\'s tip, priced a second way\n');
const boot = await bootNative({ query: '' });
const C = boot.clock;
const en = C.equalisation.going.energy;
const et = en.escapeTooth;
ok(boot.warns.length === 0, 'boot is not silent', boot.warns);
if (!et) { console.error('FAIL going.energy.escapeTooth is missing — TODO 296 regressed'); process.exit(1); }

// ---------------------------------------------------------------------------
// 1. THE WEDGE, off the CUT MESH's triangle normals.
//
// The record reads the two flanks from the AUTHORED outline's vertices. This
// reads them from the metal's own side-wall FACES: the triangles that touch the
// tip vertex and stand square to the wheel's plane are the two flanks, and the
// angle between their in-plane normals is the wedge's supplement. Vertices and
// face normals are different measurements of the same cut, and TODO 131's claim
// (bevelOffset = -bevel ends the chamfer ON the outline, so the body band IS
// the authored polygon) is exactly what makes them have to agree.
// ---------------------------------------------------------------------------
const wheel = (() => {
  let found = null;
  C.scene.traverse((o) => { if (o.userData?.profile && Math.abs((o.userData.r ?? 0) - et.geom.radius_u) < 1e-9) found = o; });
  return found;
})();
ok(!!wheel, 'the escape wheel is not in the scene at the record\'s radius', et.geom.radius_u);
const toothMesh = wheel.children.find((m) => m.isMesh && m.geometry.type === 'ExtrudeGeometry');
const meshWedge = (() => {
  const geo = toothMesh.geometry, pos = geo.attributes.position, idx = geo.index;
  const R = et.geom.radius_u, band = et.geom.band.thickness_u / 2 + 1e-5;
  const vx = (i) => [pos.getX(i), pos.getY(i), pos.getZ(i)];
  // the tip vertex: greatest radius in the body band, folded to one tooth
  let tip = null, tr = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const p = vx(i);
    if (Math.abs(p[2]) > band) continue;
    const r = Math.hypot(p[0], p[1]);
    if (r > tr) { tr = r; tip = p; }
  }
  const n = idx ? idx.count : pos.count;
  const planes = [];
  for (let i = 0; i < n; i += 3) {
    const a = vx(idx ? idx.getX(i) : i), b = vx(idx ? idx.getX(i + 1) : i + 1), c = vx(idx ? idx.getX(i + 2) : i + 2);
    const touches = [a, b, c].some((p) => Math.hypot(p[0] - tip[0], p[1] - tip[1], p[2] - tip[2]) < 1e-6);
    if (!touches) continue;
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const nr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const ln = Math.hypot(...nr);
    if (!(ln > 1e-12)) continue;                       // a degenerate triangle is not a face
    const u = nr.map((q) => q / ln);
    if (Math.abs(u[2]) > 1e-3) continue;               // a cap or a chamfer, not a side wall
    planes.push([u[0], u[1]]);
  }
  // cluster the in-plane normals: two flanks, so two directions
  const cl = [];
  for (const p of planes) {
    const hit = cl.find((q) => Math.abs(q.n[0] * p[0] + q.n[1] * p[1]) > Math.cos(1e-3));
    if (hit) hit.k++; else cl.push({ n: p, k: 1 });
  }
  cl.sort((a, b) => b.k - a.k);
  const two = cl.slice(0, 2);
  // the flank DIRECTIONS are square to those normals; the wedge is the angle
  // between them, taken as the acute one (a wedge, not its reflex)
  const dirOf = (q) => [-q.n[1], q.n[0]];
  const d0 = dirOf(two[0]), d1 = dirOf(two[1]);
  const cosd = Math.abs(d0[0] * d1[0] + d0[1] * d1[1]);
  return { tip, tipR: tr, clusters: cl.length, kept: two.map((q) => q.k),
    wedgeDeg: Math.acos(Math.min(1, cosd)) / DEG };
})();
console.log('1. THE WEDGE, off the cut mesh\'s own side-wall normals');
console.log(`   tip at r ${f(meshWedge.tipR, 6)} (record ${f(et.geom.radius_u, 6)}), ${meshWedge.clusters} in-plane normal cluster(s), kept ${meshWedge.kept.join(' + ')} triangles`);
console.log(`   wedge ${f(meshWedge.wedgeDeg, 4)}° from the FACES, ${f(et.geom.wedge.fullDeg, 4)}° from the outline`);
near(meshWedge.tipR, et.geom.radius_u, 1e-6, 'the mesh\'s tip radius is not the record\'s');
near(meshWedge.wedgeDeg, et.geom.wedge.fullDeg, 1e-6, 'the wedge off the cut faces is not the wedge off the authored outline');
ok(meshWedge.clusters === 2, 'the tip is not two flanks', meshWedge);
ok(et.geom.wedge.sameSide, 'the record does not record the flanks on one side of the radius', et.geom.wedge);
near(Math.abs(et.geom.wedge.lockFlankDeg), E.TOOTH_RAKE_DEG, 1e-9, 'the locking flank is not at escapement.js\'s declared rake');

// ---------------------------------------------------------------------------
// 2. THE ARMS, from an independent solve of the escapement.
// ---------------------------------------------------------------------------
const span = 2 * et.geom.radius_u * Math.sin(E.EMBRACE_DEG * DEG);
const ES = E.leverEscapement({ span, beatRad: L.BEAT_DEG * DEG, bank0Rad: C.pinNotch.bank0, sense: L.MOVEMENT_SENSE });
ok(ES.warns.length === 0, 're-solving the escapement warns', ES.warns);
near(ES.R, et.geom.radius_u, 1e-9, 'the re-solved escapement is on a different wheel');
const rot2 = (p, a) => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)];
// `square` is control C4: the arm taken against the FACE instead of the normal.
const armAt = (st, phi, face, square = false) => {
  const A = rot2(st.K, phi);
  const raw = face === 'lock' ? st.tau : [st.E[0] - st.K[0], st.E[1] - st.K[1]];
  const v = rot2(raw, phi), vl = Math.hypot(v[0], v[1]);
  const u = square ? [-v[1] / vl, v[0] / vl] : [v[0] / vl, v[1] / vl];
  const q = face === 'lock' ? ES.deltaOnLockFace(st.sigma, phi) : ES.deltaOnImpulseFace(st.sigma, phi);
  if (!Number.isFinite(q.t)) return { wheel: NaN, fork: NaN, delta: NaN };
  // the lock face's direction is a unit vector, so its t IS a length; the
  // impulse face's is the chord K->E, so its t is a fraction of it
  const dd = face === 'lock' ? q.t : q.t * vl;
  const P = [A[0] + (v[0] / vl) * dd, A[1] + (v[1] / vl) * dd];
  return { wheel: Math.abs((P[0] - ES.W0[0]) * u[0] + (P[1] - ES.W0[1]) * u[1]),
           fork: Math.abs(P[0] * u[0] + P[1] * u[1]), delta: q.delta, P };
};
const minOver = (st, face, x0, x1, square = false) => {
  let m = Infinity, atX = x0, fk = NaN;
  for (let i = 0; i <= 64; i++) {
    const x = x0 + (x1 - x0) * (i / 64), a = armAt(st, st.sigma * x, face, square);
    if (Number.isFinite(a.wheel) && a.wheel < m) { m = a.wheel; atX = x; fk = a.fork; }
  }
  return { arm_u: m, armFork_u: fk, atForkDeg: atX / DEG };
};
const mineRuns = [];
for (const st of ES.stones) {
  mineRuns.push({ stone: st.sigma, run: 'locked at the banking', flow: 'forward', ...minOver(st, 'lock', ES.bank, ES.bank) });
  mineRuns.push({ stone: st.sigma, run: 'the unlock, down the locking face', flow: 'recoil', ...minOver(st, 'lock', ES.bank, ES.unlock) });
  mineRuns.push({ stone: st.sigma, run: 'the impulse, along the stone\'s impulse face', flow: 'forward', ...minOver(st, 'impulse', ES.unlock, st.xE) });
}
console.log('\n2. THE CONTACT ARMS, re-solved');
for (const q of mineRuns) {
  const r = et.geom.runs.find((x) => x.stone === q.stone && x.run === q.run);
  ok(!!r, 'the record has no run for', q);
  if (r) {
    near(q.arm_u, r.arm_u, 1e-9, `arm disagrees on ${q.run} (stone ${q.stone})`);
    console.log(`   stone ${q.stone >= 0 ? '+' : '-'} ${q.run.padEnd(44)} arm ${f(q.arm_u, 5)} u  (record ${f(r.arm_u, 5)})`);
  }
}
// virtual work, this probe's own reading of it
const vw = (() => {
  let worst = 0, at = null;
  for (const st of ES.stones)
    for (const [face, x0, x1] of [['lock', ES.bank, ES.unlock], ['impulse', ES.unlock, st.xE]])
      for (const fr of [0.2, 0.4, 0.6, 0.8]) {
        const phi = st.sigma * (x0 + (x1 - x0) * fr), h = 1e-6, a = armAt(st, phi, face);
        const gg = Math.abs((armAt(st, phi + h, face).delta - armAt(st, phi - h, face).delta) / (2 * h));
        const r = Math.abs(a.fork / a.wheel - gg) / gg;
        if (r > worst) { worst = r; at = { face, stone: st.sigma, fr, ratio: a.fork / a.wheel, gearing: gg }; }
      }
  return { rel: worst, at };
})();
console.log(`   virtual work  arm_fork/arm_wheel = dδ/dφ to ${g3(vw.rel)} (record ${g3(et.geom.virtualWork.rel)})`);
ok(vw.rel < 1e-5, 'the re-solved arms fail virtual work', vw);

// ---------------------------------------------------------------------------
// 3. THE PRICE, recomputed from layout.js's bands.
// ---------------------------------------------------------------------------
const tM = et.line_u * U;
const Estar = 1 / ((1 - L.STEEL_NU ** 2) / L.STEEL_E_PA + (1 - L.STOCK.corundum.nu ** 2) / L.STOCK.corundum.E);
const allow = L.LINE_CONTACT_FIRST_YIELD_P0_PER_Y * L.ESCAPE_STEEL_SIGMA_Y_PA;
const halfV = et.geom.wedge.halfRad;
const priceAt = (F, rho, a = halfV) => {
  const secW = 2 * rho * Math.cos(a), secArm = rho * (1 - Math.sin(a));
  const p0 = Math.sqrt((F / tM) * Estar / (Math.PI * rho));
  const sigma = 6 * F * secArm / (tM * secW * secW) + F / (tM * secW);
  const rhoH = (F / tM) * Estar / (Math.PI * allow * allow);
  const kB = (6 * (1 - Math.sin(a)) / (4 * Math.cos(a) ** 2) + 1 / (2 * Math.cos(a))) / tM;
  const rhoB = kB * F / L.ESCAPE_STEEL_SIGMA_Y_PA;
  return { p0, sigma, p0Margin: allow / p0, sigmaMargin: L.ESCAPE_STEEL_SIGMA_Y_PA / sigma,
    rhoH, rhoB, rhoMin: Math.max(rhoH, rhoB), binds: rhoH >= rhoB ? 'hertz' : 'beam' };
};
const etaOf = (cname) => en.corners[cname].stages.filter((s) => s.name !== 'lever escapement').reduce((p, s) => p * s.eta, 1);
near(Estar, et.Estar_Pa, 1e-12, 'the contact modulus disagrees');
near(allow, et.p0Allow_Pa, 1e-12, 'the allowable contact pressure disagrees');
ok(et.rho_m === L.ESCAPE_TIP_R_BAND.sharp_m, 'the record is not priced at the finish band\'s SHARP end', { record: et.rho_m, band: L.ESCAPE_TIP_R_BAND });

console.log('\n3. THE PRICE, recomputed  (tip ρ ' + f(L.ESCAPE_TIP_R_M * 1e6, 3) + ' µm, line ' + f(tM * 1e3, 4) + ' mm, E* ' + f(Estar / 1e9, 1) + ' GPa, allow ' + f(allow / 1e9, 3) + ' GPa)');
const mine = [];
for (const cname of L.FRICTION_CORNERS) {
  const eta = etaOf(cname);
  for (const run of mineRuns) {
    const tq = run.flow === 'recoil' ? en.escapeTorque_Nm / eta : en.escapeTorque_Nm * eta;
    const F = tq / (run.arm_u * U);
    const q = priceAt(F, L.ESCAPE_TIP_R_M);
    mine.push({ corner: cname, stone: run.stone, run: run.run, flow: run.flow, etaPath: eta, load_N: F, ...q });
    const r = et.rows.find((x) => x.corner === cname && x.stone === run.stone && x.run === run.run);
    if (!ok(!!r, 'the record has no row for', { cname, run })) continue;
    near(r.etaPath, eta, 1e-12, `η disagrees at the ${cname} corner`);
    near(r.load_N, F, 1e-12, `load disagrees on ${run.run} at ${cname}`);
    near(r.p0_Pa, q.p0, 1e-12, `Hertz p0 disagrees on ${run.run} at ${cname}`);
    near(r.sigma_Pa, q.sigma, 1e-12, `tip bending disagrees on ${run.run} at ${cname}`);
    near(r.rhoMin_m, q.rhoMin, 1e-12, `ρ_min disagrees on ${run.run} at ${cname}`);
    ok(r.binds === q.binds, `the binding criterion disagrees on ${run.run} at ${cname}`, { record: r.binds, mine: q.binds });
  }
}
const worst = mine.reduce((a, b) => (Math.min(b.p0Margin, b.sigmaMargin) < Math.min(a.p0Margin, a.sigmaMargin) ? b : a));
for (const q of mine.filter((x) => x.stone === worst.stone))
  console.log(`   ${q.corner.padEnd(11)} ${q.flow.padEnd(8)} F ${f(q.load_N * 1e6, 2).padStart(7)} µN   p0 ${f(q.p0 / 1e9, 4)} GPa ×${f(q.p0Margin, 2).padStart(6)}   σ ${f(q.sigma / 1e6, 2).padStart(6)} MPa ×${f(q.sigmaMargin, 1).padStart(6)}   ρ_min ${f(q.rhoMin * 1e9, 3)} nm ${q.binds}`);
console.log(`   WORST  ${worst.corner} / ${worst.run}: ×${f(Math.min(worst.p0Margin, worst.sigmaMargin), 3)} on ${worst.binds}, ρ_min ${f(worst.rhoMin * 1e9, 3)} nm against the band's sharp ${f(L.ESCAPE_TIP_R_M * 1e9, 0)} nm`);
ok(worst.p0Margin >= 1 && worst.sigmaMargin >= 1, 'the club tooth does not carry its load at the band\'s sharp end', worst);
ok(et.worst.corner === worst.corner && et.worst.run === worst.run, 'the record names a different worst row', { record: et.worst, mine: { corner: worst.corner, run: worst.run } });

// ---------------------------------------------------------------------------
// 4. THE CONTROLS. Each must move the answer; a price nothing moves measures
//    nothing.
// ---------------------------------------------------------------------------
console.log('\n4. CONTROLS');
const Fw = worst.load_N;
// C1 — the wedge as the flanks' SUM (the trap), where it actually bites: the
// club's SECTIONS back along the wedge, which is the table TODO 296 quotes and
// the reading the first draft of this measurement got wrong. It does NOT bite
// at the tip, and that is worth saying: the arc's section is 2ρcosα and the
// Hertz pressure does not see α at all, so the strength verdict survives the
// error that wrecked the geometry. Both halves are asserted.
{
  const tL = Math.tan(Math.abs(et.geom.wedge.lockFlankDeg) * DEG), tI = Math.tan(Math.abs(et.geom.wedge.impulseFlankDeg) * DEG);
  const diff = Math.abs(tI - tL), sum = tI + tL;
  const sumHalf = (Math.abs(et.geom.wedge.lockFlankDeg) + Math.abs(et.geom.wedge.impulseFlankDeg)) * DEG / 2;
  const trap = priceAt(Fw, L.ESCAPE_TIP_R_M, sumHalf);
  console.log(`   C1 width per radial depth: ${f(diff, 5)} as the DIFFERENCE, ${f(sum, 5)} as the sum (×${f(sum / diff, 3)} fatter) — at 0.10 u back, ${f(diff * 0.1 * L.UNIT_MM * 1000, 1)} µm against ${f(sum * 0.1 * L.UNIT_MM * 1000, 1)} µm`);
  console.log(`      and at the TIP the error is nearly invisible: σ ×${f(trap.sigma / worst.sigma, 4)}, p0 ×${f(trap.p0 / worst.p0, 4)} — the arc's section is 2ρcosα, so the verdict survives it`);
  near(et.geom.wedge.widthPerDepth, diff, 1e-12, 'C1: the record\'s width-per-depth is not the flanks\' DIFFERENCE');
  ok(Math.abs(sum / et.geom.wedge.widthPerDepth - 1) > 0.01, 'C1 did not fire: the record\'s width-per-depth is indistinguishable from the sum reading', { record: et.geom.wedge.widthPerDepth, sum, diff });
  ok(sum / diff > 4, 'C1 did not fire: the sum and the difference are not materially different, so the trap costs nothing', { sum, diff });
  ok(Math.abs(trap.p0 / worst.p0 - 1) < 1e-12, 'C1: the Hertz pressure at the tip depends on the wedge angle, which it should not', { trap: trap.p0, worst: worst.p0 });
}
// C2 — the unlock priced FORWARD. The corner order inverts, which is the
// clause row 20 gates.
{
  const up = L.FRICTION_CORNERS.map((c) => en.escapeTorque_Nm / etaOf(c));
  const down = L.FRICTION_CORNERS.map((c) => en.escapeTorque_Nm * etaOf(c));
  const rising = up[0] <= up[1] && up[1] <= up[2], falling = down[0] >= down[1] && down[1] >= down[2];
  console.log(`   C2 recoil T/η rises favourable→adverse: ${rising}; forward T·η falls: ${falling}; recoil is ×${f(up[2] / down[2], 3)} the forward load at the adverse corner`);
  ok(rising && falling, 'C2 did not fire: the two flows are not oppositely ordered', { up, down });
  ok(up[2] / down[2] > 1.5, 'C2 did not fire: the recoil is not the heavier load', { up, down });
  const rec = et.rows.filter((r) => r.flow === 'recoil');
  ok(rec.length === 2 * 3, 'C2 did not fire: the record does not price the unlock as recoil', rec.length);
}
// C3 — a tip a hundred times sharper must go over.
{
  const sharp = priceAt(Fw, L.ESCAPE_TIP_R_M / 100);
  console.log(`   C3 tip ρ/100 (${f(L.ESCAPE_TIP_R_M * 1e6 / 100, 5)} µm): p0 ${f(sharp.p0 / 1e9, 3)} GPa ×${f(sharp.p0Margin, 3)}, σ ${f(sharp.sigma / 1e6, 0)} MPa ×${f(sharp.sigmaMargin, 2)}`);
  ok(sharp.p0Margin < 1, 'C3 did not fire: a hundredfold sharper tip still passes in contact, so the criterion is vacuous', sharp);
}
// C4 — the arm taken square to the face instead of along it.
{
  const st = ES.stones[0];
  const good = minOver(st, 'lock', ES.bank, ES.unlock).arm_u;
  const bad = minOver(st, 'lock', ES.bank, ES.unlock, true).arm_u;
  const phi = st.sigma * ES.bank, h = 1e-6;
  const a = armAt(st, phi, 'lock', true);
  const gg = Math.abs((armAt(st, phi + h, 'lock').delta - armAt(st, phi - h, 'lock').delta) / (2 * h));
  const badRel = Math.abs(a.fork / a.wheel - gg) / gg;
  console.log(`   C4 arm square to the face: ${f(bad, 5)} u not ${f(good, 5)} u, and virtual work reads ${g3(badRel)} against ${g3(vw.rel)}`);
  ok(rel(good, bad) > 0.1, 'C4 did not fire: the arm does not depend on which vector the normal is taken against', { good, bad });
  ok(badRel > 1e-5, 'C4 did not fire: virtual work accepts the wrong normal, so it is not a control', { badRel, good: vw.rel });
}
// C5 — twice the torque. Hertz goes as sqrt(F), so p0 must move by exactly
// sqrt(2) and rho_min by 2: a price that reads the load linearly, not a
// coincidence at one value.
{
  const twice = priceAt(2 * Fw, L.ESCAPE_TIP_R_M);
  console.log(`   C5 twice the load: p0 ×${f(twice.p0 / worst.p0, 9)} (need √2), ρ_min ×${f(twice.rhoMin / worst.rhoMin, 9)} (need 2), σ ×${f(twice.sigma / worst.sigma, 9)} (need 2)`);
  near(twice.p0 / worst.p0, Math.SQRT2, 1e-12, 'C5: p0 does not go as √F');
  near(twice.rhoMin / worst.rhoMin, 2, 1e-12, 'C5: ρ_min does not go as F');
  near(twice.sigma / worst.sigma, 2, 1e-12, 'C5: the tip\'s bending does not go as F');
}

// ---------------------------------------------------------------------------
// 5. REPORT — the load this landing does not price.
// ---------------------------------------------------------------------------
const impact = (() => {
  const cr = C.pinNotch.crossing;
  const Iw = cr.I_wheel;                                   // escape arbor + the train reflected
  const dropRad = E.DROP_DEG * DEG;
  // the wheel is free through the drop and the train drives it, so it gains at
  // least tau*theta_drop; an UPPER bound on what it can carry into the landing
  // is the whole beat's delivered energy, which the impulse mostly spends on
  // the balance. Both are quoted; neither is a stress.
  const gained = en.escapeTorque_Nm * dropRad;
  const ceiling = en.perBeat_J;
  // the elastic energy the tip's line contact stores at the working load:
  // a = sqrt(4 F' rho / (pi E*)), the approach of order a^2/rho, so U ~ F*delta/2
  const Fl = worst.load_N / tM, rho = L.ESCAPE_TIP_R_M;
  const aHalf = Math.sqrt(4 * Fl * rho / (Math.PI * Estar));
  const approach = aHalf * aHalf / rho;
  const stored = 0.5 * worst.load_N * approach;
  return { I_wheel: Iw, dropDeg: E.DROP_DEG, gained_J: gained, ceiling_J: ceiling,
    omegaFromGain: Math.sqrt(2 * gained / Iw), contactStored_J: stored,
    ratioGain: gained / stored, ratioCeiling: ceiling / stored };
})();
console.log('\n5. REPORT — the DROP\'s impact, which this landing does NOT price');
console.log(`   the reflected wheel carries I ${g3(impact.I_wheel)} kg·m²; free through the ${f(impact.dropDeg, 1)}° drop it gains ${g3(impact.gained_J)} J`);
console.log(`   (a beat delivers ${g3(impact.ceiling_J)} J in all, the ceiling), against ${g3(impact.contactStored_J)} J stored elastically in the tip at the working load`);
console.log(`   so the landing arrives with ${g3(impact.ratioGain)}× the contact's elastic energy — the load a thin tip really fears.`);
console.log('   Not priced here: its path runs through the stone into the fork and out at the banking pin, none of which is modelled. TODO 296 carries it.');

// ---------------------------------------------------------------------------
console.log('');
if (argJson) {
  writeFileSync(argJson, JSON.stringify({ meshWedge, mineRuns, vw, mine, worst, impact, fails }, null, 1));
  console.log(`wrote ${argJson}`);
}
if (fails.length) {
  console.error(`FAIL — ${fails.length} disagreement(s) between the record and this computation:`);
  for (const q of fails) console.error(' ', q.what, JSON.stringify(q.detail));
  process.exit(1);
}
console.log(`PASS — the record and this computation agree on ${et.rows.length} rows and ${et.geom.runs.length} contact arms; all five controls fired.`);
const margin = Math.min(worst.p0Margin, worst.sigmaMargin);
console.log(`       The club tooth carries the escapement at ×${f(margin, 2)} on the ${worst.binds} criterion; its tip needs ${f(worst.rhoMin * 1e9, 2)} nm of radius and the finish band's sharp end gives ${f(L.ESCAPE_TIP_R_M * 1e9, 0)}.`);
// Hertz binds and p0 ∵ √F, so the torque at which the tip first yields is the
// margin SQUARED — the headroom over the escapement's own load, in one number.
console.log(`       It first yields at ×${f(margin * margin, 1)} the escape torque. The owner's eye was right that the metal is thin; the LOAD is ${f(worst.load_N * 1e6, 0)} µN.`);
process.exit(0);
