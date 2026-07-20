// Mechanical Clock Simulation — Agent B (scene, movement assembly, kinematics, UI)
//
// Develop-time note: this was built against src/geometry.stub.js / src/materials.stub.js
// (crude stand-ins implementing the exact SPEC API). Imports below point at the real
// modules per the integration contract; if geometry.js/materials.js are not yet present
// this file simply won't run until the orchestrator drops them in — the API is identical
// so no other changes should be required.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as G from './geometry.js';
import { MATS } from './materials.js';
import { aesthetics } from './aesthetics.js';
import { loadState, saveState, clearState, hasState } from './state.js';

const DEG2RAD = Math.PI / 180;

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
function smoothstep(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }

// ---------------------------------------------------------------------------
// Kinematic constants (see SPEC.md "Gear train" + "Escapement behavior")
// ---------------------------------------------------------------------------
const F_BALANCE = 2.5;           // Hz — balance oscillation frequency
const BEAT_DEG = 12;             // escape-wheel advance per beat (half of 24° tooth pitch)
const AMPLITUDE_TRUE_DEG = 270;  // "true" balance swing (physical reference, unused for mesh)
const AMPLITUDE_VISUAL_DEG = 45; // scaled-down, readable swing actually applied to the mesh
const IMPULSE_WIDTH = 0.16;      // fraction of a beat spent in unlock+impulse (rest = locked)
const RECOIL_FRACTION = 0.25;    // portion of the impulse window spent on the recoil/draw dip
const RECOIL_DEG = 1.0;          // escape wheel recoil during draw
// FORK_BANK_DEG / FORK_RECOIL_DEG are DERIVED further down (after the pallet
// fork and balance geometry exist), from rollerR and the notch's actual
// reach — see that derivation for why they can't be picked independently of
// the balance's roller radius without the impulse pin missing the notch.

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
// Z layers between the back plate (z=0) and the cocks/top plate (z≈20). Each
// arbor's PINION sits at the layer where it meshes with the PREVIOUS wheel;
// its own WHEEL sits one layer further along, where the NEXT pinion meshes it.
// TORNADO Z-stack — compressed to a 1.7-unit wheel stride (the old uniform
// 3-unit staircase was half air). The three offsets expressed as formulas
// are real mechanical constraints, not styling:
//  · L_FORK = L_ESCAPE + 1.5 — the fork body's underside just clears the
//    escape wheel's top face while the stones (stoneZReach below) straddle
//    the tooth band;
//  · L_BALANCE — the balance now sits IN the three-quarter plate's z-band
//    (the classic Glashütte elevation: rim level with the plate, swinging in
//    the cutaway), derived below so its rim's underside binds exactly one
//    CLEAR_MARGIN above the fork body's top face;
//  · L_HAIRSPRING and the flat balance cock ride the balance.
// Stride 2.1 is the floor set by the BRIDGES, not the wheels: each cock is
// a centred slab ±(width·0.2 + bevel) thick, and it must fit between its
// own wheel pair's planes and the next wheel up that crosses it (solved:
// feasible only for stride ≥ ~2.06 at the current cock widths).
const CLEAR_MARGIN = 0.15; // ONE structural margin — shared by the plate
                           // z-stack and the hack solvers below, and now by
                           // the balance plane derivation itself.
// RESTRIDDEN STACK — solved BOTTOM-UP from the low-escapement layout: the
// oscillator hangs under the open plate cutaway, and the plate's own floor
// binds on the hairspring stack (the fusee was dropped to make that true —
// see FUSEE_BASE_Z). Chain, with the slim balance: L_FORK/L_ESCAPE 4.5 →
// L_BALANCE ≈ 5.94 → spring top ≈ 7.56 → cock underside = plate floor
// ≈ 7.71 (wheels that XY-overlap must never share z; each step is
// half-thickness sums + the one margin).
const L_BARREL = 2;     // great-wheel plane (meshes center pinion) — fixed: drum/fusee/chain ride this side
// Center wheel dropped onto its own bind: one margin over the great wheel's
// top face, at the wheel's deepest feature (its hub ring, thickness·1.5/2 =
// 0.75 below the mid-plane). The old 4.85 carried ~1.2 of slack left over
// from the nest-under-the-escape era — slack the fusee now needs: the
// chain's lowest span must clear THIS wheel's top face, and every 0.1 here
// is 0.1 the cone (and with it the whole plate stack) cannot drop.
const L_CENTER = (L_BARREL + 0.7 + 0.08) + CLEAR_MARGIN + 0.75;
const L_THIRD = 5.95;   // = L_FOURTH − (fourth 0.4 + margin + third 0.45)
const L_FOURTH = 6.95;
// ESCAPE WHEEL BELOW THE FOURTH WHEEL — the low-escapement layout: the
// wheel drops under the whole train while its pinion stays up in the
// fourth wheel's plane (the arbor spans the gap). The ceiling is the
// fourth arbor's PINION, which meshes the third wheel at L_THIRD and
// spans 5.15..6.75: escape wheel top (L + 0.4) stays 0.25 under it.
// Below, its own neighbourhood is clear: the nearest train discs
// (center, third) are 19+ away in XY, and the fourth arbor is bare
// staff at this depth.
const L_ESCAPE = 4.5;
const FORK_T = 1.2;     // pallet-fork body thickness (= makePalletFork's `thickness` below)
// FORK INLINE WITH THE WHEEL: one shared plane, the way a real lever
// escapement is built — the stones engage in the fork's own z-band
// (stoneZReach = 0) instead of reaching down 1.5. The fork's outline
// clears the wheel disc everywhere except the stones (arms straddle
// outside the rim; the belly stays a full radius below it), so
// coplanarity costs nothing laterally and buys the whole stone reach
// in depth — which the balance, spring and cock all inherit.
const L_FORK = L_ESCAPE;
const BAL_T = 2.5;              // balance thickness (= makeBalanceWheel's `thickness`)
const RIM_H = BAL_T * 0.55;     // rim height — mirrors makeBalanceWheel's 0.55·t rim
// Balance mid-plane: fork body top (L_FORK + FORK_T/2) + margin + half the
// rim's own height. The rim's underside is the balance's deepest full-ring
// face, so this is the lowest the wheel can sit without fouling the fork.
// With the low escapement it lands FAR BELOW the plate band — the whole
// oscillator now lives in open air under the plate's cutaway.
const L_BALANCE = L_FORK + FORK_T / 2 + CLEAR_MARGIN + RIM_H / 2;
// Impulse-pin world mid-plane — inside the fork's z-band, VERIFIED by the
// collision audit; it is pinned to the FORK, not the balance, and must not
// move when L_BALANCE does. makeBalanceWheel takes the wheel-centre→pin
// distance as `pinDrop` so the caller can hold this plane exactly.
const PIN_PLANE_Z = L_FORK - 0.5;
const L_HAIRSPRING = L_BALANCE + 1.2;
const HAIRSPRING_H = 0.6;   // makeHairspring height (its stud/terminal top out ≈0.7·H above mid-plane)
// BALANCE COCK: a LOW bridge riding one margin over the hairspring
// stack, wherever that stack lands — with the low escapement that is
// ~4 under the three-quarter plate's band, so the cock (and the
// free-sprung dress on its face) stands entirely clear of the plate: no
// nesting, no shared band, no collision. The plate keeps its cutaway
// purely for the view of the oscillator below.
const COCK_T = 0.8;
const SPRING_TOP_Z = L_HAIRSPRING + HAIRSPRING_H * 0.7; // stud (0.6·H), terminal (0.55·H + ribbon)
const COCK_SLAB_BOT = SPRING_TOP_Z + CLEAR_MARGIN;
const COCK_SLAB_TOP = COCK_SLAB_BOT + COCK_T;
const COCK_MID_Z = COCK_SLAB_BOT + COCK_T / 2;
// Dial plane (watch front, −z side). Declared with the Z-stack because the
// whole dial gap is part of the same depth budget: the motion-works
// crossing (Z_SETTING), reserve train (Z_RSV) and cannon pinion all pack
// between the plate's back face (−2) and this.
const Z_DIAL = -7;
// KEYLESS PLANE — the stem/clutch/setting-wheel plane, on the DIAL SIDE of
// the base plate as in a real watch (it used to ride atop the barrel on the
// movement side). Bracketed by two binds and set mid-band:
//  · ceiling: the sliding pinion's axis lies ALONG the stem, so its z-reach
//    is its outer RADIUS (pitch 1.36 + addendum ≈ 1.79); that stack must
//    clear the plate's flat underside (−2) by CLEAR_MARGIN →
//    Z_KEYLESS ≤ −2 − 0.15 − 1.79 = −3.94.
//  · floor: the yoke rides below the plane (its arm passes under the
//    sliding pinion's hub collars, r 1.2) and its pivot boss must clear the
//    dial face (Z_DIAL) by the margin → Z_KEYLESS ≥ −7 + 0.15 + 0.75
//    (boss half) + 1.91 (yoke drop, see Z_YOKE) = −4.19.
const Z_KEYLESS = -4.1;

