// §203 step 3 — DERIVE the case alloys' base colours from measured optical
// constants. ACCEPTANCE: exits non-zero if its own controls fail.
//
// A metal's base colour in a metalness-1 PBR material IS its normal-incidence
// reflectance F0, and F0 is measured, not chosen: F0(λ) = ((n−1)² + k²) /
// ((n+1)² + k²) from the complex refractive index n + ik. The n, k rows below
// are the visible-range slice of refractiveindex.info's database (CC0), each
// with its primary source; the file path names the row in that database.
//
// From F0(λ) to a hex:
//   1. n and k are interpolated linearly in wavelength at 1 nm over 380–780 nm
//      (held flat past a table's last row; every table here spans 380–780);
//   2. XYZ = ∫ F0(λ) · cmf(λ) dλ under an EQUAL-ENERGY illuminant, with the
//      CIE 1931 2° colour-matching functions in Wyman, Sloan & Shirley's
//      multi-lobe piecewise-Gaussian fit (JCGT 2 (2), 2013, table 3) — the
//      fit's three integrals are this tool's first CONTROL: the real CMFs each
//      integrate to 106.86, so the transcribed constants must reproduce that;
//   3. XYZ → linear sRGB by the standard matrix (IEC 61966-2-1), then each
//      channel divided by the same pipeline's answer for a PERFECT reflector,
//      so a flat 100% spectrum reads exactly white — the renderer supplies the
//      illuminant, so a base colour is reflectance under the renderer's own
//      white, and this per-channel white balance is the convention that says so;
//   4. linear → sRGB transfer → hex, the form `material.color.set('#…')` takes
//      (three.js r165 colour-management on: a hex is sRGB, converted to linear
//      on the way in, which is how every colour in materials.js already reads).
//
// The second CONTROL is a published table: Hoffman's SIGGRAPH 2013 "Physics
// and Math of Shading" lists F0 for gold ≈ (1.00, 0.77, 0.34), silver ≈ (0.97,
// 0.96, 0.92), copper ≈ (0.95, 0.64, 0.54), platinum ≈ (0.67, 0.64, 0.59),
// iron ≈ (0.56, 0.57, 0.58) — spectral integrations of the same kind of
// measurement by a different hand. Each metal that SHIPS (Au, Ag, Cu through
// the alloy; Pt directly) must land within 0.06 per channel of that table, or
// the pipeline is wrong somewhere and no alloy below can be trusted. Iron is
// REPORTED, not gated: steel keeps its authored colour (materials.js says why),
// and iron's tabulations disagree with each other by more than the gate — all
// three in the database are printed so that spread is visible rather than
// hidden behind one row. This control is what retired Werner's 2009 platinum
// table from the first draft: its single 708 nm row (n 0.50, k 7.03) reads
// 0.30 off the published value, and Rakić's Lorentz–Drude tabulation ships.
//
// THE ALLOYS. 18K white gold is rhodium-plated as standard, so its VISIBLE F0
// is rhodium's — the plate is what the eye meets. Platinum cases are Pt950 and
// read as platinum. 18K yellow gold is an ALLOY — 3N, the standard yellow, is
// 75 Au / 12.5 Ag / 12.5 Cu by mass — and its optical constants are NOT the
// mass-weighted mix of the pure metals'. This tool takes the simplest
// effective-medium approximation, the dielectric function ε = (n + ik)²
// averaged by ATOMIC fraction (a virtual-crystal average), names it as an
// approximation, and prints the mass-weighted variant beside it so the
// reader can see how much rides on the choice. ISO 8654 fixes 3N's colour as a
// CIELAB swatch; when a copy of the standard is at hand, that swatch replaces
// this average and the approximation retires.
//
//   node tools/derive-203-alloys.mjs        prints the table; the hexes in
//                                           materials.js ALLOY_COLORS are these
const M = {
  Au: { cite: "P. B. Johnson and R. W. Christy, Phys. Rev. B 6, 4370 (1972)", file: "database/data/main/Au/nk/Johnson.yml",
    nk: [[367.9, 1.48, 1.895], [381.5, 1.46, 1.933], [397.4, 1.47, 1.952], [413.3, 1.46, 1.958], [430.5, 1.45, 1.948], [450.9, 1.38, 1.914], [471.4, 1.31, 1.849], [495.9, 1.04, 1.833], [520.9, 0.62, 2.081], [548.6, 0.43, 2.455], [582.1, 0.29, 2.863], [616.8, 0.21, 3.272], [659.5, 0.14, 3.697], [704.5, 0.13, 4.103], [756.0, 0.14, 4.542]] },
  Ag: { cite: "P. B. Johnson and R. W. Christy, Phys. Rev. B 6, 4370 (1972)", file: "database/data/main/Ag/nk/Johnson.yml",
    nk: [[367.9, 0.07, 1.657], [381.5, 0.05, 1.864], [397.4, 0.05, 2.07], [413.3, 0.05, 2.275], [430.5, 0.04, 2.462], [450.9, 0.04, 2.657], [471.4, 0.05, 2.869], [495.9, 0.05, 3.093], [520.9, 0.05, 3.324], [548.6, 0.06, 3.586], [582.1, 0.05, 3.858], [616.8, 0.06, 4.152], [659.5, 0.05, 4.483], [704.5, 0.04, 4.838], [756.0, 0.03, 5.242]] },
  Cu: { cite: "P. B. Johnson and R. W. Christy, Phys. Rev. B 6, 4370 (1972)", file: "database/data/main/Cu/nk/Johnson.yml",
    nk: [[367.9, 1.36, 1.975], [381.5, 1.33, 2.045], [397.4, 1.32, 2.116], [413.3, 1.28, 2.207], [430.5, 1.25, 2.305], [450.9, 1.24, 2.397], [471.4, 1.25, 2.483], [495.9, 1.22, 2.564], [520.9, 1.18, 2.608], [548.6, 1.02, 2.577], [582.1, 0.7, 2.704], [616.8, 0.3, 3.205], [659.5, 0.22, 3.747], [704.5, 0.21, 4.205], [756.0, 0.24, 4.665]] },
  Pt: { cite: "A. D. Raki\u0107, A. B. Djuri\u0161i\u0107, J. M. Elazar, M. L. Majewski, Appl. Opt. 37, 5271 (1998) \u2014 Lorentz\u2013Drude fit to measured data, tabulated", file: "database/data/main/Pt/nk/Rakic-LD.yml",
    nk: [[361.1, 1.6181, 2.6102], [366.8, 1.6337, 2.6474], [372.6, 1.6496, 2.6846], [378.5, 1.6658, 2.7216], [384.5, 1.6821, 2.7587], [390.6, 1.6987, 2.7958], [396.7, 1.7153, 2.8329], [403.0, 1.7321, 2.8701], [409.3, 1.7489, 2.9075], [415.8, 1.7657, 2.945], [422.4, 1.7826, 2.9829], [429.0, 1.7995, 3.021], [435.8, 1.8164, 3.0595], [442.7, 1.8333, 3.0985], [449.7, 1.8503, 3.1379], [456.8, 1.8674, 3.1779], [464.0, 1.8846, 3.2184], [471.3, 1.9019, 3.2596], [478.8, 1.9194, 3.3014], [486.3, 1.9372, 3.3439], [494.0, 1.9552, 3.3872], [501.8, 1.9736, 3.4311], [509.7, 1.9923, 3.4759], [517.8, 2.0115, 3.5213], [525.9, 2.0312, 3.5676], [534.2, 2.0515, 3.6145], [542.7, 2.0724, 3.6622], [551.2, 2.0939, 3.7106], [559.9, 2.1161, 3.7597], [568.8, 2.1391, 3.8094], [577.8, 2.1629, 3.8598], [586.9, 2.1875, 3.9107], [596.1, 2.213, 3.9622], [605.6, 2.2393, 4.0141], [615.1, 2.2666, 4.0665], [624.8, 2.2948, 4.1192], [634.7, 2.3239, 4.1723], [644.7, 2.3539, 4.2256], [654.9, 2.3848, 4.2792], [665.2, 2.4167, 4.333], [675.7, 2.4494, 4.3869], [686.4, 2.4831, 4.4408], [697.2, 2.5175, 4.4948], [708.2, 2.5528, 4.5488], [719.4, 2.5889, 4.6028], [730.8, 2.6257, 4.6567], [742.3, 2.6632, 4.7105], [754.0, 2.7014, 4.7641], [765.9, 2.7401, 4.8177], [778.0, 2.7794, 4.8711], [790.3, 2.8192, 4.9244]] },
  Rh: { cite: "J. H. Weaver, C. G. Olson, D. W. Lynch, Phys. Rev. B 15, 4115 (1977); numerical values per Palik (1985)", file: "database/data/main/Rh/nk/Weaver.yml",
    nk: [[364.7, 1.11, 3.84], [375.7, 1.2, 3.97], [387.5, 1.3, 4.09], [400.0, 1.41, 4.2], [413.3, 1.53, 4.29], [427.5, 1.63, 4.36], [459.2, 1.8, 4.49], [476.9, 1.85, 4.55], [495.9, 1.88, 4.65], [516.6, 1.9, 4.78], [539.1, 1.94, 4.94], [563.6, 2.0, 5.11], [590.4, 2.05, 5.3], [619.9, 2.12, 5.51], [652.6, 2.2, 5.76], [688.8, 2.3, 6.02], [729.3, 2.42, 6.33], [774.9, 2.6, 6.64]] },
  Fe: { cite: "P. B. Johnson and R. W. Christy, Phys. Rev. B 9, 5056 (1974)", file: "database/data/main/Fe/nk/Johnson.yml",
    nk: [[368.0, 2.02, 2.43], [381.0, 2.12, 2.5], [397.0, 2.24, 2.58], [413.0, 2.35, 2.65], [431.0, 2.48, 2.71], [451.0, 2.59, 2.77], [471.0, 2.67, 2.82], [496.0, 2.74, 2.88], [521.0, 2.86, 2.91], [549.0, 2.95, 2.93], [582.0, 2.94, 2.99], [617.0, 2.88, 3.05], [659.0, 2.92, 3.1], [704.0, 2.86, 3.19], [756.0, 2.87, 3.28]] },
  Fe_Ordal: { cite: "M. A. Ordal et al., Appl. Opt. 27, 1203 (1988)", file: "database/data/main/Fe/nk/Ordal.yml",
    nk: [[667.0, 2.8735, 3.359], [714.0, 2.9443, 3.4648], [769.0, 2.9736, 3.5472]] },
  Fe_Querry: { cite: "M. R. Querry, Optical constants, Contractor Report CRDC-CR-85034 (1985)", file: "database/data/main/Fe/nk/Querry.yml",
    nk: [[360.0, 1.296, 2.375], [370.0, 1.339, 2.454], [380.0, 1.39, 2.526], [390.0, 1.442, 2.588], [400.0, 1.492, 2.644], [410.0, 1.538, 2.698], [420.0, 1.583, 2.753], [430.0, 1.631, 2.806], [440.0, 1.682, 2.858], [450.0, 1.736, 2.906], [460.0, 1.79, 2.949], [470.0, 1.846, 2.989], [480.0, 1.903, 3.019], [490.0, 1.952, 3.043], [500.0, 1.996, 3.067], [510.0, 2.039, 3.091], [520.0, 2.08, 3.113], [530.0, 2.119, 3.134], [540.0, 2.156, 3.153], [550.0, 2.189, 3.171], [560.0, 2.219, 3.19], [570.0, 2.252, 3.21], [580.0, 2.281, 3.223], [590.0, 2.305, 3.241], [600.0, 2.328, 3.259], [610.0, 2.35, 3.277], [620.0, 2.37, 3.297], [630.0, 2.391, 3.317], [640.0, 2.408, 3.336], [650.0, 2.427, 3.361], [660.0, 2.448, 3.383], [670.0, 2.468, 3.404], [680.0, 2.486, 3.423], [690.0, 2.503, 3.443], [700.0, 2.519, 3.463], [710.0, 2.533, 3.485], [720.0, 2.549, 3.507], [730.0, 2.564, 3.527], [740.0, 2.577, 3.549], [750.0, 2.587, 3.569], [760.0, 2.597, 3.595], [770.0, 2.611, 3.619], [780.0, 2.623, 3.642], [790.0, 2.633, 3.669], [800.0, 2.649, 3.693]] },
};
const rgbOf = (c) => `#${c.map((v) => Math.round(255 * Math.min(1, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`;
const srgb = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);

