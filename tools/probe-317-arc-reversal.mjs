// TODO 317 — DOES THE §36 REGISTRY SEE A RECOIL THE TRAIN HAS GEARED DOWN? Acceptance.
//   node --import ./tools/native/loader.mjs tools/probe-317-arc-reversal.mjs      (exit 1 on any failed row)
// The registry's `reversed` flag is the §48 audit's population. It asked each sampled step whether it moved more than
// 1e-6 RAD and called a sign change between two such steps a reversal. That missed the centre wheel's draw recoil at
// 36,000 A/h (7.7e-6 rad in all, each step a fraction of it), so `restoring` read the wheel's two-way declaration as
// stale. arcTrackReverses (src/inspect.js) asks it of the METAL instead: the witness's unwrapped arc length, and a
// retreat from its running extreme by more than ARC_DWELL_U (one PLACE cell), whatever the step size. Rows:
//   1. THE LAW, on synthetic tracks, each with the old law beside it as the control:
//      (a) a recoil of 3 floors spread over 1000 steps reverses; the old per-step angle test misses it;
//      (b) a retreat of half a floor does not reverse (the floor is a floor);
//      (c) a monotone run with float-noise jitter of 1e-12 does not reverse;
//      (d) a fork-like swing parked on a dwell between strokes reverses, the dwell neither voting nor resetting;
//      (e) the same track at 10× the sampling reads the same: the answer is not a function of the step size.
//   2. THE BUILDS: on `alarm=0&barrels=3&vph=36000` the train's two-way declarations (Center wheel among them) are all
//      in the population and none is stale; on the default the motion works and hour wheel, which the recoil reaches
//      through the cannon pinion, are in it and declared.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
if (process.argv[2] === '--child') {
  const { bootNative } = await import('./native/host.mjs');
  const { start, status } = await import('../src/inspect.js');
  const r = await bootNative({ query: process.argv[3] });
  start(r.clock, 'restoring');
  let st; while ((st = status('restoring')).state === 'running') await new Promise((res) => setTimeout(res, 50));
  if (st.state !== 'done') throw new Error(st.error || st.state);
  const x = st.result;
  const units = [...x.twoWayDriven, ...x.restoredByDeclaredElement, ...x.restoredByNothing].map((q) => q.unit);
  process.stdout.write('\n@@' + JSON.stringify({ units, stale: x.staleDeclarations, unwaived: x.unwaived.map((q) => q.unit),
    twoWay: x.twoWayDriven.map((q) => q.unit) }) + '\n');
  process.exit(0);
}
const { arcTrackReverses, ARC_DWELL_U } = await import('../src/inspect.js');
let fail = 0;
const row = (ok, what) => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${what}`); if (!ok) fail++; };
// the law it replaced, verbatim in effect: steps under 1e-6 rad are dwells, a sign change between voters reverses
const oldLaw = (a) => { let prev = null; for (let i = 1; i < a.length; i++) { const s = a[i] - a[i - 1]; if (Math.abs(s) < 1e-6) continue; if (prev !== null && s * prev < 0) return true; prev = s; } return false; };
const F = ARC_DWELL_U, rW = 2;                                     // a witness 2 u off its axis
const track = (pieces) => { const a = [0]; for (const [n, dTotal] of pieces) for (let i = 0; i < n; i++) a.push(a.at(-1) + dTotal / n); return a; };
const fwd = (u) => u / rW;                                         // arc length → angle
// 1 (a)
const recoil = track([[200, fwd(1e-3)], [1000, -fwd(3 * F)], [200, fwd(1e-3)]]);
row(arcTrackReverses(recoil, rW) && !oldLaw(recoil), `1a. a ${3}-floor recoil over 1000 steps reverses (new ${arcTrackReverses(recoil, rW)}), the old angle law misses it (${oldLaw(recoil)})`);
// 1 (b)
const half = track([[200, fwd(1e-3)], [50, -fwd(0.5 * F)], [200, fwd(1e-3)]]);
row(!arcTrackReverses(half, rW), '1b. a retreat of half a floor does not reverse');
// 1 (c)
const noisy = track([[2000, fwd(1e-2)]]).map((v, i) => v + (i % 2 ? 1e-12 : -1e-12));
row(!arcTrackReverses(noisy, rW), '1c. a monotone run jittered by 1e-12 rad does not reverse');
// 1 (d)
const fork = track([[40, fwd(0.05)], [400, 0], [40, -fwd(0.05)]]);
row(arcTrackReverses(fork, rW) && oldLaw(fork), '1d. a swing parked on its banking between strokes reverses (both laws agree on a large one)');
// 1 (e)
const fine = track([[2000, fwd(1e-3)], [10000, -fwd(3 * F)], [2000, fwd(1e-3)]]);
row(arcTrackReverses(fine, rW) === arcTrackReverses(recoil, rW) && !oldLaw(fine), '1e. ten times the sampling reads the same (the old law: still blind)');

// 2
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== '__TIMESIM_NATIVE_LOADER__'));
const boot = (q) => { const p = spawnSync(process.execPath, ['--import', './tools/native/loader.mjs', fileURLToPath(import.meta.url), '--child', q],
  { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26, env });
  const l = (p.stdout || '').split('\n').find((x) => x.startsWith('@@'));
  if (!l) throw new Error(`boot '${q}' failed: ${(p.stderr || '').slice(-400)}`);
  return JSON.parse(l.slice(2)); };
const train = ['Escape wheel', 'Fourth wheel', 'Third wheel', 'Center wheel'];
const b36 = boot('alarm=0&barrels=3&vph=36000');
row(train.every((u) => b36.twoWay.includes(u)) && b36.stale.length === 0,
  `2. at 36,000 the train reverses and is two-way (${train.filter((u) => b36.twoWay.includes(u)).length}/${train.length}), stale declarations: ${JSON.stringify(b36.stale)}`);
const d = boot('');
row(['Motion works', 'Hour wheel'].every((u) => d.twoWay.includes(u)) && d.unwaived.length === 0 && d.stale.length === 0,
  `2. on the default the motion works and hour wheel reverse and are declared two-way; unwaived ${JSON.stringify(d.unwaived)}, stale ${JSON.stringify(d.stale)}`);
process.exit(fail ? 1 : 0);
