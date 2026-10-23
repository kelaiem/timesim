// §264/§265 — WHICH SPEC BOOTS THE PUSH'S JOBS EACH TAKE, WHICH FILE CARRIES
// WHICH TIER, and the proof that what arrives is the whole of each tier.
//
// Pure functions over a declared list ({ name }[] in declared order) and the
// parsed hand-off files, so a probe can hold them without a browser
// (tools/probe-tiers-spec-hand.mjs) and ci-battery.mjs's tiers-only runs, its
// judging run and the probe all read ONE rule.
//
// THE FAN-OUT. Since the fan-out the push's tiers are measured by TWO sibling
// jobs, `battery spec` (the spec boots) and `battery points` (the point tier),
// each writing its own file with `--tiers-only --tiers-part <part>`. A file
// names its PART, and the judging run takes each part from exactly one file:
// a part no file carries, or that two files carry, or a file naming a part
// that does not exist, runs that tier here. See acceptTiers.
//
// HOW MANY SPEC POINTS THE BATTERY KEEPS — RE-DERIVED FOR THE FAN-OUT: NONE.
// #774 kept every twelfth declared point (K = 3 of 36) because the battery was
// WAITING for its one sibling: on that path the sibling ran the spec boots and
// the point tier back to back. Measured on hosted dispatch 39983932573
// (b568c03c, the code #774 merged), every job starting together:
//   · battery tiers: setup ~26 s, 33 spec boots 418.4 s (a pool of 4, so
//     12.7 s of wall per boot), point tier 448.4 s.
//   · battery: setup 26 s, the three probes 194 s, then the harness 744 s:
//     preflight 27.3 s, shards 631 s, boot B 27.1 s, share boot 21.2 s, the 3
//     kept spec boots 36.7 s; it waited 0.0 s for the file.
// With the tiers on two jobs and the probes on a third, the siblings hand
// over at about
//   · spec:   26 + 36 × 12.7 = ~482 s from their start,
//   · points: 26 + 448.4     = ~474 s,
// while the battery reaches the hand-off at 26 + 27.3 + 631 + 27.1 + 21.2 =
// ~733 s. Both siblings are ~250 s early, so a boot kept here no longer fills
// a wait: it costs the battery — the critical path — a round of concurrent
// boots (36.7 s for K = 3) to save a sibling that has slack 12.7 s a boot.
// K = 0 is therefore the stride, and 0 means "keep none": the battery boots
// no spec point unless the sibling's file is refused. The split machinery
// (the stride argument, specHandRefusal's intruder check, mergeSpecHalves)
// stays, because the balance moves with the shards: if a later push measures
// the battery reaching the hand-off BEFORE the spec file arrives, re-derive K
// from that push's two numbers (`waited` in the battery, the spec wall in
// `battery spec`) and set the stride to 36 / K. These are PREDICTIONS until a
// push measures them. A wrong stride costs wall clock, never a verdict: every
// row is still booted once and judged by the same gates in the same assembly.
export const SPEC_HAND_STRIDE = 0;

// The names the judging battery boots itself; every other declared point is
// the sibling's. Stride S keeps the last of each run of S (round robin by
// DECLARED index, specOwner's rule, so a heavy cluster in the declaration —
// the d4 series, the reserve pair — never lands on one side whole); stride 0
// keeps none.
export function specKeptHere(declared, stride = SPEC_HAND_STRIDE) {
  if (!stride) return new Set();
  return new Set(declared.filter((_, i) => i % stride === stride - 1).map((p) => p.name));
}

// The sibling's half, in declared order — what `--tiers-part spec` boots.
export function specHandedPoints(declared, stride = SPEC_HAND_STRIDE) {
  const kept = specKeptHere(declared, stride);
  return declared.filter((p) => !kept.has(p.name));
}

// THE SIBLING'S HALF PROVES ITSELF OR IS NOT TAKEN: exactly one row per point
// the rule hands it, in declared order, and nothing else — a point the battery
// keeps arriving in the file is refused like a missing one, because two rows
// for one point is two answers. Returns the reason, or null.
export function specHandRefusal(declared, spec, stride = SPEC_HAND_STRIDE) {
  if (!spec || !Array.isArray(spec.rows) || typeof spec.ms !== 'number') return 'no spec tier in the file';
  const want = specHandedPoints(declared, stride).map((p) => p.name);
  const got = spec.rows.map((r) => r?.name);
  const kept = specKeptHere(declared, stride);
  const intruder = got.find((n) => kept.has(n));
  if (intruder !== undefined) return `it carries ${intruder}, which this run boots itself`;
  const seen = new Set();
  for (const n of got) {
    if (seen.has(n)) return `${n} arrives twice`;
    seen.add(n);
  }
  if (got.length !== want.length) return `${got.length} rows, the sibling owes ${want.length} of the ${declared.length} declared spec points`;
  const off = want.findIndex((n, i) => got[i] !== n);
  if (off >= 0) return `row ${off} is ${got[off] ?? 'missing'}, the sibling's point there is ${want[off]}`;
  return null;
}

// The two halves put back together in DECLARED order — the order runSpecTier
// writes and the assembly's gates read. Every declared point must arrive from
// exactly one half; anything else THROWS, because by here both halves have
// been accepted and a gap or a double is a bug in this file, not a slow
// sibling. `ms` is the larger wall, the collector's rule for halves measured
// side by side.
export function mergeSpecHalves(declared, handed, local) {
  const byName = new Map();
  for (const [from, half] of [['the sibling', handed], ['this run', local]]) {
    for (const r of half.rows) {
      if (!declared.some((p) => p.name === r.name)) throw new Error(`spec merge: ${from} carries ${r.name}, which is not a declared spec point`);
      if (byName.has(r.name)) throw new Error(`spec merge: ${r.name} arrives twice (${byName.get(r.name).from} and ${from})`);
      byName.set(r.name, { from, r });
    }
  }
  const missing = declared.filter((p) => !byName.has(p.name)).map((p) => p.name);
  if (missing.length) throw new Error(`spec merge: no row for [${missing}]`);
  return { rows: declared.map((p) => byName.get(p.name).r), ms: Math.max(handed.ms, local.ms) };
}

