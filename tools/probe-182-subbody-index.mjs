// §182 — DOES A BVH BUILD INVALIDATE `userData.subBodies`?
//
// `meshIntegrity`'s tier 3 reads sub-bodies as TRIANGLE RANGES — {triStart,
// triCount} into the geometry's index buffer — and three-mesh-bvh's
// computeBoundsTree REORDERS that index in place to group triangles
// spatially. If that is what happens, every range means something different
// after any check that builds a BVH, and the tier's rows become a function of
// what ran before it in the shard.
//
// The symptom that sent this here: on the SAME tree, `--only meshIntegrity`
// reports `39 tested / 136 declared / 0 interior` and
// `--only support,meshIntegrity` reports `527 / 50 / 134`. Both PASS, because
// those rows are a REPORT — so nothing was ever going to notice.
//
// This measures the mechanism rather than inferring it: snapshot the index of
// every sub-body geometry, run the `support` check, compare.
//
// REPORT. Run: cd tools && node probe-182-subbody-index.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const srv = spawn('python3', ['-m', 'http.server', '8489', '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const b = await chromium.launch(); const p = await b.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await p.goto('http://127.0.0.1:8489/index.html?hud=0&sync=0', { waitUntil: 'load', timeout: 90000 });
await p.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });

const out = await p.evaluate(async () => {
  const I = await import('./src/inspect.js');
  const clock = window.__clock;
  clock.resetInputs(); clock.scene.updateMatrixWorld(true);

  // every geometry carrying a sub-body table, and its index BEFORE anything
  // has had a chance to build a bounds tree on it
  const found = [];
  clock.scene.traverse((o) => {
    if (!o.isMesh || !o.geometry?.userData?.subBodies) return;
    found.push({ mesh: o, before: o.geometry.index ? o.geometry.index.array.slice() : null });
  });

  const treesAtBoot = found.filter((f) => !!f.mesh.geometry.boundsTree).length;

  // Drive the REAL check rather than a helper: `bvhFor` is not exported, and a
  // probe that calls a name inspect.js does not export gets a throw per mesh
  // and reports "0 reordered" having tested nothing — probe-90-click's exact
  // failure, and this file's first cut made it.
  // status() with NO argument returns a MAP of every job, so `.state` on it is
  // undefined and a wait loop reading it exits at once — the check never runs
  // and every comparison below reads its own snapshot. status(NAME) is the
  // per-job form. This probe made that mistake too, and only noticed because
  // the undefined state was in the payload.
  I.start(clock, 'support');
  const t0 = Date.now();
  let state = I.status('support').state;
  while (state === 'running' && Date.now() - t0 < 300000) {
    await new Promise((r) => setTimeout(r, 250));
    state = I.status('support').state;
  }

  const rows = [];
  for (const f of found) {
    const geo = f.mesh.geometry;
    const after = geo.index ? geo.index.array : null;
    let moved = 0;
    if (f.before && after && f.before.length === after.length) {
      for (let i = 0; i < after.length; i++) if (after[i] !== f.before[i]) moved++;
    }
    rows.push({
      name: f.mesh.name || geo.type,
      tris: f.before ? f.before.length / 3 : null,
      hasTreeNow: !!geo.boundsTree,
      indexEntriesMoved: moved,
      reordered: moved > 0,
    });
  }
  return {
    supportRunState: String(state),
    subBodyGeometries: found.length,
    treesAtBoot,
    treesAfterSupport: rows.filter((r) => r.hasTreeNow).length,
    reordered: rows.filter((r) => r.reordered).length,
    rows: rows.filter((r) => r.reordered).slice(0, 6),
    unmovedSample: rows.filter((r) => !r.reordered).slice(0, 4),
  };
});
console.log(JSON.stringify(out, null, 2));
await b.close(); srv.kill();
