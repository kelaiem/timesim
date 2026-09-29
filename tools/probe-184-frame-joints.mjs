// FRAME SCREW ENGAGEMENT — how far each screw that holds the frame together
// actually runs into the member that is supposed to hold it (TODO 184).
//
// REPORT on the engagement, with fatal CONTROLS (so tools/INDEX.md files it
// as acceptance; the shortfall table itself never fails the run). A screw
// closes one joint: head on the member it clamps, thread PAST that member's
// underside into its host. `FRAME_JOINTS` (main.js) declares each joint beside
// the makeScrews call that cuts it and computes engaged = shank − clamp from
// the SAME shank value; ENGAGE_MIN · d is the requirement (1.5 diameters, a
// steel screw in a soft tapped host — the constraint is written there).
// TODO 184 filed every row at 0 engaged; steps 1–3 took all eleven green, and
// step 4 made the table a boot assert and `support`'s engagement column. This
// stays the instrument that prints the table and holds it to the metal.
//
// Controls, fatal:
//  · ROSTER — exactly the declared population per joint class (4 plate
//    screws, 2 balance-cock, 1 fork-cock, 4 pillar tenons). A site that
//    stops declaring its screw would otherwise read as a clean table of
//    fewer rows.
//  · METAL AGREES WITH THE DECLARATION — every row's shank (or tenon) is
//    found in the built geometry it names (`screwShanks`, or the pillar) at
//    its site (vertices inside the thread
//    radius, in the screw's own frame), and the engagement measured off the
//    lowest of them equals the declared one to 1e-4 mm. This is what holds
//    the table to the metal: rewrite a site's shank without its row and this
//    fails. What it does NOT measure: `clamp`, the clamped member's
//    thickness, which is still the declared constant of that member.
//  · BOOT SILENT — rule 6; the table is a report precisely so that it is.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8484;
const ROSTER = {
  'Three-quarter plate ⇄ pillar': 4,
  'Balance cock ⇄ base plate': 2,
  'Fork cock ⇄ base plate': 1,
  'Pillar ⇄ base plate': 4,   // step 3: riveted tenons, measured on the pillar mesh itself
};
const TOL_MM = 1e-4;

const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch();
const page = await browser.newPage();
const warns = [];
page.on('pageerror', (e) => warns.push('PAGEERROR ' + String(e)));
// A plain static server has no /__state (dev_server.py's persistence file),
// so the app's state probe 404s here and falls back to localStorage — the
// one resource miss that is this harness, not the build. Every other 404
// still counts.
const stateMiss = [];
page.on('response', (r) => { if (r.status() === 404 && new URL(r.url()).pathname === '/__state') stateMiss.push(r.url()); });
page.on('console', (m) => {
  const t = m.text();
  if (/WebGL|ReadPixels|GPU stall/.test(t)) return;
  if (/Failed to load resource: .*404/.test(t) && stateMiss.length) { stateMiss.pop(); return; }
  if (m.type() === 'warning' || m.type() === 'error') warns.push('[' + m.type() + '] ' + t);
});
let failed = 0;
const fail = (msg) => { failed++; console.log('FAIL  ' + msg); };
try {
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 180000 });
  await page.waitForFunction(() => !!window.__clock || !!window.__bootError, null, { timeout: 180000 });
  const bootError = await page.evaluate(() => window.__bootError && String(window.__bootError));
  if (bootError) throw new Error('boot failed: ' + bootError);
  const rows = await page.evaluate(() => {
    window.__clock.resetInputs?.();
    return window.__clock.frameJoints();
  });

  const f = (x, n = 3) => (x == null ? '—' : x.toFixed(n));
  console.log('joint                          site (x, y, z)              d mm   need mm  engaged  measured  short');
  for (const r of rows) {
    const short = Math.max(0, r.requiredMM - r.engagedMM);
    console.log(
      `${r.joint.padEnd(30)} (${f(r.site.x, 2)}, ${f(r.site.y, 2)}, ${f(r.site.z, 2)})`.padEnd(58)
      + ` ${f(r.dMM)}  ${f(r.requiredMM)}   ${f(r.engagedMM)}    ${f(r.measuredMM)}   ${f(short)}`);
  }

  // ROSTER
  const count = {};
  for (const r of rows) count[r.joint] = (count[r.joint] ?? 0) + 1;
  for (const [k, n] of Object.entries(ROSTER))
    if ((count[k] ?? 0) !== n) fail(`roster: '${k}' has ${count[k] ?? 0} rows, expected ${n}`);
  for (const k of Object.keys(count))
    if (!(k in ROSTER)) fail(`roster: undeclared joint class '${k}' (${count[k]} rows) — add it to ROSTER`);

  // METAL AGREES WITH THE DECLARATION
  for (const r of rows) {
    if (!r.shankVerts || r.measuredMM == null) { fail(`${r.joint} at (${f(r.site.x, 2)}, ${f(r.site.y, 2)}): no shank metal at the site`); continue; }
    if (Math.abs(r.measuredMM - r.engagedMM) > TOL_MM)
      fail(`${r.joint} at (${f(r.site.x, 2)}, ${f(r.site.y, 2)}): measured ${f(r.measuredMM, 5)} mm ≠ declared ${f(r.engagedMM, 5)} mm`);
  }

  // BOOT SILENT
  if (warns.length) fail('boot not silent:\n  ' + warns.join('\n  '));

  const short = rows.filter((r) => r.engagedMM < r.requiredMM - TOL_MM);
  console.log(`\nREPORT: ${short.length}/${rows.length} joints under ENGAGE_MIN·d (TODO 184's debt; not a failure).`);
  console.log(failed ? `\n${failed} control(s) FAILED` : 'controls PASS (roster, metal = declaration, boot silent)');
} catch (e) {
  fail(String(e && e.stack || e));
} finally {
  await browser.close(); srv.kill();
}
process.exit(failed ? 1 : 0);
