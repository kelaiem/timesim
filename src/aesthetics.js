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

// TODO 152 — A TRIAL BOOT IS VIRGIN OF AESTHETICS, the way state.js keeps it
// virgin of the session. §33's verdict boot (`?trial=1`, a hidden iframe
// reconfigure mode loads to read a candidate spec's build asserts) must be
// measured on the FILE's values — "a virgin boot is the battery's own standard
// for a verdict" — and must leave the viewer's store untouched. Without this
// guard the merge below applied the viewer's tuned overrides to every trial
// (a tuned hand stack re-cuts metal the build asserts read, so the verdict
// was theirs, not the design's), the two finish params rode in off the
// parent's `location.search`, and — the sharper half — the merge ARMED the
// crash-recovery marker below, which a superseded trial never confirms
// (`reconfKillTrial` removes the iframe mid-build), so the viewer's next real
// boot dropped their overrides and blamed a crash that did not happen.
// Measured 215 ms after commit by tools/probe-240-trial-boot.mjs, which is
// the acceptance. ONE guard, here where the merge is: the parent's trial URL
// is not stripped of finish params as well, because a second copy of this
// rule is the direction-written-twice defect. state.js declares its own flag
// the same way rather than importing this one — the two modules share no
// import today and a shared constant would couple the session tier to this
// file for one boolean.
const TRIAL_BOOT = typeof location !== 'undefined'
  && new URLSearchParams(location.search).has('trial');

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
  const options = dst._options || {};
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
    // §203 step 3 — A PICK IS ANCHORED TO ITS OPTION SET, the way a number is
    // clamped to its _bounds. A string leaf that declares `_options` (the case
    // alloy) accepts only a listed value; anything else is REFUSED, not
    // clamped — there is no nearest alloy — and reported as `option`, so a
    // persisted key from a retired alloy, or a hostile link, is named on the
    // refused line rather than applied verbatim. Before this the type anchor
    // passed every string, which aesthetics.json's dial-colour note records as
    // the one hole a colour could live with and a pick cannot.
    if (typeof v === 'string' && options[k]) {
      if (!options[k].some((o) => o.value === v)) { out.refused.push({ path: p, why: 'option' }); continue; }
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
// died mid-build: it drops what was merged and says so, and the file's own
// values boot clean. Value-agnostic — it does not need to know WHICH value
// was lethal, only that one was.
//
// §240 Landing 3 — THE MARKER NAMES ITS LAYERS, because two things can merge
// over the file now and they belong to different people. The stored overrides
// are the viewer's own tuning; a `?aes=` link is a STRANGER'S, and it is still
// in the address bar on the next load, so a recovery that only cleared the
// store would re-apply a lethal link forever — a bricked loop reachable from a
// pasted URL, by someone who tuned nothing. So the marker records which layers
// were live ('overrides', 'link', or both joined by '+'), and recovery drops
// the MORE SPECIFIC, less trusted layer first: a death with a link live strips
// the link from the address (below, where the link is read) and keeps the
// viewer's store; if the store alone was lethal, the next death finds only
// 'overrides' and drops that. At most two dead boots, and a stranger's link
// can never cost a viewer their saved tuning. A marker written before this
// landing reads '1' and means overrides, which is all it could have meant.
let overridesDropped = false;
export let LINK_DROPPED = false;
try {
  // A trial neither reads nor clears the marker: it is the REAL session's
  // handshake, and a throwaway boot acting on it would drop the viewer's
  // tuning for a crash it did not witness (TODO 152).
  const armed = TRIAL_BOOT ? null : localStorage.getItem(BOOT_PENDING_KEY);
  if (armed) {
    localStorage.removeItem(BOOT_PENDING_KEY);
    if (armed.split('+').includes('link')) {
      LINK_DROPPED = true;
      console.warn('§240: the previous boot died before completing with a shared link\'s tuned values active — the link\'s values dropped from the address, this browser\'s own tuning kept');
    } else {
      clearOverrides();
      overridesDropped = true;
      console.warn('§23: the previous boot died before completing with tuned overrides active — overrides dropped, booting from aesthetics.json');
    }
  }
} catch { }
// The FILE's own values, snapshotted BEFORE anything merges over them. The
// header calls the file "the single source of record", and after the merge
// below that record is gone — `aestheticsData` holds the EFFECTIVE value, so
// nothing downstream can still ask what shipped. The share link needs exactly
// that question answered ("only non-default travels", §37's rule), and it is
// the one thing an in-place merge structurally cannot answer afterwards.
export const AESTHETICS_DEFAULTS = Object.freeze(structuredClone(aestheticsData));

// --- §240 Landing 2 — IMPORT A FILE. The panel's Copy JSON has an inbound
// leg: a picker takes an `aesthetics.json`, whole or a fragment, and it runs
// through THE merge above — the same type anchor, `_bounds` clamp, `_options`
// set and unknown-key refusal every stored override meets, so a file cannot
// smuggle in a value the panel would refuse. No second parser.
//
// THE BASE IS THE STORED TUNING, not the live singleton. `aestheticsData` also
// carries a shared link's values (`?aes=`), which §185 promises are NEVER
// written back; persisting the effective state would quietly break that
// promise for whoever imports while holding a link. So: the file's own
// defaults, then the overrides already in this browser (a fragment adds to a
// tuning session, it does not replace it), then the import.
//
// PERSIST, THEN RELOAD — the caller reloads, not this. A file may carry
// `dial.hourMarkers.*`, which is consumed at build time, and §23 persists
// overrides at all because a reload knob whose value dies on reload is a
// control that never visibly works. Reloading into the persisted state also
// puts the import behind §23's crash-recovery marker with nothing new: the
// boot that merges it arms the marker, and a build it kills self-heals on the
// next load. That inheritance is TESTED (tools/probe-240-import.mjs), not
// assumed.
//
// Degrade, never throw — `applyDeepLink()`'s rule for links. Every outcome is
// a status the panel can say out loud, and only 'saved' may reload: 'unsaved'
// in particular must NOT, because writeOverrides returns false on a blocked or
// full store and a reload would discard what the viewer just loaded.
export const IMPORT_REPORT_KEY = 'aestheticsImportReport';
export function importAesthetics(text) {
  let src;
  try { src = JSON.parse(text); } catch { return { status: 'notjson' }; }
  if (!src || typeof src !== 'object' || Array.isArray(src)) return { status: 'notobject' };
  const next = structuredClone(AESTHETICS_DEFAULTS);
  const stored = TRIAL_BOOT ? null : readOverrides();
  if (stored && typeof stored === 'object') mergeAesthetics(next, stored);
  const report = mergeAesthetics(next, src);
  if (!report.applied.length) return { status: 'none', report };
  if (TRIAL_BOOT || !writeOverrides(next)) return { status: 'unsaved', report };
  // The report crosses the reload in sessionStorage (this tab only) so the
  // panel can say what landed once the build has used it. Best-effort: a
  // blocked sessionStorage costs the receipt, never the import.
  try { sessionStorage.setItem(IMPORT_REPORT_KEY, JSON.stringify(report)); } catch { }
  return { status: 'saved', report };
}

// The receipt, read back on the boot the import reloaded into — or on the one
// AFTER it, if that boot died: the key is removed only by
// confirmAestheticsBoot(), so a build the import killed leaves it in place and
// the self-healing boot finds both it and the dropped marker, and can say
// WHICH tuning was dropped instead of only that one was. `dropped` is that
// case. A trial neither reads nor clears it (TODO 152's rule: a throwaway boot
// must not consume the real session's handshake).
export const IMPORT_OUTCOME = (() => {
  if (TRIAL_BOOT) return null;
  try {
    const raw = sessionStorage.getItem(IMPORT_REPORT_KEY);
    return raw ? { report: JSON.parse(raw), dropped: overridesDropped } : null;
  } catch { return null; }
})();

// --- §240 Landing 3 — A TUNED LOOK TRAVELS IN A LINK. `?aes=<pairs>`.
//
// The share case: "look what I did to the dial and the lights", pasted into a
// message, opening on a stranger's phone with no file and no install. It
// REPLACES the two one-leaf keys that came first — §185's `?dialcol=rrggbb`
// and §203's `?metal=<key>` — rather than sitting beside them, because two
// mechanisms carrying one leaf is the direction-written-twice defect: two
// parsers, two validators, two write sites, and a link that could carry the
// dial colour both ways and disagree with itself. The old keys are still READ,
// as pairs fed into this same path, so every link already shared keeps
// working; nothing writes them any more.
//
// FINISH, NOT SPEC. Everything §185 argued for the dial colour holds for the
// whole class: none of it moves a station, so none of it belongs in
// index.html's spec roster, and it is read HERE, before the build, so the
// canvas is painted and the ink asserted in the colour the viewer will see.
// Read in applyDeepLink() instead, a build-consumed leaf would silently do
// nothing — the panel lying about its own reach.
//
// WHICH LEAVES MAY TRAVEL is a list, and the list is a claim that is GATED,
// not trusted. `aesthetics.json` is on index.html's module graph, so a
// COMMITTED value runs the whole battery; a LINK value runs nothing, so a link
// may only carry what cannot move a vertex. `dial.hands.*` re-cuts hand meshes,
// `dial.hourMarkers.*` moves relief, `gong.*` rebuilds the torus — none of
// them may ride. `dial.plate.*` is left off too: its smoke has a band (§224,
// 0.75–0.90) where the reserve zones fail their legibility gate and boot
// WARNS, and a link is the one way to hand a stranger a warning they cannot
// clear. What remains is the whole of what sharing wants. The battery's
// `aestheticsShareSafe` gate boots once with EVERY leaf under this list moved
// to a non-default in-range value and holds the geometry fingerprint equal to
// the virgin boot's — §157's evidence for `recolourFace`, as a standing gate.
export const SHARE_PARAM = 'aes';
export const SHARE_SUBTREES = Object.freeze(['dial.face', 'lighting', 'rendering', 'camera', 'decoration', 'materials']);
const LEGACY_PARAMS = Object.freeze({ dialcol: 'dial.face.color', metal: 'materials.caseMetal.alloy' });
export const isShareable = (path) => SHARE_SUBTREES.some((s) => path === s || path.startsWith(`${s}.`));

// A bound before parsing, DERIVED from the schema rather than typed, because
// the first typed one was wrong: it assumed 51 leaves at ~20 characters a pair,
// and the battery's full share payload — every shareable leaf moved — measured
// 36 leaves in 1182 characters, a legitimate link one short step from its own
// refusal. The constraint is that a link written against a schema up to TWICE
// this one's shareable size must still parse (its unknown leaves are then
// refused one by one, as unknown, rather than the whole link turned away), and
// that every pair may be as long as the longest shareable path plus the
// longest number JavaScript prints (24 characters, `-1.2345678901234567e-308`).
// Past that the payload is not a tuning — it is someone probing the parser —
// and it is refused whole, before any of it is read.
const SHARE_LEAVES = (() => {
  const out = [];
  const walk = (o, path) => {
    for (const k of Object.keys(o)) {
      if (k.startsWith('_')) continue;
      const at = path ? `${path}.${k}` : k;
      if (o[k] && typeof o[k] === 'object') walk(o[k], at);
      else if (isShareable(at)) out.push(at);
    }
  };
  walk(AESTHETICS_DEFAULTS, '');
  return Object.freeze(out);
})();
const JS_NUMBER_MAX_CHARS = 24;   // '-1.2345678901234567e-308': sign, 17 significant digits, point, 'e-308'
export const SHARE_MAX_PAIRS = 2 * SHARE_LEAVES.length;
export const SHARE_MAX_CHARS = SHARE_MAX_PAIRS * (Math.max(...SHARE_LEAVES.map((p) => p.length)) + 1 + JS_NUMBER_MAX_CHARS + 1);

// WIRE FORMAT: `pair ("," pair)*`, `pair = dotpath "~" value`. DOT PATHS, not
// indices — insert a leaf and every index-keyed link ever shared would apply
// the wrong values to the wrong knobs, clamped and type-checked and therefore
// PLAUSIBLE; a path is self-describing, and a reader can see what a link will
// do before opening it. `~` and `.` are RFC 3986 unreserved, so both are legal
// raw in a query — but URLSearchParams serialises form-style and DOES escape
// `~` (as %7E; the plan assumed it would not, and the first link built read
// `dial.face.color%7E1b3a5c`), so currentViewLink un-escapes it beside the
// commas it already puts back. The reader takes either spelling.
// DIFF ONLY against the shipped file, so a later default improvement still
// reaches the recipient instead of being pinned at the sender's base.
// Uncompressed: at diff scale a CompressionStream measured 70 characters
// against 62 raw.
//
// `#` MUST NEVER APPEAR — it ends the query and starts a fragment, silently
// truncating the payload. Colours are written without it and re-anchored on
// read, where the file's own value (a '#rrggbb' string) says a leaf is one.
const leafAt = (obj, path) => path.split('.').reduce((o, k) => (o && typeof o === 'object' && !k.startsWith('_') ? o[k] : undefined), obj);
const isColourLeaf = (v) => typeof v === 'string' && v.startsWith('#');

export function encodeShare(effective, defaults = AESTHETICS_DEFAULTS) {
  const pairs = [];
  const walk = (e, d, path) => {
    for (const k of Object.keys(d)) {
      if (k.startsWith('_')) continue;
      const at = path ? `${path}.${k}` : k;
      if (d[k] && typeof d[k] === 'object') {
        if (isShareable(at) || SHARE_SUBTREES.some((s) => s.startsWith(`${at}.`))) walk(e?.[k] ?? {}, d[k], at);
        continue;
      }
      if (!isShareable(at) || e?.[k] === undefined || e[k] === d[k]) continue;
      const v = e[k];
      const text = isColourLeaf(d[k]) ? String(v).replace(/^#/, '') : String(v);
      if (/[,~#&]/.test(text)) continue;   // unencodable: a value the wire cannot carry stays home
      pairs.push(`${at}~${text}`);
    }
  };
  walk(effective, defaults, '');
  return pairs.length ? pairs.join(',') : null;
}

// Parse a query into a merge SOURCE plus what was refused before the merge
// saw it. Typed by the FILE's value at that path — the merge's own type anchor
// then refuses what this let through, so there is one set of rules; this only
// turns text into the type the anchor will judge. A pair outside
// SHARE_SUBTREES is refused 'notshareable' here, which is the line that keeps
// geometry off links whatever a sender types.
export function decodeShare(search, defaults = AESTHETICS_DEFAULTS) {
  const q = new URLSearchParams(search);
  const raw = [];
  for (const [key, path] of Object.entries(LEGACY_PARAMS)) {
    const v = q.get(key);
    if (v !== null) raw.push([path, v.trim()]);
  }
  const aes = q.get(SHARE_PARAM);
  if (aes !== null) {
    if (aes.length > SHARE_MAX_CHARS || aes.split(',').length > SHARE_MAX_PAIRS) {
      return { src: null, refused: [{ path: SHARE_PARAM, why: 'oversize' }], pairs: 0 };
    }
    for (const pair of aes.split(',')) {
      if (!pair) continue;
      const i = pair.indexOf('~');
      raw.push(i < 0 ? [pair, undefined] : [pair.slice(0, i), pair.slice(i + 1)]);
    }
  }
  if (!raw.length) return null;
  const src = {};
  const refused = [];
  for (const [path, text] of raw) {
    if (!isShareable(path)) { refused.push({ path, why: 'notshareable' }); continue; }
    const d = leafAt(defaults, path);
    if (d === undefined || (d && typeof d === 'object')) { refused.push({ path, why: 'unknown' }); continue; }
    if (text === undefined) { refused.push({ path, why: 'type' }); continue; }
    let v;
    if (typeof d === 'number') { v = Number(text); if (text === '' || Number.isNaN(v)) v = undefined; }   // unparseable is a TYPE refusal; ±Infinity reaches the merge's 'nonfinite'
    else if (typeof d === 'boolean') v = text === 'true' ? true : text === 'false' ? false : undefined;
    else if (isColourLeaf(d)) v = parseDialCol(text) ?? undefined;
    else v = text;
    if (v === undefined) { refused.push({ path, why: 'type' }); continue; }
    const keys = path.split('.');
    let o = src;
    for (const k of keys.slice(0, -1)) o = (o[k] ??= {});
    o[keys.at(-1)] = v;   // a later pair for the same path wins: `aes` is read after the legacy keys
  }
  return { src, refused, pairs: raw.length };
}

// Six hex digits, '#' optional, lower-cased — the colour validator, kept from
// §185 because the merge cannot do it: it is TYPE-anchored, a colour is a
// string, and every string passes. A URL is untrusted input.
export function parseDialCol(raw) {
  if (typeof raw !== 'string') return null;
  const m = /^#?([0-9a-fA-F]{6})$/.exec(raw.trim());
  return m ? `#${m[1].toLowerCase()}` : null;
}

// Take the link's parameters out of the address without a navigation — the
// crash recovery above calls this when a link's values killed the previous
// boot. replaceState, never pushState: the back button must not lead into it.
export function stripLinkParams() {
  if (typeof location === 'undefined' || typeof history === 'undefined') return;
  const q = new URLSearchParams(location.search);
  let hit = false;
  for (const k of [SHARE_PARAM, ...Object.keys(LEGACY_PARAMS)]) if (q.has(k)) { q.delete(k); hit = true; }
  if (!hit) return;
  const s = q.toString().replace(/%2C/g, ',');
  history.replaceState(history.state, '', `${location.pathname}${s ? `?${s}` : ''}${location.hash}`);
}

// THE MERGES, in precedence order: the file < this browser's overrides < the
// link. The link is the more specific claim — §37's reasoning for `?cam` over
// `?preset` — and §97's rule besides: a recipient with their own saved colour
// would otherwise see a different watch from the one that was sent, with
// nothing on screen saying so. But the link is NEVER WRITTEN BACK: it shows
// someone a watch, it does not edit their preferences, so the store is
// untouched and their own tuning is back on the next visit without the param
// (the import above builds on the store, not on the effective state, for the
// same reason). Both layers arm the marker, named — see CRASH RECOVERY.
//
// LINK_OUTCOME is what the receipt says: how many values the link carried and
// what the merge did with them. `DIAL_INK_CONTRAST_MIN` is warn-only and
// colours carry no `_bounds` by design, so that receipt is the only thing on
// screen telling a recipient their watch is not the shipped one.
export let LINK_OUTCOME = null;
try {
  const layers = [];
  const over = TRIAL_BOOT ? null : readOverrides();   // TODO 152: a trial boots the file
  if (over) { mergeAesthetics(aestheticsData, over); layers.push('overrides'); }
  // The recovery above only NAMES a lethal link (these declarations are below
  // it, in their temporal dead zone when it runs); the address is cleaned
  // here, before the decode, so the dead link is never read again.
  if (LINK_DROPPED) stripLinkParams();
  const link = TRIAL_BOOT || typeof location === 'undefined' ? null : decodeShare(location.search);   // TODO 152: and the file's finish, not the parent's link
  if (link) {
    const report = link.src ? mergeAesthetics(aestheticsData, link.src) : { applied: [], refused: [], clamped: [] };
    report.refused.unshift(...link.refused);
    LINK_OUTCOME = { pairs: link.pairs, ...report };
    if (report.applied.length) layers.push('link');
  }
  if (layers.length) localStorage.setItem(BOOT_PENDING_KEY, layers.join('+'));
} catch { /* corrupt overrides or a hostile link must never brick boot */ }

// Called by main.js when the build has completed — the crash-recovery
// marker's other half.
export function confirmAestheticsBoot() {
  if (TRIAL_BOOT) return;   // TODO 152: a trial never armed it, and must not clear the real session's
  try { localStorage.removeItem(BOOT_PENDING_KEY); } catch { }
  try { sessionStorage.removeItem(IMPORT_REPORT_KEY); } catch { }   // §240: the build survived the import; its receipt has been read
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
