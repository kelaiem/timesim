// TODO 138 Landing 1 — DO TWO BEVEL TEETH ACTUALLY ROLL? THE PROOF, IN FREE SPACE.
// Acceptance, pure Node, no browser. Builds each crossed-axis gear pair — the
// motion-works bevel corner, the alarm setting corner, the alarm contrate
// climb, and TODO 136's two keyless crown-wheel-and-pinion pairs — from the
// real generator (bevelToothSpec + bevelOutline + makeConicalGear), rolls it at
// the conjugate ratio through a full tooth pitch, and measures interpenetration
// and working clearance analytically about the shared apex. Answers: do
// cone-cut flanks interleave at all; is the tooth conjugate (the §136 cycloid
// developed on the back cone, Tredgold's virtual count z/cosγ); what does the
// planar-versus-spherical profile approximation cost out of the backlash; is
// the solid apex-ruled rather than sheared; is the blank watertight. Seven
// controls, because the defect this answers — a mitre pair whose teeth never
// touch — passes any penetration column.
//
// The house pattern ("design in a line, fold to fit"), and the direct sequel to
// probe-136-roll: prove the mechanism at P0 in isolation before the fold
// touches the movement. Here the mechanism is the BEVEL tooth surface.
//
// WHY IT EXISTS. `makeBevelGear` extrudes a flat outline and shears it onto a
// cone, so the tooth's height stays RADIAL and the solid is a constant-
// thickness shell. Two such shells at complementary tapers satisfy tc·tp = 1
// exactly, which forces their bands to meet on the tangent LINE and nowhere
// else — measured by probe-crossed-axis-mesh's tier three as floor 0.0000 AND
// ceiling 0.0000 at every index, both senses, all three mountings. That is not
// a mesh; it is two surfaces that never occupy the same space. Three corners
// ship in that form and `transfers` declares all three `bevelPair`.
//
// WHAT IS UNDER TEST. `bevelToothSpec` + `bevelOutline` + `makeConicalGear` in
// src/geometry.js — the REAL generator Landing 2 will consume, not a copy of
// its arithmetic. The tooth is the §136 cycloid developed on the back cone
// (Tredgold) and ruled to the apex, so the profile law is the one
// probe-136-roll already proves conjugate on 24 of the movement's meshes.
//
// THE MEASURE IS ANALYTIC AND EXACT, and the exactness is a gift of the form.
// Every tooth surface is a cone of rays through the shared apex, so the
// distance from a point P to the surface is |P|·sin(angle from P̂ to the
// nearest ray) — and the nearest ray on a polyline-of-rays is exact per wedge:
// for the flat wedge spanned by two adjacent rays it is |P·m̂| with m̂ the
// wedge's unit normal, when the foot lands inside the wedge, and |P × n̂| to an
// end ray otherwise. No bins, no bias to state, and the number is a LENGTH, so
// it is commensurate with the movement's linear budgets.
//
// BOTH DIRECTIONS ARE MEASURED. A containment test is not symmetric (the
// instruments skill's own trap): a tip buried in a flank reads differently from
// the flank's outline against the tip.
//
// THE PHASE IS DERIVED, NOT SEARCHED — probe-136-roll's rule. A's tooth 0 is
// centred on the tangency ray at α_A = 0, so B must present a GAP there:
// α_B = pitch_B/2 − α_A·z_A/z_B. The RATIO's sign is derived too, from the
// rolling condition that the relative angular velocity lies along the contact
// line: with A about ẑ and B about x̂, (−ω_B, 0, ω_A) ∥ (sin γ_A, 0, cos γ_A)
// gives ω_B = −ω_A·tan γ_A = −ω_A·z_A/z_B.
//
// FOUR CONTROLS, because the failure this whole item is about — a pair that
// reads 0.0000 because it never touches — looks exactly like a perfect mesh if
// you only read the penetration column:
//   · ENGAGES — the minimum clearance through the roll must be SMALL. A pair
//     whose teeth never come near each other passes every penetration bar; the
//     shear-cone form passes it with room to spare. This is the load-bearing
//     control, not the penetration one.
//   · HALF PITCH — inject half a tooth into B and it must read DEEP.
//   · WRONG SENSE — reverse the ratio and it must read DEEP. (The tooth is
//     mirror-symmetric, so this tests the ROLL, not the profile.)
//   · CLOSED SOLID — makeConicalGear's mesh must be watertight and positively
//     oriented. An open body reads as a colliding one downstream (TODO 27),
//     and a closed one built inside-out reads as empty.
//
// PASS: worst penetration ≤ the pair's chord budget ε = 0.01·π·m — the same
// bar probe-136-roll holds the spur teeth to, because it is the same profile.
// Reported, never gated: the minimum working clearance (how much of the
// derived backlash survives the roll) and the penetration measured separately
// at the back plane and the front plane, which is where a face-width error
// would show if the construction had one.
//
// Run from tools/:  node --import ./three-node-loader.mjs probe-138-bevel-roll.mjs
//                   add --json for the machine payload.
import * as THREE from 'three';
import { bevelToothSpec, bevelOutline, makeConicalGear } from '../src/geometry.js';

