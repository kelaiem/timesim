// DOES THE ARRANGED MOVEMENT HOLD ITS POWER RESERVE AT 12 O'CLOCK — AND ONLY
// BECAUSE OF THE IDLERS AND THE MODULE'S TURN IT NAMES? Acceptance (§313):
// exits non-zero on any failure.
//
// §308 landing 5's arrangement swung the barrel to 180° and carried the reserve
// round to 36°. §313 holds the reserve at 12 o'clock instead: the station is
// 22.4 u from the swung barrel (14.7 designed), so the reserve train carries six
// idlers (`?rsvidl=6`, §308 L4 option B's machinery), and the alarm module turns
// 60°, where the link's measured site misses the station. §314 stepped the barrel
// to −10° (the fusee cone clear of the third wheel), where two idlers keep the
// link's site with the module at 50°. The arming spring's
// fixed point (ALARM_PINB_SEAT_MN) moves with the link and is quoted per
// arrangement. This probe holds, per build, the whole boot's warning list,
// because every one of the failures below announced itself as a boot warning.
//
// Builds and gates:
//   R   the ROUND build as designed (`?arrangement=designed`, §314): boots
//       SILENT, the reserve at 12 on the designed two-stage train (the fingerprint is reported, not gated; the
//       battery holds the bytes).
//   N   the round DEFAULT, the arrangement since §314 (barrelstep −10, rsvaz 0,
//       alarmmod 50, rsvidl 2), and S the same spelled out — one fingerprint: SILENT; the reserve station on the 12 o'clock axis; the
//       arrangement's idlers cut; the arming fixed point read off its own table row.
//   F-* each form case at its DEFAULT (the arrangement, its committed bar seat), booted
//       at that seat's fitted `formrect=` (a plain boot cuts a provisional outline):
//       only the two rows every form build carries (§186's plate seat, §261's
//       depth), and on the cushion its own lug-plane finding (§308 landing 1); the reserve at 12 on its idlers; cased width hands-centred
//       under the cap.
//   Controls — each must print the refusal it exists for:
//   C0  no idlers: the two-stage train takes the link's measured site.
//   C80 the module at 80° (§308 landing 5's turn): the link refused again.
//
// Run: node tools/probe-313-reserve-at-12.mjs [--only R|N|F-rect|…|C0|C80]
//      PW_CHROMIUM=/path/to/chrome when Playwright's own browser is not installed
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { UNIT_MM, CASE_CLEAR, CASE_BAND_T, CASE_WIDTH_MAX, ARRANGEMENT } from '../src/layout.js';
import { GONG_SEATS } from '../src/gong-seats.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const fails = [];
const ok = (name, cond, detail = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); if (!cond) fails.push(name); };

