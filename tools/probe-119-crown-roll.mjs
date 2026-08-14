#!/usr/bin/env node
// §119 — WHAT NO GATE MEASURES: does a crown turn with the knurling under the
// finger, in every view?
//
// §24 and §27 both read the drag's screen X. That is right for the view a
// photograph of a watch is taken from and wrong for the view this app opens
// in — turn the watch dial-first and the knurling runs horizontally too, so
// the gesture that should turn the crown does nothing and the one that does
// nothing on a real crown turns it. §119 replaced the screen axis with the
// contact: â the stem, r̂ the contact's radius out to the knurling, t̂ = â × r̂
// the way that surface travels, projected to the screen.
//
// That is a LAW, and this tests it as one rather than testing one view:
//
//   a drag ALONG the knurling turns (almost) nothing;
//   a drag ACROSS it turns the most;
//   and it holds for both crowns at every camera azimuth.
//
// Not gated, deliberately — the same reasoning as probe-119-pad-targets.mjs
// and probe-116-locale-fit.mjs: these are rendered-browser facts, measured on
// purpose rather than assumed. The axis the roll turns about IS boot-asserted
// in main.js, which is the half a layout change can break.
//
//   node tools/probe-119-crown-roll.mjs
//
// Needs python3 (dev_server.py) and a Playwright Chromium, like ci-battery.
//
// THREE TRAPS, all of them paid for once:
//   · Writing camera.position does not stick — the pose is restored out from
//     under the measurement, so the aim pixel and the raycast end up
//     disagreeing about where the camera is and nothing grabs. The view is
//     changed with the app's own arrow-key orbit instead, which is a path the
//     app supports and which clears camTween.
//   · A press-and-release on a crown is a CLICK, and a click pulls or pushes
//     it (§119 on the pad, §24 in 3D). Reusing one page therefore makes each
//     measurement depend on the ones before it. One fresh page per reading.
//   · The alarm spinner CREEPS on its own (§29 banks hour back-drive into it),
//     so every reading is a difference, never an absolute.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';

const ROOT = '/home/user/timesim';
const port = await new Promise((res, rej) => {
  const s = createServer(); s.on('error', rej);
  s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => res(port)); });
});
const stateDir = mkdtempSync(join(tmpdir(), 'ts-roll-'));
const server = spawn('python3', [join(ROOT, 'dev_server.py'), String(port)],
  { cwd: ROOT, env: { ...process.env, TMPDIR: stateDir }, stdio: 'ignore' });
for (;;) { try { await fetch(`http://127.0.0.1:${port}/index.html`); break; } catch { await new Promise((r) => setTimeout(r, 200)); } }
const browser = await chromium.launch();

async function measure(orbit, knob, mode) {
  const pg = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  await pg.goto(`http://127.0.0.1:${port}/index.html?hud=0&sync=0`, { waitUntil: 'load', timeout: 180000 });
  await pg.waitForFunction(() => !!window.__clock, null, { timeout: 180000 });
  await pg.waitForTimeout(1500);                       // let the boot preset tween converge
  for (let i = 0; i < orbit; i++) await pg.keyboard.press('ArrowLeft');   // 6° each, the app's own step
  await pg.waitForTimeout(300);

  const setup = await pg.evaluate((k) => {
    const c = __clock.camera;
    const knobs = [];
    __clock.scene.traverse((o) => { if (o.userData && o.userData.crown) knobs.push(o); });
    const o = knobs[k], P = o.position.constructor;
    const org = o.getWorldPosition(new P());
    const r = document.querySelector('canvas').getBoundingClientRect();
    const toPx = (p) => { const q = p.clone().project(c); return { x: r.left + (q.x * 0.5 + 0.5) * r.width, y: r.top + (-q.y * 0.5 + 0.5) * r.height }; };
    const ax = new P(0, 0, 1).transformDirection(o.matrixWorld).normalize();
    const vd = c.getWorldDirection(new P());
    const rad = vd.clone().addScaledVector(ax, -vd.dot(ax));
    if (rad.lengthSq() < 1e-9) rad.set(0, 1, 0).addScaledVector(ax, -ax.y);
    rad.normalize().negate();                                  // toward the camera
    const contact = org.clone().addScaledVector(ax, o.userData.crown.bodyH * 0.5)
      .addScaledVector(rad, o.userData.crown.rimR * 0.8);
    const a = toPx(contact), b = toPx(contact.clone().addScaledVector(ax, 2));
    const sx = b.x - a.x, sy = b.y - a.y, sl = Math.hypot(sx, sy) || 1;
    return { aim: a, stem: { x: sx / sl, y: sy / sl },
      cam: [c.position.x, c.position.y, c.position.z].map((n) => +n.toFixed(1)).join(','),
      axisTowardCamera: +Math.abs(ax.dot(vd)).toFixed(2) };   // 1 = crown pointing at you, 0 = broadside
  }, knob);

  const read = () => pg.evaluate((k) => {
    const sp = [];
    __clock.scene.traverse((o) => { if (o.userData && o.userData.crown) sp.push(o.parent.rotation.y); });
    return k === 0 ? __clock.crownRotation : sp[1];
  }, knob);

  const D = 60;
  const dir = mode === 'along' ? setup.stem : { x: -setup.stem.y, y: setup.stem.x };
  await pg.mouse.move(setup.aim.x, setup.aim.y);
  const before = await read();
  await pg.mouse.down();
  const grabbed = await pg.evaluate(() => !__clock.controls.enabled);
  const camAtGrab = await pg.evaluate(() => [__clock.camera.position.x, __clock.camera.position.y, __clock.camera.position.z].map((n) => +n.toFixed(1)).join(','));
  for (let i = 1; i <= 10; i++) await pg.mouse.move(setup.aim.x + dir.x * D * i / 10, setup.aim.y + dir.y * D * i / 10);
  const after = await read();
  await pg.mouse.up();
  await pg.close();
  return { ...setup, grabbed, moved: camAtGrab !== setup.cam, d: after - before };
}

for (const orbit of [0, 12, 24]) {
  console.log(`\n══ camera orbited ${orbit * 6}° from the default`);
  for (const [knob, name] of [[0, 'winding crown'], [1, 'alarm crown  ']]) {
    const al = await measure(orbit, knob, 'along');
    const ac = await measure(orbit, knob, 'across');
    if (!al.grabbed || !ac.grabbed) { console.log(`   ${name}  NOT GRABBED (aim ${al.aim.x.toFixed(0)},${al.aim.y.toFixed(0)}; camera moved under the measurement: ${al.moved})`); continue; }
    console.log(`   ${name}  camera ${al.cam}  knurl runs (${al.stem.x.toFixed(2)},${al.stem.y.toFixed(2)}) on screen, stem·view ${al.axisTowardCamera}`);
    console.log(`      60px ALONG  the knurling → ${al.d.toFixed(4)} rad`);
    console.log(`      60px ACROSS the knurling → ${ac.d.toFixed(4)} rad   (${Math.abs(ac.d) > 1e-9 ? (2 * Math.PI / (Math.abs(ac.d) / 60)).toFixed(0) : '—'} px per full turn)`);
  }
}

await browser.close();
server.kill();
