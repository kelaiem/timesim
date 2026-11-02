// §328 — THE FRAME ON LANDS, the default on every case kind since §328 step 2: do the lands stand where they should, and
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
// Three builds, the kinds whose seat rules differ: the ROUND default; the RECT form case at its swept seat's fit (the
// battery's `form-rect` point — every form kind but the free one scans its seats on the pillar's terms, TODO 271/272);
// and the FREE outline, whose lands keep §325 landing 6's own rim rule. `?frame=pillars` (the applied pillars, kept as
// a supported style) is booted beside the round and rect builds as the reference the lands must agree with.
//
// Acceptance, per build, each with its control:
//   1. ROSTER: the lands build has its lands and no `pillars` unit; the `?frame=pillars` build has the unit, its four
//      pillars and no land.
//   2. SEATS (round, rect): each land's axis is a pillar's axis on the `?frame=pillars` build, to 1e-9 — the land takes
//      the pillar's seat, so every later siting solve reads the same `pillarSeats`. The two lists come from two boots,
//      one read off the pillar meshes and one off the land meshes. The free build's lands sit by their own rule and are
//      reported, not compared.
//   3. RIM (round, rect): PLATE_RIM as measured (`__clock.plateRim`: the rim's front and back faces and reach — the back
//      face is the case clamp heads' seat and the gong's annulus floor, GONG_RIM_Z) is the pillar build's to 1e-9. A land
//      read as rim lifted the back face to the land's top and drove the gong's post negative (§328's first finding);
//      control: the land tops stand ABOVE the rim's back face, so a walk that read them would move it.
//   4. BOOT: the round default boots silent; a form build boots no warning its `?frame=pillars` twin does not (the rect
//      point's two declared rows are the form case's, not the frame's), and the free build is reported.
//   5. CLEAR: every labelled mesh outside the back plate's screw set stands ≥ CLEAR_MARGIN off every land at every pose,
//      and the case clamp screws (round only — a form case has none) are reported by name. Must-hit control: the screw
//      shanks read in contact (≤ 0) with every land (they thread its tapped bore), so the sweep cannot pass by measuring
//      nothing. Must-fire control: land 0 carried along the line to its nearest foreign mesh by the gap it read, plus
//      CLEAR_MARGIN, must then read under CLEAR_MARGIN against that mesh, and restored must read its gap again.
//
// Run: node tools/probe-328-lands.mjs  (needs `npm ci` in tools/; five boots and three sweeps, a few minutes).
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8000 + Math.floor(Math.random() * 900);
// The rect build is the battery's `form-rect` spec point (tools/ci-battery.mjs), written out because a spec row is a URL
const KINDS = [
  { name: 'round', q: '', twin: true, silent: true },
  { name: 'rect', q: 'case=rect&formrect=-45.72,45.72,-44.38,44.38', twin: true, silent: false },
  { name: 'free', q: 'case=free', twin: false, silent: false },
];
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch();
const failures = [];
const fail = (m) => { failures.push(m); console.log('FAIL ' + m); };
const pass = (m) => console.log('PASS ' + m);

async function boot(q) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + String(e)));
  await page.goto(`http://127.0.0.1:${PORT}/index.html?trial=1${q ? '&' + q : ''}`, { waitUntil: 'load', timeout: 300000 });
  await page.waitForFunction(() => !!window.__clock || !!window.__bootError, null, { timeout: 300000 });
  const err = await page.evaluate(() => window.__bootError ? String(window.__bootError.message) : null);
  if (err) throw new Error(`boot ${q || '(default)'} died: ${err}`);
  const warns = await page.evaluate(() => (window.__clock.bootWarns || []).map(String));
  return { page, ctx, warns: [...errs, ...warns] };
}

// What a build reports about its frame: the label roster's `pillars`, the pillar and land axes, the rim, the land tops.
const FRAME = () => {
  const c = window.__clock;
  c.scene.updateMatrixWorld(true);
  const axes = (pred) => {
    const out = [];
    c.movement.traverse((o) => { if (o.isMesh && pred(o)) { const p = o.getWorldPosition(new o.position.constructor()); out.push([p.x, p.y]); } });
    return out.sort((a, b) => Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0]));
  };
  let landTop = -Infinity;
  c.movement.traverse((o) => { if (o.isMesh && o.userData.rimLand) { o.geometry.computeBoundingBox(); landTop = Math.max(landTop, o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld).max.z); } });
  return { hasPillarsUnit: c.labelEntries.some((e) => e.name === 'pillars'), pillars: axes((o) => o.name === 'pillar'),
    lands: axes((o) => !!o.userData.rimLand), rim: c.plateRim ?? null, landTop };
};

