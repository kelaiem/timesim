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
//
//   node tools/form-layout.mjs --search [--budget N] [--parallel P] [--log FILE] [--rounds R]
//
// --search MEASURES what the solvers cannot: it boots the page itself, once per
// candidate, under `?case=rect&<knobs>`, and reads `formFootprint.rect` — the
// rectangle round every part the build placed (main.js FORM_FOOTPRINT: the
// gong and anything already through the round bore excepted, the rim margin
// added). Its objective is that rectangle's AREA, and a candidate's rectangle
// does not depend on the outline it was cut to, so one boot judges it and its
// `formrect=` is that rectangle. The knobs are index.html's SPEC_FIELDS rows
// that MOVE a station (the train's three steps and d4, the stem and the
// crown's azimuths, the reserve's radius, the alarm corner's azimuth and
// radius, the alarm module and its three bearings), each started at the value
// the build uses when the key is absent (read off the boot or off the named
// constant) — dialr, subdialr, studr and the route keys stay out. FEASIBILITY
// is the build's own warning list: a candidate is accepted only when every
// warning it prints, digits stripped, is one the designed form build
// (`?case=rect`) prints too; a boot error is infeasible. The search is
// coordinate descent from the design, ±step per knob, P boots at a time in one
// browser, the best improving move of each batch taken, every step halved
// after a round with none. Every boot is a line in `--log` (JSONL), and a
// candidate already there is read back, not re-booted, so a long run resumes.
// LIMITS, named: it is a LOCAL search (the starting basin, a few rounds); the
// judge is the build's warnings, so a collision the build does not warn on is
// invisible to it and a part pushed out through the round bore drops out of
// the footprint rather than counting against it — the BATTERY is the judge of
// record, and a winner here is a candidate for it, not a result.
//
//   node tools/form-layout.mjs --floorplan [--kinds rect,cushion,tonneau] [--top N] [--moves FILE]
//
// §308 landing 3 — THE FLOORPLANNER'S HARNESS (src/form-floorplan.js is the
// planner, pure). It boots the designed form build of each kind and reads its
// REGION MODEL (__clock.regions: the action groups' hulls, strata, anchors);
// MEASURES each candidate knob as a move by booting it one step off design and
// fitting every unit's hull (a knob is modelled only where it is measured to
// carry its units rigidly); plans the least-area fitted outline under the
// planner's clearance and anchor laws; and VERIFIES the best plans by boot,
// accepting one only if it prints no warning shape the designed build does not.
// `--dump` also prints the region model and which group sets each side.
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
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
const NEAR = opt('--near', null) === null ? null : Number(opt('--near', null)); // search within ±NEAR° of the designed angles (and ±NEAR/10 u of D4)
const BOOT = Number(opt('--boot', 0));
// --verify N: landing 2's judge. The best N solver candidates are each booted
// under ?case=rect at every alarm-module azimuth in --alarmmods (absolute world
// degrees, ?alarmmod=; empty = as designed, 40°) — the module is seeded at a
// world station the train never sees, so turning it is the one knob that moves
// it out of a re-solved train's way. Each boot is ranked by the movement's
// TRUE footprint (every built part, not the solvers' members) and kept only if
// it prints no warning the designed arrangement's form build does not (digits
// stripped: the same assert at a different number is the same finding).
const VERIFY = Number(opt('--verify', 0));
const ALARMMODS = String(opt('--alarmmods', ',100,160,220,280,340')).split(',').map((x) => x.trim());      // trial-boot the best N candidates and count their boot warnings — the build's own asserts are the judge the solvers are not
if (!['area', 'width'].includes(OBJECTIVE)) { console.error('--objective is area or width'); process.exit(2); }
if (!['side', 'any'].includes(CROWN)) { console.error('--crown is side or any'); process.exit(2); }

