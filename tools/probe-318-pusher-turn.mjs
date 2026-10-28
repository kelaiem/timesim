// WHERE CAN THE ALARM PUSHER TURN TO? — §318's scan. A form case's seated strike group stands on the column
// wheel's press line (the hammer's arm spans it from post to head), and under CLAUDE.md's P3 rule the pusher, a
// LINK since §261 2c (its pin drives crank A, not the wheel), is what yields. The build turns the whole pusher
// about the movement's centre by ALARM_PUSH_ROT; this scan boots the build at each trial turn
// (`globalThis.__PUSH_TURN_DEG`, the build's own probe hook) and measures the PUSHER's metal (every `alarmPusher*`
// mesh) against every other labelled mesh over the press and the strike, so a turn is judged on the metal as
// built at that turn rather than on a plan.
//
// REPORT with a fatal control (exit 2 when the control fails). It moves no metal; the pick is written into
// ALARM_PUSH_TURNS (main.js) by hand from this report, with the linkage's line re-searched at that turn by
// `tools/probe-314-linkage-line.mjs --turn DEG`.
//
// METHOD. A pair (pusher mesh, other mesh) is UNDER the margin when inspect.js's meshClearance reads it below
// CLEAR_MARGIN at any sampled pose: the rest pose, the alarmPress axis and the alarmStrike axis at
// `--steps` points each. Pairs whose bounding boxes stand a margin apart are not measured. The unturned build's
// rows are the BASELINE: a row there that is not the strike group's is the pusher's own fit (its case tube, its
// guide's plate seat, its return post) and moves with it, so a turn is CLEAR when it carries no row naming a unit
// the baseline does not, and no row naming the strike group (`Alarm hammer`, `Alarm gong`, `Alarm lifting lever`).
//
// CONTROL (fatal): the unturned build reads the strike group under the margin — the collision §318 exists for.
// A scan whose baseline reads it clear is measuring nothing.
//
// Run: node tools/probe-318-pusher-turn.mjs [--q QUERY] [--from DEG] [--to DEG] [--step DEG] [--steps N]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const argOf = (k, d = null) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const Q = argOf('--q', 'case=rect&formrect=-45.72,45.72,-44.38,44.38');
const FROM = +argOf('--from', -60), TO = +argOf('--to', 60), STEP = +argOf('--step', 5), STEPS = +argOf('--steps', 8);
const STRIKE = new Set(['Alarm hammer', 'Alarm gong', 'Alarm lifting lever']);

const { chromium } = await import(join(ROOT, 'tools/node_modules/playwright/index.mjs'));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/json', '.css': 'text/css' };
const srv = createServer(async (req, res) => {
  try {
    const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    const body = await readFile(join(ROOT, p === '/' ? 'index.html' : p));
    res.writeHead(200, { 'content-type': MIME[extname(p)] ?? 'application/octet-stream', 'cache-control': 'no-store' }).end(body);
  } catch { res.writeHead(404).end('nf'); }
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });

const measure = async (turn) => {
  const ctx = await browser.newContext(), page = await ctx.newPage(), warns = [];
  page.on('console', (m) => { if (m.type() === 'warning' && !/GPU|GL Driver|swiftshader|ReadPixels|fallback/i.test(m.text())) warns.push(m.text()); });
  await page.addInitScript((d) => { globalThis.__PUSH_TURN_DEG = d; }, turn);
  await page.goto(`http://127.0.0.1:${srv.address().port}/index.html?hud=0&sync=0&${Q}`);
  await page.waitForFunction(() => !!window.__clock || !!window.__bootError, null, { timeout: 900000, polling: 1000 });
  const out = await page.evaluate(async ({ STEPS }) => {
    if (window.__bootError) return { bootError: String(window.__bootError.message || window.__bootError) };
    const I = await import('./src/inspect.js'), L = await import('./src/layout.js'), c = window.__clock, CM = L.CLEAR_MARGIN;
    const labelOf = new Map(); for (const e of c.labelEntries) if (!labelOf.has(e.obj)) labelOf.set(e.obj, e.name);
    const unitOf = (o) => { for (let p = o; p; p = p.parent) if (labelOf.has(p)) return labelOf.get(p); return null; };
    const pusher = [], others = [];
    c.scene.traverse((o) => { if (!o.isMesh || o.userData.schematic || !o.geometry?.attributes?.position) return;
      const u = unitOf(o); if (!u) return; (/^alarmPusher/.test(o.name) ? pusher : others).push({ o, u }); });
    const B = (o) => { o.geometry.computeBoundingBox(); return o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld); };
    const rows = new Map();
    const at = (tag) => { c.scene.updateMatrixWorld(true);
      const pb = pusher.map((p) => B(p.o));
      for (const q of others) { if (q.u === 'Alarm switch' && /^alarmPusher/.test(q.o.name)) continue; const qb = B(q.o);
        pusher.forEach((p, i) => { if (!pb[i].clone().expandByScalar(CM).intersectsBox(qb)) return;
          const d = I.meshClearance(p.o, q.o, CM); if (!(d < CM)) return;
          const k = `${p.o.name} ⇄ ${q.u} / ${q.o.name || q.o.geometry.type}`, r = rows.get(k);
          if (!r || d < r.d) rows.set(k, { d: +d.toFixed(4), unit: q.u, at: tag }); }); } };
    c.resetInputs(); at('rest');
    for (const name of ['alarmPress', 'alarmStrike']) { const ax = I.AXES.find((a) => a.name === name);
      for (let i = 0; i <= STEPS; i++) { c.setPose(ax.pose(i / STEPS, c)); at(`${name} ${i}/${STEPS}`); } }
    c.resetInputs();
    return { rows: [...rows.entries()].map(([k, v]) => ({ k, ...v })), pusherAzDeg: c.alarmPusherAz ?? null };
  }, { STEPS });
  await ctx.close();
  return { turn, ...out, warns };
};

const base = await measure(0);
if (base.bootError) { console.log(`unturned build failed to boot: ${base.bootError}`); process.exit(2); }
const baseUnits = new Set(base.rows.filter((r) => !STRIKE.has(r.unit)).map((r) => r.unit));
const strikeBase = base.rows.filter((r) => STRIKE.has(r.unit));
console.log(`query ${Q}`);
console.log(`baseline (turn 0): ${base.rows.length} row(s) under ${'CLEAR_MARGIN'}; its own fit: ${[...baseUnits].join(', ') || 'none'}`);
for (const r of strikeBase) console.log(`  strike  ${r.k}  ${r.d}  @ ${r.at}`);
const controlOk = strikeBase.length > 0;
console.log(`CONTROL ${controlOk ? 'PASS' : 'FAIL'}: the unturned build reads the strike group under the margin`);
const clear = [];
for (let t = FROM; t <= TO + 1e-9; t += STEP) {
  if (Math.abs(t) < 1e-9) continue;
  const m = await measure(t);
  if (m.bootError) { console.log(`turn ${t}°: boot failed (${m.bootError})`); continue; }
  const strike = m.rows.filter((r) => STRIKE.has(r.unit)), fresh = m.rows.filter((r) => !STRIKE.has(r.unit) && !baseUnits.has(r.unit));
  const ok = !strike.length && !fresh.length;
  if (ok) clear.push(t);
  console.log(`turn ${String(t).padStart(4)}°: ${ok ? 'CLEAR' : 'meets'}${strike.length ? `  strike ${strike.map((r) => `${r.k} ${r.d}`).slice(0, 2).join('; ')}` : ''}${fresh.length ? `  new ${fresh.map((r) => `${r.k} ${r.d}`).slice(0, 3).join('; ')}` : ''}${m.warns.length ? `  [${m.warns.length} boot warning(s): ${m.warns[0].slice(0, 120)}]` : ''}`);
}
console.log(`\nclear turns: ${clear.length ? clear.join(', ') : 'none'} — the smallest |turn| is the pick (the fold's cheapest position change), then the linkage re-searched at it`);
await browser.close(); srv.close();
process.exit(controlOk ? 0 : 2);
