// §203 step 3 probe — ACCEPTANCE: exits non-zero on any failed row. The case
// alloy pick, exercised on every road a value can take to the case:
//   · the LINK (`?metal=<key>`, §185's rule) — one virgin boot per alloy; the
//     case's material must read the derived hex in ALLOY_COLORS, the WORKS'
//     steel must be untouched (an alloy never reaches a pinion), and the
//     override store must stay EMPTY (a link is never written back);
//   · the OVERRIDE STORE — one boot with `materials.caseMetal.alloy` seeded
//     the way a viewer's pick persists; same read-back;
//   · a BOGUS link key, and a bogus PERSISTED key — both must be refused: the
//     case reads steel, boot stays silent, and the persisted case reports the
//     refusal through the loader's own `option` reason (mergeAesthetics is
//     called on the page with the same payload to read the report);
//   · the LINK WINS over the store when both are set, and still writes nothing;
//   · the PANEL renders a <select> for the leaf, its options' values the
//     canonical keys, its texts the English labels (the locale under test);
//   · Copy view's link carries `metal=` exactly when the alloy is non-default —
//     read through the same builder the button uses.
// One Dial-view screenshot per alloy at $OUT-<alloy>.png (default /tmp/shot203a)
// for the eye; the numbers above are the gate. Read-back in the render's own
// task, nothing awaited between render and toDataURL (the CLAUDE.md trap).
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const port = '8532';
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const OUT = process.env.OUT || '/tmp/shot203a';
const rows = []; let failures = 0;
const check = (name, ok, detail) => { rows.push({ case: name, ok: ok ? 'PASS' : 'FAIL', detail }); if (!ok) failures++; };

async function boot({ link = '', seed = null, shot = null }) {
  const ctx = await b.newContext({ viewport: { width: 700, height: 700 } });
  if (seed) await ctx.addInitScript((v) => localStorage.setItem('aestheticsOverrides', JSON.stringify(v)), seed);
  const p = await ctx.newPage();
  const warns = [];
  p.on('console', (m) => { if (m.type() === 'warning' && /§/.test(m.text())) warns.push(m.text().slice(0, 120)); });
  await p.goto(`http://127.0.0.1:${port}/index.html?schematic=0${link}`, { waitUntil: 'load', timeout: 90000 });
  await p.waitForFunction(() => !!window.__clock, null, { timeout: 60000 });
  const read = await p.evaluate(async ([shot]) => {
    const Mm = await import('./src/materials.js');
    const A = await import('./src/aesthetics.js');
    const c = window.__clock;
    const out = {
      alloy: A.aesthetics.materials.caseMetal.alloy,
      caseHex: '#' + Mm.MATS.caseMetal.color.getHexString(),
      steelHex: '#' + Mm.MATS.steel.color.getHexString(),
      expectHex: Mm.ALLOY_COLORS[A.aesthetics.materials.caseMetal.alloy],
      store: localStorage.getItem('aestheticsOverrides'),
      bootWarns: (c.bootWarns || []).length,
      selectValues: [...document.querySelectorAll('#advanced-body select option')].map((o) => o.value),
      selectTexts: [...document.querySelectorAll('#advanced-body select option')].map((o) => o.textContent),
      selectValue: document.querySelector('#advanced-body select')?.value ?? null,
      // the loader's own report for a bogus key, on the live schema's copy
      refusal: A.mergeAesthetics(JSON.parse(JSON.stringify(A.AESTHETICS_DEFAULTS)), { materials: { caseMetal: { alloy: 'unobtainium' } } }).refused,
      copyLink: null,
    };
    // Copy view's link: the button composes it and hands it to
    // navigator.clipboard.writeText, which headless cannot read back — so the
    // instance method is shadowed with a capture and the button clicked.
    let captured = null;
    navigator.clipboard.writeText = async (s) => { captured = s; };
    document.getElementById('btn-copy-view')?.click();
    await new Promise((r) => setTimeout(r, 50));
    out.copyLink = captured;
    if (shot) {
      c.resetInputs();
      c.setPose({ tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 0.6, windAccumTurns: 0 });
      document.querySelector('[data-cam="Dial"]').click();
      c.step(1);
      c.render();
      out.dataUrl = document.querySelector('canvas').toDataURL('image/png');
    }
    return out;
  }, [shot]);
  read.warns = warns;
  if (shot && read.dataUrl) writeFileSync(`${OUT}-${shot}.png`, Buffer.from(read.dataUrl.split(',')[1], 'base64'));
  delete read.dataUrl;
  await ctx.close();
  return read;
}

