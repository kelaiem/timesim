// IS THIS PART HANDED? — the three couplings TODO 115 named as unmeasured.
//
// TODO 115 would reverse the going train's sense. Three mechanisms hang off
// that train and were filed as NOT MEASURED rather than claimed either way:
// the alarm release trip (its disc tracks the hour wheel, so its ramp was
// suspected direction-committed), the heart cam's reset flanks, and the
// minute jumper's lift. This measures them, so the item's scope stops being
// a guess.
//
// THE QUESTION, put so one measurement answers it for every part: a cut that
// has a MIRROR AXIS works the same driven either way; a cut with no mirror
// axis is handed and must be mirrored in any reversal. So this does not look
// for a notch, a ramp or a tooth — it searches every candidate axis and
// reports the best one. A saw has none; a gear has one per tooth.
//
// It is NOT probe-reset-contact.mjs, the nearest miss, which measures WHEN
// the heart's roller reaches metal and how far the cam then rides. That one
// asks whether the contact happens; this asks whether the flank it happens on
// is the same on both sides. Nor is it probe-173-jumper.mjs (the sautoir's
// seat against what the click failed) or probe-137-jumper-envelope.mjs (the
// swept envelope along the alarm link's chord) — both are about where the
// jumper reaches, not about whether its star is symmetric.
//
// HOW IT MEASURES. Each part's cut is read from the AUTHORED SHAPE the extrude
// still carries in `parameters.shapes` (the fact TODO 100's outline gate is
// built on), walked along its EDGES into a max-radius-per-bin profile over 3600
// bins. Edges of the outline, never triangulation chords, so the cap masking
// `measuredToothPhase`'s header records cannot reach this; and an azimuth the
// outline never covers is real ABSENCE of metal, scored r = 0, which is what
// makes the alarm track's notch legible at all.
//
// The first draft binned the mesh's VERTICES instead, to dodge that same
// masking, and walked into the other trap in the same list — vertices are not
// the surface. The alarm track's absarc carries 26 of them, so 26 of 720 bins
// had metal and the profile was noise; the gear control then read WORSE than
// the saw. Both controls failed, which is the only reason that draft is not
// what this file reports.
//
// The residual for a candidate axis is the mean |r(axis+φ) − r(axis−φ)| over
// the whole profile, normalised by that profile's own radial swing
// (max − min), so a 0.14 rad gap in an annulus and a tooth flank are on one
// scale. A part is SYMMETRIC if its best axis residual falls under the bar.
//
// CONTROLS, both kinds, and the bar is read off THEM rather than chosen:
//   · must-be-SYMMETRIC — a plain gear, whose flanks the generator cuts alike;
//   · must-be-HANDED — a ratchet saw, which `makeRatchetAndClick` documents as
//     handed on purpose ("the RAMP must be the flank the working direction
//     climbs and the steep FACE the flank that catches the reverse").
// If those two do not separate, nothing below is readable.
//
// A SECOND TIER asks the same question of the LAWS, because a symmetric cut
// read by a handed law is still handed: the alarm's pin drop and the jumper's
// lever angle are swept about their working points and tested for evenness.
// The heart's law is not swept here — its own tick expression takes
// `Math.sign(off)` against a free-angle table that is a function of DISTANCE
// alone, so it has no side to prefer; that is reported from the source, not
// measured, and is marked as such.
//
// ACCEPTANCE — exits non-zero if a control fails or a subject is judged on a
// profile too sparse to read. The subjects' own verdicts are REPORTED: what
// they feed is TODO 115's scope, not a gate.
// Run from tools/ with a Playwright Chromium: `node probe-handedness.mjs`.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const port = process.env.PORT || '8507';
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'], { cwd: process.env.ROOT || '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });

