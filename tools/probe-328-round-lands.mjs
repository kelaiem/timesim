// §328 step 1 — the ROUND build on integrated lands (`?frame=lands`): do the lands stand on the pillars' own seats, and
// does nothing but the back plate's screw metal come within CLEAR_MARGIN of them over the pose net?
//
// Why this exists. A land is a child of the base plate, a HELD fixture, so it is in no pair sweep. The one gate that
// measures foreign metal against it is `plateSeats`, and that gate EXCUSES every mesh with a PLATE_SEATS row — the case
// clamp screws among them (`fastened`, through the rim's bores). On the round plate the lands stand inside the rim's
// 1 mm seat band (where §328 found PLATE_RIM reading a land as the rim's back face), which is exactly where those clamp
// heads seat, so a land fouling a clamp head would pass `plateSeats` in silence. This measures the lands ALONE, every
// labelled mesh of the movement against each land's solid at §152's pose net (`digestPoses`), with no excuse table
// except the one the frame is made of: the back plate's own screw rings, screws and slab, which bear on the lands.
//
// Acceptance, each with its control:
//   1. The default build has the `pillars` unit and no land; the lands build has four lands and no `pillars` unit.
//   2. SEATS: each land's axis is a pillar's axis on the default build, to 1e-9 (the land takes the pillar's seat, so
//      every later siting solve reads the same `pillarSeats`). Control: the two seat lists read from the SAME build
//      are not a test, so the default's are read off the pillar meshes and the lands' off the land meshes, two boots.
//   3. RIM: PLATE_RIM as measured (`__clock.plateRim`: the rim's front and back faces and reach — the back face is the
//      case clamp heads' seat and the gong's annulus floor, GONG_RIM_Z) is the default's on the lands build to float
//      noise. A land read as rim lifted the back face to the land's top and drove the gong's post negative (§328's first
//      finding); control: the lands build's land tops stand ABOVE the rim's back face, so a walk that read them would move it.
//   4. CLEAR: every labelled mesh outside the back plate's screw set stands ≥ CLEAR_MARGIN off every land at every pose,
//      and the case clamp screws are reported by name. Must-hit control: the screw shanks read in contact (≤ 0) with
//      the lands (they thread the lands' tapped bores), so the sweep cannot pass by measuring nothing. Must-fire
//      control: land 0 carried along the line to its nearest foreign mesh by the gap it read, plus CLEAR_MARGIN, must
//      then read under CLEAR_MARGIN against that mesh, and restored must read its gap again.
//
// Run: node tools/probe-328-round-lands.mjs  (needs `npm ci` in tools/; boots two builds, ~2–4 min).
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8000 + Math.floor(Math.random() * 900);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch();
const failures = [];
const fail = (m) => { failures.push(m); console.log('FAIL ' + m); };
const pass = (m) => console.log('PASS ' + m);

async function boot(q) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const warns = [];
  page.on('pageerror', (e) => warns.push('PAGEERROR ' + String(e)));
  await page.goto(`http://127.0.0.1:${PORT}/index.html?trial=1${q ? '&' + q : ''}`, { waitUntil: 'load', timeout: 300000 });
  await page.waitForFunction(() => !!window.__clock || !!window.__bootError, null, { timeout: 300000 });
  const err = await page.evaluate(() => window.__bootError ? String(window.__bootError.message) : null);
  if (err) throw new Error(`boot ${q || '(default)'} died: ${err}`);
  const bootWarns = await page.evaluate(() => (window.__clock.bootWarns || []).slice());
  return { page, ctx, warns: [...warns, ...bootWarns] };
}

// What both builds report about their frame: the label roster's `pillars`, the pillar and land axes, the gong's post.
const FRAME = () => {
  const c = window.__clock;
  c.scene.updateMatrixWorld(true);
  const axes = (pred) => {
    const out = [];
    c.movement.traverse((o) => { if (o.isMesh && pred(o)) { const p = o.getWorldPosition(new o.position.constructor()); out.push([p.x, p.y]); } });
    return out.sort((a, b) => Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0]));
  };
  return {
    hasPillarsUnit: c.labelEntries.some((e) => e.name === 'pillars'),
    pillars: axes((o) => o.name === 'pillar'),
    lands: axes((o) => !!o.userData.rimLand),
    rim: c.plateRim ?? null,
    landTop: (() => { let t = -Infinity; c.movement.traverse((o) => { if (o.isMesh && o.userData.rimLand) { o.geometry.computeBoundingBox(); t = Math.max(t, o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld).max.z); } }); return t; })(),
  };
};

const A = await boot('');
const fa = await A.page.evaluate(FRAME);
await A.ctx.close();
const B = await boot('frame=lands');
const fb = await B.page.evaluate(FRAME);

