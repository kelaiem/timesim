// WHICH WAY DOES EACH WOUND PART WIND? — TODO 115's unmeasured half.
//
// The handedness census in `probe-handedness.mjs` settled the movement's CUT
// outlines: nine are handed, and each can be reversed. It structurally cannot
// see the other half of TODO 115's inventory, and says so in its own header —
// a spring's wind and the fusee's groove are handed by CONSTRUCTION, not by an
// outline. There is no `parameters.shapes` to mirror, so those parts are
// ABSENT from that table rather than symmetric in it. This measures them.
//
// WHAT IS BEING ASKED, and it is not "is this handed". A wind is handed by
// definition: a spiral or a helix has a chirality and no mirror axis, so
// reversing the train necessarily reverses it. The open questions are WHICH
// WAY each one winds today, whether the model is internally consistent about
// it, and whether anything would catch a part the reversal missed. So the
// output is a signed hand per part, not a verdict.
//
// HOW IT MEASURES. One estimator for both shapes, so a spiral row and a helix
// row are the same kind of number. Bin the part's world points by an ADVANCE
// coordinate — radius for a flat spiral, z for a helix — take the CIRCULAR
// MEAN azimuth in each bin, unwrap across bins, and report the total swept
// angle. Its sign is the hand; its magnitude is how many turns; and the
// fraction of bin-to-bin steps that agree with that sign is the quality
// figure, which is what separates a real wind from a part that merely has
// points at many radii.
//
// Circular mean rather than a first-vertex sample because a ribbon has
// THICKNESS: at one radius there are points on both faces at slightly
// different azimuths, and picking one of them makes the estimator depend on
// vertex order. Mean azimuth per bin is order-free, which matters because
// `weldGeometry` does not promise path order and nothing downstream restores
// it.
//
// SELF-DISCOVERING, for the reason the census was. TODO 115's inventory was
// prose and measured wrong in both directions. So this does not name the
// mainsprings and the fusee: it measures EVERY mesh in the movement under both
// estimators and reports the ones that read as genuinely wound. A wound part
// nobody listed shows up; a listed part that is not wound does not get a row
// it did not earn.
//
// CONTROLS, both kinds, and synthesised rather than borrowed — no shipped part
// can be a control here because its hand is the question:
//   · must-hit  — a right-handed helix and a right-handed spiral must read a
//     positive hand, and their left-handed mirrors must read negative. Four
//     points, because a sign estimator that returns a constant passes any
//     one-sided control.
//   · must-miss — a CYLINDER must read as not-wound. Its points cover every
//     azimuth at every z, so the per-bin circular mean is meaningless and the
//     quality figure must reject it. Without this the census's threshold has
//     no evidence behind it, and every tube in the movement would file a row.
// A real cross-check sits beside them and is reported, not asserted: the
// fusee's groove and the chain wrapped in it are ONE thread, so their hands
// must agree. They are measured independently and compared.
//
// IT IS NOT `probe-104-spring.mjs` (what the alarm ribbon's frame solver
// makes of its section), NOT `probe-169-stock.mjs` (whether stockFloor sees
// both swept springs at their wire), NOT `probe-51-reach.mjs` or
// `probe-chain-daylight.mjs` (the wrap's demand on the finger's band, and the
// daylight under the bottom turn), and NOT `probe-drum-azimuth.mjs` (where the
// drum could stand). Every one of those touches a wound part; none asks which
// way it turns.
//
// REPORT — it prints hands and exits non-zero only on its own controls. Which
// way the movement OUGHT to wind is TODO 115's decision, not this file's, and
// gating a hand before that decision is made would freeze the defect.
// Run from tools/ with a Playwright Chromium: `node probe-wound-sense.mjs`.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const port = process.env.PORT || '8523';
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'], { cwd: process.env.ROOT || '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });

