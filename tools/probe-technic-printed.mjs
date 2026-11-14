// §345 landing 0 — THE CALIBRATION PRINTS, held (acceptance, pure Node; src/technic-printed.js).
//
//   · THE SECTION — the axle's section is read off the vendored 3705, and its end radius is the frame table's axleR.
//   · THE HOLES — each fit-strip hole is the section grown by its step: span 2(r + c) and slot 2(halfArm + c), measured
//     off the outline. LINEARITY control: two steps apart, the slot moves by exactly two steps.
//   · THE WALLS — nothing printed thinner than WALL_MIN (two nozzle widths): between holes, from a hole to the strip's
//     edge, from the notch's tip to the tightest hole, the ring's wall. Control: a notch as deep as a first draft cut it
//     (1.2 mm) must fail.
//   · THE MESHES — every coupon closed and manifold (each directed edge once, its reverse once), every cap triangle
//     wound the right way (a fold in the stitch would flip one), the volume the outline's area × height at float noise,
//     the ring's facets far under the nozzle. Controls: a triangle dropped, a triangle flipped.
//   · THE FILE — binary STL round-trips: the triangle count, and the volume to float32's resolution.
//   · THE READINGS — PRINT_MEASURED is reported, never quoted: until the owner's rows arrive, nothing printed is.
import { loadPack } from './technic-pack.mjs';
import { LEGO_DIM_MM } from '../src/technic-frame.js';
import * as P from '../src/technic-printed.js';

const lib = loadPack();
let fails = 0;
const fail = (m) => { fails++; console.log(`  ✗ ${m}`); };
const controls = [];
const control = (name, caught) => controls.push([name, !!caught]);
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;

// ── THE SECTION
const sec = P.axleSection(lib);
if (!near(sec.r, LEGO_DIM_MM.axleR, 1e-9)) fail(`3705's arms end at r ${sec.r} mm, the frame table says ${LEGO_DIM_MM.axleR}`);
if (!(sec.halfArm > 0 && sec.halfArm < sec.r / 2)) fail(`3705's arm half-width ${sec.halfArm} mm is not an arm`);
console.log(`SECTION 3705 (LDraw): arms ${(2 * sec.halfArm).toFixed(3)} mm wide, ends on r ${sec.r.toFixed(3)} mm (span ${(2 * sec.r).toFixed(3)} mm)`);

// ── THE HOLES, read off the outline
const readHole = (ring, C) => {
  const q = ring.map(([x, y]) => [x - C[0], y - C[1]]);
  const span = Math.max(...q.map((p) => p[0])) - Math.min(...q.map((p) => p[0]));
  const slot = 2 * Math.max(...q.filter((p) => p[0] > sec.r * 0.75).map((p) => Math.abs(p[1])));   // the +x arm's flanks
  return { span, slot };
};
const fit = P.fitStrip(sec);
for (const h of fit.holes) {
  const r = readHole(h.ring, h.centre);
  if (!near(r.span, 2 * (sec.r + h.c), 1e-9) || !near(r.slot, 2 * (sec.halfArm + h.c), 1e-9)) fail(`hole c ${h.c}: span ${r.span}, slot ${r.slot}`);
}
{
  const a = readHole(P.crossHole(sec, 0.1), [0, 0]), b = readHole(P.crossHole(sec, 0.2), [0, 0]);
  control('two steps apart, the slot must move by exactly two steps', near(b.slot - a.slot, 2 * 0.1, 1e-9));
}
console.log(`HOLES ${fit.holes.length}, clearance ${P.CLEAR_STEPS[0]}–${P.CLEAR_STEPS.at(-1)} mm by ${P.CLEAR_STEP}: slot ${(2 * sec.halfArm).toFixed(2)}–${(2 * (sec.halfArm + P.CLEAR_STEPS.at(-1))).toFixed(2)} mm, span ${(2 * sec.r).toFixed(2)}–${(2 * (sec.r + P.CLEAR_STEPS.at(-1))).toFixed(2)} mm`);

// ── THE WALLS
const walls = (strip) => {
  const cMax = Math.max(...strip.holes.map((h) => h.c)), half = strip.pitch / 2;
  return {
    between: strip.pitch - 2 * (sec.r + cMax),
    edge: half - (sec.r + cMax),
    notch: half - strip.notch - (sec.r + strip.holes[0].c),
  };
};
{
  const w = walls(fit);
  for (const [k, v] of Object.entries(w)) if (!(v >= P.WALL_MIN - 1e-12)) fail(`fit strip's ${k} wall ${v.toFixed(3)} mm, under WALL_MIN ${P.WALL_MIN}`);
  const bad = walls(P.fitStrip(sec, { notch: 1.2 }));
  control('a notch 1.2 mm deep (a first draft\'s) must leave too thin a wall', bad.notch < P.WALL_MIN);
  console.log(`WALLS between holes ${w.between.toFixed(2)} mm, hole to edge ${w.edge.toFixed(2)} mm, notch to the tightest hole ${w.notch.toFixed(2)} mm (WALL_MIN ${P.WALL_MIN} mm, two nozzle widths)`);
}

