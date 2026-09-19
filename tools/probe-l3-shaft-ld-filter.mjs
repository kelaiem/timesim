// §234 Landing 3 — CAN ANY SHAFT SECTION CLEAR TURN_LD_TARGET AND ITS OWN
// CORRIDOR TOGETHER? A REPORT.
// (INDEX.md's `kind` column says acceptance because the classifier keys on
// `process.exit`, and this exits only when a tree will not boot at all —
// `probe-234-group-c.mjs` and the other §234 probes carry the same label for
// the same reason.)
//
// TODO 145 group A's lay shaft is λ-sized (`ALARM_LINK_SHAFT_R`, §232) at
// r 0.2664, L/D 104.3 against `TURN_LD_MAX` 20 — the check this repo's
// `turning` gate exists for. This asks the honest next question: is there a
// SHORTER candidate chord, at a candidate section s thick enough for
// TURN_LD_TARGET, that also clears the movement around it? Landing 1's own
// note answers half of it already (the alarm setting idler's max legal
// radius is 0.2850, `probe-137-jumper-envelope.mjs`, well under the ~0.836
// even TURN_LD_MAX's own ceiling would ask at today's chord) — this widens
// the search to every candidate the §112 rod-site solve itself considers,
// not just today's chord, and scores it with the SAME piecewise footprint
// Landing 3 gave the solve for the rod (never a blanket guess — see the
// header note on `ALARM_LINK_COL_BUSH_Z` in `src/main.js`).
//
// HOW. A SCRATCH TREE (the `probe-234-stem-ceiling.mjs` pattern: an exact
// ANCHOR string, matched and failing loudly if it has moved, patched per
// candidate and re-booted) adds one thing the shipped solve does not need:
// a push of every (rc, azw) candidate the joint stage-2 loop actually
// scores — position, chord length, and each of colC/chordC/tabC — onto
// `window.__ld3Dump`, and a URL param that substitutes the candidate
// section's own bush-OD-equivalent radius (s + 0.02 + 0.12, the wall
// `ALARM_LINK_SHAFT_NECK_R`'s bush uses) for the shipped 0.26 in
// `scoreChord`'s far-segment piece. Nothing else moves: the rod's own
// column footprint (`ALARM_LINK_COL_BUSH_Z`) is untouched, so this reads
// the REAL solve's real candidate population, not a second model of it.
// The L/D filter itself is applied CLIENT-SIDE, over that dump, for each
// candidate section s and each target T ∈ {TURN_LD_TARGET, TURN_LD_MAX}:
// keep only candidates whose chord clears (chordLen − ALARM_FORK_RETREAT)
// / (2s) ≤ T (ALARM_FORK_RETREAT because the shaft's own metal starts that
// far inboard of the chord's inner end — the same term the shipped
// ALARM_LINK_SHAFT_R subtracts), and report the best-clearance survivor.
//
// CONTROLS:
//   · CONTROL — no params: the dump's winning candidate (max c) must
//     reproduce the shipped `ALARM_LINK_ROD_XY`, `ALARM_LINK_AZ_DEG` (both
//     within the build's own 0.25 tripwire) and boot silent.
//   · at s = the shipped ALARM_LINK_SHAFT_R itself, the filter must ADMIT
//     the shipped chord (since the shipped shaft is λ-sized, not L/D-sized,
//     its own L/D — 104.3 — will not pass a target of 18 or 20; this
//     control is on the FILTER arithmetic, not the shaft, and is checked by
//     hand against `checkTurning`'s own reported ratio rather than gated
//     here).
//
// WHAT THIS IS NOT: `probe-231-lever-width.mjs SET=link232` (grows the
// shaft radially on TODAY's fixed chord — this instead varies the CHORD);
// `probe-234-group-c.mjs` (asks whether the shipped chord's own section
// alone closes the row, already answered no); `probe-137-jumper-envelope`
// (the one real corridor number this cross-checks, not reproduces).
//
// Usage: cd tools && node probe-l3-shaft-ld-filter.mjs
//        RS=0.2664,0.30,0.40,0.445,0.553,0.927 node probe-l3-shaft-ld-filter.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = process.env.PORT || 8791;
const RS = (process.env.RS ? process.env.RS.split(',').map(Number)
  : [0.2664, 0.30, 0.40, 0.445, 0.553, 0.927]);
const TARGETS = [18, 20]; // TURN_LD_TARGET, TURN_LD_MAX

const CHORD_ANCHOR = '        const d = dToBox(px, py, b) - (t * len <= 2.5 ? 0.6 : 0.26);';
const LOOP_ANCHOR = `      if (!best || c > best.c) best = { ...rc, c, colC: rc.c, who: boundBy, tabAzDeg: azw };`;

const TREE = fs.mkdtempSync(path.join(os.tmpdir(), 'l3-ld-'));
for (const p of ['index.html', 'src', 'vendor']) fs.cpSync(path.join('..', p), path.join(TREE, p), { recursive: true });
process.on('exit', () => { try { fs.rmSync(TREE, { recursive: true, force: true }); } catch {} });
const ORIG = fs.readFileSync('../src/main.js', 'utf8');
for (const a of [CHORD_ANCHOR, LOOP_ANCHOR]) {
  if (!ORIG.includes(a)) {
    console.error(`an anchor is not in src/main.js:\n  ${a}\nthe §112 solve moved, and this probe patches lines that no longer exist`);
    process.exit(1);
  }
}
let patched = ORIG.replace(CHORD_ANCHOR,
  `        const _bushR = (typeof location !== 'undefined' && new URLSearchParams(location.search).has('bushR')) ? +new URLSearchParams(location.search).get('bushR') : 0.26;\n`
  + `        const d = dToBox(px, py, b) - (t * len <= 2.5 ? 0.6 : _bushR);`);
