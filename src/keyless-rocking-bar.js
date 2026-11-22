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
// LANDING 2 (§334): THE METAL, still in the line. The bar's in-plane width from the moment and push the tooth loads put
// along it (SPRING_SIGMA_Y_PA, floored at §50); each carried wheel's pin by TODO 193's law; the two bankings one pin,
// the last wheel's arbor run into an arc slot whose ends stand the swing apart; the return blade a cantilever of the
// ribbons' alloy at the flat-blade floor bearing on the bar's boss; the friction carry a two-jaw clip on D's arbor
// sized over muPlain's band. The window is re-solved with all of it: the blade's rise and the band's spread are fixed
// ratios inside it, and the three margins left are equal.
//
// LANDING 3a: the transfer stands CLEAR of the spur (RB16), so the centre distance is derived rather than the direct
// routing's 7.48, where the two still mesh and the bar would be bypassed.
//
// WHAT THIS DOES NOT CLAIM. Modelled, not simulated: the bar is placed at its two bankings, nothing steps it. The load
// is the fusee's torque at D, the one the watch already sizes its winding train to; what a hand can add at the winding
// stop is declared nowhere in the movement and is not priced. The clip's interference (about 6 µm a jaw) is reported,
// not judged, for want of a tolerance to judge it by. Shock is not covered. The two search snippets that ground the
// mechanism are quoted in TODO 318 and still owe a full read.
import { gearToothSpec, gearOuterR, gearBevel } from './geometry.js';
import { KW_MODULE, crownWheelTeeth, windPinionTeeth, WIND_SPUR_TEETH, KW_WIND_IDLER_TEETH, CLEAR_MARGIN, UNIT_MM,
  FRICTION, STOCK, STOCK_MIN_U, SPRING_FLAT_U, SPRING_SIGMA_Y_PA, MAINSPRING_SIGMA_Y_PA, MAINSPRING_E_PA, PIVOT_BORE_CLEAR, PIVOT_MIN_U } from './layout.js';

const G_ACC = 9.80665;   // m/s², standard gravity

