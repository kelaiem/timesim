// §107 — the governor corner in both views: the repaired anchor as solid
// metal, and the line tier's new words for it.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const OUT = process.env.OUT || '/tmp/claude-0/-home-user/135fcf6e-0ec5-50b1-958a-bf0b1f66644d/scratchpad';
const srv = spawn('python3', ['-m', 'http.server', '8464', '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 950 } });
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto('http://127.0.0.1:8464/index.html', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 60000 });
// Camera preset tweens overwrite scripted camera writes each frame until they
// converge (~0.9 s). Let the boot tween finish BEFORE writing, or every shot
// below is the preset's view with our numbers thrown away.
await new Promise((r) => setTimeout(r, 2500));
// Put the camera in FREE mode first. The preset modes are re-applied by the
// rAF loop every frame — not only while a tween converges — so a scripted
// camera write under 'Escapement' is overwritten before the shutter opens.
// dispatched, not clicked: the CAMERA section is collapsed by default and a
// real click needs a visible target.
await page.evaluate(() => document.querySelector('[data-cam="Free"]')?.click());
await new Promise((r) => setTimeout(r, 1500));

const at = await page.evaluate(async () => {
  const THREE = await import('three');
  const clock = window.__clock;
  clock.resetInputs();
  clock.setPose({ tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, windAccumTurns: 0,
    alarmStrikePhase: 14.2, alarmOn: 1, alarmReleased: 1 });
  // aim from the parts themselves — the anchor and the saw, in world space
  const box = new THREE.Box3();
  for (const n of ['Alarm governor', 'Alarm governor anchor']) {
    const u = clock.labelEntries.find((e) => e.name === n);
    if (u) { u.obj.updateWorldMatrix(true, true); box.expandByObject(u.obj); }
  }
  const c = box.getCenter(new THREE.Vector3());
  return [c.x, c.y, c.z];
});
console.log('governor centre', at.map((v) => v.toFixed(2)).join(', '));

const shoot = async (name, sch, from) => {
  // ONE synchronous evaluate: pose, camera, render, read the pixels. Anything
  // that yields hands control back to the rAF loop, which re-applies its own
  // camera and clears the drawing buffer — which is why the obvious
  // set-camera-then-screenshot never produced the corner it was aimed at.
  const url = await page.evaluate(([f, a, l]) => {
    const clock = window.__clock;
    clock.camera.layers.set(l ? 1 : 0);
    clock.camera.up.set(0, 1, 0);
    clock.camera.position.set(a[0] + f[0], a[1] + f[1], a[2] + f[2]);
    clock.camera.lookAt(a[0], a[1], a[2]);
    clock.camera.updateProjectionMatrix();
    clock.render();
    return document.querySelector('canvas').toDataURL('image/png');
  }, [from, at, sch]);
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(url.split(',')[1], 'base64'));
  console.log('wrote', name);
};

for (const [name, sch, from] of [
  ['107-solid-plan', 0, [0, 0, 22]],
  ['107-line-plan', 1, [0, 0, 22]],
  ['107-solid-rake', 0, [-8, -12, 15]],
  ['107-line-rake', 1, [-8, -12, 15]],
]) await shoot(name, sch, from);

const counts = await page.evaluate(() => {
  const clock = window.__clock;
  let proxies = 0, meshes = 0;
  for (const n of ['Alarm governor', 'Alarm governor anchor']) {
    const u = clock.labelEntries.find((e) => e.name === n);
    if (u) u.obj.traverse((o) => { if (o.userData?.schematic) proxies++; else if (o.isMesh) meshes++; });
  }
  return { proxies, meshes };
});
console.log('Alarm governor + anchor:', JSON.stringify(counts));
// The CALLOUTS are DOM, not canvas, so toDataURL cannot see them — they are
// verified where they live. Drive the REAL control (not camera.layers), so
// SCHEMATIC.on is genuinely true and updateLabels runs the schematic branch.
// Note the tier ships ON by default, so this asserts a state, never toggles.
const setTier = async (want) => {
  await page.evaluate((w) => {
    const b = document.getElementById('btn-schematic');
    if (b && (b.dataset.state === 'on') !== w) b.click();
    const l = document.getElementById('btn-labels');
    if (l && l.dataset.state !== 'on') l.click();
  }, want);
  await new Promise((r) => setTimeout(r, 1200));
};
const sample = async () => page.evaluate(() => {
  const els = [...document.querySelectorAll('.clock-callout')];
  const shown = els.filter((e) => e.style.display === 'block');
  return {
    tier: document.getElementById('btn-schematic')?.dataset.state,
    total: els.length, shown: shown.length,
    sample: shown.slice(0, 6).map((e) => `${e.textContent} @ ${Math.round(parseFloat(e.style.left))},${Math.round(parseFloat(e.style.top))}`),
  };
});
await setTier(true);
console.log('tier ON  ->', JSON.stringify(await sample()));
await setTier(false);
console.log('tier OFF ->', JSON.stringify(await sample()));
await browser.close(); srv.kill();
