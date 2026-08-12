// THE TIER-SPLIT GATE — §112 design (a): can the alarm's POWER TIERS live
// under the three-quarter plate while the strike group stays on top?
//
// The split: gong, hammer, cam, lock and switch keep the plate top (nothing
// above ~2.3 over the face); the barrel (body, arbor, winding wheel,
// ratchet), the click, the governor and its anchor, and the strike arbor's
// own lower members (strike pinion, 64T governor wheel, winding tier) drop
// below, the strike arbor passing through a plate bore like every train
// arbor. Every drive edge keeps its centre distance, so P0 is untouched by
// construction — this gate asks only the P3 question, in position space.
//
// THE DROP IS ONE TRANSLATION. The below-plate members keep today's
// internal z-offsets and land as a body whose top sits one margin under
// the plate (translation = TQ_BOT − MARGIN − old stack top). That choice
// is load-bearing for the gate's honesty: every internal mesh band, the
// §104 overfly clearance and the anchor/saw engagement all survive a
// common translation bit-for-bit, so the search only has to judge what
// actually changes — the three module-relative BEARINGS §104 already
// names as fold currencies:
//   θ_b — ALARM_BARREL_BEARING (barrel + click, rigid pair, about the
//         strike arbor at the built mesh CD),
//   θ_g — ALARM_GOV_BEARING (about the strike arbor at its CD),
//   θ_a — the anchor's bearing about the governor at its D.
// The strike arbor's station is FIXED (the cam above must keep meeting the
// hammer tail), and the drum's side is departed to its other measured
// window (probe-drum-azimuth) with the fusee kept.
//
// Internal pairs the translation preserves are EXEMPT from re-judging
// (barrel⇄strike pinion, ratchet⇄click, wheel⇄governor pinion,
// saw⇄anchor, the §104 overfly). What the bearings change is judged:
// each moved disc against the movement's under-plate occupancy (the
// placement probe's z-interval field), the winding leg's corridor, and
// the pairwise separations the bearings can actually alter.
//
// Run: cd tools && node probe-alarm-tier-split.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const srv = spawn('python3', ['-m', 'http.server', '8443', '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto('http://127.0.0.1:8443/index.html', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 60000 });

