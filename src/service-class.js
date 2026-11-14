// TODO 299 step 1 (second half) — THE SERVICE CLASS OF EVERY MEMBER. A wear criterion is only meaningful against what
// the member is expected to do across the service schedule (layout.js SERVICE_INTERVAL_YEARS, DESIGN_LIFE_YEARS), and
// that splits the movement in two:
//   · EXPENDABLE — replaced at service, so its criterion is ONE interval (its life is the schedule's, not the watch's):
//     the oil and grease (src/lubrication.js answers every joint's lubricant, so they are not repeated here), the two
//     mainspring ribbons and the going barrel's (a set spring is replaced, not reformed), and the case's gaskets.
//   · LIFETIME — everything else: it must reach DESIGN_LIFE_YEARS through every service, which is the criterion the
//     escape wheel's wear row is written against (TODO 299 landing 1).
// The table is the roster, and its COMPLETENESS is the point, on LUBRICATION's precedent: every unit the build labels
// answers with a class, or the gate fails. Expendables live mostly INSIDE lifetime units (a ribbon in its drum, a gasket
// in the case), so a unit's class is its frame's and the parts replaced at service are named by mesh in
// EXPENDABLE_PARTS. Pure data and a pure judge: inspect.js' `serviceClass` check hands it the scene.
import { ROUTE_UNIT_NAME } from './layout.js';

const L = (why) => Object.freeze({ cls: 'lifetime', why });
export const SERVICE_CLASS = Object.freeze({
  // the frame and its fixtures
  'Three-quarter plate': L('a plate: cleaned and re-oiled at service, never replaced'),
  'pillars': L('the frame\'s pillars'),
  'Balance cock': L('a cock: its jewels are set for the movement\'s life'),
  'Fork cock': L('a cock'),
  'Escape cock': L('a cock'),
  'Fusee cock': L('a cock'),
  'Dial': L('the dial'),
  'Case': L('the case: its gaskets are EXPENDABLE_PARTS'),
  // the going train
  'Mainspring drum': L('the drum: its ribbon is an EXPENDABLE_PART'),
  'Going barrel': L('the second barrel: its ribbon is an EXPENDABLE_PART'),
  'Chain': L('the fusee chain: inspected at service and replaced only when it fails, which the model does not price'),
  'Fusee & great wheel': L('a wheel'),
  'Maintaining detent': L('the maintaining work'),
  'Set-up work': L('the set-up ratchet'),
  'Center wheel': L('a wheel'), 'Third wheel': L('a wheel'), 'Fourth wheel': L('a wheel'),
  'Escape wheel': L('the escape wheel — the member TODO 299 landing 1 prices for a century'),
  'Pallet fork': L('the fork: its stones are set for the movement\'s life (their own wear is TODO 299\'s, unpriced)'),
  'Balance': L('the balance'),
  'Hairspring': L('the hairspring: regulated, never replaced'),
  'Small seconds': L('the seconds train'),
  'Heart cam (seconds reset)': L('the reset heart'), 'Reset hammer': L('the reset hammer'), 'Reset rod': L('the reset rod'),
  'Hack rod': L('the hack'), 'Stop lever': L('the stop lever'),
  'Winding arrest': L('§47\'s arrest'), 'Winding stop-work': L('§329\'s stop-work'),
  'Power-reserve train': L('the reserve train'), 'Power reserve': L('the reserve indicator'),
  // keyless and motion works
  'Keyless works': L('the keyless works'), 'Winding clutch': L('the clutch'), 'Yoke': L('the yoke'),
  'Setting lever': L('the setting lever'), 'Minute jumper': L('the minute jumper'),
  'Motion works': L('the motion works'), 'Hour wheel': L('the hour wheel'),
  // the alarm
  'Alarm barrel': L('the alarm barrel: its ribbon is an EXPENDABLE_PART'), 'Alarm click': L('the alarm click'),
  'Alarm crown': L('the alarm crown'), 'Alarm winding train': L('the alarm winding train'), 'Alarm winding arrest': L('the alarm arrest'),
  'Alarm governor': L('the governor'), 'Alarm governor anchor': L('the governor\'s anchor'),
  'Alarm striking wheel': L('the striking wheel'), 'Alarm hammer': L('the hammer'), 'Alarm gong': L('the gong'),
  'Alarm lifting lever': L('the lifting lever'), 'Alarm lock': L('the lock'), 'Alarm link': L('the link'),
  'Alarm switch': L('the switch'), 'Alarm selector': L('the selector'), 'Alarm disc': L('the disc'),
  'Alarm setting arbor': L('the setting arbor'), 'Alarm setting idler': L('the setting idler'), 'Alarm setting wheel': L('the setting wheel'),
  'Alarm release lifter': L('the release lifter'), 'Alarm release feeler': L('the release feeler'), 'Alarm silence rocker': L('the silence rocker'),
  'Alarm release crank': L('the release crank'), 'Alarm release link': L('the release link'), 'Alarm release sleeve': L('the release sleeve'),
  'Alarm release disc': L('the release disc'), 'Alarm release reader': L('the release reader'), 'Alarm release seat': L('the release seat'),
  'Alarm detector arbor': L('the detector arbor'), 'Alarm detector idler': L('the detector idler'),
  [ROUTE_UNIT_NAME]: L('an applied route (?route=): a hand-drawn linkage, of the frame\'s class'),
});
// The parts REPLACED at service, inside the units that carry them. Each names a mesh; a row whose unit is built and whose
// mesh is neither there nor left uncut on the build's own word (clock.omitted) is stale.
export const EXPENDABLE_PARTS = Object.freeze([
  // the going mainspring lives in the drum, or with two barrels (?barrels=2) in the going barrel: ONE part, carried by
  // whichever of its units the build has
  Object.freeze({ units: ['Mainspring drum', 'Going barrel'], mesh: 'mainspringRibbon', why: 'the going mainspring: a set ribbon is replaced at service, not reformed' }),
  Object.freeze({ unit: 'Alarm barrel', mesh: 'mainspringRibbon', why: 'the alarm mainspring, on the same rule' }),
  Object.freeze({ unit: 'Case', mesh: 'caseGasket', why: 'the case-back gasket: an elastomer, replaced every service' }),
  Object.freeze({ unit: 'Case', mesh: 'caseBackCrystalGasket', why: 'the back crystal\'s gasket, on the same rule (a form case cuts none, and says so)' }),
]);
export const SERVICE_CLASSES = Object.freeze(['lifetime', 'expendable']);

