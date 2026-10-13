// WHERE CAN THE STRIKE STAND SO ITS METAL LEAVES THE BACK GLASS'S OUTBOARD
// RING? — §278 landing 1's site search for the strike fold. The alarm hammer
// and its lifting lever stand on the lever plane at r 34.6–47.8, and the part of
// them outboard of the back glass's aperture sets the pane floor (11.741 on the
// tree §278 was filed from), 1.124 u over the skirt arm that would otherwise
// govern the band's back face. This searches the stations the strike can be
// carried to WITH ITS MECHANISM HELD FIXED — every row of the 'alarm strike'
// line spec (LINE_SPECS in src/inspect.js) — and asks of each whether its metal
// meets §278 Layout A's condition, what depth that would buy, what it would
// stand nearest, whether the cam still reaches it, and what it does to §269's
// structure-borne path.
//
// REPORT with fatal controls (exit 2 when a control fails; exit 0 with the
// table otherwise). It moves no metal: every candidate is GHOSTS of the shipped
// meshes, placed by the build's own corner laws (`clock.lineLaws.strike`, the
// functions the metal was cut by) and measured with `meshClearance` against
// everything else over the pose net.
//
// THE CONDITION, from the height ledger's own terms (tools/height-ledger.mjs,
// the arithmetic probe-261-height-ledger holds): fold the back envelope with
// the hammer and the lever taken out (`foldEnvelope`), and run the case chain
// on it (`backChain`) — its band face `midBack` is what the back would stand at
// with no strike metal outboard. Metal outboard of the aperture must then stand
// one margin and the glass's float guard under that face:
//   zLimit = midBack − CLEAR_MARGIN − floatGuard,
// and metal above zLimit must lie under the raised glass step, whose wall
// (rStep = the outer edge of the outermost bin too tall for the pane, plus one
// margin, main.js's own rule) must stay one margin inside the aperture RA:
//   rAllow = the largest envelope-bin edge ≤ RA − 2·CLEAR_MARGIN.
// Neither number is typed here; both print, with the terms they came from.
//
// THE CANDIDATES. The striking wheel is the group's input and stays put.
//   · AZIMUTH (Δ): the lever's pivot carried round the wheel's axis — its
//     distance from the wheel and its nose's rest bearing kept, so the cam's
//     radii are the same circle (the cam turns with it) — and the hammer
//     re-solved onto its circle |P| = rP by the build's own law, on either
//     root. The hammer's body (post, collet, arm, head, spiral, stud) and the
//     gong turn rigidly about the movement's axis to the new pivot, which keeps
//     the blow radial at the same radii; its tail turns about the pivot to lie
//     anti-parallel to the new far arm (a turn about the rotor's own axis, so I
//     is unchanged). Every plan row holds by construction, and is MEASURED on
//     the ghosts anyway.
//   · LEVER PLANE (crank): the lever plane is the cam's (the nose rides it at
//     Z_STRIKE), so the plane itself cannot drop; what can is the hammer's metal
//     outboard — the post's top, the collet's, the arm's root and the tail's
//     root — lowered by exactly what the condition asks, the tail stepping back
//     up to the lever plane on a riser inboard of rAllow and short of where the
//     lever's tip rides it. Plan rows hold; the rotor's inertia moves (a riser
//     of metal, a shorter arm), measured on the ghost rotor and reported as the
//     I, W and fall rows a fork would have to carry.
//   · RADIUS: the hammer's pivot is PINNED to rP by the radial blow at a fixed
//     gong (the 'blow' row); stations inside it are reported analytically —
//     the blow's cosine if the gong stays, or the gong and head it would take
//     if the blow is kept.
//
// PER CANDIDATE: whether the lever reaches the station (the solve's |c| ≤ 1);
// the measured spec rows' worst departure; the strike metal's top outboard of
// rAllow over the strike's own poses, against zLimit; the depth the ledger
// prices with the candidate's metal folded back in at BUILD pose (the
// envelope's own convention — and swept, beside it); the nearest other metal
// over the pose net (strike phases plus every axis at f ∈ {0, ½, 1}); the cam's
// pickup and tip radii under the ghost nose; and §269's rigid-watch drive
// re-computed with the foot and its force turned with the gong.
//
// CONTROLS (exit 2): (1) the identity candidate's build-pose envelope bins
// reproduce the build's own per-unit bins for the hammer and the lever, bin for
// bin; (2) it re-folds to the shipped depth; (3) it fails the condition by the
// measured skirt-arm slack (the pane floor less the skirt arm, 1.124 u on the
// tree §278 was filed from); (4) the excluded fold reproduces the ledger's
// skirt-arm term; (5) §269's torque and rigid response are reproduced at Δ = 0
// before any rotation is priced; (6) the clearance instrument reads a known
// contact (the lever's tip on the hammer's tail, designed to touch) as ≤ 0.
//
// What it is NOT: probe-261-lever-prices.mjs prices compaction levers that are
// one constant each; this re-sites a group with its line spec held.
// probe-261-fold-site.mjs searched the switch's fold under the dial.
//
// Run: cd tools && node probe-strike-site.mjs   (ROOT= for another tree)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { ROOT, MEASURE, ledger, backChain, backMost, foldEnvelope, envMaxOver } from './height-ledger.mjs';

const STRIKE_UNITS = ['Alarm hammer', 'Alarm lifting lever'];
const PORT = 8631;
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
process.on('exit', () => { try { srv.kill(); } catch {} });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch();
const page = await browser.newPage();
const warns = [];
page.on('console', (m) => { if (m.type() === 'warning' && !/WebGL|GPU stall|GroupMarker/.test(m.text())) warns.push(m.text()); });
page.on('pageerror', (e) => warns.push('PAGEERROR ' + String(e)));
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction(() => !!window.__clock || !!window.__bootError, null, { timeout: 300000 });
const bootError = await page.evaluate(() => (window.__bootError ? String(window.__bootError) : null));
if (bootError) throw new Error('boot failed: ' + bootError);
const m = await page.evaluate(`(${MEASURE.toString()})()`);
const bootWarns = warns.splice(0);   // what the BUILD said; anything after is the search's own posing

