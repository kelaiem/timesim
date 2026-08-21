// §77 — run `meshIntegrity` headless and print its summary: the control,
// the aggregates (builder-owned cause patterns), the top zeroArea and
// inverted rows, sub-body declarations, and the triangle census's head.
// The full payload is written to the file named in argv[2] (default
// meshintegrity-payload.json beside this script) for report-diff work.
//
// Usage: node probe-77-census.mjs [out.json]   (from tools/; needs npm ci +
// Playwright Chromium). ROOT= serves a different tree (worktree diffs).
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const PORT = process.env.PORT || 8452;
const ROOT = process.env.ROOT || '..';
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 60000 });

const res = await page.evaluate(async () => {
  const I = await import('./src/inspect.js');
  I.start(window.__clock, 'meshIntegrity', { yieldEvery: 64 });
  for (let i = 0; i < 240; i++) {
    await new Promise((r) => setTimeout(r, 250));
    const st = window.__checks?.meshIntegrity;
    if (st && st.state !== 'running') return st;
  }
  return { state: 'timeout' };
});
await browser.close();
srv.kill();

if (res.state !== 'done') { console.error('meshIntegrity did not finish:', JSON.stringify(res).slice(0, 400)); process.exit(1); }
const r = res.result;
writeFileSync(process.argv[2] || 'meshintegrity-payload.json', JSON.stringify(r, null, 2));

console.log(`meshIntegrity ${res.ms} ms — ${r.geometries} geometries / ${r.meshes} meshes / ${r.triangles} triangles`);
console.log(`control: ${r.control}`);
console.log(`zeroArea: ${r.zeroArea.total} triangles under ${r.zeroArea.threshold} (${r.zeroArea.exactZero} exactly zero) across ${r.zeroArea.geometries} geometries`);
console.log(`inverted: ${r.inverted.rows.length} bodies`);
console.log(`subBodies: ${r.subBodies.declaredGeometries} geometries declare ${r.subBodies.bodies} bodies, ${r.subBodies.malformed.length} malformed`);
console.log('aggregates (collapsed/collinear/sliver per geometry):');
for (const a of r.aggregates) console.log(`  ${a.pattern.collapsed}/${a.pattern.collinear}/${a.pattern.sliver} × ${a.geometries} geometrie(s) — e.g. ${a.examples.slice(0, 3).join('; ')}`);
console.log('top zeroArea rows:');
for (const z of r.zeroArea.rows.slice(0, 12))
  console.log(`  ${z.unit} / ${z.mesh} (${z.geometryType}, ${z.tris} tris ×${z.instances}): ${z.collapsed}c ${z.collinear}l ${z.sliver}s${z.minSliverArea ? ` min ${z.minSliverArea}` : ''}`);
for (const v of r.inverted.rows) console.log(`  INVERTED: ${v.unit} / ${v.mesh} vol ${v.signedVolume} (bbox ${v.bboxVolume})`);
process.exit(String(r.control).startsWith('PASS') && r.subBodies.malformed.length === 0 ? 0 : 1);
