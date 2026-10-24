// THE SUBSTITUTE JUDGE (BUILT §309) — shared by tools/technic-substitutes.mjs (which
// writes src/technic-substitutes-verdicts.js) and tools/probe-technic-substitutes.mjs
// (which re-judges it). Pure Node, no browser.
//
// THE QUESTION. A Rebrickable alternate or mould variant C of a placed LDraw part P
// (src/technic-rebrickable.js): does the model still work with C wherever it places P,
// with NOTHING ELSE changed? "Works" means every judge the model already has passes:
// the build probe (seated, through, on the axle, the tooth-phase mesh), the frame
// tables against the parts (probe-technic-ldraw: the tables frameFindings reads), each
// cell's own gates (keyless and motion; fusee and its loop, the groove seats; alarm,
// column wheel and pusher, the press; escapement, the rate and the lock) and the
// swept-insertion validator with its placed-pose overlap check (probe-technic-steps,
// per cell). Each runs as its own process with TECHNIC_SUBSTITUTE=P=C, so it reads C's
// geometry under P's name (tools/technic-pack.mjs): a keyed body's angle is re-solved by
// its own solver, and no judge is re-implemented here — a pass is the model's, not this
// file's.
//
// BEFORE GEOMETRY, IN ORDER (each a judge with a name; the first that fails is the verdict):
//   geometry   C has an LDraw file (the candidates' pack, or the main pack) — else NOT JUDGED
//   bricklink  BrickLink's Codes list C in at least one role-table colour — else FAILED: it
//              cannot be bought in a colour this page uses (BUILT §303's constraint)
//   ratio      where P is a gear, C's tooth count, MEASURED off C (`toothCount`), equals the
//              placement's: a different count changes a ratio, which P0 forbids — FAILED,
//              never judged further, whatever the geometry would say
//   friction   where P and C differ in friction (the catalogue names say one has friction
//              ridges and the other not), the model cannot tell whether the role needs it:
//              friction is not modelled. The geometric judges still run and a geometric
//              failure is still a failure; a geometric pass is NOT JUDGED: friction.
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { surfaceSamples } from '../src/technic-ldraw.js';
import { placedParts } from '../src/technic-ldraw.js';
import * as B from '../src/technic-bom.js';
import { frameAlarm, alarmStates, alarmBuild } from '../src/technic-alarm.js';
import { REBRICKABLE } from '../src/technic-rebrickable.js';
import { BRICKLINK } from '../src/technic-bricklink.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// THE TOOTH COUNT, measured: the part's surface projected along its own Z (a gear's bore, the
// library's convention), the largest radius per angular bin outside half the tip radius, and the
// number of upward crossings of the level midway between the lowest such radius (the roots) and
// the tip. The probe holds it to every placed gear's catalogued count (its control).
export const TOOTH_BINS = 1440, TOOTH_SAMPLE_LDU = 0.25;
export function toothCount(lib, id) {
  const pts = surfaceSamples(lib, id, TOOTH_SAMPLE_LDU);
  let tip = 0; for (const [x, y] of pts) tip = Math.max(tip, Math.hypot(x, y));
  const r = new Float64Array(TOOTH_BINS);
  for (const [x, y] of pts) {
    const d = Math.hypot(x, y); if (d < tip / 2) continue;
    const k = Math.floor(((Math.atan2(y, x) + Math.PI) / (2 * Math.PI)) * TOOTH_BINS) % TOOTH_BINS;
    r[k] = Math.max(r[k], d);
  }
  let lo = Infinity; for (const v of r) if (v > 0) lo = Math.min(lo, v);
  const mid = (lo + tip) / 2;
  let n = 0; for (let k = 0; k < TOOTH_BINS; k++) if (r[k] < mid && r[(k + 1) % TOOTH_BINS] >= mid) n++;
  return n;
}

// FRICTION, as the catalogues name it: both names are read (Rebrickable's and BrickLink's), and a
// pair differs when one says "with friction" and the other "without friction".
const FRICTION = (s) => (/\bwithout Friction\b/i.test(s ?? '') ? 'without' : /\bwith Friction\b/i.test(s ?? '') ? 'with' : null);
export function frictionOf(names) { for (const n of names) { const f = FRICTION(n); if (f) return f; } return null; }

// WHERE EACH PLACED PART IS: the cells (both generations, every keyless mode, every alarm state),
// its roles, the tooth counts its placements carry, and its parts-list lines (cell, generation, colour).
export function placedIndex(lib) {
  const idx = new Map();
  const at = (id) => { if (!idx.has(id)) idx.set(id, { cells: new Set(), roles: new Set(), teeth: new Set(), lines: [] }); return idx.get(id); };
  const see = (parts, cell) => { for (const p of parts) { if (B.CORD_ROLES.includes(p.role)) continue; const u = at(p.part); u.cells.add(cell); u.roles.add(p.role); if (p.teeth) u.teeth.add(p.teeth); } };
  for (const gen of B.GENERATIONS) for (const cell of B.cellIds()) {
    const c = B.bomForCell(lib, gen, cell);
    if (!c.bom) continue;
    const build = B.buildOf(lib, gen, cell).build;
    for (const m of build.modes?.length ? build.modes : [undefined]) see(placedParts(build, 0, m), cell);
    if (cell === 'alarm') { const af = frameAlarm(), st = alarmStates(lib, af); for (const mode of ['armed', 'ringing', 'off']) see(placedParts(alarmBuild(af, lib, st[mode])), cell); }
    for (const l of c.bom.lines) at(l.part).lines.push({ gen, cell, colour: l.colour, qty: l.qty, purchase: l.bricklink?.item ?? l.purchase.id });
  }
  return idx;
}

// THE JUDGES each cell runs (probe file stem, and the steps probe's cell argument)
export const CELL_KIND = (cell) => (cell.startsWith('row-') ? 'row' : cell);
export const KIND_PROBES = Object.freeze({
  row: ['build', 'ldraw'], keyless: ['build', 'ldraw', 'keyless', 'motion'], fusee: ['ldraw', 'fusee', 'fusee-loop'],
  alarm: ['ldraw', 'alarm', 'column-wheel', 'pusher'], escapement: ['ldraw', 'escapement'] });
export function probeRuns(cells) {
  const runs = new Map();
  for (const cell of [...cells].sort()) {
    for (const p of KIND_PROBES[CELL_KIND(cell)]) runs.set(p, { probe: p, arg: null });
    runs.set(`steps:${cell}`, { probe: 'steps', arg: cell });
  }
  return [...runs.values()];
}
export const runName = (r) => (r.arg ? `${r.probe} ${r.arg}` : r.probe);

// One judge, one process. Exit 0 is a pass, 1 a fail (every technic probe's contract); anything
// else (the heap, a signal) is an ERROR, never a verdict — and so is an UNCAUGHT EXCEPTION, which Node
// also reports with exit code 1 (it prints its version line after the stack), so a probe that threw
// cannot pass for a probe that judged.
export const HEAP_MB = 8192;
export function runProbe(run, P, C, { timeoutMs = 60 * 60 * 1000 } = {}) {
  return new Promise((resolve) => {
    const argv = [`--max-old-space-size=${HEAP_MB}`, join(ROOT, `tools/probe-technic-${run.probe}.mjs`), ...(run.arg ? [run.arg] : [])];
    const env = { ...process.env, ...(C ? { TECHNIC_SUBSTITUTE: `${P}=${C}` } : {}) };
    if (!C) delete env.TECHNIC_SUBSTITUTE;
    const t0 = Date.now(), ch = spawn(process.execPath, argv, { cwd: ROOT, env });
    let out = '';
    ch.stdout.on('data', (d) => { out += d; }); ch.stderr.on('data', (d) => { out += d; });
    const kill = setTimeout(() => ch.kill('SIGKILL'), timeoutMs);
    ch.on('close', (code, signal) => {
      clearTimeout(kill);
      const lines = out.split('\n');
      const why = lines.filter((l) => /^\s*(✗|FAIL\b|MISS\b)|^\s+ ?CONTROL:|^\s{9}\S/.test(l)).map((l) => l.trim().replace(/\(\d+ ms\)/g, '').replace(/\s+/g, ' ')).slice(0, 4);
      const threw = /\nNode\.js v\d+\.\d+/.test(out);
      if (threw) why.unshift(lines.find((l) => /^\w*Error\b/.test(l))?.trim() ?? 'uncaught exception');
      resolve({ run: runName(run), code: code ?? signal, ok: code === 0 && !threw, error: threw || (code !== 0 && code !== 1), why, ms: Date.now() - t0, substituted: C ? /^SUBSTITUTION \(BUILT §309\)/m.test(out) : null });
    });
  });
}
export async function pool(tasks, n) {
  const out = new Array(tasks.length); let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < tasks.length) { const k = i++; out[k] = await tasks[k](); } }));
  return out;
}