// The clearance sweep, run in the lands build's page
const SWEEP = async () => {
  const I = await import('./src/inspect.js');
  const { CLEAR_MARGIN } = await import('./src/layout.js');
  const { Box3, Vector3 } = await import('./vendor/three.module.js');
  const c = window.__clock;
  const BEARS = new Set(['plateScrewLand', 'screwShanks', 'screwHeads', 'threeQuarterPlate']);   // the back plate's screw set
  const bears = (e) => e.unit === 'Three-quarter plate' && BEARS.has(e.mesh.name);
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
  const rows = new Map();
  const bM = new Box3(), bL = lands.map(() => new Box3());
  for (let pi = 0; pi < poses.length; pi++) {
    c.resetInputs(); c.setPose(poses[pi]); c.scene.updateMatrixWorld(true);
    lands.forEach((l, i) => bL[i].setFromObject(l));
    for (const e of entries) {
      bM.setFromObject(e.mesh);
      for (let i = 0; i < lands.length; i++) {
        const b = bL[i];
        const gap = Math.hypot(Math.max(b.min.x - bM.max.x, bM.min.x - b.max.x, 0), Math.max(b.min.y - bM.max.y, bM.min.y - b.max.y, 0),
          Math.max(b.min.z - bM.max.z, bM.min.z - b.max.z, 0));
        if (gap >= 2 * CLEAR_MARGIN) continue;
        const d = I.meshClearance(e.mesh, lands[i], 2 * CLEAR_MARGIN);
        const key = `${i}|${e.unit} / ${e.name}`;
        const r = rows.get(key);
        if (!r || d < r.min) rows.set(key, { land: i, unit: e.unit, mesh: e.name, min: d, pose: pi, bears: bears(e) });
      }
    }
    if (pi % 8 === 7) await new Promise((r) => setTimeout(r, 0));
  }
  c.resetInputs(); c.setPose(poses[0]); c.scene.updateMatrixWorld(true);
  // the case clamp screws by name (the round case's; a form case has none)
  let clamp = null;
  for (const e of entries) if (e.mesh.name === 'caseClampScrew') for (const l of lands) clamp = Math.min(clamp ?? Infinity, I.meshClearance(e.mesh, l));
  // must-fire: carry land 0 toward its nearest foreign mesh (over every labelled mesh at the build pose) by the gap read
  // plus CLEAR_MARGIN; it must then read under the margin, and restored read its gap again
  let best = null;
  for (const e of entries) {
    if (bears(e)) continue;
    const d = I.meshClearance(e.mesh, lands[0], 20);
    if (!best || d < best.d) best = { e, d };
  }
  const l = lands[0];
  const cen = new Box3().setFromObject(best.e.mesh).getCenter(new Vector3());
  const ax = l.getWorldPosition(new Vector3());
  const dx = cen.x - ax.x, dy = cen.y - ax.y, n = Math.hypot(dx, dy) || 1, step = best.d + CLEAR_MARGIN;
  const x0 = l.position.x, y0 = l.position.y;
  l.position.x += dx / n * step; l.position.y += dy / n * step; l.updateMatrixWorld(true);
  const moved = I.meshClearance(best.e.mesh, l);
  l.position.x = x0; l.position.y = y0; l.updateMatrixWorld(true);
  const back = I.meshClearance(best.e.mesh, l);
  return { margin: CLEAR_MARGIN, poses: poses.length, population: entries.length, lands: lands.length, rows: [...rows.values()], clamp,
    control: { target: `${best.e.unit} / ${best.e.name}`, gap: best.d, step, moved, back } };
};