// ---------------------------------------------------------------------------
// The ledger's terms (Node: the one law, imported).
const CM = m.L.CLEAR_MARGIN, U = m.L.UNIT_MM, G = m.glass.floatGuard ?? 0;
const mm = (u) => (u * U).toFixed(3);
const L0 = ledger(m);
const binsX = foldEnvelope(m.env, STRIKE_UNITS);
const chainX = backChain(m, binsX, L0.eng, L0.ringRise, L0.keyRise);
const zLimit = chainX.midBack - CM - G;
const nBins = m.env.bins.length, binW = m.env.bins[nBins - 1].r1 / nBins;
const RA = m.glass.apertureR;
const sAllow = Math.floor((RA - 2 * CM) / binW + 1e-12);   // bins s < sAllow have r1 ≤ RA − 2·CM
const rAllow = sAllow * binW;
const depthOf = (cand) => {
  const bins = binsX.map((b, s) => ({ ...b, z: cand[s] !== null && (b.z === null || cand[s] > b.z) ? cand[s] : b.z,
    owner: cand[s] !== null && (b.z === null || cand[s] > b.z) ? 'strike (candidate)' : b.owner }));
  const ch = backChain(m, bins, L0.eng, L0.ringRise, L0.keyRise);
  const bm = backMost(m, ch, m);
  let rStep = 0;
  for (const b of bins) if (b.z !== null && b.z + CM > ch.midBack) rStep = Math.max(rStep, b.r1);
  rStep += CM;
  return { depth: bm.top.z - L0.frontCase, midBack: ch.midBack, midBy: ch.midBy, rStep, gov: bm.top.by,
    outboard: envMaxOver(bins, RA - 2 * CM, Infinity) };
};
const dX = depthOf(new Array(nBins).fill(null));
console.log(`base: cased ${L0.depth.toFixed(4)} u = ${mm(L0.depth)} mm; band face ${L0.back.midBack.toFixed(4)} (${L0.back.midBy}); boot warnings ${warns.length}`);
console.log(`the strike folded out (foldEnvelope without ${STRIKE_UNITS.join(' + ')}): band face ${chainX.midBack.toFixed(4)} — ${chainX.midBy}; `
  + `skirt arm ${chainX.skirtArm.toFixed(4)}, pane floor ${chainX.paneFloor.toFixed(4)}; cased ${mm(dX.depth)} mm (the A1 bound, ${mm(L0.depth - dX.depth)} mm)`);
console.log(`CONDITION: metal above zLimit = band face ${chainX.midBack.toFixed(4)} − CLEAR_MARGIN ${CM} − float guard ${G} = ${zLimit.toFixed(4)} `
  + `must lie inside rAllow = ${rAllow.toFixed(4)} (bin edge ${sAllow} of ${nBins} × ${binW.toFixed(5)}; RA ${RA.toFixed(4)} − 2·CLEAR_MARGIN = ${(RA - 2 * CM).toFixed(4)})`);

// ---------------------------------------------------------------------------
// The page half: ghosts, measured. One function, serialised; its state lives on
// window.__S between calls so a long search is many short evaluations.
const SETUP = async ({ nBins, binW }) => {
  const THREE = await import('three');
  const I = await import('./src/inspect.js');
  const clock = window.__clock;
  const L = clock.lineLaws.strike;
  const site = L.site;
  clock.resetInputs(); clock.scene.updateMatrixWorld(true);
  const unitByObj = new Map(clock.labelEntries.map((e) => [e.obj, e.name]));
  const caseRoot = clock.scene.getObjectByName('case');
  const ownerOf = (o) => { for (let n = o; n; n = n.parent) { if (n === caseRoot) return `case: ${o.name || '(unnamed)'}`; const u = unitByObj.get(n); if (u) return u; } return `(unlabelled) ${o.name || ''}`; };
  const all = [];
  clock.scene.traverse((o) => { if (o.isMesh && !o.userData.schematic && o.geometry?.attributes?.position) all.push(o); });
  const isSchematicTree = (o) => { for (let n = o; n; n = n.parent) if (n.userData?.schematic) return true; return false; };
  const meshes = all.filter((o) => !isSchematicTree(o));
  const byName = (n) => meshes.find((o) => o.name === n);
  const unitMeshes = (u) => meshes.filter((o) => ownerOf(o) === u);
  const ham = unitMeshes('Alarm hammer'), lev = unitMeshes('Alarm lifting lever'), gong = unitMeshes('Alarm gong');
  const cam = byName('alarmCam'), tail = byName('alarmTail'), tip = byName('alarmLiftTip'), nose = byName('alarmLiftNose');
  const hPost = byName('alarmHammerPost'), collet = byName('alarmHammerCollet'), arm = byName('alarmHammerArm'), lPost = byName('alarmLiftPost');
  const head = byName('alarmHammerHead');
  const own = new Set([...ham, ...lev, ...gong, cam]);
  // the cam is one body with its rotor (sleeve, staff, collar): carried round
  // its own axis it stays seated on them, so that unit is not its obstacle
  const camUnit = new Set(meshes.filter((o) => ownerOf(o) === ownerOf(cam)));
  // the ground is not an obstacle: the base plate the hammer's post, its stud
  // and the gong's block are planted in, and the three-quarter plate the
  // lever's post is planted in, are asked about separately (the plate under
  // the lever's post is a SEAT question, answered by a ray)
  const tq = clock.labelEntries.find((e) => e.name === 'Three-quarter plate');
  const tqMeshes = []; if (tq) tq.obj.traverse((o) => { if (o.isMesh && !isSchematicTree(o)) tqMeshes.push(o); });
  const obstacles = meshes.filter((o) => !own.has(o) && o.name !== 'backPlate');
  const hamGroup = tail.parent, levGroup = tip.parent;
  const W = (() => { const sh = cam.geometry.parameters.shapes; const s0 = Array.isArray(sh) ? sh[0] : sh; const p = s0.getPoints(); const q = p.slice(0, -1); cam.updateWorldMatrix(true, false); const c = new THREE.Vector3(); for (const v of q) c.add(new THREE.Vector3(v.x, v.y, 0).applyMatrix4(cam.matrixWorld)); c.multiplyScalar(1 / q.length); return { x: c.x, y: c.y }; })();
  window.__S = { THREE, I, clock, L, site, meshes, ham, lev, gong, cam, tail, tip, nose, hPost, collet, arm, lPost, head, obstacles, tqMeshes,
    hamGroup, levGroup, W, ownerOf, nBins, binW, camUnit };
  return { obstacles: obstacles.length, ham: ham.map((o) => o.name), lev: lev.map((o) => o.name), gong: gong.map((o) => o.name), W, P: site.P, Q: site.Q, rP: site.rP,
    psi: site.psi, restAz: site.restAz, gongA1: site.gongA1 };
};
await page.evaluate(SETUP, { nBins, binW });

