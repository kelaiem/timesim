// DOES EVERY DECLARED MESH ACTUALLY TRANSMIT AT ITS TOOTH RATIO?
//
// A DIFFERENT question from mesh PHASE, and it has to be asked separately.
// `probe-train-mesh-phase.mjs` asks where two tooth patterns stand relative to
// each other; this asks whether turning one member turns the other by the
// amount the metal says it must. A pair can be perfectly phased and still not
// transmit — its two tick laws simply disagree — and nothing in the battery
// looks: the sweeps ask whether volumes overlap, and two wheels whose angles
// are written independently sweep exactly the same volumes as two that are
// genuinely geared. That is TODO 15's "kinematic lie" class, one level up
// from the half-pitch idiom that file chases.
//
// It is NOT probe-coaxial-sense.mjs, the nearest miss: that one asks whether
// parts on ONE SHAFT agree in direction (ratio 1, by definition). This asks
// whether parts across a MESH agree in ratio and in sign.
//
// HOW IT MEASURES. Accumulate each member's world spin (the azimuth of its own
// local +X, a material direction, wrapped per step — no frame is reasoned
// about) across a pose walk, then take the quotient. The expected ratio needs
// no tooth table: meshing gears counter-rotate as their PITCH RADII, which
// every rotor records as `userData.r`, so the bar is −r_driver / r_driven read
// off the same metal that turns.
//
// EACH INPUT IS WALKED SEPARATELY, and that is the point. A chain fed by two
// inputs — here the alarm setting train, which takes the crown at one end and
// the hour's back-drive at the other — can satisfy every ratio under one input
// and violate it under the other, and a single combined sweep hides exactly
// that. Measured: three of the alarm's four meshes are correct under one input
// and wrong under the other, in both directions.
//
// CONTROLS, both kinds:
//   · must-hit — the GOING TRAIN's four meshes, driven by tau. Independent of
//     the subject, and known good: TODO 116 left them measured and phase-solved,
//     and they are what a working chain reads like here;
//   · must-miss — the same going meshes judged against a DELIBERATELY WRONG
//     bar (the ratio inverted), which must fail. Without it, "everything ok" is
//     also what a comparison that always passes looks like.
//
// GUARDS: a member that does not move under an input cannot be judged by a
// quotient, so it is reported as `driver still` rather than silently dividing;
// and every mesh's centre distance is checked against the pitch-radius sum, so
// a pair that does not reach each other cannot report a healthy ratio.
//
// ACCEPTANCE — exits non-zero on the controls and on the GOING train. The
// alarm rows are REPORTED, not gated: what they show is not a tuning error but
// a contradiction between three laws (TODO 117), and gating a row whose right
// answer is undecided would just be a red mark nobody can clear.
// Run from tools/ with a Playwright Chromium: `node probe-mesh-transmission.mjs`.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const port = process.env.PORT || '8501';
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
  const read = (o) => {
    o.updateWorldMatrix(true, false);
    const e = o.matrixWorld.elements;
    return { az: Math.atan2(e[1], e[0]), x: e[12], y: e[13] };
  };
  const wrap = (x) => Math.atan2(Math.sin(x), Math.cos(x));

  // ---- handles, all found from the metal --------------------------------
  // Rotors carry `userData.r`; a wrapper that copies its gear's radius is
  // dropped in favour of the gear itself.
  const rotorsIn = (n) => {
    const u = unit(n); const f = [];
    if (u) u.traverse((o) => { if (o.userData?.r > 0) f.push({ o, r: o.userData.r }); });
    const anc = (a, b) => { for (let p = b.parent; p; p = p.parent) if (p === a) return true; return false; };
    return f.filter((c) => !f.some((d) => d !== c && Math.abs(d.r - c.r) < 1e-9 && anc(c.o, d.o)));
  };
  const axis = (o) => { const r = read(o); return { x: r.x, y: r.y }; };
  // The SPIN handle for a rotor: the ancestor that actually carries the
  // rotation. Reading the rotor itself is equivalent — a child of a turning
  // group turns with it — so the rotor is used directly.
  const smallest = (n) => { const c = rotorsIn(n).sort((a, b) => a.r - b.r); return c[0] ?? null; };
  const largest = (n) => { const c = rotorsIn(n).sort((a, b) => b.r - a.r); return c[0] ?? null; };
  const byRadius = (n, want) => rotorsIn(n).find((c) => Math.abs(c.r - want) < 1e-6) ?? null;

  // The alarm idlers share one unit; tell them apart by axis distance from
  // the dial centre. i1 carries the compound branch pinion i1b at the same
  // axis and the same radius, so either reads i1's spin — they are keyed.
  const idlers = rotorsIn('Alarm setting idler')
    .map((c) => ({ ...c, d: Math.hypot(axis(c.o).x, axis(c.o).y) }))
    .sort((a, b) => a.d - b.d);
  const i1 = idlers[0] ?? null;
  const i2 = idlers.find((c) => c.d > (idlers[0]?.d ?? 0) + 1) ?? null;
  // The setting arbor's rotor is inside its unit (the unit is the bracket).
  const arborUnit = unit('Alarm setting arbor');
  let arborRotor = null;
  if (arborUnit) arborUnit.traverse((o) => { if (!arborRotor && o !== arborUnit && o.isGroup && o.children.length) arborRotor = o; });

  const M = [];
  const going = (pu, qu, label) => {
    const P = smallest(pu), Q = largest(qu);
    if (!P || !Q) return;
    M.push({ chain: 'going', label, A: P.o, B: Q.o, rA: P.r, rB: Q.r, drive: ['going'] });
  };
  going('Center wheel', 'Fusee & great wheel', 'centre pinion → great wheel');
  going('Third wheel', 'Center wheel', 'third pinion → centre wheel');
  going('Fourth wheel', 'Third wheel', 'fourth pinion → third wheel');
  going('Escape wheel', 'Fourth wheel', 'escape pinion → fourth wheel');

  const disc = largest('Alarm release disc');
  const wheel = largest('Alarm setting wheel');
  if (disc && i1) M.push({ chain: 'alarm', label: 'disc rim → i1b (keyed to i1)', A: disc.o, B: i1.o, rA: disc.r, rB: i1.r, drive: ['hour', 'crown'] });
  if (wheel && i1) M.push({ chain: 'alarm', label: 'setting wheel → i1', A: wheel.o, B: i1.o, rA: wheel.r, rB: i1.r, drive: ['hour', 'crown'] });
  if (i1 && i2) M.push({ chain: 'alarm', label: 'i1 → i2', A: i1.o, B: i2.o, rA: i1.r, rB: i2.r, drive: ['hour', 'crown'] });
  if (i2 && arborRotor) {
    const pin = byRadius('Alarm setting arbor', 1.5) ?? { r: null };
    M.push({ chain: 'alarm', label: 'i2 → arbor pinion', A: i2.o, B: arborRotor, rA: i2.r, rB: pin.r, drive: ['hour', 'crown'] });
  }

  // Centre distance against the pitch-radius sum — a pair that does not reach
  // each other cannot report a healthy ratio, and this is independent of it.
  for (const m of M) {
    const a = axis(m.A), b = axis(m.B);
    m.d = Math.hypot(b.x - a.x, b.y - a.y);
    m.reach = m.rB === null ? null : Math.abs(m.d - (m.rA + m.rB));
  }

  const members = [];
  for (const m of M) { if (!members.includes(m.A)) members.push(m.A); if (!members.includes(m.B)) members.push(m.B); }
  // ALIASING GUARD. A wrapped per-step delta cannot tell θ from θ ± 2π, so a
  // member turning more than half a turn between samples reads as something
  // else entirely — the going train's escape wheel does ~2400 revolutions over
  // six hours and accumulated to a confident ZERO on the first draft of this
  // probe, with the going meshes then "failing" as controls. Each sweep
  // therefore records the largest step any member took, and a sweep that comes
  // near ±π is refused rather than reported. It is also why the going train
  // and the alarm are walked over DIFFERENT SPANS: one chain's useful span is
  // the other's aliasing.
  const sweep = (poses) => {
    C.resetInputs();
    C.setPose(poses[0]);
    const acc = members.map(() => 0), prev = members.map((o) => read(o).az);
    const worst = members.map(() => 0);
    for (let i = 1; i < poses.length; i++) {
      C.setPose(poses[i]);
      members.forEach((o, k) => {
        const a = read(o).az, d = wrap(a - prev[k]);
        if (Math.abs(d) > worst[k]) worst[k] = Math.abs(d);
        acc[k] += d; prev[k] = a;
      });
    }
    return { acc, worst };
  };
  const base = { tau: 0, crownPullT: 0, leverEngage: 0, tension: 1, alarmOn: 1, alarmCrownRotation: 0, alarmCrownPullT: 1 };
  const spins = {
    // 20 s in 400 steps: the escape wheel, the fastest thing here, moves about
    // a tenth of a radian per step.
    going: sweep(Array.from({ length: 401 }, (_, i) => ({ ...base, tau: (i / 400) * 20 }))),
    // 6 h in 48 steps: the alarm disc turns half a revolution over the whole
    // span, so its members are nowhere near the wrap. The going train aliases
    // wildly here, which is why its rows do not read this sweep.
    hour: sweep(Array.from({ length: 49 }, (_, i) => ({ ...base, tau: (i / 48) * 6 * 3600 }))),
    crown: sweep(Array.from({ length: 49 }, (_, i) => ({ ...base, alarmCrownRotation: (i / 48) * 2 * Math.PI }))),
  };
  const idx = (o) => members.indexOf(o);
  return {
    rows: M.map((m) => ({
      chain: m.chain, label: m.label, rA: m.rA, rB: m.rB, d: m.d, reach: m.reach,
      drive: m.drive,
      spin: Object.fromEntries(m.drive.map((k) => [k, {
        a: spins[k].acc[idx(m.A)], b: spins[k].acc[idx(m.B)],
        step: Math.max(spins[k].worst[idx(m.A)], spins[k].worst[idx(m.B)]),
      }])),
    })),
  };
});

