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

export const MATS = {
  brass,
  gold,
  steel,
  blueSteel,
  ruby,
  nickel,
  silver,
  dark,
};

export default MATS;
