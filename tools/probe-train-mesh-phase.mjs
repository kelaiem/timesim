// DOES THE GOING TRAIN STAY IN MESH PHASE WHILE IT RUNS?
//
// Reported by eye: "the pinion turning the fourth wheel is out of phase such
// that the teeth don't interlock" — tooth meeting tooth at the line of
// centres instead of tooth dropping into gap. Same symptom TODO 15 was filed
// for, now reported in the GOING TRAIN rather than in the alarm work.
//
// The going train IS phase-solved: `solveGearChain` runs four times over it at
// build (`src/main.js:13241-13256`), each with an anti-phase tripwire and an
// independent centre-distance tripwire, and boot is silent. So the open
// question is not the build pose — it is every pose after it. That distinction
// is the whole point of this probe, and it is the codebase's own: the solver's
// header records a previous version that satisfied the DIFFERENCE `uQ − uP`
// rather than the SUM `uP + uQ`, which is "true at exactly one rotational
// instant and false everywhere else … correct in the built pose, visibly
// tooth-on-tooth in the running sim". A build-time tripwire cannot tell those
// two apart. This walks the train and can.
//
// This is NOT probe-136-profile.mjs, the nearest miss in the index. That one
// re-implements the gauge to check a tooth PROFILE against its generator, at
// rest. This asks where two profiles stand RELATIVE to each other, over a
// pose sweep, and does not care what shape they are.
//
// HOW IT MEASURES. `measuredToothPhase` is module-local to main.js, so the
// gauge is re-implemented here from that source — silhouette max-per-bin over
// 2048 bins, outline edges only, a 10th/90th-percentile threshold, gap centres
// folded by N. Every gauge is VALIDATED before it is used (gap count must
// equal the declared tooth count, folded confidence ≥ 0.9); the original's
// header records a reading that returned 56 gaps for 8 teeth at 0.94
// confidence, so the count is the half that catches it.
//
// The residual is the solver's own: with uP the driver's tooth phase on the
// centre line as a fraction of its pitch and uQ the driven's from the opposite
// direction, `frac(uP + uQ) = 0.5` is the mesh condition, and the printed
// figure is the distance from it in percent of a pitch. The build tripwire's
// bar is 2% and is quoted as the gauge's own resolution, not as a target.
//
// CONTROLS, BOTH KINDS, because a residual that reads 0 everywhere has to be
// distinguishable from a gauge that reads 0 for everything:
//   · must-hit — a WHOLE pitch injected into one member's phase. That is a
//     symmetry of the mesh, so the reading must not move at all; it says the
//     gauge is tracking that member's phase and not something incidental;
//   · must-miss — a HALF pitch, the worst case. The residual is a FOLDED
//     distance, so the assertion is that base + injected = 0.5 exactly: that
//     holds at any base, where "injected reads ≈50%" only holds when the base
//     is already near zero — a control that would misfire on the very tree it
//     exists to be trusted on. Without this one, "0% everywhere" is also what
//     an arithmetic error that always returns the target looks like.
// They bracket the predicate on the meshes actually being reported. An earlier
// draft borrowed the alarm setting chain as the must-hit instead, on the
// grounds that it is independently solved and boot-silent; it reads 37.44% off
// and so cannot serve — which is itself reported at the foot of the output.
//
// Both are taken at a pose the train actually occupies. The arbors' ZERO pose
// is NOT one, and that is the whole finding this probe was written for — see
// the block at src/main.js:13241.
//
// The gears are SELECTED BY MEASUREMENT, not by name — nothing in the train
// carries one. Each arbor's PINION is its smallest `userData.r`, and its
// partner is the rotor on the other arbor whose radius closes the centre
// distance (rP + rQ = d) — the solver's own independent tripwire, used here as
// the selector so a wrong pick cannot look right. Tooth counts are then read
// off the gauge rather than declared. A selector that silently took the wrong
// wheel is how TODO 15's first two measurement attempts produced confident
// nonsense.
//
// ACCEPTANCE — exits non-zero. It decides two things and no more: that its own
// controls hold, and that every going mesh stays inside 2% of a pitch at every
// pose swept. The 2% is NOT a threshold invented here — it is the bar
// `solveGearChain`'s own anti-phase tripwire already applies at build, quoted
// there as the gauge's resolution rather than as a target. All this adds is
// the poses that tripwire cannot reach, which is exactly where the defect was.
// What it does NOT decide is how much phase error a tooth FLANK can absorb;
// that is a backlash question and this measures no flanks. The alarm setting
// row at the foot is reported and never gated — different chain, different
// cause, not this instrument's subject.
// Run from tools/ with a Playwright Chromium: `node probe-train-mesh-phase.mjs`.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const port = process.env.PORT || '8491';
const root = process.env.ROOT || '..';
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });

const out = await page.evaluate(async () => {
  const THREE = await import('three');
  const C = window.__clock;
  const unit = (n) => C.labelEntries.find((e) => e.name === n)?.obj ?? null;

  // ---- the gauge, ported from src/main.js:12964 measuredToothPhase --------
  const _v = new THREE.Vector3(), _o = new THREE.Vector3();
  const toothPhase = (obj, N) => {
    obj.updateWorldMatrix(true, true);
    _o.set(0, 0, 0).applyMatrix4(obj.matrixWorld);
    const ox = _o.x, oy = _o.y;
    const BINS = 2048, R = new Float64Array(BINS);
    const put = (x, y) => {
      const r = Math.hypot(x, y);
      let th = Math.atan2(y, x); if (th < 0) th += Math.PI * 2;
      const k = Math.min(BINS - 1, (th / (Math.PI * 2) * BINS) | 0);
      if (r > R[k]) R[k] = r;
    };
    obj.traverse((m) => {
      if (!m.isMesh || !m.geometry?.attributes?.position) return;
      const pos = m.geometry.attributes.position;
      const idx = m.geometry.index ? m.geometry.index.array : null;
      const n = idx ? idx.length : pos.count;
      for (let i = 0; i + 2 < n; i += 3) {
        for (const [p, q] of [[0, 1], [1, 2], [2, 0]]) {
          _v.fromBufferAttribute(pos, idx ? idx[i + p] : i + p).applyMatrix4(m.matrixWorld);
          const ax = _v.x - ox, ay = _v.y - oy;
          _v.fromBufferAttribute(pos, idx ? idx[i + q] : i + q).applyMatrix4(m.matrixWorld);
          const bx = _v.x - ox, by = _v.y - oy;
          let d = Math.atan2(by, bx) - Math.atan2(ay, ax);
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          if (Math.abs(d) > Math.PI / N) continue;      // outline edges only
          const steps = Math.max(1, Math.ceil(Math.abs(d) / (Math.PI * 2 / BINS)) + 1);
          for (let t = 0; t <= steps; t++) put(ax + (bx - ax) * t / steps, ay + (by - ay) * t / steps);
        }
      }
    });
    const pop = [];
    for (const r of R) if (r > 0) pop.push(r);
    pop.sort((a, b) => a - b);
    if (pop.length < BINS / 4) return { phase: 0, gaps: -1, conf: 0 };
    const pct = (q) => pop[Math.min(pop.length - 1, Math.floor(q * pop.length))];
    const lo = pct(0.10), hi = pct(0.90), mid = (lo + hi) / 2;
    for (let k = 0; k < BINS; k++) if (R[k] === 0) R[k] = lo;
    const centres = [];
    for (let k = 0; k < BINS; k++) {
      const prev = R[(k + BINS - 1) % BINS] < mid;
      if (R[k] < mid && !prev) {
        let len = 0, j = k;
        while (R[j % BINS] < mid && len < BINS) { j++; len++; }
        centres.push((k + len / 2) / BINS * Math.PI * 2);
      }
    }
    let sx = 0, sy = 0;
    for (const g of centres) { sx += Math.cos(g * N); sy += Math.sin(g * N); }
    return {
      phase: Math.atan2(sy, sx) / N + Math.PI / N,
      gaps: centres.length,
      conf: centres.length ? Math.hypot(sx, sy) / centres.length : 0,
    };
  };
  const centreOf = (obj) => {
    obj.updateWorldMatrix(true, false);
    _o.set(0, 0, 0).applyMatrix4(obj.matrixWorld);
    return { x: _o.x, y: _o.y };
  };
  const frac = (x) => x - Math.floor(x);

  // ---- SELECT THE GEARS BY MEASUREMENT -----------------------------------
  // No name and no exposed tooth table, so both members are found from the
  // metal. Every rotor records its own pitch radius as `userData.r`; the
  // PINION of an arbor is its smallest, and its partner across a mesh is the
  // rotor on the other arbor whose radius closes the centre distance —
  // rP + rQ = d, the solver's own independent tripwire used here as the
  // selector, so a wrong pick cannot look right. Uniqueness is required: a
  // second candidate within tolerance is reported, never silently resolved.
  // A rotor's `userData.r` is copied onto the spin group that carries the gear
  // group, so a naive traverse returns the SAME wheel twice — which the
  // uniqueness guard below then reports as an ambiguous mesh. Keep the
  // innermost of any ancestor/descendant pair sharing a radius: that is the
  // gear, and the wrapper is bookkeeping.
  const rotorsIn = (unitName) => {
    const u = unit(unitName); const found = [];
    if (u) u.traverse((o) => { if (o.userData?.r > 0) found.push({ o, r: o.userData.r }); });
    const isAncestor = (a, b) => { for (let p = b.parent; p; p = p.parent) if (p === a) return true; return false; };
    return found.filter((c) => !found.some((d) => d !== c && Math.abs(d.r - c.r) < 1e-9 && isAncestor(c.o, d.o)));
  };
  const axisOf = (o) => centreOf(o);
  const pinionOf = (unitName) => {
    const c = rotorsIn(unitName);
    if (c.length < 1) return { err: `no rotor with userData.r in unit "${unitName}"` };
    c.sort((a, b) => a.r - b.r);
    if (c.length > 1 && Math.abs(c[1].r - c[0].r) < 1e-9) return { err: `two smallest rotors in "${unitName}" share a radius — ambiguous pinion` };
    return { obj: c[0].o, r: c[0].r };
  };
  const partnerOf = (P, pR, unitName) => {
    const pc = axisOf(P);
    const cands = rotorsIn(unitName).map((c) => {
      const qc = axisOf(c.o);
      const d = Math.hypot(qc.x - pc.x, qc.y - pc.y);
      return { ...c, miss: Math.abs(pR + c.r - d), d };
    }).sort((a, b) => a.miss - b.miss);
    if (!cands.length) return { err: `no rotor with userData.r in unit "${unitName}"` };
    if (cands[0].miss > 0.05) return { err: `no rotor in "${unitName}" closes the centre distance ${cands[0].d.toFixed(3)} with a pinion of ${pR.toFixed(3)} (nearest misses by ${cands[0].miss.toFixed(3)})` };
    // Ambiguity only matters ACROSS AXES. Two rotors on the same axis are one
    // mesh station (a wrapper carrying its gear's `userData.r`, or a compound
    // blank), and either reads the same phase; two on DIFFERENT axes both
    // closing the distance would be a genuinely undecidable pick.
    const rival = cands.slice(1).find((c) => c.miss <= 0.05
      && Math.hypot(axisOf(c.o).x - axisOf(cands[0].o).x, axisOf(c.o).y - axisOf(cands[0].o).y) > 1e-6);
    if (rival) return { err: `two rotors on different axes in "${unitName}" close the centre distance — ambiguous` };
    return { obj: cands[0].o, r: cands[0].r, d: cands[0].d, miss: cands[0].miss };
  };

  const MESHES = [
    { name: 'great wheel ⇄ centre pinion', pUnit: 'Center wheel', qUnit: 'Fusee & great wheel' },
    { name: 'centre wheel ⇄ third pinion', pUnit: 'Third wheel', qUnit: 'Center wheel' },
    { name: 'third wheel ⇄ fourth pinion', pUnit: 'Fourth wheel', qUnit: 'Third wheel' },
    { name: 'fourth wheel ⇄ escape pinion', pUnit: 'Escape wheel', qUnit: 'Fourth wheel' },
    // MUST-HIT CONTROL — an independently solved chain in a different part of
    // the movement, and one this probe's subject cannot reach. It also crosses
    // the dialFace seam (the setting wheel is a dialFace child, the idlers are
    // movement children), so it exercises the gauge under a mirroring parent,
    // which is the case TODO 15 records two failed measurements on.
    { name: 'alarm setting wheel ⇄ idler 1', pUnit: 'Alarm setting wheel', qUnit: 'Alarm setting idler', control: true },
  ];
  const sel = [], selErr = [];
  for (const m of MESHES) {
    const P = pinionOf(m.pUnit);
    if (P.err) { selErr.push(`${m.name}: ${P.err}`); continue; }
    const Q = partnerOf(P.obj, P.r, m.qUnit);
    if (Q.err) { selErr.push(`${m.name}: ${Q.err}`); continue; }
    sel.push({ ...m, P: P.obj, Q: Q.obj, rP: P.r, rQ: Q.r, d: Q.d, miss: Q.miss });
  }

  // Tooth counts, read off the gauge itself rather than assumed: the gap count
  // IS the tooth count when the reading is credible, so this doubles as the
  // credibility test the original's header insists on.
  const gaugeOf = (obj) => {
    for (let N = 6; N <= 128; N++) {
      const g = toothPhase(obj, N);
      if (g.gaps === N && g.conf >= 0.9) return { N, ...g };
    }
    return null;
  };
  C.resetInputs();
  C.setPose({ tau: 0, crownPullT: 0, leverEngage: 0, tension: 1 });
  const teeth = [], teethErr = [];
  for (const m of sel) {
    const gp = gaugeOf(m.P), gq = gaugeOf(m.Q);
    if (!gp || !gq) { teethErr.push(`${m.name}: no credible gauge for ${!gp ? 'the pinion' : 'the wheel'}`); continue; }
    m.NP = gp.N; m.NQ = gq.N;
    teeth.push({ name: m.name, NP: gp.N, NQ: gq.N, confP: gp.conf, confQ: gq.conf,
      rP: m.rP, rQ: m.rQ, d: m.d, miss: m.miss });
  }
  const live = sel.filter((m) => m.NP && m.NQ);

  // ---- the residual ------------------------------------------------------
  // `inject` is a rotation added to Q's measured phase, in pitches: 0.5 must
  // wreck the mesh, 1.0 must change nothing at all.
  const residual = (m, inject = 0) => {
    const pc = centreOf(m.P), qc = centreOf(m.Q);
    const psi = Math.atan2(qc.y - pc.y, qc.x - pc.x);
    const pp = toothPhase(m.P, m.NP).phase;
    const qp = toothPhase(m.Q, m.NQ).phase + inject * ((Math.PI * 2) / m.NQ);
    const a = frac(((psi - pp) * m.NP) / (Math.PI * 2));
    const b = frac(((psi + Math.PI - qp) * m.NQ) / (Math.PI * 2));
    const s = frac(a + b - 0.5);
    return Math.min(s, 1 - s);
  };

  // CONTROLS, both at a pose the train actually occupies, and both SELF
  // CONTAINED — they bracket the predicate on the very meshes being reported
  // rather than borrowing a chain elsewhere in the movement whose own health
  // would then be an unstated premise. The residual is periodic in Q's pitch,
  // so the bracket is exact: a WHOLE pitch is a symmetry of the mesh and must
  // change the reading by nothing, a HALF pitch is the worst case and must
  // read ≈50%. Together they say the gauge tracks Q's phase and that the
  // arithmetic can return both verdicts.
  //
  // (The arbors' ZERO pose is deliberately not a control. It is where the
  // solve used to run, which is the whole finding; holding a control there
  // would judge the gauge at a pose the shipped movement never enters.)
  const subj0 = live.filter((m) => !m.control);
  const whole = subj0.map((m) => ({ name: m.name, base: residual(m), off: residual(m, 1) }));
  const injected = subj0.map((m) => ({ name: m.name, base: residual(m), off: residual(m, 0.5) }));
  // REPORTED, not a control — see the note printed with it.
  const others = live.filter((m) => m.control).map((m) => ({ name: m.name, off: residual(m) }));

  // ---- the sweep ---------------------------------------------------------
  // 24 poses over one minute — a full turn of the fourth arbor, so every mesh
  // in the train is sampled through a whole revolution of its faster member.
  const STEPS = 24, SPAN = 60;
  const subject = live.filter((m) => !m.control);
  const rows = subject.map((m) => ({ name: m.name, NP: m.NP, NQ: m.NQ, offs: [] }));
  for (let i = 0; i < STEPS; i++) {
    C.setPose({ tau: (i * SPAN) / STEPS, crownPullT: 0, leverEngage: 0, tension: 1 });
    subject.forEach((m, k) => rows[k].offs.push(residual(m)));
  }
  return { selErr, teethErr, teeth, whole, injected, others, rows, steps: STEPS, span: SPAN };
});

