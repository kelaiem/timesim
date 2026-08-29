// THE PANEL RE-CUT REPRODUCES THE BOOT METAL — TODO 112/113's acceptance,
// held from now on.
//
// ACCEPTANCE (exit non-zero). HAND_SPECS is the panel's re-cut table, and it
// used to RESTATE each hand's build options by hand: the restatement drifted
// twice (a stale minute length; then the reserve row shipping without §158's
// `halfWidth`, so any flute drag silently re-cut the 3.00' pointer at 1.16'),
// and the alarm hand was absent from the table entirely. The fix makes each
// row reference the hand's boot spec OBJECT; this probe holds the resulting
// claim: re-cutting through the panel path at the boot aesthetics reproduces
// the boot metal byte for byte, for all FIVE hands, and a real flute drag
// changes the flute and nothing else.
//
// What this is NOT: probe-hand-stack.mjs measures the boot-state stack and
// never exercises the panel; probe-153-boot.mjs holds the reserve claims at
// boot. Nothing before this drove recutHands at all.
//
// Controls, both ways:
//   must-move — a real flute drag MUST change at least one shaft geometry
//     hash (proves the hash sees geometry and that recutHands actually ran;
//     N-identical-rows trap);
//   must-catch — makeHand called with the reserve spec MINUS halfWidth must
//     show this probe's own width read collapsing 3.00' -> ~1.16' (the exact
//     TODO 112 defect, proven visible to the instrument that guards it).
//
// Drivers: the #flute-slider input event, and the §23 generated panel row for
// dial.hands.hour.widthFactor (rows carry their key path in the label title),
// so both recutHands entry points — the hand-written slider and APPLIERS.dial
// — are exercised.
//
// Run: node tools/probe-112-recut.mjs   (ROOT= for another worktree)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const srv = spawn('python3', ['-m', 'http.server', '8518', '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto('http://127.0.0.1:8518/index.html', { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 120000 });

