#!/usr/bin/env node
// §249 — DOES EVERY ARROW POINT THE WAY ITS SENTENCE FLOWS, as rendered?
//
// A → or ← is a bidi NEUTRAL. In a right-to-left locale it takes the
// direction of the runs around it, so "A → B" written between two Hebrew
// runs is laid out B ⇠ A and its glyph points back at A, the opposite of the
// flow it labels. A number counts as right-to-left there too (UAX #9 N1), and
// the plates' `direction: ltr` does not save a label (§208 keeps that for the
// anchors, not the text). None of that is visible to the page gate: the key
// matches, the markup matches and the numbers match. Persian's landing
// reasoned it out per site and its record said prose was right; this probe,
// written for Hebrew's, found eight Persian prose arrows backwards.
//
// The measure is the glyph boxes. For each arrow in a text node (not inside
// <code>, which is source form), find the nearest letter or digit BEFORE it
// and AFTER it in logical order, within the same block, and read their
// on-screen x. A → is right when before < arrow < after; a ← when before >
// arrow > after. Anything else is BACKWARDS. Arrows with nothing on one side
// (a header link, a continuation line, a physical direction in a figure:
// "EMPTY →") are EDGE, and arrows whose neighbours sit on another line are
// WRAP — both reported, never judged, because neither has a flow to point
// along.
//
// Two controls, both required before any locale is judged: English must
// measure at least one arrow and none BACKWARDS, and one of its measured
// arrows, flipped in place, must then read BACKWARDS — a probe that cannot
// see a reversal passes every table.
//
// OWED names a locale whose reversals are known and filed (Arabic's, recorded
// under §249's Persian entry and owed to an Arabic landing). Its rows are
// reported, not failed — and a locale in OWED that measures CLEAN fails as
// stale, so the fix retires the row rather than memory.
//
//   node tools/probe-249-arrows.mjs [--locales he,fa,ar]
//
// Needs python3 (dev_server.py) and a Playwright Chromium, like ci-battery.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argOf = (flag, dflt) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : dflt;
};
const LOCALES = argOf('--locales', 'he,fa,ar').split(',');
const OWED = new Set(['ar']);
const PAGES = ['explain.html', 'primer.html'];

const freePort = () => new Promise((res, rej) => {
  const s = createServer();
  s.on('error', rej);
  s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => res(port)); });
});
const port = await freePort();
const base = `http://127.0.0.1:${port}`;
// Isolated TMPDIR for probe-116's reason: dev_server.py keeps one /__state per
// temp dir, and a probe sharing the battery's can break its virgin boots.
const stateDir = mkdtempSync(join(tmpdir(), 'timesim-probe249-'));
const server = spawn('python3', [join(ROOT, 'dev_server.py'), String(port)],
  { cwd: ROOT, env: { ...process.env, TMPDIR: stateDir }, stdio: 'ignore' });
for (;;) { try { await fetch(`${base}/index.html`); break; } catch { await new Promise((r) => setTimeout(r, 200)); } }
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

