// §127 tier 3 Landing A — THE ACCEPTANCE FOR ASSEMBLING ACROSS PROCESSES, at a
// scale a person can iterate at.
//
// The landing's claim is that the battery's assembly half does not care where
// its payloads were measured: one process, or N workers writing task files a
// collector reads, must produce the SAME report. §122's envelope, as for every
// tier — nothing here may change a verdict, and the acceptance is a
// byte-identical `--report`.
//
// Three identities, and the third is the one this probe exists for:
//
//   1. `--matrix 0/1` → `--collect` == a plain run. One worker, so this is the
//      transport alone: the payloads survive the round trip through JSON and
//      the gates read them the same.
//   2. `--matrix 0/2` + `--matrix 1/2` → `--collect` == the same. Two workers
//      that never speak to each other derive one partition from in-repo data,
//      and a SPLIT check's slices land in different processes — so the slice
//      merge itself now spans the seam.
//   3. WITHHOLD one worker's file and the collect must FAIL, naming the shards
//      and the tasks that never arrived. A green smaller run is the whole
//      hazard of this landing: every gate reports only whether its failure
//      list is empty, so work that silently never happened passes all of them.
//      This is the assertion the other two cannot make.
//
// It drives ci-battery.mjs as a CHILD PROCESS rather than importing it: that
// file runs its main flow at module scope, so an import IS a run.
//
// Proving any of this against the real battery costs an hour a run. `--only`
// (ci-battery.mjs's own probe flag) narrows it to two cheap slices of
// `clearances` plus two whole checks — which still exercises every line that
// could break the seam: the per-slice payload gate, the merge, the roster
// gates, the anchors, the spec tier's two gates and the report writer. Four
// browser runs of that selection, ~11 min on a dev container.
//
//   node tools/probe-127-matrix.mjs [check-or-slice,check-or-slice,…]
//
// The selection is overridable for iterating on the harness itself, the way
// the other §127 probes take their axes — but the default is the one that
// carries the argument, because a selection with no SPLIT check in it would
// leave the cross-process merge unexercised.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BATTERY = join(HERE, 'ci-battery.mjs');
// Two whole checks and two slices of one split check. The pair of slices is
// what makes the 2-worker case meaningful: at K=1 per worker they land in
// different shards, so different PROCESSES measure them and the collector is
// what puts `clearances` back together.
const ONLY = process.argv[2] ?? 'graph,support,clearances:crown,clearances:alarmToggle';
const out = mkdtempSync(join(tmpdir(), 'probe-127-matrix-'));
const bad = [];