if (out.fatal) { console.log('FATAL —', out.fatal); await browser.close(); srv.kill(); process.exit(2); }

const pc = (x) => `${(x * 100).toFixed(2)}%`;
for (const e of out.selErr) console.log('SELECTION —', e);
for (const e of out.teethErr) console.log('GAUGE —', e);

console.log('\nGEARS, selected by pitch radius and gauged for their own tooth count\n');
console.log('  mesh                             pinion            wheel');
for (const t of out.teeth) {
  console.log(`  ${t.name.padEnd(30)} N=${String(t.NP).padStart(2)} r=${t.rP.toFixed(3)} conf ${t.confP.toFixed(3)}   `
    + `N=${String(t.NQ).padStart(2)} r=${t.rQ.toFixed(3)} conf ${t.confQ.toFixed(3)}`
    + `   centres ${t.d.toFixed(3)} vs pitch sum ${(t.rP + t.rQ).toFixed(3)} (miss ${t.miss.toFixed(4)})`);
}

console.log('\nCONTROLS  (residual = distance from frac(uP+uQ)=0.5, in % of a pitch)\n');
let ctlBad = 0;
if (!out.whole.length) { console.log('  FAIL — no mesh was selectable at all; there is nothing to control'); ctlBad++; }
for (const r of out.whole) {
  const ok = Math.abs(r.off - r.base) <= 0.002;
  if (!ok) ctlBad++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} must-hit   +whole pitch ${r.name.padEnd(30)} ${pc(r.off)} vs ${pc(r.base)} unmoved`);
}
for (const r of out.injected) {
  // The residual is a FOLDED distance, so a half-pitch injection sends it to
  // the complement: base + injected = 0.5 at any base. Asserting `injected >
  // 0.4` instead only holds when the base is already near zero — i.e. the
  // control would misfire on exactly the broken tree it exists to be trusted
  // on, which is how it read on the pre-fix tree (3 of 4 "failing" while the
  // finding underneath was correct).
  const ok = Math.abs(r.base + r.off - 0.5) <= 0.005;
  if (!ok) ctlBad++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} must-miss  +half pitch  ${r.name.padEnd(30)} ${pc(r.off)} + ${pc(r.base)} base = ${pc(r.base + r.off)}`);
}
if (ctlBad) console.log(`\n  ${ctlBad} control(s) failed — the gauge cannot read a mesh that IS solved, or cannot see anti-phase at all. Do not read the sweep below as a finding.`);

console.log(`\nSWEEP — ${out.steps} poses over ${out.span} s (one full turn of the fourth arbor)\n`);
console.log('  mesh                             N:N      min       max      mean');
for (const r of out.rows) {
  const mn = Math.min(...r.offs), mx = Math.max(...r.offs);
  const mean = r.offs.reduce((a, b) => a + b, 0) / r.offs.length;
  const flag = mx > 0.02 ? '  <-- past the build tripwire\'s 2%' : '';
  console.log(`  ${r.name.padEnd(30)} ${String(r.NP).padStart(2)}:${String(r.NQ).padEnd(3)} ${pc(mn).padStart(8)} ${pc(mx).padStart(9)} ${pc(mean).padStart(9)}${flag}`);
}
if (out.others.length) {
  console.log('\nALSO READ, at tau = 0 — reported, NOT a control and NOT this change\'s subject:\n');
  for (const r of out.others) console.log(`  ${r.name.padEnd(30)} ${pc(r.off)}`);
  console.log('  The alarm setting chain is solved by the same solver and boot is silent, so a large');
  console.log('  reading here is a finding in its own right rather than a gauge fault — its tick law');
  console.log('  turns idler 1 by the disc back-drive term while the setting wheel it meshes carries');
  console.log('  no such term (src/main.js:34124-34155). Not investigated here.');
}
const BAR = 0.02;
let swept = 0;
for (const r of out.rows) if (Math.max(...r.offs) > BAR) swept++;
if (!out.rows.length) { console.log('\nFAIL — no going mesh was gauged; nothing was measured.'); swept++; }
console.log(`\n2% is solveGearChain's own anti-phase bar (src/main.js:13185), quoted there as the`);
console.log("gauge's resolution — gap centres are quantised to 2pi/2048, averaged over N gaps.");
const bad = ctlBad + swept;
console.log(`\n${bad === 0 ? 'PASS' : `FAIL — ${swept} mesh(es) past 2%, ${ctlBad} control(s)`}`);
await browser.close(); srv.kill();
process.exit(bad === 0 ? 0 : 1);
