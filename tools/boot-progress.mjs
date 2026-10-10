// THE BOOT BAR'S TABLE — §267. Where the build IS, as a share of how long it
// takes, read off a measured boot rather than a clock or a count.
//
// §239 made the build hand the thread back at `await breathe(n)` seams, so the
// boot screen can repaint mid-build; §267 gives that screen a bar. What the bar
// may NOT show is the seam's ordinal over the seam count: seams are as dense as
// the code that needed them, not as the time it takes, and §267's filing
// measured the ordinal running 22.6 points ahead of the true elapsed fraction
// and then standing at 98% for ten seconds. So every seam carries a permanent
// id, and `src/boot-progress.js` maps each id to the share of the build that
// had elapsed when a measured boot FIRST reached it — rule 1, the number derived
// from a measurement with the measurement written beside it. This tool is the
// only thing that writes that file.
//
//   --check   Browser-free, and the CI gate (boot-yield.yml). Fails when the
//             table no longer describes main.js: a seam with no id, an id used
//             twice, or the seams' source order differing from the order the
//             table was measured on — which is what adding, removing or moving
//             a seam looks like. It then runs itself against four mutated
//             copies of main.js (an id dropped, two seams swapped, a seam
//             deleted, a seam added) and fails unless each one fails, because
//             a gate nobody has seen fire is a comment.
//   --write   Numbers any seam written as a bare `await breathe()` (the next
//             free id; an id is never renumbered, so a diff touches only the
//             seams it added), boots the app --boots times (default 3) with
//             every seam visit timed, and writes the table: per seam, the
//             median share of the build at each of its visits, simplified to
//             the fewest knots that stay within KNOT_TOL of every visit.
//             Run it whenever --check fails.
//
// What the shares are NOT is a statement about another machine: they are
// fractions of one host's boot, and a span that is GPU-bound there and
// CPU-bound here moves the bar unevenly on a host that differs. How far it
// drifts from the true elapsed fraction is measured, on CI's host, by
// tools/probe-267-boot-progress.mjs, which gates a ceiling derived there.
//
// Usage:
//   node tools/boot-progress.mjs --check
//   node tools/boot-progress.mjs --write [--boots 3]
import { readFileSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import os from 'node:os';

const ROOT = new URL('..', import.meta.url).pathname;
const MAIN_PATH = `${ROOT}src/main.js`;
const TABLE_PATH = `${ROOT}src/boot-progress.js`;
const arg = (f, d) => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : d; };

