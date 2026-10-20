// IS THE TECHNIC PAGE'S PARTS LIST THE BUILD'S PARTS: EVERY BUILD'S BILL OF MATERIALS ADDING UP TO ITS PLACEMENTS (THE FUSEE'S CORD ONE STRING), EVERY PLACED PART ANSWERED BY A TABLE ROW THE PACK'S HEADERS AND THE CATALOGUE STILL SUPPORT, EVERY UNOFFICIAL PART FLAGGED, EVERY ROLE A REAL COLOUR, AND NO WORD THE MODEL HAS NOT EARNED?
// Acceptance, pure Node, no browser, no network; exits non-zero on any failed row.
// BUILT §300 (src/technic-bom.js, technic.html's parts list). The pictures are the
// smoke test's (tools/smoke-technic-bom.mjs, Chromium).
//
//   · TOTALS — per generation, per cell: the BOM's quantities sum to the build's
//     placements, minus the fusee cord's pieces (two end studs and the braided
//     segments) plus the ONE string `cordChoice` picks (re-derived here by calling
//     cordChoice on the cord's own path length, not read back from the BOM). A
//     keyless cell is folded at every mode and the folds agree; the alarm's parts
//     are the same in armed, ringing and off.
//   · TABLE — every placed LDraw id has a PART_TABLE row whose basis its source
//     still supports (a catalogue row's `part` in CATALOGUES, a keyword row's
//     "BrickLink N" in the pack's own header, an unverified row where neither
//     exists), every title and org status on a BOM line equals the vendored
//     pack's header read here from the raw text, and a row no build places is
//     stale.
//   · UNOFFICIAL — every part the pack marks Unofficial_* prints flagged on its
//     BOM line and in the CSV's status column; technic_2026 lists 7785 and 7861,
//     technic_classic none; an `unverified` line says so.
//   · COLOUR — every role any build places (every generation, mode and alarm
//     state) has a row in LDRAW_COLOUR, a real LDraw code (COLOUR_INFO), never 16;
//     no row names a role nothing places; the .ldr carries no 16.
//   · CSV and WORDS — the CSV parses back to the BOM's lines, carries the
//     not-in-the-model items and the honesty text, and no prose the list prints
//     (nor the page's §300 block) says a build works, was tested or was simulated.
//   · VIEW — the picture camera is orthonormal and `viewBounds` equals an
//     independent lookAt projection of the part's triangles.
//   · PAGE — technic.html seeds the BOM memo with a build for every cell and
//     gives every cell a parts list; every carousel stop's cell has a BOM.
//
// CONTROLS, each seen to fail: a placement deleted from a copy of the build (the
// totals check); the cord left uncollapsed (throws); a PART_TABLE row dropped, a
// stale row added, a basis upgraded without a source, a keyword row with the
// wrong id; a pack whose 7785 is rewritten as official (the flag check); a flag
// stripped from a line; a role row deleted (the fold throws); a CSV with a
// quantity changed; a prose line saying "works"; a page block with "tested"; a
// view with one axis flipped; a page with a seedBuild line removed.
//
//   node tools/probe-technic-bom.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseLibrary, walk } from '../src/ldraw.js';
import { CATALOGUES, TECHNIC_FORK } from '../src/layout.js';
import { placedParts, toLdr, LDRAW_COLOUR } from '../src/technic-ldraw.js';
import { solveFusee, TECHNIC_FUSEE_SPRING, frameFusee, cordChoice } from '../src/technic-fusee.js';
import { frameAlarm, alarmStates, alarmBuild } from '../src/technic-alarm.js';
import { frameFork, frameKeyless } from '../src/technic-frame.js';
import { frameEscapement } from '../src/technic-escapement.js';
import * as C from '../src/technic-carousel.js';
import * as B from '../src/technic-bom.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const mpd = readFileSync(join(ROOT, 'vendor/ldraw/technic-parts.mpd'), 'utf8');
const lib = parseLibrary(mpd);
const page = readFileSync(join(ROOT, 'technic.html'), 'utf8');
let fails = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fails++; console.log(`  ✗ ${msg}`); } return !!cond; };
const controls = [];
const control = (name, caught) => { controls.push([name, caught]); };

