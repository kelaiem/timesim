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
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0b0d);
scene.fog = new THREE.Fog(0x0a0b0d, 180, 420);

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.5, 2000);
camera.position.set(60, 55, 90);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance = 25;
controls.maxDistance = 420;

// Lights: hemisphere fill + 2 shadowed directional/spot lights (studio look).
const hemi = new THREE.HemisphereLight(0x8fa6bf, 0x0a0a0c, 0.65);
scene.add(hemi);

const keyLight = new THREE.DirectionalLight(0xfff1de, 2.4);
keyLight.position.set(70, 90, 70);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.left = -110;
keyLight.shadow.camera.right = 110;
keyLight.shadow.camera.top = 110;
keyLight.shadow.camera.bottom = -110;
keyLight.shadow.camera.near = 1;
keyLight.shadow.camera.far = 320;
keyLight.shadow.bias = -0.0005;
scene.add(keyLight);
scene.add(keyLight.target);

const fillLight = new THREE.DirectionalLight(0xcfe3ff, 0.55);
fillLight.position.set(-70, 35, -50);
scene.add(fillLight);

// Dial side (-Z) gets its own soft key so the face isn't lit only by spill.
const dialLight = new THREE.DirectionalLight(0xfff4e2, 1.4);
dialLight.position.set(25, 45, -110);
scene.add(dialLight);

const rimSpot = new THREE.SpotLight(0xffffff, 220, 400, Math.PI / 6.5, 0.35, 1.4);
rimSpot.position.set(-10, 70, 150);
rimSpot.castShadow = true;
rimSpot.shadow.mapSize.set(1024, 1024);
scene.add(rimSpot);
scene.add(rimSpot.target);

