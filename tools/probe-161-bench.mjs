// §161 — the bench route, and the two claims it rests on, measured in a browser.
//
// Not a gate: the battery cannot see any of this. A route is UI, its captions
// are strings, and the share link is a query. What CAN be checked mechanically
// is the set of things §161 asserted and a reader would otherwise have to take
// on trust — so this is the instrument that keeps those honest.
//
// Three groups:
//   A. THE ROSTER. index.html's spec table publishes what it reads, main.js
//      consumes it, and a copied link reproduces a DESIGNED movement — the
//      defect §161 was filed for (13 keys against a 15-key reader).
//   B. THE ROUTE. Every stop is entered, every derived framing RESOLVED (a
//      frameOn miss returns null and only warns), the View HUD stays reachable
//      while #clock-ui hides, and the run ENDS inside reconfigure mode.
//   C. BOOT IS SILENT on the identity spec, with the bench table built eagerly.
//
// Run: node tools/probe-161-bench.mjs
import { chromium } from './node_modules/playwright/index.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png',
};
const srv = http.createServer((rq, rs) => {
  const f = path.join(ROOT, decodeURIComponent(new URL(rq.url, 'http://x').pathname));
  fs.readFile(f, (e, d) => e
    ? (rs.statusCode = 404, rs.end('not found'))
    : (rs.setHeader('Content-Type', TYPES[path.extname(f)] || 'application/octet-stream'), rs.end(d)));
});
await new Promise((r) => srv.listen(0, r));
const BASE = `http://127.0.0.1:${srv.address().port}/index.html`;

