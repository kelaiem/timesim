// THE KEYLESS FUSEE'S ROCKING BAR, DESIGNED IN A LINE (TODO 318, roadmap §334). Pure; nothing in the movement
// imports it yet. tools/probe-keyless-rocking-bar.mjs holds every row below to the constraint it is derived from.
//
// WHY A BAR AND NOT A ONE-WAY. The chain pulls the fusee arbor in the pay-out sense always: while winding the
// crown overpowers it, while running the arbor turns that way at the train's rate. So the torque at every mesh of
// the winding train has one sign in both regimes and only the MOTION reverses, and a one-way that carries winding
// locks on the running motion wherever it sits (TODO 318 has the argument). A keyless fusee therefore DISENGAGES:
// its winding wheels ride a bar pivoted on the driving wheel's arbor, a spring holds the bar out of mesh, and
// turning the crown carries it in. This module is that bar, in free space: a driver D (the transfer wheel), the
// wheels the bar carries, and a follower F (the fusee's winding spur) on a straight centre line. The fold into the
// movement is a later landing.
//
// THE PHYSICS THE ROWS ENCODE.
//  · GEOMETRY. The bar turns about D's axis, so its first wheel stays in mesh with D at every angle. Its last
//    wheel meets F at full depth at one bar angle, the ENGAGED angle, where a DEPTH BANKING stops it (any further
//    would drive the teeth past full depth). The NEUTRAL angle is the nearest one beyond it at which the last
//    wheel's tips stand CLEAR_MARGIN off F's, and a second banking stops it there.
//  · THE CARRY. A FRICTION SPRING between D's arbor and the bar gives the bar a moment M_f in whichever sense D
//    turns relative to it. The bar's side of the centre line is CHOSEN so that turning the crown to wind (D in
//    `windSense`) carries the bar from neutral to engaged. Released, the crown side is back-driven the other way
//    and the same friction carries the bar out.
//  · THE TEETH. Under load the meshes push on the carried wheels' pivots, so on the bar, with a moment k·T about
//    D's axis, T the torque at D. Because the torque has one sign whether winding or back-driven, k is the SAME in
//    both regimes (row `sameForceSystem`), so the teeth cannot tell the bar which regime it is in: only the motion
//    (through the carry) can. The bar's side must make k ENGAGING under winding, so the load holds it on its depth
//    banking rather than kicking it out.
//  · THE SPRING'S WINDOW, in TODO 16's format. The return spring's moment M_s must exceed the bar's own weight at
//    its worst attitude (or the bar falls into mesh in a pocket), and must stay under M_f (or turning the crown
//    cannot carry it in). M_f must stay under the drag one more plain pivot under the winding load would cost, the
//    most a carry may add to winding effort here. Each is placed at the RATIO middle of its window, which makes the
//    worst ratio margin as large as it can be. Released, the bar lets go of any crown-side drag up to
//    (M_s + M_f)/k at D: reported, because the watch's crown-side drag is load-proportional friction and the
//    movement models no load-independent part (a case-tube gasket, a finger left on the crown).
//  · SENSE. Each mesh reverses. The direct routing (transfer straight onto the spur) is ONE mesh, so a bar that
//    keeps the winding sense at the crown needs an odd number of meshes in all, which is an even number of carried
//    wheels: two. A one-wheel bar reverses it. The idler routing already carries one idler, so a one-wheel bar
//    there keeps the sense. Idlers cancel from the ratio either way.
//
// WHAT THIS LANDING DOES NOT CLAIM. Modelled, not simulated: the bar is placed at its two bankings, nothing steps
// it. The bar's own section (P1) is a placeholder plate in the weight row only; its blade spring and friction
// spring are moments here, not cut metal. Tip-on-tip arrival as the last wheel swings in, and shock, are not
// covered. The two search snippets that ground the mechanism are quoted in TODO 318 and still owe a full read.
import { gearToothSpec } from './geometry.js';
import { KW_MODULE, crownWheelTeeth, WIND_SPUR_TEETH, KW_WIND_IDLER_TEETH, CLEAR_MARGIN, UNIT_MM, FRICTION, STOCK }
  from './layout.js';

const G_ACC = 9.80665;   // m/s², standard gravity

