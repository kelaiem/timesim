// src/materials.js — shared PBR materials (Agent A).
// All materials are MeshPhysicalMaterial so the whole movement reads as one
// coherent set of finishes under the studio lighting in main.js.
import * as THREE from 'three';

function phys(params) {
  return new THREE.MeshPhysicalMaterial(params);
}

// Polished gold-yellow brass for wheels, barrel, plates trim.
const brass = phys({
  color: 0xd7a94a,
  metalness: 1.0,
  roughness: 0.26,
  clearcoat: 0.35,
  clearcoatRoughness: 0.25,
  reflectivity: 0.6,
});

// Bright, near-white steel for pinions, arbors, fork, springs. ONE finish
// declared once and shared below: §203 measured this as neither brushed nor
// polished — isotropic roughness 0.30 under a hazed clearcoat is a SATIN —
// and its 0.30 and 0xd6d9dd are authored numbers with no derivation (§86's
// class), named as such here rather than laundered. §203 step 2 adds the
// grain and the polished end; both materials below must move together
// when it does, which is what sharing the literal buys.
const STEEL_FINISH = {
  color: 0xd6d9dd,
  metalness: 1.0,
  roughness: 0.30,
  clearcoat: 0.15,
  clearcoatRoughness: 0.3,
};
const steel = phys({ ...STEEL_FINISH });

// §203 step 1 — the CASE EXTERIOR is its own material object: the band, back
// ring, stem sleeves and collars (makeCase's `material`), both crowns and the
// pusher cap. Identical to `steel` today by construction (the same object
// literal), and a separate INSTANCE on purpose: an alloy (§203 step 3 — 18K
// yellow gold, white gold, platinum) reaches a case and never a pinion or a
// spring, and before this split there was no object to give it to — `steel`
// was 226 meshes including the case. Nothing here moves geometry; the
// battery's --report must read byte-identical across this change, and
// materials enter neither the fingerprint nor any sweep.
const caseMetal = phys({ ...STEEL_FINISH });

// §203 step 2 — THE FINISH SLIDER, `materials.steel.brush` (0 polished → 1
// brushed, default 1), and the grain it lays.
//
// Two ends, each a CONSTRAINT rather than a taste. Polished is the renderer's
// own roughness floor: lights_physical_fragment clamps `max(roughnessFactor,
// 0.0525)`, so any smaller number does nothing, and the lobe is isotropic.
// Brushed is `anisotropy = 1`, the BRDF's saturation, with the across-grain
// roughness at STEEL_FINISH's 0.30 — the authored, underived number named
// above (item 86's class). Between them both mix linearly. The roadmap entry
// first said the slider would drive anisotropy ALONE and leave roughness
// constant; measured against the ask, that put the shipped SATIN at the
// polished end (0.30 isotropic is what the movement looked like before this
// slider existed), so roughness rides the slider too, and the entry's record
// says so.
//
// THE DIRECTION IS A WORLD-SPACE LAW, never the UV tangent. three's
// anisotropy frame is `getTangentFrame(-vViewPosition, normal, vUv)` — screen
// derivatives of the UVs — so left alone the grain runs whichever way each
// builder's parametrisation happens to (a lathe's around its axis, an
// extrude's along world x, a box's per face), and a welded geometry with no
// `uv` attribute gives a zero derivative and a NaN frame. The override below
// reads the WORLD normal instead, the ribbing's construction: a face whose
// normal is within the ribbing's cos 45° gate of ±z is a FLAT (a lever, a
// spring, a cock, the bezel top) and is straight-grained along
// `brushAngleDeg` in the plate plane; everything else — an arbor, a pinion
// body, the band's flank, a crown — is grained circumferentially about the
// movement axis, `cross(ẑ, n)`, the direction a lathe or a turning brush
// leaves. Written after lights_physical_fragment so `tbn` is never read.
//
// THE DEFINE IS HELD ON. `MeshPhysicalMaterial`'s anisotropy setter bumps the
// material version whenever the value crosses zero, which is a shader
// RECOMPILE mid-drag — so the polished end is BRUSH_EPS, not 0: the shader's
// only zero-guard is `if (material.anisotropy == 0.0)`, and at 1e-3 the lobe
// is isotropic to one part in a million. A drag is then two property writes
// (roughness, anisotropy — both refreshed from the material every frame) and
// one uniform (the grain direction), never a program.
export const BRUSH_POLISH_FLOOR = 0.0525;  // three r165, lights_physical_fragment: max(roughnessFactor, 0.0525)
export const BRUSH_EPS = 1e-3;             // below the slider's step (1/100 of its range); the shader's zero without the define flip
const BRUSH_FLAT_GATE = 0.7;               // the ribbing's own gate (vRibNormal.z > 0.7): cos 45°, the diagonal between a flat and a flank
const BRUSH_MATERIALS = [steel, caseMetal];
function installBrush(mat) {
  mat.onBeforeCompile = (shader) => {
    // §142 found, §203/§119's class: the shader handle must not be an ENUMERABLE member of userData —
    // Material.copy deep-copies userData through JSON, and a shader carries its uniforms' textures
    // (the env PMREM, the shadow map), so every clone of this material (power flow's ghosts, focus)
    // serialised them all and warned per texture. Non-enumerable: readers still find it, JSON does not,
    // and a clone gets its own onBeforeCompile and its own handle, which is the correct one.
    Object.defineProperty(mat.userData, 'shader', { value: shader, enumerable: false, configurable: true, writable: true });
    const a = ((aesthetics.materials?.steel?.brushAngleDeg ?? 0) * Math.PI) / 180;
    shader.uniforms.brushDir = { value: new THREE.Vector2(Math.cos(a), Math.sin(a)) };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBrushNormal;')
      .replace('#include <begin_vertex>',
        '#include <begin_vertex>\nvBrushNormal = normalize(mat3(modelMatrix) * objectNormal);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBrushNormal;\nuniform vec2 brushDir;')
      .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
      #ifdef USE_ANISOTROPY
      {
        vec3 nW = normalize(vBrushNormal);
        vec3 tW = (abs(nW.z) > ${BRUSH_FLAT_GATE})
          ? vec3(brushDir, 0.0)                 // a flat: straight grain along the declared angle
          : cross(vec3(0.0, 0.0, 1.0), nW);     // a flank: circumferential about the movement axis
        tW = normalize(tW - nW * dot(tW, nW));
        vec3 tV = normalize((viewMatrix * vec4(tW, 0.0)).xyz);
        tV = normalize(tV - normal * dot(tV, normal));
        material.anisotropyT = tV;
        material.anisotropyB = normalize(cross(normal, tV));
      }
      #endif`);
  };
}
for (const m of BRUSH_MATERIALS) installBrush(m);

