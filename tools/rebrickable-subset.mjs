#!/usr/bin/env node
// Writes src/technic-rebrickable.js (BUILT §309): the SUBSET of Rebrickable's full
// download (rebrickable.com/downloads, CSV) and BrickLink's catalogue download that
// the parts list's SUBSTITUTES need, so every candidate id, relationship, mapping
// and count is READ from those files and never typed (§300's rule, §301's pattern).
// The whole downloads are ~160 MB and are not committed.
//
//   node tools/rebrickable-subset.mjs --write --rb DIR --parts P --codes K --date YYYY-MM-DD
//   node tools/rebrickable-subset.mjs --check [--rb DIR --parts P --codes K]
//
// WHAT A CANDIDATE IS. For each LDraw id the builds place (PART_IDS):
//   1. its Rebrickable part: Rebrickable's own LDraw mapping (part_mappings.csv rows
//      whose ext_system is `LD`, matched on ext_id), else the same number if
//      parts.csv has it, else the number without a mould-variant letter (§301's rule,
//      and `via` says which);
//   2. its RELATIVES in part_relationships.csv of the two types that can stand for it:
//      A (alternate) and M (mould variant), in BOTH directions (`dir` records which:
//      the placed part is the row's child or its parent), and the other children of an
//      M parent (`sibling`). P, T, B and R rows (print, pattern, sub-part, pair) are
//      not candidates: a print or a sub-part is a different thing to buy. The direction
//      is recorded, never relied on: Rebrickable's page that defines the types answered
//      403 to the sandbox that wrote this, so "A" is read only as "Rebrickable lists it
//      as an alternate", which is a claim the geometry judges, not one taken;
//   3. each relative mapped BACK: to LDraw (its `LD` row, else its own number), and to
//      BrickLink (its `BL` row, else its own number), the BrickLink number then looked
//      up in BrickLink's Parts download (as an item number or an alternate item number,
//      the subset generator's rule) and its element codes read from Codes in each colour
//      the role table may use (colour names from src/technic-bricklink.js).
// ABUNDANCE. For the placed part and each candidate, per role-table colour: the number of
// distinct official SETS (sets.csv; minifigure inventories excluded) whose inventory lists
// that Rebrickable part in that colour, not as a spare. It is a proxy for how common the
// element is — how many official sets used it — and it is NOT marketplace stock: nothing in
// these files says what anyone has for sale.
import { readFileSync, writeFileSync, createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PART_IDS } from '../src/technic-bom-ids.js';
import { BRICKLINK } from '../src/technic-bricklink.js';

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i < 0 ? null : args[i + 1]; };
const OUT = new URL('../src/technic-rebrickable.js', import.meta.url).pathname;
export const REL_TYPES = Object.freeze({ A: 'alternate', M: 'mould variant' });

// RFC 4180, one record per line (none of these files breaks a field over lines)
function csvLine(line) {
  const out = []; let f = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"') { if (line[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true; else if (c === ',') { out.push(f); f = ''; } else f += c;
  }
  out.push(f); return out;
}
const readCsv = (path) => { const [h, ...rows] = readFileSync(path, 'utf8').split(/\r?\n/).filter(Boolean).map(csvLine); return rows.map((r) => Object.fromEntries(h.map((k, i) => [k, r[i]]))); };
const tsv = (path) => readFileSync(path, 'utf8').split(/\r?\n/).map((l) => l.split('\t'));
const lc = (s) => String(s).toLowerCase();
const truthy = (s) => s === 'True';

