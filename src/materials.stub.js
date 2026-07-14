// TEMPORARY STUB — mirrors the API of src/materials.js (owned by Agent A).
// main.js should import the real ./materials.js once it exists; this stub
// exists only so Agent B can develop/test before that file lands.
import * as THREE from 'three';

function phys(params) {
  return new THREE.MeshPhysicalMaterial(params);
}

export const MATS = {
  brass: phys({ color: 0xcda434, metalness: 1, roughness: 0.35, clearcoat: 0.3 }),
  steel: phys({ color: 0xaeb4bb, metalness: 1, roughness: 0.25 }),
  blueSteel: phys({ color: 0x2255aa, metalness: 1, roughness: 0.2 }),
  ruby: phys({ color: 0xaa1122, metalness: 0, roughness: 0.1, transmission: 0.6, thickness: 1 }),
  nickel: phys({ color: 0xc7c9cc, metalness: 1, roughness: 0.4 }),
  silver: phys({ color: 0xe8e8e0, metalness: 0.2, roughness: 0.5 }),
  dark: phys({ color: 0x15171a, metalness: 0.6, roughness: 0.7 }),
};
