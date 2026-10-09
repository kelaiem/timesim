// §97 — the aesthetics import is GONE, and that is the point: the finish
// layer's factor used to reach the solver as a module import, which is a
// number the shadow-solve could never override and the URL could never
// carry. The solver now reads only its arguments; finish holds no
// sub-dial knob.
// Mechanical Clock Simulation — LAYOUT SPEC (BUILT §13, step 1).
//
// The movement's geometry is genuinely parametric — barrel at the origin,
// everything stepped off it through real wheel radii — but for most of the
// project that parametricity lived tangled in `main.js`'s evaluation order:
// 6,400 lines of module-level `const` where a number could not be moved
// without knowing everything downstream of its line. §13 untangles that into
// a pure data module the builders CONSUME. This file is the first slice: the
// constants that were already pure — no `THREE`, no `scene`, no solved
// positions, just numbers DERIVED from constraints with the constraint in the
// comment. Everything here is exported as plain data; nothing here builds or
// mutates anything.
//
// Rule as this module grows: a value belongs here iff it can be computed from
// literals and other values in this file alone. The moment it needs a wheel's
// measured bounding box or a solved position it stays in `main.js` (for now —
// later steps of §13 pull the solve out too, into a `solveLayout(spec)` this
// file will host). The geometry fingerprint (`inspect.js`) guards the move: a
// pure relocation of these definitions must not change a single part's world
// position, so the hash is identical before and after.

// ---------------------------------------------------------------------------
// §22 — THE WATCH SPEC. Reserve and beat rate are KNOBS, not constants: two
// numbers a URL can set (`?reserveh=`, `?vph=`, read by index.html into
// `globalThis.__WATCH_SPEC` before any module loads — reload-tier, the §23
// subdial-size precedent) that everything below DERIVES from. The identity
// spec {30 h, 18,000 A/h} must reproduce the shipped movement bit-exactly:
// that is the regression gate, asserted by the geometry fingerprint.
//
// BEAT RATE IS A MENU, NOT A DIAL, and the menu is the honest part. The
// going train's tooth counts exist to make the fourth wheel turn once per
// minute at the chosen beat — change the beat without re-deriving the counts
// and the seconds hand lies, which is the class of shortcut this project
// exists to close. So each rate carries the fourth-wheel/escape-pinion pair
// that KEEPS fourth = 1 rev/min exactly, with the escape wheel (15 teeth,
// 24° pitch, BEAT_DEG 12) untouched:
//   fourth rev/hr = (vph/30 escape rev/hr) · (escPinion/fourthTeeth) = 60
//   ⇒ escPinion/fourthTeeth = 1800/vph — integer pairs only.
// The third mesh (fourth PINION on the third wheel) never changes, so the
// minute and hour hands are untouched by construction; only the
// fourth⇄escape mesh re-gears, and solveLayout absorbs the moved centre
// distances the way §13 built it to.
//
// A ROW MAY CARRY ITS OWN MODULE (§204), and the 36,000 row must. 1/20 has
// four integer pairs, and all four were booted (§204's probe): 4/80 and
// 5/100 are not pinions any watch runs (TODO 15's gauge refuses the four-leaf
// one outright), and 6/120 at the mesh's 0.21 module grows the fourth wheel
// to r 12.6 and the plate to 47.87 — past §187's caseback aperture (45.73)
// and four units through §186's case clamp thread: the first row that fails
// to fit the CASE, not only the plate. Cut at 0.168 = 0.21 · 96/120 the
// 120-tooth wheel has the SAME pitch radius (10.08) as the 96-tooth wheel the
// two fast rows already carry, so the escape arbor lands within 0.1 u of the
// 28,800 row's and the row closes exactly as well as the menu already does —
// measured, the same three boot warnings, none added. The module is the
// row's, never the escape wheel's: the wheel's own cut (15 teeth, 24° pitch,
// BEAT_DEG 12) is untouched at every rate. Absent, a row's module is the
// mesh's 0.21, so the three rows above are byte-identical to what shipped.
const RATE_TABLE = {
  18000: { fourthTeeth: 80, escPinion: 8 }, // 8/80 = 1/10 — the shipped movement
  21600: { fourthTeeth: 96, escPinion: 8 }, // 8/96 = 1/12
  28800: { fourthTeeth: 96, escPinion: 6 }, // 6/96 = 1/16
  36000: { fourthTeeth: 120, escPinion: 6, module: 0.168 }, // 6/120 = 1/20 — §204: at 0.168 the wheel keeps the 96-tooth rows' pitch radius
};
export const FOURTH_MODULE_DEFAULT = 0.21; // the fourth⇄escape mesh's cut, the rows above's module when they carry none
export const SPEC = (() => {
  const raw = (typeof globalThis !== 'undefined' && globalThis.__WATCH_SPEC) || {};
  const vph = RATE_TABLE[raw.vph] ? Number(raw.vph) : 18000;
  // Reserve clamped to what the STRUCTURE accepts: below ~12 h the fusee
  // loses its reason to exist; above 48 h the cone's groove stack (0.7 u per
  // turn, one turn per 8 h) grows past what the plate floor can absorb —
  // the three-quarter-plate boot assert is the backstop, this clamp is the
  // courtesy that keeps a typo from tripping it.
  // Snapped to a multiple of 3 — WHICH GUARDS A RETIRED RULE (TODO 134).
  // This read "the reserve indicator's second-stage wheel takes 2h/3 teeth",
  // and that was true of the 150°-arc indicator. Since §152 graduated the arc
  // to 300°, `rsvTeethW2` is `SPEC.reserveHours / 5` (main.js), so an integer
  // wheel needs h a multiple of FIVE and this snap does not deliver one: ten
  // of the thirteen reachable values are fractional, as are four of the five
  // reserve-menu options. The default 30 is a multiple of both, which is why
  // the shipped movement is correct and nothing has ever warned. Left as-is
  // deliberately — moving the snap to 5 re-enters the problem at the ceiling
  // (round(48/5)·5 = 50, clamped back to 48), so the repair is a §22 decision
  // about the cap and the menu, not an edit to this line. A tooth count is
  // still not a place for rounding error.
  const reserveHours = Number.isFinite(Number(raw.reserveHours))
    ? Math.min(48, Math.max(12, Math.round(Number(raw.reserveHours) / 3) * 3)) : 30;
  // §33 step 1 — the crown's azimuth (movement-frame world degrees of the
  // stem line; the UI speaks dial-clock and translates). null = as
  // designed: the identity spec must not even ROTATE BY ZERO — the solve
  // skips the transform entirely so identity stays bit-exact.
  const crownAzDeg = Number.isFinite(Number(raw.crownAzDeg))
    ? ((Number(raw.crownAzDeg) % 360) + 360) % 360 : null;
  // §33 step 3 — the going train's ARRANGEMENT angles as specs. These are
  // solveLayout's own inputs (they always were the arrangement's degrees
  // of freedom; step 3 only hands the viewer the knobs): the barrel's
  // step about the centre, the escape's about the fourth, the balance's
  // TARGET about the escape (the solver still owns the feasible angle —
  // a target it must move off is a warning, live and at boot). null = as
  // designed: the argument is not even passed, so identity stays on the
  // default constants bit-exactly.
  const stepDeg = (v) => Number.isFinite(Number(v)) ? Math.max(-180, Math.min(180, Number(v))) : null;
  const barrelStepDeg = stepDeg(raw.barrelStepDeg);
  const escapeStepDeg = stepDeg(raw.escapeStepDeg);
  const balanceStepDeg = stepDeg(raw.balanceStepDeg);
  // §33 step 2 — THE STEM DECOUPLED: the stem line's own azimuth (world
  // degrees), independent of the barrel. null = as designed: the stem
  // derives from the barrel's azimuth exactly as §13 built it, bit-exact.
  const stemAzDeg = Number.isFinite(Number(raw.stemAzDeg))
    ? ((Number(raw.stemAzDeg) % 360) + 360) % 360 : null;
  // §33 (alarm crown handle) — the ALARM corner's azimuth (movement-frame
  // world degrees, like crownAzDeg). null = as designed: the corner keeps
  // its solved two-candidate choice and its exact literals.
  const alarmAzDeg = Number.isFinite(Number(raw.alarmAzDeg))
    ? ((Number(raw.alarmAzDeg) % 360) + 360) % 360 : null;
  // §33 (pusher handle) — the ALARM MODULE's azimuth (world degrees): the
  // striking wheel's station, from which the whole alarm work — gong,
  // hammer, striker, barrel, lock, column, pawl, pusher — is seeded. null =
  // as designed (40° since §112's tier-split; 160° before it). This
  // RETIRED ?pushaz=: an independent press axis
  // could park the pusher's chain inside the movement while the toggle it
  // drives stayed at the corner; the pusher is the module's grip, not its
  // own part, so the handle moves the module.
  const alarmModAzDeg = Number.isFinite(Number(raw.alarmModAzDeg))
    ? ((Number(raw.alarmModAzDeg) % 360) + 360) % 360 : null;
  // §129 — THE ALARM BARREL'S OWN BEARING off the striking wheel, which
  // ?alarmmod= cannot reach: that key turns the whole module, so the barrel
  // keeps its bearing and the arrangement is unchanged. This one moves the
  // barrel AROUND the striking wheel at the mesh's fixed centre distance,
  // which is the freedom §112 solved to 202° and the only one that can open
  // room for a consumer of the barrel that did not exist then. Module-relative
  // like the literal it overrides, so it composes with ?alarmmod= rather than
  // fighting it. null = as designed: the solved literal stands, bit-exact.
  const alarmBarrelAzDeg = Number.isFinite(Number(raw.alarmBarrelAzDeg))
    ? ((Number(raw.alarmBarrelAzDeg) % 360) + 360) % 360 : null;
  // §94 tier A — THE SMALL-SECONDS STATION. d4 is the centre→fourth
  // distance, already solveLayout's own argument (D4 below): the two-bar
  // solves the third wheel's wedge so the fourth lands exactly d4 below the
  // centre, and the fourth's axis IS the small-seconds pivot. So this one
  // number moves that sub-dial — and, because the escapement hangs off the
  // fourth, the escape, fork and balance with it.
  //
  // NOT clamped here, deliberately. The bound that matters is the two-bar's
  // own closure window, which is a function of the train's pitch radii —
  // TRAIN is declared 340 lines below this IIFE, so nothing at this point in
  // the file can state it. `d4Window` derives it where the radii are, and
  // two places consume it: solveLayout falls back to D4 rather than going
  // NaN, and reconfigure mode REFUSES against the same window before a drag
  // can propose one. null = as designed: LAYOUT_INPUTS passes no `d4` at
  // all, so the solve runs on the D4 constant and identity stays bit-exact.
  const d4 = Number.isFinite(Number(raw.d4)) ? Number(raw.d4) : null;
  // §94 tier C — THE RESERVE STATION'S RADIUS. The power-reserve subdial's
  // centre distance, dial-local; the station sits on the dial's 12-o'clock
  // axis (x = 0), so one radius key places it and an azimuth key can join
  // later without disturbing this one. Like d4, NOT clamped here — the
  // bounds live where the radii are: solveKeyless derives the well window
  // (rsvrWindow — inboard the centre bore's keep-out, outboard the dial
  // face) and the reduction train's own module bounds are asserted beside
  // the span solve in main.js, jointly with reserveh. null = as designed:
  // KEYLESS_INPUTS passes no radius at all, so the station derives from
  // dialRadius · 0.39 and identity stays bit-exact.
  const rsvr = Number.isFinite(Number(raw.rsvr)) ? Number(raw.rsvr) : null;
  // §237 — THE HAIRSPRING STUD'S RADIUS, which is also the cock's stud
  // carrier arm: the two are one number by construction, because the stud has
  // to sit where the terminal ends or it is not holding the spring. TODO 147
  // made this a solve CONDITION rather than an output, so the handle is just
  // that condition exposed. Like d4/rsvr/alarmr, NOT clamped here — the
  // window is two physical facts that live in main.js with the metal (the
  // post clearing the carrier's own ring root, and standing inboard of the
  // outer coil), and main.js clamps against them and says so. null = as
  // designed: HAIRSPRING_STUD_R is the window's inboard end, bit-exact.
  const studr = Number.isFinite(Number(raw.studr)) ? Number(raw.studr) : null;
  // §98 — THE ALARM CORNER'S RADIUS, §76's missing pin. The corner's
  // DEFAULT tracks the plate (alarmCornerR = dialRadius·0.39 since §94
  // tier B), so a grown balance grows the plate and carries the whole
  // setting cluster outward into fixed-radius neighbours — §76 measured
  // every remaining balance wall down to exactly that. A spec'd radius
  // pins the corner where the movement wants it. Like d4/rsvr, NOT
  // clamped here: solveKeyless warns at the stem bound it owns, and the
  // interior bounds are the setting dogleg's own asserts (no intersection
  // past ≈19.9) and the winding chain's derived idler — all loud, all
  // with numbers. null = as designed: identity passes nothing and the
  // default arithmetic is untouched, bit-exact.
  const alarmr = Number.isFinite(Number(raw.alarmr)) ? Number(raw.alarmr) : null;
  // §97 — THE SHARED SUB-DIAL WELL RADIUS. One radius serves both wells
  // (their pivots are fixed on their arbors, so radius is the only shared
  // freedom), and it stops being a browser-local finish multiplier: a spec
  // must be reproducible from its URL. NOT clamped here — solveKeyless
  // holds it between the derived FLOOR (the pocket's own centre bore plus
  // a wall plus the margin, SUBDIAL_FLOOR) and the derived CEILING
  // (min(stations) − SUBDIAL_INBOARD_CLEAR), falling back WITH a warn
  // rather than building a well that breaches either bore — the exact
  // degeneracy TODO 33 closed. null = as designed: the solve runs on the
  // ceiling, which is today's value exactly.
  const subdialr = Number.isFinite(Number(raw.subdialr)) ? Number(raw.subdialr) : null;
  // §125 — THE DIAL'S OWN RADIUS. The one dimension the ask "grow the dial"
  // is about was the one dimension no URL could carry: every number §125
  // measured on a grown face had to come off a patched tree. Like d4/rsvr/
  // alarmr, NOT clamped here — solveKeyless warns against the bounds it can
  // state (inboard the wells' outer edge, outboard the measured alarm-crown
  // ceiling) and the boot assert in main.js measures the rim against the
  // actual metal in the dial's slab. null = as designed: solveKeyless runs
  // its own arithmetic (dialRadius = plateR) and identity stays bit-exact.
  const dialr = Number.isFinite(Number(raw.dialr)) ? Number(raw.dialr) : null;
  // §184 — THE TIER-SPLIT TRIPLE'S OTHER TWO LEGS. `alarmBarrelAzDeg` (θ_b) has
  // been a spec since §112; θ_g and θ_a were bare literals in main.js, so two
  // thirds of a solved triple could not be moved from a URL at all — and the
  // one third that could was movable ALONE, which is the failure §184 exists to
  // stop. All three are module-relative bearings in degrees.
  //
  // NOT clamped here, like every other station spec: the triple's own joint
  // bound in main.js (alarmTierWarnsAt, measured off the built metal) is what
  // warns, with the fouling pair and its depth. A clamp here would silently
  // build a different watch than the URL asked for. null = as designed, and
  // identity stays bit-exact.
  const alarmGovAzDeg = Number.isFinite(Number(raw.alarmGovAzDeg))
    ? ((Number(raw.alarmGovAzDeg) % 360) + 360) % 360 : null;
  const alarmGovAnchorAzDeg = Number.isFinite(Number(raw.alarmGovAnchorAzDeg))
    ? ((Number(raw.alarmGovAnchorAzDeg) % 360) + 360) % 360 : null;
  return Object.freeze({ vph, reserveHours, crownAzDeg, barrelStepDeg, escapeStepDeg, balanceStepDeg, alarmAzDeg, alarmModAzDeg, alarmBarrelAzDeg, alarmGovAzDeg, alarmGovAnchorAzDeg, stemAzDeg, d4, rsvr, alarmr, subdialr, dialr, studr });
})();

// §36 APPLY — THE ROUTE IS A DOCUMENT. Part three shipped routing as a SPEC:
// the sketch surface refuses to place a refused leg, so a committed polyline is
// legal by construction. Apply turns that document into metal, and this is
// where the document is read and JUDGED — once, before anything consumes it.
//
// It is validated here rather than at the builder because a malformed route
// must cost the same as no route at all. §33's courtesy-clamp precedent: one
// boot warning naming what was wrong, then the IDENTITY build. There is no
// half-applied route — a spec this refuses is a spec that was never set, and
// the geometry fingerprint has to prove that (rule 6's silence is the tell:
// absent keys warn about nothing and take zero paths).
//
// Shape, both keys frozen at Apply time by the button, never hand-typed:
//   ?route=x,y,z;x,y,z;…     the committed polyline, movement units
//   ?routebush=i,t;i,t;…     station on segment i at fraction t along it
//
// Bush stations are FROZEN rather than re-solved on load because solveRoute's
// merge tolerance is a segment FRACTION — short legs over-bush — so a route
// that re-solved its own stations at boot could come back with a different
// bush count than the one Apply measured and declared. The document carries
// the answer; boot does not re-open the question.
export const ROUTE_UNIT_NAME = 'Applied route';
export const ROUTE_SPEC = (() => {
  const raw = (typeof globalThis !== 'undefined' && globalThis.__WATCH_SPEC) || {};
  if (raw.routeSpec === undefined) return null;      // the identity build: no key, no paths
  const refuse = (why) => {
    console.warn(`§36 route spec refused (${why}) — building the identity movement`);
    return null;
  };
  const nums = (s, n) => {
    const parts = String(s).split(',').map((v) => Number(v.trim()));
    return (parts.length === n && parts.every(Number.isFinite)) ? parts : null;
  };
  const points = [];
  for (const leg of String(raw.routeSpec).split(';')) {
    if (!leg.trim()) continue;
    const xyz = nums(leg, 3);
    if (!xyz) return refuse(`'${leg.trim()}' is not x,y,z`);
    points.push(Object.freeze({ x: xyz[0], y: xyz[1], z: xyz[2] }));
  }
  // Two points are one leg — the least that can be metal. One point is a
  // station with nothing to carry, and the sketch surface cannot commit it.
  if (points.length < 2) return refuse(`${points.length} point(s) — a route is at least two`);
  const bushes = [];
  for (const st of String(raw.routeBushSpec || '').split(';')) {
    if (!st.trim()) continue;
    const it = nums(st, 2);
    if (!it) return refuse(`'${st.trim()}' is not i,t`);
    const [i, t] = it;
    // The index names a SEGMENT, of which there are points.length − 1, and the
    // fraction is strictly inside it: a station at an endpoint is a station on
    // the joint, which is the knuckle's business and not a bearing's.
    if (!Number.isInteger(i) || i < 0 || i > points.length - 2) return refuse(`bush segment ${i} is not a segment of this route`);
    if (!(t > 0 && t < 1)) return refuse(`bush fraction ${t} is not strictly inside its segment`);
    bushes.push(Object.freeze({ i, t }));
  }
  return Object.freeze({ points: Object.freeze(points), bushes: Object.freeze(bushes) });
})();

// TODO 158 — THE CONFIGURATION KEY: an exact name for the geometry a build
// was asked to cut, so a page can say whether the battery ever swept it. The
// build is a deterministic function of (code, SPEC, applied route, the
// non-shareable aesthetics — the leaves that re-cut metal: hands, markers,
// gong, plate), so "this key was swept at this tree" is the same claim as
// "this geometry was". A key, not a geometry FINGERPRINT, on purpose: the
// fingerprint rounds engine trigonometry at 1e-3 and is only proven
// deterministic on one Chromium host, and it changes on every geometry
// landing; this is ECMAScript Number→String, exact on every engine, and moves
// only when a default does. Sorted keys and a version prefix, so an order or
// format change fails loudly instead of matching nothing.
//   spec   — the RESOLVED SPEC's non-null entries (clamped, snapped: ?vph=12345
//            and ?reserveh=31 resolve to the default and are keyed as it)
//   route  — the route AS APPLIED (a document the solve refused builds the
//            identity movement and is keyed null), else null
//   tuned  — sorted [path, value] pairs of the geometry-bearing overrides
export function configKey({ spec = SPEC, route = null, tuned = [] } = {}) {
  const s = {};
  for (const k of Object.keys(spec).sort()) if (spec[k] !== null && spec[k] !== undefined) s[k] = spec[k];
  const t = [...tuned].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return `cfg1:${JSON.stringify({ spec: s, route: route ?? null, tuned: t })}`;
}
export const SPEC_RATES = Object.freeze(Object.keys(RATE_TABLE).map(Number));

// ---------------------------------------------------------------------------
// Kinematic constants (see SPEC.md "Gear train" + "Escapement behavior")
// ---------------------------------------------------------------------------
// THE MOVEMENT'S RUNNING SENSE — one declaration, and every part whose METAL
// is cut for a direction is asserted against it (TODO 115).
//
// +1 means the going train advances its arbors in +z, which is what §47 holds
// at boot from the barrel's side (`barrelMeshAngle` ascending, main.js) and
// what `probe-wound-sense.mjs` measures from the outside on the fusee arbor.
// This constant does not CHOOSE that; it NAMES it, so the parts cut against it
// have something to be checked against.
//
// Why it exists at all: `probe-direction-guards.mjs` reverses one direction
// commitment at a time and boots the result, and measured that 4 of 5 reverse
// in SILENCE — the club-tooth lead, both mainspring winds, all five ratchet
// saws and the fusee groove. Every collision gate stays green through all of
// them, because none of them measures a direction. So a half-finished reversal
// is indistinguishable from a healthy movement, which is the failure the
// guards below exist to make impossible.
//
// WHAT THE GUARDS HOLD is COHERENCE, not a first-principles derivation of each
// hand. Each part's relation to this sense (`SENSE_REL` beside its builder) is
// a measured fact about the metal as cut; what the assert enforces is that the
// declaration and the metal move TOGETHER. Flip this constant without
// re-cutting a part, or re-cut a part without flipping this, and that part
// says so at boot.
export const MOVEMENT_SENSE = -1;

// AND IT GOVERNS THE GOING TRAIN, not "the movement" in the loosest sense —
// which is a distinction TODO 115's landing had to learn from the battery.
// The ALARM is a second MOTOR: its barrel, its train and its governor are
// posed off `alarmStrikePhase`, and nothing in that chain reads the constant
// above, so reversing the going train does not turn one alarm arbor the other
// way. Its direction-committed cuts must therefore follow their own train's
// hand, and this is it.
//
// +1 is what the alarm train measurably does, not a preference: its ribbon
// reads LEFT-handed against a +z arbor (`probe-wound-sense.mjs`, −6.213 turns)
// and its click beak is cut, flank for flank, to a `reverse: true` saw turning
// +z (§101). Two builders are SHARED with the going side — `makeRatchetAndClick`
// and `mainspringFrames` — and landing the reversal with both reading
// MOVEMENT_SENSE mirrored the alarm's ratchet and ribbon under a train that had
// not moved. Nothing about that was arguable: `alarmHandoffs` put the click beak
// 0.35 off its tooth at every parity and `restoring` reported the barrel as
// restored by nothing. Both builders take a `sense` now, defaulting to the going
// train's; the alarm's three callers pass this.
export const ALARM_SENSE = +1;

export const F_BALANCE = SPEC.vph / 7200; // Hz — balance frequency: vph/3600 beats/s, 2 beats per oscillation
export const BEAT_DEG = 12;             // escape-wheel advance per beat (half of 24° tooth pitch)
// TODO 192 step 4 — the balance's physical swing is TWO numbers, because one
// literal cannot honestly be both (it was: AMPLITUDE_TRUE_DEG = 270, which the
// spring could not sustain in any position at any friction corner). Both are
// the energy column's sustained-amplitude solve (main.js,
// EQUALISATION.going.energy), read in the safe direction for their use:
//  · AMPLITUDE_CLAIM_DEG — what the movement CLAIMS it keeps up. The solve's
//    MINIMUM over FRICTION's three corners and both positions (adverse,
//    vertical: 126.03° since TODO 207; 76.96° before it), rounded DOWN to a
//    whole degree: a claim that holds wherever and however the watch is
//    worn. Rounding to the nearest degree can over-claim.
//  · AMPLITUDE_PEAK_DEG — what every load on the oscillator is PRICED at
//    (§218's hairspring stress and pivot-load peaks, the hack brake): the
//    largest swing the balance can REACH, rounded UP, since a load priced below
//    it is not a bound. Since TODO 216 that is the SMALLER of two angles: the
//    solve's MAXIMUM (favourable, dial-flat: 454.80° since TODO 207) and the
//    KNOCK (main.js ESCAPEMENT_KNOCK: 315.22° since §221's bank, 314.18° before
//    it, where the impulse pin, carried
//    round from the far side, strikes the tip of the banked fork's horn, solved
//    off the fork blank's outline and the pin's radius). The balance cannot
//    swing past the knock; it banks on the horn. So the favourable dial-flat
//    corner, which the energy column would carry to 455°, knocks, and the peak
//    is the knock's 316° (315° before §221 derived the bank from the pin's own
//    bearing, which banks the fork 4.03° instead of 2.57°; 455° before TODO 216,
//    327° before TODO 207).
// Neither can be computed here, since the solve reads the cut ribbon, the
// pivots and the balance, and the knock the fork and the roller, all built in
// main.js. So `equalisation` row 14 holds each one on two sides: the SIDE
// (claim ≤ minimum, peak ≥ the reachable maximum) and the TIGHTNESS (each
// within one degree). A change that moves the solve or the escapement fails
// the gate until these move with it.
export const AMPLITUDE_CLAIM_DEG = 126;
export const AMPLITUDE_PEAK_DEG = 316;
// TODO 207 — and the swing the movement is DESIGNED to: a serviced Swiss lever
// watch holds 200° or more in the vertical positions, and a watchmaker reads
// less as a fault. It is held at the NOMINAL corner, the serviced state; the
// adverse corner (aged oil, the service interval's end) is reported, not
// targeted, and it is what AMPLITUDE_CLAIM_DEG claims. BAL_RIM_F is the
// heaviest rim that reaches it, and `equalisation` row 15 holds both.
export const AMPLITUDE_TARGET_DEG = 200;
export const AMPLITUDE_TARGET_SLACK_DEG = 1.5;   // one 0.005 step of BAL_RIM_F is 1.3° of nominal vertical swing (measured)
// §221 — THE SWING THE MESH PERFORMS IS THE SWING THE MOVEMENT IS DESIGNED TO.
// `AMPLITUDE_VISUAL_DEG = 45`, a readability number a sixth of a real swing, is
// retired: the balance is posed at AMPLITUDE_TARGET_DEG, the swing the energy
// column holds the movement to (vertical, nominal corner). It does not sag with
// the reserve — this movement has a FUSEE, whose level product (§104,
// `equalisation`, held at float noise over the whole reserve) delivers the same
// torque at hour 30 as at hour 0. At 2.5 Hz the swing is a blur to the eye, as a
// real balance is; the time-scale slider and §206's scrub are how it is read.
export const AMPLITUDE_POSED_DEG = AMPLITUDE_TARGET_DEG;
// §221 — THE LIFT ANGLE, the one authored escapement angle: the balance's
// rotation while its impulse pin is engaged with the fork, unlock to drop. A
// design fact of the Swiss lever, about 50° (Reymondin et al., The Theory of
// Horology, the lever-escapement chapter; Daniels, Watchmaking). The fork's
// bank (main.js, FORK_BANK_DEG) and the impulse window below both DERIVE from
// it; neither is chosen.
export const LIFT_DEG = 50;
// The fraction of a beat the balance spends inside ±LIFT/2 under
// θ = A·sin(ωt): the window straddles the zero crossing, entering at −L/2 and
// leaving at +L/2, so (2/π)·asin(L / 2A). 0.0797 at 50° and 200°; it was an
// authored 0.16 against a 45° swing.
export const IMPULSE_WIDTH = (2 / Math.PI) * Math.asin(LIFT_DEG / (2 * AMPLITUDE_POSED_DEG));
export const RECOIL_FRACTION = 0.25;    // portion of the impulse window spent on the recoil/draw dip
export const RECOIL_DEG = 1.0;          // escape wheel recoil during draw
// FORK_BANK_DEG / FORK_RECOIL_DEG are DERIVED in main.js (after the pallet
// fork and balance geometry exist), from rollerR and the notch's actual
// reach — see that derivation for why they can't be picked independently of
// the balance's roller radius without the impulse pin missing the notch. They
// are NOT pure, so they stay there.

// ---------------------------------------------------------------------------
// Z-stack — the depth budget between the back plate (z≈0) and the cocks. Each
// arbor's PINION sits at the layer where it meshes with the PREVIOUS wheel;
// its own WHEEL sits one layer further along, where the NEXT pinion meshes it.
// TORNADO Z-stack — compressed to a 1.7-unit wheel stride (the old uniform
// 3-unit staircase was half air). The three offsets expressed as formulas
// are real mechanical constraints, not styling:
//  · L_FORK = L_ESCAPE + 1.5 — the fork body's underside just clears the
//    escape wheel's top face while the stones (stoneZReach below) straddle
//    the tooth band;
//  · L_BALANCE — the balance now sits IN the three-quarter plate's z-band
//    (the classic Glashütte elevation: rim level with the plate, swinging in
//    the cutaway), derived below so its rim's underside binds exactly one
//    CLEAR_MARGIN above the fork body's top face;
//  · L_HAIRSPRING and the flat balance cock ride the balance.
// Stride 2.1 is the floor set by the BRIDGES, not the wheels: each cock is
// a centred slab ±(width·0.2 + bevel) thick, and it must fit between its
// own wheel pair's planes and the next wheel up that crosses it (solved:
// feasible only for stride ≥ ~2.06 at the current cock widths).
// ---------------------------------------------------------------------------
// §39 — the unit→mm mapping. PINNED, not chosen.
//
// The tempting definition is "pick the scale that puts the case under 40 mm".
// That is circular: it makes the size target true by construction and tests
// nothing. Instead the scale is pinned to the one dimension in this movement
// that is a MANUFACTURED STANDARD rather than a style choice — fusee chain
// pitch, whose tolerance is narrow because it has to run in a groove cut to
// match.
//
// The reference chain: A. Lange & Söhne cal. L044.1 (Richard Lange Pour le
// Mérite), the modern manufactured fusee-and-chain WRISTWATCH movement —
// 31.6 mm, i.e. the same class of movement as this one. Its chain is 212
// links over 152 mm → 0.72 mm rivet-to-rivet, 0.50 mm wide, 0.25 mm thick.
// (The entry originally pinned to "~0.30 mm pitch"; that figure was wrong —
// it sits in the WIDTH band of small chains, not any pitch. Pocket-watch
// chains are coarser still: ~0.36 mm thick × 0.8 mm tall sections.)
//
// The drawn pitch below converts the real 0.72 mm through §2's mapping study,
// which proposed ~0.38 mm/unit BY EYE from overall proportions, independent
// of any chain: 0.72 / 0.38 = 1.9 u. The pin then lands UNIT_MM at 0.379 —
// the two methods agreeing to 0.3% is the argument for the number.
//
// Everything else about the movement's real size is then a PREDICTION, and is
// asserted as one at the end of the build. Those asserts are allowed to fail;
// that is the whole point of deriving the scale from something else first.
// (Plate: 85.85 u → 32.5 mm. The reference movement carrying the same chain
// is 31.6 mm — a 3% cross-check the old 0.30 mm pin failed by 2.4×: with the
// chain drawn at true proportion it predicted a 77 mm plate.)
export const CHAIN_PITCH = 1.9;        // units, rivet-to-rivet (geometry — 0.72 mm at §2's 0.38 mm/u)
export const CHAIN_PITCH_MM = 0.72;    // REAL fusee chain — the manufactured standard this pins to
export const UNIT_MM = CHAIN_PITCH_MM / CHAIN_PITCH;   // 0.379 mm per unit
export const MM = (units) => units * UNIT_MM;          // for readouts and asserts

