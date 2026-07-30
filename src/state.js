// State persistence. Primary store is the dev server's /__state endpoint,
// which keeps the JSON in a TEMP FILE on disk (see dev_server.py) so state
// survives refreshes, browser restarts and cache clears. When that endpoint
// isn't there (plain static server), everything falls back to localStorage
// transparently. loadState() is async (fetch); save/clear/has stay sync for
// the UI's sake — saves are fire-and-forget PUTs.
const STORAGE_KEY = 'timesim-state';
const STATE_URL = '/__state';

// §33 (trial boot) — a page loaded with ?trial=1 is a THROWAWAY VERDICT
// BOOT: reconfigure mode loads a candidate spec in a hidden iframe purely
// to read its boot asserts. A trial must neither WRITE the session's state
// (a fire-and-forget PUT from the iframe would clobber the real session's
// /__state) nor READ it (a virgin boot is the battery's own standard for a
// verdict, and it keeps trials deterministic). One flag, guarded at this
// choke point so no caller can forget.
const TRIAL_BOOT = typeof location !== 'undefined'
  && new URLSearchParams(location.search).has('trial');

// Only dev_server.py serves /__state, and it is documented to run on loopback
// (README: `python3 dev_server.py 8347`). Anywhere else — a plain static
// server, GitHub Pages — every request to it is a guaranteed 404, and a GET
// 404 does NOT clear the flag below (only a thrown fetch does), so the failed
// GET is followed by a failed PUT: two console errors on every single load of
// a published build, which reads as a broken app to anyone who opens devtools.
// Start pessimistic off-loopback and never make the requests at all.
//
// Trade-off: serving dev_server.py on a LAN address to test on a phone now
// uses localStorage rather than the server's state file. State still persists,
// just per-browser instead of shared.
const LOOPBACK = ['localhost', '127.0.0.1', '::1', '[::1]'];
let serverAvailable = LOOPBACK.includes(location.hostname);
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
  soundOn: false,     // sound toggle — captureState() emits it, so it must round-trip
  alarmOn: false,     // alarm armed toggle (§24)
  // Raw alarm-crown drag angle (§24). Persisting the RAW input, not the target,
  // keeps Rule 2: the detented disc angle and alarmTargetSeconds re-derive from
  // it deterministically, so a reload lands on the exact same detent.
  alarmCrownRotation: 0,
  alarmSetRot: 0,
  alarmCrownOut: false,
  alarmBarrelWind: 8, // alarm-spring energy in turns (§24); = ALARM_BARREL_TURNS at full wind
  quality: 'Auto',    // §14 quality select — the panel's choice (Auto or a pinned tier), so an
                      // override survives reload; Auto's own tier verdict is re-earned each boot
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
    soundOn: state.soundOn,
    alarmOn: state.alarmOn,
    alarmCrownRotation: state.alarmCrownRotation,
    alarmSetRot: state.alarmSetRot,
    alarmCrownOut: state.alarmCrownOut,
    alarmBarrelWind: state.alarmBarrelWind,
    quality: state.quality,
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
  if (TRIAL_BOOT) return { ...defaultState }; // trial: virgin defaults, the verdict standard
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
  if (TRIAL_BOOT) return true; // trial: NEVER write the real session's state
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
  if (TRIAL_BOOT) return true; // trial: hands off the real session's state
  known = false;
  if (serverAvailable) fetch(STATE_URL, { method: 'DELETE' }).catch(() => {});
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* no-op */ }
  return true;
}

export function hasState() {
  return known;
}