const res = await page.evaluate(async () => {
  const THREE = await import('three');
  const clock = window.__clock;
  clock.resetInputs();
  clock.setPose({ tau: 0.13, crownPullT: 0, leverEngage: 0, tension: 1, windAccumTurns: 0 });
  clock.render();
  const out = [];
  const f = (n) => n.toFixed(2);
  const MARGIN = 0.15;
  const plate = clock.labelEntries.find((e) => e.name === 'Three-quarter plate');
  const plateBox = new THREE.Box3().setFromObject(plate.obj);
  const TQ_BOT = plateBox.min.z, TQ_TOP = plateBox.max.z;
  const plateR = clock.plateR, P = clock.P;

  const meshesOf = (name) => {
    const rows = [];
    clock.labelEntries.find((e) => e.name === name).obj.traverse((o) => {
      if (!o.isMesh || o.userData.schematic || !o.geometry?.attributes?.position) return;
      const bb = new THREE.Box3().setFromObject(o, true);
      if (!bb.isEmpty()) rows.push({ mesh: o.name || o.geometry.type, bb });
    });
    return rows;
  };
  const centerOf = (rows, pick) => {
    const m = rows.find((r) => r.mesh === pick);
    return { x: (m.bb.min.x + m.bb.max.x) / 2, y: (m.bb.min.y + m.bb.max.y) / 2 };
  };
  // Horizontal reach of a mesh set about a station: per mesh, the distance
  // to its box CENTRE plus its larger half-extent. The naive farthest-corner
  // read inflates a station-centred disc by √2 (a 9.6 wheel reports 13.6 —
  // measured, and it alone pushed the fixed disc off the plate rim); centre
  // + half-extent reads a centred disc as exactly its radius and stays
  // conservative for offset parts.
  const reachOf = (rows, st, filter) => Math.max(...rows.filter(filter || (() => true)).map((r) => {
    const cx = (r.bb.min.x + r.bb.max.x) / 2, cy = (r.bb.min.y + r.bb.max.y) / 2;
    return Math.hypot(cx - st.x, cy - st.y)
      + Math.max((r.bb.max.x - r.bb.min.x) / 2, (r.bb.max.y - r.bb.min.y) / 2);
  }));

  // --- Stations and dimensions, all read from the built scene --------------
  const swRows = meshesOf('Alarm striking wheel');
  const sw = centerOf(swRows, 'alarmCam');                       // strike arbor — FIXED
  const barRows = meshesOf('Alarm barrel');
  const bar = centerOf(barRows, 'alarmBarrelArbor');
  const clkRows = meshesOf('Alarm click');
  const clk = centerOf(clkRows, 'alarmClickStud');
  const govRows = meshesOf('Alarm governor');
  const gov = centerOf(govRows, 'alarmGovArbor');
  const ancRows = meshesOf('Alarm governor anchor');
  const anc = centerOf(ancRows, 'alarmGovAnchorArbor');
  const CD_B = Math.hypot(bar.x - sw.x, bar.y - sw.y);
  const CD_G = Math.hypot(gov.x - sw.x, gov.y - sw.y);
  const D_A = Math.hypot(anc.x - gov.x, anc.y - gov.y);
  const clkOff = { x: clk.x - bar.x, y: clk.y - bar.y };         // click rides the barrel

  // The translation: below-plate members keep today's offsets, stack top
  // lands one margin under the plate. The top is measured over the ROTOR
  // members only — the plate-planted studs invert under the split (they
  // plant in the base plate and their length re-derives), and the strike
  // arbor's upper stud ends in the plate bore, so none of them drives the
  // ceiling. Counting them cost 0.20 of drop in this gate's first run.
  const STUDS = ['alarmGovStud', 'alarmGovAnchorStud', 'alarmClickStud', 'alarmGovStudUpper'];
  const isStudRow = (r) => STUDS.includes(r.mesh) || (r.mesh === 'CylinderGeometry' && (r.bb.max.x - r.bb.min.x) < 1.5);
  const oldTop = Math.max(...[...swRows, ...barRows, ...govRows, ...ancRows, ...clkRows]
    .filter((r) => !isStudRow(r)).map((r) => r.bb.max.z));
  const DZ = (TQ_BOT - MARGIN) - oldTop;
  // Which striking-wheel meshes DROP: everything above the cam/lock band —
  // the sleeve step, gov sleeve, wind wheel, ratchet, gov wheel, upper stud.
  // The cam (and the stud's plate-top run, and the lock collar) stay.
  const dropSW = swRows.filter((r) => r.bb.min.z > 10.0);
  // Discs: per moving unit, split the barrel by band (wide body+wall low,
  // narrow arbor column high), one disc each for click/gov/anchor, one for
  // the dropped strike-arbor members about the FIXED station.
  const band = (rows, filter) => {
    const set = rows.filter(filter);
    return [Math.min(...set.map((r) => r.bb.min.z)) + DZ, Math.max(...set.map((r) => r.bb.max.z)) + DZ];
  };
  // ------------------------------------------------------------------------
  // THE DECLARED UNDER-PLATE STACK. A rigid drop of today's stack was this
  // gate's first form and it is arithmetically impossible: the barrel
  // column carries 5.4 of stacked metal, the low-linkage rods claim the
  // first 2.02 of the band (1.87 measured tops + the margin), and 2.02 +
  // 5.4 + the 64T wheel's own tier does not fit under 7.56. The fit that
  // remains INTERLEAVES, and every band below derives from a named
  // constraint (rule 1):
  //  · LOW_TOP = rod tops + margin — the floor for every WIDE disc; only
  //    the two small barrel-arbor members (winding wheel, ratchet+click)
  //    go below it, into cells the field proves rod-free per placement;
  //  · the 64T governor wheel drops to the FIRST wide band over the rods —
  //    which also RETIRES §104's overfly (nothing on the barrel arbor
  //    shares its band any more: the ratchet now lives at the floor);
  //  · the barrel rides HIGH exactly the way the mainspring drum already
  //    lives under this plate — wall (with the strike pinion's mesh)
  //    above the wheel band, body above the wall;
  //  · the governor cluster translates as one so its pinion embraces the
  //    wheel band (its internal §104 arithmetic untouched); the poising
  //    ring joins the floor discs (it was dropped low by §104's own fold
  //    and stays a fold-tunable).
  const rodTop = 1.87;                        // measured: the hack rod's top
  const LOW_TOP = rodTop + MARGIN;            // 2.02 — the wide-disc floor
  const CEIL = TQ_BOT - MARGIN;               // 7.56
  const T = { wheel: 0.93, wall: 1.42, body: 1.94, wind: 1.20, rat: 0.40, pinion: 1.32, saw: 0.40, ring: 1.20 };
  const G0 = MARGIN;                          // one margin between tiers
  const Z_WHEEL = [LOW_TOP + 0.13, LOW_TOP + 0.13 + T.wheel];          // 2.15..3.08 (0.13: the great wheel read's granularity)
  const Z_WALL = [Z_WHEEL[1] + G0, Z_WHEEL[1] + G0 + T.wall];          // 3.23..4.65 — the strike pinion meshes in here
  const Z_BODY = [Z_WALL[1] + G0, Z_WALL[1] + G0 + T.body];            // 4.80..6.74 ≤ CEIL ✓ (boot-assert of the build)
  const Z_WIND = [0.35, 0.35 + T.wind];                                // floor discs: rod-free cells only,
  const Z_RAT = [Z_WIND[1] + 0.05, Z_WIND[1] + 0.05 + T.rat];          //   proven by the field per placement
  const Z_RING = [0.35, 0.35 + T.ring];
  const govDZ = Z_WHEEL[0] - 13.39;           // governor cluster translation: pinion onto the wheel band
  const discs = [
    { name: 'barrel wall', about: 'b', r: reachOf(barRows, bar, (r) => r.bb.min.z >= 10.0 && r.bb.min.z < 11.5), z: Z_WALL },
    { name: 'barrel body', about: 'b', r: reachOf(barRows, bar, (r) => r.bb.min.z < 10.0 && !isStudRow(r)), z: Z_BODY },
    { name: 'barrel wind wheel', about: 'b', r: 1.9, z: Z_WIND },
    { name: 'barrel ratchet', about: 'b', r: 2.4, z: Z_RAT },
    { name: 'click', about: 'c', r: reachOf(clkRows, clk), z: [Z_WIND[0], Z_RAT[1] + 0.1] },
    { name: 'governor saw', about: 'g', r: reachOf(govRows, gov, (r) => r.mesh === 'alarmGovSaw'), z: [14.62 + govDZ, 15.02 + govDZ] },
    { name: 'governor pinion+arbor', about: 'g', r: 1.8, z: [13.19 + govDZ, 15.02 + govDZ] },
    { name: 'anchor pallets', about: 'a', r: reachOf(ancRows, anc, (r) => r.mesh !== 'alarmGovAnchorStud' && !/Ring/.test(r.mesh)), z: [14.62 + govDZ, 15.02 + govDZ] },
    { name: 'anchor ring', about: 'a', r: reachOf(ancRows, anc, (r) => /Ring/.test(r.mesh)), z: Z_RING },
    // The arbor BETWEEN the ring and the pallets — a column crossing the 64T
    // wheel's band. Its omission was this gate's one wrong answer: the first
    // solved θ_a stood the arbor 8.5 from the strike station, inside the
    // wheel's 9.6, and only the §104 rim warn at boot said anything.
    { name: 'anchor arbor col', about: 'a', r: 0.7, z: [Z_RING[1], 14.62 + govDZ] },
  ];
  const swDiscs = [
    { name: 'sw:strike pinion', r: 1.97, z: [Z_WALL[0] + 0.1, Z_WALL[1] - 0.1] },
    { name: 'sw:gov wheel', r: reachOf(dropSW, sw, (r) => r.mesh === 'alarmGovWheel'), z: Z_WHEEL },
    { name: 'sw:arbor column', r: 0.75, z: [Z_WHEEL[0], TQ_BOT] },
  ];
  // Grounding: barrel, click, governor and anchor stand on the BASE plate
  // (planted-0.5 idiom), so each carries a thin stud column floor-to-top at
  // its own station — the stud, not the whole disc. The strike arbor's
  // members carry none: the arbor hangs in the plate BORE, which is the
  // tier-split's defining move.
  const STUD_R = 0.6;
  for (const d of discs) if (d.about !== 's') d.stud = [0, d.z[1]];
  out.push(`strike arbor FIXED at (${f(sw.x)}, ${f(sw.y)}); CD_b ${f(CD_B)}, CD_g ${f(CD_G)}, D_a ${f(D_A)}; drop DZ ${f(DZ)}`);
  for (const d of [...discs, ...swDiscs]) out.push(`  disc ${d.name.padEnd(24)} r ${f(d.r)}  z ${f(d.z[0])}..${f(d.z[1])}`);

  // The winding leg: corridor from the climb arbor's station to the barrel,
  // at idler half-width, in the translated wind tier's band.
  const windRows = meshesOf('Alarm winding train');
  const climbSt = (() => {
    // the climb ROD is the one wind-train mesh spanning from the alarm
    // corner's plane up through both plates — select it by that span
    const rod = windRows.find((r) => r.bb.min.z < -3 && r.bb.max.z > 10);
    return { x: (rod.bb.min.x + rod.bb.max.x) / 2, y: (rod.bb.min.y + rod.bb.max.y) / 2 };
  })();
  const WIND_BAND = [Z_WIND[0], Z_WIND[1]]; // the idlers ride the winding wheel's tier
  const IDLER_HALF = 2.7 + MARGIN;
  out.push(`climb arbor at (${f(climbSt.x)}, ${f(climbSt.y)}); wind corridor half-width ${f(IDLER_HALF)} band ${f(WIND_BAND[0])}..${f(WIND_BAND[1])}`);

  // --- The obstacle field (the placement probe's machinery) ----------------
  const MODULE = ['Alarm gong', 'Alarm hammer', 'Alarm striking wheel', 'Alarm barrel',
    'Alarm governor', 'Alarm governor anchor', 'Alarm click', 'Alarm lock',
    'Alarm switch', 'Alarm link', 'Alarm winding train'];
  const DEPARTING = ['Mainspring drum', 'Chain', 'Set-up work'];
  // Obstacles enter the field in the shape they actually have, because this
  // search failed three times on box artifacts before this block took its
  // final form: a z-rotated box is the AABB of a rotated AABB (√2 on the
  // gong), one box across a tapering cone claims the base's radius at the
  // top (the fusee), a DIAGONAL rod segment's box claims the whole
  // rectangle it crosses (the hack rod painted the north-east solid), and
  // a wheel's square corners claim cells outside its disc (the centre
  // wheel refused bearings its rim never reaches). Three shapes:
  //  · ROTOR meshes — any mesh under a group carrying userData.r, the
  //    schematic tier's own rotor contract — become DISCS about the
  //    rotor's axis, radius = axis distance + the mesh's larger
  //    half-extent (exactly the wheel's radius for a centred wheel);
  //    tall rotor meshes (the fusee cone) are z-sliced first so each
  //    tier meets the radius the cone has THERE;
  //  · THIN LONG meshes (rods) are vertex-sliced along their long axis,
  //    so a diagonal run occupies its own path and nothing else;
  //  · everything else keeps its box.
  const all = [];
  for (const e of clock.labelEntries) {
    if (MODULE.includes(e.name) || DEPARTING.includes(e.name)
      || e.name === 'Three-quarter plate' || e.name === 'pillars') continue;
    e.obj.traverse((o) => {
      if (!o.isMesh || o.userData.schematic || !o.geometry?.attributes?.position) return;
      const bb = new THREE.Box3().setFromObject(o, true);
      if (bb.isEmpty()) return;
      const name = `${e.name}/${o.name || o.geometry.type}`;
      let axis = null;
      for (let p = o; p; p = p.parent) if (p.userData && Number.isFinite(p.userData.r)) { axis = p.getWorldPosition(new THREE.Vector3()); break; }
      const w = bb.max.x - bb.min.x, h = bb.max.y - bb.min.y;
      if (axis) {
        const slice = (z0, z1, sb) => {
          const cx = (sb.min.x + sb.max.x) / 2, cy = (sb.min.y + sb.max.y) / 2;
          const r = Math.hypot(cx - axis.x, cy - axis.y) + Math.max(sb.max.x - sb.min.x, sb.max.y - sb.min.y) / 2;
          all.push({ unit: e.name, mesh: `${o.name || o.geometry.type}@${z0.toFixed(1)}`, disc: { x: axis.x, y: axis.y, r }, bb: { min: { x: axis.x - r, y: axis.y - r, z: z0 }, max: { x: axis.x + r, y: axis.y + r, z: z1 } } });
        };
        if (bb.max.z - bb.min.z > 1.5) {
          const pos = o.geometry.attributes.position;
          const v = new THREE.Vector3();
          const slices = new Map();
          for (let i = 0; i < pos.count; i += 2) {
            v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
            const k = Math.floor(v.z / 0.5);
            const s = slices.get(k) || { min: { x: 1e9, y: 1e9, z: 1e9 }, max: { x: -1e9, y: -1e9, z: -1e9 } };
            s.min.x = Math.min(s.min.x, v.x); s.max.x = Math.max(s.max.x, v.x);
            s.min.y = Math.min(s.min.y, v.y); s.max.y = Math.max(s.max.y, v.y);
            s.min.z = Math.min(s.min.z, v.z); s.max.z = Math.max(s.max.z, v.z);
            slices.set(k, s);
          }
          for (const s of slices.values()) slice(s.min.z, s.max.z, s);
        } else slice(bb.min.z, bb.max.z, bb);
        return;
      }
      // Slice along the longer axis whenever the box is long — a DIAGONAL
      // rod's box is not thin (a 45° run of 20 boxes as 14×14), so a
      // thinness test never fires on the meshes that need this most.
      // Slicing a compact solid is harmless: its buckets re-tile the box.
      if (Math.max(w, h) > 3) {
        const pos = o.geometry.attributes.position;
        const v = new THREE.Vector3();
        const alongX = w >= h;
        const slices = new Map();
        for (let i = 0; i < pos.count; i += 2) {
          v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
          const k = Math.floor((alongX ? v.x : v.y) / 1.5);
          const s = slices.get(k) || { min: { x: 1e9, y: 1e9, z: 1e9 }, max: { x: -1e9, y: -1e9, z: -1e9 } };
          s.min.x = Math.min(s.min.x, v.x); s.max.x = Math.max(s.max.x, v.x);
          s.min.y = Math.min(s.min.y, v.y); s.max.y = Math.max(s.max.y, v.y);
          s.min.z = Math.min(s.min.z, v.z); s.max.z = Math.max(s.max.z, v.z);
          slices.set(k, s);
        }
        for (const s of slices.values()) all.push({ unit: e.name, mesh: `${o.name || o.geometry.type}~`, bb: s });
        return;
      }
      all.push({ unit: e.name, mesh: o.name || o.geometry.type, bb });
    });
  }
  const N = 90, step = (2 * plateR) / N;
  const cellsOf = (b) => {
    const i0 = Math.max(0, Math.floor((b.min.x + plateR) / step)), i1 = Math.min(N - 1, Math.floor((b.max.x + plateR) / step));
    const j0 = Math.max(0, Math.floor((b.min.y + plateR) / step)), j1 = Math.min(N - 1, Math.floor((b.max.y + plateR) / step));
    const cells = [];
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) cells.push(j * N + i);
    return cells;
  };
  const drumB = (() => { const b = new THREE.Box3(); for (const r of meshesOf('Mainspring drum')) b.union(r.bb); return b; })();
  const setupB = (() => { const b = new THREE.Box3(); for (const r of meshesOf('Set-up work')) b.union(r.bb); return b; })();
  const chainB = (() => { const b = new THREE.Box3(); for (const r of meshesOf('Chain')) b.union(r.bb); return b; })();
  const drumC = { x: (drumB.min.x + drumB.max.x) / 2, y: (drumB.min.y + drumB.max.y) / 2 };
  const DRUM_CD = Math.hypot(drumC.x - P.barrel.x, drumC.y - P.barrel.y);
  const DRUM_R = Math.max(drumB.max.x - drumB.min.x, drumB.max.y - drumB.min.y) / 2;
  const SETUP_R = Math.max(setupB.max.x - setupB.min.x, setupB.max.y - setupB.min.y) / 2;
  const buildField = (drumAz) => {
    const field = new Array(N * N).fill(null);
    const put = (b, tag, disc) => {
      if (b.min.z > TQ_BOT - 1e-3 || b.max.z < 0) return;
      const z0 = Math.max(b.min.z, -1), z1 = Math.min(b.max.z, TQ_BOT);
      for (const c of cellsOf(b)) {
        if (disc) {
          const i = c % N, j = (c - i) / N;
          const px = -plateR + (i + 0.5) * step, py = -plateR + (j + 0.5) * step;
          if (Math.hypot(px - disc.x, py - disc.y) > disc.r + step * 0.71) continue;
        }
        (field[c] ||= []).push([z0, z1, tag]);
      }
    };
    for (const o of all) put(o.bb, `${o.unit}/${o.mesh}`, o.disc);
    // drumAz null = the drum does NOT depart: its real meshes stand where
    // they are. If the split fits with the module rotated away from the
    // drum's own sector, the §75 re-station stops being a prerequisite.
    if (drumAz === null) {
      for (const name of DEPARTING) for (const m of meshesOf(name)) put(m.bb, `${name}/${m.mesh}`);
      return field;
    }
    const a = drumAz * Math.PI / 180;
    const cx = P.barrel.x + Math.cos(a) * DRUM_CD, cy = P.barrel.y + Math.sin(a) * DRUM_CD;
    put({ min: { x: cx - DRUM_R, y: cy - DRUM_R, z: drumB.min.z }, max: { x: cx + DRUM_R, y: cy + DRUM_R, z: drumB.max.z } }, 'departed drum');
    put({ min: { x: cx - SETUP_R, y: cy - SETUP_R, z: 0 }, max: { x: cx + SETUP_R, y: cy + SETUP_R, z: Math.min(setupB.max.z, TQ_BOT) } }, 'departed set-up');
    for (let t = 0; t <= 1; t += 0.05) {
      const px = P.barrel.x + (cx - P.barrel.x) * t, py = P.barrel.y + (cy - P.barrel.y) * t;
      put({ min: { x: px - 1.2, y: py - 1.2, z: chainB.min.z }, max: { x: px + 1.2, y: py + 1.2, z: chainB.max.z } }, 'departed chain');
    }
    return field;
  };
  const overlaps = (ints, z0, z1) => {
    if (!ints) return null;
    for (const [a, b, tag] of ints) if (a < z1 + MARGIN && b > z0 - MARGIN) return tag;
    return null;
  };
  // a disc (centre, r, band) against the field; returns first blocking tag
  const discOk = (field, cx, cy, r, z0, z1) => {
    if (Math.hypot(cx, cy) + r > plateR - MARGIN) return 'the plate rim';
    const i0 = Math.max(0, Math.floor((cx - r + plateR) / step)), i1 = Math.min(N - 1, Math.floor((cx + r + plateR) / step));
    const j0 = Math.max(0, Math.floor((cy - r + plateR) / step)), j1 = Math.min(N - 1, Math.floor((cy + r + plateR) / step));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const px = -plateR + (i + 0.5) * step, py = -plateR + (j + 0.5) * step;
      if (Math.hypot(px - cx, py - cy) > r + step / 2) continue;
      const tag = overlaps(field[j * N + i], z0, z1);
      if (tag) return tag;
    }
    return null;
  };
  const corridorOk = (field, ax, ay, bx, by) => {
    const L = Math.hypot(bx - ax, by - ay);
    for (let t = 0; t <= 1; t += step / L) {
      const tag = discOk(field, ax + (bx - ax) * t, ay + (by - ay) * t, IDLER_HALF, WIND_BAND[0], WIND_BAND[1]);
      if (tag) return tag;
    }
    return null;
  };

  // --- The plate-top field: what the STAYING strike group must clear -------
  // The module's §33 rotation is a search variable (the strike station's
  // first run pinned it and the strike pinion landed inside the great
  // wheel's disc — R 29.0 against the wheel's 14.4 reach from the fusee at
  // 16.2, an overlap no bearing can fix). Rotating the module moves the
  // whole strike group on the plate TOP as well, so the top face gets its
  // own occupancy field and the staying members are judged against it.
  const topField = new Array(N * N).fill(null);
  for (const e of clock.labelEntries) {
    if (MODULE.includes(e.name) || DEPARTING.includes(e.name)
      || e.name === 'Three-quarter plate' || e.name === 'pillars') continue;
    e.obj.traverse((o) => {
      if (!o.isMesh || o.userData.schematic || !o.geometry?.attributes?.position) return;
      const bb = new THREE.Box3().setFromObject(o, true);
      if (bb.isEmpty() || bb.max.z < TQ_TOP + 0.01) return;
      for (const c of cellsOf(bb)) (topField[c] ||= []).push([Math.max(bb.min.z, TQ_TOP), bb.max.z, `${e.name}/${o.name || o.geometry.type}`]);
    });
  }
  // The staying strike-group footprints (z unchanged by the split): the
  // gong arc from its vertex cloud (its box overclaims by √2 — the
  // placement gate's lesson), everything else as its box corners, rotated
  // with the module about the movement centre.
  const STAY = ['Alarm gong', 'Alarm hammer', 'Alarm lock', 'Alarm switch'];
  const stayFoot = [];
  for (const name of STAY) {
    for (const m of meshesOf(name)) {
      if (m.bb.max.z < TQ_TOP + 0.01) continue; // below-plate switch/link members handled by the build's re-solve
      if (name === 'Alarm gong' && /Torus/.test(m.mesh)) {
        const o = (() => { let hit = null; clock.labelEntries.find((e) => e.name === name).obj.traverse((x) => { if (!hit && x.isMesh && /Torus/.test(x.geometry.type)) hit = x; }); return hit; })();
        const pos = o.geometry.attributes.position;
        const v = new THREE.Vector3();
        const pts = [];
        for (let i = 0; i < pos.count; i += 4) { v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); pts.push([v.x, v.y]); }
        stayFoot.push({ name: `${name}/${m.mesh}`, pts, z: [m.bb.min.z, m.bb.max.z] });
      } else {
        stayFoot.push({ name: `${name}/${m.mesh}`, corners: [[m.bb.min.x, m.bb.min.y], [m.bb.max.x, m.bb.min.y], [m.bb.max.x, m.bb.max.y], [m.bb.min.x, m.bb.max.y]], z: [m.bb.min.z, m.bb.max.z] });
      }
    }
  }
  // staying members of the striking wheel itself: cam + lock collar (the
  // stud becomes the bore arbor; its plate-top run needs no plan check)
  for (const m of swRows.filter((r) => r.mesh === 'alarmCam' || r.mesh === 'alarmLockCollar'))
    stayFoot.push({ name: `Alarm striking wheel/${m.mesh}`, corners: [[m.bb.min.x, m.bb.min.y], [m.bb.max.x, m.bb.min.y], [m.bb.max.x, m.bb.max.y], [m.bb.min.x, m.bb.max.y]], z: [m.bb.min.z, m.bb.max.z] });
  const rotPt = (p, c, s) => [p[0] * c - p[1] * s, p[0] * s + p[1] * c];
  const stayOk = (c, s) => {
    for (const fp of stayFoot) {
      const test = (x, y) => {
        // no rim test here: a rotation about the centre PRESERVES radius, so
        // every staying part keeps the rim relationship it was built with
        // (the pusher cap crosses the rim BY DESIGN, and a naive bound
        // refused 52/72 rotations on it). Only the searched bearings move
        // radially, and their discs carry the rim test.
        const i = Math.floor((x + plateR) / step), j = Math.floor((y + plateR) / step);
        if (i < 0 || i >= N || j < 0 || j >= N) return null;
        const tag = overlaps(topField[j * N + i], fp.z[0], fp.z[1]);
        return tag ? `${fp.name} vs ${tag}` : null;
      };
      if (fp.pts) {
        for (const p of fp.pts) { const r = rotPt(p, c, s); const t = test(r[0], r[1]); if (t) return t; }
      } else {
        // box: corners + edge midpoints + centre — coarse but the top face
        // is nearly empty, so a hit means a real occupant, not a raster gap
        const q = fp.corners.map((p) => rotPt(p, c, s));
        const samples = [...q, ...q.map((p, i) => [(p[0] + q[(i + 1) % 4][0]) / 2, (p[1] + q[(i + 1) % 4][1]) / 2]),
          [q.reduce((a, p) => a + p[0], 0) / 4, q.reduce((a, p) => a + p[1], 0) / 4]];
        for (const p of samples) { const t = test(p[0], p[1]); if (t) return t; }
      }
    }
    return null;
  };

  // --- The search ----------------------------------------------------------
  const D = (d) => discs.find((x) => x.name === d);
  // for the pair checks: the widest dropped strike member in the band it
  // actually occupies (the 64T wheel)
  const govWheel = swDiscs.reduce((a, b) => (b.r > a.r ? b : a));
  for (const drumAz of [null, 45, 51, 56]) {
    const field = buildField(drumAz);
    const results = [];
    // 1° near the identity (the build prefers the smallest module move —
    // the §35 link and the §68 lock sweep both rode the rigid rotation),
    // 5° elsewhere.
    const MDEGS = [...new Set([...Array.from({ length: 51 }, (_, i) => (335 + i) % 360),
      ...Array.from({ length: 72 }, (_, i) => i * 5)])].sort((a, b) => a - b);
    for (const mdeg of MDEGS) {
      const mc = Math.cos(mdeg * Math.PI / 180), ms = Math.sin(mdeg * Math.PI / 180);
      const swR = { x: sw.x * mc - sw.y * ms, y: sw.x * ms + sw.y * mc };
      // the staying strike group on the plate top
      const topBlock = stayOk(mc, ms);
      if (topBlock) { results.push({ mdeg, verdict: `top: ${topBlock}` }); continue; }
      // the strike arbor's own dropped members at the rotated station
      let fixedBlock = null;
      for (const d of swDiscs) {
        const t = discOk(field, swR.x, swR.y, d.r, d.z[0], d.z[1]);
        if (t) { fixedBlock = `${d.name} vs ${t}`; break; }
      }
      if (fixedBlock) { results.push({ mdeg, verdict: `below: ${fixedBlock}` }); continue; }
      results.push({ mdeg, verdict: 'OPEN', swR });
    }
    const open = results.filter((r) => r.verdict === 'OPEN');
    out.push(`=== drum at ${drumAz}: ${open.length}/72 module rotations pass the fixed-station and plate-top gates ===`);
    // rot 0 is the BUILT configuration — its verdict is always the headline
    out.push(`  rot 0 (as built): ${results.find((r) => r.mdeg === 0).verdict}`);
    if (!open.length) {
      const hist = new Map();
      for (const r of results) { const k = r.verdict.replace(/ at \(.*/, ''); hist.set(k, (hist.get(k) || 0) + 1); }
      for (const [k, n] of [...hist].sort((a, b) => b[1] - a[1]).slice(0, 8)) out.push(`  ${String(n).padStart(3)}/72: ${k}`);
      continue;
    }
    // The bearing search, per open rotation, NEAREST TO TODAY first — the
    // link/pusher corridor (§35, world-frame, does not rotate) re-solves in
    // the build and favours the smallest module rotation, so the seed the
    // gate hands over is the closest feasible one, not just any.
    const sep = (x1, y1, r1, z1, x2, y2, r2, z2) =>
      (z1[0] < z2[1] + MARGIN && z1[1] > z2[0] - MARGIN)
        ? Math.hypot(x1 - x2, y1 - y2) - r1 - r2 - MARGIN : Infinity;
    const searchAt = (swR) => {
      const okB = [], okG = [];
      for (let deg = 0; deg < 360; deg += 2) {
        const a = deg * Math.PI / 180;
        {
          const bx = swR.x + Math.cos(a) * CD_B, by = swR.y + Math.sin(a) * CD_B;
          const cx = bx + clkOff.x, cy = by + clkOff.y;
          const t1 = discOk(field, bx, by, D('barrel wall').r, ...D('barrel wall').z)
            || discOk(field, bx, by, D('barrel body').r, ...D('barrel body').z)
            || discOk(field, bx, by, D('barrel wind wheel').r, ...D('barrel wind wheel').z)
            || discOk(field, bx, by, D('barrel ratchet').r, ...D('barrel ratchet').z)
            || discOk(field, bx, by, STUD_R, 0, Z_BODY[1])
            || discOk(field, cx, cy, D('click').r, ...D('click').z)
            || discOk(field, cx, cy, STUD_R, 0, Z_RAT[1])
            || corridorOk(field, climbSt.x, climbSt.y, bx, by);
          if (!t1) okB.push({ deg, bx, by, cx, cy });
        }
        {
          const gx = swR.x + Math.cos(a) * CD_G, gy = swR.y + Math.sin(a) * CD_G;
          if (!discOk(field, gx, gy, D('governor saw').r, ...D('governor saw').z)
            && !discOk(field, gx, gy, D('governor pinion+arbor').r, ...D('governor pinion+arbor').z)
            && !discOk(field, gx, gy, STUD_R, 0, D('governor saw').z[1])) okG.push({ deg, gx, gy });
        }
      }
      let best = null, count = 0;
      for (const g of okG) for (let adeg = 0; adeg < 360; adeg += 2) {
        const aa = adeg * Math.PI / 180;
        const ax = g.gx + Math.cos(aa) * D_A, ay = g.gy + Math.sin(aa) * D_A;
        if (discOk(field, ax, ay, D('anchor pallets').r, ...D('anchor pallets').z)
          || discOk(field, ax, ay, D('anchor ring').r, ...D('anchor ring').z)
          || discOk(field, ax, ay, D('anchor arbor col').r, ...D('anchor arbor col').z)
          || discOk(field, ax, ay, STUD_R, 0, D('anchor pallets').z[1])) continue;
        // the arbor column against the fixed wheel's swept disc
        if (sep(ax, ay, D('anchor arbor col').r, D('anchor arbor col').z, swR.x, swR.y, govWheel.r, govWheel.z) < 0) continue;
        // the ring at the floor vs the winding/ratchet floor discs is a pair
        // check below; vs the fixed gov wheel: bands differ, plan free
        for (const b of okB) {
          let worst = Infinity;
          const pairs = [
            ['barrel wall', b.bx, b.by, 'governor saw', g.gx, g.gy],
            ['barrel body', b.bx, b.by, 'governor saw', g.gx, g.gy],
            ['barrel wall', b.bx, b.by, 'anchor pallets', ax, ay],
            ['barrel body', b.bx, b.by, 'anchor pallets', ax, ay],
            ['barrel wind wheel', b.bx, b.by, 'anchor ring', ax, ay],
            ['barrel ratchet', b.bx, b.by, 'anchor ring', ax, ay],
            ['click', b.cx, b.cy, 'anchor ring', ax, ay],
            ['click', b.cx, b.cy, 'governor pinion+arbor', g.gx, g.gy],
            ['barrel wall', b.bx, b.by, 'anchor arbor col', ax, ay],
            ['barrel body', b.bx, b.by, 'anchor arbor col', ax, ay],
            ['click', b.cx, b.cy, 'anchor arbor col', ax, ay],
          ];
          for (const [n1, x1, y1, n2, x2, y2] of pairs)
            worst = Math.min(worst, sep(x1, y1, D(n1).r, D(n1).z, x2, y2, D(n2).r, D(n2).z));
          // the moved discs against the FIXED station's wheel: the wall and
          // body bands sit above the wheel's, so only same-band floor/wheel
          // members are judged — the wheel vs the ratchet+wind floor discs
          worst = Math.min(worst, sep(b.bx, b.by, D('barrel wind wheel').r, D('barrel wind wheel').z, swR.x, swR.y, govWheel.r, govWheel.z));
          worst = Math.min(worst, sep(b.bx, b.by, D('barrel ratchet').r, D('barrel ratchet').z, swR.x, swR.y, govWheel.r, govWheel.z));
          worst = Math.min(worst, sep(b.cx, b.cy, D('click').r, D('click').z, swR.x, swR.y, govWheel.r, govWheel.z));
          worst = Math.min(worst, sep(ax, ay, D('anchor ring').r, D('anchor ring').z, swR.x, swR.y, govWheel.r, govWheel.z));
          if (worst < 0) continue;
          count++;
          if (!best || worst > best.worst) best = { thB: b.deg, thG: g.deg, thA: adeg, worst };
        }
      }
      return { okB: okB.length, okG: okG.length, count, best };
    };
    open.sort((a, b) => Math.min(a.mdeg, 360 - a.mdeg) - Math.min(b.mdeg, 360 - b.mdeg));
    let found = null, feasibles = 0;
    for (const r of open) {
      const s = searchAt(r.swR);
      if (s.count) {
        out.push(`  module rot ${r.mdeg}°: ${s.count} triples, best (θ_b ${s.best.thB}°, θ_g ${s.best.thG}°, θ_a ${s.best.thA}°) spare ${f(s.best.worst)}`);
        if (!found || s.best.worst > found.best.worst) found = { ...r, ...s };
        if (++feasibles >= 24) break;
        continue;
      }
      out.push(`  module rot ${r.mdeg}°: station clear but no bearing triple (barrel ${s.okB}/180, governor ${s.okG}/180 clear singly)`);
      if (!s.okB) {
        // why the barrel never lands: first blocker every 30°
        for (let deg = 0; deg < 360; deg += 30) {
          const a = deg * Math.PI / 180;
          const bx = r.swR.x + Math.cos(a) * CD_B, by = r.swR.y + Math.sin(a) * CD_B;
          const t = discOk(field, bx, by, D('barrel wall').r, ...D('barrel wall').z)
            || discOk(field, bx, by, D('barrel body').r, ...D('barrel body').z)
            || discOk(field, bx, by, D('barrel wind wheel').r, ...D('barrel wind wheel').z)
            || discOk(field, bx, by, D('barrel ratchet').r, ...D('barrel ratchet').z)
            || discOk(field, bx + clkOff.x, by + clkOff.y, D('click').r, ...D('click').z)
            || corridorOk(field, climbSt.x, climbSt.y, bx, by);
          out.push(`      θ_b ${String(deg).padStart(3)}: ${t || 'clear?'}`);
        }
      }
    }
    out.push(found
      ? `  FEASIBLE at module rot ${found.mdeg}° (station (${f(found.swR.x)}, ${f(found.swR.y)})): ${found.count} bearing triples; best (θ_b ${found.best.thB}°, θ_g ${found.best.thG}°, θ_a ${found.best.thA}°) with ${f(found.best.worst)} spare beyond every margin`
      : `  REFUSED: ${open.length} rotations pass the fixed gates but no bearing triple clears anywhere`);
  }
  return out;
});
console.log(res.join('\n'));
await browser.close();
srv.kill();
