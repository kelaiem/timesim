// §329 landing 1 — HOLD THE TRAILING-SIDE ARREST'S LINE SPEC (src/trailing-arrest.js). ACCEPTANCE: exits non-zero on any failure.
// Pure Node, no browser: the line is movement-independent by construction (CLAUDE.md's design priority), so it is judged in free space.
//   node tools/probe-329-arrest-line.mjs
// Each row says what it holds and carries a CONTROL that must fail, so a row that cannot fail is reported rather than trusted:
//   R  the reference is §47's: R_PAD_ARM and PAD_LIFT equal main.js' own literals (read from its source text)
//      control: the same comparison against a text with one digit changed must fail
//   K  the finger and the beak lever COUNTER-rotate, and the beak's throw grows monotonically with the pad's lift, opposite to it
//      control: a "beak on the finger" (one lever) moves the same way as the pad — the reason a second lever exists
//   B  the bite (throw − PARKED_CLEAR) equals BITE_REF, the depth §47's arrest delivers, and clears §47's BITE_MIN floor
//      control: the solve re-derives a requested bite (BITE_MIN) to float noise, so the row reads the solve, not a constant
//   S  the spring is on the beak lever: unsprung, its float would park the beak under CLEAR_MARGIN from the lug's orbit
//      control: that float is computed and must breach the margin, or the stated reason for the spring's place is false
//   E  the stop ENGAGES: the lug's force passes outside the beak pivot's friction circle on the side that drives the beak deeper
//      control: the arm set exactly ON the force line (no friction-circle offset) must fail the row
//   F  floors and envelopes: r1, r2 at or above their member floors; L2 inside §47's 1.1–2.2·R_PAD_ARM ratio band (inherited as an
//      envelope); the pin's pressure angle inside the friction cone (θ < 90° − atan μ, or the pin locks in the slot)
//      control: a beak arm outside the band is refused by the same predicate
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { solveTrailingArrest, lineAt, R_PAD_ARM, PAD_LIFT, PARKED_CLEAR, BITE_REF, BITE_MIN, R1_MIN, R2_MIN } from '../src/trailing-arrest.js';
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
console.log(`line: ψ1 ${f4(s.psi1)}  ψ2 ${f4(s.psi2)}  r1 ${f4(s.r1)}  r2 ${f4(s.r2)}  L2 ${f4(s.L2)}  β ${f4(s.beta)}  throw ${f4(s.throwNet)}  bite ${f4(s.bite)}  gain ${f4(s.gain)}`);

// K — counter-rotation and a monotone, opposite throw over the whole stroke
let kOk = true, prev = -Infinity, worst = '';
for (let i = 1; i <= 64; i++) {
  const psi1 = (i / 64) * s.psi1;
  const a = lineAt({ r1: s.r1, r2: s.r2, L2: s.L2, beta: s.beta, psi1 });
  const rest = lineAt({ r1: s.r1, r2: s.r2, L2: s.L2, beta: s.beta, psi1: 0 });
  const thr = a.beak[0] - rest.beak[0], lift = rest.pad[0] - a.pad[0];
  if (!(Math.sign(a.psi2) === -Math.sign(psi1) && thr > prev && thr > 0 && lift > 0)) { kOk = false; worst = `at ψ1 ${f4(psi1)}: ψ2 ${f4(a.psi2)} throw ${f4(thr)}`; }
  prev = thr;
}
row('K counter-rotation', kOk, kOk ? 'ψ2 opposes ψ1 and the beak moves +x (inward) while the pad lifts −x, monotonically, over 64 steps' : worst);
{ // one lever: the beak on the finger itself, on the far side of S1 from the pad's lift direction, at the same arm length
  const psi1 = s.psi1, rest = [0, s.L2], moved = [-s.L2 * Math.sin(psi1), s.L2 * Math.cos(psi1)];
  const padMove = -R_PAD_ARM * Math.sin(psi1);
  control('K', Math.sign(moved[0] - rest[0]) === Math.sign(padMove), `a beak on the finger moves ${f4(moved[0] - rest[0])} in x, the same sense as the pad's ${f4(padMove)}`);
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
  const onLine = lineAt({ r1: s.r1, r2: s.r2, L2: s.L2, beta: -s.psi2 });
  const arm = [onLine.beak[0] - onLine.d, onLine.beak[1]];
  const off = Math.abs(arm[0]);
  control('E', !(off >= s.frictionCircle - 1e-12), `the arm set on the force line passes ${off.toExponential(2)} from S2, inside the friction circle — refused`);
}

// F — floors and envelopes
const coneDeg = 90 - (Math.atan(MU_STEEL) * 180) / Math.PI;
const inBand = (L2) => L2 >= 1.1 * R_PAD_ARM && L2 <= 2.2 * R_PAD_ARM;
const fOk = s.r1 >= R1_MIN - 1e-12 && s.r2 >= R2_MIN - 1e-12 && inBand(s.L2) && s.transmissionDeg < coneDeg;
row('F floors', fOk, `r1 ${f4(s.r1)} ≥ ${f4(R1_MIN)}, r2 ${f4(s.r2)} ≥ ${f4(R2_MIN)}, L2/R_PAD_ARM ${f4(s.L2 / R_PAD_ARM)} in 1.1–2.2, pressure angle ${s.transmissionDeg.toFixed(1)}° < ${coneDeg.toFixed(1)}°; slot ${f4(s.slotLen)} long`);
control('F', !inBand(2.3 * R_PAD_ARM) && !inBand(R_PAD_ARM), 'a beak arm of 2.3 or 1.0 pad arms is refused by the same band');

console.log(fails ? `\nFAIL — ${fails} row(s) or control(s)` : '\nPASS — the trailing arrest\'s line spec holds, every control fired');
process.exit(fails ? 1 : 0);