// One candidate's geometry: everything the ghosts need, solved by the build's
// own laws in the page. Returns null when the lever cannot reach the circle.
const PLACE = `(() => {
  const S = window.__S, { THREE, L, site } = S;
  const Rz = (c, a) => new THREE.Matrix4().makeTranslation(c.x, c.y, 0).multiply(new THREE.Matrix4().makeRotationZ(a)).multiply(new THREE.Matrix4().makeTranslation(-c.x, -c.y, 0));
  S.place = (cand) => {
    const { dDeg, root } = cand, d = dDeg * Math.PI / 180;
    const rot = (p, c, a) => ({ x: c.x + (p.x - c.x) * Math.cos(a) - (p.y - c.y) * Math.sin(a), y: c.y + (p.x - c.x) * Math.sin(a) + (p.y - c.y) * Math.cos(a) });
    const Q2 = rot(site.Q, S.W, d);
    const g = L.geom;
    const h = L.hammerPivot(Q2, site.rP, g.aOut, g.l, g.s, g.side, root);
    if (!(Math.abs(h.c) <= 1)) return null;
    const alpha = Math.atan2(h.y, h.x) - Math.atan2(site.P.y, site.P.x);
    const P2 = { x: h.x, y: h.y };
    const beta = h.psi - site.psi - alpha, gamma = h.psi - (site.psi + d);
    const M = {
      ham: Rz({ x: 0, y: 0 }, alpha), gong: Rz({ x: 0, y: 0 }, alpha),
      tail: Rz(P2, beta).multiply(Rz({ x: 0, y: 0 }, alpha)),
      lev: Rz(S.W, d), cam: Rz(S.W, d),
      tip: Rz(Q2, gamma).multiply(Rz(S.W, d)),
    };
    return { ...cand, d, alpha, beta, gamma, Q2, P2, psi2: h.psi, c: h.c, M };
  };
  return true;
})()`;
await page.evaluate(PLACE);

// The ghosts at the CURRENT pose: one THREE.Mesh per strike mesh (or per crank
// piece), its world matrix the candidate's map times the source's own — so the
// build's pose of each member rides into the ghost (a rotation about a moved
// centre conjugates to a rotation about the new one).
const GHOSTS = `(() => {
  const S = window.__S, { THREE } = S;
  // matrix AND matrixWorld carry the placement, so a Box3.setFromObject that
  // refreshes a parentless object's world from its local matrix reads the same
  const mk = (geo, mat, world) => { const g = new THREE.Mesh(geo, mat); g.matrixAutoUpdate = false; g.matrixWorldAutoUpdate = false; g.matrix.copy(world); g.matrixWorld.copy(world); return g; };
  // crank pieces, baked into their source's own local frame once per Δz
  S.crankGeo = (dz, ac) => {
    const T = S.site.tailT, Wd = S.site.tailW, len = S.site.tailBarLen;
    const box = (x0, x1, z0, z1) => { const gg = new THREE.BoxGeometry(x1 - x0, Wd, z1 - z0); gg.translate((x0 + x1) / 2, 0, (z0 + z1) / 2); return gg; };
    const tailPieces = [box(0, ac - T / 2, -T / 2 - dz, T / 2 - dz), box(ac - T / 2, ac + T / 2, -T / 2 - dz, T / 2), box(ac + T / 2, len, -T / 2, T / 2)];
    // the post and the collet: their tops lowered by dz, their feet kept
    const shrink = (mesh, axis) => {
      const gg = mesh.geometry.clone(); gg.computeBoundingBox();
      const lo = gg.boundingBox.min[axis], hi = gg.boundingBox.max[axis];
      const pos = gg.attributes.position;
      for (let i = 0; i < pos.count; i++) { const v = pos['get' + axis.toUpperCase()](i); pos['set' + axis.toUpperCase()](i, lo + (v - lo) * (hi - lo - dz) / (hi - lo)); }
      pos.needsUpdate = true; gg.computeBoundingBox(); gg.computeBoundingSphere(); return gg;
    };
    // the post stands along its local y (rotation.x = π/2 turns y onto world z);
    // the collet is a ring in the pivot group, its axis local z — read which
    // local axis maps onto world +z rather than trusting either
    const upAxis = (mesh) => { mesh.updateWorldMatrix(true, false); const e = mesh.matrixWorld.elements; const zc = [e[2], e[6], e[10]]; const k = zc.map(Math.abs).indexOf(Math.max(...zc.map(Math.abs))); return { axis: ['x', 'y', 'z'][k], sign: Math.sign(zc[k]) }; };
    const up = (mesh) => { const u = upAxis(mesh); if (u.sign < 0) throw new Error(mesh.name + ' stands upside down in its frame'); return u.axis; };
    // the arm, re-cut from its root lowered dz to the same eye, in the pivot's frame
    const a = new THREE.Vector3(0, 0, -T - dz);
    const armC = new THREE.Vector3().setFromMatrixPosition(S.arm.matrix);
    const armU = new THREE.Vector3(0, 1, 0).applyQuaternion(S.arm.quaternion);
    const half = S.arm.geometry.parameters.height / 2;
    const e1 = armC.clone().addScaledVector(armU, half), e2 = armC.clone().addScaledVector(armU, -half);
    const eye = e1.z < e2.z ? e1 : e2;
    const r = S.arm.geometry.parameters.radiusTop;
    const armG = new THREE.CylinderGeometry(r, r, a.distanceTo(eye), 10);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), eye.clone().sub(a).normalize());
    armG.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(eye).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)));
    return { tailPieces, post: shrink(S.hPost, up(S.hPost)), collet: shrink(S.collet, up(S.collet)), arm: armG };
  };
  S.ghosts = (P, crank) => {
    const out = [];
    const W = (mesh, Mx) => new THREE.Matrix4().multiplyMatrices(Mx, mesh.matrixWorld);
    for (const o of S.ham) {
      if (o === S.tail) {
        if (crank) for (const [i, gg] of crank.tailPieces.entries()) out.push({ g: mk(gg, o.material, W(o, P.M.tail)), name: 'alarmTail' + ['(lowered)', '(riser)', '(upper)'][i], src: o, rotor: true });
        else out.push({ g: mk(o.geometry, o.material, W(o, P.M.tail)), name: o.name, src: o, rotor: true });
        continue;
      }
      const rotor = (() => { for (let n = o; n; n = n.parent) if (n === S.hamGroup) return true; return false; })();
      let geo = o.geometry, Mw = W(o, P.M.ham);
      if (crank && o === S.hPost) geo = crank.post;
      if (crank && o === S.collet) geo = crank.collet;
      if (crank && o === S.arm) { geo = crank.arm; Mw = new THREE.Matrix4().multiplyMatrices(P.M.ham, S.hamGroup.matrixWorld); }
      out.push({ g: mk(geo, o.material, Mw), name: o.name + (crank && (o === S.hPost || o === S.collet || o === S.arm) ? '(cranked)' : ''), src: o, rotor });
    }
    for (const o of S.lev) out.push({ g: mk(o.geometry, o.material, W(o, o === S.tip ? P.M.tip : P.M.lev)), name: o.name, src: o });
    for (const o of S.gong) out.push({ g: mk(o.geometry, o.material, W(o, P.M.gong)), name: o.name, src: o, gong: true });
    out.push({ g: mk(S.cam.geometry, S.cam.material, W(S.cam, P.M.cam)), name: 'alarmCam', src: S.cam, cam: true });
    return out;
  };
  return true;
})()`;
await page.evaluate(GHOSTS);

