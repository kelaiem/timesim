// WOULD THE SWITCH BE SEEN UNDER THE DIAL? — the free annulus seen from the
// FRONT through the smoked sapphire, against the switch as it is seen today
// from the BACK through the exhibition crystal, both over the pose net.
//
// REPORT with fatal controls (exit 2 when a control fails). §261 step 4 owes
// it before the fold is sited. The owner folded the alarm switch under the
// dial on 2026-10-11, and §226 had made the part's LEGIBILITY a stated design
// value ("visual acuity like the print on the dial"). So a fold that hides the
// part would trade the value §226 was filed for, and this measures it first.
//
// What it is NOT: `probe-226-driver-width.mjs` measures the driver's visible
// fraction from the back with a BINARY see-through rule (a material is a
// window if its opacity is under 0.5). That rule is right for the back crystal
// (opacity 0.14) and blind to the dial: §220's smoke law puts the default dial
// body at opacity ≈ 0.29, under 0.5 and so "a window", while it removes nearly
// a third of the light. This probe keeps the binary rule as one column and
// adds the second: TRANSMITTANCE, the product of (1 − opacity) over every
// see-through layer the line of sight crosses. `probe-261-dial-band.mjs` says
// where the fold FITS; this says how much of it would be SEEN there.
//
// METHOD. Rays along z through polar cells (0.5 u × 2.5°), double-sided,
// hits sorted along the ray.
//  · FRONT (the candidate): from z −60 toward +z, stopping at the dial's back
//    face (`dialPlate`'s +z face, the band's floor). A cell is VISIBLE at a
//    pose when nothing opaque is crossed; its transmittance is the product
//    over the see-through meshes crossed, each counted ONCE per mesh (a layer,
//    not two faces). The band's own tenants are not occluders here, because
//    the fold is sited only in cells step 2 found free.
//  · BACK (the baseline): from z +60 toward −z, over the cells under the
//    `Alarm switch` unit. The first non-see-through hit must be the switch's
//    own metal for the cell to count as seen. The transmittance is the
//    product over the see-through layers crossed before it.
//  · A mesh renders only if it and every ancestor is visible, and schematic
//    display is never metal, so both are skipped. That is the hands' and the
//    alarm hand's visibility laws respected, rather than assumed.
//  · The pose net is `digestPoses()` (§152), each entered by resetInputs +
//    setPose; the hands sweep it.
//
// CONTROLS (fatal):
//  V1 the material census: the dial body reads as see-through with opacity
//     equal to §220's law at the shipped smoke, smokedGlass(T) recomputed here
//     from the crystal's 0.14; and the back crystal reads 0.14.
//  V2 a MUST-HIT: every cell under the bezel's opaque front lip (r ≥ 42) is
//     blocked at every pose. (The first draft used the centre stack and was a
//     bad control: the hand pipes are bored, so a ray at r < 0.5 passes.)
//  V3 a MUST-SEE: some band cell is seen through the front crystal AND the
//     smoked dial, with transmittance under the crystal's alone.
//  V3b THE PRINT DISCRIMINATES: the dial's print, read texel by texel, blocks
//     some cells inside r 40 and not all. The first draft read the print's
//     material (transparent, opacity 1) and called the whole face opaque.
//  V4 the baseline reproduces §226's measurement to 6 points: the driver
//     (`alarmColDriver`) was 57.9 % hidden from the back by the binary rule.
//     Its denominator is every pose-cell with driver metal underneath, covered
//     or not; the first draft dropped the covered ones and read 100 % seen.
//
// Run from tools/: node probe-261-dial-visibility.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8596;
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
process.on('exit', () => { try { srv.kill(); } catch {} });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch();
const page = await browser.newPage();
const warns = [];
page.on('console', (m) => { if (m.type() === 'warning' && !/WebGL|GPU stall|GroupMarker/.test(m.text())) warns.push(m.text()); });
page.on('pageerror', (e) => warns.push('PAGEERROR ' + String(e)));
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction(() => !!window.__clock || !!window.__bootError, null, { timeout: 300000 });
const bootError = await page.evaluate(() => (window.__bootError ? String(window.__bootError) : null));
if (bootError) { console.log('boot failed: ' + bootError); process.exit(2); }