// the arrangement as a URL carries it, READ from layout.js (a typed copy would drift)
const A = ARRANGEMENT;
const ARR = `barrelstep=${A.barrelStepDeg}&rsvaz=${A.rsvAzDeg}&alarmmod=${A.alarmModAzDeg}&rsvidl=${A.rsvIdlers}`;
const LINK_REFUSED = /§308: the turned module refuses the link's measured site/;
const BUILDS = [
  { id: 'R', name: 'round, as designed', q: 'arrangement=designed' },   // §314: the bare URL is the arrangement
  { id: 'N', name: 'round, its default (the arrangement)', q: '' },
  { id: 'S', name: 'round, the arrangement spelled out', q: ARR },
  { id: 'F-rect', name: 'rect, its default', q: `case=rect&formrect=${GONG_SEATS.rect.bar.formrect.join(',')}`, form: true },
  { id: 'F-cushion', name: 'cushion, its default', q: `case=cushion&formrect=${GONG_SEATS.cushion.bar.formrect.join(',')}`, form: true },
  { id: 'F-tonneau', name: 'tonneau, its default', q: `case=tonneau&formrect=${GONG_SEATS.tonneau.bar.formrect.join(',')}`, form: true },
  { id: 'C0', name: 'control: no idlers', q: ARR.replace(/&rsvidl=\d+/, ''), control: LINK_REFUSED },
  { id: 'C80', name: 'control: the module at 80°', q: ARR.replace(/alarmmod=\d+/, 'alarmmod=80'), control: LINK_REFUSED },
];
const FORM_SHARED = [/^warning: §186: the rim-to-bore fit/, /^warning: §261: cased assembly/];
// the cushion's own shape finding (§308 landing 1: its flat lugs stand proud of the curved end walls), on every cushion build
const CUSHION_OWN = [/^warning: makeFormCase: the cushion's [+−]y end wall falls/];
const run = only ? BUILDS.filter((b) => b.id === only) : BUILDS;
if (!run.length) { console.error(`--only ${only}: no such build`); process.exit(2); }

// THE BATTERY SWEEPS F-rect, as its `form-rect` SPEC_POINTS row (`sweep: true`,
// booting exactly the warning set it DECLARES, `expectWarns`) — the form-build
// sweep TODO 274's findings are read off. The row's query is a second copy of
// F-rect's (which is built from the GENERATED seat's fit), and a copy that
// drifts would have the battery sweeping an outline no form case cuts while
// this probe holds the real one; its declared prefixes are a second copy of
// FORM_SHARED, and a copy that drifts would have the two instruments accepting
// different warnings on one build. So the row is read back off the battery's
// SOURCE (importing ci-battery.mjs would run it) and held to F-rect's query
// byte for byte, and its prefixes to FORM_SHARED one for one. Not browser
// work, so it runs first and under every --only.
{
  const src = await readFile(join(ROOT, 'tools/ci-battery.mjs'), 'utf8');
  const at = src.indexOf("{ name: 'form-rect'");
  const next = at === -1 ? -1 : src.indexOf('\n  {', at + 1);
  const row = at === -1 ? '' : src.slice(at, next === -1 ? undefined : next);
  const q = row.match(/q: '([^']*)'/)?.[1] ?? null;
  const want = BUILDS.find((b) => b.id === 'F-rect').q;
  ok('the battery\'s form-rect SPEC_POINTS row boots F-rect', q === want,
    q === null ? 'no form-rect row in tools/ci-battery.mjs' : q === want ? q : `row ${q} vs F-rect ${want}`);
  const ew = row.match(/expectWarns: \[([\s\S]*?)\]/);
  const declared = ew ? [...ew[1].matchAll(/'((?:\\.|[^'\\])*)'/g)].map((x) => x[1].replace(/\\(.)/g, '$1')) : [];
  const fired = FORM_SHARED.map((re) => declared.filter((p) => re.test(`warning: ${p}`)));
  ok('the row is swept and declares exactly FORM_SHARED, one prefix per pattern',
    /sweep: true/.test(row) && /expect: 'declared'/.test(row) && declared.length === FORM_SHARED.length && fired.every((f) => f.length === 1),
    `declared ${declared.length} [${declared.join(' | ')}] against ${FORM_SHARED.length} pattern(s)${/sweep: true/.test(row) ? '' : ' — the row is not swept'}`);
}

let chromium;
try { ({ chromium } = await import(join(ROOT, 'tools/node_modules/playwright/index.mjs'))); }
catch { ({ chromium } = createRequire(import.meta.url)('playwright')); }
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.css': 'text/css' };
const srv = createServer(async (req, res) => {
  try {
    const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    const body = await readFile(join(ROOT, p === '/' ? 'index.html' : p));
    res.writeHead(200, { 'content-type': MIME[extname(p)] ?? 'application/octet-stream', 'cache-control': 'no-store' }).end(body);
  } catch { res.writeHead(404).end('nf'); }
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
    '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'] });
const NOISE = /GPU stall|GL Driver Message|swiftshader|ReadPixels|Automatic fallback to software WebGL/i;

