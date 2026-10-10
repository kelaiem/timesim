// §269 — THE CASE AS THE RADIATOR: does the structure-borne path on the record
// follow from the metal, and does every integral behind it reproduce by a
// second method? ACCEPTANCE.
//
// TODO 126: §197 radiated the wire alone and called every level a floor,
// because a real alarm watch is loud the way a piano is — the string drives a
// soundboard. §269 carries the path with the receiver RIGID: the foot's
// reaction from the arch's mode shapes, the whole watch's mass and inertia
// from its meshes at their stocks' densities, the 6-DOF mass-controlled
// response, and the Rayleigh/Kirchhoff integral over the case's exterior as a
// surface of revolution. This probe boots the build and holds `__clock.casePath`
// against independent arithmetic:
//   1. THE FOOT — the mass vector P⃗ and the root couple's participation Q
//      re-integrated by the trapezoid rule on the solver's shapes (the build
//      uses Simpson), plus two exact identities fed through the SAME shape
//      path: a rigid translation returns the wire's mass along its axis and
//      nothing across it, and a rigid rotation about the ring's centre returns
//      ρAR·(n̂(α) − n̂(0)) — the tangential arithmetic alone;
//   2. THE WATCH — mass, centre and inertia re-tallied here with the vertices
//      SHIFTED to a different origin (a closed mesh's tetrahedra do not care;
//      an open one's do, which is what the build's closedness test exists
//      for), and the tetrahedron formulas themselves held on a synthetic box
//      whose inertia is textbook;
//   3. THE RESPONSE — V⃗ = F⃗/(ωM) and Ω⃗ = I⁻¹τ⃗/ω recomputed from the
//      record's own F⃗, τ⃗, M and I;
//   4. THE RADIATION — the exterior integral redone as a BRUTE-FORCE surface
//      quadrature in (s, φ) over the record's own profile and field, no
//      Bessel series and no harmonic reduction, over a (ϑ, ϕ) grid; and that
//      brute force itself held on the baffled piston's identity and the
//      translating sphere (so the Kirchhoff ratio the record reports is the
//      ratio, not an artefact of the build's quadrature);
//   5. THE RECEIVER's three first-mode estimates and the pane's mass law
//      recomputed from layout.js's STOCK, and the clamped-disc constant λ₀₁²
//      re-solved from J₀I₁ + I₀J₁ = 0;
//   6. THE LEVELS — A-weighting, the power sums, the mix's inputs
//      (`acoustics.modes[].caseW_W`), and the alloy path: a second boot with
//      the case in platinum (the §240 ?aes= link) must weigh exactly the steel
//      case's exterior share times the density ratio more, and the case-path
//      power of each audible mode must fall by (M_steel/M_pt)² — the whole
//      point of modelling density;
//   7. the exterior profile's planes and radii against the case meshes' own
//      extents, and boot silence.
//
//   cd tools && node probe-269-case-path.mjs      (exit 1 on any failure)
//   node probe-269-case-path.mjs --census          (also print the closedness census)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const port = process.env.PORT || '8582';
const root = process.env.ROOT || '..';
const CENSUS = process.argv.includes('--census');
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();

const rows = [];
const say = (name, ok, got, want) => { rows.push({ name, ok: !!ok, got, want }); };
const rel = (a, b) => Math.abs(a / b - 1);

async function boot(query = '') {
  const page = await browser.newPage();
  const warns = [];
  page.on('console', (m) => { if ((m.type() === 'warning' || m.type() === 'error') && !/WebGL|GPU stall|404/.test(m.text())) warns.push(m.text()); });
  page.on('pageerror', (e) => warns.push('PAGEERROR ' + String(e)));
  await page.goto(`http://127.0.0.1:${port}/index.html${query}`, { waitUntil: 'load', timeout: 240000 });
  await page.waitForFunction(() => !!window.__clock || !!window.__bootError, null, { timeout: 240000 });
  return { page, warns };
}