// Soft dark backdrop plane behind the movement to catch light / read as a studio wall.
const backdrop = new THREE.Mesh(
  new THREE.PlaneGeometry(600, 400),
  new THREE.MeshStandardMaterial({ color: 0x101317, roughness: 1, metalness: 0 })
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
//  · L_BALANCE = L_FORK + 4 — the roller stack (table + impulse pin +
//    safety roller) is built exactly 4 below the wheel in makeBalanceWheel,
//    so this lands the pin in the fork notch;
//  · L_COCK/L_HAIRSPRING ride the balance.
// Stride 2.1 is the floor set by the BRIDGES, not the wheels: each cock is
// a centred slab ±(width·0.2 + bevel) thick, and it must fit between its
// own wheel pair's planes and the next wheel up that crosses it (solved:
// feasible only for stride ≥ ~2.06 at the current cock widths).
const L_BARREL = 2;     // great-wheel plane (meshes center pinion)
const L_CENTER = 4.1;   // center wheel (meshes third pinion)
const L_THIRD = 6.2;    // third wheel (meshes fourth pinion)
const L_FOURTH = 8.3;   // fourth wheel (meshes escape pinion)
const L_ESCAPE = 10.4;  // escape wheel (engages pallet fork)
const L_FORK = L_ESCAPE + 1.5;
const L_BALANCE = L_FORK + 4;
const L_HAIRSPRING = L_BALANCE + 1.2;
const L_COCK = L_BALANCE + 2;
// Dial plane (watch front, −z side). Declared with the Z-stack because the
// whole dial gap is part of the same depth budget: the motion-works
// crossing (Z_SETTING), reserve train (Z_RSV) and cannon pinion all pack
// between the plate's back face (−2) and this.
const Z_DIAL = -7;

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
// of XY — lifted drum seat + reduced height, see drumGroup below.
const DRUM_R_ACTUAL = 10;
const DRUM_HEIGHT = 5;
const barrel = G.makeBarrel({ radius: DRUM_R_ACTUAL, height: DRUM_HEIGHT, plain: true });
const greatWheel = G.makeGear({ module: barrelModule, teeth: barrelTeeth, thickness: 2.4, boreR: 1.4, spokes: 5, material: MATS.brass });
const barrelR_actual = greatWheel.userData.r || barrelR;
// FLAT cone (tornado): height squashed 8.5 → 4.5 with the same 3.75 wrap
// turns at a tighter groove pitch, seated just above the ratchet/click.
// The tall cone was the single largest back-side thickness contributor AND
// forced every cross-movement linkage (reset rod, hack blade) to detour
// over it. The third-wheel clearance that used to drive the tall seat is
// now handled in XY instead: the tornado layout keeps |third − barrel|
// ≥ 16.4, so the cone's large end passes the third wheel's rim with margin.
const FUSEE_R_SMALL = 2.6, FUSEE_R_LARGE = 7.4, FUSEE_H = 4.5;
// Base high enough that the LOWEST groove (where the chain rides when the
// reserve is nearly flat) keeps the chain's drum-span clear over the crown
// wheel's top face — the span crosses the crown wheel's XY footprint, so
// the clearance is purely vertical (inspector finding: Chain ⇄ Keyless
// works over the drained half of the reserve axis at 5.1).
const FUSEE_BASE_Z = 6.0;
const fusee = G.makeFusee({ rSmall: FUSEE_R_SMALL, rLarge: FUSEE_R_LARGE, height: FUSEE_H, grooveTurns: 4 });

// --- Center arbor: pinion (meshed by barrel) + center wheel --------------
const centerPinion = G.makePinion({ module: barrelModule, teeth: 10, thickness: 3, material: MATS.steel });
const centerPinionR = centerPinion.userData.r;

const centerModule = 0.3, centerTeeth = 75;
const centerWheel = G.makeGear({ module: centerModule, teeth: centerTeeth, thickness: 2, boreR: 1.2, spokes: 5, material: MATS.brass });
const centerWheelR = centerWheel.userData.r;

// --- Third arbor: pinion (meshed by center wheel) + third wheel ----------
const thirdPinion = G.makePinion({ module: centerModule, teeth: 10, thickness: 3, material: MATS.steel });
const thirdPinionR = thirdPinion.userData.r;

const thirdModule = 0.24, thirdTeeth = 80;
const thirdWheel = G.makeGear({ module: thirdModule, teeth: thirdTeeth, thickness: 1.8, boreR: 1, spokes: 4, material: MATS.brass });
const thirdWheelR = thirdWheel.userData.r;

// --- Fourth arbor: pinion (meshed by third wheel) + fourth wheel ---------
const fourthPinion = G.makePinion({ module: thirdModule, teeth: 10, thickness: 3, material: MATS.steel });
const fourthPinionR = fourthPinion.userData.r;

const fourthModule = 0.21, fourthTeeth = 80;
const fourthWheel = G.makeGear({ module: fourthModule, teeth: fourthTeeth, thickness: 1.6, boreR: 0.9, spokes: 5, material: MATS.brass });
const fourthWheelR = fourthWheel.userData.r;

// --- Escape arbor: pinion (meshed by fourth wheel) + escape wheel --------
const escapePinion = G.makePinion({ module: fourthModule, teeth: 8, thickness: 3, material: MATS.steel });
const escapePinionR = escapePinion.userData.r;

const escapeWheel = G.makeEscapeWheel({ teeth: 15, radius: 4.5, thickness: 1.5 });
const escapeWheelR = escapeWheel.userData.r || 4.5;

// --- Pallet fork + balance ------------------------------------------------
// Staff spans from just below the roller stack up through the cock's jewel
// (poking ~1.5 past it, like a real pivot) — matched to the compressed
// stack rather than the old thickness-proportional default.
const balanceWheel = G.makeBalanceWheel({
  radius: 9,
  thickness: 2.5,
  staffHeight: (L_COCK + 1.4 - L_BALANCE + 1.5) * 2,
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
// stoneZReach: the fork body sits at L_FORK while the escape wheel sits at
// L_ESCAPE — the stones must descend by exactly that gap to land centered
// on the wheel's own Z-thickness rather than grazing one edge of it.
const palletFork = G.makePalletFork({ span: forkSpan, leverLength: forkLeverLength, thickness: 1.2, stoneZReach: L_FORK - L_ESCAPE });
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
// reintroduce the gap.
const notchDepth = 0.8 * forkLeverLength - 0.7 * 1.2; // thickness=1.2, matches the makePalletFork call above
const pinImpulseSweepRad = (AMPLITUDE_VISUAL_DEG * DEG2RAD) * Math.sin(Math.PI * IMPULSE_WIDTH);
const FORK_BANK_DEG = (rollerR * pinImpulseSweepRad) / notchDepth / DEG2RAD / 2;
const FORK_RECOIL_DEG = FORK_BANK_DEG * 0.25; // preserves the original 2.5/10 ratio

const hairspring = G.makeHairspring({
  innerR: Math.max(rollerR * 0.5, 1.5),
  outerR: balanceR * 0.88,
  coils: 10,
  height: 0.6,
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
const BARREL_STEP_DEG = -35;   // center sits down-right of barrel → barrel/crown exit viewed ~1:50
const D4 = 15.5;               // centre → fourth distance (small-seconds pivot radius, ≈0.39·dialRadius)
const ESCAPE_STEP_DEG = -57.9; // escape at viewed ~6:25
const BALANCE_STEP_DEG = 44.6; // balance at viewed ~8:00

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
// plate). The keyless works itself is assembled after the plates below,
// from these same constants.
const KW_MODULE = 0.34;
const crownWheelTeeth = 20, windPinionTeeth = 8, settingWheelTeeth = 20;
const minuteWheelTeeth = 24, minutePinionTeeth = 8;
const CROWN_PULL_DIST = 5; // stem/crown outward slide when pulled to set

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
{
  // Keyless floor: walk the wheel line out along the stem (closed-form
  // pitch radii — module·teeth/2, identical to what makeGear returns) and
  // require the plate to reach 1 unit past the setting wheel and past the
  // folded minute wheel (which sits perpendicular off the stem line at the
  // setting wheel — see the setting-path assembly).
  const kwBarrelDist = barrelR_actual + centerPinionR; // = |P.barrel| by construction
  const kwRatchetR = barrelR * 0.34;                   // matches makeBarrel's ratR
  const kwCrownR = (KW_MODULE * crownWheelTeeth) / 2;
  const kwPinR = (KW_MODULE * windPinionTeeth) / 2;
  const kwSettingR = (KW_MODULE * settingWheelTeeth) / 2;
  const kwMinuteR = (KW_MODULE * minuteWheelTeeth) / 2;
  const kwSwDist = kwBarrelDist + kwRatchetR + kwCrownR + 0.1 // crown wheel centre
    + kwCrownR + kwPinR * 0.55                                // sliding pinion, pushed in
    + CROWN_PULL_DIST + kwPinR * 0.55 + kwSettingR;           // pulled out → setting wheel
  const kwMinuteFoldD = kwSettingR + kwMinuteR + 0.1;
  plateR = Math.max(
    plateR,
    kwSwDist + kwSettingR + 1,
    Math.hypot(kwSwDist, kwMinuteFoldD) + kwMinuteR + 1,
  );
}

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
const fuseeRatchetGroup = G.makeRatchetAndClick({ radius: barrelR * 0.34, teeth: 24, thickness: 0.96 });
fuseeRatchetGroup.position.z = 4.1; // centres the ratchet on the crown-wheel plane
barrelArbor.add(fuseeRatchetGroup);
// TODO(realism): the click is mounted on the GREAT WHEEL (a child of
// barrelArbor, which gets the full train rotation every frame — see
// barrelArbor.rotation.z = barrelMeshAngle(tau) in tick()). That's backwards:
// a click's whole job is to hold the ratchet against backward rotation
// relative to a FIXED reference, which only works if the click itself is
// anchored to something stationary — the plate or a bridge — not to a part
// that co-rotates with the very train it's supposedly holding. As built, the
// click's LOCAL rotation only changes during active winding (windBack,
// below); the rest of the time it's rigidly along for the ride with the
// great wheel, providing no actual ratcheting resistance. Fix: mount the
// click (and its pivot screw) on a bridge/post fixed to the PLATE instead,
// positioned so its beak still reaches the ratchet's tooth circle at the
// barrel arbor's fixed XY — the ratchet itself staying on the arbor is
// correct, only the click's anchor is wrong.
const clickPost = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 2.2, 10), MATS.steel);
clickPost.rotation.x = Math.PI / 2;
clickPost.position.set(barrelR * 0.34 * 1.28, 0, -1.85); // wheel face up to the click pivot
fuseeRatchetGroup.add(clickPost);
fusee.position.z = FUSEE_BASE_Z; // cone base above the ratchet/click AND the third wheel's plane
barrelArbor.add(fusee);
movement.add(barrelArbor);
registerExplode(barrelArbor, L_BARREL, 1);
registerLabel('Fusee & great wheel', barrelArbor);

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
const backPlate = G.makeBackPlate({ radius: plateR, thickness: 2 });
backPlate.position.set(0, 0, -1);
backPlate.receiveShadow = true;
movement.add(backPlate);
registerExplode(backPlate, -1, 0);

function addBridge(fromXY, toXY, z, name, widthScale = 1) {
  const dx = toXY.x - fromXY.x, dy = toXY.y - fromXY.y;
  const len = Math.hypot(dx, dy) + 10;
  const cock = G.makeCock({ length: len, width: 5.5 * widthScale });
  cock.position.set((fromXY.x + toXY.x) / 2, (fromXY.y + toXY.y) / 2, z);
  cock.rotation.z = Math.atan2(dy, dx) - Math.PI / 2; // cock's long axis is local Y
  movement.add(cock);
  registerExplode(cock, z, L_COCK === z ? 9 : 8);
  // Previously unlabelled: these three train bridges were invisible to the
  // whole inspection system (overlap sweep, mechanical graph) — not just
  // ungrounded, but literally not present as units at all, so nothing could
  // ever have flagged that. Every bridge needs to be a real unit before
  // "is it mounted on the plate" can even be asked, let alone answered.
  registerLabel(name, cock);
  return cock;
}
// Bridge planes at wheel + 1.4 (cocks are CENTRED slabs, so each spans
// roughly ±1.4 about this). The barrel-center bridge rides higher (+2.2)
// and NARROWER (0.9): the third wheel's rim passes 12.6 from its
// centre-line, so the old 1.3-wide flank (±2.34) clipped it — at 0.9
// (±1.35 slab, ±2.7 flank) it clears in XY and tucks under the
// ratchet/crown-wheel plane in Z.
addBridge(P.barrel, P.center, L_BARREL + 2.2, 'Barrel-center bridge', 0.9);
addBridge(P.center, P.third, L_CENTER + 1.4, 'Center-third bridge');
addBridge(P.third, P.fourth, L_THIRD + 1.4, 'Third-fourth bridge');

// +1.4 clearance: the cock's underside (its plate is centred on its z) was
// interpenetrating the hairspring's stud and raised terminal (inspector
// finding). TODO(realism): the deeper flaw is that the stud ROTATES with the
// spring — a real stud is fixed to the cock with the spring's outer end
// pinned to it; model a pinned outer terminal and this clearance can shrink.
const balanceCockLen = forkLeverLength * 0.9;
const balanceCock = G.makeCock({ length: balanceCockLen, width: 6 });
balanceCock.rotation.z = Math.atan2(P.balance.y - P.fork.y, P.balance.x - P.fork.x) - Math.PI / 2;
// Position the cock so its sunk JEWEL (at local (0, length·0.12) in makeCock)
// lands exactly on the balance-staff axis — the staff's upper pivot must be
// set in the cock's jewel, not beside it.
{
  const jy = balanceCockLen * 0.12;
  const cs = Math.cos(balanceCock.rotation.z), sn = Math.sin(balanceCock.rotation.z);
  balanceCock.position.set(P.balance.x + jy * sn, P.balance.y - jy * cs, L_COCK + 1.4);
}
movement.add(balanceCock);
registerExplode(balanceCock, L_COCK + 1.4, 9);
registerLabel('Balance cock', balanceCock);

// (The hacking BRAKE is now the hack spring — a long blade actuated by the
// setting lever's post; both are built after the keyless works below, since
// their geometry is solved from the stem/groove positions. The physical
// contact model that decelerates the balance is unchanged, in tick().)

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
const HAMMER_SWING_RAD = THREE.MathUtils.degToRad(30); // retracted clearance angle
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
const heartCam = G.makeHeartCam({ radius: camRadius, thickness: 1.2 });
const hammerPivotDist = heartCam.userData.rMin + hammerArmLen; // so 0° swing lands the roller in the notch
const hammerPivotPos = {
  x: P.fourth.x + uFourthOut.x * hammerPivotDist,
  y: P.fourth.y + uFourthOut.y * hammerPivotDist,
};
const hammerAimAngle = Math.atan2(-uFourthOut.y, -uFourthOut.x); // pivot -> fourth-wheel centre
const hammerBaseAngle = hammerAimAngle - Math.PI / 2;
// Phase the cam so its notch (local θ=0, i.e. local +X) faces the hammer's
// approach direction once reset — the same fixed-direction phasing trick
// used to seat the escape wheel's tooth tips on the pallet stones above.
const camPhaseOffset = hammerAimAngle;

const Z_SECONDS_ARBOR = L_FOURTH + 2.2; // clear of the fourth wheel and escape pinion planes
const secondsCamArbor = new THREE.Group();
secondsCamArbor.position.set(P.fourth.x, P.fourth.y, Z_SECONDS_ARBOR);
secondsCamArbor.add(heartCam);
movement.add(secondsCamArbor);
registerExplode(secondsCamArbor, Z_SECONDS_ARBOR, 4);
registerLabel('Heart cam (seconds reset)', secondsCamArbor);

const hammerLever = G.makeHammerLever({ length: hammerArmLen, width: 2.0 });
const hammerGroup = new THREE.Group();
hammerGroup.position.set(hammerPivotPos.x, hammerPivotPos.y, Z_SECONDS_ARBOR);
hammerGroup.add(hammerLever);
movement.add(hammerGroup);
registerExplode(hammerGroup, Z_SECONDS_ARBOR, 4);
registerLabel('Reset hammer', hammerGroup);

const pillarPositions = [45, 135, 225, 315].map((deg) => ({
  x: Math.cos(deg * DEG2RAD) * (plateR - 8),
  y: Math.sin(deg * DEG2RAD) * (plateR - 8),
}));
for (const pp of pillarPositions) {
  const pillar = G.makePillar({ height: L_COCK + 2 });
  pillar.position.set(pp.x, pp.y, (L_COCK + 2) / 2);
  movement.add(pillar);
}

// Jewel settings at each arbor's front bearing — riding just above each
// wheel's bridge at the compressed stack (bridge planes are wheel + 1.4,
// cock bodies ~1.4 thick).
const jewelSpots = [
  { p: P.barrel, z: L_BARREL + 2.9 }, { p: P.center, z: L_CENTER + 2.9 }, { p: P.third, z: L_THIRD + 2.9 },
  { p: P.fourth, z: L_FOURTH + 2.9 }, { p: P.escape, z: L_ESCAPE + 1.2 }, { p: P.balance, z: L_HAIRSPRING + 0.8 },
];
for (const spot of jewelSpots) {
  const jewel = G.makeJewelSetting({ r: 2 });
  jewel.position.set(spot.p.x, spot.p.y, spot.z);
  movement.add(jewel);
}

// ---------------------------------------------------------------------------
// Keyless works — a real two-position sliding-pinion clutch. windPinion IS
// the sliding pinion: it rides on windSpinner, which already slides axially
// along the stem for the crown pull/push (see CROWN_PULL_DIST below). In
// the pushed-in ("winding") position it meshes crownWheel → ratchet wheel
// on the barrel arbor. Pulled out ("setting"), it slides clear of crownWheel
// and meshes settingWheel instead → minuteArbor (a compound wheel+pinion,
// same trick as the power-reserve train's reduction) → the dial's cannon
// pinion — bypassing the going train entirely, exactly why you can set a
// watch's hands without touching its power reserve. Which path is live is
// decided in tick() by the sliding pinion's ACTUAL animated position
// (crownPullT), not the raw crown target, so mid-slide it's out of mesh
// with both, same as a real clutch in transit.
// ---------------------------------------------------------------------------
const keyless = new THREE.Group();
movement.add(keyless);
registerLabel('Keyless works', keyless);
registerExplode(keyless, 0, 4);

const barrelDist = Math.hypot(P.barrel.x, P.barrel.y) || 1;
const uWind = { x: P.barrel.x / barrelDist, y: P.barrel.y / barrelDist };
const stemAngle = Math.atan2(uWind.y, uWind.x);
// Which side of the stem line the balance (and hence the setting lever /
// hack spring) lives on. NOTE: with the tornado layout the balance sits
// almost exactly ON the stem line's far extension (perpendicular distance
// ≈ 1 unit), so this sign holds by a thin margin — nudging BALANCE_STEP_DEG
// or the barrel angle can silently mirror the whole lever/yoke/hack-spring
// assembly. If that geometry ever looks flipped, check this first.
const vPerp = { x: -uWind.y, y: uWind.x };
const sideSign = Math.sign(P.balance.x * vPerp.x + P.balance.y * vPerp.y) || 1;
const ratchetR = barrelR * 0.34;      // matches makeBarrel's ratR
const Z_KEYLESS = L_BARREL + 4.6;     // the ratchet-wheel plane atop the barrel

// (crownWheelTeeth / windPinionTeeth / settingWheelTeeth / minuteWheelTeeth /
// minutePinionTeeth / CROWN_PULL_DIST / KW_MODULE are declared up by the
// plate-radius computation, which needs them for the keyless floor.)
const crownWheel = G.makeGear({ module: KW_MODULE, teeth: crownWheelTeeth, thickness: 1.1, boreR: 0.7, spokes: 0, material: MATS.steel });
const crownWheelR = crownWheel.userData.r;
const crownWheelBase = Math.PI / crownWheelTeeth; // half-tooth phase into the ratchet
const cwDist = barrelDist + ratchetR + crownWheelR + 0.1;
crownWheel.position.set(uWind.x * cwDist, uWind.y * cwDist, Z_KEYLESS);
keyless.add(crownWheel);
const cwScrew = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.5, 12), MATS.blueSteel);
cwScrew.rotation.x = Math.PI / 2;
cwScrew.position.copy(crownWheel.position);
keyless.add(cwScrew);

// Everything on the stem axis lives in one spinner group (local +Y = outward).
const windPinion = G.makePinion({ module: KW_MODULE, teeth: windPinionTeeth, thickness: 1.6, material: MATS.steel });
const windPinionR = windPinion.userData.r;
const windSpinner = new THREE.Group();
const pinDist = cwDist + crownWheelR + windPinionR * 0.55; // teeth overlap the wheel rim, bevel-style
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
// that the stem slides and spins through, standing on a foot fixed to the
// plate. Without it the whole stem/crown assembly visibly floats.
{
  const bushDist = plateR - 2;
  const bush = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.55, 10, 20), MATS.nickel);
  // Torus plane ⊥ stem: its hole must point along the stem axis.
  bush.rotation.z = stemAngle;
  bush.rotation.y = Math.PI / 2;
  bush.rotation.order = 'ZYX';
  bush.position.set(uWind.x * bushDist, uWind.y * bushDist, Z_KEYLESS);
  keyless.add(bush);
  const foot = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, Z_KEYLESS - 1.2), MATS.nickel);
  foot.position.set(uWind.x * bushDist, uWind.y * bushDist, (Z_KEYLESS - 1.2) / 2 - 0.6);
  keyless.add(foot);
}

