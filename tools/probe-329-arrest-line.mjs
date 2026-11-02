// §329 — HOLD THE TRAILING-SIDE ARREST'S LINE SPEC (src/trailing-arrest.js). ACCEPTANCE: exits non-zero on any failure.
// Pure Node, no browser: the line is movement-independent by construction (CLAUDE.md's design priority), so it is judged in free space.
//   node tools/probe-329-arrest-line.mjs
// The line is the S2-BEHIND family (landing 2a: S2 ═ S1 ─ pin, the levers co-rotating, the beak lever turning less), parametrised by the
// beak arm L2, which the fold picks. Each row says what it holds and carries a CONTROL that must fail:
//   R  the reference is §47's: R_PAD_ARM and PAD_LIFT equal main.js' own literals (read from its source text)
//      control: the same comparison against a text with one digit changed must fail
//   K  the levers turn TOGETHER, the beak lever by less (ratio under 1), and the beak's throw grows monotonically with the pad's lift,
//      opposite to it
//      control: landing 1's arrangement (the pin BETWEEN the studs) turns the beak lever the other way — the sense 2a refused
//   C  the family's closed forms agree: for several L2, the turn psi2ForThrow gives and the stud distance eFor gives, run through the
//      pin-in-slot kinematics, throw exactly the line's throw, and r1For inverts eFor
//      control: a turn 1% off misses the throw
//   B  the bite (throw − PARKED_CLEAR) equals BITE_REF, the depth §47's arrest delivers, and clears §47's BITE_MIN floor
//      control: the solve re-derives a requested bite (BITE_MIN) to float noise, so the row reads the solve, not a constant
//   S  the spring is on the beak lever: unsprung, its float would park the beak under CLEAR_MARGIN from the lug's orbit
//      control: that float is computed and must breach the margin, or the stated reason for the spring's place is false
//   E  the stop ENGAGES: the lug's force passes outside the beak pivot's friction circle on the side that drives the beak deeper
//      control: the arm set exactly ON the force line (no friction-circle offset) must fail the row
//   F  floors and envelopes on the compact member: e and r1 at or above their member floors; the displacement gain inside §47's 1.1–2.2
//      band (held on throw / PAD_LIFT, where it was aimed); the pin's pressure angle inside the friction cone (θ < 90° − atan μ)
//      control: a gain outside the band is refused by the same predicate
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  solveTrailingArrest, lineAt, psi2Of, r1For, eFor, psi2ForThrow, epsOf,
  R_PAD_ARM, PAD_LIFT, PARKED_CLEAR, BITE_REF, BITE_MIN, GAIN_BAND, D_MIN, R1_MIN,
} from '../src/trailing-arrest.js';
import { CLEAR_MARGIN, MU_STEEL } from '../src/layout.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let fails = 0;
const row = (name, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`); if (!ok) fails++; };
const control = (name, firedAsExpected, detail) => { console.log(`${firedAsExpected ? 'ok  ' : 'FAIL'}  control ${name} — ${detail}`); if (!firedAsExpected) fails++; };
const f4 = (v) => v.toFixed(4);

// R — the reference is §47's own
const MAIN = readFileSync(join(ROOT, 'src/main.js'), 'utf8');
const literal = (text, name) => { const m = text.match(new RegExp(`const ${name} = ([0-9.]+);`)); return m ? Number(m[1]) : NaN; };
const refOk = (text) => literal(text, 'R_PAD_ARM') === R_PAD_ARM && literal(text, 'PAD_LIFT') === PAD_LIFT;
row('R reference', refOk(MAIN), `main.js R_PAD_ARM ${literal(MAIN, 'R_PAD_ARM')} / PAD_LIFT ${literal(MAIN, 'PAD_LIFT')}; the line ${R_PAD_ARM} / ${PAD_LIFT}`);
control('R', !refOk(MAIN.replace(/const PAD_LIFT = [0-9.]+;/, 'const PAD_LIFT = 0.37;')), 'a text whose PAD_LIFT reads 0.37 is refused');

const s = solveTrailingArrest();
console.log(`compact member: ψ1 ${f4(s.psi1)}  ψ2 ${f4(s.psi2)} (ratio ${f4(s.ratio)})  e ${f4(s.e)}  r1 ${f4(s.r1)}  r2 ${f4(s.r2)}  L2 ${f4(s.L2)}  β ${f4(s.beta)}  throw ${f4(s.throwNet)}  bite ${f4(s.bite)}  gain ${f4(s.gain)}`);

// K — co-rotation, ratio under 1, a monotone throw opposite to the lift
let kOk = s.ratio > 0 && s.ratio < 1, prev = -Infinity, worst = '';
const rest = lineAt({ e: s.e, r1: s.r1, L2: s.L2, beta: s.beta, psi1: 0 });
for (let i = 1; i <= 64; i++) {
  const psi1 = (i / 64) * s.psi1;
  const a = lineAt({ e: s.e, r1: s.r1, L2: s.L2, beta: s.beta, psi1 });
  const thr = a.beak[0] - rest.beak[0], lift = rest.pad[0] - a.pad[0];
  if (!(Math.sign(a.psi2) === Math.sign(psi1) && a.psi2 < psi1 && thr > prev && thr > 0 && lift > 0)) { kOk = false; worst = `at ψ1 ${f4(psi1)}: ψ2 ${f4(a.psi2)} throw ${f4(thr)}`; }
  prev = thr;
}
row('K co-rotation', kOk, kOk ? `ψ2 follows ψ1 at ratio ${f4(s.ratio)} < 1; the beak moves +x (inward) while the pad lifts −x, monotonically, over 64 steps` : worst);
{ // landing 1's arrangement: S2 BEYOND the pin (the pin between the studs) — the slot lever's angle is atan2(−r1·sinψ1, d − r1·cosψ1)
  const d = s.e + 2 * s.r1, psi2Between = -Math.atan2(s.r1 * Math.sin(s.psi1), d - s.r1 * Math.cos(s.psi1));
  control('K', Math.sign(psi2Between) !== Math.sign(s.psi1), `the pin between the studs turns the beak lever ${f4(psi2Between)}, against the finger's ${f4(s.psi1)}`);
}

