// §290 — THE SELFIE REFLECTION. The front camera's picture becomes the part of
// the studio environment that stands where the viewer stands, so every
// metalness-1 surface reflects the viewer and the room behind them. It is most
// visible in §289's mirror-polished bezel.
//
// WHY IT GOES THERE AND NOWHERE ELSE. A mirror shows what is in front of it.
// For a watch being looked at, that is the viewer and their background, which
// is exactly what a phone's front camera sees, from nearly the same place. So
// the picture is a screen in the environment scene, on the ray from the watch
// toward the camera, facing the watch. It REPLACES the studio's front card,
// which stood in for the same light, and it follows the orbit, because the
// viewer is always where the camera is.
//
// WHICH WAY ROUND. getUserMedia hands over the frame as the camera sees it,
// not the mirrored preview a camera app shows. Seen from the watch looking
// toward the viewer, the camera's right is the screen's right: right = d × up
// for a look direction d. The reflection then mirrors it the way a real mirror
// would. The basis (right, up, −d) is right-handed, (d × u) × u = −d for a unit
// u ⟂ d, so the plane's face (+z) points at the watch.
//
// HOW OFTEN. The environment is a PMREM bake (PMREMGenerator.fromScene), not a
// live texture: three converts an equirect or cube map once and caches it, so
// a video map would freeze on its first frame. Each bake renders the small
// studio scene into a cube and blurs it. SELFIE_BAKE_HZ is that rate. It is
// taste: well under a display's rate, so the bake costs a fraction of a frame
// on a GPU, and fast enough that a moving head reads as moving. Software GL
// pays far more per bake. The feature is opt-in, so that cost is the viewer's
// choice.
//
// The picture never leaves the device: it is a texture on this page's GPU,
// nothing records or sends it, and stop() ends the stream's tracks, which
// turns the camera's light off.
import * as THREE from 'three';

export const SELFIE_BAKE_HZ = 15;
// A phone's front camera spans about 65–75° horizontally. The screen subtends
// the low end of that from the watch, so the picture is never stretched past
// what the lens saw. Taste within that band.
export const SELFIE_FOV_DEG = 65;
const SCREEN_R = 70;            // the studio's panel radius (main.js buildStudioScene)
const SCREEN_GAIN = 1.2;        // the picture's emission, against the studio panels' 0.8–3.2
// THE PRE-BLUR, two settings. PMREMGenerator.fromScene blurs the cube by a
// Gaussian of SIGMA radians before it builds the roughness chain. The default
// is the studio's own 0.04 (main.js buildStudioEnvironment), so the room reads
// alike with and without the camera, and a face in the bezel is a soft
// likeness rather than a mirror image. The SHARP setting is the smallest blur
// that still band-limits the cube to its own resolution: one texel of the
// 256-px face three r165's fromScene renders, π/2 over 256. Under a texel the
// blur does nothing, and with none at all the 640-px picture aliases down into
// 256. It is opt-in per session (Advanced, never persisted): how sharply the
// viewer's face shows is their choice, made fresh at each load.
export const SELFIE_SIGMA = 0.04;
const PMREM_CUBE_PX = 256;      // three r165 PMREMGenerator.fromScene: this._setSize( 256 )
export const SELFIE_SIGMA_SHARP = (Math.PI / 2) / PMREM_CUBE_PX;

export function makeSelfieReflection({ renderer, envScene, frontCard, studioTexture, setEnvironment }) {
  let stream = null, video = null, tex = null, screen = null, rt = null, pmrem = null;
  let last = -Infinity;
  let sharp = false;   // session-only: nothing stores it, nothing restores it
  const d = new THREE.Vector3(), up = new THREE.Vector3(), right = new THREE.Vector3(), m = new THREE.Matrix4();

  const bake = () => {
    const next = pmrem.fromScene(envScene, sharp ? SELFIE_SIGMA_SHARP : SELFIE_SIGMA, 0.1, 250);
    setEnvironment(next.texture);
    if (rt) rt.dispose();
    rt = next;
  };

  // `pending` is a stream the loading screen already asked for (index.html's
  // camera opt-in, asked during the wait); without one, start asks itself.
  async function start(pending = null) {
    if (stream) return true;
    if (!pending && !(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) throw new Error('no getUserMedia');
    stream = await (pending || navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false,
    }));
    try {
      video = document.createElement('video');
      video.playsInline = true;
      video.muted = true;
      video.srcObject = stream;
      await video.play();
      tex = new THREE.VideoTexture(video);
      tex.colorSpace = THREE.SRGBColorSpace;
      const w = 2 * SCREEN_R * Math.tan((SELFIE_FOV_DEG / 2) * Math.PI / 180);
      const aspect = (video.videoWidth || 4) / (video.videoHeight || 3);
      const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
      mat.color.multiplyScalar(SCREEN_GAIN);
      screen = new THREE.Mesh(new THREE.PlaneGeometry(w, w / aspect), mat);
      screen.name = 'selfieScreen';
      screen.matrixAutoUpdate = false;
      envScene.add(screen);
      if (frontCard) frontCard.visible = false;
      pmrem = new THREE.PMREMGenerator(renderer);
      last = -Infinity;
      return true;
    } catch (e) {
      stop();
      throw e;
    }
  }

  function stop() {
    if (stream) for (const tr of stream.getTracks()) tr.stop();
    stream = null;
    if (video) { video.srcObject = null; video = null; }
    if (screen) { envScene.remove(screen); screen.geometry.dispose(); screen.material.dispose(); screen = null; }
    if (tex) { tex.dispose(); tex = null; }
    if (frontCard) frontCard.visible = true;
    setEnvironment(studioTexture);   // the studio's own bake, kept whole for this
    if (rt) { rt.dispose(); rt = null; }
    if (pmrem) { pmrem.dispose(); pmrem = null; }
  }

  // Once per frame: re-aim the screen at the viewer and re-bake at SELFIE_BAKE_HZ.
  function update(now, camera, target) {
    if (!screen || now - last < 1000 / SELFIE_BAKE_HZ) return;
    last = now;
    d.subVectors(camera.position, target).normalize();
    up.copy(camera.up).addScaledVector(d, -camera.up.dot(d));
    if (up.lengthSq() < 1e-8) up.set(0, 1, 0).addScaledVector(d, -d.y);
    up.normalize();
    right.crossVectors(d, up).normalize();
    m.makeBasis(right, up, d.clone().negate()).setPosition(d.x * SCREEN_R, d.y * SCREEN_R, d.z * SCREEN_R);
    screen.matrix.copy(m);
    screen.matrixWorldNeedsUpdate = true;
    bake();
  }

  // The next update() re-bakes at once rather than waiting out the rate.
  function setSharp(on) { sharp = !!on; last = -Infinity; }

  return { start, stop, update, setSharp, get sharp() { return sharp; }, get on() { return !!screen; } };
}