// The measurement passes.
const MEASURE_CAND = `(() => {
  const S = window.__S, { THREE, I, clock, L, site } = S;
  const strikeAxis = I.AXES.find((a) => a.name === 'alarmStrike');
  const poseStrike = (phase) => { I.enterAxis(clock); clock.setPose({ ...strikeAxis.pose(0, clock), alarmStrikePhase: phase, alarmBarrelWind: 0 }); clock.scene.updateMatrixWorld(true); };
  S.poseStrike = poseStrike;
  // the strike's own poses: rest, the rise in quarters, the draw, mid-fall,
  // the wire, and the rebound's first return — the members' whole motion
  const g0 = L.gapAt(0), rise = 1 - L.freeFrac;
  S.strikePhases = [1 + L.phaseRest, 1 + L.phaseRest + rise * 0.25, 1 + L.phaseRest + rise * 0.5, 1 + L.phaseRest + rise * 0.75,
    2, 2 + (L.fallS / 2) / g0, 2 + L.fallS / g0, 2 + (L.fallS + Math.PI / L.W) / g0];
  // back-envelope bins, the build's own walk (BACK_ENVELOPE): every vertex and
  // every crossing of an edge with a bin wall, at ±1e-4 of the crossing
  S.binsOf = (ghosts, filter) => {
    const N = S.nBins, rSpan = N * S.binW, bins = new Array(N).fill(-Infinity);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), q = new THREE.Vector3();
    const take = (pt) => { const r = Math.hypot(pt.x, pt.y); if (r >= rSpan) return; const s = Math.floor(r / rSpan * N); if (pt.z > bins[s]) bins[s] = pt.z; };
    for (const gh of ghosts) {
      if (filter && !filter(gh)) continue;
      const o = gh.g, p = o.geometry.attributes.position, idx = o.geometry.index, n = idx ? idx.count : p.count;
      for (let t = 0; t < n; t += 3) for (let e = 0; e < 3; e++) {
        const i0 = idx ? idx.getX(t + e) : t + e, i1 = idx ? idx.getX(t + (e + 1) % 3) : t + (e + 1) % 3;
        a.fromBufferAttribute(p, i0).applyMatrix4(o.matrixWorld); b.fromBufferAttribute(p, i1).applyMatrix4(o.matrixWorld);
        take(a);
        const dx = b.x - a.x, dy = b.y - a.y, A2 = dx * dx + dy * dy;
        if (A2 > 1e-12) {
          const B2 = a.x * dx + a.y * dy, ra = Math.hypot(a.x, a.y), rb = Math.hypot(b.x, b.y);
          let rLo = Math.min(ra, rb); const tS = -B2 / A2;
          if (tS > 0 && tS < 1) rLo = Math.min(rLo, Math.hypot(a.x + tS * dx, a.y + tS * dy));
          const rHi = Math.max(ra, rb);
          const wLo = Math.max(1, Math.ceil(rLo / rSpan * N)), wHi = Math.min(N - 1, Math.floor(rHi / rSpan * N));
          for (let w = wLo; w <= wHi; w++) {
            const rw = w / N * rSpan, C2 = a.x * a.x + a.y * a.y - rw * rw, disc = B2 * B2 - A2 * C2;
            if (disc <= 0) continue;
            const sq = Math.sqrt(disc);
            for (const t0 of [(-B2 - sq) / A2, (-B2 + sq) / A2]) for (const dt of [-1e-4, 1e-4]) { const tt = t0 + dt; if (tt > 0 && tt < 1) take(q.copy(a).lerp(b, tt)); }
          }
        }
      }
    }
    return bins.map((z) => (z === -Infinity ? null : z));
  };
  // the rotor's inertia about its pivot axis, signed tetrahedra (the line
  // spec's own reader's tally), over the ghost rotor
  S.rotorI = (ghosts, P2) => {
    let Izz = 0; const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), pv = new THREE.Vector3(P2.x, P2.y, 0);
    for (const gh of ghosts) {
      if (!gh.rotor) continue;
      const o = gh.g, pos = o.geometry.attributes.position, idx = o.geometry.index, cnt = idx ? idx.count : pos.count;
      for (let t = 0; t + 2 < cnt; t += 3) {
        const P3 = [a, b, c];
        for (let k = 0; k < 3; k++) P3[k].fromBufferAttribute(pos, idx ? idx.getX(t + k) : t + k).applyMatrix4(o.matrixWorld).sub(pv);
        const v6 = a.x * (b.y * c.z - b.z * c.y) - a.y * (b.x * c.z - b.z * c.x) + a.z * (b.x * c.y - b.y * c.x);
        let sxy = 0; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) sxy += (i === j ? 2 : 1) * (P3[i].x * P3[j].x + P3[i].y * P3[j].y);
        Izz += (v6 / 6) * sxy / 20;
      }
    }
    return Izz * L.metresPerU ** 5 * L.steelRho;
  };
  return true;
})()`;
await page.evaluate(MEASURE_CAND);