// The pairs the movement actually has, plus TODO 136's two keyless pairs — the
// ones that have no conjugate form to be cut in today. Counts and modules are
// the shipped constants, cited so a change in main.js shows up as a diff here.
const ROWS = [
  // src/main.js BEVEL_TEETH = 10, BEVEL_MODULE = 0.3 — the motion-works arbor's
  // two corners (gearIn ⇄ gearOut), CLAUDE.md's template for a fold-added part.
  { name: 'mw corner  gearIn ⇄ gearOut', m: 0.30, za: 10, zb: 10, face: null },
  // ALARM_BEVEL_TEETH = 10, ALARM_BEVEL_MODULE = 0.24. ALARM_BEVEL_FACE is no
  // longer a constant — Landing 2 made main.js read `bevelToothSpec(...).faceW`
  // because the shipped 0.65 stood 15% past this member's coneR/3 — so these
  // rows leave `face` null for the same reason, and a face width written here
  // would be a second copy of a number the generator owns.
  { name: 'alarm      discBevel ⇄ stemBevel', m: 0.24, za: 10, zb: 10, face: null },
  { name: 'alarm      contrate ⇄ climb', m: 0.24, za: 10, zb: 10, face: null },
  // TODO 136's keyless pairs: spur rims crossed at the stem today, buried
  // 0.2065 and 0.1372 deep, with no indexing that clears them.
  { name: 'keyless    crownWheel ⇄ windingPinion', m: 0.34, za: 20, zb: 8, face: null },
  { name: 'keyless    settingWheel ⇄ clutchRim', m: 0.34, za: 20, zb: 8, face: null },
];

const STEPS = 96;            // poses per tooth pitch — both parities of contact
const BAND = 5;              // sample planes across the face band

// ---- the frames ------------------------------------------------------------
// A: apex at the origin, axis +z. B: apex at the SAME origin, axis +x, with its
// local +x laid along world +z so the tangency ray sits at B's azimuth 0 —
// which is what makes the derived phase above a statement about tooth 0 and
// not about an arbitrary quaternion's choice of reference direction.
//   world  = (w, −v, u)   from B-local (u, v, w)
//   local  = (Z, −Y, X)   from world  (X, Y, Z)
const toB = (X, Y, Z) => [Z, -Y, X];

// Θ(φ) by linear interpolation on an outline that is strictly increasing in φ.
const thetaAt = (outline, phi) => {
  const N = outline.length;
  const span = Math.PI * 2;
  let p = ((phi - outline[0][0]) % span + span) % span;   // into [0, 2π) from the first vertex
  // binary search the bracketing pair
  let lo = 0, hi = N;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (outline[mid][0] - outline[0][0] <= p) lo = mid; else hi = mid;
  }
  const [p0, t0] = [outline[lo][0] - outline[0][0], outline[lo][1]];
  const nxt = (lo + 1) % N;
  const p1 = lo + 1 >= N ? span : outline[nxt][0] - outline[0][0];
  const t1 = outline[nxt][1];
  const f = p1 > p0 ? (p - p0) / (p1 - p0) : 0;
  return t0 + f * (t1 - t0);
};

