// §134 — DOES THE GENEVA PASS OBEY THE TIER'S TWO INVARIANTS?
//
// The stop-work drew NOTHING before this: neither Geneva builder records
// `userData.r`, so the rotor pass skipped both; the §48 blade pass skips them
// on the name test; and `discOrAxis`'s unit list is hard-coded without the
// arrest. The sharpest statement of the gap was that the tier already lit a
// contact DOT here — ALARM_HANDOFFS names the pin in its slot — so it marked a
// contact between two parts it did not draw.
//
// What this checks, and why each matters more than it looks:
//
//   · PROXIES ARE NEVER MESHES. §66's assert covers only the FIRST schematic
//     block; every pass added after it (this one included) gets no coverage
//     from that check and must simply not push Meshes.
//   · EVERY PROXY IS FLAGGED, DIRECTLY. A missed flag is a FINGERPRINT break,
//     not a cosmetic one: the fingerprint's walk tests `o.geometry`, not
//     `o.isMesh`, so an unflagged Line inflates its unit's box and moves the
//     hash. This pass lands inside a labelled unit, so it is exactly the case
//     that breaks.
//   · AND THE PARTS ACTUALLY GAINED GLYPHS — a pass that runs and draws
//     nothing passes both invariants above for the wrong reason.
//
// Run: cd tools && node probe-134-tier.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const port = process.env.PORT || '8536';
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'],
  { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const b = await chromium.launch(); const pg = await b.newPage();
pg.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await pg.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 60000 });
await pg.waitForFunction(() => !!window.__clock, null, { timeout: 60000 });
const r = await pg.evaluate(async () => {
  const I = await import('./src/inspect.js'); const c = window.__clock;
  const unit = c.labelEntries.find((e) => e.name === 'Alarm winding arrest');
  let lines = 0, meshy = 0, offLayer = 0;
  unit.obj.traverse((o) => {
    if (!(o.userData && o.userData.schematic)) return;
    if (o.isMesh) meshy++;
    if (o.isLine || o.isLineSegments) lines++;
    if (!o.layers.isEnabled(1)) offLayer++;
  });
  // geometry inside the unit that is neither metal nor flagged display — the
  // fingerprint would silently eat this
  let strayGeom = 0;
  unit.obj.traverse((o) => { if (o.geometry && !o.isMesh && !(o.userData && o.userData.schematic)) strayGeom++; });
  const per = {};
  unit.obj.traverse((o) => {
    if (o.userData && (o.userData.geneva || o.userData.genevaFinger)) {
      per[o.userData.geneva ? 'cross' : 'finger'] =
        o.children.filter((ch) => ch.userData && ch.userData.schematic).length;
    }
  });
  const fp = await I.fingerprint(c);
  return { lines, meshy, offLayer, strayGeom, per, fp: fp.hash !== undefined ? fp.hash : fp };
});
console.log(JSON.stringify(r, null, 1));
await b.close(); srv.kill();
const bad = r.meshy || r.offLayer || r.strayGeom || !r.per.cross || !r.per.finger;
console.log(bad ? '\nFAIL' : '\nOK — line-only, flagged, on layer 1, and both parts draw');
process.exit(bad ? 1 : 0);
