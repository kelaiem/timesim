// §204 — DOES EVERY BEAT-RATE ROW CLOSE AS WELL AS THE MENU ALREADY DOES?
// Acceptance. Boots the identity spec and every row of §22's rate table
// (`SPEC_RATES`, read off layout.js — never a copy) headless and prints, per
// row: the fourth⇄escape pair and its module, the fourth wheel's pitch radius,
// the plate radius, the escape arbor, the solved ribbon and every boot
// warning. Then it holds §204's two claims:
//   1. the identity row boots SILENT (standing rule 6, the fingerprint's own
//      precondition);
//   2. the 36,000 row's warning SET equals the 28,800 row's — the same
//      structural asserts and no member added. "Closes exactly as well as the
//      menu already does" is the claim §204 shipped on, and set equality is
//      what it means: a 36,000 row that trips an assert 28,800 does not is the
//      naive 6/120-at-0.21 row this probe exists to keep out (5 warnings, the
//      plate past §187's aperture and through §186's clamp thread).
// A warning is identified by the ASSERT that raised it — its § tag and the
// subject clause up to the first number — never by what it measured: the
// clamp wall reading 0.112 → 0.315 u is the same warning, and so is the gong
// band's floor binding on the screw heads at one row and the screw slots at
// another (the assert is the band's height, the binding member is its
// reason). A NEW § or a new subject is a new assert. The fast rows' three
// shared warnings (§186 wall, §125 D4, §197 gong band) are §22's open
// residue, reported here and not gated.
//   cd tools && node probe-204-rates.mjs          (exit 1 on either claim)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8464;
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const mask = (t) => t.replace(/^(§\d+:[^\d]*).*$/s, '$1').trim(); // the assert's identity: tag + subject, up to its first number

async function boot(vph) {
  const page = await browser.newPage();
  const warns = [];
  page.on('pageerror', (e) => warns.push('PAGEERROR ' + String(e)));
  page.on('console', (m) => { if (m.type() === 'warning' && !/GroupMarker|GL Driver|SwiftShader|WebGL/.test(m.text())) warns.push(m.text()); });
  await page.goto(`http://127.0.0.1:${PORT}/index.html${vph ? `?vph=${vph}` : ''}`, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => !!window.__clock || !!window.__bootError, null, { timeout: 90000 })
    .catch(() => warns.push('NO __clock — boot died'));
  const r = await page.evaluate(async () => {
    const L = await import('./src/layout.js');
    const c = window.__clock || {};
    const P = c.P || {};
    const f = L.TRAIN.fourth;
    return {
      rates: L.SPEC_RATES, vph: L.SPEC.vph, row: `${f.pinion}/${f.teeth} @ ${f.module}`, fourthR: +(f.module * f.teeth / 2).toFixed(3),
      plateR: c.plateR == null ? null : +c.plateR.toFixed(3),
      escape: P.escape ? `(${P.escape.x.toFixed(3)}, ${P.escape.y.toFixed(3)})` : null,
      ribbonMm: c.oscillator ? +c.oscillator.spring.h_mm.toFixed(4) : null,
      inStock: c.oscillator ? c.oscillator.spring.inStock : null,
      bootWarns: (window.__bootWarns || []).slice(),
      verdict: (document.getElementById('spec-verdict') || {}).textContent || '',
    };
  });
  await page.close();
  return { ...r, consoleWarns: warns };
}

const identity = await boot(null);
const rows = { [identity.vph]: identity };
for (const vph of identity.rates) if (!rows[vph]) rows[vph] = await boot(vph);
await browser.close();
srv.kill();

console.log('vph    | row            | fourth r | plate R | escape arbor       | ribbon mm | warns');
for (const vph of Object.keys(rows).map(Number).sort((a, b) => a - b)) {
  const r = rows[vph];
  console.log(`${String(vph).padEnd(6)} | ${r.row.padEnd(14)} | ${String(r.fourthR).padEnd(8)} | ${String(r.plateR).padEnd(7)} | ${String(r.escape).padEnd(18)} | ${String(r.ribbonMm).padEnd(6)} ${r.inStock ? 'in ' : 'OUT'} | ${r.bootWarns.length}`);
  for (const w of r.bootWarns) console.log(`         ${w.slice(0, 160)}`);
  if (r.verdict) console.log(`         panel: ${r.verdict}`);
}

let fail = 0;
if (identity.bootWarns.length || identity.consoleWarns.length) { fail++; console.log(`FAIL identity: ${identity.bootWarns.length} boot warning(s), ${identity.consoleWarns.length} console warning(s)`); }
else console.log('OK   identity boots silent');
const setOf = (r) => new Set(r.bootWarns.map(mask));
const a = setOf(rows[28800]), b = setOf(rows[36000]);
const added = [...b].filter((k) => !a.has(k)), dropped = [...a].filter((k) => !b.has(k));
if (!rows[28800] || !rows[36000]) { fail++; console.log('FAIL the 28,800 or 36,000 row is not in SPEC_RATES'); }
else if (added.length || dropped.length) { fail++; console.log(`FAIL 36,000 vs 28,800 warning sets differ — added ${JSON.stringify(added)}, dropped ${JSON.stringify(dropped)}`); }
else console.log(`OK   36,000 trips the same ${b.size} structural assert(s) as 28,800, none added`);
process.exit(fail ? 1 : 0);
