// §338 landing 3 (moved here by landing 14) — ONE SHARD of the native battery, in
// whatever thread it runs: boot the build in the native host, take the sweep hold,
// run each task through inspect.js' own start/status protocol (or the native sweep
// engine, landing 12). tools/battery-native.mjs and tools/battery-local.mjs both run
// it, so the two cannot run a check differently.
//
// `anchors: true` also reads what the browser battery reads on its shard 0 (see below).
export async function runShard({ query, tasks, kernel = 'js', sweep = 'js', anchors = false }) {
  const { bootNative } = await import('./host.mjs');
  const { clock, ms: bootMs, warns } = await bootNative({ query });
  const I = await import('../../src/inspect.js');
  await I.useKernel(kernel);
  // §338 landing 14 — THE ANCHORS, on the shard that carries them, read where the browser
  // battery reads them: the per-unit key BEFORE the hold (its §152 preflight reads a page
  // that never took one), the fingerprint AFTER it (runShardGroup reads shard 0's after
  // prepPage), and the two rosters, which are properties of the tree.
  const anchor = anchors ? { digests: I.unitDigests(clock) } : null;
  clock.beginSweepHold();   // battery-checks.mjs prepPage's rule: the whole run, geometry frozen
  if (anchor) Object.assign(anchor, { fp: I.fingerprint(clock), checkRoster: I.CHECK_NAMES.slice() });
  // §338 landing 12 — `--sweep native`: the four checks the native sweep engine answers
  // run on it (tools/native-sweep/run.mjs), with the task's own options (a slice's axes
  // among them) after the canonical reset start() performs; every other row is unchanged.
  const N = sweep === 'native' ? await import('../native-sweep/run.mjs') : null;
  const NATIVE = N ? { inspection: N.runNativeInspection, clearances: N.runNativeClearances,
    expectedContacts: N.runNativeExpectedContacts, undeclaredClearance: N.runNativeUndeclared } : {};
  const out = [];
  for (const t of tasks) {
    const s0 = Date.now();
    if (NATIVE[t.name]) {
      if (t.opts.pairsTouching) throw new Error(`--sweep native: ${t.name} has no restricted (pairsTouching) route`);
      try {
        clock.resetInputs();
        const { payload } = await NATIVE[t.name](clock, I, { axes: t.opts.axes, ...(t.name === 'inspection' ? { includeExcluded: !!t.opts.includeExcluded } : {}) });
        out.push({ key: t.key, result: payload, ms: Date.now() - s0 });
      } catch (err) { out.push({ key: t.key, error: String(err && err.stack || err) }); }
      continue;
    }
    I.start(clock, t.name, t.opts);
    for (;;) {
      await new Promise((r) => setTimeout(r, 25));
      const st = I.status(t.name);
      if (st.state === 'done') { out.push({ key: t.key, result: st.result, ms: Date.now() - s0 }); break; }
      if (st.state === 'error') { out.push({ key: t.key, error: String(st.error) }); break; }
    }
  }
  const X = await import('../../src/exact-mesh.js');   // §338 landing 9 — the js trees: built fresh, or refitted from a family
  return { bootMs, warns, anchor, axes: I.AXES.map((a) => ({ name: a.name, n: a.n })), out, kernel: I.kernelStats(), trees: { ...X.exactStats } };
}
