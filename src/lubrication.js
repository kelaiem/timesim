// §247 TIER ONE — THE LUBRICATION MAP. Which joints are oiled, greased, run dry,
// or are friction couplings whose torque the lubricant SETS, declared one row per
// JOINT and audited against the movement's own graph.
//
// THE POPULATION IS NOT TYPED HERE. It is read off MECH_GRAPH (inspect.js), the
// one place the movement already declares what turns, what it turns on and what it
// drives:
//   · a BEARING joint for every unit that takes part in a drive edge and stands on
//     a support (a pivot, a bore, a clamp — whatever carries it): key
//     `<unit> :: bearing`;
//   · a CONTACT joint for every drive edge `A > B`: a tooth mesh, a lever's tip on
//     its mate, a coupling, a ribbon in its drum: key `A > B`.
// A force SOURCE (the mainspring, the crown) is not a unit and has no bearing; the
// edge it starts is still a contact. Add a part to the graph and it owes this table
// a row — which is how `restoring` finds a reciprocating part nobody gave a spring.
//
// A LUBRICANT IS A CLAIM ABOUT SERVICE, NOT A MEASUREMENT (§48's covenant). Nothing
// in the model can confirm that oil sits where a row says; what the audit holds is
// everything it CAN hold: every joint answered, every answer well-formed, every
// answer naming a part that still exists, every coefficient the energy column prices
// a joint with agreeing with the regime that joint is declared in, and an oil row
// with no oil sink waived against a filed item.
//
// THE ARRIVAL INVENTORY. The movement has 115 joints and the first landing answers
// the ones the roadmap's seed table and the energy column already commit to.
// LUBRICATION_DEBT lists the rest by key, and it is CLOSED in the
// UNDECLARED_CLEARANCE_DEBT sense: a joint outside both tables fails, a key that
// has been answered while still listed fails (the fix deletes its entry), and no
// entry may be added by a later change. It shrinks; it never grows.
import { FRICTION } from './layout.js';

export const LUBRICATION_REGIMES = Object.freeze(['dry', 'oil-fine', 'oil-medium', 'grease', 'escapement', 'friction']);

// What the six regimes mean (a watchmaker's oiling chart). `priced` names the
// FRICTION rows (layout.js) the energy column may price a joint of that regime
// with, so the map and the budget cannot disagree: a row that says `mu: 'muJewel'`
// (polished steel in OILED ruby) while declared `dry` is a contradiction the audit
// fails. A regime with an empty list is not priced by a coefficient at all.
export const REGIME_INFO = Object.freeze({
  'dry':        { priced: ['muTooth'],             what: 'no lubricant by design; oiling it would collect abrasive, stick a spring, or defeat a brake' },
  'oil-fine':   { priced: ['muJewel', 'muChain'],  what: '9010-class: fast, light pivots, and a chain\'s rivets oiled sparingly' },
  'oil-medium': { priced: ['muPlain', 'muJewel'],  what: 'HP1300/8030-class: slow, loaded pivots and plain bushes' },
  'grease':     { priced: ['springInt'],           what: '9504-class: keyless and sliding steel, and the mainspring (coil-on-coil hysteresis)' },
  'escapement': { priced: [],                      what: '9415-class: the pallet faces only, the one tooth contact that is oiled' },
  'friction':   { priced: [],                      what: 'a slip coupling whose torque the lubricant SETS; it must cite the slip-torque derivation' },
});

// The oil sinks a bearing may name. 'none' is a FINDING, not an answer: an oil
// regime on a bearing with no sink is malformed unless it is waived (below) against
// the item that owns the missing part.
export const OIL_SINKS = Object.freeze(['chaton', 'cap-jewel', 'collar-cup', 'plain-bush', 'none']);

const L = (regime, why, extra = {}) => Object.freeze({ regime, why, ...extra });

