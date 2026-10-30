// VENDOR THE LDraw PARTS THE TECHNIC FORK USES, as one packed file.
//
//   node tools/ldraw-vendor.mjs            # writes vendor/ldraw/technic-parts.mpd
//   node tools/ldraw-vendor.mjs --check    # fails if the pack would change
//
// THE PART LIST IS READ, NEVER TYPED: every `part` in `CATALOGUES` (both
// generations) and every part in `technic-frame.js`' FRAME_PARTS,
// AXLE_PARTS, TURNTABLE_BASES and KEYLESS_PARTS, and `technic-fusee.js`'
// FUSEE_PULLEYS (landing H's five and §285's surveyed grooves), FUSEE_STRINGS
// and FUSEE_PARTS (landing H), and
// `technic-alarm.js`' ALARM_PARTS (landing I), and `technic-escapement.js`'
// ESCAPEMENT_PARTS (landing J), and `technic-train.js`' TRAIN_PARTS (§315: the
// 48 × 48 baseplate the classic going train needs, and the 1 × 2 Technic brick
// that bears its drive arbor in the front knife's stack), and technic-escapement.js' RATING_PARTS (§316: the
// angle connector, rod and bush of the train balance's rating nut). Add a gear to the
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
//
// BUILT §309 — THE CANDIDATES' PACK. `--candidates` writes a SECOND file,
// tools/data/technic-candidates.mpd: the LDraw geometry of every SUBSTITUTE
// candidate src/technic-rebrickable.js names (a Rebrickable alternate or mould
// variant of a placed part, mapped back to LDraw), read from that generated file and
// never typed, less the files the main pack already holds. It is the validation
// tools' library only (tools/technic-substitutes.mjs swaps a candidate in through
// tools/technic-pack.mjs): the page never loads it, so it lives under tools/ and is
// not in the deployed payload, and the main pack — what the page draws — does not
// move. Passing AND failing candidates are both kept, so the acceptance probe can
// re-judge every verdict offline. A candidate the library does not hold (or whose
// sub-files it does not) is listed in the file's `0 Missing:` line, never an error:
// that candidate is reported "not judged: no LDraw geometry".
//   node tools/ldraw-vendor.mjs --candidates [--check]
import { readFile, writeFile, mkdtemp, rm, mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { CATALOGUES } from '../src/layout.js';
import { FRAME_PARTS, AXLE_PARTS, TURNTABLE_BASES, KEYLESS_PARTS } from '../src/technic-frame.js';
import { FUSEE_PULLEYS, FUSEE_STRINGS, FUSEE_PARTS } from '../src/technic-fusee.js';
import { ALARM_PARTS } from '../src/technic-alarm.js';
import { ESCAPEMENT_PARTS, RATING_PARTS } from '../src/technic-escapement.js';
import { TRAIN_PARTS } from '../src/technic-train.js';
import { DEADBEAT_PALLETS, DEADBEAT_PARTS } from '../src/technic-deadbeat.js';
import { fetchParts } from './ldraw-fetch.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'vendor/ldraw/technic-parts.mpd');
const check = process.argv.includes('--check');

export const PACK_PARTS = [...new Set([
  ...Object.values(CATALOGUES).filter(Boolean).flatMap((c) => c.counts.map((r) => r.part)),
  ...Object.values(FRAME_PARTS), ...Object.values(AXLE_PARTS), ...Object.values(TURNTABLE_BASES),
  ...Object.values(KEYLESS_PARTS),
  ...FUSEE_PULLEYS, ...Object.values(FUSEE_STRINGS), ...Object.values(FUSEE_PARTS),
  ...Object.values(ALARM_PARTS), ...Object.values(ESCAPEMENT_PARTS), ...Object.values(RATING_PARTS), ...Object.values(TRAIN_PARTS),
  ...Object.keys(DEADBEAT_PALLETS), ...Object.values(DEADBEAT_PARTS),   // §323: the dead-beat's pallet candidates, mount and survey controls
])].sort();

const CAND_OUT = join(ROOT, 'tools/data/technic-candidates.mpd');
export async function candidateRoots() {
  const { REBRICKABLE } = await import('../src/technic-rebrickable.js');
  return [...new Set(Object.values(REBRICKABLE.lines).flatMap((l) => l.candidates.map((c) => c.ldraw)))].filter((id) => !PACK_PARTS.includes(id)).sort();
}
if (process.argv.includes('--candidates')) {
  const roots = await candidateRoots();
  const { parseLibrary } = await import('../src/ldraw.js');
  const main = parseLibrary(await readFile(OUT, 'utf8'));
  const cache = await mkdtemp(join(tmpdir(), 'ldraw-cand-'));
  try {
    // one root at a time, so a root whose tree has a hole is known by name
    const files = new Map(), missing = [], unofficial = [];
    for (const r of roots) {
      const got = await fetchParts(cache, [r]);
      if (got.missing.length) { missing.push(r); continue; }
      for (const [n, rel] of got.files) files.set(n, rel);
      unofficial.push(...got.unofficial);
    }
    const names = [...files.keys()].filter((n) => !main.has(n)).sort();
    let mpd = `0 LEGO Technic fork SUBSTITUTE CANDIDATES — packed from the LDraw library by tools/ldraw-vendor.mjs --candidates (BUILT §309)\n`
      + `0 Roots: ${roots.filter((r) => !missing.includes(r)).join(' ')}\n0 Missing: ${missing.join(' ') || '-'}\n`
      + `0 Licence: CC BY 4.0 (per file below); see vendor/ldraw/LICENSE-ldraw.txt\n`;
    for (const n of names) {
      const text = (await readFile(join(cache, files.get(n)), 'utf8')).replace(/\r\n/g, '\n').replace(/\s+$/, '');
      if (!/^0 /.test(text) || /^(HTTP\/|set-cookie:|content-type:)/im.test(text)) { console.log(`✗ ${n} is not an LDraw file`); process.exit(1); }
      mpd += `\n0 FILE ${n}\n${text}\n0 NOFILE\n`;
    }
    // a file both packs would hold must be the same text, or the overlay would mix two library days
    const differ = [...files.keys()].filter((n) => main.has(n)).filter((n) => {
      const a = parseLibrary(`0 FILE ${n}\n${readFileSync(join(cache, files.get(n)), 'utf8')}`).get(n);
      return JSON.stringify(a.lines) !== JSON.stringify(main.get(n).lines);
    });
    if (differ.length) console.log(`NOTE: ${differ.length} shared file(s) differ from the main pack's copy (the overlay keeps the main pack's): ${differ.join(' ')}`);
    if (check) {
      const have = await readFile(CAND_OUT, 'utf8').catch(() => '');
      if (have !== mpd) { console.log(`✗ ${CAND_OUT} is stale; run without --check`); process.exit(1); }
      console.log(`candidates pack current: ${names.length} files`);
    } else {
      await mkdir(dirname(CAND_OUT), { recursive: true });
      await writeFile(CAND_OUT, mpd);
      console.log(`wrote ${CAND_OUT}: ${roots.length - missing.length} of ${roots.length} candidates, ${names.length} files, ${(mpd.length / 1024).toFixed(0)} KiB; missing: ${missing.join(' ') || 'none'}`);
    }
    if (unofficial.length) console.log(`UNOFFICIAL (in review, said so in the file): ${[...new Set(unofficial)].join(' ')}`);
  } finally { await rm(cache, { recursive: true, force: true }); }
  process.exit(0);
}

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
