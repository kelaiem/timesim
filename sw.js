// §79 — load with the network gone (BUILT §79).
//
// Strategy, and why it can be this cheap: §28 stamps every asset URL with
// ?v=<version>, so a cache hit is exact BY CONSTRUCTION — cache-first for the
// precached release set, network-only for everything else. A new release asks
// for new URLs out of a new cache, and activation drops the old cache whole;
// dropping per release IS the eviction policy. Per release AND per deployment
// SCOPE since §88 — see the CACHE_PREFIX note below for what shares an origin
// now, and what a flat name cost when it did.
//
// The two pass-throughs are the §79 contract, excluded EXPLICITLY rather than
// by accident of set membership:
//   1. version.json is the staleness detector (§28 layer 2). A worker that
//      answers it from a cache makes the app permanently and invisibly stale —
//      the exact failure the update toast exists to reveal.
//   2. /__state is the dev server's state endpoint. state.js falls back to
//      localStorage when that fetch FAILS — which is exactly what happens
//      offline — so intercepting it would convert the reject into a response
//      and pin serverAvailable true in the one condition §79 is about.
//
// VERSION and PRECACHE are baked by tools/stamp-release.mjs from the same walk
// that stamps the URLs, so a new file cannot be shipped and forgotten — a
// hand-kept list is the failure mode §79 names. In a source tree both stay
// null/empty and the worker DISMANTLES itself (install → activate →
// unregister): a worker registered by hand against dev_server.py's editable
// sources must not survive to shadow an edit. (The entry proposed a
// Clear-Site-Data header for that case; see BUILT §79 for why the guard lives
// here instead — that directive would also wipe the localStorage that §23's
// tuning reboot and the §73 locale choice genuinely keep on loopback.)
'use strict';
const VERSION = null; // baked by tools/stamp-release.mjs — null means source tree, worker inert
const PRECACHE = [];  // baked by tools/stamp-release.mjs from the §28 stamping walk

// Cache keys are RELATIVE to the worker's own scope, for §28's stated reason:
// the web root may be the QA symlink itself, so nothing here may assume where
// under the origin the release sits.
const SCOPE_PATH = new URL(self.registration.scope).pathname;

// §88 — the cache is named for the SCOPE as well as the version, because Cache
// Storage is partitioned by ORIGIN and the three GitHub Pages environments share
// one: production at /timesim/, testing at /timesim/testing/, development at
// /timesim/development/. Under the flat `timesim-<version>` name this file
// shipped with, activation deleted every `timesim-`-prefixed key that was not
// its own — so installing any one environment's worker threw away the other
// two's precaches, and §79's offline guarantee held for whichever environment
// was visited last and no other. The scope path is the one thing that is
// distinct per environment and identical across an environment's successive
// releases, which is exactly the partition the name needs; per-release rotation
// WITHIN an environment is unchanged, and so is the QA symlink topology (its
// scope is stable across releases because the symlink URL is).
const CACHE_PREFIX = `timesim-${SCOPE_PATH}-`;
const CACHE = CACHE_PREFIX + VERSION;
const PRECACHED = new Set(PRECACHE);

self.addEventListener('install', (e) => {
  if (!VERSION) { self.skipWaiting(); return; } // reach activate, where the stub unregisters
  // no-cache: revalidate through the HTTP cache. The stamped URLs are
  // immutable, so this costs conditional requests once per release install;
  // the two DOCUMENTS are not stamped (they are the symlink's stable URLs),
  // and precaching a stale HTTP-cached index.html would defeat the very
  // update path §28 built. addAll is all-or-nothing on purpose: a worker
  // with a partial precache would 404 offline, so it must never activate.
  e.waitUntil(caches.open(CACHE).then((c) =>
    c.addAll(PRECACHE.map((u) => new Request(u, { cache: 'no-cache' })))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    if (!VERSION) { await self.registration.unregister(); return; }
    for (const k of await caches.keys()) {
      // Two things get dropped, and only two. Ours from an older release of THIS
      // environment; and the pre-§88 flat name, recognisable because a version
      // string cannot contain a '/' where a scope path always does. That second
      // clause is a one-time sweep for viewers who hold a cache from a release
      // that shipped before this namespace existed: under the new scheme nothing
      // claims those keys, so without it they leak a whole app's worth of
      // storage forever. It cannot reach another environment's cache — every one
      // of those is `timesim-/…`.
      const mine = k.startsWith(CACHE_PREFIX);
      const orphan = k.startsWith('timesim-') && !k.startsWith('timesim-/');
      if ((mine || orphan) && k !== CACHE) await caches.delete(k);
    }
    await self.clients.claim();
  })());
});

// The update toast's Reload promotes the waiting release — one prompt, one
// path: main.js (§28 layer 2) posts this after the viewer chooses to reload.
self.addEventListener('message', (e) => { if (e.data === 'skip-waiting') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  if (!VERSION) return;
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname === '/__state') return;          // §79 exclusion 2 — state.js fetches it origin-absolute
  if (!url.pathname.startsWith(SCOPE_PATH)) return;
  let path = url.pathname.slice(SCOPE_PATH.length);
  if (path === '') path = 'index.html';             // navigation to the scope directory itself
  if (path === 'version.json') return;              // §79 exclusion 1 — never from a cache
  // Assets match WITH their query (?v= is the whole point: an old ?v never
  // answers a new request); the documents match on path alone, because deep
  // links (§22 spec params, ?lang, ?tour…) put their query on index.html and
  // must still load offline.
  const key = PRECACHED.has(path + url.search) ? path + url.search
    : PRECACHED.has(path) ? path : null;
  if (!key) return;                                 // network-only for everything else
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const hit = await c.match(key);
    if (hit) return hit;
    // a miss inside the precached set (storage eviction) heals itself online
    const r = await fetch(e.request);
    if (r.ok) await c.put(key, r.clone());
    return r;
  })());
});