const explodeEntries = []; // { obj, baseZ, dir, layer }
function registerExplode(obj, baseZ, layer, dir = 1) {
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
// chain runs from it to the fusee cone, whose arbor carries the great wheel
// and the winding ratchet. The fusee arbor sits exactly where the going
// barrel used to be, so every mesh distance in the train is unchanged.
const barrelModule = 0.36, barrelTeeth = 80;
const barrelR = (barrelModule * barrelTeeth) / 2;
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
const greatWheel = G.makeGear({ module: barrelModule, teeth: barrelTeeth, thickness: 1.4, boreR: 1.4, spokes: 5, material: MATS.brass });
const barrelR_actual = greatWheel.userData.r || barrelR;
// FLAT cone (tornado): height squashed 8.5 → 4.5 with the same 3.75 wrap
// turns at a tighter groove pitch, seated just above the ratchet/click.
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
const centerPinion = G.makePinion({ module: barrelModule, teeth: 10, thickness: 1.6, material: MATS.steel });
const centerPinionR = centerPinion.userData.r;

const centerModule = 0.3, centerTeeth = 75;
const centerWheel = G.makeGear({ module: centerModule, teeth: centerTeeth, thickness: 1.0, boreR: 1.2, spokes: 5, material: MATS.brass });
const centerWheelR = centerWheel.userData.r;

// --- Third arbor: pinion (meshed by center wheel) + third wheel ----------
const thirdPinion = G.makePinion({ module: centerModule, teeth: 10, thickness: 1.6, material: MATS.steel });
const thirdPinionR = thirdPinion.userData.r;

const thirdModule = 0.24, thirdTeeth = 80;
const thirdWheel = G.makeGear({ module: thirdModule, teeth: thirdTeeth, thickness: 0.9, boreR: 1, spokes: 4, material: MATS.brass });
const thirdWheelR = thirdWheel.userData.r;

// --- Fourth arbor: pinion (meshed by third wheel) + fourth wheel ---------
const fourthPinion = G.makePinion({ module: thirdModule, teeth: 10, thickness: 1.6, material: MATS.steel });
const fourthPinionR = fourthPinion.userData.r;

const fourthModule = 0.21, fourthTeeth = 80;
const FOURTH_WHEEL_T = 0.8;
const fourthWheel = G.makeGear({ module: fourthModule, teeth: fourthTeeth, thickness: FOURTH_WHEEL_T, boreR: 0.9, spokes: 5, material: MATS.brass });
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
const fourthWheelBevel = Math.min(FOURTH_WHEEL_T * 0.18, fourthModule * 0.22); // = makeGear's bevel
const escPinionBevel = fourthModule * 0.2; // = makePinion's bevel (module·0.2 governs; thickness·0.15 is larger)
const ESC_PINION_T = FOURTH_WHEEL_T + 2 * fourthWheelBevel + 2 * CLEAR_MARGIN - 2 * escPinionBevel;
const escapePinion = G.makePinion({ module: fourthModule, teeth: 8, thickness: ESC_PINION_T, material: MATS.steel });
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
function stepPos(prev, angleDeg, dist) {
  const a = angleDeg * DEG2RAD;
  return { x: prev.x + Math.cos(a) * dist, y: prev.y + Math.sin(a) * dist };
}

// TORNADO layout — the train is composed as a face design rather than an
// organic walk. Targets (VIEWED from the dial side, which mirrors world x):
// barrel & crown toward ~1:50, the FOURTH wheel exactly at 6 o'clock below
// the dial centre (its arbor carries the small-seconds display), escapement
// continuing to ~6:25, balance at ~8:00. Hop distances are fixed by the
// pitch-radius sums, so the free variables are the walk angles plus D4.
// MOTION WORKS layout constants — HOISTED here from the dial build (they
// depend only on module and tooth counts, so they hoist cleanly): the
// keyless works' setting arbor terminates at the motion works' minute
// wheel and needs these ~1300 lines before the dial exists. Referencing
// them down there from up here was the temporal-dead-zone ReferenceError
// that bit twice (see TODO.md item 1, now closed).
const cannonPinionTeeth = 10;
const MW_MODULE_1 = 0.3;                                     // cannon ⇄ minute wheel
const MW_MINUTE_TEETH = 30, MW_PINION_TEETH = 8, MW_HOUR_TEETH = 32;
const MW_CENTER_D = (MW_MODULE_1 * (cannonPinionTeeth + MW_MINUTE_TEETH)) / 2;
const MW_MODULE_2 = (2 * MW_CENTER_D) / (MW_PINION_TEETH + MW_HOUR_TEETH); // minute pinion ⇄ hour wheel
// Reduction, derived from the tooth counts rather than asserted. Each
// external mesh reverses sense, so the two negations cancel: the hour wheel
// turns the same way as the cannon pinion, at 1/12 the rate.
const MW_RATIO_1 = -(cannonPinionTeeth / MW_MINUTE_TEETH);   // cannon → minute wheel
const MW_RATIO_2 = -(MW_PINION_TEETH / MW_HOUR_TEETH);       // minute pinion → hour wheel

const BARREL_STEP_DEG = -35;   // center sits down-right of barrel → barrel/crown exit viewed ~1:50
const D4 = 15.5;               // centre → fourth distance (small-seconds pivot radius, ≈0.39·dialRadius)
const ESCAPE_STEP_DEG = -57.9; // escape at viewed ~6:25
// The balance's walk angle is a TARGET, not a constant: ~8:00 viewed is where
// the eye wants it, but the low-escapement restride dropped the balance INTO
// the train's z-bands (rim [5.25, 7.13] straddles the center wheel's tooth
// band below AND the fourth wheel's above), so the wheel must also clear both
// discs in XY. The solved angle (BALANCE_STEP_DEG below, after the escape
// arbor is placed) is the feasible angle nearest this target.
const BALANCE_STEP_TARGET_DEG = 44.6; // balance at viewed ~8:00

const barrelPos = { x: 0, y: 0 };
const centerPos = stepPos(barrelPos, BARREL_STEP_DEG, barrelR_actual + centerPinionR);
// Solve the centre→third→fourth two-bar linkage so the fourth wheel lands
// EXACTLY D4 below the centre (viewed 6 o'clock). Triangle with sides
// d1 (centre→third), d2 (third→fourth) and base D4 straight down; the third
// wheel goes on the −x side so the train sweeps the quadrant opposite the
// barrel and leaves the movement's other flank to the balance.
const d1CT = centerWheelR + thirdPinionR;
const d2TF = thirdWheelR + fourthPinionR;
const thirdWedgeDeg =
  Math.acos((d1CT * d1CT + D4 * D4 - d2TF * d2TF) / (2 * d1CT * D4)) / DEG2RAD;
const thirdPos = stepPos(centerPos, -90 - thirdWedgeDeg, d1CT);
const fourthPos = { x: centerPos.x, y: centerPos.y - D4 };
const escapePos = stepPos(fourthPos, ESCAPE_STEP_DEG, fourthWheelR + escapePinionR);
// BALANCE_STEP_DEG — SOLVED from the clearance constraint, not styled. The
// balance rides a circle of radius escToBalanceDist about the escape arbor;
// rotating on that circle is the ONE move that leaves every fork/balance
// relation untouched (fork pivot, lever length, pin aim, hack pad and fork
// cock all re-derive from the escape→balance line). Constraint, per train
// disc W the balance z-shares:  |balance − W| ≥ sweptR(W) + sweptR(balance)
// + CLEAR_MARGIN.  Swept radii are MEASURED from the built meshes about
// their own axes (vertex max — same lesson as xyRadiusAbout below: bevels
// and the timing screws' tip corners are real, boxes over-report), so a
// future radius, bevel or screw change re-solves instead of silently
// re-colliding. At the current builds this lands ≈ 41.9° (target 44.6°):
// the fourth wheel binds first (screw corners at 9.52 vs tooth band 8.72),
// the center wheel a hair behind (rim 9.0 vs tooth band 11.70).
const BALANCE_STEP_DEG = (() => {
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
  const rBal = sweptR(balanceWheel);
  // Every placed train disc votes; the far ones (great, third, escape) never
  // bind today but cost nothing and guard the next relayout. Full-height
  // swept radii — deliberately z-blind: the balance straddles BOTH adjacent
  // wheel bands, so no z argument can relax the XY bound for the pair that
  // matters, and a z-blind bound cannot rot when the stack is restridden.
  const obstacles = [
    { pos: barrelPos, rr: sweptR(greatWheel) + rBal + CLEAR_MARGIN },
    { pos: centerPos, rr: sweptR(centerWheel) + rBal + CLEAR_MARGIN },
    { pos: thirdPos, rr: sweptR(thirdWheel) + rBal + CLEAR_MARGIN },
    { pos: fourthPos, rr: sweptR(fourthWheel) + rBal + CLEAR_MARGIN },
    { pos: escapePos, rr: sweptR(escapeWheel) + rBal + CLEAR_MARGIN },
  ];
  const ok = (deg) => {
    const p = stepPos(escapePos, deg, escToBalanceDist);
    return obstacles.every((o) => Math.hypot(p.x - o.pos.x, p.y - o.pos.y) >= o.rr);
  };
  if (ok(BALANCE_STEP_TARGET_DEG)) return BALANCE_STEP_TARGET_DEG;
  // Nearest feasible angle: march outward from the target on each side, then
  // bisect onto the feasibility edge (hi stays feasible), take the closer side.
  const edge = (s) => {
    let hi = 0.25;
    while (hi <= 90 && !ok(BALANCE_STEP_TARGET_DEG + s * hi)) hi += 0.25;
    if (hi > 90) return Infinity;
    let lo = hi - 0.25;
    for (let k = 0; k < 40; k++) {
      const m = (lo + hi) / 2;
      if (ok(BALANCE_STEP_TARGET_DEG + s * m)) hi = m; else lo = m;
    }
    return hi;
  };
  const down = edge(-1), up = edge(1);
  if (down === Infinity && up === Infinity) {
    console.warn('balance step: no clear angle about the escape arbor — leaving the target');
    return BALANCE_STEP_TARGET_DEG;
  }
  return BALANCE_STEP_TARGET_DEG + (down <= up ? -down : up);
})();
const balancePos = stepPos(escapePos, BALANCE_STEP_DEG, escToBalanceDist);

// Fork pivot: on the escape→balance line at palletStoneDist from the wheel
// centre (computed above), so the anchor straddles the near rim of the wheel
// and the lever/notch continues on toward the impulse pin.
const toBalance = { x: balancePos.x - escapePos.x, y: balancePos.y - escapePos.y };
const toBalanceLen = Math.hypot(toBalance.x, toBalance.y) || 1;
const uBalance = { x: toBalance.x / toBalanceLen, y: toBalance.y / toBalanceLen };
const forkPivotPos = { x: escapePos.x + uBalance.x * palletStoneDist, y: escapePos.y + uBalance.y * palletStoneDist };
const forkBaseAngle = Math.atan2(uBalance.x, -uBalance.y);

// The impulse pin is built on the roller at local +X; aim it at the fork
// pivot when the balance is at mid-swing (θ=0) so each zero-crossing carries
// the pin through the fork notch. Without this the balance oscillates about
// an arbitrary zero and the pin never meets the horns.
const PIN_AIM = Math.atan2(forkPivotPos.y - balancePos.y, forkPivotPos.x - balancePos.x);

// Dial center MUST coincide with the center-wheel arbor (minute hand rides
// on the same axis via the cannon pinion).
const dialCenterXY = { x: centerPos.x, y: centerPos.y };

// Recenter everything on the CENTER-WHEEL arbor: the dial must be concentric
// with the plate (hands ride the center arbor), exactly like a real movement —
// recentring on the layout centroid left the dial hanging off the plate edge.
const centroid = { x: centerPos.x, y: centerPos.y };
function shift(p) { return { x: p.x - centroid.x, y: p.y - centroid.y }; }
const P = {
  barrel: shift(barrelPos), center: shift(centerPos), third: shift(thirdPos),
  fourth: shift(fourthPos), escape: shift(escapePos), balance: shift(balancePos),
  fork: shift(forkPivotPos), dial: shift(dialCenterXY),
};

// Keyless-works geometry constants — declared before the plate radius
// because the setting cluster extends OUTBOARD of the pulled-out sliding
// pinion along the stem, and the plate must enclose it (with the compact
// tornado train, this floor — not the train extent — is what sizes the
// plate).
const KW_MODULE = 0.34;
const crownWheelTeeth = 20, windPinionTeeth = 8, settingWheelTeeth = 20;
const minuteWheelTeeth = 24, minutePinionTeeth = 8;
const CROWN_PULL_DIST = 5; // stem/crown outward slide when pulled to set

// ---------------------------------------------------------------------------
// KEYLESS WORKS XY LAYOUT — hoisted ahead of the plate build because the
// BASE plate needs real openings measured from this geometry: the keyless
// works lives on the DIAL side now (plane Z_KEYLESS, see the Z-stack), so
// the setting lever's tail post crosses the plate through an arc SLOT on
// its way up to the hack collar / reset rod, and the winding transfer
// arbor runs in a bored hole (see the winding path at the keyless
// assembly). Pitch radii are closed-form (module·teeth/2 — identical to
// what makeGear returns); the assembly further down consumes these same
// constants, so layout and plate openings can never drift apart.
// ---------------------------------------------------------------------------
const barrelDist = Math.hypot(P.barrel.x, P.barrel.y) || 1;
const uWind = { x: P.barrel.x / barrelDist, y: P.barrel.y / barrelDist };
const stemAngle = Math.atan2(uWind.y, uWind.x);
// Which side of the stem line the balance (and hence the setting lever)
// lives on. NOTE: with the tornado layout the balance sits
// almost exactly ON the stem line's far extension (perpendicular distance
// ≈ 1 unit), so this sign holds by a thin margin — nudging the balance step
// TARGET, the solved clearances feeding BALANCE_STEP_DEG, or the barrel
// angle can silently mirror the whole lever/yoke/hack-spring assembly.
// Asserted below (the clearance solve now MOVES the balance, so a silent
// flip is a live failure mode, not a hypothetical): |projection| ≈ 0.79
// after the solve, vs ≈ 0.97 at the raw target.
const vPerp = { x: -uWind.y, y: uWind.x };
const sideProj = P.balance.x * vPerp.x + P.balance.y * vPerp.y;
const sideSign = Math.sign(sideProj) || 1;
if (Math.abs(sideProj) < 0.5) {
  console.warn(`keyless side sign nearly degenerate (balance ${sideProj.toFixed(2)} off the stem line) — lever/yoke/hack layout may mirror`);
}
const ratchetR = barrelR * 0.34;                       // matches makeBarrel's ratR
const crownWheelR = (KW_MODULE * crownWheelTeeth) / 2;
const windPinionR = (KW_MODULE * windPinionTeeth) / 2;
const settingWheelR = (KW_MODULE * settingWheelTeeth) / 2;
const minuteWheelR = (KW_MODULE * minuteWheelTeeth) / 2;
// Winding transfer arbor axis — one ratchet-mesh distance outboard of the
// barrel (exactly where the crown wheel sat when it lived on the movement
// side; the ratchet's tooth circle fixes this distance).
const cwDist = barrelDist + ratchetR + crownWheelR + 0.1;
const pinDist = cwDist + crownWheelR + windPinionR * 0.55; // sliding pinion, pushed in (teeth overlap the wheel rim, bevel-style)
const pinOutDist = pinDist + CROWN_PULL_DIST;              // ...pulled out → setting mesh
const swDist = pinOutDist + windPinionR * 0.55 + settingWheelR;
// The minute wheel FOLDS perpendicularly off the stem line (see the
// setting-path assembly for why).
const mwFoldD = settingWheelR + minuteWheelR + 0.1;
const minuteArborXY = {
  x: uWind.x * swDist - sideSign * vPerp.x * mwFoldD,
  y: uWind.y * swDist - sideSign * vPerp.y * mwFoldD,
};
// Setting lever & yoke pivots + the pull-driven angle solves. Hoisted with
// the layout: the lever's tail-post ARC is what the plate's slot is cut
// from, and every hack/reset solver downstream keys off tailPostWorldAt.
const SL_C = 10;        // lever pivot's lateral offset from the stem axis
const SL_TAIL = 6;      // tail arm length (pivot → post)
const GROOVE_LOCAL = 4; // stem groove collars sit this far outboard of the sliding pinion
const slMidAlong = pinDist + CROWN_PULL_DIST / 2 + GROOVE_LOCAL;
const settingLeverPivot = {
  x: uWind.x * slMidAlong + sideSign * vPerp.x * SL_C,
  y: uWind.y * slMidAlong + sideSign * vPerp.y * SL_C,
};
function settingLeverAngleAt(pull) {
  const along = pinDist + pull * CROWN_PULL_DIST + GROOVE_LOCAL;
  const gx = uWind.x * along, gy = uWind.y * along;
  return Math.atan2(gy - settingLeverPivot.y, gx - settingLeverPivot.x) - Math.PI / 2;
}
function tailPostWorldAt(pull) {
  const a = settingLeverAngleAt(pull);
  return {
    x: settingLeverPivot.x + Math.sin(a) * SL_TAIL,
    y: settingLeverPivot.y - Math.cos(a) * SL_TAIL,
  };
}
const postEng = tailPostWorldAt(1);
const postRel = tailPostWorldAt(0);
// The post swings on the lever's tail, so its track between the two crown
// poses is an ARC, not the chord — both plates' slots need the bow.
const kwPostBow = (() => {
  const chord = { x: postEng.x - postRel.x, y: postEng.y - postRel.y };
  const L = Math.hypot(chord.x, chord.y) || 1;
  let bow = 0;
  for (let i = 0; i <= 40; i++) {
    const p = tailPostWorldAt(i / 40);
    const t = ((p.x - postRel.x) * chord.x + (p.y - postRel.y) * chord.y) / (L * L);
    bow = Math.max(bow, Math.hypot(p.x - postRel.x - t * chord.x, p.y - postRel.y - t * chord.y));
  }
  return bow;
})();
const YK_C = 7.5; // yoke pivot's lateral offset, opposite side of the stem
const yokeMidAlong = pinDist + CROWN_PULL_DIST / 2;
const yokePivot = {
  x: uWind.x * yokeMidAlong - sideSign * vPerp.x * YK_C,
  y: uWind.y * yokeMidAlong - sideSign * vPerp.y * YK_C,
};
function yokeAngleAt(pull) {
  const along = pinDist + pull * CROWN_PULL_DIST;
  const px = uWind.x * along, py = uWind.y * along;
  return Math.atan2(py - yokePivot.y, px - yokePivot.x) - Math.PI / 2;
}

// Plate radius: tightest circle (plus a rim margin) that contains each part's
// own outline — arbor distance plus that part's radius, not a blanket maximum.
const partOutlineR = {
  barrel: barrelR_actual, center: centerWheelR, third: thirdWheelR,
  fourth: fourthWheelR, escape: escapeWheelR, balance: balanceR * 1.35, // + cock
  fork: 4, dial: 0,
};
let plateR = 20;
for (const key in P) {
  plateR = Math.max(plateR, Math.hypot(P[key].x, P[key].y) + (partOutlineR[key] || 0));
}
plateR += 5;
// Keyless floor: the plate must reach 1 unit past the setting wheel and
// past the folded minute wheel (with the compact tornado train, this floor
// — not the train extent — is what sizes the plate).
plateR = Math.max(
  plateR,
  swDist + settingWheelR + 1,
  Math.hypot(swDist, mwFoldD) + minuteWheelR + 1,
);

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

const ratioFourth = 8 / fourthTeeth; // escape pinion teeth / fourth wheel teeth
const offFourth = meshOffset(P.escape, P.fourth, fourthTeeth, ratioFourth, escAt0);
function fourthAngle(t) { return offFourth - ratioFourth * escapeAngle(t); }
const fourthAt0 = fourthAngle(0);

const ratioThird = 10 / thirdTeeth; // fourth pinion teeth / third wheel teeth
const offThird = meshOffset(P.fourth, P.third, thirdTeeth, ratioThird, fourthAt0);
function thirdAngle(t) { return offThird - ratioThird * fourthAngle(t); }
const thirdAt0 = thirdAngle(0);

const ratioCenter = 10 / centerTeeth; // third pinion teeth / center wheel teeth
const offCenter = meshOffset(P.third, P.center, centerTeeth, ratioCenter, thirdAt0);
function centerAngle(t) { return offCenter - ratioCenter * thirdAngle(t); }
const centerAt0 = centerAngle(0);

const ratioBarrel = 10 / barrelTeeth; // center pinion teeth / barrel teeth
const offBarrel = meshOffset(P.center, P.barrel, barrelTeeth, ratioBarrel, centerAt0);
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
// barrel occupied), winding ratchet + click at the keyless plane above it,
// then the grooved cone. The cone and ratchet are keyed together: both take
// the winding spin; the great wheel turns only with the train.
const barrelArbor = new THREE.Group();
barrelArbor.position.set(P.barrel.x, P.barrel.y, L_BARREL);
greatWheel.position.z = 0;
barrelArbor.add(greatWheel);
// RATCHET — dropped to the BOTTOM of the fusee arbor, just above the base
// plate and UNDER the great wheel. With the keyless works on the dial side
// (Z_KEYLESS < 0), the winding has to cross the base plate somewhere — and
// the ratchet's mesh point sits only ~8.4 from the barrel axis, well INSIDE
// the great wheel's radius, so a crossing arbor at any ratchet-mesh XY
// would skewer the great wheel's disc… unless it stops BELOW it. Down here
// the crown-wheel arbor (see the winding path at the keyless assembly) can
// end its climb legally: plate top at 0, ratchet band, then the great
// wheel's underside at ~1.22 — everything clears by the margin. The
// ratchet stays keyed to the fusee exactly as before; only its plane moved.
const RATCHET_T = 0.8;
const Z_RATCHET_BOT = 0.15; // world: one margin above the plate's top face
const fuseeRatchetGroup = G.makeRatchetAndClick({ radius: ratchetR, teeth: 24, thickness: RATCHET_T });
fuseeRatchetGroup.position.z = Z_RATCHET_BOT - L_BARREL; // extrude spans [Z_RATCHET_BOT, +RATCHET_T] in world
barrelArbor.add(fuseeRatchetGroup);
fusee.position.z = FUSEE_BASE_Z; // cone base above the third wheel's plane
barrelArbor.add(fusee);
movement.add(barrelArbor);
registerExplode(barrelArbor, L_BARREL, 1);
registerLabel('Fusee & great wheel', barrelArbor);

// CLICK — extracted from the ratchet group and PLATE-FIXED. It used to ride
// the barrel arbor (co-rotating with the very wheel it was supposed to
// hold — providing no actual ratcheting resistance; TODO.md item 2). With
// the ratchet now a whisker above the base plate, the honest mount is
// trivial: its own labelled unit standing on a short post screwed to the
// plate's top face, beak reaching the ratchet's tooth circle in-plane. The
// azimuth keeps the click at the group's build-time position (toward the
// movement centre), a multiple of the 15° tooth pitch, so the beak-in-valley
// registration from the builder is preserved.
const windingClick = new THREE.Group();
{
  const clickPart = fuseeRatchetGroup.getObjectByName('click');
  // The builder stacks click body/screw BELOW the ratchet (wheel-mount
  // style); re-seat them for a plate mount: body inside the ratchet's own
  // z-band, pivot post from the plate top, cap screw above.
  const clickBodyBot = Z_RATCHET_BOT + 0.06;             // body extrude spans 0.75·RATCHET_T
  windingClick.position.set(P.barrel.x, P.barrel.y, clickBodyBot + RATCHET_T * 0.9);
  clickPart.position.z = 0; // was −0.9·t below the wheel; group z carries the seat now
  windingClick.add(clickPart); // reparent: world XY unchanged (barrelArbor rotation is 0 at build)
  const postH = clickBodyBot + RATCHET_T * 0.75; // plate top → just past the click body
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, postH, 10), MATS.steel);
  post.rotation.x = Math.PI / 2;
  post.position.set(ratchetR * 1.28, 0, postH / 2 - windingClick.position.z);
  windingClick.add(post);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.18, 12), MATS.blueSteel);
  cap.rotation.x = Math.PI / 2;
  cap.position.set(ratchetR * 1.28, 0, postH + 0.09 - windingClick.position.z);
  windingClick.add(cap);
  // Drop the builder's wheel-mount screw (its post is gone with the old
  // mounting; the click itself keeps its own pivot wiggle in tick()).
  const oldScrew = fuseeRatchetGroup.children.find(
    (c) => c !== fuseeRatchetGroup.getObjectByName('ratchet') && c.name !== 'click');
  if (oldScrew) fuseeRatchetGroup.remove(oldScrew);
}
movement.add(windingClick);
registerExplode(windingClick, windingClick.position.z, 1);
registerLabel('Winding click', windingClick);

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
//    climbing from the dial-side clutch to the ratchet above the plate) —
//    cut PIVOT_BORE_CLEAR-style clearance over the 0.7 shaft, and the bore
//    IS that arbor's bearing, exactly like a train pivot;
//  · a clearance recess at the motion-works corner: the setting path's
//    drop→traverse bevel gear stands tip-up at the minute arbor's axis and
//    its cone reaches into the plate's z-band (the corner plane sits just
//    under the plate) — the recess is sized to the gear's tip circle;
//  · an arc SLOT for the setting lever's tail post, swept over the full
//    crown stroke (chord + measured bow, same construction as the
//    three-quarter plate's slot for this same post higher up).
const backPlate = G.makeBackPlate({
  radius: plateR, thickness: 2,
  holes: [
    { x: uWind.x * cwDist, y: uWind.y * cwDist, r: 0.7 + 0.05 },
    { x: minuteArborXY.x, y: minuteArborXY.y, r: 1.95 },
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
for (const arbor of [barrelArbor, centerArbor, thirdArbor, fourthArbor, escapeArbor]) {
  addUpperPivot(arbor);
}
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

// Display-arbor plane — ABOVE the three-quarter plate. Its old under-plate
// berth (L_FOURTH + 2.2) no longer exists: with the fusee dropped, the
// plate closes down onto the hairspring stack and the escape pinion tops
// out a hair under the plate's own underside, leaving no band for the
// hammer and cam beneath it. So they ride just over the plate's top face
// instead — chronograph-style works on the plate, the real construction
// for exactly this mechanism — one margin over it at the tallest body
// half-extent (the hammer's pivot boss: width·0.6 slab · 1.4).
const Z_SECONDS_ARBOR = TQ_TOP_Z + CLEAR_MARGIN + (HAMMER_W * 0.6 * 1.4) / 2;
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
// wheel that meshes the fusee ratchet just above the plate's movement
// face. Pulled out ("setting"), it slides clear of the crown wheel and
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

// --- Winding path: crown wheel + transfer arbor → ratchet -----------------
// Two coaxial wheels on one arbor at cwDist: the CROWN WHEEL proper on the
// dial side (meshed by the sliding pinion) and the winding TRANSFER wheel
// in the thin band between the plate's top face and the great wheel's
// underside, where it meshes the relocated ratchet (see the ratchet's move
// down the fusee arbor at the barrel build — a crossing arbor anywhere at
// ratchet-mesh distance sits INSIDE the great wheel's radius, so the climb
// must END below that wheel). The arbor runs in a real bored hole in the
// plate; the bore is its bearing. The same tooth count top and bottom
// keeps the crown→ratchet ratio exactly what it was when the crown wheel
// meshed the ratchet directly (the middle wheel telescopes out of the
// ratio), and the path still has TWO meshes, so the winding sense is
// unchanged too.
const crownWheel = G.makeGear({ module: KW_MODULE, teeth: crownWheelTeeth, thickness: 1.1, boreR: 0.7, spokes: 0, material: MATS.steel });
const crownWheelBase = Math.PI / crownWheelTeeth; // half-tooth phase into the ratchet
crownWheel.position.set(uWind.x * cwDist, uWind.y * cwDist, Z_KEYLESS);
keyless.add(crownWheel);
// Transfer wheel: hub-less — its band between plate top and great-wheel
// underside is only ~1.2 tall, and the stock hub ring would eat both gaps.
const Z_TRANSFER = Z_RATCHET_BOT + RATCHET_T / 2; // coplanar with the ratchet
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

// Knurled crown — enlarged barrel with true knurl ridges around the rim and
// on the face, plus a torus ring in relief (see makeCrown in geometry.js).
const crown = G.makeCrown({ bodyR: 5.425, bodyH: 4.55, material: MATS.steel }); // +75% over the original 3.1/2.6
crown.rotation.x = -Math.PI / 2; // builder's +Z face → outward along the stem (+Y)
crown.position.y = stemLen - 0.7; // base where the old crown's base sat
windSpinner.add(crown);

// Handles into the fusee arbor's ratchet + the plate-fixed click for the
// winding animation (the click lives in its own unit now — see windingClick
// at the barrel build).
const ratchetMesh = fuseeRatchetGroup.getObjectByName('ratchet');
const clickMesh = windingClick.getObjectByName('click');
const clickBaseRot = clickMesh ? clickMesh.rotation.z : 0;
const RATCHET_TEETH = 24; // matches makeRatchetAndClick's default

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
// job is to carry the two rod pins (reset, then the hack rod's above it).
// 0.7 in the fusee term = rod radius (0.35) + clearance.
const ROD_R = 0.35; // rod radius — reset and hack rods share it
const FUSEE_TOP_Z = L_BARREL + FUSEE_BASE_Z + FUSEE_H;
// ...and, since the three-quarter plate went in, the rod must ALSO run clear
// OVER that plate: it crosses ~55 units of it, from the keyless corner to
// the hammer's tail, and a rod at the old height would have had to be
// trenched through the plate for its whole run. The binding term is the
// HAMMER TAIL BAR hung on the same plane (a 1-thick slab, so half-thickness
// 0.5 > ROD_R), not the rod itself.
const ROD_TAILBAR_T = 1;
// First term (was a fixed 2.3 floor): the tail bar swings over the HEART
// CAM on this same arbor plane — its underside must clear the cam's top
// face by the margin. Derived so thinning the cam lowers the bar with it.
const ROD_Z_LIFT = Math.max(
  CAM_T / 2 + CLEAR_MARGIN + ROD_TAILBAR_T / 2,
  FUSEE_TOP_Z + 0.7 - Z_SECONDS_ARBOR,
  TQ_TOP_Z + CLEAR_MARGIN + ROD_TAILBAR_T / 2 - Z_SECONDS_ARBOR,
);
const ROD_PLANE_Z = Z_SECONDS_ARBOR + ROD_Z_LIFT; // reset rod centre-line's world z
// The HACK rod (stop work) rides the same post on its own pin land ABOVE
// the reset rod's — above, not below, because the reset rod's plane is
// itself solved to just clear the three-quarter plate's top: any second
// rod under it would run inside the plate's band. Two rod radii plus a
// working gap separate the pins, so the rods clear each other even where
// they converge at the shared post.
const ROD2_PLANE_Z = ROD_PLANE_Z + 2 * ROD_R + 0.2;
// Post height — SIZED TO ITS JOBS, no taller: the topmost pin (the hack
// rod's, at ROD2_PLANE_Z) plus a pin-retaining land above it.
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
  // The post still does its work on the MOVEMENT side (hack collar, reset
  // rod at POST_TOP_Z): from the dial-side lever body it now spans the
  // whole movement, crossing the base plate through the arc slot cut for
  // it (see the plate build) and the three-quarter plate through tqSlots.
  postH: POST_TOP_Z - (Z_SETTING_LEVER + 0.5),
});
const settingLeverGroup = new THREE.Group();
settingLeverGroup.position.set(settingLeverPivot.x, settingLeverPivot.y, Z_SETTING_LEVER);
settingLeverGroup.add(settingLever);
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
// Tail bar and rod ride ABOVE the fusee cone's top: the rod's straight run
// from the setting-lever tail post (keyless corner) to the hammer tail
// passes almost directly over the barrel axis — the barrel sits between
// those two points in the tornado layout — so the only clean straight path
// is over the cone (and over the chain's top wrap). Solved from the cone
// geometry so flattening the fusee automatically lowers the rod. (This
// replaces the old fixed 2.3 lift, which was only dodging the heart cam's
// own body.) ROD_Z_LIFT / FUSEE_TOP_Z / ROD_R themselves are declared up by
// the setting-lever block: the rod plane sizes the lever's tail post.
const hammerTailBar = new THREE.Mesh(new THREE.BoxGeometry(1.4, HAMMER_TAIL, 1), MATS.steel);
hammerTailBar.rotation.z = HAMMER_TAIL_DELTA.delta;
hammerTailBar.position.set(
  Math.sin(HAMMER_TAIL_DELTA.delta) * (HAMMER_TAIL / 2),
  -Math.cos(HAMMER_TAIL_DELTA.delta) * (HAMMER_TAIL / 2),
  ROD_Z_LIFT
);
hammerGroup.add(hammerTailBar);
// Visible riser from the hammer's pivot up to the lifted tail bar — the bar
// has to be driven by something; without this it floats above the lever.
// The hammer's BODY rides above the plate now, so the same shaft also
// continues DOWN into its jewelled bore in the plate below: one arbor,
// bore to tail bar. That bearing is the hammer's grounding: its declared
// ['Reset hammer','Three-quarter plate'] support used to measure 9.36
// units of nothing.
{
  const riserBot = TQ_MID_Z - Z_SECONDS_ARBOR; // hammer-local: down into the plate's mid-thickness
  const riser = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, ROD_Z_LIFT - riserBot, 10), MATS.steel);
  riser.rotation.x = Math.PI / 2;
  riser.position.set(0, 0, (ROD_Z_LIFT + riserBot) / 2);
  hammerGroup.add(riser);
  tqPivots.push({
    x: hammerPivotPos.x, y: hammerPivotPos.y, staffR: 0.5, jewelR: 1.0,
    boreR: 0.5 + PIVOT_BORE_CLEAR,
  });
}
const resetRod = new THREE.Mesh(new THREE.CylinderGeometry(ROD_R, ROD_R, 1, 8), MATS.steel);
resetRod.scale.set(1, RESET_ROD_LEN, 1);
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
// STOP WORK (hacking) — a local stop crank at the balance, driven by a thin
// overhead HACK ROD. This replaces the old blade design (a 54-unit bowed
// spring crossing the whole movement mid-z, lifted by a Ø8 ramp collar on
// the lever's tail post): the crown's motion still has to travel from the
// keyless corner to the balance — that span is irreducible — but it now
// travels as a second thin rod on the reset rod's own high plane, where the
// first one already proved the look, instead of as the movement's largest
// part. At the balance end the rod drives a SEE-SAW CRANK standing in the
// plate cut's open wedge: vertical tail up to the rod plane, horizontal pad
// arm reaching under the rim, pivoted about a HORIZONTAL (tangential) axis
// in a clevis bracket on the base plate. The crank IS the in-plane→vertical
// converter the ramp collar used to be — a bell-crank instead of a wedge —
// and because the rod is rigid and pinned at both ends, the linkage is
// positively controlled in both directions: no preload spring needed.
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