// ---- THE HAND-OFF FILES ----------------------------------------------------
//
// 3 since the fan-out: a file carries ONE part and names it. A format-2 file
// carried both tiers unnamed, and is refused rather than read as either.
export const TIERS_FORMAT = 3;
export const TIERS_PARTS = ['spec', 'points'];

// What a `--tiers-only --tiers-part <part>` run writes.
export function tiersFile({ part, tree, checkCode, tier }) {
  if (!TIERS_PARTS.includes(part)) throw new Error(`tiersFile: no part "${part}" (parts: ${TIERS_PARTS})`);
  return { tiersFormat: TIERS_FORMAT, part, tree, checkCode, [part]: tier };
}

// The point tier proves itself: this point code, whole and not a PR's, every
// swept point exactly once and full. Returns the reason, or null.
export function pointsRefusal(f, { checkCode, swept }) {
  if (JSON.stringify(f.checkCode) !== JSON.stringify(checkCode)) return 'measured by different point code';
  const points = f.points;
  if (!points || points.pr !== false) return 'not a whole, non-PR tier';
  const names = (points.plan || []).map((p) => p.name);
  if (names.length !== swept.length || swept.some((n) => !names.includes(n))) return `it covers [${names}], the swept points are [${swept}]`;
  const notFull = (points.plan || []).filter((p) => p.mode !== 'full').map((p) => p.name);
  if (notFull.length) return `[${notFull}] were not swept full`;
  const missing = swept.filter((n) => !points.got?.[n]);
  if (missing.length) return `no measurement for [${missing}]`;
  return null;
}

// TAKE EACH PART FROM EXACTLY ONE FILE THAT PROVES IT, OR FROM NONE.
//
//   files     [{ path, f, why }] — f the parsed file, or null with `why`
//             (never arrived, the fetcher gave up, unreadable)
//   tree      git's tree object this process runs, or null (dirty, no git)
//   checkCode this run's pointsCodeDigest
//   declared  SPEC_POINTS; swept: the swept points' names
//   specOnly  --spec-only: there is no point tier to take, or to miss
//
// A FILE is refused whole for its format, its tree or a part that does not
// exist; for carrying a tier that is not its part (a spec file with a point
// tier is two claims, and the second has no file of its own to answer for
// it); and its PART is refused when another file also claims it — two files
// for one part are two answers, so neither is taken. Then the part's own
// proof (specHandRefusal, pointsRefusal). Returns { spec, points, lines }:
// each tier, or null for the caller to run here, and the log lines saying why.
// §152's rule: every uncertainty resolves towards more work.
export function acceptTiers({ files, tree, checkCode, declared, swept, specOnly = false, stride = SPEC_HAND_STRIDE }) {
  const lines = [];
  const wanted = specOnly ? ['spec'] : TIERS_PARTS;
  const claims = new Map(TIERS_PARTS.map((p) => [p, []]));
  for (const { path, f, why } of files) {
    const no = (reason) => lines.push(`tiers: NOT taking ${path} (${reason})`);
    if (!f) { no(why || 'nothing read'); continue; }
    if (f.tiersFormat !== TIERS_FORMAT) { no(`format ${f.tiersFormat ?? 'unversioned'}, this harness reads ${TIERS_FORMAT}`); continue; }
    if (!TIERS_PARTS.includes(f.part)) { no(`it names part ${f.part ?? 'none'}, the parts are [${TIERS_PARTS}]`); continue; }
    const foreign = TIERS_PARTS.filter((p) => p !== f.part && f[p] != null);
    if (foreign.length) { no(`a ${f.part} file carrying a ${foreign.join(' and ')} tier as well`); continue; }
    if (!tree || f.tree !== tree) { no(`measured tree ${f.tree ?? 'unknown'}, this process is running ${tree ?? 'a tree it cannot name (git missing or the working tree is dirty)'}`); continue; }
    claims.get(f.part).push({ path, f });
  }
  const out = { spec: null, points: null };
  for (const part of wanted) {
    const c = claims.get(part);
    const label = part === 'spec' ? 'spec tier' : 'point tier';
    const here = part === 'spec' ? 'booting the sibling\'s half here' : 'sweeping it here';
    if (c.length === 0) { lines.push(`${label}: NOT taken (no file carries it) — ${here}`); continue; }
    if (c.length > 1) { lines.push(`${label}: NOT taken (${c.length} files carry it: ${c.map((x) => x.path).join(', ')}) — ${here}`); continue; }
    const { path, f } = c[0];
    if (part === 'spec') {
      const w = specHandRefusal(declared, f.spec, stride);
      if (w) { lines.push(`spec tier: NOT taken from ${path} (${w}) — ${here}`); continue; }
      out.spec = f.spec;
      lines.push(`spec tier: taken from ${path} — tree ${tree}, ${f.spec.rows.length} of ${declared.length} points booted on the parallel runner in ${(f.spec.ms / 1000).toFixed(1)}s`);
    } else {
      const w = pointsRefusal(f, { checkCode, swept });
      if (w) { lines.push(`point tier: NOT taken from ${path} (${w}) — ${here}`); continue; }
      out.points = f.points;
      lines.push(`point tier: taken from ${path} — tree ${tree}, ${swept.length} points swept full on the parallel runner in ${(f.points.ms / 1000).toFixed(1)}s`);
    }
  }
  return { ...out, lines };
}