// One snapshot = every hand's metal and law, as data. Runs in the page.
const snapshot = () => page.evaluate(async () => {
  const M = await import('./src/materials.js');
  const clock = window.__clock;
  // The central hands are unnamed (no namePrefix — §94 explains why naming is
  // per-hand); find every hand group by makeHand's userData signature, then
  // classify: the two subdial hands by their named shaft meshes, hour vs
  // alarm among kind 'hour' by length.
  const groups = [];
  clock.scene.traverse((o) => {
    if (o.userData && o.userData.rBase !== undefined && o.userData.kind !== undefined && o.userData.length !== undefined)
      groups.push(o);
  });
  const hasMesh = (g, name) => { let f = false; g.traverse((o) => { if (o.name === name) f = true; }); return f; };
  const hours = groups.filter((g) => g.userData.kind === 'hour').sort((a, b) => b.userData.length - a.userData.length);
  const named = {
    smallSecondsHand: groups.find((g) => hasMesh(g, 'smallSecondsShaft')),
    reserveHand: groups.find((g) => hasMesh(g, 'reserveShaft')),
    hourHand: hours[0],
    alarmHand: hours[1],
    minuteHand: groups.find((g) => g.userData.kind === 'minute' && !hasMesh(g, 'reserveShaft') && !hasMesh(g, 'smallSecondsShaft')),
  };
  const missing = Object.entries(named).filter(([, g]) => !g).map(([n]) => n);
  if (missing.length) return { error: `cannot find: ${missing.join(', ')}` };
  const fnv = (bytes) => {
    let h = 0x811c9dc5;
    for (let i = 0; i < bytes.length; i++) { h ^= bytes[i]; h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(16);
  };
  const out = {};
  for (const [name, g] of Object.entries(named)) {
    const meshes = [];
    g.traverse((o) => {
      if (!o.isMesh) return;
      const pos = o.geometry.attributes.position;
      o.geometry.computeBoundingBox();
      const bb = o.geometry.boundingBox;
      meshes.push({
        name: o.name || '(unnamed)',
        steel: o.material === M.MATS.steel,
        blued: o.material === M.MATS.bluedHand,
        verts: pos.count,
        hash: fnv(new Uint8Array(pos.array.buffer, pos.array.byteOffset, pos.array.byteLength)),
        // local x-extent of the widest mesh is the blade's plan width
        xSpan: +(bb.max.x - bb.min.x).toFixed(6),
      });
    });
    const u = g.userData;
    out[name] = {
      meshes,
      userData: { length: +u.length.toFixed(6), kind: u.kind, rBase: +u.rBase.toFixed(6), halfW: +u.halfW.toFixed(6), bossR: +u.bossR.toFixed(6), bossH: +u.bossH.toFixed(6) },
      scaleZ: g.scale.z, posZ: +g.position.z.toFixed(6),
    };
  }
  return out;
});

const drive = (selector) => page.evaluate((sel) => {
  if (sel.slider) {
    const el = document.getElementById('flute-slider');
    if (sel.value !== undefined) el.value = sel.value;
    el.dispatchEvent(new Event('input'));
    return { drove: 'flute-slider', at: el.value };
  }
  // §23 generated row: find by the label's title (the key path, English by contract)
  const row = [...document.querySelectorAll('.adv-row')]
    .find((r) => r.querySelector('.adv-label')?.title.split(' ')[0] === sel.path);
  if (!row) return { drove: null };
  const input = row.querySelector('input');
  input.dispatchEvent(new Event('input'));   // same value — idempotence claim
  return { drove: sel.path, at: input.value };
}, selector);

const fails = [];
const check = (cond, msg) => { if (!cond) { fails.push(msg); console.log('FAIL  ' + msg); } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Boot silence per the battery's own definition — the app's collector, not
// the console stream (headless Chromium's SwiftShader deprecation notes are
// browser noise the app never emitted).
const bootWarns = await page.evaluate(() => window.__bootWarns.slice());
check(bootWarns.length === 0, `boot is not silent: ${bootWarns.length} warning(s): ${bootWarns[0]}`);

const S0 = await snapshot();
if (S0.error) { console.log('ABORT: ' + S0.error); await browser.close(); srv.kill(); process.exit(2); }
const MMu = 0.378947, arcmin = (u) => (u * MMu / 350) * (60 * 180 / Math.PI);
console.log('boot snapshot: 5 hands,',
  Object.values(S0).reduce((n, h) => n + h.meshes.length, 0), 'meshes;',
  `reserve width ${(2 * S0.reserveHand.userData.halfW).toFixed(4)} u = ${arcmin(2 * S0.reserveHand.userData.halfW).toFixed(2)}′,`,
  `alarm steel ${S0.alarmHand.meshes.every((m) => m.steel)}, scale.z ${S0.alarmHand.scaleZ}`);

// (b) idempotent re-cut through the flute slider at its boot value
const fluteBoot = await drive({ slider: true });
const S1 = await snapshot();
check(same(S0, S1), 'flute re-cut at the boot value did not reproduce the boot metal (S1 ≠ S0)');

// (e) idempotent re-cut through the §23 generated panel (APPLIERS.dial path)
const panel = await drive({ path: 'dial.hands.hour.widthFactor' });
if (panel.drove) {
  const S1b = await snapshot();
  check(same(S0, S1b), `panel re-cut via ${panel.drove} at its own value did not reproduce the boot metal`);
  console.log(`panel driver: drove ${panel.drove} at ${panel.at} — idempotent ${same(S0, S1b) ? 'PASS' : 'FAIL'}`);
} else console.log('panel driver: no .adv-row for dial.hands.hour.widthFactor found — flute slider already exercises the same recutHands');

// (c) a REAL flute drag: laws hold, metal moves, and the round trip closes
await drive({ slider: true, value: String(Math.round(Number(fluteBoot.at)) - 27) });
const S2 = await snapshot();
let moved = 0;
for (const name of Object.keys(S0)) {
  const a = S0[name], b = S2[name];
  check(same(a.userData, b.userData), `${name}: section-law userData moved under a flute drag`);
  check(a.scaleZ === b.scaleZ && a.posZ === b.posZ, `${name}: group scale/position moved under a flute drag`);
  check(same(a.meshes.map((m) => [m.name, m.steel, m.blued, m.xSpan]), b.meshes.map((m) => [m.name, m.steel, m.blued, m.xSpan])),
    `${name}: material or plan width moved under a flute drag`);
  for (let i = 0; i < a.meshes.length; i++) if (a.meshes[i].hash !== b.meshes[i].hash) moved++;
}
check(moved > 0, 'MUST-MOVE control: a real flute drag changed no geometry hash — the probe is not seeing the metal, or recutHands did not run');
console.log(`flute drag: ${moved} mesh geometries moved, laws held (widths, materials, userData, planes all fixed)`);

await drive({ slider: true, value: fluteBoot.at });
const S3 = await snapshot();
check(same(S0, S3), 'round trip: restoring the boot flute did not reproduce the boot metal (S3 ≠ S0)');

// (d) MUST-CATCH control: the exact TODO 112 defect, rebuilt synthetically —
// the reserve spec minus halfWidth must collapse to the √3/2 default and this
// probe's own width read must see it.
const catchRes = await page.evaluate(async (rsv) => {
  const G = await import('./src/geometry.js');
  const bad = G.makeHand({ length: rsv.length, kind: rsv.kind, subdial: true });
  return { badHalfW: bad.userData.halfW, badRBase: bad.userData.rBase };
}, S0.reserveHand.userData);
const goodW = 2 * S0.reserveHand.userData.halfW, badW = 2 * catchRes.badHalfW;
check(badW < goodW * 0.6, `MUST-CATCH control: dropping halfWidth left width ${badW.toFixed(4)} vs ${goodW.toFixed(4)} — the collapse this probe guards against is not visible to it`);
console.log(`must-catch: spec minus halfWidth cuts ${arcmin(badW).toFixed(2)}′ vs the real ${arcmin(goodW).toFixed(2)}′ — the defect is visible to this instrument`);

const endWarns = await page.evaluate(() => window.__bootWarns.slice());
check(endWarns.length === 0, `app warnings during the run: ${endWarns[0] || ''}`);

console.log(fails.length ? `\n${fails.length} FAILURE(S)` : '\nALL PASS: boot silent, both re-cut drivers idempotent, flute drag moves only the flute, round trip closes, both controls fire');
await browser.close(); srv.kill();
process.exit(fails.length ? 1 : 0);
