// §77 tier 1 — derive ZERO_AREA_MAX from the scene, not from taste.
//
// Rule 1: a threshold is a constant, and a constant derives from a
// constraint. The constraint here is a DEMONSTRATED GAP in the scene's
// triangle-area distribution: the defective population (absarc seam twins,
// earcut hole-bridge slivers — measured down to 1.3e-22 u² in TODO 73) and
// the smallest INTENDED triangles (bevel facets, thread crests) must be
// separated by orders of magnitude, or a single number cannot classify
// them and the tier needs a different design. This probe prints the
// log10-decade histogram over every triangle of every inspected mesh, the
// smallest 30 areas with their meshes, and the widest empty decade band —
// the constant goes in the middle of that band, with both bounds quoted in
// the comment beside it.
//
// Areas are GEOMETRY-LOCAL (scene units²): the zero-area property is
// scale-invariant, mirrored parts (scale −1) keep |area|, and local areas
// make the histogram independent of where a part sits.
//
// Usage: node probe-77-threshold.mjs   (from tools/; needs npm ci +
// Playwright Chromium, same as ci-battery.mjs).
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const PORT = process.env.PORT || 8451;
const ROOT = process.env.ROOT || '..';
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 60000 });

const res = await page.evaluate(async () => {
  const clock = window.__clock;
  // Same roster the check will use: every mesh under a labelled unit, the
  // schematic display tier pruned as a SUBTREE (collectUnits' rule), each
  // GEOMETRY counted once (shared geometries — screw heads, knurl ridges —
  // would otherwise weight the histogram by instance count).
  const seen = new Set();
  const geos = [];
  const walk = (o, unit) => {
    if (o.userData && o.userData.schematic) return;
    if (o.isMesh && o.geometry?.attributes?.position && !seen.has(o.geometry)) {
      seen.add(o.geometry);
      geos.push({ unit, mesh: o.name || '(unnamed)', g: o.geometry });
    }
    for (const c of o.children) walk(c, unit);
  };
  for (const e of clock.labelEntries) walk(e.obj, e.name);

  const decades = new Map();   // floor(log10 area) -> count; 'zero' for exact 0
  const smallest = [];         // keep the 30 smallest {area, unit, mesh}
  let total = 0;
  const A = [0, 0, 0], B = [0, 0, 0], C = [0, 0, 0];
  for (const { unit, mesh, g } of geos) {
    const pos = g.attributes.position.array;
    const idx = g.index ? g.index.array : null;
    const n = idx ? idx.length : g.attributes.position.count;
    for (let t = 0; t < n; t += 3) {
      const ia = (idx ? idx[t] : t) * 3, ib = (idx ? idx[t + 1] : t + 1) * 3, ic = (idx ? idx[t + 2] : t + 2) * 3;
      for (let k = 0; k < 3; k++) { A[k] = pos[ia + k]; B[k] = pos[ib + k]; C[k] = pos[ic + k]; }
      const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2];
      const vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
      const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
      const area = 0.5 * Math.sqrt(cx * cx + cy * cy + cz * cz);
      total++;
      const key = area === 0 ? 'zero' : String(Math.floor(Math.log10(area)));
      decades.set(key, (decades.get(key) || 0) + 1);
      if (smallest.length < 30 || area < smallest[smallest.length - 1].area) {
        smallest.push({ area, unit, mesh });
        smallest.sort((x, y) => x.area - y.area);
        if (smallest.length > 30) smallest.pop();
      }
    }
  }
  return { geos: geos.length, total, decades: [...decades.entries()].sort((a, b) => (a[0] === 'zero' ? -1e9 : +a[0]) - (b[0] === 'zero' ? -1e9 : +b[0])), smallest };
});

await browser.close();
srv.kill();

console.log(`geometries: ${res.geos}, triangles: ${res.total}`);
console.log('log10-decade histogram (decade: count):');
for (const [d, c] of res.decades) console.log(`  10^${d.padStart ? d.padStart(4) : d}: ${c}`);
console.log('smallest 30 areas:');
for (const s of res.smallest) console.log(`  ${s.area.toExponential(3)}  ${s.unit} / ${s.mesh}`);

// The widest empty band between occupied decades, ignoring the defective tail
// (everything below the band) — printed so the derivation is re-runnable.
const occ = res.decades.filter(([d]) => d !== 'zero').map(([d]) => +d).sort((a, b) => a - b);
let best = null;
for (let i = 1; i < occ.length; i++) {
  const gap = occ[i] - occ[i - 1];
  if (gap > 1 && (!best || gap > best.gap)) best = { lo: occ[i - 1], hi: occ[i], gap };
}
if (best) console.log(`widest empty decade band: 10^${best.lo + 1} .. 10^${best.hi} (${best.gap - 1} empty decade(s)) — put ZERO_AREA_MAX inside it`);
else console.log('NO empty decade band — a single threshold cannot classify this distribution; re-design the tier');