const ALLOYS = ['steel', 'yellowGold18k', 'whiteGold18k', 'platinum'];
for (const a of ALLOYS) {
  const r = await boot({ link: a === 'steel' ? '' : `&metal=${a}`, shot: a });
  check(`link ${a}: case reads its derived hex`, r.alloy === a && r.caseHex === r.expectHex, `${r.alloy} ${r.caseHex} (expect ${r.expectHex})`);
  check(`link ${a}: the works' steel is untouched`, r.steelHex === '#d6d9dd', r.steelHex);
  check(`link ${a}: the store is not written`, r.store === null, String(r.store));
  check(`link ${a}: boot silent`, r.bootWarns === 0 && r.warns.length === 0, `${r.bootWarns} boot warns, ${r.warns.length} § warnings`);
  check(`link ${a}: Copy view carries metal= iff non-default`, r.copyLink !== null && ((a === 'steel') === !/[?&]metal=/.test(r.copyLink)) && (a === 'steel' || r.copyLink.includes(`metal=${a}`)), r.copyLink ? r.copyLink.slice(-60) : 'no link captured');
  if (a === 'steel') {
    check('panel renders a select with the four canonical values', JSON.stringify(r.selectValues) === JSON.stringify(ALLOYS), JSON.stringify(r.selectValues));
    check('panel option texts are the labels', JSON.stringify(r.selectTexts) === JSON.stringify(['Steel', '18K yellow gold', '18K white gold', 'Platinum']), JSON.stringify(r.selectTexts));
    check('loader refuses a bogus key as `option`', JSON.stringify(r.refusal) === JSON.stringify([{ path: 'materials.caseMetal.alloy', why: 'option' }]), JSON.stringify(r.refusal));
  }
  check(`link ${a}: the select shows it`, r.selectValue === a, String(r.selectValue));
}
{
  const r = await boot({ seed: { materials: { caseMetal: { alloy: 'platinum' } } } });
  check('store platinum: case reads platinum', r.alloy === 'platinum' && r.caseHex === r.expectHex, `${r.alloy} ${r.caseHex}`);
  check('store platinum: Copy view carries metal=platinum', !!r.copyLink && r.copyLink.includes('metal=platinum'), r.copyLink ? r.copyLink.slice(-50) : 'none');
}
{
  const r = await boot({ seed: { materials: { caseMetal: { alloy: 'platinum' } } }, link: '&metal=yellowGold18k' });
  check('link wins over the store', r.alloy === 'yellowGold18k' && r.caseHex === r.expectHex, `${r.alloy} ${r.caseHex}`);
  check('…and the store still says platinum', /platinum/.test(r.store || ''), String(r.store).slice(0, 80));
}
{
  const r = await boot({ link: '&metal=unobtainium' });
  check('bogus link key: case stays steel, boot silent', r.alloy === 'steel' && r.caseHex === '#d6d9dd' && r.bootWarns === 0, `${r.alloy} ${r.caseHex} ${r.bootWarns}`);
}
{
  const r = await boot({ seed: { materials: { caseMetal: { alloy: 'unobtainium' } } } });
  check('bogus persisted key: refused, case stays steel', r.alloy === 'steel' && r.caseHex === '#d6d9dd', `${r.alloy} ${r.caseHex}`);
}
console.table(rows);
await b.close(); srv.kill();
console.log(failures ? `${failures} row(s) FAILED` : 'all rows PASS');
process.exit(failures ? 1 : 0);
