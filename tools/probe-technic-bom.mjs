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
//   · BRICKLINK (BUILT §301, §303) — every line of every build, both generations, every
//     keyless mode and alarm state, is in a colour BrickLink lists an element for (0 lines
//     unlisted; 143 of 143 in the 2026 builds), the .ldr colour column too; LDRAW_COLOUR
//     EQUALS what repickColours derives from the placements and the BrickLink subset
//     starting from the §300 table; an extension colour is used only for a part no base
//     colour lists; 7785 is White and 7861 Light Bluish Gray. The flag path stays: a table
//     with 7785 forced to Orange is flagged "lists White", and the gate fails on it.
//   · CSV and WORDS — the CSV parses back to the BOM's lines, carries the
//     not-in-the-model items and the honesty text, and no prose the list prints
//     (nor the page's §300 block) says a build works, was tested or was simulated.
//   · WANTED (BUILT §306) — for every build, generation and condition the BrickLink
//     wanted-list XML parses back (the module's strict parser and an independent
//     regex read): its lots are the BOM's (BrickLink item, colour) multiset read
//     through the subset, quantities summed to the BOM's total, every ITEMID and
//     COLOR the subset's, the tags exactly the format's, no LDraw id standing for a
//     differing BrickLink item, escaping round-trips, merges reported.
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
// view with one axis flipped; a page with a seedBuild line removed; a wanted list
// with 22253 for 6595, a MINQTY changed, an ITEM dropped, a COLOR changed, an
// invented tag, a lot written twice; an unlisted line, a line with no item and one
// with no colour id refusing to export; a merge of two lines summed and reported.
//
//   node tools/probe-technic-bom.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseLibrary, walk } from '../src/ldraw.js';
import { CATALOGUES, TECHNIC_FORK } from '../src/layout.js';
import { BRICKLINK } from '../src/technic-bricklink.js';
import { PART_IDS } from '../src/technic-bom-ids.js';
import { placedParts, toLdr, LDRAW_COLOUR } from '../src/technic-ldraw.js';
import { repickColours, colourOf, unlistedUnits, COLOUR_BASELINE_300 } from '../src/technic-colour.js';
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
  ok(basis === 'unverified' ? l.purchase.date === null && l.flags.includes('purchase id not yet verified') : basis === 'bricklink' ? l.purchase.date === BRICKLINK.source.date : basis === 'catalogue' ? l.purchase.date === '2026-09-12' : !!l.purchase.date, `${l.part}: a ${basis} line's date/flag is wrong (${l.purchase.date})`);
}
function SOURCE_OK(l) { return typeof l.purchase.source === 'string' && l.purchase.source.length > 10 && B.SOURCES[l.purchase.basis]; }
const byBasis = {};
for (const id of ids) byBasis[B.PART_TABLE[id].basis] = (byBasis[B.PART_TABLE[id].basis] ?? 0) + 1;
console.log(`  ${ids.length} distinct ids across both generations (the string included); ${titled} BOM lines read against the pack's headers`);
console.log(`  purchase-id basis: ${Object.entries(byBasis).map(([k, v]) => `${k} ${v}`).join(', ')}`);
// every placed id the catalogue lists must come out as a catalogue row
// and BrickLink's download must AGREE with the person's reading of it (2026-09-12): the same item number
for (const cat of Object.values(CATALOGUES).filter(Boolean)) for (const c of cat.counts) if (ids.includes(c.part))
  ok(B.PART_TABLE[c.part].basis === 'bricklink' && B.PART_TABLE[c.part].purchase === c.part, `${c.part}: a CATALOGUES part is not the BrickLink item of the same number (${B.PART_TABLE[c.part].purchase})`);
