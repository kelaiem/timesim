// §334 landing 7 — the banking probe's own module hook (never the build's): with KB_BANK_OVERRIDE set (JSON, an
// object { R, alpha } or null), the declared `banking:` row of src/keyless-rocking-bar.js is rewritten in the SOURCE
// TEXT as the module loads, so a child boot builds that candidate, or no banking at all. The shipped module carries no
// hook; a declaration the pattern does not find throws rather than booting the declared one in silence.
//
//   node --import ./tools/native/loader.mjs --import ./tools/probe-keyless-rocking-bar-banking-loader.mjs …
import { register } from 'node:module';

if (process.env.KB_BANK_OVERRIDE !== undefined && !process.env.__KB_BANK_LOADER__) {
  process.env.__KB_BANK_LOADER__ = '1';
  register(import.meta.url, { data: { override: process.env.KB_BANK_OVERRIDE } });
}

let OVERRIDE = null;
export function initialize(data) { OVERRIDE = data?.override ?? null; }

const DECL = /banking: Object\.freeze\(\{ R: [0-9.]+, alpha: [0-9.]+ \}\)/;
export async function load(url, context, next) {
  const r = await next(url, context);
  if (OVERRIDE === null || !url.endsWith('/src/keyless-rocking-bar.js')) return r;
  const src = String(r.source);
  const v = JSON.parse(OVERRIDE);
  const repl = v === null ? 'banking: null' : `banking: Object.freeze({ R: ${v.R}, alpha: ${v.alpha} })`;
  if (src.includes(repl) && !DECL.test(src)) return r;   // the hook can see a module twice; the second time it is already rewritten
  if (!DECL.test(src)) throw new Error('banking loader: the declared banking row is not where the pattern looks');
  return { ...r, source: src.replace(DECL, repl) };
}