// (CROWN_PULL_DIST — the stem's outward slide when hacking — is declared up
// by the plate-radius computation; the winding pinion rides on this same
// group, so pulling out also disengages it from the crown wheel, as on a
// real sliding-pinion keyless works.)

// Knurled crown: faceted barrel (low segment count reads as knurling) + cap.
const crownBody = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 2.2, 14, 1), MATS.brass);
crownBody.position.y = stemLen + 0.4;
const crownCap = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.4, 0.8, 14, 1), MATS.brass);
crownCap.position.y = stemLen + 1.9;
windSpinner.add(crownBody, crownCap);

// Handles into the fusee arbor's ratchet + click for the winding animation.
const ratchetMesh = fuseeRatchetGroup.getObjectByName('ratchet');
const clickMesh = fuseeRatchetGroup.getObjectByName('click');
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
const settingWheelR = settingWheel.userData.r;
const settingWheelBase = Math.PI / settingWheelTeeth;
const pinOutDist = pinDist + CROWN_PULL_DIST; // sliding pinion's centre when fully pulled out
const swDist = pinOutDist + windPinionR * 0.55 + settingWheelR;
settingWheel.position.set(uWind.x * swDist, uWind.y * swDist, Z_KEYLESS);
keyless.add(settingWheel);

const minuteWheel = G.makeGear({ module: KW_MODULE, teeth: minuteWheelTeeth, thickness: 1.0, boreR: 0.6, spokes: 4, material: MATS.brass });
const minuteWheelR = minuteWheel.userData.r;
const minuteWheelBase = Math.PI / minuteWheelTeeth;
const minutePinion = G.makePinion({ module: 0.28, teeth: minutePinionTeeth, thickness: 1.3, material: MATS.steel });
const MINUTE_Z_STEP = 2.0;
// The minute wheel FOLDS perpendicularly off the stem line instead of
// continuing outward: straight-line continuation would put it (and its own
// radius) well past the plate rim. Folded to the side AWAY from the setting
// lever (−sideSign), it clears the lever's tall tail post and the yoke's
// prongs — their flat bodies live ~2 units below this plane, and the only
// parts of them that rise through it sit on the stem axis or the lever
// side. The perpendicular mesh with the setting wheel is unchanged spur
// meshing; only the centre-line direction rotates.
const mwFoldD = settingWheelR + minuteWheelR + 0.1;
const minuteArborXY = {
  x: uWind.x * swDist - sideSign * vPerp.x * mwFoldD,
  y: uWind.y * swDist - sideSign * vPerp.y * mwFoldD,
};
const minuteArbor = new THREE.Group();
minuteArbor.position.set(minuteArborXY.x, minuteArborXY.y, Z_KEYLESS);
minutePinion.position.z = -MINUTE_Z_STEP;
minuteArbor.add(minuteWheel, minutePinion);
keyless.add(minuteArbor);
// Motion-works arbor toward the dial — the minute pinion is nowhere near the
// cannon pinion at the dial centre (the keyless works sits out at the plate
// edge, by the crown; the cannon pinion sits on the centre-wheel axis), so
// this has to actually SPAN that distance to read as connected, not just
// dip through the back plate and stop. Steel rod, like the power-reserve
// arbor's own plate→dial crossing (Z_RSV): drop from the minute arbor's
// plane to a clear crossing plane, travel across to the dial centre's XY,
// then rise to meet the cannon pinion — ending in a small pinion cap so the
// last foot of travel reads as a real mesh, not just a rod poking at it.
//
// Every direction change on this path is a real 90° bevel-gear pair (see
// makeBevelGear in geometry.js) — a plain rod meeting another rod at an
// angle has nothing at the joint that could transmit rotation around the
// corner, so each corner gets two small conical gears, apex-to-apex, one
// keyed to each of the two meeting shafts (standard 45°/45° miter style).
// Rotation is still driven by handSetOffset in tick() (same
// representational-coupling convention as the reserve train), but it's
// threaded explicitly through each corner pair with alternating sign (an
// external bevel mesh reverses sense, same as two spur gears meshing), not
// just teleported to the far end.
//
// The old layout needed an orthogonal step-around here (the straight run
// passed through the power-reserve arbor extension); in the tornado layout
// the keyless works sits on the BARREL's side of the movement and the
// reserve train heads the other way (up to 12 o'clock), so the direct
// traverse clears everything — verified by the full inspection sweep —
// and the arbor is just drop → traverse → rise with two 90° corners.
const Z_SETTING = -3.0; // between the plate's back bevel (−2.3) and the reserve gear plane (Z_RSV −4.2, w1 tops at −3.7)
const settingArborXY = { x: minuteArborXY.x, y: minuteArborXY.y };
const settingDrop = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, Z_KEYLESS - Z_SETTING, 10), MATS.steel);
settingDrop.rotation.x = Math.PI / 2;
settingDrop.position.set(settingArborXY.x, settingArborXY.y, (Z_KEYLESS + Z_SETTING) / 2);
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
const settingB = new THREE.Vector3(P.dial.x, P.dial.y, Z_SETTING);
const settingU = settingB.clone().sub(settingA).normalize();
keyless.add(makeRodSegment(settingA, settingB, 0.35));