// Every seam in main.js's CODE — a line's text before any `//`, the same reading
// probe-239 counts by — in source order, with its id (null when unnumbered).
const SEAM_RE = /await breathe\((\d*)\)/g;
function seamsOf(src) {
  const out = [], stray = [];
  src.split('\n').forEach((line, i) => {
    const code = line.split('//')[0];
    for (const m of code.matchAll(SEAM_RE)) out.push({ line: i + 1, id: m[1] === '' ? null : Number(m[1]) });
    // A breathe() that is not awaited is not a seam: its promise is dropped
    // and the thread is never handed back, so it may not carry a share either.
    const calls = (code.match(/\bbreathe\(/g) || []).length - (code.match(/function breathe\(/g) || []).length;
    const awaited = (code.match(/await breathe\(/g) || []).length;
    if (calls !== awaited) stray.push(i + 1);
  });
  return { seams: out, stray };
}

// The checker proper: every reason the table does not describe this source.
function problems(src, table) {
  const { seams, stray } = seamsOf(src);
  const bad = [];
  for (const l of stray) bad.push(`line ${l}: a breathe() call that is not \`await breathe(n)\``);
  const bare = seams.filter((s) => s.id === null);
  if (bare.length) bad.push(`${bare.length} seam(s) with no id (lines ${bare.slice(0, 8).map((s) => s.line).join(', ')}${bare.length > 8 ? ', …' : ''})`);
  const seen = new Map();
  for (const s of seams) if (s.id !== null) {
    if (seen.has(s.id)) bad.push(`id ${s.id} is used twice (lines ${seen.get(s.id)} and ${s.line})`);
    else seen.set(s.id, s.line);
  }
  const order = seams.map((s) => s.id);
  const T = table.SEAM_ORDER, K = table.SEAM_KNOTS;
  if (!Array.isArray(T) || !Array.isArray(K) || T.length !== K.length) bad.push('the table is malformed: SEAM_ORDER and SEAM_KNOTS must be arrays of one length');
  else {
    // A row is null (never reached by the default build) or knots
    // [visit, share, …]: visits from 1 and strictly rising, shares in [0, 1)
    // and never falling.
    for (let i = 0; i < T.length; i++) {
      const kn = K[i];
      let ok = kn === null || (Array.isArray(kn) && kn.length >= 2 && kn.length % 2 === 0 && kn[0] === 1);
      for (let j = 0; ok && kn && j < kn.length; j += 2) {
        ok = Number.isInteger(kn[j]) && kn[j + 1] >= 0 && kn[j + 1] < 1
          && (j === 0 || (kn[j] > kn[j - 2] && kn[j + 1] >= kn[j - 1]));
      }
      if (!ok) { bad.push(`the table's row for seam ${T[i]} is malformed (${JSON.stringify(kn)})`); break; }
    }
    if (order.length !== T.length || order.some((id, i) => id !== T[i])) {
      const i = order.findIndex((id, k) => id !== T[k]);
      const at = i < 0 ? Math.min(order.length, T.length) : i;
      bad.push(`the seams no longer match the table: main.js has ${order.length}, the table was measured on ${T.length}; `
        + `first difference at position ${at + 1} (source ${order[at] ?? '—'} at line ${seams[at]?.line ?? '—'}, table ${T[at] ?? '—'})`);
    }
  }
  return bad;
}

async function loadTable() {
  return import(`${TABLE_PATH}?t=${Date.now()}`);
}

if (process.argv.includes('--check')) {
  const src = readFileSync(MAIN_PATH, 'utf8');
  const table = await loadTable();
  const bad = problems(src, table);
  if (bad.length) {
    for (const b of bad) console.error(`FAIL: ${b}`);
    console.error('\nThe boot bar\'s table no longer describes src/main.js. Regenerate it: node tools/boot-progress.mjs --write');
    process.exit(1);
  }
  // The mutation controls. Each is a source the table must NOT describe, made
  // from this one, and the checker has to say so.
  const lines = src.split('\n');
  const seamLines = seamsOf(src).seams.map((s) => s.line - 1);
  const mid = seamLines[seamLines.length >> 1], next = seamLines[(seamLines.length >> 1) + 1];
  const swapIds = () => {
    const L = lines.slice();
    const a = L[mid].match(/await breathe\((\d+)\)/)[1], b = L[next].match(/await breathe\((\d+)\)/)[1];
    L[mid] = L[mid].replace(`await breathe(${a})`, `await breathe(${b})`);
    L[next] = L[next].replace(`await breathe(${b})`, `await breathe(${a})`);
    return L.join('\n');
  };
  const maxId = Math.max(...seamsOf(src).seams.map((s) => s.id));
  const controls = [
    ['an id dropped', lines.map((l, i) => (i === mid ? l.replace(/await breathe\(\d+\)/, 'await breathe()') : l)).join('\n')],
    ['two seams swapped', swapIds()],
    ['a seam deleted', lines.map((l, i) => (i === mid ? l.replace(/await breathe\(\d+\);?/, '') : l)).join('\n')],
    ['a seam added', lines.map((l, i) => (i === mid ? `${l}\nawait breathe(${maxId + 1});` : l)).join('\n')],
  ];
  const silent = controls.filter(([, s]) => problems(s, table).length === 0).map(([n]) => n);
  if (silent.length) {
    console.error(`FAIL: the checker passed a mutated main.js (${silent.join('; ')}) — it is not reading what it claims to`);
    process.exit(1);
  }
  const { seams } = seamsOf(src);
  const reached = table.SEAM_KNOTS.filter((v) => v !== null).length;
  console.log(`boot-progress table OK — ${seams.length} seams in source order match the table `
    + `(${reached} with a measured share, ${seams.length - reached} unreached by the default build); `
    + `controls ${controls.length}/${controls.length} fired (${controls.map(([n]) => n).join(', ')})`);
  console.log(`  measured: ${table.MEASURED}`);
  process.exit(0);
}

if (!process.argv.includes('--write')) {
  console.error('usage: node tools/boot-progress.mjs --check | --write [--boots N]');
  process.exit(2);
}

// --write, part one: number the bare seams. Next free id, source order; a seam
// already numbered keeps its id for life.
let src = readFileSync(MAIN_PATH, 'utf8');
{
  const { seams, stray } = seamsOf(src);
  if (stray.length) { console.error(`REFUSED: breathe() calls that are not awaited at line(s) ${stray.join(', ')}`); process.exit(1); }
  let next = Math.max(0, ...seams.map((s) => s.id ?? 0)) + 1, stamped = 0;
  const lines = src.split('\n');
  for (const s of seams) if (s.id === null) {
    const i = s.line - 1, cut = lines[i].indexOf('//');
    const code = cut < 0 ? lines[i] : lines[i].slice(0, cut), rest = cut < 0 ? '' : lines[i].slice(cut);
    lines[i] = code.replace('await breathe()', () => `await breathe(${next++})`) + rest;
    stamped++;
  }
  if (stamped) { src = lines.join('\n'); writeFileSync(MAIN_PATH, src); }
  const dup = new Set(), ids = seamsOf(src).seams.map((s) => s.id);
  for (const id of ids) { if (dup.has(id)) { console.error(`REFUSED: id ${id} is used twice — give one of them a fresh id or a bare \`await breathe()\``); process.exit(1); } dup.add(id); }
  console.log(`seams: ${ids.length} in source, ${stamped} newly numbered`);
}

// --write, part two: measure. The same serving and the same Chromium flags as
// the boot probes, so the boot measured is the boot they judge.
const BOOTS = Number(arg('--boots', 3));
const PORT = 8401;
const { chromium } = await import('playwright');
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
process.on('exit', () => srv.kill());
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const runs = [];
for (let b = 0; b < BOOTS; b++) {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 700 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => { window.__bootProgressTrace = true; });
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'commit', timeout: 600000 });
  await page.waitForFunction(() => window.__clock?.boot?.done === true, null, { timeout: 600000 });
  const p = await page.evaluate(() => window.__clock.boot.progress);
  await ctx.close();
  if (!p.trace) { console.error('REFUSED: the boot record carries no per-visit trace — main.js did not honour window.__bootProgressTrace'); process.exit(1); }
  console.log(`  boot ${b + 1}/${BOOTS}: build span ${(p.spanMs / 1000).toFixed(1)} s, ${p.first.filter((v) => v !== null).length} seams reached, ${p.visits.reduce((x, y) => x + y, 0)} visits`);
  runs.push(p);
}
await browser.close(); srv.kill();