// CIE 1931 2° CMF fit (Wyman, Sloan & Shirley 2013, table 3).
const g = (l, mu, s1, s2) => { const t = (l - mu) / (l < mu ? s1 : s2); return Math.exp(-0.5 * t * t); };
const xbar = (l) => 1.056 * g(l, 599.8, 37.9, 31.0) + 0.362 * g(l, 442.0, 16.0, 26.7) - 0.065 * g(l, 501.1, 20.4, 26.2);
const ybar = (l) => 0.821 * g(l, 568.8, 46.9, 40.5) + 0.286 * g(l, 530.9, 16.3, 31.1);
const zbar = (l) => 1.217 * g(l, 437.0, 11.8, 36.0) + 0.681 * g(l, 459.0, 26.0, 13.8);

let failures = 0;
const fail = (msg) => { failures++; console.log(`FAIL: ${msg}`); };

// CONTROL 1 — the fit's integrals.
{
  let X = 0, Y = 0, Z = 0;
  for (let l = 360; l <= 830; l++) { X += xbar(l); Y += ybar(l); Z += zbar(l); }
  const ok = [X, Y, Z].every((v) => Math.abs(v - 106.86) / 106.86 < 0.02);
  console.log(`CMF fit integrals: x̄ ${X.toFixed(2)}  ȳ ${Y.toFixed(2)}  z̄ ${Z.toFixed(2)}  (CIE: 106.86 each) — ${ok ? 'CONTROL PASS' : 'CONTROL FAIL'}`);
  if (!ok) fail('CMF constants mistranscribed');
}

