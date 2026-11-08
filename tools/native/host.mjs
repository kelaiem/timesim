// §338 landing 1 — THE NATIVE HOST: boot src/main.js, unchanged, in a runtime
// that is not a browser.
//
//   node --import ./tools/native/loader.mjs your-tool.mjs
//   import { bootNative } from './tools/native/host.mjs';
//   const { clock, ms, warns, touched } = await bootNative({ query: 'vph=21600' });
//
// WHY THIS IS SMALL. Measured before it was written (§338's record): of
// main.js's ~390 browser references, about two sit in the 40,000 lines that cut
// the metal; the rest are the HUD, the chrome and the loop, after the build. So
// the host does not cut main.js apart. It answers the page's questions with
// inert stand-ins and the build runs as written. Run with no stand-ins at
// all, the first thing that broke was line 48,774 of 66,104, past every part.
//
// WHAT IT STANDS IN FOR, and what each stand-in means for a measurement:
//
// - the GPU: tools/native/three-headless.mjs (a renderer and a PMREM that draw
//   nothing). No part's geometry reads either.
// - the DOM: every element is one forgiving object that accepts every write
//   and answers every read with an empty value (a 1000×700 box for layout
//   reads). The chrome is BUILT against it and measures nothing; that is the
//   browser battery's job (boot silence on a real page, chrome coverage,
//   offline, boot-yield, screenshots), and this host never claims it.
// - a 2D canvas: getContext answers null. The one build-time canvas reader,
//   geometry.js' strokeEmOf, then reports "no measurement", and §293/§332
//   already made that term PAINT-only, so it cannot move metal.
// - the network: `/__state` answers 404 (a virgin boot, the battery's
//   virginBoot rule) and so does `version.json`. Any other fetch THROWS, because
//   a build that fetched something new would otherwise boot here on a 404 and
//   look healthy.
// - the clock's FRAMES: requestAnimationFrame never fires. The page's loop
//   advances τ and draws; the battery poses through setPose and holds the
//   sweep hold, so no check needs a frame. That is a DIFFERENCE from the page,
//   and §338 measured it: the page's first frames build bounds trees (103 on
//   the default build) that reorder those geometries' index buffers in place,
//   so §152's SHAPE digest, which hashes the live index, is not comparable
//   across the two hosts even where the metal is identical.
// - the maths: src/det-math-boot.js, imported by installHost before main.js is,
//   exactly as the page's entry imports it first (§338 landing 2).
//   `detMath: false` leaves the engine's own Math in place. It exists for ONE
//   caller, tools/probe-338-native-boot.mjs' control, which must see the metal
//   diverge and main.js warn without it; a build booted that way is not the
//   build and says so at boot.
// - the spec: src/spec-fields.js' publishSpec over `query`, the same table
//   index.html now imports, so the two hosts cannot read different rosters.
//
// `touched` counts the stand-ins that were actually exercised (fetches by URL,
// canvas contexts), so a host change that starts serving something new shows
// up as a number rather than as a silently different boot.
import { publishSpec } from '../../src/spec-fields.js';

const touched = new Map();
const hit = (k) => touched.set(k, (touched.get(k) || 0) + 1);

const EMPTY_READS = new Set(['textContent', 'innerHTML', 'innerText', 'outerHTML', 'value', 'id', 'className',
  'nodeValue', 'title', 'placeholder', 'href', 'src', 'lang', 'dir']);
const ZERO_LISTS = new Set(['querySelectorAll', 'getElementsByTagName', 'getElementsByClassName', 'getElementsByName']);
const BOX = { left: 0, top: 0, right: 1000, bottom: 700, x: 0, y: 0, width: 1000, height: 700 };

function makeElement(tag = 'div') {
  const own = {
    tagName: String(tag).toUpperCase(),
    nodeName: String(tag).toUpperCase(),
    style: new Proxy({}, { get: (o, k) => (k in o ? o[k] : (k === 'setProperty' || k === 'removeProperty' ? () => '' : '')), set: (o, k, v) => { o[k] = v; return true; } }),
    dataset: {},
    children: [], childNodes: [], attributes: [],
    classList: { add() {}, remove() {}, toggle() { return false; }, contains: () => false, replace() {} },
  };
  const self = new Proxy(function element() {}, {
    get(_, k) {
      if (k in own) return own[k];
      if (k === Symbol.toPrimitive) return () => '';
      if (k === Symbol.iterator) return [][Symbol.iterator].bind([]);
      if (k === 'then') return undefined;                       // never a thenable: `await el` must not hang
      if (k === 'getContext') return (kind) => { hit(`canvas.getContext(${kind})`); return null; };
      if (k === 'getBoundingClientRect') return () => ({ ...BOX });
      if (k === 'querySelector' || k === 'closest' || k === 'getElementById') return () => makeElement();
      if (ZERO_LISTS.has(k)) return () => [];
      if (EMPTY_READS.has(k)) return '';
      if (k === 'clientWidth' || k === 'offsetWidth' || k === 'width' || k === 'scrollWidth') return BOX.width;
      if (k === 'clientHeight' || k === 'offsetHeight' || k === 'height' || k === 'scrollHeight') return BOX.height;
      if (k === 'parentNode' || k === 'parentElement' || k === 'firstChild' || k === 'lastChild') return null;
      if (k === 'isConnected' || k === 'hidden' || k === 'checked' || k === 'disabled') return false;
      return () => makeElement();                              // any method: accept, answer an element
    },
    set(_, k, v) { own[k] = v; return true; },
    apply() { return makeElement(); },
  });
  return self;
}

