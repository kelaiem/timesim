// BUILT §300 — THE VISUAL PARTS LIST: what to buy for each LEGO build on
// technic.html, in what quantity and colour. Pure: no three.js, no DOM, so the
// probe that holds it and the page that shows it read one module.
//
// WHAT A BILL OF MATERIALS IS HERE. `placedParts` (src/technic-ldraw.js) is the
// flat list of placements a build is; the BOM is that list FOLDED to a quantity
// per (LDraw id, colour code), with three honest changes:
//   · THE FUSEE'S CORD is 66 braided segments and two end studs in the placement
//     list (the drawing needs them) but ONE string to buy: they collapse to one
//     line, the string `cordChoice` picked, at the length it picked.
//   · A KEYLESS cell's BOM is read at every mode (wind, set, neutral) and must
//     agree: the ring only slides, so the part set cannot depend on the mode.
//   · THE COLOUR is the role's, from LDRAW_COLOUR (complete, a design choice).
//
// WHAT IT DOES NOT CLAIM. Every line is MODELLED, not built: the placements are
// checked against the part geometry (probe-technic-build.mjs), and nobody has
// assembled one. The forces behind the fusee, the alarm and the escapement are
// POSED. The rubber bands, the gong and a hand to turn the crown are not parts in
// the model and are listed as exactly that (NOT_IN_MODEL), with "unspecified"
// where the model has no number — never an invented count.
//
// THE PURCHASE ID IS NEVER READ FROM MEMORY. Each row of PART_TABLE carries a
// BASIS that says where its id came from, and `auditTable` re-derives every row
// from its sources so the table cannot drift from them:
//   bricklink      BrickLink's own catalogue download (Parts), subset-committed in
//                  src/technic-bricklink.js by tools/bricklink-subset.mjs: the item
//                  number the LDraw id is, or is an alternate number of (a mould-
//                  variant letter BrickLink does not list resolves to its base item,
//                  and the line says so). The official catalogue, as of its date;
//   catalogue      layout.js CATALOGUES, whose `part` column a person read off
//                  BrickLink's `Technic, Gear` category on 2026-09-12;
//   ldraw-keyword  the vendored LDraw file's own `0 !KEYWORDS BrickLink N`
//                  cross-reference (not checked against a catalogue here);
//   unverified     the LDraw id itself, used as the lookup key. A guess at a
//                  purchase id would be a number that looked right (rule 1).
// Precedence is that order. Since the owner's BrickLink download every placed id
// is a `bricklink` row; the other three stay so a part a later build places that
// BrickLink does not list is still shown as exactly what it is.
import { CATALOGUES, TECHNIC_FORK } from './layout.js';
import { BRICKLINK } from './technic-bricklink.js';
import { PART_IDS } from './technic-bom-ids.js';
import { walk } from './ldraw.js';
import { frameFork, frameKeyless } from './technic-frame.js';
import { ldrawBuild, placedParts, LDRAW_COLOUR } from './technic-ldraw.js';
import { colourOf } from './technic-colour.js';
import { substitutesFor, alternativeText, judgedText, sameItemWarnings, SUBSTITUTE_HONESTY } from './technic-substitutes.js';
import { TECHNIC_FUSEE_SPRING, solveFusee, frameFusee, fuseeBuild } from './technic-fusee.js';
import { frameAlarm, alarmStates, alarmBuild } from './technic-alarm.js';
import { frameEscapement, escapementBuild } from './technic-escapement.js';

export const GENERATIONS = ['technic_2026', 'technic_classic'];

// The fusee's cord is placed as these two roles and bought as one string.
export const CORD_ROLES = Object.freeze(['cord', 'cordEnd']);

// ---------------------------------------------------------------------------
// COLOURS. LDraw.org's colour definitions (LDConfig.ldr): the name and the
// display RGB of each code LDRAW_COLOUR may use (the base ten, and Dark Azure 321, the one
// extension, BUILT §303). NOT vendored with the pack and
// typed here from LDraw's published definitions, so it is a DISPLAY table (the
// picture's fill and the line's name). The PURCHASE colour is BrickLink's, read
// from the download by name (BRICKLINK.colours) and carried beside it on each line.
export const COLOUR_INFO = Object.freeze({
  0: { name: 'Black', hex: '#05131D' }, 1: { name: 'Blue', hex: '#0055BF' }, 2: { name: 'Green', hex: '#237841' },
  4: { name: 'Red', hex: '#C91A09' }, 14: { name: 'Yellow', hex: '#F2CD37' }, 15: { name: 'White', hex: '#FFFFFF' },
  19: { name: 'Tan', hex: '#E4CD9E' }, 25: { name: 'Orange', hex: '#FE8A18' },
  71: { name: 'Light Bluish Gray', hex: '#A0A5A9' }, 72: { name: 'Dark Bluish Gray', hex: '#6C6E68' },
  321: { name: 'Dark Azure', hex: '#469BC3' } });