// ---------------------------------------------------------------- boot 1: steel
const { page, warns } = await boot();
const R = await page.evaluate(async () => {
  const C = window.__clock, P = C.casePath, A = C.acoustics;
  // hold the pose: the two tallies below must see the same movement, and a live frame between them moves the hands
  { const b = document.getElementById('btn-pause'); if (b && !b.classList.contains('active')) b.click(); }
  const THREE = await import('./vendor/three.module.js');
  const L = await import('./src/layout.js');
  const arch = C.gongArch.modes(A.wire.S, A.wire.arcRad, 1.1 * C.gongArch.straightRoots[4] / A.wire.arcRad, 8);
  // --- 2: the independent tally, shifted origin, with stockKeyOf from materials.js
  const Mt = await import('./src/materials.js');
  const movement = (() => { let o = C.scene.getObjectByName('alarmGongArc'); while (o.parent && o.parent !== C.scene) o = o.parent; return o; })();
  const SH = new THREE.Vector3(10, 20, 30);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), nrm = new THREE.Vector3(), cen = new THREE.Vector3();
  let M = 0, mx = 0, my = 0, mz = 0; const S = [0, 0, 0, 0, 0, 0]; const census = []; let caseExt = 0;
  movement.updateWorldMatrix(true, true);
  const tally = (o, acc) => {
    const pos = o.geometry.attributes.position, idx = o.geometry.index, n = idx ? idx.count : pos.count;
    let V = 0, vx = 0, vy = 0, vz = 0, A2 = 0, Rb = 0; const s = [0, 0, 0, 0, 0, 0], Q = [0, 0, 0, 0, 0, 0, 0, 0, 0]; nrm.set(0, 0, 0);
    for (let t = 0; t + 2 < n; t += 3) {
      for (let e = 0; e < 3; e++) { const i = idx ? idx.getX(t + e) : t + e; const v = (e === 0 ? a : e === 1 ? b : c); o.localToWorld(v.fromBufferAttribute(pos, i)); v.add(SH); }
      e1.subVectors(b, a); e2.subVectors(c, a); e1.cross(e2); A2 += e1.length(); nrm.add(e1);
      cen.copy(a).add(b).add(c).multiplyScalar(1 / 3); const q = [cen.x, cen.y, cen.z], nn = [e1.x, e1.y, e1.z];
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) Q[i * 3 + j] += q[i] * nn[j];
      Rb = Math.max(Rb, a.lengthSq(), b.lengthSq(), c.lengthSq());
      const v = (a.x * (b.y * c.z - b.z * c.y) - a.y * (b.x * c.z - b.z * c.x) + a.z * (b.x * c.y - b.y * c.x)) / 6;
      V += v; vx += v * (a.x + b.x + c.x) / 4; vy += v * (a.y + b.y + c.y) / 4; vz += v * (a.z + b.z + c.z) / 4;
      const sx = a.x + b.x + c.x, sy = a.y + b.y + c.y, sz = a.z + b.z + c.z, w = v / 20;
      s[0] += w * (sx * sx + a.x * a.x + b.x * b.x + c.x * c.x); s[1] += w * (sy * sy + a.y * a.y + b.y * b.y + c.y * c.y);
      s[2] += w * (sz * sz + a.z * a.z + b.z * b.z + c.z * c.z); s[3] += w * (sx * sy + a.x * a.y + b.x * b.y + c.x * c.y);
      s[4] += w * (sx * sz + a.x * a.z + b.x * b.z + c.x * c.z); s[5] += w * (sy * sz + a.y * a.z + b.y * b.z + c.y * c.z);
    }
    let dq = 0; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) dq = Math.max(dq, Math.abs(Q[i * 3 + j] / 2 - (i === j ? V : 0)));
    // both closedness identities (Σn⃗ = 0 and ∮x_i n_j = Vδ_ij), the second computed about the SHIFTED origin — for a closed body it holds there too
    return { V, vx, vy, vz, s, defect: A2 > 0 ? Math.max(nrm.length() / A2, dq / (A2 / 2 * Math.sqrt(Rb))) : 1 };
  };
  let skippedMass = 0;
  movement.traverse((o) => {
    if (!o.isMesh || o.userData.schematic || !o.geometry?.attributes?.position) return;
    const key = Mt.stockKeyOf(o.material); if (!key) return;
    const r = tally(o); census.push({ name: o.name || '?', defect: r.defect });
    if (P.watch.skippedByName.includes(o.name)) { skippedMass += Math.abs(r.V) * L.STOCK[key].rho; return; }   // the chain: built after the block, measured here
    if (r.defect > P.watch.openDefectMax) return;
    const rho = L.STOCK[key].rho, sg = r.V < 0 ? -rho : rho;
    M += sg * r.V; mx += sg * r.vx; my += sg * r.vy; mz += sg * r.vz; for (let i = 0; i < 6; i++) S[i] += sg * r.s[i];
    if (o.material === Mt.MATS.caseMetal) caseExt += sg * r.V;
  });
  const cx = mx / M - SH.x, cy = my / M - SH.y, cz = mz / M - SH.z;
  const Sc = [S[0] - M * (mx / M) ** 2, S[1] - M * (my / M) ** 2, S[2] - M * (mz / M) ** 2, S[3] - M * (mx / M) * (my / M), S[4] - M * (mx / M) * (mz / M), S[5] - M * (my / M) * (mz / M)];
  const tr = Sc[0] + Sc[1] + Sc[2];
  const U = L.UNIT_MM / 1000, U5 = U ** 5;
  const I = { xx: (tr - Sc[0]) * U5, yy: (tr - Sc[1]) * U5, zz: (tr - Sc[2]) * U5, xy: -Sc[3] * U5, xz: -Sc[4] * U5, yz: -Sc[5] * U5 };
  // the tetra formulas on a textbook box: 2 × 3 × 5, rotated and displaced
  const box = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 5), new THREE.MeshBasicMaterial());
  box.rotation.set(0.3, -0.7, 1.1); box.position.set(4, -2, 7); box.updateMatrixWorld(true);
  const bx = tally(box);
  const boxSc = [bx.s[0] - bx.V * (bx.vx / bx.V) ** 2, bx.s[1] - bx.V * (bx.vy / bx.V) ** 2, bx.s[2] - bx.V * (bx.vz / bx.V) ** 2];
  const boxTr = boxSc[0] + boxSc[1] + boxSc[2];
  // the principal inertias of a 2×3×5 unit-density box: V/12·(b²+c²) etc.; the trace is invariant under rotation
  const boxI = { V: bx.V, trace: boxTr, traceWant: 30 / 12 * ((4 + 9) + (4 + 25) + (9 + 25)) / 2 /* tr(I) = 2·Σ second moments = V/12·Σ(a²+b²+c²)·... */ };
  // (tr I = V/12·[(b²+c²)+(a²+c²)+(a²+b²)] = V/6·(a²+b²+c²); tr S = V/12·(a²+b²+c²) — the second form is what boxTr is)
  boxI.traceWant = bx.V / 12 * (4 + 9 + 25);
  // --- 7: the exterior against the meshes' extents
  const ext = {}; const v = new THREE.Vector3();
  const extents = (name) => { let rMax = 0, zMax = -1e9, zMin = 1e9, rFront = 0; const o = C.scene.getObjectByName(name); if (!o) return null; o.updateWorldMatrix(true, false);
    const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i++) { o.localToWorld(v.fromBufferAttribute(p, i)); const r = Math.hypot(v.x, v.y); rMax = Math.max(rMax, r); zMax = Math.max(zMax, v.z); zMin = Math.min(zMin, v.z); }
    return { rMax, zMax, zMin }; };
  for (const n of ['caseMiddle', 'caseBack', 'caseBackCrystal', 'caseCrystal']) ext[n] = extents(n);
  const T2 = await C.casePathTally();                                        // the build's own arithmetic, at THIS pose
  return { T2, P, modes: A.modes.map((m) => ({ n: m.n, f: m.f_Hz, tipV: m.tipV_ms, W: m.W_W, splA: m.splA_dBA, caseW: m.caseW_W, both: m.splA_withCase_dBA, audible: m.audible })),
    wire: A.wire, arch: arch.map((m) => ({ w: m.w, u: m.u })), tally: { M_kg: M * U ** 3, com: [cx, cy, cz], I, caseExterior_g: caseExt * U ** 3 * 1000, skippedMass_g: skippedMass * U ** 3 * 1000 }, box: boxI, census, ext,
    STOCK: L.STOCK, ALLOY_STOCK: L.ALLOY_STOCK, UNIT_MM: L.UNIT_MM, CASE_BAND_T: L.CASE_BAND_T, boot: C.boot, acousticsSplA: A.splA_dBA };
});
const P = R.P, U = R.UNIT_MM / 1000;