const out = await page.evaluate(() => {
  const C = window.__clock;
  const unit = (n) => C.labelEntries.find((e) => e.name === n)?.obj ?? null;
  const named = (nm) => { let f = null; C.scene.traverse((o) => { if (!f && o.name === nm && o.isMesh) f = o; }); return f; };

  const BINS = 3600;

  // THE PROFILE COMES FROM THE AUTHORED OUTLINE, not from the mesh's vertices.
  // The first draft of this probe binned vertices, to dodge the cap-chord
  // masking `measuredToothPhase`'s header records — and walked straight into
  // the other trap in the same list: vertices are not the surface. The alarm
  // track's absarc carries 26 vertices, so 26 of 720 bins had metal and the
  // profile was noise. Both controls failed, which is the only reason that
  // draft is not what this file reports.
  //
  // `ExtrudeGeometry` keeps what it was handed in `parameters.shapes` (the
  // same fact TODO 100's outline gate is built on), so the CUT ITSELF is
  // readable: take its points, then walk its EDGES — genuine outline segments,
  // never triangulation chords — subsampling finer than a bin.
  const outlineOf = (mesh) => {
    const sh = mesh?.geometry?.parameters?.shapes;
    const shape = Array.isArray(sh) ? sh[0] : sh;
    if (!shape?.getPoints) return null;
    return shape.getPoints(64).map((p) => [p.x, p.y]);
  };
  const profileOfOutline = (pts) => {
    const R = new Float64Array(BINS);
    const seen = new Uint8Array(BINS);
    const put = (x, y) => {
      const r = Math.hypot(x, y);
      let th = Math.atan2(y, x); if (th < 0) th += Math.PI * 2;
      const k = Math.min(BINS - 1, (th / (Math.PI * 2) * BINS) | 0);
      seen[k] = 1;
      if (r > R[k]) R[k] = r;
    };
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
      // Subdivide so no step can skip a bin, in azimuth or in radius.
      const da = Math.abs(Math.atan2(by, bx) - Math.atan2(ay, ax));
      const span = Math.min(da, Math.PI * 2 - da);
      const steps = Math.max(2, Math.ceil(span / (Math.PI * 2 / BINS)) * 4);
      for (let t = 0; t <= steps; t++) put(ax + (bx - ax) * t / steps, ay + (by - ay) * t / steps);
    }
    let populated = 0;
    for (let k = 0; k < BINS; k++) if (seen[k]) populated++;
    return { R, populated };
  };

  // The mirror search: the best axis and its residual, plus the RUNNER-UP
  // among axes at least a tenth of a turn away, so a part with many mirror
  // axes (a gear) is distinguishable from one with a single one (a heart).
  const mirror = ({ R }) => {
    let max = 0, min = Infinity;
    for (const r of R) { if (r > max) max = r; if (r < min) min = r; }
    const swing = max - min;
    if (!(swing > 0)) return null;
    const half = BINS / 2;
    // R sampled at a FRACTIONAL index, so the axis is not quantised to a bin.
    // Without this the residual is dominated by how far the best bin happens
    // to sit from the true axis: half a bin against a tooth flank's slope,
    // which at 720 bins put the gear control at 0.056 and the star — symmetric
    // by construction — at 0.433. The measurement was reading its own grid.
    const at = (x) => {
      const f = ((x % BINS) + BINS) % BINS;
      const i = Math.floor(f), t = f - i;
      return R[i] * (1 - t) + R[(i + 1) % BINS] * t;
    };
    const residAt = (k0) => {
      let s = 0;
      for (let d = 1; d <= half; d++) s += Math.abs(at(k0 + d) - at(k0 - d));
      return s / half / swing;
    };
    const resid = new Float64Array(BINS);
    for (let k0 = 0; k0 < BINS; k0++) resid[k0] = residAt(k0);
    let best = 0;
    for (let k = 1; k < BINS; k++) if (resid[k] < resid[best]) best = k;
    // Refine within ±1 bin of the coarse winner.
    let bestF = best, bestV = resid[best];
    for (let j = -100; j <= 100; j++) {
      const x = best + j / 100, v = residAt(x);
      if (v < bestV) { bestV = v; bestF = x; }
    }
    resid[best] = bestV;
    const apart = Math.round(BINS / 10);
    let second = -1;
    for (let k = 0; k < BINS; k++) {
      const dk = Math.min(Math.abs(k - best), BINS - Math.abs(k - best));
      if (dk < apart) continue;
      if (second < 0 || resid[k] < resid[second]) second = k;
    }
    return {
      best: bestV, bestAz: (bestF / BINS) * 360,
      second: second < 0 ? null : resid[second],
      secondAz: second < 0 ? null : (second / BINS) * 360,
      swing, max, min,
    };
  };

  // The named mesh that actually carries an extruded outline — a gear group
  // names its hub too, and a cylinder never had a shape to read.
  const namedExtrude = (nm) => {
    let f = null;
    C.scene.traverse((o) => {
      if (f || !o.isMesh || o.name !== nm) return;
      if (o.geometry?.parameters?.shapes) f = o;
    });
    return f;
  };

  // ---- the parts -------------------------------------------------------
  const rows = [];
  const add = (kind, label, mesh, note) => {
    if (!mesh) { rows.push({ kind, label, err: 'no handle', note }); return; }
    const pts = outlineOf(mesh);
    if (!pts) { rows.push({ kind, label, err: 'no authored shape on this geometry', note }); return; }
    const p = profileOfOutline(pts);
    const m = mirror(p);
    if (!m) { rows.push({ kind, label, err: 'flat profile — nothing to mirror', note }); return; }
    rows.push({ kind, label, ...m, verts: pts.length, populated: p.populated, note });
  };

  // CONTROLS
  add('control-sym', 'a gear (setting wheel)', namedExtrude('settingWheel'),
    'flanks cut alike by the generator — must have a mirror axis');
  add('control-handed', 'a ratchet saw (alarm arbor)', namedExtrude('alarmArborRatchet'),
    'handed on purpose: ramp one side, cliff the other — must have none');

  // SUBJECTS — TODO 115's three
  add('subject', 'alarm release track + notch', namedExtrude('alarmDiscTrack'),
    "the notch is the ABSENCE of track, cut bevelEnabled:false — no ramp exists to be handed");
  // The heart is a Group; take the widest extruded mesh under its unit.
  let heart = null;
  {
    const u = unit('Heart cam (seconds reset)');
    if (u) u.traverse((o) => {
      if (!o.isMesh || o.geometry?.type !== 'ExtrudeGeometry') return;
      o.geometry.computeBoundingBox?.();
      const b = o.geometry.boundingBox;
      const span = b ? Math.max(b.max.x - b.min.x, b.max.y - b.min.y) : 0;
      if (!heart || span > heart.span) heart = { o, span };
    });
  }
  add('subject', 'heart cam (seconds reset)', heart?.o ?? null,
    'r(θ) = rMin + (R−rMin)(1−cos θ)/2 — even in θ by construction');
  add('subject', 'minute jumper star', namedExtrude('star'),
    'tip at i/N, valley at (i+0.5)/N — equal flanks by construction');
  // THE BEAK IS NOT A ROTOR, so a full-circle axis is the wrong question for
  // it: its outline is a small blob that does not enclose the pivot. The right
  // one is whether a MIRROR LINE through the pivot maps the outline onto
  // itself — that is what decides whether the V rides a star tooth the same
  // way from either side. Searched over every line, reported as the worst
  // point's miss as a fraction of the beak's reach.
  let beakOutline = null;
  {
    const u = unit('Minute jumper');
    if (u) u.traverse((o) => { if (!beakOutline && Array.isArray(o.userData?.outline)) beakOutline = o.userData.outline; });
  }
  let beak = null;
  if (beakOutline && beakOutline.length >= 3) {
    const reach = Math.max(...beakOutline.map(([x, y]) => Math.hypot(x, y)));
    let best = Infinity, bestA = 0;
    for (let i = 0; i < 720; i++) {
      const a = (i / 720) * Math.PI, c = Math.cos(2 * a), sn = Math.sin(2 * a);
      let worst = 0;
      for (const [x, y] of beakOutline) {
        const rx = c * x + sn * y, ry = sn * x - c * y;   // reflect about the line at angle a
        let near = Infinity;
        for (const [px, py] of beakOutline) near = Math.min(near, Math.hypot(rx - px, ry - py));
        if (near > worst) worst = near;
      }
      if (worst < best) { best = worst; bestA = a; }
    }
    beak = { miss: best / reach, axisDeg: (bestA * 180) / Math.PI, points: beakOutline.length, reach };
  }

  // ---- TIER TWO: are the LAWS even about their working point? ----------
  // One helper for both mechanisms, because the naive "find the maximum"
  // is wrong for one of them in each direction: the alarm's pin drop is 0
  // almost everywhere and PEAKS at the notch, while the jumper's lever is
  // SEATED almost everywhere and moves away from that seat at a tooth. So the
  // working point is the sample furthest from the response's MEDIAN, which is
  // the same rule for both. Around a saturated extreme it is the plateau's
  // midpoint, never its first sample — comparing ±k about an edge reads a
  // saturated side against a falling one and looks exactly like a handed law.
  //
  // The verdict is |Δ| against the LOCAL SAMPLE STEP as well as the signal: at
  // a fine enough sweep the two sides can still land one grid step apart, and
  // one step is the sweep's resolution, not an asymmetry.
  const evenness = (label, sample, N) => {
    const vals = new Array(N);
    for (let i = 0; i < N; i++) vals[i] = sample(i);
    if (vals.some((v) => !Number.isFinite(v))) return { label, err: 'the response did not read' };
    const sorted = [...vals].sort((a, b) => a - b);
    const median = sorted[Math.floor(N / 2)];
    let ext = 0;
    for (let i = 1; i < N; i++) if (Math.abs(vals[i] - median) > Math.abs(vals[ext] - median)) ext = i;
    const extVal = vals[ext], eps = 1e-12;
    let lo = ext, hi = ext;
    while (lo > 0 && Math.abs(vals[lo - 1] - extVal) <= eps) lo--;
    while (hi < N - 1 && Math.abs(vals[hi + 1] - extVal) <= eps) hi++;
    // Offsets are counted from the plateau's own EDGES, not from its centre.
    // Rounding centre ± half ± k puts the two sides on different samples when
    // the plateau has an even width, which showed up as a single |Δ| at ±1
    // with exact zeros after it — an indexing artifact wearing the shape of an
    // asymmetry.
    const pairs = [];
    for (let k = 1; k <= 6; k++) {
      const pi = hi + k, mi = lo - k;
      if (pi >= N || mi < 0) break;
      pairs.push({ k, plus: vals[pi], minus: vals[mi], diff: Math.abs(vals[pi] - vals[mi]) });
    }
    // Local resolution: the typical sample-to-sample step where the response
    // is actually MOVING. Zero steps are excluded — a window that happens to
    // sit on a flat would otherwise report a grid of 0 and make every
    // difference look larger than the resolution.
    const steps = [];
    for (let i = hi + 1; i < Math.min(N - 1, hi + 200); i++) {
      const d = Math.abs(vals[i + 1] - vals[i]);
      if (d > 1e-12) steps.push(d);
    }
    steps.sort((a, b) => a - b);
    const grid = steps.length ? steps[Math.floor(steps.length / 2)] : 0;
    const signal = Math.abs(extVal - median);
    const worst = pairs.length ? Math.max(...pairs.map((p) => p.diff)) : NaN;
    return { label, median, extVal, signal, plateau: hi - lo + 1, pairs, worst, grid };
  };

  const lawRows = [];
  {
    const base = { crownPullT: 0, leverEngage: 0, tension: 1, alarmOn: 1, alarmCrownPullT: 0, alarmCrownRotation: 0 };
    const N = 4000, SPAN = 12 * 3600;
    lawRows.push(evenness('alarm pin drop, either side of the notch floor',
      (i) => { C.setPose({ ...base, tau: (i / N) * SPAN }); return C.alarmPinDrop; }, N));
  }
  {
    // THE BEAK ONLY RIDES THE STAR WITH THE CROWN PULLED. With it in, the tick
    // holds the lever clear by the derived lift — a CONSTANT — so a sweep at
    // crownPullT 0 reads one number at every sample. And the mover is found
    // over the WHOLE sweep, not from two samples: the ride is a narrow window
    // either side of each tooth tip, and a two-sample search lands in the flat
    // between them. It did — 13 candidates, 0 movers, at both crown states.
    const base = { crownPullT: 1, leverEngage: 1, tension: 1 };
    const u = unit('Minute jumper');
    const cands = [];
    if (u) u.traverse((o) => { if (o !== u) cands.push(o); });
    const N = 4000, SPAN = 120;
    const lo0 = cands.map(() => Infinity), hi0 = cands.map(() => -Infinity);
    for (let i = 0; i < N; i++) {
      C.setPose({ ...base, tau: (i / N) * SPAN });
      cands.forEach((o, j) => { const z = o.rotation.z; if (z < lo0[j]) lo0[j] = z; if (z > hi0[j]) hi0[j] = z; });
    }
    let lever = null, moved = 0;
    cands.forEach((o, j) => { const d = hi0[j] - lo0[j]; if (d > moved) { moved = d; lever = o; } });
    const row = evenness('jumper lever angle, either side of a star tooth',
      (i) => { C.setPose({ ...base, tau: (i / N) * SPAN }); return lever ? lever.rotation.z : NaN; }, N);
    lawRows.push({ ...row, moved, lever: lever?.name || lever?.type || null });
  }
  return { rows, lawRows, beak };
});

