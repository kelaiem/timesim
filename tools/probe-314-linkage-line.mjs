// WHERE DOES THE PUSHER LINKAGE'S ROD LINE RUN IN THIS ARRANGEMENT? — §314's
// re-run of §261 2c's linkage search, for a movement whose band the fold-site
// study can no longer site (its cluster already stands folded, so that study's
// rotation loop has nothing to search; its header says so under TODO 244).
//
// REPORT with fatal controls (exit 2 when a control fails). It moves no metal;
// the build reads its pick from ALARM_LINKAGE_LINES (main.js), keyed by the
// arrangement like the arming fixed point.
//
// METHOD. The linkage is the BUILD'S OWN LAW of its rod line
// (`__clock.alarmLinkage.at(dirDeg, c)`: crank A on the stem's normal 1:1,
// crank B on the folded track's bisector with its input arm closed onto the
// track's end), so nothing here restates the construction. Over the grid the
// fold-site search used (the line's direction every 1° over a half turn, its
// offset every 0.5 u across the case), a candidate is kept when its arms are
// at least s²/(8·CM) (the fold-site search's sag bound: an arm shorter sags off
// its chord by more than one margin over the stroke s) and at most half the
// case radius, its rod at least two margins, every joint and pivot inside the
// case less a margin — and when its SWEPT PLAN (`swept`, the build's own
// pieces: studs and hubs, arms and rod at every forward-kinematics step, crank
// B's pin shank along its arc, each at its own band) stands one CLEAR_MARGIN
// clear of the movement's metal as built. Ranked shortest first (two crank A
// arms, crank B's two, the rod): §261 2c's rule.
//
// THE METAL is every labelled mesh but the linkage's own (alarmLinkage*), the
// three-quarter plate (the studs are planted in it: the stud piece is tested
// up to its underside) and the riser crank A's slot takes (alarmPusherRiser,
// the coupling), sampled on its triangles at STEP over the pose net — §152's
// digest poses and a whole press — and binned to a CELL grid of z intervals
// per mesh and pose, so a solid's interior between its faces is occupied. A
// footprint point conflicts if any occupied interval within CM + a cell's half
// diagonal in plan overlaps its piece's band widened by CM.
//
// CONTROLS (fatal):
//  C1 the detector: the line the build carries now reads its own known
//     conflict on the arranged default (`--expect-conflict`, the arrest's leg
//     B under crank A's arm), and the designed line reads clear on the designed
//     build (`--q arrangement=designed`).
//  C2 the law: the line the build carries, fed back through `at`, reproduces
//     the built pivots (PA, PB) to 1e-9.
//
// Run: node tools/probe-314-linkage-line.mjs [--q QUERY] [--expect-conflict] [--top N]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const argOf = (k, d = null) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const Q = argOf('--q', '');
const EXPECT_CONFLICT = argv.includes('--expect-conflict');
const TOP = +argOf('--top', 5);