// Boot the page once, headless, and read what it measured. `?trial=1` is the
// state guard (state.js): a throwaway boot neither reads nor writes the session.
// Returns the solver inputs, the rectangle, and every console warning/error the
// build printed — rule 6 makes that list the build's own verdict on a candidate.
async function bootOnce(query, shot = null) {
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
  const base = `http://127.0.0.1:${srv.address().port}/index.html?trial=1${query ? '&' + query : ''}`;
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
    '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const warnings = [];
  const NOISE = /GPU stall|GL Driver Message|swiftshader|ReadPixels|Automatic fallback to software WebGL/i;
  page.on('console', (m) => { if ((m.type() === 'warning' || m.type() === 'error') && !NOISE.test(m.text())) warnings.push(`${m.type()}: ${m.text()}`); });
  await page.goto(base);
  await page.waitForFunction(() => !!window.__clock || !!window.__bootError, null, { timeout: 240000 });
  const out = await page.evaluate(() => window.__bootError ? { bootError: String(window.__bootError.message) } : ({
    layoutInputs: window.__clock.layoutInputs, keylessInputs: window.__clock.keylessInputs,
    formPlate: window.__clock.formPlate, plateR: window.__clock.plateR, P: window.__clock.P,
    formFootprint: window.__clock.formFootprint, form: window.__clock.form, regions: window.__clock.regions,
    // §307 landing 2 — THE MOVEMENT'S TRUE FOOTPRINT, measured off the built
    // metal: the world-XY box of every mesh under the movement group, the case
    // and every schematic object excluded. The solvers' rectangle sees only the
    // train and the keyless floors; this sees the alarm module, the reserve
    // train, the keyless cluster and everything else the build placed, which is
    // what landing 1 measured the solvers cannot.
    footprint: (() => {
      let mv = null;
      window.__clock.scene.traverse((o) => { if (!mv && o.name === 'case' && o.parent) mv = o.parent; });
      if (!mv) return null;
      mv.updateWorldMatrix(true, true);
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, n = 0;
      const v = mv.position.clone();
      const skip = (o) => { for (let a = o; a && a !== mv; a = a.parent) if (/^case/.test(a.name) || (a.userData && a.userData.schematic)) return true; return false; };
      mv.traverse((o) => {
        if (!o.isMesh || !o.geometry || !o.geometry.attributes.position || skip(o)) return;
        const pa = o.geometry.attributes.position;
        for (let i = 0; i < pa.count; i++) {
          v.fromBufferAttribute(pa, i).applyMatrix4(o.matrixWorld);
          if (v.x < x0) x0 = v.x; if (v.x > x1) x1 = v.x; if (v.y < y0) y0 = v.y; if (v.y > y1) y1 = v.y;
        }
        n++;
      });
      return { xMin: x0, xMax: x1, yMin: y0, yMax: y1, hw: (x1 - x0) / 2, hh: (y1 - y0) / 2, area: (x1 - x0) * (y1 - y0), meshes: n };
    })(),
    // §307 landing 2 — WHICH UNITS STAND OUTSIDE THE SOLVERS' RECTANGLE, and by
    // how much: each registered unit's worst excursion past formPlate, so the
    // members the rectangle's law is missing are named rather than guessed.
    outside: (() => {
      const f = window.__clock.formPlate; let mv = null;
      window.__clock.scene.traverse((o) => { if (!mv && o.name === 'case' && o.parent) mv = o.parent; });
      if (!f || !mv) return null;
      const unit = new Map();
      for (const e of window.__clock.labelEntries || []) if (e.obj && e.obj.traverse) e.obj.traverse((o) => { if (!unit.has(o)) unit.set(o, e.name); });
      const skip = (o) => { for (let a = o; a && a !== mv; a = a.parent) if (/^case/.test(a.name) || (a.userData && a.userData.schematic)) return true; return false; };
      const agg = {}; const v = mv.position.clone();
      mv.traverse((o) => {
        if (!o.isMesh || !o.geometry || !o.geometry.attributes.position || skip(o)) return;
        const pa = o.geometry.attributes.position; let by = -Infinity;
        for (let i = 0; i < pa.count; i++) { v.fromBufferAttribute(pa, i).applyMatrix4(o.matrixWorld); by = Math.max(by, f.xMin - v.x, v.x - f.xMax, f.yMin - v.y, v.y - f.yMax); }
        const n = unit.get(o) || '(unlabelled)';
        if (by > 0) agg[n] = Math.max(agg[n] || 0, by);
      });
      return Object.entries(agg).sort((a, b) => b[1] - a[1]);
    })(),
  }));
  if (shot && !out.bootError) {
    // The dial-side preset, a few frames to settle the camera tween (~0.9 s), then the picture.
    await page.evaluate(() => { const b = document.querySelector('[data-cam="Dial"]'); if (b) b.click(); });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: shot });
  }
  await browser.close(); srv.close();
  return { ...out, warnings };
}

// One server and one browser for a whole run; a fresh CONTEXT per boot, so no
// state (the §79 worker, storage) crosses from one candidate to the next.
// `read` is evaluated in the page once the build is up (a function, passed to
// page.evaluate); a boot error or a harness failure comes back as `bootError`.
async function openBooter(read) {
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
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
    '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'] });
  const NOISE = /GPU stall|GL Driver Message|swiftshader|ReadPixels|Automatic fallback to software WebGL/i;
  async function boot(query) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const warnings = [];
    page.on('console', (m) => { if ((m.type() === 'warning' || m.type() === 'error') && !NOISE.test(m.text())) warnings.push(`${m.type()}: ${m.text()}`); });
    page.on('pageerror', (e) => warnings.push(`pageerror: ${e.message}`));
    const t0 = Date.now();
    try {
      await page.goto(`http://127.0.0.1:${srv.address().port}/index.html?trial=1&${query}`);
      await page.waitForFunction(() => !!window.__clock || !!window.__bootError, null, { timeout: 900000 });
      const out = await page.evaluate((src) => window.__bootError ? { bootError: String(window.__bootError.message) } : (0, eval)(src)(), `(${read})`);
      return { ...out, warnings, ms: Date.now() - t0 };
    } catch (e) { return { bootError: `harness: ${e.message.split('\n')[0]}`, warnings, ms: Date.now() - t0 }; }
    finally { await ctx.close().catch(() => {}); }
  }
  return { boot, close: async () => { await browser.close(); srv.close(); } };
}

