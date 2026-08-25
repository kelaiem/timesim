// TODO 93 — are the newly-visible rows TRUE positives?
//
// The pass-through witness turned four checks redder. That is only progress if
// every new row is real; an instrument that over-reports is worse than the one
// that under-reported, because it spends other people's time. So this probe
// does not ask the patched instrument anything it could confirm about itself.
//
// For each newly-reported mesh pair it prints three INDEPENDENT numbers:
//   raw       three-mesh-bvh's own closestPointToGeometry, unwrapped — the
//             library's verdict, reached without sampledVerdict at all
//   sampled   barycentric samples of one surface measured against the other's
//             tree: a sound UPPER BOUND on the true surface distance
//   mc        meshClearance, the patched wrapper
//
// The witness only RESTORES the library's answer, it never manufactures one,
// so raw ≈ 0 on every row is the proof that nothing was invented. A row where
// raw is large and mc is 0 would be a false positive and the patch's bug.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8463);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'],
  { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });

const res = await page.evaluate(async () => {
  const THREE = await import('three');
  const I = await import('./src/inspect.js');
  const clock = window.__clock;
  const out = [];
  clock.resetInputs();

  const unit = (n) => clock.labelEntries.find((x) => x.name === n);
  const meshesOf = (e) => {
    const m = []; e.obj.traverse((o) => {
      if (o.isMesh && !o.userData.schematic && o.geometry?.attributes?.position) m.push(o);
    }); return m;
  };
  const label = (m, list) => m.name || `${m.geometry.type}#${list.indexOf(m)}`;

  const sampledMin = (src, dst) => {
    const tree = dst.geometry.boundsTree;
    if (!tree) return NaN;
    const inv = new THREE.Matrix4().copy(dst.matrixWorld).invert();
    const pos = src.geometry.attributes.position, idx = src.geometry.index;
    const n = idx ? idx.count / 3 : pos.count / 3;
    const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3(), p = new THREE.Vector3();
    const LAT = []; const N = 5;
    for (let i = 0; i <= N; i++) for (let j = 0; i + j <= N; j++) LAT.push([i / N, j / N, 1 - i / N - j / N]);
    let best = Infinity;
    for (let t = 0; t < n; t++) {
      const a = idx ? idx.getX(t * 3) : t * 3, b = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, c = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
      vA.fromBufferAttribute(pos, a); vB.fromBufferAttribute(pos, b); vC.fromBufferAttribute(pos, c);
      src.localToWorld(vA); src.localToWorld(vB); src.localToWorld(vC);
      for (const [u, v, w] of LAT) {
        p.set(vA.x * u + vB.x * v + vC.x * w, vA.y * u + vB.y * v + vC.y * w, vA.z * u + vB.z * v + vC.z * w).applyMatrix4(inv);
        const hit = tree.closestPointToPoint(p, {}, 0, best);
        if (hit && hit.distance < best) best = hit.distance;
        if (best === 0) return 0;
      }
    }
    return best;
  };

  const PAIRS = [
    ['Alarm switch', 'Case'], ['Case', 'Dial'],
    ['Alarm disc', 'Hour wheel'], ['Alarm selector', 'Alarm selector'],
    ['Alarm winding arrest', 'Alarm winding arrest'],
  ];
  for (const [ua, ub] of PAIRS) {
    const A = unit(ua), B = unit(ub);
    if (!A || !B) { out.push(`${ua} ⇄ ${ub}: unit missing`); continue; }
    const ma = meshesOf(A), mb = meshesOf(B);
    // Worst (smallest) meshClearance pair inside this unit pair.
    let best = Infinity, pick = null;
    for (const x of ma) for (const y of mb) {
      if (x === y) continue;
      const d = I.meshClearance(x, y, best === Infinity ? Infinity : best + 1e-6);
      if (d < best) { best = d; pick = [x, y]; }
    }
    if (!pick) { out.push(`${ua} ⇄ ${ub}: no pair`); continue; }
    const [x, y] = pick;
    const m = new THREE.Matrix4().copy(x.matrixWorld).invert().multiply(y.matrixWorld);
    const raw = x.geometry.boundsTree
      ? x.geometry.boundsTree.closestPointToGeometry(y.geometry, m, {}, {}, 0, Infinity) : null;
    const s1 = sampledMin(y, x);
    out.push(`${ua} ⇄ ${ub}`);
    out.push(`  worst mesh pair: ${label(x, ma)}  ⇄  ${label(y, mb)}`);
    out.push(`    raw     ${raw ? raw.distance.toFixed(4) : 'null'}`);
    out.push(`    sampled ${Number.isFinite(s1) ? s1.toFixed(4) : 'n/a'}`);
    out.push(`    mc      ${best.toFixed(4)}`);
    const verdict = raw && raw.distance <= 0.001 && best <= 0.001 ? 'TRUE POSITIVE — library agrees independently'
      : best <= 0.001 ? '*** SUSPECT: mc says contact, library does not ***'
      : 'apart';
    out.push(`    → ${verdict}`);
    out.push('');
  }
  return out;
});
console.log(res.join('\n'));
await browser.close();
srv.kill();