// Control 6: the clearance instrument, both ways, on pairs whose answer is
// known — the lever's post planted half a unit into the three-quarter plate
// (must hit), and the gong's wire against the cam (must miss by units). Not the
// tip on the tail: that contact is a designed TANGENCY, which a polygon reads
// either side of zero (the instruments skill's trap).
const control6 = await page.evaluate(() => {
  const S = window.__S;
  S.I.enterAxis(S.clock); S.clock.scene.updateMatrixWorld(true);
  const hit = Math.min(...S.tqMeshes.map((o) => S.I.meshClearance(S.lPost, o)));
  const wire = S.gong.find((o) => o.name === 'alarmGongArc');
  return { hit, miss: S.I.meshClearance(wire, S.cam) };
});

// The search grid.
const cands = [];
for (let dDeg = -180; dDeg < 180; dDeg += 5) for (const root of [1, -1]) cands.push({ dDeg, root });
// identity first (Δ 0, the build's root): its index is the controls' anchor
cands.sort((a, b) => (a.dDeg === 0 && a.root === 1 ? -1 : b.dDeg === 0 && b.root === 1 ? 1 : 0));

const SWEEP = async (list, crankMode) => page.evaluate(async ({ list, crankMode, CM, zLimit, sAllow, rAllow }) => {
  const S = window.__S, { THREE, I, clock, L, site } = S;
  const out = [];
  // the obstacles' boxes per pose are shared by every candidate; the pose list
  // is the strike's own phases plus every axis at f ∈ {0, ½, 1}
  const poses = [...S.strikePhases.map((ph) => ({ kind: 'strike', ph })),
    ...I.AXES.filter((a) => a.name !== 'alarmStrike').flatMap((a) => [0, 0.5, 1].map((f) => ({ kind: 'axis', a, f })))];
  const setPose = (p) => { if (p.kind === 'strike') S.poseStrike(p.ph); else { I.enterAxis(clock); clock.setPose(p.a.pose(p.f, clock)); clock.scene.updateMatrixWorld(true); } };
  const placed = list.map((c) => S.place(c));
  // pass 1, the strike poses: swept bins, the build-pose bins, the rows
  for (const [k, P] of placed.entries()) {
    if (!P) { out.push({ ...list[k], reach: false }); continue; }
      out.push({ ...list[k], reach: true, c: P.c, alpha: P.alpha, P2: P.P2, Q2: P.Q2 });
  }
  const box = new THREE.Box3(), box2 = new THREE.Box3();
  const best = out.map(() => ({ d: Infinity, a: null, b: null, pose: null })), bestG = out.map(() => ({ d: Infinity, a: null, b: null, pose: null }));
  const swept = out.map(() => null), build = out.map(() => null);
  for (const [pi, p] of poses.entries()) {
    setPose(p);
    const obs = S.obstacles.map((o) => { box.setFromObject(o); return { o, b: box.clone() }; });
    for (const [k, P] of placed.entries()) {
      if (!P) continue;
      const gh = S.ghosts(P, P.crankGeo || null);
      if (p.kind === 'strike') {
        const bins = S.binsOf(gh, (x) => !x.gong && !x.cam);
        swept[k] = swept[k] ? swept[k].map((z, s) => (bins[s] === null ? z : z === null ? bins[s] : Math.max(z, bins[s]))) : bins;
        if (pi === 0) build[k] = bins;   // rest: the strike's own rest IS the build pose (the lift law's 0)
      }
      for (const g of gh) {
        box2.setFromObject(g.g);
        for (const ob of obs) {
          // the lever's post stands IN the three-quarter plate (planted); the
          // plate under it is the seat question, not a clearance
          if (g.src === S.lPost && S.tqMeshes.includes(ob.o)) continue;
          if (g.cam && S.camUnit.has(ob.o)) continue;
          const bb = g.gong ? bestG : best;
          const B = ob.b, dBox = Math.hypot(Math.max(0, B.min.x - box2.max.x, box2.min.x - B.max.x),
            Math.max(0, B.min.y - box2.max.y, box2.min.y - B.max.y), Math.max(0, B.min.z - box2.max.z, box2.min.z - B.max.z));
          if (dBox >= Math.min(bb[k].d, CM + 0.6)) continue;
          const dd = I.meshClearance(g.g, ob.o, Math.min(bb[k].d, CM + 0.6));
          if (dd < bb[k].d) bb[k] = { d: dd, a: g.name, b: S.ownerOf(ob.o) + ' / ' + (ob.o.name || '(unnamed)'), pose: p.kind === 'strike' ? 'alarmStrike phase ' + p.ph.toFixed(4) : p.a.name + ' f ' + p.f };
        }
      }
      // rows, measured on the ghosts at the strike's rest
      if (pi === 0) {
        const W = S.W;
        const ctr = (g) => { g.geometry.computeBoundingBox(); const c = g.geometry.boundingBox.getCenter(new THREE.Vector3()).applyMatrix4(g.matrixWorld); return c; };
        const find = (n) => gh.find((x) => x.name === n);
        const hp = ctr(find('alarmHammerPost' + (P.crankGeo ? '(cranked)' : '')).g), lp = ctr(find('alarmLiftPost').g);
        const tipG = find('alarmLiftTip').g, noseG = find('alarmLiftNose').g;
        const ring = (g) => { const sh = g.geometry.parameters.shapes; const s0 = Array.isArray(sh) ? sh[0] : sh; const pp = s0.getPoints(); return pp.slice(0, -1); };
        const tr = ring(tipG), nr = ring(noseG);
        const apex = tr.reduce((b, q) => (q.x > b.x ? q : b), tr[0]), B = tr[1], C = tr[tr.length - 2];
        const ax = apex.x, ay = apex.y, bx = B.x, by = B.y, cx = C.x, cy = C.y, dd = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
        const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / dd;
        const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / dd;
        const T = new THREE.Vector3(ux, uy, 0).applyMatrix4(tipG.matrixWorld);
        const nl = nr.reduce((b, q) => (q.x > b.x ? q : b), nr[0]);
        const N = new THREE.Vector3(nl.x, nl.y, 0).applyMatrix4(noseG.matrixWorld);
        const tailG = (find('alarmTail') || find('alarmTail(upper)')).g;
        const te = tailG.matrixWorld.elements, eL = Math.hypot(te[0], te[1]);
        const e = { x: te[0] / eL, y: te[1] / eL }, n = { x: -e.y, y: e.x };
        const TP = { x: T.x - hp.x, y: T.y - hp.y };
        const plan = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
        const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a <= -Math.PI) a += 2 * Math.PI; return a; };
        out[k].rows = {
          tailLen: TP.x * e.x + TP.y * e.y, standOff: Math.abs(TP.x * n.x + TP.y * n.y),
          leverIn: plan(N, lp), leverOut: plan(T, lp), pivSwD: plan(lp, W),
          restGamma: Math.abs(wrap(Math.atan2(N.y - lp.y, N.x - lp.x) - Math.atan2(W.y - lp.y, W.x - lp.x))),
          camPickupR: plan(N, W), hammerR: Math.hypot(hp.x, hp.y),
        };
        out[k].rotorI = S.rotorI(gh, { x: hp.x, y: hp.y });
      }
    }
  }
  S.I.enterAxis(clock);
  // the condition: the strike's swept metal outboard of rAllow, over zLimit
  for (const [k, o] of out.entries()) {
    if (!o.reach) continue;
    let zOut = -Infinity, zIn = -Infinity;
    swept[k].forEach((z, s) => { if (z === null) return; if (s >= sAllow) zOut = Math.max(zOut, z); else zIn = Math.max(zIn, z); });
    let zOutB = -Infinity; build[k].forEach((z, s) => { if (z !== null && s >= sAllow) zOutB = Math.max(zOutB, z); });
    o.zOutSwept = zOut; o.zOutBuild = zOutB; o.zInSwept = zIn; o.exceed = zOut - zLimit;
    o.sweptBins = swept[k]; o.buildBins = build[k];
    o.nearest = best[k]; o.nearestGong = bestG[k];
  }
  return out;
}, { list, crankMode, CM, zLimit, sAllow, rAllow });