// 1 — the roster
if (fa.hasPillarsUnit && fa.pillars.length === 4 && fa.lands.length === 0) pass('default: the `pillars` unit, four pillars, no land');
else fail(`default: pillars unit ${fa.hasPillarsUnit}, ${fa.pillars.length} pillars, ${fa.lands.length} lands — want true, 4, 0`);
if (!fb.hasPillarsUnit && fb.pillars.length === 0 && fb.lands.length === 4) pass('frame=lands: four lands, no `pillars` unit');
else fail(`frame=lands: pillars unit ${fb.hasPillarsUnit}, ${fb.pillars.length} pillars, ${fb.lands.length} lands — want false, 0, 4`);
if (B.warns.length) fail(`frame=lands boot is not silent: ${B.warns.join(' | ')}`); else pass('frame=lands boots silent');
if (A.warns.length) fail(`default boot is not silent: ${A.warns.join(' | ')}`);

// 2 — the seats
if (fa.pillars.length === 4 && fb.lands.length === 4) {
  const d = Math.max(...fa.pillars.map((p, i) => Math.hypot(p[0] - fb.lands[i][0], p[1] - fb.lands[i][1])));
  const fmt = (L) => L.map(([x, y]) => `(${x.toFixed(3)}, ${y.toFixed(3)})`).join(' ');
  if (d <= 1e-9) pass(`each land stands on a pillar's seat (worst ${d.toExponential(1)}): ${fmt(fb.lands)}`);
  else fail(`a land is off its pillar's seat by ${d.toFixed(6)}: pillars ${fmt(fa.pillars)} / lands ${fmt(fb.lands)}`);
}

// 3 — the rim the case and the gong seat on
if (!fa.rim || !fb.rim) fail(`__clock.plateRim not published (default ${!!fa.rim}, lands ${!!fb.rim})`);
else {
  const moved = ['front', 'back', 'reach'].filter((k) => Math.abs(fa.rim[k] - fb.rim[k]) > 1e-9);
  if (!(fb.landTop > fb.rim.back + 1)) fail(`control: the land tops (${fb.landTop}) do not stand above the rim's back face (${fb.rim.back}) — a walk that read them would not move it, so this check tests nothing`);
  else if (moved.length) fail(`PLATE_RIM moved with the frame (${moved.map((k) => `${k} ${fa.rim[k]} → ${fb.rim[k]}`).join(', ')}): the rim walk is reading a land`);
  else pass(`PLATE_RIM is the default's (back ${fb.rim.back.toFixed(4)}, reach ${fb.rim.reach.toFixed(4)}) with the land tops at ${fb.landTop.toFixed(3)} above it: the rim walk does not read the lands`);
}