const Z_CANNON_PINION = Z_DIAL + 1.5; // cannonPinion sits at dialFace local −1.5, which the Y-flip maps to Z_DIAL + 1.5
const settingRise = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, Z_SETTING - Z_CANNON_PINION, 10), MATS.steel);
settingRise.rotation.x = Math.PI / 2;
settingRise.position.set(P.dial.x, P.dial.y, (Z_SETTING + Z_CANNON_PINION) / 2);
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
// drop → traverse and traverse → rise: two corners, both exactly 90°.
const cornerDrop = addBevelCorner(settingA, Z_UP, settingU);
const cornerRise = addBevelCorner(settingB, settingU.clone().negate(), Z_UP.clone().negate());
// Small pinion cap sitting right beside the cannon pinion — makes the final
// connection visually legible rather than a bare rod tip. Cannon pinion
// itself (module 0.3, 10 teeth → pitch radius 1.5) is defined later in the
// file, alongside the dial; sized/placed here from those same known
// constants rather than referencing the not-yet-declared variable.
const CANNON_PINION_R = (0.3 * 10) / 2;
const settingCap = G.makePinion({ module: 0.3, teeth: 8, thickness: 1.6, material: MATS.steel });
settingCap.position.set(P.dial.x + CANNON_PINION_R + settingCap.userData.r + 0.15, P.dial.y, Z_CANNON_PINION);
keyless.add(settingCap);