const GRID = { DR: 0.5, DAZ_DEG: 2.5, R0: 0, R1: 44.16 };
const t0 = Date.now();
const res = await page.evaluate(async (GRID) => {
  const THREE = await import('three');
  const I = await import('./src/inspect.js');
  const M = await import('./src/materials.js');
  const clock = window.__clock;
  const DS = THREE.DoubleSide;
  clock.resetInputs(); clock.setPose({}); clock.scene.updateMatrixWorld(true);

  const owner = new Map();
  for (const e of clock.labelEntries) e.obj.traverse((o) => { if (o.isMesh && !owner.has(o)) owner.set(o, e.name); });
  const rendered = (o) => { for (let p = o; p; p = p.parent) { if (!p.visible) return false; if (p.userData?.schematic) return false; } return true; };
  const mats = (o) => (Array.isArray(o.material) ? o.material : [o.material]).filter(Boolean);
  // §226's rule, kept as the binary column: a window if transparent and under
  // half opaque (or transmissive).
  const seeThrough = (o) => mats(o).every((m) => m.transparent && ((m.opacity != null && m.opacity < 0.5) || m.transmission > 0));
  const opacityOf = (o) => Math.max(...mats(o).map((m) => (m.transparent ? (m.opacity ?? 1) : 1)));
  const all = [];
  clock.scene.traverse((o) => { if (o.isMesh && o.geometry?.attributes?.position) all.push(o); });

  const dialMeshes = all.filter((o) => o.name === 'dialPlate');
  const box = new THREE.Box3();
  const dialBox = new THREE.Box3(); for (const m of dialMeshes) dialBox.union(box.setFromObject(m, true));
  const Z_FLOOR = dialBox.max.z;
  const backCrystal = all.find((o) => o.name === 'caseBackCrystal');

  // ---- V1: the census -----------------------------------------------------
  const dialOpacity = dialMeshes.length ? opacityOf(dialMeshes[0]) : NaN;
  const smokeT = M.DIAL_SMOKE_T ?? null;
  const lawOpacity = smokeT != null ? M.smokedGlass(smokeT).opacity : NaN;

  // ---- rays -----------------------------------------------------------------
  const ray = new THREE.Raycaster(); ray.near = 0; ray.far = 120;
  const org = new THREE.Vector3(), up = new THREE.Vector3(0, 0, 1), dn = new THREE.Vector3(0, 0, -1);
  const ver = new Map();
  const prep = (m) => { const g = m.geometry, v = g.attributes.position.version; if (!g.boundsTree || ver.get(g) !== v) { g.computeBoundsTree(); ver.set(g, v); } };
  // Every mesh hit along the ray, nearest first, as { o, d, z, cover } — one
  // entry per MESH at its nearest crossing (a layer is counted once, not per
  // face). Boxes are taken once per pose (`boxesFor`), never per ray: a box per
  // mesh per cell is the whole cost of a scan this size.
  const boxOf = new Map();
  const boxesFor = (list) => { for (const o of list) boxOf.set(o, new THREE.Box3().setFromObject(o)); };
  // COVERAGE is what the layer takes out of the light at that point: 1 for an
  // opaque material, opacity × the texel's alpha for a transparent one. The
  // dial's print is the case that needs the texel: printOnSapphire is a
  // transparent material at opacity 1 whose canvas is clear except where ink
  // is laid, so its MATERIAL says opaque and its pixels say mostly glass.
  // alphaTest discards a fragment outright. Read through texture.transformUv,
  // three's own CPU mapping (offset, repeat, wrap, flipY).
  const texCache = new Map();
  const texAlpha = (tex, uv) => {
    if (!tex || !tex.image || !uv) return 1;
    let d = texCache.get(tex);
    if (!d) {
      const img = tex.image, w = img.width, h = img.height;
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
      d = { w, h, data: cx.getImageData(0, 0, w, h).data }; texCache.set(tex, d);
    }
    const u = uv.clone(); tex.transformUv(u);
    const px = Math.min(d.w - 1, Math.max(0, Math.floor(u.x * d.w))), py = Math.min(d.h - 1, Math.max(0, Math.floor(u.y * d.h)));
    return d.data[(py * d.w + px) * 4 + 3] / 255;
  };
  const coverage = (o, hit) => {
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    const m = ms[hit.face?.materialIndex ?? 0] ?? ms[0];
    if (!m) return 1;
    const a = m.map ? texAlpha(m.map, hit.uv) : 1;
    if (m.alphaTest > 0 && a < m.alphaTest) return 0;
    if (!m.transparent) return 1;
    return Math.min(1, (m.opacity ?? 1) * a);
  };
  function trace(x, y, dir, list) {
    org.set(x, y, dir === up ? -60 : 60); ray.set(org, dir);
    const hits = [];
    for (const o of list) {
      const b = boxOf.get(o);
      if (!b || b.isEmpty() || x < b.min.x || x > b.max.x || y < b.min.y || y > b.max.y) continue;
      prep(o);
      const ms = mats(o), saved = ms.map((m) => m.side);
      for (const m of ms) m.side = DS;
      const h = []; o.raycast(ray, h);
      ms.forEach((m, i) => { m.side = saved[i]; });
      if (!h.length) continue;
      const nh = h.reduce((a, q) => (q.distance < a.distance ? q : a));
      hits.push({ o, d: nh.distance, z: nh.point.z, cover: coverage(o, nh) });
    }
    return hits.sort((a, b) => a.d - b.d);
  }

  const NR = Math.ceil((GRID.R1 - GRID.R0) / GRID.DR), NA = Math.round(360 / GRID.DAZ_DEG);
  const cells = [];
  for (let ri = 0; ri < NR; ri++) for (let ai = 0; ai < NA; ai++) {
    const r = GRID.R0 + (ri + 0.5) * GRID.DR, a = (ai + 0.5) * GRID.DAZ_DEG;
    cells.push({ r, az: a, x: r * Math.cos(a * Math.PI / 180), y: r * Math.sin(a * Math.PI / 180), seenN: 0, tSum: 0, tMin: Infinity, blockers: {} });
  }
  // Front occluders: everything rendered whose box reaches in front of the
  // dial's back face. Back candidates: everything rendered.
  const poses = I.digestPoses(clock);
  const switchMeshes = all.filter((o) => owner.get(o) === 'Alarm switch');
  const driver = all.find((o) => o.name === 'alarmColDriver');
  // Back cells: the switch's footprint, found once at the reference pose by
  // asking whether a straight-down ray meets switch metal at all.
  const backCells = [];
  {
    const sb = new THREE.Box3(); for (const m of switchMeshes) sb.union(box.setFromObject(m));
    const step = 0.25;
    for (let x = Math.floor(sb.min.x / step) * step; x <= sb.max.x; x += step)
      for (let y = Math.floor(sb.min.y / step) * step; y <= sb.max.y; y += step)
        backCells.push({ x, y, seenN: 0, binN: 0, tSum: 0, onSwitch: 0, onDriver: 0, drvBinN: 0 });
  }

  for (const p of poses) {
    clock.resetInputs(); clock.setPose(p); clock.scene.updateMatrixWorld(true);
    const live = all.filter(rendered);
    boxesFor(all);
    const front = live.filter((o) => { const b = boxOf.get(o); return !b.isEmpty() && b.min.z < Z_FLOOR; });
    for (const c of cells) {
      let T = 1, ok = true, first = null;
      for (const h of trace(c.x, c.y, up, front)) {
        if (h.z > Z_FLOOR + 1e-6) break;                 // past the dial's back: inside the band
        T *= 1 - h.cover;
        if (h.cover >= 0.5 && ok) { ok = false; first = h.o.name || `${owner.get(h.o) ?? '?'}:${h.o.material?.map ? 'printed' : (h.o.geometry?.type ?? '?')}`; }
        if (T === 0) break;
      }
      if (ok) { c.seenN++; c.tSum += T; c.tMin = Math.min(c.tMin, T); }
      else c.blockers[first] = (c.blockers[first] || 0) + 1;
    }
    for (const c of backCells) {
      // Denominators: does switch metal (or the driver) lie under this cell
      // at this pose at all, whatever covers it?
      const swHits = trace(c.x, c.y, dn, switchMeshes);
      if (!swHits.length) continue;
      c.onSwitch++;
      const underDriver = driver && swHits.some((h) => h.o === driver);
      if (underDriver) c.onDriver++;
      let T = 1;
      for (const h of trace(c.x, c.y, dn, live)) {
        const isSw = owner.get(h.o) === 'Alarm switch';
        if (!isSw) { T *= 1 - h.cover; if (h.cover >= 0.5) break; continue; }
        if (h.cover < 0.5) continue;                     // a see-through switch part (none expected)
        c.seenN++; c.tSum += T;
        if (h.o === driver) c.drvBinN++;
        break;
      }
    }
  }
  clock.resetInputs(); clock.setPose({}); clock.scene.updateMatrixWorld(true);

  // Back baseline over the switch's footprint: per pose-cell on the switch,
  // seen (binary) and seen × transmittance.
  let swPC = 0, swSeen = 0, swT = 0, drvPC = 0, drvSeen = 0;
  for (const c of backCells) { swPC += c.onSwitch; swSeen += c.seenN; swT += c.tSum; drvPC += c.onDriver; drvSeen += c.drvBinN; }
  return {
    Z_FLOOR, nPoses: poses.length, dialOpacity, smokeT, lawOpacity,
    backCrystalOpacity: backCrystal ? opacityOf(backCrystal) : NaN, backCrystalSeeThrough: backCrystal ? seeThrough(backCrystal) : false,
    cells: cells.map((c) => ({ r: c.r, az: c.az, vis: c.seenN / poses.length, tMean: c.seenN ? c.tSum / c.seenN : 0, tMin: c.seenN ? c.tMin : 0,
      top: Object.entries(c.blockers).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null })),
    back: { swPoseCells: swPC, swSeenFrac: swPC ? swSeen / swPC : 0, swSeenT: swPC ? swT / swPC : 0, drvPoseCells: drvPC, drvSeenFrac: drvPC ? drvSeen / drvPC : 0 },
  };
}, GRID);

