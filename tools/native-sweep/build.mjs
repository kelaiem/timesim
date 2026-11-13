#!/usr/bin/env node
// §338 landing 12 — BUILD THE NATIVE SWEEP ENGINE: tools/native-sweep/sweep.cpp (which
// includes tools/kernel/kernel.cpp) → tools/native-sweep/build/sweep, for this host.
//
//   KERNEL_PYTHON=~/zig/bin/python node tools/native-sweep/build.mjs
//
// The compiler is the kernel's pinned one (zig 0.13.0's clang, tools/kernel-build.mjs
// says why), here with zig's bundled libc++ for the host: C++23 with the standard
// library. The arithmetic rules are the kernel's: -ffp-contract=off (a host with FMA,
// arm64 among them, would otherwise fuse a multiply and an add and part from the wasm
// module by an ulp) and no fast-math. `-mcpu=baseline`: zig otherwise targets the
// BUILD machine's CPU (measured: valgrind on the same host refused an instruction),
// which would make the binary a property of the runner it was built on. The binary is
// a build product, never committed.
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PY = process.env.KERNEL_PYTHON || 'python3';
const OUT = join(ROOT, 'tools/native-sweep/build/sweep');
mkdirSync(dirname(OUT), { recursive: true });
const FLAGS = ['-std=c++23', '-O2', '-mcpu=baseline', '-ffp-contract=off', '-fno-fast-math', '-Wall', '-Wextra', '-Werror', '-Wno-unused-function'];
execFileSync(PY, ['-m', 'ziglang', 'c++', ...FLAGS, '-o', OUT, join(ROOT, 'tools/native-sweep/sweep.cpp')], { stdio: 'inherit' });
console.log(`built ${OUT}`);