// ---------------------------------------------------------------------------
// WHAT THE PACK SAYS ABOUT A PART: title, org status, aliasing and keywords,
// all READ from the vendored header. `3648` is a stub that says `~Moved to
// 3648b`, so its title and cross-references are the target's.
export function packInfo(lib, id) {
  const f = lib.get(`${id}.dat`);
  if (!f) return null;
  const moved = /^~Moved to\s+(\S+)/i.exec(f.title ?? '');
  const t = moved ? lib.get(`${moved[1].toLowerCase()}.dat`) : f;
  if (!t) return null;
  const org = t.org ?? f.org ?? '';
  const unofficial = /^Unofficial/i.test(org);
  const variant = !!moved || /^\d+[a-z]$/i.test(id);
  return { id, title: t.title, org, aliasOf: moved ? moved[1] : null, keywords: t.keywords ?? [],
    status: unofficial ? 'unofficial' : variant ? 'mould-variant' : 'official',
    updated: /UPDATE\s+(\d{4}-\d{2})/.exec(org)?.[1] ?? null };
}

// A cross-reference the header carries that names a plain catalogue part ("BrickLink
// 3023"); a printed or assembled variant ("x127c20pb01") is not this part and is skipped.
const PLAIN_ID = /^\d+[a-z]?$/i;
export function keywordRefs(info) {
  const out = {};
  for (const k of info?.keywords ?? []) {
    const m = /^(BrickLink|Rebrickable)\s+(\S+)$/i.exec(k);
    if (m && PLAIN_ID.test(m[2])) out[m[1].toLowerCase()] ??= m[2];
  }
  return out;
}

// ---------------------------------------------------------------------------
// PART_TABLE — the one hand-maintained table: LDraw id -> the purchase id and
// WHERE IT CAME FROM. `auditTable` fails a row whose basis its source no longer
// supports and a row whose id a source has since improved.
export const SOURCES = Object.freeze({
  bricklink: { text: `BrickLink catalogue download (Parts, Colors, Codes), downloaded by the owner ${BRICKLINK.source.date}`, date: BRICKLINK.source.date },
  catalogue: { text: "layout.js CATALOGUES (BrickLink 'Technic, Gear', read by a person)", date: '2026-09-12' },
  'ldraw-keyword': { text: "the LDraw file's own !KEYWORDS cross-reference (not checked against a catalogue)", date: null },
  unverified: { text: 'the LDraw id used as the lookup key; purchase id not yet verified', date: null },
});
const row = (purchase, basis) => Object.freeze({ purchase, basis });
// One row per placed LDraw id, written from the BrickLink subset where it has the id (all
// of them today) and from the older bases otherwise. The ids are PART_IDS, which the
// probe holds equal to what the builds place.
export const PART_TABLE = Object.freeze(Object.fromEntries(PART_IDS.map((id) => [id, bricklinkRow(id) ?? olderRow(id)])));
function bricklinkRow(id) { const b = BRICKLINK.parts[id]; return b ? row(b.number, 'bricklink') : null; }
function olderRow(id) {
  const cat = Object.values(CATALOGUES).filter(Boolean).flatMap((c) => c.counts).find((c) => c.part === id);
  return cat ? row(cat.part, 'catalogue') : row(id, 'unverified');   // a keyword row needs the pack: deriveRow
}

// What the sources say a row's basis and purchase id should be, derived afresh.
export function deriveRow(lib, id) {
  const bl = BRICKLINK.parts[id];
  if (bl) return { purchase: bl.number, basis: 'bricklink' };
  const info = packInfo(lib, id);
  const cat = Object.values(CATALOGUES).filter(Boolean).flatMap((c) => c.counts).find((c) => c.part === id);
  if (cat) return { purchase: cat.part, basis: 'catalogue' };
  const kw = keywordRefs(info).bricklink;
  if (kw) return { purchase: kw, basis: 'ldraw-keyword' };
  return { purchase: id, basis: 'unverified' };
}