// INPUT rows, each with where its value comes from. A fork overrides these and nothing else.
export const ROCKING_BAR_INPUTS = Object.freeze({
  module: { v: KW_MODULE, why: 'the keyless works\' module (KW_MODULE)' },
  driverTeeth: { v: crownWheelTeeth, why: 'the transfer wheel, keyed to the crown wheel (crownWheelTeeth)' },
  followerTeeth: { v: WIND_SPUR_TEETH, why: 'the fusee\'s winding spur (WIND_SPUR_TEETH)' },
  carried: { v: { one: [KW_WIND_IDLER_TEETH], two: [KW_WIND_IDLER_TEETH, KW_WIND_IDLER_TEETH] },
    why: 'the keyless family\'s idler (KW_WIND_IDLER_TEETH), one wheel or two' },
  // null = DERIVED: the nearest the transfer can stand to the spur with their tips CLEAR_MARGIN apart. Landings 1 and
  // 2 took the default build's direct-routing distance, module·(20 + 24)/2 = 7.48, where the two still MESH: the bar
  // would be bypassed and the crown would go on turning. pairClear skipped that pair as "fixed by the routing", which
  // is how it passed. A fork may set a larger distance (an idler routing's); a smaller one fails RB16.
  centreDistance_u: { v: null, why: 'the transfer moved out from the spur until their tips clear by CLEAR_MARGIN (RB16)' },
  windSense: { v: +1, why: 'D turns counter-clockwise in the line\'s own frame to wind; the fold maps it' },
  fuseeTorque_Nmm: { v: 1.76029057487366,
    why: 'GOING_POWER.fuseeTorque_Nm × 1000, read off the default build\'s equalisation record at main 196e37e3; the fold reads it live' },
  stock_u: { v: 0.725, why: 'the winding band\'s stock (WIND_T in main.js), the bar and its wheels cut from it' },
  pivotR_u: { v: 0.7, why: 'the winding train\'s bore radius (the spur\'s boreR), the bar\'s bearing on D\'s arbor' },
  bladeH_u: { v: SPRING_FLAT_U, why: 'the movement\'s flat-blade floor (SPRING_FLAT_U, 0.05 mm), which every blade spring here is cut to' },
  bendDeg: { v: null, why: 'a two-wheel bar\'s bend between its arms, degrees; null = DERIVED (the roomiest: its non-meshing members farthest apart). The fold forks it where the movement\'s metal forces another' },
  armBends: { v: null, why: 'each arm\'s sideways bow at its middle, u (left of the arm\'s run positive); null = straight. The fold sets them to route an arm round metal it meets (the owner\'s rule: a link yields), never the wheels\' centres' },
  bladeLever_u: { v: null, why: 'the blade\'s contact radius on the bar, u; null = the boss edge (pivotR + w). The under-plate fold sets it where its ear\'s face carries the contact (§334 landing 5c)' },
  bladeAt: { v: 'boss', why: 'where the return blade bears: the bar\'s boss round D, the smallest lever (\'firstWheel\' is landing 2\'s first draft, kept for the control)' },
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
  // THE REACH every clearance is judged at: the CUT wheel's, its tip plus the edge bevel that stands proud of it
  // (gearOuterR, the bound the cut wheels are held to, §115). Landing 3c's corrected probe found the moved transfer
  // 0.093 u off the spur where this solve said 0.15: the line judged at the bare tip circle.
  const reach = chain.map((n, i) => gearOuterR({ module: m, teeth: n, thickness: I.stock_u,
    mates: [chain[i - 1], chain[i + 1]].filter((x) => x !== undefined).map((t) => ({ teeth: t, mates: [n] })) }));
  // THE TRANSFER STANDS CLEAR OF THE SPUR: the bar must be the only path between them.
  const dClear = reach[0] + reach[reach.length - 1] + CLEAR_MARGIN;
  if (I.centreDistance_u === null) I.centreDistance_u = dClear;
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
  const gapLF = (P) => len(sub(P[last], F)) - reach[last] - reach[last + 1];
  const depthErr = (P) => len(sub(P[last], F)) - c[last];

  // Clearances the bar must keep that are NOT meshes: every pair of chain members not adjacent in the chain.
  const pairClear = (P) => {
    let worst = { gap: Infinity, pair: null };
    for (let i = 0; i < P.length; i++) for (let j = i + 2; j < P.length; j++) {
      if (i === 0 && j === P.length - 1) continue;   // D and F: fixed by the routing, not by the bar
      if (i === last && j === last + 1) continue;
      const g = len(sub(P[i], P[j])) - reach[i] - reach[j];
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
  // roomiest bar, AMONG the bends at which the load holds the bar on its depth banking (RB4: k > 0 at every
  // pressure-angle corner). Landing 3c added the second clause: the reference's two 18T idlers met it at their roomiest
  // bend by luck, and a 12 + 10 bar does not (79.2°, k down to −0.25: the mesh would throw the bar out). Each
  // candidate is solved whole at its bend, roomiest first, and the first that holds is taken. A one-wheel bar has no bend.
  let beta = 0;
  if (wheels.length > 1 && I.bendDeg !== null) beta = I.bendDeg * Math.PI / 180;
  else if (wheels.length > 1) {
    const cand = [];
    for (let k = -1800; k <= 1800; k++) {
      const b = (k / 1800) * Math.PI;
      const phi = engagedAt(b, s);
      if (phi === null) continue;
      cand.push({ k, g: pairClear(centres(phi, b)).gap });
    }
    cand.sort((a, b) => b.g - a.g || a.k - b.k);
    const held = cand.find((c) => { const q = solveRockingBar(variant, { ...over, bendDeg: c.k / 10 }, side); return q.feasible && q.kMin > 0; });
    if (!held) return { feasible: false, variant, why: 'no bend lets the load hold the bar on its depth banking' };
    beta = (held.k / 1800) * Math.PI;
  }
  const phiE = engagedAt(beta, s);
  if (phiE === null) return { feasible: false, variant, why: 'the last wheel cannot reach F\'s mesh distance on this side' };
  const PE = centres(phiE, beta);
  // THE ARMS as cut: wheel centre to wheel centre, each bowed sideways at its middle by its armBends row. A bow moves
  // metal, never a centre, so the gearing is untouched; what it costs is the bending its offset adds, which the
  // section below reads off the same polyline.
  const bends = I.armBends ?? wheels.map(() => 0);
  const armPath = (P, j) => {   // arm j runs from P[j] to P[j + 1]
    const a = P[j], b = P[j + 1], h = bends[j] || 0;
    if (!h) return [a, b];
    const u = unit(sub(b, a));
    return [a, { x: (a.x + b.x) / 2 - u.y * h, y: (a.y + b.y) / 2 + u.x * h }, b];
  };

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
  const forcesAt = (P, alphas, regime) => {
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
    return { M, net };
  };
  const kAt = (P, alphas, regime) => forcesAt(P, alphas, regime).M;
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

  // THE LOAD every part is sized to: the torque at D while winding, the fusee's through the bar's ratio, lossless.
  // It is the load the watch already sizes its winding train to (the geared stop-work takes the fusee's torque as
  // its stall). What a hand can add at the winding stop is declared nowhere in the movement and is not priced here.
  const Tw = I.fuseeTorque_Nmm * (nD / nF);
  const mmOf = (u) => u * UNIT_MM;
  const sigY = SPRING_SIGMA_Y_PA / 1e6;                 // N/mm², the bar and its pins (steel)
  const sigSpring = MAINSPRING_SIGMA_Y_PA / 1e6, Esp = MAINSPRING_E_PA / 1e6;   // the blades: the ribbons' alloy, low end
  const tBar = mmOf(I.stock_u), hBlade = mmOf(I.bladeH_u);
  const pinLaw = (F_N, lever_mm) => Math.max(mmOf(STOCK_MIN_U), Math.cbrt(32 * F_N * lever_mm / (Math.PI * sigY)));   // TODO 193's pivot law

  // THE BANKINGS are one pin: the last wheel's arbor, run through the bar into an arc slot in the plate about D's
  // axis. The slot's ends are the depth banking and the neutral banking, so the angle between them IS the swing,
  // and the end walls (radial lines) push the pin tangentially.
  const B = PE[last], Bmm = { x: mmOf(B.x), y: mmOf(B.y) };
  const tB = { x: -Bmm.y / len(Bmm), y: Bmm.x / len(Bmm) };
  const metalAt = (alphas, T) => {
    const { net } = forcesAt(PE, alphas, 'wind');
    const Fw = net.map((f) => ({ x: f.x * T, y: f.y * T }));
    let Mw = 0;
    for (let i = 1; i <= last; i++) Mw += cross({ x: mmOf(PE[i].x), y: mmOf(PE[i].y) }, Fw[i]);
    const fb = -Mw / cross(Bmm, tB);                     // the depth banking's reaction, tangential at the pin
    const Fb = { x: fb * tB.x, y: fb * tB.y };
    // bending along the bar's centre line (D → wheel 1 → wheel 2): at each section, the moment and the axial load of
    // everything outboard of it (the wheels beyond, and the banking at the end)
    let Mmax = 0, Nmax = 0;
    for (let seg = 1; seg <= last; seg++) for (const [A0, C0] of armPath(PE, seg - 1).slice(0, -1).map((q, k, arr) => [q, armPath(PE, seg - 1)[k + 1]])) {
      const A = { x: mmOf(A0.x), y: mmOf(A0.y) }, C = { x: mmOf(C0.x), y: mmOf(C0.y) };
      const u = unit(sub(C, A));
      for (let k = 0; k <= 200; k++) {
        const X = { x: A.x + (C.x - A.x) * k / 200, y: A.y + (C.y - A.y) * k / 200 };
        let M = cross(sub(Bmm, X), Fb), Fx = Fb.x, Fy = Fb.y;
        for (let i = seg; i <= last; i++) { const Pi = { x: mmOf(PE[i].x), y: mmOf(PE[i].y) }; M += cross(sub(Pi, X), Fw[i]); Fx += Fw[i].x; Fy += Fw[i].y; }
        Mmax = Math.max(Mmax, Math.abs(M)); Nmax = Math.max(Nmax, Math.abs(Fx * u.x + Fy * u.y));
      }
    }
    return { Fw, Fb, fb: Math.abs(fb), Mmax, Nmax };
  };
  const sizeMetal = (T) => {
    let Mmax = 0, Nmax = 0, Fpin = wheels.map(() => 0), Fbank = 0;
    for (const r of corners) {
      const g = metalAt(r.alphas, T);
      Mmax = Math.max(Mmax, g.Mmax); Nmax = Math.max(Nmax, g.Nmax); Fbank = Math.max(Fbank, g.fb);
      for (let i = 1; i <= last; i++) Fpin[i - 1] = Math.max(Fpin[i - 1], len(g.Fw[i]));
    }
    // in-plane bending of a plate `tBar` thick: σ = 6M/(t·w²) + N/(t·w). The width that works at σ_y under BOTH is
    // the root of σ_y·t·w² − N·w − 6M = 0 (first draft solved the bending alone and the axial term then carried the
    // two-wheel bar to 811 MPa); floored at §50.
    const wLoad = (Nmax + Math.sqrt(Nmax * Nmax + 24 * sigY * tBar * Mmax)) / (2 * sigY * tBar);
    const w = Math.max(mmOf(STOCK_MIN_U), wLoad);
    const sigma = 6 * Mmax / (tBar * w * w) + Nmax / (tBar * w);
    // each carried wheel turns on a pin riveted in the bar, loaded at the wheel's mid-plane: half the bar, the
    // margin, half the wheel; the last wheel's pin also takes the banking, a margin below the bar in the slot
    const lever = tBar + mmOf(CLEAR_MARGIN);
    const pins = Fpin.map((F, i) => ({ F_N: F, d_mm: pinLaw(F + (i === last - 1 ? Fbank : 0), lever) }));
    return { Mmax, Nmax, Fbank, wLoad, w, sigma, pins, lever };
  };
  const metal = sizeMetal(Tw);
  const rC0 = mmOf(I.pivotR_u);                          // the bar's bore on D's arbor

  // THE WEIGHT, from the metal: the wheels as solid discs of the band's stock (an upper bound), the bar as its arms
  // at the solved width plus a boss of the same width round each bore.
  const rho = STOCK.steel.rho, mKg = (vol_mm3) => rho * vol_mm3 * 1e-9;
  let mass = 0, mom = { x: 0, y: 0 };
  const addMass = (kg, at) => { mass += kg; mom.x += kg * mmOf(at.x); mom.y += kg * mmOf(at.y); };
  for (let i = 1; i <= last; i++) addMass(mKg(Math.PI * Math.pow(mmOf(spec[i].pitchR), 2) * tBar), PE[i]);
  for (let i = 1; i <= last; i++) {
    const path = armPath(PE, i - 1);
    for (let k = 1; k < path.length; k++) {
      const a = path[k - 1], b = path[k];
      addMass(mKg(mmOf(len(sub(b, a))) * metal.w * tBar), { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    }
  }
  const boss = (rBore) => mKg(Math.PI * (Math.pow(rBore + metal.w, 2) - rBore * rBore) * tBar);
  addMass(boss(mmOf(I.pivotR_u)), D);
  for (let i = 1; i <= last; i++) addMass(boss(metal.pins[i - 1].d_mm / 2), PE[i]);
  const arm_mm = Math.hypot(mom.x, mom.y) / mass;
  const Mg = mass * G_ACC * arm_mm;                     // N·mm: the centre of mass horizontal of D

  // THE CARRY'S CEILING: one more plain pivot carrying D's mesh load at the bar's bearing radius, adverse corner
  const meshLoad_N = Tw / mmOf(spec[0].pitchR);
  const rC = rC0;
  const MfMax = FRICTION.muPlain.adverse * meshLoad_N * rC;

  // THE RETURN BLADE: a uniform cantilever of the ribbons' alloy from a stud on the plate, its tip on the bar's boss
  // round D, square to the radius there. Swinging in deflects it further by that radius times the swing, so its
  // moment RISES by k·swing·r²: the bar's own boss edge is the smallest lever there is (first draft: the first
  // wheel's boss, whose rise outgrew the carry and closed the window, q 0.21), and a blade as long as the bar reaches
  // and as thin as the flat-blade floor is the softest one. One band stock deep.
  const rS = I.bladeLever_u != null ? mmOf(I.bladeLever_u) : I.bladeAt === 'boss' ? rC0 + metal.w : mmOf(c[0]), Lb = I.bladeAt === 'boss' ? len(Bmm) : mmOf(c[0]);
  const Ib = tBar * Math.pow(hBlade, 3) / 12, kB = 3 * Esp * Ib / Math.pow(Lb, 3);   // N/mm
  const dSwing = rS * swing;                            // mm of extra deflection, neutral → engaged
  // THE FRICTION CARRY: a two-jaw clip in the bar's boss gripping D's arbor at the bore radius, each jaw a quarter
  // round of the bore long, as thin as §50 allows. Its friction is muPlain's band (steel on oiled steel): the slip
  // torque must clear the spring at the LOW corner and stay under the ceiling at the HIGH one.
  const muLo = FRICTION.muPlain.favourable, muNom = FRICTION.muPlain.nominal, muHi = FRICTION.muPlain.adverse;
  const Lc = Math.PI * rC / 2;

  // THE WINDOW, solved with the metal: weight < spring at neutral < spring at engaged < carry at its low corner <
  // carry at its high corner < ceiling. The two fixed ratios are the spring's rise (from its rate and preload) and
  // the friction band's spread; the three free margins are made equal: q³ = MfMax / (Mg · rise · μhi/μlo). The
  // rise depends on the preload, so the two are iterated together.
  let rise = 1, q = 1, Ms = 0;
  for (let it = 0; it < 100; it++) {
    q = Math.cbrt(MfMax / (Mg * rise * (muHi / muLo)));
    Ms = Mg * q;
    const d0 = (Ms / rS) / kB;
    const nr = (d0 + dSwing) / d0;
    if (Math.abs(nr - rise) < 1e-15) { rise = nr; break; }
    rise = nr;
  }
  const MsE = Ms * rise, MfLo = MsE * q, MfHi = MfLo * (muHi / muLo), MfNom = MfLo * (muNom / muLo);
  const F0 = Ms / rS, d0 = F0 / kB, FE = MsE / rS;
  const blade = { lever_mm: rS, L_mm: Lb, h_mm: hBlade, b_mm: tBar, k_Npmm: kB, preload_mm: d0, swing_mm: dSwing, F0_N: F0, FE_N: FE,
    sigmaE: 6 * FE * Lb / (tBar * hBlade * hBlade), sigmaLimit: sigSpring };
  const Nc = MfLo / (muLo * rC);                       // the clip's total grip
  // each jaw as thin as its own grip lets it work at the alloy's low end, floored at the flat-blade floor: the
  // thinnest jaw needs the most interference, which is the easiest to hold to a tolerance
  const hC = Math.max(mmOf(SPRING_FLAT_U), Math.sqrt(6 * (Nc / 2) * Lc / (tBar * sigSpring)));
  const Ic = tBar * Math.pow(hC, 3) / 12;
  const clip = { r_mm: rC, jawL_mm: Lc, h_mm: hC, N_N: Nc, interference_mm: (Nc / 2) * Math.pow(Lc, 3) / (3 * Esp * Ic),
    sigma: 6 * (Nc / 2) * Lc / (tBar * hC * hC), sigmaLimit: sigSpring };
  const releaseLimit_Nmm = (MsE + MfLo) / kMax;        // at engaged, the weakest the spring and carry can be

  // TIP ON TIP. As the bar swings in, the last wheel's tips may land on F's. The wheel is still turning (D drives
  // it while the crown winds), so its tip slides off within one pitch, as long as D's torque beats the tip's
  // friction under the carry's push. The push: the strongest carry over the moment arm of the centre line about D.
  const uLF = unit(sub(F, PE[last]));
  const armTip = Math.abs(cross({ x: mmOf(PE[last].x), y: mmOf(PE[last].y) }, uLF));
  const Ntip = MfHi / armTip;
  const tipTorqueAtD = FRICTION.muTooth.adverse * Ntip * mmOf(spec[last].tipR) * (nD / chain[last]);
  const tip = { push_N: Ntip, tipTorqueAtD_Nmm: tipTorqueAtD, margin: Tw / tipTorqueAtD,
    crownTurnDeg: 360 * (1 / nD) * (crownWheelTeeth / windPinionTeeth) };   // one pitch of the last wheel, at the stem

  const slot = { r_mm: len(Bmm), pinD_mm: metal.pins[last - 1].d_mm, travel_mm: len(Bmm) * swing,
    width_mm: metal.pins[last - 1].d_mm + 2 * mmOf(PIVOT_BORE_CLEAR) };

  const parity = meshes % 2;   // 1 = odd meshes = the direct routing's sense
  return {
    feasible: true, variant, inputs: I, chain, spec, dClear, gapDF: I.centreDistance_u - reach[0] - reach[reach.length - 1], reach, side: s, beta, centres, engagedAt, pairClear, gapLF, kAt,
    engaged: { phi: phiE, centres: PE, depthErr: depthErr(PE), clear: pairClear(PE) },
    neutral: { phi: phiN, centres: PN, gap: gapLF(PN), clear: pairClear(PN) },
    swing, carrySense: Math.sign(phiE - phiN), corners, kMin, kMax, sameForceSystem,
    window: { Tw_Nmm: Tw, MfMax_Nmm: MfMax, Mg_Nmm: Mg, Ms_Nmm: Ms, MsE_Nmm: MsE, MfLo_Nmm: MfLo, MfNom_Nmm: MfNom,
      MfHi_Nmm: MfHi, rise, muSpread: muHi / muLo, q, releaseLimit_Nmm, mass_kg: mass },
    metal, blade, clip, tip, slot, sizeMetal, armPath,
    sense: { meshes, sameAsDirect: parity === 1 },
    ratio: nD / nF,
  };
}

// THE FOLD'S PLAN (§334 landing 3b): the bar placed in the movement, still nothing cut. The bar's wheels share the
// winding band with the spur; the bar's plate and its return blade sit in a POCKET milled into the base plate's top
// face under them (the owner's choice, 2026-11-19: the band has no stratum for the plate, the great wheel overhangs it).
//  · PLACEMENT. The transfer moves out along its line from the spur to the derived centre distance (RB16). The bar's
//    side follows the WORLD winding sense: the line spec is solved for the transfer winding counter-clockwise in its
//    own frame, so the frame's y is mirrored when the movement winds it clockwise.
//  · THE RETURN BLADE presses a PIN set in the bar's boss edge (a blade on the round boss would push at the pivot and
//    turn nothing). Its force is square to the radius there, so the blade lies ALONG that radius, from the pin out to
//    its stud; where round the boss the pin goes is free, and the plan takes the azimuth whose blade stands farthest
//    from everything else the pocket must clear.
//  · ARMS ROUTED ROUND METAL. Where an arm's pocket would leave less than `landMin` of plate to an opening already
//    cut, the arm is bowed away from it, by the least bow that restores the land (a link yields), and the section
//    is re-solved with the bow; the wheels' centres never move.
//  · THE POCKET is a set of convex pieces, each the hull of one member over the whole swing grown by CLEAR_MARGIN:
//    each arm, each boss, the blade. Its floor is the plate's top less the bar's stock and a margin.
//  · THE BLADE ASKS THE METAL (landing 3c). Where the caller gives `metalGap(pts, zLo, zHi)`, its exact clearance
//    of a pocket piece to the movement's metal, the blade's azimuth is held to it too.
// Inputs are plain numbers: { transferAt:{x,y}, spurAt:{x,y}, windSenseWorld: ±1, plateTopZ, plateBackZ,
// openings:[{ name, pts:[[x,y]…] convex, finished }], landMin, metalGap? }.
const hull = (pts) => {   // Andrew's monotone chain, CCW
  const P = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (const p of P.slice().reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
};
const circ = (c, r, n = 48) => Array.from({ length: n }, (_, k) => [c.x + r * Math.cos(2 * Math.PI * k / n), c.y + r * Math.sin(2 * Math.PI * k / n)]);
const segSeg2 = (a, b, c, d) => {   // squared distance between segments (0 if they cross)
  const cr = (o, p, q) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
  if (cr(a, b, c) * cr(a, b, d) < 0 && cr(c, d, a) * cr(c, d, b) < 0) return 0;
  const ps = (p, s0, s1) => { const dx = s1[0] - s0[0], dy = s1[1] - s0[1], L = dx * dx + dy * dy, t = L ? Math.max(0, Math.min(1, ((p[0] - s0[0]) * dx + (p[1] - s0[1]) * dy) / L)) : 0;
    return Math.pow(p[0] - s0[0] - t * dx, 2) + Math.pow(p[1] - s0[1] - t * dy, 2); };
  return Math.min(ps(a, c, d), ps(b, c, d), ps(c, a, b), ps(d, a, b));
};
const inConvex = (P, q) => P.every((a, i) => { const b = P[(i + 1) % P.length]; return (b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]) >= 0; });
// signed gap between two simple polygons, convex or not (even-odd containment, then edge distances): negative on overlap
const inPoly = (P, q) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j];
  if ((a[1] > q[1]) !== (b[1] > q[1]) && q[0] < (b[0] - a[0]) * (q[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
export const polyGap = (P, Q) => {
  if (P.some((p) => inPoly(Q, p)) || Q.some((q) => inPoly(P, q))) return -1;
  let d = Infinity;
  for (let i = 0; i < P.length; i++) for (let j = 0; j < Q.length; j++)
    d = Math.min(d, segSeg2(P[i], P[(i + 1) % P.length], Q[j], Q[(j + 1) % Q.length]));
  return d === 0 ? -1 : Math.sqrt(d);
};
// signed gap between two convex CCW polygons: negative when they overlap
export const convexGap = (P, Q) => {
  if (P.some((p) => inConvex(Q, p)) || Q.some((q) => inConvex(P, q))) return -1;
  let d = Infinity;
  for (let i = 0; i < P.length; i++) for (let j = 0; j < Q.length; j++)
    d = Math.min(d, segSeg2(P[i], P[(i + 1) % P.length], Q[j], Q[(j + 1) % Q.length]));
  return d === 0 ? -1 : Math.sqrt(d);
};

export function foldRockingBar({ transferAt, spurAt, windSenseWorld, plateTopZ, plateBackZ, openings = [], landMin, metalGap = null, variant = 'two', samples = 21, fork = {} }) {
  const M = CLEAR_MARGIN, mm = 1 / UNIT_MM;
  const ex = unit(sub(transferAt, spurAt));                         // spur → transfer
  const solveWith = (over) => solveRockingBar(variant, { ...fork, ...over });
  let B = solveWith({});
  if (!B.feasible) return { feasible: false, why: `the line spec does not solve under this fork: ${B.why}` };
  const d = B.inputs.centreDistance_u;
  const D = { x: spurAt.x + ex.x * d, y: spurAt.y + ex.y * d };
  const xh = { x: -ex.x, y: -ex.y }, yh = { x: -xh.y * windSenseWorld, y: xh.x * windSenseWorld };
  const toW = (p) => ({ x: D.x + xh.x * p.x + yh.x * p.y, y: D.y + xh.y * p.x + yh.y * p.y });
  const phis = (b) => Array.from({ length: samples }, (_, k) => b.engaged.phi + (b.neutral.phi - b.engaged.phi) * k / (samples - 1));
  const wU = (b) => b.metal.w * mm;
  // one convex piece per member over the swing, grown by the margin
  const armPiece = (b, j) => hull(phis(b).flatMap((phi) => {
    const path = b.armPath(b.centres(phi, b.beta), j).map(toW);
    return path.flatMap((q) => circ(q, wU(b) / 2 + M, 24));
  }));
  // an arm of more than two points is two convex pieces (a bow), so pieces are per straight run
  const armPieces = (b, j) => {
    const runs = [];
    const paths = phis(b).map((phi) => b.armPath(b.centres(phi, b.beta), j).map(toW));
    for (let k = 1; k < paths[0].length; k++) runs.push(hull(paths.flatMap((pa) => [...circ(pa[k - 1], wU(b) / 2 + M, 24), ...circ(pa[k], wU(b) / 2 + M, 24)])));
    return runs;
  };
  const bossPieces = (b) => {
    const out = [hull(circ(D, B.inputs.pivotR_u + wU(b) + M))];
    b.metal.pins.forEach((p, i) => out.push(hull(phis(b).flatMap((phi) => circ(toW(b.centres(phi, b.beta)[i + 1]), p.d_mm * mm / 2 + wU(b) + M, 24)))));
    return out;
  };
  // the blade: from its pin on the boss edge (radius rS, at azimuth psi in the bar's frame) radially out to its stud
  const bladePiece = (b, psi) => {
    const rS = b.blade.lever_mm * mm, L = b.blade.L_mm * mm, h = b.blade.h_mm * mm;
    const pts = phis(b).flatMap((phi) => {
      const a = phi + psi, pin = toW({ x: rS * Math.cos(a), y: rS * Math.sin(a) });
      const stud = toW({ x: (rS + L) * Math.cos(phis(b)[samples - 1] + psi), y: (rS + L) * Math.sin(phis(b)[samples - 1] + psi) });
      return [...circ(pin, h / 2 + M, 12), ...circ(stud, h / 2 + M, 12)];
    });
    return hull(pts);
  };
  const landOf = (piece) => Math.min(Infinity, ...openings.map((o) => polyGap(piece, o.pts)));
  // 1 — bow each arm the least that keeps its pocket landMin off every opening (bisection per arm, either side)
  let armBends = Array.from({ length: B.chain.length - 2 }, () => 0);
  const report = [];
  for (let j = 0; j < armBends.length; j++) {
    const ok = (h) => { const t = [...armBends]; t[j] = h; const b = solveWith({ armBends: t }); return armPieces(b, j).every((pc) => landOf(pc) >= landMin); };
    if (ok(0)) continue;
    let best = null;
    for (const sgn of [+1, -1]) {
      let hi = 0; for (let k = 1; k <= 40 && !ok(sgn * hi); k++) hi = k * 0.1;
      if (!ok(sgn * hi)) continue;
      let lo = 0; for (let it = 0; it < 50; it++) { const mid = (lo + hi) / 2; if (ok(sgn * mid)) hi = mid; else lo = mid; }
      if (!best || hi < Math.abs(best)) best = sgn * hi;
    }
    if (best === null) return { feasible: false, why: `arm ${j + 1}: no bow within 4 u restores the land to the openings` };
    armBends[j] = best;
    report.push(`arm ${j + 1} bowed ${best.toFixed(4)} u`);
  }
  B = solveWith({ armBends });
  // 2 — the blade's azimuth: the one whose piece stands farthest from the openings and from the bar's arms
  const bars = [...B.chain.slice(0, -2).flatMap((_, j) => armPieces(B, j)), ...bossPieces(B).slice(1)];
  let psiBest = null, psiGap = -Infinity;
  for (let k = 0; k < 360; k += 2) {
    const psi = k * Math.PI / 180, pc = bladePiece(B, psi);
    let g = Math.min(landOf(pc), ...bars.map((q) => convexGap(pc, q) + 2 * M));   // the blade may share the pocket with the bar: its metal a margin off the bar's
    if (metalGap && g > psiGap) g = Math.min(g, metalGap(pc, plateTopZ - (B.inputs.stock_u + M), plateTopZ));   // exact, only where it could win
    if (g > psiGap) { psiGap = g; psiBest = psi; }
  }
  const pieces = [
    ...B.chain.slice(0, -2).flatMap((_, j) => armPieces(B, j).map((pts, k) => ({ name: `arm ${j + 1}${k ? ` run ${k + 1}` : ''}`, pts }))),
    ...bossPieces(B).map((pts, i) => ({ name: i ? `boss of wheel ${i}` : 'boss at the transfer', pts })),
    { name: 'return blade', pts: bladePiece(B, psiBest) },
  ];
  const floorZ = plateTopZ - (B.inputs.stock_u + M);
  return {
    feasible: true, bar: B, transferAt: D, moved: d - len(sub(transferAt, spurAt)), side: windSenseWorld, armBends, report,
    blade: { psi: psiBest, clearance: psiGap }, pockets: pieces.map((p) => ({ ...p, land: landOf(p.pts) })),
    floorZ, floorLeft: floorZ - plateBackZ,
    centresWorld: { engaged: B.engaged.centres.map(toW), neutral: B.neutral.centres.map(toW) },
  };
}

// THE DIAL-SIDE FOLD (§334 landing 4, the owner's "one customizable module"): the bar is a COUPLING VARIANT of the
// keyless works, under the base plate in the keyless layer, not a plate-top add-on. The driver rides the crown wheel's
// own arbor (which today carries the transfer wheel straight up through the plate); the FOLLOWER stands on a new arbor
// that passes THROUGH the plate in a jewelled hole and carries the transfer wheel on the top face, where it meshes the
// fusee's winding spur as today. So the transfer wheel only moves round the spur, at its own mesh distance: on the
// spur's circle of radius |transfer − spur|, d from the crown wheel's axis (law of cosines), on the side `side` names.
// The line is solved with nF = nD so the winding ratio is today's, and ONE carried wheel, so the two meshes keep the
// driver and the follower turning the same way, which keeps the winding sense (the line's RB rules decide the rest).
// Pure: no metal is cut here. Returns the follower's centre, the swing round the spur and the line it placed.
export function foldUnderPlate({ axisAt, spurAt, windSenseWorld, driverTeeth, carriedTeeth, fuseeTorque_Nmm, side = 1, pivotR_u = ROCKING_BAR_INPUTS.pivotR_u.v }) {
  // §334 5c — the blade bears on its ear's face one CLEAR_MARGIN beyond the boss edge (underPlateSprings): at the edge
  // itself the strip, tilting as the bar swings in, would cut into the round boss behind its tip. The line is solved
  // at that lever, so its blade, its window and its swing are the metal's.
  const L0 = solveRockingBar('one', { driverTeeth, followerTeeth: driverTeeth, carried: { one: [carriedTeeth], two: [12, 12] }, fuseeTorque_Nmm, pivotR_u });
  const L = solveRockingBar('one', { driverTeeth, followerTeeth: driverTeeth, carried: { one: [carriedTeeth], two: [12, 12] }, fuseeTorque_Nmm, pivotR_u,
    bladeLever_u: pivotR_u + L0.metal.w / UNIT_MM + CLEAR_MARGIN });
  if (!L.feasible) return { feasible: false, why: `the line does not solve: ${L.why}` };
  const d = L.inputs.centreDistance_u, ex = axisAt.x - spurAt.x, ey = axisAt.y - spurAt.y, rS = Math.hypot(ex, ey);
  const c = 1 - d * d / (2 * rS * rS);
  if (Math.abs(c) > 1) return { feasible: false, why: `the bar's span ${d.toFixed(3)} u cannot reach the spur's circle` };
  const swing = side * Math.acos(c), a = Math.atan2(ey, ex) + swing;
  const F = { x: spurAt.x + rS * Math.cos(a), y: spurAt.y + rS * Math.sin(a) };
  const xh = { x: (F.x - axisAt.x) / d, y: (F.y - axisAt.y) / d }, yh = { x: -xh.y * windSenseWorld, y: xh.x * windSenseWorld };
  const toW = (p) => ({ x: axisAt.x + xh.x * p.x + yh.x * p.y, y: axisAt.y + xh.y * p.x + yh.y * p.y });
  return { feasible: true, line: L, followerAt: F, swingDeg: swing * 180 / Math.PI, spurR: rS, toW,
    centresWorld: (phi) => L.centres(phi, 0).map(toW) };
}

// The dial-side fold's choice, re-derived by tools/probe-keyless-rocking-bar-under.mjs (U0): over driver teeth 8–9 (a
// 10T reaches the winding pinion's inner end, 2.15 u off the crown wheel's axis) and one carried wheel of 10–14, the
// fit whose every member stands CLEAR_MARGIN off the movement with the WIDEST spring window; side +1 is the crossing
// of the spur's circle south of today's transfer (the other is the setting traverse's and the winding pinion's).
export const UNDER_PLATE = Object.freeze({ driverTeeth: 9, carriedTeeth: 11, side: 1, bladeAz: 125, postAz: 65, postR: 6 });   // §334 5c: bladeAz/postAz in degrees, postR in u, re-derived by probe-keyless-rocking-bar-springs.mjs (S0)

// THE UNDER-PLATE BAR'S METAL, one law for the build and its probe (§334 landing 5a). The stack hangs from the base
// plate's back face: the bar's three wheels one CLEAR_MARGIN under it, cut from the winding band's stock, and the
// bar's plate one margin under them. The plate is the hull of a boss round D (the bar's bore on the crown wheel's
// arbor, its wall the solved width) and the carried wheel's pin boss (half the width, plus the pin's own radius),
// with D's bore cut out. The pin is the line's solved diameter, its wheel's bore the running fit over it.
export function underPlateMetal(U, plateBackZ, { phi = null } = {}) {
  const L = U.line, M = CLEAR_MARGIN, stock = L.inputs.stock_u, mm = 1 / UNIT_MM;
  // a cut wheel's edge bevel stands proud of its stock on both faces (gearBevel, the module-bound value at this
  // stock), so the margins are taken from the bevel's reach, the winding band's own rule (Z_WIND_BOT)
  const bev = gearBevel(L.inputs.module, stock, true);
  const zW1 = plateBackZ - M - bev, zW0 = zW1 - stock, zB1 = zW0 - bev - M, zB0 = zB1 - stock;
  const P = U.centresWorld(phi === null ? L.engaged.phi : phi);
  const w = L.metal.w * mm, pinR = Math.max(STOCK_MIN_U, L.metal.pins[0].d_mm * mm / 2);
  const boreR = L.inputs.pivotR_u + PIVOT_BORE_CLEAR;
  const circ = (c, r, n = 32) => Array.from({ length: n }, (_, k) => [c.x + r * Math.cos(2 * Math.PI * k / n), c.y + r * Math.sin(2 * Math.PI * k / n)]);
  const outline = hull([...circ(P[0], L.inputs.pivotR_u + w), ...circ(P[1], pinR + w / 2 + PIVOT_BORE_CLEAR)]);
  return { zW0, zW1, zB0, zB1, zG0: zW0 - bev, zG1: zW1 + bev, bevel: bev, stock, centres: P, outline, bore: { at: P[0], r: boreR }, pin: { at: P[1], r: pinR, z0: zB0, z1: zW1 },
    carriedBoreR: pinR + PIVOT_BORE_CLEAR };
}

// THE UNDER-PLATE BAR'S SPRING AND BANKING (§334 landing 5c), one law for the build and its probe. Azimuths are WORLD
// angles about the driver's axis, measured from the carried wheel's azimuth with the bar engaged; ψ is the bar's swing
// from engaged (world radians), ψN its banking out.
//  · THE RETURN BLADE bears on a radial EAR on the boss, one §50 floor wide, the contact one CLEAR_MARGIN beyond the
//    boss edge (the line's lever, `bladeLever_u`, which foldUnderPlate sets there: at the edge itself the strip, tilting
//    as the bar swings in, cuts into the round boss behind its tip). The blade lies along the radius at the ear's
//    azimuth with the bar OUT, its root a stud at the line's length beyond, and pushes the bar toward its banking out;
//    swinging the bar in deflects its tip by the lever times the swing. It is drawn AIMED from its root at the ear's
//    face, as the yoke spring is (a straight strip whose tip follows the contact).
//  · THE BANKING is the line's own: the carried wheel's PIN, run down through the bar into an arc slot in a fixed
//    BRIDGE one margin under it, the slot's two ends each touching the pin at one end of the swing (engaged: the line's
//    depth; out: its banking). In the bar's own plane a slotted ear reached the winding pinion, the motion works'
//    corner or the stem at every azimuth its pin could take; under the carried wheel's path the band is free. The
//    bridge is the hull of the slot's ring and its POST, which stands from it up to the plate's back face at
//    (postR, postAz) — beyond the carried wheel's reach, since the stem runs under the driver.
export function underPlateSprings(U, plateBackZ, { bladeAz, postAz, postR, psi = 0 }) {
  const L = U.line, mm = 1 / UNIT_MM, M = CLEAR_MARGIN;
  const K = underPlateMetal(U, plateBackZ);
  const D = K.centres[0], C = K.centres[1];
  const th = Math.atan2(C.y - D.y, C.x - D.x);
  const CN = U.centresWorld(L.neutral.phi)[1];
  let psiN = Math.atan2(CN.y - D.y, CN.x - D.x) - th; psiN = Math.atan2(Math.sin(psiN), Math.cos(psiN));
  const sOut = Math.sign(psiN);
  const at = (r, a) => ({ x: D.x + r * Math.cos(a), y: D.y + r * Math.sin(a) });
  const rot = (p, d) => { const c = Math.cos(d), s = Math.sin(d), x = p.x - D.x, y = p.y - D.y; return { x: D.x + x * c - y * s, y: D.y + x * s + y * c }; };
  const rb = L.inputs.pivotR_u + L.metal.w * mm, hw = STOCK_MIN_U / 2, rc = L.blade.lever_mm * mm;   // rc: the contact, on the ear
  // the blade ear, in the bar at engaged (azimuth aE), and the blade at the bar OUT
  const aE = th + bladeAz, aN = aE + psiN;
  const earPts = (d) => [[rb * 0.5, -hw], [rc + M, -hw], [rc + M, hw], [rb * 0.5, hw]]
    .map(([r, o]) => rot({ x: D.x + r * Math.cos(aE) - o * Math.sin(aE), y: D.y + r * Math.sin(aE) + o * Math.cos(aE) }, d)).map((p) => [p.x, p.y]);
  const h = L.blade.h_mm * mm, Lb = L.blade.L_mm * mm;
  const off = -sOut * (hw + h / 2);   // the blade's centreline beside the ear, on the side it pushes from
  const tN = { x: -Math.sin(aN), y: Math.cos(aN) };
  const contactN = { x: D.x + rc * Math.cos(aN) + off * tN.x, y: D.y + rc * Math.sin(aN) + off * tN.y };
  const root = { x: D.x + (rc + Lb) * Math.cos(aN) + off * tN.x, y: D.y + (rc + Lb) * Math.sin(aN) + off * tN.y };
  const bladeAt = (d) => { const t = rot(contactN, d - psiN); return { root, tip: t, ang: Math.atan2(t.y - root.y, t.x - root.x), len: Math.hypot(t.x - root.x, t.y - root.y) }; };
  const b0 = bladeAt(psi);
  const blade = { ...b0, h, height: K.stock, deflection: Math.hypot(b0.tip.x - contactN.x, b0.tip.y - contactN.y) };
  const stud = { at: root, r: Math.max(PIVOT_MIN_U, h), z0: K.zB0 - 0.1, z1: plateBackZ + 0.3 };
  // the bar's outline: the union of the line's bar and an arm out to the blade's ear, read along rays from D
  const bossPts = circ(D, rb, 48).map(([x, y]) => [x, y]);
  const outlineAt = (d) => { const R = (pts) => pts.map(([x, y]) => { const p = rot({ x, y }, d); return [p.x, p.y]; });
    return starUnion(D, [R(K.outline), hull([...R(bossPts), ...earPts(d)])], 720); };
  // the banking: the carried pin's path is the arc at the carried wheel's radius from th (engaged) to th + ψN (out)
  const rK = Math.hypot(C.x - D.x, C.y - D.y), pk = K.pin.r, hwS = pk + PIVOT_BORE_CLEAR;
  const del = (hwS - pk) / rK;
  const e1 = th + sOut * del, e2 = th + psiN - sOut * del;   // the slot's end centres: each end's wall on the pin at its end of the swing
  const arcPts = (r, a1, a2, n = 32) => Array.from({ length: n + 1 }, (_, k) => at(r, a1 + (a2 - a1) * k / n));
  const sg = Math.sign(e2 - e1) || 1;
  const cap = (e, from) => { const c = at(rK, e), u = { x: Math.cos(e), y: Math.sin(e) }, v = { x: -Math.sin(e) * sg, y: Math.cos(e) * sg };
    return (R) => Array.from({ length: 65 }, (_, k) => { const a = from + (k / 64) * Math.PI; return { x: c.x + R * (u.x * Math.cos(a) + v.x * Math.sin(a)), y: c.y + R * (u.y * Math.cos(a) + v.y * Math.sin(a)) }; }); };
  const slotRing = (wall) => { const R = hwS + wall;
    const pts = [...arcPts(rK + R, e1, e2), ...cap(e2, 0)(R), ...arcPts(rK - R, e2, e1), ...cap(e1, Math.PI)(R)];
    // each cap begins and ends on its arcs' end points: drop the repeats, or the ring carries zero-length edges
    const out = []; for (const p of pts) { const q = out[out.length - 1]; if (!q || Math.hypot(p.x - q.x, p.y - q.y) > 1e-9) out.push(p); }
    if (out.length > 1 && Math.hypot(out[0].x - out[out.length - 1].x, out[0].y - out[out.length - 1].y) <= 1e-9) out.pop();
    return out.map((p) => [p.x, p.y]); };
  const zb1 = K.zB0 - M, zb0 = zb1 - K.stock;
  const postAt = at(postR, th + postAz), postRad = pk;   // the post: the banking pin's own section, which carries its load
  const bridgeOutline = hull([...slotRing(STOCK_MIN_U), ...circ(postAt, postRad + STOCK_MIN_U, 32)]);
  return { psiN, sOut, rb, rc, ear: earPts(psi), earAt: earPts, blade, bladeAt, stud, outline: outlineAt(psi), outlineAt,
    bridge: { outline: bridgeOutline, slot: slotRing(0), z0: zb0, z1: zb1, post: { at: postAt, r: postRad, z0: zb0, z1: plateBackZ + 0.3 } },
    pinRun: { z0: zb0 - 0.1, z1: K.pin.z1 },   // the carried pin, run down through the bridge
  };
}

// The union of convex polygons that each contain `o`, as one ring: along each of `n` rays from o, the farthest exit.
function starUnion(o, polys, n) {
  const out = [];
  for (let k = 0; k < n; k++) {
    const a = 2 * Math.PI * k / n, ux = Math.cos(a), uy = Math.sin(a);
    let best = 0;
    for (const P of polys) for (let i = 0; i < P.length; i++) {
      const [x1, y1] = P[i], [x2, y2] = P[(i + 1) % P.length];
      const ex = x2 - x1, ey = y2 - y1, den = ux * ey - uy * ex;
      if (Math.abs(den) < 1e-15) continue;
      const wx = x1 - o.x, wy = y1 - o.y, t = (wx * ey - wy * ex) / den, s = (wx * uy - wy * ux) / den;
      if (t > 0 && s >= -1e-12 && s <= 1 + 1e-12 && t > best) best = t;
    }
    out.push([o.x + best * ux, o.y + best * uy]);
  }
  return out;
}
