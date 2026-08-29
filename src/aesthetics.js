import aestheticsData from './aesthetics.json' with { type: 'json' };

// §23: session overrides. The advanced panel writes tuned values here; some
// (subdial size, marker geometry) are consumed at BUILD time, and a reload
// knob whose value dies on reload is a control that never visibly works. So
// the tuned state is merged over the file at load. The FILE stays the single
// source of record — the panel's Copy JSON is how a tuning session becomes a
// commit, and Reset clears the overrides.

// The two storage keys, named once. They were spelled as literals in four
// places across two files; a store this small does not need four spellings of
// its own name, and the boot handshake below is only correct while the two
// halves agree on the marker's key.
export const OVERRIDES_KEY = 'aestheticsOverrides';
export const BOOT_PENDING_KEY = 'aestheticsBootPending';

// Keys beginning '_' are prose (`_labels`, `_bounds`, `_comment`) — schema, not
// parameters. One replacer, so the panel's Copy JSON and the persisted
// overrides cannot disagree about what a tuned value IS; both used to spell
// this predicate out inline, three copies of one rule.
const stripMeta = (k, v) => (k.startsWith('_') ? undefined : v);

// Storage, wrapped rather than called directly, for one reason: EVERY read and
// write here is inside a try. localStorage throws on a blocked third-party
// context and on a full quota, and a boot that dies because a tuning
// convenience could not be saved would be the panel bricking the app it tunes.
// Callers get a boolean or a null and are free to ignore it.
export function readOverrides() {
  try {
    const raw = localStorage.getItem(OVERRIDES_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }   // corrupt or unreadable overrides must never brick boot
}

export function writeOverrides(obj) {
  try { localStorage.setItem(OVERRIDES_KEY, JSON.stringify(obj, stripMeta)); return true; } catch { return false; }
}

export function clearOverrides() {
  try { localStorage.removeItem(OVERRIDES_KEY); return true; } catch { return false; }
}

// Copy JSON's exact output: the same replacer as the persisted form, indented
// because this one is read by a human and pasted into the file.
export function serializeOverrides(obj) {
  return JSON.stringify(obj, stripMeta, 2);
}

// THE MERGE. Lifted out of the boot path below without changing a rule, so the
// one hardened entry point can be reused (an imported file, a link) and tested
// directly — a second parser would be a second place for every guarantee below
// to stop being true.
//
// Clamp against the schema's own _bounds while merging, so a stale override
// (or a hand-edited one) cannot smuggle in a value the panel would refuse.
// Bounds live in the FILE next to the values they bound, with their
// constraints in the comment — the same single source.
//
// It returns what it did: applied paths, refusals with a reason, and clamps
// with both values. The boot path ignores the report (its old behaviour
// exactly); a caller that took the payload from a FILE or a URL cannot tell
// the viewer what happened to it without this, and "0 of 12 applied" is the
// difference between a broken import and a silent one.
export function mergeAesthetics(dst, src, out = { applied: [], refused: [], clamped: [] }, path = []) {
  const bounds = dst._bounds || {};
  for (const k of Object.keys(src)) {
    if (k.startsWith('_')) continue;
    const at = [...path, k];
    const p = at.join('.');
    if (src[k] && typeof src[k] === 'object' && dst[k] && typeof dst[k] === 'object') {
      mergeAesthetics(dst[k], src[k], out, at);
      continue;
    }
    let v = src[k];
    // TYPE-ANCHORED: the file's value defines the leaf's type, and a
    // mismatched override is refused, not coerced. Found the hard way:
    // NaN serialises to JSON null, which is not typeof 'number', so it
    // sailed past the finite check and wrote null into the exposure —
    // the exact smuggling this merge exists to stop.
    //
    // The same comparison also refuses a key the schema does not have
    // (typeof undefined is never typeof a leaf), which is what makes a
    // payload written against an older or newer file apply the leaves that
    // still exist and drop the rest. Reported as `unknown` rather than
    // `type` because the two mean different things to whoever sent it.
    if (typeof v !== typeof dst[k]) {
      out.refused.push({ path: p, why: dst[k] === undefined ? 'unknown' : 'type' });
      continue;
    }
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) { out.refused.push({ path: p, why: 'nonfinite' }); continue; }  // NaN/Infinity never enter
      if (bounds[k]) {
        const c = Math.min(bounds[k][1], Math.max(bounds[k][0], v));
        if (c !== v) { out.clamped.push({ path: p, from: v, to: c }); v = c; }
      }
    }
    dst[k] = v;
    out.applied.push(p);
  }
  return out;
}

