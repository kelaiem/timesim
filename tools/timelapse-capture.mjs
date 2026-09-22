// Timelapse capture — one frame per hosted release per camera preset, so the
// movement's evolution can be scrubbed as a film.
//
// REPORT, not acceptance: it writes frames and a manifest and never judges
// them. Every release in tools/timelapse-releases.json is extracted from its
// git TAG (the same tree release.yml deployed, minus the ?v= stamp) into a
// scratch directory, served over one static server, and booted in its OWN
// browser context — one context per release, because every release saves its
// state under the same localStorage key and a shared origin would hand 0.4.2's
// camera and τ to 0.5.0. Service workers are blocked for the same reason:
// each release registers ./sw.js under its own scope and would happily serve
// its neighbour's stale modules.
//
// The camera is aimed by CLICKING the release's own preset button
// (`[data-cam="Dial"]` etc. — the four names Dial, Train, Escapement, Free
// exist in every release since 0.1; Setting arrived at 1.5.3 and is not
// captured), so each frame shows what that release's viewer saw when they
// pressed the button: the framing is derived from that release's own plate
// radius, which is the honest picture — a fixed world pose would crop the
// movement as the plate grew. `reducedMotion: 'reduce'` snaps the tween on
// releases that honour it (§72 on); older ones tween over 0.9 s, so the frame
// waits for the camera to stop moving rather than for a fixed delay.
//
// `?schematic=0` is on the URL because §69 made the line drawing the boot
// DEFAULT; releases before it ignore the parameter. The chrome is hidden by
// element (everything in <body> that is neither the canvas nor one of its
// ancestors gets `visibility: hidden`) rather than by id, because the HUD's
// ids changed across the summer and the canvas did not. τ is pinned to 0
// before each render so the hands read each release's own boot pose
// (DIAL_EPOCH) and the balance stands at a known phase; the rAF loop may
// still tick once between that render and the capture, which is the one
// source of jitter here and is at most a frame's worth of τ.
//
//   node tools/timelapse-capture.mjs [--out DIR] [--only 0.4.2,3.4.4]
//                                    [--jobs 3] [--views Dial,Train,Escapement,Free]
//                                    [--width 1200] [--height 900] [--force] [--gpu]
//
// `--gpu` is for a machine with a graphics card. Playwright's default headless
// browser is the headless SHELL, which renders WebGL through SwiftShader
// whatever the hardware — measured on the dev container, 60–90 s per release
// with three in flight, about 90 min for the series. The flag launches the
// full Chromium build headless with the GPU blocklist ignored, which is the
// path that reaches Metal/ANGLE on a Mac; each boot is then seconds. Untested
// on the container (it has no GPU to reach), so if a frame comes back black
// under it, drop the flag — SwiftShader is slow, not wrong.
//
// Output: DIR/frames/<version>/<View>.png and DIR/manifest.json (the roster
// enriched with each tag's commit date and SHA, per-frame camera pose, boot
// time, and every console error the boot printed — read those before trusting
// a frame). Frames already on disk are skipped unless --force.
import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const argv = process.argv.slice(2);
const opt = (name, dflt) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : dflt; };
const has = (name) => argv.includes(name);
const out = path.resolve(opt('--out', path.join(repo, '..', 'timelapse-out')));
const only = opt('--only', null)?.split(',').filter(Boolean);
const jobs = parseInt(opt('--jobs', '3'), 10);
const views = opt('--views', 'Dial,Train,Escapement,Free').split(',');
const width = parseInt(opt('--width', '1200'), 10);
const height = parseInt(opt('--height', '900'), 10);
const force = has('--force');
const gpu = has('--gpu');

const roster = JSON.parse(fs.readFileSync(path.join(here, 'timelapse-releases.json'), 'utf8'));
const git = (...a) => execFileSync('git', a, { cwd: repo, encoding: 'utf8' }).trim();

// Enrich the roster with what git knows about each tag.
let releases = roster.releases.map((r) => {
  const sha = git('rev-list', '-n', '1', r.version);
  const committed = git('log', '-1', '--format=%cI', sha);
  const subject = git('log', '-1', '--format=%s', sha);
  return { ...r, sha, committed, subject, url: roster.host + r.version + '/' };
});
releases.sort((a, b) => a.committed.localeCompare(b.committed) || cmpVer(a.version, b.version));
function cmpVer(a, b) {
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) { const d = (pa[i] || 0) - (pb[i] || 0); if (d) return d; }
  return 0;
}
const todo = only ? releases.filter((r) => only.includes(r.version)) : releases;
if (only && todo.length !== only.length) throw new Error(`--only names a version not in the roster: ${only.filter((v) => !todo.some((r) => r.version === v))}`);

// Extract each tag's tree once. `git archive` gives the committed tree exactly.
const relRoot = path.join(out, 'rel');
fs.mkdirSync(relRoot, { recursive: true });
for (const r of todo) {
  const dir = path.join(relRoot, r.version);
  if (fs.existsSync(path.join(dir, 'index.html'))) continue;
  fs.mkdirSync(dir, { recursive: true });
  execFileSync('sh', ['-c', `git archive ${r.sha} | tar -x -C ${JSON.stringify(dir)}`], { cwd: repo });
}

// One static server over the extracted trees.
const port = await freePort();
const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: relRoot, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
function freePort() {
  return new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
}

