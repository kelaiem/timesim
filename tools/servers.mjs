// TODO 131 — WHO OWNS THAT SERVER? Every instrument in this directory spawns
// its own static server (`python3 -m http.server`, or `dev_server.py` for the
// battery and the i18n checker) and reaps it on its last line — so a probe
// that THROWS leaves the server behind, and the next run on that port reads
// the orphan (SKILL.md, "a crashed probe leaves its server running"). The
// advice used to be `pgrep -af "[h]ttp[.]server"` and a kill by hand, and
// that is how the full battery was killed mid-run at its final anchor: its
// dev server on a random port looked exactly like an orphan, because a port
// number says nothing about ownership.
//
// The process tree already knows. A live run's server still has the script
// that spawned it as an ancestor; a crashed probe's server has been reparented
// to init (or the container's subreaper) and no `.mjs` is above it. This lists
// every tools-spawned server with its OWNER, and `--reap` kills only the ones
// nothing owns. It never kills a server whose owner is alive, whatever port it
// is on, so the mistake above is not available any more.
//
//   node tools/servers.mjs          # list: pid, port, root, owner, verdict
//   node tools/servers.mjs --reap   # kill the orphans, list what was done
//
// Linux only (it reads /proc); prints and exits 0 elsewhere. An instrument in
// the REPORT sense: it never fails a build, it tells you what is running.
import { readdirSync, readFileSync, readlinkSync } from 'node:fs';

const REAP = process.argv.includes('--reap');
const SERVER = /python3?\s+(-m\s+http\.server|\S*dev_server\.py)/;

function proc(pid) {
  try {
    const cmd = readFileSync(`/proc/${pid}/cmdline`, 'latin1').split('\0').filter(Boolean).join(' ');
    const stat = readFileSync(`/proc/${pid}/stat`, 'latin1');
    const ppid = Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[1]);
    let cwd = '?';
    try { cwd = readlinkSync(`/proc/${pid}/cwd`); } catch { /* gone or unreadable */ }
    return { pid, ppid, cmd, cwd };
  } catch { return null; }
}

let pids = [];
try { pids = readdirSync('/proc').filter((d) => /^\d+$/.test(d)).map(Number); } catch {
  console.log('no /proc — this tool reads the Linux process tree and has nothing to say here');
}
const me = process.pid;
const servers = pids.map(proc).filter((p) => p && p.pid !== me && SERVER.test(p.cmd));

// Owner: the nearest ancestor that is a node process running an .mjs script.
// A bash -c wrapper between them is still a live ancestor, so the walk goes
// through it; init (pid 1) or a dead link ends it with no owner.
function ownerOf(p) {
  let cur = p, hops = 0;
  while (cur && cur.ppid > 1 && hops++ < 12) {
    const parent = proc(cur.ppid);
    if (!parent) return null;
    if (/\bnode\b/.test(parent.cmd) && /\.mjs\b/.test(parent.cmd)) {
      const script = (parent.cmd.match(/(\S+\.mjs)/) || [])[1] || parent.cmd;
      return { pid: parent.pid, script };
    }
    cur = parent;
  }
  return null;
}

const rows = servers.map((s) => {
  const port = (s.cmd.match(/(?:http\.server|dev_server\.py)\s+(\d+)/) || [])[1] || '?';
  const owner = ownerOf(s);
  return { pid: s.pid, port, root: s.cwd, owner, verdict: owner ? 'OWNED — leave it' : 'ORPHAN' };
});

if (!rows.length && pids.length) console.log('no tools-spawned servers running');
for (const r of rows) {
  console.log(`pid ${String(r.pid).padStart(6)}  port ${String(r.port).padEnd(5)}  ${r.verdict.padEnd(16)}  ${r.owner ? `${r.owner.script} (pid ${r.owner.pid})` : 'no live .mjs above it'}  root ${r.root}`);
}
if (REAP) {
  const orphans = rows.filter((r) => !r.owner);
  for (const r of orphans) {
    try { process.kill(r.pid, 'SIGTERM'); console.log(`reaped pid ${r.pid} (port ${r.port})`); } catch (e) { console.log(`could not reap pid ${r.pid}: ${e.message}`); }
  }
  console.log(`${orphans.length} orphan(s) reaped, ${rows.length - orphans.length} owned server(s) left alone`);
}