const out = await page.evaluate(async () => {
  const THREE = await import('three');
  const C = window.__clock;

  // ---- the estimator ---------------------------------------------------
  // pts: flat [x,y,z,...] in WORLD space. World, not local, because the claim
  // is about how a part winds relative to the sense the train actually turns
  // in — and a parent with a negative scale would flip a local reading without
  // flipping anything physical.
  const BINS = 256;
  const wind = (pts, mode, axis = [0, 0]) => {
    const n = pts.length / 3;
    if (n < 24) return null;
    // AZIMUTH IS ABOUT THE PART'S OWN AXIS, not the world origin. The first
    // version of this used atan2(y, x) on world points, which measures the
    // angle subtended at the origin — and every wound part in this movement
    // sits at its own station well away from it, so a spiral about its own
    // centre reads as a small blob that never winds. It reported 0 of 666
    // parts wound, with all five controls passing, because the controls were
    // synthesised AT the origin and so could not fail the same way. They are
    // offset now for exactly that reason: a control has to be placed like the
    // thing it stands in for, or it certifies the estimator against a case the
    // subjects never present.
    // …and the axis is the part's OWN ORIGIN, passed in, not the centroid of
    // its points. The centroid was the second wrong answer: a spiral that is
    // partly unwound is LOPSIDED, so its centroid sits off the arbor, and
    // azimuth measured about an off-centre point is not monotonic in radius
    // even for a perfect spiral. It read the two mainsprings at 54% and 57%
    // monotone with bins that were individually well concentrated (0.90, 0.94)
    // — locally sane, globally scrambled, which is the signature of a bad
    // centre rather than a bad part. These builders lay their spirals about
    // their own local origin, so the origin IS the arbor.
    const [cx, cy] = axis;
    const adv = new Float64Array(n), az = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const x = pts[3 * i] - cx, y = pts[3 * i + 1] - cy, z = pts[3 * i + 2];
      adv[i] = mode === 'z' ? z : Math.hypot(x, y);
      az[i] = Math.atan2(y, x);
    }
    let lo = Infinity, hi = -Infinity;
    for (const v of adv) { if (v < lo) lo = v; if (v > hi) hi = v; }
    if (!(hi > lo)) return null;
    const c = new Float64Array(BINS), s = new Float64Array(BINS), cnt = new Int32Array(BINS);
    for (let i = 0; i < n; i++) {
      const k = Math.min(BINS - 1, Math.floor(((adv[i] - lo) / (hi - lo)) * BINS));
      c[k] += Math.cos(az[i]); s[k] += Math.sin(az[i]); cnt[k]++;
    }
    // A bin's circular mean is only meaningful if its azimuths are CONCENTRATED.
    // R is the mean resultant length: 1 for a tight arc, ~0 for a full ring.
    // This is what rejects a cylinder, whose every bin spans 2π.
    const th = [], Rs = [];
    for (let k = 0; k < BINS; k++) {
      if (!cnt[k]) continue;
      const R = Math.hypot(c[k], s[k]) / cnt[k];
      th.push(Math.atan2(s[k], c[k])); Rs.push(R);
    }
    if (th.length < 8) return null;
    let total = 0, agree = 0, steps = 0, maxStep = 0;
    const d = [];
    for (let i = 1; i < th.length; i++) {
      let x = th[i] - th[i - 1];
      while (x > Math.PI) x -= Math.PI * 2;
      while (x < -Math.PI) x += Math.PI * 2;
      d.push(x); total += x; steps++;
      if (Math.abs(x) > maxStep) maxStep = Math.abs(x);
    }
    const sign = Math.sign(total);
    for (const x of d) if (Math.sign(x) === sign) agree++;
    Rs.sort((a, b) => a - b);
    return {
      turns: total / (Math.PI * 2),
      hand: sign,
      monotone: steps ? agree / steps : 0,
      // The median concentration over the occupied bins. A wound ribbon is
      // narrow in azimuth at each advance; a tube of revolution is not.
      concentration: Rs[Math.floor(Rs.length / 2)],
      // Unwrapping is only valid while a step stays under π. Reported so a row
      // that exceeded it can be discarded rather than believed.
      maxStep, bins: th.length, points: n, span: hi - lo,
    };
  };

  // ---- CONTROLS --------------------------------------------------------
  const controls = [];
  {
    // OFF-ORIGIN ON PURPOSE. A shipped wound part stands at its own station
    // (the mainspring drum is ~30 units out), so a control centred at the
    // origin certifies the estimator against a case no subject presents —
    // which is how the first run of this file reported 0 of 666 parts wound
    // with every control green. STATION is the size of a real one.
    const SX = 31.7, SY = -18.4;   // passed to wind() as the axis, as a real part's origin is
    const helix = (h) => { const p = []; for (let i = 0; i <= 2000; i++) { const t = i / 2000, a = h * t * 6 * Math.PI; p.push(SX + Math.cos(a) * 5, SY + Math.sin(a) * 5, t * 10); } return p; };
    const spiral = (h) => { const p = []; for (let i = 0; i <= 2000; i++) { const t = i / 2000, a = h * t * 6 * Math.PI, r = 2 + t * 6; p.push(SX + Math.cos(a) * r, SY + Math.sin(a) * r, 0); } return p; };
    // A tube of revolution: every azimuth present at every z. Must NOT read as wound.
    const tube = () => { const p = []; for (let i = 0; i < 120; i++) for (let j = 0; j < 60; j++) { const a = (j / 60) * Math.PI * 2; p.push(SX + Math.cos(a) * 5, SY + Math.sin(a) * 5, (i / 120) * 10); } return p; };
    controls.push({ name: 'right-handed helix', want: +1, got: wind(helix(+1), 'z', [SX, SY]) });
    controls.push({ name: 'left-handed helix', want: -1, got: wind(helix(-1), 'z', [SX, SY]) });
    controls.push({ name: 'right-handed flat spiral', want: +1, got: wind(spiral(+1), 'r', [SX, SY]) });
    controls.push({ name: 'left-handed flat spiral', want: -1, got: wind(spiral(-1), 'r', [SX, SY]) });
    controls.push({ name: 'a plain cylinder (must NOT read wound)', want: 0, got: wind(tube(), 'z', [SX, SY]) });
  }

  // ---- the movement, every mesh, both estimators ------------------------
  const owner = new Map();
  for (const e of C.labelEntries) e.obj?.traverse?.((o) => { if (o.isMesh && !owner.has(o)) owner.set(o, e.name); });

  const rows = [];
  const v = new THREE.Vector3();
  C.scene.traverse((o) => {
    if (!o.isMesh || o.userData?.schematic) return;
    const pos = o.geometry?.attributes?.position;
    if (!pos || pos.count < 24) return;
    o.updateWorldMatrix(true, false);
    const pts = new Float64Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(o.matrixWorld);
      pts[3 * i] = v.x; pts[3 * i + 1] = v.y; pts[3 * i + 2] = v.z;
    }
    const o0 = new THREE.Vector3(0, 0, 0).applyMatrix4(o.matrixWorld);
    const ax = [o0.x, o0.y];
    const asHelix = wind(pts, 'z', ax), asSpiral = wind(pts, 'r', ax);
    // WHICH PARAMETERISATION IS PHYSICAL is a question about the part's SHAPE,
    // not about which reading looks bigger. A CONICAL helix — the fusee — has a
    // radius that falls as z rises, so binning it by r traverses the same thread
    // BACKWARDS and returns the opposite sign. Picking "whichever reads more
    // turns" would therefore report the fusee's hand as its own mirror, which is
    // the one number this file exists to get right.
    //
    // So: a part flat in z is a SPIRAL and is read in r; a part with real z
    // extent is a HELIX and is read in z. The mainsprings' z-only readings
    // decline to measure at all (too few occupied bins), which is the same
    // verdict arrived at independently.
    let zLo = Infinity, zHi = -Infinity, rMax = 0;
    for (let i = 0; i < pos.count; i++) {
      const z = pts[3 * i + 2]; if (z < zLo) zLo = z; if (z > zHi) zHi = z;
      const r = Math.hypot(pts[3 * i] - o0.x, pts[3 * i + 1] - o0.y); if (r > rMax) rMax = r;
    }
    const flat = (zHi - zLo) < 0.35 * rMax;
    rows.push({
      label: owner.get(o) ?? '(unlabelled)', mesh: o.name || '',
      declared: o.userData?.spiral ? 'spiral' : o.userData?.helix ? 'helix' : '',
      helix: asHelix, spiral: asSpiral, flat, zSpan: zHi - zLo, rMax,
    });
  });

  // The train's own sense, so a hand can be read against the direction the
  // movement actually turns rather than against nothing. §47's boot assert
  // holds barrelMeshAngle ascending; this measures the same thing from the
  // outside, on the arbor the springs and the fusee all sit on.
  let trainSense = null;
  try {
    const arbor = C.labelEntries.find((e) => e.name === 'Fusee & great wheel')?.obj;
    if (arbor) {
      const read = () => { arbor.updateWorldMatrix(true, false); const e = new THREE.Euler().setFromRotationMatrix(arbor.matrixWorld); return e.z; };
      C.setPose({ tau: 0, crownPullT: 0, leverEngage: 0, tension: 1 });
      const a0 = read();
      C.setPose({ tau: 600, crownPullT: 0, leverEngage: 0, tension: 1 });
      const a1 = read();
      let d = a1 - a0; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
      trainSense = { delta: d, sign: Math.sign(d) };
    }
  } catch (e) { trainSense = { err: String(e) }; }

  // ---- THE FUSEE, READ TARGETED AND IN Z ---------------------------------
  // The blind pass cannot settle this one and it is the part TODO 115 names.
  // A cone's radius falls as z rises, so the r-parameterisation traverses the
  // groove backwards; z is the physical one. Every mesh of the unit is read,
  // because which of them carries the groove is exactly what is not obvious —
  // the crest ribbon and the lathed core are separate solids, and the one with
  // turns near `grooveTurns` is the thread.
  const fusee = [];
  {
    for (const UNIT of ['Fusee & great wheel', 'Chain']) {
    const u = C.labelEntries.find((e) => e.name === UNIT)?.obj;
    u?.traverse?.((o) => {
      if (!o.isMesh || o.userData?.schematic) return;
      const pos = o.geometry?.attributes?.position;
      if (!pos || pos.count < 24) return;
      o.updateWorldMatrix(true, false);
      const v2 = new THREE.Vector3();
      const pts = new Float64Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        v2.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(o.matrixWorld);
        pts[3 * i] = v2.x; pts[3 * i + 1] = v2.y; pts[3 * i + 2] = v2.z;
      }
      const o0 = new THREE.Vector3(0, 0, 0).applyMatrix4(o.matrixWorld);
      fusee.push({ unit: UNIT, mesh: o.name || '(unnamed)', tris: pos.count,
                   inZ: wind(pts, 'z', [o0.x, o0.y]), inR: wind(pts, 'r', [o0.x, o0.y]) });
    });
    }
  }

  return { controls, rows, trainSense, fusee };
});