// --- THE CASE (backlog: watch case, schematic tier) --------------------------
// Owner caps, hard: case under 40 mm wide (crown excluded), lug width 20 mm
// at most. Converted once at the §39 pin so every downstream number is in
// units; the boot assert in main.js refuses a layout that outgrows them.
export const CASE_WIDTH_MAX = 40 / UNIT_MM / 2;   // radius cap, 52.77 units
export const CASE_LUG_SPAN_MAX = 20 / UNIT_MM;    // 52.77 units across the spring bar
// TODO 159/197 — WHEN IS A WORLD MATRIX RIGID ENOUGH TO MEASURE A DISTANCE IN?
// One law for the two places that measure through a possibly stretched matrix:
// inspect.js's `rigidFrame` (every battery distance) and main.js's JMP_SITE
// (the jumper lifter bar, cut at unit length and stretched onto its span). A
// frame whose column norms are within ε of 1 and whose columns are within ε of
// orthogonal misreads a distance d by at most ~ε·d. No two points of the
// movement are farther apart than the case's diameter, 2 · CASE_WIDTH_MAX =
// 105.5 u, and every report prints four decimals, so ε = 1e-4 / 105.5 ≈ 9.5e-7
// keeps the worst misreading below what any report can show. A frame
// tolerance, not a clearance margin: CLEAR_MARGIN stays the only one.
export const RIGID_EPS = 1e-4 / (2 * CASE_WIDTH_MAX);
// Classify a column-major 4×4 (three.js `Matrix4.elements`): 'rigid' (use it
// as it stands), 'scale' (orthogonal columns, L = Q·diag(n): bake diag(n) into
// the geometry and measure through Q plus the translation) or 'linear' (a
// shear: bake the whole linear part, keep only the translation). Pure, so
// both callers read the same decision; each builds its own matrices from `n`.
export function rigidSplit(e) {
  const n0 = Math.hypot(e[0], e[1], e[2]), n1 = Math.hypot(e[4], e[5], e[6]), n2 = Math.hypot(e[8], e[9], e[10]);
  const c01 = Math.abs(e[0] * e[4] + e[1] * e[5] + e[2] * e[6]) / (n0 * n1);
  const c12 = Math.abs(e[4] * e[8] + e[5] * e[9] + e[6] * e[10]) / (n1 * n2);
  const c02 = Math.abs(e[0] * e[8] + e[1] * e[9] + e[2] * e[10]) / (n0 * n2);
  const orthogonal = c01 <= RIGID_EPS && c12 <= RIGID_EPS && c02 <= RIGID_EPS;
  const unit = Math.abs(n0 - 1) <= RIGID_EPS && Math.abs(n1 - 1) <= RIGID_EPS && Math.abs(n2 - 1) <= RIGID_EPS;
  return { kind: orthogonal ? (unit ? 'rigid' : 'scale') : 'linear', n: [n0, n1, n2] };
}
// Movement-to-case clearance and band wall: 1 mm each, the dress-watch
// practice for a hand-wound movement ring seat — enough for the case
// screws' bite and the movement ring's spring, not a micron more (the cap
// above is what makes this a budget: plateR + clear + wall must stay
// under it).
export const CASE_CLEAR = 1 / UNIT_MM;            // 2.64 units
export const CASE_BAND_T = 1 / UNIT_MM;           // 2.64 units
// Case screws (§186's movement clamps — Ø1.0/1.8 mm cheese heads). §3's
// six caseback screws used the same stock until §187 deleted them with the
// flange they threaded: the flange stood across §186's casing path
// (measured, probe-187-casing-path), and the back is a THREADED ring now —
// the owner's call, revisiting §3's screws-over-thread call once the
// screws' flange turned out to cost the assembly itself.
export const CASE_SCREW_SHAFT_D = 1.0 / UNIT_MM;  // Ø1.0 mm shaft
export const CASE_SCREW_HEAD_D = 1.8 / UNIT_MM;   // Ø1.8 mm head
// The gasket: 0.5 mm cord in a 0.2 mm groove in the middle's back face,
// standing 0.2 mm proud — squeezed to 0.4 mm, the usual 20% O-ring squeeze
// for a static face seal (by the §187 ring's seating face now; preload
// from its thread).
export const CASE_GASKET_D = 0.5 / UNIT_MM;
export const CASE_GASKET_SEAT = 0.4 / UNIT_MM;
// Crystal: 0.6 mm flat (owner: very aggressive on thickness — 0.6 mm is
// thin but stock sapphire/mineral), seated before the bezel traps it; hand
// to underside clearance 0.3 mm (the crystal plane itself is MEASURED from
// the tallest hand in main.js — a constant here would lie the moment a
// hand grows).
export const CASE_CRYSTAL_T = 0.6 / UNIT_MM;
export const CASE_CRYSTAL_CLEAR = 0.3 / UNIT_MM;
// Crown tube and alarm pusher: standard Ø2.0 mm tube bore for the winding
// stem, Ø1.2 mm for the pusher; the pusher sits flush — "discreet" is the
// owner's word for it.
export const CASE_TUBE_D = 2.0 / UNIT_MM;
export const CASE_PUSHER_D = 1.2 / UNIT_MM;
// Lug and spring-bar stock (§190). ONE declaration — the solid builder
// (geometry.js makeCase), the schematic line tier (main.js) and
// probe-lug-geom.mjs all consume these; before §190 the same numbers were
// hand-copied at all three sites, the recurring one-direction-written-twice
// defect with a longer fuse.
export const CASE_LUG_T = 1.2 / UNIT_MM;      // lug thickness across the strap — stamped-lug plate stock
export const CASE_LUG_W = 3.0 / UNIT_MM;      // lug height along z: carries the spring-bar bore with a wall each side ((3.0 − 1.5)/2 = 0.75 mm)
export const CASE_LUG_ROOT = 0.8 / UNIT_MM;   // embed into the band — the brazed stamped-lug truth (a 0.3 mm first cut read as floating at screen scale)
// TODO 209 — the foot's depth is bounded by the wall it is brazed INTO. The
// lugs stand ±(span + T)/2 off the pair axis, where the back band's bore has
// risen to the chord depth sqrt(R_BORE_BACK² − x²) — and it rises fastest at
// the lug's INBOARD face (the smaller |x|), so that corner is where a fixed
// embed breaks through first. Measured: CASE_LUG_ROOT alone left the corner
// 0.02 u inside the band and 0.09 u off the plate rim seated in that bore —
// a solder foot with no wall behind it, under CLEAR_MARGIN to the movement.
// The root therefore stands one sheet floor (STOCK_MIN_U, §50) of band metal
// outboard of the bore at that corner whenever the brazed-embed intent would
// sink it deeper. ONE law for the solid (geometry.js) and the line tier.
export const caseLugRootR = (off, rOut, rBore) => {
  const surfR = Math.sqrt(Math.max(rOut * rOut - off * off, 0));
  const xIn = Math.abs(off) - CASE_LUG_T / 2;
  const boreR = Math.sqrt(Math.max(rBore * rBore - xIn * xIn, 0));
  return Math.max(surfR - CASE_LUG_ROOT, boreR + STOCK_MIN_U);
};
export const CASE_LUG_Z_OFF = 0.5 / UNIT_MM;  // the lug band's z offset above the ledge plane (the value the pre-§186 seat face had)
export const CASE_SPRING_BAR_D = 1.5 / UNIT_MM; // Ø1.5 mm — the standard double-flanged spring bar for a 20 mm strap
// The wrap gap — owner spec 2026-09-01: at least 2.0 mm between case metal
// and the bar's surface everywhere on the wrap path, the thickness of strap
// that can wrap the bar (two-piece ends run 1.2–1.8 mm there; a one-piece/
// NATO doubles its layer). With CASE_LUG_INNER this is the strap's other
// purchase dimension: bought 20 mm wide, wrapped up to 2.0 mm thick.
export const CASE_STRAP_CLEAR = 2 / UNIT_MM;
// The bar's radial station DERIVES from the gap, so the 2.0 mm holds by
// construction — the shipped pre-§190 bar sat at band + 1.4 mm and left a
// 0.65 mm gap no strap passes.
export const CASE_BAR_REACH = CASE_STRAP_CLEAR + CASE_SPRING_BAR_D / 2;  // bar CENTRE past the band wall (2.75 mm)
// The lug tip derives from the BAR (pre-§190 the bar derived from the tip
// and stood 0.45 mm proud of it — metal no drilled lug presents): the tip
// keeps a third of the bore Ø of metal beyond the bore, stamped-lug
// practice.
export const CASE_LUG_TIP_WALL = CASE_SPRING_BAR_D / 3;                  // 0.5 mm beyond the bore
export const CASE_LUG_REACH = CASE_BAR_REACH + CASE_SPRING_BAR_D / 2 + CASE_LUG_TIP_WALL; // lug TIP past the band wall (4.0 mm; tips-across = body Ø + 2×this)

// --- READING SIZE IS DERIVED FROM ACUITY (§158) -----------------------------
// A printed feature's size is not a taste question once you name the distance
// it is read from. These turn "how big should it be" into arithmetic, the way
// UNIT_MM above turns "how big is a unit" into arithmetic.
//
// The reference distance is the WRIST: a watch is read at arm's-bend, not at
// desk range. 350 mm is the middle of the 300–400 mm band a raised wrist
// spans, and every figure below is quoted at it — move this and the whole
// print re-solves, which is the point of it being one constant.
export const WRIST_MM = 350;
const ARCMIN_PER_RAD = 60 * 180 / Math.PI;             // 3437.75
export const arcminAt = (mm) => (mm / WRIST_MM) * ARCMIN_PER_RAD;
export const mmForArcmin = (a) => (a * WRIST_MM) / ARCMIN_PER_RAD;
// The three floors, in the eye's own units. 20/20 acuity resolves a 1 arcmin
// stroke, and a LETTER at that threshold stands 5 arcmin — that is the
// definition of the Snellen line, not a rounding of it. Identification at
// threshold is not reading, though: a numeral is read at a GLANCE at about
// 1.6× it, which is the floor a dial figure has to meet to be an instrument
// rather than a decoration.
export const RESOLVE_ARCMIN = 1;      // a gap smaller than this is not a gap
export const IDENTIFY_ARCMIN = 5;     // threshold: the character can be told apart
// Read without effort rather than merely resolved — the floor a dial figure
// has to meet to be an instrument. Written as the MULTIPLE it is (1.6× the
// threshold, = 8′) rather than as an 8 that would have to be re-justified if
// the threshold above were ever restated.
export const GLANCE_ARCMIN = IDENTIFY_ARCMIN * 1.6;
// A pointer is not read as a character, it is read as a POSITION, so its own
// floor is lower — but it must not be finer than the marks it indexes (that
// floor is the graduation's, asserted at the build site) and it must stay
// inside one division or it stops saying which one it is on.
export const POINTER_ARCMIN = 3;
// Cap height as a fraction of the em, for the sans the dial sets its figures
// in. Helvetica's is 0.717; every acuity figure above is a CAP height, and
// canvas takes an em, so the two are never the same number.
export const CAP_PER_EM = 0.717;
// The chain's CROSS-SECTION, from the same reference chain through UNIT_MM
// (real mm in each comment). Lives here with the pitch — the fusee cone's
// groove pitch and base seat consume the stack height long before the chain
// itself is built, and stock that sets the movement's scale should not be
// scattered as literals at its point of use.
export const CHAIN_PIN_LEN = 0.66;     // 0.250 mm — the joint's plate stack (4 leaves), = pin length
export const CHAIN_LEAF_GAP = 0.02;    // render shim between leaves: shows the rivet, avoids z-fighting
// One plate leaf. The real stack is 4 solid leaves of ~0.06 mm; drawn with
// the two shims per half-stack folded out: (0.66/2 − 2·0.02)/2 = 0.145 u
// (0.055 mm).
export const CHAIN_PLATE_T = (CHAIN_PIN_LEN / 2 - 2 * CHAIN_LEAF_GAP) / 2;
export const CHAIN_END_R_OUT = 0.66;   // outer plate half-width: 2·0.66 u = 0.50 mm real width
export const CHAIN_END_R_IN = 0.575;   // inner plate steps in by the same 0.87 the shipped chain drew
export const CHAIN_PIN_R = 0.27;       // rivet: 0.54 u dia = 0.29·pitch, the roller-chain proportion (0.20 mm)
// THE RIVETED JOINT (TODO 27 rows 2 and 3). The pin passes through four
// drilled leaves and is upset at each end; all three numbers below are that
// sentence made buildable.
//
// The joint's running fit. The inner pair TURNS on the pin — that is what a
// chain joint is — so its bore is one running clearance over the pin: 0.01 mm
// diametral, the shake a real watch pivot runs in its jewel, at this pin's
// 0.20 mm diameter. Half of it, radially:
export const CHAIN_RIVET_FIT = 0.005 / UNIT_MM;   // 0.013 u
// The head. Formed rivet heads run 1.5x the shank across, in this movement as
// in every other riveted thing; at the outer leaf's 0.66 half-width that
// leaves 0.255 u (0.097 mm) of plate around the recess, which is why the
// proportion is affordable here at all.
export const CHAIN_RIVET_HEAD_R = CHAIN_PIN_R * 1.5;   // 0.405 u — 0.31 mm across
// ...and the head is formed INSIDE the outer leaf, not proud of it. That is
// forced, not chosen: the fusee's groove land is 0.025 u over its 0.02 crest
// floor (FUSEE_LAND_W in main.js), which is 0.005 u of extra chain width the
// movement can afford — 0.0025 a side — and the drum's coils lie only 0.03
// apart (CHAIN_COIL_PITCH below). No head worth forming fits in that. A rivet
// that may
// not stand proud is countersunk: the outer leaf is counterbored at the head
// diameter and the pin upset into the recess, flush with the face. Depth
// splits the outer leaf in half, so the formed head and the land it bears on
// are the same thickness and neither is the joint's weaker member.
export const CHAIN_RIVET_HEAD_T = CHAIN_PLATE_T / 2;   // 0.072 u — 0.027 mm
// Successive coil turns on the drum lay one stack apart plus a lay gap so
// they never bind — the gap is the 0.03 the shipped 0.65-over-0.62 implied.
export const CHAIN_COIL_PITCH = CHAIN_PIN_LEN + 0.03;
// §50/TODO 12: the wheel-and-plate stock floor, in UNITS, so a thickness can
// be built to clear it rather than measured against it after the fact.
export const STOCK_MIN_U = 0.12 / UNIT_MM;             // 0.317 u
// §54's slenderness ceiling, L/t. Lives HERE rather than in inspect.js so the
// GEOMETRY can be derived from the same number the CHECK enforces — a part
// sized against the check that measures it cannot drift away from it.
export const SLENDER_MAX = 30;
// What to BUILD to. Sizing a part at exactly `SLENDER_MAX` puts it on the
// boundary, where float rounding decides which side it lands — the beak tail
// came back at λ 30.0 and was still reported. That is `JMP_BIND_EPS`'s lesson
// in a new place: never build exactly to the limit a check compares against.
// 10% headroom, so a part that drifts slightly still passes and one that
// drifts a lot still fails.
export const SLENDER_TARGET = SLENDER_MAX * 0.9;      // 27
// §234 (TODO 145 group B, step 5) — A STAMPED LINK'S SECTION. The hack and
// reset links are flat stamped levers, not turned rods (the owner's call: a
// real caliber's hack lever and reset hammer ARE stampings, and a flat link is
// no body of revolution for `turning` to judge). Two numbers, two constraints:
//   · THICKNESS is the sheet, and the sheet is §50's floor because the low
//     corridor allows nothing thicker — main.js derives the two planes from
//     the tail bar and the great wheel and asserts the stack; measured, two
//     links with a margin between them would want T ≤ 0.247 u, under the
//     floor, so they are cut AT it and stand 0.045 apart where they cross.
//   · The link is NECKED, as a stamped lever is: a narrow BODY and a round
//     EYE at each end. The eye is the PIN's — a link's end wraps the pin it
//     rides with a wall of stock either side, so its diameter is 2 · (pin
//     radius + the running fit + §50's floor); both links ride the setting
//     lever's post family. The body is the BLANKING floor: a feature narrower
//     than twice the sheet tears or curls in the die (sheet-metal blanking
//     practice's ≈ 2t minimum), so the body is at least 2 · LINK_T_U — and
//     main.js holds it above a SECTION floor too, no weaker in the bend's
//     plane than the ⌀0.7 rod it replaces (0.765 u governs). The load-derived
//     floors sit under that and are ASSERTED beside each row in main.js rather
//     than built to: the bend's moment acts in the strip's plane (Z = T·W²/6,
//     held under the one steel's yield at ELBOW_E_MAX), and the weak axis
//     W·T³/12 is a straight strut's Euler axis, held under the detent ceiling.
// MEASURED AND REFUSED FIRST, TWICE. §54's ceiling applied in plan over the
// chord (W = chord / SLENDER_TARGET, the rule §229 gave the alarm link's
// beak) cut the hack link 2.45 u wide — a ROD's rule: a strip bends about its
// thin axis, which no width answers and the Euler assert already holds. Then
// one blank at the eye's width (1.633 u) for the whole length: with the
// third arbor's staff in the corridor table (main.js, §234) no station about
// the balance routes a hack link wider than ≈ 1.0 u, so a full-width blank
// fails at P3 where a necked one — the body 0.633 u between the eyes — passes
// the same corridor the ⌀0.7 tube did, with the eyes standing where the tube's
// ends already stood, on their pins.
export const LINK_T_U = STOCK_MIN_U;
export const LINK_BODY_W_U = 2 * STOCK_MIN_U;                                            // 0.633 u — the blanking floor, ≈ 2t
export const linkEyeDiaForPin = (pinR_u, fit_u) => 2 * (pinR_u + fit_u + STOCK_MIN_U);   // fit_u: the movement's one running fit, PIVOT_BORE_CLEAR (above) — passed, not re-declared
// An OVERHANG past the last bearing bends like a cantilever, and §54 charges
// it a length multiplier for that — ∛(48/3), the ratio of a midspan-loaded
// simple beam's stiffness to a tip-loaded cantilever's, taken into LAMBDA
// space. The full derivation, and why it is a bending measure rather than
// buckling's K, is written at checkSlenderness in inspect.js, which is where
// a reader of the CHECK meets it. It lives here because it is not only the
// check's: anything SIZED against §54's ceiling has to size against what §54
// actually measures, and §36's applied arbors do (see routeApplySolve).
export const SLENDER_OVERHANG_K = Math.cbrt(48 / 3);   // 2.5198
// §233's TURNING ceiling, L/D — the OTHER slenderness, and the pair above does
// not imply it. §54's λ asks whether a member bends IN SERVICE, over the free
// span between its bearings; this asks whether it bends UNDER THE TOOL, over
// the whole bar standing out of the chuck. A member can pass one and fail the
// other by a factor of four, and §232's lay shaft does: λ 27, L/D 104.
//
// The constraint is the cut itself. A turning tool pushes SIDEWAYS on the
// work, so a slender bar deflects away from it — the cut comes out tapered,
// then it chatters, then the finish tears. The practical limits are the ones
// every machining reference gives: L/D 10 with the far end unsupported, L/D 20
// with a follower rest or between centres. Past that a bar is not turned at
// all; it is ground, or it is drawn wire.
//
// THE GATE IS THE SUPPORTED LIMIT, not the unsupported one, because supporting
// the work is a choice the shop makes and the geometry cannot express. 10 is
// REPORTED beside it as "this one needs a rest", which is a cost, not a
// refusal.
export const TURN_LD_MAX = 20;
export const TURN_LD_UNSUPPORTED = 10;
// What to BUILD to, on SLENDER_TARGET's reasoning exactly: sizing to the
// boundary lets float rounding pick the side. Same 10% headroom, same reason.
export const TURN_LD_TARGET = TURN_LD_MAX * 0.9;       // 18
// FLAT-SPRING stock. §50's spring floor is 0.03 mm and its own basis says why
// that is a floor and not a target: "real hairsprings run 0.02-0.04 mm; flat
// springs THICKER". A click detent or a feeler return is a flat blade, not a
// hairspring, so it is sized at 0.05 mm — the low end of real flat-spring
// stock, clearing the floor on merit rather than grazing it.
export const SPRING_FLAT_U = 0.05 / UNIT_MM;          // 0.132 u
// §50's SPRING floor itself, in units, beside the wheel and pivot floors for
// the same reason: a ribbon should be CUT against it, not measured against it
// afterwards. Flat blades take SPRING_FLAT_U above; a SPIRAL is the other form
// the floor's own basis names ("real hairsprings run 0.02-0.04 mm"), and TODO
// 194's follower return spiral is the first one outside the oscillator.
export const SPRING_MIN_U = 0.03 / UNIT_MM;           // 0.079 u
// §50's PIVOT floor, in units, beside the wheel floor for the same reason:
// pin and post stock should be CUT to it, not measured against it afterwards.
// Basis is the check's own — "real train pivots run 0.07-0.12 mm".
export const PIVOT_MIN_U = 0.07 / UNIT_MM;            // 0.185 u
// A ROUND BAR'S RADIUS, so that its FLATS carry a thickness floor.
//
// §50's census reads the TESSELLATED stock: a bar drawn with `n` radial
// segments is an n-gon, and its geometry-local box measures the flats
// (2·r·cos(π/n)), not the circumcircle. That is a deliberate reading, not a
// ruler bug — the mesh is what every other instrument collides against too —
// so a bar that must clear a floor has to clear it ACROSS THE FLATS. At the
// n = 10 this movement's posts and pins are drawn with, the difference is
// 4.9%: a nominal ⌀ 0.12 mm bar measures 0.114 and lands in the debt.
//
// `ALARM_A_PIN_R` was the first constant derived this way (§45's tail pin,
// against the pivot floor) and wrote the rule out longhand; this is that
// derivation named once so the next bar does not re-litigate it.
export const flatsR = (thicknessU, segments) => (thicknessU / 2) / Math.cos(Math.PI / segments);
export const STOCK_MIN_R10 = flatsR(STOCK_MIN_U, 10);  // 0.167 u — ⌀ 0.12 mm across the flats

export const CLEAR_MARGIN = 0.15; // ONE structural margin — shared by the plate
                                  // z-stack and the hack solvers, and by
                                  // the balance plane derivation itself.
// The running fit every plate bearing is cut to — a real pivot's side-shake.
// Declared here since TODO 168 (it was main.js's): geometry.js cuts every
// makeGear/makePinion bore against it too, spending at most HALF of it on
// chord sag (`borePath`), so the fit and the tessellation cannot drift apart.
export const PIVOT_BORE_CLEAR = 0.05;

// §77 — the zero-area floor, DERIVED (rule 1): tools/probe-77-threshold.mjs
// histograms every inspected triangle's geometry-local area; the defective
// population (absarc seam twins, earcut hole-bridge slivers) tops out in the
// 1e-15 decade and the smallest INTENDED triangles start at 1e-10, a
// four-decade empty band. 1e-12 sits two decades from each bound; re-run the
// probe before moving it. It lives here (not in inspect.js, which re-exports
// it) because the build's own solves need it too — TODO 180: JMP_SITE read a
// false contact off exactly such a sliver.
export const ZERO_AREA_MAX = 1e-12;

// §137 — THE ONE STEEL, and the one cantilever law, for force arithmetic.
// Every force figure in the repo is first-order solid-steel beam arithmetic
// (TODO 16's own caveat: the absolute numbers carry maybe a factor of two;
// the RATIOS are what conclusions rest on). Before §137 the modulus lived as
// two private copies (inspect.js's slenderness report and main.js's
// oscillator solve) that could only drift apart; this is that number named
// once, with both prior sites re-sourced as consumers.
export const STEEL_E_PA = 200e9;  // Pa — carbon/spring steel Young's modulus (§56's value)
// TODO 144 — THE ONE FRICTION COEFFICIENT for steel sliding on steel, named.
// It was already load-bearing before it had a name: sawCouplingSpec below has
// stood its friction cone on `mu = 0.2` since TODO 50, so a second copy written
// at the alarm disc's track would be the recurring defect (one number, two
// sites) with a coefficient. A dry-to-lightly-oiled steel pair — conservative
// for a DRAG (a well-oiled pin reads lower) and the honest value for a HOLD (a
// friction spring is not oiled), which is why one number serves both sides of
// the hold budget rather than a flattering pair.
export const MU_STEEL = 0.2;
// §164 — the other two numbers a SPRING needs, beside the one modulus. Both
// were about to be written a second time inside main.js: the yield was already
// there as a bare 800e6 inside SPRING_STRAIN_MAX, and a shear modulus was about
// to appear for the pusher's return coil. §137's rule ("the one steel, named
// once") applies to a material's other properties too, so they live here.
export const STEEL_NU = 0.30;                     // Poisson's ratio — carbon steel
export const STEEL_G_PA = STEEL_E_PA / (2 * (1 + STEEL_NU));   // 76.9 GPa
// Hardened carbon spring band, the stress a blade or a coil may work to and
// come back from. TODO 63 was filed precisely because `switchClickSpring`
// exceeded it — and §173 closed that by deleting the part: the sautoir that
// replaced it SOLVES its free length from this number rather than being
// measured against it afterwards, which is the direction a limit should be
// used in.
export const SPRING_SIGMA_Y_PA = 800e6;
// Shear yield by von Mises — what a COIL is limited by, where a blade is
// limited by SPRING_SIGMA_Y_PA directly. One yield, two loadings.
export const SPRING_TAU_Y_PA = SPRING_SIGMA_Y_PA / Math.sqrt(3);
// TODO 193 — THE MAINSPRING ALLOY, named, and why it is not SPRING_SIGMA_Y_PA.
// The 800 MPa above is the hardened CARBON band every blade and click in the
// movement is solved or gated against; the two ribbons that POWER the watch
// work an order of stress beyond any blade (σ = E·a·θ/L over a whole wind, not
// a click's deflection), and real mainsprings are drawn from a different
// material for exactly that reason: a cobalt–nickel–chromium precipitation
// alloy, the Nivaflex 45/18 class (DIN 2.4782), which is what high-grade
// watches wind today. Its properties, from the alloy's published data
// (Hempel Metals' 2.4782 sheet, quoting VACUUMSCHMELZE's): Young's modulus
// 220 GPa; yield Rp0.2 950 MPa solution-annealed and 1800–2550 MPa after
// hardening, the spread being the degree of cold work before the age; tensile
// strength up to 3000 MPa. A BAND, as FRICTION's rows are, because the
// movement does not say how hard its ribbon was drawn — and the gate reads the
// LOW end, the adverse corner, so a verdict cannot depend on assuming the best
// stock in the catalogue. The ribbons' k and stress both use this modulus; the
// hairspring and every blade keep STEEL_E_PA.
export const MAINSPRING_E_PA = 220e9;
export const MAINSPRING_SIGMA_Y_BAND = Object.freeze({
  low: 1800e6, high: 2550e6, ultimate: 3000e6,
  why: 'Nivaflex 45/18 (DIN 2.4782) Rp0.2 after hardening, 1800–2550 MPa by degree of cold work; Rm up to 3000 MPa (Hempel Metals / VACUUMSCHMELZE data)',
});
export const MAINSPRING_SIGMA_Y_PA = MAINSPRING_SIGMA_Y_BAND.low;
// §234 — A COIL'S INDEX, D/d: the envelope a compression spring can be WOUND
// in. Under 4 the wire cracks on the coiling arbor; over 12 the coil tangles
// on the winder and its rate is not held — the spring-design handbooks' 4–12.
// It exists because the pusher's return coil rides its stem: the stem's stock
// sets the coil, the coil sets the WIRE, and a stem cut to stem stock
// (STEM_STOCK_R_U) took the 0.05 mm wire's index from 6.6 to 15.8 without a
// number changing hands. The wire is solved to the TARGET (0.9 · max, on
// TURN_LD_TARGET's reasoning — never to the boundary a check compares
// against) and the coil is asserted inside the envelope at boot.
export const SPRING_INDEX_MIN = 4;
export const SPRING_INDEX_MAX = 12;
export const SPRING_INDEX_TARGET = SPRING_INDEX_MAX * 0.9;   // 10.8
// End-loaded cantilever stiffness in N/m from section width a, thickness c
// (bending direction) and free length L, all in MODEL UNITS — the 3EI/L³ that
// TODO 16 and the §54 report both already compute longhand. I = a·c³/12.
export const cantileverK_N_per_m = (a_u, c_u, L_u) => {
  const m = UNIT_MM / 1000;                       // m per unit — §39's pin
  const I = (a_u * m) * (c_u * m) ** 3 / 12;      // m⁴, thin axis = c
  return 3 * STEEL_E_PA * I / (L_u * m) ** 3;
};
// §231 — THE ONE EULER LAW. A slender member loaded ALONG its own length does
// not fail by yielding, it BUCKLES, and P_cr = π²EI/(K·L)² is the first
// question to ask of one. The expression lived inline inside main.js's
// `priceRigidBentLink` (§137's beam-column pricing) and was about to be
// written a second time for the pusher's reach bar — "one law written twice",
// the defect CLAUDE.md's direction-guard entry names, where only one copy ever
// learns when it moves. Both sites read this one.
//
// K IS THE CALLER'S CLAIM ABOUT THE ENDS, and it has no default on purpose:
// 1 for pinned–pinned (both ends located against translation, free to rotate),
// 2 where one end is free to sway. A strut whose end condition nobody stated
// is a strut nobody has sized, and K enters SQUARED — the difference between
// the two readings is a factor of four in the load the member survives.
//
// I is in m⁴ (the caller's section, computed the way cantileverK_N_per_m
// computes its own), L in units, the answer in newtons.
export const eulerCriticalLoad_N = (I_m4, L_u, K) => {
  const m = UNIT_MM / 1000;                       // m per unit — §39's pin
  return Math.PI * Math.PI * STEEL_E_PA * I_m4 / (K * L_u * m) ** 2;
};
// §137 — THE DETENT ENVELOPE, declared instead of asserted in prose.
// TODO 16 sized the arming chain against "a detented selector ring plausibly
// needs 5–50 mN" and that band was never anyone's constant — it lived in the
// item's text and was quoted forward by CLAUDE.md. The basis: wristwatch
// jumper/detent indexing loads at the tooth run single-digit to tens of mN
// (keyless and corrector jumpers), and the repo's own click arithmetic
// (§137's switch-click torque row) must land INSIDE this window — a miss is
// a finding against the click, never a reason to retune the window. This is
// a budget ENVELOPE in the design-priority sense: inherited by every fork,
// never forkable.
export const SELECTOR_DETENT_WINDOW_MN = Object.freeze([5, 50]);
// §137 — what a finger delivers to a case pusher, the input end of every
// press-driven chain. Measured chronograph-pusher actuation forces run about
// 1–5 N at the cap; the band's LOW end is the honest working figure (a light
// press), the high end the structural ceiling a pusher train must survive.
// An input band, not a target: chains are sized against their DOWNSTREAM
// windows (the detent envelope above), and this states what the finger has.
export const CASE_PUSHER_INPUT_N = Object.freeze([1, 5]);
// §169 / TODO 144 — THE DRAG-AGAINST-HOLD MARGIN, an envelope like the two above
// (hoisted from main.js's §169 block by TODO 144, which prices a second hold —
// the alarm release disc's seat — against it).
// The margin between any two spring forces in the arming chain — how much weaker
// than the detent the pawl's return drag must be, and (§164) how much stronger
// than that drag the pusher's own return must be. One number for both because
// it is one argument: every side of both comparisons is first-order beam
// arithmetic off the SAME modulus, and layout.js says what that is worth in its
// own words — the absolutes carry maybe a factor of two, "the RATIOS are what
// conclusions rest on". So the margin has to clear the ratio's error, not the
// absolutes' — 3× does, and it is what the mechanism can actually be built to.
// (A first pass asked for an order of magnitude on the grounds that a 2× margin
// sits inside the arithmetic's error. That reasoning applies the absolute
// caveat to a ratio, and it costs a real blade: 10× wants 5.49 u of free
// length against 3.67, with the anchor half again as far out.)
export const ALARM_SPRING_HEADROOM = 3;