// --- as built (no crank) -----------------------------------------------------
const t0 = Date.now();
const rowsA = await SWEEP(cands, false);
const tA = (Date.now() - t0) / 1000;

// --- the identity's controls -------------------------------------------------
const ctl = [];
const id = rowsA[0];
if (!(id.dDeg === 0 && id.root === 1 && id.reach)) ctl.push('the identity candidate is not first, or does not reach');
const shipped = m.env.unitBins;
const shippedStrike = shipped['Alarm hammer'].map((z, s) => { const w = shipped['Alarm lifting lever'][s]; return z === null ? w : w === null ? z : Math.max(z, w); });
const binDiff = id.buildBins.reduce((mx, z, s) => Math.max(mx, (z === null) !== (shippedStrike[s] === null) ? Infinity : z === null ? 0 : Math.abs(z - shippedStrike[s])), 0);
if (binDiff > 1e-9) ctl.push(`control 1: the identity's build-pose bins differ from the build's per-unit bins by ${binDiff}`);
const dId = depthOf(id.buildBins);
if (Math.abs(dId.depth - L0.depth) > 1e-9) ctl.push(`control 2: the identity re-folds to ${dId.depth}, the shipped depth is ${L0.depth}`);
const slack = L0.back.paneFloor - chainX.skirtArm;
const idExceedBuild = id.zOutBuild - zLimit;
if (Math.abs(idExceedBuild - slack) > 1e-9) ctl.push(`control 3: the identity exceeds zLimit by ${idExceedBuild} at build pose, the measured skirt-arm slack is ${slack}`);
if (Math.abs(chainX.skirtArm - L0.back.skirtArm) > 1e-12) ctl.push(`control 4: the excluded fold's skirt arm ${chainX.skirtArm} is not the ledger's ${L0.back.skirtArm}`);
if (!(control6.hit <= 0 && control6.miss > 1)) ctl.push(`control 6: meshClearance reads the planted lever post ${control6.hit} (must be ≤ 0) and the wire to the cam ${control6.miss} (must be > 1)`);
console.log(`\ncontrols: identity bins vs the build's own (max |Δ| ${binDiff}); identity depth ${dId.depth.toFixed(6)} vs ledger ${L0.depth.toFixed(6)}; `
  + `identity outboard top ${id.zOutBuild.toFixed(4)} (build pose; swept ${id.zOutSwept.toFixed(4)}) − zLimit ${zLimit.toFixed(4)} = ${idExceedBuild.toFixed(4)} `
  + `against the skirt-arm slack ${slack.toFixed(4)} (pane floor ${L0.back.paneFloor.toFixed(4)} − skirt arm ${chainX.skirtArm.toFixed(4)}); `
  + `clearance instrument: planted post ${control6.hit.toFixed(4)}, wire⇄cam ${control6.miss.toFixed(3)}`);

// --- the crank: specified off the identity's own metal, then swept ----------
// Δz: what the outboard metal must drop (swept, the strike's own poses). The
// riser's station: the first along-tail station whose four corners stand inside
// rAllow at every hammer angle the strike reaches, its inner face one margin
// short of the tip's circle at the inner end of its tangent span.
const site = await page.evaluate(() => ({ ...window.__S.site, draw: window.__S.L.draw, amp: window.__S.L.amp, liftSign: window.__S.L.geom.liftSign }));
const dz = Math.max(0, id.exceed) + 1e-9;
const crankStation = (P) => {
  const T = site.tailT, Wd = site.tailW;
  const thetas = []; for (let i = 0; i <= 48; i++) thetas.push(site.liftSign * (-site.amp + (site.draw + site.amp) * i / 48));
  const dir0 = P.psi2 + Math.PI;   // the tail's rest direction (anti-parallel to the far arm)
  const ok = (ac) => { for (const th of thetas) { const dd = dir0 + th, ex = Math.cos(dd), ey = Math.sin(dd); for (const [al, w] of [[ac - T / 2, Wd / 2], [ac - T / 2, -Wd / 2]]) { const x = P.P2.x + al * ex - w * ey, y = P.P2.y + al * ey + w * ex; if (Math.hypot(x, y) >= rAllow) return false; } } return true; };
  let ac = null; for (let a = T / 2; a < site.tailBarLen; a += 0.005) if (ok(a)) { ac = a; break; }
  const limit = site.contactSpan.lo - site.tipR - CM - T / 2;
  return { ac, limit, fits: ac !== null && ac <= limit };
};
const placedId = await page.evaluate((c) => { const P = window.__S.place(c); return P && { P2: P.P2, psi2: P.psi2 }; }, { dDeg: 0, root: 1 });
const stId = crankStation(placedId);
console.log(`crank (from the identity): drop Δz ${dz.toFixed(6)} u (${mm(dz)} mm); riser at ${stId.ac === null ? 'NO station' : stId.ac.toFixed(3)} along the tail `
  + `(must be ≤ ${stId.limit.toFixed(3)}, the tip's span starting ${site.contactSpan.lo.toFixed(3)}): ${stId.fits ? 'fits' : 'DOES NOT FIT'}`);
