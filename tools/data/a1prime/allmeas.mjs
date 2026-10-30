import { readFileSync } from 'node:fs';
import { loadPack } from '../gt/tools/technic-pack.mjs';
import * as DB from '../gt/src/technic-deadbeat.js';
import * as D from '../gt/src/technic-drive.js';
import * as T from '../gt/src/technic-train.js';
import { solveFusee, TECHNIC_FUSEE_SPRING } from '../gt/src/technic-fusee.js';
const lib = loadPack(), deg = (d) => d * Math.PI / 180, toDeg = (r) => r * 180 / Math.PI;
const WK = Number(process.argv[2]), NW = Number(process.argv[3]);
import { existsSync } from 'node:fs';
const done = new Set(); for (const f of ['am-0.log', 'am-1.log', 'am-2.log', 'am2-0.log', 'am2-1.log', 'am2-2.log', 'am3-0.log', 'am3-1.log', 'am3-2.log']) if (existsSync(f)) for (const l of readFileSync(f, 'utf8').split('\n')) { const m = /"i":(\d+)/.exec(l); if (m) done.add(Number(m[1])); }
const cases = []; const seen = new Set();
for (const f of ['a1p--32-12.log', 'a1p--88.log', 'a1p-1232.log']) for (const l of readFileSync(f, 'utf8').split('\n')) if (l.startsWith('ESCAPES ')) { const c = JSON.parse(l.slice(8)); const k = JSON.stringify([c.W, c.n, c.sense, c.pallets.map((p) => [p[0], p[1], p[2].toFixed(1), p[3]])]); if (seen.has(k)) continue; seen.add(k); cases.push(c); }
const run = solveFusee(TECHNIC_FUSEE_SPRING).best, F = D.TECHNIC_DRIVE_FRICTION;
const f = T.frameTrain('technic_classic'), dyn = D.balanceDynamics(lib, f.escapement.ef, { nutV: D.TECHNIC_DRIVE.nutV });
const tHi = D.TECHNIC_DRIVE.escapeTorqueHi / D.NMM, Munit = D.barrelScale(tHi, run, 2250, 7, F.mesh.nominal);
const tauOf = (c) => D.torqueBand(run, { Munit, etaMesh: F.mesh[c], meshes: 7, ratio: 2250 }).mean;
cases.forEach((c, i) => {
  if (done.has(i) || i % NW !== WK) return;
  const spec = { wheelPart: '3647', teeth: 8, W: c.W, sense: c.sense, pallets: c.pallets.map(([part, at, a, flip]) => ({ part, at, angle: deg(a), flip, centre: DB.DEADBEAT_PALLETS[part].centre, normal: DB.DEADBEAT_PALLETS[part].normal })) };
  const m = DB.deadbeatModel(lib, spec), ts = DB.tableSwingOf(m);
  if (!ts) return;
  const ct = D.contactTables(lib, null, { A: ts.A, n: Math.round(ts.A * 200), model: m });
  if (!ct.ok) return;
  const S = (pc, mc) => D.sustained({ ...dyn, ct, tau: tauOf(mc), eta: F.pallet[pc], A0: ts.from + 0.5 });
  const adv = S('adverse', 'adverse'), nom = S('nominal', 'nominal'), fav = S('favourable', 'favourable'), b1 = S('favourable', 'adverse'), b2 = S('adverse', 'favourable');
  const all = [adv, nom, fav, b1, b2], ok = all.every((s) => s.status === 'sustained');
  const rate = (s) => (1 - s.T / nom.T) * 86400;
  const rel = toDeg(ct.release);
  const out = { i, W: c.W, n: c.n, sense: c.sense, pallets: c.pallets, table: ts.A, from: ts.from, release: +rel.toFixed(2), status: all.map((s) => s.status[0]).join('') };
  if (ok) Object.assign(out, { swings: [adv.A, nom.A, fav.A].map((x) => +x.toFixed(2)), below: +(Math.min(adv.Amin, b2.Amin) - rel).toFixed(3), above: +(ts.A - Math.max(fav.Amax, b1.Amax)).toFixed(3), matched: +(Math.max(...[adv, nom, fav].map(rate)) - Math.min(...[adv, nom, fav].map(rate))).toFixed(0), box: +(Math.max(...all.map(rate)) - Math.min(...all.map(rate))).toFixed(0) });
  console.log(JSON.stringify(out));
});
