#!/usr/bin/env node
// §338 landing 1 — boot one build in the NATIVE host and print what it measured.
// A REPORT (it judges nothing; it exits 1 only when the build fails to boot).
//
//   node --import ./tools/native/loader.mjs tools/native/boot.mjs ['k=v&…' spec] [--expr 'JS over __clock']
//
// Prints the boot's wall, its warnings (standing rule 6: none, on a healthy
// tree), which stand-ins it exercised, and the §52 fingerprint, the identity
// tools/probe-338-native-boot.mjs holds against a Chromium boot of the same
// tree.
import { bootNative } from './host.mjs';

const argv = process.argv.slice(2);
const ei = argv.indexOf('--expr');
const expr = ei >= 0 ? argv.splice(ei, 2)[1] : null;
const query = argv[0] ?? '';
let r;
try { r = await bootNative({ query }); } catch (e) { console.error('BOOT FAILED', e?.stack || e); process.exit(1); }
const I = await import('../../src/inspect.js');
const fp = I.fingerprint(r.clock);
console.log(JSON.stringify({ query, bootMs: Math.round(r.ms), warns: r.warns, touched: r.touched, fingerprint: fp }, null, 1));
if (expr) console.log('expr', JSON.stringify(await (0, eval)(expr), null, 1));
process.exit(0);