// The checks before geometry, for candidate c of placed part P (REBRICKABLE.lines[P].candidates[k]).
export function preJudge(P, c, u, libs) {
  const id = c.ldraw;
  const has = (lib) => lib.has(`${id}.dat`);
  const base = { candidate: id, rb: c.rb, rel: c.rel, dir: c.dir };
  if (id === P) return { ...base, status: 'skip', judge: 'same', detail: 'maps back to the placed LDraw file itself' };
  if (!has(libs.main) && !has(libs.cand)) return { ...base, status: 'not judged', judge: 'geometry', detail: `no LDraw file ${id}.dat in the LDraw library (tools/data/technic-candidates.mpd: Missing)` };
  const bl = c.bricklink;
  if (!bl) return { ...base, status: 'fail', judge: 'bricklink', detail: `BrickLink's Parts download has no item ${c.rb} (Rebrickable's BrickLink mapping)` };
  const listed = Object.keys(bl.elements ?? {}).filter((code) => (bl.elements[code] ?? []).length);
  if (!listed.length) return { ...base, status: 'fail', judge: 'bricklink', detail: `BrickLink lists no element for ${bl.number} in any colour this page uses` };
  // both packs as one library (the candidates' pack holds only the files the main pack does not)
  const lib = (libs.both ??= new Map([...libs.cand, ...libs.main]));
  if (u.teeth.size) {
    const n = toothCount(lib, id);
    if (!u.teeth.has(n) || u.teeth.size !== 1) return { ...base, status: 'fail', judge: 'ratio', detail: `${n} teeth, measured; the placement has ${[...u.teeth].join('/')} — a different count changes a ratio` };
  }
  const fP = frictionOf([...REBRICKABLE.lines[P].names, BRICKLINK.parts[P]?.name]), fC = frictionOf([c.name, bl.name]);
  return { ...base, status: 'go', friction: fP && fC && fP !== fC ? { placed: fP, candidate: fC } : null };
}

