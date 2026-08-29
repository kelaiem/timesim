// HOW NARROW CAN THE BEZEL GO — the join-hiding requirement, measured
// instead of stated.
//
// REPORT. Written for the case-redesign scope (roadmap): the visible bezel is
// 3.00 mm = three 1 mm terms (dial cover + CASE_CLEAR + CASE_BAND_T), and the
// first term — §125's "the CASE, not the plate's rim, covers the join" — is a
// STATED spend, nowhere derived. This measures what that term actually has to
// hide and where the dial's printed content ends, so the entry can derive a
// floor instead of inheriting a round number.
//
// Geometry half (this file): the radii of (a) the dial's outermost printed
// content, (b) the dial disc's edge, (c) the base plate's authored rim and
// real (bevel-swollen) reach — the JOIN the bezel exists to hide is (b)/(c),
// which are the same circle by §125's dialRadius = plateR. The minimum lip is
// then (real plate reach − bezel inner radius) for pure seam-hiding, plus
// whatever retention the crystal needs — a DESIGN term the entry owns.
//
// Render half: grazing-angle screenshots down the bezel (probe-153-shot's
// idiom: camera write + render + toDataURL in ONE evaluate, so preset tweens
// cannot re-aim between render and capture) at three candidate lips, saved
// beside this file for the entry to cite. The eye judges seam visibility;
// the numbers above bound it.
//
// What this is NOT: probe-116-locale-fit measures header fit; the §125 record
// derives dialRadius. Nothing measures the bezel's cover, which is this
// file's one question.
//
// Control: the dial's printed-edge radius must land between the outer chapter
// rail and the disc edge (a print reading outside its own disc means the
// canvas mapping was misread — exit 2).
//
// Run: node tools/probe-bezel-cover.mjs   (ROOT= for another worktree)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const srv = spawn('python3', ['-m', 'http.server', '8515', '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
// ?schematic=0 — the line tier is the default view and a screenshot of it
// shows wireframes, not the bezel; the case itself defaults ON (caseLines).
await page.goto('http://127.0.0.1:8515/index.html?schematic=0', { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 120000 });

const res = await page.evaluate(async () => {
  const THREE = await import('three');
  const clock = window.__clock;
  const v = new THREE.Vector3();
  // (a) printed content: the dial face is a canvas texture on a disc; the
  // print frame constants are geometry.js's DIAL_RAIL_OUT_F etc. Read the
  // BUILT numbers instead of restating: sample the face canvas for the
  // outermost non-background pixel ring.
  let dialFace = null;
  clock.scene.traverse((o) => {
    if (dialFace || !o.isMesh) return;
    const img = o.material?.map?.image;
    if (img && img.getContext) dialFace = o;
  });
  let printEdgeR = null, discR = null;
  if (dialFace) {
    const img = dialFace.material.map.image;
    const ctx = img.getContext('2d');
    const W = img.width, C = W / 2;
    const d = ctx.getImageData(0, 0, W, W).data;
    // background = the pixel just inside the rim at 45° (unprinted face tone)
    const bgAt = (r, a) => {
      const x = Math.round(C + Math.cos(a) * r), y = Math.round(C + Math.sin(a) * r);
      const i = (y * W + x) * 4; return [d[i], d[i + 1], d[i + 2]];
    };
    const diff = (p, q) => Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2]);
    // scan inward from the rim on 360 spokes; note the first radius where the
    // pixel departs the local background by > 40 (ink or zone fill)
    let outer = 0;
    for (let k = 0; k < 360; k++) {
      const a = k / 360 * Math.PI * 2;
      const bg = bgAt(C - 3, a);
      for (let r = C - 4; r > C * 0.5; r--) {
        if (diff(bgAt(r, a), bg) > 40) { if (r > outer) outer = r; break; }
      }
    }
    // canvas px → world: the disc's world radius corresponds to C px
    dialFace.updateWorldMatrix(true, true);
    const p = dialFace.geometry.attributes.position;
    let rw = 0;
    for (let i = 0; i < p.count; i++) { dialFace.localToWorld(v.fromBufferAttribute(p, i)); rw = Math.max(rw, Math.hypot(v.x - clock.P.dial.x, v.y - clock.P.dial.y)); }
    discR = rw;
    printEdgeR = outer / C * rw;
  }
  // (c) the base plate's authored and real rim
  let plate = null; clock.scene.traverse((o) => { if (o.name === 'backPlate' && !plate) plate = o; });
  let plateReal = 0;
  { plate.updateWorldMatrix(true, true); const p = plate.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) { plate.localToWorld(v.fromBufferAttribute(p, i)); plateReal = Math.max(plateReal, Math.hypot(v.x, v.y)); } }
  // the shipped bezel inner radius, off the built case
  let bezIn = Infinity;
  clock.scene.traverse((o) => {
    if (o.name !== 'caseMiddle') return;
    const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      o.localToWorld(v.fromBufferAttribute(p, i));
      if (v.z < -17.0) bezIn = Math.min(bezIn, Math.hypot(v.x, v.y));   // front of the band only
    }
  });
  return { printEdgeR, discR, plateR: clock.plateR, plateReal, bezIn, dialXY: [clock.P.dial.x, clock.P.dial.y] };
});

const MM = 0.378947;
console.log(`dial disc edge r          ${res.discR.toFixed(4)} u  (= plateR ${res.plateR.toFixed(4)} by §125)`);
console.log(`outermost printed content ${res.printEdgeR.toFixed(4)} u  → unprinted rim ${(res.discR - res.printEdgeR).toFixed(4)} u = ${((res.discR - res.printEdgeR) * MM).toFixed(3)} mm`);
console.log(`base plate real reach     ${res.plateReal.toFixed(4)} u  (bevel past the authored rim: ${(res.plateReal - res.plateR).toFixed(4)} u)`);
console.log(`shipped bezel inner r     ${res.bezIn.toFixed(4)} u  → covers ${(res.discR - res.bezIn).toFixed(4)} u = ${((res.discR - res.bezIn) * MM).toFixed(3)} mm of dial edge`);
console.log(`\nSEAM-HIDING FLOOR: lip must reach inward past the plate's REAL rim → bezel inner r <= ${res.plateReal.toFixed(4)} − (retention + tolerance, design terms)`);
console.log(`available before covering print: ${(res.printEdgeR).toFixed(4)} .. so a lip at the plate's real rim leaves ${((res.plateReal - res.printEdgeR) * MM).toFixed(3)} mm of covered-but-unprinted dial`);

// Render half: three grazing shots, saved for the entry.
for (const [tag, camY] of [['shipped', -40], ['graze', -70]]) {
  const png = await page.evaluate(async ({ camY }) => {
    // camera write + render + capture in ONE evaluate (probe-153-shot's rule:
    // a preset tween re-aims every rAF, so nothing may run between them).
    const clock = window.__clock;
    clock.camera.position.set(0, camY, -60);
    clock.camera.lookAt(0, 0, -14);
    clock.render();
    return document.querySelector('canvas').toDataURL('image/png');
  }, { camY });
  if (png) writeFileSync(join(ROOT, 'tools', `bezel-${tag}.png`), Buffer.from(png.split(',')[1], 'base64'));
}

let ok = true;
if (!(res.printEdgeR < res.discR && res.printEdgeR > res.discR * 0.8)) {
  ok = false; console.log('\nCONTROL FAIL: the printed edge did not land in the outer fifth of the disc — the canvas mapping was misread');
} else console.log('\nCONTROL PASS: printed edge sits in the disc\'s outer fifth, inside its rim');
await browser.close(); srv.kill();
process.exit(ok ? 0 : 2);