// The table held to its ids and its sources. `ids` are the LDraw ids a build
// places (the string included). Returns the failures as strings; empty is clean.
export function auditTable(table, ids, lib) {
  const bad = [], seen = new Set(ids);
  for (const id of seen) {
    const r = table[id], info = packInfo(lib, id);
    if (!info) { bad.push(`${id}: not in the vendored pack`); continue; }
    if (!r) { bad.push(`${id}: placed but has no PART_TABLE row`); continue; }
    if (!SOURCES[r.basis]) { bad.push(`${id}: basis ${r.basis} has no source`); continue; }
    const d = deriveRow(lib, id);
    if (r.basis !== 'person' && (r.basis !== d.basis || r.purchase !== d.purchase))
      bad.push(`${id}: the table says ${r.purchase} (${r.basis}), the sources say ${d.purchase} (${d.basis})`);
    if (!info.title) bad.push(`${id}: the pack header has no title`);
  }
  for (const id of Object.keys(table)) if (!seen.has(id)) bad.push(`${id}: a row no build places (stale)`);
  return bad;
}

// ---------------------------------------------------------------------------
// WHAT IS NOT IN THE MODEL. Never a count the model does not hold.
export const NOT_IN_MODEL = Object.freeze({
  row: [{ item: 'a hand to turn the first axle', quantity: 'not a part', why: 'the model places no drive; the build is turned by hand' }],
  keyless: [
    { item: 'rubber band for the detent follower', quantity: 'unspecified', why: 'the band that holds the follower on its wheel is drawn posed; its count, length and force are not in the model' },
    { item: 'a hand to turn the crown', quantity: 'not a part', why: 'the crown is a part; the person turning it is not' },
    { item: 'minute and hour hands', quantity: 'none placed', why: 'the motion train turns the hour wheel and the minute axle; no hand part is placed on either' }],
  fusee: [
    { item: 'rubber bands (the barrel\'s band and the maintaining band to the great wheel)', quantity: 'unspecified', why: 'the spring law is POSED and a band can only be measured; count and size are not in the model' },
    { item: 'a hand to turn the winding crank', quantity: 'not a part', why: 'the wind is turned by the person; no crank handle is placed' }],
  alarm: [
    { item: 'rubber bands (the column wheel\'s detent and the strike barrel)', quantity: 'unspecified', why: 'bands are posed in the model; count, size and force are not in it' },
    { item: 'a gong', quantity: 'not a part', why: 'no LEGO part rings; the hammer strikes a tile, which is in the list' },
    { item: 'a finger on the pusher\'s button', quantity: 'not a part', why: 'the press is a person\'s' }],
  escapement: [
    { item: 'a hand to start the balance swinging', quantity: 'not a part', why: 'nothing drives this build; its swing is posed inside the range the parts allow' }],
});

// The text that travels with every list. Its words are held by the probe: it may
// not say the build works, was tested, or was simulated.
export const HONESTY = Object.freeze({
  modelled: 'Modelled, not built. These placements are checked against the part geometry (seated, through, meshed). No one has assembled this model and it has not been run.',
  posed: 'The forces are posed: the spring law, every rubber band, the cadence, the strikes per wind and the masses are stand-ins that only a built model could measure.',
  analogue: 'The escapement is an analogue (a recoil anchor and a knife-edge balance), a different escapement from the Swiss lever; the alarm\'s fly is not the steel anchor.',
  unverified: 'A purchase id marked unverified is the LDraw id used as a lookup key and has not been checked against a catalogue.',
  unofficial: 'A part marked unofficial is not yet in the official LDraw library; technic_classic lists none.',
  colour: 'Colours are this page\'s choice by role (an LDraw colour code), re-picked so that BrickLink lists an element for every line. BrickLink\'s colour id is matched by name, and a line would say if BrickLink listed no element for that part in that colour.',
  attribution: 'Part geometry: LDraw.org library, CC BY 4.0 (some files CC BY 2.0 and 4.0). LEGO is a trademark of the LEGO Group, which does not sponsor or endorse this page.',
});
// which honesty lines a list carries (the analogue line only where it is about that build)
export const honestyFor = (kind, lines) => [HONESTY.modelled, ...(['fusee', 'alarm', 'escapement'].includes(kind) ? [HONESTY.posed] : []),
  ...(['alarm', 'escapement'].includes(kind) ? [HONESTY.analogue] : []),
  ...(lines.some((l) => l.status === 'unofficial') ? [HONESTY.unofficial] : []),
  ...(lines.some((l) => l.purchase.basis === 'unverified') ? [HONESTY.unverified] : []),
  HONESTY.colour, ...(lines.some((l) => l.substitutes?.candidates) ? [SUBSTITUTE_HONESTY] : []), HONESTY.attribution];