// 4 — the clearance sweep
const sweep = await B.page.evaluate(async () => {
  const I = await import('./src/inspect.js');
  const { CLEAR_MARGIN } = await import('./src/layout.js');
  const c = window.__clock;
  const BEARS = new Set(['plateScrewLand', 'screwShanks', 'screwHeads', 'threeQuarterPlate']);   // the back plate's screw set
  const lands = [];
  c.movement.traverse((o) => { if (o.isMesh && o.userData.rimLand) lands.push(o); });
  // every labelled mesh, owned by its NEAREST label (§40's rule); the held plate and its lands are no unit's
  const labelOf = new Map(c.labelEntries.map((e) => [e.obj, e.name]));
  const entries = [];
  for (const { obj } of c.labelEntries) {
    const walk = (o) => {
      if (o.userData?.schematic) return;
      if (o.isMesh && o.geometry?.attributes?.position && !o.userData.rimLand) {
        let p = o; while (p && !labelOf.has(p)) p = p.parent;
        if (p === obj) entries.push({ unit: labelOf.get(obj), mesh: o, name: o.name || o.geometry.type });
      }
      for (const ch of o.children) walk(ch);
    };
    walk(obj);
  }
  const poses = I.digestPoses(c);
  const bL = lands.map(() => new c.scene.position.constructor()), boxes = lands.map(() => null);   // scratch centres, per-pose boxes
  const Box3 = (await import('./vendor/three.module.js')).Box3;
  const rows = new Map();
  const bM = new Box3();
  for (let pi = 0; pi < poses.length; pi++) {
    c.resetInputs(); c.setPose(poses[pi]); c.scene.updateMatrixWorld(true);
    lands.forEach((l, i) => { boxes[i] = new Box3().setFromObject(l); });
    for (const e of entries) {
      bM.setFromObject(e.mesh);
      for (let i = 0; i < lands.length; i++) {
        const gx = Math.max(boxes[i].min.x - bM.max.x, bM.min.x - boxes[i].max.x, 0);
        const gy = Math.max(boxes[i].min.y - bM.max.y, bM.min.y - boxes[i].max.y, 0);
        const gz = Math.max(boxes[i].min.z - bM.max.z, bM.min.z - boxes[i].max.z, 0);
        if (Math.hypot(gx, gy, gz) >= 2 * CLEAR_MARGIN) continue;
        const d = I.meshClearance(e.mesh, lands[i], 2 * CLEAR_MARGIN);
        const key = `${i}|${e.unit} / ${e.name}`;
        const r = rows.get(key);
        if (!r || d < r.min) rows.set(key, { land: i, unit: e.unit, mesh: e.name, min: d, pose: pi, bears: e.unit === 'Three-quarter plate' && BEARS.has(e.mesh.name) });
      }
    }
    if (pi % 8 === 7) await new Promise((r) => setTimeout(r, 0));
  }
  // the clamp screws by name, wherever they stand (the case unit)
  let clamp = Infinity;
  for (const e of entries) if (e.mesh.name === 'caseClampScrew') {
    c.resetInputs(); c.setPose(poses[0]); c.scene.updateMatrixWorld(true);
    for (const l of lands) clamp = Math.min(clamp, I.meshClearance(e.mesh, l));
  }
  // must-fire: carry land 0 toward its nearest foreign mesh by the gap read plus CLEAR_MARGIN
  const foreign0 = [...rows.values()].filter((r) => r.land === 0 && !r.bears).sort((a, b) => a.min - b.min)[0] ?? null;
  let control = null;
  {
    c.resetInputs(); c.setPose(poses[0]); c.scene.updateMatrixWorld(true);
    // the nearest foreign mesh to land 0 at the build pose, over every labelled mesh (not just those within the sweep's reach)
    let best = null;
    for (const e of entries) {
      if (e.unit === 'Three-quarter plate' && BEARS.has(e.mesh.name)) continue;
      const d = I.meshClearance(e.mesh, lands[0], 20);
      if (!best || d < best.d) best = { e, d };
    }
    const l = lands[0];
    const cen = new Box3().setFromObject(best.e.mesh).getCenter(bL[0]);
    const ax = l.getWorldPosition(new l.position.constructor());
    const dx = cen.x - ax.x, dy = cen.y - ax.y, n = Math.hypot(dx, dy) || 1;
    const step = best.d + CLEAR_MARGIN;
    const x0 = l.position.x, y0 = l.position.y;
    l.position.x += dx / n * step; l.position.y += dy / n * step; l.updateMatrixWorld(true);
    const moved = I.meshClearance(best.e.mesh, l);
    l.position.x = x0; l.position.y = y0; l.updateMatrixWorld(true);
    const back = I.meshClearance(best.e.mesh, l);
    control = { target: `${best.e.unit} / ${best.e.name}`, gap: best.d, step, moved, back };
  }
  return { margin: CLEAR_MARGIN, poses: poses.length, population: entries.length, rows: [...rows.values()], clamp, foreign0, control };
});
await B.ctx.close();

const M = sweep.margin;
const bears = sweep.rows.filter((r) => r.bears);
const foreign = sweep.rows.filter((r) => !r.bears).sort((a, b) => a.min - b.min);
const shankHit = bears.filter((r) => r.mesh === 'screwShanks' && r.min <= 0).length;
if (shankHit === 4) pass(`must-hit: the back plate's screw shanks read in contact with all four lands (threaded in their bores)`);
else fail(`must-hit: the screw shanks read in contact with ${shankHit} of 4 lands — the sweep is not reaching the lands`);
const c = sweep.control;
if (c && c.moved < M && Math.abs(c.back - c.gap) < 1e-9)
  pass(`must-fire: land 0 carried ${c.step.toFixed(3)} toward ${c.target} (gap ${c.gap.toFixed(3)}) reads ${c.moved.toFixed(3)} < ${M}; restored reads its gap`);
else fail(`must-fire: land 0 carried toward ${c?.target} read ${c?.moved} (want < ${M}), restored ${c?.back} against ${c?.gap}`);
const under = foreign.filter((r) => r.min < M);
if (under.length) fail(`${under.length} foreign mesh(es) within CLEAR_MARGIN of a land: ${under.map((r) => `land ${r.land} ⇄ ${r.unit} / ${r.mesh} ${r.min.toFixed(4)} @pose ${r.pose}`).join('; ')}`);
else pass(`no foreign metal within CLEAR_MARGIN of any land over ${sweep.poses} poses × ${sweep.population} meshes; nearest: ${foreign.slice(0, 3).map((r) => `land ${r.land} ⇄ ${r.unit} / ${r.mesh} ${r.min.toFixed(3)}`).join('; ') || 'none within 2·CLEAR_MARGIN'}`);
if (sweep.clamp >= M) pass(`the case clamp screws stand ${sweep.clamp.toFixed(3)} off the nearest land (the rim's seat band, which plateSeats excuses)`);
else fail(`a case clamp screw stands ${sweep.clamp.toFixed(4)} off a land, under CLEAR_MARGIN ${M}`);

await browser.close();
srv.kill();
console.log(failures.length ? `\n${failures.length} FAILURE(S)` : '\nALL PASS');
process.exit(failures.length ? 1 : 0);
