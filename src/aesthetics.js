import aestheticsData from './aesthetics.json' with { type: 'json' };

// §23: session overrides. The advanced panel writes tuned values here; some
// (subdial size, marker geometry) are consumed at BUILD time, and a reload
// knob whose value dies on reload is a control that never visibly works. So
// the tuned state is merged over the file at load. The FILE stays the single
// source of record — the panel's Copy JSON is how a tuning session becomes a
// commit, and Reset clears the overrides.
// CRASH RECOVERY, before anything merges. Overrides persist, so a value that
// breaks the BUILD would crash every subsequent boot with the panel that could
// reset it never appearing — a bricked loop reachable from a slider. So the
// merge arms a pending marker, and main.js confirms it once the build
// completes. A load that finds the marker still armed knows the previous boot
// died mid-build: it drops the overrides and says so, and the file's own
// values boot clean. Value-agnostic — it does not need to know WHICH value
// was lethal, only that one was.
try {
  if (localStorage.getItem('aestheticsBootPending')) {
    localStorage.removeItem('aestheticsOverrides');
    localStorage.removeItem('aestheticsBootPending');
    console.warn('§23: the previous boot died before completing with tuned overrides active — overrides dropped, booting from aesthetics.json');
  }
} catch { }
try {
  const raw = localStorage.getItem('aestheticsOverrides');
  if (raw) {
    // Clamp against the schema's own _bounds while merging, so a stale
    // override (or a hand-edited one) cannot smuggle in a value the panel
    // would refuse. Bounds live in the FILE next to the values they bound,
    // with their constraints in the comment — the same single source.
    const merge = (dst, src) => {
      const bounds = dst._bounds || {};
      for (const k of Object.keys(src)) {
        if (k.startsWith('_')) continue;
        if (src[k] && typeof src[k] === 'object' && dst[k] && typeof dst[k] === 'object') merge(dst[k], src[k]);
        else {
          let v = src[k];
          // TYPE-ANCHORED: the file's value defines the leaf's type, and a
          // mismatched override is refused, not coerced. Found the hard way:
          // NaN serialises to JSON null, which is not typeof 'number', so it
          // sailed past the finite check and wrote null into the exposure —
          // the exact smuggling this merge exists to stop.
          if (typeof v !== typeof dst[k]) continue;
          if (typeof v === 'number') {
            if (!Number.isFinite(v)) continue;                       // NaN/Infinity never enter
            if (bounds[k]) v = Math.min(bounds[k][1], Math.max(bounds[k][0], v));
          }
          dst[k] = v;
        }
      }
    };
    merge(aestheticsData, JSON.parse(raw));
    localStorage.setItem('aestheticsBootPending', '1');
  }
} catch { /* corrupt overrides must never brick boot */ }

// Called by main.js when the build has completed — the crash-recovery
// marker's other half.
export function confirmAestheticsBoot() {
  try { localStorage.removeItem('aestheticsBootPending'); } catch { }
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