if (DUMP) {
  const out = await bootOnce(QUERY, SHOT);
  if (out.bootError) { console.error(`boot failed: ${out.bootError}`); process.exit(1); }
  // KEYLESS_INPUTS carries functions? No — positions, radii and the print frame; P too.
  writeFileSync(DUMP, JSON.stringify(out, null, 1));
  if (out.formFootprint) {
    const { UNIT_MM } = await import(join(ROOT, 'src/layout.js'));
    const mm = (u) => (u * UNIT_MM).toFixed(2);
    const r = out.formFootprint.rect;
    console.log(`measured form rectangle (whole movement inside the round bore, gong excepted, + rim margin): `
      + `${mm(r[1] - r[0])} × ${mm(r[3] - r[2])} mm; the cut ${out.formFootprint.holds ? 'HOLDS it' : 'does NOT hold it'}`);
    console.log(`  URL: index.html?${QUERY ? QUERY.replace(/&?formrect=[^&]*/, '') + '&' : ''}formrect=${r.map((q) => q.toFixed(2)).join(',')}`);
  }
  if (out.regions) {
    // §308 landing 2 — the region model: each action group's box and stratum,
    // and which group sets each side of the metal box the fit read.
    const R = out.regions;
    console.log(`action groups (§308 region model, ${Object.keys(R.groups).length} incl. frame/unassigned):`);
    for (const [gid, g] of Object.entries(R.groups))
      console.log(`  ${gid.padEnd(12)} x [${g.box[0].toFixed(2)}, ${g.box[1].toFixed(2)}] y [${g.box[2].toFixed(2)}, ${g.box[3].toFixed(2)}] z [${g.z[0].toFixed(2)}, ${g.z[1].toFixed(2)}]  ${g.units.length} unit(s), hull ${g.hull.length} pts`
        + (g.anchors.length ? `; anchors: ${g.anchors.map((a) => `${a.name} (${a.at} → ${a.pin})`).join('; ')}` : ''));
    console.log('  the outline\'s sides are set by: ' + Object.entries(R.edges).map(([k, e]) => `${k} ${e.group} / ${e.unit} (${e.at.toFixed(2)})`).join(', ')
      + `; nearest the fitted cut: ${R.binding.group} / ${R.binding.unit} (${R.binding.inset.toFixed(3)} u inside)`);
    if (R.uncounted.length) console.log(`  declared units with no counted metal: ${R.uncounted.join(', ')}`);
  }
  if (out.outside) {
    console.log(`units standing outside the solvers' rectangle (u past its edge, worst mesh; ${out.outside.length} units):`);
    for (const [n, by] of out.outside) console.log(`  ${by.toFixed(2).padStart(7)}  ${n}`);
  }
  console.log(`wrote ${DUMP}: plateR ${out.plateR.toFixed(3)}, formPlate ${(2 * out.formPlate.hw).toFixed(2)} × ${(2 * out.formPlate.hh).toFixed(2)} u, ${out.warnings.length} console warning(s) at boot`);
  process.exit(0);
}

