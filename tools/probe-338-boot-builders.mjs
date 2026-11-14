#!/usr/bin/env node
// WHICH BUILDERS OWN THE BOOT, ACROSS EVERY SPEC POINT? — §338 landing 17, the measurement
// before any build change. A REPORT: it judges nothing (it exits non-zero only when a boot
// or a profile could not be read, which is a measurement that did not happen).
//
//   node --import ./tools/native/loader.mjs tools/probe-338-boot-builders.mjs
//        [--points a,b] [--par N] [--top N] [--out FILE.json]
//
// Each SPEC_POINTS row (ci-battery.mjs' own table) is booted natively in a child process
// under V8's sampling profiler (`--cpu-prof`), the way the pre-flight's spec tier boots it
// (`trial=1&<q>`). Each profile is read two ways:
//   · SELF time per function — what the CPU executes;
//   · TOTAL time per function — every sample whose stack holds it, each counted ONCE
//     however deep the recursion (a sample is a unit of wall, so a function's total can
//     never exceed the boot), which is what a builder costs, callees included.
// and the boots are summed: a function that is cheap at the default and expensive at
// d4=16 shows its weight only in the sum, and the sum IS the spec tier's cost.
//
// What it cannot see, named: an inlined callee bills its caller (V8 inlines small hot
// functions, so a cheap helper's time appears under whatever called it), and sampling
// at 1 ms makes small rows noise. It reads the SHAPE — which builders dominate, and at
// which points — which is all the next step needs.
//
// Its control: every profile must cover at least half of its boot's wall, or it read a
// profiler that was not running (probe-239-boot-profile.mjs' COVERAGE_FLOOR, for the
// same reason).
import { spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { availableParallelism, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPEC_POINTS } from './ci-battery.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const ONLY = opt('--points', null)?.split(',');
const PAR = Number(opt('--par', Math.min(4, availableParallelism())));
const TOP = Number(opt('--top', 30));
const OUT = opt('--out', null);
const COVERAGE_FLOOR = 0.5;
const points = ONLY ? SPEC_POINTS.filter((p) => ONLY.includes(p.name)) : SPEC_POINTS;
if (ONLY && points.length !== ONLY.length) throw new Error(`--points names a row SPEC_POINTS does not: ${ONLY.filter((n) => !points.some((p) => p.name === n))}`);

function bootProfiled(pt) {
  const dir = mkdtempSync(join(tmpdir(), 'boot-prof-'));
  const query = `trial=1${pt.q ? `&${pt.q}` : ''}`;
  return new Promise((res) => {
    const t0 = Date.now();
    const ch = spawn(process.execPath, ['--cpu-prof', `--cpu-prof-dir=${dir}`, '--cpu-prof-interval', '1000',
      '--import', './tools/native/loader.mjs', 'tools/native/boot.mjs', query], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'],
        // the loader's once-per-process guard is an env var, so a child would inherit it and skip registering
        env: { ...process.env, __TIMESIM_NATIVE_LOADER__: '' } });
    let out = '', err = '';
    ch.stdout.on('data', (d) => { out += d; });
    ch.stderr.on('data', (d) => { err += d; });
    ch.on('exit', (code) => {
      const wall = Date.now() - t0;
      try {
        // boot.mjs prints one JSON object; its bootMs is main.js' own evaluation.
        const j = JSON.parse(out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1));
        const f = readdirSync(dir).filter((x) => x.endsWith('.cpuprofile')).map((x) => join(dir, x))
          .sort((a, b) => readFileSync(b).length - readFileSync(a).length)[0];   // the main thread's is the large one
        res({ pt, code, wall, bootMs: j.bootMs, warns: j.warns.length, prof: JSON.parse(readFileSync(f, 'utf8')) });
      } catch (e) { res({ pt, code, wall, error: `${e.message}${err ? `\n${err.slice(-800)}` : ''}` }); }
      finally { rmSync(dir, { recursive: true, force: true }); }
    });
  });
}

