// THE VIEW A BOOT OPENS IN — the case lines, the wireframe (schematic) tier and
// the plate x-ray — as ONE law, read by the two places that need it: main.js,
// which applies it, and the loading screen (index.html), which shows it in its
// three view checkboxes before main.js has loaded.
//
// Until this module the loading screen's boxes were hard-coded in the markup
// (case on, wireframe off, x-ray on) and never read anything, while main.js
// decided the view from the saved state, the renderer and the link. The two
// agreed only on a first run on a GPU with no link — so a saved wireframe, a
// first run under software GL (where the wireframe is the default, §69), or a
// ?schematic= / ?xray= link showed one thing on the loading screen and loaded
// another. Worse, main.js applies a box only when it is CHANGED, so a box
// showing the wrong state turned a click meant to disable the wireframe into
// one that agreed with it.
//
// The law, in main.js's own order:
//   1. the SAVED state (state.js's loadState, defaults merged): `caseLines`
//      (?? true — an absent field is the default-on case), `plateXray`, and
//      `schematic`, where only a saved BOOLEAN is a choice — null (a fresh
//      visitor, or a save from before the field) keeps the RENDERER's default:
//      on under software GL, off on a GPU (§69's measured reason);
//   2. the LINK, which main.js applies after: ?xray=, ?schematic=, and
//      ?reconf=1, which enters reconfigure mode and forces the solid tier
//      (§93 — its handles are metal you grab).
// A choice made ON the loading screen is applied over both (main.js): it was
// made after the link was opened, so it is the more recent intent.
//
// Pure apart from `probeSoftwareGL`, which needs a browser.

// §69's test of the renderer string: a software rasteriser draws the solid
// view at 7–10 s a frame, so the line view is its front door.
export const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|software/i;
export const isSoftwareRenderer = (name) => SOFTWARE_RENDERER.test(String(name || ''));

// The deep link's boolean reading (main.js applyDeepLink's `flag`): '1' or
// 'true' is on, anything else present is off.
export const linkFlag = (v) => v === '1' || v === 'true';

// Step 1 — the view the saved state asks for, before any link.
export function savedView(saved, softwareGL) {
  const s = saved || {};
  return {
    case: s.caseLines ?? true,
    wireframe: typeof s.schematic === 'boolean' ? s.schematic : !!softwareGL,
    xray: !!s.plateXray,
  };
}

// Steps 1 and 2 — what the movement opens in when nobody touches the loading
// screen: the saved view with the link applied over it, in applyDeepLink's
// order (?xray, ?schematic, then ?reconf, which wins over ?schematic).
export function initialView(saved, softwareGL, search = '') {
  const v = savedView(saved, softwareGL);
  const p = new URLSearchParams(search);
  if (p.has('xray')) v.xray = linkFlag(p.get('xray'));
  if (p.has('schematic')) v.wireframe = linkFlag(p.get('schematic'));
  if (p.has('reconf') && linkFlag(p.get('reconf'))) v.wireframe = false;
  return v;
}

// The renderer's name, from a throwaway context, for a page that has no
// renderer yet (the loading screen). The context is released at once: browsers
// cap live WebGL contexts, and main.js is about to make the real one. A browser
// that will not say (no context, no debug extension) reads as a GPU — main.js's
// own fallback ("assume a GPU, the user-facing default").
export function probeSoftwareGL() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return false;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return isSoftwareRenderer(name);
  } catch (e) { return false; }
}
