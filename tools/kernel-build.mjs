#!/usr/bin/env node
// §338 landing 5 — BUILD THE KERNEL: tools/kernel/kernel.cpp → src/kernel-wasm.js.
//
//   node tools/kernel-build.mjs            write src/kernel-wasm.js
//   node tools/kernel-build.mjs --check    rebuild and require the committed module, byte for byte
//
// Every run also compiles a MUTANT (the pierce test cut out) and requires the
// source's static_asserts to refuse it (§338 landing 10), so the analytic pairs
// stay a live gate.
//
// Acceptance with --check (exits non-zero when the rebuild differs, or when the
// toolchain is not the one the module records, which it reports rather than
// guessing past). A reproducible build is itself a portability claim (§338).
//
// THE COMPILER IS PINNED, not taken from the distro. CI's first run found apt's
// "clang 18" to be 18.1.3 on one image and 18.1.8 on the next, so "clang 18" names
// no binary. It is zig's bundled clang, from PyPI's `ziglang` at ZIG_VERSION: one
// static release, the same on every host and architecture (the native-host legs
// rebuild it on x64 and arm64 and must reproduce these bytes).
//   python3 -m venv ~/zig && ~/zig/bin/pip install ziglang==0.13.0.post1
//   KERNEL_PYTHON=~/zig/bin/python node tools/kernel-build.mjs [--check]
//
// The flags are the entry's determinism rules, written once here:
//   -std=c++23            the language the kernel is written in (§338 landing 10: constexpr
//                         primitives, if consteval, multidimensional subscripts)
//   -target wasm32-freestanding   the reference target; wasm has no FMA in its non-relaxed
//                         instruction set, so contraction cannot happen on any host
//   -ffp-contract=off     and none at compile time either
//   -fno-fast-math        no reassociation, no reciprocal approximations
//   -mno-simd128          no SIMD at all in this landing (relaxed SIMD is
//                         implementation-defined by spec; plain SIMD128 may come later)
//   -ffreestanding -nostdlib   no libc: the only floating point is + − × ÷ and sqrt
// The module must import NOTHING: this tool fails if it does, so no platform
// function can slip in under a name.
//
// The generated module carries the compiler's version line and the source's
// SHA-256, so a stale module or a different toolchain is named, never silently
// rebuilt into a different binary.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { execFileSync as run } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'tools/kernel/kernel.cpp');
const OUT = join(ROOT, 'src/kernel-wasm.js');
const ZIG_VERSION = '0.13.0';
const PY = process.env.KERNEL_PYTHON || 'python3';
const CXX = [PY, '-m', 'ziglang', 'c++', '-target', 'wasm32-freestanding'];
const FLAGS = ['-std=c++23', '-O2', '-ffreestanding', '-nostdlib', '-fno-exceptions', '-fno-rtti',
  '-ffp-contract=off', '-fno-fast-math', '-mno-simd128', '-Wall', '-Wextra', '-Werror',
  '-Wl,--no-entry', '-Wl,--strip-all', '-Wl,--export-dynamic'];