// the id list the generator reads is what the builds place, and every row has BrickLink's data
ok(JSON.stringify([...PART_IDS].sort()) === JSON.stringify([...ids].sort()), `PART_IDS differs from the placed ids: ${PART_IDS.filter((i) => !ids.includes(i))} / ${ids.filter((i) => !PART_IDS.includes(i))}`);
ok(Object.keys(BRICKLINK.parts).length === ids.length && ids.every((i) => BRICKLINK.parts[i]), 'a placed id has no BrickLink row');
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
  control('a BrickLink row downgraded to unverified fails (the source improved on it)', B.auditTable(downgrade, ids, lib).some((m) => /3647/.test(m)));
  const nobasis = { ...B.PART_TABLE, '3004': { purchase: '3004', basis: 'memory' } };
  control('a basis with no source fails', B.auditTable(nobasis, ids, lib).some((m) => /3004.*no source/.test(m)));
  control('an id the pack does not hold fails', B.auditTable(B.PART_TABLE, [...ids, '12345'], lib).some((m) => /12345.*not in the vendored pack/.test(m)));
  // a row 'catalogue' only because a CATALOGUES row exists: remove it and the audit must notice
  const cut = { ...CATALOGUES.technic_2026, counts: CATALOGUES.technic_2026.counts.filter((c) => c.part !== '3647') };
  const saved = CATALOGUES.technic_2026;
  control('(self-check) the catalogue still lists 3647 for the controls above', saved.counts.some((c) => c.part === '3647') && cut.counts.length === saved.counts.length - 1);
}

