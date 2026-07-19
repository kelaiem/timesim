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

// Bright, near-white polished steel for pinions, arbors, fork, springs.
const steel = phys({
  color: 0xd6d9dd,
  metalness: 1.0,
  roughness: 0.30,
  clearcoat: 0.15,
  clearcoatRoughness: 0.3,
});

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
const ruby = phys({
  color: 0xb01326,
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

// Yellow GOLD — for the screwed chatons the upper pivot jewels sit in. A
// distinct material rather than a reuse of `brass`: the chatons are set into
// a nickel plate a few units from brass wheels, and if gold and brass read
// the same the detail that makes them worth modelling disappears. Richer,
// redder and smoother than brass, with no clearcoat haze.
const gold = phys({
  color: 0xe8b53c,
  metalness: 1.0,
  roughness: 0.14,
  clearcoat: 0.5,
  clearcoatRoughness: 0.08,
  reflectivity: 0.85,
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

export const MATS = {
  brass,
  gold,
  steel,
  blueSteel,
  ruby,
  nickel,
  ribbedNickel,
  silver,
  dark,
};

export default MATS;
