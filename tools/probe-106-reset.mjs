// §106 diagnostic — WHAT DOES THE STOP-WORK COUNT?
//
// A Maltese stop-work limits the WIND: the turns the ribbon holds between the
// arbor and the barrel body. This asks whether the shipped arrest counts that,
// or counts the arbor's ABSOLUTE angle — two quantities that are identical
// through a wind (the body is parked) and diverge the moment the alarm rings
// (the click parks the arbor while the body runs).
//
// Three states, posed exactly:
//   A  full wind, body at rest        — the bank
//   B  run down, body advanced        — same wind as booted, so the cross
//                                       should be back at station 0
//   C  re-wound after a run-down      — if the cross never walked back, this
//                                       drives the pin into the blank arm
//
// Run: node tools/probe-106-reset.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const port = process.env.PORT || '8501';
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'],
  { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });

const out = await page.evaluate(() => {
  const C = window.__clock, A = C.arrestDebug, S = A.spec;
  const poly = A.crossOutline;
  const clearOf = (x, y) => {
    let best = Infinity, inside = false;
    for (let i = 0, n = poly.length; i < n; i++) {
      const [x0, y0] = poly[i], [x1, y1] = poly[(i + 1) % n];
      const vx = x1 - x0, vy = y1 - y0, L2 = vx * vx + vy * vy || 1e-12;
      const t = Math.max(0, Math.min(1, ((x - x0) * vx + (y - y0) * vy) / L2));
      best = Math.min(best, Math.hypot(x - x0 - t * vx, y - y0 - t * vy));
      if ((y0 > y) !== (y1 > y) && x < x0 + ((y - y0) / (y1 - y0)) * vx) inside = !inside;
    }
    return inside ? -best : best;
  };
  const read = () => {
    const n = A.now();
    const az = Math.atan2(n.pin.y, n.pin.x);
    return {
      arbor: +(n.arborA / (Math.PI * 2)).toFixed(4),
      body: +(n.bodyA / (Math.PI * 2)).toFixed(4),
      crossDeg: +(((n.cross * 180 / Math.PI) % 360 + 360) % 360).toFixed(2),
      station: ((Math.round((az / (Math.PI * 2)) * S.N) % S.N) + S.N) % S.N,
      gap: +(clearOf(n.pin.x, n.pin.y) - S.pinR).toFixed(4),
    };
  };
  const SPT = A.strikesPerTurn;
  const rows = [];
  const pose = (name, wind, phase) => {
    C.setPose({ alarmBarrelWind: wind, alarmStrikePhase: phase });
    rows.push({ name, wind: +wind.toFixed(4), phase: +phase.toFixed(3), ...read() });
  };
  const rest = A.phaseRest, ceil = A.ceiling;
  pose('booted, empty', 0, rest);
  pose('A  wound to the ceiling', ceil, rest);
  for (const f of [0.75, 0.5, 0.25]) pose(`   ringing, ${Math.round(f * 100)}% left`, ceil * f, rest + (ceil - ceil * f) * SPT);
  pose('B  run right down', 0, rest + ceil * SPT);
  for (const f of [0.25, 0.5, 1]) pose(`C  re-wound to ${Math.round(f * 100)}%`, ceil * f, rest + ceil * SPT);
  // C, finely: the second wind starts AT the bank. If the pin is really
  // arrested by metal it can go nowhere; if the law keeps indexing, it drives
  // THROUGH the blank arm and comes out the far side.
  let worst = Infinity, worstAt = 0;
  for (let i = 0; i <= 400; i++) {
    const w = (ceil * i) / 400;
    C.setPose({ alarmBarrelWind: w, alarmStrikePhase: rest + ceil * SPT });
    const n = A.now();
    const g = clearOf(n.pin.x, n.pin.y) - S.pinR;
    if (g < worst) { worst = g; worstAt = w; }
  }
  return { rows, ceiling: ceil, N: S.N, blankAt: A.blankAt, worst: +worst.toFixed(4), worstAt: +worstAt.toFixed(4) };
});

console.log(`ceiling ${out.ceiling} arbor turns · ${out.N} stations · blank arm at station ${out.blankAt}\n`);
console.log('  state                       wind   phase    arbor    body   cross°  station   pin\u21c4cross');
for (const r of out.rows)
  console.log(`  ${r.name.padEnd(24)} ${String(r.wind).padStart(6)}  ${String(r.phase).padStart(6)}  `
    + `${String(r.arbor).padStart(7)} ${String(r.body).padStart(7)} ${String(r.crossDeg).padStart(8)} ${String(r.station).padStart(7)}  ${String(r.gap).padStart(9)}`);
console.log(`\nthe second wind, swept: deepest pin\u21c4cross ${out.worst} at wind ${out.worstAt}`
  + `  (negative = the pin is INSIDE the cross's metal)`);
await browser.close();
srv.kill();
