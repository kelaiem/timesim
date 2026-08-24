import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const ROOT = '/Users/willmon/Documents/dev/timesim/.claude/worktrees/case-schematic';
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
  });
  return out;
});
console.log(res.join('\n'));
await browser.close(); srv.kill();