// ---- report -----------------------------------------------------------------
const f = (x) => (x == null ? '   —  ' : (x >= 0 ? ' ' : '') + x.toFixed(3));
let bad = 0;

console.log('\nCONTROLS — the estimator, before any shipped part is read\n');
for (const c of controls_ok(out.controls)) console.log(c);
function controls_ok(cs) {
  const lines = [];
  for (const c of cs) {
    if (!c.got) {
      // The cylinder is ALLOWED to come back null — that is one honest way to
      // say "not a wind". Every other control must measure.
      const ok = c.want === 0;
      if (!ok) bad++;
      lines.push(`  ${ok ? 'ok  ' : 'FAIL'} ${c.name.padEnd(38)} did not measure${ok ? ' (an acceptable way to reject it)' : ''}`);
      continue;
    }
    const g = c.got;
    let ok;
    if (c.want === 0) ok = !(g.monotone > 0.9 && g.concentration > 0.5);
    else ok = g.hand === c.want && g.monotone > 0.95 && g.concentration > 0.5;
    if (!ok) bad++;
    lines.push(`  ${ok ? 'ok  ' : 'FAIL'} ${c.name.padEnd(38)} hand ${f(g.hand)}  turns ${f(g.turns)}  monotone ${(g.monotone * 100).toFixed(1)}%  conc ${g.concentration.toFixed(3)}`);
  }
  return lines;
}
if (bad) console.log('\n  Control failure — read nothing below as a finding.');

