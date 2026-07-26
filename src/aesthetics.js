import aestheticsData from './aesthetics.json' with { type: 'json' };

// §23: session overrides. The advanced panel writes tuned values here; some
// (subdial size, marker geometry) are consumed at BUILD time, and a reload
// knob whose value dies on reload is a control that never visibly works. So
// the tuned state is merged over the file at load. The FILE stays the single
// source of record — the panel's Copy JSON is how a tuning session becomes a
// commit, and Reset clears the overrides.
try {
  const raw = localStorage.getItem('aestheticsOverrides');
  if (raw) {
    const merge = (dst, src) => {
      for (const k of Object.keys(src)) {
        if (src[k] && typeof src[k] === 'object' && dst[k] && typeof dst[k] === 'object') merge(dst[k], src[k]);
        else dst[k] = src[k];
      }
    };
    merge(aestheticsData, JSON.parse(raw));
  }
} catch { /* corrupt overrides must never brick boot */ }

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
