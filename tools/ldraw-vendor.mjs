// VENDOR THE LDraw PARTS THE TECHNIC FORK USES, as one packed file.
//
//   node tools/ldraw-vendor.mjs            # writes vendor/ldraw/technic-parts.mpd
//   node tools/ldraw-vendor.mjs --check    # fails if the pack would change
//
// THE PART LIST IS READ, NEVER TYPED: every `part` in `CATALOGUES` (both
// generations) and every part in `technic-frame.js`' FRAME_PARTS,
// AXLE_PARTS, TURNTABLE_BASES and KEYLESS_PARTS, and `technic-fusee.js`'
// FUSEE_PULLEYS, FUSEE_STRINGS and FUSEE_PARTS (landing H). Add a gear to the
// catalogue and the next run fetches it; a part
// the library does not hold FAILS the run rather than shipping a build with a
// hole in it.
//
// The pack is one `.mpd`: a `0 FILE <name>` section per file, the names
// normalised the way `src/ldraw.js` resolves them, sorted so the bytes are a
// function of the list. It is VENDORED (committed) because technic.html and
// the probes must read the same parts offline, in CI and on the deployed site;
// fetching at run time would make every verdict depend on the library's day.
// Every section keeps its own `0 !LICENSE` and `0 !LDRAW_ORG` lines, so an
// UNOFFICIAL part (the 2026 gears are still in review) says so wherever it is
// read. The library is CC BY 4.0; vendor/ldraw/LICENSE-ldraw.txt carries the
// attribution.
//
// `--check` re-fetches into a scratch directory and compares, so it needs the
// network; it is a maintenance tool, not a gate.
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { CATALOGUES } from '../src/layout.js';
import { FRAME_PARTS, AXLE_PARTS, TURNTABLE_BASES, KEYLESS_PARTS } from '../src/technic-frame.js';
import { FUSEE_PULLEYS, FUSEE_STRINGS, FUSEE_PARTS } from '../src/technic-fusee.js';
import { fetchParts } from './ldraw-fetch.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'vendor/ldraw/technic-parts.mpd');
const check = process.argv.includes('--check');

export const PACK_PARTS = [...new Set([
  ...Object.values(CATALOGUES).filter(Boolean).flatMap((c) => c.counts.map((r) => r.part)),
  ...Object.values(FRAME_PARTS), ...Object.values(AXLE_PARTS), ...Object.values(TURNTABLE_BASES),
  ...Object.values(KEYLESS_PARTS),
  ...FUSEE_PULLEYS, ...Object.values(FUSEE_STRINGS), ...Object.values(FUSEE_PARTS),
])].sort();

const cache = await mkdtemp(join(tmpdir(), 'ldraw-'));
try {
  const { files, missing } = await fetchParts(cache, PACK_PARTS);
  if (missing.length) { console.log(`✗ not in the library: ${missing.join(' ')}`); process.exit(1); }
  const names = [...files.keys()].sort();
  // every file must BE an LDraw file: its first line a `0` meta line and no
  // line an HTTP header. A transport that leaks headers into a body is caught
  // here, not by whoever reads the pack next.
  for (const n of names) {
    const t = await readFile(join(cache, files.get(n)), 'utf8');
    if (!/^0 /.test(t) || /^(HTTP\/|set-cookie:|content-type:)/im.test(t)) { console.log(`✗ ${n} is not an LDraw file (an HTTP header leaked into it?)`); process.exit(1); }
  }
  let mpd = `0 LEGO Technic fork parts — packed from the LDraw library by tools/ldraw-vendor.mjs\n`
    + `0 Roots: ${PACK_PARTS.join(' ')}\n0 Licence: CC BY 4.0 (per file below); see vendor/ldraw/LICENSE-ldraw.txt\n`;
  for (const n of names) {
    const text = (await readFile(join(cache, files.get(n)), 'utf8')).replace(/\r\n/g, '\n').replace(/\s+$/, '');
    mpd += `\n0 FILE ${n}\n${text}\n0 NOFILE\n`;
  }
  const unofficial = names.filter((n) => /!LDRAW_ORG Unofficial/.test(mpd.split(`0 FILE ${n}\n`)[1].split('0 NOFILE')[0]));
  if (check) {
    const have = await readFile(OUT, 'utf8').catch(() => '');
    if (have !== mpd) { console.log(`✗ ${OUT} is stale — the library or the part list moved; run without --check`); process.exit(1); }
    console.log(`pack current: ${names.length} files`);
  } else {
    await writeFile(OUT, mpd);
    console.log(`wrote ${OUT}: ${PACK_PARTS.length} parts, ${names.length} files, ${(mpd.length / 1024).toFixed(0)} KiB`);
  }
  if (unofficial.length) console.log(`UNOFFICIAL (in review, said so in the file): ${unofficial.join(' ')}`);
} finally { await rm(cache, { recursive: true, force: true }); }