// Rays of the outline as unit directions, precomputed once per gear.
const raysOf = (outline) => outline.map(([phi, th]) => [
  Math.sin(th) * Math.cos(phi), Math.sin(th) * Math.sin(phi), Math.cos(th)]);

// EXACT distance from a point to the cone of rays through the apex. The apex is
// the origin in this frame, so no translation enters, and the whole problem is
// angular: the nearest point of the cone lies on the ray nearest P in ANGLE, so
//
//     d = |P|·sin(Δ)   for Δ ≤ 90°,      d = |P|   beyond that,
//
// where Δ is the great-circle angle from P̂ to the outline curve, and beyond 90°
// the nearest point of a one-sided ray set is the apex itself.
//
// PER ARC, AND THE DEGENERATE CASE IS THE WHOLE DIFFICULTY. For the arc from a
// to b the angle to its great circle is asin(|P̂·m̂|) with m̂ = a×b normalised,
// usable only when the foot falls inside the arc; otherwise the endpoints
// govern. But adjacent outline points are nearly PARALLEL directions, so a×b is
// a tiny vector whose DIRECTION is numerical noise, and |P̂·m̂| against a noisy
// normal can be anything at all — including zero.
//
// That is not hypothetical. The first build of this probe used the wedge form
// of this test with no degeneracy guard, and the plane-cut band gate happened
// to hide it by excluding everything behind the mate's apex. Cutting the blanks
// at a cone distance instead admits those points (ρ is the same on both sides),
// and the run came back `min clear 0.00003` in all five rows — traced to one
// sample landing at θ = 134.999° in the mate's frame, BEHIND it, scored ~0
// against a sliver whose normal was noise. The true distance there is ~1.4.
// So: an arc shorter than DEGEN is judged by its endpoints, which is exact for
// a polyline, and the ≤ 90° branch keeps a point behind the apex honest.
const DEGEN = 1e-7;
const angTo = (P, n) => {
  const d = Math.max(-1, Math.min(1, P[0] * n[0] + P[1] * n[1] + P[2] * n[2]));
  return Math.acos(d);
};
const coneDist = (P, rays) => {
  const rho = Math.hypot(P[0], P[1], P[2]);
  if (rho < 1e-12) return 0;
  const p = [P[0] / rho, P[1] / rho, P[2] / rho];
  let ang = Math.PI;
  for (let i = 0; i < rays.length; i++) {
    const a = rays[i], b = rays[(i + 1) % rays.length];
    let best = Math.min(angTo(p, a), angTo(p, b));        // endpoints, always valid
    let mx = a[1] * b[2] - a[2] * b[1];
    let my = a[2] * b[0] - a[0] * b[2];
    let mz = a[0] * b[1] - a[1] * b[0];
    const mL = Math.hypot(mx, my, mz);
    if (mL > DEGEN) {
      mx /= mL; my /= mL; mz /= mL;
      const h = p[0] * mx + p[1] * my + p[2] * mz;         // sin of the angle to the great circle
      // the foot, and whether it lies within THIS arc rather than its extension
      const fx = p[0] - h * mx, fy = p[1] - h * my, fz = p[2] - h * mz;
      const fL = Math.hypot(fx, fy, fz);
      if (fL > 1e-12) {
        const f = [fx / fL, fy / fL, fz / fL];
        const ab = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
        const fa = f[0] * a[0] + f[1] * a[1] + f[2] * a[2];
        const fb = f[0] * b[0] + f[1] * b[1] + f[2] * b[2];
        if (fa >= ab && fb >= ab) best = Math.min(best, Math.asin(Math.min(1, Math.abs(h))));
      }
    }
    if (best < ang) ang = best;
  }
  return ang <= Math.PI / 2 ? rho * Math.sin(ang) : rho;
};

