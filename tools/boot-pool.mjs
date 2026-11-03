// Boot MANY builds at once — a bounded pool over boot-form.mjs, one headless Chromium per boot (a report harness, it judges nothing).
//   node tools/boot-pool.mjs [--par N] [--expr 'JS over __clock'] '<query>' '<query>' …     one JSON line per query, in the given order
//   node tools/boot-pool.mjs --bench 1,4,8,12 ['<query>']                                    the scaling table on THIS machine
// Why a pool and not a loop: a boot is ~14 s of one main thread (the build) plus SwiftShader's raster threads, so independent
// boots scale with cores until memory bandwidth and the efficiency cores bite. Measured on an M2 Max (8 performance + 4
// efficiency cores, 32 GB), the lands preview, 2026-11-03: 1 boot 14.0 s; 4 at once 15.9 s (3.5x); 8 at once 21.6 s (5.2x);
// 12 at once 49.2 s (3.4x); 16 at once 149.6 s (1.5x). Every run read the identical area, so concurrency does not move a
// result. The knee is the PERFORMANCE-core count, so that is the default; past it, throughput falls, never rises.
// On GitHub's ubuntu-latest (4 vCPUs, 15 GB, measured by .github/workflows/boot-bench.yml, 2026-11-03): 1 boot 31.8 s; 2 at once
// 19.1 s a boot (1.66x); 3 at once 17.8 s (1.79x); 4 at once 17.5 s (1.82x); 6 at once 18.1 s. The Linux default (half the vCPUs, 2)
// takes most of that.
// Separate browsers, not contexts in one: one browser shares one GPU process, so its pages serialise on SwiftShader.
// NOT for tools that WRITE a shared file (tools/free-outline.mjs --write rewrites src/free-outlines.js): concurrent writers
// race. Give each worker its own tree (BOOT_ROOT, boot-form.mjs) or keep those steps serial.
import { execSync } from 'node:child_process';
import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';
import { bootForm } from './boot-form.mjs';

// the default concurrency: the machine's performance cores where the OS reports them (macOS), else all logical CPUs halved
// (Linux reports no core classes; a CI runner's own knee is measured on it with --bench, never assumed from this one)
export function perfCores() {
  try { const n = Number(execSync('sysctl -n hw.perflevel0.physicalcpu', { stdio: ['ignore', 'pipe', 'ignore'] }).toString()); if (n > 0) return n; } catch { /* not macOS */ }
  return Math.max(1, Math.floor(availableParallelism() / 2));
}

// a bounded, order-preserving map: at most `concurrency` workers in flight, results in the items' order
export async function pool(items, worker, { concurrency = perfCores() } = {}) {
  const out = new Array(items.length);
  let next = 0;
  const lane = async () => { while (next < items.length) { const i = next++; out[i] = await worker(items[i], i); } };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, lane));
  return out;
}

// boot each query (with an optional expression over __clock) through the pool; each result carries its own wall time
export const bootMany = (queries, expr = null, opts = {}) =>
  pool(queries, async (q) => { const t = Date.now(); const r = await bootForm(q, expr); return { query: q, ms: Date.now() - t, ...r }; }, opts);

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const take = (flag) => { const i = args.indexOf(flag); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
  const par = Number(take('--par')) || perfCores(), expr = take('--expr'), bench = take('--bench');
  if (bench) {
    const q = args[0] ?? 'case=free&alarm=0&barrelstep=-140&rsvaz=0&rsvidl=2&frame=lands';
    console.log(`bench on ${q} (default concurrency here: ${perfCores()})`);
    for (const n of bench.split(',').map(Number)) {
      const t0 = Date.now();
      const rs = await bootMany(Array(n).fill(q), 'window.__clock.formFootprint?.areaMm2 ?? null', { concurrency: n });
      const wall = (Date.now() - t0) / 1000, reads = new Set(rs.map((r) => JSON.stringify(r.extra)));
      console.log(`  ${String(n).padStart(2)} at once: wall ${wall.toFixed(1)} s, ${(wall / n).toFixed(1)} s per boot, ${reads.size === 1 ? 'every boot read the same' : `READS DIFFER: ${[...reads].join(' | ')}`}`);
    }
  } else {
    if (!args.length) { console.log('usage: boot-pool.mjs [--par N] [--expr EXPR] <query> …  |  --bench 1,4,8'); process.exit(2); }
    const rs = await bootMany(args, expr, { concurrency: par });
    for (const r of rs) console.log(JSON.stringify({ query: r.query, s: +(r.ms / 1000).toFixed(1), warnings: r.warnings.length, bootError: r.bootError ?? null, unknownKeys: r.unknownKeys ?? null, extra: r.extra ?? null }));
  }
}