// set each reachable candidate's crank pieces, then sweep again
const crankList = [];
for (const c of cands) {
  const P = await page.evaluate((cc) => { const p = window.__S.place(cc); return p && { P2: p.P2, psi2: p.psi2 }; }, c);
  if (!P) continue;
  const st = crankStation(P);
  crankList.push({ ...c, ac: st.ac, acLimit: st.limit, fits: st.fits });
}
await page.evaluate(({ list, dz }) => {
  const S = window.__S, place0 = S.place;
  S.crankFor = new Map(list.map((c) => [`${c.dDeg}/${c.root}`, c]));
  S.place = (cand) => { const P = place0(cand); if (!P) return P; const c = S.crankFor.get(`${cand.dDeg}/${cand.root}`); if (cand.crank && c && c.fits) P.crankGeo = S.crankGeo(dz, c.ac); return P; };
}, { list: crankList, dz });
const t1 = Date.now();
const rowsC = await SWEEP(crankList.filter((c) => c.fits).map((c) => ({ dDeg: c.dDeg, root: c.root, crank: true })), true);
const tC = (Date.now() - t1) / 1000;

// --- §269: the rigid watch's drive with the foot turned by α -------------------
const cp = await page.evaluate(() => { const c = window.__clock.casePath; return { watch: c.watch, foot: c.foot, modes: c.modes.filter((x) => x.audible).map((x) => ({ n: x.n, f: x.f_Hz, foot: x.foot, rigid: x.rigid, field: x.field })) }; });
const Um = U / 1000;
const inv3 = (I) => {   // the inverse of the symmetric inertia tensor, by cofactors
  const a = I.xx, b = I.xy, c = I.xz, d = I.yy, e = I.yz, f = I.zz;
  const det = a * (d * f - e * e) - b * (b * f - e * c) + c * (b * e - d * c);
  return [[(d * f - e * e) / det, (c * e - b * f) / det, (b * e - c * d) / det],
    [(c * e - b * f) / det, (a * f - c * c) / det, (b * c - a * e) / det],
    [(b * e - c * d) / det, (b * c - a * e) / det, (a * d - b * b) / det]];
};
const Iinv = inv3(cp.watch.I_kgm2);
const drive = (mode, alpha) => {
  const az = cp.foot.az0Deg * Math.PI / 180 + alpha;
  const p = [cp.foot.R_u * Math.cos(az) * Um, cp.foot.R_u * Math.sin(az) * Um, cp.foot.ringZ_u * Um];
  const com = cp.watch.com_u.map((x) => x * Um);
  const F0 = [mode.field.Fx, mode.field.Fy, 0], ca = Math.cos(alpha), sa = Math.sin(alpha);
  const F = [F0[0] * ca - F0[1] * sa, F0[0] * sa + F0[1] * ca, 0];
  const r = [p[0] - com[0], p[1] - com[1], p[2] - com[2]];
  const tau = [r[1] * F[2] - r[2] * F[1], r[2] * F[0] - r[0] * F[2], r[0] * F[1] - r[1] * F[0] + mode.foot.Mroot_Nm];
  const om = 2 * Math.PI * mode.f;   // §269: the rigid response is a velocity amplitude, I⁻¹τ/ω
  const Om = Iinv.map((row) => (row[0] * tau[0] + row[1] * tau[1] + row[2] * tau[2]) / om);
  return { tau, Om, OmMag: Math.hypot(...Om) };
};
// control 5: Δ = 0 reproduces the record's torque and rigid response
for (const md of cp.modes) {
  const d0 = drive(md, 0);
  const tErr = Math.max(...d0.tau.map((t, i) => Math.abs(t - md.field.tau[i]))) / Math.max(...md.field.tau.map(Math.abs));
  const oErr = Math.abs(d0.OmMag - md.rigid.Omega_rad_s) / md.rigid.Omega_rad_s;
  if (!(tErr < 1e-6 && oErr < 1e-6)) ctl.push(`control 5: §269 mode ${md.n} not reproduced at α 0 (torque ${tErr.toExponential(2)}, Ω ${oErr.toExponential(2)} relative)`);
}

