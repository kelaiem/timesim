#!/usr/bin/env bash
# §264 — fetch the point tier that the parallel `battery points` job measured,
# for the battery job to judge. battery.yml starts this in the BACKGROUND
# beside `ci-battery.mjs --points-tier-from "$OUT"`, so it runs while the
# sweeps do.
#
#   GH_TOKEN, OUT, NAME, POINTS_TIER_WAIT_S   set by the step
#   GITHUB_API_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID   set by Actions
#
# IT ALWAYS ENDS IN ONE OF TWO FILES. Either "$OUT" (written atomically, by
# rename, so the harness never reads half of it) or "$OUT.failed" with the
# reason, by POINTS_TIER_WAIT_S at the latest. That is the sibling's own cap,
# so this gives up exactly when the sibling would have been killed. The harness
# treats a .failed, a missing file and a file that does not prove itself the
# same way: it sweeps the tier itself and says why. Nothing this script can
# do wrong reaches a verdict. The worst it can do is cost the sweep the tier
# used to cost.
#
# Artifacts uploaded with upload-artifact@v4 are listed on the run as soon as
# their upload step ends, before the job that uploaded them finishes, which
# is what lets a job read its sibling's file mid-run. The polling is the same
# curl + node idiom as battery.yml's §227 promotion step.
set -u
: "${GH_TOKEN:?}" "${OUT:?}" "${NAME:?}" "${POINTS_TIER_WAIT_S:?}"
: "${GITHUB_API_URL:?}" "${GITHUB_REPOSITORY:?}" "${GITHUB_RUN_ID:?}"

API="${GITHUB_API_URL}/repos/${GITHUB_REPOSITORY}"
JOB="battery points"
DIR=$(dirname "$OUT")
T0=$(date +%s)
END=$(( T0 + POINTS_TIER_WAIT_S ))

say() { echo "§264 fetcher +$(( $(date +%s) - T0 ))s: $1"; }
fail() { echo "$1" > "$OUT.failed"; say "gave up — $1"; exit 0; }
api() {
  curl -sS --retry 3 -H "Authorization: Bearer $GH_TOKEN" \
    -H "Accept: application/vnd.github+json" "$API/$1" || echo '{}'
}
artifact_id() {
  api "actions/runs/${GITHUB_RUN_ID}/artifacts?name=${NAME}&per_page=10" | node -e "
    let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{
      const a=(JSON.parse(s).artifacts||[]).find(x=>!x.expired);
      process.stdout.write(a?String(a.id):'')}catch{process.stdout.write('')}})"
}
sibling() {
  api "actions/runs/${GITHUB_RUN_ID}/jobs?per_page=100" | JOB="$JOB" node -e "
    let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{
      const j=(JSON.parse(s).jobs||[]).find(x=>x.name===process.env.JOB);
      process.stdout.write(j?j.status+':'+(j.conclusion||''):'')}catch{process.stdout.write('')}})"
}
fetch() {
  rm -rf "$DIR/zip" && mkdir -p "$DIR/zip" \
    && curl -sSL --retry 3 -H "Authorization: Bearer $GH_TOKEN" \
         "$API/actions/artifacts/$1/zip" -o "$DIR/zip/a.zip" \
    && unzip -q -o "$DIR/zip/a.zip" -d "$DIR/zip" \
    && [ -f "$DIR/zip/points-tier.json" ] \
    && mv "$DIR/zip/points-tier.json" "$OUT.tmp" && mv "$OUT.tmp" "$OUT"
}

say "waiting up to ${POINTS_TIER_WAIT_S}s for artifact ${NAME}"
while [ "$(date +%s)" -lt "$END" ]; do
  id=$(artifact_id)
  if [ -n "$id" ]; then
    fetch "$id" || fail "artifact $id would not download or unzip"
    say "artifact $id fetched to $OUT"
    exit 0
  fi
  # The sibling finished and uploaded nothing: no point waiting out the cap.
  # Listed once more first, because the upload ends before the job does.
  st=$(sibling)
  case "$st" in
    completed:*)
      [ -n "$(artifact_id)" ] && continue
      fail "the '$JOB' job ended ($st) without uploading the tier" ;;
  esac
  sleep 20
done
fail "nothing arrived within ${POINTS_TIER_WAIT_S}s"
