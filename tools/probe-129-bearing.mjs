// §129 — RE-SITE THE BARREL, which is where a P3 conflict is allowed to be
// solved. The subtractor is proven (probe-129-subtractor-line, probe-129-spider,
// and probe-106-reset on the built movement), and the alarm corner has no lane
// for it: measured, the best station left the idler's arbor 0.008 inside the
// low corridor's margin, and with that exempted the idler's wheel was 0.021
// inside the next obstacle. Hundredths, from two independent directions — the
// region is saturated.
//
// The design ladder's answer to that is position space, and the position that
// has not been spent is the BARREL'S OWN. §112 solved its bearing off the
// striking wheel to 202° as "the argmax over the whole rotation × bearing
// space" — for the consumers that existed then. The arrest's subtractor is a
// consumer that did not, so the argmax is re-taken with it in the objective.
//
// This cannot run inside the build: the barrel's position is baked into
// everything downstream of it, so a bearing sweep means a REBUILD per bearing.
// That is exactly what §112 did offline too, and why its answer is a literal
// with its constraint written beside it rather than a boot-time solve.
//
// Scored per bearing, in this order (a bearing that breaks the movement is not
// a candidate however well it suits the arrest):
//   1. does it BUILD, and does it build without new warnings — the barrel's own
//      asserts are in there (the fusee let-down square, the plate rim);
//   2. does the arrest's solve find a station at all;
//   3. and how much slack does that station's worst piece have — maximin, so
//      the answer is a region rather than a lucky sample.
//
// Run: node tools/probe-129-bearing.mjs           (coarse, 10°)
//      STEP=2 FROM=180 TO=240 node tools/probe-129-bearing.mjs   (refine)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const port = process.env.PORT || '8523';
const STEP = Number(process.env.STEP || 10);
const FROM = Number(process.env.FROM || 0);
const TO = Number(process.env.TO || 360);
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'],
  { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
let warns = [];
page.on('console', (m) => { if (m.type() === 'warning') warns.push(m.text()); });
page.on('pageerror', (e) => warns.push('PAGEERROR ' + String(e)));

const NOISE = /WebGL|GroupMarker|Automatic fallback|GL Driver/;
const rows = [];
for (let deg = FROM; deg < TO; deg += STEP) {
  warns = [];
  await page.goto(`http://127.0.0.1:${port}/index.html?alarmbarrelaz=${deg}`,
    { waitUntil: 'load', timeout: 90000 });
  let sub = null;
  try {
    await page.waitForFunction(() => !!window.__clock, null, { timeout: 60000 });
    sub = await page.evaluate(() => {
      const S = window.__clock.arrestDebug.sub;
      return { slack: S.slack, boundBy: S.boundBy, az: S.stationAz * 180 / Math.PI,
        idlerTeeth: S.idlerTeeth, idlerSide: S.idlerSide, z: S.z };
    });
  } catch (e) { /* no clock: recorded as a dead build below */ }
  const real = warns.filter((w) => !NOISE.test(w));
  const noStation = real.some((w) => /no station on the mesh circle/.test(w));
  const other = real.filter((w) => !/no station on the mesh circle|solved station clears by/.test(w));
  rows.push({
    deg, built: !!sub, noStation, slack: sub ? sub.slack : null,
    boundBy: sub ? sub.boundBy : 'did not build',
    az: sub ? sub.az : null, idlerTeeth: sub ? sub.idlerTeeth : null,
    side: sub ? sub.idlerSide : null, z: sub ? sub.z : null,
    other: other.length, otherFirst: other[0] ? other[0].slice(0, 90) : '',
  });
  const r = rows[rows.length - 1];
  console.log(`  ${String(deg).padStart(4)}°  ${r.built ? (r.noStation ? 'NO STATION' : `slack ${r.slack.toFixed(3)}`) : 'DEAD BUILD'}`
    + `  ${r.other ? `+${r.other} warn: ${r.otherFirst}` : ''}`
    + `${r.noStation || !r.built ? '' : `   station ${r.az.toFixed(0)}° idler ${r.idlerTeeth}t/${r.side} z ${r.z.toFixed(2)}  bound ${r.boundBy}`}`);
}

const viable = rows.filter((r) => r.built && !r.noStation && r.other === 0);
console.log(`\n--- ${viable.length} of ${rows.length} bearings carry the subtractor with a silent boot ---`);
viable.sort((a, b) => b.slack - a.slack);
for (const v of viable.slice(0, 8))
  console.log(`  ${String(v.deg).padStart(4)}°  slack ${v.slack.toFixed(3)}  station ${v.az.toFixed(0)}°  `
    + `idler ${v.idlerTeeth}t side ${v.side}  plane ${v.z.toFixed(2)}  bound by ${v.boundBy}`);
if (!viable.length)
  console.log('  none — re-siting the barrel does not open the corner either, which is a\n'
    + '  finding about the movement and not about the mechanism');
await browser.close();
srv.kill();
process.exit(viable.length ? 0 : 1);