// ---------------------------------------------------------------------------
// Setting-lever linkage — the visible actuation chain behind the crown pull.
// The stem carries a grooved collar pair; the setting lever's upright pin
// rides between them, so sliding the crown ROTATES the lever. Its tall tail
// post then does the ganged work of real keyless works: it bears on the hack
// spring (the long blued blade reaching across to the balance rim) and
// drives the reset-hammer rod. A separate yoke tracks the sliding pinion's
// hub collars. All angles below are SOLVED from the stem geometry, so the
// pin stays in the groove and the fork stays on the hub through the slide.
// (vPerp / sideSign are declared up with the stem direction — the folded
// minute wheel needed them earlier.)
// ---------------------------------------------------------------------------

// Groove collars on the stem (ride with windSpinner) + sliding-pinion hub
// collars for the yoke's fork.
const GROOVE_LOCAL = 4; // along the stem, outward of the sliding pinion
{
  const collarGeo = new THREE.CylinderGeometry(0.75, 0.75, 0.5, 12);
  for (const dy of [-0.95, 0.95]) {
    const collar = new THREE.Mesh(collarGeo, MATS.steel);
    collar.position.y = GROOVE_LOCAL + dy;
    windSpinner.add(collar);
  }
  const hubGeo = new THREE.CylinderGeometry(1.5, 1.5, 0.4, 14);
  for (const dy of [-1.7, 1.7]) {
    const hub = new THREE.Mesh(hubGeo, MATS.steel);
    hub.position.y = dy;
    windSpinner.add(hub);
  }
}