// ONE ROW PER ANSWERED JOINT. `why` is the service claim in a sentence; `src` says
// where the claim comes from (the roadmap's seed table, or a derivation here);
// `mu` names the FRICTION row the energy column prices the joint with, where it
// does; `epilame` marks surfaces treated so the oil stays put; `sink` names the oil
// sink of an oiled bearing; `cites` is a friction row's slip-torque derivation.
export const LUBRICATION = Object.freeze({
  // ---- the going train: teeth run dry, pivots in oiled stones ----
  'Fusee & great wheel > Center wheel': L('dry', 'train teeth run dry: oil on a tooth collects abrasive, and every mesh efficiency in the energy column assumes dry steel on brass', { mu: 'muTooth', src: 'roadmap §247 seed table' }),
  'Center wheel > Third wheel':         L('dry', 'train teeth run dry (as the first stage)', { mu: 'muTooth', src: 'roadmap §247 seed table' }),
  'Third wheel > Fourth wheel':         L('dry', 'train teeth run dry (as the first stage)', { mu: 'muTooth', src: 'roadmap §247 seed table' }),
  'Fourth wheel > Escape wheel':        L('dry', 'train teeth run dry (as the first stage)', { mu: 'muTooth', src: 'roadmap §247 seed table' }),
  'Center wheel :: bearing':            L('oil-medium', 'chaton rubies; the centre arbor carries the barrel reaction and is the thickest pivot (sized to its load, TODO 193), so it takes the heavier oil', { mu: 'muJewel', sink: 'chaton', src: 'roadmap §247 seed table' }),
  'Third wheel :: bearing':             L('oil-fine', 'chaton rubies; a light, faster pivot', { mu: 'muJewel', sink: 'chaton', src: 'roadmap §247 seed table' }),
  'Fourth wheel :: bearing':            L('oil-fine', 'rubies — a chaton below, the fourth wheel bridge\'s rubbed-in stone above (§322); fast and light, so the oil is kept where it was put', { mu: 'muJewel', sink: 'chaton', epilame: true, src: 'roadmap §247 seed table' }),
  'Escape wheel :: bearing':            L('oil-fine', 'rubies — a chaton below, the fourth wheel bridge\'s rubbed-in stone above (§322); the fastest and lightest pivot in the train', { mu: 'muJewel', sink: 'chaton', epilame: true, src: 'roadmap §247 seed table' }),
  // ---- the barrel, chain and fusee ----
  'mainspring > Mainspring drum':       L('grease', 'a mainspring is greased: coil-on-coil friction is the ribbon\'s hysteresis (FRICTION.springInt), and this ribbon works near coil bind', { mu: 'springInt', src: 'roadmap §247 seed table' }),
  'Mainspring drum :: bearing':         L('oil-medium', 'the drum runs on its fixed arbor, a plain bore, under the chain\'s full tension and slowly', { mu: 'muPlain', sink: 'plain-bush', src: 'roadmap §247 seed table' }),
  'Mainspring drum > Chain':            L('dry', 'the chain\'s hook on the drum wall is a fixing, not a bearing', { src: 'derived: a hooked end has no relative motion to lubricate' }),
  'Chain > Fusee & great wheel':        L('dry', 'the chain lies in a cut groove: oil here collects dirt into the groove, so it is dry or a trace', { src: 'roadmap §247 seed table' }),
  'Chain :: bearing':                   L('oil-fine', 'the rivets articulate at every wrap, steel in steel, and are oiled sparingly (FRICTION.muChain)', { mu: 'muChain', sink: 'plain-bush', src: 'roadmap §247 seed table; failure 4, TODO 248' }),
  'Fusee & great wheel :: bearing':     L('oil-medium', 'staff-size bushes carry the chain pull and the great wheel\'s reaction; top plain, bottom jewelled by default (TODO 252 owns the inconsistency)', { mu: 'muPlain', sink: 'plain-bush', src: 'roadmap §247 seed table' }),
  'Fusee & great wheel > Maintaining detent': L('grease', 'the maintaining ratchet, pawls and detent tip hold the train while winding: sliding steel under load', { src: 'roadmap §247 seed table' }),
  'Maintaining detent :: bearing':      L('grease', 'the detent\'s pivot, with the ratchet it works on', { src: 'roadmap §247 seed table' }),
  'Winding arrest :: bearing':          L('oil-fine', 'the arrest finger\'s pivot; its beak and lug contact stay dry (impact, intermittent)', { sink: 'plain-bush', src: 'roadmap §247 seed table' }),
  // ---- the escapement and the oscillator ----
  'Escape wheel > Pallet fork':         L('escapement', 'the one oiled tooth contact: 216,000 impulses a stone a day (TODO 45); the surfaces are epilamed', { epilame: true, src: 'roadmap §247 seed table' }),
  'Pallet fork :: bearing':             L('oil-fine', 'jewelled, no endstone; light and fast', { sink: 'chaton', epilame: true, src: 'roadmap §247 seed table' }),
  'Pallet fork > Balance':              L('dry', 'impulse pin in the fork notch: ruby and steel, dry', { src: 'roadmap §247 seed table' }),
  'Balance :: bearing':                 L('oil-fine', 'the upper pivot oils in the cap-jewel reservoir; the lower pivot has NO endstone, so no reservoir and the shoulder bears on the jewel face (TODO 254)', { mu: 'muJewel', sink: 'none', epilame: true, src: 'roadmap §247 seed table; failure 2' }),
  'Balance > Hairspring':               L('dry', 'oil on a hairspring sticks the coils and the rate goes; collet and stud are dry and the neighbours are epilamed', { src: 'roadmap §247 seed table' }),
  'Hairspring :: bearing':              L('dry', 'a clamped inner end and a studded outer end: nothing slides; dry, as a spring that must not stick', { src: 'roadmap §247 seed table' }),
  // ---- the keyless works ----
  'crown > Winding clutch':             L('grease', 'the stem and its clutch slide under load', { src: 'roadmap §247 seed table' }),
  'Winding clutch > Keyless works':     L('grease', 'the saw coupling and the winding pinion; its ramp was cut at dry MU_STEEL (TODO 250 owns that)', { src: 'roadmap §247 seed table; failure 7' }),
  'Keyless works > Fusee & great wheel': L('grease', 'the crown wheel and winding pinion into the fusee\'s ratchet', { src: 'roadmap §247 seed table' }),
  'crown > Setting lever':              L('grease', 'the setting lever is moved by the stem\'s groove', { src: 'roadmap §247 seed table' }),
  'Setting lever > Yoke':               L('grease', 'the lever\'s flank drives the yoke\'s tail pin', { src: 'roadmap §247 seed table' }),
  'Yoke > Winding clutch':              L('grease', 'the yoke\'s prong in the clutch\'s groove', { src: 'roadmap §247 seed table' }),
  'Keyless works :: bearing':           L('grease', 'crown wheel, winding pinion and stem bushing: sliding steel', { src: 'roadmap §247 seed table' }),
  'Winding clutch :: bearing':          L('grease', 'the clutch slides on the stem', { src: 'roadmap §247 seed table' }),
  'Setting lever :: bearing':           L('grease', 'pivots on the plate, with the lever\'s sliding contacts', { src: 'roadmap §247 seed table' }),
  'Yoke :: bearing':                    L('grease', 'pivots on the plate, with the clutch it moves', { src: 'roadmap §247 seed table' }),
  // ---- the motion works, hack and reset ----
  'Center wheel > Motion works':        L('friction', 'the cannon pinion is a friction fit on the centre arbor: its slip torque is what the lubricant sets', { cites: '§24 cannon pinion slip torque', src: 'roadmap §247 seed table' }),
  'Motion works > Hour wheel':          L('dry', 'motion-works teeth run dry', { src: 'derived: as the train\'s teeth' }),
  'Motion works :: bearing':            L('oil-fine', 'running fits on the arbor', { sink: 'plain-bush', src: 'roadmap §247 seed table' }),
  'Hour wheel :: bearing':              L('oil-fine', 'the hour tube turns on the cannon pinion\'s tube', { sink: 'plain-bush', src: 'roadmap §247 seed table' }),
  'Fourth wheel > Heart cam (seconds reset)': L('friction', 'the reset heart rides the display arbor on a friction coupling; its slip bound assumed a lossless train (TODO 249)', { cites: 'TODO 249 (slip-torque bound), main.js reset load', src: 'roadmap §247 seed table; failure 6' }),
  'Reset hammer > Heart cam (seconds reset)': L('dry', 'the hammer cams the heart to zero: a cam contact, dry', { src: 'derived: a reset cam works against the friction coupling, not through a film' }),
  // ---- the alarm ----
  'alarm mainspring > Alarm barrel':    L('grease', 'a mainspring is greased', { mu: 'springInt', src: 'roadmap §247 seed table' }),
  'Alarm barrel > Alarm striking wheel': L('dry', 'alarm train teeth run dry', { src: 'derived: as the going train' }),
  'Alarm striking wheel > Alarm governor': L('dry', 'governor teeth run dry', { src: 'derived: as the going train' }),
  'Alarm governor > Alarm governor anchor': L('dry', 'governor pallets on the saw: steel on steel, dry (TODO 45: oiling raises the efficiency and moves the governor\'s I_a)', { src: 'roadmap §247 seed table' }),
  'Alarm governor :: bearing':          L('oil-fine', 'governor posts with §120\'s collar cups', { sink: 'collar-cup', src: 'roadmap §247 seed table' }),
  'Alarm governor anchor :: bearing':   L('oil-fine', 'the anchor\'s posts, with §120\'s collar cups', { sink: 'collar-cup', src: 'roadmap §247 seed table' }),
  'Alarm striking wheel :: bearing':    L('oil-fine', 'the striking wheel\'s staff', { sink: 'plain-bush', src: 'roadmap §247 seed table' }),
  'Alarm striking wheel > Alarm lifting lever': L('dry', 'the cam against the lifting lever: dry', { src: 'derived: a cam contact' }),
  'Alarm lifting lever > Alarm hammer': L('dry', 'the lever lifts the hammer\'s tail: dry', { src: 'derived: a cam contact' }),
  'Alarm lifting lever :: bearing':     L('oil-fine', 'hammer, feeler and lifter pivots are oil-fine', { sink: 'plain-bush', src: 'roadmap §247 seed table' }),
  'Alarm hammer :: bearing':            L('oil-fine', 'hammer, feeler and lifter pivots are oil-fine', { sink: 'plain-bush', src: 'roadmap §247 seed table' }),
  'Alarm release feeler :: bearing':    L('oil-fine', 'hammer, feeler and lifter pivots are oil-fine', { sink: 'plain-bush', src: 'roadmap §247 seed table' }),
  'Alarm release lifter :: bearing':    L('oil-fine', 'hammer, feeler and lifter pivots are oil-fine', { sink: 'plain-bush', src: 'roadmap §247 seed table' }),
  'Alarm setting wheel > Alarm disc':   L('friction', 'the alarm disc is carried on a friction hub: its drag and hold are priced at MU_STEEL (TODO 144), and at every corner of muTooth’s dry-steel band against the ramp’s climb (TODO 260)', { cites: 'TODO 144 (the disc\'s priced drag and hold)', src: 'roadmap §247 seed table' }),
  'Hour wheel > Alarm disc':            L('friction', 'the disc rides the hour wheel on the same friction hub (TODO 141/144)', { cites: 'TODO 144 (the disc\'s priced drag and hold)', src: 'roadmap §247 seed table' }),
});

