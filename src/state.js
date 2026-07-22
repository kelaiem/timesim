// State persistence. Primary store is the dev server's /__state endpoint,
// which keeps the JSON in a TEMP FILE on disk (see dev_server.py) so state
// survives refreshes, browser restarts and cache clears. When that endpoint
// isn't there (plain static server), everything falls back to localStorage
// transparently. loadState() is async (fetch); save/clear/has stay sync for
// the UI's sake — saves are fire-and-forget PUTs.
const STORAGE_KEY = 'timesim-state';
const STATE_URL = '/__state';

let serverAvailable = true; // optimistic until a request proves otherwise
let known = false;          // does a saved state currently exist (either store)?

const defaultState = {
  barrelWindTurns: 3.75,
  tauIntegrated: 0,
  crownRotation: 0,
  // The jumper's folded snap correction. crownRotation alone restores the
  // RAW setting input; without this the quantized part of it is lost and a
  // reload moves the hands by up to half a minute (and un-syncs a clock that
  // was synced to the wall clock — see BUILT §9).
  jumpCorr: 0,
  crownOut: false,
  fastForward: false,
  timeScale: 1, // real time — matches main.js's own default
  showLabels: false,
  plateXray: false,   // three-quarter plate see-through (UI toggle)
  showBeat: 0,
  // Camera pose: position + orbit target, both in world coordinates. null
  // means "no saved camera" — the caller keeps its default framing.
  camera: null,
};

function sanitize(state) {
  return {
    barrelWindTurns: state.barrelWindTurns,
    tauIntegrated: state.tauIntegrated,
    crownRotation: state.crownRotation,
    jumpCorr: state.jumpCorr,
    crownOut: state.crownOut,
    fastForward: state.fastForward,
    timeScale: state.timeScale,
    showLabels: state.showLabels,
    plateXray: state.plateXray,
    showBeat: state.showBeat,
    camera: state.camera,
  };
}

function loadLocal() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    known = stored !== null;
    return stored ? { ...defaultState, ...JSON.parse(stored) } : { ...defaultState };
  } catch (e) {
    console.error('Failed to load state:', e);
    known = false;
    return { ...defaultState };
  }
}

export async function loadState() {
  if (serverAvailable) {
    try {
      const r = await fetch(STATE_URL, { cache: 'no-store' });
      if (r.ok) {
        known = true;
        return { ...defaultState, ...(await r.json()) };
      }
      // 404 = endpoint alive but no state saved yet — OR a plain static
      // server that 404s everything unknown. Either way localStorage is the
      // only other place state could be; a later PUT settles which we're on.
    } catch (e) {
      serverAvailable = false;
    }
  }
  return loadLocal();
}

export function saveState(state) {
  const body = JSON.stringify(sanitize(state));
  known = true;
  if (serverAvailable) {
    fetch(STATE_URL, { method: 'PUT', body }).then((r) => {
      if (!r.ok) throw new Error(`PUT /__state ${r.status}`);
    }).catch(() => {
      // Static server (405/501) or network hiccup — switch to localStorage.
      serverAvailable = false;
      try { localStorage.setItem(STORAGE_KEY, body); } catch (e) { console.error('Failed to save state:', e); }
    });
    return true;
  }
  try {
    localStorage.setItem(STORAGE_KEY, body);
    return true;
  } catch (e) {
    console.error('Failed to save state:', e);
    return false;
  }
}

export function clearState() {
  known = false;
  if (serverAvailable) fetch(STATE_URL, { method: 'DELETE' }).catch(() => {});
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* no-op */ }
  return true;
}

export function hasState() {
  return known;
}
