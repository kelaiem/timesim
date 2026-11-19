// §349 landing 1 — THE USAGE TALLY, the pure half. A visitor's own record of
// which features they used, which they can read in full and send by their own
// hand. The app transmits nothing: this module has no I/O at all, and the DOM
// half (src/usage-ui.js) only ever copies the report to the clipboard.
//
// THE PRIVACY PROPERTY IS STRUCTURE, not care. USAGE_FEATURES is the only list
// of things that can be counted, and mark() refuses anything else, so the
// tally cannot hold free text, a URL, a part name or any value nobody listed.
// A row records a VALUE only when it declares `values: 'options'` and the
// caller hands one in from a <select> whose own option list contains it (the
// owner's ruling, 2026-11-18: a spec field reports its name only, unless its
// value was chosen from a dropdown). The option list is read off the control
// at the moment of choice, never typed here, so a typed or dragged quantity
// can never reach a report.
//
// A feature counts ONCE PER SESSION (one page load). The number beside a key
// is "sessions that used it", not clicks: click counts say how fidgety a
// visitor is and make the tally a finer fingerprint for no gain.
//
// Keys are PERMANENT, like deep-link parameters: a renamed key splits its
// history, so a retired one stays in the table marked `retired` and is never
// reused for something else.

import { SPEC_FIELDS } from './spec-fields.js';

// How a feature was reached. One letter each so a report row stays short.
export const VIA = Object.freeze({
  c: 'a panel control',
  g: 'a gesture on the watch',
  k: 'a keyboard shortcut',
  l: 'a link that opened the page',
});

// The groups, in report order.
export const GROUPS = Object.freeze(['view', 'camera', 'guided', 'explore', 'operate', 'alarm', 'build', 'appearance']);

const row = (key, group, extra = {}) => Object.freeze({ key, group, ...extra });

// The spec fields a deep link can carry, one row each. A link records the
// NAME only (values are never read off a URL). The six that also have a
// dropdown in the panel take their value from it (`values: 'options'`).
const SPEC_DROPDOWNS = new Set(['vph', 'reserveh', 'studr', 'case', 'alarm', 'strap']);
const SPEC_ROWS = Object.keys(SPEC_FIELDS).map((k) =>
  row(`spec:${k}`, 'build', SPEC_DROPDOWNS.has(k) ? { values: 'options' } : {}));

export const USAGE_FEATURES = Object.freeze([
  // view — the View panel's toggles and the scene overlays
  row('xray', 'view'), row('schematic', 'view'), row('replay', 'view'), row('case', 'view'),
  row('labels', 'view'), row('sound', 'view'), row('selfie', 'view'), row('selfieSharp', 'view'),
  row('explode', 'view'), row('drill', 'view'), row('hud', 'view'), row('measure', 'view'),
  row('powerflow', 'view'), row('lifesize', 'view'), row('copyView', 'view'),
  // camera — the five presets, by their canonical data-cam names
  row('cam:Escapement', 'camera'), row('cam:Train', 'camera'), row('cam:Dial', 'camera'),
  row('cam:Setting', 'camera'), row('cam:Free', 'camera'),
  // guided — the scripted runs
  row('tour:started', 'guided'), row('tour:finished', 'guided'), row('demo', 'guided'),
  row('inspect', 'guided'), row('bench', 'guided'), row('coupling', 'guided'), row('link', 'guided'),
  // explore — looking at parts. WHICH part is never recorded: a list of the
  // parts someone looked at is a browsing trail, and the ask was features.
  row('focus', 'explore'), row('unit', 'explore'), row('explore', 'explore'), row('route', 'explore'),
  // operate — the going train's inputs
  row('pause', 'operate'), row('timeScale', 'operate'), row('wind', 'operate'), row('crownOut', 'operate'),
  row('setHands', 'operate'), row('sync', 'operate'), row('swing', 'operate'),
  row('fastForward', 'operate'), row('position', 'operate', { values: 'options' }),
  // alarm
  row('alarmArm', 'alarm'), row('alarmCycle', 'alarm'), row('alarmSet', 'alarm'), row('alarmCrownOut', 'alarm'),
  // build — reconfigure and the spec
  row('reconf', 'build'), ...SPEC_ROWS,
  // appearance — the finish controls, one row: which knob is not the question
  row('appearance', 'appearance'), row('quality', 'appearance', { values: 'options' }),
]);