console.log('THE TECHNIC PARTS LIST — the bill of materials per build (modelled, not built)\n');

const t0 = performance.now();
const all = B.allBoms(lib);
console.log(`built and folded both generations in ${Math.round(performance.now() - t0)} ms`);

// ── TOTALS ─────────────────────────────────────────────────────────────────
console.log('\nTOTALS');
const expectTotal = (build) => placedParts(build, 0, build.modes?.[0]).filter((p) => !B.CORD_ROLES.includes(p.role)).length + (build.cord ? 1 : 0);
const totalsHold = (bom, build) => bom.total === expectTotal(build) && bom.lines.reduce((n, l) => n + l.qty, 0) === bom.total;
const rowsOf = [];
for (const gen of B.GENERATIONS) for (const c of all[gen]) {
  ok(c.bom, `${gen} ${c.cell}: no BOM (${c.reason})`);
  if (!c.bom) continue;
  const build = B.buildOf(lib, gen, c.cell).build;
  const b = c.bom;
  ok(totalsHold(b, build), `${gen} ${c.cell}: BOM total ${b.total} != ${expectTotal(build)} (placements ${b.placements})`);
  ok(b.modesAgree, `${gen} ${c.cell}: the modes' folds disagree`);
  ok(b.perMode.every((m) => m.total === b.total && m.placements === b.placements), `${gen} ${c.cell}: a mode's total/placements moved ${JSON.stringify(b.perMode)}`);
  if (c.cell === 'keyless') ok(b.modes.join() === 'wind,set,neutral' && b.perMode.length === 3, `${gen} keyless: modes ${b.modes}`);
  ok(b.lines.every((l) => l.qty > 0 && Number.isInteger(l.qty)), `${gen} ${c.cell}: a non-positive quantity`);
  ok(new Set(b.lines.map((l) => `${l.part}|${l.colour}`)).size === b.lines.length, `${gen} ${c.cell}: a (id, colour) repeats`);
  rowsOf.push(`${gen.replace('technic_', '').padEnd(7)} ${c.cell.padEnd(11)} ${String(b.placements).padStart(4)} placements -> ${String(b.total).padStart(4)} parts, ${String(b.lines.length).padStart(2)} lines, ${b.colours.length} colours`);
}
console.log(rowsOf.map((r) => '  ' + r).join('\n'));
// the cord: one string, the one cordChoice picks for the cord's own path
{
  const run = solveFusee(TECHNIC_FUSEE_SPRING).best, ff = frameFusee();
  for (const gen of B.GENERATIONS) {
    const build = B.buildOf(lib, gen, 'fusee').build, b = all[gen].find((c) => c.cell === 'fusee').bom;
    const cord = placedParts(build).filter((p) => B.CORD_ROLES.includes(p.role));
    const ends = cord.filter((p) => p.role === 'cordEnd').length;
    const pick = cordChoice(build.cord.noDead, run).choice;
    ok(ends === 2 && cord.length > 2, `${gen} fusee: cord is ${ends} end studs and ${cord.length - ends} segments`);
    const sl = b.lines.filter((l) => l.string);
    ok(sl.length === 1 && sl[0].qty === 1 && sl[0].part === pick.part && sl[0].string.studs === pick.studs && sl[0].string.length === pick.length, `${gen} fusee: the string line is not cordChoice's ${pick.part}`);
    ok(b.lines.every((l) => !/^71149k0/.test(l.part)), `${gen} fusee: a cord piece survived the collapse`);
    ok(b.cordPlacements === cord.length && b.total === b.placements - cord.length + 1, `${gen} fusee: ${b.placements} placements - ${b.cordPlacements} + 1 != ${b.total}`);
    ok(ff.framed && pick.dead >= 0, `${gen} fusee: the string is shorter than the path`);
    if (gen === B.GENERATIONS[0]) console.log(`  fusee: ${b.placements} placements = ${cord.length} cord pieces (${ends} end studs + ${cord.length - ends} segments) + ${b.placements - cord.length} others -> ${b.total} parts; the string is ${pick.part}, ${pick.studs} studs, ${pick.length} mm (${pick.dead.toFixed(1)} mm dead)`);
  }
}
// the alarm's parts are the same in every state it is drawn in
{
  const af = frameAlarm(), st = alarmStates(lib, af), ref = all.technic_2026.find((c) => c.cell === 'alarm').bom;
  for (const mode of ['armed', 'ringing', 'off']) {
    const f = B.foldParts(placedParts(alarmBuild(af, lib, st[mode])));
    ok(f.lines.map((l) => `${l.part}|${l.colour}|${l.qty}`).join() === ref.lines.map((l) => `${l.part}|${l.colour}|${l.qty}`).join(), `alarm ${mode}: the fold differs from the armed BOM's`);
  }
}
// CONTROLS: a placement deleted; the cord left uncollapsed
{
  const build = B.buildOf(lib, 'technic_2026', 'row-1').build, bom = all.technic_2026[0].bom;
  const cut = { ...build, statics: build.statics.slice(0, -1) };
  control('a placement deleted from a copy of the build fails the totals', !totalsHold(bom, cut));
  const cutShaft = { ...build, shafts: build.shafts.map((s, i) => (i ? s : { ...s, parts: s.parts.slice(1) })) };
  control('a part deleted from a shaft fails the totals', !totalsHold(bom, cutShaft));
  control('the unmutated build passes the same check', totalsHold(bom, build));
  const fb = B.buildOf(lib, 'technic_2026', 'fusee').build;
  let threw = false; try { B.foldParts(placedParts(fb)); } catch (_) { threw = true; }
  control('a fusee folded with no string (the cord uncollapsed) throws', threw);
  let threw2 = false; try { B.foldParts(placedParts(build), { string: { part: '75924', studs: 21, length: 160, dead: 1 } }); } catch (_) { threw2 = true; }
  control('a string chosen for a build with no cord throws', threw2);
}

