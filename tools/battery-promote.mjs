// §227 — MAY THIS PUSH PROMOTE A PULL REQUEST'S BATTERY INSTEAD OF RE-RUNNING?
//
// When a PR merges, the movement is measured TWICE on the same bytes. The PR's
// battery run measures `refs/pull/N/merge`; the merge then lands a commit with
// the SAME TREE, and the push-to-main run measures it again — 30-38 min whose
// only product is the cache entry the next PR reads.
//
// This is the decision half, kept OUT of the workflow's YAML so it can be
// tested with fixtures (`tools/probe-227-promote.mjs`). battery.yml does the
// fetching; this says yes or no, and always says why.
//
// IT REFUSES BY DEFAULT. Every clause below is a reason to RUN the battery,
// and promotion happens only when all of them are satisfied at once — §152's
// own rule ("every way this can go wrong resolves towards MORE work") applied
// to the thing that would skip the work entirely.
//
// THE FIVE CLAUSES, and why each one is load-bearing:
//
// 1. THE TREE. `git rev-parse HEAD^{tree}` of the merge commit must equal the
//    tree the candidate run measured. This is the clause the whole feature
//    turns on, and the failure it exists for is quiet: a PR's `synchronize`
//    event fires when the HEAD moves and NOT when the base does, so a merge
//    preview measured days ago can be stale against a base that advanced under
//    it. The SHAs differ in that case and so do the trees; comparing commit
//    SHAs would be useless (the merge commit is a different object by
//    construction) and comparing nothing would inherit a verdict about
//    different bytes.
//
// 2. THE PLATFORM. A baseline's rows are inherited per platform (§200 put the
//    OS and arch in the cache key for exactly this), so a Linux/X64 verdict is
//    not a Linux/ARM64 one.
//
// 3. THE SOURCE MUST BE SAME-REPO. This is the security clause and it is not
//    optional. For a `pull_request` event GitHub takes the WORKFLOW from the
//    base branch but the CODE it runs from the PR's head — so a fork could
//    ship a `tools/ci-battery.mjs` that writes a green report having measured
//    nothing, and a promotion that trusted it would skip the real gate on the
//    merge. §200 already tests the head repo before it reads anything else
//    when choosing a host; this is the same boundary applied to a verdict.
//    A same-repo contributor could forge one too — and could also just push to
//    main, which is why same-repo is the line.
//
// 4. THE RUN MUST HAVE CONCLUDED `success`. The report file cannot carry this:
//    it is uploaded on `always()` precisely so a RED run's report can be read,
//    and it records `formatVersion`, `fingerprint` and `checks` — no verdict.
//    So greenness is read off the run, never off the artifact that the run
//    produced.
//
// 5. THE RUN MUST HAVE BEEN WHOLE. A report carrying `restrictedTo` inherited
//    rows from an earlier baseline; promoting it would make the next baseline
//    a copy of a copy. §152 already refuses to CACHE a restricted report; this
//    refuses to promote one, which is the same rule one step earlier.
//
// Usage (exit 0 = promote, 1 = run the battery; the reason goes to stdout):
//   node tools/battery-promote.mjs --provenance F --report F \
//     --tree SHA --platform Linux/ARM64 --repo owner/name --conclusion success
import { readFileSync } from 'node:fs';

const arg = (name, dflt = null) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
};

export function decide({ provenance, report, tree, platform, repo, conclusion }) {
  const no = (why) => ({ promote: false, why });
  if (!provenance) return no('no provenance file — nothing says which tree that artifact measured');
  if (provenance.promoteFormat !== 1)
    return no(`provenance format v${provenance.promoteFormat ?? 'unversioned'} against this checker's v1 — a shape this code has not read before`);
  if (!tree || !/^[0-9a-f]{40}$/.test(tree)) return no(`'${tree}' is not a tree sha — refusing to compare against it`);
  // 1 — the tree
  if (provenance.tree !== tree)
    return no(`the candidate measured tree ${provenance.tree}, this commit is tree ${tree} — a stale merge preview, or a different base`);
  // 2 — the platform
  if (provenance.platform !== platform)
    return no(`the candidate ran on ${provenance.platform}, this run is ${platform} — a baseline's rows are per-platform`);
  // 3 — same repo
  if (!provenance.headRepo || provenance.headRepo !== repo)
    return no(`the candidate's head repo was ${provenance.headRepo ?? '(unrecorded)'}, not ${repo} — a fork runs its own harness code, so its verdict is not this repo's`);
  // 4 — green
  if (conclusion !== 'success')
    return no(`the candidate run concluded '${conclusion ?? '(unknown)'}' — a report is written on red runs too, so greenness is read off the run`);
  // 5 — whole
  if (!report) return no('no report file — nothing to promote');
  if (report.restrictedTo)
    return no('the candidate report is restricted (it inherited rows from an earlier baseline) — promoting it would make a baseline out of a copy of a copy');
  return { promote: true,
    why: `tree ${tree.slice(0, 12)} measured whole and green by run ${provenance.runId ?? '?'} on ${platform} (${provenance.event ?? '?'} in ${provenance.headRepo})` };
}

const readJSON = (p) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; } };

if (import.meta.url === `file://${process.argv[1]}`) {
  const d = decide({
    provenance: readJSON(arg('provenance', '')),
    report: readJSON(arg('report', '')),
    tree: arg('tree'), platform: arg('platform'), repo: arg('repo'), conclusion: arg('conclusion'),
  });
  console.log(`§227: ${d.promote ? 'PROMOTE' : 'RUN THE BATTERY'} — ${d.why}`);
  process.exit(d.promote ? 0 : 1);
}