// --- the table ----------------------------------------------------------------
const fmt = (x, n = 3) => (x === null || x === undefined || !Number.isFinite(x) ? '—' : x.toFixed(n));
const ref = rowsA[0].rows;
const rowDev = (r) => r ? Math.max(...['tailLen', 'standOff', 'leverIn', 'leverOut', 'pivSwD', 'restGamma', 'camPickupR'].map((k) => Math.abs(r[k] - ref[k]))) : NaN;
const report = (title, rows) => {
  console.log(`\n${title}`);
  console.log('  Δ°    root  reach  hammer az°  r(P)     rows Δmax   top out   exceed   meets  depth(build)  bought mm  depth(swept)  nearest, strike metal (clearance ⇄ what, pose)               nearest, gong                          ΔI %     §269 |Ω|₁ ×  |Ω|₂ ×');
  for (const o of rows) {
    if (!o.reach) continue;
    const db = depthOf(o.buildBins), ds = depthOf(o.sweptBins);
    const meets = o.exceed <= 1e-9;
    const az = Math.atan2(o.P2.y, o.P2.x) * 180 / Math.PI;
    const om = cp.modes.map((md) => drive(md, o.alpha).OmMag / md.rigid.Omega_rad_s);
    const dI = (o.rotorI / rowsA[0].rotorI - 1) * 100;
    o.summary = { meets, depthBuild: db.depth, boughtMm: (L0.depth - db.depth) * U, depthSwept: ds.depth, az, om, dI, rStep: db.rStep };
    console.log(`  ${String(o.dDeg).padStart(4)}  ${String(o.root).padStart(3)}   yes   ${fmt(az, 2).padStart(8)}  ${fmt(o.rows.hammerR, 3)}  ${rowDev(o.rows).toExponential(1).padStart(8)}  `
      + `${fmt(o.zOutSwept, 3).padStart(7)}  ${fmt(o.exceed, 3).padStart(7)}   ${meets ? 'YES' : 'no '}   ${mm(db.depth).padStart(8)} mm  ${((L0.depth - db.depth) * U).toFixed(3).padStart(7)}    ${mm(ds.depth).padStart(8)} mm   `
      + `${(`${fmt(o.nearest.d, 3)} ${o.nearest.a} ⇄ ${o.nearest.b} @ ${o.nearest.pose}`).slice(0, 62).padEnd(62)}  `
      + `${(`${fmt(o.nearestGong.d, 3)} ${o.nearestGong.a} ⇄ ${o.nearestGong.b}`).slice(0, 38).padEnd(38)}  ${fmt(dI, 3).padStart(7)}  ${fmt(om[0], 3).padStart(6)}  ${fmt(om[1], 3).padStart(6)}`);
  }
};
const unreach = rowsA.filter((o) => !o.reach);
report(`AS BUILT — the lever plane and the hammer's post at their shipped heights (${tA.toFixed(0)} s)`, rowsA);
console.log(`  (the lever reaches no hammer circle at ${unreach.length} of ${rowsA.length} (Δ, root): Δ ${[...new Set(unreach.map((o) => o.dDeg))].join(', ')}°)`);
report(`CRANKED — the hammer's outboard metal lowered ${fmt(dz, 4)} u, the tail stepping back up to the lever plane inboard of rAllow (${tC.toFixed(0)} s)`, rowsC);
const noFit = crankList.filter((c) => !c.fits);
if (noFit.length) console.log(`  (no riser station fits for ${noFit.length} reachable candidates: ${noFit.map((c) => `${c.dDeg}/${c.root}`).join(', ')})`);

// --- the radius axis, analytically --------------------------------------------
console.log('\nRADIUS — the hammer pivot inside rP is not a station the mechanism allows at a fixed gong:');
const eyeR = site.headFaceR - site.blow * site.headR, rP = site.rP, arm = site.armLen;
for (const dr of [0, 0.5, 1, 1.5, 2, 2.5, 3]) {
  const r2 = rP - dr;
  const px = (r2 * r2 + eyeR * eyeR - arm * arm) / (2 * eyeR);
  const py = Math.sqrt(Math.max(0, r2 * r2 - px * px));
  const fx = site.headFaceR - px, fy = -py;
  const blowCos = Math.abs(fx) / Math.hypot(fx, fy);
  const faceR2 = Math.sqrt(r2 * r2 - arm * arm + site.headR * site.headR);   // the face on the tangent from a pivot at r2
  const gap = site.blow * ((site.gongR - site.blow * site.wireR) - site.headFaceR);
  const gongR2 = faceR2 + site.blow * (gap + site.wireR);
  const headL2 = site.blow * (faceR2 - site.annulus[0]);
  console.log(`  r(P) ${r2.toFixed(3)} (−${dr.toFixed(1)}): gong held → 'blow' reads cos ${blowCos.toFixed(4)} (the row is 0);  blow kept → the gong ring to r ${gongR2.toFixed(3)} `
    + `(from ${site.gongR.toFixed(3)}) and the head's length ${headL2.toFixed(3)} (from ${(site.blow * (site.headFaceR - site.annulus[0])).toFixed(3)}), the pitch, the match and the rotor re-solved`);
}
const needR = rAllow - site.colletR;
console.log(`  the hammer's outboard metal is its collet (r ${site.colletR.toFixed(3)} about the pivot), so the pivot would have to stand at r ≤ ${needR.toFixed(3)} — `
  + `${(rP - needR).toFixed(3)} inside rP ${rP.toFixed(3)}`);

// --- the best ---------------------------------------------------------------
const good = rowsC.filter((o) => o.reach && o.summary?.meets).sort((a, b) => (Math.min(b.nearest.d, b.nearestGong.d) - Math.min(a.nearest.d, a.nearestGong.d)) || (b.nearest.d - a.nearest.d));
console.log(`\nBEST: ${good.length} cranked station(s) meet the condition`);
for (const o of good.slice(0, 8)) console.log(`  Δ ${o.dDeg}° root ${o.root}: hammer at az ${o.summary.az.toFixed(2)}°, buys ${o.summary.boughtMm.toFixed(3)} mm (cased ${mm(o.summary.depthBuild)} mm, swept ${mm(o.summary.depthSwept)}), `
  + `nearest ${o.nearest.d.toFixed(3)} (${o.nearest.a} ⇄ ${o.nearest.b}), gong ${o.nearestGong.d.toFixed(3)} (${o.nearestGong.a} ⇄ ${o.nearestGong.b}), rotor I ${o.summary.dI >= 0 ? '+' : ''}${o.summary.dI.toFixed(3)} %, §269 |Ω| ×${o.summary.om.map((x) => x.toFixed(3)).join('/×')}`);
const clear = good.filter((o) => o.nearest.d >= CM - 1e-9), clearBoth = clear.filter((o) => o.nearestGong.d >= CM - 1e-9);
console.log(`  of which ${clear.length} hold CLEAR_MARGIN between the strike's metal and everything else over the pose net, and ${clearBoth.length} hold it for the carried gong too`);
const asBuiltMeets = rowsA.filter((o) => o.reach && o.summary?.meets);
console.log(`AS BUILT: ${asBuiltMeets.length} of ${rowsA.filter((o) => o.reach).length} reachable stations meet the condition (the pivot is pinned to rP ${rP.toFixed(3)} by the radial blow).`);

console.log(bootWarns.length ? `\nboot warnings: ${bootWarns.length}\n  ${bootWarns.slice(0, 5).join('\n  ')}` : '\nboot silent');
if (warns.length) console.log(`warnings raised by the search's own posing (not the build): ${warns.length}, e.g. ${warns[0].slice(0, 160)}`);
console.log(ctl.length ? `\nCONTROL FAIL\n  ${ctl.join('\n  ')}` : '\ncontrols PASS');
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 5000))]);
process.exit(ctl.length ? 2 : 0);
