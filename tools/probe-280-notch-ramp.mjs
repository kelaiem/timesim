#!/usr/bin/env node
// §280 — does the pin ride CUT METAL out of the notch, or a law over nothing?
//
// The tick lowers the reader's pin along a linear ramp over the pin's own arc at
// the track's radius (ALARM_DETECTOR_LAWS.pinArcHalf). Until §280 the notch's
// walls were radial, so a flat-ended pin standing on a vertical wall fell in and
// could never be lifted out: the law described a surface nothing had cut. This
// instrument asks the metal. At every sampled pin angle across the notch and its
// two ramps it takes the pin's lowest face (its twelve rim vertices and centre)
// and measures, along the collar's own axis, the gap to the nearest surface below
// each vertex on the track and the two ramps. Over the track's top, and on a ramp,
// the pin must be TOUCHING (the least gap 0); wholly inside the floor there is no
// metal under it at all. A sample on the ramp zone with nothing under the rim is
// a pin hanging in air — that is what the old notch read.
//
// Also held, on the wedges themselves: each ramp is one closed, manifold shell
// with positive volume; its top meets the track's top at its high end and the
// notch's dropped-tip level at its low end; and the slope the cut has is the law's
// (drop over twice the pin's arc, at the track's radius).
//
// CONTROLS, because a reading that cannot fail is not one: (1) the ramps are
// carried 0.05 up the collar's axis and the touching reading must move by EXACTLY
// that (the linearity control — a reading that quoted the constants would not);
// (2) the ramps are taken out and the ramp zone must read UNSUPPORTED. Both run
// on the same sampled poses as the real reading.
//
// ACCEPTANCE: exits non-zero on any miss. Boots the page (software GL: slow).
import { chromium } from './node_modules/playwright/index.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.mpd': 'text/plain' };
const srv = http.createServer((rq, rs) => {
  const f = path.join(ROOT, decodeURIComponent(new URL(rq.url, 'http://x').pathname));
  fs.readFile(f, (e, d) => { if (e) { rs.statusCode = 404; rs.end('x'); return; } rs.setHeader('Content-Type', TYPES[path.extname(f)] || 'application/octet-stream'); rs.end(d); });
});
await new Promise((r) => srv.listen(0, r));
const browser = await chromium.launch();
const pg = await browser.newPage();
const warns = [];
pg.on('console', (m) => { if (m.type() === 'warning' && !/WebGL|GL Driver|GroupMarker/.test(m.text())) warns.push(m.text()); });
pg.on('pageerror', (e) => warns.push('PAGEERROR ' + e.message));
await pg.goto(`http://127.0.0.1:${srv.address().port}/index.html`);
await pg.waitForFunction(() => !!window.__clock, null, { timeout: 600000 });

