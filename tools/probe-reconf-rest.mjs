// A RECONFIGURE HANDLE RELEASED WHERE IT STANDS PROPOSES WHAT IT ALREADY IS —
// in every frame the build can be booted in.
//
// ACCEPTANCE for the angle rows of RECONF_HANDLES (src/main.js). Each row maps
// a pointer azimuth about its anchor back to a spec value (`toSpec`), and a
// row may only shed a frame rotation its station actually carries: the train
// rows ride solveLayout's table P, which `?crownaz=` turns (RECONF_ROT_DEG),
// while the alarm triple rides the strike arbor (ALARM_SW_AZ), which only
// `?alarmmod=` turns (ALARM_MOD_ROT). Shed a rotation the station does not
// carry and a grab dropped in place proposes a different watch.
//
// That is what the alarm triple did until this probe: its toSpec subtracted
// RECONF_ROT_DEG too, and at ?crownaz=90 every one of its three rows proposed
// its own bearing +55°, at ?crownaz=200 −55°, with no gate anywhere reading it.
//
// THE MEASUREMENT: for each angle row, read the grab's azimuth about its anchor
// off the built stations, push it through the row's own toSpec, and compare
// with the identity boot's reading of the same row. The balance row's rest
// value is the solver's SETTLED step, not its target (§33 step 4: the target
// is only a target), so the rule is invariance across frames, never equality
// with `def`. A frame the station does not ride must leave the grab's world
// azimuth unmoved; a frame it rides must be shed exactly.
//
// THE CONTROL re-applies the removed term (subtracting RECONF_ROT_DEG from the
// alarm rows' reading) and must FAIL at every non-identity crownaz boot — a
// gate that cannot see the defect it was written for measures nothing.
//
// Run: cd tools && node probe-reconf-rest.mjs   (five boots, a few minutes)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const ROOT = process.env.ROOT || '/home/user/timesim';
const PORT = process.env.PORT || '8613';
const TOL = 1e-6; // degrees: float noise through atan2 and the rotation
const BOOTS = ['', '&crownaz=90', '&crownaz=200', '&alarmmod=200', '&crownaz=90&alarmmod=200'];
const srv = spawn('python3', ['-m', 'http.server', PORT, '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch();
const wrap = (d) => ((d + 180) % 360 + 360) % 360 - 180;

const readAt = async (q) => {
  const p = await browser.newPage();
  await p.goto(`http://127.0.0.1:${PORT}/index.html?hud=0&sync=0${q}`, { waitUntil: 'load', timeout: 240000 });
  await p.waitForFunction(() => !!window.__clock?.reconfHandles, null, { timeout: 240000 });
  const rows = await p.evaluate(() => {
    const c = window.__clock;
    return c.reconfHandles.filter((h) => !h.radial).map((h) => {
      const a = h.anchor(), g = h.grabAt();
      const az = Math.atan2(g.y - a.y, g.x - a.x) * 180 / Math.PI;
      return { kind: h.kind, az, spec: h.toSpec(az), alarm: /^alarm/.test(h.kind) };
    });
  });
  await p.close();
  return rows;
};

const crownOf = (q) => Number((q.match(/crownaz=(\d+)/) || [])[1] ?? NaN);
const fails = [];
const ref = await readAt('');
const refBy = Object.fromEntries(ref.map((r) => [r.kind, r]));
let controlCaught = 0, controlOwed = 0;
for (const q of BOOTS.slice(1)) {
  const rows = await readAt(q);
  // The applied rotation this boot carries, read off a train row that rides P:
  // the barrel's world azimuth about the centre moves by exactly RECONF_ROT_DEG.
  const rotDeg = wrap(rows.find((r) => r.kind === 'barrel').az - refBy.barrel.az);
  console.log(`--- ${q}  (layout turned ${rotDeg.toFixed(3)}°)`);
  for (const r of rows) {
    const d = wrap(r.spec - refBy[r.kind].spec);
    const ok = Math.abs(d) <= TOL;
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${r.kind.padEnd(14)} rest proposes ${wrap(r.spec).toFixed(4)}  identity ${wrap(refBy[r.kind].spec).toFixed(4)}  Δ ${d.toFixed(6)}`);
    if (!ok) fails.push(`${q} ${r.kind}: released in place it proposes ${d.toFixed(4)}° off the identity's reading`);
    // CONTROL: the removed term, re-applied to the alarm rows.
    if (r.alarm && Number.isFinite(crownOf(q)) && Math.abs(rotDeg) > 1) {
      controlOwed++;
      const old = wrap((r.spec - rotDeg) - refBy[r.kind].spec);
      if (Math.abs(old) > 1) controlCaught++;
    }
  }
}
await browser.close(); srv.kill();
console.log(controlOwed && controlCaught === controlOwed
  ? `CONTROL PASS: the old alarm toSpec (shedding RECONF_ROT_DEG) is caught on ${controlCaught}/${controlOwed} rows`
  : `CONTROL FAIL: the old alarm toSpec is caught on ${controlCaught}/${controlOwed} rows — the gate cannot see the defect`);
if (!(controlOwed && controlCaught === controlOwed)) fails.push('control');
console.log(fails.length ? `FAIL: ${fails.length}\n  ${fails.join('\n  ')}` : 'PASS: every angle handle released in place proposes its identity reading in every frame');
process.exit(fails.length ? 1 : 0);
