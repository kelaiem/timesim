// Can the alarm striking module be LOWERED UNDER the three-quarter plate?
//
// The question is P3 (the group fits the movement), so it is answered in
// position space with three measurements, not by reading prose:
//
//   1. THE STACK. Every module mesh above the plate top, sorted by z, plus an
//      occupancy scan — how much of the module's height is metal and how much
//      is air a re-derivation could squeeze out.
//   2. THE COLUMN. For each module mesh, the tallest foreign thing standing
//      under it below the plate: the ceiling the module would land on if it
//      were dropped straight down where it stands.
//   3. THE PLAN. A free-height map of the whole under-plate band — how deep a
//      pocket the movement offers in each sector, so a re-siting can be
//      argued against measured space rather than against the picture.
//
// Run: cd tools && node probe-alarm-under-plate.mjs
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
  // The plate's own band, read off the built plate rather than restated.
  const plate = clock.labelEntries.find((e) => e.name === 'Three-quarter plate');
  const plateBox = new THREE.Box3().setFromObject(plate.obj);
  const TQ_BOT = plateBox.min.z, TQ_TOP = plateBox.max.z;
  // The module: the action group that stands on the plate's top face. The
  // three that reach across the movement (switch, link, winding train) are
  // members too, but their z is set at the other end, so they are excluded
  // from the stack and from the map's obstacles alike.
  const MODULE = ['Alarm gong', 'Alarm hammer', 'Alarm striking wheel', 'Alarm barrel',
    'Alarm governor', 'Alarm governor anchor', 'Alarm click', 'Alarm lock'];
  const SPANNING = ['Alarm switch', 'Alarm link', 'Alarm winding train'];

  const all = [];
  for (const e of clock.labelEntries) {
    e.obj.traverse((o) => {
      if (!o.isMesh || o.userData.schematic || !o.geometry?.attributes?.position) return;
      const bb = new THREE.Box3().setFromObject(o);
      if (!bb.isEmpty()) all.push({ unit: e.name, mesh: o.name || o.geometry.type, bb, obj: o });
    });
  }
  const mod = all.filter((m) => MODULE.includes(m.unit) && m.bb.min.z > TQ_TOP - 0.6);

  // --- 1. THE STACK -------------------------------------------------------
  out.push(`plate band ${f(TQ_BOT)}..${f(TQ_TOP)}; under-plate band 0..${f(TQ_BOT)} = ${f(TQ_BOT)} deep`);
  out.push('=== 1. THE STACK — module meshes above the plate top, by z0 ===');
  for (const m of [...mod].sort((a, b) => a.bb.min.z - b.bb.min.z))
    out.push(`  z ${f(m.bb.min.z).padStart(6)}..${f(m.bb.max.z).padStart(6)}  ${m.unit.padEnd(22)} ${m.mesh}`);
  const z1 = Math.max(...mod.map((m) => m.bb.max.z));
  let run = null, air = 0;
  const runs = [];
  for (let z = TQ_TOP; z < z1; z += 0.05) {
    const busy = mod.some((m) => m.bb.min.z < z + 0.05 && m.bb.max.z > z);
    if (!run || run.busy !== busy) { if (run) runs.push({ ...run, b: z }); run = { busy, a: z }; }
  }
  if (run) runs.push({ ...run, b: z1 });
  for (const r of runs) { if (!r.busy) air += r.b - r.a; out.push(`  ${r.busy ? 'METAL' : 'AIR  '} ${f(r.a)}..${f(r.b)}  (${f(r.b - r.a)})`); }
  out.push(`  stack ${f(TQ_TOP)}..${f(z1)} = ${f(z1 - TQ_TOP)} tall, of which ${f(air)} is air`);
  out.push(`  lowest free-standing member ${f(Math.min(...mod.filter((m) => m.bb.min.z > TQ_TOP).map((m) => m.bb.min.z)))} — the plate top is ${f(TQ_TOP)}`);

  // --- 2. THE COLUMN ------------------------------------------------------
  out.push('=== 2. THE COLUMN — what stands under each module mesh, below the plate ===');
  const perUnit = new Map();
  for (const m of mod) {
    let best = null;
    for (const o of all) {
      if (MODULE.includes(o.unit) || SPANNING.includes(o.unit) || o.unit === 'Three-quarter plate') continue;
      if (o.bb.min.z > TQ_BOT - 1e-3) continue;
      if (o.bb.max.x < m.bb.min.x || o.bb.min.x > m.bb.max.x) continue;
      if (o.bb.max.y < m.bb.min.y || o.bb.min.y > m.bb.max.y) continue;
      const top = Math.min(o.bb.max.z, TQ_BOT);
      if (!best || top > best.top) best = { top, unit: o.unit, mesh: o.mesh };
    }
    const rows = perUnit.get(m.unit) || [];
    rows.push({ mesh: m.mesh, free: TQ_BOT - (best ? best.top : 0), best });
    perUnit.set(m.unit, rows);
  }
  for (const [unit, rows] of perUnit) {
    rows.sort((a, b) => a.free - b.free);
    const w = rows[0];
    out.push(`  ${unit.padEnd(22)} tightest free band ${f(w.free)} under ${w.best ? w.best.unit + '/' + w.best.mesh + ' @ ' + f(w.best.top) : 'the bare base plate'}`);
  }

  // --- 3. THE PLAN --------------------------------------------------------
  const R = clock.plateR;
  const obstacles = all.filter((o) => !MODULE.includes(o.unit) && !SPANNING.includes(o.unit)
    && o.unit !== 'Three-quarter plate' && o.bb.min.z <= TQ_BOT && o.bb.max.z >= 0);
  const N = 45, step = (2 * R) / N;
  out.push(`=== 3. THE PLAN — free height under the plate, ${N}x${N} grid (cell ${f(step)} u) ===`);
  out.push('  # <1   + 1-2   o 2-4   . 4-6   (blank) >6   · off the plate');
  const fill = [], mapMod = [];
  for (let j = 0; j < N; j++) {
    fill.push([]);
    for (let i = 0; i < N; i++) {
      const x0 = -R + i * step, y0 = -R + j * step;
      let top = 0;
      for (const o of obstacles) {
        if (o.bb.max.x < x0 || o.bb.min.x > x0 + step || o.bb.max.y < y0 || o.bb.min.y > y0 + step) continue;
        top = Math.max(top, Math.min(o.bb.max.z, TQ_BOT));
      }
      fill[j][i] = top;
    }
  }
  // The module's own footprint, marked on the map with `_`, so the plan and
  // the space it would have to fall into are read in ONE picture.
  //
  // Measured PRECISELY (Box3.setFromObject's second argument), per mesh, and
  // that is not fussiness: the cheap path transforms a geometry's local box
  // by the object's matrix, so a mesh rotated about z reports the AABB OF A
  // ROTATED AABB. The gong is a 90° torus arc rotated 45° into place — read
  // cheaply it claims y up to 50.2 on a 35-radius arc, √2 too far, and paints
  // the whole northern sector as module. Every z figure above is immune (a
  // z-rotation cannot move a z extent); only this plan view is not.
  const modFoot = mod.map((m) => new THREE.Box3().setFromObject(m.obj, true));
  const modBox = new THREE.Box3();
  for (const b of modFoot) modBox.union(b);
  for (let j = N - 1; j >= 0; j--) {
    let line = '  ';
    for (let i = 0; i < N; i++) {
      const cx = -R + (i + 0.5) * step, cy = -R + (j + 0.5) * step;
      if (Math.hypot(cx, cy) > R) { line += '·'; continue; }
      const free = TQ_BOT - fill[j][i];
      const ch = free < 1 ? '#' : free < 2 ? '+' : free < 4 ? 'o' : free < 6 ? '.' : ' ';
      if (modFoot.some((b) => cx >= b.min.x && cx <= b.max.x && cy >= b.min.y && cy <= b.max.y))
        (mapMod[j] ||= [])[i] = true;
      line += ch;
    }
    out.push(line);
  }
  out.push('  ...and the module\'s own plan silhouette over the same grid (M):');
  for (let j = N - 1; j >= 0; j--) {
    let line = '  ';
    for (let i = 0; i < N; i++) {
      const cx = -R + (i + 0.5) * step, cy = -R + (j + 0.5) * step;
      line += Math.hypot(cx, cy) > R ? '·' : (mapMod[j] && mapMod[j][i]) ? 'M' : ' ';
    }
    out.push(line);
  }
  out.push(`  module footprint x ${f(modBox.min.x)}..${f(modBox.max.x)} y ${f(modBox.min.y)}..${f(modBox.max.y)}`
    + ` = ${f(modBox.max.x - modBox.min.x)} x ${f(modBox.max.y - modBox.min.y)}`);
  return out;
});
console.log(res.join('\n'));
await browser.close();
srv.kill();