// INPUT rows, each with where its value comes from. A fork overrides these and nothing else.
export const ROCKING_BAR_INPUTS = Object.freeze({
  module: { v: KW_MODULE, why: 'the keyless works\' module (KW_MODULE)' },
  driverTeeth: { v: crownWheelTeeth, why: 'the transfer wheel, keyed to the crown wheel (crownWheelTeeth)' },
  followerTeeth: { v: WIND_SPUR_TEETH, why: 'the fusee\'s winding spur (WIND_SPUR_TEETH)' },
  carried: { v: { one: [KW_WIND_IDLER_TEETH], two: [KW_WIND_IDLER_TEETH, KW_WIND_IDLER_TEETH] },
    why: 'the keyless family\'s idler (KW_WIND_IDLER_TEETH), one wheel or two' },
  // the default build's routing is DIRECT: transfer and spur at one mesh distance (layout.js solveKeyless)
  centreDistance_u: { v: (KW_MODULE * (crownWheelTeeth + WIND_SPUR_TEETH)) / 2,
    why: 'the default build\'s transfer-to-spur distance, module·(20 + 24)/2 (solveKeyless, direct routing)' },
  windSense: { v: +1, why: 'D turns counter-clockwise in the line\'s own frame to wind; the fold maps it' },
  fuseeTorque_Nmm: { v: 1.76029057487366,
    why: 'GOING_POWER.fuseeTorque_Nm × 1000, read off the default build\'s equalisation record at main 196e37e3; the fold reads it live' },
  stock_u: { v: 0.725, why: 'the winding band\'s stock (WIND_T in main.js), the bar and its wheels cut from it' },
  pivotR_u: { v: 0.7, why: 'the winding train\'s bore radius (the spur\'s boreR), the bar\'s bearing on D\'s arbor' },
});

const rot = (x, y, a) => ({ x: x * Math.cos(a) - y * Math.sin(a), y: x * Math.sin(a) + y * Math.cos(a) });
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const len = (a) => Math.hypot(a.x, a.y);
const cross = (a, b) => a.x * b.y - a.y * b.x;
const unit = (a) => { const l = len(a); return { x: a.x / l, y: a.y / l }; };

