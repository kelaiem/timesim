// §281 — DOES THE LOOP CYCLE THE MOVEMENT THROUGH ITS REAL CONTROLS? Acceptance:
// exits non-zero on any failed claim. The Loop toggle CYCLES two things the
// panel already does: the fast-forward run-down (a posed drain, §258) to flat,
// and a Wind — rotation queued into crownRotation and banked through the
// keyless train until §47's arrest stalls the crown. It must never set the wind
// itself (standing rule 2), and the restart at flat must be the movement's own
// (TODO 238's selfStart, or the panel's swing where that row shows). Over at
// least two cycles, read off a real boot through window.__clock with the frames
// driven by __clock.advanceFrame (rAF held by the sweep hold, so the probe owns
// the clock), it holds:
//   1. FLAT: each run-down reaches the reserve fast-forward calls flat (≤ FF_FLAT);
//   2. THE CROWN TURNED: each wind advanced crownRotation by exactly one Wind
//      press's queue — the full wind in crown radians (RESERVE_BARREL_TURNS ×
//      |stemRadPerTurn|, the one gearing constant) plus one turn; the bank rose
//      by what the crown delivered, and the remainder, ≥ one turn, is the hand
//      on a stopped crown;
//   3. THE ARREST STALLED IT AT FULL: windArrestStalled was seen during the wind
//      and the bank ends on the arrest's engageTurns (tension 1);
//   4. THE RUN-DOWN RESTARTED: the balance was going (≥ SELF_START_BEATS beats
//      unlocked since the wind), fast-forward came back on, τ advanced and the
//      reserve fell again. At a fast-forwarded flat the balance has NOT stopped
//      (FF_FLAT leaves ~50 s of reserve), so these count as `ranOn`, never as
//      starts — measured, and printed per cycle;
//   5. IT STOPS CLEANLY: toggled off mid run-down, fast-forward drops and no
//      wind is queued over the following frames; the crown pulled out ends it
//      ('crown'); a script ends it ('script') and the button will not start it
//      under one; and the toggle persists across a reload like fastForward;
//   6. FROM A STOPPED BALANCE: run truly flat (control A's trace) and switched
//      on there, the loop winds through the crown to the arrest and the stopped
//      balance is started by the movement's own path — TODO 238's selfStart,
//      or swingBalance where the panel's row asks — counted as exactly one.
// CONTROLS, each seen to FAIL the verdict it guards: (A) the loop OFF, run down
// to a stopped balance — the cycle verdict must fail (nothing winds);
// (B) a wind that did not travel the crown — tension set by setPose — must fail
// the crown verdict. Not probe-161 (scripts), not probe-246 (the balance's rate):
// neither drives the run-down/wind cycle.
// cd tools && node probe-281-loop.mjs (exit 1 on any claim)
import { chromium } from './node_modules/playwright/index.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.mpd': 'text/plain',
};
const srv = http.createServer((rq, rs) => {
  const f = path.join(ROOT, decodeURIComponent(new URL(rq.url, 'http://x').pathname));
  fs.readFile(f, (e, d) => e
    ? (rs.statusCode = 404, rs.end('not found'))
    : (rs.setHeader('Content-Type', TYPES[path.extname(f)] || 'application/octet-stream'), rs.end(d)));
});
await new Promise((r) => srv.listen(0, r));
process.on('exit', () => srv.close());
// ?sync=0: the boot's wall-clock sync pulls the crown, which (rightly) ends a
// loop — the probe starts the loop by hand on a movement nobody is setting.
const BASE = `http://127.0.0.1:${srv.address().port}/index.html`;