const fmt = (L) => L.map(([x, y]) => `(${x.toFixed(3)}, ${y.toFixed(3)})`).join(' ');
for (const K of KINDS) {
  console.log(`\n=== ${K.name}${K.q ? ` (${K.q})` : ''} ===`);
  let T = null;
  if (K.twin) {
    const B = await boot(K.q ? `${K.q}&frame=pillars` : 'frame=pillars');
    T = { ...(await B.page.evaluate(FRAME)), warns: B.warns };
    await B.ctx.close();
  }
  const A = await boot(K.q);
  const L = await A.page.evaluate(FRAME);

  // 1 — the roster
  if (!L.hasPillarsUnit && L.pillars.length === 0 && L.lands.length >= 3) pass(`${K.name}: ${L.lands.length} lands, no \`pillars\` unit`);
  else fail(`${K.name}: pillars unit ${L.hasPillarsUnit}, ${L.pillars.length} pillars, ${L.lands.length} lands — want false, 0, ≥ 3`);
  if (T) {
    if (T.hasPillarsUnit && T.lands.length === 0 && T.pillars.length === L.lands.length) pass(`${K.name} ?frame=pillars: the \`pillars\` unit, ${T.pillars.length} pillars, no land`);
    else fail(`${K.name} ?frame=pillars: pillars unit ${T.hasPillarsUnit}, ${T.pillars.length} pillars, ${T.lands.length} lands — want true, ${L.lands.length}, 0`);
  }

  // 2 — the seats
  if (T && T.pillars.length === L.lands.length && L.lands.length) {
    const d = Math.max(...T.pillars.map((p, i) => Math.hypot(p[0] - L.lands[i][0], p[1] - L.lands[i][1])));
    if (d <= 1e-9) pass(`${K.name}: each land stands on its pillar's seat (worst ${d.toExponential(1)}): ${fmt(L.lands)}`);
    else fail(`${K.name}: a land is off its pillar's seat by ${d.toFixed(6)}: pillars ${fmt(T.pillars)} / lands ${fmt(L.lands)}`);
  } else if (!T) console.log(`  REPORT ${K.name}: lands by their own rule (§325 landing 6): ${fmt(L.lands)}`);

  // 3 — the rim
  if (T) {
    if (!L.rim || !T.rim) fail(`${K.name}: __clock.plateRim not published (lands ${!!L.rim}, pillars ${!!T.rim})`);
    else {
      const moved = ['front', 'back', 'reach'].filter((k) => Math.abs(L.rim[k] - T.rim[k]) > 1e-9);
      if (!(L.landTop > L.rim.back + 1)) fail(`${K.name} control: the land tops (${L.landTop}) do not stand above the rim's back face (${L.rim.back}) — a walk that read them would not move it, so this tests nothing`);
      else if (moved.length) fail(`${K.name}: PLATE_RIM moved with the frame (${moved.map((k) => `${k} ${T.rim[k]} → ${L.rim[k]}`).join(', ')}): the rim walk is reading a land`);
      else pass(`${K.name}: PLATE_RIM is the pillar frame's (back ${L.rim.back.toFixed(4)}, reach ${L.rim.reach.toFixed(4)}) with the land tops at ${L.landTop.toFixed(3)} above it`);
    }
  }

  // 4 — the boot
  if (K.silent) { if (A.warns.length) fail(`${K.name}: the default boot is not silent: ${A.warns.join(' | ')}`); else pass(`${K.name}: boots silent`); }
  else if (T) {
    const extra = A.warns.filter((w) => !T.warns.includes(w));
    if (extra.length) fail(`${K.name}: the lands build warns beyond its pillar twin: ${extra.join(' | ')}`);
    else pass(`${K.name}: no boot warning beyond its pillar twin's (${A.warns.length}, the form case's own)`);
  } else console.log(`  REPORT ${K.name}: ${A.warns.length} boot warning(s)${A.warns.length ? ': ' + A.warns.map((w) => w.slice(0, 90)).join(' | ') : ''}`);

  // 5 — the clearance sweep
  const S = await A.page.evaluate(SWEEP);
  await A.ctx.close();
  const M = S.margin;
  const foreign = S.rows.filter((r) => !r.bears).sort((a, b) => a.min - b.min);
  const shankHit = new Set(S.rows.filter((r) => r.bears && r.mesh === 'screwShanks' && r.min <= 0).map((r) => r.land)).size;
  if (shankHit === S.lands) pass(`${K.name} must-hit: the back plate's screw shanks read in contact with all ${S.lands} lands`);
  else fail(`${K.name} must-hit: the screw shanks read in contact with ${shankHit} of ${S.lands} lands — the sweep is not reaching them`);
  const c = S.control;
  if (c.moved < M && Math.abs(c.back - c.gap) < 1e-9) pass(`${K.name} must-fire: land 0 carried ${c.step.toFixed(3)} toward ${c.target} (gap ${c.gap.toFixed(3)}) reads ${c.moved.toFixed(3)} < ${M}; restored reads its gap`);
  else fail(`${K.name} must-fire: land 0 carried toward ${c.target} read ${c.moved} (want < ${M}), restored ${c.back} against ${c.gap}`);
  const under = foreign.filter((r) => r.min < M);
  if (under.length) fail(`${K.name}: ${under.length} foreign mesh(es) within CLEAR_MARGIN of a land: ${under.map((r) => `land ${r.land} ⇄ ${r.unit} / ${r.mesh} ${r.min.toFixed(4)} @pose ${r.pose}`).join('; ')}`);
  else pass(`${K.name}: no foreign metal within CLEAR_MARGIN of any land over ${S.poses} poses × ${S.population} meshes; nearest: ${foreign.slice(0, 3).map((r) => `land ${r.land} ⇄ ${r.unit} / ${r.mesh} ${r.min.toFixed(3)}`).join('; ') || 'none within 2·CLEAR_MARGIN'}`);
  if (S.clamp !== null) {
    if (S.clamp >= M) pass(`${K.name}: the case clamp screws stand ${S.clamp.toFixed(3)} off the nearest land (the rim's seat band, which plateSeats excuses)`);
    else fail(`${K.name}: a case clamp screw stands ${S.clamp.toFixed(4)} off a land, under CLEAR_MARGIN ${M}`);
  }
}

await browser.close();
srv.kill();
console.log(failures.length ? `\n${failures.length} FAILURE(S)` : '\nALL PASS');
process.exit(failures.length ? 1 : 0);