const f = (x, n = 5) => (x === null || x === undefined || Number.isNaN(x) ? '   —  ' : (x >= 0 ? ' ' : '') + x.toFixed(n));
let bad = 0;

console.log('\nMIRROR SEARCH — best axis residual, as a fraction of each profile\'s own radial swing');
console.log('(0 = a perfect mirror axis exists; a handed cut has none anywhere. The RUNNER-UP is the\nbest axis a tenth of a turn away: small for a gear, which has one per tooth; large for a\nheart or a notch, which have exactly one.)\n');
console.log('  kind           part                          best      at°     runner-up   verts  bins');
for (const r of rows(out)) {
  if (r.err) { console.log(`  ${r.kind.padEnd(14)} ${r.label.padEnd(28)} ERROR — ${r.err}`); bad++; continue; }
  console.log(`  ${r.kind.padEnd(14)} ${r.label.padEnd(28)} ${f(r.best)}  ${r.bestAz.toFixed(1).padStart(6)}   ${f(r.second)}  ${String(r.verts).padStart(6)} ${String(r.populated).padStart(5)}`);
  if (r.note) console.log(`  ${' '.repeat(14)} ${r.note}`);
  // A profile nobody populated cannot be mirrored meaningfully.
  // A full-circle mirror test presumes the outline ENCLOSES the axis. The one
  // legitimate shortfall is the alarm track, whose notch is a real gap; a
  // profile covering much less than that is a part this test does not fit.
  if (r.populated < 0.9 * 3600) { console.log(`  ${' '.repeat(14)} FAIL — the outline covers only ${r.populated} of 3600 azimuths; it does not enclose the axis, so a full-circle mirror axis is not the right question for it`); bad++; }
}
function rows(o) { return o.rows; }

