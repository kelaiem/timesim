// THE PART LIBRARY A TECHNIC PROBE READS (BUILT §309). By default exactly
// vendor/ldraw/technic-parts.mpd, parsed — what every technic probe read before
// this existed, so a probe run without the variable below measures what it always did.
//
// THE SUBSTITUTION. With TECHNIC_SUBSTITUTE=P=C in the environment, the library is the
// pack with the GEOMETRY of LDraw part C filed under P's name: `P.dat` becomes C's file
// (its sub-files added from the candidates' pack, tools/data/technic-candidates.mpd,
// written by `tools/ldraw-vendor.mjs --candidates`). Every builder, solver and judge then
// reads C wherever the model places P — the same ids, the same tables, the same code —
// so "the build otherwise unchanged" holds by construction: a keyed body's free angle is
// re-solved by its own solver off C's measured tooth phase, a groove seat is re-measured
// off C's groove, a mass off C's solid. A substitution is judged ONE PER PROCESS: the
// builders cache per part id, and a cache filled from P would answer for C.
//
// A candidate whose own tree places P (a threaded axle built on the plain one) keeps
// that reference to the ORIGINAL P, filed under a private name, so the overlay never
// makes a part contain itself.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseLibrary, normName } from '../src/ldraw.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const MAIN_PACK = join(ROOT, 'vendor/ldraw/technic-parts.mpd');
export const CANDIDATE_PACK = join(ROOT, 'tools/data/technic-candidates.mpd');
export const ORIGINAL_PREFIX = '__original__/';

// the parsed main pack with C's geometry under P's name (a new Map; the inputs are not touched)
export function overlay(main, cand, P, C) {
  const lib = new Map(main);
  for (const [n, f] of cand) if (!lib.has(n)) lib.set(n, f);
  const p = normName(`${P}.dat`), c = normName(`${C}.dat`);
  const cf = lib.get(c);
  if (!cf) throw new Error(`technic-pack: candidate ${C} is in neither pack`);
  if (!main.has(p)) throw new Error(`technic-pack: ${P} is not a placed part of the main pack`);
  // a reference to P anywhere in C's tree means the original P
  const orig = ORIGINAL_PREFIX + p, rename = new Map();
  lib.set(orig, main.get(p));
  const fix = (name, seen = new Set()) => {
    if (rename.has(name) || seen.has(name)) return rename.get(name) ?? name;
    seen.add(name);
    const f = lib.get(name);
    if (!f) return name;
    let changed = false;
    const lines = f.lines.map((l) => {
      if (l.type !== 1) return l;
      const to = l.file === p ? orig : fix(l.file, seen);
      if (to !== l.file) { changed = true; return { ...l, file: to }; }
      return l;
    });
    if (!changed) return name;
    const alias = `__subst__/${name}`;
    lib.set(alias, { ...f, name: alias, lines });
    rename.set(name, alias);
    return alias;
  };
  const top = fix(c);
  lib.set(p, { ...lib.get(top), name: p, substitutedFrom: C });
  return lib;
}

export function substitution(env = process.env) {
  const s = env.TECHNIC_SUBSTITUTE;
  if (!s) return null;
  const m = /^([0-9a-z]+)=([0-9a-z]+)$/i.exec(s.trim());
  if (!m) throw new Error(`technic-pack: TECHNIC_SUBSTITUTE must be P=C, not ${s}`);
  return { P: m[1].toLowerCase(), C: m[2].toLowerCase() };
}

// The library a probe measures: the main pack, or the main pack with one substitution.
export function loadPack({ text = false } = {}) {
  const raw = readFileSync(MAIN_PACK, 'utf8');
  const main = parseLibrary(raw), sub = substitution();
  if (!sub) return text ? { lib: main, text: raw } : main;
  const lib = overlay(main, parseLibrary(readFileSync(CANDIDATE_PACK, 'utf8')), sub.P, sub.C);
  console.log(`SUBSTITUTION (BUILT §309): ${sub.P}.dat carries the geometry of ${sub.C}.dat\n`);
  return text ? { lib, text: raw } : lib;
}
