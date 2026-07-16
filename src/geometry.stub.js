// TEMPORARY STUB — mirrors the API of src/geometry.js (owned by Agent A).
// Crude primitives standing in for real tooth-profile geometry so main.js
// can be built/tested against the correct shapes/userData contract before
// the real geometry.js lands. Swap the import back once it exists.
import * as THREE from 'three';

function pitchRadius(module, teeth) {
  return (module * teeth) / 2;
}

// Involute-ish spur gear (stub: plain cylinder + rim ring for visual read).
export function makeGear({ module, teeth, thickness, boreR = 1, spokes = 5,
                            material, hub = true }) {
  const r = pitchRadius(module, teeth);
  const g = new THREE.Group();
  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, thickness, Math.max(teeth, 24), 1),
    material
  );
  rim.rotation.x = Math.PI / 2;
  g.add(rim);
  // crude teeth bumps
  const toothGeo = new THREE.BoxGeometry(module * 0.9, module * 1.4, thickness);
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    const t = new THREE.Mesh(toothGeo, material);
    t.position.set(Math.cos(a) * r, Math.sin(a) * r, 0);
    t.rotation.z = a;
    g.add(t);
  }
  if (hub) {
    const hubMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(Math.max(boreR * 2.5, r * 0.15), Math.max(boreR * 2.5, r * 0.15), thickness * 1.2, 16),
      material
    );
    hubMesh.rotation.x = Math.PI / 2;
    g.add(hubMesh);
  }
  // spoke cutouts are purely visual in the real version; skip in stub.
  void spokes;
  const bore = new THREE.Mesh(
    new THREE.CylinderGeometry(boreR, boreR, thickness * 1.3, 12),
    material
  );
  bore.rotation.x = Math.PI / 2;
  g.add(bore);
  g.userData.r = r;
  return g;
}

// Small solid steel pinion.
export function makePinion({ module, teeth, thickness, material }) {
  const r = pitchRadius(module, teeth);
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, thickness, Math.max(teeth * 2, 12)),
    material
  );
  body.rotation.x = Math.PI / 2;
  g.add(body);
  g.userData.r = r;
  return g;
}

// 15-tooth club-tooth escape wheel (stub: cylinder with tick marks).
export function makeEscapeWheel({ teeth = 15, radius, thickness }) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xcda434, metalness: 1, roughness: 0.35 });
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, thickness, teeth), mat);
  rim.rotation.x = Math.PI / 2;
  g.add(rim);
  const toothGeo = new THREE.BoxGeometry(radius * 0.18, radius * 0.35, thickness);
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    const t = new THREE.Mesh(toothGeo, mat);
    t.position.set(Math.cos(a) * radius, Math.sin(a) * radius, 0);
    t.rotation.z = a;
    g.add(t);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.12, radius * 0.12, thickness * 1.4, 12), mat);
  hub.rotation.x = Math.PI / 2;
  g.add(hub);
  g.userData.r = radius;
  return g;
}

// Pallet fork pivoted at origin, lever pointing along -Y (stub: boxes).
export function makePalletFork({ span, leverLength, thickness }) {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0xaeb4bb, metalness: 1, roughness: 0.25 });
  const ruby = new THREE.MeshStandardMaterial({ color: 0xaa1122, metalness: 0, roughness: 0.15 });

  const lever = new THREE.Mesh(new THREE.BoxGeometry(thickness * 1.5, leverLength, thickness), steel);
  lever.position.set(0, -leverLength / 2, 0);
  g.add(lever);

  const crossArm = new THREE.Mesh(new THREE.BoxGeometry(span, thickness * 1.5, thickness), steel);
  crossArm.position.set(0, -leverLength * 0.15, 0);
  g.add(crossArm);

  const entryPos = new THREE.Vector3(-span / 2, -leverLength * 0.15, 0);
  const exitPos = new THREE.Vector3(span / 2, -leverLength * 0.15, 0);

  const entryStone = new THREE.Mesh(new THREE.BoxGeometry(thickness, thickness * 2, thickness), ruby);
  entryStone.position.copy(entryPos);
  g.add(entryStone);

  const exitStone = new THREE.Mesh(new THREE.BoxGeometry(thickness, thickness * 2, thickness), ruby);
  exitStone.position.copy(exitPos);
  g.add(exitStone);

  const pivot = new THREE.Mesh(new THREE.CylinderGeometry(thickness, thickness, thickness * 1.5, 12), steel);
  pivot.rotation.x = Math.PI / 2;
  g.add(pivot);

  g.userData.entryPos = entryPos;
  g.userData.exitPos = exitPos;
  return g;
}