let chromium;
try { ({ chromium } = await import(join(ROOT, 'tools/node_modules/playwright/index.mjs'))); }
catch { ({ chromium } = createRequire(import.meta.url)('playwright')); }
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.css': 'text/css' };
const srv = createServer(async (req, res) => {
  try {
    const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    const body = await readFile(join(ROOT, p === '/' ? 'index.html' : p));
    res.writeHead(200, { 'content-type': MIME[extname(p)] ?? 'application/octet-stream', 'cache-control': 'no-store' }).end(body);
  } catch { res.writeHead(404).end('nf'); }
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const page = await (await browser.newContext()).newPage();
page.on('console', (m) => { if (m.type() === 'info') console.log(`  ${m.text()}`); if (m.type() === 'warning' && !/GPU|GL Driver|swiftshader|ReadPixels|fallback/i.test(m.text())) console.log(`  boot warn: ${m.text().slice(0, 160)}`); });
await page.goto(`http://127.0.0.1:${srv.address().port}/index.html?hud=0&sync=0&${Q}`);
await page.waitForFunction(() => !!window.__clock || !!window.__bootError, null, { timeout: 900000, polling: 1000 });
if (await page.evaluate(() => !!window.__bootError)) { console.log('boot failed'); process.exit(2); }

const out = await page.evaluate(async ({ TOP }) => {
  const I = await import('./src/inspect.js');
  const L = await import('./src/layout.js');
  const c = window.__clock, LK = c.alarmLinkage, CM = L.CLEAR_MARGIN;
  const STEP = 0.2, CELL = 0.25;
  // ---- the metal, binned: key → [[zLo, zHi], …] per sampled (mesh, pose) ----
  const labelOf = new Map();
  for (const e of c.labelEntries) if (!labelOf.has(e.obj)) labelOf.set(e.obj, e.name);
  const nearest = (o) => { for (let p = o; p; p = p.parent) if (labelOf.has(p)) return labelOf.get(p); return null; };
  const meshes = [];
  for (const e of c.labelEntries) e.obj.traverse((o) => {
    if (!o.isMesh || o.userData.schematic || nearest(o) !== e.name) return;
    if (/^alarmLinkage/.test(o.name) || o.name === 'alarmPusherRiser' || e.name === 'Three-quarter plate') return;
    let rot = null;
    for (let n = o; n; n = n.parent) if (n.userData && n.userData.r > 0 && n.userData.teeth > 0) { rot = n; break; }
    meshes.push({ o, unit: e.name, rot });
  });
  const occ = new Map();
  const v = new (c.scene.position.constructor)();
  const lastMat = new Map();
  // a mesh riding a TOOTHED rotor is its revolution (the annulus it sweeps about the rotor's own axis, over its
  // z range) — the arrest's and the winding dogleg's own rule — binned once; everything else is sampled per pose
  const ringed = new Set();
  const binRing = ({ o, unit, rot }) => {
    const ax = rot.getWorldPosition(v.clone());
    const pos = o.geometry.attributes.position;
    let r0 = Infinity, r1 = 0, z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); const r = Math.hypot(v.x - ax.x, v.y - ax.y); r0 = Math.min(r0, r); r1 = Math.max(r1, r); z0 = Math.min(z0, v.z); z1 = Math.max(z1, v.z); }
    if (z1 < -1 || z0 > 12) return;
    for (let gx = Math.floor((ax.x - r1) / CELL); gx <= Math.floor((ax.x + r1) / CELL); gx++)
      for (let gy = Math.floor((ax.y - r1) / CELL); gy <= Math.floor((ax.y + r1) / CELL); gy++) {
        // the cell is occupied if any of it lies in the annulus
        const cx = (gx + 0.5) * CELL, cy = (gy + 0.5) * CELL, d = Math.hypot(cx - ax.x, cy - ax.y), h = CELL * Math.SQRT1_2;
        if (d - h > r1 || d + h < r0) continue;
        const k = gx * 100003 + gy; let l = occ.get(k); if (!l) occ.set(k, l = []); l.push([z0, z1, unit, (o.name || o.geometry.type) + ' (swept)']);
      }
  };
  const sampleAll = () => {
    c.scene.updateMatrixWorld(true);
    for (const m of meshes) {
      const { o, unit, rot } = m;
      if (rot) { if (!ringed.has(o)) { ringed.add(o); binRing(m); } continue; }
      if (unit === 'Chain' && lastMat.has(o)) continue;   // its mesh is re-tessellated per pose (§152's DIGEST_ALWAYS_CHANGED); it lies in its groove, read once
      const key = o.matrixWorld.elements.map((x) => x.toFixed(6)).join(',') + '|' + o.geometry.id;
      if (lastMat.get(o)?.has(key)) continue;
      if (!lastMat.has(o)) lastMat.set(o, new Set());
      lastMat.get(o).add(key);
      const g = o.geometry, pos = g.attributes.position, idx = g.index;
      const n = pos.count, W = new Float64Array(n * 3);
      for (let i = 0; i < n; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); W[3 * i] = v.x; W[3 * i + 1] = v.y; W[3 * i + 2] = v.z; }
      const cellZ = new Map();
      const put = (x, y, z) => {
        if (z < -1 || z > 12) return;
        const k = Math.floor(x / CELL) * 100003 + Math.floor(y / CELL);
        const iv = cellZ.get(k); if (!iv) cellZ.set(k, [z, z]); else { if (z < iv[0]) iv[0] = z; if (z > iv[1]) iv[1] = z; }
      };
      const T = idx ? idx.count / 3 : n / 3;
      for (let t = 0; t < T; t++) {
        const a = idx ? idx.getX(3 * t) : 3 * t, b = idx ? idx.getX(3 * t + 1) : 3 * t + 1, cc = idx ? idx.getX(3 * t + 2) : 3 * t + 2;
        const L0 = Math.max(Math.hypot(W[3*b]-W[3*a], W[3*b+1]-W[3*a+1]), Math.hypot(W[3*cc]-W[3*a], W[3*cc+1]-W[3*a+1]), Math.hypot(W[3*cc]-W[3*b], W[3*cc+1]-W[3*b+1]), 1e-9);
        const s = Math.max(1, Math.ceil(L0 / STEP));
        for (let i = 0; i <= s; i++) for (let j = 0; j <= s - i; j++) {
          const u = i / s, w = j / s;
          put(W[3*a] + (W[3*b]-W[3*a]) * u + (W[3*cc]-W[3*a]) * w, W[3*a+1] + (W[3*b+1]-W[3*a+1]) * u + (W[3*cc+1]-W[3*a+1]) * w,
            W[3*a+2] + (W[3*b+2]-W[3*a+2]) * u + (W[3*cc+2]-W[3*a+2]) * w);
        }
      }
      // a mesh's own interval per cell is solid between its faces (a disc, a column, a slab)
      for (const [k, iv] of cellZ) { let l = occ.get(k); if (!l) occ.set(k, l = []); l.push([iv[0], iv[1], unit, o.name || g.type]); }
    }
  };
  const poses = [...I.digestPoses(c).map((p) => p)];
  const press = I.AXES.find((a) => a.name === 'alarmPress');
  for (let i = 0; i <= 16; i++) poses.push(press.pose(i / 16));
  const t0 = performance.now();
  for (const p of poses) { I.enterAxis(c); c.resetInputs(); c.setPose(p); sampleAll(); await new Promise((r) => setTimeout(r, 0)); }
  const scanMs = performance.now() - t0;
  console.info(`scan ${Math.round(scanMs)} ms over ${poses.length} poses, ${occ.size} cells`);
  // ---- a candidate's verdict ----
  const reach = CM + CELL * Math.SQRT1_2;
  const R = Math.ceil(reach / CELL);
  const TQ = c.alarmLinkage.swept()[0].zHi - 0.5;   // the studs' piece tops 0.5 into the plate: its underside
  // the studs are planted in the three-quarter plate. A window with a boss shrinks around a keep (§62), but the
  // arrest's is BOSSLESS and all-or-nothing (§115), so each stud stands a land (TQ_LAND_MIN) outside its reveal
  const WIN = LK.windowDiscs().filter((w) => w.name === 'arrest');
  const studOut = (k) => { for (const P of [k.PA, k.PB]) for (const w of WIN) if (Math.hypot(P.x - w.x, P.y - w.y) < w.r + LK.landMin + LK.studR) return `stud in the ${w.name} window`; return null; };
  const judge = (swept, firstOnly = true) => {
    const hits = new Map();
    for (const pc of swept) {
      const lo = pc.zLo - CM, hi = Math.min(pc.zHi, TQ) + CM;
      for (const [x, y] of pc.xy) {
        const gx = Math.floor(x / CELL), gy = Math.floor(y / CELL);
        for (let dx = -R; dx <= R; dx++) for (let dy = -R; dy <= R; dy++) {
          const l = occ.get((gx + dx) * 100003 + (gy + dy)); if (!l) continue;
          for (const [a, b, unit, mesh] of l) {
            if (b < lo || a > hi) continue;
            const k = `${pc.name} ⇄ ${unit} / ${mesh}`;
            hits.set(k, (hits.get(k) || 0) + 1);
            if (firstOnly) return hits;
          }
        }
      }
    }
    return hits;
  };
  // ---- C2: the law reproduces the build's own linkage ----
  const cur = LK.at(LK.line.dirDeg, LK.line.c);
  const built = LK.swept(), curS = cur && cur.swept();
  const lawErr = cur ? Math.max(...[24, 49].map((i) => Math.hypot(curS[0].xy[i][0] - built[0].xy[i][0], curS[0].xy[i][1] - built[0].xy[i][1]))) : Infinity;
  const curHits = [...judge(built, false).entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  // ---- the search ----
  const stroke = Math.hypot(cur.p1.x - cur.p0.x, cur.p1.y - cur.p0.y);
  const A_MIN = stroke * stroke / (8 * CM), CASE_R = c.plateR + 1 / L.UNIT_MM,   // plateR + 1 mm (§186), the fold-site search's case radius
    A_MAX = CASE_R / 2;
  const inCase = (P) => Math.hypot(P.x, P.y) <= CASE_R - CM;
  const cands = [];
  for (let td = 0; td < 180; td++) {
    if (td % 10 === 0) await new Promise((r) => setTimeout(r, 0));
    for (let cc = -CASE_R; cc <= CASE_R + 1e-9; cc += 0.5) {
      const k = LK.at(td, cc);
      if (!k) continue;
      const arms = [k.armA, k.armBin, k.armBout];
      if (!arms.every((a) => a >= A_MIN && a <= A_MAX) || k.rod < 2 * CM || ![k.PA, k.PB, k.EA, k.EB].every(inCase)) continue;
      cands.push({ td, c: +cc.toFixed(2), len: 2 * k.armA + k.armBin + k.armBout + k.rod, k });
    }
  }
  cands.sort((p, q) => p.len - q.len);
  console.info(`law sweep ${Math.round(performance.now() - t0 - scanMs)} ms: ${cands.length} candidates`);
  const strip = (cd) => ({ dirDeg: cd.td, c: cd.c, len: +cd.len.toFixed(3), PA: [+cd.k.PA.x.toFixed(3), +cd.k.PA.y.toFixed(3)], PB: [+cd.k.PB.x.toFixed(3), +cd.k.PB.y.toFixed(3)],
    arms: [cd.k.armA, cd.k.armBin, cd.k.armBout].map((a) => +a.toFixed(3)), rod: +cd.k.rod.toFixed(3) });
  const clear = [], near = [];
  let judged = 0;
  for (const cd of cands) {
    judged++;
    if (studOut(cd.k)) continue;
    const h = judge(cd.k.swept(), false);
    if (h.size === 0) { clear.push(cd); if (clear.length >= TOP) break; }
    else if (near.length < 25) near.push({ ...strip(cd), hits: [...h.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3) });
    if (judged % 50 === 0) { console.info(`judged ${judged}, clear ${clear.length}`); await new Promise((r) => setTimeout(r, 0)); }
  }
  return { key: LK.key, line: LK.line, modRotDeg: LK.modRotDeg, scanMs: Math.round(scanMs), poses: poses.length, cells: occ.size, lawErr,
    curHits, A_MIN, A_MAX, nCands: cands.length, judged, clear: clear.map(strip), near, curLen: 2 * cur.armA + cur.armBin + cur.armBout + cur.rod };
}, { TOP });
await browser.close(); srv.close();