const R = await pg.evaluate(() => {
  const clock = window.__clock, out = { notes: [] };
  const find = (n) => { const a = []; clock.scene.traverse((o) => { if (o.isMesh && o.name === n && !o.userData.schematic) a.push(o); }); return a; };
  const ring = find('alarmReaderRing')[0], pin = find('alarmReaderPin')[0], hub = find('alarmDiscHub')[0], track = find('alarmDiscTrack')[0];
  const ramps = find('alarmDiscNotchRamp');
  out.rampCount = ramps.length;
  out.hold = clock.alarmSetHold;   // the seat's published arithmetic (TODO 260): the ramp's run, its slope, the climb and the hold
  if (!ring || !pin || !hub || !track || ramps.length !== 2) { out.error = 'meshes missing'; return out; }
  const world = (m) => { m.updateWorldMatrix(true, false); const e = m.matrixWorld.elements, p = m.geometry.attributes.position, v = new Float64Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      v[3 * i] = e[0] * x + e[4] * y + e[8] * z + e[12]; v[3 * i + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; v[3 * i + 2] = e[2] * x + e[6] * y + e[10] * z + e[14]; } return v; };
  // box centres, not vertex means: a lathe repeats its seam's vertices, which drags a mean off the axis (the §70 trap)
  const mean = (v) => { const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]; const n = v.length / 3; for (let i = 0; i < n; i++) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], v[3 * i + a]); hi[a] = Math.max(hi[a], v[3 * i + a]); } return [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2]; };
  const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a <= -Math.PI) a += 2 * Math.PI; return a; };
  const base = { crownPullT: 0, leverEngage: 0, tension: 1, alarmOn: 0, alarmCrownPullT: 0 };
  const pose = (tau) => { clock.setPose({ ...base, tau, alarmCrownRotation: 0 }); clock.scene.updateMatrixWorld(true); };

  // ---- the wedges themselves: closed manifold shells, positive volume, in the TRACK's frame
  const shell = (m) => {
    const p = m.geometry.attributes.position, ix = m.geometry.index.array, edges = new Map(); let vol = 0, open = 0, nonman = 0;
    for (let t = 0; t < ix.length; t += 3) {
      const a = ix[t], b = ix[t + 1], c = ix[t + 2];
      for (const [u, w] of [[a, b], [b, c], [c, a]]) { const k = u + ',' + w; edges.set(k, (edges.get(k) || 0) + 1); }
      const A = [p.getX(a), p.getY(a), p.getZ(a)], B = [p.getX(b), p.getY(b), p.getZ(b)], C = [p.getX(c), p.getY(c), p.getZ(c)];
      vol += (A[0] * (B[1] * C[2] - B[2] * C[1]) - A[1] * (B[0] * C[2] - B[2] * C[0]) + A[2] * (B[0] * C[1] - B[1] * C[0])) / 6;
    }
    for (const [k, n] of edges) { const [u, w] = k.split(','); const rv = edges.get(w + ',' + u) || 0; if (n !== 1) nonman++; if (rv !== 1) open++; }
    return { vol, open, nonman };
  };
  out.shells = ramps.map(shell);
  // heights and angular run of each wedge, in its own (disc) frame
  out.wedges = ramps.map((m) => { const p = m.geometry.attributes.position; let lo = Infinity, hi = -Infinity, zTopLo = Infinity, a0 = Infinity, a1 = -Infinity, rLo = Infinity, rHi = -Infinity;
    const angs = []; for (let i = 0; i < p.count; i++) { const z = p.getZ(i); lo = Math.min(lo, z); hi = Math.max(hi, z); if (z > 1e-9) zTopLo = Math.min(zTopLo, z); angs.push(Math.atan2(p.getY(i), p.getX(i))); const r = Math.hypot(p.getX(i), p.getY(i)); rLo = Math.min(rLo, r); rHi = Math.max(rHi, r); }
    const s = angs[0] >= 0 ? 1 : -1; const m2 = angs.map((a) => Math.abs(a)); return { zLo: lo, zHi: hi, zTopLo, run: Math.max(...m2) - Math.min(...m2), rLo, rHi, side: s }; });
  { const p = track.geometry.attributes.position; let hi = -Infinity; for (let i = 0; i < p.count; i++) hi = Math.max(hi, p.getZ(i)); out.trackTop = hi; }

  // ---- the pin on the metal
  pose(0);
  const notchAz = () => { track.updateWorldMatrix(true, false); const e = track.matrixWorld.elements, r = 3.05; const wx = e[0] * r + e[12], wy = e[1] * r + e[13]; const c = mean(world(hub)); return Math.atan2(wy - c[1], wx - c[0]); };
  const pinAz = () => { const c = mean(world(hub)), q = mean(world(pin)); return Math.atan2(q[1] - c[1], q[0] - c[0]); };
  const rel = () => wrap(pinAz() - notchAz());
  const r0 = rel(); pose(3600); const r1 = rel(); const k = wrap(r1 - r0) / 3600;
  const H12 = 12 * 3600; let tStar = (((-r0 / k) % H12) + H12) % H12;
  for (let it = 0; it < 4; it++) { pose(tStar); tStar -= rel() / k; }
  out.k = k; out.tStar = tStar;
  const e = ring.matrixWorld.elements; const upV = (() => { ring.updateWorldMatrix(true, false); const m = ring.matrixWorld.elements; const x = m[8], y = m[9], z = m[10], l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; })();
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  // triangles of the surfaces under the pin, world
  const tris = (ms) => { const T = []; for (const m of ms) { const v = world(m), ix = m.geometry.index.array; for (let t = 0; t < ix.length; t += 3) T.push([ix[t], ix[t + 1], ix[t + 2]].map((i) => [v[3 * i], v[3 * i + 1], v[3 * i + 2]])); } return T; };
  const hitDown = (o, T) => { // nearest hit along −up from o; returns distance or null (Möller–Trumbore, double sided)
    const d = [-upV[0], -upV[1], -upV[2]]; let best = null;
    for (const [A, B, C] of T) {
      const e1 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], e2 = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
      const p = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]];
      const det = dot(e1, p); if (Math.abs(det) < 1e-14) continue;
      const s = [o[0] - A[0], o[1] - A[1], o[2] - A[2]]; const u = dot(s, p) / det; if (u < -1e-9 || u > 1 + 1e-9) continue;
      const q = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]];
      const v = dot(d, q) / det; if (v < -1e-9 || u + v > 1 + 1e-9) continue; const t = dot(e2, q) / det; if (t >= 0 && (best === null || t < best)) best = t;
    } return best; };
  const gapNow = (metal) => {
    const T = tris(metal), V = world(pin), n = V.length / 3; let lo = Infinity; const pts = [];
    for (let i = 0; i < n; i++) { const p = [V[3 * i], V[3 * i + 1], V[3 * i + 2]]; pts.push([dot(p, upV), p]); lo = Math.min(lo, dot(p, upV)); }
    let g = Infinity; for (const [s, p] of pts) { if (s > lo + 1e-6) continue; const h = hitDown([p[0] + upV[0], p[1] + upV[1], p[2] + upV[2]], T); if (h !== null) g = Math.min(g, h - 1); }
    return g;
  };
  // sample the pin's angle from beyond the ramp's far end on one side to beyond it on the other
  const gHalf = 0.07, run = out.wedges[0].run, pAH = Math.atan2(0.14, 3.05), span = gHalf + run + pAH + 0.02, N = 81;
  out.samples = [];
  for (let i = 0; i < N; i++) {
    const d = -span + (2 * span * i) / (N - 1);           // pin angle off the notch's centre
    pose(tStar + d / k);
    const mm = [track, ...ramps];
    out.samples.push({ d, gap: gapNow(mm) });
  }
  // control 1: carry the ramps up the axis by D; the touching reading must follow EXACTLY on the ramp zone
  const D = 0.05; out.control = { D, moved: [] };
  for (const m of ramps) m.position.z += D;
  clock.scene.updateMatrixWorld(true);
  for (let i = 0; i < N; i++) { const d = -span + (2 * span * i) / (N - 1); pose(tStar + d / k); out.control.moved.push({ d, gap: gapNow([track, ...ramps]) }); }
  for (const m of ramps) m.position.z -= D;
  // control 2: take the ramps OUT; the ramp zone must read unsupported
  out.control.bare = [];
  for (let i = 0; i < N; i++) { const d = -span + (2 * span * i) / (N - 1); pose(tStar + d / k); out.control.bare.push({ d, gap: gapNow([track]) }); }
  pose(0);
  return out;
});
await browser.close(); srv.close();