const sym = out.rows.find((r) => r.kind === 'control-sym');
const handed = out.rows.find((r) => r.kind === 'control-handed');
console.log('\nCONTROLS\n');
let ctlBad = 0;
if (!sym || sym.err || !handed || handed.err) { console.log('  FAIL — a control did not measure'); ctlBad++; }
else {
  const sep = handed.best / (sym.best || 1e-9);
  const ok = handed.best > 4 * sym.best;
  if (!ok) ctlBad++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} the two controls separate: gear ${f(sym.best)} vs saw ${f(handed.best)}  (${sep.toFixed(1)}×)`);
  console.log(`       the BAR is read off them, not chosen: midpoint ${f((sym.best + handed.best) / 2)}`);
  const BAR = (sym.best + handed.best) / 2;
  console.log('\nVERDICTS — subjects against that bar\n');
  for (const r of out.rows.filter((x) => x.kind === 'subject' && !x.err)) {
    const symmetric = r.best < BAR;
    console.log(`  ${symmetric ? 'SYMMETRIC' : 'HANDED   '}  ${r.label.padEnd(28)} ${f(r.best)}  (mirror axis at ${r.bestAz.toFixed(1)}°)`);
  }
}
bad += ctlBad;
if (ctlBad) console.log('\n  Control failure — the mirror test cannot tell a gear from a saw here, so read nothing above as a finding.');

if (out.beak) {
  const ok = out.beak.miss < 0.01;
  console.log(`\nTHE BEAK — a mirror LINE through the pivot, not a full-circle axis (its outline does not enclose one)\n`);
  console.log(`  ${ok ? 'SYMMETRIC' : 'HANDED   '}  minute jumper beak            worst point misses its reflection by ${(out.beak.miss * 100).toFixed(4)}% of reach ${out.beak.reach.toFixed(3)} (line at ${out.beak.axisDeg.toFixed(1)}°, ${out.beak.points} points)`);
} else { console.log('\n  FAIL — no beak outline found under Minute jumper'); bad++; }

console.log('\nLAWS — is the response EVEN about its working point?\n');
for (const l of out.lawRows) {
  console.log(`  ${l.label}`);
  if (l.err) { console.log(`     FAIL — ${l.err}`); bad++; continue; }
  console.log(`     median ${f(l.median)}, working value ${f(l.extVal)} (signal ${f(l.signal)}), plateau ${l.plateau} sample(s)${l.lever ? `, mover "${l.lever}" range ${f(l.moved)}` : ''}`);
  for (const p of l.pairs) console.log(`     ±${p.k} beyond it   + ${f(p.plus)}   − ${f(p.minus)}   |Δ| ${f(p.diff)}`);
  if (!(l.signal > 1e-9)) { console.log(`     FAIL — the response does not move away from its median; this row measures nothing`); bad++; continue; }
  if (!(l.grid > 0)) { console.log(`     FAIL — no moving sample near the working point, so the sweep's own resolution is unknown and |Δ| cannot be judged against it`); bad++; continue; }
  const inGrid = l.worst <= 1.5 * l.grid;
  console.log(`     worst |Δ| ${f(l.worst)}  = ${(l.worst / l.signal * 100).toFixed(2)}% of the signal, and ${l.grid > 0 ? (l.worst / l.grid).toFixed(2) : '—'}× the sweep's own sample step ${f(l.grid)}`);
  console.log(`     ⇒ ${inGrid ? 'EVEN — the two sides differ by no more than the grid they were sampled on' : 'UNEVEN — the difference exceeds the sampling resolution'}`);
}

console.log('\n  The heart cam\'s law is NOT swept here and is reported from source: the tick takes');
console.log('  Math.sign(off) against heartFreeAngleAt(d), a table of DISTANCE alone, so it has no');
console.log('  side to prefer. Its METAL is measured above; its law is read, not measured.');

console.log(`\n${bad === 0 ? 'PASS' : `FAIL — ${bad} problem(s)`}`);
await browser.close(); srv.kill();
process.exit(bad === 0 ? 0 : 1);