// A bearing whose regime is oil but whose sink is 'none' is malformed unless it is
// WAIVED here, citing the item that owns the missing part. The waiver goes stale
// the moment its row has a sink — the covenant every waiver table in this repo keeps.
export const LUBRICATION_WAIVERS = Object.freeze({
  'Balance :: bearing': 'TODO 254',   // the lower pivot has no endstone: no cap jewel, no reservoir
});

// THE ARRIVAL INVENTORY — the joints this landing did not answer. CLOSED: it
// shrinks as rows are written, and a key that has been answered while still listed
// fails. Written once from the audit's own `unanswered` list (the check's payload
// carries it); entries only ever leave.
export const LUBRICATION_DEBT = Object.freeze([
  'Alarm barrel :: bearing',
  'Alarm click :: bearing',
  'Alarm crown :: bearing',
  'Alarm detector arbor :: bearing',
  'Alarm detector idler :: bearing',
  'Alarm disc :: bearing',
  'Alarm link :: bearing',
  'Alarm lock :: bearing',
  'Alarm release crank :: bearing',
  'Alarm release disc :: bearing',
  'Alarm release link :: bearing',
  'Alarm release reader :: bearing',
  'Alarm release sleeve :: bearing',
  'Alarm selector :: bearing',
  'Alarm setting arbor :: bearing',
  'Alarm setting idler :: bearing',
  'Alarm setting wheel :: bearing',
  'Alarm silence rocker :: bearing',
  'Alarm switch :: bearing',
  'Alarm winding arrest :: bearing',
  'Alarm winding train :: bearing',
  'Hack rod :: bearing',
  'Heart cam (seconds reset) :: bearing',
  'Minute jumper :: bearing',
  'Power-reserve train :: bearing',
  'Reset hammer :: bearing',
  'Reset rod :: bearing',
  'Stop lever :: bearing',
  'Fusee & great wheel > Power-reserve train',
  'Setting lever > Hack rod',
  'Hack rod > Stop lever',
  'Setting lever > Reset rod',
  'Reset rod > Reset hammer',
  'Keyless works > Motion works',
  'Setting lever > Minute jumper',
  'Motion works > Minute jumper',
  'Alarm crown > Alarm setting arbor',
  'Alarm crown > Alarm winding train',
  'Alarm winding train > Alarm barrel',
  'Alarm barrel > Alarm click',
  'Alarm barrel > Alarm winding arrest',
  'Chain > Winding arrest',
  'Alarm switch > Alarm lock',
  'Alarm setting arbor > Alarm setting idler',
  'Alarm setting idler > Alarm setting wheel',
  'Alarm selector > Alarm disc',
  'Alarm crown > Alarm release lifter',
  'Alarm release lifter > Alarm release link',
  'Alarm release link > Alarm release crank',
  'Alarm release crank > Alarm release sleeve',
  'Alarm release sleeve > Alarm disc',
  'Alarm release sleeve > Alarm silence rocker',
  'Alarm silence rocker > Alarm release feeler',
  'Alarm switch > Alarm link',
  'Alarm link > Alarm selector',
  'Alarm setting idler > Alarm release disc',
  'Hour wheel > Alarm detector idler',
  'Alarm detector idler > Alarm detector arbor',
  'Alarm detector arbor > Alarm release reader',
  'Alarm release disc > Alarm release reader',
  'Alarm release reader > Alarm release feeler',
]);