// C — the family's closed forms
let cOk = true, cWorst = 0;
for (const L2 of [1.5, 2.5, 3.749, 5]) {
  const psi2 = psi2ForThrow(L2, s.throwNeed), e = eFor(s.psi1, psi2), beta = epsOf(L2) - psi2;
  const a = lineAt({ e, L2, beta, psi1: 0 }), b = lineAt({ e, L2, beta, psi1: s.psi1 });
  const err = Math.max(Math.abs(b.beak[0] - a.beak[0] - s.throwNeed), Math.abs(b.psi2 - psi2), Math.abs(r1For(s.psi1, psi2, e) - R1_MIN));
  cWorst = Math.max(cWorst, err); if (!(err < 1e-9)) cOk = false;
}
row('C closed forms', cOk, `psi2ForThrow, eFor and r1For against the kinematics at L2 1.5/2.5/3.749/5: worst error ${cWorst.toExponential(2)}`);
{
  const L2 = 2.5, psi2 = psi2ForThrow(L2, s.throwNeed) * 1.01, e = eFor(s.psi1, psi2), beta = epsOf(L2) - psi2;
  const miss = lineAt({ e, L2, beta }).beak[0] - lineAt({ e, L2, beta, psi1: 0 }).beak[0] - s.throwNeed;
  control('C', Math.abs(miss) > 1e-6, `a turn 1% over the closed form misses the throw by ${miss.toExponential(2)}`);
}

// B — the bite
const bOk = Math.abs(s.bite - BITE_REF) < 1e-9 && s.bite >= BITE_MIN;
row('B bite', bOk, `bite ${f4(s.bite)} (BITE_REF ${BITE_REF}, floor ${BITE_MIN}); throw ${f4(s.throwNet)} = PARKED_CLEAR ${f4(PARKED_CLEAR)} + bite`);
{ const m = solveTrailingArrest({ bite: BITE_MIN }); control('B', Math.abs(m.bite - BITE_MIN) < 1e-9 && m.L2 < s.L2, `asking for ${BITE_MIN} gives ${f4(m.bite)} on a shorter beak arm (${f4(m.L2)})`); }

// S — the spring's place
row('S spring on the beak lever', s.lostMotion === 0, `lost motion ${s.lostMotion} (the spring holds the pin on the driving flank)`);
control('S', s.parkedIfUnsprung < CLEAR_MARGIN, `unsprung, the beak would float ${f4(s.floatIfUnsprung)} and park ${f4(s.parkedIfUnsprung)} from the lug's orbit, under CLEAR_MARGIN ${CLEAR_MARGIN}`);

// E — the stop engages
const eOk = s.engaging && s.leverOffset >= s.frictionCircle - 1e-12;
row('E engaging stop', eOk, `the lug's force passes ${f4(s.leverOffset)} from S2 on the engaging side; friction circle ${f4(s.frictionCircle)} (μ ${MU_STEEL})`);
{
  const onLine = lineAt({ e: s.e, L2: s.L2, beta: -s.psi2 });
  const off = Math.abs(onLine.beak[0] + s.e);
  control('E', !(off >= s.frictionCircle - 1e-12), `the arm set on the force line passes ${off.toExponential(2)} from S2, inside the friction circle — refused`);
}

// F — floors and envelopes
const coneDeg = 90 - (Math.atan(MU_STEEL) * 180) / Math.PI;
const inBand = (g) => g >= GAIN_BAND[0] && g <= GAIN_BAND[1];
const fOk = s.e >= D_MIN - 1e-12 && s.r1 >= R1_MIN - 1e-12 && inBand(s.gain) && s.transmissionDeg < coneDeg;
row('F floors', fOk, `e ${f4(s.e)} ≥ ${f4(D_MIN)}, r1 ${f4(s.r1)} ≥ ${f4(R1_MIN)}, gain ${f4(s.gain)} in ${GAIN_BAND.join('–')}, pressure angle ${s.transmissionDeg.toFixed(1)}° < ${coneDeg.toFixed(1)}°; slot ${f4(s.slotLen)} long`);
control('F', !inBand(2.3) && !inBand(1.0), 'a gain of 2.3 or 1.0 is refused by the same band');

console.log(fails ? `\nFAIL — ${fails} row(s) or control(s)` : '\nPASS — the trailing arrest\'s line spec holds, every control fired');
process.exit(fails ? 1 : 0);
