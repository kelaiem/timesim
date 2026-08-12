// Where else can the MAINSPRING DRUM stand?
//
// The drum's station is an azimuth about the fusee at a fixed centre distance
// (FUSEE_R_LARGE + DRUM_R + 2.5), aimed today perpendicular-to-stem and
// blended outward so the chain span clears the third wheel. This sweeps that
// azimuth over the full circle and reports, per degree, the worst clearance
// against every foreign mesh that shares the drum's z band — plus the same
// for the chain span's corridor — so a new station is chosen against measured
// space. The point of the sweep is the ALARM module: the drum's present
// sector is the only under-plate volume deep enough to take it.
// Run: cd tools && node probe-drum-azimuth.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const srv = spawn('python3', ['-m', 'http.server', '8443', '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto('http://127.0.0.1:8443/index.html', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 60000 });

const res = await page.evaluate(async () => {
  const THREE = await import('three');
  const clock = window.__clock;
  clock.resetInputs();
  clock.setPose({ tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, windAccumTurns: 0 });
  clock.render();
  const out = [];
  const f = (n) => n.toFixed(2);
  const P = clock.P, plateR = clock.plateR;
  const MARGIN = 0.15;
  // The barrel side moves as one; the alarm module is what we are making room
  // for, so neither is an obstacle to the drum's re-siting.
  const MOVES = ['Fusee & great wheel', 'Mainspring drum', 'Chain', 'Set-up work',
    'Alarm gong', 'Alarm hammer', 'Alarm striking wheel', 'Alarm barrel', 'Alarm governor',
    'Alarm governor anchor', 'Alarm click', 'Alarm lock', 'Alarm switch', 'Alarm link',
    'Alarm winding train', 'Three-quarter plate'];
  const meshes = [];
  for (const e of clock.labelEntries) {
    if (MOVES.includes(e.name)) continue;
    e.obj.traverse((o) => {
      if (!o.isMesh || o.userData.schematic || !o.geometry?.attributes?.position) return;
      const bb = new THREE.Box3().setFromObject(o, true);
      if (!bb.isEmpty()) meshes.push({ unit: e.name, mesh: o.name || o.geometry.type, bb });
    });
  }
  // The drum as built, read back so the sweep uses the shipped dimensions.
  const drum = new THREE.Box3();
  const drumUnit = clock.labelEntries.find((e) => e.name === 'Mainspring drum');
  drumUnit.obj.traverse((o) => { if (o.isMesh && !o.userData.schematic) drum.union(new THREE.Box3().setFromObject(o, true)); });
  const chain = new THREE.Box3();
  const chainUnit = clock.labelEntries.find((e) => e.name === 'Chain');
  chainUnit.obj.traverse((o) => { if (o.isMesh && !o.userData.schematic) chain.union(new THREE.Box3().setFromObject(o, true)); });
  const dc = { x: (drum.min.x + drum.max.x) / 2, y: (drum.min.y + drum.max.y) / 2 };
  const DRUM_R = Math.max(drum.max.x - drum.min.x, drum.max.y - drum.min.y) / 2;
  const CD = Math.hypot(dc.x - P.barrel.x, dc.y - P.barrel.y);
  const drumZ = [drum.min.z, drum.max.z], chainZ = [chain.min.z, chain.max.z];
  out.push(`fusee at (${f(P.barrel.x)}, ${f(P.barrel.y)}); drum r ${f(DRUM_R)} at CD ${f(CD)},`
    + ` band ${f(drumZ[0])}..${f(drumZ[1])}; chain band ${f(chainZ[0])}..${f(chainZ[1])}`);
  out.push(`today's azimuth ${(Math.atan2(dc.y - P.barrel.y, dc.x - P.barrel.x) * 180 / Math.PI).toFixed(1)}deg`);

  // distance from a point to a box in XY (0 inside)
  const dToBox = (x, y, b) => Math.hypot(Math.max(b.min.x - x, x - b.max.x, 0), Math.max(b.min.y - y, y - b.max.y, 0));
  // distance from a segment to a box in XY, sampled along the span
  const segToBox = (ax, ay, bx, by, b) => {
    let d = Infinity;
    for (let t = 0; t <= 1; t += 1 / 64) d = Math.min(d, dToBox(ax + (bx - ax) * t, ay + (by - ay) * t, b));
    return d;
  };
  const inBand = (b, band) => b.min.z < band[1] && b.max.z > band[0];
  const drumObs = meshes.filter((m) => inBand(m.bb, drumZ));
  const chainObs = meshes.filter((m) => inBand(m.bb, chainZ));
  out.push(`obstacles sharing the drum's band: ${drumObs.length} meshes; the chain's: ${chainObs.length}`);

  const rows = [];
  for (let deg = 0; deg < 360; deg += 1) {
    const a = deg * Math.PI / 180;
    const cx = P.barrel.x + Math.cos(a) * CD, cy = P.barrel.y + Math.sin(a) * CD;
    let worst = Infinity, who = '';
    for (const m of drumObs) {
      const gap = dToBox(cx, cy, m.bb) - DRUM_R;
      if (gap < worst) { worst = gap; who = m.unit; }
    }
    // the chain span, drum edge to cone, as a corridor
    let cWorst = Infinity, cWho = '';
    for (const m of chainObs) {
      const gap = segToBox(cx, cy, P.barrel.x, P.barrel.y, m.bb);
      if (gap < cWorst) { cWorst = gap; cWho = m.unit; }
    }
    const rim = plateR - (Math.hypot(cx, cy) + DRUM_R);
    rows.push({ deg, cx, cy, worst, who, cWorst, cWho, rim });
  }
  // Report every azimuth that clears everything, and the best few overall.
  const okRows = rows.filter((r) => r.worst >= MARGIN && r.rim >= MARGIN && r.cWorst >= MARGIN);
  out.push(`=== azimuths where the drum clears its band AND stays on the plate: ${okRows.length} of 360 ===`);
  let run = null;
  const runs = [];
  for (const r of rows) {
    const good = okRows.includes(r);
    if (good && !run) run = { a: r.deg, best: r };
    if (good && run && r.worst > run.best.worst) run.best = r;
    if (!good && run) { runs.push({ ...run, b: r.deg - 1 }); run = null; }
  }
  if (run) runs.push({ ...run, b: 359 });
  for (const s of runs)
    out.push(`  ${String(s.a).padStart(3)}..${String(s.b).padStart(3)} deg  best at ${s.best.deg}: centre (${f(s.best.cx)}, ${f(s.best.cy)})`
      + `  drum gap ${f(s.best.worst)} (${s.best.who})  chain-span gap ${f(s.best.cWorst)} (${s.best.cWho})  rim ${f(s.best.rim)}`);
  if (!runs.length) {
    out.push('  NONE — the binding obstacle by azimuth (every 15 deg):');
    for (const r of rows.filter((r) => r.deg % 15 === 0))
      out.push(`   ${String(r.deg).padStart(3)} drum ${f(r.worst).padStart(7)} (${r.who})  chain ${f(r.cWorst).padStart(7)} (${r.cWho})  rim ${f(r.rim)}`);
  }
  return out;
});
console.log(res.join('\n'));
await browser.close();
srv.kill();
