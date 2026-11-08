// §338 landing 1 — three.js for a host with no GPU.
//
// Everything three exports, unchanged, except the two classes that need a GL
// context to exist: WebGLRenderer and PMREMGenerator. main.js creates both
// before it cuts its first part (the renderer at its top, the studio
// environment off it), and neither contributes to the METAL — a renderer
// draws what the builders made, and the PMREM environment is a lighting
// texture. So the native host answers them with inert stand-ins and builds
// the same scene graph. What this host cannot measure is anything a pixel
// decides: those checks stay in the browser battery (tools/ci-battery.mjs).
//
// Only `three` is remapped (tools/native/loader.mjs); the vendored file is
// imported by absolute URL so the stand-ins wrap the very module the build
// uses, never a second copy of it.
export * from '../../vendor/three.module.js';
import { Texture } from '../../vendor/three.module.js';

const vec = (v, x, y) => (v && v.set ? v.set(x, y) : { x, y });
export class WebGLRenderer {
  constructor() {
    this.domElement = globalThis.document.createElement('canvas');
    this.shadowMap = { enabled: false, type: 0 };
    this.info = { render: { calls: 0, triangles: 0 }, memory: { geometries: 0, textures: 0 }, reset() {} };
    this.capabilities = { getMaxAnisotropy: () => 1, isWebGL2: true, maxTextureSize: 4096 };
    this.xr = { enabled: false };
    this.toneMappingExposure = 1;
  }
  getContext() { return null; }
  getPixelRatio() { return 1; }
  getSize(v) { return vec(v, globalThis.innerWidth, globalThis.innerHeight); }
  getDrawingBufferSize(v) { return vec(v, globalThis.innerWidth, globalThis.innerHeight); }
  getRenderTarget() { return null; }
  getClearColor(c) { return c; }
  getClearAlpha() { return 1; }
  setPixelRatio() {} setSize() {} setViewport() {} setScissor() {} setScissorTest() {}
  setClearColor() {} setClearAlpha() {} setRenderTarget() {} setAnimationLoop() {}
  clear() {} render() {} compile() {} readRenderTargetPixels() {} dispose() {}
}
export class PMREMGenerator {
  fromScene() { return { texture: new Texture(), dispose() {} }; }
  fromEquirectangular() { return { texture: new Texture(), dispose() {} }; }
  compileEquirectangularShader() {}
  dispose() {}
}
