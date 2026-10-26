// DOES THE SWUNG BARREL FREE THE ALARM MODULE'S TURN — AND DOES THE DESIGNED
// TRAIN STILL BUILD THE SAME? Acceptance (§308 landing 5): exits non-zero on
// any failure.
//
// The arrangement: the going barrel (the fusee) swung from its designed 145°
// to 180° (`?barrelstep=0`), the stem, the minute wheel and the reserve
// station carried round with it (`?rsvaz=`), and the alarm module turned to
// 80° (`?alarmmod=80`) so its hammer stands on the top edge, where the case's
// length is not capped, instead of setting the width. Before this landing a
// swung barrel broke four going-side satellites that read the movement's
// frame where the stem's was meant — the setting fold's leg-1 heading, the
// minute wheel's station, the fusee window's web phase, the quick-set's
// tripwires — and the alarm link's site solve walked off its measured site
// when its neighbours turned or when a module-rigid part was boxed in world.
// This probe holds, per build, the WHOLE boot's warning list to a named set,
// because every one of those defects announced itself as a boot warning and
// nothing else did.
//
// Builds and gates:
//   R   the ROUND build, no spec: boots SILENT (the arranged-train branches are
//       never taken on the designed train; the battery's fingerprint gate holds
//       the bytes — the hash is reported here, not gated).
//   D   the DESIGNED rect at its fitted outline: its warning set is the known
//       one (the form's §186 plate seat and §261 depth, the designed build's
//       strike-opening land and its own fit note) and nothing else.
//   S   the SWING alone (barrel 180°, reserve at 35°): only the two form
//       warnings every form build carries; the §47 arrest finds a legal beak;
//       the setting fold solves to the DESIGNED bearing, swing and leg-1 angle
//       (read off build D, not typed); the cased width, hands centred, is
//       REPORTED — the swing alone leaves the hammer on the right edge.
//   A   the ARRANGEMENT (swing + module at 80°): the two form warnings plus the
//       one residue left on it — TODO 206's shared guide-triangle margin
//       (follower B's seat at the nose's margin, §308 landing 4's residue at
//       every turned module) — and nothing else. The landing's own second
//       residue, the alarm pusher bar over the turning target where the pusher
//       exits through the corner from 80° (L/D 20.6 at stem stock), closed
//       when §234 derived the stem's radius from its bar — max(stem stock,
//       L / (2 · TURN_LD_TARGET)), so the bar reads AT the target; and the
//       stiffer return coil the thicker stem first bought (104.9 mN at the
//       bottom of the stroke, over §164's tenth of a fingertip) closed when the
//       finger's ceiling became a second floor on the coil count beside the
//       shear's. Either row is a stray here if it returns. No alarm-arrest,
//       dogleg or link-site warning; the hammer is the metal's yMax binder and
//       the strike group's xMax is under the design's; width under the cap.
//   C   CONTROL: the swing WITHOUT the reserve carried round must print the
//       cap-bearing refusal — the instrument sees the failure it exists for.
// Each form build is booted at the `formrect=` it fits (FORM_FOOTPRINT's own
// bounds, so its cut holds its metal and the plain-boot artefacts — openings
// outside a provisional cut — do not appear).
//
// Run: node tools/probe-308-barrel-swing.mjs [--only R|D|S|A|C]
//      PW_CHROMIUM=/path/to/chrome when Playwright's own browser is not installed
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { UNIT_MM, CASE_CLEAR, CASE_BAND_T, CASE_WIDTH_MAX } from '../src/layout.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const fails = [];
const ok = (name, cond, detail = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); if (!cond) fails.push(name); };