// Every (P, candidate) the subset names, judged. `only` limits to some placed ids.
// `cache` (a Map, optional): results already measured this session, by `${P}=${C}|${run}` — a run killed part way
// resumes without re-measuring; the caller owns its lifetime and never carries it across a change to the tree.
export async function judgeAll(libs, { only = null, jobs = 3, log = () => {}, cache = null, onResult = () => {} } = {}) {
  const measure = async (r, P, C) => {
    const key = `${P ?? ''}=${C ?? ''}|${runName(r)}`;
    if (cache?.has(key)) return cache.get(key);
    const res = await runProbe(r, P, C);
    if (!res.error) { cache?.set(key, res); onResult(key, res); }
    return res;
  };
  const idx = placedIndex(libs.main), verdicts = {}, tasks = [];
  for (const P of Object.keys(REBRICKABLE.lines).sort()) {
    if (only && !only.includes(P)) continue;
    const u = idx.get(P);
    if (!u) throw new Error(`technic-substitutes: ${P} is in the subset and placed by no build`);
    verdicts[P] = [];
    for (const c of REBRICKABLE.lines[P].candidates) {
      const v = preJudge(P, c, u, libs);
      v.sameItem = !!(c.bricklink && u.lines.length && u.lines.every((l) => l.purchase === c.bricklink.number));
      verdicts[P].push(v);
      if (v.status !== 'go') continue;
      v.runs = [];
      for (const r of probeRuns(u.cells)) tasks.push(async () => { const res = await measure(r, P, v.candidate); log(`  ${res.ok ? 'pass' : res.error ? 'ERROR' : 'fail'} ${P}=${v.candidate} ${res.run} (${Math.round(res.ms / 1000)} s)`); v.runs.push(res); });
    }
  }
  // THE BASELINE: every judge this run calls, once, on the model as it is. A judge that fails with
  // nothing substituted cannot attribute a failure to a candidate, so the run stops instead.
  const base = new Map();
  for (const list of Object.values(verdicts)) for (const v of list) if (v.status === 'go') for (const r of probeRuns(idx.get(Object.keys(verdicts).find((P) => verdicts[P] === list)).cells)) base.set(runName(r), r);
  const baseRes = await pool([...base.values()].map((r) => async () => { const res = await measure(r, null, null); log(`  ${res.ok ? 'pass' : 'FAIL'} baseline ${res.run} (${Math.round(res.ms / 1000)} s)`); return res; }), jobs);
  const baseBad = baseRes.filter((r) => !r.ok);
  if (baseBad.length) throw new Error(`technic-substitutes: the judges fail with nothing substituted: ${baseBad.map((r) => `${r.run} (${r.why.join(' | ')})`).join('; ')}`);
  await pool(tasks, jobs);
  for (const [P, list] of Object.entries(verdicts)) for (const v of list) if (v.status === 'go') finish(v, [...idx.get(P).cells]);
  return verdicts;
}
const ORDER = (a, b) => (a.run < b.run ? -1 : a.run > b.run ? 1 : 0);
// The verdict, over every cell the part is placed in (`status`, `judge`), and PER CELL (`cells`): a parts-list line
// belongs to one build, and a substitute is offered on it when the judges THAT build calls for pass (probeRuns of that
// cell alone: its own gates, its steps, and the build and frame-table probes the kind runs). A candidate the alarm
// refuses may still be the keyless works' substitute, and the line says which it is.
export function finish(v, cells) {
  v.runs.sort(ORDER);
  const err = v.runs.find((r) => r.error);
  if (err) throw new Error(`technic-substitutes: ${err.run} for ${v.candidate} ended with code ${err.code}: ${err.why.join(' | ')}`);
  const bad = v.runs.filter((r) => !r.ok);
  if (v.runs.some((r) => r.substituted === false)) throw new Error(`technic-substitutes: a judge for ${v.candidate} did not read the substitution`);
  v.judges = v.runs.map((r) => ({ run: r.run, ok: r.ok, ...(r.ok ? {} : { why: r.why }) }));
  const verdictOf = (runs) => {
    const b = runs.filter((r) => !r.ok);
    if (b.length) return { status: 'fail', judge: b[0].run, detail: b[0].why[0] ?? 'the judge exited non-zero' };
    if (v.friction) return { status: 'not judged', judge: 'friction', detail: `every geometric judge passes; the placed part is ${v.friction.placed} friction ridges and this one ${v.friction.candidate}, and friction is not modelled` };
    return { status: 'pass', judge: null, detail: `passes ${runs.length} judges` };
  };
  Object.assign(v, verdictOf(v.runs));
  v.cells = Object.fromEntries([...cells].sort().map((cell) => {
    const want = new Set(probeRuns([cell]).map(runName)), mine = v.runs.filter((r) => want.has(r.run));
    if (mine.length !== want.size) throw new Error(`technic-substitutes: ${v.candidate} in ${cell}: ${want.size - mine.length} of its judges did not run`);
    return [cell, verdictOf(mine)];
  }));
  void bad;
  delete v.runs;
  return v;
}
