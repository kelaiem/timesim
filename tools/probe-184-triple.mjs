// THE TIER-SPLIT TRIPLE — is a bearing that is fine ALONE fine TOGETHER?
//
// ACCEPTANCE for §184's three reconfigure rows (θ_b, θ_g, θ_a) and the single
// joint bound they share. The thesis this exists to prove is the roadmap's own
// warning: θ_b 202°, θ_g 92° and θ_a 148° are ONE solved triple (§112's argmax
// over the whole rotation × bearing space), so three INDEPENDENT refusals would
// let a drag put one leg somewhere fine for that leg and break the triple, with
// nothing to say so.
//
// That is not an argument here, it is a measurement. The probe finds pairs of
// legs each of which the handle accepts in SILENCE on its own, and asks whether
// the pair together still clears. Every such pair is a defect three independent
// refusals would have shipped.
//
// THREE VERDICT SOURCES, and they are different kinds of evidence:
//
//   alone      the row's shadow with the other two legs at their built values
//   joint      the same bound with BOTH legs of the pair applied at once
//   BOOT       an actual ?alarmgovaz=…&alarmanchoraz=… boot
//
// The boot column splits deliberately. §184's own assert re-evaluates the same
// joint bound at whatever triple was built, so boot-vs-joint agreement is a
// CONSISTENCY check — it catches spec plumbing that never reached the build,
// which is a real failure and not a small one. Warnings from OTHER asserts are
// INDEPENDENT evidence that the joint bound is not crying wolf. Both are
// reported; only the first is a gate, because the second is a property of the
// movement's other instruments and not of this row.
//
// Run: cd tools && node probe-183-triple.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const ROOT = process.env.ROOT || '/home/user/timesim';
const PORT = process.env.PORT || '8594';
const srv = spawn('python3', ['-m', 'http.server', PORT, '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch();

const bootAt = async (q) => {
  const p = await browser.newPage();
  const warns = [];
  p.on('console', (m) => { const t = m.text();
    if ((m.type() === 'warning' || m.type() === 'error') && !/WebGL|GroupMarker|Failed to load resource/.test(t)) warns.push(t); });
  p.on('pageerror', (e) => warns.push('PAGEERROR ' + String(e)));
  await p.goto(`http://127.0.0.1:${PORT}/index.html?hud=0&sync=0${q}`, { waitUntil: 'load', timeout: 120000 });
  const ok = await p.waitForFunction(() => !!window.__clock, null, { timeout: 120000 }).then(() => true).catch(() => false);
  await p.waitForTimeout(1200);
  await p.close();
  return { ok, own: warns.filter((w) => /§184/.test(w)), other: warns.filter((w) => !/§184/.test(w)) };
};

const p0 = await browser.newPage();
p0.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await p0.goto(`http://127.0.0.1:${PORT}/index.html?hud=0&sync=0`, { waitUntil: 'load', timeout: 120000 });
await p0.waitForFunction(() => !!window.__clock, null, { timeout: 120000 });

const found = await p0.evaluate(() => {
  const c = window.__clock, T = c.alarmTier, D2R = Math.PI / 180;
  const H = c.reconfHandles;
  const LEGS = [
    { kind: 'alarmbarrelaz', leg: 'thB', url: 'alarmbarrelaz' },
    { kind: 'alarmgovaz', leg: 'thG', url: 'alarmgovaz' },
    { kind: 'alarmanchoraz', leg: 'thA', url: 'alarmanchoraz' },
  ];
  for (const L of LEGS) {
    L.row = H.find((h) => h.kind === L.kind);
    if (!L.row) return { missing: L.kind };
    // Clean ALONE: the row's own shadow, others at their built values.
    L.clean = [];
    for (let d = 0; d < 360; d += 5) if (L.row.shadow(d).warns.length === 0) L.clean.push(d);
  }
  const mk = (a, b) => ({ ...T.triple, [a.leg]: a.v * D2R + (T.triple[a.leg] - a.rowDefRad), [b.leg]: b.v * D2R + (T.triple[b.leg] - b.rowDefRad) });
  // Build a triple from two legs' SPEC degrees, keeping the third as built.
  // modOff converts a spec degree to the module-relative radian the build uses.
  const modOff = (L) => T.triple[L.leg] - L.row.def * D2R;
  const tripleOf = (pairs) => {
    const t = { ...T.triple };
    for (const { L, v } of pairs) t[L.leg] = v * D2R + modOff(L);
    return t;
  };
  const out = { pairs: [], counts: {}, cleanCounts: {} };
  for (const L of LEGS) out.cleanCounts[L.kind] = L.clean.length;
  for (let i = 0; i < LEGS.length; i++) for (let j = i + 1; j < LEGS.length; j++) {
    const A = LEGS[i], B = LEGS[j];
    let both = 0, broken = 0; const examples = [];
    for (const va of A.clean) for (const vb of B.clean) {
      both++;
      const w = T.warnsAt(tripleOf([{ L: A, v: va }, { L: B, v: vb }]));
      if (w.length) { broken++; if (examples.length < 3) examples.push({ va, vb, why: w[0] }); }
    }
    out.counts[`${A.kind}+${B.kind}`] = { both, broken };
    if (examples.length) out.pairs.push({ a: A.url, b: B.url, aKind: A.kind, bKind: B.kind, examples });
  }
  // A jointly-CLEAN pair, for the must-miss control.
  const A = LEGS[1], B = LEGS[2];
  out.control = null;
  for (const va of A.clean) { for (const vb of B.clean) {
    if (!T.warnsAt(tripleOf([{ L: A, v: va }, { L: B, v: vb }])).length) { out.control = { a: A.url, b: B.url, va, vb }; break; }
  } if (out.control) break; }
  return out;
});
await p0.close();

if (found.missing) { console.log('FAIL — no row of kind ' + found.missing); await browser.close(); srv.kill(); process.exit(1); }

console.log('clean-ALONE values per leg (of 72 sampled at 5°):');
for (const [k, n] of Object.entries(found.cleanCounts)) console.log(`  ${k.padEnd(16)} ${n}`);
console.log('\npairs BOTH clean alone, and how many of those the JOINT bound rejects:');
for (const [k, v] of Object.entries(found.counts))
  console.log(`  ${k.padEnd(34)} ${String(v.broken).padStart(5)} / ${v.both}`);

if (!found.pairs.length) {
  console.log('\nFAIL — not one pair of individually-clean bearings breaks the triple.');
  console.log('       Either the joint bound is vacuous or the sampling missed it; a joint');
  console.log('       refusal that never disagrees with three independent ones is not one.');
  await browser.close(); srv.kill(); process.exit(1);
}

console.log('\nBOOTING the pairs the joint bound rejects — ground truth:');
let bad = 0;
for (const p of found.pairs) {
  for (const ex of p.examples) {
    const b = await bootAt(`&${p.a}=${ex.va}&${p.b}=${ex.vb}`);
    const consistent = b.ok && b.own.length > 0;
    if (!consistent) bad++;
    console.log(`  ${p.a}=${String(ex.va).padStart(3)} ${p.b}=${String(ex.vb).padStart(3)}  ` +
      `§184 at boot ${b.ok ? String(b.own.length).padStart(2) : 'no boot'}  other warns ${b.ok ? String(b.other.length).padStart(2) : '--'}  ` +
      `${consistent ? 'consistent' : 'INCONSISTENT — the shadow refused what the build accepts'}`);
    if (ex === p.examples[0]) console.log(`      why: ${ex.why}`);
  }
}

if (found.control) {
  const c = found.control;
  const b = await bootAt(`&${c.a}=${c.va}&${c.b}=${c.vb}`);
  const ok = b.ok && b.own.length === 0;
  if (!ok) bad++;
  console.log(`\nMUST-MISS control — a jointly clean pair must boot without §184 speaking:`);
  console.log(`  ${c.a}=${c.va} ${c.b}=${c.vb}  §184 at boot ${b.ok ? b.own.length : 'no boot'}  ${ok ? 'silent, as required' : 'SPOKE — the bound disagrees with itself'}`);
} else {
  console.log('\nNo jointly-clean off-default pair found for the must-miss control.');
  bad++;
}

console.log('');
if (bad) {
  console.log(`FAIL — ${bad} disagreement(s) between the row's joint bound and the built movement.`);
} else {
  console.log('PASS — every individually-clean pair the joint bound rejects is one the build');
  console.log('       also rejects, and a jointly-clean pair builds silently. Three independent');
  console.log('       refusals would have accepted every rejected pair above.');
}
await browser.close(); srv.kill();
process.exit(bad ? 1 : 0);
