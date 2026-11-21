// THE PLATES' FACES, READ THE ONE WAY THAT CANNOT TAKE IN WHAT IS MOUNTED ON THEM (§334 landing 3c's correction) —
// a helper, not an instrument.
//
//   import { plateFaces, ownBox } from './plate-faces.mjs';
//   const P = plateFaces(clock, THREE);   // { base: { back, top, thickness }, threeQuarter: { bottom, top, thickness } }
//
// The trap it closes: `new THREE.Box3().setFromObject(plate)` walks the object's CHILDREN, and both plates carry
// metal that is not the slab. The base plate's four pillars reach z 8.40 (its top face is at 0); the three-quarter
// plate's screw shanks hang to 4.45 (its underside is at 8.40). Landings 3b and 3c of §334 read the base plate's top
// at 8.40 that way and drew two wrong conclusions from it; four alarm-placement probes read the three-quarter plate's
// underside 4 u too low.
//
// So the faces come from the BUILD (`clock.plateFaces`, the constants the plates were cut from), and each is held to
// the slab mesh's OWN geometry box (no children): a published face that is not the metal's throws, naming both. The
// slab is the mesh of that name whose geometry carries an extrude's shapes (the plate's cut outline).
export function ownBox(THREE, mesh) {
  mesh.updateWorldMatrix(true, false);
  mesh.geometry.computeBoundingBox();
  return mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
}

const slabOf = (clock, name) => {
  let slab = null;
  clock.scene.traverse((o) => { if (!slab && o.isMesh && o.name === name && o.geometry?.parameters?.shapes) slab = o; });
  if (!slab) throw new Error(`plate-faces: no slab mesh named ${name} with an extrude outline`);
  return slab;
};

export function plateFaces(clock, THREE, tol = 1e-5) {
  const F = clock.plateFaces;
  if (!F?.base || !F?.threeQuarter) throw new Error('plate-faces: the build publishes no clock.plateFaces (main.js)');
  const check = (what, got, want) => {
    if (!(Math.abs(got - want) <= tol)) throw new Error(`plate-faces: ${what} is published at ${want} but the slab's own geometry reads ${got}`);
  };
  const b = ownBox(THREE, slabOf(clock, 'backPlate'));
  check('the base plate\'s back face', b.min.z, F.base.back);
  check('the base plate\'s top face', b.max.z, F.base.top);
  const t = ownBox(THREE, slabOf(clock, 'threeQuarterPlate'));
  check('the three-quarter plate\'s underside', t.min.z, F.threeQuarter.bottom);
  check('the three-quarter plate\'s top face', t.max.z, F.threeQuarter.top);
  return { base: { ...F.base }, threeQuarter: { ...F.threeQuarter } };
}