// Is a material point inside this gear's blank?  bore ≤ r, z in the face band,
// and θ under the angular outline. All three, because dropping the band would
// let a point beyond the blank's end count as buried.
const inBand = (u, v, w, spec) => {
  const rho = Math.hypot(u, v, w);
  return rho >= spec.coneRi && rho <= spec.coneR && Math.hypot(u, v) >= spec.boreR;
};
const underOutline = (u, v, w, outline) =>
  Math.atan2(Math.hypot(u, v), w) <= thetaAt(outline, Math.atan2(v, u));

// THE BAND IS SHARED, AND THAT IS WHY IT IS A CONE DISTANCE AND NOT A PLANE.
// Both members measure ρ from the SAME apex, so ρ ∈ [coneRi, coneR] is one band
// for the PAIR: a point at the end of one member's tooth is at the end of the
// other's, everywhere, not only on the pitch cone.
//
// The first build of this generator cut the blanks with planes perpendicular to
// each axis, and then the bands agreed ONLY on the pitch cone. A tooth TIP
// reached ρ = z/cos θ_tip past the end of the mate's tooth, into free space
// where the cone-of-rays measure — which knows nothing about where the mate's
// tooth STOPS — handed back the distance to the mate's surface EXTENDED, near
// zero. All five rows read `min clear 0.00003` and the ENGAGES control passed
// for a reason that had nothing to do with the teeth engaging. The gate still
// guards BOTH statistics, because a clearance is only a clearance where the two
// bodies share the free coordinate; it just no longer has anything to forgive.

// ---- the closed-solid control ----------------------------------------------
// Every edge used exactly twice in opposite directions (watertight) and the
// signed volume positive (outward winding). Both halves matter: an open body
// reads as colliding downstream, and an inside-out closed one reads as empty.
const solidCheck = (g) => {
  const geo = g.children[0].geometry;
  const idx = geo.getIndex().array, pos = geo.getAttribute('position').array;
  const seen = new Map();
  let vol = 0;
  for (let t = 0; t < idx.length; t += 3) {
    const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]];
    for (const [x, y] of [[a, b], [b, c], [c, a]]) {
      const k = `${x},${y}`, r = `${y},${x}`;
      if (seen.get(r)) seen.set(r, seen.get(r) - 1); else seen.set(k, (seen.get(k) || 0) + 1);
    }
    const ax = pos[a * 3], ay = pos[a * 3 + 1], az = pos[a * 3 + 2];
    const bx = pos[b * 3], by = pos[b * 3 + 1], bz = pos[b * 3 + 2];
    const cx = pos[c * 3], cy = pos[c * 3 + 1], cz = pos[c * 3 + 2];
    vol += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
  }
  let unpaired = 0;
  for (const n of seen.values()) unpaired += n;
  return { watertight: unpaired === 0, unpaired, volume: vol };
};

