// TODO 51 — the winding arrest's two `expectedContacts` rows, measured and
// then DIAGNOSED. The gate says "min 0 at pose f"; this says which vertex of
// which member reaches how far into which neighbour, which is what a
// position-space fix needs. Prints the arrest's own solved quantities beside
// them so the coupling the item names (stud radius → pad arm → throw → lug
// clocking) is visible in one page of output.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const port = process.env.PORT || '8471';
const root = process.env.ROOT || '..';
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
const warns = [];
page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') warns.push(m.text()); });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });

const facts = await page.evaluate(() => {
  const c = window.__clock;
  const w = c.windArrest || {};
  const named = {};
  c.scene.traverse((o) => { if (o.isMesh && /windArrest/.test(o.name)) named[o.name] = true; });
  return { wind: w, meshes: Object.keys(named).sort() };
});
console.log('--- the arrest\'s solved quantities ---');
console.log(JSON.stringify(facts.wind, null, 1));
console.log('meshes:', facts.meshes.join(' '));

console.log('\n--- expectedContacts, the arrest rows only ---');
await page.evaluate(async () => {
  const I = await import('./src/inspect.js');
  const rows = I.EXPECTED_CONTACT_FLOORS.filter((r) => r.a === 'Winding arrest' || r.b === 'Winding arrest');
  I.start(window.__clock, 'expectedContacts', { rows, yieldEvery: 64 });
});
let out = null;
for (let i = 0; i < 200; i++) {
  await new Promise((r) => setTimeout(r, 2000));
  out = await page.evaluate(() => (window.__checks?.expectedContacts ?? null));
  if (out && out.state !== 'running') break;
}
const r = out?.result;
if (!r) { console.log('NO RESULT', JSON.stringify(out)); await browser.close(); srv.kill(); process.exit(1); }
for (const row of r.results ?? []) {
  console.log(`${row.ok ? 'PASS' : 'FAIL'}  ${row.pair}  min=${row.min}  floor=${row.floor}`
    + `  at=${row.at}  meshes=${row.meshes ?? '-'}  excluded=${row.contactsExcluded}`);
}
console.log('violations:', (r.violations ?? []).length, 'waived:', r.waivedCount,
  'unmatched:', JSON.stringify(r.unmatched ?? []));

if (warns.length) { console.log('\n--- boot warnings ---'); for (const w of warns) console.log(' ', w); }
await browser.close();
srv.kill();