if (argv.includes('--search')) {
  const L0 = await import(join(ROOT, 'src/layout.js'));
  const BUDGET = Number(opt('--budget', 120));
  const PAR = Math.max(1, Number(opt('--parallel', 3)));
  const ROUNDS = Number(opt('--rounds', 6));
  const LOG = opt('--log', null);
  // The §307 warnings are about the OUTLINE, not the arrangement: a candidate
  // boots with the solvers' rectangle (its own measured one does not exist
  // until this boot reads it), so which openings fall outside, and that the
  // footprint outgrows the cut, say nothing about whether the arrangement is
  // sound. They are judged by the second boot at the candidate's formrect, not
  // here; every other warning is the build's verdict and keeps its text.
  const norm = (w) => (/^warning: §307:/.test(w) ? '§307 outline' : w.replace(/-?\d+(\.\d+)?(e-?\d+)?/g, '#'));
  const UMM = L0.UNIT_MM;
  const areaMm = (r) => (r[1] - r[0]) * (r[3] - r[2]) * UMM * UMM;
  const dims = (r) => `${((r[1] - r[0]) * UMM).toFixed(2)} × ${((r[3] - r[2]) * UMM).toFixed(2)} mm`;

  const { boot, close: closeBooter } = await openBooter(() => ({ ff: window.__clock.formFootprint, P: window.__clock.P }));
  const browser = { close: closeBooter }, srv = { close() {} };

  // The log is the run's memory: each line one boot, keyed by its query.
  const seen = new Map();
  if (LOG && existsSync(LOG)) for (const ln of readFileSync(LOG, 'utf8').split('\n')) { if (!ln.trim()) continue; try { const j = JSON.parse(ln); seen.set(j.query, j); } catch {} }
  const record = (j) => { seen.set(j.query, j); if (LOG) appendFileSync(LOG, JSON.stringify(j) + '\n'); };
  let boots = 0;

  // THE BASELINE: the designed arrangement's form build. Its warnings are the
  // allowed set, its rectangle the reference, its P the designed stations.
  const BASE_Q = 'case=rect';
  let baseRow = seen.get(BASE_Q);
  if (!baseRow || !baseRow.P) {
    const b = await boot(BASE_Q); boots++;
    if (b.bootError || !b.ff) { console.log(`SEARCH: the designed form build did not boot: ${b.bootError ?? 'no formFootprint'}`); await browser.close(); srv.close(); process.exit(1); }
    baseRow = { query: BASE_Q, knobs: {}, rect: b.ff.rect, area: areaMm(b.ff.rect), accepted: true, baseline: true, warnings: b.warnings.map(norm), P: b.P, ms: b.ms, at: new Date().toISOString() };
    record(baseRow);
  }
  const allowed = new Set(baseRow.warnings);
  console.log(`SEARCH baseline (case=rect, as designed): ${dims(baseRow.rect)} = ${baseRow.area.toFixed(1)} mm²; ${allowed.size} distinct warning shape(s) allowed`);

  // THE KNOBS and where each STARTS — the value the build takes when the key is
  // absent. Read off the boot where the page exposes it (the stem and crown
  // azimuths are the barrel's, §13; the alarm corner is the one of world 0°/180°
  // farther from the stem, main.js ALARM_LOCAL_AZ's solve), else the constant
  // the build falls back to: layout.js's steps, D4, RESERVE_STATION_R and
  // ALARM_CORNER_R; main.js's module seed ALARM_SW_AZ 40° and its three
  // bearings 202° / 92° / 148°. Steps: 15° for an angle, 1 u (0.38 mm) for a radius.
  const Pb = baseRow.P;
  const phi = Math.atan2(Pb.barrel.y, Pb.barrel.x) * 180 / Math.PI;
  const angd = (a, b) => Math.abs((((a - b + 180) % 360) + 360) % 360 - 180);
  const alarmAz0 = angd(180, phi) >= angd(0, phi) ? 180 : 0;
  const KNOBS = [
    ['barrelstep', L0.BARREL_STEP_DEG, 15], ['escstep', L0.ESCAPE_STEP_DEG, 15], ['balstep', L0.BALANCE_STEP_TARGET_DEG, 15],
    ['d4', L0.D4, 1], ['stemaz', phi, 15], ['crownaz', phi, 15], ['rsvr', L0.RESERVE_STATION_R, 1],
    ['alarmaz', alarmAz0, 15], ['alarmr', L0.ALARM_CORNER_R, 1], ['alarmmod', 40, 15],
    ['alarmbarrelaz', 202, 15], ['alarmgovaz', 92, 15], ['alarmanchoraz', 148, 15],
  ];
  const START = Object.fromEntries(KNOBS.map(([k, v]) => [k, v]));
  const step = Object.fromEntries(KNOBS.map(([k, , s]) => [k, s]));
  const MIN_STEP = Object.fromEntries(KNOBS.map(([k, , s]) => [k, s / 8]));
  console.log('  knobs (start, step): ' + KNOBS.map(([k, v, s]) => `${k} ${v.toFixed(2)} ±${s}`).join(', '));
  // A candidate's query names only the knobs it MOVED (absence is the design),
  // in roster order, two decimals — the key the log is read by.
  const queryOf = (kn) => [BASE_Q, ...KNOBS.filter(([k]) => k in kn).map(([k]) => `${k}=${kn[k].toFixed(2)}`)].join('&');

  async function judge(kn) {
    const query = queryOf(kn);
    if (seen.has(query)) return seen.get(query);
    if (boots >= BUDGET) return null;
    const n = ++boots;
    const b = await boot(query);
    let row;
    if (b.bootError || !b.ff) row = { query, knobs: kn, accepted: false, reason: `boot error: ${b.bootError ?? 'no formFootprint'}` };
    else {
      const extra = b.warnings.filter((w) => !allowed.has(norm(w)));
      row = { query, knobs: kn, rect: b.ff.rect, area: areaMm(b.ff.rect), accepted: extra.length === 0, newWarnings: extra.length, reason: extra[0]?.slice(0, 200) ?? null };
    }
    row.ms = b.ms; row.at = new Date().toISOString();
    record(row);
    console.log(`  [${String(n).padStart(3)}/${BUDGET}] ${query.slice(BASE_Q.length + 1) || '(designed)'} → `
      + `${row.area !== undefined ? `${row.area.toFixed(1)} mm² ${dims(row.rect)}` : '—'} ${row.accepted ? 'ACCEPTED' : `REJECTED: ${row.reason}`} (${(b.ms / 1000).toFixed(0)} s)`);
    return row;
  }
  // A small pool: P boots in flight, results in input order.
  async function judgeAll(list) {
    const out = new Array(list.length); let i = 0;
    await Promise.all(Array.from({ length: Math.min(PAR, list.length) }, async () => { while (i < list.length) { const j = i++; out[j] = await judge(list[j]); } }));
    return out;
  }

  let cur = baseRow, curKn = {};
  const val = (kn, k) => (k in kn ? kn[k] : START[k]);
  for (let round = 0; round < ROUNDS && boots < BUDGET; round++) {
    let moved = false;
    // The moves of this round, regenerated from the CURRENT point after each
    // accepted batch, so the knobs not yet tried step from where the search is.
    let order = KNOBS.map(([k]) => k).filter((k) => step[k] >= MIN_STEP[k]);
    if (!order.length) break;
    while (order.length && boots < BUDGET) {
      const batch = [];
      while (order.length && batch.length < PAR) {
        const k = order.shift();
        for (const sgn of [-1, 1]) batch.push({ ...curKn, [k]: val(curKn, k) + sgn * step[k] });
      }
      const rows = await judgeAll(batch);
      let best = null;
      rows.forEach((r, j) => { if (r && r.accepted && r.area < cur.area - 1e-6 && (!best || r.area < best.r.area)) best = { r, kn: batch[j] }; });
      if (best) { cur = best.r; curKn = best.kn; moved = true; console.log(`  → MOVE: ${cur.area.toFixed(1)} mm² at ${queryOf(curKn)}`); }
      if (rows.some((r) => r === null)) break;
    }
    if (!moved) { for (const k in step) step[k] /= 2; console.log(`  round ${round + 1}: no move improved — steps halved`); }
    else console.log(`  round ${round + 1}: best so far ${cur.area.toFixed(1)} mm²`);
  }
  await browser.close(); srv.close();

  // The answer is the best ACCEPTED row anywhere in the log, not only the path
  // walked this run — a resumed run keeps what the earlier one found.
  const acc = [...seen.values()].filter((r) => r.accepted && r.rect).sort((a, b) => a.area - b.area);
  const top = acc[0];
  const fr = top.rect.map((q) => q.toFixed(2)).join(',');
  console.log(`SEARCH done: ${boots} boot(s) this run, ${seen.size} candidate(s) in the log, ${acc.length} accepted`);
  console.log(`BEST: measured rectangle ${dims(top.rect)} = ${top.area.toFixed(1)} mm², `
    + `${((1 - top.area / baseRow.area) * 100).toFixed(1)}% under the designed ${dims(baseRow.rect)} (${baseRow.area.toFixed(1)} mm²)`);
  console.log(`  URL: index.html?${top.query}&formrect=${fr}`);
  console.log('  (a candidate for the battery, which is the judge of record — this search sees only the build\'s own warnings)');
  process.exit(0);
}