let zig;
try { zig = run(PY, ['-m', 'ziglang', 'version'], { encoding: 'utf8' }).trim(); }
catch { console.error(`FAIL — no zig: install it with \`pip install ziglang==${ZIG_VERSION}.post1\` and point KERNEL_PYTHON at that python`); process.exit(1); }
if (zig !== ZIG_VERSION) { console.error(`FAIL — zig ${zig} is not the pinned ${ZIG_VERSION}`); process.exit(1); }
const version = `zig ${zig}, ${execFileSync(CXX[0], [...CXX.slice(1), '--version'], { encoding: 'utf8' }).split('\n')[0].trim()}`;
const source = readFileSync(SRC);
const srcHash = createHash('sha256').update(source).digest('hex');
const dir = mkdtempSync(join(tmpdir(), 'kernel-'));
let wasm;
try {
  // zig's caches in the build's own temporary directory: nothing of a previous build is reused.
  const env = { ...process.env, ZIG_GLOBAL_CACHE_DIR: join(dir, 'zig-global'), ZIG_LOCAL_CACHE_DIR: join(dir, 'zig-local') };
  execFileSync(CXX[0], [...CXX.slice(1), ...FLAGS, '-o', join(dir, 'kernel.wasm'), SRC], { stdio: ['ignore', 'inherit', 'inherit'], env, cwd: dir });
  wasm = readFileSync(join(dir, 'kernel.wasm'));
  // §338 landing 10's CONTROL on the static_asserts: the analytic pairs are only a gate
  // while they can fail, so a copy of the source with the edge–face pierce test cut out
  // (every edge then misses every face) must be REFUSED by the compiler on the piercing
  // pairs. A source where the mutation no longer applies, or that the compiler accepts,
  // fails the build.
  const PIERCE = 'if (det == 0) return false;';
  const src = source.toString('utf8');
  if (src.split(PIERCE).length !== 2) { console.error(`FAIL — the static_assert control's mutation site \`${PIERCE}\` is not in kernel.cpp exactly once`); process.exit(1); }
  const mutant = join(dir, 'mutant.cpp');
  writeFileSync(mutant, src.replace(PIERCE, 'return false;'));
  let refused = '';
  try { execFileSync(CXX[0], [...CXX.slice(1), ...FLAGS.filter((f) => !f.startsWith('-Wl,')), '-fsyntax-only', mutant], { stdio: ['ignore', 'pipe', 'pipe'], env, cwd: dir }); }
  catch (e) { refused = String(e.stderr || ''); }
  if (!/static assertion failed due to requirement 'dist\(T0, SPIKE\) == 0'/.test(refused)) {
    console.error(`FAIL — the static_asserts did not refuse a kernel whose pierce test is cut out${refused ? `:\n${refused}` : ' (it compiled)'}`);
    process.exit(1);
  }
} finally { rmSync(dir, { recursive: true, force: true }); }

const mod = new WebAssembly.Module(wasm);
const imports = WebAssembly.Module.imports(mod);
if (imports.length) { console.error(`FAIL — the kernel imports ${imports.map((i) => `${i.module}.${i.name}`).join(', ')}: it must import nothing`); process.exit(1); }
const exportsList = WebAssembly.Module.exports(mod).map((e) => e.name);
for (const need of ['memory', 'reset', 'alloc', 'heap_used', 'geom_create', 'distance'])
  if (!exportsList.includes(need)) { console.error(`FAIL — the kernel does not export ${need}`); process.exit(1); }
const wasmHash = createHash('sha256').update(wasm).digest('hex');

const text = `// GENERATED by tools/kernel-build.mjs from tools/kernel/kernel.cpp — never edit;
// re-run the tool (\`--check\` rebuilds it and requires these bytes).
// compiler: ${version}
// source sha256: ${srcHash}
// wasm sha256: ${wasmHash} (${wasm.length} bytes)
export const KERNEL_WASM_SHA256 = '${wasmHash}';
export const KERNEL_WASM_BASE64 =
  '${wasm.toString('base64')}';
`;

if (process.argv.includes('--check')) {
  let committed = '';
  try { committed = readFileSync(OUT, 'utf8'); } catch { console.error(`FAIL — ${OUT} is missing`); process.exit(1); }
  const was = (committed.match(/^\/\/ compiler: (.*)$/m) || [])[1];
  if (committed === text) { console.log(`kernel build OK — ${wasm.length} bytes reproduced byte for byte (${version}), imports none`); process.exit(0); }
  const why = was !== version ? `the module was built by "${was}" and this toolchain is "${version}"`
    : !committed.includes(srcHash) ? 'tools/kernel/kernel.cpp changed since the module was built: re-run the tool'
    : 'the same compiler on the same source built different bytes';
  console.error(`FAIL — the kernel rebuild differs from src/kernel-wasm.js: ${why}`);
  process.exit(1);
}
writeFileSync(OUT, text);
console.log(`wrote src/kernel-wasm.js — ${wasm.length} bytes, sha256 ${wasmHash.slice(0, 16)}…, imports none (${version})`);