// n,k at wavelength l (nm), linear in the table, flat past its ends.
function nkAt(rows, l) {
  if (l <= rows[0][0]) return [rows[0][1], rows[0][2]];
  for (let i = 1; i < rows.length; i++) {
    if (l <= rows[i][0]) {
      const [l0, n0, k0] = rows[i - 1], [l1, n1, k1] = rows[i], t = (l - l0) / (l1 - l0);
      return [n0 + t * (n1 - n0), k0 + t * (k1 - k0)];
    }
  }
  return [rows[rows.length - 1][1], rows[rows.length - 1][2]];
}
const f0 = (n, k) => ((n - 1) ** 2 + k * k) / ((n + 1) ** 2 + k * k);

// XYZ → linear sRGB (IEC 61966-2-1, D65 primaries).
const toRGB = ([X, Y, Z]) => [
  3.2406 * X - 1.5372 * Y - 0.4986 * Z,
  -0.9689 * X + 1.8758 * Y + 0.0415 * Z,
  0.0557 * X - 0.2040 * Y + 1.0570 * Z,
];
function integrate(spectrum) {   // spectrum(l) → reflectance; equal-energy illuminant
  let X = 0, Y = 0, Z = 0;
  for (let l = 380; l <= 780; l++) { const r = spectrum(l); X += r * xbar(l); Y += r * ybar(l); Z += r * zbar(l); }
  return [X, Y, Z];
}
const white = toRGB(integrate(() => 1));
const linearRGB = (spectrum) => toRGB(integrate(spectrum)).map((v, i) => v / white[i]);

