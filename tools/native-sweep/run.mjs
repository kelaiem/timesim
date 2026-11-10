#!/usr/bin/env node
// §338 landing 12 — RUN `inspection` ON THE NATIVE SWEEP ENGINE.
//
//   node --import ./tools/native/loader.mjs tools/native-sweep/run.mjs [--axes a,b] [--out FILE] [--js FILE]
//
// Boots the movement on the native host, streams the posed state `runInspection`
// reads (src/inspect.js' exportInspectionState) into tools/native-sweep/build/sweep
// (built by build.mjs), and assembles the engine's findings with inspect.js' own
// `inspectionPayload`. `--out` writes the payload; `--js` also runs the JS sweep in
// the same process and writes ITS payload, so the two can be held leaf for leaf
// (tools/native-sweep/probe.mjs does that; this file only runs).
//
// The stream (sweep.cpp's header says the records): every geometry once, when it is
// first seen (identity and both attribute versions, so a geometry rewritten in place
// is a new one), and per pose only the meshes whose state changed since the last pose
// it was sent, so a pose of an axis that moves three units costs three units' bytes.
import { spawn } from 'node:child_process';
import { writeFileSync, writeSync, existsSync } from 'node:fs';
const require_fs = () => ({ writeSync });
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const BIN = join(ROOT, 'tools/native-sweep/build/sweep');
const opt = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };

// The stream's two encoders, shared by every check: each geometry once, on first sight
// of its identity and both attribute versions (a geometry rewritten in place is a new
// one), with positions as the kernel receives them (src/kernel.js' handleFor: f32, an
// unindexed geometry an identity index); and a pose's 'P' record, the geometries it
// first names going ahead of it.
const u32b = (v) => { const b = Buffer.alloc(4); b.writeUInt32LE(v); return b; };
function geometryRegistry() {
  const geomIds = new WeakMap();   // geometry → { pv, iv, id }
  let nextGeom = 0;
  const stats = { geometries: 0, geomBytes: 0, poses: 0, sent: 0 };
  const geomId = (g) => {
    const pv = g.attributes.position.version, iv = g.index ? g.index.version : -1;
    const hit = geomIds.get(g);
    if (hit && hit.pv === pv && hit.iv === iv) return [hit.id, null];
    const id = nextGeom++;
    geomIds.set(g, { pv, iv, id });
    const pos = g.attributes.position, n = pos.count, idx = g.index ? g.index.array : null;
    const ntri = idx ? Math.floor(idx.length / 3) : Math.floor(n / 3);
    const f = new Float32Array(n * 3);
    if (pos.isInterleavedBufferAttribute || pos.itemSize !== 3) for (let i = 0; i < n; i++) { f[3 * i] = pos.getX(i); f[3 * i + 1] = pos.getY(i); f[3 * i + 2] = pos.getZ(i); }
    else f.set(pos.array.subarray(0, n * 3));
    const ix = new Uint32Array(ntri * 3);
    if (idx) ix.set(idx.subarray(0, ntri * 3)); else for (let i = 0; i < ntri * 3; i++) ix[i] = i;
    const rec = Buffer.concat([Buffer.from('G'), u32b(id), u32b(n), u32b(ntri), Buffer.from(f.buffer), Buffer.from(ix.buffer)]);
    stats.geometries++; stats.geomBytes += rec.length;
    return [id, rec];
  };
  return { geomId, stats };
}
function encodePose(axis, i, { f, unitBoxes, changed }, geomId, stats) {
  const parts = [];
  const head = Buffer.alloc(1 + 4 + 4 + 8 + unitBoxes.length * 48);
  head.write('P', 0); head.writeUInt32LE(axis, 1); head.writeUInt32LE(i, 5); head.writeDoubleLE(f, 9);
  unitBoxes.forEach((b, k) => { const o = 17 + k * 48; [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z].forEach((v, q) => head.writeDoubleLE(v, o + 8 * q)); });
  const REC = 16 + 8 * 38 + 8 * 6 + 8;   // the ids, two matrices, two boxes, the geometry's JS id and position version
  const body = Buffer.alloc(changed.length * REC);
  const dv = new DataView(body.buffer, body.byteOffset, body.length);
  changed.forEach((s, j) => {
    const [own, gOwn] = geomId(s.own), [view, gView] = geomId(s.view);
    if (gOwn) parts.push(gOwn);
    if (gView) parts.push(gView);
    const o = j * REC;
    dv.setUint32(o, s.mesh, true); dv.setUint32(o + 4, own, true); dv.setUint32(o + 8, view, true); dv.setUint32(o + 12, s.rigid ? 1 : 0, true);
    for (let k = 0; k < 16; k++) { dv.setFloat64(o + 16 + 8 * k, s.world[k], true); dv.setFloat64(o + 144 + 8 * k, s.frame[k], true); }
    for (let k = 0; k < 6; k++) { dv.setFloat64(o + 272 + 8 * k, s.box[k], true); dv.setFloat64(o + 320 + 8 * k, s.box2[k], true); }
    dv.setUint32(o + 368, s.gid, true); dv.setUint32(o + 372, s.pv, true);
  });
  stats.poses++; stats.sent += changed.length;
  parts.push(head, u32b(changed.length), body);
  return Buffer.concat(parts);
}