// ---- the roll --------------------------------------------------------------
// Returns { pen, clear } over a full tooth pitch. `injectB` shifts B's index
// (a half pitch is the must-hit control) and `sense` flips the ratio.
const roll = (specA, specB, outA, outB, raysA, raysB,
  { injectB = 0, sense = -1, zPick = null, apexOffB = 0 } = {}) => {
  const pitchA = (Math.PI * 2) / specA.teeth, pitchB = (Math.PI * 2) / specB.teeth;
  // sample planes across A's and B's own face bands
  const shells = (s) => (zPick !== null
    ? [s.coneRi + (s.coneR - s.coneRi) * zPick]
    : Array.from({ length: BAND }, (_, i) => s.coneRi + ((s.coneR - s.coneRi) * i) / (BAND - 1)));
  const ptsA = [], ptsB = [];
  for (const rho of shells(specA))
    for (const [phi, th] of outA)
      ptsA.push([rho * Math.sin(th) * Math.cos(phi), rho * Math.sin(th) * Math.sin(phi), rho * Math.cos(th)]);
  for (const rho of shells(specB))
    for (const [phi, th] of outB)
      ptsB.push([rho * Math.sin(th) * Math.cos(phi), rho * Math.sin(th) * Math.sin(phi), rho * Math.cos(th) + apexOffB]);

  let pen = 0, clear = Infinity;
  for (let s = 0; s <= STEPS; s++) {
    const aA = (pitchA * s) / STEPS;
    const aB = pitchB / 2 + injectB + sense * (aA * specA.teeth) / specB.teeth;
    const cA = Math.cos(aA), sA = Math.sin(aA), cB = Math.cos(aB), sB = Math.sin(aB);
    // A's points, spun into world, then into B's material frame
    for (const [x, y, z] of ptsA) {
      const X = x * cA - y * sA, Y = x * sA + y * cA, Z = z;
      const [u0, v0, w0] = toB(X, Y, Z);
      const u = u0 * cB + v0 * sB, v = -u0 * sB + v0 * cB, w = w0 - apexOffB;
      if (!inBand(u, v, w, specB)) continue;
      const d = coneDist([u, v, w], raysB);
      if (underOutline(u, v, w, outB)) { if (d > pen) pen = d; }
      else if (d < clear) clear = d;
    }
    // B's points, spun into world, then into A's material frame
    for (const [u, v, w] of ptsB) {
      const u1 = u * cB - v * sB, v1 = u * sB + v * cB;
      const [X, Y, Z] = [w, -v1, u1];   // w already carries apexOffB
      const x = X * cA + Y * sA, y = -X * sA + Y * cA;
      if (!inBand(x, y, Z, specA)) continue;
      const d = coneDist([x, y, Z], raysA);
      if (underOutline(x, y, Z, outA)) { if (d > pen) pen = d; }
      else if (d < clear) clear = d;
    }
  }
  return { pen, clear };
};

