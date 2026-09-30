// TODO 160 — does the jumper's verdict say WHETHER THE CAP BEARING HAD ANY SAY
// IN IT? ACCEPTANCE.
//
// CAP_SOLVE commits the setting cap's bearing B long before the minute
// jumper's siting solve (JMP_SITE) exists, so a jumper refusal cannot act on
// B. TODO 160 measured that it never needs to today — the jumper accepts
// every bearing CAP_SOLVE opens — and landed the classifier instead: an
// accepted verdict records `bSlack` (the station's clearance against the
// metal B cut ALONE) and a refused one records `cause`, 'B-dependent' when a
// station exists without B's metal (another B could help; the late re-cut
// TODO 160 files would be worth building) or 'B-independent' when none does.
//
// Nothing on today's tree refuses, so the controls PLANT a refusal, in flight:
//   boot A  shipped: accepts, bSlack >= the certified clearance, silent.
//   boot C  a disc through the jumper's whole reach, hung under the setting
//           cap (B's own metal): must refuse, cause 'B-dependent'.
//   boot D  the same disc hung under the dial face (metal no B cut): must
//           refuse, cause 'B-independent'.
// The plant's anchor line must be present exactly once, or the probe refuses:
// a drifted anchor would silently re-serve boot A as a control.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

const PORT = process.env.PORT || 8594;
const ROOT = process.env.ROOT || '..';
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
process.on('exit', () => srv.kill());
await new Promise((r) => setTimeout(r, 900));

const MAIN = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const ANCHOR = '  const lawedRoots = LAWED.flatMap(';   // TODO 181: the lawed roots are read off JMP_SITE_MOVERS now
if (MAIN.split(ANCHOR).length !== 2) {
  console.error(`REFUSED: src/main.js no longer contains exactly one \`${ANCHOR.trim()}\` — the plant goes there.`);
  process.exit(1);
}
// a 0.3-thick disc, one unit wider than the jumper's radial reach, centred on
// the stud at the lifter's plane: every station meets it
const plant = (parentExpr) => `  {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(JMP_SITE_RC + 1, JMP_SITE_RC + 1, 0.3, 48), MATS.steel);
    disc.name = 'probe160Disc';
    disc.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), studA);
    disc.position.copy(jumperLifter.getWorldPosition(new THREE.Vector3()));
    scene.add(disc); disc.updateMatrixWorld(true);
    (${parentExpr}).attach(disc); disc.updateMatrixWorld(true);
  }
`;
const withPlant = (parentExpr) => MAIN.replace(ANCHOR, plant(parentExpr) + ANCHOR);

const browser = await chromium.launch({ args: ['--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'] });

async function boot(src) {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 700 } });
  await ctx.route('**/__state*', (r) => (r.request().method() === 'GET' ? r.fulfill({ status: 404, body: '' }) : r.fulfill({ status: 204, body: '' })));
  let took = !src;
  if (src) await ctx.route('**/src/main.js*', (r) => { took = true; r.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: src }); });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 300000 });
  await page.waitForFunction(() => !!window.__clock || !!window.__bootError, null, { timeout: 300000, polling: 1000 });
  const r = await page.evaluate(() => {
    const c = window.__clock;
    if (!c) return { bootError: String(window.__bootError) };
    const j = c.jumperSite;
    const row = (c.settingFold?.scan || []).find((x) => x.jumper);
    return { azDeg: j.azDeg, clr: j.clr, bSlack: j.bSlack, cause: j.cause, row: row ? row.jumper : null, warns: c.bootWarns.slice() };
  });
  await ctx.close();
  if (!took) throw new Error('the main.js rewrite never served — the boot is not the control it claims');
  return { ...r, errors };
}

const fails = [];
const fail = (s) => { fails.push(s); console.log('  FAIL ' + s); };

const A = await boot(null);
console.log(`boot A (shipped): ${A.row?.verdict} at ${A.azDeg}°, clearance ${A.clr?.toFixed?.(4)}, bSlack ${A.bSlack}, ${A.warns?.length ?? '?'} boot warning(s)`);
if (A.bootError || A.errors.length) fail(`boot A: ${A.bootError || A.errors[0]}`);
if (A.row?.verdict !== 'accepts') fail('boot A: CAP_SOLVE\'s open row does not record an accepting jumper');
if (!(A.bSlack >= A.clr - 1e-9)) fail(`boot A: bSlack ${A.bSlack} below the certified clearance ${A.clr}`);
if (A.row?.bSlack !== A.bSlack) fail('boot A: the scan row does not carry bSlack');
if (A.warns?.length) fail(`boot A is not silent: ${A.warns[0]}`);

const C = await boot(withPlant('SETTING_METAL.settingCap'));
console.log(`boot C (disc under the setting cap — B's metal): ${C.row?.verdict}, cause ${C.cause}`);
if (C.bootError || C.errors.length) fail(`boot C: ${C.bootError || C.errors[0]}`);
else {
  if (C.row?.verdict !== 'refuses') fail('boot C: a disc through the jumper\'s whole reach did not make it refuse — the plant missed the region');
  if (C.cause !== 'B-dependent' || C.row?.cause !== 'B-dependent') fail(`boot C: cause ${C.cause} (row ${C.row?.cause}), want B-dependent`);
  if (!C.warns.some((w) => /B-dependent/.test(w))) fail('boot C: the refusal warning does not name its cause');
}

const D = await boot(withPlant('dialFace'));
console.log(`boot D (the same disc under the dial face — no B cut it): ${D.row?.verdict}, cause ${D.cause}`);
if (D.bootError || D.errors.length) fail(`boot D: ${D.bootError || D.errors[0]}`);
else {
  if (D.row?.verdict !== 'refuses') fail('boot D: the disc did not make it refuse');
  if (D.cause !== 'B-independent' || D.row?.cause !== 'B-independent') fail(`boot D: cause ${D.cause} (row ${D.row?.cause}), want B-independent`);
}

await browser.close();
console.log(fails.length ? `\nFAIL — ${fails.length} problem(s)` : '\nPASS — the verdict records bSlack when it accepts, and names whether B had any say when it refuses');
process.exit(fails.length ? 1 : 0);