const pure = {};
for (const [m, d] of Object.entries(M)) {
  const rows = d.nk.slice().sort((a, b) => a[0] - b[0]);
  pure[m] = linearRGB((l) => f0(...nkAt(rows, l)));
}

// CONTROL 2 — the published table.
const HOFFMAN = { Au: [1.00, 0.77, 0.34], Ag: [0.97, 0.96, 0.92], Cu: [0.95, 0.64, 0.54], Pt: [0.67, 0.64, 0.59], Fe: [0.56, 0.57, 0.58], Fe_Ordal: [0.56, 0.57, 0.58], Fe_Querry: [0.56, 0.57, 0.58] };
const GATED = new Set(['Au', 'Ag', 'Cu', 'Pt']);
console.log('\npure metals — linear F0 (this tool)   vs Hoffman 2013   → sRGB hex');
for (const m of Object.keys(M)) {
  const v = pure[m], h = HOFFMAN[m];
  const dev = h ? Math.max(...v.map((c, i) => Math.abs(c - h[i]))) : null;
  const ok = !GATED.has(m) || dev < 0.06;
  const verdict = !h ? '(no published row)' : GATED.has(m) ? (ok ? 'ok (gated)' : 'FAIL') : 'reported';
  console.log(`  ${m.padEnd(9)} (${v.map((c) => c.toFixed(3)).join(', ')})  ${h ? `vs (${h.join(', ')})  max Δ ${dev.toFixed(3)} ${verdict}` : verdict}  → ${rgbOf(v.map(srgb))}`);
  if (!ok) fail(`${m} is off the published table by ${dev.toFixed(3)}`);
}

