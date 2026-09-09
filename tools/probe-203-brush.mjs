// §203 step 2 probe — REPORT, not a gate: screenshots of the steel finish at
// both ends of the `materials.steel.brush` slider, movement side (Train), the
// crown (Setting) and the case band (Dial), so the GRAIN can be read by eye —
// the slider's law is world-space (flats straight-grained along the declared
// angle, flanks circumferential about the movement axis) and no battery check
// can see a material, so a picture is the only instrument for "does the grain
// run the right way". Each end boots a VIRGIN page with the value seeded into
// the override store (`aestheticsOverrides`, the loader's own path — the same
// road a viewer's drag takes on the next reload), then reads back off the live
// page: both steel materials' roughness and anisotropy (the polished end must
// sit on BRUSH_POLISH_FLOOR with anisotropy at BRUSH_EPS, never 0 — the define
// must stay on), that the compiled fragment shader carries the world-space
// override (`vBrushNormal`), and that boot stayed silent. Prints a table and
// writes PNGs to $OUT-<end>-<view>.png (default /tmp/shot203).
//
// The canvas is read back in the same TASK as the render — nothing awaited
// between them, or the presented buffer is cleared and the PNG is white —
// after the camera preset click, the tween finished by ONE step(1) (the CLAUDE.md trap: rAF is throttled
// under automation, and a preset tween rewrites the camera each frame until
// it converges — and every step() paints, so stepping it 90 times on a
// software GL is minutes per view).
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const port = '8531';
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const OUT = process.env.OUT || '/tmp/shot203';
// Four boots: the two ends, the brushed end with the grain turned 90°, and
// the brushed end AGAIN as the control (0.0% or the diffs mean nothing) —
// the flats' streak must MOVE between the last two (the angle uniform reaches
// the shader) while nothing else in the scene does, and the first two must
// differ everywhere steel is.
const ENDS = [['polished', { brush: 0 }], ['brushed', { brush: 1 }], ['brushed-90', { brush: 1, brushAngleDeg: 90 }],
  // THE CONTROL: the brushed boot again, byte-for-byte the same settings. Its
  // diff against 'brushed' must be 0.0% or the render is not deterministic
  // and the two columns above measure noise, not the finish.
  ['brushed-again', { brush: 1 }]];
// Three presets and one custom view: a crown knob, close, from outside the
// band — a cylinder whose axis is RADIAL, the flank rule's hardest case.
const VIEWS = ['Train', 'Setting', 'Dial', 'Crown'];
const rows = [];
const thumbs = {};   // `${end}/${view}` → 90×90 luminance, for the pairwise diffs below
for (const [name, steel] of ENDS) {
  const ctx = await b.newContext({ viewport: { width: 900, height: 900 } });
  await ctx.addInitScript((v) => {
    localStorage.setItem('aestheticsOverrides', JSON.stringify({ materials: { steel: v } }));
  }, steel);
  const p = await ctx.newPage();
  const errors = [];
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text().slice(0, 160)}`); });
  await p.goto(`http://127.0.0.1:${port}/index.html?schematic=0`, { waitUntil: 'load', timeout: 90000 });
  await p.waitForFunction(() => !!window.__clock, null, { timeout: 60000 });
  for (const view of VIEWS) {
    const { dataUrl, read } = await p.evaluate(async ([view]) => {
      // The module import FIRST: an await between render() and toDataURL yields
      // the task, the frame is presented and the drawing buffer cleared
      // (preserveDrawingBuffer is off), and the read-back is a white square.
      const M = (await import('./src/materials.js')).MATS;
      const c = window.__clock;
      c.resetInputs();
      c.setPose({ tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 0.6, windAccumTurns: 0 });
      if (view === 'Crown') {
        // The knobs carry no name and no label of their own (the 'Alarm crown'
        // label is the UNIT, whose origin is a star wheel inside the movement —
        // the first version of this view aimed there and called it the crown).
        // Find them by what they ARE: caseMetal meshes outside the Case label
        // that stand farthest from the movement axis — the two knobs at the rim.
        const V = (await import('three')).Vector3;
        const caseObj = c.labelEntries.find((l) => l.name === 'Case')?.obj;
        const inCase = (o) => { for (let q = o; q; q = q.parent) if (q === caseObj) return true; return false; };
        let best = null, bestR = -1;
        c.scene.traverse((o) => {
          if (!o.isMesh || o.material !== M.caseMetal || inCase(o)) return;
          const w = o.getWorldPosition(new V());
          const r = Math.hypot(w.x - c.P.dial.x, w.y - c.P.dial.y);
          if (r > bestR) { bestR = r; best = o; }
        });
        const at = best.getWorldPosition(new V());
        const out = new V(at.x - c.P.dial.x, at.y - c.P.dial.y, 0).normalize();   // radially outward from the movement axis
        c.camera.position.copy(at).addScaledVector(out, 9).add(new V(0, 0, -7));
        c.camera.up.set(0, 0, -1);
        c.camera.lookAt(at);
        c.camera.updateProjectionMatrix();
      } else {
        document.querySelector(`[data-cam="${view}"]`).click();
      }
      c.step(1);   // one step past the tween's ~0.9 s: camTween.t >= 1 lands the camera in ONE render (step() paints, and a software GL frame is seconds)
      c.render();
      const canvas = document.querySelector('canvas');
      const dataUrl = canvas.toDataURL('image/png'); // same task as the render, nothing awaited between
      // A 90×90 luminance thumbnail for the pairwise diffs, same task.
      const th = document.createElement('canvas'); th.width = th.height = 90;
      const g = th.getContext('2d'); g.drawImage(canvas, 0, 0, 90, 90);
      const px = g.getImageData(0, 0, 90, 90).data, lum = [];
      for (let i = 0; i < px.length; i += 4) lum.push((px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000);
      const read = { lum };
      for (const k of ['steel', 'caseMetal']) {
        const m = M[k];
        read[k] = { roughness: +m.roughness.toFixed(4), anisotropy: m.anisotropy,
          override: !!(m.userData.shader && m.userData.shader.fragmentShader.includes('vBrushNormal')) };
      }
      read.bootWarns = (c.bootWarns || []).length;
      return { dataUrl, read };
    }, [view]);
    writeFileSync(`${OUT}-${name}-${view}.png`, Buffer.from(dataUrl.split(',')[1], 'base64'));
    thumbs[`${name}/${view}`] = read.lum; delete read.lum;
    rows.push({ end: name, view, ...Object.fromEntries(Object.entries(read).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : v])), consoleErrors: errors.length });
  }
  if (errors.length) console.log(`[${name}] console: ${errors.slice(0, 5).join(' | ')}`);
  await ctx.close();
}
console.table(rows);
// Pairwise diffs on the thumbnails: the share of cells whose luminance moved
// by more than 4/255 between two boots of the same view. polished→brushed
// must move wherever steel is; brushed→brushed-90 must move (the angle
// reaches the shader) and move LESS (only the flats' streak turns).
const diff = (a, b) => { let n = 0; for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 4) n++; return (100 * n / a.length).toFixed(1) + '%'; };
const pairs = [];
for (const view of VIEWS) {
  pairs.push({ view, 'polished→brushed': diff(thumbs[`polished/${view}`], thumbs[`brushed/${view}`]),
    'brushed→brushed-90': diff(thumbs[`brushed/${view}`], thumbs[`brushed-90/${view}`]),
    'CONTROL brushed→brushed-again': diff(thumbs[`brushed/${view}`], thumbs[`brushed-again/${view}`]) });
}
console.table(pairs);
await b.close(); srv.kill();
console.log(`shots at ${OUT}-<end>-<view>.png`);
