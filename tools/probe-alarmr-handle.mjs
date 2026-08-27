// THE ALARM CORNER'S RADIUS — is a spec'd value one the movement can build?
//
// WHAT THIS FOUND, on its first run. `?alarmr=` has been a spec since §94 tier
// B, and five of the twelve radii below are accepted in silence by everything
// that judges them BEFORE the build — solveKeyless's own bracket, and §176's
// `alarmCornerWarnsAt` gathering of the interior bounds — and then boot with
// real wall failures: "NO bearing clears every wall", "i2 fouls winding climb
// at -2.50, need 0.15". Nothing warns at the point of entry.
//
// That matters beyond the deep link, because a reconfigure HANDLE for this
// radius would inherit exactly that silence, and a refusal that is not the
// real constraint reads as PERMISSION: whatever a drag accepts, a viewer will
// Apply. The handle was written, measured against this probe, and WITHDRAWN
// on the strength of these rows — see §176's entry in the roadmap.
//
// WHY THE GAP EXISTS, precisely. The interior bound that actually binds is the
// setting bearing's wall scan (`alarmSetWorst` over `ALARM_SET_WALLS`), and
// those walls are built from geometry that MOVES WITH THE CORNER — the winding
// climb stands at (ALARM_CD, 0). So judging a candidate radius needs the wall
// list parameterised by the candidate too, which `alarmCornerGeomAt` makes
// possible and does not by itself do.
//
// The measurement is three verdicts per radius, and the failure to catch is
// one specific disagreement between them:
//
//   refuseAt   the row's closed-form refusal (what a drag would show live)
//   shadow     the row's warning list (what a drag would show as amber)
//   BOOT       an actual ?alarmr= boot, whose console is the ground truth
//
//   PERMISSION THAT LIES  accepted and silent before the build, noisy in it
//   over-strict           refused, yet the movement boots clean
//
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const ROOT = process.env.ROOT || '/home/user/timesim';
const PORT = process.env.PORT || '8596';
const srv = spawn('python3', ['-m', 'http.server', PORT, '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch();

const bootAt = async (q) => {
  const p = await browser.newPage();
  const warns = [];
  p.on('console', (m) => { const t = m.text();
    if ((m.type() === 'warning' || m.type() === 'error') && !/WebGL|GroupMarker|Failed to load resource/.test(t)) warns.push(t); });
  p.on('pageerror', (e) => warns.push('PAGEERROR ' + String(e)));
  await p.goto(`http://127.0.0.1:${PORT}/index.html?hud=0&sync=0${q}`, { waitUntil: 'load', timeout: 120000 });
  const ok = await p.waitForFunction(() => !!window.__clock, null, { timeout: 90000 }).then(() => true).catch(() => false);
  await p.waitForTimeout(1800);
  const law = ok ? await p.evaluate(() => {
    const h = (window.__clock.reconfHandles || []).find((x) => x.kind === 'alarmr');
    return h ? { def: h.def } : null;
  }).catch(() => null) : null;
  await p.close();
  return { ok, warns, law };
};

// The row's own verdicts, read from the shipped build rather than re-implemented.
const p0 = await browser.newPage();
p0.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await p0.goto(`http://127.0.0.1:${PORT}/index.html?hud=0&sync=0`, { waitUntil: 'load', timeout: 120000 });
await p0.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });
const RADII = [6, 10, 13, 15.400741713809364, 17, 19, 19.5, 20, 21, 24, 30, 46];
const rows = await p0.evaluate((rs) => {
  const c = window.__clock;
  const h = (c.reconfHandles || []).find((x) => x.kind === 'alarmr');
  if (!h) return null;
  return rs.map((v) => ({
    r: v,
    refuse: h.refuseAt ? h.refuseAt(v) : null,
    warns: h.shadow ? (h.shadow(v).warns || []) : [],
  }));
}, RADII);
await p0.close();

if (!rows) {
  console.log('FAIL — the build exposes no `alarmr` handle to interrogate.');
  console.log('       (window.__clock.reconfHandles must publish the rows for this probe to read them.)');
  await browser.close(); srv.kill(); process.exit(1);
}

console.log('  radius   refuseAt              shadow warns   BOOT warns   verdict');
const bad = [];
for (const row of rows) {
  const b = await bootAt(`&alarmr=${row.r}`);
  const handleSaysClean = !row.refuse && row.warns.length === 0;
  const bootIsClean = b.ok && b.warns.length === 0;
  let verdict = 'ok';
  // THE ONE THAT MATTERS: accepted-and-silent by the handle, noisy when booted.
  if (handleSaysClean && !bootIsClean) { verdict = 'PERMISSION THAT LIES'; bad.push({ ...row, boot: b.warns.slice(0, 2) }); }
  // The mirror: refused outright, yet the movement boots clean — over-strict.
  if (row.refuse && bootIsClean) { verdict = 'over-strict'; bad.push({ ...row, boot: [] }); }
  console.log('  ' + String(row.r).padStart(7)
    + '   ' + (row.refuse ? 'REFUSED' : 'accepted').padEnd(20)
    + '  ' + String(row.warns.length).padStart(6)
    + '       ' + String(b.ok ? b.warns.length : 'no boot').padStart(6)
    + '       ' + verdict);
}
console.log('');
if (bad.length) {
  console.log('FAIL — ' + bad.length + ' radius/radii where the handle and the boot disagree:');
  for (const x of bad) {
    console.log(`  r ${x.r}: refuse=${x.refuse ? 'yes' : 'no'} shadow=${x.warns.length}`);
    for (const w of x.boot) console.log('      boot: ' + w.slice(0, 150));
  }
} else {
  console.log('PASS — every radius the handle accepts in silence boots in silence,');
  console.log('       and every radius it refuses is one the movement cannot build.');
}
await browser.close(); srv.kill();
process.exit(bad.length ? 1 : 0);
