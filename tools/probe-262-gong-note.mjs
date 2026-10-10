// §262 — WHICH C? The gong's pitch target is a NOTE now, and the octave was
// measured here rather than chosen: boot the build with GONG_F1_TARGET_HZ
// rewritten in flight to each C (the foot cut to the arc the fixed point
// derives for it, since the aesthetics knob only knows the shipped one) and
// read what `__clock.acoustics` makes of it — the arc, the head the blow is
// matched to, each partial's level and whether the ear can hear it.
//
// ACCEPTANCE, with a control: the row for the SHIPPED note is booted twice,
// once unmodified and once through the rewrite, and the two must agree on f₁,
// the arc and the level to float noise — a rewrite that does not reproduce
// the shipped build has measured a different program. Any boot that dies, or
// a shipped row whose f₁ is not the target, exits non-zero. The sweep itself
// is a REPORT: it prints the table and names the octave the source chose.
//
// THE COLUMN THAT DECIDES is "at equal blow": under §25's fall law the
// hammer's angular rate was fixed and not its energy (TODO 128 — the spring
// was a rubber band), so a longer wire wanted a heavier matched head and the
// law credited that head with a bigger blow it never earned. Levels are
// therefore compared at the SHIPPED blow's energy as well as raw. Since §266
// the blow is the torsion spiral's released energy, sized from the alarm
// train's torque and not from the head, so the two columns AGREE — the
// column stays because it is the comparison that decided, and because it
// would catch the credit coming back. What it found on arrival: C8's first overtone
// is ultrasonic and the wire loses 11 dB; C6 holds its level only through a
// 16 kHz third partial with its fundamental at −10 dBA; C7 keeps the
// fundamental inside §197's 1–4 kHz band and the overtone that carries the
// ring at 11.4 kHz, 2 dB under 2500 Hz's at equal energy. The fundamental
// is under 5 dBA in every in-band row — the wire alone never rings its own
// note audibly, which is TODO 126's finding restated per octave.
//
//   cd tools && node probe-262-gong-note.mjs            (exit 1 on a dead boot or a failed control)
//   node probe-262-gong-note.mjs --notes C6,C7,C8,2500  (any note name or a frequency in Hz)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

const port = process.env.PORT || '8563';
const root = process.env.ROOT || '..';
const argOf = (k) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : null; };
const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const noteHz = (s) => {
  if (/^[\d.]+$/.test(s)) return { label: `${s} Hz`, hz: Number(s) };
  const m = /^([A-G])(♯|#|b)?(-?\d)$/.exec(s.trim());
  if (!m) throw new Error(`not a note or a frequency: ${s}`);
  const semi = NAMES.indexOf(m[1] + (m[2] === '#' ? '♯' : m[2] === 'b' ? '' : (m[2] || ''))) - (m[2] === 'b' ? 1 : 0);
  const fromA4 = semi - 9 + 12 * (Number(m[3]) - 4);
  return { label: s.trim(), hz: 440 * 2 ** (fromA4 / 12), fromA4 };
};
const notes = (argOf('--notes') || 'C6,2500,C7,C8').split(',').map(noteHz);

const mainSrc = readFileSync(`${root}/src/main.js`, 'utf8');
const TARGET_RE = /const GONG_F1_TARGET_HZ = [^;]+;/;
const FOOT_LINE = 'let GONG_A0 = GONG_A1 + GONG_HAND * aesthetics.gong.arcDeg * DEG2RAD;';
if (!TARGET_RE.test(mainSrc)) throw new Error('GONG_F1_TARGET_HZ declaration not found');
if (!mainSrc.includes(FOOT_LINE)) throw new Error('the foot line is not the one this probe rewrites');

const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
process.on('exit', () => srv.kill());
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();

async function boot(targetHz) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const warns = [];
  page.on('console', (m) => { if (m.type() === 'warning') warns.push(m.text()); });
  page.on('pageerror', (e) => warns.push('PAGEERROR ' + String(e)));
  if (targetHz != null) {
    await page.route('**/src/main.js', (route) => route.fulfill({
      status: 200, contentType: 'text/javascript',
      body: mainSrc.replace(TARGET_RE, `const GONG_F1_TARGET_HZ = ${targetHz};`)
        .replace(FOOT_LINE, 'let GONG_A0 = GONG_A1 + GONG_HAND * GONG_ARC_DESIGN;'),
    }));
  }
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 180000 });
  await page.waitForFunction(() => !!window.__clock || !!window.__bootError, null, { timeout: 180000 });
  const out = await page.evaluate(() => ({ A: window.__clock?.acoustics ? JSON.parse(JSON.stringify(window.__clock.acoustics)) : null, bootError: window.__bootError && String(window.__bootError) }));
  await ctx.close();
  // the knob's own assert is expected to fire under a rewrite (the knob still says the shipped arc)
  out.warns = warns.filter((w) => !/GL Driver|GroupMarker|swiftshader/i.test(w) && !(targetHz != null && w.includes('aesthetics.gong.arcDeg')));
  return out;
}