// Setting lever: pivoted beside the stem on the balance side; the beak's pin
// tracks the groove, whose along-stem position is pinDist+pull·slide+local.
const SL_C = 10;    // pivot's lateral offset from the stem axis
const SL_TAIL = 6;  // tail arm length (pivot → post)
const Z_SETTING_LEVER = Z_KEYLESS - 2.1;
const slMidAlong = pinDist + CROWN_PULL_DIST / 2 + GROOVE_LOCAL;
const settingLeverPivot = {
  x: uWind.x * slMidAlong + sideSign * vPerp.x * SL_C,
  y: uWind.y * slMidAlong + sideSign * vPerp.y * SL_C,
};
const settingLever = G.makeSettingLever({
  beakLen: Math.hypot(SL_C, CROWN_PULL_DIST / 2),
  tailLen: SL_TAIL,
  width: 3,
  thickness: 1,
  beakPinH: 1.5,
  postH: L_BALANCE - Z_SETTING_LEVER + 0.5,
});
const settingLeverGroup = new THREE.Group();
settingLeverGroup.position.set(settingLeverPivot.x, settingLeverPivot.y, Z_SETTING_LEVER);
settingLeverGroup.add(settingLever);
movement.add(settingLeverGroup);
registerExplode(settingLeverGroup, Z_SETTING_LEVER, 4);
registerLabel('Setting lever', settingLeverGroup);

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

// Yoke: on the opposite side of the stem, its fork tracking the sliding
// pinion's hub (which travels with the crown pull).
const YK_C = 7.5;
const Z_YOKE = Z_KEYLESS - 2.3;
const yokeMidAlong = pinDist + CROWN_PULL_DIST / 2;
const yokePivot = {
  x: uWind.x * yokeMidAlong - sideSign * vPerp.x * YK_C,
  y: uWind.y * yokeMidAlong - sideSign * vPerp.y * YK_C,
};
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
registerExplode(yokeGroup, Z_YOKE, 4);
registerLabel('Yoke', yokeGroup);