// TODO 192 / §247 tier two — THE FRICTION TABLE: every coefficient the power
// budget needs and the movement cannot measure, declared ONCE, as a BAND.
//
// A watch is a chain of sliding contacts between a ribbon and a balance, and
// nothing in this file knew the price of one. The budget (main.js's
// EQUALISATION.going.energy) walks the going spring's energy through the drum,
// the chain, the fusee, four meshes, four pivoted arbors and the escapement,
// and asks what amplitude is left for the balance. Each row here is a
// literature figure for ONE kind of contact — not a fit, not tuned against
// this movement, and never a single number: a `favourable` corner (the
// kindest value a reference will support), a `nominal` one, and an `adverse`
// one. The budget runs all three and a conclusion that flips between corners
// is not a conclusion. The ordering IS the claim and inspect.js holds it:
// favourable must cost the least at every row, adverse the most.
//
// `MU_STEEL` above is the adverse corner of every steel-on-steel row, by
// reference — the one steel, named once (§137's rule). A dry, unpolished pair
// is the worst a watch contact gets, and it is exactly what MU_STEEL was
// sized for; the kinder corners are what oil and polish buy.
export const FRICTION_CORNERS = Object.freeze(['favourable', 'nominal', 'adverse']);
export const FRICTION = Object.freeze({
  // Brass wheel on hardened steel pinion, running DRY — train teeth are never
  // oiled (oil there collects abrasive).
  muTooth:  Object.freeze({ favourable: 0.12, nominal: 0.15, adverse: MU_STEEL,
    why: 'brass on hardened steel, dry; the adverse corner is MU_STEEL' }),
  // Polished steel pivot in an oiled ruby hole (a 9010-class oil).
  muJewel:  Object.freeze({ favourable: 0.10, nominal: 0.12, adverse: 0.15,
    why: 'polished steel in oiled ruby; the adverse corner is a thinned or aged oil' }),
  // Steel pivot in an oiled brass or steel bush — the fusee's plain top
  // bearing, the drum on its fixed arbor.
  muPlain:  Object.freeze({ favourable: 0.12, nominal: 0.15, adverse: MU_STEEL,
    why: 'steel in an oiled plain bush; the adverse corner is MU_STEEL' }),
  // The chain's rivets articulating in their links, lightly oiled.
  muChain:  Object.freeze({ favourable: 0.10, nominal: 0.15, adverse: MU_STEEL,
    why: 'steel rivet in steel link, lightly oiled; the adverse corner is MU_STEEL' }),
  // The ribbon's own coil-on-coil friction, as an efficiency (let-down vs
  // wind-up hysteresis of a greased mainspring). This ribbon runs within 0.8%
  // of coil bind at full wind (TODO 40), which argues for the lower half.
  springInt: Object.freeze({ favourable: 0.95, nominal: 0.90, adverse: 0.85,
    why: 'greased ribbon hysteresis; this one runs near coil bind' }),
  // Swiss lever escapement, escape-wheel work to balance work: drop, draw,
  // impulse-face sliding and unlocking — the classical measured range.
  escEff:   Object.freeze({ favourable: 0.40, nominal: 0.35, adverse: 0.30,
    why: 'Swiss lever, escape-wheel energy delivered to the balance' }),
  // The balance's Q with PIVOT friction removed (air, hairspring hysteresis,
  // the pin and fork): the pivot term is computed from the staff, not assumed.
  qOther:   Object.freeze({ favourable: 500, nominal: 350, adverse: 250,
    why: 'balance Q from everything but the pivots' }),
  // Dial-flat, the rounded pivot END bears on the endstone; the friction
  // radius is that contact's, not the staff's. In mm.
  endContactMm: Object.freeze({ favourable: 0.01, nominal: 0.02, adverse: 0.03,
    why: 'contact radius of a rounded pivot end on its endstone' }),
});
// RESTRIDDEN STACK — solved BOTTOM-UP from the low-escapement layout: the
// oscillator hangs under the open plate cutaway, and the plate's own floor
// binds on the hairspring stack (the fusee was dropped to make that true —
// see FUSEE_BASE_Z). Chain, with the slim balance: L_FORK/L_ESCAPE ≈ 4.91 →
// L_BALANCE ≈ 6.35 → spring top ≈ 7.97 → cock underside = plate floor
// ≈ 8.12 (wheels that XY-overlap must never share z; each step is
// half-thickness sums + the one margin; the whole stratum rides
// UPPER_STRATUM_RAISE above its pre-§124 planes — see that constant).
export const L_BARREL = 2;     // great-wheel plane (meshes center pinion) — fixed: drum/fusee/chain ride this side
// Center wheel dropped onto its own bind: one margin over the great wheel's
// top face, at the wheel's deepest feature (its hub ring, thickness·1.5/2 =
// 0.75 below the mid-plane). The old 4.85 carried ~1.2 of slack left over
// from the nest-under-the-escape era — slack the fusee now needs: the
// chain's lowest span must clear THIS wheel's top face, and every 0.1 here
// is 0.1 the cone (and with it the whole plate stack) cannot drop.
export const L_CENTER = (L_BARREL + 0.7 + 0.08) + CLEAR_MARGIN + 0.75;
// §124 (TODO 46) raised the upper stratum — third, fourth and escape planes —
// by the leaning chain's extra down-reach, √(h² + w²) − h, so the groove
// floor could rise by the same amount with the band preserved. §254 (TODO
// 208) stood the chain up: the groove is cut as a fusee engine cuts it and
// the lean, with its down-reach, is gone, so the groove floor stays on the
// centre wheel's bind and the raise is now CONE HEIGHT — the whole 0.408 is
// band, which is TODO 208's second lever bought in position space (CLAUDE.md
// P3). It is what brings the equalising flank's base slope under the
// one-wall bound an upright stack needs (|dr/dz| ≤ grooveD/(grooveW/2) —
// main.js asserts it at boot: the slope scales as 1/BAND under the held
// level product, 2.02 on the old band). The value is the raise §124 made,
// kept in metal because lowering the stratum back would spend it; it is
// named for what it is now rather than for the lean that first asked for it.
export const UPPER_STRATUM_RAISE = Math.hypot(CHAIN_PIN_LEN / 2, CHAIN_END_R_OUT) - CHAIN_PIN_LEN / 2; // 0.40790
export const L_THIRD = 5.95 + UPPER_STRATUM_RAISE;   // = L_FOURTH − (fourth 0.4 + margin + third 0.45)
export const L_FOURTH = 6.95 + UPPER_STRATUM_RAISE;
// ESCAPE WHEEL BELOW THE FOURTH WHEEL — the low-escapement layout: the
// wheel drops under the whole train while its pinion stays up in the
// fourth wheel's plane (the arbor spans the gap). The ceiling is the
// fourth arbor's PINION, which meshes the third wheel at L_THIRD and
// spans 5.15..6.75: escape wheel top (L + 0.4) stays 0.25 under it.
// Below, its own neighbourhood is clear: the nearest train discs
// (center, third) are 19+ away in XY, and the fourth arbor is bare
// staff at this depth.
export const L_ESCAPE = 4.5 + UPPER_STRATUM_RAISE;
export const FORK_T = 1.2;     // pallet-fork body thickness (= makePalletFork's `thickness`)
// FORK INLINE WITH THE WHEEL: one shared plane, the way a real lever
// escapement is built — the stones engage in the fork's own z-band
// (stoneZReach = 0) instead of reaching down 1.5. The fork's outline
// clears the wheel disc everywhere except the stones (arms straddle
// outside the rim; the belly stays a full radius below it), so
// coplanarity costs nothing laterally and buys the whole stone reach
// in depth — which the balance, spring and cock all inherit.
export const L_FORK = L_ESCAPE;
// TODO 98 — the lapping chamfer on the fork BLANK, as a fraction of its
// FINISHED thickness. It lives here rather than inside `makePalletFork`
// because `L_BALANCE` below has to know how far the blank actually reaches
// in z, and the builder runs thousands of lines later: MODELING.md rule 1's
// "a builder that cannot export through userData exports a function"
// (`gearTipR`/`gearBevel` are the precedent). `makePalletFork` reads the
// same fraction, so the chamfer and the elevation cannot be edited apart.
export const FORK_BEVEL_FRAC = 0.12;
// What the blank REACHES above its own mid-plane — and the reason this is
// FORK_T/2 is that the builder now cuts it so. An `ExtrudeGeometry` of depth
// d with `bevelThickness` b stands b proud at each face, so the solid is
// d + 2b tall; the old builder passed d = FORK_T and shipped a part 1.488
// thick while every consumer read 1.2, this constant included. A lever lapped
// to FORK_T is FORK_T overall, chamfer and all, so the chamfer comes OUT of
// the stock: the builder extrudes FORK_T − 2b and the finished blank is
// exactly FORK_T. That is the whole of the disagreement — in XY the bevel
// still dilates the outline outward, which is TODO 84's class and not this
// item's.
export const FORK_HALF_Z = FORK_T / 2;
export const BAL_T = 2.5;              // balance thickness (= makeBalanceWheel's `thickness`)
// TODO 207 — the balance is LIGHTENED to the spring the movement can carry.
// Its sustained swing is the energy each beat delivers against what the
// balance spends: (πk/2Q)θ² on everything but its pivots, where k = I·ω² goes
// with its INERTIA, and 2θ·μ·m·g·r on its pivots, which goes with its MASS.
// The barrel is already as large as the plate allows (DRUM_R_ACTUAL), so the
// rest of the gap to AMPLITUDE_TARGET_DEG comes out of the balance. The rim's
// WIDTH is not free: the stop work's pad is sized to the rim's underside
// annulus (HACK_PAD_TOP_R below), so the rim loses HEIGHT. The timing screws'
// heads and the arms' thickness scale with it, which keeps the screws inside
// the rim's band (HACK_SCREW_DROP stays positive) and the arms inside the
// rim. BAL_RIM_F is the HEAVIEST rim that still reaches the target, because a
// heavier balance is the steadier one against the escapement's
// disturbances. Searched in steps of 0.005: 0.645 sustains 200.4° nominal
// vertical, 0.650 sustains 199.1°. `equalisation` row 15 holds it on both
// sides: the target met at the nominal corner, vertical, and not exceeded by
// AMPLITUDE_TARGET_SLACK_DEG or more, which is what one 0.005 step heavier
// costs (1.3°) with margin, so a lighter rim than needed fails the gate too.
// The metal comes off the rim's TOP: its underside stays where the full rim's
// was, so the balance's seat over the fork (L_BALANCE below), the stop work's
// contact plane (HACK_CONTACT_Z) and everything stacked above the balance keep
// their datum. RIM_H_REF is that full rim, and the datum it fixes.
export const BAL_RIM_F = 0.645;
export const RIM_H_REF = BAL_T * 0.55;           // the full rim — the seat's datum
export const RIM_H = RIM_H_REF * BAL_RIM_F;     // rim height — mirrors makeBalanceWheel's 0.55·t·rimF rim
// Balance mid-plane: the fork blank's TRUE top (L_FORK + FORK_HALF_Z) +
// margin + half the rim's own height. The rim's underside is the balance's
// deepest full-ring face, so this is the lowest the wheel can sit without
// fouling the fork.
// TODO 98: this used to read `FORK_T / 2` DIRECTLY, and that was a face no
// metal had. Measured, the fork's steel topped out 0.18 higher (the old boss
// cylinder at t·1.3, one of four z-heights in a six-solid part) and the rim's
// underside landed 0.0300 BELOW it — the margin was not reduced, it was
// negative, and the two parts missed each other only laterally, by 0.6001
// that nothing derived. The number here is arithmetically the same and no
// longer a coincidence: the fork is one blank cut to FORK_T overall, and
// `FORK_HALF_Z` is what the builder is ASSERTED to produce (main.js), so the
// margin below is the margin that exists.
// With the low escapement it lands FAR BELOW the plate band — the whole
// oscillator now lives in open air under the plate's cutaway.
// TODO 207 — RIM_H_REF, not RIM_H: the lightened rim keeps the full rim's
// underside (its metal comes off the top), so the underside is still exactly
// one margin over the fork and L_BALANCE is still the full rim's mid-plane —
// the balance group's datum, which the hairspring, the cock and the train's
// ceiling are stacked from.
export const L_BALANCE = L_FORK + FORK_HALF_Z + CLEAR_MARGIN + RIM_H_REF / 2;
// Impulse-pin world mid-plane — inside the fork's z-band, VERIFIED by the
// collision audit; it is pinned to the FORK, not the balance, and must not
// move when L_BALANCE does. makeBalanceWheel takes the wheel-centre→pin
// distance as `pinDrop` so the caller can hold this plane exactly.
export const PIN_PLANE_Z = L_FORK - 0.5;
export const L_HAIRSPRING = L_BALANCE + 1.2;
// makeHairspring height (its stud/terminal top out ≈0.7·H above mid-plane).
// TODO 207 — it scales with the balance it springs. The rate fixes k = I·ω²,
// and the ribbon's section is solved from k (main.js, TODO 25): a³·c ∝ k·L,
// with c the half-height. §218 derived the coil count (8) against the stock
// band at the 0.6 the ribbon stood at, and the stud post forbids a finer pitch
// (TODO 147). So when the lightened balance needs a softer spring, the ribbon
// keeps §218's thickness and loses HEIGHT in proportion to k. The oscillator
// gate holds the result inside real stock; a real hairspring of this
// thickness runs about this tall.
export const HAIRSPRING_H_REF = 0.6;   // the height the train's datum was solved at (TRAIN_CEILING_Z)
export const HAIRSPRING_H = 0.3726;
// BALANCE COCK: a LOW bridge riding one margin over the hairspring
// stack, wherever that stack lands — with the low escapement that is
// ~4 under the three-quarter plate's band, so the cock (and the
// free-sprung dress on its face) stands entirely clear of the plate: no
// nesting, no shared band, no collision. The plate keeps its cutaway
// purely for the view of the oscillator below.
export const COCK_T = 0.8;
// §218 tier two — THE OVERCOIL'S PLANE. The last three quarters of a turn are
// raised so the ribbon's underside clears the spiral's top by the one margin:
// its centre sits H + CLEAR_MARGIN above the spiral's, and the stack's top is
// that plus half a ribbon. This is the stack cost the entry named — 0.63 u
// over the flat spring's 0.7·H — and everything that reads SPRING_TOP_Z (the
// cock's slab, the drum's top, the fusee band, the plate floor) moves with it
// by construction, which is the honest direction: a raised coil is metal in
// the stack, not a drawing.
export const HAIRSPRING_OVERCOIL_RAISE = HAIRSPRING_H + CLEAR_MARGIN;
export const SPRING_TOP_Z = L_HAIRSPRING + HAIRSPRING_OVERCOIL_RAISE + HAIRSPRING_H / 2;
// ...and the one thing that does NOT move with it. The going train's z
// stations — the drum's lid (the going ribbon's height, which §104's
// equalisation was solved on), the fusee's groove band (§61/§124), the
// chain's ceiling (TODO 53) and §47's arrest clocked against that corridor —
// were solved against the stack's top AS IT WAS, the flat spring's 0.7·H.
// Booted with them reading the raised top, §47 reported no legal beak
// azimuth at any of its 102 pad azimuths: a raised terminal on the balance
// is not a reason to re-cut the mainspring or re-clock the arrest, so those
// stations keep their datum here. The cock and the plate floor above the
// balance are what the overcoil is metal in, and they read SPRING_TOP_Z.
// TODO 207 applies the same rule a second time: a lighter balance and the
// shorter ribbon it is sprung with are not a reason to re-cut the mainspring
// either, so the datum is the reference ribbon's.
export const TRAIN_CEILING_Z = L_HAIRSPRING + HAIRSPRING_H_REF * 0.7;
export const COCK_SLAB_BOT = SPRING_TOP_Z + CLEAR_MARGIN;
export const COCK_SLAB_TOP = COCK_SLAB_BOT + COCK_T;
export const COCK_MID_Z = COCK_SLAB_BOT + COCK_T / 2;
// Dial plane (watch front, −z side). Part of the same depth budget: the
// motion-works crossing (Z_SETTING), reserve train (Z_RSV) and cannon pinion
// all pack between the plate's back face (−2) and this.
// §51 phase B: −7 → −7.5. The dial-side band grows half a unit to fund the
// strata re-spends the plate gap could not (selector sheet, disc body and
// fingers, the feeler slices, both springs — all measured z-thin). Assembly
// depth grows ≈ 0.19 mm, inside §39's asserted 2.5–12 envelope; the §2
// shared-budget position is recorded in the roadmap entry. Every
// dial↔movement coupling is tripwired, and this edit is deliberately made
// ALONE first so the tripwire list measures the real blast radius.
// §45 stage 0: −7.5 → −8.40. The alarm-release CAM SLEEVE's band (sleeve
// envelope 0.742 + one margin — arithmetic and agreement tripwire in
// main.js's §29/§45 chain block) is funded HERE, not out of the plate-side
// end gap: the chain below the heart grows by the same amount, so every
// member below the insertion keeps its solved world plane and the landing
// assert is untouched. 0.90 is the spend 0.8915 rounded up to the 0.01
// grid; the ≤0.009 residue rides the end gap. Assembly depth grows
// ≈ 0.34 mm, still inside §39's asserted 2.5–12 mm envelope.
// TODO 26 — Z_DIAL is the dial's BACK FACE, and every dial-side work stands
// off it (cannon pinion, jumper lifter, the alarm setting plane and band, the
// dial feet). It kept that job when the dial gained thickness, which is why
// giving the dial substance moved nothing behind it: the plate grows FORWARD,
// toward the viewer, out of z the movement did not previously spend.
// TODO 194: −8.40 → −9.13. The alarm follower's return SPIRAL needs its own
// band under the carrier flange (b = 0.5768, solved in main.js's §29 chain
// from the detent window, the spring steel's strain target and the coils'
// running-fit gap), and the flange→heart gap was one bare margin — so the
// chain grows b + CLEAR_MARGIN = 0.7268, funded here exactly as §45 funded the
// sleeve: every member below the insertion keeps its solved world plane, the
// total spend 1.6230 rounded up to the 0.01 grid (the 0.0070 residue rides MW_WHEEL_T, the
// stack's absorber). The fund-vs-spend tripwire in main.js holds both spends.
// The cross-frame members that span the dial move paid in their own
// currencies: the selector rod is 0.73 longer (ALARM_LINK_ROD_LEN_U) and its
// section with it, which forked the alarm link's fulcrum (the lug, main.js).
export const Z_DIAL = -9.13;
// The dial as MATTER. Real watch dials are brass sheet ~0.35–0.5 mm; 0.4 mm is
// mid-stock and the figure §50's own citations use for plate-like sheet. In
// §39's pin that is 0.4 / 0.379 = 1.06 units. The floor under it: a dial must
// be at least as thick as the sub-dial recess it carries (SUBDIAL_RECESS 0.5),
// or the wells punch through its back — which is precisely the defect TODO 26
// filed, a recess drawn as a protrusion because the sheet had no thickness to
// sink into.
export const DIAL_T = 0.4 / UNIT_MM;   // 1.056 u — 0.4 mm of brass
export const Z_DIAL_FACE = Z_DIAL - DIAL_T;  // the VISIBLE face, one plate forward
// TODO 26's second remaining row: the dial's thickness was ONE NUMBER, and a
// turned plate's is a profile. The profile a dial plate really carries at its
// rim is the EDGE BREAK — the chamfer that takes the arris off a turned brass
// edge — not a taper: a dial is parallel-faced over its field (the stepped and
// sector dials that are thinner in places are a STYLE, and this dial's raised
// chapter ring is applied, which is the other real way to get that look).
// 0.05 mm is the light break used on thin sheet (0.05–0.1 typical). Its
// ceiling is the stock itself: the break is taken off BOTH faces, so 2× must
// leave the rim a straight land — 0.4 − 2×0.05 = 0.30 mm, 75% of stock, and
// makeDial boot-asserts the rule rather than the number.
export const DIAL_EDGE_BREAK = 0.05 / UNIT_MM;  // 0.132 u
// The base plate's THICKNESS, hoisted from main.js (TODO 211) because the
// keyless plane below is derived from the plate's dial face and layout.js
// cannot read main.js. TODO 202 — the plate's two FACES are the datums, and
// the thickness is what lies between them. The movement side is z 0, which
// every train part, cock leg and pillar seats off (PLATE_TOP). The dial side
// is z −2.3: until TODO 202 the extrude's bevel stood proud of a nominal
// [−2, 0] slab, and the face it actually presented at −2.3 is what the whole
// dial-side stack was solved against (TODO 153's PLATE_BACK_FACE, §234's
// guard, TODO 172's pockets). The builder now cuts the finished plate, so the
// slab is declared as the metal those solves already stand on: 2.3 u =
// 0.872 mm, centred at −1.15.
export const BACK_PLATE_T = 2.3;
// KEYLESS PLANE — the stem/clutch/setting-wheel plane, on the DIAL SIDE of the
// base plate as in a real watch. Z_KEYLESS itself is DERIVED below HUB_COLLAR_R
// (search KEYLESS PLANE — DERIVED), because its ceiling is the stem stack's
// radius and the collars are now the second-widest member of it.

// ---------------------------------------------------------------------------
// Train ratios — the "ratios" third of the eventual solveLayout output. Tooth
// counts and modules per mesh: pure literals, the single source §22 (custom
// beat rate) needs to re-derive counts. The going train's counts exist to make
// the FOURTH wheel turn once per minute at F_BALANCE, so a different beat means
// re-solving THESE, not editing an angle somewhere downstream — which is the
// whole reason they want to live together as data. (SPEC.md's gear table is
// the prose version of this object.)
//
// Each entry is one MESH: a wheel of `teeth` driving a pinion of `pinion`
// teeth at `module` (the arrow in the comment). §13 step 3c retired the old
// flat names (barrelTeeth … fourthTeeth) and folded the pinion counts in —
// they used to be magic 10s and an 8 repeated in BOTH the pinion builders
// and tick()'s ratio chain; now builders and kinematics read this one table,
// so a ratio literally cannot disagree with the geometry that carries it.
export const TRAIN = {
  // §124 (TODO 46) — the first stage re-geared 8:1 → 120/7 = 17.143:1 so the
  // fusee turns once per 17 1/7 h and the 30 h reserve fits in 1.75 wraps —
  // TWO groove turns at pitch 1.389, ≥ 2× the chain stack, which is what
  // finally lets every link either sit upright or lean flush without
  // fouling the next turn (the packed 4-groove cut had a mid-band where no
  // chain pose existed). The centre distance is HELD — module derives from
  // it, 2·16.2/(120+7) = 0.25512 — so the center arbor does not move; the
  // wheel's pitch radius grows 14.40 → 15.307 and the 7-leaf pinion runs a
  // module inside the movement's existing practice (the escape mesh is cut
  // at 0.21).
  barrel: { module: (2 * 16.2) / (120 + 7), teeth: 120, pinion: 7 }, // great wheel → center pinion
  center: { module: 0.30, teeth: 75, pinion: 10 }, // center wheel → third pinion
  third:  { module: 0.24, teeth: 80, pinion: 10 }, // third wheel → fourth pinion
  // fourth wheel → escape pinion: the ONE mesh the beat-rate spec re-gears
  // (§22, table above) — every other count is beat-independent. §204: the
  // module is the row's when it carries one (36,000 must, or it does not
  // fit the case) and the mesh's 0.21 otherwise, so the identity spec's
  // literal is unchanged and the fingerprint with it.
  fourth: { module: RATE_TABLE[SPEC.vph].module ?? FOURTH_MODULE_DEFAULT, teeth: RATE_TABLE[SPEC.vph].fourthTeeth, pinion: RATE_TABLE[SPEC.vph].escPinion },
};

// Keyless works + winding path (the SETTING side, not the going train).
export const KW_MODULE = 0.34;
// §234 step 3b — windPinionTeeth was 8, and TODO 138's two hard guards both
// fired the moment the stem was bored for real crown-stem stock rather than
// arbor stock: the pinion's own root cone had no web left over the fatter
// bore, and the crown-wheel pair kept none either (both fail at 8 AND 9 teeth,
// derived faceW 0.0000 — `tools/_scratch-kw-solve.mjs`'s sweep, kept in this
// comment because the probe was scratch). 10 is the smallest count whose
// derived face width clears §50's floor at the stock bore (faceW 0.4969
// against 0.3167) — the same "the bore floors the count, never sets it" rule
// §235 used for the alarm corner.
export const crownWheelTeeth = 20, windPinionTeeth = 10, settingWheelTeeth = 20;
// TODO 150 item 1 — minutePinionTeeth (8) retired with the minute pinion
// itself: it "meshed nothing" (§136) and existed only to carry its count
// into the hand-set ratio, which now reads SETTING_CAP_TEETH (also 8, so
// the value is unchanged) off the real closing mesh instead.
export const minuteWheelTeeth = 24;
// §136 — moved here from main.js, where it was declared BELOW the wheel it
// was (wrongly) listed against. TODO 150 item 3 corrected WHICH wheel the
// cap actually meshes: the motion works' MW_MINUTE_TEETH wheel (30 teeth,
// TODO 151's fix path), not the keyless works' own minuteWheelTeeth (24) —
// the false mate the keyless wheel was cut for until this fix. A wheel's
// face is generated by `m·min(mates)/4`, so listing this count among a
// wheel's mates changes ITS cut: the keyless minute wheel's generating
// radius was 0.68 with the false entry, 1.70 without it (measured tipR
// 4.535 → 4.285). Its siblings live here; so does it.
export const SETTING_CAP_TEETH = 8;
export const WIND_SPUR_TEETH = 24;

// Motion works — the 12:1 hour reduction. cannon → minute wheel, then minute
// pinion → hour wheel; the ratio falls out of the counts (see main.js), it is
// not asserted.
export const cannonPinionTeeth = 10;
export const MW_MODULE_1 = 0.3;                                 // cannon ⇄ minute wheel
export const MW_MINUTE_TEETH = 30, MW_PINION_TEETH = 8, MW_HOUR_TEETH = 32;

// The CO-AXIAL CENTRE STACK, and the dial bore it needs (§25 C's rattrapante
// arrangement: cannon pinion → hour tube → alarm tube, three members turning
// about one axis). Hoisted here from main.js because the solve below now
// depends on the outermost member: the sub-dial wells' inboard ceiling is the
// clearance this bore needs, so the two must not be able to drift apart.
// main.js imports these rather than recomputing them, and asserts the bore
// against the tube it is cut for.
export const HOUR_TUBE_INNER = (MW_MODULE_1 * cannonPinionTeeth) / 2 + MW_MODULE_1 + 0.25;
export const HOUR_TUBE_OUTER = HOUR_TUBE_INNER + 0.45;   // 0.45 wall
export const ALARM_TUBE_INNER = HOUR_TUBE_OUTER + 0.1;   // 0.1 running clearance on the hour tube (its bearing)
export const ALARM_TUBE_OUTER = ALARM_TUBE_INNER + 0.4;  // 0.4 wall
export const DIAL_CENTER_BORE_R = ALARM_TUBE_OUTER + 0.2; // the stack's outermost member passes with running clearance
// One wall thickness, shared by the dial's bore and its sub-dial pockets —
// the same 0.2 §25 C's well/setting-wheel form used, kept as one name so the
// two ceilings cannot disagree about how much brass a wall is.
export const DIAL_WALL_HALF = 0.2;
// The sub-dial wells' INBOARD ceiling: how close a well's ring may come to
// the dial centre. See the derivation at the per-well solve below — this is
// the bore, plus a wall, plus the one structural margin.
export const SUBDIAL_INBOARD_CLEAR = DIAL_CENTER_BORE_R + DIAL_WALL_HALF + CLEAR_MARGIN;
// §97 — what passes through a well's own pocket FLOOR, hoisted from main.js
// the same way the centre stack was when TODO 33 made the ceiling depend on
// the bore: the wells' radius is a SPEC dimension now, and its geometric
// FLOOR is this bore plus a wall plus the margin — the solve that bounds
// the radius and the geometry that drills the hole must read one source.
// Both members are built in main.js — the small-seconds display arbor's
// hand HUB and the reserve indicator arbor; ONE bore for both wells (one
// drill), sized by the larger member at the standing margin (makeDial
// circumscribes a hole's polygon, so the margin holds on the flats).
export const SECONDS_HUB_R = 0.9;
export const RSV_HAND_ARBOR_R = 0.4;
export const SUBDIAL_BORE_R = Math.max(SECONDS_HUB_R, RSV_HAND_ARBOR_R) + CLEAR_MARGIN;
// §97 — the wells' geometric FLOOR: below this the pocket cannot carry its
// own centre bore's wall. The retired finish knob's 0.5 minimum landed at
// 5.93 — four times this floor — a legibility choice wearing a geometry
// reason (§86's subject); the spec key declares the geometric floor and
// leaves the useless-but-legal band to the viewer.
export const SUBDIAL_FLOOR = SUBDIAL_BORE_R + DIAL_WALL_HALF + CLEAR_MARGIN;

// ---------------------------------------------------------------------------
// Planar layout inputs — the "positions" the tornado solve steps off. These
// are the pure ANGLES and one distance that decide where each arbor lands;
// the solve that consumes them (stepPos / the two-bar third-wheel solve /
// shift) is still interleaved in main.js and comes out in step 3. Editing one
// of these is how "move the crown to 3 o'clock" will eventually be a one-line
// change — once the solve reads a spec instead of module scope.
export const BARREL_STEP_DEG = -35;        // center sits down-right of barrel → barrel/crown exit viewed ~1:50
// §125 — the centre → fourth distance IS the small-seconds station, and it
// sits at the point that MAXIMIZES the seconds well under the furniture law
// (the owner's ask, 2026-08-20: as big as the centre pinion's keep-out and
// the railroad track allow). The well is bounded inboard by the keep-out and
// outboard by the rail, so it is largest where the two bounds MEET:
//
//     D4 = (railInnerR − DIAL_WALL_HALF − CLEAR_MARGIN
//           + SUBDIAL_INBOARD_CLEAR) / 2
//        = (41.15568279135727·(2·0.46)·0.87 − 0.2 − 0.15 + 3.55…) / 2
//
// printed at full precision below (dialRadius is the keyless-floored plate,
// FLAT over every station in play, so the closed form is a constant; the
// dial build asserts the two bounds still meet, which is what re-derives
// this number if the face ever moves). Well radius 14.5205 — its ring one
// margin off the rail's inner edge, its inner edge on the keep-out.
//
// TODO 125 RE-DERIVED IT, and that is the assert above doing its job rather
// than a number being retuned. Deleting the keyless meshes' undderived
// `+ 0.1` (see the siting solve) let the keyless cluster close onto its own
// pitch sums, and the keyless cluster is what FLOORS the plate: dialRadius
// fell 42.922914475499894 → 42.804991398276, the outboard bound followed it,
// and the station that maximizes the well moved with both. The assert fired
// with the two bounds 15.2278 against 15.1334 and named the closed form to
// re-derive from; re-derived, they meet again at 15.1806 to float noise.
// The well is 0.047 SMALLER than it was, which is the honest price of a
// plate that is no longer carrying 0.1 of nothing at each keyless mesh.
//
// TODO 136 RE-DERIVED IT AGAIN, the same way and for the same reason — which
// is the argument for keeping the assert rather than for distrusting the
// number. Cutting the two keyless corners as real bevels deleted a fictitious
// 0.55·windPinionR of rim overlap at each of them AND shortened the winding
// pinion to a cone, so the cluster the plate encloses got shorter twice over:
// dialRadius 42.804991398276 → 41.15568279135727, railInnerR 34.2620 → 32.9410,
// and the two bounds stood 15.1806 against 13.8345. Re-derived, they meet at
// 14.5205. The well is 0.673 smaller, which is what the plate stops carrying
// when the keyless works measure their own stations.
// Context that still binds the RANGE, from the Tier B measurement: the
// plate stays 42.9229 through station 22.90 and grows at 22.95; the
// two-bar closes at 23.55; the mid-band build asserts (side-sign 16–17 and
// the frame program's solves) are all live and re-measured silent at this
// station on the post-Tier-B tree. The menu's FAST rates still trade size
// for rate (the 96-tooth fourth outruns the keyless floor from ≈17.7 —
// at this station too; their spec rows record it).
//
// §234 step 3b RE-DERIVED IT A THIRD TIME, same reason again: the winding
// stem was cut to stem stock (windPinionTeeth 8 → 10, STEM_R to the stock
// floor), which re-cut BOTH keyless bevel corners and grew the cluster the
// plate encloses back out a little — dialRadius 41.15568279135727 →
// 41.51616090422663, railInnerR 32.9410 → 33.2295. The bounds stood
// 14.5205 against 14.8090; re-derived, they meet at 14.664767593871495.
// The well is 0.144 BIGGER than it was — the fatter winding stem asks more
// of the crown-wheel/setting-wheel pair's blanks than the arbor-stock pair
// gave back, and the plate carries that difference outward.
export const D4 = 18.214767593871496;
// §125 Tier B — THE RESERVE STATION'S OWN ANCHOR. Tier A had the reserve
// MIRROR the seconds station (the wells were one radius, so symmetry was the
// law); the mirror died the day the wells split. The owner's constraint is
// readability at a smaller size: the reserve keeps the §74/§97-era well it
// shipped with — the size every reading of the shipped face has proven —
// which under the grows-from-the-centre law (well = station −
// SUBDIAL_INBOARD_CLEAR) pins its STATION, not its radius. The literal is
// the pre-Tier-B station printed at full precision (the two-bar's landing
// for D4 15.5, which the Tier A mirror copied), so the whole reserve side —
// well, scale, needle, reduction train, and the alarm corner's neighbour
// clearances — is bit-identical to the shipped tree. ?rsvr= still overrides.
export const RESERVE_STATION_R = 15.500000000000002;
// §136 — THE RESERVE TRAIN'S PLAN-SPACE COUNTS, hoisted from main.js because
// the SETTING TRAVERSE now has to be sited against this train and is built
// ~7000 lines earlier. They are plan-space facts (counts and a module), which
// is what this file is for; the train's own build still owns everything
// derived from them. w2 = reserveHours/5 keeps the 300° sweep an integer.
export const rsvTeethP0 = 8, rsvTeethW1 = 28, rsvTeethP1 = 10;
export const rsvModule0 = 0.34;
export const rsvD0 = (rsvModule0 * (rsvTeethP0 + rsvTeethW1)) / 2;
// §125 step 1 — THE ALARM CORNER'S DESIGN RADIUS. Until §125 the corner's
// default read dialRadius·0.39 — a FACE proportion carrying a dimension whose
// real constraint is the winding CLUTCH: §74 tier B proved the corner cannot
// move outward (the chains size themselves, the bearing sweep refuses, the
// two-circle root is symmetric, the climb is the clutch and cannot be
// unpinned), and §125 measured the clean travel at under 0.37 — at +0.37 the
// i2 ⇄ winding-climb clearance is spent (need 0.15; +0.09 short at 15.77,
// −0.06 at 16.00). So the default could not survive its own input changing:
// grow the dial 1% and the corner walked into a −0.57 foul with the movement
// untouched (§98's finding, arriving from the dial's side). The value is the
// §74-proven station itself — bit-equal to the old default at the shipped
// plate (plateR·0.92·0.39, printed at full precision), so pinning it moves
// nothing; it just stops moving when its neighbours do. ?alarmr= (§98) still
// overrides for exploration.
export const ALARM_CORNER_R = 15.400741713809364;
export const ESCAPE_STEP_DEG = -57.9;      // escape at viewed ~6:25
export const BALANCE_STEP_TARGET_DEG = 44.6; // balance at viewed ~8:00 — a TARGET; the feasible angle is solved in main.js

