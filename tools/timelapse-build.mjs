// Timelapse build — turns tools/timelapse-capture.mjs's frames into the
// scrubbable site: sprite sheets per view, a data block, and the viewer page.
//
// REPORT, not acceptance: it writes a site and prints what it wrote.
//
// Why sheets and not one file per frame: the viewer scrubs 91 releases with a
// slider, and a slider that waits on a network round trip per notch is not a
// timelapse. A sheet of 20 frames (5 × 4 cells) is one request per 20 notches
// and decodes to about 30 MB, which a phone tolerates; one sheet of all 91
// would decode to 120 MB and the whole run would wait on it. The cell size is
// 640 × 480 — the capture's 1200 × 900 scaled by 8/15 — because the viewer
// fits the stage to the window and nothing in it is read at full size.
//
// WebP is encoded by CHROMIUM (canvas.toDataURL) rather than ffmpeg because
// Playwright's ffmpeg carries only png and libvpx encoders and no tile filter;
// the same browser that rendered the frames composes and encodes the sheets.
// `--video` additionally writes one VP8 .webm per view through that ffmpeg —
// the film form of the same frames, for anywhere a slider cannot go — fed as
// Chromium-encoded JPEGs, since that ffmpeg decodes only MJPEG and VP8.
//
//   node tools/timelapse-build.mjs [--out DIR] [--site DIR] [--video] [--quality 0.82]
//
// DIR defaults to ../timelapse-out (the capture's default); the site lands in
// DIR/site: index.html (standalone), artifact.html (the same page without the
// document skeleton, for hosts that wrap one), sheets/<View>-<n>.webp, and,
// with --video, video/<View>.webm.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const argv = process.argv.slice(2);
const opt = (name, dflt) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : dflt; };
const out = path.resolve(opt('--out', path.join(repo, '..', 'timelapse-out')));
const site = path.resolve(opt('--site', path.join(out, 'site')));
const quality = parseFloat(opt('--quality', '0.82'));
const video = argv.includes('--video');

const CELL = { w: 640, h: 480 };
const COLS = 5, ROWS = 4, PER = COLS * ROWS;

const manifest = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8'));
const views = manifest.views;
// Only releases with a captured frame in EVERY view are in the film; a
// failed boot is reported here and left out rather than shown as a blank.
const releases = manifest.releases.filter((r) => {
  const f = manifest.frames[r.version];
  const ok = f && !f.failed && views.every((v) => fs.existsSync(path.join(out, 'frames', r.version, v + '.png')));
  if (!ok) console.log(`skip ${r.version}: ${f ? f.failed || 'frame missing' : 'not captured'}`);
  return ok;
});
console.log(`${releases.length} releases × ${views.length} views`);

fs.mkdirSync(path.join(site, 'sheets'), { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('about:blank');

const sheets = {};
let bg = null;
for (const view of views) {
  sheets[view] = [];
  for (let n = 0; n * PER < releases.length; n++) {
    const batch = releases.slice(n * PER, (n + 1) * PER);
    const srcs = batch.map((r) => 'data:image/png;base64,' + fs.readFileSync(path.join(out, 'frames', r.version, view + '.png')).toString('base64'));
    const { dataUrl, corner } = await page.evaluate(async ({ srcs, CELL, COLS, ROWS, quality }) => {
      const canvas = document.createElement('canvas');
      canvas.width = CELL.w * COLS; canvas.height = CELL.h * ROWS;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      let corner = null;
      for (let i = 0; i < srcs.length; i++) {
        const img = new Image();
        await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = srcs[i]; });
        ctx.drawImage(img, (i % COLS) * CELL.w, Math.floor(i / COLS) * CELL.h, CELL.w, CELL.h);
        if (!corner) { const p = ctx.getImageData(0, 0, 1, 1).data; corner = '#' + [p[0], p[1], p[2]].map((x) => x.toString(16).padStart(2, '0')).join(''); }
      }
      return { dataUrl: canvas.toDataURL('image/webp', quality), corner };
    }, { srcs, CELL, COLS, ROWS, quality });
    bg = bg || corner;
    const file = `sheets/${view}-${n}.webp`;
    fs.writeFileSync(path.join(site, file), Buffer.from(dataUrl.split(',')[1], 'base64'));
    sheets[view].push(file);
    console.log(`${file}: ${batch.length} frames, ${(fs.statSync(path.join(site, file)).size / 1024).toFixed(0)} KB`);
  }
}

// Films, while the page is still open: the frames go to ffmpeg as JPEGs
// encoded by Chromium, because the bundled ffmpeg decodes MJPEG and VP8 and
// nothing else (no PNG decoder, no `image2` demuxer for numbered files) — it is
// built for Playwright's screen recording, and this is that path fed by hand.
if (video) {
  const ff = fs.existsSync('/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux') ? '/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux' : 'ffmpeg';
  fs.mkdirSync(path.join(site, 'video'), { recursive: true });
  for (const view of views) {
    const jpegs = [];
    for (const r of releases) {
      const src = 'data:image/png;base64,' + fs.readFileSync(path.join(out, 'frames', r.version, view + '.png')).toString('base64');
      const dataUrl = await page.evaluate(async (src) => {
        const img = new Image();
        await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = src; });
        const c = document.createElement('canvas'); c.width = 960; c.height = 720;
        const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, 960, 720);
        return c.toDataURL('image/jpeg', 0.92);
      }, src);
      jpegs.push(Buffer.from(dataUrl.split(',')[1], 'base64'));
    }
    const seq = path.join(out, `seq-${view}.mjpeg`);
    fs.writeFileSync(seq, Buffer.concat(jpegs));
    const file = path.join(site, 'video', view + '.webm');
    // 4 frames per second: 91 releases in about 23 s, slow enough to read a
    // release's frame and fast enough to read as motion.
    execFileSync(ff, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', '4', '-i', seq, '-c:v', 'libvpx', '-b:v', '3M', '-auto-alt-ref', '0', '-pix_fmt', 'yuv420p', file]);
    fs.rmSync(seq);
    console.log(`${path.relative(site, file)}: ${(fs.statSync(file).size / 1024 / 1024).toFixed(1)} MB`);
  }
}
await browser.close();

const data = {
  host: manifest.host,
  bg,
  views,
  cell: CELL, cols: COLS, rows: ROWS, per: PER,
  sheets,
  releases: releases.map(({ version, deployed, committed, subject, url }) => ({ version, deployed, committed, subject, url })),
};
const template = fs.readFileSync(path.join(here, 'timelapse', 'viewer.html'), 'utf8');
const body = template.replace('/*__DATA__*/', () => JSON.stringify(data));
fs.writeFileSync(path.join(site, 'artifact.html'), body);
fs.writeFileSync(path.join(site, 'index.html'),
  `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n</head>\n<body>\n${body}\n</body>\n</html>\n`);
console.log(`viewer: ${path.join(site, 'index.html')} (${(body.length / 1024).toFixed(0)} KB)`);
