// §152 probe — screenshots of the redesigned reserve sector: dial-on view at
// three tensions, plus an oblique close-up so the shallow recess and the
// proud hand are visible in profile. The canvas is read back with
// toDataURL IN the same evaluate as the scripted camera write + render, so
// OrbitControls/preset tweens (which re-aim the camera every rAF — the
// CLAUDE.md trap) cannot overwrite the pose between render and capture.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const port = '8524';
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader'] });
const p = await b.newPage({ viewport: { width: 900, height: 900 } });
await p.goto(`http://127.0.0.1:${port}/index.html?schematic=0`, { waitUntil: 'load', timeout: 90000 });
await p.waitForFunction(() => !!window.__clock, null, { timeout: 60000 });
const OUT = process.env.OUT || '/tmp/shot152';
const view = async (name, t, cam) => {
  const dataUrl = await p.evaluate(([t, cam]) => {
    const c = window.__clock;
    c.resetInputs();
    c.setPose({ tau: 0.13, crownPullT: 0, leverEngage: 0, tension: t, windAccumTurns: 0 });
    const cx = c.P.dial.x, cy = c.P.dial.y;
    if (cam === 'dial') {
      c.camera.position.set(cx, cy + 8, -48);
      c.camera.up.set(0, 1, 0);
      c.camera.lookAt(cx, cy + 8, -9.4);
    } else { // oblique close-up on the reserve well from below-front
      c.camera.position.set(cx, cy - 4, -26);
      c.camera.up.set(0, 1, 0);
      c.camera.lookAt(cx, cy + 8.5, -9.4);
    }
    c.camera.updateProjectionMatrix();
    c.render();
    return document.querySelector('canvas').toDataURL('image/png');
  }, [t, cam]);
  writeFileSync(`${OUT}-${name}.png`, Buffer.from(dataUrl.split(',')[1], 'base64'));
};
await view('empty', 0, 'dial');
await view('half', 0.5, 'dial');
await view('full', 1, 'dial');
await view('oblique', 1, 'well');
await b.close(); srv.kill();
console.log('done');