// THE ARRANGEMENT, as the URL carries it. The reserve rides the stem's turn
// (35°, the designed station turned with the crown) and stands ONE degree
// further, the least on the key's grid at which the alarm link keeps its
// measured site at the 80° turn (at 35° the reserve wheel's disc refused it by
// 0.076 — measured; 36° clears, and so do 37°–45°).
export const SWING = { barrelstep: 0, rsvaz: 36, alarmmod: 80 };
const FITTED = {   // each build's own fitted outline (FORM_FOOTPRINT.rect of a plain boot), rounded outward to 0.01
  D: [-43.58, 45.72, -43.91, 44.59],
  S: [-45.96, 48.21, -43.91, 44.38],
  A: [-45.96, 45.72, -43.91, 51.41],
};
const BUILDS = [
  { id: 'R', name: 'round, as designed', q: '' },
  // E — the designed values written OUT: every arranged-train branch is taken
  // at a turn of float noise (the stem's atan2 lands 1e-14 off 145°), so this is
  // the round build to that noise, and it must be silent (gated) — the branches
  // reproduce the design, they do not merely skip it.
  { id: 'E', name: 'round, designed values explicit', q: 'barrelstep=-35&rsvaz=0&alarmmod=40' },
  { id: 'D', name: 'rect, as designed', q: `case=rect&gong=arc&formrect=${FITTED.D.join(',')}` },
  { id: 'S', name: 'rect, barrel swung', q: `case=rect&barrelstep=${SWING.barrelstep}&rsvaz=35&gong=arc&formrect=${FITTED.S.join(',')}` },
  { id: 'A', name: 'rect, swing + module 80°', q: `case=rect&barrelstep=${SWING.barrelstep}&rsvaz=${SWING.rsvaz}&alarmmod=${SWING.alarmmod}&gong=arc&formrect=${FITTED.A.join(',')}` },
  { id: 'C', name: 'control: swing, reserve left', q: `case=rect&barrelstep=${SWING.barrelstep}&gong=arc&formrect=${FITTED.S.join(',')}` },
  // the other two shapes at the arrangement, REPORTED (each at its own fitted
  // outline): their extra rows are the shapes' own form-case findings (§308
  // landing 1's cushion lug plane, a stem meeting plate metal at a tube's end)
  { id: 'A-cushion', name: 'cushion, swing + module 80° (report)', report: true, q: `case=cushion&barrelstep=${SWING.barrelstep}&rsvaz=${SWING.rsvaz}&alarmmod=${SWING.alarmmod}&gong=arc&formrect=-46.05,45.82,-44.01,51.51` },
  { id: 'A-tonneau', name: 'tonneau, swing + module 80° (report)', report: true, q: `case=tonneau&barrelstep=${SWING.barrelstep}&rsvaz=${SWING.rsvaz}&alarmmod=${SWING.alarmmod}&gong=arc&formrect=-46.02,45.78,-43.97,51.47` },
];
const FORM_SHARED = [/^warning: §186: the rim-to-bore fit/, /^warning: §261: cased assembly/];
const DESIGN_OWN = [/^warning: TODO 266: the strike group's opening/, /^warning: §307\/§308: the movement's counted metal/];
// The pusher-bar row (§234, L/D over the turning target) left this list when the
// stem was sized to its bar, and the return coil's row (§164, the press over a
// tenth of a fingertip) when the finger's ceiling became a floor on the count.
const RESIDUE = [/^warning: TODO 206 arming spring: follower-B's seat sits at the nose's margin/];
const ALLOWED = { R: [], E: [], D: [...FORM_SHARED, ...DESIGN_OWN], S: FORM_SHARED, A: [...FORM_SHARED, ...RESIDUE] };

const run = only ? BUILDS.filter((b) => b.id === only) : BUILDS;
if (!run.length) { console.error(`--only ${only}: no such build`); process.exit(2); }

