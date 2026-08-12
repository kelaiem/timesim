// §104 — regenerate explain.html plate geometry from the BUILT parts:
// PLATE 1's two alarm-ribbon frames (the set-up changed both ends of the
// wind) and the new governor plate's saw/pallet/ring outlines.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const srv = spawn('python3', ['-m', 'http.server', '8451', '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://127.0.0.1:8451/index.html', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 60000 });
const res = await page.evaluate(async () => {
  const clock = window.__clock;
  const out = [];
  const bar = clock.labelEntries.find((e) => e.name === 'Alarm barrel');
  let ribbon = null, spring = null;
  bar.obj.traverse((o) => {
    if (!ribbon && o.isMesh && o.name === 'mainspringRibbon') ribbon = o;
    if (!spring && o.userData && o.userData.mainspring) spring = o.userData.mainspring;
  });
  const frames = ribbon.userData.spiralFrames;
  out.push(`frames ${frames.length}, innerAnchorAz ${spring.innerAnchorAz.toFixed(5)} rad, sweepFull ${(spring.sweepFull / Math.PI / 2).toFixed(4)} turns, sweepDown ${(spring.sweepDown / Math.PI / 2).toFixed(4)}, free ${(spring.sweepFree / Math.PI / 2).toFixed(4)}`);
  out.push(`capacity ${spring.capacity.toFixed(4)}, minPitch ${spring.minPitch.toFixed(4)}, pBind ${spring.pBind.toFixed(5)}, innerR ${spring.innerR.toFixed(4)}, outerR ${spring.outerR.toFixed(4)}, devLen ${spring.devLen.toFixed(3)}`);
  const S = 96 / 5.595; // px per unit — the plate's stated scale
  const pathOf = (pts, cx, cy) => {
    const step = Math.max(1, Math.floor(pts.length / 260));
    const sel = [];
    for (let i = 0; i < pts.length; i += step) sel.push(pts[i]);
    if (sel[sel.length - 1] !== pts[pts.length - 1]) sel.push(pts[pts.length - 1]);
    return sel.map((p, i) => `${i ? 'L' : 'M'} ${(cx + p[0] * S).toFixed(1)} ${(cy - p[1] * S).toFixed(1)}`).join(' ');
  };
  out.push('--- WOUND (frame 0) path, centre 170,120:');
  out.push(pathOf(frames[0], 170, 120));
  out.push('--- RUN DOWN (last frame) path, centre 560,120:');
  out.push(pathOf(frames[frames.length - 1], 560, 120));
  // hook marker: inner end of each drawn frame (first point of the walk)
  for (const [label, f, cx] of [['wound', frames[0], 170], ['down', frames[frames.length - 1], 560]]) {
    const p = f[0];
    out.push(`hook ${label}: rect x ${(cx + p[0] * S - 1.6).toFixed(1)} y ${(120 - p[1] * S - 1.6).toFixed(1)} (end at ${(cx + p[0] * S).toFixed(1)}, ${(120 - p[1] * S).toFixed(1)})`);
  }
  // Governor plate: saw outline + pallet polygons + ring, in a shared frame.
  // §107 split the anchor into its own unit, so a lookup of one name no longer
  // reaches the whole mechanism — this spans both halves.
  const govUnits = clock.labelEntries.filter((e) => e.name === 'Alarm governor' || e.name === 'Alarm governor anchor');
  const gov = govUnits[0] && { name: 'Alarm governor (+ anchor)', obj: { traverse: (f) => govUnits.forEach((u) => u.obj.traverse(f)), updateWorldMatrix: (a, b) => govUnits.forEach((u) => u.obj.updateWorldMatrix(a, b)) } };
  let saw = null;
  gov.obj.traverse((o) => { if (!saw && o.userData && o.userData.profile) saw = o; });
  const prof = saw.userData.profile;
  out.push(`saw teeth poly pts ${prof.poly.length}, hubR ${prof.hubR}, boreR ${prof.boreR.toFixed(3)}, saw rot ${saw.rotation.z.toFixed(5)}`);
  return out;
});
console.log(res.join('\n'));
await browser.close(); srv.kill();
