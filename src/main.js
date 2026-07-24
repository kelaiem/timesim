// Mechanical Clock Simulation — scene, movement assembly, kinematics, UI.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as G from './geometry.js';
import { MATS } from './materials.js';
import { aesthetics } from './aesthetics.js';
import { loadState, saveState, clearState, hasState } from './state.js';
// Pure layout data — the constants §13 pulled out of this file's evaluation
// order (kinematic constants + the whole Z-stack). See src/layout.js. They are
// consumed unchanged below; the geometry fingerprint proves the move changed
// no part's position.
import {
  F_BALANCE, BEAT_DEG, AMPLITUDE_TRUE_DEG, AMPLITUDE_VISUAL_DEG, IMPULSE_WIDTH,
  RECOIL_FRACTION, RECOIL_DEG,
  CLEAR_MARGIN, L_BARREL, L_CENTER, L_THIRD, L_FOURTH, L_ESCAPE, FORK_T, L_FORK,
  BAL_T, RIM_H, L_BALANCE, PIN_PLANE_Z, L_HAIRSPRING, HAIRSPRING_H, COCK_T,
  SPRING_TOP_Z, COCK_SLAB_BOT, COCK_SLAB_TOP, COCK_MID_Z, Z_DIAL, Z_KEYLESS,
  // Train ratios (§13 steps 2 + 3c): TRAIN is the ONE table — module, wheel
  // teeth and pinion teeth per mesh. Builders and tick()'s ratio chain
  // (meshOffset / the going-train ratios) both read it; the flat teeth
  // names are retired.
  TRAIN,
  KW_MODULE, crownWheelTeeth, windPinionTeeth, settingWheelTeeth,
  minuteWheelTeeth, minutePinionTeeth, WIND_SPUR_TEETH,
  cannonPinionTeeth, MW_MODULE_1, MW_MINUTE_TEETH, MW_PINION_TEETH, MW_HOUR_TEETH,
  BARREL_STEP_DEG, D4, ESCAPE_STEP_DEG, BALANCE_STEP_TARGET_DEG,
  solveLayout,
  CROWN_PULL_DIST, SL_C, SL_TAIL, GROOVE_LOCAL, YK_C,
  solveKeyless,
} from './layout.js';

const DEG2RAD = Math.PI / 180;

// Boot-assert visibility (§29 step 0's postscript): console.warn is the
// assert channel (CLAUDE.md rule 6), but an automated console reader sees a
// CUMULATIVE buffer across reloads drowned in three-mesh-bvh spam — pattern
// reads against it returned "silent" while a §29 assert was firing every
// boot. Every warn is therefore ALSO collected here, and __clock exposes
// the list: "boot is silent" now means __clock.bootWarns.length === 0,
// checkable, per-boot, unambiguous.
const __bootWarns = [];
{ const _w = console.warn.bind(console); console.warn = (...a) => { __bootWarns.push(a.map(String).join(' ')); _w(...a); }; }

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
function smoothstep(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }
function wrapPi(a) { a = (a + Math.PI) % (2 * Math.PI); return (a < 0 ? a + 2 * Math.PI : a) - Math.PI; }

// (Kinematic constants F_BALANCE … RECOIL_DEG are now imported from layout.js.
// FORK_BANK_DEG / FORK_RECOIL_DEG remain DERIVED further down — after the
// pallet fork and balance geometry exist — from rollerR and the notch's actual
// reach, so they are not pure and stay here.)

// ---------------------------------------------------------------------------
// Renderer / scene / camera
// ---------------------------------------------------------------------------
const app = document.getElementById('app');

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = aesthetics.rendering.toneMappingExposure;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const sceneAesthetic = aesthetics.lighting.scene;
scene.background = new THREE.Color(sceneAesthetic.backgroundColor);
scene.fog = new THREE.Fog(sceneAesthetic.fogColor, 180, 420);

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.5, 2000);
camera.position.set(60, 55, 90);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = aesthetics.camera.dampingFactor;
controls.minDistance = 25;
controls.maxDistance = 420;

// Lights: hemisphere fill + 2 shadowed directional/spot lights (studio look).
const hemiAesthetic = aesthetics.lighting.hemisphere;
const hemi = new THREE.HemisphereLight(hemiAesthetic.skyColor, hemiAesthetic.groundColor, hemiAesthetic.intensity);
scene.add(hemi);

const keyLightAesthetic = aesthetics.lighting.keyLight;
const keyLight = new THREE.DirectionalLight(keyLightAesthetic.color, keyLightAesthetic.intensity);
keyLight.position.set(70, 90, 70);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.left = -110;
keyLight.shadow.camera.right = 110;
keyLight.shadow.camera.top = 110;
keyLight.shadow.camera.bottom = -110;
keyLight.shadow.camera.near = 1;
keyLight.shadow.camera.far = 320;
keyLight.shadow.bias = keyLightAesthetic.shadowBias;
scene.add(keyLight);
scene.add(keyLight.target);

const fillLightAesthetic = aesthetics.lighting.fillLight;
const fillLight = new THREE.DirectionalLight(fillLightAesthetic.color, fillLightAesthetic.intensity);
fillLight.position.set(-70, 35, -50);
scene.add(fillLight);

// Dial side (-Z) gets its own soft key so the face isn't lit only by spill.
const dialLightAesthetic = aesthetics.lighting.dialLight;
const dialLight = new THREE.DirectionalLight(dialLightAesthetic.color, dialLightAesthetic.intensity);
dialLight.position.set(25, 45, -110);
scene.add(dialLight);

const rimSpotAesthetic = aesthetics.lighting.rimSpot;
const rimSpot = new THREE.SpotLight(rimSpotAesthetic.color, rimSpotAesthetic.intensity, 400, Math.PI / 6.5, rimSpotAesthetic.penumbra, rimSpotAesthetic.decay);
rimSpot.position.set(-10, 70, 150);
rimSpot.castShadow = true;
rimSpot.shadow.mapSize.set(1024, 1024);
scene.add(rimSpot);
scene.add(rimSpot.target);

// Soft dark backdrop plane behind the movement to catch light / read as a studio wall.
const backdropAesthetic = aesthetics.lighting.backdrop;
const backdrop = new THREE.Mesh(
  new THREE.PlaneGeometry(600, 400),
  new THREE.MeshStandardMaterial({ color: backdropAesthetic.color, roughness: backdropAesthetic.roughness, metalness: backdropAesthetic.metalness })
);
backdrop.position.set(0, 0, -90);
backdrop.receiveShadow = true;
scene.add(backdrop);

// Procedural "studio" environment map. The metalness≈1 PBR materials in
// materials.js read almost black under direct lights alone — they need an
// environment to reflect. Build a small box room with a few emissive softbox
// panels and bake it to a PMREM texture (fully offline, no external HDRs).
function buildStudioEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);

  const envScene = new THREE.Scene();
  const roomMat = new THREE.MeshBasicMaterial({ color: 0x1a1d22, side: THREE.BackSide });
  const room = new THREE.Mesh(new THREE.BoxGeometry(180, 180, 180), roomMat);
  envScene.add(room);

  function softbox(w, h, color, intensity, pos, rotY = 0, rotX = 0) {
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color, toneMapped: false })
    );
    panel.material.color.multiplyScalar(intensity);
    panel.position.copy(pos);
    panel.rotation.y = rotY;
    panel.rotation.x = rotX;
    envScene.add(panel);
  }

  // Large soft key overhead, cooler fill from the side, warm rim behind.
  softbox(90, 60, 0xffffff, 3.2, new THREE.Vector3(0, 70, 0), 0, Math.PI / 2);
  softbox(70, 90, 0xdfe8ff, 1.6, new THREE.Vector3(-70, 10, 20), Math.PI / 2, 0);
  softbox(70, 90, 0xfff2df, 1.2, new THREE.Vector3(70, 5, -10), -Math.PI / 2, 0);
  softbox(100, 60, 0xffffff, 0.8, new THREE.Vector3(0, -20, 70), Math.PI, 0);


  // near/far generous enough to cover the 90-unit room half-extent.
  const rt = pmrem.fromScene(envScene, 0.04, 0.1, 250);
  pmrem.dispose();
  return rt.texture;
}

scene.environment = buildStudioEnvironment(renderer);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------------------
// Movement assembly
// ---------------------------------------------------------------------------
// The Z-stack (depth budget between the back plate and the cocks) and the one
// structural margin CLEAR_MARGIN are now imported from layout.js — pure data,
// derived-with-constraint, consumed unchanged by the assembly below.

const explodeEntries = []; // { obj, baseZ, dir, layer }
function registerExplode(obj, baseZ, layer, dir = 1) {
  // updateExplode writes position.z = baseZ at rest EVERY FRAME, so a baseZ
  // that disagrees with the constructed position silently teleports the unit
  // on frame one — and only virgin sessions (zero frames) ever see the
  // constructed value, which is how the handsGroup 3.2/2.5 divergence hid in
  // every battery run and fingerprint capture. Assert the agreement at
  // registration; the constructor's own z is the one source.
  if (Math.abs(obj.position.z - baseZ) > 1e-9)
    console.warn(`registerExplode: baseZ ${baseZ} disagrees with constructed position.z ${obj.position.z} — frame one will teleport this unit`);
  explodeEntries.push({ obj, baseZ, layer, dir });
}

const labelEntries = []; // { name, obj }
function registerLabel(name, obj) {
  labelEntries.push({ name, obj });
}

const movement = new THREE.Group();
scene.add(movement);

// --- Fusee & chain layout: the movement is now a FUSEE movement -----------
// The spring barrel is a plain DRUM (no teeth) sitting off to the side; a
// chain runs from it to the fusee cone, whose arbor carries the great
// wheel, the winding spur and (above the plate) the ratchet. The fusee
// arbor sits exactly where the going barrel used to be, so every mesh
// distance in the train is unchanged.
const barrelR = (TRAIN.barrel.module * TRAIN.barrel.teeth) / 2;
// The spring DRUM — slimmer than the great wheel it feeds: with the compact
// tornado plate the drum tucks in close beside the fusee (XY gap smaller
// than the great wheel's radius), so it clears the great wheel in Z instead
// of XY. Its z-band is DERIVED from those two vertical binds: bottom one
// margin over the great wheel's top face (1.4 thick + bevel), top at the
// plate floor the hairspring stack sets (= floor − margin; the drum gets
// no plate opening — only its arbor reaches the plate). With the fusee
// dropped to the same spring-bound floor, drum and cone compress together.
const DRUM_R_ACTUAL = 10;
const DRUM_BOT_Z = L_BARREL + 0.7 + 0.08 + CLEAR_MARGIN;
const DRUM_TOP_Z = SPRING_TOP_Z;
const DRUM_HEIGHT = DRUM_TOP_Z - DRUM_BOT_Z;
// (the drum body itself — makeBarrel — is built at the drumGroup assembly
// further down: its arbor is sized to reach the plate's mid-thickness,
// which isn't known yet here)
const greatWheel = G.makeGear({ module: TRAIN.barrel.module, teeth: TRAIN.barrel.teeth, thickness: 1.4, boreR: 1.4, spokes: 5, material: MATS.brass });
const barrelR_actual = greatWheel.userData.r || barrelR;
// FLAT cone (tornado): height squashed 8.5 → 4.5 with the same 3.75 wrap
// turns at a tighter groove pitch, seated just above the winding spur.
// The tall cone was the single largest back-side thickness contributor AND
// forced every cross-movement linkage (reset rod, hack linkage) to detour
// over it. The third-wheel clearance that used to drive the tall seat is
// now handled in XY instead: the tornado layout keeps |third − barrel|
// ≥ 16.4, so the cone's large end passes the third wheel's rim with margin.
// Cone COMPRESSED to what its grooves actually need: 4 turns of 0.6-dia
// chain want ~0.62 pitch, so 2.8 of height carries them snugly (the old
// 4.5 spread them a full unit apart and made the fusee the tallest thing
// in the movement — its top bound the three-quarter plate's floor).
const FUSEE_R_SMALL = 2.6, FUSEE_R_LARGE = 7.4, FUSEE_H = 2.8;
// Base DERIVED from the plate's design goal. The old bind (the chain's
// lowest span clearing the movement-side crown wheel) vanished when the
// keyless works moved to the dial side — after that, the only thing the
// cone's height still cost was the THREE-QUARTER PLATE FLOOR: the plate
// sits at max(tallest under-plate part, hairspring stack) + margin, and
// the fusee tip was that tallest part by ~2.5, holding the whole back of
// the movement high and the balance cock BELOW the plate band it is meant
// to sit in (the long-standing console warning). Seat the cone so its tip
// (plus ~0.1 for the helical ridge standing proud of the profile) lands AT
// the hairspring stack's top: the spring becomes the plate's binding
// member again and everything above — plate, rod planes, post, stop-work
// tail — closes down with it. The FLOOR under the cone is the CENTER
// WHEEL: its disc reaches under the cone's footprint (origin is only 16.2
// from the barrel vs an 11.5 wheel plus a 7.4–8.3 cone), so the chain's
// lowest span — riding the groove at FUSEE_H·0.06 above the base, chain
// radius below its centre-line — must clear the wheel's top face by the
// margin. Both binds explicit; today the spring goal governs (the center
// wheel was dropped onto its own bind to make that true).
const FUSEE_BASE_Z = Math.max(
  SPRING_TOP_Z - L_BARREL - FUSEE_H - 0.1,
  (L_CENTER + 0.5 + 0.08) + CLEAR_MARGIN + 0.3 - FUSEE_H * 0.06 - L_BARREL,
);
const fusee = G.makeFusee({ rSmall: FUSEE_R_SMALL, rLarge: FUSEE_R_LARGE, height: FUSEE_H, grooveTurns: 4 });

// --- Center arbor: pinion (meshed by barrel) + center wheel --------------
const centerPinion = G.makePinion({ module: TRAIN.barrel.module, teeth: TRAIN.barrel.pinion, thickness: 1.6, material: MATS.steel });
const centerPinionR = centerPinion.userData.r;

const centerWheel = G.makeGear({ module: TRAIN.center.module, teeth: TRAIN.center.teeth, thickness: 1.0, boreR: 1.2, spokes: 5, material: MATS.brass });
const centerWheelR = centerWheel.userData.r;

// --- Third arbor: pinion (meshed by center wheel) + third wheel ----------
const thirdPinion = G.makePinion({ module: TRAIN.center.module, teeth: TRAIN.center.pinion, thickness: 1.6, material: MATS.steel });
const thirdPinionR = thirdPinion.userData.r;

const thirdWheel = G.makeGear({ module: TRAIN.third.module, teeth: TRAIN.third.teeth, thickness: 0.9, boreR: 1, spokes: 4, material: MATS.brass });
const thirdWheelR = thirdWheel.userData.r;

// --- Fourth arbor: pinion (meshed by third wheel) + fourth wheel ---------
const fourthPinion = G.makePinion({ module: TRAIN.third.module, teeth: TRAIN.third.pinion, thickness: 1.6, material: MATS.steel });
const fourthPinionR = fourthPinion.userData.r;

const FOURTH_WHEEL_T = 0.8;
const fourthWheel = G.makeGear({ module: TRAIN.fourth.module, teeth: TRAIN.fourth.teeth, thickness: FOURTH_WHEEL_T, boreR: 0.9, spokes: 5, material: MATS.brass });
const fourthWheelR = fourthWheel.userData.r;

// --- Escape arbor: pinion (meshed by fourth wheel) + escape wheel --------
// The escape pinion rides the train's highest wheel plane (L_FOURTH), so its
// thickness is a plate-floor constraint, not a free choice: the 3/4 plate
// floor sits at max(tallest under-plate part, hairspring stack) + margin,
// and the design goal is that the SPRING binds (cock flush in the plate
// band — see the TQ_MEASURED_MAX check). The house pinion thickness (1.6,
// fine for the low arbors) topped out at L_FOURTH + 0.8 + bevel = 7.79,
// above the spring stack (7.56) — surplus leaf with nothing to mesh.
// Derived from what the mesh actually needs instead: the leaf band covers
// the fourth wheel's full tooth band (thickness + 2·extrude bevel) with
// CLEAR_MARGIN of overrun at each end. Top lands at 7.55 ≤ SPRING_TOP_Z,
// so the hairspring stack is the plate's binding member again.
const fourthWheelBevel = Math.min(FOURTH_WHEEL_T * 0.18, TRAIN.fourth.module * 0.22); // = makeGear's bevel
const escPinionBevel = TRAIN.fourth.module * 0.2; // = makePinion's bevel (module·0.2 governs; thickness·0.15 is larger)
const ESC_PINION_T = FOURTH_WHEEL_T + 2 * fourthWheelBevel + 2 * CLEAR_MARGIN - 2 * escPinionBevel;
const escapePinion = G.makePinion({ module: TRAIN.fourth.module, teeth: TRAIN.fourth.pinion, thickness: ESC_PINION_T, material: MATS.steel });
const escapePinionR = escapePinion.userData.r;

const escapeWheel = G.makeEscapeWheel({ teeth: 15, radius: 4.5, thickness: 0.8 });
const escapeWheelR = escapeWheel.userData.r || 4.5;

// --- Pallet fork + balance ------------------------------------------------
// The staff is ASYMMETRIC now: up through the flat cock's jewel (poking 0.5
// past the slab's top, a real pivot end), and down just past the safety
// roller — the wheel sits low in the movement but the cock sits low too, so
// a symmetric staff would spike out through the cock.
const balanceWheel = G.makeBalanceWheel({
  radius: 9,
  thickness: BAL_T,
  staffTop: COCK_SLAB_TOP + 0.5 - L_BALANCE,
  // pinDrop + 0.4·t = safety-roller plane (mirrors the builder's stack);
  // +0.6 pokes the staff just past the roller's underside.
  staffBottom: (L_BALANCE - PIN_PLANE_Z) + BAL_T * 0.4 + 0.6,
  // Wheel-centre → impulse-pin distance: holds the pin's WORLD plane at
  // PIN_PLANE_Z exactly, wherever the balance itself sits — the pin belongs
  // to the fork's z-band, not the wheel's.
  pinDrop: L_BALANCE - PIN_PLANE_Z,
});
const balanceR = balanceWheel.userData.r || 9;

// Pallet span subtends 3.5 tooth pitches (84°) around the escape wheel — the
// classic Swiss-lever embrace that makes teeth lock the entry and exit stones
// on alternating beats: half-span = R·sin(42°).
const forkSpan = 2 * escapeWheelR * Math.sin(THREE.MathUtils.degToRad(42));
// Pivot distance from the escape-wheel centre that puts both stones exactly on
// the wheel rim (stones sit at (±span/2, span/2) in fork-local coordinates).
const palletStoneDist = forkSpan / 2 + Math.sqrt(escapeWheelR ** 2 - (forkSpan / 2) ** 2);
// Lever runs from the pivot to just short of the balance roller's edge. Real
// Swiss-lever movements sit the balance close to the escapement — a compact
// fork bridging a modest gap, not stretched across open space — so this is
// a much tighter multiple of the two wheels' combined radius than before.
const escToBalanceDist = (escapeWheelR + balanceR) * 1.3;
const forkLeverLength = escToBalanceDist - palletStoneDist - 1.6;
// Real impulse rollers sit well inside the balance rim (~15-20% of its
// radius), not at half of it — the pin only needs to clear the fork's notch,
// not the whole balance.
const rollerR = balanceWheel.userData.rollerR || balanceR * 0.18;

// FORK_BANK_DEG / FORK_RECOIL_DEG — the fork's ±swing must sweep the SAME
// physical arc-length the impulse pin actually traces during the impulse
// window, or the two never coincide (the pin sails past the notch on one
// side, or never reaches it, depending on which is bigger). Matching
// arc-length: rollerR·Δθ_pin = notchDepth·(2·FORK_BANK_DEG in rad), where
// notchDepth is the fork's own local-space reach from pivot to notch floor
// (mirrors the (forkTop + 0.7·thickness) point makePalletFork's V-notch
// curve actually lands on) and Δθ_pin is the balance's angular travel over
// IMPULSE_WIDTH of a beat (closed form: amp·sin(π·IMPULSE_WIDTH), since
// balanceTheta(τ) = amp·sin(2π·F_BALANCE·τ) and τ_impulse = IMPULSE_WIDTH /
// (2·F_BALANCE)). Discovered by measuring the built pin/notch meshes and
// finding they never actually touch (~3.5 units of persistent clearance,
// even at the "locked" extremes) — this ties them together so a future
// change to rollerR, amplitude, or fork proportions can't silently
// reintroduce the gap. Solved BEFORE the fork is built: the builder cuts
// the pallet stones' impulse faces from the same beat/bank pair.
const notchDepth = 0.8 * forkLeverLength - 0.7 * FORK_T; // matches makePalletFork's V-notch geometry
const pinImpulseSweepRad = (AMPLITUDE_VISUAL_DEG * DEG2RAD) * Math.sin(Math.PI * IMPULSE_WIDTH);
const FORK_BANK_DEG = (rollerR * pinImpulseSweepRad) / notchDepth / DEG2RAD / 2;
const FORK_RECOIL_DEG = FORK_BANK_DEG * 0.25; // preserves the original 2.5/10 ratio

// stoneZReach: the fork body sits at L_FORK while the escape wheel sits at
// L_ESCAPE — the stones must descend by exactly that gap to land centered
// on the wheel's own Z-thickness rather than grazing one edge of it.
// beatRad/bankRad feed the stones' impulse-face solve (see makePalletFork).
const palletFork = G.makePalletFork({
  span: forkSpan, leverLength: forkLeverLength, thickness: FORK_T,
  stoneZReach: L_FORK - L_ESCAPE,
  beatRad: BEAT_DEG * DEG2RAD, bankRad: FORK_BANK_DEG * DEG2RAD,
});

const hairspring = G.makeHairspring({
  innerR: Math.max(rollerR * 0.5, 1.5),
  outerR: balanceR * 0.88,
  coils: 10,
  height: HAIRSPRING_H, // shared with the cock's z-solve: its slab sits one margin above this stack
});

// ---------------------------------------------------------------------------
// Planar layout (XY plane; assembly only sets position, no extra rotation
// since parts are already built lying flat with their pivot on +Z).
// ---------------------------------------------------------------------------
// TORNADO layout (§13 step 3) — the SOLVE lives in layout.js now
// (solveLayout), a pure function of the spec. main.js's remaining job here
// is the MEASUREMENT: the swept radii the balance-clearance constraint binds
// on are read from the BUILT meshes (vertex max — bevels and the timing
// screws' tip corners are real, boxes over-report), then passed IN as
// declared inputs. Same honesty, but the solve is now callable twice with
// different specs in one process — §13's regression suite. Ported verbatim;
// the geometry fingerprint (2407965539) is the proof nothing moved.
const MW_CENTER_D = (MW_MODULE_1 * (cannonPinionTeeth + MW_MINUTE_TEETH)) / 2;
const MW_MODULE_2 = (2 * MW_CENTER_D) / (MW_PINION_TEETH + MW_HOUR_TEETH); // minute pinion ⇄ hour wheel
// Reduction, derived from the tooth counts rather than asserted. Each
// external mesh reverses sense, so the two negations cancel: the hour wheel
// turns the same way as the cannon pinion, at 1/12 the rate.
const MW_RATIO_1 = -(cannonPinionTeeth / MW_MINUTE_TEETH);   // cannon → minute wheel
const MW_RATIO_2 = -(MW_PINION_TEETH / MW_HOUR_TEETH);       // minute pinion → hour wheel

const sweptR = (obj) => {
  obj.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  let r = 0;
  obj.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      r = Math.max(r, Math.hypot(v.x, v.y));
    }
  });
  return r;
};
const { P, BALANCE_STEP_DEG, forkBaseAngle, PIN_AIM } = solveLayout({
  radii: {
    barrel: barrelR_actual, centerPinion: centerPinionR,
    centerWheel: centerWheelR, thirdPinion: thirdPinionR,
    thirdWheel: thirdWheelR, fourthPinion: fourthPinionR,
    fourthWheel: fourthWheelR, escapePinion: escapePinionR,
  },
  escToBalance: escToBalanceDist,
  palletStone: palletStoneDist,
  swept: {
    great: sweptR(greatWheel), center: sweptR(centerWheel),
    third: sweptR(thirdWheel), fourth: sweptR(fourthWheel),
    escape: sweptR(escapeWheel), balance: sweptR(balanceWheel),
  },
  warn: (m) => console.warn(m),
});

// Keyless-works geometry constants — declared before the plate radius
// because the setting cluster extends OUTBOARD of the pulled-out sliding
// pinion along the stem, and the plate must enclose it (with the compact
// tornado train, this floor — not the train extent — is what sizes the
// plate).
// (KW_MODULE, crownWheelTeeth/windPinionTeeth/settingWheelTeeth,
// minuteWheelTeeth/minutePinionTeeth — the keyless ratios — imported from
// layout.js.)
// The setting path collapsed to ONE coefficient: hand-offset radians per
// radian of setting-path rotation. tick() walks this same chain forward
// (settingWheel → minuteArbor compound → cannon) to derive the hand offset
// from the crown; Sync (BUILT §9) needs the inverse to solve the crown
// rotation a wanted hand movement costs. Both directions therefore come
// from the tooth counts — the identity is asserted below rather than
// trusted, since the two forms live 5000 lines apart.
const HAND_RAD_PER_SET_RAD = -(windPinionTeeth / minuteWheelTeeth) * (minutePinionTeeth / cannonPinionTeeth);
{
  const probe = 1; // one radian into the setting path, walked exactly as tick() walks it
  const settingWheelSpin = -probe * (windPinionTeeth / settingWheelTeeth);
  const minuteArborSpin = -settingWheelSpin * (settingWheelTeeth / minuteWheelTeeth);
  const rawSetOffset = -minuteArborSpin * (minutePinionTeeth / cannonPinionTeeth);
  if (Math.abs(rawSetOffset - HAND_RAD_PER_SET_RAD) > 1e-12)
    console.warn(`setting path: closed form ${HAND_RAD_PER_SET_RAD} disagrees with the forward chain ${rawSetOffset}`);
}
// ---------------------------------------------------------------------------
// KEYLESS WORKS XY LAYOUT + plate/dial frame (§13 step 3b) — the SOLVE lives
// in layout.js now (solveKeyless), pure like solveLayout: the stem line, the
// keyless cluster's distances along it, the setting-lever/yoke pivots with
// their pull-driven angle functions, the plate radius, and the dial-side
// locals that radius fixes all come back as ONE FRAME, destructured under
// the names the in-line block used to declare — downstream consumers (plate
// openings, keyless assembly, dial build) are unchanged. main.js's job here
// is again the MEASUREMENT: each part's outline radius (with the drum's
// REAL radius under 'barrel') is read from the built parts and passed in as
// declared inputs. Ported verbatim; the fingerprint is the proof.
// (CROWN_PULL_DIST, SL_C / SL_TAIL / GROOVE_LOCAL, YK_C — the declared
// keyless spec — imported from layout.js.)
// ---------------------------------------------------------------------------
const {
  barrelDist, uWind, stemAngle, vPerp, sideSign,
  ratchetR, crownWheelR, windPinionR, settingWheelR, minuteWheelR, windSpurR,
  cwDist, pinDist, pinOutDist, swDist, mwFoldD, minuteArborXY,
  settingLeverPivot, settingLeverAngleAt, tailPostWorldAt, postEng, postRel,
  kwPostBow, yokePivot, yokeAngleAt,
  plateR, dialRadius, RESERVE_LOCAL, SECONDS_LOCAL, subDialR,
} = solveKeyless({
  P,
  outline: {
    barrel: barrelR_actual, center: centerWheelR, third: thirdWheelR,
    fourth: fourthWheelR, escape: escapeWheelR, balance: balanceR * 1.35, // + cock
    fork: 4, dial: 0,
  },
  warn: (m) => console.warn(m),
});

// Centroid of just the wheel-train arbors (excludes balance/dial), used to
// aim the "Train" camera preset without staring straight down the Z axis
// (which would line the small train up directly in front of the much
// bigger dial sitting behind it and let the dial swamp the frame).
const trainKeys = ['barrel', 'center', 'third', 'fourth', 'escape'];
const trainCentroid = trainKeys.reduce(
  (a, k) => ({ x: a.x + P[k].x / trainKeys.length, y: a.y + P[k].y / trainKeys.length }),
  { x: 0, y: 0 }
);

// Now that the real scale of the movement is known, size the orbit limits
// and initial camera framing to match (rather than fixed absolute units).
controls.minDistance = plateR * 0.35;
controls.maxDistance = plateR * 12;
camera.position.set(plateR * 2.0, plateR * 1.8, plateR * 3.0);
// Tighten the clip planes to the movement's real scale — the previous
// 0.5..2000 range gave poor depth-buffer precision at these distances,
// which was enough to z-fight the (sub-unit) hand-to-dial gap invisible.
camera.near = Math.max(0.5, plateR * 0.02);
camera.far = plateR * 20;
camera.updateProjectionMatrix();

// ---------------------------------------------------------------------------
// Mesh-phase interleaving: choose each driven wheel's constant rotation
// offset so a tooth never sits where its partner's tooth already is, for
// all time (guaranteed once true at any reference instant, since the ratio
// keeps module-matched gears in lockstep).
// ---------------------------------------------------------------------------
function meshOffset(driverPos, drivenPos, drivenTeeth, ratio, driverAngleAtRef) {
  const phi12 = Math.atan2(drivenPos.y - driverPos.y, drivenPos.x - driverPos.x);
  const phi21 = phi12 + Math.PI;
  const P2 = (Math.PI * 2) / drivenTeeth;
  return phi21 + ratio * driverAngleAtRef - P2 / 2;
}

// ---------------------------------------------------------------------------
// Escapement state machine — phase-driven keyframing off the balance clock.
// ---------------------------------------------------------------------------
function beatPhase(t) {
  const raw = t * 2 * F_BALANCE;
  const n = Math.floor(raw);
  const p = raw - n;
  return { n, p };
}

function escapeDeltaDeg(p) {
  if (p < IMPULSE_WIDTH) {
    const s = p / IMPULSE_WIDTH;
    if (s < RECOIL_FRACTION) {
      const rs = s / RECOIL_FRACTION;
      return -Math.sin(rs * Math.PI) * RECOIL_DEG;
    }
    const rs = (s - RECOIL_FRACTION) / (1 - RECOIL_FRACTION);
    return smoothstep(rs) * BEAT_DEG;
  }
  return BEAT_DEG;
}

function escapeAngle(t) {
  const { n, p } = beatPhase(t);
  return (n * BEAT_DEG + escapeDeltaDeg(p)) * DEG2RAD;
}

function forkBankAt(n) { return (n % 2 === 0) ? -1 : 1; }

function forkSwingRad(t) {
  const { n, p } = beatPhase(t);
  const bankStart = forkBankAt(n);
  const bankEnd = -bankStart;
  if (p < IMPULSE_WIDTH) {
    const s = p / IMPULSE_WIDTH;
    if (s < RECOIL_FRACTION) {
      const rs = s / RECOIL_FRACTION;
      const dip = Math.sin(rs * Math.PI);
      return (bankStart * FORK_BANK_DEG - Math.sign(bankStart) * dip * FORK_RECOIL_DEG) * DEG2RAD;
    }
    const rs = (s - RECOIL_FRACTION) / (1 - RECOIL_FRACTION);
    const eased = smoothstep(rs);
    return (bankStart * FORK_BANK_DEG + (bankEnd - bankStart) * FORK_BANK_DEG * eased) * DEG2RAD;
  }
  return bankEnd * FORK_BANK_DEG * DEG2RAD;
}

// Chain the rest of the train backwards off the escape wheel — pure
// gear-ratio functions, never integrated, so they never drift.
const escAt0 = escapeAngle(0);

const ratioFourth = TRAIN.fourth.pinion / TRAIN.fourth.teeth; // escape pinion teeth / fourth wheel teeth
const offFourth = meshOffset(P.escape, P.fourth, TRAIN.fourth.teeth, ratioFourth, escAt0);
function fourthAngle(t) { return offFourth - ratioFourth * escapeAngle(t); }
const fourthAt0 = fourthAngle(0);

const ratioThird = TRAIN.third.pinion / TRAIN.third.teeth; // fourth pinion teeth / third wheel teeth
const offThird = meshOffset(P.fourth, P.third, TRAIN.third.teeth, ratioThird, fourthAt0);
function thirdAngle(t) { return offThird - ratioThird * fourthAngle(t); }
const thirdAt0 = thirdAngle(0);

const ratioCenter = TRAIN.center.pinion / TRAIN.center.teeth; // third pinion teeth / center wheel teeth
const offCenter = meshOffset(P.third, P.center, TRAIN.center.teeth, ratioCenter, thirdAt0);
function centerAngle(t) { return offCenter - ratioCenter * thirdAngle(t); }
const centerAt0 = centerAngle(0);

// DIAL EPOCH — the angle the hands are FITTED at. Zero-referencing the hands
// against centerAt0 makes τ = 0 read 12:00:00 by construction; a watchmaker
// fits hands at whatever angle they please, so the boot pose is one constant
// folded into the hands' own reference. It is NOT folded into τ: that would
// claim the movement had already run 1 h 51 m, against a full barrel and a
// beat count of zero — three readouts disagreeing about the same history.
// The minute hand's rate converts between the two domains in both
// directions; read it off centerAngle rather than assuming −2π per hour.
const MIN_HAND_RAD_PER_SEC = (centerAngle(3600) - centerAngle(0)) / 3600;
const DIAL_EPOCH_S = 1 * 3600 + 51 * 60; // boot pose: 1:51:00
const DIAL_EPOCH_ANGLE = DIAL_EPOCH_S * MIN_HAND_RAD_PER_SEC;
// The jumper quantizes the setting offset on the MIN_PITCH grid without the
// epoch in hand (see tick()), so an epoch that is not a whole number of
// minutes would leave the minute hand permanently between two indices.
if (DIAL_EPOCH_S % 60 !== 0)
  console.warn(`dial epoch: ${DIAL_EPOCH_S}s is not a whole number of minutes — the jumper's index grid and the dial disagree`);

const ratioBarrel = TRAIN.barrel.pinion / TRAIN.barrel.teeth; // center pinion teeth / barrel teeth
const offBarrel = meshOffset(P.center, P.barrel, TRAIN.barrel.teeth, ratioBarrel, centerAt0);
function barrelMeshAngle(t) { return offBarrel - ratioBarrel * centerAngle(t); }

// Amplitude sags with the state of wind (real movements drop from ~300° to
// ~200° as the mainspring drains) and the oscillation runs on movement time τ.
function balanceTheta(tau, tension = 1) {
  const amp = AMPLITUDE_VISUAL_DEG * (0.55 + 0.45 * tension);
  return amp * DEG2RAD * Math.sin(2 * Math.PI * F_BALANCE * tau);
}

// ---------------------------------------------------------------------------
// Assemble arbor groups
// ---------------------------------------------------------------------------
// Fusee arbor — great wheel at the bottom (same mesh position the going
// barrel occupied), winding SPUR at the keyless plane above it, then the
// grooved cone. Spur and cone are keyed together: both take the winding
// spin; the great wheel turns only with the train.
const barrelArbor = new THREE.Group();
barrelArbor.position.set(P.barrel.x, P.barrel.y, L_BARREL);
greatWheel.position.z = 0;
barrelArbor.add(greatWheel);
// WINDING SPUR — at the BOTTOM of the fusee arbor, just above the base
// plate and UNDER the great wheel. With the keyless works on the dial side
// (Z_KEYLESS < 0), the winding has to cross the base plate somewhere — and
// the spur's mesh point sits only ~7.6 from the barrel axis, well INSIDE
// the great wheel's radius, so a crossing arbor at any spur-mesh XY would
// skewer the great wheel's disc… unless it stops BELOW it. Down here the
// crown-wheel arbor (see the winding path at the keyless assembly) can end
// its climb legally: plate top at 0, spur band, then the great wheel's
// underside at ~1.22 — everything clears by the margin. (The saw-toothed
// RATCHET this spur replaced now sits on the plate top, on a square of
// this same arbor, where its teeth serve only the click — see the windTop
// block at the upper pivots.)
const RATCHET_T = 0.8;
const Z_RATCHET_BOT = 0.15; // world: one margin above the plate's top face
// Hub-less like the transfer wheel it meshes: the band under the great
// wheel is ~1.2 tall and makeGear's stock hub ring (1.5·thickness) would
// eat both gaps.
const windSpur = G.makeGear({ module: KW_MODULE, teeth: WIND_SPUR_TEETH, thickness: RATCHET_T, boreR: 0.7, spokes: 0, material: MATS.steel, hub: false });
windSpur.name = 'windSpur';
const windSpurBase = Math.PI / WIND_SPUR_TEETH; // half-tooth phase so spur and transfer teeth interlace at rest (crownWheelBase convention)
// makeGear extrudes CENTERED (unlike the old ratchet builder's 0-based
// extrude), so the group z places the band's middle.
windSpur.position.z = Z_RATCHET_BOT + RATCHET_T / 2 - L_BARREL;
barrelArbor.add(windSpur);
fusee.position.z = FUSEE_BASE_Z; // cone base above the third wheel's plane
barrelArbor.add(fusee);
movement.add(barrelArbor);
registerExplode(barrelArbor, L_BARREL, 1);
registerLabel('Fusee & great wheel', barrelArbor);
// (No click anywhere on this arbor — see the let-down square comment at
// the upper pivots and the maintaining-power block after the drum.)

const centerArbor = new THREE.Group();
centerArbor.position.set(P.center.x, P.center.y, L_BARREL);
centerPinion.position.z = 0;
centerWheel.position.z = L_CENTER - L_BARREL;
centerArbor.add(centerPinion, centerWheel);
movement.add(centerArbor);
registerExplode(centerArbor, L_BARREL, 2);
registerLabel('Center wheel', centerArbor);

const thirdArbor = new THREE.Group();
thirdArbor.position.set(P.third.x, P.third.y, L_CENTER);
thirdPinion.position.z = 0;
thirdWheel.position.z = L_THIRD - L_CENTER;
thirdArbor.add(thirdPinion, thirdWheel);
movement.add(thirdArbor);
registerExplode(thirdArbor, L_CENTER, 3);
registerLabel('Third wheel', thirdArbor);

const fourthArbor = new THREE.Group();
fourthArbor.position.set(P.fourth.x, P.fourth.y, L_THIRD);
fourthPinion.position.z = 0;
fourthWheel.position.z = L_FOURTH - L_THIRD;
fourthArbor.add(fourthPinion, fourthWheel);
movement.add(fourthArbor);
registerExplode(fourthArbor, L_THIRD, 4);
registerLabel('Fourth wheel', fourthArbor);

const escapeArbor = new THREE.Group();
escapeArbor.position.set(P.escape.x, P.escape.y, L_FOURTH);
escapePinion.position.z = 0;
escapeWheel.position.z = L_ESCAPE - L_FOURTH;
// Phase the wheel so a tooth tip rests on the exit stone at each lock (the
// 84° stone embrace = 3.5 pitches then makes alternate beats land on the
// entry stone automatically). Tooth tips sit at (i + 0.22)·pitch in the
// wheel's local frame (see makeEscapeWheel); stones sit at (±s/2, s/2) in the
// fork's local frame, whose wheel centre lies at (0, palletStoneDist).
{
  const pitch = (Math.PI * 2) / 15;
  const half = forkSpan / 2;
  const exitLocal = Math.atan2(half - palletStoneDist, half);
  const exitWorld = exitLocal + forkBaseAngle;
  const tipPhase = 0.22 * pitch;
  const raw = exitWorld - tipPhase - escapeAngle(0);
  escapeWheel.rotation.z = ((raw % pitch) + pitch) % pitch;
}
escapeArbor.add(escapePinion, escapeWheel);
// The arbor itself — the low-escapement layout drops the wheel 2.45 under
// its own pinion, and nothing spanned that gap: from the side the two discs
// floated. A visible shaft from the wheel's hub top to the pinion's
// underside (dimensions from the same constants that place them: hub ring
// is wheelT·1.3 tall, pinion ESC_PINION_T thick).
{
  const hubTop = (L_ESCAPE - L_FOURTH) + (0.8 * 1.3) / 2;
  const pinionBot = -ESC_PINION_T / 2;
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 0.4, pinionBot - hubTop, 12), MATS.steel);
  shaft.rotation.x = Math.PI / 2;
  shaft.position.z = (hubTop + pinionBot) / 2;
  escapeArbor.add(shaft);
}
movement.add(escapeArbor);
registerExplode(escapeArbor, L_FOURTH, 5);
registerLabel('Escape wheel', escapeArbor);

const forkGroup = new THREE.Group();
forkGroup.position.set(P.fork.x, P.fork.y, L_FORK);
forkGroup.add(palletFork);
movement.add(forkGroup);
registerExplode(forkGroup, L_FORK, 6);
registerLabel('Pallet fork', forkGroup);

const balanceGroup = new THREE.Group();
balanceGroup.position.set(P.balance.x, P.balance.y, L_BALANCE);
balanceGroup.add(balanceWheel);
movement.add(balanceGroup);
registerExplode(balanceGroup, L_BALANCE, 7);
registerLabel('Balance', balanceGroup);

const hairspringGroup = new THREE.Group();
hairspringGroup.position.set(P.balance.x, P.balance.y, L_HAIRSPRING);
hairspringGroup.add(hairspring);
movement.add(hairspringGroup);
registerExplode(hairspringGroup, L_HAIRSPRING, 8);
registerLabel('Hairspring', hairspringGroup);

// ---------------------------------------------------------------------------
// Plates, cocks, pillars, jewels
// ---------------------------------------------------------------------------
// Named so the inspector can resolve the mechanical graph's structural
// nodes ('plate') to actual geometry: a support edge is only real if the
// supported part's meshes actually REACH the fixture — see
// checkSupportGeometry in inspect.js.
// Real openings, all measured from the hoisted keyless XY layout (the
// keyless works lives on the DIAL side of this plate now):
//  · a bored hole for the winding transfer arbor (the crown-wheel arbor
//    climbing from the dial-side clutch to the winding spur above the plate) —
//    cut PIVOT_BORE_CLEAR-style clearance over the 0.7 shaft, and the bore
//    IS that arbor's bearing, exactly like a train pivot;
//  · a clearance recess at the motion-works corner: the setting path's
//    drop→traverse bevel gear stands tip-up at the minute arbor's axis and
//    its cone reaches into the plate's z-band (the corner plane sits just
//    under the plate) — the recess is sized to the gear's tip circle;
//  · an arc SLOT for the setting lever's tail post, swept over the full
//    crown stroke (chord + measured bow, same construction as the
//    three-quarter plate's slot for this same post higher up).
// §25 C winding — hoisted: the CLIMB ARBOR (the alarm crown's winding path up
// to the plate top) pierces BOTH plates, so its axis must exist before either
// builds. ALARM_CD is the alarm stem corner's radius — its canonical
// definition IS RESERVE_LOCAL.y (dialRadius·0.39), and since §13 step 3b
// that value comes from solveKeyless as one source, so the old repeated
// arithmetic (and the drift assert that guarded it) is gone. The climb sits
// ONE CROWN THROW outboard of the setting corner: the stem's own pull
// (CROWN_PULL_DIST) is what carries its sliding bevel from the corner to the
// climb's contrate — the pull IS the clutch, no extra slide mechanism needed.
const ALARM_CD = RESERVE_LOCAL.y;
// Crown-sense swap: the CLIMB stands at the stem's INNER radius (the crown's
// pushed-in rest meshes it — winding is the resting action, the convention),
// and the setting corner sits one throw outboard (see ALARM_ARBOR_R).
const ALARM_WIND_X = ALARM_CD, ALARM_WIND_Y = 0;
const backPlate = G.makeBackPlate({
  radius: plateR, thickness: 2,
  holes: [
    { x: uWind.x * cwDist, y: uWind.y * cwDist, r: 0.7 + 0.05 },
    { x: minuteArborXY.x, y: minuteArborXY.y, r: 1.95 },
    { x: ALARM_WIND_X, y: ALARM_WIND_Y, r: 0.55 }, // §25 C: the climb arbor's lower bearing IS this bore
  ],
  slots: [{
    ax: postRel.x, ay: postRel.y, bx: postEng.x, by: postEng.y,
    r: G.SETTING_LEVER_POST_R + kwPostBow + CLEAR_MARGIN + 0.02,
  }],
});
backPlate.name = 'backPlate';
backPlate.position.set(0, 0, -1);
backPlate.receiveShadow = true;
movement.add(backPlate);
registerExplode(backPlate, -1, 0);

// ---------------------------------------------------------------------------
// THREE-QUARTER PLATE — the movement's upper plate, and the single structural
// decision this layout is built around.
//
// It REPLACES the three train bridges that used to span barrel→center,
// center→third and third→fourth. Those bridges were floating slabs: the
// inspector's checkSupportGeometry measured each one 2.7–5.9 units clear of
// the plate it was declared to be screwed to, and every arbor's "front
// bearing" was a jewel hanging in mid-air above the wheel. A 3/4 plate is
// the honest fix AND the historically correct one for this movement: one
// piece of nickel silver carrying the upper pivot of the fusee, centre,
// third, fourth and escape arbors plus the pallet fork, with the remaining
// quarter cut away so the balance swings in the open under its own cock.
//
// Z-STACK (all three numbers derived, not chosen):
//  · TQ_BOT_Z — the tallest thing that must run UNDER the plate (the pallet
//    fork's pivot boss, measured, not assumed) plus one CLEAR_MARGIN.
//  · TQ_T — 0.8 of nickel. The balance now sits IN this plate's z-band (its
//    rim underside L_BALANCE − RIM_H/2 is actually BELOW TQ_BOT_Z), so the
//    plate no longer separates fork from balance vertically at all — the
//    CUTAWAY's edge radius is what keeps plate and balance apart, in XY
//    (see TQ_CUT: base edge = the balance's measured swept radius + margin).
//    The hacking's stop crank stands in this same open cut (see the STOP
//    WORK block), so plate thickness owes it nothing either.
//  · Parts taller than TQ_BOT_Z that are SUPPOSED to cross the plate (the
//    spring drum, the setting lever's post + ramp collar, the reset hammer's
//    arbor) get real openings — see tqHoles/tqSlots at the plate build.
// ---------------------------------------------------------------------------
// (CLEAR_MARGIN is declared with the Z-stack constants at the top of the
// file — the balance's own plane derivation binds at it too.)
const _tqBox = new THREE.Box3();
function boxOf(obj) { obj.updateMatrixWorld(true); return _tqBox.setFromObject(obj).clone(); }
// Everything that runs under the plate for its whole width. (The drum, the
// hammer arbor and the lever post are excluded ON PURPOSE: they pass
// THROUGH it, and are cut for below.)
const TQ_UNDER = [barrelArbor, centerArbor, thirdArbor, fourthArbor, escapeArbor, forkGroup];
// SPRING_TOP_Z joins the max so the plate's underside and the balance
// cock's (SPRING_TOP_Z + margin, see the Z-stack block) coincide by
// construction — the cock sits IN the plate band, which is the design
// goal the restridden train serves. If a measured part ever outgrows the
// spring, the plate rises off the cock plane; warn loudly instead of
// letting the two drift apart silently.
const TQ_MEASURED_MAX = Math.max(...TQ_UNDER.map((o) => boxOf(o).max.z));
if (TQ_MEASURED_MAX > SPRING_TOP_Z + 1e-6) {
  console.warn(`3/4 plate floor bound by measured part (${TQ_MEASURED_MAX.toFixed(2)}) above the hairspring stack (${SPRING_TOP_Z.toFixed(2)}) — the balance cock will sit BELOW the plate band`);
  for (const o of TQ_UNDER) {
    const name = labelEntries.find((e) => e.obj === o)?.name ?? '(unlabeled)';
    console.warn(`  under-plate part ${name}: max z = ${boxOf(o).max.z.toFixed(3)}`);
  }
}
const TQ_BOT_Z = Math.max(TQ_MEASURED_MAX, SPRING_TOP_Z) + CLEAR_MARGIN;
const TQ_T = 0.8;
const TQ_TOP_Z = TQ_BOT_Z + TQ_T;
const TQ_MID_Z = TQ_BOT_Z + TQ_T / 2;

// --- Upper pivots. The counterpart of addLowerPivot below: each arbor's
// staff is continued UP from its own topmost geometry to the plate's
// mid-thickness, where it runs in a jewelled bore. The bore is cut
// PIVOT_BORE_CLEAR wider than the staff (a real pivot's side-shake), so the
// staff genuinely occupies a hole in the plate instead of interpenetrating
// it — the support edge measures that shake, well inside checkSupportGeometry's
// tolerance, and the overlap sweep stays clean.
const PIVOT_BORE_CLEAR = 0.05;
// Chaton seating: the jewels are SCREWED GOLD CHATONS dropped into real
// counterbores (see makeChaton), so each upper pivot costs the plate a
// stepped hole — counterbore diameter for the top CHATON_DEPTH, then the
// staff's own bore for the rest. CHATON_DEPTH is a little under half the
// plate so a full-thickness collar of material still carries the bearing.
const CHATON_DEPTH = 0.35;
const chatonOuterFor = (boreR) => boreR + 0.95; // = makeChaton's rubyR + 0.55
// Flat annulus, axis along +Z, centred on its own origin — the counterbore's
// floor collar (see the plate build).
function ringGeo(innerR, outerR, h) {
  const g = new THREE.LatheGeometry([
    new THREE.Vector2(innerR, -h / 2), new THREE.Vector2(outerR, -h / 2),
    new THREE.Vector2(outerR, h / 2), new THREE.Vector2(innerR, h / 2),
    new THREE.Vector2(innerR, -h / 2),
  ], 40);
  g.rotateX(Math.PI / 2); // LatheGeometry revolves about +Y — stand it along Z
  return g;
}
// JEWEL face: like ringGeo but the top face is DISHED — a flat seating ring
// at the rim, then a smooth concave fall to the bore: the oil sink every
// real jewel carries. A dead-flat glossy annulus in this ruby material reads
// as a bulging donut under the environment highlights; the dish breaks that
// into a rim ring + a moving inner gleam, which is how a set stone actually
// looks. Everything stays at or below the flush plane (z = +h/2), so
// clearances and the rubbed-in seating are untouched.
function jewelFaceGeo(boreR, outerR, h) {
  const g = new THREE.LatheGeometry([
    new THREE.Vector2(boreR, -h / 2), new THREE.Vector2(outerR, -h / 2),
    new THREE.Vector2(outerR, h / 2),
    new THREE.Vector2(outerR * 0.72, h / 2),
    new THREE.Vector2(outerR * 0.48, h * 0.18),
    new THREE.Vector2(boreR * 1.25, h * 0.02),
    new THREE.Vector2(boreR, -h * 0.05),
    new THREE.Vector2(boreR, -h / 2),
  ], 40);
  g.rotateX(Math.PI / 2);
  return g;
}
const tqPivots = []; // { x, y, staffR, jewelR } — consumed by the plate builder
// §25 C: the winding climb arbor's UPPER bearing — a jeweled pivot in the
// three-quarter plate like any train arbor (raycast-verified: the plate IS
// present at this XY; an earlier sparse vertex probe wrongly said otherwise).
tqPivots.push({ x: ALARM_WIND_X, y: ALARM_WIND_Y, staffR: 0.45, jewelR: 1.0, boreR: 0.55 });
function addUpperPivot(arbor, { staffR = 0.5, jewelR = 1.3, boreR = null } = {}) {
  const worldTop = boxOf(arbor).max.z;
  const len = TQ_MID_Z - worldTop;
  if (len > 0.05) {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(staffR, staffR, len, 12), MATS.steel);
    shaft.rotation.x = Math.PI / 2;
    shaft.position.z = (worldTop - arbor.position.z) + len / 2; // arbor-local
    arbor.add(shaft);
  }
  tqPivots.push({
    x: arbor.position.x, y: arbor.position.y, staffR, jewelR,
    boreR: boreR ?? staffR + PIVOT_BORE_CLEAR,
  });
}

// The train's upper pivots. (The fourth arbor's staff passes up through the
// heart cam's 0.6 bore, which is what the friction coupling grips.)
for (const arbor of [centerArbor, thirdArbor, fourthArbor, escapeArbor]) {
  addUpperPivot(arbor);
}
// The FUSEE arbor is the exception: it does not END in the plate — it
// passes THROUGH it and finishes in a short LET-DOWN square standing
// proud of the top face. There is deliberately NO ratchet or click on
// this arbor any more: the arbor turns BOTH ways (forward with the train
// as the chain pays off, backward under windBack) and a fixed pawl on a
// bidirectional ratchet is impossible — the wind is held by the
// escapement through the train, and the winding-time reversal is
// absorbed by the MAINTAINING POWER at the great wheel (see that block).
// The square is the watchmaker's let-down square: a key on it is how the
// power is safely released at the bench. A winding arbor runs in a plain
// bushed bore, not a jewel — and no jewel could pass the square anyway.
addUpperPivot(barrelArbor, { staffR: 0.5, jewelR: 0, boreR: 0.5 + PIVOT_BORE_CLEAR });
// Square across-corners = staff diameter (0.5·2), so the filed square
// passes the plate's own bore without opening it.
const FUSEE_SQ_S = 0.5 * Math.SQRT2;
const LETDOWN_H = 0.9; // proud of the plate face: enough engagement for a let-down key
const LETDOWN_TOP = TQ_TOP_Z + LETDOWN_H; // tallest thing on the plate top at this corner (rods run LOW now)
const windTop = new THREE.Group();
{
  // Shaft continuation: addUpperPivot's staff stops at the plate's
  // mid-thickness (its bearing plane); carry the round arbor on to the
  // plate's top face, where the square begins.
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, TQ_TOP_Z - TQ_MID_Z, 12), MATS.steel);
  shaft.rotation.x = Math.PI / 2;
  shaft.position.z = (TQ_MID_Z + TQ_TOP_Z) / 2 - L_BARREL;
  windTop.add(shaft);
  const square = new THREE.Mesh(new THREE.BoxGeometry(FUSEE_SQ_S, FUSEE_SQ_S, LETDOWN_H), MATS.steel);
  square.position.z = TQ_TOP_Z + LETDOWN_H / 2 - L_BARREL;
  windTop.add(square);
}
barrelArbor.add(windTop); // explodes and labels with 'Fusee & great wheel', which is what it is

// (The plate-top ratchet + click that used to stand here on the FUSEE
// arbor are gone — a fixed pawl on a bidirectional arbor was a display
// fiction. The construction is now honest and split in two: the STATIC
// set-up ratchet + click live low on the DRUM arbor above the BASE plate
// (see the SET-UP WORK block at the drum build), and the moving clicks
// are the MAINTAINING POWER pawls and detent at the great wheel.)
// The ESCAPE WHEEL pivots in this plate like the rest of the train — its
// bore sits in the tongue of plate the window leaves around it. Only the
// PALLET FORK does not: it gets a small standalone cap cock screwed to the
// BASE plate (see FORK COCK below), leaving the fork in the open where its
// action can be watched.

// Measured from VERTICES, not from a bounding box: Box3.setFromObject unions
// each child's box TRANSFORMED, which for a ring of tilted screw cylinders
// over-reports by 24% (12.73 for a wheel that actually reaches 10.27) and
// swings with the pose. Radii about the staff axis are rotation-invariant, so
// this is the real swept radius.
function xyRadiusAbout(obj, c, zMax = Infinity) {
  obj.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  let r = 0;
  obj.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      if (v.z <= zMax) r = Math.max(r, Math.hypot(v.x - c.x, v.y - c.y));
    }
  });
  return r;
}
const BAL_OUTER_R = Math.max(
  xyRadiusAbout(balanceGroup, P.balance),
  xyRadiusAbout(hairspringGroup, P.balance),
);

// (The balance cock, and the plate itself, are built at the end of the
// movement assembly — both need the drum, the setting lever's post sweep and
// the stop crank's solved bearing, which don't exist yet. See "THREE-QUARTER
// PLATE — build" below.)

// (The hacking BRAKE is the STOP WORK — a crank at the balance whose pad
// presses the rim's underside, driven by a thin hack rod from the setting
// lever's tail post; built after the keyless works below, since its linkage
// is calibrated from the post's crown stroke. The physical contact model
// that decelerates the balance is unchanged, in tick().)

// --- Reset hammer + heart cam (seconds-only stopwatch reset) -------------
// Mounted on its OWN arbor, coaxial with the fourth wheel but NOT rigidly
// keyed to it — a friction (cannon-pinion-style) coupling, same principle
// already used for the power-reserve arbor extension above. This is a
// deliberate choice, not a shortcut: the real fourth wheel is meshed
// through the escape wheel to a pallet fork that the hacking lever has
// ALSO locked, and correcting the seconds hand can require up to half a
// fourth-wheel revolution — geared up ~10:1 through the escape pinion,
// that's several full turns of the escape wheel, far past the fraction-of-
// a-tooth backward play a lever-escapement lock actually tolerates before
// re-locking on the opposite stone. Backdriving the REAL train through a
// live lock that far isn't a real option (short of breaking it) — real
// chronographs solve exactly this with a declutchable seconds wheel, so
// the hammer here acts on a slip-coupled display arbor instead: it can
// overpower the friction and cam the display to zero without disturbing
// the real going train, the minute hand, or the mainspring underneath.
const camRadius = fourthWheelR * 0.4;
const hammerArmLen = camRadius * 2.3;
// Mount the hammer perpendicular to the fourth→escape line, on the side
// away from the balance. The previous "away from both neighbours" heuristic
// (sum of the two away-vectors) degenerates in the tornado layout: the
// third and escape wheels sit on nearly OPPOSITE sides of the fourth wheel,
// so their away-vectors cancel and the tiny residual pointed the arm
// straight across the pallet fork (inspector finding: hammer ⇄ fork at
// every pose). The fork/balance always occupy the escape side and the
// balance flank; the perpendicular on the other flank is open by
// construction.
const uFEx = (P.escape.x - P.fourth.x), uFEy = (P.escape.y - P.fourth.y);
const uFEl = Math.hypot(uFEx, uFEy) || 1;
let outX = -uFEy / uFEl, outY = uFEx / uFEl;
if ((P.balance.x - P.fourth.x) * outX + (P.balance.y - P.fourth.y) * outY > 0) {
  outX = -outX; outY = -outY;
}
const uFourthOut = { x: outX, y: outY };
// Cam thinned 1.2 → 0.8: the hammer/cam ride ABOVE the three-quarter plate
// now (see Z_SECONDS_ARBOR below), and every bit of body thickness up
// there is height the compressed stack has to give back.
const CAM_T = 0.8;
const HAMMER_W = 2.0;
const heartCam = G.makeHeartCam({ radius: camRadius, thickness: CAM_T });
const hammerLever = G.makeHammerLever({ length: hammerArmLen, width: HAMMER_W });
// Pivot distance solved for a TANGENT seat: at 0° swing the roller's centre
// sits one roller radius outside the notch floor (rMin, plus the cam's
// bevel expansion), so the roller surface just kisses the notch instead of
// being over-driven a full roller radius INTO its flanks (the old
// rMin + armLen put the roller CENTRE on the notch floor).
const hammerPivotDist =
  heartCam.userData.rMin + heartCam.userData.bevel + hammerLever.userData.rollerR + hammerArmLen;
const hammerPivotPos = {
  x: P.fourth.x + uFourthOut.x * hammerPivotDist,
  y: P.fourth.y + uFourthOut.y * hammerPivotDist,
};
const hammerAimAngle = Math.atan2(-uFourthOut.y, -uFourthOut.x); // pivot -> fourth-wheel centre
const hammerBaseAngle = hammerAimAngle - Math.PI / 2;
// Phase the cam so its notch (local θ=0, i.e. local +X) points AT the
// hammer's pivot once reset — the notch must face the roller, which
// approaches from the pivot side (+uFourthOut from the cam centre, i.e.
// hammerAimAngle + π). The previous phase used hammerAimAngle itself,
// which aims the notch at the FAR side of the cam: at the seated pose the
// roller landed on the full-radius lobe (θ=π), buried ~3 units deep,
// instead of in the notch.
const camPhaseOffset = hammerAimAngle + Math.PI;
// Retracted swing angle — SOLVED, not fixed. While the watch runs, the cam
// spins continuously under the parked hammer (one rev/min), so EVERY
// feature of the lever — the bevel-expanded outline (taper corners, flared
// head, edge spans), the roller and the pivot boss — must stay outside the
// cam's whole swept disc (radius R + bevel: a lobe crosses any bearing
// twice a minute) by a clearance margin. The old fixed 30° left the head
// 0.84 INSIDE the sweep. In lever-local frame the cam centre sits at
// (D·sinθ, D·cosθ) for swing θ; scan-then-bisect the smallest clearing θ —
// the same build-time-solver pattern as HAMMER_TAIL_DELTA / STOP_BEARING.
const HAMMER_SWING_MARGIN = 0.35;
const HAMMER_SWING_RAD = (() => {
  const sweptR = heartCam.userData.r + heartCam.userData.bevel;
  const { outline, bevel, rollerR, bossR, length: armL } = hammerLever.userData;
  const n = outline.length;
  // Bevel-expanded outline: ExtrudeGeometry pushes each vertex out along
  // its miter normal (intersection of the two offset edges) — replicate
  // that so the solved angle matches the real mesh.
  const area = outline.reduce((s, p, i) => {
    const q = outline[(i + 1) % n];
    return s + p[0] * q[1] - q[0] * p[1];
  }, 0);
  const ccw = area > 0 ? 1 : -1;
  const edgeNormal = (ux, uy) => {
    const m = Math.hypot(ux, uy) || 1;
    return [(ccw * uy) / m, (-ccw * ux) / m];
  };
  const pts = outline.map((p, i) => {
    const a = outline[(i - 1 + n) % n], b = outline[(i + 1) % n];
    const n1 = edgeNormal(p[0] - a[0], p[1] - a[1]);
    const n2 = edgeNormal(b[0] - p[0], b[1] - p[1]);
    let mx = n1[0] + n2[0], my = n1[1] + n2[1];
    const mm = Math.hypot(mx, my) || 1;
    mx /= mm; my /= mm;
    // True miter factor (three.js applies no miter limit; the flared head's
    // corner reaches cosHalf ≈ 0.44) — only guard against degeneracy.
    const cosHalf = Math.max(mx * n1[0] + my * n1[1], 0.1);
    return [p[0] + (mx * bevel) / cosHalf, p[1] + (my * bevel) / cosHalf];
  });
  const distToLever = (cx, cy) => {
    let d = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
      const vx = bx - ax, vy = by - ay;
      const t = clamp(((cx - ax) * vx + (cy - ay) * vy) / (vx * vx + vy * vy), 0, 1);
      d = Math.min(d, Math.hypot(cx - ax - t * vx, cy - ay - t * vy));
    }
    d = Math.min(d, Math.hypot(cx, cy - armL) - rollerR); // roller — plain cylinder, no bevel
    d = Math.min(d, Math.hypot(cx, cy) - bossR);          // pivot boss
    return d;
  };
  const clearanceAt = (th) =>
    distToLever(hammerPivotDist * Math.sin(th), hammerPivotDist * Math.cos(th))
    - sweptR - HAMMER_SWING_MARGIN;
  // θ=0 is the seated pose (intended deep contact); clearance grows as the
  // lever swings away. Scan for the first clearing angle, then bisect.
  let lo = 0, hi = Math.PI / 2;
  for (let i = 1; i <= 180; i++) {
    const th = (i / 180) * (Math.PI / 2);
    if (clearanceAt(th) >= 0) { hi = th; lo = th - Math.PI / 360; break; }
  }
  for (let k = 0; k < 50; k++) {
    const m = (lo + hi) / 2;
    if (clearanceAt(m) >= 0) hi = m; else lo = m;
  }
  return hi;
})();

// Display-arbor plane — LOW, between the plates, in the band under the
// great wheel. The old above-plate berth cleaned the z-budget but put the
// whole reset/hack tower on the display side; this branch brings it back
// down. The mid-band (under the plate floor) is closed — the fusee cone's
// tip reaches 0.25 under it — but the LOW band is open: nothing on the
// fourth (display) axis below the third-wheel mesh, and the through-rod
// to the small-seconds dial already runs the full height for the cam to
// friction-couple onto. Bounds, both derived:
//  · cam bottom ≥ reset-rod band top + margin (the rod plane lives under
//    the great wheel — see ROD_PLANE_Z);
//  · cam + hammer boss top ≤ the CENTER WHEEL's underside − margin (its
//    rim passes 3.26 from the fourth axis, well inside the hammer's
//    swing, from z = L_CENTER − t/2).
const CW_UNDER_Z = L_CENTER - 1.0 / 2; // center wheel underside (thickness 1.0)
const Z_SECONDS_ARBOR = CW_UNDER_Z - CLEAR_MARGIN - (HAMMER_W * 0.6 * 1.4) / 2;
const secondsCamArbor = new THREE.Group();
secondsCamArbor.position.set(P.fourth.x, P.fourth.y, Z_SECONDS_ARBOR);
secondsCamArbor.add(heartCam);
movement.add(secondsCamArbor);
registerExplode(secondsCamArbor, Z_SECONDS_ARBOR, 4);
registerLabel('Heart cam (seconds reset)', secondsCamArbor);

const hammerGroup = new THREE.Group();
hammerGroup.position.set(hammerPivotPos.x, hammerPivotPos.y, Z_SECONDS_ARBOR);
hammerGroup.add(hammerLever);
movement.add(hammerGroup);
registerExplode(hammerGroup, Z_SECONDS_ARBOR, 4);
registerLabel('Reset hammer', hammerGroup);

// ---------------------------------------------------------------------------
// FORK COCK — a small standalone cap over the pallet fork's upper pivot,
// standing on ONE solved leg down to the BASE plate. The combined
// pallet-and-escape bridge it replaces spanned both axes and put a slab and
// a second leg across the escapement window; the escape wheel now pivots in
// the three-quarter plate with the rest of the train (addUpperPivot above),
// and the fork keeps the base-plate mounting that lets the escapement be
// fitted and adjusted with the plate in place. What the window frames now is
// the fork itself — nothing over it but this cap.
//
// The cap hugs the fork (slab bottom = fork top + margin) rather than riding
// up in the plate band: a low cap means a short honest staff and the least
// possible metal in the view. The balance rim shares this z-band, so the
// leg solve keeps the connecting bar clear of the rim's swept disc in XY.
const FORK_COCK_T = 1.0;                       // slab thickness
const FORK_COCK_BOT = L_FORK + FORK_T / 2 + CLEAR_MARGIN;
const FORK_COCK_JEWEL_Z = FORK_COCK_BOT + FORK_COCK_T; // slab top — the jewel sits here
const forkCock = (() => {
  // Everything the legs have to miss on the way down to the base plate.
  // Wheels and levers are given as their SWEPT DISCS about their own axes
  // (exact for a rotating part, and a bounding box is useless here — the
  // fourth wheel's box contains the whole escapement).
  const discs = [
    [barrelArbor, P.barrel], [centerArbor, P.center], [thirdArbor, P.third],
    [fourthArbor, P.fourth], [escapeArbor, P.escape], [forkGroup, P.fork],
    [secondsCamArbor, P.fourth], [hammerGroup, hammerPivotPos],
  ].map(([o, c]) => ({ x: c.x, y: c.y, r: xyRadiusAbout(o, c, FORK_COCK_BOT) }));
  // The BALANCE counts for its whole swept radius, not just the staff and
  // roller that share the legs' z band. Mechanically a leg could stand under
  // the rim's overhang; but the fork lies between the escape wheel and the
  // balance, so "outboard of the fork, away from the escape" points straight
  // at the balance axis — and the first version put a leg exactly on it,
  // through the staff. Excluding the wheel's whole footprint also keeps the
  // legs out of the one view this bridge exists to open up.
  discs.push({ x: P.balance.x, y: P.balance.y, r: BAL_OUTER_R });
  const floorClear = (x, y) => {
    let c = Infinity;
    for (const d of discs) c = Math.min(c, Math.hypot(x - d.x, y - d.y) - d.r);
    return c;
  };
  // The boss carries a rubbed-in jewel in its counterbore — sized so the
  // boss keeps a full ring of metal outside the recess. (Declared before
  // the leg solve: the leg must clear for the BAR that will connect it to
  // this boss, whose width follows the boss radius.)
  const forkBore = 0.35 + PIVOT_BORE_CLEAR;
  // Fork boss at 1.5: the balance's timing screws share this slab's
  // z-band, and the boss is the cap's closest feature to the balance axis.
  // The jewel's counterbore is fork-sized (forkCbR below, bore + 0.55),
  // so the boss keeps a full 0.55 ring of nickel around the stone.
  const bossFork = chatonOuterFor(forkBore) + 0.15;
  // One leg outboard of each axis. Scan the bearing away from the other axis
  // (±100°) and the reach; take the nearest feasible seat, which keeps the
  // bridge compact. hostBossR is the host end's boss radius — it sizes the
  // connecting bar the seat commits the bridge to.
  const legFor = (host, other, legR, hostBossR) => {
    const away = Math.atan2(host.y - other.y, host.x - other.x);
    // What must clear at the seat is the chain NODE built there (legR·1.35)
    // — the leg shaft alone under-clears by 0.4, which was latent while the
    // balance rode above the slab and bites now that they share a z-band.
    const nodeR = legR * 1.35;
    const barHW = Math.min(hostBossR, nodeR) * 0.8; // makeEscapeBridge's bar half-width
    let best = null;
    for (let dd = 0; dd <= 100; dd += 2) {
      for (const sgn of dd === 0 ? [1] : [1, -1]) {
        const a = away + sgn * dd * DEG2RAD;
        for (let reach = 3; reach <= 16; reach += 0.25) {
          const x = host.x + Math.cos(a) * reach, y = host.y + Math.sin(a) * reach;
          if (Math.hypot(x, y) > plateR - legR - 1) continue;
          if (floorClear(x, y) < nodeR + CLEAR_MARGIN) continue;
          // The BAR from the host boss to this seat rides in the slab's own
          // z-band — the band the balance (rim + timing screws) now sweeps —
          // so the bar's edge must clear the balance's swept disc in XY.
          // (The old solve never looked at the bar: harmless when the
          // balance was 2.3 higher, a through-the-rim cut once it dropped.)
          const vx = x - host.x, vy = y - host.y;
          const L2 = vx * vx + vy * vy || 1e-9;
          const t = clamp(((P.balance.x - host.x) * vx + (P.balance.y - host.y) * vy) / L2, 0, 1);
          const dBar = Math.hypot(P.balance.x - host.x - t * vx, P.balance.y - host.y - t * vy);
          if (dBar < BAL_OUTER_R + barHW + CLEAR_MARGIN) continue;
          if (!best || reach < best.reach) best = { x, y, reach, a };
        }
      }
      if (best) break;
    }
    return best;
  };
  const legR = 1.15;
  const legB = legFor(P.fork, P.escape, legR, bossFork);
  if (!legB) console.warn('fork cock: no clear footing for its leg');
  // The jewel is seated FULLY: a fork-sized counterbore (bore + 0.55, not
  // the chaton family's bore + 0.95) sunk 0.65·T deep, so the ruby sits
  // its whole height in the bore with a 0.35·T bearing collar beneath and
  // a full 0.55 ring of nickel around it — the old shallow CHATON_DEPTH
  // seat left the stone standing more than half proud of a thin wall.
  const forkCbR = forkBore + 0.55;
  const forkCbDepth = FORK_COCK_T * 0.65;
  const chain = [
    { x: P.fork.x, y: P.fork.y, r: bossFork, bore: forkBore, cbR: forkCbR, cbDepth: forkCbDepth },
    { x: legB.x, y: legB.y, r: legR * 1.35, foot: true },
  ];
  const g = G.makeEscapeBridge({
    chain,
    thickness: FORK_COCK_T,
    // The leg reaches the BASE plate's top face (it spans [z−1, z+1]) —
    // measured from the slab's underside, where makeEscapeBridge hangs it.
    footDrop: FORK_COCK_BOT - (backPlate.position.z + 1),
    jewels: [
      { x: P.fork.x, y: P.fork.y, boreR: forkBore, cbR: forkCbR, depth: forkCbDepth },
    ],
  });
  g.position.set(0, 0, FORK_COCK_BOT + FORK_COCK_T / 2);
  movement.add(g);
  registerExplode(g, FORK_COCK_BOT + FORK_COCK_T / 2, 7);
  registerLabel('Fork cock', g);
  return { obj: g, chain, legB, legR };
})();
// The fork's staff runs UP to the cap's top face, into its jewel. (The
// escape wheel's staff is grown by addUpperPivot with the rest of the train.)
{
  const top = boxOf(forkGroup).max.z;
  const len = FORK_COCK_JEWEL_Z - top;
  if (len > 0.05) {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, len, 12), MATS.steel);
    shaft.rotation.x = Math.PI / 2;
    shaft.position.z = (top - forkGroup.position.z) + len / 2;
    forkGroup.add(shaft);
  }
}

// --- The plate's opening ----------------------------------------------------
// ONE continuous cutaway, and it has two jobs:
//   · the BALANCE quarter — a wedge of half-angle phiOpen about the plate
//     centre → balance line, open all the way to the rim, so the balance
//     hangs in the clear under its cock (~96° of rim removed);
//   · the ESCAPEMENT WINDOW — the opening then runs on inland to expose the
//     pallet fork and the cap cock holding it. The ESCAPE WHEEL now pivots
//     in this plate (its bore in the tongue the window leaves around it), so
//     it no longer votes for the opening — what the window frames is the
//     fork's action, with the wheel's rim showing at the window's edge.
// They are adjacent — the escapement sits ~103° off the balance's outward
// bearing — so they merge into one kidney-shaped opening running from the rim
// around the balance and out over the escapement, which is also how these
// plates are actually shaped.
//
// The window is MEASURED, not drawn: the edge radius is tabulated per degree
// about the balance axis as the furthest any revealed part reaches on that
// bearing, plus a margin. The parts vote for their own opening, so the plate
// keeps every scrap of material that nothing needs — which is what stops this
// from becoming a skeleton frame. Sampled across the beat because the fork
// banks and the escape wheel turns.
const TQ_CUT_MARGIN = 0.5; // now a RUNNING clearance as well as a service one: with the
                           // balance lowered into the plate band, the wheel + its timing
                           // screws (tips at BAL_OUTER_R) sweep INSIDE the plate's z-band,
                           // so the cut's base edge (BAL_OUTER_R + this) is what physically
                           // clears them at every azimuth — the escapement stretch of the
                           // window is still sized for the eye and the bridge screws.
// Table finishing, shared by the initial solve and the post-cock second
// pass (see the balance-cock reveal further down): a per-degree max is a
// saw edge, and a plate edge is milled by a cutter of finite radius —
// running max over ±6°, then light smoothing. Both only ever ADD clearance.
function finishCutRadii(raw) {
  const spread = raw.map((_, i) => {
    let m = 0;
    for (let d = -6; d <= 6; d++) m = Math.max(m, raw[((i + d) % 360 + 360) % 360]);
    return m;
  });
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < 360; i++) {
      const a = spread[(i + 359) % 360], b = spread[(i + 1) % 360];
      spread[i] = Math.max(spread[i], (a + b) / 2);
    }
  }
  return spread;
}
const TQ_CUT = (() => {
  const aim = Math.atan2(P.balance.y, P.balance.x);
  const phiOpen = 75 * DEG2RAD;
  const radii = new Array(360).fill(BAL_OUTER_R + TQ_CUT_MARGIN);
  const bump = (x, y) => {
    const dx = x - P.balance.x, dy = y - P.balance.y;
    const r = Math.hypot(dx, dy) + TQ_CUT_MARGIN;
    const deg = Math.round(((Math.atan2(dy, dx) - aim) * 180) / Math.PI);
    const i = ((deg % 360) + 360) % 360;
    if (r > radii[i]) radii[i] = r;
  };
  const v = new THREE.Vector3();
  // Each part contributes its SWEPT footprint, built from its own motion
  // rather than from posed snapshots (poses only exist once tick() runs):
  //  · pallet fork — banks ±(FORK_BANK_DEG + FORK_RECOIL_DEG) about its
  //    pivot, so its vertices swept through exactly that arc;
  //  · the fork cock — static.
  // (The escape wheel no longer contributes: it pivots in this plate.)
  const bankRad = (FORK_BANK_DEG + FORK_RECOIL_DEG) * DEG2RAD;
  forkGroup.updateMatrixWorld(true);
  forkGroup.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      const dx = v.x - P.fork.x, dy = v.y - P.fork.y;
      const rho = Math.hypot(dx, dy), th = Math.atan2(dy, dx);
      for (let k = -2; k <= 2; k++) {
        const a = th + (k / 2) * bankRad;
        bump(P.fork.x + Math.cos(a) * rho, P.fork.y + Math.sin(a) * rho);
      }
    }
  });
  forkCock.obj.updateMatrixWorld(true);
  forkCock.obj.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      bump(v.x, v.y);
    }
  });
  // The RAW table is kept alongside the finished one: the balance-cock
  // reveal (further down, once the cock exists) bumps the raw table and
  // re-finishes ONCE — finishing twice would over-widen every original
  // feature by another cutter radius.
  return { x: P.balance.x, y: P.balance.y, aim, phiOpen, rawRadii: radii, radii: finishCutRadii(radii) };
})();
// (The pillars are built with the three-quarter plate they carry, at the end
// of the assembly — their seating angles are solved against the plate's cut
// and openings, which don't exist yet.)

// ---------------------------------------------------------------------------
// LOWER PIVOTS — every arbor runs in a bearing at BOTH ends.
//
// Until now the train hung in space: each wheel had a "front bearing" jewel
// floating above it and NOTHING below, so no arbor in the movement was
// constrained at both ends (inspector: checkSupportGeometry reported the
// third/fourth/escape wheels and the drum 2.2–6.5 units clear of the plate
// they were declared to pivot in). A watch arbor is a staff with a turned
// pivot at each end; the lower one runs in a jewel set in the main plate.
//
// Each staff is continued from the arbor's own lowest geometry down through
// the plate's top face, ending inside the plate's thickness — a real pivot
// seated in a real hole, not a part resting on a surface. Extents come from
// each arbor's actual bounding box, so re-layering the Z-stack moves the
// pivots with it rather than stranding hand-written lengths.
// ---------------------------------------------------------------------------
const PLATE_TOP = backPlate.position.z + 1;   // back plate spans [z−1, z+1]
const PIVOT_SEAT_Z = backPlate.position.z;    // pivot bottoms out mid-plate
const _pivotBox = new THREE.Box3();
function addLowerPivot(arbor, { staffR = 0.5, jewelR = 1.3 } = {}) {
  arbor.updateMatrixWorld(true);
  _pivotBox.setFromObject(arbor);
  const worldBottom = _pivotBox.min.z;
  const len = worldBottom - PIVOT_SEAT_Z;
  if (len <= 0.05) return; // already reaches into the plate
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(staffR, staffR, len, 12), MATS.steel);
  shaft.rotation.x = Math.PI / 2;
  shaft.position.z = (worldBottom - arbor.position.z) - len / 2; // arbor-local
  arbor.add(shaft);
  // Jewel hole in the plate's top face, coaxial with the staff.
  const jewel = G.makeJewelSetting({ r: jewelR });
  jewel.position.set(arbor.position.x, arbor.position.y, PLATE_TOP);
  movement.add(jewel);
}
for (const arbor of [barrelArbor, centerArbor, thirdArbor, fourthArbor, escapeArbor]) {
  addLowerPivot(arbor);
}
// Dial-side counterpart: parts living UNDER the plate (the keyless works'
// setting lever and yoke) pivot on studs planted in the plate's BACK face —
// shaft from the part's own plane UP to mid-plate, jewel set into the back
// face, mirroring the movement-side convention above. The caller passes the
// part's plane explicitly (a box measure is wrong here: the lever's tail
// post spans the whole movement, so its box top is nowhere near its body).
const PLATE_BACK = backPlate.position.z - 1; // back plate spans [z−1, z+1]
function addDialSidePivot(arbor, { staffR = 0.5, jewelR = 1.3, fromZ } = {}) {
  const len = PIVOT_SEAT_Z - fromZ;
  if (len <= 0.05) return;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(staffR, staffR, len, 12), MATS.steel);
  shaft.rotation.x = Math.PI / 2;
  shaft.position.z = (fromZ - arbor.position.z) + len / 2; // arbor-local
  arbor.add(shaft);
  const jewel = G.makeJewelSetting({ r: jewelR });
  jewel.rotation.x = Math.PI; // rim proud of the BACK face, recess up into the plate
  jewel.position.set(arbor.position.x, arbor.position.y, PLATE_BACK);
  movement.add(jewel);
}
// The pallet fork carries the highest-frequency loads in the watch and had
// no bearing geometry whatsoever — a pivot boss floating in space. Its
// staff now reaches the plate like any other arbor (thinner: a fork staff
// is a light, fast-moving part).
addLowerPivot(forkGroup, { staffR: 0.35, jewelR: 1.0 });
// The BALANCE staff had no lower bearing at all — it stopped in open air
// just past the safety roller while only the cock's jewel held it from
// above. Same helper: the staff continues from its current bottom (the
// group's box-min is the staff tip, on-axis) down to mid-plate, running
// into a rubbed-in jewel in the plate's top face. Nothing else occupies
// the axis below (the stop crank works at radius ≈ 8.5+).
addLowerPivot(balanceGroup, { staffR: 0.3, jewelR: 1.0 });
// (The spring drum gets its lower pivot where it is built, further down —
// declaring it here would read drumGroup before its `const`.)

// ---------------------------------------------------------------------------
// Keyless works — a real two-position sliding-pinion clutch, on the DIAL
// SIDE of the base plate (plane Z_KEYLESS) as in a real watch. windPinion
// IS the sliding pinion: it rides on windSpinner, which slides axially
// along the stem for the crown pull/push (see CROWN_PULL_DIST). In the
// pushed-in ("winding") position it meshes the crown wheel, whose arbor
// climbs through a real bore in the base plate to the winding transfer
// wheel that meshes the fusee arbor's winding spur just above the plate's
// movement face. Pulled out ("setting"), it slides clear of the crown wheel and
// meshes settingWheel instead → minuteArbor (a compound wheel+pinion, same
// trick as the power-reserve train's reduction) → the motion works' minute
// wheel, a short same-side run away — bypassing the going train entirely,
// exactly why you can set a watch's hands without touching its power
// reserve. Which path is live is decided in tick() by the sliding pinion's
// ACTUAL animated position (crownPullT), not the raw crown target, so
// mid-slide it's out of mesh with both, same as a real clutch in transit.
// (All XY layout constants — uWind / vPerp / sideSign, cwDist / pinDist /
// swDist, the lever and yoke pivots and tailPostWorldAt — are hoisted up
// by the plate-radius computation: the base plate's own openings are
// measured from them.)
// ---------------------------------------------------------------------------
const keyless = new THREE.Group();
movement.add(keyless);
registerLabel('Keyless works', keyless);
registerExplode(keyless, 0, 4, -1); // dial-side unit: explodes toward the dial

// --- Winding path: crown wheel + transfer arbor → winding spur ------------
// Two coaxial wheels on one arbor at cwDist: the CROWN WHEEL proper on the
// dial side (meshed by the sliding pinion) and the winding TRANSFER wheel
// in the thin band between the plate's top face and the great wheel's
// underside, where it meshes the fusee arbor's winding SPUR (a crossing
// arbor anywhere at spur-mesh distance sits INSIDE the great wheel's
// radius, so the climb must END below that wheel; the saw-toothed ratchet
// itself lives on the plate top now, serving only the click). The arbor
// runs in a real bored hole in the plate; the bore is its bearing. The
// same tooth count top and bottom keeps the crown→fusee ratio exactly
// what it was when the crown wheel meshed the ratchet directly (the
// middle wheel telescopes out of the ratio), and the path still has TWO
// meshes, so the winding sense is unchanged too.
const crownWheel = G.makeGear({ module: KW_MODULE, teeth: crownWheelTeeth, thickness: 1.1, boreR: 0.7, spokes: 0, material: MATS.steel });
const crownWheelBase = Math.PI / crownWheelTeeth; // half-tooth phase into the spur
crownWheel.position.set(uWind.x * cwDist, uWind.y * cwDist, Z_KEYLESS);
keyless.add(crownWheel);
// Transfer wheel: hub-less — its band between plate top and great-wheel
// underside is only ~1.2 tall, and the stock hub ring would eat both gaps.
const Z_TRANSFER = Z_RATCHET_BOT + RATCHET_T / 2; // coplanar with the winding spur
const transferWheel = G.makeGear({ module: KW_MODULE, teeth: crownWheelTeeth, thickness: RATCHET_T, boreR: 0.7, spokes: 0, material: MATS.steel, hub: false });
transferWheel.position.set(uWind.x * cwDist, uWind.y * cwDist, Z_TRANSFER);
keyless.add(transferWheel);
const transferArbor = new THREE.Mesh(
  new THREE.CylinderGeometry(0.7, 0.7, Z_TRANSFER - Z_KEYLESS, 14), MATS.steel);
transferArbor.rotation.x = Math.PI / 2;
transferArbor.position.set(uWind.x * cwDist, uWind.y * cwDist, (Z_TRANSFER + Z_KEYLESS) / 2);
keyless.add(transferArbor);
// The crown wheel's blued screw — on the arbor's dial-side end now (its
// old spot atop the wheel is where the arbor leaves for the plate bore).
const cwScrew = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.0, 12), MATS.blueSteel);
cwScrew.rotation.x = Math.PI / 2;
cwScrew.position.set(uWind.x * cwDist, uWind.y * cwDist, Z_KEYLESS - 0.55 - 0.5);
keyless.add(cwScrew);

// Everything on the stem axis lives in one spinner group (local +Y = outward).
const windPinion = G.makePinion({ module: KW_MODULE, teeth: windPinionTeeth, thickness: 1.6, material: MATS.steel });
const windSpinner = new THREE.Group();
windSpinner.position.set(uWind.x * pinDist, uWind.y * pinDist, Z_KEYLESS);
// Euler order matters: the winding spin (rotation.y) must compose BEFORE the
// z-orientation, i.e. about the stem's own local axis — with the default
// 'XYZ' order the spin happens about world Y and the stem precesses a cone.
windSpinner.rotation.order = 'ZYX';
windSpinner.rotation.z = stemAngle - Math.PI / 2;
keyless.add(windSpinner);

windPinion.rotation.x = Math.PI / 2; // gear plane ⊥ stem → axis along the stem
windSpinner.add(windPinion);

const stemLen = plateR + 2.2 - pinDist;
const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, stemLen, 12), MATS.steel);
stem.position.y = stemLen / 2;
windSpinner.add(stem);

// Stem bushing — the stem's actual support: a bored boss at the plate rim
// that the stem slides and spins through. The keyless works hangs UNDER
// the plate now, so the foot hangs too: from the plate's BACK face (top
// end embedded 0.6 into the plate, like the old foot's seat into the top
// face) down to the bush.
{
  const bushDist = plateR - 2;
  const bush = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.55, 10, 20), MATS.nickel);
  // Torus plane ⊥ stem: its hole must point along the stem axis.
  bush.rotation.z = stemAngle;
  bush.rotation.y = Math.PI / 2;
  bush.rotation.order = 'ZYX';
  bush.position.set(uWind.x * bushDist, uWind.y * bushDist, Z_KEYLESS);
  keyless.add(bush);
  const footTop = -1.4; // 0.6 into the plate's back face (−2)
  const foot = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, footTop - Z_KEYLESS), MATS.nickel);
  foot.position.set(uWind.x * bushDist, uWind.y * bushDist, (footTop + Z_KEYLESS) / 2);
  keyless.add(foot);
}

// (CROWN_PULL_DIST — the stem's outward slide when hacking — is declared up
// by the plate-radius computation; the winding pinion rides on this same
// group, so pulling out also disengages it from the crown wheel, as on a
// real sliding-pinion keyless works.)

// Brand crown (§27) — traditional knurled barrel with the knurl ENLARGED
// (fewer, round, smooth-shaded ridges) and makeBrandMark's ∞ in relief on
// the face (see makeCrown in geometry.js). Same bodyR/bodyH as the fine-
// knurl crown it replaces: the redesign stays inside that build's PROVEN
// swept envelope (asserted in the builder), so every standing clearance
// row holds without re-derivation.
const crown = G.makeCrown({ bodyR: 5.425, bodyH: 4.55, material: MATS.steel }); // +75% over the original 3.1/2.6
crown.rotation.x = -Math.PI / 2; // builder's +Z face → outward along the stem (+Y)
crown.position.y = stemLen - 0.7; // base where the old crown's base sat
windSpinner.add(crown);

const RATCHET_TEETH = WIND_SPUR_TEETH; // the spur's count — sets the crown→fusee winding ratio
// (Pawl and detent ride constants live with the maintaining-power block;
// the fusee arbor itself carries no ratchet any more.)

// --- Setting path: setting wheel -> minute wheel/pinion (compound) --------
// Positioned further out along the stem than crownWheel, at the sliding
// pinion's PULLED-OUT position, so the same pinion leaves crownWheel's mesh
// and picks up this one instead. minuteArbor is a compound wheel+pinion
// (like the reserve train's rsvWheel1/reservePinion1) purely to get an
// extra reduction stage without a 4th visible wheel; its pinion's rotation
// is what tick() reads to drive the hands (see handSetOffset) — a
// representational hop across the plate/dial gap, same convention already
// used for the power-reserve arbor, not a literal continuous mesh into the
// dial's flipped coordinate frame.
const settingWheel = G.makeGear({ module: KW_MODULE, teeth: settingWheelTeeth, thickness: 1.1, boreR: 0.7, spokes: 0, material: MATS.steel });
const settingWheelBase = Math.PI / settingWheelTeeth;
settingWheel.position.set(uWind.x * swDist, uWind.y * swDist, Z_KEYLESS);
keyless.add(settingWheel);

const minuteWheel = G.makeGear({ module: KW_MODULE, teeth: minuteWheelTeeth, thickness: 1.0, boreR: 0.6, spokes: 4, material: MATS.brass });
const minuteWheelBase = Math.PI / minuteWheelTeeth;
const minutePinion = G.makePinion({ module: 0.28, teeth: minutePinionTeeth, thickness: 1.3, material: MATS.steel });
// Pinion steps toward the DIAL below the wheel (same side as before the
// move, keeping the compound stack's read direction): 1.8 rather than the
// old 2.0 so the pinion's underside holds one margin over the dial face —
// the whole cluster is only ~2.9 above the dial now.
const MINUTE_Z_STEP = 1.8;
// The minute wheel FOLDS perpendicularly off the stem line instead of
// continuing outward: straight-line continuation would put it (and its own
// radius) well past the plate rim. Folded to the side AWAY from the setting
// lever (−sideSign), it clears the lever's tall tail post and the yoke's
// prongs — their flat bodies live ~2 units below this plane, and the only
// parts of them that rise through it sit on the stem axis or the lever
// side. The perpendicular mesh with the setting wheel is unchanged spur
// meshing; only the centre-line direction rotates.
// (mwFoldD / minuteArborXY are hoisted with the XY layout.)
const minuteArbor = new THREE.Group();
minuteArbor.position.set(minuteArborXY.x, minuteArborXY.y, Z_KEYLESS);
minutePinion.position.z = -MINUTE_Z_STEP;
minuteArbor.add(minuteWheel, minutePinion);
keyless.add(minuteArbor);
// Motion-works arbor toward the dial centre — the minute pinion is nowhere
// near the cannon pinion (the keyless works sits out at the plate edge, by
// the crown; the cannon pinion sits on the centre-wheel axis), so this has
// to actually SPAN that distance to read as connected. Steel rod: a short
// RISE from the minute arbor's plane to the crossing plane just under the
// plate's back face, the traverse across to the motion works, then down to
// meet the minute wheel's plane — ending in a small pinion cap engaging
// real teeth. With the keyless works on the dial side this whole run is a
// SAME-SIDE affair: the old version's 9.6-unit plunge straight through the
// solid base plate is gone; nothing on this path crosses a plate any more.
//
// Every direction change is still a real 90° bevel-gear pair (see
// makeBevelGear) — a plain rod meeting another rod at an angle has nothing
// at the joint that could transmit rotation around the corner. Rotation is
// still driven by handSetOffset in tick() (same representational-coupling
// convention as the reserve train), threaded through each corner pair with
// alternating sign, not just teleported to the far end.
const Z_SETTING = -3.0; // traverse plane: between the plate's back bevel (−2.3) and the reserve gear plane (Z_RSV −4.2, w1 tops at −3.7)
const settingArborXY = { x: minuteArborXY.x, y: minuteArborXY.y };
// The arbor's own shaft: from the minute pinion's plane UP to the corner.
const settingDrop = new THREE.Mesh(
  new THREE.CylinderGeometry(0.35, 0.35, Z_SETTING - (Z_KEYLESS - MINUTE_Z_STEP), 10), MATS.steel);
settingDrop.rotation.x = Math.PI / 2;
settingDrop.position.set(settingArborXY.x, settingArborXY.y, (Z_SETTING + Z_KEYLESS - MINUTE_Z_STEP) / 2);
keyless.add(settingDrop);

function makeRodSegment(a, b, radius) {
  const len = a.distanceTo(b);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 10), MATS.steel);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return mesh;
}

const BEVEL_TEETH = 10, BEVEL_MODULE = 0.3, BEVEL_PHASE = Math.PI / BEVEL_TEETH;
const settingA = new THREE.Vector3(settingArborXY.x, settingArborXY.y, Z_SETTING);
// The arbor terminates at the MOTION WORKS' MINUTE WHEEL — the wheel a real
// setting path drives — not at the dial centre. (The old dial-centre
// stand-in ended in a pinion cap beside the cannon pinion, meshing nothing,
// and collided with the real motion works once they existed: it caused all
// three FORBIDDEN overlaps — Dial⇄Motion works, Hour wheel⇄Keyless works,
// Keyless works⇄Motion works. TODO.md item 1.)
// Minute wheel world XY: dialFace is Y-flipped, so dial-local +x maps to
// world −x. The cap pinion sits one mesh distance from its axis, on the
// keyless side so the traverse is the short way in.
const MW_WORLD = { x: P.dial.x - MW_CENTER_D, y: P.dial.y };
const SETTING_CAP_TEETH = 8;
const capMeshD = (MW_MODULE_1 * (SETTING_CAP_TEETH + MW_MINUTE_TEETH)) / 2;
const toKeyless = new THREE.Vector2(settingArborXY.x - MW_WORLD.x, settingArborXY.y - MW_WORLD.y).normalize();
const SETTING_CAP_XY = { x: MW_WORLD.x + toKeyless.x * capMeshD, y: MW_WORLD.y + toKeyless.y * capMeshD };
const settingB = new THREE.Vector3(SETTING_CAP_XY.x, SETTING_CAP_XY.y, Z_SETTING);
const settingU = settingB.clone().sub(settingA).normalize();
keyless.add(makeRodSegment(settingA, settingB, 0.35));

const Z_CANNON_PINION = Z_DIAL + 1.5; // cannonPinion & minute wheel plane: dialFace local −1.5, Y-flip maps to Z_DIAL + 1.5
const settingRise = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, Z_SETTING - Z_CANNON_PINION, 10), MATS.steel);
settingRise.rotation.x = Math.PI / 2;
settingRise.position.set(SETTING_CAP_XY.x, SETTING_CAP_XY.y, (Z_SETTING + Z_CANNON_PINION) / 2);
keyless.add(settingRise);

// Bevel-gear corner: two small conical gears sharing an apex at `point`, one
// keyed to each of the two meeting shafts. axisIn/axisOut point AWAY from
// the corner, back into each gear's own shaft body — a gear keyed to the end
// of an arbor has its body trailing back along that arbor from the pitch
// point, same as a real bevel gear.
function addBevelCorner(point, axisIn, axisOut) {
  const mountIn = new THREE.Group();
  mountIn.position.copy(point);
  mountIn.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), axisIn);
  const gearIn = G.makeBevelGear({ teeth: BEVEL_TEETH, module: BEVEL_MODULE });
  mountIn.add(gearIn);

  const mountOut = new THREE.Group();
  mountOut.position.copy(point);
  mountOut.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), axisOut);
  const gearOut = G.makeBevelGear({ teeth: BEVEL_TEETH, module: BEVEL_MODULE });
  gearOut.rotation.z = BEVEL_PHASE; // half-tooth phase so teeth interleave at rest
  mountOut.add(gearOut);

  keyless.add(mountIn, mountOut);
  return { gearIn, gearOut };
}

const Z_UP = new THREE.Vector3(0, 0, 1);
// rise → traverse and traverse → drop: two corners, both exactly 90°. The
// first corner's vertical gear stands tip-up at the shaft's top end; its
// cone reaches into the plate's z-band, which is why the base plate carries
// a clearance recess bored at exactly this axis (see the plate build).
const cornerDrop = addBevelCorner(settingA, Z_UP, settingU);
const cornerRise = addBevelCorner(settingB, settingU.clone().negate(), Z_UP.clone().negate());
// The cap pinion at the arbor's top: module MW_MODULE_1, one mesh distance
// from the minute wheel's axis, in the minute wheel's own plane — it
// engages REAL teeth. Rest phase aims a half-tooth gap at the wheel.
const settingCap = G.makePinion({ module: MW_MODULE_1, teeth: SETTING_CAP_TEETH, thickness: 1.6, material: MATS.steel });
settingCap.position.set(SETTING_CAP_XY.x, SETTING_CAP_XY.y, Z_CANNON_PINION);
const SETTING_CAP_PHASE =
  Math.atan2(MW_WORLD.y - SETTING_CAP_XY.y, MW_WORLD.x - SETTING_CAP_XY.x) + Math.PI / SETTING_CAP_TEETH;
keyless.add(settingCap);

// ---------------------------------------------------------------------------
// Setting-lever linkage — the visible actuation chain behind the crown pull.
// The stem carries a grooved collar pair; the setting lever's upright pin
// rides between them, so sliding the crown ROTATES the lever. Its tall tail
// post then does the ganged work of real keyless works: it bears on the hack
// spring (the long blued blade reaching across to the balance rim) and
// drives the reset-hammer rod. A separate yoke tracks the sliding pinion's
// hub collars. All angles are SOLVED from the stem geometry, so the pin
// stays in the groove and the fork stays on the hub through the slide.
// Lever and yoke live on the DIAL side with the rest of the keyless works,
// pivoting on studs in the plate's back face; only the lever's tail post
// crosses back to the movement side, through the plate's arc slot. (The
// pivots, angle solves and vPerp / sideSign are hoisted with the XY
// layout, up by the plate-radius computation.)
// ---------------------------------------------------------------------------

// Groove collars on the stem (ride with windSpinner) + sliding-pinion hub
// collars for the yoke's fork. (GROOVE_LOCAL is hoisted with the XY layout —
// the lever-angle solve needs it.) Hub collars slimmed 1.5 → 1.2: the yoke's
// arm passes UNDER them, and every 0.1 of hub radius is 0.1 of yoke drop —
// depth the dial gap no longer has to spare.
const HUB_COLLAR_R = 1.2;
{
  const collarGeo = new THREE.CylinderGeometry(0.75, 0.75, 0.5, 12);
  for (const dy of [-0.95, 0.95]) {
    const collar = new THREE.Mesh(collarGeo, MATS.steel);
    collar.position.y = GROOVE_LOCAL + dy;
    windSpinner.add(collar);
  }
  const hubGeo = new THREE.CylinderGeometry(HUB_COLLAR_R, HUB_COLLAR_R, 0.4, 14);
  for (const dy of [-1.7, 1.7]) {
    const hub = new THREE.Mesh(hubGeo, MATS.steel);
    hub.position.y = dy;
    windSpinner.add(hub);
  }
}

// Setting lever: pivoted beside the stem on the balance side; the beak's pin
// tracks the groove, whose along-stem position is pinDist+pull·slide+local.
// (SL_C / SL_TAIL / settingLeverPivot and the angle solves are hoisted with
// the XY layout — the base plate's slot is cut from the tail post's arc.)
// The lever rides BELOW the wheel plane, toward the dial: its body must
// clear the stem's groove collars (r 0.75) passing over the beak, so the
// drop is collar radius + margin + half the 1-thick body + its bevel.
const Z_SETTING_LEVER = Z_KEYLESS - (0.75 + CLEAR_MARGIN + 0.5 + 0.1);
// Reset-rod plane — declared HERE (ahead of both the lever and the rod
// linkage below) because it sizes the lever's tail post: the post's whole
// job is to carry the two rod pins.
const ROD_R = 0.35; // rod radius — reset and hack rods share it
const FUSEE_TOP_Z = L_BARREL + FUSEE_BASE_Z + FUSEE_H;
// The rods run LOW now — between the base plate and the GREAT WHEEL's
// underside. The mid-band (just under the plate floor) is closed by the
// fusee cone (its tip reaches 0.25 below the floor), but under the wheel
// there is a real corridor across the whole movement. The corridor's
// bounds, both derived:
//  · floor: one margin over the base plate for the thickest thing riding
//    the plane (the hammer's tail bar, thinned to 0.8);
//  · ceiling: the great wheel's disc underside (thickness/2 + bevel below
//    its plane) less a margin — BOTH rod routes cross its footprint.
const ROD_TAILBAR_T = 0.8;
const GW_UNDER_Z = L_BARREL - 1.4 / 2 - Math.min(1.4 * 0.18, 0.36 * 0.22);
const ROD_PLANE_Z = CLEAR_MARGIN + ROD_TAILBAR_T / 2;              // floor-bound: 0.55
const ROD2_PLANE_Z = GW_UNDER_Z - CLEAR_MARGIN - ROD_R;            // ceiling-bound: 0.72
if (ROD2_PLANE_Z < ROD_PLANE_Z)
  console.warn(`rod corridor collapsed: hack plane ${ROD2_PLANE_Z.toFixed(2)} under reset plane ${ROD_PLANE_Z.toFixed(2)}`);
// The two rods CANNOT keep the old 2r+gap vertical separation in this
// 0.22-unit corridor — near the shared post their tubes converge and
// touch, exactly as two levers stacked on one stud do. That contact is
// declared EXPECTED (see inspect.js); away from the post the angular
// spread to their different destinations separates them.
// The cam sits comfortably above the whole plane by construction:
if (Z_SECONDS_ARBOR - CAM_T / 2 < ROD_PLANE_Z + ROD_TAILBAR_T / 2 + CLEAR_MARGIN)
  console.warn('heart cam crowds the reset-rod plane from above');
// Post height — SIZED TO ITS JOBS, no taller: the topmost pin (the hack
// rod's, at ROD2_PLANE_Z) plus a pin-retaining land above it. The post no
// longer crosses the three-quarter plate AT ALL — it tops out ~1.4, so
// the plate loses its arc slot (see tqSlots).
const HACK_ROD_PIN_LAND = 0.35; // post material kept above the top pin
const POST_TOP_Z = ROD2_PLANE_Z + ROD_R + HACK_ROD_PIN_LAND;
const settingLever = G.makeSettingLever({
  beakLen: Math.hypot(SL_C, CROWN_PULL_DIST / 2),
  tailLen: SL_TAIL,
  width: 3,
  thickness: 1,
  // Pin top lands 0.1 under the stem's axis — the same 0.65 of engagement
  // into the groove-collar band the movement-side build had.
  beakPinH: Z_KEYLESS - 0.1 - (Z_SETTING_LEVER + 0.5),
  // The post still does its work on the MOVEMENT side (both rod pins at
  // the LOW plane): from the dial-side lever body it crosses only the
  // BASE plate through the arc slot cut for it (see the plate build) —
  // it no longer reaches the three-quarter plate at all.
  postH: POST_TOP_Z - (Z_SETTING_LEVER + 0.5),
});
// --- Jumping-minute LIFTER PLANE (shared by the post drop below and the
// jumper's lost-motion bar, built with the dial side). The bar spans the
// whole plate→dial gap from this post to the jumper's tail pin, and the
// keyless/motion/reserve stacks leave NO clear plane along that span in
// the z-band they occupy (measured: stacks reach z −3.5 … −6.36 on the
// straight run). The one empty corridor is the DIAL-HUGGING plane: both
// bar faces derived from the dial's back face plus the margin —
//   bar centre = Z_DIAL + CLEAR_MARGIN + JMP_LIFTER_T/2
// binds the bar's dial-side face at exactly CLEAR_MARGIN.
const JMP_LIFTER_T = 0.3;
// Bind headroom: these planes are solved to land EXACTLY on CLEAR_MARGIN,
// and the clearance sweep compares the BVH-measured mesh gap ≥ 0.15 with
// no tolerance — a float hair (transform chains, tessellation) reads as a
// violation. One explicit centi-unit of slack keeps the bind falsifiable
// without flickering.
const JMP_BIND_EPS = 0.01;
const Z_JMP_LIFTER = Z_DIAL + CLEAR_MARGIN + JMP_BIND_EPS + JMP_LIFTER_T / 2;
const settingLeverGroup = new THREE.Group();
settingLeverGroup.position.set(settingLeverPivot.x, settingLeverPivot.y, Z_SETTING_LEVER);
settingLeverGroup.add(settingLever);
{
  // Post DROP: the lifter bar rides the tail post at the dial-hugging
  // plane, below the lever body — extend the post dial-ward so the bar's
  // slot has a pin there. Its end binds at CLEAR_MARGIN above the dial's
  // back face (same constraint the bar itself is planed by).
  const topW = Z_SETTING_LEVER - 0.5;                  // lever body's dial-side face (world)
  const endW = Z_DIAL + CLEAR_MARGIN + JMP_BIND_EPS;   // pin end, margin (+ bind headroom) off the dial back
  const drop = new THREE.Mesh(
    new THREE.CylinderGeometry(G.SETTING_LEVER_POST_R, G.SETTING_LEVER_POST_R, topW - endW, 12), MATS.steel);
  drop.rotation.x = Math.PI / 2;
  // settingLever local frame: group sits at Z_SETTING_LEVER, no flip —
  // dial-ward is −z; the post rides the tail at local (0, −SL_TAIL).
  drop.position.set(0, -SL_TAIL, (topW + endW) / 2 - Z_SETTING_LEVER);
  settingLever.add(drop);
}
movement.add(settingLeverGroup);
registerExplode(settingLeverGroup, Z_SETTING_LEVER, 4, -1);
registerLabel('Setting lever', settingLeverGroup);
// The lever swings on a stud planted in the plate's BACK face now — the
// dial-side mirror of the post it used to stand on (checkSupportGeometry
// keeps its ['Setting lever','plate'] edge honest either way).
addDialSidePivot(settingLeverGroup, { staffR: 0.45, jewelR: 1.0, fromZ: Z_SETTING_LEVER });

// Yoke: on the opposite side of the stem, its fork tracking the sliding
// pinion's hub (which travels with the crown pull). Its arm passes under
// the hub collars, so its drop below the keyless plane is the collar
// radius + margin + half its 1-thick body + bevel; its pivot boss's
// underside is what sets the keyless plane's floor against the dial.
const Z_YOKE = Z_KEYLESS - (HUB_COLLAR_R + CLEAR_MARGIN + 0.5 + 0.06);
const yoke = G.makeYoke({
  armLen: Math.hypot(YK_C, CROWN_PULL_DIST / 2),
  width: 2.6,
  thickness: 1,
  prongGap: 3.4,
  prongH: Z_KEYLESS - Z_YOKE + 0.4,
});
const yokeGroup = new THREE.Group();
yokeGroup.position.set(yokePivot.x, yokePivot.y, Z_YOKE);
yokeGroup.add(yoke);
movement.add(yokeGroup);
registerExplode(yokeGroup, Z_YOKE, 4, -1);
registerLabel('Yoke', yokeGroup);
addDialSidePivot(yokeGroup, { staffR: 0.45, jewelR: 1.0, fromZ: Z_YOKE });

// Reset-hammer transmission — a RIGID connecting rod (fixed length) from the
// setting-lever post to a tail arm on the hammer. The hammer's angle is not
// animated independently: it is SOLVED each frame from the rod constraint
// (two-circle intersection), so the linkage transmits motion exactly like
// the physical four-bar it depicts and the rod never stretches. The tail's
// mounting angle δ is calibrated once so the linkage lands the hammer
// exactly on its two working poses: retracted at crown-in, roller seated in
// the cam notch at crown-out.
let HAMMER_TAIL = 5; // free calibration parameter — final value chosen below
function hammerTailTipAt(rot, delta) {
  return {
    x: hammerPivotPos.x + Math.sin(rot + delta) * HAMMER_TAIL,
    y: hammerPivotPos.y - Math.cos(rot + delta) * HAMMER_TAIL,
  };
}
// Two-circle intersection core, shared by calibration and the per-frame
// solve: tail tip Q on circle(pivot, TAIL) ∩ circle(post, rodLen), branch
// chosen nearest prevQ. Returns the fold margin too (h → 0 at a dead point).
function intersectTail(post, rodLen, prevQ) {
  const H = hammerPivotPos;
  const dx = post.x - H.x, dy = post.y - H.y;
  const d = Math.hypot(dx, dy) || 1e-9;
  const aLen = clamp((HAMMER_TAIL ** 2 - rodLen ** 2 + d * d) / (2 * d), -HAMMER_TAIL, HAMMER_TAIL);
  const h2 = HAMMER_TAIL ** 2 - aLen * aLen;
  const h = Math.sqrt(Math.max(h2, 0));
  const mx = H.x + (aLen / d) * dx, my = H.y + (aLen / d) * dy;
  const px = -dy / d, py = dx / d;
  const q1 = { x: mx + h * px, y: my + h * py };
  const q2 = { x: mx - h * px, y: my - h * py };
  const pick = Math.hypot(q1.x - prevQ.x, q1.y - prevQ.y) <= Math.hypot(q2.x - prevQ.x, q2.y - prevQ.y) ? q1 : q2;
  return { q: pick, margin: h };
}
const HAMMER_TAIL_DELTA = (() => {
  const P0 = tailPostWorldAt(0), P1 = tailPostWorldAt(1);
  const a0 = hammerBaseAngle + HAMMER_SWING_RAD; // retracted (crown in)
  const a1 = hammerBaseAngle;                    // closed on the cam (crown out)
  const f = (d) => {
    const q0 = hammerTailTipAt(a0, d), q1 = hammerTailTipAt(a1, d);
    return Math.hypot(q0.x - P0.x, q0.y - P0.y) - Math.hypot(q1.x - P1.x, q1.y - P1.y);
  };
  // A root only equalises the END poses; the linkage must also TRAVERSE the
  // stroke without folding through a dead point (where the solve would hop
  // branches and never come back — a real four-bar limitation, not a code
  // one). So each candidate root is swept 0→1→0 with the branch-following
  // solver and scored on endpoint fidelity + worst fold margin.
  const sweep = (delta, rodLen) => {
    let q = hammerTailTipAt(a0, delta);
    let minMargin = Infinity;
    const posesAt = (pull) => {
      const r = intersectTail(tailPostWorldAt(pull), rodLen, q);
      q = r.q;
      minMargin = Math.min(minMargin, r.margin);
    };
    for (let i = 0; i <= 40; i++) posesAt(i / 40);
    const qOut = { ...q };
    for (let i = 40; i >= 0; i--) posesAt(i / 40);
    const t1 = hammerTailTipAt(a1, delta), t0 = hammerTailTipAt(a0, delta);
    return {
      errOut: Math.hypot(qOut.x - t1.x, qOut.y - t1.y),
      errBack: Math.hypot(q.x - t0.x, q.y - t0.y),
      minMargin,
    };
  };
  // The tail-arm LENGTH is a free parameter too: the post's chord and the
  // tail tip's chord must be compatible or every δ folds mid-stroke. Scan
  // tail lengths × δ roots; keep the traversable combo with the best margin.
  let best = null;
  for (let T = 3; T <= 12; T += 0.5) {
    HAMMER_TAIL = T;
    const N = 720;
    let prevD = -Math.PI, prevF = f(prevD);
    for (let i = 1; i <= N; i++) {
      const d = -Math.PI + (i / N) * 2 * Math.PI;
      const fd = f(d);
      if (prevF === 0 || prevF * fd < 0) {
        let lo = prevD, hi = d;
        for (let k = 0; k < 40; k++) {
          const m = (lo + hi) / 2;
          if (f(lo) * f(m) <= 0) hi = m; else lo = m;
        }
        const root = (lo + hi) / 2;
        const q0 = hammerTailTipAt(a0, root);
        const len = Math.hypot(q0.x - P0.x, q0.y - P0.y);
        if (len > T * 0.6) {
          const s = sweep(root, len);
          const feasible = s.errOut < 0.08 && s.errBack < 0.08 && s.minMargin > 0.25;
          if (feasible && (!best || s.minMargin > best.minMargin)) {
            best = { delta: root, len, tail: T, minMargin: s.minMargin };
          }
        }
      }
      prevD = d;
      prevF = fd;
    }
  }
  if (!best) {
    console.warn('reset-rod calibration: no traversable root; falling back');
    HAMMER_TAIL = 5;
    return { delta: 0, len: Math.hypot(hammerTailTipAt(a0, 0).x - P0.x, hammerTailTipAt(a0, 0).y - P0.y) };
  }
  HAMMER_TAIL = best.tail;
  return best;
})();
const RESET_ROD_LEN = HAMMER_TAIL_DELTA.len;
// Tail bar rides BELOW the hammer body on the low rod plane (the rod's
// run from the tail post to here now crosses UNDER the great wheel — the
// corridor derivation at the setting-lever block). Local z is the plane
// offset from the display-arbor plane; negative, since the plane is
// beneath the cam now.
const hammerTailBar = new THREE.Mesh(new THREE.BoxGeometry(1.4, HAMMER_TAIL, ROD_TAILBAR_T), MATS.steel);
hammerTailBar.rotation.z = HAMMER_TAIL_DELTA.delta;
hammerTailBar.position.set(
  Math.sin(HAMMER_TAIL_DELTA.delta) * (HAMMER_TAIL / 2),
  -Math.cos(HAMMER_TAIL_DELTA.delta) * (HAMMER_TAIL / 2),
  ROD_PLANE_Z - Z_SECONDS_ARBOR
);
hammerGroup.add(hammerTailBar);
// The hammer's arbor: one shaft from the tail bar's plane up through the
// body, and DOWN to a footed bearing on the BASE plate — the hammer's
// grounding lives below now (its old jewelled bore in the three-quarter
// plate is gone, and the plate is cleaner for it).
{
  const shaftTop = 0.6; // just past the body boss, hammer-local
  const shaftBot = -Z_SECONDS_ARBOR; // base plate, hammer-local
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, shaftTop - shaftBot, 10), MATS.steel);
  shaft.rotation.x = Math.PI / 2;
  shaft.position.set(0, 0, (shaftTop + shaftBot) / 2);
  hammerGroup.add(shaft);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.0, 0.3, 12), MATS.steel);
  foot.rotation.x = Math.PI / 2;
  foot.position.set(0, 0, shaftBot + 0.15);
  hammerGroup.add(foot);
}
// --- ELBOW RODS. The low corridor crosses the transfer wheel's and the
// winding spur's XY footprints (and, for the hack rod, the centre
// arbor's lower-pivot collar) — a straight tube cannot clear them, so
// each rod is a RIGID two-segment link with a fixed bend. The elbow's
// chord-frame position (f along, e lateral) is SOLVED by scan,
// maximizing the worst-case clearance over the whole crown stroke
// against the low-band obstacle circles. The link stays rigid — its
// pin-to-pin chord is the calibrated length — so the two-circle pose
// solves are untouched; only the mesh is bent. (The drum's set-up
// cluster is 15+ units off both routes — checked analytically, not
// scanned, because drumPos is declared later in the build.)
const LOW_ROD_OBSTACLES = [
  { x: uWind.x * cwDist, y: uWind.y * cwDist, r: crownWheelR + 0.4 + ROD_R + CLEAR_MARGIN }, // transfer wheel
  { x: P.barrel.x, y: P.barrel.y, r: windSpurR + KW_MODULE + ROD_R + CLEAR_MARGIN },         // winding spur
  { x: P.center.x, y: P.center.y, r: 1.4 * 1.7 + ROD_R + CLEAR_MARGIN },                     // centre lower-pivot collar
  { x: P.fourth.x, y: P.fourth.y, r: 1.4 * 1.7 + ROD_R + CLEAR_MARGIN },                     // fourth lower-pivot collar
];
function segCircleClear(p, q, c) {
  const vx = q.x - p.x, vy = q.y - p.y;
  const L2 = vx * vx + vy * vy || 1e-9;
  const t = clamp(((c.x - p.x) * vx + (c.y - p.y) * vy) / L2, 0, 1);
  return Math.hypot(c.x - p.x - t * vx, c.y - p.y - t * vy) - c.r;
}
function solveElbow(len, posesAB) {
  let best = { clear: -Infinity, f: 0.5, e: 0 };
  for (let f = 0.25; f <= 0.751; f += 0.05) {
    for (let e = -6; e <= 6.01; e += 0.2) {
      let worst = Infinity;
      for (const { a, b } of posesAB) {
        const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy);
        // Lateral unit = the chord's RIGHT-perp — the direction the mesh's
        // local +X maps to under the placement rotation (atan2 − π/2).
        const ux = dx / L, uy = dy / L, nx = uy, ny = -ux;
        const E = { x: a.x + ux * L * f + nx * e, y: a.y + uy * L * f + ny * e };
        for (const o of LOW_ROD_OBSTACLES) {
          worst = Math.min(worst, segCircleClear(a, E, o), segCircleClear(E, b, o));
        }
      }
      if (worst > best.clear) best = { clear: worst, f, e };
    }
  }
  return best;
}
// Mesh in the pose frame the placement code already uses: local +Y is the
// chord (post end at −len/2), so position-at-midpoint + rotation.z works
// exactly as it did for the straight tube.
function makeElbowRodMesh(len, f, e) {
  const g = new THREE.Group();
  const a = { x: 0, y: -len / 2 }, b = { x: 0, y: len / 2 };
  const E = { x: e, y: -len / 2 + f * len };
  for (const [p, q] of [[a, E], [E, b]]) {
    const dx = q.x - p.x, dy = q.y - p.y, L = Math.hypot(dx, dy);
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(ROD_R, ROD_R, L, 8), MATS.steel);
    seg.position.set((p.x + q.x) / 2, (p.y + q.y) / 2, 0);
    seg.rotation.z = Math.atan2(dy, dx) - Math.PI / 2;
    g.add(seg);
  }
  const knuckle = new THREE.Mesh(new THREE.SphereGeometry(ROD_R * 1.15, 10, 8), MATS.steel);
  knuckle.position.set(E.x, E.y, 0);
  g.add(knuckle);
  return g;
}
// Reset rod: endpoint pairs sampled over the stroke with the SAME
// branch-tracked two-circle solve tick() uses.
const RESET_ROD_ELBOW = (() => {
  const poses = [];
  let prev = hammerTailTipAt(hammerBaseAngle + HAMMER_SWING_RAD, HAMMER_TAIL_DELTA.delta);
  for (let t = 0; t <= 1.0001; t += 0.125) {
    const post = tailPostWorldAt(t);
    const r = intersectTail(post, RESET_ROD_LEN, prev);
    prev = r.q;
    poses.push({ a: post, b: { x: r.q.x, y: r.q.y } });
  }
  const best = solveElbow(RESET_ROD_LEN, poses);
  if (best.clear < 0)
    console.warn(`reset rod elbow: best clearance ${best.clear.toFixed(2)} — the low corridor is fouled`);
  return best;
})();
const resetRod = makeElbowRodMesh(RESET_ROD_LEN, RESET_ROD_ELBOW.f, RESET_ROD_ELBOW.e);
movement.add(resetRod);
registerLabel('Reset rod', resetRod);
// Per-frame solve: track the intersection branch continuously from the
// retracted pose (the calibration guaranteed the stroke never folds).
let prevTailTip = hammerTailTipAt(hammerBaseAngle + HAMMER_SWING_RAD, HAMMER_TAIL_DELTA.delta);
function solveHammerRotation(post) {
  const r = intersectTail(post, RESET_ROD_LEN, prevTailTip);
  prevTailTip = r.q;
  // Tail tip local direction is (sin, −cos) of (rot + δ): invert for rot.
  return Math.atan2(r.q.x - hammerPivotPos.x, -(r.q.y - hammerPivotPos.y)) - HAMMER_TAIL_DELTA.delta;
}

// ---------------------------------------------------------------------------
// STOP WORK (hacking) — a local stop crank at the balance, driven by a
// thin LOW hack rod (the corridor under the great wheel — the whole
// reset/hack linkage lives between the plates now). The crown's motion
// still has to travel from the keyless corner to the balance — that span
// is irreducible — but it travels as a thin elbow rod in the low band
// instead of over the plate. At the balance end the rod drives a SEE-SAW
// CRANK standing in the plate cut's open wedge: a HANGING tail down to
// the rod plane, and a pad arm dropped from the raised pivot to reach
// under the rim, pivoted in a clevis bracket on the base plate about the
// RADIAL axis (balance-centre → bracket). The hinge axis is forced by the
// keyless kinematics: releasing the crown moves the tail post AWAY from
// the crank (measured stroke ≈ 2.9 outward along the rod), so the rigid
// rod can only PULL the tail toward the post on release. A tangential
// hinge would turn that pull into the pad camming UP through the rim
// (any pad reaching inward from a below-pivot arm rises when its tail is
// pulled — dz/dψ = −x_pad > 0, no placement escapes it); the radial
// hinge turns the same pull into a TANGENTIAL tail swing, which never
// moves anything on the crank toward the balance axis (hypot(R, y) ≥ R),
// and a solved tangential pad offset converts the swing into the pad
// DROP the release needs. Because the rod is rigid and pinned at both
// ends, the linkage is positively controlled in both directions: no
// preload spring needed.
//
// The brake itself is unchanged in kind: an UNDERSIDE pad. The rim's side
// face is not a usable contact — the timing screws' heads sweep proud of
// the rim across its whole z-band — so the pad must press up from below,
// on the same screw-standoff annulus as before (derivation kept verbatim).
const HACK_CLEAR_MARGIN = CLEAR_MARGIN; // one named margin; the solves below bind exactly at it

// --- Pad ↔ balance geometry, derived from the balance's OWN build
// constants (slim rim: height 0.55·t, width 0.5·t; screws base 0.24·t,
// embedded 0.16·t past the rim face — see makeBalanceWheel) so reshaping
// the balance moves the brake with it.
// (BAL_T itself is declared with the Z-stack constants — the balance plane
// derivation needs it first.)
const HACK_RIM_I = balanceR - BAL_T * 0.5;             // rim's inner radius
const HACK_SCREW_IN_R = balanceR - BAL_T * 0.16;       // timing screws' inner tips (rimO − screwLen + protrusion)
// The rim's underside hangs only this far below the screws' deepest sweep
// (0.275·t rim half-height vs 0.24·t screw base radius) — far less than
// the margin, so z alone cannot keep the pad clear of the screws:
const HACK_SCREW_DROP = (0.55 / 2 - 0.24) * BAL_T;
// ...the rest of the separation must come radially. Corner-to-corner:
// √(standoff² + drop²) = margin ⇒
const HACK_SCREW_STANDOFF = Math.sqrt(Math.max(0, HACK_CLEAR_MARGIN ** 2 - HACK_SCREW_DROP ** 2));
// Size the ruby's top face to fill exactly the annulus that is both fully
// ON the rim's underside (≥ rim inner edge — full-face seating, lesson:
// surface-to-surface) and radially inside the screws' standoff:
const HACK_PAD_TOP_R = (HACK_SCREW_IN_R - HACK_SCREW_STANDOFF - HACK_RIM_I) / 2;
const HACK_PAD_R = HACK_PAD_TOP_R / G.HACK_RUBY_FLARE; // pad post / ruby-base radius
const HACK_CONTACT_R = (HACK_RIM_I + HACK_SCREW_IN_R - HACK_SCREW_STANDOFF) / 2;
const HACK_CONTACT_Z = L_BALANCE - RIM_H / 2;          // the rim's underside plane
// Minimum acceptable pad gap below the rim when released — the linkage's
// actual released drop is DERIVED (the rod's rigid length maps the post's
// crown travel onto the crank), asserted against this floor below.
const HACK_DROP_MIN = 0.35;

// --- Crank geometry. The PAD ARM still sits level at full engagement
// with its ruby's top face exactly on the contact plane — the engaged
// pose is the calibration zero — but the arm's plane is a build DATUM
// now (Z_STOP_PIVOT_LOW below), not the pivot height: the pivot moved up
// so the tail can hang to the low rod plane, and a drop leg connects the
// raised pivot hub to the arm.
const STOP_ARM_T = 0.8;     // pad arm thickness
const STOP_ARM_W = 0.9;     // pad arm width
const STOP_PAD_RISE = 0.9;  // arm top face → ruby top face (post 0.5 + ruby 0.4)
const STOP_TAIL_W = 0.5;    // tail bar section
const STOP_LEG_W = 0.7;     // drop-leg section (local x): pivot hub → pad-arm plane
// The drop leg — and with it the pad arm's root — is IN LINE with the tail
// bar, not stood off beside it. The crank hinges about local X, so every
// point of it keeps its x for ever: a leg hanging off-axis makes the crank
// asymmetric about its own swing plane, and then there is no pair of
// positions where a clevis can straddle it (the old +x leg ran straight
// through the +x cheek). With the root ON the axis the crank's whole hub
// band is |x| ≤ STOP_HUB_HALF_X, which is what the cheeks are derived from.
const STOP_ARM_ROOT_X = 0;
const STOP_HUB_HALF_X = Math.max(STOP_TAIL_W, STOP_LEG_W) / 2;
// Bracket axis stand-off from the balance axis. With the RADIAL hinge the
// crank's tangential swing only ever moves it AWAY from the balance axis,
// so the binding constraint is the STATIC hardware: the clevis cheeks
// straddle the crank along that same radial axis and reach
// STOP_CHEEK_X + STOP_CHEEK_T/2 ≈ 0.82 inward of the pivot, so the
// allowance must cover that + CLEAR_MARGIN ≈ 0.97; the 2.0 keeps the extra
// so the pad arm's diagonal run down to the contact annulus stays shallow.
const STOP_LEAN_ALLOW = 2.0;
const STOP_PIVOT_R = BAL_OUTER_R + STOP_LEAN_ALLOW;
// The tail now HANGS: the hack rod runs on the LOW plane (under the
// great wheel), so the crank's driven arm reaches DOWN from the pivot to
// the rod. The pivot height is therefore no longer set by the pad-arm
// stack — it is SIZED FROM THE STROKE: the released crank angle is what
// the rod's crown travel maps onto the tail's length, and a small-angle
// crank (real-watch scale) needs the pivot high enough that the hanging
// tail is long. The rod only couples through the TANGENTIAL component of
// its run (STOP_TANG_K below), so the pivot-height formula carries that
// factor — omitting it is exactly how the old solve overshot its target
// swing. The bracket stands in the plate cut's open wedge, where there
// is no plate to hide below — its slim post is the one piece of this
// linkage that still shows above the plate line.
const STOP_PSI_TARGET = 0.5; // ~29° released swing sizes the tail lever (with K ≈ 0.6 the mast stays near its old height)
const POST_STROKE = Math.hypot(postEng.x - postRel.x, postEng.y - postRel.y);
const Z_STOP_PIVOT_LOW = HACK_CONTACT_Z - STOP_PAD_RISE - STOP_ARM_T / 2; // the pad arm's own plane (build datum)

// --- Bearing: scanned around the plate cut's open-wedge centre (the wedge
// aims plate-centre → balance and is open to the rim, so the OUTWARD
// bearing is open air from base plate to sky by construction — the crank's
// tall tail needs exactly that). The scan walks away from the ideal only
// far enough to clear the escapement-side hardware, and requires the hack
// rod's approach to keep a strong component along the crank's tilt plane —
// TANGENTIAL now (the see-saw only converts motion in its own hinge
// plane, and the hinge is radial). The released tail sweeps tangentially
// toward the post, so the whole swept segment is tested, not the pivot
// point alone.
const STOP_BEARING = (() => {
  const ideal = Math.atan2(P.balance.y, P.balance.x);
  const obstacles = [
    ...forkCock.chain.map((n) => ({ x: n.x, y: n.y, r: n.r })),
    { x: P.fork.x, y: P.fork.y, r: 4 },
    { x: P.escape.x, y: P.escape.y, r: escapeWheelR + 1 },
    { x: P.fourth.x, y: P.fourth.y, r: fourthWheelR + 1 },
    { x: hammerPivotPos.x, y: hammerPivotPos.y, r: hammerArmLen + 4 },
  ];
  let best = null;
  // Scan bound: the plate cut's open wedge (±phiOpen about the same
  // balance-centred aim), less the bracket's own angular half-width —
  // the mast crosses the plate band and must stay in open air. The old
  // ±28° window was leftover conservatism from the tall-mast design and
  // capped the achievable coupling ~0.62.
  const wedgeBound = TQ_CUT.phiOpen / DEG2RAD - Math.atan2(1.65 + HACK_CLEAR_MARGIN, STOP_PIVOT_R) / DEG2RAD;
  for (let d = -Math.floor(wedgeBound); d <= Math.floor(wedgeBound); d += 1) {
    const phi = ideal + d * DEG2RAD;
    const bx = P.balance.x + Math.cos(phi) * STOP_PIVOT_R;
    const by = P.balance.y + Math.sin(phi) * STOP_PIVOT_R;
    const dxp = bx - postEng.x, dyp = by - postEng.y, mp = Math.hypot(dxp, dyp) || 1;
    const tx = -Math.sin(phi), ty = Math.cos(phi);
    const rodK = (dxp * tx + dyp * ty) / mp;
    if (Math.abs(rodK) < 0.6) continue;
    // Released tail-end sweep, tangential, TOWARD the post: first-order
    // stroke/|K|, inflated 25% for the pin's cosine rise (covers ψ0 ≲ 40°).
    const sw = -Math.sign(rodK) * 1.25 * POST_STROKE / Math.abs(rodK);
    const swept = { x: bx + tx * sw, y: by + ty * sw };
    if (Math.hypot(bx, by) > plateR - 2) continue;        // bracket fully on the plate
    if (Math.hypot(swept.x, swept.y) > plateR - 1) continue; // swept tail stays over the plate
    let clr = Infinity;
    for (const o of obstacles)
      clr = Math.min(clr, segCircleClear({ x: bx, y: by }, swept, o) - 2);
    if (clr < HACK_CLEAR_MARGIN) continue;
    // MAXIMIZE the coupling, with clearance as the constraint it always
    // really was (the old clearance-maximizing score let K sit at its
    // 0.6 gate, inflating the tail lever — and the mast — by ~40%: the
    // pivot height divides by |K|, see Z_STOP_PIVOT). Tiny clearance
    // tiebreak so equal-K bearings still prefer open air.
    const score = Math.abs(rodK) + clr * 0.01;
    if (!best || score > best.score) best = { phi, score };
  }
  if (!best) {
    console.warn('stop work: no clear bearing about the balance — using the outward ideal');
    best = { phi: ideal };
  }
  return best.phi;
})();
const STOP_R_HAT = { x: Math.cos(STOP_BEARING), y: Math.sin(STOP_BEARING) };
const STOP_T_HAT = { x: -STOP_R_HAT.y, y: STOP_R_HAT.x }; // hinge plane's horizontal axis
const STOP_PIVOT = {
  x: P.balance.x + STOP_R_HAT.x * STOP_PIVOT_R,
  y: P.balance.y + STOP_R_HAT.y * STOP_PIVOT_R,
};
// Rod coupling: tangential fraction of the rod's run at the engaged pose
// (|K| ≥ 0.6 guaranteed by the bearing scan above).
const STOP_TANG_K = (() => {
  const dx = STOP_PIVOT.x - postEng.x, dy = STOP_PIVOT.y - postEng.y;
  return (dx * STOP_T_HAT.x + dy * STOP_T_HAT.y) / Math.hypot(dx, dy);
})();
// Pivot height from the stroke THROUGH the coupling:
//   |STOP_TAIL_H| · sin(ψ_target) · |K| = POST_STROKE
const Z_STOP_PIVOT = ROD2_PLANE_Z + POST_STROKE / (Math.abs(STOP_TANG_K) * Math.sin(STOP_PSI_TARGET));
const STOP_TAIL_H = ROD2_PLANE_Z - Z_STOP_PIVOT; // NEGATIVE: the tail hangs down to the rod plane
// CASE-FIT assert: the mast (pivot + clevis cheeks, top = pivot + 0.85)
// must not stand above the balance cock's own height — the cock sets the
// display side's silhouette, and the K-maximizing bearing scan above is
// what earns this. If it fires, the achieved coupling is printed: the
// fallback is a dedicated hack-rod pin at reduced radius on the setting
// lever's tail (stroke scales with r/SL_TAIL).
const STOP_MAST_TOP = Z_STOP_PIVOT + 0.85;
if (STOP_MAST_TOP > TQ_TOP_Z)
  console.warn(`stop work: mast top ${STOP_MAST_TOP.toFixed(2)} above the cock height ${TQ_TOP_Z.toFixed(2)} — achieved |K| = ${Math.abs(STOP_TANG_K).toFixed(3)}, needed ≥ ${(POST_STROKE / ((TQ_TOP_Z - 0.85 - ROD2_PLANE_Z) * Math.sin(STOP_PSI_TARGET))).toFixed(3)}`);

// --- Build: the rotating crank first, then the static bracket AROUND it.
// Group local +X = radially OUT of the balance, local +Y = STOP_T_HAT;
// the crank rotates about local X (the horizontal RADIAL pivot axis).
// Build order is load-bearing: the bracket's stand-off is SOLVED against
// the crank's swept envelope (see the bracket block after the crank), so
// the crank has to exist first.
const stopLeverGroup = new THREE.Group();
stopLeverGroup.position.set(STOP_PIVOT.x, STOP_PIVOT.y, Z_STOP_PIVOT);
stopLeverGroup.rotation.z = STOP_BEARING;
movement.add(stopLeverGroup);
registerExplode(stopLeverGroup, Z_STOP_PIVOT, 7);
registerLabel('Stop lever', stopLeverGroup);
const stopCrank = new THREE.Group();
stopLeverGroup.add(stopCrank);
// Pad-arm plane relative to the raised pivot (negative: the arm hangs).
const PAD_ARM_LOCAL_Z = Z_STOP_PIVOT_LOW - Z_STOP_PIVOT;

// --- Hack-rod linkage: rigid rod, length CALIBRATED at the engaged pose
// (crank at ψ = 0, pad tangent to the rim by the z-stack above); the
// released crank angle then FOLLOWS from the post's crown travel through
// the rod constraint — derived, not styled — and the released pad drop is
// asserted against HACK_DROP_MIN. Per-frame the crank angle is solved from
// the same constraint (a·sinψ + b·cosψ = c, branch nearest the previous
// frame), mirroring the reset hammer's rod solve; ψ is clamped at 0
// because the rim itself is the hard stop the pad presses against.
// Rotation about local X maps (y, z) → (y·cosψ − z·sinψ, y·sinψ + z·cosψ):
// the tail-end pin swings in the TANGENTIAL-vertical plane.
function stopTailTopAt(psi) {
  const sw = -STOP_TAIL_H * Math.sin(psi); // tangential swing (H < 0)
  return {
    x: STOP_PIVOT.x + STOP_T_HAT.x * sw,
    y: STOP_PIVOT.y + STOP_T_HAT.y * sw,
    z: Z_STOP_PIVOT + STOP_TAIL_H * Math.cos(psi),
  };
}
function stopSolvePsi(post, prev) {
  const wx = post.x - STOP_PIVOT.x, wy = post.y - STOP_PIVOT.y, wz = ROD2_PLANE_Z - Z_STOP_PIVOT;
  const a = -(wx * STOP_T_HAT.x + wy * STOP_T_HAT.y), b = wz;
  const c = (wx * wx + wy * wy + wz * wz + STOP_TAIL_H * STOP_TAIL_H - HACK_ROD_LEN * HACK_ROD_LEN)
    / (2 * STOP_TAIL_H);
  const m = Math.hypot(a, b) || 1e-9;
  const base = Math.atan2(a, b);
  const off = Math.acos(clamp(c / m, -1, 1));
  const c1 = base - off, c2 = base + off;
  return Math.abs(c1 - prev) <= Math.abs(c2 - prev) ? c1 : c2;
}
const HACK_ROD_LEN = (() => {
  const t = stopTailTopAt(0);
  return Math.hypot(postEng.x - t.x, postEng.y - t.y, ROD2_PLANE_Z - t.z);
})();
const STOP_PSI0 = stopSolvePsi(postRel, 0); // released crank angle (sign follows the post's tangential side)

// --- Pad placement on the crank, DERIVED. Under the radial hinge the pad
// moves only in (tangential, vertical): z(ψ) = y·sinψ + z_top·cosψ.
// The cosine term alone would RAISE a below-pivot pad as |ψ| grows, so
// the tangential offset PAD_Y is solved from the release constraint. The
// released pad face TILTS with the crank, so the constraint binds at the
// face's WORST point — the top-face edge a pad radius toward the swing
// (y = PAD_Y + r·sign(sinψ0)), not the centre:
//   drop(ψ0) = −(PAD_Y + r·sgn)·sinψ0 + z_top·(1 − cosψ0) = HACK_DROP_MIN
const STOP_PAD_TOP_LZ = HACK_CONTACT_Z - Z_STOP_PIVOT; // ruby top face, crank-local (negative)
const STOP_PAD_Y = (STOP_PAD_TOP_LZ * (1 - Math.cos(STOP_PSI0)) - HACK_DROP_MIN) / Math.sin(STOP_PSI0)
  - HACK_PAD_TOP_R * Math.sign(Math.sin(STOP_PSI0));
// Radial coordinate: the contact annulus is rotationally symmetric about
// the balance axis, so the tangential offset just shifts the contact
// azimuth — the pad's top-face centre stays at the derived radius:
//   hypot(STOP_PIVOT_R + PAD_X, PAD_Y) = HACK_CONTACT_R
const STOP_PAD_X = Math.sqrt(Math.max(0, HACK_CONTACT_R ** 2 - STOP_PAD_Y ** 2)) - STOP_PIVOT_R; // negative: inward
if (Math.abs(STOP_PAD_Y) >= HACK_CONTACT_R)
  console.warn('stop work: pad tangential offset exceeds the contact radius', STOP_PAD_Y.toFixed(2));
{
  const tail = new THREE.Mesh(new THREE.BoxGeometry(STOP_TAIL_W, STOP_TAIL_W, Math.abs(STOP_TAIL_H)), MATS.steel);
  tail.position.z = STOP_TAIL_H / 2; // hangs: H is negative
  stopCrank.add(tail);
  // Pad arm: a DIAGONAL run from the drop leg's foot to the pad centre
  // (the pad carries the solved tangential offset).
  const runX = STOP_PAD_X - STOP_ARM_ROOT_X, runY = STOP_PAD_Y;
  const armL = Math.hypot(runX, runY) + 1.4; // overshoots both ends for the bosses
  const arm = new THREE.Mesh(new THREE.BoxGeometry(armL, STOP_ARM_W, STOP_ARM_T), MATS.steel);
  arm.position.set((STOP_ARM_ROOT_X + STOP_PAD_X) / 2, STOP_PAD_Y / 2, PAD_ARM_LOCAL_Z);
  arm.rotation.z = Math.atan2(runY, runX);
  stopCrank.add(arm);
  // Drop leg: pivot hub down to the hanging arm, on the hinge axis.
  const leg = new THREE.Mesh(new THREE.BoxGeometry(STOP_LEG_W, STOP_ARM_W, Math.abs(PAD_ARM_LOCAL_Z) + STOP_ARM_T), MATS.steel);
  leg.position.set(STOP_ARM_ROOT_X, 0, PAD_ARM_LOCAL_Z / 2);
  stopCrank.add(leg);
  const padPost = new THREE.Mesh(new THREE.CylinderGeometry(HACK_PAD_R, HACK_PAD_R, 0.5, 12), MATS.steel);
  padPost.rotation.x = Math.PI / 2;
  padPost.position.set(STOP_PAD_X, STOP_PAD_Y, PAD_ARM_LOCAL_Z + STOP_ARM_T / 2 + 0.25);
  stopCrank.add(padPost);
  const ruby = new THREE.Mesh(new THREE.CylinderGeometry(HACK_PAD_TOP_R, HACK_PAD_R * 0.95, 0.4, 14), MATS.ruby);
  ruby.rotation.x = Math.PI / 2;
  ruby.position.set(STOP_PAD_X, STOP_PAD_Y, PAD_ARM_LOCAL_Z + STOP_ARM_T / 2 + 0.7);
  stopCrank.add(ruby);
  // Rod pin stub at the tail's END (its low tip), along the hinge axis.
  const rodPin = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, STOP_TAIL_W + 0.6, 8), MATS.steel);
  rodPin.rotation.z = Math.PI / 2;
  rodPin.position.z = STOP_TAIL_H;
  stopCrank.add(rodPin);
}
// Released pad drop, from the EXACT rotation of the pad's WORST top-face
// edge — binds at HACK_DROP_MIN by the PAD_Y solve above (tolerance for
// the float round-trip):
const _padEdgeY = STOP_PAD_Y + HACK_PAD_TOP_R * Math.sign(Math.sin(STOP_PSI0));
const _padZAt = (psi) => _padEdgeY * Math.sin(psi) + STOP_PAD_TOP_LZ * Math.cos(psi);
const STOP_RELEASE_DROP = _padZAt(0) - _padZAt(STOP_PSI0);
if (!(STOP_RELEASE_DROP >= HACK_DROP_MIN - 1e-6))
  console.warn('stop work: released pad drop under floor', STOP_RELEASE_DROP.toFixed(3), '<', HACK_DROP_MIN);
// Sweep safety, replacing the old graded-lean check (the tail can no
// longer lean toward the balance: tangential swings keep every crank
// point at world radius hypot(R, y) ≥ R from the balance axis). Two
// things still need proof across the WHOLE stroke ψ ∈ [0, ψ0] — the
// crown can rest anywhere and the balance may still be swinging:
//  · the pad's top face must never rise above the contact plane, and
//  · every other crank point that enters the balance's radial envelope
//    must stay a margin below the rim's underside.
{
  const pts = [];
  const ring = (cx, cy, r, z, pad) => {
    for (let k = 0; k < 8; k++)
      pts.push({ x: cx + r * Math.cos(k * Math.PI / 4), y: cy + r * Math.sin(k * Math.PI / 4), z, pad });
  };
  ring(STOP_PAD_X, STOP_PAD_Y, HACK_PAD_TOP_R, STOP_PAD_TOP_LZ, true);          // ruby top face
  ring(STOP_PAD_X, STOP_PAD_Y, HACK_PAD_R, STOP_PAD_TOP_LZ - 0.4, false);       // ruby base
  ring(STOP_PAD_X, STOP_PAD_Y, HACK_PAD_R, PAD_ARM_LOCAL_Z + STOP_ARM_T / 2, false); // pad post root
  {
    const runX = STOP_PAD_X - STOP_ARM_ROOT_X, runY = STOP_PAD_Y, L = Math.hypot(runX, runY) || 1;
    const nx = -runY / L * (STOP_ARM_W / 2), ny = runX / L * (STOP_ARM_W / 2);
    for (let i = 0; i <= 8; i++) { // arm top-face lattice
      const x = STOP_ARM_ROOT_X + runX * i / 8, y = runY * i / 8;
      pts.push({ x: x + nx, y: y + ny, z: PAD_ARM_LOCAL_Z + STOP_ARM_T / 2 });
      pts.push({ x: x - nx, y: y - ny, z: PAD_ARM_LOCAL_Z + STOP_ARM_T / 2 });
    }
  }
  let worst = Infinity, rise = -Infinity;
  const lo = Math.min(0, STOP_PSI0), hi = Math.max(0, STOP_PSI0);
  for (let i = 0; i <= 24; i++) {
    const psi = lo + (hi - lo) * i / 24;
    const c = Math.cos(psi), s = Math.sin(psi);
    for (const p of pts) {
      const y = p.y * c - p.z * s, z = p.y * s + p.z * c;
      if (p.pad) { rise = Math.max(rise, Z_STOP_PIVOT + z - HACK_CONTACT_Z); continue; }
      const wr = Math.hypot(STOP_PIVOT_R + p.x, y);
      if (wr < BAL_OUTER_R + HACK_CLEAR_MARGIN)
        worst = Math.min(worst, HACK_CONTACT_Z - HACK_CLEAR_MARGIN - (Z_STOP_PIVOT + z));
    }
  }
  if (rise > 1e-6)
    console.warn('stop work: pad rises above the contact plane mid-stroke by', rise.toFixed(3));
  if (worst < 0)
    console.warn('stop work: crank sweeps into the balance envelope, margin short by', (-worst).toFixed(3));
}

// --- STATIC BRACKET, stood off from the crank's OWN sweep -------------------
// The crank is a see-saw about the unit's local X axis: every point of it
// keeps its x for ever and fans through (y, z) as ψ runs between the engaged
// pose and ψ0. A bracket carrying that hinge has exactly two places it can
// stand — out of the swing plane along ±x, or beyond the fan in (y, z) — and
// the old build used neither: its post rose from the unit's own origin, dead
// under the pivot, so the hanging tail and the drop leg swept straight
// through their own support at every crown pose.
//
// Which escape is available is decided by the crank, not by taste:
//  · ±x cannot carry a column. The pad arm runs diagonally from the hub out
//    to the pad under the balance rim (x ≈ STOP_PAD_X) and overhangs its root
//    the other way, so a column clear of it would stand ~1.6+ off the hinge
//    RADIALLY — and the clevis cheeks are plates in the y–z plane, which can
//    never reach a post offset along the very axis they straddle.
//  · The (y, z) fan is ONE-SIDED: ψ only ever runs between 0 and ψ0, so the
//    crank sweeps toward sign(ψ0)·y and away from the other side for ever.
// So the bracket stands on the swing-AWAY side: a post there, and the two
// cheeks reaching back from it to the pin. The crank's clearance to it then
// only ever IMPROVES as the crown pulls, which is the pose that used to be
// the worst one. The stand-off itself is solved below.

// Crank swept envelope, sampled from the BUILT crank so it tracks any later
// change to it: every triangle of every crank mesh is sampled on a lattice
// finer than the margin (vertices alone are not enough — a column can lie
// alongside the MIDDLE of a long edge, which no corner of it reports),
// expressed in the unit's local frame at ψ = 0.
const STOP_CRANK_PTS = (() => {
  // Lattice pitch. A sampled surface can only UNDER-report a distance, and
  // by at most half a pitch (the distance to a convex solid is 1-Lipschitz
  // along the surface), so the pitch is also the solve's error bar: 0.1 puts
  // it at 0.05, a third of the margin, and an independent finer sweep then
  // measures the built clearance back at the margin to within a thousandth.
  const STEP = 0.1;
  const pts = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const m = new THREE.Matrix4(), inv = new THREE.Matrix4();
  stopLeverGroup.updateMatrixWorld(true);
  inv.copy(stopCrank.matrixWorld).invert(); // → crank-local, whatever ψ is posed
  stopCrank.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    m.multiplyMatrices(inv, o.matrixWorld);
    const pos = o.geometry.attributes.position, idx = o.geometry.index;
    const n = idx ? idx.count : pos.count;
    for (let t = 0; t + 2 < n; t += 3) {
      const i0 = idx ? idx.getX(t) : t, i1 = idx ? idx.getX(t + 1) : t + 1, i2 = idx ? idx.getX(t + 2) : t + 2;
      a.fromBufferAttribute(pos, i0).applyMatrix4(m);
      b.fromBufferAttribute(pos, i1).applyMatrix4(m);
      c.fromBufferAttribute(pos, i2).applyMatrix4(m);
      const rows = Math.max(1, Math.ceil(Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a)) / STEP));
      for (let i = 0; i <= rows; i++)
        for (let j = 0; i + j <= rows; j++) {
          const u = i / rows, v = j / rows, w = 1 - u - v;
          pts.push({
            x: a.x * w + b.x * u + c.x * v,
            y: a.y * w + b.y * u + c.y * v,
            z: a.z * w + b.z * u + c.z * v,
          });
        }
    }
  });
  return pts;
})();
// Reduce fn over that envelope across the WHOLE stroke (rotation about local
// X maps (y, z) → (y·cosψ − z·sinψ, y·sinψ + z·cosψ), as everywhere above).
function stopSweptMin(fn) {
  let out = Infinity;
  const lo = Math.min(0, STOP_PSI0), hi = Math.max(0, STOP_PSI0);
  for (let i = 0; i <= 24; i++) {
    const psi = lo + (hi - lo) * i / 24;
    const cs = Math.cos(psi), sn = Math.sin(psi);
    for (const p of STOP_CRANK_PTS) {
      const v = fn(p.x, p.y * cs - p.z * sn, p.y * sn + p.z * cs);
      if (v < out) out = v;
    }
  }
  return out;
}

const STOP_MAST_TOP_LZ = STOP_MAST_TOP - Z_STOP_PIVOT;  // the case-fit ceiling, unit-local
const STOP_CHEEK_T = 0.32, STOP_CHEEK_H = 2.0;
const STOP_CHEEK_Z = STOP_MAST_TOP_LZ - STOP_CHEEK_H / 2; // cheeks hang from that ceiling
// The cheeks straddle the crank OUT OF ITS SWING PLANE — local x is the hinge
// axis, so no crank point ever crosses it — hence the offset is just the
// crank's hub half-width, the margin, and their own half-thickness:
const STOP_CHEEK_X = STOP_HUB_HALF_X + HACK_CLEAR_MARGIN + STOP_CHEEK_T / 2;
const STOP_CHEEK_FRONT = 0.75;  // cheek overhang past the pin, on the swing side
const STOP_PIN_PROUD = 0.135;   // pin ends showing proud of the cheeks
// Post: base plate top (seated 0.3 in) up to that same ceiling.
const STOP_POST_RT = 0.6, STOP_POST_RB = 0.7;
const STOP_POST_Z0 = -(Z_STOP_PIVOT + 0.3), STOP_POST_Z1 = STOP_MAST_TOP_LZ;
const stopPostR = (z) => STOP_POST_RB + (STOP_POST_RT - STOP_POST_RB)
  * clamp((z - STOP_POST_Z0) / (STOP_POST_Z1 - STOP_POST_Z0), 0, 1);
// Stand-off, SOLVED. With the post a column at (0, side·Y) — side being the
// swing-away side — a swept crank sample p clears it iff
//   hypot(p.x, |Y − side·p.y|) ≥ r_post(p.z) + CLEAR_MARGIN,
// and with Y outboard of every sample that is
//   Y ≥ side·p.y + √((r + margin)² − p.x²),
// and that binds only on samples the column could ever reach at all — those
// within its radius in x. (The pad end of the arm stands 3+ out along the
// hinge axis: it is the crank's furthest reach to this side, and it does not
// vote, because no stand-off of a column at x = 0 can help or hurt it.) So Y
// is the maximum of that right-hand side over the CONSTRAINING samples: the
// smallest offset that stands the post off the crank, binding exactly at the
// margin against whatever reaches furthest this way (the pad arm's flank
// where it passes the hub). The column is treated as full height, which is
// conservative for samples above its top — and there are none: the crank
// tops out at the drop leg's hub, well under the mast ceiling.
const STOP_BR_SIDE = STOP_PSI0 >= 0 ? -1 : 1;
const STOP_BR_Y = -stopSweptMin((x, y, z) => {
  const rr = stopPostR(z) + HACK_CLEAR_MARGIN;
  if (Math.abs(x) >= rr) return Infinity; // clear of the column in x, whatever Y is
  return -(STOP_BR_SIDE * y + Math.sqrt(rr * rr - x * x));
});
// The bracket as DATA: the meshes and the clearance assert below are built
// from the same list, so anything ever added to the bracket is checked too.
const STOP_BRACKET_PARTS = [
  { post: true, x: 0, y: STOP_BR_SIDE * STOP_BR_Y,
    z0: STOP_POST_Z0, z1: STOP_POST_Z1, r0: STOP_POST_RB, r1: STOP_POST_RT },
  ...[-1, 1].map((s) => ({
    x: s * STOP_CHEEK_X, y: STOP_BR_SIDE * (STOP_BR_Y - STOP_CHEEK_FRONT) / 2, z: STOP_CHEEK_Z,
    w: STOP_CHEEK_T, d: STOP_BR_Y + STOP_CHEEK_FRONT, h: STOP_CHEEK_H,
  })),
];
{
  for (const p of STOP_BRACKET_PARTS) {
    let mesh;
    if (p.post) {
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(p.r1, p.r0, p.z1 - p.z0, 12), MATS.steel);
      mesh.rotation.x = Math.PI / 2; // cylinder's native +Y → local +Z
      mesh.position.set(p.x, p.y, (p.z0 + p.z1) / 2);
    } else {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.d, p.h), MATS.steel);
      mesh.position.set(p.x, p.y, p.z);
    }
    stopLeverGroup.add(mesh);
  }
  // The blued hinge pin is deliberately NOT in that list: it is the JOURNAL,
  // coaxial with the hinge axis, so it cannot sweep and the crank turns ON it
  // by design — hub material around it is a bearing fit, not a collision.
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2,
    2 * (STOP_CHEEK_X + STOP_CHEEK_T / 2 + STOP_PIN_PROUD), 10), MATS.blueSteel);
  pin.rotation.z = Math.PI / 2; // cylinder's native Y → local X
  stopLeverGroup.add(pin);
}
// INTRA-UNIT ASSERT — the check the inspection battery structurally cannot
// make: every pair scan in inspect.js enumerates DISTINCT units, so a bracket
// buried inside its own crank is invisible to it. Exact signed distance from
// each swept crank sample to each bracket part (box: the usual outside/inside
// split; post: radial, its taper being 0.7° off vertical).
const STOP_BRACKET_CLEAR = stopSweptMin((x, y, z) => {
  let d = Infinity;
  for (const p of STOP_BRACKET_PARTS) {
    if (p.post) {
      const t = clamp((z - p.z0) / (p.z1 - p.z0), 0, 1);
      const dr = Math.hypot(x - p.x, y - p.y) - (p.r0 + (p.r1 - p.r0) * t);
      const dz = Math.max(p.z0 - z, z - p.z1);
      d = Math.min(d, dz <= 0 ? dr : (dr <= 0 ? dz : Math.hypot(dr, dz)));
    } else {
      const ex = Math.abs(x - p.x) - p.w / 2, ey = Math.abs(y - p.y) - p.d / 2,
        ez = Math.abs(z - p.z) - p.h / 2;
      d = Math.min(d, Math.hypot(Math.max(ex, 0), Math.max(ey, 0), Math.max(ez, 0))
        + Math.min(Math.max(ex, ey, ez), 0));
    }
  }
  return d;
});
// (tolerance for the float round-trip: the stand-off solve above binds this
// EXACTLY at the margin, same as the released-drop assert)
if (STOP_BRACKET_CLEAR < HACK_CLEAR_MARGIN - 1e-6)
  console.warn('stop work: the crank sweeps its own bracket — clearance',
    STOP_BRACKET_CLEAR.toFixed(3), '<', HACK_CLEAR_MARGIN);
// The bracket now reaches STOP_BR_Y to one side of the pivot instead of
// sitting on it, and it stands in the plate cut's OPEN WEDGE (|φ| ≤ phiOpen
// about the cut's aim, where the plate is removed all the way to the rim).
// The bearing scan reserved an angular half-width for a mast that had no
// stand-off, so check the BUILT extremes against the real wedge (arc length
// at the part's own radius, which is the distance to the wedge's edge).
{
  const cs = Math.cos(STOP_BEARING), sn = Math.sin(STOP_BEARING);
  let worst = Infinity;
  for (const p of STOP_BRACKET_PARTS) {
    const hx = p.post ? Math.max(p.r0, p.r1) : p.w / 2;
    const hy = p.post ? Math.max(p.r0, p.r1) : p.d / 2;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      const lx = p.x + sx * hx, ly = p.y + sy * hy;
      const dx = STOP_PIVOT.x + cs * lx - sn * ly - P.balance.x;
      const dy = STOP_PIVOT.y + sn * lx + cs * ly - P.balance.y;
      const off = Math.atan2(dy, dx) - TQ_CUT.aim;
      const phi = Math.abs(Math.atan2(Math.sin(off), Math.cos(off)));
      worst = Math.min(worst, (TQ_CUT.phiOpen - phi) * Math.hypot(dx, dy));
    }
  }
  if (worst < CLEAR_MARGIN)
    console.warn('stop work: the bracket reaches out of the plate cut wedge by',
      (CLEAR_MARGIN - worst).toFixed(2));
}

// Hack rod: elbow link on the low plane, solved exactly like the reset
// rod's (the endpoints here come from the crank solve; the slight z-slope
// toward the crank end is carried by the placement quaternion).
const HACK_ROD_ELBOW = (() => {
  const poses = [];
  let prev = STOP_PSI0;
  for (let t = 0; t <= 1.0001; t += 0.125) {
    const post = tailPostWorldAt(t);
    const psi = stopSolvePsi(post, prev);
    prev = psi;
    const tt = stopTailTopAt(psi);
    poses.push({ a: post, b: { x: tt.x, y: tt.y } });
  }
  const best = solveElbow(HACK_ROD_LEN, poses);
  if (best.clear < 0)
    console.warn(`hack rod elbow: best clearance ${best.clear.toFixed(2)} — the low corridor is fouled`);
  return best;
})();
const hackRod = makeElbowRodMesh(HACK_ROD_LEN, HACK_ROD_ELBOW.f, HACK_ROD_ELBOW.e);
movement.add(hackRod);
registerLabel('Hack rod', hackRod);

let stopPsiState = STOP_PSI0;
const _rodUp = new THREE.Vector3(0, 1, 0);
const _rodDir = new THREE.Vector3();
function updateStopWork(post) {
  // Rim = hard stop: the rod can never rotate the crank past the tangent
  // pose (ψ = 0), however the eased crownPullT overshoots numerically.
  // The released side's SIGN follows the hanging-tail geometry, so the
  // clamp keeps ψ on STOP_PSI0's side of zero.
  const psi = stopSolvePsi(post, stopPsiState);
  stopPsiState = STOP_PSI0 <= 0 ? Math.min(0, psi) : Math.max(0, psi);
  stopCrank.rotation.x = stopPsiState;
  const t = stopTailTopAt(stopPsiState);
  hackRod.position.set((post.x + t.x) / 2, (post.y + t.y) / 2, (ROD2_PLANE_Z + t.z) / 2);
  _rodDir.set(t.x - post.x, t.y - post.y, t.z - ROD2_PLANE_Z).normalize();
  hackRod.quaternion.setFromUnitVectors(_rodUp, _rodDir);
}
updateStopWork(postRel); // rest pose (crown in)

// --- LOW-LINKAGE SWEPT CORRIDOR — the one obstacle model for every LATER
// seat scan (balance-cock legs, pillar seats). Both rods were built before
// those scans run, so their own elbow scans could not see what comes next:
// whatever is placed afterwards must yield to the linkage instead. Sampled
// over the full crown stroke: the setting-lever tail post's swing arc,
// both rods' elbow segments (+ knuckle), and the reset hammer's arm.
// Entries are XY circles {x,y,r} / stadium segments {ax..by,r} at the
// parts' OWN radii — each consumer adds its own reach plus CLEAR_MARGIN.
const LOW_LINKAGE_OBSTACLES = (() => {
  const obs = [];
  const pushElbow = (a, b, elbow) => {
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
    const ux = dx / L, uy = dy / L, nx = uy, ny = -ux;
    const E = { x: a.x + ux * L * elbow.f + nx * elbow.e, y: a.y + uy * L * elbow.f + ny * elbow.e };
    obs.push({ ax: a.x, ay: a.y, bx: E.x, by: E.y, r: ROD_R });
    obs.push({ ax: E.x, ay: E.y, bx: b.x, by: b.y, r: ROD_R });
    obs.push({ x: E.x, y: E.y, r: ROD_R * 1.15 });
  };
  let q = hammerTailTipAt(hammerBaseAngle + HAMMER_SWING_RAD, HAMMER_TAIL_DELTA.delta);
  let psi = STOP_PSI0;
  for (let i = 0; i <= 12; i++) {
    const post = tailPostWorldAt(i / 12);
    obs.push({ x: post.x, y: post.y, r: G.SETTING_LEVER_POST_R });
    q = intersectTail(post, RESET_ROD_LEN, q).q;
    pushElbow(post, q, RESET_ROD_ELBOW);
    obs.push({ ax: hammerPivotPos.x, ay: hammerPivotPos.y, bx: q.x, by: q.y, r: 0.7 });
    psi = stopSolvePsi(post, psi);
    pushElbow(post, stopTailTopAt(psi), HACK_ROD_ELBOW);
  }
  return obs;
})();

// ---------------------------------------------------------------------------
// Fusee & chain — torque equalisation. The spring DRUM sits beside the fusee;
// the chain leaves the drum, crosses on an external tangent, and wraps the
// cone helically. Fully wound: the chain pulls at the cone's SMALL radius
// (strong spring × short arm); run down: at the LARGE radius (weak spring ×
// long arm) — the products match, so train torque stays level. The cone
// profile and the spring model are chosen so S(t)·r_f(t) is constant:
// S = 0.35 + 0.65·t (linear spring), r_f = lerp(rLarge, rSmall, t), with
// rLarge/rSmall = S(1)/S(0) = 2.857.
// ---------------------------------------------------------------------------
const DRUM_R = DRUM_R_ACTUAL;
const FUSEE_AVG_R = (FUSEE_R_SMALL + FUSEE_R_LARGE) / 2;
const FUSEE_WRAP_TURNS = 3.75; // = RESERVE_BARREL_TURNS (declared later): 30 h at 1 rev/8 h
const CHAIN_ENGAGED = 2 * Math.PI * FUSEE_AVG_R * FUSEE_WRAP_TURNS; // chain length that moves over a full reserve
// Drum direction: perpendicular-to-stem, blended outward (away from the
// plate centre) so the chain's span stays clear of the train — the pure
// perpendicular placement let the span cross the third wheel as the active
// fusee radius grew (inspector finding).
const drumDirRawX = -sideSign * vPerp.x + uWind.x * 0.45;
const drumDirRawY = -sideSign * vPerp.y + uWind.y * 0.45;
const drumDirL = Math.hypot(drumDirRawX, drumDirRawY) || 1;
const drumDir = { x: drumDirRawX / drumDirL, y: drumDirRawY / drumDirL };
const drumPos = {
  x: P.barrel.x + drumDir.x * (FUSEE_R_LARGE + DRUM_R + 2.5),
  y: P.barrel.y + drumDir.y * (FUSEE_R_LARGE + DRUM_R + 2.5),
};
// Drum seat: LIFTED above the great wheel's plane. At the compact 2.5-unit
// gap the drum's silhouette overlaps the great wheel's radius in XY, so
// the clearance is vertical: drum bottom sits above the wheel's top face
// (the fusee grooves are higher still, so the chain span stays level-ish).
const Z_DRUM = (DRUM_BOT_Z + DRUM_TOP_Z) / 2; // drum body is built centred; band solved with its height up top
// Arbor sized to its bearings: up to the plate's mid-thickness bushing
// (the old fixed height·2.4 was tuned for the tall stack and would poke
// 2.5 past the spring-bound plate), down just past the body for the lower
// pivot to continue.
const barrel = G.makeBarrel({
  radius: DRUM_R_ACTUAL, height: DRUM_HEIGHT, plain: true,
  arborH: 2 * (TQ_MID_Z - Z_DRUM),
});
const drumGroup = new THREE.Group();
drumGroup.position.set(drumPos.x, drumPos.y, Z_DRUM);
drumGroup.add(barrel);
movement.add(drumGroup);
registerExplode(drumGroup, Z_DRUM, 1);
registerLabel('Mainspring drum', drumGroup);
// The drum turns on its own arbor between the plates — lower pivot into
// the main plate, same as every train arbor (see addLowerPivot above).
addLowerPivot(drumGroup, { staffR: 0.6, jewelR: 1.4 });

// Chain: rebuilt (cheaply) whenever the reserve state moves enough to see.
const FUSEE_Z0 = L_BARREL + FUSEE_BASE_Z + FUSEE_H * 0.06; // world z of the lowest groove
const FUSEE_ZSPAN = FUSEE_H * 0.88;               // groove band height
const chainMat = new THREE.MeshPhysicalMaterial({ color: 0x3a3d42, metalness: 1, roughness: 0.45 });
let chainMesh = null;
let lastChainTension = -1;
let chainTensionNow = 0; // written by every tick(); consumed by updateChainIfMoved() (§14)
// The chain is drawn as what a fusee chain IS: a miniature bicycle chain —
// alternating inner/outer plate pairs riveted through pins. The pin axes
// stay parallel to the arbors the whole way round (cone wrap, span and
// drum coil alike, as on the real thing), so the plates lie flat in the
// coil and successive turns clear each other at the 0.65 coil pitch:
const CHAIN_PITCH = 0.8;    // rivet-to-rivet along the chain
const CHAIN_PIN_LEN = 0.62; // total stack height — inside the 0.65 coil pitch
const CHAIN_PLATE_T = 0.11;
// One template per part, kept as raw non-indexed arrays so a rebuild is a
// plain transform-and-fill into one big buffer (no per-link allocations
// beyond the buffer itself). Plate pair z-stack, mirrored about the chain
// centreline: inner faces 0.06..0.17, outer 0.20..0.31 — the pins run
// flush to the outer faces, their ends reading as rivet heads.
function chainPlatePairTemplate(endR, zOff) {
  const half = CHAIN_PITCH / 2;
  const s = new THREE.Shape(); // stadium: rivet-hole centres at ±half
  s.absarc(-half, 0, endR, Math.PI / 2, Math.PI * 1.5, false);
  s.absarc(half, 0, endR, Math.PI * 1.5, Math.PI / 2, false);
  const one = new THREE.ExtrudeGeometry(s, { depth: CHAIN_PLATE_T, bevelEnabled: false, curveSegments: 4 });
  const pos = [], nrm = [];
  for (const zc of [zOff - CHAIN_PLATE_T / 2, -zOff - CHAIN_PLATE_T / 2]) {
    const g = one.clone().translate(0, 0, zc);
    pos.push(...g.attributes.position.array);
    nrm.push(...g.attributes.normal.array);
    g.dispose();
  }
  one.dispose();
  return { pos: Float32Array.from(pos), nrm: Float32Array.from(nrm) };
}
const CHAIN_TMPL = (() => {
  const inner = chainPlatePairTemplate(0.2, 0.115);
  const outer = chainPlatePairTemplate(0.23, 0.255);
  const pinGeo = new THREE.CylinderGeometry(0.13, 0.13, CHAIN_PIN_LEN, 8).rotateX(Math.PI / 2).toNonIndexed();
  const pin = {
    pos: Float32Array.from(pinGeo.attributes.position.array),
    nrm: Float32Array.from(pinGeo.attributes.normal.array),
  };
  pinGeo.dispose();
  return { inner, outer, pin };
})();
function buildChainLinkGeometry(curve) {
  curve.arcLengthDivisions = 800; // the coils are tight; the default 200 under-resolves arc length
  const len = curve.getLength();
  const N = Math.max(Math.round(len / CHAIN_PITCH), 2);
  const joints = curve.getSpacedPoints(N); // N+1 rivet positions, arc-length uniform
  const { inner, outer, pin } = CHAIN_TMPL;
  // Parity is anchored at the CLAW end so the link that drops over the
  // hook's pin is always an outer pair, whatever N rounds to this rebuild.
  const isOuter = (i) => (N - 1 - i) % 2 === 0;
  let total = (N + 1) * pin.pos.length;
  for (let i = 0; i < N; i++) total += (isOuter(i) ? outer : inner).pos.length;
  const pos = new Float32Array(total), nrm = new Float32Array(total);
  let off = 0;
  // Write a template transformed by the orthonormal frame with basis
  // columns (t̂,ŷ,k̂) and translation c — normals rotate by the same basis.
  const write = (tmpl, t, y, k, c) => {
    const P = tmpl.pos, Q = tmpl.nrm;
    for (let i = 0; i < P.length; i += 3) {
      const a = P[i], b = P[i + 1], d = P[i + 2];
      pos[off + i] = t.x * a + y.x * b + k.x * d + c.x;
      pos[off + i + 1] = t.y * a + y.y * b + k.y * d + c.y;
      pos[off + i + 2] = t.z * a + y.z * b + k.z * d + c.z;
      const na = Q[i], nb = Q[i + 1], nd = Q[i + 2];
      nrm[off + i] = t.x * na + y.x * nb + k.x * nd;
      nrm[off + i + 1] = t.y * na + y.y * nb + k.y * nd;
      nrm[off + i + 2] = t.z * na + y.z * nb + k.z * nd;
    }
    off += P.length;
  };
  const t = new THREE.Vector3(), k = new THREE.Vector3(), y = new THREE.Vector3();
  const mid = new THREE.Vector3();
  const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
  for (let i = 0; i < N; i++) {
    const a = joints[i], b = joints[i + 1];
    t.subVectors(b, a).normalize();
    // Pin axis: world-vertical with the tangent's component removed, so
    // plates stay flat while the span carries its slight z slope.
    k.set(-t.z * t.x, -t.z * t.y, 1 - t.z * t.z).normalize();
    y.crossVectors(k, t);
    mid.addVectors(a, b).multiplyScalar(0.5);
    write(isOuter(i) ? outer : inner, t, y, k, mid);
  }
  for (let i = 0; i <= N; i++) write(pin, X, Y, Z, joints[i]); // rivets, world-vertical
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  return geo;
}
function fuseeGrooveAt(f) { // f: 0 = bottom/large end … 1 = top/small end
  return {
    r: FUSEE_R_LARGE + (FUSEE_R_SMALL - FUSEE_R_LARGE) * f,
    z: FUSEE_Z0 + FUSEE_ZSPAN * f,
  };
}
// --- The chain's BARREL ATTACHMENT. The chain hooks to the drum wall at a
// fixed point and the accumulating wraps STACK DOWNWARD from it: the hook
// sits at the top of the coil zone, each arriving turn lays one chain
// diameter below the last, and the takeoff tangent point descends with the
// coil as the reserve drains (mirroring the fusee side, whose active
// groove descends too — the span stays near-level over the whole reserve).
// The old construction was inverted: the tangent was pinned near the
// drum's top and the chain's FREE END descended, ending in mid-air with
// no attachment at all.
const COIL_TOP = DRUM_TOP_Z - 0.6; // hook plane: just under the drum's lid
// Hook angle, drum-local. The wrap's far end lands at world angle
// thetaT + turns·2π and the drum's rotation is rot = (1−tension)·C/R, so
// a fixed drum-local hook works iff the wrap's fractional turn absorbs
// thetaT's small drift with tension (the wrap length IS set by geometry —
// see rebuildChain). Placing the hook at thetaT(mid-reserve) + 0.3 turns
// centres that fractional solve on the +0.3 slack turn, giving the
// round-to-nearest branch maximum headroom against the ±0.02-turn drift.
const HOOK_A = (() => {
  const midR = fuseeGrooveAt(0.5 * 0.94).r;
  const dx = drumPos.x - P.barrel.x, dy = drumPos.y - P.barrel.y;
  const thetaMid = Math.atan2(dy, dx) - Math.acos(clamp((midR - DRUM_R) / Math.hypot(dx, dy), -1, 1));
  return thetaMid + 0.3 * Math.PI * 2;
})();
{
  // The hook itself: a riveted tab on the drum wall with a claw pin the
  // chain's end link drops over — child of drumGroup, so it turns with the
  // barrel and the ['Chain','Mainspring drum'] support edge measures real
  // geometry (the chain's last point is placed ON this claw).
  const hookLocalZ = COIL_TOP - Z_DRUM;
  const tab = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.1, 0.9), MATS.steel);
  tab.position.set(Math.cos(HOOK_A) * (DRUM_R + 0.25), Math.sin(HOOK_A) * (DRUM_R + 0.25), hookLocalZ);
  tab.rotation.z = HOOK_A;
  drumGroup.add(tab);
  const claw = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.8, 8), MATS.steel);
  claw.rotation.z = HOOK_A + Math.PI / 2; // pin lies tangentially along the wall
  claw.position.set(Math.cos(HOOK_A) * (DRUM_R + 0.45), Math.sin(HOOK_A) * (DRUM_R + 0.45), hookLocalZ);
  drumGroup.add(claw);
}
function rebuildChain(tension) {
  lastChainTension = tension;
  const fActive = tension * 0.94;
  const active = fuseeGrooveAt(fActive);
  // External tangent between the fusee's active circle and the drum.
  const dx = drumPos.x - P.barrel.x, dy = drumPos.y - P.barrel.y;
  const D = Math.hypot(dx, dy);
  const base = Math.atan2(dy, dx);
  const alpha = Math.acos(clamp((active.r - DRUM_R) / D, -1, 1));
  // Tangent BRANCH matters: the arbor runs CCW, so paying out requires the
  // cone's surface velocity at the departure point (its CCW tangent) to
  // point along the span toward the drum — that's the base−α branch. The
  // +α branch puts the span on the side where the surface moves INTO the
  // wrap, i.e. the chain peels off the wrong tangent.
  const thetaT = base - alpha; // tangent departure angle on both circles
  const pts = [];
  // 1. Helical wrap on the cone: from the bottom groove up to the active one,
  //    ending at the tangent departure angle.
  const wraps = Math.max(tension * FUSEE_WRAP_TURNS, 0.05);
  const SEG_PER_TURN = 14;
  const nF = Math.max(Math.ceil(wraps * SEG_PER_TURN), 2);
  for (let i = 0; i <= nF; i++) {
    const s = (i / nF) * wraps;              // turns from the stack's bottom
    const f = (s / wraps) * fActive;
    const gp = fuseeGrooveAt(f);
    const ang = thetaT - (wraps - s) * Math.PI * 2;
    pts.push(new THREE.Vector3(
      P.barrel.x + Math.cos(ang) * gp.r,
      P.barrel.y + Math.sin(ang) * gp.r,
      gp.z
    ));
  }
  // 2+3. Drum coil, hook-anchored. The wrap's turn count is SOLVED so its
  // far end lands exactly on the hook (fixed on the rotating drum at
  // drum-local HOOK_A): world hook angle = HOOK_A + rot must equal
  // thetaT + turns·2π, so the fractional part of `turns` comes from that
  // congruence and the whole part from the chain-length accounting
  // (round-to-nearest is branch-stable: HOOK_A centres the offset — see
  // its comment). The coil hangs DOWN from the hook, one chain diameter
  // per turn, so the takeoff tangent point descends as the reserve drains.
  const rot = ((1 - tension) * CHAIN_ENGAGED) / DRUM_R; // = drumGroup.rotation.z in tick()
  const baseTurns = ((1 - tension) * CHAIN_ENGAGED) / (2 * Math.PI * DRUM_R) + 0.3;
  let frac = ((HOOK_A + rot - thetaT) / (2 * Math.PI)) % 1;
  if (frac < 0) frac += 1;
  const drumTurns = Math.max(Math.round(baseTurns - frac) + frac, 0.05);
  const takeoffZ = COIL_TOP - drumTurns * 0.65;
  const TB = { x: drumPos.x + Math.cos(thetaT) * DRUM_R, y: drumPos.y + Math.sin(thetaT) * DRUM_R };
  pts.push(new THREE.Vector3(TB.x, TB.y, takeoffZ));
  const nD = Math.max(Math.ceil(drumTurns * SEG_PER_TURN), 2);
  for (let i = 1; i <= nD; i++) {
    const s = (i / nD) * drumTurns;
    const ang = thetaT + s * Math.PI * 2;
    pts.push(new THREE.Vector3(
      drumPos.x + Math.cos(ang) * DRUM_R,
      drumPos.y + Math.sin(ang) * DRUM_R,
      COIL_TOP - (drumTurns - s) * 0.65 // climbs back up to the hook plane
    ));
  }
  // ...and the end link steps out onto the hook's claw pin.
  const hookAng = thetaT + drumTurns * Math.PI * 2; // ≡ HOOK_A + rot by the solve above
  pts.push(new THREE.Vector3(
    drumPos.x + Math.cos(hookAng) * (DRUM_R + 0.45),
    drumPos.y + Math.sin(hookAng) * (DRUM_R + 0.45),
    COIL_TOP
  ));
  const curve = new THREE.CatmullRomCurve3(pts);
  const geo = buildChainLinkGeometry(curve);
  if (chainMesh) {
    chainMesh.geometry.dispose();
    chainMesh.geometry = geo;
  } else {
    chainMesh = new THREE.Mesh(geo, chainMat);
    movement.add(chainMesh);
    registerLabel('Chain', chainMesh);
  }
}
// The chain is DISPLAY-only — nothing reads its geometry back into the
// mechanism — so it rebuilds at most once per RENDERED frame, not per tick
// (§14): tick() only records the tension, and the caller that is about to
// paint (advanceFrame, __clock.step) or to measure (setPose, which the
// inspection battery's support sweep reads chain geometry through) calls
// this. Inside tick it cost up to 12 dispose/allocate cycles per displayed
// frame on a machine slow enough to hit the realDt clamp — the slower the
// machine, the more geometry churn, exactly backwards.
function updateChainIfMoved() {
  // 0.0015 of tension ≈ one chain-diameter of takeoff travel — the smallest
  // rebuild that is visible at all (the old in-tick threshold, unchanged).
  if (Math.abs(chainTensionNow - lastChainTension) > 0.0015) rebuildChain(chainTensionNow);
}

// ---------------------------------------------------------------------------
// THREE-QUARTER PLATE — build. Deliberately the LAST structural step: every
// opening in it and the seating of everything on it is measured off parts
// that already exist, rather than predicted. (Its z-stack and the balance
// cut were solved up with the plates, because the stop work and the reset
// rod both had to be laid out against them.)
// ---------------------------------------------------------------------------

// Openings, all derived from the geometry they pass:
//  · one bore per upper pivot (train, pallet fork, and the reset hammer's
//    arbor), cut PIVOT_BORE_CLEAR over the staff;
//  · a slot for the setting lever's tail post and the ramp collar pressed on
//    it, swept over the full crown stroke.
//
// The spring DRUM does NOT get an opening. Its body tops out at 9.5, a full
// 3.3 under the plate — the 13.0 that made it look like a through-part is its
// ARBOR, and an arbor reaching the plate is a pivot, not an obstruction. So
// it is bored and bushed like everything else (plain brass, no jewel: this is
// the slow, heavily-loaded barrel arbor, and a 0.8 plate cannot swallow a
// chaton wide enough for it anyway) — which also gives the drum the upper
// bearing it never had.
addUpperPivot(drumGroup, { staffR: 0.9, jewelR: 0, boreR: 0.95 });

// ---------------------------------------------------------------------------
// MAINTAINING POWER — Harrison's sandwich at the great wheel, the honest
// home of every moving click in a fusee. The great wheel is loose on the
// fusee arbor; drive flows cone → base ratchet → PAWLS on the maintaining
// wheel → maintaining spring → great wheel. While WINDING, the fusee (and
// its base ratchet) reverse under the pawls — they click over backwards —
// and the plate DETENT holds the maintaining wheel so the maintaining
// spring keeps the train fed. While RUNNING, pawls sit locked, the whole
// sandwich creeps with the wheel, and the detent slowly ticks over the
// maintaining wheel's rim teeth. The detent never sees reverse motion —
// which is why a fixed pawl is legal HERE and nowhere on the arbor.
//
// GEOMETRY IS SQUEEZED by the tornado layout, and the derivation says so:
// the center wheel sweeps under the cone (the chain clears it VERTICALLY
// — FUSEE_BASE_Z's window term), so a full-diameter sandwich would run
// straight through it. Every radius below is bound by the center wheel's
// closest approach to the barrel axis; every z by the wheel hub below and
// the chain's lowest links above.
// ---------------------------------------------------------------------------
const MAINT_TEETH = 24;
// RADIAL BOUND: the center wheel's tip circle comes within this of the
// barrel axis — every full-circumference part of the sandwich must stay
// a margin inside it.
const _cwTipNear = barrelDist - (centerWheel.userData.r || 12) - 0.36; // − pitch r − addendum = tip-circle approach
const MAINT_RING_R = _cwTipNear - CLEAR_MARGIN;
const MAINT_RING_ROOT = MAINT_RING_R * 0.8;
// The pawl pivot studs need SOLID footing on the ring (inside its tooth
// roots), and the builder pivots a click at 1.28·its radius — so the
// flange's radius is derived backwards from the footing bound.
const MAINT_PAWL_PIV = MAINT_RING_ROOT - 0.25; // stud centre: stud r 0.22 + shy of the root land
const MAINT_FLANGE_R = MAINT_PAWL_PIV / 1.28;
// z BOUNDS: ring above the great wheel HUB (its tallest central feature),
// flange below the chain's lowest links on the cone's bottom groove.
const GW_HUB_TOP = L_BARREL + (1.4 * 1.5) / 2; // makeGear hub ring: thickness·1.5, centred on the wheel
const MAINT_CHAIN_LOW = FUSEE_Z0 - CHAIN_PIN_LEN / 2; // underside of the lowest chain wrap
const MAINT_RING_T = 0.5, MAINT_FLANGE_T = 0.5;
const MAINT_RING_BOT = GW_HUB_TOP + CLEAR_MARGIN;
const MAINT_RING_TOP = MAINT_RING_BOT + MAINT_RING_T;
const MAINT_FLANGE_TOP = MAINT_CHAIN_LOW - CLEAR_MARGIN;
const MAINT_FLANGE_BOT = MAINT_FLANGE_TOP - MAINT_FLANGE_T;
if (MAINT_FLANGE_BOT < MAINT_RING_TOP + 0.1)
  console.warn(`maintaining power: flange bottom ${MAINT_FLANGE_BOT.toFixed(2)} crowds the ring top ${MAINT_RING_TOP.toFixed(2)} — the sandwich band collapsed`);
// Base ratchet flange: keyed to the FUSEE (winds backward with it). A hub
// boss carries it down from the cone's base.
{
  const flange = G.makeRatchetAndClick({ radius: MAINT_FLANGE_R, teeth: MAINT_TEETH, thickness: MAINT_FLANGE_T, includeClick: false });
  flange.position.z = MAINT_FLANGE_BOT - (L_BARREL + FUSEE_BASE_Z); // fusee-local (the fusee sits at FUSEE_BASE_Z in the arbor group)
  fusee.add(flange);
  const bossH = (L_BARREL + FUSEE_BASE_Z) - MAINT_FLANGE_TOP;
  const bossR = MAINT_FLANGE_R * 0.8 - 0.15; // inside the flange's root land
  const boss = new THREE.Mesh(new THREE.CylinderGeometry(bossR, bossR, bossH, 14), MATS.steel);
  boss.rotation.x = Math.PI / 2;
  boss.position.z = -bossH / 2; // fusee-local: hangs from the cone's base plane
  fusee.add(boss);
}
// Maintaining wheel: loose on the arbor, rim saw teeth for the detent,
// carrying two pawls that ride the flange above. Child of barrelArbor
// WITHOUT windBack — it turns only with the train, so it never reverses.
const maintWheel = new THREE.Group();
const MAINT_PAWL_SEATS = []; // filled below; tick rides them on windBack
{
  const ring = G.makeRatchetAndClick({ radius: MAINT_RING_R, teeth: MAINT_TEETH, thickness: MAINT_RING_T, includeClick: false });
  ring.position.z = MAINT_RING_BOT - L_BARREL;
  maintWheel.add(ring);
  // Two opposed pawls, pivot studs footed inside the ring's root land,
  // beaks in the flange's teeth. π apart = 12 tooth pitches, so both
  // share the builder's beak-at-valley registration.
  for (const k of [0, 1]) {
    const az = new THREE.Group();
    az.rotation.z = k * Math.PI;
    maintWheel.add(az);
    const pawl = G.makeClick({ radius: MAINT_FLANGE_R, thickness: MAINT_FLANGE_T * 0.8 });
    pawl.position.set(MAINT_PAWL_PIV, 0, MAINT_FLANGE_BOT + MAINT_FLANGE_T * 0.1 - L_BARREL);
    pawl.rotation.z = Math.PI * 0.778;
    pawl.name = 'maintPawl';
    az.add(pawl);
    const studH = MAINT_FLANGE_TOP - MAINT_RING_TOP;
    const stud = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, studH, 8), MATS.blueSteel);
    stud.rotation.x = Math.PI / 2;
    stud.position.set(MAINT_PAWL_PIV, 0, MAINT_RING_TOP + studH / 2 - L_BARREL);
    az.add(stud);
    MAINT_PAWL_SEATS.push(pawl);
  }
  // The maintaining SPRING: coiled flat in the gap under the ring, hooked
  // to a stud on the great wheel's face — mostly hidden, as in the real
  // thing; the power-flow view lights it when it is what feeds the train.
  const msArc = new THREE.Mesh(new THREE.TorusGeometry(MAINT_RING_ROOT * 0.6, 0.08, 6, 20, Math.PI * 1.5), MATS.blueSteel);
  msArc.position.z = (GW_HUB_TOP + MAINT_RING_BOT) / 2 - L_BARREL;
  msArc.name = 'maintSpring';
  maintWheel.add(msArc);
}
barrelArbor.add(maintWheel); // train rotation only — tick never adds windBack here
// Pawl ride constants — seat measured from the built geometry, lift sign
// derived numerically (same scheme the plate click used).
const MAINT_PAWL_BASE = Math.PI * 0.778;
const _mpTip = (rot) => ({ x: MAINT_PAWL_PIV + Math.cos(rot) * MAINT_FLANGE_R * 0.8, y: Math.sin(rot) * MAINT_FLANGE_R * 0.8 });
const _mp0 = _mpTip(MAINT_PAWL_BASE);
const MAINT_PAWL_TIP_R = Math.hypot(_mp0.x, _mp0.y);
const MAINT_PAWL_TIP_AZ = Math.atan2(_mp0.y, _mp0.x);
const MAINT_PAWL_SIGN = Math.sign(Math.hypot(_mpTip(MAINT_PAWL_BASE + 1e-4).x, _mpTip(MAINT_PAWL_BASE + 1e-4).y) - MAINT_PAWL_TIP_R) || 1;
if (MAINT_PAWL_TIP_R > MAINT_FLANGE_R - 0.05 || MAINT_PAWL_TIP_R < MAINT_FLANGE_R * 0.8 - 0.1)
  console.warn(`maintaining pawl tip seats at ${MAINT_PAWL_TIP_R.toFixed(2)} — outside the flange's working band [${(MAINT_FLANGE_R * 0.8).toFixed(2)}, ${MAINT_FLANGE_R.toFixed(2)}]`);
// Saw profile shared by pawls and detent (the builder's tooth: root→tip
// chord over 72% of the pitch, face over the last 28%).
function sawRadiusAt(u, R) {
  const rootR = R * 0.8, depth = R * 0.2;
  return u <= 0.72 ? rootR + (depth * u) / 0.72 : R - (depth * (u - 0.72)) / 0.28;
}
// Detent handles — built with its own cock after the drum (it needs the
// spur/transfer envelope for its footing); null until then.
let maintDetentBeak = null;
let MAINT_DETENT_AZ = 0, MAINT_DET_TIP_AZ = 0, MAINT_DET_TIP_R = 0,
    MAINT_DET_LEVER = 1, MAINT_DET_BASE = 0, MAINT_DET_SIGN = 1;
// The pawls ride the RELATIVE angle flange-vs-wheel — which is exactly
// windBack: zero while running (locked, torque flows), sweeping backward
// during winding (click-click while the detent holds the wheel). The
// detent rides the wheel's ABSOLUTE rotation — pure train creep, one
// slow tick per tooth as the watch runs, and NEVER a reverse pass.
function updateMaintaining(windBack) {
  for (let k = 0; k < MAINT_PAWL_SEATS.length; k++) {
    let u = (((MAINT_PAWL_TIP_AZ - windBack) * MAINT_TEETH) / (2 * Math.PI)) % 1;
    if (u < 0) u += 1;
    const lift = Math.max(sawRadiusAt(u, MAINT_FLANGE_R) - MAINT_PAWL_TIP_R, 0) / (MAINT_FLANGE_R * 0.8);
    MAINT_PAWL_SEATS[k].rotation.z = MAINT_PAWL_BASE + MAINT_PAWL_SIGN * lift;
  }
  if (maintDetentBeak) {
    const net = barrelArbor.rotation.z - MAINT_DETENT_AZ;
    let u = (((MAINT_DET_TIP_AZ - net) * MAINT_TEETH) / (2 * Math.PI)) % 1;
    if (u < 0) u += 1;
    const lift = Math.max(sawRadiusAt(u, MAINT_RING_R) - MAINT_DET_TIP_R, 0) / MAINT_DET_LEVER;
    maintDetentBeak.rotation.z = MAINT_DET_BASE + MAINT_DET_SIGN * lift;
  }
}
// The DETENT on its own overhung cock. Its beak must reach the ring at
// r ≈ 5 from the barrel axis in the ring's plane — but no post can rise
// there: the great wheel's spoked disc sweeps every radius under it. So
// the cock's FOOT stands on the base plate OUTSIDE the wheel's tip
// circle, and a flat arm reaches inward OVER the wheel's top face to a
// pivot stud from which the beak hangs down into the ring's band. The
// azimuth is SOLVED by an obstacle scan (pillar-solver pattern): the
// post and the arm's sweep must clear the drum, the train, the keyless
// envelope and the setting lever's post swing.
const maintDetent = new THREE.Group();
{
  const uWindAngle = Math.atan2(uWind.y, uWind.x);
  // Pivot: just outside the winding spur's tip circle (the beak's stud
  // hangs here — nothing of the cock reaches lower than the arm at this
  // radius, so the spur's band below is never entered).
  const pivR = windSpurR + KW_MODULE + CLEAR_MARGIN + 0.4;
  // Aim SOLVED, not guessed: scan the lever's rotation for the beak tip
  // seat closest to a working bite (root + 0.35·tooth depth).
  const lever = pivR - MAINT_RING_ROOT + 1.1; // reaches past the root by a beak's engagement
  const targetR = MAINT_RING_ROOT + 0.35 * (MAINT_RING_R - MAINT_RING_ROOT);
  let bestAim = { err: Infinity, aim: Math.PI * 0.8 };
  for (let aim = Math.PI * 0.6; aim <= Math.PI * 0.98; aim += 0.005) {
    const tx = pivR + Math.cos(aim) * lever, ty = Math.sin(aim) * lever;
    const err = Math.abs(Math.hypot(tx, ty) - targetR);
    if (err < bestAim.err) bestAim = { err, aim };
  }
  MAINT_DET_BASE = bestAim.aim;
  MAINT_DET_LEVER = lever;
  const tip = { x: pivR + Math.cos(bestAim.aim) * lever, y: Math.sin(bestAim.aim) * lever };
  MAINT_DET_TIP_R = Math.hypot(tip.x, tip.y);
  MAINT_DET_TIP_AZ = Math.atan2(tip.y, tip.x);
  const tipEps = { x: pivR + Math.cos(bestAim.aim + 1e-4) * lever, y: Math.sin(bestAim.aim + 1e-4) * lever };
  MAINT_DET_SIGN = Math.sign(Math.hypot(tipEps.x, tipEps.y) - MAINT_DET_TIP_R) || 1;
  // Footing: post centre one margin + its own radius outside the great
  // wheel's tip circle (pitch + addendum), with a little slop.
  const POST_R = 0.5;
  const gwTip = barrelR_actual + TRAIN.barrel.module;
  const postR = gwTip + CLEAR_MARGIN + POST_R + 0.05;
  // Obstacle scan over the azimuth (world frame, about the barrel axis).
  // XY-conservative like the pillar solver: distance to obstacle BOXES,
  // full height — a candidate that passes here passes at any z.
  // NOT boxOf(keyless): that box swallows half the movement (the setting
  // arbor's dial-side traverse) and would veto every azimuth. The only
  // keyless parts in the cock's z-reach are the transfer wheel + arbor —
  // an analytic circle on the stem ray.
  const detObstacles = [drumGroup, centerArbor, thirdArbor, fourthArbor, escapeArbor, forkGroup];
  const transferXY = { x: uWind.x * cwDist, y: uWind.y * cwDist, r: crownWheelR + 0.7 };
  const detClearAt = (x, y) => {
    let c = plateR - 1.5 - Math.hypot(x, y); // stay well inside the plate rim
    for (const o of detObstacles) {
      const b = boxOf(o);
      const cx = clamp(x, b.min.x, b.max.x), cy = clamp(y, b.min.y, b.max.y);
      c = Math.min(c, Math.hypot(x - cx, y - cy));
    }
    c = Math.min(c, Math.hypot(x - transferXY.x, y - transferXY.y) - transferXY.r);
    for (let t = 0; t <= 1.0001; t += 0.1) { // the setting lever's post swing (base-plate arc slot)
      const p = tailPostWorldAt(t);
      c = Math.min(c, Math.hypot(x - p.x, y - p.y) - 1.2);
    }
    return c;
  };
  const ARM_HALF = 0.55; // arm half-width + a working skin
  const prefer = uWindAngle + Math.PI / 4;
  let bestAz = null;
  for (let dDeg = 0; dDeg <= 180; dDeg += 5) {
    for (const sgn of dDeg === 0 ? [1] : [1, -1]) {
      const azw = prefer + sgn * dDeg * DEG2RAD;
      const ux = Math.cos(azw), uy = Math.sin(azw);
      let c = Infinity;
      for (let r = pivR; r <= postR + POST_R; r += (postR - pivR) / 8) {
        c = Math.min(c, detClearAt(P.barrel.x + ux * r, P.barrel.y + uy * r));
      }
      if (c >= CLEAR_MARGIN + ARM_HALF) { bestAz = azw; break; }
    }
    if (bestAz !== null) break;
  }
  if (bestAz === null) {
    bestAz = prefer;
    console.warn('maintaining detent: no clear azimuth found — using the stem-line offset unchecked');
  }
  // Snap so the beak tip's WORLD azimuth lands in a tooth valley (the
  // ring sits at rotation 0 at build).
  const pitch = (Math.PI * 2) / MAINT_TEETH;
  MAINT_DETENT_AZ = Math.round((bestAz + MAINT_DET_TIP_AZ) / pitch) * pitch - MAINT_DET_TIP_AZ;
  maintDetent.position.set(P.barrel.x, P.barrel.y, 0);
  const az = new THREE.Group();
  az.rotation.z = MAINT_DETENT_AZ;
  maintDetent.add(az);
  // Arm plane: just above the ring's band (the flange above starts at
  // MAINT_FLANGE_BOT — the arm's top stays a margin under it; radially
  // the arm never comes near the flange's 2-unit reach anyway).
  const ARM_T = 0.45;
  const armBot = MAINT_RING_TOP + 0.05;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(postR - pivR + POST_R, 1.1, ARM_T), MATS.steel);
  arm.position.set((pivR + postR + POST_R) / 2, 0, armBot + ARM_T / 2);
  az.add(arm);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(POST_R, POST_R + 0.1, armBot + ARM_T, 12), MATS.steel);
  post.rotation.x = Math.PI / 2;
  post.position.set(postR, 0, (armBot + ARM_T) / 2);
  az.add(post);
  // Beak hangs from a stud under the arm's inner end, riding in the
  // ring's own z band.
  const beak = G.makeClick({ radius: lever / 0.8, thickness: MAINT_RING_T * 0.9 });
  beak.position.set(pivR, 0, MAINT_RING_BOT + MAINT_RING_T * 0.05);
  beak.rotation.z = MAINT_DET_BASE;
  az.add(beak);
  maintDetentBeak = beak;
  const studH = armBot + ARM_T - (MAINT_RING_BOT + MAINT_RING_T * 0.05);
  const stud = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, studH, 8), MATS.blueSteel);
  stud.rotation.x = Math.PI / 2;
  stud.position.set(pivR, 0, armBot + ARM_T - studH / 2);
  az.add(stud);
  movement.add(maintDetent);
  registerExplode(maintDetent, 0, 1); // base-plate furniture
  registerLabel('Maintaining detent', maintDetent);
}

// ---------------------------------------------------------------------------
// SET-UP WORK — the one ratchet a fusee movement really carries at its
// barrel, and it is STATIC: the spring's inner end grips the DRUM ARBOR
// and this ratchet + click hold the few turns of pre-tension put in at
// assembly. It never moves again in service — winding happens at the
// fusee, running spins the drum BODY around this held arbor. Because it
// is bench-only hardware, it lives DOWN on the base plate under the drum
// (marine-chronometer practice: set-up work on the lower plate, out of
// the display side), in the same one-margin band the winding spur uses —
// the great wheel's rim passes 5.2 from the drum axis but only above
// z 1.2, so the low band clears it in both axes. Closes the anchor half
// of TODO.md item 1: the drum→chain torque path now ends on a fixture
// instead of thin air. (The spiral itself is still the tension readout
// child — its morph remains representational.)
// ---------------------------------------------------------------------------
const setupWork = new THREE.Group();
{
  const SQ = 0.6 * Math.SQRT2; // across-corners = the lower staff's diameter (addLowerPivot staffR 0.6)
  setupWork.position.set(drumPos.x, drumPos.y, 0);
  const az = new THREE.Group();
  // Click and spring aimed toward the movement centre (+x in drum frame),
  // away from the plate rim where the pillars seat.
  az.rotation.z = 0;
  setupWork.add(az);
  // Square + ratchet on the arbor's LOWER end, one margin above the base
  // plate (Z_RATCHET_BOT — the winding spur's convention). No cap: the
  // ratchet is captive between the plate below and the arbor's shoulder
  // above. All STATIC — the arbor does not turn in service.
  const sqH = RATCHET_T + 0.2;
  const square = new THREE.Mesh(new THREE.BoxGeometry(SQ, SQ, sqH), MATS.steel);
  square.position.z = Z_RATCHET_BOT - 0.05 + sqH / 2;
  az.add(square);
  const ratchet = G.makeRatchetAndClick({ radius: ratchetR, teeth: 24, thickness: RATCHET_T, includeClick: false, squareBore: SQ });
  ratchet.position.z = Z_RATCHET_BOT;
  az.add(ratchet);
  // Click on its shoulder screw + curved click spring pressing the
  // beak-side flank (same solved-arc construction as ever) — the screw
  // posts stand on the BASE plate's top face now.
  const CLICK_T = RATCHET_T * 0.75;
  const clickBot = Z_RATCHET_BOT + (RATCHET_T - CLICK_T) / 2;
  const click = G.makeClick({ radius: ratchetR, thickness: CLICK_T });
  click.position.set(ratchetR * 1.28, 0, clickBot);
  click.rotation.z = Math.PI * 0.778;
  az.add(click);
  const postH = clickBot + CLICK_T;
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, postH, 10), MATS.steel);
  post.rotation.x = Math.PI / 2;
  post.position.set(ratchetR * 1.28, 0, postH / 2);
  az.add(post);
  // The click side of this assembly reaches under the GREAT WHEEL's rim
  // (the wheel's tip circle passes 5.2 from the drum axis, disc underside
  // at L_BARREL − t/2 − bevel): the screw head's thickness is derived so
  // its top stays one margin under that face.
  const gwUnder = L_BARREL - 1.4 / 2 - Math.min(1.4 * 0.18, 0.36 * 0.22);
  const headT = Math.min(0.18, gwUnder - CLEAR_MARGIN - postH);
  if (headT < 0.08) console.warn(`set-up click screw head squeezed to ${headT.toFixed(2)} under the great wheel`);
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, headT, 12), MATS.blueSteel);
  head.rotation.x = Math.PI / 2;
  head.position.set(ratchetR * 1.28, 0, postH + headT / 2);
  az.add(head);
  const springR = 1.3;
  const beta = Math.PI * 0.778;
  const flankOff = ratchetR * 0.11 * 0.7 + 0.12;
  const T = {
    x: ratchetR * 1.28 + 1.2 * Math.cos(beta) + flankOff * Math.sin(beta),
    y: 1.2 * Math.sin(beta) - flankOff * Math.cos(beta),
  };
  const A = { x: ratchetR * 1.28 + 2.2 * Math.cos(0.6), y: 2.2 * Math.sin(0.6) };
  const dx = T.x - A.x, dy = T.y - A.y, d = Math.hypot(dx, dy);
  const h = Math.sqrt(Math.max(springR * springR - (d / 2) ** 2, 0.01));
  const C = { x: (A.x + T.x) / 2 + (-dy / d) * h, y: (A.y + T.y) / 2 + (dx / d) * h };
  const thT = Math.atan2(T.y - C.y, T.x - C.x);
  let span = Math.atan2(A.y - C.y, A.x - C.x) - thT;
  if (span < 0) span += Math.PI * 2;
  const springZ = clickBot + CLICK_T / 2;
  const spring = new THREE.Mesh(new THREE.TorusGeometry(springR, 0.12, 8, 24, span), MATS.blueSteel);
  spring.position.set(C.x, C.y, springZ);
  spring.rotation.z = thT;
  az.add(spring);
  const springPost = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, springZ, 10), MATS.steel);
  springPost.rotation.x = Math.PI / 2;
  springPost.position.set(A.x, A.y, springZ / 2);
  az.add(springPost);
  const springHead = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.18, 12), MATS.blueSteel);
  springHead.rotation.x = Math.PI / 2;
  springHead.position.set(A.x, A.y, springZ + 0.09);
  az.add(springHead);
  // The spring's INNER-END ANCHOR, inside the drum: a collar on the
  // static arbor with a radial hook pin at the spiral's heart. The drum
  // body (and the readout spiral) rotate around it — the arbor holds.
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 1.2, 14), MATS.steel);
  collar.rotation.x = Math.PI / 2;
  collar.position.z = Z_DRUM;
  az.add(collar);
  const hookPin = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.4, 8), MATS.blueSteel);
  hookPin.rotation.z = Math.PI / 2; // cylinder Y-axis laid radially along +x
  hookPin.position.set(1.5 + 0.7, 0, Z_DRUM);
  az.add(hookPin);
  movement.add(setupWork);
  registerExplode(setupWork, 0, 1); // base-plate furniture now
  registerLabel('Set-up work', setupWork);
}

// The window must not eat the pivots the plate still carries. Each upper
// pivot's jewel boss has to stay clear of the cut edge by the margin.
// Factored: it re-runs after the balance-cock reveal grows the cut.
function checkCutVsPivots() {
  for (const p of tqPivots) {
    const dx = p.x - P.balance.x, dy = p.y - P.balance.y;
    const d = Math.hypot(dx, dy);
    const phi = Math.atan2(dy, dx) - TQ_CUT.aim;
    const bossR = Math.max(p.jewelR * 1.7, p.boreR);
    const edge = G.cutEdgeRadius(TQ_CUT, phi);
    const inWedge = Math.abs(Math.atan2(Math.sin(phi), Math.cos(phi))) <= TQ_CUT.phiOpen;
    if (inWedge || d - bossR - CLEAR_MARGIN < edge)
      console.warn('3/4 plate: the cut reaches a pivot it has to carry at',
        p.x.toFixed(1), p.y.toFixed(1), '— edge', edge.toFixed(2), 'vs', (d - bossR).toFixed(2));
  }
}
checkCutVsPivots();

// A jewelled pivot needs the plate opened up to its CHATON's diameter, not
// the staff's — the counterbore is cut right through and the bearing collar
// put back underneath it (see the plate build below). Unjewelled bushings
// (the barrel arbor) keep a plain bore.
const tqHoles = tqPivots.map((p) => ({
  x: p.x, y: p.y, r: p.jewelR ? chatonOuterFor(p.boreR) : p.boreR,
}));
// The three-quarter plate carries NO slot for the setting lever's tail
// post any more: with the whole reset/hack linkage on the LOW plane, the
// post tops out ~1.4 — it crosses only the BASE plate (whose arc slot,
// cut from kwPostBow, remains). One less opening in the display plate.
const tqSlots = [];

// --- Balance cock. Its jewel placement is untouched (the staff's upper pivot
// must sit exactly on the balance axis); what is new is that the cock has a
// FOOT, and the foot has to land on plate. Two things force it off the old
// fork→balance bearing: the foot must stand clear of the balance's own
// radius (its pedestal crosses the wheel's z band), and on that bearing it
// landed within a unit of the escape wheel's upper jewel. So the bearing is
// scanned for the seat with the most clearance, over the obstacles that
// actually share the pedestal's z band.
const COCK_W = 6;
const COCK_FOOT_R = COCK_W / 2;
// The staff jewel sits at the HEAD-ARC CENTRE of the slab (fraction 0.5 of
// the length from the slab centre): the head ends exactly one half-width
// past the staff — no dead nickel overhanging the bearing (the old 0.12
// left 0.38·L of slab reaching past the jewel for no structural reason).
const COCK_JEWEL_AT = 0.5;
const COCK_LEG_R = 1.3;
const BALANCE_COCK = (() => {
  const obstacles = [];
  for (const p of tqPivots) obstacles.push({ x: p.x, y: p.y, r: p.jewelR * 1.7 });
  for (const h of tqHoles) obstacles.push({ x: h.x, y: h.y, r: h.r });
  for (const s of tqSlots) obstacles.push({ ax: s.ax, ay: s.ay, bx: s.bx, by: s.by, r: s.r });
  // The escapement bridge's slab shares the cock foot's z band — its
  // pivot bosses AND the waisted BAR between them (makeEscapeBridge:
  // half-width = min(r_a, r_b)·0.8). The bar was missing from this list,
  // and the leg scan promptly stood a leg across it (inspection finding:
  // Balance cock ⇄ Fork cock, leg through the bridge bar's slab band).
  for (const n of forkCock.chain) obstacles.push({ x: n.x, y: n.y, r: n.r });
  for (let i = 0; i + 1 < forkCock.chain.length; i++) {
    const a = forkCock.chain[i], b = forkCock.chain[i + 1];
    obstacles.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y, r: Math.min(a.r, b.r) * 0.8 });
  }
  // The FULL train: the cock's pedestal spans from the base plate to the
  // slab, crossing every wheel band on the way, so each disc's whole
  // footprint is off-limits to the foot. The old hack blade's obstacle
  // incidentally blocked every inward bearing, which is why these were
  // never needed before — the first scan run without the blade promptly
  // seated the foot inside the center wheel's disc (inspection finding).
  for (const o of [barrelArbor, centerArbor, thirdArbor, fourthArbor, escapeArbor, drumGroup]) {
    const b = boxOf(o);
    obstacles.push({
      x: (b.min.x + b.max.x) / 2, y: (b.min.y + b.max.y) / 2,
      r: Math.hypot(b.max.x - b.min.x, b.max.y - b.min.y) / 2,
    });
  }
  // The stop work's crank (bracket, hanging tail, pad arm) and BOTH rods'
  // low corridors run in the band between the plate's top face and the
  // cock's underside — the pedestal's band exactly. The crank hinges
  // about its RADIAL axis, so it sweeps TANGENTIALLY: cover the pivot
  // hardware, the tail's swept segment, and the pad arm's diagonal at
  // both stroke ends (the arm's own plane swings furthest — it hangs
  // deepest below the hinge).
  // Pivot hardware = the bracket's own footprint about the pivot: the post
  // stands STOP_BR_Y off the hinge on the swing-away side and the cheeks run
  // out to it, so the covering disc is that reach plus the post's taper.
  obstacles.push({ x: STOP_PIVOT.x, y: STOP_PIVOT.y,
    r: Math.max(2.2, STOP_BR_Y + STOP_POST_RB + CLEAR_MARGIN) });
  {
    const swTail = -STOP_TAIL_H * Math.sin(STOP_PSI0); // signed tangential sweep at the tail's low end
    obstacles.push({
      ax: STOP_PIVOT.x, ay: STOP_PIVOT.y,
      bx: STOP_PIVOT.x + STOP_T_HAT.x * swTail, by: STOP_PIVOT.y + STOP_T_HAT.y * swTail,
      r: 1.2,
    });
    for (const psi of [0, STOP_PSI0]) {
      const py = STOP_PAD_Y * Math.cos(psi) - PAD_ARM_LOCAL_Z * Math.sin(psi);
      obstacles.push({
        ax: STOP_PIVOT.x, ay: STOP_PIVOT.y,
        bx: STOP_PIVOT.x + STOP_R_HAT.x * STOP_PAD_X + STOP_T_HAT.x * py,
        by: STOP_PIVOT.y + STOP_R_HAT.y * STOP_PAD_X + STOP_T_HAT.y * py,
        r: STOP_ARM_W / 2 + 0.4,
      });
    }
  }
  // Both rods were built BEFORE the cock exists, so their elbow scans
  // could not see its legs — the cock's seat must yield to the linkage
  // instead: the shared swept-corridor list (rods, post arc, hammer arm).
  for (const o of LOW_LINKAGE_OBSTACLES) obstacles.push(o);
  const distTo = (o, x, y) => {
    if (o.ax === undefined) return Math.hypot(x - o.x, y - o.y) - o.r;
    const vx = o.bx - o.ax, vy = o.by - o.ay;
    const L2 = vx * vx + vy * vy || 1e-9;
    const t = clamp(((x - o.ax) * vx + (y - o.ay) * vy) / L2, 0, 1);
    return Math.hypot(x - o.ax - t * vx, y - o.ay - t * vy) - o.r;
  };
  let best = null;
  for (let d = -180; d < 180; d += 1) {
    const phi = d * DEG2RAD;
    const cs = Math.cos(TQ_CUT.aim + phi), sn = Math.sin(TQ_CUT.aim + phi);
    // Everything below is tested WHERE THE BUILD PUTS IT: the built slab
    // is sized to the cut edge (staff→tail = cutEdge − 0.1, see
    // balanceCockLen), so the bar sits at cutEdge − 1.3. The old scan
    // modelled a phantom foot disc at dFoot = cutEdge + 3.15 instead —
    // ~3 units outboard of the real legs — and happily seated a leg
    // straight through the stop bracket's mast while rejecting honest
    // seats whose phantom foot grazed something that isn't there.
    const dFoot = Math.max(BAL_OUTER_R, G.cutEdgeRadius(TQ_CUT, phi)) + COCK_FOOT_R + CLEAR_MARGIN;
    const dTail = G.cutEdgeRadius(TQ_CUT, phi) - 0.1; // built slab-tail reach
    let clr = plateR - CLEAR_MARGIN
      - (Math.hypot(P.balance.x + cs * dTail, P.balance.y + sn * dTail) + COCK_W / 2); // slab stays on the plate
    // The T-foot's two LEG PADS must clear the obstacle set. Their
    // half-span is φ-dependent (it is solved from the balance's swept
    // radius at the bar's distance — see the build below): test both pads
    // at this candidate bearing, not just the slab tail.
    const dyLeg = dTail - 1.2;
    const legBound = BAL_OUTER_R + COCK_LEG_R + CLEAR_MARGIN;
    const hspan = Math.max(3.5, Math.sqrt(Math.max(legBound * legBound - dyLeg * dyLeg, 0)));
    const padR = COCK_LEG_R * 1.5;
    for (const s of [-1, 1]) {
      const lx = P.balance.x + cs * dyLeg - sn * s * hspan;
      const ly = P.balance.y + sn * dyLeg + cs * s * hspan;
      clr = Math.min(clr, plateR - CLEAR_MARGIN - (Math.hypot(lx, ly) + padR));
      for (const o of obstacles) clr = Math.min(clr, distTo(o, lx, ly) - padR);
    }
    // The SLAB and T-BAR ride in the plate band (z ≈ COCK_MID_Z ± T/2),
    // above the pedestal obstacles — but the stop work's MAST + hanging
    // tail stand in the cut wedge and cross that band on the way to the
    // raised hinge. Effective mast radius at the slab band = the largest
    // of the post's taper, the clevis half-span, and the tail's tangential
    // sweep reach there (|z_band − pivot|·|sinψ0| + tail half-width).
    {
      const mastR = Math.max(STOP_POST_RB, STOP_CHEEK_X + STOP_CHEEK_T / 2,
        Math.abs(COCK_MID_Z + COCK_T / 2 - Z_STOP_PIVOT) * Math.abs(Math.sin(STOP_PSI0)) + STOP_TAIL_W / 2);
      // The mast is no longer a column ON the pivot: the bracket's post
      // stands STOP_BR_Y off it, on the tangential swing-away side, with the
      // cheeks spanning between. Model it as that SEGMENT, so the cock's seat
      // scan sees the bracket where it actually is instead of a phantom disc.
      const mast = { ax: STOP_PIVOT.x, ay: STOP_PIVOT.y,
        bx: STOP_PIVOT.x + STOP_T_HAT.x * STOP_BR_SIDE * STOP_BR_Y,
        by: STOP_PIVOT.y + STOP_T_HAT.y * STOP_BR_SIDE * STOP_BR_Y, r: mastR };
      // Centreline distance segment ⇄ segment: the smallest of the four
      // endpoint-to-segment distances (exact while they do not cross, and a
      // crossing is already far inside the radii subtracted below).
      const segSeg = (o) => Math.min(
        distTo(o, mast.ax, mast.ay) + o.r, distTo(o, mast.bx, mast.by) + o.r,
        distTo(mast, o.ax, o.ay) + mastR, distTo(mast, o.bx, o.by) + mastR);
      const tailD = dyLeg + 1.2;
      const slab = { ax: P.balance.x, ay: P.balance.y,
        bx: P.balance.x + cs * tailD, by: P.balance.y + sn * tailD, r: 0 };
      const bar = { ax: P.balance.x + cs * dyLeg - sn * hspan, ay: P.balance.y + sn * dyLeg + cs * hspan,
        bx: P.balance.x + cs * dyLeg + sn * hspan, by: P.balance.y + sn * dyLeg - cs * hspan, r: 0 };
      clr = Math.min(clr, segSeg(slab) - COCK_W / 2 - mastR);
      clr = Math.min(clr, segSeg(bar) - 1.2 - COCK_LEG_R - mastR);
    }
    if (clr < CLEAR_MARGIN) continue;
    if (!best || clr > best.clr) best = { phi, dFoot, clr };
  }
  if (!best) {
    console.warn('balance cock: no clear seat on the plate; falling back to the old fork bearing');
    const phi = Math.atan2(P.fork.y - P.balance.y, P.fork.x - P.balance.x) - TQ_CUT.aim;
    const dFoot = BAL_OUTER_R + COCK_FOOT_R + CLEAR_MARGIN;
    best = { phi, dFoot, clr: 0 };
  }
  // makeCock: jewel at +COCK_JEWEL_AT·L, foot centre at −0.5·L → the
  // staff→tail distance is (0.5 + COCK_JEWEL_AT)·L.
  return { ...best, length: best.dFoot / (0.5 + COCK_JEWEL_AT) };
})();
// COCK IN THE PLATE BAND, standing on the BASE plate. The slab occupies
// the plate's own z-band over the cutaway; its LENGTH is sized against the
// cut edge as first solved (tail to 0.1 inside it), and once the cock is
// BUILT the cut is re-solved around it — the bridge-reveal pass after the
// cock build — so the finished plate edge retreats a full cut margin past
// every part of the bridge. From the back: the cock's top face is flush
// with the plate's — the Glashütte look — but it stands in open air on
// its own base-plate legs, independent of the three-quarter plate.
const cockEdgeR = G.cutEdgeRadius(TQ_CUT, BALANCE_COCK.phi);
// Slab tail reach ((0.5 + COCK_JEWEL_AT)·L below the jewel), sized to the
// pre-reveal cut edge.
const balanceCockLen = (cockEdgeR - 0.1) / (0.5 + COCK_JEWEL_AT);
const balanceCock = G.makeCock({
  length: balanceCockLen, width: COCK_W, thickness: COCK_T, jewelAt: COCK_JEWEL_AT,
});
{
  // Local +Y runs foot → jewel, i.e. opposite the solved foot bearing.
  const toJewel = TQ_CUT.aim + BALANCE_COCK.phi + Math.PI;
  balanceCock.rotation.z = toJewel - Math.PI / 2;
  // Position the cock so its sunk JEWEL (at local (0, length·COCK_JEWEL_AT))
  // lands exactly on the balance-staff axis — the staff's upper pivot must be
  // set in the cock's jewel, not beside it. With the jewel at the head-arc
  // centre, the round head ends one half-width past the staff and nothing
  // overhangs the bearing.
  const jy = balanceCockLen * COCK_JEWEL_AT;
  const cs = Math.cos(balanceCock.rotation.z), sn = Math.sin(balanceCock.rotation.z);
  balanceCock.position.set(P.balance.x + jy * sn, P.balance.y - jy * cs, COCK_MID_Z);
  // BRIDGE FOOT to the BASE plate. The cock used to be plate furniture —
  // a step web and tail plate lying on the three-quarter plate's top
  // face. It is escapement furniture now: a turned leg drops from under
  // the slab's tail, INSIDE the cutaway, all the way to the base plate,
  // so the three-quarter plate lifts off without touching any of it.
  // (The slab still nests level with the plate band for the flush
  // Glashütte look — the mounting changed, not the face.)
  // ...and the foot is a T: a crossbar fans out from the slab tail, flush
  // in the same z-band, with a leg at EACH end — two feet splayed wide
  // apart instead of one under the tail. A cock is cantilevered from one
  // screw; a bridge is held at two — this is the "structure it like a
  // bridge" stability move, done at the only end with open floor (the head
  // end overhangs the fork and the spring; no leg can land there).
  const yTail = -balanceCockLen / 2;                 // slab's tail end
  const LEG_R = COCK_LEG_R;
  const yBar = yTail + 1.2;                          // crossbar centreline
  // Crossbar half-span SOLVED, not styled: each leg's centre must stand
  // one margin plus its own radius off the balance's MEASURED swept
  // radius (BAL_OUTER_R — the timing-screw tips are what sweep furthest).
  // The old fixed 5.5 put the legs' inner edges 0.34 INSIDE the screw
  // sweep; being an intended-contact pair (staff in the cock jewel), the
  // overlap sweep could never flag it.
  const dyLegBuild = (jy - yBar);                    // staff → bar, cock-local
  const legBound = BAL_OUTER_R + LEG_R + CLEAR_MARGIN;
  const BAR_HSPAN = Math.max(3.5, Math.sqrt(Math.max(legBound * legBound - dyLegBuild * dyLegBuild, 0)));
  if (Math.hypot(BAR_HSPAN, dyLegBuild) < legBound - 1e-6)
    console.warn('balance cock: T-foot legs inside the balance sweep',
      Math.hypot(BAR_HSPAN, dyLegBuild).toFixed(2), '<', legBound.toFixed(2));
  const bar = new THREE.Mesh(
    new THREE.BoxGeometry(BAR_HSPAN * 2 + LEG_R * 2, 2.4, COCK_T), MATS.nickel);
  bar.position.set(0, yBar, 0);
  balanceCock.add(bar);
  const legTopWorld = COCK_MID_Z - COCK_T / 2;       // slab underside
  const legLen = legTopWorld - PLATE_TOP;
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(LEG_R, LEG_R * 1.15, legLen, 20), MATS.nickel);
    leg.rotation.x = Math.PI / 2;
    leg.position.set(s * BAR_HSPAN, yBar, -COCK_T / 2 - legLen / 2);
    balanceCock.add(leg);
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(LEG_R * 1.5, LEG_R * 1.5, 0.4, 20), MATS.nickel);
    pad.rotation.x = Math.PI / 2;
    pad.position.set(s * BAR_HSPAN, yBar, -COCK_T / 2 - legLen + 0.2);
    balanceCock.add(pad);
    const screw = new THREE.Mesh(
      new THREE.CylinderGeometry(COCK_FOOT_R * 0.45, COCK_FOOT_R * 0.45, 0.22, 14), MATS.blueSteel);
    screw.rotation.x = Math.PI / 2;
    screw.position.set(s * BAR_HSPAN, yBar, COCK_T / 2 + 0.11);
    balanceCock.add(screw);
  }

  // ------------------------------------------------------------------
  // FIXED OUTER TERMINAL — free-sprung dress. Everything below is
  // cock-local: origin at the slab centre, +Y toward the jewel/staff,
  // top face at +COCK_T/2 (flush with the plate).
  // ------------------------------------------------------------------
  const jyStaff = balanceCockLen * COCK_JEWEL_AT; // staff axis in cock-local y
  const hsUD = hairspring.userData;

  // Re-anchor the SPRING so its terminal end lands 0.9 rad off the cock
  // axis, over the OPEN cutaway — the stud that clamps it hangs from a
  // cantilevered carrier arm there, in plain view beside the cock, not
  // buried under the slab. Free-sprung: the terminal runs uninterrupted
  // from the spiral's outer end to the stud.
  hairspringGroup.rotation.z = toJewel + 0.9 - hsUD.endAngle;

  // Small ring builder (extrude spans local z 0..h) for the concentric
  // collars below — CylinderGeometry has no bore, and the staff pokes 0.5
  // proud of the cock face right where a solid collar would sit.
  const ringMesh = (rIn, rOut, h, mat) => {
    const rs = new THREE.Shape();
    rs.absarc(0, 0, rOut, 0, Math.PI * 2, false);
    const rh = new THREE.Path();
    rh.absarc(0, 0, rIn, 0, Math.PI * 2, true);
    rs.holes.push(rh);
    return new THREE.Mesh(
      new THREE.ExtrudeGeometry(rs, { depth: h, bevelEnabled: false, curveSegments: 32 }), mat);
  };

  // SHOCK SETTING on the staff: the upper pivot runs in the cock's flush
  // hole jewel, and its tip (0.5 proud of the face) is capped by an
  // endstone held down by a gold lyre spring — the classic anti-shock
  // stack, and the reason the tip may stop here instead of spiking on.
  {
    const shock = new THREE.Group();
    shock.name = 'shockSetting';
    shock.position.set(0, jyStaff, COCK_T / 2);
    const boss = ringMesh(0.85, 1.35, 0.55, MATS.steel);
    boss.position.z = 0.12;
    shock.add(boss);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.18, 24), MATS.ruby);
    cap.rotation.x = Math.PI / 2;
    cap.position.z = 0.12 + 0.55 + 0.09; // staff tip at 0.5 → 0.17 endshake under the stone
    shock.add(cap);
    const lyre = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.07, 8, 28, 4.6), MATS.gold);
    lyre.position.z = 0.12 + 0.55 + 0.2;
    lyre.rotation.z = -Math.PI / 2 - 2.3; // gap centred toward the tail
    shock.add(lyre);
    balanceCock.add(shock);
  }

  // STUD CARRIER: the spring's outer end belongs to a fixture on the
  // cock, not to bare plate. A concentric ring around the shock setting
  // cantilevers an arm out over the open cutaway (0.9 rad off the cock
  // axis); at the terminal-end radius its stud drops to the spring plane
  // and clamps the terminal, pinned from the side — the whole attachment
  // visible from the back. On a free-sprung balance this is the spring's
  // ONLY fixture: no index, no curb pins.
  const studWorldZ = L_HAIRSPRING + hsUD.termEndZ;   // terminal end height
  {
    const carrier = new THREE.Group();
    carrier.name = 'studCarrier';
    carrier.position.set(0, jyStaff, COCK_T / 2);
    carrier.rotation.z = 0.9;
    const ring = ringMesh(2.55, 2.95, 0.22, MATS.steel); // outer trimmed inside the head's half-width (3.0)
    ring.position.z = 0.02;
    carrier.add(ring);
    const yS = hsUD.termEndR;                        // carrier-local stud centre
    const armC = new THREE.Mesh(new THREE.BoxGeometry(0.8, yS - 2.85, 0.22), MATS.steel);
    armC.position.set(0, (2.85 + yS) / 2, 0.13);
    carrier.add(armC);
    const boss = ringMesh(0.42, 1.0, 0.26, MATS.steel);
    boss.position.set(0, yS, 0.01);
    carrier.add(boss);
    const postBot = (studWorldZ - 0.25) - (COCK_MID_Z + COCK_T / 2); // cock-face-local
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.65, 0.27 - postBot), MATS.steel);
    post.name = 'hairspringStud';
    post.position.set(0, yS, (0.27 + postBot) / 2);
    carrier.add(post);
    const pinScrew = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.5, 10), MATS.blueSteel);
    pinScrew.rotation.z = Math.PI / 2;               // side pin, headed at +x
    pinScrew.position.set(0.85, yS, 0.13);
    carrier.add(pinScrew);
    balanceCock.add(carrier);
  }

  // FREE-SPRUNG: there is deliberately NO regulator. The index arm, curb
  // pins, swan neck and adjuster that used to dress this face are gone —
  // the spring's effective length is fixed (outer terminal clamped in the
  // stud, nothing straddling the curve), and the rate is adjusted at the
  // BALANCE instead, by its timing screws. The cock face carries only what
  // a free-sprung watch carries: the shock setting over the pivot and the
  // stud carrier holding the spring's terminal.
}
movement.add(balanceCock);
registerExplode(balanceCock, COCK_MID_Z, 9);
registerLabel('Balance cock', balanceCock);

// --- REVEAL THE BRIDGE: second pass over the plate cut. TQ_CUT was solved
// before the cock existed, so the cock never voted — its slab was fitted
// to the edge by a single-bearing radial rule while its width-6 flanks and
// the T-bar spanned unchecked, and (cock and plate being flush in one
// z-band) the plate's material ran right up against and into the bridge.
// Now that the cock is BUILT, every mesh of it that actually crosses the
// plate's band votes the raw cut table outward by the cut margin, and the
// table is re-finished ONCE — the plate's kidney edge retreats around the
// whole bridge and the cock stands revealed in open air.
{
  const eps = 0.05;
  const v = new THREE.Vector3();
  balanceCock.updateMatrixWorld(true);
  balanceCock.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    // Per-MESH band filter (not per-vertex: the slab's faces sit exactly ON
    // the band edges, and the stud-carrier post CROSSES the band with both
    // its box corners outside it): a mesh votes iff its world AABB comes
    // within CLEAR_MARGIN of the plate's z-band — the same margin the
    // cock⇄plate clearance budget enforces. The band is INFLATED by that
    // margin because, with the slab flush in the band, the T-foot legs end
    // exactly AT the plate's floor plane (and the above-face dress starts
    // at its top plane): a mesh kissing the band edge gets zero vertical
    // separation, so its whole XY outline needs the cut margin too. Parts
    // more than a margin outside the band (leg pads down at the base
    // plate) still don't vote, so the cut doesn't over-open for them.
    o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    if (!(bb.min.z < TQ_TOP_Z + CLEAR_MARGIN - eps && bb.max.z > TQ_BOT_Z - CLEAR_MARGIN + eps)) return;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      const dx = v.x - P.balance.x, dy = v.y - P.balance.y;
      const r = Math.hypot(dx, dy) + TQ_CUT_MARGIN;
      const deg = Math.round(((Math.atan2(dy, dx) - TQ_CUT.aim) * 180) / Math.PI);
      const idx = ((deg % 360) + 360) % 360;
      if (r > TQ_CUT.rawRadii[idx]) TQ_CUT.rawRadii[idx] = r;
    }
  });
  TQ_CUT.radii = finishCutRadii(TQ_CUT.rawRadii);
  // A cut-edge point pushed past the plate's rim would self-intersect the
  // plate outline (the documented slot-notch failure class in
  // makeThreeQuarterPlate) — clamp each degree so the edge stays inside,
  // and say so if it ever engages.
  for (let i = 0; i < 360; i++) {
    const a = TQ_CUT.aim + i * DEG2RAD;
    const dxr = Math.cos(a), dyr = Math.sin(a);
    // Exact bound: |C + r·d̂| = plateR − 0.2, positive root.
    const cd = TQ_CUT.x * dxr + TQ_CUT.y * dyr;
    const disc = cd * cd - (TQ_CUT.x ** 2 + TQ_CUT.y ** 2) + (plateR - 0.2) ** 2;
    const rMax = -cd + Math.sqrt(Math.max(disc, 0));
    if (TQ_CUT.radii[i] > rMax) {
      TQ_CUT.radii[i] = rMax;
      console.warn('balance-cock reveal: cut edge clamped at the plate rim, bearing', i);
    }
  }
  // The grown opening must still carry every upper pivot.
  checkCutVsPivots();
}

// --- The plate itself.
const threeQuarterPlate = new THREE.Group();
{
  const mesh = G.makeThreeQuarterPlate({
    radius: plateR, thickness: TQ_T, cut: TQ_CUT, holes: tqHoles, slots: tqSlots,
  });
  mesh.name = 'threeQuarterPlate'; // structural node — see checkSupportGeometry
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  threeQuarterPlate.add(mesh);
  // Screwed gold chatons, set into real counterbores. tqHoles opened each
  // pivot right through at the counterbore diameter, so the BEARING COLLAR —
  // the full-thickness ring of plate the staff actually runs in — is put
  // back here, under the counterbore's floor. That collar is what makes the
  // step visible: plate face, chaton dropped into its recess, then the plate
  // stepping in to the bore below.
  //
  // Nothing here may stand proud of the plate's top face: the reset and
  // hack rods run just above it, and a chaton perched on the surface would
  // be straight through them.
  for (const p of tqPivots) {
    if (!p.jewelR) continue; // plain bushing (the barrel arbor)
    const collar = new THREE.Mesh(
      ringGeo(p.boreR, chatonOuterFor(p.boreR) + 0.15, TQ_T - CHATON_DEPTH),
      MATS.nickel);
    collar.position.set(p.x, p.y, -TQ_T / 2 + (TQ_T - CHATON_DEPTH) / 2);
    threeQuarterPlate.add(collar);
    // Rubbed-in jewel: the ruby FILLS its counterbore, top face flush with
    // the plate. The screwed-gold-chaton version read as a stone sunk at the
    // bottom of a gold well — unavoidably, because the plate is thin and
    // nothing here may stand proud of it (the rods run just above this
    // face), so the gold rim had to rise around the stone rather than the
    // stone sitting up in the rim. Filling the recess reads as pressed-in,
    // and a jewel set directly into the plate is the older, simpler bearing
    // anyway — what this movement used before chatons were introduced.
    const jewel = new THREE.Mesh(
      jewelFaceGeo(p.boreR, chatonOuterFor(p.boreR), CHATON_DEPTH), MATS.ruby);
    jewel.position.set(p.x, p.y, TQ_T / 2 - CHATON_DEPTH / 2);
    threeQuarterPlate.add(jewel);
  }
}
threeQuarterPlate.position.set(0, 0, TQ_MID_Z);
movement.add(threeQuarterPlate);
registerExplode(threeQuarterPlate, TQ_MID_Z, 8);
registerLabel('Three-quarter plate', threeQuarterPlate);

// --- Pillars. They used to rise to z ≈ 19.9 holding nothing at all; they now
// do the job pillars exist for — they carry the upper plate. Height is the
// plate's underside, and the seating angles are scanned so all four land on
// material (the old fixed 45/135/225/315 put one of them squarely under the
// balance cut).
{
  const pillarR = plateR - 8;
  const inCutClearance = (x, y) => {
    const d = Math.hypot(x - TQ_CUT.x, y - TQ_CUT.y);
    let phi = Math.atan2(y - TQ_CUT.y, x - TQ_CUT.x) - TQ_CUT.aim;
    phi = Math.atan2(Math.sin(phi), Math.cos(phi));
    const radial = d - G.cutEdgeRadius(TQ_CUT, phi);
    if (Math.abs(phi) <= TQ_CUT.phiOpen) return -Math.abs(radial) - 1; // inside the open wedge
    return Math.min(radial, d * Math.sin(Math.abs(phi) - TQ_CUT.phiOpen));
  };
  const capR = TQ_BOT_Z * 0.09 * 1.5; // makePillar's widest land
  // The stop work's BRACKET lives in the plate cut's open wedge (where
  // inCutClearance already forbids seats), but the low reset/hack linkage
  // does NOT: both elbow rods, the setting-lever tail post's swing arc and
  // the hammer arm cross the movement at z ≈ 0.15–1.9, and a pillar is a
  // full-height column. The post's arc used to be covered indirectly by
  // tqSlots; the low corridor emptied tqSlots (the post no longer pierces
  // the 3/4 plate), which silently dropped that cover — so the pillars
  // take the shared swept-corridor list directly.
  const seatClearance = (x, y) => {
    let c = Math.min(inCutClearance(x, y), plateR - Math.hypot(x, y));
    for (const h of tqHoles) c = Math.min(c, Math.hypot(x - h.x, y - h.y) - h.r);
    const stadium = (s) => {
      const vx = s.bx - s.ax, vy = s.by - s.ay, L2 = vx * vx + vy * vy || 1e-9;
      const t = clamp(((x - s.ax) * vx + (y - s.ay) * vy) / L2, 0, 1);
      return Math.hypot(x - s.ax - t * vx, y - s.ay - t * vy) - s.r;
    };
    for (const s of tqSlots) c = Math.min(c, stadium(s));
    for (const o of LOW_LINKAGE_OBSTACLES)
      c = Math.min(c, o.ax === undefined ? Math.hypot(x - o.x, y - o.y) - o.r : stadium(o));
    // ...and it must not foul what is UNDER the plate either: the pillar runs
    // the full height of the movement, past the whole train.
    for (const o of [barrelArbor, centerArbor, thirdArbor, fourthArbor, escapeArbor, forkGroup, drumGroup, keyless, forkCock.obj, maintDetent, setupWork]) {
      const b = boxOf(o);
      const cx = clamp(x, b.min.x, b.max.x), cy = clamp(y, b.min.y, b.max.y);
      c = Math.min(c, Math.hypot(x - cx, y - cy));
    }
    return c - capR;
  };
  // Each pillar is placed independently — one ring of four at a fixed radius
  // and a shared offset cannot clear the barrel opening AND the balance cut
  // AND the keyless corner at once (best such ring fouled something by 1.8).
  // Each seat is the point nearest its quadrant's ideal that actually holds.
  // One labelled group for all four: as a bare structure node the pillars
  // were invisible to the overlap sweep (only checkSupportGeometry could
  // see them, and only along declared edges) — as a unit, every pair
  // against them is swept like anything else. The label matches the
  // structure-node name so the graph's support edges resolve to the same
  // meshes either way.
  const pillarsGroup = new THREE.Group();
  movement.add(pillarsGroup);
  registerLabel('pillars', pillarsGroup);
  for (const base of [45, 135, 225, 315]) {
    let best = null;
    for (let dA = 0; dA <= 60; dA += 1) {
      for (const sgn of dA === 0 ? [1] : [1, -1]) {
        const a = (base + sgn * dA) * DEG2RAD;
        for (let r = plateR - 4; r >= plateR - 16; r -= 0.5) {
          const x = Math.cos(a) * r, y = Math.sin(a) * r;
          const c = seatClearance(x, y);
          if (c >= CLEAR_MARGIN && (!best || c > best.c + 0.5)) best = { x, y, c, dA };
        }
      }
      if (best) break; // nearest feasible bearing to the quadrant's ideal wins
    }
    if (!best) { console.warn('pillar: no seat found near', base); continue; }
    const pillar = G.makePillar({ height: TQ_BOT_Z });
    pillar.name = 'pillar'; // structural node — see checkSupportGeometry
    pillar.position.set(best.x, best.y, TQ_BOT_Z / 2);
    pillarsGroup.add(pillar);
  }
}

// (The power-reserve reduction train is built after the dial side below — its
// output arbor must be coaxial with the reserve sub-dial pivot, whose
// position depends on the dial's dimensions.)

// ---------------------------------------------------------------------------
// Dial side (front, opposite z from the back plate) — driven by the same
// kinematics as the train (center-wheel / fourth-wheel angle functions).
// ---------------------------------------------------------------------------
const dialGroup = new THREE.Group();
// (Z_DIAL is declared with the Z-stack constants at the top of the file.)
dialGroup.position.set(P.dial.x, P.dial.y, Z_DIAL);
movement.add(dialGroup);
registerExplode(dialGroup, Z_DIAL, 1, -1);
registerLabel('Dial', dialGroup);

// Dial feet — the dial otherwise just sits at (P.dial, Z_DIAL) with nothing
// visibly connecting it to the rest of the movement (the 4 structural
// pillars span the OPPOSITE direction, back plate to cocks, and never reach
// anywhere near Z_DIAL). Three short posts from the dial's back to the back
// plate, positioned near the outer rim — clear of the going train, keyless
// works, and reserve train, which all live at smaller radii in this same
// plate→dial gap — same fix, same reasoning as the keyless-works motion-
// works arbor and the reserve arbor extension: a part that LOOKS correctly
// placed but has nothing actually anchoring it there is exactly the failure
// mode this whole inspection system exists to catch.
{
  const footR = plateR * 0.88;
  const footLen = backPlate.position.z - Z_DIAL; // reach from the dial's plane to the back plate
  // 130° moved to 108°: the keyless works lives in this same plate→dial gap
  // now, and the old 130° foot landed ~2.5 from the folded minute wheel's
  // axis (wheel radius 4.5) — squarely inside its disc. 108° keeps the foot
  // ≥ ~15 from every keyless part, the setting traverse and the reserve
  // train while staying near the rim.
  for (const deg of [10, 108, 250]) {
    const a = deg * DEG2RAD;
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, footLen, 10), MATS.steel);
    foot.rotation.x = Math.PI / 2;
    foot.position.set(Math.cos(a) * footR, Math.sin(a) * footR, footLen / 2);
    dialGroup.add(foot);
  }
}

// Everything on the dial side is built assuming a viewer on the mesh's
// natural +Z side (the convention makeDial/makeHand are authored against).
// Flipping this whole sub-assembly 180° about Y turns its front to face -Z
// (the actual front of the watch) while keeping "up" as world +Y — a proper
// rotation, so numerals/hands stay upright and non-mirrored for a viewer
// standing further out on the -Z side (see Dial camera preset).
const dialFace = new THREE.Group();
dialFace.rotation.y = Math.PI;
dialGroup.add(dialFace);

// dialRadius / RESERVE_LOCAL / SECONDS_LOCAL / subDialR — solved in
// solveKeyless (layout.js, §13 step 3b) with the plate radius they hang
// off; destructured at the frame solve up top. The constraint comments
// (sub-dial symmetry, the §25 C well-radius cap) moved with the
// expressions. Consumed here by the dial build:
const reserveR = subDialR;
const secondsSubR = subDialR;
// --- Alarm period + reading resolution (BUILT §24) -------------------------
// The alarm wraps on the SAME 12-hour period as the dial and formatTime (a
// 12-hour dial carries no AM/PM, so a 24-hour alarm can't be set unambiguously
// from it). The friction-set disc is CONTINUOUS, but it is READ to the nearest
// quarter mark on the ring: 15-minute steps over the 12 h period → 48 marks.
// ALARM_MARK_STEPS derives from that, it is not a chosen count. (Hoisted with
// DIAL_PERIOD_S, which formatTime below also uses.)
const DIAL_PERIOD_S = 12 * 3600;                          // 12-hour dial period, shared with formatTime
const ALARM_STEP_SECONDS = 15 * 60;                       // reading resolution: quarter-hour marks
const ALARM_MARK_STEPS = DIAL_PERIOD_S / ALARM_STEP_SECONDS; // = 48 marks over 12 h
const ALARM_MARK_PITCH = (Math.PI * 2) / ALARM_MARK_STEPS;   // radians per mark
// Alarm barrel + strike cadence (BUILT §24, re-derived by §25). The alarm is
// spring-powered like the going train: a dedicated alarm barrel
// (alarmBarrelWind, in turns) drains while it rings, one strike every
// ALARM_STRIKE_GAP, and the ring STOPS when the barrel runs down — not on a
// fixed count (Rule 2: the hammer draws its motion from the spring, it is not
// scripted). Only the two quantities the GONG fixes live here; §25 built the
// striking train that connects them, so the barrel's capacity
// (ALARM_BARREL_TURNS) and the ring's length (ALARM_RING_SECONDS) are now
// derived from that train's tooth counts and pin count — see the "Alarm
// striking works" block down at the geometry.
const ALARM_STRIKE_GAP = 0.42;   // s between strikes (the bell cadence)
const ALARM_STRIKE_AMP = 0.09;   // rad — swings the head from its 0.4 rest gap onto the wire (a hair of overlap = a tap)
// --- Alarm sub-dial placement (BUILT §24) ----------------------------------
// The alarm disc joins the sub-dial family. 12 o'clock is the reserve and
// 6 o'clock the small seconds (both on the vertical axis), so the free slots
// are the horizontal ones, dial-local 3 and 9 o'clock. Its second crown must
// exit the case rim CLEAR of the winding crown; the winding stem lies along
// uWind (world), and the dialFace Y-flip mirrors world x, so its dial-local
// bearing is atan2(uWind.y, −uWind.x). The side is chosen the way §1's JMP_AZ
// picks a bearing — score each candidate by angular clearance from that stem
// and take the clearer — rather than eyeballed.
// (ALARM_CD ≡ RESERVE_LOCAL.y by definition since §13 step 3b — both read
// solveKeyless's one output, so the old hoist-drift assert is retired.)
const _alarmWindBearing = Math.atan2(uWind.y, -uWind.x); // winding stem, dial-local frame
const ALARM_LOCAL_AZ = (() => {
  const angDist = (a) => Math.abs(((a - _alarmWindBearing + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI);
  let best = null;
  for (const a of [0, Math.PI]) { // dial-local 3 o'clock, 9 o'clock
    const s = angDist(a);
    if (!best || s > best.s) best = { a, s };
  }
  return best.a;
})();
const ALARM_LOCAL = { x: Math.cos(ALARM_LOCAL_AZ) * ALARM_CD, y: Math.sin(ALARM_LOCAL_AZ) * ALARM_CD };
// Radius: the largest well leaving a comfortable band of dial to each
// neighbour well. Two silvered recesses closer than a couple mm read as one
// blurred cut, so the gap is set well above the single CLEAR_MARGIN. A
// neighbour sits on the perpendicular axis at centre-distance RESERVE_LOCAL.y,
// so the centre-to-centre span is hypot(ALARM_CD, RESERVE_LOCAL.y).
// (§24's alarm sub-dial WELL is gone — §25 C's rattrapante hand lives at the
// dial CENTRE, so the dial face heals over the old 3-o'clock recess. ALARM_CD /
// ALARM_LOCAL survive: they still place the crown, its stem and the setting
// arbor, which the future az-0 train taps.)
// Sub-dials are recessed WELLS sunk into the dial (hole + wall + painted
// floor, all built by makeDial); the hands ride inside the well, below the
// dial surface. In dial-local coordinates the well floor is at
// −SUBDIAL_RECESS and the hands at −(SUBDIAL_RECESS − 0.3).
const SUBDIAL_RECESS = 0.5;
// Motion-works constants the DIAL needs (its centre bore must clear the
// hour-wheel tube). Declared here rather than with the rest of the motion
// works further down, which is built after the dial.
// (cannonPinionTeeth / MW_MODULE_1 are hoisted to the top of the file with
// the layout constants — the keyless works' setting arbor needs them.)
const HOUR_TUBE_INNER = (MW_MODULE_1 * cannonPinionTeeth) / 2 + MW_MODULE_1 + 0.25;
const HOUR_TUBE_OUTER = HOUR_TUBE_INNER + 0.45;
// §25 C rattrapante centre stack: the alarm hand rides its OWN tube around the
// hour-wheel tube — third member of the co-axial stack (cannon pinion → hour
// tube → alarm tube), the way a real central-alarm watch carries its pointer.
// 0.1 running clearance on the hour tube (its bearing), 0.4 wall.
const ALARM_TUBE_INNER = HOUR_TUBE_OUTER + 0.1;
const ALARM_TUBE_OUTER = ALARM_TUBE_INNER + 0.4;

const dial = G.makeDial({
  radius: dialRadius,
  subdialRecess: SUBDIAL_RECESS,
  centerBoreR: ALARM_TUBE_OUTER + 0.2, // the co-axial stack's OUTERMOST member (the §25 C alarm tube) passes with running clearance
  subdials: [
    // face: the dial's own tone at this radius (its radial gradient
    // evaluated at ±0.39R) so BOTH wells blend in rather than reading as
    // separate darker instruments — the two sit symmetric about the centre,
    // so they share the same gradient tone.
    { x: RESERVE_LOCAL.x, y: RESERVE_LOCAL.y, r: reserveR, kind: 'reserve', face: '#eeece5' },
    { x: SECONDS_LOCAL.x, y: SECONDS_LOCAL.y, r: secondsSubR, kind: 'seconds', face: '#eeece5' },
  ],
});
dialFace.add(dial);

const handsGroup = new THREE.Group();
handsGroup.position.z = aesthetics.dial.hands.handsGroupZOffset;
dialFace.add(handsGroup);
// NOTE: handsGroup's parent is dialFace (which is flipped 180° about Y), so
// baseZ here is LOCAL to dialFace — not the world-ish Z_DIAL convention used
// for movement's direct children. dir is also flipped (+1) because the
// parent's Y-rotation inverts the sign of a local-Z displacement once it
// reaches world space (local +Z faces world -Z through this flip).
// baseZ MUST be the same expression the constructor set — updateExplode
// writes position.z = baseZ every frame at rest, so a divergent literal
// here silently REVERTS the constructed position on frame one. That
// exact bug shipped: the json offset said 3.2 — a DERIVED value (see the
// alarm hand-plane stack at ALARM_HAND_Z: at 2.5 the free lane is 0.5,
// thinner than any hand section) and the hour TUBE was built to reach it
// — but this line said 2.5, so frame one dropped the minute hand 0.7
// below its designed plane, into the hour hand's lane, in every running
// session ever seen. Intra-unit, so the battery could not see it (the
// documented blind spot); found by §29 step 0's virgin-session
// fingerprint check, because only a virgin boot showed the constructed
// geometry. registerExplode boot-asserts the match for every entry now,
// so the class is closed.
registerExplode(handsGroup, aesthetics.dial.hands.handsGroupZOffset, 2, 1);

// The MINUTE hand rides the cannon pinion; the HOUR hand is mounted on the
// hour wheel's tube further down (see the motion works), so it is NOT added
// here — it becomes a child of hourWheelGroup and inherits that wheel's
// rotation rather than being posed independently.
// Hour hand length: tip just shy of the hour numerals. The applied numerals'
// inner edge measures r ≈ 23.1 (sampled from the built numeral meshes, all 12
// azimuths); 0.56·dialRadius puts the tip at ≈ 22.1 — one unit shy, the same
// visual gap the minute hand keeps to the railroad. (Was 0.5R = 19.7, which
// left a dead band of 3.4 before the numerals.)
const HOUR_HAND_LEN = dialRadius * 0.56;
const hourHand = G.makeHand({ length: HOUR_HAND_LEN, kind: 'hour' });
// Minute hand length: tip ON the railroad's rungs. The chemin de fer's two
// rails RENDER at world r ≈ 31.5 / 34.2 (measured from the dial texture — the
// canvas silver fill reaches only ~0.92R, so the printed 0.87/0.94R land
// further in); 0.83·dialRadius puts the tip at ≈ 32.8, mid-rung between them.
const MINUTE_HAND_LEN = dialRadius * 0.83;
const minuteHand = G.makeHand({ length: MINUTE_HAND_LEN, kind: 'minute' });
minuteHand.position.z = 2.3; // lifted with the wider rods: rHour + rMinute must clear this gap (see makeHand)
handsGroup.add(minuteHand);

// Small-seconds display — the hand rides the fourth wheel's own axis via
// the slip-coupled display arbor (see secondsCamArbor: heart cam + through
// rod). The hand mesh lives on the dialFace (authored-frame) like every
// other hand; its rotation uses the SAME expression the old central second
// hand used (fourthA − secondsZeroRef), which is verified clockwise from
// the front — the movement-frame arbor carries the negated value, the two
// being the same physical rotation seen from opposite sides.
const smallSecondsGroup = new THREE.Group();
smallSecondsGroup.position.set(SECONDS_LOCAL.x, SECONDS_LOCAL.y, 0);
dialFace.add(smallSecondsGroup);
registerLabel('Small seconds', smallSecondsGroup);
const smallSecondsHand = G.makeHand({ length: secondsSubR * 0.8, kind: 'second' });
smallSecondsHand.name = 'smallSecondsHand';
smallSecondsHand.position.z = -(SUBDIAL_RECESS - 0.3);
smallSecondsGroup.add(smallSecondsHand);

// The display arbor itself: extend the slip-coupled seconds arbor (heart
// cam, built back at the movement side) FORWARD along the fourth wheel's
// axis — through the wheel and pinion bores (rod r 0.4 ≤ bore 0.4/0.9),
// through the back plate, to a hub just behind the sub-dial, exactly like
// the reserve train's own hand arbor. This is what makes the small seconds
// physically honest: the hand's axis is a real rod coaxial with the real
// fourth wheel, not a representational hop across the movement.
{
  // Hub inside the recessed well: through the floor's bore (r 1.0 > hub
  // 0.9), stopping just short of the dial's surface plane. The hand rides
  // at world Z_DIAL + 0.2, straddled by the hub's span.
  const hubZ = Z_DIAL + SUBDIAL_RECESS - 0.15; // hub centre (world)
  const rodLen = Z_SECONDS_ARBOR - hubZ;
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, rodLen, 10), MATS.steel);
  rod.rotation.x = Math.PI / 2;
  rod.position.z = -rodLen / 2; // local: from the cam plane down/forward to the hub
  secondsCamArbor.add(rod);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.6, 12), MATS.steel);
  hub.rotation.x = Math.PI / 2;
  hub.position.z = hubZ - Z_SECONDS_ARBOR;
  secondsCamArbor.add(hub);
}

// ---------------------------------------------------------------------------
// MOTION WORKS — the 12:1 reduction from the minute hand to the hour hand.
//
// This used to be `hourHand.rotation.z = minuteA / 12`: the one ratio in the
// whole movement produced by an arithmetic operator instead of tooth counts,
// with no geometry behind it at all. The cannon pinion existed but drove
// nothing, and the hour hand was a mesh mounted on air.
//
// Real arrangement, now modelled: the CANNON PINION is friction-fit on the
// centre arbor and turns once an hour (it carries the minute hand). It
// drives the MINUTE WHEEL on its own stud; the MINUTE PINION, compound with
// that wheel, drives the HOUR WHEEL, which is a TUBE running concentrically
// over the cannon pinion and carrying the hour hand. Two meshes, 3:1 then
// 4:1 = 12:1.
//
// Both meshes must share one centre distance d — the minute wheel and its
// pinion are one compound part on a single post — so each module is solved
// from that same d:
//   mesh 1: d = m1·(Nc + Nmw)/2      mesh 2: d = m2·(Nmp + Nhw)/2
// 10/30/8/32 makes the tooth SUMS equal (40 = 40), so m2 falls out equal to
// m1 and one module serves the whole motion works — the tidier result, and
// one fewer cutter on a real bench. The formula stays general: a 12:1 pair
// whose sums differ (10/30/10/40, say) would simply solve to m2 ≠ m1, the
// way real motion works often do.
// (All MW_* constants and cannonPinionTeeth are hoisted to the top of the
// file with the layout constants — the setting arbor terminates at the
// minute wheel and needs them long before the dial is built.)

// §29: thickness 2 → 2.1, seated 0.05 deeper — the z-chain's MW_Z1 landed
// at −1.966 and the minute wheel's bevelled underside (−2.48) must stay
// inside the cannon's leaves for full-face mesh; the top face stays −0.5.
const cannonPinion = G.makePinion({ module: MW_MODULE_1, teeth: cannonPinionTeeth, thickness: 2.1, material: MATS.steel });
cannonPinion.position.z = -1.55;
dialFace.add(cannonPinion);

// ---------------------------------------------------------------------------
// §29 CENTRE Z-CHAIN (steps 1–2) — the whole stack behind the dial sheet,
// derived TOP-DOWN in one place (dialFace-local; world = −7 − local). Each
// member's plane is the previous member's far face plus exactly the margin
// or working contact the mechanism needs; the motion-works planes at the
// bottom are WHERE THE CHAIN LANDS, not chosen numbers. (§25 C's block
// below consumes these; they are hoisted here because the motion works
// builds first.)
// ---------------------------------------------------------------------------
const ALARM_TUBE_BACK = -0.23;   // setting wheel −0.05..−0.23 (0.18 thick, ALARM_SET_T below), flange top here
const ALARM_FLANGE_T = 0.08;     // carrier flange −0.23..−0.31
const ALARM_HEART_T = 0.30;      // heart band, one CLEAR_MARGIN under the flange:
const ALARM_HEART_Z = (ALARM_TUBE_BACK - ALARM_FLANGE_T) - CLEAR_MARGIN - ALARM_HEART_T / 2; // −0.46..−0.76
// §29 step 2/3 stack under the heart: fixed feeler (one margin below the
// co-rotating heart), its pin riding the disc's raised notch track, the
// disc body, then one margin to the minute wheel.
const ALARM_FEELER_T = 0.10;                                             // feeler arm slice (step 3 builds it)
const ALARM_FEELER_TOP = (ALARM_HEART_Z - ALARM_HEART_T / 2) - CLEAR_MARGIN; // −0.91
const ALARM_PIN_SHANK = 0.04;    // pin shank exposed between arm underside and track top
// The track is TALL (0.17) and the pin's DROP is BANKED at 0.06 by a stop
// on the feeler's bracket, NOT by bottoming in the notch: the arm crosses
// the spinning rim, and its dropped-state clearance over the teeth is
// (static gap − drop·leverFraction) — the stop is what keeps that ≥ the
// margin. Derivation at the feeler build; the two numbers live here
// because the whole chain hangs off them.
const ALARM_TRACK_H = 0.17;
const ALARM_PIN_DROP = 0.10; // stop-banked travel — the rim-crossing margin bounds it at 0.108
                             // (staticGap 0.21 − D·leverFraction ≥ CLEAR_MARGIN), and the pawl's
                             // withdrawal needs all of it: 0.18·(D/0.06-scale) ≈ 0.22 at the beak,
                             // clearing the 0.06 engagement by the one margin (measured + asserted)
const ALARM_DISC_BODY_T = 0.13;  // disc body (the rim's teeth share this plane)
const ALARM_TRACK_TOP = ALARM_FEELER_TOP - ALARM_FEELER_T - ALARM_PIN_SHANK; // −1.05
const ALARM_DISC_TOP = ALARM_TRACK_TOP - ALARM_TRACK_H;                       // −1.22 (body top)
const ALARM_DISC_BOT = ALARM_DISC_TOP - ALARM_DISC_BODY_T;                    // −1.35
// Planes (dialFace-local): the minute wheel must sit in the cannon pinion's
// plane to mesh it; the minute pinion and hour wheel share a second plane
// behind that. Both stay clear of the sub-dial well floors at −SUBDIAL_RECESS.
// §29: MW_Z1 IS the end of the chain — one margin plus the wheel's bevelled
// half-thickness below the disc body. Both planes move together (their 1.5
// spacing is the jumper star's slice, untouched by construction); every
// star/lever/stud z derives from them and follows. The cannon pinion (2.0
// thick at −1.5, spanning −0.5..−2.5) covers MW_Z1 with full face
// engagement down to −1.986+bevel; asserted below.
const MW_Z1 = ALARM_DISC_BOT - CLEAR_MARGIN - (0.8 / 2 + Math.min(0.8 * 0.18, MW_MODULE_1 * 0.22)); // = −1.916
const MW_Z2 = MW_Z1 - 1.5;   // minute pinion / hour wheel — the 1.5 IS the star slice spacing
if (MW_Z1 - 0.8 / 2 - Math.min(0.8 * 0.18, MW_MODULE_1 * 0.22) < -2.6 + 0.1)
  console.warn(`§29: minute wheel's bevelled underside ${(MW_Z1 - 0.466).toFixed(2)} approaches the cannon pinion's end −2.6 — face engagement thinning`);
// Stud direction: horizontal, away from both sub-dial wells (which sit above
// and below the centre).
const MW_STUD = { x: MW_CENTER_D, y: 0 };

const motionWorks = new THREE.Group();
dialFace.add(motionWorks);
registerLabel('Motion works', motionWorks);

// Minute wheel + minute pinion — one compound part on one stud.
const mwArbor = new THREE.Group();
mwArbor.position.set(MW_STUD.x, MW_STUD.y, 0);
const mwMinuteWheel = G.makeGear({
  module: MW_MODULE_1, teeth: MW_MINUTE_TEETH, thickness: 0.8, boreR: 0.5, spokes: 4, material: MATS.brass,
});
mwMinuteWheel.position.z = MW_Z1;
const mwMinutePinion = G.makePinion({
  module: MW_MODULE_2, teeth: MW_PINION_TEETH, thickness: 1.0, material: MATS.steel,
});
mwMinutePinion.position.z = MW_Z2;
mwArbor.add(mwMinuteWheel, mwMinutePinion);
motionWorks.add(mwArbor);
// The stud itself, riveted into the plate's dial-side face. Its length is
// SOLVED so it actually reaches the plate rather than stopping in mid-air:
// dialFace local +z runs away from the plate (the group is Y-flipped), so
// the plate's dial-side face sits at local (Z_DIAL − backPlateBottom), and
// the stud spans from the minute pinion's plane to just inside it.
{
  const plateFaceLocal = Z_DIAL - (backPlate.position.z - 1); // → local z of the plate's dial-side face
  const studTop = plateFaceLocal - 0.4;                       // 0.4 buried in the plate
  const studLen = MW_Z2 - studTop;
  const stud = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, Math.abs(studLen), 12), MATS.steel);
  stud.rotation.x = Math.PI / 2;
  stud.position.set(MW_STUD.x, MW_STUD.y, (MW_Z2 + studTop) / 2);
  motionWorks.add(stud);
}

// Hour wheel: the wheel itself plus the TUBE that carries the hour hand
// forward through the dial's centre bore. The tube's bore clears the cannon
// pinion's tips, so it rides over it instead of through it.
const hourWheelGroup = new THREE.Group();
dialFace.add(hourWheelGroup);
registerLabel('Hour wheel', hourWheelGroup);
const mwHourWheel = G.makeGear({
  module: MW_MODULE_2, teeth: MW_HOUR_TEETH, thickness: 0.8,
  boreR: HOUR_TUBE_OUTER, spokes: 4, material: MATS.brass, hub: false,
});
mwHourWheel.position.z = MW_Z2;
hourWheelGroup.add(mwHourWheel);
{
  const tubeTop = aesthetics.dial.hands.handsGroupZOffset; // the hour hand's plane
  const tubeLen = tubeTop - MW_Z2;
  const tube = new THREE.Mesh(
    ringGeo(HOUR_TUBE_INNER, HOUR_TUBE_OUTER, tubeLen), MATS.steel);
  tube.position.z = MW_Z2 + tubeLen / 2;
  hourWheelGroup.add(tube);
  // The hour hand is carried BY this wheel — mounted on the tube's front
  // end, so it inherits hourWheelGroup's rotation instead of being posed
  // from a separate expression in tick().
  hourHand.position.z = tubeTop;
  hourWheelGroup.add(hourHand);
}

// ---------------------------------------------------------------------------
// JUMPING-MINUTE SETTING (BUILT §1) — a star on the minute wheel and a
// sprung jumper on the dial face, engaged ONLY while the crown is out:
// pull → seconds fly to zero and hack (existing), and the jumper drops
// into the star, snapping the minute hand onto an exact minute index;
// turn → the hand advances in whole-minute detented jumps; push at the
// reference tick → restart, synchronized. The running display stays
// continuous because the jumper lifts when the crown goes home.
//
// The star's point count is DERIVED from the motion works, not assumed:
// one point per MINUTE-HAND minute seen at the minute wheel through the
// real cannon⇄minute-wheel mesh (10:30 → the wheel turns once per 3 h →
// 180 points at 2° pitch: a fine-serrated detent star).
// ---------------------------------------------------------------------------
const STAR_POINTS = Math.round(60 / Math.abs(MW_RATIO_1));
if (Math.abs(60 / Math.abs(MW_RATIO_1) - STAR_POINTS) > 1e-9)
  console.warn('jumping minutes: motion-works ratio gives a NON-INTEGER star count', 60 / Math.abs(MW_RATIO_1));
const STAR_PITCH = (Math.PI * 2) / STAR_POINTS;
// z slice DERIVED between the minute wheel's underside and the hour
// wheel's top face (both with their extrude bevels), one margin each way.
const _mwWheelBot = MW_Z1 - 0.8 / 2 - Math.min(0.8 * 0.18, MW_MODULE_1 * 0.22);
const _hourWheelTop = MW_Z2 + 0.8 / 2 + Math.min(0.8 * 0.18, MW_MODULE_2 * 0.22);
const STAR_T = (_mwWheelBot - _hourWheelTop) - 2 * CLEAR_MARGIN;
if (STAR_T < 0.2)
  console.warn(`jumping minutes: star slice collapsed to ${STAR_T.toFixed(2)} between the motion-works planes`);
const STAR_BOT = _hourWheelTop + CLEAR_MARGIN;      // 0-based extrude sits here
const STAR_MID = STAR_BOT + STAR_T / 2;
// Radius inside the minute wheel's root circle (the star must never be
// the mesh).
const STAR_R = (MW_MODULE_1 * MW_MINUTE_TEETH) / 2 - MW_MODULE_1 * 1.15 - 0.35;
// Tooth depth DERIVED from the pitch, not styled. STAR_POINTS is forced to
// 180 by the motion works (one point per minute-hand minute), so at this
// radius the pitch arc is only ~0.13 — a depth styled for "slender visible
// points" (it was 0.45) made every tooth 3.4× deeper than its own spacing:
// an 8° needle whose valley admits nothing, so no jumper beak of any
// practical width could seat without burying its shaft in the neighbours.
// Depth follows the flank angle instead: half a pitch arc of tangential
// run per STAR_FLANK of radial drop. 40° is the cam-able middle of the
// jumper range — steep enough that the beak is pushed out decisively as a
// point passes, shallow enough that the spring isn't fighting a wall.
const STAR_FLANK = 40 * DEG2RAD;                    // flank half-angle from radial
const STAR_DEPTH = (STAR_R * STAR_PITCH) / 2 / Math.tan(STAR_FLANK);
const minuteStar = G.makeStarWheel({ radius: STAR_R, points: STAR_POINTS, thickness: STAR_T, depth: STAR_DEPTH });
minuteStar.position.z = STAR_BOT;
mwArbor.add(minuteStar); // keyed to the minute wheel — snaps move the hands through the real train

// JUMPER — its own unit on the dial face. Pivot bearing scanned around
// the star; beak reach solved so the V tip seats at the valleys with a
// working bite; lift angle derived from the tip's clearance over the
// star's points.
const JMP_PIV_R = STAR_R + 2.4;                     // pivot ring: clear of the tips by ~2 beak lengths
// Tip seat: HALF a tooth depth below the tip circle, so the beak rides the
// flanks rather than bottoming out on the root — a beak resting at the root
// would take its snap from the root fillet instead of the V, and the notch
// is narrowest there. This is a FRACTION of the depth, not a fixed offset:
// the old `- STAR_DEPTH + 0.1` only looked sane against the old 0.45 depth
// and would sit outside the tip circle entirely at the derived depth.
const JMP_TIP_SEAT_R = STAR_R - STAR_DEPTH * 0.5;
// The radial band over which the beak is actually inside the star.
const JMP_ENGAGE_BAND = STAR_R - JMP_TIP_SEAT_R;
// Lever length (pivot → tip), solved so the tip's swing circle CROSSES the
// seat radius transversally with real ride authority. The old derivation
// (REACH = PIV − seat − 0.405) made |pivot→tip| = PIV − seat exactly: the
// seat sat AT the swing circle's inner tangency, where dR/dθ = 0 — so the
// off-axis aim scan below could never meet its ≥ 0.45·L slope gate and
// fell back (with a warning) to the dead-on lay with no ride authority.
// Constraint: at the seat crossing, slope = PIV·L·sinφ/seat ≥ 0.5·L (10%
// over the scan's gate) ⇒ sinφ = 0.5·seat/PIV, then the law of cosines
// gives the inner transversal crossing:
const JMP_PHI = Math.asin(0.5 * JMP_TIP_SEAT_R / JMP_PIV_R); // pivot-vertex angle at the seat crossing
const JMP_LEVER = JMP_PIV_R * Math.cos(JMP_PHI)
  - Math.sqrt(JMP_TIP_SEAT_R ** 2 - (JMP_PIV_R * Math.sin(JMP_PHI)) ** 2); // pivot → tip
// Beak width from the SHOULDER constraint, not styling. makeJumper's
// outline is self-similar: the tip cone runs from the apex back to the
// shoulder over 0.9·(W/2), where the arm flares to full width. Only the
// cone may be inside the star — the shoulder must stay outside the tip
// circle, or it fouls the points either side of the valley (that, not the
// tip, is what the old 0.9 width buried 0.27 deep). Clear the tip circle
// by one further tooth depth so the ride swing can't carry it back in:
const JMP_W = (2 * (JMP_ENGAGE_BAND + STAR_DEPTH)) / 0.9;
const JMP_REACH = JMP_LEVER - JMP_W * 0.45;
// (The released lift itself is solved further down, over the beak's whole
// outline — see JMP_LIFT_ROT.)
// Bearing scan (dialFace-local frame): dodge the setting cap's arbor
// head (its z-band overlaps this plane), the sub-dial wells, and the
// hour-wheel tube; prefer the bearing farthest from the setting cap so
// the lifter link has a clean run from the tail post.
const JMP_AZ = (() => {
  const capLocal = { x: -SETTING_CAP_XY.x, y: SETTING_CAP_XY.y }; // world→dialFace: R_y(π) mirrors x
  const obstacles = [
    { x: capLocal.x - MW_STUD.x, y: capLocal.y - MW_STUD.y, r: 1.8 }, // setting cap + arbor head (stud-relative)
    { x: -MW_STUD.x, y: -MW_STUD.y, r: ALARM_TUBE_OUTER + 0.6 },      // dial-centre tube stack (outermost: the §25 C alarm tube)
    { x: RESERVE_LOCAL.x - MW_STUD.x, y: RESERVE_LOCAL.y - MW_STUD.y, r: subDialR + 0.5 },
    { x: SECONDS_LOCAL.x - MW_STUD.x, y: SECONDS_LOCAL.y - MW_STUD.y, r: subDialR + 0.5 },
  ];
  let best = null;
  for (let d = 0; d < 360; d += 2) {
    const a = d * DEG2RAD;
    const px = Math.cos(a) * JMP_PIV_R, py = Math.sin(a) * JMP_PIV_R;
    let clr = Infinity;
    for (const o of obstacles) clr = Math.min(clr, Math.hypot(px - o.x, py - o.y) - o.r - 1.2);
    if (clr < CLEAR_MARGIN) continue;
    const capD = Math.hypot(px - obstacles[0].x, py - obstacles[0].y);
    const score = Math.min(clr, 2) + capD * 0.02;
    if (!best || score > best.score) best = { a, score };
  }
  if (!best) { console.warn('minute jumper: no clear bearing — using +y'); best = { a: Math.PI / 2 }; }
  return best.a;
})();
const jumperUnit = new THREE.Group();
jumperUnit.position.set(MW_STUD.x, MW_STUD.y, 0);
dialFace.add(jumperUnit);
registerLabel('Minute jumper', jumperUnit);
const jumperAzGroup = new THREE.Group();
jumperAzGroup.rotation.z = JMP_AZ;
jumperUnit.add(jumperAzGroup);
// The lever itself, pivoted at JMP_PIV_R, aimed back at the star.
const jumperLever = new THREE.Group();
jumperLever.position.set(JMP_PIV_R, 0, STAR_BOT);
jumperAzGroup.add(jumperLever);
// Beak AIM (JMP_AIM), lever length and width were all solved together,
// above, against the star's real tooth geometry — see the (k, width)
// scan next to JMP_LEVER's definition.
// Beak AIM solved, not the dead-on lay: a tip on the stud→pivot line has
// zero radial mechanical advantage (rotation moves it tangentially), so
// the seat is scanned OFF-axis for the aim whose tip lands on the seat
// radius with a real dR/dθ slope. Seat azimuth, slope and lift sign all
// come out of the same numbers (the pawl/detent scheme).
const _jTipAt = (rot) => ({ x: JMP_PIV_R + Math.cos(rot) * JMP_LEVER, y: Math.sin(rot) * JMP_LEVER });
const JMP_AIM = (() => {
  let best = null;
  for (let rot = Math.PI * 0.55; rot <= Math.PI * 1.45; rot += 0.002) {
    const t = _jTipAt(rot);
    const r = Math.hypot(t.x, t.y);
    if (Math.abs(r - JMP_TIP_SEAT_R) > 0.02) continue;
    const r2 = Math.hypot(_jTipAt(rot + 1e-3).x, _jTipAt(rot + 1e-3).y);
    const slope = (r2 - r) / 1e-3; // dR/dθ at the seat
    if (Math.abs(slope) < 0.45 * JMP_LEVER) continue;
    if (!best || Math.abs(slope) > Math.abs(best.slope)) best = { rot, slope, t };
  }
  if (!best) {
    console.warn('minute jumper: no off-axis seat aim found — beak laid dead-on (no ride authority)');
    best = { rot: Math.PI, slope: JMP_LEVER, t: _jTipAt(Math.PI) };
  }
  return best;
})();
const JMP_BASE_ROT = JMP_AIM.rot;
const JMP_TIP_AZ_LOCAL = Math.atan2(JMP_AIM.t.y, JMP_AIM.t.x); // in the az frame
const JMP_LIFT_SIGN = Math.sign(JMP_AIM.slope) || 1;
const JMP_SLOPE = Math.abs(JMP_AIM.slope);
// Exact tip-radius → lever-rotation inverse, for the RUNTIME ride (below,
// near "starTurn"/"rU"). |tip(rot)| is the same law-of-cosines circle
// JMP_LEVER was solved from: R(rot)² = PIV² + L² + 2·PIV·L·cos(rot). The
// runtime ride used to LINEARIZE this at the seat (ride = (Rt−seat)/slope),
// which is only exact in the limit Rt→seat; measuring the swept MTV depth
// between the star and beak meshes across a full point→valley→point cycle
// (crown pulled, engaged) found the linear model under-rotating badly as
// Rt grows toward STAR_R — the beak dug into the passing POINT by up to
// ~0.27 units (worst near the point apex, where the seat-tangent line
// diverges most from the true circle). Solving the circle exactly instead
// removes that error identically at every phase, not just near the seat.
const JMP_COS_DENOM = 2 * JMP_PIV_R * JMP_LEVER;
function jmpRideForSeatRadius(targetR) {
  // targetR is clamped to ≥ JMP_TIP_SEAT_R by the caller (below-seat radii
  // — the valley side of the profile — mean the beak simply rests seated,
  // ride = 0). acos's principal value is always in [0, π]; JMP_BASE_ROT's
  // branch (which side of π the solved aim landed on, fixed at build time
  // and bounded away from π itself by the JMP_AIM slope gate) says which
  // of the two rot solutions for this cos is the one on OUR swing arc.
  const c = clamp((targetR * targetR - JMP_PIV_R * JMP_PIV_R - JMP_LEVER * JMP_LEVER) / JMP_COS_DENOM, -1, 1);
  const rot = JMP_BASE_ROT > Math.PI ? Math.PI * 2 - Math.acos(c) : Math.acos(c);
  return JMP_LIFT_SIGN * (rot - JMP_BASE_ROT);
}
const jumperBeakMesh = G.makeJumper({ reach: JMP_REACH, thickness: STAR_T, width: JMP_W });
jumperBeakMesh.rotation.z = JMP_BASE_ROT; // solved aim, tip on the seat
// Released lift, solved over the beak's WHOLE OUTLINE — not the tip apex.
// The apex has the full dR/dθ authority (JMP_SLOPE), but the V's base
// corners sit almost on the pivot circle and move nearly tangentially, so
// the apex-only lift ((STAR_R + margin − seat)/slope ≈ 0.18) left the
// flank corners at radius ~3.54, INSIDE the running star's tip circle —
// the wheel ground the lifted beak (measured intersection at rest).
// Constraint: at ψ_lift, EVERY outline point stays a margin outside the
// star's swept tip circle:  min_p |(JMP_PIV_R,0) + R(ψ)·R(base)·p| ≥
// STAR_R + CLEAR_MARGIN.
const JMP_LIFT_ROT = (() => {
  const cB = Math.cos(JMP_BASE_ROT), sB = Math.sin(JMP_BASE_ROT);
  const raw = jumperBeakMesh.userData.outline.map(([x, y]) => ({ x: x * cB - y * sB, y: x * sB + y * cB }));
  // Sample ALONG the outline edges too: an edge's interior can pass closer
  // to the star axis than either of its endpoints.
  const pts = [];
  for (let i = 0; i < raw.length; i++) {
    const a = raw[i], b = raw[(i + 1) % raw.length];
    for (let k = 0; k < 8; k++) pts.push({ x: a.x + (b.x - a.x) * k / 8, y: a.y + (b.y - a.y) * k / 8 });
  }
  const minRAt = (psi) => {
    const c = Math.cos(psi), s = Math.sin(psi);
    let m = Infinity;
    for (const p of pts) m = Math.min(m, Math.hypot(JMP_PIV_R + p.x * c - p.y * s, p.x * s + p.y * c));
    return m;
  };
  for (let a = 0; a <= Math.PI / 2; a += 1e-3) {
    if (minRAt(JMP_LIFT_SIGN * a) >= STAR_R + CLEAR_MARGIN + JMP_BIND_EPS) return a;
  }
  console.warn('minute jumper: no lift angle clears the star by the margin — beak left at the apex-only lift');
  return (STAR_R + CLEAR_MARGIN - JMP_TIP_SEAT_R) / JMP_SLOPE;
})();
{
  const beak = jumperBeakMesh;
  jumperLever.add(beak);
  // Tail bar behind the pivot: the lifter link's pin land.
  const tail = new THREE.Mesh(new THREE.BoxGeometry(1.3, JMP_W * 0.7, STAR_T), MATS.blueSteel);
  tail.position.set(0.85, 0, STAR_T / 2);
  jumperLever.add(tail);
  // Tail pin, EXTENDED dial-ward: it is both the lever's pin through the
  // tail bar and the RISER the lost-motion bar connects to, down on the
  // dial-hugging lifter plane (Z_JMP_LIFTER — the bar cannot run at the
  // star slice: the keyless/motion/reserve stacks own that whole z-band
  // along its span). The pin's dial-ward end sits flush with the bar's
  // dial face, i.e. it binds at CLEAR_MARGIN above the dial's back — the
  // same constraint that planes the bar.
  const pinEnd = -(CLEAR_MARGIN + JMP_BIND_EPS) - STAR_BOT; // lever-local; +z is dial-ward in the flipped unit frame
  const tailPin = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, pinEnd + 0.25, 8), MATS.steel);
  tailPin.rotation.x = Math.PI / 2;
  tailPin.position.set(1.35, 0, (pinEnd - 0.25) / 2);
  tailPin.name = 'jumperTailPin';
  jumperLever.add(tailPin);
}
{
  // Pivot stud: from the base plate's dial-side face up to this plane
  // (the same span the minute wheel's own stud bridges).
  const plateFaceLocal = Z_DIAL - (backPlate.position.z - 1);
  const studLen = Math.abs(STAR_BOT - (plateFaceLocal - 0.4));
  const stud = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, studLen, 10), MATS.steel);
  stud.rotation.x = Math.PI / 2;
  stud.position.set(JMP_PIV_R, 0, STAR_BOT - studLen / 2 + STAR_T / 2);
  jumperAzGroup.add(stud);
  // Jumper SPRING: solved-arc blade from its own screw pressing the
  // lever's flank toward the star (the bias that seats the beak).
  const A = { x: JMP_PIV_R + 1.9 * Math.cos(0.7), y: 1.9 * Math.sin(0.7) };
  const T = { x: JMP_PIV_R - 0.9, y: JMP_W * 0.55 + 0.12 };
  const dx = T.x - A.x, dy = T.y - A.y, dd = Math.hypot(dx, dy);
  const springR = 1.1;
  const h = Math.sqrt(Math.max(springR * springR - (dd / 2) ** 2, 0.01));
  const C = { x: (A.x + T.x) / 2 + (-dy / dd) * h, y: (A.y + T.y) / 2 + (dx / dd) * h };
  const thT = Math.atan2(T.y - C.y, T.x - C.x);
  let span = Math.atan2(A.y - C.y, A.x - C.x) - thT;
  if (span < 0) span += Math.PI * 2;
  const spring = new THREE.Mesh(new THREE.TorusGeometry(springR, 0.1, 8, 22, span), MATS.blueSteel);
  spring.position.set(C.x, C.y, STAR_MID);
  spring.rotation.z = thT;
  jumperAzGroup.add(spring);
  const springPost = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, studLen, 8), MATS.steel);
  springPost.rotation.x = Math.PI / 2;
  springPost.position.set(A.x, A.y, STAR_BOT - studLen / 2 + STAR_T / 2);
  jumperAzGroup.add(springPost);
}
// LIFTER LINK — a lost-motion bar from the setting lever's tail post
// (which already carries the crown's pull, dial side) to the jumper's
// tail pin: crown out pushes the slot's end against the pin and drops
// the beak in; crown in draws it back and lifts the beak clear. The
// bar's slot absorbs the stroke surplus (the post travels ~2.9; the
// tail arc is ~0.2 — a classic slotted setting-lever connection). Drawn
// as a follower between its two pins each frame.
const jumperLifter = new THREE.Mesh(new THREE.BoxGeometry(1, 0.55, JMP_LIFTER_T), MATS.steel);
jumperUnit.add(jumperLifter); // part of the jumper UNIT (its contact with the post is the declared lost-motion joint)
// Star base phase: snapped minutes must put a VALLEY under the beak.
// At a snapped pose the minute wheel's angle is a multiple of the pitch,
// so a single build-time phase aligns every snap: valley (u = 0.5) at
// the beak's azimuth when mwMinuteA = 0 snapped.
// Star base phase from the SOLVED tip azimuth: a snapped minute puts the
// minute wheel at a pitch multiple, so one build-time phase aligns every
// snap's valley (u = 0.5) under the beak's tip.
const JMP_TIP_AZ = JMP_AZ + JMP_TIP_AZ_LOCAL; // dialFace frame
minuteStar.rotation.z = JMP_TIP_AZ - STAR_PITCH / 2;
const JMP_WORLD_Z = Z_JMP_LIFTER; // the LIFTER BAR's plane in movement z — the dial-hugging corridor (see its derivation at the setting-lever build); the post's drop pin ends there by the same constraint
const JMP_LIFT_LOCAL_Z = Z_DIAL - Z_JMP_LIFTER; // same plane in the unit's flipped local frame
// UNIT ATTRIBUTION: the jumper is PLATE furniture (its stud rivets into the
// plate's dial-side face — see the mechanical graph's support edge), not
// dial furniture. As a dialFace child its meshes were collected into BOTH
// the 'Minute jumper' AND 'Dial' units (collectUnits gathers each label's
// full subtree), which made the 'Minute jumper' ⇄ 'Dial' budget row
// identically zero at every pose and leaked the lifter bar's intended
// post contact into 'Setting lever' ⇄ 'Dial'. Re-parent to the movement
// with the same world transform (attach preserves it); it keeps exploding
// with the dial side (same layer/dir as dialGroup).
dialFace.updateWorldMatrix(true, false);
movement.attach(jumperUnit);
registerExplode(jumperUnit, Z_DIAL, 1, -1);
const jumperTailPin = jumperLever.getObjectByName('jumperTailPin');
const _jmpPostW = new THREE.Vector3(), _jmpPinW = new THREE.Vector3(); // tick scratch

// ---------------------------------------------------------------------------
// Power-reserve complication — sub-dial at RESERVE_LOCAL. A small blued hand
// sweeps a 120° arc from 30 h (mainspring fully wound) down to 0, driven by
// barrelWindTurns in tick(). The graduated Ab/Auf face lives on the well's
// recessed floor (built by makeDial); this group holds only the hand,
// riding INSIDE the well, below the dial surface.
// ---------------------------------------------------------------------------
const reserveGroup = new THREE.Group();
reserveGroup.position.set(RESERVE_LOCAL.x, RESERVE_LOCAL.y, 0);
dialFace.add(reserveGroup);
registerLabel('Power reserve', reserveGroup);
const reserveHand = G.makeHand({ length: reserveR * 0.8, kind: 'minute' });
reserveHand.position.z = -(SUBDIAL_RECESS - 0.3);
reserveGroup.add(reserveHand);

// ---------------------------------------------------------------------------
// Power-reserve reduction train — the VISIBLE mechanical link from the barrel
// to the indicator. The barrel arbor extends through the back plate into the
// under-dial space (via a friction slip coupling, the standard simple-watch
// solution: a rigid tap of the great wheel alone can't give a bounded gauge
// that resets on winding, and a true differential is a lot of machinery).
// From there a 3-stage reduction (8/36 × 8/20 = 1/11.25) walks across the
// gap between plate and dial and ends on an arbor COAXIAL with the sub-dial
// pivot — the same axis the hand rides, its post passing through the dial
// exactly like the time hands do. 120° of hand = 3.75 barrel turns.
// ---------------------------------------------------------------------------
const reserveTrain = new THREE.Group();
movement.add(reserveTrain);
registerLabel('Power-reserve train', reserveTrain);
registerExplode(reserveTrain, 0, 2, -1); // explodes with the dial side (−z)

// World-frame anchors: barrel arbor axis → sub-dial pivot axis. reserveGroup
// sits on the Y-flipped dialFace, so dial-local (x, y) lands at world
// (P.dial.x − x, P.dial.y + y) — derived from RESERVE_LOCAL so moving the
// sub-dial moves the whole reduction train's target with it.
const rsvPivotXY = { x: P.dial.x - RESERVE_LOCAL.x, y: P.dial.y + RESERVE_LOCAL.y };
const Z_RSV = -4.2;         // gear plane in the plate→dial gap (plate back −2.3, dial −7)
const RSV_Z_STEP = 1.5;     // wheel/pinion height split (w2's dial-ward face at −6.25 clears the recessed well floor at −6.5)

const rsvTeethP0 = 8, rsvTeethW1 = 36, rsvTeethP1 = 8, rsvTeethW2 = 20;
const rsvSpanD = Math.hypot(rsvPivotXY.x - P.barrel.x, rsvPivotXY.y - P.barrel.y);
const rsvU = { x: (rsvPivotXY.x - P.barrel.x) / rsvSpanD, y: (rsvPivotXY.y - P.barrel.y) / rsvSpanD };
// Split the barrel→pivot span into the two mesh centre-distances by solving
// the second stage's module: d0 = m0·(8+36)/2, d1 = span − d0 = m1·(8+20)/2.
const rsvModule0 = 0.34;
const rsvD0 = (rsvModule0 * (rsvTeethP0 + rsvTeethW1)) / 2;
const rsvModule1 = (2 * (rsvSpanD - rsvD0)) / (rsvTeethP1 + rsvTeethW2);

const reservePinion0 = G.makePinion({ module: rsvModule0, teeth: rsvTeethP0, thickness: 1.2, material: MATS.steel });
const rsvWheel1 = G.makeGear({ module: rsvModule0, teeth: rsvTeethW1, thickness: 1.0, boreR: 0.5, spokes: 4, material: MATS.brass });
const reservePinion1 = G.makePinion({ module: rsvModule1, teeth: rsvTeethP1, thickness: 1.2, material: MATS.steel });
const rsvWheel2 = G.makeGear({ module: rsvModule1, teeth: rsvTeethW2, thickness: 1.0, boreR: 0.5, spokes: 0, material: MATS.brass });
// Half-tooth mesh phasing so teeth interleave rather than clash at rest.
rsvWheel1.rotation.z = Math.PI / rsvTeethW1;
rsvWheel2.rotation.z = Math.PI / rsvTeethW2;

const rsvW1Pos = { x: P.barrel.x + rsvU.x * rsvD0, y: P.barrel.y + rsvU.y * rsvD0 };

const rsvArbor0 = new THREE.Group(); // p0 — slip-coupled on the barrel arbor axis
rsvArbor0.position.set(P.barrel.x, P.barrel.y, Z_RSV);
rsvArbor0.add(reservePinion0);
reserveTrain.add(rsvArbor0);
// Visible barrel-arbor extension: from inside the barrel, through the back
// plate, down to p0 in the under-dial space.
const rsvExtTop = L_BARREL + 2;
const rsvArbExt = new THREE.Mesh(
  new THREE.CylinderGeometry(0.55, 0.55, rsvExtTop - Z_RSV, 12), MATS.steel);
rsvArbExt.rotation.x = Math.PI / 2;
rsvArbExt.position.set(P.barrel.x, P.barrel.y, (rsvExtTop + Z_RSV) / 2);
reserveTrain.add(rsvArbExt);

const rsvArbor1 = new THREE.Group(); // w1 + p1 share this arbor; p1 steps toward the dial
rsvArbor1.position.set(rsvW1Pos.x, rsvW1Pos.y, Z_RSV);
reservePinion1.position.z = -RSV_Z_STEP;
rsvArbor1.add(rsvWheel1, reservePinion1);
reserveTrain.add(rsvArbor1);
// Post spans from 1 above w1's plane to 0.6 past p1's — NOT the symmetric
// +2 it used to be: w1 sits inside the recessed reserve well's footprint,
// and the longer post's dial-ward end poked through the well floor
// (Z_DIAL + SUBDIAL_RECESS) as a visible stub on the sub-dial face.
const rsvPost1 = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, RSV_Z_STEP + 1.6, 10), MATS.steel);
rsvPost1.rotation.x = Math.PI / 2;
rsvPost1.position.set(rsvW1Pos.x, rsvW1Pos.y, Z_RSV + 1 - (RSV_Z_STEP + 1.6) / 2);
reserveTrain.add(rsvPost1);

const rsvArbor2 = new THREE.Group(); // w2 — the output, coaxial with the sub-dial pivot
rsvArbor2.position.set(rsvPivotXY.x, rsvPivotXY.y, Z_RSV - RSV_Z_STEP);
rsvArbor2.add(rsvWheel2);
reserveTrain.add(rsvArbor2);
// Indicator arbor: from w2 through the dial to the hand's pivot boss in front.
const rsvHandZ = Z_DIAL + SUBDIAL_RECESS - 0.2; // through the well floor's bore, just behind the hand
const rsvHandArbor = new THREE.Mesh(
  new THREE.CylinderGeometry(0.4, 0.4, (Z_RSV - RSV_Z_STEP) - rsvHandZ, 10), MATS.steel);
rsvHandArbor.rotation.x = Math.PI / 2;
rsvHandArbor.position.set(rsvPivotXY.x, rsvPivotXY.y, ((Z_RSV - RSV_Z_STEP) + rsvHandZ) / 2);
reserveTrain.add(rsvHandArbor);

// ---------------------------------------------------------------------------
// Alarm (BUILT §24) — a second, independent crown sets a small alarm disc.
// Three units, decomposed the way the power reserve is (hand on the dialFace,
// its drive train on the movement side):
//   'Alarm disc'         — the pointer, riding in the alarm well like the
//                          reserve hand; its dialFace rotation IS the set
//                          time read against the 12 h ring (Rule 2).
//   'Alarm setting arbor'— the disc arbor carrying the mating bevel; the
//                          friction-set mechanical link from crown to disc.
//   'Alarm crown'        — crown + free stem + a bevel at the stem's inner
//                          end; a force source, exiting the case rim at the
//                          scan-chosen azimuth (no sliding pinion, no clutch:
//                          it drives one thing, so it is simpler than the
//                          winding crown it copies).
// The crown turns the arbor through a real 90° bevel pair (addBevelCorner's
// idiom); the arbor turns the pointer, 1:1 and continuously (friction-set —
// the disc follows the crown exactly and holds by friction). Rotation is
// threaded through in tick() with the same representational coupling the
// setting/reserve arbors use.
// ---------------------------------------------------------------------------
// §25 crown-sense swap (owner's call — the Cricket/Memovox convention is
// pushed-in = WIND, pulled-out = SET, and the first build had it inverted):
// the SETTING arbor stands one crown throw OUTBOARD of §24's radius, and the
// winding CLIMB takes the vacated inner column — the two probed-clear
// verticals literally exchange places, and the stem's pull now carries its
// bevel from the (inner) winding contrate out to the setting corner.
const ALARM_ARBOR_R = ALARM_CD + CROWN_PULL_DIST;
const alarmWorld = (() => {
  const bx = P.dial.x - ALARM_LOCAL.x, by = P.dial.y + ALARM_LOCAL.y;
  const d = Math.hypot(bx, by) || 1;
  return { x: (bx / d) * ALARM_ARBOR_R, y: (by / d) * ALARM_ARBOR_R };
})();
const _alarmRimD = Math.hypot(alarmWorld.x, alarmWorld.y);
const alarmDir = { x: alarmWorld.x / _alarmRimD, y: alarmWorld.y / _alarmRimD }; // outward radial (world) to the case rim
// Bevel-corner plane, wedged into the tight band between the BASE PLATE
// (bottom face −2.3) and the well floor (Z_DIAL + SUBDIAL_RECESS = −6.5). The
// two bevels reach out of the corner in opposite directions: the disc bevel
// trails −z down the arbor toward the pointer (must stop short of the floor),
// and the stem bevel — a disk ⊥ the stem — reaches +z toward the plate (must
// stop short of it). Both are held clear of the plate by the same CLEAR_MARGIN
// the rest of the movement uses. The base plate is NOT a swept unit, so this
// clearance is verified by hand, not by the battery — an earlier build put the
// detent star at −2.3…−1.6, buried in the plate, and every clean run missed it.
// Reach ≈ faceWidth + tipR (45° cone) ≈ 2.05; corner −4.1 → disc cone bottoms
// at −6.15 (clear of the floor) and the stem bevel tops out at −2.70 (clear of
// the plate).
const Z_ALARM_CORNER = -4.1;
const ALARM_BEVEL_TEETH = 10, ALARM_BEVEL_MODULE = 0.24, ALARM_BEVEL_FACE = 0.65, ALARM_BEVEL_PHASE = Math.PI / ALARM_BEVEL_TEETH;

// --- 'Alarm disc' — the CENTRAL rattrapante alarm hand (§25 C, stage 1) -----
// Replaces §24's sub-dial pointer. The alarm indicator is now a co-axial hand
// at the dial centre: its tube rides the hour-wheel tube (running fit — that
// contact IS its bearing) through the enlarged centre bore, and the hand sits
// between the applied numerals' relief (local ≤ ~0.9) and the hour hand's
// plane (+2.5), slightly shorter than the hour hand so it can hide exactly
// beneath it. Stage 1 shows the SET time always; stage 2 adds the rattrapante
// follow (heart cam on the hour wheel + spring follower + the arming clamp)
// so it TRACKS the hour hand when disarmed. dialFace frame, like the hour
// wheel it wraps.
// Hand plane — bounded by the hand HUBS, not the numerals (the alarm blade's
// tip, 20.9, never radially reaches the numerals' inner edge at 23.1). The
// binding stack, measured: dial-furniture relief ≤ 0.16 proud of the face;
// the hour hand's solid boss reaches 1.51 below its mount plane. At the old
// hands plane (2.5) the free lane was 0.99 − 0.5 ≈ 0.5 — thinner than any
// hand section — which is WHY handsGroupZOffset rose 2.5 → 3.2 (hour + minute
// move together, so their own crossing envelope is untouched): the hour hub
// bottom moves to 1.69 and the lane opens to ~1.2. The alarm hand then seats
// at 1.1 with its blade z-thinned 0.5× (a rattrapante leaf): keel at 0.55
// (0.39 over the furniture), blade top at 1.35 (0.34 under the hour hub), and
// its bored collet (0.9..1.3 after the same 0.5× z-scale, straddling the
// tube's front face at 1.1) clears the hour blade's keel (2.04) by 0.74.
const ALARM_HAND_Z = 1.1;
// §25 C stage 2 — the rattrapante follow. A HEART CAM pressed on the hour
// tube and a sprung FOLLOWER carried by the alarm tube: disarmed, the spring
// seats the follower's nose in the heart's notch and the alarm hand snaps to
// and tracks the hour hand; armed, the tube is held at the set time and the
// nose rides the turning heart, pumping the arm — the visible proof the two
// members are coupled by a cam, not an assignment.
//
// The whole follower sweeps EVERY azimuth as the alarm is set, so its swept
// envelope is an annulus — and the lane behind the dial sheet is bounded at
// r 4.5 by a dial foot and the motion-works stud (vertex-probed). Everything
// here therefore stays inside r ≤ 4.2: a shallow heart (2.75 → 3.55) and a
// short arm. z, dialFace-local (world = −7 − local), §29 step 1 stack:
// setting wheel −0.05..−0.23 · carrier flange −0.23..−0.31 · heart and arm
// share −0.46..−0.76 · DISC BAND (§29, open) −0.76..−1.33 · minute wheel
// from −1.33 · hour wheel face at −2.9 far below; the empty bracket lane
// and the r-4.5 bound were both measured, not assumed.
// (ALARM_TUBE_BACK is defined in the §29 CENTRE Z-CHAIN block up at the
// motion works, with the rest of the stack it anchors.)
const ALARM_FLANGE_OUT = 4.05;                  // carrier flange: retention + the follower's mounting plate —
                                                // held 0.18 inside the setting idler's tip-reach toward the centre
                                                // (9.21 − 4.98 = 4.23; the full sweep caught a 4.25 flange corner-
                                                // grazing the idler at their shared z boundary)
// (ALARM_FLANGE_T — see the §29 CENTRE Z-CHAIN block.)
// §25 C stage 3 — the setting train's tooth counts. ONE module for all three
// meshes (a plain idler cannot mesh two different modules), solved so the
// three pitch circles exactly span the arbor's radius:
//   m·(30 + 2·31 + 10)/2 = ALARM_CD  →  m ≈ 0.302 at the current layout.
// The idler's 31 drops out of the ratio: crown → hand is pinion/wheel =
// 10/30 — one crown rev sets 4 h (see alarmDiscAngle).
const ALARM_SET_WHEEL_TEETH = 30, ALARM_SET_I1_TEETH = 28, ALARM_SET_I2_TEETH = 37, ALARM_SET_PINION_TEETH = 10;
// TWO ASYMMETRIC idlers (28 t, 37 t) on a DOGLEG. The corridor is walled on
// every side, each bound measured: the two sub-dial WELL RINGS (r 10.2 about
// (0, ±15.4), walls descending through this exact z-band — the owner SAW the
// first 40 t idler poking through the reserve well), the winding CLIMB column
// on the az-0 line, and the setting arbor's cock post one throw beyond. The
// 28 t i1 threads between the rings at bearing +18°; the 37 t i2 stands wide
// of the climb's protection zone north of the arbor. Idlers drop out of the
// ratio; the third mesh's flip stays absorbed in the bevel handedness. Every
// clearance named here is boot-asserted below — the first route was placed
// off a probe that SKIPPED the Dial unit, and its EXPECTED row then blanketed
// the collision in the sweep; asserts don't share that blind spot.
const ALARM_SET_MODULE = 0.30;
// §29 step 1: ONE thickness for the whole setting-train gear lane (wheel,
// both idlers, arbor pinion) — 0.25 → 0.18. The lane's z is DERIVED from it:
// crisp faces (bevel: false everywhere in this lane) + the 0.05 sheet gap
// the setting wheel established, so the band is world −6.95..−6.77 and the
// plane is its middle. Thinning here is what lets the centre stack above
// compact without losing the sheet gap.
const ALARM_SET_T = 0.18;
const ALARM_SET_I1_BEARING = 18 * DEG2RAD;
const ALARM_SET_RATIO = ALARM_SET_PINION_TEETH / ALARM_SET_WHEEL_TEETH;
const ALARM_SET_DW1 = ALARM_SET_MODULE * (ALARM_SET_WHEEL_TEETH + ALARM_SET_I1_TEETH) / 2; // centre wheel ⇄ i1
const ALARM_SET_D12 = ALARM_SET_MODULE * (ALARM_SET_I1_TEETH + ALARM_SET_I2_TEETH) / 2;     // i1 ⇄ i2
const ALARM_SET_D2P = ALARM_SET_MODULE * (ALARM_SET_I2_TEETH + ALARM_SET_PINION_TEETH) / 2; // i2 ⇄ arbor pinion
const ALARM_SET_Z = Z_DIAL + 0.05 + ALARM_SET_T / 2; // WORLD gear plane (= −6.86) — the probed-empty lane under the
                                                // reserve band, DERIVED: sheet (−7) + the 0.05 crisp-face gap + half the
                                                // lane thickness. The corridor asserts below re-verify the lane.
const ALARM_HEART_R = 3.55, ALARM_HEART_RMIN = 2.75; // (ALARM_HEART_T / ALARM_HEART_Z — §29 CENTRE Z-CHAIN block; heart 0.30 thick, band −0.46..−0.76, one margin under the flange by derivation)
// §29: the DISC BAND is now a derivation chain (see the CENTRE Z-CHAIN
// block), but re-verify its two hard edges from the same expressions that
// place the neighbours — a future edit to any link must keep both margins.
{
  const heartBot = ALARM_HEART_Z - ALARM_HEART_T / 2;
  const mwTop = MW_Z1 + 0.8 / 2 + Math.min(0.8 * 0.18, MW_MODULE_1 * 0.22);
  if (heartBot - ALARM_FEELER_TOP < CLEAR_MARGIN - 1e-9)
    console.warn(`§29 stack: feeler top ${ALARM_FEELER_TOP.toFixed(2)} inside the heart's margin (heart bottom ${heartBot.toFixed(2)}, need ${CLEAR_MARGIN})`);
  if (ALARM_DISC_BOT - mwTop < CLEAR_MARGIN - 1e-9)
    console.warn(`§29 stack: disc bottom ${ALARM_DISC_BOT.toFixed(2)} inside the minute wheel's margin (mw top ${mwTop.toFixed(2)}, need ${CLEAR_MARGIN})`);
}
const ALARM_NOSE_R = 0.2;                       // follower roller
const ALARM_PIVOT_R = 3.68;                     // pivot post radius (tube frame, az π) — post edge (r+0.22) inside the 4.05 flange
const ALARM_NOSE_AZ = Math.PI - 0.5;            // seated contact azimuth (tube frame)
// Arm length and seated angle DERIVED from the triangle (pivot, dial centre,
// seated nose) — the same constants tick() solves against, so the built arm
// and the posed arm cannot drift apart.
const _alarmSeatD = ALARM_HEART_RMIN + ALARM_NOSE_R;
const _alarmSeatT = { x: _alarmSeatD * Math.cos(ALARM_NOSE_AZ), y: _alarmSeatD * Math.sin(ALARM_NOSE_AZ) };
const ALARM_FOLLOWER_LEN = Math.hypot(_alarmSeatT.x + ALARM_PIVOT_R, _alarmSeatT.y);
const alarmArmAngleAt = (d) => Math.acos(clamp(
  (ALARM_PIVOT_R * ALARM_PIVOT_R + ALARM_FOLLOWER_LEN * ALARM_FOLLOWER_LEN - d * d)
  / (2 * ALARM_PIVOT_R * ALARM_FOLLOWER_LEN), -1, 1));
const ALARM_FOLLOWER_A0 = alarmArmAngleAt(_alarmSeatD);
const alarmHeartRAt = (a) => ALARM_HEART_RMIN + (ALARM_HEART_R - ALARM_HEART_RMIN) * (1 - Math.cos(a)) / 2;

const alarmTubeGroup = new THREE.Group();
dialFace.add(alarmTubeGroup);
registerLabel('Alarm disc', alarmTubeGroup);
registerExplode(alarmTubeGroup, 0, 2, 1); // dialFace child: dir +1 lifts toward the viewer (the handsGroup convention)
{
  const tube = new THREE.Mesh(
    ringGeo(ALARM_TUBE_INNER, ALARM_TUBE_OUTER, ALARM_HAND_Z - ALARM_TUBE_BACK), MATS.steel);
  tube.position.z = (ALARM_TUBE_BACK + ALARM_HAND_Z) / 2;
  alarmTubeGroup.add(tube);
  // Carrier flange: retention AND the follower's mounting plate — the pivot
  // post and spring stub hang from its underside. Sits UNDER the setting
  // wheel (−0.30..−0.40), which is retained between it and the dial sheet.
  const flange = new THREE.Mesh(ringGeo(ALARM_TUBE_OUTER, ALARM_FLANGE_OUT, ALARM_FLANGE_T), MATS.steel);
  flange.position.z = ALARM_TUBE_BACK - ALARM_FLANGE_T / 2;
  alarmTubeGroup.add(flange);
  // Pivot post: flange underside down through the heart/arm band's bottom —
  // both ends DERIVED so the post tracks the §29 step 1 re-stratification.
  const postH = (ALARM_TUBE_BACK - ALARM_FLANGE_T) - (ALARM_HEART_Z - ALARM_HEART_T / 2);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, postH, 10), MATS.steel);
  post.rotation.x = Math.PI / 2;
  post.position.set(-ALARM_PIVOT_R, 0, ALARM_TUBE_BACK - ALARM_FLANGE_T - postH / 2);
  alarmTubeGroup.add(post);
}
// The follower arm — pivoted at the post, nose roller at the tip riding the
// heart. Built along +x from the pivot; at rotation 0 it points at the dial
// centre (the pivot sits at az π), so tick's triangle solution IS its pose.
const alarmFollowerArm = new THREE.Group();
alarmFollowerArm.position.set(-ALARM_PIVOT_R, 0, ALARM_HEART_Z); // §29 step 1: arm CENTRED on the heart's mid-plane —
// the old +0.05 ride-high spent margin the compacted stack no longer has;
// centred, the arm's 0.3 bar exactly shares the heart band and keeps one
// CLEAR_MARGIN to the flange above by the ALARM_HEART_Z derivation itself
alarmTubeGroup.add(alarmFollowerArm);
{
  const bar = new THREE.Mesh(new THREE.BoxGeometry(ALARM_FOLLOWER_LEN, 0.3, 0.3), MATS.steel);
  bar.position.x = ALARM_FOLLOWER_LEN / 2;
  alarmFollowerArm.add(bar);
  const nose = new THREE.Mesh(new THREE.CylinderGeometry(ALARM_NOSE_R, ALARM_NOSE_R, 0.24, 12), MATS.ruby); // §29 step 1: 0.28 → 0.24 — stays inside the thinned 0.30 heart face (0.03 static margin each side; the two ride fixed, co-planar z)
  nose.name = 'alarmNose'; // penetration-budget selector (inspect.js couples by string)
  nose.rotation.x = Math.PI / 2;
  nose.position.x = ALARM_FOLLOWER_LEN;
  alarmFollowerArm.add(nose);
}
// Return spring — a thin blade from a stub on the flange bearing on the arm's
// outer edge. Its FORCE is representational (like the striker's hammer
// spring); its flex is driven in tick() from the arm's actual lift.
const alarmFollowerSpring = new THREE.Group();
alarmFollowerSpring.position.set(-ALARM_PIVOT_R * Math.cos(0.45), ALARM_PIVOT_R * Math.sin(-0.45), ALARM_HEART_Z); // §29 step 1: centred with the arm it bears on
alarmTubeGroup.add(alarmFollowerSpring);
{
  const blade = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.07, 0.22), MATS.blueSteel);
  blade.position.x = 0.55;
  alarmFollowerSpring.add(blade);
  const stubH = (ALARM_TUBE_BACK - ALARM_FLANGE_T) - ALARM_HEART_Z; // spring plane up to the flange underside — its anchor (derived, §29 step 1)
  const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, stubH, 8), MATS.steel);
  stub.rotation.x = Math.PI / 2;
  stub.position.z = stubH / 2;
  alarmFollowerSpring.add(stub);
}
// Blade angled INWARD from the stub toward the arm's flank — tip lands at
// r ≈ 4.0, inside the measured r-4.5 obstacle bound like everything else here.
alarmFollowerSpring.rotation.z = 1.9;
// The heart itself — pressed on the HOUR tube (co-rotating with the hour
// hand), notch phased to the seated nose azimuth so "seated" IS "hands
// coincident". Blued like the seconds-reset heart.
{
  // CRISP (bevel: false, §29 step 4): the beveled twin's rendered band is
  // 0.42 for the authored 0.30 (±0.06 z, +0.06 XY) — the sweep caught the
  // DROPPED feeler arm kissing that expansion at the notch-alignment poses,
  // the exact class MODELING.md rule 1 documents. Crisp, the band IS the
  // authored ALARM_HEART_T the §29 z-chain budgets, and the follower's
  // nose rides the TRUE authored profile (its cam budget stops absorbing a
  // phantom 0.06).
  const heart = G.makeHeartCam({ radius: ALARM_HEART_R, thickness: ALARM_HEART_T, boreR: 2.5, rMin: ALARM_HEART_RMIN, bevel: false });
  heart.traverse((o) => { if (o.isMesh) o.name = 'alarmHeart'; }); // penetration-budget selector
  heart.position.z = ALARM_HEART_Z;
  heart.rotation.z = ALARM_NOSE_AZ;
  hourWheelGroup.add(heart);
}

// --- 'Alarm setting wheel' — the FRICTION-coupled crown of the centre stack.
// Toothed wheel riding the alarm tube (bore 3.05 on the 3.0 tube — that snug
// fit IS the coupling, the cannon-pinion precedent §24's "friction-set"
// always implied): ARMED it turns the tube; DISARMED the tube follows the
// heart underneath it and slips, so the crown's set position is kept. Retained
// axially between the dial sheet (−7 world) and the carrier flange.
const alarmSetWheelGroup = new THREE.Group();
dialFace.add(alarmSetWheelGroup);
registerLabel('Alarm setting wheel', alarmSetWheelGroup);
registerExplode(alarmSetWheelGroup, 0, 2, 1); // dialFace child, like the alarm tube above
{
  // CRISP (bevel: false): the gap to the dial sheet is 0.05 and the extrude
  // bevel would expand the face 0.045 toward it — the full sweep caught the
  // idler's beveled twin actually touching the sheet (MODELING.md rule 1).
  const wheel = G.makeGear({ module: ALARM_SET_MODULE, teeth: ALARM_SET_WHEEL_TEETH, thickness: ALARM_SET_T, boreR: ALARM_TUBE_OUTER + 0.05, hub: false, spokes: 0, material: MATS.brass, bevel: false });
  wheel.position.z = -(0.05 + ALARM_SET_T / 2); // band −0.05..−0.23 (dialFace local; ALARM_SET_Z is this plane in world)
  alarmSetWheelGroup.add(wheel);
}

// --- 'Alarm setting idler' — plain idler spanning setting wheel → arbor
// pinion, in the probed-empty lane at ALARM_SET_Z (its whole disc at az 0,
// r 4.2..14.2, cleared by the vertex probe; the reserve band ends above it).
// MOVEMENT frame (it meshes the world-frame arbor); its stud drops from the
// base plate — that probed-clear column is its support.
const alarmIdlerGroup = new THREE.Group();
movement.add(alarmIdlerGroup);
registerLabel('Alarm setting idler', alarmIdlerGroup);
registerExplode(alarmIdlerGroup, 0, 2, -1);
// Route: i1 leaves the az-0 line at +35°, i2 lands by two-circle intersection
// (+y solution) — the same construction the winding chain's dogleg uses.
const _setU = { x: alarmWorld.x / ALARM_ARBOR_R, y: alarmWorld.y / ALARM_ARBOR_R }; // TRUE unit (an un-normalized copy of this once planted the idler in the climb)
const _setPerp = { x: -_setU.y, y: _setU.x };
const _setB = ALARM_SET_I1_BEARING;
const ALARM_SET_I1 = {
  x: (_setU.x * Math.cos(_setB) + _setPerp.x * Math.sin(_setB)) * ALARM_SET_DW1,
  y: (_setU.y * Math.cos(_setB) + _setPerp.y * Math.sin(_setB)) * ALARM_SET_DW1,
};
const ALARM_SET_I2 = (() => {
  const dx = alarmWorld.x - ALARM_SET_I1.x, dy = alarmWorld.y - ALARM_SET_I1.y;
  const d = Math.hypot(dx, dy);
  const a = (ALARM_SET_D12 * ALARM_SET_D12 - ALARM_SET_D2P * ALARM_SET_D2P + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, ALARM_SET_D12 * ALARM_SET_D12 - a * a));
  const mx = ALARM_SET_I1.x + (a * dx) / d, my = ALARM_SET_I1.y + (a * dy) / d;
  const s1 = { x: mx - (h * dy) / d, y: my + (h * dx) / d }, s2 = { x: mx + (h * dy) / d, y: my - (h * dx) / d };
  // pick the +perp side (away from the az-0 line, around the climb)
  return (s1.x * _setPerp.x + s1.y * _setPerp.y) > (s2.x * _setPerp.x + s2.y * _setPerp.y) ? s1 : s2;
})();
// The full corridor audit, asserted at boot — every wall this route threads:
// the two sub-dial well RINGS, the climb column, the cock post, and the chain
// closure itself. (The first route was probed with the Dial unit skipped and
// its collision then blanketed by an EXPECTED row; these asserts see what
// that pipeline could not.)
{
  const WALL_HALF = 0.2;
  // dial-local → world is (−Lx, +Ly) under the dialFace Y-flip
  const wells = [[-RESERVE_LOCAL.x, RESERVE_LOCAL.y], [-SECONDS_LOCAL.x, SECONDS_LOCAL.y]];
  const members = [
    ['setting wheel', { x: 0, y: 0 }, ALARM_SET_MODULE * ALARM_SET_WHEEL_TEETH / 2 + ALARM_SET_MODULE],
    ['i1', ALARM_SET_I1, ALARM_SET_MODULE * ALARM_SET_I1_TEETH / 2 + ALARM_SET_MODULE],
    ['i2', ALARM_SET_I2, ALARM_SET_MODULE * ALARM_SET_I2_TEETH / 2 + ALARM_SET_MODULE],
  ];
  for (const [nm, p, tip] of members) {
    for (const [wx, wy] of wells) {
      const d = Math.hypot(p.x - wx, p.y - wy);
      const clr = Math.abs(d - subDialR) - WALL_HALF - tip; // distance from the RING, less wall and tooth tip
      if (clr < CLEAR_MARGIN)
        console.warn(`alarm setting ${nm} vs well ring at (${wx.toFixed(1)},${wy.toFixed(1)}): clearance ${clr.toFixed(2)}, need ${CLEAR_MARGIN}`);
    }
  }
  for (const [nm, p, tip] of members.slice(1)) {
    const dc = Math.hypot(p.x - ALARM_WIND_X, p.y - ALARM_WIND_Y) - 0.45 - tip;
    if (dc < CLEAR_MARGIN) console.warn(`alarm setting ${nm} fouls the winding climb: clearance ${dc.toFixed(2)}`);
    const dk = Math.hypot(p.x - (alarmWorld.x + alarmDir.x * 1.4), p.y - (alarmWorld.y + alarmDir.y * 1.4)) - 0.4 - tip;
    if (dk < CLEAR_MARGIN) console.warn(`alarm setting ${nm} fouls the arbor cock post: clearance ${dk.toFixed(2)}`);
  }
  const close = Math.hypot(ALARM_SET_I2.x - alarmWorld.x, ALARM_SET_I2.y - alarmWorld.y);
  if (Math.abs(close - ALARM_SET_D2P) > 1e-6) console.warn('alarm setting dogleg failed to close on the arbor pinion');
}
const alarmSetI1Spin = new THREE.Group();
const alarmSetI2Spin = new THREE.Group();
{
  const mk = (spin, pos, teeth) => {
    spin.position.set(pos.x, pos.y, ALARM_SET_Z);
    const idler = G.makeGear({ module: ALARM_SET_MODULE, teeth, thickness: ALARM_SET_T, boreR: 0.5, spokes: 4, material: MATS.brass, bevel: false, hub: false }); // crisp + hub-less: the dial-sheet budget (see the setting wheel)
    idler.rotation.z = Math.PI / teeth;
    spin.add(idler);
    alarmIdlerGroup.add(spin);
    const stud = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, -2 - (ALARM_SET_Z + ALARM_SET_T / 2), 10), MATS.steel);
    stud.rotation.x = Math.PI / 2;
    stud.position.set(pos.x, pos.y, (-2 + ALARM_SET_Z + ALARM_SET_T / 2) / 2);
    alarmIdlerGroup.add(stud);
  };
  mk(alarmSetI1Spin, ALARM_SET_I1, ALARM_SET_I1_TEETH);
  mk(alarmSetI2Spin, ALARM_SET_I2, ALARM_SET_I2_TEETH);
}

// --- '(§29 step 2) Alarm release disc' — the Memovox differential ----------
// A notched disc friction-riding the HOUR TUBE in the §29 disc band: driven
// with time through that friction seat, RE-PHASED by the setting train when
// the crown sets — so its angle physically encodes (hour − setting), and the
// notch passes a FIXED azimuth exactly at coincidence, for every setting.
// The re-phasing branch taps the EXISTING dogleg: i2 becomes a COMPOUND
// idler (a second pinion on its sleeve down at the band plane), one new
// idler j carries the drive inboard, and the disc's own toothed rim closes
// it. The counts are FORCED, not chosen: the branch must deliver the tube's
// set rate with opposite sense, so (i2b/rim) ≡ (i2/settingWheel) = 37/30 —
// the same pair as the lane — and the extra mesh provides the sign. j drops
// out of the ratio; 18 teeth is its GEOMETRY: big enough that its dial-hung
// stud stands clear of the setting wheel's tips (asserted below).
const ALARM_DISC_TEETH = 30; // rim — with i1b (28) the branch nets −(28/30), the tube path's mirror (see the branch block)
// The branch MODULE is closure-derived: i1 stands ALARM_SET_DW1 from the
// centre, and the i1b⇄rim mesh must span exactly that — m = 2·DW1/(28+30).
const ALARM_BRANCH_MODULE = 2 * ALARM_SET_DW1 / (ALARM_SET_I1_TEETH + ALARM_DISC_TEETH);
// The READ STATION sits 0.44 rad off the stem line: the feeler's bracket
// needs |bracket − i1| ≥ i1b's tip reach + margin (4.74) at bracket radius
// 5.5, and on the az-0 line that distance is only 3.9 — the offset swings
// it clear (6.0 achieved, asserted at the feeler). The release azimuth is
// a free phase (Φ absorbs it); only the TAIL's corridor cares, and it
// dog-legs back to the climb one band above the gear lane (step 4).
const ALARM_FEELER_AZ_OFF = 0.44;
const ALARM_RELEASE_AZ = Math.atan2(alarmWorld.y, alarmWorld.x) - ALARM_FEELER_AZ_OFF;
const ALARM_RELEASE_PHASE = Math.PI - ALARM_RELEASE_AZ; // dialFace mirror: a disc-local-az-0 feature sits at world ALARM_RELEASE_AZ when rotation.z == this
const ALARM_NOTCH_W = 0.14;      // rad — the track gap: pin dia 0.28 + slop over the track's mid radius
const ALARM_TRACK_RMID = 3.05, ALARM_TRACK_HALFW = 0.20; // annulus 2.85..3.25: outside the hub (2.85), inside the rim's root circle (3.30)
const ALARM_BAND_Z = Z_DIAL - ALARM_DISC_TOP + ALARM_DISC_BODY_T / 2; // WORLD plane of the band gears (= the disc body's mid-plane mirrored)
// Sign pins (§29 step 2): fixed EMPIRICALLY against the three physical
// invariants (disc tracks hour when idle; setting re-phases it equal and
// opposite to the tube; the notch az at trip is setting-independent) —
// the mirror-frame algebra has too many hands. The boot assert below
// re-verifies the third invariant numerically on every load.
const ALARM_DISC_SIGN = 1;   // set-term sign in the disc's dial-frame law
const ALARM_BD_SIGN = 1;     // hour back-drive sign through the branch
{
  if (Math.abs(ALARM_SET_I2_TEETH / ALARM_DISC_TEETH - ALARM_SET_I2_TEETH / ALARM_SET_WHEEL_TEETH) > 1e-12)
    console.warn('§29 disc branch: rim ratio no longer mirrors the lane pair — the differential encodes the wrong rate');
}
const alarmDiscGroup = new THREE.Group();
dialFace.add(alarmDiscGroup);
registerLabel('Alarm release disc', alarmDiscGroup);
registerExplode(alarmDiscGroup, 0, 2, 1); // dialFace child: children carry local z
{
  // Friction hub — the running seat ON the hour tube (bore +0.05, the
  // setting wheel's snug-fit precedent: the fit IS the coupling).
  const hub = new THREE.Mesh(ringGeo(HOUR_TUBE_OUTER + 0.05, HOUR_TUBE_OUTER + 0.35, ALARM_TRACK_TOP - ALARM_DISC_BOT), MATS.steel);
  hub.name = 'alarmDiscHub';
  hub.position.z = (ALARM_TRACK_TOP + ALARM_DISC_BOT) / 2;
  alarmDiscGroup.add(hub);
  // Body + rim teeth in one crisp gear (bevel: false — the band budget is
  // margin-exact on both faces, same rule as the setting lane).
  const body = G.makeGear({ module: ALARM_BRANCH_MODULE, teeth: ALARM_DISC_TEETH, thickness: ALARM_DISC_BODY_T, boreR: HOUR_TUBE_OUTER + 0.05, hub: false, spokes: 0, material: MATS.steel, bevel: false });
  body.traverse((o) => { if (o.isMesh) o.name = 'alarmDiscBody'; });
  body.position.z = ALARM_DISC_BOT + ALARM_DISC_BODY_T / 2;
  alarmDiscGroup.add(body);
  // The RAISED TRACK with the notch as its one gap (no CSG: the notch is
  // the ABSENCE of track). The pin rides the track's top; at coincidence
  // the gap arrives under it and it drops ALARM_TRACK_H onto the body.
  const a0 = ALARM_NOTCH_W / 2, a1 = Math.PI * 2 - ALARM_NOTCH_W / 2;
  const shape = new THREE.Shape();
  shape.absarc(0, 0, ALARM_TRACK_RMID + ALARM_TRACK_HALFW, a0, a1, false);
  shape.absarc(0, 0, ALARM_TRACK_RMID - ALARM_TRACK_HALFW, a1, a0, true);
  const trackGeo = new THREE.ExtrudeGeometry(shape, { depth: ALARM_TRACK_H, bevelEnabled: false });
  const track = new THREE.Mesh(trackGeo, MATS.steel);
  track.name = 'alarmDiscTrack';
  track.position.z = ALARM_DISC_TOP;
  alarmDiscGroup.add(track);
}
// --- '(§29 step 2, FIXED) the re-phasing branch taps I1 DIRECTLY -----------
// The first build tapped i2 through a new idler j — placed by a two-circle
// solve whose circles never intersected: |i2 − centre| is 18.4 (the dogleg
// runs out to the ARBOR), not the assumed ~9. The closure assert caught it
// at boot, and the sweep did NOT: the collided pair was blanketed by its
// own EXPECTED row — the documented blind spot, self-inflicted a second
// time. The fix is simpler than the mistake: I1 sits at ALARM_SET_DW1
// (8.7) from the centre, and a compound pinion on ITS sleeve meshing the
// rim DIRECTLY gives the required −(28/30) in one mesh — the branch module
// is DERIVED from the closure (m = 2·DW1/(28+30)), so the mesh cannot
// fail to close, and the whole j problem evaporates.
{
  const i1b = G.makeGear({ module: ALARM_BRANCH_MODULE, teeth: ALARM_SET_I1_TEETH, thickness: ALARM_DISC_BODY_T, boreR: 0.5, spokes: 4, hub: false, material: MATS.brass, bevel: false });
  i1b.rotation.z = Math.PI / ALARM_SET_I1_TEETH;
  i1b.position.z = ALARM_BAND_Z - ALARM_SET_Z;
  alarmSetI1Spin.add(i1b);
  const sleeve = new THREE.Mesh(ringGeo(0.5, 0.62, Math.abs(ALARM_BAND_Z - ALARM_SET_Z)), MATS.steel);
  sleeve.position.z = (ALARM_BAND_Z - ALARM_SET_Z) / 2;
  alarmSetI1Spin.add(sleeve);
}
// --- '(§29 step 3) Alarm release feeler' — the FIXED reader ---------------
// A rocking lever on a dial-hung bracket at the release azimuth: pin down
// onto the disc's raised track, arm crossing the spinning rim with one
// margin, tail stub outboard for step 4's run to the climb. The pin's drop
// is BANKED at ALARM_PIN_DROP by a stop on the bracket — NOT by bottoming
// in the notch — because the dropped arm still owes the rim its margin
// (asserted below with the lever fraction written out).
const ALARM_FEELER_PIVOT_R = 5.5; // bracket lugs' inboard faces clear the rim's tips by one margin (asserted)
const ALARM_PIN_R = 0.14;         // pin radius — its diameter equals the arm's width, so the arm fits the
                                  // notch's sector exactly when the pin is fully dropped (0.14 rad gap vs
                                  // 0.092 rad pin arc at the track radius; the edge ramp below is what
                                  // keeps the arm above the ridge until the pin is truly in the gap)
const alarmFeelerUnit = new THREE.Group();
dialFace.add(alarmFeelerUnit);
registerLabel('Alarm release feeler', alarmFeelerUnit);
registerExplode(alarmFeelerUnit, 0, 2, 1); // dialFace child: children carry local z
// dial-local frame: world (x,y) ↔ dial-local (−x, y); uF = outward radial
// at the release azimuth, phiF = the inboard direction's dial-local angle.
const _uF = { x: -Math.cos(ALARM_RELEASE_AZ), y: Math.sin(ALARM_RELEASE_AZ) };
const _phiF = Math.atan2(-_uF.y, -_uF.x);
const ALARM_FEELER_ARM_LEN = ALARM_FEELER_PIVOT_R - ALARM_TRACK_RMID; // pivot → pin
const ALARM_FEELER_TAIL = 0.9;   // outboard stub — step 4 extends it to the climb pawl
const _armMidZ = (ALARM_FEELER_TOP + (ALARM_FEELER_TOP - ALARM_FEELER_T)) / 2; // −0.96
{
  // Bracket: two lugs from the sheet's back face down to the pivot, a
  // tangential pivot pin between them, and the BANKING STOP over the tail.
  const lugH = -0.05 - (_armMidZ - 0.10); // sheet back face → just under the pivot
  for (const side of [-1, 1]) {
    const lug = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, lugH), MATS.nickel);
    lug.position.set(_uF.x * ALARM_FEELER_PIVOT_R - Math.sin(_phiF) * 0.25 * side,
                     _uF.y * ALARM_FEELER_PIVOT_R + Math.cos(_phiF) * 0.25 * side,
                     -0.05 - lugH / 2);
    lug.rotation.z = _phiF;
    alarmFeelerUnit.add(lug);
  }
  const pivotPin = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.62, 8), MATS.steel);
  pivotPin.rotation.z = _phiF; // cylinder axis +y → rotate into the tangential direction
  pivotPin.position.set(_uF.x * ALARM_FEELER_PIVOT_R, _uF.y * ALARM_FEELER_PIVOT_R, _armMidZ);
  alarmFeelerUnit.add(pivotPin);
  // Banking stop: a post over the TAIL whose face banks the tail's RISE at
  // exactly the pin's allowed drop (lever ratio tail/arm) — the derived
  // travel limit that protects the rim crossing.
  const stopGap = ALARM_PIN_DROP * (ALARM_FEELER_TAIL / ALARM_FEELER_ARM_LEN);
  const stop = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.12), MATS.nickel);
  stop.position.set(_uF.x * (ALARM_FEELER_PIVOT_R + ALARM_FEELER_TAIL),
                    _uF.y * (ALARM_FEELER_PIVOT_R + ALARM_FEELER_TAIL),
                    ALARM_FEELER_TOP + 0.06 + stopGap + 0.06); // face sits stopGap above the tail's rest top
  stop.rotation.z = _phiF;
  alarmFeelerUnit.add(stop);
}
const alarmFeelerLever = new THREE.Group();
alarmFeelerLever.position.set(_uF.x * ALARM_FEELER_PIVOT_R, _uF.y * ALARM_FEELER_PIVOT_R, _armMidZ);
alarmFeelerLever.rotation.z = _phiF; // local +x = inboard, toward the pin
alarmFeelerUnit.add(alarmFeelerLever);
{
  const arm = new THREE.Mesh(new THREE.BoxGeometry(ALARM_FEELER_ARM_LEN, 2 * ALARM_PIN_R, ALARM_FEELER_T), MATS.steel);
  arm.position.x = ALARM_FEELER_ARM_LEN / 2;
  alarmFeelerLever.add(arm);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(ALARM_FEELER_TAIL, 2 * ALARM_PIN_R, ALARM_FEELER_T), MATS.steel);
  tail.position.x = -ALARM_FEELER_TAIL / 2;
  alarmFeelerLever.add(tail);
  // The pin: shank from inside the arm down to the riding tip.
  const pinLen = (ALARM_FEELER_TOP - ALARM_FEELER_T / 2) - ALARM_TRACK_TOP + 0.02; // arm mid → track top, +0.02 seat
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(ALARM_PIN_R, ALARM_PIN_R, pinLen, 12), MATS.ruby);
  pin.name = 'alarmFeelerPin'; // penetration-budget selector
  pin.rotation.x = Math.PI / 2;
  pin.position.set(ALARM_FEELER_ARM_LEN, 0, -pinLen / 2 + 0.02);
  alarmFeelerLever.add(pin);
  // Return spring: a blade from the outboard lug pressing the arm down —
  // force representational, flex driven in tick from the actual drop.
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.04), MATS.blueSteel);
  blade.name = 'alarmFeelerSpring';
  blade.position.set(0.45, 0.28, ALARM_FEELER_T / 2 + 0.04);
  alarmFeelerLever.add(blade);
}
// --- §29 step 4: the TAIL and the CONTRATE PAWL ---------------------------
// The tail runs STRAIGHT from the pivot to the climb (the probe cleared the
// line: it passes 4.3 from i1's sleeve, far over the gear lane), one band
// above the lane at the feeler's plane; at its end a RISER climbs to the
// winding contrate at Z_ALARM_CORNER and a beak enters the tooth band's
// LOWER edge from beside. Pin riding (no trip) ⇒ beak seated ⇒ the climb —
// and through the 12/44 mesh the whole striking barrel — is HELD. Pin drops
// ⇒ the tail swings dial-ward and the beak withdraws clear of the band:
// the RELEASE, as a real detent. Winding clicks over it: the beak's tip is
// SPRING STEEL and follows the tooth profile under it (kinematically, like
// the pin on the track) — the lever itself cannot bob, because the pin's
// track contact fixes its other end; the compliance is the pawl's own.
const ALARM_PAWL_ENGAGE = 0.06;  // beak's z reach into the contrate band's top edge — sized so the
                                 // pin's stop-banked drop withdraws it a full margin clear
const _climbDial = { x: -ALARM_WIND_X, y: ALARM_WIND_Y };      // climb axis, dial-local
const _pivotDial = { x: _uF.x * ALARM_FEELER_PIVOT_R, y: _uF.y * ALARM_FEELER_PIVOT_R };
const _toClimb = { x: _climbDial.x - _pivotDial.x, y: _climbDial.y - _pivotDial.y };
const _toClimbL = {  // lever-local (undo the lever's z-rotation)
  x: Math.cos(-_phiF) * _toClimb.x - Math.sin(-_phiF) * _toClimb.y,
  y: Math.sin(-_phiF) * _toClimb.x + Math.cos(-_phiF) * _toClimb.y,
};
const _contrateR = (ALARM_BEVEL_MODULE * ALARM_BEVEL_TEETH) / 2;
// The beak engages the tooth band's PLATE-side (top) edge: the lever's
// rock moves the tail plate-ward on the trip (measured — the pivot side
// signs land that way through the mirror), so engaging the top edge makes
// plate-ward motion the WITHDRAWAL, into the open span under the plate.
const _pawlBandTop = Z_ALARM_CORNER + ALARM_BEVEL_FACE / 2;
const ALARM_PAWL_DIST = Math.hypot(_toClimbL.x, _toClimbL.y) - _contrateR - 0.35; // pivot → riser (beak stand-off outside the teeth)
const alarmPawlFlex = new THREE.Group(); // the spring-steel tip — tick flexes position.z with the tooth profile
{
  const dirL = Math.atan2(_toClimbL.y, _toClimbL.x);
  // The tail's RUN is z-JOGGED off the arm's plane, dial-ward to local
  // −0.66..−0.76 (empty at its radii — the flange stops at 4.05, the heart
  // at 3.75): at the arm's plane the run passed under i1b's band gears with
  // 0.21 static, and the DROPPED lever's rise ate it — the sweep caught the
  // graze at exactly the notch-alignment poses. The jogged run clears i1b
  // by 0.46 even dropped, and still rides 0.43 above the gear lane.
  const _tailRunZ = (-7 - (-6.29)) - _armMidZ; // world −6.29 (run mid) → lever-local
  const jog = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, Math.abs(_tailRunZ) + ALARM_FEELER_T), MATS.steel);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(ALARM_PAWL_DIST, 0.26, 0.10), MATS.steel);
  tail.position.set(ALARM_PAWL_DIST / 2, 0, _tailRunZ);
  const tailG = new THREE.Group();
  tailG.rotation.z = dirL;
  jog.position.set(0.35, 0, _tailRunZ / 2);
  tailG.add(jog);
  tailG.add(tail);
  alarmFeelerLever.add(tailG);
  // riser + beak ride the flex group at the tail's end
  const beakTopL = (-7 - (_pawlBandTop - ALARM_PAWL_ENGAGE / 2)) - _armMidZ; // beak CENTRE, so its span is [bandTop − engage, bandTop] (world → dial-local → lever-local)
  const riser = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, Math.abs(beakTopL - _tailRunZ)), MATS.steel);
  riser.position.z = (beakTopL + _tailRunZ) / 2; // spans the jogged run's plane down to the beak
  alarmPawlFlex.add(riser);
  const beak = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.2, ALARM_PAWL_ENGAGE), MATS.steel);
  beak.name = 'alarmPawlBeak'; // penetration-budget selector; its leading face is square to the
                               // DELIVERY flank (wedges, self-holding) and the winding sense cams
                               // it out axially — the one-way approach-angle convention
  beak.position.set(0.35, 0, beakTopL - ALARM_PAWL_ENGAGE / 2 + ALARM_PAWL_ENGAGE / 2);
  beak.position.z = beakTopL;
  alarmPawlFlex.add(beak);
  alarmPawlFlex.position.set(Math.cos(dirL) * ALARM_PAWL_DIST, Math.sin(dirL) * ALARM_PAWL_DIST, 0);
  alarmPawlFlex.rotation.z = -dirL; // beak's +x aims at the climb axis
  alarmFeelerLever.add(alarmPawlFlex);
}
// §29 step 4 asserts — the tail's corridor and the travel arithmetic:
{
  const worldPt = (dl) => ({ x: -dl.x, y: dl.y });
  const pv = worldPt(_pivotDial), cl = { x: ALARM_WIND_X, y: ALARM_WIND_Y };
  const segDist = (p2) => { // point-to-segment pivot→climb
    const dx = cl.x - pv.x, dy = cl.y - pv.y; const L2 = dx * dx + dy * dy;
    const t = Math.max(0, Math.min(1, ((p2.x - pv.x) * dx + (p2.y - pv.y) * dy) / L2));
    return Math.hypot(p2.x - (pv.x + t * dx), p2.y - (pv.y + t * dy));
  };
  const say = (nm, clr) => { if (clr < CLEAR_MARGIN) console.warn(`§29 pawl tail ${nm}: clearance ${clr.toFixed(2)}, need ${CLEAR_MARGIN}`); };
  say('vs i1 sleeve', segDist(ALARM_SET_I1) - 0.62 - 0.13);
  say('vs i2 stud', segDist(ALARM_SET_I2) - 0.45 - 0.13);
  const wd = ALARM_PIN_DROP * (ALARM_PAWL_DIST + _contrateR + 0.35) / ALARM_FEELER_ARM_LEN; // beak's withdrawal travel
  if (wd - ALARM_PAWL_ENGAGE < CLEAR_MARGIN)
    console.warn(`§29 pawl: withdrawal ${wd.toFixed(2)} clears the ${ALARM_PAWL_ENGAGE} engagement by ${(wd - ALARM_PAWL_ENGAGE).toFixed(2)}, need ${CLEAR_MARGIN}`);
}
// §29 step 3 corridor + travel asserts:
{
  const bx = -_uF.x * ALARM_FEELER_PIVOT_R, by = _uF.y * ALARM_FEELER_PIVOT_R; // world XY of the bracket
  const i1bTip = (ALARM_BRANCH_MODULE * ALARM_SET_I1_TEETH) / 2 + 1.25 * ALARM_BRANCH_MODULE;
  const dToI1 = Math.hypot(bx - ALARM_SET_I1.x, by - ALARM_SET_I1.y);
  if (dToI1 - i1bTip - 0.31 < CLEAR_MARGIN)
    console.warn(`§29 feeler: bracket ${dToI1.toFixed(2)} from i1 — i1b tips reach ${i1bTip.toFixed(2)} + lug 0.31, need ${CLEAR_MARGIN} clear`);
  const rimTip = (ALARM_BRANCH_MODULE * ALARM_DISC_TEETH) / 2 + 1.25 * ALARM_BRANCH_MODULE;
  if ((ALARM_FEELER_PIVOT_R - 0.31) - rimTip < CLEAR_MARGIN)
    console.warn(`§29 feeler: lug inner face ${(ALARM_FEELER_PIVOT_R - 0.31).toFixed(2)} vs rim tips ${rimTip.toFixed(2)}, need ${CLEAR_MARGIN}`);
  const rimRoot = (ALARM_BRANCH_MODULE * ALARM_DISC_TEETH) / 2 - 1.25 * ALARM_BRANCH_MODULE;
  const staticGap = (ALARM_FEELER_TOP - ALARM_FEELER_T) - ALARM_DISC_TOP;
  const dropAtRim = ALARM_PIN_DROP * (ALARM_FEELER_PIVOT_R - rimRoot) / ALARM_FEELER_ARM_LEN;
  if (staticGap - dropAtRim < CLEAR_MARGIN)
    console.warn(`§29 feeler: dropped arm ${(staticGap - dropAtRim).toFixed(3)} over the rim teeth, need ${CLEAR_MARGIN} — the banking stop's travel is too generous`);
  if (ALARM_TRACK_TOP - ALARM_PIN_DROP <= ALARM_DISC_TOP)
    console.warn('§29 feeler: the dropped pin would bottom in the notch — the stop, not the disc, must take the landing');
}

// §29 step 2 corridor — every wall the branch threads, asserted with the
// achieved and required numbers (the §25 C discipline):
{
  const mwc = { x: P.dial.x - MW_CENTER_D, y: P.dial.y };
  const mwTip = (MW_MODULE_1 * MW_MINUTE_TEETH) / 2 + 1.25 * MW_MODULE_1;
  const i1bTip = (ALARM_BRANCH_MODULE * ALARM_SET_I1_TEETH) / 2 + 1.25 * ALARM_BRANCH_MODULE;
  const rimTip = (ALARM_BRANCH_MODULE * ALARM_DISC_TEETH) / 2 + 1.25 * ALARM_BRANCH_MODULE;
  const say = (nm, clr) => { if (clr < CLEAR_MARGIN) console.warn(`§29 branch ${nm}: clearance ${clr.toFixed(2)}, need ${CLEAR_MARGIN}`); };
  // i1b's swept tips vs the minute-wheel circle — XY only matters if the z
  // bands touch; they are separated by the chain, so assert THAT instead:
  const mwTopL = MW_Z1 + 0.8 / 2 + Math.min(0.8 * 0.18, MW_MODULE_1 * 0.22);
  if (ALARM_DISC_BOT - mwTopL < CLEAR_MARGIN - 1e-9)
    console.warn(`§29 branch: band gears' underside ${ALARM_DISC_BOT.toFixed(2)} inside the minute wheel's margin (top ${mwTopL.toFixed(2)})`);
  // i1b vs the minute-wheel circle in ITS OWN plane (the sleeve crosses nothing, but the tips do XY-wise at other azimuths — z-separated; the real XY bind is the RIM):
  say('i1 sleeve vs minute wheel', Math.hypot(ALARM_SET_I1.x - mwc.x, ALARM_SET_I1.y - mwc.y) - mwTip - 0.62);
  // the rim's tips vs the follower annulus above are z-separated by the
  // chain (asserted at the stack); its one same-plane neighbour is i1b —
  // the declared mesh. Assert the mesh IS closed (pitch sum = distance):
  const closure = Math.abs(Math.hypot(ALARM_SET_I1.x - P.dial.x, ALARM_SET_I1.y - P.dial.y)
    - ALARM_BRANCH_MODULE * (ALARM_SET_I1_TEETH + ALARM_DISC_TEETH) / 2);
  if (closure > 1e-9) console.warn(`§29 branch: i1b⇄rim mesh fails to close by ${closure.toFixed(4)}`);
  // the trip invariance — the whole POINT of the differential, verified
  // numerically: for two different settings, (hour == set) must put the
  // notch at the SAME world azimuth (the release az).
  for (const setRot of [1.0, 4.7]) {
    const aSet = setRot * ALARM_SET_RATIO;
    const hourAtTrip = -aSet;                               // the §25 B trip: mwHourA == tube (−alarmAngle)
    const discRot = hourAtTrip + ALARM_DISC_SIGN * aSet + ALARM_RELEASE_PHASE;
    const notchWorld = Math.PI - discRot;                   // dialFace mirror of the disc-local-az-0 gap
    const err = Math.abs(wrapPi(notchWorld - ALARM_RELEASE_AZ));
    if (err > 1e-9)
      console.warn(`§29 trip invariance: setting ${setRot} puts the notch ${err.toFixed(4)} rad off the release az — the disc law's set sign is wrong`);
  }
}
// The hand: hour-hand profile, a touch shorter so the hour hand can cover it
// completely, and STEEL rather than blued — parked it reads as a shadow of the
// hour hand; split it reads as a distinct, quieter pointer (owner's styling:
// subtle, steel).
// Stacked-hand build: the collet (bore 2.65) passes the hour tube (outer 2.5)
// with running clearance and seats on the alarm tube's annular face (2.6..3.0);
// bossR 3.3 gives it a visible seating lip. See ALARM_HAND_Z for the z budget.
const alarmHand = G.makeHand({ length: HOUR_HAND_LEN - 1.2, kind: 'hour', boreR: 2.65, bossR: 3.3, bossH: 0.8 });
alarmHand.traverse((o) => { if (o.isMesh) o.material = MATS.steel; });
alarmHand.scale.z = 0.5; // flat rattrapante leaf — half the going hands' section (see ALARM_HAND_Z)
alarmHand.position.z = ALARM_HAND_Z;
alarmTubeGroup.add(alarmHand);

// (A §25 C prototype "orbiting train" marker briefly lived here — an
// unlabelled steel lozenge riding between the railroad's rails, driven off
// alarmDiscAngle(). It settled the peripheral-indicator look, then the owner
// chose the CENTRAL RATTRAPANTE alarm hand instead — see the roadmap's §25 C
// design record — so the prototype was removed rather than left as a second,
// contradictory indicator.)

// --- 'Alarm setting arbor' — crown-side arbor + mating bevel ----------------
// §25 C interim: this arbor used to end in the sub-dial pointer; the pointer
// (and its well) are gone — the indicator is the central rattrapante hand.
// The arbor keeps its bevel (the crown still turns it, it still spins in
// tick()) and its dial-ward rod/collar now stand as the takeoff stub for
// stage 3's az-0 setting train to the centre wheel. Its support tolerance to
// the healed dial sheet still holds (collar face 0.25 off the dial plane).
const alarmArborUnit = new THREE.Group();
movement.add(alarmArborUnit);
registerLabel('Alarm setting arbor', alarmArborUnit);
registerExplode(alarmArborUnit, 0, 2, -1); // dial-side link, explodes toward the dial like the reserve train
const alarmRotor = new THREE.Group(); // everything that turns with the disc setting
alarmRotor.position.set(alarmWorld.x, alarmWorld.y, 0);
alarmArborUnit.add(alarmRotor);
// Arbor rod: from just behind the pointer up to the bevel corner (coaxial
// with the well pivot, through the well floor's bore — the same run the
// reserve indicator arbor makes).
// §25 C stage 3: the rod now runs past the old pointer depth down to the
// setting PINION at the gear lane — the arbor's whole reason to exist is to
// deliver the crown's turn into that lane.
const alarmArborEnd = ALARM_SET_Z - ALARM_SET_T / 2; // rod bottoms at the pinion's underside
const alarmArborRod = new THREE.Mesh(
  new THREE.CylinderGeometry(0.4, 0.4, Z_ALARM_CORNER - alarmArborEnd, 10), MATS.steel);
alarmArborRod.rotation.x = Math.PI / 2;
alarmArborRod.position.set(0, 0, (Z_ALARM_CORNER + alarmArborEnd) / 2);
alarmRotor.add(alarmArborRod);
// The setting pinion — overhung on the rod's end in the gear lane, meshing
// the idler. Same module as the whole train (see ALARM_SET_MODULE).
{
  const pin = G.makePinion({ module: ALARM_SET_MODULE, teeth: ALARM_SET_PINION_TEETH, thickness: ALARM_SET_T, material: MATS.steel });
  pin.position.z = ALARM_SET_Z;
  alarmRotor.add(pin);
}
// Lower bearing — §24's collar rode a well-floor bore that no longer exists
// (the well healed when the indicator moved to the centre stack). The honest
// replacement is a small COCK from the base plate: a post one arbor-bearing
// outboard, an arm across, and a bush the rod runs in just above the pinion.
// Static — it lives in the labelled unit but NOT in the rotor.
{
  const u = { x: alarmWorld.x / ALARM_CD, y: alarmWorld.y / ALARM_CD };
  const postXY = { x: alarmWorld.x + u.x * 1.4, y: alarmWorld.y + u.y * 1.4 };
  const BUSH_Z = -6.3; // above the pinion (top −6.70) with clearance to spare
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, -2 - BUSH_Z, 10), MATS.nickel);
  post.rotation.x = Math.PI / 2;
  post.position.set(postXY.x, postXY.y, (-2 + BUSH_Z) / 2);
  alarmArborUnit.add(post);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 0.3), MATS.nickel);
  arm.position.set((postXY.x + alarmWorld.x) / 2, (postXY.y + alarmWorld.y) / 2, BUSH_Z);
  arm.rotation.z = Math.atan2(u.y, u.x);
  alarmArborUnit.add(arm);
  const bush = new THREE.Mesh(ringGeo(0.45, 0.85, 0.3), MATS.nickel);
  bush.position.set(alarmWorld.x, alarmWorld.y, BUSH_Z);
  alarmArborUnit.add(bush);
}
// Disc bevel at the corner, axis −z (its shaft trails down to the pointer).
const discBevel = G.makeBevelGear({ teeth: ALARM_BEVEL_TEETH, module: ALARM_BEVEL_MODULE, faceWidth: ALARM_BEVEL_FACE });
const discBevelMount = new THREE.Group();
discBevelMount.position.set(0, 0, Z_ALARM_CORNER);
discBevelMount.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1));
discBevelMount.add(discBevel);
alarmRotor.add(discBevelMount);
// No detent star. The disc is FRICTION-SET, the way real alarm watches set the
// alarm hand (Vulcain Cricket, JLC Memovox): it holds wherever the crown
// leaves it and is read to the nearest quarter mark on the ring. A 48-tooth
// detent star cannot fit the narrow plate→floor band here without burying
// itself in the (un-swept) base plate, and a friction disc is the more
// authentic mechanism anyway — so the arbor carries only the mating bevel.

// --- 'Alarm crown' — crown + free stem + stem bevel -------------------------
const alarmCrownUnit = new THREE.Group();
movement.add(alarmCrownUnit);
registerLabel('Alarm crown', alarmCrownUnit);
registerExplode(alarmCrownUnit, 0, 2, -1);
const alarmStemAngle = Math.atan2(alarmDir.y, alarmDir.x);
const alarmSpinner = new THREE.Group(); // local +Y = outward along the stem (cf. windSpinner)
alarmSpinner.position.set(alarmWorld.x, alarmWorld.y, Z_ALARM_CORNER);
alarmSpinner.rotation.order = 'ZYX';
alarmSpinner.rotation.z = alarmStemAngle - Math.PI / 2;
alarmCrownUnit.add(alarmSpinner);
// Stem bevel at the inner end (the corner), axis along the stem (local +Y).
const stemBevel = G.makeBevelGear({ teeth: ALARM_BEVEL_TEETH, module: ALARM_BEVEL_MODULE, faceWidth: ALARM_BEVEL_FACE });
stemBevel.rotation.z = ALARM_BEVEL_PHASE; // half-tooth phase so teeth interleave at rest
const stemBevelMount = new THREE.Group();
stemBevelMount.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0));
stemBevelMount.add(stemBevel);
alarmSpinner.add(stemBevelMount);
// Stem: from the corner out to just past the case rim.
// Stem length from the PUSHED-IN rest radius (the climb, ALARM_CD) — the
// spinner slides OUT from there, so basing it on the arbor's outboard radius
// left the knob 5 short, buried against the dial rim (the sweep caught it).
const alarmStemLen = plateR + 2.2 - ALARM_CD;
const alarmStem = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, alarmStemLen, 12), MATS.steel);
alarmStem.position.y = alarmStemLen / 2;
alarmSpinner.add(alarmStem);
// Brand crown (§27), smaller than the winding crown (this stem drives only
// the light alarm disc, so it needs no winding leverage) — the second
// consumer of makeBrandMark's ∞, same enlarged knurl at 4.0/3.4.
const alarmCrownKnob = G.makeCrown({ bodyR: 4.0, bodyH: 3.4, material: MATS.steel });
alarmCrownKnob.rotation.x = -Math.PI / 2; // builder +Z face → outward along +Y
alarmCrownKnob.position.y = alarmStemLen - 0.7;
alarmSpinner.add(alarmCrownKnob);
// Stem bushing — the stem's support at the plate rim (its route to 'plate' in
// the support graph), a bored boss the stem spins through. Static.
{
  const bushDist = plateR - 2;
  const alarmBush = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.5, 10, 20), MATS.nickel);
  alarmBush.rotation.z = alarmStemAngle;
  alarmBush.rotation.y = Math.PI / 2;
  alarmBush.rotation.order = 'ZYX';
  alarmBush.position.set(alarmDir.x * bushDist, alarmDir.y * bushDist, Z_ALARM_CORNER);
  alarmCrownUnit.add(alarmBush);
}

// --- Alarm gong + hammer (BUILT §24) ---------------------------------------
// The ding needs a visible SOURCE. A gong — a fixed steel wire arc mounted on
// the movement's back (three-quarter) plate near the periphery — is struck by
// a hammer on each ding: the sound spatializes to the strike point and the
// gong + hammer glow as it rings. The strike is driven representationally from
// the ding trigger (SND.alarm sets alarmRingStartMs; the hammer animates in
// frame()), the same representational coupling the rest of the movement uses —
// there is no separate alarm mainspring/striking train here (that is the one
// piece of a real alarm this model leaves for later; the hammer is shown, its
// power is not). Placed in the clear UPPER sector of the back (az 45–135°,
// away from the balance/escapement in the lower-right), above the 3/4 plate.
const Z_GONG = 9.6;              // above the 3/4 plate top (8.5), about the balance-cock height (9.4)
const GONG_R = 35;               // arc radius — near the rim (plateR 42.9), inboard of it
const GONG_A0 = 45 * DEG2RAD;    // fixed (foot) end
const GONG_A1 = 135 * DEG2RAD;   // free (ringing) end — the hammer strikes here
const GONG_WIRE_R = 0.5;
// (TQ_TOP_Z — the three-quarter plate's top face — is derived up at the plate
// build; the gong foot and hammer post plant into it.)

const alarmGongUnit = new THREE.Group();
movement.add(alarmGongUnit);
registerLabel('Alarm gong', alarmGongUnit);
registerExplode(alarmGongUnit, 0, 9); // baseZ 0: children carry world z; rises with the back stack on explode
// The gong wire: a partial torus (an arc of round steel wire), coaxial with
// the movement, opening across the top sector.
const gongArc = new THREE.Mesh(new THREE.TorusGeometry(GONG_R, GONG_WIRE_R, 8, 64, GONG_A1 - GONG_A0), MATS.steel);
gongArc.rotation.z = GONG_A0; // a torus arc starts at +x; rotate its start to the foot azimuth
gongArc.position.z = Z_GONG;
alarmGongUnit.add(gongArc);
// Foot: a post from the arc's fixed end down into the 3/4 plate top — the
// gong's ONLY fixing (the far end rings free); its route to the plate.
const gongFoot = { x: Math.cos(GONG_A0) * GONG_R, y: Math.sin(GONG_A0) * GONG_R };
const gongPost = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, Z_GONG - (TQ_TOP_Z - 0.5), 12), MATS.steel);
gongPost.position.set(gongFoot.x, gongFoot.y, (Z_GONG + TQ_TOP_Z - 0.5) / 2);
alarmGongUnit.add(gongPost);

// Emitter for the bell voice — an empty at the strike point (the gong unit's
// own origin is the movement axis, which would mis-spatialize the sound to the
// centre; getWorldPosition of a point AT the ringing end is what we want).
const alarmStrikePt = new THREE.Object3D();
alarmStrikePt.position.set(Math.cos(GONG_A1) * GONG_R, Math.sin(GONG_A1) * GONG_R, Z_GONG);
movement.add(alarmStrikePt);

// The hammer: a tangential lever pivoted just past the gong's free end, its
// head resting a hair outside the ringing end. A small rotation about the
// pivot swings the head radially INTO the wire — the strike. Static post
// (the pivot bearing) + a rotating arm/head.
const HAMMER_PIV_AZ = GONG_A1 + 11 * DEG2RAD; // just beyond the free end, along the arc
const hammerPiv = { x: Math.cos(HAMMER_PIV_AZ) * GONG_R, y: Math.sin(HAMMER_PIV_AZ) * GONG_R };
const alarmHammerUnit = new THREE.Group();
movement.add(alarmHammerUnit);
registerLabel('Alarm hammer', alarmHammerUnit);
registerExplode(alarmHammerUnit, 0, 9); // baseZ 0: children carry world z
// Pivot post down to the plate (static — carries the pivot bearing).
const hammerPost = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, Z_GONG - (TQ_TOP_Z - 0.5), 12), MATS.steel);
hammerPost.position.set(hammerPiv.x, hammerPiv.y, (Z_GONG + TQ_TOP_Z - 0.5) / 2);
alarmHammerUnit.add(hammerPost);
// Pivot group (this is what tick/frame rotates to strike).
const alarmHammerPivot = new THREE.Group();
alarmHammerPivot.position.set(hammerPiv.x, hammerPiv.y, Z_GONG);
alarmHammerUnit.add(alarmHammerPivot);
// Arm from the pivot to the head, resting HEAD_GAP outside the wire at the
// free end. Built in world coords then reparented, so the head lands exactly
// on the ringing end regardless of the pivot azimuth.
const ALARM_HEAD_R = 0.6;
const HAMMER_HEAD_GAP = 0.4; // radial rest gap, head SURFACE → wire outer surface
// Head centre sits gap + head-radius outside the wire, so its surface rests
// HAMMER_HEAD_GAP clear of the wire (a strike closes that gap onto the wire).
const headRestR = GONG_R + GONG_WIRE_R + ALARM_HEAD_R + HAMMER_HEAD_GAP;
const headRest = { x: Math.cos(GONG_A1) * headRestR, y: Math.sin(GONG_A1) * headRestR };
{
  const a = new THREE.Vector3(hammerPiv.x, hammerPiv.y, Z_GONG);
  const b = new THREE.Vector3(headRest.x, headRest.y, Z_GONG);
  const len = a.distanceTo(b);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, len, 10), MATS.steel);
  arm.position.copy(a).add(b).multiplyScalar(0.5).sub(alarmHammerPivot.position);
  arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  alarmHammerPivot.add(arm);
  const head = new THREE.Mesh(new THREE.SphereGeometry(ALARM_HEAD_R, 16, 12), MATS.steel);
  head.position.set(headRest.x - alarmHammerPivot.position.x, headRest.y - alarmHammerPivot.position.y, 0);
  alarmHammerPivot.add(head);
}
// Hammer arm length — the lever the strike amplitude acts on, and the radius
// the TAIL is measured against below. Taken from the built geometry rather
// than restated, so it cannot drift from the arm above.
const ALARM_ARM_LEN = Math.hypot(headRest.x - hammerPiv.x, headRest.y - hammerPiv.y);

// ---------------------------------------------------------------------------
// Alarm striking works (BUILT §25 A) — the power chain behind the hammer.
//
// §24 made the striker spring-powered in LOGIC (a barrel measured in turns,
// draining through a striking phase that stops when it empties) but built none
// of it: the hammer swung and NOTHING VISIBLE drove it, and its swing was a
// sine of the phase rather than anything a part did. This is that geometry —
// an alarm barrel, and a pin (striking) wheel geared off it whose pins lift
// the hammer's tail and drop it onto the gong. The hammer's angle is now
// DERIVED from where a pin is (Rule 2); the barrel's rotation IS its wound
// state; and the two are locked by a real tooth ratio, so the barrel gives up
// exactly the turning the striking train consumes.
//
// Sited on the three-quarter plate's top face in the sector the gong already
// claims — the band outboard-left of the balance is the only part of that face
// with nothing on it. The 3/4-plate top is NOT a swept unit, so every z here
// is measured against TQ_TOP_Z by hand; that blind spot is what buried §24's
// first detent star inside the base plate.
//
// Stage A only. The release feeler/lock (B), the alarm crown's winding clutch
// (C) and the on/off lever + power-flow group (D) are still logic-only.
// ---------------------------------------------------------------------------

// --- The train. One cam lobe = one strike, so the cadence and the tooth
// counts fix each other: strikes per barrel turn = lobes × (barrel teeth /
// pinion teeth). The constraint §25 adds is that the barrel must turn MORE
// THAN A WHOLE REVOLUTION while it rings — below that the unwinding this
// entry exists to SHOW does not read as rotation at all, which was the whole
// complaint. So the barrel's travel is the input and the ring's LENGTH is the
// output, not a chosen number: §24's 6 s was a free constant that no train
// could deliver at this cadence without the barrel creeping through a third
// of a turn.
const ALARM_CAM_LOBES = 4;                     // lifting lobes on the striking wheel — one strike each
const ALARM_TRAIN_MODULE = 0.3;
const ALARM_BARREL_TEETH = 44;
const ALARM_STRIKE_PINION_TEETH = 11;
const ALARM_STRIKE_RATIO = ALARM_BARREL_TEETH / ALARM_STRIKE_PINION_TEETH;        // 4:1 step-up
const ALARM_STRIKES_PER_BARREL_TURN = ALARM_CAM_LOBES * ALARM_STRIKE_RATIO;       // 16 strikes / barrel turn
const ALARM_BARREL_TURNS = 1.75;               // full-wind travel of the barrel (the > 1 turn constraint above)
const ALARM_STRIKES_PER_WIND = ALARM_BARREL_TURNS * ALARM_STRIKES_PER_BARREL_TURN; // 28 strikes
const ALARM_RING_SECONDS = ALARM_STRIKES_PER_WIND * ALARM_STRIKE_GAP;             // ≈ 11.8 s — DERIVED
const ALARM_CAM_LOBE_PITCH = (Math.PI * 2) / ALARM_CAM_LOBES;

// --- Siting. Both arbors stand on studs planted in the plate's top face, the
// way the gong foot and the hammer post already do. The striking wheel goes
// just inboard of the hammer pivot so its pins can reach the tail; the barrel
// then follows at whatever centre distance the MESH dictates, on a bearing
// picked to keep it off the fusee's let-down square (the one other thing
// standing proud of this face).
const ALARM_SW_AZ = 160 * DEG2RAD, ALARM_SW_R = 29;
const alarmSwPos = { x: Math.cos(ALARM_SW_AZ) * ALARM_SW_R, y: Math.sin(ALARM_SW_AZ) * ALARM_SW_R };
const ALARM_TRAIN_CD = ALARM_TRAIN_MODULE * (ALARM_BARREL_TEETH + ALARM_STRIKE_PINION_TEETH) / 2;
const ALARM_BARREL_BEARING = -60 * DEG2RAD;
const alarmBarrelPos = {
  x: alarmSwPos.x + Math.cos(ALARM_BARREL_BEARING) * ALARM_TRAIN_CD,
  y: alarmSwPos.y + Math.sin(ALARM_BARREL_BEARING) * ALARM_TRAIN_CD,
};
const ALARM_BARREL_PITCH_R = ALARM_TRAIN_MODULE * ALARM_BARREL_TEETH / 2;
const ALARM_BARREL_TIP_R = ALARM_BARREL_PITCH_R + ALARM_TRAIN_MODULE * 0.95;   // makeBarrel's toothed wall
// The let-down square is the only other thing standing on this face away from
// the gong sector (barrelArbor's plate-top end, half-diagonal FUSEE_SQ_S/√2).
{
  const d = Math.hypot(alarmBarrelPos.x - P.barrel.x, alarmBarrelPos.y - P.barrel.y);
  const need = ALARM_BARREL_TIP_R + FUSEE_SQ_S * Math.SQRT1_2 + CLEAR_MARGIN;
  if (d < need)
    console.warn(`alarm barrel fouls the fusee let-down square: centres ${d.toFixed(2)} apart, need ${need.toFixed(2)}`);
  const rim = Math.hypot(alarmBarrelPos.x, alarmBarrelPos.y) + ALARM_BARREL_TIP_R;
  if (rim > plateR - CLEAR_MARGIN)
    console.warn(`alarm barrel overhangs the plate rim: reaches ${rim.toFixed(2)}, plate ${plateR.toFixed(2)}`);
}

// --- Z-stack, measured up from the plate's top face. The striking wheel has
// to lie UNDER the barrel: a pinion always sits closer to its wheel than the
// wheel's own tip radius, so the cam unavoidably passes OVER the barrel and
// the two can only be separated in z. The cam therefore runs low, straddling
// the hammer tail's plane so the tail's nose can ride its rim, and the barrel
// rides above it on the same arbor line.
const ALARM_TAIL_T = 0.5;                              // tail bar thickness, centred on the gong plane
const ALARM_CAM_T = 0.8;                               // cam thickness — straddles the tail
const ALARM_CAM_Z0 = Z_GONG - ALARM_CAM_T / 2;
const ALARM_CAM_Z1 = Z_GONG + ALARM_CAM_T / 2;
const ALARM_BARREL_H = 1.3;
const ALARM_BARREL_Z0 = ALARM_CAM_Z1 + CLEAR_MARGIN;   // barrel clears the cam's top face
const ALARM_BARREL_Z = ALARM_BARREL_Z0 + ALARM_BARREL_H / 2;
const ALARM_PINION_T = 1.0;                            // meshes inside the barrel's toothed wall band
if (ALARM_CAM_Z0 < TQ_TOP_Z + CLEAR_MARGIN)
  console.warn(`alarm cam underside ${ALARM_CAM_Z0.toFixed(2)} fouls the plate top ${TQ_TOP_Z.toFixed(2)} — the plate is not a swept unit, so nothing else will catch this`);

// --- Cam ⇄ tail linkage -----------------------------------------------------
// The hammer grows a TAIL on the far side of its pivot, ending in a nose that
// rides the striking wheel. The wheel carries a LIFTING CAM, not pins, and
// that choice is the one real departure from §25's sketch — worth stating,
// because the sketch's pin wheel was tried first and does not work here.
//
// A pin lifts the tail by sliding OUT along its face and letting go at the
// tip; the hammer then falls, and its face sweeps straight back down through
// where the pin still is. The pin only escapes radially, at about 1.7 units
// per radian of wheel, while the hammer falls its whole draw in a fifth of a
// pin pitch — measured, the tail buried itself 0.21–0.47 into the pin it had
// just released, and no amount of thinner pins, slower fall or tip relief got
// that under a tenth of that. The escape only becomes clean when the tail
// crosses the pin circle steeply, and steep crossing and small draw are the
// SAME parameter: getting a clean release needs ≈ 60° of hammer swing, and
// §24's hammer rests 0.4 off a gong on a 7-unit arm. So the pin wheel and
// this hammer are incompatible, and the honest fix is the mechanism that does
// not need an escape at all.
//
// A cam and follower never lose contact on the rise, so nothing can bury
// itself: the nose sits ON the profile, by construction. The profile is
// generated FROM the lift law (which is how cams are really designed, not the
// other way round), the flank then DROPS away in a fraction of the pitch, and
// the hammer — now standing on nothing — falls under its own spring. That
// free fall is the strike, and the cam is already far below it.
const ALARM_TAIL_LEN = 6.5;            // pivot → nose
const ALARM_TAIL_W = 0.5;
const ALARM_CAM_RISE_FRAC = 0.62;      // of a lobe pitch: the driven rise
const ALARM_CAM_DROP_FRAC = 0.06;      // the flank falls away this fast — far faster than the hammer follows
const ALARM_CAM_APPROACH_FRAC = 0.06;  // base circle → the radius that first touches the resting nose
// The lift itself. A hammer released just above the gong TAPS; one released
// well above it strikes, and that difference is the only reason a striking
// train bothers to lift at all. So the draw is set AGAINST the strike swing
// rather than picked: three times the swing the head has to make to reach the
// wire from rest, which is also what makes the wind-up read on screen as the
// cause of the blow instead of as a wobble.
const ALARM_DRAW_RAD = 3 * ALARM_STRIKE_AMP;
// Where the tail rests. Measured out from the pivot⇄wheel bearing: the larger
// this is, the further the nose sits from the wheel's centre and the bigger
// the cam has to be. 12° gives a base circle of ≈3.3 rising to lobe tips at
// ≈5.0 — big enough to clear the arbor sleeve inside it, small enough that
// the tips stay well inboard of the gong. Both ends are asserted below.
const ALARM_TAIL_REST_GAMMA = 12 * DEG2RAD;
const _pivToSw = { x: alarmSwPos.x - hammerPiv.x, y: alarmSwPos.y - hammerPiv.y };
const ALARM_PIV_SW_D = Math.hypot(_pivToSw.x, _pivToSw.y);
const ALARM_SW_BEARING = Math.atan2(_pivToSw.y, _pivToSw.x); // pivot → wheel
const ALARM_TAIL_REST_AZ = ALARM_SW_BEARING + ALARM_TAIL_REST_GAMMA;
// The nose's position, and how far it stands from the wheel's centre — which
// IS the cam radius under it, because the follower is a knife edge (a nose,
// not a roller: a roller would need the profile offset along its own normal,
// and the point follower makes profile and kinematics the same curve).
const alarmNoseAt = (th) => ({
  x: hammerPiv.x + ALARM_TAIL_LEN * Math.cos(ALARM_TAIL_REST_AZ + th),
  y: hammerPiv.y + ALARM_TAIL_LEN * Math.sin(ALARM_TAIL_REST_AZ + th),
});
const alarmCamRadiusAt = (th) => {
  const n = alarmNoseAt(th);
  return Math.hypot(n.x - alarmSwPos.x, n.y - alarmSwPos.y);
};
// The cam is cut away below the STRIKE position, so the nose is clear of it
// through the whole free swing and the hammer is stopped by the gong — never
// by the wheel it has just left.
const ALARM_CAM_BASE_R = alarmCamRadiusAt(-ALARM_STRIKE_AMP) - CLEAR_MARGIN;
const ALARM_CAM_PICKUP_R = alarmCamRadiusAt(0);        // radius that first meets the resting nose
const ALARM_CAM_TIP_R = alarmCamRadiusAt(ALARM_DRAW_RAD);
// The hammer's angle. Driven on the rise (the nose is on the flank and has
// no choice), free after the drop.
const ALARM_FREE_FRAC = 1 - ALARM_CAM_RISE_FRAC;
const ALARM_FREE_S = ALARM_FREE_FRAC * ALARM_STRIKE_GAP;
const ALARM_FALL_S = ALARM_FREE_S / 3;
const ALARM_HAMMER_W = Math.acos(-ALARM_STRIKE_AMP / ALARM_DRAW_RAD) / ALARM_FALL_S; // reaches the wire exactly at ALARM_FALL_S
const ALARM_HAMMER_DECAY = Math.log(20) / (ALARM_FREE_S - ALARM_FALL_S);             // rebound down to 5% by the next pickup
const ALARM_STRIKE_U = ALARM_FALL_S / ALARM_STRIKE_GAP;  // phase fraction at which the head meets the wire
const ALARM_PHASE_REST = -ALARM_CAM_RISE_FRAC;           // frac = 1 − rise ⇒ the instant a rise begins ⇒ lift 0
function alarmHammerAngle() {
  const u = alarmStrikePhase - Math.floor(alarmStrikePhase);
  if (u >= ALARM_FREE_FRAC)  // on the flank: the profile says where the hammer is
    return ALARM_DRAW_RAD * smoothstep((u - ALARM_FREE_FRAC) / ALARM_CAM_RISE_FRAC);
  // Free swing. The train has let go, so this is not a gear ratio and must not
  // pretend to be one: the hammer falls under its own spring, the wire stops
  // it dead at the strike angle (that impact IS the ding — the energy goes
  // into the gong), and it rebounds to its check.
  const t = u * ALARM_STRIKE_GAP;
  if (t < ALARM_FALL_S) return ALARM_DRAW_RAD * Math.cos(ALARM_HAMMER_W * t);
  const r = t - ALARM_FALL_S;
  return -ALARM_STRIKE_AMP * Math.cos(ALARM_HAMMER_W * r) * Math.exp(-ALARM_HAMMER_DECAY * r);
}
// The cam profile, GENERATED from that lift law. For each instant of the rise:
// put the nose where the law says, then record where that lands in the wheel's
// own turning frame. The result is the curve the nose traces across the wheel
// — which is exactly the flank that has to be there for the law to hold.
const ALARM_CAM_RISE_PTS = (() => {
  const pts = []; // { psi, r } in the wheel's own frame
  const N = 240;  // fine enough that the extruded polyline's chords stay inside the budget
  for (let i = 0; i <= N; i++) {
    const s = i / N;                                   // 0 = pickup, 1 = release
    const th = ALARM_DRAW_RAD * smoothstep(s);
    const n = alarmNoseAt(th);
    const wheelRot = ALARM_CAM_RISE_FRAC * (1 - s) * ALARM_CAM_LOBE_PITCH; // release at 0
    pts.push({
      psi: Math.atan2(n.y - alarmSwPos.y, n.x - alarmSwPos.x) - wheelRot,
      r: Math.hypot(n.x - alarmSwPos.x, n.y - alarmSwPos.y),
    });
  }
  return pts; // psi is already the wheel's OWN angle — do not re-zero it (see below)
})();
// The cam angle a release happens at. The generated psi above is measured in
// the wheel's turning frame with the release at wheel angle 0, which is
// exactly what alarmStrikeWheelAngle() produces at a whole strike — so this
// is where the lobe tip must actually be CUT, and re-zeroing the profile on
// it (the obvious tidy-up) puts every lobe a full radian away from the nose
// that is supposed to ride it.
const ALARM_CAM_TIP_PSI = ALARM_CAM_RISE_PTS[ALARM_CAM_RISE_PTS.length - 1].psi;
// The tail's TRAILING nose. Its length only has to keep the back corner out of
// the flank; the front (wheel-facing) side is a different problem and is
// handled by the taper below.
const ALARM_NOSE_LEN = 0.25;
if (ALARM_CAM_BASE_R < 0.75 + CLEAR_MARGIN)
  console.warn(`alarm cam base circle ${ALARM_CAM_BASE_R.toFixed(2)} does not clear the arbor sleeve (0.75)`);
if (ALARM_PIV_SW_D - ALARM_CAM_TIP_R < 0.6 + CLEAR_MARGIN)
  console.warn(`alarm cam tip ${ALARM_CAM_TIP_R.toFixed(2)} fouls the hammer's pivot post — centres ${ALARM_PIV_SW_D.toFixed(2)} apart`);
if (ALARM_CAM_RISE_FRAC + ALARM_CAM_DROP_FRAC + ALARM_CAM_APPROACH_FRAC >= 1)
  console.warn('alarm cam: rise + drop + approach exceed a lobe pitch — the lobes overlap');
if (!(ALARM_DRAW_RAD > ALARM_STRIKE_AMP))
  console.warn(`alarm hammer draw ${ALARM_DRAW_RAD.toFixed(3)} does not clear the strike swing ${ALARM_STRIKE_AMP}`);

// --- 'Alarm hammer' gains its tail ------------------------------------------
// Same pivot group as the arm and head, on the far side: the lever the cam
// actually lifts. Its shape is not decoration — it is the second thing the
// penetration budget caught. A parallel bar ending in a symmetric nose buries
// its WHEEL-FACING shoulder 0.36 into the rising flank, because that shoulder
// stands closer to the wheel's centre than the tip does while the flank under
// it is already higher. So the whole wheel-facing side TAPERS from full width
// at the pivot to nothing at the point: every part of that edge then lies
// further from the wheel than the point does, and the point is the only thing
// that can touch. The trailing side keeps its section for stiffness.
// Built at the tail's REST azimuth in the pivot's own frame, so the group's
// rotation carries it exactly as it carries the head.
{
  const h = ALARM_TAIL_W / 2, L = ALARM_TAIL_LEN, nose = ALARM_NOSE_LEN;
  const shape = new THREE.Shape();
  shape.moveTo(0, -h);           // wheel-facing edge: one straight taper, pivot → point
  shape.lineTo(L, 0);            // the point — the only part that touches the cam
  shape.lineTo(L - nose, h);
  shape.lineTo(0, h);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: ALARM_TAIL_T, bevelEnabled: false, curveSegments: 2 });
  geo.translate(0, 0, -ALARM_TAIL_T / 2);
  const tail = new THREE.Mesh(geo, MATS.steel);
  tail.name = 'alarmTail'; // selected by name for the nose⇄cam penetration budget
  tail.rotation.z = ALARM_TAIL_REST_AZ;
  alarmHammerPivot.add(tail);
}
// The hammer post already stands to the gong plane and the tail sits in that
// same plane, so nothing about the post changes. (Kept explicit because a
// later stage that moves the tail off the gong plane must raise it.)

// --- 'Alarm striking wheel' — lifting cam + its pinion on a bearing stud -----
const alarmStrikeUnit = new THREE.Group();
movement.add(alarmStrikeUnit);
registerLabel('Alarm striking wheel', alarmStrikeUnit);
registerExplode(alarmStrikeUnit, 0, 9); // baseZ 0: children carry world z, like the gong and hammer
{
  // Static bearing stud, planted 0.5 into the plate top (the gong post's idiom)
  // and carrying the rotor's bore all the way up to the pinion.
  const studTop = ALARM_BARREL_Z + ALARM_PINION_T / 2 + 0.3;
  const studBase = TQ_TOP_Z - 0.5;
  const stud = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, studTop - studBase, 12), MATS.steel);
  stud.rotation.x = Math.PI / 2;
  stud.position.set(alarmSwPos.x, alarmSwPos.y, (studTop + studBase) / 2);
  alarmStrikeUnit.add(stud);
}
const alarmStrikeRotor = new THREE.Group(); // everything that turns with the striking train
alarmStrikeRotor.position.set(alarmSwPos.x, alarmSwPos.y, 0);
alarmStrikeUnit.add(alarmStrikeRotor);
{
  // The cam. One lobe per strike: base-circle dwell (the nose floats clear
  // above it through the strike and rebound), a short approach up to the
  // radius that meets the resting nose, the GENERATED rise, then the drop.
  const shape = new THREE.Shape();
  const rise = ALARM_CAM_RISE_PTS;
  const pitch = ALARM_CAM_LOBE_PITCH;
  const riseSpan = ALARM_CAM_TIP_PSI - rise[0].psi;    // pickup → release, in cam angle
  const dropSpan = ALARM_CAM_DROP_FRAC * pitch;
  const approachSpan = ALARM_CAM_APPROACH_FRAC * pitch;
  const pts = [];
  for (let k = 0; k < ALARM_CAM_LOBES; k++) {
    const lobe = k * pitch;                            // this lobe's copy of the generated flank
    const tip = lobe + ALARM_CAM_TIP_PSI;              // where its release is cut
    // Base-circle dwell, from the end of the previous lobe's drop round to
    // this lobe's approach. The nose floats above it through strike + rebound.
    const dwellFrom = tip - pitch + dropSpan;
    const dwellTo = tip - riseSpan - approachSpan;
    const nDwell = Math.max(2, Math.round((dwellTo - dwellFrom) / 0.05));
    for (let i = 0; i <= nDwell; i++) {
      const a = dwellFrom + (dwellTo - dwellFrom) * (i / nDwell);
      pts.push([Math.cos(a) * ALARM_CAM_BASE_R, Math.sin(a) * ALARM_CAM_BASE_R]);
    }
    // Approach ramp up to the radius that first meets the resting nose.
    for (let i = 1; i <= 6; i++) {
      const f = i / 6, a = dwellTo + approachSpan * f;
      const r = ALARM_CAM_BASE_R + (ALARM_CAM_PICKUP_R - ALARM_CAM_BASE_R) * smoothstep(f);
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    // The generated flank, in its own angles.
    for (const p of rise) pts.push([Math.cos(lobe + p.psi) * p.r, Math.sin(lobe + p.psi) * p.r]);
    // The drop, straight back to the base circle.
    for (let i = 1; i <= 6; i++) {
      const f = i / 6, a = tip + dropSpan * f;
      const r = ALARM_CAM_TIP_R + (ALARM_CAM_BASE_R - ALARM_CAM_TIP_R) * f;
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }
  shape.moveTo(pts[0][0], pts[0][1]);
  for (const [x, y] of pts.slice(1)) shape.lineTo(x, y);
  shape.closePath();
  const bore = new THREE.Path();
  bore.absarc(0, 0, 0.8, 0, Math.PI * 2, true);
  shape.holes.push(bore);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: ALARM_CAM_T, bevelEnabled: false, curveSegments: 2 });
  geo.translate(0, 0, -ALARM_CAM_T / 2);
  const cam = new THREE.Mesh(geo, MATS.brass);
  cam.name = 'alarmCam'; // selected by name for the nose⇄cam penetration budget
  cam.position.z = Z_GONG;
  alarmStrikeRotor.add(cam);
  // Sleeve up to the pinion, and the pinion itself in the barrel's tooth band.
  const sleeveZ0 = ALARM_CAM_Z1, sleeveZ1 = ALARM_BARREL_Z - ALARM_PINION_T / 2;
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, sleeveZ1 - sleeveZ0, 16), MATS.steel);
  // §25 B: the LOCK COLLAR — a smooth braking surface under the cam that the
  // lock lever's pad bears on when the train is held. Smooth, not notched: a
  // partial wind can park the train at ANY phase (the winding lockstep), so
  // the hold is a friction brake — the stop-lever-on-balance-rim precedent.
  const lockCollar = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 0.30, 32), MATS.steel);
  lockCollar.name = 'alarmLockCollar';
  lockCollar.rotation.x = Math.PI / 2;
  lockCollar.position.z = 8.83; // world (the rotor sits at z 0): band 8.68..8.98 — 0.17 over the plate top, 0.22 under the cam
  alarmStrikeRotor.add(lockCollar);
  sleeve.rotation.x = Math.PI / 2;
  sleeve.position.z = (sleeveZ0 + sleeveZ1) / 2;
  alarmStrikeRotor.add(sleeve);
  const pinion = G.makePinion({
    module: ALARM_TRAIN_MODULE, teeth: ALARM_STRIKE_PINION_TEETH, thickness: ALARM_PINION_T });
  pinion.position.z = ALARM_BARREL_Z;
  alarmStrikeRotor.add(pinion);
}
// Where the striking wheel stands. Lobes repeat every ALARM_CAM_LOBE_PITCH, so
// anchoring the rotation at 0 puts a release at every whole strike — which is
// what alarmHammerAngle's phase split above assumes.
const alarmStrikeWheelAngle = () => -alarmStrikePhase * ALARM_CAM_LOBE_PITCH;

// --- 'Alarm barrel' — the force source, on its own stud ---------------------
const alarmBarrelUnit = new THREE.Group();
movement.add(alarmBarrelUnit);
registerLabel('Alarm barrel', alarmBarrelUnit);
registerExplode(alarmBarrelUnit, 0, 9);
{
  const bossTop = ALARM_BARREL_Z - ALARM_BARREL_H / 2 - 0.2;
  const bossBase = TQ_TOP_Z - 0.5;
  const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, bossTop - bossBase, 16), MATS.nickel);
  boss.rotation.x = Math.PI / 2;
  boss.position.set(alarmBarrelPos.x, alarmBarrelPos.y, (bossTop + bossBase) / 2);
  alarmBarrelUnit.add(boss);
}
const alarmBarrelRotor = new THREE.Group();
alarmBarrelRotor.position.set(alarmBarrelPos.x, alarmBarrelPos.y, ALARM_BARREL_Z);
alarmBarrelUnit.add(alarmBarrelRotor);
{
  // A going barrel: the toothed wall IS the wheel that drives the pinion and
  // the lid's cutaway shows the spring inside. Its arbor runs down into the
  // boss's bore — that engagement is the pivot. NO ratchet or click yet: the
  // wind arrives with stage C's alarm crown, and a click riding round with the
  // barrel would be exactly the kind of display fiction §24 spent its effort
  // deleting.
  const arborH = ALARM_BARREL_H * 2;
  const alarmBarrel = G.makeBarrel({
    radius: ALARM_BARREL_PITCH_R, height: ALARM_BARREL_H, ratchet: false,
    teeth: ALARM_BARREL_TEETH, module: ALARM_TRAIN_MODULE, arborH });
  alarmBarrelRotor.add(alarmBarrel);
  if (ALARM_BARREL_Z - arborH / 2 > ALARM_BARREL_Z - ALARM_BARREL_H / 2 - 0.2)
    console.warn(`alarm barrel arbor stops at ${(ALARM_BARREL_Z - arborH / 2).toFixed(2)}, short of its boss top ${(ALARM_BARREL_Z - ALARM_BARREL_H / 2 - 0.2).toFixed(2)} — no pivot engagement`);
}

// ---------------------------------------------------------------------------
// 'Alarm winding train' (§25 C) — the crown's path to the barrel. Pull the
// alarm crown and its sliding bevel lands on the CLIMB ARBOR's contrate (one
// crown throw outboard of the setting corner — the pull IS the clutch); the
// climb rises through both plates (its bores are its bearings: the base
// plate's at −2..0, a jeweled pivot in the three-quarter plate at 7.7..8.5)
// to a pinion in the barrel's own tooth band, where two idlers cross the
// EMPTY upper-plate lane (vertex-probed clear at z 10.1..11.6 along the whole
// run) to the barrel rim. Idler counts drop out: crown → barrel is
// pinion/barrel = 12/44, so a full wind (1.75 turns) is ~6.4 crown turns.
//
// The whole train's VISUAL pose derives rigidly from the BARREL angle — so
// while the alarm RINGS, the train (and a pulled-out crown) visibly free-
// spins backward, which is what rigid meshing honestly implies (the classic
// behaviour of real alarm crowns). A crown turned backward free-slips at the
// stem⇄contrate bevel without unbanking — the same convention the time
// crown's ratchet documents ("only what actually banked moves the wheel").
// No click is modelled: in §25 A's single-member barrel (rotation IS wound
// state) a barrel click would block the ring itself; the hold is stage B's
// striking-wheel lock. The two-member (arbor + shell) split that earns a real
// click is filed as debt.
// ---------------------------------------------------------------------------
const ALARM_WIND_PINION_TEETH = 12;
const ALARM_WIND_IDLER_TEETH = 51; // sized so the 3-mesh chain (with a small dogleg) spans the SHORTER inner-climb → barrel run
const ALARM_WIND_RATIO = ALARM_WIND_PINION_TEETH / ALARM_BARREL_TEETH; // barrel turns per crown turn
const alarmWindUnit = new THREE.Group();
movement.add(alarmWindUnit);
registerLabel('Alarm winding train', alarmWindUnit);
registerExplode(alarmWindUnit, 0, 9); // rides with the back stack, like the striking works
// Idler centres: i1 at its mesh distance from the climb along the line toward
// the barrel; i2 by two-circle intersection (radii: mesh distances to i1 and
// to the barrel), +y solution — the small dogleg that absorbs the 0.2 slack
// between the chain's link lengths and the straight span.
const _wc = { x: ALARM_WIND_X, y: ALARM_WIND_Y };
const _wSpan = Math.hypot(alarmBarrelPos.x - _wc.x, alarmBarrelPos.y - _wc.y);
const _wu = { x: (alarmBarrelPos.x - _wc.x) / _wSpan, y: (alarmBarrelPos.y - _wc.y) / _wSpan };
const _wd1 = ALARM_TRAIN_MODULE * (ALARM_WIND_PINION_TEETH + ALARM_WIND_IDLER_TEETH) / 2;  // climb ⇄ i1
const _wd2 = ALARM_TRAIN_MODULE * (ALARM_WIND_IDLER_TEETH + ALARM_WIND_IDLER_TEETH) / 2;   // i1 ⇄ i2
const _wd3 = ALARM_TRAIN_MODULE * (ALARM_WIND_IDLER_TEETH + ALARM_BARREL_TEETH) / 2;       // i2 ⇄ barrel rim
const alarmWindI1 = { x: _wc.x + _wu.x * _wd1, y: _wc.y + _wu.y * _wd1 };
const alarmWindI2 = (() => {
  // circles: centre alarmWindI1 radius _wd2; centre alarmBarrelPos radius _wd3
  const dx = alarmBarrelPos.x - alarmWindI1.x, dy = alarmBarrelPos.y - alarmWindI1.y;
  const d = Math.hypot(dx, dy);
  const a = (_wd2 * _wd2 - _wd3 * _wd3 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, _wd2 * _wd2 - a * a));
  const mx = alarmWindI1.x + (a * dx) / d, my = alarmWindI1.y + (a * dy) / d;
  return { x: mx - (h * dy) / d, y: my + (h * dx) / d }; // +y-side solution — the lane probe covered this side
})();
if (Math.hypot(alarmWindI2.x - alarmBarrelPos.x, alarmWindI2.y - alarmBarrelPos.y) - _wd3 > 1e-6)
  console.warn('alarm winding chain: i2 failed to close on the barrel mesh distance');
{
  // Climb arbor: contrate at the stem plane, rod through both plate bores,
  // pinion up in the barrel's tooth band.
  const climb = new THREE.Group();
  climb.position.set(ALARM_WIND_X, ALARM_WIND_Y, 0);
  alarmWindUnit.add(climb);
  const rodTop = ALARM_BARREL_Z + 0.4;
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, rodTop - Z_ALARM_CORNER, 12), MATS.steel);
  rod.rotation.x = Math.PI / 2;
  rod.position.z = (rodTop + Z_ALARM_CORNER) / 2;
  climb.add(rod);
  const contrate = G.makeBevelGear({ teeth: ALARM_BEVEL_TEETH, module: ALARM_BEVEL_MODULE, faceWidth: ALARM_BEVEL_FACE });
  contrate.traverse((o) => { if (o.isMesh) o.name = 'alarmWindContrate'; }); // §29 step 4: the pawl budget selects this by name
  const cMount = new THREE.Group();
  cMount.position.z = Z_ALARM_CORNER;
  cMount.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1));
  cMount.add(contrate);
  climb.add(cMount);
  const pin = G.makePinion({ module: ALARM_TRAIN_MODULE, teeth: ALARM_WIND_PINION_TEETH, thickness: 0.8, material: MATS.steel });
  pin.position.z = ALARM_BARREL_Z;
  climb.add(pin);
  alarmWindUnit.userData.climb = climb;
  // Idlers: brass wheels on plate-top studs, spinning in the barrel's band.
  const mkIdler = (pos) => {
    const spin = new THREE.Group();
    spin.position.set(pos.x, pos.y, ALARM_BARREL_Z);
    const w = G.makeGear({ module: ALARM_TRAIN_MODULE, teeth: ALARM_WIND_IDLER_TEETH, thickness: 0.8, boreR: 0.5, spokes: 4, material: MATS.brass });
    w.rotation.z = Math.PI / ALARM_WIND_IDLER_TEETH;
    spin.add(w);
    alarmWindUnit.add(spin);
    const stud = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, ALARM_BARREL_Z + 0.3 - (TQ_TOP_Z - 0.5), 10), MATS.steel);
    stud.rotation.x = Math.PI / 2;
    stud.position.set(pos.x, pos.y, (ALARM_BARREL_Z + 0.3 + TQ_TOP_Z - 0.5) / 2);
    alarmWindUnit.add(stud);
    return spin;
  };
  alarmWindUnit.userData.i1 = mkIdler(alarmWindI1);
  alarmWindUnit.userData.i2 = mkIdler(alarmWindI2);
}

// ---------------------------------------------------------------------------
// 'Alarm lock' + 'Alarm switch' (§25 B + D) — the hold and the on/off.
//
// B: a brake lever on the plate top whose pad bears on the smooth lock collar
// under the striking cam — the hold that alarmReleased has embodied as a flag
// since §24. Released, it swings clear and the train runs. The RELEASE is the
// rattrapante follower itself (§25's convergence): armed, the nose drops into
// the heart's notch exactly when the hour hand reaches the alarm hand, and
// tick() now derives the trip from that ANGLE alignment rather than §24's
// seconds-space comparison. The physical rod from the centre follower up to
// this lever is NOT modelled — declared in MECH_GRAPH.todo, the same
// representational-coupling convention handSetOffset carries.
//
// D: a two-position slide whose nose bears on the lock lever's tail — OFF it
// holds the brake pressed regardless of the feeler, ON it backs away and the
// lock answers to the release. btn-alarm drives the slide; the slide is the
// visible on/off.
//
// Geometry derived like the follower's: the pivot stands d from the wheel
// axis, the arm reaches L, and the engaged angle comes from the (pivot, axis,
// pad) triangle — tick() lifts by LOCK_LIFT about the same pivot.
// ---------------------------------------------------------------------------
const ALARM_LOCK_D = 7.0;                       // pivot → striking-wheel axis
const ALARM_LOCK_L = 5.0;                       // pivot → pad centre
const ALARM_LOCK_PAD_R = 0.3;
const ALARM_LOCK_LIFT = 0.085;                  // rad — ~0.4 of radial air at the collar when released
const ALARM_LOCK_Z = 8.83;                      // shared band with the collar (8.68..8.98)
const alarmLockPivot = (() => {
  const a = 160 * DEG2RAD;                      // outboard-left of the striking wheel — probed clear
  return { x: alarmSwPos.x + Math.cos(a) * ALARM_LOCK_D, y: alarmSwPos.y + Math.sin(a) * ALARM_LOCK_D };
})();
// Engaged arm angle: pad centre sits at collar radius + pad radius from the
// wheel axis; law of cosines at the pivot, same construction as the follower.
const _lockAzAxis = Math.atan2(alarmSwPos.y - alarmLockPivot.y, alarmSwPos.x - alarmLockPivot.x);
const _lockDon = 3.2 + ALARM_LOCK_PAD_R;
const ALARM_LOCK_THETA = Math.acos(clamp(
  (ALARM_LOCK_D * ALARM_LOCK_D + ALARM_LOCK_L * ALARM_LOCK_L - _lockDon * _lockDon)
  / (2 * ALARM_LOCK_D * ALARM_LOCK_L), -1, 1));
const ALARM_LOCK_ENGAGED = _lockAzAxis + ALARM_LOCK_THETA;

const alarmLockUnit = new THREE.Group();
movement.add(alarmLockUnit);
registerLabel('Alarm lock', alarmLockUnit);
registerExplode(alarmLockUnit, 0, 9);
const alarmLockLever = new THREE.Group();
alarmLockLever.position.set(alarmLockPivot.x, alarmLockPivot.y, ALARM_LOCK_Z);
alarmLockUnit.add(alarmLockLever);
{
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.62, 10), MATS.nickel);
  post.rotation.x = Math.PI / 2;
  post.position.set(alarmLockPivot.x, alarmLockPivot.y, TQ_TOP_Z + 0.31 - 0.01);
  alarmLockUnit.add(post);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(ALARM_LOCK_L, 0.5, 0.28), MATS.steel);
  arm.position.x = ALARM_LOCK_L / 2;
  alarmLockLever.add(arm);
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(ALARM_LOCK_PAD_R, ALARM_LOCK_PAD_R, 0.3, 12), MATS.ruby);
  pad.name = 'alarmLockPad';
  pad.rotation.x = Math.PI / 2;
  pad.position.x = ALARM_LOCK_L;
  alarmLockLever.add(pad);
  // Tail — what the switch's nose bears on.
  const tail = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.5, 0.28), MATS.steel);
  tail.position.x = -1.0; // end at 1.8 from the wheel axis — the old 2.2 corner clipped the ratchet skirt (reach 1.68)
  alarmLockLever.add(tail);
}
const alarmSwitchUnit = new THREE.Group();
movement.add(alarmSwitchUnit);
registerLabel('Alarm switch', alarmSwitchUnit);
registerExplode(alarmSwitchUnit, 0, 9);
// §25 D rev 2 (owner's ask): the switch IS a COLUMN WHEEL — the chronograph
// architecture. The lock lever's TAIL BEAK rides its castellations: beak on a
// COLUMN → the tail is blocked and the brake cannot lift (alarm OFF); beak
// over a GAP → the lever answers to the release (alarm ON). One actuation
// (the panel button, or tapping the wheel) steps it half a pitch. The wheel
// stands one beak-reach beyond the lever's tail, ON the tail's line, so the
// castellation's radial lift is exactly the tail's press direction.
const ALARM_COL_COLUMNS = 6;
const ALARM_COL_STEP = Math.PI / ALARM_COL_COLUMNS; // half a pitch per actuation
const ALARM_COL_POS = {
  x: alarmLockPivot.x - Math.cos(ALARM_LOCK_ENGAGED) * 3.8,
  y: alarmLockPivot.y - Math.sin(ALARM_LOCK_ENGAGED) * 3.8,
};
// Steel, not blued (owner's finish call), bore 0.30 over a 0.24 stud (0.06
// running clearance — the first build had bore = stud and the post punched
// out through the castellations). Raised so the ratchet skirt clears the
// plate top by a full margin instead of sitting dead on it.
const alarmColumnWheel = G.makeColumnWheel({ columns: ALARM_COL_COLUMNS, baseR: 1.5, baseH: 0.3, colH: 0.55, colInner: 0.95, boreR: 0.30, material: MATS.steel });
const alarmColSpin = new THREE.Group();
alarmColSpin.position.set(ALARM_COL_POS.x, ALARM_COL_POS.y, ALARM_LOCK_Z + 0.22);
// Phase the wheel so the BEAK's azimuth (from the wheel toward the lock tail,
// = ALARM_LOCK_ENGAGED) starts centred on a column: profileAt is written for
// a beak at angle 0, so the spin group carries the beak azimuth and the wheel
// starts at step 0 = column = alarm OFF (the boot default).
alarmColSpin.rotation.z = ALARM_LOCK_ENGAGED;
alarmColSpin.add(alarmColumnWheel);
alarmSwitchUnit.add(alarmColSpin);
{
  // Pivot post: seated 0.3 into the plate, tip ending INSIDE the wheel's bore
  // (9.15, under the base's top face) — a pivot, not a pole through the crown.
  const stud = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.95, 12), MATS.nickel);
  stud.rotation.x = Math.PI / 2;
  stud.position.set(ALARM_COL_POS.x, ALARM_COL_POS.y, 8.675);
  alarmSwitchUnit.add(stud);
}
// The CLICK — the detent arm every real column wheel carries, and the part
// that makes the toggle READ: its rounded nose rides the castellations, so
// each actuation visibly rocks it OUT onto a column (alarm OFF) or drops it
// INTO a gap (ON). Two jobs, one part: the wheel's index (the two stable
// states + the click) and the visible state flag. Its contact azimuth sits a
// whole number of pitches from the lock beak's, so the two always read the
// SAME parity — asserted below, since a phase slip here would show ON while
// gating OFF.
const ALARM_CLICK_AZ = ALARM_LOCK_ENGAGED + 2 * (Math.PI * 2 / ALARM_COL_COLUMNS); // 2 pitches around the wheel
// TANGENTIAL click geometry: the pivot stands one arm-length SIDEWAYS from
// the contact point, so the arm's rotation carries the nose RADIALLY — it
// visibly drops INTO a gap (nose centre 1.30 from the axis) and rides OUT
// onto a column's outer face (1.5 + nose radius = 1.78). The first build's
// radial arm rocked the nose sideways along the ring — and buried it in it.
const ALARM_CLICK_NOSE_R = 0.28;
const ALARM_CLICK_L = 2.0;
const ALARM_CLICK_SEAT = 1.30;                 // nose centre, dropped in a gap
const ALARM_CLICK_OUT = 1.5 + ALARM_CLICK_NOSE_R; // nose centre riding a column
const ALARM_CLICK_SWING = (ALARM_CLICK_OUT - ALARM_CLICK_SEAT) / ALARM_CLICK_L;
const _clickDir = { x: Math.cos(ALARM_CLICK_AZ), y: Math.sin(ALARM_CLICK_AZ) };      // wheel centre → contact
const _clickTan = { x: -_clickDir.y, y: _clickDir.x };
const _clickSeatP = { x: ALARM_COL_POS.x + _clickDir.x * ALARM_CLICK_SEAT, y: ALARM_COL_POS.y + _clickDir.y * ALARM_CLICK_SEAT };
const alarmClickPivot = {
  x: _clickSeatP.x + _clickTan.x * ALARM_CLICK_L,
  y: _clickSeatP.y + _clickTan.y * ALARM_CLICK_L,
};
const alarmClickArm = new THREE.Group();
alarmClickArm.position.set(alarmClickPivot.x, alarmClickPivot.y, ALARM_LOCK_Z + 0.80); // nose in the column band, clear of the base disc
alarmSwitchUnit.add(alarmClickArm);
{
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.15, 10), MATS.nickel);
  post.rotation.x = Math.PI / 2;
  post.position.set(alarmClickPivot.x, alarmClickPivot.y, TQ_TOP_Z + 0.585 - 0.01);
  alarmSwitchUnit.add(post);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(ALARM_CLICK_L, 0.42, 0.3), MATS.steel);
  arm.position.x = -ALARM_CLICK_L / 2; // reaches back toward the seat point
  alarmClickArm.add(arm);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(ALARM_CLICK_NOSE_R, 12, 8), MATS.steel);
  nose.position.x = -ALARM_CLICK_L;
  alarmClickArm.add(nose);
  // Its return spring — the blade that gives the click its snap.
  const blade = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.07, 0.2), MATS.blueSteel);
  blade.position.set(0.8, -0.5, 0);
  blade.rotation.z = 0.35;
  alarmClickArm.add(blade);
}
// Base angle: arm pointing from the pivot at the SEATED nose position; the
// rock (+SWING·colBlock) rotates the nose outward onto the column face.
const ALARM_CLICK_BASE = Math.atan2(_clickSeatP.y - alarmClickPivot.y, _clickSeatP.x - alarmClickPivot.x) + Math.PI;
// THE PUSHER (owner's catch: a cased movement cannot reach a plate-top
// column wheel — chronographs pierce the case here). A capped stem at the
// rim on the wheel's azimuth, OFFSET half a wheel-radius sideways so its
// line passes the ratchet skirt on a chord: the press is tangential, which
// is what turns a ratchet. Its pawl nose rides the skirt; each press is one
// index = half a column pitch. §3's case band will bore for exactly this
// stem. The press animates on EVERY actuation (button, wheel tap, or pusher
// tap) — the pose derives from the same state either way.
const ALARM_PUSH_AZ = Math.atan2(ALARM_COL_POS.y, ALARM_COL_POS.x);
const _pushU = { x: Math.cos(ALARM_PUSH_AZ), y: Math.sin(ALARM_PUSH_AZ) };
const _pushPerp = { x: -_pushU.y, y: _pushU.x };
const ALARM_PUSH_CHORD = 1.15; // lateral offset — the pawl's line grazes the ratchet tangentially
const ALARM_PUSH_TRAVEL = 0.7;
const alarmPusherGroup = new THREE.Group(); // slides along −_pushU on press
const _pushBase = {
  x: ALARM_COL_POS.x + _pushPerp.x * ALARM_PUSH_CHORD,
  y: ALARM_COL_POS.y + _pushPerp.y * ALARM_PUSH_CHORD,
};
alarmPusherGroup.position.set(_pushBase.x, _pushBase.y, ALARM_LOCK_Z + 0.17);
alarmSwitchUnit.add(alarmPusherGroup);
{
  const stemLen = plateR + 2.6 - Math.hypot(_pushBase.x, _pushBase.y) - 1.4;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, stemLen, 10), MATS.steel);
  stem.rotation.z = ALARM_PUSH_AZ - Math.PI / 2; // cylinder +Y → outward along the push azimuth
  stem.position.set(_pushU.x * (1.6 + stemLen / 2), _pushU.y * (1.6 + stemLen / 2), 0);
  alarmPusherGroup.add(stem);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 1.1, 14), MATS.steel);
  cap.name = 'alarmPusherCap';
  cap.rotation.z = ALARM_PUSH_AZ - Math.PI / 2;
  cap.position.set(_pushU.x * (1.6 + stemLen + 0.55), _pushU.y * (1.6 + stemLen + 0.55), 0);
  alarmPusherGroup.add(cap);
  // The pawl — a slim bar at the stem's inner end, nose down at the skirt.
  const pawl = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.3, 0.24), MATS.blueSteel);
  pawl.rotation.z = ALARM_PUSH_AZ;
  pawl.position.set(_pushU.x * 0.85, _pushU.y * 0.85, -0.17); // dropped from the raised axis to the skirt band, clear of the plate
  alarmPusherGroup.add(pawl);
  // Guide boss at the plate rim — the pusher's bearing until §3's case takes over.
  // A vertical torus spans its RING DIAMETER in z (0.48 here) — the first two
  // sizings buried its underside in the plate by forgetting that.
  const boss = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.12, 8, 16), MATS.nickel);
  boss.rotation.z = ALARM_PUSH_AZ; boss.rotation.y = Math.PI / 2; boss.rotation.order = 'ZYX';
  const bossD = plateR - 1.2;
  boss.position.set(
    _pushU.x * bossD + _pushPerp.x * ALARM_PUSH_CHORD,
    _pushU.y * bossD + _pushPerp.y * ALARM_PUSH_CHORD, ALARM_LOCK_Z + 0.17); // on the raised pusher axis — its underside now CLEARS the plate top
  alarmSwitchUnit.add(boss);
}
{
  const gap = ((ALARM_CLICK_AZ - ALARM_LOCK_ENGAGED) % (Math.PI * 2 / ALARM_COL_COLUMNS));
  if (Math.abs(gap) > 1e-9) console.warn(`alarm click phase: contact azimuths differ by a non-integer pitch (${gap.toFixed(4)}) — the flag and the gate would disagree`);
}
// The tail BEAK — the lock lever grows a nose at its tail end, in the column
// band, riding the castellations. Part of the LEVER (it moves with it).
{
  const beak = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.4, 0.4), MATS.steel);
  beak.name = 'alarmSwitchBeak';
  // Plan-depth matters as much as z: the wheel stands 3.8 behind the pivot,
  // so the beak's near face lands at 3.8 − 2.35 = 1.45 from the wheel axis —
  // 0.05 of engagement into the columns' outer face (1.5), not a bar shoved
  // clean through the castellation ring (the owner circled exactly that).
  beak.position.set(-1.85, 0, 0.72);
  alarmLockLever.add(beak);
}

// ---------------------------------------------------------------------------
// Mainspring / barrel winding state — barrelWindTurns is the ACTUAL wound
// position of the barrel arbor (in turns), the same quantity a real ratchet
// wheel's rotation represents. It is incremented by real crown rotation
// through the winding gear path (see tick()) and drained by however much
// movement time actually elapses — nothing else touches it, so there is no
// separate "tension" concept to keep in sync: tension IS this, normalized.
// (This replaces an earlier epoch-based model — "spring was last fully
// wound at time X" — that worked for a single instant full-wind button but
// can't represent incremental winding: shifting the epoch to add reserve
// makes movement time non-monotonic. A real accumulator is the honest fix.)
// ---------------------------------------------------------------------------
const springChild = barrel.getObjectByName('spring');
const RELAX_SECONDS = 30 * 3600; // simulated hours of running per full wind
// Power reserve is MECHANICALLY geared off the barrel: the barrel turns once
// per 8 h, so a 30 h reserve is exactly 3.75 barrel revolutions lock-to-lock.
const RESERVE_BARREL_TURNS = RELAX_SECONDS / (8 * 3600); // = 3.75
let barrelWindTurns = RESERVE_BARREL_TURNS; // starts fully wound
let windAccumTurns = 0; // ratchet/fusee turns actually BANKED by winding (not raw crown input)
// Jumping-minute setting state: the eased displayed offset while the
// jumper is engaged (null when lifted), and the folded-in snap correction
// that keeps the hand from springing back to the raw phase on push-in.
let jumpDisp = null;
let jumpCorr = 0;
// Sound edge-detector state: one "last index" per discrete source (null
// until first observed, so enabling sound mid-run never machine-guns a
// backlog of events).
let sndBeatN = null, sndBeatRaw = null, sndPawlIdx = null, sndDetIdx = null, sndJumpIdx = null;
let sndCrownOut = null, sndHammerHit = false;
let alarmPrevRel = null; // §25 B: previous hour-wheel→alarm-tube angle gap — the trip edge is now the PHYSICAL alignment (the follower dropping into the heart's notch), not §24's seconds comparison
let alarmLockLiftT = 0;  // §25 B: eased brake-lever lift (1 = released, pad clear of the collar)
let alarmColSteps = 0;   // §25 D: column-wheel actuations — parity IS the on/off (odd = gap under the beak = ON)
let alarmColShownA = 0;  // eased wheel angle (transient; the pose path assigns exactly)
let alarmPusherT = 0;    // §25 D: pusher press pulse — 1 at the actuation, spring-back decay
let jumpSnapIdx = null; // written by the quantize block; read by the sound block
let reserveShown = 1; // = tension each frame; kept as its own var for the UI readout

// ---------------------------------------------------------------------------
// Hacking seconds — pulling the crown swings the hacking lever's ruby pad
// onto the balance rim (see the stop lever above). This is modelled as an
// actual contact: the pad's braking force ramps in with the lever's swing
// and damps the BALANCE's own angular rate (balanceRate, below) toward
// zero over roughly a beat, exactly as friction would. Movement time τ is
// then just the running integral of that rate (tauIntegrated) — it is not
// set or frozen directly. balanceRate's target is ALSO gated on the
// mainspring actually having tension (see tick()) — a depleted spring
// stops the balance through the exact same damping, not a separate
// snap-to-formula path, since both are really "the balance ran out of
// something driving it." Because the whole train (escapeAngle, fourthAngle,
// … down to the barrel) is a closed-form function of τ, the escapement lock
// and the gear train's stoppage are a CONSEQUENCE of the balance being
// stalled, not a separately-flagged freeze. Recovering (lever release OR
// rewinding) ramps the rate back toward 1, as the escapement's impulses
// pick the balance back up.
// ---------------------------------------------------------------------------
let fastForward = false;     // fun mode: rip through hours so the fusee chain visibly pays off
let crownOut = false;        // target: is the crown pulled to the setting position?
let crownPullT = 0;          // 0..1 eased stem-slide animation toward crownOut
let leverEngage = 0;         // 0..1 eased lever swing-in (0=clear, 1=pad on rim)
let balanceRate = 1;         // dτ/dt — the balance's own angular rate (1 = free-running)
let tauIntegrated = 0;       // ∫ balanceRate dt — movement time τ's actual source
let lastTickRawT = 0;        // raw simTime as of the previous tick(), for dt

// Persisted state is restored further down, once every state variable it
// writes (crownRotation and the crown vars in particular) has been declared —
// assigning them here would hit the temporal dead zone.
let restoredCamera = null; // camera pose to apply once camera/controls exist
let restoredXray = false;  // plate X-ray toggle, applied once the UI exists
let restoredSound = false; // sound toggle, applied once the UI exists

// A beat (one lock-to-lock swing) is 1/(2·F_BALANCE) ≈ 0.2 s here; contact
// (or running dry) kills the balance's rate within a fraction of that;
// recovery (release, or rewinding) takes it back up over a similar span.
const LEVER_DAMP_TAU = 0.09;    // s — rate decay time constant while decelerating
const LEVER_RELEASE_TAU = 0.11; // s — rate recovery time constant while accelerating

function setCrownOut(out) {
  crownOut = out;
}

// ---------------------------------------------------------------------------
// Crown rotation — the actual user-driven input. windSpinner always spins
// with it (the stem turns regardless of clutch position); which REAL gear
// path receives that rotation depends on the sliding pinion's physical
// position (crownPullT, not the raw crownOut target — see tick()). Each
// path accumulates its OWN share of the rotation (windPathRot / setPathRot)
// only while engaged, so a disengaged path's gears simply hold still
// rather than trying to track rotation they're not mechanically coupled to.
// ---------------------------------------------------------------------------
let crownRotation = 0;     // radians, user input, unbounded, either direction
let lastCrownRotation = 0; // for computing crownRotDelta each tick
let windPathRot = 0;       // accumulated rotation actually delivered to the winding path
let setPathRot = 0;        // accumulated rotation actually delivered to the setting path
let autoWindRemaining = 0; // radians left to auto-turn (Wind button)
const AUTO_WIND_RATE = 48; // rad/s — the Wind button's auto-turn speed

// --- Alarm (BUILT §24) -----------------------------------------------------
// A second, independent crown drives a small alarm disc; the disc's detented
// angle IS the set time (Rule 2 — the target is derived forward from the
// crown through the disc, never written by the UI). alarmCrownRotation is the
// raw drag input, parallel to crownRotation; the disc quantizes it to a
// detent and alarmTargetSeconds() falls out of the detented angle. See the
// derivation beside DIAL_PERIOD_S below and the drive wiring in the pointer
// handlers. Each strike fires SND.alarmStrike, spatialized to the gong.
let alarmOn = false;              // alarm ARMED toggle (the on/off lever's enable)
let alarmTubeShownA = 0;          // §25 C: the alarm tube's DISPLAYED angle — eases home along the cam on disarm (transient, not saved)
let alarmCrownOut = false;        // §25 C winding: alarm crown pulled → WINDING clutch engaged (pushed in = setting, §24's behaviour)
let alarmCrownPullT = 0;          // eased stem slide toward alarmCrownOut — mirror of crownPullT
let alarmSetRot = 0;              // crown rotation banked into the SETTING path (what the hand + target read; holds while winding)
let lastAlarmCrownRotation = 0;   // for routing per-tick crown deltas to whichever path the clutch engages
let alarmCrownRotation = 0;       // radians, raw alarm-crown drag input, unbounded
let alarmEmitter = null;          // the bell voice spatializes to the gong's ringing end
alarmEmitter = alarmStrikePt;     // the strike-point empty built with the gong geometry
// The alarm's own power loop (mirrors the going-train barrel — see tick()):
let alarmBarrelWind = 0;          // alarm-spring energy, in turns — §25 C: ships EMPTY; the alarm must be WOUND to ring (drains while ringing)
let alarmStrikePhase = ALARM_PHASE_REST; // striking-train phase, in strikes (each whole strike = one pin releasing the hammer)
let alarmStrikeIdx = Math.floor(ALARM_PHASE_REST - ALARM_STRIKE_U); // last strike SOUNDED — the ding's edge source
let alarmReleased = false;        // the lock is lifted: the striking train is free to run (set at the trip)
let restoredAlarmOn = false;      // persisted toggle, applied once the UI exists
let restoredQualityMode = 'Auto'; // §14 quality select, applied once the tier plumbing exists

// Load persisted state now that every variable it writes has been declared.
// loadState() is async (the primary store is the dev server's temp file);
// top-level await is fine here — main.js is an ES module.
{
  const savedState = await loadState();
  barrelWindTurns = savedState.barrelWindTurns;
  tauIntegrated = savedState.tauIntegrated;
  crownRotation = savedState.crownRotation;
  // Seed the delta baseline to the restored angle. crownRotDelta in tick() is
  // crownRotation − lastCrownRotation; the restored crownRotation is input
  // ALREADY delivered to the gears last session (and already reflected in the
  // restored barrelWindTurns / hand offset), not new turning. Left at 0, the
  // first tick replays the entire crown history as one positive delta and the
  // winding path (tick(): barrelWindTurns += …) clamps the barrel to full on
  // frame one — which silently re-winds a drained reserve on every reload, and
  // stomps any starting reserve set below full (e.g. the ?reserve= deep link).
  lastCrownRotation = crownRotation;
  jumpCorr = savedState.jumpCorr ?? 0; // ?? — states saved before §9 have no such field
  crownOut = savedState.crownOut;
  fastForward = savedState.fastForward;
  restoredCamera = savedState.camera;
  restoredXray = !!savedState.plateXray;
  restoredSound = !!savedState.soundOn;
  alarmCrownRotation = savedState.alarmCrownRotation ?? 0; // ?? — states saved before §24 have no such field
  // §25 re-derived ALARM_BARREL_TURNS from the striking train, so a state
  // saved under §24's free value (8) would restore an over-wound barrel that
  // rings for minutes. Clamp to what the barrel can actually hold.
  alarmBarrelWind = clamp(savedState.alarmBarrelWind ?? 0, 0, ALARM_BARREL_TURNS); // §25 C: unsaved wind means UNWOUND (the crown exists now)
  restoredAlarmOn = !!savedState.alarmOn;
  alarmSetRot = savedState.alarmSetRot ?? savedState.alarmCrownRotation ?? 0; // pre-winding saves: crown WAS the set path
  lastAlarmCrownRotation = savedState.alarmCrownRotation ?? 0;
  alarmCrownOut = !!savedState.alarmCrownOut;
  restoredQualityMode = savedState.quality ?? 'Auto'; // ?? — states saved before §14 have no such field
}

// ---------------------------------------------------------------------------
// Seconds reset — the SAME crown-pull also closes the reset hammer onto the
// heart cam (see secondsCamArbor/hammerGroup above), driven by the same
// leverEngage as the hacking lever (one setting-lever yoke, two functions,
// exactly as real keyless works commonly gang several actions off one
// motion). Because that cam sits on a friction-slip display arbor rather
// than the real fourth wheel (see the comment above its construction),
// "camming it to zero" is modelled as re-referencing the second hand's zero
// point to the fourth wheel's CURRENT angle, eased in while the hammer is
// closing — visually indistinguishable from a hammer riding the cam down
// to its notch, but it never fights the real (locked) going train. The
// reference stops updating the instant the hammer lifts, so the hand
// resumes counting up from 12 rather than jumping to catch up.
let secondsZeroRef = fourthAt0; // matches the original fixed 12:00:00 reference
let alarmCrownCreep = 0, alarmCrownCreepLastBd = null; // §29 step 2: hour back-drive banked into the pulled crown's shown angle
let alarmPinDropNow = 0; // §29 step 3: the pin's CURRENT drop — a pure function of the disc's angle, recomputed every tick (no reset needed; nothing accumulates)
const CAM_SNAP_TAU = 0.06; // s — faster than the balance's own damping: a
                            // heart cam is a positive mechanical action, not
                            // a soft friction stop, so the reset reads snappier.

// ---------------------------------------------------------------------------
// UI panel (plain injected HTML/CSS)
// ---------------------------------------------------------------------------
const style = document.createElement('style');
style.textContent = `
#clock-ui {
  position: fixed; top: 14px; left: 14px; z-index: 10;
  background: rgba(15,17,20,0.72); backdrop-filter: blur(6px);
  border: 1px solid rgba(255,255,255,0.08); border-radius: 10px;
  padding: 14px 16px; width: 240px; box-sizing: border-box;
  /* Phone fit (BUILT §15): 14px inset top and bottom → 28px total; border-box
     makes calc() size the whole visual box, so the panel stays within a short
     (phone) viewport and scrolls internally rather than running its lower
     controls off-screen. */
  max-height: calc(100vh - 28px); overflow-y: auto;
  font: 12px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #d8dee6; user-select: none;
}
#clock-ui h1 { font-size: 12px; margin: 0 0 10px; letter-spacing: 0.06em; text-transform: uppercase; color: #8fa6bf; font-weight: 600; }
/* Collapsible section (BUILT §15) — a native <details> disclosure so there is
   no JS state to track. Reused wherever the panel needs a labelled, foldable
   group; the disclosure mechanism §23 will reuse lives here. */
#clock-ui .ui-section { border-top: 1px solid rgba(255,255,255,0.08); }
#clock-ui .ui-section:first-of-type { border-top: none; }
#clock-ui .ui-section > summary {
  list-style: none; cursor: pointer; display: flex; align-items: center; gap: 6px;
  padding: 9px 0; margin: 0;
  font-size: 10.5px; letter-spacing: 0.06em; text-transform: uppercase;
  color: #8fa6bf; font-weight: 600;
}
#clock-ui .ui-section > summary::-webkit-details-marker { display: none; }
#clock-ui .ui-section > summary::before {
  content: '▸'; font-size: 9px; color: #6b7683; transition: transform 0.15s;
}
#clock-ui .ui-section[open] > summary::before { transform: rotate(90deg); }
#clock-ui .ui-section > summary:hover { color: #b9cbe0; }
#clock-ui .ui-section-body { padding-bottom: 4px; }
#clock-ui .ui-section-body > .row:first-child { margin-top: 0; }
#btn-hide-ui { position: absolute; top: 10px; right: 12px; padding: 2px 7px !important; font-size: 10px !important; color: #8b95a1 !important; }
#clock-ui-show {
  position: fixed; top: 14px; left: 14px; z-index: 10; display: none;
  background: rgba(15,17,20,0.72); backdrop-filter: blur(6px);
  border: 1px solid rgba(255,255,255,0.14); color: #d8dee6;
  border-radius: 8px; padding: 6px 11px; font: 14px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  cursor: pointer; transition: background 0.15s;
}
#clock-ui-show:hover { background: rgba(255,255,255,0.14); }
#clock-ui .row { display: flex; align-items: center; justify-content: space-between; margin: 8px 0; gap: 8px; }
#clock-ui button {
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.14); color: #e8edf2;
  border-radius: 6px; padding: 5px 9px; font-size: 11px; cursor: pointer; transition: background 0.15s;
}
#clock-ui button:hover { background: rgba(255,255,255,0.14); }
#clock-ui button.active { background: #3a6bd8; border-color: #3a6bd8; }
#clock-ui button:disabled { opacity: 0.35; cursor: not-allowed; }
#clock-ui button#btn-crown.active { background: #c85a3a; border-color: #c85a3a; }
#clock-ui .readout.hacking { color: #ffb454; }
#clock-ui .presets { display: flex; flex-wrap: wrap; gap: 5px; }
#clock-ui input[type=range] { width: 128px; accent-color: #3a6bd8; }
#clock-ui select {
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.14); color: #e8edf2;
  border-radius: 6px; padding: 4px 6px; font-size: 11px; cursor: pointer; max-width: 150px;
}
#clock-ui .tq { flex: 1; max-width: 128px; height: 6px; background: rgba(255,255,255,0.08); border-radius: 3px; overflow: hidden; }
#clock-ui .tq i { display: block; height: 100%; background: #3a6bd8; width: 100%; transition: none; }
#clock-ui .tq i.flat { background: #58b368; }
#clock-ui .readout { font-variant-numeric: tabular-nums; font-size: 15px; color: #f2efe6; letter-spacing: 0.03em; }
#clock-ui .label-small { color: #8b95a1; font-size: 10.5px; }
#clock-labels { position: fixed; inset: 0; pointer-events: none; z-index: 5; }
.clock-label {
  position: absolute; transform: translate(-50%, -140%); font: 11px/1 -apple-system, sans-serif;
  color: #cfe3ff; background: rgba(10,12,15,0.55); padding: 2px 6px; border-radius: 4px;
  white-space: nowrap; border: 1px solid rgba(255,255,255,0.1);
}
#clock-ui .guided-btns { display: flex; gap: 5px; }
#clock-ui button.script-ctrl.active { background: #7a3ad8; border-color: #7a3ad8; }
/* Guided-demo / tour caption (BUILT §5, §17) — the scripted user's narration.
   A single centred banner along the bottom, above the movement, that appears
   only while a script runs and never intercepts pointer input (so any click
   still reaches the canvas and cancels the script). */
#clock-caption {
  position: fixed; left: 50%; bottom: 34px; transform: translateX(-50%);
  z-index: 8; max-width: min(80vw, 640px); text-align: center;
  background: rgba(15,17,20,0.82); backdrop-filter: blur(6px);
  border: 1px solid rgba(255,255,255,0.12); border-radius: 10px;
  padding: 11px 18px; color: #eaf0f7; pointer-events: none;
  font: 14px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  opacity: 0; transition: opacity 0.35s; display: none;
}
#clock-caption.show { opacity: 1; }
/* Tour deep-link confirmation (BUILT §17) — a real click is the ONLY way to
   arrive at the tour when it's auto-triggered by ?tour=1 on load: unlike the
   button, a deep link isn't itself a user gesture, and it shouldn't run the
   camera/crown/sound unattended before the visitor has agreed to it. Opaque
   overlay (unlike the caption, THIS blocks pointer input) until answered. */
#clock-tour-gate {
  position: fixed; inset: 0; z-index: 20; display: none;
  align-items: center; justify-content: center;
  background: rgba(8,9,11,0.55); backdrop-filter: blur(2px);
}
#clock-tour-gate.show { display: flex; }
#clock-tour-gate .box {
  max-width: min(86vw, 420px); text-align: center;
  background: rgba(20,22,26,0.96); border: 1px solid rgba(255,255,255,0.14);
  border-radius: 12px; padding: 22px 26px; color: #eaf0f7;
  font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  box-shadow: 0 12px 40px rgba(0,0,0,0.5);
}
#clock-tour-gate .box p { margin: 0 0 16px; }
#clock-tour-gate .box .row { display: flex; gap: 8px; justify-content: center; }
#clock-tour-gate button {
  font: inherit; padding: 8px 16px; border-radius: 7px; cursor: pointer;
  border: 1px solid rgba(255,255,255,0.16); background: rgba(255,255,255,0.06); color: #e8edf2;
}
#clock-tour-gate button:hover { background: rgba(255,255,255,0.14); }
#clock-tour-gate button.primary { background: #7a3ad8; border-color: #7a3ad8; }
#clock-tour-gate button.primary:hover { background: #8d4ce6; }
`;
document.head.appendChild(style);

const panel = document.createElement('div');
panel.id = 'clock-ui';
// Rows are grouped into collapsible <details> sections (BUILT §15): Time,
// Camera, View, Finish; State is appended later, so the panel fits a short
// viewport. Only Time is open by default. Every original id/class is preserved
// verbatim so the existing querySelector / getElementById wiring is untouched.
panel.innerHTML = `
  <h1>Watch Sim</h1>
  <button id="btn-hide-ui" title="Hide panel (H)">Hide</button>
  <details class="ui-section" open>
    <summary>Time</summary>
    <div class="ui-section-body">
      <div class="row">
        <button id="btn-pause">Pause</button>
        <span class="readout" id="readout-time">00:00:00</span>
      </div>
      <div class="row label-small"><span>Beats</span><span class="readout" id="readout-beats" style="font-size:13px;">0</span></div>
      <div class="row">
        <span class="label-small">Time-scale</span>
        <input type="range" id="scale-slider" min="0" max="1000" step="1" />
      </div>
      <div class="row label-small"><span id="scale-value">1×</span><button id="btn-wind">Wind</button></div>
      <div class="row label-small"><span id="scale-note">5.0 beats/s</span></div>
      <div class="row label-small"><span>Crown</span><button id="btn-crown">Pull out</button></div>
      <div class="row label-small"><span>Sync</span><button id="btn-sync">Now</button></div>
      <div class="row label-small"><span>Power reserve</span><span class="readout" id="reserve-value" style="font-size:13px;">30.0 h</span></div>
      <div class="row label-small"><span>Fast-forward</span><button id="btn-ff">Off</button></div>
      <div class="row label-small"><span>Spring torque</span><span class="tq"><i id="bar-spring"></i></span></div>
      <div class="row label-small"><span>Train torque</span><span class="tq"><i id="bar-train" class="flat"></i></span></div>
    </div>
  </details>
  <details class="ui-section">
    <summary>Camera</summary>
    <div class="ui-section-body">
      <div class="row presets">
        <button data-cam="Escapement">Escapement</button>
        <button data-cam="Train">Train</button>
        <button data-cam="Dial">Dial</button>
        <button data-cam="Setting">Setting</button>
        <button data-cam="Free">Free</button>
      </div>
      <div class="row label-small"><span>Guided</span><span class="guided-btns"><button id="btn-tour" class="script-ctrl">Tour</button><button id="btn-demo" class="script-ctrl">Demo</button></span></div>
    </div>
  </details>
  <details class="ui-section">
    <summary>View</summary>
    <div class="ui-section-body">
      <div class="row">
        <span class="label-small">Exploded view</span>
        <input type="range" id="explode-slider" min="0" max="100" step="1" value="0" />
      </div>
      <div class="row">
        <span class="label-small">Unit</span>
        <select id="explode-unit"><option>All</option></select>
      </div>
      <div class="row">
        <span class="label-small">Labels</span>
        <button id="btn-labels">Off</button>
      </div>
      <div class="row">
        <span class="label-small">Plate X-ray</span>
        <button id="btn-xray">Off</button>
      </div>
      <div class="row">
        <span class="label-small">Power flow</span>
        <button id="btn-powerflow">Off</button>
      </div>
      <div class="row">
        <span class="label-small">Sound</span>
        <button id="btn-sound">Off</button>
      </div>
    </div>
  </details>
  <details class="ui-section">
    <summary>Alarm</summary>
    <div class="ui-section-body">
      <div class="row">
        <span class="label-small">Alarm</span>
        <button id="btn-alarm">Off</button>
      </div>
      <div class="row label-small"><span>Set for</span><span class="readout" id="readout-alarm" style="font-size:13px;">12:00</span></div>
      <div class="row"><span class="label-small">Crown</span><button id="btn-alarm-crown">Pull to set</button></div>
      <div class="row label-small"><span>Alarm wind</span><span class="readout" id="readout-alarm-wind">0%</span></div>
      <div class="row label-small"><span>Turn to wind · pull out + turn to set</span></div>
    </div>
  </details>
  <details class="ui-section">
    <summary>Finish</summary>
    <div class="ui-section-body">
      <div class="row label-small"><span>Light</span><button id="btn-light-mode">Studio</button></div>
      <div class="row">
        <span class="label-small">Hand flute</span>
        <input type="range" id="flute-slider" min="-60" max="30" step="1" />
      </div>
    </div>
  </details>
  <details class="ui-section">
    <summary>Performance</summary>
    <div class="ui-section-body">
      <!-- Frame-time readout (BUILT §14) — the gate every performance change
           is measured against. Ticks/frame makes the fixed-step spiral (more
           tick() work the slower the machine) directly visible. -->
      <div class="row label-small"><span>Frame</span><span class="readout" id="readout-frame" style="font-size:13px;">—</span></div>
      <div class="row label-small"><span>Ticks/frame</span><span class="readout" id="readout-ticks" style="font-size:13px;">0</span></div>
      <div class="row">
        <span class="label-small">Quality</span>
        <select id="quality-select"><option>Auto</option><option>High</option><option>Balanced</option><option>Low</option></select>
      </div>
      <div class="row label-small"><span>Tier</span><span class="readout" id="readout-tier" style="font-size:13px;">High</span></div>
    </div>
  </details>
`;
document.body.appendChild(panel);

// --- panel hide/show -------------------------------------------------------
// "Hide" collapses the whole panel to a small ☰ chip; the chip (or the H key)
// brings it back. Pure display toggling — no state inside the panel is lost.
const showPanelBtn = document.createElement('button');
showPanelBtn.id = 'clock-ui-show';
showPanelBtn.textContent = '☰';
showPanelBtn.title = 'Show control panel (H)';
document.body.appendChild(showPanelBtn);
function setPanelHidden(hidden) {
  panel.style.display = hidden ? 'none' : '';
  showPanelBtn.style.display = hidden ? 'block' : 'none';
}
document.getElementById('btn-hide-ui').addEventListener('click', () => setPanelHidden(true));
showPanelBtn.addEventListener('click', () => setPanelHidden(false));

// While a guided script (Demo/Tour) runs, get the fixed control panel out from
// in front of it on a narrow screen: the panel is 240px wide at a 14px inset
// (a 254px right edge), so on a phone-width viewport it sits on top of the
// horizontally-centred movement and the caption. Collapse it to the ☰ chip for
// the run, then restore whatever the user had before.
//
// Gate on viewport WIDTH alone — NOT pointer type. A phone reports a narrow
// width, but so does a resized desktop window or a device-emulation preview,
// and all three have the identical overlap; an earlier `(pointer: coarse)`
// clause meant the collapse silently no-op'd in exactly those non-touch test
// setups. A desktop window this narrow is just as well served by getting the
// panel out of the way for the run (the ☰ chip brings it right back), and a
// full-width desktop (> the breakpoint) never triggers. 820px ≈ where the
// 240px panel plus a mirror-image right gutter leaves under ~300px of clear
// centre, so below it the overlap is unavoidable.
function isNarrowLayout() {
  return window.matchMedia('(max-width: 820px)').matches;
}
let panelForcedHiddenByScript = false;
function hidePanelForScript() {
  if (!isNarrowLayout()) return;
  if (panel.style.display === 'none') return; // already collapsed by the user — leave it, and claim no restore
  setPanelHidden(true);
  panelForcedHiddenByScript = true;
}
function restorePanelAfterScript() {
  if (!panelForcedHiddenByScript) return;
  panelForcedHiddenByScript = false;
  setPanelHidden(false);
}

// Guided-script caption banner (BUILT §5, §17) — created up front, shown only
// while a scripted user (demo/tour) is running.
const captionEl = document.createElement('div');
captionEl.id = 'clock-caption';
document.body.appendChild(captionEl);

// Tour deep-link confirmation gate (BUILT §17) — see the #clock-tour-gate
// CSS comment above for why this exists. Single-use: the only caller is the
// ?tour=1 deep link, once, at boot.
const tourGateEl = document.createElement('div');
tourGateEl.id = 'clock-tour-gate';
tourGateEl.innerHTML = `
  <div class="box">
    <p>Take a guided tour of the movement?</p>
    <div class="row">
      <button id="tour-gate-skip">Skip</button>
      <button id="tour-gate-go" class="primary">Start Tour</button>
    </div>
  </div>`;
document.body.appendChild(tourGateEl);
function askTour(onProceed) {
  tourGateEl.classList.add('show');
  const goBtn = document.getElementById('tour-gate-go');
  const skipBtn = document.getElementById('tour-gate-skip');
  const finish = (proceed) => {
    tourGateEl.classList.remove('show');
    goBtn.onclick = null;
    skipBtn.onclick = null;
    if (proceed) onProceed();
  };
  goBtn.onclick = () => finish(true);
  skipBtn.onclick = () => finish(false);
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'h' || e.key === 'H') setPanelHidden(panel.style.display !== 'none');
});

// --- Finish: hand flute + lighting -----------------------------------------
// The flute slider re-cuts the hands LIVE: every hand keeps its group (tick
// holds those references and drives their rotations), and only the children
// are swapped for a fresh makeHand build at the new concavity. Lighting
// sliders drive the light objects directly; nothing here is persisted.
{
  const fluteSlider = document.getElementById('flute-slider');
  fluteSlider.value = Math.round((aesthetics.dial.hands.fluteFactor ?? -0.3) * 100);
  const HAND_SPECS = [
    [hourHand, { length: HOUR_HAND_LEN, kind: 'hour' }],
    [minuteHand, { length: MINUTE_HAND_LEN, kind: 'minute' }], // was 0.905R here vs 0.84R at build — a latent flute-slider length jump, now one constant
    [smallSecondsHand, { length: secondsSubR * 0.8, kind: 'second' }],
    [reserveHand, { length: reserveR * 0.8, kind: 'minute' }],
  ];
  fluteSlider.addEventListener('input', () => {
    aesthetics.dial.hands.fluteFactor = fluteSlider.value / 100;
    for (const [hand, spec] of HAND_SPECS) {
      hand.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
      hand.clear();
      for (const ch of [...G.makeHand(spec).children]) hand.add(ch);
    }
  });

  // Light MODE: Studio (the aesthetics.json rig) vs NATURAL — open
  // daylight, to judge how the piece reads outside. Natural is one sun
  // (the key, strong and warm-white), a bright cool skylight doing the
  // ambient work, no studio furniture (dial light down, rim spot off),
  // and a lifted haze-grey world instead of the black void. Switching
  // modes rewrites the light objects AND the sliders, so the sliders
  // stay live fine-tuning on top of either preset.
  const LIGHT_MODES = {
    Studio: {
      key: { color: keyLightAesthetic.color, intensity: keyLightAesthetic.intensity },
      fill: { color: fillLightAesthetic.color, intensity: fillLightAesthetic.intensity },
      dial: { color: dialLightAesthetic.color, intensity: dialLightAesthetic.intensity },
      hemi: { sky: hemiAesthetic.skyColor, ground: hemiAesthetic.groundColor, intensity: hemiAesthetic.intensity },
      rim: rimSpotAesthetic.intensity,
      exposure: aesthetics.rendering.toneMappingExposure,
      bg: aesthetics.lighting.scene.backgroundColor,
    },
    Natural: {
      key: { color: '#fff6e4', intensity: 3.6 },   // the sun
      fill: { color: '#dbe8ff', intensity: 0.2 },  // faint sky bounce
      dial: { color: '#ffffff', intensity: 0.25 }, // no studio dial lamp outside
      hemi: { sky: '#bcd7ff', ground: '#7a7f6e', intensity: 1.5 }, // open-sky ambient
      rim: 0,                                      // no rim spot in a field
      exposure: 1.15,
      bg: '#39424e',                               // overcast-haze surround
    },
  };
  const lightModeBtn = document.getElementById('btn-light-mode');
  function applyLightMode(name) {
    const p = LIGHT_MODES[name];
    keyLight.color.set(p.key.color); keyLight.intensity = p.key.intensity;
    fillLight.color.set(p.fill.color); fillLight.intensity = p.fill.intensity;
    dialLight.color.set(p.dial.color); dialLight.intensity = p.dial.intensity;
    hemi.color.set(p.hemi.sky); hemi.groundColor.set(p.hemi.ground); hemi.intensity = p.hemi.intensity;
    rimSpot.intensity = p.rim;
    renderer.toneMappingExposure = p.exposure;
    scene.background.set(p.bg);
    if (scene.fog) scene.fog.color.set(p.bg);
    lightModeBtn.textContent = name;
  }
  lightModeBtn.addEventListener('click', () => {
    applyLightMode(lightModeBtn.textContent === 'Studio' ? 'Natural' : 'Studio');
  });
}

const labelsContainer = document.createElement('div');
labelsContainer.id = 'clock-labels';
labelsContainer.style.display = 'none';
document.body.appendChild(labelsContainer);
const labelEls = labelEntries.map(({ name }) => {
  const el = document.createElement('div');
  el.className = 'clock-label';
  el.textContent = name;
  labelsContainer.appendChild(el);
  return el;
});

// --- time-scale (log slider, 0.02..1, default 1 = real time) --------------
const SCALE_MIN = 0.02, SCALE_MAX = 1;
let timeScale = 1;
const scaleSlider = document.getElementById('scale-slider');
const scaleValueEl = document.getElementById('scale-value');
function scaleToSlider(s) {
  const t = (Math.log(s / SCALE_MIN)) / (Math.log(SCALE_MAX / SCALE_MIN));
  return Math.round(t * 1000);
}
function sliderToScale(v) {
  const t = v / 1000;
  return SCALE_MIN * Math.pow(SCALE_MAX / SCALE_MIN, t);
}
scaleSlider.value = scaleToSlider(timeScale);

// --- the scale readout (BUILT §12) ---------------------------------------
// At the top of the slider the scale IS 1× and the symbol says everything —
// no gloss, and no trailing zeros to make a statement look like a
// measurement. Below it, two DERIVED facts rather than invented adjectives:
// how slow, and what that does to the beat — 0.15× is not an arbitrary
// default, it is roughly where the escapement's unlock-impulse-drop sequence
// becomes followable by eye, and "0.75 beats/s" says that better than any
// word could. Fast-forward, pause and the sync catch-up all run on rates the
// slider does not know about, so they OUTRANK it here: reporting the slider
// while the movement flies would simply be false.
const scaleNoteEl = document.getElementById('scale-note');
// Detect the top by the slider's INTEGER position, never by comparing the
// scale to 1: sliderToScale(max) is 0.02·50, which in floating point can
// land at 1.0000000000000002. The unity case renders differently, so it has
// to be detected exactly.
function atRealTime() { return Number(scaleSlider.value) >= Number(scaleSlider.max); }
function formatScale() {
  if (paused) return { value: 'paused', note: 'movement stopped' };
  if (fastForward) return { value: 'fast-forward', note: '≈5400× — the whole reserve in ~20 s' };
  if (syncPhase === 'catchup') return { value: `${catchUpRate.toFixed(1)}×`, note: 'catching up to the wall clock' };
  const beats = 2 * F_BALANCE * timeScale; // 5/s at 1× — 18,000 vph
  const beatsText = `${(beats >= 1 ? beats.toFixed(1) : beats.toFixed(2))} beats/s`;
  if (atRealTime()) return { value: '1×', note: beatsText };
  // Two decimals round the notch below the top to "1.00×", which claims a
  // unity this position does not have — and its slow-ratio rounds to
  // "1.0× slow", which is noise. Unity is a distinct state here, so the
  // readout gains a digit rather than borrowing the top's identity, and the
  // ratio clause drops out once it stops saying anything.
  const shown = timeScale.toFixed(2);
  const slow = 1 / timeScale;
  return {
    value: `${shown === '1.00' ? timeScale.toFixed(3) : shown}×`,
    note: slow >= 1.05 ? `${slow.toFixed(1)}× slow · ${beatsText}` : beatsText,
  };
}
function paintScale() {
  const s = formatScale();
  scaleValueEl.textContent = s.value;
  scaleNoteEl.textContent = s.note;
}
function setTimeScale(s) {
  timeScale = s;
  scaleSlider.value = scaleToSlider(s);
  paintScale();
}
scaleSlider.addEventListener('input', () => {
  timeScale = sliderToScale(Number(scaleSlider.value));
  paintScale();
  syncCancel(); // taking the slider means taking the wheel
});

// --- pause/play -------------------------------------------------------
let paused = false;
const pauseBtn = document.getElementById('btn-pause');
pauseBtn.addEventListener('click', () => {
  paused = !paused;
  pauseBtn.textContent = paused ? 'Play' : 'Pause';
  pauseBtn.classList.toggle('active', paused);
  syncCancel(); // a script that cannot advance must not pretend to be running
});

// --- SYNC TO THE WALL CLOCK (BUILT §9) -----------------------------------
// A scripted watchmaker, not an assignment. The crown is pulled — which
// hacks the balance and flies the seconds hand to zero, both already built —
// the minute hand is SET through the real keyless ratios to the wall clock's
// LAST whole minute, and the crown is pushed back in. The watch is now
// running a known number of seconds BEHIND, and it closes that gap by
// running fast until it agrees: catching up, the way a watch you have just
// set actually gets there.
//
// Nothing is assigned anywhere in this: the hand movement travels the gears
// (it is a write to crownRotation, exactly what a drag produces — the
// auto-wind precedent), and the catch-up is time-scale, which this app
// already treats as a first-class user-facing control. Aiming at the LAST
// whole minute rather than the next one is what buys that: the jumper
// quantizes the display to whole minutes while the crown is out anyway, so
// a minute that has already passed leaves a deficit that is always positive
// and always less than a minute. Aiming forward would leave the script
// sitting and waiting for the wall clock to catch up to IT.
const SYNC_SETTLE = 0.45; // s — hold after the set so the detent snap is watchable
// Catch-up law: rate = 1 + min(gap/TAU, MAX_EXTRA). Constraint: the worst
// case — a full minute of deficit plus the ~1 s the crown animation itself
// costs — closes in under 10 s of real time, and the last second of it eases
// rather than falling off a cliff. MAX_EXTRA = 20 covers the linear stretch
// (62 s → 12 s at 20 s per second ≈ 2.5 s) and TAU = 0.6 s eases the rest
// (12 s → 0.05 s ≈ 3.3 s): ≈ 6 s worst case, decelerating the whole way.
const CATCHUP_TAU = 0.6;
const CATCHUP_MAX_EXTRA = 20;
const CATCHUP_DONE = 0.05; // s of residual — under one frame's worth at 1×
let syncPhase = null;      // null | 'pull' | 'settle' | 'push' | 'catchup'
let syncTimer = 0;
let catchUpRate = 1;

function wallClockSeconds() {
  const d = new Date();
  return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds() + d.getMilliseconds() / 1000;
}
// Signed shortest distance from `from` to `to` on the 12-hour dial: the
// hands cannot tell the halves apart, so neither should the arithmetic.
function dialDelta(from, to) {
  const H = DIAL_PERIOD_S;
  return ((((to - from) % H) + H + H / 2) % H) - H / 2;
}
function syncCancel() {
  syncPhase = null;
  catchUpRate = 1;
}
function syncStart() {
  if (fastForward || paused) return; // both outrank the slider — see formatScale()
  setTimeScale(1);                   // a synced clock at 0.15× is wrong again within seconds
  syncPhase = 'pull';
  syncTimer = 0;
  setCrownOut(true);
}
function syncUpdate(realDt) {
  if (!syncPhase) return;
  syncTimer += realDt;
  if (syncPhase === 'pull') {
    // Wait for the stem to actually reach the setting position: the jumper
    // is only in the star, and the setting path only engaged, once it has.
    if (crownPullT > 0.95) {
      const target = Math.floor(wallClockSeconds() / 60) * 60;
      const deltaSec = dialDelta(displayedSeconds(), target);
      // Hand movement → setting-path rotation → crown. Both conversions are
      // the movement's own: the minute hand's rate, then the keyless chain.
      crownRotation += (deltaSec * MIN_HAND_RAD_PER_SEC) / HAND_RAD_PER_SET_RAD;
      syncPhase = 'settle';
      syncTimer = 0;
    }
  } else if (syncPhase === 'settle') {
    if (syncTimer >= SYNC_SETTLE) { syncPhase = 'push'; setCrownOut(false); updateCrownUI(); }
  } else if (syncPhase === 'push') {
    // The push folds the jumper's snap into jumpCorr and lifts the beak; the
    // balance is released here, so the catch-up has something to run.
    if (crownPullT < 0.05) { syncPhase = 'catchup'; syncTimer = 0; }
  } else if (syncPhase === 'catchup') {
    const gap = dialDelta(displayedSeconds(), wallClockSeconds());
    if (gap <= CATCHUP_DONE) syncCancel();
    else catchUpRate = 1 + Math.min(gap / CATCHUP_TAU, CATCHUP_MAX_EXTRA);
  }
}

// --- wind button ----------------------------------------------------------
// Not a shortcut that pokes tension directly — it queues up real rotation
// for the SAME crownRotation input a manual drag would produce (see
// autoWindRemaining in tick()), so it drives the actual winding gear path.
// Comfortably more than a full wind's worth (11.25 turns); barrelWindTurns
// clamps at full regardless, so overshoot is harmless.
document.getElementById('btn-wind').addEventListener('click', () => {
  if (crownOut) return; // crown must be pushed in (winding position) to wind
  autoWindRemaining += 16 * 2 * Math.PI;
});

// --- crown: click to pull/push, drag to turn -------------------------------
const crownBtn = document.getElementById('btn-crown');
const windBtnEl = document.getElementById('btn-wind');
const timeReadoutEl = document.getElementById('readout-time');
function updateCrownUI() {
  crownBtn.textContent = crownOut ? 'Push in' : 'Pull out';
  crownBtn.classList.toggle('active', crownOut);
  windBtnEl.disabled = crownOut;
  timeReadoutEl.classList.toggle('hacking', crownOut);
}
function toggleCrown() {
  syncCancel(); // taking the crown by hand ends the script's claim on it
  setCrownOut(!crownOut);
  updateCrownUI();
}
crownBtn.addEventListener('click', toggleCrown);

// --- sync button (BUILT §9) ----------------------------------------------
// Click to start, click again to abandon; the script itself drives the crown,
// so the button's job is only to hand it over and report where it has got to.
const syncBtn = document.getElementById('btn-sync');
syncBtn.addEventListener('click', () => {
  if (syncPhase) { syncCancel(); return; }
  syncStart();
  updateCrownUI();
});
const SYNC_LABEL = { pull: 'Pulling…', settle: 'Setting…', push: 'Pushing in…', catchup: 'Catching up' };
function updateSyncUI() {
  syncBtn.textContent = syncPhase ? SYNC_LABEL[syncPhase] : 'Now';
  syncBtn.classList.toggle('active', !!syncPhase);
  syncBtn.disabled = fastForward || paused;
}

// --- fast-forward toggle ---------------------------------------------------
document.getElementById('btn-ff').addEventListener('click', () => {
  fastForward = !fastForward;
});
updateCrownUI();

// The crown is directly interactive in the 3D view: click it to pull/push
// (hacking), drag it to turn (winding or time-setting, depending on
// position) — cursor-affords on hover either way.
const crownRaycaster = new THREE.Raycaster();
const crownPointerNDC = new THREE.Vector2();
const crownHitMeshes = [crown]; // group — hit-test recurses into its parts
function setCrownPointerFromEvent(e) {
  const rect = renderer.domElement.getBoundingClientRect();
  crownPointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  crownPointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
}
function crownHitTest(e) {
  setCrownPointerFromEvent(e);
  crownRaycaster.setFromCamera(crownPointerNDC, camera);
  return crownRaycaster.intersectObjects(crownHitMeshes, true).length > 0;
}

const CROWN_DRAG_SENSITIVITY = (2 * Math.PI) / 350; // ~350px of drag per full turn
const CROWN_DRAG_THRESHOLD_PX = 3; // below this, treat pointerup as a click (pull/push)
let crownDragging = false;
let crownDragMoved = false;
let crownDragStartX = 0;
let crownDragStartRotation = 0;

renderer.domElement.addEventListener('pointermove', (e) => {
  if (crownDragging) {
    const dx = e.clientX - crownDragStartX;
    if (Math.abs(dx) > CROWN_DRAG_THRESHOLD_PX) crownDragMoved = true;
    crownRotation = crownDragStartRotation + dx * CROWN_DRAG_SENSITIVITY;
    return;
  }
  renderer.domElement.style.cursor = crownHitTest(e) ? 'pointer' : '';
});
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (!crownHitTest(e)) return;
  syncCancel(); // ditto: a hand on the crown outranks the script
  crownDragging = true;
  crownDragMoved = false;
  crownDragStartX = e.clientX;
  crownDragStartRotation = crownRotation;
  controls.enabled = false; // don't fight OrbitControls' own drag-to-orbit
  renderer.domElement.setPointerCapture(e.pointerId);
});
window.addEventListener('pointerup', (e) => {
  if (!crownDragging) return;
  crownDragging = false;
  controls.enabled = true;
  if (renderer.domElement.hasPointerCapture(e.pointerId)) {
    renderer.domElement.releasePointerCapture(e.pointerId);
  }
});
renderer.domElement.addEventListener('click', (e) => {
  if (crownDragMoved) { crownDragMoved = false; return; } // was a turn, not a click
  if (crownHitTest(e)) toggleCrown();
});

// --- Alarm crown drag (BUILT §24) ------------------------------------------
// Its own hit-test and drag state, parallel to the winding crown's. The two
// never both capture: the winding handlers are registered FIRST and grab the
// pointer when they hit, so these bail whenever a winding drag is already live
// (crownDragging) or the alarm crown isn't under the cursor. Dragging writes
// the RAW alarmCrownRotation only; the pointer follows it 1:1 and the set time
// is derived from the disc (Rule 2 — nothing here writes the target). The disc
// is friction-set, so turning it is smooth and silent — no detent click.
const alarmCrownHitMeshes = [alarmCrownKnob];
function alarmCrownHitTest(e) {
  setCrownPointerFromEvent(e);
  crownRaycaster.setFromCamera(crownPointerNDC, camera);
  return crownRaycaster.intersectObjects(alarmCrownHitMeshes, true).length > 0;
}
let alarmDragging = false, alarmDragStartX = 0, alarmDragStartRotation = 0, alarmDragMoved = false;
renderer.domElement.addEventListener('pointermove', (e) => {
  if (alarmDragging) {
    const dx = e.clientX - alarmDragStartX;
    if (Math.abs(dx) > CROWN_DRAG_THRESHOLD_PX) alarmDragMoved = true;
    alarmCrownRotation = alarmDragStartRotation + dx * CROWN_DRAG_SENSITIVITY;
    return;
  }
  if (!crownDragging && alarmCrownHitTest(e)) renderer.domElement.style.cursor = 'pointer';
});
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (crownDragging || !alarmCrownHitTest(e)) return; // winding crown gets first refusal
  alarmDragging = true;
  alarmDragMoved = false;
  alarmDragStartX = e.clientX;
  alarmDragStartRotation = alarmCrownRotation;
  controls.enabled = false; // don't fight OrbitControls' drag-to-orbit
  renderer.domElement.setPointerCapture(e.pointerId);
});
window.addEventListener('pointerup', (e) => {
  if (!alarmDragging) return;
  alarmDragging = false;
  controls.enabled = true;
  if (renderer.domElement.hasPointerCapture(e.pointerId)) renderer.domElement.releasePointerCapture(e.pointerId);
});
// A tap that didn't turn is a PULL/PUSH — the same click-vs-turn split the
// winding crown uses, driving the same toggle as the panel button.
renderer.domElement.addEventListener('click', (e) => {
  if (alarmDragMoved) { alarmDragMoved = false; return; } // was a turn, not a tap
  if (!crownHitTest(e) && alarmCrownHitTest(e)) toggleAlarmCrown();
});
// §25 D: tapping the COLUMN WHEEL is an actuation — same entry as the button.
function alarmColumnHitTest(e) {
  setCrownPointerFromEvent(e);
  crownRaycaster.setFromCamera(crownPointerNDC, camera);
  return crownRaycaster.intersectObject(alarmSwitchUnit, true).length > 0; // wheel, click arm, or pusher — one control
}
renderer.domElement.addEventListener('click', (e) => {
  if (crownHitTest(e) || alarmCrownHitTest(e)) return; // the crowns have first refusal
  if (alarmColumnHitTest(e)) setAlarm(!alarmOn); // wheel, click arm, or the PUSHER — one actuation
});
renderer.domElement.addEventListener('pointermove', (e) => {
  if (!crownDragging && !alarmDragging && alarmColumnHitTest(e)) renderer.domElement.style.cursor = 'pointer';
});

// --- labels toggle --------------------------------------------------------
// Factored into setLabels(on) so the guided-tour scripted user (BUILT §17)
// can drive it the same way a click does, rather than re-implementing the
// toggle's side effects.
let labelsOn = false;
function setLabels(on) {
  labelsOn = on;
  labelsContainer.style.display = on ? 'block' : 'none';
  const b = document.getElementById('btn-labels');
  b.textContent = on ? 'On' : 'Off';
  b.classList.toggle('active', on);
}
document.getElementById('btn-labels').addEventListener('click', () => setLabels(!labelsOn));

// --- three-quarter plate X-ray --------------------------------------------
// The plate does its job by covering the train, which is also the one thing
// this simulation most wants to show. The exploded slider answers "how does
// it come apart"; this answers "what is it doing while it runs" — the
// wheelwork stays assembled and turning, seen straight through the plate.
//
// depthWrite:false is not cosmetic: with it left on, the plate writes depth
// for the whole disc and the wheels behind it drop out of the frame entirely.
// The plate mesh only — the base plate, the escapement bridge and the balance
// cock stay solid, so the movement still reads as a structure.
let xrayOn = false;
const tqPlateMesh = threeQuarterPlate.children.find((o) => o.name === 'threeQuarterPlate');
const tqSolidMat = tqPlateMesh.material;
const tqXrayMat = tqSolidMat.clone();
tqXrayMat.transparent = true;
tqXrayMat.opacity = 0.28;
tqXrayMat.depthWrite = false;
tqXrayMat.roughness = Math.min(1, tqSolidMat.roughness + 0.1); // less mirror, more glass

// The DIAL rides the same toggle (BUILT §6): the dial-side works —
// keyless, motion works, reserve train, minute jumper — are what the §3
// sapphire dial exists to show, so "plate transparent" means the dial goes
// glassy too (a live preview of that dial). Unlike the plate, the dial is
// MANY meshes mixing unique canvas-textured materials with shared MATS
// entries, so glassy clones are cached per ORIGINAL material and swapped
// both ways. The mesh set covers only the Dial unit's own geometry (the
// makeDial build plus the dial feet); hands, subdial hands and the whole
// motion-works cluster are dialFace siblings — not in the set — so they
// stay solid, and a shared MATS clone can never leak onto another part
// because only meshes in this set ever get their material swapped.
const dialXrayMeshes = [];
dial.traverse((o) => { if (o.isMesh) dialXrayMeshes.push(o); });
for (const c of dialGroup.children) if (c.isMesh) dialXrayMeshes.push(c); // the dial feet
const dialXrayClones = new Map(); // original material → glassy clone
for (const m of dialXrayMeshes) {
  if (!dialXrayClones.has(m.material)) {
    const x = m.material.clone();
    x.transparent = true;
    x.opacity = tqXrayMat.opacity; // the ONE x-ray opacity, shared with the plate
    x.depthWrite = false;
    x.roughness = Math.min(1, (x.roughness ?? 1) + 0.1);
    dialXrayClones.set(m.material, x);
  }
  m.userData.solidMat = m.material;
}

function setXray(on) {
  xrayOn = on;
  tqPlateMesh.material = on ? tqXrayMat : tqSolidMat;
  for (const m of dialXrayMeshes) {
    m.material = on ? dialXrayClones.get(m.userData.solidMat) : m.userData.solidMat;
  }
  const b = document.getElementById('btn-xray');
  b.textContent = on ? 'On' : 'Off';
  b.classList.toggle('active', on);
}
document.getElementById('btn-xray').addEventListener('click', () => setXray(!xrayOn));
if (restoredXray) setXray(true);

// --- SOUND — synthesized clicks off the movement's own discrete events
// (BUILT §8). No audio assets and no loops: each mechanical event
// already computed by tick() fires one short noise transient through a
// bandpass + exponential-decay gain. Default Off, which also keeps
// __clock.setPose-driven inspector runs silent; enabling is itself the
// user gesture the autoplay policy wants, so the AudioContext is
// created/resumed right in the toggle handler.
let soundOn = false;
let audioCtx = null;
let _noiseBuf = null;
// Master chain (BUILT §11): every click passes through one gain + limiter
// before the destination, so a near-field beat cluster stacked on a pawl
// click can't clip. Also the future volume-slider hook.
let masterGain = null;
let masterCompressor = null;
function ensureAudioGraph() {
  if (masterGain) return;
  masterGain = audioCtx.createGain();
  masterGain.gain.value = 1;
  masterCompressor = audioCtx.createDynamicsCompressor();
  masterGain.connect(masterCompressor);
  masterCompressor.connect(audioCtx.destination);
}
// --- Spatial audio (BUILT §11) ---------------------------------------------
// Every click is a ≤30ms transient scheduled once, so a source can't move
// during its own sound: spatialization is a SNAPSHOT taken at schedule
// time, not a moving panner tracking a moving listener. Direction comes
// from an equal-power StereoPannerNode (safe on speakers, unlike an HRTF
// PannerNode, which buys elevation/front-back cues the camera framing
// already gives visually) rather than a full 3D panner.
const _sndPos = new THREE.Vector3();
const _sndVec = new THREE.Vector3();
const _sndRight = new THREE.Vector3();
// Reference distance: the Escapement preset's own framing radius (cluster
// radius × 3.8 — the same "fit at ~70% of the half-frame" rule camTargets
// uses below), so the DEFAULT view is nominal gain 1.0 and every §8 level
// stays exactly as tuned by ear.
const SND_REF = (Math.hypot(P.balance.x - P.escape.x, P.balance.y - P.escape.y) / 2 + balanceR) * 3.8;
const SND_NEAR = plateR * 0.35; // controls.minDistance
const SND_FAR = plateR * 12; // controls.maxDistance
// rolloff solved so the far orbit limit lands at -25dB (10^(-25/20)) rather
// than at silence; gain is clamped <=1 below so the near limit can't exceed
// today's tuned levels (SND_NEAR < SND_REF would otherwise overshoot 1).
const SND_FAR_GAIN = Math.pow(10, -25 / 20);
const SND_ROLLOFF = (SND_REF / SND_FAR_GAIN - SND_REF) / (SND_FAR - SND_REF);
function sndDistanceGain(d) {
  const g = SND_REF / (SND_REF + SND_ROLLOFF * (d - SND_REF));
  return Math.min(1, Math.max(0, g));
}
// Dial-side occlusion: every going-train pinion meshes the main plate at
// world Z=0 (greatWheel/centerPinion/thirdPinion/fourthPinion/escapePinion
// all set position.z=0), so that plane IS the plate baseline. A source and
// the camera on OPPOSITE sides of it have the plate physically between
// them; muffle unless x-ray has already made the plate/dial glassy (then
// it's honest for sound to pass too). No hardcoded "dial-side" emitter
// list — this falls out of each emitter's own measured Z, so a front-side
// source (the beat) gets muffled too if you view it from deep on the
// dial's side, which is physically correct.
const SND_OPEN_CUTOFF = 20000; // effectively unfiltered (above audible click content)
// 2400, not a near-silent 900: the SND timbres center as high as 5200 Hz, and
// a lowpass much below that erases a narrow-Q bandpass transient almost
// entirely -- reads as the sound vanishing, not as "muffled". 2400 sits
// above every source's low body tone (hammer 1200, stem 1700, pawl's 900 Hz
// layer) so those stay present, while the sharper 3-5 kHz voices (beat,
// jump) lose their edge instead of disappearing. Tuned by ear, same as the
// SND timbres themselves.
const SND_MUFFLE_CUTOFF = 2400;
const SND_MUFFLE_GAIN = 0.65; // occlusion also softens level a little, not just tone -- tuned by ear
function sndSpatial(emitter) {
  emitter.getWorldPosition(_sndPos);
  _sndVec.subVectors(_sndPos, camera.position);
  const d = _sndVec.length();
  _sndRight.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
  _sndVec.normalize();
  const pan = THREE.MathUtils.clamp(_sndVec.dot(_sndRight), -1, 1);
  const sameSide = _sndPos.z * camera.position.z >= 0;
  const muffled = !xrayOn && !sameSide;
  const cutoff = muffled ? SND_MUFFLE_CUTOFF : SND_OPEN_CUTOFF;
  return { pan, gain: sndDistanceGain(d) * (muffled ? SND_MUFFLE_GAIN : 1), cutoff };
}
function sndClick(freq, q, decay, gain, when = 0, emitter = null) {
  if (!soundOn || !audioCtx || audioCtx.state !== 'running') return;
  if (!_noiseBuf) {
    _noiseBuf = audioCtx.createBuffer(1, Math.floor(audioCtx.sampleRate * 0.06), audioCtx.sampleRate);
    const d = _noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  let pan = 0, finalGain = gain, cutoff = SND_OPEN_CUTOFF;
  if (emitter) {
    const s = sndSpatial(emitter); // captured NOW, not at t0 -- see header note
    pan = s.pan;
    finalGain = gain * s.gain;
    cutoff = s.cutoff;
    sndFlash(emitter); // BUILT §11: light up the part making the sound (own tuned duration, not `decay` -- 5-30ms is inaudible-fast on screen)
  }
  const t0 = audioCtx.currentTime + when;
  const src = audioCtx.createBufferSource();
  src.buffer = _noiseBuf;
  const bp = audioCtx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = freq;
  bp.Q.value = q;
  const lp = audioCtx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = cutoff;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(finalGain, t0);
  g.gain.exponentialRampToValueAtTime(0.0005, t0 + decay);
  const pn = audioCtx.createStereoPanner();
  pn.pan.value = pan;
  src.connect(bp); bp.connect(lp); lp.connect(g); g.connect(pn); pn.connect(masterGain);
  src.start(t0);
  src.stop(t0 + decay + 0.02);
}
// A struck bell tone (BUILT §24), for the alarm ding — a PITCHED voice, not a
// filtered noise transient like sndClick. Two lightly detuned sine
// oscillators into one exponential-decay envelope give the shimmer of a small
// bell without any partial-tuning machinery. Same spatial snapshot, master
// chain, and soundOn/context guard as sndClick; reuses sndFlash so the
// emitter glows on each ding.
function sndTone(freq, decay, gain, when = 0, emitter = null) {
  if (!soundOn || !audioCtx || audioCtx.state !== 'running') return;
  let pan = 0, finalGain = gain, cutoff = SND_OPEN_CUTOFF;
  if (emitter) {
    const s = sndSpatial(emitter); // snapshot NOW, same as sndClick
    pan = s.pan;
    finalGain = gain * s.gain;
    cutoff = s.cutoff;
    sndFlash(emitter);
  }
  const t0 = audioCtx.currentTime + when;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(finalGain, t0);
  g.gain.exponentialRampToValueAtTime(0.0005, t0 + decay);
  const lp = audioCtx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = cutoff;
  const pn = audioCtx.createStereoPanner();
  pn.pan.value = pan;
  g.connect(lp); lp.connect(pn); pn.connect(masterGain);
  for (const detune of [-4, 4]) { // cents — a faint beating shimmer
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.detune.value = detune;
    osc.connect(g);
    osc.start(t0);
    osc.stop(t0 + decay + 0.05);
  }
}
// Sub-beat acoustic events, derived from the SAME phase constants that
// drive the escapement animation — not canned millisecond offsets. Within
// a beat, raw phase p crosses:
//   0                               → unlocking (the recoil dip begins)
//   RECOIL_FRACTION · IMPULSE_WIDTH → the tooth takes the impulse face
//   IMPULSE_WIDTH                   → drop onto the far lock + banking pin
// beatEventCount returns a monotone event count up to movement time t, so
// the tick's edge detector fires exactly the events a frame stepped across.
const SND_BEAT_EVENTS = [0, RECOIL_FRACTION * IMPULSE_WIDTH, IMPULSE_WIDTH];
function beatEventCount(t) {
  const raw = t * 2 * F_BALANCE;
  const n = Math.floor(raw);
  const p = raw - n;
  let c = n * 3;
  for (const e of SND_BEAT_EVENTS) if (p >= e) c++;
  return c;
}
// Timbres per source (tuned by ear; the beat alternates two centres by
// bank parity — that parity IS the fork's bank side, so tic/toc is
// mechanically honest for free).
const SND = {
  // Each beat is a THREE-impact cluster, the way a timing machine hears a
  // real lever escapement:
  //   kind 0 — unlocking: the impulse pin knocks the fork off its bank and
  //            the pallet slides off the lock (soft, bright);
  //   kind 1 — impulse: the tooth scrapes down the pallet's impulse face
  //            (a quiet broadband smear, not a click — low Q, longer);
  //   kind 2 — drop + lock: the freed tooth lands on the far pallet as the
  //            lever hits the banking pin — the loud compound impact.
  beatEvent: (kind, tic, w = 0) => {
    if (kind === 0) sndClick(tic ? 5200 : 4600, 8, 0.005, 0.07, w, forkGroup);
    else if (kind === 1) sndClick(tic ? 3600 : 3100, 1.5, 0.022, 0.05, w, forkGroup);
    else {
      sndClick(tic ? 4200 : 3400, 7, 0.008, 0.17, w, forkGroup);
      sndClick(tic ? 1500 : 1300, 4, 0.012, 0.10, w, forkGroup);
    }
  },
  // The winding pawl gets a two-layer click — a bright tick plus a low
  // mechanical body — so it reads clearly over the running beat. The pawls
  // themselves aren't separately named objects; maintDetent (their carrier)
  // is the nearest addressable emitter.
  pawl: (w = 0) => { sndClick(2200, 5, 0.014, 0.42, w, maintDetent); sndClick(900, 3, 0.022, 0.28, w, maintDetent); },
  detent: () => sndClick(2000, 5, 0.012, 0.18, 0, maintDetent),
  jump: () => sndClick(3000, 6, 0.010, 0.25, 0, jumperUnit),
  hammer: () => sndClick(1200, 4, 0.025, 0.3, 0, hammerGroup),
  stem: () => sndClick(1700, 4, 0.015, 0.2, 0, crown),
  // One struck bell tone (BUILT §24) — fired once per HAMMER STRIKE by the
  // alarm power loop in tick(), not as a fixed volley: the ring lasts as many
  // strikes as the alarm barrel drives, so the sound tracks the real mechanism.
  // Spatialized to the gong's ringing end; the gong + hammer glow on each hit.
  // Two-partial timbre (a low strike body under a bright fundamental).
  alarmStrike: () => {
    // Light the whole power chain, not just the noisy end: the pin wheel did
    // the work, the hammer carried it, the gong turned it into sound (§25).
    sndFlash(alarmGongUnit); sndFlash(alarmHammerUnit); sndFlash(alarmStrikeUnit);
    sndTone(1760, 0.55, 0.30, 0, alarmEmitter);         // fundamental (A6-ish, a small bell)
    sndTone(880, 0.32, 0.14, 0, alarmEmitter);          // a softer strike partial an octave down
  },
};
// --- Sound-event highlight (BUILT §11) --------------------------------------
// The part that just made a sound glows on its OWN surface -- a direct
// emissive tint, not a separate overlay mesh -- so a click reads as coming
// from something specific. Each mesh gets exactly ONE cloned material,
// lazily, the first time IT is ever flashed; only the clone's emissive
// fields move. Known overlap: the power-flow view (`pfApply`, further
// down) ALSO clones-and-tints forkGroup/maintDetent/windSpinner's meshes
// while it's on. With both features enabled at once on an overlapping
// part, whichever ran last within a frame wins that frame's emissive
// value -- an accepted simplification (same spirit as the pan swirl
// during a camera tween, noted above), not a crash; jumperUnit and
// hammerGroup are outside every pf group, so they never see it.
const SND_FLASH_DECAY = 0.35; // seconds to fade out -- tuned by eye, gentler/subtler than any one click's own audio decay
const SND_FLASH_COLOR = new THREE.Color(0xffe6a0); // warm, low-key -- a glint, not an alarm
const SND_FLASH_PEAK = 0.55; // emissiveIntensity at the instant of the click -- tuned by eye
const sndFlashMeshes = new Map(); // target Object3D -> [mesh, ...]
const sndFlashLevel = new Map(); // target Object3D -> current 0..1
for (const target of [forkGroup, maintDetent, jumperUnit, hammerGroup, crown, alarmGongUnit, alarmHammerUnit, alarmStrikeUnit]) {
  const meshes = [];
  target.traverse((o) => { if (o.isMesh && o.material && 'emissive' in o.material) meshes.push(o); });
  sndFlashMeshes.set(target, meshes);
  sndFlashLevel.set(target, 0);
}
function sndFlash(emitter) {
  if (sndFlashMeshes.has(emitter)) sndFlashLevel.set(emitter, 1);
}
function updateSndFlash(realDt) {
  for (const [target, level] of sndFlashLevel) {
    if (level <= 0) continue;
    const next = Math.max(0, level - realDt / SND_FLASH_DECAY);
    sndFlashLevel.set(target, next);
    for (const mesh of sndFlashMeshes.get(target)) {
      if (!mesh.userData.sndFlashOwned) {
        mesh.material = mesh.material.clone();
        mesh.userData.sndFlashOwned = true;
      }
      mesh.material.emissive.copy(SND_FLASH_COLOR);
      mesh.material.emissiveIntensity = next * SND_FLASH_PEAK;
    }
  }
}
function setSound(on) {
  soundOn = on;
  if (on) {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    ensureAudioGraph();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }
  const b = document.getElementById('btn-sound');
  b.textContent = on ? 'On' : 'Off';
  b.classList.toggle('active', on);
}
document.getElementById('btn-sound').addEventListener('click', () => setSound(!soundOn));
if (restoredSound) setSound(true); // context resume may still await a gesture; the first click supplies it
// setSound(true) can run with no real gesture behind it — restored state
// above, a `?sound=1` deep link, or the tour's own `sound:true` step — and
// autoplay policy then leaves audioCtx 'suspended' forever, so sndClick's
// own guard drops every tick with nothing to show for it. Resume on the
// next REAL pointer/key input, whatever it is, not just a click on this
// button; harmless to keep listening once already 'running'.
window.addEventListener('pointerdown', () => {
  if (soundOn && audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}, true);
window.addEventListener('keydown', () => {
  if (soundOn && audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}, true);

// Alarm enable toggle (BUILT §24). The panel only ARMS the alarm — it never
// writes the set time; that is set by turning the alarm crown in 3D (Rule 2),
// and the readout below is derived from the disc's angle. Turning it on while
// the display sits before the target arms silently until the crossing;
// `alarmPrevRel` resets each mute/FF gap so re-arming never machine-guns.
function setAlarm(on) {
  if (on !== alarmOn) { alarmColSteps += 1; alarmPusherT = 1; } // §25 D: one actuation = one pusher press = half a pitch
  alarmOn = on;
  const b = document.getElementById('btn-alarm');
  b.textContent = on ? 'On' : 'Off';
  b.classList.toggle('active', on);
}
document.getElementById('btn-alarm').addEventListener('click', () => setAlarm(!alarmOn));
function alarmCrownSyncLabel() {
  const b = document.getElementById('btn-alarm-crown');
  b.textContent = alarmCrownOut ? 'Push to wind' : 'Pull to set';
  b.classList.toggle('active', alarmCrownOut);
}
function toggleAlarmCrown() {
  alarmCrownOut = !alarmCrownOut;
  alarmCrownSyncLabel();
}
document.getElementById('btn-alarm-crown').addEventListener('click', toggleAlarmCrown);
alarmCrownSyncLabel(); // a restored save may boot with the crown already out — the label follows the state, not the default
if (restoredAlarmOn) setAlarm(true);

// --- POWER FLOW view -------------------------------------------------------
// Tints the LIVE torque path so the maintaining sandwich's job is visible:
// while WINDING, the input side lights amber (energy flowing INTO the
// spring via crown → spur → cone → chain → drum), the maintaining wheel
// and detent light red (HOLDING — the reversal stops here), and the train
// stays green because the maintaining spring keeps feeding it. While
// RUNNING, the whole line from drum to escapement is green: the only way
// energy leaves the spring is through the going train, one escapement
// beat at a time. The set-up work glows faint red always — it holds the
// spring's inner end for the life of the watch.
let powerFlowOn = false;
const PF_STORE = 0xb86e1e, PF_DELIVER = 0x1e7e46, PF_HOLD = 0xa02020, PF_DIM = 0x000000;
let pfEntries = null; // [{ mesh, orig, tinted }] — built lazily on first enable
function pfCollect(objs) {
  const out = [];
  for (const o of objs) {
    if (!o) continue;
    o.traverse((m) => { if (m.isMesh && m.material) out.push(m); });
  }
  return out;
}
function pfBuildGroups() {
  // The pipe carries torque BOTH ways; input only stores; the train only
  // delivers; the sandwich holds while winding.
  return {
    input: pfCollect([keyless, windSpinner]),
    pipe: pfCollect([windSpur, windTop, fusee, drumGroup]).concat(chainMesh ? pfCollect([chainMesh]) : []),
    train: pfCollect([greatWheel, centerArbor, thirdArbor, fourthArbor, escapeArbor, forkGroup, balanceGroup]),
    sandwich: pfCollect([maintWheel, maintDetent]),
    anchor: pfCollect([setupWork]),
    // §25 D: the alarm's own torque path — input (crown-side winding train),
    // store (the alarm barrel), strike (barrel → cam → hammer → gong).
    alarmInput: pfCollect([alarmWindUnit, alarmCrownUnit]),
    alarmStore: pfCollect([alarmBarrelRotor]),
    alarmStrike: pfCollect([alarmStrikeRotor, alarmHammerPivot, gongArc]),
  };
}
let pfLastAlarmWind = 0, pfAlarmHotUntil = 0;
let pfGroups = null;
function pfApply(meshes, hex, intensity) {
  for (const m of meshes) {
    if (!m.userData.pfOrig) {
      m.userData.pfOrig = m.material;
      m.material = m.material.clone();
    }
    if (m.material.emissive) {
      m.material.emissive.setHex(hex);
      m.material.emissiveIntensity = intensity;
    }
  }
}
function pfRestore() {
  if (!pfGroups) return;
  for (const g of Object.values(pfGroups))
    for (const m of g) {
      if (m.userData.pfOrig) {
        m.material.dispose();
        m.material = m.userData.pfOrig;
        delete m.userData.pfOrig;
      }
    }
  pfGroups = null;
}
let pfLastWind = 0, pfWindHotUntil = 0;
function pfUpdate() {
  if (!powerFlowOn) return;
  if (!pfGroups) pfGroups = pfBuildGroups();
  const now = performance.now();
  if (windAccumTurns !== pfLastWind) {
    pfLastWind = windAccumTurns;
    pfWindHotUntil = now + 600; // winding activity lingers visibly
  }
  const winding = now < pfWindHotUntil;
  const running = balanceRate > 0.05 && reserveShown > 0.001;
  const pulse = 0.75 + 0.25 * Math.sin(now / 180);
  pfApply(pfGroups.input, winding ? PF_STORE : PF_DIM, winding ? 0.55 * pulse : 0);
  pfApply(pfGroups.pipe, winding ? PF_STORE : running ? PF_DELIVER : PF_DIM, (winding || running) ? 0.5 * pulse : 0);
  pfApply(pfGroups.train, (running || winding) ? PF_DELIVER : PF_DIM, (running || winding) ? 0.45 * pulse : 0);
  pfApply(pfGroups.sandwich, winding ? PF_HOLD : running ? PF_DELIVER : PF_DIM, winding ? 0.9 * pulse : running ? 0.45 * pulse : 0);
  pfApply(pfGroups.anchor, PF_HOLD, 0.3);
  // §25 D: winding the alarm lights its input + store; ringing lights the
  // store + strike path — the visual proof the ring is spring-powered.
  if (alarmBarrelWind > pfLastAlarmWind + 1e-6) pfAlarmHotUntil = now + 600;
  pfLastAlarmWind = alarmBarrelWind;
  const aWinding = now < pfAlarmHotUntil;
  const aRinging = alarmReleased && alarmOn && alarmBarrelWind > 0;
  pfApply(pfGroups.alarmInput, aWinding ? PF_STORE : PF_DIM, aWinding ? 0.55 * pulse : 0);
  pfApply(pfGroups.alarmStore, aWinding ? PF_STORE : aRinging ? PF_DELIVER : PF_DIM, (aWinding || aRinging) ? 0.5 * pulse : 0);
  pfApply(pfGroups.alarmStrike, aRinging ? PF_DELIVER : PF_DIM, aRinging ? 0.5 * pulse : 0);
}
function setPowerFlow(on) {
  powerFlowOn = on;
  if (!on) pfRestore();
  const b = document.getElementById('btn-powerflow');
  b.textContent = on ? 'On' : 'Off';
  b.classList.toggle('active', on);
}
document.getElementById('btn-powerflow').addEventListener('click', () => setPowerFlow(!powerFlowOn));

// --- state persistence (save/load/clear) -----------------------------------
// Create state buttons dynamically to avoid template literal issues
// A collapsible <details> section (BUILT §15) like the ones in the panel
// template, so State folds away with the rest and the panel fits a short
// viewport.
const stateSection = document.createElement('details');
stateSection.className = 'ui-section';
stateSection.innerHTML = `
  <summary>State</summary>
  <div class="ui-section-body">
    <div class="row presets" id="state-buttons">
      <button id="btn-save-state">Save</button>
      <button id="btn-load-state">Load</button>
      <button id="btn-clear-state">Clear</button>
    </div>
  </div>
`;
document.getElementById('clock-ui').appendChild(stateSection);

const saveStateBtn = document.getElementById('btn-save-state');
const loadStateBtn = document.getElementById('btn-load-state');
const clearStateBtn = document.getElementById('btn-clear-state');

function updateStateButtons() {
  const has = hasState();
  loadStateBtn.disabled = !has;
  clearStateBtn.disabled = !has;
}

// Snapshot the whole persistable state, including the live camera pose
// (position + orbit target). Shared by the manual Save button and the
// periodic auto-save so the two never drift out of sync.
function captureState() {
  return {
    barrelWindTurns,
    tauIntegrated,
    crownRotation,
    jumpCorr,
    crownOut,
    fastForward,
    timeScale: Math.pow(10, (Number(document.getElementById('scale-slider').value) / 1000) * 3 - 3),
    showLabels: labelsOn,
    plateXray: xrayOn,
    soundOn,
    alarmOn,
    alarmCrownRotation, // raw input; the disc angle + target re-derive deterministically (§24)
    alarmSetRot,        // §25 C: the SET path's banked rotation (the hand position survives winding)
    alarmCrownOut,      // §25 C: winding clutch state
    alarmBarrelWind,    // alarm-spring energy in turns (§24)
    quality: qualityMode, // §14: the panel's CHOICE (Auto or a pinned tier), not Auto's current verdict
    showBeat: 0,
    camera: {
      px: camera.position.x, py: camera.position.y, pz: camera.position.z,
      tx: controls.target.x, ty: controls.target.y, tz: controls.target.z,
    },
  };
}

saveStateBtn.addEventListener('click', () => {
  const currentState = captureState();
  if (saveState(currentState)) {
    saveStateBtn.textContent = 'Saved!';
    saveStateBtn.classList.add('active');
    setTimeout(() => {
      saveStateBtn.textContent = 'Save';
      saveStateBtn.classList.remove('active');
    }, 1200);
    updateStateButtons();
  }
});

loadStateBtn.addEventListener('click', () => {
  // The startup restore (await loadState() above) applies everything on
  // boot — a plain reload IS the load.
  location.reload();
});

clearStateBtn.addEventListener('click', () => {
  if (confirm('Clear saved state?')) {
    clearState();
    updateStateButtons();
    clearStateBtn.textContent = 'Cleared';
    setTimeout(() => { clearStateBtn.textContent = 'Clear'; }, 1200);
  }
});

updateStateButtons();

// --- exploded view slider -------------------------------------------------
let explodeAmount = 0;
document.getElementById('explode-slider').addEventListener('input', (e) => {
  explodeAmount = Number(e.target.value) / 100;
});

// --- per-unit explode + label filter (BUILT §7) --------------------------
// Pick one unit and the slider lifts only it (labels filter to it too).
// Explode entries carry no names, but nearly every explode obj IS the very
// object registered with registerLabel — an identity join names them all
// without touching the ~30 registerExplode call sites. The two stragglers
// (backPlate, handsGroup — neither has a label) get explicit names.
let selectedUnit = 'All';
// --- Explode GROUPS (§25 C; the seed of §10's level-1) ---------------------
// A named set of units the selector can lift TOGETHER, each at its own
// per-group layer so the mechanism unfolds in its working order instead of
// moving as one slab. Layers here override the entry's registered layer ONLY
// while the group is selected — 'All' keeps every unit's original staging.
// dir stays the ENTRY's own (it encodes the dialFace frame flip); within one
// visual side a bigger layer just means further out.
const EXPLODE_GROUPS = new Map([
  ['Alarm complication', new Map([
    // dial side, unfolding toward the viewer in drive order: crown outermost
    ['Alarm crown', 6], ['Alarm setting arbor', 5], ['Alarm setting idler', 4],
    ['Alarm setting wheel', 3], ['Alarm disc', 2],
    ['Alarm release disc', 2], ['Alarm release feeler', 3],
    // back side, unfolding away: the power chain in torque order
    ['Alarm winding train', 3], ['Alarm barrel', 5], ['Alarm striking wheel', 7],
    ['Alarm hammer', 9], ['Alarm gong', 11],
  ])],
]);
// A hand-written table like this rots silently (§10's warning) — assert every
// member is a real label name at boot.
for (const [gname, members] of EXPLODE_GROUPS) {
  for (const n of members.keys()) {
    if (!labelEntries.some((l) => l.name === n))
      console.warn(`explode group "${gname}": member "${n}" is not a registered label`);
  }
}
const EXPLODE_NAME_FALLBACK = new Map([[backPlate, 'Structure'], [handsGroup, 'Hands']]);
function explodeEntryName(e) {
  if (e.name === undefined) {
    const hit = labelEntries.find((l) => l.obj === e.obj);
    e.name = hit ? hit.name : (EXPLODE_NAME_FALLBACK.get(e.obj) ?? 'Structure');
  }
  return e.name;
}
const unitSelect = document.getElementById('explode-unit');
// Options are the union of explode-entry names and label names: label-only
// units (Chain, Motion works, …) can't lift on their own — they either have
// no explode entry or ride a parent's — but selecting one still isolates
// its label. Rebuilt on open because the Chain label registers lazily on
// the first tick (its mesh is built inside updateChain).
function refreshUnitOptions() {
  const names = [...new Set([
    ...explodeEntries.map(explodeEntryName),
    ...labelEntries.map((l) => l.name),
  ])];
  const groups = [...EXPLODE_GROUPS.keys()];
  if (unitSelect.options.length === names.length + groups.length + 1) return;
  const cur = unitSelect.value;
  unitSelect.innerHTML = '';
  for (const n of ['All', ...groups, ...names]) {
    const o = document.createElement('option');
    o.textContent = n;
    unitSelect.appendChild(o);
  }
  unitSelect.value = names.includes(cur) ? cur : 'All';
  selectedUnit = unitSelect.value;
}
refreshUnitOptions();
unitSelect.addEventListener('pointerdown', refreshUnitOptions);
unitSelect.addEventListener('change', () => { selectedUnit = unitSelect.value; });

// --- camera presets (tweened) ---------------------------------------------
// Distances are derived from the actual computed plate radius so framing
// stays sane no matter what moduli/gaps the layout above works out to.
// Camera FOV is 42°; to fit an object of radius R comfortably (~70% of the
// half-frame) the distance from its target needs to be roughly 3.8×R — the
// multipliers below are sized with that in mind rather than guessed.
const camTargets = {
  Escapement: {
    // Frame just the escape wheel + fork + balance cluster, not the whole
    // plate: cluster radius ≈ half the escape↔balance span plus the balance.
    pos: (() => {
      const cR = Math.hypot(P.balance.x - P.escape.x, P.balance.y - P.escape.y) / 2 + balanceR;
      const d = cR * 3.8;
      return new THREE.Vector3(
        (P.escape.x + P.balance.x) / 2 + d * 0.35,
        (P.escape.y + P.balance.y) / 2 + d * 0.25,
        L_ESCAPE + d * 0.9
      );
    })(),
    target: new THREE.Vector3((P.escape.x + P.balance.x) / 2, (P.escape.y + P.balance.y) / 2, L_ESCAPE + 3),
  },
  Train: {
    // Mostly-lateral (X/Y) offset with a shallow Z contribution: an oblique
    // side elevation that shows the arbors' Z-layering without looking
    // straight through the small train cluster at the much larger dial
    // sitting behind it.
    pos: new THREE.Vector3(
      trainCentroid.x + plateR * 1.6,
      trainCentroid.y + plateR * 1.3,
      L_CENTER + plateR * 1.9
    ),
    target: new THREE.Vector3(trainCentroid.x, trainCentroid.y, L_CENTER + 3),
  },
  Dial: {
    pos: new THREE.Vector3(P.dial.x, P.dial.y + plateR * 0.4, Z_DIAL - plateR * 2.4),
    target: new THREE.Vector3(P.dial.x, P.dial.y, Z_DIAL),
  },
  Setting: {
    // The §1 jumping-minute works, framed on their own (BUILT §5). The whole
    // cluster — star, beak, spring, lifter — lives within JMP_PIV_R of the
    // minute-wheel stud, so the stud IS the frame's centre. Its world position
    // comes through the dialFace Y-flip (dial-local (x,y,z) ↔ world
    // (P.dial.x − x, P.dial.y + y, Z_DIAL − z); dialFace.rotation.y = π), with
    // the cluster's mid-Z at Z_DIAL − STAR_MID.
    //
    // Viewed from the dial (−Z) side like the Dial preset: the jumper sits
    // between the dial and the plate, so the only thing between it and a
    // dial-side camera is the thin dial itself — which `reveal: 'xray'`
    // glassifies. From the movement (+Z) side the whole going train and barrel
    // would occlude it instead, so −Z is the clean side.
    pos: (() => {
      const cx = P.dial.x - MW_STUD.x, cy = P.dial.y + MW_STUD.y, cz = Z_DIAL - STAR_MID;
      // Framing radius spans the star (STAR_R) plus the jumper's pivot reach
      // (JMP_PIV_R); the 42° FOV fit rule (see this block's header) puts the
      // camera 3.8×R off the target.
      const R = JMP_PIV_R + STAR_R;
      const d = R * 3.8;
      // Lateral + vertical offset (like Escapement/Dial) so the beak and
      // spring aren't seen edge-on; the bulk of the distance is −Z (dial side).
      return new THREE.Vector3(cx + d * 0.28, cy + d * 0.28, cz - d * 0.9);
    })(),
    target: new THREE.Vector3(P.dial.x - MW_STUD.x, P.dial.y + MW_STUD.y, Z_DIAL - STAR_MID),
    reveal: 'xray', // the jumper hides behind the dial — glass it so the frame is legible
  },
  Free: {
    pos: new THREE.Vector3(plateR * 2.0, plateR * 1.8, plateR * 3.0),
    target: new THREE.Vector3(0, 0, 5),
  },
};
let camTween = null; // { fromPos, fromTarget, toPos, toTarget, t0, dur }
function goToPreset(name) {
  const preset = camTargets[name];
  if (!preset) return;
  camTween = {
    fromPos: camera.position.clone(),
    fromTarget: controls.target.clone(),
    toPos: preset.pos.clone(),
    toTarget: preset.target.clone(),
    t: 0,
    dur: 0.9,
  };
  // A preset can declare that its subject is hidden behind a plate and needs
  // x-ray to be legible (the Setting preset's jumper, BUILT §5). Only ever
  // turns it ON — a camera move should not silently switch a viewer's x-ray
  // back off.
  if (preset.reveal === 'xray' && !xrayOn) setXray(true);
  document.querySelectorAll('#clock-ui .presets button').forEach((b) => b.classList.toggle('active', b.dataset.cam === name));
}
document.querySelectorAll('#clock-ui .presets button').forEach((b) => {
  b.addEventListener('click', () => goToPreset(b.dataset.cam));
});
// Restore a saved camera pose if one was persisted; otherwise frame the
// default Free preset — the whole movement, before the viewer has said what
// they came to look at. A restore snaps directly (no tween) and cancels any
// in-flight preset tween so it isn't overwritten next frame.
if (restoredCamera) {
  camera.position.set(restoredCamera.px, restoredCamera.py, restoredCamera.pz);
  controls.target.set(restoredCamera.tx, restoredCamera.ty, restoredCamera.tz);
  controls.update();
  camTween = null;
  document.querySelectorAll('#clock-ui .presets button').forEach((b) => b.classList.remove('active'));
} else {
  goToPreset('Free');
}

// ---------------------------------------------------------------------------
// SCRIPTED USER — one engine for the guided demo (BUILT §5) and the guided
// tour (BUILT §17). It is NOT a new mechanism: it only drives the SAME inputs
// a viewer would (camera presets, the crown, the time-scale, the view toggles,
// the wind and sync buttons), stepping through a declarative list. Each step is
// { preset, <view/UI state>, caption, dwell, ... }; the demo is one such list,
// the tour is a longer one, and both run through scriptEnterStep/scriptUpdate.
//
// Interaction contract (BUILT §9's syncCancel, generalised): ANY real user
// input — a pointer, a key, the scroll wheel — ends the script at once, except
// a click on the Guided buttons themselves (their own handlers toggle it). A
// script never dispatches DOM events (it calls the underlying functions), so a
// captured DOM event is always the user taking the wheel.
//
// Setting turns are fed through the movement's own keyless chain, exactly as
// §9's sync does: one star detent is one minute of the minute hand, and the
// per-minute crown rotation is (60·MIN_HAND_RAD_PER_SEC)/HAND_RAD_PER_SET_RAD,
// not a hand-picked angle. SCRIPT_SET_MIN_S is how long each detent takes on
// screen — a beat is ~0.2 s and the jumper snap eases over CAM_SNAP_TAU
// (0.06 s), so ~0.7 s per minute leaves a clear pause between snaps. Fed on
// real dt, so (like the snap itself) the detents play at real cadence
// regardless of the time-scale slider.
const SCRIPT_SET_MIN_S = 0.7;
const SCRIPT_SET_RAD_PER_MIN = Math.abs((60 * MIN_HAND_RAD_PER_SEC) / HAND_RAD_PER_SET_RAD);
const SCRIPT_SET_RATE = SCRIPT_SET_RAD_PER_MIN / SCRIPT_SET_MIN_S; // rad/s of crown, gentle
const SCRIPT_EXPLODE_TAU = 0.35; // s — explode ease matches the caption fade so it reads as motion
function settingTurnRad(minutes) {
  // Signed like §9's write: advances the minute hand forward by `minutes`.
  return (minutes * 60 * MIN_HAND_RAD_PER_SEC) / HAND_RAD_PER_SET_RAD;
}

let scriptSteps = null;         // active step list, or null when idle
let scriptIdx = 0;
let scriptBtn = null;           // the Guided button that started the run
let scriptDwell = 0;            // s held since the current step's actions settled
let scriptTurnRad = 0;          // signed crown rotation left to feed for a turn step
let scriptExplodeTarget = null; // 0..1 to ease explodeAmount toward, or null

function scriptEnterStep(i) {
  const s = scriptSteps[i];
  scriptDwell = 0;
  scriptTurnRad = 0;
  // View/UI state first, camera next, then crown/turn/sync — so a preset's
  // reveal:'xray' can be overridden by an explicit xray:false in the same step.
  if (s.scale !== undefined) setTimeScale(s.scale);
  if (s.labels !== undefined) setLabels(s.labels);
  if (s.powerflow !== undefined) setPowerFlow(s.powerflow);
  if (s.sound !== undefined) setSound(s.sound);
  if (s.unit !== undefined) { unitSelect.value = s.unit; selectedUnit = s.unit; }
  scriptExplodeTarget = (s.explode !== undefined) ? s.explode : null;
  if (s.preset) goToPreset(s.preset);
  if (s.xray !== undefined) setXray(s.xray);
  if (s.crown) { setCrownOut(s.crown === 'out'); updateCrownUI(); }
  if (s.turnMinutes) scriptTurnRad = settingTurnRad(s.turnMinutes);
  if (s.wind) autoWindRemaining += s.wind * 2 * Math.PI;
  if (s.sync) { syncStart(); updateCrownUI(); }
  if (s.caption !== undefined) captionEl.textContent = s.caption;
  captionEl.style.display = 'block';
  captionEl.classList.add('show');
}

function scriptUpdate(realDt) {
  if (!scriptSteps) return;
  const s = scriptSteps[scriptIdx];
  // Feed a scripted setting turn — only while the stem is physically in the
  // setting position (crownPullT > 0.5), mirroring tick()'s own gate, so it can
  // never leak onto the winding path.
  if (scriptTurnRad !== 0 && crownPullT > 0.5) {
    const stepRad = Math.sign(scriptTurnRad) * Math.min(Math.abs(scriptTurnRad), SCRIPT_SET_RATE * realDt);
    crownRotation += stepRad;
    scriptTurnRad -= stepRad;
    if (Math.abs(scriptTurnRad) < 1e-6) scriptTurnRad = 0;
  }
  // Ease the exploded view toward the step's target and keep the slider honest.
  if (scriptExplodeTarget !== null) {
    explodeAmount += (scriptExplodeTarget - explodeAmount) * (1 - Math.exp(-realDt / SCRIPT_EXPLODE_TAU));
    document.getElementById('explode-slider').value = String(Math.round(explodeAmount * 100));
    if (Math.abs(explodeAmount - scriptExplodeTarget) < 0.005) { explodeAmount = scriptExplodeTarget; scriptExplodeTarget = null; }
  }
  // The step's dynamic actions must finish before the dwell clock starts: the
  // crown must reach position, the turn must be spent, a wind must complete, a
  // sync must run all the way through catch-up, the explode must settle.
  const settled =
    (!s.crown || (s.crown === 'out' ? crownPullT > 0.95 : crownPullT < 0.05)) &&
    scriptTurnRad === 0 &&
    (!s.wind || autoWindRemaining <= 0) &&
    (!s.sync || syncPhase === null) &&
    scriptExplodeTarget === null;
  if (!settled) return;
  scriptDwell += realDt;
  if (scriptDwell < (s.dwell ?? 0)) return;
  if (scriptIdx + 1 >= scriptSteps.length) { scriptStop(); return; }
  scriptIdx++;
  scriptEnterStep(scriptIdx);
}

let scriptAbortArmed = false;
function scriptAbort(e) {
  // A click on a Guided button is the user talking TO the script (its handler
  // toggles it), not taking over from it — let that through.
  if (e.target && e.target.closest && e.target.closest('.script-ctrl')) return;
  scriptStop();
}
function armScriptAbort() {
  if (scriptAbortArmed) return;
  window.addEventListener('pointerdown', scriptAbort, true);
  window.addEventListener('keydown', scriptAbort, true);
  window.addEventListener('wheel', scriptAbort, true);
  scriptAbortArmed = true;
}
function disarmScriptAbort() {
  if (!scriptAbortArmed) return;
  window.removeEventListener('pointerdown', scriptAbort, true);
  window.removeEventListener('keydown', scriptAbort, true);
  window.removeEventListener('wheel', scriptAbort, true);
  scriptAbortArmed = false;
}

function scriptStop() {
  // Follows §9's syncCancel: STOP, don't undo. Whatever the script last set
  // (camera, x-ray, explode, crown) stays — the point of aborting is to hand
  // the user the state they're looking at, not to reset it out from under them.
  // A mid-flight scripted sync is the one thing that must be released, or its
  // catch-up rate would keep running the movement fast with no script to end it.
  scriptSteps = null;
  scriptIdx = 0;
  scriptTurnRad = 0;
  scriptExplodeTarget = null;
  syncCancel();
  captionEl.classList.remove('show');
  setTimeout(() => { if (!scriptSteps) captionEl.style.display = 'none'; }, 400); // let the fade finish
  scriptBtn = null;
  const tb = document.getElementById('btn-tour'); if (tb) { tb.textContent = 'Tour'; tb.classList.remove('active'); }
  const db = document.getElementById('btn-demo'); if (db) { db.textContent = 'Demo'; db.classList.remove('active'); }
  restorePanelAfterScript(); // undo any phone-layout panel collapse from scriptStart
  disarmScriptAbort();
}

function scriptStart(steps, btn) {
  scriptStop();               // supersede any running script
  // Phone: move the fixed control panel out from in front of the scripted run.
  // scriptStop (above, and whenever this run ends or the user taps to take
  // over) restores it, so the final "explore the controls yourself" stop hands
  // the panel back.
  hidePanelForScript();
  // scriptStart is only ever reached through a real tap — the Tour/Demo
  // button, or the tour gate's Proceed — so THIS is the gesture autoplay
  // policy wants. Create/resume the AudioContext right here, synchronously
  // in that gesture, rather than waiting for whichever step first sets
  // sound:true: that runs frames later out of scriptUpdate, well outside
  // any trusted event, and a resume() called that late is exactly what
  // gets silently ignored (BUILT §8's sndClick then drops every tick with
  // audioCtx stuck 'suspended' and nothing on screen to say why).
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  ensureAudioGraph();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  scriptSteps = steps;
  scriptIdx = 0;
  scriptBtn = btn || null;
  if (scriptBtn) { scriptBtn.classList.add('active'); scriptBtn.textContent = 'Stop'; }
  captionEl.style.display = 'block';
  captionEl.classList.remove('show');
  // Two frames so the opacity transition fires from the display:none→block edge.
  requestAnimationFrame(() => requestAnimationFrame(() => { if (scriptSteps) captionEl.classList.add('show'); }));
  armScriptAbort();
  scriptEnterStep(0);
}

// --- the two scripts -------------------------------------------------------
// §5 — "See the minute jumper in action": frame the jumper, then pull → snap →
// set → push, unattended, ending with the watch running on an index.
const DEMO_STEPS = [
  { preset: 'Setting', scale: 0.3, caption: 'The jumping-minute setting works, behind the dial', dwell: 1.4 },
  { crown: 'out', caption: 'Pull the crown — the seconds hack and fly to zero, and the jumper drops into the star', dwell: 0.7 },
  { turnMinutes: 4, caption: 'Turn to set — the beak snaps the hand one exact minute per detent', dwell: 0.9 },
  { crown: 'in', scale: 1, caption: 'Push home — the jumper lifts and the watch runs on, synchronised', dwell: 1.6 },
];

// §17 — Guided tour: the same engine over more stops. The jumper stop reuses
// the demo's own pull/turn/push vocabulary (not a second machine), and the sync
// stop leans on §12's honest scale readout to narrate the catch-up rate.
const TOUR_STEPS = [
  { preset: 'Free', scale: 1, crown: 'in', xray: false, explode: 0, labels: false, powerflow: false, sound: false, unit: 'All',
    caption: 'A fusee-and-chain watch movement — every part built from geometry, no models', dwell: 3.6 },
  { preset: 'Escapement', scale: 0.05,
    caption: 'The Swiss lever escapement, slowed right down — the balance frees one tooth per beat', dwell: 6.0 },
  { preset: 'Free', scale: 1, crown: 'in', wind: 16, xray: true, // scale:1 — auto-wind drains in sim-time, so the previous step's slow scale would stretch the wind out
    caption: 'Winding hauls the chain up the fusee cone; its rising radius keeps the drive torque steady', dwell: 2.4 },
  { preset: 'Train', scale: 1, powerflow: true,
    caption: 'That torque runs the going train — barrel to centre, third, fourth, escape', dwell: 5.1 },
  { preset: 'Free', powerflow: false, xray: true, explode: 0.6, labels: true,
    caption: 'X-ray the plates and explode the stack to see how the layers fit', dwell: 6.0 },
  { preset: 'Setting', explode: 0, labels: false, scale: 0.3, crown: 'out',
    caption: 'On the dial side, pull the crown and the jumping-minute works engage', dwell: 1.2 },
  { turnMinutes: 3, caption: 'Each detent sets the minute hand one exact minute', dwell: 1.2 },
  { crown: 'in', scale: 1, caption: 'Push home and it runs on', dwell: 1.8 },
  { preset: 'Dial', xray: false, sync: true,
    caption: 'Sync sets the hands to your wall clock through the real keyless works, then catches up', dwell: 0.9 },
  { preset: 'Free', sound: true,
    caption: 'Every tick is synthesised from the movement’s own events — turn the volume up', dwell: 5.1 },
  { preset: 'Free', sound: false, scale: 1, xray: false, explode: 0, labels: false, powerflow: false,
    caption: 'That’s the tour. Now explore the controls yourself.', dwell: 3.9 },
];

document.getElementById('btn-demo').addEventListener('click', (e) => {
  const btn = e.currentTarget;
  if (scriptBtn === btn) scriptStop(); else scriptStart(DEMO_STEPS, btn);
});
document.getElementById('btn-tour').addEventListener('click', (e) => {
  const btn = e.currentTarget;
  if (scriptBtn === btn) scriptStop(); else scriptStart(TOUR_STEPS, btn);
});

// ---------------------------------------------------------------------------
// DEEP LINKS — query-string entry points onto the SAME two surfaces above:
// the script engine (?tour / ?demo) or the raw view state the engine's own
// steps set (?preset, ?scale, ?xray, ?explode, ?labels, ?powerflow, ?sound,
// ?unit, ?crown, ?reserve). `?demo=1` starts the matching script exactly as
// its button would. `?tour=1` goes through askTour's confirm/skip gate first
// — a deep link isn't itself a user gesture the way a button click is, and
// shouldn't swing the camera/crown/sound unattended before the visitor has
// agreed to it; Proceed calls the SAME scriptStart(TOUR_STEPS, ...) the
// button uses. The state params are lower-stakes: applied once, on load,
// directly through the same setters scriptEnterStep calls — no caption, no
// dwell, no script running afterward to abort — so a link like
// `?preset=Escapement&scale=0.05&xray=1` reaches the pose a script step would
// and then just sits there as ordinary interactive state. Unrecognised or
// malformed params are ignored (goToPreset no-ops on an unknown name;
// unparseable numbers fall back to 1 for scale, 0 for explode/reserve via
// `|| ` — nothing throws on a bad link).
function applyDeepLink() {
  const params = new URLSearchParams(location.search);
  // State params apply FIRST and unconditionally — including alongside
  // ?tour=1/?demo=1 — because a script's own steps only touch the fields
  // they name (TOUR_STEPS/DEMO_STEPS never set barrelWindTurns), so a base
  // state like ?tour=1&reserve=0.3 is meant to survive into the tour, not
  // get skipped because the tour branch used to return before reaching it.
  const flag = (v) => v === '1' || v === 'true';
  if (params.has('preset')) goToPreset(params.get('preset'));
  if (params.has('scale')) setTimeScale(parseFloat(params.get('scale')) || 1);
  if (params.has('xray')) setXray(flag(params.get('xray')));
  if (params.has('labels')) setLabels(flag(params.get('labels')));
  if (params.has('powerflow')) setPowerFlow(flag(params.get('powerflow')));
  if (params.has('sound')) setSound(flag(params.get('sound')));
  if (params.has('unit')) { unitSelect.value = params.get('unit'); selectedUnit = params.get('unit'); }
  if (params.has('explode')) {
    const v = clamp(parseFloat(params.get('explode')) || 0, 0, 1);
    explodeAmount = v;
    document.getElementById('explode-slider').value = String(Math.round(v * 100));
  }
  if (params.has('crown')) { setCrownOut(params.get('crown') === 'out'); updateCrownUI(); }
  // Fraction of the 30h reserve (RESERVE_BARREL_TURNS), same 0..1 tension
  // vocabulary __clock.setPose's p.tension already uses — so winding has
  // somewhere to go on load instead of starting flat against the full stop.
  if (params.has('reserve')) barrelWindTurns = clamp(parseFloat(params.get('reserve')) || 0, 0, 1) * RESERVE_BARREL_TURNS;
  // Scripts run LAST: they immediately re-pose the view through step 0
  // anyway (any preset/xray/etc. set above is about to be overridden), so
  // nothing above is wasted work, just a base state the script doesn't own.
  if (params.has('tour')) { askTour(() => scriptStart(TOUR_STEPS, document.getElementById('btn-tour'))); return; }
  if (params.has('demo')) { scriptStart(DEMO_STEPS, document.getElementById('btn-demo')); return; }
}
applyDeepLink();

// ---------------------------------------------------------------------------
// Animation loop — fixed-timestep accumulation for the sim; render on rAF.
// ---------------------------------------------------------------------------
const FIXED_DT = 1 / 240;
// Tick budget (BUILT §14). The fixed-step loop used to hand a SLOW machine
// MORE work per frame — 12 full ticks at the 0.05 s realDt clamp, ~250 during
// a sync catch-up — exactly backwards. A frame now gets at most `tickBudget`
// fixed steps; any remainder is consumed in coarse strides (see advanceFrame).
const TICK_DT_CLAMP = 0.25; // tick()'s own rawDt clamp (non-FF): the largest dt its integrations
                            // accept without discarding time — a coarse stride must never exceed it,
                            // or τ would silently lose the clamped-away remainder
const REAL_DT_CLAMP = 0.05; // frame()'s cap on wall-clock delta: a stalled tab resumes as ONE
                            // slow frame, not a burst of catch-up ticks (the pre-§14 literal, named
                            // so the budget below derives from the same constraint frame() enforces)
const TICK_BUDGET_FULL = Math.ceil(REAL_DT_CLAMP / FIXED_DT); // = 12: the realDt clamp's worth of fixed
                                                              // steps — the most a 1× frame can ever
                                                              // demand, so the full budget changes
                                                              // nothing outside catch-up
let tickBudget = TICK_BUDGET_FULL; // per-frame fixed-step allowance; the §14 quality tier sets it
let simTime = 0;
let accumulator = 0;
let lastNow = performance.now();
let lastAutoSaveTime = 0;

// --- Frame-time readout (BUILT §14) ----------------------------------------
// The gate for every performance change — the TODO.md item 4 lesson (a
// native-code plan died to a 0.04 ms profile): no optimisation claims a win
// unless this number moves. The EMA tracks the RAW rAF interval, unclamped,
// so it reads the display cadence itself rather than the sim's realDt clamp.
const FRAME_EMA_ALPHA = 0.1; // ~10-frame settle — fast enough to watch a tier change land, slow enough not to flicker
const FRAME_STALL_MS = 250;  // = tick()'s own 0.25 s rawDt clamp: past it the sim already treats the gap as a stall
                             // (backgrounded tab, debugger), not render cost — such samples would poison the EMA for seconds
let frameMsEma = 0;
let ticksThisFrame = 0;      // tick() calls in the last advanceFrame — the "12× per frame on a slow machine" number, made visible
let perfReadoutMs = 0;       // ms since the panel text was last painted

// --- Quality tiers (BUILT §14) ---------------------------------------------
// One knob instead of three: a tier sets the pixel-ratio cap (the renderer's
// antialias flag is context-creation-time and can't change, but its cost
// scales with the same fragment count the cap controls), the two shadow map
// sizes (shadows are the biggest fixed cost in this scene: key 2048² + rim
// spot 1024² under PCFSoftShadowMap), and the tick budget. High IS the
// pre-§14 configuration, verbatim.
const QUALITY_TIERS = {
  //                pixel-ratio cap: 2 = the original min(dpr, 2); 1.5 ≈ half
  //                the fragments of 2× on a retina laptop; 1 = a quarter.
  //                shadow px: Balanced halves each map edge (¼ the texels);
  //                Low stops casting entirely (0 = castShadow off).
  //                tickBudget: fractions of the full clamp's 12 — Low turns a
  //                20 fps frame's 12 ticks into 3 fixed + 1 coarse stride.
  High:     { pixelRatioCap: 2,   keyShadowPx: 2048, rimShadowPx: 1024, tickBudget: TICK_BUDGET_FULL },
  Balanced: { pixelRatioCap: 1.5, keyShadowPx: 1024, rimShadowPx: 512,  tickBudget: TICK_BUDGET_FULL / 2 },
  Low:      { pixelRatioCap: 1,   keyShadowPx: 0,    rimShadowPx: 0,    tickBudget: TICK_BUDGET_FULL / 4 },
};
const TIER_LADDER = ['High', 'Balanced', 'Low'];
let qualityMode = 'Auto'; // the panel select: Auto or a pinned tier
let qualityTier = 'High'; // the tier actually applied right now
function applyQualityTier(name) {
  qualityTier = name;
  const t = QUALITY_TIERS[name];
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, t.pixelRatioCap)); // re-sizes the buffer itself
  for (const [light, px] of [[keyLight, t.keyShadowPx], [rimSpot, t.rimShadowPx]]) {
    light.castShadow = px > 0;
    if (px > 0) light.shadow.mapSize.set(px, px);
    // An allocated map keeps its old size, so drop it — the next shadow pass
    // reallocates at the new one (and a non-casting light holds no map).
    if (light.shadow.map) { light.shadow.map.dispose(); light.shadow.map = null; }
  }
  tickBudget = t.tickBudget;
}
// Auto-select walks DOWN only. The readout's EMA is the rAF interval, which
// is vsync-floored: a machine with 10× headroom and one barely keeping up
// both read ~16.7 ms at 60 Hz, so "fast enough to step back up" is invisible
// from here — starting at High and stepping down until frames keep up is the
// only honest read of this signal. The panel select overrides at any time.
const TIER_DOWN_MS = 1000 / 30; // sustained above one 30 fps frame = missing every other 60 Hz vsync
const TIER_HOLD_MS = 3000;      // after any change, let the EMA (~10-frame settle) and the
                                // recompile/realloc hitch of the change itself wash out before judging again
let tierHoldUntil = 0;          // set at boot below: startup shader compiles look like slow frames
function autoTierUpdate(now) {
  if (qualityMode !== 'Auto' || frameMsEma === 0 || now < tierHoldUntil) return;
  if (frameMsEma > TIER_DOWN_MS) {
    const next = TIER_LADDER[TIER_LADDER.indexOf(qualityTier) + 1];
    if (next) {
      applyQualityTier(next);
      tierHoldUntil = now + TIER_HOLD_MS;
    }
  }
}
const qualitySelect = document.getElementById('quality-select');
function setQualityMode(mode) {
  qualityMode = QUALITY_TIERS[mode] ? mode : 'Auto';
  // Auto re-earns its way down from High rather than trusting a stale verdict.
  applyQualityTier(qualityMode === 'Auto' ? 'High' : qualityMode);
  tierHoldUntil = performance.now() + TIER_HOLD_MS;
  qualitySelect.value = qualityMode;
}
qualitySelect.addEventListener('change', () => setQualityMode(qualitySelect.value));
setQualityMode(restoredQualityMode); // persisted panel choice (state.js); default Auto

const projected = new THREE.Vector3();

// What the HANDS read, in seconds. τ alone is the movement's own elapsed
// time and ignores hand-setting entirely — which is why the panel used to
// disagree with its own dial the moment the crown was turned. The hands are
// τ displaced by the setting offset and the dial epoch, so the readout is
// too, converted back through the minute hand's own rate.
let handSetOffsetNow = 0; // last value tick() gave the hands
function displayedSeconds() {
  return tauIntegrated + (handSetOffsetNow + DIAL_EPOCH_ANGLE) / MIN_HAND_RAD_PER_SEC;
}

// 12-hour, like the dial it mirrors — a 24-hour readout beside a 12-hour
// dial invites the reader to trust a distinction the hands cannot make.
// (DIAL_PERIOD_S is hoisted up with the alarm detent constants — the alarm
// star's tooth count needs it during the dial geometry build.)
function formatTime(displaySeconds) {
  const total = Math.floor(((displaySeconds % DIAL_PERIOD_S) + DIAL_PERIOD_S) % DIAL_PERIOD_S);
  const hh = Math.floor(total / 3600) || 12; // 0 o'clock reads as 12
  const mm = Math.floor(total / 60) % 60;
  const ss = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return `${hh}:${pad(mm)}:${pad(ss)}`;
}

// --- Alarm setting, derived through the disc (BUILT §24) -------------------
// The crown drives the disc 1:1 and the disc is FRICTION-SET, so the pointer
// renders the crown angle CONTINUOUSLY (it holds wherever you leave it). The
// set TIME is DERIVED from that angle (Rule 2 — never assigned from the panel),
// read to the nearest quarter mark on the ring (ALARM_STEP_SECONDS). The period
// + step constants are hoisted above the geometry; only the derivations, which
// read the live alarmCrownRotation, stay here.
function alarmDiscAngle() {
  // §25 C stage 3: the hand angle now ARRIVES THROUGH THE TRAIN (Rule 2) —
  // crown → bevel pair (1:1) → arbor pinion (10) → idler (32, drops out of
  // the ratio) → setting wheel (30) on the tube. One crown rev = 10/30 of a
  // hand rev = 4 h of alarm time: three crown turns sweep the dial, a finer
  // feel than §24's 1:1. Wrapped into one turn — the 12 h hand-angle space.
  const a = alarmSetRot * ALARM_SET_RATIO; // §25 C winding: the SET path's banked rotation — winding does not move the hand
  return ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
}
function alarmMarkIndex() {
  // Which quarter-hour mark the HAND is nearest — for the readout and the
  // ding target. (Not a physical detent; the friction coupling has none.)
  // §25 C stage 3: the marks live in hand-angle space, so the crown's raw
  // angle goes through the setting-train ratio first — the same 10/30 the
  // gears deliver (reading the crown directly was correct only while the
  // coupling was 1:1).
  return Math.round((alarmSetRot * ALARM_SET_RATIO) / ALARM_MARK_PITCH);
}
function alarmTargetSeconds() {
  // The nearest quarter mark, wrapped into one 12 h turn.
  const idx = ((alarmMarkIndex() % ALARM_MARK_STEPS) + ALARM_MARK_STEPS) % ALARM_MARK_STEPS;
  return idx * ALARM_STEP_SECONDS;
}
// (The hammer's strike angle used to be defined here as a half-sine of the
// striking phase. §25 replaced it with alarmHammerAngle() up at the striking
// works, where it is read off the PIN that is actually holding the tail.)

function updateExplode() {
  const UNIT = 4;
  for (const e of explodeEntries) {
    // With one unit selected, the plates co-lift to their own full-explode
    // positions: a lone unit rising through a parked three-quarter plate or
    // dial would pass straight through them, and the full-explode exit path
    // is already known to be clean.
    const group = EXPLODE_GROUPS.get(selectedUnit);
    const inGroup = group ? group.get(explodeEntryName(e)) : undefined;
    const lifts = selectedUnit === 'All'
      || explodeEntryName(e) === selectedUnit
      || inGroup !== undefined
      || e.obj === threeQuarterPlate || e.obj === dialGroup;
    const layer = inGroup !== undefined ? inGroup : e.layer; // group staging overrides only while the group is selected
    e.obj.position.z = e.baseZ + (lifts ? explodeAmount : 0) * e.dir * layer * UNIT;
  }
}

function updateLabels() {
  if (!labelsOn) return;
  // Parts registered AFTER the UI was built get their elements created on
  // demand — the chain registers its label lazily on the first tick (its
  // mesh is built inside updateChain), so labelEntries outgrows the
  // setup-time labelEls by one. Indexing the missing element used to throw
  // here, and the uncaught exception killed the rAF loop: rendering, sim
  // and camera controls all froze the moment labels were enabled.
  while (labelEls.length < labelEntries.length) {
    const el = document.createElement('div');
    el.className = 'clock-label';
    el.textContent = labelEntries[labelEls.length].name;
    labelsContainer.appendChild(el);
    labelEls.push(el);
  }
  const w = window.innerWidth, h = window.innerHeight;
  for (let i = 0; i < labelEntries.length; i++) {
    const { name, obj } = labelEntries[i];
    const el = labelEls[i];
    const labelGroup = EXPLODE_GROUPS.get(selectedUnit);
    if (selectedUnit !== 'All' && name !== selectedUnit && !(labelGroup && labelGroup.has(name))) { el.style.display = 'none'; continue; }
    obj.getWorldPosition(projected);
    projected.project(camera);
    const behind = projected.z > 1;
    if (behind) { el.style.display = 'none'; continue; }
    el.style.display = 'block';
    el.style.left = `${(projected.x * 0.5 + 0.5) * w}px`;
    el.style.top = `${(-projected.y * 0.5 + 0.5) * h}px`;
  }
}

function tick(t) {
  // dt since the last tick — needed because τ is now a genuinely integrated
  // quantity (the balance's own accumulated phase), not a pure function of
  // t. Clamped so a long stall (e.g. a backgrounded tab) can't blow up the
  // damping integration below.
  // Fast-forward relaxes the clamp: FF advances in 2 s strides on purpose.
  const rawDt = clamp(t - lastTickRawT, 0, fastForward ? 2.5 : TICK_DT_CLAMP);
  lastTickRawT = t;

  // Lever swing: eases toward the crown's target position (independent of
  // — and slightly slower than — the contact damping itself, since the arm
  // physically has to travel before the pad even touches the rim).
  const engageTarget = crownOut ? 1 : 0;
  leverEngage += (engageTarget - leverEngage) * (1 - Math.exp(-rawDt / 0.12));
  crownPullT = lerp(crownPullT, engageTarget, 1 - Math.exp(-rawDt * 10));

  // Crown clutch: which real gear path the sliding pinion is meshing is
  // decided by where it PHYSICALLY is (crownPullT), not the raw crownOut
  // target — mid-slide it's out of mesh with both, same as a real clutch
  // in transit. The Wind button just queues rotation into the SAME input
  // (crownRotation) a manual drag would produce, so it drives this exact
  // path rather than a parallel shortcut.
  const windEngaged = crownPullT < 0.5;
  const setEngaged = crownPullT > 0.5;
  if (autoWindRemaining > 0 && windEngaged) {
    const step = Math.min(autoWindRemaining, AUTO_WIND_RATE * rawDt);
    crownRotation += step;
    autoWindRemaining -= step;
  }
  const crownRotDelta = crownRotation - lastCrownRotation;
  lastCrownRotation = crownRotation;
  if (windEngaged) {
    windPathRot += crownRotDelta;
    // One-way click: only forward turns bank reserve (a real ratchet pawl
    // free-wheels backward without unwinding the spring) — but the visible
    // gears below still turn both ways, since they're rigidly meshed to
    // the crown regardless of which way it's driven.
    if (crownRotDelta > 0) {
      // Ratio chain gives the ratchet's rotation in RADIANS; barrelWindTurns
      // is in TURNS, hence the /2π.
      const turnsDelta = crownRotDelta * (windPinionTeeth / crownWheelTeeth) * (crownWheelTeeth / RATCHET_TEETH) / (2 * Math.PI);
      const beforeTurns = barrelWindTurns;
      barrelWindTurns = clamp(barrelWindTurns + turnsDelta, 0, RESERVE_BARREL_TURNS);
      // Only what actually banked moves the ratchet/fusee: at full reserve
      // the chain is fully home and the cone stops, however hard you crank.
      windAccumTurns += barrelWindTurns - beforeTurns;
    }
  }
  if (setEngaged) {
    setPathRot += crownRotDelta; // bidirectional — no ratchet on the setting path
  }
  // Drain: the barrel does 1 turn per 8h of movement time actually elapsed
  // (same relationship RESERVE_BARREL_TURNS is built from), so it only
  // drains while the balance is actually turning — uses balanceRate as it
  // stood at the END of the last tick, a one-frame lag that's imperceptible
  // but avoids a circular dependency (this frame's rate depends on tension,
  // which depends on this drain).
  barrelWindTurns = clamp(barrelWindTurns - (balanceRate * rawDt) / (8 * 3600), 0, RESERVE_BARREL_TURNS);
  const tension = clamp(barrelWindTurns / RESERVE_BARREL_TURNS, 0, 1);

  // Contact damping: the balance's own angular rate relaxes toward 0 when
  // EITHER the hack lever is braking it OR the mainspring has nothing left
  // to drive it — both are really "ran out of what keeps it going" — and
  // relaxes back toward 1 as either cause clears. Real per-frame decay
  // toward a moving target, not a snap — it settles over roughly a beat.
  const rateTarget = (1 - leverEngage) * (tension > 0 ? 1 : 0);
  const rateTau = rateTarget < balanceRate ? LEVER_DAMP_TAU : LEVER_RELEASE_TAU;
  balanceRate += (rateTarget - balanceRate) * (1 - Math.exp(-rawDt / rateTau));

  // Movement time τ is the running integral of the balance's own rate — the
  // escapement and gear train below only ever see τ, so when balanceRate is
  // damped to ~0 they stop as a mechanical consequence of the balance being
  // stalled, not because anything told them to.
  tauIntegrated += balanceRate * rawDt;

  const tau = tauIntegrated;
  const fourthA = fourthAngle(tau); // the REAL fourth wheel's angle — never adjusted below

  // Reset hammer: while the roller is seated on the cam (leverEngage > 0),
  // ease the seconds-display reference toward the real fourth wheel's
  // current angle — this is what actually "cams the wheel to zero" for
  // display purposes, without touching fourthA/fourthArbor itself. The
  // pull rate is scaled by leverEngage so it's a soft touch on first
  // contact and a firm hold once fully closed; once leverEngage decays to
  // 0 the reference is simply left where it last settled.
  if (leverEngage > 0.001) {
    // Heart-cam physics: the hammer drives the cam to its notch by the
    // SHORTEST path — that is the entire point of the heart shape; under
    // the hammer it can never turn more than half a revolution. But
    // fourthA is a continuous angle (never wrapped), so the display
    // residual (fourthA − secondsZeroRef) accumulates a whole turn per
    // minute since the last reset, and easing the raw residual spun the
    // cam (and seconds hand) through every one of those turns. First
    // re-normalize the reference by whole turns — a change of exactly
    // 2πk, invisible to every rotation.z consumer — then ease only the
    // ≤ half-turn remainder, exactly what the real cam would do.
    secondsZeroRef += Math.round((fourthA - secondsZeroRef) / (2 * Math.PI)) * 2 * Math.PI;
    secondsZeroRef += (fourthA - secondsZeroRef) * leverEngage * (1 - Math.exp(-rawDt / CAM_SNAP_TAU));
  }

  // Gear train + escapement.
  const escA = escapeAngle(tau);
  escapeArbor.rotation.z = escA;
  fourthArbor.rotation.z = fourthA; // the REAL wheel — always undisturbed by the reset above
  thirdArbor.rotation.z = thirdAngle(tau);
  centerArbor.rotation.z = centerAngle(tau);
  barrelArbor.rotation.z = barrelMeshAngle(tau);

  // NEGATIVE swing: the fork notch and impulse pin rotate about centres on
  // opposite sides of their contact point, so for the tip to move WITH the
  // pin (gear-mesh style) the fork's angular sign must oppose the balance's.
  forkGroup.rotation.z = forkBaseAngle - forkSwingRad(tau);

  const theta = balanceTheta(tau, tension);
  balanceGroup.rotation.z = PIN_AIM + theta;
  // The spring's outer end is PINNED (stud on the cock): winding is a
  // geometry change — the inner boundary follows the staff while the
  // outer terminal holds still (precomputed keyframes; see makeHairspring).
  hairspring.userData.setWind(theta);

  // Setting path: settingWheel -> minuteArbor (compound wheel+pinion) ->
  // the RAW hand-set angle, derived forward through the real tooth counts.
  const settingWheelSpin = -setPathRot * (windPinionTeeth / settingWheelTeeth);
  const minuteArborSpin = -settingWheelSpin * (settingWheelTeeth / minuteWheelTeeth);
  const rawSetOffset = -minuteArborSpin * (minutePinionTeeth / cannonPinionTeeth);
  // JUMPING-MINUTE SETTING: while the crown is out, the jumper is in the
  // star and the DISPLAYED offset is quantized so the minute hand sits on
  // exact minute indices — the raw input winds against the jumper spring
  // and the hand SNAPS one detent at a time (eased on the CAM_SNAP_TAU
  // convention). On push-in the achieved snap is folded into a persistent
  // correction so the hand never springs back to the raw phase; running
  // then resumes continuously with the jumper lifted clear.
  const jmpEngaged = crownPullT > 0.5;
  {
    const minuteBase = centerAngle(tau) - centerAt0; // frozen while hacked (pull also hacks)
    const MIN_PITCH = (Math.PI * 2) / 60;
    if (jmpEngaged) {
      const target = Math.round((minuteBase + rawSetOffset + jumpCorr) / MIN_PITCH) * MIN_PITCH - minuteBase;
      jumpSnapIdx = Math.round((minuteBase + target) / MIN_PITCH); // absolute minute index — the sound block's edge source
      if (jumpDisp === null) jumpDisp = target;
      jumpDisp += (target - jumpDisp) * (1 - Math.exp(-rawDt / CAM_SNAP_TAU));
    } else if (jumpDisp !== null) {
      jumpCorr = jumpDisp - rawSetOffset; // fold the snap in; no spring-back
      jumpDisp = null;
    }
  }
  const handSetOffset = jumpDisp !== null ? jumpDisp : rawSetOffset + jumpCorr;
  handSetOffsetNow = handSetOffset; // the readout reads what the HANDS read (see displayedSeconds)

  // Hands: driven by the same train functions, but zero-referenced against
  // t=0 so the dial reads 12:00:00 at sim start (the raw angles carry the
  // arbitrary tooth-interleaving phase constants), plus handSetOffset from
  // manual time-setting. Sign notes: centerAngle decreases with t (−2π per
  // sim hour); a hand's local +Z axis points toward the viewer on the dial
  // (-Z) side through dialFace's Y-flip, so a decreasing local rotation
  // reads as a clockwise sweep from the front — the raw deltas already
  // have the right sense.
  const minuteA = centerAngle(tau) - centerAt0 + handSetOffset + DIAL_EPOCH_ANGLE; // −2π per hour
  minuteHand.rotation.z = minuteA;
  // Hour hand: NOT minuteA/12. The angle is carried through the motion
  // works' two real meshes — cannon pinion → minute wheel, then minute
  // pinion → hour wheel — from their tooth counts, the same way every
  // wheel in the going train is driven. It arrives at minuteA/12 because
  // the ratios multiply to 1/12, not because we divided by 12. The hour
  // hand is a child of hourWheelGroup, so rotating the wheel moves it.
  const mwMinuteA = minuteA * MW_RATIO_1;      // minute wheel + its pinion
  const mwHourA = mwMinuteA * MW_RATIO_2;      // hour wheel (and its tube)
  mwArbor.rotation.z = mwMinuteA;
  // Minute jumper: the star is a child of mwArbor, so its dial-frame turn
  // is mwMinuteA plus its build phase; the beak's tip rides the V profile
  // passing its azimuth, on top of the crown-driven lift (crownPullT is
  // already eased, so engagement is smooth). While running with the crown
  // in, the lever holds clear of the points by the derived lift.
  {
    const starTurn = minuteStar.rotation.z + mwMinuteA;
    let u = ((JMP_TIP_AZ - starTurn) / STAR_PITCH) % 1;
    if (u < 0) u += 1;
    const rU = STAR_R - 2 * STAR_DEPTH * Math.min(u, 1 - u); // V profile: tips at u=0, valley at 0.5
    // Exact ride (see jmpRideForSeatRadius above) — below the seat radius
    // the beak simply stays seated (ride 0); above it, the true circle
    // solve, not the seat-tangent line, so the tip's swept radius matches
    // the star's local profile EXACTLY through the whole point→valley arc.
    const ride = rU > JMP_TIP_SEAT_R ? jmpRideForSeatRadius(rU) : 0;
    const lift = (1 - crownPullT) * JMP_LIFT_ROT;
    jumperLever.rotation.z = JMP_LIFT_SIGN * Math.max(ride * crownPullT, lift);
    // Lifter link (lost-motion bar): follower drawn from the setting
    // lever's tail post — at this plane's movement-frame z — to the
    // jumper's tail pin, both transformed into the dialFace frame.
    const jmpPost = tailPostWorldAt(crownPullT); // (postNow is computed later in tick — same expression)
    _jmpPostW.set(jmpPost.x, jmpPost.y, JMP_WORLD_Z);
    jumperUnit.worldToLocal(_jmpPostW);
    jumperTailPin.getWorldPosition(_jmpPinW);
    jumperUnit.worldToLocal(_jmpPinW);
    const ldx = _jmpPinW.x - _jmpPostW.x, ldy = _jmpPinW.y - _jmpPostW.y;
    const llen = Math.hypot(ldx, ldy) || 1;
    jumperLifter.position.set((_jmpPostW.x + _jmpPinW.x) / 2, (_jmpPostW.y + _jmpPinW.y) / 2, JMP_LIFT_LOCAL_Z);
    jumperLifter.rotation.z = Math.atan2(ldy, ldx);
    jumperLifter.scale.x = llen;
  }
  hourWheelGroup.rotation.z = mwHourA;
  // Small seconds at 6: same expression the old central hand used (−2π per
  // minute, re-referenced on reset) — the CW-from-front sense is already
  // verified for dialFace children.
  smallSecondsHand.rotation.z = fourthA - secondsZeroRef;
  cannonPinion.rotation.z = minuteA;

  // Mainspring relax — a direct readout of tension now that winding is
  // continuous rather than a discrete button press (no more settle-pulse
  // to blend against).
  if (springChild) {
    springChild.rotation.z = tension * Math.PI * 1.4;
    springChild.scale.setScalar(1 + (1 - tension) * 0.06);
  }

  // Hacking seconds: the stem/crown/winding-pinion group's position along
  // the stem axis (local +Y = outward) — crownPullT itself was updated at
  // the top of tick(), before the clutch routing above needed it.
  const crownOutDist = pinDist + crownPullT * CROWN_PULL_DIST;
  windSpinner.position.set(uWind.x * crownOutDist, uWind.y * crownOutDist, Z_KEYLESS);

  // Setting-lever linkage: the lever's angle is SOLVED from where the stem's
  // groove actually is right now (crownPullT), so the beak pin stays in the
  // groove through the whole slide; the yoke does the same against the
  // sliding pinion's hub. The stop crank is NOT keyframed either: the hack
  // rod is rigid, so the crank's angle is solved from the post's actual
  // position each frame (updateStopWork) — crown out levels the pad arm
  // onto the rim's underside, crown in drops it the derived release gap.
  settingLeverGroup.rotation.z = settingLeverAngleAt(crownPullT);
  yokeGroup.rotation.z = yokeAngleAt(crownPullT);
  const postNow = tailPostWorldAt(crownPullT);
  updateStopWork(postNow);

  // Reset hammer + heart cam: the hammer is DRIVEN by the rigid connecting
  // rod — its angle is solved from the setting-lever post's position through
  // the rod constraint, so the whole linkage moves as the four-bar it is.
  // The display arbor (cam + through rod + hand hub) carries the NEGATED
  // hand value: a movement-frame rotation reads mirrored from the front
  // through the dialFace Y-flip, so −(fourthA − secondsZeroRef) here and
  // +(fourthA − secondsZeroRef) on the dialFace-mounted hand are the same
  // physical rotation seen from opposite sides — the same slip-coupling
  // sign convention the reserve train uses. At reset both go to 0 and the
  // cam sits at camPhaseOffset, so the hammer-seat calibration is
  // unaffected by the sign. (postNow is computed up at the setting-lever
  // block — the same post drives the hack ramp collar.)
  hammerGroup.rotation.z = solveHammerRotation(postNow);
  secondsCamArbor.rotation.z = -(fourthA - secondsZeroRef) + camPhaseOffset;

  // Reset-hammer rod: rigid — constant length by construction; just placed
  // between its two pins.
  {
    const b = prevTailTip; // the tail tip the solve just landed on
    const dx = b.x - postNow.x, dy = b.y - postNow.y;
    resetRod.position.set((postNow.x + b.x) / 2, (postNow.y + b.y) / 2, ROD_PLANE_Z);
    resetRod.rotation.z = Math.atan2(dy, dx) - Math.PI / 2;
  }

  // Keyless works — the stem always spins with the crown; the two
  // downstream paths below only reflect rotation actually delivered to
  // THEM (windPathRot / setPathRot), so whichever one is disengaged simply
  // holds still — a genuine consequence of the clutch routing above, not a
  // separate "which am I animating" branch here.
  //
  // SIGN CHAIN, derived from the one physically-forced sense and counted
  // back through the meshes (it used to be assembled by convention, which
  // wound the watch counter-clockwise AND co-rotated an external mesh):
  //  · ANCHOR: the fusee must turn CW-from-the-back (−z) to gather chain
  //    (the wrap math in rebuildChain) → windBack < 0 while winding.
  //  · The winding SPUR is keyed to that arbor: also −.
  //  · The TRANSFER wheel meshes the spur EXTERNALLY: must counter-rotate
  //    → +, and the crown wheel is keyed to it → +. Hence the POSITIVE
  //    sign below (the old −windPathRot slid the transfer⇄spur teeth
  //    through each other — masked only by how slowly they turn).
  //  · The winding PINION engages the crown wheel's rim on the side
  //    facing the movement centre; for the wheel to turn + (CCW from the
  //    back) the pinion's contact-point velocity there fixes the stem's
  //    sense: winding rotation appears CLOCKWISE viewed from the crown's
  //    outer end — the horological convention. Positive crownRotation
  //    (drag right / Wind button) IS the banking direction, so the visual
  //    spin about the outward stem axis is its negation.
  windSpinner.rotation.y = -crownRotation;

  const crownWheelSpin = windPathRot * (windPinionTeeth / crownWheelTeeth);
  crownWheel.rotation.z = crownWheelBase + crownWheelSpin;
  transferWheel.rotation.z = crownWheel.rotation.z; // keyed to the same arbor
  {
    // Winding spur, let-down square and fusee cone are keyed together,
    // and their rotation is a pure function of chain hauled: −2π per
    // BANKED winding turn (backwards against the train direction, exactly
    // one cone turn per turn of chain pulled home), riding on the arbor's
    // own train rotation. Raw crown input past full reserve moves none of
    // them — the chain is home.
    const windBack = -windAccumTurns * Math.PI * 2;
    windSpur.rotation.z = windSpurBase + windBack;
    windTop.rotation.z = windBack;
    fusee.rotation.z = windBack;
    updateMaintaining(windBack);
    pfUpdate();

    // --- SOUND edge detection (BUILT §8). Discrete events off the
    // continuous phases this tick just computed. All suppressed in
    // fast-forward (~5400× would machine-gun the beat) and in the sync
    // catch-up (up to 21× is a ~105 Hz buzz, the same failure in miniature),
    // and capped at 3 transients per source per tick with small time offsets
    // so a clamped-but-large rawDt (tab restore) hiccups gracefully.
    if (soundOn && !fastForward && syncPhase !== 'catchup') {
      // Force matrixWorld current for this tick's emitters (BUILT §11):
      // three.js only recomputes it on render, and up to 12 ticks can run
      // per displayed frame, so an un-forced snapshot would read stale
      // (last-frame) positions for anything rotated earlier in this tick.
      movement.updateMatrixWorld(true);
      // Escapement beat — a three-impact cluster per beat (unlock, impulse,
      // drop+lock; see SND.beatEvent), each fired as the frame steps across
      // its phase boundary. Events crossed in ONE frame are scheduled at
      // their true wall-clock offsets from the previous frame's phase, so
      // the unlock→impulse gap survives frames longer than itself.
      const bev = beatEventCount(tau);
      const rawNow = tau * 2 * F_BALANCE;
      if (sndBeatN !== null && bev > sndBeatN) {
        const from = Math.max(sndBeatN, bev - 6); // ≤ 2 beats per hiccup
        for (let c = from + 1; c <= bev; c++) {
          const ev = c - 1;
          const kind = ev % 3;
          const beat = Math.floor(ev / 3);
          const evRaw = beat + SND_BEAT_EVENTS[kind];
          const w = Math.min(Math.max((evRaw - sndBeatRaw) / (2 * F_BALANCE) / timeScale, 0), 0.15);
          SND.beatEvent(kind, beat % 2 === 0, w);
        }
      }
      sndBeatN = bev; sndBeatRaw = rawNow;
      // Maintaining pawls while winding — one tooth passage = one snap
      // (the two pawls sit exactly 12 of 24 pitches apart: unison).
      const pawlIdx = Math.floor((MAINT_PAWL_TIP_AZ - windBack) / ((Math.PI * 2) / MAINT_TEETH));
      if (sndPawlIdx !== null && pawlIdx !== sndPawlIdx) {
        const n = Math.min(Math.abs(pawlIdx - sndPawlIdx), 3);
        for (let i = 0; i < n; i++) SND.pawl(i * 0.03);
      }
      sndPawlIdx = pawlIdx;
      // Maintaining detent while running — one soft tick per 20 min of
      // movement time (barrel 1 rev/8 h × 24 rim teeth).
      const detIdx = Math.floor((barrelArbor.rotation.z - MAINT_DETENT_AZ) / ((Math.PI * 2) / MAINT_TEETH));
      if (sndDetIdx !== null && detIdx !== sndDetIdx) SND.detent();
      sndDetIdx = detIdx;
      // Minute jumper snap while setting.
      if (jumpSnapIdx !== null) {
        if (sndJumpIdx !== null && jumpSnapIdx !== sndJumpIdx) SND.jump();
        sndJumpIdx = jumpSnapIdx;
      } else sndJumpIdx = null;
      // Crown stem click (both directions) + the reset hammer's fall
      // (once per pull, as the lever seats).
      if (sndCrownOut !== null && crownOut !== sndCrownOut) SND.stem();
      sndCrownOut = crownOut;
      if (leverEngage > 0.85 && !sndHammerHit) { SND.hammer(); sndHammerHit = true; }
      if (leverEngage < 0.15) sndHammerHit = false;
      // (The alarm's ding is fired per hammer strike by the alarm power loop
      // below — it rings mechanically whether or not sound is on, so it is not
      // in this soundOn-gated block; SND.alarmStrike self-gates the audio.)
    } else {
      // Keep trackers current while muted/FF so re-enabling is silent.
      sndBeatN = null; sndBeatRaw = null; sndPawlIdx = null; sndDetIdx = null; sndJumpIdx = null;
      sndCrownOut = crownOut;
    }
  }

  // --- Alarm: release + spring-powered strike (BUILT §24) ------------------
  // The alarm is a real complication, not a scripted effect. Its TRIP is the
  // hour position crossing the set position — two gear-derived angles (the
  // hour off the motion works, the disc off the alarm crown), the same forward
  // prev-value edge the beat/detent sound uses. Its STRIKE is powered by the
  // alarm barrel (alarmBarrelWind) draining through the striking train: the
  // ring lasts exactly as many strikes as the spring drives, then STOPS for
  // want of power (Rule 2 — the hammer is not scripted). Not gated on soundOn:
  // the alarm rings mechanically whether or not audio is on; soundOn only
  // decides whether each strike is heard (SND.alarmStrike self-gates). Held
  // through fast-forward / sync catch-up like every other sound edge.
  if (!fastForward && syncPhase !== 'catchup') {
    // Trip (§25 B): the feeler IS the rattrapante follower — armed, its nose
    // drops into the heart's notch exactly when the hour wheel's angle
    // reaches the held tube's, and that PHYSICAL alignment (rel crossing 0)
    // is now the release. §24's seconds-space comparison is retired; the
    // guards keep their meaning in angle space (the hour wheel turns
    // clockwise ⇒ rel falls; a jump of more than half a turn in one tick is
    // a hand-set wrap, not a crossing).
    const rel = wrapPi(mwHourA - alarmTubeShownA);
    if (alarmOn && alarmBarrelWind > 0 && !alarmReleased && alarmPrevRel !== null) {
      const step = wrapPi(rel - alarmPrevRel);
      if (step < 0 && step > -Math.PI && alarmPrevRel > 0 && rel <= 0) {
        alarmReleased = true;            // the brake lever swings off the collar — the striking train is free
        // §25 C: the phase CONTINUES from wherever winding parked it (lockstep
        // with the barrel — resetting it here would slip the mesh by however
        // much the last wind was short of full).
        alarmStrikeIdx = Math.floor(alarmStrikePhase - ALARM_STRIKE_U);
      }
    }
    alarmPrevRel = rel;
    // Ring: while released, armed and wound, the striking train runs at the
    // cadence the gong wants and the barrel gives up EXACTLY the turning the
    // train takes — one spend, two variables, so §25's geometry cannot drift
    // apart (barrel angle and pin angle are one mesh). One ding per strike,
    // fired when the head actually reaches the wire (ALARM_STRIKE_U into the
    // cycle), not at some abstract whole number. When the barrel empties the
    // train stops and the lock re-seats — the ring ends because it RAN DOWN —
    // and it is re-armed for the next crossing. Turning the alarm OFF re-seats
    // it too, parking the hammer on its check.
    if (alarmReleased && alarmOn && alarmBarrelWind > 0) {
      const spend = Math.min(rawDt / ALARM_STRIKE_GAP / ALARM_STRIKES_PER_BARREL_TURN, alarmBarrelWind);
      alarmBarrelWind -= spend;
      alarmStrikePhase += spend * ALARM_STRIKES_PER_BARREL_TURN;
      const idx = Math.floor(alarmStrikePhase - ALARM_STRIKE_U);
      if (idx > alarmStrikeIdx) { alarmStrikeIdx = idx; SND.alarmStrike(); } // one strike edge = one ding (self-gates on soundOn)
      if (alarmBarrelWind <= 0) alarmReleased = false; // §25 C: no phase reset — run-down is 28 strikes = 7 whole cam revs, already ≡ REST
    } else if (!alarmOn) {
      // §25 C: switching off mid-ring just re-seats the LOCK — the cam holds
      // wherever it is (no phase snap; the hammer parks on the flank it was
      // riding, which is where a held train really leaves it).
      alarmReleased = false;
    }
  } else {
    alarmPrevRel = null; // re-enabling after FF / catch-up stays silent until the next real crossing
  }

  // Fusee chain & drum: the drum's angle is a closed-form function of how
  // much chain has paid onto it. The chain MESH is not rebuilt here — tick
  // only records the tension; updateChainIfMoved() rebuilds once per
  // rendered/posed frame (§14), since the chain is display-only.
  drumGroup.rotation.z = ((1 - tension) * CHAIN_ENGAGED) / DRUM_R;
  chainTensionNow = tension;

  settingWheel.rotation.z = settingWheelBase + settingWheelSpin;
  minuteArbor.rotation.z = minuteWheelBase + minuteArborSpin;
  // Motion-works bevel corners: each meshing pair reverses sense (same as
  // any two external gears meshing), so the sign flips at every corner —
  // drop(+) → traverse(−) → rise(+), landing back on +handSetOffset for the
  // rise/settingCap side since there are 2 corners.
  cornerDrop.gearIn.rotation.z = handSetOffset;
  cornerDrop.gearOut.rotation.z = BEVEL_PHASE - handSetOffset;
  cornerRise.gearIn.rotation.z = -handSetOffset;
  cornerRise.gearOut.rotation.z = BEVEL_PHASE + handSetOffset;
  // Cap pinion at the dial end of the motion-works arbor: spins with the
  // same handSetOffset that actually drives the hands, so the part sitting
  // right beside the cannon pinion visibly turns in step with it — the
  // connection reads as real, not just a static rod poking at the dial.
  settingCap.rotation.z = SETTING_CAP_PHASE + handSetOffset;

  // Power-reserve hand — barrelWindTurns (via tension) IS the mechanical
  // quantity now; no separate epoch/pulse bookkeeping needed since winding
  // is continuous rather than a discrete button press.
  reserveShown = tension;
  reserveHand.rotation.z = (90 - reserveShown * 150) * DEG2RAD; // 150-degree scale, empty end at 9 o'clock (see makeDial's reserve face)

  // Power-reserve reduction gear train (see note above its construction):
  // w2 shares the hand's arbor. The hand lives on the Y-flipped dialFace
  // while the train is in the movement frame, and that flip mirrors rotation
  // sense — so w2 takes the NEGATED hand angle to co-rotate with it as seen
  // from the front. w1/p1 and p0 solve backwards through the mesh ratios.
  const rsvOut = -reserveHand.rotation.z;
  rsvArbor2.rotation.z = rsvOut;
  rsvArbor1.rotation.z = -rsvOut * (rsvTeethW2 / rsvTeethP1);
  rsvArbor0.rotation.z = -rsvArbor1.rotation.z * (rsvTeethW1 / rsvTeethP0);

  // Alarm setting (BUILT §24): the pointer reads the continuous disc angle on
  // the 12 h ring. It rides the Y-flipped dialFace, so rotation.z = −(disc
  // angle) lands it on the ring's hour (the same +90°-zero convention as the
  // reserve hand — see makeDial's alarm face). The movement-side rotor takes
  // the NEGATED angle to co-rotate as seen from the front (same flip as the
  // reserve arbor), carrying the mating bevel; the crown/stem turn with it 1:1.
  // Friction-set — everything moves together, continuously, in lockstep.
  // §25 C winding — the clutch and the two paths. The stem slides with the
  // pull (the same eased-position convention as crownPullT: which path is
  // live is decided by where the bevel PHYSICALLY is, and mid-slide it is
  // out of mesh with both). Crown deltas route to the SET path pushed-in
  // and to the WINDING bank pulled-out; only forward deltas bank, and only
  // what actually banked un-rides the cam — the time crown's one-way
  // convention, applied to §25 A's lockstep pair (wind, phase) so the
  // barrel and the striking cam stay one mesh through winding too.
  alarmCrownPullT = rawDt > 0
    ? lerp(alarmCrownPullT, alarmCrownOut ? 1 : 0, 1 - Math.exp(-rawDt * 10))
    : (alarmCrownOut ? 1 : 0);
  // Pushed-in the bevel rests on the (inner) winding contrate; the pull
  // carries it one throw OUT to the setting corner — wind at rest, pull to
  // set: the Cricket/Memovox convention.
  alarmSpinner.position.set(
    alarmDir.x * (ALARM_CD + alarmCrownPullT * CROWN_PULL_DIST),
    alarmDir.y * (ALARM_CD + alarmCrownPullT * CROWN_PULL_DIST), Z_ALARM_CORNER);
  {
    const aDelta = alarmCrownRotation - lastAlarmCrownRotation;
    lastAlarmCrownRotation = alarmCrownRotation;
    if (alarmCrownPullT > 0.5) {
      alarmSetRot += aDelta;
    } else if (alarmCrownPullT < 0.5 && aDelta > 0) {
      const before = alarmBarrelWind;
      alarmBarrelWind = clamp(alarmBarrelWind + (aDelta / (Math.PI * 2)) * ALARM_WIND_RATIO, 0, ALARM_BARREL_TURNS);
      alarmStrikePhase -= (alarmBarrelWind - before) * ALARM_STRIKES_PER_BARREL_TURN;
    }
  }
  const alarmAngle = alarmDiscAngle();
  // §25 C stage 2 — the rattrapante follow. ARMED: the tube is held at the set
  // time (−alarmAngle: dialFace's Y-flip puts printed hour H at world az
  // 90 + 30·H, verified against the printed numerals — a world-frame-only
  // calibration got the sign backwards once). DISARMED: the follower spring
  // seats the nose in the heart's notch, which IS the hour wheel's angle —
  // live frames ease home along the cam slope (CAM_SNAP_TAU, the jumper-snap
  // convention); the pose path (rawDt = 0) assigns exactly, so inspector
  // poses stay deterministic.
  {
    const tubeTarget = alarmOn ? -alarmAngle : mwHourA;
    // Both transitions EASE live (the pose path assigns exactly): disarming is
    // the spring snapping the follower home along the cam slope, and arming is
    // the re-coupled friction wheel swinging the hand out to the set time —
    // the hand visibly TRAVELS between hiding and showing, either way.
    if (rawDt > 0) {
      alarmTubeShownA += wrapPi(tubeTarget - alarmTubeShownA) * (1 - Math.exp(-rawDt / (alarmOn ? 0.35 : CAM_SNAP_TAU)));
    } else {
      alarmTubeShownA = tubeTarget;
    }
    alarmTubeGroup.rotation.z = alarmTubeShownA;
    // Follower pose — DERIVED from the cam (Rule 2): the nose radius is the
    // heart profile at the contact angle, and the arm angle is the triangle
    // (pivot, dial centre, nose) at that radius. The contact azimuth drifts
    // as the arm lifts, so iterate twice — the second pass moves the answer
    // by < 0.01 rad. Seated (ψ = 0) this lands exactly on ALARM_ARM_A0.
    let contactAz = ALARM_NOSE_AZ;
    let armA = ALARM_FOLLOWER_A0;
    for (let it = 0; it < 2; it++) {
      const psi = contactAz - ALARM_NOSE_AZ + wrapPi(alarmTubeShownA - mwHourA);
      const d = alarmHeartRAt(psi) + ALARM_NOSE_R;
      armA = alarmArmAngleAt(d);
      contactAz = Math.atan2(ALARM_FOLLOWER_LEN * Math.sin(armA), -ALARM_PIVOT_R + ALARM_FOLLOWER_LEN * Math.cos(armA));
    }
    alarmFollowerArm.rotation.z = armA;
    // The blade flexes with the pump (its force is representational; its
    // MOTION is the arm's real lift).
    alarmFollowerSpring.rotation.z = 1.9 + (armA - ALARM_FOLLOWER_A0) * 0.45;
  }
  // §25 C stage 3 — the setting train, derived FORWARD from the crown (Rule
  // 2): arbor 1:1 through the bevels, each external mesh reversing sense.
  // The setting wheel's world rotation lands at crown·(10/30); its dialFace-
  // local write is the negation. The tube's armed target (−alarmDiscAngle())
  // is this same quantity wrapped — the friction coupling closes the loop.
  // Setting-train senses: three external meshes now (wheel⇄i1⇄i2⇄pinion), so
  // the arbor spins OPPOSITE the old two-mesh chain for the same hand motion —
  // the 90° bevel pair's handedness absorbs it (representational sign, as
  // §24's bevels always were). Derived forward: arbor −setRot → i2 +setRot/4
  // → i1 −setRot/4 → wheel world +setRot/3 = the armed tube's world sense.
  // §29 step 2: the branch makes the setting train TOTAL — the crown term
  // (unchanged, §25's verified identity) plus the hour's back-drive through
  // the disc's friction seat. The back-drive flows in BOTH crown positions:
  // pushed in, the rod idles free (the pull IS the clutch); pulled out,
  // nothing detents the crown's ROTATION, so the train slowly back-turns
  // the pulled crown — real Memovox behaviour — and the hub slips only
  // under the user's own setting torque, which is the re-phasing.
  const _bd = ALARM_BD_SIGN * mwHourA;
  alarmRotor.rotation.z = -alarmSetRot - 3 * _bd; // −ω_i1·(28/10) closes the chain on the rod: 3 = ALARM_DISC_TEETH/ALARM_SET_PINION_TEETH
  alarmSetI2Spin.rotation.z = alarmSetRot * (ALARM_SET_PINION_TEETH / ALARM_SET_I2_TEETH)
    - _bd * (ALARM_DISC_TEETH / ALARM_SET_I2_TEETH);
  alarmSetI1Spin.rotation.z = -alarmSetRot * (ALARM_SET_PINION_TEETH / ALARM_SET_I1_TEETH)
    + _bd * (ALARM_DISC_TEETH / ALARM_SET_I1_TEETH);
  // The disc's one law — total in both regimes (running: follows the hour
  // through the friction seat; setting: re-phased through the branch): its
  // dial-frame angle is hour + set-term + the release phase, so the notch
  // sits at the release azimuth exactly when the hands coincide.
  alarmDiscGroup.rotation.z = mwHourA + ALARM_DISC_SIGN * (alarmSetRot * ALARM_SET_RATIO) + ALARM_RELEASE_PHASE;
  // §29 step 3: the pin RIDES the track — its lift IS the surface under it,
  // a pure function of the disc's angle (no ease, no state: setPose poses
  // it exactly). Between the gap's edges the drop ramps over the pin's own
  // arc (a round pin can't fall square past a corner); fully aligned it
  // rests on the bracket's banking stop at ALARM_PIN_DROP.
  {
    const pinArcHalf = ALARM_PIN_R / ALARM_TRACK_RMID;
    const gapHalf = ALARM_NOTCH_W / 2;
    const align = Math.abs(wrapPi(alarmDiscGroup.rotation.z - ALARM_RELEASE_PHASE));
    alarmPinDropNow = align >= gapHalf + pinArcHalf ? 0
      : align <= gapHalf - pinArcHalf ? ALARM_PIN_DROP
      : ALARM_PIN_DROP * ((gapHalf + pinArcHalf - align) / (2 * pinArcHalf));
    alarmFeelerLever.rotation.y = -alarmPinDropNow / ALARM_FEELER_ARM_LEN; // small-angle rock about the pivot
  }
  alarmSetWheelGroup.rotation.z = -alarmSetRot * ALARM_SET_RATIO;
  // §25 C winding train — posed RIGIDLY from the barrel's angle, so winding,
  // ringing and rest are one consistent mesh (while ringing, the train and a
  // pulled-out crown visibly free-spin — what rigid meshing honestly implies).
  {
    const bA = (ALARM_BARREL_TURNS - alarmBarrelWind) * Math.PI * 2;
    alarmWindUnit.userData.i2.rotation.z = -bA * (ALARM_BARREL_TEETH / ALARM_WIND_IDLER_TEETH);
    alarmWindUnit.userData.i1.rotation.z = bA * (ALARM_BARREL_TEETH / ALARM_WIND_IDLER_TEETH);
    alarmWindUnit.userData.climb.rotation.z = -bA * (ALARM_BARREL_TEETH / ALARM_WIND_PINION_TEETH);
    // §29 step 4: the pawl's spring-steel tip follows the contrate tooth
    // profile under it while seated — stateless, like the pin on the track
    // (winding visibly clicks it; the long-ramp/steep-bank saw shape is the
    // one-way convention). The trip's withdrawal comes from the LEVER (the
    // pin side owns that); this flex is only the click's compliance.
    {
      const seatedT = 1 - clamp(alarmPinDropNow / ALARM_PIN_DROP, 0, 1);
      const ph = ((alarmWindUnit.userData.climb.rotation.z * ALARM_BEVEL_TEETH / (2 * Math.PI)) % 1 + 1) % 1;
      const saw = ph < 0.85 ? ph / 0.85 : (1 - ph) / 0.15;
      alarmPawlFlex.position.z = -seatedT * ALARM_PAWL_ENGAGE * 0.9 * saw; // cam-out is plate-ward (−local z), the withdrawal's own direction
    }
  }
  // §25 B + D — the brake and the column-wheel switch. The wheel eases to its
  // stepped angle; the beak's lift comes from the SAME profile the columns
  // were cut from (makeColumnWheel.userData.profileAt), and a beak on a
  // column GATES the brake's lift — the physical "off". The lever's pad sits
  // on the collar whenever the train is held and swings clear while it rings.
  {
    const colTarget = alarmColSteps * ALARM_COL_STEP;
    if (rawDt > 0) {
      alarmColShownA += (colTarget - alarmColShownA) * (1 - Math.exp(-rawDt / 0.10));
    } else {
      alarmColShownA = colTarget;
    }
    alarmColumnWheel.rotation.z = -alarmColShownA; // the wheel turns UNDER the fixed-azimuth beak
    const colBlock = alarmColumnWheel.userData.profileAt(alarmColShownA);
    const liftTarget = (alarmOn && alarmReleased) ? 1 : 0;
    if (rawDt > 0) {
      alarmLockLiftT += (liftTarget - alarmLockLiftT) * (1 - Math.exp(-rawDt / 0.08));
    } else {
      alarmLockLiftT = liftTarget;
    }
    alarmLockLever.rotation.z = ALARM_LOCK_ENGAGED + ALARM_LOCK_LIFT * alarmLockLiftT * (1 - colBlock);
    // The click rocks with the SAME ridden profile (its contact sits whole
    // pitches from the beak's): out on a column, dropped into a gap — the
    // visible flip on every actuation, mid-flank included.
    alarmClickArm.rotation.z = ALARM_CLICK_BASE + ALARM_CLICK_SWING * colBlock;
    // The pusher: presses IN with the actuation pulse and springs back — its
    // pawl rides the ratchet skirt through the same eased step.
    if (rawDt > 0) alarmPusherT *= Math.exp(-rawDt / 0.15); else alarmPusherT = 0;
    alarmPusherGroup.position.set(
      _pushBase.x - _pushU.x * ALARM_PUSH_TRAVEL * alarmPusherT,
      _pushBase.y - _pushU.y * ALARM_PUSH_TRAVEL * alarmPusherT, ALARM_LOCK_Z + 0.17);
  }
  // §29 step 2: PULLED, the crown's bevel is meshed to the rod, and the rod
  // creeps with the hour back-drive (see the branch above) — so the crown
  // visibly back-turns with it, 1:1 through the bevel pair, on top of the
  // user's own drag. Pushed in, the stem rides the winding contrate and the
  // set-side creep never reaches it. BANKED, not gated: pushing in freezes
  // the accumulated creep in the knob's position (disengaging a bevel moves
  // nothing), so the shown angle is continuous through every transition —
  // the §25 lockstep discipline. A session accumulator ⇒ resetInputs owns it.
  if (alarmCrownOut && alarmCrownCreepLastBd !== null)
    alarmCrownCreep += -3 * (_bd - alarmCrownCreepLastBd);
  alarmCrownCreepLastBd = _bd;
  alarmSpinner.rotation.y = alarmCrownRotation + alarmCrownCreep; // free stem, continuous with the drag

  // Alarm striking works (BUILT §25 A). All three poses come off ONE state
  // pair that tick() advances together, so the mesh cannot slip: the barrel's
  // angle IS how far it has unwound from full, the striking wheel steps one
  // pin pitch per strike in the OPPOSITE sense (an external mesh reverses),
  // and the hammer takes whatever angle the pin currently on its tail holds it
  // at. Moved out of frame() and into tick() by §25 — the striker is driven
  // now, so the inspector's 'alarmStrike' axis has to be able to pose it.
  alarmBarrelRotor.rotation.z = (ALARM_BARREL_TURNS - alarmBarrelWind) * Math.PI * 2;
  alarmStrikeRotor.rotation.z = alarmStrikeWheelAngle();
  alarmHammerPivot.rotation.z = alarmHammerAngle();
}

tick(0); // seed correct initial pose before the first paint
updateChainIfMoved(); // first chain build (and its lazy label) — was inside the seed tick before §14

// One frame's worth of simulation, script/sync stepping, camera tween and
// render — everything except the rAF scheduling and autosave. Split out of
// frame() so the verification hook (__clock.advanceFrame) can run the guided
// demo/tour deterministically: rAF is fully paused in a backgrounded
// automation pane, so scripted behaviour cannot be observed through frame().
function advanceFrame(realDt) {
  ticksThisFrame = 0; // §14 readout: how many tick() calls this frame costs
  if (!paused) {
    if (fastForward) {
      // ~5400×: 45 coarse 2 s ticks per frame — the whole 30 h reserve pays
      // off in about 20 s of wall time, chain and reserve hand visibly moving.
      for (let i = 0; i < 45; i++) {
        simTime += 2;
        tick(simTime);
        ticksThisFrame++;
      }
      accumulator = 0;
      if (reserveShown <= 0.0005) fastForward = false; // ran flat — drop back to real time
    } else {
      scriptUpdate(realDt); // scripted user (BUILT §5/§17): drives crown/scale before this frame's ticks
      syncUpdate(realDt);
      // The catch-up is a rate the slider does not know about, so it stands
      // in for timeScale rather than being written into it — the slider's
      // own position (and the user's chosen scale) survives the sync.
      accumulator += realDt * (syncPhase === 'catchup' ? catchUpRate : timeScale);
      // Tick budget (§14): up to tickBudget fixed steps, then the remainder in
      // coarse strides — whole multiples of FIXED_DT (the sub-step accumulator
      // phase stays identical to the unbudgeted path, so behaviour at speed is
      // bit-for-bit unchanged), capped at TICK_DT_CLAMP so tick() never clamps
      // a stride away and silently loses τ. The 252-ticks-per-frame catch-up
      // case collapses to tickBudget + ⌈remainder / TICK_DT_CLAMP⌉ calls; a
      // coarse stride is exactly what fast-forward already feeds tick(), so
      // the mechanism's closed forms are on well-trodden ground.
      while (accumulator >= FIXED_DT) {
        const stride = ticksThisFrame < tickBudget
          ? FIXED_DT
          : Math.min(Math.floor(accumulator / FIXED_DT) * FIXED_DT, TICK_DT_CLAMP);
        simTime += stride;
        accumulator -= stride;
        tick(simTime);
        ticksThisFrame++;
      }
    }
    updateChainIfMoved(); // once per frame, after ALL of this frame's ticks (§14)
  }

  // Beats read the MOVEMENT's clock (τ): they stop when it stops. The TIME
  // reads what the hands read — τ displaced by the setting offset and the
  // dial epoch — so the panel and the dial can no longer disagree.
  const tauNow = tauIntegrated;
  document.getElementById('readout-time').textContent = formatTime(displayedSeconds());
  // Alarm readout (§24): derived from the disc's detented angle, hours:minutes
  // only (the target is quantized to the quarter hour, so seconds are always 00).
  document.getElementById('readout-alarm').textContent = formatTime(alarmTargetSeconds()).slice(0, -3);
  document.getElementById('readout-alarm-wind').textContent = Math.round((alarmBarrelWind / ALARM_BARREL_TURNS) * 100) + '%';
  paintScale();
  updateSyncUI();
  document.getElementById('readout-beats').textContent = String(beatPhase(tauNow).n);
  document.getElementById('reserve-value').textContent =
    (reserveShown * (RELAX_SECONDS / 3600)).toFixed(1) + ' h';

  // Fast-forward button state + fusee torque readouts: the spring's torque
  // sags as the reserve drains, while the fusee's growing radius keeps the
  // torque delivered to the train level — the whole point of the mechanism.
  const ffBtn = document.getElementById('btn-ff');
  ffBtn.textContent = fastForward ? 'On' : 'Off';
  ffBtn.classList.toggle('active', fastForward);
  const springTq = 0.35 + 0.65 * reserveShown;
  const fuseeR = FUSEE_R_LARGE + (FUSEE_R_SMALL - FUSEE_R_LARGE) * reserveShown;
  const trainTq = (springTq * fuseeR) / FUSEE_R_SMALL; // ≈ 1, by the cone's design
  document.getElementById('bar-spring').style.width = `${(springTq * 100).toFixed(1)}%`;
  document.getElementById('bar-train').style.width = `${clamp(trainTq * 100, 0, 100).toFixed(1)}%`;

  updateExplode();

  if (camTween) {
    camTween.t += realDt / camTween.dur;
    const e = smoothstep(camTween.t);
    camera.position.lerpVectors(camTween.fromPos, camTween.toPos, e);
    controls.target.lerpVectors(camTween.fromTarget, camTween.toTarget, e);
    if (camTween.t >= 1) camTween = null;
  }

  controls.update();
  updateLabels();
  updateSndFlash(realDt); // real wall-clock decay, like CAM_SNAP_TAU -- not scaled by timeScale
  renderer.render(scene, camera);
}

function frame(now) {
  const frameMs = now - lastNow;
  const realDt = Math.min(frameMs / 1000, REAL_DT_CLAMP);
  lastNow = now;

  // Frame-time readout (§14): sample before the frame's work so a stall shows
  // up as ONE skipped sample, not a poisoned average.
  if (frameMs < FRAME_STALL_MS) {
    frameMsEma = frameMsEma === 0 ? frameMs : frameMsEma + (frameMs - frameMsEma) * FRAME_EMA_ALPHA;
  }
  autoTierUpdate(now); // §14: Auto quality steps down while frames sustained miss vsync

  advanceFrame(realDt);

  // Paint the readout ~2×/s — touching the DOM every frame would itself cost
  // frames, which a frame-time readout of all things must not do.
  perfReadoutMs += frameMs;
  if (perfReadoutMs >= 500 && frameMsEma > 0) {
    perfReadoutMs = 0;
    document.getElementById('readout-frame').textContent =
      `${frameMsEma.toFixed(1)} ms · ${Math.round(1000 / frameMsEma)} fps`;
    document.getElementById('readout-ticks').textContent = String(ticksThisFrame);
    document.getElementById('readout-tier').textContent = qualityTier;
  }

  // Auto-save state every 5 seconds
  if (simTime - lastAutoSaveTime > 5) {
    lastAutoSaveTime = simTime;
    saveState(captureState());
  }

  requestAnimationFrame(frame);
}

// Debug/verification hook: step the sim and render without rAF (occluded windows
// throttle requestAnimationFrame, which stalls automated checks).
window.__clock = {
  step(dt) {
    simTime += dt;
    tick(simTime);
    updateChainIfMoved(); // step() paints — the chain must be current in the render (§14)
    if (camTween) {
      camTween.t += dt / camTween.dur;
      const e = smoothstep(camTween.t);
      camera.position.lerpVectors(camTween.fromPos, camTween.toPos, e);
      controls.target.lerpVectors(camTween.fromTarget, camTween.toTarget, e);
      if (camTween.t >= 1) camTween = null;
    }
    updateExplode();
    controls.update();
    updateLabels();
    renderer.render(scene, camera);
    return simTime;
  },
  get simTime() { return simTime; },
  get tau() { return tauIntegrated; },
  // What the HANDS read, in seconds (τ displaced by the setting offset and
  // the dial epoch). τ alone cannot be checked against the dial once the
  // crown has been turned, so the inspection surface needs both.
  get displayTime() { return displayedSeconds(); },
  get dialEpoch() { return DIAL_EPOCH_S; },
  get balanceRate() { return balanceRate; },
  get leverEngage() { return leverEngage; },
  get secondsZeroRef() { return secondsZeroRef; },
  get bootWarns() { return __bootWarns; },
  get alarmPinDrop() { return alarmPinDropNow; }, // §29 step 3: the physical detector's output (step 5 re-derives the trip from it)
  get fourthAngle() { return fourthAngle(tauIntegrated); },
  get barrelWindTurns() { return barrelWindTurns; },
  get tension() { return clamp(barrelWindTurns / RESERVE_BARREL_TURNS, 0, 1); },
  get crownRotation() { return crownRotation; },
  get windPathRot() { return windPathRot; },
  get setPathRot() { return setPathRot; },
  setCrownRotation(v) { crownRotation = v; },
  // §25 C: the alarm crown's RAW drag input — parity with setCrownRotation.
  // Unlike setPose({alarmCrownRotation}) (which poses the SET path directly),
  // this feeds tick()'s delta routing, so with the clutch pulled it WINDS.
  setAlarmCrownRotation(v) { alarmCrownRotation = v; },
  get alarmCrownPullT() { return alarmCrownPullT; },
  setAlarmCrownOut(v) { alarmCrownOut = !!v; },
  setBarrelWindTurns(v) { barrelWindTurns = clamp(v, 0, RESERVE_BARREL_TURNS); },
  // Zero every PERSISTENT user input, returning the mechanism to its as-booted
  // reference. setPose forces the pose *variables* but deliberately leaves the
  // accumulators a real session builds up — the raw crown angle, the rotation
  // each clutch path has banked, and the jumping-minute snap correction —
  // exactly the inputs that decide where the HANDS sit. That is fine for the
  // battery (its axes never touch the hands) but makes a geometry fingerprint
  // depend on session history: two loads with different saved crown state hash
  // differently for the same build. The fingerprint calls this first so its
  // reference pose is canonical (handSetOffset = 0, the boot state), not
  // whatever was last saved. Not a pose itself — follow with setPose().
  resetInputs() {
    crownRotation = 0; lastCrownRotation = 0;
    windPathRot = 0; setPathRot = 0; windAccumTurns = 0;
    autoWindRemaining = 0;
    jumpCorr = 0; jumpDisp = null;
    alarmCrownRotation = 0;
    alarmBarrelWind = 0; alarmStrikePhase = ALARM_PHASE_REST; alarmReleased = false; // §25 C: as-booted = UNWOUND
    alarmOn = false; alarmTubeShownA = 0; // §25 C: disarmed, tube seated (the pose path re-derives both exactly)
    alarmCrownOut = false; alarmCrownPullT = 0; alarmSetRot = 0; lastAlarmCrownRotation = 0;
    alarmPrevRel = null; alarmLockLiftT = 0; alarmColSteps = 0; alarmColShownA = 0; alarmPusherT = 0; // §25 B+D (steps parity = alarmOn = false ✓)
    secondsZeroRef = fourthAt0; // §29 step 0: the seconds-reset cam's banked reference — a crown-pull session accumulates it (the heart cam snaps to fourthA), and it decides where the small-seconds hand and its cam sit ever after
    alarmCrownCreep = 0; alarmCrownCreepLastBd = null; // §29 step 2: the crown's banked back-drive creep
  },
  // Inspection hook: force the mechanism into an exact pose. Assigns the
  // underlying state variables directly, then evaluates tick() with a zero
  // rawDt (t == lastTickRawT), which re-poses every part from the closed
  // forms without integrating anything — a pure, deterministic pose.
  setPose(p = {}) {
    if (p.tau !== undefined) tauIntegrated = p.tau;
    if (p.crownPullT !== undefined) { crownPullT = p.crownPullT; crownOut = p.crownPullT > 0.5; }
    if (p.leverEngage !== undefined) leverEngage = p.leverEngage;
    if (p.tension !== undefined) barrelWindTurns = clamp(p.tension, 0, 1) * RESERVE_BARREL_TURNS;
    if (p.windAccumTurns !== undefined) windAccumTurns = p.windAccumTurns;
    if (p.alarmCrownRotation !== undefined) { // §24 alarm axis — poses "crown wound to here in SET mode"
      alarmCrownRotation = p.alarmCrownRotation;
      alarmSetRot = p.alarmCrownRotation;           // §25 C: the set path banks it directly
      lastAlarmCrownRotation = p.alarmCrownRotation; // and no delta leaks into the next tick
    }
    if (p.alarmCrownPullT !== undefined) { alarmCrownPullT = p.alarmCrownPullT; alarmCrownOut = p.alarmCrownPullT > 0.5; } // §25 C winding clutch
    if (p.alarmReleased !== undefined) alarmReleased = !!p.alarmReleased; // §25 B: posed so the strike axis sweeps with the brake LIFTED, as a real ring runs
    if (p.alarmOn !== undefined) { // §25 C: armed/disarmed — decides whether the tube holds the set time or follows the hour wheel
      alarmOn = !!p.alarmOn;
      // §25 D: the column wheel's parity IS the on/off — a pose that flips one
      // must carry the other, or the beak sits on a column with the alarm on.
      if ((alarmColSteps % 2 === 1) !== alarmOn) alarmColSteps += 1;
    }
    if (p.alarmBarrelWind !== undefined) alarmBarrelWind = p.alarmBarrelWind; // §24 alarm-spring energy
    // §25 striking axis. Phase and wind are ONE mechanical quantity — the
    // barrel and the striking wheel are a single mesh — so posing the phase
    // must move the barrel with it, or the axis would sweep a striking train
    // running off a barrel that never turned.
    if (p.alarmStrikePhase !== undefined) {
      alarmStrikePhase = p.alarmStrikePhase;
      alarmBarrelWind = clamp(ALARM_BARREL_TURNS - alarmStrikePhase / ALARM_STRIKES_PER_BARREL_TURN, 0, ALARM_BARREL_TURNS);
    }
    tick(lastTickRawT);
    // The support sweep measures the chain's REAL geometry against the drum's
    // hook, so a posed tension must rebuild the mesh before the caller reads
    // it — this call is what kept that true when §14 moved the rebuild out of
    // tick() itself.
    updateChainIfMoved();
    scene.updateMatrixWorld(true);
  },
  render() { renderer.render(scene, camera); },
  // Guided demo/tour (BUILT §5/§17) hooks — for unattended verification.
  startDemo() { scriptStart(DEMO_STEPS, document.getElementById('btn-demo')); },
  startTour() { scriptStart(TOUR_STEPS, document.getElementById('btn-tour')); },
  get scriptState() { return scriptSteps ? { idx: scriptIdx, of: scriptSteps.length, caption: captionEl.textContent } : null; },
  // Deterministic per-frame advance for verification (rAF is paused when the
  // automation pane is backgrounded, so the guided demo/tour can't be watched
  // through the real loop). Runs script + sync + sim + camera + render.
  advanceFrame(realDt) { advanceFrame(realDt); return simTime; },
  // Frame-time readout (§14) — the panel's own numbers, exposed so a perf
  // claim can be checked from automation instead of by eye.
  get frameMs() { return frameMsEma; },
  get ticksPerFrame() { return ticksThisFrame; },
  get quality() { return { mode: qualityMode, tier: qualityTier }; },
  setQualityMode(m) { setQualityMode(m); },
  movement,
  // Alarm introspection (§24): the disc's actual detented angle and the set
  // time derived from it, for verifying they agree within one detent step.
  get alarmDiscAngle() { return alarmDiscAngle(); },
  get alarmTarget() { return alarmTargetSeconds(); },
  get alarmBarrelWind() { return alarmBarrelWind; }, // alarm-spring energy (turns); 0 = run down (§24)
  get alarmReleased() { return alarmReleased; },     // lock lifted / ringing (§24)
  get alarmStrikePhase() { return alarmStrikePhase; }, // striking-train phase in strikes (§24)
  get alarmHammerAngle() { return alarmHammerAngle(); }, // the derived hammer swing (§25: read off the pin holding the tail)
  // Striking-train constants the inspector's 'alarmStrike' axis needs to sweep
  // a whole wind, and that a reader needs to check the ring against (§25).
  get alarmStrikesPerWind() { return ALARM_STRIKES_PER_WIND; },
  get alarmRingSeconds() { return ALARM_RING_SECONDS; },
  get alarmBarrelTurns() { return ALARM_BARREL_TURNS; },
  get alarmDrawRad() { return ALARM_DRAW_RAD; },     // hammer draw at release — derived from the pin geometry
  get alarmCamRiseFrac() { return ALARM_CAM_RISE_FRAC; }, // fraction of a lobe pitch the driven rise occupies
  camera, controls, scene, labelEntries,
  // Layout introspection for the realism-inspection tooling.
  P, plateR, dialRadius,
};

requestAnimationFrame(frame);