const median = (xs) => { const s = xs.slice().sort((a, b) => a - b), n = s.length; return n % 2 ? s[n >> 1] : (s[n / 2 - 1] + s[n / 2]) / 2; };
// The knots' tolerance: a fifth of a percentage point of the build, an order
// under the bar's own resolution on screen (one 180 px track is 0.56 points a
// pixel) and two under the probe's ceiling — so simplifying the curve costs the
// bar nothing it could show, and the file stays a few knots a seam.
const KNOT_TOL = 0.002;
// Douglas–Peucker on [visit, share] points, error measured in share: keep the
// end points, and the worst interior point whenever the chord misses it by
// more than the tolerance. Visits are the x axis, so a seam visited in two
// bursts keeps a knot at each burst's edge and the chord never spans the gap.
function simplify(pts) {
  if (pts.length <= 2) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop();
    let worst = 0, at = -1;
    for (let m = i + 1; m < j; m++) {
      const v = pts[i][1] + (pts[j][1] - pts[i][1]) * (pts[m][0] - pts[i][0]) / (pts[j][0] - pts[i][0]);
      const e = Math.abs(pts[m][1] - v);
      if (e > worst) { worst = e; at = m; }
    }
    if (worst > KNOT_TOL) { keep[at] = 1; stack.push([i, at], [at, j]); }
  }
  return pts.filter((_, m) => keep[m]);
}
const order = seamsOf(src).seams.map((s) => s.id);
const knots = order.map((id) => {
  const per = runs.map((r) => r.trace[id]).filter(Boolean);
  // Reached in fewer than half the boots is not a measurement of the default
  // build; a seam no boot reaches is a spec variant's, and holds no share.
  if (per.length * 2 <= runs.length) return null;
  // A visit count is the program's and the same on every boot; one that is not
  // would make the k-th visit a different point on each, so it refuses.
  const ns = new Set(per.map((t) => t.length));
  if (ns.size !== 1) { console.error(`REFUSED: seam ${id} was visited ${[...ns].join(' / ')} times across the boots — the build is not deterministic there`); process.exit(1); }
  const n = per[0].length, pts = [];
  let run = 0;
  for (let k = 0; k < n; k++) {
    const sh = median(runs.filter((r) => r.trace[id]).map((r) => r.trace[id][k] / r.spanMs));
    run = Math.max(run, Math.min(0.9999, sh));   // never falling within a seam, whatever the median does
    pts.push([k + 1, run]);
  }
  return simplify(pts).flatMap(([k, v]) => [k, Math.round(v * 1e4) / 1e4]);
});
const cpus = os.cpus();
const span = median(runs.map((r) => r.spanMs));
const measured = `${new Date().toISOString().slice(0, 10)}, median of ${BOOTS} boot(s) on ${cpus.length} × ${cpus[0]?.model || '?'} `
  + `(${os.platform()}/${os.arch()}, SwiftShader Chromium), build span ${(span / 1000).toFixed(1)} s`;