// ── TABLE ──────────────────────────────────────────────────────────────────
console.log('\nTABLE');
const ids = B.idsOf(all);
const audit = B.auditTable(B.PART_TABLE, ids, lib);
ok(audit.length === 0, `PART_TABLE audit: ${audit.join('; ')}`);
// the pack's header, read here from the RAW text (not through parseLibrary)
const rawHeader = (id) => {
  const i = mpd.indexOf(`\n0 FILE ${id}.dat\n`);
  if (i < 0) return null;
  const sec = mpd.slice(i + 1).split(/\n0 FILE /)[0].split('\n');
  const title = sec[1].replace(/^0 /, '').trim().replace(/\s+/g, ' ');   // the pack's titles carry double spaces ("Plate  1 x  2"); the list prints them collapsed
  const org = (sec.find((l) => l.startsWith('0 !LDRAW_ORG')) ?? '').replace('0 !LDRAW_ORG', '').trim();
  return { title, org };
};
let titled = 0;
for (const gen of B.GENERATIONS) for (const c of all[gen]) for (const l of c.bom.lines) {
  const h = rawHeader(l.part);
  if (!ok(h, `${l.part}: no header in the pack`)) continue;
  if (h.title.startsWith('~Moved to')) { ok(l.aliasOf && l.title === rawHeader(l.aliasOf).title, `${l.part}: an alias must read its target's title`); }
  else ok(l.title === h.title && l.org === h.org, `${gen} ${l.part}: BOM title/org "${l.title}"/"${l.org}" != header "${h.title}"/"${h.org}"`);
  titled++;
  ok(l.purchase.source && SOURCE_OK(l), `${l.part}: purchase id has no source`);
  const basis = l.purchase.basis;
  ok(basis === 'unverified' ? l.purchase.date === null && l.flags.includes('purchase id not yet verified') : basis === 'catalogue' ? l.purchase.date === '2026-09-12' : !!l.purchase.date, `${l.part}: a ${basis} line's date/flag is wrong (${l.purchase.date})`);
}
function SOURCE_OK(l) { return typeof l.purchase.source === 'string' && l.purchase.source.length > 10 && B.SOURCES[l.purchase.basis]; }
const byBasis = {};
for (const id of ids) byBasis[B.PART_TABLE[id].basis] = (byBasis[B.PART_TABLE[id].basis] ?? 0) + 1;
console.log(`  ${ids.length} distinct ids across both generations (the string included); ${titled} BOM lines read against the pack's headers`);
console.log(`  purchase-id basis: ${Object.entries(byBasis).map(([k, v]) => `${k} ${v}`).join(', ')}`);
// every placed id the catalogue lists must come out as a catalogue row
for (const cat of Object.values(CATALOGUES).filter(Boolean)) for (const c of cat.counts) if (ids.includes(c.part))
  ok(B.PART_TABLE[c.part].basis === 'catalogue' && B.PART_TABLE[c.part].purchase === c.part, `${c.part}: a CATALOGUES part not held as a catalogue row`);
