// §106 — THE STUD SCAN, with the click's footprint in the obstacle list.
//
// The entry asks for §99's 180-candidate clearance scan re-run with the
// click's own pieces added. This runs it against the LIVE SCENE instead of
// against §99's disc-and-segment proxies, for one reason: the click is the
// obstacle that matters here, and §99 modelled it as three discs sized for
// its OWN solve. Re-using those proxies would test the cross against a
// caricature of the part it is most likely to hit. Every mesh in the band is
// the obstacle set, the click's included, at its built azimuth.
//
// Output is a FREE-DISC MAP rather than one winning azimuth: for each
// candidate azimuth and each distance from the alarm arbor's axis, the
// radius of the largest disc that fits there in the cross's band, over every
// axis. A Maltese cross's centre distance is tied to its own diameter, and
// that pair is not chosen yet — so the scan reports the room, and the
// geometry is read off it rather than assumed before it.
//
// The band defaults to the arbor RATCHET's (world z 1.407–1.807), which the
// re-survey found to be this corner's one open annulus. BAND=wheel takes the
// wind-wheel band instead.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const port = process.env.PORT || '8493';
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });

const BAND = process.env.BAND || 'ratchet';
const NAZ = Number(process.env.NAZ || 180);
const RLO = Number(process.env.RLO || 4);
const RHI = Number(process.env.RHI || 13);
const RSTEP = Number(process.env.RSTEP || 0.25);

const res = await page.evaluate(async ({ BAND, NAZ, RLO, RHI, RSTEP }) => {
  const I = await import('./src/inspect.js');
  const c = window.__clock;
  const MARGIN = 0.15;
  const units = () => c.labelEntries.map(({ name, obj }) => {
    const meshes = [];
    obj.traverse((o) => {
      if (!o.isMesh) return;
      for (let n = o; n; n = n.parent) if (n.userData && n.userData.schematic) return;
      meshes.push(o);
    });
    return { name, meshes };
  });
  c.scene.updateMatrixWorld(true);
  // the arbor's axis and the band, both read off the built parts
  const named = (nm) => { let m = null; c.scene.traverse((o) => { if (!m && o.isMesh && o.name === nm) m = o; }); return m; };
  const rat = named('alarmArborRatchet'), whl = named('alarmArborWheel');
  const zOf = (m) => {
    m.updateMatrixWorld(true);
    const p = m.geometry.attributes.position, v = m.position.clone();
    let lo = 1e9, hi = -1e9;
    for (let i = 0; i < p.count; i++) { v.set(p.getX(i), p.getY(i), p.getZ(i));
      const w = m.localToWorld(v.clone()); lo = Math.min(lo, w.z); hi = Math.max(hi, w.z); }
    return [lo, hi];
  };
  const band = BAND === 'wheel' ? zOf(whl) : zOf(rat);
  rat.updateMatrixWorld(true);
  const ax = { x: rat.matrixWorld.elements[12], y: rat.matrixWorld.elements[13] };

  // Every vertex any real mesh puts in the band (± the margin in z, so a part
  // that merely comes close still counts), over every axis. The cross's own
  // unit does not exist yet, so nothing is excluded — including the ratchet
  // it will mesh WITH, which the map reports rather than hides.
  const pts = [];          // {x, y, tag}
  const byTag = {};
  const seen = new Set();
  for (const axis of I.AXES) {
    for (let i = 0; i < 5; i++) {
      c.resetInputs?.(); c.setPose(axis.pose(i / 4));
      c.scene.updateMatrixWorld(true);
      for (const u of units()) {
        for (const m of u.meshes) {
          m.updateMatrixWorld(true);
          const p = m.geometry.attributes.position, v = m.position.clone();
          const tag = `${u.name} :: ${m.name || m.geometry.type}`;
          for (let k = 0; k < p.count; k++) {
            v.set(p.getX(k), p.getY(k), p.getZ(k));
            const w = m.localToWorld(v.clone());
            if (w.z < band[0] - MARGIN || w.z > band[1] + MARGIN) continue;
            // DEDUPE on a 0.05 grid. Half a million vertices is mostly one
            // extruded wheel sampled far finer than this question needs, and
            // the scan is O(candidates × points); 0.05 is a third of the
            // stock floor, so nothing a member could hide behind is lost.
            const key = `${Math.round((w.x - ax.x) / 0.05)},${Math.round((w.y - ax.y) / 0.05)}`;
            if (seen.has(key)) continue;
            seen.add(key);
            pts.push({ x: w.x - ax.x, y: w.y - ax.y, tag });
            byTag[tag] = (byTag[tag] || 0) + 1;
          }
        }
      }
    }
  }
  // the free-disc map: at each (az, d), the largest disc that fits, less the margin
  const map = [];
  for (let a = 0; a < NAZ; a++) {
    const az = (a / NAZ) * Math.PI * 2, cs = Math.cos(az), sn = Math.sin(az);
    const row = { azDeg: +(az * 180 / Math.PI).toFixed(1), best: 0, bestD: null, at: null, cells: [] };
    for (let d = RLO; d <= RHI + 1e-9; d += RSTEP) {
      const px = cs * d, py = sn * d;
      let near = Infinity, who = null;
      for (const q of pts) {
        const dd = Math.hypot(px - q.x, py - q.y);
        if (dd < near) { near = dd; who = q.tag; }
      }
      const free = near - MARGIN;                      // radius a disc may have here
      row.cells.push(+free.toFixed(3));
      if (free > row.best) { row.best = +free.toFixed(3); row.bestD = +d.toFixed(2); row.at = who; }
    }
    map.push(row);
  }
  return { axis: ax, band: band.map((x) => +x.toFixed(3)), nPts: pts.length,
    tags: Object.entries(byTag).sort((a, b) => b[1] - a[1]).slice(0, 14), map,
    grid: { RLO, RHI, RSTEP } };
}, { BAND, NAZ, RLO, RHI, RSTEP });

console.log(`band ${BAND} = z ${JSON.stringify(res.band)}   axis ${JSON.stringify(res.axis)}`);
console.log(`obstacle vertices in the band, over every axis: ${res.nPts}`);
console.log('the parts contributing them:');
for (const [t, n] of res.tags) console.log(`   ${String(n).padStart(7)}  ${t}`);
console.log(`\n--- largest free disc, by azimuth (grid d ${res.grid.RLO}..${res.grid.RHI} step ${res.grid.RSTEP}) ---`);
console.log('  az°     best free r   at d    nearest part there');
// The profile that matters: free radius AT each centre distance, because a
// cross's centre distance is tied to its own diameter — the pair is read off
// this table together, not chosen and then checked.
const ds = [];
for (let d = res.grid.RLO; d <= res.grid.RHI + 1e-9; d += res.grid.RSTEP) ds.push(+d.toFixed(2));
console.log('\n  az°  ' + ds.map((d) => `d=${d}`.padStart(8)).join(''));
for (const r of res.map.filter((_, i) => i % 3 === 0))
  console.log(`  ${String(r.azDeg).padStart(4)} ` + r.cells.map((v) => String(v).padStart(8)).join(''));
// and, per centre distance, the azimuth with the most room
console.log('\n--- per centre distance: the roomiest azimuth, and what bounds it ---');
ds.forEach((d, i) => {
  let best = -Infinity, az = null;
  for (const r of res.map) if (r.cells[i] > best) { best = r.cells[i]; az = r.azDeg; }
  console.log(`  d ${String(d).padStart(5)}   free r ${String(+best.toFixed(3)).padStart(6)}   at az ${String(az).padStart(5)}°`);
});
await browser.close();
srv.kill();