// ---------------------------------------------------------------------------
// solveLayout (§13 step 3) — the tornado solve as a PURE FUNCTION. Everything
// the solve consumes arrives as an argument: the walk angles and D4 (the
// spec), the mesh centre-distances (pitch-radius sums), and — crucially — the
// SWEPT RADII the balance-clearance solve binds on. Those are measured from
// the built meshes by the CALLER (vertex max: bevels and screw-tip corners
// are real, boxes over-report — the shipped lesson), because measuring is
// main.js's job and purity here means "same inputs, same outputs", not
// "pretends geometry doesn't exist". Called twice with different specs in
// one process, it returns two independent layouts — which is the §13
// regression suite: the current spec must reproduce the fingerprint
// baseline's positions exactly.
//
// Returns { P, BALANCE_STEP_DEG, forkBaseAngle, PIN_AIM } — the shifted
// position table and the three byproducts the build consumes downstream.
// Every expression is ported VERBATIM from the in-line solve so the
// floating-point sequence (and therefore the geometry fingerprint) is
// bit-identical.
export function stepPos(prev, angleDeg, dist) {
  const a = angleDeg * (Math.PI / 180);
  return { x: prev.x + Math.cos(a) * dist, y: prev.y + Math.sin(a) * dist };
}

// §94 tier A — THE TWO-BAR'S CLOSURE WINDOW, from the two bars themselves.
// The centre→third→fourth linkage is a triangle whose two fixed sides are the
// mesh centre distances d1CT (centre wheel ⇄ third pinion) and d2TF (third
// wheel ⇄ fourth pinion); the third side is d4. A triangle exists iff
//
//     |d1CT − d2TF| ≤ d4 ≤ d1CT + d2TF
//
// and outside that the wedge's `acos` argument leaves [−1, 1], so every
// position downstream of the third wheel is NaN. At the shipped radii the
// window is 1.95 ≤ d4 ≤ 23.55 (roadmap §74, measured; the first NaN observed
// at d4 24 is that upper bound plus float slack — the bound itself is exact).
// Both ends are DEGENERATE rather than merely tight: the three arbors go
// collinear there, which is not an arrangement anybody would cut. This
// returns the mathematical window; its two consumers say what they do at the
// edges (solveLayout falls back to D4, reconfigure mode refuses).
export function d4Window(radii) {
  const d1CT = radii.centerWheel + radii.thirdPinion;
  const d2TF = radii.thirdWheel + radii.fourthPinion;
  return { min: Math.abs(d1CT - d2TF), max: d1CT + d2TF, d1CT, d2TF };
}