// CONTROLS
{
  const drop = { ...B.PART_TABLE }; delete drop['3004'];
  control('a dropped PART_TABLE row fails the audit', B.auditTable(drop, ids, lib).some((m) => /3004.*no PART_TABLE row/.test(m)));
  const stale = { ...B.PART_TABLE, '99999': { purchase: '99999', basis: 'unverified' } };
  control('a row no build places fails as stale', B.auditTable(stale, ids, lib).some((m) => /99999.*stale/.test(m)));
  const up = { ...B.PART_TABLE, '3004': { purchase: '3004', basis: 'catalogue' } };
  control('an unverified row upgraded to catalogue without a source fails', B.auditTable(up, ids, lib).some((m) => /3004/.test(m)));
  const wrongKw = { ...B.PART_TABLE, '3023b': { purchase: '3024', basis: 'ldraw-keyword' } };
  control('a keyword row with the wrong id fails', B.auditTable(wrongKw, ids, lib).some((m) => /3023b/.test(m)));
  const downgrade = { ...B.PART_TABLE, '3647': { purchase: '3647', basis: 'unverified' } };
  control('a catalogue row downgraded to unverified fails (the source improved on it)', B.auditTable(downgrade, ids, lib).some((m) => /3647/.test(m)));
  const nobasis = { ...B.PART_TABLE, '3004': { purchase: '3004', basis: 'memory' } };
  control('a basis with no source fails', B.auditTable(nobasis, ids, lib).some((m) => /3004.*no source/.test(m)));
  control('an id the pack does not hold fails', B.auditTable(B.PART_TABLE, [...ids, '12345'], lib).some((m) => /12345.*not in the vendored pack/.test(m)));
  // a row 'catalogue' only because a CATALOGUES row exists: remove it and the audit must notice
  const cut = { ...CATALOGUES.technic_2026, counts: CATALOGUES.technic_2026.counts.filter((c) => c.part !== '3647') };
  const saved = CATALOGUES.technic_2026;
  control('(self-check) the catalogue still lists 3647 for the controls above', saved.counts.some((c) => c.part === '3647') && cut.counts.length === saved.counts.length - 1);
}