// ---------------------------------------------------------------------------
// THE FOLD. Placements to quantity per (id, colour). The colour is the role's;
// a role with no row is an error (the .ldr would have drawn it as 16, "the
// placer's colour"), never a default. The cord's placements are dropped and the
// chosen string is added once.
export function foldParts(parts, { string = null, colours = LDRAW_COLOUR } = {}) {
  const lines = new Map();
  let cordPlacements = 0;
  for (const p of parts) {
    if (CORD_ROLES.includes(p.role)) { cordPlacements++; continue; }
    const colour = colourOf(colours, p.role, p.part);
    if (colour === undefined) throw new Error(`technic-bom: role ${p.role} (part ${p.part}) has no colour in LDRAW_COLOUR`);
    const k = `${p.part}|${colour}`;
    const l = lines.get(k) ?? { part: p.part, colour, qty: 0, roles: new Set() };
    l.qty++; l.roles.add(p.role); lines.set(k, l);
  }
  if (cordPlacements && !string) throw new Error('technic-bom: the build places a cord and carries no chosen string');
  if (!cordPlacements && string) throw new Error('technic-bom: a string was chosen and the build places no cord');
  if (string) lines.set(`${string.part}|${colours.cord}`, { part: string.part, colour: colours.cord, qty: 1, roles: new Set(['cord']), string });
  return { lines: [...lines.values()].map((l) => ({ ...l, roles: [...l.roles].sort() })).sort((a, b) => cmpId(a.part, b.part) || a.colour - b.colour),
    cordPlacements };
}
const cmpId = (a, b) => (parseInt(a, 10) - parseInt(b, 10)) || (a < b ? -1 : a > b ? 1 : 0);

// A build's BOM: its modes folded separately (they must agree), the first one's
// lines enriched from the pack and the table.
export function bomOf(build, lib, { table = PART_TABLE, colours = LDRAW_COLOUR, cell = null } = {}) {
  const modes = build.modes?.length ? build.modes : [undefined];
  const string = build.cord?.string ?? null;
  const per = modes.map((m) => ({ mode: m, placements: placedParts(build, 0, m).length, ...foldParts(placedParts(build, 0, m), { string, colours }) }));
  const sig = (f) => f.lines.map((l) => `${l.part}|${l.colour}|${l.qty}`).join(',');
  const modesAgree = per.every((f) => sig(f) === sig(per[0]));
  const base = per[0];
  const lines = base.lines.map((l) => describeLine(l, lib, table, cell));
  const total = lines.reduce((n, l) => n + l.qty, 0);
  return { key: build.key, gen: build.gen, modes: modes.filter(Boolean), modesAgree, placements: base.placements, cordPlacements: base.cordPlacements,
    total, lines, perMode: per.map((f) => ({ mode: f.mode, placements: f.placements, total: f.lines.reduce((n, l) => n + l.qty, 0) })),
    string: string && { part: string.part, studs: string.studs, lengthMm: string.length, deadMm: string.dead },
    colours: [...new Set(lines.map((l) => l.colour))].sort((a, b) => a - b) };
}

function describeLine(l, lib, table, cell = null) {
  const info = packInfo(lib, l.part), r = table[l.part], src = r && SOURCES[r.basis];
  const purchase = { id: r?.purchase ?? l.part, basis: r?.basis ?? 'unverified', source: src?.text ?? SOURCES.unverified.text,
    date: r?.basis === 'bricklink' ? SOURCES.bricklink.date : r?.basis === 'catalogue' ? SOURCES.catalogue.date : r?.basis === 'ldraw-keyword' ? (info?.updated ?? null) : null,
    differs: !!r && r.purchase !== l.part };
  const only2026 = CATALOGUES.technic_2026.counts.some((c) => c.part === l.part) && !CATALOGUES.technic_classic.counts.some((c) => c.part === l.part);
  const bl = BRICKLINK.parts[l.part], blc = BRICKLINK.colours[l.colour];
  const els = bl ? (BRICKLINK.elements[bl.number] ?? {}) : {};
  const elements = els[l.colour] ?? [];
  const listedIn = Object.keys(els).map((c) => BRICKLINK.colours[c]?.name).filter(Boolean);
  const bricklink = bl && { item: bl.number, name: bl.name, category: bl.category, via: bl.via, colourId: blc?.id ?? null, colour: blc?.name ?? null,
    elements, listed: elements.length > 0, listedIn };
  const flags = [];
  if (bricklink && bricklink.via.startsWith('base')) flags.push(`BrickLink does not list ${l.part}; it sells the base item ${bl.number}`);
  if (bricklink && !bricklink.listed) flags.push(`BrickLink lists no element for ${bl.number} in ${blc?.name ?? 'this colour'}${listedIn.length ? `; it lists ${listedIn.join(', ')} (of the colours used here)` : ' in any of the colours used here'}`);
  if (info?.status === 'unofficial') flags.push(`unofficial: not yet in the official LDraw library${only2026 ? '; a gear of the 2026 catalogue only (technic_2026)' : ''}`);
  if (info?.status === 'mould-variant') flags.push(info.aliasOf ? `mould variant: ${l.part} is an alias of ${info.aliasOf}` : 'mould variant: the purchase id may differ from the LDraw id');
  if (purchase.basis === 'unverified') flags.push('purchase id not yet verified');
  if (purchase.basis === 'ldraw-keyword') flags.push(`purchase id from the LDraw header${purchase.differs ? ` (${purchase.id}, not ${l.part})` : ''}, not checked against a catalogue`);
  // BUILT §309: the substitutes Rebrickable offers for this part, as the model judged them
  const substitutes = substitutesFor(l.part, l.colour, cell);
  flags.push(...sameItemWarnings(substitutes));
  if (l.string) flags.push(`one string of ${l.string.studs} studs, ${l.string.length} mm between the end studs, of which ${l.string.dead.toFixed(1)} mm lies dead on the barrel`);
  return { ...l, title: info?.title ?? null, org: info?.org ?? null, status: info?.status ?? null, aliasOf: info?.aliasOf ?? null,
    colourName: COLOUR_INFO[l.colour]?.name ?? null, hex: COLOUR_INFO[l.colour]?.hex ?? null, purchase, bricklink, only2026, flags,
    substitutes, alternatives: substitutes.passed.map((s) => alternativeText(s, l)), alternativesJudged: judgedText(substitutes) };
}