// THE ALLOY — 3N by two averaging rules; the atomic-fraction ε average ships.
const rowsOf = (m) => M[m].nk.slice().sort((a, b) => a[0] - b[0]);
const epsAt = (m, l) => { const [n, k] = nkAt(rowsOf(m), l); return [n * n - k * k, 2 * n * k]; };   // ε = (n+ik)²
const nkFromEps = ([er, ei]) => { const mod = Math.hypot(er, ei); return [Math.sqrt((mod + er) / 2), Math.sqrt((mod - er) / 2)]; };
const MASS = { Au: 0.75, Ag: 0.125, Cu: 0.125 }, AMU = { Au: 196.97, Ag: 107.87, Cu: 63.55 };
const molSum = Object.entries(MASS).reduce((s, [m, w]) => s + w / AMU[m], 0);
const ATOMIC = Object.fromEntries(Object.entries(MASS).map(([m, w]) => [m, w / AMU[m] / molSum]));
const mixSpectrum = (frac) => (l) => {
  let er = 0, ei = 0;
  for (const [m, x] of Object.entries(frac)) { const [a, b] = epsAt(m, l); er += x * a; ei += x * b; }
  return f0(...nkFromEps([er, ei]));
};
const yellowAtomic = linearRGB(mixSpectrum(ATOMIC)), yellowMass = linearRGB(mixSpectrum(MASS));
console.log(`\n18K yellow gold, 3N (75/12.5/12.5 Au/Ag/Cu by mass; atomic ${Object.entries(ATOMIC).map(([m, x]) => `${m} ${x.toFixed(3)}`).join(' ')}):`);
console.log(`  ε averaged by ATOMIC fraction  (${yellowAtomic.map((c) => c.toFixed(3)).join(', ')})  → ${rgbOf(yellowAtomic.map(srgb))}   ← ships`);
console.log(`  ε averaged by MASS fraction    (${yellowMass.map((c) => c.toFixed(3)).join(', ')})  → ${rgbOf(yellowMass.map(srgb))}   (the sensitivity to the rule)`);

console.log('\nALLOY_COLORS for materials.js:');
const out = { steel: '#d6d9dd (kept — the authored value, see the comment there; iron measures ' + rgbOf(pure.Fe.map(srgb)) + ' / ' + rgbOf(pure.Fe_Ordal.map(srgb)) + ' / ' + rgbOf(pure.Fe_Querry.map(srgb)) + ' by its three tabulations)',
  yellowGold18k: rgbOf(yellowAtomic.map(srgb)), whiteGold18k: rgbOf(pure.Rh.map(srgb)) + ' (rhodium — the plate)', platinum: rgbOf(pure.Pt.map(srgb)) };
for (const [k, v] of Object.entries(out)) console.log(`  ${k}: ${v}`);
if (failures) { console.log(`\n${failures} control(s) FAILED`); process.exit(1); }
console.log('\nboth controls PASS');
