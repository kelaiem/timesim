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

export async function runNativeInspection(clock, I, { axes, includeExcluded = true } = {}) {
  if (!existsSync(BIN)) throw new Error(`no engine at ${BIN}: run tools/native-sweep/build.mjs`);
  const child = spawn(BIN, [], { stdio: ['pipe', 'pipe', 'inherit'] });
  const out = [];
  child.stdout.on('data', (d) => out.push(d));
  const done = new Promise((res, rej) => child.on('close', (code) => (code === 0 ? res() : rej(new Error(`sweep exited ${code}`)))));
  const dump = process.env.SWEEP_DUMP ? (await import('node:fs')).openSync(process.env.SWEEP_DUMP, 'w') : null;   // the stream as sent, to replay the engine alone
  const write = (buf) => { if (dump !== null) (globalThis.__fs ||= require_fs()).writeSync(dump, buf); return child.stdin.write(buf) ? null : new Promise((r) => child.stdin.once('drain', r)); };
  const u32 = (v) => { const b = Buffer.alloc(4); b.writeUInt32LE(v); return b; };

  const geomIds = new WeakMap();   // geometry → { pv, iv, id }
  let nextGeom = 0;
  const stats = { geometries: 0, geomBytes: 0, poses: 0, sent: 0 };
  const geomId = (g) => {
    const pv = g.attributes.position.version, iv = g.index ? g.index.version : -1;
    const hit = geomIds.get(g);
    if (hit && hit.pv === pv && hit.iv === iv) return [hit.id, null];
    const id = nextGeom++;
    geomIds.set(g, { pv, iv, id });
    // positions as the kernel receives them (src/kernel.js' handleFor): f32, an unindexed geometry an identity index
    const pos = g.attributes.position, n = pos.count, idx = g.index ? g.index.array : null;
    const ntri = idx ? Math.floor(idx.length / 3) : Math.floor(n / 3);
    const f = new Float32Array(n * 3);
    if (pos.isInterleavedBufferAttribute || pos.itemSize !== 3) for (let i = 0; i < n; i++) { f[3 * i] = pos.getX(i); f[3 * i + 1] = pos.getY(i); f[3 * i + 2] = pos.getZ(i); }
    else f.set(pos.array.subarray(0, n * 3));
    const ix = new Uint32Array(ntri * 3);
    if (idx) ix.set(idx.subarray(0, ntri * 3)); else for (let i = 0; i < ntri * 3; i++) ix[i] = i;
    const rec = Buffer.concat([Buffer.from('G'), u32(id), u32(n), u32(ntri), Buffer.from(f.buffer), Buffer.from(ix.buffer)]);
    stats.geometries++; stats.geomBytes += rec.length;
    return [id, rec];
  };

  let nUnits = 0;
  const sink = {
    async begin(h) {
      nUnits = h.units.length;
      const j = Buffer.from(JSON.stringify(h));
      await write(Buffer.concat([Buffer.from('H'), u32(j.length), j]));
    },
    async pose({ axis, i, f, unitBoxes, changed }) {
      const parts = [];
      const head = Buffer.alloc(1 + 4 + 4 + 8 + nUnits * 48);
      head.write('P', 0); head.writeUInt32LE(axis, 1); head.writeUInt32LE(i, 5); head.writeDoubleLE(f, 9);
      unitBoxes.forEach((b, k) => { const o = 17 + k * 48; [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z].forEach((v, q) => head.writeDoubleLE(v, o + 8 * q)); });
      // the exporter hands over only the meshes whose state can have changed
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
      parts.push(head, u32(changed.length), body);
      await write(Buffer.concat(parts));
    },
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

if (import.meta.url === `file://${process.argv[1]}`) {
  const { bootNative } = await import(join(ROOT, 'tools/native/host.mjs'));
  const { clock } = await bootNative({ query: '' });
  const I = await import(join(ROOT, 'src/inspect.js'));
  clock.beginSweepHold();
  const axes = opt('--axes') ? opt('--axes').split(',') : undefined;
  const t0 = performance.now();
  const { payload, stats } = await runNativeInspection(clock, I, { axes });
  const nativeMs = performance.now() - t0;
  console.error(`native inspection: ${(nativeMs / 1000).toFixed(1)} s, ${payload.report.length} contacting pairs (${payload.report.filter((r) => r.class === 'FORBIDDEN').length} FORBIDDEN); streamed ${stats.poses} poses, ${stats.sent} mesh states, ${stats.geometries} geometries (${(stats.geomBytes / 1e6).toFixed(0)} MB)`);
  if (opt('--out')) writeFileSync(opt('--out'), JSON.stringify({ checks: { inspection: { result: payload } } }));
  if (opt('--js')) {
    const t1 = performance.now();
    const js = await I.runInspection(clock, { axes, includeExcluded: true });
    console.error(`js inspection: ${((performance.now() - t1) / 1000).toFixed(1)} s`);
    writeFileSync(opt('--js'), JSON.stringify({ checks: { inspection: { result: js } } }));
  }
  process.exit(0);
}