// Balance wheel: rim + roller table with impulse pin (stub: torus + disc).
export function makeBalanceWheel({ radius, thickness }) {
  const g = new THREE.Group();
  const bimetal = new THREE.MeshStandardMaterial({ color: 0xd8c48a, metalness: 0.8, roughness: 0.35 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xaeb4bb, metalness: 1, roughness: 0.25 });
  const ruby = new THREE.MeshStandardMaterial({ color: 0xaa1122, metalness: 0, roughness: 0.15 });

  const rim = new THREE.Mesh(new THREE.TorusGeometry(radius, thickness * 0.6, 8, 32), bimetal);
  g.add(rim);

  for (let i = 0; i < 2; i++) {
    const a = i * Math.PI;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(radius * 2, thickness * 0.8, thickness * 0.8), steel);
    arm.rotation.z = a;
    g.add(arm);
  }

  const staff = new THREE.Mesh(new THREE.CylinderGeometry(thickness * 0.3, thickness * 0.3, thickness * 3, 10), steel);
  staff.rotation.x = Math.PI / 2;
  g.add(staff);

  const rollerR = radius * 0.35;
  const roller = new THREE.Mesh(new THREE.CylinderGeometry(rollerR, rollerR, thickness * 0.4, 24), steel);
  roller.rotation.x = Math.PI / 2;
  roller.position.z = -thickness * 0.5;
  g.add(roller);

  const pin = new THREE.Mesh(new THREE.CylinderGeometry(thickness * 0.25, thickness * 0.25, thickness * 0.8, 8), ruby);
  pin.rotation.x = Math.PI / 2;
  pin.position.set(rollerR, 0, -thickness * 0.5);
  g.add(pin);

  g.userData.r = radius;
  g.userData.rollerR = rollerR;
  return g;
}

// Archimedean-spiral hairspring (stub: series of concentric rings).
export function makeHairspring({ innerR, outerR, coils = 12, height }) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x3a6bd8, metalness: 0.7, roughness: 0.3 });
  const pts = [];
  const turns = coils;
  const segsPerTurn = 32;
  const total = turns * segsPerTurn;
  for (let i = 0; i <= total; i++) {
    const t = i / total;
    const r = innerR + (outerR - innerR) * t;
    const a = t * turns * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, total, Math.max(height * 0.15, 0.05), 4, false),
    mat
  );
  g.add(tube);
  const collet = new THREE.Mesh(new THREE.CylinderGeometry(innerR, innerR, height, 12), mat);
  collet.rotation.x = Math.PI / 2;
  g.add(collet);
  g.userData.r = outerR;
  return g;
}