export function solveLayout({
  barrelStepDeg = BARREL_STEP_DEG,
  d4 = D4,
  escapeStepDeg = ESCAPE_STEP_DEG,
  balanceStepTargetDeg = BALANCE_STEP_TARGET_DEG,
  radii,          // { barrel, centerPinion, centerWheel, thirdPinion, thirdWheel, fourthPinion, fourthWheel, escapePinion }
  escToBalance,   // escape arbor → balance arbor
  palletStone,    // escape arbor → fork pivot, along the escape→balance line
  swept,          // { great, center, third, fourth, escape, balance } — measured swept radii
  clearMargin = CLEAR_MARGIN,
  warn = () => {},
}) {
  const DEG2RAD = Math.PI / 180;
  const barrelPos = { x: 0, y: 0 };
  const centerPos = stepPos(barrelPos, barrelStepDeg, radii.barrel + radii.centerPinion);
  // centre→third→fourth two-bar: the fourth lands EXACTLY d4 below the centre.
  const d1CT = radii.centerWheel + radii.thirdPinion;
  const d2TF = radii.thirdWheel + radii.fourthPinion;
  // §94 tier A — d4 is a URL spec key now, so a value the two-bar cannot
  // close can arrive from a hand-typed link (reconfigure mode refuses those
  // against d4Window before they ever get here). A NaN layout is not a
  // degraded answer, it is NO answer — every position downstream of the
  // third wheel goes NaN and the build has nothing to stand on — so the
  // solve REPORTS the refusal with its numbers (rule 6) and keeps the
  // designed D4 rather than clamping onto a collinear degeneracy.
  // Identity passes no d4 at all, so this compares D4 against a window it
  // sits well inside and the value is untouched.
  const w = d4Window(radii);
  let d4e = d4;
  if (!(d4 >= w.min && d4 <= w.max)) {
    warn(`d4 ${d4} is outside the centre→third→fourth two-bar's closure window `
      + `[${w.min.toFixed(2)}, ${w.max.toFixed(2)}] (bars ${w.d1CT.toFixed(2)} and ${w.d2TF.toFixed(2)}) `
      + `— the triangle does not close, so the layout keeps the designed D4 ${D4}`);
    d4e = D4;
  }
  const thirdWedgeDeg =
    Math.acos((d1CT * d1CT + d4e * d4e - d2TF * d2TF) / (2 * d1CT * d4e)) / DEG2RAD;
  const thirdPos = stepPos(centerPos, -90 - thirdWedgeDeg, d1CT);
  const fourthPos = { x: centerPos.x, y: centerPos.y - d4e };
  const escapePos = stepPos(fourthPos, escapeStepDeg, radii.fourthWheel + radii.escapePinion);
  // BALANCE_STEP_DEG — solved from the swept-radius clearance constraint.
  const rBal = swept.balance;
  const obstacles = [
    { pos: barrelPos, rr: swept.great + rBal + clearMargin },
    { pos: centerPos, rr: swept.center + rBal + clearMargin },
    { pos: thirdPos, rr: swept.third + rBal + clearMargin },
    { pos: fourthPos, rr: swept.fourth + rBal + clearMargin },
    { pos: escapePos, rr: swept.escape + rBal + clearMargin },
  ];
  const ok = (deg) => {
    const p = stepPos(escapePos, deg, escToBalance);
    return obstacles.every((o) => Math.hypot(p.x - o.pos.x, p.y - o.pos.y) >= o.rr);
  };
  // TODO 196 — THE ANSWER IS THE EDGE, NOT THE SEARCH. The constraint: an
  // infeasible target walks out to the nearest clear angle, and that angle is a
  // property of the OBSTACLES alone, so every target that walks to one edge
  // must land on one station, bit for bit.
  //
  // Fixed halvings from the target were rejected because they cannot do that:
  // the search stopped after 40 halvings of a bracket measured FROM the target,
  // so its last bits were a function of where it began — the default 44.6 and
  // `?balstep=60` both reached the edge at 43.7635° and stood 9.2e-14 apart.
  // Nor is bisecting to float adjacency enough: `ok`, evaluated through
  // cos/sin, FLICKERS over about 4 ulps at the edge (measured: 44.6 and 44.2
  // settle 4 ulps apart that way), so a bisection lands on whichever flicker
  // its bracket happens to straddle.
  //
  // So the search only decides WHICH obstacle binds. The edge is that
  // obstacle's own tangency in closed form — the balance's circle about the
  // escape arbor (radius R = escToBalance) meets the keep-out circle (radius
  // rr, centre D from the escape at bearing β) where
  // cos(θ − β) = (R² + D² − rr²) / 2RD — and ulp-stepping outward from it
  // finds the first angle `ok` accepts, which steps over the flicker. Both
  // read only the obstacle, never the target. No tolerance is chosen: the
  // stopping rules are float adjacency and `ok` itself. (The three-quarter
  // plate's rim had turned those 9.2e-14 into a 0.0065 move; its own half of
  // the fix is in makeThreeQuarterPlate.)
  const nextOut = (() => {
    const f = new Float64Array(1), b = new BigInt64Array(f.buffer);
    return (x, s) => {
      if (x === 0) return s * Number.MIN_VALUE;
      f[0] = x; b[0] += (x > 0) === (s > 0) ? 1n : -1n; return f[0];
    };
  })();
  // A ceiling on the outward walk, not a tolerance: 4096 ulps of a station
  // angle near 44° is 3e-11°, three orders past the measured 4-ulp flicker, so
  // reaching it means the closed form named the wrong edge — reported, below.
  const EDGE_WALK_ULPS = 1 << 12;
  const edgeAt = (good, bad, s) => {
    for (;;) {
      const m = (good + bad) / 2;
      if (m === good || m === bad) break;
      if (ok(m)) good = m; else bad = m;
    }
    const pb = stepPos(escapePos, bad, escToBalance);
    let best = null;
    for (const o of obstacles) {
      if (Math.hypot(pb.x - o.pos.x, pb.y - o.pos.y) >= o.rr) continue; // not the one that binds
      const dx = o.pos.x - escapePos.x, dy = o.pos.y - escapePos.y;
      const D = Math.hypot(dx, dy);
      const c = (escToBalance * escToBalance + D * D - o.rr * o.rr) / (2 * escToBalance * D);
      if (!(c >= -1 && c <= 1)) continue;
      const beta = Math.atan2(dy, dx) / DEG2RAD, alpha = Math.acos(c) / DEG2RAD;
      for (const th of [beta + alpha, beta - alpha]) {
        const t = th + 360 * Math.round((good - th) / 360);
        if (!best || Math.abs(t - good) < Math.abs(best - good)) best = t;
      }
    }
    if (best === null) return good;
    let at = best;
    for (let k = 0; k < EDGE_WALK_ULPS && !ok(at); k++) at = nextOut(at, s);
    if (!ok(at)) {
      warn(`balance step: the closed-form edge ${best} did not reach a clear double within ${EDGE_WALK_ULPS} ulps — keeping the bisection's ${good}`);
      return good;
    }
    return at;
  };
  let BALANCE_STEP_DEG;
  if (ok(balanceStepTargetDeg)) {
    BALANCE_STEP_DEG = balanceStepTargetDeg;
  } else {
    const edge = (s) => {
      let hi = 0.25;
      while (hi <= 90 && !ok(balanceStepTargetDeg + s * hi)) hi += 0.25;
      if (hi > 90) return null;
      const at = edgeAt(balanceStepTargetDeg + s * hi, balanceStepTargetDeg + s * (hi - 0.25), s);
      return { at, dist: Math.abs(at - balanceStepTargetDeg) };
    };
    const down = edge(-1), up = edge(1);
    if (!down && !up) {
      warn('balance step: no clear angle about the escape arbor — leaving the target');
      BALANCE_STEP_DEG = balanceStepTargetDeg;
    } else {
      BALANCE_STEP_DEG = (!up || (down && down.dist <= up.dist)) ? down.at : up.at;
    }
  }
  const balancePos = stepPos(escapePos, BALANCE_STEP_DEG, escToBalance);
  // Fork pivot on the escape→balance line; pin aim at mid-swing.
  const toBalance = { x: balancePos.x - escapePos.x, y: balancePos.y - escapePos.y };
  const toBalanceLen = Math.hypot(toBalance.x, toBalance.y) || 1;
  const uBalance = { x: toBalance.x / toBalanceLen, y: toBalance.y / toBalanceLen };
  const forkPivotPos = { x: escapePos.x + uBalance.x * palletStone, y: escapePos.y + uBalance.y * palletStone };
  const forkBaseAngle = Math.atan2(uBalance.x, -uBalance.y);
  const PIN_AIM = Math.atan2(forkPivotPos.y - balancePos.y, forkPivotPos.x - balancePos.x);
  const dialCenterXY = { x: centerPos.x, y: centerPos.y };
  // Recenter on the CENTER-WHEEL arbor (dial concentric with the plate).
  const centroid = { x: centerPos.x, y: centerPos.y };
  const shift = (p) => ({ x: p.x - centroid.x, y: p.y - centroid.y });
  const P = {
    barrel: shift(barrelPos), center: shift(centerPos), third: shift(thirdPos),
    fourth: shift(fourthPos), escape: shift(escapePos), balance: shift(balancePos),
    fork: shift(forkPivotPos), dial: shift(dialCenterXY),
  };
  // §33 step 1 — CROWN AZIMUTH, by rigid rotation of the solved layout
  // about the centre arbor (the dial's axis): the movement turns in its
  // case while the dial's 12 stays up — the operation a casing watchmaker
  // actually performs. Every internal centre distance, mesh and clearance
  // is rotation-invariant, which is exactly why this is STEP 1: the train
  // stays proven, and what genuinely changes is the layout's relation to
  // the DIAL-ANCHORED world — the alarm cluster's corner, the reserve
  // sub-dial at 12, the case furniture — which is where §33's validity
  // verdicts live. (§13's "decouple the stem and re-solve the keyless
  // cluster" remains the deeper step 2.)
  //
  // The angle outputs rotate with the frame; the step angles between
  // members are relative and do not. Identity (crownAzDeg null) skips the
  // transform entirely, so the shipped spec stays BIT-exact — a rotation
  // by zero still churns floats, and the fingerprint gate would see it.
  let forkBaseOut = forkBaseAngle, pinAimOut = PIN_AIM, rotApplied = 0;
  if (SPEC.crownAzDeg !== null) {
    const dAz = SPEC.crownAzDeg * DEG2RAD - Math.atan2(P.barrel.y, P.barrel.x);
    if (dAz !== 0) {
      const c = Math.cos(dAz), s = Math.sin(dAz);
      for (const k of Object.keys(P)) {
        const p = P[k];
        P[k] = { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
      }
      forkBaseOut += dAz;
      pinAimOut += dAz;
      rotApplied = dAz;
    }
  }
  // rotAppliedRad: §33 step 3's handles map pointer azimuths back into the
  // solver's (unrotated) frame — the one place the applied rotation must
  // be visible downstream.
  return { P, BALANCE_STEP_DEG, forkBaseAngle: forkBaseOut, PIN_AIM: pinAimOut, rotAppliedRad: rotApplied };
}

// ---------------------------------------------------------------------------
// Keyless-works frame constants (§13 step 3b) — the DECLARED spec of the
// stem-side cluster, hoisted beside the counts that gear it. The distances
// derived from these come out of solveKeyless below.
// ---------------------------------------------------------------------------
export const CROWN_PULL_DIST = 5; // stem/crown outward slide when pulled to set
export const SL_C = 10;        // setting-lever pivot's lateral offset from the stem axis
// The keyless winding idler's tooth count — hoisted to a NAMED export at
// §112: it is the movement's proven idler stock, and the alarm winding
// idlers' floor now cites it (TODO 15's gauge cannot read the 12-tooth
// wheel the collapsed span's reach floor alone would cut). The derivation
// note lives at its consumption in solveKeyless below.
export const KW_WIND_IDLER_TEETH = 18;
export const SL_TAIL = 6;      // lever tail arm length (pivot → post)
// (GROOVE_LOCAL — the stem's setting-lever groove station — moved below
// the TODO 50 clutch constants: since the split it DERIVES from the
// clutch spine's outboard reach.)
// The yoke pivot's lateral offset from the stem axis. TODO 214 moved the pivot
// to the LEVER'S side of the stem (it stood on the far side, its body and boss
// inside the minute wheel — TODO 223), mirrored across the stem line at the same
// offset, so the fork's arm (YOKE_ARM), its bearing on the hub collars
// (YOKE_BEARING_LATERAL) and the collars' radius are untouched: every one of
// them is a function of the lateral distance alone, and the prong's polygon is
// symmetric about the arm.
export const YK_C = 7.5;

// ---------------------------------------------------------------------------
// The stem's ONE-WAY (TODO 50 / BUILT §149) — a Breguet-style saw FACE coupling between
// the fixed winding pinion and the sliding clutch, the joint every real
// keyless works puts there. The spec solver and its two laws live HERE, at
// the bottom of the module graph, because three consumers need the one
// arithmetic: geometry.js cuts the rings from it, main.js's tick rides it,
// and this module's own keyless solve needs the tooth height to place the
// clutch's stroke (swDist and the yoke's tracked band both shift by the
// clutch's home offset). Movement-independent on purpose — the alarm stem
// states the same debt and is this code's second customer when its turn
// comes.
//
// Every quantity is derived (rule 1):
//   · tan α = rampOverFriction · μ — at the friction cone's edge camming
//     and jamming are the same event, so the ramp stands at twice it and
//     a backward crown CAMS the clutch out decisively instead of wedging.
//   · toothH = tan α · (pitch arc at rMean) · rampFrac — the rise the ramp
//     makes across its own arc; height is a consequence of the angle.
//   · valleyFrac > tipFrac ON PURPOSE: the (valleyFrac − tipFrac) pitch
//     fraction is the coupling's BACKLASH — under drive the faces bear
//     while the ramps hold daylight, so the only coplanar working contact
//     is the declared one (the coplanar-solids case the proximity
//     instruments misread).
// ---------------------------------------------------------------------------
export function sawCouplingSpec({ rOut, rIn, teeth, rampOverFriction = 2, mu = MU_STEEL,
                                  tipFrac = 0.15, valleyFrac = 0.30 }) {
  const rMean = (rOut + rIn) / 2;
  const pitch = (Math.PI * 2) / teeth;          // rad of relative angle per tooth
  const rampFrac = 1 - tipFrac - valleyFrac;    // the ramp takes what the flats leave
  const tanAlpha = rampOverFriction * mu;
  const toothH = tanAlpha * (pitch * rMean) * rampFrac;
  const backlashFrac = valleyFrac - tipFrac;    // free play, as a fraction of a pitch
  return { rOut, rIn, rMean, teeth, pitch, tipFrac, valleyFrac, rampFrac,
           tanAlpha, toothH, backlashFrac };
}

// Tooth-top height above the ring's base plane at local pitch fraction
// v ∈ [0,1): valley flat → ramp → tip flat, the drive face being the step
// back to the valley at v = 1⁻. The LOCAL +v direction is the direction the
// profile climbs; which world sense that is belongs to the consumer's
// mounting, not to this law.
export function sawProfileAt(spec, v) {
  const u = ((v % 1) + 1) % 1;
  if (u < spec.valleyFrac) return 0;
  if (u < spec.valleyFrac + spec.rampFrac)
    return spec.toothH * ((u - spec.valleyFrac) / spec.rampFrac);
  return spec.toothH;
}

// The coupling's one-sided ride law: the smallest axial LIFT (extra
// separation above the seated gap) that lets the two rings coexist at
// relative angle delta (rad) from the seated index. Solved by sampling the
// two profiles against each other — the same law the meshes are cut from,
// so this is the §99 "smallest lift that clears" answered from the source
// profile rather than from a re-implementation. Seated (delta inside the
// backlash) the lift is 0; camming (delta climbing the ramps) it rises to
// toothH and snaps at the next pitch.
export function sawCouplingLiftAt(spec, delta) {
  const P = spec.pitch;
  const d = (((delta % P) + P) % P) / P;        // relative shift, pitch fractions
  const S = 96;                                 // samples per pitch — the profile is piecewise linear, this over-resolves every knee
  let need = 0;
  for (let i = 0; i < S; i++) {
    const v = i / S;
    // ring A's tooth top at v, facing ring B's top at (v − d) mirrored: the
    // facing ring runs its profile in the OPPOSITE local sense (it was
    // flipped to face us), so its height at shared azimuth v is prof(d − v).
    const sum = sawProfileAt(spec, v) + sawProfileAt(spec, d - v);
    if (sum > need) need = sum;
  }
  return Math.max(0, need - spec.toothH);       // seated interference is exactly toothH (tip in valley)
}

// TODO 115 — THE SEAT INDEX OF A MIRRORED PAIR. `sawCouplingLiftAt` above and
// the mounting convention beside it are written for a pair cut `sense: +1`,
// where relative index 0 IS the drive faces bearing and the BACKLASH runs from
// there to `backlashFrac`. Mirroring the cut — which is what reversing the
// movement costs this joint, since the faces have to move to the other flank —
// swaps the two ends of that window: the mirrored pair's faces bear at its FAR
// end. So a mirrored pair is clocked by exactly the backlash, and the ride law
// is read at the same offset.
//
// ONE number, in the metal and in the law. Measured on the built pair, the two
// can be given different offsets and the coupling then rides a coupling that is
// not there: at clocking 0.075·pitch with the law unshifted every column of
// `stemClutchHandoff` still passed while the camming pose stood 0.0256 off its
// contact — inside the 0.03 tolerance, and wrong. With both at this offset the
// same pose measures 0.0003.
export const sawSeatOffset = (spec, sense) => (sense < 0 ? spec.backlashFrac * spec.pitch : 0);

// The going stem's instance of the coupling, as DIMENSIONS (the alarm's,
// when built, declares its own):
//   · SAW_TEETH = windPinionTeeth — one saw tooth per leaf, the classic
//     cut: the coupling's pitch equals the pinion's leaf pitch, so the
//     assembly clocking is leaf-aligned, and the knob's lost motion after
//     a reversal is one leaf (2π/8 = 45° at the knob — the crown is direct
//     on the stem, nothing gears the feel).
//   · ring radii: rOut = the pinion's PITCH radius (the coupling is cut on
//     the pinion's own hub face, inside the silhouette the stem already
//     sweeps — no new radius near the crown-wheel mesh); rIn = the stem
//     plus a §50 pivot-floor wall.
//   · STEM_CLUTCH_OFF — the clutch rim's home offset outboard of the
//     pinion's centre: half the pinion, the two ring bases, the seated
//     tooth interleave (one toothH), half the rim. The keyless solve adds
//     it to the setting-wheel station and the yoke's tracked band, which
//     is the whole P3 cost of the split, paid in position space.
// §234 — STEM STOCK, the floor a stem is CUT from (TODO 145 group B). Real
// stems are threaded to the tap series — tap 7 is ⌀0.70 mm, tap 8 ⌀0.80,
// 9 ⌀0.90, 10 ⌀1.00 — and tap 7 is the smallest a stem is cut to; the thread
// is the stem's thinnest station, so a shaft under it is not stem stock at
// all. Declared as a RADIUS in units because every stem here is built as a
// cylinder of one, and only the floor is declared because only the floor
// has a consumer: the alarm pusher (main.js, ALARM_PUSH_STEM_R) is cut to it;
// the other group-B bars land one at a time against the same number.
export const STEM_STOCK_MIN_MM = 0.70;
export const STEM_STOCK_R_U = STEM_STOCK_MIN_MM / 2 / UNIT_MM;   // 0.924 u
// §234 step 3b — the WINDING stem, cut from stem stock. It was `STEM_R = 0.45`,
// a bare literal at L/D 35.3 (the census bar is this shaft plus the winding
// crown, `tools/probe-234-*`'s convention: `turning` clusters the coaxial
// pair). The turning target alone would ask r 0.884 (barLen 31.81 u / 36), but
// the stock floor is wider and governs, exactly as the alarm pusher's did — the
// winding crown IS the primary crown the hand turns, so this is the one stem
// in the movement stock most obviously has to fit. `main.js` asserts the
// bore/tooth-count chain this radius drives (KW_PIN_BORE, KW_BEVEL) against
// the live spec.
export const STEM_R = STEM_STOCK_R_U;
// TODO 136 — THE TWO STEM MEMBERS ARE CONES NOW, so their stations are planes of
// a cut, not halves of a declared thickness. Both keyless corners are Σ = 90°
// bevels (crown wheel ⇄ winding pinion, setting wheel ⇄ clutch rim), and a
// bevel's blank is measured from the pair's shared APEX — which sits where the
// wheel's vertical axis crosses the stem. These are the four planes this file's
// stack arithmetic needs, all of them `bevelToothSpec` outputs at KW_MODULE with
// the counts and bores main.js cuts to:
//
//   pinFaceOut = pin.zWebHi              — the pinion's big-end web face
//   rimFaceOut = rim.zWebLo              — the clutch rim's small-end web face
//   rimBack    = rim.zWebHi − rim.zWebLo — the rim's whole axial stock
//   rimTip     = rim.zWebLo − rim.zTipLo — its tooth tips, outboard of that face
//
// They are LITERALS here and only here, because layout.js cannot import
// geometry.js (the dependency runs the other way, and the cycloidal tooth solve
// the cone's root angle needs lives there). main.js therefore ASSERTS every row
// against the spec it actually cuts — CLAUDE.md's rule for a figure an
// instrument also computes. A drifted row is a boot warning, not a silent move.
//   setTipR    = the setting wheel's blank reach from its own axis — the fifth
//                row, and the one the CLUTCH's body has to stand clear of at
//                full pull (see YOKE_FORK_OUT)
//   tipR       = the winding pinion's and clutch rim's tip circle about the
//                stem (both cut to windPinionTeeth at KW_MODULE, so one
//                figure) — the keyless plane's ceiling (TODO 211, Z_KEYLESS)
// §234 step 3b re-cut all five: windPinionTeeth 8 → 10 moves BOTH corners
// (the crown-wheel pair through mateTeeth, the setting corner through the
// clutch rim, which is cut to windPinionTeeth's own count) and KW_PIN_BORE
// grew with the stem. main.js's own assert is what keeps these honest — a
// drift here is a boot warning, not a silent one.
export const KW_BEVEL = {
  pinFaceOut: 3.539488,
  rimFaceOut: 3.123955,
  rimBack: 0.415533,
  rimTip: 0.147443,
  setTipR: 3.517064,
  tipR: 1.754052,
};
// The pinion's COUPLING BOSS — the turned shoulder outboard of its cone that
// carries the saw ring. It exists because the crown wheel's rim overhangs the
// cone's own outboard face: a ring point at radius 1.017 from the stem stands
// only 0.016 clear of the wheel's 3.5177 tip circle, so the ring has to move
// out. The clearance alone asks 0.134; the §50 stock floor asks more and wins,
// which is why this is STOCK_MIN_U rather than the clearance expression. main.js
// asserts the clearance the boss must buy.
export const WIND_PINION_BOSS = STOCK_MIN_U;
export const STEM_SAW_SPEC = sawCouplingSpec({
  rOut: (KW_MODULE * windPinionTeeth) / 2,
  rIn: STEM_R + PIVOT_MIN_U,
  teeth: windPinionTeeth,
});
export const SAW_BASE_T = STOCK_MIN_U; // each ring's base — the §50 wheel floor
// The clutch's ring is cut radially INSET by the movement's running fit
// (0.05 — the winding idlers' 0.5 bore on a 0.45 stud, the fit genevaSpec
// already cites): identical radii would put both rings' walls on ONE
// cylinder through the interleaved band, which every proximity instrument
// misreads as burial. The profile is shared; only the skirts differ.
export const SAW_FIT = 0.05;
// Each ring's base SINKS one SAW_FIT into its carrier's face (pinion face,
// rim inboard face) — the same 0.05 quantum, spent as enclosed metal instead
// of a running gap, so neither joint is a coincident-cap knife edge (the
// coplanar case the proximity instruments cannot arbitrate; TODO 53's
// windTop weld is the precedent). The seated stack must SUBTRACT both
// sinks or the working faces stand 2×SAW_FIT apart at slip 0 — the first
// cut did exactly that, and the handoff tier read the backlash and camming
// poses 0.05–0.09 open against the ride law.
// (STEM_CLUTCH_OFF itself moved below the fork-band constants it now
// stacks over — the RIM leads the clutch and the fork band sits INBOARD
// of it, so the pinion→rim distance includes that band.)
// The stem's SQUARE, mirrored — main.js cuts the sleeve's own bore (and,
// since §234 step 3b's collar fix, the hub collars' bore too) to the
// square's side (STEM_R·√2·0.98, "a hair under inscribed so the corners
// stay inside the stem's own silhouette") plus one SAW_FIT running fit,
// exactly main.js's local `sqHole`. layout.js cannot import geometry.js's
// or main.js's locals (the dependency runs the other way), so this is a
// MIRROR of that arithmetic, in the corner-reach form the radii below
// need (a bore's own farthest point from the axis is its half-diagonal,
// side/√2 = side·√2/2). main.js asserts the built `sqHole` against it at
// boot (rule 1's "constant DERIVED, with the constraint in the comment",
// applied to a mirrored formula rather than a picked number).
export const STEM_SQ_BORE_REACH = (STEM_R * Math.SQRT2 * 0.98 + SAW_FIT) * Math.SQRT2 / 2;
// §234 step 3b — THE SPINE'S OWN BORE NOW EXCEEDS ITS OLD RADIUS. The pipe
// is cut with the square bore above; a bare 0.75 (sized, per the retired
// comment here, to sit over the saw ring's OLD rIn+SAW_FIT of 0.685) left
// the corner four-cornered "wall" negative — the built mesh's farthest
// vertex measured 0.9405, its own bore's reach, not 0.75, because an
// ExtrudeGeometry hole that exceeds its outer loop triangulates however
// earcut likes (docs/MODELING.md's warning, TODO 100's own precedent).
// That degenerate spine was the root of BOTH §234 expectedContacts misses:
// the sleeve's phantom corners swept past the yoke prong every quarter
// turn of winding, and (a separate defect, fixed beside it) the hub
// collars' bore inherited the same undersized 0.62.
//
// The wall past the bore is SAW_FIT, not the §50 wheel floor: this joint
// is not a load path (nothing bears radially on the spine's own OD here —
// the rim and collars weld onto it, and a weld reads its own kind by the
// same convention SAW_BASE_T/WIND_PINION_BOSS use for a THICKNESS, not a
// wall past a bore). The bore-vs-OD relationship this constant closes is
// exactly the one every other joint on this same body already uses SAW_FIT
// for — "the movement's fit quantum," spent here as real wall instead of a
// running gap (GROOVE_LOCAL's own comment names the identical trade against
// the rim's bore) — so a fresh margin is not being invented, the
// established one is being asked to cover one more bore. TAKING THE §50
// FLOOR INSTEAD IS NOT AVAILABLE: HUB_COLLAR_R (TODO 136, re-derived
// against the setting wheel's blank, a DIFFERENT constraint) caps how far
// this radius can grow before the yoke's arm loses the collar's face band
// at the stroke ends (main.js's own "Rule 6" build assert) — measured, the
// §50-floor wall (bore + STOCK_MIN_U ≈ 1.257) already fails that assert at
// ANY finite YK_C (the stroke-end reach's own infimum, CLUTCH_SLEEVE_R +
// CLEAR_MARGIN, exceeds HUB_COLLAR_R before the arm even enters it), where
// the SAW_FIT wall (≈ 0.990) clears it with the same margin every other
// joint here is asked to hold to. HUB_COLLAR_R growing further is out of
// this landing's scope (§234 step 3b names it settled); this is the
// largest spine the fork's own geometry can still ride.
export const CLUTCH_SLEEVE_R = STEM_SQ_BORE_REACH + SAW_FIT;
export const YOKE_PRONG_R = 0.4;      // the fork's prong post (makeYoke cuts to this)
// The yoke arm's DERIVED reach. The prong is a vertical post crossing
// the stem's plane, so it must never stand on the stem line — the old
// hypot(YK_C, stroke/2) reach put it exactly there at both stroke ends
// (that is the right arm for a pin-in-slot yoke, and this fork is not
// one). Instead the arm falls short of the line so the prong hugs a
// PARALLEL of the stem: closest at mid-stroke, where the margin against
// the spine must hold: YK_C − arm = spineR + prongR + CLEAR_MARGIN. The
// ends stand a shade farther out (the √ of the swing) — still inside the
// collar's face band, asserted at the yoke's build.
export const YOKE_ARM = YK_C - (CLUTCH_SLEEVE_R + YOKE_PRONG_R + CLEAR_MARGIN);
// THE RIM LEADS, THE FORK TRAILS. The setting wheel is a disc centred on
// the stem line (the stem threads its bore), so at full pull — when the
// rim must come within a fraction of a unit of the wheel's tooth circle
// to mesh — ANY clutch metal trailing the rim outboard stands inside the
// wheel's slab. Measured: an outboard fork band collided from ~0.37 pull
// on. So the clutch is arranged the way a real sliding pinion is turned:
// the gear at the OUTBOARD end, the fork's neck behind it, the saw
// coupling at the inboard end. Stations are clutch-local about the RIM's
// centre (+ = outboard, toward the crown):
//   · YOKE_FORK_OUT — the collar nearer the rim, lapping its INBOARD
//     face by a SAW_FIT weld (no coincident caps);
//   · groove width = prong diameter + the SAW_FIT running play per
//     flank; YOKE_FORK_IN flanks its other side;
//   · the fork TRACKS the groove's mid — YOKE_TRACK_OFF (negative:
//     behind the rim) — so the angle law aims there, not at the centre;
//   · the male saw ring's base sinks a SAW_FIT weld into the inboard
//     collar's face; SAW_RING_ROOT is its root plane, where the female
//     tips land at full seat.
export const HUB_COLLAR_T = 0.4;
// §234 step 3b — THE COLLARS' BORE. Both collars sit ON the sleeve's own
// axial span (SLEEVE_BOT..SLEEVE_TOP encloses both YOKE_FORK_IN and
// YOKE_FORK_OUT — main.js's own build comment: "bored discs riding the
// sleeve"), so a collar cut to a round hole smaller than the SQUARE's own
// corner reach buries into the square regardless of whether the sleeve's
// solid wall also happens to fill that station — two separate meshes, and
// the pair sweep judges the two directly. This was a bare 0.62 (0.17 over
// the OLD STEM_R's 0.45, per the build comment there), which the retooth
// left stale: the square's corner reach grew to STEM_R's own new figure and
// a fixed literal did not follow it, and the accidental margin that literal
// used to hold (0.17, against a smaller square) closed to a burial without
// the constant itself moving. Cut to the SAME bore the sleeve is cut to
// (main.js's `sqHole`, mirrored above as STEM_SQ_BORE_REACH) rather than
// re-picking a margin: the collars ride the identical shaft through the
// identical hole, the real-machining reading of "both bored to the same
// reamer." It lands strictly inside CLUTCH_SLEEVE_R (the spine's OD, itself
// STEM_SQ_BORE_REACH plus a wall — see its own comment), so the collar
// still welds onto real spine metal exactly as the build comment (main.js)
// describes; and it clears the bare square by only a running fit, not the
// movement's CLEAR_MARGIN, which inspect.js's EXPECTED_CONTACT_FLOORS now
// excuses by NAME (the sleeve's identical joint already was) rather than by
// the coincidence the old literal relied on. Growing this bore past the
// sleeve's own OD to buy CLEAR_MARGIN from the square instead is not
// available without either growing CLUTCH_SLEEVE_R past the yoke fork's own
// stroke-end reach (that constant's comment) or growing HUB_COLLAR_R
// (TODO 136, out of this landing's scope) — both P0/P2 costs a running-fit
// joint does not need to spend.
export const HUB_COLLAR_BORE_R = STEM_SQ_BORE_REACH;
// (HUB_COLLAR_R — the collars' radius — is derived below CLUTCH_TRAVEL since
// TODO 211: it is sized by where the fork's prong BEARS, which needs the stroke.)
// The stem bushing's foot is a 2.2 box aligned to the stem, so 1.1 is its
// half-extent along it — the term both the foot's own station and the plate's
// keyless floor are written in terms of. One declaration since TODO 136, which
// is when the two stopped agreeing: the fold pulled the setting wheel 2.83
// inboard while the stem's stroke barely moved, so the BUSHING became the
// outermost thing on this plate and the floor that had covered it stopped.
export const STEM_BUSH_FOOT_HALF = 1.1;
// A KW_MODULE spur's extrude bevel, which grows its faces outward —
// geometry.js's gearBevel(module, thickness), mirrored here because layout sits
// below geometry in the module graph. The battery holds the mirror true: a
// drifted copy shows up as the very clearance failure this bound closes.
// TODO 136 moved the reference wheel: this read the clutch RIM's 1.1, and the
// rim is a cone now with no extrude and no bevel. The thinnest KW_MODULE spur
// left is the minute wheel's 1.0 — and the module term binds at both, so the
// value is unchanged, which is the only reason this is a re-derivation rather
// than a move.
export const KW_GEAR_BEVEL = Math.min(1.0 * 0.18, KW_MODULE * 0.22);
// makeYoke's tip pad half-width (0.6 at prongGap 0) plus its own bevel
// growth (thickness 1 × 0.12) — the arm metal nearest the rim.
export const YOKE_TIP_HALF = 0.6 + 0.12;
// The collar nearer the rim: bounded by BOTH walls, whichever is deeper —
// lapping the rim's inboard face by a SAW_FIT weld, AND far enough in
// that the ARM'S TIP (which rides YOKE_TRACK_OFF with the prong) keeps
// CLEAR_MARGIN to the rim's beveled inboard face; the rim's disc dips
// 1.7+ below the stem, straight through the arm's z-band, so the along
// gap is the only separation that pair has. Measured before this bound:
// 0.109 against the 0.15 floor.
// TODO 136 — the rim's inboard face is KW_BEVEL.rimBack behind the clutch's
// reference plane now (the cone's big end, the whole stock), where it used to be
// half a declared thickness plus the extrude bevel's outward growth. A cone has
// no extrude, so the bevel term goes with it.
// The tick parks the clutch a hairline off the analytic seat (coincident
// planes are the case the BVH instruments cannot arbitrate — the tick's
// comment has the full §99 story); every reach derivation around it budgets
// it, because the DISPLAYED metal stands this much farther out than the
// closed-form stack.
export const SEAT_RELIEF = 0.005;
// …and TODO 136 adds a THIRD wall, from the other end of the stroke. At full
// pull the setting wheel is a CONE standing off the stem, and its blank
// overhangs the stem on both sides of the corner's apex — so the collar, which
// is wider than the blank's lowest point is high, has to stand clear of the tip
// CIRCLE rather than of a disc's face: every collar point is within
// HUB_COLLAR_R of the stem and therefore inside the blank's z band, which leaves
// the separation purely radial. main.js asserts that premise against the cut.
export const YOKE_FORK_OUT = Math.min(
  -(KW_BEVEL.rimBack + HUB_COLLAR_T / 2 - SAW_FIT),
  -(KW_BEVEL.rimBack + CLEAR_MARGIN + YOKE_TIP_HALF)
    + (HUB_COLLAR_T / 2 + YOKE_PRONG_R + SAW_FIT),
  KW_BEVEL.rimFaceOut - (KW_BEVEL.setTipR + CLEAR_MARGIN) - HUB_COLLAR_T / 2 - SEAT_RELIEF);
export const YOKE_FORK_IN = YOKE_FORK_OUT - (HUB_COLLAR_T + 2 * (YOKE_PRONG_R + SAW_FIT));
export const YOKE_TRACK_OFF = (YOKE_FORK_IN + YOKE_FORK_OUT) / 2;
export const SAW_RING_ROOT = YOKE_FORK_IN - HUB_COLLAR_T / 2 + SAW_FIT - SAW_BASE_T;
// The pinion→RIM distance at full seat: the pinion's half plus its ring's
// sunk base and tooth height reach the female tips' plane, and the male
// root plane (SAW_RING_ROOT, clutch-local) must land exactly there.
// TODO 136 — pinDist IS the pinion's coupling face now (the boss's outboard
// end, where the male ring seats), so the leading `WIND_PINION_T / 2` that
// carried the old disc's half-thickness is zero and gone. The stack it closes is
// unchanged: sink, base, one seated tooth height, against the female root plane.
export const STEM_CLUTCH_OFF =
  (-SAW_FIT + SAW_BASE_T + STEM_SAW_SPEC.toothH) - SAW_RING_ROOT;
// The clutch's OWN throw — derived so the pulled clutch lands EXACTLY on
// the station the old dual-purpose pinion proved: clutchHome +
// CLUTCH_TRAVEL = pinDist + CROWN_PULL_DIST. The setting wheel, the
// minute fold, the plate radius and every dial station derived from it
// therefore DO NOT MOVE — the split's whole footprint is absorbed inside
// the stroke the stem already had. (A first cut let swDist grow by the
// clutch offset instead, and the §125 dial assert refused it: the plate
// grew 2.16 and D4 fell off its two-bounds-meet optimum.) The floor it
// must keep: pulled clear of the coupling by more than the seated
// interleave — asserted at the build (toothH + margin, against a ~1.3
// travel).
export const CLUTCH_TRAVEL = CROWN_PULL_DIST - STEM_CLUTCH_OFF;

// ---------------------------------------------------------------------------
// TODO 211 — THE FORK BEARS ON A COLLAR FACE, and the clutch is where it puts it.
//
// The prong is a vertical post crossing the stem's plane beside the spine
// (YOKE_ARM holds it CLEAR_MARGIN off the sleeve at mid-stroke), so the
// generator it bears with stands at a LATERAL distance from the stem axis —
// 1.54 at mid-stroke, more at the ends, where the arm's arc carries it out.
// A collar face meets that generator only if the collar is wider than that
// distance: narrower, and the prong reaches the collar's ARRIS, a point on its
// rim edge, or (the shipped 1.273, the setting wheel's blank height and nothing
// the fork asked for) misses it altogether — 0.137 of air at every pose of the
// net, so "the yoke spring re-seats it through the fork" passed through a fork
// that touched nothing, and the clutch's station was the tick's to write.
//
// So the CONTACT is solved against the cut, both members as they are cut:
//   · the prong is makeYoke's CylinderGeometry of YOKE_PRONG_SEGMENTS, turned
//     upright (rotateX π/2), so its yoke-local outline is the polygon
//     (r·sin φ, −r·cos φ) about the arm's tip — the support toward a collar
//     face is a VERTEX of it, and which vertex depends on how far the arm has
//     tilted; main.js asserts this mirror against the built mesh;
//   · the collars are flat-faced HUB_COLLAR_SEGMENTS-gons that turn with the
//     stem, so the face is certain only inside their INRADIUS, R·cos(π/n).
// Stations here are along the stem, measured from the yoke's mid (the fork
// band's mid at half travel — layout's `yokeMidAlong`), and lateral is the
// distance from the stem axis.
export const YOKE_PRONG_SEGMENTS = 10;   // makeYoke's prong tessellation, passed to it (main.js)
export const HUB_COLLAR_SEGMENTS = 20;   // the collars' cut outline, passed to loopPts (main.js)
const YOKE_GROOVE_HALF = (YOKE_FORK_OUT - YOKE_FORK_IN - HUB_COLLAR_T) / 2;   // the free groove between the two collar faces, half
// the prong's cut vertices at a prong-centre station `a`: along offsets from the
// yoke's mid, lateral distances from the stem axis. The arm runs from the pivot
// (lateral YK_C) to the prong; the polygon is symmetric about the arm line, so
// the yoke's handedness does not choose the set.
function yokeProngVerts(a) {
  const drop = Math.sqrt(Math.max(0, YOKE_ARM * YOKE_ARM - a * a));
  const ey = [a / YOKE_ARM, drop / YOKE_ARM], ex = [ey[1], -ey[0]];
  const cl = YK_C - drop;   // the prong centre's lateral distance
  const out = [];
  for (let i = 0; i < YOKE_PRONG_SEGMENTS; i++) {
    const phi = (2 * Math.PI * i) / YOKE_PRONG_SEGMENTS;
    const x = YOKE_PRONG_R * Math.sin(phi), y = -YOKE_PRONG_R * Math.cos(phi);
    out.push({ s: a + x * ex[0] + y * ey[0], l: cl - (x * ex[1] + y * ey[1]) });
  }
  return out;
}
// The prong's SUPPORT toward a face: side −1 is its inboard-most vertex (the one
// that bears on collar In's outboard face), +1 its outboard-most (collar Out's
// inboard face). Returns the vertex's along station and lateral distance.
export function yokeProngSupport(a, side) {
  let best = null;
  for (const v of yokeProngVerts(a))
    if (!best || side * (v.s - best.s) > 1e-12 || (Math.abs(v.s - best.s) <= 1e-12 && v.l > best.l)) best = v;
  return best;   // a tie (an edge flush with the face) reports its farther vertex — the conservative one
}
// The prong-centre station at which that support lands on the plane `F`: the
// support's along station rises monotonically with `a` over the arm's swing, so
// a bisection over the whole reach is exact to float.
export function yokeOffsetForFace(F, side) {
  let lo = -YOKE_ARM * 0.9, hi = YOKE_ARM * 0.9;
  for (let k = 0; k < 64; k++) {
    const m = (lo + hi) / 2;
    if (yokeProngSupport(m, side).s > F) hi = m; else lo = m;
  }
  return (lo + hi) / 2;
}
// The two working faces, at clutch offset c (0 = seated on the saw, before the
// tick's SEAT_RELIEF; CLUTCH_TRAVEL = the setting station). The prong parks one
// SEAT_RELIEF off whichever face it bears on — §99's face-relief convention,
// the clutch's own seat's: coincident planes are the case the BVH instruments
// cannot arbitrate, and 0.005 is an order under HANDOFF_TRACK_TOL.
const yokeFaceIn = (c) => SEAT_RELIEF + c - CLUTCH_TRAVEL / 2 - YOKE_GROOVE_HALF;
const yokeFaceOut = (c) => SEAT_RELIEF + c - CLUTCH_TRAVEL / 2 + YOKE_GROOVE_HALF;
// THE BEARING GENERATOR'S REACH — the farthest any support vertex stands from
// the stem axis while bearing, over the whole stroke on either face (collar In
// carries the spring's seating load and the push home; collar Out the pull).
// Sampled, because which vertex bears changes with the arm's tilt; the ends
// govern (the arc's √ is largest there), and the sampling holds that rather
// than assuming it.
export const YOKE_BEARING_LATERAL = (() => {
  let L = 0;
  for (let i = 0; i <= 64; i++) {
    const c = (CLUTCH_TRAVEL * i) / 64;
    L = Math.max(L,
      yokeProngSupport(yokeOffsetForFace(yokeFaceIn(c) + SEAT_RELIEF, -1), -1).l,
      yokeProngSupport(yokeOffsetForFace(yokeFaceOut(c) - SEAT_RELIEF, +1), +1).l);
  }
  return L;
})();
// The collars' radius, DERIVED from that reach (TODO 211). A face contact needs
// the face under the generator WHEREVER the two members float on their own
// fits: the clutch rides the stem square on SAW_FIT and the yoke its pivot on
// PIVOT_BORE_CLEAR, each a diametral running fit, so each member can stand half
// of it off true radially and the bearing line can wander the sum. The face
// must reach that far past the generator at its INRADIUS (the polygon turns
// with the stem, so its flats come round under the prong):
//   R·cos(π/n) = YOKE_BEARING_LATERAL + (SAW_FIT + PIVOT_BORE_CLEAR) / 2.
// History: 1.5 at the first build, slimmed to 1.2 at TODO 50's split (every
// 0.1 here is 0.1 of yoke drop — Z_YOKE), grown to 1.272985 at §234 step 3b to
// clear the setting wheel's blank height (main.js's `HUB_COLLAR_R >= zTipLo`
// guard, YOKE_FORK_OUT's third-wall premise — which a wider collar still
// satisfies). None of those sized it for the fork that bears on it.
export const HUB_COLLAR_R = (YOKE_BEARING_LATERAL + (SAW_FIT + PIVOT_BORE_CLEAR) / 2)
  / Math.cos(Math.PI / HUB_COLLAR_SEGMENTS);
// KEYLESS PLANE — DERIVED (TODO 211's strata spend). Every member on the stem
// axis is a body of revolution about it, so its z-reach above the plane is its
// outer RADIUS, whatever it is turned to. Two members set the stack's reach:
// the winding pinion's and clutch rim's tip circle (KW_BEVEL.tipR, both cones
// cut at KW_MODULE to windPinionTeeth) and the fork collars (HUB_COLLAR_R,
// whose vertices stand on the circumradius). The saw rings and the sleeve are
// narrower, and main.js asserts that no mesh on the pinion or the clutch
// reaches past this figure. The whole reach must clear the plate's dial face
// (−BACK_PLATE_T, the movement side being z 0) by the one margin:
//   Z_KEYLESS = −BACK_PLATE_T − CLEAR_MARGIN − max(tipR, HUB_COLLAR_R)
//             = −2.3 − 0.15 − 1.754052 = −4.204052.
// The tip circle binds, by 0.0027 over the collars. History: −4.1 was set
// "mid-band" between a ceiling written against a −2 plate face (the face is
// −2.3 since TODO 202) and the pinion's 1.79 outer radius of the pre-§234 cut,
// which left the pinion and clutch rim 0.046 and the pinion's saw 0.1 off the
// plate (TODO 209's debt rows); TODO 211's collars grew to 1.7513 and stood
// them 0.0487 off too. The floor below is the yoke: its boss underside
// (Z_YOKE − 0.75, Z_YOKE = Z_KEYLESS − (HUB_COLLAR_R + CLEAR_MARGIN + 0.56))
// must clear the dial's back (Z_DIAL) by the margin, which asks only
// Z_KEYLESS ≥ Z_DIAL + 0.15 + 0.75 + 2.4613 = −5.77; what lies between (the
// setting lever, the motion works, the case's stem tubes) is held by the
// battery's sweeps, not by this line.
export const KEYLESS_STACK_R = Math.max(KW_BEVEL.tipR, HUB_COLLAR_R);
export const Z_KEYLESS = -BACK_PLATE_T - CLEAR_MARGIN - KEYLESS_STACK_R;
// THE FORK'S STATIONS. Seated, the prong bears on collar In with the clutch on
// its saw (YOKE_A_SEAT); pulled, it bears on collar Out with the clutch at its
// setting station (YOKE_A_FULL). The span between is the clutch's travel PLUS
// the groove's play, and the play is LOST MOTION — the prong crosses it before
// collar Out moves. Since TODO 214 the station between those ends is the YOKE'S
// TAIL ON THE SETTING LEVER'S FLANK (ykFlankStationAt, below), not a law of the
// pull; the two ends are what that contact is cut to reproduce.
export const YOKE_A_SEAT = yokeOffsetForFace(yokeFaceIn(0) + SEAT_RELIEF, -1);
export const YOKE_A_FULL = yokeOffsetForFace(yokeFaceOut(CLUTCH_TRAVEL) - SEAT_RELIEF, +1);
// The stem's setting-lever GROOVE stands outboard of everything the clutch can
// reach: at home plus cam-over lift plus the seat relief, the RIM's leading
// edge — its tooth tips — stands at STEM_CLUTCH_OFF + toothH + SEAT_RELIEF +
// rimTip (stem-local).
export const GROOVE_COLLAR_T = 0.5;  // each groove collar's thickness (main.js builds to these)
// GROOVE_LOCAL is THE LEVER'S LINE — the stem-local station the setting lever's
// beak pin stands on at both ends of the pull, and the station the lever's pivot
// is laid out against (slMidAlong in solveKeyless). It was the old groove's
// centre: half its 0.5 collar plus the 0.95 collar station (SL_LINE_HOLD) past
// the clutch's reach, the margin, and one SAW_FIT of machining spare ("a
// boundary held by float summation over an irrational tooth height loses to
// epsilon"). TODO 214 HOLDS it: the pivot it fixes fixes the tail post's two
// stations, and the hack, reset and jumper work and the plate's slot are all
// solved against those. The new groove is cut under the line rather than the
// line moved to the groove, and its inboard collar then stands
// SL_LINE_HOLD − (GROOVE_COLLAR_T + the pin's support + SEAT_RELIEF) = 0.3555
// farther from the clutch than the margin asks (main.js asserts ≥ 0).
const SL_LINE_HOLD = 0.5 / 2 + 0.95;
export const GROOVE_LOCAL = STEM_CLUTCH_OFF + STEM_SAW_SPEC.toothH + SEAT_RELIEF
  + KW_BEVEL.rimTip   // TODO 136 — the rim's LEADING EDGE is its tooth tips, past the reference face
  + SL_LINE_HOLD + CLEAR_MARGIN + SAW_FIT;
// The clutch's reach that line was laid past, published for main.js's assert.
export const GROOVE_CLUTCH_REACH = STEM_CLUTCH_OFF + STEM_SAW_SPEC.toothH + SEAT_RELIEF + KW_BEVEL.rimTip;

// ---------------------------------------------------------------------------
// TODO 214 / TODO 223 — THE CROWN → SETTING LEVER → YOKE HOPS ARE CONTACTS.
//
// Before this, both hops were laws of crownPullT. The lever's angle aimed its
// beak pin at the groove's centre (`settingLeverAngleAt`, an atan2 of the pull);
// the pin reached 0.80 inside the stem from BELOW and stood 0.33 off both groove
// collars, which were cut at r 0.75 inside a 0.924 stem. The yoke's angle carried
// the prong linearly in the pull; it stood 2.38–4.93 from the lever, across the
// stem. The lever's 1.24-thick body lay in the setting bevel at every pose, and
// the yoke's body and boss in the minute wheel (TODO 223's six burials).
//
// THE LINE DESIGN, before any fold. The chain is
//   stem collar In → beak pin → setting lever → flank → yoke tail pin → yoke →
//   prong → clutch collar Out,
// and the yoke spring closes it from the other end: it holds the tail pin on
// the lever's flank, so the lever's beak pin always bears on collar In's
// outboard face (the collar that pulls it out), and the clutch's collar In
// seats on the prong. The line's quantities are the §13 lever's own: pivot SL_C
// off the stem, beak SL_BEAK = hypot(SL_C, CROWN_PULL_DIST/2), tail SL_TAIL, a
// stroke of ±SL_TILT. They are KEPT, not re-proportioned: at both ends of the
// pull the new solve puts the pin's centre exactly where the old law put it
// (the groove's line, below), so the tail post's two stations do not move.
//
// THE FOLD, in position space only. The setting wheel's bevel lies under the
// groove at every pull (its web 1.5954 below the stem axis, KW_SPEC's zWebLo),
// so no pin can reach the groove from below; nothing else stands between the
// stem's top and the plate. So the lever goes UP: its body hugs the plate's
// dial face at the margin (Z_SETTING_LEVER), clear of the collars laterally, and
// its beak crosses OVER them as a lug whose underside clears the collars' top by
// the margin; the pin hangs from the lug down past the stem's top, its foot one
// margin over the stem, and bears on collar In's face where that face stands
// above the stem. The yoke keeps its plane and its fork; its pivot moves to the
// lever's side (YK_C, mirrored) and grows a tail.
//
// The CANONICAL FRAME the solves below are written in: s along the stem (+ =
// outboard, toward the crown), measured from the lever pivot's station
// (solveKeyless's slMidAlong); l lateral, from the stem axis, + toward the
// lever. It is right-handed where sideSign = +1 and a mirror where −1; every
// polygon solved in it is symmetric about both of its own axes (even segment
// counts), so the mirror cannot choose a different vertex set — solveKeyless
// maps it to the world, and main.js asserts the cut against it.
// ---------------------------------------------------------------------------
// The band a plane solved to land EXACTLY on CLEAR_MARGIN is lifted by, so the
// BVH-measured gap cannot read either side of it by float accumulation — the
// part clearing by slightly more, never the gate asking for less. (Moved here
// from main.js by TODO 214: the keyless planes below are cut against it.)
export const MEASURED_MARGIN_BAND = 1e-6;
// The §13 lever's own arms, kept (see above).
export const SL_BEAK = Math.hypot(SL_C, CROWN_PULL_DIST / 2);
export const SL_TILT = Math.atan2(CROWN_PULL_DIST / 2, SL_C);   // the lever's tilt at either end of the pull
// The beak pin: the old pin's stock (r 0.35, ⌀ 0.27 mm), and an EVEN segment
// count so its support toward ∓s is the same at ±SL_TILT (an even polygon is
// symmetric about both axes) — which is what lets one line station reproduce
// BOTH stroke ends exactly.
export const SL_BEAK_PIN_R = 0.35;
export const SL_BEAK_PIN_SEGMENTS = 12;
// The pin's foot stands one margin over the stem's turned surface (the stem's
// 12-gon reaches STEM_R at its vertices): over the stem, not beside it, which is
// what frees the pin from the stem's radius. Banded, as every plane landed
// exactly on the margin is.
export const SL_PIN_FOOT = STEM_R + CLEAR_MARGIN + MEASURED_MARGIN_BAND;
// The pin's cut vertices at lever tilt th (canonical; th > 0 carries the beak
// outboard). The pin's centre is SL_BEAK down the beak from the pivot (0, SL_C);
// the polygon is makeCylinder's (r·sin φ, −r·cos φ) turned upright, carried
// through the tilt.
function slPinVerts(th) {
  const c = Math.cos(th), sn = Math.sin(th);
  const cs = SL_BEAK * sn, cl = SL_C - SL_BEAK * c;
  const out = [];
  for (let i = 0; i < SL_BEAK_PIN_SEGMENTS; i++) {
    const phi = (2 * Math.PI * i) / SL_BEAK_PIN_SEGMENTS;
    const x = SL_BEAK_PIN_R * Math.sin(phi), y = -SL_BEAK_PIN_R * Math.cos(phi);
    out.push({ s: cs + x * c - y * sn, l: cl + x * sn + y * c });
  }
  return out;
}
// The pin's support toward a face: side −1 its inboard-most vertex (the one that
// bears on collar In), +1 its outboard-most. A tie reports the vertex farther
// from the stem axis, the conservative one for the collar's reach.
export function slPinSupport(th, side) {
  let best = null;
  for (const v of slPinVerts(th))
    if (!best || side * (v.s - best.s) > 1e-12 || (Math.abs(v.s - best.s) <= 1e-12 && Math.abs(v.l) > Math.abs(best.l))) best = v;
  return best;
}
// How far the bearing vertex stands inboard of the pin's centre at either
// stroke end — one number for both ends, by the polygon's symmetry.
export const SL_PIN_SUPPORT = SL_BEAK * Math.sin(SL_TILT) - slPinSupport(SL_TILT, -1).s;
// COLLAR IN'S WORKING FACE, stem-local: the line less that support and the seat
// relief the pin parks off it (§99's convention, the clutch's own seat's). At
// both stroke ends the pin's centre then lands on the line, which is where the
// §13 law put it.
export const GROOVE_FACE_IN = GROOVE_LOCAL - SL_PIN_SUPPORT - SEAT_RELIEF;
// THE LEVER'S LAW, solved against the cut: the tilt at which the pin's inboard
// vertex stands SEAT_RELIEF off collar In's face at this pull. The support
// station rises monotonically with the tilt over the whole stroke, so a
// bisection over a bracket wider than the stroke is exact to float.
export function slLeverTiltAt(pull) {
  const want = -CROWN_PULL_DIST / 2 + pull * CROWN_PULL_DIST - SL_PIN_SUPPORT;
  let lo = -SL_TILT - 0.3, hi = SL_TILT + 0.3;
  for (let k = 0; k < 64; k++) {
    const m = (lo + hi) / 2;
    if (slPinSupport(m, -1).s > want) hi = m; else lo = m;
  }
  return (lo + hi) / 2;
}
// Over the stroke: the pin's widest extent along the stem (what the groove's
// play is measured from) and the farthest its bearing vertex stands from the
// stem axis at its foot (what the collar's face must reach past).
const SL_STROKE = (() => {
  let width = 0, reach = 0;
  for (let i = 0; i <= 64; i++) {
    const th = slLeverTiltAt(i / 64);
    const lo = slPinSupport(th, -1), hi = slPinSupport(th, +1);
    width = Math.max(width, hi.s - lo.s);
    reach = Math.max(reach, Math.hypot(lo.l, SL_PIN_FOOT));
  }
  return Object.freeze({ width, reach });
})();
// COLLAR OUT'S FACE: the pin bears on collar In whenever the yoke spring holds
// it there, so collar Out is never a working face here — it stands past the
// pin's widest extent by the margin (the pair is not a declared contact), the
// seat relief and the band. The groove ends one collar beyond it.
export const GROOVE_FACE_OUT = GROOVE_FACE_IN + SEAT_RELIEF + SL_STROKE.width + CLEAR_MARGIN + MEASURED_MARGIN_BAND;
export const GROOVE_OUTER = GROOVE_FACE_OUT + GROOVE_COLLAR_T;
// THE COLLARS' RADIUS, TODO 211's rule on the stem's own groove. The bearing
// generator's lowest point stands GROOVE_BEARING_REACH from the stem axis, and
// the face must reach past it wherever the two members float on their fits: the
// stem on its running fit (SAW_FIT, the clutch's own figure on the same stem)
// and the lever on its stud (PIVOT_BORE_CLEAR), half of each. The collars are
// GROOVE_COLLAR_SEGMENTS-gons turning with the stem, so the face is certain only
// inside their inradius. (They were r 0.75 on a 0.924 stem: inside it, TODO 223.)
export const GROOVE_COLLAR_SEGMENTS = 48;
export const GROOVE_BEARING_REACH = SL_STROKE.reach;
export const GROOVE_COLLAR_R = (GROOVE_BEARING_REACH + (SAW_FIT + PIVOT_BORE_CLEAR) / 2)
  / Math.cos(Math.PI / GROOVE_COLLAR_SEGMENTS);
// THE LEVER'S PLANES. Its body is the §13 plate's 1-thick stock with the
// extrude's 0.12 bevel each face (geometry.js's thickness·0.12): it hugs the
// plate's dial face at the margin, which is the conventional place for a setting
// lever — on the plate. Its beak LUG crosses over the collars at the margin from
// their top and rises to the body's top face; main.js asserts the lug's section
// against §50's floor.
export const SL_BODY_T = 1;
export const SL_BODY_BEVEL = SL_BODY_T * 0.12;
export const Z_SETTING_LEVER = -BACK_PLATE_T - CLEAR_MARGIN - MEASURED_MARGIN_BAND - (SL_BODY_T / 2 + SL_BODY_BEVEL);
export const SL_LUG_TOP = Z_SETTING_LEVER + SL_BODY_T / 2 + SL_BODY_BEVEL;
export const SL_LUG_BOT = Z_KEYLESS + GROOVE_COLLAR_R + CLEAR_MARGIN + MEASURED_MARGIN_BAND;

// ---- The yoke, canonical. Its pivot is the clutch stroke's mid (the fork
// tracks the hub groove), YK_C toward the lever; its prong at station a stands
// at (a, −√(arm² − a²)) from the pivot.
export const YK_DS = STEM_CLUTCH_OFF + CLUTCH_TRAVEL / 2 + YOKE_TRACK_OFF - CROWN_PULL_DIST / 2 - GROOVE_LOCAL;
const ykDrop = (a) => Math.sqrt(Math.max(0, YOKE_ARM * YOKE_ARM - a * a));
export const ykArmHeading = (a) => Math.atan2(-ykDrop(a), a);   // the arm's canonical heading from the pivot
// THE TAIL: a BELL CRANK of equal arms, the tail the fork's own arm turned a
// right angle toward the crown. Equal arms make the yoke a 1:1 crank — the
// tail pin's stroke is the prong's, so the yoke multiplies nothing and the
// whole ratio of the hop lives in the lever's flank, where it can be read; a
// right angle puts the pin's stroke square to the arm, so it runs along the
// lever's line of travel and the pin never swings toward the stem. The pin is
// the prong's own stock and polygon (one stock for the yoke's two posts).
export const YK_TAIL_PIN_R = YOKE_PRONG_R;
export const YK_TAIL_PIN_SEGMENTS = YOKE_PRONG_SEGMENTS;
function ykTailVerts(a) {
  const h = ykArmHeading(a), t = h + Math.PI / 2;
  const cs = YK_DS + YOKE_ARM * Math.cos(t), cl = YK_C + YOKE_ARM * Math.sin(t);
  const r = h - Math.PI / 2, c = Math.cos(r), sn = Math.sin(r);
  const out = [];
  for (let i = 0; i < YK_TAIL_PIN_SEGMENTS; i++) {
    const phi = (2 * Math.PI * i) / YK_TAIL_PIN_SEGMENTS;
    const x = YK_TAIL_PIN_R * Math.sin(phi), y = -YK_TAIL_PIN_R * Math.cos(phi);
    out.push({ s: cs + x * c - y * sn, l: cl + x * sn + y * c });
  }
  return { centre: { s: cs, l: cl }, verts: out };
}
export const ykTailPinAt = (a) => ykTailVerts(a).centre;
// …into the lever's own frame at tilt th (relative to its pivot, untilted).
const toLever = (p, th) => {
  const x = p.s, y = p.l - SL_C, c = Math.cos(th), sn = Math.sin(th);
  return { s: x * c + y * sn, l: -x * sn + y * c };
};
// THE FLANK. A straight edge on the lever whose normal n̂ (lever frame, pointing
// out of the metal toward the pin) and offset c are SOLVED so the pin's polygon
// stands SEAT_RELIEF off it at BOTH stroke ends with the yoke at its two
// stations: two conditions, two unknowns. n̂ starts square to the pin centre's
// chord in the lever's frame, takes the sense in which the lever turns the yoke
// the right way, and is refined by bisection to the exact polygon support.
const flankGap = (beta, th, a) => {
  const nx = Math.cos(beta), ny = Math.sin(beta);
  let m = Infinity;
  for (const v of ykTailVerts(a).verts) { const q = toLever(v, th); m = Math.min(m, nx * q.s + ny * q.l); }
  return m;
};
export const SL_FLANK = (() => {
  const th0 = slLeverTiltAt(0), th1 = slLeverTiltAt(1);
  const L0 = toLever(ykTailVerts(YOKE_A_SEAT).centre, th0), L1 = toLever(ykTailVerts(YOKE_A_FULL).centre, th1);
  const tl = Math.hypot(L1.s - L0.s, L1.l - L0.l), ts = (L1.s - L0.s) / tl, tlv = (L1.l - L0.l) / tl;
  // The sense: the lever pushes the pin along +n (world), and that must turn the
  // yoke CCW in canonical (prong outboard) — (pin − yoke pivot) × n > 0 at seat.
  const Q0 = ykTailVerts(YOKE_A_SEAT).centre;
  const nW = (b, th) => ({ s: Math.cos(b + th), l: Math.sin(b + th) });
  let beta = Math.atan2(-ts, tlv);   // one of the chord's two normals
  { const n = nW(beta, th0); if ((Q0.s - YK_DS) * n.l - (Q0.l - YK_C) * n.s < 0) beta += Math.PI; }
  const h = (b) => flankGap(b, th0, YOKE_A_SEAT) - flankGap(b, th1, YOKE_A_FULL);
  let lo = beta - 0.3, hi = beta + 0.3, flo = h(lo);
  for (let k = 0; k < 64; k++) { const m = (lo + hi) / 2, fm = h(m); if ((fm > 0) === (flo > 0)) { lo = m; flo = fm; } else hi = m; }
  beta = (lo + hi) / 2;
  const c = flankGap(beta, th0, YOKE_A_SEAT) - SEAT_RELIEF;
  return Object.freeze({ beta, nx: Math.cos(beta), ny: Math.sin(beta), c });
})();
// THE YOKE'S STATION AT A PULL — the tail pin SEAT_RELIEF off the flank. The gap
// rises with the station (the lever pushes the pin the way the yoke turns), so
// a bisection is exact; at pull 0 and 1 it returns YOKE_A_SEAT and YOKE_A_FULL,
// by the flank's construction.
export function ykFlankStationAt(pull) {
  const th = slLeverTiltAt(pull);
  const want = SL_FLANK.c + SEAT_RELIEF;
  let lo = YOKE_A_SEAT - 1, hi = YOKE_A_FULL + 1;
  for (let k = 0; k < 64; k++) {
    const m = (lo + hi) / 2;
    if (flankGap(SL_FLANK.beta, th, m) > want) hi = m; else lo = m;
  }
  return (lo + hi) / 2;
}
// The clutch is then wherever the farther-out constraint puts it: the prong
// pushing collar Out, or the saw's ramps lifting it (a backward crown) — the
// yoke spring holds the prong on collar In, so a lifted clutch carries the yoke
// out with it, and the tail leaves the flank. Pushing home is the same contact
// in reverse: the flank retreats and the spring keeps the tail on it.
export function yokeClutchAt(pull, lift) {
  const aLever = ykFlankStationAt(pull);
  const cDrive = Math.max(0, yokeProngSupport(aLever, +1).s + SEAT_RELIEF - yokeFaceOut(0));
  const c = Math.max(lift, cDrive);
  const a = Math.max(aLever, yokeOffsetForFace(yokeFaceIn(c) + SEAT_RELIEF, -1));
  return { c, a };
}
// THE HOP AS A TABLE, sampled over the pull: the lever's tilt, the yoke's
// station, the contact on the flank, its normal, the moment arms of that normal
// about each pivot, and the friction cone's worst arm — what TODO 16's format
// prices the yoke spring against, and what main.js asserts.
const cross2 = (a, b) => a.s * b.l - a.l * b.s;
export const KEYLESS_HOP = (() => {
  const muA = Math.atan(MU_STEEL), rows = [];
  for (let i = 0; i <= 32; i++) {
    const pull = i / 32, th = slLeverTiltAt(pull), a = ykFlankStationAt(pull);
    const n = { s: Math.cos(SL_FLANK.beta + th), l: Math.sin(SL_FLANK.beta + th) };
    // the contact: the tail pin's vertex nearest the flank
    let C = null, best = Infinity;
    for (const v of ykTailVerts(a).verts) {
      const g = n.s * v.s + n.l * (v.l - SL_C);
      if (g < best) { best = g; C = v; }
    }
    const dY = cross2({ s: C.s - YK_DS, l: C.l - YK_C }, n), dL = cross2({ s: C.s, l: C.l - SL_C }, n);
    let cone = Infinity;
    for (const e of [-muA, muA]) {
      const ne = { s: n.s * Math.cos(e) - n.l * Math.sin(e), l: n.s * Math.sin(e) + n.l * Math.cos(e) };
      cone = Math.min(cone, cross2({ s: C.s - YK_DS, l: C.l - YK_C }, ne), cross2({ s: C.s, l: C.l - SL_C }, ne));
    }
    rows.push(Object.freeze({ pull, th, a, C, n, dY, dL, cone, lever: { s: toLever(C, th).s, l: toLever(C, th).l } }));
  }
  return Object.freeze(rows);
})();
// The two pivots' staffs (addDialSidePivot's staffR for both keyless levers),
// declared here because the yoke spring's line is cleared against the yoke's.
export const KEYLESS_STAFF_R = 0.45;
// THE YOKE SPRING, in TODO 16's format. A grounded flat blade on a stud bears on
// the tail pin from the far side of its stroke and holds it on the flank: the
// restoring element of the whole hop — it returns the yoke, and through the
// flank the lever, whose beak pin then follows collar In home.
//   · section: SPRING_FLAT_U thick in the direction it bends (the movement's
//     flat-spring stock), standing on edge;
//   · PRELOAD ONE STROKE: the blade is already bent by the tail pin's whole
//     travel at seat, so its force exactly doubles across the pull — the
//     flattest a blade of finite length can be made without a longer one;
//   · FREE LENGTH: what that doubled deflection asks of the stock at the
//     TARGET stress (0.9 of SPRING_SIGMA_Y_PA, the TARGET convention), from
//     σ = 3·E·t·δ / (2·L²);
//   · ANCHOR: back along the stroke's normal at that length, raised just far
//     enough that the blade clears the yoke's own staff by the margin at every
//     station — the staff stands squarely in the blade's straight line;
//   · HEIGHT: what puts the flank's force at the two stroke ends symmetrically
//     inside SELECTOR_DETENT_WINDOW_MN on a log scale, N(0)·N(1) = lo·hi, so each
//     end has the same factor of margin to its wall.
// The blade is drawn rigid, aimed each pose from its anchor to its tangent on
// the pin (the alarm feeler's blade is the precedent); the force figures are the
// bent blade's.
export const YK_SPRING = (() => {
  const mPerU = UNIT_MM / 1000, E = STEEL_E_PA, t = SPRING_FLAT_U;
  const sigT = 0.9 * SPRING_SIGMA_Y_PA;
  const rho = YK_TAIL_PIN_R + t / 2;                  // the blade's centreline stands this off the pin's axis
  const Q0 = ykTailPinAt(YOKE_A_SEAT), Q1 = ykTailPinAt(YOKE_A_FULL);
  const stroke = Math.hypot(Q1.s - Q0.s, Q1.l - Q0.l);
  const sd = { s: (Q1.s - Q0.s) / stroke, l: (Q1.l - Q0.l) / stroke };   // the stroke's direction (outward, the way the spring resists)
  const L = Math.sqrt((3 * E * t * mPerU * 2 * stroke * mPerU) / (2 * sigT)) / mPerU;
  // the blade lies across the stroke, on its far side, its tip at the stroke's
  // mid; the anchor is L back along the side away from the crown (the plate's
  // rim is the other way), raised by γ until the staff is cleared
  const Qm = { s: (Q0.s + Q1.s) / 2, l: (Q0.l + Q1.l) / 2 };
  const across = { s: -sd.l, l: sd.s };               // the stroke turned a right angle
  const back = across.s < 0 ? across : { s: -across.s, l: -across.l };   // toward −s
  const tip = { s: Qm.s + sd.s * rho, l: Qm.l + sd.l * rho };
  const tangent = (A, Q) => {   // the blade from A tangent to the pin circle (Q, rho) on the stroke's far side
    const dx = Q.s - A.s, dy = Q.l - A.l, d = Math.hypot(dx, dy), phi = Math.asin(rho / d);
    const base = Math.atan2(dy, dx);
    let best = null;
    for (const sgn of [1, -1]) {
      const ang = base + sgn * phi, len = Math.sqrt(d * d - rho * rho);
      const T = { s: A.s + Math.cos(ang) * len, l: A.l + Math.sin(ang) * len };
      const side = (T.s - Q.s) * sd.s + (T.l - Q.l) * sd.l;   // + = on the stroke's far side
      if (!best || side > best.side) best = { T, len, ang, side };
    }
    return best;
  };
  const segDist = (A, B, P) => {
    const vx = B.s - A.s, vy = B.l - A.l, L2 = vx * vx + vy * vy;
    const u = Math.max(0, Math.min(1, ((P.s - A.s) * vx + (P.l - A.l) * vy) / L2));
    return Math.hypot(P.s - A.s - u * vx, P.l - A.l - u * vy);
  };
  const need = KEYLESS_STAFF_R + t / 2 + CLEAR_MARGIN + MEASURED_MARGIN_BAND;
  const anchorAt = (g) => ({ s: tip.s + L * (back.s * Math.cos(g) + sd.s * Math.sin(g)), l: tip.l + L * (back.l * Math.cos(g) + sd.l * Math.sin(g)) });
  const clearAt = (g) => {
    const A = anchorAt(g);
    let m = Infinity;
    for (const a of [YOKE_A_SEAT, (YOKE_A_SEAT + YOKE_A_FULL) / 2, YOKE_A_FULL])
      m = Math.min(m, segDist(A, tangent(A, ykTailPinAt(a)).T, { s: YK_DS, l: YK_C }));
    return m;
  };
  let lo = 0, hi = 0.8;
  for (let k = 0; k < 64; k++) { const m = (lo + hi) / 2; if (clearAt(m) >= need) hi = m; else lo = m; }
  const gamma = hi, A = anchorAt(gamma);
  // the blade's FREE line: through the anchor, bent one stroke short of the seat
  // tangent at its tip — so the deflection at any station is the tip's distance
  // from it, measured square to the free line
  const at = (a) => {
    const Q = ykTailPinAt(a), tg = tangent(A, Q);
    return { Q, T: tg.T, len: tg.len, ang: tg.ang, n: { s: -Math.sin(tg.ang), l: Math.cos(tg.ang) } };
  };
  const s0 = at(YOKE_A_SEAT);
  // the free line: A→T0 turned by asin(stroke/len) the way that moves its tip
  // back along −stroke (the pin has pushed it one stroke out at seat)
  const turn = Math.asin(Math.min(1, stroke / s0.len));
  const tipOf = (ang) => ({ s: A.s + Math.cos(ang) * s0.len, l: A.l + Math.sin(ang) * s0.len });
  const along = (p) => p.s * sd.s + p.l * sd.l;
  const freeAng = along(tipOf(s0.ang + turn)) < along(tipOf(s0.ang - turn)) ? s0.ang + turn : s0.ang - turn;
  const fd = { s: Math.cos(freeAng), l: Math.sin(freeAng) }, fn = { s: -fd.l, l: fd.s };
  const deflAt = (a) => { const T = at(a).T; return Math.abs((T.s - A.s) * fn.s + (T.l - A.l) * fn.l); };
  // force on the pin: along the bent blade's normal, AWAY from the blade (it
  // pushes the pin back along −stroke); its moment about the yoke's pivot
  const endsRaw = [0, 1].map((pull) => {
    const a = pull ? YOKE_A_FULL : YOKE_A_SEAT, g = at(a), d = deflAt(a);
    let push = { s: g.n.s, l: g.n.l };
    if (push.s * sd.s + push.l * sd.l > 0) push = { s: -push.s, l: -push.l };
    const M = cross2({ s: g.Q.s - YK_DS, l: g.Q.l - YK_C }, push);   // per unit force, in u
    const row = KEYLESS_HOP[pull ? KEYLESS_HOP.length - 1 : 0];
    return { a, defl_u: d, armSpring_u: Math.abs(M), dY_u: row.dY, len_u: g.len, turnsBack: M < 0 };
  });
  // the scale: N(p) = k·δ(p)·armSpring(p)/dY(p); N(0)·N(1) = lo·hi
  const [wLo, wHi] = SELECTOR_DETENT_WINDOW_MN;
  const g0 = endsRaw[0].defl_u * mPerU * endsRaw[0].armSpring_u / endsRaw[0].dY_u;
  const g1 = endsRaw[1].defl_u * mPerU * endsRaw[1].armSpring_u / endsRaw[1].dY_u;
  const k = Math.sqrt((wLo * wHi) / (g0 * g1)) / 1000;   // N/m (the window is in mN)
  const I = (k * (L * mPerU) ** 3) / (3 * E);
  const w = (12 * I) / (t * mPerU) ** 3 / mPerU;          // the blade's height, u
  const ends = endsRaw.map((e) => {
    const F_mN = 1000 * k * e.defl_u * mPerU;
    return Object.freeze({ ...e, F_mN, N_mN: (F_mN * e.armSpring_u) / e.dY_u,
      sigma_Pa: (3 * E * t * mPerU * e.defl_u * mPerU) / (2 * (L * mPerU) ** 2) });
  });
  return Object.freeze({ t_u: t, w_u: w, L_u: L, k_N_per_m: k, stroke_u: stroke, gamma, anchor: A, freeAng,
    staffClear_u: clearAt(gamma), staffNeed_u: need, sigmaTarget_Pa: sigT, ends, bladeAt: at });
})();

// ---------------------------------------------------------------------------
// TODO 214 — THE TWO LEVERS' OUTLINES, cut from the solves above. MODELING.md
// rule 1: the builder consumes the outline the solve was written against, so
// the metal and the arithmetic share one source. Everything here is in the
// LEVER-CANONICAL frame — the lever's own pivot at the origin, s across (+ =
// outboard at mid-stroke), l along (the beak at −l, the tail at +l) — and
// `toLeverLocal` maps it into the group's local frame (x = −sideSign·s,
// y = −l: a half turn where sideSign = +1, a mirror where −1; the extrude
// normalises the winding either way).
export const toLeverLocal = (p, sideSign) => ({ x: -sideSign * p.s, y: -p.l });
// One convex bite out of a simple polygon: P minus the convex polygon C, where
// C crosses P's boundary exactly twice. The new boundary follows C's arc that
// lies inside P. Returns null if the bite is not a single one (the caller warns).
function insidePoly(P, q) {
  let w = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const a = P[i], b = P[j];
    if ((a.l > q.l) !== (b.l > q.l) && q.s < ((b.s - a.s) * (q.l - a.l)) / (b.l - a.l) + a.s) w = !w;
  }
  return w;
}
function segX(a, b, c, d) {
  const r = { s: b.s - a.s, l: b.l - a.l }, q = { s: d.s - c.s, l: d.l - c.l };
  const den = r.s * q.l - r.l * q.s;
  if (Math.abs(den) < 1e-15) return null;
  const t = ((c.s - a.s) * q.l - (c.l - a.l) * q.s) / den, u = ((c.s - a.s) * r.l - (c.l - a.l) * r.s) / den;
  return (t >= 0 && t < 1 && u >= 0 && u < 1) ? { t, u, p: { s: a.s + t * r.s, l: a.l + t * r.l } } : null;
}
export function biteConvex(P, C) {
  const hits = [];
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length];
    for (let j = 0; j < C.length; j++) {
      const x = segX(a, b, C[j], C[(j + 1) % C.length]);
      if (x) hits.push({ i, j, t: x.t, u: x.u, p: x.p });
    }
  }
  if (hits.length !== 2) return null;
  hits.sort((h1, h2) => (h1.i - h2.i) || (h1.t - h2.t));
  const [h0, h1] = hits;
  // which of P's two chains between the hits lies outside C — that one stays
  const chainA = [];   // h0 → h1 forward along P
  for (let k = h0.i + 1; k <= h1.i; k++) chainA.push(P[k % P.length]);
  const aOut = chainA.length ? !insidePoly(C, chainA[Math.floor(chainA.length / 2)]) : false;
  // simpler and robust: collect C's vertices between the two crossing edges in
  // each direction, and keep the run whose interior lies inside P
  const runFwd = [], runBwd = [];
  for (let j = (h0.j + 1) % C.length; j !== (h1.j + 1) % C.length; j = (j + 1) % C.length) runFwd.push(C[j]);
  for (let j = h0.j; j !== h1.j; j = (j - 1 + C.length) % C.length) runBwd.push(C[j]);
  const inP = (run) => run.length ? insidePoly(P, run[Math.floor(run.length / 2)]) : true;
  const cRun = inP(runFwd) && !inP(runBwd) ? runFwd : runBwd;   // h0 → h1 along C, through P's interior
  if (aOut) {
    // keep P's forward chain h0→h1 and close back along C from h1 to h0
    return [h0.p, ...chainA, h1.p, ...cRun.slice().reverse()];
  }
  // keep P's chain h1 → h0 (the rest), bridging h0 → h1 along C
  const rest = [];
  for (let k = h1.i + 1; k <= h0.i + P.length; k++) rest.push(P[k % P.length]);
  return [h1.p, ...rest, h0.p, ...cRun];
}
// the convex hull of a point set (monotone chain), CCW
function hull2(pts) {
  const P = pts.slice().sort((a, b) => (a.s - b.s) || (a.l - b.l));
  const cr = (o, a, b) => (a.s - o.s) * (b.l - o.l) - (a.l - o.l) * (b.s - o.s);
  const lo = [], up = [];
  for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  up.pop(); lo.pop();
  return lo.concat(up);
}
// a polygonal stadium about the segment a→b, radius r, `n` points per cap (CCW)
function stadium(a, b, r, n = 24) {
  const ang = Math.atan2(b.l - a.l, b.s - a.s), out = [];
  for (let i = 0; i <= n; i++) { const t = ang - Math.PI / 2 + (Math.PI * i) / n; out.push({ s: b.s + r * Math.cos(t), l: b.l + r * Math.sin(t) }); }
  for (let i = 0; i <= n; i++) { const t = ang + Math.PI / 2 + (Math.PI * i) / n; out.push({ s: a.s + r * Math.cos(t), l: a.l + r * Math.sin(t) }); }
  return out;
}
// THE SETTING LEVER. The §13 plan is kept where nothing asks otherwise: the
// same 3-wide plate (SL_HW each side), its sides the same quadratic from the
// tail's corners through (1.8·SL_HW, 0) toward (0.55·SL_HW, −0.85·SL_BEAK). Three
// things are cut into it:
//   · THE BEAK ENDS where its bevelled metal clears the groove collars by the
//     margin at the body's underside — the end's corners are its lowest
//     points over the stroke, so the end is SOLVED there (SL_BEAK_END);
//   · a LUG over the collars carries the pin the rest of the way: a stadium from
//     inside the body's end to the pin's centre, its wall round the pin one §50
//     floor (STOCK_MIN_U);
//   · THE FLANK: the yoke's tail pin sweeps a near-straight path in the lever's
//     frame (it touches the flank at every station, so its centres lie on a
//     line), and a stadium about that path — the pin plus the margin plus the
//     extrude's bevel, slid toward the pin by the margin less the relief — is
//     bitten out of the plate. Its straight side IS the flank, landed so the
//     BEVELLED wall stands on the solved line; everywhere else the plate stands
//     the margin off the pin. The path is run on one margin past each end so
//     the contact never reaches the bite's round ends.
export const SL_HW = 1.5;
export const SETTING_LEVER_CUT = (() => {
  const hw = SL_HW, bev = SL_BODY_BEVEL;
  const quad = (t, sgn) => {
    const p0 = { s: sgn * hw, l: SL_TAIL }, p1 = { s: sgn * 1.8 * hw, l: 0 }, p2 = { s: sgn * 0.55 * hw, l: -0.85 * SL_BEAK };
    const u = 1 - t;
    return { s: u * u * p0.s + 2 * u * t * p1.s + t * t * p2.s, l: u * u * p0.l + 2 * u * t * p1.l + t * t * p2.l };
  };
  // the body's underside, relative to the stem axis, and the collars' keep-out
  // there: the nominal outline must clear (R + margin) both at the bottom face
  // and at the top of the bottom chamfer, where the bevel has grown it
  const dzB = (Z_SETTING_LEVER - SL_BODY_T / 2 - bev) - Z_KEYLESS;
  const keep = GROOVE_COLLAR_R + CLEAR_MARGIN + MEASURED_MARGIN_BAND;
  // (the bevel grows a CORNER by bev / cos(half its turn), MODELING.md rule 1 —
  // the beak end's corners are its lowest points, so their miter is the bevel
  // the end is cleared with: measured, a plain bev left collar Out 0.1492 off)
  const miter = (() => {
    let tE = 0, tB = 1;
    for (let k = 0; k < 60; k++) { const m = (tE + tB) / 2; if (quad(m, 1).l > -0.8 * SL_BEAK) tE = m; else tB = m; }
    const a = quad(tE - 1e-4, 1), b = quad(tE, 1);
    const side = Math.atan2(b.l - a.l, b.s - a.s), turn = Math.abs(Math.PI - Math.abs(side - Math.PI));   // the side's heading against the end's (−s)
    return bev / Math.cos(Math.min(turn, Math.PI - 0.2) / 2);
  })();
  const latMin = Math.max(Math.sqrt(keep * keep - dzB * dzB), miter + Math.sqrt(Math.max(0, keep * keep - (dzB + bev) ** 2)));
  // the side curve's s at a given l (the quadratic is monotone in l)
  const sideAt = (l) => { let lo = 0, hi = 1; for (let k = 0; k < 60; k++) { const m = (lo + hi) / 2; if (quad(m, 1).l > l) lo = m; else hi = m; } return quad((lo + hi) / 2, 1).s; };
  // the end's corner's lowest lateral over the stroke: SL_C + s·sin θ + l·cos θ
  const lowest = (yb) => {
    const w = sideAt(-yb);
    let m = Infinity;
    for (let i = 0; i <= 64; i++) {
      const th = -SL_TILT + (2 * SL_TILT * i) / 64;
      for (const s of [-w, w]) m = Math.min(m, SL_C + s * Math.sin(th) - yb * Math.cos(th));
    }
    return m;
  };
  let lo = 0.5 * SL_BEAK, hi = 0.85 * SL_BEAK;
  for (let k = 0; k < 60; k++) { const m = (lo + hi) / 2; if (lowest(m) >= latMin) lo = m; else hi = m; }
  const beakEnd = lo, wEnd = sideAt(-beakEnd);
  // the body: tail edge, the −s side down, the end, the +s side up (CCW in s,l)
  const N = 48, body = [];
  const tEnd = (() => { let a = 0, b = 1; for (let k = 0; k < 60; k++) { const m = (a + b) / 2; if (quad(m, 1).l > -beakEnd) a = m; else b = m; } return (a + b) / 2; })();
  for (let i = 0; i <= N; i++) body.push(quad((tEnd * i) / N, -1));         // −s side, tail → end
  for (let i = N; i >= 0; i--) body.push(quad((tEnd * i) / N, 1));          // +s side, end → tail
  // (the tail edge closes from (hw, SL_TAIL) back to (−hw, SL_TAIL))
  // the flank bite
  const P0 = toLever(ykTailPinAt(YOKE_A_SEAT), slLeverTiltAt(0)), P1 = toLever(ykTailPinAt(YOKE_A_FULL), slLeverTiltAt(1));
  const dl = Math.hypot(P1.s - P0.s, P1.l - P0.l), ex = { s: (P1.s - P0.s) / dl, l: (P1.l - P0.l) / dl };
  const sh = CLEAR_MARGIN - SEAT_RELIEF;
  const nF = { s: SL_FLANK.nx, l: SL_FLANK.ny };
  const A = { s: P0.s - ex.s * CLEAR_MARGIN + nF.s * sh, l: P0.l - ex.l * CLEAR_MARGIN + nF.l * sh };
  const B = { s: P1.s + ex.s * CLEAR_MARGIN + nF.s * sh, l: P1.l + ex.l * CLEAR_MARGIN + nF.l * sh };
  const biteR = YK_TAIL_PIN_R + CLEAR_MARGIN + bev + MEASURED_MARGIN_BAND;
  // …run out through the plate's edge along the flank's normal, so the bite is
  // an open notch and not a slot: a slot would leave a sliver of plate on the
  // pin's far side, under §50's floor where it tapers out (the convex hull of
  // the stadium and its translate is still convex, which is what the bite needs)
  const run = 4 * hw;
  const st = stadium(A, B, biteR);
  const bite = hull2([...st, ...st.map((q) => ({ s: q.s + nF.s * run, l: q.l + nF.l * run }))]);
  const cut = biteConvex(body, bite);
  // the boss under the plate (the pivot's screw seat) stands the margin off the
  // pin's sweep: its radius is the sweep's nearest approach to the pivot less
  // the pin and the margin — and no more than the §13 boss (1.5·SL_HW)
  const segNear = (() => {
    const vx = P1.s - P0.s, vy = P1.l - P0.l, L2 = vx * vx + vy * vy;
    const u = Math.max(0, Math.min(1, -(P0.s * vx + P0.l * vy) / L2));
    return Math.hypot(P0.s + u * vx, P0.l + u * vy);
  })();
  const bossR = Math.min(1.5 * hw, segNear - YK_TAIL_PIN_R - CLEAR_MARGIN - MEASURED_MARGIN_BAND);
  // the lug: from one plate-width inside the body's end to the pin's centre
  const lugHalf = SL_BEAK_PIN_R + STOCK_MIN_U;
  const lug = stadium({ s: 0, l: -(beakEnd - hw) }, { s: 0, l: -SL_BEAK }, lugHalf, 16);
  return Object.freeze({ body: cut, bodyUncut: body, bite, lug, beakEnd, wEnd, latMin, bossR, lugHalf,
    flankFrom: P0, flankTo: P1, flankNormal: nF });
})();