// ---------------------------------------------------------------------------
// THE BUILDS. Every cell technic.html shows, by its carousel id, per generation.
// The fusee, alarm and escapement are the same build in both generations. Each is
// built ONCE per pack and kept, lazily: the keyless cell's build alone is ~8 s in
// Node (its detent survey), so the page SEEDS the memo with the builds it already
// made (`seedBuild`) and builds only the cell and generation a reader asks for.
// A seeded build must be what `buildOf` would make: the same functions, the same
// arguments (probe-technic-bom.mjs holds the page's seeds to that).
export const cellIds = () => [...TECHNIC_FORK.rows.map((_, k) => `row-${k + 1}`), 'keyless', 'fusee', 'alarm', 'escapement'];
const CELL_TITLES = { keyless: 'keyless works', fusee: 'fusee and maintaining power', alarm: 'alarm', escapement: 'escapement and balance' };
const kindOf = (cell) => (cell.startsWith('row-') ? 'row' : cell);
const memo = new WeakMap();
const memoOf = (lib) => (memo.has(lib) ? memo.get(lib) : (memo.set(lib, new Map()), memo.get(lib)));
const memoKey = (gen, cell) => (['fusee', 'alarm', 'escapement'].includes(cell) ? `shared|${cell}` : `${gen}|${cell}`);
export function seedBuild(lib, gen, cell, build) { memoOf(lib).set(memoKey(gen, cell), build); }
export function buildOf(lib, gen, cell) {
  const m = memoOf(lib), key = memoKey(gen, cell);
  const title = cell.startsWith('row-') ? `${cell.slice(4)}. ${TECHNIC_FORK.rows[Number(cell.slice(4)) - 1]?.key ?? 'row'}` : CELL_TITLES[cell];
  const out = (build, reason = null) => ({ cell, kind: kindOf(cell), title, build, reason });
  if (m.has(key)) return out(m.get(key));
  let build = null, reason = null;
  if (cell.startsWith('row-')) { const f = frameFork(gen)[Number(cell.slice(4)) - 1]; build = f?.framed ? ldrawBuild(f, lib) : null; reason = f?.framed ? null : (f?.reason ?? 'no frame'); }
  else if (cell === 'keyless') { const f = frameKeyless(gen); build = f.framed ? ldrawBuild(f, lib) : null; reason = f.framed ? null : f.reason; }
  else if (cell === 'fusee') { const run = solveFusee(TECHNIC_FUSEE_SPRING).best, f = run && frameFusee(); build = f && f.framed ? fuseeBuild(f, lib, { run }) : null; reason = build ? null : 'not framed'; }
  else if (cell === 'alarm') { const f = frameAlarm(); build = f.framed ? alarmBuild(f, lib, alarmStates(lib, f).armed) : null; reason = build ? null : 'not framed'; }
  else if (cell === 'escapement') { const f = frameEscapement(); build = f.framed ? escapementBuild(f, lib) : null; reason = build ? null : 'not framed'; }
  else throw new Error(`technic-bom: no cell ${cell}`);
  if (build) m.set(key, build);
  return out(build, reason);
}
// one cell's BOM for one generation (null build -> bom null, with the reason)
export function bomForCell(lib, gen, cell, { table = PART_TABLE } = {}) {
  const c = buildOf(lib, gen, cell);
  return { cell: c.cell, kind: c.kind, title: c.title, reason: c.reason, bom: c.build ? bomOf(c.build, lib, { table, cell: c.cell }) : null };
}
// Every BOM for both generations (the probe's; the page asks per cell).
export function allBoms(lib, { table = PART_TABLE } = {}) {
  const out = {};
  for (const gen of GENERATIONS) out[gen] = cellIds().map((cell) => bomForCell(lib, gen, cell, { table }));
  return out;
}

