// §104 — the §47 method note, enacted: ask the builder's own frame solver
// what the alarm ribbon can take at the set-up totals. No geometry built.
// Run: node --import ./tools/three-node-loader.mjs tools/probe-104-spring.mjs
const G = await import('../src/geometry.js');
// The alarm ribbon as built (§89/§99): makeBarrel derives these from
// ALARM_BARREL_PITCH_R = 6.6, module 0.3, arbor r — reproduce the derivation
// the builder performs so the probe asks about the same metal.
const module_ = 0.3, teeth = 44, pitchR = 6.6;
const rootR = pitchR - module_ * 1.15;
const wallModule = module_;
const drumInnerR = Math.max(rootR - wallModule * 2.2, (pitchR) * 0.3); // radius arg = pitchR? makeBarrel radius arg is ALARM_BARREL_PITCH_R
const springOuter = drumInnerR - wallModule * 0.5;
const arborR = G.barrelArborR(pitchR);
const sCoils = 5, q = 0.1 / sCoils;
const sRibbon = Math.max((q * (springOuter - arborR)) / (1 + q), 0.08);
const springInner = arborR + sRibbon;
console.log(`ribbon r ${sRibbon.toFixed(5)}, inner ${springInner.toFixed(5)}, outer ${springOuter.toFixed(5)}, pBind ${(2 * sRibbon).toFixed(5)}`);
for (const [label, setupTurns, sweepTurns] of [
  ['today (no set-up)', 0, 1.75],
  ['§104 (80 clicks)', 2.5, 1.75],
  ['ceiling probe 4.3', 2.55, 1.75],
  ['over 4.4', 2.65, 1.75],
]) {
  const w = G.mainspringFrames({
    innerR: springInner, outerR: springOuter, coils: sCoils, ribbonR: sRibbon,
    sweep: sweepTurns * Math.PI * 2, setup: setupTurns * Math.PI * 2,
  });
  console.log(`${label}: total ${(setupTurns + sweepTurns).toFixed(3)} turns — capacity ${w.capacity.toFixed(4)}, lenErr ${w.lenErr.toExponential(2)}, minPitch ${w.minPitch.toFixed(9)} vs pBind ${w.pBind.toFixed(9)} (diff ${(w.minPitch - w.pBind).toExponential(3)}), maxStep ${w.maxStep.toFixed(4)}, frames ${w.frames.length}`);
}