// Apply `materials.steel` to both steel materials — at creation and LIVE from
// APPLIERS.materials. Roughness and anisotropy are material properties three
// refreshes every frame; only the direction is a custom uniform, and a
// material not yet compiled picks it up at first compile from the schema.
export function applyBrushFromAesthetics() {
  const st = aesthetics.materials?.steel || {};
  const brush = Math.min(1, Math.max(0, st.brush ?? 1));
  const a = ((st.brushAngleDeg ?? 0) * Math.PI) / 180;
  for (const m of BRUSH_MATERIALS) {
    m.roughness = BRUSH_POLISH_FLOOR + (STEEL_FINISH.roughness - BRUSH_POLISH_FLOOR) * brush;
    m.anisotropy = Math.max(BRUSH_EPS, brush);
    const sh = m.userData.shader;
    if (sh?.uniforms?.brushDir) sh.uniforms.brushDir.value.set(Math.cos(a), Math.sin(a));
  }
}
applyBrushFromAesthetics();

// Deep, saturated blued-steel for screws and hands.
const blueSteel = phys({
  color: 0x1b3a86,
  metalness: 1.0,
  roughness: 0.22,
  clearcoat: 0.5,
  clearcoatRoughness: 0.2,
  reflectivity: 0.7,
});

// Translucent ruby for pallet stones, impulse pin, bearing jewels.
// Colour comes from the aesthetics schema (§23): one source, and the advanced
// panel can retint every jewel live through MATS.ruby.color.
const ruby = phys({
  color: (aesthetics.materials && aesthetics.materials.ruby && aesthetics.materials.ruby.color) || 0xb01326,
  metalness: 0.0,
  roughness: 0.08,
  transparent: true,
  opacity: 0.85,
  transmission: 0.55,
  thickness: 1.2,
  ior: 1.76,
  clearcoat: 1.0,
  clearcoatRoughness: 0.05,
});