console.log(`arrangement ${out.key}\n  the line it carries: dir ${out.line.dirDeg}° (+ the module's ${out.modRotDeg.toFixed(1)}°), c ${out.line.c}; length ${out.curLen.toFixed(3)}`);
console.log(`  metal: ${out.poses} poses, ${out.cells} occupied cells, scanned in ${out.scanMs} ms`);
let fail = 0;
const ok = (name, cond, d = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${d ? ` — ${d}` : ''}`); if (!cond) fail++; };
ok('C2 the law reproduces the built linkage', out.lawErr < 1e-9, `${out.lawErr.toExponential(2)}`);
const conflicts = out.curHits.length;
if (EXPECT_CONFLICT) ok('C1 the carried line reads its known conflict', conflicts > 0, out.curHits.map(([k, n]) => `${k} ×${n}`).join('; ') || 'clear');
else ok('C1 the carried line reads clear', conflicts === 0, out.curHits.map(([k, n]) => `${k} ×${n}`).join('; ') || 'clear');
console.log(`\nsearch: ${out.nCands} linkages inside the bounds (arms ${out.A_MIN.toFixed(3)}–${out.A_MAX.toFixed(2)}), ${out.judged} judged shortest first`);
for (const [i, cd] of out.clear.entries())
  console.log(`  ${i + 1}. dir ${cd.dirDeg}°, c ${cd.c}: length ${cd.len} (arms ${cd.arms.join(' / ')}, rod ${cd.rod}); crank A at (${cd.PA}), crank B at (${cd.PB})`);
if (!out.clear.length) console.log('  none clears');
for (const n of out.near || []) console.log(`  near: dir ${n.dirDeg}°, c ${n.c}, len ${n.len}, A (${n.PA}) B (${n.PB}): ${n.hits.map(([k, m]) => `${k} ×${m}`).join('; ')}`);
process.exit(fail ? 2 : 0);
