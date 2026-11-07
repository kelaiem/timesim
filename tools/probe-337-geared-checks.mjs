#!/usr/bin/env node
// §337 landing 2b, stage 3 — WHAT THE INSPECTOR SAYS ABOUT THE GEARED LINE. A REPORT (it prints and judges nothing): it boots
// ?arrest=geared and runs the inspector checks that cover a mechanism's wiring (support / drive graph, expected contacts, intra-unit
// contacts, mesh integrity / coverage / phase, transmission, penetration, the wind-arrest hand-offs), then prints each verdict's
// size and its first rows. Stage 3 turns what it shows into rows (the geared meshes' contacts, the graph edge) and a gate.
//   node tools/probe-337-geared-checks.mjs [reserve hours] [check …]   (default 24; default checks as below)
import { bootMany } from './boot-pool.mjs';
const hours = Number(process.argv[2]) || 24;
const DEFAULT = ['support', 'graph', 'windArrestHandoff', 'expectedContacts', 'intraUnit', 'meshIntegrity', 'meshCoverage', 'meshPhase', 'transmits', 'penetration', 'stockFloor'];
const checks = process.argv.length > 3 ? process.argv.slice(3) : DEFAULT;
const EXPR = `(async () => {
  const I = await import('./src/inspect.js'), c = window.__clock, out = {};
  c.beginSweepHold();
  for (const name of ${JSON.stringify(checks)}) {
    try {
      await I.start(c, name, {});
      let st; for (;;) { st = I.status(name); if (st.state !== 'running') break; await new Promise((r) => setTimeout(r, 250)); }
      out[name] = st.state === 'done' ? st.result : { error: String(st.error).slice(0, 400) };
    } catch (e) { out[name] = { error: String(e).slice(0, 400) }; }
  }
  out.sw = c.windArrest.stopwork;
  return out;
})()`;
const [r] = await bootMany([`arrest=geared&reserveh=${hours}`], EXPR, { concurrency: 1 });
console.log(`== ${hours} h ==  boot ${r.bootError ?? 'ok'}, ${r.warnings.length} warning(s)`);
for (const w of r.warnings) if (/§337|§329|§336/.test(w)) console.log('  warn:', String(w).slice(0, 240));
const { sw, ...results } = r.extra ?? {};
if (sw) console.log('  studs: finger', sw.studFr, 'star', sw.studSr, 'forces', JSON.stringify(sw.pairForce), 'mesh', sw.Fmesh, '\n  cock at the stall:', JSON.stringify(sw.cockStall));
for (const [name, res] of Object.entries(results)) {
  const s = JSON.stringify(res);
  console.log(`\n-- ${name} (${s.length} chars)\n${s.slice(0, 1500)}${s.length > 1500 ? ' …' : ''}`);
}
