// §227 — DOES THE PROMOTION CHECKER REFUSE FOR EACH REASON IT CLAIMS TO?
//
// `tools/battery-promote.mjs` decides whether a push to the default branch may
// inherit a pull request's battery verdict instead of re-measuring the same
// tree. It is the one piece of this repository that can make a merge gate NOT
// RUN, so every clause it refuses on is exercised here against a fixture, and
// the control is that the happy path promotes — a checker that refuses
// everything is as useless as one that promotes everything, and both read
// "safe" from the outside.
//
// ACCEPTANCE (§40): exits non-zero if any case does not behave as declared.
// Browser-free and instant. It runs inside battery.yml — ABOVE the step that
// uses the checker, so a broken decider fails the job instead of quietly
// deciding with it — because `tools/**` and `.github/workflows/**` are both
// deliberately absent from that workflow's paths-ignore, which makes the
// battery's own trigger exactly the population that can break this rule.
//
// NOT a test of the FETCHING — battery.yml finds the artifact and reads the
// run's conclusion through the API, and that half is proved by the shadow runs
// the landing leaves switched on (§227 tier one logs the decision on every
// merge without acting on it, so the first real skip happens against decisions
// that have already been watched being right).
import { decide } from './battery-promote.mjs';

const TREE = 'a'.repeat(40);
const OTHER = 'b'.repeat(40);
const base = () => ({
  provenance: { promoteFormat: 1, tree: TREE, platform: 'Linux/ARM64',
    headRepo: 'kelaiem/timesim', event: 'pull_request', runId: '123' },
  report: { formatVersion: 4, fingerprint: 1 },
  tree: TREE, platform: 'Linux/ARM64', repo: 'kelaiem/timesim', conclusion: 'success',
});

const cases = [
  ['CONTROL — a clean candidate promotes', base(), true, /measured whole and green/],
  ['no provenance', { ...base(), provenance: null }, false, /nothing says which tree/],
  ['unknown provenance format', (() => { const b = base(); b.provenance.promoteFormat = 2; return b; })(), false, /format v2/],
  ['the TREE differs (a stale merge preview)', { ...base(), tree: OTHER }, false, /stale merge preview|different base/],
  ['a malformed tree sha', { ...base(), tree: 'nope' }, false, /not a tree sha/],
  ['the PLATFORM differs', { ...base(), platform: 'Linux/X64' }, false, /per-platform/],
  ['the candidate came from a FORK', (() => { const b = base(); b.provenance.headRepo = 'attacker/timesim'; return b; })(), false, /fork runs its own harness code/],
  ['the head repo was not recorded', (() => { const b = base(); delete b.provenance.headRepo; return b; })(), false, /unrecorded/],
  ['the candidate run FAILED', { ...base(), conclusion: 'failure' }, false, /greenness is read off the run/],
  ['the candidate run was CANCELLED', { ...base(), conclusion: 'cancelled' }, false, /greenness is read off the run/],
  ['the conclusion is unknown', { ...base(), conclusion: null }, false, /greenness is read off the run/],
  ['no report file', { ...base(), report: null }, false, /nothing to promote/],
  ['the report is RESTRICTED (incremental)', (() => { const b = base(); b.report.restrictedTo = ['Alarm switch']; return b; })(), false, /copy of a copy/],
];

let fail = 0;
for (const [name, input, wantPromote, wantWhy] of cases) {
  const d = decide(input);
  const ok = d.promote === wantPromote && wantWhy.test(d.why);
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  console.log(`        -> ${d.promote ? 'PROMOTE' : 'RUN'}: ${d.why}`);
  if (!ok) console.log(`        expected promote=${wantPromote} and /${wantWhy.source}/`);
}

// THE ORDER MATTERS TOO: a fork whose tree also differs must be refused, and
// the reason it gives should be the FIRST clause that fails rather than a
// coincidence of evaluation order. This pins the tree as the first thing
// checked, so a reader of the log learns the most useful fact.
{
  const b = base(); b.provenance.headRepo = 'attacker/timesim'; b.tree = OTHER;
  const d = decide(b);
  const ok = !d.promote && /stale merge preview|different base/.test(d.why);
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  a candidate failing TWO clauses names the tree first`);
  console.log(`        -> ${d.why}`);
}

console.log(fail ? `\n${fail} case(s) FAILED` : `\nall ${cases.length + 1} cases behave as declared`);
process.exit(fail ? 1 : 0);