function yokeAngleAt(pull) {
  const along = pinDist + pull * CROWN_PULL_DIST;
  const px = uWind.x * along, py = uWind.y * along;
  return Math.atan2(py - yokePivot.y, px - yokePivot.x) - Math.PI / 2;
}

// Hack spring: anchored so the setting-lever post bears on its flank near
// the anchor; the blade runs from there across the movement to the balance
// rim. All of it derived from the post's actual engaged/released positions.
const HACK_LIFT = 0.09;       // rad — blade deflection between released/braking
const HACK_PRESS_DIST = 19.5; // post's bearing point, this far from the anchor
const postEng = tailPostWorldAt(1);
const postRel = tailPostWorldAt(0);
let uB = { x: P.balance.x - postEng.x, y: P.balance.y - postEng.y };
{
  const m = Math.hypot(uB.x, uB.y) || 1;
  uB = { x: uB.x / m, y: uB.y / m };
}
// Component of the post's engaging travel perpendicular to the blade — the
// direction it pushes the flank.
let pushDir = (() => {
  const t = { x: postEng.x - postRel.x, y: postEng.y - postRel.y };
  const along = t.x * uB.x + t.y * uB.y;
  const p = { x: t.x - along * uB.x, y: t.y - along * uB.y };
  const m = Math.hypot(p.x, p.y);
  if (m < 1e-6) return { x: -uB.y, y: uB.x };
  return { x: p.x / m, y: p.y / m };
})();
const bladeAnchor = {
  x: postEng.x + pushDir.x * 1.3 - uB.x * HACK_PRESS_DIST,
  y: postEng.y + pushDir.y * 1.3 - uB.y * HACK_PRESS_DIST,
};
const bladeToBalance = Math.hypot(P.balance.x - bladeAnchor.x, P.balance.y - bladeAnchor.y);
const bladeAimAngle = Math.atan2(P.balance.y - bladeAnchor.y, P.balance.x - bladeAnchor.x);
// Rotating the blade by +δ moves its flank along ẑ×û; releasing must move it
// WITH the retreating post (−pushDir), which fixes the lift's sign.
const zCrossU = { x: -uB.y, y: uB.x };
const BLADE_LIFT_SIGN = -Math.sign(zCrossU.x * pushDir.x + zCrossU.y * pushDir.y) || 1;
const hackSpring = G.makeHackSpring({ length: bladeToBalance - balanceR, width: 1.6, thickness: 0.8 });
const bladeGroup = new THREE.Group();
bladeGroup.position.set(bladeAnchor.x, bladeAnchor.y, L_BALANCE);
bladeGroup.add(hackSpring);
movement.add(bladeGroup);
registerExplode(bladeGroup, L_BALANCE, 7);
registerLabel('Hack spring', bladeGroup);

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
// own body.)
const FUSEE_TOP_Z = L_BARREL + FUSEE_BASE_Z + FUSEE_H;
// 0.7 = rod radius (0.35) + clearance: the rod's straight run passes only
// ~0.6 from the barrel AXIS (measured live), i.e. essentially over the
// cone's apex, so it must clear the cone's full axis-top height.
const ROD_Z_LIFT = Math.max(2.3, FUSEE_TOP_Z + 0.7 - Z_SECONDS_ARBOR);
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
{
  const riser = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, ROD_Z_LIFT, 10), MATS.steel);
  riser.rotation.x = Math.PI / 2;
  riser.position.set(0, 0, ROD_Z_LIFT / 2);
  hammerGroup.add(riser);
}
const resetRod = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1, 8), MATS.steel);
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
const Z_DRUM = L_BARREL + 5;
const drumGroup = new THREE.Group();
drumGroup.position.set(drumPos.x, drumPos.y, Z_DRUM);
drumGroup.add(barrel);
movement.add(drumGroup);
registerExplode(drumGroup, Z_DRUM, 1);
registerLabel('Mainspring drum', drumGroup);