// Going barrel: drum + toothed rim, spring child, ratchet on top.
export function makeBarrel({ radius, height, teeth, module }) {
  const g = new THREE.Group();
  const brass = new THREE.MeshStandardMaterial({ color: 0xcda434, metalness: 1, roughness: 0.35 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xaeb4bb, metalness: 1, roughness: 0.25 });

  const drum = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 48), brass);
  drum.rotation.x = Math.PI / 2;
  g.add(drum);

  const toothGeo = new THREE.BoxGeometry(module * 0.9, module * 1.3, height);
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    const t = new THREE.Mesh(toothGeo, brass);
    t.position.set(Math.cos(a) * radius, Math.sin(a) * radius, 0);
    t.rotation.z = a;
    g.add(t);
  }

  // spiral mainspring child, offset slightly toward viewer so it reads inside the cutaway
  const spring = new THREE.Group();
  spring.name = 'spring';
  const springPts = [];
  const sTurns = 5;
  const segs = sTurns * 24;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const r = radius * 0.15 + (radius * 0.7) * t;
    const a = t * sTurns * Math.PI * 2;
    springPts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0));
  }
  const springCurve = new THREE.CatmullRomCurve3(springPts);
  const springMesh = new THREE.Mesh(
    new THREE.TubeGeometry(springCurve, segs, height * 0.12, 4, false),
    steel
  );
  spring.add(springMesh);
  spring.position.z = 0;
  g.add(spring);

  const ratchet = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.3, radius * 0.3, height * 0.3, 20), steel);
  ratchet.rotation.x = Math.PI / 2;
  ratchet.position.z = height * 0.6;
  g.add(ratchet);

  const arbor = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.06, radius * 0.06, height * 2.2, 10), steel);
  arbor.rotation.x = Math.PI / 2;
  g.add(arbor);

  g.userData.r = radius;
  return g;
}

// Plates & structure (stub: simple shaped disc / boxes).
export function makeBackPlate({ radius, thickness }) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xc7c9cc, metalness: 1, roughness: 0.45 });
  const shape = new THREE.Shape();
  shape.absarc(0, 0, radius, 0, Math.PI * 2, false);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 48 });
  geo.translate(0, 0, -thickness / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.r = radius;
  return mesh;
}

export function makeCock({ length, width }) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xc7c9cc, metalness: 1, roughness: 0.45 });
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(width, length, width * 0.6), mat);
  g.add(body);
  return g;
}

export function makeJewelSetting({ r }) {
  const g = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 1, roughness: 0.3 });
  const ruby = new THREE.MeshStandardMaterial({ color: 0xaa1122, metalness: 0, roughness: 0.15 });
  const chaton = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.6, r * 1.6, r * 0.6, 16), gold);
  chaton.rotation.x = Math.PI / 2;
  g.add(chaton);
  const jewel = new THREE.Mesh(new THREE.TorusGeometry(r * 0.8, r * 0.3, 8, 16), ruby);
  g.add(jewel);
  return g;
}

export function makePillar({ height }) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xcda434, metalness: 1, roughness: 0.35 });
  const g = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, height, 12), mat);
  g.rotation.x = Math.PI / 2;
  return g;
}

// Dial side. (Real makeDial also takes subdials: [{x, y, r, kind}] — the
// stub ignores them, matching the API without drawing sub-dial faces.)
export function makeDial({ radius, subdials = [] }) {
  const g = new THREE.Group();
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f2efe6';
  ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = '#222';
  ctx.fillStyle = '#222';
  ctx.translate(256, 256);
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const long = i % 5 === 0;
    ctx.save();
    ctx.rotate(a);
    ctx.lineWidth = long ? 4 : 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -230);
    ctx.lineTo(0, long ? -205 : -215);
    ctx.stroke();
    ctx.restore();
  }
  ctx.font = 'bold 32px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let h = 1; h <= 12; h++) {
    const a = (h / 12) * Math.PI * 2;
    const x = Math.sin(a) * 175;
    const y = -Math.cos(a) * 175;
    ctx.fillText(String(h), x, y);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.MeshStandardMaterial({ map: tex, color: 0xffffff, roughness: 0.6, metalness: 0.05 });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(radius, 64), mat);
  g.add(disc);
  g.userData.r = radius;
  return g;
}

export function makeHand({ length, kind }) {
  const mat = new THREE.MeshStandardMaterial({ color: 0x1c3a6b, metalness: 1, roughness: 0.25 });
  const width = kind === 'hour' ? 2.4 : kind === 'minute' ? 1.6 : 0.6;
  const tailLength = length * 0.18;
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, -tailLength);
  shape.lineTo(width / 2, -tailLength);
  shape.lineTo(width / 2, length * 0.7);
  shape.lineTo(0, length);
  shape.lineTo(-width / 2, length * 0.7);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.5, bevelEnabled: false });
  geo.translate(0, 0, -0.25);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.length = length;
  return mesh;
}