// §3 — SAPPHIRE, for the box sapphire dial: when `dial.plate.sapphire` is
// set, the dial's MATTER — the plate, its pocket walls and the sheets its
// print is laid on — takes this, while the chapter ring, the applied
// numerals and the feet stay the metal they are. ONE recipe, shared with the
// case crystal (main.js builds `caseCrystalMat` from this literal), because a
// sapphire dial and a sapphire crystal are one material and the scene must
// not carry two opinions of it: opacity 0.14 with depthWrite off is the
// "crystal the scene reads through" trick the x-ray materials use, and the
// tint is the crystal's own. `ior` is corundum's — 1.77 (Al₂O₃, n_o ≈ 1.768
// at 589 nm), the one property here that is sapphire's rather than
// glass-in-general's; it moves only the dielectric F0, and the case crystal
// keeps three's default by not carrying it, so its picture is unmoved.
// `userData.glass` marks a material as glass BY NATURE: the x-ray set reads
// it to compose rather than clone (a 0.28 clone of a 0.14 glass would make
// the dial MORE opaque under x-ray, the toggle's opposite).
export const CRYSTAL_GLASS = Object.freeze({
  color: 0xf8fbff, transparent: true, opacity: 0.14, roughness: 0.04, metalness: 0, depthWrite: false,
});
export const SAPPHIRE_IOR = 1.77;
const sapphire = phys({ ...CRYSTAL_GLASS, ior: SAPPHIRE_IOR });
sapphire.userData.glass = true;

// Yellow GOLD — for the screwed chatons the upper pivot jewels sit in, and
// for the balance's anti-shock lyre. A distinct material rather than a reuse
// of `brass`: the chatons are set into a nickel plate a few units from brass
// wheels, and if gold and brass read the same the detail that makes them
// worth modelling disappears. Richer and redder than brass.
//
// §148 — AND MIRROR POLISHED, which is not a preference about gold: it is
// what a chaton IS. A screwed chaton has been mechanically obsolete since
// pressed jewels arrived (see makeChaton), and it survives purely as a mark
// of traditional finishing — so the FINISH is the part's whole remaining
// job, and a satin ring is the one way to model it that misses the point.
// Real chatons are black-polished: roughness at the floor rather than 0.14,
// a full clearcoat with none of its own haze, and reflectivity at 1 so the
// specular is a mirror image of the studio rather than a bloom. The lyre
// spring shares it and wants the same — a gold anti-shock spring is polished
// wire, not a casting.
const gold = phys({
  color: 0xe8b53c,
  metalness: 1.0,
  roughness: 0.03,
  clearcoat: 1.0,
  clearcoatRoughness: 0.0,
  reflectivity: 1.0,
});

// Blued steel for the HANDS: cleanly POLISHED, deliberately a step
// short of mirror — roughness 0.17 keeps a whisper of softness in the
// reflections so the hands read as finished metal rather than chrome.
// No procedural texture (a satin noise pass and a brushed pass both
// auditioned and were cut).
const bluedHand = phys({
  // Lighter, more chromatic blue than the screw steel, and drinking 1.6x
  // the environment: under the original studio rig (which lights the
  // MOVEMENT well but left the dial side of the room dark) the old deep
  // navy read as black. The fix lives in the material, not the lights.
  color: 0x2450b5,
  // 0.8, not 1.0: the sliver of diffuse response lets the directional
  // lights develop the BLUE at angles where the env gives the mirror
  // nothing — the flash-of-blue a real blued hand shows, present always.
  metalness: 0.8,
  roughness: 0.17,
  clearcoat: 0.6,
  clearcoatRoughness: 0.15,
  reflectivity: 0.8,
  envMapIntensity: 1.6,
});

// Cool nickel/rhodium plate finish.
const nickel = phys({
  color: 0xc9ccd1,
  metalness: 1.0,
  roughness: 0.42,
  clearcoat: 0.2,
  clearcoatRoughness: 0.4,
});

// Silvered/frosted dial base (low metalness so printed track reads).
const silver = phys({
  color: 0xe9e9e2,
  metalness: 0.15,
  roughness: 0.55,
  clearcoat: 0.25,
  clearcoatRoughness: 0.5,
});

// Matte dark parts for background / hidden structure.
const dark = phys({
  color: 0x14171b,
  metalness: 0.5,
  roughness: 0.75,
});