let fails = 0;
const ok = (name, cond, detail) => {
  if (!cond) fails++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? `  [${detail}]` : ''}`);
};

const browser = await chromium.launch({ args: [
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
] });
const ctx = await browser.newContext({ viewport: { width: 760, height: 480 } });
const page = await ctx.newPage();
const warns = [];
page.on('console', (m) => {
  const x = m.text();
  if (m.type() === 'warning' && !/WebGL|GroupMarkerNotSet|GL Driver Message/.test(x)) warns.push(x);
});
page.on('pageerror', (e) => warns.push('PAGEERROR ' + String(e)));
const boot = async (q = '?sync=0') => {
  await page.goto(BASE + q, { waitUntil: 'load', timeout: 180000 });
  await page.waitForFunction(() => !!window.__clock && !!window.__clock.loop, null, { timeout: 300000 });
};
await boot();
ok('boot silent', warns.length === 0, warns.slice(0, 3).join(' | ') || '0 warnings');

// The in-page recorder: drives N frames and logs every phase transition with
// the quantities the verdicts read. Frames are a 30 Hz real dt; the wall dt
// handed to fast-forward is FRAME_STALL_MS' 0.25 s (its own clamp), which only
// shortens how many frames a run-down takes.
const installRecorder = () => page.evaluate(() => {
  const C = window.__clock;
  C.beginSweepHold();
  const R = window.__rec = { events: [], frames: 0 };
  let prev = C.loop.phase;
  let mark = null;
  R.run = (n) => {
    for (let i = 0; i < n; i++) {
      const before = { crown: C.crownRotation, bank: C.barrelWindTurns, tau: C.tau, stuck: C.balanceDrive.stuck };
      C.advanceFrame(1 / 30, 0.25);
      R.frames++;
      const L = C.loop;
      if (L.phase === 'wind' && prev !== 'wind') {
        mark = { crown0: before.crown, bank0: before.bank, reserveAtFlat: before.bank / L.reserveTurns };
        R.events.push({ kind: 'flat', frame: R.frames, reserve: before.bank / L.reserveTurns, stuck: before.stuck });
      }
      if (L.phase === 'wind') { if (L.stalled) mark.stalledSeen = true; mark.bankMax = Math.max(mark.bankMax ?? -Infinity, C.barrelWindTurns); }
      if (L.phase === 'restart' && prev === 'wind') {
        R.events.push({ kind: 'wound', frame: R.frames, dCrown: C.crownRotation - mark.crown0, bank0: mark.bank0, bank1: Math.max(mark.bankMax ?? -Infinity, C.barrelWindTurns),
          engage: L.engageTurns, stalledSeen: !!mark.stalledSeen || L.stalled, stalls: L.stalls });
      }
      if (L.phase === 'run' && prev === 'restart') {
        R.events.push({ kind: 'restarted', frame: R.frames, tau: C.tau, bank: C.barrelWindTurns, ff: L.fastForward,
          selfStarts: L.selfStarts, swings: L.swings, cycles: L.cycles, n: C.balanceDrive.state?.n });
        mark = { restartTau: C.tau, restartBank: C.barrelWindTurns, restartFrame: R.frames };
      }
      if (L.phase === 'run' && mark && mark.restartFrame && R.frames - mark.restartFrame === 20) {
        R.events.push({ kind: 'running', frame: R.frames, dTau: C.tau - mark.restartTau, dBank: C.barrelWindTurns - mark.restartBank, ff: L.fastForward });
      }
      prev = L.phase;
    }
    return { frames: R.frames, loop: C.loop };
  };
});
await installRecorder();

const stemRad = await page.evaluate(() => Math.abs(window.__clock.stemRadPerTurn));
const runUntil = async (pred, maxFrames, chunk = 40) => {
  let st;
  for (let f = 0; f < maxFrames; f += chunk) {
    st = await page.evaluate((n) => window.__rec.run(n), chunk);
    if (process.env.PROBE_VERBOSE) console.log(`  … frame ${st.frames}: ${st.loop.phase}, reserve ${st.loop.reserve.toFixed(4)}, cycles ${st.loop.cycles}`);
    if (await page.evaluate(pred)) break;
  }
  return st;
};

// The verdict, a function of a trace, so the controls can be judged by the same code.
function verdict(events, cyclesWanted, reserveTurns, engage) {
  const out = { flat: [], crown: [], arrest: [], restart: [] };
  const flats = events.filter((e) => e.kind === 'flat');
  const wounds = events.filter((e) => e.kind === 'wound');
  const restarts = events.filter((e) => e.kind === 'restarted');
  const runs = events.filter((e) => e.kind === 'running');
  const queue = reserveTurns * stemRad + 2 * Math.PI;
  for (let i = 0; i < cyclesWanted; i++) {
    const F = flats[i], W = wounds[i], S = restarts[i], U = runs[i];
    out.flat.push(!!F && F.reserve <= 0.0005);
    out.crown.push(!!W && Math.abs(W.dCrown - queue) < 1e-6 * queue
      && (W.bank1 - W.bank0) * stemRad <= W.dCrown + 1e-9 && W.dCrown - (W.bank1 - W.bank0) * stemRad >= 2 * Math.PI - 1e-4);
    // the bank's peak over the wind's frames; a frame's ticks after the queue empties drain ~5e-7 turn, far inside 1e-6
    out.arrest.push(!!W && W.stalledSeen && Math.abs(W.bank1 - engage) < 1e-6);
    out.restart.push(!!S && S.ff && !!U && U.dTau > 0 && U.dBank < 0);
  }
  out.pass = Object.values(out).every((a) => a.length === cyclesWanted && a.every(Boolean));
  return out;
}

// ---- 1–4: two cycles, then into a third run-down -----------------------------
const L0 = await page.evaluate(() => { const C = window.__clock; const crown = C.crownRotation; C.setLoop(true); return { ...C.loop, crown }; });
const t0 = Date.now();
await runUntil(() => { const ev = window.__rec.events; return ev.filter((e) => e.kind === 'running').length >= 2; }, 20000);
const rec = await page.evaluate(() => ({ events: window.__rec.events, frames: window.__rec.frames, loop: window.__clock.loop }));
const V = verdict(rec.events, 2, L0.reserveTurns, L0.engageTurns);
const W = rec.events.filter((e) => e.kind === 'wound');
const S = rec.events.filter((e) => e.kind === 'restarted');
const U = rec.events.filter((e) => e.kind === 'running');
const F = rec.events.filter((e) => e.kind === 'flat');
console.log(`  ${rec.frames} frames, ${((Date.now() - t0) / 1000).toFixed(0)} s wall; queue/wind = ${(L0.reserveTurns * stemRad + 2 * Math.PI).toFixed(6)} rad`);
for (let i = 0; i < Math.max(W.length, F.length); i++) {
  const w = W[i] || {}, f = F[i] || {}, s = S[i] || {}, u = U[i] || {};
  console.log(`  cycle ${i + 1}: flat reserve ${f.reserve?.toExponential(3)} (balance ${f.stuck ? 'stopped' : 'swinging'}) · Δcrown ${w.dCrown?.toFixed(6)} rad, bank ${w.bank0?.toFixed(6)}→${w.bank1?.toFixed(6)} (arrest ${w.engage}), stall ${w.stalledSeen} · restart ${s.swings ? `swung ×${s.swings}` : f.stuck ? 'self-started' : 'ran on (never stopped)'} · 20 frames on: Δτ ${u.dTau?.toFixed(1)} s, Δbank ${u.dBank?.toExponential(3)}`);
}
ok('1 each run-down reaches flat (≤ FF_FLAT)', V.flat.length === 2 && V.flat.every(Boolean), V.flat.join(','));
ok('2 each wind travelled the crown: Δcrown = one Wind press, the bank what the crown delivered, ≥ 1 turn on the stopped crown', V.crown.every(Boolean) && V.crown.length === 2, V.crown.join(','));
ok('3 the arrest stalled each wind at full (windArrestStalled seen, bank = engageTurns)', V.arrest.every(Boolean) && V.arrest.length === 2, V.arrest.join(','));
ok('4 the run-down restarted each time (balance picked up, fast-forward back on, τ advancing, reserve falling)', V.restart.every(Boolean) && V.restart.length === 2,
  `${V.restart.join(',')}; selfStarts ${rec.loop.selfStarts}, swings ${rec.loop.swings}, cycles ${rec.loop.cycles}`);

// ---- 5: stops cleanly --------------------------------------------------------
const off = await page.evaluate(() => {
  const C = window.__clock;
  const ffBefore = C.loop.fastForward;
  C.setLoop(false);
  const s0 = { ...C.loop, crown: C.crownRotation };
  window.__rec.run(120);
  const s1 = { ...C.loop, crown: C.crownRotation };
  return { ffBefore, s0, s1 };
});
ok('5a toggled off mid run-down: fast-forward drops, no wind queued, the crown untouched over 120 frames',
  off.ffBefore && !off.s0.on && !off.s0.fastForward && !off.s1.fastForward && off.s1.autoWind === 0 && off.s1.crown === off.s0.crown && off.s1.flats === off.s0.flats,
  `ff ${off.ffBefore}→${off.s0.fastForward}→${off.s1.fastForward}, autoWind ${off.s1.autoWind}, Δcrown ${off.s1.crown - off.s0.crown}, stoppedBy ${off.s0.stoppedBy}`);
const crownGuard = await page.evaluate(() => {
  const C = window.__clock;
  C.setLoop(true); window.__rec.run(2);
  C.toggleCrown(); window.__rec.run(2);
  const r = { on: C.loop.on, by: C.loop.stoppedBy, ff: C.loop.fastForward };
  C.toggleCrown(); window.__rec.run(10);
  return r;
});
ok('5b the crown pulled out ends the loop', !crownGuard.on && crownGuard.by === 'crown' && !crownGuard.ff, JSON.stringify(crownGuard));
// ---- CONTROL A, then 6: from a balance that has STOPPED ------------------------
// (A) the same driving with the loop OFF: fast-forward pressed again at every
// frame it drops out at flat (a hand on the button), until the balance STANDS.
// Measured, it stops with the reserve not quite 0 (the drain is τ's, and τ stops
// with the balance) — so "stopped" is driveState.stuck, never tension === 0,
// which a first draft waited 943 s for. Nothing winds, so the cycle verdict must
// FAIL on this trace.
const tA = Date.now();
const ctlA = await page.evaluate(() => {
  const C = window.__clock; C.setLoop(false); window.__rec.events = [];
  let frames = 0;
  for (; frames < 400 && !(C.balanceDrive.stuck && C.loop.reserve <= C.loop.flat); frames++) {
    if (!C.loop.fastForward) document.getElementById('btn-ff').click();
    window.__rec.run(1);
  }
  const st = C.balanceDrive.state;
  return { frames, events: window.__rec.events, loop: C.loop, stuck: C.balanceDrive.stuck, tension: C.tension,
           thetaDeg: st ? st.theta * 180 / Math.PI : null, inWindow: st?.inWindow };
});
const VA = verdict(ctlA.events, 2, L0.reserveTurns, L0.engageTurns);
ok('control A: loop OFF — run down to a stopped balance, and the cycle verdict FAILS (nothing winds)', !VA.pass && ctlA.stuck && ctlA.loop.reserve <= ctlA.loop.flat && !ctlA.events.some((e) => e.kind === 'wound'),
  `tension ${ctlA.tension.toExponential(2)}, balance ${ctlA.stuck ? 'stopped' : 'swinging'} at θ ${ctlA.thetaDeg?.toFixed(2)}° (${ctlA.inWindow ? 'in' : 'out of'} the impulse window), ${ctlA.frames} frames / ${((Date.now() - tA) / 1000).toFixed(0)} s, panel row ${ctlA.loop.balanceStopped ? 'showing' : 'hidden'}, verdict ${VA.pass ? 'PASS (control broken)' : 'FAIL as it must'}`);
// 6. the loop switched on at THAT flat: the wind goes in through the crown and the
// stopped balance is started by the movement's own path (selfStart, or the swing
// where the panel's row asks for one), counted as such.
const pre6 = await page.evaluate(() => { const L = window.__clock.loop; window.__clock.setLoop(true); return L; });
await runUntil(() => window.__rec.events.some((e) => e.kind === 'running'), 600, 10);
const six = await page.evaluate(() => ({ events: window.__rec.events, loop: window.__clock.loop }));
const V6 = verdict(six.events, 1, L0.reserveTurns, L0.engageTurns);
const f6 = six.events.find((e) => e.kind === 'flat');
ok('6 from a STOPPED balance: wound through the crown, stalled at the arrest, restarted by the movement (selfStart or the panel\'s swing), run-down resumed',
  V6.pass && f6 && f6.stuck && (six.loop.selfStarts - pre6.selfStarts) + (six.loop.swings - pre6.swings) === 1 && six.loop.ranOn === pre6.ranOn,
  `flat balance ${f6?.stuck ? 'stopped' : 'swinging'}; +selfStarts ${six.loop.selfStarts - pre6.selfStarts}, +swings ${six.loop.swings - pre6.swings}, +ranOn ${six.loop.ranOn - pre6.ranOn}`);
const sixStats = { selfStarts: six.loop.selfStarts - pre6.selfStarts, swings: six.loop.swings - pre6.swings };
// (B) a wind that never travelled the crown: tension set directly by a pose.
// The crown verdict must refuse it however full the bank reads.
await page.evaluate(() => window.__clock.setLoop(false));
const ctlB = await page.evaluate(() => {
  const C = window.__clock;
  C.setPose({ tension: 0 });
  const crown0 = C.crownRotation, bank0 = C.barrelWindTurns;
  C.setPose({ tension: 1 });
  return { dCrown: C.crownRotation - crown0, bank0, bank1: C.barrelWindTurns, engage: C.loop.engageTurns };
});
const VB = verdict([{ kind: 'flat', reserve: 0 }, { kind: 'wound', ...ctlB, stalledSeen: true }], 1, L0.reserveTurns, L0.engageTurns);
ok('control B: a wind set by pose — the crown verdict FAILS', VB.crown[0] === false,
  `Δcrown ${ctlB.dCrown}, bank ${ctlB.bank0.toFixed(4)}→${ctlB.bank1.toFixed(4)}`);

// ---- 5c–5e: scripts, the button, and persistence across a reload (last: it reboots) ----
const scriptGuard = await page.evaluate(() => {
  const C = window.__clock;
  C.setLoop(true);
  C.startTour();
  const a = { on: C.loop.on, by: C.loop.stoppedBy };
  document.getElementById('btn-loop').click();
  const b = { on: C.loop.on };
  C.scriptStop();   // last before the reload: a tour's first stop forces solids, which SwiftShader renders ~70x slower
  return { a, b };
});
ok('5c a script ends the loop, and the button will not start it under one', !scriptGuard.a.on && scriptGuard.a.by === 'script' && !scriptGuard.b.on, JSON.stringify(scriptGuard));
const btn = await page.evaluate(() => {
  const b = document.getElementById('btn-loop');
  b.click(); const on = { state: b.dataset.state, on: window.__clock.loop.on };
  b.click(); const offS = { state: b.dataset.state, on: window.__clock.loop.on };
  b.click(); // leave it ON for the persistence check
  document.getElementById('btn-save-state').click();
  return { on, off: offS };
});
ok('5d the button is a data-state toggle', btn.on.state === 'on' && btn.on.on && btn.off.state === 'off' && !btn.off.on, JSON.stringify(btn));
await boot('');   // no ?sync: a saved loop must also skip the boot sync, or that sync's pulled crown would end it
await installRecorder();
const persisted = await page.evaluate(() => { window.__rec.run(30); return { on: window.__clock.loop.on, by: window.__clock.loop.stoppedBy, crownOut: window.__clock.crownOut, state: document.getElementById('btn-loop').dataset.state }; });
ok('5e the toggle persists across a reload (state.js, like fastForward) and survives its first 30 frames (no boot sync)', persisted.on && persisted.state === 'on' && !persisted.crownOut, JSON.stringify(persisted));

ok('no warnings or page errors over the run', warns.length === 0, warns.slice(0, 3).join(' | ') || '0');

await browser.close();
console.log(fails ? `FAIL — ${fails} claim(s)` :
  `PASS — ${F.length + 1} flats, ${W.length + 1} crown winds (Δcrown ${W.map((w) => w.dCrown.toFixed(4)).join(', ')} rad each = one Wind press), arrest at ${L0.engageTurns} turns; restarts: ${rec.loop.ranOn} ran on from a fast-forward flat, ${sixStats.selfStarts} self-start / ${sixStats.swings} swing from a stopped balance; both controls fail`);
process.exit(fails ? 1 : 0);
