// §264/§265 — WHICH SPEC BOOTS THE PUSH'S TWO JOBS EACH TAKE, and the proof
// that the two halves put back together are the whole tier.
//
// Pure functions over a declared list ({ name }[] in declared order), so a
// probe can hold them without a browser (tools/probe-tiers-spec-hand.mjs) and
// ci-battery.mjs's tiers-only run, its judging run and the probe all read ONE
// rule.
//
// WHY THE BATTERY KEEPS ANY. Push run 39959720085 (main 9525e5b7,
// ubuntu-24.04), both jobs starting 13:15:46:
//   · battery tiers: the spec boots took 498.3 s (36 boots, a pool of 4, so
//     13.8 s of wall per boot) and the point tier 454.6 s, back to back; the
//     battery read the file at +1002.5 s.
//   · battery: its shards, boot B and the share boot were done at +731 s, and
//     it then WAITED 270.3 s for that file.
// The workflow change beside this one moves the three post-battery probes
// (190.4 s on that runner) ahead of the harness on this path, so the battery
// reaches the hand-off at +921 s and the file still arrives at +1002.5 — an
// 81 s wait. A spec boot is the one piece of the sibling's work fine enough
// to fill it: K boots taken here cost the sibling's pool K × 13.8 s, and cost
// this job one round of K concurrent boots on an idle runner (a solo boot is
// ~20.6 s there — boot B — and #771 measured concurrency at 1.3–2× solo).
//   K = 3: sibling 1002.5 − 41.5 = 961; battery 921 + ~27–41 = 948–962.
//   K = 4: sibling 947.2;               battery 921 + ~41–55 = 962–976.
//   K = 2: sibling 974.8;               battery 921 + ~27–41.
// K = 3 is the one where neither side waits for the other by more than the
// uncertainty in a concurrent boot, so it is 36 / 12: the battery keeps every
// twelfth declared point, the last of each run of twelve (round robin by
// DECLARED index, specOwner's rule, so a heavy cluster in the declaration —
// the d4 series, the reserve pair — never lands on one side whole). A wrong
// stride costs wall clock, never a verdict: every row is still booted once,
// and judged by the same gates in the same assembly. These are PREDICTIONS
// until a push measures them; re-derive the stride from that push's two
// numbers (`waited` in the battery, the spec wall in the sibling).
export const SPEC_HAND_STRIDE = 12;

// The names the judging battery boots itself; every other declared point is
// the sibling's.
export function specKeptHere(declared) {
  return new Set(declared.filter((_, i) => i % SPEC_HAND_STRIDE === SPEC_HAND_STRIDE - 1).map((p) => p.name));
}

// The sibling's half, in declared order — what `--tiers-only` boots.
export function specHandedPoints(declared) {
  const kept = specKeptHere(declared);
  return declared.filter((p) => !kept.has(p.name));
}

// THE SIBLING'S HALF PROVES ITSELF OR IS NOT TAKEN: exactly one row per point
// the rule hands it, in declared order, and nothing else — a point the battery
// keeps arriving in the file is refused like a missing one, because two rows
// for one point is two answers. Returns the reason, or null.
export function specHandRefusal(declared, spec) {
  if (!spec || !Array.isArray(spec.rows) || typeof spec.ms !== 'number') return 'no spec tier in the file';
  const want = specHandedPoints(declared).map((p) => p.name);
  const got = spec.rows.map((r) => r?.name);
  const kept = specKeptHere(declared);
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
