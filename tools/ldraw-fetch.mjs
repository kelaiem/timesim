// FETCH LDraw PARTS AND EVERYTHING THEY REFERENCE, from the official library.
// A helper, not a measurement: it writes nothing but a cache directory.
//
//   node tools/ldraw-fetch.mjs --out DIR 3024 6541 ...
//
// Each line-type-1 reference is resolved the way LDraw resolves it — parts/,
// then p/ (primitives, with p/48 and p/8 the hi/lo-res subfolders), a `s\`
// prefix being parts/s/ — and fetched once. Every file carries its own `0 !LICENSE`
// line (CC BY 4.0 for the official library, see CAreadme.txt); anything packed from this cache carries
// that attribution.
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
// curl, not fetch(): Node's fetch ignores HTTPS_PROXY, and curl honours it
const sh = promisify(execFile);
// At most SLOTS requests in flight: hundreds at once had the server drop some,
// which read as parts missing from the library, and the server answers a burst
// with 429. A 404 is final; anything else is retried with backoff (a 429's
// own Retry-After when it sends one) before the run gives up.
// And PACED: the library allows 60 requests a minute (its x-ratelimit-limit),
// so request STARTS are spaced 1.05 s apart, under the limit by construction.
// Backing off after a 429 alone exhausted every retry on a full pack.
const SLOTS = 4, SPACING_MS = 1050;
let active = 0, nextStart = 0; const waiting = [];
const slot = async () => {
  if (active < SLOTS) active++; else await new Promise((r) => waiting.push(r));
  const now = Date.now(), at = Math.max(now, nextStart); nextStart = at + SPACING_MS;
  if (at > now) await new Promise((r) => setTimeout(r, at - now));
};
const release = () => { const n = waiting.shift(); if (n) n(); else active--; };
async function download(url) {
  for (let attempt = 0; attempt < 8; attempt++) {
    let wait = 1000 * 2 ** Math.min(attempt, 5);
    await slot();
    try {
      // No header DUMP at all: behind a proxy, curl prints the proxy's CONNECT
      // response before the server's headers, and a first version that split
      // one `-D -` stream at its first blank line packed the server's headers —
      // cookies included — into every file it fetched. The write-out reads the
      // one header wanted (curl ≥ 7.84) after a marker no part file contains.
      const { stdout } = await sh('curl', ['-sS', '--max-time', '60', '-w', '\n\u0001%{http_code} %header{retry-after}', url], { maxBuffer: 64 << 20 });
      const cut = stdout.lastIndexOf('\n\u0001'), body = stdout.slice(0, cut);
      const [code, retry] = stdout.slice(cut + 2).split(' ');
      if (code === '200') return body;
      if (code === '404') return null;
      const ra = /^\d+$/.exec(retry ?? '');
      if (ra) wait = Math.max(wait, 1000 * Number(ra[0]));
    } catch { /* network: retry */ } finally { release(); }
    await new Promise((r) => setTimeout(r, wait));
  }
  throw new Error(`could not reach ${url}`);
}

// Official first; then the UNOFFICIAL tracker, which holds parts still in
// review (the 2026 gears, at the time of writing). Every file written from the
// unofficial tree is listed in the run's last line, because "unofficial" is a
// claim about how far a part's geometry has been checked.
const LIBS = ['https://library.ldraw.org/library/official/', 'https://library.ldraw.org/library/unofficial/'];

export const norm = (f) => f.trim().replace(/\\/g, '/').toLowerCase();
const candidates = (f) => (f.startsWith('s/') ? [`parts/${f}`] : f.startsWith('48/') || f.startsWith('8/') ? [`p/${f}`] : [`parts/${f}`, `p/${f}`]);
async function exists(p) { try { await access(p); return true; } catch { return false; } }

// Fetch `roots` (part numbers or file names) and everything they reference
// into `out`. Returns { files: Map(name -> path under out), unofficial, missing }.
export async function fetchParts(out, roots) {
  const seen = new Map(); // name -> relative path
  const unofficial = [];
  async function get(name) {
    if (seen.has(name)) return;
    seen.set(name, null);
    // every official location before any unofficial one: a primitive is
    // official under p/, and asking the unofficial tree first doubled the
    // requests for nothing
    const tries = LIBS.flatMap((base, i) => candidates(name).map((rel) => ({ base, rel, i })));
    for (const { base, rel, i } of tries) {
      const local = join(out, rel);
      let text;
      if (await exists(local)) text = await readFile(local, 'utf8');
      else {
        text = await download(base + rel);
        if (text == null) continue;
        if (i) unofficial.push(rel);
        await mkdir(dirname(local), { recursive: true });
        await writeFile(local, text);
      }
      seen.set(name, rel);
      const refs = [];
      for (const line of text.split(/\r?\n/)) {
        const t = line.trim().split(/\s+/);
        if (t[0] === '1' && t.length >= 15) refs.push(norm(t.slice(14).join(' ')));
      }
      await Promise.all(refs.map(get));
      return;
    }
  }
  await Promise.all(roots.map((r) => get(norm(r.endsWith('.dat') ? r : r + '.dat'))));
  return { files: seen, unofficial, missing: [...seen].filter(([, v]) => !v).map(([k]) => k) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const oi = args.indexOf('--out');
  if (oi < 0) { console.error('usage: --out DIR part...'); process.exit(2); }
  const out = args[oi + 1];
  const { files, unofficial, missing } = await fetchParts(out, args.filter((_, i) => i !== oi && i !== oi + 1));
  console.log(`${files.size} files under ${out}`);
  if (unofficial.length) console.log(`UNOFFICIAL (in review): ${unofficial.join(' ')}`);
  if (missing.length) { console.log(`MISSING: ${missing.join(' ')}`); process.exit(1); }
}
