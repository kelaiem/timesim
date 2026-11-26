// §22 / §161 — THE WATCH SPEC'S ROSTER, as a module (§338 landing 1).
//
// The geometry-tier knobs a URL may carry, and how each is read. This table
// lived in an inline classic script in index.html, which only a browser can
// run, so a host that is not a page (tools/native/, §338) had no way to give the
// build its spec except by copying the table, and §161 exists because a second
// copy of this list fell two keys behind. It is ONE declaration again, here:
// index.html's entry imports spec-boot.js (which publishes it for the page) and
// the native host calls publishSpec with its own query. Nothing else changed:
// the same globals, the same values, published before any module that reads
// them is evaluated (spec-boot.js is the entry's FIRST import, and ES modules
// evaluate their dependencies in import order).
//
// layout.js derives F_BALANCE and the train counts from globalThis.__WATCH_SPEC
// at IMPORT time, which is why this must run before main.js's graph.
//
// §161 — THE TABLE IS THE ROSTER, and it is published. A variant that saves
// a spec and a link that carries one must cover exactly what boot READS, and
// main.js used to keep a hand-typed second copy of this list: it had already
// fallen two keys behind (`alarmbarrelaz` §129, `dialr` §125), so every saved
// variant silently dropped them. main.js consumes __WATCH_SPEC_KEYS and asserts
// rather than restating.
//
// §351 landing 0 — THE ONE SPEC SCHEMA. Each row is an object, and its columns are the whole of what the build knows about
// the key, read by every reader rather than restated:
//   field        the SPEC field it feeds (layout.js SPEC), and the name a configuration key spells it by
//   parse        how the URL's text is read (absent: Number)
//   kind         how layout.js resolves it and decides whether the build HONOURED it: 'angle' (any finite number, taken
//                mod 360), 'step' (finite, clamped to ±180), 'number' (any finite number), and a kind per key whose rule
//                is its own ('rate', 'reserve', 'idlers', 'choice', …; layout.js' SPEC_HONOURED says each)
//   offered      where a viewer can reach it: 'menu' (the panel's main menus), 'experimental' (Appearance → Advanced →
//                Experimental build, src/experimental-specs.js), 'url' (a link only)
//   arrangement  false when the key moves no metal the alarm's arming seat or a gong seat stands on: the ARRANGEMENT KEY
//                (layout.js arrangementSpec) drops it, so a non-default value keeps the arrangement's solved rows
//   defaults     URL spellings that mean the default and are accepted in silence (an old `?frame=lands` link)
//   accepts      what the key takes, in plain words: the sentence a refusal quotes when the build did not use a value
// A value the build does not use is never dropped in silence: layout.js names it in SPEC_REFUSALS, and the spec panel's
// verdict row shows it (tools/probe-spec-schema.mjs holds both).
export const SPEC_FIELDS = Object.freeze({
  vph: { field: 'vph', kind: 'rate', offered: 'menu', accepts: 'a beat rate the rate table drives (the main menu\'s rates, or 36,000 with the double barrel)' },
  reserveh: { field: 'reserveHours', kind: 'reserve', offered: 'menu', accepts: '12 to 48 h in steps of 3' },
  crownaz: { field: 'crownAzDeg', kind: 'angle', offered: 'url', accepts: 'any angle in degrees' },            // §33 step 1 — stem azimuth, movement-frame degrees
  barrelstep: { field: 'barrelStepDeg', kind: 'step', offered: 'url', accepts: 'an angle from −180° to 180°' },      // §33 step 3 — the train's
  escstep: { field: 'escapeStepDeg', kind: 'step', offered: 'url', accepts: 'an angle from −180° to 180°' },         // arrangement angles are
  balstep: { field: 'balanceStepDeg', kind: 'step', offered: 'url', accepts: 'an angle from −180° to 180°' },        // solveLayout's own inputs
  alarmaz: { field: 'alarmAzDeg', kind: 'angle', offered: 'url', accepts: 'any angle in degrees' },            // §33 — the alarm corner's azimuth, world degrees
  alarmmod: { field: 'alarmModAzDeg', kind: 'angle', offered: 'url', accepts: 'any angle in degrees' },        // §33 — the whole alarm module's azimuth (striking-wheel station), world degrees
  alarmbarrelaz: { field: 'alarmBarrelAzDeg', kind: 'angle', offered: 'url', accepts: 'any angle in degrees' }, // §129 — the alarm BARREL's bearing off the striking wheel (module-relative), which ?alarmmod= cannot move
  // §184 — the OTHER TWO LEGS of that same solved triple. θ_b alone was
  // movable, which meant a URL could break a triple by moving a third of
  // it; these complete the set, and main.js's joint bound judges all three.
  alarmgovaz: { field: 'alarmGovAzDeg', kind: 'angle', offered: 'url', accepts: 'any angle in degrees' },      // §184 — the GOVERNOR's bearing off the striking wheel (module-relative)
  alarmanchoraz: { field: 'alarmGovAnchorAzDeg', kind: 'angle', offered: 'url', accepts: 'any angle in degrees' }, // §184 — the ANCHOR's bearing off the governor (module-relative)
  stemaz: { field: 'stemAzDeg', kind: 'angle', offered: 'url', accepts: 'any angle in degrees' },              // §33 step 2 — the stem decoupled, world degrees
  d4: { field: 'd4', kind: 'number', offered: 'url', accepts: 'a number, in movement units' },                         // §94 tier A — centre→fourth distance: the small-seconds station, in movement units
  rsvr: { field: 'rsvr', kind: 'number', offered: 'url', accepts: 'a number, in movement units' },                     // §94 tier C — the power-reserve station's radius, dial-local, in movement units
  rsvaz: { field: 'rsvAzDeg', kind: 'number', offered: 'url', accepts: 'an angle in degrees' },                // §308 L4 option A — the power-reserve station's azimuth, dial-clock degrees (0 = 12 o'clock, clockwise from the front); with rsvr a polar station
  arrangement: { field: 'arrangement', parse: String, kind: 'marker', offered: 'url', accepts: '\'designed\'' }, // §314 — 'designed' builds the designed train; absent, every build takes layout.js' ARRANGEMENT unless the URL names one of its keys. Read by SPEC, never a spec field itself, so it never enters a configKey
  rsvidl: { field: 'rsvIdlers', kind: 'idlers', offered: 'url', accepts: '0, 2, 4 or 6' },              // §313 — idler PAIRS between the reserve train's p1 and w2 (0, 2, 4 or 6 idlers), for a station farther from the barrel than two meshes reach; null = the two-stage train as designed
  rsvsweep: { field: 'rsvSweepDeg', kind: 'number', offered: 'url', accepts: 'an angle in degrees' },          // §308 L4 option A — the reserve hand's graduated sweep, degrees (the reduction train re-solves from it; null = 300)
  arrest: { field: 'arrest', parse: String, kind: 'choice', offered: 'experimental', arrangement: false, defaults: ['geared', 'stopwork'], accepts: '\'stop-iron\', \'trailing\' or \'stopwork-site\' (\'geared\' and \'stopwork\' are the default)' },   // §329 landing 2a — 'trailing' measures the trailing-side winding arrest's site (no metal yet); absent = the default arrest (§329's direct stop-work where it stands, §337's geared one elsewhere); 'stop-iron' = §47's
  barrels: { field: 'barrels', kind: 'barrels', offered: 'experimental', defaults: ['1'], accepts: '2, the double barrel (1 is the default)' },               // §339 landing 3c — 2 builds THE DOUBLE BARREL: today's drum and a parallel second going barrel geared to it, for power (layout.js PARALLEL_BARREL); absent (or 1) = the one drum, as designed. Incubating: solved on the round alarm-free build at 30 h, refused elsewhere
  pulley: { field: 'pulley', kind: 'pulley', offered: 'url', defaults: ['0'], accepts: '1 (0 is the default)' },                 // §339 landing 2b — 1 detaches the drum from the cone: the going drum becomes a CHAIN PULLEY geared to ONE BARREL in the free disc (layout.js PULLEY_BARREL). Experimental (it was `barrels=2` until 2026-11-18); absent = the drum on the chain
  drumaz: { field: 'drumAzDeg', kind: 'angle', offered: 'url', accepts: 'any angle in degrees' },              // §75 step 1 — the mainspring drum's azimuth about the fusee, degrees, movement frame (counter-clockwise from +x); absent = the blended default
  strap: { field: 'strapMm', kind: 'strap', offered: 'menu', arrangement: false, accepts: 'a width in mm greater than 0' },                 // 2026-11-01 — the strap width, mm between the lugs (the spring bar's free length); absent = 19, the default; the cap is 20
  alarm: { field: 'alarm', kind: 'alarm', offered: 'menu', defaults: ['1'], accepts: '0, the movement without the alarm (1 is the default)' },                   // §325 landing 3 — 0 builds the movement WITHOUT the alarm complication (no alarm, gong or pusher; their plate openings uncut); absent = the alarm, as designed
  alarmr: { field: 'alarmr', kind: 'number', offered: 'url', accepts: 'a number, in movement units' },                 // §98 — the alarm corner's radius, in movement units (§76's pin)
  subdialr: { field: 'subdialr', kind: 'number', offered: 'url', accepts: 'a number, in movement units' },             // §97 — the shared sub-dial well radius, in movement units
  dialr: { field: 'dialr', kind: 'number', offered: 'url', accepts: 'a number, in movement units' },                   // §125 — the dial's radius, in movement units (null = the movement's own diameter)
  studr: { field: 'studr', kind: 'number', offered: 'menu', accepts: 'a number, in movement units' },                   // §237 — the hairspring stud's radius, in movement units: where the overcoil's terminal lands, and so how far the cock's carrier arm reaches (null = one coil pitch inside the outer coil)
  formrect: { field: 'formRectSpec', parse: String, kind: 'formrect', offered: 'url', arrangement: false, accepts: 'xMin,xMax,yMin,yMax (and k,tau on the fitted tonneau), never with the free outline' }, // §307 landing 2 / §308 — the FITTED form shape's BOUNDS, xMin,xMax,yMin,yMax in movement units, whatever its kind (§317: and for 'fitted' its side curvature k and apex height tau after them) (__clock.formFootprint.rect after a first boot; tools/form-layout.mjs --dump prints it)
  case: { field: 'caseShape', parse: String, kind: 'choice', offered: 'menu', arrangement: false, defaults: ['round'], accepts: '\'rect\', \'cushion\', \'tonneau\', \'fitted\' or \'free\' (\'round\' is the default)' }, // §307/§308 — the case's outline, a kind of layout.js's shape library: 'rect' | 'cushion' | 'tonneau' | 'fitted' (§317) cut plates, dial and case to that shape, fitted to the movement (absent or anything else = round, as designed)
  frame: { field: 'frame', parse: String, kind: 'choice', offered: 'experimental', arrangement: false, defaults: ['lands'], accepts: '\'pillars\' (\'lands\' is the default)' }, // §325 landing 6 / §328 — 'pillars' builds the traditional frame on four applied pillars; absent or anything else, the default: the back plate on lands the base plate raises (an old 'lands' link reads that default)
  hands: { field: 'hands', parse: String, kind: 'choice', offered: 'experimental', arrangement: false, accepts: '\'slide\', with a shaped case' },   // §325 landing 7 — 'slide' builds the central hands telescoping on a form face (an arm to the nearest reach, a slider the cam runs out); absent or anything else: the hands as designed
  gong: { field: 'gongSeat', parse: String, kind: 'choice', offered: 'url', arrangement: false, accepts: '\'bar\', \'spiral\' or \'arc\'' }, // §310 landing 2 — the gong's seat on a form build: 'bar' (the default under ?case=), 'spiral', or 'arc' (the round build's arc); src/gong-seats.js, generated, says where each stands
  // §36 Apply — a committed route, and the bush stations frozen with it.
  // These are the tier's first NON-NUMERIC knobs, which is why the rows
  // below carry a parse: a route is a polyline, not a quantity. Shape is
  // layout.js's business (ROUTE_SPEC validates and refuses); this table's
  // job is only to say the key exists and how to read it off the URL.
  route: { field: 'routeSpec', parse: String, kind: 'route', offered: 'url', accepts: 'a polyline x,y,z;x,y,z;… of two points or more' },          // x,y,z;x,y,z;… movement units, two decimals
  routebush: { field: 'routeBushSpec', parse: String, kind: 'route', offered: 'url', accepts: 'i,t;… stations on a route the link also carries' },  // i,t;… segment index and fraction, frozen at Apply
});

// ABSENCE is every knob's default at this tier — which is what lets the
// roster double as "only non-default travels" for the share link, with no
// per-key default to compare against. A knob is a NUMBER unless its row
// names a parse (§351 landing 0 made every row an object; before it a bare
// string was the numeric field it fed). §36's route keys are the
// first that are not numbers, and adding them as a second parsed-elsewhere
// list would rebuild exactly the two-copy drift §161 deleted.
export function readSpec(search) {
  const p = new URLSearchParams(search);
  const s = {};
  for (const k in SPEC_FIELDS) {
    if (!p.has(k)) continue;
    const d = SPEC_FIELDS[k];
    s[d.field] = (d.parse ?? Number)(p.get(k));
  }
  return s;
}

// What index.html's inline script did, verbatim in effect: the roster always,
// the spec only when the query names a knob.
export function publishSpec(search, target = globalThis) {
  const s = readSpec(search);
  target.__WATCH_SPEC_KEYS = Object.freeze(Object.keys(SPEC_FIELDS));
  if (Object.keys(s).length) target.__WATCH_SPEC = s;
  return s;
}