// `touch`, for the probe's control only, replaces the contact threshold the engine is handed.
export async function runNativeInspection(clock, I, { axes, includeExcluded = true, touch } = {}) {
  if (!existsSync(BIN)) throw new Error(`no engine at ${BIN}: run tools/native-sweep/build.mjs`);
  const child = spawn(BIN, [], { stdio: ['pipe', 'pipe', 'inherit'] });
  const out = [];
  child.stdout.on('data', (d) => out.push(d));
  const done = new Promise((res, rej) => child.on('close', (code) => (code === 0 ? res() : rej(new Error(`sweep exited ${code}`)))));
  const dump = process.env.SWEEP_DUMP ? (await import('node:fs')).openSync(process.env.SWEEP_DUMP, 'w') : null;   // the stream as sent, to replay the engine alone
  const write = (buf) => { if (dump !== null) (globalThis.__fs ||= require_fs()).writeSync(dump, buf); return child.stdin.write(buf) ? null : new Promise((r) => child.stdin.once('drain', r)); };
  const u32 = (v) => { const b = Buffer.alloc(4); b.writeUInt32LE(v); return b; };

  const { geomId, stats } = geometryRegistry();

  const sink = {
    async begin(h) {
      const j = Buffer.from(JSON.stringify(touch === undefined ? h : { ...h, CONTACT_TOUCH: touch }));
      await write(Buffer.concat([Buffer.from('H'), u32(j.length), j]));
    },
    async pose({ axis, i, ...pose }) { await write(encodePose(axis, i, pose, geomId, stats)); },
  };
  const { units, axes: axisList } = await I.exportInspectionState(clock, sink, { axes, includeExcluded });
  child.stdin.end(Buffer.from('E'));
  if (dump !== null) writeSync(dump, Buffer.from('E'));
  await done;
  const res = JSON.parse(Buffer.concat(out).toString('utf8'));
  // the findings in the order the engine first found them, as runInspection's Map holds them
  const findings = new Map();
  for (const r of res.findings) findings.set(r.pair, { pair: r.pair, class: r.class, axes: Object.fromEntries(r.axes) });
  // the census as runInspection's censusStart builds it (the verdict and outcome tiers are clearances')
  const c = res.census;
  const census = { aabbTests: c.aabbTests, aabbPass: c.aabbPass, exactCalls: c.exactCalls, exactMs: 0, verdictCalls: 0, verdictMs: 0,
    out: { pruned: 0, far: 0, mid: 0, near: 0, contact: 0 }, boolTrue: c.boolTrue, boolFalse: c.boolFalse,
    unitPairTests: c.unitPairTests, unitPairPass: c.unitPairPass };
  return { payload: I.inspectionPayload(findings, units, axisList, census), stats };
}