let failures = 0;
const say = (ok, msg) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };
const pct = (a, b) => Math.abs(a / b - 1);

// 0 — the shipped build, unmodified: the reference row and the control's left side.
const ship = await boot(null);
if (ship.bootError || !ship.A) { console.log('FAIL  the shipped build did not boot:', ship.bootError); process.exit(1); }
const S = ship.A;
const E0 = S.strike.energy_J;
console.log(`shipped: ${S.wire.targetNote} (${S.wire.targetF1_Hz.toFixed(3)} Hz = ${S.wire.concertA4_Hz} Hz × 2^(${S.wire.targetSemitonesAboveA4}/12)) — f₁ ${S.modes[0].f_Hz.toFixed(1)} Hz, arc ${S.wire.arcDeg.toFixed(2)}°, blow ${(E0 * 1e9).toFixed(2)} nJ, ${S.splA_dBA.toFixed(2)} dBA`);
say(pct(S.modes[0].f_Hz, S.wire.targetF1_Hz) < 1e-3, `the shipped fundamental is the target (${S.modes[0].f_Hz.toFixed(2)} vs ${S.wire.targetF1_Hz.toFixed(2)} Hz)`);
say(ship.warns.length === 0, `the shipped boot is silent (${ship.warns.length} warning(s))${ship.warns.length ? ': ' + ship.warns[0].slice(0, 120) : ''}`);

// control — the same note through the rewrite must be the same build
const ctl = await boot(S.wire.targetF1_Hz);
if (ctl.bootError || !ctl.A) { console.log('FAIL  the control boot died:', ctl.bootError); process.exit(1); }
// The rewrite cuts the foot to the DERIVED arc; the shipped build cuts it to the
// knob, which is that arc rounded to 0.01° — so the design arc must agree
// exactly, the head (solved from the design length) exactly, and f₁ and the
// level to the knob's own rounding (0.005° of arc is 2e-4 in f; §198's assert
// allows 1e-3).
say(Math.abs(ctl.A.wire.designArcDeg - S.wire.designArcDeg) < 1e-9 && pct(ctl.A.hammer.headMass_mg, S.hammer.headMass_mg) < 1e-9
  && pct(ctl.A.modes[0].f_Hz, S.modes[0].f_Hz) < 5e-4 && Math.abs(ctl.A.wire.arcDeg - S.wire.arcDeg) < 0.005 + 1e-9 && Math.abs(ctl.A.splA_dBA - S.splA_dBA) < 0.02,
  `CONTROL: the rewrite reproduces the shipped build (design arc ${ctl.A.wire.designArcDeg.toFixed(6)} vs ${S.wire.designArcDeg.toFixed(6)}°, head ${ctl.A.hammer.headMass_mg.toFixed(4)} vs ${S.hammer.headMass_mg.toFixed(4)} mg, f₁ ${ctl.A.modes[0].f_Hz.toFixed(2)} vs ${S.modes[0].f_Hz.toFixed(2)} Hz on the knob's ${S.wire.arcDeg.toFixed(2)}°, ${ctl.A.splA_dBA.toFixed(3)} vs ${S.splA_dBA.toFixed(3)} dBA)`);