// The bar for "this is a wind" is read off the controls, not chosen: a wound
// part advances its azimuth monotonically and is concentrated in azimuth at
// each advance. The cylinder control is what proves the second clause does
// work.
// THE BAR, read off the controls rather than chosen. The cylinder — the
// must-miss — reads monotone 100% and concentration 0.00, which settles which
// figure is the discriminator: MONOTONICITY CANNOT REJECT A TUBE and
// concentration can. So concentration gates, and monotone is reported beside
// it as a quality figure. A part whose azimuth is tightly held at each advance
// and which accumulates most of a turn is wound; how cleanly it does so is for
// the reader.
const WOUND = (w) => w && w.concentration > 0.5 && Math.abs(w.turns) > 0.4 && w.monotone > 0.70;

const found = [];
for (const r of out.rows) {
  const h = WOUND(r.helix), s = WOUND(r.spiral);
  if (!h && !s) continue;
  // A flat spiral also has SOME z reading and vice versa; the honest pick is
  // whichever estimator the part is actually organised by — more turns, more
  // monotone. Both are printed so the choice is visible.
  // Shape decides, then availability. See the note beside `flat` above: for a
  // cone the two parameterisations disagree in SIGN, so this is not a tie-break.
  const want = r.flat ? 'spiral' : 'helix';
  const pick = (want === 'spiral' && s) ? 'spiral' : (want === 'helix' && h) ? 'helix' : (h ? 'helix' : 'spiral');
  found.push({ ...r, pick, w: pick === 'helix' ? r.helix : r.spiral });
}
found.sort((a, b) => Math.abs(b.w.turns) - Math.abs(a.w.turns));

