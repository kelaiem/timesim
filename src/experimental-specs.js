// THE EXPERIMENTAL BUILD GROUP — the spec keys a viewer may reach from the panel before they are ready for the main menus
// (the owner's ask, 2026-11-20: "expose the experimental spec parameters in the advanced appearance section"; the tiers are
// BACKLOG §351's). One row per feature, and the panel's controls are generated from it (main.js, under Appearance →
// Advanced), so a new feature is a row here and not new page code.
//
// A row:
//   id        stable name, used for the control's id and its usage tag; never shown
//   label     the control's name, English (the display site runs it through t())
//   help      one plain sentence of what it does, English (the control's title)
//   tier      'incubating' (builds at ONE solved point and is refused elsewhere) or 'supported' (builds across a declared
//             range, swept by the battery at least once). §351: an incubating row is reachable from the URL and from here,
//             never from the main menus; a feature moves out of this group when it is public
//   param     the URL key it sets (a key of src/spec-fields.js' SPEC_FIELDS, never a field name)
//   options   [value, label, vph?]; the value '' is the build without the feature (the key absent from the URL), and a
//             third entry is the beat rate the option builds, which the panel prints after the label in the reader's digits
//   requires  per option value, the OTHER URL keys that value needs to be built rather than refused: a string sets the key,
//             null removes it. They are the refusal conditions SPEC states in layout.js, written as the URL that satisfies
//             them; `probe-experimental-specs.mjs` boots each option with its requirements applied and holds that it is
//             built and not refused, so a row whose requirements drift from the resolver fails there
//   current   (spec) → the option value the running build carries, read off the RESOLVED spec, so a request SPEC refused
//             shows as not built (the verdict row says why)
//   off       optional: the other keys turning the feature OFF must clear, because without it they would be refused
//   cleanAt   the query of the feature's CLEAN build, the one that boots silent: what earns the row its place here
//   note      optional plain sentence of a known limit the build reports (shown under the control)
//
// Values travel the URL exactly as a link would carry them (§73: values are canonical, only labels translate).

// THE RULE FOR A ROW (the owner's pick, 2026-11-20): a feature is offered here only where at least one of its builds is
// CLEAN, booting with no warning, and its requirements are that build. Measured on native boots at this tree:
//   double barrel  alarm=0&barrels=2&vph=36000 boots silent; at the default 14,400 (and 21,600) its doubled drive swings
//                  the balance past the knock (three warnings), so the option builds the 36,000 watch it was solved for
//   pillars        frame=pillars boots silent (a battery point, swept)
//   stop iron      arrest=stop-iron boots silent (a battery point, swept)
//   sliding hands  hands=slide&case=fitted&alarm=0 boots silent; with the alarm the fitted case carries its own three
//                  warnings, with or without the hands, so the hands need only a shaped case and the note says the rest
// NOT offered, for want of a clean build: the chain pulley (?pulley=1: four warnings at its best, alarm=0, and paused at
// under two thirds of the drive) and the reserves the main menu does not list (every one of 12–45 h warns, its balance not
// re-solved: §351 landing 2). tools/probe-experimental-specs.mjs holds every offered option to a silent boot.
//
// The double barrel's seat (layout.js PARALLEL_BARREL) was solved on the round, alarm-free build at the shipped reserve, so
// those are what it needs: the alarm off, the case round (and no form fit, gong seat or form-only hands for a case that is
// not there), the reserve at its default (30 h, the key absent) and no chain pulley.
const DOUBLE_BARREL_NEEDS = Object.freeze({ vph: '36000', alarm: '0', case: null, formrect: null, gong: null, hands: null, reserveh: null, pulley: null });

export const EXPERIMENTAL_SPECS = Object.freeze([
  Object.freeze({
    id: 'double-barrel', cleanAt: 'barrels=2&vph=36000&alarm=0', param: 'barrels', tier: 'incubating',
    label: 'Double barrel',
    help: 'A second mainspring barrel beside the first, geared to it, for about twice the power: enough to drive the fastest beat',
    options: Object.freeze([['', 'Off'], ['2', 'On', 36000]]),
    requires: Object.freeze({ 2: DOUBLE_BARREL_NEEDS }),
    // Off returns the beat to the default too: no other rate is driven by the one barrel and 36,000 would be refused.
    off: Object.freeze({ vph: null }),
    current: (s) => (s.barrels === 2 ? '2' : ''),
    note: 'Builds only with the alarm off, a round case and the 30 h reserve, so it sets those too',
  }),
  Object.freeze({
    id: 'pillar-frame', cleanAt: 'frame=pillars', param: 'frame', tier: 'supported',
    label: 'Frame on pillars',
    help: 'The traditional frame, the top plate on four posts, instead of the default plate on raised lands',
    options: Object.freeze([['', 'Off'], ['pillars', 'On']]),
    requires: Object.freeze({}),
    current: (s) => (s.frame === 'pillars' ? 'pillars' : ''),
  }),
  Object.freeze({
    id: 'stop-iron', cleanAt: 'arrest=stop-iron', param: 'arrest', tier: 'supported',
    label: 'Stop iron',
    help: 'The older winding stop, a finger the chain lifts, instead of the default star-wheel stop',
    options: Object.freeze([['', 'Off'], ['stop-iron', 'On']]),
    requires: Object.freeze({}),
    current: (s) => (s.arrest === 'stop-iron' ? 'stop-iron' : ''),
  }),
  Object.freeze({
    id: 'sliding-hands', cleanAt: 'hands=slide&case=fitted&alarm=0', param: 'hands', tier: 'supported',
    label: 'Sliding hands',
    help: 'Hands that stretch to follow the edge of a shaped dial',
    options: Object.freeze([['', 'Off'], ['slide', 'On']]),
    // Meaningful only on a shaped case (layout.js reads 'slide' only with a caseShape): a shaped case already chosen keeps
    // its shape, and a round one becomes the fitted tonneau, the shape whose alarm-free build boots silent with the hands.
    requires: Object.freeze({ slide: Object.freeze({ case: 'fitted', barrels: null, vph: null }) }),
    requiresWhen: (s) => (s.caseShape ? {} : null),
    current: (s) => (s.hands === 'slide' ? 'slide' : ''),
    note: 'Needs a shaped case; round becomes the fitted tonneau',
  }),
]);

// The URL a pick leads to: `search` (location.search) with the row's key set to `value` and the value's requirements applied.
// Returns the new search string and, for the confirmation, the OTHER keys it changed ([key, before, after], before/after
// null when absent). Picking '' removes the row's own key and whatever its `off` names: turning a feature off never turns
// another one back on.
export function experimentalSearch(search, row, value, spec = null) {
  const p = new URLSearchParams(search);
  const changed = [];
  const put = (k, v) => {
    const before = p.has(k) ? p.get(k) : null;
    if (v === null) p.delete(k); else p.set(k, v);
    const after = p.has(k) ? p.get(k) : null;
    if (before !== after && k !== row.param) changed.push([k, before, after]);
  };
  if (value === '') { put(row.param, null); for (const [k, v] of Object.entries(row.off ?? {})) put(k, v); }
  else {
    put(row.param, value);
    const when = row.requiresWhen && spec ? row.requiresWhen(spec) : null;
    const needs = when ?? row.requires[value] ?? {};
    for (const [k, v] of Object.entries(needs)) put(k, v);
  }
  return { search: p.toString(), changed };
}