function run(label, args) {
  console.log(`\n$ node tools/ci-battery.mjs ${args.join(' ')}`);
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [BATTERY, ...args], { encoding: 'utf8', maxBuffer: 1 << 28 });
  const text = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  console.log(`  ${label}: exit ${r.status} · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  return { status: r.status, text };
}

// The standing report exemptions, and they are all wall clock: `ms` (the cost
// column's own refresh field), `sliceMs` beside it, and the census's two timing
// fields — probe-127-split.mjs's exemption, for its reason. Every counter, every
// row and every verdict must be identical.
const EXEMPT = new Set(['ms', 'sliceMs', 'exactMs', 'verdictMs']);
const canon = (v) => (Array.isArray(v) ? v.map(canon)
  : v && typeof v === 'object'
    ? Object.fromEntries(Object.entries(v).filter(([k]) => !EXEMPT.has(k)).map(([k, x]) => [k, canon(x)]))
    : v);
const lines = (path) => JSON.stringify(canon(JSON.parse(readFileSync(path, 'utf8'))), null, 1).split('\n');

function identical(what, refPath, gotPath) {
  const a = lines(refPath);
  const b = lines(gotPath);
  if (a.length === b.length && a.every((l, i) => l === b[i])) {
    console.log(`IDENTICAL — ${what} reports what a single process reports, byte for byte (wall-clock fields exempt)`);
    return;
  }
  bad.push(what);
  console.log(`DIFFERENT — ${what} does not reproduce the single-process report:`);
  let shown = 0;
  for (let i = 0; i < Math.max(a.length, b.length) && shown < 20; i++) {
    if (a[i] !== b[i]) { console.log(`  L${i}\n   one process: ${a[i]}\n   collected:   ${b[i]}`); shown++; }
  }
}

try {
  // The reference. --shards 1 keeps the boots down and costs nothing here: what
  // this probe measures is the seam between processes, and the grouping inside
  // one process is already `--shards 1`'s own identity (§81).
  const base = ['--shards', '1', '--only', ONLY];
  const r0 = run('reference', [...base, '--report', join(out, 'r0.json')]);
  if (r0.status !== 0) { bad.push('the reference run is not green'); console.log(r0.text); }

  // ---- 1. one worker ------------------------------------------------------
  const w1 = run('worker 0/1', [...base, '--matrix', '0/1', '--tasks-out', join(out, 'a.json')]);
  if (w1.status !== 0) { bad.push('worker 0/1'); console.log(w1.text); }
  const c1 = run('collect (1 file)', ['--collect', join(out, 'a.json'), '--report', join(out, 'r1.json')]);
  if (c1.status !== 0) { bad.push('collect of one worker is not green'); console.log(c1.text); }
  identical('one worker collected', join(out, 'r0.json'), join(out, 'r1.json'));

  // ---- 2. two workers -----------------------------------------------------
  const w2a = run('worker 0/2', [...base, '--matrix', '0/2', '--tasks-out', join(out, 'b0.json')]);
  if (w2a.status !== 0) { bad.push('worker 0/2'); console.log(w2a.text); }
  const w2b = run('worker 1/2', [...base, '--matrix', '1/2', '--tasks-out', join(out, 'b1.json')]);
  if (w2b.status !== 0) { bad.push('worker 1/2'); console.log(w2b.text); }
  const c2 = run('collect (2 files)', ['--collect', join(out, 'b0.json'), join(out, 'b1.json'),
    '--report', join(out, 'r2.json')]);
  if (c2.status !== 0) { bad.push('collect of two workers is not green'); console.log(c2.text); }
  identical('two workers collected', join(out, 'r0.json'), join(out, 'r2.json'));

  // ---- 3. the withheld worker --------------------------------------------
  // What worker 1 carried is read from its own file rather than re-derived
  // here: the missing work is exactly what the file that is being withheld
  // contains, and a probe that computed it a second way would be asserting
  // its own copy of the partition instead of the harness's.
  //
  // Asserted against the ROWS the three disciplines emit, not against the words
  // appearing anywhere in the log: `graph` is in every run's output as a gate
  // name, so a substring match would pass on a run that named nothing missing.
  const withheld = JSON.parse(readFileSync(join(out, 'b1.json'), 'utf8'));
  const owed = [
    ...withheld.ownedShards.map((s) => `"shardNeverCollected": ${s}`),
    ...Object.keys(withheld.tasks).map((key) => {
      const [name, axis] = key.split(':');
      return axis ? `"sliceNeverRan": "${axis}"` : `"neverRan": "${name}"`;
    }),
  ];
  const c3 = run('collect (1 of 2 files)', ['--collect', join(out, 'b0.json'), '--report', join(out, 'r3.json')]);
  if (c3.status === 0) {
    bad.push('a collect missing a worker file exited 0 — a green smaller run');
  } else {
    const silent = owed.filter((k) => !c3.text.includes(k));
    if (silent.length) {
      bad.push(`the failing collect never named ${silent.join(' · ')}`);
      console.log(c3.text);
    } else {
      console.log(`REFUSED — the collect exited ${c3.status}, and every shard and task the withheld `
        + `worker carried is named in its failures (${owed.join(' · ')})`);
    }
  }
} finally {
  rmSync(out, { recursive: true, force: true });
}

console.log('');
if (bad.length) {
  console.log(`FAILED: ${bad.join(' · ')}`);
  process.exit(1);
}
console.log('PASS — the assembly half reports the same battery from one process, from two, and refuses a short one');