// §308 landing 3 — THE FLOORPLANNER'S LOOP (`--floorplan`): measure the moves,
// plan, and verify by boot. src/form-floorplan.js is the planner (pure); this
// is its harness.
//   1. boot the designed form build of each kind (`case=<kind>`): its region
//      model (__clock.regions) is the planner's input and its warnings the
//      allowed set (digits stripped; the §307 outline warnings judged at the
//      candidate's own fitted shape, as --search does);
//   2. MEASURE every candidate move (FLOORPLAN_KNOBS, the 'resolve' rows left
//      out by declaration): one boot with the knob one step off its design
//      value, every unit's hull compared (measureMove) — the dominant rigid
//      cluster is the move, per unit of travel; a unit the build re-cut is a
//      BRIDGE, carried by the move when it is in a group the move carries, and
//      a knob whose bridges outweigh (by vertices) a third of what it moves is
//      left out as non-rigid;
//   3. plan each kind (planFloor) and boot its best --top plans; a plan is
//      ACCEPTED only if it adds no warning shape beyond the designed build's;
//      the best accepted is booted once more at its own ?formrect= to confirm
//      the cut holds its metal.
// `--moves FILE` writes (or, when it exists, reads back) the measured moves, so
// a re-plan does not re-measure.
if (argv.includes('--floorplan')) {
  const L0 = await import(join(ROOT, 'src/layout.js'));
  const FP = await import(join(ROOT, 'src/form-floorplan.js'));
  const KINDS = String(opt('--kinds', 'rect,cushion,tonneau')).split(',');
  const TOP = Number(opt('--top', 4));
  const PAR = Math.max(1, Number(opt('--parallel', 3)));
  const MOVES = opt('--moves', null);
  const UMM = L0.UNIT_MM;
  const dims = (b) => `${((b[1] - b[0]) * UMM).toFixed(2)} × ${((b[3] - b[2]) * UMM).toFixed(2)} mm`;
  const norm = (w) => (/^warning: §307:/.test(w) ? '§307 outline' : w.replace(/-?\d+(\.\d+)?(e-?\d+)?/g, '#'));
  const { boot, close } = await openBooter(() => ({ regions: window.__clock.regions, ff: window.__clock.formFootprint, P: window.__clock.P }));
  const pool = async (list, f) => { const out = new Array(list.length); let i = 0; await Promise.all(Array.from({ length: Math.min(PAR, list.length) }, async () => { while (i < list.length) { const j = i++; out[j] = await f(list[j]); } })); return out; };

  // 1. the designed builds
  const bases = Object.fromEntries((await pool(KINDS, async (k) => [k, await boot(`case=${k}`)])));
  for (const k of KINDS) if (bases[k].bootError || !bases[k].regions) { console.log(`FLOORPLAN: the designed ${k} build did not boot: ${bases[k].bootError ?? 'no regions'}`); await close(); process.exit(1); }
  const R0 = bases[KINDS[0]].regions;
  const P0 = bases[KINDS[0]].P;
  console.log(`FLOORPLAN: designed builds — ${KINDS.map((k) => `${k} ${dims(bases[k].ff.rect)} (${bases[k].warnings.length} warning(s))`).join(', ')}`);
  console.log('  the outline\'s sides (designed rect) are set by: ' + Object.entries(R0.edges).map(([e, x]) => `${e} ${x.group} (${x.unit ?? '?'})`).join(', ') + `; nearest the cut: ${R0.binding.group} (${R0.binding.unit ?? '?'})`);

  // 2. the moves
  const phi = Math.atan2(P0.barrel.y, P0.barrel.x) * 180 / Math.PI;
  const startOf = { crownaz: phi, stemaz: phi, alarmr: L0.ALARM_CORNER_R, rsvr: L0.RESERVE_STATION_R, d4: L0.D4 };
  const rows = FP.FLOORPLAN_KNOBS.map((r) => ({ ...r, start: r.start ?? startOf[r.knob] }));
  let measured;
  if (MOVES && existsSync(MOVES)) { measured = JSON.parse(readFileSync(MOVES, 'utf8')); console.log(`  moves read back from ${MOVES}`); }
  else {
    const probe = rows.filter((r) => r.transform !== 'resolve');
    const boots = await pool(probe, (r) => boot(`case=${KINDS[0]}&${r.knob}=${(r.start + r.step).toFixed(4)}`));
    const groupOf = (u) => R0.units[u]?.group;
    measured = rows.map((r) => {
      if (r.transform === 'resolve') return { ...r, modelled: false, reason: `declared non-rigid: ${r.why}` };
      const b = boots[probe.indexOf(r)];
      if (b.bootError || !b.regions) return { ...r, modelled: false, reason: `the probe boot failed: ${b.bootError ?? 'no regions'}` };
      const m = FP.measureMove(R0, b.regions, { delta: r.step });
      const dom = m.dominant;
      if (!dom) return { ...r, modelled: false, reason: 'no hypothesis carries any unit', bridges: m.bridges.map((q) => q.unit) };
      const d = FP.describeTransform(dom.T);
      const groups = [...new Set(dom.units.map(groupOf))];
      const bridges = m.bridges.filter((q) => q.group !== 'frame' && q.group !== 'unassigned');
      const carried = bridges.filter((q) => groups.includes(q.group));
      // MODELLED when the measured law carries at least half the units the knob
      // moved (frame and unlabelled metal aside): the carried bridges then ride
      // the move as an approximation the verifying boot judges; below that the
      // knob is a re-solve, not a move, and is left out.
      const move = { ...r, law: dom.src, units: [...dom.units, ...carried.map((q) => q.unit)], rigidUnits: dom.units,
        spun: dom.units.filter((u) => m.units[u].kind === 'spun'), worst: dom.worst,
        bridges: bridges.map((q) => q.unit), carried: carried.map((q) => q.unit), groups,
        frameMoved: m.bridges.filter((q) => q.group === 'frame').map((q) => q.unit), warnings: b.warnings.length };
      if (Math.abs(d.deg) > 1e-6) Object.assign(move, { transform: 'rotate', per: d.deg / r.step, centre: d.fix ?? { x: 0, y: 0 } });
      else Object.assign(move, { transform: 'translate', dir: { x: d.tx / r.step, y: d.ty / r.step } });
      move.modelled = dom.units.length >= bridges.length;
      move.reason = `${dom.src} carries ${dom.units.length} unit(s) (hull error ≤ ${dom.worst.toFixed(3)} u${move.spun.length ? `, ${move.spun.length} spun to a new phase` : ''}) against ${bridges.length} re-cut`
        + (move.modelled ? `; the ${carried.length} in its own groups ride it` : ' — a re-solve, not a move');
      return move;
    });
    if (MOVES) writeFileSync(MOVES, JSON.stringify(measured, null, 1));
  }
  console.log('  MOVES (measured: one boot a step off each knob\'s design value, every unit\'s hull fitted):');
  for (const m of measured) {
    const t = !m.modelled && !m.units ? '' : m.transform === 'rotate' ? ` rotate ${m.per.toFixed(4)}°/unit about (${m.centre.x.toFixed(3)}, ${m.centre.y.toFixed(3)})`
      : ` translate (${m.dir.x.toFixed(4)}, ${m.dir.y.toFixed(4)}) u/unit`;
    console.log(`    ${m.knob.padEnd(13)} ${m.modelled ? 'MODELLED' : 'left out'}${t}: ${m.reason}${m.groups ? `; groups ${m.groups.join(', ')}` : ''}${m.bridges?.length ? `; bridges ${m.bridges.join(', ')}` : ''}`);
  }
  const moves = measured.filter((m) => m.modelled);

  // 3. plan and verify, per kind
  const results = {};
  for (const k of KINDS) {
    const base = bases[k];
    const allowed = new Set(base.warnings.map(norm));
    const fp = FP.makeFloorplan({ kind: k, regions: base.regions, moves });
    const plan = FP.planFloor({ evaluate: fp.evaluate, moves, keep: TOP });
    console.log(`  ${k}: planner model ${fp.units} units, ${fp.parts} parts; the design reads ${dims(plan.design.bounds)} (the build measured ${dims(base.ff.rect)})`);
    const cands = plan.top.filter((r) => r.area < plan.design.area - 1e-6);
    if (!cands.length) {
      console.log(`    no feasible plan improves on the design${plan.design.feasible ? '' : ` (the design itself reads infeasible: ${plan.design.why[0]})`}; what refuses each modelled knob, swept alone:`);
      // the refusal per knob, swept alone over its range at its step: the
      // smallest outline each would reach and the law that stops it there
      for (const m of [...new Map(moves.map((q) => [q.knob, q])).values()]) {
        let bestR = null; const whys = new Map();
        for (let v = m.range[0]; v <= m.range[1] + 1e-9; v += m.step) {
          const r = fp.evaluate({ [m.knob]: v });
          if (r.feasible) { if (!bestR || r.area < bestR.area) bestR = r; }
          else { const w = r.why[0].replace(/-?\d+\.\d+/g, '#'); whys.set(w, (whys.get(w) ?? 0) + 1); }
        }
        const top = [...whys.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([w, n]) => `${n}× ${w}`).join(' | ');
        console.log(`      ${m.knob}: best feasible alone ${bestR ? `${dims(bestR.bounds)} at ${bestR.values[m.knob].toFixed(2)}` : 'none'}; refusals: ${top || 'none'}`);
      }
      // the alarm's two azimuths TOGETHER (the module and its corner turned as one, which the port anchor asks)
      if (moves.some((q) => q.knob === 'alarmmod') && moves.some((q) => q.knob === 'alarmaz')) {
        let bestR = null; const whys = new Map();
        for (let dv = -180; dv <= 180; dv += 5) {
          const r = fp.evaluate({ alarmmod: 40 + dv, alarmaz: dv });
          if (r.feasible) { if (!bestR || r.area < bestR.area) bestR = r; }
          else { const w = r.why[0].replace(/-?\d+\.\d+/g, '#'); whys.set(w, (whys.get(w) ?? 0) + 1); }
        }
        console.log(`      alarmmod+alarmaz together: best feasible ${bestR ? `${dims(bestR.bounds)} at Δ ${(bestR.values.alarmaz).toFixed(0)}°` : 'none'}; refusals: ${[...whys.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([w, n]) => `${n}× ${w}`).join(' | ')}`);
      }
      results[k] = null; continue;
    }
    const verified = await pool(cands, async (r) => {
      const q = FP.planQuery(k, r.values, moves);
      const b = await boot(q);
      const extra = b.bootError || !b.ff ? [`boot error: ${b.bootError ?? 'no footprint'}`] : b.warnings.filter((w) => !allowed.has(norm(w)));
      return { r, q, b, extra };
    });
    for (const v of verified)
      console.log(`    plan ${v.q}: planned ${dims(v.r.bounds)} → built ${v.b.ff ? dims(v.b.ff.rect) : '—'} ${v.extra.length ? `REFUSED (${v.extra.length} new: ${v.extra[0].slice(0, 160)})` : 'ACCEPTED'}`);
    const ok = verified.filter((v) => !v.extra.length).sort((a, b) => (a.b.ff.rect[1] - a.b.ff.rect[0]) * (a.b.ff.rect[3] - a.b.ff.rect[2]) - (b.b.ff.rect[1] - b.b.ff.rect[0]) * (b.b.ff.rect[3] - b.b.ff.rect[2]));
    if (!ok.length) { results[k] = { refused: verified.map((v) => ({ q: v.q, why: v.extra[0] })) }; continue; }
    const best = ok[0];
    const fr = best.b.ff.rect.map((q) => q.toFixed(2)).join(',');
    const conf = await boot(`${best.q}&formrect=${fr}`);
    const cExtra = conf.bootError ? [`boot error: ${conf.bootError}`] : conf.warnings.filter((w) => !allowed.has(norm(w)));
    results[k] = { q: best.q, url: `index.html?${best.q}&formrect=${fr}`, built: best.b.ff.rect, holds: conf.ff?.holds, confirmExtra: cExtra };
    console.log(`    BEST ${k}: ${dims(best.b.ff.rect)} (designed ${dims(base.ff.rect)}), confirm boot at its formrect: ${conf.ff?.holds ? 'the cut HOLDS its metal' : 'the cut does NOT hold'}${cExtra.length ? `, ${cExtra.length} new warning(s): ${cExtra[0].slice(0, 160)}` : ', no new warning'}`);
    console.log(`      URL: ${results[k].url}`);
  }
  await close();
  console.log('FLOORPLAN done (a REPORT: an accepted plan is a candidate for the battery, which is the judge of record)');
  process.exit(0);
}

