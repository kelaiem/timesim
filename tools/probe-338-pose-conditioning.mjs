#!/usr/bin/env node
// §338 — THE POSE-CONDITIONING GUARD: does any pose of §152's net turn a last-ulp
// difference in the maths into a difference in the metal?
//
//   node --import ./tools/native/loader.mjs tools/probe-338-pose-conditioning.mjs [--seeds 1,2]
//
// Acceptance (exits non-zero on any failure). Deterministic maths (landing 2) makes
// every host compute bit for bit alike, so cross-host identity no longer depends on
// how a pose AMPLIFIES a maths difference. This is the guard for every case that is
// not bit-identical: a page or tool the maths does not cover, a re-recorded maths
// library, an engine or a compiled kernel that breaks IEEE. #921 found the class on
// the engines' own maths: a held wind (`maintHold`) posed by inverting the great
// wheel's angle, which turns about once an hour, so a 1-ulp difference in that angle
// reached τ multiplied by 1/ω, and the balance's metal across a PLACE cell edge.
//
// THE INSTRUMENT. A SYNTHETIC ENGINE: every implementation-approximated Math function
// (the 20 det-math replaces, plus pow and hypot) answers one ulp off, up or down, on
// about one input in eight, by a hash of the input's bits — the measured shape of
// V8 12.4 against V8 15.3 (§338: 2–11% of inputs, one ulp). Values ECMA-262 fixes
// exactly (an argument of 0, ±1, 2 or ±∞; an integer or zero result) are left
// alone, because every engine agrees on them. It is installed BEFORE main.js
// evaluates, as another engine would be, so the constants the pose laws read are
// perturbed too (posing alone under the noise moved nothing: #921's τ came from a
// boot constant). Each worker thread boots its own host; per §152 digest pose, every
// mesh's world matrix is compared, own maths against synthetic, element by element.
//
// THE BOUND, derived (rule 1). The PLACE digest quantizes each matrix element to a
// cell of 1/DIGEST_PLACE_Q, and a host difference Δ straddles a cell edge with
// probability about Δ·Q. Over the whole net (poses × meshes × 16 elements) the
// expected number of straddles stays under ONE when every element moves less than
//     BOUND = 1 / (Q · poses · meshes · 16).
// The meshes are every mesh in the scene, a superset of the digest's units, so the
// bound is the stricter for it. Measured on landing's tree: 52 poses × 823 meshes,
// BOUND 1.46e-12; the ordinary poses read up to 3.6e-13 (four times under), and the
// held wind before the fix 1.95e-9 (1,300 times over).
//
// THE GATES, each with its reason:
//   1. determinism: two boots on the tree's OWN maths agree at every pose EXACTLY,
//      so a difference below is the synthetic engine's and nothing else's.
//   2. the engine is live: it perturbed calls at boot, and the metal differs
//      somewhere (an engine that perturbed nothing would pass every pose).
//   3. CONTROL: the held wind posed at the τ the train's law INVERTS (the pre-fix
//      law, `maintHoldLaw.advanceTau`, posed by τ) reads OVER the bound, at one or more
//      fractions of its run (one fraction can land on an escapement step's edge, where
//      the inverse cannot be moved). A guard nobody has seen fire is a comment.
//   4. every digest pose reads UNDER the bound.
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';

const NAMES = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2', 'exp', 'expm1', 'log', 'log1p', 'log2', 'log10',
  'cbrt', 'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh', 'pow', 'hypot'];
const EXACT_ARGS = new Set([0, 1, -1, 2, Infinity, -Infinity]);

function installSyntheticEngine(seed) {
  const orig = Object.fromEntries(NAMES.map((n) => [n, Math[n]]));
  const f64 = new Float64Array(1), u32 = new Uint32Array(f64.buffer), i64 = new BigInt64Array(f64.buffer);
  const hits = { calls: 0, perturbed: 0 };
  for (const n of NAMES) {
    Object.defineProperty(Math, n, { configurable: true, writable: true, enumerable: false, value: (...a) => {
      const y = orig[n](...a);
      hits.calls++;
      if (!Number.isFinite(y) || Number.isInteger(y) || a.every((x) => EXACT_ARGS.has(x) || Number.isNaN(x))) return y;
      f64[0] = a[0];
      let h = Math.imul(u32[0] ^ seed, 0x9e3779b1) ^ Math.imul((u32[1] + seed) | 0, 0x85ebca6b);
      h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0;
      if ((h & 7) !== 0) return y;                       // about one input in eight
      hits.perturbed++;
      f64[0] = y; i64[0] += (h & 8) ? 1n : -1n;          // one ulp, up or down
      return f64[0];
    } });
  }
  return hits;
}

