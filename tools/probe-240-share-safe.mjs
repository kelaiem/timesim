// §240 Landing 3 — DOES `aestheticsShareSafe` FIRE? Acceptance, of the gate.
// The battery's gate holds SHARE_SUBTREES to "no leaf under it moves a
// vertex" by booting once with every shareable leaf moved and comparing the
// geometry fingerprint with a virgin boot's. It passes on the shipped list —
// which a fingerprint blind to the leaves in question would also do. So this
// MUTATES the list in flight (a route rewrites src/aesthetics.js to add
// `dial.hands`, the hand-cutting subtree the list exists to keep out), boots a
// link that moves the hands, and requires the fingerprint to MOVE. Rows:
//   A  CONTROL, must-hold — the mutated module still loads, and the link's
//      hand pairs are APPLIED (not refused): the mutation took, and the merge
//      let the values through, so a still fingerprint below could only mean
//      the fingerprint cannot see hands.
//   1  the fingerprint under the hand-moving link DIFFERS from the virgin
//      boot's — the gate's comparison would fail, i.e. the gate fires.
//   2  on the SHIPPED list the same hand pairs are refused `notshareable` and
//      the fingerprint equals the virgin boot's — the line in production.
// A guard nobody has seen fire is a comment (CLAUDE.md, the direction guards).
//
// Run: cd tools && node probe-240-share-safe.mjs   (ROOT= for another worktree)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8470);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
process.on('exit', () => srv.kill());
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const BASE = `http://127.0.0.1:${PORT}/index.html`;

const SHIPPED = "export const SHARE_SUBTREES = Object.freeze(['dial.face', 'lighting', 'rendering', 'camera', 'decoration', 'materials']);";
const src = readFileSync(join(ROOT, 'src/aesthetics.js'), 'utf8');
if (!src.includes(SHIPPED)) throw new Error('SHARE_SUBTREES no longer reads as this probe expects — re-read the declaration before trusting a mutation of it');
const MUTATED = src.replace(SHIPPED, SHIPPED.replace("'materials'])", "'materials', 'dial.hands'])"));
// Hand widths moved 1.5×: well inside anything a hand can be cut to, and a
// width is what the hand's bounding box reads.
const HANDS = 'dial.hands.hour.widthFactor~0.225,dial.hands.minute.widthFactor~0.135';

const fails = [];
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(66)} ${JSON.stringify(got)}${ok ? '' : `  (wanted ${JSON.stringify(want)})`}`);
  if (!ok) fails.push(name);
};
async function boot(qs, { mutate = false } = {}) {
  const ctx = await browser.newContext();
  if (mutate) await ctx.route('**/src/aesthetics.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: MUTATED }));
  const page = await ctx.newPage();
  await page.goto(BASE + qs, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => !!window.__clock, null, { timeout: 120000 });
  const out = await page.evaluate(async () => {
    const I = await import('./src/inspect.js');
    const A = await import('./src/aesthetics.js');
    const o = A.LINK_OUTCOME;
    return { hash: I.fingerprint(window.__clock).hash, subtrees: A.SHARE_SUBTREES, applied: o ? o.applied : [], refused: o ? o.refused.map((r) => `${r.path}:${r.why}`) : [] };
  });
  await ctx.close();
  return out;
}

console.log('§240 — does aestheticsShareSafe fire on a geometry subtree?\n');
const virgin = await boot('');
console.log(`        virgin fingerprint ${virgin.hash}`);
const mutated = await boot(`?aes=${HANDS}`, { mutate: true });
check('A. CONTROL: the mutated list carries dial.hands', mutated.subtrees.includes('dial.hands'), true);
check('A. CONTROL: the hand pairs were APPLIED under the mutation', mutated.applied, ['dial.hands.hour.widthFactor', 'dial.hands.minute.widthFactor']);
check('1. the fingerprint MOVES — the gate would fire', mutated.hash !== virgin.hash, true);
const shipped = await boot(`?aes=${HANDS}`);
check('2. shipped list: the hand pairs are refused notshareable', shipped.refused, ['dial.hands.hour.widthFactor:notshareable', 'dial.hands.minute.widthFactor:notshareable']);
check('2. shipped list: the fingerprint equals the virgin boot\'s', shipped.hash, virgin.hash);

await browser.close();
srv.kill();
console.log(`\n${fails.length ? `FAIL — ${fails.length} row(s): ${fails.join('; ')}` : 'PASS — the fingerprint sees a geometry leaf on a link, and the shipped list keeps them off'}`);
process.exit(fails.length ? 1 : 0);