const results = [];
for (const row of ROWS) {
  const specA = bevelToothSpec({ module: row.m, teeth: row.za, mateTeeth: row.zb, faceWidth: row.face ?? undefined });
  const specB = bevelToothSpec({ module: row.m, teeth: row.zb, mateTeeth: row.za, faceWidth: row.face ?? undefined });
  const outA = bevelOutline(specA), outB = bevelOutline(specB);
  const raysA = raysOf(outA), raysB = raysOf(outB);
  const eps = 0.01 * Math.PI * row.m;
  const tooth = specA.flat.addendum + specA.flat.dedendum;

  const main = roll(specA, specB, outA, outB, raysA, raysB);
  const back = roll(specA, specB, outA, outB, raysA, raysB, { zPick: 1 });
  const front = roll(specA, specB, outA, outB, raysA, raysB, { zPick: 0 });
  // THE RULED CONTROL: scale the WHOLE assembly about the shared apex and
  // every measured length must scale with it, exactly.
  //
  // This is the property that defines a straight bevel and the one the shipped
  // shear-cone form does not have. Every tooth surface is a cone of rays
  // through the apex and the angular profile does not vary with ρ, so the pair
  // is self-similar about the origin: multiply both blanks' face bands and
  // bores by k and the entire contact problem is the same problem in different
  // units. A sheared extrude is NOT self-similar — its constant thickness has
  // an absolute size that does not scale — so this control discriminates the
  // two forms directly rather than by their symptoms.
  //
  // (The first version of this control compared the front plane's clearance
  // against the back plane's, expecting the ratio zFront/zBack. It read 0.6710
  // against 0.6667 and 0.6335 against 0.6170, and the discrepancy was real: the
  // band gate is an ABSOLUTE z-window, so the two runs do not measure the same
  // surviving point set. Scaling the bands with the points is what makes the
  // identity exact instead of nearly true, and 'nearly true' is not something
  // to open a tolerance for.)
  //
  // THE RULED CONTROL'S OWN MUST-FAIL, because a control nobody has seen fire
  // is a comment. Break the ONE hypothesis it rests on — that both cones spring
  // from the same apex — by sliding B's apex along its own axis. Toward A the
  // cones overlap and the pair BURIES past its own budget; away from A it
  // loosens. The response has to be monotone in both directions: that is what
  // says the clean reading sits on a boundary rather than somewhere in a wide
  // flat region where nothing would have moved either way. It is the same
  // experiment tier three of probe-crossed-axis-mesh ran on the shear-cone
  // form, where the answer came back 0.0223 at EVERY index — burial no index
  // could change, which is what a non-ruled surface reads like.
  //
  // The bar first written here asked the away direction to RELEASE the pair
  // entirely, and it does not: measured, clearance goes 0.01265 → 0.0152, about
  // +20%, and the teeth still mesh. That was a guess about the geometry and the
  // geometry's answer is the better one — pulling the apexes apart is the
  // bevel's version of opening a spur pair's centre distance, which buys
  // backlash and does not end the mesh. So the bar is the monotone response,
  // and the toward direction is held against the pair's OWN budget ε rather
  // than a fraction of a tooth: the break has to be one this gate would fail.
  const OFF = 0.05 * specA.coneR;
  const offIn = roll(specA, specB, outA, outB, raysA, raysB, { apexOffB: -OFF });
  const offOut = roll(specA, specB, outA, outB, raysA, raysB, { apexOffB: +OFF });

  const K = 0.6180339887498949;
  const scaled = (sp) => ({ ...sp, coneRi: sp.coneRi * K, coneR: sp.coneR * K, boreR: sp.boreR * K });
  const small = roll(scaled(specA), scaled(specB), outA, outB, raysA, raysB);
  const scaleWant = K;
  const scaleGot = main.clear > 0 ? small.clear / main.clear : NaN;
  const half = roll(specA, specB, outA, outB, raysA, raysB, { injectB: Math.PI / specB.teeth });
  const wrong = roll(specA, specB, outA, outB, raysA, raysB, { sense: +1 });
  const solid = solidCheck(makeConicalGear({ teeth: row.za, module: row.m, mateTeeth: row.zb,
    faceWidth: row.face ?? undefined }));
  // What the blank REACHES from its own axis, the number the fold is priced
  // against. With the caps at a cone distance there is no overhang left to
  // report — the tip stops exactly where the mate's tooth stops — so this
  // column says how far out the metal goes instead.
  const overhang = specA.tipR;

  results.push({
    name: row.name, module: row.m,
    gammaA: +((specA.gamma * 180) / Math.PI).toFixed(3),
    gammaB: +((specB.gamma * 180) / Math.PI).toFixed(3),
    coneR: +specA.coneR.toFixed(4), faceW: +specA.faceW.toFixed(4),
    vTeethA: +specA.vTeeth.toFixed(3), vTeethB: +specB.vTeeth.toFixed(3),
    toothU: +tooth.toFixed(4),
    penU: +main.pen.toFixed(5), budgetU: +eps.toFixed(5),
    clearU: main.clear === Infinity ? null : +main.clear.toFixed(5),
    backlashU: +specA.flat.backlash.toFixed(5),
    penBackU: +back.pen.toFixed(5), penFrontU: +front.pen.toFixed(5),
    clearBackU: +back.clear.toFixed(5), clearFrontU: +front.clear.toFixed(5),
    scaleWant: +scaleWant.toFixed(9), scaleGot: +scaleGot.toFixed(9),
    reachU: +overhang.toFixed(4),
    // What Tredgold costs, in the currency the generator already spends. An
    // exactly conjugate pair rolls with backlash/2 standing off each flank, so
    // the shortfall IS the planar-cycloid-vs-spherical-cycloid error, measured
    // on the cut rather than argued. It must be smaller than backlash/2 or the
    // teeth bind — which is the same thing as min clear staying positive.
    idealClearU: +(specA.flat.backlash / 2).toFixed(5),
    profileErrU: +(specA.flat.backlash / 2 - main.clear).toFixed(5),
    ctlHalfU: +half.pen.toFixed(4), ctlWrongU: +wrong.pen.toFixed(4),
    watertight: solid.watertight, unpairedEdges: solid.unpaired, volumeU3: +solid.volume.toFixed(4),
    // the four controls, each a hard bar
    okEngages: main.clear !== Infinity && main.clear < tooth * 0.5,
    okHalf: half.pen > tooth * 0.15,
    okWrong: wrong.pen > tooth * 0.15,
    okSolid: solid.watertight && solid.volume > 0,
    offInU: +offIn.pen.toFixed(4), offOutClearU: offOut.clear === Infinity ? null : +offOut.clear.toFixed(4),
    okApex: offIn.pen > eps && offOut.clear > main.clear,
    okRuled: Math.abs(scaleGot - scaleWant) <= 1e-6 * scaleWant,
    okFree: main.clear > 0,
    pass: main.pen <= eps + 1e-9,
  });
}

