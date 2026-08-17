// §106 — IS THE BANK REAL? The entry's acceptance is that winding past 56
// clicks is prevented by the finger banking on the cross, "the cap a
// consequence of metal". A clamp that happens to sit where metal also is looks
// identical from outside, so this asks the question the clamp cannot answer:
//
//   1. at the ceiling, is the pin in clear air — not already buried?
//   2. driven PAST the ceiling, does the pin go INTO the blank arm? If it
//      sails on through empty space, the "arrest" is a number with a mechanism
//      drawn beside it, and the acceptance is not met however green the gates.
//   3. does the stop land on an integer click of the arbor ratchet?
//   4. is the arm it banks on the BLANK one — is the stop at the right station?
//
// (2) cannot be posed: the tick law and setPose both clamp to the ceiling now.
// So it re-evaluates the SHIPPED angle law past its own ceiling and puts the
// pin where that law would put it, then measures against the cross's own
// traced outline (MODELING rule 1 — the shape that was cut, not the one that
// was authored).
//
// Run: node tools/probe-106-bank.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const port = process.env.PORT || '8499';
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'],
  { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });

const out = await page.evaluate(() => {
  const A = window.__clock.arrestDebug;
  const poly = A.crossOutline;
  // signed clearance from a point to the cross's metal: positive outside
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
  const gapAt = (wind) => {
    const p = A.pinInCrossFrame(wind);
    // which station is the pin presenting itself to, in cross-local terms
    let az = Math.atan2(p.y, p.x);
    const station = ((Math.round((az / (Math.PI * 2)) * A.spec.N) % A.spec.N) + A.spec.N) % A.spec.N;
    return { gap: clearOf(p.x, p.y) - A.spec.pinR, station, r: Math.hypot(p.x, p.y) };
  };
  const r = { ceiling: A.ceiling, clicks: A.clicks, blankAt: A.blankAt, N: A.spec.N, rows: [], checks: [] };
  const push = (name, ok, got, want) => r.checks.push({ name, ok, got, want });

  const perTurn = 1 / A.pinionTurnsPerWind;      // barrel turns per pinion turn
  for (let over = -0.5; over <= 1.0001; over += 0.125) {
    const g = gapAt(A.ceiling + over * perTurn);
    r.rows.push({ over: +over.toFixed(3), gap: +g.gap.toFixed(4), station: g.station, r: +g.r.toFixed(3) });
  }
  const atCeiling = gapAt(A.ceiling);
  r.atCeiling = { gap: +atCeiling.gap.toFixed(4), station: atCeiling.station };
  const past = r.rows.filter((x) => x.over > 1e-9);
  const worst = Math.min(...past.map((x) => x.gap));
  const bankStations = new Set(past.filter((x) => x.gap < 0).map((x) => x.station));

  push('the pin is clear at the ceiling', atCeiling.gap > 0, +atCeiling.gap.toFixed(4), '> 0');
  push('driven past the ceiling the pin buries in metal', worst < 0,
    +worst.toFixed(4), '< 0 — metal, not a number');
  push('the stop lands on an integer click', Number.isInteger(A.clicks), A.clicks, 'integer detent');
  push('the arm it banks on is the BLANK one',
    bankStations.size > 0 && [...bankStations].every((s) => s === A.blankAt),
    'stations ' + JSON.stringify([...bankStations]), 'only ' + A.blankAt);
  return r;
});

console.log(`ceiling ${out.ceiling} barrel turns = ${out.clicks} clicks · ${out.N} stations, blank at ${out.blankAt}`);
console.log(`at the ceiling: pin ⇄ cross ${out.atCeiling.gap}, presenting at station ${out.atCeiling.station}`);
console.log('\n--- the shipped law driven past its own ceiling ---');
console.log('  over(pinion turns)   pin⇄cross   station   r from cross centre');
for (const x of out.rows)
  console.log(`  ${String(x.over).padStart(18)}   ${String(x.gap).padStart(9)}   ${String(x.station).padStart(7)}   ${x.r}`);
console.log('\n--- checks ---');
let bad = 0;
for (const c of out.checks) {
  if (!c.ok) bad++;
  console.log(`  ${c.ok ? 'PASS' : 'FAIL'}  ${c.name.padEnd(44)} ${String(c.got).padStart(16)}   want ${c.want}`);
}
console.log(bad ? `\n${bad} FAILING` : '\nall checks pass');
await browser.close();
srv.kill();
process.exit(bad ? 1 : 0);