// ---------------------------------------------------------------------------
// solveKeyless (§13 step 3b) — the P-dependent XY FRAME as a pure function:
// the stem line (uWind/vPerp/sideSign), the keyless cluster's distances
// along it, the setting-lever/yoke pivots with their pull-driven angle
// functions, the plate radius, and the dial-side locals that radius fixes
// (dialRadius, sub-dial positions, the shared sub-dial well radius).
// Same contract as solveLayout: everything measured arrives as an argument
// (outline — each part's own outline radius, with the drum's REAL radius
// under 'barrel'), pitch radii are closed-form from the module/teeth
// constants above, and every expression is ported VERBATIM so the geometry
// fingerprint is bit-identical. main.js destructures the result under the
// same names the in-line block used to declare, so downstream consumers —
// plate openings, keyless assembly, dial build — are unchanged.
// ---------------------------------------------------------------------------
export function solveKeyless({
  P,              // solveLayout's position table (shifted, centre-arbor origin)
  outline,        // { barrel, center, third, fourth, escape, balance, fork, dial } — outline radii for the plate bound
  stemAzRad = null, // §33 step 2 — decoupled stem azimuth; null = derive from the barrel (§13, bit-exact)
  rsvR = null,      // §94 tier C — the reserve station's radius; null = mirror the seconds station (§125 — symmetric by construction)
  alarmR = null,    // §98 — the alarm corner's radius; null = ALARM_CORNER_R (§125 step 1 — the §74-proven station, pinned)
  subDialRadius = null, // §97/§125 Tier B — the SECONDS well's radius (the wells split; the reserve's is its station's derivation); null = the derived ceiling, bit-exact
  dialR = null,     // §125 step 3 — the dial's radius; null = the movement's own diameter (dialRadius = plateR)
  printFrame = null, // §125 margins tweak — the printed furniture's world fractions { markerInnerF, railInnerF }, measured by the caller from geometry.js's print constants; null = no furniture bound (the wells run to their centre-bore ceilings)
  warn = () => {},
}) {
  const barrelDist = Math.hypot(P.barrel.x, P.barrel.y) || 1;
  const uWind = stemAzRad === null
    ? { x: P.barrel.x / barrelDist, y: P.barrel.y / barrelDist }
    : { x: Math.cos(stemAzRad), y: Math.sin(stemAzRad) };
  const stemAngle = Math.atan2(uWind.y, uWind.x);
  // Which side of the stem line the balance (and hence the setting lever)
  // lives on. NOTE: with the tornado layout the balance sits
  // almost exactly ON the stem line's far extension (perpendicular distance
  // ≈ 1 unit), so this sign holds by a thin margin — nudging the balance step
  // TARGET, the solved clearances feeding BALANCE_STEP_DEG, or the barrel
  // angle can silently mirror the whole lever/yoke/hack-spring assembly.
  // Warned here (the clearance solve now MOVES the balance, so a silent
  // flip is a live failure mode, not a hypothetical): |projection| ≈ 0.79
  // after the solve, vs ≈ 0.97 at the raw target.
  const vPerp = { x: -uWind.y, y: uWind.x };
  const sideProj = P.balance.x * vPerp.x + P.balance.y * vPerp.y;
  const sideSign = Math.sign(sideProj) || 1;
  if (Math.abs(sideProj) < 0.5) {
    warn(`keyless side sign nearly degenerate (balance ${sideProj.toFixed(2)} off the stem line) — lever/yoke/hack layout may mirror`);
  }
  const barrelR = (TRAIN.barrel.module * TRAIN.barrel.teeth) / 2; // DESIGN radius — closed-form, same expression main.js derives
  const ratchetR = barrelR * 0.34;                       // matches makeBarrel's ratR
  const crownWheelR = (KW_MODULE * crownWheelTeeth) / 2;
  const windPinionR = (KW_MODULE * windPinionTeeth) / 2;
  const settingWheelR = (KW_MODULE * settingWheelTeeth) / 2;
  const minuteWheelR = (KW_MODULE * minuteWheelTeeth) / 2;
  // The transfer wheel drives a plain 24-tooth WINDING SPUR on the fusee
  // arbor. (The saw-toothed ratchet the spur replaced is GONE, not moved:
  // a fixed pawl on this bidirectional arbor was a display fiction — see
  // main.js's windTop block. TODO 50 files where the real one-way lives.)
  // The spur keeps the replaced ratchet's tooth count, so the crown→fusee
  // ratio is unchanged; equal module makes the mesh honest — the old
  // layout gear-meshed saw teeth at an effective module of 0.408 against
  // KW_MODULE.
  const windSpurR = (KW_MODULE * WIND_SPUR_TEETH) / 2;
  // Winding transfer arbor axis. IDENTITY: one spur-mesh distance outboard
  // of the barrel along the (barrel-derived) stem — the §13 expression.
  //
  // TODO 125 — THE `+ 0.1` THAT USED TO SIT ON EVERY KEYLESS MESH DISTANCE IS
  // GONE, and the justification it carried ("the same +0.1 slop every keyless
  // mesh uses, see mwFoldD") was circular: mwFoldD carried it for the same
  // reason. Nothing derived it. Two measurements decided it rather than taste.
  // It is not a backlash allowance: KW_MODULE is 0.34, so 0.1 is 0.29 of a
  // MODULE, and the centre-distance increase that buys even a generous
  // horological backlash is under 0.1·m — this was three times over. And it is
  // not a convention of this movement: 21 of the 23 declared meshes stand at
  // module·(P+Q)/2 exactly, and the only two that did not were the two these
  // expressions site. What it WAS is visible at ALARM_TUBE_INNER above — 0.1
  // is this file's running clearance for a tube in its bearing, carried across
  // to a centre distance, where a running fit is not the same quantity.
  // Every keyless mesh now stands where its teeth were cut for.
  //
  // §33 step 2 — with the stem DECOUPLED the crown wheel stays on the stem
  // ray but the barrel no longer lies on it, and the reach solves in two
  // regimes. DIRECT (the ray passes within one mesh distance of the
  // barrel, |Δaz| ≲ 21° at the shipped radii): slide the mesh point along
  // the ray — cwDist = along + sqrt(R0² − c²), the outboard intersection
  // of the ray with the mesh circle, exactly what the identity expression
  // degenerates to at c = 0. IDLER (beyond direct reach): the crown wheel
  // parks at the ray's nearest point to the barrel and an 18-tooth idler
  // bridges by two-circle intersection — the alarm winding train's own
  // pattern, and idler counts drop out of the ratio there as here. The
  // idler's 18 teeth are sized so the §13 motivating example ("drag the
  // crown to 3 o'clock", Δaz ≈ 35°) closes with margin: span = crownWheelR
  // + 2·idlerR + windSpurR + 0.2 ≈ 13.9 covers Δaz ≤ asin(13.9/21.3) ≈
  // 40°. Beyond THAT the solve refuses with the numbers — a warn here,
  // the amber verdict at boot, the battery as always.
  const windIdlerR = (KW_MODULE * KW_WIND_IDLER_TEETH) / 2;
  let cwDist, windIdler = null;
  if (stemAzRad === null) {
    cwDist = barrelDist + windSpurR + crownWheelR;
  } else {
    const along = uWind.x * P.barrel.x + uWind.y * P.barrel.y;
    const c = Math.abs(uWind.x * P.barrel.y - uWind.y * P.barrel.x);
    const R0 = windSpurR + crownWheelR;
    if (c <= R0 - 0.5 && along > 0) {
      // DIRECT: oblique mesh, outboard branch (the identity's topology).
      cwDist = along + Math.sqrt(R0 * R0 - c * c);
    } else if (along > 0) {
      // IDLER: crown wheel at the ray's nearest point to the barrel.
      cwDist = along;
      const cwPos = { x: uWind.x * cwDist, y: uWind.y * cwDist };
      const rA = crownWheelR + windIdlerR;         // crown wheel ⇄ idler
      const rB = windSpurR + windIdlerR;           // idler ⇄ fusee spur
      const dx = P.barrel.x - cwPos.x, dy = P.barrel.y - cwPos.y;
      const d = Math.hypot(dx, dy);
      if (d > rA + rB) {
        warn(`stem azimuth: the winding idler cannot span crown wheel to fusee spur (${d.toFixed(1)} apart, reach ${(rA + rB).toFixed(1)}) — bring the stem within ~40° of the barrel`);
        cwDist = barrelDist + windSpurR + crownWheelR; // stand the cluster up anyway; the verdicts carry the refusal
      } else {
        const a = (rA * rA - rB * rB + d * d) / (2 * d);
        const h = Math.sqrt(Math.max(0, rA * rA - a * a));
        const mx = cwPos.x + (a * dx) / d, my = cwPos.y + (a * dy) / d;
        // Two intersections; take the INBOARD one (smaller radius from the
        // centre) so the idler stays inside the plate's enclosure — the
        // trial boot and battery judge the arrangement either way.
        const cand1 = { x: mx - (h * dy) / d, y: my + (h * dx) / d };
        const cand2 = { x: mx + (h * dy) / d, y: my - (h * dx) / d };
        const pick = Math.hypot(cand1.x, cand1.y) <= Math.hypot(cand2.x, cand2.y) ? cand1 : cand2;
        windIdler = { x: pick.x, y: pick.y, r: windIdlerR, teeth: KW_WIND_IDLER_TEETH };
      }
    } else {
      warn('stem azimuth: the stem ray points away from the barrel entirely — the winding path cannot exist');
      cwDist = barrelDist + windSpurR + crownWheelR;
    }
  }
  // TODO 136 — THE STATION IS THE APEX CONDITION, not a rim overlap. The crown
  // wheel's axis (vertical, at cwDist) and the stem cross, so the pair is a
  // Σ = 90° bevel and both cones stand on that crossing point. A member's pitch
  // plane is then coneR·cos γ from the apex along its own axis, and at Σ = 90°
  // that is exactly the MATE's pitch radius — so the winding pinion's plane
  // stands crownWheelR outboard of the crown wheel's axis, and the crown wheel's
  // plane stands windPinionR off the stem (main.js mounts it there).
  //
  // The `+ windPinionR * 0.55` this replaces was the fiction TODO 136 exists to
  // close: two SPUR discs on crossed axes, parked with their rims overlapping by
  // 55% of the pinion's radius because that looked like a mesh. Measured, the
  // two rims were buried 0.2065 deep in each other and no indexing cleared them.
  //
  // …and the pinion's own reference plane is its COUPLING FACE, one boss beyond
  // the cone's big end (KW_BEVEL.pinFaceOut): the whole clutch stack measures
  // from the plane the saw ring seats on, which is what lets STEM_CLUTCH_OFF
  // stay pure sink-plus-base-plus-tooth arithmetic.
  const pinDist = cwDist + KW_BEVEL.pinFaceOut + WIND_PINION_BOSS;
  const pinOutDist = pinDist + CROWN_PULL_DIST;              // the stem's own outward travel
  // TODO 50 — the SLIDING CLUTCH is what meshes the setting wheel now. Its
  // home sits STEM_CLUTCH_OFF outboard of the pinion (the coupling's stack:
  // half pinion, two ring bases, the seated tooth interleave, half rim) and
  // its throw is CLUTCH_TRAVEL, derived so the pulled clutch lands on the
  // OLD setting station — swDist is untouched by the split (see the
  // constant's comment for the refused alternative).
  const clutchHomeDist = pinDist + STEM_CLUTCH_OFF;
  // The setting corner is the same condition on the other pair: the pulled
  // clutch's pitch plane stands the setting wheel's pitch radius inboard of the
  // apex, which sits on the setting wheel's own axis. (The second
  // `windPinionR * 0.55` — the setting rim carries the winding pinion's count,
  // so the fudge was written with the pinion's radius on both corners.)
  const swDist = clutchHomeDist + CLUTCH_TRAVEL + KW_BEVEL.rimFaceOut;
  // The minute wheel FOLDS perpendicularly off the stem line (see the
  // setting-path assembly for why).
  const mwFoldD = settingWheelR + minuteWheelR;
  const minuteArborXY = {
    x: uWind.x * swDist - sideSign * vPerp.x * mwFoldD,
    y: uWind.y * swDist - sideSign * vPerp.y * mwFoldD,
  };
  // Setting lever & yoke pivots + the pull-driven angle solves. Solved with
  // the layout: the lever's tail-post ARC is what the plate's slot is cut
  // from, and every hack/reset solver downstream keys off tailPostWorldAt.
  const slMidAlong = pinDist + CROWN_PULL_DIST / 2 + GROOVE_LOCAL;
  const settingLeverPivot = {
    x: uWind.x * slMidAlong + sideSign * vPerp.x * SL_C,
    y: uWind.y * slMidAlong + sideSign * vPerp.y * SL_C,
  };
  // TODO 214 — the lever's angle is the CONTACT's: its beak pin bearing on
  // collar In's face (slLeverTiltAt, solved on the cut in the canonical frame).
  // The canonical tilt is CCW where sideSign = +1 and mirrored where −1, so the
  // world angle is the mid-stroke heading (the beak square to the stem) plus
  // sideSign·tilt. At both stroke ends it is the §13 law's angle exactly, so
  // postRel/postEng below are unmoved (main.js asserts the two against the old
  // expression).
  const aMidLever = Math.atan2(-sideSign * vPerp.y, -sideSign * vPerp.x) - Math.PI / 2;
  function settingLeverAngleAt(pull) {
    return aMidLever + sideSign * slLeverTiltAt(pull);
  }
  // The canonical frame's points in the world's XY (s from the lever pivot's
  // station along the stem, l toward the lever side).
  const canonToWorld = (p) => ({
    x: uWind.x * (slMidAlong + p.s) + sideSign * vPerp.x * p.l,
    y: uWind.y * (slMidAlong + p.s) + sideSign * vPerp.y * p.l,
  });
  function tailPostWorldAt(pull) {
    const a = settingLeverAngleAt(pull);
    return {
      x: settingLeverPivot.x + Math.sin(a) * SL_TAIL,
      y: settingLeverPivot.y - Math.cos(a) * SL_TAIL,
    };
  }
  const postEng = tailPostWorldAt(1);
  const postRel = tailPostWorldAt(0);
  // The post swings on the lever's tail, so its track between the two crown
  // poses is an ARC, not the chord — both plates' slots need the bow.
  const kwPostBow = (() => {
    const chord = { x: postEng.x - postRel.x, y: postEng.y - postRel.y };
    const L = Math.hypot(chord.x, chord.y) || 1;
    let bow = 0;
    for (let i = 0; i <= 40; i++) {
      const p = tailPostWorldAt(i / 40);
      const t = ((p.x - postRel.x) * chord.x + (p.y - postRel.y) * chord.y) / (L * L);
      bow = Math.max(bow, Math.hypot(p.x - postRel.x - t * chord.x, p.y - postRel.y - t * chord.y));
    }
    return bow;
  })();
  // The yoke's fork tracks the CLUTCH's hub collars (TODO 50 moved them off
  // the stem group and onto the clutch, which is the member that actually
  // slides against the spring), so its pivot centres on the clutch's stroke
  // and its angle reads the prong's along-stem station about that mid —
  // `yokeClutchAt` (TODO 211) solves the station from the prong's contact with
  // the cut collar faces, and since TODO 214 the station the LEVER asks for
  // from the tail pin's contact with its flank. TODO 214 moved the pivot to the
  // lever's side of the stem (+sideSign), off the minute wheel.
  const yokeMidAlong = clutchHomeDist + CLUTCH_TRAVEL / 2 + YOKE_TRACK_OFF;
  const yokePivot = {
    x: uWind.x * yokeMidAlong + sideSign * vPerp.x * YK_C,
    y: uWind.y * yokeMidAlong + sideSign * vPerp.y * YK_C,
  };
  function yokeAngleAt(a) {
    // The arm is SHORTER than the pivot's offset to the stem line by
    // design (YOKE_ARM's constraint: the prongs are posts that must never
    // stand ON the line). `a` is the prong centre's along-stem station from
    // the yoke's mid — the law's OUTPUT (`yokeClutchAt`) — and the prong's
    // perpendicular height follows as YK_C − √(arm² − a²), toward the stem.
    const drop = Math.sqrt(Math.max(0, YOKE_ARM * YOKE_ARM - a * a));
    const tx = yokePivot.x + uWind.x * a - sideSign * vPerp.x * drop;
    const ty = yokePivot.y + uWind.y * a - sideSign * vPerp.y * drop;
    return Math.atan2(ty - yokePivot.y, tx - yokePivot.x) - Math.PI / 2;
  }

  // Plate radius: tightest circle (plus a rim margin) that contains each part's
  // own outline — arbor distance plus that part's radius, not a blanket maximum.
  let plateR = 20;
  for (const key in P) {
    plateR = Math.max(plateR, Math.hypot(P[key].x, P[key].y) + (outline[key] || 0));
  }
  plateR += 5;
  // Keyless floor: the plate must reach 1 unit past the setting wheel and
  // past the folded minute wheel (with the compact tornado train, this floor
  // — not the train extent — is what sizes the plate).
  plateR = Math.max(
    plateR,
    swDist + settingWheelR + 1,
    Math.hypot(swDist, mwFoldD) + minuteWheelR + 1,
    // …and past the STEM BUSHING's foot, which TODO 136 made the outermost
    // member: the bushing is pushed out by the stem's groove at full pull
    // (main.js's bushDist, second branch) and its far face stands one foot-half
    // beyond that. Main asserts the foot stands ON the plate; before this term
    // it stood exactly on the rim.
    pinDist + CROWN_PULL_DIST + GROOVE_OUTER
      + CLEAR_MARGIN + STEM_BUSH_FOOT_HALF + STEM_BUSH_FOOT_HALF,
  );

  // --- Dial-side locals the plate radius fixes (moved from the dial build,
  // §13 step 3b — one source; ALARM_CD's plate-bore hoist reads these too) ---
  //
  // §125 step 2 — THE DIAL IS MADE TO THE MOVEMENT'S DIAMETER. The 0.92 that
  // sat here was the one line in this block with no constraint beside it
  // (§86's class — 1.301 mm of bare plate all round that nothing claimed).
  // The derivation is the horological convention itself: a dial is made to
  // the movement's diameter and seats on its full plate face; the CASE, not
  // the plate's rim, covers the join (§3 owns the case, and this radius
  // deliberately never goes proud of the plate so it does not wait on one).
  // The ceilings §125 measured, recorded here so nobody re-sweeps for them:
  //   42.25   the ask's own — 2·subDialR + SUBDIAL_INBOARD_CLEAR at the
  //           largest station the movement holds still for (22.90; the
  //           plate is flat through it and grows at 22.95)
  //   42.9229 THIS — plateR; covers stations to 23.24, past anything the
  //           train will hold still for, so the face stops being the bound
  //   43.55   2·d4max − SUBDIAL_INBOARD_CLEAR, the two-bar closure — needs
  //           the plate to grow first, and stands 0.24 mm proud: a case
  //           question, refused here by construction
  //   44.273  the metal — the alarm crown at 44.423, at CLEAR_MARGIN
  //           (measured; the §125 boot assert in main.js keeps it honest)
  // §125 step 3 — and the radius is a SPEC DIMENSION (?dialr=): every number
  // §125 measured on a grown face had to come off a patched tree, because
  // the one dimension the ask was about was the one no URL could carry.
  // Bounds warned below, after the wells exist; null = plateR, bit-exact.
  const dialRadius = dialR !== null ? dialR : plateR;
  // Small seconds live ON the fourth wheel's axis — dial-local coordinates
  // mirror world x through the dialFace Y-flip. (Declared before the reserve
  // station since §125, which anchors the reserve TO it.)
  const SECONDS_LOCAL = { x: -(P.fourth.x - P.dial.x), y: P.fourth.y - P.dial.y };
  // Sub-dial positions in dial-local coordinates (+y = 12 o'clock; the
  // dialFace Y-flip makes these read correctly from the front). The station
  // sits at 12, much closer to the barrel's dial-side projection than the
  // old 6-o'clock spot, so the reserve reduction train spans a short run.
  // §94 tier C — the station is a SPEC DIMENSION: a spec'd radius replaces
  // the derived default outright, and identity stays bit-exact because
  // identity passes nothing (d4's null rule, one solver down).
  // §125 Tier B — the default is the reserve's OWN design station,
  // RESERVE_STATION_R (see its derivation at the constant). Tier A briefly
  // had it MIRROR the seconds station — the right law while the two wells
  // shared one radius — but Tier B split the wells (the seconds took the
  // whole plate-flat ceiling; the reserve kept its proven-readable size),
  // and a mirror would have dragged the reserve to 22.9 and ballooned its
  // well with it. The literal IS the mirror's landing at the old D4, so
  // nothing on the reserve side moved when the law changed.
  const RESERVE_LOCAL = { x: 0, y: rsvR !== null ? rsvR : RESERVE_STATION_R };
  // §94 tier B — THE ALARM CORNER'S OWN RADIUS. Until this tier it did not
  // exist: main.js defined ALARM_CD as a read of RESERVE_LOCAL.y, which made
  // "the reserve indicator happens to sit there" the radius of the entire
  // alarm module — never the constraint that sizes the ALARM corner. What
  // actually bounds it, each asserted where it lives in main.js:
  //   · CEILING — the setting dogleg's two-circle solve has no intersection
  //     past ≈ 19.9 (the i1 → arbor run outgrows the chain's reach; the
  //     route solve returns null and boot says so);
  //   · the winding chain's climb→barrel span grows ~1:1 with the corner —
  //     the idler now DERIVES from the span (measured before it did: corner
  //     16.0 left i1⇄i2 at 15.408 against a 15.300 pitch sum, a chain that
  //     silently did not mesh), and its plate ceiling is asserted;
  //   · the stem must reach the case rim with positive length
  //     (alarmStemLen = plateR + 2.2 − corner).
  // Default: ALARM_CORNER_R (§125 step 1) — the §74-proven station as its
  // own design dimension, bit-equal to the dialRadius·0.39 the default used
  // to read at the shipped face. The old expression was §98's finding made
  // live twice over: a grown MOVEMENT dragged the setting cluster outward
  // into fixed-radius neighbours (§76 measured every remaining balance wall
  // down to that), and a grown DIAL did the same with the movement untouched
  // (§125 measured −0.57 at f = 1.0, i2 vs the winding climb, against a
  // clean travel of under 0.37). The corner's constraint is the clutch, so
  // its default no longer reads the face; ?alarmr= (§98) still overrides.
  const alarmCornerR = alarmR !== null ? alarmR : ALARM_CORNER_R;
  // The one bound THIS solver owns for a spec'd corner: the stem must
  // reach the case rim with positive length (alarmStemLen = plateR + 2.2
  // − corner in main.js). The interior bounds live with their own
  // instruments — the dogleg's two-circle solve goes route-null past
  // ≈ 19.9 and says so, and the winding chain's idler derives from the
  // span with its plate ceiling asserted — so this warn brackets only
  // what they cannot see.
  if (alarmR !== null && !(alarmR > 0 && alarmR < plateR + 2.2))
    warn(`alarm corner radius ${alarmR.toFixed(2)} is outside (0, ${(plateR + 2.2).toFixed(2)}) — `
      + `past the ceiling the stem has no length inside the case rim; the build proceeds and its own `
      + `asserts judge the interior`);
  // Sub-dial radius — as large as the face allows while staying balanced:
  // one shared radius for both wells (their pivots are fixed on their
  // arbors, so only the radius can grow), capped by the clearance the
  // central hands' boss needs around the dial centre. This lands ≈ 0.30 of
  // the dial radius (up from 0.2); the bigger wells swallow the XI/I and
  // V/VII numerals symmetrically, leaving II–IIII and VIII–X.
  // The INBOARD ceiling — what the wells' rings must clear on their way
  // toward the dial centre. It has moved once, and the move is the point:
  //
  // §25 C set it to −5.2 against the central SETTING WHEEL: the well WALLS
  // descended through the gear lane (z −7.0..−6.5), so the ring had to clear
  // the wheel's tip 4.83 + 0.2 (wall) + 0.15 (margin) ≈ 5.18. (The −4.5
  // before it had the wall passing straight through the wheel's teeth, masked
  // in the sweep by the wheel⇄Dial EXPECTED blanket.)
  //
  // TODO 26 ended that geometry. The dial is a plate and the pockets are
  // machined INSIDE its own thickness, so the rings no longer reach the
  // setting lane at all — `wellsInLane` is false and the §25 C assert is
  // dormant. Its form is kept, not deleted: move the dial's stratum or the
  // setting lane back into contact and it wakes up and binds again.
  //
  // What bounds the wells inboard NOW is the dial's own CENTRE BORE, which
  // carries the co-axial hand stack (cannon → hour tube → §25 C alarm tube):
  // centerBoreR = ALARM_TUBE_OUTER + 0.2 = 3.20, plus the same wall and
  // margin the old form used. Measured before this changed: the pockets
  // overlapped that bore from factor 1.196 and the build said NOTHING — the
  // triangulator quietly dropped the overlap while boot, support, clearances
  // and inspection all stayed green (TODO 33, whose assert now enforces this
  // line rather than leaving it to a comment).
  //
  //   wellR ≤ 15.401 − (3.20 + 0.2 + 0.15) = 11.85
  //
  // §97 — THE RADIUS IS A SPEC DIMENSION, and the finish knob is retired
  // (one quantity, one control; §23's factor was the right description of
  // a finish knob and the wrong tier for a movement dimension — a spec
  // must be reproducible from its URL, and the solver could never be
  // asked about a factor that reached it as a module import). The ceiling
  // is TODO 33's, split out by name; the value is the spec'd radius held
  // between the derived FLOOR and that ceiling, falling back WITH a warn
  // rather than building a well that breaches either bore. Identity is
  // bit-exact by construction: the retired factor was 1.0, and
  // multiplication by 1.0 is exact in IEEE-754.
  // §125 Tier B — THE WELLS SPLIT. §97's one shared radius was the right
  // law while the two stations were one number; Tier B parted them (the
  // seconds at the plate-flat ceiling, the reserve at its proven-readable
  // size), and a shared radius would have forced the min on both — the big
  // well could never exist. The law that survives is the one both wells
  // already obeyed: a well GROWS FROM THE CENTRE — its inner edge sits on
  // the centre keep-out, so per well
  //
  //     wellR_i = station_i − SUBDIAL_INBOARD_CLEAR
  //
  // (TODO 33's ceiling, per station). ?subdialr= (§97) now pins the SECONDS
  // well — the one with room to be asked about — held between SUBDIAL_FLOOR
  // and its own ceiling exactly as before. The reserve well is deliberately
  // NOT a knob: its size IS the reserve station's derivation (the readable
  // well pins the station — see RESERVE_STATION_R), so it follows ?rsvr=
  // and nothing else.
  // §125 margins tweak (owner, 2026-08-20) — A WELL YIELDS THE PRINTED
  // FURNITURE ITS FACE RUNS UNDER: its recess edge (the ring wall) stops
  // one CLEAR_MARGIN short of the furniture's inner radius. Each well
  // declares WHICH furniture binds it, because that is a design decision,
  // not geometry: the RESERVE yields the hour-marker band (the owner's
  // ask — at the ceiling law its ring clipped XI/XII/I), while the SECONDS
  // deliberately keeps the markers' sacrifice (the regulator look Tier B
  // chose) and yields only the RAILROAD — which also opens the visible
  // gap between its ring and the dial centre the owner asked for (inner
  // edge 3.55 → ~11.8, since the well no longer grows from the keep-out).
  // The centre-bore ceiling (TODO 33) remains the hard cap on both.
  const markerInnerR = printFrame ? dialRadius * printFrame.markerInnerF : Infinity;
  const railInnerR = printFrame ? dialRadius * printFrame.railInnerF : Infinity;
  const secondsWellCeil = Math.min(
    -SECONDS_LOCAL.y - SUBDIAL_INBOARD_CLEAR,
    railInnerR - DIAL_WALL_HALF - CLEAR_MARGIN - -SECONDS_LOCAL.y,
  );
  let secondsWellR = subDialRadius !== null ? subDialRadius : secondsWellCeil;
  if (subDialRadius !== null && subDialRadius > secondsWellCeil) {
    warn(`seconds well radius ${subDialRadius.toFixed(2)} is over the derived ceiling ${secondsWellCeil.toFixed(2)} `
      + `(the tighter of the centre-bore keep-out and the railroad's inner rail less the ring wall and margin) — `
      + `keeping the ceiling; a larger well breaches a bore or buries the track`);
    secondsWellR = secondsWellCeil;
  }
  if (subDialRadius !== null && subDialRadius < SUBDIAL_FLOOR) {
    warn(`seconds well radius ${subDialRadius.toFixed(2)} is under the derived floor ${SUBDIAL_FLOOR.toFixed(2)} `
      + `(the pocket's own bore + wall + margin) — keeping the floor; a smaller well cannot carry `
      + `its centre bore's wall`);
    secondsWellR = SUBDIAL_FLOOR;
  }
  const reserveWellR = Math.min(
    RESERVE_LOCAL.y - SUBDIAL_INBOARD_CLEAR,
    markerInnerR - DIAL_WALL_HALF - CLEAR_MARGIN - RESERVE_LOCAL.y,
  );
  // §94 tier A — THE WELLS MUST HAVE A RADIUS AT ALL, which nothing checked
  // while both stations were literals comfortably outside the ceiling. Make
  // a station a spec key and the inboard end of its range walks it straight
  // through SUBDIAL_INBOARD_CLEAR: at d4 2 the seconds ceiling comes out at
  // −1.55 and the dial built a well with a NEGATIVE radius in silence. The
  // centre-bore assert next door cannot see it — it measures the ring's
  // inner edge, which a negative radius pushes back OUTSIDE the bore, so a
  // nonsense well reads as a compliant one. (A spec'd radius under a
  // NEGATIVE ceiling still falls back to the ceiling above — the station
  // question outranks the radius question, and these warns name it, one per
  // well now that each station is its own question.)
  if (secondsWellR <= 0)
    warn(`the seconds well has no radius: ${secondsWellR.toFixed(2)} — its station sits `
      + `${(-SECONDS_LOCAL.y).toFixed(2)} from the dial centre, inside the `
      + `${SUBDIAL_INBOARD_CLEAR.toFixed(2)} the centre bore, its wall and the margin need`);
  if (reserveWellR <= 0)
    warn(`the reserve well has no radius: ${reserveWellR.toFixed(2)} — its station sits `
      + `${RESERVE_LOCAL.y.toFixed(2)} from the dial centre, inside the `
      + `${SUBDIAL_INBOARD_CLEAR.toFixed(2)} the centre bore, its wall and the margin need`);

  // §125 step 3 — the spec'd dial's own bounds, findings 3 and 4. INBOARD:
  // the wells' outer edge — shrink the face inside it and a well's ring runs
  // off the dial it is cut into. OUTBOARD: the measured metal — the alarm
  // crown's nearest vertex at 44.423 (§125, shipped tree), at CLEAR_MARGIN;
  // a parse-time bracket only, since the crown is not this solver's to
  // measure — the §125 boot assert in main.js reads the actual rim against
  // the actual metal and is the live guard. Warn, never clamp (d4's rule):
  // the build proceeds and the battery judges it.
  if (dialR !== null) {
    const wellsEdge = Math.max(RESERVE_LOCAL.y + reserveWellR, -SECONDS_LOCAL.y + secondsWellR);
    const metalCeiling = 44.423 - CLEAR_MARGIN;
    if (!(dialR >= wellsEdge && dialR <= metalCeiling))
      warn(`dial radius ${dialR.toFixed(2)} is outside [${wellsEdge.toFixed(2)}, ${metalCeiling.toFixed(2)}] — `
        + `inside the wells' outer edge their rings run off the face; past the ceiling the rim reaches `
        + `the alarm crown's measured metal. The build proceeds; the boot assert and battery judge it`);
  }

  // §94 tier C — THE RESERVE STATION'S WINDOW, derived where the radii are
  // (d4Window's precedent). INBOARD: the well must have a radius at all —
  // the station against SUBDIAL_INBOARD_CLEAR (the warn above is the
  // backstop; TODO 33's centre-bore assert fires per-station in main.js).
  // OUTBOARD: the well's outer edge against the dial face. §125 Tier B
  // collapsed what used to be a two-branch bound: the reserve well now
  // follows ITS OWN station (well = station − clear, never the seconds
  // min and never §97's key), so the edge is 2·station − clear and the
  // bound is one closed form,
  //
  //     station ≤ (dialRadius + SUBDIAL_INBOARD_CLEAR) / 2
  //
  // Deliberately NOT here: the ≈19.9 dogleg ceiling, which has been the
  // ALARM corner's own dimension since §94 tier B. The reduction train
  // adds its own inward floor — the span-solved module goes below tooth
  // stock long before the well degenerates — asserted beside rsvModule1
  // in main.js; the reconfigure handle composes both.
  // §125 margins tweak — the outer bound tightens with the furniture: past
  // (markerInner − wall − margin − FLOOR) the marker-bounded well is under
  // its own floor; the face bound stays for the no-furniture callers.
  const rsvrWindow = {
    min: SUBDIAL_INBOARD_CLEAR,
    max: Math.min((dialRadius + SUBDIAL_INBOARD_CLEAR) / 2,
      markerInnerR - DIAL_WALL_HALF - CLEAR_MARGIN - SUBDIAL_FLOOR),
  };
  if (rsvR !== null && !(rsvR > rsvrWindow.min && rsvR <= rsvrWindow.max))
    warn(`reserve station ${rsvR.toFixed(2)} is outside its window (${rsvrWindow.min.toFixed(2)}, `
      + `${rsvrWindow.max.toFixed(2)}] — at or inside the bore keep-out the well has no radius; past the `
      + `ceiling its ring runs off the ${dialRadius.toFixed(2)} face. The build proceeds; the battery judges it`);

  return {
    barrelDist, uWind, stemAngle, vPerp, sideSign,
    ratchetR, crownWheelR, windPinionR, settingWheelR, minuteWheelR, windSpurR,
    cwDist, pinDist, pinOutDist, clutchHomeDist, swDist, mwFoldD, minuteArborXY, windIdler,
    settingLeverPivot, settingLeverAngleAt, tailPostWorldAt, postEng, postRel,
    kwPostBow, yokePivot, yokeAngleAt, slMidAlong, canonToWorld,
    plateR, dialRadius, RESERVE_LOCAL, SECONDS_LOCAL, reserveWellR, secondsWellR, secondsWellCeil, alarmCornerR, rsvrWindow,
  };
}

