// DOES THE BOOT BAR TELL THE TRUTH ABOUT WHERE THE BUILD IS? — §267, measured.
//
// The bar is driven by build POSITION: each `await breathe(n)` seam in main.js
// carries a share of the build that a measured boot had spent when it first
// reached that seam (src/boot-progress.js, written by tools/boot-progress.mjs),
// and the bar shows the largest share reached, written at each hand-back. A bar
// is a claim about time, so this holds it to time:
//
//   1. IT TRACKS THE BUILD. Read back from `__clock.boot.progress.writes` — every
//      bar write as [ms after the build's start, share] — against the TRUE
//      elapsed fraction, t / span. Between two writes the bar stands still while
//      the build goes on, so the deviation is read at both edges of every write:
//      just before it (the furthest BEHIND the bar falls) and just after (the
//      furthest AHEAD). Two readings are gated: the time-averaged distance (the
//      sharp one) and the worst moment (a backstop — see the ceilings).
//   2. IT NEVER GOES BACKWARDS, and
//   3. IT SAYS 100% ONLY WHEN THE BUILD IS DONE — every share before the last
//      write under 1, and the last write the guard's release, at the span's end.
//   4. EVERY SEAM IT REACHES IS IN THE TABLE (the run-time half of
//      tools/boot-progress.mjs --check, which holds the source half in CI).
//   5. IT PAINTS MID-BUILD. The bar is pixels, not a style property, so the
//      claim is read off a CDP SCREENCAST (§238's harness — composited frames
//      delivered to this process, where page.screenshot() would need the main
//      thread): the bar's fill read from each frame along its own row, which
//      must reach PAINT_MIN_LEVELS distinct widths inside the build and never
//      shrink.
//
// THE CONTROLS, because a deviation that reads small and a bar that reads as
// moving both have to be able to read otherwise:
//   · ORDINAL (must-fail claim 1): the bar §267's filing rejected — seams passed
//     over seams in source — evaluated at the SAME write times from the SAME
//     boot's first visits. Its average must come back over the ceiling, or the
//     table buys nothing this gate can see and the ceiling is not discriminating.
//     (Its WORST cannot be asked to: the first composited frame sets the worst
//     moment of any bar on a slow host, the ordinal and the table alike.)
//   · FROZEN (must-miss claim 5): main.js served with writeBar's first line
//     made a return, so the bar never moves. The pixel reader must then see ONE
//     level, or it was reading something other than the bar.
//
// It is NOT probe-239-boot-yield.mjs (whether the build lets go of the thread,
// which this rides on) and NOT probe-238-boot-screen.mjs (whether the screen is
// on glass, moving, translated and gone). The screencast run here perturbs the
// timing it would measure — PNG frames are encoded on the GPU process — so
// claims 1–4 come from a boot with no screencast attached.
//
// Usage:
//   node tools/probe-267-boot-progress.mjs                # this checkout
//   node tools/probe-267-boot-progress.mjs --boots 3      # claim 1 over several boots (worst gated)
//   node tools/probe-267-boot-progress.mjs --json <file>  # every gated number as JSON
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import os from 'node:os';

const arg = (f, d) => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : d; };
const ROOT = new URL('..', import.meta.url).pathname;
const PORT = 8403;
const BOOTS = Number(arg('--boots', 1));
const JSON_OUT = arg('--json', null);

// The ceilings on claim 1, in shares of the build (0.01 = one percentage point).
// PROVISIONAL until measured on the CI host.
// MAX_MEAN is the sharp gate: the time-averaged distance from the diagonal.
const MAX_MEAN = 0.03;
// MAX_WORST is the backstop: on every host the worst moment is the first
// composited frame, one unsplittable task near the start that no seam reaches,
// so it reads the host's GL rather than the table.
const MAX_WORST = 0.25;
// Claim 5: distinct painted widths inside the build. The table has ~350 shares
// and the bar ~400 write opportunities; a bar that paints a dozen distinct
// widths over a 15–30 s build is moving, and one that paints two is not.
const PAINT_MIN_LEVELS = 12;

const MAIN = readFileSync(`${ROOT}src/main.js`, 'utf8');
const FREEZE_FROM = 'function writeBar(now) {\n';
if (MAIN.split(FREEZE_FROM).length !== 2) {
  console.error('REFUSED: src/main.js must declare `function writeBar(now) {` exactly once — the frozen control rewrites that line.');
  process.exit(1);
}
const { SEAM_ORDER } = await import(`${ROOT}src/boot-progress.js`);

const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
process.on('exit', () => srv.kill());
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });

async function boot({ screencast = false, frozen = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 700 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  if (frozen) await page.route('**/src/main.js*', async (route) => {
    const r = await route.fetch();
    route.fulfill({ body: (await r.text()).replace(FREEZE_FROM, `${FREEZE_FROM}  return;\n`), contentType: 'text/javascript' });
  });
  const frames = [];
  let cdp = null;
  if (screencast) {
    cdp = await ctx.newCDPSession(page);
    cdp.on('Page.screencastFrame', (f) => {
      frames.push({ t: Date.now(), data: f.data });
      cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
    });
    await cdp.send('Page.startScreencast', { format: 'png', maxWidth: 1000, maxHeight: 700, everyNthFrame: 1 });
  }
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'commit', timeout: 600000 });
  // The bar's row, read while the screen is up. Since §239 an evaluate is
  // answered at the next hand-back, so this does not wait for the build.
  const rect = await page.waitForFunction(() => {
    const el = document.querySelector('#boot .boot-bar');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return r.width > 0 ? { x: r.x, y: r.y, w: r.width, h: r.height } : null;
  }, null, { timeout: 60000 }).then((h) => h.jsonValue()).catch(() => null);
  let booted = true;
  await page.waitForFunction(() => window.__clock?.boot?.done === true, null, { timeout: 600000 }).catch(() => { booted = false; });
  const doneAt = Date.now();
  if (cdp) await cdp.send('Page.stopScreencast').catch(() => {});
  const rec = booted ? await page.evaluate(() => ({ p: window.__clock.boot.progress, warns: (window.__bootWarns || []).slice() })) : null;
  await ctx.close();
  return { booted, rect, rec, errors, frames: frames.filter((f) => f.t <= doneAt) };
}

// Claim 1, for any displayed step function: `steps` is [t, shown] in time order.
// Two readings. WORST is the furthest the bar ever stands from the elapsed
// fraction (read at both edges of every write, where the extremes are). MEAN is
// the time-weighted average distance — the area between the bar and the
// diagonal over the build, exact for a step against a line — which is what a
// viewer watching the whole wait is shown, and the reading the controls can
// separate: one long unseamed block moves WORST a lot and MEAN a little.
function deviation(steps, span) {
  let ahead = 0, behind = 0, aheadAt = 0, behindAt = 0, prev = 0, u0 = 0, area = 0;
  const seg = (v, a, b) => (v <= a ? ((b - v) ** 2 - (a - v) ** 2) / 2
    : v >= b ? ((v - a) ** 2 - (v - b) ** 2) / 2 : ((v - a) ** 2 + (b - v) ** 2) / 2);
  for (const [t, v] of steps) {
    const f = Math.min(1, t / span);
    if (f - prev > behind) { behind = f - prev; behindAt = t; }
    if (v - f > ahead) { ahead = v - f; aheadAt = t; }
    area += seg(prev, u0, f);
    prev = v; u0 = f;
  }
  return { ahead, behind, worst: Math.max(ahead, behind), mean: area, aheadAt, behindAt };
}

// The bar §267's filing rejected, rebuilt from the same boot: at each write
// time, the furthest SOURCE position among the seams first reached by then.
function ordinalSteps(p) {
  const pos = new Map(SEAM_ORDER.map((id, i) => [id, (i + 1) / SEAM_ORDER.length]));
  const visits = [];
  p.first.forEach((t, id) => { if (t !== null && pos.has(id)) visits.push([t, pos.get(id)]); });
  visits.sort((a, b) => a[0] - b[0]);
  const out = [];
  let k = 0, best = 0;
  for (const [t] of p.writes) {
    while (k < visits.length && visits[k][0] <= t) { best = Math.max(best, visits[k][1]); k++; }
    out.push([t, t >= p.spanMs ? 1 : Math.min(best, 0.9999)]);
  }
  return out;
}