// --- Crank geometry. The pivot plane is set so the pad arm sits LEVEL at
// full engagement with its ruby's top face exactly on the contact plane —
// the engaged pose is the calibration zero.
const STOP_ARM_T = 0.8;     // pad arm thickness
const STOP_ARM_W = 0.9;     // pad arm width
const STOP_PAD_RISE = 0.9;  // arm top face → ruby top face (post 0.5 + ruby 0.4)
const STOP_TAIL_W = 0.5;    // tail bar section
// (ROD2_PLANE_Z — the hack rod's pin plane on the shared tail post, above
// the reset rod's — is declared with ROD_PLANE_Z at the setting-lever
// block: the post's height is sized from it.)
const Z_STOP_PIVOT = HACK_CONTACT_Z - STOP_PAD_RISE - STOP_ARM_T / 2;
// Bracket axis stand-off from the balance axis: everything the balance
// sweeps, plus margin, plus room for the tail to LEAN INWARD when released
// (the released tail-top displacement is derived by the calibration and
// asserted against this allowance below).
const STOP_LEAN_ALLOW = 2.0;
const STOP_PIVOT_R = BAL_OUTER_R + STOP_LEAN_ALLOW;
const STOP_ARM_LEN = STOP_PIVOT_R - HACK_CONTACT_R;
// The tail rises PAST the hack rod's post-side plane: the rod is rigid and
// pinned at both ends, so nothing requires it level — and the released
// crank angle is what the rod's ~2.9 of crown travel maps onto the tail's
// length, so a taller tail swings a SHALLOWER angle. That matters because
// the tail leans INWARD when released: its lateral lean at any height h
// above the pivot is h·tanψ₀, and the balance's full swept radius reaches
// up to the rim top — the graded check below holds the tail off that
// envelope at exactly the height where it is widest.
const STOP_TAIL_RISE = 1.5;
const STOP_TAIL_H = (ROD2_PLANE_Z + STOP_TAIL_RISE) - Z_STOP_PIVOT;

