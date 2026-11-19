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
// WHAT THIS DOES NOT CLAIM. Modelled, not simulated: the bar is placed at its two bankings, nothing steps it. The load
// is the fusee's torque at D, the one the watch already sizes its winding train to; what a hand can add at the winding
// stop is declared nowhere in the movement and is not priced. The clip's interference (about 6 µm a jaw) is reported,
// not judged, for want of a tolerance to judge it by. Shock is not covered. The two search snippets that ground the
// mechanism are quoted in TODO 318 and still owe a full read.
import { gearToothSpec } from './geometry.js';
import { KW_MODULE, crownWheelTeeth, windPinionTeeth, WIND_SPUR_TEETH, KW_WIND_IDLER_TEETH, CLEAR_MARGIN, UNIT_MM,
  FRICTION, STOCK, STOCK_MIN_U, SPRING_FLAT_U, SPRING_SIGMA_Y_PA, MAINSPRING_SIGMA_Y_PA, MAINSPRING_E_PA, PIVOT_BORE_CLEAR } from './layout.js';

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
  bladeH_u: { v: SPRING_FLAT_U, why: 'the movement\'s flat-blade floor (SPRING_FLAT_U, 0.05 mm), which every blade spring here is cut to' },
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
    for (let seg = 1; seg <= last; seg++) {
      const A = { x: mmOf(PE[seg - 1].x), y: mmOf(PE[seg - 1].y) }, C = { x: mmOf(PE[seg].x), y: mmOf(PE[seg].y) };
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
    const a = PE[i - 1], b = PE[i];
    addMass(mKg(mmOf(len(sub(b, a))) * metal.w * tBar), { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
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
  const rS = I.bladeAt === 'boss' ? rC0 + metal.w : mmOf(c[0]), Lb = I.bladeAt === 'boss' ? len(Bmm) : mmOf(c[0]);
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
    feasible: true, variant, inputs: I, chain, spec, side: s, beta, centres, engagedAt, pairClear, gapLF, kAt,
    engaged: { phi: phiE, centres: PE, depthErr: depthErr(PE), clear: pairClear(PE) },
    neutral: { phi: phiN, centres: PN, gap: gapLF(PN), clear: pairClear(PN) },
    swing, carrySense: Math.sign(phiE - phiN), corners, kMin, kMax, sameForceSystem,
    window: { Tw_Nmm: Tw, MfMax_Nmm: MfMax, Mg_Nmm: Mg, Ms_Nmm: Ms, MsE_Nmm: MsE, MfLo_Nmm: MfLo, MfNom_Nmm: MfNom,
      MfHi_Nmm: MfHi, rise, muSpread: muHi / muLo, q, releaseLimit_Nmm, mass_kg: mass },
    metal, blade, clip, tip, slot, sizeMetal,
    sense: { meshes, sameAsDirect: parity === 1 },
    ratio: nD / nF,
  };
}
