// §338 landing 2 — the page's install of src/det-math.js, and its boot check.
//
// index.html's entry module imports this FIRST, so every module evaluated
// after it (spec-boot.js, i18n.js, then main.js and three.js through it) calls
// the deterministic functions. The native host does the same in
// tools/native/host.mjs. A named import there, never a bare `import '…'`:
// tools/stamp-release.mjs versions `from '…'` and `import('…')` only.
//
// The check runs the recorded known answers (src/det-math-kat.js, the BOOT
// size: a few ms) against the installed functions. What it finds is published
// on globalThis.__detMath; main.js turns every finding into a boot warning
// (standing rule 6), because this module runs before main.js has a warning
// channel, and a page whose maths does not reproduce the table must not build
// metal in silence.
import { DET_MATH, installDetMath, knownAnswers } from './det-math.js';
import { KAT_BOOT, KAT_BOOT_N } from './det-math-kat.js';

export function installAndCheck(M = Math, g = globalThis) {
  const installed = installDetMath(M);
  const got = knownAnswers(KAT_BOOT_N, M);
  const failed = Object.keys(KAT_BOOT).filter((k) => got[k] !== KAT_BOOT[k]);
  const warns = [];
  if (!installed) warns.push('§338: deterministic maths did not install — Math still carries the engine\'s functions');
  if (failed.length) warns.push(`§338: deterministic maths does not reproduce its known answers on this engine: ${failed.map((k) => `${k} ${got[k]} (recorded ${KAT_BOOT[k]})`).join(', ')}`);
  g.__detMath = Object.freeze({ installed, functions: Object.keys(DET_MATH), katN: KAT_BOOT_N, failed, warns });
  return g.__detMath;
}
export const DET_MATH_STATE = installAndCheck();