// the sweep
const rows = [];
for (const n of notes) {
  const r = await boot(n.hz);
  if (r.bootError || !r.A) { say(false, `${n.label}: the build did not boot — ${r.bootError}`); continue; }
  const A = r.A, m = A.modes;
  const heard = m.filter((x) => x.audible);
  const loudest = heard.reduce((a, b) => (b.splA_dBA > a.splA_dBA ? b : a), heard[0]);
  rows.push({
    label: n.label, hz: n.hz, f1: m[0].f_Hz, f2: m[1].f_Hz, ratio: m[1].f_Hz / m[0].f_Hz, arc: A.wire.designArcDeg, L: A.wire.devLen_mm,
    headMg: A.hammer.headMass_mg, headH: A.hammer.headH_u, owner: A.hammer.headHOwner, E: A.strike.energy_J, mu: A.strike.mu,
    splA: A.splA_dBA, splAeq: A.splA_dBA - 10 * Math.log10(A.strike.energy_J / E0),
    f1A: m[0].splA_dBA, f2A: m[1].splA_dBA, f2aud: m[1].audible, carrier: loudest, inBand: m[0].f_Hz >= 1000 && m[0].f_Hz <= 4000,
    warns: r.warns.filter((w) => !w.includes('outside the 1–4 kHz')), bandWarn: r.warns.some((w) => w.includes('outside the 1–4 kHz')),
  });
}

console.log('\n  note        f₁ Hz   f₂ Hz   f₂/f₁   arc°    L mm  head mg   blow nJ    dBA   dBA@shipped blow   f₁ dBA   f₂ dBA   carries the ring        in band');
for (const r of rows) {
  console.log(`  ${r.label.padEnd(9)} ${r.f1.toFixed(0).padStart(7)} ${r.f2.toFixed(0).padStart(7)}   ${r.ratio.toFixed(2)}   ${r.arc.toFixed(2).padStart(6)}  ${r.L.toFixed(2).padStart(6)}  ${r.headMg.toFixed(1).padStart(7)}  ${(r.E * 1e9).toFixed(2).padStart(8)}  ${r.splA.toFixed(1).padStart(5)}      ${r.splAeq.toFixed(1).padStart(5)}          ${r.f1A.toFixed(1).padStart(6)}   ${(r.f2aud ? r.f2A.toFixed(1) : 'ultrasonic').padStart(10)}   mode ${r.carrier.n} at ${(r.carrier.f_Hz / 1000).toFixed(1)} kHz (${r.carrier.splA_dBA.toFixed(1)} dBA)   ${r.inBand ? 'yes' : 'NO'}`);
  for (const w of r.warns) console.log(`            warn: ${w.slice(0, 140)}`);
}
// What the record reads off this table, stated as the table's own columns: a
// row whose fundamental is in §197's band AND whose ring is carried by the
// FIRST overtone (the partial the sim voices and the page strikes — a row
// carried by a 16 kHz third partial is a whistle most adults do not hear,
// which A-weighting does not price). Among those, the loudest at equal blow.
const eligible = rows.filter((r) => r.inBand && r.carrier.n === 2);
const best = eligible.reduce((a, b) => (b.splAeq > a.splAeq ? b : a), eligible[0]);
console.log(`\n  in band with the first overtone carrying: ${eligible.map((r) => r.label).join(', ') || 'none'}; loudest of those at equal blow: ${best ? best.label : 'none'}.`);
console.log(`  The source ships ${S.wire.targetNote} (${S.wire.targetF1_Hz.toFixed(1)} Hz). In-band rows' fundamental: ${rows.filter((r) => r.inBand).map((r) => `${r.label} ${r.f1A.toFixed(1)} dBA`).join(', ')} — the wire alone never rings its own note audibly (TODO 126: the case is the radiator).`);

await browser.close(); srv.kill();
console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL PASS (controls); the table above is the report');
process.exit(failures ? 1 : 0);