export const INPUT_NODES = Object.freeze(['mainspring', 'crown', 'alarm mainspring']);

// ---------------------------------------------------------------------------
// The population, from a MECH_GRAPH-shaped object.
export function lubricationJoints(graph) {
  const inputs = new Set(INPUT_NODES);
  const sup = new Set(graph.support.map((e) => e[0]));
  const moving = new Set();
  for (const [a, b] of graph.drive) { if (!inputs.has(a)) moving.add(a); if (!inputs.has(b)) moving.add(b); }
  const joints = [];
  for (const u of [...moving].sort()) if (sup.has(u)) joints.push({ key: `${u} :: bearing`, kind: 'bearing', unit: u, units: [u] });
  const seen = new Set();
  for (const [a, b] of graph.drive) {
    const key = `${a} > ${b}`;
    if (seen.has(key)) continue;
    seen.add(key);
    joints.push({ key, kind: 'contact', units: [a, b].filter((x) => !inputs.has(x)), ends: [a, b] });
  }
  return joints;
}

// ---------------------------------------------------------------------------
// The audit. Pure: it takes the tables it judges, so the check can run it on the
// real ones and on mutated copies (its controls).
export function auditLubrication({ graph, labels, rows = LUBRICATION, debt = LUBRICATION_DEBT, waivers = LUBRICATION_WAIVERS, friction = FRICTION }) {
  const joints = lubricationJoints(graph);
  const population = new Map(joints.map((j) => [j.key, j]));
  const labelSet = new Set(labels);
  const inputs = new Set(INPUT_NODES);
  const malformed = [], stale = [], unanswered = [], staleDebt = [], debtNotInPopulation = [], staleWaivers = [];
  const answered = [];

  for (const [key, row] of Object.entries(rows)) {
    const j = population.get(key);
    if (!j) { stale.push({ key, why: 'no such joint in MECH_GRAPH — a row naming no metal answers nothing' }); continue; }
    const missing = j.units.filter((u) => !labelSet.has(u));
    if (missing.length) { stale.push({ key, why: `unit label(s) ${missing.map((m) => `'${m}'`).join(', ')} not registered in the scene` }); continue; }
    const bad = (problem) => malformed.push({ key, problem });
    if (!LUBRICATION_REGIMES.includes(row.regime)) { bad(`regime '${row.regime}' is not one of ${LUBRICATION_REGIMES.join(', ')}`); continue; }
    if (typeof row.why !== 'string' || row.why.trim().length < 20) { bad('a row without its service claim (why, 20+ characters) is decoration'); continue; }
    if (row.epilame !== undefined && typeof row.epilame !== 'boolean') { bad('epilame is a flag'); continue; }
    if (row.regime === 'friction' && !(typeof row.cites === 'string' && row.cites.trim())) { bad('a friction row must cite the slip-torque derivation it sets'); continue; }
    if (row.regime !== 'friction' && row.cites !== undefined) { bad('only a friction row cites a slip-torque derivation'); continue; }
    if (row.mu !== undefined) {
      if (!(row.mu in friction)) { bad(`mu '${row.mu}' is not a FRICTION row`); continue; }
      if (!REGIME_INFO[row.regime].priced.includes(row.mu)) { bad(`FRICTION.${row.mu} prices a joint the regime '${row.regime}' does not describe (it prices ${REGIME_INFO[row.regime].priced.join(' / ') || 'nothing'})`); continue; }
    }
    if (row.sink !== undefined && !OIL_SINKS.includes(row.sink)) { bad(`sink '${row.sink}' is not one of ${OIL_SINKS.join(', ')}`); continue; }
    if (row.regime.startsWith('oil') && j.kind === 'bearing' && row.sink === undefined) { bad('an oiled bearing names its oil sink'); continue; }
    if (row.sink === 'none' && !(row.regime.startsWith('oil') && waivers[key])) {
      bad(row.regime.startsWith('oil') ? 'an oiled bearing with no oil sink is a finding, not an answer: waive it against the item that owns the missing part' : "'none' is a sink for an oiled bearing");
      continue;
    }
    answered.push({ key, regime: row.regime, kind: j.kind });
  }

  const debtSet = new Set(debt);
  for (const j of joints) {
    if (j.key in rows) continue;
    if (!debtSet.has(j.key)) unanswered.push({ key: j.key, kind: j.kind });
  }
  for (const k of debt) {
    if (!population.has(k)) debtNotInPopulation.push({ key: k, why: 'an inventory entry naming no joint' });
    else if (k in rows) staleDebt.push({ key: k, why: 'answered, and still listed as debt: delete the entry' });
  }
  for (const [k, cite] of Object.entries(waivers)) {
    const row = rows[k];
    if (!row || row.sink !== 'none') staleWaivers.push({ key: k, cite, why: 'the waived row has an oil sink (or no longer exists): delete the waiver' });
  }
  const byRegime = {};
  for (const a of answered) byRegime[a.regime] = (byRegime[a.regime] || 0) + 1;
  return { population: joints.length, joints, answered, unanswered, malformed, stale, staleDebt, debtNotInPopulation, staleWaivers,
    debtCount: debt.length, byRegime, inputs: [...inputs] };
}
