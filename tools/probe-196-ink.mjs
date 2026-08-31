// IS THE DIAL'S PRINT LEGIBLE ON EVERY FACE COLOUR — AND STILL THE SHIPPED
// PRINT ON THE SHIPPED ONE? Acceptance. §196 made the printed ink a SOLVE
// (solveInk's two-pole argmax, solveMarkInk's relation hold, zoneTone's
// widened segments) where it had been constants a dark face silently
// swallowed — §185 measured a plausible navy at 1.41:1 warning four times
// and shipping anyway. This probe holds the landing's four claims:
//   1. CONTROLS. The metric still SEES the old defect (the §185 navy against
//      the constant dark ink reads under the floor — a detector that cannot
//      fail has tested nothing); the light pole equals its mirror derivation
//      recomputed independently; solveInk answers dark-on-white and
//      light-on-black; and the zone warn still FIRES where the chained-ratio
//      bound makes a zone impossible (#a0a0a0 — ground and ink under 9:1
//      apart), so silence elsewhere is a measurement, not a dead warn.
//   2. SHIPPED VERBATIM. On the shipped face every solved ink is the §157
//      constant bit-for-bit (track and wells #1a1a1a-family, mark #8a887e,
//      2.82:1 relation unchanged) — the solve degenerates to the old design
//      exactly where the old design was right.
//   3. LEGIBLE EVERYWHERE. Across the named set (shipped, the §185 navy,
//      black, white, the #1a1a1a that measured 1.02:1, the crossover gray)
//      booted via ?dialcol=, and a 4×4×4 lattice plus grays applied by LIVE
//      recolour: track and every well hold ≥ DIAL_INK_CONTRAST_MIN, and the
//      named set boots with __clock.bootWarns EMPTY (standing rule 6 — the
//      warn's meaning inverted: it now flags a solve regression, not taste).
//      Lattice zone warns are REPORTED, not gated — the impossible band is
//      §159's honest residue, not a defect.
//   4. A RECOLOUR MOVES NO METAL. Dial-scoped geometry ids and vertex counts
//      identical across navy-and-back, re-proving §157's measurement under
//      the solve.
// NOT probe-dial-colour-link.mjs, deliberately: that one holds WHOSE colour
// a link applies (store vs param precedence) and states in its own header
// that legibility is out of its scope. This is the legibility half.
//
// Run: node tools/probe-196-ink.mjs   (ROOT= to measure another worktree)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8462);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch();
const BASE = `http://127.0.0.1:${PORT}/index.html`;

const fails = [];
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(58)} ${detail}`);
  if (!ok) fails.push(name);
};

async function boot(qs) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const appWarns = [];
  page.on('console', (m) => {
    const t = m.text();
    if (/^(dial:|reserve face:)/.test(t)) appWarns.push(t);
  });
  page.on('pageerror', (e) => { fails.push('pageerror'); console.log('  PAGEERROR', String(e).slice(0, 200)); });
  await page.goto(BASE + qs, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => !!window.__clock, null, { timeout: 120000 });
  return { ctx, page, appWarns };
}
const inkContrast = (page) => page.evaluate(() => {
  let out = null;
  window.__clock.scene.traverse((o) => { if (o.userData && o.userData.inkContrast) out = o.userData.inkContrast(); });
  return out;
});
const bootWarns = (page) => page.evaluate(() => (window.__clock.bootWarns || []).slice());
// Dial-scoped on purpose: the Chain re-tessellates lazily (its exclusion
// from the fingerprint exists for the same reason), so a scene-wide id list
// would move for reasons that have nothing to do with a repaint.
const dialGeo = (page) => page.evaluate(() => {
  let dial = null;
  window.__clock.scene.traverse((o) => { if (o.userData && o.userData.recolourFace) dial = o; });
  const ids = []; let verts = 0;
  dial.traverse((o) => { if (o.geometry) { ids.push(o.geometry.id); verts += o.geometry.attributes?.position?.count || 0; } });
  return { ids: ids.join(','), verts };
});
const recolour = (page, colour) => page.evaluate(async (c) => {
  const { aesthetics } = await import('./src/aesthetics.js');
  aesthetics.dial.face.color = c;
  let dial = null;
  window.__clock.scene.traverse((o) => { if (o.userData && o.userData.recolourFace) dial = o; });
  return dial.userData.recolourFace();
}, colour);

console.log('§196 — the printed ink solves against the face\n');

// ---- 1. controls -----------------------------------------------------------
{
  const { ctx, page } = await boot('');
  const c = await page.evaluate(async () => {
    const G = await import('./src/geometry.js');
    return {
      oldNavyOuter: G.contrastRatio(G.dialTintAt('#1b3a5c', G.DIAL_RAIL_OUT_F), G.DIAL_TRACK_INK),
      floor: G.DIAL_INK_CONTRAST_MIN,
      light: G.DIAL_TRACK_INK_LIGHT,
      dark: G.DIAL_TRACK_INK,
      onWhite: G.solveInk(['#ffffff']),
      onBlack: G.solveInk(['#000000']),
    };
  });
  check('control: metric sees the §185 defect (navy vs old constant ink)',
    c.oldNavyOuter < c.floor, `${c.oldNavyOuter.toFixed(2)}:1 < ${c.floor}`);
  // The mirror derivation, recomputed independently of geometry.js: the tone
  // standing to black as the dark ink stands to white.
  const lum = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  };
  const C0 = (1.0 + 0.05) / (lum(c.dark) + 0.05);
  const L = C0 * 0.05 - 0.05;
  const inv = (l) => (l <= 0.03928 / 12.92 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - 0.055);
  const b = Math.round(inv(L) * 255).toString(16).padStart(2, '0');
  check('control: light pole equals its mirror derivation', c.light === `#${b}${b}${b}`,
    `${c.light} vs #${b}${b}${b}`);
  check('control: solveInk is dark on white, light on black',
    c.onWhite === c.dark && c.onBlack === c.light, `${c.onWhite} / ${c.onBlack}`);
  await ctx.close();
}
{ // the zone warn must still be able to fire: #a0a0a0's ground and its dark
  // ink stand under 9:1 apart, so no zone tone can be 3:1 from both.
  const { ctx, appWarns } = await boot('?dialcol=a0a0a0');
  check('control: zone warn fires in the impossible band (#a0a0a0)',
    appWarns.some((w) => w.startsWith('reserve face:')), `${appWarns.length} warn(s)`);
  await ctx.close();
}