// THE BATTERY BOOTS BUILD A TOO, as its `arrangement-308` SPEC_POINTS row
// (liveness: it must build, finite, and read unverified). That row's query is a
// second copy of build A's, and a copy that drifts would have the battery
// guarding an arrangement nobody designed while this probe guards the real one.
// So the row is read back off the battery's SOURCE (importing ci-battery.mjs
// would run it) and held to build A's query, byte for byte. Not browser work,
// so it runs first and under every --only.
{
  const src = await readFile(join(ROOT, 'tools/ci-battery.mjs'), 'utf8');
  const m = src.match(/\{ name: 'arrangement-308', q: '([^']*)'/);
  const a = BUILDS.find((b) => b.id === 'A').q;
  ok('the battery\'s arrangement-308 SPEC_POINTS row boots build A', !!m && m[1] === a,
    m ? (m[1] === a ? a : `row ${m[1]} vs build A ${a}`) : 'no arrangement-308 row in tools/ci-battery.mjs');
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

// The browser half: the build's own readouts, nothing re-derived.
const measure = async () => {
  const I = await import('./src/inspect.js');
  const c = window.__clock;
  const box = (h) => h.reduce((b, [x, y]) => [Math.min(b[0], x), Math.max(b[1], x), Math.min(b[2], y), Math.max(b[3], y)], [Infinity, -Infinity, Infinity, -Infinity]);
  const R = c.regions;
  return {
    fingerprint: I.fingerprint(c),
    form: c.formFootprint ? { rect: c.formFootprint.rect, metal: c.formFootprint.metal, holds: c.formFootprint.holds, mm: c.formFootprint.mm } : null,
    barrel: c.P.barrel,
    arrestLegal: (c.windArrest.beakScanTrace || '').includes('.'),
    fold: { bearingDeg: c.settingFold.bearingDeg, swingDeg: c.settingFold.swingDeg, alphaDeg: c.settingFold.alphaDeg, stemTurnDeg: c.settingFold.stemTurnDeg },
    jumperAzDeg: c.jumperSite.azDeg,
    hammer: R ? box(R.units['Alarm hammer'].hull) : null,
    strikeBox: R ? R.groups.alarmStrike.box : null,
    edges: R ? R.edges : null,
  };
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

const casedMm = (rect) => 2 * (Math.max(-rect[0], rect[1]) + CASE_CLEAR + CASE_BAND_T) * UNIT_MM;   // hands at the origin: the band is symmetric about them
const CAP_MM = 2 * CASE_WIDTH_MAX * UNIT_MM;
const got = {};
for (const b of run) {
  console.log(`\n== ${b.id}  ${b.name}  ?${b.q}`);
  const r = await boot(b.q);
  got[b.id] = r;
  if (r.bootError) { ok(`${b.id} boots`, false, r.bootError); continue; }
  console.log(`   fingerprint ${r.fingerprint.hash} (${r.fingerprint.units} units, ${r.fingerprint.poseCount} poses); barrel (${r.barrel.x.toFixed(2)}, ${r.barrel.y.toFixed(2)})`);
  if (r.form) console.log(`   fitted ${r.form.rect.join(', ')} = ${r.form.mm[0].toFixed(2)} × ${r.form.mm[1].toFixed(2)} mm plate; cased width hands-centred ${casedMm(r.form.rect).toFixed(2)} mm; cut holds its metal: ${r.form.holds}`);
  console.log(`   fold bearing ${r.fold.bearingDeg}°, swing ${r.fold.swingDeg}°, α ${r.fold.alphaDeg.toFixed(3)}°, stem turn ${r.fold.stemTurnDeg}°; §47 beak legal: ${r.arrestLegal}; jumper at ${r.jumperAzDeg}°`);
  if (r.hammer) console.log(`   hammer x [${r.hammer[0].toFixed(1)}, ${r.hammer[1].toFixed(1)}] y [${r.hammer[2].toFixed(1)}, ${r.hammer[3].toFixed(1)}]; strike group xMax ${r.strikeBox[1].toFixed(2)}; sides: ${Object.entries(r.edges).map(([k, e]) => `${k} ${e.unit}`).join(', ')}`);
  for (const w of r.warnings) console.log(`   ${w.slice(0, 180)}`);
  if (b.id === 'C') {
    ok('C: the swing without the reserve carried round prints the cap-bearing refusal', r.warnings.some((w) => /setting traverse: no cap bearing within/.test(w)));
    continue;
  }
  if (b.report) {
    ok(`${b.id}: boots, the cut holds its metal, width under the cap`, r.form.holds && casedMm(r.form.rect) <= CAP_MM, `${casedMm(r.form.rect).toFixed(2)} mm; ${r.warnings.length} warning(s) reported above`);
    continue;
  }
  const allowed = ALLOWED[b.id];
  const stray = r.warnings.filter((w) => !allowed.some((re) => re.test(w)));
  ok(`${b.id}: every warning is in the named set (${allowed.length} kinds allowed)`, stray.length === 0, stray.length ? `${stray.length} stray: ${stray[0].slice(0, 120)}` : `${r.warnings.length} warning(s)`);
  if (b.id === 'R') ok('R: the round build boots silent', r.warnings.length === 0);
  if (b.id === 'E') ok('E: the designed values written out boot silent', r.warnings.length === 0);
  if (b.id === 'S' || b.id === 'A') {
    ok(`${b.id}: the §47 arrest finds a legal beak`, r.arrestLegal);
    ok(`${b.id}: the cut holds its metal at the rim margin`, r.form.holds);
    // the width is the ARRANGEMENT's claim: the swing alone leaves the hammer on the right edge (reported on S, gated on A)
    if (b.id === 'A') ok('A: cased width hands-centred under the cap', casedMm(r.form.rect) <= CAP_MM, `${casedMm(r.form.rect).toFixed(2)} ≤ ${CAP_MM.toFixed(2)} mm`);
    ok(`${b.id}: the barrel stands at 180°`, Math.abs(Math.atan2(r.barrel.y, r.barrel.x) - Math.PI) < 1e-9, `${(Math.atan2(r.barrel.y, r.barrel.x) * 180 / Math.PI).toFixed(6)}°`);
  }
  if (b.id === 'S' && got.D && !got.D.bootError) {
    const d = got.D.fold, s = r.fold;
    ok('S: the setting fold is the DESIGNED one, turned (bearing, α to 1e-9)', Math.abs(d.bearingDeg - s.bearingDeg) < 1e-9 && Math.abs(d.alphaDeg - s.alphaDeg) < 1e-9,
      `D ${d.bearingDeg}° / ${d.alphaDeg.toFixed(6)}°, S ${s.bearingDeg}° / ${s.alphaDeg.toFixed(6)}°, stem turn ${s.stemTurnDeg}°`);
  }
  if (b.id === 'A') {
    ok('A: the hammer is the metal\'s yMax binder (on the top edge)', r.edges.yMax.unit === 'Alarm hammer', `yMax ${r.edges.yMax.unit} at ${r.edges.yMax.at}`);
    if (got.D && !got.D.bootError) ok('A: the strike group\'s xMax is under the design\'s', r.strikeBox[1] < got.D.strikeBox[1], `${r.strikeBox[1].toFixed(2)} < ${got.D.strikeBox[1].toFixed(2)}`);
    ok('A: no alarm-arrest, dogleg or link-site warning', !r.warnings.some((w) => /alarm arrest|dogleg|link's (measured )?site/.test(w)));
  }
}
await browser.close(); srv.close();
console.log(`\n${fails.length ? `FAIL ${fails.length}: ${fails.join('; ')}` : 'ALL PASS'}`);
process.exit(fails.length ? 1 : 0);