// Claim 5's reader: the bar's fill along its middle row, as the share of the
// track carrying the accent. PNG decoding is written out (probe-238's decoder,
// one row instead of an ink count) because tools/ carries one dependency.
const ACCENT = [0x7a, 0x3a, 0xd8];
function fillOf(png, rect) {
  const buf = Buffer.from(png, 'base64');
  let p = 8, w = 0, h = 0, ct = 0, bd = 0; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bd = data[8]; ct = data[9]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (bd !== 8 || (ct !== 2 && ct !== 6)) throw new Error(`unsupported PNG: depth ${bd} colour type ${ct}`);
  const ch = ct === 6 ? 4 : 3, raw = inflateSync(Buffer.concat(idat)), stride = w * ch;
  // EVERY row the bar can occupy, not its middle one: it sits at a fractional
  // y, and while its transform is animating the compositor rasterises it a
  // pixel higher or lower from one frame to the next — a single-row reader
  // read a third of the frames as an empty bar. The widest row is the fill.
  const yTop = Math.floor(rect.y) - 1, yBot = Math.ceil(rect.y + rect.h) + 1;
  const x0 = Math.ceil(rect.x), x1 = Math.floor(rect.x + rect.w);
  let prev = Buffer.alloc(stride), line = null, best = 0;
  for (let y = 0; y <= yBot && y < h; y++) {
    const f = raw[y * (stride + 1)];
    line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? line[i - ch] : 0, b = prev[i], c = i >= ch ? prev[i - ch] : 0;
      let v = line[i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
      line[i] = v & 255;
    }
    prev = line;
    if (y < yTop) continue;
    let lit = 0;
    for (let x = x0; x < x1; x++) {
      const o = x * ch;
      if (Math.abs(line[o] - ACCENT[0]) + Math.abs(line[o + 1] - ACCENT[1]) + Math.abs(line[o + 2] - ACCENT[2]) < 60) lit++;
    }
    if (lit > best) best = lit;
  }
  return best / Math.max(1, x1 - x0);
}
function painted(run) {
  if (!run.rect || !run.frames.length) return { levels: 0, shrank: 0, frames: run.frames.length, fills: [] };
  const fills = run.frames.map((f) => Math.round(fillOf(f.data, run.rect) * 200) / 200);   // half-point bins
  let shrank = 0;
  for (let i = 1; i < fills.length; i++) if (fills[i] < fills[i - 1] - 0.01) {
    shrank++;
    if (shrank <= 5) console.log(`  painted shorter at frame ${i}/${fills.length}: ${fills.slice(Math.max(0, i - 3), i + 3).join(' ')}`);
  }
  return { levels: new Set(fills).size, shrank, frames: fills.length, first: fills[0], last: fills[fills.length - 1], fills };
}

const pct = (x) => `${(x * 100).toFixed(1)} pt`;
const fail = [];
const live = [];
for (let b = 0; b < BOOTS; b++) {
  const r = await boot();
  if (!r.booted) { fail.push(`boot ${b + 1} never completed`); continue; }
  const p = r.rec.p, span = p.spanMs;
  const dev = deviation(p.writes, span), ord = deviation(ordinalSteps(p), span);
  const shares = p.writes.map((w) => w[1]);
  const backwards = shares.filter((v, i) => i && v <= shares[i - 1]).length;
  const last = p.writes[p.writes.length - 1];
  live.push({ spanMs: span, writes: p.writes.length, dev, ordinal: ord, backwards,
    early100: shares.slice(0, -1).filter((v) => v >= 1).length, lastShare: last?.[1], lastAt: last?.[0],
    unshared: p.unshared, warns: r.rec.warns.length });
  console.log(`\nBOOT ${b + 1} — build span ${(span / 1000).toFixed(1)} s, ${p.writes.length} bar writes`);
  console.log(`  table bar   worst ${pct(dev.worst)}   ahead ${pct(dev.ahead)} at t+${(dev.aheadAt / 1000).toFixed(1)}s   behind ${pct(dev.behind)} at t+${(dev.behindAt / 1000).toFixed(1)}s   mean ${pct(dev.mean)}`);
  console.log(`  ordinal     worst ${pct(ord.worst)}   ahead ${pct(ord.ahead)} at t+${(ord.aheadAt / 1000).toFixed(1)}s   behind ${pct(ord.behind)} at t+${(ord.behindAt / 1000).toFixed(1)}s   mean ${pct(ord.mean)}   (control)`);
  for (const q of [0.25, 0.5, 0.75, 0.9]) {
    const hit = p.writes.find((w) => w[1] >= q);
    if (hit) console.log(`    shows ${Math.round(q * 100)}% at ${(100 * hit[0] / span).toFixed(1)}% of the build`);
  }
}

const paint = await boot({ screencast: true });
const pLive = paint.booted ? painted(paint) : null;
const frozen = await boot({ screencast: true, frozen: true });
const pFrozen = frozen.booted ? painted(frozen) : null;
await browser.close(); srv.kill();
if (pLive) console.log(`\nPAINTED   ${pLive.frames} frames in the build, ${pLive.levels} distinct widths, ${pLive.first} → ${pLive.last}, ${pLive.shrank} shrinking`);
if (pFrozen) console.log(`FROZEN    ${pFrozen.frames} frames in the build, ${pFrozen.levels} distinct width(s) (control)`);