// ---- 1: the foot
{
  const rhoA = R.STOCK.steel.rho * Math.PI * (R.wire.dia_mm / 2000) ** 2, R_m = R.wire.ringR_u * U, alpha = R.wire.arcRad;
  const az0 = P.foot.az0Deg * Math.PI / 180, hand = P.foot.hand;
  const part = (w, u) => { const NG = w.length - 1; let px = 0, py = 0, q = 0; const nx0 = Math.cos(az0), ny0 = Math.sin(az0);
    for (let i = 0; i <= NG; i++) { const az = az0 - hand * alpha * i / NG, nx = Math.cos(az), ny = Math.sin(az), tx = hand * ny, ty = -hand * nx;
      const fx = w[i] * nx + u[i] * tx, fy = w[i] * ny + u[i] * ty, cc = (i === 0 || i === NG) ? 0.5 : 1; px += cc * fx; py += cc * fy; q += cc * ((nx - nx0) * fy - (ny - ny0) * fx); }
    const h = alpha / NG; return { Px: rhoA * R_m * px * h, Py: rhoA * R_m * py * h, Q: rhoA * R_m * R_m * q * h }; };
  // The net P⃗ of a high mode is a small difference of large alternating
  // contributions, so the two rules are compared against the GROSS
  // participation ρAR∫|φ⃗|dθ, which is what bounds either rule's error.
  let worst = 0; const gaps = [];
  for (let i = 0; i < P.modes.length; i++) {
    const p = part(R.arch[i].w, R.arch[i].u), m = P.modes[i].foot, NG = R.arch[i].w.length - 1;
    let gross = 0; for (let j = 0; j <= NG; j++) gross += ((j === 0 || j === NG) ? 0.5 : 1) * Math.hypot(R.arch[i].w[j], R.arch[i].u[j]);
    gross *= rhoA * R_m * alpha / NG;
    const g = Math.max(Math.abs(p.Px - m.P_mg[0] * 1e-6), Math.abs(p.Py - m.P_mg[1] * 1e-6)) / gross;
    gaps.push(`m${i + 1} ${g.toExponential(1)} (net/gross ${(m.Pmag_mg * 1e-6 / gross).toFixed(2)})`);
    worst = Math.max(worst, g, Math.abs(p.Q - m.Q_kgm) / (gross * R_m));
  }
  say('foot participation by trapezoid vs the build\'s Simpson, every mode, gap over the GROSS participation', worst < 1e-4, gaps.join(', '), '< 1e-4 (the trapezoid\'s h² term on 160 steps)');
  const NG = R.arch[0].w.length - 1, w = new Array(NG + 1), u = new Array(NG + 1);
  for (let i = 0; i <= NG; i++) { const az = az0 - hand * alpha * i / NG; w[i] = Math.cos(az); u[i] = hand * Math.sin(az); }
  const pt = part(w, u), Mw = rhoA * R_m * alpha;
  say('CONTROL: a rigid translation along x̂ returns the wire\'s mass along x̂', rel(pt.Px, Mw) < 1e-5, pt.Px / Mw, '1');
  say('CONTROL: … and nothing along ŷ', Math.abs(pt.Py / Mw) < 1e-5, (pt.Py / Mw).toExponential(2), '0');
  for (let i = 0; i <= NG; i++) { w[i] = 0; u[i] = 1; }
  const pr = part(w, u), want = [Math.cos(az0 - hand * alpha) - Math.cos(az0), Math.sin(az0 - hand * alpha) - Math.sin(az0)];
  say('CONTROL: a rigid rotation about the ring\'s centre returns ρAR·(n̂(α) − n̂(0)) — the tangential arithmetic alone', Math.hypot(pr.Px / (rhoA * R_m) - want[0], pr.Py / (rhoA * R_m) - want[1]) < 1e-5, `${(pr.Px / (rhoA * R_m)).toFixed(6)}, ${(pr.Py / (rhoA * R_m)).toFixed(6)}`, `${want[0].toFixed(6)}, ${want[1].toFixed(6)}`);
  const m1 = P.modes[0], om = 2 * Math.PI * m1.f_Hz;
  say('F = ω·v_tip·|P⃗| on mode 1', rel(om * R.modes[0].tipV * m1.foot.Pmag_mg * 1e-6, m1.foot.F_N) < 1e-9, m1.foot.F_N.toFixed(4) + ' N', (om * R.modes[0].tipV * m1.foot.Pmag_mg * 1e-6).toFixed(4));
  say('the foot force lies in the dial\'s plane (the arch\'s modes are in-plane): no axial component on the record', !('Fz' in P.modes[0].field), 'no Fz', 'none');
}
// ---- 2: the watch
{
  const T = R.tally, W = R.T2, B = P.watch;                                   // the build's tally re-run at the probe's pose, against the probe's own; B the build-pose record
  say('watch mass: the build\'s tally at this pose vs the probe\'s from a shifted origin (rel)', rel(T.M_kg, W.M_kg) < 1e-9, (T.M_kg * 1000).toFixed(4) + ' g', (W.M_kg * 1000).toFixed(4));
  const dc = Math.hypot(T.com[0] - W.com_u[0], T.com[1] - W.com_u[1], T.com[2] - W.com_u[2]);
  say('mass centre agrees (u)', dc < 1e-6, dc.toExponential(2), '< 1e-6');
  let worst = 0; for (const k of ['xx', 'yy', 'zz']) worst = Math.max(worst, rel(T.I[k], W.I_kgm2[k])); for (const k of ['xy', 'xz', 'yz']) worst = Math.max(worst, Math.abs(T.I[k] - W.I_kgm2[k]) / W.I_kgm2.zz);
  say('inertia tensor about the centre agrees (rel to I_zz)', worst < 1e-7, worst.toExponential(2), '< 1e-7');
  // the record's BUILD-pose tally against the posed one: the same meshes, moved — name any mesh whose volume changed
  // the same traversal order, so by index (names repeat)
  const moved = B.perMesh.map((m, i) => [m, W.perMesh[i]]).filter(([m, w]) => !w || Math.abs(w.V_u3 - m.V_u3) > 1e-6 * Math.max(1, m.V_u3)).map(([m, w]) => `${m.name} ${m.V_u3.toFixed(3)}→${w ? w.V_u3.toFixed(3) : 'gone'}`);
  const dcb = Math.hypot(B.com_u[0] - W.com_u[0], B.com_u[1] - W.com_u[1], B.com_u[2] - W.com_u[2]);
  say('the record\'s build-pose tally against the posed one: same mesh count, mass within 0.05%, centre within 0.2 u (what the hands and levers move)', B.meshes === W.meshes && rel(B.M_kg, W.M_kg) < 5e-4 && dcb < 0.2, `${B.meshes}/${W.meshes} meshes, Δm ${((W.M_kg - B.M_kg) * 1000).toFixed(4)} g, Δc ${dcb.toFixed(4)} u; volumes moved: ${moved.length ? moved.join('; ') : 'none'}`, 'equal counts, < 0.05%, < 0.2 u');
  say('CONTROL: the tetrahedron formulas on a 2×3×5 box — volume', rel(R.box.V, 30) < 1e-9, R.box.V.toFixed(9), '30');
  say('CONTROL: … and its second-moment trace V/12·(a²+b²+c²), rotated and displaced', rel(R.box.trace, R.box.traceWant) < 1e-9, R.box.trace.toFixed(9), R.box.traceWant.toFixed(9));
  say('no material the stock map does not know', W.unmapped.length === 0, W.unmapped.length, '0');
  say('what the tally skips by name (the chain, tessellated after the block) weighs under 0.1% of the watch', T.skippedMass_g > 0 && T.skippedMass_g / (W.M_kg * 1000) < 1e-3, `${T.skippedMass_g.toFixed(4)} g (${W.skippedByName.join(', ')})`, '< 0.1% of M');
  const sheets = W.openSkipped.filter((o) => o.nominalV_u3 === null).length, nearly = W.openSkipped.length - sheets;
  say('open meshes skipped: nominal mass of the nearly closed ones under 2% of the watch', W.openSkippedNominal_g / (W.M_kg * 1000) < 0.02, `${W.openSkippedNominal_g.toFixed(3)} g over ${nearly} nearly closed (+${sheets} sheets)`, '< 2% of M');
  // the band is judged on the BUILD's census (its defects are measured about the scene's origin; the probe's shifted frame inflates float noise by its own reach)
  const closedMax = Math.max(...B.perMesh.map((m) => m.defect)), openMin = Math.min(...B.openSkipped.map((m) => m.defect));
  say('the closedness threshold sits in an empty band of the build\'s census (decades either side)', closedMax < W.openDefectMax / 1e3 && openMin > W.openDefectMax * 1e3, `closed ≤ ${closedMax.toExponential(1)}, open ≥ ${openMin.toExponential(1)}, threshold ${W.openDefectMax}`, '≥ 3 decades each side');
  const sameSkip = R.census.filter((c) => c.defect > W.openDefectMax).length === B.openSkipped.length;   // the chain is closed; it is skipped by name, not by the test
  say('the probe\'s shifted-frame census classifies the same meshes open as the build', sameSkip, `${R.census.filter((c) => c.defect > W.openDefectMax).length} vs ${B.openSkipped.length}`, 'equal');
  say('the case alloy\'s exterior share is tallied', W.caseExterior_g > 10 && rel(W.caseExterior_g, T.caseExterior_g) < 1e-9, W.caseExterior_g.toFixed(3) + ' g', '> 10 g, equal both ways');
  if (CENSUS) for (const c of R.census.sort((x, y) => y.defect - x.defect).slice(0, 30)) console.log('   census', c.defect.toExponential(2), c.name);
}
// ---- 3: the response
{
  const W = P.watch, I = W.I_kgm2; const { xx: a, yy: d, zz: f, xy: b, xz: c, yz: e } = I;
  let worst = 0;
  for (const m of P.modes) {
    const om = 2 * Math.PI * m.f_Hz, F = m.field;
    worst = Math.max(worst, rel(F.Vx, F.Fx / (om * W.M_kg)), rel(F.Vy, F.Fy / (om * W.M_kg)));
    const [tx, ty, tz] = F.tau, Ox = F.Ox * om, Oy = F.Oy * om, Oz = F.Oz * om;      // I·Ω·ω must give τ back
    const r = [a * Ox + b * Oy + c * Oz - tx, b * Ox + d * Oy + e * Oz - ty, c * Ox + e * Oy + f * Oz - tz];
    worst = Math.max(worst, Math.hypot(...r) / Math.hypot(tx, ty, tz));
  }
  say('V⃗ = F⃗/(ωM) and I·(ωΩ⃗) = τ⃗ on every mode (rel)', worst < 1e-9, worst.toExponential(2), '< 1e-9');
  const m1 = P.modes[0], zf = (P.foot.ringZ_u - W.com_u[2]) * U, F = m1.field;
  say('τ⃗ = (x_foot − c) × F⃗ + M_root ẑ on mode 1 (the in-plane couple from the foot\'s height)', Math.abs(F.tau[0] + zf * F.Fy) < 1e-12 && Math.abs(F.tau[1] - zf * F.Fx) < 1e-12, `${F.tau[0].toExponential(3)}, ${F.tau[1].toExponential(3)}`, `${(-zf * F.Fy).toExponential(3)}, ${(zf * F.Fx).toExponential(3)}`);
}
// ---- 4: the radiation, by brute force
const RHO = 1.2, CS = 343;
const J1 = (x) => { const N = 200; let s = 0; for (let i = 0; i <= N; i++) { const t = Math.PI * i / N, c = (i === 0 || i === N) ? 1 : (i % 2 ? 4 : 2); s += c * Math.cos(t - x * Math.sin(t)); } return s * (Math.PI / N) / 3 / Math.PI; };
const brute = (surfaces, k, F, nPhi, dsMax, nTh, nPh) => {
  // elements (s, φ) with their world position, normal and area
  const el = [];
  for (const s of surfaces) {
    const L = Math.hypot(s.r1 - s.r0, s.z1 - s.z0) * U, n = Math.max(2, Math.ceil(L / dsMax)), ds = L / n;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, r = (s.r0 + (s.r1 - s.r0) * t) * U, z = (s.z0 + (s.z1 - s.z0) * t) * U;
      for (let j = 0; j < nPhi; j++) {
        const ph = 2 * Math.PI * (j + 0.5) / nPhi, cp = Math.cos(ph), sp = Math.sin(ph);
        const x = r * cp, y = r * sp, nx = s.nr * cp, ny = s.nr * sp, nz = s.nz;
        const vx = F.Vx + F.Oy * (z - F.cz) - F.Oz * (y - F.cy), vy = F.Vy + F.Oz * (x - F.cx) - F.Ox * (z - F.cz), vz = (F.Vz || 0) + F.Ox * (y - F.cy) - F.Oy * (x - F.cx);
        el.push({ x, y, z, vn: vx * nx + vy * ny + vz * nz, dA: r * ds * 2 * Math.PI / nPhi });
      }
    }
  }
  let sum = 0, peak = 0;
  for (let i = 0; i < nTh; i++) {
    const th = Math.PI * (i + 0.5) / nTh, st = Math.sin(th), ct = Math.cos(th);
    for (let j = 0; j < nPh; j++) {
      const ph = 2 * Math.PI * j / nPh, rx = st * Math.cos(ph), ry = st * Math.sin(ph);
      let fr = 0, fi = 0;
      for (const e of el) { const p = -k * (rx * e.x + ry * e.y + ct * e.z), g = e.vn * e.dA; fr += g * Math.cos(p); fi += g * Math.sin(p); }
      const F2 = fr * fr + fi * fi; sum += F2 * st; peak = Math.max(peak, F2);
    }
  }
  const integral = sum * (Math.PI / nTh) * (2 * Math.PI / nPh), pre = RHO * CS * k * k / (8 * Math.PI * Math.PI);
  return { W: pre * integral, Ipeak: pre * peak / 0.09 };
};
{
  // the brute force on the piston (both sides, so ½ of it) and on the sphere
  const a = 0.01;
  for (const ka of [1, 3]) {
    const k = ka / a, got = brute([{ r0: 0, z0: 0, r1: a / U, z1: 0, nr: 0, nz: 1 }], k, { Vx: 0, Vy: 0, Vz: 1, Ox: 0, Oy: 0, Oz: 0, cx: 0, cy: 0, cz: 0 }, 48, a / 40, 90, 8).W / 2;
    const ex = 0.5 * RHO * CS * Math.PI * a * a * (1 - J1(2 * ka) / ka);
    say(`CONTROL: brute-force quadrature radiates the baffled piston's ½ρcπa²(1 − J₁(2ka)/ka) at ka ${ka}`, rel(got, ex) < 5e-3, got.toExponential(5), ex.toExponential(5));
  }
  const aC = P.exterior.find((s) => s.name === 'back band').r0 * U;
  for (const row of P.modes.filter((m) => m.audible)) {
    const k = 2 * Math.PI * row.f_Hz / CS, NS = 90, prof = [];
    for (let i = 0; i < NS; i++) { const t0 = Math.PI * i / NS, t1 = Math.PI * (i + 1) / NS, tm = (t0 + t1) / 2; prof.push({ r0: aC * Math.sin(t0) / U, z0: aC * Math.cos(t0) / U, r1: aC * Math.sin(t1) / U, z1: aC * Math.cos(t1) / U, nr: Math.sin(tm), nz: Math.cos(tm) }); }
    const ds = Math.min(2 * Math.PI / k / 24, 1.5e-3);
    const sph = brute(prof, k, { Vx: 1, Vy: 0, Vz: 0, Ox: 0, Oy: 0, Oz: 0, cx: 0, cy: 0, cz: 0 }, 48, ds, 72, 16).W;
    const ka = k * aC, ex = (2 * Math.PI * RHO * CS * aC * aC / 3) * ka ** 4 / (4 + ka ** 4);
    say(`mode ${row.n}: the Kirchhoff sphere ratio reproduced by brute force (ka ${ka.toFixed(2)})`, rel(sph / ex, row.kirchhoffSphereRatio) < 0.03, (sph / ex).toFixed(4), row.kirchhoffSphereRatio.toFixed(4) + ' ±3%');
    const Fd = { ...row.field, cx: P.watch.com_u[0] * U, cy: P.watch.com_u[1] * U, cz: P.watch.com_u[2] * U };
    const got = brute(P.exterior, k, Fd, 64, ds, 72, 32);
    say(`mode ${row.n}: the exterior's radiated power by brute force (no Bessel, no harmonics)`, rel(got.W, row.W_W) < 0.03, got.W.toExponential(4) + ' W', row.W_W.toExponential(4) + ' ±3%');
    say(`mode ${row.n}: … and its on-axis peak`, rel(got.Ipeak, row.I_peak_W_m2) < 0.05, got.Ipeak.toExponential(4), row.I_peak_W_m2.toExponential(4) + ' ±5%');
  }
}
// ---- 5: the receiver and the pane
{
  const ST = R.STOCK, rec = P.receiver;
  const f01 = (a, h, st) => (10.2158 / (2 * Math.PI * a * a)) * Math.sqrt(st.E * h * h / (12 * (1 - st.nu * st.nu) * st.rho));
  say('plate f₀₁ from STOCK.nickelSilver, clamped at the ledge radius', rel(f01(rec.plateClampR_u * U, rec.plateT_u * U, ST[rec.plateStock]), rec.plateF01_Hz) < 1e-9, rec.plateF01_Hz.toFixed(1) + ' Hz', f01(rec.plateClampR_u * U, rec.plateT_u * U, ST[rec.plateStock]).toFixed(1));
  say('back glass f₀₁ from STOCK.corundum at the aperture', rel(f01(rec.glassR_u * U, rec.glassT_u * U, ST.corundum), rec.glassF01_Hz) < 1e-9, rec.glassF01_Hz.toFixed(1) + ' Hz', f01(rec.glassR_u * U, rec.glassT_u * U, ST.corundum).toFixed(1));
  const cs = ST[R.ALLOY_STOCK[P.watch.caseAlloy]];
  const band = (2 * 3 / Math.sqrt(5)) * (R.CASE_BAND_T * U / Math.sqrt(12)) * Math.sqrt(cs.E / cs.rho) / (2 * Math.PI * (rec.bandR_u * U) ** 2);
  say('band free-ring n = 2 from the alloy\'s STOCK row', rel(band, rec.bandOval2_Hz) < 1e-9, rec.bandOval2_Hz.toFixed(1) + ' Hz', band.toFixed(1));
  // λ₀₁ of the clamped disc: J₀(λ)I₁(λ) + I₀(λ)J₁(λ) = 0
  const ser = (x, sgn, nu) => { let s = 0, t = (x / 2) ** nu / (nu === 1 ? 1 : 1); for (let m = 0; m < 40; m++) { const term = (sgn ** m) * (x / 2) ** (2 * m + nu) / (fact(m) * fact(m + nu)); s += term; } return s; };
  function fact(n) { let f = 1; for (let i = 2; i <= n; i++) f *= i; return f; }
  const g = (x) => ser(x, -1, 0) * ser(x, 1, 1) + ser(x, 1, 0) * ser(x, -1, 1);
  let lo = 2.5, hi = 3.5; for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (Math.sign(g(mid)) === Math.sign(g(lo))) lo = mid; else hi = mid; }
  say('CONTROL: the clamped disc\'s λ₀₁² re-solved from J₀I₁ + I₀J₁ = 0', Math.abs(((lo + hi) / 2) ** 2 - 10.2158) < 2e-4, (((lo + hi) / 2) ** 2).toFixed(5), '10.2158');
  const ms = ST.corundum.rho * rec.glassT_u * U;
  say('the pane\'s mass per area', rel(ms, P.paneMs_kg_m2) < 1e-9, P.paneMs_kg_m2.toFixed(4) + ' kg/m²', ms.toFixed(4));
  const m1 = P.modes[0], tl = 10 * Math.log10(1 + (2 * Math.PI * m1.f_Hz * ms / (2 * RHO * CS)) ** 2);
  say('the mass law at mode 1 (normal incidence)', Math.abs(tl - m1.paneMassLaw_dB) < 1e-9, m1.paneMassLaw_dB.toFixed(2) + ' dB', tl.toFixed(2));
  say('mode 1 sits below both disc modes (the rigid figure is a floor there) and mode 2 above the plate\'s', P.modes[0].belowDiscModes && !P.modes[1].belowDiscModes, `${P.modes[0].belowDiscModes}, ${P.modes[1].belowDiscModes}`, 'true, false');
  say('the band\'s free-ring bound is carried with its caveat, not folded into the disc regime', typeof rec.bandCaveat === 'string' && rec.bandCaveat.length > 20 && 'belowBandFreeOval' in P.modes[0], 'present', 'present');
}
// ---- 6: the levels and the alloy
{
  const Aw = (f) => { const f2 = f * f; return 20 * Math.log10(12194 ** 2 * f2 * f2 / ((f2 + 20.6 ** 2) * Math.sqrt((f2 + 107.7 ** 2) * (f2 + 737.9 ** 2)) * (f2 + 12194 ** 2))) + 2.0; };
  say('A-weighting reads 0 dB at 1 kHz', Math.abs(Aw(1000)) < 0.01, Aw(1000).toFixed(4), '0 ±0.01');
  let worst = 0, sumC = 0, sumB = 0;
  for (const m of P.modes) {
    if (!m.audible) { if (m.W_W !== null) worst = 1; continue; }
    worst = Math.max(worst, Math.abs(m.splA_dBA - m.spl_dB - Aw(m.f_Hz)));
    worst = Math.max(worst, Math.abs(m.spl_dB - 10 * Math.log10(m.I_peak_W_m2 / 1e-12)));
    worst = Math.max(worst, Math.abs(m.splA_withCase_dBA - 10 * Math.log10(10 ** (m.splA_dBA / 10) + 10 ** (m.wireSplA_dBA / 10))));
    sumC += 10 ** (m.splA_dBA / 10); sumB += 10 ** (m.splA_withCase_dBA / 10);
  }
  say('per-mode levels: spl from I_peak, splA = spl + A(f), the wire-plus-case power sum; ultrasonic rows null', worst < 1e-9, worst.toExponential(2), '< 1e-9');
  say('case-path total and wire-plus-case total are the audible rows\' power sums', Math.abs(10 * Math.log10(sumC) - P.splA_dBA) < 1e-9 && Math.abs(10 * Math.log10(sumB) - P.splA_withCase_dBA) < 1e-9, `${P.splA_dBA.toFixed(2)} / ${P.splA_withCase_dBA.toFixed(2)} dBA`, `${(10 * Math.log10(sumC)).toFixed(2)} / ${(10 * Math.log10(sumB)).toFixed(2)}`);
  const mixOk = R.modes.every((m, i) => (m.audible ? rel(m.caseW, P.modes[i].W_W) < 1e-12 : m.caseW === 0) && Math.abs(m.both - P.modes[i].splA_withCase_dBA) < 1e-12);
  say('the ding\'s mix inputs (acoustics.modes[].caseW_W, splA_withCase_dBA) are the case path\'s rows', mixOk, mixOk, 'true');
  say('the wire-alone level is unchanged by the case path (acoustics.splA_dBA is §197\'s figure)', Math.abs(R.acousticsSplA - 10 * Math.log10(R.modes.filter((m) => m.audible).reduce((t, m) => t + 10 ** (m.splA / 10), 0))) < 1e-9, R.acousticsSplA.toFixed(3), 'the wire rows\' power sum');
  say('the fundamental gains more from the case than the overtone (a dipole the size of the case against one the size of a wire)', P.modes[0].splA_withCase_dBA - P.modes[0].wireSplA_dBA > P.modes[1].splA_withCase_dBA - P.modes[1].wireSplA_dBA, `+${(P.modes[0].splA_withCase_dBA - P.modes[0].wireSplA_dBA).toFixed(1)} dB at f₁, +${(P.modes[1].splA_withCase_dBA - P.modes[1].wireSplA_dBA).toFixed(1)} at f₂`, 'f₁ gains more');
  // the exterior against the meshes
  const E = Object.fromEntries(P.exterior.map((s) => [s.name, s]));
  const near = (a, b, tol = 2e-3) => Math.abs(a - b) < tol;
  say('exterior profile: the back band\'s radius is caseMiddle\'s largest vertex radius', near(E['back band'].r0, R.ext.caseMiddle.rMax, 1e-2), E['back band'].r0.toFixed(4), R.ext.caseMiddle.rMax.toFixed(4));
  say('exterior profile: the back ring\'s face plane is caseBack\'s top', near(E['back ring face'].z0, R.ext.caseBack.zMax), E['back ring face'].z0.toFixed(4), R.ext.caseBack.zMax.toFixed(4));
  say('exterior profile: the glass step\'s top is caseBackCrystal\'s top', near(E['glass step top'].z0, R.ext.caseBackCrystal.zMax), E['glass step top'].z0.toFixed(4), R.ext.caseBackCrystal.zMax.toFixed(4));
  say('exterior profile: the front crystal\'s plane is caseCrystal\'s outer face', near(E['front crystal'].z0, R.ext.caseCrystal.zMin), E['front crystal'].z0.toFixed(4), R.ext.caseCrystal.zMin.toFixed(4));
  say('boot silent (steel)', warns.length === 0, warns.length ? warns.slice(0, 3).join(' | ').slice(0, 300) : 'no warnings', 'no warnings');
  say('REPORT: §239 worst held stretch at boot (ms) — main\'s own figure on this container is ~3.3 s, so this is not gated here', true, R.boot.worstHeldMs.toFixed(0), 'report');
  say('REPORT: the case path\'s own block cost (ms)', true, JSON.stringify(Object.fromEntries(Object.entries(P.timings_ms).filter(([, v]) => v > 0.5).map(([k, v]) => [k, Math.round(v)]))), 'report');
}
await page.close();
// ---------------------------------------------------------------- boot 2: platinum
{
  const { page: p2, warns: w2 } = await boot('?aes=materials.caseMetal.alloy~platinum');
  const R2 = await p2.evaluate(() => { const P = window.__clock.casePath; return { M_kg: P.watch.M_kg, alloy: P.watch.caseAlloy, caseExterior_g: P.watch.caseExterior_g, modes: P.modes.map((m) => ({ W: m.W_W, F: m.foot.F_N })) }; });
  const rhoPt = R.STOCK[R.ALLOY_STOCK.platinum].rho, rhoSt = R.STOCK.steel.rho;
  say('CONTROL (alloy path): a second boot reads the platinum case', R2.alloy === 'platinum', R2.alloy, 'platinum');
  const wantM = P.watch.M_kg + P.watch.caseExterior_g / 1000 * (rhoPt / rhoSt - 1);
  say('… and weighs the steel watch plus the exterior share × (ρ_Pt/ρ_steel − 1)', rel(R2.M_kg, wantM) < 1e-9, (R2.M_kg * 1000).toFixed(3) + ' g', (wantM * 1000).toFixed(3));
  say('… with the same foot force (the wire does not know the case)', rel(R2.modes[0].F, P.modes[0].foot.F_N) < 1e-9, R2.modes[0].F.toFixed(5), P.modes[0].foot.F_N.toFixed(5));
  // the rotation shares the 1/M scaling only approximately (I scales with the case's share of I, not M), so the identity is on the TRANSLATION-dominated part: hold the power ratio within the rocking's share
  const ratio = R2.modes[0].W / P.modes[0].W_W, pure = (P.watch.M_kg / R2.M_kg) ** 2;
  say('… and mode 1\'s case-path power falls with the mass — between (M/M_Pt)² and 1 (the rocking terms scale with I, not M)', ratio < 1 && ratio > pure * 0.8, ratio.toFixed(4), `in (${(pure * 0.8).toFixed(4)}, 1)`);
  say('boot silent (platinum)', w2.length === 0, w2.length ? w2.slice(0, 3).join(' | ').slice(0, 300) : 'no warnings', 'no warnings');
  await p2.close();
}
await browser.close(); srv.kill();
let fails = 0;
for (const r of rows) { if (!r.ok) fails++; console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}\n        got ${r.got}   want ${r.want}`); }
console.log(`\n§269 case path: ${rows.length} rows, ${fails} FAIL — ${fails ? 'FAIL' : 'ALL PASS'}`);
process.exit(fails ? 1 : 0);
