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
  return { T, zone: zone.length, other, ground: r.ground, pole: r.ink === '#1a1a1a' ? 'dark' : 'light', worst };
}
const say = (r) => console.log(`T ${r.T.toFixed(2)}  ground ${r.ground}  print ${r.pole.padEnd(5)}  zone warns ${String(r.zone).padStart(2)}${r.worst ? `  worst ${r.worst}:1` : ''}${r.other.length ? `  OTHER: ${r.other[0].slice(0, 70)}` : ''}`);
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
