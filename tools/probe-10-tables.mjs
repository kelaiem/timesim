// §10 level 2, the remainder — THE KEYLESS AND ALARM PIECE TABLES. Acceptance,
// beside probe-10-drill.mjs (the mechanism, on the fusee cluster):
//   1. boot silent — the extended partition assert accepts every table (parents
//      real, no double claim, dense layers per unit);
//   2. the keyless table: 'Keyless works' explodes toward the dial (dir −1), so
//      a drill fans its pieces to NEGATIVE z by rank·UNIT; the winding stem is
//      tick-written and holds its drill offset across ticks (compared at the
//      same pose against a drill-0 baseline), and back out is === for the
//      generic pieces and the baseline value for the tick-owned one;
//   3. the alarm tables: a group drill fans every unit's pieces by rank·UNIT
//      in that unit's own direction, and the six tick-owned handles (pusher,
//      selector ring, sleeve, lifter, link rod, pawl tip) hold their offsets
//      through a pressed, armed, striking pose — measured, not assumed;
//   4. resetInputs re-gathers everything.
//   cd tools && node probe-10-tables.mjs      (exit 1 on any claim)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8482;
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
const warns = [];
page.on('pageerror', (e) => warns.push('PAGEERROR ' + String(e)));
page.on('console', (m) => { if (m.type() === 'warning' && !/GroupMarker|GL Driver|SwiftShader|WebGL/.test(m.text())) warns.push(m.text()); });
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 120000 });
const r = await page.evaluate(async () => {
  const c = window.__clock; const UNIT = 4;
  await new Promise((r) => setTimeout(r, 80)); // the lazy MECH_GRAPH import for group ranks
  const out = { bootWarns: (window.__bootWarns || []).slice() };
  const subs = () => c.subEntries;
  const byUnit = (u) => subs().filter((s) => s.parentUnit === u);
  const dirOf = (u) => c.explodeEntries ? null : null;
  // a pose that presses the pusher, arms and strikes — every tick-owned alarm piece moves under it
  const posed = () => { c.setPose({ tau: 0.13, crownPullT: 1, leverEngage: 0, tension: 1, windAccumTurns: 0, alarmOn: 1, alarmReleased: 1, alarmStrikePhase: 0.3, alarmPusherT: 0.6, alarmCrownPullT: 0.5 }); for (let i = 0; i < 4; i++) c.step(0.01); };
  const snap = () => Object.fromEntries(subs().map((s) => [s.parentUnit + ' · ' + s.displayName, s.z]));
  // 2 — keyless
  c.resetInputs(); c.setExplode(0, 'Keyless works'); posed();
  const k0 = snap();
  c.setDrill(1); posed();
  const k1 = snap();
  const kl = byUnit('Keyless works');
  out.keyless = kl.map((s) => ({ n: s.displayName, layer: s.subLayer, dz: +(k1[s.parentUnit + ' · ' + s.displayName] - k0[s.parentUnit + ' · ' + s.displayName]).toFixed(6), tick: s.tickOwned }));
  c.setDrill(0); posed();
  const k2 = snap();
  out.keylessBack = kl.every((s) => k2[s.parentUnit + ' · ' + s.displayName] === k0[s.parentUnit + ' · ' + s.displayName]);
  // 3 — alarm, as a group
  c.resetInputs(); c.setExplode(0, 'Alarm complication'); posed();
  const a0 = snap();
  c.setDrill(1); posed();
  const a1 = snap();
  const units = [...new Set(subs().filter((s) => /^Alarm /.test(s.parentUnit)).map((s) => s.parentUnit))];
  out.alarm = units.map((u) => ({ unit: u, pieces: byUnit(u).map((s) => ({ n: s.displayName, layer: s.subLayer, tick: s.tickOwned, dz: +(a1[u + ' · ' + s.displayName] - a0[u + ' · ' + s.displayName]).toFixed(6) })) }));
  c.setDrill(0); posed();
  const a2 = snap();
  out.alarmBack = subs().filter((s) => /^Alarm /.test(s.parentUnit)).every((s) => a2[s.parentUnit + ' · ' + s.displayName] === a0[s.parentUnit + ' · ' + s.displayName]);
  // 4 — resetInputs
  c.setDrill(1); posed(); c.resetInputs(); c.step(0.01);
  out.resetExact = subs().filter((s) => !s.tickOwned).every((s) => s.z === s.baseZ);
  return out;
});
await browser.close(); srv.kill();
let fail = 0; const F = (m) => { fail++; console.log('FAIL', m); }; const OK = (m) => console.log('OK  ', m);
if (r.bootWarns.length || warns.length) F(`boot: ${[...r.bootWarns, ...warns].join(' | ').slice(0, 300)}`); else OK('boot silent — the partition assert accepts every table');
const dense = (ps) => [...ps].map((p) => p.layer).sort((a, b) => a - b).every((l, i) => l === i);
// keyless: dir −1
const kOk = r.keyless.every((p) => Math.abs(p.dz - (-p.layer * 4)) < 1e-9);
if (!kOk || !dense(r.keyless)) F(`keyless: ${JSON.stringify(r.keyless)}`); else OK(`keyless: ${r.keyless.length} pieces fan toward the dial by rank·UNIT (dense 0..${r.keyless.length - 1}); order: ${[...r.keyless].sort((a, b) => a.layer - b.layer).map((p) => p.n).join(' → ')}`);
const stem = r.keyless.find((p) => p.tick);
if (!stem || stem.dz === 0) F('the winding stem (tick-owned) did not hold its drill offset across ticks'); else OK(`the winding stem holds its drill offset across ticks (${stem.dz} u at layer ${stem.layer})`);
if (!r.keylessBack) F('keyless: backing out left a piece off its baseline'); else OK('keyless: backing out returns every piece to its baseline (tick-owned included)');
// alarm
let alarmOk = true;
for (const u of r.alarm) {
  const d = dense(u.pieces);
  const sign = u.pieces.find((p) => p.layer > 0); // the unit's own direction, read off a moved piece
  const dir = sign ? Math.sign(sign.dz) : 1;
  const ok = d && u.pieces.every((p) => Math.abs(p.dz - dir * p.layer * 4) < 1e-9);
  if (!ok) { alarmOk = false; F(`alarm '${u.unit}': ${JSON.stringify(u.pieces)}`); }
  else OK(`alarm '${u.unit}': ${u.pieces.length} pieces fan by rank·UNIT (dir ${dir > 0 ? '+' : '−'}): ${[...u.pieces].sort((a, b) => a.layer - b.layer).map((p) => p.n + (p.tick ? '*' : '')).join(' → ')}`);
}
const ticks = r.alarm.flatMap((u) => u.pieces.filter((p) => p.tick));
if (ticks.some((p) => p.dz === 0 && p.layer > 0)) F(`a tick-owned alarm piece lost its offset under the strike: ${JSON.stringify(ticks)}`); else OK(`${ticks.length} tick-owned alarm handles (*) hold their offsets through a pressed, armed, striking pose`);
if (!r.alarmBack) F('alarm: backing out left a piece off its baseline'); else OK('alarm: backing out returns every piece to its baseline');
if (!r.resetExact) F('resetInputs left a generic piece off its constructed z'); else OK('resetInputs re-gathers every generic piece bit-exactly');
process.exit(fail ? 1 : 0);