export const FEATURE = new Map(USAGE_FEATURES.map((r) => [r.key, r]));
if (FEATURE.size !== USAGE_FEATURES.length) throw new Error('usage: a key appears twice in USAGE_FEATURES');
for (const r of USAGE_FEATURES) if (!GROUPS.includes(r.group)) throw new Error(`usage: ${r.key} names no group`);

// Deep-link parameter NAMES that reach a feature. Values are never read.
// Every SPEC_FIELDS key is added below as `spec:<key>`.
export const LINK_PARAMS = Object.freeze({
  xray: 'xray', schematic: 'schematic', labels: 'labels', explode: 'explode', powerflow: 'powerflow',
  lifesize: 'lifesize', hud: 'hud', focus: 'focus', unit: 'unit', scale: 'timeScale',
  position: 'position', crown: 'crownOut', reconf: 'reconf', bench: 'bench', demo: 'demo',
  inspect: 'inspect', cycle: 'alarmCycle',
  ...Object.fromEntries(Object.keys(SPEC_FIELDS).map((k) => [k, `spec:${k}`])),
});
for (const [p, k] of Object.entries(LINK_PARAMS)) if (!FEATURE.has(k)) throw new Error(`usage: link param ${p} names no row (${k})`);

// A value is a dropdown's canonical option value. '' (the "as designed"
// option of several spec selects) is written `default` so the row stays
// readable; anything outside the grammar's value alphabet is refused.
const VALUE_RE = /^[A-Za-z0-9._-]{1,24}$/;
export const normValue = (v) => (v === '' ? 'default' : String(v));

// A tally: key -> { via: Set, values: Map(value -> Set(via)) } for THIS
// session. `stored` (landing 2's remember-on-this-device) will carry earlier
// sessions; landing 1 always starts empty.
export function createTally() {
  const used = new Map();
  return {
    // Returns true when the mark was taken. A key not in the table, a via not
    // in VIA, or a value on a row that takes none is REFUSED and changes
    // nothing. `options` is the dropdown's own option-value list: the value
    // must be on it.
    mark(key, via, value, options) {
      const r = FEATURE.get(key);
      if (!r || r.retired || !Object.hasOwn(VIA, via)) return false;
      let e = used.get(key);
      if (!e) { e = { via: new Set(), values: new Map() }; used.set(key, e); }
      e.via.add(via);
      if (value !== undefined && r.values === 'options' && Array.isArray(options) && options.includes(value)) {
        const v = normValue(value);
        if (VALUE_RE.test(v)) {
          if (!e.values.has(v)) e.values.set(v, new Set());
          e.values.get(v).add(via);
        }
      }
      return true;
    },
    has(key) { return used.has(key); },
    keys() { return [...used.keys()]; },
    entries() { return used; },
    clear() { used.clear(); },
  };
}

// THE REPORT. It is plain text, and the text IS the payload: what the visitor
// reads in the preview is what is sent, character for character. One header
// line of build facts, one line of counts, then one line per group with
// anything in it:
//
//   timesim usage report 1
//   build=1.42.0 env=production locale=de renderer=hardware tier=High viewport=desktop
//   sessions=1 since=2026-11 explored=9/88
//   view: xray 1 c,l | schematic 1 c
//   build: spec:case=tonneau 1 c
//
// Unexplored features are not listed; the tally tool derives them from the
// named build's table. A key with a recorded value is written key=value, one
// item per value; its bare key item is written too when it was also reached
// without a value (a link names the field only).
export const REPORT_FORMAT = 1;
export const HEADER_FIELDS = Object.freeze(['build', 'env', 'locale', 'renderer', 'tier', 'viewport']);
const HEADER_VALUE_RE = /^[A-Za-z0-9._-]{1,32}$/;

