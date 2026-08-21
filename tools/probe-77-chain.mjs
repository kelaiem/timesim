// §77 tier 3 — the chain's sub-body declaration, held at three tensions.
//
// Three claims, each of which has a way to rot:
// 1. The declared ranges TILE the index exactly — every triangle in exactly
//    one body — at whatever N the pose produces. (The check's validator
//    holds bounds/overlap/names; tiling is the stronger property only the
//    chain promises, because its stamp writes the table and the index in
//    one loop.)
// 2. A REBUILD never serves a stale table: after the tension moves enough
//    to rebuild (|Δ| > 0.0015), the geometry's table still tiles ITS index
//    — the declaration rides the geometry, so this fails only if someone
//    detaches it from the stamp.
// 3. The report stays clean through the declared route: 0 malformed, 0
//    interior pair rows (adjacent pairs are DECLARED — the articulation
//    fiction, TODO 76 — and only adjacent pairs are declared, so a row
//    here means a corrupted stamp, not the fiction).
//
// Usage: node probe-77-chain.mjs   (from tools/; needs npm ci + Playwright
// Chromium). Exits non-zero on any violation.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const PORT = process.env.PORT || 8456;
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
  const clock = window.__clock;
  const failures = [];
  const states = [];

  const tileCheck = (label) => {
    const geo = clock.scene.getObjectByName('chainRun').geometry;
    const sb = geo.userData.subBodies;
    const tris = geo.index.count / 3;
    if (!sb) { failures.push(`${label}: no subBodies on the chain geometry`); return; }
    const sorted = [...sb].sort((a, b) => a.triStart - b.triStart);
    let cursor = 0;
    for (const b of sorted) {
      if (b.triStart !== cursor) { failures.push(`${label}: gap or overlap at ${b.name} (starts ${b.triStart}, expected ${cursor})`); return; }
      cursor += b.triCount;
    }
    if (cursor !== tris) failures.push(`${label}: bodies cover ${cursor} of ${tris} triangles — the table does not tile the index`);
    states.push({ label, bodies: sb.length, tris, geoId: geo.id });
  };

  clock.resetInputs();
  tileCheck('boot');
  // Move the tension far enough to force a rebuild (the gate is 0.0015),
  // twice, so two distinct geometries are exercised. setPose writes the
  // pose keys directly; the chain rebuild hangs off it.
  clock.setPose({ tension: 0.35 });
  tileCheck('tension 0.35');
  clock.setPose({ tension: 0.85 });
  tileCheck('tension 0.85');
  if (states.length === 3 && states[0].geoId === states[1].geoId && states[1].geoId === states[2].geoId)
    failures.push('the three tensions served ONE geometry id — no rebuild happened, so claim 2 was not exercised');

  // Claim 3 on the current pose: full check, chain rows only.
  clock.resetInputs();
  I.start(clock, 'meshIntegrity', { yieldEvery: 64 });
  let st;
  for (let i = 0; i < 480; i++) {
    await new Promise((r) => setTimeout(r, 250));
    st = window.__checks?.meshIntegrity;
    if (st && st.state !== 'running') break;
  }
  if (!st || st.state !== 'done') failures.push(`meshIntegrity did not finish: ${st?.state}`);
  else {
    const r = st.result;
    if (!String(r.control).startsWith('PASS')) failures.push(`control: ${r.control}`);
    const chainMalformed = r.subBodies.malformed.filter((m) => m.mesh === 'chainRun');
    if (chainMalformed.length) failures.push(`chain declaration malformed: ${JSON.stringify(chainMalformed[0])}`);
    const chainRows = r.subBodies.pairs.rows.filter((x) => x.mesh === 'chainRun');
    for (const row of chainRows) failures.push(`interior pair on the chain (a corrupted stamp, not the declared fiction): ${row.a} ⇄ ${row.b}, span ${row.maxSpan}`);
  }
  return { failures, states };
});

await browser.close();
srv.kill();
for (const s of res.states) console.log(`${s.label}: ${s.bodies} bodies tile ${s.tris} triangles (geometry ${s.geoId})`);
if (res.failures.length) {
  console.error(`chain sub-body probe FAILED (${res.failures.length}):`);
  for (const f of res.failures) console.error('  · ' + f);
  process.exit(1);
}
console.log('chain sub-body probe OK — tables tile at every tension, rebuilds serve fresh declarations, no interior pairs beyond the declared fiction');
