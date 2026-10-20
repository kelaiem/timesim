// §293 — IS EACH SUB-DIAL LINE OF TYPE SET IN THE LIGHTEST WEIGHT THE EYE CAN
// STILL RESOLVE AT THE WRIST? Acceptance.
//
// paintSubdialFace picks each line's font weight by MEASURING the browser's
// own font: the thinnest stroke of a '1' and an '0' at each weight, as a
// fraction of the em (strokeEmOf), against RESOLVE_ARCMIN at WRIST_MM. This
// boots the real page, imports the same geometry.js, and re-derives the choice
// for the three lines that take it: the reserve's figures, the seconds'
// figures and the seconds' caption.
//
//   1. the chosen weight's stroke is at least the 1′ floor;
//   2. CONTROL must-miss: the next lighter weight the font draws THINNER is
//      under the floor (so the choice is the lightest, not merely a passing
//      one), or no lighter weight draws thinner (the font has nothing lighter);
//   3. CONTROL must-hit: the measurement moves with weight: 700 draws a thicker
//      stroke than 300 for each family, or the font has one weight only and
//      the probe says so instead of passing on a flat table;
//   and the page boots silent.
//
// It prints the measured table, which is a fact about THIS browser's fonts:
// a Mac with Helvetica Neue and a Linux box with Arial answer differently, and
// that is the point of measuring.
//
// Run from tools/: node probe-293-weights.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8612);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
process.on('exit', () => { try { srv.kill(); } catch {} });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
const warns = [];
page.on('console', (m) => { if (m.type() === 'warning' && !m.text().includes('GL Driver')) warns.push(m.text()); });
await page.goto(`http://127.0.0.1:${PORT}/index.html?fresh=1`);
await page.waitForFunction(() => window.__clock && window.__clock.boot && window.__clock.boot.done !== false, null, { timeout: 240000, polling: 500 });

const r = await page.evaluate(async () => {
  const G = await import('./src/geometry.js');
  const L = await import('./src/layout.js');
  const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';
  const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';
  const table = {};
  for (const [name, fam] of [['sans', SANS], ['mono', MONO]])
    table[name] = G.SUBDIAL_WEIGHTS.map((w) => [w, G.strokeEmOf(fam, w)]);
  return { table, wrist: L.WRIST_MM, resolveMm: L.mmForArcmin(L.RESOLVE_ARCMIN),
    glanceMm: L.mmForArcmin(L.GLANCE_ARCMIN), identifyMm: L.mmForArcmin(L.IDENTIFY_ARCMIN), cap: L.CAP_PER_EM };
});

const fails = [];
const say = (ok, name, got) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${got}`); if (!ok) fails.push(name); };
console.log(`measured thinnest stroke per weight (fraction of the em), WRIST_MM ${r.wrist}:`);
for (const [fam, rows] of Object.entries(r.table))
  console.log(`  ${fam}: ${rows.map(([w, e]) => `${w} ${e === null ? '—' : e.toFixed(4)}`).join('   ')}`);

// The three lines, at the shipped scale: each line's em in mm is its target cap
// over the cap ratio (the default wells hold every target whole, §293), so the
// em does not depend on which well it is in, only on its acuity target and,
// for the caption, the measured stroke that raises it.
const lines = [
  ['reserve figures', 'sans', r.glanceMm / r.cap],
  ['seconds figures', 'sans', r.glanceMm / r.cap],
  // the caption's em is its identify target, raised to where its heaviest weight resolves
  ['seconds caption', 'mono', Math.max(r.identifyMm / r.cap, r.resolveMm / r.table.mono[r.table.mono.length - 1][1])],
];
const arc = (mm) => (mm / r.wrist) * 60 * 180 / Math.PI;
for (const [what, fam, emMm] of lines) {
  const rows = r.table[fam].filter(([, e]) => e !== null);
  const pick = rows.find(([, e]) => e * emMm >= r.resolveMm) || rows[rows.length - 1];
  const [w, e] = pick;
  say(e * emMm >= r.resolveMm, `1. ${what}: weight ${w} strokes at least 1′`, `${(e * emMm).toFixed(4)} mm = ${arc(e * emMm).toFixed(2)}′`);
  const lighter = rows.filter(([lw, le]) => lw < w && le < e).pop();
  say(!lighter || lighter[1] * emMm < r.resolveMm, `2. ${what}: the next lighter weight is under the floor`,
    lighter ? `weight ${lighter[0]} ${arc(lighter[1] * emMm).toFixed(2)}′` : 'no lighter weight draws thinner on this font');
}
for (const [fam, rows] of Object.entries(r.table)) {
  const e300 = rows[0][1], e700 = rows[rows.length - 1][1];
  const flat = e300 !== null && e700 !== null && Math.abs(e700 - e300) < 1e-9;
  if (flat) console.log(`note  ${fam}: one weight only on this machine — the choice is the shipped weight's metal whatever is asked`);
  say(e300 !== null && e700 !== null && (e700 > e300 || flat), `3. ${fam}: the measurement moves with weight (or the font is single-weight)`,
    `300 ${e300?.toFixed(4)} → 700 ${e700?.toFixed(4)}`);
}
say(warns.length === 0, 'boot silent', warns.length ? warns.join(' | ').slice(0, 300) : '0 warnings');
console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASS');
await browser.close(); srv.kill();
process.exit(fails.length ? 1 : 0);
