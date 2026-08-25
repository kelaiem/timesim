import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const ROOT = '/Users/willmon/Documents/dev/timesim/.claude/worktrees/case-schematic';
const srv = spawn('python3', ['-m', 'http.server', '8455', '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto('http://127.0.0.1:8455/index.html', { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });
const res = await page.evaluate(async () => {
  const I = await import('./src/inspect.js');
  const THREE = await import('three');
  const clock = window.__clock;
  clock.resetInputs();
  clock.setPose(I.AXES[0].pose(0, clock));
  const unit = (n) => clock.labelEntries.find((x) => x.name === n);
  const meshesOf = (e) => { const m = []; e.obj.traverse((o) => { if (o.isMesh && !o.userData.schematic && o.geometry?.attributes?.position) m.push(o); }); return m; };
  const cm = meshesOf(unit('Case'));
  const mid = cm.find((m) => m.name === 'caseMiddle');
  // the seat ledge's own window, read off caseMiddle rather than restated
  const bb = new THREE.Box3().setFromObject(mid);
  const out = [];
  // derive the ledge from the dims the builder used: R_SH is caseMiddle's
  // innermost radius, and the ledge's z span is where that radius occurs.
  const p = mid.geometry.attributes.position; const v = new THREE.Vector3();
  let rMin = Infinity, rOut = -Infinity;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); mid.localToWorld(v);
    const r = Math.hypot(v.x, v.y); rMin = Math.min(rMin, r); rOut = Math.max(rOut, r);
  }
  // R_SH (plate seat) and R_FL (back flange) are both plateR-ish minus 2 mm and
  // land within 1e-3 of each other, so "innermost radius" cannot tell the seat
  // from the flange — it spanned the whole case in z. Take the seat's band from
  // the constants that define it instead: zSeatTop is the plate's dial-side
  // face (BACK_PLATE_Z - BACK_PLATE_T/2) and the step is 0.8 mm.
  const UNIT_MM = 1 / (clock.P?.unitMM ?? 0.3788);   // u per mm
  const zHi = -1 - 2 / 2, zLo = zHi - 0.8 * UNIT_MM;
  out.push(`seat ledge: R_SH ${rMin.toFixed(3)}, z ${zLo.toFixed(3)}..${zHi.toFixed(3)}`);
  const arc = (azs) => {
    if (!azs.length) return null;
    const s = azs.slice().sort((a, b) => a - b);
    let gap = (s[0] + Math.PI * 2) - s[s.length - 1], at = s.length - 1;
    for (let i = 1; i < s.length; i++) if (s[i] - s[i - 1] > gap) { gap = s[i] - s[i - 1]; at = i - 1; }
    const start = s[(at + 1) % s.length], span = Math.PI * 2 - gap;
    return { startDeg: start * 180 / Math.PI, spanDeg: span * 180 / Math.PI };
  };
  const all = [];
  for (const other of clock.labelEntries.map((e) => e.name)) {
    if (other === 'Case') continue;
    const E = unit(other); if (!E) continue;
    for (const B of meshesOf(E)) {
      const g = B.geometry, q = g.attributes.position; const azs = []; let deepest = Infinity;
      for (let i = 0; i < q.count; i++) {
        v.fromBufferAttribute(q, i); B.localToWorld(v);
        const r = Math.hypot(v.x, v.y);
        if (v.z < zLo || v.z > zHi) continue;      // outside the ledge's z
        if (r < rMin || r > rOut) continue;         // inboard of the ledge, or outside the band entirely
        azs.push(Math.atan2(v.y, v.x)); deepest = Math.min(deepest, r);
      }
      if (!azs.length) continue;
      const a = arc(azs); all.push(...azs);
      out.push(`  ${other} / ${B.name || g.type}: ${azs.length} verts in the ledge, `
        + `az ${a.startDeg.toFixed(1)}° span ${a.spanDeg.toFixed(1)}°, deepest r ${deepest.toFixed(2)}`);
    }
  }
  const u = arc(all);
  out.push(`\nUNION of every fouling vertex: az ${u.startDeg.toFixed(1)}° span ${u.spanDeg.toFixed(1)}°`);
  return out;
});
console.log(res.join('\n'));
await browser.close(); srv.kill();
