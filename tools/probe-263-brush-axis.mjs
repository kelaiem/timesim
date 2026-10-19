// TODO 263 — WHICH WAY DOES THE BRUSHED STEEL'S HIGHLIGHT STRETCH? Acceptance.
//
// A brushed surface's grooves scatter light ACROSS themselves, so a point
// light's highlight on a brushed flat stretches PERPENDICULAR to the grain.
// That is the claim `materials.steel.brushAngleDeg` makes ("the straight
// grain's direction on flats"), and the one TODO 263 found the shader breaking:
// installBrush handed three the grain itself as the anisotropy tangent, and
// three's GGX is rougher ALONG that tangent, so the highlight stretched ALONG
// the grain and every flat read a quarter turn off.
//
// The instrument is the highlight, not a screenshot. It loads the real
// materials.js (installBrush's shader on MATS.steel) into a bare page: one flat
// plate facing the camera, one point light on the camera's axis, no
// environment and no tone mapping. It reads the frame back and takes the
// luminance-weighted second moments of the pixels over half the peak. The
// moments' major axis is the highlight's elongation, and the square root of
// their eigenvalue ratio is how elongated it is.
//
//   1. at brushAngleDeg 0 and 90, full brush, the highlight's major axis lies
//      PERPENDICULAR to the grain (within AXIS_TOL_DEG), and it is elongated;
//   CONTROL must-hit: turning the grain 90° turns the measured axis 90°, so
//      the axis is read off the grain and not off the scene;
//   CONTROL must-miss: at the slider's polished end (brush 0) the highlight is
//      round (ratio under ROUND_MAX), so an elongation is the brush, not the
//      camera or the plate.
//
// Run from tools/: node probe-263-brush-axis.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8611);
const AXIS_TOL_DEG = 10;   // the moments' axis on a 256 px frame reads well inside this
const ELONG_MIN = 1.3;     // a brushed highlight at full anisotropy measures far past this
const ROUND_MAX = 1.15;    // an isotropic one measures 1.0 up to pixel noise

const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
process.on('exit', () => { try { srv.kill(); } catch {} });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
const HARNESS = `<!doctype html><meta charset="utf-8">
<script type="importmap">{"imports":{"three":"./vendor/three.module.js"}}</script>
<script type="module">
import * as THREE from 'three';
import { aesthetics } from './src/aesthetics.js';
import { MATS, applyBrushFromAesthetics } from './src/materials.js';
const N = 256;
const renderer = new THREE.WebGLRenderer({ preserveDrawingBuffer: true, antialias: false });
renderer.setSize(N, N);
renderer.toneMapping = THREE.NoToneMapping;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const plate = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), MATS.steel);   // faces +z, a flat by the brush gate
scene.add(plate);
const light = new THREE.PointLight(0xffffff, 4000, 0, 2);
light.position.set(0, 0, 14);
scene.add(light);
const camera = new THREE.PerspectiveCamera(40, 1, 1, 200);
camera.position.set(0, 0, 40);
camera.lookAt(0, 0, 0);
const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
ctx.canvas.width = ctx.canvas.height = N;
window.measure = (angleDeg, brush) => {
  aesthetics.materials.steel.brushAngleDeg = angleDeg;
  aesthetics.materials.steel.brush = brush;
  renderer.render(scene, camera);   // compile first, so the uniform exists
  applyBrushFromAesthetics();
  renderer.render(scene, camera);
  ctx.clearRect(0, 0, N, N);
  ctx.drawImage(renderer.domElement, 0, 0);
  const px = ctx.getImageData(0, 0, N, N).data;
  const L = new Float32Array(N * N);
  let max = 0;
  for (let i = 0; i < N * N; i++) { L[i] = 0.2126 * px[4 * i] + 0.7152 * px[4 * i + 1] + 0.0722 * px[4 * i + 2]; if (L[i] > max) max = L[i]; }
  let w = 0, mx = 0, my = 0;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const l = L[y * N + x]; if (l < 0.5 * max) continue; w += l; mx += l * x; my += l * y; }
  mx /= w; my /= w;
  let sxx = 0, syy = 0, sxy = 0;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const l = L[y * N + x]; if (l < 0.5 * max) continue;
    const dx = x - mx, dy = -(y - my);   // image y runs down; world y runs up
    sxx += l * dx * dx; syy += l * dy * dy; sxy += l * dx * dy;
  }
  sxx /= w; syy /= w; sxy /= w;
  const tr = sxx + syy, det = sxx * syy - sxy * sxy, d = Math.sqrt(Math.max(0, tr * tr / 4 - det));
  const l1 = tr / 2 + d, l2 = Math.max(1e-9, tr / 2 - d);
  const axisDeg = (Math.atan2(2 * sxy, sxx - syy) / 2) * 180 / Math.PI;   // major axis, world frame
  return { max, axisDeg, ratio: Math.sqrt(l1 / l2) };
};
window.ready = true;
</script>`;
await page.route(`http://127.0.0.1:${PORT}/__probe263.html`, (r) => r.fulfill({ contentType: 'text/html', body: HARNESS }));
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
await page.goto(`http://127.0.0.1:${PORT}/__probe263.html`);
await page.waitForFunction(() => window.ready === true, null, { timeout: 60000, polling: 250 });

const fails = [];
const say = (ok, name, got) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${got}`); if (!ok) fails.push(name); };
// smallest angle between two undirected axes, in degrees
const axisGap = (a, b) => { const d = Math.abs(((a - b) % 180 + 180) % 180); return Math.min(d, 180 - d); };

const r0 = await page.evaluate(() => window.measure(0, 1));
const r90 = await page.evaluate(() => window.measure(90, 1));
const rP = await page.evaluate(() => window.measure(0, 0));
if (!(r0.max > 20 && rP.max > 20)) say(false, 'the highlight is lit', `peaks ${r0.max.toFixed(0)}, ${rP.max.toFixed(0)}`);
say(axisGap(r0.axisDeg, 90) <= AXIS_TOL_DEG && r0.ratio >= ELONG_MIN,
  '1. grain at 0°: the highlight stretches across it (axis ≈ 90°)', `axis ${r0.axisDeg.toFixed(1)}°, elongation ${r0.ratio.toFixed(2)}`);
say(axisGap(r90.axisDeg, 0) <= AXIS_TOL_DEG && r90.ratio >= ELONG_MIN,
  '1. grain at 90°: the highlight stretches across it (axis ≈ 0°)', `axis ${r90.axisDeg.toFixed(1)}°, elongation ${r90.ratio.toFixed(2)}`);
say(Math.abs(axisGap(r0.axisDeg, r90.axisDeg) - 90) <= AXIS_TOL_DEG,
  'CONTROL must-hit: turning the grain 90° turns the axis 90°', `${axisGap(r0.axisDeg, r90.axisDeg).toFixed(1)}° apart`);
say(rP.ratio < ROUND_MAX,
  'CONTROL must-miss: polished (brush 0) the highlight is round', `elongation ${rP.ratio.toFixed(2)}`);
if (errs.length) say(false, 'page errors', errs.join(' | ').slice(0, 300));
console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASS');
await browser.close(); srv.kill();
process.exit(fails.length ? 1 : 0);
