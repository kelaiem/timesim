// Does the escape wheel's club tooth survive the escapement's own load at its tip? It is the second reader of EQUALISATION.going.energy.escapeTooth (TODO 296): it measures the club's wedge off the CUT MESH's own triangle normals where the record measures it off the authored outline, re-solves the escapement and recomputes every contact arm, re-prices the tip's Hertz contact and its arc-root bending from layout.js's bands, and asserts the record row for row. Since landing 2 it also recomputes the DROP's landing — the let-off kinematics at the peak swing, the drop's free run, the impact's effective mass and closing velocity, the series stack and the radius the tip runs in to before it shakes down. TEN CONTROLS, each a sabotage or a sensitivity the answer must survive: the wedge read as the flanks' SUM (the trap that reads every section 4.6x too fat), the unlock priced forward instead of as recoil, a tip a hundred times sharper, an arm taken square to the face instead of along it, the escape torque doubled, the contact's stiffness x10 and /10 (which must move the run-in by under a percent, since the compliance is the tooth's), one more series member as soft as the tooth (which must run it in LESS, proving the bound's direction), the design swing instead of the peak, the inversion's own p0 ~ rho^-1/2, and the drop's acceleration removed. ACCEPTANCE: exits non-zero when the record and this computation disagree, or when a control fails to fire.
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
// since TODO 299 landing 2 the radius is DERIVED (the impact's fixed point),
// so what is asserted here is that it lies inside what a polish can hold; that
// it IS the fixed point is section 5's, and the rows are priced at it below
ok(et.rho_m >= L.ESCAPE_TIP_R_BAND.sharp_m && et.rho_m <= L.ESCAPE_TIP_R_BAND.blunt_m,
  'the record is priced at a tip no polish can hold', { record: et.rho_m, band: L.ESCAPE_TIP_R_BAND });

