// BUILT §304 — A PLAN'S SIGNATURE: a 32-bit FNV-1a over what the validator judged, so the generated
// src/technic-booklet-flags.js can say which plan its rows were measured on, and the booklet can refuse
// rows that belong to another plan (a derivation that moved since the file was written). Pure, tiny, and
// a module of its own so tools/booklet-flags.mjs (which writes the file) and the page (which reads it)
// share the one definition without the generator importing the layout engine.
export function planSig(plan) {
  const s = plan.steps.map((st) => `${st.n}:${st.kind}:${st.sub ?? ''}:${st.parts.join(',')}:${(st.unit ?? []).join(',')}`).join('|');
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