// In the page: every arrow's verdict. `flip` reverses the first 'ok' arrow in
// place first and returns only its new verdict — the detection control.
const measure = (flip) => {
  const ARW = /[←→⇐⇒]/g;
  const box = (node, i) => {
    const r = document.createRange(); r.setStart(node, i); r.setEnd(node, i + 1);
    const b = r.getBoundingClientRect(); return b.width || b.height ? b : null;
  };
  const blockOf = (n) => n.parentElement.closest('p,li,td,th,div,text,h1,h2,h3,figcaption,dd,dt,label,button,option,summary') || n.parentElement;
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (tw.nextNode()) { const n = tw.currentNode; if (!n.parentElement.closest('script,style,code')) nodes.push(n); }
  const judge = (ni, at) => {
    const n = nodes[ni], g = n.data[at], a = box(n, at);
    if (!a) return null;
    const blk = blockOf(n);
    const seek = (dir) => {
      let k = ni, i = at + dir;
      while (k >= 0 && k < nodes.length && blk.contains(nodes[k])) {
        const d = nodes[k].data;
        for (; i >= 0 && i < d.length; i += dir) if (/[\p{L}\p{N}]/u.test(d[i])) { const b = box(nodes[k], i); if (b) return b; }
        k += dir; if (k >= 0 && k < nodes.length) i = dir > 0 ? 0 : nodes[k].data.length - 1;
      }
      return null;
    };
    const ctx = n.data.slice(Math.max(0, at - 35), at + 30).replace(/\s+/g, ' ');
    const pre = seek(-1), nxt = seek(1);
    if (!pre || !nxt) return { v: 'EDGE', g, ctx };
    const cx = (b) => b.left + b.width / 2, cy = (b) => b.top + b.height / 2;
    if (Math.abs(cy(pre) - cy(a)) > a.height * 0.6 || Math.abs(cy(nxt) - cy(a)) > a.height * 0.6) return { v: 'WRAP', g, ctx };
    const lr = cx(pre) < cx(a) && cx(a) < cx(nxt), rl = cx(pre) > cx(a) && cx(a) > cx(nxt);
    const right = /[→⇒]/.test(g);
    return { v: (right && lr) || (!right && rl) ? 'ok' : 'BACKWARDS', g, ctx };
  };
  const out = [];
  for (let ni = 0; ni < nodes.length; ni++) {
    for (const m of nodes[ni].data.matchAll(ARW)) {
      const r = judge(ni, m.index);
      if (!r) continue;
      if (flip && r.v === 'ok') {
        const n = nodes[ni], swap = { '→': '←', '←': '→', '⇒': '⇐', '⇐': '⇒' }[r.g];
        n.data = n.data.slice(0, m.index) + swap + n.data.slice(m.index + 1);
        return [judge(ni, m.index)];
      }
      out.push(r);
    }
  }
  return out;
};

const run = async (lang, p, flip = false) => {
  await page.goto(`${base}/${p}?lang=${lang}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  return page.evaluate(measure, flip);
};

let failed = 0;
const tallyOf = (rows) => rows.reduce((t, r) => (t[r.v] = (t[r.v] || 0) + 1, t), {});

// ---- the controls ----------------------------------------------------------
const en = (await run('en', PAGES[0])).concat(await run('en', PAGES[1]));
const enT = tallyOf(en);
const flipped = await run('en', PAGES[0], true);
const c1 = (enT.ok || 0) > 0 && !enT.BACKWARDS;
const c2 = flipped.length === 1 && flipped[0].v === 'BACKWARDS';
console.log(`control: English measures ${enT.ok || 0} arrow(s), ${enT.BACKWARDS || 0} backwards — ${c1 ? 'PASS' : 'FAIL'}`);
console.log(`control: one English arrow flipped in place reads ${flipped[0]?.v ?? 'nothing'} — ${c2 ? 'PASS' : 'FAIL'}`);
if (!c1 || !c2) failed++;

// ---- the locales -----------------------------------------------------------
for (const lang of LOCALES) {
  let back = 0;
  for (const p of PAGES) {
    const rows = await run(lang, p);
    const t = tallyOf(rows);
    back += t.BACKWARDS || 0;
    console.log(`\n[${lang}] ${p}: ${rows.length} arrow(s) · ok ${t.ok || 0} · BACKWARDS ${t.BACKWARDS || 0} · edge ${t.EDGE || 0} · wrap ${t.WRAP || 0}`);
    for (const r of rows) if (r.v === 'BACKWARDS') console.log(`    BACKWARDS ${r.g}  «${r.ctx}»`);
  }
  if (OWED.has(lang)) {
    if (!back) { console.log(`  [${lang}] is in OWED and measures clean — STALE, retire the row`); failed++; }
    else console.log(`  [${lang}] ${back} backwards — OWED (reported, not failed)`);
  } else if (back) failed++;
}

await browser.close();
server.kill();
console.log(failed ? '\nFAIL' : '\nPASS — every judged arrow points along its flow, controls PASS');
process.exit(failed ? 1 : 0);