// ── THE MESHES
const capsWound = (T, h) => T.every((t) => {
  if (!t.every((p) => near(p[2], h, 1e-12)) && !t.every((p) => near(p[2], 0, 1e-12))) return true;   // a wall
  const [a, b, c] = t, s = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
  return t[0][2] > 0 ? s > 1e-12 : s < -1e-12;
});
const meshes = { fit, ring: P.couponRing(lib), ramp: P.couponRamp() };
for (const [k, m] of Object.entries(meshes)) {
  const f = P.manifoldFault(m.tris), v = P.meshVolume(m.tris), want = m.area * m.h;
  if (f) fail(`${k}: not closed and manifold — ${f}`);
  if (!capsWound(m.tris, m.h)) fail(`${k}: a cap triangle is wound backwards (a fold in the stitch)`);
  if (!near(v, want, 1e-9 * want)) fail(`${k}: volume ${v} mm³, the outline says ${want}`);
  const xs = m.tris.flat().map((p) => p[0]), ys = m.tris.flat().map((p) => p[1]);
  const fx = Math.max(...xs) - Math.min(...xs), fy = Math.max(...ys) - Math.min(...ys);
  if (!(Math.max(fx, fy) <= P.PRINT_AREA + 1e-9)) fail(`${k}: footprint ${fx.toFixed(1)} × ${fy.toFixed(1)} mm is over the printable ${P.PRINT_AREA} mm`);
  console.log(`  footprint ${fx.toFixed(1)} × ${fy.toFixed(1)} mm (printable ${P.PRINT_AREA} × ${P.PRINT_AREA} on the ${P.PRINT_SETUP.bed} mm bed)`);
  console.log(`MESH ${m.name}: ${m.tris.length} triangles, closed and manifold, ${v.toFixed(1)} mm³ (${(v * 1.24 / 1000).toFixed(2)} g at PLA's nominal 1.24 g/cm³)`);
}
{
  const R = meshes.ring;
  if (!near(R.R, P.ringRadius(lib), 1e-12)) fail('the ring\'s bore is not the leading layout\'s lock radius');
  const sag = R.Ro * (1 - Math.cos(Math.PI / R.n));
  if (!(sag <= P.PRINT_SETUP.nozzle / 10)) fail(`the ring's facets' sagitta ${sag} mm is over a tenth of the nozzle`);
  if (!(P.RING_WALL >= P.WALL_MIN)) fail('the ring\'s wall is under WALL_MIN');
  console.log(`RING bore ⌀${(2 * R.R).toFixed(3)} mm (the 3.5-pitch Graham's lock radius about the pivot, ${R.R.toFixed(3)} mm), outside ⌀${(2 * R.Ro).toFixed(3)} mm, ${R.n} facets (sagitta ${sag.toFixed(4)} mm)`);
  const dropped = fit.tris.slice(1), flipped = [[fit.tris[0][0], fit.tris[0][2], fit.tris[0][1]], ...fit.tris.slice(1)];
  control('a triangle dropped (the mesh must read open)', P.manifoldFault(dropped));
  control('a triangle flipped (the mesh must read non-manifold)', P.manifoldFault(flipped));
  const capIdx = fit.tris.findIndex((t) => t.every((p) => near(p[2], fit.h, 1e-12)));
  const reversed = fit.tris.map((t, i) => (i === capIdx ? [t[0], t[2], t[1]] : t));
  control('a ramp a full bed long (no skirt room) must exceed the printable area', P.RAMP.L < P.PRINT_SETUP.bed && P.couponRamp({ L: P.PRINT_SETUP.bed }).tris.flat().some((p) => p[0] > P.PRINT_AREA));
  control('a cap triangle reversed (the winding check must read the fold)', !capsWound(reversed, fit.h));
}

// ── THE FILE
for (const [k, m] of Object.entries(meshes)) {
  const bytes = P.stlBinary(m.tris, m.name), back = P.stlRead(bytes);
  const v0 = P.meshVolume(m.tris), v1 = P.meshVolume(back);
  if (back.length !== m.tris.length || bytes.length !== 84 + 50 * m.tris.length) fail(`${k}: the STL carries ${back.length} of ${m.tris.length} triangles`);
  if (!near(v1, v0, 1e-5 * v0)) fail(`${k}: the STL's volume ${v1} against ${v0} (float32 resolution)`);
}
console.log('FILES every coupon round-trips through binary STL');

// ── THE READINGS
console.log(`READINGS ${P.PRINT_MEASURED.status}: fit ${JSON.stringify(P.PRINT_MEASURED.fit)}, ring ${JSON.stringify(P.PRINT_MEASURED.ring)}, slide ${JSON.stringify(P.PRINT_MEASURED.slide)} — nothing printed is quoted until they arrive`);

console.log('\ncontrols:');
for (const [n, c] of controls) { console.log(`  ${c ? 'caught' : 'NOT CAUGHT'}  ${n}`); if (!c) fails++; }
console.log(fails ? `\n${fails} FAILED` : '\nthe calibration prints hold: the section read off the part, every hole its step, every wall over two nozzle widths, every mesh closed, every file the mesh');
process.exit(fails ? 1 : 0);
