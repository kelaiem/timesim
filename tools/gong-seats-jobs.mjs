#!/usr/bin/env node
// RUNS tools/gong-seats.mjs IN PARALLEL: one process per (kind, mode), merged into one write of src/gong-seats.js.
//
//   node tools/gong-seats-jobs.mjs --write [kind …] [--modes bar,spiral] [--spec '<knobs>'] [--jobs N]
//   node tools/gong-seats-jobs.mjs --check [kind …] …           (re-derive every row, compare, write nothing)
//
// Each (kind, mode) is its own fixed point (the bar's and the spiral's seats move the hammer to different stations
// and each closes its own fit), so the solves are independent. gong-seats.mjs runs them serially in one browser,
// which a one-kind run already takes most of a 30-minute window to do. Here each runs in its own process, so its
// own browser (the tool-construction skill: one browser per concurrent boot, since the pages of one browser
// serialise on SwiftShader), its own in-memory seat module (gong-seats.mjs serves the table it is solving from
// memory, so the processes never see each other's candidates), and its own `--out` file. N at once, the pool's
// default (tools/boot-pool.mjs perfCores: the performance cores, half the logical CPUs off macOS) unless --jobs.
//
// THE MERGE. The committed table is read once. A (kind, mode) whose run logs `<mode> closed:` replaces that row with
// the child's. One that does not close is DROPPED: the serial tool's own outcome, where a kind keeps its other
// mode and the build then defaults to it (§317, case-shape.js defaultSeatMode). A kind left with neither mode
// keeps its committed rows and fails the run, as the serial tool does. Nothing is written until every process has finished, and only by this one,
// so there is one writer (never two `--write`s of one file at once). The children read src/gong-seats.js as
// committed. A (kind, mode) never reads its sibling's new row, and in the serial tool it read only the other
// mode's ARC build, which no row moves, so the merged table is the one a serial run derives.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { pool, perfCores } from './boot-pool.mjs';
import { fileText, loadFile } from './gong-seats-file.mjs';
import { FORM_KINDS } from '../src/layout.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'), OUT = join(ROOT, 'src/gong-seats.js');
const ARGS = process.argv.slice(2), WRITE = ARGS.includes('--write'), CHECK = ARGS.includes('--check');
const val = (k) => (ARGS.includes(k) ? ARGS[ARGS.indexOf(k) + 1] : null);
const MODES = (val('--modes') ?? 'bar,spiral').split(','), SPECQ = val('--spec'), JOBS = Number(val('--jobs')) || perfCores();
const KINDS = ARGS.filter((a, i) => !a.startsWith('--') && !['--modes', '--spec', '--jobs'].includes(ARGS[i - 1]));
if (WRITE === CHECK) { console.error('usage: node tools/gong-seats-jobs.mjs --write | --check [kind …] [--modes …] [--spec …] [--jobs N]'); process.exit(2); }
const kinds = KINDS.length ? KINDS : [...FORM_KINDS];
const tasks = kinds.flatMap((kind) => MODES.map((mode) => ({ kind, mode })));
const tmp = mkdtempSync(join(tmpdir(), 'gong-seats-'));
console.log(`${tasks.length} solve(s), ${JOBS} at once (${kinds.join(', ')} × ${MODES.join(', ')})`);
const t0 = Date.now();
const runs = await pool(tasks, ({ kind, mode }) => new Promise((resolve) => {
  const out = join(tmp, `${kind}-${mode}.js`), tag = `[${kind}/${mode}]`, log = [];
  const child = spawn(process.execPath, [join(ROOT, 'tools/gong-seats.mjs'), '--write', '--out', out, '--modes', mode,
    ...(SPECQ ? ['--spec', SPECQ] : []), kind], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  const line = (s) => { for (const l of String(s).split('\n')) if (l.trim()) { log.push(l); console.log(`${tag} ${l}`); } };
  child.stdout.on('data', line); child.stderr.on('data', line);
  child.on('close', (code) => resolve({ kind, mode, out, code, log }));
}), { concurrency: JOBS });
console.log(`all solves done in ${((Date.now() - t0) / 60000).toFixed(1)} min`);
const committed = loadFile(readFileSync(OUT, 'utf8'));
// the arrangement a --spec run solved for, read off the children's own logs (gong-seats.mjs prints it)
const arrKey = SPECQ ? runs.map((r) => r.log.find((l) => /^\s*arrangement /.test(l))?.trim().slice('arrangement '.length)).find(Boolean) : null;
if (SPECQ && !arrKey) { console.error('no child reported its arrangement key'); process.exit(1); }
const base = SPECQ ? JSON.parse(JSON.stringify(committed.arranged[arrKey] ?? {})) : JSON.parse(JSON.stringify(committed.designed));
let failed = false;
for (const r of runs) {
  const closed = r.log.some((l) => new RegExp(`^\\s*${r.mode} closed:`).test(l));
  if (!closed) {
    console.log(`${r.kind} ${r.mode}: did not close (exit ${r.code}) — dropped, as the serial tool drops it`);
    if (base[r.kind]) delete base[r.kind][r.mode];
    continue;
  }
  let got;
  try { const f = loadFile(readFileSync(r.out, 'utf8')); got = (SPECQ ? f.arranged[arrKey] : f.designed)?.[r.kind]?.[r.mode]; } catch { got = null; }
  if (!got) { console.error(`${r.kind} ${r.mode}: logged closed but wrote no row`); failed = true; continue; }
  (base[r.kind] ??= {})[r.mode] = got;
}
// a kind that closes in NEITHER mode keeps its committed rows and fails the run, the serial tool's outcome (it writes
// a kind's rows only when one of its modes closes)
const prior = SPECQ ? committed.arranged[arrKey] ?? {} : committed.designed;
for (const kind of kinds) if (!base[kind]?.bar && !base[kind]?.spiral) {
  console.error(`${kind}: no seat closes in either mode — its committed rows are kept`); failed = true;
  if (prior[kind]) base[kind] = JSON.parse(JSON.stringify(prior[kind])); else delete base[kind];
}
for (const kind of kinds) if (base[kind] && !base[kind].spiral && base[kind].bar) console.log(`${kind}: no spiral seat — its default is the bar`);
const text = SPECQ ? fileText(committed.designed, { ...committed.arranged, [arrKey]: base }) : fileText(base, committed.arranged);
rmSync(tmp, { recursive: true, force: true });
if (CHECK) {
  if (readFileSync(OUT, 'utf8') !== text) { console.error('FAIL: src/gong-seats.js is not what the tool derives — run `node tools/gong-seats-jobs.mjs --write`'); process.exit(1); }
  console.log('PASS: src/gong-seats.js re-derives');
} else { writeFileSync(OUT, text); console.log(`wrote ${OUT}`); }
process.exit(failed ? 1 : 0);