let fails = 0;
const ok = (name, cond, detail) => {
  if (!cond) fails++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? `  [${detail}]` : ''}`);
};

const browser = await chromium.launch({ args: [
  // Same three as the battery: an automated pane throttles setTimeout(0) to ~1 s,
  // and this probe yields inside its walk so the page can paint.
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
] });

// SwiftShader's own WebGL chatter is the harness talking, not the page.
const appWarns = (page, sink) => page.on('console', (m) => {
  const x = m.text();
  if (m.type() === 'warning' && !/WebGL|GroupMarkerNotSet|GL Driver Message/.test(x)) sink.push(x);
});
const boot = async (query = '') => {
  const pg = await browser.newPage();
  const warns = [];
  appWarns(pg, warns);
  await pg.goto(BASE + query, { waitUntil: 'load' });
  await pg.waitForFunction(() => !!window.__clock, null, { timeout: 120000 });
  return { pg, warns };
};

// ---------------------------------------------------------------------------
// A. The roster, and a link that carries a design
// ---------------------------------------------------------------------------
// Two of these three knobs — alarmbarrelaz (§129) and dialr (§125) — are exactly
// the ones the hand-typed roster had lost, so a variant saved or a link copied
// against this spec is the regression test for the defect as filed.
const DESIGNED = '?crownaz=42&dialr=27.5&alarmbarrelaz=15&reconf=1&xray=1';
{
  const { pg } = await boot(DESIGNED);
  const out = await pg.evaluate(() => ({
    roster: [...(globalThis.__WATCH_SPEC_KEYS || [])],
    spec: globalThis.__WATCH_SPEC,
    link: window.__clock.viewLink(),
  }));
  const q = new URL(out.link).searchParams;
  ok('roster reaches main.js and is the reader\'s whole table', out.roster.length === 15, `${out.roster.length} keys`);
  ok('roster carries the two keys that had drifted off it',
    out.roster.includes('alarmbarrelaz') && out.roster.includes('dialr'));
  ok('the spec was actually READ, not just listed',
    out.spec && out.spec.crownAzDeg === 42 && out.spec.dialr === 27.5 && out.spec.alarmBarrelAzDeg === 15,
    JSON.stringify(out.spec));
  ok('a copied link reproduces the DESIGNED movement',
    q.get('crownaz') === '42' && q.get('dialr') === '27.5' && q.get('alarmbarrelaz') === '15');
  ok('the link still carries the view', q.has('cam') && q.has('look') && q.get('xray') === '1');
  ok('the link does NOT carry ?reconf — a mode is not a design', !q.has('reconf'));
  await pg.close();
}

// ---------------------------------------------------------------------------
// B + C. Boot silence, then the route end to end
// ---------------------------------------------------------------------------
const { pg, warns } = await boot();
{
  const bw = await pg.evaluate(() => [...window.__clock.bootWarns]);
  // BENCH_STEPS resolves its framings EAGERLY (as INSPECT_STEPS does), so a stop
  // naming a unit that does not exist would warn HERE, at module evaluation.
  ok('identity boot is silent — every derived framing resolved', bw.length === 0, bw.slice(0, 2).join(' | '));
}

await pg.evaluate(() => window.__clock.startBench());
ok('the run started', await pg.evaluate(() => window.__clock.scriptState !== null));
ok('the running button face is localized, not a literal',
  (await pg.evaluate(() => document.getElementById('btn-bench').textContent)) === 'Stop');
ok('the View HUD stays on screen — Reconfigure and Copy view are reachable',
  await pg.evaluate(() => getComputedStyle(document.getElementById('view-hud')).display !== 'none'));
ok('#clock-ui is the one hidePanelForScript hides',
  await pg.evaluate(() => getComputedStyle(document.getElementById('clock-ui')).display === 'none'));

// The walk runs IN PAGE, in CHUNKS. In page because advanceFrame is
// deterministic and synchronous — it needs no rAF and cannot be throttled by the
// pane, and driving it a frame at a time from Node costs two round trips each.
// In chunks because a single evaluate that outlives Playwright's default
// timeout is indistinguishable from a hang: ten returns make the walk
// observable, and cost ten round trips against thousands.
//
// Frames are NOT cheap here, and the reason decides the dt. MEASURED on this
// container's SwiftShader: the boot-default SCHEMATIC tier renders in ~3 ms a
// frame, and SOLIDS — which this route forces on its reset step and never
// leaves — cost ~206 ms. So the wall is render-bound, ~70x, and it is per
// advanceFrame CALL rather than per solver tick.
//
// That inverts the usual advice. A coarser dt costs more solver sub-steps
// (advanceFrame accumulates at FIXED_DT) but proportionally FEWER renders, so
// at 1/30 the ~96 s route is ~2900 renders — about ten minutes — and at 1/4 it
// is ~390. advanceFrame honours the dt it is handed; REAL_DT_CLAMP lives in the
// rAF loop, not here.
//
// What a coarse step costs in fidelity is bounded and irrelevant to this check:
// eases (0.35 s explode, 0.9 s camera tween, the crown pull) simply complete
// inside one step. This probe asks WHICH STOPS WERE ENTERED and what the run
// left behind, not how anything looked on the way.
//
// Chunked so a slow walk is observable rather than indistinguishable from a
// hang — ten returns against hundreds of frames.
const DT = 1 / 4, CHUNK = 100, CHUNKS = 8;   // 800 frames x 0.25 s = 200 s of dwell; the route declares ~96 s
const walk = { stops: [], stillRunning: true };
for (let c = 0; c < CHUNKS && walk.stillRunning; c++) {
  const r = await pg.evaluate(({ chunk, from, dt }) => {
    const stops = []; let last = from;
    for (let n = 0; n < chunk && window.__clock.scriptState; n++) {
      window.__clock.advanceFrame(dt);
      const st = window.__clock.scriptState;
      if (st && st.idx !== last) { last = st.idx; stops.push({ idx: st.idx, of: st.of, caption: st.caption }); }
    }
    return { stops, stillRunning: window.__clock.scriptState !== null, at: last };
  }, { chunk: CHUNK, from: walk.stops.length ? walk.stops[walk.stops.length - 1].idx : -1, dt: DT });
  walk.stops.push(...r.stops);
  walk.stillRunning = r.stillRunning;
  console.log(`      … chunk ${c + 1}/${CHUNKS}: at stop ${r.at}, ${walk.stops.length} entered`);
}
ok('the route ran to completion', !walk.stillRunning);
const declared = walk.stops.length ? walk.stops[0].of : 0;
ok('every declared stop was entered', walk.stops.length === declared && declared > 0,
  `${walk.stops.length} of ${declared}`);
ok('every stop carried a caption', walk.stops.every((s) => s.caption && s.caption.length > 20));
// A caption that fell back to English is invisible in en; what IS checkable here
// is that no caption is a bare key or an empty banner.
for (const s of walk.stops) console.log(`      ${String(s.idx).padStart(2)}  ${s.caption.slice(0, 78)}…`);

const end = await pg.evaluate(() => ({
  reconfParam: new URLSearchParams(location.search).has('reconf'),
  reconfBtn: document.getElementById('btn-reconf').dataset.state,
  rowShown: getComputedStyle(document.getElementById('reconf-row')).display !== 'none',
  panelBack: getComputedStyle(document.getElementById('clock-ui')).display !== 'none',
  benchIdle: document.getElementById('btn-bench').textContent,
  link: window.__clock.viewLink(),
}));
ok('the route ENDED inside reconfigure mode, not pointing at it',
  end.reconfParam && end.reconfBtn === 'on' && end.rowShown,
  `param=${end.reconfParam} btn=${end.reconfBtn} row=${end.rowShown}`);
ok('the panel came back when the run stopped', end.panelBack);
ok('the button returned to its idle face', end.benchIdle === 'Bench', end.benchIdle);
ok('the link offered at the end still excludes ?reconf',
  !new URL(end.link).searchParams.has('reconf'));
ok('no application warning during the run', warns.length === 0, warns.slice(0, 2).join(' | '));

await browser.close();
srv.close();
console.log(fails ? `\n§161 probe: ${fails} FAILED` : '\n§161 probe: all checks pass');
process.exit(fails ? 1 : 0);