const f = (x, n = 6) => (x >= 0 ? ' ' : '') + x.toFixed(n);
let bad = 0, alarmBad = 0;
const STILL = 1e-6, TOL = 0.02;

console.log('\nDECLARED MESHES — centre distance against the pitch-radius sum\n');
for (const r of out.rows) {
  const ok = r.reach !== null && r.reach < 0.05;
  if (!ok) { bad++; }
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${r.label.padEnd(30)} r ${r.rA?.toFixed(3)} + ${r.rB === null ? '?' : r.rB.toFixed(3)} vs centres ${r.d.toFixed(3)}${r.reach === null ? '   (no radius for the driven member)' : `   miss ${r.reach.toFixed(4)}`}`);
}

const verdict = (r, key, invert = false) => {
  const s = r.spin[key];
  if (!s) return null;
  const want = (invert ? 1 : -1) * (r.rA / r.rB);
  if (Math.abs(s.a) < STILL) return { still: true, a: s.a, b: s.b, want };
  const got = s.b / s.a;
  return { got, want, ok: Math.abs(got - want) <= TOL * Math.abs(want), a: s.a, b: s.b };
};

console.log('\nTRANSMISSION, one input at a time  (ratio = driven spin / driver spin)\n');
for (const key of ['going', 'hour', 'crown']) {
  const label = key === 'going' ? 'GOING — 20 s of tau'
    : key === 'hour' ? 'HOUR — 6 h of tau, alarm crown parked'
    : 'CROWN — one turn of the alarm crown, tau parked';
  console.log(`  ${label}`);
  for (const r of out.rows) {
    const v = verdict(r, key);
    if (!v) continue;
    // Per-ROW aliasing: a sweep useful for one chain aliases another's fast
    // members, so the guard is asked of this row's own two members.
    if (r.spin[key].step >= Math.PI / 2) {
      console.log(`    ${r.chain === 'going' ? 'FAIL' : 'rep '} ${r.label.padEnd(30)} largest step ${r.spin[key].step.toFixed(3)} rad — this sweep aliases these members; row not readable`);
      if (r.chain === 'going') bad++;
      continue;
    }
    if (v.still) {
      console.log(`    ${r.chain === 'going' ? 'FAIL' : 'rep '} ${r.label.padEnd(30)} driver STILL (${f(v.a)}) while the driven turned ${f(v.b)} — not transmitting`);
      if (r.chain === 'going') bad++; else alarmBad++;
      continue;
    }
    const mark = v.ok ? 'ok  ' : (r.chain === 'going' ? 'FAIL' : 'rep ');
    if (!v.ok) { if (r.chain === 'going') bad++; else alarmBad++; }
    console.log(`    ${mark} ${r.label.padEnd(30)} ${f(v.got)}  want ${f(v.want)}  (${f(v.a)} → ${f(v.b)})`);
  }
  console.log('');
}

console.log('CONTROLS\n');
let ctlBad = 0;
const goingRows = out.rows.filter((r) => r.chain === 'going');
for (const r of goingRows) {
  const v = verdict(r, 'going');
  const ok = v && !v.still && v.ok;
  if (!ok) ctlBad++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} must-hit   going train, a chain known good   ${r.label.padEnd(30)} ${v && !v.still ? f(v.got) : 'still'}`);
}
for (const r of goingRows) {
  const v = verdict(r, 'going', true);   // the bar inverted — must NOT match
  const ok = v && !v.still && !v.ok;
  if (!ok) ctlBad++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} must-miss  same rows against an inverted bar ${r.label.padEnd(24)} want ${v ? f(v.want) : '?'}`);
}
if (ctlBad) console.log(`\n  ${ctlBad} control(s) failed — the comparison cannot tell a geared pair from an ungeared one. Do not read the rows above as findings.`);

console.log(`\n${alarmBad} alarm row(s) do not transmit — REPORTED, not gated: see TODO 117.`);
const total = bad + ctlBad;
console.log(`\n${total === 0 ? 'PASS' : `FAIL — ${bad} going/reach row(s), ${ctlBad} control(s)`}`);
await browser.close(); srv.kill();
process.exit(total === 0 ? 0 : 1);