const viaList = (set) => Object.keys(VIA).filter((v) => set.has(v)).join(',');

export function formatReport(tally, header = {}, { sessions = 1, since } = {}) {
  const lines = [`timesim usage report ${REPORT_FORMAT}`];
  lines.push(HEADER_FIELDS.map((f) => {
    const v = header[f] == null ? 'unknown' : String(header[f]);
    return `${f}=${HEADER_VALUE_RE.test(v) ? v : 'unknown'}`;
  }).join(' '));
  const used = tally.entries();
  const live = USAGE_FEATURES.filter((r) => !r.retired);
  lines.push(`sessions=${sessions} since=${since || 'unknown'} explored=${used.size}/${live.length}`);
  for (const g of GROUPS) {
    const items = [];
    for (const r of live) {
      if (r.group !== g || !used.has(r.key)) continue;
      const e = used.get(r.key);
      const bare = new Set(e.via);
      for (const [v, vias] of e.values) {
        // 1: this session's tally. Landing 2's remembered tally carries the
        // count of earlier sessions per key; until then every row reads 1.
        items.push(`${r.key}=${v} 1 ${viaList(vias)}`);
        for (const x of vias) bare.delete(x);
      }
      if (bare.size || !e.values.size) items.push(`${r.key} 1 ${viaList(bare.size ? bare : e.via)}`);
    }
    if (items.length) lines.push(`${g}: ${items.join(' | ')}`);
  }
  return lines.join('\n') + '\n';
}

// Parse a report back. STRICT: a line outside the grammar is returned in
// `refused` rather than guessed at, because a pasted report is untrusted text
// (landing 2's tally tool reads public discussions). Unknown keys are refused
// too, so a report from a later build reads as partly refused, never misread.
export function parseReport(text) {
  const out = { format: null, header: {}, sessions: null, since: null, explored: null, items: [], refused: [] };
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n').map((l) => l.trim()).filter(Boolean);
  for (const [i, l] of lines.entries()) {
    let m;
    if (i === 0 && (m = /^timesim usage report (\d+)$/.exec(l))) { out.format = Number(m[1]); continue; }
    if (/^build=/.test(l)) {
      for (const pair of l.split(' ')) {
        const [k, v] = pair.split('=');
        if (HEADER_FIELDS.includes(k) && HEADER_VALUE_RE.test(v || '')) out.header[k] = v;
        else out.refused.push(pair);
      }
      continue;
    }
    if ((m = /^sessions=(\d+) since=(\d{4}-\d{2}|unknown) explored=(\d+)\/(\d+)$/.exec(l))) {
      out.sessions = Number(m[1]); out.since = m[2]; out.explored = [Number(m[3]), Number(m[4])];
      continue;
    }
    if ((m = /^([a-z]+): (.+)$/.exec(l)) && GROUPS.includes(m[1])) {
      for (const item of m[2].split(' | ')) {
        const im = /^([A-Za-z0-9:]+)(?:=([A-Za-z0-9._-]{1,24}))? (\d+) ([a-z](?:,[a-z])*)$/.exec(item);
        const r = im && FEATURE.get(im[1]);
        if (!r || r.group !== m[1] || (im[2] !== undefined && r.values !== 'options') ||
            !im[4].split(',').every((v) => Object.hasOwn(VIA, v))) { out.refused.push(item); continue; }
        out.items.push({ key: im[1], value: im[2], sessions: Number(im[3]), via: im[4].split(',') });
      }
      continue;
    }
    out.refused.push(l);
  }
  return out;
}

// The month a tally started, UTC, no day: the report never carries a time
// finer than that.
export const monthOf = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
