// What boot says. Rule 6 wants silence; this is the fast way to ask, without
// standing up the whole battery just to read a warning.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
// Derived, not hardcoded: a probe must run from the worktree that OWNS it, the
// way ci-battery.mjs resolves its own ROOT. The absolute path this replaced was
// one machine's worktree, so this probe was unrunnable anywhere else —
// including from a fresh clone of the branch that ships it. Set ROOT= to take
// the same numbers against a base worktree.
const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const srv = spawn('python3', ['-m', 'http.server', '8462', '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch();
const page = await browser.newPage();
const lines = [];
page.on('pageerror', (e) => lines.push('PAGEERROR ' + String(e)));
page.on('console', (m) => {
  const t = m.text();
  if (/WebGL|ReadPixels|GPU stall/.test(t)) return;
  if (m.type() === 'warning' || m.type() === 'error') lines.push('[' + m.type() + '] ' + t);
});
await page.goto('http://127.0.0.1:8462/index.html', { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });
await new Promise((r) => setTimeout(r, 800));
console.log(lines.length ? lines.join('\n') : 'boot silent');
await browser.close(); srv.kill();