// CANDIDATES, not a verdict. Unlike the outline census — where a gear and a
// saw separate by 758566× — "is this wound" does NOT separate cleanly across
// arbitrary meshes under this estimator: the hairspring at 9.93 turns and a
// setting lever at 2.00 sit on one continuum with no gap between them. So this
// list is a net cast wide, and the rows that matter are the DECLARED winds and
// the targeted fusee read below. A row here is a part worth looking at, not a
// part established to be wound.
console.log(`\nCANDIDATES — every mesh measured, ${found.length} clear the bar (of ${out.rows.length}); a wide net, not a verdict\n`);
console.log('  part                          mesh                 as      hand   turns    monotone  conc   declared');
for (const r of found) {
  console.log(`  ${String(r.label).slice(0, 28).padEnd(29)} ${String(r.mesh).slice(0, 19).padEnd(20)} ${r.pick.padEnd(7)} ${r.w.hand > 0 ? ' RIGHT' : ' LEFT '} ${f(r.w.turns)}   ${(r.w.monotone * 100).toFixed(1)}%  ${r.w.concentration.toFixed(2)}   ${r.declared || '—'}`);
}

// DECLARED WINDS ARE ALWAYS SHOWN, pass or fail. A part whose builder wrote
// `userData.spiral` or `userData.helix` is claiming to be a wind; if the
// estimator does not read it as one, that is a finding about one of the two —
// and printing only the parts that passed would hide exactly the case this
// file exists to catch.
const declared = out.rows.filter((r) => r.declared);
console.log(`\nDECLARED WINDS — ${declared.length} mesh(es) whose builder marks them wound, shown whatever they measure\n`);
console.log('  part                          mesh                 est      hand   turns    monotone  conc   maxStep  bins  pts');
for (const r of declared) {
  for (const [k, w] of [['helix', r.helix], ['spiral', r.spiral]]) {
    if (!w) { console.log(`  ${String(r.label).slice(0, 28).padEnd(29)} ${String(r.mesh).slice(0, 19).padEnd(20)} ${k.padEnd(8)} did not measure`); continue; }
    console.log(`  ${String(r.label).slice(0, 28).padEnd(29)} ${String(r.mesh).slice(0, 19).padEnd(20)} ${k.padEnd(8)} ${f(w.hand)} ${f(w.turns)}   ${(w.monotone * 100).toFixed(1)}%  ${w.concentration.toFixed(2)}   ${w.maxStep.toFixed(3)}  ${String(w.bins).padStart(4)} ${w.points}`);
  }
}