// the browser half: the build's own readouts, nothing re-derived
const measure = async () => {
  const I = await import('./src/inspect.js');
  const c = window.__clock;
  return { fingerprint: I.fingerprint(c), train: c.reserveTrain, arming: c.armingFixedPoint,
    form: c.formFootprint ? { rect: c.formFootprint.rect, holds: c.formFootprint.holds } : null, seated: c.gongSeat?.seated ?? null };
};
async function boot(q) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const warnings = [];
  page.on('console', (m) => { if ((m.type() === 'warning' || m.type() === 'error') && !NOISE.test(m.text())) warnings.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => warnings.push(`pageerror: ${e.message}`));
  try {
    await page.goto(`http://127.0.0.1:${srv.address().port}/index.html?trial=1&${q}`);
    await page.waitForFunction(() => !!window.__clock || !!window.__bootError, null, { timeout: 900000 });
    const out = await page.evaluate(async (src) => window.__bootError ? { bootError: String(window.__bootError.message) } : await (0, eval)(src)(), `(${measure})`);
    return { ...out, warnings };
  } finally { await ctx.close().catch(() => {}); }
}

const casedMm = (rect) => 2 * (Math.max(-rect[0], rect[1]) + CASE_CLEAR + CASE_BAND_T) * UNIT_MM;
const CAP_MM = 2 * CASE_WIDTH_MAX * UNIT_MM;
const at12 = (t) => Math.abs(t.station.x) < 1e-9 && t.station.y > 0;
const got = {};
for (const b of run) {
  console.log(`\n== ${b.id}  ${b.name}  ?${b.q}`);
  const r = await boot(b.q);
  got[b.id] = r;
  if (r.bootError) { ok(`${b.id} boots`, false, r.bootError); continue; }
  const t = r.train;
  console.log(`   fingerprint ${r.fingerprint.hash}; station (${t.station.x.toFixed(4)}, ${t.station.y.toFixed(4)}); train ${t.p0}:${t.w1}, ${t.p1}:${t.w2}, ${t.idlers} × ${t.idlerTeeth} idlers, module ${t.module1.toFixed(4)}, swing ${t.swingDeg.toFixed(2)}°; arming ${r.arming.quoted} mN (tabled ${r.arming.tabled})`);
  if (r.form) console.log(`   fitted ${r.form.rect.join(', ')}; cased width hands-centred ${casedMm(r.form.rect).toFixed(2)} mm; seated ${r.seated}`);
  for (const w of r.warnings) console.log(`   ${w.slice(0, 200)}`);
  if (b.control) { ok(`${b.id}: prints the refusal it exists for`, r.warnings.some((w) => b.control.test(w))); continue; }
  const allowed = b.form ? [...FORM_SHARED, ...(b.id === 'F-cushion' ? CUSHION_OWN : [])] : [];
  const stray = r.warnings.filter((w) => !allowed.some((re) => re.test(w)));
  ok(`${b.id}: every warning is in the named set (${allowed.length} kinds allowed)`, stray.length === 0, stray.length ? `${stray.length} stray: ${stray[0].slice(0, 140)}` : `${r.warnings.length} warning(s)`);
  ok(`${b.id}: the reserve stands at 12 o'clock`, at12(t), `(${t.station.x}, ${t.station.y})`);
  if (b.id === 'R') ok('R: the designed two-stage train (no idlers)', t.idlers === 0);
  else {
    ok(`${b.id}: the train carries the arrangement's ${A.rsvIdlers} idlers`, t.idlers === A.rsvIdlers, `${t.idlers}`);
    ok(`${b.id}: the arming fixed point is the arrangement's own row`, r.arming.tabled);
  }
  if (b.form) {
    ok(`${b.id}: seated on its committed seat`, r.seated === true);
    ok(`${b.id}: the cut holds its metal`, r.form.holds);
    ok(`${b.id}: cased width hands-centred under the cap`, casedMm(r.form.rect) <= CAP_MM, `${casedMm(r.form.rect).toFixed(2)} ≤ ${CAP_MM.toFixed(2)} mm`);
  }
}
if (got.N && got.S && !got.N.bootError && !got.S.bootError)
  ok('N = S: the default IS the arrangement spelled out (one fingerprint)', got.N.fingerprint.hash === got.S.fingerprint.hash, `${got.N.fingerprint.hash} / ${got.S.fingerprint.hash}`);
await browser.close(); srv.close();
console.log(`\n${fails.length ? `FAIL ${fails.length}: ${fails.join('; ')}` : 'ALL PASS'}`);
process.exit(fails.length ? 1 : 0);