// Glashütte-striped nickel, for the three-quarter plate and the escape
// bridge. The stripes are shaded, not modelled: a world-position sawtooth
// tilts the surface normal across each band (the shallow scallop a real
// striping lap leaves), gated to upward-facing surfaces so walls, legs and
// bevels stay plain. Because the band coordinate comes from WORLD space —
// not UVs — the pattern continues seamlessly across any separate part
// sharing this material, which is the whole point: plate and escape bridge
// read as striped in one setup, the lines running unbroken across the
// escapement window. Parameters live in aesthetics.json (decoration.ribbing).
import { aesthetics } from './aesthetics.js';
const ribbedNickel = phys({
  color: 0xc9ccd1,
  metalness: 1.0,
  roughness: 0.42,
  clearcoat: 0.2,
  clearcoatRoughness: 0.4,
});
{
  const rib = (aesthetics.decoration && aesthetics.decoration.ribbing) || {};
  const a = ((rib.angleDeg ?? 25) * Math.PI) / 180;
  const dir = new THREE.Vector2(Math.cos(a), Math.sin(a));
  const width = rib.widthUnits ?? 4.5;
  const tilt = rib.tilt ?? 0.35;
  ribbedNickel.onBeforeCompile = (shader) => {
    // §23: the compiled shader is kept so the advanced panel can rewrite the
    // uniforms live — before this, the values were captured constants and a
    // decoration knob would have silently done nothing until reload.
    // §142 found, §203/§119's class: the shader handle must not be an ENUMERABLE member of userData —
    // Material.copy deep-copies userData through JSON, and a shader carries its uniforms' textures
    // (the env PMREM, the shadow map), so every clone of this material (power flow's ghosts, focus)
    // serialised them all and warned per texture. Non-enumerable: readers still find it, JSON does not,
    // and a clone gets its own onBeforeCompile and its own handle, which is the correct one.
    Object.defineProperty(ribbedNickel.userData, 'shader', { value: shader, enumerable: false, configurable: true, writable: true });
    shader.uniforms.ribDir = { value: dir };
    shader.uniforms.ribWidth = { value: width };
    shader.uniforms.ribTilt = { value: tilt };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRibWorld;\nvarying vec3 vRibNormal;')
      .replace('#include <begin_vertex>',
        '#include <begin_vertex>\nvRibWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvRibNormal = normalize(mat3(modelMatrix) * objectNormal);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>',
        '#include <common>\nvarying vec3 vRibWorld;\nvarying vec3 vRibNormal;\nuniform vec2 ribDir;\nuniform float ribWidth;\nuniform float ribTilt;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      if (vRibNormal.z > 0.7) {
        float ribBand = fract(dot(vRibWorld.xy, ribDir) / ribWidth) - 0.5;
        vec3 ribTiltView = normalize((viewMatrix * vec4(ribDir, 0.0, 0.0)).xyz);
        normal = normalize(normal + ribTiltView * ribBand * ribTilt);
      }`);
  };
}

// Perled nickel for the BASE plate: circular graining (perlage) — a
// staggered grid of pearls, each shaded as concentric micro-rings by
// tilting the normal radially about the pearl's own centre, fading with
// radius. Same world-space construction as the ribbing (position-stable,
// no UVs), same up-facing gate so only the movement-side face grains.
const perledNickel = phys({
  color: 0xc9ccd1,
  metalness: 1.0,
  roughness: 0.42,
  clearcoat: 0.2,
  clearcoatRoughness: 0.4,
});
{
  const prl = (aesthetics.decoration && aesthetics.decoration.perlage) || {};
  const pitch = prl.pitchUnits ?? 4.2;
  const ringFreq = prl.ringFreq ?? 9.0;
  const tilt = prl.tilt ?? 0.22;
  perledNickel.onBeforeCompile = (shader) => {
    // §142 found, §203/§119's class: the shader handle must not be an ENUMERABLE member of userData —
    // Material.copy deep-copies userData through JSON, and a shader carries its uniforms' textures
    // (the env PMREM, the shadow map), so every clone of this material (power flow's ghosts, focus)
    // serialised them all and warned per texture. Non-enumerable: readers still find it, JSON does not,
    // and a clone gets its own onBeforeCompile and its own handle, which is the correct one.
    Object.defineProperty(perledNickel.userData, 'shader', { value: shader, enumerable: false, configurable: true, writable: true });
    shader.uniforms.prlPitch = { value: pitch };
    shader.uniforms.prlRingFreq = { value: ringFreq };
    shader.uniforms.prlTilt = { value: tilt };
    shader.uniforms.prlRadius = { value: prl.pearlRadiusUnits ?? pitch * 0.8 };
    shader.uniforms.prlOrder = { value: prl.shingleFlip ? -1.0 : 1.0 };
    shader.uniforms.prlJitter = { value: prl.jitterFrac ?? 0.25 };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPrlWorld;\nvarying vec3 vPrlNormal;')
      .replace('#include <begin_vertex>',
        '#include <begin_vertex>\nvPrlWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvPrlNormal = normalize(mat3(modelMatrix) * objectNormal);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>',
        '#include <common>\nvarying vec3 vPrlWorld;\nvarying vec3 vPrlNormal;\nuniform float prlPitch;\nuniform float prlRingFreq;\nuniform float prlTilt;\nuniform float prlRadius;\nuniform float prlOrder;\nuniform float prlJitter;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      if (vPrlNormal.z > 0.7) {
        // Real perlage is stamped pearl by pearl, row by row — each pearl
        // CUTS INTO the ones laid before it. So a fragment covered by
        // several pearls takes its rings from the LAST one in application
        // order (higher row, then higher x): every pearl keeps a clean
        // full-circle edge on the not-yet-overlapped side and is shingled
        // away on the other — the directional overlap of the real finish.
        vec2 pp = vPrlWorld.xy / prlPitch;
        // Jittered stamp centres: real perlage is laid by hand, pearl over
        // pearl — the circles overlap in sequence but their centres are
        // never on a perfect lattice, and each pearl's rings run strong to
        // its own edge. Winner = LAST pearl in application order covering
        // the fragment; with jitter, every visible boundary is the ARC of
        // the later pearl's edge — nothing reads as a straight row.
        float pBest = -1e9; vec2 pC = vec2(0.0);
        for (int pdy = -1; pdy <= 1; pdy++) {
          for (int pdx = -1; pdx <= 1; pdx++) {
            vec2 cellId = floor(pp) + vec2(float(pdx), float(pdy));
            vec2 jit = fract(sin(vec2(dot(cellId, vec2(127.1, 311.7)),
                                      dot(cellId, vec2(269.5, 183.3)))) * 43758.5453) - 0.5;
            vec2 c = cellId + 0.5 + jit * prlJitter;
            if (distance(pp, c) * prlPitch < prlRadius) {
              float score = (cellId.y * 4096.0 + cellId.x) * prlOrder; // application order; prlOrder flips it
              if (score > pBest) { pBest = score; pC = c; }
            }
          }
        }
        if (pBest > -1e8) {
          vec2 pd = (pp - pC) * prlPitch;
          float pr = length(pd) + 1e-4;
          // rings hold full strength across the disc, fading only at the rim
          float pedge = 1.0 - smoothstep(0.82, 1.0, pr / prlRadius);
          float pring = sin(pr * prlRingFreq) * pedge;
          vec3 pradV = normalize((viewMatrix * vec4(pd / pr, 0.0, 0.0)).xyz);
          normal = normalize(normal + pradV * pring * prlTilt);
        }
      }`);
  };
}