// Chain: rebuilt (cheaply) whenever the reserve state moves enough to see.
const FUSEE_Z0 = L_BARREL + FUSEE_BASE_Z + FUSEE_H * 0.06; // world z of the lowest groove
const FUSEE_ZSPAN = FUSEE_H * 0.88;               // groove band height
const DRUM_CHAIN_Z = Z_DRUM + DRUM_HEIGHT * 0.4;  // chain rides near the drum's top
const chainMat = new THREE.MeshPhysicalMaterial({ color: 0x3a3d42, metalness: 1, roughness: 0.45 });
let chainMesh = null;
let lastChainTension = -1;
function fuseeGrooveAt(f) { // f: 0 = bottom/large end … 1 = top/small end
  return {
    r: FUSEE_R_LARGE + (FUSEE_R_SMALL - FUSEE_R_LARGE) * f,
    z: FUSEE_Z0 + FUSEE_ZSPAN * f,
  };
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
  // 2. Straight span to the drum's tangent point.
  const TB = { x: drumPos.x + Math.cos(thetaT) * DRUM_R, y: drumPos.y + Math.sin(thetaT) * DRUM_R };
  pts.push(new THREE.Vector3(TB.x, TB.y, DRUM_CHAIN_Z));
  // 3. Wrap accumulated on the drum (grows as the reserve drains).
  const drumTurns = ((1 - tension) * CHAIN_ENGAGED) / (2 * Math.PI * DRUM_R) + 0.3;
  const nD = Math.max(Math.ceil(drumTurns * SEG_PER_TURN), 2);
  for (let i = 1; i <= nD; i++) {
    const s = (i / nD) * drumTurns;
    const ang = thetaT + s * Math.PI * 2;
    pts.push(new THREE.Vector3(
      drumPos.x + Math.cos(ang) * DRUM_R,
      drumPos.y + Math.sin(ang) * DRUM_R,
      DRUM_CHAIN_Z - s * 0.9
    ));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const geo = new THREE.TubeGeometry(curve, pts.length * 2, 0.3, 6, false);
  if (chainMesh) {
    chainMesh.geometry.dispose();
    chainMesh.geometry = geo;
  } else {
    chainMesh = new THREE.Mesh(geo, chainMat);
    movement.add(chainMesh);
    registerLabel('Chain', chainMesh);
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
  for (const deg of [10, 130, 250]) {
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
const reserveR = dialRadius * 0.2;
// 12 o'clock — symmetric with the small-seconds sub-dial at 6 (the fourth
// wheel sits D4 below centre); also much closer to the barrel's dial-side
// projection than the old 6-o'clock spot, so the reserve reduction train
// spans a shorter, cleaner run.
const RESERVE_LOCAL = { x: 0, y: dialRadius * 0.39 };
// Small seconds live ON the fourth wheel's axis — dial-local coordinates
// mirror world x through the dialFace Y-flip.
const SECONDS_LOCAL = { x: -(P.fourth.x - P.dial.x), y: P.fourth.y - P.dial.y };
const secondsSubR = dialRadius * 0.2;
// Sub-dials are recessed WELLS sunk into the dial (hole + wall + painted
// floor, all built by makeDial); the hands ride inside the well, below the
// dial surface. In dial-local coordinates the well floor is at
// −SUBDIAL_RECESS and the hands at −(SUBDIAL_RECESS − 0.3).
const SUBDIAL_RECESS = 0.5;
const dial = G.makeDial({
  radius: dialRadius,
  subdialRecess: SUBDIAL_RECESS,
  subdials: [
    { x: RESERVE_LOCAL.x, y: RESERVE_LOCAL.y, r: reserveR, kind: 'reserve' },
    { x: SECONDS_LOCAL.x, y: SECONDS_LOCAL.y, r: secondsSubR, kind: 'seconds' },
  ],
});
dialFace.add(dial);

const handsGroup = new THREE.Group();
handsGroup.position.z = 2.5; // clearly proud of the dial face (avoids z-fighting)
dialFace.add(handsGroup);
// NOTE: handsGroup's parent is dialFace (which is flipped 180° about Y), so
// baseZ here is LOCAL to dialFace — not the world-ish Z_DIAL convention used
// for movement's direct children. dir is also flipped (+1) because the
// parent's Y-rotation inverts the sign of a local-Z displacement once it
// reaches world space (local +Z faces world -Z through this flip).
registerExplode(handsGroup, 2.5, 2, 1);

const hourHand = G.makeHand({ length: dialRadius * 0.5, kind: 'hour' });
const minuteHand = G.makeHand({ length: dialRadius * 0.72, kind: 'minute' });
minuteHand.position.z = 1.2;
handsGroup.add(hourHand, minuteHand);

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

// Cannon-pinion / hour-wheel stack under the dial — no longer just
// decorative: the setting path (see keyless works below) actually drives
// it via handSetOffset in tick().
const cannonPinionTeeth = 10;
const cannonPinion = G.makePinion({ module: 0.3, teeth: cannonPinionTeeth, thickness: 2, material: MATS.steel });
cannonPinion.position.z = -1.5;
dialFace.add(cannonPinion);

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
// onto the balance rim (see hackLeverGroup above). This is modelled as an
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
`;
document.body.appendChild(panel);

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
const crownHitMeshes = [crownBody, crownCap];
function setCrownPointerFromEvent(e) {
  const rect = renderer.domElement.getBoundingClientRect();
  crownPointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  crownPointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
}
function crownHitTest(e) {
  setCrownPointerFromEvent(e);
  crownRaycaster.setFromCamera(crownPointerNDC, camera);
  return crownRaycaster.intersectObjects(crownHitMeshes, false).length > 0;
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
goToPreset('Escapement');

// ---------------------------------------------------------------------------
// Animation loop — fixed-timestep accumulation for the sim; render on rAF.
// ---------------------------------------------------------------------------
const FIXED_DT = 1 / 240;
let simTime = 0;
let accumulator = 0;
let lastNow = performance.now();

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
  hairspringGroup.rotation.z = PIN_AIM + theta;
  const breathe = 1 + 0.04 * Math.sin(2 * Math.PI * F_BALANCE * tau);
  hairspringGroup.scale.set(breathe, breathe, 1);

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
  hourHand.rotation.z = minuteA / 12;
  minuteHand.rotation.z = minuteA;
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
  // sliding pinion's hub. The hack spring deflects on leverEngage — the
  // same value driving the contact damping above — pressed by the lever's
  // tail post; its pad lands exactly on the balance rim at full engage.
  settingLeverGroup.rotation.z = settingLeverAngleAt(crownPullT);
  yokeGroup.rotation.z = yokeAngleAt(crownPullT);
  bladeGroup.rotation.z = bladeAimAngle + BLADE_LIFT_SIGN * HACK_LIFT * (1 - leverEngage);

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
  // unaffected by the sign.
  const postNow = tailPostWorldAt(crownPullT);
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
  settingCap.rotation.z = handSetOffset;

  // Power-reserve hand — barrelWindTurns (via tension) IS the mechanical
  // quantity now; no separate epoch/pulse bookkeeping needed since winding
  // is continuous rather than a discrete button press.
  reserveShown = tension;
  reserveHand.rotation.z = (60 - reserveShown * 120) * DEG2RAD;

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
