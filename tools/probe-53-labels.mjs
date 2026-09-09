// §53 — CAN EVERY ADVANCED-SETTINGS LABEL BE READ ON A PHONE? Acceptance for
// the entry's remainder, which the shipped half's code says it already
// covers (authored `_labels`, stacked rows, wrapping); this MEASURES it
// rather than trusting the comment, at the phone width §15 fits (375×667)
// and on desktop:
//   1. boot silent — no "§53: no _labels entry" fallback fired, so every
//      leaf carries an authored name (the key path is shown nowhere);
//   2. no label overflows its row: scrollWidth ≤ clientWidth on every
//      .adv-label, and its box lies inside the panel's box;
//   3. no label is ellipsised: computed text-overflow is not 'ellipsis' and
//      white-space allows wrapping;
//   4. a deliberately long label WRAPS: one label is set to a 70-character
//      string and its box grows in height rather than in width;
//   5. the section still collapses (details closed by default) and the panel
//      scrolls within a 667 px viewport (scrollHeight > clientHeight is
//      allowed; the panel's own box fits the viewport).
//   cd tools && node probe-53-labels.mjs        (exit 1 on any claim)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8467;
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();

async function measure(viewport) {
  const ctx = await browser.newContext({ viewport, isMobile: viewport.width < 768, hasTouch: viewport.width < 768 });
  const page = await ctx.newPage();
  const warns = [];
  page.on('console', (m) => { if (m.type() === 'warning' && !/GroupMarker|GL Driver|SwiftShader|WebGL/.test(m.text())) warns.push(m.text()); });
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => !!window.__clock || !!window.__bootError, null, { timeout: 120000 }).catch(() => warns.push('NO __clock'));
  const r = await page.evaluate(() => {
    const body = document.getElementById('advanced-body');
    const panel = body.closest('.hud-panel'); // the view panel since §118 — Advanced lives there, not in #clock-ui (§146's measurement)
    // open every <details> on the path to the advanced body so the rows lay out
    const opened = [];
    for (let d = body; d; d = d.parentElement) if (d.tagName === 'DETAILS') { opened.push(d.open); d.open = true; }
    const pr = panel.getBoundingClientRect();
    const labels = [...body.querySelectorAll('.adv-row .adv-label')];
    const rows = labels.map((l) => {
      const cs = getComputedStyle(l), b = l.getBoundingClientRect();
      return { text: l.textContent, overflow: l.scrollWidth - l.clientWidth, inside: b.left >= pr.left - 0.5 && b.right <= pr.right + 0.5,
        ellipsis: cs.textOverflow === 'ellipsis', nowrap: cs.whiteSpace === 'nowrap' || cs.whiteSpace === 'pre', h: b.height, w: b.width };
    });
    // 4 — the long-label test on the first row
    const probe = labels[0];
    const before = probe.getBoundingClientRect();
    const keep = probe.textContent;
    probe.textContent = 'A deliberately long authored label that must wrap and never truncate at all';
    const after = probe.getBoundingClientRect();
    const longWrap = { grewTall: after.height > before.height * 1.5, keptWidth: after.width <= before.width + 1, overflow: probe.scrollWidth - probe.clientWidth };
    probe.textContent = keep;
    const panelFits = pr.height <= window.innerHeight + 0.5 && pr.width <= window.innerWidth + 0.5;
    const pcs = getComputedStyle(panel);
    return { n: labels.length, rows, longWrap, panelFits, panelScrolls: /auto|scroll/.test(pcs.overflowY), detailsClosedByDefault: opened.every((o) => o === false),
      keyPathShown: rows.filter((r) => /^[a-z]+(\.[a-zA-Z]+)+$/.test(r.text.replace(' ⟳', ''))).length, viewport: [window.innerWidth, window.innerHeight] };
  });
  await ctx.close();
  return { ...r, warns };
}

const phone = await measure({ width: 375, height: 667 });
const desk = await measure({ width: 1280, height: 800 });
await browser.close();
srv.kill();

let fail = 0;
const F = (m) => { fail++; console.log('FAIL', m); };
const OK = (m) => console.log('OK  ', m);
for (const [name, r] of [['phone 375×667', phone], ['desktop 1280×800', desk]]) {
  if (r.warns.length) F(`${name}: ${r.warns.length} warning(s): ${r.warns.join(' | ').slice(0, 200)}`); else OK(`${name}: boot silent — every leaf has an authored label`);
  if (r.keyPathShown) F(`${name}: ${r.keyPathShown} label(s) show a key path`); else OK(`${name}: ${r.n} labels, none a key path`);
  const over = r.rows.filter((x) => x.overflow > 0 || !x.inside);
  if (over.length) F(`${name}: ${over.length} label(s) overflow or leave the panel: ${over.slice(0, 4).map((x) => x.text).join(' | ')}`); else OK(`${name}: no label overflows its row or leaves the panel`);
  const clip = r.rows.filter((x) => x.ellipsis || x.nowrap);
  if (clip.length) F(`${name}: ${clip.length} label(s) ellipsised or nowrap`); else OK(`${name}: no label is ellipsised; all may wrap`);
  if (!(r.longWrap.grewTall && r.longWrap.keptWidth && r.longWrap.overflow <= 0)) F(`${name}: the long label did not wrap cleanly: ${JSON.stringify(r.longWrap)}`); else OK(`${name}: a 70-character label wraps (taller, not wider, no overflow)`);
  if (!r.detailsClosedByDefault) F(`${name}: the section is not collapsed by default`); else OK(`${name}: the section collapses by default`);
  if (!r.panelFits) F(`${name}: the panel's box exceeds the viewport ${r.viewport}`); else OK(`${name}: the panel fits the ${r.viewport.join('×')} viewport${r.panelScrolls ? ' and scrolls' : ''}`);
  const tallest = Math.max(...r.rows.map((x) => x.h));
  console.log(`      ${name}: ${r.n} rows, tallest label ${tallest.toFixed(1)} px`);
}
process.exit(fail ? 1 : 0);
