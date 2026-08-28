// IS EVERY CASE BODY A SOLID? Boundary edges per mesh — 0 on a closed one, and
// the locations printed when it is not.
//
// The question CLAUDE.md's trap list makes load-bearing: `meshClearance` guards
// its BVH near-zeros with a parity raycast, which counts crossings and so
// assumes the surface BOUNDS a solid. Through a missing face the count goes odd
// and the body reads as solid everywhere behind it — five of `makeCase`'s
// bodies shipped open, and the movement's setting wheel, three extrusions, a
// torus and a box all reported "inside" a band whose bore they sat a clear
// millimetre inside of.
//
// So this is the FIRST thing to run on any case geometry change, and it is
// fast (~40 s). A sectored band is where it earns its keep: a partial
// revolution is open where it starts and stops, and the caps that close it are
// triangulated from the profile polygon — earcut abandoning part of an outline
// holes a cap without failing.
//
// REPORT: it prints, it does not decide. A body with 0 boundary edges is closed;
// it is not thereby correct.
//
// Run: node tools/probe-case-closed.mjs   (ROOT= to measure a different worktree)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
// Derived, not hardcoded: a probe must run from the worktree that OWNS it, the
// way ci-battery.mjs resolves its own ROOT. The absolute path this replaced was
// one machine's worktree, so every one of these probes was unrunnable anywhere
// else — including from a fresh clone of the branch that ships them. Set ROOT=
// to take the same numbers against a base worktree.
const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const srv = spawn('python3', ['-m', 'http.server', '8453', '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto('http://127.0.0.1:8453/index.html', { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });
const res = await page.evaluate(async () => {
  const clock = window.__clock;
  const e = clock.labelEntries.find((x) => x.name === 'Case');
  const out = [];
  const seen = new Set();
  e.obj.traverse((o) => {
    if (!o.isMesh || o.userData.schematic || !o.geometry?.attributes?.position) return;
    const g = o.geometry;
    const idx = g.index ? g.index.array : null;
    const n = idx ? idx.length : g.attributes.position.count;
    // Weld by quantised position so a seam of duplicated verts does not read
    // as a boundary; then count edges used by exactly one triangle.
    const pos = g.attributes.position;
    const key = new Map(); const vid = new Int32Array(pos.count);
    const Q = 1e5;
    for (let i = 0; i < pos.count; i++) {
      const k = `${Math.round(pos.getX(i) * Q)},${Math.round(pos.getY(i) * Q)},${Math.round(pos.getZ(i) * Q)}`;
      if (!key.has(k)) key.set(k, key.size);
      vid[i] = key.get(k);
    }
    const edge = new Map();
    const tri = (a, b, c) => {
      for (const [u, v] of [[a, b], [b, c], [c, a]]) {
        if (u === v) continue;                 // degenerate (axis collapse)
        const k = u < v ? `${u}_${v}` : `${v}_${u}`;
        edge.set(k, (edge.get(k) || 0) + 1);
      }
    };
    for (let i = 0; i < n; i += 3) {
      const a = idx ? idx[i] : i, b = idx ? idx[i + 1] : i + 1, c = idx ? idx[i + 2] : i + 2;
      tri(vid[a], vid[b], vid[c]);
    }
    let boundary = 0;
    for (const c of edge.values()) if (c === 1) boundary++;
    const name = o.name || g.type;
    if (seen.has(name) && boundary === 0) return;
    seen.add(name);
    out.push(`${boundary === 0 ? 'CLOSED' : 'OPEN  '} ${name.padEnd(18)} boundary edges ${boundary}  (${g.type}, ${pos.count} verts)`);
    if (boundary) {
      // Where the hole is, in the cylindrical terms the case is designed in.
      const rep = new Map();
      for (const [i] of [...key.entries()]) rep.set(rep.size, i);
      const byId = new Map();
      for (const [k, id] of key.entries()) if (!byId.has(id)) byId.set(id, k.split(',').map((n) => +n / Q));
      let shown = 0;
      for (const [k, c] of edge.entries()) {
        if (c !== 1 || shown >= 8) continue;
        const [u, v] = k.split('_').map(Number);
        const A = byId.get(u), B = byId.get(v);
        const cyl = (p) => `r ${Math.hypot(p[0], p[1]).toFixed(2)} az ${(Math.atan2(p[1], p[0]) * 180 / Math.PI).toFixed(1)}° z ${p[2].toFixed(2)}`;
        out.push(`         edge: ${cyl(A)}  →  ${cyl(B)}`);
        shown++;
      }
    }
  });
  return out;
});
console.log(res.join('\n'));
await browser.close(); srv.kill();
