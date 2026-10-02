// TODO 194 — DOES EVERY DECLARED SPRING TOUCH THE BODY IT RETURNS? ACCEPTANCE.
// The control for `restoring`'s reach tier (inspect.js measureSpringReach),
// proved on both sides of the defect that made it:
//
//   1. ROOT (this tree): every member-named spring declaration is measured,
//      and the follower's return spiral must REACH its arm (0 — its outer end
//      is clamped in the arm's riser). The full table is printed: reach, the
//      body mesh it reached through, the `through` hop where a row names one,
//      and the waiver a row cites.
//   2. BASE (BASE=<a checkout from before TODO 194>, optional): §29's blade —
//      the unnamed BoxGeometry beside `alarmFollowerSpringStud` — is measured
//      through the SAME function as an ad-hoc row against `alarmFollowerBar`,
//      and must come back UNREACHED (the item measured it 0.08–0.28 off the
//      arm at every parity). A control that passed the old blade would be a
//      control that measures nothing. The base tree runs this tree's
//      inspect.js (copy it over the base's before running): the function under
//      test must be the one that ships.
//
// Not `probe-silence-feeler-pairs.mjs` (one unit pair's mesh population) and
// not `alarmHandoffs` (declared contacts at four parities): this asks the §48
// question of every declaration at once. Run from tools/:
//   node probe-194-spring-reach.mjs
//   BASE=/path/to/base node probe-194-spring-reach.mjs
// CHROMIUM=<path> for a browser outside Playwright's cache.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { virginBoot, prepPage } from './battery-checks.mjs';

const ROOT = resolve(process.env.ROOT || '..');
const BASE = process.env.BASE ? resolve(process.env.BASE) : null;
const BOOT_MS = 400000;
let bad = 0;
const launch = () => chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});

async function onTree(root, port, fn) {
  const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
  process.on('exit', () => srv.kill());
  await new Promise((r) => setTimeout(r, 900));
  const browser = await launch();
  try {
    const { page } = await virginBoot(browser, `http://127.0.0.1:${port}`, BOOT_MS);
    await page.waitForFunction(() => window.__clock.boot && window.__clock.boot.done, null, { timeout: BOOT_MS });
    await prepPage(page);
    return await fn(page);
  } finally { await browser.close(); srv.kill(); }
}

const here = await onTree(ROOT, Number(process.env.PORT || 8593), (page) => page.evaluate(async () => {
  const r = await window.__I.measureSpringReach(window.__clock);
  return r;
}));
console.log('ROOT — every member-named spring declaration:');
for (const r of here.rows) {
  console.log(`  ${r.reached ? 'REACHED  ' : r.waiver ? `WAIVED ${r.waiver}` : 'UNREACHED'}  ${r.unit} / ${r.member} ← ${r.spring}`
    + `${r.through ? ` through ${r.through} (hop ${r.hop1})` : ''}: ${r.reach} via ${r.via}`);
}
for (const u of here.unresolved) { console.log(`  UNRESOLVED ${JSON.stringify(u)}`); bad++; }
for (const k of here.staleWaivers) { console.log(`  STALE WAIVER ${k}`); bad++; }
for (const r of here.rows) if (!r.reached && !r.waiver) bad++;
const fol = here.rows.find((r) => r.unit === 'Alarm disc' && r.member === 'alarmFollowerBar');
if (!fol || !fol.reached) { console.log('  FAIL — the follower\'s return spiral does not reach its arm'); bad++; }
else console.log(`  must-hit: the return spiral reaches the arm at ${fol.reach} (via ${fol.via})`);

if (BASE) {
  const there = await onTree(BASE, Number(process.env.PORT || 8593) + 1, (page) => page.evaluate(async () => {
    const c = window.__clock;
    const ent = c.labelEntries.find((e) => e.name === 'Alarm disc');
    const meshes = [];
    const walk = (o) => { if (o.userData && o.userData.schematic) return; if (o.isMesh && o.geometry && o.geometry.attributes.position) meshes.push(o); for (const ch of o.children) walk(ch); };
    walk(ent.obj);
    const stud = meshes.find((m) => m.name === 'alarmFollowerSpringStud');
    if (!stud) return { error: 'BASE has no alarmFollowerSpringStud — not a pre-TODO-194 tree' };
    const blade = stud.parent.children.find((m) => m.isMesh && !m.name && m.geometry.type === 'BoxGeometry');
    const label = `${blade.geometry.type}#${meshes.indexOf(blade)}`;
    const r = await window.__I.measureSpringReach(c, [
      { unit: 'Alarm disc', member: 'alarmFollowerBar', kind: 'spring', mesh: label },
      { unit: 'Alarm disc', member: 'alarmFollowerBar', kind: 'spring', mesh: 'alarmFollowerSpringStud' },
    ]);
    return { label, rows: r.rows };
  }));
  console.log('BASE — §29\'s blade and its stud, as ad-hoc rows:');
  if (there.error) { console.log(`  ${there.error}`); bad++; }
  else {
    for (const r of there.rows) console.log(`  ${r.reached ? 'REACHED' : 'UNREACHED'}  ${r.spring}: ${r.reach} via ${r.via}`);
    if (there.rows[0].reached) { console.log('  FAIL — the control passed the blade that never reached the arm'); bad++; }
    else console.log(`  must-miss: the old blade (${there.label}) reads ${there.rows[0].reach} — the control fires`);
  }
}
console.log(bad ? `FAIL (${bad})` : 'PASS');
process.exit(bad ? 1 : 0);
