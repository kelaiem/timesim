// §339 — THE SECOND BARREL'S SEAT LAW, one copy for the probes that read it (tools/probe-339-second-barrel.mjs, the
// report over every radius, and tools/probe-339-parallel-barrel.mjs, the acceptance of the declared PARALLEL_BARREL).
// Pure: it reads one boot's room record (tools/probe-twin-barrel-room.mjs' EXPR, with the bands [span, coupling band]
// set on __roomGrid) and the fusee's wind record, and places nothing.
//
// Drum A stands where the build stands it (main.js' law: FUSEE_R_LARGE + R + DRUM_GAP_U along drumDir); `centreOff`
// is its distance from the build's own drum centre, which a caller holds at float noise. A seat of barrel B is a
// centre on its mesh circle about A (r_pA + R, every 0.5°) where
//   - B's wall clears the drum band's field with the drum group removed (one CLEAR_MARGIN already taken off) and its
//     tooth tips (R + m) clear the coupling band's field;
//   - B's wall clears the chain's span on BOTH open-belt tangents (a seat whichever way the chain runs), by the margin.
// Moving parts are read at rest, so a seat is a CANDIDATE for the fold's sweeps, not a placement.
import { DRUM_GAP_U } from '../src/twin-barrel.js';
import { CLEAR_MARGIN } from '../src/layout.js';

const mk = (G) => (x, y) => { const i = Math.round((x - G.bx0) / G.res), j = Math.round((y - G.by0) / G.res);
  return i < 0 || j < 0 || i >= G.nx || j >= G.ny ? -Infinity : G.r[j * G.nx + i]; };
const segD = (px, py, a, b) => { const vx = b.x - a.x, vy = b.y - a.y, L2 = vx * vx + vy * vy, t = Math.max(0, Math.min(1, ((px - a.x) * vx + (py - a.y) * vy) / L2));
  return Math.hypot(px - a.x - t * vx, py - a.y - t * vy); };
// THE BOOTS the seat law reads: the reference record off the round default (the ribbon, its wind angles, the fusee's
// wind record), and per target the room (the drum band's field, the span's band and the coupling band) and the
// fitted case's own inputs when the build is a form case.
export const FLANGE = [2.93, 4.26];   // landing 0 (c): the band clear of the chain on today's drum
export const REF_EXPR = `(() => { const g = window.__clock.equalisation.going;
  return { k: g.k_Nm_per_rad, wind: g.windRangeRad, section: g.section, devLen: g.devLen_u, packing: g.packing, fw: window.__clock.fuseeWind }; })()`;
export const bootExpr = (roomExpr) => `({ room: (() => { const I = window.__clock.fuseeWind.inputs, ce = window.__clock.fuseeWind.chainEndROut, CM = ${CLEAR_MARGIN};
    window.__roomGrid = { bands: [[I.FUSEE_Z0 - ce - CM, I.COIL_TOP + ce + CM], [${FLANGE[0]} - CM, ${FLANGE[1]} + CM]] };
    return ${roomExpr}; })(),
  fit: (() => { const c = window.__clock, F = c.formFootprint; if (!F || !F.fitted) return null;
    return { units: Object.fromEntries(Object.entries(c.regions.units).map(([k, v]) => [k, v.hull])),
      centre: F.fitted.centre, flatMin: F.fitted.flatMin, fitAreaMm2: F.fitAreaMm2 }; })() })`;
export function seatField({ room, fw, RA, rpA }) {
  const Rr = room.reach, fus = Rr.fuseeCentre, dir = Rr.drumDir, ce = fw.chainEndROut, RL = fw.fuseeRLarge, CM = CLEAR_MARGIN;
  const F0 = mk(room.free.withoutDrumGroup.grid), F2 = mk(room.free.bands[1].grid);
  const dA = RL + RA + DRUM_GAP_U, Ac = { x: fus[0] + dA * dir[0], y: fus[1] + dA * dir[1] };
  const centreOff = Math.hypot(Ac.x - Rr.drumCentre[0], Ac.y - Rr.drumCentre[1]);
  const T = [1, -1].map((sg) => { const r1 = RL, r2 = RA + ce, dx = Ac.x - fus[0], dy = Ac.y - fus[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, a = Math.acos((r1 - r2) / L);
    const cs = Math.cos(sg * a), sn = Math.sin(sg * a), nx = ux * cs - uy * sn, ny = uy * cs + ux * sn;
    return [{ x: fus[0] + nx * r1, y: fus[1] + ny * r1 }, { x: Ac.x + nx * r2, y: Ac.y + ny * r2 }]; });
  // the margin of B (radius R, module m) with its centre at azimuth `az` degrees round A: negative is no seat
  const marginAt = (R, m, az) => { const ph = (az * Math.PI) / 180, B = { x: Ac.x + (rpA + R) * Math.cos(ph), y: Ac.y + (rpA + R) * Math.sin(ph) };
    const mB = Math.min(F0(B.x, B.y) - R, F2(B.x, B.y) - (R + m));
    const span = Math.min(...T.map((g) => segD(B.x, B.y, ...g) - ce - R - CM));
    return { az, B, margin: Math.min(mB, span) }; };
  const seatsAt = (R, m) => { const out = [];
    for (let k = 0; k < 720; k++) { const s = marginAt(R, m, k / 2); if (s.margin >= 0) out.push(s); }
    return out; };
  return { Ac, centreOff, T, marginAt, seatsAt };
}