// §338 landing 12 — `clearances` on the engine, which DRIVES: it runs sweepClearances'
// algorithm and asks for each pose it visits ('S', in the JS sweep's own order) and for
// meshClearance's containment witness where it needs one ('V', inspect.js'
// sampledVerdict, asked here at the very pose the engine is measuring). JS poses,
// answers and assembles the payload with checkClearances' own clearancesPayload.
// The engine's extrema sweep (sweepClearances' algorithm) over any list of
// sweepClearances pairs ({ A, B, axes, refineFloor, exclude? }), the engine DRIVING:
// it asks for each pose it visits ('S', in the JS sweep's own order) and for
// meshClearance's containment witness where it needs one ('V', inspect.js'
// sampledVerdict, asked here at the very pose the engine is measuring). Each pair is
// handed over as its two mesh lists and the mesh pairs its `exclude` rule skips,
// evaluated once here (the rule reads names and identities, never a pose). Returns
// sweepClearances' per-pair state and the census, for the check's own payload.
// A driven engine run: spawn, send the header, and serve its commands until it answers
// — 'A' enter an axis, 'S' set a pose and send its states, 'V' meshClearance's
// containment witness (sampledVerdict, at the very pose being measured), 'Q' a batch of
// undeclaredClearance box prunes (undeclaredPrune, the check's own law), 'R' the result.
async function serveEngine(I, P, header) {
  if (!existsSync(BIN)) throw new Error(`no engine at ${BIN}: run tools/native-sweep/build.mjs`);
  const child = spawn(BIN, [], { stdio: ['pipe', 'pipe', 'inherit'] });
  const exited = new Promise((res, rej) => child.on('close', (code) => (code === 0 ? res() : rej(new Error(`sweep exited ${code}`)))));
  let buf = Buffer.alloc(0), wake = null;
  child.stdout.on('data', (d) => { buf = Buffer.concat([buf, d]); if (wake) { const w = wake; wake = null; w(); } });
  const need = async (n) => { while (buf.length < n) await new Promise((r) => { wake = r; }); const out = buf.subarray(0, n); buf = buf.subarray(n); return out; };
  const write = (b) => (child.stdin.write(b) ? null : new Promise((r) => child.stdin.once('drain', r)));
  const { geomId, stats } = geometryRegistry();
  stats.verdicts = 0; stats.prunes = 0;
  const hj = Buffer.from(JSON.stringify({ ...header, unitCount: P.units.length, meshCount: P.meshes.length, axes: P.axes.map((a) => ({ name: a.name, n: a.n })) }));
  await write(Buffer.concat([Buffer.from('H'), u32b(hj.length), hj]));
  let result = null;
  for (;;) {
    const tag = String.fromCharCode((await need(1))[0]);
    if (tag === 'A') { await need(4); P.enter(); continue; }
    if (tag === 'S') {
      const b = await need(8), ax = b.readUInt32LE(0), i = b.readUInt32LE(4);
      await write(encodePose(ax, i, P.pose(ax, i), geomId, stats));
      continue;
    }
    if (tag === 'V') {
      const b = await need(16), a = b.readUInt32LE(0), m = b.readUInt32LE(4), upper = b.readDoubleLE(8);
      stats.verdicts++;
      const inside = I.sampledVerdict(P.meshes[a], P.meshes[m], upper).inside;
      await write(Buffer.from([0x76, inside ? 1 : 0]));   // 'v'
      continue;
    }
    if (tag === 'Q') {
      const n = (await need(4)).readUInt32LE(0), b = await need(16 * n), out = Buffer.alloc(n);
      for (let k = 0; k < n; k++) out[k] = I.undeclaredPrune(P.meshes[b.readUInt32LE(16 * k)], P.meshes[b.readUInt32LE(16 * k + 4)], b.readDoubleLE(16 * k + 8)) ? 1 : 0;
      stats.prunes += n;
      await write(out);
      continue;
    }
    if (tag === 'R') { const n = (await need(4)).readUInt32LE(0); result = JSON.parse((await need(n)).toString('utf8')); break; }
    throw new Error(`sweep: unknown command '${tag}'`);
  }
  child.stdin.end();
  await exited;
  return { result, stats };
}
const meshIndexOf = (P) => {
  const at = new Map(P.meshes.map((m, i) => [m, i]));
  return (m) => { const i = at.get(m); if (i === undefined) throw new Error(`native sweep: a pair names a mesh no unit carries (${m.name || m.uuid})`); return i; };
};

async function driveExtrema(clock, I, axes, pairs, { coarse, refineBand }) {
  const P = I.sweepPoser(clock, { axes, includeExcluded: true });
  const idx = meshIndexOf(P);
  const { result, stats } = await serveEngine(I, P, { check: 'clearances', coarse, refineBand,
    pairs: pairs.map((pr) => {
      const ex = [];
      if (pr.exclude) for (const ma of pr.A.meshes) for (const mb of pr.B.meshes) if (pr.exclude(ma, mb)) ex.push(idx(ma), idx(mb));
      return { Am: pr.A.meshes.map(idx), Bm: pr.B.meshes.map(idx), ex,
        axes: pr.axes ? pr.axes.map((n) => P.axes.findIndex((a) => a.name === n)).filter((k) => k >= 0) : null, refineFloor: pr.refineFloor };
    }) });
  // the per-pair state sweepClearances returns, its surfaces named as meshLabel names them
  const liveState = result.state.map((s, j) => {
    const pr = pairs[j];
    return { min: s.min === null ? Infinity : s.min, at: s.at ? { axis: P.axes[s.at[0]].name, f: s.at[1] } : null,
      ...(s.at ? { meshes: s.meshes ? [I.clearanceMeshLabel(pr.A, P.meshes[s.meshes[0]]), I.clearanceMeshLabel(pr.B, P.meshes[s.meshes[1]])] : null } : {}) };
  });
  const c = result.census;
  const census = { aabbTests: c.aabbTests, aabbPass: c.aabbPass, exactCalls: c.exactCalls, exactMs: 0, verdictCalls: c.verdictCalls, verdictMs: 0,
    out: c.out, boolTrue: 0, boolFalse: 0 };
  return { liveState, census, stats };
}

