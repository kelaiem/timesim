// §224 — WHERE DOES THE RESERVE ZONE GATE WARN AS THE COAT LIGHTENS? A REPORT
// (prints; judge it yourself), and the instrument that found §224's band.
//
// §220 DERIVED a FLOOR for `dial.plate.smoke` — 0.41, below which the reserve
// sub-dial's zone gate cannot place a tone — and took the interval from there to
// the clear crystal to be continuous. It is not. probe-220-smoke.mjs's shipped-
// picture tier booted T 0.75 and it WARNED, from that same gate, from the other
// side. This scans the range and bisects both edges to the slider's 0.01 step.
//
// WHAT THE GATE ASKS, and why a middle can fail it: each coloured sector of the
// reserve sub-dial must hold 3:1 against BOTH the sub-dial face and its ticks
// (§196's solve, WCAG 2.1 SC 1.4.11). The ticks flip pole with the ground, so
// past the ink flip they are DARK, and a zone tone then has to be light enough
// to clear them — which is fine while the ground is still dark. As the coat
// lightens the ground climbs through mid grey and the light tone stops clearing
// the GROUND by 3:1, while a dark tone cannot clear the dark TICKS. Neither
// direction has room, and the gate warns. High enough and the ground is bright
// enough again that a middling tone clears the ticks and still sits 3:1 under
// it. Measured at landing: silent to 0.74, WARNS 0.75–0.90, silent from 0.91.
//
// The two edges are PINNED in probe-220-smoke.mjs (an acceptance test), so a
// moved edge fails there. This is the tool to reach for when it does: that one
// says the band moved, this one says where it moved to.
//
// Reads the boot's console rather than any internal, so it measures what a
// viewer's browser would report. One boot per T at 400×300 — the gate runs at
// build, so the viewport only has to exist.
//
//   cd tools && node probe-224-zone-band.mjs        (report; always exit 0)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8471;
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
async function probe(T) {
  const ctx = await browser.newContext({ viewport: { width: 400, height: 300 } });
  await ctx.addInitScript((v) => localStorage.setItem('aestheticsOverrides', JSON.stringify(v)), { dial: { plate: { sapphire: true, smoke: T } } });
  const page = await ctx.newPage();
  const warns = [];
  page.on('console', (m) => { if (m.type() === 'warning' && !/GroupMarker|GL Driver|SwiftShader|WebGL/.test(m.text())) warns.push(m.text()); });
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => !!window.__clock || !!window.__bootError, null, { timeout: 120000 }).catch(() => warns.push('NO __clock'));
  // The ink record hangs off the Dial unit, not off window — reading a global
  // that does not exist is how a report prints a column of nulls and looks fine.
  const r = await page.evaluate(() => {
    const u = window.__clock && window.__clock.labelEntries.find((e) => e.name === 'Dial');
    let dial = null;
    if (u) u.obj.traverse((o) => { if (!dial && o.userData && 'sapphire' in o.userData) dial = o; });
    const g = dial && dial.userData.inkContrast ? dial.userData.inkContrast().gated : null;
    return { boot: (window.__bootWarns || []).slice(), ground: g ? g.wells[0].ground : null, ink: g ? g.trackInk : null };
  });
  await ctx.close();
  const all = [...r.boot, ...warns];
  const zone = all.filter((w) => /^reserve face: the (warning|maximum) zone/.test(w));
  const other = all.filter((w) => !zone.includes(w));
  const worst = zone.map((w) => +(w.match(/holds only ([\d.]+):1/) || [0, 0])[1]).sort((a, b) => a - b)[0];
  // `ink` travels with the row, not just the pole it implies: the escape-route
  // arithmetic below needs the actual hex, and deriving it back from 'dark' would
  // be a second copy of the pole constants.
  return { T, zone: zone.length, other, ground: r.ground, ink: r.ink, pole: r.ink === '#1a1a1a' ? 'dark' : 'light', worst };
}
// §225 — the two ESCAPE ROUTES, computed here from the ground and the ink the
// boot reported, so the report says WHY each row warns instead of only that it
// does. A zone tone must hold 3:1 against both the sub-dial face (the ground)
// and its ticks (the ink), and there are exactly two places such a tone can
// sit. ABOVE the ground: the brightest tone there is, white, so the route is
// open iff contrast(white, ground) >= 3. BETWEEN ground and ink: the chained
// bound zoneTone's own comment names — a third tone 3:1 from both cannot fit
// inside a gap narrower than 9:1, so the route is open iff
// contrast(ground, ink) >= 9.
//
// THE TEST IS NECESSARY, NOT SUFFICIENT, and saying so is the point. Neither
// route open means no tone can exist, and that half predicts the band's lower
// edge and its whole interior exactly. A route being OPEN only means the window
// is non-empty — the tone still has to be a reachable member of it, and a zone
// tone is not free: it is the zone's HUE mixed toward a pole, a one-parameter
// ramp quantised to 8-bit sRGB. At T 0.90 the between-window is 0.00107 wide in
// luminance and two of the four zone checks still fail, which is exactly what a
// ramp landing in the slot for one hue and missing for the other looks like. So
// the flag below fires only on the sound direction — model says MUST WARN and
// the boot was silent — and never on "open but warned", which is not a
// contradiction but the width of the window.
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16));
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const relY = (h) => { const [r, g, b] = hex(h); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
const cr = (a, b) => { const A = relY(a), B = relY(b); const [hi, lo] = A > B ? [A, B] : [B, A]; return (hi + 0.05) / (lo + 0.05); };
const routes = (r) => {
  if (!r.ground || !r.ink) return { txt: 'routes n/a (no ink record)', predicted: null };
  const above = cr('#ffffff', r.ground), between = cr(r.ground, r.ink);
  const open = above >= 3 || between >= 9;
  return { txt: `above ${above.toFixed(2)}${above >= 3 ? '\u2713' : ' '} between ${between.toFixed(2)}${between >= 9 ? '\u2713' : ' '}`, mustWarn: !open };
};
const say = (r) => {
  const R = routes(r);
  // Only the sound direction is an alarm: no route open yet the boot said
  // nothing would mean the model is wrong. Open-but-warned is the window being
  // too narrow for the hue ramp to reach into, and is annotated, not flagged.
  const agree = R.mustWarn === null ? ''
    : (R.mustWarn && r.zone === 0) ? '   <-- MODEL SAYS NO TONE EXISTS, YET THE BOOT WAS SILENT'
    : (!R.mustWarn && r.zone > 0) ? '   (route open but narrow \u2014 no reachable tone in it)'
    : '';
  console.log(`T ${r.T.toFixed(2)}  ground ${r.ground}  print ${r.pole.padEnd(5)}  zone warns ${String(r.zone).padStart(2)}${r.worst ? `  worst ${r.worst}:1` : '        '}  ${R.txt}${agree}${r.other.length ? `  OTHER: ${r.other[0].slice(0, 70)}` : ''}`);
};
const seen = new Map();
const at = async (T) => { T = +T.toFixed(2); if (!seen.has(T)) { const r = await probe(T); seen.set(T, r); say(r); } return seen.get(T); };
console.log('coarse:');
for (const T of [0.58, 0.60, 0.65, 0.70, 0.75, 0.80, 0.85, 0.90, 0.95, 1.00]) await at(T);
const bad = (T) => seen.get(+T.toFixed(2)).zone > 0;
console.log('\nlower edge (last silent below the band):');
let lo = 0.58, hi = null;
for (const T of [...seen.keys()].sort((a, b) => a - b)) if (bad(T)) { hi = T; break; }
if (hi !== null) { let a = [...seen.keys()].sort((x, y) => x - y).filter((t) => t < hi && !bad(t)).pop();
  while (+(hi - a).toFixed(2) > 0.01) { const m = +((a + hi) / 2).toFixed(2); await at(m); if (bad(m)) hi = m; else a = m; }
  console.log(`  silent at ${a.toFixed(2)}, warns from ${hi.toFixed(2)}`); lo = a; }
console.log('\nupper edge (first silent above the band):');
{ const ks = [...seen.keys()].sort((a, b) => a - b); let b0 = ks.filter(bad).pop(); let g0 = ks.filter((t) => t > b0 && !bad(t))[0];
  if (g0 !== undefined) { while (+(g0 - b0).toFixed(2) > 0.01) { const m = +((b0 + g0) / 2).toFixed(2); await at(m); if (bad(m)) b0 = m; else g0 = m; }
    console.log(`  warns at ${b0.toFixed(2)}, silent from ${g0.toFixed(2)}`); } }
await browser.close(); srv.kill();