// --- Bearing: scanned around the plate cut's open-wedge centre (the wedge
// aims plate-centre → balance and is open to the rim, so the OUTWARD
// bearing is open air from base plate to sky by construction — the crank's
// tall tail needs exactly that). The scan walks away from the ideal only
// far enough to clear the escapement-side hardware, and requires the hack
// rod's approach to keep a strong component along the crank's tilt plane
// (the see-saw only converts motion in its own vertical plane).
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
  for (let d = -28; d <= 28; d += 1) {
    const phi = ideal + d * DEG2RAD;
    const bx = P.balance.x + Math.cos(phi) * STOP_PIVOT_R;
    const by = P.balance.y + Math.sin(phi) * STOP_PIVOT_R;
    if (Math.hypot(bx, by) > plateR - 2) continue; // bracket fully on the plate
    let clr = Infinity;
    for (const o of obstacles) clr = Math.min(clr, Math.hypot(bx - o.x, by - o.y) - o.r - 2);
    if (clr < HACK_CLEAR_MARGIN) continue;
    const dxp = bx - postEng.x, dyp = by - postEng.y, mp = Math.hypot(dxp, dyp) || 1;
    const rodK = (dxp * Math.cos(phi) + dyp * Math.sin(phi)) / mp;
    if (rodK < 0.6) continue;
    const score = clr - Math.abs(d) * 0.05;
    if (!best || score > best.score) best = { phi, score };
  }
  if (!best) {
    console.warn('stop work: no clear bearing about the balance — using the outward ideal');
    best = { phi: ideal };
  }
  return best.phi;
})();
const STOP_R_HAT = { x: Math.cos(STOP_BEARING), y: Math.sin(STOP_BEARING) };
const STOP_PIVOT = {
  x: P.balance.x + STOP_R_HAT.x * STOP_PIVOT_R,
  y: P.balance.y + STOP_R_HAT.y * STOP_PIVOT_R,
};