// §338 landing 12 — `clearances` on the engine. `budgets`, for the probe's witness
// control only, replaces CLEARANCE_BUDGETS.
export async function runNativeClearances(clock, I, { axes, coarse = 4, refineBand = 0.4, budgets } = {}) {
  const setup = I.clearancesSetup(clock, { axes, ...(budgets ? { budgets } : {}) });
  const { liveState, census, stats } = await driveExtrema(clock, I, setup.axes, setup.pairs, { coarse, refineBand });
  return { payload: I.clearancesPayload(setup, liveState, census, { refineBand }), stats };
}

// §338 landing 12 — `expectedContacts` on the engine: the same sweep, its pairs each a
// row's two mesh lists (own metal where the row says) and its exclusion rule.
export async function runNativeExpectedContacts(clock, I, { axes, coarse = 4, refineBand = 0.4 } = {}) {
  const setup = I.expectedContactsSetup(clock, { axes });
  const { liveState, census, stats } = await driveExtrema(clock, I, setup.axes, setup.livePairs, { coarse, refineBand });
  return { payload: I.expectedContactsPayload(setup, liveState, census, { refineBand }), stats };
}

// §338 landing 12 — `undeclaredClearance` on the engine: every pose of every axis, the
// pairs the complement of the declared ones plus the two controls, resolved by the
// check's own undeclaredSetup; the minima written back into its pair records, which
// undeclaredPayload reads.
export async function runNativeUndeclared(clock, I, { axes } = {}) {
  const setup = I.undeclaredSetup(clock, { axes });
  const P = I.sweepPoser(clock, { axes: setup.resolved, includeExcluded: true });
  const idx = meshIndexOf(P);
  const names = [...setup.units.keys()];
  const { result, stats } = await serveEngine(I, P, { check: 'undeclared',
    groups: names.map((n) => setup.units.get(n).map(idx)),
    pairs: setup.pairs.map((p) => ({ ga: names.indexOf(p.a), gb: names.indexOf(p.b), Am: p.A.map(idx), Bm: p.B.map(idx), bound: p.bound })) });
  result.state.forEach((s, j) => {
    const p = setup.pairs[j];
    p.min = s.min === null ? Infinity : s.min;
    p.at = s.at ? { axis: P.axes[s.at[0]].name, f: s.at[1] } : null;
    p.meshes = s.meshes ? s.meshes.map((k) => P.meshes[k].name || P.meshes[k].geometry.type) : null;
  });
  return { payload: I.undeclaredPayload(setup, result.census, result.poses), stats };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { bootNative } = await import(join(ROOT, 'tools/native/host.mjs'));
  const { clock } = await bootNative({ query: '' });
  const I = await import(join(ROOT, 'src/inspect.js'));
  clock.beginSweepHold();
  const axes = opt('--axes') ? opt('--axes').split(',') : undefined;
  const t0 = performance.now();
  const check = opt('--check') || 'inspection';
  const RUN = { inspection: runNativeInspection, clearances: runNativeClearances, expectedContacts: runNativeExpectedContacts, undeclaredClearance: runNativeUndeclared };
  const JS = { inspection: (o) => I.runInspection(clock, { ...o, includeExcluded: true }), clearances: (o) => I.checkClearances(clock, o), expectedContacts: (o) => I.checkExpectedContacts(clock, o), undeclaredClearance: (o) => I.checkUndeclaredClearance(clock, o) };
  if (!RUN[check]) throw new Error(`run.mjs: no native ${check}`);
  const { payload, stats } = await RUN[check](clock, I, { axes });
  const nativeMs = performance.now() - t0;
  const what = check === 'undeclaredClearance' ? `${payload.rows.length} rows under the margin, control ${payload.control}, ${stats.prunes} prunes and ${stats.verdicts} witnesses asked`
    : check !== 'inspection' ? `${payload.results.length} rows, ${payload.violations.length} violations, ${stats.verdicts} verdicts asked`
    : `${payload.report.length} contacting pairs (${payload.report.filter((r) => r.class === 'FORBIDDEN').length} FORBIDDEN)`;
  console.error(`native ${check}: ${(nativeMs / 1000).toFixed(1)} s, ${what}; streamed ${stats.poses} poses, ${stats.sent} mesh states, ${stats.geometries} geometries (${(stats.geomBytes / 1e6).toFixed(0)} MB)`);
  if (opt('--out')) writeFileSync(opt('--out'), JSON.stringify({ checks: { [check]: { result: payload } } }));
  if (opt('--js')) {
    const t1 = performance.now();
    const js = await JS[check]({ axes });
    console.error(`js ${check}: ${((performance.now() - t1) / 1000).toFixed(1)} s`);
    writeFileSync(opt('--js'), JSON.stringify({ checks: { [check]: { result: js } } }));
  }
  process.exit(0);
}