// One bar: every row derived from the inputs. `variant` is 'one' or 'two'; `side` (±1, or null to let the carry
// rule choose) exists so a control can build the mirrored bar and watch it fail.
export function solveRockingBar(variant = 'two', over = {}, side = null) {
  const I = Object.fromEntries(Object.entries(ROCKING_BAR_INPUTS).map(([k, r]) => [k, k in over ? over[k] : r.v]));
  const m = I.module, nD = I.driverTeeth, nF = I.followerTeeth, wheels = I.carried[variant];
  if (!wheels) throw new Error(`no carried-wheel variant '${variant}'`);
  const chain = [nD, ...wheels, nF];
  const spec = chain.map((n, i) => gearToothSpec({ module: m, teeth: n,
    mates: [chain[i - 1], chain[i + 1]].filter((x) => x !== undefined).map((t) => ({ teeth: t, mates: [n] })) }));
  const D = { x: 0, y: 0 }, F = { x: I.centreDistance_u, y: 0 };
  const c = chain.slice(1).map((n, i) => (m * (chain[i] + n)) / 2);   // centre distance of each mesh, in order
  const last = wheels.length;                                           // index of the last carried wheel in `chain`

  // The bar's wheels as a function of its angle φ (the first wheel's azimuth about D). A two-wheel bar's second
  // wheel sits at a BEND β off the first's line, fixed in the bar; β is derived below.
  const centres = (phi, beta) => {
    const P = [D];
    let p = { x: c[0] * Math.cos(phi), y: c[0] * Math.sin(phi) };
    P.push(p);
    for (let i = 1; i < wheels.length; i++) {
      const dir = phi + beta;
      p = { x: p.x + c[i] * Math.cos(dir), y: p.y + c[i] * Math.sin(dir) };
      P.push(p);
    }
    P.push(F);
    return P;
  };
  // gap between the last carried wheel's tips and F's (negative = the teeth overlap)
  const gapLF = (P) => len(sub(P[last], F)) - spec[last].tipR - spec[last + 1].tipR;
  const depthErr = (P) => len(sub(P[last], F)) - c[last];

  // Clearances the bar must keep that are NOT meshes: every pair of chain members not adjacent in the chain.
  const pairClear = (P) => {
    let worst = { gap: Infinity, pair: null };
    for (let i = 0; i < P.length; i++) for (let j = i + 2; j < P.length; j++) {
      if (i === 0 && j === P.length - 1) continue;   // D and F: fixed by the routing, not by the bar
      if (i === last && j === last + 1) continue;
      const g = len(sub(P[i], P[j])) - spec[i].tipR - spec[j].tipR;
      if (g < worst.gap) worst = { gap: g, pair: [chain[i], chain[j], i, j] };
    }
    return worst;
  };

  // ENGAGED ANGLE: the bar angle where the last wheel stands at F's mesh distance, on a given side of the centre
  // line. Bisection on the side's half-turn: depthErr runs from short (bar pointing at F) to long (pointing away).
  const engagedAt = (beta, s) => {
    let lo = 0, hi = Math.PI, f = (t) => depthErr(centres(s * t, beta));
    if (f(lo) * f(hi) > 0) return null;
    for (let k = 0; k < 200; k++) { const mid = (lo + hi) / 2; if (f(lo) * f(mid) <= 0) hi = mid; else lo = mid; }
    return s * ((lo + hi) / 2);
  };
  // The carry rule: from neutral the bar must swing in `windSense` to engage. The engaged root on side s has the
  // bar's depth growing as it turns away from F (|φ| growing), so neutral lies at larger |φ| and the swing in is
  // toward smaller |φ|, i.e. in −s. So s = −windSense.
  const s = side ?? -I.windSense;

  // BEND (two-wheel bars): the β that keeps the worst non-mesh clearance largest at the engaged angle, the
  // roomiest bar. A one-wheel bar has no bend.
  let beta = 0;
  if (wheels.length > 1) {
    let best = -Infinity;
    for (let k = -1800; k <= 1800; k++) {
      const b = (k / 1800) * Math.PI;
      const phi = engagedAt(b, s);
      if (phi === null) continue;
      const g = pairClear(centres(phi, b)).gap;
      if (g > best) { best = g; beta = b; }
    }
  }
  const phiE = engagedAt(beta, s);
  if (phiE === null) return { feasible: false, variant, why: 'the last wheel cannot reach F\'s mesh distance on this side' };
  const PE = centres(phiE, beta);

  // NEUTRAL: the swing past engaged (away from F, so in +s) that stands the tips CLEAR_MARGIN apart.
  let lo = 0, hi = Math.PI / 2;
  for (let k = 0; k < 200; k++) { const mid = (lo + hi) / 2; if (gapLF(centres(phiE + s * mid, beta)) < CLEAR_MARGIN) lo = mid; else hi = mid; }
  const swing = hi, phiN = phiE + s * swing, PN = centres(phiN, beta);

  // THE TEETH ON THE BAR. A mesh A→B (A driving B in winding) pushes B at the pitch point along A's surface
  // velocity, tilted by the pressure angle α toward or away from B's centre (a cycloidal face's tilt changes over
  // the contact, so every corner −αmax, 0, +αmax is enumerated, mesh by mesh). Pivots frictionless: each wheel's
  // two tooth forces carry the same torque at its pitch radius. The bar takes each carried wheel's net force at
  // its centre; its moment about D, per unit torque at D, is k.
  const meshes = chain.length - 1;
  const senseOf = (i, regimeMotion) => regimeMotion * I.windSense * (i % 2 === 0 ? 1 : -1);   // each mesh reverses
  const kAt = (P, alphas, regime) => {
    // regime 'wind': motion in the winding sense, torque flowing D→F. 'run': the crown side back-driven, the
    // motion reversed and torque flowing F→D. Either way the force on the downstream member of each mesh is
    // built from the DRIVING member's surface velocity. 'torqueReversed' (the winding motion with torque flowing
    // F→D, which no regime of the watch produces) exists only so a control can show the sign follows the torque.
    const motion = regime === 'run' ? -1 : 1;
    const Fmag = 1 / ((spec[0].pitchR) * UNIT_MM);   // per N·mm at D, in N (pitch radius in mm)
    const net = P.map(() => ({ x: 0, y: 0 }));
    for (let i = 0; i < meshes; i++) {
      const a = alphas[i];
      const [drv, fol] = regime === 'wind' ? [i, i + 1] : [i + 1, i];
      const uDF = unit(sub(P[fol], P[drv]));
      const sDrv = senseOf(drv, motion);
      const t = { x: -uDF.y * sDrv, y: uDF.x * sDrv };   // the driving member's surface velocity at the pitch point
      const f = { x: Fmag * (t.x * Math.cos(a) + uDF.x * Math.sin(a)), y: Fmag * (t.y * Math.cos(a) + uDF.y * Math.sin(a)) };
      net[fol].x += f.x; net[fol].y += f.y;        // on the follower
      net[drv].x -= f.x; net[drv].y -= f.y;        // and its reaction on the driver
    }
    let M = 0;   // N·mm per N·mm: forces in N, arms in mm
    for (let i = 1; i <= last; i++) M += cross({ x: P[i].x * UNIT_MM, y: P[i].y * UNIT_MM }, net[i]);
    return M;
  };
  const corners = [];
  const amax = (i) => Math.max(spec[i].maxPressureAngle, spec[i + 1].maxPressureAngle);
  for (let code = 0; code < Math.pow(3, meshes); code++) {
    const al = []; let q = code;
    for (let i = 0; i < meshes; i++) { al.push((q % 3 - 1) * amax(i)); q = Math.floor(q / 3); }
    corners.push({ alphas: al, kWind: kAt(PE, al, 'wind'), kRun: kAt(PE, al, 'run') });
  }
  // engaging = the swing-in sense (−s); a positive kEngaging pushes the bar onto its depth banking under winding
  const kEng = corners.map((r) => -s * r.kWind);
  const kMin = Math.min(...kEng), kMax = Math.max(...kEng);
  const sameForceSystem = Math.max(...corners.map((r) => Math.abs(r.kWind - r.kRun)));

  // THE WINDOW. Torque at D while winding, lossless (the hold needs the smallest it can be): the fusee's torque
  // through the bar's ratio, driver over follower.
  const Tw = I.fuseeTorque_Nmm * (nD / nF);
  // the carry's ceiling: one more plain pivot carrying D's mesh load at the bar's bearing radius, adverse corner
  const meshLoad_N = Tw / (spec[0].pitchR * UNIT_MM);
  const MfMax = FRICTION.muPlain.adverse * meshLoad_N * I.pivotR_u * UNIT_MM;   // N·mm
  // the floor: the bar's own weight at its worst attitude. Wheels as solid discs of the band's stock; the bar as a
  // plate one stock thick and one smallest-idler radius wide along its two arms (P1 owes the real section).
  const rho = STOCK.steel.rho, t_m = I.stock_u * UNIT_MM * 1e-3, mm = (u) => u * UNIT_MM * 1e-3;
  let mass = 0, mom = { x: 0, y: 0 };
  const addMass = (kg, at) => { mass += kg; mom.x += kg * at.x; mom.y += kg * at.y; };
  for (let i = 1; i <= last; i++) addMass(rho * Math.PI * Math.pow(mm(spec[i].pitchR), 2) * t_m, PE[i]);
  const barW = Math.min(...wheels.map((n) => (m * n) / 2));
  for (let i = 1; i <= last; i++) {
    const a = PE[i - 1 === 0 ? 0 : i - 1], b = PE[i];
    addMass(rho * mm(len(sub(b, a))) * mm(barW) * t_m, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  }
  const arm_m = Math.hypot(mom.x, mom.y) / mass * UNIT_MM * 1e-3;
  const Mg = mass * G_ACC * arm_m * 1000;   // N·mm, the bar's centre of mass horizontal of D
  // ratio middles: the spring between the weight and the carry, the carry between the spring and its ceiling,
  // solved together so the two margins are equal ratios: Ms = Mg·q, Mf = Ms·q, MfMax = Mf·q → q = (MfMax/Mg)^(1/3)
  const q = Math.cbrt(MfMax / Mg);
  const Ms = Mg * q, Mf = Ms * q;
  const releaseLimit_Nmm = (Ms + Mf) / kMax;   // crown-side drag at D the bar still lets go of

  const parity = meshes % 2;   // 1 = odd meshes = the direct routing's sense
  return {
    feasible: true, variant, inputs: I, chain, spec, side: s, beta, centres, engagedAt, pairClear, gapLF, kAt,
    engaged: { phi: phiE, centres: PE, depthErr: depthErr(PE), clear: pairClear(PE) },
    neutral: { phi: phiN, centres: PN, gap: gapLF(PN), clear: pairClear(PN) },
    swing, carrySense: Math.sign(phiE - phiN), corners, kMin, kMax, sameForceSystem,
    window: { Tw_Nmm: Tw, MfMax_Nmm: MfMax, Mg_Nmm: Mg, Ms_Nmm: Ms, Mf_Nmm: Mf, q, releaseLimit_Nmm, mass_kg: mass },
    sense: { meshes, sameAsDirect: parity === 1 },
    ratio: nD / nF,
  };
}