// Does BrickLink list an element for this LDraw part in this LDraw colour code? A part
// BrickLink has no row for (the cord's pieces, bought as one string) constrains nothing.
export const isListed = (part, code) => { const bl = BRICKLINK.parts[part]; return !bl || (BRICKLINK.elements[bl.number]?.[code] ?? []).length > 0; };

// Every (role, part) any build places, with the builds it is placed in: both
// generations, every cell, every keyless mode, every alarm state. The cord's
// pieces are bought as ONE string (CORD_ROLES), so the cord role's unit is the
// string (cordChoice's pick, `build.cord.string.part`) and the cord end's is the end stud,
// which no BOM line carries.
export function colourUnits(lib) {
  const units = new Map();
  const see = (parts, tag, string = null) => { for (const p of parts) {
    const part = p.role === 'cord' && string ? string.part : p.part, k = `${p.role}/${part}`;
    const u = units.get(k) ?? { role: p.role, part, builds: new Set() };
    u.builds.add(tag); units.set(k, u); } };
  for (const gen of GENERATIONS) for (const cell of cellIds()) {
    const build = buildOf(lib, gen, cell).build;
    if (!build) continue;
    for (const m of build.modes?.length ? build.modes : [undefined]) see(placedParts(build, 0, m), `${gen}:${cell}`, build.cord?.string ?? null);
    if (cell === 'alarm') { const af = frameAlarm(), st = alarmStates(lib, af); for (const mode of ['armed', 'ringing', 'off']) see(placedParts(alarmBuild(af, lib, st[mode])), `${gen}:alarm`); }
  }
  return [...units.values()].map((u) => ({ ...u, builds: [...u.builds].sort() })).sort((a, b) => (a.role < b.role ? -1 : a.role > b.role ? 1 : a.part < b.part ? -1 : a.part > b.part ? 1 : 0));
}

// the union of LDraw ids a set of BOMs places (the string's included)
export const idsOf = (all) => [...new Set(Object.values(all).flatMap((cells) => cells.flatMap((c) => c.bom ? c.bom.lines.map((l) => l.part) : [])))];