export async function derive({ rb, parts, codes, date }) {
  const P = readCsv(join(rb, 'parts.csv')), names = new Map(P.map((r) => [r.part_num, r.name]));
  const maps = readCsv(join(rb, 'part_mappings.csv'));
  const byExt = (sys) => { const m = new Map(); for (const r of maps) if (r.ext_system === sys) { const k = lc(r.ext_id); if (!m.has(k)) m.set(k, []); m.get(k).push(r); } return m; };
  const byPart = (sys) => { const m = new Map(); for (const r of maps) if (r.ext_system === sys) { if (!m.has(r.part_num)) m.set(r.part_num, []); m.get(r.part_num).push(r); } return m; };
  const ldExt = byExt('LD'), ldOf = byPart('LD'), blOf = byPart('BL');
  // an export row first (Rebrickable's own preferred id in that system), then the rest, each in file order
  const pick = (rows) => (rows ?? []).slice().sort((a, b) => truthy(b.is_export_id) - truthy(a.is_export_id));
  const rels = readCsv(join(rb, 'part_relationships.csv')).filter((r) => r.rel_type in REL_TYPES);

  // BrickLink: the item a number is, or is an alternate of (the subset generator's rule)
  const BP = tsv(parts).slice(1).filter((r) => r.length >= 4 && r[2]);
  const number = new Map(), alt = new Map();
  for (const r of BP) { number.set(lc(r[2]), r); for (const a of (r[4] ?? '').split(',').map((s) => s.trim()).filter(Boolean)) if (!alt.has(lc(a))) alt.set(lc(a), r); }
  const blItem = (n) => { const r = number.get(lc(n)), a = !r && alt.get(lc(n)); const h = r || a; return h ? { number: h[2], name: h[3], category: h[1], via: r ? 'number' : 'alternate' } : null; };

  // colours: each role-table code -> Rebrickable's colour id (its LD row), and BrickLink's name (the committed subset)
  const cmap = readCsv(join(rb, 'color_mappings.csv')).filter((r) => r.ext_system === 'LD');
  const rbColours = readCsv(join(rb, 'colors.csv'));
  const colours = {};
  for (const code of Object.keys(BRICKLINK.colours)) {
    const rows = pick(cmap.filter((r) => r.ext_id === code));
    if (!rows.length) throw new Error(`rebrickable-subset: Rebrickable maps no colour to LDraw ${code}`);
    colours[code] = { rb: Number(rows[0].id), name: rbColours.find((c) => c.id === rows[0].id)?.name ?? null, bricklink: BRICKLINK.colours[code].name };
  }
  const codeOfRb = new Map(Object.entries(colours).map(([code, c]) => [String(c.rb), code]));

  const lines = {}, want = new Set();
  for (const id of PART_IDS) {
    let rbIds = pick(ldExt.get(lc(id))).map((r) => r.part_num), via = 'LD mapping';
    if (!rbIds.length && names.has(id)) { rbIds = [id]; via = 'same number'; }
    const base = /^\d+[a-z]$/i.test(id) ? id.slice(0, -1) : null;
    if (!rbIds.length && base && names.has(base)) { rbIds = [base]; via = 'base number'; }
    rbIds = [...new Set(rbIds)];
    const seen = new Map();
    const add = (num, rel, dir, from) => { if (rbIds.includes(num) || seen.has(num)) return; seen.set(num, { rb: num, rel, dir, from }); };
    for (const r of rels) {
      if (rbIds.includes(r.child_part_num)) add(r.parent_part_num, r.rel_type, 'parent', r.child_part_num);
      if (rbIds.includes(r.parent_part_num)) add(r.child_part_num, r.rel_type, 'child', r.parent_part_num);
    }
    for (const r of rels) if (r.rel_type === 'M' && rbIds.includes(r.child_part_num))
      for (const s of rels) if (s.rel_type === 'M' && s.parent_part_num === r.parent_part_num) add(s.child_part_num, 'M', 'sibling', r.parent_part_num);
    const candidates = [...seen.values()].sort((a, b) => (a.rb < b.rb ? -1 : 1)).map((c) => {
      const ld = pick(ldOf.get(c.rb))[0]?.ext_id ?? c.rb;
      const blRow = pick(blOf.get(c.rb))[0]?.ext_id ?? c.rb;
      const bl = blItem(blRow);
      if (bl) want.add(lc(bl.number));
      return { ...c, name: names.get(c.rb) ?? null, ldraw: lc(ld), ldrawVia: ldOf.has(c.rb) ? 'LD mapping' : 'same number',
        bricklink: bl && { ...bl, asked: blRow, askedVia: blOf.has(c.rb) ? 'BL mapping' : 'same number' } };
    });
    lines[id] = { rb: rbIds, via, names: rbIds.map((n) => names.get(n) ?? null), candidates };
  }
  // element codes per candidate BrickLink item, per role-table colour (by BrickLink's colour name)
  const byName = Object.fromEntries(Object.entries(colours).map(([code, c]) => [c.bricklink, code]));
  const elements = {};
  for (const r of tsv(codes).slice(1)) {
    if (r.length < 3 || !want.has(lc(r[0])) || byName[r[1]] === undefined) continue;
    ((elements[r[0]] ??= {})[byName[r[1]]] ??= []).push(r[2]);
  }
  for (const n of Object.keys(elements)) for (const c of Object.keys(elements[n])) elements[n][c].sort();
  for (const l of Object.values(lines)) for (const c of l.candidates) if (c.bricklink) c.bricklink.elements = elements[c.bricklink.number] ?? {};

  // ABUNDANCE: distinct official sets (sets.csv) per (Rebrickable part, colour), spares excluded
  const sets = new Set(readCsv(join(rb, 'sets.csv')).map((r) => r.set_num));
  const invSet = new Map();
  for (const r of readCsv(join(rb, 'inventories.csv'))) if (sets.has(r.set_num)) invSet.set(r.id, r.set_num);
  const parts2 = new Set(Object.values(lines).flatMap((l) => [...l.rb, ...l.candidates.map((c) => c.rb)]));
  const hits = new Map();                                       // `${part}|${code}` -> Set(set_num)
  const rl = createInterface({ input: createReadStream(join(rb, 'inventory_parts.csv')), crlfDelay: Infinity });
  let head = true;
  for await (const line of rl) {
    if (head) { head = false; continue; }
    const c1 = line.indexOf(','), c2 = line.indexOf(',', c1 + 1), c3 = line.indexOf(',', c2 + 1);
    const part = line.slice(c1 + 1, c2);
    if (!parts2.has(part)) continue;
    const f = csvLine(line), set = invSet.get(f[0]), code = codeOfRb.get(f[2]);
    if (!set || code === undefined || f[4] === 'True') continue;
    const k = `${part}|${code}`; if (!hits.has(k)) hits.set(k, new Set()); hits.get(k).add(set);
  }
  const abundance = (nums) => { const o = {}; for (const code of Object.keys(colours)) { const s = new Set(); for (const n of nums) for (const x of hits.get(`${n}|${code}`) ?? []) s.add(x); if (s.size) o[code] = s.size; } return o; };
  for (const l of Object.values(lines)) { l.abundance = abundance(l.rb); for (const c of l.candidates) c.abundance = abundance([c.rb]); }
  return { source: { site: 'Rebrickable full download (rebrickable.com/downloads), CSV: parts, part_relationships, part_mappings, colors, color_mappings, sets, inventories, inventory_parts', date,
    bricklink: `BrickLink catalogue download (Parts, Codes) of ${BRICKLINK.source.date}`, relTypes: REL_TYPES }, colours, lines };
}