const f = (x, d = 3) => x.toFixed(d);
const pct = (x) => (100 * x).toFixed(1) + ' %';
console.log(`scan ${((Date.now() - t0) / 1000).toFixed(0)} s after boot; ${res.nPoses} poses; dial back z ${f(res.Z_FLOOR, 4)}`);
console.log(`dial body opacity ${f(res.dialOpacity, 4)} at smoke T ${res.smokeT} (law: ${f(res.lawOpacity, 4)}), so it passes ${pct(1 - res.dialOpacity)} of the light; back crystal opacity ${f(res.backCrystalOpacity, 3)}`);

// THE BASELINE: the switch as seen today from the back.
console.log(`\nTODAY, FROM THE BACK — the Alarm switch unit: seen in ${pct(res.back.swSeenFrac)} of its pose-cells (binary), ` +
  `${pct(res.back.swSeenT)} weighted by transmittance; the driver alone ${pct(res.back.drvSeenFrac)} seen (${pct(1 - res.back.drvSeenFrac)} hidden)`);

// THE CANDIDATE: the free annulus from the front, by ring, over the arc step 2
// found free at the fold's depth (az 162.5 → 352.5) and over the whole ring.
const inArc = (az) => az >= 162.5 && az <= 352.5;
console.log('\nUNDER THE DIAL, FROM THE FRONT — by 2-u ring (pose-net mean):');
console.log('   ring    | free arc: seen   × transmittance = weighted | whole ring: seen   weighted | most frequent blocker');
for (let r = 18; r < 44; r += 2) {
  const ring = res.cells.filter((c) => c.r >= r && c.r < r + 2);
  const arc = ring.filter((c) => inArc(c.az));
  const m = (xs, k) => xs.reduce((s, c) => s + c[k], 0) / Math.max(1, xs.length);
  const w = (xs) => xs.reduce((s, c) => s + c.vis * c.tMean, 0) / Math.max(1, xs.length);
  const blk = {}; for (const c of arc) if (c.top) blk[c.top] = (blk[c.top] || 0) + 1;
  const topB = Object.entries(blk).sort((a, b) => b[1] - a[1])[0];
  console.log(`  r ${String(r).padStart(2)}–${String(r + 2).padEnd(2)} |       ${pct(m(arc, 'vis')).padStart(7)} × ${f(m(arc.filter((c) => c.vis > 0), 'tMean'))}       = ${pct(w(arc)).padStart(7)} |      ${pct(m(ring, 'vis')).padStart(7)}  ${pct(w(ring)).padStart(7)} | ${topB ? `${topB[0]} (${topB[1]} cells)` : '—'}`);
}