// ---------------------------------------------------------------------------
// STOP WORK (hacking) — the SOLVE, pure (§85 step A).
//
// Everything from the bearing scan to the hack rod's elbow used to be
// module-scope IIFEs in main.js reading module-scope constants, so nothing
// outside the build could ask the one question reconfigure mode needs to
// ask: where would this linkage STAND if the balance were somewhere else?
// It is the solveLayout / solveKeyless pattern, for the same reason — the
// same measured inputs with a candidate layout ARE the check, and there is
// no second model to rot.
//
// main.js's job here is again the MEASUREMENT: the balance's swept radius,
// the plate cut, the obstacle circles the bearing scan avoids and the low
// corridor's own table are all read from the BUILT movement and passed in
// as declared inputs. Warnings are COLLECTED, not printed — boot prints
// them (rule 6), a shadow solve reads them.
// ---------------------------------------------------------------------------
function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

// Shared by both low-plane rods: the reset rod builds its own elbow with
// these against the same corridor table.
export function segCircleClear(p, q, c) {
  const vx = q.x - p.x, vy = q.y - p.y;
  const L2 = vx * vx + vy * vy || 1e-9;
  const t = clamp(((c.x - p.x) * vx + (c.y - p.y) * vy) / L2, 0, 1);
  return Math.hypot(c.x - p.x - t * vx, c.y - p.y - t * vy) - c.r;
}
// The obstacle table is a PARAMETER now rather than a closed-over constant:
// the solver has to be able to score a candidate route against a corridor
// its caller measured.
// The z at which a segment ENTERS a circle it fouls, and the z at which it
// leaves — the rod climbs along its run, so an obstacle standing above the
// corridor only counts where the rod is actually high enough to meet it.
// Returns the highest z the segment reaches INSIDE the circle, or null when
// it never enters. (z is linear along the segment, so the extreme is at one
// end of the inside interval; no sampling.)
function maxZInside(p, q, zp, zq, c) {
  const vx = q.x - p.x, vy = q.y - p.y;
  const fx = p.x - c.x, fy = p.y - c.y;
  const A = vx * vx + vy * vy;
  if (A < 1e-12) return Math.hypot(fx, fy) <= c.r ? Math.max(zp, zq) : null;
  const B = 2 * (fx * vx + fy * vy);
  const C = fx * fx + fy * fy - c.r * c.r;
  const disc = B * B - 4 * A * C;
  if (disc < 0) return null;                       // the line misses the circle
  const s = Math.sqrt(disc);
  const t0 = Math.max(0, (-B - s) / (2 * A));
  const t1 = Math.min(1, (-B + s) / (2 * A));
  if (t0 > t1) return null;                        // the crossing is off the segment
  return Math.max(zp + (zq - zp) * t0, zp + (zq - zp) * t1);
}
// `at` is the obstacle that BOUND the chosen route — the one a fouled run has
// to name. Tracking it changes no arithmetic: Math.min over the same two
// distances, just kept alongside the row that produced it.
//
// §85 step C1 — an obstacle row may declare `zAbove`, the height its body
// begins at. The low corridor's whole design is that the rod passes UNDER the
// great wheel (ROD2_PLANE_Z is derived as GW_UNDER_Z − CLEAR_MARGIN − ROD_R),
// and a flat 2D circle cannot express "under": give the fusee station the
// wheel's real radius unconditionally and the shipped route is forbidden;
// leave the row out, as it was, and the wheel is invisible to the check that
// exists to keep the rod clear of it. The rod does not stay in its plane —
// its far end HANGS from a raised pivot and climbs as the crank swings — so
// the test is per-segment and per-pose: a banded row bites only where the rod
// rises into its body.
export function solveElbow(len, posesAB, obstacles, halfZ = 0, { fStep = 0.05, eStep = 0.2, eMax = 6, plateLimit = Infinity } = {}) {
  // `halfZ` is the link's half-extent in z — the height a banded row (one
  // with `zAbove`) is met at. §234: for the round rod it was the knuckle
  // radius; a flat link's plan half-width rides in the obstacle rows instead
  // (lowRodObstaclesFor takes it), so the two extents are no longer one number.
  // §85 step C3 — WHAT THE SEARCH IS FOR. This scan used to maximise
  // worst-case clearance, and a maximiser with no cost for bending bends as
  // far as it is allowed: the shipped rod sat at f 0.25, e −6.0 — BOTH box
  // corners — holding 13.54 of clearance against a margin that asks for 0.15.
  // That is a dimension set by the search bounds rather than by a constraint,
  // §35's defect in miniature, and widening the box only moved it to the new
  // corner (e −16.0, a dogleg on a 58.7 rod).
  //
  // A rod is straight unless something makes it bend. So the objective is the
  // LEAST bend that clears the corridor by the margin the obstacle radii
  // already carry, and the bound may then be generous without buying absurd
  // geometry — extra range is only ever spent when a smaller bend cannot
  // thread. If nothing clears, the most-clearance route is still returned so
  // the caller can report how badly (C1's named warning, C2's scan).
  let best = null;                                   // least-bent route that clears
  let fallback = { clear: -Infinity, f: 0.5, e: 0, at: null };
  // A COARSE probe is a strict SUBSET of the fine grid (0.25 + k·0.25 and
  // ±k·1 both land on fine gridpoints), so a route the probe can find the
  // fine solve can only match or beat — which is what lets §85 C2 use it as
  // a feasibility test without lying to the scan.
  for (let f = 0.25; f <= 0.751; f += fStep) {
    for (let e = -eMax; e <= eMax + 0.01; e += eStep) {
      let worst = Infinity, worstAt = null;
      for (const { a, b, za = 0, zb = 0 } of posesAB) {
        const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy);
        // Lateral unit = the chord's RIGHT-perp — the direction the mesh's
        // local +X maps to under the placement rotation (atan2 − π/2).
        const ux = dx / L, uy = dy / L, nx = uy, ny = -ux;
        const E = { x: a.x + ux * L * f + nx * e, y: a.y + uy * L * f + ny * e };
        // The bend is a real knuckle on a real plate: it has to BE somewhere.
        // With C3's least-bend objective the search bound no longer sets the
        // geometry, so the bound may be generous and this is what actually
        // limits it — the physical constraint instead of the magic number.
        if (Math.hypot(E.x, E.y) > plateLimit) { worst = -Infinity; break; }
        const zE = za + (zb - za) * f;   // z runs with the bend, not around it
        for (const o of obstacles) {
          let d;
          if (o.zAbove === undefined) {
            d = Math.min(segCircleClear(a, E, o), segCircleClear(E, b, o));
          } else {
            // Each half is judged on its own height: the post half runs low
            // and under the wheel, the crank half is the one that climbs.
            const z1 = maxZInside(a, E, za, zE, o), z2 = maxZInside(E, b, zE, zb, o);
            const d1 = z1 !== null && z1 + halfZ >= o.zAbove ? segCircleClear(a, E, o) : Infinity;
            const d2 = z2 !== null && z2 + halfZ >= o.zAbove ? segCircleClear(E, b, o) : Infinity;
            d = Math.min(d1, d2);
          }
          if (d < worst) { worst = d; worstAt = o; }
        }
      }
      if (worst >= 0) {
        const bend = Math.abs(e);
        // Least bend; among equally bent routes, the one with more air.
        if (!best || bend < best.bend - 1e-9 || (bend <= best.bend + 1e-9 && worst > best.clear)) {
          best = { clear: worst, f, e, at: worstAt, bend };
        }
      }
      if (worst > fallback.clear) fallback = { clear: worst, f, e, at: worstAt };
    }
  }
  const chosen = best || fallback;
  // §86 instrument A — did the FENCE decide, or the field? A winner sitting on
  // its own search bound means the scan ran out of room rather than finding an
  // optimum, and the value is the bound wearing an answer's clothes. Reported,
  // never warned: a value legitimately at a limit is common (a floor is a
  // constraint doing its job), so the row is the product and only a row nobody
  // can explain is debt.
  chosen.atBound = [
    Math.abs(Math.abs(chosen.e) - eMax) < eStep / 2 ? `e at ±${eMax}` : null,
    chosen.f <= 0.25 + fStep / 2 ? 'f at its low bound' : null,
    chosen.f >= 0.75 - fStep / 2 ? 'f at its high bound' : null,
  ].filter(Boolean);
  return chosen;
}