async function measure({ seed }) {
  const { installHost } = await import('./native/host.mjs');
  await installHost({});
  const hits = seed ? installSyntheticEngine(seed) : null;
  const bootPerturbed = () => (hits ? hits.perturbed : 0);
  await import('../src/main.js');
  const clock = globalThis.__clock;
  if (!clock) throw new Error(`main.js published no __clock${globalThis.__bootError ? `: ${globalThis.__bootError.message}` : ''}`);
  const atBoot = bootPerturbed();
  const I = await import('../src/inspect.js');
  const poses = I.digestPoses(clock);
  // The control: the fingerprint's held wind, at the τ the train's law inverts.
  const law = clock.maintHoldLaw;
  const held = poses.find((p) => p.maintHold === 0.5 && p.maintPickUp === undefined);
  if (!held || !law || typeof law.advanceTau !== 'function') throw new Error('the control needs the fingerprint\'s held wind (maintHold 0.5) and maintHoldLaw.advanceTau');
  const H = law.begin(held.tau);
  // §343 landing 3 — at several FRACTIONS of the held run, the fingerprint's 0.5 first. barrelMeshAngle steps with
  // the escapement, so where a target lands on a step's edge the inverse's τ is fixed by the beat's own arithmetic and
  // no ulp can move it: at the 14,400 movement the fingerprint's half-way hold does exactly that (τ bit-identical under
  // both seeds), so one fraction is one sample of the trap, not the trap. The control holds if ANY fraction amplifies.
  const CONTROL_FRACTIONS = [held.maintHold, 0.1, 0.2, 0.3, 0.4, 0.6, 0.7, 0.8, 0.9];
  const controls = CONTROL_FRACTIONS.map((f) => ({ f, pose: { tau: law.advanceTau(H.tau0, H.A0, f * (law.run - H.recoil)), crownPullT: 0, leverEngage: 0, tension: 1, maintHold: 0 } }));
  // A mesh's name, else its labelled unit's (clock.labelEntries, the battery's own
  // vocabulary), else its first named ancestor's: 182 meshes carry no name of their own.
  const unitOf = new Map();
  for (const e of clock.labelEntries || []) e.obj?.traverse?.((x) => { if (x.isMesh && !unitOf.has(x)) unitOf.set(x, e.name); });
  const nameOf = (o) => {
    if (o.name) return o.name;
    if (unitOf.has(o)) return `a mesh of ${unitOf.get(o)}`;
    for (let p = o.parent; p; p = p.parent) if (p.name) return `a mesh under ${p.name}`;
    return '(unnamed)';
  };
  const read = (pose) => {
    clock.resetInputs(); clock.setPose(pose); clock.scene.updateMatrixWorld(true);
    const m = [];
    clock.scene.traverse((o) => { if (o.isMesh) m.push(o); });
    const out = new Float64Array(m.length * 16);
    m.forEach((o, i) => out.set(o.matrixWorld.elements, i * 16));
    return { tau: clock.tau, names: m.map(nameOf), mats: out };
  };
  const rows = poses.map(read);
  const ctl = controls.map((c) => ({ f: c.f, ...read(c.pose) }));
  clock.resetInputs();
  return { seed, atBoot, poses, rows, control: ctl, placeQ: I.DIGEST_PLACE_Q };
}

