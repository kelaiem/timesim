// The DAYLIGHT: from every chain vertex in the fusee's bottom wrap turn,
// cast a ray radially INWARD (toward the fusee axis, in the horizontal
// plane) and take the distance to the first fusee surface hit. That is the
// visible gap between the chain's body and the cone flank that has fallen
// away beneath it — the quantity the burial-only seating row cannot see.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const port = '8475';
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'], { cwd: '/home/user/timesim', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });
const out = await page.evaluate(async () => {
  const clock = window.__clock;
  const THREE = await import('./vendor/three.module.js');
  await import('./src/inspect.js');   // patch computeBoundsTree for fast raycast
  const unit = (n) => clock.labelEntries.find((e) => e.name === n);
  const fusMeshes = [];
  unit('Fusee & great wheel').obj.traverse((o) => { if (o.isMesh && o.geometry?.attributes?.position) fusMeshes.push(o); });
  const chain = (() => { let m = null; unit('Chain').obj.traverse((o) => { if (!m && o.isMesh) m = o; }); return m; })();
  // Wrap-annulus window from the LIVE cut (§123): the groove userData carries
  // the envelope closure, so the window follows the cone instead of quoting
  // the radii of a cone that has since been re-cut. A wrap vertex lies within
  // plate half-width of the envelope; ±0.3 covers tilt and chording slack.
  const groove = (() => { let g = null; unit('Fusee & great wheel').obj.traverse((o) => { if (!g && o.userData && o.userData.groove) g = o.userData.groove; }); return g; })();
  const rHi = groove.envAt(0) + groove.grooveD + 0.3;
  const rLo = groove.envAt(1) - groove.grooveD - 0.3;
  const fx = clock.P.barrel.x, fy = clock.P.barrel.y;
  // ...and the drum coil masked out by position, not by luck: its near side
  // sits at a fusee-frame radius that lands INSIDE the wrap annulus, so
  // without this the means average drum-coil rays into a wrap report.
  const drumC = new THREE.Vector3();
  unit('Mainspring drum').obj.getWorldPosition(drumC);
  const drumSeat = (() => { let s = null; unit('Mainspring drum').obj.traverse((o) => { if (!s && o.userData && o.userData.chainSeat) s = o.userData.chainSeat; }); return s; })();
  const rDrumExcl = drumSeat.wallR + 2 * groove.grooveD + 0.3;
  const ray = new THREE.Raycaster();
  const v = new THREE.Vector3();
  const res = [];
  for (const t of [1, 0.5, 0.15]) {
    clock.setPose({ tension: t, tau: 0, crownPullT: 0, leverEngage: 0, windAccumTurns: t * clock.fuseeWrapTurns });
    clock.scene.updateMatrixWorld(true);
    chain.updateWorldMatrix(true, false);
    for (const m of fusMeshes) m.material.side = THREE.DoubleSide;   // don't lose backface hits
    const pos = chain.geometry.attributes.position;
    // bottom-turn window: world z inside the lowest 1.2 of the groove band
    let zMin = Infinity;
    const pts = [];
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(chain.matrixWorld);
      const r = Math.hypot(v.x - fx, v.y - fy);
      if (r > rHi || r < rLo) continue;
      if (Math.hypot(v.x - drumC.x, v.y - drumC.y) < rDrumExcl) continue;
      zMin = Math.min(zMin, v.z);
      pts.push([v.x, v.y, v.z, r]);
    }
    let n = 0, sum = 0, worst = 0, seated = 0;
    for (const [x, y, z, r] of pts) {
      if (z > zMin + 1.2) continue;              // bottom turn only
      const dir = new THREE.Vector3((fx - x) / r, (fy - y) / r, 0);
      ray.set(new THREE.Vector3(x, y, z), dir);
      ray.far = r;                                // stop at the axis
      const hits = ray.intersectObjects(fusMeshes, false);
      if (!hits.length) continue;
      const d = hits[0].distance;
      n++; sum += d;
      if (d > worst) worst = d;
      if (d < 0.05) seated++;
    }
    res.push({ t, zMin: +zMin.toFixed(2), n, mean: +(sum / n).toFixed(3), worst: +worst.toFixed(3), seatedPct: +(100 * seated / n).toFixed(1) });
  }
  return res;
});
for (const r of out) console.log(`tension ${r.t}: bottom turn (z ${r.zMin}…+1.2), ${r.n} rays — mean daylight ${r.mean}, worst ${r.worst}, seated(<0.05) ${r.seatedPct}%`);
await browser.close(); srv.kill();