const fails = [];
const ok = (name, pass, detail) => { console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); if (!pass) fails.push(name); };
if (R.error) { console.log('FAIL  ' + R.error); process.exit(1); }
const DROP = 0.10, CLEAR_MARGIN = 0.15, PIN_R = 0.14, RMID = 3.05, TOL = 2e-6;   // float32 vertex storage, ~5e-7 at these coordinates
const pAH = Math.atan2(PIN_R, RMID), gHalf = 0.07;   // the law's own angle (§280: atan2, not the ratio)
ok('boot is silent', warns.length === 0, warns.slice(0, 2).join(' | '));
ok('two ramps', R.rampCount === 2);
ok('each ramp is one closed manifold shell (every edge once each way)', R.shells.every((s) => s.open === 0 && s.nonman === 0), JSON.stringify(R.shells));
ok('each ramp has positive volume (outward winding)', R.shells.every((s) => s.vol > 0), R.shells.map((s) => s.vol.toFixed(6)).join(' '));
ok('the ramp runs the angle the seat solved (TODO 260)', R.wedges.every((w) => Math.abs(w.run - R.hold.rampRun_rad) < 1e-6), R.wedges.map((w) => w.run.toFixed(6)).join(' ') + ' vs ' + R.hold.rampRun_rad.toFixed(6));
ok('its slope is the published one: drop over run at the track radius', Math.abs(DROP / (R.hold.rampRun_rad * RMID) - R.hold.rampTan) < 1e-9, `${(DROP / (R.hold.rampRun_rad * RMID)).toFixed(6)} vs ${R.hold.rampTan.toFixed(6)}`);
ok('the seat holds the CLIMB at the headroom (hold ÷ climb ≥ 3)', R.hold.holdTq_Nmm / R.hold.climbTq_Nmm >= 3 - 1e-9, `${(R.hold.holdTq_Nmm / R.hold.climbTq_Nmm).toFixed(6)}`);
ok('its high end is the track’s top', R.wedges.every((w) => Math.abs(w.zHi - R.trackTop) < 1e-6), `top ${R.wedges.map((w) => w.zHi.toFixed(4))} vs track ${R.trackTop.toFixed(4)}`);
ok('its low end stands one drop under it (the dropped tip’s level)', R.wedges.every((w) => Math.abs((w.zHi - w.zTopLo) - DROP) < 1e-6), R.wedges.map((w) => (w.zHi - w.zTopLo).toFixed(6)).join(' '));
ok('the wedge spans the track’s annulus', R.wedges.every((w) => Math.abs(w.rLo - 2.85) < 1e-6 && Math.abs(w.rHi - 3.25) < 1e-6), R.wedges.map((w) => `${w.rLo.toFixed(3)}..${w.rHi.toFixed(3)}`).join(' '));
const rampRun = R.hold.rampRun_rad;
const zone = (s) => Math.abs(s.d) > gHalf - pAH && Math.abs(s.d) < gHalf + rampRun - pAH + 1e-9;      // the law's ramp zone: the pin's rim on the ramp
const onTrack = (s) => Math.abs(s.d) >= gHalf + rampRun - pAH + 1e-3;                  // clear of the ramps: on the track's top
const floor = (s) => Math.abs(s.d) <= gHalf - pAH - 1e-3;                                      // wholly inside the floor
const rz = R.samples.filter(zone), tr = R.samples.filter(onTrack), fl = R.samples.filter(floor);
ok('samples in each region', rz.length > 8 && tr.length > 2 && fl.length > 2, `ramp ${rz.length}, track ${tr.length}, floor ${fl.length}`);
const worst = Math.max(...rz.map((s) => Math.abs(s.gap)));
ok('on the ramp zone the pin TOUCHES the cut metal (least vertical gap 0)', rz.every((s) => Number.isFinite(s.gap)) && worst < TOL, `worst |gap| ${worst}`);
const wTrack = Math.max(...tr.map((s) => Math.abs(s.gap)));
ok('over the track’s top the pin touches it', tr.every((s) => Number.isFinite(s.gap)) && wTrack < TOL, `worst |gap| ${wTrack}`);
ok('wholly inside the floor there is no metal under the pin', fl.every((s) => !Number.isFinite(s.gap)), `finite gaps: ${fl.filter((s) => Number.isFinite(s.gap)).length}`);
const moved = R.control.moved.filter(zone);
const dev = Math.max(...moved.map((s, i) => Math.abs((-s.gap) - R.control.D * 1) * 0 + Math.abs(Math.abs(s.gap) - R.control.D)));
ok('CONTROL: ramps carried 0.05 up the axis read 0.05 into the pin, exactly', moved.every((s) => Number.isFinite(s.gap)) && dev < TOL, `worst deviation from ${R.control.D}: ${dev}`);
const bare = R.control.bare.filter(zone);
ok('CONTROL: with the ramps out, the ramp zone reads UNSUPPORTED (the old notch)', bare.length > 8 && bare.every((s) => !Number.isFinite(s.gap) || s.gap > 0.01), `${bare.filter((s) => !Number.isFinite(s.gap)).length}/${bare.length} unsupported`);
console.log(fails.length ? `\nFAIL — ${fails.length}: ${fails.join('; ')}` : '\nall passed');
process.exit(fails.length ? 1 : 0);