// ---------------------------------------------------------------------------
// CSV. RFC 4180: a field with a comma, quote or newline is quoted and its
// quotes doubled. The parts table first, then a blank line and the notes, so
// the honesty text travels with the file.
export const CSV_COLUMNS = ['build', 'generation', 'ldraw_id', 'title', 'colour_code', 'colour', 'quantity', 'purchase_id', 'purchase_id_basis', 'bricklink_colour_id', 'bricklink_colour', 'bricklink_listed', 'bricklink_elements', 'part_status', 'flags', 'alternatives', 'alternatives_judged'];
const csvField = (v) => { const s = v === null || v === undefined ? '' : String(v); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export function bomCsv(cell, gen) {
  const b = cell.bom, out = [CSV_COLUMNS.join(',')];
  for (const l of b.lines)
    out.push([cell.title, gen, l.part, l.title, l.colour, l.colourName, l.qty, l.purchase.id, l.purchase.basis, l.bricklink?.colourId, l.bricklink?.colour, l.bricklink ? (l.bricklink.listed ? 'yes' : 'no') : '', l.bricklink?.elements.join(' '), l.status ?? 'string', l.flags.join('; '), l.alternatives.join(' | '), l.alternativesJudged].map(csvField).join(','));
  out.push('', ['kind', 'text'].join(','));
  out.push(['total', `${b.total} physical parts in ${b.lines.length} lines (${b.placements} placements${b.cordPlacements ? `, of which ${b.cordPlacements} are the cord's pieces, bought as one string` : ''})`].map(csvField).join(','));
  for (const n of NOT_IN_MODEL[cell.kind]) out.push(['not in the model', `${n.item}: ${n.quantity}. ${n.why}`].map(csvField).join(','));
  for (const h of honestyFor(cell.kind, b.lines)) out.push(['note', h].map(csvField).join(','));
  return out.join('\r\n') + '\r\n';
}
// the inverse, for a probe: rows of fields
export function parseCsv(text) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows;
}

// ---------------------------------------------------------------------------
// BUILT §306 — THE BRICKLINK WANTED LIST: one XML file per build that BrickLink's
// "Wanted > Upload > BrickLink XML" takes, so a builder can put a whole build on a
// wanted list in one step.
//
// THE FORMAT, AND WHERE IT IS FROM. BrickLink's wanted-list upload format as it is
// published on BrickLink's help pages and as known to the author; bricklink.com
// could NOT be reached from the sandbox that wrote this (it answers a bot check), so
// the element set was not re-read on the day and is kept to the minimum that format
// documents. Root `<INVENTORY>`, one `<ITEM>` per wanted lot, and inside it, in this
// order and no other tag:
//   ITEMTYPE   P (a part; the string, x127c20pb01, is a Parts item too)
//   ITEMID     BrickLink's item number, read from the subset (`line.bricklink.item`,
//              src/technic-bricklink.js, generated from the catalogue download) —
//              never the LDraw id unless the two are the same (22253 is bought as 6595)
//   COLOR      BrickLink's colour id from the subset (`line.bricklink.colourId`)
//   MINQTY     the line's quantity
//   CONDITION  N (new), U (used) or X (any; BrickLink's own default) — the page's choice
//   REMARKS    short: the LDraw id(s) and the roles, so a lot can be traced back (the
//              string's lot adds the model's stud count: BrickLink sells two lengths
//              under its one item, BUILT §301)
//   NOTIFY     N (no e-mail when a lot is listed)
// No `<?xml?>` declaration, no comment, no wanted-list name tag: the upload names the
// list on BrickLink's form, and a tag the format does not have is a guess.
//
// TWO LINES, ONE LOT. A BOM line is an (LDraw id, colour); BrickLink's lot is an
// (item, colour). Two LDraw ids that BrickLink sells as one item (a mould-variant
// letter BrickLink does not list resolves to its base item, BUILT §301) in the same
// colour are ONE lot, their quantities summed; `wantedListOf` reports every merge.
//
// IT REFUSES rather than guesses: a line with no BrickLink item, no BrickLink colour
// id, or no element BrickLink lists in that colour (none since BUILT §303) throws,
// naming the line. MODELLED, not built: the list is generated from the model and the
// catalogue download; it says nothing about stock or prices.
export const WANTED_CONDITIONS = Object.freeze({ X: 'any', N: 'new', U: 'used' });
export const WANTED_TAGS = Object.freeze(['ITEMTYPE', 'ITEMID', 'COLOR', 'MINQTY', 'CONDITION', 'REMARKS', 'NOTIFY']);
export const WANTED_NOTE = `This wanted list is generated from the model and BrickLink's catalogue download of ${BRICKLINK.source.date}; it is not checked against stock or prices. Modelled, not built.`;
export const xmlEscape = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
export const xmlUnescape = (s) => s.replace(/&(lt|gt|quot|apos|amp);/g, (_, e) => ({ lt: '<', gt: '>', quot: '"', apos: "'", amp: '&' })[e]);

// The lots of one cell's BOM, in BOM order (a merged lot stands where its first line
// stood), and the merges. Throws on any line BrickLink cannot be asked for.
export function wantedListOf(cell) {
  const b = cell?.bom;
  if (!b) throw new Error(`technic-bom: wanted list for ${cell?.cell}: no parts list (${cell?.reason ?? 'not framed'})`);
  const lots = new Map();
  for (const l of b.lines) {
    const bl = l.bricklink, at = `${cell.cell}: line ${l.part} in ${l.colourName ?? l.colour}`;
    if (!bl || !bl.item) throw new Error(`technic-bom: wanted list refused — ${at} has no BrickLink item`);
    if (bl.colourId === null || bl.colourId === undefined) throw new Error(`technic-bom: wanted list refused — ${at} has no BrickLink colour id`);
    if (!bl.listed) throw new Error(`technic-bom: wanted list refused — ${at}: BrickLink lists no element for ${bl.item} in ${bl.colour ?? 'that colour'}`);
    if (!(Number.isInteger(l.qty) && l.qty > 0)) throw new Error(`technic-bom: wanted list refused — ${at} has quantity ${l.qty}`);
    const k = `${bl.item}|${bl.colourId}`;
    const lot = lots.get(k) ?? { itemId: bl.item, colorId: bl.colourId, colour: bl.colour, qty: 0, ldraw: [], roles: new Set(), string: null };
    lot.qty += l.qty; lot.ldraw.push(l.part); for (const r of l.roles) lot.roles.add(r);
    if (l.string) lot.string = l.string;
    lots.set(k, lot);
  }
  const out = [...lots.values()].map((t) => ({ ...t, roles: [...t.roles].sort(),
    // the string: BrickLink lists the 20L and 21L under one item (BUILT §301), so the lot says the model's length
    remarks: `LDraw ${t.ldraw.join(' + ')} (${[...t.roles].sort().join(', ')})${t.string ? `; the model's string is ${t.string.studs} studs, check the variant` : ''}` }));
  return { lots: out, merges: out.filter((t) => t.ldraw.length > 1).map((t) => ({ itemId: t.itemId, colorId: t.colorId, ldraw: t.ldraw, qty: t.qty })),
    total: out.reduce((n, t) => n + t.qty, 0) };
}
export function wantedListXml(cell, gen, { condition = 'X' } = {}) {
  if (!WANTED_CONDITIONS[condition]) throw new Error(`technic-bom: wanted list condition ${condition} is not N, U or X`);
  const { lots } = wantedListOf(cell);
  const tag = (t, v) => `<${t}>${xmlEscape(v)}</${t}>`;
  const items = lots.map((t) => ['<ITEM>', tag('ITEMTYPE', 'P'), tag('ITEMID', t.itemId), tag('COLOR', t.colorId), tag('MINQTY', t.qty),
    tag('CONDITION', condition), tag('REMARKS', t.remarks), tag('NOTIFY', 'N'), '</ITEM>'].join(''));
  return ['<INVENTORY>', ...items, '</INVENTORY>'].join('\n') + '\n';
}
// the inverse, for the probe and the smoke: the root and every ITEM's tags, unescaped.
// Strict: anything outside a known tag, an unknown tag, or a tag twice in one ITEM throws.
export function parseWantedXml(text) {
  const m = /^\s*<INVENTORY>([\s\S]*)<\/INVENTORY>\s*$/.exec(text);
  if (!m) throw new Error('wanted XML: no <INVENTORY> root');
  const items = [], rest = m[1].replace(/<ITEM>([\s\S]*?)<\/ITEM>/g, (_, body) => {
    const it = {}, left = body.replace(/<([A-Z]+)>([^<]*)<\/\1>/g, (__, t, v) => {
      if (!WANTED_TAGS.includes(t)) throw new Error(`wanted XML: unknown tag <${t}>`);
      if (t in it) throw new Error(`wanted XML: <${t}> twice in one ITEM`);
      it[t] = xmlUnescape(v); return ''; });
    if (left.trim()) throw new Error(`wanted XML: stray text in an ITEM: ${left.trim().slice(0, 40)}`);
    items.push(it); return '';
  });
  if (rest.trim()) throw new Error(`wanted XML: stray text under INVENTORY: ${rest.trim().slice(0, 40)}`);
  return items;
}

// ---------------------------------------------------------------------------
// THE PICTURE'S CAMERA, pure so the renderer and the probe read one law. An
// isometric view from the front, right and above in LDraw's frame (+Y DOWN, so
// "above" is −Y): azimuth 45° about the vertical, elevation 30° — the corner
// view LDraw tools default to. The view plane is spanned by RIGHT and UP;
// `viewBounds` projects a part's surface (triangles only: an edge lies on one)
// onto it, and the image is fitted to that box with PICTURE_PAD around, so the
// silhouette's aspect in the picture IS the box's (the smoke holds it).
export const PICTURE_AZ_DEG = 45, PICTURE_EL_DEG = 30, PICTURE_PAD = 0.12;
export function viewBasis() {
  const az = PICTURE_AZ_DEG * Math.PI / 180, el = PICTURE_EL_DEG * Math.PI / 180;
  const eye = [Math.sin(az) * Math.cos(el), -Math.sin(el), -Math.cos(az) * Math.cos(el)];   // unit, from the part to the camera
  const up0 = [0, -1, 0], f = eye.map((v) => -v);
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a) => { const n = Math.hypot(...a); return a.map((v) => v / n); };
  const right = norm(cross(f, up0)), up = cross(right, f);
  return { eye, right, up, forward: f };
}
export function viewBounds(lib, id) {
  const { right, up } = viewBasis();
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  walk(lib, `${id}.dat`, (kind, pts) => {
    if (kind !== 'tri') return;
    for (const p of pts) {
      const x = p[0] * right[0] + p[1] * right[1] + p[2] * right[2], y = p[0] * up[0] + p[1] * up[1] + p[2] * up[2];
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
  });
  const w = x1 - x0, h = y1 - y0;
  return { x0, x1, y0, y1, w, h, aspect: w / h, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, half: Math.max(w, h) / 2 * (1 + PICTURE_PAD) };
}
