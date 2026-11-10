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
  const body = Buffer.alloc(changed.length * (16 + 8 * 38));
  const dv = new DataView(body.buffer, body.byteOffset, body.length);
  changed.forEach((s, j) => {
    const [own, gOwn] = geomId(s.own), [view, gView] = geomId(s.view);
    if (gOwn) parts.push(gOwn);
    if (gView) parts.push(gView);
    const o = j * (16 + 8 * 38);
    dv.setUint32(o, s.mesh, true); dv.setUint32(o + 4, own, true); dv.setUint32(o + 8, view, true); dv.setUint32(o + 12, s.rigid ? 1 : 0, true);
    for (let k = 0; k < 16; k++) { dv.setFloat64(o + 16 + 8 * k, s.world[k], true); dv.setFloat64(o + 144 + 8 * k, s.frame[k], true); }
    for (let k = 0; k < 6; k++) dv.setFloat64(o + 272 + 8 * k, s.box[k], true);
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
// `budgets`, for the probe's verdict control only, replaces CLEARANCE_BUDGETS.
export async function runNativeClearances(clock, I, { axes, coarse = 4, refineBand = 0.4, budgets } = {}) {
  if (!existsSync(BIN)) throw new Error(`no engine at ${BIN}: run tools/native-sweep/build.mjs`);
  const setup = I.clearancesSetup(clock, { axes, ...(budgets ? { budgets } : {}) });
  const P = I.sweepPoser(clock, { axes: setup.axes, includeExcluded: true });
  const unitAt = new Map(P.units.map((u, i) => [u.name, i]));
  const child = spawn(BIN, [], { stdio: ['pipe', 'pipe', 'inherit'] });
  const exited = new Promise((res, rej) => child.on('close', (code) => (code === 0 ? res() : rej(new Error(`sweep exited ${code}`)))));
  // the engine's commands, read as they arrive
  let buf = Buffer.alloc(0), wake = null;
  child.stdout.on('data', (d) => { buf = Buffer.concat([buf, d]); if (wake) { const w = wake; wake = null; w(); } });
  const need = async (n) => { while (buf.length < n) await new Promise((r) => { wake = r; }); const out = buf.subarray(0, n); buf = buf.subarray(n); return out; };
  const write = (b) => (child.stdin.write(b) ? null : new Promise((r) => child.stdin.once('drain', r)));
  const u32 = (v) => { const b = Buffer.alloc(4); b.writeUInt32LE(v); return b; };
  const { geomId, stats } = geometryRegistry();
  const h = { check: 'clearances', units: P.units.map((u, i) => ({ name: u.name, meshes: P.unitMeshes[i] })), meshCount: P.meshes.length,
    axes: P.axes.map((a) => ({ name: a.name, n: a.n })), coarse, refineBand,
    pairs: setup.pairs.map((pr) => ({ A: unitAt.get(pr.A.name), B: unitAt.get(pr.B.name),
      axes: pr.axes ? pr.axes.map((n) => P.axes.findIndex((a) => a.name === n)).filter((k) => k >= 0) : null, refineFloor: pr.refineFloor })) };
  const hj = Buffer.from(JSON.stringify(h));
  await write(Buffer.concat([Buffer.from('H'), u32(hj.length), hj]));
  let result = null, verdicts = 0;
  for (;;) {
    const tag = String.fromCharCode((await need(1))[0]);
    if (tag === 'A') { const ax = (await need(4)).readUInt32LE(0); void ax; P.enter(); continue; }
    if (tag === 'S') {
      const b = await need(8), ax = b.readUInt32LE(0), i = b.readUInt32LE(4);
      await write(encodePose(ax, i, P.pose(ax, i), geomId, stats));
      continue;
    }
    if (tag === 'V') {
      const b = await need(16), a = b.readUInt32LE(0), m = b.readUInt32LE(4), upper = b.readDoubleLE(8);
      verdicts++;
      const inside = I.sampledVerdict(P.meshes[a], P.meshes[m], upper).inside;
      await write(Buffer.from([0x76, inside ? 1 : 0]));   // 'v'
      continue;
    }
    if (tag === 'R') { const n = (await need(4)).readUInt32LE(0); result = JSON.parse((await need(n)).toString('utf8')); break; }
    throw new Error(`sweep: unknown command '${tag}'`);
  }
  child.stdin.end();
  await exited;
  // the per-pair state sweepClearances returns, its surfaces named as meshLabel names them
  const liveState = result.state.map((s, j) => {
    const pr = setup.pairs[j];
    return { min: s.min === null ? Infinity : s.min, at: s.at ? { axis: P.axes[s.at[0]].name, f: s.at[1] } : null,
      ...(s.at ? { meshes: s.meshes ? [I.clearanceMeshLabel(pr.A, P.meshes[s.meshes[0]]), I.clearanceMeshLabel(pr.B, P.meshes[s.meshes[1]])] : null } : {}) };
  });
  const c = result.census;
  const census = { aabbTests: c.aabbTests, aabbPass: c.aabbPass, exactCalls: c.exactCalls, exactMs: 0, verdictCalls: c.verdictCalls, verdictMs: 0,
    out: c.out, boolTrue: 0, boolFalse: 0 };
  return { payload: I.clearancesPayload(setup, liveState, census, { refineBand }), stats: { ...stats, verdicts } };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { bootNative } = await import(join(ROOT, 'tools/native/host.mjs'));
  const { clock } = await bootNative({ query: '' });
  const I = await import(join(ROOT, 'src/inspect.js'));
  clock.beginSweepHold();
  const axes = opt('--axes') ? opt('--axes').split(',') : undefined;
  const t0 = performance.now();
  const check = opt('--check') || 'inspection';
  const { payload, stats } = check === 'clearances' ? await runNativeClearances(clock, I, { axes }) : await runNativeInspection(clock, I, { axes });
  const nativeMs = performance.now() - t0;
  const what = check === 'clearances' ? `${payload.results.length} budgets, ${payload.violations.length} violations, ${stats.verdicts} verdicts asked`
    : `${payload.report.length} contacting pairs (${payload.report.filter((r) => r.class === 'FORBIDDEN').length} FORBIDDEN)`;
  console.error(`native ${check}: ${(nativeMs / 1000).toFixed(1)} s, ${what}; streamed ${stats.poses} poses, ${stats.sent} mesh states, ${stats.geometries} geometries (${(stats.geomBytes / 1e6).toFixed(0)} MB)`);
  if (opt('--out')) writeFileSync(opt('--out'), JSON.stringify({ checks: { [check]: { result: payload } } }));
  if (opt('--js')) {
    const t1 = performance.now();
    const js = check === 'clearances' ? await I.checkClearances(clock, { axes }) : await I.runInspection(clock, { axes, includeExcluded: true });
    console.error(`js ${check}: ${((performance.now() - t1) / 1000).toFixed(1)} s`);
    writeFileSync(opt('--js'), JSON.stringify({ checks: { [check]: { result: js } } }));
  }
  process.exit(0);
}
