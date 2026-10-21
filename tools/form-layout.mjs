#!/usr/bin/env node
// §307 — THE FORM LAYOUT OPTIMISER: which arrangement of the going train and
// the stem makes the movement's RECTANGLE smallest?
//
//   node tools/form-layout.mjs --dump FILE          boot the page headless and write the
//                                                    solver inputs it MEASURED (LAYOUT_INPUTS,
//                                                    KEYLESS_INPUTS, read off window.__clock)
//   node tools/form-layout.mjs --inputs FILE [--objective area|width] [--crown side|any]
//                                           [--samples N] [--seed S]
//
// A REPORT (it prints and exits 0; the judgement is the reader's — the index
// files it as acceptance only because a bad argument exits 2). The
// rectangle is layout.js's own law — `solveKeyless` returns `formPlate` beside
// plateR, the tightest axis-aligned rectangle round every station's outline
// and the keyless floors under the plate's rim margin — so this tool never
// restates how a plate is bounded: it runs `solveLayout` → `solveKeyless` on
// the inputs main.js measured at boot (the swept radii are read off the built
// meshes, which is why they are dumped from the page rather than typed) with
// candidate values of the §33 knobs, and keeps the arrangement whose rectangle
// has the least AREA (or, `--objective width`, the least short side and then
// the least area) with the band under the owner's 40 mm width cap.
//
// FEASIBILITY IS THE SOLVERS' OWN WARNING LIST. §33's solvers warn rather than
// refuse — a d4 outside the two-bar's closure window keeps the designed D4, a
// stem that cannot reach the barrel has no winding path — so any warning but
// one is an infeasible candidate. The one kept: the balance step's "edge" walk
// is the solver DOING its job (the target is only a target; the solved angle
// is what the metal gets), and is reported, not refused.
//
// The search is a random sample of the knob space followed by coordinate
// descent with halving steps from the best few — there is no gradient to
// trust through the balance's obstacle solve, whose feasible set has edges.
// Two runs with the same --seed agree exactly.
//
// WHAT IS NOT IN THE OBJECTIVE, named: the alarm module, the reserve train and
// the keyless cluster's own parts stand at stations main.js seeds, not in the
// position table `P`, so a re-solved train can foul them and only a trial boot
// (`?case=rect&…` — the URL this prints) and the battery can say. The
// prototype's record (BUILT §307) lists this as landing 2's work.
import { readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const DUMP = opt('--dump', null);
const SERVE_ROOT = opt('--root', ROOT);   // a copied tree to boot instead of the checkout (iteration aid)
const QUERY = opt('--query', '');          // extra URL params for the dump boot, e.g. 'case=rect&barrelstep=15' — the trial boot of a candidate
const SHOT = opt('--shot', null);           // write a screenshot of the booted page (dial side) beside the dump
const INPUTS = opt('--inputs', null);
const OBJECTIVE = opt('--objective', 'area');
const CROWN = opt('--crown', 'side');
const SAMPLES = Number(opt('--samples', 6000));
const SEED = Number(opt('--seed', 307));
if (!['area', 'width'].includes(OBJECTIVE)) { console.error('--objective is area or width'); process.exit(2); }
if (!['side', 'any'].includes(CROWN)) { console.error('--crown is side or any'); process.exit(2); }

if (DUMP) {
  // Boot the page once and read what it measured. `?trial=1` is the state
  // guard (state.js): a throwaway boot neither reads nor writes the session.
  const { chromium } = await import('playwright');
  const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
  const srv = createServer(async (req, res) => {
    try {
      const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
      const body = await readFile(join(SERVE_ROOT, path === '/' ? 'index.html' : path));
      res.writeHead(200, { 'content-type': MIME[extname(path)] ?? 'application/octet-stream', 'cache-control': 'no-store' }).end(body);
    } catch { res.writeHead(404).end('not found'); }
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${srv.address().port}/index.html?trial=1${QUERY ? '&' + QUERY : ''}`;
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
    '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const warnings = [];
  page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') warnings.push(`${m.type()}: ${m.text()}`); });
  await page.goto(base);
  await page.waitForFunction(() => !!window.__clock || !!window.__bootError, null, { timeout: 240000 });
  const out = await page.evaluate(() => window.__bootError ? { bootError: String(window.__bootError.message) } : ({
    layoutInputs: window.__clock.layoutInputs, keylessInputs: window.__clock.keylessInputs,
    formPlate: window.__clock.formPlate, plateR: window.__clock.plateR, P: window.__clock.P,
  }));
  if (SHOT && !out.bootError) {
    // The dial-side preset, a few frames to settle the camera tween (~0.9 s), then the picture.
    await page.evaluate(() => { const b = document.querySelector('[data-cam="Dial"]'); if (b) b.click(); });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: SHOT });
  }
  await browser.close(); srv.close();
  if (out.bootError) { console.error(`boot failed: ${out.bootError}`); process.exit(1); }
  // KEYLESS_INPUTS carries functions? No — positions, radii and the print frame; P too.
  writeFileSync(DUMP, JSON.stringify({ ...out, warnings }, null, 1));
  console.log(`wrote ${DUMP}: plateR ${out.plateR.toFixed(3)}, formPlate ${(2 * out.formPlate.hw).toFixed(2)} × ${(2 * out.formPlate.hh).toFixed(2)} u, ${warnings.length} console warning(s) at boot`);
  process.exit(0);
}

if (!INPUTS) { console.error('need --dump FILE or --inputs FILE'); process.exit(2); }
const L = await import(join(ROOT, 'src/layout.js'));
const inputs = JSON.parse(readFileSync(INPUTS, 'utf8'));
const { layoutInputs, keylessInputs } = inputs;
const RAD = Math.PI / 180;
const BAL_WALK = /^balance step: the closed-form edge/;

// One candidate: the two solves, the warnings collected, the rectangle read.
function evaluate(k) {
  const warns = [];
  const warn = (m) => warns.push(m);
  const { P, BALANCE_STEP_DEG } = L.solveLayout({
    ...layoutInputs, barrelStepDeg: k.barrelStep, escapeStepDeg: k.escStep, balanceStepTargetDeg: k.balStep, d4: k.d4, warn,
  });
  const K = L.solveKeyless({ ...keylessInputs, P, stemAzRad: k.stemAz * RAD, warn });
  const f = K.formPlate;
  const hard = warns.filter((w) => !BAL_WALK.test(w));
  const wOut = 2 * (f.hw + L.CASE_CLEAR + L.CASE_BAND_T);
  // A form case's long side is 12–6, the strap's line: under `area` a candidate
  // wider than it is long is refused (it is the same rectangle turned, and the
  // turn is not a knob — the dial's 12 is the movement's +y). `width` needs no
  // such clause: the narrowest rectangle is portrait by construction.
  const portrait = OBJECTIVE !== 'area' || f.hh >= f.hw;
  const feasible = hard.length === 0 && portrait && wOut <= 2 * L.CASE_WIDTH_MAX + 1e-9;
  const score = OBJECTIVE === 'area' ? f.area : f.hw * 1e6 + f.area;
  return { k: { ...k, balSolved: BALANCE_STEP_DEG }, f, plateR: K.plateR, warns, hard, feasible, score, wOut };
}

// Knob windows: the step angles over the full turn (index.html clamps them to
// [−180, 180]); d4 inside the two-bar's closure window (layout.js's own law);
// the stem within the winding idler's reach of the barrel is the solver's to
// refuse, so the azimuth ranges the whole turn or, `--crown side`, within 30°
// of the 3 and 9 o'clock lines (a wristwatch crown sits on a long side).
const w4 = L.d4Window(layoutInputs.radii);
const WIN = {
  barrelStep: [-180, 180], escStep: [-180, 180], balStep: [-180, 180],
  d4: [w4.min + 0.05 * (w4.max - w4.min), w4.max - 0.05 * (w4.max - w4.min)],
  stemAz: [0, 360],
};
const stemOk = (az) => {
  if (CROWN === 'any') return true;
  const a = ((az % 360) + 360) % 360;
  const d = Math.min(Math.abs(a - 0), Math.abs(a - 360), Math.abs(a - 180));
  return d <= 30;
};
let seed = SEED;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const sample = () => {
  const k = {};
  for (const n in WIN) k[n] = WIN[n][0] + rnd() * (WIN[n][1] - WIN[n][0]);
  if (!stemOk(k.stemAz)) k.stemAz = (rnd() < 0.5 ? 0 : 180) + (rnd() * 60 - 30);
  return k;
};

// The default build's own rectangle, from the page's dump (the knobs absent
// means the solvers' own constants): the baseline every candidate is read against.
const base = (() => {
  const warns = [];
  const { P, BALANCE_STEP_DEG } = L.solveLayout({ ...layoutInputs, warn: (m) => warns.push(m) });
  const K = L.solveKeyless({ ...keylessInputs, P, warn: (m) => warns.push(m) });
  return { f: K.formPlate, plateR: K.plateR, balSolved: BALANCE_STEP_DEG, stemAz: K.stemAngle / RAD, warns };
})();

let best = [];
const consider = (r) => { if (!r.feasible) return; best.push(r); best.sort((a, b) => a.score - b.score); if (best.length > 8) best.length = 8; };
let tried = 0, feasibleN = 0;
for (let i = 0; i < SAMPLES; i++) { const r = evaluate(sample()); tried++; if (r.feasible) feasibleN++; consider(r); }
// Coordinate descent from the best few, halving steps.
const STEP0 = { barrelStep: 20, escStep: 20, balStep: 20, d4: (WIN.d4[1] - WIN.d4[0]) / 8, stemAz: 20 };
const seeds = best.slice(0, 4);
for (const s of seeds) {
  let cur = s;
  const step = { ...STEP0 };
  for (let round = 0; round < 10; round++) {
    let moved = false;
    for (const n in step) {
      for (const sgn of [-1, 1]) {
        const k = { ...cur.k };
        delete k.balSolved;
        k[n] = Math.min(WIN[n][1], Math.max(WIN[n][0], k[n] + sgn * step[n]));
        if (n === 'stemAz' && !stemOk(k.stemAz)) continue;
        const r = evaluate(k); tried++;
        if (r.feasible && r.score < cur.score - 1e-9) { cur = r; moved = true; }
      }
    }
    if (!moved) for (const n in step) step[n] /= 2;
    consider(cur);
  }
}
best.sort((a, b) => a.score - b.score);

const mm = (u) => (u * L.UNIT_MM).toFixed(2);
const rect = (f) => `${mm(2 * f.hw)} × ${mm(2 * f.hh)} mm (${(f.area * L.UNIT_MM * L.UNIT_MM).toFixed(0)} mm²), centre (${mm(f.cx)}, ${mm(f.cy)}) off the hands`;
console.log(`form-layout: objective ${OBJECTIVE}, crown ${CROWN}, ${tried} candidates evaluated, ${feasibleN} of ${SAMPLES} random samples feasible, seed ${SEED}`);
console.log(`  d4 window [${w4.min.toFixed(2)}, ${w4.max.toFixed(2)}]; width cap ${mm(2 * L.CASE_WIDTH_MAX)} mm across the band (plate rectangle + 2 × (${mm(L.CASE_CLEAR)} + ${mm(L.CASE_BAND_T)}))`);
console.log(`DEFAULT (as designed): plateR ${base.plateR.toFixed(3)} u → round plate Ø ${mm(2 * base.plateR)} mm; its rectangle ${rect(base.f)}`);
console.log(`  knobs: barrelstep ${L.BARREL_STEP_DEG}, escstep ${L.ESCAPE_STEP_DEG}, balstep target ${L.BALANCE_STEP_TARGET_DEG} (solved ${base.balSolved.toFixed(3)}), d4 ${L.D4}, stemaz ${base.stemAz.toFixed(2)}°${base.warns.length ? `; warnings: ${base.warns.join(' | ')}` : ''}`);
if (!best.length) { console.log('NO FEASIBLE CANDIDATE FOUND — every sample drew a solver warning or broke the width cap'); process.exit(0); }
const b = best[0];
const url = (k) => `index.html?case=rect&barrelstep=${k.barrelStep.toFixed(2)}&escstep=${k.escStep.toFixed(2)}&balstep=${k.balStep.toFixed(2)}&d4=${k.d4.toFixed(2)}&stemaz=${(((k.stemAz % 360) + 360) % 360).toFixed(2)}`;
console.log(`BEST: rectangle ${rect(b.f)} — ${((1 - b.f.area / base.f.area) * 100).toFixed(1)}% less area than the default's rectangle; band ${mm(b.wOut)} mm across; plateR would be ${b.plateR.toFixed(3)} u`);
console.log(`  knobs: barrelstep ${b.k.barrelStep.toFixed(2)}, escstep ${b.k.escStep.toFixed(2)}, balstep target ${b.k.balStep.toFixed(2)} (solved ${b.k.balSolved.toFixed(3)}), d4 ${b.k.d4.toFixed(3)}, stemaz ${b.k.stemAz.toFixed(2)}°`);
if (b.warns.length) console.log(`  solver notes: ${b.warns.join(' | ')}`);
console.log(`  URL: ${url(b.k)}`);
console.log('RUNNERS-UP:');
for (const r of best.slice(1, 5)) console.log(`  ${rect(r.f)} — barrelstep ${r.k.barrelStep.toFixed(1)}, escstep ${r.k.escStep.toFixed(1)}, balstep ${r.k.balStep.toFixed(1)}, d4 ${r.k.d4.toFixed(2)}, stemaz ${r.k.stemAz.toFixed(1)}`);