// SELF and TOTAL (once per sample) per "function file:line".
function aggregate(p) {
  const byId = new Map(p.nodes.map((n) => [n.id, n]));
  const parent = new Map();
  for (const n of p.nodes) for (const c of n.children || []) parent.set(c, n.id);
  const key = (n) => { const cf = n.callFrame; return `${cf.functionName || '(anon)'} ${(cf.url || '(native)').replace(/^.*\/timesim\//, '')}:${cf.lineNumber + 1}`; };
  const self = new Map(), total = new Map();
  let covered = 0;
  for (let i = 0; i < p.samples.length; i++) {
    const dt = p.timeDeltas[i] || 0;
    covered += dt;
    let id = p.samples[i];
    const leaf = byId.get(id);
    self.set(key(leaf), (self.get(key(leaf)) || 0) + dt);
    const seen = new Set();
    while (id !== undefined) { const k = key(byId.get(id)); if (!seen.has(k)) { seen.add(k); total.set(k, (total.get(k) || 0) + dt); } id = parent.get(id); }
  }
  return { self, total, coveredMs: covered / 1000 };
}

const queue = [...points];
const rows = [];
await Promise.all(Array.from({ length: Math.min(PAR, queue.length) }, async () => {
  for (;;) {
    const pt = queue.shift();
    if (!pt) return;
    const r = await bootProfiled(pt);
    if (r.error) { rows.push(r); console.log(`  ✗ ${pt.name}: ${r.error}`); continue; }
    const a = aggregate(r.prof);
    rows.push({ ...r, prof: undefined, ...a });
    console.log(`  · ${pt.name.padEnd(20)} boot ${(r.bootMs / 1000).toFixed(1)} s, profile ${(a.coveredMs / 1000).toFixed(1)} s`);
  }
}));

const bad = rows.filter((r) => r.error || r.coveredMs < COVERAGE_FLOOR * r.wall);
const sum = (field) => { const m = new Map(); for (const r of rows) if (r[field]) for (const [k, v] of r[field]) m.set(k, (m.get(k) || 0) + v); return m; };
const SELF = sum('self'), TOTAL = sum('total');
const allMs = rows.reduce((a, r) => a + (r.coveredMs || 0), 0);
const fmt = (m) => [...m].sort((a, b) => b[1] - a[1]).slice(0, TOP)
  .map(([k, us]) => `${(us / 1e6).toFixed(1).padStart(8)} s ${(100 * us / 1e3 / allMs).toFixed(1).padStart(5)}%  ${k}`).join('\n');
// The heaviest points, and what owns each: the builder with the most total time that is
// not main.js' module body (the body owns everything, so it is skipped by name).
const owner = (r) => [...r.total].filter(([k]) => !/^\(anon\) src\/main\.js:1$|^\(root\)|^\(program\)|^\(anon\) node:/.test(k) && !/^(\(anon\)|evaluate|run|import|bootNative|link|instantiate|moduleEvaluation)\b/.test(k))
  .sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${(v / 1e6).toFixed(1)} s`);
const heavy = rows.filter((r) => !r.error).sort((a, b) => b.bootMs - a.bootMs);
console.log(`\n${rows.length} boot(s), ${(allMs / 1000).toFixed(0)} s of profiled boot in all\n\n-- the heaviest points, and the three builders that own each\n`
  + heavy.slice(0, 12).map((r) => `${(r.bootMs / 1000).toFixed(1).padStart(7)} s  ${r.pt.name.padEnd(20)} ${owner(r).join(' · ')}`).join('\n')
  + `\n\n-- TOTAL time over every boot (callees included, once per sample)\n${fmt(TOTAL)}\n\n-- SELF time over every boot\n${fmt(SELF)}`);
if (OUT) {
  writeFileSync(resolve(OUT), JSON.stringify({ points: rows.map((r) => ({ name: r.pt.name, bootMs: r.bootMs, coveredMs: r.coveredMs, error: r.error ?? null,
    top: r.total ? [...r.total].sort((a, b) => b[1] - a[1]).slice(0, 60).map(([k, v]) => [k, v / 1000]) : null })),
  total: [...TOTAL].sort((a, b) => b[1] - a[1]).slice(0, 200).map(([k, v]) => [k, v / 1000]),
  self: [...SELF].sort((a, b) => b[1] - a[1]).slice(0, 200).map(([k, v]) => [k, v / 1000]) }, null, 1));
  console.log(`\nwritten to ${resolve(OUT)}`);
}
if (bad.length) { console.log(`FAIL — ${bad.length} boot(s) unread or under-covered: ${bad.map((r) => r.pt.name).join(', ')}`); process.exit(1); }