let installed = false;
export async function installHost({ query = '', width = 1000, height = 700, detMath = true } = {}) {
  if (installed) throw new Error('installHost: one host per process (main.js is a module and evaluates once)');
  installed = true;
  BOX.right = BOX.width = width; BOX.bottom = BOX.height = height;
  const g = globalThis;
  const docRoot = makeElement('#document');
  g.document = new Proxy(docRoot, {
    get(t, k) {
      if (k === 'createElement' || k === 'createElementNS') return (a, b) => makeElement(b ?? a);
      if (k === 'createTextNode' || k === 'createDocumentFragment') return () => makeElement('#text');
      if (k === 'documentElement' || k === 'body' || k === 'head') return makeElement(k);
      if (k === 'readyState') return 'complete';
      if (k === 'visibilityState') return 'visible';
      if (k === 'hidden' || k === 'fullscreenElement' || k === 'activeElement') return k === 'hidden' ? false : null;
      if (k === 'fonts') return { ready: Promise.resolve(), check: () => true, load: async () => [] };
      return t[k];
    },
  });
  g.window = g; g.self = g;
  g.innerWidth = width; g.innerHeight = height; g.devicePixelRatio = 1;
  g.addEventListener = () => {}; g.removeEventListener = () => {}; g.dispatchEvent = () => true;
  g.matchMedia = () => ({ matches: false, media: '', addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  const q = query && !query.startsWith('?') ? `?${query}` : query;
  // The battery's own origin (a loopback dev server), so state.js takes the
  // path virginBoot does: it asks the server for /__state and gets a 404.
  const loc = new URL(`http://127.0.0.1:8347/index.html${q}`);
  g.location = { href: loc.href, search: loc.search, pathname: loc.pathname, origin: loc.origin, hash: '',
    host: loc.host, hostname: loc.hostname, port: loc.port, protocol: loc.protocol,
    reload() { throw new Error('native host: location.reload() — the build asked to reload'); },
    assign() {}, replace() {} };
  g.history = { replaceState() {}, pushState() {}, back() {}, state: null };
  const store = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear(), key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; } }; };
  g.localStorage = store(); g.sessionStorage = store();
  Object.defineProperty(g, 'navigator', { configurable: true, value: { userAgent: 'timesim-native', language: 'en', languages: ['en'], hardwareConcurrency: 1, maxTouchPoints: 0, onLine: false, platform: 'native' } });
  g.requestAnimationFrame = () => 0;          // no frames: see the header
  g.cancelAnimationFrame = () => {};
  g.getComputedStyle = () => new Proxy({}, { get: (o, k) => (k === 'getPropertyValue' ? () => '' : '') });
  for (const n of ['ResizeObserver', 'MutationObserver', 'IntersectionObserver']) g[n] = class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } };
  g.Image = class { constructor() { this.complete = false; } set src(v) { hit(`Image ${v}`); } };
  for (const n of ['HTMLElement', 'HTMLCanvasElement', 'HTMLInputElement', 'HTMLSelectElement', 'Element', 'Node', 'Event', 'KeyboardEvent', 'PointerEvent']) if (!(n in g)) g[n] = class {};
  if (!('CustomEvent' in g)) g.CustomEvent = class { constructor(t, o) { this.type = t; this.detail = o?.detail; } };
  g.fetch = async (u) => {
    const url = String(u);
    hit(`fetch ${url}`);
    if (url === '/__state' || url.endsWith('/__state') || url === 'version.json' || url.endsWith('/version.json')) {
      return { ok: false, status: 404, json: async () => { throw new Error('404'); }, text: async () => '' };
    }
    throw new Error(`native host: unexpected fetch ${url} — the build reads something new; serve it or say why it may 404`);
  };
  publishSpec(loc.search, g);
  if (detMath) await import('../../src/det-math-boot.js');
}

// Boot the build. Resolves once main.js has evaluated and published __clock;
// rejects with the build's own fatal error (TODO 30's surface) otherwise.
export async function bootNative(opts = {}) {
  await installHost(opts);
  const t0 = performance.now();
  await import('../../src/main.js');
  const ms = performance.now() - t0;
  const g = globalThis;
  if (!g.__clock) throw new Error(`native host: main.js evaluated without publishing __clock${g.__bootError ? `: ${g.__bootError.message}` : ''}`);
  return { clock: g.__clock, ms, warns: (g.__clock.buildWarns || []).slice(), touched: Object.fromEntries(touched) };
}
