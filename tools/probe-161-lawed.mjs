// TODO 161 — does JMP_SITE judge the lawed movers over their TRAVEL? ACCEPTANCE.
//
// JMP_SITE sites the minute jumper against every other unit's metal. Before
// TODO 161 it read that metal AS BUILT, so a lever's travel was invisible to
// it. It now takes the §45 release run and the §34 selector ring out of the
// as-built pass and re-enters them at samples of their own pose LAWS (the
// functions tick poses them through). Nothing on today's tree tells the two
// apart — measured while planning, no station of 720 has the rest pose clear
// and a travel pose under the margin — so the only honest control is one that
// MAKES them differ, in flight:
//
//   boot A  the shipped tree: the station, the published `lawed` sample
//           counts, and boot silence.
//   boot B  the ring's LAWED pose rewritten so that at the END of its travel
//           (u = 1) the ring stands on the shipped lifter bar. A solve that
//           consumes the samples must refuse A's station.
//   boot C  the same rewrite, and the LAWED sample loop cut to u = 0 alone.
//           The station must be A's — proving it was the u = 1 SAMPLE that
//           refused it in B, and not the rewrite alone.
//
// Each rewrite must take (the exact source line is asserted present), or the
// probe refuses: a drifted line would silently re-serve boot A as a control.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

const PORT = process.env.PORT || 8592;
const ROOT = process.env.ROOT || '..';
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
process.on('exit', () => srv.kill());
await new Promise((r) => setTimeout(r, 900));

const MAIN = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const POSE_LINE = 'pose: (u) => { alarmSelRing.position.z = alarmSelRingZAt(u); } },';
const LOOP_LINE = '    for (let k = 0; k <= n; k++) {';
for (const line of [POSE_LINE, LOOP_LINE]) {
  if (MAIN.split(line).length !== 2) {
    console.error(`REFUSED: src/main.js no longer contains exactly one \`${line.trim()}\` — the control rewrites it.`);
    process.exit(1);
  }
}

const browser = await chromium.launch({ args: ['--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'] });

async function boot(src) {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 700 } });
  await ctx.route('**/__state*', (r) => (r.request().method() === 'GET' ? r.fulfill({ status: 404, body: '' }) : r.fulfill({ status: 204, body: '' })));
  let took = !src;
  if (src) await ctx.route('**/src/main.js*', (r) => { took = true; r.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: src }); });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 300000 });
  await page.waitForFunction(() => !!window.__clock || !!window.__bootError, null, { timeout: 300000, polling: 1000 });
  const r = await page.evaluate(() => {
    const c = window.__clock;
    if (!c) return { bootError: String(window.__bootError) };
    const j = c.jumperSite;
    const bar = c.scene.getObjectByName('jumperLifter');
    const p = bar.getWorldPosition(new bar.position.constructor());
    return { azDeg: j.azDeg, clr: j.clr, lawed: j.lawed, warns: c.bootWarns.slice(), bar: [p.x, p.y, p.z] };
  });
  await ctx.close();
  if (!took) throw new Error('the main.js rewrite never served — the boot is not the control it claims');
  return { ...r, errors };
}

const fails = [];
const fail = (s) => { fails.push(s); console.log('  FAIL ' + s); };

const A = await boot(null);
console.log(`boot A (shipped): station ${A.azDeg}°, clearance ${A.clr?.toFixed?.(4)}, lawed ${JSON.stringify(A.lawed)}, ${A.warns?.length ?? '?'} boot warning(s)`);
if (A.bootError) fail(`boot A died: ${A.bootError}`);
if (!Array.isArray(A.lawed) || A.lawed.length !== 2 || A.lawed.some((l) => !(l.samples >= 2)))
  fail('boot A does not publish two lawed movers with at least two samples each — the sweep is not running');
if (A.warns?.length) fail(`boot A is not silent: ${A.warns[0]}`);
if (A.errors.length) fail(`boot A page error: ${A.errors[0]}`);

// the ring, at the END of its travel only, carried onto the shipped lifter bar
const [bx, by, bz] = A.bar;
const PLANT = `pose: (u) => { alarmSelRing.position.z = alarmSelRingZAt(u); if (u === 1) { alarmSelRing.position.copy(alarmSelRing.parent.worldToLocal(new THREE.Vector3(${bx}, ${by}, ${bz}))); } } },`;
const B_SRC = MAIN.replace(POSE_LINE, PLANT);
const C_SRC = B_SRC.replace(LOOP_LINE, '    for (let k = 0; k <= 0; k++) {');

const B = await boot(B_SRC);
console.log(`boot B (ring planted on the lifter at u = 1, all samples): station ${B.azDeg}°, clearance ${B.clr?.toFixed?.(4)}`);
if (B.bootError) fail(`boot B died: ${B.bootError}`);
else if (B.azDeg === A.azDeg) fail(`boot B kept A's station ${A.azDeg}° with the ring standing on the lifter at the end of its travel — the solve did not consume the lawed samples`);

const C = await boot(C_SRC);
console.log(`boot C (same plant, samples cut to u = 0): station ${C.azDeg}°, clearance ${C.clr?.toFixed?.(4)}`);
if (C.bootError) fail(`boot C died: ${C.bootError}`);
else if (C.azDeg !== A.azDeg) fail(`boot C moved the station to ${C.azDeg}° with the planted sample cut — B's refusal was not the u = 1 sample`);

await browser.close();
console.log(fails.length ? `\nFAIL — ${fails.length} problem(s)` : '\nPASS — JMP_SITE judges the lawed movers at their travel samples, and a sample it is not given cannot refuse a station');
process.exit(fails.length ? 1 : 0);
