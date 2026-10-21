// BUILT §304 — THE BOOKLET'S PICTURES: each step drawn by three.js in an offscreen canvas, from the vendored
// LDraw files, in the corner view of the part pictures (BUILT §300) so a callout and its step read alike.
// DISPLAY ONLY: nothing here reads or writes a placement. What is drawn comes from the pure half
// (src/technic-booklet.js `viewSpecs`): which placements are GHOSTS (already built, pale and flat), which are
// FRESH (this step's, in their colours), and the frame.
//
// A fresh part a ghost hides is not lost: a second pass draws it again where something stands in front of it
// (a depth test that passes only behind what is already drawn), as a translucent tint, so the builder sees
// where it goes even when it goes inside a brick.
import * as THREE from 'three';
import { walk } from './ldraw.js';
import { viewBasis, COLOUR_INFO } from './technic-bom.js';
import { LDRAW_COLOUR } from './technic-ldraw.js';
import { colourOf } from './technic-colour.js';
import { RENDER_SCALE } from './technic-booklet.js';

export const GHOST = Object.freeze({ fill: 0xe7eaee, edge: 0xc3c9cf });
export const INK = 0x0b0c0e;
export const XRAY_OPACITY = 0.42;

// One part's triangles and edges, LDU, in its own frame; built once and shared (technic.html's geoOf).
export function makeGeoOf(lib) {
  const memo = new Map();
  return function geoOf(part) {
    if (memo.has(part)) return memo.get(part);
    const tri = [], edge = [];
    walk(lib, `${part}.dat`, (kind, pts) => { for (const p of pts) (kind === 'tri' ? tri : edge).push(...p); });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3)); g.computeVertexNormals();
    const e = new THREE.BufferGeometry(); e.setAttribute('position', new THREE.Float32BufferAttribute(edge, 3));
    const out = { g, e }; memo.set(part, out); return out;
  };
}
const matrixOf = (m) => new THREE.Matrix4().set(m[3], m[4], m[5], m[0], m[6], m[7], m[8], m[1], m[9], m[10], m[11], m[2], 0, 0, 0, 1);

export function makeStepRenderer(lib, plan, geoOf, { w, h, scale = RENDER_SCALE }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(Math.round(w * scale), Math.round(h * scale), false); renderer.setClearColor(0xffffff, 1);
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 0.95));
  const sun = new THREE.DirectionalLight(0xffffff, 1.9); scene.add(sun);
  const { right, up, forward } = viewBasis();
  const V = (a) => new THREE.Vector3(...a);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 20000);
  cam.up.copy(V(up));
  const shade = { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 };
  const mats = new Map();
  const solid = (hex, key = hex) => { const k = `s${key}`; if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color: hex, roughness: 0.55, metalness: 0, side: THREE.DoubleSide, flatShading: true, ...shade })); return mats.get(k); };
  const xray = (hex) => { const k = `x${hex}`; if (!mats.has(k)) mats.set(k, new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: XRAY_OPACITY, depthFunc: THREE.GreaterDepth, depthWrite: false, side: THREE.FrontSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })); return mats.get(k); };
  const line = (hex) => { const k = `l${hex}`; if (!mats.has(k)) mats.set(k, new THREE.LineBasicMaterial({ color: hex })); return mats.get(k); };
  const hexOf = (p) => new THREE.Color(COLOUR_INFO[colourOf(LDRAW_COLOUR, p.role, p.part)]?.hex ?? '#888888').getHex();

  // → the canvas the spec draws on (the same one every time: read it before the next call)
  function draw(spec) {
    const group = new THREE.Group(); scene.add(group);
    const add = (geo, mat, M, lines) => { const o = lines ? new THREE.LineSegments(geo, mat) : new THREE.Mesh(geo, mat); o.matrixAutoUpdate = false; o.matrix.copy(M); group.add(o); return o; };
    for (const i of spec.ghost) { const p = plan.parts[i], { g, e } = geoOf(p.part), M = matrixOf(p.m); add(g, solid(GHOST.fill, 'ghost'), M); add(e, line(GHOST.edge), M, true); }
    for (const i of spec.fresh) {
      const p = plan.parts[i], { g, e } = geoOf(p.part), M = matrixOf(p.m), hex = hexOf(p);
      add(g, solid(hex), M); add(e, line(INK), M, true);
      if (spec.ghost.length) { const x = add(g, xray(hex), M); x.renderOrder = 2; }
    }
    const f = spec.frame, target = V(right).multiplyScalar(f.cx).add(V(up).multiplyScalar(f.cy));
    cam.left = -f.hw; cam.right = f.hw; cam.top = f.hh; cam.bottom = -f.hh; cam.updateProjectionMatrix();
    cam.position.copy(target).addScaledVector(V(forward), -5000); cam.lookAt(target); cam.updateMatrixWorld();
    sun.position.copy(cam.position).addScaledVector(V(right), -3000).addScaledVector(V(up), 3000);
    renderer.render(scene, cam);
    scene.remove(group);
    return renderer.domElement;
  }
  const toBlobUrl = () => new Promise((res, rej) => renderer.domElement.toBlob((b) => (b ? res(URL.createObjectURL(b)) : rej(new Error('booklet: the canvas gave no image'))), 'image/png'));
  async function render(spec) { draw(spec); return toBlobUrl(); }
  // pixel read-back for the smoke: the canvas as RGBA at its own size
  function pixels(spec) {
    const c = draw(spec), ctx = document.createElement('canvas'); ctx.width = c.width; ctx.height = c.height;
    const g = ctx.getContext('2d', { willReadFrequently: true }); g.drawImage(c, 0, 0);
    return { w: c.width, h: c.height, data: g.getImageData(0, 0, c.width, c.height).data };
  }
  return { render, pixels, draw, size: { w: Math.round(w * scale), h: Math.round(h * scale) }, dispose: () => { renderer.dispose(); for (const m of mats.values()) m.dispose(); } };
}