const text = (d) => `// GENERATED by tools/rebrickable-subset.mjs — do not edit. BUILT §309: the part of
// Rebrickable's full download (${d.source.date}) and BrickLink's catalogue download
// (${BRICKLINK.source.date}) that the parts list's SUBSTITUTES use. Per LDraw id the builds
// place: its Rebrickable part, every A (alternate) and M (mould variant) relative,
// each mapped back to LDraw and to a BrickLink item (with the element codes BrickLink
// lists for it in each role-table colour), and an ABUNDANCE PROXY per colour: how many
// official sets list that part in that colour (Rebrickable inventories, spares
// excluded). Abundance is NOT stock. Whether a candidate is a substitute is judged by
// the model (tools/technic-substitutes.mjs), never by this file.
export const REBRICKABLE = ${JSON.stringify(d, null, 1)};
`;

const MAIN = import.meta.url === pathToFileURL(process.argv[1] ?? '').href;
if (!MAIN) { /* imported (the probe re-derives through `derive`) */ }
else if (args.includes('--write')) {
  const d = await derive({ rb: flag('--rb'), parts: flag('--parts'), codes: flag('--codes'), date: flag('--date') });
  writeFileSync(OUT, text(d));
  const n = Object.values(d.lines).reduce((k, l) => k + l.candidates.length, 0);
  console.log(`wrote ${OUT}: ${Object.keys(d.lines).length} placed ids, ${n} candidates`);
} else if (args.includes('--check')) {
  const { REBRICKABLE } = await import('../src/technic-rebrickable.js');
  let bad = 0;
  const fail = (m) => { console.log('  FAIL ' + m); bad++; };
  for (const id of PART_IDS) if (!REBRICKABLE.lines[id]) fail(`no Rebrickable row for LDraw id ${id}`);
  for (const id of Object.keys(REBRICKABLE.lines)) if (!PART_IDS.includes(id)) fail(`Rebrickable row ${id} is placed by no build (stale)`);
  for (const c of Object.keys(BRICKLINK.colours)) if (!REBRICKABLE.colours[c]) fail(`no Rebrickable colour for LDraw ${c}`);
  if (flag('--rb')) {
    const d = await derive({ rb: flag('--rb'), parts: flag('--parts'), codes: flag('--codes'), date: REBRICKABLE.source.date });
    if (JSON.stringify(d) !== JSON.stringify(REBRICKABLE)) fail('the committed subset differs from the downloads');
  }
  console.log(bad ? `rebrickable subset: ${bad} failure(s)` : `rebrickable subset OK — ${PART_IDS.length} placed ids${flag('--rb') ? ', re-derived from the downloads' : ''}`);
  process.exit(bad ? 1 : 0);
} else { console.log('usage: --write --rb DIR --parts P --codes K --date D | --check [--rb DIR --parts P --codes K]'); process.exit(2); }