// ── UNOFFICIAL ─────────────────────────────────────────────────────────────
console.log('\nUNOFFICIAL');
const unofficialIds = (gen) => [...new Set(all[gen].flatMap((c) => c.bom.lines.filter((l) => /^Unofficial/i.test(rawHeader(l.part).org)).map((l) => l.part)))].sort();
const u26 = unofficialIds('technic_2026'), uCl = unofficialIds('technic_classic');
console.log(`  unofficial in technic_2026: ${u26.join(', ') || '(none)'}; in technic_classic: ${uCl.join(', ') || '(none)'}`);
ok(['7785', '7861'].every((i) => u26.includes(i)), `technic_2026 must list 7785 and 7861 as unofficial parts (has ${u26})`);
ok(uCl.length === 0, `technic_classic lists unofficial parts: ${uCl}`);
const unflagged = (cells, unofficial) => cells.flatMap((c) => c.bom.lines.filter((l) => unofficial.includes(l.part) && !(l.status === 'unofficial' && l.flags.some((f) => /^unofficial/.test(f)))).map((l) => `${c.cell} ${l.part}`));
for (const gen of B.GENERATIONS) {
  const bad = unflagged(all[gen], [...u26, ...uCl]);
  ok(bad.length === 0, `${gen}: unofficial parts printed without the flag: ${bad}`);
  // and the CSV's status column says it too
  for (const c of all[gen]) {
    const rows = B.parseCsv(B.bomCsv(c, gen)), head = rows[0];
    const idI = head.indexOf('ldraw_id'), stI = head.indexOf('part_status');
    for (const r of rows.slice(1)) if (r.length === head.length && u26.includes(r[idI])) ok(r[stI] === 'unofficial', `${gen} ${c.cell} CSV: ${r[idI]} status ${r[stI]}`);
  }
}
// the flag follows the HEADER: a pack whose 7785 reads as official prints no flag, and the check sees the difference
{
  const lib2 = parseLibrary(mpd.replace(/(0 FILE 7785\.dat[\s\S]*?)0 !LDRAW_ORG Unofficial_Part/, '$1' + '0 !LDRAW_ORG Part UPDATE 2026-01'));
  const l7785 = B.bomOf(B.buildOf(lib, 'technic_2026', 'keyless').build, lib2).lines.find((l) => l.part === '7785');
  control('7785 rewritten as official in a copy of the pack prints no unofficial flag (the flag is read, not typed)', l7785 && l7785.status !== 'unofficial' && !l7785.flags.some((f) => /^unofficial/.test(f)));
  const stripped = all.technic_2026.find((c) => c.cell === 'keyless');
  const copy = { ...stripped, bom: { ...stripped.bom, lines: stripped.bom.lines.map((l) => (l.part === '7785' ? { ...l, flags: [] } : l)) } };
  control('a flag stripped from an unofficial line is caught', unflagged([copy], u26).length > 0);
}
// a line with no verified id says so; a mould variant says so
for (const gen of B.GENERATIONS) for (const c of all[gen]) for (const l of c.bom.lines) {
  if (l.status === 'mould-variant') ok(l.flags.some((f) => /^mould variant/.test(f)), `${gen} ${l.part}: a mould variant without its flag`);
  ok(l.hex && l.colourName, `${l.part}: colour ${l.colour} unnamed`);
}