// --- Build: static bracket (post + clevis + pin) and the rotating crank.
// Group local +X = radially OUT of the balance; the crank rotates about
// local Y (the horizontal, tangential pivot axis).
const stopLeverGroup = new THREE.Group();
stopLeverGroup.position.set(STOP_PIVOT.x, STOP_PIVOT.y, Z_STOP_PIVOT);
stopLeverGroup.rotation.z = STOP_BEARING;
movement.add(stopLeverGroup);
registerExplode(stopLeverGroup, Z_STOP_PIVOT, 7);
registerLabel('Stop lever', stopLeverGroup);
{
  // Bracket post: base plate top (seated 0.3 in) up to just under the arm.
  const postTopLocal = -(STOP_ARM_T / 2 + HACK_CLEAR_MARGIN);
  const postH = (Z_STOP_PIVOT + 0.3) + postTopLocal;
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, postH, 12), MATS.steel);
  post.rotation.x = Math.PI / 2;
  post.position.z = postTopLocal - postH / 2;
  stopLeverGroup.add(post);
  // Clevis cheeks straddle the crank at the pivot; the blued pin runs
  // through both, along the tangential axis (cylinder's native Y).
  const cheekGeo = new THREE.BoxGeometry(1.5, 0.32, 2.0);
  for (const s of [-1, 1]) {
    const cheek = new THREE.Mesh(cheekGeo, MATS.steel);
    cheek.position.set(0, s * (STOP_TAIL_W / 2 + 0.28), -0.15);
    stopLeverGroup.add(cheek);
  }
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, STOP_TAIL_W + 1.15, 10), MATS.blueSteel);
  stopLeverGroup.add(pin);
}
const stopCrank = new THREE.Group();
stopLeverGroup.add(stopCrank);
{
  const tail = new THREE.Mesh(new THREE.BoxGeometry(STOP_TAIL_W, STOP_TAIL_W, STOP_TAIL_H), MATS.steel);
  tail.position.z = STOP_TAIL_H / 2;
  stopCrank.add(tail);
  const armL = STOP_ARM_LEN + 0.7; // reaches a little past the pivot for the boss
  const arm = new THREE.Mesh(new THREE.BoxGeometry(armL, STOP_ARM_W, STOP_ARM_T), MATS.steel);
  arm.position.x = -(STOP_ARM_LEN - 0.7) / 2;
  stopCrank.add(arm);
  const padPost = new THREE.Mesh(new THREE.CylinderGeometry(HACK_PAD_R, HACK_PAD_R, 0.5, 12), MATS.steel);
  padPost.rotation.x = Math.PI / 2;
  padPost.position.set(-STOP_ARM_LEN, 0, STOP_ARM_T / 2 + 0.25);
  stopCrank.add(padPost);
  const ruby = new THREE.Mesh(new THREE.CylinderGeometry(HACK_PAD_TOP_R, HACK_PAD_R * 0.95, 0.4, 14), MATS.ruby);
  ruby.rotation.x = Math.PI / 2;
  ruby.position.set(-STOP_ARM_LEN, 0, STOP_ARM_T / 2 + 0.7);
  stopCrank.add(ruby);
  // Rod pin stub at the tail's top, tangential like the pivot pin.
  const rodPin = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, STOP_TAIL_W + 0.6, 8), MATS.steel);
  rodPin.position.z = STOP_TAIL_H;
  stopCrank.add(rodPin);
}