console.log('\n3. THE PRICE, recomputed  (tip ρ ' + f(et.rho_m * 1e6, 4) + ' µm, line ' + f(tM * 1e3, 4) + ' mm, E* ' + f(Estar / 1e9, 1) + ' GPa, allow ' + f(allow / 1e9, 3) + ' GPa)');
const mine = [];
for (const cname of L.FRICTION_CORNERS) {
  const eta = etaOf(cname);
  for (const run of mineRuns) {
    const tq = run.flow === 'recoil' ? en.escapeTorque_Nm / eta : en.escapeTorque_Nm * eta;
    const F = tq / (run.arm_u * U);
    const q = priceAt(F, et.rho_m);
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
console.log(`   WORST  ${worst.corner} / ${worst.run}: ×${f(Math.min(worst.p0Margin, worst.sigmaMargin), 3)} on ${worst.binds}, ρ_min ${f(worst.rhoMin * 1e9, 3)} nm against the band's sharp ${f(et.rho_m * 1e9, 0)} nm`);
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
  const trap = priceAt(Fw, et.rho_m, sumHalf);
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
  const sharp = priceAt(Fw, et.rho_m / 100);
  console.log(`   C3 tip ρ/100 (${f(et.rho_m * 1e6 / 100, 5)} µm): p0 ${f(sharp.p0 / 1e9, 3)} GPa ×${f(sharp.p0Margin, 3)}, σ ${f(sharp.sigma / 1e6, 0)} MPa ×${f(sharp.sigmaMargin, 2)}`);
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
  const twice = priceAt(2 * Fw, et.rho_m);
  console.log(`   C5 twice the load: p0 ×${f(twice.p0 / worst.p0, 9)} (need √2), ρ_min ×${f(twice.rhoMin / worst.rhoMin, 9)} (need 2), σ ×${f(twice.sigma / worst.sigma, 9)} (need 2)`);
  near(twice.p0 / worst.p0, Math.SQRT2, 1e-12, 'C5: p0 does not go as √F');
  near(twice.rhoMin / worst.rhoMin, 2, 1e-12, 'C5: ρ_min does not go as F');
  near(twice.sigma / worst.sigma, 2, 1e-12, 'C5: the tip\'s bending does not go as F');
}

// ---------------------------------------------------------------------------
// 5. THE DROP'S LANDING (TODO 296 landing 2), recomputed, with the controls
//    that decide whether the answer means anything.
// ---------------------------------------------------------------------------
const lg = et.landing;
ok(!!lg, 'the record carries no landing block', null);
const mine5 = (() => {
  const cr = C.pinNotch.crossing, Iw = cr.I_wheel, If = cr.I_fork;
  const aW = et.geom.landing.arm_u * U, aF = et.geom.landing.armFork_u * U;
  // the let-off kinematics, from the model's own laws at the PEAK swing
  const Apk = L.AMPLITUDE_PEAK_DEG * DEG, wB = 2 * Math.PI * L.F_BALANCE, thL = C.pinNotch.liftHalf, hh = 1e-7;
  const thetaDot = Apk * wB * Math.cos(Math.asin(Math.min(1, thL / Apk)));
  const dPhi = Math.abs((C.pinNotch.lead(thL + hh) - C.pinNotch.lead(thL - hh)) / (2 * hh));
  const gear = Math.max(...ES.stones.map((st) => {
    const phiE = st.sigma * st.xE;
    return Math.abs((ES.deltaOnImpulseFace(st.sigma, phiE + hh).delta - ES.deltaOnImpulseFace(st.sigma, phiE - hh).delta) / (2 * hh));
  }));
  const omega0 = gear * dPhi * thetaDot;
  const omega = Math.sqrt(omega0 * omega0 + 2 * en.escapeTorque_Nm * ES.drop / Iw);
  const mStar = 1 / (aW * aW / Iw + aF * aF / If);
  const v0 = aW * omega, Eimp = 0.5 * mStar * v0 * v0;
  // the stack
  const sArc = (rr) => rr * Math.cos(halfV) ** 2 / Math.sin(halfV);
  const sRoot = Math.abs(et.geom.wedge.holdsTo_u) * U, kW = et.geom.wedge.widthPerDepth;
  const kTooth = (rr) => {
    const sa = sArc(rr), A0 = 12 / (L.STEEL_E_PA * tM * kW ** 3);
    return 1 / (A0 * (sa / sRoot - 1 + Math.log(sRoot / sa)));
  };
  const kHertz = (rr, F) => {
    const Fl = F / tM, ha = Math.sqrt(4 * Fl * rr / (Math.PI * Estar));
    return F / Math.max((2 * Fl / (Math.PI * Estar)) * (Math.log(4 * rr / ha) - 1), 1e-18);
  };
  // `extra` is one more series member (control C7) and `hMul` scales the
  // contact's own stiffness (control C6). Both are PARAMETERS, not patches: an
  // earlier draft reassigned the exported function while these closures read the
  // local const, and reported a 0.000% sensitivity that was its own no-op.
  const peak = (rr, E_ = Eimp, extra = Infinity, hMul = 1) => {
    let F = 1e-3;
    for (let i = 0; i < 200; i++) F = Math.sqrt(2 * E_ / (1 / kTooth(rr) + 1 / (hMul * kHertz(rr, F)) + 1 / extra));
    const kT = kTooth(rr), kH = hMul * kHertz(rr, F);
    return { F, kT, kH, kS: 1 / (1 / kT + 1 / kH + 1 / extra), p0: Math.sqrt((F / tM) * Estar / (Math.PI * rr)) };
  };
  const rhoFor = (p0a, E_ = Eimp, extra = Infinity, hMul = 1) => {
    let rr = 1e-7;   // an arbitrary start: C11 proves the fixed point has none of its own
    for (let i = 0; i < 300; i++) rr = Math.min(1e-3, Math.max(1e-10, rr * (peak(rr, E_, extra, hMul).p0 / p0a) ** 2));
    return rr;
  };
  const shake = L.LINE_CONTACT_SHAKEDOWN_P0_PER_Y * L.ESCAPE_STEEL_SIGMA_Y_PA;
  return { Iw, If, aW, aF, thetaDot, dPhi, gear, omega0, omega, mStar, v0, Eimp, shake,
    kTooth, kHertz, peak, rhoFor, sArc, sRoot, kW };
})();
console.log('\n5. THE DROP\'s LANDING, recomputed');
console.log(`   at the peak swing ${f(L.AMPLITUDE_PEAK_DEG, 0)}° the balance turns ${f(mine5.thetaDot, 2)} rad/s at the let-off, the fork ×${f(mine5.dPhi, 5)}, the impulse face ×${f(mine5.gear, 4)} → ω ${f(mine5.omega0, 2)} rad/s`);
console.log(`   free through the ${f(E.DROP_DEG, 1)}° drop on I ${g3(mine5.Iw)} kg·m² → ${f(mine5.omega, 2)} rad/s; closing ${f(mine5.v0 * 1000, 3)} mm/s on ${f(mine5.mStar * 1e6, 3)} mg → ${f(mine5.Eimp * 1e9, 4)} nJ`);
near(mine5.omega0, lg.omegaLetoff_rad_s, 1e-12, 'the let-off speed disagrees');
near(mine5.omega, lg.omegaLand_rad_s, 1e-12, 'the landing speed disagrees');
near(mine5.mStar, lg.mStar_kg, 1e-12, 'the effective mass disagrees');
near(mine5.v0, lg.v0_m_s, 1e-12, 'the closing velocity disagrees');
near(mine5.Eimp, lg.energy_J, 1e-12, 'the impact energy disagrees');
near(mine5.shake, lg.shakedownAllow_Pa, 1e-12, 'the shakedown allowable disagrees');
{
  const fin = lg.finish;
  const rFin = mine5.rhoFor(mine5.shake), rEl = mine5.rhoFor(allow);
  const q = mine5.peak(rFin), atSharp = mine5.peak(L.ESCAPE_TIP_R_BAND.sharp_m);
  console.log(`   the tip is FINISHED at ${f(rFin * 1e6, 5)} \u00b5m, where the landing peaks at ${f(q.F * 1000, 3)} mN and p0 ${f(q.p0 / 1e9, 4)} GPa`);
  console.log(`   = the shakedown limit ${f(mine5.shake / 1e9, 4)} GPa exactly, so the contact shakes down AS CUT and the tip does not run in`);
  console.log(`   a razor finish (${f(L.ESCAPE_TIP_R_BAND.sharp_m * 1e6, 2)} \u00b5m) would stand at ${f(atSharp.p0 / 1e9, 3)} GPa = \u00d7${f(atSharp.p0 / mine5.shake, 3)} of it \u2014 the overstress the derivation removes`);
  console.log(`   finishing there spends ${f(fin.cutBack_u * U * 1e6, 3)} \u00b5m of reach, and a fully elastic contact would want ${f(rEl * 1e6, 4)} \u00b5m`);
  near(rFin, fin.rho_m, 1e-9, 'the derived finish disagrees');
  near(q.p0, lg.atFinish.p0_Pa, 1e-9, 'the peak contact pressure at the finish disagrees');
  near(q.F, lg.atFinish.F, 1e-9, 'the peak force at the finish disagrees');
  near(rEl, fin.elasticRho_m, 1e-6, 'the elastic finish disagrees');
  near(atSharp.p0, fin.atSharp.p0_Pa, 1e-9, 'the razor finish\'s pressure disagrees');
  near(q.p0, mine5.shake, 1e-9, 'the finish is not the fixed point');
  ok(lg.runsIn === false, 'the record still claims the tip runs in', lg.runsIn);
  ok(rFin >= L.ESCAPE_TIP_R_BAND.sharp_m && rFin <= L.ESCAPE_TIP_R_BAND.blunt_m,
    'the derived finish is outside what a polish can hold', { rFin, band: L.ESCAPE_TIP_R_BAND });
  ok(et.rho_m === fin.rho_m, 'the rows are not priced at the derived finish', { pricedAt: et.rho_m, finish: fin.rho_m });
}

console.log('\n6. CONTROLS ON THE LANDING');
// C6 — the contact's compliance cannot move the answer. This is what makes the
// 2-D datum ambiguity (Johnson §5.2: two cylinders' approach is only defined
// against a reference length) harmless rather than hidden.
{
  const base = mine5.rhoFor(mine5.shake);
  const stiff = mine5.rhoFor(mine5.shake, mine5.Eimp, Infinity, 10);
  const soft = mine5.rhoFor(mine5.shake, mine5.Eimp, Infinity, 0.1);
  const dS = Math.abs(stiff - base) / base, dW = Math.abs(soft - base) / base;
  console.log(`   C6 contact stiffness ×10 and ÷10: run-in ${f(base * 1e6, 5)} → ${f(stiff * 1e6, 5)} / ${f(soft * 1e6, 5)} µm (${f(100 * dS, 4)}% / ${f(100 * dW, 4)}%)`);
  ok(dS > 0 && dW > 0, 'C6 did not fire: the multiplier changed nothing, so this control is its own no-op', { base, stiff, soft });
  ok(dS < 0.01 && dW < 0.05, 'C6 did not fire: the answer depends on the contact’s datum-dependent compliance', { base, stiff, soft, dS, dW });
  ok(lg.atFinish.kHertz_N_per_m > 100 * lg.atFinish.kTooth_N_per_m,
    'C6 did not fire: the contact is not far stiffer than the tooth, so the stack is not the tooth\'s', lg.atFinish);
}
// C7 — a SOFTER stack must run the tip in LESS, which is what makes the
// unmodelled members (the fork's arm, the stone's seat, the banking pin) leave
// this an upper bound rather than a guess.
{
  const base = mine5.rhoFor(mine5.shake);
  const withFork = mine5.rhoFor(mine5.shake, mine5.Eimp, lg.atFinish.kTooth_N_per_m);   // one more member as soft as the tooth
  console.log(`   C7 one more series member as soft as the tooth: run-in ${f(base * 1e6, 4)} → ${f(withFork * 1e6, 4)} µm — ${withFork < base ? 'LESS' : 'MORE'}, so leaving them out bounds it`);
  ok(withFork < base * 0.999, 'C7 did not fire: softening the stack does not reduce the run-in, so the bound\'s direction is unproven', { base, withFork });
}
// C8 — the DESIGN swing instead of the peak must be kinder, which is what makes
// pricing at AMPLITUDE_PEAK_DEG the conservative reading (TODO 192 step 4's rule).
{
  const Atg = L.AMPLITUDE_TARGET_DEG * DEG, wB = 2 * Math.PI * L.F_BALANCE, thL = C.pinNotch.liftHalf;
  const thetaDotT = Atg * wB * Math.cos(Math.asin(Math.min(1, thL / Atg)));
  const o0 = mine5.gear * mine5.dPhi * thetaDotT;
  const o = Math.sqrt(o0 * o0 + 2 * en.escapeTorque_Nm * ES.drop / mine5.Iw);
  const Et = 0.5 * mine5.mStar * (mine5.aW * o) ** 2;
  const rIn = mine5.rhoFor(mine5.shake, Et);
  console.log(`   C8 at the design swing ${f(L.AMPLITUDE_TARGET_DEG, 0)}°: ω ${f(o, 2)} rad/s, ${f(Et * 1e9, 4)} nJ, run-in ${f(rIn * 1e6, 4)} µm against the peak's ${f(mine5.rhoFor(mine5.shake) * 1e6, 4)}`);
  ok(rIn < mine5.rhoFor(mine5.shake), 'C8 did not fire: the design swing is not kinder than the peak', { rIn, peak: mine5.rhoFor(mine5.shake) });
}
// C9 — the inversion is the inversion: p0 at the run-in radius IS the allowable,
// and p0 goes as rho^-1/2 at a fixed force.
{
  const rIn = mine5.rhoFor(mine5.shake), q = mine5.peak(rIn);
  const half = Math.sqrt((q.F / tM) * Estar / (Math.PI * (4 * rIn)));
  console.log(`   C9 p0(ρ_runIn) = ${f(q.p0 / 1e9, 6)} GPa against the allowable ${f(mine5.shake / 1e9, 6)}; at 4ρ and the same F, p0 ×${f(half / q.p0, 9)} (need ½)`);
  near(q.p0, mine5.shake, 1e-9, 'C9: the run-in radius does not land on the allowable');
  near(half / q.p0, 0.5, 1e-12, 'C9: p0 does not go as ρ^−½');
}
// C10 — the drop is what does it. With no drop the wheel arrives at its let-off
// speed alone, and the tip still has to run in: a landing this row could not see
// would be one the drop's own energy dominated to the point of absurdity.
{
  const o = mine5.omega0, Et = 0.5 * mine5.mStar * (mine5.aW * o) ** 2;
  const rIn = mine5.rhoFor(mine5.shake, Et);
  console.log(`   C10 without the drop's acceleration: ${f(Et * 1e9, 4)} nJ of ${f(mine5.Eimp * 1e9, 4)}, run-in ${f(rIn * 1e6, 4)} µm — the drop contributes ${f(100 * (1 - Et / mine5.Eimp), 1)}% of the energy`);
  ok(Et < mine5.Eimp && rIn < mine5.rhoFor(mine5.shake), 'C10 did not fire: the drop does not add energy', { Et, Eimp: mine5.Eimp });
  ok(rIn > L.ESCAPE_TIP_R_BAND.sharp_m, 'C10: even the let-off speed alone should ask for more than a razor tip', { rIn });
}

// ---------------------------------------------------------------------------
// 7. THE DESIGN LIFE (TODO 299), recomputed, and what the hardening bought.
// ---------------------------------------------------------------------------
const wr = et.wear;
ok(!!wr, 'the record carries no wear block', null);
const mine7 = (() => {
  // the slip, measured again off the re-solved escapement
  let slip = null;
  for (const st of ES.stones) {
    const s2 = st.sigma, chord = Math.hypot(st.E[0] - st.K[0], st.E[1] - st.K[1]);
    const down = Math.abs(ES.deltaOnLockFace(s2, s2 * ES.bank).t);
    const imp = Math.abs(ES.deltaOnImpulseFace(s2, s2 * st.xE).t - ES.deltaOnImpulseFace(s2, s2 * ES.unlock).t) * chord;
    const tot = 2 * down + imp;
    if (!slip || tot > slip.perEngagement_u) slip = { stone: s2, lockFace_u: down, impulseFace_u: imp, perEngagement_u: tot };
  }
  // the counts, walked off layout's TRAIN rather than off the record
  const life = L.DESIGN_LIFE_YEARS * L.JULIAN_YEAR_S;
  const beats = L.SPEC.vph / 3600 * life;
  const turns = { escape: beats * L.BEAT_DEG / 360 };
  turns.fourth = turns.escape * L.TRAIN.fourth.pinion / L.TRAIN.fourth.teeth;
  turns.third = turns.fourth * L.TRAIN.third.pinion / L.TRAIN.third.teeth;
  turns.centre = turns.third * L.TRAIN.center.pinion / L.TRAIN.center.teeth;
  const engPerTooth = beats / 15;
  // the budget, re-solved from the worn crossing with this probe's own root finder
  const rot = ([x, y], aa) => [x * Math.cos(aa) - y * Math.sin(aa), x * Math.sin(aa) + y * Math.cos(aa)];
  const lockRunAt = (dR) => {
    const Rw = ES.R - dR;
    return Math.min(...ES.stones.map((st) => {
      const phi = st.sigma * ES.bank, A = rot(st.K, phi), v = rot(st.tau, phi);
      const wv = [A[0] - ES.W0[0], A[1] - ES.W0[1]];
      const qa = v[0] * v[0] + v[1] * v[1], qb = 2 * (wv[0] * v[0] + wv[1] * v[1]);
      const qc = wv[0] * wv[0] + wv[1] * wv[1] - Rw * Rw, disc = qb * qb - 4 * qa * qc;
      if (disc < 0) return 0;
      const sq = Math.sqrt(disc), t1 = (-qb - sq) / (2 * qa), t2 = (-qb + sq) / (2 * qa);
      return Math.abs(Math.abs(t1) <= Math.abs(t2) ? t1 : t2);
    }));
  };
  const full = lockRunAt(0), keep = full * E.LOCK_DEG / (E.LOCK_DEG + E.RUN_DEG);
  let lo = 0, hi = 0.5;
  for (let i = 0; i < 90; i++) { const m = (lo + hi) / 2; if (lockRunAt(m) >= keep) lo = m; else hi = m; }
  const nom = et.rows.filter((q) => q.corner === 'nominal');
  const Fmean = nom.reduce((x, q) => x + q.load_N, 0) / nom.length;
  // §344 — the depth is RADIAL, as the budget is: a cut square to the radius
  // takes ½·d²·wpd of the wedge (wpd held to the flanks' difference by C1)
  const wpd = et.geom.wedge.widthPerDepth;
  const recess = (K, H, slipTotal) => Math.sqrt(2 * (K * Fmean * slipTotal / H) / tM / wpd);
  const slipTotal = slip.perEngagement_u * U * engPerTooth;
  return { slip, turns, beats, engPerTooth, budget_u: lo, lockRunFull_u: full, lockOnly_u: keep,
    Fmean, wpd, slipTotal, recess, lockRunAt,
    control: { centrePerHour: turns.centre / (life / 3600), fourthPerMinute: turns.fourth / (life / 60) } };
})();
// C11 -- THE PREMISE. Finishing the tooth at the blunting radius is only a
// SPECIFICATION if that radius is a property of the impact and not of the tip
// the wheel happened to be cut with. Solve it from starting radii four decades
// apart: the same fixed point, or the idea is circular and the landing is void.
{
  const starts = [1e-9, 1e-8, 1e-7, 3e-7, 1e-6, 1e-5];
  const got = starts.map((s0) => { let rr = s0; for (let i = 0; i < 400; i++) rr = Math.min(1e-3, Math.max(1e-11, rr * (mine5.peak(rr).p0 / mine5.shake) ** 2)); return rr; });
  const spread = Math.max(...got) / Math.min(...got) - 1;
  console.log(`   C11 the finish solved from ${starts.length} starting radii over ${f(Math.log10(starts[starts.length - 1] / starts[0]), 0)} decades: spread ${g3(spread)}`);
  ok(spread < 1e-9, 'C11 did not fire: the finish depends on the radius it was solved from, so specifying it is circular', { got, spread });
  near(got[0], lg.finish.rho_m, 1e-9, 'C11: the fixed point is not the record\'s finish');
}

console.log('\n7. THE DESIGN LIFE, recomputed');
console.log(`   ${L.DESIGN_LIFE_YEARS} years at ${L.SERVICE_INTERVAL_YEARS}-yearly service = ${L.SERVICES_IN_LIFE} services; ${(mine7.engPerTooth / 1e9).toFixed(4)}e9 engagements per tooth`);
console.log(`   slip ${f(mine7.slip.perEngagement_u * U * 1e6, 1)} \u00b5m per engagement (${f(mine7.slip.lockFace_u, 4)} u down the lock face \u00d72 + ${f(mine7.slip.impulseFace_u, 4)} u along the impulse) \u2192 ${f(mine7.slipTotal / 1000, 1)} km`);
console.log(`   budget from the apex ${f(mine7.budget_u * U * 1e6, 2)} \u00b5m (lock+run ${f(mine7.lockRunFull_u, 5)} u \u2192 lock ${f(mine7.lockOnly_u, 5)} u)`);
near(mine7.slip.perEngagement_u, et.geom.slip.perEngagement_u, 1e-12, 'the slip per engagement disagrees');
near(mine7.engPerTooth, wr.engagementsPerTooth, 1e-12, 'the engagements per tooth disagree');
near(mine7.budget_u, wr.fromApex_u, 1e-6, 'the wear budget from the apex disagrees');
near(mine7.budget_u - lg.finish.cutBack_u, wr.budget_u, 1e-6, 'the wear budget does not book the finish\'s cut-back');
console.log(`   the finish spends ${f(lg.finish.cutBack_u * U * 1e6, 2)} \u00b5m of that, leaving ${f(wr.budget_u * U * 1e6, 2)} \u00b5m for the century`);
near(mine7.Fmean, wr.load_N, 1e-12, 'the wear load disagrees');
for (const c of L.FRICTION_CORNERS) {
  const d = mine7.recess(L.WEAR_K_BAND[c], L.ESCAPE_STEEL_HARDNESS_PA, mine7.slipTotal);
  const budget = mine7.budget_u - lg.finish.cutBack_u;
  console.log(`   ${c.padEnd(11)} K=${L.WEAR_K_BAND[c].toExponential(0)}  recession ${f(d * 1e6, 2).padStart(6)} \u00b5m  \u00d7${f((d / U) / budget, 3)} of budget  ${(d / U) <= budget ? 'HOLDS' : 'OVER'}`);
  near(d, wr.corners[c].recession_m, 1e-9, `the recession disagrees at the ${c} corner`);
}
console.log(`   holds at ${wr.holdsAt.join(' and ')}${wr.straddles ? ' \u2014 STRADDLES, so the coefficient decides the century' : ''}`);
ok(wr.corners.nominal.overBudget <= 1, 'the escape wheel misses its design life at the nominal corner', wr.corners.nominal);

console.log('\n8. CONTROLS ON THE DESIGN LIFE');
// W1 -- the counts' own control, recomputed here: facts about a watch.
{
  console.log(`   W1 centre arbor ${f(mine7.control.centrePerHour, 9)} turns an hour, fourth ${f(mine7.control.fourthPerMinute, 9)} a minute (both must be 1)`);
  near(mine7.control.centrePerHour, 1, 1e-12, 'W1: the centre arbor does not turn once an hour');
  near(mine7.control.fourthPerMinute, 1, 1e-12, 'W1: the fourth arbor does not turn once a minute');
  // and the counts must FALL going up the train, by more than a token amount
  ok(mine7.turns.escape / mine7.turns.centre > 500, 'W1: the escape arbor does not turn far faster than the centre', mine7.turns);
}
// W2 -- the budget really is where the lock runs out, by this probe's own
// root find, and wearing the tooth really does shorten the lock.
{
  const atB = mine7.lockRunAt(mine7.budget_u);
  console.log(`   W2 at the budget the worn crossing stands at ${f(atB, 5)} u against the lock's ${f(mine7.lockOnly_u, 5)} u; as cut it is ${f(mine7.lockRunAt(0), 5)}`);
  ok(Math.abs(atB - mine7.lockOnly_u) < 1e-6, 'W2: the budget does not land the worn crossing on the lock', { atB, keep: mine7.lockOnly_u });
  ok(mine7.lockRunAt(0) > atB, 'W2: wearing the tooth does not shorten the lock, so the budget is not a budget', { asCut: mine7.lockRunAt(0), atB });
}
// W3/W4 -- the law reads its inputs: recession goes as 1/sqrt(H) and sqrt(K).
{
  const base = mine7.recess(L.WEAR_K_BAND.adverse, L.ESCAPE_STEEL_HARDNESS_PA, mine7.slipTotal);
  const harder = mine7.recess(L.WEAR_K_BAND.adverse, 2 * L.ESCAPE_STEEL_HARDNESS_PA, mine7.slipTotal);
  const rougher = mine7.recess(100 * L.WEAR_K_BAND.adverse, L.ESCAPE_STEEL_HARDNESS_PA, mine7.slipTotal);
  console.log(`   W3 twice the hardness: recession \u00d7${f(harder / base, 9)} (need 1/\u221a2 = ${f(1 / Math.SQRT2, 9)})`);
  console.log(`   W4 a hundred times the coefficient: \u00d7${f(rougher / base, 9)} (need 10)`);
  near(harder / base, 1 / Math.SQRT2, 1e-12, 'W3: recession does not go as 1/\u221aH');
  near(rougher / base, 10, 1e-12, 'W4: recession does not go as \u221aK');
}
// W5 -- WHAT THE HARDENING BOUGHT, measured against the temper the wheel
// carried before TODO 299 (48-54 HRC, 510 HV by the same conversion).
{
  const soft = 510 * L.HV_TO_PA;
  const was = mine7.recess(L.WEAR_K_BAND.adverse, soft, mine7.slipTotal);
  const now = mine7.recess(L.WEAR_K_BAND.adverse, L.ESCAPE_STEEL_HARDNESS_PA, mine7.slipTotal);
  console.log(`   W5 at the old 510 HV temper the adverse corner lost ${f(was * 1e6, 2)} \u00b5m (\u00d7${f((was / U) / (mine7.budget_u - lg.finish.cutBack_u), 3)} of budget); hardened to ${L.ESCAPE_STEEL_HARDNESS_BAND.lowHV} HV it loses ${f(now * 1e6, 2)} (\u00d7${f((now / U) / (mine7.budget_u - lg.finish.cutBack_u), 3)})`);
  ok(now < was, 'W5: hardening did not reduce the wear, so the change bought nothing', { was, now });
  ok((now / U) / (mine7.budget_u - lg.finish.cutBack_u) > 1, 'W5: the adverse corner now HOLDS \u2014 this control and TODO 299\'s record have parted', { over: (now / U) / (mine7.budget_u - lg.finish.cutBack_u) });
}
// W6 -- THE CEILING, reported: the hardness that would close the adverse
// corner, and that no steel reaches it.
{
  const need = 2 * L.WEAR_K_BAND.adverse * mine7.Fmean * mine7.slipTotal / (Math.pow((mine7.budget_u - lg.finish.cutBack_u) * U, 2) * tM * mine7.wpd);
  console.log(`   W6 closing the adverse corner needs H \u2265 ${f(need / 1e9, 2)} GPa (${f(need / L.HV_TO_PA, 0)} HV) \u2014 steel's practical ceiling is about 800 HV, so this is silicon, a carbide or a coating`);
  near(need, wr.needHardness_Pa.adverse, 1e-9, 'W6: the record\'s needed hardness disagrees');
  ok(need / L.HV_TO_PA > 800, 'W6: the needed hardness is inside steel\'s range, so the ceiling this landing reports is wrong', { needHV: need / L.HV_TO_PA });
}

// ---------------------------------------------------------------------------
// 9. WHAT THE RING COSTS TO CUT (TODO 299 landing 2), recomputed off the
//    authored outline, because the owner asked after the wheel's construction.
// ---------------------------------------------------------------------------
{
  const ct = et.geom.cut;
  ok(!!ct, 'the geometry carries no cut record', null);
  const poly2 = wheel.userData.profile.poly, m = poly2.length;
  const atP = (i) => poly2[((i % m) + m) % m];
  let area2 = 0;
  for (let i = 0; i < m; i++) { const q = atP(i), q2 = atP(i + 1); area2 += q[0] * q2[1] - q2[0] * q[1]; }
  let conc = Infinity, conv = Infinity;
  for (let i = 0; i < m; i++) {
    const q0 = atP(i - 1), q1 = atP(i), q2 = atP(i + 1);
    const u1 = [q1[0] - q0[0], q1[1] - q0[1]], u2 = [q2[0] - q1[0], q2[1] - q1[1]];
    const l1 = Math.hypot(u1[0], u1[1]), l2 = Math.hypot(u2[0], u2[1]);
    if (!(l1 > 1e-9 && l2 > 1e-9)) continue;
    const cr = (u1[0] * u2[1] - u1[1] * u2[0]) / (l1 * l2), dt = (u1[0] * u2[0] + u1[1] * u2[1]) / (l1 * l2);
    const turn = Math.atan2(cr, dt), inc = (Math.PI - Math.abs(turn)) * 180 / Math.PI;
    if ((area2 > 0) ? turn < 0 : turn > 0) conc = Math.min(conc, inc); else conv = Math.min(conv, inc);
  }
  console.log('\n9. WHAT THE RING COSTS TO CUT');
  console.log(`   one closed ring of ${m} vertices; sharpest CONCAVE corner ${f(conc, 2)}\u00b0 (floor ${L.CUT_CONCAVE_MIN_DEG}\u00b0), sharpest CONVEX ${f(conv, 3)}\u00b0 = the club's wedge`);
  console.log(`   narrowest gullet ${f(ct.gullet_u * L.UNIT_MM * 1000, 1)} \u00b5m against a ${f(2 * L.CUT_TOOL_R_M * 1e6, 0)} \u00b5m tool \u2014 \u00d7${f(ct.gullet_u / (2 * ct.toolR_u), 2)} clearance; cut depth / gullet ${f(ct.aspect, 2)}`);
  console.log(`   so the profile is ONE piercing and the only micron-scale operation on the wheel is the tip's polish \u2014 which this landing made ${f(lg.finish.rho_m / L.ESCAPE_TIP_R_BAND.sharp_m, 2)}x coarser`);
  near(conc, ct.concave.includedDeg, 1e-9, 'the sharpest concave corner disagrees');
  near(conv, ct.convex.includedDeg, 1e-9, 'the sharpest convex corner disagrees');
  near(conv, et.geom.wedge.fullDeg, 1e-6, 'the sharpest convex corner is not the club\'s wedge');
  ok(conc >= L.CUT_CONCAVE_MIN_DEG, 'the ring asks for a pocket no rotary tool can reach', { conc, floor: L.CUT_CONCAVE_MIN_DEG });
  ok(ct.gullet_u > 2 * ct.toolR_u, 'nothing the shop has fits down the gullet', { gullet: ct.gullet_u, tool: 2 * ct.toolR_u });
}

// ---------------------------------------------------------------------------
console.log('');
if (argJson) {
  writeFileSync(argJson, JSON.stringify({ meshWedge, mineRuns, vw, mine, worst, landing: lg, fails }, null, 1));
  console.log(`wrote ${argJson}`);
}
if (fails.length) {
  console.error(`FAIL — ${fails.length} disagreement(s) between the record and this computation:`);
  for (const q of fails) console.error(' ', q.what, JSON.stringify(q.detail));
  process.exit(1);
}
console.log(`PASS — the record and this computation agree on ${et.rows.length} rows, ${et.geom.runs.length} contact arms, the drop's landing and the century's wear; all seventeen controls fired.`);
const margin = Math.min(worst.p0Margin, worst.sigmaMargin);
console.log(`       The club tooth carries the escapement at ×${f(margin, 2)} on the ${worst.binds} criterion; its tip needs ${f(worst.rhoMin * 1e9, 2)} nm of radius for that and the DERIVED finish gives ${f(et.rho_m * 1e9, 0)}.`);
// Hertz binds and p0 ∵ √F, so the torque at which the tip first yields is the
// margin SQUARED — the headroom over the escapement's own load, in one number.
console.log(`       It first yields at ×${f(margin * margin, 1)} the escape torque. The owner's eye was right that the metal is thin; the LOAD is ${f(worst.load_N * 1e6, 0)} µN.`);
console.log(`       The DROP's landing is why the tip is FINISHED at ${f(lg.finish.rho_m * 1e6, 4)} µm — the impact's own fixed point, where it shakes down as cut, so it never runs in; a razor ${f(L.ESCAPE_TIP_R_BAND.sharp_m * 1e6, 2)} µm would stand ×${f(lg.finish.sharpOverShakedown, 3)} over it.`);
console.log(`       Over ${wr.years} years of ${wr.serviceYears}-yearly service each tooth slides ${f(wr.slip_m / 1000, 0)} km and loses ${f(wr.corners.nominal.recession_m * 1e6, 2)} µm of reach at the nominal corner against a ${f(wr.budget_u * U * 1e6, 2)} µm lock budget — ${wr.straddles ? `but ${f(wr.corners.adverse.recession_m * 1e6, 2)} µm at the adverse, which the lock cannot spend: the coefficient decides the century.` : 'at every corner.'}`);
process.exit(0);
