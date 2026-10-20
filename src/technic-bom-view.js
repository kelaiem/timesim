// BUILT §300 — THE PARTS LIST'S PICTURES (route a): each part drawn live from the
// vendored LDraw file by three.js, in a canvas of its own, to a PNG data URL.
// No baked binary, no network, no image from anyone else: the picture IS the
// part's triangles and edges (the page's own `geoOf`), in its role's LDraw colour,
// seen from src/technic-bom.js' corner camera and fitted to the part's projected
// bounds. DISPLAY ONLY: nothing here reads or writes a placement.
//
// THE FIT is the claim the smoke test holds: the image is square, the camera's
// frustum is the part's projected box (`viewBounds`) plus PICTURE_PAD, centred on
// it, so the silhouette's aspect in the pixels is the box's aspect.
import * as THREE from 'three';
import { viewBasis, viewBounds, COLOUR_INFO } from './technic-bom.js';

export const PICTURE_PX = 160;   // 2x the 80 px the list shows, so a high-density screen is not soft

export function makePartPictures(lib, geoOf, size = PICTURE_PX) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(size, size, false); renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 0.95));
  const sun = new THREE.DirectionalLight(0xffffff, 1.9); scene.add(sun);
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x0b0c0e });
  const flat = document.createElement('canvas'); flat.width = flat.height = size;
  const ctx = flat.getContext('2d');
  const cache = new Map();
  const { right, up, forward } = viewBasis();
  const V = (a) => new THREE.Vector3(...a);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 20000);
  cam.up.copy(V(up));

  // → a PNG data URL of `part` in LDraw colour `code`
  function render(part, code) {
    const key = `${part}|${code}`;
    if (cache.has(key)) return cache.get(key);
    const { g, e } = geoOf(part), vb = viewBounds(lib, part);
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(COLOUR_INFO[code]?.hex ?? '#888888'), roughness: 0.55, metalness: 0, side: THREE.DoubleSide, flatShading: true });
    const mesh = new THREE.Mesh(g, mat), lines = new THREE.LineSegments(e, edgeMat);
    scene.add(mesh, lines);
    // the camera stands back along −forward from the box's centre in the view plane
    const target = V(right).multiplyScalar(vb.cx).add(V(up).multiplyScalar(vb.cy));
    cam.left = -vb.half; cam.right = vb.half; cam.top = vb.half; cam.bottom = -vb.half; cam.updateProjectionMatrix();
    cam.position.copy(target).addScaledVector(V(forward), -5000); cam.lookAt(target); cam.updateMatrixWorld();
    // the light comes from the camera's upper left, so every part is lit the same way
    sun.position.copy(cam.position).addScaledVector(V(right), -3000).addScaledVector(V(up), 3000);
    renderer.render(scene, cam);
    ctx.clearRect(0, 0, size, size); ctx.drawImage(renderer.domElement, 0, 0, size, size);
    const url = flat.toDataURL('image/png');
    scene.remove(mesh, lines); mat.dispose();
    cache.set(key, url);
    return url;
  }
  return { render, size, dispose: () => renderer.dispose() };
}