// --- Hack-rod linkage: rigid rod, length CALIBRATED at the engaged pose
// (crank at ψ = 0, pad tangent to the rim by the z-stack above); the
// released crank angle then FOLLOWS from the post's crown travel through
// the rod constraint — derived, not styled — and the released pad drop is
// asserted against HACK_DROP_MIN. Per-frame the crank angle is solved from
// the same constraint (a·sinψ + b·cosψ = c, branch nearest the previous
// frame), mirroring the reset hammer's rod solve; ψ is clamped at 0
// because the rim itself is the hard stop the pad presses against.
function stopTailTopAt(psi) {
  return {
    x: STOP_PIVOT.x + STOP_R_HAT.x * STOP_TAIL_H * Math.sin(psi),
    y: STOP_PIVOT.y + STOP_R_HAT.y * STOP_TAIL_H * Math.sin(psi),
    z: Z_STOP_PIVOT + STOP_TAIL_H * Math.cos(psi),
  };
}
function stopSolvePsi(post, prev) {
  const wx = post.x - STOP_PIVOT.x, wy = post.y - STOP_PIVOT.y, wz = ROD2_PLANE_Z - Z_STOP_PIVOT;
  const a = wx * STOP_R_HAT.x + wy * STOP_R_HAT.y, b = wz;
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
const STOP_PSI0 = stopSolvePsi(postRel, 0); // released crank angle (< 0: tail leans inward, pad drops)
const STOP_RELEASE_DROP = (STOP_ARM_LEN - HACK_PAD_TOP_R) * Math.sin(-STOP_PSI0);
if (!(STOP_RELEASE_DROP >= HACK_DROP_MIN))
  console.warn('stop work: released pad drop under floor', STOP_RELEASE_DROP.toFixed(3), '<', HACK_DROP_MIN);
// Graded lean check: the leaned tail's radial position at the RIM TOP —
// the height where the balance's swept envelope is widest — must clear
// that envelope by the margin. (Above the rim only the staff and cock
// remain; those corridors are held by the Stop lever ⇄ Balance cock
// clearance budget instead.)
{
  const leanAtRim = ((L_BALANCE + RIM_H / 2) - Z_STOP_PIVOT) * Math.tan(-STOP_PSI0);
  if (STOP_PIVOT_R - leanAtRim < BAL_OUTER_R + STOP_TAIL_W / 2 + HACK_CLEAR_MARGIN)
    console.warn('stop work: released tail leans into the balance envelope at rim height',
      (STOP_PIVOT_R - leanAtRim).toFixed(2), 'vs', (BAL_OUTER_R + STOP_TAIL_W / 2 + HACK_CLEAR_MARGIN).toFixed(2));
}

const hackRod = new THREE.Mesh(new THREE.CylinderGeometry(ROD_R, ROD_R, 1, 8), MATS.steel);
hackRod.scale.set(1, HACK_ROD_LEN, 1);
movement.add(hackRod);
registerLabel('Hack rod', hackRod);

let stopPsiState = STOP_PSI0;
const _rodUp = new THREE.Vector3(0, 1, 0);
const _rodDir = new THREE.Vector3();
function updateStopWork(post) {
  // Rim = hard stop: the rod can never rotate the crank past the tangent
  // pose, however the eased crownPullT overshoots numerically.
  stopPsiState = Math.min(0, stopSolvePsi(post, stopPsiState));
  stopCrank.rotation.y = stopPsiState;
  const t = stopTailTopAt(stopPsiState);
  hackRod.position.set((post.x + t.x) / 2, (post.y + t.y) / 2, (ROD2_PLANE_Z + t.z) / 2);
  _rodDir.set(t.x - post.x, t.y - post.y, t.z - ROD2_PLANE_Z).normalize();
  hackRod.quaternion.setFromUnitVectors(_rodUp, _rodDir);
}
updateStopWork(postRel); // rest pose (crown in)

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
// The post swings on the setting lever's 6-long tail, so its track between
// the two crown poses is an ARC, not the chord. kwPostBow (hoisted with
// the XY layout — the base plate's slot for this same post needs it too)
// carries the bow. Only the BARE post crosses this plate now: the old ramp
// collar (which once widened this slot) is gone with the blade design —
// the stop work's crank lives at the balance and nothing wider than the
// post rides it any more.
const tqPostBow = kwPostBow;
const tqSlots = [{
  ax: postRel.x, ay: postRel.y, bx: postEng.x, by: postEng.y,
  // +0.02: tqPostBow is a 40-sample maximum of a smooth arc, so the true
  // bow can exceed it by a hair — the bare post's slot clearance ties at
  // EXACTLY the margin and rounds under it mid-stroke.
  r: G.SETTING_LEVER_POST_R + tqPostBow + CLEAR_MARGIN + 0.02,
}];

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
  // The escapement bridge's slab shares the cock foot's z band.
  for (const n of forkCock.chain) obstacles.push({ x: n.x, y: n.y, r: n.r });
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
  // The stop work's crank (bracket, tail, pad arm) and the reset-rod
  // linkage run in the band between the plate's top face and the cock's
  // underside — the pedestal's band exactly. The crank: a circle over the
  // bracket/clevis plus the pad arm's reach toward the rim (the released
  // tail lean is inside the same envelope).
  obstacles.push({ x: STOP_PIVOT.x, y: STOP_PIVOT.y, r: 2.2 });
  obstacles.push({
    ax: STOP_PIVOT.x - STOP_R_HAT.x * STOP_ARM_LEN,
    ay: STOP_PIVOT.y - STOP_R_HAT.y * STOP_ARM_LEN,
    bx: STOP_PIVOT.x, by: STOP_PIVOT.y,
    r: STOP_ARM_W / 2 + 0.4,
  });
  {
    let q = hammerTailTipAt(hammerBaseAngle + HAMMER_SWING_RAD, HAMMER_TAIL_DELTA.delta);
    for (let i = 0; i <= 12; i++) {
      const post = tailPostWorldAt(i / 12);
      q = intersectTail(post, RESET_ROD_LEN, q).q;
      obstacles.push({ ax: post.x, ay: post.y, bx: q.x, by: q.y, r: ROD_R });
      obstacles.push({ ax: hammerPivotPos.x, ay: hammerPivotPos.y, bx: q.x, by: q.y, r: 0.7 });
    }
  }
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
    // Radially: outside the balance assembly (the pedestal crosses the
    // wheel's plane) AND outside the cut edge on this bearing.
    const dFoot = Math.max(BAL_OUTER_R, G.cutEdgeRadius(TQ_CUT, phi)) + COCK_FOOT_R + CLEAR_MARGIN;
    const cs = Math.cos(TQ_CUT.aim + phi), sn = Math.sin(TQ_CUT.aim + phi);
    const fx = P.balance.x + cs * dFoot;
    const fy = P.balance.y + sn * dFoot;
    let clr = plateR - CLEAR_MARGIN - (Math.hypot(fx, fy) + COCK_FOOT_R); // stay on the plate
    for (const o of obstacles) clr = Math.min(clr, distTo(o, fx, fy) - COCK_FOOT_R);
    // The T-foot's two LEG PADS must clear the same obstacle set. Their
    // half-span is φ-dependent (it is solved from the balance's swept
    // radius at the bar's distance — see the build below): test both pads
    // at this candidate bearing, not just the slab tail.
    const dyLeg = dFoot - 1.2;
    const legBound = BAL_OUTER_R + COCK_LEG_R + CLEAR_MARGIN;
    const hspan = Math.max(3.5, Math.sqrt(Math.max(legBound * legBound - dyLeg * dyLeg, 0)));
    const padR = COCK_LEG_R * 1.5;
    for (const s of [-1, 1]) {
      const lx = P.balance.x + cs * dyLeg - sn * s * hspan;
      const ly = P.balance.y + sn * dyLeg + cs * s * hspan;
      clr = Math.min(clr, plateR - CLEAR_MARGIN - (Math.hypot(lx, ly) + padR));
      for (const o of obstacles) clr = Math.min(clr, distTo(o, lx, ly) - padR);
    }
    if (clr < CLEAR_MARGIN) continue;
    if (!best || clr > best.clr) best = { phi, dFoot, fx, fy, clr };
  }
  if (!best) {
    console.warn('balance cock: no clear seat on the plate; falling back to the old fork bearing');
    const phi = Math.atan2(P.fork.y - P.balance.y, P.fork.x - P.balance.x) - TQ_CUT.aim;
    const dFoot = BAL_OUTER_R + COCK_FOOT_R + CLEAR_MARGIN;
    best = { phi, dFoot, fx: 0, fy: 0, clr: 0 };
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
  // The stop work's hardware lives entirely in the plate cut's open wedge
  // (where inCutClearance already forbids seats) and its hack rod runs
  // above the pillar tops, so — unlike the old blade/collar layout, whose
  // mid-movement sweep once swallowed a pillar seat — the hacking no
  // longer constrains the pillars at all. The lever's tail-post arc is
  // still covered by tqSlots, and the pillars are a swept unit now, so any
  // future regression is caught by the inspector rather than by luck.
  const seatClearance = (x, y) => {
    let c = Math.min(inCutClearance(x, y), plateR - Math.hypot(x, y));
    for (const h of tqHoles) c = Math.min(c, Math.hypot(x - h.x, y - h.y) - h.r);
    for (const s of tqSlots) {
      const vx = s.bx - s.ax, vy = s.by - s.ay, L2 = vx * vx + vy * vy || 1e-9;
      const t = clamp(((x - s.ax) * vx + (y - s.ay) * vy) / L2, 0, 1);
      c = Math.min(c, Math.hypot(x - s.ax - t * vx, y - s.ay - t * vy) - s.r);
    }
    // ...and it must not foul what is UNDER the plate either: the pillar runs
    // the full height of the movement, past the whole train.
    for (const o of [barrelArbor, centerArbor, thirdArbor, fourthArbor, escapeArbor, forkGroup, drumGroup, keyless, forkCock.obj]) {
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

const dialRadius = plateR * 0.92;
// Sub-dial positions in dial-local coordinates (+y = 12 o'clock; the
// dialFace Y-flip makes these read correctly from the front). The reserve
// face itself is painted into the dial texture by makeDial; only the bezel
// and hand remain separate meshes (added below at this same position).
// 12 o'clock — symmetric with the small-seconds sub-dial at 6 (the fourth
// wheel sits D4 below centre); also much closer to the barrel's dial-side
// projection than the old 6-o'clock spot, so the reserve reduction train
// spans a shorter, cleaner run.
const RESERVE_LOCAL = { x: 0, y: dialRadius * 0.39 };
// Small seconds live ON the fourth wheel's axis — dial-local coordinates
// mirror world x through the dialFace Y-flip.
const SECONDS_LOCAL = { x: -(P.fourth.x - P.dial.x), y: P.fourth.y - P.dial.y };
// Sub-dial radius — as large as the face allows while staying balanced:
// one shared radius for both wells (their pivots are fixed on their
// arbors, so only the radius can grow), capped by the clearance the
// central hands' boss needs around the dial centre. This lands ≈ 0.30 of
// the dial radius (up from 0.2); the bigger wells swallow the XI/I and
// V/VII numerals symmetrically, leaving II–IIII and VIII–X.
const subDialR = Math.min(RESERVE_LOCAL.y, -SECONDS_LOCAL.y) - 4.5; // slightly inboard of the maximum — breathing room against the hour ring
const reserveR = subDialR;
const secondsSubR = subDialR;
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

const dial = G.makeDial({
  radius: dialRadius,
  subdialRecess: SUBDIAL_RECESS,
  centerBoreR: HOUR_TUBE_OUTER + 0.2, // tube passes through with running clearance
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
registerExplode(handsGroup, 2.5, 2, 1);

// The MINUTE hand rides the cannon pinion; the HOUR hand is mounted on the
// hour wheel's tube further down (see the motion works), so it is NOT added
// here — it becomes a child of hourWheelGroup and inherits that wheel's
// rotation rather than being posed independently.
const hourHand = G.makeHand({ length: dialRadius * 0.5, kind: 'hour' });
const minuteHand = G.makeHand({ length: dialRadius * 0.84, kind: 'minute' }); // tip stops just short of the railroad (inner rail at 0.87R)
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

const cannonPinion = G.makePinion({ module: MW_MODULE_1, teeth: cannonPinionTeeth, thickness: 2, material: MATS.steel });
cannonPinion.position.z = -1.5;
dialFace.add(cannonPinion);

// Planes (dialFace-local): the minute wheel must sit in the cannon pinion's
// plane to mesh it; the minute pinion and hour wheel share a second plane
// behind that. Both stay clear of the sub-dial well floors at −SUBDIAL_RECESS.
const MW_Z1 = -1.5;   // cannon pinion / minute wheel
const MW_Z2 = -3.0;   // minute pinion / hour wheel
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

// Load persisted state now that every variable it writes has been declared.
// loadState() is async (the primary store is the dev server's temp file);
// top-level await is fine here — main.js is an ES module.
{
  const savedState = await loadState();
  barrelWindTurns = savedState.barrelWindTurns;
  tauIntegrated = savedState.tauIntegrated;
  crownRotation = savedState.crownRotation;
  crownOut = savedState.crownOut;
  fastForward = savedState.fastForward;
  restoredCamera = savedState.camera;
  restoredXray = !!savedState.plateXray;
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
  padding: 14px 16px; width: 240px;
  font: 12px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #d8dee6; user-select: none;
}
#clock-ui h1 { font-size: 12px; margin: 0 0 10px; letter-spacing: 0.06em; text-transform: uppercase; color: #8fa6bf; font-weight: 600; }
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
#clock-ui .tq { flex: 1; max-width: 128px; height: 6px; background: rgba(255,255,255,0.08); border-radius: 3px; overflow: hidden; }
#clock-ui .tq i { display: block; height: 100%; background: #3a6bd8; width: 100%; transition: none; }
#clock-ui .tq i.flat { background: #58b368; }
#clock-ui .readout { font-variant-numeric: tabular-nums; font-size: 15px; color: #f2efe6; letter-spacing: 0.03em; }
#clock-ui .label-small { color: #8b95a1; font-size: 10.5px; }
#clock-ui hr { border: none; border-top: 1px solid rgba(255,255,255,0.08); margin: 10px 0; }
#clock-labels { position: fixed; inset: 0; pointer-events: none; z-index: 5; }
.clock-label {
  position: absolute; transform: translate(-50%, -140%); font: 11px/1 -apple-system, sans-serif;
  color: #cfe3ff; background: rgba(10,12,15,0.55); padding: 2px 6px; border-radius: 4px;
  white-space: nowrap; border: 1px solid rgba(255,255,255,0.1);
}
`;
document.head.appendChild(style);

const panel = document.createElement('div');
panel.id = 'clock-ui';
panel.innerHTML = `
  <h1>Lever Escapement</h1>
  <button id="btn-hide-ui" title="Hide panel (H)">Hide</button>
  <div class="row">
    <button id="btn-pause">Pause</button>
    <span class="readout" id="readout-time">00:00:00</span>
  </div>
  <div class="row label-small"><span>Beats</span><span class="readout" id="readout-beats" style="font-size:13px;">0</span></div>
  <div class="row">
    <span class="label-small">Time-scale</span>
    <input type="range" id="scale-slider" min="0" max="1000" step="1" />
  </div>
  <div class="row label-small"><span id="scale-value">0.15×</span><button id="btn-wind">Wind</button></div>
  <div class="row label-small"><span>Crown</span><button id="btn-crown">Pull out</button></div>
  <div class="row label-small"><span>Power reserve</span><span class="readout" id="reserve-value" style="font-size:13px;">30.0 h</span></div>
  <div class="row label-small"><span>Fast-forward</span><button id="btn-ff">Off</button></div>
  <div class="row label-small"><span>Spring torque</span><span class="tq"><i id="bar-spring"></i></span></div>
  <div class="row label-small"><span>Train torque</span><span class="tq"><i id="bar-train" class="flat"></i></span></div>
  <hr/>
  <div class="row label-small"><span>Camera</span></div>
  <div class="row presets">
    <button data-cam="Escapement">Escapement</button>
    <button data-cam="Train">Train</button>
    <button data-cam="Dial">Dial</button>
    <button data-cam="Free">Free</button>
  </div>
  <hr/>
  <div class="row">
    <span class="label-small">Exploded view</span>
    <input type="range" id="explode-slider" min="0" max="100" step="1" value="0" />
  </div>
  <div class="row">
    <span class="label-small">Labels</span>
    <button id="btn-labels">Off</button>
  </div>
  <div class="row">
    <span class="label-small">Plate X-ray</span>
    <button id="btn-xray">Off</button>
  </div>
  <hr/>
  <div class="row label-small"><span>Finish</span></div>
  <div class="row label-small"><span>Light</span><button id="btn-light-mode">Studio</button></div>
  <div class="row">
    <span class="label-small">Hand flute</span>
    <input type="range" id="flute-slider" min="-60" max="30" step="1" />
  </div>
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
    [hourHand, { length: dialRadius * 0.5, kind: 'hour' }],
    [minuteHand, { length: dialRadius * 0.905, kind: 'minute' }],
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

// --- time-scale (log slider, 0.02..1, default 0.15) ----------------------
const SCALE_MIN = 0.02, SCALE_MAX = 1;
let timeScale = 0.15;
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
scaleValueEl.textContent = timeScale.toFixed(2) + '×';
scaleSlider.addEventListener('input', () => {
  timeScale = sliderToScale(Number(scaleSlider.value));
  scaleValueEl.textContent = timeScale.toFixed(2) + '×';
});

// --- pause/play -------------------------------------------------------
let paused = false;
const pauseBtn = document.getElementById('btn-pause');
pauseBtn.addEventListener('click', () => {
  paused = !paused;
  pauseBtn.textContent = paused ? 'Play' : 'Pause';
  pauseBtn.classList.toggle('active', paused);
});

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
  setCrownOut(!crownOut);
  updateCrownUI();
}
crownBtn.addEventListener('click', toggleCrown);

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

// --- labels toggle --------------------------------------------------------
let labelsOn = false;
document.getElementById('btn-labels').addEventListener('click', () => {
  labelsOn = !labelsOn;
  labelsContainer.style.display = labelsOn ? 'block' : 'none';
  document.getElementById('btn-labels').textContent = labelsOn ? 'On' : 'Off';
  document.getElementById('btn-labels').classList.toggle('active', labelsOn);
});

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
function setXray(on) {
  xrayOn = on;
  tqPlateMesh.material = on ? tqXrayMat : tqSolidMat;
  const b = document.getElementById('btn-xray');
  b.textContent = on ? 'On' : 'Off';
  b.classList.toggle('active', on);
}
document.getElementById('btn-xray').addEventListener('click', () => setXray(!xrayOn));
if (restoredXray) setXray(true);

// --- state persistence (save/load/clear) -----------------------------------
// Create state buttons dynamically to avoid template literal issues
const stateSection = document.createElement('div');
stateSection.innerHTML = `
  <hr/>
  <div class="row label-small"><span>State</span></div>
  <div class="row presets" id="state-buttons">
    <button id="btn-save-state">Save</button>
    <button id="btn-load-state">Load</button>
    <button id="btn-clear-state">Clear</button>
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
    crownOut,
    fastForward,
    timeScale: Math.pow(10, (Number(document.getElementById('scale-slider').value) / 1000) * 3 - 3),
    showLabels: labelsOn,
    plateXray: xrayOn,
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
  document.querySelectorAll('#clock-ui .presets button').forEach((b) => b.classList.toggle('active', b.dataset.cam === name));
}
document.querySelectorAll('#clock-ui .presets button').forEach((b) => {
  b.addEventListener('click', () => goToPreset(b.dataset.cam));
});
// Restore a saved camera pose if one was persisted; otherwise frame the
// default Escapement preset. A restore snaps directly (no tween) and cancels
// any in-flight preset tween so it isn't overwritten next frame.
if (restoredCamera) {
  camera.position.set(restoredCamera.px, restoredCamera.py, restoredCamera.pz);
  controls.target.set(restoredCamera.tx, restoredCamera.ty, restoredCamera.tz);
  controls.update();
  camTween = null;
  document.querySelectorAll('#clock-ui .presets button').forEach((b) => b.classList.remove('active'));
} else {
  goToPreset('Escapement');
}

// ---------------------------------------------------------------------------
// Animation loop — fixed-timestep accumulation for the sim; render on rAF.
// ---------------------------------------------------------------------------
const FIXED_DT = 1 / 240;
let simTime = 0;
let accumulator = 0;
let lastNow = performance.now();
let lastAutoSaveTime = 0;

const projected = new THREE.Vector3();

function formatTime(simSeconds) {
  const total = Math.floor(simSeconds) % 86400;
  const hh = Math.floor(total / 3600) % 24;
  const mm = Math.floor(total / 60) % 60;
  const ss = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
}

function updateExplode() {
  const UNIT = 4;
  for (const e of explodeEntries) {
    e.obj.position.z = e.baseZ + explodeAmount * e.dir * e.layer * UNIT;
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
    const { obj } = labelEntries[i];
    obj.getWorldPosition(projected);
    projected.project(camera);
    const behind = projected.z > 1;
    const el = labelEls[i];
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
  const rawDt = clamp(t - lastTickRawT, 0, fastForward ? 2.5 : 0.25);
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
  // handSetOffset, the real angle contributed by turning the crown in the
  // setting position. Computed here (before the hands) and reused below
  // when driving the actual gear meshes, so it's derived once, not twice.
  const settingWheelSpin = -setPathRot * (windPinionTeeth / settingWheelTeeth);
  const minuteArborSpin = -settingWheelSpin * (settingWheelTeeth / minuteWheelTeeth);
  const handSetOffset = -minuteArborSpin * (minutePinionTeeth / cannonPinionTeeth);

  // Hands: driven by the same train functions, but zero-referenced against
  // t=0 so the dial reads 12:00:00 at sim start (the raw angles carry the
  // arbitrary tooth-interleaving phase constants), plus handSetOffset from
  // manual time-setting. Sign notes: centerAngle decreases with t (−2π per
  // sim hour); a hand's local +Z axis points toward the viewer on the dial
  // (-Z) side through dialFace's Y-flip, so a decreasing local rotation
  // reads as a clockwise sweep from the front — the raw deltas already
  // have the right sense.
  const minuteA = centerAngle(tau) - centerAt0 + handSetOffset; // −2π per hour
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
    resetRod.position.set((postNow.x + b.x) / 2, (postNow.y + b.y) / 2, Z_SECONDS_ARBOR + ROD_Z_LIFT);
    resetRod.rotation.z = Math.atan2(dy, dx) - Math.PI / 2;
  }

  // Keyless works — the stem always spins with the crown; the two
  // downstream paths below only reflect rotation actually delivered to
  // THEM (windPathRot / setPathRot), so whichever one is disengaged simply
  // holds still — a genuine consequence of the clutch routing above, not a
  // separate "which am I animating" branch here.
  windSpinner.rotation.y = crownRotation;

  const crownWheelSpin = -windPathRot * (windPinionTeeth / crownWheelTeeth);
  crownWheel.rotation.z = crownWheelBase + crownWheelSpin;
  transferWheel.rotation.z = crownWheel.rotation.z; // keyed to the same arbor
  if (ratchetMesh) {
    // Ratchet + fusee cone are keyed together, and their rotation is a pure
    // function of chain hauled: −2π per BANKED winding turn (backwards
    // against the train direction, exactly one cone turn per turn of chain
    // pulled home), riding on the arbor's own train rotation. Raw crown
    // input past full reserve moves neither — the chain is home.
    const windBack = -windAccumTurns * Math.PI * 2;
    ratchetMesh.rotation.z = windBack;
    fusee.rotation.z = windBack;
    if (clickMesh) clickMesh.rotation.z = clickBaseRot - 0.06 * Math.abs(Math.sin(windBack * 12));
  }

  // Fusee chain & drum: the drum's angle is a closed-form function of how
  // much chain has paid onto it; the chain mesh is rebuilt whenever the
  // reserve state has visibly moved (cheap — a few hundred tube segments).
  drumGroup.rotation.z = ((1 - tension) * CHAIN_ENGAGED) / DRUM_R;
  if (Math.abs(tension - lastChainTension) > 0.0015) rebuildChain(tension);

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
}

tick(0); // seed correct initial pose before the first paint

function frame(now) {
  const realDt = Math.min((now - lastNow) / 1000, 0.05);
  lastNow = now;

  if (!paused) {
    if (fastForward) {
      // ~5400×: 45 coarse 2 s ticks per frame — the whole 30 h reserve pays
      // off in about 20 s of wall time, chain and reserve hand visibly moving.
      for (let i = 0; i < 45; i++) {
        simTime += 2;
        tick(simTime);
      }
      accumulator = 0;
      if (reserveShown <= 0.0005) fastForward = false; // ran flat — drop back to real time
    } else {
      accumulator += realDt * timeScale;
      while (accumulator >= FIXED_DT) {
        simTime += FIXED_DT;
        accumulator -= FIXED_DT;
        tick(simTime);
      }
    }
  }

  // Time and beats read the MOVEMENT's clock (τ): they stop when it stops.
  const tauNow = tauIntegrated;
  document.getElementById('readout-time').textContent = formatTime(tauNow);
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
  renderer.render(scene, camera);

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
  get balanceRate() { return balanceRate; },
  get leverEngage() { return leverEngage; },
  get secondsZeroRef() { return secondsZeroRef; },
  get fourthAngle() { return fourthAngle(tauIntegrated); },
  get barrelWindTurns() { return barrelWindTurns; },
  get tension() { return clamp(barrelWindTurns / RESERVE_BARREL_TURNS, 0, 1); },
  get crownRotation() { return crownRotation; },
  get windPathRot() { return windPathRot; },
  get setPathRot() { return setPathRot; },
  setCrownRotation(v) { crownRotation = v; },
  setBarrelWindTurns(v) { barrelWindTurns = clamp(v, 0, RESERVE_BARREL_TURNS); },
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
    tick(lastTickRawT);
    scene.updateMatrixWorld(true);
  },
  render() { renderer.render(scene, camera); },
  movement,
  camera, controls, scene, labelEntries,
  // Layout introspection for the realism-inspection tooling.
  P, plateR, dialRadius,
};

requestAnimationFrame(frame);