// ---- controls -------------------------------------------------------------
let ok = true;
const fail = (s) => { ok = false; console.log('CONTROL FAIL: ' + s); };
const pass = (s) => console.log('CONTROL PASS: ' + s);
console.log('');
if (!(Math.abs(res.dialOpacity - res.lawOpacity) < 1e-6) || !(res.dialOpacity < 0.5)) fail(`V1 the dial body reads opacity ${res.dialOpacity}, §220's law gives ${res.lawOpacity} at T ${res.smokeT}`);
else if (!(Math.abs(res.backCrystalOpacity - 0.14) < 1e-9) || !res.backCrystalSeeThrough) fail(`V1 the back crystal reads opacity ${res.backCrystalOpacity}`);
else pass(`V1 the dial body is §220's law at T ${res.smokeT} (opacity ${f(res.dialOpacity, 4)}), the back crystal 0.14, both see-through`);
{
  // V2 a MUST-HIT: the bezel's opaque front lip stands over the dial's rim,
  // so every cell from r 42 out is blocked at every pose.
  const lip = res.cells.filter((c) => c.r >= 42);
  const seen = lip.filter((c) => c.vis > 0);
  if (!lip.length || seen.length) fail(`V2 ${seen.length}/${lip.length} cells under the bezel lip (r ≥ 42) read visible`);
  else pass(`V2 all ${lip.length} cells under the bezel lip (r ≥ 42) are blocked at every pose`);
}
{
  // V3 a MUST-SEE: somewhere in the open band the line of sight crosses the
  // front crystal AND the smoked dial, so the transmittance is under the
  // crystal's alone.
  const band = res.cells.filter((c) => c.r > 24 && c.r < 38 && c.vis > 0);
  const lit = band.filter((c) => c.tMin < 1 - res.backCrystalOpacity - 1e-6 && c.tMin > 0);
  if (!lit.length) fail(`V3 no band cell is seen through crystal and dial (${band.length} visible band cells)`);
  else pass(`V3 ${lit.length} band cells are seen through the crystal AND the smoked dial (transmittance ${f(Math.min(...lit.map((c) => c.tMin)))}–${f(Math.max(...lit.map((c) => c.tMean)))})`);
}
{
  // V3b THE PRINT DISCRIMINATES: the texel read must block some cells (the
  // indices and the chapter ring's print) and pass others. All-clear means the
  // print was never read; all-blocked means the clear canvas was read as ink.
  const byPrint = res.cells.filter((c) => c.r < 40 && c.top && /printed/.test(c.top)).length;
  const inside = res.cells.filter((c) => c.r < 40).length;
  if (!(byPrint > 0 && byPrint < inside)) fail(`V3b the dial's print blocks ${byPrint} of ${inside} cells inside r 40`);
  else pass(`V3b the dial's print blocks ${byPrint} of ${inside} cells inside r 40 (some, not all)`);
}
if (!(Math.abs((1 - res.back.drvSeenFrac) - 0.579) <= 0.06)) fail(`V4 the driver reads ${pct(1 - res.back.drvSeenFrac)} hidden from the back; §226 measured 57.9 %`);
else pass(`V4 the driver reads ${pct(1 - res.back.drvSeenFrac)} hidden from the back, §226's 57.9 % to within 6 points`);
if (warns.length) console.log(`\nboot warnings (${warns.length}): ${warns.slice(0, 3).join(' | ')}`);
await browser.close();
process.exit(ok ? 0 : 2);