const ok = (r) => r.pass && r.okEngages && r.okHalf && r.okWrong && r.okSolid && r.okRuled
  && r.okFree && r.okApex;
if (process.argv.includes('--json')) {
  console.log(JSON.stringify(results, null, 1));
  process.exit(results.every(ok) ? 0 : 1);
}
console.log('THE PAIR, FROM THE COUNTS ALONE — pitch angles, one cone distance, Tredgold\'s virtual counts\n');
console.log('pair                                m       γA      γB      coneR    face     z_vA     z_vB');
for (const r of results)
  console.log(`${r.name.padEnd(35)} ${String(r.module).padEnd(7)} ${String(r.gammaA).padEnd(7)} `
    + `${String(r.gammaB).padEnd(7)} ${String(r.coneR).padEnd(8)} ${String(r.faceW).padEnd(8)} `
    + `${String(r.vTeethA).padEnd(8)} ${String(r.vTeethB)}`);

console.log('\nTHE ROLL — worst interpenetration over a full tooth pitch, both directions\n');
console.log('pair                                worst pen   budget ε    min clear   ideal b/2   Tredgold    blank reach verdict');
for (const r of results)
  console.log(`${r.name.padEnd(35)} ${String(r.penU).padEnd(11)} ${String(r.budgetU).padEnd(11)} `
    + `${String(r.clearU).padEnd(11)} ${String(r.idealClearU).padEnd(11)} ${String(r.profileErrU).padEnd(11)} `
    + `${String(r.reachU).padEnd(11)} ${r.pass ? 'PASS' : '✗ FAIL'}`);

console.log('\nCONTROLS — a pair that never touches passes the penetration column, so these are the real bar\n');
console.log('pair                                ENGAGES(min clear)   HALF PITCH   WRONG SENSE   CLOSED SOLID     RULED (scale about the apex by k)');
for (const r of results)
  console.log(`${r.name.padEnd(35)} `
    + `${(r.clearU + (r.okEngages && r.okFree ? '  OK' : '  ✗ NEVER TOUCHES')).padEnd(20)} `
    + `${(r.ctlHalfU + (r.okHalf ? ' OK' : ' ✗')).padEnd(12)} `
    + `${(r.ctlWrongU + (r.okWrong ? ' OK' : ' ✗')).padEnd(13)} `
    + `${(r.watertight && r.volumeU3 > 0 ? `vol ${r.volumeU3} OK` : `✗ ${r.unpairedEdges} unpaired edges`).padEnd(16)} `
    + `${r.scaleGot} vs ${r.scaleWant} ${r.okRuled ? 'OK' : '✗ NOT APEX-RULED'}`);
console.log('\nAPEX MUST-FAIL — slide B\'s apex off the shared one; the pair must respond, and monotonically\n');
console.log('pair                                offset      toward: pen vs ε        away: clear vs meshed    verdict');
for (const r of results)
  console.log(`${r.name.padEnd(35)} ${String(+(0.05 * r.coneR).toFixed(4)).padEnd(11)} `
    + `${`${r.offInU} vs ${r.budgetU}`.padEnd(23)} ${`${r.offOutClearU} vs ${r.clearU}`.padEnd(24)} `
    + `${r.okApex ? 'OK' : '✗ THE APEX DID NOT MATTER'}`);

const bad = results.filter((r) => !ok(r));
console.log(`\n${results.length - bad.length}/${results.length} bevel pairs roll within the chord budget with every control firing`
  + (bad.length ? ` — ${bad.length} FAIL` : ' — the cone-cut flanks genuinely interleave and roll'));
process.exit(bad.length ? 1 : 0);