// CRASH RECOVERY, before anything merges. Overrides persist, so a value that
// breaks the BUILD would crash every subsequent boot with the panel that could
// reset it never appearing — a bricked loop reachable from a slider. So the
// merge arms a pending marker, and main.js confirms it once the build
// completes. A load that finds the marker still armed knows the previous boot
// died mid-build: it drops the overrides and says so, and the file's own
// values boot clean. Value-agnostic — it does not need to know WHICH value
// was lethal, only that one was.
try {
  if (localStorage.getItem(BOOT_PENDING_KEY)) {
    clearOverrides();
    localStorage.removeItem(BOOT_PENDING_KEY);
    console.warn('§23: the previous boot died before completing with tuned overrides active — overrides dropped, booting from aesthetics.json');
  }
} catch { }
// The FILE's own values, snapshotted BEFORE anything merges over them. The
// header calls the file "the single source of record", and after the merge
// below that record is gone — `aestheticsData` holds the EFFECTIVE value, so
// nothing downstream can still ask what shipped. The share link needs exactly
// that question answered ("only non-default travels", §37's rule), and it is
// the one thing an in-place merge structurally cannot answer afterwards.
export const AESTHETICS_DEFAULTS = Object.freeze(structuredClone(aestheticsData));

try {
  const over = readOverrides();
  if (over) {
    mergeAesthetics(aestheticsData, over);
    localStorage.setItem(BOOT_PENDING_KEY, '1');
  }
} catch { /* corrupt overrides must never brick boot */ }

// --- §37 tier two — THE DIAL'S COLOUR TRAVELS. `?dialcol=rrggbb`.
//
// The face colour is FINISH, not spec: it moves no station and rebuilds no
// geometry, so it has no business in index.html's spec table (§161's assert
// exists to keep modes out of that roster; a finish value would be the same
// mistake from the other side). It gets its own key at its own tier instead.
//
// WHY IT IS READ HERE, before the build, rather than in applyDeepLink with the
// other link params. The face is a CANVAS, painted during makeDial, and the
// legibility floor (DIAL_INK_CONTRAST_MIN, WCAG 2.1 SC 1.4.11) is asserted at
// paint. Applying the link's colour afterwards through `recolourFace` would
// build the dial once in the wrong colour and assert the wrong value on the
// way past. Merged here, a link is indistinguishable from a tuned override —
// one path, and the build's own asserts judge what the viewer actually sees.
// `src/i18n.js` reads `?lang` the same way and for the same reason: the panel
// is BUILT from it.
//
// THE LINK WINS over a persisted override, deliberately, and this is §97's
// rule rather than a preference. A recipient with their own saved colour would
// otherwise see a different watch from the one that was sent, with nothing on
// screen saying so — "the link and the picture disagree silently, per machine"
// is the exact defect §97 deleted when it retired the sub-dial radius knob.
//
// ...but it is NOT WRITTEN BACK. A link is a way of showing someone a dial,
// not of editing their preferences: the override store is untouched, so their
// own colour is still there on the next visit without the param. That also
// keeps this off the crash-recovery marker below-left: arming it for a URL
// value would let a stranger's link wipe the recipient's saved tuning, which
// is a worse failure than the one the marker exists for. A six-hex colour
// cannot break the build in any case — it is a canvas fill and two contrast
// sums, both total over valid hex.
//
// VALIDATED SYNTACTICALLY, because `mergeAesthetics` cannot do it. That merge
// is TYPE-anchored and clamps NUMBERS against `_bounds`; `dial.face.color` is
// a string, so every string passes and `_bounds` has nothing to say about a
// colour (aesthetics.json states that omission is a decision, not an
// oversight). A URL is untrusted input, so the shape is checked here: six hex
// digits, '#' optional, anything else ignored in silence, which is
// applyDeepLink's standing rule — a bad link degrades, it never throws.
export const DIAL_COL_PARAM = 'dialcol';
export function parseDialCol(raw) {
  if (typeof raw !== 'string') return null;
  const m = /^#?([0-9a-fA-F]{6})$/.exec(raw.trim());
  return m ? `#${m[1].toLowerCase()}` : null;
}
try {
  const col = parseDialCol(new URLSearchParams(location.search).get(DIAL_COL_PARAM));
  if (col) mergeAesthetics(aestheticsData, { dial: { face: { color: col } } });
} catch { /* no location, or a hostile param: the file's colour stands */ }

// Called by main.js when the build has completed — the crash-recovery
// marker's other half.
export function confirmAestheticsBoot() {
  try { localStorage.removeItem(BOOT_PENDING_KEY); } catch { }
}

export const aesthetics = aestheticsData;

export function getDialHourMarkers() {
  return aesthetics.dial.hourMarkers;
}

export function getDialHands() {
  return aesthetics.dial.hands;
}

export function getDialSubdials() {
  return aesthetics.dial.subdials;
}

export function getLighting() {
  return aesthetics.lighting;
}

export function getCamera() {
  return aesthetics.camera;
}

export function getRendering() {
  return aesthetics.rendering;
}

export function getMaterials() {
  return aesthetics.materials;
}