if (!live.length) fail.push('no boot produced a record');
for (const [i, r] of live.entries()) {
  const tag = live.length > 1 ? `boot ${i + 1}: ` : '';
  if (r.dev.mean > MAX_MEAN) fail.push(`${tag}the bar stands ${pct(r.dev.mean)} from the true elapsed fraction on average (ceiling ${pct(MAX_MEAN)})`);
  if (r.dev.worst > MAX_WORST) fail.push(`${tag}the bar strays ${pct(r.dev.worst)} from the true elapsed fraction at worst (backstop ${pct(MAX_WORST)})`);
  if (r.ordinal.mean <= MAX_MEAN) fail.push(`${tag}CONTROL: the raw seam ordinal stands only ${pct(r.ordinal.mean)} off on average (≤ ${pct(MAX_MEAN)}) — the gate cannot tell the table from the bar it replaced`);
  if (r.backwards) fail.push(`${tag}${r.backwards} bar write(s) did not move it forward`);
  if (r.early100) fail.push(`${tag}${r.early100} write(s) showed 100% before the build was done`);
  if (r.lastShare !== 1 || Math.abs(r.lastAt - r.spanMs) > 1e-6) fail.push(`${tag}the last write is ${r.lastShare} at ${r.lastAt} ms, not 1 at the span's end (${r.spanMs} ms)`);
  if (r.unshared.length) fail.push(`${tag}${r.unshared.length} seam(s) reached with no share in the table — run node tools/boot-progress.mjs --write`);
  if (r.warns) fail.push(`${tag}${r.warns} boot warn(s) — rule 6`);
}
if (!pLive) fail.push('the screencast boot never completed');
else {
  if (pLive.levels < PAINT_MIN_LEVELS) fail.push(`the bar painted ${pLive.levels} distinct width(s) during the build (floor ${PAINT_MIN_LEVELS})`);
  if (pLive.shrank) fail.push(`${pLive.shrank} painted frame(s) showed the bar shorter than the frame before`);
}
if (!pFrozen) fail.push('the frozen control never completed, so the pixel reader is unverified');
else if (pFrozen.levels !== 1) fail.push(`CONTROL: with the bar frozen the reader still saw ${pFrozen.levels} widths — it is not reading the bar`);

const cpus = os.cpus();
const record = {
  format: 1, seams: SEAM_ORDER.length,
  host: { cpu: cpus[0]?.model || '?', cores: cpus.length, platform: `${os.platform()}/${os.arch()}` },
  ceilings: { maxMean: MAX_MEAN, maxWorst: MAX_WORST, paintMinLevels: PAINT_MIN_LEVELS },
  live, painted: pLive && { ...pLive, fills: undefined }, frozen: pFrozen && { ...pFrozen, fills: undefined }, fail,
};
if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify(record, null, 2));
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, [
    `### Boot progress (§267) — ${fail.length ? 'FAIL' : 'PASS'}`,
    `${SEAM_ORDER.length} seams in the table · ${record.host.cores} × ${record.host.cpu} · ceilings: mean ${pct(MAX_MEAN)}, worst ${pct(MAX_WORST)}`,
    '', '| boot | span | bar: mean / worst (ahead, behind) | ordinal (control): mean / worst |', '|---|---|---|---|',
    ...live.map((r, i) => `| ${i + 1} | ${(r.spanMs / 1000).toFixed(1)} s | ${pct(r.dev.mean)} / ${pct(r.dev.worst)} (${pct(r.dev.ahead)}, ${pct(r.dev.behind)}) | ${pct(r.ordinal.mean)} / ${pct(r.ordinal.worst)} |`),
    '', `Painted: ${pLive ? `${pLive.levels} widths over ${pLive.frames} frames` : '—'} · frozen control: ${pFrozen ? `${pFrozen.levels}` : '—'}`,
    '', ...fail.map((f) => `- FAIL: ${f}`), '',
  ].join('\n'));
}
console.log('');
if (fail.length) { for (const f of fail) console.error(`FAIL: ${f}`); process.exit(1); }
const m = Math.max(...live.map((r) => r.dev.mean)), w = Math.max(...live.map((r) => r.dev.worst)), o = Math.min(...live.map((r) => r.ordinal.mean));
console.log(`PASS — the bar stands ${pct(m)} from the elapsed fraction on average (ceiling ${pct(MAX_MEAN)}; the raw ordinal ${pct(o)}), ${pct(w)} at worst (backstop ${pct(MAX_WORST)}), `
  + `never backwards, 100% only at the guard's release; painted ${pLive.levels} widths mid-build (frozen control: ${pFrozen.levels})`);