patched = patched.replace(LOOP_ANCHOR,
  `      if (!best || c > best.c) best = { ...rc, c, colC: rc.c, who: boundBy, tabAzDeg: azw };\n`
  + `      if (typeof window !== 'undefined') (window.__ld3Dump || (window.__ld3Dump = [])).push({ x: rc.x, y: rc.y, d: rc.d, k: rc.k, azw, c, colC: rc.c, chordC: cc, tabC: tb.c, chordLen: Math.hypot(tx - rc.x, ty - rc.y) });`);
fs.writeFileSync(path.join(TREE, 'src', 'main.js'), patched);

const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: TREE, stdio: 'ignore' });
process.on('exit', () => srv.kill());
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });

async function run(qs) {
  const page = await browser.newPage();
  const warns = [];
  page.on('console', (m) => { if (m.type() === 'warning' && !/WebGL|GroupMarker|GL Driver|swiftshader|Deprecation|coplanar/i.test(m.text())) warns.push(m.text()); });
  page.on('pageerror', (e) => warns.push('PAGEERROR ' + String(e).slice(0, 240)));
  let up = true;
  await page.goto(`http://127.0.0.1:${PORT}/index.html${qs}&n=${Date.now()}`, { waitUntil: 'load', timeout: 90000 }).catch(() => { up = false; });
  if (up) await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 }).catch(() => { up = false; });
  if (!up) { await page.close(); return { up: false, warns }; }
  const out = await page.evaluate(() => ({
    xy: window.__ARL_XY, dump: window.__ld3Dump || [],
  }));
  await page.close();
  return { up: true, warns, ...out };
}

// pull ALARM_LINK_ROD_XY out too, for the site control — a second tiny patch
// (kept separate from the dump patch so a failure here doesn't hide behind
// the dump's own anchor).
{
  const XY_ANCHOR = 'const ALARM_LINK_ROD_AZ_DEG = (Math.atan2(ALARM_LINK_ROD_XY.y, ALARM_LINK_ROD_XY.x) / DEG2RAD + 360) % 360;';
  const p2 = patched.replace(XY_ANCHOR, `${XY_ANCHOR}\nif (typeof window !== 'undefined') window.__ARL_XY = { x: ALARM_LINK_ROD_XY.x, y: ALARM_LINK_ROD_XY.y, az: ALARM_LINK_AZ_DEG };`);
  if (p2 === patched) { console.error('the XY anchor is not in src/main.js'); process.exit(1); }
  fs.writeFileSync(path.join(TREE, 'src', 'main.js'), p2);
}

const ctrl = await run('?');
console.log('=== CONTROL (shipped bushR 0.26) ===');
console.log(`  boot ${ctrl.up ? 'up' : 'FAILED'}, ${ctrl.warns.length} warning(s)`);
for (const w of ctrl.warns) console.log('  WARN ' + w.slice(0, 300));
if (ctrl.up) {
  console.log(`  xy (${ctrl.xy.x.toFixed(3)}, ${ctrl.xy.y.toFixed(3)}) az ${ctrl.xy.az.toFixed(1)}`);
  const d = Math.hypot(ctrl.xy.x - 34.32, ctrl.xy.y - 16.89);
  console.log(`  |delta| from frozen (34.32, 16.89): ${d.toFixed(4)} (build's own tripwire: 0.25)`);
}

console.log(`\n=== SHAFT L/D FILTER, honest piecewise column (shipped), bushR = s + 0.14 per section ===`);
const rows = [];
for (const s of RS) {
  const bushR = s + 0.02 + 0.12;
  const r = await run(`?bushR=${bushR.toFixed(4)}`);
  if (!r.up) { console.log(`s=${s}: BOOT FAILED`); continue; }
  const evalTarget = (target) => {
    const ok = r.dump.filter((row) => (row.chordLen - 1.1) / (2 * s) <= target);
    if (!ok.length) {
      const shortest = r.dump.reduce((a, b) => (b.chordLen < a.chordLen ? b : a), r.dump[0]);
      return { survives: false, shortestChord: +shortest.chordLen.toFixed(3), shortestC: +shortest.c.toFixed(4) };
    }
    const best = ok.reduce((a, b) => (b.c > a.c ? b : a), ok[0]);
    return { survives: true, bestChord: +best.chordLen.toFixed(3), bestC: +best.c.toFixed(4),
      colC: +best.colC.toFixed(4), chordC: +best.chordC.toFixed(4), tabC: +best.tabC.toFixed(4),
      x: +best.x.toFixed(3), y: +best.y.toFixed(3), azw: best.azw };
  };
  const row = { s, bushR: +bushR.toFixed(4), warns: r.warns.length, candidates: r.dump.length };
  for (const T of TARGETS) row[`LD${T}`] = evalTarget(T);
  rows.push(row);
  console.log(`s=${s} (bushR ${bushR.toFixed(4)}) — ${r.warns.length} warn(s), ${r.dump.length} candidates`);
  for (const T of TARGETS) console.log(`  L/D<=${T}: ${JSON.stringify(row[`LD${T}`])}`);
}
console.log(`\nfull table: ${JSON.stringify(rows)}`);
await browser.close();
process.exit(0);