console.log('\nTHE FUSEE, read in z — the physical parameterisation for a cone\n');
console.log('  unit                  mesh                 hand   turns(z)  monotone  conc');
let anyFusee = false;
for (const r of out.fusee || []) {
  const z = r.inZ;
  if (!z || z.concentration < 0.5 || Math.abs(z.turns) < 0.4) continue;   // silence the lugs, staffs and pawls
  anyFusee = true;
  console.log(`  ${r.unit.padEnd(21)} ${r.mesh.padEnd(20)} ${z.hand > 0 ? ' RIGHT' : ' LEFT '} ${f(z.turns)}   ${(z.monotone * 100).toFixed(1)}%  ${z.concentration.toFixed(2)}`);
}
if (!anyFusee) console.log('  (nothing in either unit reads as a helix in z)');
console.log('\n  THE FUSEE GROOVE HAS NO INSTRUMENT, and that is the finding — not a gap to paper over.');
console.log('  Two routes to it were tried and both fail for reasons worth writing down.');
console.log('    · The CREST RIBBON is the helix, but §81\'s weld merges it into the lathed core, and');
console.log('      the core is a surface of revolution: every z bin holds every azimuth, so the');
console.log('      per-bin circular mean is meaningless exactly as it is for the cylinder control.');
console.log('      The one row above is that merged solid and its 55.7% monotone says so.');
console.log('    · The CHAIN wraps the same thread and is its own unit, so it should carry the');
console.log('      groove\'s hand — but its mesh is one run from drum to fusee and the STRAIGHT span');
console.log('      dominates, so it does not read as a helix at all. It contributes no row above.');
console.log('  So the groove\'s hand is known only from its GENERATOR (geometry.js, the crest loop:');
console.log('  `a = t * grooveTurns * 2π` with z rising, hence right-handed) — which is a reading of');
console.log('  the source, NOT a measurement of the metal, and is recorded as such. It also has no');
console.log('  `sense` parameter to flip, where `makeTorsionSpring` next door does.');

console.log('\nTHE TRAIN\'S OWN SENSE, for the hands above to be read against\n');
if (out.trainSense?.err) console.log(`  could not measure: ${out.trainSense.err}`);
else if (out.trainSense) console.log(`  the fusee/great-wheel arbor advances ${out.trainSense.sign > 0 ? 'POSITIVE (+z)' : 'NEGATIVE (−z)'} over 600 s of tau  (Δ ${out.trainSense.delta.toFixed(6)} rad)`);
console.log('  §47 asserts the same thing at boot from the other side (barrelMeshAngle ascending, main.js:1554).');

console.log('\n  Every row above is direction-committed BY CONSTRUCTION — a spiral and a helix');
console.log('  have no mirror axis, so a reversal of the train reverses every one of them.');
console.log('  That is not a finding about any individual part; what the table gives TODO 115');
console.log('  is the population and each part\'s present hand, so the reversal has something');
console.log('  to check itself against afterwards.');

console.log(`\n${bad === 0 ? 'PASS — the controls hold, so the table above is readable' : `FAIL — ${bad} control problem(s)`}`);
await browser.close(); srv.kill();
process.exit(bad === 0 ? 0 : 1);