if (!isMainThread) {
  console.log = () => {}; console.table = () => {}; console.warn = () => {};
  measure(workerData).then((r) => parentPort.postMessage(r), (e) => parentPort.postMessage({ fatal: String(e && e.stack || e) }));
} else {
  const argv = process.argv.slice(2);
  const i = argv.indexOf('--seeds');
  const SEEDS = (i >= 0 ? argv[i + 1] : '1,2').split(',').map(Number);
  if (!SEEDS.every((s) => Number.isInteger(s) && s > 0)) throw new Error('--seeds wants positive integers');
  const env = { ...process.env, __TIMESIM_NATIVE_LOADER__: '' };   // each worker registers the loader for itself
  const run = (seed) => new Promise((res, rej) => {
    const w = new Worker(new URL(import.meta.url), { workerData: { seed }, env, execArgv: process.execArgv });
    w.once('message', (m) => (m.fatal ? rej(new Error(`seed ${seed}: ${m.fatal}`)) : res(m)));
    w.once('error', rej);
    w.once('exit', (c) => { if (c) rej(new Error(`seed ${seed}: worker exited ${c}`)); });
  });
  const t0 = Date.now();
  const [A, A2, ...Bs] = await Promise.all([run(0), run(0), ...SEEDS.map(run)]);
  const meshes = A.rows[0].names.length, poses = A.rows.length;
  const BOUND = 1 / (A.placeQ * poses * meshes * 16);
  const dev = (x, y) => {
    if (x.names.length !== y.names.length || x.names.some((n, k) => n !== y.names[k])) return { d: Infinity, who: '(mesh lists differ)' };
    let d = 0, who = '';
    for (let k = 0; k < x.mats.length; k++) { const e = Math.abs(x.mats[k] - y.mats[k]); if (e > d || Number.isNaN(e)) { d = e; who = x.names[k >> 4]; } }
    return { d, who };
  };
  const fails = [];
  const line = (ok, s) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${s}`); if (!ok) fails.push(s); };
  console.log(`${poses} digest poses × ${meshes} meshes; BOUND = 1 / (${A.placeQ} · ${poses} · ${meshes} · 16) = ${BOUND.toExponential(3)}`);

  const same = A.rows.map((r, k) => dev(r, A2.rows[k])).filter((x) => x.d !== 0).length
    + A.control.filter((c, k) => dev(c, A2.control[k]).d !== 0).length;
  line(same === 0, `determinism: two boots on the tree's own maths agree exactly at every pose and the control (${same} differ)`);
  for (const B of Bs) {
    const per = A.rows.map((r, k) => ({ pose: A.poses[k], tau: [r.tau, B.rows[k].tau], ...dev(r, B.rows[k]) }));
    const moved = per.filter((x) => x.d > 0).length;
    line(B.atBoot > 0 && moved > 0, `seed ${B.seed}: the synthetic engine is live (${B.atBoot} results one ulp off at boot; ${moved}/${poses} poses moved at all)`);
    const cs = A.control.map((a, k) => ({ f: a.f, tau: [a.tau, B.control[k].tau], ...dev(a, B.control[k]) }));
    const c = cs.reduce((w, x) => (x.d > w.d ? x : w));
    line(c.d > BOUND, `seed ${B.seed}: CONTROL — the held wind at the τ the train's law inverts reads over the bound at some fraction of its run: worst ${c.d.toExponential(2)} at ${c.f} (${c.who}; τ ${c.tau[0]} vs ${c.tau[1]}); ${cs.filter((x) => x.d > BOUND).length} of ${cs.length} fractions over`);
    const steep = per.filter((x) => !(x.d < BOUND));
    per.sort((x, y) => y.d - x.d);
    line(steep.length === 0, `seed ${B.seed}: every digest pose under the bound — worst ${per[0].d.toExponential(2)} (${per[0].who}) at ${JSON.stringify(per[0].pose)}, median ${per[poses >> 1].d.toExponential(2)}`);
    for (const x of steep) console.log(`          STEEP ${x.d.toExponential(2)} ${x.who} at ${JSON.stringify(x.pose)} (τ ${x.tau[0]} vs ${x.tau[1]})`);
  }
  console.log(`\n${fails.length ? `FAIL — ${fails.length} gate(s)` : 'PASS — no pose of the net amplifies a one-ulp maths difference past the PLACE budget'} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  process.exit(fails.length ? 1 : 0);
}
