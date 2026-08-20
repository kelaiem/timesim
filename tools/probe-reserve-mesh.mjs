// Do the power-reserve train's two meshes actually engage?
//
// TODO 15 named this train as one of its two remaining `Math.PI / teeth`
// sites — a phase that is half of a wheel's OWN pitch and says nothing about
// where its neighbour's teeth fall — but the report there was code-reading
// plus screenshots, never a measurement, and TODO 15's own history is four
// gauges of which three lied. So this is an INDEPENDENT instrument: it
// re-implements the gap gauge (silhouette by outline-edge interpolation →
// threshold → count the low runs → circular mean folded into one pitch)
// rather than importing main.js's, and refuses any reading whose gap count
// disagrees with the declared tooth count.
//
// Two things are checked per mesh, both from TODO 15:
//   · centre distance against the pitch-circle sum — gears perfectly in phase
//     that do not reach each other are not meshing either, and this test is
//     independent of the phase one;
//   · frac(uP + uQ) = 0.5, the SUM invariant. Meshing gears counter-rotate,
//     so uQ − uP drifts as the train runs and only the sum is a property of
//     the mesh. Measured at three poses (as built, as rendered, and at an
//     arbitrary third wind) — a build-pose-only check cannot tell a correct
//     mesh from one that is merely correct at rest.
//
// Run from tools/ with a Playwright Chromium: `node probe-reserve-mesh.mjs`.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const port = process.env.PORT || '8479';
const root = process.env.ROOT || '..';
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });

const out = await page.evaluate(async () => {
  const C = window.__clock;
  const train = C.labelEntries.find((e) => e.name === 'Power-reserve train')?.obj;
  if (!train) return { error: 'no Power-reserve train label' };

  // --- the gap gauge, re-implemented (see the header) ----------------------
  const frac = (x) => x - Math.floor(x);
  const toothPhase = (obj, N) => {
    obj.updateWorldMatrix(true, true);
    const o = obj.matrixWorld.elements;
    const ox = o[12], oy = o[13];
    const BINS = 2048, R = new Float64Array(BINS);
    const put = (x, y) => {
      const r = Math.hypot(x, y);
      let th = Math.atan2(y, x); if (th < 0) th += Math.PI * 2;
      const k = Math.min(BINS - 1, (th / (Math.PI * 2) * BINS) | 0);
      if (r > R[k]) R[k] = r;
    };
    obj.traverse((m) => {
      if (!m.isMesh || !m.geometry?.attributes?.position) return;
      const pos = m.geometry.attributes.position;
      const idx = m.geometry.index ? m.geometry.index.array : null;
      const n = idx ? idx.length : pos.count;
      const e = m.matrixWorld.elements;
      const at = (i) => {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        return [e[0] * x + e[4] * y + e[8] * z + e[12] - ox, e[1] * x + e[5] * y + e[9] * z + e[13] - oy];
      };
      for (let i = 0; i + 2 < n; i += 3) {
        for (const [p, q] of [[0, 1], [1, 2], [2, 0]]) {
          const [ax, ay] = at(idx ? idx[i + p] : i + p);
          const [bx, by] = at(idx ? idx[i + q] : i + q);
          let d = Math.atan2(by, bx) - Math.atan2(ay, ax);
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          if (Math.abs(d) > Math.PI / N) continue;      // face-triangulation chord, not outline
          const steps = Math.max(1, Math.ceil(Math.abs(d) / (Math.PI * 2 / BINS)) + 1);
          for (let t = 0; t <= steps; t++) put(ax + (bx - ax) * t / steps, ay + (by - ay) * t / steps);
        }
      }
    });
    // PERCENTILE THRESHOLD, not min-to-max. main.js's gauge takes the midpoint
    // between the smallest and largest populated bin, which is fine for a
    // 51-tooth idler and wrong for an 8-leaf pinion: a handful of bins there
    // see only bore geometry, the floor collapses to 0.5, and the threshold
    // lands in the ROOT land — 56 one-bin "gaps" at 0.94 confidence, a bad
    // reading that looks credible. The 10th/90th percentiles of the populated
    // bins put it back on the pitch circle for every wheel in this train.
    const pop = [...R].filter((r) => r > 0).sort((a, b) => a - b);
    if (pop.length < BINS / 4) return { phase: 0, gaps: -1, conf: 0 };
    const pct = (q) => pop[Math.min(pop.length - 1, Math.floor(q * pop.length))];
    const lo = pct(0.10), hi = pct(0.90);
    const mid = (lo + hi) / 2;
    for (let k = 0; k < BINS; k++) if (R[k] === 0) R[k] = lo;   // unsampled: treat as valley
    const centres = [];
    for (let k = 0; k < BINS; k++) {
      if (R[k] < mid && !(R[(k + BINS - 1) % BINS] < mid)) {
        let len = 0, j = k;
        while (R[j % BINS] < mid && len < BINS) { j++; len++; }
        centres.push((k + len / 2) / BINS * Math.PI * 2);
      }
    }
    let sx = 0, sy = 0;
    for (const g of centres) { sx += Math.cos(g * N); sy += Math.sin(g * N); }
    return {
      phase: Math.atan2(sy, sx) / N + Math.PI / N,
      gaps: centres.length,
      conf: centres.length ? Math.hypot(sx, sy) / centres.length : 0,
    };
  };
  const centreOf = (o) => { o.updateWorldMatrix(true, false); const e = o.matrixWorld.elements; return { x: e[12], y: e[13] }; };

  // --- name the four wheels ------------------------------------------------
  // The train's arbors are Groups; the gears hanging off them are Groups too
  // (makeGear/makePinion both return one). p1 is the arbor-1 child stepped
  // toward the dial, w1 the one in the arbor's own plane.
  const arbors = train.children.filter((c) => c.isGroup);
  // TODO 48's fix wrapped w1+p1 in a rigid PAIR group under the arbor (the
  // one-blank constraint made structural), so the two gears sit one level
  // deeper: look through a lone child group when the arbor itself carries
  // only one.
  const gearsOfLevel = (g) => g.children.filter((c) => c.isGroup || (c.isMesh && c.geometry.type === 'ExtrudeGeometry'));
  const gearsOf = (g) => {
    const own = gearsOfLevel(g);
    // The pair wrapper is a bare Group holding two GEAR GROUPS; a lone gear
    // group holds meshes. Recurse only into the former, or a single pinion's
    // own tooth/hub meshes read as a phantom compound arbor.
    if (own.length === 1 && own[0].isGroup) {
      const inner = own[0].children.filter((c) => c.isGroup);
      if (inner.length === 2) return inner;
    }
    return own;
  };
  const arb1 = arbors.find((a) => gearsOf(a).length === 2);
  if (!arb1) return { error: 'could not find the compound arbor', arbors: arbors.map((a) => a.children.length) };
  const others = arbors.filter((a) => a !== arb1 && gearsOf(a).length === 1);
  // p0 sits on the barrel axis, w2 on the sub-dial pivot; tell them apart by
  // tooth count rather than by position, so the naming cannot silently swap.
  const cand = others.map((a) => ({ arbor: a, gear: gearsOf(a)[0] }));
  const w1w2 = gearsOf(arb1);
  const w1 = w1w2.find((g) => Math.abs(g.position.z) < 1e-6) ?? w1w2[0];
  const p1 = w1w2.find((g) => g !== w1);

  const TEETH = { p0: 8, w1: 28, p1: 10, w2: 12 };   // main.js: rsvTeethP0/W1/P1/W2 (w2 = 2·reserveHours/5)
  // p0 meshes w1, so it is the one whose gauge reads 8 gaps.
  const read = (o, n) => toothPhase(o, n);
  let p0 = null, w2 = null;
  for (const c of cand) {
    if (read(c.gear, TEETH.p0).gaps === TEETH.p0) p0 = c.gear;
    else if (read(c.gear, TEETH.w2).gaps === TEETH.w2) w2 = c.gear;
  }
  if (!p0 || !w2) return { error: 'gauge could not identify p0/w2', got: cand.map((c) => [read(c.gear, TEETH.p0).gaps, read(c.gear, TEETH.w2).gaps]) };

  const MESHES = [
    { name: 'p0 ⇄ w1', P: { obj: p0, teeth: TEETH.p0 }, Q: { obj: w1, teeth: TEETH.w1 }, module: 0.34 },
    { name: 'p1 ⇄ w2', P: { obj: p1, teeth: TEETH.p1 }, Q: { obj: w2, teeth: TEETH.w2 }, module: null },
  ];

  const measure = () => MESHES.map((m) => {
    const pc = centreOf(m.P.obj), qc = centreOf(m.Q.obj);
    const rp = read(m.P.obj, m.P.teeth), rq = read(m.Q.obj, m.Q.teeth);
    const credible = rp.gaps === m.P.teeth && rq.gaps === m.Q.teeth && rp.conf > 0.9 && rq.conf > 0.9;
    const psi = Math.atan2(qc.y - pc.y, qc.x - pc.x);
    const uP = frac(((psi - rp.phase) * m.P.teeth) / (Math.PI * 2));
    const uQ = frac(((psi + Math.PI - rq.phase) * m.Q.teeth) / (Math.PI * 2));
    const s = frac(uP + uQ - 0.5);
    return {
      name: m.name,
      credible,
      gaps: [rp.gaps, rq.gaps], conf: [+rp.conf.toFixed(4), +rq.conf.toFixed(4)],
      offPitchPct: +(Math.min(s, 1 - s) * 100).toFixed(2),
      centreDist: +Math.hypot(qc.x - pc.x, qc.y - pc.y).toFixed(4),
      module: m.module,
    };
  });

  const poses = [];
  C.resetInputs(); C.setPose({ tau: 0, crownPullT: 0, leverEngage: 0, tension: 1 });
  poses.push({ pose: 'full wind', rows: measure() });
  C.setPose({ tau: 0, crownPullT: 0, leverEngage: 0, tension: 0.55 });
  poses.push({ pose: 'tension 0.55', rows: measure() });
  C.setPose({ tau: 0, crownPullT: 0, leverEngage: 0, tension: 0.17 });
  poses.push({ pose: 'tension 0.17', rows: measure() });
  return { poses };
});

if (out.error) { console.log('ERROR', out.error, JSON.stringify(out)); }
else {
  console.log('pose           mesh      credible  gaps      confidence        off anti-phase   centre dist');
  for (const p of out.poses)
    for (const r of p.rows)
      console.log(`${p.pose.padEnd(14)} ${r.name.padEnd(9)} ${String(r.credible).padEnd(9)} `
        + `${JSON.stringify(r.gaps).padEnd(9)} ${JSON.stringify(r.conf).padEnd(17)} `
        + `${String(r.offPitchPct).padStart(6)}%          ${r.centreDist}`);
  const worst = Math.max(...out.poses.flatMap((p) => p.rows.filter((r) => r.credible).map((r) => r.offPitchPct)));
  console.log(`\nworst credible reading: ${worst}% of a pitch off anti-phase `
    + `(0% = a tooth meets a gap on the line of centres; 50% = tooth meets tooth)`);
}
await browser.close();
srv.kill();