// ── BRICKLINK ──────────────────────────────────────────────────────────────
console.log('\nBRICKLINK');
{
  const lines = (gen) => all[gen].flatMap((c) => (c.bom ? c.bom.lines.map((l) => ({ ...l, cell: c.cell })) : []));
  const l26 = lines('technic_2026');
  ok(l26.every((l) => l.bricklink && l.bricklink.colourId && l.bricklink.item), 'a 2026 line has no BrickLink item or colour');
  ok(l26.every((l) => l.purchase.basis === 'bricklink'), 'a 2026 line is not a bricklink-basis row');
  // an element the download lists reads as listed, one it does not reads as flagged
  const gear = l26.find((l) => l.bricklink.listed);
  ok(gear && gear.bricklink.elements.every((e) => (BRICKLINK.elements[gear.bricklink.item][gear.colour] ?? []).includes(e)), `${gear?.part}: a listed line's elements are the download's`);
  // §303: no line of any build, in either generation, is unlisted
  const unl = l26.filter((l) => !l.bricklink.listed);
  const unlAll = B.GENERATIONS.flatMap((g) => lines(g).filter((l) => !l.bricklink?.listed).map((l) => `${g} ${l.cell} ${l.part} ${l.colourName}`));
  ok(unlAll.length === 0, `${unlAll.length} lines are in a colour BrickLink lists no element for: ${unlAll.slice(0, 6).join('; ')}`);
  ok(B.GENERATIONS.every((g) => lines(g).every((l) => !l.flags.some((f) => /^BrickLink lists no element/.test(f)))), 'a line carries the unlisted flag');
  console.log(`  ${l26.length} 2026 lines over 8 builds (${lines('technic_classic').length} classic): ${unl.length} are in a colour BrickLink lists no element for (was 19 before BUILT §303); the rest carry an element code`);
  // the table, the .ldr colour column and every (role, part) the builds place
  const units = B.colourUnits(lib);
  const stillUnlisted = unlistedUnits(units, LDRAW_COLOUR, B.isListed);
  ok(stillUnlisted.length === 0, `(role, part) units in an unlisted colour: ${stillUnlisted.map((u) => `${u.role}/${u.part} ${u.colour}`).join(', ')}`);
  for (const gen of B.GENERATIONS) for (const cell of B.cellIds()) {
    const build = B.buildOf(lib, gen, cell).build; if (!build) continue;
    const bad = placedParts(build, 0, build.modes?.[0]).filter((p) => !B.CORD_ROLES.includes(p.role) && !B.isListed(p.part, colourOf(LDRAW_COLOUR, p.role, p.part)));
    ok(bad.length === 0, `${gen} ${cell}: ${bad.length} placements are drawn in a colour BrickLink does not list (${bad[0]?.part})`);
  }
  console.log(`  ${units.length} (role, part) units over both generations, every keyless mode and alarm state; ${Object.keys(LDRAW_COLOUR).filter((k) => k.includes('/')).length} exception rows`);
  // the table is DERIVED: repickColours from the §300 table gives LDRAW_COLOUR exactly
  const BASE = [0, 1, 2, 4, 14, 15, 19, 25, 71, 72], EXTRA = [321];
  const derived = repickColours({ units, listed: B.isListed, base: BASE, extra: EXTRA, current: COLOUR_BASELINE_300 });
  const sortJ = (o) => JSON.stringify(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1)));
  ok(sortJ(derived.table) === sortJ(LDRAW_COLOUR), `LDRAW_COLOUR differs from repickColours' derivation: ${Object.keys(derived.table).filter((k) => derived.table[k] !== LDRAW_COLOUR[k]).join(', ')}`);
  ok(sortJ(repickColours({ units, listed: B.isListed, base: BASE, extra: EXTRA, current: LDRAW_COLOUR }).table) === sortJ(LDRAW_COLOUR), 're-picking from the shipped table moves a row (not a fixed point)');
  // an exception row exists only where the role's default is not listed for that part; an extension only where no base colour is
  for (const k of Object.keys(LDRAW_COLOUR).filter((x) => x.includes('/'))) {
    const [role, part] = k.split('/');
    ok(units.some((u) => u.role === role && u.part === part), `exception ${k} names a (role, part) nothing places (stale)`);
    ok(!B.isListed(part, LDRAW_COLOUR[role]), `exception ${k}: the role's colour ${LDRAW_COLOUR[role]} is already listed for ${part} (stale)`);
  }
  for (const u of units) if (EXTRA.includes(colourOf(LDRAW_COLOUR, u.role, u.part))) ok(BASE.every((c) => !B.isListed(u.part, c)), `${u.role}/${u.part} is in an extension colour though a base colour is listed`);
  ok(EXTRA.every((c) => units.some((u) => colourOf(LDRAW_COLOUR, u.role, u.part) === c)), 'an extension colour is declared and used by nothing');
  // the unofficial gears land in the only colours BrickLink lists them in
  ok(Object.keys(BRICKLINK.elements['7785']).join() === '15' && colourOf(LDRAW_COLOUR, 'detent', '7785') === 15, '7785 should be White (BrickLink lists White only)');
  ok(Object.keys(BRICKLINK.elements['7861']).join() === '71' && colourOf(LDRAW_COLOUR, 'spur', '7861') === 71, '7861 should be Light Bluish Gray (BrickLink lists that only)');
  for (const l of l26.filter((x) => x.part === '7785' || x.part === '7861')) ok(l.bricklink.listed && l.status === 'unofficial', `${l.part}: should print listed and flagged unofficial`);
  // CONTROLS. (1) 7785 forced to Orange is flagged by the unchanged flag path, and the gates see it
  const orange = { ...LDRAW_COLOUR, 'detent/7785': 25 };
  const bad = B.bomOf(B.buildOf(lib, 'technic_2026', 'keyless').build, lib, { colours: orange }).lines.find((l) => l.part === '7785');
  control('7785 forced to Orange is flagged "lists White" by the flag path', bad && !bad.bricklink.listed && bad.flags.some((f) => /^BrickLink lists no element for 7785 in Orange; it lists White/.test(f)));
  control('the unit gate fails on 7785 forced to Orange', unlistedUnits(units, orange, B.isListed).length === 1);
  control('the derivation gate fails on 7785 forced to Orange', sortJ(orange) !== sortJ(derived.table));
  const blue = { ...LDRAW_COLOUR, 'spur/69779': 71 };
  control('the unit gate fails on 69779 moved to Light Bluish Gray', unlistedUnits(units, blue, B.isListed).some((u) => u.part === '69779'));
  const oldTable = B.GENERATIONS.flatMap((g) => B.cellIds().map((c) => { const b = B.buildOf(lib, g, c).build; return b ? B.bomOf(b, lib, { colours: COLOUR_BASELINE_300 }).lines.filter((l) => !l.bricklink.listed).length : 0; })).reduce((a, b) => a + b, 0);
  control('the §300 table (baseline) has unlisted lines the gate would count', oldTable > 0);
  // (2) the solver refuses a part nothing lists, and picks no extension while a base colour lists it
  let threw = false; try { repickColours({ units, listed: (p, c) => B.isListed(p, c) && !(p === '7785'), base: BASE, extra: EXTRA, current: COLOUR_BASELINE_300 }); } catch (_) { threw = true; }
  control('the solver throws when no palette colour lists a part (7785 removed)', threw);
  const noExt = (() => { try { repickColours({ units, listed: B.isListed, base: BASE, extra: [], current: COLOUR_BASELINE_300 }); return false; } catch (_) { return true; } })();
  control('without the Dark Azure extension the solver finds no colour for 69779', noExt);
  const sample = all.technic_2026.find((c) => c.cell === 'alarm');
  const rows = B.parseCsv(B.bomCsv(sample, 'technic_2026')), head = rows[0], ci = head.indexOf('bricklink_listed');
  ok(ci > 0 && rows.slice(1, 1 + sample.bom.lines.length).every((r, i) => r[ci] === (sample.bom.lines[i].bricklink.listed ? 'yes' : 'no')), 'the CSV listed column differs from the BOM');
  // the mould variants BrickLink does not list resolve to their base item, and say so
  for (const [ld, bl] of [['3023b', '3023'], ['32123a', '4265c'], ['4032a', '4032'], ['4185a', '4185']]) {
    ok(BRICKLINK.parts[ld].number === bl && /^base/.test(BRICKLINK.parts[ld].via), `${ld} should be BrickLink's base item ${bl}`);
    const ln = lines('technic_2026').find((l) => l.part === ld);
    ok(!ln || ln.flags.some((f) => new RegExp(`sells the base item ${bl}`).test(f)), `${ld}: the base-item flag is missing`);
  }
  ok(BRICKLINK.parts['75924'].number === 'x127c20pb01', 'the string is BrickLink item x127c20pb01 (75924 an alternate number)');
  // CONTROL: a BOM line built against a subset with that element removed reads unlisted
  const cut = JSON.parse(JSON.stringify(BRICKLINK.elements)); delete cut['3647']['0'];
  control('(self-check) removing 3647 black from a copy of the elements leaves no listed element', !(cut['3647']['0']) && !!BRICKLINK.elements['3647']['0']);
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
console.log(`  ${roles.size} roles placed across both generations, every mode and every alarm state; LDRAW_COLOUR has ${Object.keys(LDRAW_COLOUR).length} rows (${Object.keys(LDRAW_COLOUR).filter((k) => k.includes('/')).length} of them per-part exceptions)`);
for (const r of roles.keys()) {
  const code = LDRAW_COLOUR[r]; // the role's default; an exception row `role/part` overrides it for one part
  ok(Number.isInteger(code) && code !== 16 && B.COLOUR_INFO[code], `role ${r} has colour ${code}: not a real LDraw code (16 is "the placer's colour")`);
}
for (const r of Object.keys(LDRAW_COLOUR)) ok(roles.has(r.split('/')[0]), `LDRAW_COLOUR names role ${r}, which no build places (stale)`);
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

