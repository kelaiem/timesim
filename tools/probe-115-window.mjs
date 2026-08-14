// §115 — the governor window, read off a real boot: what the solve wanted,
// what the keep field left, which keep binds where, and how much of the
// governor the finished plate actually shows.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const port = process.env.PORT || '8473';
const root = process.env.ROOT || '..';     // point at a base worktree to take the same numbers there
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
const warns = [];
page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') warns.push(m.text()); });
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });

const out = await page.evaluate(async () => {
  const clock = window.__clock;
  const THREE = await import('./vendor/three.module.js');
  const rows = clock.tqWindows.map((r) => ({
    name: r.name,
    c: [+r.c.x.toFixed(3), +r.c.y.toFixed(3)],
    discs: (r.discs || []).map((d) => [+d.x.toFixed(3), +d.y.toFixed(3), +d.r.toFixed(3)]),
    wanted: +r.wanted.toFixed(3),
    r0: +r.r0.toFixed(3),
    boss: r.boss,
    cut: r.cut,
    sectors: r.sectors.length,
    rOut: r.rOut.slice(),                 // FULL precision — a bit-identity claim cannot be made off toFixed
    r0raw: r.r0,
    // the reveal this bearing WANTED — the ray's exit from the union, so
    // "at full reach" means the keeps took nothing here, not that the
    // window hit the scalar bound.
    want: Array.from({ length: 360 }, (_, i) => {
      const a = i * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a);
      let w = 0;
      for (const d of (r.discs || [{ x: r.c.x, y: r.c.y, r: r.wanted }])) {
        const px = d.x - r.c.x, py = d.y - r.c.y;
        if (px === 0 && py === 0) { w = Math.max(w, d.r); continue; }
        const t = px * cs + py * sn;
        const h2 = d.r * d.r - (px * px + py * py) + t * t;
        if (h2 <= 0) continue;
        w = Math.max(w, t + Math.sqrt(h2));
      }
      // FULL precision, because rOut is full precision too. Rounding one side
      // and not the other turned "the keeps took nothing here" into a
      // coin-flip on the last digit — solveR returns `want` bit-exactly at an
      // unbitten bearing, so the comparison downstream is exact or nothing.
      return w;
    }),
  }));

  // What the window actually SHOWS. Raycast straight down (+z, the side the
  // three-quarter plate is on) from every vertex of the governor's own
  // meshes and count how many reach the outside without meeting the plate.
  const plate = clock.labelEntries.find((e) => e.name === 'Three-quarter plate');
  const govC = clock.tqWindows.find((r) => r.name === 'governor')?.c ?? { x: 0, y: 0 };
  const reveal = {};
  if (plate) {
    const targets = [];
    plate.obj.traverse((o) => { if (o.isMesh && !o.userData?.schematic) targets.push(o); });
    const ray = new THREE.Raycaster();
    ray.far = 1e4;
    const dir = new THREE.Vector3(0, 0, 1);
    const v = new THREE.Vector3();
    for (const unit of ['Alarm governor', 'Alarm governor anchor']) {
      const u = clock.labelEntries.find((e) => e.name === unit);
      if (!u) continue;
      u.obj.updateWorldMatrix(true, true);
      let seen = 0, total = 0;
      const covered = {};       // which mesh the still-hidden vertices belong to, and how far out they sit
      u.obj.traverse((o) => {
        if (!o.isMesh || o.userData?.schematic || !o.geometry?.attributes?.position) return;
        const pos = o.geometry.attributes.position;
        const step = Math.max(1, Math.floor(pos.count / 4000));
        for (let i = 0; i < pos.count; i += step) {
          v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
          total++;
          ray.set(v, dir);
          if (ray.intersectObjects(targets, false).length === 0) seen++;
          else {
            const c = covered[o.name] ??= { n: 0, minAz: 999, maxAz: -999 };
            c.n++;
            // …off the governor window's OWN centre, read from the solve
            // rather than typed: §120 moved that centre from the midpoint
            // between the two axes onto the anchor's, and a literal here
            // would have kept reporting bearings about a point the window is
            // no longer at.
            const az = Math.atan2(v.y - govC.y, v.x - govC.x) * 180 / Math.PI;
            c.minAz = Math.min(c.minAz, (az + 360) % 360);
            c.maxAz = Math.max(c.maxAz, (az + 360) % 360);
          }
        }
      });
      reveal[unit] = { total, seen, pct: total ? +(100 * seen / total).toFixed(1) : null, covered };
    }
  }
  // The pillar stations, because ALARM_UNDER_FOOTPRINT's corrected ring disc
  // is a bound the pillar scan consumes — a seat that moved is the thing that
  // moves the fingerprint, not the window.
  const pillars = [];
  const pu = clock.labelEntries.find((e) => e.name === 'pillars');
  if (pu) {
    pu.obj.updateWorldMatrix(true, true);
    pu.obj.traverse((o) => {
      if (o.isMesh && o.name === 'pillar') pillars.push([+o.position.x.toFixed(4), +o.position.y.toFixed(4)]);
    });
  }
  return { rows, reveal, pillars };
});