if (!INPUTS) { console.error('need --dump FILE, --search or --inputs FILE'); process.exit(2); }
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
// `--near N`: a MOULDING rather than a re-design — each angle within ±N° of the
// designed one and d4 within ±N/10 u, so the parts the objective cannot see
// (the alarm module, the reserve train, the motion-works fold, all seeded off
// these stations in main.js) stay near the arrangement they were solved for.
// The stem's designed azimuth is the barrel's (§13); read off the base solve.
const baseStemAz = (() => { const { P } = L.solveLayout({ ...layoutInputs }); return Math.atan2(P.barrel.y, P.barrel.x) / RAD; })();
if (NEAR !== null) {
  const near = (c, n, lo, hi) => [Math.max(lo, c - n), Math.min(hi, c + n)];
  WIN.barrelStep = near(L.BARREL_STEP_DEG, NEAR, -180, 180);
  WIN.escStep = near(L.ESCAPE_STEP_DEG, NEAR, -180, 180);
  WIN.balStep = near(L.BALANCE_STEP_TARGET_DEG, NEAR, -180, 180);
  WIN.d4 = near(L.D4, NEAR / 10, WIN.d4[0], WIN.d4[1]);
  WIN.stemAz = near(((baseStemAz % 360) + 360) % 360, NEAR, -360, 720);
}
const stemOk = (az) => {
  if (CROWN === 'any' || NEAR !== null) return true;
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
console.log(`form-layout: objective ${OBJECTIVE}, crown ${CROWN}${NEAR !== null ? `, within ±${NEAR}° of the design` : ''}, ${tried} candidates evaluated, ${feasibleN} of ${SAMPLES} random samples feasible, seed ${SEED}`);
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
// --boot N: the solvers' feasibility is the going train's and the stem's; the
// BUILD knows the rest (the alarm module, the reserve train, the motion-works
// fold, every §62 land and §186 annulus assert). Boot the best N and count what
// rule 6 prints — a candidate the build warns on is not an arrangement yet.
if (VERIFY > 0) {
  const norm = (w) => w.replace(/-?\d+(\.\d+)?(e-?\d+)?/g, '#');
  const base = await bootOnce('case=rect');
  if (base.bootError) { console.log(`VERIFY: the designed form build did not boot: ${base.bootError}`); process.exit(0); }
  const allowed = new Set(base.warnings.map(norm));
  const fp = (f) => `${mm(2 * f.hw)} × ${mm(2 * f.hh)} mm (${(f.area * L.UNIT_MM * L.UNIT_MM).toFixed(0)} mm²)`;
  console.log(`VERIFY (${VERIFY} candidates × ${ALARMMODS.length} alarm azimuths, ?case=rect):`);
  console.log(`  designed: true footprint ${fp(base.footprint)} over ${base.footprint.meshes} meshes; ${base.warnings.length} warning(s), the allowed set`);
  const rows = [];
  for (const r of best.slice(0, VERIFY)) {
    for (const am of ALARMMODS) {
      const q = url(r.k).replace(/^index\.html\?/, '') + (am === '' ? '' : `&alarmmod=${am}`);
      const out = await bootOnce(q);
      if (out.bootError) { console.log(`  ${q} → BOOT FAILED: ${out.bootError}`); continue; }
      const extra = out.warnings.filter((w) => !allowed.has(norm(w)));
      rows.push({ q, f: out.footprint, extra });
      console.log(`  ${fp(out.footprint)}  ${extra.length ? `${extra.length} new warning(s): ${extra[0].slice(0, 110)}` : 'CLEAN'}  — alarmmod ${am || 'as designed'}, solver rect ${rect(r.f)}`);
    }
  }
  const clean = rows.filter((x) => !x.extra.length).sort((a, b) => a.f.area - b.f.area);
  if (!clean.length) console.log('  NO CLEAN CANDIDATE: every re-solved arrangement drew a warning the designed form build does not');
  else {
    const c = clean[0];
    console.log(`BEST CLEAN: ${fp(c.f)} — ${((1 - c.f.area / base.footprint.area) * 100).toFixed(1)}% under the designed footprint`);
    console.log(`  URL: index.html?${c.q}`);
  }
}

if (BOOT > 0) {
  console.log(`TRIAL BOOTS (${BOOT}, round case; the warnings are the build's own asserts):`);
  for (const r of best.slice(0, BOOT)) {
    const q = url(r.k).replace(/^index\.html\?case=rect&/, '');
    const out = await bootOnce(q);
    const errs = out.warnings.filter((w) => w.startsWith('error')).length;
    console.log(`  ${rect(r.f)} → ${out.bootError ? `BOOT FAILED: ${out.bootError}` : `${out.warnings.length} warning(s), ${errs} error(s)`}`);
    for (const w of out.warnings.slice(0, 6)) console.log(`      ${w.slice(0, 160)}`);
    if (out.warnings.length > 6) console.log(`      … ${out.warnings.length - 6} more`);
  }
}
