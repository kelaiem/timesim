// §234 step 4 — HOW FAT CAN THE ALARM STEM GET BEFORE THE §45 LIFTER'S
// CORRIDOR RUNS OUT? A REPORT.
// (INDEX.md's `kind` column says acceptance because the classifier keys on
// `process.exit`, and this exits only when a tree will not boot at all — the
// other four §234 probes carry the same label for the same reason.)
//
// WHY IT EXISTS. `probe-234-corner-z.mjs` settled the corner's own column: the
// grown bevel fits under the base plate once the corner's plane is DERIVED
// rather than left at its literal, and the §45 release lifter's run clears it.
// But the corner is not the only thing the stem sizes. The lifter's guide stack
// hangs from the alarm crown's COLLAR, and a collar is a ring pressed on the
// stem — so a fatter stem carries the whole stack down, one for one, into a
// corridor whose floor is the release sleeve's tab plane.
//
// That plane is not a knob either: `ALARM_SLEEVE_TOP` hangs one CLEAR_MARGIN
// under the heart cam's band, and the heart is pressed on the HOUR TUBE. So the
// corridor's floor is pinned to the motion works, and the question this answers
// is the one that decides whether "grow the corner" lands at all: at what stem
// radius does the corridor run out?
//
// WHAT IT IS NOT. This does not measure the corner (that is
// `probe-234-corner-z.mjs`), the stem's own neighbours (`probe-234-step4.mjs`)
// or the cost of moving the corner outboard (`probe-234-corner-move.mjs`). It
// measures ONE number: the largest `ALARM_STEM_R` whose tree still boots
// silent.
//
// HOW. `ALARM_STEM_R` is derived from the census bar and §233's target, so a
// candidate is a SCRATCH TREE with that one declaration replaced by a literal,
// booted headless, with every warning the shipped asserts raise collected
// verbatim. Nothing here judges the corridor; the §45 asserts do, and this
// reports what they said. Everything downstream — the bevel's bore and tooth
// count, the corner's plane, the bearing cock, the collar, the whole guide
// stack — re-derives from that one literal, which is the point: a probe that
// patched more than one number would be measuring its own arithmetic.
//
// CONTROLS:
//   · SILENT — the unpatched tree's warning set is collected first. Every row
//     below is read as a DIFFERENCE from it, so a tree that was already red
//     cannot be mistaken for a corridor finding.
//   · DEGENERACY — patched with the radius the movement shipped before §234
//     (0.42), the tree must boot with no §45 warning. That is the strong one:
//     it says the whole derivation chain collapses back onto the shipped design
//     at the shipped radius, so a warning at any larger radius is the corridor
//     closing and not the apparatus misfiring.
//   · MONOTONE — the §45 shortfall must grow with the radius, on every row. If
//     it does not, the stack is not hanging off the collar and the premise of
//     the sweep is wrong.
//
// Usage: cd tools && node probe-234-stem-ceiling.mjs
//        RS=0.42,0.6,0.8 node probe-234-stem-ceiling.mjs   (pick the candidates)

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ANCHOR = 'const ALARM_STEM_R = Math.max(STEM_STOCK_R_U, ALARM_STEM_BAR / (2 * TURN_LD_TARGET));';
const PORT = process.env.PORT || 8507;
const STEM_STOCK_R_U = 0.9236;   // layout.js STEM_STOCK_R_U (tap 7, ⌀0.70 mm)
const RS = (process.env.RS ? process.env.RS.split(',').map(Number)
  : [0.42, 0.5, 0.55, 0.6, 0.65, 0.7, 0.8, STEM_STOCK_R_U, 1.1801, 1.3112]);

const TREE = fs.mkdtempSync(path.join(os.tmpdir(), 'stem-ceil-'));
for (const p of ['index.html', 'src', 'vendor']) fs.cpSync(path.join('..', p), path.join(TREE, p), { recursive: true });
process.on('exit', () => { try { fs.rmSync(TREE, { recursive: true, force: true }); } catch {} });
const ORIG = fs.readFileSync('../src/main.js', 'utf8');
if (!ORIG.includes(ANCHOR)) {
  console.error(`the anchor is not in src/main.js:\n  ${ANCHOR}\nthe stem's declaration moved, and this probe patches a line that no longer exists`);
  process.exit(1);
}

const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: TREE, stdio: 'ignore' });
process.on('exit', () => srv.kill());
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });

async function boot(source, label) {
  fs.writeFileSync(path.join(TREE, 'src', 'main.js'), source);
  const page = await browser.newPage();
  const warns = [];
  page.on('console', (m) => {
    if (m.type() !== 'warning') return;
    const t = m.text();
    if (/WebGL|GroupMarker|GL Driver|swiftshader|Deprecation|coplanar/i.test(t)) return;
    warns.push(t);
  });
  page.on('pageerror', (e) => warns.push('PAGEERROR ' + String(e).slice(0, 240)));
  let ok = true;
  await page.goto(`http://127.0.0.1:${PORT}/index.html?n=${Date.now()}`, { waitUntil: 'load', timeout: 90000 })
    .catch(() => { ok = false; });
  if (ok) await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 }).catch(() => { ok = false; });
  let m = null;
  if (ok) m = await page.evaluate(() => {
    const c = window.__clock;
    const named = (n) => { let f = null; c.scene.traverse((o) => { if (!f && o.name === n) f = o; }); return f; };
    const st = named('alarmStem');
    return { stemR: st?.geometry?.parameters?.radiusTop ?? null };
  }).catch(() => null);
  await page.close();
  return { label, ok, warns, ...(m || {}) };
}

// the §45 shortfall, read out of the assert's own text rather than recomputed
const shortfall = (warns) => {
  for (const w of warns) {
    const m = /§45 lifter blade bottom clears the chord top: (-?\d+\.\d+), need (-?\d+\.\d+)/.exec(w);
    if (m) return { got: Number(m[1]), need: Number(m[2]) };
  }
  return null;
};
const f = (x, n = 4) => (x === null || x === undefined ? '—' : Number(x).toFixed(n));

console.log('\n§234 step 4 — how fat can the alarm stem get before the §45 corridor runs out?\n');

const ref = await boot(ORIG, 'as the tree stands');
console.log('--- CONTROLS');
console.log(`  SILENT   : the unpatched tree boots with ${ref.warns.length} warning(s); every row below is read against that set`);
for (const w of ref.warns) console.log('      · ' + w.slice(0, 200));

const rows = [];
for (const r of RS) rows.push({ r, ...(await boot(ORIG.replace(ANCHOR, `const ALARM_STEM_R = ${r};   // probe-234-stem-ceiling scratch`), `ALARM_STEM_R = ${r}`)) });

const shipped = rows.find((x) => Math.abs(x.r - 0.42) < 1e-9);
const degen = shipped && shipped.ok && !shortfall(shipped.warns);
console.log(`  DEGENERACY: at the pre-§234 radius 0.42 the tree boots with ${shipped ? shipped.warns.length : '—'} warning(s) and ${degen ? 'NO §45 shortfall — OK, the whole derivation collapses onto the shipped design' : 'a §45 shortfall — FAILED: the apparatus warns where the shipped movement does not, so no row below is about the corridor'}`);

const sf = rows.map((x) => ({ r: x.r, s: shortfall(x.warns) }));
const withS = sf.filter((x) => x.s);
const mono = withS.every((x, i) => i === 0 || x.s.got <= withS[i - 1].s.got + 1e-9);
console.log(`  MONOTONE : the §45 shortfall worsens as the stem fattens, on every row  ${mono ? 'OK' : 'FAILED — the stack is not hanging off the collar'}`);

console.log('\n--- WHAT EACH RADIUS COSTS');
console.log('  stem r    ⌀ mm     §45 blade over the chord   need     other warnings');
for (const x of rows) {
  const s = shortfall(x.warns);
  const others = x.warns.filter((w) => !/§45 lifter blade bottom/.test(w)).length;
  const mark = !s ? '  ← the corridor still holds' : '';
  console.log(`  ${f(x.r, 4).padStart(7)}  ${f(x.r * 2 * 0.379, 3).padStart(6)}   ${(s ? f(s.got, 3) : 'clear').padStart(12)}          ${s ? f(s.need, 2) : '   —'}     ${String(others).padStart(3)}${x.ok ? '' : '  DID NOT BOOT'}${mark}`);
}

const lastOk = [...rows].reverse().find((x) => x.ok && !shortfall(x.warns));
const firstBad = rows.find((x) => shortfall(x.warns));
console.log(`\n--- WHERE THE CORRIDOR RUNS OUT`);
if (lastOk && firstBad) console.log(`  between ${f(lastOk.r)} (clear) and ${f(firstBad.r)} (short by ${f(shortfall(firstBad.warns).got, 3)}).`);
console.log(`  stem stock is ${f(STEM_STOCK_R_U)} and §233's turning target asks 1.3112, so read those two rows first.`);

console.log('\n--- WHAT THE MOVEMENT SAID AT EACH RADIUS');
for (const x of rows) {
  console.log(`\n  ${x.label}${x.ok ? '' : '  — DID NOT BOOT'}:`);
  if (!x.warns.length) { console.log('      (silent)'); continue; }
  for (const w of x.warns.slice(0, 8)) console.log('      · ' + w.slice(0, 240));
  if (x.warns.length > 8) console.log(`      … and ${x.warns.length - 8} more`);
}

console.log('\n(REPORT — nothing here passes or fails; read the numbers and the warnings.)\n');
await browser.close(); srv.kill();