// ── COLOUR ─────────────────────────────────────────────────────────────────
console.log('\nCOLOUR');
const roles = new Map();
const see = (parts, tag) => { for (const p of parts) { if (!roles.has(p.role)) roles.set(p.role, new Set()); roles.get(p.role).add(tag); } };
for (const gen of B.GENERATIONS) for (const cell of B.cellIds()) {
  const build = B.buildOf(lib, gen, cell).build;
  if (!build) continue;
  for (const m of build.modes?.length ? build.modes : [undefined]) see(placedParts(build, 0, m), `${gen}:${cell}`);
}
{ const af = frameAlarm(), st = alarmStates(lib, af); for (const mode of ['armed', 'ringing', 'off']) see(placedParts(alarmBuild(af, lib, st[mode])), `alarm:${mode}`); }
console.log(`  ${roles.size} roles placed across both generations, every mode and every alarm state; LDRAW_COLOUR has ${Object.keys(LDRAW_COLOUR).length} rows`);
for (const r of roles.keys()) {
  const code = LDRAW_COLOUR[r];
  ok(Number.isInteger(code) && code !== 16 && B.COLOUR_INFO[code], `role ${r} has colour ${code}: not a real LDraw code (16 is "the placer's colour")`);
}
for (const r of Object.keys(LDRAW_COLOUR)) ok(roles.has(r), `LDRAW_COLOUR names role ${r}, which no build places (stale)`);
for (const [code, info] of Object.entries(B.COLOUR_INFO)) ok(/^#[0-9A-F]{6}$/i.test(info.hex) && info.name, `COLOUR_INFO ${code} malformed`);
for (const code of Object.values(LDRAW_COLOUR)) ok(B.COLOUR_INFO[code], `LDRAW_COLOUR uses code ${code}, absent from COLOUR_INFO`);
for (const cell of B.cellIds()) {
  const build = B.buildOf(lib, 'technic_2026', cell).build;
  const bad = toLdr(build).split('\n').filter((l) => /^1 16 /.test(l)).length;
  ok(bad === 0, `${cell}: the .ldr carries ${bad} lines in colour 16`);
}
// roles that fell to 16 before this landing now read: the fusee, alarm and escapement roles
const was = new Set(['cord', 'cordEnd', 'barrel', 'hook', 'knob', 'pulley', 'click', 'ratchet', 'pawl', 'great', 'centre', 'lever', 'pin', 'rotor', 'wheel', 'driver', 'stub', 'pushTip', 'collar', 'button', 'beam', 'gear', 'knife', 'mass', 'pallet']);
console.log(`  ${[...was].filter((r) => roles.has(r) && LDRAW_COLOUR[r] !== undefined).length} of ${was.size} roles that used to fall to colour 16 now have a code`);
{
  const noPallet = { ...LDRAW_COLOUR }; delete noPallet.pallet;
  let threw = false; try { B.bomOf(B.buildOf(lib, 'technic_2026', 'escapement').build, lib, { colours: noPallet }); } catch (_) { threw = true; }
  control('a deleted role row (pallet) makes the fold throw instead of falling to 16', threw);
  const stale = { ...LDRAW_COLOUR, ghost: 4 };
  control('a stale role row is caught by the stale test', !roles.has('ghost') && Object.keys(stale).some((r) => !roles.has(r)));
  const sixteen = { ...LDRAW_COLOUR, pallet: 16 };
  control('a role at 16 is caught by the real-code test', !(Number.isInteger(sixteen.pallet) && sixteen.pallet !== 16 && B.COLOUR_INFO[sixteen.pallet]));
}

// ── CSV and WORDS ──────────────────────────────────────────────────────────
console.log('\nCSV AND WORDS');
const FORBIDDEN = /\b(works?|working|tested|simulated|simulation|simulate)\b/i;
let csvRows = 0;
for (const gen of B.GENERATIONS) for (const c of all[gen]) {
  const text = B.bomCsv(c, gen), rows = B.parseCsv(text), head = rows[0];
  ok(head.join() === B.CSV_COLUMNS.join(), `${gen} ${c.cell}: CSV header ${head}`);
  const blank = rows.findIndex((r) => r.length === 1 && r[0] === '');
  const lines = rows.slice(1, blank), notes = rows.slice(blank + 2);
  ok(lines.length === c.bom.lines.length, `${gen} ${c.cell}: CSV has ${lines.length} lines, BOM ${c.bom.lines.length}`);
  const q = head.indexOf('quantity'), idI = head.indexOf('ldraw_id'), cI = head.indexOf('colour_code');
  ok(lines.reduce((n, r) => n + Number(r[q]), 0) === c.bom.total, `${gen} ${c.cell}: CSV quantities do not sum to ${c.bom.total}`);
  ok(lines.every((r, i) => r.length === head.length && r[idI] === c.bom.lines[i].part && Number(r[cI]) === c.bom.lines[i].colour && Number(r[q]) === c.bom.lines[i].qty), `${gen} ${c.cell}: CSV lines do not round-trip`);
  ok(notes.some((r) => r[0] === 'note' && /^Modelled, not built\./.test(r[1])), `${gen} ${c.cell}: the CSV lacks the modelled-not-built note`);
  ok(notes.some((r) => r[0] === 'note' && /LDraw\.org library, CC BY 4\.0/.test(r[1])), `${gen} ${c.cell}: the CSV lacks the LDraw attribution`);
  ok(notes.filter((r) => r[0] === 'not in the model').length === B.NOT_IN_MODEL[c.kind].length, `${gen} ${c.cell}: the CSV's not-in-the-model items`);
  ok(!notes.some((r) => /LEGO logo|set number/i.test(r[1])), `${gen} ${c.cell}: a logo/set-number claim`);
  csvRows += lines.length;
  // no prose the list prints says a forbidden word
  for (const r of notes) ok(!FORBIDDEN.test(r[1]), `${gen} ${c.cell}: forbidden word in "${r[1].slice(0, 70)}"`);
  for (const l of c.bom.lines) for (const f of l.flags) ok(!FORBIDDEN.test(f), `${l.part}: forbidden word in flag "${f}"`);
}
ok(B.NOT_IN_MODEL.fusee.some((n) => n.quantity === 'unspecified') && B.NOT_IN_MODEL.alarm.some((n) => /gong/.test(n.item)), 'the fusee must say bands are unspecified and the alarm must say the gong is not a part');
ok(Object.values(B.NOT_IN_MODEL).flat().every((n) => !/\d/.test(n.quantity)), 'a not-in-the-model item carries a count (the model has none)');
ok(B.honestyFor('escapement', []).some((h) => /analogue/.test(h)) && B.honestyFor('fusee', []).some((h) => /posed/.test(h)), 'the posed/analogue honesty lines');
console.log(`  ${csvRows} CSV lines over ${2 * B.cellIds().length} lists parsed back`);
{
  const c = all.technic_2026[0], rows = B.parseCsv(B.bomCsv(c, 'technic_2026'));
  rows[1][rows[0].indexOf('quantity')] = String(Number(rows[1][rows[0].indexOf('quantity')]) + 1);
  control('a CSV with one quantity changed no longer sums to the BOM', rows.slice(1, 1 + c.bom.lines.length).reduce((n, r) => n + Number(r[rows[0].indexOf('quantity')]), 0) !== c.bom.total);
  control('the word scan catches "this build works"', FORBIDDEN.test('this build works'));
  control('the word scan catches "tested" and "simulated"', FORBIDDEN.test('tested on a bench') && FORBIDDEN.test('a simulated escapement'));
  control('the word scan leaves "modelled, not built" alone', !FORBIDDEN.test(B.HONESTY.modelled) && !FORBIDDEN.test('modelled, not built'));
}
// the page's §300 block
const pageBlock = page.slice(page.indexOf('// --- §300: the parts list'), page.indexOf('async function build(gen)'));
ok(pageBlock.length > 500, 'the page has no §300 parts-list block');
ok(!FORBIDDEN.test(pageBlock.replace(/\/\/.*$/gm, '')), `the page's parts-list code says a forbidden word: ${pageBlock.match(FORBIDDEN)?.[0]}`);
control('the page-block scan catches "tested"', FORBIDDEN.test(pageBlock + " el('p', null, 'tested')"));

// ── VIEW ───────────────────────────────────────────────────────────────────
console.log('\nVIEW');
{
  const v = B.viewBasis(), dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0), cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  ok([v.right, v.up, v.forward].every((a) => Math.abs(dot(a, a) - 1) < 1e-12) && Math.abs(dot(v.right, v.up)) < 1e-12 && Math.abs(dot(v.right, v.forward)) < 1e-12 && Math.abs(dot(v.up, v.forward)) < 1e-12, 'the picture camera is not orthonormal');
  ok(v.up[1] < 0, 'the view\'s up does not point up (LDraw +Y is down)');
  ok(dot(cross(v.right, v.up), v.forward) < -0.999, 'the view is not a right-handed (mirrored) camera');
  // an independent three.js-convention lookAt: z = eye - target, x = up x z, y = z x x
  const norm = (a) => { const n = Math.hypot(...a); return a.map((x) => x / n); };
  const lookAt = (eye) => { const z = norm(eye), x = norm(cross([0, -1, 0], z)), y = cross(z, x); return { x, y }; };
  const L = lookAt(v.eye);
  for (const id of ['3024', '3004', '6541', '3647', '3649', '3811', '75924', '46372', '2712']) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    walk(lib, `${id}.dat`, (k, pts) => { if (k !== 'tri') return; for (const p of pts) { const a = dot(p, L.x), b = dot(p, L.y); x0 = Math.min(x0, a); x1 = Math.max(x1, a); y0 = Math.min(y0, b); y1 = Math.max(y1, b); } });
    const vb = B.viewBounds(lib, id);
    ok(Math.abs(vb.w - (x1 - x0)) < 1e-9 && Math.abs(vb.h - (y1 - y0)) < 1e-9 && Math.abs(vb.cx - (x0 + x1) / 2) < 1e-9 && Math.abs(vb.cy - (y0 + y1) / 2) < 1e-9, `${id}: viewBounds ${vb.w.toFixed(3)}x${vb.h.toFixed(3)} != independent ${(x1 - x0).toFixed(3)}x${(y1 - y0).toFixed(3)}`);
    ok(vb.w > 0 && vb.h > 0 && Number.isFinite(vb.aspect), `${id}: degenerate view box`);
  }
  const el2 = 10 * Math.PI / 180, L2 = lookAt([Math.sin(Math.PI / 4) * Math.cos(el2), -Math.sin(el2), -Math.cos(Math.PI / 4) * Math.cos(el2)]);   // elevation 10 degrees, not 30: a different camera
  let ya = Infinity, yb = -Infinity; walk(lib, '3004.dat', (k, pts) => { if (k !== 'tri') return; for (const p of pts) { const s2 = dot(p, L2.y); ya = Math.min(ya, s2); yb = Math.max(yb, s2); } });
  const vb = B.viewBounds(lib, '3004');
  control('a camera at another elevation reads a different box for a 1 x 2 brick', Math.abs((yb - ya) - vb.h) > 1);
  control('the aspects of a plate, a gear and a baseplate differ (the smoke can tell a wrong part)', new Set(['3024', '3647', '3811', '75924'].map((id) => B.viewBounds(lib, id).aspect.toFixed(2))).size === 4);
}

