// §169 — WHY THE WIRE AND THE TURN COUNT ARE WHAT THEY ARE. Pure arithmetic,
// no browser: the inputs are numbers the movement already publishes, and the
// output is the table the choice was made from.
//
// The point of running it over a range of wire diameters is that the drag
// budget and the strain limit BOTH clear at every one of them — so the section
// is not forced by the load path, and picking the thinnest that fits would be
// choosing a spring to make the z-stack cheaper. That is a P3 argument reaching
// into P1, which CLAUDE.md names as a forbidden resolution. The wire is
// SPRING_FLAT_U because that is the one spring stock this movement is built
// from; the stratum the turn count then costs is bought in position space at
// the wheel, where §163 already bought some.
//
// Run: cd tools && node probe-169-solve.mjs
const U_MM = 0.12 / 0.31662;                       // UNIT_MM, back out of STOCK_MIN_U = 0.12 / UNIT_MM
const STOCK_MIN_U = 0.12 / U_MM;
const SPRING_FLAT_U = 0.05 / U_MM;
const flatsR = (t, n) => (t / 2) / Math.cos(Math.PI / n);
const STOCK_MIN_R10 = flatsR(STOCK_MIN_U, 10);
const PIVOT_BORE_CLEAR = 0.05, CLEAR_MARGIN = 0.15;
const E = 200e9, EPS = 800e6 / 200e9;
const U = U_MM / 1000;                             // m per model unit

// measured off the built movement
const STROKE = 0.2716840820312516;
const THETA = 2 * STROKE;                          // preload + one working stroke
const NOSE_ARM = 4.5429900995320605;
const CLICK_TQ_NMM = 0.03340963076061003;
const TIP_R = 1.12 * 5.7;
const HEADROOM = 3;

console.log('UNIT_MM', U_MM.toFixed(5), 'STOCK_MIN_U', STOCK_MIN_U.toFixed(5),
            'SPRING_FLAT_U', SPRING_FLAT_U.toFixed(5), 'STOCK_MIN_R10', STOCK_MIN_R10.toFixed(5));

// CLICK_TQ_NMM is N·mm, so dividing by a length in mm gives N directly
const Fmax = CLICK_TQ_NMM / (HEADROOM * TIP_R * U_MM);      // N
const Mmax = Fmax * (NOSE_ARM * U_MM / 1000);               // N·m about the pawl pivot
console.log('nose force ceiling', (Fmax * 1000).toFixed(3), 'mN;  pawl moment ceiling',
            (Mmax * 1e6).toFixed(4), 'µN·m');

const rows = [];
for (const dmm of [0.02, 0.025, 0.03, 0.035, 0.04, 0.045, 0.05]) {
  const d = dmm / U_MM;                              // model units
  const d_m = dmm / 1000;
  const I = Math.PI * d_m ** 4 / 64;
  const Ldrag = E * I * THETA / Mmax;                // m
  const Lstrain = THETA * d_m / (2 * EPS);           // m
  const Lmin_u = Math.max(Ldrag, Lstrain) / U;       // model units
  const D = 2 * (STOCK_MIN_R10 + PIVOT_BORE_CLEAR) + d;   // close fit on the post
  const C = D / d;
  const n = Math.ceil(Lmin_u / (Math.PI * D) - 0.5) + 0.5;   // half turns: the legs must come out opposite
  const L = Math.PI * D * n;
  const kth = E * I / (L * U);                       // N·m/rad
  const M = kth * THETA;
  const coilH = (n + 1) * d;   // OUTSIDE height: n turns span n·d centre to centre, plus half the wire at each end
  rows.push({ dmm, d: +d.toFixed(4), C: +C.toFixed(2), governs: Ldrag >= Lstrain ? 'drag' : 'strain',
    Lmin_u: +Lmin_u.toFixed(3), n, L_u: +L.toFixed(3), coilH: +coilH.toFixed(4),
    M_uNm: +(M * 1e6).toFixed(4), noseF_mN: +(M / (NOSE_ARM * U_MM / 1000) * 1000).toFixed(3),
    dragTq_Nmm: +(M / (NOSE_ARM * U_MM / 1000) * (TIP_R * U_MM)).toExponential(3),
    strain: +(THETA * d_m / (2 * L * U)).toExponential(3),
    raiseCost: +(coilH + CLEAR_MARGIN).toFixed(4) });
}
console.table(rows);