// ---- 2. shipped verbatim ---------------------------------------------------
{
  const { ctx, page, appWarns } = await boot('');
  const ic = await inkContrast(page);
  const bw = await bootWarns(page);
  check('shipped: solved track ink is DIAL_TRACK_INK verbatim', ic.gated.trackInk === '#1a1a1a', ic.gated.trackInk);
  check('shipped: both wells solve to the dark pole',
    ic.gated.wells.every((w) => w.ink === '#1a1a1a'), ic.gated.wells.map((w) => w.ink).join(' '));
  check('shipped: mark relation unchanged (≈2.82:1)',
    Math.abs(ic.reported.makersMark - 2.8203) < 0.001, ic.reported.makersMark.toFixed(4));
  check('shipped: bootWarns empty', bw.length === 0, `${bw.length}`);
  check('shipped: no app ink/zone warns', appWarns.length === 0, `${appWarns.length}`);
  await ctx.close();
}

// ---- 3. legible everywhere -------------------------------------------------
const NAMED = ['1b3a5c', '000000', 'ffffff', '1a1a1a', '757575'];
for (const col of NAMED) {
  const { ctx, page, appWarns } = await boot(`?dialcol=${col}`);
  const ic = await inkContrast(page);
  const bw = await bootWarns(page);
  const floors = [ic.gated.trackOuter, ic.gated.trackInner, ...ic.gated.wells.map((w) => w.ratio)];
  check(`#${col}: track + wells all ≥ ${ic.gated.floor}`, floors.every((r) => r >= ic.gated.floor),
    `min ${Math.min(...floors).toFixed(2)} (ink ${ic.gated.trackInk})`);
  check(`#${col}: bootWarns empty`, bw.length === 0, `${bw.length}`);
  check(`#${col}: no app ink/zone warns`, appWarns.length === 0, appWarns[0] ? appWarns[0].slice(0, 60) : '');
  await ctx.close();
}
{ // the lattice, applied live in one context — 4^3 corners-and-steps plus the
  // gray diagonal. Ink floors are GATED (the §196 guarantee is universal);
  // zone warns are REPORTED, because the impossible band is §159's documented
  // residue and a gate over it would be asking for what arithmetic forbids.
  const { ctx, page, appWarns } = await boot('');
  const lattice = [];
  for (const r of [0, 85, 170, 255]) for (const g of [0, 85, 170, 255]) for (const b of [0, 85, 170, 255])
    lattice.push(`#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`);
  for (let v = 16; v < 256; v += 32) lattice.push(`#${v.toString(16).padStart(2, '0').repeat(3)}`);
  let worst = Infinity, worstAt = null, zoneWarnGrounds = 0;
  for (const col of lattice) {
    const before = appWarns.length;
    const live = await recolour(page, col);
    if (live !== true) { check(`lattice: recolourFace returned true at ${col}`, false, String(live)); break; }
    const ic = await inkContrast(page);
    const floors = [ic.gated.trackOuter, ic.gated.trackInner, ...ic.gated.wells.map((w) => w.ratio)];
    const m = Math.min(...floors);
    if (m < worst) { worst = m; worstAt = col; }
    const newWarns = appWarns.slice(before);
    if (newWarns.some((w) => w.startsWith('dial:'))) check(`lattice: solve failed at ${col}`, false, newWarns[0]);
    if (newWarns.some((w) => w.startsWith('reserve face:'))) zoneWarnGrounds += 1;
  }
  check(`lattice (${lattice.length} colours): min ink contrast ≥ 3.0`, worst >= 3.0,
    `min ${worst.toFixed(3)} at ${worstAt}`);
  console.log(`  report: zone warns on ${zoneWarnGrounds}/${lattice.length} lattice colours (the §159 impossible band)`);
  await ctx.close();
}

// ---- 4. a recolour moves no metal ------------------------------------------
{
  const { ctx, page } = await boot('');
  const a = await dialGeo(page);
  await recolour(page, '#1b3a5c');
  await recolour(page, '#e7e5dd');
  const b = await dialGeo(page);
  check('recolour and back: dial geometry ids identical', a.ids === b.ids, `${a.ids.split(',').length} geometries`);
  check('recolour and back: dial vertex count identical', a.verts === b.verts, `${a.verts}`);
  await ctx.close();
}

console.log(`\n${fails.length ? `${fails.length} FAILED: ${fails.join(', ')}` : 'all claims hold'}`);
await browser.close(); srv.kill();
process.exit(fails.length ? 1 : 0);