// SEAM_ORDER ten ids a line, SEAM_KNOTS one seam a line, so a diff that adds a
// seam moves one line of the first and adds one row to the second, beside the
// rows the new boot re-measured.
const rows = (xs) => {
  const out = [];
  for (let i = 0; i < xs.length; i += 10) out.push('  ' + xs.slice(i, i + 10).join(', ') + ',');
  return out.join('\n');
};
const knotRows = order.map((id, i) => `  ${knots[i] === null ? 'null' : `[${knots[i].join(', ')}]`},   // ${id}`).join('\n');
writeFileSync(TABLE_PATH, `// GENERATED by \`node tools/boot-progress.mjs --write\` — never edited by hand (§267).
//
// The boot screen's bar reads this. SEAM_ORDER is every \`await breathe(n)\` id in
// src/main.js, in source order, as it stood when the table was measured.
// SEAM_KNOTS[i] is seam SEAM_ORDER[i]'s curve: [visit, share, visit, share, …],
// where share is how much of the build — main.js's evaluation, from its first
// statement to releaseBuildInputGuard() — had elapsed at that visit, the median
// over the boots, simplified to the fewest knots within ${KNOT_TOL} of every visit.
// The visit count is the program's, identical on every boot and every machine.
// null is a seam the default build never reaches (a spec variant's branch).
//
// \`node tools/boot-progress.mjs --check\` fails the moment this stops describing
// main.js; regenerate rather than edit. How far the bar drifts from the true
// elapsed fraction on another host is tools/probe-267-boot-progress.mjs's to say.
export const MEASURED = ${JSON.stringify(measured)};
export const SEAM_ORDER = [
${rows(order)}
];
export const SEAM_KNOTS = [
${knotRows}
];
`);
const nk = knots.filter(Boolean).reduce((n, k) => n + k.length / 2, 0);
console.log(`wrote src/boot-progress.js — ${order.length} seams, ${knots.filter(Boolean).length} reached, ${nk} knots; ${measured}`);