// The judge. `scene`: Map unit name → Set of its mesh labels; `omitted`: the build's [{ unit, mesh }] it left uncut.
export function judgeServiceClass({ scene, omitted = [], table = SERVICE_CLASS, parts = EXPENDABLE_PARTS }) {
  const unanswered = [], malformed = [], stale = [], notBuilt = [];
  for (const u of scene.keys()) if (!(u in table)) unanswered.push({ unit: u, why: 'a labelled unit with no service class: every member is EXPENDABLE or LIFETIME' });
  for (const [u, r] of Object.entries(table)) {
    if (!r || !SERVICE_CLASSES.includes(r.cls)) malformed.push({ unit: u, why: `class '${r && r.cls}' is not one of ${SERVICE_CLASSES.join(', ')}` });
    else if (typeof r.why !== 'string' || r.why.trim().length < 6) malformed.push({ unit: u, why: 'a class with no reason' });
    if (!scene.has(u)) notBuilt.push(u);
  }
  const omit = new Set(omitted.map((o) => `${o.unit}/${o.mesh}`));
  const replaced = [];
  for (const p of parts) {
    const units = p.units ?? [p.unit], key = `${units.join('|')}/${p.mesh}`;
    const unclassed = units.filter((u) => !(u in table));
    if (unclassed.length) { malformed.push({ part: key, why: `an expendable part in unit(s) the roster does not class: ${unclassed.join(', ')}` }); continue; }
    const built = units.filter((u) => scene.has(u));
    if (!built.length) continue;   // none of its units is in this build; the part is not either
    const carrier = built.find((u) => scene.get(u).has(p.mesh));
    if (carrier) replaced.push(`${carrier}/${p.mesh}`);
    else if (!built.some((u) => omit.has(`${u}/${p.mesh}`))) stale.push({ part: key, why: 'names a mesh none of its built units carries, and the build did not say it left it uncut' });
  }
  return { unanswered, malformed, stale, notBuilt, replaced,
    lifetime: [...scene.keys()].filter((u) => table[u] && table[u].cls === 'lifetime').length,
    expendableUnits: [...scene.keys()].filter((u) => table[u] && table[u].cls === 'expendable').length };
}