const browser = await chromium.launch(gpu
  ? { channel: 'chromium', args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=default'] }
  : {});
const manifestPath = path.join(out, 'manifest.json');
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : { frames: {} };
manifest.host = roster.host;
manifest.views = views;
manifest.viewport = { width, height };
manifest.releases = releases.map(({ version, deployed, sha, committed, subject, url }) => ({ version, deployed, sha, committed, subject, url }));

const queue = todo.slice();
const inProgress = new Set();
const t0 = Date.now();
await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, worker));
async function worker() {
  while (queue.length) {
    const r = queue.shift();
    const frameDir = path.join(out, 'frames', r.version);
    // A twin of this commit is rendering on another worker: wait for it
    // rather than render the same pixels twice.
    if ([...inProgress].some((o) => o.sha === r.sha)) { queue.push(r); await new Promise((res) => setTimeout(res, 3000)); continue; }
    inProgress.add(r);
    try { await one(r, frameDir); } finally { inProgress.delete(r); }
  }
}
async function one(r, frameDir) {
    const done = !force && views.every((v) => fs.existsSync(path.join(frameDir, v + '.png'))) && manifest.frames[r.version];
    if (done) { log(`${r.version}: cached`); return; }
    // Several releases were cut from one commit (0.4.2–0.6.1, 3.0.1/3.0.2):
    // the stamped trees differ only in their ?v=, so the frames are the same
    // pixels and are copied rather than re-rendered.
    const twin = releases.find((o) => o.sha === r.sha && o.version !== r.version && manifest.frames[o.version] && !manifest.frames[o.version].failed
      && views.every((v) => fs.existsSync(path.join(out, 'frames', o.version, v + '.png'))));
    if (twin) {
      fs.mkdirSync(frameDir, { recursive: true });
      for (const v of views) fs.copyFileSync(path.join(out, 'frames', twin.version, v + '.png'), path.join(frameDir, v + '.png'));
      manifest.frames[r.version] = { ...manifest.frames[twin.version], sameAs: twin.version };
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      log(`${r.version}: same commit as ${twin.version}, frames copied`);
      return;
    }
    try {
      manifest.frames[r.version] = await capture(r, frameDir);
      log(`${r.version}: ok (boot ${manifest.frames[r.version].bootMs} ms, ${manifest.frames[r.version].errors.length} console errors)`);
    } catch (e) {
      manifest.frames[r.version] = { failed: String(e && e.message || e) };
      log(`${r.version}: FAILED — ${e && e.message || e}`);
    }
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}
function log(s) { console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] ${s}`); }

async function capture(r, frameDir) {
  fs.mkdirSync(frameDir, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, serviceWorkers: 'block', reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errors = [];
  // SwiftShader's GL driver chatter and the dev-server-only /__state 404 are
  // the headless harness, not the release; everything else is recorded.
  const noise = /GL Driver Message|software WebGL|status of 404/;
  page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !noise.test(m.text())) errors.push(`${m.type()}: ${m.text()}`.slice(0, 300)); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)));
  const tBoot = Date.now();
  try {
    await page.goto(`http://127.0.0.1:${port}/${r.version}/index.html?schematic=0`, { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => !!window.__clock || !!window.__bootError, null, { timeout: 300000 });
    const bootErr = await page.evaluate(() => window.__bootError ? String(window.__bootError.message || window.__bootError) : null);
    if (bootErr) throw new Error('boot failed: ' + bootErr);
    const bootMs = Date.now() - tBoot;
    // Let the first frames paint (the boot screen fades, labels lay out).
    await page.waitForTimeout(500);
    // Stop the page's own frame loop. Under SwiftShader a 1200×900 render is
    // slow enough that a free-running rAF loop keeps the main thread saturated
    // and a screenshot waits 15–20 s for a frame; with the loop stopped every
    // render below is one the script asked for, and the pose it captures is
    // exactly the one it set (no tick can slip in between setPose and the
    // capture). The tween is driven explicitly through __clock.step instead.
    await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
    // Hide everything that is not the canvas.
    await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      const keep = new Set();
      for (let el = canvas; el; el = el.parentElement) keep.add(el);
      for (const el of document.body.querySelectorAll('*')) {
        if (keep.has(el) || canvas.contains(el)) continue;
        el.style.setProperty('visibility', 'hidden', 'important');
      }
    });
    const presets = await page.evaluate(() => [...document.querySelectorAll('[data-cam]')].map((b) => b.dataset.cam));
    const frames = {};
    for (const view of views) {
      if (!presets.includes(view)) { frames[view] = { missing: true }; continue; }
      const pose = await page.evaluate((v) => {
        document.querySelector(`[data-cam="${v}"]`).click();
        const c = window.__clock;
        // Run the 0.9 s tween out (a snap under reduced motion is already
        // there; the steps are then no-ops for the camera). step() also
        // advances τ, which setPose pins back to the boot pose below.
        for (let i = 0; i < 5; i++) c.step(0.25);
        if (c.setPose) c.setPose({ tau: 0 });
        c.render();
        const tgt = c.controls && c.controls.target;
        return { pos: c.camera.position.toArray(), target: tgt ? tgt.toArray() : null, plateR: c.plateR ?? null, dialRadius: c.dialRadius ?? null };
      }, view);
      await page.screenshot({ path: path.join(frameDir, view + '.png'), timeout: 120000 });
      frames[view] = pose;
    }
    return { bootMs, presets, frames, errors };
  } finally {
    await ctx.close();
  }
}

await browser.close();
srv.kill();
const failed = Object.entries(manifest.frames).filter(([, f]) => f.failed);
console.log(`done: ${todo.length} releases, ${failed.length} failed${failed.length ? ' — ' + failed.map(([v]) => v).join(', ') : ''}; manifest at ${manifestPath}`);