// ── PAGE ───────────────────────────────────────────────────────────────────
console.log('\nPAGE');
{
  const cells = B.cellIds();
  const seeded = (text) => {
    const miss = [];
    if (!/TECHNIC_FORK\.rows\.forEach\(\(_, k\) => \{[\s\S]*?seedBuild\(lib, gen, `row-\$\{k \+ 1\}`/.test(text)) miss.push('rows');
    for (const c of ['keyless', 'fusee', 'alarm', 'escapement']) if (!new RegExp(`seedBuild\\(lib, gen, '${c}'`).test(text)) miss.push(c);
    return miss;
  };
  ok(seeded(page).length === 0, `technic.html seeds no build for: ${seeded(page)}`);
  control('a page with the fusee seed removed is caught', seeded(page.replace(/seedBuild\(lib, gen, 'fusee'[^;]*;/, '')).includes('fusee'));
  ok(/import \{[^}]*bomForCell[^}]*\} from '\.\/src\/technic-bom\.js'/.test(page) && /makePartPictures/.test(page), 'technic.html does not import the parts list');
  ok(/for \(const c of Object\.keys\(cellReg\)\) addBomDetails\(c, gen\)/.test(page), 'technic.html does not give every built cell a parts list');
  // every carousel stop's cell has a BOM
  const run = solveFusee(TECHNIC_FUSEE_SPRING).best, ff = frameFusee(), al = frameAlarm(), es = frameEscapement();
  for (const gen of B.GENERATIONS) {
    const stops = C.stopsOf(C.describeCells({ rows: TECHNIC_FORK.rows.map((r, k) => ({ key: r.key, chain: r.chains[gen], frame: frameFork(gen)[k] })), keyless: frameKeyless(gen),
      fusee: { framed: !!(run && ff.framed), reason: '' }, alarm: al, escapement: es })).stops;
    const have = new Set(all[gen].filter((c) => c.bom).map((c) => c.cell));
    const miss = stops.filter((s) => !have.has(s.cell)).map((s) => s.id);
    ok(miss.length === 0, `${gen}: carousel stops with no parts list: ${miss}`);
    console.log(`  ${gen}: ${stops.length} stops -> ${new Set(stops.map((s) => s.cell)).size} builds, each with a list`);
  }
  control('a stop whose cell has no BOM is caught', ['nonesuch'].some((c) => !new Set(all.technic_2026.map((x) => x.cell)).has(c)));
}

// ── controls, seen ────────────────────────────────────────────────────────
console.log('\nCONTROLS');
for (const [name, caught] of controls) { checks++; if (!caught) fails++; console.log(`  ${caught ? '✓' : '✗ NOT CAUGHT'}  ${name}`); }
console.log(`\n${fails ? 'FAIL' : 'PASS'} — ${checks} checks, ${controls.length} controls, ${fails} failed`);
process.exit(fails ? 1 : 0);