// §23 — apply the decoration subtree of the aesthetics schema to the LIVE
// compiled shaders. Angle/width/tilt for the ribbing, pitch/ringFreq/tilt for
// the perlage; anything not yet compiled is a no-op and picks the values up at
// first compile.
export function applyDecorationFromAesthetics() {
  const rib = (aesthetics.decoration && aesthetics.decoration.ribbing) || {};
  const rs = ribbedNickel.userData.shader;
  if (rs) {
    const a = ((rib.angleDeg ?? 25) * Math.PI) / 180;
    rs.uniforms.ribDir.value.set(Math.cos(a), Math.sin(a));
    rs.uniforms.ribWidth.value = rib.widthUnits ?? 4.5;
    rs.uniforms.ribTilt.value = rib.tilt ?? 0.35;
  }
  const prl = (aesthetics.decoration && aesthetics.decoration.perlage) || {};
  const ps = perledNickel.userData.shader;
  if (ps) {
    if (ps.uniforms.prlPitch) ps.uniforms.prlPitch.value = prl.pitchUnits ?? 4.2;
    if (ps.uniforms.prlRingFreq) ps.uniforms.prlRingFreq.value = prl.ringFreq ?? 9.0;
    if (ps.uniforms.prlTilt) ps.uniforms.prlTilt.value = prl.tilt ?? 0.22;
  }
}

export const MATS = {
  brass,
  bluedHand,
  gold,
  steel,
  caseMetal,
  blueSteel,
  ruby,
  nickel,
  ribbedNickel,
  perledNickel,
  sapphire,      // §3 — the box sapphire dial's plate, walls and print sheets
  silver,
  dark,
};

export default MATS;