// ── WANTED (BUILT §306) ────────────────────────────────────────────────────
// The BrickLink wanted-list XML, parsed back with the module's strict parser AND an
// independent regex read here, against the BOM: the lots are the BOM's (item, colour)
// multiset with quantities summed, every ITEMID and COLOR is the subset's, the tags
// are exactly the format's, and text is escaped.
console.log('\nWANTED (BrickLink XML)');
// the BOM's own (item, colour) -> qty, from the lines' LDraw ids through the SUBSET (not through l.bricklink)
const bomLots = (c) => { const m = new Map(); for (const l of c.bom.lines) { const bl = BRICKLINK.parts[l.part], k = `${bl?.number}|${BRICKLINK.colours[l.colour]?.id}`; m.set(k, (m.get(k) ?? 0) + l.qty); } return m; };
// an independent read: every <ITEM>…</ITEM>, each tag's text, nothing parsed by the module
const readXml = (text) => [...text.matchAll(/<ITEM>([\s\S]*?)<\/ITEM>/g)].map((m) => Object.fromEntries([...m[1].matchAll(/<([A-Z]+)>([^<]*)<\/\1>/g)].map((t) => [t[1], t[2]])));
const SUBSET_ITEMS = new Set(Object.values(BRICKLINK.parts).map((p) => p.number)), SUBSET_COLOURS = new Set(Object.values(BRICKLINK.colours).map((c) => String(c.id)));
const wantedHolds = (c, text) => {
  const bad = [], items = readXml(text), want = bomLots(c);
  if (!/^<INVENTORY>\n[\s\S]*\n<\/INVENTORY>\n$/.test(text)) bad.push('no INVENTORY root');
  if (/<\?xml|<!--|WANTEDLISTIDNAME/.test(text)) bad.push('a declaration, comment or name tag');
  const got = new Map();
  for (const it of items) {
    const keys = Object.keys(it).join();
    if (keys !== B.WANTED_TAGS.join()) bad.push(`tags ${keys}`);
    if (it.ITEMTYPE !== 'P' || it.NOTIFY !== 'N') bad.push(`ITEMTYPE ${it.ITEMTYPE} NOTIFY ${it.NOTIFY}`);
    if (!SUBSET_ITEMS.has(it.ITEMID)) bad.push(`ITEMID ${it.ITEMID} is not a BrickLink item of the subset`);
    if (!SUBSET_COLOURS.has(it.COLOR)) bad.push(`COLOR ${it.COLOR} is not a BrickLink colour of the subset`);
    if (!/^[1-9]\d*$/.test(it.MINQTY)) bad.push(`MINQTY ${it.MINQTY}`);
    const k = `${it.ITEMID}|${it.COLOR}`;
    if (got.has(k)) bad.push(`${k} twice (an unmerged lot)`);
    got.set(k, Number(it.MINQTY));
  }
  for (const [k, q] of want) if (got.get(k) !== q) bad.push(`${k}: BOM ${q}, XML ${got.get(k)}`);
  for (const k of got.keys()) if (!want.has(k)) bad.push(`${k}: not in the BOM`);
  const sum = [...got.values()].reduce((n, q) => n + q, 0);
  if (sum !== c.bom.total) bad.push(`MINQTY sums to ${sum}, the BOM to ${c.bom.total}`);
  return bad;
};
const lotCounts = [];
for (const gen of B.GENERATIONS) for (const c of all[gen]) {
  if (!c.bom) continue;
  for (const cond of ['X', 'N', 'U']) {
    const text = B.wantedListXml(c, gen, { condition: cond }), bad = wantedHolds(c, text);
    ok(bad.length === 0, `${gen} ${c.cell} (${cond}): ${bad.slice(0, 4).join('; ')}`);
    const parsed = B.parseWantedXml(text);
    ok(parsed.length === readXml(text).length && parsed.every((it) => it.CONDITION === cond), `${gen} ${c.cell}: the strict parser reads ${parsed.length} lots or a wrong condition`);
  }
  const w = B.wantedListOf(c);
  ok(w.total === c.bom.total && w.lots.every((t) => t.remarks.length <= 120 && t.ldraw.every((id) => t.remarks.includes(id))), `${gen} ${c.cell}: lot totals or remarks`);
  ok(w.merges.length === w.lots.filter((t) => t.ldraw.length > 1).length && c.bom.lines.length === w.lots.length + w.merges.reduce((n, m) => n + m.ldraw.length - 1, 0), `${gen} ${c.cell}: the merge report does not account for the lines`);
  lotCounts.push(`${gen.replace('technic_', '')} ${c.cell} ${w.lots.length} lots/${w.total}${w.merges.length ? ` MERGES ${w.merges.map((m) => m.ldraw.join('+')).join(',')}` : ''}`);
  // 22253 is bought as 6595: the XML must never carry an LDraw id BrickLink does not use
  for (const l of c.bom.lines) if (l.bricklink.item !== l.part) ok(!readXml(B.wantedListXml(c, gen)).some((it) => it.ITEMID === l.part), `${gen} ${c.cell}: the LDraw id ${l.part} stands as an ITEMID (BrickLink sells ${l.bricklink.item})`);
}
console.log(`  ${lotCounts.join('\n  ')}`);
ok(lotCounts.length === 2 * B.cellIds().length, `${lotCounts.length} wanted lists, expected ${2 * B.cellIds().length}`);
ok(B.WANTED_NOTE.includes(BRICKLINK.source.date) && /not checked against stock or prices/.test(B.WANTED_NOTE) && /Modelled, not built/.test(B.WANTED_NOTE) && !FORBIDDEN.test(B.WANTED_NOTE), 'the wanted-list note');
ok(/wantedListXml\(c, gen, \{ condition: sel\.value \}\)/.test(page) && /WANTED_NOTE/.test(page), 'technic.html does not offer the wanted list with its condition and note');
// escaping: every one of the five characters, through the writer and both readers
{
  const nasty = `a&b<c>d"e'f`;
  ok(B.xmlEscape(nasty) === 'a&amp;b&lt;c&gt;d&quot;e&apos;f' && B.xmlUnescape(B.xmlEscape(nasty)) === nasty && B.xmlUnescape('&amp;lt;') === '&lt;', 'XML escaping');
  const c = structuredClone(all.technic_2026.find((x) => x.cell === 'row-2'));
  c.bom.lines[0].roles = [nasty];
  const text = B.wantedListXml(c, 'technic_2026'), it = B.parseWantedXml(text)[0];
  ok(it.REMARKS.includes(nasty) && !text.includes(nasty) && wantedHolds(c, text).length === 0, `a role with & < > " ' does not survive the round trip: ${it.REMARKS}`);
}
// CONTROLS
{
  const c = all.technic_2026.find((x) => x.cell === 'row-2'), f = all.technic_2026.find((x) => x.cell === 'fusee');
  const any = all.technic_2026.find((x) => x.bom?.lines.some((l) => l.part === '22253')), text = B.wantedListXml(any, 'technic_2026');
  control('22253 written as its LDraw id instead of 6595 fails (not a subset item, BOM lot missing)', wantedHolds(any, text.replace('<ITEMID>6595</ITEMID>', '<ITEMID>22253</ITEMID>')).length > 0);
  control('(self-check) the build above places 22253 and the XML carries 6595', text.includes('<ITEMID>6595</ITEMID>') && !text.includes('<ITEMID>22253</ITEMID>'));
  const t2 = B.wantedListXml(c, 'technic_2026');
  control('a MINQTY changed fails', wantedHolds(c, t2.replace(/<MINQTY>(\d+)<\/MINQTY>/, (_, q) => `<MINQTY>${Number(q) + 1}</MINQTY>`)).length > 0);
  control('an ITEM dropped fails', wantedHolds(c, t2.replace(/<ITEM>[\s\S]*?<\/ITEM>\n/, '')).length > 0);
  control('a COLOR changed fails', wantedHolds(f, B.wantedListXml(f, 'technic_2026').replace(/<COLOR>\d+<\/COLOR>/, '<COLOR>999</COLOR>')).length > 0);
  control('an invented tag fails the format', wantedHolds(c, t2.replace('<INVENTORY>\n', '<INVENTORY>\n<WANTEDLISTIDNAME>x</WANTEDLISTIDNAME>\n')).length > 0 || (() => { try { B.parseWantedXml(t2.replace('<NOTIFY>', '<WANTEDLISTIDNAME>x</WANTEDLISTIDNAME><NOTIFY>')); return false; } catch { return true; } })());
  const refuses = (mut, re) => { const m = structuredClone(c); mut(m.bom.lines[0]); try { B.wantedListXml(m, 'technic_2026'); return false; } catch (e) { return re.test(e.message); } };
  control('an unlisted line (listed: false) refuses to export', refuses((l) => { l.bricklink.listed = false; }, /refused.*lists no element/));
  control('a line with no BrickLink item refuses to export', refuses((l) => { l.bricklink = null; }, /refused.*no BrickLink item/));
  control('a line with no BrickLink colour id refuses to export', refuses((l) => { l.bricklink.colourId = null; }, /refused.*no BrickLink colour id/));
  control('a condition other than N, U or X refuses', (() => { try { B.wantedListXml(c, 'technic_2026', { condition: 'Q' }); return false; } catch { return true; } })());
  // the merge path: a copy of a line under a mould-variant LDraw id that BrickLink sells as the same item
  const m = structuredClone(c), l0 = m.bom.lines[0];
  m.bom.lines.push({ ...structuredClone(l0), part: `${l0.part}x`, qty: 2 }); m.bom.total += 2;
  const w = B.wantedListOf(m);
  control('two lines of one (ITEMID, COLOR) merge into one lot, summed, and are reported', w.merges.length === 1 && w.lots.length === c.bom.lines.length && w.lots[0].qty === l0.qty + 2 && w.merges[0].ldraw.join() === `${l0.part},${l0.part}x`);
  control('the same two lines written unmerged fail the format', wantedHolds(m, B.wantedListXml(m, 'technic_2026').replace(/(<ITEM>[\s\S]*?<\/ITEM>\n)/, '$1$1')).length > 0);
}

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
  // (§312 L1 walks the parts list's own roster, cellIds(), not every registered cell: the clock cell is registered and
  // has no list yet; addBomDetails skips a cell that was not built)
  ok(/for \(const c of cellIds\(\)\) addBomDetails\(c, gen\)/.test(page) && /import \{[^}]*cellIds[^}]*\} from '\.\/src\/technic-bom\.js'/.test(page), 'technic.html does not give every built cell a parts list');
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