// How far the search may LOOK, not how far the rod may bend — C3's objective
// decides that, and the plate decides what is reachable. Generous enough that
// a corridor needing a real detour can be threaded. §125 Tier B raised it
// 16 → 28: the mirrored hack rod's only honest route past the reset hammer's
// measured swing and the fourth arbor's collar is a southern dogleg ~22 of
// lateral deep (measured — at 16 the scan reported "no station about the
// balance can route", best −0.34 at the collar), and C3's least-bend
// objective means the extra range costs nothing anywhere a smaller bend
// threads: the pre-Tier-B build spends 0.8 of it.
//
// §137 Gate A priced what the bound COSTS STRUCTURALLY, so raising it is
// no longer a free geometric move — the arithmetic is at the elbow-rod
// block in main.js (grep `§137 GATE A`). At the loads derived there
// (0.83 mN reset, 0.18 mN hack) a route sitting on this bound bends to
// ≤ 0.6% of its stroke and shortens its calibrated chord by ~2e-5 u, four
// orders inside HAMMER_TAIL_DELTA's tolerances — so the bend is
// defensible at THIS load, not at any load. Re-take that arithmetic
// before raising the bound again, or before either rod is asked to drive
// a detented member.
export const ELBOW_E_MAX = 28;

export function solveStopWork({
  P,                  // solved layout stations (balance, fork, escape, fourth)
  balanceR,           // measured: the balance wheel's own rim radius
  BAL_OUTER_R,        // measured: its swept outer radius (screw heads included)
  postEng, postRel,   // keyless: the setting lever's tail post, engaged / released
  tailPostWorldAt,    // keyless: the post's position across the crown stroke
  plateR,
  TQ_CUT,             // the three-quarter plate's open wedge { aim, phiOpen }
  TQ_TOP_Z,           // the balance cock's height — the mast's case-fit ceiling
  ROD2_PLANE_Z,       // the low rod plane
  linkHalfT,          // §234: the flat link's half-thickness — the height a banded row is met at
  linkHalfW,          // §234: the flat link's body half-width (main.js's LINK_W / 2 — one blank for both links)
  bearingObstaclesAt, // (P) → circles the bearing scan must keep the crank clear of
  obstaclesFor,       // §234: (halfW) → the corridor table the link's elbow is scored against, at that plan half-width
  rubyFlare,          // geometry.js's HACK_RUBY_FLARE
  warn = () => {},
}) {
  const DEG2RAD = Math.PI / 180;
  const corners = [];   // §86 instrument A — values their own search bound chose

  // ---------------------------------------------------------------------------
  // STOP WORK (hacking) — a local stop crank at the balance, driven by a
  // thin LOW hack rod (the corridor under the great wheel — the whole
  // reset/hack linkage lives between the plates now). The crown's motion
  // still has to travel from the keyless corner to the balance — that span
  // is irreducible — but it travels as a thin elbow rod in the low band
  // instead of over the plate. At the balance end the rod drives a SEE-SAW
  // CRANK standing in the plate cut's open wedge: a HANGING tail down to
  // the rod plane, and a pad arm dropped from the raised pivot to reach
  // under the rim, pivoted in a clevis bracket on the base plate about the
  // RADIAL axis (balance-centre → bracket). The hinge axis is forced by the
  // keyless kinematics: releasing the crown moves the tail post AWAY from
  // the crank (measured stroke ≈ 2.9 outward along the rod), so the rigid
  // rod can only PULL the tail toward the post on release. A tangential
  // hinge would turn that pull into the pad camming UP through the rim
  // (any pad reaching inward from a below-pivot arm rises when its tail is
  // pulled — dz/dψ = −x_pad > 0, no placement escapes it); the radial
  // hinge turns the same pull into a TANGENTIAL tail swing, which never
  // moves anything on the crank toward the balance axis (hypot(R, y) ≥ R),
  // and a solved tangential pad offset converts the swing into the pad
  // DROP the release needs. Because the rod is rigid and pinned at both
  // ends, the linkage is positively controlled in both directions: no
  // preload spring needed.
  //
  // The brake itself is unchanged in kind: an UNDERSIDE pad. The rim's side
  // face is not a usable contact — the timing screws' heads sweep proud of
  // the rim across its whole z-band — so the pad must press up from below,
  // on the same screw-standoff annulus as before (derivation kept verbatim).
  const HACK_CLEAR_MARGIN = CLEAR_MARGIN; // one named margin; the solves below bind exactly at it

  // --- Pad ↔ balance geometry, derived from the balance's OWN build
  // constants (slim rim: height 0.55·t, width 0.5·t; screws base 0.24·t,
  // embedded 0.16·t past the rim face — see makeBalanceWheel) so reshaping
  // the balance moves the brake with it.
  // (BAL_T itself is declared with the Z-stack constants — the balance plane
  // derivation needs it first.)
  const HACK_RIM_I = balanceR - BAL_T * 0.5;             // rim's inner radius
  const HACK_SCREW_IN_R = balanceR - BAL_T * 0.16;       // timing screws' inner tips (rimO − screwLen + protrusion)
  // The rim's underside hangs only this far below the screws' deepest sweep
  // (0.275·t rim half-height vs 0.24·t screw base radius) — far less than
  // the margin, so z alone cannot keep the pad clear of the screws:
  const HACK_SCREW_DROP = (0.55 / 2 - 0.24) * BAL_T * BAL_RIM_F;   // TODO 207 — rim and screw heads scale together
  // ...the rest of the separation must come radially. Corner-to-corner:
  // √(standoff² + drop²) = margin ⇒
  const HACK_SCREW_STANDOFF = Math.sqrt(Math.max(0, HACK_CLEAR_MARGIN ** 2 - HACK_SCREW_DROP ** 2));
  // Size the ruby's top face to fill exactly the annulus that is both fully
  // ON the rim's underside (≥ rim inner edge — full-face seating, lesson:
  // surface-to-surface) and radially inside the screws' standoff:
  const HACK_PAD_TOP_R = (HACK_SCREW_IN_R - HACK_SCREW_STANDOFF - HACK_RIM_I) / 2;
  const HACK_PAD_R = HACK_PAD_TOP_R / rubyFlare; // pad post / ruby-base radius
  const HACK_CONTACT_R = (HACK_RIM_I + HACK_SCREW_IN_R - HACK_SCREW_STANDOFF) / 2;
  const HACK_CONTACT_Z = L_BALANCE - RIM_H_REF / 2;      // the rim's underside plane (TODO 207: held at the full rim's — the metal comes off the top)
  // Minimum acceptable pad gap below the rim when released — the linkage's
  // actual released drop is DERIVED (the rod's rigid length maps the post's
  // crown travel onto the crank), asserted against this floor below.
  const HACK_DROP_MIN = 0.35;

  // --- Crank geometry. The PAD ARM still sits level at full engagement
  // with its ruby's top face exactly on the contact plane — the engaged
  // pose is the calibration zero — but the arm's plane is a build DATUM
  // now (Z_STOP_PIVOT_LOW below), not the pivot height: the pivot moved up
  // so the tail can hang to the low rod plane, and a drop leg connects the
  // raised pivot hub to the arm.
  const STOP_ARM_T = 0.8;     // pad arm thickness
  const STOP_ARM_W = 0.9;     // pad arm width
  const STOP_PAD_RISE = 0.9;  // arm top face → ruby top face (post 0.5 + ruby 0.4)
  const STOP_TAIL_W = 0.5;    // tail bar section
  const STOP_LEG_W = 0.7;     // drop-leg section (local x): pivot hub → pad-arm plane
  // The drop leg — and with it the pad arm's root — is IN LINE with the tail
  // bar, not stood off beside it. The crank hinges about local X, so every
  // point of it keeps its x for ever: a leg hanging off-axis makes the crank
  // asymmetric about its own swing plane, and then there is no pair of
  // positions where a clevis can straddle it (the old +x leg ran straight
  // through the +x cheek). With the root ON the axis the crank's whole hub
  // band is |x| ≤ STOP_HUB_HALF_X, which is what the cheeks are derived from.
  const STOP_ARM_ROOT_X = 0;
  const STOP_HUB_HALF_X = Math.max(STOP_TAIL_W, STOP_LEG_W) / 2;
  // Bracket axis stand-off from the balance axis. With the RADIAL hinge the
  // crank's tangential swing only ever moves it AWAY from the balance axis,
  // so the binding constraint is the STATIC hardware: the clevis cheeks
  // straddle the crank along that same radial axis and reach
  // STOP_CHEEK_X + STOP_CHEEK_T/2 ≈ 0.82 inward of the pivot, so the
  // allowance must cover that + CLEAR_MARGIN ≈ 0.97; the 2.0 keeps the extra
  // so the pad arm's diagonal run down to the contact annulus stays shallow.
  const STOP_LEAN_ALLOW = 2.0;
  const STOP_PIVOT_R = BAL_OUTER_R + STOP_LEAN_ALLOW;
  // The tail now HANGS: the hack rod runs on the LOW plane (under the
  // great wheel), so the crank's driven arm reaches DOWN from the pivot to
  // the rod. The pivot height is therefore no longer set by the pad-arm
  // stack — it is SIZED FROM THE STROKE: the released crank angle is what
  // the rod's crown travel maps onto the tail's length, and a small-angle
  // crank (real-watch scale) needs the pivot high enough that the hanging
  // tail is long. The rod only couples through the TANGENTIAL component of
  // its run (STOP_TANG_K below), so the pivot-height formula carries that
  // factor — omitting it is exactly how the old solve overshot its target
  // swing. The bracket stands in the plate cut's open wedge, where there
  // is no plate to hide below — its slim post is the one piece of this
  // linkage that still shows above the plate line.
  const STOP_PSI_TARGET = 0.5; // ~29° released swing sizes the tail lever (with K ≈ 0.6 the mast stays near its old height)
  const POST_STROKE = Math.hypot(postEng.x - postRel.x, postEng.y - postRel.y);
  const Z_STOP_PIVOT_LOW = HACK_CONTACT_Z - STOP_PAD_RISE - STOP_ARM_T / 2; // the pad arm's own plane (build datum)

  // --- Bearing: scanned around the plate cut's open-wedge centre (the wedge
  // aims plate-centre → balance and is open to the rim, so the OUTWARD
  // bearing is open air from base plate to sky by construction — the crank's
  // tall tail needs exactly that). The scan walks away from the ideal only
  // far enough to clear the escapement-side hardware, and requires the hack
  // rod's approach to keep a strong component along the crank's tilt plane —
  // TANGENTIAL now (the see-saw only converts motion in its own hinge
  // plane, and the hinge is radial). The released tail sweeps tangentially
  // toward the post, so the whole swept segment is tested, not the pivot
  // point alone.
  // §85 step C2 — the pose maths takes its FRAME as an argument. The build
  // binds the chosen station's frame (stopTailTopAt / stopSolvePsi below);
  // the bearing scan binds a CANDIDATE's, so it can ask the same questions of
  // a station it is only considering. One model, two callers — the same rule
  // step A moved this whole solve into layout.js for.
  const tailTopIn = (fr, psi) => {
    const sw = -fr.tailH * Math.sin(psi); // tangential swing (H < 0)
    return {
      x: fr.pivot.x + fr.tHat.x * sw,
      y: fr.pivot.y + fr.tHat.y * sw,
      z: fr.zPivot + fr.tailH * Math.cos(psi),
    };
  };
  const solvePsiIn = (fr, len, post, prev) => {
    const wx = post.x - fr.pivot.x, wy = post.y - fr.pivot.y, wz = ROD2_PLANE_Z - fr.zPivot;
    const a = -(wx * fr.tHat.x + wy * fr.tHat.y), b = wz;
    const c = (wx * wx + wy * wy + wz * wz + fr.tailH * fr.tailH - len * len)
      / (2 * fr.tailH);
    const m = Math.hypot(a, b) || 1e-9;
    const base = Math.atan2(a, b);
    const off = Math.acos(clamp(c / m, -1, 1));
    const c1 = base - off, c2 = base + off;
    return Math.abs(c1 - prev) <= Math.abs(c2 - prev) ? c1 : c2;
  };
  // A station's whole linkage, derived the way the build derives it: pivot,
  // coupling, the pivot height the stroke buys through that coupling, and the
  // hanging tail it implies.
  const frameAt = (phi) => {
    const rHat = { x: Math.cos(phi), y: Math.sin(phi) };
    const tHat = { x: -rHat.y, y: rHat.x };
    const pivot = {
      x: P.balance.x + rHat.x * STOP_PIVOT_R,
      y: P.balance.y + rHat.y * STOP_PIVOT_R,
    };
    const dx = pivot.x - postEng.x, dy = pivot.y - postEng.y;
    const tangK = (dx * tHat.x + dy * tHat.y) / Math.hypot(dx, dy);
    const zPivot = ROD2_PLANE_Z + POST_STROKE / (Math.abs(tangK) * Math.sin(STOP_PSI_TARGET));
    return { rHat, tHat, pivot, tangK, zPivot, tailH: ROD2_PLANE_Z - zPivot };
  };
  // The ROUTE that station commits the rod to: calibrate the length at the
  // engaged pose, track ψ across the crown stroke, and ask the corridor
  // whether any elbow threads it. Coarse grid — a strict subset of the fine
  // one, so a pass here is a pass there.
  const routeAt = (fr, coarse) => {
    const len = (() => {
      const t = tailTopIn(fr, 0);
      return Math.hypot(postEng.x - t.x, postEng.y - t.y, ROD2_PLANE_Z - t.z);
    })();
    const poses = [];
    let prev = solvePsiIn(fr, len, postRel, 0);
    for (let t = 0; t <= 1.0001; t += 0.125) {
      const post = tailPostWorldAt(t);
      const psi = solvePsiIn(fr, len, post, prev);
      prev = psi;
      const tt = tailTopIn(fr, psi);
      poses.push({ a: post, b: { x: tt.x, y: tt.y }, za: ROD2_PLANE_Z, zb: tt.z });
    }
    const opts = { eMax: ELBOW_E_MAX, plateLimit: plateR - linkHalfW - CLEAR_MARGIN };
    return solveElbow(len, poses, obstaclesFor(linkHalfW), linkHalfT,
      coarse ? { ...opts, fStep: 0.25, eStep: 1 } : opts);
  };
  const STOP_BEARING = (() => {
    const ideal = Math.atan2(P.balance.y, P.balance.x);
    const obstacles = bearingObstaclesAt(P);
    let best = null, bestAny = null;
    // Scan bound: the plate cut's open wedge (±phiOpen about the same
    // balance-centred aim), less the bracket's own angular half-width —
    // the mast crosses the plate band and must stay in open air. The old
    // ±28° window was leftover conservatism from the tall-mast design and
    // capped the achievable coupling ~0.62.
    const wedgeBound = TQ_CUT.phiOpen / DEG2RAD - Math.atan2(1.65 + HACK_CLEAR_MARGIN, STOP_PIVOT_R) / DEG2RAD;
    for (let d = -Math.floor(wedgeBound); d <= Math.floor(wedgeBound); d += 1) {
      const phi = ideal + d * DEG2RAD;
      const bx = P.balance.x + Math.cos(phi) * STOP_PIVOT_R;
      const by = P.balance.y + Math.sin(phi) * STOP_PIVOT_R;
      const dxp = bx - postEng.x, dyp = by - postEng.y, mp = Math.hypot(dxp, dyp) || 1;
      const tx = -Math.sin(phi), ty = Math.cos(phi);
      const rodK = (dxp * tx + dyp * ty) / mp;
      if (Math.abs(rodK) < 0.6) continue;
      // Released tail-end sweep, tangential, TOWARD the post: first-order
      // stroke/|K|, inflated 25% for the pin's cosine rise (covers ψ0 ≲ 40°).
      const sw = -Math.sign(rodK) * 1.25 * POST_STROKE / Math.abs(rodK);
      const swept = { x: bx + tx * sw, y: by + ty * sw };
      if (Math.hypot(bx, by) > plateR - 2) continue;        // bracket fully on the plate
      if (Math.hypot(swept.x, swept.y) > plateR - 1) continue; // swept tail stays over the plate
      let clr = Infinity;
      for (const o of obstacles)
        clr = Math.min(clr, segCircleClear({ x: bx, y: by }, swept, o) - 2);
      if (clr < HACK_CLEAR_MARGIN) continue;
      // §85 step C2 — AND the rod must be able to GET here. The scan used to
      // choose the station on the crank's own merits and discover the route
      // afterwards, which is how a station whose corridor is impossible could
      // win on coupling alone. Probing the route costs one coarse elbow solve
      // per candidate; the station is a position-space choice, so paying for
      // routability with it is legal where paying with the rod's dimensions
      // would not be.
      const routable = routeAt(frameAt(phi), true).clear >= 0;
      // MAXIMIZE the coupling, with clearance as the constraint it always
      // really was (the old clearance-maximizing score let K sit at its
      // 0.6 gate, inflating the tail lever — and the mast — by ~40%: the
      // pivot height divides by |K|, see Z_STOP_PIVOT). Tiny clearance
      // tiebreak so equal-K bearings still prefer open air.
      const score = Math.abs(rodK) + clr * 0.01;
      if (routable && (!best || score > best.score)) best = { phi, score, d };
      if (!bestAny || score > bestAny.score) bestAny = { phi, score, d };
    }
    // Degrade in ONE step at a time, and say which step was taken. A station
    // that cannot route is still better than the outward ideal, which meets
    // none of the constraints — so an unroutable movement keeps the
    // best-coupled station (what this scan chose before C2) and says the
    // corridor is the thing that failed. That is a LAYOUT finding, not a
    // reason to accept a station nothing was checked against; C4 turns it
    // into a refusal, and C1's elbow warning names the body in the way.
    if (!best && bestAny) {
      warn('stop work: no station about the balance can route the hack rod through the low corridor — keeping the best-coupled one');
      best = bestAny;
    }
    if (!best) {
      warn('stop work: no clear bearing about the balance — using the outward ideal');
      best = { phi: ideal };
    }
    // §86 A — the wedge is this scan's fence. A winner at its edge means the
    // plate cut chose the station, not the coupling the scan is scoring for.
    if (best.d !== undefined && Math.abs(Math.abs(best.d) - Math.floor(wedgeBound)) < 0.5)
      corners.push({ what: 'the stop work\'s bearing', value: `${best.d.toFixed(0)}° off the ideal`,
        bound: `the plate cut's wedge, ±${Math.floor(wedgeBound)}°` });
    return best.phi;
  })();
  // The chosen station's frame, from the same derivation every candidate was
  // judged by (§85 C2): pivot, coupling |K| (≥ 0.6 by the scan), the pivot
  // height the stroke buys through that coupling —
  //   |STOP_TAIL_H| · sin(ψ_target) · |K| = POST_STROKE
  // — and the tail that hangs from it (NEGATIVE: down to the rod plane).
  const STOP_FRAME = frameAt(STOP_BEARING);
  const STOP_R_HAT = STOP_FRAME.rHat;
  const STOP_T_HAT = STOP_FRAME.tHat; // hinge plane's horizontal axis
  const STOP_PIVOT = STOP_FRAME.pivot;
  const STOP_TANG_K = STOP_FRAME.tangK;
  const Z_STOP_PIVOT = STOP_FRAME.zPivot;
  const STOP_TAIL_H = STOP_FRAME.tailH;
  // CASE-FIT assert: the mast (pivot + clevis cheeks, top = pivot + 0.85)
  // must not stand above the balance cock's own height — the cock sets the
  // display side's silhouette, and the K-maximizing bearing scan above is
  // what earns this. If it fires, the achieved coupling is printed: the
  // fallback is a dedicated hack-rod pin at reduced radius on the setting
  // lever's tail (stroke scales with r/SL_TAIL).
  const STOP_MAST_TOP = Z_STOP_PIVOT + 0.85;
  if (STOP_MAST_TOP > TQ_TOP_Z)
    warn(`stop work: mast top ${STOP_MAST_TOP.toFixed(2)} above the cock height ${TQ_TOP_Z.toFixed(2)} — achieved |K| = ${Math.abs(STOP_TANG_K).toFixed(3)}, needed ≥ ${(POST_STROKE / ((TQ_TOP_Z - 0.85 - ROD2_PLANE_Z) * Math.sin(STOP_PSI_TARGET))).toFixed(3)}`);

  const PAD_ARM_LOCAL_Z = Z_STOP_PIVOT_LOW - Z_STOP_PIVOT;

  // --- Hack-rod linkage: rigid rod, length CALIBRATED at the engaged pose
  // (crank at ψ = 0, pad tangent to the rim by the z-stack above); the
  // released crank angle then FOLLOWS from the post's crown travel through
  // the rod constraint — derived, not styled — and the released pad drop is
  // asserted against HACK_DROP_MIN. Per-frame the crank angle is solved from
  // the same constraint (a·sinψ + b·cosψ = c, branch nearest the previous
  // frame), mirroring the reset hammer's rod solve; ψ is clamped at 0
  // because the rim itself is the hard stop the pad presses against.
  // Rotation about local X maps (y, z) → (y·cosψ − z·sinψ, y·sinψ + z·cosψ):
  // the tail-end pin swings in the TANGENTIAL-vertical plane.
  function stopTailTopAt(psi) { return tailTopIn(STOP_FRAME, psi); }
  function stopSolvePsi(post, prev) { return solvePsiIn(STOP_FRAME, HACK_ROD_LEN, post, prev); }
  const HACK_ROD_LEN = (() => {
    const t = stopTailTopAt(0);
    return Math.hypot(postEng.x - t.x, postEng.y - t.y, ROD2_PLANE_Z - t.z);
  })();
  const STOP_PSI0 = stopSolvePsi(postRel, 0); // released crank angle (sign follows the post's tangential side)

  // --- Pad placement on the crank, DERIVED. Under the radial hinge the pad
  // moves only in (tangential, vertical): z(ψ) = y·sinψ + z_top·cosψ.
  // The cosine term alone would RAISE a below-pivot pad as |ψ| grows, so
  // the tangential offset PAD_Y is solved from the release constraint. The
  // released pad face TILTS with the crank, so the constraint binds at the
  // face's WORST point — the top-face edge a pad radius toward the swing
  // (y = PAD_Y + r·sign(sinψ0)), not the centre:
  //   drop(ψ0) = −(PAD_Y + r·sgn)·sinψ0 + z_top·(1 − cosψ0) = HACK_DROP_MIN
  const STOP_PAD_TOP_LZ = HACK_CONTACT_Z - Z_STOP_PIVOT; // ruby top face, crank-local (negative)
  const STOP_PAD_Y = (STOP_PAD_TOP_LZ * (1 - Math.cos(STOP_PSI0)) - HACK_DROP_MIN) / Math.sin(STOP_PSI0)
    - HACK_PAD_TOP_R * Math.sign(Math.sin(STOP_PSI0));
  // Radial coordinate: the contact annulus is rotationally symmetric about
  // the balance axis, so the tangential offset just shifts the contact
  // azimuth — the pad's top-face centre stays at the derived radius:
  //   hypot(STOP_PIVOT_R + PAD_X, PAD_Y) = HACK_CONTACT_R
  const STOP_PAD_X = Math.sqrt(Math.max(0, HACK_CONTACT_R ** 2 - STOP_PAD_Y ** 2)) - STOP_PIVOT_R; // negative: inward
  if (Math.abs(STOP_PAD_Y) >= HACK_CONTACT_R)
    warn(`stop work: pad tangential offset exceeds the contact radius ${STOP_PAD_Y.toFixed(2)}`);

  // Hack rod: elbow link on the low plane, solved exactly like the reset
  // rod's (the endpoints here come from the crank solve; the slight z-slope
  // toward the crank end is carried by the placement quaternion).
  const HACK_ROD_ELBOW = (() => {
    const poses = [];
    let prev = STOP_PSI0;
    for (let t = 0; t <= 1.0001; t += 0.125) {
      const post = tailPostWorldAt(t);
      const psi = stopSolvePsi(post, prev);
      prev = psi;
      const tt = stopTailTopAt(psi);
      // §85 C1 — the pose carries its HEIGHTS as well as its plan: the post
      // end is pinned to the rod plane, the crank end rides the hanging
      // tail's top and climbs with ψ. That climb is the whole reason a flat
      // corridor model could not see the great wheel.
      poses.push({ a: post, b: { x: tt.x, y: tt.y }, za: ROD2_PLANE_Z, zb: tt.z });
    }
    const best = solveElbow(HACK_ROD_LEN, poses, obstaclesFor(linkHalfW), linkHalfT,
      { eMax: ELBOW_E_MAX, plateLimit: plateR - linkHalfW - CLEAR_MARGIN });
    if (best.atBound?.length)
      corners.push({ what: 'the hack rod\'s bend', value: `f ${best.f.toFixed(2)}, e ${best.e.toFixed(1)}`,
        bound: best.atBound.join(' and ') });
    if (best.clear < 0)
      warn(`hack rod elbow: best clearance ${best.clear.toFixed(2)} — the low corridor is fouled${best.at?.what ? ` at ${best.at.what}` : ''}`);
    return best;
  })();

  return {
    // declared spec + pad geometry
    HACK_CLEAR_MARGIN, HACK_RIM_I, HACK_SCREW_IN_R, HACK_SCREW_DROP, HACK_SCREW_STANDOFF,
    HACK_PAD_TOP_R, HACK_PAD_R, HACK_CONTACT_R, HACK_CONTACT_Z, HACK_DROP_MIN,
    STOP_ARM_T, STOP_ARM_W, STOP_PAD_RISE, STOP_TAIL_W, STOP_LEG_W,
    STOP_ARM_ROOT_X, STOP_HUB_HALF_X, STOP_LEAN_ALLOW, STOP_PSI_TARGET,
    // the station and the lever it sizes
    STOP_PIVOT_R, POST_STROKE, Z_STOP_PIVOT_LOW,
    STOP_BEARING, STOP_R_HAT, STOP_T_HAT, STOP_PIVOT, STOP_TANG_K,
    Z_STOP_PIVOT, STOP_TAIL_H, STOP_MAST_TOP, PAD_ARM_LOCAL_Z,
    // §86 A — which of these were decided by a fence rather than a field
    corners,
    // the linkage: its pose functions, its calibrated length, its route
    stopTailTopAt, stopSolvePsi, HACK_ROD_LEN, STOP_PSI0,
    STOP_PAD_TOP_LZ, STOP_PAD_Y, STOP_PAD_X,
    HACK_ROD_ELBOW,
    HACK_LINK_W: 2 * linkHalfW,   // §234: the blank the elbow was priced at — main.js cuts to this, not to a second computation
  };
}