console.log('=== boot warnings ===');
if (!warns.length) console.log('(silent)');
for (const w of warns) console.log(' ', w);

console.log('\n=== windows ===');
for (const r of out.rows) {
  console.log(`\n'${r.name}'  centre ${r.c.join(', ')}  wanted ${r.wanted}  r0 ${r.r0}  boss ${r.boss}  cut ${r.cut}  sectors ${r.sectors}`);
  if (r.discs.length) console.log(`  discs: ${r.discs.map((d) => `(${d[0]}, ${d[1]}) r ${d[2]}`).join('  ')}`);
  const open = r.rOut.filter((x) => x > 0).length;
  const atWant = r.rOut.filter((x, i) => x >= r.want[i] - 1e-9).length;
  const min = Math.min(...r.rOut.filter((x) => x > 0));
  let bite = 0, worstBite = 0, worstAt = -1;
  for (let i = 0; i < 360; i++) {
    const d = r.want[i] - r.rOut[i];
    if (d > 1e-9) { bite++; if (d > worstBite) { worstBite = d; worstAt = i; } }
  }
  // The opening's AREA, ½∮r²dθ over the solved reveal — what the plate
  // actually gives up, as opposed to how far the window reaches. §120 wanted
  // this and a radius could not answer it: two windows with the same reach
  // take very different amounts of plate.
  const area = r.rOut.reduce((s, x) => s + 0.5 * x * x * (Math.PI / 180), 0);
  const wantArea = r.want.reduce((s, x) => s + 0.5 * x * x * (Math.PI / 180), 0);
  console.log(`  bearings: ${open}/360 open, ${atWant} at full reach, min open ${min.toFixed(3)}`);
  console.log(`  area: ${area.toFixed(1)} cut, ${wantArea.toFixed(1)} wanted (the keeps take ${(wantArea - area).toFixed(1)})`);
  console.log(`  keeps bite ${bite} bearings, worst ${worstBite.toFixed(3)} at ${worstAt}°`);
  // the pinched bearings, run-length encoded
  const closed = [];
  for (let i = 0; i < 360; i++) if (r.rOut[i] <= 0) closed.push(i);
  if (closed.length) console.log(`  closed at: ${closed.join(',')}`);
  if (r.name === 'governor') {
    const t = [];
    for (let i = 0; i < 360; i += 10) t.push(`${i}:${r.rOut[i].toFixed(2)}`);
    console.log(`  rOut/10°: ${t.join(' ')}`);
  }
}

console.log('\n=== reveal (vertices with a clear path out through +z) ===');
for (const [k, v] of Object.entries(out.reveal)) {
  console.log(`  ${k.padEnd(24)} ${v.seen}/${v.total} = ${v.pct}%`);
  for (const [m, c] of Object.entries(v.covered || {}))
    console.log(`      still covered: ${m} ×${c.n}  at bearings ${c.minAz.toFixed(0)}–${c.maxAz.toFixed(0)}° off the window's centre`);
}

console.log('\n=== pillar stations ===');
for (const p of out.pillars) console.log(`  ${p[0]}, ${p[1]}`);

if (process.env.DUMP) {
  const fs = await import('node:fs');
  fs.writeFileSync(process.env.DUMP, JSON.stringify({
    rOut: Object.fromEntries(out.rows.map((r) => [r.name, r.rOut])),
    r0raw: Object.fromEntries(out.rows.map((r) => [r.name, r.r0raw])),
    r0: Object.fromEntries(out.rows.map((r) => [r.name, r.r0])),
    reveal: out.reveal, pillars: out.pillars,
  }, null, 1));
  console.log(`\nwrote ${process.env.DUMP}`);
}

await browser.close(); srv.kill();
